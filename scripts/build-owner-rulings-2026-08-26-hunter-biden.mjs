// THE OWNER'S RULING OF 2026-08-26: "Hunter" is Hunter Biden — tie the aliases together.
//
//   "just a heads up Hunter is the alias for Hunter Biden or H. Biden so lets tie them together
//    and also make it known in the hover over synopsis"
//
// Three defects found while acting on this:
//   1. "Hunter" (6 mentions: #3625, #4821, #4822, #4881, #4890, #4959 — Burisma, Ukraine, bribes,
//      'Pop') and "Hunter Biden" (a separate adjudicated-tail row, ENT-0136/ENT-0170 in the
//      2026-08-16 hover audit — both verdicts "Keep - valid named entity") are the SAME person
//      carried as two canonical rows. This is exactly the duplicate-identity pattern doc.merges
//      exists to fix (Patriot -> Patriots, Wray -> Christopher Wray, etc.) — not a rename, a merge
//      of two rows that already both exist.
//   2. "H. Biden" — Q's OTHER spelling for the same person, on #4888, #4891 (x3), #4893, #4898 —
//      was never registered as an occurrence at all. The literal substring "Biden" inside it
//      matched the certified Joe Biden entity instead, so those six occurrences painted the WRONG
//      Biden. Checked all four drops line by line: every "Biden" occurrence on each is part of "H.
//      Biden" — none independently name Joe Biden — so the withdrawal is total for these posts,
//      not partial.
//   3. No synopsis existed for the merged identity.
//
//   node scripts/build-owner-rulings-2026-08-26-hunter-biden.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entities-owner-rulings.json')
const SYNOPSIS_FILE = path.join(ROOT, 'audit/entity-synopsis-owner-rulings.json')
const dry = process.argv.includes('--dry')

const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const RULED_ON = '2026-08-26'

// ── validate the H. Biden occurrences before writing anything ─────────────────────────────────
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const clean = t => String(t || '').replace(MARKUP, '')
const HBIDEN_POSTS = { 4888: 1, 4891: 3, 4893: 1, 4898: 1 }
const problems = []
for (const [pn, wanted] of Object.entries(HBIDEN_POSTS)) {
  const p = byNum.get(Number(pn))
  if (!p) { problems.push(`#${pn} not found`); continue }
  const text = clean(p.text)
  const found = [...text.matchAll(/H\.\s*Biden/gi)].length
  if (found !== wanted) problems.push(`#${pn}: expected ${wanted} "H. Biden" occurrence(s), text has ${found}`)
  // Every CERTIFIED "Biden" occurrence on the post must be part of "H. Biden" — confirms the
  // withdrawal is safe to be total rather than partial. Checked against postAnalysis.namedEntities
  // (the certified mentions), not a raw text scan — a raw scan also catches "Biden" inside the
  // lowercase "hunter-biden" URL slugs on these posts, which were correctly excluded from
  // certification already (2026-08-17 cleanup: a CMS/URL slug is not Q naming a thing) and were
  // never a real mention to begin with.
  const certifiedBiden = (p.postAnalysis?.namedEntities ?? []).filter(n => n === 'Biden').length
  if (certifiedBiden !== found) problems.push(`#${pn}: ${certifiedBiden} certified "Biden" occurrence(s) but ${found} "H. Biden" text matches — counts should agree`)
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))

// ── 1. merge the two rows: "Hunter" -> "Hunter Biden" ──────────────────────────────────────────
// mergeRulings (canonical/absorb), NOT the merges[] (from/into) mechanism — merges[] moves mentions
// per-ALIAS ("n" on each alias of the absorbed row) and falls back to 0 per alias when the absorbed
// row carries more than one, which "Hunter" does (aliases "Hunter" and "HUNTER", both n:null since
// neither was ever corpus-recounted) — the 6 mentions would silently vanish rather than move.
// mergeRulings moves the row's mentions/posts/aliases directly and unambiguously: exactly what a
// full-identity merge of two rows that both already exist needs.
doc.mergeRulings ??= []
let mergeAdded = 0
if (!doc.mergeRulings.some(r => r.canonical === 'Hunter Biden' && r.absorb === 'Hunter')) {
  doc.mergeRulings.push({
    canonical: 'Hunter Biden', absorb: 'Hunter', ruledOn: RULED_ON,
    reasoning: 'Owner ruling: "Hunter is the alias for Hunter Biden or H. Biden so lets tie them together." Two canonical rows for one identity: "Hunter" (6 mentions, #3625/#4821/#4822/#4881/#4890/#4959 — Burisma, Ukraine, bribes, \'Pop\') and "Hunter Biden" (a separate adjudicated-tail row — ENT-0136/ENT-0170 in the 2026-08-16 hover audit, both "Keep"). "Hunter Biden" is the more identifying spelling, so it is the canonical; "Hunter"/"HUNTER" carry forward as aliases of the survivor.',
  })
  mergeAdded++
}
// The ENT-#### hover-audit crosswalk resolves survivors ONLY from doc.merges (from/into), never
// from mergeRulings — it is keyed by canonical alone and does not care whether the "from" row still
// exists in `entities` by the time it runs. Registers the old->new bridge without re-merging the
// row a second time: entities.find(e => e.canonical === 'Hunter') finds nothing once mergeRulings
// above has already spliced it out, so the merges[] loop's own row-consolidation code just no-ops.
doc.merges ??= []
if (!doc.merges.some(m => m.from === 'Hunter' && m.into === 'Hunter Biden')) {
  doc.merges.push({
    from: 'Hunter', into: 'Hunter Biden', ruledOn: RULED_ON,
    reasoning: 'Crosswalk bridge for the mergeRulings entry above (see doc.mergeRulings) — the row consolidation itself happens there. The 2026-08-16 hover audit\'s ENT-0170 refers to this identity as "Hunter"; the ENT-#### resolver needs the old->new name to find it after the merge.',
  })
}

// ── 1b. withdraw a pre-existing false-positive "Hunter Biden" tail occurrence on #4888 and #4893.
// Both posts already carried a certified "Hunter Biden" mention BEFORE this ruling — but checking
// the actual body text, neither drop writes "Hunter Biden" anywhere; the only place that spelling
// appears is inside the source-link URL slug ("nypost.com/.../hunter-biden-reportedly...",
// "politico.com/.../hunter-biden-business-partner..."). That is the same "a CMS/URL slug is not Q
// naming a thing" defect the 2026-08-17 cleanup targeted — this pair of tail occurrences predates
// that cleanup and was missed. Withdrawn the same way Cuomo's/Nadler's duplicate spans were
// (post-scoped aliasWithdrawal), so the new "H. Biden" occurrence below is what actually paints.
doc.aliasWithdrawals ??= []
let urlSlugWithdrawalsAdded = 0
if (!doc.aliasWithdrawals.some(w => w.canonical === 'Hunter Biden' && w.alias === 'Hunter Biden' && JSON.stringify(w.onlyPosts) === JSON.stringify([4888, 4893]))) {
  doc.aliasWithdrawals.push({
    canonical: 'Hunter Biden', alias: 'Hunter Biden',
    onlyPosts: [4888, 4893],
    ruledOn: RULED_ON,
    reasoning: 'Neither #4888 nor #4893 writes "Hunter Biden" in the drop text — both only say "H. Biden". The certified "Hunter Biden" mention on each came from the source-link URL slug ("hunter-biden-reportedly...", "hunter-biden-business-partner..."), the same class of defect the 2026-08-17 CMS/URL-slug cleanup targeted; this pair predates that pass. Withdrawn so the real "H. Biden" occurrence (see rulings below) is what paints instead of a URL artifact.',
  })
  urlSlugWithdrawalsAdded++
}

// ── 2. withdraw the wrong "Biden" -> Joe Biden match on the 4 "H. Biden" drops ────────────────
doc.aliasWithdrawals ??= []
let withdrawalsAdded = 0
if (!doc.aliasWithdrawals.some(w => w.canonical === 'Joe Biden' && w.alias === 'Biden' && JSON.stringify(w.onlyPosts) === JSON.stringify(Object.keys(HBIDEN_POSTS).map(Number)))) {
  doc.aliasWithdrawals.push({
    canonical: 'Joe Biden', alias: 'Biden',
    onlyPosts: Object.keys(HBIDEN_POSTS).map(Number),
    ruledOn: RULED_ON,
    reasoning: 'Every "Biden" occurrence on #4888, #4891, #4893 and #4898 is part of "H. Biden" (Hunter Biden\'s laptop, financial records, the Southern District of New York case) — none independently name Joe Biden. Checked line by line before withdrawing. The bare "Biden" alias\'s occurrences on every OTHER post are untouched.',
  })
  withdrawalsAdded++
}

// ── 3. register "H. Biden" as an alias of Hunter Biden, corpus-wide ────────────────────────────
// Not a set of per-post occurrence rulings — an ALIAS ruling. "H. Biden" is a spelling the
// detector never had at all (like C19 for COVID-19, or NAT SEC's four spellings): the entity
// rulings mechanism only bumps a mention/post count on an EXISTING canonical, it never registers
// a new matchable alias, so per-post rulings here would count right and render nothing — "H.
// Biden" would still not paint on the post text. aliasRulings does both: scans every post for the
// exact spelling and registers it as a real alias of the entity, so the six occurrences (#4888,
// #4891 x3, #4893, #4898 — verified corpus-wide, no others exist) both count and paint.
doc.aliasRulings ??= []
let aliasRulingAdded = 0
if (!doc.aliasRulings.some(r => r.canonical === 'Hunter Biden' && r.alias === 'H. Biden')) {
  doc.aliasRulings.push({
    canonical: 'Hunter Biden', alias: 'H. Biden', ruledOn: RULED_ON,
    reasoning: 'Owner ruling: "H. Biden" is Hunter Biden, not Joe Biden. The bare "Biden" inside it was matching the certified Joe Biden entity instead (withdrawn above, scoped to these same posts). Six occurrences corpus-wide: #4888, #4891 (x3), #4893, #4898 — verified against the full corpus, no others exist.',
  })
  aliasRulingAdded++
}

console.log(`\nOWNER RULING — 2026-08-26, Hunter Biden\n`)
console.log(`  merge (Hunter -> Hunter Biden) : ${mergeAdded} added`)
console.log(`  URL-slug withdrawal (#4888/#4893) : ${urlSlugWithdrawalsAdded} added`)
console.log(`  alias withdrawal (Joe Biden)   : ${withdrawalsAdded} added`)
console.log(`  alias ruling (H. Biden)        : ${aliasRulingAdded} added`)

// ── 4. the synopsis — naming both alternate spellings, as asked ───────────────────────────────
// entityId is "Hunter Biden"'s OWN id (qe-eaac939b4aaa) — the merge survivor keeps its own id;
// "Hunter"'s id (qe-efc49f61600b) is retired with that row.
const synDoc = JSON.parse(fs.readFileSync(SYNOPSIS_FILE, 'utf8'))
synDoc.synopses ??= []
let synAdded = 0
const HUNTER_BIDEN_ID = 'qe-eaac939b4aaa'
if (!synDoc.synopses.some(s => s.entityId === HUNTER_BIDEN_ID)) {
  synDoc.synopses.push({
    entityId: HUNTER_BIDEN_ID,
    canonical: 'Hunter Biden',
    ruledOn: RULED_ON,
    provenance: 'Owner ruling: "Hunter is the alias for Hunter Biden or H. Biden so lets tie them together and also make it known in the hover over synopsis."',
    synopsis: 'Hunter Biden is an American lawyer and businessman, the son of Joe Biden, who served on the board of the Ukrainian energy company Burisma Holdings and whose business dealings and a personal laptop became the subject of extensive public scrutiny and a federal investigation, resulting in gun and tax convictions in 2024 (later pardoned by his father). In the drops, Q refers to him as "Hunter" or "H. Biden."',
  })
  synAdded++
}
console.log(`  synopsis                        : ${synAdded} added`)

if (dry) {
  console.log('\n  --dry: nothing written\n')
  process.exit(0)
}
if (mergeAdded || urlSlugWithdrawalsAdded || withdrawalsAdded || aliasRulingAdded) fs.writeFileSync(RULINGS_FILE, JSON.stringify(doc, null, 1) + '\n')
if (synAdded) fs.writeFileSync(SYNOPSIS_FILE, JSON.stringify(synDoc, null, 1) + '\n')
console.log(`\n  wrote ${path.relative(ROOT, RULINGS_FILE)}${synAdded ? ` and ${path.relative(ROOT, SYNOPSIS_FILE)}` : ''}\n`)
