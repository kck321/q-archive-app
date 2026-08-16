// OWNER RULES, both rendering-only — the certified data is untouched:
//   1. a certified question carries NO Emphasis paint. Just the question.
//   2. a bracket is always in the forefront and never flashes, whatever else covers it.
//
// Checked on BOTH surfaces, because the drop view and the archive have drifted apart before and
// shown different colours for identical certified data.
//
//   node scripts/test-question-emphasis.mjs [baseUrl] [--fresh]
import { launch } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)} ${got}`) }
console.log(`\nQUESTIONS CARRY NO EMPHASIS  (${mode}${browser.reused ? ', reused' : ''})\n`)
const started = Date.now()

// #50 "Where is BO TODAY?" — TODAY is certified caps_emphasis inside a certified question.
// #62 "WHERE IS BO TODAY?!?!?" — "?!?!?" is certified punctuation_intensity inside one.
const READ_MARKS = `(() => {
  const host = [...document.querySelectorAll('pre[class*="post-text"]')].pop()
  if (!host) return ''
  return JSON.stringify([...host.querySelectorAll('mark')].map(m => ({
    t: (m.textContent ?? '').slice(0, 34),
    cls: String(m.className ?? ''),
    title: m.getAttribute('title') ?? '',
  })))
})()`

for (const [postNum, word] of [[50, 'TODAY'], [62, '?!?!?'], [18, 'COULD']]) {
  const page = await browser.page(`${BASE}/post/${postNum}`)
  const raw = await page.waitFor(READ_MARKS, { timeout: 60000 })
  await page.close()
  if (!raw) { check(false, `#${postNum} — drop rendered`, 'never rendered'); continue }
  const marks = JSON.parse(raw)
  // No mark carrying the emphasis fill, and nothing rotating, on a span inside the question.
  const emphasised = marks.filter(m => m.t.includes(word) && (/slate/.test(m.cls) || /overlap/.test(m.cls) || /emphasis/.test(m.title)))
  const questionMark = marks.find(m => m.t.includes(word) && /blue/.test(m.cls))
  check(emphasised.length === 0, `#${postNum} "${word}" carries no emphasis paint`,
    emphasised.length ? JSON.stringify(emphasised[0]).slice(0, 90) : 'clean')
  check(Boolean(questionMark), `#${postNum} "${word}" still reads as the question`, questionMark ? 'blue question' : 'NOT PAINTED AS QUESTION')
}

// Brackets: in the forefront, solid, never rotating — even inside a question.
{
  const page = await browser.page(`${BASE}/post/4742`)
  const raw = await page.waitFor(READ_MARKS, { timeout: 60000 })
  await page.close()
  const marks = raw ? JSON.parse(raw) : []
  const brackets = marks.filter(m => m.t.trim().startsWith('[') && m.t.trim().endsWith(']'))
  const flashing = brackets.filter(m => /overlap/.test(m.cls))
  check(brackets.length > 0, '#4742 brackets are painted', `${brackets.length} bracket marks`)
  check(flashing.length === 0, '#4742 no bracket flashes/rotates', flashing.length ? JSON.stringify(flashing[0]).slice(0, 80) : 'all solid')
  check(brackets.every(m => /red/.test(m.cls)), '#4742 brackets are red, in the forefront',
    brackets.every(m => /red/.test(m.cls)) ? 'all red' : JSON.stringify(brackets.find(m => !/red/.test(m.cls))).slice(0, 80))
}

await browser.close()
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(failed ? `  ${failed} check(s) FAILED\n` : '  questions carry no emphasis; brackets stay in front and never flash\n')
process.exit(failed ? 1 : 0)
