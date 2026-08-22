// PHASE B2 — boundary-crossing repairs, as actions in the Step 3B-1 schema.
//
//   node scripts/build-b2-actions.mjs
//
// Writes audit/step3b1-b2c-actions.jsonl. apply-step3b1.mjs executes these through the SAME code
// path and the same gates as the plan itself — a second applier would mean a second set of gates,
// and the gates are the only reason any of this is trustworthy.
//
// THE OWNER'S RULING IS THE WHOLE BASIS: "A raw URL is NOT claim/question/directive/prediction
// paint merely for geometric coverage. Classify Q-authored prose around it correctly and allow the
// URL itself to remain non-semantic where appropriate."
//
// Two deterministic shapes follow from it, and one that does not:
//
//   SPAN_TRIM         the span covers ONE prose sentence plus adjacent link/label lines. Trim to
//                     the prose. The category is untouched; only the geometry moves.
//   WITHDRAW_RECORD   the span covers NOTHING BUT link or label lines. There is no prose to trim
//                     to, so the record is withdrawn — a Claim whose entire span is a URL is not a
//                     claim, it is a citation that was mis-certified.
//   (refused)         the span covers two or more genuine prose sentences. Splitting it is a
//                     semantic judgement about what Q meant, so it stays for a person.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const analysis = JSON.parse(fs.readFileSync(path.join(OUT, 'step3b1-b2-analysis.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

const PRIMARY_OF = { claims: 'claim', questions: 'question', directives: 'directive', predictions: 'prediction' }
const actions = []

for (const r of analysis.rows) {
  const body = runtimeText(byNum.get(r.postNum)?.text ?? '')
  const common = {
    postNum: r.postNum, sentenceId: null,
    sourceDisposition: 'q_authored',
    oldOccurrenceKeys: [r.heldKey],
    oldCategories: [`${r.kind}@${r.start}..${r.end}`],
    proposedSecondarySemantics: [], proposedReviewDispositions: [],
    recordsWithdrawn: [], withdrawReason: '',
    metadataTransferred: r.heldKey, relationshipsPreserved: '',
    confidence: 'HIGH', humanReviewRequired: false,
  }

  if (r.shape === 'TRIM_TO_ONE_SENTENCE') {
    const { start, end } = r.proposedSpan
    const text = body.slice(start, end)
    if (!text.trim()) continue
    actions.push({
      ...common,
      actionId: `B2C-TRIM-${r.postNum}-${r.kind}-${r.start}-${r.end}`,
      kind: 'SPAN_TRIM',
      sentenceStart: start, sentenceEnd: end, sentenceText: text,
      proposedPrimaryCategory: PRIMARY_OF[r.kind] ?? null,
      ruleCode: 'B2_TRIM_TO_PROSE_SENTENCE',
      droppedLines: r.droppedText,
      adjudication: 'MODIFY_THEN_APPLY',
      adjudicationReason: `the certified span crossed a sentence boundary only because it swallowed ${r.nonSemanticSentences} non-semantic line(s) — links, board pointers or bracketed labels. Trimmed to the one prose sentence it actually covers; the category is unchanged.`,
    })
    continue
  }

  if (r.shape === 'ENTIRELY_NON_SEMANTIC' || r.shape === 'NO_SENTENCE_TOUCHED') {
    actions.push({
      ...common,
      actionId: `B2C-DROP-${r.postNum}-${r.kind}-${r.start}-${r.end}`,
      kind: 'WITHDRAW_RECORD',
      sentenceStart: r.start, sentenceEnd: r.end, sentenceText: body.slice(r.start, r.end),
      proposedPrimaryCategory: null,
      recordsWithdrawn: [r.heldKey],
      ruleCode: r.shape === 'NO_SENTENCE_TOUCHED' ? 'B2_NUMERIC_NOISE' : 'B2_SPAN_IS_ONLY_A_LINK',
      withdrawReason: r.shape === 'NO_SENTENCE_TOUCHED'
        ? 'the span covers a bare digit run the sentence ledger does not treat as prose'
        : 'every line the span covers is a URL, a board pointer or a bracketed label; there is no prose to certify',
      adjudication: 'MODIFY_THEN_APPLY',
      adjudicationReason: 'owner ruling: a raw URL is not claim/question/directive/prediction paint. With no prose in the span there is nothing to trim to, so the record is withdrawn rather than re-spanned.',
    })
  }
  // GENUINE_MULTI_SENTENCE is deliberately absent: splitting a span across two prose sentences is
  // a judgement about meaning, not geometry.
}

actions.sort((a, b) => a.actionId.localeCompare(b.actionId))
fs.writeFileSync(path.join(OUT, 'step3b1-b2c-actions.jsonl'), actions.map(a => JSON.stringify(a)).join('\n') + '\n')

const tally = {}
for (const a of actions) tally[`${a.kind} / ${a.ruleCode}`] = (tally[`${a.kind} / ${a.ruleCode}`] ?? 0) + 1
console.log(`-> audit/step3b1-b2c-actions.jsonl   ${actions.length} actions`)
for (const [k, v] of Object.entries(tally)) console.log(`   ${String(v).padStart(4)}  ${k}`)
console.log(`   refused (multi-sentence prose, human lane): ${analysis.rows.filter(r => r.shape === 'GENUINE_MULTI_SENTENCE').length}`)
