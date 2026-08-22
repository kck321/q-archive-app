// One-shot: four assertions in prove-final-chain.mjs were wrong about the bundle rather than the
// bundle being wrong. Each is replaced with the thing it was actually trying to say.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(ROOT, 'scripts', 'prove-final-chain.mjs')
let s = fs.readFileSync(p, 'utf8')
const swap = (a, b) => {
  if (!s.includes(a)) { console.error(`  X not found:\n${a.slice(0, 120)}`); process.exit(1) }
  s = s.replace(a, b)
}

// 1. NINE merges exist; FIVE of them are Owner Ruling 1's. Both facts are worth asserting.
swap(
`const stillMerged = merges.filter(m => !canon.has(m.from) && canon.has(m.into))
check('five approved identity merges remain merged', merges.length === 5 && stillMerged.length === 5,
  \`\${stillMerged.length}/\${merges.length}: \${merges.map(m => \`\${m.from}->\${m.into}\`).join(', ')}\`)`,
`const stillMerged = merges.filter(m => !canon.has(m.from) && canon.has(m.into))
// Owner Ruling 1 approved FIVE; four more predate it (Patriot, the two No Name spellings, No Name
// Institute). All nine must hold, and the five must be among them by name — asserting a bare count
// of five would go green if one of the nine came apart and a different one was added.
const RULING_1 = ['Wray', 'Whitaker', 'GANG OF 8', 'Pence', 'Awan']
const ruling1Held = RULING_1.filter(from => merges.some(m => m.from === from && !canon.has(from) && canon.has(m.into)))
check('five approved identity merges remain merged', ruling1Held.length === 5 && stillMerged.length === merges.length,
  \`\${ruling1Held.length}/5 from Owner Ruling 1; \${stillMerged.length}/\${merges.length} merges hold overall\`)`)

// 2. Relationships: assert what the artifact must be consistent WITH, not a total typed by hand.
swap(
`check('relationships stable', rel.totals.relationships === 4126 && rel.totals.byType.claim_source_provided === 337,
  \`\${rel.totals.relationships} edges\`)`,
`// The total is the SUM of its types and the two pinned families are the ones the reviews moved.
// Pinning the grand total by hand would be a second copy of a number build-relationships.mjs
// already gates, and it is the copy that goes stale.
const relSum = Object.values(rel.totals.byType).reduce((a, b) => a + b, 0)
check('relationships stable', relSum === rel.totals.relationships
  && rel.totals.byType.claim_source_provided === 337 && rel.totals.byType.question_directive === 231,
  \`\${rel.totals.relationships} edges = sum of types; claim<->source 337, question<->directive 231\`)`)

// 3. A slot witness on a RETIRED field is moot — the field is gone, which is the stronger outcome.
swap(
`const witnessed = (overlay.occurrences ?? []).filter(o => o.slotWitness)
const witnessHolds = witnessed.filter(o => {`,
`// A WITNESS ON A RETIRED FIELD IS MOOT, AND ITS FIELD BEING ABSENT IS THE STRONGER RESULT.
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
  onRetired.length === retiredFieldGone.length, \`\${retiredFieldGone.length}/\${onRetired.length}\`)

const witnessed = (overlay.occurrences ?? []).filter(o => o.slotWitness && !RETIRED_FIELDS.has(o.slotWitness.field.split('.').pop()))
const witnessHolds = witnessed.filter(o => {`)

// 4. #34's partition is identified by its SHAPE — two categories over disjoint spans on one
//    sentence — not by an actionId that happens to spell CLAUSE.
swap(
`const p34 = (overlay.occurrences ?? []).filter(o => o.postNum === 34 && o.actionId?.includes('CLAUSE'))
const cats34 = new Set(p34.map(o => o.primaryCategory))
check('#34 clause partition preserved', p34.length === 2 && cats34.has('claim') && cats34.has('prediction'),
  \`\${p34.length} rows: \${[...cats34].join(' + ')}\`)`,
`// Identified by SHAPE, not by an actionId spelling "CLAUSE" — the row is A-MP-p0034-s002, because
// the partition was adjudicated as a multi-primary resolution. What has to be true is that one
// sentence carries two categories over two DISJOINT spans, which is the thing that makes it legal.
const p34 = (overlay.occurrences ?? []).filter(o => o.postNum === 34 && o.primaryCategory)
const cats34 = new Set(p34.map(o => o.primaryCategory))
const disjoint34 = p34.length === 2 && (p34[0].end <= p34[1].start || p34[1].end <= p34[0].start)
check('#34 clause partition preserved', p34.length === 2 && cats34.has('claim') && cats34.has('prediction') && disjoint34,
  \`\${p34.length} rows: \${p34.map(o => \`\${o.primaryCategory} \${o.start}..\${o.end}\`).join(' + ')}\${disjoint34 ? ', disjoint' : ', OVERLAPPING'}\`)`)

fs.writeFileSync(p, s)
console.log('four assertions corrected')
