// Shared browser harness. One place that knows how to open a page, so tests differ in what they
// ASSERT rather than in how they drive Chrome.
//
// THE COST THIS EXISTS TO REMOVE. Every check used to launch Chrome on a brand-new profile, which
// forces the app to re-seed IndexedDB from a 9 MB bundle before a single row renders — ~20s of
// dead wait per run, paid again for every one-line change. The protection was never the problem;
// paying for it during iteration was.
//
//   warm    reuse a running Chrome AND a seeded profile. For iterating.
//   fresh   brand-new profile, nothing cached. A first-time visitor.
//   stale   a warm profile deliberately downgraded to an older SEED_VERSION. A returning visitor.
//
// Warm is for development. Fresh + stale + live are the pre-deploy proof and are never skipped —
// the returning-visitor case has produced real, shipped failures three times in one day, and no
// amount of green server-side data predicts it.
//
// Waiting is by CONDITION, not by clock. The fixed sleeps were the other half of the cost: long
// enough to be slow, still short enough to race a slow load and report a working feature broken.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Enough of a keyboard to drive the app. `text` is what makes Enter and Space activate a button —
// without it Chrome delivers the keydown but no default action, and a keyboard gate silently
// asserts nothing.
const KEY_CODES = { Enter: 13, ' ': 32, Escape: 27, Tab: 9, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }
const KEY_TEXT = { Enter: '\r', ' ': ' ' }

export const WARM_PORT = 9333
export const WARM_PROFILE = path.join(os.tmpdir(), 'qdrops-warm-profile')

async function portAlive(port) {
  try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch { return false }
}

/**
 * Open a browser.
 *
 * `mode: 'warm'` reuses whatever is already listening on WARM_PORT — across test runs and across
 * sessions — so the second check onward pays nothing for startup or seeding.
 */
export async function launch({ mode = 'warm', port, profile } = {}) {
  if (!CHROME) throw new Error('No Chrome or Edge found.')
  const isWarm = mode === 'warm' || mode === 'stale'
  const usePort = port ?? (isWarm ? WARM_PORT : 9000 + (process.pid % 900))
  const useProfile = profile ?? (isWarm ? WARM_PROFILE : path.join(os.tmpdir(), `qdrops-${mode}-${process.pid}`))

  if (isWarm && await portAlive(usePort)) {
    return makeHandle(usePort, useProfile, null, true)
  }
  if (!isWarm) fs.rmSync(useProfile, { recursive: true, force: true })
  fs.mkdirSync(useProfile, { recursive: true })
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${usePort}`, `--user-data-dir=${useProfile}`, 'about:blank'],
    { stdio: 'ignore', detached: true })
  for (let i = 0; i < 60; i++) {
    if (await portAlive(usePort)) break
    await sleep(250)
  }
  if (!await portAlive(usePort)) throw new Error(`Chrome did not come up on ${usePort}`)
  return makeHandle(usePort, useProfile, proc, false)
}

function makeHandle(port, profile, proc, reused) {
  return {
    port, profile, reused,
    /** Open a tab and return a page driver. */
    async page(url, viewport = null) {
      const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
      const ws = new WebSocket(t.webSocketDebuggerUrl)
      await new Promise(r => { ws.onopen = r })
      let id = 0
      const pending = new Map()
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
      await send('Page.enable')
      // A REAL narrow viewport, not a resized window. A card that is "on screen" at 1280px can sit
      // half off the edge at 390px, and that is the width most readers are on. Emulation is used
      // rather than a window resize because a headless window's inner size is not reliable.
      if (viewport) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width, height: viewport.height,
          deviceScaleFactor: viewport.deviceScaleFactor ?? 2,
          mobile: viewport.mobile ?? true,
        })
        if (viewport.touch !== false) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
      }
      const evaluate = async expression => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
        if (r.result?.exceptionDetails) return { __error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }
        return r.result?.result?.value
      }
      const waitFor = async (expression, { timeout = 45000, every = 400 } = {}) => {
        const deadline = Date.now() + timeout
        for (;;) {
          const v = await evaluate(expression)
          if (v && !v.__error) return v
          if (Date.now() > deadline) return null
          await sleep(every)
        }
      }
      const key = (type, k) => send('Input.dispatchKeyEvent', {
        type, key: k,
        text: type === 'keyUp' ? undefined : KEY_TEXT[k],
        windowsVirtualKeyCode: KEY_CODES[k] ?? 0,
        nativeVirtualKeyCode: KEY_CODES[k] ?? 0,
      })
      return {
        evaluate,
        /** Poll `expression` until it returns truthy. Returns the value, or null on timeout. */
        waitFor,
        /**
         * Poll until `expression` returns the SAME value `stableFor` times running.
         *
         * For the things that have no single "done" flag — a virtualised list paging rows in, a
         * frequency index landing after the first paint. A fixed sleep guesses how long that takes;
         * this waits for it to stop moving, which is the property the assertion actually needs.
         * Returns the settled value, or the last one seen if the timeout is reached.
         */
        async waitForStable(expression, { stableFor = 2, every = 250, timeout = 45000 } = {}) {
          const deadline = Date.now() + timeout
          let last, hits = 0, v
          for (;;) {
            v = await evaluate(expression)
            if (!v?.__error) {
              const s = JSON.stringify(v)
              if (s === last) { if (++hits >= stableFor) return v } else { hits = 1; last = s }
            }
            if (Date.now() > deadline) return v
            await sleep(every)
          }
        },
        /** A real key event, as the browser delivers it — not a synthetic DOM event. */
        key,
        async press(k) { await key('keyDown', k); await key('keyUp', k) },
        async close() { ws.close(); try { await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`) } catch { /* gone */ } },
      }
    },
    /** Warm browsers are left running ON PURPOSE — that is the whole optimisation. */
    async close({ keepWarm = reused || port === WARM_PORT } = {}) {
      if (keepWarm) return
      try { process.kill(-proc.pid) } catch { try { proc?.kill() } catch { /* gone */ } }
      await sleep(400)
      try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* Chrome still holds it */ }
    },
  }
}

/** The IndexedDB helpers every seed-aware check needs. Injected into page expressions. */
export const IDB = `
  const openDb = () => new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const idbGet = async k => { const db = await openDb(); return new Promise((res, rej) => { const r = db.transaction('collections').objectStore('collections').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }) }
  const idbPut = async (k, v) => { const db = await openDb(); return new Promise((res, rej) => { const r = db.transaction('collections', 'readwrite').objectStore('collections').put(v, k); r.onsuccess = () => res(true); r.onerror = () => rej(r.error) }) }
`

/** The archive is ready when its rows exist — not when the clock says so. */
export const ROWS_READY = `document.querySelectorAll('div.bg-q-panel').length > 2`

// The rest of the vocabulary the gates wait on. Each one names a state the page reaches, so a
// change that makes the app slower makes a test slower rather than making it flaky.

/** Rows exist AND carry their post chips — i.e. the frequency index has landed, not just the shell. */
export const CHIPS_READY = `document.querySelectorAll('div.bg-q-panel').length > 2
  && document.querySelectorAll('a[href*="/post/"]').length > 0`

/** The shared month picker has rendered its per-month controls. */
export const MONTHS_READY = `document.querySelectorAll('[role="radiogroup"] [role="radio"]').length > 0`

/** A drop reader is showing the post body. */
export const DROP_READY = `document.querySelectorAll('pre[class*="post-text"]').length > 0`

/** How many rows and chips are on screen — the value to hand `waitForStable` while a list pages in. */
export const LIST_SIZE = `document.querySelectorAll('div.bg-q-panel').length + ':'
  + document.querySelectorAll('a[href*="/post/"]').length`

/** IndexedDB has been seeded to `seed`. Async — `evaluate` awaits it. */
export const seededTo = seed => `(async () => { ${IDB}
  try { return (await idbGet('__seed_version__')) === ${seed} } catch { return false } })()`

/** SEED_VERSION as the built app declares it, read from source so a test cannot pin a stale value. */
export function builtSeedVersion(root) {
  const src = fs.readFileSync(path.join(root, 'src', 'lib', 'localData.ts'), 'utf8')
  return Number((src.match(/export const SEED_VERSION = (\d+)/) ?? [])[1] ?? -1)
}
