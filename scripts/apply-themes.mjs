// Apply the certified Themes dataset.
//
// Themes are a multi-label layer over posts, written to public/data/themes.json so the app
// reads the certified assignments rather than re-deriving them from text.
//
// WHAT IS DELIBERATELY NOT HERE: the old extractor's style labels. "cryptic messaging" (401
// occurrences, its single most common label), "pattern recognition", "insider knowledge",
// "hidden truth", "coordinated messaging", "future revelation", "operational security" and
// "collective action" describe HOW Q writes, not what a post is about. The coverage audit found
// they make up the whole of the so-called ontology gap, and they belong to Codes & Brackets or
// Emphasis. Importing them would put writing technique in a subject taxonomy.
//
//   node scripts/apply-themes.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { THEMES, THEME_BY_KEY } from './lib/themes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/themes-audit.json'), 'utf8'))

// Style labels that must never become subjects, whatever the old data says.
const STYLE_LABELS = /\b(cryptic|pattern recognition|insider knowledge|hidden (truth|knowledge)|coordinated messaging|future revelation|operational security|collective action|coded messag)\b/i

const byPost = new Map()
for (const a of audit.assignments) {
  if (!byPost.has(a.postNum)) byPost.set(a.postNum, [])
  byPost.get(a.postNum).push({ theme: a.theme, label: a.label, confidence: a.confidence, evidence: a.evidence })
}

const themeTable = THEMES.filter(t => t.anchors.length || t.support.length).map(t => ({
  key: t.key, label: t.label, blurb: t.blurb, subthemes: t.subthemes,
  posts: audit.assignments.filter(a => a.theme === t.key).map(a => a.postNum).sort((x, y) => x - y),
}))

const out = {
  certified: true,
  parents: themeTable.length,
  totals: {
    assignments: audit.assignments.length,
    postsWithAtLeastOne: byPost.size,
    postsWithMoreThanOne: [...byPost.values()].filter(v => v.length > 1).length,
    unresolvedInResolutionCenter: audit.ambiguous.length,
    byTheme: Object.fromEntries(themeTable.map(t => [t.key, t.posts.length])),
    byConfidence: audit.assignments.reduce((a, x) => { a[x.confidence] = (a[x.confidence] ?? 0) + 1; return a }, {}),
  },
  themes: themeTable,
  byPost: Object.fromEntries([...byPost]),
}

// ── QA gate ─────────────────────────────────────────────────────────────────
const styleLeak = audit.assignments.filter(a => STYLE_LABELS.test(a.label))
const unknownTheme = audit.assignments.filter(a => !THEME_BY_KEY.has(a.theme))
const checks = [
  ['theme assignments = 2,393', out.totals.assignments === 2393, out.totals.assignments],
  ['posts with a theme = 1,766', out.totals.postsWithAtLeastOne === 1766, out.totals.postsWithAtLeastOne],
  ['multi-theme posts = 378', out.totals.postsWithMoreThanOne === 378, out.totals.postsWithMoreThanOne],
  ['unresolved in Resolution Center = 251', out.totals.unresolvedInResolutionCenter === 251, out.totals.unresolvedInResolutionCenter],
  ['18 parent themes, unchanged', themeTable.length === 18, themeTable.length],
  ['no style label imported as a subject', styleLeak.length === 0, `${styleLeak.length} leaked`],
  ['every assignment names a known parent', unknownTheme.length === 0, `${unknownTheme.length} unknown`],
  ['every assignment carries evidence', audit.assignments.every(a => a.evidence), 'ok'],
]

console.log('\nAPPLY CERTIFIED THEMES\n')
console.log(`  assignments      : ${out.totals.assignments.toLocaleString()}`)
console.log(`  posts tagged     : ${out.totals.postsWithAtLeastOne.toLocaleString()}`)
console.log(`  multi-theme      : ${out.totals.postsWithMoreThanOne.toLocaleString()}`)
console.log(`  parent themes    : ${themeTable.length}`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(40)} ${got}`) }
for (const s of styleLeak.slice(0, 5)) console.log(`      style leak: #${s.postNum} ${s.label}`)
if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: themes.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'themes.json'), JSON.stringify(out))
console.log(`\nwrote public/data/themes.json (${(fs.statSync(path.join(DATA, 'themes.json')).size / 1048576).toFixed(2)} MB)\n`)
