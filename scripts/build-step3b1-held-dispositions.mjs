// STEP 3B-1 — the ten held actions, adjudicated.
//
//   node scripts/build-step3b1-held-dispositions.mjs
//
// Writes audit/step3b1-held-dispositions.jsonl in the SAME action schema as the plan, so
// apply-step3b1.mjs executes it through the same gated code path rather than a second one. Each
// row here supersedes the plan row with the same actionId.
//
// WHY SIX OF THEM MOVE CATEGORY. The plan's generator calls classify(sentenceText, kinds). For
// six rows it was handed an EMPTY sentenceText, because the geometry lookup failed before the
// abbreviation/sentence-boundary repair (ba8ff32) landed. classify('') fails R1, R5, R2, R3 and
// R2B in turn and falls out of the bottom at R4_DECLARATIVE, whose only test is
// `kinds.includes('claims')`. So "R4_DECLARATIVE" on those rows is not a reading of the sentence —
// it is the absence of one. Given the sentence the ledger now measures, the same cascade (imported
// from lib/shapeRules.mjs, not paraphrased) returns question on five of them and prediction on the
// sixth. Nothing here broadens a rule; it runs the existing rule on text it was never shown.
//
// Every sentence text and offset below is READ FROM THE LEDGER, never transcribed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { classify } from './lib/shapeRules.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const plan = fs.readFileSync(path.join(OUT, 'step3b1-plan.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l))
const heldById = new Map(plan.filter(a => a.humanReviewRequired).map(a => [a.actionId, a]))

const sentenceOf = (postNum, sentenceId) =>
  sentencesFor(byNum.get(postNum).text, postNum).find(s => s.sentenceId === sentenceId)

const SECONDARY_CLAIM = {
  category: 'claim',
  reason: 'certified in this section before the 2026-08-21 ruling; retained as a non-painting secondary',
}

const out = []

// ── the five interrogatives ─────────────────────────────────────────────────────────────────
// Identical shape to the seven R1_INTERROGATIVE claims+questions rows already applied in fbb5a51:
// question takes the paint, the claim is retained as a non-painting secondary.
for (const [actionId, sentenceId, postNum] of [
  ['A-MP-p1944-s014', 'p1944-s014', 1944],
  ['A-MP-p2072-s013', 'p2072-s013', 2072],
  ['A-MP-p2211-s041', 'p2211-s041', 2211],
  ['A-MP-p2369-s003', 'p2369-s003', 2369],
  ['A-MP-p2378-s001', 'p2378-s001', 2378],
]) {
  const h = heldById.get(actionId)
  const s = sentenceOf(postNum, sentenceId)
  const verdict = classify(s.text, ['claims', 'questions'])
  if (verdict.primary !== 'question') throw new Error(`${actionId}: cascade returned ${verdict.primary}, not question`)
  out.push({
    ...h,
    sentenceStart: s.start, sentenceEnd: s.end, sentenceText: s.text,
    proposedPrimaryCategory: 'question',
    proposedSecondarySemantics: [SECONDARY_CLAIM],
    ruleCode: verdict.rule,
    humanReviewRequired: false,
    adjudication: 'MODIFY_THEN_APPLY',
    adjudicationReason: `held for REPAIR_GEOMETRY; the ledger now measures ${sentenceId} at ${s.start}..${s.end} and the shape cascade, re-run on that text, returns ${verdict.primary}/${verdict.rule}. The plan's R4_DECLARATIVE was classify('') falling through, not a reading of the sentence.`,
    supersedesPlanRow: { ruleCode: h.ruleCode, proposedPrimaryCategory: h.proposedPrimaryCategory },
  })
}

// ── #34 — NOT resolved, and the reason is not geometry ──────────────────────────────────────
{
  const h = heldById.get('A-MP-p0034-s002')
  const s = sentenceOf(34, 'p0034-s002')
  const verdict = classify(s.text, ['claims', 'predictions'])
  out.push({
    ...h,
    sentenceStart: s.start, sentenceEnd: s.end, sentenceText: s.text,
    humanReviewRequired: true,
    adjudication: 'HUMAN_SEMANTIC_REVIEW',
    adjudicationReason: `Geometry is now known (${s.start}..${s.end}) and the cascade returns ${verdict.primary}/${verdict.rule} on the word "shall". But the sentence asserts a COMPLETED act ("we have initiated certain fail-safes") and forecasts a future one ("slated to occur 11.3"), and this is the single claims+predictions row DECISION 1 of the Step 3 review pack put to the owner and never got an answer on. A keyword deciding the famous #34 is not an adjudication. Owner ruling required.`,
    cascadeWouldSay: verdict,
  })
}

// ── #1928 — the owner already ruled this one ────────────────────────────────────────────────
// "URL must remain a link; only `Who is [1 of 4] FIREWALLS?` should receive Question paint."
// The drop runs the URL straight into the question with no separator, so the sentence splitter
// cannot see a boundary and the whole 439..513 run is one ledger sentence. The paint therefore
// targets a SUB-SENTENCE span, declared explicitly rather than derived.
{
  const h = heldById.get('A-MP-p1928-s012')
  const p = byNum.get(1928)
  const [qStart, qEnd] = occurrencesOfSpan(p.text, 'Who is [1 of 4] FIREWALLS?')[0]
  const [uStart, uEnd] = occurrencesOfSpan(p.text, 'https://vault.fbi.gov/d1-release/d1-release/view')[0]
  if (uEnd !== qStart) throw new Error(`#1928: URL ends at ${uEnd} but the question starts at ${qStart}`)
  out.push({
    ...h,
    sentenceStart: qStart, sentenceEnd: qEnd,
    sentenceText: runtimeText(p.text).slice(qStart, qEnd),
    spanOverride: true,
    spanOverrideReason: `the ledger sentence p1928-s012 is ${uStart}..${qEnd}, because the drop writes "…/view" and "Who is" with no separator. Painting the whole sentence would paint the URL.`,
    proposedPrimaryCategory: 'question',
    // NOT retained as a secondary. The claim span began inside the URL; a claim that starts
    // mid-hyperlink is a segmentation artefact, not a second speech act this sentence performs.
    proposedSecondarySemantics: [],
    withdrawReason: 'the claim span 439..513 opens inside a URL; the URL is a link, not a semantic unit, and only the question is painted',
    ruleCode: 'OWNER_RULING_URL_QUESTION_SPLIT',
    humanReviewRequired: false,
    adjudication: 'MODIFY_THEN_APPLY',
    adjudicationReason: 'the owner ruled this row directly in the finalisation handoff: keep the URL a link, paint only the question.',
    intentionallyUncategorized: [{ start: uStart, end: uEnd, reason: 'URL — a link, not a semantic unit (owner ruling)' }],
  })
}

// ── #3071 — ownership unproved, so it stays Q's; but it may not ship truncated ──────────────
{
  const h = heldById.get('A-SB-3071')
  const s = sentenceOf(3071, 'p3071-s007')
  out.push({
    ...h,
    kind: 'MULTI_PRIMARY_RESOLUTION',   // a widen, not a withdrawal — nothing leaves q_authored
    sentenceStart: s.start, sentenceEnd: s.end, sentenceText: s.text,
    proposedPrimaryCategory: 'claim',
    proposedSecondarySemantics: [],
    sourceDisposition: 'q_authored',
    ruleCode: 'R7_SOURCE_OWNERSHIP_UNPROVED',
    humanReviewRequired: false,
    adjudication: 'MODIFY_THEN_APPLY',
    adjudicationReason: `the hold was about SOURCE OWNERSHIP and that hold is upheld — a leading ">" alone does not prove quotation, so this stays q_authored and no count moves between dispositions. But the record is certified over ${h.sentenceStart}..${h.sentenceEnd} (">DENY PROPER COUNTING U.S.") while the sentence runs ${s.start}..${s.end}: the abbreviation "U.S." cut it. Shipping a knowingly truncated highlight breaks the full-sentence rule, so the span is completed in place. Source ownership remains open and unchanged.`,
    stillOpen: 'source ownership of #3071 — unchanged, still needs provenance evidence',
  })
}

// ── the two duplicate rows — deferred to the conflict-queue families on purpose ──────────────
for (const [actionId, postNum, keepId, keepText] of [
  ['A-DUP-2971-questions-561-799', 2971, 'qf-23', 'PROOF = EVIDENCE?'],
  ['A-DUP-4454-questions-238-404', 4454, 'qf-33', 'virus OR ELECTION?'],
]) {
  const h = heldById.get(actionId)
  out.push({
    ...h,
    humanReviewRequired: true,
    adjudication: 'MOVE_TO_CONFLICT_REVIEW',
    adjudicationReason: `not a benign duplicate. Two DIFFERENT question identities point at the same over-wide literal: "${keepId}" carries recoveredFromSegmentationError:true and its literal swallows a pasted block plus Q's own line, while "q-queue-${postNum}-*" carries provenance "owner ruling 2026-08-20 — unhighlighted-sentence queue" and its identity IS the whole joined block. Merging them would destroy one of two legitimate records. The deterministic repair is to narrow the segmentation-recovered literal to ${JSON.stringify(keepText)}, which dissolves the duplicate key AND one boundary crossing at once — but that is the BOUNDARY_CROSSING/over-extended-literal family, and it should be applied with its family in the Phase B batch rather than as a one-off here.`,
    proposedRepair: { narrowLiteralOf: keepId, toSentenceText: keepText },
  })
}

const ORDER = ['A-DUP-2971-questions-561-799', 'A-DUP-4454-questions-238-404', 'A-MP-p0034-s002',
  'A-MP-p1928-s012', 'A-MP-p1944-s014', 'A-MP-p2072-s013', 'A-MP-p2211-s041', 'A-MP-p2369-s003',
  'A-MP-p2378-s001', 'A-SB-3071']
out.sort((a, b) => ORDER.indexOf(a.actionId) - ORDER.indexOf(b.actionId))
if (out.length !== 10) throw new Error(`expected 10 dispositions, built ${out.length}`)
if (new Set(out.map(o => o.actionId)).size !== 10) throw new Error('duplicate actionId in dispositions')

fs.writeFileSync(path.join(OUT, 'step3b1-held-dispositions.jsonl'), out.map(o => JSON.stringify(o)).join('\n') + '\n')
const tally = {}
for (const o of out) tally[o.adjudication] = (tally[o.adjudication] ?? 0) + 1
console.log('-> audit/step3b1-held-dispositions.jsonl')
for (const [k, v] of Object.entries(tally)) console.log(`   ${k}: ${v}`)
console.log(`   applying now: ${out.filter(o => !o.humanReviewRequired).length}   still held: ${out.filter(o => o.humanReviewRequired).length}`)
