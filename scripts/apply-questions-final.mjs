// Apply the FINAL certified question dataset to production: 6,442 occurrences.
//
//   6,299  already live (audit/questions-final.json, applied earlier)
//   + 139  counted units from the uncovered-"?" passes
//            51  Q_DIRECTIVE_WITH_EMBEDDED_QUESTION — the embedded span counts
//            88  Q_QUESTION
//   +   4  question spans recovered from inside segmentation errors
//   = 6,442
//
// Each row is ONE certified occurrence carrying the exact Q source span, including its actual
// terminal punctuation. Two extra fields make the certified matcher exact:
//
//   occurrences   how many times this post asks it, from the SAME unitsFor() segmentation the
//                 audit used. "Coincidence?" is asked twice in #1176 and #1266.
//   unitText      the full Q-authored unit the span came from. For a directive-wrapped
//                 question the unit is "Ask yourself, why are they panicking?" while the
//                 counted span is "why are they panicking?" — the Directive relationship is
//                 retained rather than thrown away.
//
// Existing id/status/createdAt/infographId are preserved wherever the text still qualifies.
// Idempotent: rebuilds from the audit artifacts each run.
//
//   node scripts/apply-questions-final.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const existing = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const ctxFinal = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/questions-context-final.json'), 'utf8'))

const postByNum = new Map(posts.map(p => [p.postNum, p]))
const flat = t => clean(t).replace(/\s+/g, ' ').trim()

// Q-authored units per post, from the audit's own segmentation.
const unitsByPost = new Map()
for (const p of posts) unitsByPost.set(p.postNum, unitsFor(p.text ?? '').map(u => u.text.trim()))

/** How many Q-authored units in this post are this question. */
function occurrencesOf(postNum, text) {
  const k = key(text)
  const n = (unitsByPost.get(postNum) ?? []).filter(u => key(u) === k).length
  return Math.max(1, n)
}
/** The full Q-authored unit a span came from, when the span is only part of one. */
function unitContaining(postNum, span) {
  const f = flat(span)
  return (unitsByPost.get(postNum) ?? []).find(u => flat(u) === f)
    ?? (unitsByPost.get(postNum) ?? []).find(u => flat(u).includes(f))
    ?? null
}

const priorByKey = new Map()
for (const q of existing) {
  const k = `${q.postId}|${key(q.text)}`
  if (!priorByKey.has(k)) priorByKey.set(k, q)
}
let nextId = 0
const mkId = () => `qf-${(++nextId).toString(36)}`

const rows = []
const seen = new Set()
const stats = { carried: 0, addedQuestion: 0, addedWrapped: 0, addedRecovered: 0, editorial: 0, dupSkipped: 0 }

function push(r) {
  const dedupe = `${r.postNum}|${key(r.text)}`
  if (seen.has(dedupe)) { stats.dupSkipped++; return }
  seen.add(dedupe)
  rows.push(r)
}

// ── 1. everything already certified and live ────────────────────────────────
for (const q of existing) {
  if (q.editorialNormalization) { stats.editorial++; rows.push(q); continue }
  stats.carried++
  push({
    ...q,
    occurrences: occurrencesOf(q.postNum, q.text),
    unitText: unitContaining(q.postNum, q.text) ?? q.text,
    certified: true,
  })
}

// ── 2. the uncovered-"?" passes ─────────────────────────────────────────────
for (const f of ctxFinal.finals) {
  const post = postByNum.get(f.postNum)
  if (!post) continue

  if (f.finalCounts) {
    const span = (f.embeddedQuestion ?? f.qSourceText).trim()
    const wrapped = f.finalClass === 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION'
    wrapped ? stats.addedWrapped++ : stats.addedQuestion++
    const prior = priorByKey.get(`${post.id}|${key(span)}`)
    push({
      id: prior?.id ?? mkId(),
      text: span,
      status: prior?.status ?? 'unprocessed',
      postId: post.id,
      postNum: post.postNum,
      createdAt: prior?.createdAt ?? Date.parse('2026-08-12T00:00:00Z'),
      infographId: prior?.infographId ?? null,
      certified: true,
      occurrences: occurrencesOf(post.postNum, wrapped ? f.qSourceText : span),
      unitText: f.qSourceText,
      // The Directive relationship is retained, not discarded.
      ...(wrapped ? { directiveWrapped: true, directiveFamily: 'cognition', directiveSource: f.qSourceText } : {}),
    })
  }

  if (f.recoveredCounts && f.recoveredQuestion) {
    stats.addedRecovered++
    const prior = priorByKey.get(`${post.id}|${key(f.recoveredQuestion)}`)
    push({
      id: prior?.id ?? mkId(),
      text: f.recoveredQuestion,
      status: prior?.status ?? 'unprocessed',
      postId: post.id,
      postNum: post.postNum,
      createdAt: prior?.createdAt ?? Date.parse('2026-08-12T00:00:00Z'),
      infographId: prior?.infographId ?? null,
      certified: true,
      occurrences: occurrencesOf(post.postNum, f.recoveredQuestion),
      unitText: f.recoveredQuestion,
      recoveredFromSegmentationError: true,
    })
  }
}

// ── QA gate ─────────────────────────────────────────────────────────────────
const counted = rows.filter(r => !r.editorialNormalization)
const bodyOf = new Map(posts.map(p => [p.postNum, flat(p.text ?? '')]))
const linesByPost = new Map(posts.map(p => [p.postNum, clean(p.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)]))
const qa = { resolved: 0, missing: [], notAUnit: [] }
for (const r of counted) {
  if (bodyOf.get(r.postNum)?.includes(flat(r.text))) qa.resolved++
  else qa.missing.push(r)
  // The span must be a complete Q-authored unit, or part of one — never a stray substring.
  //
  // Recovered spans are held to a LINE check instead. #144's
  // "Why was Sarah A. C. attacked (hack-attempt)?" is a real line that unitsFor() splits on
  // the lone initial "A." — being mis-segmented is precisely why it needed recovering, so
  // requiring it to be a unit would reject the very thing the recovery fixed.
  const ok = r.recoveredFromSegmentationError
    ? (linesByPost.get(r.postNum) ?? []).includes(r.text)
    : Boolean(unitContaining(r.postNum, r.text))
  if (!ok) qa.notAUnit.push(r)
}
const distinct = new Set(counted.map(r => key(r.text)))
const postsWith = new Set(counted.map(r => r.postNum))
const wrapped = counted.filter(r => r.directiveWrapped)
const editorialLeaks = counted.filter(r => r.editorialNormalization || r.neverDisplayAsQ)
const totalMentions = counted.reduce((s, r) => s + (r.occurrences ?? 1), 0)

const coin = counted.filter(r => key(r.text) === key('Coincidence?'))
const coinMentions = coin.reduce((s, r) => s + r.occurrences, 0)

const checks = [
  ['certified occurrences = 6,442', counted.length === 6442, counted.length],
  ['all resolve to a source span', qa.missing.length === 0, `${qa.resolved}/${counted.length}`],
  ['every span is a unit or literal line', qa.notAUnit.length === 0, `${counted.length - qa.notAUnit.length}/${counted.length}`],
  ['distinct (canonical key) = 5,302', distinct.size === 5302, distinct.size],
  ['posts with questions = 1,696', postsWith.size === 1696, postsWith.size],
  ['directive-wrapped = 51, all counted', wrapped.length === 51, wrapped.length],
  ['no editorial normalisation counted', editorialLeaks.length === 0, editorialLeaks.length],
  ['"Coincidence?" = 86 posts / 88 mentions', coin.length === 86 && coinMentions === 88, `${coin.length} posts / ${coinMentions} mentions`],
]

console.log('\nAPPLY FINAL CERTIFIED QUESTIONS\n')
console.log(`  carried from the live set : ${stats.carried.toLocaleString()}`)
console.log(`  + plain questions         : ${stats.addedQuestion}`)
console.log(`  + directive-wrapped spans : ${stats.addedWrapped}`)
console.log(`  + recovered from segfaults: ${stats.addedRecovered}`)
console.log(`  duplicates skipped        : ${stats.dupSkipped}`)
console.log(`  editorial normalisations  : ${stats.editorial} (searchable, never shown as Q)`)
console.log(`  total rows written        : ${rows.length.toLocaleString()}`)
console.log(`\n  certified occurrences     : ${counted.length.toLocaleString()}`)
console.log(`  in-post repeats           : ${(totalMentions - counted.length).toLocaleString()} (mentions ${totalMentions.toLocaleString()})`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) {
  if (!ok) failed++
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(42)} ${got}`)
}
for (const m of qa.missing.slice(0, 5)) console.log(`      unresolved: #${m.postNum} ${JSON.stringify(m.text.slice(0, 60))}`)
for (const m of qa.notAUnit.slice(0, 5)) console.log(`      not a unit: #${m.postNum} ${JSON.stringify(m.text.slice(0, 60))}`)

if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: questions.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'questions.json'), JSON.stringify(rows))
console.log(`\nwrote public/data/questions.json (${(fs.statSync(path.join(DATA, 'questions.json')).size / 1048576).toFixed(1)} MB)\n`)
