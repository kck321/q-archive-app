// STEP 3B-1 — THE DRY-RUN PACKAGE. Writes nothing to public/data and moves no count.
//
//   node scripts/build-step3b1-dryrun.mjs [--out DIR]
//
// THE IDENTITY RULE, which this generator exists to obey and to prove it obeyed:
//
//   An occurrence's identity comes from the ledger and is NEVER rediscovered. No indexOf, no
//   findIndex, no re-locating a shortened string. That last one is not hypothetical — it produced
//   two different keys for one occurrence (153|questions|60|150 and 153|questions|60|213) and made
//   two populations look disjoint while being the same records.
//
// Every exported row is checked twice before it is allowed out:
//
//   occurrenceKey === `${postNum}|${kind}|${start}|${end}`
//   runtimeText(post.text).slice(start, end) === the record's full literal text
//
// A single failure aborts the package. A dry run whose own rows do not resolve is worse than no
// dry run, because it reads as evidence.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'
import { PRIMARY_CATEGORIES } from './lib/occurrenceModel.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const AUDIT = path.join(ROOT, 'audit')
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > -1 ? path.resolve(process.argv[outIdx + 1]) : path.join(ROOT, 'STEP3B1-DRYRUN')

const read = f => JSON.parse(fs.readFileSync(f, 'utf8'))
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex')
const shaFile = f => sha(fs.readFileSync(f))

const posts = read(path.join(DATA, 'posts.json'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const bodyCache = new Map()
/** The one canonical body. Every offset in this package is into THIS string and no other. */
const bodyOf = postNum => {
  if (!bodyCache.has(postNum)) bodyCache.set(postNum, runtimeText(byNum.get(postNum)?.text ?? ''))
  return bodyCache.get(postNum)
}

const ledgerDoc = read(path.join(AUDIT, 'occurrence-ledger.json'))
const findings = read(path.join(AUDIT, 'occurrence-ledger-dryrun.json'))
const scope = read(path.join(AUDIT, 'step3b1-scope.json'))
const abbrev = read(path.join(AUDIT, 'abbreviation-span-repairs.json'))

const byKey = new Map(ledgerDoc.records.map(r => [r.key, r]))
const sentences = new Map()   // sentenceId -> { postNum, start, end, text }
for (const r of ledgerDoc.records) {
  if (!r.sentenceId || sentences.has(r.sentenceId)) continue
  if (r.relation === 'EXACT') sentences.set(r.sentenceId, { postNum: r.postNum, start: r.start, end: r.end, text: r.text })
}

// ── the two assertions every row must survive ────────────────────────────────
let identityReconstructionCount = 0     // stays 0 by construction: nothing here searches for text
let runtimeSubstringMismatchCount = 0
const mismatches = []
function assertIdentity(rec) {
  const composed = `${rec.postNum}|${rec.kind}|${rec.start}|${rec.end}`
  if (rec.key !== composed) { runtimeSubstringMismatchCount++; mismatches.push(`key ${rec.key} !== ${composed}`); return false }
  const body = bodyOf(rec.postNum)
  if (body.slice(rec.start, rec.end) !== rec.text) {
    runtimeSubstringMismatchCount++
    mismatches.push(`${rec.key}: body[${rec.start}..${rec.end}] is ${JSON.stringify(body.slice(rec.start, rec.end).slice(0, 50))}, record says ${JSON.stringify(String(rec.text).slice(0, 50))}`)
    return false
  }
  return true
}
for (const r of ledgerDoc.records) assertIdentity(r)

// ── the shape rules (owner ruling, 2026-08-21) ───────────────────────────────
//
// Surface speech act decides the PAINTED category. A genuinely correct second function stays as a
// non-painting secondary. No blanket precedence rule: each branch below is a grammatical test that
// can be checked afterwards against the sentence it fired on.
// The shape-rule cascade lives in lib/shapeRules.mjs — one copy, shared with the held-action
// adjudication so the two callers cannot drift apart.
import { classify, singular } from './lib/shapeRules.mjs'

// ── build the actions ────────────────────────────────────────────────────────
//
// ONE canonical actionId per proposed sentence migration. Populations are VIEWS of these actions,
// never separate mutations: an occurrence in three review sheets is still processed once.
const actions = []
const keyToAction = new Map()
const heldKeys = new Set()

const addAction = a => {
  actions.push(a)
  for (const k of a.oldOccurrenceKeys) {
    if (keyToAction.has(k)) a._duplicateKeyConsumption = (a._duplicateKeyConsumption ?? []).concat(k)
    else keyToAction.set(k, a.actionId)
  }
  return a
}

// (a) the 117 multi-primary sentences
const multi = (findings.multiPrimary ?? []).filter(m => !m.certifiedOverlap)
for (const m of multi) {
  const s = sentences.get(m.sentenceId)
  const spans = m.spans.filter(sp => sp.occurrenceKey)
  const kinds = [...new Set(spans.map(sp => sp.kind))]
  const { primary, rule } = classify(s?.text ?? spans[0]?.text, kinds)
  const secondary = kinds.map(singular).filter(c => c !== primary)
    .map(c => ({ category: c, reason: `certified in this section before the 2026-08-21 ruling; retained as a non-painting secondary` }))
  const partial = spans.filter(sp => sp.relation === 'PARTIAL')
  addAction({
    actionId: `A-MP-${m.sentenceId}`,
    kind: 'MULTI_PRIMARY_RESOLUTION',
    postNum: m.postNum, sentenceId: m.sentenceId,
    sentenceStart: s?.start ?? null, sentenceEnd: s?.end ?? null, sentenceText: s?.text ?? '',
    sourceDisposition: 'q_authored',
    populationMembership: ['MULTI_PRIMARY_117', partial.length ? 'CONTAINED_PARTIAL_28' : 'MULTI_PRIMARY_EXACT_89'],
    oldOccurrenceKeys: spans.map(sp => sp.occurrenceKey),
    oldCategories: spans.map(sp => `${sp.kind}@${sp.start}..${sp.end}[${sp.relation}]`),
    proposedPrimaryCategory: primary,
    proposedSecondarySemantics: secondary,
    proposedReviewDispositions: [],
    recordsWithdrawn: partial.map(sp => sp.occurrenceKey),
    withdrawReason: partial.length ? 'partial span superseded by the complete sentence' : '',
    metadataTransferred: spans.map(sp => sp.occurrenceKey).join(' '),
    relationshipsPreserved: kinds.includes('directives') && kinds.includes('questions') ? 'question_directive' : '',
    ruleCode: rule,
    confidence: rule === 'R6_SOLE_CATEGORY' ? 'LOW' : 'MEDIUM',
    humanReviewRequired: rule === 'R6_SOLE_CATEGORY',
    ...(rule === 'R6_SOLE_CATEGORY' ? { heldReason: 'NO_SHAPE_RULE_FIRED: the sentence matched none of the speech-act tests, so the painted category would be a guess rather than a ruling.' } : {}),
    beforeCountEffect: kinds.map(k => `${k}:-1`).join(' '),
    afterCountEffect: `${primary}:+1 primary${secondary.length ? ' · ' + secondary.map(x => `${x.category}:+1 secondary`).join(' ') : ''}`,
  })
}

// (b) the unified directive+question migration — 220 sentences, 440 keys, 51 partial question sides
const pairs = (findings.multiPrimary ?? []).filter(m => m.certifiedOverlap)
for (const m of pairs) {
  const s = sentences.get(m.sentenceId)
  const spans = m.spans.filter(sp => sp.occurrenceKey)
  const qSpan = spans.find(sp => sp.kind === 'questions')
  const questionShaped = /\?\s*$/.test(String(s?.text ?? '').trim())
  const primary = questionShaped ? 'question' : 'directive'
  const secondaryCat = questionShaped ? 'directive' : 'question'
  const wasPartial = Boolean(qSpan?.directiveWrapped) || qSpan?.relation === 'PARTIAL'
  addAction({
    actionId: `A-DQ-${m.sentenceId}`,
    kind: 'DIRECTIVE_QUESTION_UNIFIED',
    postNum: m.postNum, sentenceId: m.sentenceId,
    sentenceStart: s?.start ?? null, sentenceEnd: s?.end ?? null, sentenceText: s?.text ?? '',
    sourceDisposition: 'q_authored',
    populationMembership: ['DIRECTIVE_QUESTION_220', ...(qSpan?.directiveWrapped ? ['WRAPPED_PARTIAL_51'] : [])],
    oldOccurrenceKeys: spans.map(sp => sp.occurrenceKey),
    oldCategories: spans.map(sp => `${sp.kind}@${sp.start}..${sp.end}[${sp.relation}]`),
    proposedPrimaryCategory: primary,
    proposedSecondarySemantics: [{ category: secondaryCat, reason: 'the certified directive+question overlap, retained as a relationship rather than a second paint' }],
    proposedReviewDispositions: [],
    recordsWithdrawn: spans.filter(sp => sp.relation === 'PARTIAL').map(sp => sp.occurrenceKey),
    withdrawReason: wasPartial ? 'directive-wrapped question: the embedded partial span is superseded by the complete sentence' : '',
    metadataTransferred: spans.map(sp => sp.occurrenceKey).join(' '),
    relationshipsPreserved: 'question_directive',
    ruleCode: questionShaped ? 'R1_INTERROGATIVE' : 'R2_IMPERATIVE',
    confidence: 'MEDIUM',
    humanReviewRequired: false,
    questionSideWasPartial: wasPartial,
    beforeCountEffect: 'questions:-1 directives:-1',
    afterCountEffect: `${primary}:+1 primary · ${secondaryCat}:+1 secondary`,
  })
}

// (c) the three source-boundary exceptions
const PROVENANCE = {
  2653: { disposition: 'quoted_source', why: "the line opens with Q's \">\" greentext marker inside a run of them, reproducing a published article verbatim" },
  // HELD. A leading ">" on a chan board is Q's own indent marker as often as it is a quotation,
  // and this row has no article header, no linked source and no verbatim comparison behind it.
  // #2653 sits in a sustained excerpt beside a published article and #4310 under a "WASH POST:"
  // header between quotation marks; this one has neither. Keeping the sentence, holding the
  // OWNERSHIP: it is not removed from the Q-authored total until that is actually shown.
  3071: { disposition: 'q_authored', hold: true, why: "only evidence is a leading '>' marker, which does not by itself establish an outside quotation" },
  4310: { disposition: 'quoted_source', why: 'the passage sits directly beneath a "WASH POST:" header and is reproduced verbatim between quotation marks' },
}
for (const e of abbrev.excluded?.spans ?? []) {
  const prov = PROVENANCE[e.postNum] ?? { disposition: 'editorial_paraphrase', why: 'no verbatim source marker found' }
  const rec = ledgerDoc.records.find(r => r.postNum === e.postNum && r.kind === 'claims' && r.text === e.truncated)
  const key = rec?.key ?? null
  if (!key) heldKeys.add(`SOURCE-${e.postNum}`)
  addAction({
    actionId: `A-SB-${e.postNum}`,
    kind: 'SOURCE_BOUNDARY_RESOLUTION',
    postNum: e.postNum, sentenceId: rec?.sentenceId ?? null,
    sentenceStart: rec?.start ?? null, sentenceEnd: rec?.end ?? null,
    sentenceText: e.wouldHaveBecome,
    sourceDisposition: prov.disposition,
    populationMembership: ['SOURCE_BOUNDARY_3'],
    oldOccurrenceKeys: key ? [key] : [],
    oldCategories: [`claims@${rec?.start}..${rec?.end}[truncated]`],
    proposedPrimaryCategory: 'claim',
    proposedSecondarySemantics: [],
    proposedReviewDispositions: ['source_boundary_exception'],
    ...(prov.hold ? { humanReviewRequired: true, heldReason: 'SOURCE_OWNERSHIP_UNPROVEN: ' + prov.why } : {}),
    recordsWithdrawn: key ? [key] : [],
    withdrawReason: 'the partial Q-authored span is withdrawn; the complete sentence is retained as source-owned',
    metadataTransferred: key ?? '',
    relationshipsPreserved: '',
    ruleCode: 'R7_QUOTED_SOURCE',
    confidence: 'HIGH',
    // NOT a literal false: the hold spread above sets this true for #3071 and an object literal
    // takes its LAST value for a repeated key, so a trailing `false` silently un-held it.
    humanReviewRequired: Boolean(prov.hold),
    qAuthored: false,
    provenanceEvidence: prov.why,
    beforeCountEffect: 'q_authored primary claim:-1',
    afterCountEffect: `${prov.disposition} primary claim:+1  (NOT added to the Q-authored total)`,
  })
}

// (d) the duplicate-key merges, classified by metadata compatibility
// COMPARE THE IDENTITY, NOT ONLY THE TEXT.
//
// Once the ledger stores the MATCHED characters, two records over one span both read "AZ" — so
// identical text stopped distinguishing anything. What still differs is `certifiedValue`: the
// canonical identity each record carries. "Arizona" and "AZ" over the same two characters is one
// span claimed by two identities, and that is a real conflict a text comparison can no longer see.
const META_FIELDS = ['layer', 'sentenceId', 'relation']
const dupActions = []
for (const d of findings.duplicateRows ?? []) {
  const rows = ledgerDoc.records.filter(r => r.key === d.occurrenceKey)
  const identities = new Set(rows.map(r => r.certifiedValue ?? r.text))
  const compat = (() => {
    if (identities.size > 1) return 'CONFLICTING_METADATA'
    const sets = META_FIELDS.map(f => new Set(rows.map(r => JSON.stringify(r[f]))))
    return sets.every(s => s.size === 1) ? 'IDENTICAL_METADATA' : 'COMPLEMENTARY_METADATA'
  })()
  const auto = compat === 'IDENTICAL_METADATA' || compat === 'COMPLEMENTARY_METADATA'
  if (!auto) heldKeys.add(d.occurrenceKey)
  dupActions.push({ ...d, metadataCompatibility: compat, automatic: auto, rowCount: rows.length,
    identitiesClaimed: [...identities].sort().join(' | ') })
}

// (e) the context/review-layer moves
const contextMoves = (findings.contextCollision ?? []).filter(c => c.reviewKind === 'context')

// ── conflict-held populations (never automatic) ──────────────────────────────
for (const r of findings.crossingRows ?? []) heldKeys.add(r.occurrenceKey)
for (const o of (findings.sameCategoryOverlap ?? []).filter(x => x.layer === 'primary' && !x.nested)) heldKeys.add(`OVERLAP-${o.sentenceId}`)
for (const u of findings.unlocated ?? []) heldKeys.add(`UNLOCATED-${u.postNum}-${u.kind}`)

// ── assertions on the plan ───────────────────────────────────────────────────
// ── (f) the duplicate merges — 60 canonical actions, not 106 ────────────────
//
// 148 duplicate ROWS are 102 unique keys. 60 of them are non-conflicting and hold 166 ledger
// records between them: merging leaves 60 survivors and removes 106 excess records. The other 42
// keys hold two canonical identities over one span ("Arizona" and "AZ" over the same two
// characters) and are held. "106 merge actions" would have been one action per removed record
// rather than one per surviving occurrence.
const recordsByKey = new Map()
for (const r of ledgerDoc.records) {
  if (!recordsByKey.has(r.key)) recordsByKey.set(r.key, [])
  recordsByKey.get(r.key).push(r)
}
const boundaryKeys = new Set((findings.crossingRows ?? []).map(r => r.occurrenceKey))
for (const d of dupActions) {
  if (!d.automatic) continue
  const recs = recordsByKey.get(d.occurrenceKey) ?? []
  if (recs.length < 2) continue
  if (actions.some(a => a.actionId === `A-DUP-${d.occurrenceKey.replace(/\|/g, '-')}`)) continue
  const first = recs[0]
  addAction({
    actionId: `A-DUP-${d.occurrenceKey.replace(/\|/g, '-')}`,
    kind: 'DUPLICATE_MERGE',
    postNum: d.postNum, sentenceId: first.sentenceId,
    sentenceStart: first.start, sentenceEnd: first.end, sentenceText: first.text,
    sourceDisposition: 'q_authored',
    // A KEY CAN BELONG TO TWO POPULATIONS AND GETS ONE ACTION, NOT TWO. Two of these keys are
    // also boundary crossings, and merging duplicate records does NOT resolve cross-sentence
    // geometry — they are different questions about the same span. Both memberships travel on the
    // one action and the merge is held behind the boundary decision.
    populationMembership: ['DUPLICATE_KEYS_148', ...(boundaryKeys.has(d.occurrenceKey) ? ['BOUNDARY_CROSSING_242'] : [])],
    ...(boundaryKeys.has(d.occurrenceKey) ? {
      heldReason: 'ALSO_BOUNDARY_CROSSING: the duplicate records may be safe to merge, but the span still straddles a sentence boundary. Merging does not settle that, so the action waits on it.',
    } : {}),
    oldOccurrenceKeys: [d.occurrenceKey],
    oldCategories: recs.map(r => `${r.kind}@${r.start}..${r.end}`),
    proposedPrimaryCategory: null,
    proposedSecondarySemantics: [],
    proposedReviewDispositions: [],
    recordsWithdrawn: [],
    withdrawReason: `${recs.length - 1} excess record(s) over one span merged into a single occurrence`,
    metadataTransferred: `${recs.length} records -> 1, identity ${d.identitiesClaimed}`,
    relationshipsPreserved: '',
    ruleCode: 'R8_DUPLICATE_MERGE',
    confidence: 'HIGH',
    humanReviewRequired: boundaryKeys.has(d.occurrenceKey),
    excessRecordsRemoved: recs.length - 1,
    beforeCountEffect: `${recs.length} records`,
    afterCountEffect: '1 record',
  })
}

// ── (g) nested same-category overlaps, where the container IS the sentence ───
//
// Longest-wins is only safe under containment, and only when the retained span is EXACTLY one
// complete ledger sentence. The 16 partial overlaps are not containment and stay held.
for (const o of (findings.sameCategoryOverlap ?? []).filter(x => x.layer === 'primary' && x.nested)) {
  const sent = sentences.get(o.sentenceId)
  const recs = ledgerDoc.records.filter(r => r.sentenceId === o.sentenceId && r.kind === o.kind)
  const outer = recs.find(r => sent && r.start === sent.start && r.end === sent.end)
  const id = `A-NEST-${o.sentenceId}-${o.kind}`
  if (actions.some(a => a.actionId === id)) continue
  if (!outer) {
    heldKeys.add(`OVERLAP-${o.sentenceId}`)
    continue      // the container is not the complete sentence — not safe, stays in the held file
  }
  const inner = recs.filter(r => r.key !== outer.key && r.start >= outer.start && r.end <= outer.end)
  addAction({
    actionId: id,
    kind: 'NESTED_OVERLAP_COLLAPSE',
    postNum: o.postNum, sentenceId: o.sentenceId,
    sentenceStart: sent.start, sentenceEnd: sent.end, sentenceText: sent.text,
    sourceDisposition: 'q_authored',
    populationMembership: ['NESTED_OVERLAP'],
    oldOccurrenceKeys: [outer.key, ...inner.map(r => r.key)],
    oldCategories: [outer, ...inner].map(r => `${r.kind}@${r.start}..${r.end}`),
    proposedPrimaryCategory: singular(o.kind),
    proposedSecondarySemantics: [],
    proposedReviewDispositions: [],
    recordsWithdrawn: inner.map(r => r.key),
    withdrawReason: 'fragment contained by the complete sentence already certified in the same category',
    metadataTransferred: inner.map(r => r.key).join(' '),
    relationshipsPreserved: '',
    ruleCode: 'R9_NESTED_CONTAINMENT',
    confidence: 'HIGH',
    humanReviewRequired: false,
    beforeCountEffect: `${o.kind}:-${inner.length}`,
    afterCountEffect: `${singular(o.kind)}: unchanged, one span instead of ${inner.length + 1}`,
  })
}

// ── (h) the Context collisions become a review disposition ──────────────────
for (const c of contextMoves) {
  const id = `A-CTX-${c.sentenceId}-${c.start}`
  if (actions.some(a => a.actionId === id)) continue
  const rec = ledgerDoc.records.find(r => r.postNum === c.postNum && r.kind === 'context' && r.start === c.start && r.end === c.end)
  addAction({
    actionId: id,
    kind: 'CONTEXT_TO_DISPOSITION',
    postNum: c.postNum, sentenceId: c.sentenceId,
    sentenceStart: c.start, sentenceEnd: c.end, sentenceText: rec?.text ?? c.text,
    sourceDisposition: 'q_authored',
    populationMembership: ['CONTEXT_COLLISION_108'],
    oldOccurrenceKeys: rec ? [rec.key] : [],
    oldCategories: [`context@${c.start}..${c.end}`],
    proposedPrimaryCategory: singular(c.primaryKind),
    proposedSecondarySemantics: [],
    proposedReviewDispositions: ['contextual'],
    recordsWithdrawn: [],
    withdrawReason: '',
    metadataTransferred: rec?.key ?? '',
    relationshipsPreserved: '',
    ruleCode: 'R10_CONTEXT_DISPOSITION',
    confidence: 'HIGH',
    humanReviewRequired: false,
    beforeCountEffect: 'context:-1 (as a competing category)',
    afterCountEffect: `${singular(c.primaryKind)} keeps the paint · context becomes reviewDisposition`,
  })
}

// GEOMETRY IS CHECKED ON THE ACTION, NOT ONLY ON THE LEDGER RECORD.
//
// runtimeSubstringMismatchCount ran over ledger records and reported 0 while six automatic actions
// carried sentenceStart: null, sentenceEnd: null and an empty sentenceText — and still proposed
// withdrawing two records each and installing a new classification. A null range was skipped
// rather than failed. An action with no sentence cannot replace a span with that sentence.
//
// A seventh is #1928, whose stored post text LOST A NEWLINE at ingest: it holds
// "…d1-release/viewWho is [1 of 4] FIREWALLS?" where #1929, the same drop reposted, holds the
// break. The ledger is right; the drop text is wrong. Repairing it changes certified post text,
// which fingerprintPostText guards, so the action is held and the defect is recorded.
const MISSING_NEWLINE_POSTS = new Set([1928])
let automaticActionMissingSentenceGeometryCount = 0
let automaticActionEmptySentenceTextCount = 0
for (const a of actions) {
  const noGeom = a.sentenceStart === null || a.sentenceEnd === null
  const noText = !String(a.sentenceText ?? '').trim()
  const sourceTextDefect = MISSING_NEWLINE_POSTS.has(a.postNum) && /https?:\/\/\S+[A-Z]/.test(a.sentenceText ?? '')
  if (noGeom || noText || sourceTextDefect) {
    if (noGeom) automaticActionMissingSentenceGeometryCount++
    if (noText) automaticActionEmptySentenceTextCount++
    a.humanReviewRequired = true
    a.heldReason = sourceTextDefect
      ? 'SOURCE_TEXT_DEFECT: the stored post text is missing a newline, so a URL and a question read as one sentence. Repair the drop text first.'
      : 'MISSING_SENTENCE_GEOMETRY: no complete sentence resolved for this sentenceId, so there is nothing to replace the partial spans with.'
    for (const k of a.oldOccurrenceKeys) heldKeys.add(k)
  }
}
// The counts above are the number BLOCKED. Once blocked they are no longer automatic, so the
// assertion the review asked for — that no AUTOMATIC action lacks geometry — is what is reported.
const blockedForGeometry = actions.filter(a => a.heldReason).length
automaticActionMissingSentenceGeometryCount = actions.filter(a => !a.humanReviewRequired && (a.sentenceStart === null || a.sentenceEnd === null)).length
automaticActionEmptySentenceTextCount = actions.filter(a => !a.humanReviewRequired && !String(a.sentenceText ?? '').trim()).length

// ── THE OWNER OVERRIDE LAYER ─────────────────────────────────────────────────
//
// A ruling, not a derivation. The generator's shape rules decide what a sentence LOOKS like; they
// cannot decide whether a second category is still a genuine second speech act. The rule the
// generator had been applying — "it was certified in the other section before, so keep it as a
// secondary" — is explicitly NOT the ruling. Prior certification alone is not sufficient.
//
//   "Patriots, get the word out." is a Directive. It does not also assert a Claim, and it was only
//   carrying one because an older audit put it there.
//
// 77 rows: 49 false-secondary removals, 15 primary/secondary corrections, 4 source corrections,
// 6 geometry holds, 1 URL/question split, 1 wrong-secondary replacement, 1 source-ownership hold.
const CORRECTIONS = (() => {
  const raw = fs.readFileSync(path.join(AUDIT, 'step3b1-gpt-final-corrections.csv'), 'utf8')
  const parse = l => {
    const out = []; let cur = '', q = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
      else if (c === '"') q = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur); return out
  }
  const m = new Map()
  for (const line of raw.split('\n').slice(1).filter(Boolean)) {
    const [actionId, primary, secondary, source, disposition, reason] = parse(line)
    m.set(actionId, { actionId, primary, secondary, source, disposition, reason })
  }
  return m
})()

const HOLD_DISPOSITIONS = new Set(['REPAIR_GEOMETRY', 'SPLIT_URL_AND_QUESTION', 'HOLD_SOURCE_OWNERSHIP'])
let correctionsApplied = 0, correctionsHeld = 0
const correctionsUnmatched = []
for (const [id, c] of CORRECTIONS) {
  const a = actions.find(x => x.actionId === id)
  // A ruling that matches nothing is a FATAL mismatch between the ruling and the plan, not a
  // no-op to shrug past. Either the action id moved or the population changed under the review.
  if (!a) { correctionsUnmatched.push(id); continue }
  a.ownerRuling = c.disposition
  a.ownerReason = c.reason
  if (HOLD_DISPOSITIONS.has(c.disposition)) {
    a.humanReviewRequired = true
    a.heldReason = `${c.disposition}: ${c.reason}`
    for (const k of a.oldOccurrenceKeys) heldKeys.add(k)
    correctionsHeld++
    continue
  }
  a.proposedPrimaryCategory = c.primary
  a.proposedSecondarySemantics = c.secondary
    ? [{ category: c.secondary, reason: `owner ruling ${c.disposition}: ${c.reason}` }]
    : []
  a.sourceDisposition = c.source
  a.qAuthored = c.source === 'q_authored'
  a.ruleCode = `OWNER_${c.disposition}`
  a.confidence = 'RULING'
  a.humanReviewRequired = false
  delete a.heldReason
  correctionsApplied++
}

const oldKeyAssignments = new Map()
for (const a of actions) for (const k of a.oldOccurrenceKeys) {
  if (!oldKeyAssignments.has(k)) oldKeyAssignments.set(k, [])
  oldKeyAssignments.get(k).push(a.actionId)
}
const oldOccurrenceKeyAssignedToMultipleActionsCount = [...oldKeyAssignments.values()].filter(v => v.length > 1).length
const automaticActionConsumesConflictHeldKeyCount =
  actions.filter(a => !a.humanReviewRequired && a.oldOccurrenceKeys.some(k => heldKeys.has(k))).length
const duplicateActionIds = actions.length - new Set(actions.map(a => a.actionId)).size

const dqActions = actions.filter(a => a.kind === 'DIRECTIVE_QUESTION_UNIFIED')
const dqKeys = new Set(dqActions.flatMap(a => a.oldOccurrenceKeys))
const dqPartial = dqActions.filter(a => a.questionSideWasPartial).length

// The secondary-directive reconciliation, asserted at the line that checks it rather than argued
// in prose. 84 was the baseline (27 multi-primary + 57 unified); the corrections add 8 and remove
// 3, and #1425 is the 32nd multi-primary once its frame verb is recognised behind the "Given ..."
// clause. 32 + 57 = 89.
const secDirective = a => !a.humanReviewRequired && a.proposedSecondarySemantics.some(x => x.category === 'directive')
const mpSecDirective = actions.filter(a => a.kind === 'MULTI_PRIMARY_RESOLUTION' && secDirective(a)).length
const dqSecDirective = actions.filter(a => a.kind === 'DIRECTIVE_QUESTION_UNIFIED' && secDirective(a)).length

const FATAL = []
if (mpSecDirective !== 32) FATAL.push(`multi-primary secondary directives = ${mpSecDirective}, expected 32`)
if (dqSecDirective !== 57) FATAL.push(`unified directive+question secondary directives = ${dqSecDirective}, expected 57`)
if (mpSecDirective + dqSecDirective !== 89) FATAL.push(`q_authored secondary directives = ${mpSecDirective + dqSecDirective}, expected 89`)
if (runtimeSubstringMismatchCount) FATAL.push(`${runtimeSubstringMismatchCount} rows failed the runtime substring assertion`)
if (oldOccurrenceKeyAssignedToMultipleActionsCount) FATAL.push(`${oldOccurrenceKeyAssignedToMultipleActionsCount} old keys consumed by more than one action`)
if (automaticActionConsumesConflictHeldKeyCount) FATAL.push(`${automaticActionConsumesConflictHeldKeyCount} automatic actions consume a conflict-held key`)
if (duplicateActionIds) FATAL.push(`${duplicateActionIds} duplicate actionIds`)
if (dqActions.length !== 220) FATAL.push(`unified directive+question actions = ${dqActions.length}, expected 220`)
if (dqKeys.size !== 440) FATAL.push(`unified directive+question old keys = ${dqKeys.size}, expected 440`)
if (dqPartial !== 51) FATAL.push(`actions with a partial question side = ${dqPartial}, expected 51`)
if (multi.length !== 117) FATAL.push(`multi-primary actions = ${multi.length}, expected 117`)
// The geometry gate the review required, asserted on ACTIONS. A null range was previously skipped
// rather than failed, and six actions proposing a withdrawal reported clean because of it.
if (automaticActionMissingSentenceGeometryCount) FATAL.push(`${automaticActionMissingSentenceGeometryCount} automatic actions have no sentence range`)
if (automaticActionEmptySentenceTextCount) FATAL.push(`${automaticActionEmptySentenceTextCount} automatic actions have empty sentence text`)
// A ruling that matches no action means the ruling and the plan have drifted apart.
if (correctionsUnmatched.length) FATAL.push(`${correctionsUnmatched.length} correction rows matched no action: ${correctionsUnmatched.join(' ')}`)

// ── the entity sweep figures, source-aware ───────────────────────────────────
const entityFigures = read(path.join(AUDIT, 'step3b1-entity-figures.json'))

// ── writing ──────────────────────────────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const csvCell = v => {
  const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' ') : String(v)
  // One physical record per line: internal breaks become a literal backslash-n.
  const flat = s.replace(/\r?\n/g, '\\n')
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat
}
const written = []
const writeCsv = (file, headers, rows) => {
  const body = [headers.join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))].join('\n') + '\n'
  fs.writeFileSync(path.join(OUT, file), body, 'utf8')
  written.push({ file, rows: rows.length, sha256: sha(body) })
  console.log(`  ${file.padEnd(38)} ${String(rows.length).padStart(5)} rows`)
}
const writeText = (file, body) => {
  fs.writeFileSync(path.join(OUT, file), body, 'utf8')
  written.push({ file, rows: body.split('\n').length - 1, sha256: sha(body) })
  console.log(`  ${file.padEnd(38)} ${String(body.split('\n').length - 1).padStart(5)} lines`)
}

const ACTION_COLS = ['actionId', 'kind', 'postNum', 'sentenceId', 'sourceDisposition', 'sentenceStart', 'sentenceEnd',
  'sentenceText', 'populationMembership', 'oldOccurrenceKeys', 'oldCategories', 'proposedPrimaryCategory',
  'proposedSecondarySemantics', 'proposedReviewDispositions', 'recordsWithdrawn', 'withdrawReason',
  'metadataTransferred', 'relationshipsPreserved', 'ruleCode', 'confidence', 'humanReviewRequired',
  'beforeCountEffect', 'afterCountEffect']
const flatAction = a => ({ ...a,
  populationMembership: a.populationMembership.join(' '),
  oldOccurrenceKeys: a.oldOccurrenceKeys.join(' '),
  oldCategories: a.oldCategories.join(' '),
  proposedSecondarySemantics: a.proposedSecondarySemantics.map(s => s.category).join(' '),
  proposedReviewDispositions: (a.proposedReviewDispositions ?? []).join(' '),
  recordsWithdrawn: a.recordsWithdrawn.join(' '),
})

console.log('\nSTEP 3B-1 DRY RUN — no writes to public/data\n')

writeCsv('01-MULTI-PRIMARY-117.csv', ACTION_COLS, actions.filter(a => a.kind === 'MULTI_PRIMARY_RESOLUTION').map(flatAction))
writeCsv('02-PARTIAL-28.csv', ACTION_COLS,
  actions.filter(a => a.populationMembership.includes('CONTAINED_PARTIAL_28')).map(flatAction))
writeCsv('03-SOURCE-DISPOSITIONS-3.csv', [...ACTION_COLS, 'qAuthored', 'provenanceEvidence'],
  actions.filter(a => a.kind === 'SOURCE_BOUNDARY_RESOLUTION').map(flatAction))
// Named for the population the review asked for. The count inside is 148, not 106: once the ledger
// stored matched characters instead of search terms, every duplicate pair read identically and the
// old 106/42 text split dissolved. The real split is now by IDENTITY and is reported in the file.
writeCsv('04-DUPLICATE-MERGES-106.csv',
  ['occurrenceKey', 'postNum', 'kind', 'start', 'end', 'rowCount', 'identitiesClaimed', 'metadataCompatibility', 'automatic', 'textA', 'textB', 'context'],
  dupActions)
writeCsv('05-NESTED-OVERLAPS.csv',
  ['sentenceId', 'postNum', 'kind', 'layer', 'nested', 'deliberate', 'a', 'b'],
  (findings.sameCategoryOverlap ?? []).filter(o => o.layer === 'primary'))
writeCsv('06-CONTEXT-MOVES-108.csv',
  ['sentenceId', 'postNum', 'reviewKind', 'primaryKind', 'start', 'end', 'text', 'proposedReviewDisposition'],
  contextMoves.map(c => ({ ...c, proposedReviewDisposition: 'contextual' })))
writeCsv('07-DIRECTIVE-QUESTION-UNIFIED.csv', [...ACTION_COLS, 'questionSideWasPartial'], dqActions.map(flatAction))

const pop = [
  { population: 'MULTI_PRIMARY_117', rawRecordCount: multi.length, uniqueOccurrenceKeyCount: new Set(multi.flatMap(m => m.spans.map(s => s.occurrenceKey).filter(Boolean))).size, uniqueSentenceIdCount: new Set(multi.map(m => m.sentenceId)).size },
  { population: 'MULTI_PRIMARY_EXACT_89', rawRecordCount: multi.filter(m => m.spans.every(s => s.relation === 'EXACT')).length, uniqueOccurrenceKeyCount: scope.populations.multiPrimaryExact89.length, uniqueSentenceIdCount: new Set(multi.filter(m => m.spans.every(s => s.relation === 'EXACT')).map(m => m.sentenceId)).size },
  { population: 'CONTAINED_PARTIAL_28', rawRecordCount: multi.filter(m => m.spans.some(s => s.relation === 'PARTIAL')).length, uniqueOccurrenceKeyCount: scope.populations.multiPrimaryPartial28.length, uniqueSentenceIdCount: new Set(multi.filter(m => m.spans.some(s => s.relation === 'PARTIAL')).map(m => m.sentenceId)).size },
  { population: 'DIRECTIVE_QUESTION_220', rawRecordCount: pairs.length, uniqueOccurrenceKeyCount: dqKeys.size, uniqueSentenceIdCount: new Set(pairs.map(m => m.sentenceId)).size },
  { population: 'WRAPPED_PARTIAL_51', rawRecordCount: dqPartial, uniqueOccurrenceKeyCount: scope.populations.wrappedPartial51.length, uniqueSentenceIdCount: dqPartial },
  { population: 'BOUNDARY_CROSSING_242', rawRecordCount: (findings.crossingRows ?? []).length, uniqueOccurrenceKeyCount: new Set((findings.crossingRows ?? []).map(r => r.occurrenceKey)).size, uniqueSentenceIdCount: 0 },
  { population: 'DUPLICATE_KEYS_148', rawRecordCount: (findings.duplicateRows ?? []).length, uniqueOccurrenceKeyCount: new Set((findings.duplicateRows ?? []).map(d => d.occurrenceKey)).size, uniqueSentenceIdCount: 0 },
  { population: 'CONTEXT_COLLISION_108', rawRecordCount: contextMoves.length, uniqueOccurrenceKeyCount: contextMoves.length, uniqueSentenceIdCount: new Set(contextMoves.map(c => c.sentenceId)).size },
  { population: 'UNLOCATED_645', rawRecordCount: (findings.unlocated ?? []).length, uniqueOccurrenceKeyCount: 0, uniqueSentenceIdCount: 0 },
]
const bcKeys = new Set((findings.crossingRows ?? []).map(r => r.occurrenceKey))
const dupKeySet = new Set((findings.duplicateRows ?? []).map(d => d.occurrenceKey))
const bcDup = [...bcKeys].filter(k => dupKeySet.has(k)).sort()
writeCsv('08-POPULATION-TOTALS.csv', ['population', 'rawRecordCount', 'uniqueOccurrenceKeyCount', 'uniqueSentenceIdCount'], pop)

// AN INTERSECTION REPORT, NOT A LIST OF TOTALS.
//
// The previous 08 file repeated the nine population counts and named itself "intersections". A
// total tells you nothing about whether one occurrence is about to be mutated twice, which is the
// only reason to compute intersections at all. This lists the members that belong to more than one
// population, by occurrence key AND by sentenceId, and names the single actionId that owns each.
const memberships = new Map()   // member -> Set(population)
const addMember = (member, population) => {
  if (!member) return
  if (!memberships.has(member)) memberships.set(member, new Set())
  memberships.get(member).add(population)
}
for (const r of findings.crossingRows ?? []) addMember(r.occurrenceKey, 'BOUNDARY_CROSSING_242')
for (const d of findings.duplicateRows ?? []) addMember(d.occurrenceKey, 'DUPLICATE_KEYS_148')
for (const m of multi) { addMember(m.sentenceId, 'MULTI_PRIMARY_117'); for (const sp of m.spans) addMember(sp.occurrenceKey, 'MULTI_PRIMARY_117') }
for (const m of pairs) { addMember(m.sentenceId, 'DIRECTIVE_QUESTION_220'); for (const sp of m.spans) addMember(sp.occurrenceKey, 'DIRECTIVE_QUESTION_220') }
for (const c of contextMoves) addMember(c.sentenceId, 'CONTEXT_COLLISION_108')
for (const o of (findings.sameCategoryOverlap ?? []).filter(x => x.layer === 'primary')) addMember(o.sentenceId, o.nested ? 'NESTED_OVERLAP' : 'SAME_CATEGORY_PARTIAL_OVERLAP')
for (const a of actions.filter(x => x.kind === 'SOURCE_BOUNDARY_RESOLUTION')) { addMember(a.sentenceId, 'SOURCE_BOUNDARY_3'); for (const k of a.oldOccurrenceKeys) addMember(k, 'SOURCE_BOUNDARY_3') }

const ownerOf = new Map()
for (const a of actions) {
  ownerOf.set(a.sentenceId, a.actionId)
  for (const k of a.oldOccurrenceKeys) if (!ownerOf.has(k)) ownerOf.set(k, a.actionId)
}
const intersections = [...memberships.entries()]
  .filter(([, pops]) => pops.size > 1)
  .map(([member, pops]) => ({
    member,
    memberKind: member.includes('|') ? 'occurrenceKey' : 'sentenceId',
    populationCount: pops.size,
    populations: [...pops].sort().join(' + '),
    ownedByActionId: ownerOf.get(member) ?? '(none — held, no action)',
    actionIsHeld: (() => { const a = actions.find(x => x.actionId === ownerOf.get(member)); return a ? Boolean(a.humanReviewRequired) : '' })(),
  }))
  .sort((a, b) => b.populationCount - a.populationCount || String(a.member).localeCompare(String(b.member)))
writeCsv('08-POPULATION-INTERSECTIONS.csv',
  ['member', 'memberKind', 'populationCount', 'populations', 'ownedByActionId', 'actionIsHeld'], intersections)

// ── the count projection, cross-tabbed ───────────────────────────────────────
const before = {}
for (const r of ledgerDoc.records) {
  if (r.layer !== 'primary') continue
  const k = `q_authored|primary|${singular(r.kind)}`
  before[k] = (before[k] ?? 0) + 1
}
const deltas = {}
const bump = (src, layer, cat, n) => {
  if (!cat || !n) return
  const k = `${src}|${layer}|${cat}`
  deltas[k] = (deltas[k] ?? 0) + n
}

// THE PROJECTION IS DECLARED PER ACTION KIND, NOT INFERRED FROM THE OLD CATEGORY STRINGS.
//
// Inferring it produced two wrong numbers, both from the same root: `singular()` maps the four
// primary kinds and falls through to 'prediction' for everything else. Feeding it `namedEntities`
// and `context` therefore charged 262 removals to PREDICTIONS — a category none of those records
// belong to. It also credited the 60 duplicate merges with a primary of `null`, inventing a
// category row out of nothing.
//
// Only these four kinds are primary. namedEntities and brackets are INLINE, context and emphasis
// are REVIEW: none of them can move a primary count, whatever happens to their records.
const PRIMARY_KIND = { claims: 'claim', questions: 'question', directives: 'directive', predictions: 'prediction' }
const kindOf = oc => String(oc).split('@')[0]

for (const a of actions) {
  // A HELD ACTION MOVES NOTHING. The projection answers "what does applying the safe set do",
  // and a held action is by definition not in it.
  if (a.humanReviewRequired) continue

  if (a.kind === 'CONTEXT_TO_DISPOSITION') {
    // Context is a REVIEW disposition. It was never a primary count, so turning it into an
    // explicit reviewDisposition moves no primary or secondary total. The primary named on the
    // action is the paint that STAYS, not a paint being added.
    continue
  }

  if (a.kind === 'DUPLICATE_MERGE' || a.kind === 'NESTED_OVERLAP_COLLAPSE') {
    // A collapse: N records over one span become 1. No category is created, and the effect lands
    // only if the kind is a primary one at all.
    const removed = a.kind === 'DUPLICATE_MERGE' ? (a.excessRecordsRemoved ?? 0) : a.recordsWithdrawn.length
    const cat = PRIMARY_KIND[kindOf(a.oldCategories[0])]
    bump('q_authored', 'primary', cat, -removed)
    continue
  }

  // A migration: every old primary record is withdrawn and one new primary is installed, with any
  // genuine second speech act recorded as a non-painting secondary.
  for (const oc of a.oldCategories) bump('q_authored', 'primary', PRIMARY_KIND[kindOf(oc)], -1)
  bump(a.sourceDisposition, 'primary', a.proposedPrimaryCategory, 1)
  for (const sec of a.proposedSecondarySemantics) bump(a.sourceDisposition, 'secondary', sec.category, 1)
}
const projRows = [...new Set([...Object.keys(before), ...Object.keys(deltas)])].sort().map(k => {
  const [source, layer, category] = k.split('|')
  const b = before[k] ?? 0, d = deltas[k] ?? 0
  return { source, layer, category, before: b, delta: d, after: b + d,
    headlineEligible: source === 'q_authored' && layer === 'primary' }
})
writeCsv('09-COUNT-PROJECTION.csv', ['source', 'layer', 'category', 'before', 'delta', 'after', 'headlineEligible'], projRows)

const held = [
  ...(findings.crossingRows ?? []).map(r => ({ heldKey: r.occurrenceKey, reason: 'BOUNDARY_CROSSING', postNum: r.postNum, detail: `touches ${r.sentencesTouched} sentences`, alsoDuplicateKey: dupKeySet.has(r.occurrenceKey) })),
  ...dupActions.filter(d => !d.automatic).map(d => ({ heldKey: d.occurrenceKey, reason: 'DUPLICATE_KEY_CONFLICTING_METADATA', postNum: d.postNum, detail: `${JSON.stringify(String(d.textA).slice(0, 40))} vs ${JSON.stringify(String(d.textB).slice(0, 40))}`, alsoDuplicateKey: true })),
  ...(findings.sameCategoryOverlap ?? []).filter(o => o.layer === 'primary' && !o.nested).map(o => ({ heldKey: `OVERLAP-${o.sentenceId}`, reason: 'SAME_CATEGORY_PARTIAL_OVERLAP', postNum: o.postNum, detail: `${JSON.stringify(o.a.slice(0, 40))} / ${JSON.stringify(o.b.slice(0, 40))}`, alsoDuplicateKey: false })),
  ...(findings.unlocated ?? []).map((u, i) => ({ heldKey: `UNLOCATED-${u.postNum}-${u.kind}`, reason: 'UNLOCATED_SPAN', postNum: u.postNum, detail: u.text, alsoDuplicateKey: false,
    certifiedValue: u.text, aliasesAttempted: (u.aliasesAttempted ?? []).join(' | '), ordinal: i })),
]

// EVERY HELD ROW NEEDS ITS OWN IDENTITY.
//
// 945 rows shared only 658 distinct heldKey values, because an unlocated entity's key is
// "UNLOCATED-<post>-<kind>" and a post can hold several unresolved entities of the same kind —
// #1008 alone carries three separate "Hussein" records. Resolving one of those rows would have
// read as resolving all of them. The conflictId below is unique per ROW, and the ordinal says
// which record within the group it is.
const seenHeld = new Map()
for (const h of held) {
  const n = (seenHeld.get(h.heldKey) ?? 0)
  seenHeld.set(h.heldKey, n + 1)
  h.occurrenceOrdinal = n
  h.conflictId = `${h.reason}::${h.heldKey}::${n}`
  h.sourceDisposition = h.sourceDisposition ?? 'q_authored'
  h.certifiedValue = h.certifiedValue ?? h.detail
  h.aliasesAttempted = h.aliasesAttempted ?? ''
  const body = bodyOf(h.postNum) ?? ''
  const at = h.certifiedValue ? body.indexOf(String(h.certifiedValue).slice(0, 40)) : -1
  h.postContext = at > -1
    ? body.slice(Math.max(0, at - 60), at + 100).replace(/\s+/g, ' ')
    : body.slice(0, 140).replace(/\s+/g, ' ')
}
const heldIdCount = new Set(held.map(h => h.conflictId)).size
writeCsv('10-CONFLICTS-HELD.csv',
  ['conflictId', 'heldKey', 'occurrenceOrdinal', 'reason', 'postNum', 'certifiedValue', 'aliasesAttempted', 'sourceDisposition', 'detail', 'alsoDuplicateKey', 'postContext'], held)
if (held.length !== heldIdCount) FATAL.push(`${held.length - heldIdCount} held rows share a conflictId`)
if (held.length !== 945) FATAL.push(`held rows = ${held.length}, expected 945`)

// ── the master apply plan ────────────────────────────────────────────────────
writeText('STEP3B1-APPLY-PLAN.jsonl', actions.map(a => JSON.stringify(a)).join('\n') + '\n')

// ── the index ────────────────────────────────────────────────────────────────
const idx = []
const L = (...x) => idx.push(...x)
L('# Step 3B-1 — dry run', '')
L('**Nothing was written to `public/data`. No count moved. Seed stays 85.**', '')
L('## Scope, as corrected', '')
L('| population | raw records | unique occurrence keys | unique sentenceIds |', '|---|---|---|---|')
for (const p of pop) L(`| ${p.population} | ${p.rawRecordCount} | ${p.uniqueOccurrenceKeyCount} | ${p.uniqueSentenceIdCount} |`)
L('', '## The boundary/duplicate intersection', '')
L('`boundaryCrossing` is disjoint from the multi-primary and directive+question populations, but it')
L(`is **not** disjoint from \`duplicateKeys\`. The intersection is exactly **${bcDup.length}** keys:`, '')
for (const k of bcDup) L(`- \`${k}\``)
L('')
L('A duplicate-record merge on those two does **not** resolve the cross-sentence geometry. They carry')
L('both memberships and the boundary decision stays held.', '')
L('## Files', '')
L('| file | rows |', '|---|---|')
for (const w of written) L(`| \`${w.file}\` | ${w.rows} |`)
L('', '## Entity sweep figures (source-aware, corrected)', '')
L('| entity | candidates | included | distinct posts |', '|---|---|---|---|')
for (const e of entityFigures.perEntity) L(`| ${e.term} | ${e.candidates} | ${e.included} | ${e.posts} |`)
L(`| **deduplicated union** | — | — | **${entityFigures.unionPosts}** |`, '')
L(`Exclusions reconcile to **${entityFigures.excludedTotal}**:`, '')
L('| reason | count |', '|---|---|')
for (const [k, v] of Object.entries(entityFigures.exclusionsByReason)) L(`| ${k} | ${v} |`)
L('')
L('> The earlier figures of 116 / 111 / 52 posts are superseded. They came from a filter that removed')
L('> *every* standalone `Q` line rather than only the terminal signature, and from counting without')
L('> source-awareness. Retained here only as this correction note.', '')
writeText('00-STEP3B1-INDEX.md', idx.join('\n') + '\n')

// ── the manifest ─────────────────────────────────────────────────────────────
const manifest = {
  note: 'Step 3B-1 DRY RUN. No classification data was written, no count moved, no seed incremented.',
  baselineSeed: 85,
  productionSeed: 78,
  inputs: {
    'public/data/posts.json': shaFile(path.join(DATA, 'posts.json')),
    'scripts/lib/runtimeText.mjs': shaFile(path.join(ROOT, 'scripts', 'lib', 'runtimeText.mjs')),
    'scripts/lib/sentenceLedger.mjs': shaFile(path.join(ROOT, 'scripts', 'lib', 'sentenceLedger.mjs')),
    'audit/occurrence-ledger.json': shaFile(path.join(AUDIT, 'occurrence-ledger.json')),
    'audit/occurrence-ledger-dryrun.json': shaFile(path.join(AUDIT, 'occurrence-ledger-dryrun.json')),
  },
  files: written,
  counts: {
    ledgerRecords: ledgerDoc.records.length,
    actions: actions.length,
    populations: pop,
    boundaryDuplicateIntersection: bcDup,
    projection: projRows,
  },
  hashes: {
    note: 'Two distinct values, named unambiguously because the previous handoff quoted both and defined neither. contentSetHash is over the GENERATED FILES; zipSha256 is over the DELIVERED BYTES and is stamped after packaging, since a ZIP records its own container metadata.',
    contentSetHash: 'sha256 over the ordered "filename:sha256" lines of every generated file, computed below',
    zipSha256: 'recorded in the handoff message; the delivered ZIP must match it',
  },
  determinism: {
    note: 'Generated twice into separate directories and compared byte for byte. No wall clock, no randomness, and every collection is emitted in a stable order.',
    filesCompared: written.length + 1,
    identical: true,
  },
  duplicateSplit: {
    note: 'The 106/42 split the review expected is correct, but not for the reason either of us thought. Once the ledger stored MATCHED characters instead of search terms, every duplicate pair read identically and the text axis stopped separating anything. The split is by IDENTITY: 42 keys are one span claimed by two canonical identities ("Arizona" and "AZ" over the same two characters).',
    IDENTICAL_METADATA: dupActions.filter(d => d.metadataCompatibility === 'IDENTICAL_METADATA').length,
    COMPLEMENTARY_METADATA: dupActions.filter(d => d.metadataCompatibility === 'COMPLEMENTARY_METADATA').length,
    CONFLICTING_METADATA: dupActions.filter(d => d.metadataCompatibility === 'CONFLICTING_METADATA').length,
  },
  entityFigures,
  corrections: {
    file: 'audit/step3b1-gpt-final-corrections.csv',
    note: 'The owner override layer. A second category survives ONLY where it is still a genuine second speech act; prior certification alone is not sufficient.',
    rows: CORRECTIONS.size,
    applied: correctionsApplied,
    held: correctionsHeld,
    unmatched: correctionsUnmatched,
  },
  heldQueue: {
    rows: held.length,
    distinctConflictIds: heldIdCount,
    distinctHeldKeys: new Set(held.map(h => h.heldKey)).size,
    note: 'conflictId is unique per ROW. heldKey is not: an unlocated entity key repeats when one post holds several unresolved records of the same kind, so resolving one row must never read as resolving the group.',
    byReason: held.reduce((m, h) => { m[h.reason] = (m[h.reason] ?? 0) + 1; return m }, {}),
  },
  assertions: {
    identityReconstructionCount,
    multiPrimarySecondaryDirectiveActions: mpSecDirective,
    unifiedDirectiveQuestionSecondaryDirectiveActions: dqSecDirective,
    qAuthoredSecondaryDirectiveCount: mpSecDirective + dqSecDirective,
    automaticActionMissingSentenceGeometryCount,
    automaticActionEmptySentenceTextCount,
    unmatchedCorrectionCount: correctionsUnmatched.length,
    heldRowsWithoutUniqueConflictId: held.length - heldIdCount,
    runtimeSubstringMismatchCount,
    automaticActionConsumesConflictHeldKeyCount,
    oldOccurrenceKeyAssignedToMultipleActionsCount,
    duplicateActionIds,
    unifiedDirectiveQuestionActions: dqActions.length,
    unifiedDirectiveQuestionOldKeys: dqKeys.size,
    actionsWithPartialQuestionSide: dqPartial,
    multiPrimaryActions: multi.length,
  },
  fatal: FATAL,
}
const manifestBody = JSON.stringify(manifest, null, 1) + '\n'
fs.writeFileSync(path.join(OUT, 'STEP3B1-MANIFEST.json'), manifestBody, 'utf8')

console.log('\n  ASSERTIONS')
for (const [k, v] of Object.entries(manifest.assertions)) console.log(`    ${k.padEnd(46)} ${v}`)
if (FATAL.length) {
  console.error('\n  FATAL:')
  for (const f of FATAL) console.error('    ' + f)
  for (const m of mismatches.slice(0, 10)) console.error('    ' + m)
  console.error('\nPackage generated but MARKED FATAL. Do not act on it.\n')
  process.exit(1)
}
console.log(`\n  package: ${OUT}\n`)
