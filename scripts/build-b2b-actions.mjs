// PHASE B2b — the collisions the B2 trims UNCOVERED.
//
//   node scripts/build-b2b-actions.mjs
//
// Writes audit/step3b1-b2b-actions.jsonl.
//
// A span that crosses a sentence boundary belongs to no sentence, so it cannot register as a
// same-sentence collision. Trim it back to the one prose sentence it covers and any collision that
// was always there becomes visible. Three did:
//
//   p1439-s003  "Who is missing from the scheduled meeting?"      claims + questions
//   p2180-s016  "What was the USSS codename for HUSSEIN?"         claims + questions
//   p3623-s012  "Re-read drops re: 'Foreign Aid'"                 claims + directives
//
// These are not new defects and they are not a reason to undo the trims — they are the same
// multi-primary shape the plan already adjudicated 117 of. So they are resolved the same way, by
// the same cascade, imported rather than paraphrased. Generated AFTER the trims are applied,
// because until then the spans they name do not exist.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor } from './lib/sentenceLedger.mjs'
import { classify } from './lib/shapeRules.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const dryrun = JSON.parse(fs.readFileSync(path.join(OUT, 'occurrence-ledger-dryrun.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

const KIND_OF = { claim: 'claims', question: 'questions', directive: 'directives', prediction: 'predictions' }
const SECONDARY_REASON = 'certified in this section before the 2026-08-21 ruling; retained as a non-painting secondary'

const collisions = (dryrun.multiPrimary ?? []).filter(m => !m.certifiedOverlap && !m.disjointClausePartition)
const actions = []

for (const m of collisions) {
  const sentence = sentencesFor(byNum.get(m.postNum).text, m.postNum).find(s => s.sentenceId === m.sentenceId)
  if (!sentence) { console.error(`[X] ${m.sentenceId}: sentence not found`); process.exit(1) }
  // Only a clean case qualifies: every competing span EXACTLY covers the sentence. A partial
  // overlap is a different problem and must not be swept in here.
  if (!m.spans.every(s => s.start === sentence.start && s.end === sentence.end)) {
    console.error(`[X] ${m.sentenceId}: spans are not all exact — not a clean multi-primary`); process.exit(1)
  }
  const verdict = classify(sentence.text, m.kinds)
  const winnerKind = KIND_OF[verdict.primary]
  if (!m.kinds.includes(winnerKind)) {
    console.error(`[X] ${m.sentenceId}: cascade returned ${verdict.primary}, which is not among ${m.kinds.join('+')}`)
    process.exit(1)
  }
  const losers = m.kinds.filter(k => k !== winnerKind)
  actions.push({
    actionId: `B2B-MP-${m.sentenceId}`,
    kind: 'MULTI_PRIMARY_RESOLUTION',
    postNum: m.postNum, sentenceId: m.sentenceId,
    sentenceStart: sentence.start, sentenceEnd: sentence.end, sentenceText: sentence.text,
    sourceDisposition: 'q_authored',
    oldOccurrenceKeys: m.spans.map(s => s.occurrenceKey),
    oldCategories: m.spans.map(s => `${s.kind}@${s.start}..${s.end}[EXACT]`),
    proposedPrimaryCategory: verdict.primary,
    proposedSecondarySemantics: losers.map(k => ({
      category: { claims: 'claim', questions: 'question', directives: 'directive', predictions: 'prediction' }[k],
      reason: SECONDARY_REASON,
    })),
    proposedReviewDispositions: [], recordsWithdrawn: [], withdrawReason: '',
    metadataTransferred: m.spans.map(s => s.occurrenceKey).join(' '),
    relationshipsPreserved: '', ruleCode: verdict.rule, confidence: 'HIGH',
    humanReviewRequired: false,
    adjudication: 'MODIFY_THEN_APPLY',
    adjudicationReason: `uncovered by the B2 trim: the crossing span belonged to no sentence, so this collision could not register before. Same shape as the 117 the plan adjudicated, resolved by the same cascade — ${verdict.primary}/${verdict.rule}.`,
  })
}

actions.sort((a, b) => a.actionId.localeCompare(b.actionId))
fs.writeFileSync(path.join(OUT, 'step3b1-b2b-actions.jsonl'), actions.map(a => JSON.stringify(a)).join('\n') + '\n')
console.log(`-> audit/step3b1-b2b-actions.jsonl   ${actions.length} actions`)
for (const a of actions)
  console.log(`   ${a.sentenceId}  ${a.oldCategories.map(c => c.split('@')[0]).join('+')}  ->  ${a.proposedPrimaryCategory}/${a.ruleCode}`)
