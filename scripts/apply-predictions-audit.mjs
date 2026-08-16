// Apply the 2026-08-16 sentence-level Predictions audit and write its ledger + review backlog.
//
// The rulings are canonical artifacts under audit/predictions-audit/. This script does not own
// the materialisation — apply-claims.mjs calls the same transform on its way to posts.json, so
// re-deriving the claims artifact cannot erase the audit. Run this one to see the numbers, the
// per-record ledger and the backlog; run apply-claims.mjs to move production.
//
//   node scripts/apply-predictions-audit.mjs [--write]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyPredictionsAudit, AUDIT_DIR, loadPhase } from './lib/predictionsAudit.mjs'
import { key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const write = process.argv.includes('--write')
const final = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/claims-final.json'), 'utf8'))

const before = { claims: final.rows.length, predictions: final.predictions.length }
const { rows, predictions, report, ledger } = applyPredictionsAudit(final)

console.log('\nPREDICTIONS AUDIT — 2026-08-16\n')
console.log(`  Predictions ${before.predictions} -> ${predictions.length}`)
console.log(`  Claims      ${before.claims} -> ${rows.length}`)
console.log('\n  BY PHASE')
console.log(`    P1  moved to Claims        ${report.p1Moved}${report.p1MovedDuplicate ? ` (+${report.p1MovedDuplicate} already in Claims)` : ''}`)
console.log(`    P1  removed                ${report.p1Removed}`)
console.log(`    P2  excluded to review     ${report.p2Excluded}`)
console.log(`    P3  sentences applied      ${report.p3Replaced}`)
console.log(`    P4  Claims occurrences out ${report.p4ClaimsRemoved}`)
console.log(`    P4  Predictions added      ${report.p4Added} (${report.p4Duplicate} duplicate post+sentence)`)
console.log(`    P5  Predictions added      ${report.p5Added} (${report.p5Duplicate} duplicate post+sentence)`)

// The end state the audit specifies, checked here rather than asserted in prose.
const retained = predictions.filter(p => p.confidence !== 'AUDIT_HIGH_CONFIDENCE').length
const dupes = new Map()
for (const p of predictions) {
  const k = `${p.postNum}|${key(p.plainSentence ?? p.exactText)}`
  dupes.set(k, (dupes.get(k) ?? 0) + 1)
}
const duplicatePairs = [...dupes].filter(([, n]) => n > 1)
const tail = predictions.filter(p => p.postNum >= 4954 && p.confidence === 'AUDIT_HIGH_CONFIDENCE')

const checks = [
  ['active high-confidence Predictions = 595', predictions.length === 595, predictions.length],
  ['retained current rows = 501', retained === 501, retained],
  ['unique additions moved from Claims = 66', report.p4Added === 66, report.p4Added],
  ['independently found additions = 28', report.p5Added === 28, report.p5Added],
  ['73 technical nonpredictions absent', report.p1Moved + report.p1MovedDuplicate + report.p1Removed === 73, report.p1Moved + report.p1MovedDuplicate + report.p1Removed],
  ['   of which moved to Claims = 47', report.p1Moved + report.p1MovedDuplicate === 47, report.p1Moved + report.p1MovedDuplicate],
  ['   of which removed = 26', report.p1Removed === 26, report.p1Removed],
  ['56 arguable rows excluded', report.p2Excluded === 56, report.p2Excluded],
  ['130 fragment replacements applied', report.p3Replaced === 130, report.p3Replaced],
  ['68 Claims occurrences removed', report.p4ClaimsRemoved === 68, report.p4ClaimsRemoved],
  ['no duplicate post + sentence pairs', duplicatePairs.length === 0, `${duplicatePairs.length}`],
  ['posts 4954-4966 contributed 0', tail.length === 0, tail.length],
  ['no unmatched records', report.errors.length === 0, report.errors.length],
]
console.log('\n  END STATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(42)} ${got}`) }
if (report.errors.length) console.log('\n  ERRORS\n' + report.errors.map(e => `    ${e}`).join('\n'))
if (duplicatePairs.length) console.log('\n  DUPLICATES\n' + duplicatePairs.map(([k, n]) => `    ${k} ×${n}`).join('\n'))

if (write) {
  // Ledger: one line per record, all 403, so progress survives a lost chat.
  fs.writeFileSync(path.join(AUDIT_DIR, 'ledger.jsonl'), ledger.map(l => JSON.stringify(l)).join('\n') + '\n')

  // Review backlog: everything deliberately held back from the active list.
  const p2 = loadPhase('P2').records.map(r => ({ phase: 'P2', post: r.post, sentence: r.reviewSentence, wasInApp: r.match, category: r.category, why: r.why }))
  const r1 = loadPhase('R1').records.map(r => ({ phase: 'R1', post: r.post, sentence: r.reviewSentence, staysInClaims: r.match, category: 'Arguable Claims-to-Predictions move', why: r.why }))
  const r2 = loadPhase('R2').records.map(r => ({ phase: 'R2', post: r.post, sentence: r.reviewSentence, postWording: r.original, category: 'Possible missing Prediction', why: r.why }))
  const backlog = {
    generated: '2026-08-16',
    purpose: 'Policy-dependent rows held OUT of the active high-confidence Predictions list. Nothing here is decided; each needs an owner ruling.',
    totals: { total: p2.length + r1.length + r2.length, P2: p2.length, R1: r1.length, R2: r2.length },
    items: [...p2, ...r1, ...r2],
    r3Evidence: loadPhase('R3'),
  }
  fs.writeFileSync(path.join(AUDIT_DIR, 'review-backlog.json'), JSON.stringify(backlog, null, 2) + '\n')

  const md = [
    '# Predictions review backlog — 2026-08-16',
    '',
    `${backlog.totals.total} rows are held OUT of the active high-confidence Predictions list pending an owner ruling.`,
    'None of them is decided here. Each is a policy question the audit deliberately refused to answer.',
    '',
    `- **P2 — ${p2.length}** arguable rows that WERE published as Predictions and no longer are`,
    `- **R1 — ${r1.length}** arguable Claims that stay in Claims rather than moving`,
    `- **R2 — ${r2.length}** possible missing Predictions that were not added`,
    '',
    '## P2 — withdrawn from the published set',
    '',
    ...p2.map(r => `- **#${r.post}** — ${r.sentence}\n  - _${r.category}._ ${r.why}`),
    '',
    '## R1 — arguable Claims-to-Predictions moves (left in Claims)',
    '',
    ...r1.map(r => `- **#${r.post}** — ${r.sentence}\n  - ${r.why}`),
    '',
    '## R2 — possible missing Predictions (not added)',
    '',
    ...r2.map(r => `- **#${r.post}** — ${r.sentence}\n  - ${r.why}`),
    '',
    '## R3 — posts 4954-4966',
    '',
    'All thirteen were read; none yielded a high-confidence Prediction.',
    '#4966 "We will be repressed no more." is carried in R1 as an arguable vow.',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(AUDIT_DIR, 'review-backlog.md'), md)

  console.log(`\n  ledger.jsonl        ${ledger.length} records`)
  console.log(`  review-backlog      ${backlog.totals.total} items held for review`)
}

console.log(failed ? `\n${failed} check(s) FAILED.` : '\nEnd state matches the audit exactly.')
process.exit(failed ? 1 : 0)
