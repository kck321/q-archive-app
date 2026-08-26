// THE OWNER'S RULING OF 2026-08-26 (tier 1, part A): synopses for the archive's own coded
// phrases and generic terms — "Alice", "Godfather III", "Alice & Wonderland", "NAT SEC",
// "Patriots", "We the People", "Democrat", "God", "MSDNC", "Project Snow White" — written
// directly rather than via web-search agents, because these are either IN-UNIVERSE Q
// conventions (no outside source defines them) or generic English terms/phrases, not
// independently researchable real-world subjects the way a journalist or a country is.
//
//   node scripts/build-owner-rulings-2026-08-26-synopses-tier1a.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entity-synopsis-owner-rulings.json')
const dry = process.argv.includes('--dry')

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byId = new Map(entities.map(e => [e.id, e]))

const RULED_ON = '2026-08-26'
const PROVENANCE = 'Owner ruling: "for any entity that doesn\'t [have a synopsis]... lets search the internet." Written directly rather than researched — an in-universe Q convention or a generic term, not an independently researchable real-world subject.'

const RAW = [
  ['qe-e01fe208ebaa', 'Alice is the name Q equates with himself/the person(s) writing the drops. The equation "Q = Alice" is stated directly in drop #74, and every other occurrence in the archive is read as inheriting that identity rather than restating it.'],
  ['qe-37b07a60c52b', '"Alice & Wonderland" is a phrase Q introduces in the same drop that states "Q = Alice" (#74: "You\'ll soon understand the meaning behind Alice \'&\' Wonderland"), tying it to that equation. Q never explains the phrase further; it recurs afterward alongside other unexplained signature phrases like "Snow White" and "Iron Eagle."'],
  ['qe-a7426511827a', '"Godfather III" is one of several recurring phrases Q calls "signatures" (#87: "My signatures all reference upcoming events about to drop"), appearing alongside "Snow White" and "Iron Eagle." Q states these carry meaning but never defines them; it is commonly read by researchers as an allusion to the 1990 film The Godfather Part III, though Q never confirms this.'],
  ['qe-d7fe77ea9c01', 'NAT SEC is Q\'s shorthand for "national security," used across dozens of drops as a general reference to national-security matters rather than as the name of a specific organization.'],
  ['qe-7e666288b152', '"Patriots" is Q\'s recurring term for supporters of the movement and, more broadly, for Americans loyal to the country — a label for a group of people rather than the name of a specific person or organization.'],
  ['qe-271807d35b2e', '"We the People" is the opening phrase of the preamble to the U.S. Constitution. Q uses it as a recurring reference to the American public/citizenry rather than as the name of a specific organization.'],
  ['qe-d38940e564bf', '"Democrat" here is a general term for a member of, or affiliation with, the U.S. Democratic Party — distinct in this archive from the "Democratic Party" entity itself, since Q most often uses "Democrat" to describe individuals rather than the organization.'],
  ['qe-2df6a50f6a0e', 'God is referenced across the drops, most often in phrases like "God bless," "In God we trust," or "For God and country." The archive records where and how often the term appears without asserting any particular theological claim.'],
  ['qe-4c00a2e32fc2', 'MSDNC is a derogatory portmanteau of "MSNBC" and "DNC" (Democratic National Committee), used to imply the network is politically aligned with the Democratic Party — not the network\'s actual name.'],
  ['qe-71878b3acd46', 'Project Snow White was a real covert operation in the 1970s by the Church of Scientology to infiltrate and steal documents from U.S. government agencies, uncovered by the FBI in 1977 — at the time, the largest known infiltration of the U.S. federal government by a private organization. Q\'s own drops also use the shorter phrase "Snow White" as one of several recurring unexplained signature phrases; this entity reflects the real historical operation researchers commonly connect it to.'],
]

const problems = []
const synopses = []
for (const [entityId, synopsis] of RAW) {
  const e = byId.get(entityId)
  if (!e) { problems.push(`${entityId}: not a live entity`); continue }
  const firstWord = e.canonical.split(' ')[0]
  if (!synopsis.includes(firstWord)) problems.push(`${entityId} (${e.canonical}): synopsis does not contain "${firstWord}"`)
  synopses.push({ entityId, canonical: e.canonical, ruledOn: RULED_ON, provenance: PROVENANCE, synopsis })
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))
doc.synopses ??= []
const already = new Set(doc.synopses.map(s => s.entityId))

console.log(`\nOWNER SYNOPSIS RULING — 2026-08-26, tier 1a (archive-specific terms)\n`)
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
