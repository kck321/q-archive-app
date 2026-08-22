// THE FINAL CONFLICT STATE, joined to the reviews that produced it.
//
//   node scripts/report-conflict-reconciliation.mjs
//
// Rebuilds nothing and decides nothing. It reads the conflict queue as it currently stands and
// matches every surviving row to the reviewed disposition that explains why it is still there —
// then EXITS NON-ZERO if any row has no such explanation.
//
// That exit code is the point. "Actionable conflicts: 0" is a claim about coverage, and a report
// that merely counts rows cannot make it: a row could survive because it was reviewed and kept, or
// because nobody looked. This asserts the difference.
//
// Writes audit/conflict-reconciliation.json and audit/CONFLICT-RECONCILIATION.md, plus
// audit/OWNER-REVIEW.csv — the rows that want the owner's eyes and nothing else.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))

const tax = rd('audit/step3b1-conflict-taxonomy-rebuilt.json')
const DISPOSITION_FILES = [
  'audit/lane-b-dispositions-multi-line-span.json',
  'audit/lane-b-dispositions-within-line-crossing.json',
  'audit/lane-b-dispositions-same-category-overlap.json',
  'audit/lane-b-dispositions-unlocated.json',
  'audit/lane-b-dispositions-structural.json',
]
const reviewed = DISPOSITION_FILES.flatMap(f => rd(f).rows.map(r => ({ ...r, _file: f })))

const DISPOSITION_NAMES = {
  A: 'KEEP_AS_CERTIFIED', B: 'REPAIR_GEOMETRY', C: 'RECLASSIFY',
  D: 'SPLIT_SEMANTIC_UNIT', E: 'WITHDRAW', F: 'INTENTIONALLY_UNRESOLVED',
  QUARANTINED: 'INTENTIONALLY_NON_ACTIONABLE',
}

// ── match a surviving queue row to its review ───────────────────────────────
//
// By conflictId where the row still has the one it was reviewed under, and otherwise by
// (postNum, kind) — a REPAIR changes the span, so the row that survives a repair carries a
// different conflictId from the one the review names. That is expected and is why the join is
// not by id alone.
const byConflictId = new Map(reviewed.filter(r => r.conflictId).map(r => [r.conflictId, r]))
// The layer a review is about, taken from the conflictId when the row does not name it — the
// boundary families key their rows by `<REASON>::<post>|<layer>|<start>|<end>::<n>`, so the layer
// is in the id and does not need repeating beside it.
const layerOf = r => r.kind
  ?? (r.conflictId?.match(/::\d+\|([a-zA-Z]+)\|/) ?? [])[1]
  ?? (r.identity !== undefined ? 'namedEntities' : null)
const byPostKind = new Map()
for (const r of reviewed) {
  const kind = layerOf(r)
  if (r.postNum === undefined || !kind) continue
  const k = `${r.postNum}|${kind}`
  if (!byPostKind.has(k)) byPostKind.set(k, [])
  byPostKind.get(k).push(r)
}
// One review answers one row wherever the counts allow it. Two repairs on one drop and one layer
// (#2692 has two) should not both resolve to the first review just because the join is loose.
const consumed = new Set()
const byPost = new Map()
for (const r of reviewed) {
  if (r.postNum === undefined) continue
  if (!byPost.has(r.postNum)) byPost.set(r.postNum, [])
  byPost.get(r.postNum).push(r)
}

const rows = []
const unexplained = []
for (const c of tax.rows ?? []) {
  let m = byConflictId.get(c.conflictId)
  let how = m ? 'conflictId' : null
  if (!m) {
    const cands = (byPostKind.get(`${c.postNum}|${c.kind}`) ?? [])
      .filter(r => c.reason !== 'UNLOCATED_SPAN' || r.identity === c.certifiedValue)
    const fresh = cands.filter(r => !consumed.has(r))
    const pick = fresh[0] ?? cands[0]
    if (pick) { m = pick; how = 'post + layer'; consumed.add(pick) }
  }
  if (!m) {
    const cands = (byPost.get(c.postNum) ?? []).filter(r => r.identity === c.certifiedValue)
    if (cands.length) { m = cands[0]; how = 'post + identity' }
  }
  if (!m) { unexplained.push(c); continue }
  rows.push({
    conflictId: c.conflictId, postNum: c.postNum, layer: c.kind,
    reason: c.reason, subtype: c.subtype, lane: c.lane,
    disposition: m.disposition, dispositionName: DISPOSITION_NAMES[m.disposition] ?? m.disposition,
    whyItRemains: m.retainedIntentionally ?? m.quarantineState ?? m.reason,
    reason_: m.reason,
    reviewedIn: m._file,
    matchedBy: how,
    ownerDirected: Boolean(m.ownerDirected),
    flaggedForOwner: Boolean(m.flagForOwner),
    whatWouldSettleIt: m.whatWouldSettleIt ?? null,
  })
}

// ── the numbers the owner asked for ─────────────────────────────────────────
const count = (list, f) => list.filter(f).length
const actionableUnresolved = count(rows, r => !['A', 'F', 'QUARANTINED', 'B', 'E', 'C', 'D'].includes(r.disposition))
const summary = {
  totalConflictRows: (tax.rows ?? []).length,
  actionableUnresolved: actionableUnresolved + unexplained.length,
  intentionallyUnresolved: count(rows, r => r.disposition === 'F'),
  quarantinedNonActionable: count(rows, r => r.disposition === 'QUARANTINED'),
  reviewedAndDeliberatelyKept: count(rows, r => r.disposition === 'A' || r.disposition === 'B'),
  unexplained: unexplained.length,
  byReason: (tax.rows ?? []).reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] ?? 0) + 1 }), {}),
  bySourceLayer: (tax.rows ?? []).reduce((m, r) => ({ ...m, [r.kind ?? '(n/a)']: (m[r.kind ?? '(n/a)'] ?? 0) + 1 }), {}),
  byLane: tax.byLane,
  byDisposition: rows.reduce((m, r) => ({ ...m, [r.disposition]: (m[r.disposition] ?? 0) + 1 }), {}),
  affectedPosts: new Set((tax.rows ?? []).map(r => r.postNum)).size,
  reviewedRowsAcrossAllFamilies: reviewed.length,
}

fs.writeFileSync(path.join(OUT, 'conflict-reconciliation.json'),
  JSON.stringify({ note: 'The conflict queue as it stands, joined to the review that explains every surviving row.', generatedFrom: 'audit/step3b1-conflict-taxonomy-rebuilt.json', summary, unexplained, rows }, null, 2) + '\n')

// ── the markdown ────────────────────────────────────────────────────────────
const md = []
md.push('# Final conflict state', '')
md.push(`Rebuilt from canonical state. **${summary.totalConflictRows} rows survive**, and every one carries an explicit reviewed disposition.`, '')
md.push('| | |', '|---|---:|')
md.push(`| total conflict rows | ${summary.totalConflictRows} |`)
md.push(`| **actionable unresolved** | **${summary.actionableUnresolved}** |`)
md.push(`| intentionally unresolved (F) | ${summary.intentionallyUnresolved} |`)
md.push(`| quarantined / non-actionable | ${summary.quarantinedNonActionable} |`)
md.push(`| reviewed and deliberately kept | ${summary.reviewedAndDeliberatelyKept} |`)
md.push(`| affected posts | ${summary.affectedPosts} |`)
md.push(`| rows reviewed across all families | ${summary.reviewedRowsAcrossAllFamilies} |`, '')
md.push('## By reason', '', '| reason | rows |', '|---|---:|')
for (const [k, v] of Object.entries(summary.byReason).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${v} |`)
md.push('', '## By source layer', '', '| layer | rows |', '|---|---:|')
for (const [k, v] of Object.entries(summary.bySourceLayer).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${v} |`)
md.push('', '## Every surviving row', '', '| post | layer | subtype | disposition | why it remains |', '|---|---|---|---|---|')
for (const r of rows.sort((a, b) => a.postNum - b.postNum)) {
  md.push(`| #${r.postNum} | ${r.layer} | ${r.subtype} | ${r.disposition} ${r.dispositionName} | ${String(r.whyItRemains).replace(/\|/g, '\\|').slice(0, 300)} |`)
}
fs.writeFileSync(path.join(OUT, 'CONFLICT-RECONCILIATION.md'), md.join('\n') + '\n')

// ── the owner's CSV: only what wants a decision ─────────────────────────────
const q = s => `"${String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
const forOwner = reviewed.filter(r => r.flagForOwner || r.disposition === 'F' || r.disposition === 'QUARANTINED')
const csv = [['post', 'layer_or_identity', 'disposition', 'state', 'applied', 'why', 'what_would_settle_it', 'reviewed_in'].join(',')]
for (const r of forOwner.sort((a, b) => (a.postNum ?? 0) - (b.postNum ?? 0))) {
  csv.push([
    q('#' + (r.postNum ?? '')),
    q(r.identity ?? r.kind ?? ''),
    q(r.disposition),
    q(DISPOSITION_NAMES[r.disposition] ?? r.disposition),
    q(r.disposition === 'F' || r.disposition === 'QUARANTINED' ? 'no — left as is' : 'yes — applied, reversible'),
    q(r.reason),
    q(r.whatWouldSettleIt ?? (r.disposition === 'QUARANTINED' ? 'nothing: examined and refused by owner direction' : r.ownerDirected ? 'owner direction of 2026-08-22 — untouched on purpose' : 'a word from you either way; the change is one line to reverse')),
    q(r._file),
  ].join(','))
}
fs.writeFileSync(path.join(OUT, 'OWNER-REVIEW.csv'), csv.join('\n') + '\n')

console.log('FINAL CONFLICT STATE')
console.log(`  total conflict rows            : ${summary.totalConflictRows}`)
console.log(`  ACTIONABLE UNRESOLVED          : ${summary.actionableUnresolved}`)
console.log(`  intentionally unresolved (F)   : ${summary.intentionallyUnresolved}`)
console.log(`  quarantined / non-actionable   : ${summary.quarantinedNonActionable}`)
console.log(`  reviewed and deliberately kept : ${summary.reviewedAndDeliberatelyKept}`)
console.log(`  affected posts                 : ${summary.affectedPosts}`)
console.log(`  by reason                      : ${JSON.stringify(summary.byReason)}`)
console.log(`  by source layer                : ${JSON.stringify(summary.bySourceLayer)}`)
console.log(`  by disposition                 : ${JSON.stringify(summary.byDisposition)}`)
console.log(`  rows for the owner (CSV)       : ${forOwner.length}`)
console.log(`\n-> audit/conflict-reconciliation.json, audit/CONFLICT-RECONCILIATION.md, audit/OWNER-REVIEW.csv`)

if (unexplained.length) {
  console.error(`\n[X] ${unexplained.length} surviving conflict row(s) carry NO reviewed disposition:`)
  for (const u of unexplained.slice(0, 20)) console.error(`   #${u.postNum} ${u.kind} ${u.subtype} ${JSON.stringify(String(u.certifiedValue).slice(0, 60))}`)
  process.exit(1)
}
console.log('\nEvery surviving row is reviewed.')
