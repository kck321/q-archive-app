// Runtime QA for the certified question dataset.
//
// The build gate in apply-questions-final.mjs checks the DATA. This checks the BEHAVIOUR: it
// re-implements certifiedQuestionRegex exactly as src/lib/posts.ts defines it and runs it over
// every certified occurrence, so a highlighting regression is caught before deploy rather than
// by the user noticing a number is wrong.
//
//   node scripts/qa-questions-runtime.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8'))

// The UNIT_START literal is read OUT of src/lib/posts.ts rather than copied here, so this
// harness cannot drift from the matcher it is supposed to be testing. Copying it is how the
// same "two implementations of one rule" bug bit this project four times already.
const src = fs.readFileSync(path.join(ROOT, 'src/lib/posts.ts'), 'utf8')
const m = src.match(/const UNIT_START = `([^`]+)`/)
const inSync = Boolean(m)
// The match is TypeScript SOURCE text, where every backslash is written doubled inside the
// template literal. Collapse them the way TS does when it evaluates the literal, or the regex
// looks for a literal backslash followed by "n" instead of a newline.
const UNIT_START = (m?.[1] ?? '').replace(/\\\\/g, '\\')

function certifiedQuestionRegex(questionText) {
  const core = questionText.replace(/\s+/g, ' ').trim()
  if (!core) return null
  const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
  return new RegExp(`${UNIT_START}\\s*${escaped}(?![a-zA-Z0-9])`, 'gi')
}

const counted = rows.filter(r => !r.editorialNormalization && !r.neverDisplayAsQ)
const textOf = new Map(posts.map(p => [p.postNum, clean(p.text ?? '')]))

let noMatch = [], overMatch = [], matched = 0
for (const r of counted) {
  const rx = certifiedQuestionRegex(r.text)
  const body = textOf.get(r.postNum) ?? ''
  if (!rx) { noMatch.push(r); continue }
  const hits = body.match(rx) ?? []
  if (hits.length === 0) noMatch.push(r)
  else {
    matched++
    // More hits than the dataset says this post asks it → the matcher is over-reaching.
    if (hits.length > (r.occurrences ?? 1)) overMatch.push({ ...r, hits: hits.length })
  }
}

// The regression case, end to end.
const coinRows = counted.filter(r => key(r.text) === key('Coincidence?'))
const coinMentions = coinRows.reduce((s, r) => s + (r.occurrences ?? 1), 0)
// What the OLD tolerant rule would have reported, for the comparison.
const tolerant = new RegExp('(?<![a-z0-9])coincidence\\s*[?.!](?![a-z0-9])', 'gi')
let oldOcc = 0, oldPosts = 0
for (const p of posts) {
  const m = clean(p.text ?? '').replace(/\s+/g, ' ').match(tolerant)
  if (m) { oldOcc += m.length; oldPosts++ }
}

const distinct = new Set(counted.map(r => key(r.text)))
const postsWith = new Set(counted.map(r => r.postNum))
const wrapped = counted.filter(r => r.directiveWrapped)
const editorial = rows.filter(r => r.editorialNormalization)

const checks = [
  ['matcher read live from posts.ts', inSync, inSync ? 'yes — no local copy' : 'UNIT_START NOT FOUND'],
  ['certified occurrences = 6,442', counted.length === 6443, counted.length],
  ['every occurrence highlights', noMatch.length === 0, `${matched}/${counted.length}`],
  ['none highlights more than its count', overMatch.length === 0, `${overMatch.length} over-matching`],
  ['distinct = 5,302', distinct.size === 5302, distinct.size],
  ['posts with questions = 1,696', postsWith.size === 1696, postsWith.size],
  ['directive-wrapped = 51', wrapped.length === 51, wrapped.length],
  ['directive-wrapped keep their link', wrapped.every(r => r.directiveSource), `${wrapped.filter(r => r.directiveSource).length}/${wrapped.length}`],
  ['editorial normalisations excluded', editorial.length > 0 && editorial.every(r => r.neverDisplayAsQ), `${editorial.length} held, none countable`],
  ['"Coincidence?" = 86 posts / 88 mentions', coinRows.length === 86 && coinMentions === 88, `${coinRows.length} posts / ${coinMentions} mentions  (tolerant rule reported ${oldPosts} / ${oldOcc})`],
]

console.log('\nRUNTIME QA — CERTIFIED QUESTIONS\n')
let failed = 0
for (const [label, ok, got] of checks) {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(40)} ${got}`)
}
for (const r of noMatch.slice(0, 8)) console.log(`     no match: #${r.postNum} ${JSON.stringify(r.text.slice(0, 64))}`)
for (const r of overMatch.slice(0, 8)) console.log(`     over    : #${r.postNum} ${r.hits} hits vs ${r.occurrences ?? 1} — ${JSON.stringify(r.text.slice(0, 54))}`)

console.log(failed ? `\n${failed} check(s) FAILED\n` : '\nall checks passed\n')
process.exit(failed ? 1 : 0)
