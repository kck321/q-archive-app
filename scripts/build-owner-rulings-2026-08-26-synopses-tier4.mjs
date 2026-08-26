// THE OWNER'S RULING OF 2026-08-26 (tier 4, final tier): real researched synopses for the
// archive's remaining mentions 1-4 entities (1,140 rows), completing the sweep the owner
// confirmed with "yes lets finish 1". Researched via 29 parallel background agents against the
// same standard as tiers 1-3. The special-case categories are the same ones established across
// the earlier tiers, applied at scale here:
//   - Central/national banks and countries: short, uniform factual sentences.
//   - Generic title_role/government_institution entries: describe the office, not one holder.
//   - Registry quirks where the type label doesn't match the real thing (e.g. "Holy See" typed
//     person, "Titanic" typed military_asset_vessel, "Law Day" typed person): described as what
//     the entity actually is, type field left alone.
//   - Fictional/creative works marked as such (WarGames, The Matrix, The Godfather Part III).
//   - Q's own archive-specific coded_alias terms (Q Clearance Patriot, Wizards & Warlocks, VIP
//     Patriot, obfuscated spellings like _4ch_n/_8ch_y/PAN-DEM-IC) written directly.
//   - Bare surnames/first names resolved to the most contextually likely person, with genuine
//     ambiguity (Maria, Alan, Wendy, Bakers, Romney's son) noted rather than forced.
//   - Duplicate registry rows for the same real person/place (e.g. Dent/Charles W. Dent/Charlie
//     Dent; JFK Conference Room/JFK Con Room) written consistently.
//   - Obscure single-mention names: honest "cannot be verified" synopses rather than fabrication.
//
//   node scripts/build-owner-rulings-2026-08-26-synopses-tier4.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entity-synopsis-owner-rulings.json')
const dry = process.argv.includes('--dry')

const SCRATCH = 'C:/Users/heath/AppData/Local/Temp/claude/C--Users-heath/81edd0f2-25ff-48c3-bc33-131b8b611791/scratchpad'
const RAW = Array.from({ length: 29 }, (_, i) => i + 1)
  .flatMap(n => JSON.parse(fs.readFileSync(path.join(SCRATCH, `t4-batch${n}.json`), 'utf8')))

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byId = new Map(entities.map(e => [e.id, e]))

const RULED_ON = '2026-08-26'
const PROVENANCE = 'Owner ruling: "yes lets finish 1" (completing the entity-synopsis sweep). Tier 4: mentions 1-4, the final tier.'

const problems = []
const synopses = []
const seenIds = new Set()
for (const { entityId, canonical, synopsis } of RAW) {
  if (seenIds.has(entityId)) { problems.push(`${entityId}: duplicate row across batches`); continue }
  seenIds.add(entityId)
  const e = byId.get(entityId)
  if (!e) { problems.push(`${entityId}: not a live entity`); continue }
  // Curly vs straight apostrophe is the only drift research agents produced — normalise before comparing.
  const norm = s => s.replace(/[‘’]/g, "'")
  if (norm(e.canonical) !== norm(canonical)) { problems.push(`${entityId}: canonical mismatch — archive has "${e.canonical}", batch said "${canonical}"`); continue }
  const firstWord = e.canonical.split(' ')[0].replace(/[()]/g, '')
  if (!synopsis.includes(firstWord)) problems.push(`${entityId} (${e.canonical}): synopsis does not contain "${firstWord}"`)
  synopses.push({ entityId, canonical: e.canonical, ruledOn: RULED_ON, provenance: PROVENANCE, synopsis })
}
if (RAW.length !== 1140) problems.push(`expected 1140 rows across the 29 batches, got ${RAW.length}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems.slice(0, 60)) console.error(`   ${p}`)
  if (problems.length > 60) console.error(`   ...and ${problems.length - 60} more`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))
doc.synopses ??= []
const already = new Set(doc.synopses.map(s => s.entityId))

console.log(`\nOWNER SYNOPSIS RULING — 2026-08-26, tier 4 (mentions 1-4, final tier)\n`)
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
