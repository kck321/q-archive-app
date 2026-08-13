// Claims audit — full corpus.
//
// Built on the same rails as Questions and Directives: shared segmenter, shared overrides, and
// the two certified datasets consulted FIRST as exclusions and cross-links. No new parser.
//
// THE GOVERNING RULE, and the one this whole script is shaped around:
//
//   A sentence is not a claim merely because it is declarative.
//
// Headings, slogans, quoted material, fragments, labels, code strings and contextual source
// text are NOT claims. Classifying by elimination — "not a question, not a directive, therefore
// a claim" — is precisely the over-classification that inflated Questions and Directives, and
// with 29,569 units in the corpus it would be far more damaging here.
//
// So a claim must POSITIVELY qualify: an assertive proposition with a subject and a finite
// verb. Q's telegraphic verbless lines ("Information waterfall.", "Power shift.") assert
// something to a human reader, but they are labels, and treating them as claims would manufacture
// thousands of assertions Q never wrote as sentences. They are queued, not counted.
//
// Separating the neighbouring classes:
//   PREDICTION  asserts about the FUTURE          "Expect massive riots."
//   CONCLUSION  draws an inference FROM the post  "Therefore the timeline is confirmed."
//   CLAIM       asserts a present/past fact       "HRC extradition already in motion."
//
// `checkable` is an ATTRIBUTE of a claim, not a separate class.
//
// AUDIT ONLY — no production write, no deploy.
//
//   node scripts/audit-claims.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor, SEGMENTATION_RISK, STARTS_TRUNCATED } from './lib/segment.mjs'
import { imperativeMood, learnVerbsFromCorpus } from './lib/imperative.mjs'
import { sourceLines, unitIsSource } from './lib/quotedBlocks.mjs'
import { conclusionSignal } from './lib/conclusions.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

// ── what makes something an assertive proposition ────────────────────────────
// A finite verb is required. This is the positive gate that stops classification by elimination.
const FINITE_VERB = /\b(is|are|was|were|am|be(?:en)?|has|have|had|does|do|did|will|would|can|could|shall|should|may|might|must|goes|go|went|comes|came|makes|made|gets|got|knows|knew|says|said|shows|showed|proves|proved|means|meant|remains|remained|controls?|owns?|runs?|holds?|works?|lives?|dies?|wins?|loses?|takes?|took|gives?|gave|sees?|saw|finds?|found|becomes?|became|happens?|happened|occurs?|occurred|exists?|existed|leads?|led|created?|funded?|paid|received?|ordered?|approved?|signed?|killed?|arrested?|indicted?|charged?|removed?|replaced?|blocked?|stopped?|started?|began|ended?|failed?|passed?|voted?|traveled?|travelled?|met|sent|told|asked|wrote|read|used)\b/i
const SUBJECT_LEAD = /^(the|a|an|this|that|these|those|his|her|its|their|our|my|your|all|every|each|both|no|none|some|many|most|few|there|here|it|he|she|they|we|you|i|who|what|nothing|nobody|everything|everyone|someone|something)\b/i
const PROPER_SUBJECT = /^[A-Z][A-Za-z0-9._'’&/-]*(\s+[A-Z][A-Za-z0-9._'’&/-]*){0,4}\s+(?:is|are|was|were|has|have|had|will|would|can|could|does|do|did|controls?|owns?|runs?|leads?|holds?|funded?|paid|received?|created?|ordered?|approved?|signed?|met|sent|told|wrote|used|knew|knows)\b/

// ── what is NOT a claim, however declarative it looks ────────────────────────
const HEADING = /:\s*$/
const SIGNATURE = /^(q|q\+|wwg1wga|ncswic|where we go one,? we go all|god bless|godspeed)\b/i
const CODEY = /^[\W\d_]+$/
// Several bracket groups in a row, not just one: "[CLAS_EO_    ][2]".
const BRACKET_ONLY = /^(\[[^\]]*\]\s*)+$/
const URL_ONLY = /^(https?:\/\/|www\.)\S*$/i
const GREENTEXT = /^>/
const ALL_CAPS_BANNER = /^[A-Z0-9\s,'"&.!?_/\\|-]{10,}$/
const SCRIPTURE = /^(love (is|does)|for our struggle|put on the full armor|give us this day|help us to avoid|stand firm|therefore put on|the lord)/i
const LABEL_NO_VERB = /^[^.!?]{0,60}$/
// Predication without a verb: an agent, a place, a time, or a state attached to a noun phrase.
// This is what separates "HRC extradition already in motion effective yesterday." (a claim)
// from "Power shift." and "Information waterfall." (labels).
const ELIDED_PREDICATE = /\b(already|now|still|never|always|effective|underway|in motion|complete|confirmed|active|pending|dead|gone|down|out|over|by|via|per|from|under|behind|inside|within|during|after|before|because of|due to)\b/i

// ── future vs inference ──────────────────────────────────────────────────────
const FUTURE = /\b(will|shall|going to|about to|expect|expects|expected|soon|coming|upcoming|next week|next month|next year|tomorrow|ahead|forthcoming|imminent|forecast|predict|prepare for|watch for|days? ahead|in the coming)\b/i
const FUTURE_NOT = /\b(will of the people|free will|goodwill|willing)\b/i
const INFERENCE = /^(therefore|thus|hence|so |conclusion|in conclusion|which means|that means|this means|it follows|the result|as a result|ergo|clearly|obviously)\b/i
const INFERENCE_MID = /\b(therefore|thus|hence|which means|that means|this means|it follows|as a result|proves that|confirms that|tells you)\b/i

// ── attributes ───────────────────────────────────────────────────────────────
// A claim is CHECKABLE when it carries something testable against an independent record:
// a date, a number, a named person/org, a document or a specific event.
const HAS_NUMBER = /\b\d[\d,.:/-]*\b/
const HAS_DATE = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/i
const HAS_PROPER = /\b[A-Z]{2,}\b|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/
const HAS_DOC = /\b(memo|email|document|filing|report|record|transcript|indictment|warrant|subpoena|testimony|foia|court|order|EO|executive order)\b/i
const HAS_SOURCE = /(https?:\/\/|www\.|\bsource:|\bref:|\bsee:)/i

export function classify(text, ctx = {}) {
  const t = (text ?? '').trim()
  if (!t) return { klass: 'SEGMENTATION_ERROR', why: 'empty', confidence: 'HIGH' }

  // ── hard exclusions: not Q asserting anything ─────────────────────────────
  if (SEGMENTATION_RISK.test(t) || STARTS_TRUNCATED.test(t)) return { klass: 'SEGMENTATION_ERROR', why: 'fragment of a split sentence', confidence: 'HIGH' }
  if (GREENTEXT.test(t)) return { klass: 'QUOTED_OR_SOURCE', why: 'greentext — quoted or pointed-at material, not Q asserting', confidence: 'MEDIUM' }
  if (URL_ONLY.test(t)) return { klass: 'EVIDENCE_REFERENCE', why: 'a bare link — source material, belongs to Evidence & References', confidence: 'HIGH' }
  if (SIGNATURE.test(t.replace(/[.!?]+$/, ''))) return { klass: 'NOT_A_CLAIM', why: 'signature, sign-off or slogan', confidence: 'HIGH' }
  if (BRACKET_ONLY.test(t) || CODEY.test(t)) return { klass: 'NOT_A_CLAIM', why: 'code or bracket token — belongs to Codes & Brackets', confidence: 'HIGH' }
  if (HEADING.test(t)) return { klass: 'NOT_A_CLAIM', why: 'heading introducing material, not an assertion', confidence: 'HIGH' }
  if (SCRIPTURE.test(t)) return { klass: 'QUOTED_OR_SOURCE', why: 'scripture quoted — someone else asserted it', confidence: 'MEDIUM' }

  // An imperative is a directive even when it also reads as an assertion.
  const mood = imperativeMood(t, ctx.verbs)
  if (mood.imperative) return { klass: 'NOT_A_CLAIM', why: 'imperative — belongs to Directives', confidence: 'HIGH' }

  // ── the positive gate ─────────────────────────────────────────────────────
  const hasVerb = FINITE_VERB.test(t)
  const hasSubject = SUBJECT_LEAD.test(t) || PROPER_SUBJECT.test(t)
  const attrs = {
    checkable: (HAS_DATE.test(t) || HAS_NUMBER.test(t) || HAS_PROPER.test(t) || HAS_DOC.test(t)),
    sourceProvided: HAS_SOURCE.test(t) || Boolean(ctx.nearSource),
  }

  // A future marker predicates on its own — "Expect massive riots organized in defiance." has
  // no finite verb but is unmistakably a forecast. Checked before the verb gate.
  if (FUTURE.test(t) && !FUTURE_NOT.test(t)) {
    return { klass: 'Q_PREDICTION', why: 'asserts about the future', confidence: hasVerb && hasSubject ? 'HIGH' : 'MEDIUM', ...attrs }
  }
  if (hasVerb && (INFERENCE.test(t) || INFERENCE_MID.test(t))) {
    return { klass: 'Q_CONCLUSION', why: 'draws an inference from material in the post', confidence: hasSubject ? 'HIGH' : 'MEDIUM', ...attrs }
  }

  if (!hasVerb) {
    if (ALL_CAPS_BANNER.test(t)) return { klass: 'NOT_A_CLAIM', why: 'all-caps banner line with no finite verb — a slogan, not an assertion', confidence: 'MEDIUM' }
    // Q elides the copula constantly: "HRC extradition already in motion effective yesterday."
    // asserts something, and dropping every verbless line would lose thousands of real claims.
    // But "Power shift." and "Information waterfall." are bare noun compounds and are NOT
    // claims. The separator is PREDICATION — an agent, a location, a time, or a state marker
    // attached to the noun phrase.
    if (ELIDED_PREDICATE.test(t) && t.split(/\s+/).length >= 4) {
      return { klass: 'Q_CLAIM', why: 'elided copula — telegraphic assertion with a predicate ("… already in motion", "… by MSM")', confidence: 'MEDIUM', telegraphic: true, ...attrs }
    }
    if (LABEL_NO_VERB.test(t)) return { klass: 'LABEL_OR_FRAGMENT', why: 'no finite verb and no predicate — a label or noun compound, not a proposition', confidence: 'MEDIUM' }
    return { klass: 'LABEL_OR_FRAGMENT', why: 'no finite verb', confidence: 'LOW' }
  }

  if (hasSubject) {
    return { klass: 'Q_CLAIM', why: 'assertive proposition — subject with a finite verb', confidence: 'HIGH', ...attrs }
  }
  return { klass: 'Q_CLAIM', why: 'finite verb but no clear subject — assertion with an implied subject', confidence: 'MEDIUM', ...attrs }
}

// ── self-test on the boundaries that matter ──────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases = [
    // real claims
    ['HRC extradition already in motion effective yesterday.', 'Q_CLAIM'],
    ['The FBI has an open investigation into the CF.', 'Q_CLAIM'],
    ['They control the media.', 'Q_CLAIM'],
    ['Hussein funded the program.', 'Q_CLAIM'],
    // predictions
    ['Expect massive riots organized in defiance.', 'Q_PREDICTION'],
    ['More will follow.', 'Q_PREDICTION'],
    ['Nothing can stop what is coming.', 'Q_PREDICTION'],
    // conclusions
    ['Therefore the timeline is confirmed.', 'Q_CONCLUSION'],
    ['That means the leak came from inside.', 'Q_CONCLUSION'],
    // NOT claims — the governing rule
    ['Information waterfall.', 'LABEL_OR_FRAGMENT'],
    ['Power shift.', 'LABEL_OR_FRAGMENT'],
    ['Fake pic push by MSM.', 'Q_CLAIM'],           // telegraphic, but has an agent
    ['Sec detail background.', 'LABEL_OR_FRAGMENT'],
    ['Important Context:', 'NOT_A_CLAIM'],
    ['WWG1WGA!!!', 'NOT_A_CLAIM'],
    ['[CLAS_EO_    ][2]', 'NOT_A_CLAIM'],
    ['https://www.fbi.gov/about/faqs', 'EVIDENCE_REFERENCE'],
    ['>Add multiple layers of coincidences.', 'QUOTED_OR_SOURCE'],
    ['Follow the money.', 'NOT_A_CLAIM'],
    ['Think logically.', 'NOT_A_CLAIM'],
    ['Love does not delight in evil but rejoices with the truth.', 'QUOTED_OR_SOURCE'],
  ]
  let bad = 0
  for (const [t, want] of cases) {
    const r = classify(t)
    const ok = r.klass === want
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.klass.padEnd(20)}${JSON.stringify(t.slice(0, 52))}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── full corpus ──────────────────────────────────────────────────────────────
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8')).filter(q => !q.editorialNormalization)
const verbs = learnVerbsFromCorpus(posts.map(p => clean(p.text ?? '')))

const certQ = new Set()
for (const q of questions) {
  certQ.add(`${q.postNum}|${key(q.text)}`)
  if (q.directiveSource) certQ.add(`${q.postNum}|${key(q.directiveSource)}`)
}
const certD = new Set()
for (const p of posts) for (const d of p.actionRequests ?? []) certD.add(`${p.postNum}|${key(d)}`)

const tally = {}
const bump = k => { tally[k] = (tally[k] ?? 0) + 1 }
const rows = []

const sourceRows = []

for (const p of posts) {
  const cleaned = clean(p.text ?? '')
  const lines = cleaned.split('\n').map(l => l.trim())
  const nearSource = /https?:\/\//i.test(p.text ?? '')

  // PHASE 1 — block-level source detection, computed once per post.
  const srcMap = sourceLines(cleaned)

  // PHASE 2 needs the post read in order, so build the unit list first.
  const units = unitsFor(p.text ?? '').map(u => ({ ...u, t: u.text.trim() })).filter(u => u.t)
  const kindOf = u => certQ.has(`${p.postNum}|${key(u.t)}`) ? 'question'
    : certD.has(`${p.postNum}|${key(u.t)}`) ? 'directive' : 'other'
  const hasEvidence = nearSource || /\b(list|memo|document|filing|record|report)\b/i.test(cleaned)

  // Index of the last unit that will be an assertion, for the "closing takeaway" signal.
  let lastAssertive = -1
  units.forEach((u, i) => { if (kindOf(u) === 'other' && !unitIsSource(srcMap, u.startLine, u.endLine)) lastAssertive = i })

  units.forEach((u, i) => {
    const t = u.t
    const k = `${p.postNum}|${key(t)}`

    if (certQ.has(k)) { bump('CERTIFIED_QUESTION'); return }
    if (certD.has(k)) { bump('CERTIFIED_DIRECTIVE'); return }

    // Source material never enters a Q-authored semantic class. Preserved, never deleted.
    const srcReason = unitIsSource(srcMap, u.startLine, u.endLine)
    if (srcReason) {
      bump('QUOTED_SOURCE')
      sourceRows.push({
        postNum: p.postNum, postId: p.id, exactText: t,
        primaryClass: 'source_material',
        provenance: { source: 'audit-claims v2 block detector', reason: srcReason, segConfidence: u.segConfidence },
      })
      return
    }

    const r = classify(t, { verbs, nearSource })
    bump(r.klass)

    if (['Q_CLAIM', 'Q_PREDICTION', 'Q_CONCLUSION'].includes(r.klass) || r.confidence === 'LOW') {
      // PHASE 2 — conclusion is an ATTRIBUTE of an assertion, decided from the post.
      const prior = units.slice(0, i).filter(x => !unitIsSource(srcMap, x.startLine, x.endLine))
      const concl = r.klass === 'Q_CLAIM' || r.klass === 'Q_CONCLUSION'
        ? conclusionSignal(t, {
          priorUnits: prior.map(x => x.t),
          priorIsQuestion: i > 0 && kindOf(units[i - 1]) === 'question',
          questionCount: prior.filter(x => kindOf(x) === 'question').length,
          hasEvidence,
          isLastAssertion: i === lastAssertive,
        })
        : { isConclusion: false, why: 'predictions are not conclusions', confidence: 'HIGH' }

      rows.push({
        postNum: p.postNum, postId: p.id,
        exactText: t,
        // Conclusion is a cross-class attribute, so the primary class stays claim.
        primaryClass: r.klass === 'Q_PREDICTION' ? 'prediction' : r.klass === 'Q_CLAIM' || r.klass === 'Q_CONCLUSION' ? 'claim' : 'unresolved',
        klass: r.klass,
        isConclusion: concl.isConclusion,
        conclusionReason: concl.isConclusion ? concl.why : null,
        checkable: Boolean(r.checkable),
        sourceProvided: Boolean(r.sourceProvided),
        entities: (p.postAnalysis?.namedEntities ?? []).filter(e => new RegExp(`\\b${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t)),
        themes: p.postAnalysis?.themes ?? [],
        confidence: r.confidence,
        provenance: { source: 'audit-claims v2', segConfidence: u.segConfidence, reason: r.why },
        context: { before: lines[u.startLine - 1] ?? null, after: lines[u.endLine + 1] ?? null },
      })
    }
  })
}

const claims = rows.filter(r => r.primaryClass === 'claim')
const preds = rows.filter(r => r.primaryClass === 'prediction')
const concl = rows.filter(r => r.isConclusion)
const stored = posts.reduce((n, p) => n + (p.postAnalysis?.claims?.length ?? 0), 0)
const storedConcl = posts.reduce((n, p) => n + (p.postAnalysis?.impliedConclusions?.length ?? 0), 0)
const storedPred = posts.reduce((n, p) => n + (p.postAnalysis?.predictions?.length ?? 0), 0)

const totals = {
  claims: { occurrences: claims.length, distinct: new Set(claims.map(c => key(c.exactText))).size, posts: new Set(claims.map(c => c.postNum)).size, checkable: claims.filter(c => c.checkable).length, sourceProvided: claims.filter(c => c.sourceProvided).length },
  predictions: { occurrences: preds.length, posts: new Set(preds.map(c => c.postNum)).size },
  // An attribute of claims, not a separate class — hence "of which".
  conclusions: { ofWhichClaims: concl.length, posts: new Set(concl.map(c => c.postNum)).size, highConfidence: concl.filter(c => c.confidence === 'HIGH').length },
  sourceMaterial: { units: sourceRows.length, posts: new Set(sourceRows.map(s => s.postNum)).size },
  comparedWithStoredExtractor: { claims: stored, conclusions: storedConcl, predictions: storedPred },
  pipeline: tally,
}
fs.writeFileSync(path.join(OUT, 'claims-audit.json'), JSON.stringify({ scope: 'full-corpus claims audit v2', productionChanged: false, totals, rows, sourceRows }, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = ['# Q Drops — Claims audit (v1, candidate)\n']
md.push('Full corpus, on the shared segmenter and overrides. Certified Questions and Directives are consulted first as exclusions. **No production write, no deploy.**\n')
md.push('\n## The governing rule\n')
md.push('**A sentence is not a claim merely because it is declarative.** Classifying by elimination — "not a question, not a directive, therefore a claim" — is the over-classification that inflated Questions and Directives, and with 29,569 units in the corpus it would do far more damage here.\n')
md.push('So a claim must positively qualify: an assertive proposition with a subject and a **finite verb**. Everything else is excluded by name rather than by default.\n')
md.push('\n## Pipeline\n')
md.push('| Outcome | Units |')
md.push('|---|---|')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
md.push('\n## Candidate totals\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Claim occurrences | **${totals.claims.occurrences.toLocaleString()}** |`)
md.push(`| — distinct | ${totals.claims.distinct.toLocaleString()} |`)
md.push(`| — posts | ${totals.claims.posts.toLocaleString()} |`)
md.push(`| — checkable (attribute) | ${totals.claims.checkable.toLocaleString()} |`)
md.push(`| — source provided | ${totals.claims.sourceProvided.toLocaleString()} |`)
md.push(`| Prediction occurrences | ${totals.predictions.occurrences.toLocaleString()} |`)
md.push(`| — of which conclusions *(attribute)* | ${totals.conclusions.ofWhichClaims.toLocaleString()} |`)
md.push(`| Source-material units held out | ${totals.sourceMaterial.units.toLocaleString()} |`)
md.push(`| Stored extractor claims (for comparison) | ${stored.toLocaleString()} |`)
md.push('\n## Sample claims\n')
md.push('| Post | Exact text | Checkable | Source | Conf |')
md.push('|---|---|---|---|---|')
for (let i = 0; i < claims.length && i < 40; i += 1) {
  const c = claims[Math.floor(i * claims.length / 40)]
  md.push(`| #${c.postNum} | \`${esc(c.exactText).slice(0, 78)}\` | ${c.checkable ? 'yes' : 'no'} | ${c.sourceProvided ? 'yes' : 'no'} | ${c.confidence} |`)
}
fs.writeFileSync(path.join(OUT, 'claims-audit.md'), md.join('\n') + '\n')

console.log('\nCLAIMS AUDIT v1\n')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${k}`)
console.log('\n  CANDIDATE TOTALS')
console.log(`    claims        : ${totals.claims.occurrences.toLocaleString()}  (${totals.claims.distinct.toLocaleString()} distinct, ${totals.claims.posts.toLocaleString()} posts)`)
console.log(`      checkable   : ${totals.claims.checkable.toLocaleString()}`)
console.log(`      w/ source   : ${totals.claims.sourceProvided.toLocaleString()}`)
console.log(`    predictions   : ${totals.predictions.occurrences.toLocaleString()}`)
console.log(`    conclusions   : ${totals.conclusions.ofWhichClaims.toLocaleString()} (attribute of claims, ${totals.conclusions.highConfidence} HIGH)`)
console.log(`    source held out: ${totals.sourceMaterial.units.toLocaleString()} units in ${totals.sourceMaterial.posts.toLocaleString()} posts`)
console.log('\n  vs stored extractor:')
console.log(`    claims ${stored.toLocaleString()} | conclusions ${storedConcl.toLocaleString()} | predictions ${storedPred.toLocaleString()}`)
console.log('\n→ audit/claims-audit.md\n')
