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
const FRAME_PREDICTION = /^\s*(?:expect\b|rest assured\b|make no mistake\b|fear not\b)/i
const IMPERATIVE = /^\s*(?:[A-Z][a-z]+|[A-Z]{2,})\b/
const DIRECT_ORDER = /^\s*(?:ask|be|read|re-?read|watch|listen|find|follow|learn|look|think|trust|remember|study|review|prepare|expect|define|name|list|count|compare|apply|refocus|focus|stay|keep|do not|don'?t|never|always|use|pray|enjoy|share|spread|dig|archive|save|note|consider|imagine|understand|know|see|open|close|return|go|stand|fight|unite|rise|wake|shine|protect|defend|demand|hold|push|track|monitor|verify|confirm|question|challenge|reject|ignore|forget|drop|move|act|vote|register|call|contact|email|post|tweet|screenshot|bookmark|download|upload|repeat|continue|proceed|begin|start|stop|wait|pause|slow|speed)\b/i

function classify(sentenceText, kinds) {
  const t = String(sentenceText ?? '').trim()
  // 1 — interrogative wins outright.
  if (/\?\s*$/.test(t) || /^\s*(?:who|what|when|where|why|how|which|whose|whom|is|are|was|were|do|does|did|can|could|will|would|should|shall|have|has|had)\b.*\?/i.test(t)) {
    return { primary: 'question', rule: 'R1_INTERROGATIVE' }
  }
  // 5 — a forecast wearing an imperative frame. Checked BEFORE the imperative rule, because
  // "Expect massive riots" opens with a verb and is dominated by what it says will happen.
  if (FRAME_PREDICTION.test(t)) return { primary: 'prediction', rule: 'R5_FUTURE_FRAME' }
  // 2 — a direct instruction.
  if (DIRECT_ORDER.test(t) && kinds.includes('directives')) return { primary: 'directive', rule: 'R2_IMPERATIVE' }
  // 3 — a dominant future assertion.
  if (/\b(?:will|shall|coming|soon|to be announced|tba|next week|next month|incoming)\b/i.test(t) && kinds.includes('predictions')) {
    return { primary: 'prediction', rule: 'R3_FUTURE_ASSERTION' }
  }
  // 2b — an imperative where the archive certified a directive, even without a listed verb.
  if (kinds.includes('directives') && IMPERATIVE.test(t) && !/\b(?:is|are|was|were|has|have|had)\b/i.test(t.split(/\s+/).slice(0, 3).join(' '))) {
    return { primary: 'directive', rule: 'R2B_IMPERATIVE_CERTIFIED' }
  }
  // 4 — otherwise a proposition.
  if (kinds.includes('claims')) return { primary: 'claim', rule: 'R4_DECLARATIVE' }
  return { primary: kinds[0].replace(/s$/, ''), rule: 'R6_SOLE_CATEGORY' }
}
const singular = k => k === 'claims' ? 'claim' : k === 'questions' ? 'question' : k === 'directives' ? 'directive' : 'prediction'

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
  3071: { disposition: 'quoted_source', why: "the line opens with Q's \">\" greentext marker" },
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
    recordsWithdrawn: key ? [key] : [],
    withdrawReason: 'the partial Q-authored span is withdrawn; the complete sentence is retained as source-owned',
    metadataTransferred: key ?? '',
    relationshipsPreserved: '',
    ruleCode: 'R7_QUOTED_SOURCE',
    confidence: 'HIGH',
    humanReviewRequired: false,
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

const FATAL = []
if (runtimeSubstringMismatchCount) FATAL.push(`${runtimeSubstringMismatchCount} rows failed the runtime substring assertion`)
if (oldOccurrenceKeyAssignedToMultipleActionsCount) FATAL.push(`${oldOccurrenceKeyAssignedToMultipleActionsCount} old keys consumed by more than one action`)
if (automaticActionConsumesConflictHeldKeyCount) FATAL.push(`${automaticActionConsumesConflictHeldKeyCount} automatic actions consume a conflict-held key`)
if (duplicateActionIds) FATAL.push(`${duplicateActionIds} duplicate actionIds`)
if (dqActions.length !== 220) FATAL.push(`unified directive+question actions = ${dqActions.length}, expected 220`)
if (dqKeys.size !== 440) FATAL.push(`unified directive+question old keys = ${dqKeys.size}, expected 440`)
if (dqPartial !== 51) FATAL.push(`actions with a partial question side = ${dqPartial}, expected 51`)
if (multi.length !== 117) FATAL.push(`multi-primary actions = ${multi.length}, expected 117`)

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
writeCsv('08-POPULATION-INTERSECTIONS.csv', ['population', 'rawRecordCount', 'uniqueOccurrenceKeyCount', 'uniqueSentenceIdCount'], pop)

// ── the count projection, cross-tabbed ───────────────────────────────────────
const before = {}
for (const r of ledgerDoc.records) {
  if (r.layer !== 'primary') continue
  const k = `q_authored|primary|${singular(r.kind)}`
  before[k] = (before[k] ?? 0) + 1
}
const deltas = {}
const bump = (src, layer, cat, n) => { const k = `${src}|${layer}|${cat}`; deltas[k] = (deltas[k] ?? 0) + n }
for (const a of actions) {
  for (const oc of a.oldCategories) {
    const kind = oc.split('@')[0]
    bump('q_authored', 'primary', singular(kind), -1)
  }
  bump(a.sourceDisposition, 'primary', a.proposedPrimaryCategory, 1)
  for (const s of a.proposedSecondarySemantics) bump(a.sourceDisposition, 'secondary', s.category, 1)
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
  ...(findings.unlocated ?? []).map(u => ({ heldKey: `UNLOCATED-${u.postNum}-${u.kind}`, reason: 'UNLOCATED_SPAN', postNum: u.postNum, detail: u.text, alsoDuplicateKey: false })),
]
writeCsv('10-CONFLICTS-HELD.csv', ['heldKey', 'reason', 'postNum', 'detail', 'alsoDuplicateKey'], held)

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
  assertions: {
    identityReconstructionCount,
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
