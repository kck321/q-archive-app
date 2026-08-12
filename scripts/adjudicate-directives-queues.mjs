// Final adjudication of everything the Directives certification queued.
//
// Four queues, per the review:
//   1. no-family residue after `operational` was added
//   2. candidates resting on a corpus-learned verb (LOW evidence)
//   3. stored actionRequest rows that fail the mood gate
//   4. units undecidable standing alone
//
// Final classes: Q_DIRECTIVE | Q_QUESTION | Q_CLAIM | Q_STATEMENT_OR_HEADING |
//                SEGMENTATION_ERROR | NEEDS_CONTEXT
//
// The mood gate is NOT weakened here — a queued unit is only promoted to Q_DIRECTIVE on
// evidence the gate could not see, never by relaxing it. Certified Questions stay frozen.
//
// AUDIT ONLY — no production write, no deploy.
//
//   node scripts/adjudicate-directives-queues.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'
import { familyOf } from './lib/imperative.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

// ── decision rules, each grounded in what the queue actually contains ────────
// A subject followed by a finite verb is an assertion, whatever it opens with. This is what
// separates "Fail they will." and "Total S.A. is a French multinational…" from real commands.
const HAS_SUBJECT_VERB = /\b(is|are|was|were|will|would|can|could|should|may|might|must|has|have|had|does|do|did)\b/i
const PRONOUN_SUBJECT = /\b(they|we|you|he|she|it|i|s\.?a\.?)\s+(will|are|is|was|were|have|has|had|can|could|would|should|do|does|did|[a-z]+s)\b/i
const PROPER_NOUN_SUBJECT = /^[A-Z][A-Za-z.&'-]*(\s+[A-Z][A-Za-z.&'-]*)*\s+(is|are|was|were|will|has|have|had)\b/
const NOUN_PHRASE_ONLY = /^[A-Z][^.!?]*[.!]?$/
const QUOTED_SCRIPTURE = /^(love|give us|help us|put on|take the|stand firm|be strong in|for our struggle|therefore put)/i
const ALL_CAPS_SLOGAN = /^[A-Z0-9\s,'&.!-]{8,}$/

export function adjudicate(text, ctx = {}) {
  const t = (text ?? '').trim()
  if (!t) return { klass: 'SEGMENTATION_ERROR', why: 'empty', confidence: 'HIGH' }

  // 1. Scripture Q quotes in full. Imperative in form, but it is someone else's text. Checked
  // FIRST: "Put on the full armor of God so that you can take your stand…" contains "you can",
  // so the subject test below would otherwise claim it.
  if (QUOTED_SCRIPTURE.test(t) && t.split(/\s+/).length > 6) {
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'scripture quoted at length — imperative in form, but not Q instructing the reader', confidence: 'MEDIUM' }
  }

  // 2. An explicit subject with a finite verb is a statement or a claim, never a command.
  if (PRONOUN_SUBJECT.test(t) || PROPER_NOUN_SUBJECT.test(t)) {
    return { klass: 'Q_CLAIM', why: 'explicit subject with a finite verb — asserts rather than instructs', confidence: 'HIGH' }
  }

  // 3. A verb-led unit that survived the mood gate and now has a family is a directive.
  const fam = familyOf(t)
  if (fam !== 'other' && !HAS_SUBJECT_VERB.test(t)) {
    return { klass: 'Q_DIRECTIVE', family: fam, why: `imperative with a ${fam} function`, confidence: 'MEDIUM' }
  }

  // 4. No verb at all and no family — a label or heading.
  if (fam === 'other' && !HAS_SUBJECT_VERB.test(t) && NOUN_PHRASE_ONLY.test(t) && t.split(/\s+/).length <= 6) {
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'short noun phrase with no verb — a label, not a command', confidence: 'MEDIUM' }
  }
  if (ALL_CAPS_SLOGAN.test(t) && fam === 'other') {
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'all-caps slogan or banner line', confidence: 'LOW' }
  }
  if (HAS_SUBJECT_VERB.test(t)) {
    return { klass: 'Q_CLAIM', why: 'contains a finite verb without an imperative head — an assertion', confidence: 'MEDIUM' }
  }
  if (fam !== 'other') {
    return { klass: 'Q_DIRECTIVE', family: fam, why: `imperative with a ${fam} function`, confidence: 'LOW' }
  }
  return { klass: 'NEEDS_CONTEXT', why: 'neither an assertion nor an instruction on the unit alone', confidence: 'LOW' }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    ['Fail they will.', 'Q_CLAIM'],
    ['Total S.A. is a French multinational integrated oil and gas company.', 'Q_CLAIM'],
    ['Resist OP will not provide enough public support for cover.', 'Q_CLAIM'],
    ['Love does not delight in evil but rejoices with the truth.', 'Q_STATEMENT_OR_HEADING'],
    ['Put on the full armor of God so that you can take your stand against the devil.', 'Q_STATEMENT_OR_HEADING'],
    ['Be proud.', 'Q_DIRECTIVE'],
    ['Report to FBI / DOJ.', 'Q_DIRECTIVE'],
    ['Attention on deck.', 'Q_DIRECTIVE'],
    ['GROUP THINK.', 'Q_STATEMENT_OR_HEADING'],
    ['PAY-FOR-PLAY SPIDER WEB.', 'Q_STATEMENT_OR_HEADING'],
  ]
  let bad = 0
  for (const [t, want] of cases) {
    const r = adjudicate(t)
    const ok = r.klass === want
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.klass.padEnd(24)}${(r.family ?? '').padEnd(14)}${JSON.stringify(t.slice(0, 52))}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── run over the queues ──────────────────────────────────────────────────────
const cert = JSON.parse(fs.readFileSync(path.join(OUT, 'directives-certified.json'), 'utf8'))

const queueOf = r => {
  if (r.klass === 'Q_DIRECTIVE' && r.needsAdjudication) return r.verbEvidence === 'corpus-learned' ? 'corpus-learned verb' : 'no family'
  if (r.klass === 'Q_STATEMENT_OR_CLAIM') return 'stored actionRequest, fails mood'
  if (r.klass === 'NEEDS_CONTEXT') return 'undecidable standing alone'
  if (r.klass === 'SEGMENTATION_ERROR') return 'segmentation error'
  return null
}

const decisions = []
for (const r of cert.rows) {
  const q = queueOf(r)
  if (!q) continue
  const a = q === 'segmentation error'
    ? { klass: 'SEGMENTATION_ERROR', why: 'fragment of a split sentence', confidence: 'HIGH' }
    : q === 'undecidable standing alone'
      ? { klass: 'NEEDS_CONTEXT', why: r.why, confidence: 'LOW' }
      : adjudicate(r.qSourceText, r.context)
  decisions.push({
    queue: q,
    postNum: r.postNum, postId: r.postId,
    qSourceText: r.qSourceText,
    currentClassification: r.storedAsActionRequest ? 'stored actionRequest' : 'derived, not stored',
    proposedClassification: a.klass,
    family: a.klass === 'Q_DIRECTIVE' ? (a.family ?? r.family) : null,
    reason: a.why,
    confidence: a.confidence,
    context: r.context,
  })
}

const byQueue = {}
for (const d of decisions) {
  byQueue[d.queue] ??= {}
  byQueue[d.queue][d.proposedClassification] = (byQueue[d.queue][d.proposedClassification] ?? 0) + 1
}
const promoted = decisions.filter(d => d.proposedClassification === 'Q_DIRECTIVE')
const famAdds = {}
for (const d of promoted) famAdds[d.family] = (famAdds[d.family] ?? 0) + 1

const certified = cert.totals.directiveOccurrences
const revised = certified + promoted.length

fs.writeFileSync(path.join(OUT, 'directives-queues-adjudicated.json'), JSON.stringify({
  scope: 'the four queues from the directives certification',
  moodGateWeakened: false, questionsFrozen: true, productionChanged: false,
  totals: { certifiedBefore: certified, promotedToDirective: promoted.length, revised, byQueue, familyAdditions: famAdds },
  decisions,
}, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = ['# Directives — adjudication of the four queues\n']
md.push('Mood gate unchanged; a queued unit is promoted only on evidence the gate could not see. Certified Questions stay frozen. **No production write, no deploy.**\n')
md.push('\n## Outcome by queue\n')
for (const [q, counts] of Object.entries(byQueue)) {
  md.push(`\n**${q}** — ${Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString()} units\n`)
  md.push('| Proposed | Count |')
  md.push('|---|---|')
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
}
md.push('\n## Revised directive total\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Certified candidate before adjudication | ${certified.toLocaleString()} |`)
md.push(`| Promoted from the queues | +${promoted.length.toLocaleString()} |`)
md.push(`| **Revised directive occurrences** | **${revised.toLocaleString()}** |`)
md.push('\n### Family additions\n')
md.push('| Family | Added |')
md.push('|---|---|')
for (const [f, n] of Object.entries(famAdds).sort((a, b) => b[1] - a[1])) md.push(`| ${f} | ${n.toLocaleString()} |`)
md.push('\n## What the rules turn on\n')
md.push('- **An explicit subject with a finite verb is never a command.** `Fail they will.` is Yoda-order but still has a subject; `Total S.A. is a French multinational…` opens with a company name, not the verb "total"; `Resist OP will not provide enough public support for cover.` has "OP" as its subject. All three passed the mood gate and are claims.')
md.push('- **Scripture quoted at length is not Q instructing.** `Put on the full armor of God…`, `Love does not delight in evil…`, `Give us this day our daily bread…` are imperative in form but are someone else\'s words reproduced.')
md.push('- **A short noun phrase with no verb is a label.** `GROUP THINK.`, `PAY-FOR-PLAY SPIDER WEB.`, `Rank & File.`\n')
for (const [q] of Object.entries(byQueue)) {
  const list = decisions.filter(d => d.queue === q)
  md.push(`\n## ${q} (${list.length.toLocaleString()})\n`)
  md.push('| Post | Q source text | Current | Proposed | Family | Conf | Reason | Before | After |')
  md.push('|---|---|---|---|---|---|---|---|---|')
  for (const d of list.slice(0, 150)) {
    md.push(`| #${d.postNum} | \`${esc(d.qSourceText).slice(0, 66)}\` | ${d.currentClassification} | **${d.proposedClassification}** | ${d.family ?? ''} | ${d.confidence} | ${esc(d.reason).slice(0, 48)} | \`${esc(d.context?.before).slice(0, 20)}\` | \`${esc(d.context?.after).slice(0, 20)}\` |`)
  }
  if (list.length > 150) md.push(`\n_…and ${(list.length - 150).toLocaleString()} more in the JSON._`)
}
fs.writeFileSync(path.join(OUT, 'directives-queues-adjudicated.md'), md.join('\n') + '\n')

console.log('\nDIRECTIVE QUEUES — ADJUDICATED\n')
for (const [q, counts] of Object.entries(byQueue)) {
  console.log(`  ${q}`)
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(5)}  ${k}`)
}
console.log(`\n  certified candidate : ${certified.toLocaleString()}`)
console.log(`  promoted            : +${promoted.length.toLocaleString()}`)
console.log(`  REVISED DIRECTIVES  : ${revised.toLocaleString()}`)
console.log('\n→ audit/directives-queues-adjudicated.md\n')
