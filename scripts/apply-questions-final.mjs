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
// ── Owner rulings ───────────────────────────────────────────────────────────
// Merged before the gate so an owner question passes the same QA as every other row.
const QRULES = path.join(ROOT, 'audit/questions-owner-rulings.json')
let ownerQuestions = 0
// A ruling whose text the assembled set ALREADY holds is satisfied, not skipped. Counting only
// the pushes made the gate read 11 of 12 after the 2026-08-19 set, which looks like a dropped
// ruling and is not one. What has to be true is PRESENCE.
let ownerAlreadyPresent = 0
const ownerMissing = []
if (fs.existsSync(QRULES)) {
  for (const r of JSON.parse(fs.readFileSync(QRULES, 'utf8')).rulings ?? []) {
    if (rows.some(x => x.postNum === r.postNum && flat(x.text) === flat(r.text))) { ownerAlreadyPresent++; continue }
    const post = postByNum.get(r.postNum)
    rows.push({
      id: `q-owner-${r.postNum}-${ownerQuestions}`,
      postId: r.postId ?? String(r.postNum), postNum: r.postNum,
      text: r.text, occurrences: 1,
      status: 'unprocessed',
      source: 'owner ruling',
      provenance: `owner ruling ${r.ruledOn} — ${r.reasoning}`,
    })
    ownerQuestions++
  }
}

// ── The unhighlighted-sentence queue, ruled by the owner (2026-08-20) ────────
//
// 67 units the owner read as questions. Most of them do NOT end in "?" — "Don't you think POTUS
// would be tweeting about removal given clear conflict." is interrogative in form and terminated
// with a full stop, which is Q's habit throughout the archive. That is exactly the case
// certifiedQuestionRegex already handles: the highlighter matches a question where it ENDS A
// SENTENCE, on "?" or "." or "!", because requiring "?" once dropped 1,116 real questions.
// Invariant 5 is unaffected — it governs how a question MATCHES, not which terminator it carries.
//
// Occurrence-aware, like Claims and Directives: one queue row per unit.
const QUEUE = path.join(ROOT, 'audit/unhighlighted-owner-rulings.json')
const queueRulings = (fs.existsSync(QUEUE) ? JSON.parse(fs.readFileSync(QUEUE, 'utf8')).rulings ?? [] : [])
  .filter(r => r.section === 'questions')
const queueStats = { added: 0, already: 0 }
{
  const have = new Map()
  for (const x of rows) { const k = `${x.postNum}|${key(x.text)}`; have.set(k, (have.get(k) ?? 0) + 1) }
  const seenQ = new Map()
  for (const r of queueRulings) {
    const k = `${r.postNum}|${key(r.sourceText)}`
    const done = seenQ.get(k) ?? 0
    seenQ.set(k, done + 1)
    if (done < (have.get(k) ?? 0)) { queueStats.already++; continue }
    const post = postByNum.get(r.postNum)
    rows.push({
      id: `q-queue-${r.postNum}-${queueStats.added}`,
      postId: r.postId ?? post?.id ?? String(r.postNum),
      postNum: r.postNum,
      text: r.sourceText,
      occurrences: 1,
      unitText: r.sourceText,
      status: 'unprocessed',
      certified: true,
      source: 'owner ruling',
      // The segmenter splits at "Mr.", "Sen.", "vs.", "A." — so "Coincidence vs. HUBER start?" is
      // stored as two units and is a LINE rather than a unit. Same shape, and same allowance, as
      // recoveredFromSegmentationError below: being mis-segmented is precisely why the span had to
      // be reassembled, so requiring it to be a unit would reject the thing the join fixed.
      ...(r.joinedUnits || r.resolvedFromLine ? { spanFromJoinedUnits: true } : {}),
      provenance: `owner ruling ${r.ruledOn} — unhighlighted-sentence queue`,
    })
    queueStats.added++
  }
}

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
    : r.spanFromJoinedUnits
      ? (linesByPost.get(r.postNum) ?? []).some(l => flat(l).includes(flat(r.text)))
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
  // 6,443 + 11 owner rulings (2026-08-19): interrogative units certified in another section.
  // 6,454 + 65 from the unhighlighted-sentence queue (67 ruled, 2 occurrences already certified).
  ['certified occurrences = 6,519', counted.length === 6519, counted.length],
  ['queue rulings applied = 67', queueStats.added + queueStats.already === 67,
    `${queueStats.added} added + ${queueStats.already} already certified`],
  ['every owner question ruling is in the set = 12', ownerQuestions + ownerAlreadyPresent === 12 && ownerMissing.length === 0,
    `${ownerQuestions} added + ${ownerAlreadyPresent} already present`],
  ['all resolve to a source span', qa.missing.length === 0, `${qa.resolved}/${counted.length}`],
  ['every span is a unit or literal line', qa.notAUnit.length === 0, `${counted.length - qa.notAUnit.length}/${counted.length}`],
  // +10: eleven rulings, ten wordings new to Questions.
  // +58: 65 new occurrences carrying 58 wordings Questions did not already hold.
  ['distinct (canonical key) = 5,371', distinct.size === 5371, distinct.size],
  // +4: #1975, #2420, #2695 and #2776 had no certified question before these rulings.
  // +5 posts gain their first certified question.
  ['posts with questions = 1,705', postsWith.size === 1705, postsWith.size],
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
