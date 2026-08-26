// THE OWNER'S RULING OF 2026-08-26: post #1515's reporter list, fully certified.
//
//   "in post 1515 all these are reporters you have a handfull listed as a claim and some aren't
//    even listed as an entity. lets fix this" — followed by the full "OUTLET – Name" list.
//
// #1515 is Q pasting a roll of 90+ WikiLeaks-named reporters, one "OUTLET – Name" pair per line.
// A prior 2026-08-24 owner-ruling batch ("unhighlighted-sentence queue") already certified most of
// them as two entities each (outlet + person) — that pass is why "ABC – Cecilia Vega" already
// shows ABC and Cecilia Vega both boxed. It missed exactly the 20 lines below: instead of getting
// entity treatment, the WHOLE "OUTLET – Name" string was certified as one Claim, which is wrong on
// its own terms — it asserts nothing, it is a list row, identical in shape to the 70+ rows already
// correctly treated as pure entity mentions with no claim at all.
//
// This ruling does two things, layered the same way every other owner ruling in this project is:
//   1. audit/entities-owner-rulings.json  — certifies the outlet (where not already a corpus-wide
//      entity — CBS and Bloomberg/MSNBC already are, so those two lines need no outlet ruling) and
//      the person, as new entities scoped to #1515.
//   2. audit/owner-section-moves.json     — withdraws the 20 miscertified Claim rows, same
//      `from: "claims", to: "entities"` shape #1850's retiring-members list used.
//
// "People" (the magazine) is scoped exactly as any other new entity here — a fresh canonical with
// one alias, one post. No corpus-wide collision risk: matching runs per-post against #1515's own
// text, which contains the word "people" (case-insensitive, word-boundary) exactly once, on this
// exact line. Checked before writing this ruling, not assumed.
//
//   node scripts/build-owner-rulings-2026-08-26-reporters.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entities-owner-rulings.json')
const dry = process.argv.includes('--dry')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const post = posts.find(p => p.postNum === 1515)
if (!post) { console.error('#1515 not found'); process.exit(1) }

const RULED_ON = '2026-08-26'
const REASONING_PERSON = who =>
  `Owner ruling: #1515's reporter roll — this "OUTLET – Name" line was certified as a single Claim ` +
  `rather than as the entity mention every other line on the same list correctly got. ${who} is the ` +
  `reporter named.`
const REASONING_OUTLET = (outlet, count) =>
  `Owner ruling: #1515's reporter roll. "${outlet}" names the outlet on ${count === 1 ? 'this line' : `${count} lines`}` +
  ` of the list and was never certified anywhere in the corpus, unlike CBS/Bloomberg/MSNBC on the same drop.`

// entity, in the order the roll table gives them — outlet BEFORE person on each line, matching
// how the correctly-handled 70+ rows order (e.g. "ABC", "Cecilia Vega").
const R = (canonical, type, aliasUsed, reasoning) => ({
  postNum: 1515, postId: '1515', canonical, aliasUsed, sourceText: aliasUsed, type,
  was: 'unclassified', ruledOn: RULED_ON, reasoning,
})

const NEW = [
  R('Buzzfeed', 'media_organization', 'Buzzfeed', REASONING_OUTLET('Buzzfeed', 2)),
  R('Ben Smith', 'person', 'Ben Smith', REASONING_PERSON('Ben Smith')),
  { ...R('Buzzfeed', 'media_organization', 'Buzzfeed', REASONING_OUTLET('Buzzfeed', 2)), additionalOccurrence: true },
  R('Ruby Cramer', 'person', 'Ruby Cramer', REASONING_PERSON('Ruby Cramer')),

  R('Gayle King', 'person', 'Gayle King', REASONING_PERSON('Gayle King') + ' CBS itself is already certified corpus-wide and already covers this line.'),

  R('AURN', 'media_organization', 'AURN', REASONING_OUTLET('AURN', 1)),
  R('April Ryan', 'person', 'April Ryan', REASONING_PERSON('April Ryan')),

  R('Jonathan Alter', 'person', 'Jonathan Alter', REASONING_PERSON('Jonathan Alter') + ' Bloomberg and MSNBC are already certified corpus-wide and already cover this line.'),

  R('GPG', 'media_organization', 'GPG', REASONING_OUTLET('GPG', 1)),
  R('Mike Feldman', 'person', 'Mike Feldman', REASONING_PERSON('Mike Feldman')),

  R('HuffPo', 'media_organization', 'HuffPo', REASONING_OUTLET('HuffPo', 4)),
  R('Amanda Terkel', 'person', 'Amanda Terkel', REASONING_PERSON('Amanda Terkel')),
  { ...R('HuffPo', 'media_organization', 'HuffPo', REASONING_OUTLET('HuffPo', 4)), additionalOccurrence: true },
  R('Arianna Huffington', 'person', 'Arianna Huffington', REASONING_PERSON('Arianna Huffington')),
  { ...R('HuffPo', 'media_organization', 'HuffPo', REASONING_OUTLET('HuffPo', 4)), additionalOccurrence: true },
  R('Sam Stein', 'person', 'Sam Stein', REASONING_PERSON('Sam Stein')),
  { ...R('HuffPo', 'media_organization', 'HuffPo', REASONING_OUTLET('HuffPo', 4)), additionalOccurrence: true },
  R('Whitney Snyder', 'person', 'Whitney Snyder', REASONING_PERSON('Whitney Snyder')),

  R('LAT', 'media_organization', 'LAT', REASONING_OUTLET('LAT', 2)),
  R('Evan Handler', 'person', 'Evan Handler', REASONING_PERSON('Evan Handler')),
  { ...R('LAT', 'media_organization', 'LAT', REASONING_OUTLET('LAT', 2)), additionalOccurrence: true },
  R('Mike Memoli', 'person', 'Mike Memoli', REASONING_PERSON('Mike Memoli')),

  R('McClatchy', 'media_organization', 'McClatchy', REASONING_OUTLET('McClatchy', 1)),
  R('Anita Kumar', 'person', 'Anita Kumar', REASONING_PERSON('Anita Kumar')),

  R('MORE', 'media_organization', 'MORE', REASONING_OUTLET('MORE', 1) + ' MORE magazine (Meredith Corp.) — Q wrote the masthead abbreviation, all caps.'),
  R('Betsy Fisher Martin', 'person', 'Betsy Fisher Martin', REASONING_PERSON('Betsy Fisher Martin')),

  R('National Journal', 'media_organization', 'National Journal', REASONING_OUTLET('National Journal', 1)),
  R('Emily Schultheis', 'person', 'Emily Schultheis', REASONING_PERSON('Emily Schultheis')),

  R('New Yorker', 'media_organization', 'New Yorker', REASONING_OUTLET('New Yorker', 2)),
  R('David Remnick', 'person', 'David Remnick', REASONING_PERSON('David Remnick')),
  { ...R('New Yorker', 'media_organization', 'New Yorker', REASONING_OUTLET('New Yorker', 2)), additionalOccurrence: true },
  // Q wrote "Ryan Liza" — the real journalist is Ryan Lizza, one Z; certified as literally written,
  // same rule as every other verbatim-only span in this archive.
  R('Ryan Liza', 'person', 'Ryan Liza', REASONING_PERSON('Ryan Liza') + ' Written by Q with one Z; the real journalist is usually spelled "Lizza" — certified as literally written, per this archive\'s verbatim-only rule.'),

  R('People', 'media_organization', 'People', REASONING_OUTLET('People', 1) + ' People magazine. Scoped to this one post/occurrence; the word "people" is common enough that this must never become a corpus-wide alias — checked, #1515\'s own text contains the word exactly once, on this line.'),
  R('Sandra Sobieraj Westfall', 'person', 'Sandra Sobieraj Westfall', REASONING_PERSON('Sandra Sobieraj Westfall')),

  // The outlet informally called "Tina Brown" and the person are the same string — one entity, not two.
  R('Tina Brown', 'person', 'Tina Brown', REASONING_PERSON('Tina Brown') + ' The masthead ("Tina Brown Live Media" era) and the byline are the same name here; one entity covers both, matching the source line\'s own "Tina Brown – Tina Brown".'),

  R('Univision', 'media_organization', 'Univision', REASONING_OUTLET('Univision', 1)),
  R('Maria-Elena Salinas', 'person', 'Maria-Elena Salinas', REASONING_PERSON('Maria-Elena Salinas')),
]

// ── validate every alias actually appears in #1515's text, the right number of times ──────────
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const clean = t => String(t || '').replace(MARKUP, '')
const text = clean(post.text)
const counts = new Map()
for (const r of NEW) counts.set(r.aliasUsed, (counts.get(r.aliasUsed) ?? 0) + 1)

const problems = []
for (const [alias, wanted] of counts) {
  const rx = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
  const found = [...text.matchAll(rx)].length
  if (found < wanted) problems.push(`"${alias}": ruling wants ${wanted} occurrence(s), text has ${found}`)
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))
doc.rulings ??= []
// Count-based idempotency, NOT set-membership: "HuffPo" needs FOUR ruling rows on this post (one
// creates the entity, three are additionalOccurrence — otherwise identical shape). A Set keyed by
// shape would collapse those three into one and silently drop two real occurrences.
const existingCountByCanonical = new Map()
for (const r of doc.rulings) {
  if (r.postNum !== 1515) continue
  existingCountByCanonical.set(r.canonical, (existingCountByCanonical.get(r.canonical) ?? 0) + 1)
}
const seenThisRunByCanonical = new Map()

console.log(`\nOWNER ENTITY RULING — 2026-08-26, post #1515 reporter roll\n`)
let added = 0, skipped = 0
for (const r of NEW) {
  const already = existingCountByCanonical.get(r.canonical) ?? 0
  const seen = seenThisRunByCanonical.get(r.canonical) ?? 0
  seenThisRunByCanonical.set(r.canonical, seen + 1)
  if (seen < already) { skipped++; continue }   // this instance was already applied in a prior run
  console.log(`  ${r.canonical.padEnd(28)} (${r.type})${r.additionalOccurrence ? '  [additional occurrence]' : ''}`)
  doc.rulings.push(r)
  added++
}
console.log(`\n  ${added} new, ${skipped} already recorded\n`)

if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added) { console.log('  nothing to write\n'); process.exit(0) }
fs.writeFileSync(RULINGS_FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, RULINGS_FILE)}\n`)
