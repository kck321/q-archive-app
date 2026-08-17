// Prove the POST ARCHIVE search shows the aliases tied to the searched term — rendered page.
//
// The Analysis archive already unioned both alias registries (test-alias-visibility.mjs covers
// it). The Post Archive did not: its match set, mention counts, "Includes:" chips and per-alias
// post colours all read the owner-editable map only, so /posts?q=covid-19 found 38 posts and
// listed no aliases while /posts?q=potus listed six. Same OWNER RULE, different surface — so it
// gets its own proof, driven through the real page.
//
//   node scripts/test-archive-alias-visibility.mjs [baseUrl] [--fresh]
//     default        warm browser — for iterating          (baseUrl default http://localhost:5174)
//     --fresh        brand-new profile — part of the proof
import { launch } from './lib/browser.mjs'

const BASE = process.argv.find(a => a.startsWith('http')) ?? 'http://localhost:5174'
const mode = process.argv.includes('--fresh') ? 'fresh' : 'warm'

const browser = await launch({ mode })

// The Includes row IS the assertion, so it is also the wait. A 16s settle was both slower than a
// warm load and short enough to race a cold one — and a race here reads an empty row and reports a
// working ruling broken, which is the failure this gate exists to prevent.
//
// "THE BANNER EXISTS" IS NOT THE CONDITION. The archive paints "Found 0 posts matching" before the
// posts collection arrives, so waiting for the banner returns in ~200ms against an empty page and
// every alias assertion fails on a site that is fine. The condition is a non-zero result set — which
// is what each of these searches is asserted to have. A genuinely empty one falls through to the
// stability wait and is reported as the zero it is, rather than hanging.
const RESULT_COUNT = `(() => {
  const m = (document.body.innerText || '').match(/Found\\s+([\\d,]+)\\s+posts matching/)
  return m ? Number(m[1].replace(/,/g, '')) : -1
})()`

async function run(url, expression) {
  const page = await browser.page(url)
  const got = await page.waitFor(`(${RESULT_COUNT}) > 0`, { timeout: 90000 })
  // The Includes chips mount a beat after the count; wait for the row to stop changing.
  await page.waitForStable(`(document.body.innerText || '').length`, { timeout: 20000 })
  const v = await page.evaluate(expression)
  await page.close()
  return got ? v : { error: 'the archive never returned a result — nothing to show aliases for' }
}

// The "Found N posts matching …" banner and the "Includes: …" chip row, as rendered.
const readArchive = `(() => {
  const text = document.body.innerText ?? ''
  const found = (text.match(/Found\\s+([\\d,]+)\\s+posts matching/) ?? [])[1] ?? null
  const line = (text.split('\\n').map(s => s.trim()).find(l => /^Includes:/i.test(l))) ?? ''
  // The chips live one row below the "Includes:" label in the DOM, so read the whole block too.
  const block = [...document.querySelectorAll('div')]
    .map(d => (d.innerText ?? '').trim())
    .filter(t => /^Includes:/i.test(t))
    .sort((a, b) => a.length - b.length)[0] ?? line
  return JSON.stringify({ found, includes: block.replace(/\\s+/g, ' ').slice(0, 300) })
})()`

let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${got}`) }

console.log('\nPOST ARCHIVE ALIAS VISIBILITY — RENDERED PAGE\n')

for (const [term, expectAliases] of [
  ['covid-19', ['C19', 'COVID']],
  ['potus', ['Q+', 'trump']],
  // The owner ruling of 2026-08-14: one person, three spellings. Ray Chandler was a certified
  // entity of her own and RC was 13 unanswered rows in the Resolution Center.
  ['Rachel Chandler', ['Ray Chandler', 'RC']],
]) {
  const raw = await run(`${BASE}/posts?q=${encodeURIComponent(term)}`, readArchive)
  if (!raw || raw.error || raw.__error) { check(false, `${term} — page rendered`, raw?.error ?? raw?.__error ?? 'no response'); continue }
  const data = JSON.parse(raw)
  console.log(`\n  search "${term}" — found ${data.found ?? '?'} posts`)
  console.log(`    includes: ${data.includes || 'NO INCLUDES ROW'}`)
  check(Boolean(data.found), `${term} — the search returns posts`, `${data.found} posts`)
  check(Boolean(data.includes), `${term} — the archive shows an Includes row`, data.includes ? 'shown' : 'NO INCLUDES ROW')
  for (const a of expectAliases) {
    const hit = new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(data.includes)
    check(hit, `${term} — alias "${a}" is on the Includes row`, hit ? 'shown' : 'MISSING')
  }
}

await browser.close()
console.log(failed ? `\n  ${failed} check(s) FAILED\n` : '\n  the post archive shows the aliases tied to the searched term\n')
process.exit(failed ? 1 : 0)
