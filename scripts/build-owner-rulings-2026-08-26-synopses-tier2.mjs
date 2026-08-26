// THE OWNER'S RULING OF 2026-08-26 (tier 2): real researched synopses for the archive's
// mentions 10-19 entities (50 rows), continuing the sweep the owner confirmed with "yes lets
// finish 1". Researched via three parallel background agents against the same standard as tier 1:
// who/what the entity IS, no adoption of Q's framing, strictly neutral tone for anything
// politically charged. "President" and "Board Owner" are generic title_role terms, written
// directly rather than researched as a specific person. "Q" and "CodeMonkey" are real, documented
// facts about the archive's own source material. "Justice K" is an inferred identification
// (drop-date correlation with the Kavanaugh confirmation), phrased as such rather than asserted.
//
//   node scripts/build-owner-rulings-2026-08-26-synopses-tier2.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entity-synopsis-owner-rulings.json')
const dry = process.argv.includes('--dry')

const SCRATCH = 'C:/Users/heath/AppData/Local/Temp/claude/C--Users-heath/81edd0f2-25ff-48c3-bc33-131b8b611791/scratchpad'
const RAW = [
  ...JSON.parse(fs.readFileSync(path.join(SCRATCH, 'tier2-batch1.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(SCRATCH, 'tier2-batch2.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(SCRATCH, 'tier2-batch3.json'), 'utf8')),
]

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byId = new Map(entities.map(e => [e.id, e]))

const RULED_ON = '2026-08-26'
const PROVENANCE = 'Owner ruling: "yes lets finish 1" (continuing the entity-synopsis sweep). Tier 2: mentions 10-19.'

const problems = []
const synopses = []
for (const { entityId, canonical, synopsis } of RAW) {
  const e = byId.get(entityId)
  if (!e) { problems.push(`${entityId}: not a live entity`); continue }
  if (e.canonical !== canonical) { problems.push(`${entityId}: canonical mismatch — archive has "${e.canonical}", batch said "${canonical}"`); continue }
  const firstWord = e.canonical.split(' ')[0]
  if (!synopsis.includes(firstWord)) problems.push(`${entityId} (${e.canonical}): synopsis does not contain "${firstWord}"`)
  synopses.push({ entityId, canonical: e.canonical, ruledOn: RULED_ON, provenance: PROVENANCE, synopsis })
}
if (RAW.length !== 50) problems.push(`expected 50 rows across the three batches, got ${RAW.length}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))
doc.synopses ??= []
const already = new Set(doc.synopses.map(s => s.entityId))

console.log(`\nOWNER SYNOPSIS RULING — 2026-08-26, tier 2 (mentions 10-19)\n`)
let added = 0, skipped = 0
for (const s of synopses) {
  if (already.has(s.entityId)) { skipped++; continue }
  console.log(`  ${s.canonical}`)
  doc.synopses.push(s)
  already.add(s.entityId)
  added++
}
console.log(`\n  ${added} new, ${skipped} already recorded\n`)

if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added) { console.log('  nothing to write\n'); process.exit(0) }
fs.writeFileSync(RULINGS_FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, RULINGS_FILE)}\n`)
