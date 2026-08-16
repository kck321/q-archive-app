// Final verification for the 2026-08-16 Predictions audit — the ten points of the audit's own
// closing prompt, checked against the BUILT bundle and the on-disk ledger.
//
// Deliberately reads public/data/posts.json rather than the transform's return value. A pass
// here means the shipped data says it, not that the applier believed it.
//
//   node scripts/verify-predictions-audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { key } from './lib/segment.mjs'
import { loadPhase, AUDIT_DIR } from './lib/predictionsAudit.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const ledger = fs.readFileSync(path.join(AUDIT_DIR, 'ledger.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l))
const backlog = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, 'review-backlog.json'), 'utf8'))

const preds = [], claims = []
for (const p of posts) {
  for (const [i, t] of (p.postAnalysis?.predictions ?? []).entries())
    preds.push({ post: p.postNum, text: t, sentence: p.postAnalysis.predictionSentences?.[i] ?? null })
  for (const t of (p.postAnalysis?.claims ?? [])) claims.push({ post: p.postNum, text: t })
}
const predKeys = new Set(preds.map(r => `${r.post}|${key(r.text)}`))
const claimKeys = new Map()
for (const c of claims) { const k = `${c.post}|${key(c.text)}`; claimKeys.set(k, (claimKeys.get(k) ?? 0) + 1) }

const fails = []
const check = (n, label, ok, got) => {
  if (!ok) fails.push(`${n}. ${label} — got ${got}`)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${String(n).padStart(2)}. ${label.padEnd(58)} ${got}`)
}

console.log('\nPREDICTIONS AUDIT — FINAL VERIFICATION (against the built bundle)\n')

// 1
check(1, 'exactly 595 active high-confidence Predictions', preds.length === 595, preds.length)

// 2 — provenance is carried in the ledger, since posts.json stores strings only.
const added = ledger.filter(l => l.result === 'changed' && (l.phase === 'P4' || l.phase === 'P5'))
const p4Added = added.filter(l => l.phase === 'P4').length
const p5Added = added.filter(l => l.phase === 'P5').length
check(2, 'retained 501 + 66 moved from Claims + 28 found', preds.length - p4Added - p5Added === 501 && p4Added === 66 && p5Added === 28,
  `${preds.length - p4Added - p5Added} + ${p4Added} + ${p5Added}`)

// 3
const p1 = loadPhase('P1').records
const stillPredictions = p1.filter(r => predKeys.has(`${r.post}|${key(r.match)}`))
const moves = p1.filter(r => r.action === 'move-to-claims')
const removes = p1.filter(r => r.action === 'remove')
const movesPresentOnce = moves.filter(r => (claimKeys.get(`${r.post}|${key(r.match)}`) ?? 0) === 1)
const removesGone = removes.filter(r => !predKeys.has(`${r.post}|${key(r.match)}`) && !claimKeys.has(`${r.post}|${key(r.match)}`))
check(3, '73 nonpredictions absent; 47 in Claims once; 26 removed',
  stillPredictions.length === 0 && movesPresentOnce.length === 47 && removesGone.length === 26,
  `${stillPredictions.length} still present / ${movesPresentOnce.length} in Claims / ${removesGone.length} gone`)

// 4
const held = [...loadPhase('P2').records, ...loadPhase('R1').records, ...loadPhase('R2').records]
const p2Leak = loadPhase('P2').records.filter(r => predKeys.has(`${r.post}|${key(r.match)}`))
const r1Leak = loadPhase('R1').records.filter(r => predKeys.has(`${r.post}|${key(r.match)}`))
const r2Leak = loadPhase('R2').records.filter(r => predKeys.has(`${r.post}|${key(r.original)}`))
check(4, '56 + 22 + 13 excluded from active list and preserved',
  p2Leak.length + r1Leak.length + r2Leak.length === 0 && backlog.totals.total === 91 && held.length === 91,
  `${p2Leak.length + r1Leak.length + r2Leak.length} leaked, ${backlog.totals.total} in backlog`)

// 4b — R1 rows must still be in Claims: "review only" means nothing moved.
const r1Intact = loadPhase('R1').records.filter(r => claimKeys.has(`${r.post}|${key(r.match)}`))
check(4.1, 'the 22 R1 rows are untouched in Claims', r1Intact.length === 22, `${r1Intact.length}/22`)

// 5
const p3 = loadPhase('P3').records
const p3Applied = p3.filter(r => preds.some(p => p.post === r.post && key(p.text) === key(r.match) && p.sentence === r.sentence))
check(5, '130 fragment replacements use the exact supplied sentence', p3Applied.length === 130, `${p3Applied.length}/130`)

// 6
const p4 = loadPhase('P4').records
const p4Gone = p4.filter(r => !claimKeys.has(`${r.post}|${key(r.match)}`))
const p4Unique = new Set(p4.map(r => `${r.post}|${key(r.sentence)}`))
check(6, '68 Claims occurrences removed, yielding 66 unique', p4Gone.length === 68 && p4Unique.size === 66, `${p4Gone.length} removed / ${p4Unique.size} unique`)

// 7
const p5 = loadPhase('P5').records
const p5Present = p5.filter(r => preds.some(p => p.post === r.post && p.sentence === r.sentence))
check(7, '28 missing Predictions added', p5Present.length === 28, `${p5Present.length}/28`)

// 8 — post + normalised complete sentence. Repeated wording across DIFFERENT posts is expected.
const pairs = new Map()
for (const p of preds) { const k = `${p.post}|${key(p.sentence ?? p.text)}`; pairs.set(k, (pairs.get(k) ?? 0) + 1) }
const dupes = [...pairs].filter(([, n]) => n > 1)
const crossPost = [...new Set(preds.map(p => key(p.sentence ?? p.text)))].length
check(8, 'no duplicate post + sentence pairs', dupes.length === 0, `${dupes.length} (${crossPost} distinct sentences across ${preds.length} rows — repeats across posts kept)`)

// 9
const tail = preds.filter(p => p.post >= 4954 && p.post <= 4966)
check(9, 'posts 4954-4966 contributed zero additions', tail.length === 0, tail.length)

// 10 — ledger completeness against every batch.
const byBatch = new Map()
for (const l of ledger) byBatch.set(l.batch, (byBatch.get(l.batch) ?? 0) + 1)
const EXPECTED = { 1: 57, 2: 16, 3: 38, 4: 18, 5: 38, 6: 39, 7: 38, 8: 15, 9: 41, 10: 27, 11: 28, 12: 22, 13: 13, 14: 13 }
const mismatched = Object.entries(EXPECTED).filter(([b, n]) => byBatch.get(Number(b)) !== n)
check(10, 'ledger accounts for all 403 records in all 14 batches',
  ledger.length === 403 && mismatched.length === 0,
  mismatched.length ? mismatched.map(([b, n]) => `batch ${b}: ${byBatch.get(Number(b)) ?? 0} vs ${n}`).join(', ') : `403 across 14 batches`)

const errors = ledger.filter(l => l.result === 'error')
check(11, 'no record failed to apply', errors.length === 0, errors.length)

if (fails.length) { console.log('\nMISMATCHES\n' + fails.map(f => `  ${f}`).join('\n')); process.exit(1) }
console.log('\nEvery point of the final audit matches the shipped data.\n')
