// Apply the certified Claims dataset to production: 4,175 claim occurrences.
//
// Source of truth is audit/claims-final.json — the MATERIALISED artifact, not a re-derivation
// from post text. Re-deriving would reintroduce every judgement the three audit phases made
// (source-material exclusion, telegraphic promotion, conclusion attribution, the 720).
//
// Claims live on the post as postAnalysis.claims (exact Q spans, in-post repeats preserved)
// with a parallel claimMeta map carrying the attributes. Predictions keep their own array.
//
// Claims / Predictions / Conclusions are a connected family: every row is an assertion, and
// isPrediction / isConclusion ride on it. The two counts are reported separately because that
// is what was certified — 4,175 claims and 630 predictions.
//
// Held OUT of the Q-authored count and never displayed as Q's literal words:
//   1,277 editorial paraphrases   kept searchable with provenance
//     956 source-material units    quoted or pasted, not Q asserting
//   2,908 NEEDS_CONTEXT            ambiguous; excluded rather than guessed
//
// Idempotent: rebuilds from the artifact each run, so an export cannot silently revert it.
//
//   node scripts/apply-claims.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'
import { applyPredictionsAudit } from './lib/predictionsAudit.mjs'
import { loadAbbrevRepairs, applyAbbrevRepairs, assertAbbrevApplied } from './lib/abbrevRepairs.mjs'
import { loadQueueRulings } from './lib/queueRulings.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
// The abbreviation/sentence-boundary repair. See scripts/lib/abbrevRepairs.mjs — one defect, one
// record, one applier, shared with Context, Directives and Questions.
const abbrev = loadAbbrevRepairs(ROOT)
// The 2026-08-16 sentence-level Predictions audit is layered ON TOP of the frozen claims
// artifact, exactly as the themes and entities owner rulings are: claims-final.json is left
// untouched, and audit/predictions-audit/*.json is re-applied on every run. Re-deriving the
// claims audit therefore cannot silently erase 403 rulings.
//   630 -> 595 predictions, 4,242 -> 4,221 claims. See audit/predictions-audit/ledger.jsonl.
// Owner question rulings layer the same way and withdraw their occurrence from Claims:
//   4,221 -> 4,212 (9 quoted questions, 2026-08-19). See audit/questions-owner-rulings.json.
const frozen = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/claims-final.json'), 'utf8'))
const audited = applyPredictionsAudit(frozen)
if (audited.report.errors.length) {
  console.error('Predictions audit did not fully apply:\n' + audited.report.errors.join('\n'))
  process.exit(1)
}
const final = { ...frozen, rows: audited.rows, predictions: audited.predictions }

// AN OWNER QUESTION RULING WITHDRAWS ITS OCCURRENCE FROM CLAIMS, IN THE SAME BREATH.
//
// audit/questions-owner-rulings.json is the ONE record of a line moving into Questions. A ruling
// carrying `was: "Claim"` has to leave Claims at the moment it arrives in Questions, or the drop
// paints the sentence blue AND amber and two certified sections each count it once. Both
// materialisers reading the same file is what makes that impossible to get half-done.
//
// Layered HERE, over the frozen artifact, exactly as the predictions audit is — claims-final.json
// is left untouched, so re-deriving the claims audit can never silently restore a withdrawn row.
//
// 2026-08-19, 9 occurrences: quoted questions filed as Q assertions. #2420 x3 and #2695 x2 are
// the same drop shape (Q reports a spoken exchange); #483, #2776 x2, #3203 are quoted questions
// reproduced from source material. Rulings marked `was: "Evidence"` are NOT withdrawn here:
// Evidence is provenance, not a display category, and it does not paint in the drop body.
const questionRulings = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/questions-owner-rulings.json'), 'utf8')).rulings ?? []
const withdrawnByRuling = new Set(questionRulings.filter(r => r.was === 'Claim').map(r => `${r.postNum}|${key(r.text)}`))
const keptRows = final.rows.filter(r => !withdrawnByRuling.has(`${r.postNum}|${key(r.exactText)}`))
// Refuse rather than under-apply. A ruling that stops matching — a reworded artifact, a changed
// key() definition — would otherwise leave the line certified in BOTH sections with no error.
if (final.rows.length - keptRows.length !== withdrawnByRuling.size) {
  console.error(`Owner question rulings: ${withdrawnByRuling.size} claim occurrence(s) to withdraw, ${final.rows.length - keptRows.length} matched.`)
  process.exit(1)
}
final.rows = keptRows

// ── THE UNHIGHLIGHTED-SENTENCE QUEUE, RULED BY THE OWNER (2026-08-20 + 2026-08-24) ──
//
// lib/queueRulings.mjs reads BOTH rounds of that review. They are layered here
// rather than written into claims-final.json for the same reason the predictions audit and the
// question rulings are: the frozen artifact stays exactly as it was certified, so re-deriving the
// claims audit can neither restore a withdrawn row nor erase a ruled one.
//
// Claims and Predictions both arrive from that file. They are one family internally (every row is
// an assertion) and two sections on screen, so each ruling lands in the array its section names
// and the displayClass written below does the rest.
//
// confidence OWNER_ADJUDICATED is load-bearing, not decorative. It is what exempts a row from the
// source-material leak gate further down — the owner ruled several pasted lines to be Q's own
// assertions, and an audit artifact frozen under an older quote detector cannot overrule that —
// and it is what apply-context-units.mjs reads to withdraw the span from Context, because Context
// means "reviewed, and in no semantic category" and a ruled line is no longer that.
// ── SPANS THE OWNER MOVED BETWEEN SECTIONS (2026-08-24) ─────────────────────
//
// The queue path adds; the corrections file withdraws a queue ruling. Neither can touch a span the
// BASE artifact certified, and three rulings of 2026-08-24 do exactly that — "#2." leaves
// Directives for Claims, thirteen list rows on #1850 leave Claims for the Entities they already
// are, and #4784's opening line joins Claims. See scripts/build-owner-section-moves.mjs.
//
// `certifiedAs` is what the archive actually holds, which is not always the line the ruling names:
// the splitter cut "Patrick J. Tiberi - Republican U.S. House" at both abbreviations and Claims
// holds "Tiberi - Republican U.S.". Removing by the ruling's wording would have removed nothing and
// said it had.
const MOVES_FILE = path.join(ROOT, 'audit/owner-section-moves.json')
const sectionMoves = fs.existsSync(MOVES_FILE)
  ? JSON.parse(fs.readFileSync(MOVES_FILE, 'utf8')).moves ?? []
  : []

const queueRulings = loadQueueRulings(ROOT)
//
// INSERTION IS OCCURRENCE-AWARE, NOT KEY-AWARE. Q writes "Fantasy land." four times in #111 and
// the queue carries four rows for it, because the audit emitted one row per UNIT. Deduplicating by
// (post, key) would certify one of the four and silently drop three real occurrences — the same
// mistake every other layer here has already made once. What is added is the SHORTFALL: how many
// times the owner ruled it, less how many the artifact already holds.
const stats2020 = { claimsAdded: 0, claimsAlready: 0, predsAdded: 0, predsAlready: 0 }
const haveCount = new Map()
for (const x of final.rows) { const k = `claims|${x.postNum}|${key(x.exactText)}`; haveCount.set(k, (haveCount.get(k) ?? 0) + 1) }
for (const x of final.predictions) { const k = `predictions|${x.postNum}|${key(x.exactText)}`; haveCount.set(k, (haveCount.get(k) ?? 0) + 1) }
const emitted = new Map()
for (const r of queueRulings) {
  if (r.section !== 'claims' && r.section !== 'predictions') continue
  const k = `${r.section}|${r.postNum}|${key(r.sourceText)}`
  const already = haveCount.get(k) ?? 0
  const done = emitted.get(k) ?? 0
  if (done < already) {
    emitted.set(k, done + 1)
    if (r.section === 'predictions') stats2020.predsAlready++; else stats2020.claimsAlready++
    continue
  }
  emitted.set(k, done + 1)
  const row = {
    postNum: r.postNum,
    postId: r.postId,
    exactText: r.sourceText,
    primaryClass: r.section === 'predictions' ? 'prediction' : 'claim',
    isPrediction: r.section === 'predictions',
    isConclusion: false,
    // Attributes are NOT invented. The owner ruled the section; nothing in the review says an
    // assertion is checkable or carries its source, so those stay false rather than being
    // guessed into two certified counts that already have a meaning.
    checkable: false,
    sourceProvided: false,
    telegraphic: r.section === 'claims' && r.sourceText.split(/\s+/).filter(Boolean).length <= 4,
    confidence: 'OWNER_ADJUDICATED',
    provenance: `owner ruling ${r.ruledOn} — unhighlighted-sentence queue`,
  }
  if (r.section === 'predictions') { final.predictions.push(row); stats2020.predsAdded++ }
  else { final.rows.push(row); stats2020.claimsAdded++ }
}
// A LINE MAY NOT BE BOTH. The two arrays are separate sections on screen, and a ruling that landed
// in one while an earlier certification held the same occurrence in the other would paint amber
// and violet at once and be counted twice. Predictions win where the owner ruled Predictions.
const ruledPrediction = new Set(queueRulings.filter(r => r.section === 'predictions').map(r => `${r.postNum}|${key(r.sourceText)}`))
const beforeCrossPull = final.rows.length
final.rows = final.rows.filter(r => !ruledPrediction.has(`${r.postNum}|${key(r.exactText)}`))
const crossPulled = beforeCrossPull - final.rows.length

const ph3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/claims-adjudicated.json'), 'utf8'))
const v2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/claims-audit.json'), 'utf8'))

const flat = t => clean(t).replace(/\s+/g, ' ').trim()

// ── Abbreviation/sentence-boundary repair, ON THE ROWS ──────────────────────
//
// Applied to final.rows BEFORE anything is grouped or keyed, because claimMeta is keyed by
// key(exactText): repairing p.postAnalysis.claims afterwards left all 64 repaired claims pointing
// at a metadata key that no longer existed, and every attribute on them — checkable,
// sourceProvided, isConclusion — silently stopped resolving. build-relationships caught it as one
// missing Claim-Source-provided edge, which is a very quiet way to lose 64 rows' attributes.
//
// Both operations run together: the truncated span is replaced by the full one, and the tail the
// same splitter certified separately is dropped, because the repaired span now contains it.
let abbrevRepaired = 0, abbrevAbsorbed = 0
if (abbrev) {
  const kept = []
  for (const r of final.rows) {
    if (abbrev.isWithdrawn('claims', r.postNum, r.exactText)) { abbrevAbsorbed++; continue }
    const full = abbrev.fullFor('claims', r.postNum, r.exactText)
    if (full && full !== r.exactText) { r.exactText = full; abbrevRepaired++ }
    kept.push(r)
  }
  final.rows = kept
  assertAbbrevApplied(abbrev, 'claims', { repaired: abbrevRepaired, withdrawn: abbrevAbsorbed }, 'apply-claims.mjs')
  console.log(`
  abbreviation repair: ${abbrevRepaired} claim spans repaired, ${abbrevAbsorbed} fragments absorbed`)
}

// ── THE OWNER'S SECTION MOVES, OUT OF CLAIMS AND INTO THEM ──────────────────
//
// AFTER the abbreviation repair, and that placement is the whole of it. The repair REWRITES a
// truncated span into the full sentence, so #1850's "Tiberi - Republican U.S." only becomes
// "Patrick J. Tiberi - Republican U.S. House" here. Run before it, this removed 4 of the 13 rows
// the owner named and the guard below said so.
// ── the owner's section moves, out of Claims and into them ──────────────────
const movedOutKeys = new Set(sectionMoves.filter(m => m.from === 'claims')
  .flatMap(m => (m.certifiedAs ?? [m.text]).map(t => `${m.postNum}|${key(t)}`)))
const claimKeysBeforeMoveOut = new Set(final.rows.map(r => `${r.postNum}|${key(r.exactText)}`))
const beforeMoveOut = final.rows.length
final.rows = final.rows.filter(r => !movedOutKeys.has(`${r.postNum}|${key(r.exactText)}`))
const movedOut = beforeMoveOut - final.rows.length
// REFUSE RATHER THAN UNDER-APPLY. A move that matched nothing is a ruling that did not happen, and
// the count below would have gone on reconciling as if it had.
if (movedOut !== movedOutKeys.size) {
  // NAME THE ROWS, NOT JUST THE COUNTS. "22 of 23 matched" says a ruling half-landed and nothing
  // about which one — the same correction apply-entity-cleanup.mjs already carries.
  console.error(`\nOwner section moves: ${movedOutKeys.size} claim occurrence(s) to remove, ${movedOut} matched.`)
  for (const k of movedOutKeys) {
    if (!claimKeysBeforeMoveOut.has(k)) console.error(`   no such certified claim: ${k}`)
  }
  console.error('   Refusing to report a ruling as applied when it removed nothing.\n')
  process.exit(1)
}
// ── and out of Predictions / into Predictions ───────────────────────────────
// Same mechanism, other array. The 2026-08-24 corpus rulings — NCSWIC, Red October, Delta — all
// land here, most of them arriving FROM Claims.
const predOutKeys = new Set(sectionMoves.filter(m => m.from === 'predictions')
  .flatMap(m => (m.certifiedAs ?? [m.text]).map(t => `${m.postNum}|${key(t)}`)))
const beforePredOut = final.predictions.length
final.predictions = final.predictions.filter(r => !predOutKeys.has(`${r.postNum}|${key(r.exactText)}`))
if (beforePredOut - final.predictions.length !== predOutKeys.size) {
  console.error(`\nOwner section moves: ${predOutKeys.size} prediction(s) to remove, ${beforePredOut - final.predictions.length} matched. Refusing.\n`)
  process.exit(1)
}
let predIn = 0
for (const m of sectionMoves.filter(x => x.to === 'predictions')) {
  const p = posts.find(x => x.postNum === m.postNum)
  if (!p) { console.error(`\nOwner section moves: #${m.postNum} is not a drop. Refusing.\n`); process.exit(1) }
  if (final.predictions.some(r => r.postNum === m.postNum && key(r.exactText) === key(m.text))) continue
  const line = (p.text ?? '').split('\n').map(l => l.trim()).find(l => key(l) === key(m.text))
  if (!line) { console.error(`\nOwner section moves: ${JSON.stringify(m.text)} is not a line in #${m.postNum}. Refusing.\n`); process.exit(1) }
  final.predictions.push({
    postNum: m.postNum, postId: p.id, exactText: line,
    primaryClass: 'prediction', klass: 'Q_PREDICTION',
    isConclusion: false, conclusionReason: null, checkable: false, sourceProvided: false,
    confidence: 'OWNER_ADJUDICATED',
    provenance: `owner section move ${m.ruledOn} — "${m.ruling}"`,
  })
  predIn++
}

let movedIn = 0
for (const m of sectionMoves.filter(x => x.to === 'claims' && x.from !== 'claims')) {
  const p = posts.find(x => x.postNum === m.postNum)
  if (!p) { console.error(`\nOwner section moves: #${m.postNum} is not a drop. Refusing.\n`); process.exit(1) }
  if (final.rows.some(r => r.postNum === m.postNum && key(r.exactText) === key(m.text))) continue
  // Q'S OWN LINE, taken from the drop rather than from the ruling — the archive never stores a
  // retyped version of what Q wrote.
  const line = (p.text ?? '').split('\n').map(l => l.trim()).find(l => key(l) === key(m.text))
  if (!line) { console.error(`\nOwner section moves: ${JSON.stringify(m.text)} is not a line in #${m.postNum}. Refusing.\n`); process.exit(1) }
  final.rows.push({
    postNum: m.postNum, postId: p.id, exactText: line,
    primaryClass: 'claim', isPrediction: false, isConclusion: false,
    checkable: false, sourceProvided: false,
    telegraphic: line.split(/\s+/).filter(Boolean).length <= 4,
    confidence: 'OWNER_ADJUDICATED',
    provenance: `owner section move ${m.ruledOn} — "${m.ruling}"`,
  })
  movedIn++
}


const claimsByPost = new Map()
for (const r of final.rows) {
  if (!claimsByPost.has(r.postNum)) claimsByPost.set(r.postNum, [])
  claimsByPost.get(r.postNum).push(r)
}
const predsByPost = new Map()
for (const r of final.predictions) {
  if (!predsByPost.has(r.postNum)) predsByPost.set(r.postNum, [])
  predsByPost.get(r.postNum).push(r)
}
// Editorial paraphrases stay searchable, with provenance, never shown as Q's wording.
//
// 16 of them are not paraphrases at all. The phase-3 verbatim test compared the stored string
// RAW, so a record differing from Q's line only in punctuation or spacing failed it — but its
// canonical key matches a claim already certified under Q's exact wording. Storing those again
// as paraphrases would show the same assertion twice, once correctly and once as "not Q's
// words". They are dropped: the certified claim already carries the exact span.
const certifiedKeys = new Set(final.rows.map(r => `${r.postNum}|${key(r.exactText)}`))
const paraByPost = new Map()
let paraDroppedAsCertified = 0
for (const d of ph3.decisions) {
  if (d.proposedClass !== 'EDITORIAL_PARAPHRASE') continue
  if (certifiedKeys.has(`${d.postNum}|${key(d.exactText)}`)) { paraDroppedAsCertified++; continue }
  if (!paraByPost.has(d.postNum)) paraByPost.set(d.postNum, [])
  paraByPost.get(d.postNum).push({ text: d.exactText, provenance: 'earlier extractor paraphrase — not Q\'s literal wording' })
}

for (const p of posts) {
  const cl = claimsByPost.get(p.postNum) ?? []
  const pr = predsByPost.get(p.postNum) ?? []
  const pa = paraByPost.get(p.postNum) ?? []
  p.postAnalysis ??= {}

  p.postAnalysis.claims = cl.map(r => r.exactText)
  // predictions stays Q's LITERAL wording — it is what the highlighter matches against the
  // post body, and Q's words are never rewritten. The audit's complete sentence rides
  // alongside in a parallel array and is what the reader sees; the fragment stays one click
  // away. A null entry means the row needed no rewriting.
  p.postAnalysis.predictions = pr.map(r => r.exactText)
  const sentences = pr.map(r => r.plainSentence ?? null)
  if (sentences.some(Boolean)) p.postAnalysis.predictionSentences = sentences
  else delete p.postAnalysis.predictionSentences
  // impliedConclusions is now DERIVED from the claim attribute, not a separate extraction.
  // Predictions are included because the attribute belongs to the ROW, not to the section it
  // is displayed in: the 2026-08-16 audit moved 15 conclusion-bearing assertions from Claims
  // to Predictions, and a claims-only reading would have retired them from a certified count
  // the audit never touched. "A future-oriented inference is still an inference."
  p.postAnalysis.impliedConclusions = [...cl, ...pr].filter(r => r.isConclusion).map(r => r.exactText)
  // verificationHooks was a parallel section; checkable is an attribute of a claim now.
  p.postAnalysis.verificationHooks = cl.filter(r => r.checkable).map(r => r.exactText)

  if (cl.length || pr.length) {
    // Claims and Predictions are both ASSERTIONS internally, and separate sections on screen.
    // displayClass drives which section a unit appears in; semanticFamily records the truth
    // that a prediction is a kind of assertion. The Claims section shows 4,181 — never the
    // combined 4,811.
    p.claimMeta = {}
    for (const r of cl) {
      p.claimMeta[key(r.exactText)] = {
        semanticFamily: 'assertion', displayClass: 'claim',
        checkable: Boolean(r.checkable), sourceProvided: Boolean(r.sourceProvided),
        isConclusion: Boolean(r.isConclusion), isPrediction: false,
        telegraphic: Boolean(r.telegraphic), confidence: r.confidence,
      }
    }
    for (const r of pr) {
      p.claimMeta[key(r.exactText)] = {
        semanticFamily: 'assertion', displayClass: 'prediction',
        checkable: Boolean(r.checkable), sourceProvided: Boolean(r.sourceProvided),
        // A future-oriented inference is still an inference, so this is carried rather than
        // forced false. No prediction currently qualifies, so the certified 966 is unchanged.
        isConclusion: Boolean(r.isConclusion), isPrediction: true,
        telegraphic: false, confidence: r.confidence,
      }
    }
  } else delete p.claimMeta

  if (pa.length) p.editorialParaphrases = pa; else delete p.editorialParaphrases
}

// ── QA gate ─────────────────────────────────────────────────────────────────
const allClaims = posts.flatMap(p => (p.postAnalysis?.claims ?? []).map(t => ({ postNum: p.postNum, text: t })))
const allPreds = posts.flatMap(p => (p.postAnalysis?.predictions ?? []).map(t => ({ postNum: p.postNum, text: t })))
const bodyOf = new Map(posts.map(p => [p.postNum, flat(p.text ?? '')]))
const unresolved = allClaims.filter(c => !bodyOf.get(c.postNum)?.includes(flat(c.text)))

const meta = posts.flatMap(p => Object.values(p.claimMeta ?? {}))
const distinct = new Set(allClaims.map(c => key(c.text)))
const postsWith = new Set(allClaims.map(c => c.postNum))
const conclusions = posts.reduce((n, p) => n + (p.postAnalysis?.impliedConclusions?.length ?? 0), 0)
const checkable = final.rows.filter(r => r.checkable).length
const sourceProvided = final.rows.filter(r => r.sourceProvided).length
const telegraphic = final.rows.filter(r => r.telegraphic).length

// In-post repeats must survive as occurrences.
const groups = new Map()
for (const c of allClaims) { const k = `${c.postNum}|${key(c.text)}`; groups.set(k, (groups.get(k) ?? 0) + 1) }
const repeats = [...groups.values()].reduce((n, c) => n + c - 1, 0)

// Nothing held out may appear as a Q-authored claim.
const claimKeys = new Set(allClaims.map(c => `${c.postNum}|${key(c.text)}`))
const storedPara = new Set(posts.flatMap(p => (p.editorialParaphrases ?? []).map(x => `${p.postNum}|${key(x.text)}`)))
const paraLeak = [...storedPara].filter(k => claimKeys.has(k))
// 119 source-material units were DELIBERATELY restored as claims in phase 3, because they
// carry Q's own notation. Counting those as leaks would flag the decision as its own bug.
const restored = new Set(ph3.decisions
  .filter(d => d.queue === 'source-material boundary' && d.proposedClass === 'Q_CLAIM')
  .map(d => `${d.postNum}|${key(d.exactText)}`))
// Owner adjudications are exempt for the same reason, and outrank a stale detector verdict.
// #1881 "PURE EVIL." was recorded as source material by the ORIGINAL audit, run before the
// quote-boundary fix. The drop shows the quotation closing at `humanitarians.”` with Q's own
// commentary after it, and the owner ruled accordingly. An audit artifact frozen under a
// detector that has since been corrected cannot overrule the owner.
for (const r of final.rows.filter(r => r.confidence === 'OWNER_ADJUDICATED')) {
  restored.add(`${r.postNum}|${key(r.exactText)}`)
}
// Occurrence-aware, because the same line can legitimately be both. "Future proves past."
// appears twice in #520: once as Q's own opening line, and again inside a pasted tweet. One
// occurrence is a claim and the other is source material, and a key-only comparison cannot
// tell them apart. A leak is only real when MORE occurrences are counted as claims than exist
// outside the source blocks.
const lineCounts = new Map()
for (const p of posts) {
  for (const l of clean(p.text ?? '').split('\n')) {
    const k = `${p.postNum}|${key(l.trim())}`
    if (!k.endsWith('|')) lineCounts.set(k, (lineCounts.get(k) ?? 0) + 1)
  }
}
const srcCounts = new Map()
for (const s of v2.sourceRows) { const k = `${s.postNum}|${key(s.exactText)}`; srcCounts.set(k, (srcCounts.get(k) ?? 0) + 1) }
const claimCounts = new Map()
for (const c of allClaims) { const k = `${c.postNum}|${key(c.text)}`; claimCounts.set(k, (claimCounts.get(k) ?? 0) + 1) }
const srcLeak = [...srcCounts].filter(([k, nSrc]) => {
  if (restored.has(k)) return false
  const nClaim = claimCounts.get(k) ?? 0
  if (!nClaim) return false
  const nTotal = lineCounts.get(k) ?? nClaim + nSrc
  return nClaim > Math.max(0, nTotal - nSrc)
})

// Frozen datasets must be untouched.
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8')).filter(q => !q.editorialNormalization)
const directives = posts.reduce((n, p) => n + (p.actionRequests?.length ?? 0), 0)

// ── 2026-08-16 predictions audit: every count below that moved, and the arithmetic for it.
// Seven certified figures shifted because 115 rows changed section. None was re-derived and
// none was forced; each is (removed) + (arrived) over the frozen artifact.
const checks = [
  // 4,242 - 68 moved out to Predictions (P4) + 47 arriving from Predictions (P1) = 4,221.
  // 4,221 - 9 withdrawn to Questions by owner ruling (2026-08-19) = 4,212.
  // 4,212 + 4,716 arriving from the unhighlighted-sentence queue = 8,928. The owner ruled 4,782
  // sentences to be Claims; 66 of those occurrences were already certified, so 4,716 are new.
  // 8,928 + 1 = 8,929 (r10, #4923 "Dearest Virginia -"), + 5 = 8,934 from the 2026-08-21 batch:
  // #4861 "House resolution passed condemning 'Qanon'", #4893 "Example:" and "Federal Appeals
  // Court reinstates conviction", #4853 "Wife: CIA" and "Husband: DOJ". All recorded in
  // audit/editorial-batch-pending.json and carried in by apply-owner-claims.mjs.
  // -22 on 2026-08-21: the abbreviation repair absorbed 22 tail fragments the sentence splitter
  // had certified as claims of their own ("Rosenstein.", "Code Chapter 115 - TREASON...", "POTUS'
  // Tweet."). Each is now inside the repaired span rather than beside it. No claim left the
  // archive; the same words are certified once instead of twice.
  // 8,912 + 1,646 from ROUND 2 of the same review = 10,558. The owner ruled 1,654 more lines
  // Claims and 94 more Predictions; 70 claim and 3 prediction occurrences were already certified,
  // so only the shortfall is added.
  // -11 on 2026-08-24, from three owner section moves. -13: the retiring-members list rows on
  // #1850 leave Claims — each names a member and a party, is already certified as both (split), and
  // a list row is not an assertion the drop is making. +2: #1443's "#2." arrives from Directives
  // ("i want to make the #2. a claim not a directive") and #4784's opening line
  // "Lisa Barsoomian _former Bill Clinton attorney" is ruled a Claim.
  // -10 on 2026-08-24, the corpus rulings: "Let's do all the Red October refferences as
  // predictions for now" and "Lets do all Delta references to Predictions". Ten lines that were
  // Claims are Predictions now; five more arrive there from no section at all, and two are REFUSED
  // and named in audit/owner-section-moves.json — NCSWIC inside a CISA URL, and #1176's "Delta
  // engine fire?", which is Delta AIRLINES.
  // +2 on 2026-08-25: #1010's WATER (moved from Directives) and AIR (previously uncategorised),
  // owner ruling — see build-owner-section-moves.mjs.
  // -20 on 2026-08-26: #1515's reporter roll. 20 "OUTLET – Name" lines were certified as a single
  // Claim apiece instead of getting the entity treatment every other line on the same list got —
  // a list row asserts nothing, so it leaves Claims once the entities are certified separately
  // (audit/entities-owner-rulings.json, same day).
  ['claim occurrences = 10,519', allClaims.length === 10519, allClaims.length],
  // 4,782 + 1,654 = 6,436 claims; 250 + 94 = 344 predictions, across both rounds.
  // -1 claim, -1 prediction on 2026-08-24: two round-2 rulings the owner overrode on the UPDATED
  // report. lib/queueRulings.mjs drops them before any materialiser sees them, so the round-2
  // artifact stays the record of what was ruled that day and
  // audit/unhighlighted-owner-rulings-2-corrections.json is the record of what was ruled about it.
  //   #4891 claims  "Why would H."      — not a sentence Q wrote, but the head the splitter left
  //                                       when it read "H." as a full stop. The whole sentence is
  //                                       already a certified Question, so the head painted an
  //                                       amber fragment inside a blue question.
  //   #1443 predictions "DECLAS_Public[3]" — the owner put this line on the Claims sheet AND the
  //                                       Predictions sheet, so it was ruled into both; the rule
  //                                       below let Predictions win and pulled the Claim out.
  //                                       "make this portion a claim" settles it.
  // +1 prediction on 2026-08-24, and the claims figure does not move. The owner corrected the
  // reading of #1443: "DECLAS_Public should be a prediction", so the withdrawal above moves from
  // the predictions ruling to the claims one and the line goes back to Predictions. Claims loses
  // that ruling and gains "Texts" on the same drop — "post 1443 lets make Texts a claim" — so the
  // two cancel exactly.
  ['queue rulings applied = 6,435 claims / 344 predictions',
    stats2020.claimsAdded + stats2020.claimsAlready === 6435 && stats2020.predsAdded + stats2020.predsAlready === 344,
    `${stats2020.claimsAdded}+${stats2020.claimsAlready} claims, ${stats2020.predsAdded}+${stats2020.predsAlready} predictions`],
  ['all resolve to their Q source span', unresolved.length === 0, `${allClaims.length - unresolved.length}/${allClaims.length}`],
  // +11: the 47 arrivals introduce 44 wordings Claims did not already hold, while the 68
  // departures empty 33 keys entirely ("Future proves past." left every post that carried it).
  // -9: every withdrawn wording occurs in exactly one post, so each empties its own key.
  // +3,581: the 4,716 new occurrences carry 3,581 wordings Claims did not already hold. The gap
  // is in-post and cross-post repetition — "Fantasy land." alone arrives four times in #111.
  // +1: "Dearest Virginia -" occurs once in the whole archive, so it opens its own key.
  // +4, not +5, for the five new claims: "Example:" normalises to the key "example", which
  // "Example." already holds as a certified Claim on #1015 and #1220. It joins them rather than
  // opening a key — which is also independent support for the ruling.
  // -19, and every key is accounted for: 70 disappear (48 truncated wordings that occurred only
  // as the cut form, plus the 22 absorbed tails) and 51 appear. 51 rather than 64 because the same
  // repair recurs across drops - "Goodbye, Mr. Rosenstein." is six posts and one key, and the
  // #1319/#1850 congressional list is the same eleven wordings twice.
  // +1,210: the 1,646 new occurrences carry 1,210 wordings Claims did not already hold.
  // +1, and every key is accounted for. The 13 removals lose NO key: the same list is pasted on
  // #1319 as well, so every one of those wordings is still certified there. Of the two arrivals,
  // "#2." is already a claim key on 23 other drops and opens none; "Lisa Barsoomian _former Bill
  // Clinton attorney" occurs once in the archive and opens its own.
  // -8, and every key accounted for. Seven of the ten departing wordings occur nowhere else in
  // Claims and take their key with them. The eighth is "Q, DELTA" — one key across #756, #757 and
  // #785, and all three occurrences leave together.
  // +2 on 2026-08-25: WATER and AIR are both new wordings to the section.
  // -20 on 2026-08-26: #1515's reporter roll withdrawal. Each "OUTLET – Name" wording is unique in
  // the corpus (no other drop pastes the same reporter list), so all 20 take their key with them.
  ['distinct = 7,999', distinct.size === 7999, distinct.size],
  // +1: 17 posts gain their first claim, 16 posts lose their last one.
  // -3: #483, #2695 and #3203 each held ONE claim and it was the quoted question, so those
  // drops leave the Claims post set entirely. #2420 and #2776 keep other claims and stay.
  // +1,104: the queue reached 4,484 posts, and 1,104 of them held no certified claim before.
  // +2: #4861 and #4853 gain their first certified claim. #4893 and #4923 already had claims,
  // so they were already in the set.
  // +170 drops gain their first certified claim.
  // -3: #1568, #2577 and #757 each held ONE claim and it was the Delta line, so those drops leave
  // the Claims post set entirely.
  ['posts = 3,253', postsWith.size === 3253, postsWith.size],
  // 630 - 73 technical nonpredictions - 56 arguable + 66 from Claims + 28 found = 595.
  // 595 + 247 from the queue (250 ruled, 3 occurrences already certified) = 842.
  // +1: #4910 "Freedom of information [truth] = END" (r11), the first ad-hoc Prediction ruling to
  // go through apply-owner-claims.mjs rather than a queue batch.
  // +4 on 2026-08-21 (r15): "MOVIE 1 [Full]: The 'START'" and "MOVIE 3 - TBA" on #1928 AND #1929.
  // The archive already certified the middle instalment, "MOVIE 2 - Coming this FALL.", so the
  // sequence read as one prediction between two unclassified lines. Both drops, because they are
  // the same drop reposted and carried the identical gap.
  // 847 + 94 ruled - 3 already certified = 941 (round 2 rules 94 predictions).
  // +1 on 2026-08-24 by owner ruling: #417 'News unlocks Map.' - "is a preiction in that post as
  // well". It stays a Claim too; the archive already carries spans certified as both.
  // -1 on 2026-08-24 (UPDATED report, sheet 4): #1443 "DECLAS_Public[3]" leaves Predictions on the
  // owner's ruling "make this portion a claim". It does not leave the archive — it is certified
  // once, in Claims, where the same round-2 review had also ruled it and where the cross-pull below
  // had been taking it back out. Claim occurrences do not move: this arrival replaces the departure
  // of #4891's "Why would H." exactly.
  // 942 again on 2026-08-24: the owner corrected the reading and #1443's "DECLAS_Public[3]" is a
  // Prediction. Claim occurrences do not move — "Texts" arrives on the same drop as it leaves.
  // +15 on 2026-08-24: the NCSWIC, Red October and Delta rulings. Ten arrive from Claims and five
  // from no section at all — #4951 "NCSWIC", #2286 "RED OCTOBER?", #2458 "RED LINE ON THE
  // ANNIVERSARY OF RED OCTOBER?", #2647 "[1 year delta]" and #3780 "Delta?".
  ['predictions = 957', allPreds.length === 957, allPreds.length],
  // isConclusion travels with the ROW rather than with the section, so a row leaving Claims
  // takes the attribute with it. -1: #3203's quoted question was the only withdrawn row
  // carrying it. 966 - 1 = 965.
  // -1: one absorbed tail carried isConclusion. The attribute travels with the row, so it leaves
  // with the fragment rather than being re-attached to the repaired span, which the audit never
  // adjudicated as a conclusion.
  ['conclusions = 964', conclusions === 964, conclusions],
  // +5: 18 checkable rows arrive from Predictions, 13 checkable rows leave for Predictions.
  // Same rule, same reason: -6 of the 9 withdrawn rows were checkable (#483, #2695 x2,
  // #2776 x2, #3203). 1,931 - 6 = 1,925.
  // UNMOVED, and deliberately. checkable and sourceProvided are attributes the claims audit
  // established from evidence in the drop; the owner ruled a SECTION, not an attribute, so no
  // queue row sets either. Inventing them would inflate two certified counts from a guess.
  // 1,925 -> 1,920: five absorbed tails carried the checkable attribute. It travels with the ROW,
  // so it leaves with the fragment rather than being re-attached to the repaired span — the claims
  // audit adjudicated the fragment, not the sentence it turned out to be part of.
  ['checkable = 1,920', checkable === 1920, checkable],
  // +1: 5 arrive carrying sourceProvided, 4 leave with it.
  // -1, same rule: one absorbed tail carried sourceProvided.
  ['sourceProvided = 438', sourceProvided === 438, sourceProvided],
  // -2: two departing claims were telegraphic. Predictions never carried the attribute, so
  // nothing arrives with it.
  // +3,159. telegraphic is not a judgement — it is "four words or fewer", computed the same way
  // apply-owner-claims.mjs computes it, and the queue is overwhelmingly short label-like lines
  // ("Poof!", "Classified.", "Ten days."). 387 + 3,159 = 3,546.
  // +1: "Dearest Virginia -" is three tokens, so the same "four words or fewer" rule marks it
  // telegraphic. Not a judgement about the ruling — the attribute is computed, not assigned.
  // +3 of the five new claims are four words or fewer: "Example:", "Wife: CIA", "Husband: DOJ".
  // The other two are five words each. Computed by the same rule, not assigned.
  // 3,550 -> 3,543. Two causes, both the repair working: absorbed tails that were four words or
  // fewer leave with their row, and a repaired span can outgrow the threshold — "Army Lt." is two
  // words, "Army Lt. Gen. Paul Nakasone" is five. telegraphic is computed from the text, so a
  // longer text is correctly no longer telegraphic.
  // +1,128. The queue is overwhelmingly short label-like lines, and telegraphic is not a
  // judgement — it is "four words or fewer" — so it moves with the batch by construction.
  // -3: four of the removed rows carried it — "Carol Shea-Porter - Democrat", "Jeb Hensarling -
  // Republican", "Ted Poe - Republican" and "Tiberi - Republican U.S." are each four words or
  // fewer — and "#2." arrives carrying it.
  // -7: seven of the ten departing rows carried it — "[7] Delta today.", "[1] min Delta.",
  // "DELTA [6] CONF." and the three "Q, DELTA" lines are all four words or fewer.
  // +2 on 2026-08-25: WATER and AIR are both one-word claims (<=4 words).
  // -14 on 2026-08-26: 14 of #1515's 20 removed rows are four words or fewer ("Buzzfeed – Ben
  // Smith" is 4: outlet, en-dash, first name, last name). The other 6 have a two-word outlet or a
  // three-word name and run to 5.
  ['telegraphic = 4,649', telegraphic === 4649, telegraphic],
  // 13 + 37: the queue emitted one row per UNIT, so a line Q wrote twice arrives twice and is
  // certified twice. Collapsing them would have dropped 37 real occurrences.
  // +80: round 2 carries more lines Q writes twice in one drop, and each repeat is a real
  // occurrence — the rule the whole certified system is built on.
  ['in-post repeats preserved = 130', repeats === 130, repeats],
  ['no editorial paraphrase shown as Q', paraLeak.length === 0, `${paraLeak.length} leaked`],
  ['no source material shown as Q', srcLeak.length === 0, `${srcLeak.length} leaked`],
  // 6,443 + 11 arriving by owner ruling (2026-08-19) = 6,454.
  // 6,454 + 65 arriving from the same owner ruling. Cross-section CHECK, not a source:
  // apply-questions-final.mjs owns the number and runs earlier in the chain.
  // 6,510 since the 2026-08-21 segmentation repair: 8 orphaned tail fragments absorbed into the
  // 10 questions they were split from, plus 1 duplicate merged. Asserted here because a claim
  // ruling must not move Questions - this is a cross-section tripwire, not a Questions figure.
  ['Questions now 6,509', questions.length === 6509, questions.length],
  // 2,422 + 2 owner rulings (#4963 'Focus.' / 'FOCUS.', ruled Directives out of Emphasis).
  // v5: Q Directives migrated to sourceSpansV2 provenance; 2,705 -> 2,552 by owner ruling.
  // 2,552 + 485 arriving from the same owner ruling. This is a cross-section CHECK, not a source:
  // apply-directives.mjs runs immediately before this step and owns the number.
  // 3,442 + 24 rows round 2 held for stating no instruction, ruled in by the owner on 2026-08-24.
  // +1 on 2026-08-25: #4949's Gettysburg line — see apply-directives.mjs.
  // -1 on 2026-08-25: #1010's WATER moves out of Directives — see apply-directives.mjs.
  //
  // 2026-08-26 FALSE ALARM, LOGGED SO IT IS NOT RE-CHASED: running apply-claims.mjs STANDALONE
  // (not through rebuild-bundle.mjs) read posts.json before apply-directives.mjs had a chance to
  // refresh it in this pass, and this check saw the stale 3,333 sitting there and briefly looked
  // like drift. Run in the correct pipeline order (apply-directives.mjs THEN apply-claims.mjs,
  // exactly what rebuild-bundle.mjs does), apply-directives.mjs writes 3,471 first and this check
  // sees the real, current number. Nothing was actually wrong; always read this value from a
  // full rebuild-bundle.mjs run, never from apply-claims.mjs run in isolation.
  ['Directives now 3,471', directives === 3471, directives],
]

console.log('\nAPPLY CERTIFIED CLAIMS\n')
console.log(`  claims written      : ${allClaims.length.toLocaleString()}`)
console.log(`  predictions written : ${allPreds.length.toLocaleString()}`)
console.log(`  paraphrases held    : ${posts.reduce((n, p) => n + (p.editorialParaphrases?.length ?? 0), 0).toLocaleString()} (searchable, never shown as Q)`)
console.log(`  claimMeta entries   : ${meta.length.toLocaleString()}`)
console.log(`\n  from the unhighlighted-sentence queue (owner rulings 2026-08-20 + 2026-08-24)`)
console.log(`    claims      +${stats2020.claimsAdded.toLocaleString()}  (${stats2020.claimsAlready} already certified)`)
console.log(`    predictions +${stats2020.predsAdded.toLocaleString()}  (${stats2020.predsAlready} already certified)`)
console.log(`    withdrawn from Claims because the owner ruled them Predictions: ${crossPulled}`)
console.log(`    owner section moves: ${movedOut} out of Claims, ${movedIn} into Claims, ${predIn} into Predictions`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(36)} ${got}`) }
for (const u of unresolved.slice(0, 6)) console.log(`      unresolved: #${u.postNum} ${JSON.stringify(u.text.slice(0, 56))}`)

if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: posts.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'posts.json'), JSON.stringify(posts))
console.log(`\nwrote public/data/posts.json (${(fs.statSync(path.join(DATA, 'posts.json')).size / 1048576).toFixed(1)} MB)\n`)
