// THE OWNER'S ENTITY RULINGS OF 2026-08-25 — three span extensions, each scoped to its drop.
//
//   -> appends to audit/entities-owner-rulings.json  (rulings[])
//   node scripts/build-owner-rulings-2026-08-25.mjs [--dry]
//
//   "Senate Minority Leader should be a single enttity in q post 3778 and 4935"
//   "Lets go ahead and make Mayor an entity as well and if its connected to another entity
//    conjoine them into 1"
//
// ALL THREE ARE EXTENSIONS, NOT ADDITIONS — the #836 "OP Name: Fiddler" shape. Each drop already
// certifies an occurrence inside the phrase the owner named ("Senate" via the United States Senate
// alias; "Bill de Blasio"), so the ruling LENGTHENS that span to the phrase Q wrote. A second row
// beside the first would paint a box inside a box and count one occurrence twice.
//
// "MAYOR" IS SCOPED TO #4935, where it is conjoined ("Mayor Bill de Blasio"). The bare word occurs
// 16 more times across 7 other drops (#100 London Mayor, #1948 Daley/Emanuel, the #4630-#4633
// convicted-mayors lists, #4476) — those are HELD for the owner rather than swept: each needs its
// own conjoin-or-standalone reading, and the standing scoping rule is "only these specific posts".
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'audit/entities-owner-rulings.json')
const dry = process.argv.includes('--dry')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byNum = new Map(posts.map(p => [p.postNum, p]))
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const runtime = t => String(t || '').replace(MARKUP, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')

const RULED_ON = '2026-08-25'
const X = (postNum, canonical, aliasUsed, type, replaces, reasoning) =>
  ({ postNum, postId: String(postNum), canonical, aliasUsed, sourceText: aliasUsed, type,
    was: 'unclassified', ruledOn: RULED_ON, reasoning, renderAs: aliasUsed,
    renderNote: `RENDERING_PROVENANCE_RULE: the canonical identity is "${canonical}" and the ALIAS Q wrote is "${aliasUsed}". The renderer highlights the alias.`,
    replacesAliasOnPost: replaces })

const NEW = [
  X(3778, 'United States Senate', 'Senate Minority Leader', 'political_group', 'Senate',
    'Owner ruling: "Senate Minority Leader should be a single enttity in q post 3778 and 4935". The line is "Sen. Chuck Schumer (D-NY) – Senate Minority Leader"; the certified span was the bare "Senate" (a United States Senate alias), which boxed one word of a three-word title. Lengthened to the title as Q wrote it — one occurrence, one box.'),
  X(4935, 'United States Senate', 'Senate Minority Leader', 'political_group', 'Senate',
    'Owner ruling, same sentence: the second of the two drops named. The line is "Senate Minority Leader Chuck Schumer, D-N.Y." and the certified span was the bare "Senate". Lengthened to the full title.'),
  X(4935, 'Bill de Blasio', 'Mayor Bill de Blasio', 'person', 'Bill de Blasio',
    'Owner ruling: "Lets go ahead and make Mayor an entity as well and if its connected to another entity conjoine them into 1". On #4935 Q writes "Mayor Bill de Blasio, D-N.Y.C" and the certified span was the name alone; Mayor is conjoined into the one span. SCOPED TO #4935 — the bare word occurs 16 more times across 7 drops and each needs its own reading; those are held for the owner.'),
]

const problems = []
for (const r of NEW) {
  const p = byNum.get(r.postNum)
  if (!p) { problems.push(`#${r.postNum} is not a drop`); continue }
  if (!runtime(p.text).includes(r.aliasUsed)) {
    problems.push(`#${r.postNum} does not contain ${JSON.stringify(r.aliasUsed)}`)
    continue
  }
  const live = entities.find(e => e.canonical === r.canonical)
  if (!live) { problems.push(`#${r.postNum} names an unknown canonical ${JSON.stringify(r.canonical)} — an extension lengthens an existing identity`); continue }
  if (live.type !== r.type) {
    problems.push(`#${r.postNum} ${JSON.stringify(r.canonical)} is typed ${live.type}, the ruling says ${r.type}`)
  }
  if (!live.posts.includes(r.postNum)) {
    problems.push(`#${r.postNum} — ${JSON.stringify(r.canonical)} has no certified occurrence on that drop to lengthen`)
  }
  r.canonicalExisted = true
}
if (problems.length) {
  console.error(`\n${problems.length} ruling(s) do not match the archive:`)
  for (const p of problems) console.error(`   ${p}`)
  console.error('\nRefusing to write a ruling the drop does not support.\n')
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const have = new Set((doc.rulings ?? []).map(r => `${r.postNum}|${r.canonical}|${r.aliasUsed}`))
const added = NEW.filter(r => !have.has(`${r.postNum}|${r.canonical}|${r.aliasUsed}`))

console.log('\nOWNER ENTITY RULINGS — 2026-08-25, span extensions\n')
for (const r of NEW) {
  console.log(`  #${String(r.postNum).padEnd(6)} ${JSON.stringify(r.replacesAliasOnPost).padEnd(18)} -> ${JSON.stringify(r.aliasUsed)}`)
}
console.log(`\n  ${added.length} new, ${NEW.length - added.length} already recorded\n`)
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added.length) { console.log('  nothing to write\n'); process.exit(0) }

doc.rulings = [...(doc.rulings ?? []), ...added]
fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, FILE)}\n`)
