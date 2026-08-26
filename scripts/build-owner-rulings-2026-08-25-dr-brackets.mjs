// THE OWNER'S RULING OF 2026-08-25, PART 3: the bracket "[D]"/"[R]" forms, reviewed one
// occurrence at a time — the follow-up to the possessive "D's"/"R's" ruling, which deliberately
// held these back because a corpus census found real collisions (D-Day, delta markers, code
// names) mixed in with genuine party references.
//
// SIX REVIEWERS read all 120 posts carrying a real "[D]"/"[R]" bracket token (mid-word artifacts
// like "whe[R]e" and "[D]ec 5" were excluded before review even started — they are not tokens).
// Each of the 227 occurrences got an individual verdict: PARTY, NOT_PARTY, or UNCLEAR. Only PARTY
// verdicts are applied here.
//
// EXCLUDED, NOT BECAUSE THEY FAILED REVIEW BUT BECAUSE THE PATTERN THE OWNER WARNED ABOUT IS REAL:
//   #2629  "[D] Day, Patriots"                     — D-Day
//   #1277  "[R] = Renegade"                        — a person's code name, defined in-text
//   #1279  "[R]." beside "[EG]." (Evergreen)        — same code-name pattern
//   #311, #312  "[R]" answering "USSS codename for Hussein?" — the same Renegade thread
//   #286   "[R]_(            )[+ 4]"                — a stringer/notation, not prose
//   #299   "[R] - No." in a cabal-control post        — no party context anywhere in the post
//   #3604, #3654  "[D][1-6]" / "[D6]" etc.           — sequential delta markers, the exact
//          shape of the owner's own "D5 is a prediction not a democrat" caution
//   #3570  "[C] before [D]." / "[C]oats before [D]eclas" — a letter-initial code for a person
//          and an action (Coats, Declassification), not the party
//   #4105  "[D] coord & dev of [AI] tool" following "DARPA | FB | TWITTER | GOOG" — [D] reads as
//          shorthand for DARPA (first letter of the list above it), not Democrat
// HELD FOR A FUTURE OCCURRENCE-SCOPED RULING, not applied here:
//   #623   a standalone "[D]" with no party language and no identifiable alternative either
//   #2369  a "[D]" tag structurally parallel to a "[RR]" (Rod Rosenstein) reference-tag slot
//   #3772  "[D] _unchanged?" in a ballot-problem list that uses PARENTHESES for its genuine
//          Republican reference two lines earlier — the switch to brackets here is unexplained
//   #4325  its SECOND "[D]" occurrence only ("[D]&[F]" — plausibly Domestic & Foreign assets,
//          not Democrat & something); the post's FIRST "[D]s" occurrence passed review and IS
//          applied below. Excluding the whole post from includePosts scoping and applying the
//          one certified occurrence by exact line/char instead — see the includeOccurrences entry.
//   #4354  "[D][F] 'support' targets" — same Domestic/Foreign-vs-Democrat ambiguity as #4325
//
//   node scripts/build-owner-rulings-2026-08-25-dr-brackets.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'audit/entities-owner-rulings.json')
const dry = process.argv.includes('--dry')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byNum = new Map(posts.map(p => [p.postNum, p]))
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const runtime = t => String(t || '').replace(MARKUP, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')

// The six reviewers' PARTY verdicts, consolidated. #4325 IS included here (it has one certified
// "[D]" occurrence) but is ALSO given an includeOccurrences entry below, which overrides it to
// occurrence-level scoping — the post-level entry alone would sweep in its second, uncertain
// "[D]&[F]" pairing too.
const D_POSTS = [2398, 2635, 2673, 2770, 2868, 2943, 2971, 2981, 3006, 3016, 3028, 3049, 3071, 3175, 3176, 3220, 3243, 3304, 3386, 3607, 3613, 3634, 3656, 3712, 3721, 3749, 3768, 3770, 3774, 3778, 3819, 3858, 3869, 3896, 3897, 3905, 3909, 3911, 4014, 4045, 4076, 4088, 4090, 4097, 4136, 4152, 4156, 4164, 4173, 4181, 4219, 4239, 4245, 4282, 4293, 4307, 4317, 4325, 4337, 4352, 4373, 4379, 4380, 4381, 4382, 4409, 4415, 4443, 4447, 4451, 4458, 4471, 4473, 4476, 4489, 4492, 4522, 4524, 4535, 4536, 4537, 4539, 4552, 4553, 4554, 4555, 4556, 4584, 4592, 4620, 4627, 4635, 4644, 4680, 4688, 4699, 4750, 4766, 4802, 4805, 4806, 4842, 4940]
const R_POSTS = [3968, 4293, 4317, 4489, 4603, 4620, 4688]

// #4325's one certified occurrence — its first "[D]s" ("[D]s in coordination w/ [D]&[F] assets
// have launched...an insurgency attack...to regain power"), matching the "regain power" phrasing
// used for the party elsewhere in the corpus. The SECOND, paired as "[D]&[F]", plausibly reads as
// Domestic & Foreign assets — an intel classification, not the party — and is held rather than
// guessed. includeOccurrences overrides #4325 from post-level to occurrence-level matching, so
// only this exact line/char counts (Resolution Center row-id coordinates: [lineIndex, charIndex]).
function firstDBracketPosition(postNum) {
  // Uses the SAME clean()/line-split the materialiser matches against (apply-entities.mjs
  // builds its regex against `clean(p.text ?? '').split('\n')`) — a first attempt used this
  // file's own `runtime()` stripping and found 0 of 1, because clean() does not produce
  // identical text to a hand-rolled markup strip.
  const lines = clean(byNum.get(postNum).text ?? '').split('\n')
  for (let li = 0; li < lines.length; li++) {
    const idx = lines[li].indexOf('[D]')
    if (idx !== -1) return [li, idx]
  }
  return null
}

const RULED_ON = '2026-08-25'
const RULINGS = [
  {
    alias: '[D]', canonical: 'Democratic Party', type: 'political_group',
    includePosts: D_POSTS,
    includeOccurrences: { 4325: [firstDBracketPosition(4325)] },
    ruledOn: RULED_ON,
    reasoning: 'Owner ruling, third pass: the bracket "[D]" form of the D\'s/R\'s ruling, applied only where a per-occurrence review confirmed it means the party. Six reviewers read all 120 posts carrying a real "[D]"/"[R]" token and judged each occurrence PARTY / NOT_PARTY / UNCLEAR; this list is every post whose "[D]" occurrence(s) were judged PARTY. Traps excluded by name in the script header (D-Day, Renegade, delta markers, DARPA, a Coats/Declas letter-code); genuinely ambiguous cases held for later, not guessed. #4325 is occurrence-scoped to its one certified "[D]" — see includeOccurrences and the header note.',
    retrieval: 'dr-bracket-review sweep, 2026-08-25: 6 agents, 120 posts, 227 bracket occurrences read individually against the post\'s full text.',
    renderNote: 'RENDERING_PROVENANCE_RULE: the renderer highlights the token, the bracketed form Q wrote.',
  },
  {
    alias: '[R]', canonical: 'Republican Party', type: 'political_group',
    includePosts: R_POSTS, ruledOn: RULED_ON,
    reasoning: 'Owner ruling, third pass, the Republican half of the bracket form. Same review as "[D]" above — 7 posts where "[R]" was individually confirmed to mean the party, after excluding the Renegade-codename collisions (#1277, #1279, #286, #299, #311, #312) the same census found.',
    retrieval: 'dr-bracket-review sweep, 2026-08-25: 6 agents, 120 posts, 227 bracket occurrences read individually against the post\'s full text.',
    renderNote: 'RENDERING_PROVENANCE_RULE: the renderer highlights the token, the bracketed form Q wrote.',
  },
]

const problems = []
for (const r of RULINGS) {
  const live = entities.find(e => e.canonical === r.canonical)
  if (!live) { problems.push(`unknown canonical ${JSON.stringify(r.canonical)}`); continue }
  if (live.type !== r.type) problems.push(`${JSON.stringify(r.canonical)} is typed ${live.type}, ruling says ${r.type}`)
  if (live.aliases.some(a => a.text === r.alias)) problems.push(`${JSON.stringify(r.canonical)} already has alias ${JSON.stringify(r.alias)} — this ruling assumes a fresh alias, not a recount`)
  for (const pn of r.includePosts) {
    const p = byNum.get(pn)
    if (!p) { problems.push(`#${pn} is not a drop`); continue }
    if (!runtime(p.text).includes(r.alias)) problems.push(`#${pn} does not contain ${JSON.stringify(r.alias)}`)
  }
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

console.log('\nOWNER ALIAS RULING — 2026-08-25, bracket "[D]"/"[R]" party forms\n')
for (const r of RULINGS) console.log(`  ${JSON.stringify(r.alias).padEnd(6)} -> ${r.canonical.padEnd(20)} ${r.includePosts.length} posts`)

const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const have = new Set((doc.aliasRulings ?? []).map(r => `${r.canonical}|${r.alias}|${JSON.stringify(r.includePosts)}`))
const added = RULINGS.filter(r => !have.has(`${r.canonical}|${r.alias}|${JSON.stringify(r.includePosts)}`))
console.log(`\n  ${added.length} new, ${RULINGS.length - added.length} already recorded\n`)
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added.length) { console.log('  nothing to write\n'); process.exit(0) }

doc.aliasRulings = [...(doc.aliasRulings ?? []), ...added]
fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, FILE)}\n`)
