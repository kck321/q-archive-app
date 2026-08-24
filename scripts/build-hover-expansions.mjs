// OWNER-DECLARED HOVER EXPANSIONS — what a short form stands for.
//
//   -> audit/entity-hover-expansions.json   (read by normalise-entity-hovers.mjs)
//
// normalise-entity-hovers.mjs writes one sentence per entity and is deliberate about never
// inventing the "used for X" clause: it carries the clause across from the authored synopsis where
// one existed, and where none did the sentence simply has no such clause. That rule is what makes
// generating a hover for 358 entities safe.
//
// It leaves a gap the owner has now asked to fill twice. An entity certified for the FIRST time in
// this batch has no authored synopsis to carry a clause from, so "NAT SEC" would read only as
//
//     "NAT SEC" is a coded alias in this archive. It appears 48 times across 48 posts.
//
// which tells the reader nothing they could not see. The expansion is not a guess in these cases —
// it is stated by the drops themselves, and every entry below names the drop that states it.
//
// TWO SOURCES, ONE FILE.
//
//   1. audit/unhighlighted-entity-identities-3.json — the `expansion` field on the identities
//      researched from the drop each held row sits in. Read, not retyped, so the evidence in the
//      identity's `why` and the clause the reader sees cannot drift apart.
//   2. The literal entries below, for entities certified through other artifacts.
//
// PRECEDENCE. An authored synopsis always wins. These fill in only where no clause exists to
// carry, which is exactly the new rows.
//
// ONE EXCEPTION, AND IT IS PER-ENTRY, NEVER A CHANGE TO THE RULE. An entry may carry
// `overridesAuthored: true`, and then it replaces the authored clause instead of filling a gap.
// That is reserved for an owner ruling that names the entity and says what the clause should be —
// the rule above protects authored editorial from a GENERATOR, not from the owner. Every such
// entry says in its `why` which authored wording it replaces and why that wording was wrong.
//
//   node scripts/build-hover-expansions.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const OUT = path.join(ROOT, 'audit/entity-hover-expansions.json')

// ── declared here, for entities certified outside the held-row batch ─────────
const DECLARED = [
  {
    canonical: 'Q',
    expansion: 'a team of fewer than 10 people, of whom Q says only three are non-military',
    overridesAuthored: true,
    why: 'OWNER RULING 2026-08-24 (UPDATED report, sheet 6): "q does = alice in the pertaining post but any other post i would make the hover synopsis that q is a group of people less than 10 or how ever q explains it somewhere in the post". Q states it himself in #60 — "You can count the people who have the full picture on two hands." / "Of those (less than 10 people) only three are non-military." — and in #244, "Less than 10 can confirm me." He repeats the figure when asked who can speak for the designation: #722 ("Who are we talking to? … Less than 10.") and #1788 ("Who is the one person who can answer? POTUS. [Less than 10]."). REPLACES the authored clause "Q — the poster/persona speaking to the public through the imageboards", which described the byline rather than what Q says the designation stands for. The Q = Alice equation is untouched: #74 and #78 write it in Q\'s own words and those occurrences are certified as the entity Alice, which carries its own hover.',
  },
  {
    canonical: 'NAT SEC',
    expansion: 'national security',
    why: 'OWNER RULING 2026-08-24: "NAT SEC is an entity throughout all the post so lets fix that and give it a hover description". The drops state the expansion themselves and use it as a domain rather than as a body: "NAT SEC laws." (#1127), "Matters of NAT SEC." (#1981), "sections of the IG report @ highest level of NAT SEC?" (#1552), "Do \'reflections\' violate NAT SEC rules?" (#1677), ">NAT SEC ADVISOR TO SESSIONS" (#2462), "[NAT SEC - HRC email invest]" (#1316, #2070, #2381). It is NOT the National Security Agency, which the archive certifies separately with 92 mentions across 66 posts.',
  },
]

const idents = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-entity-identities-3.json'), 'utf8'))
const fromIdentities = (idents.identities ?? [])
  .filter(i => i.expansion)
  .map(i => ({ canonical: i.canonical, expansion: i.expansion, why: i.why }))

const byCanonical = {}
const collisions = []
for (const row of [...fromIdentities, ...DECLARED]) {
  if (byCanonical[row.canonical] && byCanonical[row.canonical].expansion !== row.expansion) {
    collisions.push({ canonical: row.canonical, kept: byCanonical[row.canonical].expansion, dropped: row.expansion })
    continue
  }
  byCanonical[row.canonical] = row
}

const out = {
  note: 'What a short form stands for, for entities with no authored synopsis to carry the clause from.',
  ruledOn: '2026-08-24',
  precedence: 'An authored synopsis wins, EXCEPT where an entry carries overridesAuthored: true — an owner ruling that names the entity and says what the clause should be. Everything else fills in only where normalise-entity-hovers.mjs finds no "is used for" clause to carry across.',
  sources: {
    'audit/unhighlighted-entity-identities-3.json': fromIdentities.length,
    'declared in scripts/build-hover-expansions.mjs': DECLARED.length,
  },
  totals: { expansions: Object.keys(byCanonical).length, collisions: collisions.length },
  collisions,
  expansions: Object.fromEntries(Object.entries(byCanonical).sort((a, b) => a[0].localeCompare(b[0]))),
}

if (check) { console.log(JSON.stringify(out.totals, null, 1)); process.exit(0) }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))

console.log('')
console.log('HOVER EXPANSIONS')
console.log('')
console.log(`  from identities-3 : ${fromIdentities.length}`)
console.log(`  declared here     : ${DECLARED.length}`)
console.log(`  total             : ${Object.keys(byCanonical).length}`)
if (collisions.length) for (const c of collisions) console.log(`  COLLISION ${c.canonical}: kept "${c.kept}", dropped "${c.dropped}"`)
console.log('')
console.log('wrote audit/entity-hover-expansions.json')
console.log('')
