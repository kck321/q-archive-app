// Claims adjudication — Phase 3.
//
// v2's source-material detector and post-level conclusion logic are FROZEN INPUTS. This does
// not re-derive them; it reviews the units where the result is disputed or uncertain, in the
// priority order the review set:
//
//   1. telegraphic MEDIUM claims          compressed assertions — where false positives hide
//   2. stored claims not reproduced by v2  paraphrase, label, source material or over-extraction
//   3. claim <-> prediction disagreements  future-tense that is really a plan or a conditional
//   4. conclusion edge cases               is the post-level logic over-reading?
//   5. source-material boundary cases      is any of it actually Q's own long writing?
//
// Outcomes: Q_CLAIM | Q_PREDICTION | Q_DIRECTIVE | Q_QUESTION | Q_STATEMENT_OR_HEADING |
//           SOURCE_MATERIAL | SEGMENTATION_ERROR | NEEDS_CONTEXT
//
// One outcome is added beyond that list, and it is flagged rather than smuggled:
// EDITORIAL_PARAPHRASE, for stored text that appears NOWHERE in the post. It is not a Q
// statement, not quoted source, and not uncertain — it is wording an earlier extractor wrote.
// Filing it under any of the eight would misrepresent it. This mirrors how the Questions audit
// handled editorialNormalization.
//
// checkable / sourceProvided are METADATA. They never decide whether something is a claim.
//
// AUDIT ONLY — no production write, no deploy. Questions and Directives stay frozen.
//
//   node scripts/adjudicate-claims.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor } from './lib/segment.mjs'
import { imperativeMood, learnVerbsFromCorpus } from './lib/imperative.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

// ── discriminators ───────────────────────────────────────────────────────────
// A conditional is not a forecast. "If Mueller is dirty, RR must also be dirty." asserts a
// relationship; it does not predict an event.
const CONDITIONAL = /^(if|unless|when|once|should|were|had)\b|,\s*(then|if)\b/i
// A statement of intent or policy is a plan, not a prediction about the world.
const INTENT = /\b(we|i)\s+(will|shall|are going to|intend|plan)\b/i
// "the coming storm", "the days ahead" — future word used as a MODIFIER, not a forecast.
const FUTURE_AS_MODIFIER = /\b(the|this|that|a|an|our|their)\s+(coming|upcoming|forthcoming)\b/i
const IMMINENT_WARNING = /\b(warning|be ready|prepare|brace|incoming)\b/i

// Telegraphic units: does the compression still carry a proposition?
const AGENT = /\b(by|via|from|per)\s+[A-Z@]/           // "... by MSM", "... from POTUS"
const STATE = /\b(dead|gone|down|out|active|pending|complete|confirmed|underway|in motion|offline|online|secure|compromised|removed|blocked|open|closed|clear|arrested|indicted|detained|frozen)\b/i
// A prepositional predicate is a state too: "Board under heavy attack.", "Server in custody."
const PREP_STATE = /\b(under|in|on|at|off|out of|inside|behind|within)\s+[a-z]/i
const TIME_ANCHOR = /\b(today|yesterday|tomorrow|tonight|now|already|effective|since|until|as of|\d{1,2}[/:]\d{2}|\b(19|20)\d{2}\b|(minutes?|hours?|days?|weeks?|months?|years?)\s+(after|before|later|prior|ago)|\b(after|before|later|ago|prior)\b)/i
const BANNER = /^[A-Z0-9\s,'"&.!?_/\\|+-]{8,}$/
const TOPIC_LABEL = /^(power|information|public|media|control|money|money flow|the map|the plan|the truth|the storm)\b/i

const HAS_Q_MARKER = /\[[A-Z_\d\s|+-]+\]|\b[A-Z]{3,}\b|_{2,}|>{2}/

export function adjudicate(rec, ctx = {}) {
  const t = (rec.exactText ?? '').trim()
  if (!t) return { klass: 'SEGMENTATION_ERROR', why: 'empty', confidence: 'HIGH' }

  // ── 2. stored text that is not in the post at all ────────────────────────
  if (rec.queue === 'stored claim not reproduced') {
    if (!ctx.verbatim) {
      return { klass: 'EDITORIAL_PARAPHRASE', why: 'appears nowhere in the post — wording an earlier extractor wrote, not Q\'s', confidence: 'HIGH' }
    }
    // It IS in the post but v2 did not surface it as a claim — find out why.
    if (ctx.v2Class) return { klass: ctx.v2Class, why: `v2 classified the same span as ${ctx.v2Class}`, confidence: 'MEDIUM' }
    return { klass: 'NEEDS_CONTEXT', why: 'verbatim in the post but not segmented as its own unit — a sub-span of a longer sentence', confidence: 'LOW' }
  }

  // ── 5. source-material boundary ──────────────────────────────────────────
  if (rec.queue === 'source-material boundary') {
    // Q's own long writing carries his notation: bracket codes, ALL-CAPS emphasis, underscores.
    if (HAS_Q_MARKER.test(t)) {
      return { klass: 'Q_CLAIM', why: 'long line, but carries Q\'s own notation (bracket code / caps emphasis) — his writing, not a pasted passage', confidence: 'MEDIUM' }
    }
    return { klass: 'SOURCE_MATERIAL', why: rec.provenance?.reason ?? 'inside a quoted or pasted block', confidence: 'MEDIUM' }
  }

  // ── 3. claim <-> prediction ──────────────────────────────────────────────
  if (rec.queue === 'claim/prediction disagreement') {
    if (CONDITIONAL.test(t)) return { klass: 'Q_CLAIM', why: 'conditional — asserts a relationship rather than forecasting an event', confidence: 'MEDIUM', isConditional: true }
    if (INTENT.test(t) && !IMMINENT_WARNING.test(t)) return { klass: 'Q_CLAIM', why: 'statement of intent or policy, not a forecast about the world', confidence: 'MEDIUM' }
    if (FUTURE_AS_MODIFIER.test(t)) return { klass: 'Q_CLAIM', why: '"coming" used as a modifier ("the coming storm"), not a predicted event', confidence: 'MEDIUM' }
    return { klass: 'Q_PREDICTION', why: 'genuine forecast about a future event', confidence: 'MEDIUM' }
  }

  // ── 4. conclusion edge cases ─────────────────────────────────────────────
  if (rec.queue === 'conclusion edge case') {
    const signals = (rec.conclusionReason ?? '').split(';').map(s => s.trim()).filter(Boolean)
    const onlyAnaphora = signals.length === 1 && /refers back/.test(signals[0])
    const onlyFinal = signals.length === 1 && /final assertion/.test(signals[0])
    if (onlyAnaphora || onlyFinal) {
      return { klass: 'Q_CLAIM', why: `single weak signal (${signals[0]}) — a declarative that follows other text is still just a claim`, confidence: 'MEDIUM', isConclusion: false }
    }
    return { klass: 'Q_CLAIM', why: `conclusion upheld — ${signals.join('; ')}`, confidence: 'HIGH', isConclusion: true }
  }

  // ── 1. telegraphic MEDIUM claims ─────────────────────────────────────────
  // The compressed form is fine; what matters is whether a PROPOSITION survives it.
  const imperative = imperativeMood(t, ctx.verbs).imperative
  if (imperative) return { klass: 'Q_DIRECTIVE', why: 'imperative — belongs to Directives', confidence: 'HIGH' }
  if (/\?$/.test(t)) return { klass: 'Q_QUESTION', why: 'interrogative', confidence: 'HIGH' }

  // Morphological fallback for a finite verb the closed list does not hold. "POTUS NEVER
  // telegraphs his moves." is plainly a claim, and was only queued because "telegraphs" is not
  // in the lexicon. A subject followed (optionally through an adverb) by an inflected verb is
  // enough — the closed-list trap has cost this project a correction in every category so far.
  const INFLECTED_AFTER_SUBJECT = /^(?:[A-Z][A-Za-z0-9._'’-]*|the|a|an|this|that|these|those|they|we|he|she|it|you|i)\s+(?:never|always|often|now|still|only|just|again|no longer)?\s*\w+(?:s|ed)\b/
  const carries = AGENT.test(t) || STATE.test(t) || PREP_STATE.test(t) || TIME_ANCHOR.test(t)
    || INFLECTED_AFTER_SUBJECT.test(t)
  if (BANNER.test(t) && !carries) {
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'all-caps banner with no agent, state or time anchor — a slogan', confidence: 'MEDIUM' }
  }
  if (TOPIC_LABEL.test(t) && !carries) {
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'topic label — names a subject without asserting anything about it', confidence: 'MEDIUM' }
  }
  if (carries) {
    return { klass: 'Q_CLAIM', why: `compressed but propositional — ${AGENT.test(t) ? 'names an agent' : STATE.test(t) ? 'asserts a state' : 'anchored in time'}`, confidence: 'MEDIUM', telegraphic: true }
  }
  return { klass: 'NEEDS_CONTEXT', why: 'compressed with no agent, state or time anchor — cannot tell an assertion from a label on the unit alone', confidence: 'LOW' }
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases = [
    [{ exactText: 'Fake pic push by MSM.', queue: 'telegraphic' }, 'Q_CLAIM'],
    [{ exactText: 'British MI6 agents dead.', queue: 'telegraphic' }, 'Q_CLAIM'],
    [{ exactText: 'Board under heavy attack.', queue: 'telegraphic' }, 'Q_CLAIM'],
    [{ exactText: 'CLAS removal WASH minutes after.', queue: 'telegraphic' }, 'Q_CLAIM'],
    [{ exactText: 'POWER SHIFT.', queue: 'telegraphic' }, 'Q_STATEMENT_OR_HEADING'],
    [{ exactText: 'PAY-FOR-PLAY SPIDER WEB.', queue: 'telegraphic' }, 'Q_STATEMENT_OR_HEADING'],
    [{ exactText: 'If Mueller is dirty, RR must also be dirty.', queue: 'claim/prediction disagreement' }, 'Q_CLAIM'],
    [{ exactText: 'We will not comply.', queue: 'claim/prediction disagreement' }, 'Q_CLAIM'],
    [{ exactText: 'The coming storm.', queue: 'claim/prediction disagreement' }, 'Q_CLAIM'],
    [{ exactText: 'Expect massive riots.', queue: 'claim/prediction disagreement' }, 'Q_PREDICTION'],
    [{ exactText: 'X', queue: 'stored claim not reproduced' }, 'EDITORIAL_PARAPHRASE'],
    [{ exactText: 'This was always the priority.', queue: 'conclusion edge case', conclusionReason: 'refers back to earlier material' }, 'Q_CLAIM'],
  ]
  let bad = 0
  for (const [rec, want] of cases) {
    const r = adjudicate(rec, { verbatim: false })
    const ok = r.klass === want
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.klass.padEnd(24)}${JSON.stringify(rec.exactText.slice(0, 46))}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── build the queues ─────────────────────────────────────────────────────────
const v2 = JSON.parse(fs.readFileSync(path.join(OUT, 'claims-audit.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const verbs = learnVerbsFromCorpus(posts.map(p => clean(p.text ?? '')))
const flat = t => clean(t).replace(/\s+/g, ' ').trim()
const bodyOf = new Map(posts.map(p => [p.postNum, flat(p.text ?? '')]))
const linesOf = new Map(posts.map(p => [p.postNum, clean(p.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)]))

// what v2 concluded per (post, key), so a stored claim can be told what happened to its span
const v2ByKey = new Map()
for (const r of v2.rows) v2ByKey.set(`${r.postNum}|${key(r.exactText)}`, r.klass)
for (const s of v2.sourceRows) v2ByKey.set(`${s.postNum}|${key(s.exactText)}`, 'SOURCE_MATERIAL')

const queue = []

// 1 — telegraphic MEDIUM claims
for (const r of v2.rows) {
  if (r.primaryClass === 'claim' && /elided copula/.test(r.provenance?.reason ?? '')) {
    queue.push({ ...r, queue: 'telegraphic' })
  }
}
// 2 — stored extractor claims not reproduced by v2
for (const p of posts) {
  for (const c of p.postAnalysis?.claims ?? []) {
    const k = `${p.postNum}|${key(c)}`
    if (v2ByKey.get(k) === 'Q_CLAIM') continue
    queue.push({
      postNum: p.postNum, postId: p.id, exactText: c,
      queue: 'stored claim not reproduced',
      _verbatim: (bodyOf.get(p.postNum) ?? '').includes(flat(c)),
      _v2Class: v2ByKey.get(k) ?? null,
    })
  }
}
// 3 — claim/prediction disagreements
for (const r of v2.rows) {
  if (r.primaryClass !== 'prediction') continue
  if (CONDITIONAL.test(r.exactText) || INTENT.test(r.exactText) || FUTURE_AS_MODIFIER.test(r.exactText)) {
    queue.push({ ...r, queue: 'claim/prediction disagreement' })
  }
}
// 4 — conclusion edge cases
for (const r of v2.rows) {
  if (r.isConclusion) queue.push({ ...r, queue: 'conclusion edge case' })
}
// 5 — source-material boundary: prose-run holdouts only (the seeded ones are unambiguous)
for (const s of v2.sourceRows) {
  if (/sustained prose block/.test(s.provenance?.reason ?? '')) queue.push({ ...s, queue: 'source-material boundary' })
}

// ── adjudicate ───────────────────────────────────────────────────────────────
const decisions = []
for (const rec of queue) {
  const a = adjudicate(rec, { verbs, verbatim: rec._verbatim, v2Class: rec._v2Class })
  const lines = linesOf.get(rec.postNum) ?? []
  const i = lines.findIndex(l => key(l) === key(rec.exactText) || key(l).includes(key(rec.exactText)))
  decisions.push({
    queue: rec.queue,
    postNum: rec.postNum, postId: rec.postId,
    exactText: rec.exactText,
    v2Class: rec.klass ?? rec._v2Class ?? 'not classified by v2',
    proposedClass: a.klass,
    // Attributes ride along on surviving claims. They are metadata and never decide the class.
    ...(a.klass === 'Q_CLAIM' ? {
      checkable: Boolean(rec.checkable),
      sourceProvided: Boolean(rec.sourceProvided),
      isConclusion: a.isConclusion ?? Boolean(rec.isConclusion),
      telegraphic: Boolean(a.telegraphic),
      isConditional: Boolean(a.isConditional),
    } : {}),
    reason: a.why,
    confidence: a.confidence,
    provenance: { adjudicator: 'adjudicate-claims v1', v2: rec.provenance ?? null },
    context: { before: i > 0 ? lines[i - 1] : null, after: i >= 0 ? lines[i + 1] ?? null : null },
  })
}

// ── revised totals ───────────────────────────────────────────────────────────
const byQueue = {}
for (const d of decisions) {
  byQueue[d.queue] ??= {}
  byQueue[d.queue][d.proposedClass] = (byQueue[d.queue][d.proposedClass] ?? 0) + 1
}
const v2Claims = v2.rows.filter(r => r.primaryClass === 'claim').length
const v2Preds = v2.rows.filter(r => r.primaryClass === 'prediction').length
const demoted = decisions.filter(d => ['telegraphic', 'conclusion edge case'].includes(d.queue) && d.proposedClass !== 'Q_CLAIM').length
const predToClaim = decisions.filter(d => d.queue === 'claim/prediction disagreement' && d.proposedClass === 'Q_CLAIM').length
const sourceToClaim = decisions.filter(d => d.queue === 'source-material boundary' && d.proposedClass === 'Q_CLAIM').length
const conclUpheld = decisions.filter(d => d.queue === 'conclusion edge case' && d.isConclusion).length
const conclDropped = decisions.filter(d => d.queue === 'conclusion edge case' && d.isConclusion === false).length

const revisedClaims = v2Claims - demoted + predToClaim + sourceToClaim
const revisedPreds = v2Preds - predToClaim

const totals = {
  v2: { claims: v2Claims, predictions: v2Preds, conclusions: v2.rows.filter(r => r.isConclusion).length },
  adjudicated: decisions.length,
  movements: { demotedFromClaims: demoted, predictionToClaim: predToClaim, sourceToClaim, conclusionsUpheld: conclUpheld, conclusionsDropped: conclDropped },
  revised: { claims: revisedClaims, predictions: revisedPreds, conclusions: conclUpheld },
  byQueue,
}
fs.writeFileSync(path.join(OUT, 'claims-adjudicated.json'), JSON.stringify({ scope: 'Phase 3 claims adjudication', productionChanged: false, totals, decisions }, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = ['# Q Drops — Claims adjudication (Phase 3)\n']
md.push('v2\'s source-material detector and post-level conclusion logic are frozen inputs. Questions and Directives frozen. **No production write, no deploy.** Nothing is tuned toward the stored 7,509.\n')
md.push('\n## Outcome by queue\n')
for (const [q, counts] of Object.entries(byQueue)) {
  md.push(`\n**${q}** — ${Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString()} units\n`)
  md.push('| Proposed | Count |')
  md.push('|---|---|')
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
}
md.push('\n## Revised totals\n')
md.push('| Measure | v2 | After adjudication |')
md.push('|---|---|---|')
md.push(`| Claims | ${v2Claims.toLocaleString()} | **${revisedClaims.toLocaleString()}** |`)
md.push(`| Predictions | ${v2Preds.toLocaleString()} | **${revisedPreds.toLocaleString()}** |`)
md.push(`| Conclusions *(attribute)* | ${totals.v2.conclusions.toLocaleString()} | **${conclUpheld.toLocaleString()}** |`)
md.push('\n## One outcome added beyond the eight, and why\n')
md.push('`EDITORIAL_PARAPHRASE` — stored text that appears **nowhere in the post**. It is not a Q statement, not quoted source, and not uncertain: it is wording an earlier extractor wrote. Filing it under any of the eight would misrepresent it, so it is named. This mirrors `editorialNormalization` in the Questions audit, which is retained for search but never shown as Q\'s words.\n')
md.push('\n## Attributes are metadata\n')
md.push('`checkable` and `sourceProvided` are recorded on surviving claims and never take part in deciding whether something is a claim. A claim with no date, number or name is still a claim.\n')
for (const [q] of Object.entries(byQueue)) {
  const list = decisions.filter(d => d.queue === q)
  md.push(`\n## ${q} (${list.length.toLocaleString()})\n`)
  md.push('| Post | Exact Q source span | v2 | Proposed | Conf | Attributes | Reason | Before | After |')
  md.push('|---|---|---|---|---|---|---|---|---|')
  for (const d of list.slice(0, 120)) {
    const attrs = d.proposedClass === 'Q_CLAIM'
      ? [d.checkable && 'checkable', d.sourceProvided && 'source', d.isConclusion && 'conclusion', d.telegraphic && 'telegraphic', d.isConditional && 'conditional'].filter(Boolean).join(', ')
      : ''
    md.push(`| #${d.postNum} | \`${esc(d.exactText).slice(0, 62)}\` | ${d.v2Class} | **${d.proposedClass}** | ${d.confidence} | ${attrs} | ${esc(d.reason).slice(0, 46)} | \`${esc(d.context.before).slice(0, 18)}\` | \`${esc(d.context.after).slice(0, 18)}\` |`)
  }
  if (list.length > 120) md.push(`\n_…and ${(list.length - 120).toLocaleString()} more in the JSON._`)
}
fs.writeFileSync(path.join(OUT, 'claims-adjudicated.md'), md.join('\n') + '\n')

console.log('\nCLAIMS ADJUDICATION — PHASE 3\n')
for (const [q, counts] of Object.entries(byQueue)) {
  console.log(`  ${q}`)
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(5)}  ${k}`)
}
console.log('\n  MOVEMENTS')
console.log(`    demoted out of claims   : ${demoted}`)
console.log(`    prediction -> claim     : ${predToClaim}`)
console.log(`    source -> claim         : ${sourceToClaim}`)
console.log(`    conclusions upheld      : ${conclUpheld}   dropped: ${conclDropped}`)
console.log('\n  REVISED')
console.log(`    claims      : ${v2Claims.toLocaleString()}  ->  ${revisedClaims.toLocaleString()}`)
console.log(`    predictions : ${v2Preds.toLocaleString()}  ->  ${revisedPreds.toLocaleString()}`)
console.log(`    conclusions : ${conclUpheld.toLocaleString()} (attribute)`)
console.log('\n→ audit/claims-adjudicated.md\n')
