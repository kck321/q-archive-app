// Every Post Analysis section headline, read off the live page and compared to the contract.
//
// The headline used to be summed from the phrase-frequency index, which groups by phrase — so a
// phrase Q repeats inside one post collapsed to that post once and Claims read "4,175 mentions"
// against a certified 4,188. Thirteen real occurrences, missing from a user-facing number.
//
// The invariant in audit-cross-section.mjs asserts the SOURCE is certified. This asserts what a
// reader actually sees, which is not the same claim.
//
//   node scripts/verify-section-headlines.mjs [--url https://qdrops.app]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, CHIPS_READY } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'

const browser = await launch({ mode: 'fresh' })

// THE HEADLINE IS BOTH THE ASSERTION AND THE WAIT. This paid a flat 15s per section — 105s for
// seven pages — to reach a state the page announces.
//
// CHIPS_READY, not "rows exist": the section header paints before the frequency index lands, so a
// gate that reads it too early compares a placeholder to a certified figure and reports a working
// headline broken. Rows carrying post chips means the index arrived; the header then only has to
// stop moving.
const HEADER = `((document.querySelector('main') || document.body).innerText || '')
  .split(String.fromCharCode(10)).filter(Boolean).slice(0, 10).join(' | ')`

async function run(url, expression) {
  const page = await browser.page(url)
  const ready = await page.waitFor(CHIPS_READY, { timeout: 90000 })
  if (ready) await page.waitForStable(HEADER, { stableFor: 3, every: 400, timeout: 30000 })
  const v = await page.evaluate(expression)
  await page.close()
  if (!ready) return { error: 'the section never rendered rows carrying post chips' }
  try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return { error: String(v).slice(0, 200) } }
}

// The contract, read from the one place that declares it rather than transcribed here.
//
// These seven rows were hardcoded, and five of them had gone stale: it expected 4,188 Claims against
// a certified 4,221, 5,251 Emphasis against 3,112 after the question rule retired 2,138 rows, and
// 7,903 entity mentions against 8,798 after the integrated cleanup. So the gate reported five
// failures on every run, which is the same as reporting nothing — a check that is always red cannot
// tell you the day a headline actually breaks.
//
// SECTION_TOTALS in src/lib/sectionInfo.ts is what the page renders from, so parsing it is what
// makes this a test of TRANSPORT — did the certified figure reach the reader — rather than a second,
// drifting copy of the figures.
const totalsSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'sectionInfo.ts'), 'utf8')
const totalsBlock = totalsSrc.match(/SECTION_TOTALS[^=]*=\s*\{([\s\S]*?)\n\}/)
if (!totalsBlock) { console.error('FAIL  could not read SECTION_TOTALS from src/lib/sectionInfo.ts'); process.exit(1) }
const EXPECT = [...totalsBlock[1].matchAll(/(\w+):\s*\{\s*occurrences:\s*(\d+),\s*posts:\s*(\d+),\s*unit:\s*'([^']+)'/g)]
  .map(m => [m[1], Number(m[2]), Number(m[3]), m[4]])
if (EXPECT.length !== 7) { console.error(`FAIL  parsed ${EXPECT.length} sections from SECTION_TOTALS, expected 7`); process.exit(1) }

// Named Entities leads with the IDENTITY count and carries the mention count beside it, so its
// header is checked against the reconciled model as well as against the section total. The figures
// come from the shipped artifact, which is the same file the page reads.
const entityView = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'entity-public-view.json'), 'utf8'))
const ENTITY_EXTRA = [
  entityView.totals.canonicalEntities,
  entityView.totals.proseMentioned,
  entityView.totals.sourceOnly,
  entityView.totals.dormantReserved,
]

const probe = `(() => {
  const main = document.querySelector('main') || document.body
  const head = (main.innerText || '').split(String.fromCharCode(10)).filter(Boolean).slice(0, 10)
  return JSON.stringify({ head })
})()`

console.log(`\nSECTION HEADLINES — ${URL_BASE}\n`)
let failed = 0
for (const [tab, occ, posts, unit] of EXPECT) {
  const r = await run(`${URL_BASE}/analysis?tab=${tab}`, probe)
  const line = (r.head ?? []).join(' | ')
  // The header renders as "<n><unit>" and "within<n>posts", so compare on digits and wording
  // rather than on exact spacing.
  const okOcc = line.includes(occ.toLocaleString())
  const okPosts = line.includes(posts.toLocaleString())
  const okUnit = line.toLowerCase().includes(unit.toLowerCase())
  // The reconciled entity header must carry the total, both disjoint components and the dormant
  // count. A page that prints the mention figure alone is the defect this pass exists to fix.
  const missingEntity = tab === 'namedEntities'
    ? ENTITY_EXTRA.filter(n => !line.includes(n.toLocaleString()))
    : []
  const ok = okOcc && okPosts && okUnit && !missingEntity.length
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${tab.padEnd(19)} expect ${occ.toLocaleString()} ${unit} / ${posts.toLocaleString()} posts`)
  console.log(`        page: ${line.slice(0, 150)}`)
  if (!ok) console.log(`        occ=${okOcc} posts=${okPosts} unit=${okUnit}${missingEntity.length ? ` missingEntityFigures=${missingEntity.join(',')}` : ''}`)
}

await browser.close({ keepWarm: false })
console.log(failed ? `\n  ${failed} of ${EXPECT.length} headlines wrong\n` : `\n  all ${EXPECT.length} headlines match the certified contract\n`)
process.exit(failed ? 1 : 0)
