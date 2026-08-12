// Final adjudication — the taxonomy applied to every unit, and the certified total.
//
// v2.1 remains frozen: nothing here scores or segments. This reads the audit and assigns the
// agreed final taxonomy, then counts.
//
//   Q_QUESTION               Q seeks an answer, definition, identification, explanation…
//   Q_DIRECTIVE              Q instructs an action or analytical operation
//   Q_STATEMENT_OR_HEADING   a heading, label or declarative
//   SEGMENTATION_ERROR       a fragment produced by splitting, not a unit Q wrote
//   EDITORIAL_NORMALIZATION  a paraphrase written by an earlier extractor
//
// plus countsTowardQQuestionTotal, which is the field that answers the question.
//
// SCOPE NOTE — the review asked for the 34 NEEDS_CONTEXT records. Applying the taxonomy to
// only those would leave the total incoherent: "Reconcile." and "Compare." also appear among
// the 50 ADD decisions AND among the 6,287 already-confirmed units. If they are directives in
// one place they are directives everywhere, so the taxonomy is applied to ALL units and the
// effect on each group is reported separately.
//
// AUDIT ONLY. No production data is touched.
//
//   node scripts/finalize-questions.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'questions-audit-v2.json'), 'utf8'))
const adjudicated = JSON.parse(fs.readFileSync(path.join(OUT, 'questions-adjudicated.json'), 'utf8'))

// ── the distinction ──────────────────────────────────────────────────────────
// The requested OUTPUT decides it, not the imperative mood. "Define X." asks for information,
// so the answer is the deliverable — a question. "Compare X." asks the reader to perform an
// analysis; the deliverable is work, not an answer — a directive. Both are imperative.
const INFO_REQUEST = /^(define|identify|explain|describe|clarify|name|list)\b/i
const ANALYTICAL_DIRECTIVE = /^(compare|reconcile|follow|think|read|watch|listen|dig|research|review|refer|apply|expand|learn|study|trace|track|search|find|archive|save|share|meme|pray|trust|remember|consider|look|note|check|verify|confirm|understand|prepare|organize|spread|rally|stand|fight|hold|use|keep|stay|protect|defend|be|have|let)\b/i

// "List of Republicans…:" — List is a NOUN introducing a list, not a request. Same trap as
// "Name" in v2.1: the word is both.
const LIST_AS_NOUN = /^list\s+of\b/i
const NAME_AS_NOUN = /^name\s+(is|are|was|were|can|could|will|would|shall|should|may|might|must|has|have|had|we|you|they|i|he|she|it|worth|of|for|in|on|to)\b/i

// Explicit calls from the review that a rule alone cannot reach, because they depend on the
// preceding line rather than the sentence itself.
const OVERRIDES = new Map([
  ['identify and list', { klass: 'Q_DIRECTIVE', why: 'review call: the preceding sentence already states what to investigate' }],
])

function taxonomy(text, ctx = {}) {
  const t = (text ?? '').trim()
  const k = t.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()

  const ov = OVERRIDES.get(k)
  if (ov) return { klass: ov.klass, counts: false, why: ov.why, semanticFunction: 'analytical_directive', grammaticalForm: 'imperative' }

  // A heading: a noun phrase introducing material, usually ending in a colon.
  if (LIST_AS_NOUN.test(t) || NAME_AS_NOUN.test(t) || /:$/.test(t)) {
    return { klass: 'Q_STATEMENT_OR_HEADING', counts: false, why: 'noun phrase or heading, not a request', semanticFunction: 'heading', grammaticalForm: 'declarative' }
  }

  if (/\?$/.test(t)) {
    return { klass: 'Q_QUESTION', counts: true, why: 'interrogative, ends with "?"', semanticFunction: 'question', grammaticalForm: 'interrogative' }
  }

  if (INFO_REQUEST.test(t)) {
    return { klass: 'Q_QUESTION', counts: true, why: 'information request — the deliverable is an answer', semanticFunction: 'information_request', grammaticalForm: 'imperative' }
  }

  if (ANALYTICAL_DIRECTIVE.test(t)) {
    return { klass: 'Q_DIRECTIVE', counts: false, why: 'analytical or action instruction — the deliverable is work, not an answer', semanticFunction: 'analytical_directive', grammaticalForm: 'imperative' }
  }

  // No question mark, not a request, not an instruction — a statement that the scorer
  // accepted on inversion or corroboration alone.
  if (ctx.score !== undefined && ctx.score >= 0.5) {
    return { klass: 'Q_QUESTION', counts: true, why: 'interrogative syntax or corroborated by Q\'s own usage elsewhere', semanticFunction: 'question', grammaticalForm: 'declarative' }
  }
  return { klass: 'Q_STATEMENT_OR_HEADING', counts: false, why: 'declarative', semanticFunction: 'statement', grammaticalForm: 'declarative' }
}

// ── decisions already made, kept ─────────────────────────────────────────────
const segErrors = new Set(
  adjudicated.decisions.filter(d => d.decision === 'SEGMENTATION_ERROR').map(d => `${d.postNum}|${d.qSourceText}`))
const editorial = adjudicated.decisions.filter(d => d.group === 'STORED_NOT_IN_SOURCE')

// ── apply to every audited unit ──────────────────────────────────────────────
const finals = []
const tally = {}
const bump = (k, g) => { tally[g] ??= {}; tally[g][k] = (tally[g][k] ?? 0) + 1 }

for (const r of audit.records) {
  const id = `${r.postNum}|${r.sourceText}`
  let klass, counts, why, sf, gf

  if (segErrors.has(id) || r.segmentationRisk) {
    klass = 'SEGMENTATION_ERROR'; counts = false
    why = 'fragment produced by splitting — not a unit Q wrote'
    sf = 'fragment'; gf = 'fragment'
  } else {
    const t = taxonomy(r.sourceText, { score: r.semanticQuestionScore })
    klass = t.klass; counts = t.counts; why = t.why; sf = t.semanticFunction; gf = t.grammaticalForm
  }

  const group = r.status === 'MISSED' ? 'MISSED (was 98)' : 'CONFIRMED (was 6,287)'
  bump(klass, group)

  finals.push({
    postNum: r.postNum,
    qSourceText: r.sourceText,
    finalClass: klass,
    countsTowardQQuestionTotal: counts,
    semanticFunction: sf,
    grammaticalForm: gf,
    reason: why,
    previousStatus: r.status,
    semanticQuestionScore: r.semanticQuestionScore,
    questionMarkPresent: r.questionMarkPresent,
  })
}

// Editorial normalisations never count, whatever they say.
for (const d of editorial) {
  const keep = d.decision === 'KEEP_AS_EDITORIAL_NORMALIZATION'
  const klass = keep ? 'EDITORIAL_NORMALIZATION' : d.decision === 'REMOVE_FROM_Q_QUESTIONS' ? 'REMOVE' : 'EDITORIAL_NORMALIZATION'
  bump(klass, 'STORED_NOT_IN_SOURCE (144)')
  finals.push({
    postNum: d.postNum,
    qSourceText: d.qSourceText,
    storedText: d.currentStoredText,
    finalClass: klass,
    countsTowardQQuestionTotal: false,
    semanticFunction: 'editorial_normalization',
    grammaticalForm: null,
    reason: keep
      ? 'paraphrase of Q\'s wording — searchable with provenance, never presented or counted as Q\'s words'
      : 'no Q line accounts for it',
    provenance: d.provenance ?? null,
    previousStatus: d.decision,
  })
}

// ── the certified total ──────────────────────────────────────────────────────
const counted = finals.filter(f => f.countsTowardQQuestionTotal)
const distinct = new Set(counted.map(f => f.qSourceText.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()))
const postsWith = new Set(counted.map(f => f.postNum))

const totals = {
  certifiedQuestionUnits: counted.length,
  certifiedDistinctQuestions: distinct.size,
  postsContainingAQuestion: postsWith.size,
  reclassifiedAsDirective: finals.filter(f => f.finalClass === 'Q_DIRECTIVE').length,
  reclassifiedAsStatementOrHeading: finals.filter(f => f.finalClass === 'Q_STATEMENT_OR_HEADING').length,
  segmentationErrors: finals.filter(f => f.finalClass === 'SEGMENTATION_ERROR').length,
  editorialNormalizations: finals.filter(f => f.finalClass === 'EDITORIAL_NORMALIZATION').length,
  removed: finals.filter(f => f.finalClass === 'REMOVE').length,
  anonQuestionsExcluded: audit.totals.anonExcluded,
}

fs.writeFileSync(path.join(OUT, 'questions-final.json'), JSON.stringify({ frozenAuditor: 'v2.1', totals, tally, finals }, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = []
md.push('# Q Drops — certified question count\n')
md.push('Auditor v2.1 (frozen). Final taxonomy applied to every unit. **Nothing applied to production.**\n')
md.push('\n## The answer\n')
md.push('| Measure | Count |')
md.push('|---|---|')
md.push(`| **Q-authored questions (occurrences)** | **${totals.certifiedQuestionUnits.toLocaleString()}** |`)
md.push(`| **Distinct questions** | **${totals.certifiedDistinctQuestions.toLocaleString()}** |`)
md.push(`| Posts containing at least one | ${totals.postsContainingAQuestion.toLocaleString()} of 4,966 |`)
md.push('\n## Excluded, and why\n')
md.push('| Class | Count | Counts toward the total |')
md.push('|---|---|---|')
md.push(`| Q_DIRECTIVE | ${totals.reclassifiedAsDirective.toLocaleString()} | no — instruction, not a question |`)
md.push(`| Q_STATEMENT_OR_HEADING | ${totals.reclassifiedAsStatementOrHeading.toLocaleString()} | no |`)
md.push(`| SEGMENTATION_ERROR | ${totals.segmentationErrors.toLocaleString()} | no — a fragment, not a unit Q wrote |`)
md.push(`| EDITORIAL_NORMALIZATION | ${totals.editorialNormalizations.toLocaleString()} | no — not Q's words |`)
md.push(`| Removed outright | ${totals.removed.toLocaleString()} | no — no Q line accounts for it |`)
md.push(`| Quoted/anon questions | ${totals.anonQuestionsExcluded.toLocaleString()} | no — not Q-authored |`)

md.push('\n## Effect by group\n')
for (const [group, counts] of Object.entries(tally)) {
  md.push(`\n**${group}**\n`)
  md.push('| Final class | Count |')
  md.push('|---|---|')
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
}

const directives = finals.filter(f => f.finalClass === 'Q_DIRECTIVE')
md.push(`\n## Reclassified as directives (${directives.length.toLocaleString()})\n`)
md.push('These were counted as questions before this pass. They instruct an analytical operation, so they no longer inflate the literal question total.\n')
md.push('| Post | Text (exact) | Why |')
md.push('|---|---|---|')
for (const f of directives.slice(0, 120)) md.push(`| #${f.postNum} | \`${esc(f.qSourceText).slice(0, 80)}\` | ${esc(f.reason).slice(0, 70)} |`)
if (directives.length > 120) md.push(`\n_…and ${(directives.length - 120).toLocaleString()} more in the JSON._`)

md.push('\n## The rule\n')
md.push('**The requested output decides it, not the mood of the verb.** `Define X.` and `Compare X.` are both imperative; the first asks for information, so the deliverable is an answer — a question. The second asks the reader to perform an analysis, so the deliverable is work — a directive.\n')
md.push('- **Q_QUESTION** — `?`, or `Define` / `Identify` / `Explain` / `Describe` / `Clarify` / `List <object>` / `Name <object>`.')
md.push('- **Q_DIRECTIVE** — `Compare` / `Reconcile` / `Follow` / `Think` / `Read` / `Dig` / `Research` / `Trace` …')
md.push('- **Q_STATEMENT_OR_HEADING** — `List of Republicans…:` is a noun introducing a list, not a request. Anything ending in `:` is a heading.')
md.push('- **EDITORIAL_NORMALIZATION** — searchable, carries provenance, `neverDisplayAsQ: true`, never counted.')

md.push('\n## Scope note\n')
md.push('The review asked for the 34 `NEEDS_CONTEXT` records. Applying the taxonomy to only those would have left the total incoherent: `Reconcile.` and `Compare.` also appear among the 50 `ADD` decisions **and** among the 6,287 already-confirmed units. A word cannot be a directive in one bucket and a question in another, so the taxonomy was applied to every unit and the effect on each group is reported above.')

fs.writeFileSync(path.join(OUT, 'questions-final.md'), md.join('\n') + '\n')

console.log('\nCERTIFIED\n')
console.log(`  Q-authored questions (occurrences) : ${totals.certifiedQuestionUnits.toLocaleString()}`)
console.log(`  distinct questions                 : ${totals.certifiedDistinctQuestions.toLocaleString()}`)
console.log(`  posts containing one               : ${totals.postsContainingAQuestion.toLocaleString()} / 4,966`)
console.log('\nEXCLUDED')
console.log(`  directives                         : ${totals.reclassifiedAsDirective.toLocaleString()}`)
console.log(`  statements / headings              : ${totals.reclassifiedAsStatementOrHeading.toLocaleString()}`)
console.log(`  segmentation errors                : ${totals.segmentationErrors.toLocaleString()}`)
console.log(`  editorial normalisations           : ${totals.editorialNormalizations.toLocaleString()}`)
console.log(`  removed outright                   : ${totals.removed.toLocaleString()}`)
console.log(`  quoted/anon                        : ${totals.anonQuestionsExcluded.toLocaleString()}`)
console.log('\n→ audit/questions-final.md')
