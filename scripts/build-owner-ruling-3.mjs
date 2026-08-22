// OWNER RULING 3 — the 29 reviewed C/D/E occurrence withdrawals, written as a canonical artifact.
//
//   node scripts/build-owner-ruling-3.mjs
//
// Writes two artifacts and nothing else. It applies nothing.
//
//   audit/occurrence-withdrawals-owner-ruling-3.json   the 27 namedEntities occurrences, in the
//                                                      2026-08-17 audit's coordinate system, read
//                                                      by apply-entity-cleanup.mjs
//   audit/step3b1-r3-actions.jsonl                     the 2 themeAnchors records, in the Step 3B-1
//                                                      action schema, read by apply-step3b1.mjs
//
// WHY TWO. The reviewed population is 29 records in TWO layers. 27 are entries in
// postAnalysis.namedEntities and every one of them moves entities.json — mentions, post sets and,
// for fifteen of them, the last mention an identity had. That accounting lives in
// apply-entity-cleanup.mjs and there is no second copy of it. The other 2 are entries in
// postAnalysis.themeAnchors, which carries no entity accounting at all and is rebuilt by
// apply-themes.mjs earlier in the chain, so its withdrawal belongs to the applier that runs after
// every step that writes the arrays it edits. Splitting by LAYER keeps each record inside the
// materialiser that owns its array; merging them would have meant a third applier and a third set
// of gates.
//
// COORDINATES. The 27 are addressed as (postNum, index, alias) against the PRE-cleanup
// namedEntities array — the same coordinate system audit/occurrence-provenance-audit.json uses,
// because apply-entity-cleanup.mjs runs immediately after apply-entities.mjs rebuilds posts.json
// from the pre-cleanup adjudication. Verified by reconstruction: the audit's rows, sorted by index
// and filtered to the kept actions, reproduce the current bundle on 2,429 of 2,477 posts, and all
// 48 exceptions are duplicate merges that apply-step3b1.mjs performs LATER in the chain.
//
// THE ORIGINAL APPROVAL IS NOT TOUCHED. audit/occurrence-provenance-audit.json keeps its
// 2026-08-17 bytes, its 951 proposedWithdrawals and its totals. This ruling is a separate,
// separately-pinned set recorded beside it, and the rollback contract gets a fourth
// postApprovalDeltas entry rather than an edit to countsBefore/countsAfter.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const DATA = path.join(ROOT, 'public', 'data')
const read = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const sha = s => crypto.createHash('sha256').update(s).digest('hex')

const review = read(OUT, 'step3b1-entity-review.json')
const audit = read(OUT, 'occurrence-provenance-audit.json')
const entities = read(DATA, 'entities.json')
const posts = read(DATA, 'posts.json')
const postByNum = new Map(posts.map(p => [p.postNum, p]))

// ── the reviewed population, exactly as the review recorded it ──────────────────────────────
const ADJUDICATION = {
  C: 'INFERRED_NOT_EXPLICIT',
  D: 'QUOTED_OR_PASTED / URL-DERIVED MATERIAL',
  E: 'WRONG_IDENTITY',
}
const cde = review.rows.filter(r => ['C', 'D', 'E'].includes(r.verdict))
if (cde.length !== 29) { console.error(`[X] expected 29 C/D/E rows, found ${cde.length}`); process.exit(1) }
const byVerdict = cde.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] ?? 0) + 1 }), {})
if (byVerdict.C !== 12 || byVerdict.D !== 14 || byVerdict.E !== 3) {
  console.error(`[X] the ruling names C 12 / D 14 / E 3; the review holds ${JSON.stringify(byVerdict)}`); process.exit(1)
}

// WHERE THE STATED RATIONALE IS DEMONSTRABLY WRONG, THE RECORD SAYS SO.
//
// The disposition is the owner's and is executed as given. But two of the 29 carry a review
// rationale that does not survive reading the drop, and a certified artifact that repeats a false
// reason is worse than one that carries a correction beside it. Neither changes what is applied;
// both name the evidence and the one-line reversal, so the owner can reverse either individually.
const RATIONALE_CORRECTIONS = {
  '#56:4': {
    statedReason: 'the stored identity is a whole sentence, not an entity name (7 words)',
    correction: 'It is not a sentence. "International Islamic Council for Da\'wa and Relief" is a '
      + 'legitimate 7-word organization name and it IS written on the drop. Two other things are '
      + 'true and either supports the withdrawal: the whole body of #56 is verbatim pasted copy '
      + 'from thehill.com below the link, so no entity in it is Q-authored prose; and the stored '
      + "form spells Da'wa with a straight apostrophe while the drop spells it Da’wa, which is why "
      + 'the record is unlocatable and can never be painted.',
    correctedAdjudication: 'D — QUOTED_OR_PASTED MATERIAL (the E rationale misfired on name length)',
  },
  '#4875:themeAnchors:0': {
    statedReason: 'the stored identity is a whole sentence, not an entity name (14 words)',
    correction: 'It IS a whole sentence, and that is correct for a themeAnchor — themeAnchors are '
      + 'sentences by design, so the E test does not apply to this layer. The line is Q-authored '
      + 'prose. The record is unlocatable for one reason only: the anchor stores the trailing '
      + 'ellipsis as ……….. while the drop writes it as eleven full stops. On the evidence this '
      + 'is a repairable geometry defect rather than a withdrawal.',
    correctedAdjudication: 'B — REPAIR_GEOMETRY would also close it; withdrawal applied as ruled',
  },
}

// ── 27 named-entity occurrences ─────────────────────────────────────────────────────────────
const auditByPostAlias = new Map()
for (const r of audit.rows) {
  const k = `${r.postNum}|${r.alias}`
  if (!auditByPostAlias.has(k)) auditByPostAlias.set(k, [])
  auditByPostAlias.get(k).push(r)
}
const entById = new Map(entities.entities.map(e => [e.id, e]))
const idLedger = fs.existsSync(path.join(OUT, 'entity-ids.json')) ? read(OUT, 'entity-ids.json') : {}

const withdrawals = []
const themeRows = []
const problems = []

for (const row of cde) {
  const m = row.conflictId.match(/UNLOCATED-(\d+)-(\w+)/)
  const postNum = Number(m[1])
  const layer = m[2]
  const post = postByNum.get(postNum)
  if (!post) { problems.push(`#${postNum}: no such drop`); continue }

  if (layer === 'themeAnchors') {
    const arr = post.postAnalysis?.themeAnchors ?? []
    // The conflictId truncates the identity at 120 characters, so the stored anchor is matched by
    // prefix rather than by equality — and it must match exactly one entry, or this is ambiguous.
    const hits = arr.map((t, i) => [t, i]).filter(([t]) => t.startsWith(row.identity))
    if (hits.length !== 1) { problems.push(`#${postNum} themeAnchors: ${hits.length} entries match the reviewed identity`); continue }
    const [text, index] = hits[0]
    const recordId = `#${postNum}:themeAnchors:${index}`
    themeRows.push({
      postNum,
      sentenceId: null,
      sourceDisposition: 'q_authored',
      oldOccurrenceKeys: [],
      oldCategories: [`themeAnchors[${index}]`],
      proposedSecondarySemantics: [],
      proposedReviewDispositions: [],
      recordsWithdrawn: [],
      withdrawReason: row.reason,
      metadataTransferred: '',
      relationshipsPreserved: '',
      confidence: 'HIGH',
      humanReviewRequired: false,
      actionId: `R3-WITHDRAW-${postNum}-themeAnchors-${index}`,
      kind: 'WITHDRAW_UNLOCATED_RECORD',
      unlocatedRecord: { field: 'themeAnchors', index, text },
      sentenceStart: null,
      sentenceEnd: null,
      sentenceText: text,
      proposedPrimaryCategory: null,
      ruleCode: 'R3_OWNER_RULING_3_WITHDRAWAL',
      adjudication: `${row.verdict} — ${ADJUDICATION[row.verdict]}`,
      adjudicationReason: 'Owner Ruling 3, 2026-08-22: APPROVED. The reviewed C/D/E population must '
        + 'not remain attributed as Q-authored semantic paint.',
      ownerRuling: 'Owner Ruling 3 (2026-08-22)',
      originalIdentity: row.identity,
      originalContext: row.context,
      rationaleCorrection: RATIONALE_CORRECTIONS[recordId] ?? null,
      reversal: `Restore ${JSON.stringify(text)} at index ${index} of postAnalysis.themeAnchors in #${postNum}.`,
    })
    continue
  }

  const cands = (auditByPostAlias.get(`${postNum}|${row.identity}`) ?? [])
  if (cands.length !== 1) { problems.push(`#${postNum} "${row.identity}": ${cands.length} audit rows`); continue }
  const ar = cands[0]
  const e = entById.get(ar.entityId) ?? entById.get(idLedger[ar.entityId]?.id)
  if (!e) { problems.push(`${ar.occurrenceId}: entity ${ar.entityId} is not in the registry`); continue }

  withdrawals.push({
    occurrenceId: ar.occurrenceId,
    postNum,
    index: ar.index,
    alias: ar.alias,
    entityId: ar.entityId,
    canonical: e.canonical,
    entityType: e.type,
    // The 2026-08-17 classification, preserved verbatim. It is NOT changed — this ruling
    // re-adjudicates the DECISION, not the evidence that was recorded about it.
    originalCategory: ar.category,
    originalEvidence: ar.evidence,
    originalProposedAction: ar.proposedAction,
    originalCertifiedCountEffect: ar.certifiedCountEffect,
    // The re-adjudication.
    adjudication: `${row.verdict} — ${ADJUDICATION[row.verdict]}`,
    reasonForWithdrawal: row.reason,
    ownerRuling: 'Owner Ruling 3 (2026-08-22): APPROVE the 29 individually reviewed C/D/E '
      + 'entity-occurrence withdrawals. These 29 should not remain attributed as Q-authored entity '
      + 'occurrences. This DOES re-adjudicate those specific occurrence decisions from the '
      + '2026-08-17 occurrence-provenance migration.',
    // WHAT THE OWNER IS OVERRIDING, NAMED RATHER THAN SILENTLY BYPASSED.
    overridesProtection: ar.category === 'visible_complete_token'
      ? 'The 2026-08-17 audit classified this occurrence visible_complete_token, and buildPlan '
        + 'refuses a removal action on that category. That refusal governs the approved audit and '
        + 'is unchanged. This occurrence is withdrawn by an explicit per-occurrence owner ruling '
        + 'instead, which is how a semantic ruling is applied in this archive — by occurrence '
        + 'identity, never by loosening a matcher.'
      : null,
    originalIdentityText: row.identity,
    originalPostText: String(post.text ?? ''),
    originalPostTextSha256: sha(String(post.text ?? '')),
    originalContext: row.context,
    rationaleCorrection: RATIONALE_CORRECTIONS[ar.occurrenceId] ?? null,
    // Executed through the same door as the approved 951.
    proposedAction: 'remove-annotation',
    certifiedCountEffect: -1,
    reversal: `Restore "${ar.alias}" at index ${ar.index} of postAnalysis.namedEntities in #${postNum} and add 1 to ${e.canonical}.`,
  })
}

if (problems.length) {
  console.error(`\n[X] ${problems.length} problem(s) building the ruling:`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}
if (withdrawals.length !== 27 || themeRows.length !== 2) {
  console.error(`[X] expected 27 namedEntities + 2 themeAnchors, built ${withdrawals.length} + ${themeRows.length}`)
  process.exit(1)
}

// ── the entity effect, measured rather than asserted ────────────────────────────────────────
const perEntity = new Map()
for (const w of withdrawals) perEntity.set(w.entityId, (perEntity.get(w.entityId) ?? 0) + 1)
const zeroed = []
for (const [id, n] of perEntity) {
  const e = entById.get(id)
  if (e && e.mentions - n <= 0) zeroed.push({ entityId: id, canonical: e.canonical, mentionsBefore: e.mentions, withdrawn: n })
}

const doc = {
  note: 'Owner Ruling 3 — 27 named-entity occurrence withdrawals, re-adjudicating specific decisions '
    + 'from the 2026-08-17 occurrence-provenance migration. Read by apply-entity-cleanup.mjs as an '
    + 'additional, separately-pinned action set. The 2026-08-17 audit and its approval record are '
    + 'not modified.',
  ruledOn: '2026-08-22',
  ownerRuling: 'APPROVE the 29 individually reviewed C/D/E entity-occurrence withdrawals. C 12 '
    + 'INFERRED_NOT_EXPLICIT, D 14 QUOTED_OR_PASTED / URL-DERIVED MATERIAL, E 3 WRONG_IDENTITY. '
    + 'Do NOT overwrite or weaken the old approval. Use the same post-approval-delta mechanism '
    + 'already used for later owner rulings. Do not touch the 9 F rows.',
  reviewedPopulation: { C: 12, D: 14, E: 3, total: 29, F_untouched: 9 },
  layerSplit: { namedEntities: 27, themeAnchors: 2 },
  provenance: {
    reviewArtifact: 'audit/step3b1-entity-review.json',
    reviewCommit: 'b04419b',
    originalApproval: 'audit/entity-cleanup-rollback-contract.json — approvedByOwner, 2026-08-17',
    originalApprovalUntouched: true,
    occurredAfterOriginalApproval: true,
    coordinateSystem: 'pre-cleanup postAnalysis.namedEntities indices, identical to '
      + 'audit/occurrence-provenance-audit.json; apply-entity-cleanup.mjs runs directly after '
      + 'apply-entities.mjs rebuilds posts.json into that state.',
  },
  originalApprovedSnapshot: {
    countsBefore: { mentions: 9749, entityRows: 1409 },
    countsAfter: { mentions: 8798, entityRows: 1201, rendered: 8798 },
    auditTotals: { occurrences: audit.totals.occurrences, proposedWithdrawals: audit.totals.proposedWithdrawals },
    entitiesJsonBefore: '96e25a70a375aabd8e7423337beafbe32d55da5420c75cad61c6a9ba76a12cc0',
    postsJsonBefore: '03e5c2a85040298b900097197df39b18a2ee959c3e43aedf45eda44e915b1001',
  },
  measuredAtBuildTime: {
    entityRows: entities.entities.length,
    mentions: entities.totals.mentions,
    entitiesWhoseLastMentionThisWithdraws: zeroed.length,
    zeroed,
  },
  withdrawals,
}

fs.writeFileSync(path.join(OUT, 'occurrence-withdrawals-owner-ruling-3.json'), JSON.stringify(doc, null, 2) + '\n')
fs.writeFileSync(path.join(OUT, 'step3b1-r3-actions.jsonl'), themeRows.map(r => JSON.stringify(r)).join('\n') + '\n')

const shaOf = f => sha(fs.readFileSync(path.join(OUT, f)))
console.log('Owner Ruling 3 written.')
console.log(`  audit/occurrence-withdrawals-owner-ruling-3.json  ${withdrawals.length} occurrences  sha256 ${shaOf('occurrence-withdrawals-owner-ruling-3.json')}`)
console.log(`  audit/step3b1-r3-actions.jsonl                    ${themeRows.length} records      sha256 ${shaOf('step3b1-r3-actions.jsonl')}`)
console.log(`  identities whose last mention this withdraws      ${zeroed.length}`)
for (const z of zeroed) console.log(`     ${z.canonical}`)
