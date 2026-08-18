// What the app costs a reader, measured before anything is changed to make it cheaper.
//
//   node scripts/perf-baseline.mjs [baseUrl] [--fresh] [--runs N] [--routes a,b] [--json out.json]
//
// "The app takes ~10s to become usable" is the number three deploy-path gates are made of, and it
// has never been broken down. This breaks it down, and it changes NOTHING to do so: no app code is
// instrumented, no marks are added. Everything comes from what the browser already records —
// navigation timing, resource timing, the long-task observer — plus a 25ms DOM sampler installed in
// the page after navigation, which is what turns "rows appeared" into a timestamp.
//
// THE THREE NUMBERS THAT ARE NOT THE SAME NUMBER, and were being conflated:
//
//   dev server      what the gates measure — Vite serves every module unbundled and transforms on
//                   demand, so a first paint pays hundreds of requests no reader ever makes
//   prod preview    the built bundle, served locally — what qdrops.app serves, minus the network
//   fresh vs return an empty IndexedDB downloads and seeds ~14 MB of JSON; a returning reader reads
//                   it back out. Different work, and only one of them is the common case.
//
// A baseline that averages those is a baseline that cannot be improved against, so each is measured
// and reported separately.
//
// READ-ONLY. It opens tabs and reads clocks. It never writes to the repo, never touches dist/, and
// is not a gate — nothing here can pass or fail a deploy.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt }
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5174'
const MODE = args.includes('--fresh') ? 'fresh' : 'warm'
const RUNS = Number(arg('--runs', 1))
const OUT = arg('--json', null)

// /posts is where every reader lands. The six analysis tabs are the category pages the owner named,
// and they are measured separately because they do not cost the same: Named Entities renders 1,183
// rows and Emphasis renders far fewer.
const DEFAULT_ROUTES = [
  ['/posts', 'post archive'],
  ['/analysis?tab=namedEntities', 'named entities'],
  ['/analysis?tab=claims', 'claims'],
  ['/analysis?tab=predictions', 'predictions'],
  ['/analysis?tab=themes', 'themes'],
  ['/analysis?tab=emphasis', 'emphasis'],
  ['/analysis?tab=verificationHooks', 'checkable claims'],
]
const routes = arg('--routes', null)
  ? arg('--routes').split(',').map(r => [r, r])
  : DEFAULT_ROUTES

// ── The sampler ───────────────────────────────────────────────────────────────────────────────
//
// Installed immediately after the tab opens, which is early enough: the milestones it stamps are
// seconds away, and everything BEFORE it — navigation, the data fetches — is recovered afterwards
// from the Performance API, which was recording the whole time.
//
// NO BACKTICKS AND NO BACKSLASHES in this expression. It is a template literal on the way to the
// page, so an escape written here arrives as a different string than the one intended — the same
// trap the multi-word and category-order gates carry a warning about.
const SAMPLER = `(() => {
  if (window.__perf) return 'already'
  const p = { marks: {}, samples: [], long: [], installedAt: Math.round(performance.now()) }
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
  p.timer = setInterval(tick, 25)
  tick()
  return 'installed'
})()`

// Everything the browser recorded on its own. Read once, at the end, so reading it cannot slow the
// thing being measured.
const REPORT = `(() => {
  const p = window.__perf || { marks: {}, samples: [], long: [] }
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
  return {
    marks: p.marks || {},
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

const SEED_READ = `(async () => {
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    return await new Promise((res, rej) => { const r = db.transaction('collections').objectStore('collections').get('__seed_version__'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  } catch (e) { return null }
})()`

const LAST_SAMPLE = `(() => { const p = window.__perf; if (!p) return '0:0'; const n = p.samples.length; const f = n ? p.samples[n - 1] : [0,0,0]; return f[1] + ':' + f[2] })()`

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * One load, start to settled.
 *
 * "Settled" is the last time the row or chip count CHANGED, not the moment the poller noticed —
 * the quiet window used to detect it is subtracted by construction, so the number reported is the
 * app's own, not the harness's patience.
 */
async function measure(browser, url) {
  const page = await browser.page(url)
  const installed = await page.evaluate(SAMPLER)
  const QUIET = 2500
  const deadline = Date.now() + 90000
  let last = null, lastAt = Date.now(), reloads = 0
  for (;;) {
    // THE PAGE RELOADS ITSELF IN PRODUCTION, and the first version of this loop reported zeros
    // for every route because of it. main.tsx reloads once when a new service worker activates,
    // which throws away the JS context and every measurement in it. Re-arming rather than
    // trusting the first install is what makes the built bundle measurable at all — and the
    // count is reported, because a reload is not free: it is a whole startup, paid twice.
    if (await page.evaluate('!window.__perf')) {
      await page.evaluate(SAMPLER)
      reloads++
      last = null
      lastAt = Date.now()
    }
    const s = await page.evaluate(LAST_SAMPLE)
    if (s !== last) { last = s; lastAt = Date.now() }
    if (Date.now() - lastAt > QUIET && last !== '0:0') break
    if (Date.now() > deadline) break
    await sleep(150)
  }
  const report = await page.evaluate(REPORT)
  report.seed = await page.evaluate(SEED_READ)
  report.installedSampler = installed
  report.reloads = reloads
  await page.close()
  return report
}

const ms = v => (v === null || v === undefined ? '     —' : `${(v / 1000).toFixed(2)}s`.padStart(6))

console.log(`\nPERF BASELINE   ${BASE}   (${MODE} profile, ${RUNS} run${RUNS === 1 ? '' : 's'} each)\n`)
const browser = await launch({ mode: MODE })

const rows = []
for (const [route, label] of routes) {
  const runs = []
  for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, BASE + route))
  // The median run, not the mean: one GC pause should not become the baseline everything else is
  // measured against.
  const pick = runs.slice().sort((a, b) => (a.lastChange ?? 0) - (b.lastChange ?? 0))[Math.floor(runs.length / 2)]
  rows.push({ route, label, ...pick, runs: runs.map(r => r.lastChange) })
}

console.log('  route                 shell   rows  chips settled   rows  chips  reqs   data  long  block  rl')
console.log(`  ${'-'.repeat(92)}`)
for (const r of rows) {
  console.log(`  ${r.label.padEnd(18)} ${ms(r.marks.shell)} ${ms(r.marks.rows)} ${ms(r.marks.chips)} ${ms(r.lastChange)}  ${String(r.rows).padStart(5)} ${String(r.chips).padStart(6)} ${String(r.requests).padStart(5)} ${`${r.dataKb}k`.padStart(6)} ${String(r.longTasks).padStart(5)} ${ms(r.blocking)} ${String(r.reloads).padStart(3)}`)
}

const first = rows[0]
console.log(`\n  seed in IndexedDB   ${first.seed ?? 'none — this was a FIRST VISIT'}`)
console.log(`  navigation          responseEnd ${ms(first.nav.responseEnd)}  DCL ${ms(first.nav.domContentLoaded)}  load ${ms(first.nav.load)}`)
if (first.longtaskUnavailable) console.log('  long tasks          unavailable in this browser')

console.log('\n  heaviest data files on the first route')
for (const d of first.data) console.log(`    ${d.name.padEnd(30)} ${`${d.kb} kB`.padStart(9)}  start ${ms(d.start)}  ${ms(d.dur)}`)
if (!first.data.length) console.log('    none — nothing refetched; the store came back from IndexedDB')

console.log('\n  settle spread per route (each run, ms)')
for (const r of rows) console.log(`    ${r.label.padEnd(20)} ${r.runs.join(', ')}`)

if (OUT) {
  fs.writeFileSync(path.resolve(ROOT, OUT), `${JSON.stringify({ base: BASE, mode: MODE, at: new Date().toISOString(), rows }, null, 2)}\n`)
  console.log(`\n  written  ${OUT}`)
}
console.log('')
await browser.close()
