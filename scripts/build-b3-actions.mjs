// PHASE B3 — over-extended segmentation recoveries.
//
//   node scripts/build-b3-actions.mjs
//
// Writes audit/step3b1-b3-actions.jsonl.
//
// Three question records carry recoveredFromSegmentationError and a `literal` that swallowed the
// PASTED OR QUOTED material sitting beside Q's own line:
//
//   qf-23  #2971  a dictionary entry for "proof" + "PROOF = EVIDENCE?"
//   qf-33  #4454  a quoted paragraph about Antifa + "virus OR ELECTION?"
//   qf-1   #1318  a quoted DOJ non-comment + "What about the active investigation into leaks?"
//
// The repair narrows the literal to the sentence the record's own `text` already names. That is not
// a judgement call: `text` IS the question's identity, and in all three cases it exists in the drop
// as a complete sentence at an exact offset, verified against the body before this file is written.
//
// TWO OF THE THREE ALSO DISSOLVE A DUPLICATE KEY, which is why the A-DUP rows were held rather than
// merged. #2971 and #4454 each have a SECOND record over the same over-wide span — q-queue-2971-39
// and q-queue-4454-53, carrying provenance "owner ruling 2026-08-20 — unhighlighted-sentence
// queue". Those two are legitimate: the owner ruled the whole joined block should be covered. They
// are NOT touched. Narrowing the segmentation-recovered record is what stops the two colliding,
// and it destroys neither.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

const TARGETS = [
  { postNum: 2971, questionId: 'qf-23', intended: 'PROOF = EVIDENCE?' },
  { postNum: 4454, questionId: 'qf-33', intended: 'virus OR ELECTION?' },
  { postNum: 1318, questionId: 'qf-1', intended: 'What about the active investigation into leaks?' },
]

const actions = []
for (const t of TARGETS) {
  const q = questions.find(x => x.id === t.questionId)
  if (!q) { console.error(`[X] ${t.questionId} not found`); process.exit(1) }
  if (!q.recoveredFromSegmentationError) { console.error(`[X] ${t.questionId} is not a segmentation recovery`); process.exit(1) }
  if (q.text !== t.intended) { console.error(`[X] ${t.questionId}.text is ${JSON.stringify(q.text)}, not the intended literal`); process.exit(1) }

  const p = byNum.get(t.postNum)
  const body = runtimeText(p.text)
  const sentence = sentencesFor(p.text, t.postNum).find(s => s.text === t.intended)
  if (!sentence) { console.error(`[X] ${t.questionId}: ${JSON.stringify(t.intended)} is not a complete sentence on #${t.postNum}`); process.exit(1) }
  if (body.slice(sentence.start, sentence.end) !== t.intended) { console.error(`[X] ${t.questionId}: body does not match at ${sentence.start}..${sentence.end}`); process.exit(1) }

  // The span the over-extended literal currently occupies, so the action names the record it means.
  const hit = body.indexOf(q.literal.replace(/\r/g, ''))
  const oldStart = hit >= 0 ? hit : null
  const oldEnd = oldStart === null ? null : oldStart + q.literal.replace(/\r/g, '').length
  if (oldStart === null) { console.error(`[X] ${t.questionId}: its literal is not located in the body`); process.exit(1) }

  actions.push({
    actionId: `B3-NARROW-${t.postNum}-${t.questionId}`,
    kind: 'SPAN_TRIM',
    postNum: t.postNum, sentenceId: sentence.sentenceId,
    sentenceStart: sentence.start, sentenceEnd: sentence.end, sentenceText: sentence.text,
    sourceDisposition: 'q_authored',
    oldOccurrenceKeys: [`${t.postNum}|questions|${oldStart}|${oldEnd}`],
    oldCategories: [`questions@${oldStart}..${oldEnd}`],
    targetQuestionId: t.questionId,
    proposedPrimaryCategory: 'question',
    proposedSecondarySemantics: [], proposedReviewDispositions: [],
    recordsWithdrawn: [], withdrawReason: '',
    metadataTransferred: `${t.postNum}|questions|${oldStart}|${oldEnd}`,
    relationshipsPreserved: '', ruleCode: 'B3_NARROW_SEGMENTATION_RECOVERY',
    confidence: 'HIGH', humanReviewRequired: false,
    droppedLines: [body.slice(oldStart, sentence.start).trim().slice(0, 120)],
    adjudication: 'MODIFY_THEN_APPLY',
    adjudicationReason: `the segmentation recovery extended this question's literal backwards over pasted or quoted material. Narrowed to ${sentence.sentenceId}, which is the sentence the record's own text already names and which matches the body exactly. The co-located owner-ruling record is not touched.`,
  })
}

fs.writeFileSync(path.join(OUT, 'step3b1-b3-actions.jsonl'), actions.map(a => JSON.stringify(a)).join('\n') + '\n')
console.log(`-> audit/step3b1-b3-actions.jsonl   ${actions.length} actions`)
for (const a of actions)
  console.log(`   #${a.postNum} ${a.targetQuestionId}  ${a.oldOccurrenceKeys[0]}  ->  ${a.sentenceStart}..${a.sentenceEnd}  ${JSON.stringify(a.sentenceText)}`)
