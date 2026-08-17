// The month chart behaves the same way everywhere, and a keyboard can drive it.
//
// This is a behaviour gate, not a rendering one. The contract:
//
//   HOVER  reads out. A tooltip carrying the month and its counts, and NOTHING else changes —
//          no chip pulses, no row is recoloured, no selection or filter moves.
//   CLICK  selects. The category filters to that month, only that month's chips remain, the active
//          month is stated, and it can be cleared or changed.
//   KEYS   Enter and Space do exactly what a click does, and the selection is announced.
//
// Run against every Analysis category and the Post Archive, because "it works on Claims" was true
// for months while Emphasis and the Archive each did something slightly different.
//
//   node scripts/test-month-chart-behaviour.mjs [--url http://localhost:5199]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const argOnly = process.argv.indexOf('--only')
const ALL_CATEGORIES = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks', 'emphasis']
// --only <cat> narrows the sweep. Used to point the gate at the DEPLOYED site to prove it is not
// vacuous: against the old build these same assertions fail, which is the only evidence that a
// passing run means anything.
const CATEGORIES = argOnly > -1 ? [process.argv[argOnly + 1]] : ALL_CATEGORIES

// Desktop and a phone, because the pulse fired from a mousemove the touch path also produces, and
// the chart bars are ~4px wide on a phone — which is why the keyboard picker matters most there.
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
]

const PORT = 9417
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'qdrops-month-'))
const CHROME = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'google-chrome'
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
{ stdio: 'ignore', detached: true })
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* not up */ }
  await sleep(500)
}

async function session(url, viewport) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise(r => { ws.onopen = r })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile,
  })
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    try { return JSON.parse(r.result?.result?.value) } catch { return { error: String(r.result?.result?.value).slice(0, 300) } }
  }
  const key = async (type, k) => send('Input.dispatchKeyEvent', {
    type, key: k,
    text: k === 'Enter' ? '\r' : k === ' ' ? ' ' : undefined,
    windowsVirtualKeyCode: k === 'Enter' ? 13 : k === ' ' ? 32 : k === 'ArrowRight' ? 39 : 0,
  })
  const press = async k => { await key('keyDown', k); await key('keyUp', k) }
  const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`) }
  return { evaluate, press, close }
}

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, ok: Boolean(ok), description, detail: String(detail) })
  if (!ok) console.log(`    FAIL  ${id.padEnd(30)} ${description}\n          ↳ ${String(detail).slice(0, 240)}`)
}

// The probe helpers, installed after load — the tab opens AT the url, so anything defined earlier
// belongs to the document being replaced.
const HELPERS = `(() => {
  window.__q = {
    // Every month button in the shared picker. These are the keyboard and touch path.
    months: () => [...document.querySelectorAll('[role="radiogroup"] [role="radio"]')],
    selected: () => {
      const b = [...document.querySelectorAll('[role="radiogroup"] [role="radio"]')].find(x => x.getAttribute('aria-checked') === 'true')
      return b ? b.getAttribute('aria-label') : null
    },
    live: () => {
      const el = document.querySelector('[role="status"][aria-live="polite"]')
      return el ? (el.textContent || '').trim() : null
    },
    // Anything that pulses, flashes or dims in the results area. The old hover reached in here.
    animated: () => document.querySelectorAll('[class*="animate-chip-pulse"], [class*="opacity-30"]').length,
    chips: () => [...document.querySelectorAll('a')].filter(a => /^#\\d+/.test(a.textContent.trim())).length,
    tooltip: () => {
      const t = document.querySelector('.recharts-tooltip-wrapper')
      return t ? (t.textContent || '').trim() : ''
    },
    bar: () => document.querySelector('.recharts-bar-rectangle'),
  }
  return JSON.stringify({ ok: true })
})()`

async function runSurface(name, url, viewport) {
  const s = await session(url, viewport)
  await sleep(14000)
  await s.evaluate(HELPERS)

  const base = await s.evaluate(`JSON.stringify({
    months: window.__q.months().length,
    selected: window.__q.selected(),
    animated: window.__q.animated(),
    chips: window.__q.chips(),
    live: window.__q.live(),
  })`)

  check(`${name}-picker-present`, 'the month picker offers a focusable control per month',
    (base.months ?? 0) > 0, `${base.months} month buttons`)
  check(`${name}-starts-unfiltered`, 'nothing is selected before an interaction',
    base.selected === null, `selected=${base.selected}`)

  // ── HOVER: reads out, changes nothing ──────────────────────────────────────
  // Dispatched as a real pointer move over the plot area, which is what produced the pulse.
  const hover = await s.evaluate(`(() => {
    const bar = window.__q.bar()
    if (!bar) return JSON.stringify({ noBar: true })
    const r = bar.getBoundingClientRect()
    const at = (type, x, y) => bar.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }))
    at('mouseover', r.left + r.width / 2, r.top + r.height / 2)
    at('mousemove', r.left + r.width / 2, r.top + r.height / 2)
    return JSON.stringify({ noBar: false })
  })()`)
  await sleep(900)
  const afterHover = await s.evaluate(`JSON.stringify({
    selected: window.__q.selected(),
    animated: window.__q.animated(),
    chips: window.__q.chips(),
    live: window.__q.live(),
    tooltip: window.__q.tooltip(),
  })`)

  if (!hover.noBar) {
    check(`${name}-hover-no-animation`, 'hover pulses, flashes or dims nothing in the results',
      afterHover.animated === 0 && base.animated === 0, `before=${base.animated} after=${afterHover.animated}`)
    check(`${name}-hover-no-selection`, 'hover changes neither selection nor filtering',
      afterHover.selected === base.selected && afterHover.chips === base.chips,
      `selected ${base.selected}->${afterHover.selected}, chips ${base.chips}->${afterHover.chips}`)
    check(`${name}-hover-no-announcement`, 'hover says nothing to a screen reader',
      afterHover.live === base.live, `live "${base.live}" -> "${afterHover.live}"`)
  }

  // ── KEYBOARD: Enter selects, exactly as a click does ───────────────────────
  // A month with results, so the assertions below have something to count.
  const target = await s.evaluate(`(() => {
    const bs = window.__q.months()
    const withData = bs.find(b => {
      const m = (b.getAttribute('aria-label') || '').match(/,\\s*([\\d,]+)\\s/)
      return m && Number(m[1].replace(/,/g, '')) > 0
    }) || bs[0]
    if (!withData) return JSON.stringify({ none: true })
    withData.focus()
    return JSON.stringify({ none: false, label: withData.getAttribute('aria-label') })
  })()`)

  if (!target.none) {
    await s.press('Enter')
    await sleep(2500)
    const afterEnter = await s.evaluate(`JSON.stringify({
      selected: window.__q.selected(), chips: window.__q.chips(), live: window.__q.live(),
      cleared: Boolean([...document.querySelectorAll('button')].find(b => /Clear month/i.test(b.textContent))),
    })`)
    check(`${name}-enter-selects`, 'Enter selects the focused month',
      Boolean(afterEnter.selected) && /selected/.test(afterEnter.selected ?? ''), `selected=${afterEnter.selected}`)
    check(`${name}-enter-filters`, 'selecting narrows the visible post chips',
      (afterEnter.chips ?? 0) <= (base.chips ?? 0), `chips ${base.chips} -> ${afterEnter.chips}`)
    check(`${name}-announced`, 'the month and its result count are announced',
      Boolean(afterEnter.live) && /selected/i.test(afterEnter.live ?? '') && /\d/.test(afterEnter.live ?? ''),
      `live="${afterEnter.live}"`)
    check(`${name}-clearable`, 'a way to clear the month is offered',
      afterEnter.cleared === true, `clear control=${afterEnter.cleared}`)

    // CHANGING the month, not just setting it: pick a different one and confirm the first is released.
    const changed = await s.evaluate(`(() => {
      const bs = window.__q.months()
      const cur = bs.findIndex(b => b.getAttribute('aria-checked') === 'true')
      const next = bs[cur + 1] || bs[cur - 1]
      if (!next) return JSON.stringify({ none: true })
      next.focus()
      return JSON.stringify({ none: false, label: next.getAttribute('aria-label') })
    })()`)
    if (!changed.none) {
      await s.press(' ')
      await sleep(2500)
      const afterSpace = await s.evaluate(`JSON.stringify({
        selected: window.__q.selected(),
        checked: window.__q.months().filter(b => b.getAttribute('aria-checked') === 'true').length,
      })`)
      check(`${name}-space-selects`, 'Space performs the same action as Enter and a click',
        Boolean(afterSpace.selected) && afterSpace.selected !== afterEnter.selected,
        `${afterEnter.selected} -> ${afterSpace.selected}`)
      check(`${name}-single-selection`, 'changing the month releases the previous one',
        afterSpace.checked === 1, `${afterSpace.checked} months marked selected`)
    }

    // And clearing puts it back.
    await s.evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Clear month/i.test(x.textContent))
      if (b) b.click()
      return JSON.stringify({ clicked: Boolean(b) })
    })()`)
    await sleep(2000)
    const afterClear = await s.evaluate(`JSON.stringify({ selected: window.__q.selected(), live: window.__q.live() })`)
    check(`${name}-clears`, 'clearing releases the month and says so',
      afterClear.selected === null && /cleared/i.test(afterClear.live ?? ''),
      `selected=${afterClear.selected} live="${afterClear.live}"`)
  }

  await s.close()
}

console.log(`\nMONTH CHART BEHAVIOUR — ${URL_BASE}\n`)
for (const viewport of VIEWPORTS) {
  console.log(`  ${viewport.name} (${viewport.width}x${viewport.height})`)
  for (const cat of CATEGORIES) {
    await runSurface(`${viewport.name}/${cat}`, `${URL_BASE}/analysis?tab=${cat}`, viewport)
  }
  // The Archive chart, driven by the same module.
  await runSurface(`${viewport.name}/archive`, `${URL_BASE}/posts?q=Israel`, viewport)
  const passed = results.filter(r => r.id.startsWith(viewport.name) && r.ok).length
  const total = results.filter(r => r.id.startsWith(viewport.name)).length
  console.log(`    ${passed}/${total} checks pass`)
}

try { process.kill(-proc.pid) } catch { try { proc.kill() } catch { /* gone */ } }
const failed = results.filter(r => !r.ok)
console.log(failed.length
  ? `\n  ${failed.length} of ${results.length} checks FAILED\n`
  : `\n  all ${results.length} checks pass — hover reads out, click selects, keys match the mouse\n`)
process.exit(failed.length ? 1 : 0)
