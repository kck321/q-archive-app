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

const R = (postNum, canonical, aliasUsed, type, reasoning) =>
  ({ postNum, postId: String(postNum), canonical, aliasUsed, sourceText: aliasUsed, type,
    was: 'unclassified', ruledOn: RULED_ON, reasoning, renderAs: aliasUsed,
    renderNote: `RENDERING_PROVENANCE_RULE: the canonical identity is "${canonical}" and the ALIAS Q wrote is "${aliasUsed}". The renderer highlights the alias.` })

const NEW = [
  X(3778, 'United States Senate', 'Senate Minority Leader', 'political_group', 'Senate',
    'Owner ruling: "Senate Minority Leader should be a single enttity in q post 3778 and 4935". The line is "Sen. Chuck Schumer (D-NY) – Senate Minority Leader"; the certified span was the bare "Senate" (a United States Senate alias), which boxed one word of a three-word title. Lengthened to the title as Q wrote it — one occurrence, one box.'),
  X(4935, 'United States Senate', 'Senate Minority Leader', 'political_group', 'Senate',
    'Owner ruling, same sentence: the second of the two drops named. The line is "Senate Minority Leader Chuck Schumer, D-N.Y." and the certified span was the bare "Senate". Lengthened to the full title.'),
  X(4935, 'Bill de Blasio', 'Mayor Bill de Blasio', 'person', 'Bill de Blasio',
    'Owner ruling: "Lets go ahead and make Mayor an entity as well and if its connected to another entity conjoine them into 1". On #4935 Q writes "Mayor Bill de Blasio, D-N.Y.C" and the certified span was the name alone; Mayor is conjoined into the one span. SCOPED TO #4935 — the bare word occurs 16 more times across 7 drops and each needs its own reading; those are held for the owner.'),

  // ── Second pass, same drop, same day: the owner named three more people on #4935 ──────────
  // "if there is a senator or govenor or mayor or any title in front of or behind like with ,
  //  D-N.Y. ... lets go ahead and capture their title w/ their name and count it as 1 Entity" +
  // "Harris, D-Calif ... lets make sure we also capture that within the name of the entity" +
  // "Terry McCauliffe has a Gov. title in front of his name that is not captured".
  //
  // A census of #4935 found the line was already INCONSISTENT before this ruling: Klobuchar,
  // Feinstein and Gillibrand were already certified with title+state ("Sen. Amy Klobuchar,
  // D-Minn"); Cuomo had the state suffix but not "Gov."; McCauliffe and Harris had neither. These
  // three bring the whole drop to one convention — title and party-state both conjoined where Q
  // wrote them — and extend the Mayor ruling above the same way.
  X(4935, 'Andrew Cuomo', 'Gov. Andrew Cuomo, D-N.Y', 'person', 'Andrew Cuomo, D-N.Y',
    'Owner ruling: title+suffix conjoining. The certified span already carried the party-state suffix ("Andrew Cuomo, D-N.Y") but not the title; Q\'s line is "Gov. Andrew Cuomo, D-N.Y" and this lengthens to it.'),
  X(4935, 'Bill de Blasio', 'Mayor Bill de Blasio, D-N.Y.C', 'person', 'Mayor Bill de Blasio',
    'Owner ruling: second extension of the Mayor ruling above, for the trailing party-city suffix Q wrote — "Mayor Bill de Blasio, D-N.Y.C". Applied in sequence after the first extension, on the alias it produced.'),
  X(4935, 'Terry McCauliffe', 'Gov. Terry McCauliffe', 'person', 'Terry McCauliffe',
    'Owner ruling: "Terry McCauliffe has a Gov. title in front of his name that is not captured as the title with his name as 1 entity". The certified span was the bare name; Q\'s line is "former Virginia Gov. Terry McCauliffe" and the immediate title is conjoined into the one span.'),
  // MERGE-DEPENDENT: the span this extends ("Harris" on #4935) belongs to the "Harris" canonical
  // until the merge below folds it into Kamala Harris. Flagged mergeDependsOn so the validator
  // checks post-membership through the merge rather than on the pre-merge snapshot.
  { ...X(4935, 'Kamala Harris', 'Harris, D-Calif.', 'person', 'Harris',
    'Owner ruling: "Harris, D-Calif (Kamala Harris, Democrat in California) lets make sure we also capture that within the name of the entity". The bare surname was certified under a separate duplicate "Harris" canonical (see the merges[] entry folding it into Kamala Harris below); this replaces that occurrence with the party-state suffix Q wrote, resolved to the real identity.'),
    mergeDependsOn: 'Harris' },

  // ── #4926 ──────────────────────────────────────────────────────────────────────────────────
  R(4926, 'Central Intelligence Agency', 'CIA', 'government_agency',
    'Owner ruling: "Post 4926 has CIA a known entity in the app but did not get caught in this post. lets classify this as a CIA entity and highlight the CIA". The whole drop is "Non_CIA_background next?" — CIA is a certified alias of the Central Intelligence Agency identity everywhere else in the corpus; this post simply never fired.'),
]

// ── Merges — the "Harris" ruling above depends on this running first ───────────────────────────
const MERGES = [
  { from: 'Harris', into: 'Kamala Harris', ruledOn: RULED_ON,
    reasoning: 'Discovered while conjoining #4935\'s title: a separate "Harris" canonical (2 mentions, #2854 and #4935) duplicates Kamala Harris. #2854 lists her alongside Pelosi/Waters/Schiff/Feinstein as sitting California officials of that era, and #4935 is the same Fox News contacts list this ruling extends — both are her, not a second person named Harris. Folded so the corpus counts one identity, not two.' },
]

const problems = []

// ── Merges validate first: both rows must exist, and 'from' must not already be a survivor ──
for (const m of MERGES) {
  const from = entities.find(e => e.canonical === m.from)
  const into = entities.find(e => e.canonical === m.into)
  if (!from) problems.push(`merge: unknown canonical "${m.from}"`)
  if (!into) problems.push(`merge: unknown canonical "${m.into}"`)
  if (from && into && from.type !== into.type) {
    problems.push(`merge: "${m.from}" is typed ${from.type}, "${m.into}" is typed ${into.type} — refusing to merge across types`)
  }
}
const mergedFrom = new Set(MERGES.map(m => m.from))

for (const r of NEW) {
  const p = byNum.get(r.postNum)
  if (!p) { problems.push(`#${r.postNum} is not a drop`); continue }
  if (!runtime(p.text).includes(r.aliasUsed)) {
    problems.push(`#${r.postNum} does not contain ${JSON.stringify(r.aliasUsed)}`)
    continue
  }
  const live = entities.find(e => e.canonical === r.canonical)
  if (!live) { problems.push(`#${r.postNum} names an unknown canonical ${JSON.stringify(r.canonical)}`); continue }
  if (live.type !== r.type) {
    problems.push(`#${r.postNum} ${JSON.stringify(r.canonical)} is typed ${live.type}, the ruling says ${r.type}`)
  }
  if (r.replacesAliasOnPost) {
    // An extension needs a certified occurrence to lengthen — either directly on this canonical,
    // or (mergeDependsOn) on the canonical a listed merge folds into this one before apply-entities
    // reaches the extension step. build-owner-rulings-2026-08-25.mjs runs both from the SAME
    // pre-merge snapshot of entities.json, so this is the one check that has to look past the merge
    // rather than at the file on disk.
    const reachable = live.posts.includes(r.postNum)
      || (r.mergeDependsOn && mergedFrom.has(r.mergeDependsOn)
          && entities.find(e => e.canonical === r.mergeDependsOn)?.posts.includes(r.postNum))
    if (!reachable) {
      problems.push(`#${r.postNum} — ${JSON.stringify(r.canonical)} (or its pending merge source ${JSON.stringify(r.mergeDependsOn)}) has no certified occurrence on that drop to lengthen`)
    }
  }
  // An addition (no replacesAliasOnPost) needs no post-membership check — it is allowed to be the
  // canonical's first occurrence on this drop, which is exactly the #4926 CIA case.
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
const haveM = new Set((doc.merges ?? []).map(m => `${m.from}|${m.into}`))
const addedM = MERGES.filter(m => !haveM.has(`${m.from}|${m.into}`))

console.log('\nOWNER ENTITY RULINGS — 2026-08-25\n')
for (const m of MERGES) console.log(`  MERGE  ${JSON.stringify(m.from)} -> ${JSON.stringify(m.into)}`)
for (const r of NEW) {
  const verb = r.replacesAliasOnPost ? 'EXTEND' : 'ADD   '
  console.log(`  ${verb} #${String(r.postNum).padEnd(6)} ${JSON.stringify(r.replacesAliasOnPost ?? '(new)').padEnd(20)} -> ${JSON.stringify(r.aliasUsed)}`)
}
console.log(`\n  ${added.length} ruling(s) new, ${NEW.length - added.length} already recorded · ${addedM.length} merge(s) new, ${MERGES.length - addedM.length} already recorded\n`)
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added.length && !addedM.length) { console.log('  nothing to write\n'); process.exit(0) }

doc.rulings = [...(doc.rulings ?? []), ...added]
doc.merges = [...(doc.merges ?? []), ...addedM]
fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, FILE)}\n`)
