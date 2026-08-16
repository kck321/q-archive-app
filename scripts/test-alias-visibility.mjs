// Prove that searching a term SHOWS the aliases tied to it — in a browser, on the rendered page.
//
// OWNER RULE: "I want the searched term to always show the aliases tied to the search term…
// let's make all aliases visible."
//
// There were two alias registries and only one was wired to the archive: the eight owner-typed
// groups in aliases.json (which is why POTUS folded Q+/Trump/45 together and colour-coded its post
// chips), and the CERTIFIED entity aliases in entities.json, which nothing in the app read. So
// COVID-19 — carrying certified aliases C19 and COVID — showed none of them.
//
// Counts prove nothing here. What matters is the row a reader gets when they type the term.
//
//   node scripts/test-alias-visibility.mjs [baseUrl] [--fresh]
//     default        warm browser — for iterating
//     --fresh        brand-new profile — part of the pre-deploy proof
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, ROWS_READY } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }

console.log(`\nALIAS VISIBILITY — RENDERED PAGE  (${mode}${browser.reused ? ', reused' : ''})\n`)
const started = Date.now()

// Reads the "across the archive" bar: the line that literally says "incl. aliases: …".
const READ_BAR = `(() => {
  const cards = [...document.querySelectorAll('div.bg-q-panel')]
  const lines = (cards[0]?.innerText ?? '').split('\\n').map(s => s.trim()).filter(Boolean)
  return JSON.stringify({ rowCount: cards.length, lines: lines.slice(0, 6) })
})()`

for (const [term, expectAliases] of [['COVID-19', ['c19', 'covid']], ['POTUS', ['q+']]]) {
  const page = await browser.page(`${BASE}/analysis?tab=namedEntities&q=${encodeURIComponent(term)}`)
  // By condition, not by clock: a fixed sleep is both slower than a warm load and still able to
  // race a cold one, which is how three assertions once failed against a page that was correct.
  const ready = await page.waitFor(ROWS_READY, { timeout: 60000 })
  const raw = ready ? await page.evaluate(READ_BAR) : null
  await page.close()
  if (!raw || raw.__error) { check(false, `${term} — page rendered`, raw?.__error ?? 'never became ready'); continue }
  const data = JSON.parse(raw)
  const aliasLine = (data.lines ?? []).find(l => l.toLowerCase().includes('incl. aliases:')) ?? ''
  console.log(`\n  search "${term}" — ${data.rowCount} row(s)`)
  check(data.rowCount > 0, `${term} — the search returns a row`, `${data.rowCount} rows`)
  check(Boolean(aliasLine), `${term} — the search shows an alias line`, aliasLine || 'NO ALIAS LINE')
  for (const a of expectAliases) {
    // Substring, deliberately: a regex written here passes through a template literal on its way
    // to the page, where \d arrives as a literal "d" and the assertion fails on correct output.
    const hit = aliasLine.toLowerCase().includes(a)
    check(hit, `${term} — alias "${a}" is on the alias line`, hit ? 'shown' : 'MISSING')
  }
}

await browser.close()
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(failed ? `  ${failed} check(s) FAILED\n` : '  every searched term shows the aliases tied to it\n')
process.exit(failed ? 1 : 0)
