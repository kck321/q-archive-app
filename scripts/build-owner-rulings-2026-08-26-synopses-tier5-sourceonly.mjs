// THE OWNER'S RULING OF 2026-08-26 (tier 5, source-only): real researched synopses for the
// 132 entities the mentions-based tiers 1-4 never reached — rows with mentions: 0, where Q
// linked to the entity via URL/source metadata but never wrote its name directly in drop text.
// Discovered after tier 4 completed via a coverage check (entities.length vs synopsis-count).
// Researched via 4 parallel background agents against the same standard as tiers 1-4: real media
// outlets, real people, and a handful of Twitter/X handles resolved to their real-world owner
// where confidently known.
//
//   node scripts/build-owner-rulings-2026-08-26-synopses-tier5-sourceonly.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entity-synopsis-owner-rulings.json')
const dry = process.argv.includes('--dry')

const SCRATCH = 'C:/Users/heath/AppData/Local/Temp/claude/C--Users-heath/81edd0f2-25ff-48c3-bc33-131b8b611791/scratchpad'
const RAW = Array.from({ length: 4 }, (_, i) => i + 1)
  .flatMap(n => JSON.parse(fs.readFileSync(path.join(SCRATCH, `t5-batch${n}.json`), 'utf8')))

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byId = new Map(entities.map(e => [e.id, e]))

const RULED_ON = '2026-08-26'
const PROVENANCE = 'Owner ruling: "yes lets finish 1" (completing the entity-synopsis sweep). Tier 5: source-only entities (mentions: 0), the last gap after tier 4.'

const problems = []
const synopses = []
const seenIds = new Set()
for (const { entityId, canonical, synopsis } of RAW) {
  if (seenIds.has(entityId)) { problems.push(`${entityId}: duplicate row across batches`); continue }
  seenIds.add(entityId)
  const e = byId.get(entityId)
  if (!e) { problems.push(`${entityId}: not a live entity`); continue }
  const norm = s => s.replace(/[‘’]/g, "'")
  if (norm(e.canonical) !== norm(canonical)) { problems.push(`${entityId}: canonical mismatch — archive has "${e.canonical}", batch said "${canonical}"`); continue }
  const firstWord = e.canonical.split(' ')[0].replace(/[()@]/g, '')
  if (!synopsis.includes(firstWord)) problems.push(`${entityId} (${e.canonical}): synopsis does not contain "${firstWord}"`)
  synopses.push({ entityId, canonical: e.canonical, ruledOn: RULED_ON, provenance: PROVENANCE, synopsis })
}
if (RAW.length !== 132) problems.push(`expected 132 rows across the 4 batches, got ${RAW.length}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems.slice(0, 60)) console.error(`   ${p}`)
  if (problems.length > 60) console.error(`   ...and ${problems.length - 60} more`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))
doc.synopses ??= []
const already = new Set(doc.synopses.map(s => s.entityId))

console.log(`\nOWNER SYNOPSIS RULING — 2026-08-26, tier 5 (source-only, mentions: 0)\n`)
let added = 0, skipped = 0
for (const s of synopses) {
  if (already.has(s.entityId)) { skipped++; continue }
  doc.synopses.push(s)
  already.add(s.entityId)
  added++
}
console.log(`  ${added} new, ${skipped} already recorded\n`)

if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added) { console.log('  nothing to write\n'); process.exit(0) }
fs.writeFileSync(RULINGS_FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, RULINGS_FILE)}\n`)
