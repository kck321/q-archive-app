// ADDENDUM to the 2026-08-26 #1515 reporter-roll ruling: four lines the first pass missed
// entirely (not miscategorised as a Claim — simply never certified as anything at all).
//
//   "these were not made an entity on 1515:
//    Vice – Alyssa Mastramonoco / Vox – Jon Allen / WaPo – Anne Gearan / WaPo – Greg Sargent"
//
// Two of the four outlets already exist as canonicals — reused rather than duplicated:
//   Vice  (qe-6b91c2e9c140) — a source-only identity (Q linked to vice.com on #1560/#2801 but
//          never named "Vice" in his own text); this ruling gives it its first real text mention.
//   Vox   (qe-b3334eb51117) — same shape, source-only from #1797/#2801.
//   WaPo  is NOT its own canonical — "Washington Post" (qe-48200abcb9fa) already carries the
//         alias "WASH POST" from an earlier ruling, but never "WaPo". Both WaPo lines here name
//         the SAME existing Washington Post identity, not a new one.
// The four people (Alyssa Mastramonoco, Jon Allen, Anne Gearan, Greg Sargent) are new canonicals,
// same as the rest of the 2026-08-26 batch.
//
//   node scripts/build-owner-rulings-2026-08-26-reporters-addendum.mjs [--dry]
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
const R = (canonical, type, aliasUsed, reasoning, extra = {}) => ({
  postNum: 1515, postId: '1515', canonical, aliasUsed, sourceText: aliasUsed, type,
  was: 'unclassified', ruledOn: RULED_ON, reasoning, ...extra,
})

const NEW = [
  R('Vice', 'media_organization', 'Vice',
    'Owner ruling: #1515\'s reporter roll, missed entirely by the first pass. Vice was already a certified source-only identity (Q linked to vice.com on #1560/#2801 without naming it in text) — this is its first real text mention.'),
  R('Alyssa Mastramonoco', 'person', 'Alyssa Mastramonoco',
    'Owner ruling: #1515\'s reporter roll — the reporter named on the Vice line.'),

  R('Vox', 'media_organization', 'Vox',
    'Owner ruling: #1515\'s reporter roll, missed entirely by the first pass. Vox was already a certified source-only identity (Q linked to vox.com on #1797/#2801 without naming it in text) — this is its first real text mention.'),
  R('Jon Allen', 'person', 'Jon Allen',
    'Owner ruling: #1515\'s reporter roll — the reporter named on the Vox line.'),

  R('Washington Post', 'media_organization', 'WaPo',
    'Owner ruling: #1515\'s reporter roll, missed entirely by the first pass. "WaPo" is Q\'s abbreviation for the already-certified Washington Post identity (which so far only carried the "WASH POST" alias) — this registers the new spelling and its first occurrence on this drop.'),
  R('Anne Gearan', 'person', 'Anne Gearan',
    'Owner ruling: #1515\'s reporter roll — the reporter named on the first WaPo line.'),

  { ...R('Washington Post', 'media_organization', 'WaPo',
      'Owner ruling: #1515\'s reporter roll — the second WaPo line on this same drop.'),
    additionalOccurrence: true },
  R('Greg Sargent', 'person', 'Greg Sargent',
    'Owner ruling: #1515\'s reporter roll — the reporter named on the second WaPo line.'),
]

// ── validate every alias actually appears in #1515's text, the right number of times ──────────
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const clean = t => String(t || '').replace(MARKUP, '')
const text = clean(post.text)
const counts = new Map()
for (const r of NEW) counts.set(r.aliasUsed, (counts.get(r.aliasUsed) ?? 0) + 1)

const problems = []
for (const [alias, wanted] of counts) {
  const rx = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
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
const existingCountByCanonical = new Map()
for (const r of doc.rulings) {
  if (r.postNum !== 1515) continue
  existingCountByCanonical.set(r.canonical, (existingCountByCanonical.get(r.canonical) ?? 0) + 1)
}
const seenThisRunByCanonical = new Map()

console.log(`\nOWNER ENTITY RULING ADDENDUM — 2026-08-26, post #1515 reporter roll (4 missed lines)\n`)
let added = 0, skipped = 0
for (const r of NEW) {
  const already = existingCountByCanonical.get(r.canonical) ?? 0
  const seen = seenThisRunByCanonical.get(r.canonical) ?? 0
  seenThisRunByCanonical.set(r.canonical, seen + 1)
  if (seen < already) { skipped++; continue }
  console.log(`  ${r.canonical.padEnd(28)} (${r.type})${r.additionalOccurrence ? '  [additional occurrence]' : ''}`)
  doc.rulings.push(r)
  added++
}
console.log(`\n  ${added} new, ${skipped} already recorded\n`)

if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added) { console.log('  nothing to write\n'); process.exit(0) }
fs.writeFileSync(RULINGS_FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, RULINGS_FILE)}\n`)
