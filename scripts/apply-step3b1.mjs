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
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { key as metaKey } from './lib/segment.mjs'

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
const plan = planRaw.toString('utf8').trim().split('\n').map(l => JSON.parse(l))
const held = plan.filter(a => a.humanReviewRequired)
const actions = plan.filter(a => !a.humanReviewRequired).sort((a, b) => a.actionId.localeCompare(b.actionId))
if (plan.length !== 540 || actions.length !== 530 || held.length !== 10) {
  console.error(`[X] plan shape moved: ${plan.length} rows, ${actions.length} automatic, ${held.length} held`)
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
    if (prev.appliedTo?.postsSha256 === fileSha(postsPath) && prev.appliedTo?.questionsSha256 === fileSha(questionsPath)) {
      console.log(`Step 3B-1 already applied to this exact bundle — ${prev.occurrences?.length ?? 0} overlay occurrences, ${prev.actionsHeld ?? 0} held. Nothing written.`)
      process.exit(0)
    }
  } catch { /* an unreadable overlay is rebuilt from scratch below */ }
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

const aliasesOf = new Map()
for (const e of entitiesDoc.entities ?? []) {
  const forms = [e.canonical, ...(e.aliases ?? []).map(a => a.text)].filter(Boolean)
  aliasesOf.set(String(e.canonical).toLowerCase(), [...new Set(forms)])
}

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
        const forms = (aliasesOf.get(src.text.toLowerCase()) ?? []).slice().sort((a, b) => b.length - a.length)
        for (const f of forms) { const h = occurrencesOfSpan(p.text, f); if (h.length) { hits = h; break } }
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

// AN ALREADY-APPLIED ACTION STILL OWES ITS OVERLAY ROW.
//
// Run inside the chain, the arrays have just been rebuilt from the pre-ruling artifacts and every
// old key resolves. Run twice on this step's own output, none of them do — and an "already
// applied, nothing to do" path that skips the push would write an overlay with zero occurrences
// and silently delete the entire adjudication. So the previous overlay is read first and its rows
// are carried forward: the row is the adjudication, not a side effect of the edit that produced it.
const priorOverlayPath = path.join(DATA, 'semantics.json')
const priorByAction = new Map()
if (fs.existsSync(priorOverlayPath)) {
  try {
    for (const o of (JSON.parse(fs.readFileSync(priorOverlayPath, 'utf8')).occurrences ?? [])) priorByAction.set(o.actionId, o)
  } catch { /* an unreadable overlay is rebuilt from scratch, and the resolution gate will say so */ }
}
const carryForward = actionId => {
  const prior = priorByAction.get(actionId)
  if (prior) { semantics.push(prior); return true }
  problems.push(`${actionId}: no old key resolves and no prior overlay row exists — the bundle is neither pre- nor post-apply`)
  return false
}
const consumedKeys = new Map()      // old key -> actionId, proving no key is spent twice

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
    : a.kind === 'DUPLICATE_MERGE' ? []
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
    if (recs.length - 1 !== excess) {
      problems.push(`${a.actionId}: ${recs.length} records over ${k}, plan says ${excess} excess`)
      continue
    }
    // Keep the FIRST slot — the array's own order is the archive's order — and drop the rest.
    for (const r of recs.slice(1)) {
      removeRecord(a.actionId, r, 'withdrawn')
      metaTransfers.push({ actionId: a.actionId, from: k, kind: r.kind, metadata: metaFor(p, r.kind, r.certifiedValue) })
    }
    semantics.push({
      occurrenceKey: k, postNum: a.postNum, sentenceId: a.sentenceId, start: a.sentenceStart, end: a.sentenceEnd,
      text: a.sentenceText, sourceDisposition: a.sourceDisposition,
      primaryCategory: PRIMARY_KIND[recs[0].kind] ?? null, secondarySemantics: [], reviewDispositions: [],
      mergedRecords: recs.length, identity: recs[0].certifiedValue,
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
    })
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

  // MULTI_PRIMARY_RESOLUTION and DIRECTIVE_QUESTION_UNIFIED — the migration.
  //
  // One category keeps the paint over the COMPLETE sentence; every other primary record on the
  // sentence is withdrawn from the array that counts it and recorded as a non-painting secondary,
  // with its attributes carried across. The directive+question pair keeps its relationship edge:
  // build-relationships reads the secondary, not a second paint.
  const winnerKind = Object.entries(PRIMARY_KIND).find(([, v]) => v === a.proposedPrimaryCategory)?.[0]
  if (!winnerKind) { problems.push(`${a.actionId}: no kind for primary '${a.proposedPrimaryCategory}'`); continue }
  if (!sentence) { problems.push(`${a.actionId}: sentence ${a.sentenceId} not found`); continue }
  if (sentence.start !== a.sentenceStart || sentence.end !== a.sentenceEnd || sentence.text !== a.sentenceText) {
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
  step: '3B-1', planSha256: planSha, actionsApplied: actions.length - alreadyApplied.length,
  actionsAlreadyApplied: alreadyApplied.length, actionsHeld: held.length,
  heldActionIds: held.map(h => h.actionId).sort(),
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
doc.appliedTo = { postsSha256: fileSha(postsPath), questionsSha256: fileSha(questionsPath) }
fs.writeFileSync(overlayPath, stable(doc))
fs.writeFileSync(path.join(OUT, 'step3b1-metadata-transfers.json'), stable({ transfers: metaTransfers }))

console.log('Step 3B-1 applied.')
console.log(`  automatic actions   : ${actions.length}   (${alreadyApplied.length} already in place)`)
console.log(`  held, untouched     : ${held.length}`)
console.log(`  array slots removed : ${slotsRemoved}`)
console.log(`  question records    : ${questionEdits.size} patched`)
console.log(`  overlay occurrences : ${semantics.length}`)
console.log(`  metadata transfers  : ${metaTransfers.length}`)
