// THE OWNER'S RULING OF 2026-08-25: "D's" and "R's" are Democratic Party / Republican Party,
// wherever they mean the parties — NOT wherever the bare letters D/R appear.
//
//   "can we also classiffy any D's or R's as entitites if it pertains to democrats and
//    republicans"
//   "D5 is a prediction not a democrat so make sure we are only classifying the d's and r's
//    that pertain to democrats/republicans"
//
// THE SCOPE IS THE POSSESSIVE FORM ONLY, and that is not a narrowing for convenience — it is the
// one shape a full-corpus census found to be unambiguous. A search for the bare bracket forms
// "[D]" and "[R]" turned up real collisions with the owner's own example: #2629's "[D] Day,
// Patriots" is D-Day, #1277's "[R] = Renegade" defines R as a person's code name, and #3604/#3654
// carry "[D][1-6]" / "[D6]" — sequential delta markers, the same shape as "D5". The possessive
// "D's" / "R's" carries none of that: every one of the 82 occurrences across 52 (D) + 9 (R) posts
// reads as Democrat(s)/Republican(s) on inspection, with zero exceptions found. The bracket forms
// are held for a separate, post-by-post review — see the theme-sweep-style pass this ruling does
// NOT cover.
//
//   node scripts/build-owner-rulings-2026-08-25-dr-party.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'audit/entities-owner-rulings.json')
const dry = process.argv.includes('--dry')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const runtime = t => String(t || '').replace(MARKUP, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')

// Reproduce the census: every post containing the possessive form, split by which letter.
const POSSESSIVE = /\b([DR])'s\b/g
const byLetter = { D: new Set(), R: new Set() }
for (const p of posts) {
  const t = runtime(p.text)
  let m
  POSSESSIVE.lastIndex = 0
  while ((m = POSSESSIVE.exec(t))) byLetter[m[1]].add(p.postNum)
}

const RULED_ON = '2026-08-25'
const RULINGS = [
  {
    alias: "D's", canonical: 'Democratic Party', type: 'political_group',
    includePosts: [...byLetter.D].sort((a, b) => a - b),
    ruledOn: RULED_ON,
    reasoning: 'Owner ruling: "can we also classiffy any D\'s or R\'s as entitites if it pertains to democrats and republicans" (with the follow-up: "D5 is a prediction not a democrat so make sure we are only classifying the d\'s and r\'s that pertain to democrats/republicans"). Census-verified: every possessive "D\'s" occurrence in the corpus reads as Democrat(s) — "D\'s SCREAM when POTUS meets w/ PUTIN?", "Red-State D\'s who voted \'no\'", "R\'s v D\'s" — with none of the bracket form\'s collisions (D-Day, delta markers). Scoped by includePosts to the exact 52 drops the census found, so a future retyping of the token elsewhere is not silently claimed.',
    retrieval: 'Corpus regex census, 2026-08-25: /\\b([DR])\'s\\b/ against every post\'s runtime text, all matches read individually before this ruling was written.',
    renderNote: 'RENDERING_PROVENANCE_RULE: the renderer highlights the token, the form Q wrote.',
  },
  {
    alias: "R's", canonical: 'Republican Party', type: 'political_group',
    includePosts: [...byLetter.R].sort((a, b) => a - b),
    ruledOn: RULED_ON,
    reasoning: 'Owner ruling, same as the "D\'s" entry above, for the Republican half of it. Census-verified: every possessive "R\'s" occurrence reads as Republican(s) — "R\'s v D\'s", "R\'s targeted (censorship/anti R = more $)", "R\'s easier to remove than D\'s?" — 9 posts, no exceptions found.',
    retrieval: 'Corpus regex census, 2026-08-25: /\\b([DR])\'s\\b/ against every post\'s runtime text, all matches read individually before this ruling was written.',
    renderNote: 'RENDERING_PROVENANCE_RULE: the renderer highlights the token, the form Q wrote.',
  },
]

const problems = []
for (const r of RULINGS) {
  const live = entities.find(e => e.canonical === r.canonical)
  if (!live) { problems.push(`unknown canonical ${JSON.stringify(r.canonical)}`); continue }
  if (live.type !== r.type) problems.push(`${JSON.stringify(r.canonical)} is typed ${live.type}, ruling says ${r.type}`)
  if (live.aliases.some(a => a.text === r.alias)) problems.push(`${JSON.stringify(r.canonical)} already has alias ${JSON.stringify(r.alias)} — this ruling assumes a fresh alias, not a recount`)
  if (!r.includePosts.length) problems.push(`${JSON.stringify(r.alias)} — census found zero posts, refusing an empty ruling`)
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

console.log('\nOWNER ALIAS RULING — 2026-08-25, D\'s / R\'s as party entities\n')
for (const r of RULINGS) console.log(`  ${JSON.stringify(r.alias).padEnd(8)} -> ${r.canonical.padEnd(20)} ${r.includePosts.length} posts`)

const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const have = new Set((doc.aliasRulings ?? []).map(r => `${r.canonical}|${r.alias}`))
const added = RULINGS.filter(r => !have.has(`${r.canonical}|${r.alias}`))
console.log(`\n  ${added.length} new, ${RULINGS.length - added.length} already recorded\n`)
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added.length) { console.log('  nothing to write\n'); process.exit(0) }

doc.aliasRulings = [...(doc.aliasRulings ?? []), ...added]
fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, FILE)}\n`)
