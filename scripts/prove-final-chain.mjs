// THE FINAL CHAIN PROOF — every claim the owner named, asserted against the bundle on disk.
//
//   node scripts/prove-final-chain.mjs
//
// Reports only, and exits non-zero if any assertion fails. Nothing here is derived from another
// assertion: each one reads the artifact it is about.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const rd = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))

const posts = rd(DATA, 'posts.json')
const questions = rd(DATA, 'questions.json')
const entities = rd(DATA, 'entities.json')
const rel = rd(DATA, 'relationships.json')
const idx = rd(DATA, 'search-index.json')
const overlay = rd(DATA, 'semantics.json')
const view = rd(DATA, 'entity-public-view.json')
const transfers = rd(OUT, 'step3b1-metadata-transfers.json')

const n = f => posts.reduce((a, p) => a + (p.postAnalysis?.[f]?.length ?? 0), 0)
const out = []
const check = (name, ok, detail) => { out.push({ name, ok: Boolean(ok), detail: String(detail) }) }

// ── counts ──────────────────────────────────────────────────────────────────
check('questions stable', idx.totals.bySection.questions === 6321, idx.totals.bySection.questions)
check('directives stable', idx.totals.bySection.directives === 2940, idx.totals.bySection.directives)
check('claims == claimSpans', n('claims') === n('claimSpans') && n('claims') === 8676, `${n('claims')} / ${n('claimSpans')}`)
check('predictions == predictionSpans', n('predictions') === n('predictionSpans') && n('predictions') === 843, `${n('predictions')} / ${n('predictionSpans')}`)
check('entities stable', entities.entities.length === 1214 && idx.totals.bySection.entities === 1214, `${entities.entities.length} rows`)
check('entity mentions stable', entities.totals.mentions === 8821 && n('namedEntities') === 8821,
  `registry ${entities.totals.mentions} / rendered ${n('namedEntities')}`)

// ── the five approved identity merges ───────────────────────────────────────
const merges = (rd(OUT, 'entities-owner-rulings.json').merges ?? [])
const canon = new Set(entities.entities.map(e => e.canonical))
const stillMerged = merges.filter(m => !canon.has(m.from) && canon.has(m.into))
// Owner Ruling 1 approved FIVE; four more predate it (Patriot, the two No Name spellings, No Name
// Institute). All nine must hold, and the five must be among them by name — asserting a bare count
// of five would go green if one of the nine came apart and a different one was added.
const RULING_1 = ['Wray', 'Whitaker', 'GANG OF 8', 'Pence', 'Awan']
const ruling1Held = RULING_1.filter(from => merges.some(m => m.from === from && !canon.has(from) && canon.has(m.into)))
check('five approved identity merges remain merged', ruling1Held.length === 5 && stillMerged.length === merges.length,
  `${ruling1Held.length}/5 from Owner Ruling 1; ${stillMerged.length}/${merges.length} merges hold overall`)

// ── the 29 Owner Ruling 3 withdrawals ───────────────────────────────────────
const r3 = rd(OUT, 'occurrence-withdrawals-owner-ruling-3.json')
const byNum = new Map(posts.map(p => [p.postNum, p]))
const r3Back = r3.withdrawals.filter(w => (byNum.get(w.postNum)?.postAnalysis?.namedEntities ?? []).includes(w.alias))
const r3Theme = fs.readFileSync(path.join(OUT, 'step3b1-r3-actions.jsonl'), 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l))
const themeBack = r3Theme.filter(a => (byNum.get(a.postNum)?.postAnalysis?.themeAnchors ?? []).includes(a.unlocatedRecord.text))
check('29 entity withdrawals remain withdrawn', r3.withdrawals.length === 27 && r3Theme.length === 2
  && r3Back.length === 0 && themeBack.length === 0,
  `27 namedEntities + 2 themeAnchors; ${r3Back.length + themeBack.length} returned`)

// ── the lane-B semantic dispositions ────────────────────────────────────────
const laneB = ['multi-line-span', 'within-line-crossing', 'same-category-overlap', 'unlocated', 'structural']
  .flatMap(f => rd(OUT, `lane-b-dispositions-${f}.json`).rows)
const recon = rd(OUT, 'conflict-reconciliation.json')
check('semantic dispositions remain applied', recon.summary.actionableUnresolved === 0 && recon.unexplained.length === 0,
  `${laneB.length} rows reviewed, ${recon.summary.totalConflictRows} conflicts survive, ${recon.summary.actionableUnresolved} actionable`)

// ── relationships and the index ─────────────────────────────────────────────
// The total is the SUM of its types and the two pinned families are the ones the reviews moved.
// Pinning the grand total by hand would be a second copy of a number build-relationships.mjs
// already gates, and it is the copy that goes stale.
const relSum = Object.values(rel.totals.byType).reduce((a, b) => a + b, 0)
check('relationships stable', relSum === rel.totals.relationships
  && rel.totals.byType.claim_source_provided === 337 && rel.totals.byType.question_directive === 231,
  `${rel.totals.relationships} edges = sum of types; claim<->source 337, question<->directive 231`)
check('search index stable', idx.totals.records === idx.rows.length && idx.totals.records > 31000, `${idx.totals.records} records`)

// ── transfer history ────────────────────────────────────────────────────────
check('transfer history preserved', (transfers.transfers ?? []).length >= 798, `${(transfers.transfers ?? []).length} transfers`)

// ── slot witnesses ──────────────────────────────────────────────────────────
// A WITNESS ON A RETIRED FIELD IS MOOT, AND ITS FIELD BEING ABSENT IS THE STRONGER RESULT.
// Five witnesses count entries that should remain in postAnalysis.emphasis. Emphasis is retired,
// so the array does not exist at all — "1 entry should survive" is satisfied by there being no
// array to survive in. They are asserted separately rather than counted as holding.
const RETIRED_FIELDS = new Set(['emphasis', 'impliedConclusions', 'verificationHooks'])
const onRetired = (overlay.occurrences ?? []).filter(o => o.slotWitness && RETIRED_FIELDS.has(o.slotWitness.field.split('.').pop()))
const retiredFieldGone = onRetired.filter(o => {
  const pp = byNum.get(o.postNum)
  return (pp?.postAnalysis?.[o.slotWitness.field.split('.').pop()] ?? undefined) === undefined
})
check('slot witnesses on retired fields are moot because the field is gone',
  onRetired.length === retiredFieldGone.length, `${retiredFieldGone.length}/${onRetired.length}`)

const witnessed = (overlay.occurrences ?? []).filter(o => o.slotWitness && !RETIRED_FIELDS.has(o.slotWitness.field.split('.').pop()))
const witnessHolds = witnessed.filter(o => {
  const p = byNum.get(o.postNum)
  const field = o.slotWitness.field.split('.').pop()
  const arr = (o.slotWitness.field.startsWith('postAnalysis') ? p?.postAnalysis : p)?.[field]
  return Array.isArray(arr) && arr.filter(x => String(x) === String(o.slotWitness.text)).length === o.slotWitness.slotsAfter
})
check('slot witnesses hold', witnessed.length > 0 && witnessHolds.length === witnessed.length,
  `${witnessHolds.length}/${witnessed.length}`)

// ── secondary semantics ─────────────────────────────────────────────────────
const secondary = (overlay.occurrences ?? []).filter(o => (o.secondarySemantics ?? []).length)
check('secondary semantics preserved', secondary.length > 0, `${secondary.length} occurrences carry a non-painting secondary`)

// ── #34's clause partition ──────────────────────────────────────────────────
// Identified by SHAPE, not by an actionId spelling "CLAUSE" — the row is A-MP-p0034-s002, because
// the partition was adjudicated as a multi-primary resolution. What has to be true is that one
// sentence carries two categories over two DISJOINT spans, which is the thing that makes it legal.
const p34 = (overlay.occurrences ?? []).filter(o => o.postNum === 34 && o.primaryCategory)
const cats34 = new Set(p34.map(o => o.primaryCategory))
const disjoint34 = p34.length === 2 && (p34[0].end <= p34[1].start || p34[1].end <= p34[0].start)
check('#34 clause partition preserved', p34.length === 2 && cats34.has('claim') && cats34.has('prediction') && disjoint34,
  `${p34.length} rows: ${p34.map(o => `${o.primaryCategory} ${o.start}..${o.end}`).join(' + ')}${disjoint34 ? ', disjoint' : ', OVERLAPPING'}`)

// ── retired sections ────────────────────────────────────────────────────────
const RETIRED = ['emphasis', 'impliedConclusions', 'verificationHooks', 'conclusionSpans', 'checkableSpans']
const retiredBack = RETIRED.filter(f => n(f) > 0)
const metaBack = posts.filter(p => Object.values(p.claimMeta ?? {}).some(m => m?.checkable || m?.isConclusion)).length
check('no retired section fields return', retiredBack.length === 0 && metaBack === 0,
  retiredBack.length ? retiredBack.join(', ') : `all five empty, ${metaBack} posts with a retired attribute`)
check('emphasis.json is not regenerated', !fs.existsSync(path.join(DATA, 'emphasis.json')), 'absent')
check('no retired search section', !idx.totals.bySection.emphasis && !idx.totals.bySection.conclusions,
  JSON.stringify(Object.keys(idx.totals.bySection)))

// ── the public view ─────────────────────────────────────────────────────────
check('public entity view reconciles', view.totals.mentions === entities.totals.mentions
  && view.totals.canonicalEntities === entities.entities.length,
  `${view.totals.canonicalEntities} rows / ${view.totals.mentions} mentions`)

const pad = s => s.padEnd(46)
console.log('FINAL CHAIN PROOF\n')
for (const r of out) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.name)} ${r.detail}`)
const bad = out.filter(r => !r.ok)
console.log(`\n  ${out.length - bad.length}/${out.length} assertions pass`)
fs.writeFileSync(path.join(OUT, 'final-chain-proof.json'), JSON.stringify({ generated: 'post-chain', assertions: out }, null, 2) + '\n')
if (bad.length) process.exit(1)
