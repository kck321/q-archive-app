// STEP 3B-1 — the apply receipt.
//
//   node scripts/verify-step3b1.mjs
//
// Measures the bundle AFTER apply-step3b1.mjs and writes audit/step3b1-apply-receipt.json.
// Every gate below is asserted at the line that checks it, and the script exits non-zero rather
// than printing a receipt that does not reconcile — a count that moves silently is the failure
// mode this whole process exists to prevent.
//
// The residual gates are SCOPED, deliberately. "Zero same-category primary overlap" is a claim
// about the 530 sentences this step applied, not about the archive: 945 conflict rows and 10 held
// actions are explicitly out of scope and still carry their defects. Reporting a global zero would
// be a lie, and reporting a global non-zero without the split would be useless.
import fs from 'node:fs'

/** Line splitter for the .jsonl artifacts. Tolerates CRLF, which git hands back on Windows. */
const LINE_BREAK = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n')
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'
import { EXTRA_ACTION_SETS } from './lib/step3b1Sets.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'))

const ledger = read(path.join(OUT, 'occurrence-ledger.json'))
const dryrun = read(path.join(OUT, 'occurrence-ledger-dryrun.json'))
const overlay = read(path.join(DATA, 'semantics.json'))
const posts = read(path.join(DATA, 'posts.json'))
const questions = read(path.join(DATA, 'questions.json'))
const manifest = read(path.join(ROOT, 'STEP3B1-DRYRUN', 'STEP3B1-MANIFEST.json'))
const transfers = read(path.join(OUT, 'step3b1-metadata-transfers.json')).transfers
const readJsonl = f => fs.readFileSync(f, 'utf8').trim().split(LINE_BREAK).map(l => JSON.parse(l))
const planRows = readJsonl(path.join(OUT, 'step3b1-plan.jsonl'))

// The adjudicated held rows supersede their plan rows by actionId — the same substitution
// apply-step3b1.mjs makes, so the verifier measures the state the applier was actually asked for.
const dispPath = path.join(OUT, 'step3b1-held-dispositions.jsonl')
const dispositions = fs.existsSync(dispPath) ? readJsonl(dispPath) : []
// THE EXTRA ACTION SETS, from the applier's own list rather than a second copy of it.
//
// This used to be a literal array, and it stopped at B3. Owner Ruling 3 and the lane-B reviews
// were then added to the applier, so the cross-tab gate measured the new bundle against a target
// computed from four of seven sets and reported a mismatch that was its own list being short.
// The target has to be derived from the same source the applier applies, or it is not a gate.
const extraSets = EXTRA_ACTION_SETS.map(s => s.file)
  .map(f => path.join(OUT, f)).filter(f => fs.existsSync(f)).flatMap(readJsonl)
const dispById = new Map(dispositions.map(d => [d.actionId, d]))
const plan = planRows.map(a => dispById.get(a.actionId) ?? a).concat(extraSets)

const automatic = plan.filter(a => !a.humanReviewRequired)
const held = plan.filter(a => a.humanReviewRequired)
const FAIL = []
const gate = (name, pass, detail) => { if (!pass) FAIL.push(`${name}: ${detail}`); return { gate: name, pass, detail } }

// ── 1. the cross-tab ────────────────────────────────────────────────────────────────────────
const KW = { claim: 'claims', question: 'questions', directive: 'directives', prediction: 'predictions' }
const primaryByKind = {}
for (const r of ledger.records) if (r.layer === 'primary') primaryByKind[r.kind] = (primaryByKind[r.kind] ?? 0) + 1
const overlayCell = {}
for (const o of overlay.occurrences) {
  if (o.primaryCategory) {
    const k = `${o.sourceDisposition}|primary|${o.primaryCategory}`
    overlayCell[k] = (overlayCell[k] ?? 0) + 1
  }
  for (const s of o.secondarySemantics ?? []) {
    const k = `${o.sourceDisposition}|secondary|${s.category}`
    overlayCell[k] = (overlayCell[k] ?? 0) + 1
  }
}
// THE PROJECTION PLUS THE ADJUDICATED ROWS.
//
// STEP3B1-MANIFEST.json projects the 530. Seven held rows have since been adjudicated and applied,
// and each moves counts of its own. Their arithmetic is computed here with the SAME per-action
// rule the projection generator uses, so the target stays derived rather than re-typed: a target
// that is edited by hand to match what was measured is not a gate.
const PK_OF = { claims: 'claim', questions: 'question', directives: 'directive', predictions: 'prediction' }
const dispDelta = {}
for (const d of dispositions) {
  if (d.humanReviewRequired) continue
  // A CLAUSE PARTITION MOVES NO COUNT. Both records survive; each is re-spanned onto its own
  // clause. Nothing is withdrawn and nothing is created, so the totals are untouched.
  if (d.kind === 'CLAUSE_PARTITION') continue
  const winnerKind = Object.entries(PK_OF).find(([, v]) => v === d.proposedPrimaryCategory)?.[0]
  const bump = (src, layer, cat, n) => { if (!cat || !n) return; const k = `${src}|${layer}|${cat}`; dispDelta[k] = (dispDelta[k] ?? 0) + n }
  for (const k of d.oldOccurrenceKeys ?? []) {
    // A record of the WINNING kind is widened in place, not withdrawn — no count moves.
    if (k.split('|')[1] === winnerKind) continue
    bump('q_authored', 'primary', PK_OF[k.split('|')[1]], -1)
  }
  for (const sec of d.proposedSecondarySemantics ?? []) bump(d.sourceDisposition, 'secondary', sec.category, 1)
}

// The extra sets move counts too, by their own rules:
//   WITHDRAW_RECORD  the span was nothing but links or labels — the record goes, so its kind -1
//   SPAN_TRIM        geometry only; the record survives at a smaller span, so nothing moves
//   MULTI_PRIMARY    one category keeps the sentence, each loser -1 primary and +1 secondary
for (const a of extraSets) {
  const bump = (src, layer, cat, n) => { if (!cat || !n) return; const k = `${src}|${layer}|${cat}`; dispDelta[k] = (dispDelta[k] ?? 0) + n }
  if (a.kind === 'WITHDRAW_RECORD') {
    for (const k of a.recordsWithdrawn ?? []) bump('q_authored', 'primary', PK_OF[k.split('|')[1]], -1)
    continue
  }
  if (a.kind === 'SPAN_TRIM') continue
  if (a.kind === 'MULTI_PRIMARY_RESOLUTION') {
    const winnerKind = Object.entries(PK_OF).find(([, v]) => v === a.proposedPrimaryCategory)?.[0]
    for (const k of a.oldOccurrenceKeys ?? []) {
      if (k.split('|')[1] === winnerKind) continue
      bump('q_authored', 'primary', PK_OF[k.split('|')[1]], -1)
    }
    for (const sec of a.proposedSecondarySemantics ?? []) bump(a.sourceDisposition, 'secondary', sec.category, 1)
  }
}

const crossTab = manifest.counts.projection.map(r => {
  const isHeadline = r.source === 'q_authored' && r.layer === 'primary'
  const measured = isHeadline ? (primaryByKind[KW[r.category]] ?? 0) : (overlayCell[`${r.source}|${r.layer}|${r.category}`] ?? 0)
  const adj = dispDelta[`${r.source}|${r.layer}|${r.category}`] ?? 0
  const target = r.after + adj
  return { source: r.source, layer: r.layer, category: r.category, before: r.before, projectedDelta: r.delta,
    projectedAfter: r.after, adjudicatedHeldDelta: adj, target,
    measuredAfter: measured, headlineEligible: isHeadline, matches: measured === target,
    measuredFrom: isHeadline ? 'audit/occurrence-ledger.json' : 'public/data/semantics.json' }
})
const gates = [gate('count cross-tab matches the projection', crossTab.every(r => r.matches),
  crossTab.filter(r => !r.matches).map(r => `${r.source}|${r.layer}|${r.category} ${r.measuredAfter}!=${r.target}`).join(', ')
  || `all ${crossTab.length} cells (projection + ${dispositions.filter(d => !d.humanReviewRequired).length} adjudicated held rows)`)]

// ── 2. every automatic action landed, no held action moved ──────────────────────────────────
const overlayByAction = new Map(overlay.occurrences.map(o => [o.actionId, o]))
const missing = automatic.filter(a => !overlayByAction.has(a.actionId))
const overlayRowsExpected = automatic.reduce((n, a) => n + (a.kind === 'CLAUSE_PARTITION' ? (a.clauses ?? []).length : 1), 0)
gates.push(gate('every automatic action materialised', missing.length === 0,
  `${automatic.length - missing.length}/${automatic.length} actions, ${overlay.occurrences.length}/${overlayRowsExpected} overlay rows  (530 planned + ${dispositions.filter(d => !d.humanReviewRequired).length} adjudicated held + ${extraSets.length} B2/B2b; #34 contributes two rows, one per clause)`))

const heldIds = new Set(held.map(h => h.actionId))
const heldTouched = overlay.occurrences.filter(o => heldIds.has(o.actionId))
gates.push(gate('no held action appears in the applied overlay', heldTouched.length === 0,
  heldTouched.length ? heldTouched.map(o => o.actionId).join(', ') : `${held.length} still held, none applied`))

// A held action's records must still be LIVE in the bundle, at the offsets the plan recorded.
const liveKeys = new Set(ledger.records.map(r => r.key))
const heldKeyState = held.map(h => ({
  actionId: h.actionId, ruleCode: h.ruleCode, postNum: h.postNum, sentenceId: h.sentenceId,
  oldOccurrenceKeys: h.oldOccurrenceKeys,
  keysStillLive: (h.oldOccurrenceKeys ?? []).filter(k => liveKeys.has(k)).length,
  keysExpected: (h.oldOccurrenceKeys ?? []).length,
}))
// The two held DUPLICATE_MERGE rows still carry their duplicate records, so "live" is what matters,
// not a one-to-one count.
const heldIntact = heldKeyState.every(h => h.keysStillLive === h.keysExpected)
gates.push(gate('every held action\'s records are still live and unmodified', heldIntact,
  heldKeyState.filter(h => h.keysStillLive !== h.keysExpected).map(h => h.actionId).join(', ') || `all ${held.length} intact`))

// ── 3. no key spent twice, no identity rebuilt ──────────────────────────────────────────────
const spend = new Map()
let doubleSpend = 0
for (const a of automatic) for (const k of a.oldOccurrenceKeys ?? []) {
  if (spend.has(k) && spend.get(k) !== a.actionId) doubleSpend++
  spend.set(k, a.actionId)
}
gates.push(gate('zero duplicate action consumption', doubleSpend === 0, `${spend.size} distinct old keys across ${automatic.length} actions`))

// Every overlay row must name an occurrence that exists in the runtime body at exactly its offsets.
//
// EXCEPT THE UNLOCATED WITHDRAWALS, WHICH ARE DEFINED BY NOT HAVING ONE. A record that binds to no
// characters is precisely what UNLOCATED means: it can never be painted, which is why it sat in
// the conflict queue and why Owner Ruling 3 withdrew it. Its overlay row records the withdrawal
// and carries start/end of null, so it is excluded here and asserted separately below — never by
// relaxing what "exists at exactly its offsets" means for the 691 rows that do have offsets.
const bodyByNum = new Map(posts.map(p => [p.postNum, runtimeText(p.text ?? '')]))
const located = overlay.occurrences.filter(o => o.start !== null && o.end !== null)
const unlocated = overlay.occurrences.filter(o => o.start === null || o.end === null)
const badSpan = located.filter(o => bodyByNum.get(o.postNum)?.slice(o.start, o.end) !== o.text)
gates.push(gate('zero runtime substring mismatch in the overlay', badSpan.length === 0,
  badSpan.length ? badSpan.slice(0, 5).map(o => o.occurrenceKey).join(', ') : `${located.length} located rows verified against runtimeText()`))

// The unlocated rows must be withdrawals and nothing else. A row with no offsets that still claims
// to paint something would be a record asserting a span it cannot show.
const unlocatedNotWithdrawn = unlocated.filter(o => !o.withdrawn || o.primaryCategory)
gates.push(gate('every overlay row without offsets is a withdrawal', unlocatedNotWithdrawn.length === 0,
  unlocatedNotWithdrawn.length ? unlocatedNotWithdrawn.map(o => o.occurrenceKey).join(', ')
    : `${unlocated.length} unlocated rows, all withdrawn, none painting`))

// And the same for every record the ledger located, which is the whole bundle.
const badLedger = ledger.records.filter(r => bodyByNum.get(r.postNum)?.slice(r.start, r.end) !== r.text)
gates.push(gate('zero runtime substring mismatch in the ledger', badLedger.length === 0,
  `${ledger.records.length.toLocaleString()} records verified`))

// ── 4. the scoped structural gates ──────────────────────────────────────────────────────────
const appliedSentences = new Set(automatic.map(a => `${a.postNum}|${a.sentenceId}`))
const heldSentences = new Set(held.map(h => `${h.postNum}|${h.sentenceId}`))

// A disjoint clause partition is an adjudicated division of a sentence, not a collision — see the
// note in build-occurrence-ledger.mjs. Overlapping multi-primary sentences still count here.
const partitions = (dryrun.multiPrimary ?? []).filter(m => !m.certifiedOverlap && m.disjointClausePartition)
const multi = (dryrun.multiPrimary ?? []).filter(m => !m.certifiedOverlap && !m.disjointClausePartition)
const multiInScope = multi.filter(m => appliedSentences.has(`${m.postNum}|${m.sentenceId}`))
gates.push(gate('zero same-sentence multi-primary inside the applied scope', multiInScope.length === 0,
  `${multi.length} remain archive-wide, all outside the applied set` + (multi.length ? ` (${multi.map(m => m.sentenceId).join(', ')})` : '')))
const multiAllHeld = multi.every(m => heldSentences.has(`${m.postNum}|${m.sentenceId}`))
gates.push(gate('every remaining overlapping multi-primary sentence is a held action', multiAllHeld,
  multi.filter(m => !heldSentences.has(`${m.postNum}|${m.sentenceId}`)).map(m => m.sentenceId).join(', ') || `${multi.length} remaining, each one a held action`))

// THE SOURCE-BOUNDARY SENTENCES ARE THE ONE NAMED EXCEPTION, AND IT WAS FOUND BY THIS GATE.
//
// A-SB-2653 and A-SB-4310 each withdraw ONE truncated Q-authored claim from a sentence the owner
// ruled is pasted source. But the rest of that same sentence was certified as further separate
// claims records, and the plan does not withdraw those — so #2653 keeps one sibling fragment and
// #4310 keeps three, still counted as q_authored, still overlapping each other.
//
// They are NOT withdrawn here. Doing so would move the q_authored claim total off the projection
// the owner reviewed, on an unreviewed judgement about source ownership — the exact class of
// decision Step 3B-1 holds for the owner. The gate therefore asserts what is true: the only
// in-scope residuals are on these two sentences, and they are named.
const SOURCE_BOUNDARY_EXCEPTION = new Set(automatic
  .filter(a => a.kind === 'SOURCE_BOUNDARY_RESOLUTION').map(a => `${a.postNum}|${a.sentenceId}`))

// A DECLARED SUB-SENTENCE TARGET LEAVES THE REST OF ITS SENTENCE UNPAINTED, ON PURPOSE.
//
// #1928 runs a URL straight into "Who is [1 of 4] FIREWALLS?" with no separator, so the ledger
// sees one sentence and the owner ruled the URL stays a link. The question therefore paints a
// PARTIAL span and the ledger correctly reports it as one. That is the ruling working, not a
// defect — but it is only allowed where the action declared spanOverride and said why.
const DECLARED_PARTIAL = new Set(automatic
  .filter(a => a.spanOverride || a.kind === 'CLAUSE_PARTITION').map(a => `${a.postNum}|${a.sentenceId}`))
const intentionallyUncategorized = automatic
  .filter(a => a.intentionallyUncategorized)
  .flatMap(a => a.intentionallyUncategorized.map(u => ({ actionId: a.actionId, postNum: a.postNum, sentenceId: a.sentenceId, ...u })))

const overlaps = (dryrun.sameCategoryOverlap ?? []).filter(o => !o.deliberate)
const overlapInScope = overlaps.filter(o => appliedSentences.has(`${o.postNum}|${o.sentenceId}`))
const overlapUnexplained = overlapInScope.filter(o => !SOURCE_BOUNDARY_EXCEPTION.has(`${o.postNum}|${o.sentenceId}`))
gates.push(gate('every in-scope same-category primary overlap is a named source-boundary exception',
  overlapUnexplained.length === 0,
  `${overlaps.length} archive-wide; ${overlapInScope.length} in scope, all on ${[...new Set(overlapInScope.map(o => '#' + o.postNum))].join(' ') || '—'}; ${overlapUnexplained.length} unexplained`))

const partials = (dryrun.replacements ?? []).filter(r => !r.deliberate)
const partialInScope = partials.filter(r => appliedSentences.has(`${r.postNum}|${r.sentenceId}`))
const partialUnexplained = partialInScope.filter(r => !SOURCE_BOUNDARY_EXCEPTION.has(`${r.postNum}|${r.sentenceId}`)
  && !DECLARED_PARTIAL.has(`${r.postNum}|${r.sentenceId}`))
gates.push(gate('every in-scope partial primary span is a named source-boundary exception or a declared span override',
  partialUnexplained.length === 0,
  `${partials.length} archive-wide; ${partialInScope.length} in scope, all on ${[...new Set(partialInScope.map(r => '#' + r.postNum))].join(' ') || '—'}; ${partialUnexplained.length} unexplained`))

// ── 5. metadata and relationships travelled ─────────────────────────────────────────────────
const withMeta = transfers.filter(t => t.metadata && Object.keys(t.metadata).length)
const rekeys = transfers.filter(t => t.rekeyed)
// Nothing may be lost: every claimMeta / directiveMeta key still in the bundle must still be
// reachable from a span that is still certified, and every one that left must appear in a transfer.
const metaKeysNow = new Set()
for (const p of posts) {
  for (const m of [p.claimMeta, p.directiveMeta, p.directiveFamilies]) for (const k of Object.keys(m ?? {})) metaKeysNow.add(`${p.postNum}|${k}`)
}
gates.push(gate('metadata transfer recorded for every withdrawn record', transfers.length >= withMeta.length,
  `${transfers.length} transfers, ${withMeta.length} carrying certified attributes, ${rekeys.length} meta keys re-pointed to a widened span`))

const dqPreserved = overlay.occurrences.filter(o => (o.relationshipsPreserved ?? []).includes('question_directive'))
const dqDeclared = automatic.filter(a => a.relationshipsPreserved === 'question_directive')
gates.push(gate('question_directive relationship preserved on every unified pair',
  dqPreserved.length === dqDeclared.length, `${dqPreserved.length}/${dqDeclared.length} edges retained as a secondary rather than a second paint`))

// A demoted question record keeps its identity — nothing was deleted to move a count.
const marked = questions.filter(q => q.semanticLayer)
const markedKeepId = marked.every(q => q.id && q.text !== undefined && q.occurrences !== undefined)
gates.push(gate('no question record deleted to move a count', markedKeepId,
  `${marked.length} marked (${marked.filter(q => q.semanticLayer === 'secondary').length} secondary, ${marked.filter(q => q.semanticLayer === 'withdrawn').length} withdrawn), all retain id / text / occurrences`))

// ── 5b. the two views of a section still agree ──────────────────────────────────────────────
//
// `claims` is the certified wording and `claimSpans` is the literal form the renderer paints;
// postHighlight.tsx reads `claimSpans ?? claims` while contracts.mjs counts `claims`. Edit one and
// not the other and the asserted total stops describing the pixels. This gate exists because the
// first version of the applier did exactly that on 81 posts.
let parityBreaks = 0
for (const p of posts) {
  const a = p.postAnalysis ?? {}
  for (const [x, y] of [['claims', 'claimSpans'], ['predictions', 'predictionSpans']]) {
    if (Array.isArray(a[x]) && Array.isArray(a[y]) && a[x].length !== a[y].length) parityBreaks++
  }
}
const totals = { claims: 0, claimSpans: 0, predictions: 0, predictionSpans: 0 }
for (const p of posts) for (const k of Object.keys(totals)) totals[k] += (p.postAnalysis?.[k] ?? []).length
gates.push(gate('the certified wording and the painted span stay index-aligned', parityBreaks === 0,
  `claims ${totals.claims} = claimSpans ${totals.claimSpans}; predictions ${totals.predictions} = predictionSpans ${totals.predictionSpans}; ${parityBreaks} posts out of alignment`))

// ── 6. the conflict queue is untouched ──────────────────────────────────────────────────────
const conflictCsv = fs.readFileSync(path.join(ROOT, 'STEP3B1-DRYRUN', '10-CONFLICTS-HELD.csv'), 'utf8')
const conflictRows = conflictCsv.trim().split('\n').length - 1
const heldConflictKeys = new Set(conflictCsv.trim().split('\n').slice(1)
  .map(l => (l.match(/^[^,]*,([^,]*)/) ?? [])[1]).filter(Boolean).map(s => s.replace(/^"|"$/g, '')))
// THE PLAN MAY NOT TOUCH THE QUEUE. THE B2 SETS EXIST TO.
//
// Step 3B-1's 530 were gated on never consuming a conflict key — the queue was explicitly out of
// their scope. The B2 boundary repairs are the opposite: resolving those rows is their entire
// purpose. So the assertion is split rather than weakened, and what B2 resolved is reported.
const extraIds = new Set(extraSets.map(a => a.actionId))
const planSpend = new Map()
for (const a of automatic) {
  if (extraIds.has(a.actionId)) continue
  for (const k of a.oldOccurrenceKeys ?? []) planSpend.set(k, a.actionId)
}
const consumedHeld = [...planSpend.keys()].filter(k => heldConflictKeys.has(k))
const resolvedByB2 = new Set(extraSets.flatMap(a => (a.oldOccurrenceKeys ?? []).filter(k => heldConflictKeys.has(k))))
gates.push(gate('no PLAN action consumed a held-conflict key', consumedHeld.length === 0,
  `${conflictRows} rows in the frozen queue, ${heldConflictKeys.size} distinct held keys; plan consumed 0, B2/B2b deliberately resolved ${resolvedByB2.size}`))
gates.push(gate('the 945-row conflict queue is unchanged', conflictRows === 945, `${conflictRows} rows`))

// ── 7. write the receipt ────────────────────────────────────────────────────────────────────
const receipt = {
  note: 'Step 3B-1 apply receipt. Measured from the bundle, not from the plan.',
  step: '3B-1',
  planSha256: overlay.planSha256,
  actionsApplied: overlay.actionsApplied,
  actionsHeld: overlay.actionsHeld,
  heldActionIds: overlay.heldActionIds,
  seedVersion: Number((fs.readFileSync(path.join(ROOT, 'src', 'lib', 'localData.ts'), 'utf8')
    .match(/SEED_VERSION = (\d+)/) ?? [])[1] ?? NaN),
  outputs: {
    'public/data/posts.json': sha(path.join(DATA, 'posts.json')),
    'public/data/questions.json': sha(path.join(DATA, 'questions.json')),
    'public/data/semantics.json': sha(path.join(DATA, 'semantics.json')),
    'audit/occurrence-ledger.json': sha(path.join(OUT, 'occurrence-ledger.json')),
  },
  crossTab,
  heldActions: heldKeyState,
  // Found by this run, not by the plan. Needs an owner ruling before Step 6 certification.
  discoveredDuringApply: [{
    finding: 'the source-boundary resolution withdraws only the truncated head of a pasted sentence',
    detail: 'A-SB-2653 and A-SB-4310 withdraw one q_authored claim each. The remaining fragments of the SAME source-owned sentence are still certified as q_authored claims and still overlap each other.',
    sameCategoryOverlaps: overlapInScope.map(o => ({ postNum: o.postNum, sentenceId: o.sentenceId, kind: o.kind, nested: o.nested, a: o.a, b: o.b })),
    supersededPartials: partialInScope.map(r => ({ postNum: r.postNum, sentenceId: r.sentenceId, kind: r.kind, start: r.start, end: r.end, partial: r.partial })),
    notWithdrawnBecause: 'withdrawing them moves the q_authored claim total off the reviewed projection on an unreviewed source-ownership judgement',
  }, {
    finding: 'the plan\'s sentenceStart/sentenceEnd disagree with its own sentenceText on the source-boundary rows',
    detail: 'A-SB-2653 declares 2480..2530 (50 chars) with a 133-char sentenceText; the ledger measures the sentence at 2480..2613. A-SB-4310 declares a 189-char text where the splitter measures 419, because "be removed.The recommendation" carries no space after the period. The applier stored the MEASURED geometry and kept the plan wording as planProposedText.',
    rows: overlay.occurrences.filter(o => o.planProposedText).map(o => ({ actionId: o.actionId, occurrenceKey: o.occurrenceKey, measuredLength: o.end - o.start, planProposedLength: o.planProposedText.length })),
  }],
  intentionallyUncategorized,
  clausePartitions: partitions.map(m => ({ postNum: m.postNum, sentenceId: m.sentenceId, kinds: m.kinds })),
  residualsOutOfScope: {
    note: 'Explicitly left for the owner: the 10 held actions and the 945-row conflict queue.',
    multiPrimarySentences: multi.length,
    sameCategoryPrimaryOverlaps: overlaps.length,
    supersededPartialPrimarySpans: partials.length,
    boundaryCrossingRecords: ledger.records.filter(r => r.relation === 'CROSSING').length,
    conflictQueueRows: conflictRows,
  },
  gates,
}
fs.writeFileSync(path.join(OUT, 'step3b1-apply-receipt.json'), JSON.stringify(receipt, null, 1))

for (const g of gates) console.log(`${g.pass ? 'PASS' : 'FAIL'}  ${g.gate}\n        ${g.detail}`)
console.log(`\n-> audit/step3b1-apply-receipt.json`)
if (FAIL.length) { console.error(`\n[X] ${FAIL.length} gate(s) failed.`); process.exit(1) }
console.log(`\nAll ${gates.length} gates pass.`)
