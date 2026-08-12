// One unified certified Directives dataset, with the certification invariant enforced.
//
// WHY THIS EXISTS: the certification pass and the queue adjudication were two scripts writing
// two artifacts, and their numbers were reported side by side as though they were one set —
// family totals summing to 2,277 next to a headline of 2,422. Nothing was misclassified (all
// 145 promotions carry a family), but two disjoint number sets presented as one is exactly how
// a sidebar count ends up disagreeing with a post count later.
//
// So the merge happens HERE, once, and the invariant is a gate rather than a claim:
//
//   sum(certified directive families) === certified directive occurrences
//   NEEDS_CONTEXT is never part of that total
//   no unit appears twice
//   every certified directive has one of the seven agreed families
//
// AUDIT ONLY — no production write, no deploy.
//
//   node scripts/reconcile-directives.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const cert = JSON.parse(fs.readFileSync(path.join(OUT, 'directives-certified.json'), 'utf8'))
const queues = JSON.parse(fs.readFileSync(path.join(OUT, 'directives-queues-adjudicated.json'), 'utf8'))
const qs = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8')).filter(q => !q.editorialNormalization)

const FAMILIES = ['cognition', 'research', 'morale', 'attention', 'operational', 'dissemination', 'prohibition']

// Every OCCURRENCE is a row, exactly as the Questions dataset treats them: Q writing
// "Trace background." twice in #1008 is two directives, not one. Collapsing on
// postNum+text would silently drop 53 real occurrences.
//
// What must never happen is the SAME occurrence arriving from both sources — a unit already
// certified being promoted again out of a queue. That is the double-count worth gating on,
// and it is checked separately below.
const final = []
const add = (rec, source) => final.push({ ...rec, source })

// 1. Directives certified directly by the full-corpus pass.
for (const r of cert.rows) {
  if (!r.countsAsDirective) continue
  add({
    postNum: r.postNum, postId: r.postId, qSourceText: r.qSourceText,
    family: r.family, confidence: r.confidence,
    alsoCertifiedQuestion: Boolean(r.alsoCertifiedQuestion),
    klass: r.klass, storedAsActionRequest: r.storedAsActionRequest,
  }, 'certification')
}

// 2. Directives promoted out of the adjudication queues.
for (const d of queues.decisions) {
  if (d.proposedClassification !== 'Q_DIRECTIVE') continue
  add({
    postNum: d.postNum, postId: d.postId, qSourceText: d.qSourceText,
    family: d.family, confidence: d.confidence,
    alsoCertifiedQuestion: false,
    klass: 'Q_DIRECTIVE', storedAsActionRequest: d.currentClassification === 'stored actionRequest',
    promotedFromQueue: d.queue,
  }, 'queue adjudication')
}

const rows = final
const held = queues.decisions.filter(d => d.proposedClassification === 'NEEDS_CONTEXT')

// Cross-source double-count check: no promoted unit may already be certified.
const certKeys = new Set(rows.filter(r => r.source === 'certification').map(r => `${r.postNum}|${key(r.qSourceText)}`))
const dupes = rows.filter(r => r.source === 'queue adjudication' && certKeys.has(`${r.postNum}|${key(r.qSourceText)}`))

// In-post repeats, reported the same way Questions reports them.
const groups = new Map()
for (const r of rows) {
  const k = `${r.postNum}|${key(r.qSourceText)}`
  groups.set(k, (groups.get(k) ?? 0) + 1)
}
const repeatExtras = [...groups.values()].reduce((n, c) => n + c - 1, 0)

// ── invariant gate ───────────────────────────────────────────────────────────
const famTally = {}
for (const r of rows) famTally[r.family] = (famTally[r.family] ?? 0) + 1
const famSum = Object.values(famTally).reduce((a, b) => a + b, 0)
const noFamily = rows.filter(r => !FAMILIES.includes(r.family))
const heldLeaked = rows.filter(r => held.some(h => h.postNum === r.postNum && key(h.qSourceText) === key(r.qSourceText)))

const checks = [
  ['sum(families) === occurrences', famSum === rows.length, `${famSum} vs ${rows.length}`],
  ['every directive has an agreed family', noFamily.length === 0, `${rows.length - noFamily.length}/${rows.length}`],
  ['no unit counted twice across sources', dupes.length === 0, `${dupes.length} cross-source duplicate(s)`],
  ['NEEDS_CONTEXT excluded from the total', heldLeaked.length === 0, `${held.length} held, ${heldLeaked.length} leaked`],
  ['certification + promotions reconcile', rows.length === cert.totals.directiveOccurrences + queues.totals.promotedToDirective, `${cert.totals.directiveOccurrences} + ${queues.totals.promotedToDirective} = ${rows.length}`],
]

const distinct = new Set(rows.map(r => key(r.qSourceText)))
const postsWith = new Set(rows.map(r => r.postNum))
const overlap = rows.filter(r => r.alsoCertifiedQuestion)
const qOcc = qs.length
const qPosts = new Set(qs.map(q => q.postNum))
const bothPosts = [...postsWith].filter(n => qPosts.has(n))

console.log('\nDIRECTIVES — RECONCILED\n')
console.log('  INVARIANT GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(40)} ${got}`) }
for (const d of dupes.slice(0, 5)) console.log(`      cross-source: #${d.postNum} ${JSON.stringify(d.qSourceText.slice(0, 56))}`)
for (const r of noFamily.slice(0, 5)) console.log(`      no family: #${r.postNum} ${JSON.stringify(r.qSourceText.slice(0, 56))}`)
if (failed) { console.error(`\n${failed} invariant check(s) FAILED — not certifiable.\n`); process.exit(1) }

console.log('\n  FINAL CERTIFIED DIRECTIVES')
console.log(`    occurrences               : ${rows.length.toLocaleString()}`)
console.log(`    distinct (canonical key)  : ${distinct.size.toLocaleString()}`)
console.log(`    posts containing one      : ${postsWith.size.toLocaleString()}`)
console.log(`    in-post repeats           : ${repeatExtras} (Q writing the same directive twice in one drop)`)
console.log('\n    by family:')
for (const f of FAMILIES) console.log(`      ${String(famTally[f] ?? 0).padStart(5)}  ${f}`)
console.log(`      ${String(famSum).padStart(5)}  = total`)
console.log('\n  QUESTION <-> DIRECTIVE OVERLAP')
console.log(`    units that are both       : ${overlap.length}`)
console.log(`      information-request imperatives : ${overlap.filter(r => r.klass === 'Q_QUESTION_AND_DIRECTIVE').length}`)
console.log(`      directive-wrapped questions     : ${overlap.filter(r => r.klass === 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION').length}`)
console.log(`    posts with both           : ${bothPosts.length.toLocaleString()}`)
console.log(`\n  held at NEEDS_CONTEXT (excluded) : ${held.length}`)

const totals = {
  occurrences: rows.length, distinct: distinct.size, posts: postsWith.size, inPostRepeats: repeatExtras,
  byFamily: famTally, familySum: famSum,
  overlapWithQuestions: {
    units: overlap.length,
    informationRequestImperatives: overlap.filter(r => r.klass === 'Q_QUESTION_AND_DIRECTIVE').length,
    directiveWrappedQuestions: overlap.filter(r => r.klass === 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION').length,
    postsWithBoth: bothPosts.length,
  },
  questionsFrozen: { occurrences: qOcc, posts: qPosts.size },
  heldNeedsContext: held.length,
  fromCertification: rows.filter(r => r.source === 'certification').length,
  fromQueueAdjudication: rows.filter(r => r.source === 'queue adjudication').length,
}
fs.writeFileSync(path.join(OUT, 'directives-final.json'), JSON.stringify({ invariantsPassed: true, productionChanged: false, totals, rows }, null, 1))

const md = ['# Q Drops — Directives, final reconciled totals\n']
md.push('One unified set. The invariant is a **gate in `scripts/reconcile-directives.mjs`**, not a claim: the script exits non-zero unless `sum(families) === occurrences`, every directive has one of the seven agreed families, no unit is counted twice, and no `NEEDS_CONTEXT` record is in the total.\n')
md.push('\n## The reconciliation issue, and what it was\n')
md.push('The certification pass and the queue adjudication wrote two artifacts, and their numbers were reported side by side as if they were one set — family totals summing to **2,277** beside a headline of **2,422**. It was a reporting fault only: **all 145 promoted directives carry a family**, none were left unresolved. The merge now happens once, here, so the two can no longer be quoted apart.\n')
md.push('\n## Where the 145 went\n')
md.push('| Family | From certification | Promoted from queues | Final |')
md.push('|---|---|---|---|')
const certFam = cert.totals.byFamily
const promFam = queues.totals.familyAdditions
for (const f of FAMILIES) md.push(`| ${f} | ${(certFam[f] ?? 0).toLocaleString()} | +${promFam[f] ?? 0} | **${(famTally[f] ?? 0).toLocaleString()}** |`)
md.push(`| **Total** | **${Object.values(certFam).reduce((a, b) => a + b, 0).toLocaleString()}** | **+${queues.totals.promotedToDirective}** | **${famSum.toLocaleString()}** |`)
md.push('\nPromoted directives by originating queue:\n')
md.push('| Queue | Promoted | Left as claim / statement / held |')
md.push('|---|---|---|')
for (const [q, counts] of Object.entries(queues.totals.byQueue)) {
  const p = counts.Q_DIRECTIVE ?? 0
  const rest = Object.entries(counts).filter(([k]) => k !== 'Q_DIRECTIVE').reduce((a, [, n]) => a + n, 0)
  md.push(`| ${q} | ${p} | ${rest.toLocaleString()} |`)
}
md.push('\n## Final certified Directives\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Directive occurrences | **${rows.length.toLocaleString()}** |`)
md.push(`| Distinct (canonical \`key()\`) | ${distinct.size.toLocaleString()} |`)
md.push(`| Posts containing a directive | ${postsWith.size.toLocaleString()} |`)
md.push(`| In-post repeats included | ${repeatExtras} |`)
md.push(`| Held at NEEDS_CONTEXT (excluded) | ${held.length} |`)
md.push('\n### By family\n')
md.push('| Family | Count |')
md.push('|---|---|')
for (const f of FAMILIES) md.push(`| ${f} | ${(famTally[f] ?? 0).toLocaleString()} |`)
md.push(`| **Sum** | **${famSum.toLocaleString()}** |`)
md.push('\n## Question ↔ Directive overlap\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Units that are BOTH | **${overlap.length}** |`)
md.push(`| — information-request imperatives | ${totals.overlapWithQuestions.informationRequestImperatives} |`)
md.push(`| — directive-wrapped questions | ${totals.overlapWithQuestions.directiveWrappedQuestions} |`)
md.push(`| Posts containing both a question and a directive | ${bothPosts.length.toLocaleString()} |`)
md.push(`\nEach overlapping unit is counted **once in Questions and once in Directives**, never twice within either section. Questions remain frozen at ${qOcc.toLocaleString()} occurrences across ${qPosts.size.toLocaleString()} posts.\n`)
fs.writeFileSync(path.join(OUT, 'directives-final.md'), md.join('\n') + '\n')
console.log('\n→ audit/directives-final.md\n')
