// THE OWNER'S ENTITY RULINGS OF 2026-08-24, EACH SCOPED TO THE DROP IT NAMES.
//
//   -> appends to audit/entities-owner-rulings.json  (rulings[], aliasWithdrawals[])
//   node scripts/build-owner-entity-rulings-2026-08-24.mjs [--dry]
//
//   "Just classify these categories on only these specific post i gave you: not across the whole
//    app"
//
// THAT SCOPING IS WHY THIS PATH AND NOT AN ALIAS. `rulings[]` adds ONE mention on ONE drop and
// pushes the alias Q wrote into that drop's namedEntities — nothing else in the corpus moves. An
// alias addition is the other shape and it is corpus-wide: registering "45" as an alias of Donald
// Trump would have claimed 281 occurrences across 255 drops, which is exactly what the owner ruled
// out. Every ruling below names a post and touches that post.
//
// THE IDENTITY IS REUSED WHEREVER THE ARCHIVE ALREADY HAS ONE. "Democratic" resolves to the
// certified Democratic Party (47 mentions), "45" to Donald Trump, "Goodlatte" to Bob Goodlatte —
// creating a second row for a person the registry already holds is the duplicate-identity defect
// the merge rulings exist to undo.
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

const RULED_ON = '2026-08-24'
/**
 * A ruling that EXTENDS the span already painted on that drop, instead of adding a second one.
 *
 * #3383's list is certified as "Waters", "Pelosi", "Biden" — the initial in front of each was cut
 * off. Adding "M. Waters" beside the existing "Waters" would paint a box inside a box and count the
 * same person twice on one line. `replacesAliasOnPost` says which entry to lengthen, so the
 * mention count does not move: one occurrence, spelled the way Q spelled it.
 */
const X = (postNum, canonical, aliasUsed, type, replaces, reasoning) =>
  ({ ...R(postNum, canonical, aliasUsed, type, reasoning), replacesAliasOnPost: replaces })

const R = (postNum, canonical, aliasUsed, type, reasoning) =>
  ({ postNum, postId: String(postNum), canonical, aliasUsed, sourceText: aliasUsed, type,
    was: 'unclassified', ruledOn: RULED_ON, reasoning, renderAs: aliasUsed,
    renderNote: `RENDERING_PROVENANCE_RULE: the canonical identity is "${canonical}" and the ALIAS Q wrote is "${aliasUsed}". The renderer highlights the alias.` })

const NEW = [
  // ── #300 ──────────────────────────────────────────────────────────────────
  R(300, 'L.', 'L.', 'coded_alias',
    'Owner ruling: "L is an entity so go ahead and make that an entity". A line of its own between the question about Alwaleed/Hussein/Clinton and "Heard you can\'t sleep anymore." — Q addressing someone by an initial. WHO it names is not settled and is not claimed here: the row is the designation, not a person. Scoped to #300 because "L." occurs 157 times across the corpus and almost all of them are ordinary sentence-ending initials.'),

  // ── #836 ──────────────────────────────────────────────────────────────────
  // ONE entity over the whole span, which is what the ruling says. The certified row is LENGTHENED
  // rather than replaced by a second one: a new "Operation Fiddler" row beside the existing
  // "Fiddler" would be two identities for one occurrence, which is the duplicate-identity defect
  // the merge rulings exist to undo. What it refers to is said in the hover, where an expansion
  // belongs — see audit/entity-hover-expansions.json.
  X(836, 'Fiddler', 'OP Name: Fiddler', 'program_operation', 'Fiddler',
    'Owner ruling: "OP Name: Fiddler is 1 entity and I believe it refers to Operation Fiddler". Q writes the label and the name together on one line of the Vault7 mission list, above "@Snowden" and "Mission 1: Infiltrate". The certified span covered the name alone; this lengthens it to the whole line Q wrote, and the hover carries the expansion.'),

  // ── #1319 ─────────────────────────────────────────────────────────────────
  // A SECOND OCCURRENCE ON A DROP THE IDENTITY ALREADY APPEARS ON. The list line above certifies
  // "Bob Goodlatte - Republican"; line 59 names him again by surname, and that is another mention,
  // not the same one. `additionalOccurrence` is what says so — without it the ruling would paint a
  // span the count does not know about.
  { ...R(1319, 'Bob Goodlatte', 'Goodlatte', 'person',
    'Owner ruling. Line 59, "Goodlatte & Gowdy [important]." — the same man the list above certifies as "Bob Goodlatte - Republican", named by surname here. A second occurrence on the same drop.'),
    additionalOccurrence: true },
  R(1319, 'House Committee', 'House Committee', 'government_institution',
    'Owner ruling. Line 60, "Chairman of the House Committee on the Judiciary." Reuses the certified House Committee identity.'),
  R(1319, 'House Oversight', 'House Oversight', 'government_institution',
    'Owner ruling. Line 61, "Chairman of the House Oversight and Government Reform Committee." Q names two bodies on that line and the owner ruled both; this is the first.'),
  R(1319, 'Government Reform Committee', 'Government Reform Committee', 'government_institution',
    'Owner ruling. The second body on line 61. Split from "House Oversight" the same way the central-bank and congressional lists are split — one line, two things named.'),
  R(1319, 'Democratic Party', 'Democratic', 'political_group',
    'Owner ruling. Line 43, "Al Franken - Democratic U.S. Senate". Resolves to the certified Democratic Party identity rather than opening a second row for the same party.'),
  R(1319, 'Attorney General', 'Attorney General', 'title_role',
    'Owner ruling. Line 53, "Xavier Becerra - Democrat Attorney General of California". Reuses the certified Attorney General identity.'),

  // ── #836, again ───────────────────────────────────────────────────────────
  // "in post 836 i want Vault7 or any Vault 7 to be classified as an entitiy throughout all the
  // post". Swept first: the corpus writes it ONCE, "Who leaked Vault7 to WL?" on #836, spelled
  // without a space and nowhere else. So corpus-wide and post-scoped are the same ruling here, and
  // the ruling is recorded on the drop that has it.
  //
  // TYPED LIKE THE STEELE DOSSIER, which the archive already carries as a creative_work. Vault 7 is
  // the same shape of thing: a named document release, not an organisation and not an event.
  R(836, 'Vault 7', 'Vault7', 'creative_work',
    'Owner ruling: "in post 836 i want Vault7 or any Vault 7 to be classified as an entitiy throughout all the post". The WikiLeaks publication of March 2017 that released CIA hacking tools — Q asks "Who leaked Vault7 to WL?" and WL is already the certified WikiLeaks. A corpus sweep for vault7 / vault 7 returns exactly one occurrence, so this covers every one of them.'),

  // ── #1565 ─────────────────────────────────────────────────────────────────
  R(1565, 'Donald Trump', '45', 'person',
    'Owner ruling: "45 is an entity and is also the nuber trump was in his last term so it is an alias for trump". The whole drop is the single line "45", replying to an anon asking who is in a photo. SCOPED TO #1565: "45" occurs 281 times across 255 drops — page numbers, counts, timestamps — and registering it as a corpus-wide alias would name Trump in every one of them.'),

  // ── #2734 ─────────────────────────────────────────────────────────────────
  R(2734, 'F-15', 'F-15', 'military_asset_vessel',
    'Owner ruling: "post 2734 i want F-15 an entitiy as of now". The certified F-15 row carries the alias "F15" without the hyphen, which is why the drop\'s own spelling never painted. This registers the occurrence as Q wrote it.'),

  // ── #3383 ─────────────────────────────────────────────────────────────────
  // These three EXTEND a span rather than adding one — see replacesAliasOnPost below.
  X(3383, 'Waters', 'M. Waters', 'person', 'Waters',
    'Owner ruling: "Lets make each one of these full entities you are forgetting to highlight the first letter of their names". The certified span was "Waters"; Q wrote "M. Waters $4mm House?" and the initial is part of the name.'),
  X(3383, 'Nancy Pelosi', 'N. Pelosi', 'person', 'Pelosi',
    'Owner ruling, same line of the list: "N. Pelosi net worth $150mm+?" The certified span was "Pelosi".'),
  X(3383, 'Joe Biden', 'J. Biden', 'person', 'Biden',
    'Owner ruling, same list: "J. Biden son/brother net worth tens of millions?" The certified span was "Biden". SCOPED TO #3383 — "J. Biden" also appears on #4871, which the owner did not name.'),
]

// The shorter span #836 no longer needs. Withdrawn at the SOURCE, so the mention and the paint
// fall together — see the note above `withdrawnAliases` in apply-entities.mjs.
// Nothing is withdrawn: #836 is a span EXTENSION, so the one certified occurrence keeps its row and
// simply covers the whole line Q wrote.
const WITHDRAW = []

// ── EVERY RULING IS CHECKED AGAINST THE DROP ────────────────────────────────
// The alias must be text Q wrote on that drop, and a canonical that already exists must be the one
// the ruling names — a typo would otherwise open a duplicate identity silently.
const problems = []
for (const r of NEW) {
  const p = byNum.get(r.postNum)
  if (!p) { problems.push(`#${r.postNum} is not a drop`); continue }
  if (!runtime(p.text).includes(r.aliasUsed)) {
    problems.push(`#${r.postNum} does not contain ${JSON.stringify(r.aliasUsed)}`)
    continue
  }
  const live = entities.find(e => e.canonical === r.canonical)
  if (live && live.type !== r.type) {
    problems.push(`#${r.postNum} ${JSON.stringify(r.canonical)} is typed ${live.type}, the ruling says ${r.type}`)
  }
  r.canonicalExisted = Boolean(live)
}
for (const w of WITHDRAW) {
  const live = entities.find(e => e.canonical === w.canonical)
  if (!live) problems.push(`withdrawal names an unknown canonical: ${w.canonical}`)
  else if (!(live.aliases ?? []).some(a => a.text === w.alias)) {
    problems.push(`${w.canonical} has no alias ${JSON.stringify(w.alias)}`)
  }
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
const haveW = new Set((doc.aliasWithdrawals ?? []).map(w => `${w.canonical}|${w.alias}`))
const addedW = WITHDRAW.filter(w => !haveW.has(`${w.canonical}|${w.alias}`))

console.log('\nOWNER ENTITY RULINGS — 2026-08-24, post-scoped\n')
for (const r of NEW) {
  console.log(`  #${String(r.postNum).padEnd(6)} ${JSON.stringify(r.aliasUsed).padEnd(30)} -> ${r.canonical}`
    + `${r.canonicalExisted ? '  (existing identity)' : '  (NEW identity)'}`)
}
console.log(`\n  ${added.length} new, ${NEW.length - added.length} already recorded · withdrawals ${addedW.length}\n`)
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added.length && !addedW.length) { console.log('  nothing to write\n'); process.exit(0) }

doc.rulings = [...(doc.rulings ?? []), ...added]
doc.aliasWithdrawals = [...(doc.aliasWithdrawals ?? []), ...addedW]
fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, FILE)}\n`)
