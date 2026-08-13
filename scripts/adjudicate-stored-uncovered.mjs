// The 720 genuinely uncovered stored claims — the last Claims-quality pass.
//
// These are verbatim Q wording an older extractor called claims, which are NOT already
// accounted for by certified Questions, certified Directives, v2 claims, or sub-spans of
// another unit. They sit on the boundary between claim, label, theme and emphasis.
//
// THE TEST, and the only thing that decides:
//
//   Does this exact Q-authored unit assert a proposition that could meaningfully be
//   true or false?
//
// Nothing is promoted because an older extractor called it a claim, and nothing is promoted on
// TOPIC WORDS alone — "ELECTION RIGGING" contains a loaded subject and asserts nothing.
// "Election rigging occurred." would. The difference is predication, not vocabulary.
//
// Outcomes: Q_CLAIM | Q_CLAIM_CONCLUSION | Q_STATEMENT_OR_HEADING | Q_EMPHASIS |
//           SOURCE_MATERIAL | EDITORIAL_PARAPHRASE | SEGMENTATION_ERROR | NEEDS_CONTEXT
//
// AUDIT ONLY — no production write, no deploy. Questions and Directives frozen.
//
//   node scripts/adjudicate-stored-uncovered.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'
import { conclusionSignal } from './lib/conclusions.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

// ── predication: what turns a noun phrase into a proposition ─────────────────
const FINITE_VERB = /\b(is|are|was|were|am|has|have|had|does|do|did|will|would|can|could|shall|should|may|might|must)\b/i
// Subject + inflected verb, for the open vocabulary the closed list never holds.
// The adverb must be matched in either case: Q writes "POTUS NEVER telegraphs his moves."
const INFLECTED = /^(?:[A-Z][A-Za-z0-9._'’-]*|the|a|an|this|that|these|those|they|we|he|she|it|you|i)\s+(?:[Nn][Ee][Vv][Ee][Rr]|[Aa][Ll][Ww][Aa][Yy][Ss]|[Oo][Ff][Tt][Ee][Nn]|[Nn][Oo][Ww]|[Ss][Tt][Ii][Ll][Ll]|[Oo][Nn][Ll][Yy]|[Jj][Uu][Ss][Tt]|[Aa][Gg][Aa][Ii][Nn]|no longer)?\s*[a-z]+(?:s|ed)\b/
// Elided copula with a state predicate: "AMERICA FOR SALE", "Sold out.", "SNOW WHITE 7 NOW OFFLINE"
const STATE_PREDICATE = /\b(for sale|sold out|sold|offline|online|dead|gone|down|active|inactive|pending|complete|completed|confirmed|underway|in motion|removed|blocked|frozen|secure|compromised|arrested|indicted|detained|classified|declassified|terminated|suspended|closed|open|fired|limited|resigned|replaced|approved|denied|killed|missing|captured|seized|unmasked|leaked)\b/i
// A pronoun subject followed by anything that is not a function word is a predicate.
// "They want you labeled by race, religion, class, sex, etc." has no auxiliary and no -s/-ed
// verb, so the morphological tests miss it, but it is plainly an assertion.
const PRONOUN_PREDICATE = /^(they|we|you|he|she|it|i)\s+(?!of\b|in\b|on\b|at\b|to\b|for\b|with\b|from\b|by\b|the\b|a\b|an\b|and\b|or\b|but\b|who\b|which\b|that\b)[a-z]+\b/i
// An auxiliary opening the unit with no question mark is Q asking without the punctuation —
// "Will holding actually provide a better scenario…" is interrogative, not an assertion.
const AUX_INITIAL = /^(will|is|are|was|were|do|does|did|can|could|should|would|has|have|had|shall|may|might|must)\b/i
// Progressive or passive with the auxiliary dropped: "RUSSIA TESTING NEW MISSILES",
// "MASS EXT EVENTS DESIGNED TO DECREASE THREAT LEVEL"
// The participle must be FOLLOWED by something. That single requirement is what separates
// "RUSSIA TESTING NEW MISSILES" (a progressive with an object) from "ELECTION RIGGING", which
// is a gerund-headed noun compound naming a topic and asserting nothing. The participle list
// is spelled in both cases because Q writes in caps constantly.
const ELIDED_AUX = /^[A-Z][A-Za-z0-9._'’-]*(?:\s+[A-Z0-9][A-Za-z0-9._'’-]*){0,4}\s+(?:[a-z]+ing|[A-Z]+ING|designed|built|created|funded|controlled|owned|led|backed|targeted|planned|DESIGNED|BUILT|CREATED|FUNDED|CONTROLLED|OWNED|LED|BACKED|TARGETED|PLANNED)\s+\S/
// A negated framing asserts something: "Not R vs D"
const NEGATED_FRAMING = /^(not|no longer|never)\s+\S/i
// Predicate nominal: "The gift that keeps on giving."
const PREDICATE_NOMINAL = /^(the|a|an)\s+\w+\s+(that|who|which)\s+\w+/i
// A prepositional predicate: "DC access. Sold out.", "Board under heavy attack."
const PREP_PREDICATE = /\b(under|inside|behind|within|out of|off)\s+[a-z]/i

// ── labels: names a topic, asserts nothing ───────────────────────────────────
// A gerund used as a noun head is the giveaway: "ELECTION RIGGING", "MASS DELETION".
const GERUND_NOUN = /^[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,3}\s+[A-Za-z]+ING\b$|^[A-Z][a-z]+(?:\s+[a-z]+)*\s+[a-z]+ing\.?$/
const NOUN_COMPOUND = /^[A-Z][A-Za-z0-9'’-]*(?:\s+(?:NEW|OLD|MASS|BIG|FULL|TOTAL|[A-Z][A-Za-z0-9'’-]*|[a-z]+)){0,3}\.?$/
const DATE_RANGE = /^\S+.*\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–]\s*(today|now|\d)/i

// ── emphasis: formatting rather than assertion ───────────────────────────────
const CODE_TOKEN = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/          // ROGUE_FAILURE, NO_LEAKS
const REPEATED_WORD = /^(\b\w+\b)([\s,.!]+\1\b)+[\s.!]*$/i  // "PANIC. PANIC. PANIC."
const SHOUT_ONLY = /^[A-Z\s!?.]{2,20}[!?]+$/

export function adjudicate(text, ctx = {}) {
  const t = (text ?? '').trim()
  if (!t) return { klass: 'SEGMENTATION_ERROR', why: 'empty', confidence: 'HIGH' }

  // Multi-sentence stored strings are a segmentation artefact of the old extractor, not a unit.
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).filter(Boolean)
  if (sentences.length > 1) {
    // Decide on the part that actually predicates — "DC access. Sold out." turns on "Sold out."
    const propositional = sentences.filter(s => isProposition(s))
    if (propositional.length) {
      const r = adjudicate(propositional[propositional.length - 1], ctx)
      return { ...r, why: `${r.why} (the asserting clause of a multi-sentence stored string)`, multiSentence: true }
    }
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'several short units stored as one string, none of which predicates', confidence: 'MEDIUM', multiSentence: true }
  }

  if (CODE_TOKEN.test(t)) return { klass: 'Q_EMPHASIS', why: 'underscore-joined caps token — Q\'s notation, not an assertion', confidence: 'HIGH' }
  if (REPEATED_WORD.test(t)) return { klass: 'Q_EMPHASIS', why: 'word repeated for emphasis', confidence: 'HIGH' }
  if (SHOUT_ONLY.test(t) && !isProposition(t)) return { klass: 'Q_EMPHASIS', why: 'short all-caps exclamation — emphasis, not a proposition', confidence: 'MEDIUM' }
  if (DATE_RANGE.test(t)) return { klass: 'Q_STATEMENT_OR_HEADING', why: 'a label with a date range — introduces material rather than asserting', confidence: 'MEDIUM' }

  // Q writes questions without question marks constantly; an auxiliary-initial unit is one of
  // those, and the Questions audit did not certify it. It is not a claim either way.
  if (AUX_INITIAL.test(t)) {
    return { klass: 'NEEDS_CONTEXT', why: 'opens with an auxiliary — interrogative in form and not certified as a question; not an assertion', confidence: 'LOW' }
  }

  if (!isProposition(t)) {
    // Topic words do not make a claim. "ELECTION RIGGING" names a subject and asserts nothing.
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'names a topic without predicating — no proposition that could be true or false', confidence: 'MEDIUM' }
  }

  // It asserts something. Does the post make it a takeaway rather than a fresh assertion?
  const concl = conclusionSignal(t, ctx.conclusionCtx ?? {})
  if (concl.isConclusion) {
    return { klass: 'Q_CLAIM_CONCLUSION', why: `asserts a proposition and draws it from the post — ${concl.why}`, confidence: concl.confidence, isConclusion: true }
  }
  return { klass: 'Q_CLAIM', why: `asserts a proposition — ${propositionReason(t)}`, confidence: /^[A-Z\s0-9.,'-]+$/.test(t) ? 'MEDIUM' : 'HIGH' }
}

function isProposition(s) {
  const t = s.trim()
  if (CODE_TOKEN.test(t) || REPEATED_WORD.test(t)) return false
  if (FINITE_VERB.test(t) || INFLECTED.test(t)) return true
  if (STATE_PREDICATE.test(t) || ELIDED_AUX.test(t)) return true
  if (NEGATED_FRAMING.test(t) || PREDICATE_NOMINAL.test(t) || PREP_PREDICATE.test(t)) return true
  if (PRONOUN_PREDICATE.test(t)) return true
  // A gerund-headed noun phrase or a bare noun compound predicates nothing.
  if (GERUND_NOUN.test(t) || NOUN_COMPOUND.test(t)) return false
  return false
}
function propositionReason(t) {
  if (FINITE_VERB.test(t)) return 'finite verb'
  if (INFLECTED.test(t)) return 'subject with an inflected verb'
  if (STATE_PREDICATE.test(t)) return 'elided copula with a state predicate'
  if (ELIDED_AUX.test(t)) return 'elided auxiliary (progressive or passive)'
  if (NEGATED_FRAMING.test(t)) return 'negates a framing'
  if (PREDICATE_NOMINAL.test(t)) return 'predicate nominal'
  if (PREP_PREDICATE.test(t)) return 'prepositional predicate'
  if (PRONOUN_PREDICATE.test(t)) return 'pronoun subject with a predicate'
  return 'predication present'
}

// ── self-test on the review's own examples ───────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases = [
    ['ELECTION RIGGING', 'Q_STATEMENT_OR_HEADING'],
    ['RUSSIA NEW THREAT', 'Q_STATEMENT_OR_HEADING'],
    ['Hussein timeline. 1/20/17 - today.', 'Q_STATEMENT_OR_HEADING'],
    ['AMERICA FOR SALE', 'Q_CLAIM'],
    ['DC access. Sold out.', 'Q_CLAIM'],
    ['SNOW WHITE 7 NOW OFFLINE', 'Q_CLAIM'],
    ['RUSSIA TESTING NEW MISSILES', 'Q_CLAIM'],
    ['MASS EXT EVENTS DESIGNED TO DECREASE THREAT LEVEL OF POPULATION', 'Q_CLAIM'],
    ['Not R vs D', 'Q_CLAIM'],
    ['The gift that keeps on giving.', 'Q_CLAIM'],
    ['ROGUE_FAILURE', 'Q_EMPHASIS'],
    ['NO_LEAKS', 'Q_EMPHASIS'],
    ['POTUS NEVER telegraphs his moves.', 'Q_CLAIM'],
    ['Andrew McCabe, Deputy Director - FIRED', 'Q_CLAIM'],
    ['They want you labeled by race, religion, class, sex, etc.', 'Q_CLAIM'],
    ['Will holding actually provide a better scenario?', 'NEEDS_CONTEXT'],
  ]
  let bad = 0
  for (const [t, want] of cases) {
    const r = adjudicate(t)
    const ok = r.klass === want
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.klass.padEnd(24)}${JSON.stringify(t.slice(0, 56))}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── run over the 720 ─────────────────────────────────────────────────────────
const src = JSON.parse(fs.readFileSync(path.join(OUT, 'claims-stored-uncovered.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8')).filter(q => !q.editorialNormalization)
const byNum = new Map(posts.map(p => [p.postNum, p]))
const flat = t => clean(t).replace(/\s+/g, ' ').trim()

const qByPost = new Map()
for (const q of questions) { if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, []); qByPost.get(q.postNum).push(q.text) }

const decisions = []
for (const rec of src.orphans) {
  const post = byNum.get(rec.postNum)
  const lines = clean(post?.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  const i = lines.findIndex(l => key(l) === key(rec.exactText) || key(l).includes(key(rec.exactText)))
  const prior = i > 0 ? lines.slice(0, i) : []

  const a = adjudicate(rec.exactText, {
    conclusionCtx: {
      priorUnits: prior,
      priorIsQuestion: i > 0 && /\?$/.test(lines[i - 1] ?? ''),
      questionCount: (qByPost.get(rec.postNum) ?? []).length,
      hasEvidence: /https?:\/\//i.test(post?.text ?? ''),
      isLastAssertion: i >= 0 && i === lines.length - 2,
    },
  })

  const isClaim = a.klass === 'Q_CLAIM' || a.klass === 'Q_CLAIM_CONCLUSION'
  decisions.push({
    postNum: rec.postNum, postId: post?.id ?? null,
    exactText: rec.exactText,
    verbatimInPost: (flat(post?.text ?? '')).includes(flat(rec.exactText)),
    proposedClass: a.klass,
    ...(isClaim ? {
      checkable: /\b\d|\b[A-Z]{2,}\b|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(rec.exactText),
      sourceProvided: /https?:\/\//i.test(post?.text ?? ''),
      isConclusion: Boolean(a.isConclusion),
      telegraphic: !FINITE_VERB.test(rec.exactText),
    } : {}),
    reason: a.why,
    confidence: a.confidence,
    multiSentence: Boolean(a.multiSentence),
    provenance: { source: 'stored extractor claim, uncovered by v2', adjudicator: 'adjudicate-stored-uncovered v1' },
    context: { before: i > 0 ? lines[i - 1] : null, after: i >= 0 ? lines[i + 1] ?? null : null },
  })
}

const tally = {}
for (const d of decisions) tally[d.proposedClass] = (tally[d.proposedClass] ?? 0) + 1
const promoted = decisions.filter(d => d.proposedClass === 'Q_CLAIM' || d.proposedClass === 'Q_CLAIM_CONCLUSION')
const notVerbatim = decisions.filter(d => !d.verbatimInPost)

fs.writeFileSync(path.join(OUT, 'claims-uncovered-adjudicated.json'), JSON.stringify({
  scope: 'the 720 genuinely uncovered stored claims', productionChanged: false,
  totals: { adjudicated: decisions.length, promotedToClaim: promoted.length, byClass: tally, notVerbatim: notVerbatim.length },
  decisions,
}, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = ['# Claims — the 720 uncovered stored records\n']
md.push('**The test:** does this exact Q-authored unit assert a proposition that could meaningfully be true or false?\n')
md.push('Nothing is promoted because an older extractor called it a claim, and nothing is promoted on topic words alone. `ELECTION RIGGING` carries a loaded subject and asserts nothing; `Election rigging occurred.` would. The difference is **predication, not vocabulary**.\n')
md.push('\n## Outcome\n')
md.push('| Class | Count |')
md.push('|---|---|')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
md.push(`\n**${promoted.length}** of the 720 become claims; **${(720 - promoted.length).toLocaleString()}** do not.\n`)
md.push('\n## What counts as predication\n')
md.push('| Signal | Example |')
md.push('|---|---|')
md.push('| elided copula + state | `AMERICA FOR SALE` · `DC access. Sold out.` |')
md.push('| elided auxiliary | `RUSSIA TESTING NEW MISSILES` · `MASS EXT EVENTS DESIGNED TO…` |')
md.push('| subject + inflected verb | `POTUS NEVER telegraphs his moves.` |')
md.push('| negated framing | `Not R vs D` |')
md.push('| predicate nominal | `The gift that keeps on giving.` |')
md.push('\n## What does not\n')
md.push('| Signal | Example |')
md.push('|---|---|')
md.push('| gerund-headed noun phrase | `ELECTION RIGGING` |')
md.push('| bare noun compound | `RUSSIA NEW THREAT` |')
md.push('| label with a date range | `Hussein timeline. 1/20/17 - today.` |')
md.push('| underscore-joined caps token | `ROGUE_FAILURE` · `NO_LEAKS` |')
for (const cls of Object.keys(tally)) {
  const list = decisions.filter(d => d.proposedClass === cls)
  md.push(`\n## ${cls} (${list.length.toLocaleString()})\n`)
  md.push('| Post | Exact Q wording | Conf | Attributes | Reason | Before | After |')
  md.push('|---|---|---|---|---|---|---|')
  for (const d of list.slice(0, 120)) {
    const attrs = [d.checkable && 'checkable', d.sourceProvided && 'source', d.isConclusion && 'conclusion', d.telegraphic && 'telegraphic'].filter(Boolean).join(', ')
    md.push(`| #${d.postNum} | \`${esc(d.exactText).slice(0, 62)}\` | ${d.confidence} | ${attrs} | ${esc(d.reason).slice(0, 44)} | \`${esc(d.context.before).slice(0, 20)}\` | \`${esc(d.context.after).slice(0, 20)}\` |`)
  }
  if (list.length > 120) md.push(`\n_…and ${(list.length - 120).toLocaleString()} more in the JSON._`)
}
fs.writeFileSync(path.join(OUT, 'claims-uncovered-adjudicated.md'), md.join('\n') + '\n')

console.log('\nTHE 720 UNCOVERED STORED CLAIMS\n')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`)
console.log(`\n  promoted to claim : ${promoted.length}`)
console.log(`  not verbatim      : ${notVerbatim.length}`)
console.log('\n→ audit/claims-uncovered-adjudicated.md\n')
