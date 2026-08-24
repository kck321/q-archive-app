// ONE SHAPE FOR EVERY ENTITY HOVER — owner ruling, 2026-08-24.
//
//   "I also want every entity to have a hover description like we have been doing but i want all
//    the hover description to have the same look. i see some are different."
//
//   public/data/entity-hovers.json  ->  global rewritten, byPost untouched
//
// WHY THEY DIFFERED. The global synopses were AUTHORED, one per row, in the upstream registry
// audit. Most came out as "X is categorized in this archive as a TYPE. It appears N times across M
// posts."; thirty carry an extra "Within this archive, X is used for Y and…" clause; and 358
// entities certified since that audit have no synopsis at all. Three shapes and a gap.
//
// WHAT THIS WRITES. One sentence pattern, built from the CERTIFIED RECORD rather than from prose:
//
//     “POTUS” is a title or public role in this archive, used for President of the United States.
//     It appears 370 times across 370 posts.
//
//     “Patriots” is a title or public role in this archive.
//     It appears 239 times across 221 posts.
//
// THE EXPANSION IS PRESERVED, NEVER INVENTED. Where the authored synopsis said what a short form
// stands for, that clause is carried across verbatim; where it did not, the sentence simply has no
// such clause. Nothing new is asserted about any real person or organisation — every fact in the
// sentence is the archive's own record of itself, which is exactly why generating it for the 358 is
// safe where inventing a biography would not be.
//
// THE TYPE LABEL IS READ FROM THE CORPUS, not invented: for each type, the phrasing the audit
// itself used most often. Same rule extract-entity-hovers.mjs already applies.
//
// byPost is untouched. It is the layer that says how ONE drop uses the label, it already passes
// audit-hover-wording.mjs on all 3,693 records, and it is what makes the hover post-aware.
//
//   node scripts/normalise-entity-hovers.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOVERS = path.join(ROOT, 'public/data/entity-hovers.json')
const check = process.argv.includes('--check')

// THE AUTHORED LAYER, FROZEN - and the reason this script must not read its own output.
//
// The type vocabulary and the expansion clauses are both LEARNED FROM PROSE. Learning them from
// public/data/entity-hovers.json worked exactly once: after the first run that file no longer
// contains the prose, so the second run found no type phrasings (every label degraded from the
// corpus's own words, "title or public role", to the machine name "title role") and no expansion
// clauses (POTUS stopped saying "President of the United States" - 30 rows lost it). Both losses
// reached the committed tree before they were noticed.
//
// audit/entity-hovers-authored.json is that prose, frozen at the last commit before this script
// first ran. Reading it makes the normaliser idempotent, which is what lets it sit in the rebuild
// chain, and it is what recovers the 30 expansions and the 1,143 authored type phrasings.
const AUTHORED = path.join(ROOT, 'audit/entity-hovers-authored.json')
const authored = fs.existsSync(AUTHORED)
  ? JSON.parse(fs.readFileSync(AUTHORED, 'utf8')).global ?? {}
  : {}
const doc = JSON.parse(fs.readFileSync(HOVERS, 'utf8'))
const ents = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8'))
const rows = ents.entities ?? ents
const byId = new Map(rows.map(r => [r.id, r]))

const textOf = v => (typeof v === 'string' ? v : v?.synopsis) ?? ''

// ── the label vocabulary, voted from the synopses that already exist ────────
const TYPE_PHRASE = /categorized in this archive as an? ([^.]+)\./
const votes = new Map()
for (const [id, v] of Object.entries(Object.keys(authored).length ? authored : (doc.global ?? {}))) {
  const t = byId.get(id)?.type
  const m = TYPE_PHRASE.exec(textOf(v))
  if (!t || !m) continue
  if (!votes.has(t)) votes.set(t, new Map())
  const b = votes.get(t)
  b.set(m[1], (b.get(m[1]) ?? 0) + 1)
}
/** The corpus's own word for a type; falls back to the machine name made readable. */
const labelFor = t => {
  const b = votes.get(t)
  if (b?.size) return [...b.entries()].sort((x, y) => y[1] - x[1])[0][0]
  return String(t ?? 'named reference').replace(/_/g, ' ')
}
const article = w => (/^[aeiou]/i.test(w) ? 'an' : 'a')

// ── the expansion clause, carried across from the authored text ─────────────
// "Within this archive, “POTUS” is used for President of the United States and is categorized…"
// TWO SHAPES, because this script now reads its OWN output. The authored synopses said
// "...is used for X and is categorized..."; the sentence written here says "...in this archive,
// used for X.". Matching only the first meant a second run found no clause to carry and silently
// dropped the expansion from every row whose clause was authored rather than declared. It is in
// the rebuild chain, so a second run is the normal case, not an edge one.
const EXPANSION = /(?:is|,) used for ([^.]+?)(?: and is categorized|\.)/
const expansionFor = v => {
  const m = EXPANSION.exec(textOf(v))
  if (!m) return null
  return m[1].trim().replace(/\s+/g, ' ')
}

// -- the expansion an owner ruling declares, where there was none to carry ---
// An entity certified for the first time in this batch has no authored synopsis, so there is no
// clause to carry across and the sentence would say only what its type and counts are. Where the
// DROPS state the expansion, build-hover-expansions.mjs records it with the drop that states it,
// and it fills in here. An authored synopsis still wins - this never overwrites one.
const EXPANSION_FILE = path.join(ROOT, 'audit/entity-hover-expansions.json')
const declaredExpansions = fs.existsSync(EXPANSION_FILE)
  ? JSON.parse(fs.readFileSync(EXPANSION_FILE, 'utf8')).expansions ?? {}
  : {}

const n = x => Number(x ?? 0).toLocaleString()
const before = { ...(doc.global ?? {}) }
const global = {}
let withExpansion = 0, withDeclared = 0, sourceOnly = 0, created = 0, rewritten = 0

for (const e of rows) {
  const label = labelFor(e.type)
  // Order matters and the counters have to be honest about it. The AUTHORED clause wins; then an
  // owner-declared one; then whatever the last run wrote, which is only reached for a row that has
  // neither and is a no-op. Checking `before` before `declared` made every declared clause report
  // itself as "preserved" from the second run on, which is true of the text and useless as a count.
  const carried = expansionFor(authored[e.id])
  const declared = declaredExpansions[e.canonical]?.expansion ?? null
  const exp = carried ?? declared ?? expansionFor(before[e.id])
  if (carried) withExpansion++
  else if (declared) withDeclared++
  const head = `“${e.canonical}” is ${article(label)} ${label} in this archive${exp ? `, used for ${exp}` : ''}.`
  const posts = (e.posts ?? []).length
  let tail
  if ((e.mentions ?? 0) > 0) {
    tail = ` It appears ${n(e.mentions)} time${e.mentions === 1 ? '' : 's'} across ${n(posts)} post${posts === 1 ? '' : 's'}.`
  } else {
    // 134 rows are certified identities Q never wrote in prose — publishers and accounts he linked
    // to. Saying "appears 0 times" would read as a defect; saying what they ARE is the honest line.
    sourceOnly++
    const ls = (e.linkedSourcePosts ?? []).length
    tail = ` Q did not write this name in a drop; it is shown under Sources as something he linked to${ls ? `, across ${n(ls)} post${ls === 1 ? '' : 's'}` : ''}.`
  }
  global[e.id] = head + tail
  if (before[e.id]) rewritten++; else created++
}

if (check) {
  console.log(JSON.stringify({ entities: rows.length, rewritten, created, withExpansion, sourceOnly }, null, 1))
  const ids = Object.keys(global)
  for (const id of [ids[0], ids[1], ids.find(i => !(byId.get(i)?.mentions > 0))]) {
    if (id) console.log('\n  ' + global[id])
  }
  process.exit(0)
}

doc.global = global
doc.totals = { ...(doc.totals ?? {}), entitiesWithGlobal: Object.keys(global).length }
doc.globalWording = {
  ruledOn: '2026-08-24',
  ruling: 'Every entity carries a hover, and every hover reads the same way.',
  pattern: '“NAME” is a TYPE in this archive[, used for EXPANSION]. It appears N times across M posts.',
  sourceOnlyPattern: '“NAME” is a TYPE in this archive. Q did not write this name in a drop; it is shown under Sources as something he linked to.',
  built: 'From the certified record — canonical, type, mention and post counts. The type label is the corpus\'s own most-used phrasing for that type; the expansion clause is carried verbatim from the authored synopsis where one existed and is never invented.',
  byPost: 'Untouched. That layer says how ONE drop uses the label and is what makes the hover post-aware.',
}
fs.writeFileSync(HOVERS, JSON.stringify(doc, null, 1))

console.log('\nENTITY HOVERS — ONE SHAPE\n')
console.log(`  entities              : ${n(rows.length)}`)
console.log(`    rewritten           : ${n(rewritten)}`)
console.log(`    newly created       : ${n(created)}   (entities that had no hover at all)`)
console.log(`  expansion preserved   : ${n(withExpansion)}`)
console.log(`  expansion declared    : ${n(withDeclared)}   (owner rulings, for rows with no authored synopsis)`)
console.log(`  source-only wording   : ${n(sourceOnly)}`)
console.log(`  byPost records        : ${n(Object.keys(doc.byPost ?? {}).length)} entities, untouched`)
console.log('\nwrote public/data/entity-hovers.json\n')
