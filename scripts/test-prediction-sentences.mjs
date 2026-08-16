// The 2026-08-16 audit's visible result: a telegraphic prediction READS as its complete
// sentence, with Q's own wording still shown beside it and still driving the highlight.
//
// Checked in a browser because the failure mode this guards against is invisible server-side —
// posts.json can carry all 224 sentences while the panel renders the fragments it always did.
//
//   node scripts/test-prediction-sentences.mjs [baseUrl] [--fresh]
import { launch } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }
console.log(`\nPREDICTIONS READ AS COMPLETE SENTENCES  (${mode}${browser.reused ? ', reused' : ''})\n`)

// Returns '' — FALSY — until the row has actually rendered, so waitFor waits. An earlier
// version returned JSON for the missing case too: waitFor was satisfied on the first poll,
// every read came back empty, and the "is it withdrawn?" assertions passed against nothing.
const READ_ROW = `(() => {
  const row = document.querySelector('[data-analysis-section="predictions"]')
  if (!row) return ''
  const t = row.innerText.replace(/\\s+/g, ' ').trim()
  return t ? JSON.stringify({ text: t }) : ''
})()`

const CASES = [
  // P3 — fragment replaced by a sentence, Q's words kept alongside.
  { post: 1367, expect: 'Pain is coming.', qWording: 'Pain coming.' },
  { post: 3332, expect: 'A “boom” week lies ahead.', qWording: 'BOOM WEEK AHEAD.' },
  { post: 997, expect: 'The Pope will have a terrible May.', qWording: '[Pope] will be having a terrible May.' },
  // P5 — an addition the extractor had missed entirely.
  { post: 868, expect: 'They will fail.', qWording: 'Fail, they will.' },
  // P4 — arrived from Claims.
  { post: 1014, expect: 'Mark Zuckerberg will step down as chairman.', qWording: 'MZ to step down as Chairman.' },
]

for (const c of CASES) {
  const page = await browser.page(`${BASE}/post/${c.post}`)
  const raw = await page.waitFor(READ_ROW, { timeout: 60000 })
  await page.close()
  if (!raw) { check(false, `#${c.post} — Predictions row rendered`, 'row never rendered'); continue }
  const got = JSON.parse(raw)
  check(got.text.includes(c.expect), `#${c.post} shows the complete sentence`,
    got.text.includes(c.expect) ? 'shown' : got.text.slice(0, 110))
  check(got.text.includes(c.qWording), `#${c.post} still shows Q's wording`,
    got.text.includes(c.qWording) ? "Q's words kept" : 'Q WORDING MISSING')
}

// A withdrawn row must be gone from the panel entirely. #171 "Good will always defeat evil."
// was a published Prediction and is now held in the review backlog.
for (const [post, gone] of [[171, 'Good will always defeat evil.'], [2189, 'Fire at will.']]) {
  const page = await browser.page(`${BASE}/post/${post}`)
  const raw = await page.waitFor(READ_ROW, { timeout: 60000 })
  await page.close()
  // An empty read is NOT evidence of removal — assert the row rendered before believing it.
  if (!raw) { check(false, `#${post} — Predictions row rendered`, 'row never rendered'); continue }
  const text = JSON.parse(raw).text
  check(!text.includes(gone), `#${post} no longer lists "${gone.slice(0, 28)}…"`, text.includes(gone) ? 'STILL LISTED' : `withdrawn (row has ${text.length} chars)`)
}

await browser.close()
console.log(failed ? `\n  ${failed} check(s) FAILED\n` : '\n  the panel reads as sentences, and Q\'s wording is intact\n')
process.exit(failed ? 1 : 0)
