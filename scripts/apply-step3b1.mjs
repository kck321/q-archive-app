// STEP 3B-1 — the full-sentence replacement, applied.
//
//   node scripts/apply-step3b1.mjs --apply      write the bundle
//   node scripts/apply-step3b1.mjs --dry        report only
//
// WHAT THIS EXECUTES. audit/step3b1-plan.jsonl carries 540 adjudicated actions. 530 are
// automatic and this step applies exactly those. The other 10 are marked humanReviewRequired
// and this step REFUSES to touch them — they are the owner's queue, not the applier's.
//
// The layer model it materialises (owner ruling, 2026-08-21):
//
//   primary    exactly one adjudicated category per complete sentence
//   secondary  a genuine second speech act, recorded and NEVER painted
//   review     a disposition (contextual, source_boundary_exception), not a competing colour
//
// IDENTITY. Every action names its occurrences by key — postNum|kind|startOffset|endOffset
// against runtimeText(post.text). This step never rediscovers an occurrence by indexOf, by
// findIndex over wording, or by a truncated display string: it rebuilds the SAME binding
// build-occurrence-ledger.mjs uses, tracks which array slot each record came from, and edits
// by slot. That is the whole reason the ledger exists — see its header for the four defects
// text-identity produced in one week.
//
// WHY IT IS AN APPLY STEP IN THE CHAIN. The Firestore dump overwrites posts.json wholesale and
// apply-questions / apply-directives / apply-claims / apply-context-units rebuild those arrays
// from their own canonical artifacts — which still hold the superseded spans, because those
// artifacts are the pre-ruling adjudication. Without this step registered in lib/chainSteps.mjs
// every rebuild would silently restore 530 resolved collisions and every total would still
// reconcile. It runs after every step that writes the arrays it edits and before the steps that
// read the finished counts.
//
// IT IS DECLARATIVE, THEREFORE IDEMPOTENT. It computes the target state from the plan on every
// run rather than remembering what it did. Run it on a freshly rebuilt bundle and it removes the
// superseded spans again; run it twice on its own output and the second pass finds the work done
// and asserts the end state instead of failing.
import fs from 'node:fs'

/** Line splitter for the .jsonl artifacts. Tolerates CRLF, which git hands back on Windows. */
const LINE_BREAK = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n')
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { key as metaKey } from './lib/segment.mjs'
import { buildEntityForms } from './lib/entityForms.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const apply = process.argv.includes('--apply')

// THE PLAN IS PINNED BY CONTENT, NOT BY PATH. A plan that can be edited between review and apply
// is a plan that was never reviewed. This is the sha the owner signed off — the same value the
// dry-run manifest records for STEP3B1-APPLY-PLAN.jsonl.
const PLAN_SHA256 = '373ca06b1416b6707a111f2c3da8e751472c551f739500f76cdcc764d3128058'

const planPath = path.join(OUT, 'step3b1-plan.jsonl')
const planRaw = fs.readFileSync(planPath)
const planSha = crypto.createHash('sha256').update(planRaw).digest('hex')
if (planSha !== PLAN_SHA256) {
  console.error('\n[X] THE PLAN IS NOT THE REVIEWED PLAN — apply stopped.')
  console.error(`   expected ${PLAN_SHA256}`)
  console.error(`   found    ${planSha}`)
  process.exit(1)
}
// THE HELD ROWS COME BACK THROUGH THE SAME DOOR.
//
// audit/step3b1-held-dispositions.jsonl carries one row per held action, in the plan's own action
// schema, superseding the plan row with the same actionId. Adjudicated rows arrive with
// humanReviewRequired cleared; the ones still open keep it set and are still refused here.
// Running them through a second applier would mean a second set of gates, and the gates are the
// only reason any of this is trustworthy — so there is one code path and it is this one.
const DISPOSITIONS_SHA256 = '0df3ba934b21058af5779806eec0c6d2219d63777d85edcc48f09518646c59ce'
const dispPath = path.join(OUT, 'step3b1-held-dispositions.jsonl')
let plan = planRaw.toString('utf8').trim().split('\n').map(l => JSON.parse(l))
let dispositionsApplied = 0
let dispositionIds = null
if (fs.existsSync(dispPath)) {
  const raw = fs.readFileSync(dispPath)
  const dSha = crypto.createHash('sha256').update(raw).digest('hex')
  if (dSha !== DISPOSITIONS_SHA256) {
    console.error('\n[X] THE HELD DISPOSITIONS ARE NOT THE ADJUDICATED ONES — apply stopped.')
    console.error(`   expected ${DISPOSITIONS_SHA256}`)
    console.error(`   found    ${dSha}`)
    process.exit(1)
  }
  const disp = raw.toString('utf8').trim().split('\n').map(l => JSON.parse(l))
  const byId = new Map(disp.map(d => [d.actionId, d]))
  const planIds = new Set(plan.map(a => a.actionId))
  for (const id of byId.keys()) if (!planIds.has(id)) { console.error(`[X] disposition ${id} names no plan action`); process.exit(1) }
  plan = plan.map(a => byId.get(a.actionId) ?? a)
  dispositionsApplied = disp.filter(d => !d.humanReviewRequired).length
  dispositionIds = new Set(disp.map(d => d.actionId))
}

// PHASE B2 — boundary repairs, executed through this applier rather than a second one, so they
// inherit every gate: the runtime-substring check, the claims/claimSpans mirror, the metadata
// transfer log, the slot witness and the overlay. They ADD actions rather than superseding plan
// rows, so they carry their own actionIds.
// Each extra set is pinned by content, loaded in order, and may only ADD actions — never redefine
// a plan row. B2b exists as its own set because its actions could not be written until B2's trims
// had run: a span that crosses a sentence boundary belongs to no sentence, so the collisions it was
// hiding are invisible until it is trimmed back.
const EXTRA_ACTION_SETS = [
  { file: 'step3b1-b2-actions.jsonl',  sha256: 'c9c6c43a08291d2fed207f9ce573ecf526ed33751336c0bd86595fb647e53f00', label: 'B2 boundary repairs' },
  { file: 'step3b1-b2b-actions.jsonl', sha256: '33f26fa2d5c34c86e5e57681a9ba7613bb938e2f6fe1993e35f433fd480be6ce', label: 'B2b collisions the trims uncovered' },
]
let extraCount = 0
const extraIds = []
const extraStamp = {}
for (const set of EXTRA_ACTION_SETS) {
  const full = path.join(OUT, set.file)
  extraStamp[set.file] = null
  if (!fs.existsSync(full)) continue
  const raw = fs.readFileSync(full)
  const sha = crypto.createHash('sha256').update(raw).digest('hex')
  if (sha !== set.sha256) {
    console.error(`\n[X] ${set.label} IS NOT THE REVIEWED SET — apply stopped.`)
    console.error(`   expected ${set.sha256}`)
    console.error(`   found    ${sha}`)
    process.exit(1)
  }
  const rows = raw.toString('utf8').trim().split(LINE_BREAK).map(l => JSON.parse(l))
  const seen = new Set(plan.map(a => a.actionId))
  for (const a of rows) if (seen.has(a.actionId)) { console.error(`[X] ${set.label}: ${a.actionId} collides with an existing action`); process.exit(1) }
  plan = plan.concat(rows)
  extraCount += rows.length
  for (const a of rows) extraIds.push(a.actionId)
  extraStamp[set.file] = sha
}

const held = plan.filter(a => a.humanReviewRequired)
const actions = plan.filter(a => !a.humanReviewRequired).sort((a, b) => a.actionId.localeCompare(b.actionId))
if (plan.length !== 540 + extraCount || actions.length !== 530 + dispositionsApplied + extraCount || held.length !== 10 - dispositionsApplied) {
  console.error(`[X] plan shape moved: ${plan.length} rows, ${actions.length} automatic, ${held.length} held, ${dispositionsApplied} dispositions, ${extraCount} extra`)
  process.exit(1)
}

const postsPath = path.join(DATA, 'posts.json')
const questionsPath = path.join(DATA, 'questions.json')
const overlayPath = path.join(DATA, 'semantics.json')
const fileSha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

// RE-RUNNING ON MY OWN OUTPUT IS A NO-OP, AND IT HAS TO BE AN EXPLICIT ONE.
//
// "Withdraw the record at this key" cannot be made safe by repetition, because a legitimate repeat
// slides into the vacated offsets. #2038 is `FIGHT! FIGHT! FIGHT!` — three context units, three
// positions, and the plan withdraws the FIRST. Remove it and the second now binds to 69..75, so a
// second pass would withdraw that one too, and a third the last: exactly the collapse of legitimate
// in-post repeats this whole occurrence model was built to stop.
//
// The bundle is stamped instead. If posts.json and questions.json are byte-for-byte what the last
// run produced, this bundle is already this step's output and there is nothing to do. A Firestore
// dump or a chain rebuild changes them, the stamp stops matching, and the step runs normally.
if (fs.existsSync(overlayPath)) {
  try {
    const prev = JSON.parse(fs.readFileSync(overlayPath, 'utf8'))
    // The stamp covers the DISPOSITIONS too. Adjudicating a held row changes what this step owes
    // the bundle, so a bundle stamped before that adjudication is no longer "already applied".
    if (prev.appliedTo?.postsSha256 === fileSha(postsPath) && prev.appliedTo?.questionsSha256 === fileSha(questionsPath)
        && (prev.appliedTo?.dispositionsSha256 ?? null) === (fs.existsSync(dispPath) ? DISPOSITIONS_SHA256 : null)
        && JSON.stringify(prev.appliedTo?.extraSets ?? null) === JSON.stringify(extraStamp)) {
      console.log(`Step 3B-1 already applied to this exact bundle — ${prev.occurrences?.length ?? 0} overlay occurrences, ${prev.actionsHeld ?? 0} held. Nothing written.`)
      process.exit(0)
    }
  } catch { /* an unreadable overlay is rebuilt from scratch below */ }
}

// DATA UNCHANGED + DISPOSITIONS CHANGED = ONLY THE ADJUDICATED ROWS HAVE WORK TO DO.
//
// If posts.json and questions.json are byte-for-byte what the last run produced, every action that
// run applied is still applied — that is what byte-identical means. Re-deriving them anyway is not
// merely wasted: four CONTEXT actions would re-fire, because #2038 is `FIGHT! FIGHT! FIGHT!` and
// removing the first unit slides the second onto its offsets, so the action's withdrawal target
// resolves again and the row looks fresh. The second pass would withdraw a legitimate repeat.
//
// So when only the dispositions moved, the previous overlay is carried forward wholesale and just
// the newly adjudicated actionIds are processed.
let onlyTheseActionIds = null
if (fs.existsSync(overlayPath) && fs.existsSync(dispPath)) {
  try {
    const prev = JSON.parse(fs.readFileSync(overlayPath, 'utf8'))
    if (prev.appliedTo?.postsSha256 === fileSha(postsPath) && prev.appliedTo?.questionsSha256 === fileSha(questionsPath)
        && (prev.appliedTo?.dispositionsSha256 !== DISPOSITIONS_SHA256
            || JSON.stringify(prev.appliedTo?.extraSets ?? null) !== JSON.stringify(extraStamp))) {
      onlyTheseActionIds = new Set([...(dispositionIds ?? []), ...extraIds])
    }
  } catch { /* fall through to a full derivation */ }
}

const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'))
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'))
const entitiesDoc = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))

const LAYER = {
  claims: 'primary', predictions: 'primary', questions: 'primary', directives: 'primary',
  namedEntities: 'inline', brackets: 'inline',
  context: 'review', emphasis: 'review', themeAnchors: 'review',
}
const PRIMARY_KIND = { claims: 'claim', questions: 'question', directives: 'directive', predictions: 'prediction' }

// The same group-aware lookup the ledger uses — it has to be the same one, or the applier binds a
// record the ledger cannot see (or vice versa) and the two disagree about what an occurrence is.
const entityForms = buildEntityForms(entitiesDoc)

const postByNum = new Map(posts.map(p => [p.postNum, p]))
const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  // The same filter build-occurrence-ledger.mjs applies. It has to be the same one: this index
  // decides whether an action still has work to do, and a question already marked secondary or
  // withdrawn would otherwise keep resolving, making an applied action look fresh on every re-run.
  if (q.semanticLayer && q.semanticLayer !== 'primary') continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q)
}

// ── the occurrence index, bound exactly as build-occurrence-ledger.mjs binds it ──────────────
//
// Same sources, same order, same "Nth certified repeat binds to the Nth position" rule. The one
// addition is `origin`: the array and slot the record came from, so an edit lands on the record
// that produced the key rather than on the first slot whose text happens to match.
function spanSources(p) {
  const a = p.postAnalysis ?? {}
  const out = []
  const add = (kind, field, arr) => {
    if (!Array.isArray(arr)) return
    arr.forEach((t, i) => { if (String(t ?? '').trim()) out.push({ kind, text: String(t), origin: { field, index: i } }) })
  }
  add('claims', a.claimSpans ? 'postAnalysis.claimSpans' : 'postAnalysis.claims', a.claimSpans ?? a.claims)
  add('predictions', a.predictionSpans ? 'postAnalysis.predictionSpans' : 'postAnalysis.predictions', a.predictionSpans ?? a.predictions)
  add('directives', 'actionRequests', p.actionRequests)
  for (const q of qByPost.get(p.postNum) ?? []) {
    out.push({ kind: 'questions', text: String(q.literal ?? q.text), origin: { field: 'questions.json', id: q.id }, question: q,
      directiveWrapped: Boolean(q.directiveWrapped || q.directiveSource) })
  }
  add('namedEntities', 'postAnalysis.namedEntities', a.namedEntities)
  add('context', 'postAnalysis.contextUnits', a.contextUnits)
  add('emphasis', 'postAnalysis.emphasis', a.emphasis)
  add('themeAnchors', 'postAnalysis.themeAnchors', a.themeAnchors)
  return out
}

/** Every located record on every post, keyed by occurrenceKey. A key may hold several — that is
 *  what DUPLICATE_KEYS_148 is. */
function buildIndex() {
  const byKey = new Map()
  const sentencesByPost = new Map()
  for (const p of posts) {
    const sentences = sentencesFor(p.text, p.postNum)
    sentencesByPost.set(p.postNum, sentences)
    const body = runtimeText(p.text ?? '')
    const taken = new Map()
    for (const src of spanSources(p)) {
      let hits = occurrencesOfSpan(p.text, src.text)
      if (!hits.length && src.kind === 'namedEntities') {
        for (const f of entityForms.formsFor(src.text)) { const h = occurrencesOfSpan(p.text, f); if (h.length) { hits = h; break } }
      }
      if (!hits.length) continue
      const usedKey = `${src.kind}|${src.text}`
      const already = taken.get(usedKey) ?? 0
      const [start, end] = hits[Math.min(already, hits.length - 1)]
      taken.set(usedKey, already + 1)
      const rec = { key: `${p.postNum}|${src.kind}|${start}|${end}`, postNum: p.postNum, kind: src.kind,
        layer: LAYER[src.kind], start, end, matched: body.slice(start, end), certifiedValue: src.text,
        origin: src.origin, question: src.question }
      if (!byKey.has(rec.key)) byKey.set(rec.key, [])
      byKey.get(rec.key).push(rec)
    }
  }
  return { byKey, sentencesByPost }
}

const { byKey, sentencesByPost } = buildIndex()

// ── plan the edits ──────────────────────────────────────────────────────────────────────────
// Nothing is written while this runs. Removals are collected as (post, field, slot) so a single
// array is edited once, from the back, and no earlier removal shifts a later slot.
const removals = new Map()          // `${postNum}|${field}` -> Set(index)
const questionEdits = new Map()     // question id -> patch
const semantics = []                // the occurrence-keyed overlay Step 4 renders from
const metaTransfers = []            // every attribute moved off a withdrawn record
const problems = []
const alreadyApplied = []
const mergeDeltas = []   // duplicate merges whose measured excess differs from the plan's number

// AN ALREADY-APPLIED ACTION STILL OWES ITS OVERLAY ROW.
//
// Run inside the chain, the arrays have just been rebuilt from the pre-ruling artifacts and every
// old key resolves. Run twice on this step's own output, none of them do — and an "already
// applied, nothing to do" path that skips the push would write an overlay with zero occurrences
// and silently delete the entire adjudication. So the previous overlay is read first and its rows
// are carried forward: the row is the adjudication, not a side effect of the edit that produced it.
const priorOverlayPath = path.join(DATA, 'semantics.json')
const priorByAction = new Map()
// The transfer log is cumulative for the same reason the overlay is: a run that re-derives only
// the newly adjudicated rows must not drop the proof recorded for the 530 it carried forward.
const priorTransfersPath = path.join(OUT, 'step3b1-metadata-transfers.json')
const priorTransfers = fs.existsSync(priorTransfersPath)
  ? (() => { try { return JSON.parse(fs.readFileSync(priorTransfersPath, 'utf8')).transfers ?? [] } catch { return [] } })()
  : []
if (fs.existsSync(priorOverlayPath)) {
  try {
    // AN ACTION CAN OWN MORE THAN ONE OVERLAY ROW. #34's clause partition owns two, one per clause,
    // and a Map that keeps the last row per actionId silently drops the claim half on carry-forward.
    for (const o of (JSON.parse(fs.readFileSync(priorOverlayPath, 'utf8')).occurrences ?? [])) {
      if (!priorByAction.has(o.actionId)) priorByAction.set(o.actionId, [])
      priorByAction.get(o.actionId).push(o)
    }
  } catch { /* an unreadable overlay is rebuilt from scratch, and the resolution gate will say so */ }
}
const carryForward = actionId => {
  const prior = priorByAction.get(actionId)
  if (prior?.length) {
    for (const row of prior) semantics.push(row)
    for (const t of priorTransfers) if (t.actionId === actionId) metaTransfers.push(t)
    return true
  }
  problems.push(`${actionId}: no old key resolves and no prior overlay row exists — the bundle is neither pre- nor post-apply`)
  return false
}
const consumedKeys = new Map()      // old key -> actionId, proving no key is spent twice

// SLOT REMOVAL NEEDS A WITNESS, NOT A STAMP.
//
// The bundle stamp makes a re-run on this step's own output a no-op, but it cannot help when the
// bundle is PARTIALLY rebuilt — run apply-entities.mjs alone and posts.json changes while
// contextUnits does not, so the stamp misses and the removal families re-derive. That is unsafe for
// exactly one reason: #2038 is `FIGHT! FIGHT! FIGHT!`, three units over three positions, and the
// plan withdraws the first. Once it is gone the SECOND unit binds to the vacated offsets, the
// action's target resolves again, and a second pass withdraws a legitimate repeat. Measured: four
// posts, four context units silently lost.
//
// So these families carry a witness — how many entries with this exact text the field should hold
// once the action has run. The count is a property of the data, not of a file hash, so it is right
// on a full rebuild, a partial one, and a bare re-run alike.
const slotCount = (p, field, text) => {
  const name = field.split('.').pop()
  const holder = field.startsWith('postAnalysis') ? p.postAnalysis : p
  const arr = holder?.[name]
  return Array.isArray(arr) ? arr.filter(x => String(x) === String(text)).length : 0
}

// WITHDRAWAL HAS TWO SHAPES, BECAUSE THE TWO STORES DO.
//
// postAnalysis arrays and actionRequests hold bare strings — a record there has no identity of its
// own, so withdrawing it means removing the slot. questions.json holds identified records with an
// id, a semanticFunction, a grammaticalForm, an infographId and relationship edges pointing at
// them; removing one to move a count would destroy all of that. Those are MARKED instead, and the
// ledger stops counting a marked record as primary.
//
// Routing this through one function is not tidiness. The first version of this step called
// markRemoval() for question records too, and `p['json']` is not an array, so sixteen same-category
// question fragments were silently left painted while the run reported success.
// CLAIMS AND CLAIMSPANS ARE ONE SECTION IN TWO VIEWS, AND THEY MOVE TOGETHER.
//
// apply-claims.mjs writes both from the same ordered rows: `claims` is the certified wording,
// `claimSpans` is the literal form the renderer paints, and slot i of one is slot i of the other —
// 8,912 pairs, index-aligned, zero exceptions. postHighlight.tsx paints `claimSpans ?? claims`
// while contracts.mjs counts `claims`, so editing only the array the ledger happens to prefer
// leaves the count asserting 8,912 while the screen paints 8,820. A number that disagrees with the
// pixels is the failure this archive's whole certification process exists to prevent.
const MIRROR = {
  'postAnalysis.claimSpans': 'claims', 'postAnalysis.claims': 'claimSpans',
  'postAnalysis.predictionSpans': 'predictions', 'postAnalysis.predictions': 'predictionSpans',
}
// impliedConclusions and verificationHooks are attribute-filtered subsets of the same wording, so a
// withdrawn claim has to leave those too or it keeps being counted somewhere it is no longer paint.
const DERIVED_FROM_CLAIMS = ['impliedConclusions', 'verificationHooks']

const removeRecord = (actionId, rec, layerAfter) => {
  if (rec.origin.field === 'questions.json') {
    questionEdits.set(rec.origin.id, { ...(questionEdits.get(rec.origin.id) ?? {}),
      semanticLayer: layerAfter, step3b1ActionId: actionId })
    return
  }
  const k = `${rec.postNum}|${rec.origin.field}`
  if (!removals.has(k)) removals.set(k, new Set())
  removals.get(k).add(rec.origin.index)
}

/** The certified attributes hanging off a record, so a withdrawal can be shown to have moved
 *  them rather than dropped them. */
function metaFor(p, kind, text) {
  const out = {}
  const k = metaKey(text)
  if (kind === 'claims' || kind === 'predictions') { if (p.claimMeta?.[k]) out.claimMeta = p.claimMeta[k] }
  if (kind === 'directives') {
    if (p.directiveMeta?.[k]) out.directiveMeta = p.directiveMeta[k]
    if (p.directiveFamilies?.[k]) out.directiveFamilies = p.directiveFamilies[k]
  }
  return out
}

for (const a of actions) {
  if (onlyTheseActionIds && !onlyTheseActionIds.has(a.actionId)) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
  const p = postByNum.get(a.postNum)
  if (!p) { problems.push(`${a.actionId}: post #${a.postNum} not found`); continue }
  const sentences = sentencesByPost.get(a.postNum) ?? []
  const sentence = sentences.find(s => s.sentenceId === a.sentenceId)

  // Every old key this action is allowed to spend, and proof it is the only one spending it.
  const resolve = k => byKey.get(k) ?? []
  for (const k of a.oldOccurrenceKeys ?? []) {
    const prior = consumedKeys.get(k)
    if (prior && prior !== a.actionId) problems.push(`${a.actionId}: old key ${k} already consumed by ${prior}`)
    consumedKeys.set(k, a.actionId)
  }

  // A KEY THAT DOES NOT RESOLVE IS EITHER "ALREADY APPLIED" OR A DEFECT, AND NEVER A SHRUG.
  //
  // Measured against the keys the action REMOVES, not against all of its old keys. The winning
  // record usually keeps the key it already had — an EXACT winner is not widened, so it is still
  // there afterwards — and testing every old key would read a correctly applied bundle as
  // half-finished. On a freshly rebuilt bundle every removal key resolves; on this step's own
  // output none of them do; anything in between means the bundle is not the state the plan was
  // adjudicated against, and continuing would apply half an action.
  const winnerKindFor = Object.entries(PRIMARY_KIND).find(([, v]) => v === a.proposedPrimaryCategory)?.[0]
  const removalKeys =
    a.kind === 'CONTEXT_TO_DISPOSITION' ? [a.oldOccurrenceKeys[0]]
    : a.kind === 'NESTED_OVERLAP_COLLAPSE' || a.kind === 'SOURCE_BOUNDARY_RESOLUTION' ? (a.recordsWithdrawn ?? [])
    : a.kind === 'DUPLICATE_MERGE' || a.kind === 'CLAUSE_PARTITION' ? []
    : a.kind === 'WITHDRAW_RECORD' ? (a.recordsWithdrawn ?? [])
    : a.kind === 'SPAN_TRIM' ? (a.oldOccurrenceKeys ?? [])
    : a.sourceDisposition !== 'q_authored' ? (a.oldOccurrenceKeys ?? [])
    : (a.oldOccurrenceKeys ?? []).filter(k => k.split('|')[1] !== winnerKindFor)
  const stillThere = removalKeys.filter(k => resolve(k).length).length
  if (removalKeys.length && stillThere === 0) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
  if (stillThere && stillThere !== removalKeys.length) {
    problems.push(`${a.actionId}: ${stillThere}/${removalKeys.length} withdrawal targets resolve — partial state`)
    continue
  }

  if (a.kind === 'DUPLICATE_MERGE') {
    const k = a.oldOccurrenceKeys[0]
    const recs = resolve(k)
    const excess = a.excessRecordsRemoved ?? 0
    if (recs.length <= 1) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }

    // MERGE WITHIN AN IDENTITY, NEVER ACROSS ONE.
    //
    // Two records over one span are the same occurrence only if they are the same THING. #2844 and
    // #3325 both write "Renegade" once and carry three records over it — "Renegade" twice and
    // "Hussein" once — and all three resolve to the canonical Barack Obama, so all three are one
    // occurrence. But a span claimed by two DIFFERENT canonical identities is the
    // TWO_IDENTITIES_ONE_SPAN conflict, and collapsing that would destroy a legitimate record to
    // tidy a count. So records are grouped by canonical identity, merged inside each group, and one
    // survivor is left per group for the conflict queue to rule on.
    //
    // The plan's excessRecordsRemoved was computed when the entity lookup could not reach
    // alias-valued identities at all, so it can be short. The difference is REPORTED, never
    // silently absorbed.
    const groupKey = r => (r.kind === 'namedEntities' ? (entityForms.canonicalFor(r.certifiedValue) ?? r.certifiedValue) : r.certifiedValue)
    const groups = new Map()
    for (const r of recs) {
      const g = groupKey(r)
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g).push(r)
    }
    const toDrop = [...groups.values()].flatMap(g => g.slice(1))
    if (toDrop.length !== excess) {
      mergeDeltas.push({ actionId: a.actionId, occurrenceKey: k, planExcess: excess,
        measuredExcess: toDrop.length, identityGroups: [...groups.keys()],
        why: groups.size > 1
          ? 'the span is claimed by more than one canonical identity; only same-identity records were merged'
          : 'the repaired entity lookup reaches alias-valued identities the plan could not see' })
    }
    const priorDup = (priorByAction.get(a.actionId) ?? [])[0]
    if (priorDup?.slotWitness && slotCount(p, priorDup.slotWitness.field, priorDup.slotWitness.text) <= priorDup.slotWitness.slotsAfter) {
      alreadyApplied.push(a.actionId); carryForward(a.actionId); continue
    }
    if (!toDrop.length) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
    const dupField = recs[0].origin.field, dupText = recs[0].certifiedValue
    const dupBefore = slotCount(p, dupField, dupText)
    // Keep the FIRST slot of each group — the array's own order is the archive's order.
    for (const r of toDrop) {
      removeRecord(a.actionId, r, 'withdrawn')
      metaTransfers.push({ actionId: a.actionId, from: k, kind: r.kind, metadata: metaFor(p, r.kind, r.certifiedValue) })
    }
    semantics.push({
      occurrenceKey: k, postNum: a.postNum, sentenceId: a.sentenceId, start: a.sentenceStart, end: a.sentenceEnd,
      text: a.sentenceText, sourceDisposition: a.sourceDisposition,
      primaryCategory: PRIMARY_KIND[recs[0].kind] ?? null, secondarySemantics: [], reviewDispositions: [],
      mergedRecords: recs.length, identity: recs[0].certifiedValue,
      identityGroups: [...groups.keys()], recordsDropped: toDrop.length,
      slotWitness: { field: dupField, text: dupText, slotsBefore: dupBefore,
        slotsAfter: dupBefore - toDrop.filter(r => r.origin.field === dupField && r.certifiedValue === dupText).length },
      actionId: a.actionId, ruleCode: a.ruleCode, withdrawReason: a.withdrawReason,
    })
    continue
  }

  if (a.kind === 'NESTED_OVERLAP_COLLAPSE') {
    let removed = 0
    for (const k of a.recordsWithdrawn) {
      const recs = resolve(k)
      if (!recs.length) continue
      for (const r of recs) {
        removeRecord(a.actionId, r, 'withdrawn'); removed++
        metaTransfers.push({ actionId: a.actionId, from: k, kind: r.kind, metadata: metaFor(p, r.kind, r.certifiedValue) })
      }
    }
    if (!removed) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
    semantics.push({
      occurrenceKey: a.oldOccurrenceKeys[0], postNum: a.postNum, sentenceId: a.sentenceId,
      start: a.sentenceStart, end: a.sentenceEnd, text: a.sentenceText, sourceDisposition: a.sourceDisposition,
      primaryCategory: a.proposedPrimaryCategory, secondarySemantics: [], reviewDispositions: [],
      withdrewFragments: a.recordsWithdrawn, actionId: a.actionId, ruleCode: a.ruleCode,
      withdrawReason: a.withdrawReason,
    })
    continue
  }

  if (a.kind === 'CONTEXT_TO_DISPOSITION') {
    // Context is a REVIEW disposition, not a category. The primary paint on this sentence stays
    // exactly where it is; the context record stops competing for the same characters and becomes
    // an attribute of the occurrence. No primary count moves — the projection says so too.
    const k = a.oldOccurrenceKeys[0]
    const recs = resolve(k)
    if (!recs.length) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
    // Already applied if the field already holds the post-apply number of entries with this text.
    const priorRow = (priorByAction.get(a.actionId) ?? [])[0]
    if (priorRow?.slotWitness && slotCount(p, priorRow.slotWitness.field, priorRow.slotWitness.text) <= priorRow.slotWitness.slotsAfter) {
      alreadyApplied.push(a.actionId); carryForward(a.actionId); continue
    }
    const witnessField = recs[0].origin.field, witnessText = recs[0].certifiedValue
    const slotsBefore = slotCount(p, witnessField, witnessText)
    for (const r of recs) {
      removeRecord(a.actionId, r, 'withdrawn')
      metaTransfers.push({ actionId: a.actionId, from: k, kind: r.kind, metadata: {} })
    }
    semantics.push({
      occurrenceKey: `${a.postNum}|${a.proposedPrimaryCategory}s|${a.sentenceStart}|${a.sentenceEnd}`,
      postNum: a.postNum, sentenceId: a.sentenceId, start: a.sentenceStart, end: a.sentenceEnd,
      text: a.sentenceText, sourceDisposition: a.sourceDisposition,
      primaryCategory: a.proposedPrimaryCategory, secondarySemantics: [],
      reviewDispositions: a.proposedReviewDispositions, actionId: a.actionId, ruleCode: a.ruleCode,
      slotWitness: { field: witnessField, text: witnessText, slotsBefore, slotsAfter: slotsBefore - recs.length },
    })
    continue
  }

  if (a.kind === 'CLAUSE_PARTITION') {
    // A SENTENCE THAT DOES TWO THINGS, DIVIDED WHERE IT ACTUALLY DIVIDES.
    //
    // Owner ruling on #34: the sentence carries a completed act AND a forecast, and neither may be
    // demoted to a non-painting secondary to satisfy a one-category-per-sentence rule. Each clause
    // keeps its own category over its own disjoint span. This is the only such row in the archive,
    // and it is legal precisely because the spans do not overlap — the rule it appears to bend
    // exists to stop two categories claiming the SAME characters.
    const bodyText = runtimeText(p.text ?? '')
    let moved = 0
    for (const cl of a.clauses ?? []) {
      if (bodyText.slice(cl.start, cl.end) !== cl.text) {
        problems.push(`${a.actionId}: clause ${cl.category} ${cl.start}..${cl.end} does not match the body`); continue
      }
      const recs = resolve(cl.oldOccurrenceKey)
      if (!recs.length) continue
      for (const r of recs) {
        if (r.origin.field === 'questions.json') { problems.push(`${a.actionId}: clause partition over a question record is not supported`); continue }
        const field = r.origin.field.split('.').pop()
        const holder = field === 'actionRequests' ? p : p.postAnalysis
        const oldText = holder[field][r.origin.index]
        holder[field][r.origin.index] = cl.text
        const mirrorName = MIRROR[r.origin.field]
        const mirror = mirrorName && Array.isArray(p.postAnalysis?.[mirrorName]) && p.postAnalysis[mirrorName].length === holder[field].length
          ? p.postAnalysis[mirrorName] : null
        if (mirrorName && !mirror) problems.push(`${a.actionId}: ${r.origin.field} has no index-aligned ${mirrorName}`)
        const oldWording = mirror ? mirror[r.origin.index] : oldText
        if (mirror) mirror[r.origin.index] = cl.text
        for (const d of DERIVED_FROM_CLAIMS) {
          const list = p.postAnalysis?.[d]
          if (!Array.isArray(list)) continue
          const at = list.indexOf(oldWording)
          if (at >= 0) list[at] = cl.text
        }
        for (const [map, name] of [[p.claimMeta, 'claimMeta'], [p.directiveMeta, 'directiveMeta'], [p.directiveFamilies, 'directiveFamilies']]) {
          if (!map) continue
          const ok = metaKey(oldWording), nk = metaKey(cl.text)
          if (map[ok] !== undefined && ok !== nk) {
            map[nk] = map[ok]; delete map[ok]
            metaTransfers.push({ actionId: a.actionId, rekeyed: name, from: ok, to: nk })
          }
        }
        moved++
        metaTransfers.push({ actionId: a.actionId, from: cl.oldOccurrenceKey, kind: r.kind, metadata: metaFor(p, r.kind, r.certifiedValue) })
      }
    }
    if (!moved) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
    for (const cl of a.clauses ?? []) {
      const kindOf = Object.entries(PRIMARY_KIND).find(([, v]) => v === cl.category)?.[0]
      semantics.push({
        occurrenceKey: `${a.postNum}|${kindOf}|${cl.start}|${cl.end}`,
        postNum: a.postNum, sentenceId: a.sentenceId, start: cl.start, end: cl.end, text: cl.text,
        sourceDisposition: a.sourceDisposition, primaryCategory: cl.category,
        secondarySemantics: [], reviewDispositions: [],
        clausePartitionOf: a.sentenceId, clauseReason: cl.why,
        actionId: a.actionId, ruleCode: a.ruleCode,
        adjudication: a.adjudication, adjudicationReason: a.adjudicationReason,
      })
    }
    continue
  }

  if (a.kind === 'SOURCE_BOUNDARY_RESOLUTION') {
    // The truncated Q-authored highlight is withdrawn — shipping it would violate the
    // full-sentence rule — and the complete lifted sentence is retained as SOURCE-OWNED. It is
    // deliberately NOT written back into postAnalysis.claims: that array is the q_authored
    // total, and a pasted paragraph must never be certified as Q asserting it.
    let removed = 0
    for (const k of a.recordsWithdrawn) {
      for (const r of resolve(k)) {
        removeRecord(a.actionId, r, 'withdrawn'); removed++
        metaTransfers.push({ actionId: a.actionId, from: k, kind: r.kind, metadata: metaFor(p, r.kind, r.certifiedValue) })
      }
    }
    if (!removed) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
    // GEOMETRY COMES FROM THE SENTENCE LEDGER, NOT FROM THE PLAN'S HEADER FIELDS.
    //
    // On these rows the plan's sentenceStart/sentenceEnd are the TRUNCATED span's offsets while
    // its sentenceText is the reconstructed complete sentence — 2480..2530 is 50 characters and
    // the text is 133. Storing the pair as given would put an occurrence key on offsets whose
    // characters are not the text it claims, which is the one thing an occurrence key may never
    // do. #4310 goes further: the splitter refuses the "be removed.The recommendation" boundary
    // (no space after the period), so its real sentence is 419 characters and the plan's proposal
    // is only the first 189. The plan's wording is kept beside the measured sentence rather than
    // silently replacing or overriding it — reconciling the two is an owner ruling, not an
    // applier's decision, and it is named in the receipt.
    if (!sentence) { problems.push(`${a.actionId}: sentence ${a.sentenceId} not found`); continue }
    const body = runtimeText(p.text ?? '')
    semantics.push({
      occurrenceKey: `${a.postNum}|claims|${sentence.start}|${sentence.end}`,
      postNum: a.postNum, sentenceId: a.sentenceId, start: sentence.start, end: sentence.end,
      text: body.slice(sentence.start, sentence.end),
      ...(a.sentenceText !== body.slice(sentence.start, sentence.end) ? { planProposedText: a.sentenceText } : {}),
      sourceDisposition: a.sourceDisposition, qAuthored: false,
      primaryCategory: a.proposedPrimaryCategory, secondarySemantics: [],
      reviewDispositions: a.proposedReviewDispositions, provenanceEvidence: a.provenanceEvidence,
      withdrewFragments: a.recordsWithdrawn, actionId: a.actionId, ruleCode: a.ruleCode,
      withdrawReason: a.withdrawReason,
    })
    continue
  }

  if (a.kind === 'WITHDRAW_RECORD') {
    // Nothing to re-span to: every line the span covers is a link, a pointer or a label. The
    // record is withdrawn whole. Its wording is kept in the overlay so the withdrawal is legible.
    let removed = 0
    for (const k of a.recordsWithdrawn) {
      for (const r of resolve(k)) {
        removeRecord(a.actionId, r, 'withdrawn'); removed++
        metaTransfers.push({ actionId: a.actionId, from: k, kind: r.kind, metadata: metaFor(p, r.kind, r.certifiedValue) })
      }
    }
    if (!removed) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
    semantics.push({
      occurrenceKey: a.oldOccurrenceKeys[0], postNum: a.postNum,
      start: a.sentenceStart, end: a.sentenceEnd, text: a.sentenceText,
      sourceDisposition: a.sourceDisposition, primaryCategory: null, withdrawn: true,
      secondarySemantics: [], reviewDispositions: [],
      actionId: a.actionId, ruleCode: a.ruleCode, withdrawReason: a.withdrawReason,
      adjudication: a.adjudication, adjudicationReason: a.adjudicationReason,
    })
    continue
  }

  if (a.kind === 'SPAN_TRIM') {
    // Geometry only. The category does not move; the span stops covering the link line beside it.
    const trimBody = runtimeText(p.text ?? '')
    if (trimBody.slice(a.sentenceStart, a.sentenceEnd) !== a.sentenceText) {
      problems.push(`${a.actionId}: the trimmed span does not match the body at those offsets`); continue
    }
    let moved = 0
    for (const k of a.oldOccurrenceKeys) {
      for (const r of resolve(k)) {
        if (r.origin.field === 'questions.json') {
          questionEdits.set(r.origin.id, { ...(questionEdits.get(r.origin.id) ?? {}),
            literal: a.sentenceText, step3b1ActionId: a.actionId,
            supersededSpan: { start: r.start, end: r.end, text: r.matched } })
          moved++
          continue
        }
        const field = r.origin.field.split('.').pop()
        const holder = field === 'actionRequests' ? p : p.postAnalysis
        const oldText = holder[field][r.origin.index]
        holder[field][r.origin.index] = a.sentenceText
        const mirrorName = MIRROR[r.origin.field]
        const mirror = mirrorName && Array.isArray(p.postAnalysis?.[mirrorName]) && p.postAnalysis[mirrorName].length === holder[field].length
          ? p.postAnalysis[mirrorName] : null
        if (mirrorName && !mirror) problems.push(`${a.actionId}: ${r.origin.field} has no index-aligned ${mirrorName}`)
        if (mirror) mirror[r.origin.index] = a.sentenceText
        for (const [map, name] of [[p.claimMeta, 'claimMeta'], [p.directiveMeta, 'directiveMeta'], [p.directiveFamilies, 'directiveFamilies']]) {
          if (!map) continue
          const ok = metaKey(oldText), nk = metaKey(a.sentenceText)
          if (map[ok] !== undefined && ok !== nk) {
            map[nk] = map[ok]; delete map[ok]
            metaTransfers.push({ actionId: a.actionId, rekeyed: name, from: ok, to: nk })
          }
        }
        moved++
        metaTransfers.push({ actionId: a.actionId, from: k, kind: r.kind, metadata: metaFor(p, r.kind, r.certifiedValue) })
      }
    }
    if (!moved) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }
    semantics.push({
      occurrenceKey: `${a.postNum}|${a.oldOccurrenceKeys[0].split('|')[1]}|${a.sentenceStart}|${a.sentenceEnd}`,
      postNum: a.postNum, start: a.sentenceStart, end: a.sentenceEnd, text: a.sentenceText,
      sourceDisposition: a.sourceDisposition, primaryCategory: a.proposedPrimaryCategory,
      secondarySemantics: [], reviewDispositions: [],
      trimmedFrom: a.oldOccurrenceKeys[0], droppedLines: a.droppedLines,
      actionId: a.actionId, ruleCode: a.ruleCode,
      adjudication: a.adjudication, adjudicationReason: a.adjudicationReason,
    })
    continue
  }

  // MULTI_PRIMARY_RESOLUTION and DIRECTIVE_QUESTION_UNIFIED — the migration.
  //
  // One category keeps the paint over the COMPLETE sentence; every other primary record on the
  // sentence is withdrawn from the array that counts it and recorded as a non-painting secondary,
  // with its attributes carried across. The directive+question pair keeps its relationship edge:
  // build-relationships reads the secondary, not a second paint.
  const winnerKind = Object.entries(PRIMARY_KIND).find(([, v]) => v === a.proposedPrimaryCategory)?.[0]
  if (!winnerKind) { problems.push(`${a.actionId}: no kind for primary '${a.proposedPrimaryCategory}'`); continue }
  if (!sentence) { problems.push(`${a.actionId}: sentence ${a.sentenceId} not found`); continue }
  if (a.spanOverride) {
    // A SUB-SENTENCE TARGET, DECLARED AND CHECKED — never inferred.
    //
    // #1928 writes "…/d1-release/view" and "Who is [1 of 4] FIREWALLS?" with no separator, so the
    // splitter sees one sentence and painting it would paint the URL. The owner ruled the URL stays
    // a link. An action may therefore name a span inside its sentence, but only with a stated
    // reason, and only if the characters there are exactly the text it claims.
    const body = runtimeText(p.text ?? '')
    if (!a.spanOverrideReason) { problems.push(`${a.actionId}: spanOverride without a reason`); continue }
    if (a.sentenceStart < sentence.start || a.sentenceEnd > sentence.end) {
      problems.push(`${a.actionId}: spanOverride ${a.sentenceStart}..${a.sentenceEnd} escapes its sentence ${sentence.start}..${sentence.end}`); continue
    }
    if (body.slice(a.sentenceStart, a.sentenceEnd) !== a.sentenceText) {
      problems.push(`${a.actionId}: spanOverride text does not match the body at those offsets`); continue
    }
  } else if (sentence.start !== a.sentenceStart || sentence.end !== a.sentenceEnd || sentence.text !== a.sentenceText) {
    problems.push(`${a.actionId}: sentence geometry moved (${sentence.start}..${sentence.end} vs ${a.sentenceStart}..${a.sentenceEnd})`)
    continue
  }

  // A SENTENCE THAT IS NOT Q'S DOES NOT KEEP A Q-AUTHORED RECORD.
  //
  // Four of these are the Ephesians 6 passage Q pasted into #1432, #2904, #3593 and #3594, and two
  // more are the lifted news paragraphs. The complete sentence is still adjudicated — it is a
  // claim, and it is primary — but it is SOURCE-OWNED, and postAnalysis.claims is the array the
  // q_authored headline total is counted from. So the winner is withdrawn from that array along
  // with every loser, and the adjudication lives in semantics.json under its real disposition.
  // Leaving it in place is how pasted scripture gets certified as Q asserting it.
  const sourceOwned = a.sourceDisposition !== 'q_authored'
  const winners = sourceOwned ? [] : a.oldOccurrenceKeys.filter(k => k.split('|')[1] === winnerKind)
  const losers = sourceOwned ? a.oldOccurrenceKeys : a.oldOccurrenceKeys.filter(k => k.split('|')[1] !== winnerKind)
  const secondary = []
  const withdrawn = []
  let touched = 0

  for (const k of losers) {
    const recs = resolve(k)
    if (!recs.length) continue
    for (const r of recs) {
      const md = r.origin.field === 'questions.json' ? {} : metaFor(p, r.kind, r.certifiedValue)
      // The record that carried the winning category on a source-owned sentence is withdrawn, not
      // demoted: it is the same speech act as the primary, just not Q's to be certified with.
      const isWinnerSide = sourceOwned && r.kind === winnerKind
      removeRecord(a.actionId, r, isWinnerSide ? 'withdrawn' : 'secondary')
      if (r.origin.field === 'questions.json' && !isWinnerSide) {
        questionEdits.set(r.origin.id, { ...(questionEdits.get(r.origin.id) ?? {}),
          secondaryOf: `${a.postNum}|${winnerKind}|${a.sentenceStart}|${a.sentenceEnd}` })
      }
      touched++
      metaTransfers.push({ actionId: a.actionId, from: k, kind: r.kind, metadata: md })
      if (isWinnerSide) continue
      // A LOSER IS ONLY A SECONDARY IF THE ADJUDICATION SAYS SO.
      //
      // "It was certified in the other section before, so keep it as a secondary" is the rule the
      // dry-run generator was caught applying, and the owner overturned it: 49 of these are
      // OWNER_DROP_FALSE_SECONDARY, a category the sentence never genuinely performed. Retaining
      // them would invent 58 non-painting semantics nobody adjudicated. Where the plan declares
      // no secondary the record is withdrawn — recorded here with its reason, never dropped
      // silently.
      const declared = a.proposedSecondarySemantics.find(s => s.category === PRIMARY_KIND[r.kind])
      if (declared) {
        secondary.push({ category: PRIMARY_KIND[r.kind], fromOccurrenceKey: k,
          certifiedValue: r.certifiedValue, reason: declared.reason, metadata: md })
      } else {
        withdrawn.push({ category: PRIMARY_KIND[r.kind], fromOccurrenceKey: k,
          certifiedValue: r.certifiedValue, metadata: md,
          reason: a.withdrawReason || `${a.ruleCode}: not a genuine second speech act on this sentence` })
      }
    }
  }

  // A DECLARED SECONDARY IS AN ADJUDICATION, NOT A BY-PRODUCT OF A DEMOTION.
  //
  // Most secondaries arrive by demoting a record that already existed. A-MP-p4782-s015 does not:
  // its rule is OWNER_REPLACE_SECONDARY, the owner replaced a false claim-secondary with a
  // directive one, and no directive record was ever certified on that sentence to migrate. Deriving
  // secondaries only from records found would silently drop it — and it is one of the 89 the
  // reconciliation exists to hold at 89.
  for (const s of a.proposedSecondarySemantics ?? []) {
    if (secondary.some(x => x.category === s.category)) continue
    secondary.push({ category: s.category, reason: s.reason, ownerDeclared: true, fromOccurrenceKey: null })
  }

  // The winner is widened to the complete sentence when it was certified over a fragment.
  for (const k of winners) {
    for (const r of resolve(k)) {
      if (r.start === a.sentenceStart && r.end === a.sentenceEnd) continue   // already the full sentence
      touched++
      if (r.origin.field === 'questions.json') {
        // `literal` is the RENDERING span and `text` is the question's identity across the
        // archive. Widening `literal` moves the paint to the whole sentence without fragmenting
        // the group the question belongs to. Eight records already use this field.
        questionEdits.set(r.origin.id, { ...(questionEdits.get(r.origin.id) ?? {}),
          literal: a.sentenceText, step3b1ActionId: a.actionId,
          supersededSpan: { start: r.start, end: r.end, text: r.matched } })
      } else {
        const field = r.origin.field.split('.').pop()
        const holder = field === 'actionRequests' ? p : p.postAnalysis
        const oldText = holder[field][r.origin.index]
        holder[field][r.origin.index] = a.sentenceText
        // The parallel view moves with it, same slot — see the MIRROR note above.
        const mirrorName = MIRROR[r.origin.field]
        const mirror = mirrorName && Array.isArray(p.postAnalysis?.[mirrorName]) && p.postAnalysis[mirrorName].length === holder[field].length
          ? p.postAnalysis[mirrorName] : null
        if (mirrorName && !mirror) problems.push(`${a.actionId}: ${r.origin.field} has no index-aligned ${mirrorName} to widen with it`)
        const oldWording = mirror ? mirror[r.origin.index] : oldText
        if (mirror) mirror[r.origin.index] = a.sentenceText
        for (const d of DERIVED_FROM_CLAIMS) {
          const list = p.postAnalysis?.[d]
          if (!Array.isArray(list)) continue
          const at = list.indexOf(oldWording)
          if (at >= 0) list[at] = a.sentenceText
        }
        // claimMeta / directiveMeta are keyed by text, so a widened span has to carry its own
        // attributes to the new key or they are silently lost. This is defect #2 from the ledger
        // header, and it is the reason the key is rewritten here rather than left to be rebuilt.
        for (const [map, name] of [[p.claimMeta, 'claimMeta'], [p.directiveMeta, 'directiveMeta'], [p.directiveFamilies, 'directiveFamilies']]) {
          if (!map) continue
          const ok = metaKey(oldText), nk = metaKey(a.sentenceText)
          if (map[ok] !== undefined && ok !== nk) {
            map[nk] = map[ok]; delete map[ok]
            metaTransfers.push({ actionId: a.actionId, rekeyed: name, from: ok, to: nk })
          }
        }
      }
    }
  }

  if (!touched) { alreadyApplied.push(a.actionId); carryForward(a.actionId); continue }

  semantics.push({
    occurrenceKey: `${a.postNum}|${winnerKind}|${a.sentenceStart}|${a.sentenceEnd}`,
    postNum: a.postNum, sentenceId: a.sentenceId, start: a.sentenceStart, end: a.sentenceEnd,
    text: a.sentenceText, sourceDisposition: a.sourceDisposition,
    ...(sourceOwned ? { qAuthored: false } : {}),
    primaryCategory: a.proposedPrimaryCategory, secondarySemantics: secondary,
    ...(withdrawn.length ? { withdrawnSemantics: withdrawn } : {}),
    reviewDispositions: a.proposedReviewDispositions,
    relationshipsPreserved: a.relationshipsPreserved ? [a.relationshipsPreserved] : [],
    supersededKeys: a.recordsWithdrawn ?? [], actionId: a.actionId, ruleCode: a.ruleCode,
    ...(a.adjudication ? { adjudication: a.adjudication, adjudicationReason: a.adjudicationReason } : {}),
    ...(a.spanOverride ? { spanOverride: true, spanOverrideReason: a.spanOverrideReason } : {}),
    ...(a.intentionallyUncategorized ? { intentionallyUncategorized: a.intentionallyUncategorized } : {}),
  })
}

if (problems.length) {
  console.error(`\n[X] ${problems.length} action(s) could not be applied — nothing written.\n`)
  for (const m of problems.slice(0, 40)) console.error('   ' + m)
  process.exit(1)
}

// ── materialise ─────────────────────────────────────────────────────────────────────────────
let slotsRemoved = 0
for (const [k, idx] of removals) {
  const num = Number(k.split('|')[0])
  const field = k.split('|').slice(1).join('|')
  const p = postByNum.get(num)
  const name = field.split('.').pop()
  const holder = field.startsWith('postAnalysis') ? p.postAnalysis : p
  const arr = holder[name]
  if (!Array.isArray(arr)) continue
  const mirrorName = MIRROR[field]
  const mirror = mirrorName && Array.isArray(p.postAnalysis?.[mirrorName]) && p.postAnalysis[mirrorName].length === arr.length
    ? p.postAnalysis[mirrorName] : null
  if (mirrorName && !mirror) problems.push(`#${num}: ${field} has no index-aligned ${mirrorName} to move with it`)
  for (const i of [...idx].sort((x, y) => y - x)) {
    const wording = mirror ? mirror[i] : arr[i]
    arr.splice(i, 1); slotsRemoved++
    if (mirror) { mirror.splice(i, 1); slotsRemoved++ }
    // The attribute-filtered subsets quote the certified wording, so the withdrawn one leaves them
    // as well. Only one instance is dropped: identical wording elsewhere on the drop is a separate
    // occurrence and stays.
    if (name === 'claimSpans' || name === 'claims' || name === 'predictionSpans' || name === 'predictions') {
      for (const d of DERIVED_FROM_CLAIMS) {
        const list = p.postAnalysis?.[d]
        if (!Array.isArray(list)) continue
        const at = list.indexOf(wording)
        if (at >= 0) list.splice(at, 1)
      }
    }
  }
}
for (const q of questions) {
  const patch = questionEdits.get(q.id)
  if (patch) Object.assign(q, patch)
}

semantics.sort((a, b) => a.postNum - b.postNum || a.start - b.start || a.occurrenceKey.localeCompare(b.occurrenceKey))
const doc = {
  note: 'Step 3B-1 — the certified semantic overlay. Primary paint, non-painting secondaries and review dispositions, keyed by occurrence. Step 4 renders from this.',
  step: '3B-1', planSha256: planSha, dispositionsApplied,
  actionsApplied: actions.length - alreadyApplied.length,
  actionsAlreadyApplied: alreadyApplied.length, actionsHeld: held.length,
  heldActionIds: held.map(h => h.actionId).sort(),
  ...(mergeDeltas.length ? { duplicateMergeDeltas: mergeDeltas } : {}),
  occurrences: semantics,
}

if (!apply) {
  console.log(`DRY — ${actions.length} automatic actions, ${alreadyApplied.length} already applied, ${slotsRemoved} array slots would be removed, ${questionEdits.size} question records patched, ${semantics.length} overlay occurrences.`)
  process.exit(0)
}

const stable = o => JSON.stringify(o, null, 1)
fs.writeFileSync(postsPath, JSON.stringify(posts))
fs.writeFileSync(questionsPath, JSON.stringify(questions))
// Stamped with what it was applied TO, so the next run can tell "already done" from "do it again".
doc.appliedTo = { postsSha256: fileSha(postsPath), questionsSha256: fileSha(questionsPath),
  dispositionsSha256: fs.existsSync(dispPath) ? DISPOSITIONS_SHA256 : null,
  extraSets: extraStamp }
fs.writeFileSync(overlayPath, stable(doc))
fs.writeFileSync(path.join(OUT, 'step3b1-metadata-transfers.json'), stable({ transfers: metaTransfers }))

console.log('Step 3B-1 applied.')
console.log(`  automatic actions   : ${actions.length}   (${alreadyApplied.length} already in place)`)
console.log(`  held, untouched     : ${held.length}`)
console.log(`  array slots removed : ${slotsRemoved}`)
console.log(`  question records    : ${questionEdits.size} patched`)
console.log(`  overlay occurrences : ${semantics.length}`)
console.log(`  metadata transfers  : ${metaTransfers.length}`)
if (mergeDeltas.length) {
  console.log(`  merge deltas vs plan: ${mergeDeltas.length}`)
  for (const d of mergeDeltas) console.log(`     ${d.actionId}  plan ${d.planExcess} -> measured ${d.measuredExcess}  [${d.identityGroups.join(', ')}]`)
}
