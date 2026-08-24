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
  precedence: 'An authored synopsis always wins. These fill in only where normalise-entity-hovers.mjs finds no "is used for" clause to carry across.',
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
