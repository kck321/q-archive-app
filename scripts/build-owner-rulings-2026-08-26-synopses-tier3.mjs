// THE OWNER'S RULING OF 2026-08-26 (tier 3): real researched synopses for the archive's
// mentions 5-9 entities (109 rows), continuing the sweep the owner confirmed with "yes lets
// finish 1". Researched via six parallel background agents against the same standard as tiers
// 1-2: who/what the entity IS, no adoption of Q's framing, strictly neutral tone for anything
// politically charged. Several rows needed special handling, all documented in the batch prompts:
//   - Generic title_role terms (AG, Secretary of State, President of the United States, US
//     President, Deputy Attorney General) written directly, not researched as one officeholder.
//   - Archive-specific coded_alias terms: "Clowns In America" (Q's CIA wordplay), "SEC TEST"
//     (a literal posting-security test, not a real-world subject), "Iron Eagle" (one of Q's
//     recurring unexplained "signature" phrases, same family as Godfather III/Snow White).
//   - Fictional characters/works, marked as such rather than treated as real: "Jason Bourne"
//     (typed "person" in the registry but a novel/film character), "House of Cards", "The Sum of
//     All Fears".
//   - Rows the registry types as "person" that are not people at all, described as what they
//     actually are without correcting the type field: "Las Vegas" (a city).
//   - Bare surnames/first names resolved to the most contextually likely real person, with
//     genuine ambiguity noted rather than forced ("Page" between Lisa/Carter Page, "Podesta"
//     between John/Tony Podesta, "John M" left as an unidentified early reference).
//   - "Adm R" and "Justice K"-style inferred identifications, phrased as inferred, not asserted.
//   - "Qanon" itself: a strictly neutral encyclopedic description of the movement that grew
//     around this archive's own source material.
//
//   node scripts/build-owner-rulings-2026-08-26-synopses-tier3.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entity-synopsis-owner-rulings.json')
const dry = process.argv.includes('--dry')

const SCRATCH = 'C:/Users/heath/AppData/Local/Temp/claude/C--Users-heath/81edd0f2-25ff-48c3-bc33-131b8b611791/scratchpad'
const RAW = [1, 2, 3, 4, 5, 6].flatMap(n => JSON.parse(fs.readFileSync(path.join(SCRATCH, `tier3-batch${n}.json`), 'utf8')))

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byId = new Map(entities.map(e => [e.id, e]))

const RULED_ON = '2026-08-26'
const PROVENANCE = 'Owner ruling: "yes lets finish 1" (continuing the entity-synopsis sweep). Tier 3: mentions 5-9.'

const problems = []
const synopses = []
const seenIds = new Set()
for (const { entityId, canonical, synopsis } of RAW) {
  if (seenIds.has(entityId)) { problems.push(`${entityId}: duplicate row across batches`); continue }
  seenIds.add(entityId)
  const e = byId.get(entityId)
  if (!e) { problems.push(`${entityId}: not a live entity`); continue }
  if (e.canonical !== canonical) { problems.push(`${entityId}: canonical mismatch — archive has "${e.canonical}", batch said "${canonical}"`); continue }
  const firstWord = e.canonical.split(' ')[0].replace(/[()]/g, '')
  if (!synopsis.includes(firstWord)) problems.push(`${entityId} (${e.canonical}): synopsis does not contain "${firstWord}"`)
  synopses.push({ entityId, canonical: e.canonical, ruledOn: RULED_ON, provenance: PROVENANCE, synopsis })
}
if (RAW.length !== 109) problems.push(`expected 109 rows across the six batches, got ${RAW.length}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))
doc.synopses ??= []
const already = new Set(doc.synopses.map(s => s.entityId))

console.log(`\nOWNER SYNOPSIS RULING — 2026-08-26, tier 3 (mentions 5-9)\n`)
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
