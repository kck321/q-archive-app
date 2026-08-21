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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
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
const ph3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/claims-adjudicated.json'), 'utf8'))
const v2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/claims-audit.json'), 'utf8'))

const flat = t => clean(t).replace(/\s+/g, ' ').trim()

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
  ['claim occurrences = 4,212', allClaims.length === 4212, allClaims.length],
  ['all resolve to their Q source span', unresolved.length === 0, `${allClaims.length - unresolved.length}/${allClaims.length}`],
  // +11: the 47 arrivals introduce 44 wordings Claims did not already hold, while the 68
  // departures empty 33 keys entirely ("Future proves past." left every post that carried it).
  // -9: every withdrawn wording occurs in exactly one post, so each empties its own key.
  ['distinct = 3,247', distinct.size === 3247, distinct.size],
  // +1: 17 posts gain their first claim, 16 posts lose their last one.
  // -3: #483, #2695 and #3203 each held ONE claim and it was the quoted question, so those
  // drops leave the Claims post set entirely. #2420 and #2776 keep other claims and stay.
  ['posts = 1,980', postsWith.size === 1980, postsWith.size],
  // 630 - 73 technical nonpredictions - 56 arguable + 66 from Claims + 28 found = 595.
  ['predictions = 595', allPreds.length === 595, allPreds.length],
  // isConclusion travels with the ROW rather than with the section, so a row leaving Claims
  // takes the attribute with it. -1: #3203's quoted question was the only withdrawn row
  // carrying it. 966 - 1 = 965.
  ['conclusions = 965', conclusions === 965, conclusions],
  // +5: 18 checkable rows arrive from Predictions, 13 checkable rows leave for Predictions.
  // Same rule, same reason: -6 of the 9 withdrawn rows were checkable (#483, #2695 x2,
  // #2776 x2, #3203). 1,931 - 6 = 1,925.
  ['checkable = 1,925', checkable === 1925, checkable],
  // +1: 5 arrive carrying sourceProvided, 4 leave with it.
  ['sourceProvided = 439', sourceProvided === 439, sourceProvided],
  // -2: two departing claims were telegraphic. Predictions never carried the attribute, so
  // nothing arrives with it.
  ['telegraphic = 387', telegraphic === 387, telegraphic],
  ['in-post repeats preserved = 13', repeats === 13, repeats],
  ['no editorial paraphrase shown as Q', paraLeak.length === 0, `${paraLeak.length} leaked`],
  ['no source material shown as Q', srcLeak.length === 0, `${srcLeak.length} leaked`],
  // 6,443 + 11 arriving by owner ruling (2026-08-19) = 6,454.
  ['Questions now 6,454', questions.length === 6454, questions.length],
  // 2,422 + 2 owner rulings (#4963 'Focus.' / 'FOCUS.', ruled Directives out of Emphasis).
  // v5: Q Directives migrated to sourceSpansV2 provenance; 2,705 -> 2,552 by owner ruling.
  ['Directives still 2,552', directives === 2552, directives],
]

console.log('\nAPPLY CERTIFIED CLAIMS\n')
console.log(`  claims written      : ${allClaims.length.toLocaleString()}`)
console.log(`  predictions written : ${allPreds.length.toLocaleString()}`)
console.log(`  paraphrases held    : ${posts.reduce((n, p) => n + (p.editorialParaphrases?.length ?? 0), 0).toLocaleString()} (searchable, never shown as Q)`)
console.log(`  claimMeta entries   : ${meta.length.toLocaleString()}`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(36)} ${got}`) }
for (const u of unresolved.slice(0, 6)) console.log(`      unresolved: #${u.postNum} ${JSON.stringify(u.text.slice(0, 56))}`)

if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: posts.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'posts.json'), JSON.stringify(posts))
console.log(`\nwrote public/data/posts.json (${(fs.statSync(path.join(DATA, 'posts.json')).size / 1048576).toFixed(1)} MB)\n`)
