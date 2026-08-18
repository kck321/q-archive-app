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
import { SAMPLER, settle } from './lib/perf.mjs'

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

// ── The instrument ────────────────────────────────────────────────────────────────────────────
//
// The sampler, the report and the settle loop live in scripts/lib/perf.mjs, because
// scripts/perf-postfix.mjs measures the same app against the numbers this file produced. Two
// copies of a sampler are two baselines, and a number taken with one cannot honestly be
// subtracted from a number taken with the other.

/**
 * One load, start to settled.
 *
 * "Settled" is the last time the row or chip count CHANGED, not the moment the poller noticed —
 * the quiet window used to detect it is subtracted by construction, so the number reported is the
 * app's own, not the harness's patience.
 */
async function measure(browser, url) {
  const startedAt = Date.now()
  const page = await browser.page(url)
  const installed = await page.evaluate(SAMPLER)
  const report = await settle(page, { startedAt })
  report.installedSampler = installed
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
