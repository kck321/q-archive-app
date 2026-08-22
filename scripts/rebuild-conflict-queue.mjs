// THE CONFLICT QUEUE, REBUILT FROM CANONICAL STATE.
//
//   node scripts/rebuild-conflict-queue.mjs
//
// Writes audit/step3b1-conflict-queue-rebuilt.json. Reports only.
//
// WHY THIS EXISTS RATHER THAN ARITHMETIC. The 945-row queue in STEP3B1-DRYRUN/10-CONFLICTS-HELD.csv
// was measured against the bundle as it stood before any of Step 3B-1 was applied. Subtracting the
// rows we believe we fixed would produce a number that is a belief, not a measurement — and it
// would miss both directions of drift: conflicts that dissolved as a side effect of an unrelated
// repair, and conflicts that only became visible once a repair made a record locatable at all.
//
// So the queue is re-derived from the ledger of the CURRENT bundle, in the same four families the
// original used, and the two are then compared as sets.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const dryrun = JSON.parse(fs.readFileSync(path.join(OUT, 'occurrence-ledger-dryrun.json'), 'utf8'))

const rows = []

// 1 — a certified span that starts in one sentence and ends in another.
for (const r of dryrun.crossingRows ?? []) {
  rows.push({ conflictId: `BOUNDARY_CROSSING::${r.occurrenceKey}::0`, reason: 'BOUNDARY_CROSSING',
    heldKey: r.occurrenceKey, postNum: r.postNum, kind: r.kind,
    detail: `touches ${r.sentencesTouched} sentences`, certifiedValue: r.text ?? '' })
}

// 2 — an identity a section recorded on a drop that no registered spelling can be found for.
//     unlocated rows carry no offsets by construction, so the conflictId is per (post, kind,
//     identity, ordinal) exactly as the original queue keyed them.
const seenUnlocated = new Map()
for (const u of dryrun.unlocated ?? []) {
  const base = `UNLOCATED-${u.postNum}-${u.kind}`
  const n = seenUnlocated.get(`${base}|${u.text}`) ?? 0
  seenUnlocated.set(`${base}|${u.text}`, n + 1)
  rows.push({ conflictId: `UNLOCATED_SPAN::${base}::${u.text}::${n}`, reason: 'UNLOCATED_SPAN',
    heldKey: base, postNum: u.postNum, kind: u.kind, detail: u.text, certifiedValue: u.text })
}

// 3 — two records claiming the same post, kind and character range with different identities.
//     Identical-metadata duplicates are not a conflict; they were merged by the applier.
for (const d of dryrun.duplicateRows ?? []) {
  if (d.identicalText && d.textA === d.textB) continue
  rows.push({ conflictId: `DUPLICATE_KEY_CONFLICTING_METADATA::${d.occurrenceKey}::0`,
    reason: 'DUPLICATE_KEY_CONFLICTING_METADATA', heldKey: d.occurrenceKey, postNum: d.postNum,
    kind: d.kind, detail: `"${d.textA}" vs "${d.textB}"`, certifiedValue: `"${d.textA}" vs "${d.textB}"` })
}

// 4 — two spans of ONE category overlapping in the primary layer. Inline and review layers overlap
//     by design (nested entities, acrostic emphasis) and are excluded, as they always were.
let overlapSeq = 0
for (const o of dryrun.sameCategoryOverlap ?? []) {
  if (o.deliberate) continue
  rows.push({ conflictId: `SAME_CATEGORY_PARTIAL_OVERLAP::OVERLAP-${o.sentenceId}::${overlapSeq++}`,
    reason: 'SAME_CATEGORY_PARTIAL_OVERLAP', heldKey: `OVERLAP-${o.sentenceId}`, postNum: o.postNum,
    kind: o.kind, sentenceId: o.sentenceId, nested: o.nested,
    detail: `"${o.a}" / "${o.b}"`, certifiedValue: `"${o.a}" / "${o.b}"` })
}

// ── compare against the frozen queue, as SETS ───────────────────────────────────────────────
function parseCsv(text) {
  const out = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === String.fromCharCode(10)) { row.push(cur); out.push(row); row = []; cur = '' }
    else if (c !== String.fromCharCode(13)) cur += c
  }
  if (cur || row.length) { row.push(cur); out.push(row) }
  return out
}
const csv = parseCsv(fs.readFileSync(path.join(ROOT, 'STEP3B1-DRYRUN', '10-CONFLICTS-HELD.csv'), 'utf8').trim())
const oldHead = csv[0]
const original = csv.slice(1).map(r => Object.fromEntries(oldHead.map((h, i) => [h, r[i] ?? ''])))

// Compared on the stable part of the identity — the family and the held key — because the ordinal
// suffix of an UNLOCATED row moves whenever the number of records on a drop changes.
// The overlap family's `detail` is a pair of TRUNCATED span previews, and the truncation width
// differs between the frozen CSV and this rebuild, so including it would report the same rows as
// simultaneously resolved and newly appeared. Those rows are identified by their sentence instead.
const idOf = r => r.reason === 'SAME_CATEGORY_PARTIAL_OVERLAP'
  ? `${r.reason}::${r.heldKey}`
  : `${r.reason}::${r.heldKey}::${r.detail ?? ''}`
const oldSet = new Map(); for (const r of original) oldSet.set(idOf(r), (oldSet.get(idOf(r)) ?? 0) + 1)
const newSet = new Map(); for (const r of rows) newSet.set(idOf(r), (newSet.get(idOf(r)) ?? 0) + 1)

const resolved = [], appeared = []
for (const [k, n] of oldSet) { const m = newSet.get(k) ?? 0; if (m < n) resolved.push({ key: k, was: n, now: m }) }
for (const [k, n] of newSet) { const m = oldSet.get(k) ?? 0; if (n > m) appeared.push({ key: k, was: m, now: n }) }

const tally = (list, f) => {
  const t = {}
  for (const x of list) { const k = f(x); t[k] = (t[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]))
}
const famOf = k => String(k).split('::')[0]

const doc = {
  note: 'Conflict queue re-derived from the CURRENT bundle. Not the old CSV minus anything.',
  measuredFrom: 'audit/occurrence-ledger-dryrun.json',
  originalRows: original.length,
  rebuiltRows: rows.length,
  netChange: rows.length - original.length,
  byReason: tally(rows, r => r.reason),
  byKind: tally(rows, r => r.kind ?? '(n/a)'),
  distinctHeldKeys: new Set(rows.map(r => r.heldKey)).size,
  distinctPosts: new Set(rows.map(r => r.postNum)).size,
  resolvedSince: { count: resolved.reduce((n, r) => n + (r.was - r.now), 0), byFamily: tally(resolved, r => famOf(r.key)) },
  appearedSince: { count: appeared.reduce((n, r) => n + (r.now - r.was), 0), byFamily: tally(appeared, r => famOf(r.key)),
    examples: appeared.slice(0, 15) },
  rows,
}
fs.writeFileSync(path.join(OUT, 'step3b1-conflict-queue-rebuilt.json'), JSON.stringify(doc, null, 1))

console.log('CONFLICT QUEUE, REBUILT FROM CANONICAL STATE')
console.log(`  original (frozen CSV) : ${doc.originalRows}`)
console.log(`  rebuilt (measured)    : ${doc.rebuiltRows}   (${doc.netChange >= 0 ? '+' : ''}${doc.netChange})`)
console.log(`  distinct held keys    : ${doc.distinctHeldKeys}   posts: ${doc.distinctPosts}`)
console.log('\nby reason:', JSON.stringify(doc.byReason))
console.log('by layer :', JSON.stringify(doc.byKind))
console.log(`\nresolved since the freeze : ${doc.resolvedSince.count}`, JSON.stringify(doc.resolvedSince.byFamily))
console.log(`appeared since the freeze : ${doc.appearedSince.count}`, JSON.stringify(doc.appearedSince.byFamily))
for (const a of doc.appearedSince.examples.slice(0, 8)) console.log(`   NEW  ${a.key.slice(0, 110)}`)
console.log('\n-> audit/step3b1-conflict-queue-rebuilt.json')
