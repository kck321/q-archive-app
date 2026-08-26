// FOUR PRE-EXISTING DUPLICATE-SPAN WITHDRAWALS, discovered 2026-08-25 while conjoining titles
// onto #3778 and #4935 at the owner's request, NOT caused by that ruling.
//
// Each of these four people already carried TWO separately certified spans for the SAME single
// mention, before today's session touched anything: a bare surname/name alias, and a second,
// fuller alias covering the whole descriptor line Q wrote ("Nancy Pelosi (D-CA) – Speaker of the
// House", "Gov. Andrew Cuomo, D-N.Y" after today's extension). Both fire on the same line, so the
// drop renders two overlapping highlight boxes for one occurrence — nested same-kind spans are
// never collapsed by the renderer (see the note in lib/highlightConstants.mjs), so this is not
// cosmetic drift, it is visibly two boxes.
//
// THE SHORT ALIAS IS WITHDRAWN, NOT THE LONG ONE, because the long one is what the owner's title
// ruling asked for and it is the whole phrase Q actually wrote. Withdrawing corpus-wide would be
// wrong for two of the four: Nancy Pelosi's bare "Nancy Pelosi" alias also fires on #2036 (a
// completely different drop, nothing to do with this one) and Adam Schiff's bare "Adam Schiff"
// fires on #325 and #4521 too — a blanket withdrawal would silently un-highlight those. Scoped by
// `onlyPosts` (see apply-entities.mjs's isWithdrawn()) to the exact drop each duplicate lives on.
//
//   node scripts/build-owner-rulings-2026-08-25-duplicate-spans.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'audit/entities-owner-rulings.json')
const dry = process.argv.includes('--dry')
const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities

const RULED_ON = '2026-08-25'
const NEW = [
  { canonical: 'Nancy Pelosi', alias: 'Nancy Pelosi', onlyPosts: [3778], ruledOn: RULED_ON,
    reasoning: 'Pre-existing duplicate span, found while conjoining #3778\'s titles. The certified "Nancy Pelosi" bare alias (2 mentions total) and the full-line "Nancy Pelosi (D-CA) – Speaker of the House" alias (1 mention) both fire on #3778, boxing the same name twice. The bare alias\'s OTHER occurrence is #2036, an unrelated drop, and stays untouched — scoped to #3778 only.' },
  { canonical: 'Adam Schiff', alias: 'Adam Schiff', onlyPosts: [3778], ruledOn: RULED_ON,
    reasoning: 'Same defect as Nancy Pelosi above, same drop. The bare "Adam Schiff" alias (3 mentions total, corroborated against audit/entities-audit.json: #325, #3778, #4521) and the full-line "Adam Schiff (D-CA) – Chair Intel" alias both fire on #3778. #325 and #4521 stay untouched.' },
  { canonical: 'Jerry Nadler', alias: 'Jerry Nadler', onlyPosts: [3778], ruledOn: RULED_ON,
    reasoning: 'Same defect, same drop, an adjudicated-tail identity rather than core registry. The bare "Jerry Nadler" alias and the full-line "Jerry Nadler (D-NY) – Chair Judiciary" alias both fire on #3778. Scoped rather than corpus-wide because audit/entities-tail-occurrences.json also carries a #2136 occurrence of the bare alias that this ruling must not touch.' },
  { canonical: 'Andrew Cuomo', alias: 'Andrew Cuomo', onlyPosts: [4935], ruledOn: RULED_ON,
    reasoning: 'Discovered verifying today\'s #4935 title-conjoining ruling. The certified bare "Andrew Cuomo" alias and the "Gov. Andrew Cuomo, D-N.Y" alias this session extended both fire on the same "Gov. Andrew Cuomo, D-N.Y" line. An adjudicated-tail identity; #4935 is his only certified occurrence, so this and a corpus-wide withdrawal are the same ruling here, but scoped for consistency with the other three.' },
]

const problems = []
for (const r of NEW) {
  const live = entities.find(e => e.canonical === r.canonical)
  if (!live) { problems.push(`unknown canonical ${JSON.stringify(r.canonical)}`); continue }
  if (!live.aliases.some(a => a.text === r.alias)) problems.push(`${JSON.stringify(r.canonical)} has no alias ${JSON.stringify(r.alias)}`)
  if (!live.posts.some(p => r.onlyPosts.includes(p))) problems.push(`${JSON.stringify(r.canonical)} is not certified on ${JSON.stringify(r.onlyPosts)}`)
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

console.log('\nOWNER WITHDRAWAL RULINGS — 2026-08-25, pre-existing duplicate spans\n')
for (const r of NEW) console.log(`  ${r.canonical.padEnd(16)} withdraw ${JSON.stringify(r.alias).padEnd(45)} onlyPosts ${JSON.stringify(r.onlyPosts)}`)

const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const have = new Set((doc.aliasWithdrawals ?? []).map(w => `${w.canonical}|${w.alias}|${JSON.stringify(w.onlyPosts ?? null)}`))
const added = NEW.filter(w => !have.has(`${w.canonical}|${w.alias}|${JSON.stringify(w.onlyPosts)}`))
console.log(`\n  ${added.length} new, ${NEW.length - added.length} already recorded\n`)
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added.length) { console.log('  nothing to write\n'); process.exit(0) }

doc.aliasWithdrawals = [...(doc.aliasWithdrawals ?? []), ...added]
fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, FILE)}\n`)
