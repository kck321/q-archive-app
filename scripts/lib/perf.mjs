// The vocabulary for measuring what the app costs a reader.
//
// Extracted from scripts/perf-baseline.mjs so the post-fix harness measures with THE SAME
// instrument the baseline was taken with. Two copies of a sampler are two baselines, and a number
// measured by one cannot honestly be subtracted from a number measured by the other.
//
// Nothing here instruments the app. The page is asked what the browser already recorded —
// navigation timing, resource timing, the long-task observer — plus a 25ms DOM sampler installed
// after navigation, which is what turns "rows appeared" into a timestamp.
//
// NO BACKTICKS AND NO BACKSLASHES inside the page expressions below. They are template literals on
// the way to the page, so an escape written here arrives as a different string than the one
// intended — the same trap the multi-word and category-order gates carry a warning about.

// ── The sampler ───────────────────────────────────────────────────────────────────────────────
//
// `reset()` is the one addition the baseline sampler did not need. A direct load is measured from
// navigation, which the browser timestamps on its own; an IN-APP navigation has no such moment —
// the document never changes — so the harness stamps one at the click and the marks are read
// relative to it.
export const SAMPLER = `(() => {
  if (window.__perf) return 'already'
  const p = { marks: {}, samples: [], long: [], installedAt: Math.round(performance.now()), resetAt: 0 }
  window.__perf = p
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) p.long.push([Math.round(e.startTime), Math.round(e.duration)])
    }).observe({ type: 'longtask', buffered: true })
  } catch (e) { p.longtaskUnavailable = true }
  const mark = k => { if (p.marks[k] === undefined) p.marks[k] = Math.round(performance.now()) }
  const tick = () => {
    const rows = document.querySelectorAll('div.bg-q-panel').length
    const chips = document.querySelectorAll('a[href*="/post/"]').length
    if (document.querySelector('main')) mark('shell')
    if (rows > 0) mark('firstRow')
    if (rows > 2) mark('rows')
    if (rows > 2 && chips > 0) mark('chips')
    const last = p.samples[p.samples.length - 1]
    if (!last || last[1] !== rows || last[2] !== chips) p.samples.push([Math.round(performance.now()), rows, chips])
    if (p.samples.length > 3000) clearInterval(p.timer)
  }
  p.reset = () => { p.marks = {}; p.samples = []; p.long = []; p.resetAt = Math.round(performance.now()) }
  p.timer = setInterval(tick, 25)
  tick()
  return 'installed'
})()`

// Everything the browser recorded on its own. Read once, at the end, so reading it cannot slow the
// thing being measured. Marks come back raw AND relative to the last reset, because an in-app
// navigation has no navigation start of its own to be relative to.
export const REPORT = `(() => {
  const p = window.__perf || { marks: {}, samples: [], long: [], resetAt: 0 }
  const nav = performance.getEntriesByType('navigation')[0] || {}
  const data = []
  let dataBytes = 0
  for (const r of performance.getEntriesByType('resource')) {
    if (r.name.indexOf('/data/') === -1) continue
    dataBytes += r.encodedBodySize || 0
    data.push({
      name: r.name.split('/data/')[1],
      start: Math.round(r.startTime),
      dur: Math.round(r.duration),
      kb: Math.round((r.encodedBodySize || 0) / 1024),
    })
  }
  const samples = p.samples || []
  const lastChange = samples.length ? samples[samples.length - 1][0] : null
  const final = samples.length ? samples[samples.length - 1] : [0, 0, 0]
  const long = p.long || []
  let blocking = 0
  for (const l of long) blocking += Math.max(0, l[1] - 50)
  const base = p.resetAt || 0
  const rel = {}
  for (const k of Object.keys(p.marks || {})) rel[k] = p.marks[k] - base
  return {
    marks: p.marks || {},
    rel,
    resetAt: base,
    nav: {
      responseEnd: Math.round(nav.responseEnd || 0),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
    },
    requests: performance.getEntriesByType('resource').length,
    data: data.sort((a, b) => b.kb - a.kb).slice(0, 8),
    dataFiles: data.length,
    dataKb: Math.round(dataBytes / 1024),
    lastChange,
    settled: lastChange === null ? null : lastChange - base,
    rows: final[1],
    chips: final[2],
    longTasks: long.length,
    longest: long.reduce((m, l) => Math.max(m, l[1]), 0),
    blocking: Math.round(blocking),
    longtaskUnavailable: !!p.longtaskUnavailable,
    long: long.slice(0, 40),
    seed: null,
  }
})()`

export const LAST_SAMPLE = `(() => { const p = window.__perf; if (!p) return '0:0'; const n = p.samples.length; const f = n ? p.samples[n - 1] : [0,0,0]; return f[1] + ':' + f[2] })()`

export const SEED_READ = `(async () => {
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    return await new Promise((res, rej) => { const r = db.transaction('collections').objectStore('collections').get('__seed_version__'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  } catch (e) { return null }
})()`

export const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * Wait until the page stops changing, and report what it cost.
 *
 * "Settled" is the last time the row or chip count CHANGED, not the moment the poller noticed —
 * the quiet window is subtracted by construction, so the number is the app's own and not the
 * harness's patience.
 *
 * THE PAGE RELOADS ITSELF IN PRODUCTION when a new service worker activates (main.tsx, and it is
 * deliberate), which throws away the JS context and every measurement in it. Re-arming rather than
 * trusting the first install is what makes the built bundle measurable at all — and the reload is
 * counted and timed, because a reload is a whole startup paid twice.
 */
export async function settle(page, { quiet = 2500, timeout = 90000, startedAt = Date.now() } = {}) {
  let last = null, lastAt = Date.now(), reloads = 0, firstReloadAt = null
  const deadline = startedAt + timeout
  for (;;) {
    if (await page.evaluate('!window.__perf')) {
      await page.evaluate(SAMPLER)
      reloads++
      if (firstReloadAt === null) firstReloadAt = Date.now()
      last = null
      lastAt = Date.now()
    }
    const s = await page.evaluate(LAST_SAMPLE)
    if (s !== last) { last = s; lastAt = Date.now() }
    if (Date.now() - lastAt > quiet && last !== '0:0') break
    if (Date.now() > deadline) break
    await sleep(150)
  }
  const report = await page.evaluate(REPORT)
  report.seed = await page.evaluate(SEED_READ)
  report.reloads = reloads
  // Wall clock, from the moment the harness asked for the page to the last thing that moved on it.
  // This is the only number that survives a reload: everything inside the page is measured from a
  // document that did not exist when the reader asked for it.
  report.wall = lastAt - startedAt
  report.reloadAt = firstReloadAt === null ? null : firstReloadAt - startedAt
  return report
}

/** Stamp a start of our own, then settle — for a navigation the document does not change across. */
export async function settleAfterReset(page, { quiet = 1500, timeout = 60000, before = null } = {}) {
  await page.evaluate('window.__perf && window.__perf.reset()')
  const startedAt = Date.now()
  if (before) await before()
  return settle(page, { quiet, timeout, startedAt })
}

// ── Reading the minified bundle ────────────────────────────────────────────────────────────────
//
// The built bundle renames every function, so a profile of it names nothing: pte, VC, Et. These
// find the three functions this work is about by their SHAPE instead, which minification does not
// touch — object literal keys and property names survive it.
//
//   buildTextIndex    the only function that returns {padded, byWord}
//   getTextIndex      the arrow that calls it, inside the promise cache
//   normalizeItemKey  the function buildTextIndex calls on post.text
//
// It throws rather than guesses. A wrong offset would report a confident count of the wrong
// function, which is worse than reporting no count at all.
export function findSymbols(js) {
  const anchor = js.indexOf('return{padded:')
  if (anchor === -1) throw new Error('buildTextIndex not found in the bundle (no "return{padded:")')
  const before = js.slice(0, anchor)
  const decl = [...before.matchAll(/function ([A-Za-z_$][A-Za-z_$0-9]*)\(/g)].pop()
  if (!decl) throw new Error('buildTextIndex has no enclosing function declaration')
  const buildName = decl[1]
  const buildOffset = decl.index

  const esc = s => s.replace(/\$/g, '\\$')
  const call = new RegExp('=>' + esc(buildName) + '\\(')
  const m = call.exec(js)
  const gtiDecl = m ? [...js.slice(0, m.index).matchAll(/function ([A-Za-z_$][A-Za-z_$0-9]*)\(/g)].pop() : null

  // normalizeItemKey, read out of buildTextIndex's own body: const X = NAME(post.text ?? "")
  const body = js.slice(buildOffset, anchor)
  const nk = /=([A-Za-z_$][A-Za-z_$0-9]*)\([A-Za-z_$][A-Za-z_$0-9]*\.text\?\?""\)/.exec(body)
  let norm = null
  if (nk) {
    const nd = new RegExp('function ' + esc(nk[1]) + '\\(').exec(js)
    if (nd) norm = { name: nk[1], offset: nd.index }
  }
  // mutateStore, the only function that rebuilds the post lookups after a write. Counting it is how
  // "the edit dropped the cache" stops being an inference: one write should drop it once.
  let mutate = null
  const mk = /postsById\.clear\(\)/.exec(js)
  if (mk) {
    const md = [...js.slice(0, mk.index).matchAll(/function ([A-Za-z_$][A-Za-z_$0-9]*)\(/g)].pop()
    if (md) mutate = { name: md[1], offset: md.index }
  }

  return {
    buildTextIndex: { name: buildName, offset: buildOffset },
    getTextIndex: gtiDecl ? { name: gtiDecl[1], offset: gtiDecl.index } : null,
    normalizeItemKey: norm,
    mutateStore: mutate,
  }
}

/** Turn on call counting. Counts are deltas: every take resets them. */
export async function startCounting(page) {
  await page.cdp('Profiler.enable')
  await page.cdp('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
}

/**
 * How many times each symbol was CALLED since the last take.
 *
 * Matched by offset, not by name — the names are gone. The smallest function range containing the
 * symbol's offset is that function, and its first range carries the call count.
 *
 * ABSENT IS ZERO, AND THAT DISTINCTION IS THE WHOLE POINT OF THIS FUNCTION. V8 reports only the
 * functions that RAN since the last take, so a symbol missing from a take that did report its own
 * script ran zero times — which is exactly the claim being tested when a navigation is supposed to
 * build nothing. Only when the script itself is absent is the answer unknown, and that comes back
 * as null so it can never be read as a zero.
 *
 * Counts are a LOWER BOUND for small functions: V8 does not count a call it inlined.
 *
 * AND AN UPPER BOUND FOR A FUNCTION THAT HAS ALREADY RUN IN THIS PAGE — measured, not assumed. A
 * counter pushed into buildTextIndex's own body on an instrumented copy of the same bundle recorded
 * ONE build across a navigation where this reported two (isBlockCoverage was false for that entry,
 * so the count is coarse). The two instruments agree on zero and agree on a fresh page session.
 * Where they disagree, the in-function counter is the one that saw the call.
 */
export async function takeCounts(page, symbols, urlPart) {
  const cov = await page.cdp('Profiler.takePreciseCoverage')
  const all = cov?.result?.result ?? []
  const scripts = urlPart ? all.filter(s => (s.url || '').includes(urlPart)) : all
  const out = {}
  for (const [label, sym] of Object.entries(symbols)) {
    if (!sym) { out[label] = null; continue }
    let total = 0, seen = false
    for (const script of scripts) {
      let best = null
      for (const fn of script.functions ?? []) {
        const r = fn.ranges?.[0]
        if (!r) continue
        if (r.startOffset <= sym.offset && sym.offset < r.endOffset) {
          if (!best || (r.endOffset - r.startOffset) < (best.endOffset - best.startOffset)) best = r
        }
      }
      if (best) { total += best.count; seen = true }
    }
    out[label] = seen ? total : (scripts.length ? 0 : null)
  }
  return out
}

/** A CPU profile of whatever `fn` does. 100µs sampling: fine enough to separate ~50ms frames. */
export async function cpuProfile(page, fn) {
  await page.cdp('Profiler.enable')
  await page.cdp('Profiler.setSamplingInterval', { interval: 100 })
  await page.cdp('Profiler.start')
  const value = await fn()
  const stopped = await page.cdp('Profiler.stop')
  return { profile: stopped?.result?.profile, value }
}

/**
 * Self time per frame, hottest first, each one carrying the minified source at its own offset.
 *
 * The snippet is what makes a profile of a minified bundle readable at all: `pte` means nothing,
 * but the 90 characters that start at pte's offset are greppable against src/.
 */
export function topSelfTime(profile, js, urlPart, n = 14) {
  const byId = new Map()
  for (const node of profile.nodes) byId.set(node.id, node)
  const self = new Map()
  const { samples = [], timeDeltas = [] } = profile
  for (let i = 0; i < samples.length; i++) self.set(samples[i], (self.get(samples[i]) ?? 0) + (timeDeltas[i] ?? 0))
  const lineOffsets = [0]
  for (let i = 0; i < js.length; i++) if (js.charCodeAt(i) === 10) lineOffsets.push(i + 1)
  const rows = []
  let totalUs = 0
  for (const [id, us] of self) {
    totalUs += us
    const node = byId.get(id)
    if (!node) continue
    const f = node.callFrame
    let snippet = ''
    if (urlPart && (f.url || '').includes(urlPart) && f.lineNumber >= 0) {
      const off = (lineOffsets[f.lineNumber] ?? 0) + f.columnNumber
      snippet = js.slice(off, off + 90).replace(/\s+/g, ' ')
    }
    rows.push({
      name: f.functionName || '(anonymous)',
      file: (f.url || '').split('/').pop(),
      ms: us / 1000,
      hits: node.hitCount ?? 0,
      snippet,
    })
  }
  rows.sort((a, b) => b.ms - a.ms)
  return { rows: rows.slice(0, n), totalMs: totalUs / 1000 }
}
