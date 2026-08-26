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

// ── Owner rulings ────────────────────────────────────────────────────────────
// themes-audit.json is written by audit-themes.mjs, a DERIVE step, so a ruling written into it
// survives exactly until the next audit run and then vanishes with no error. Rulings therefore
// live in their own canonical file and are merged HERE, after the derived assignments:
//
//   owner ruling -> audit/themes-owner-rulings.json -> this merge -> themes.json + postAnalysis
//
// Same shape as Claims, where the seven owner rows live in claims-final.json rather than in the
// postAnalysis cache that apply-claims rebuilds.
const RULINGS = path.join(ROOT, 'audit/themes-owner-rulings.json')
const ownerRulings = fs.existsSync(RULINGS) ? JSON.parse(fs.readFileSync(RULINGS, 'utf8')).rulings ?? [] : []
let ownerAdded = 0
for (const r of ownerRulings) {
  // A post may legitimately carry more than one theme, so this adds rather than replaces — but
  // the same theme must never be assigned twice to one post.
  if (audit.assignments.some(a => a.postNum === r.postNum && a.theme === r.theme)) continue
  audit.assignments.push({
    postNum: r.postNum,
    postId: r.postId ?? String(r.postNum),
    theme: r.theme,
    label: r.label,
    confidence: 'OWNER_ADJUDICATED',
    // The anchor is what the renderer highlights, so the ruled phrase must travel with it or the
    // theme would count in the totals while showing nothing in the drop.
    evidence: { anchors: [r.anchor], supportCount: 0, corroboratedByLegacyLabel: false },
    provenance: `owner ruling ${r.ruledOn} — ${r.reasoning}`,
  })
  ownerAdded++
}
audit.assignments.sort((a, b) => a.postNum - b.postNum || a.theme.localeCompare(b.theme))

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
  // 2,393 detected + 292 owner rulings. Both counts are asserted separately so an owner ruling
  // can never be mistaken for detector drift, and so a lost ruling fails here rather than
  // quietly reverting the total to 2,393.
  //
  // 2026-08-26: +39 Health & Medicine (disease/medical-authority sweep — AIDS/HIV, cancer, CDC,
  // opioid, illness, hospital, doctor, and the 27-post COVID/C19/virus cluster). 253 -> 292 owner
  // rulings, 2,646 -> 2,685 assignments. Of the 39: 13 posts had no theme at all (1,899 -> 1,912
  // with a theme), 21 had exactly one other theme and are now multi-theme (445 -> 466), and 5
  // were already multi-theme so a third assignment moves neither counter — 13+21+5 = 39.
  ['detected theme assignments = 2,393', out.totals.assignments - ownerAdded === 2393, out.totals.assignments - ownerAdded],
  ['owner theme rulings applied = 292', ownerAdded === 292, ownerAdded],
  ['theme assignments = 2,685', out.totals.assignments === 2685, out.totals.assignments],
  ['posts with a theme = 1,912', out.totals.postsWithAtLeastOne === 1912, out.totals.postsWithAtLeastOne],
  ['multi-theme posts = 466', out.totals.postsWithMoreThanOne === 466, out.totals.postsWithMoreThanOne],
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

// Same defect as Entities: themes.json carried the certified 2,393 assignments while the UI kept
// rendering 10,453 legacy extractor tags from postAnalysis.themes under the same section name.
{
  const postsFile = path.join(DATA, 'posts.json')
  const allPosts = JSON.parse(fs.readFileSync(postsFile, 'utf8'))
  for (const p of allPosts) {
    const assigned = out.byPost?.[String(p.postNum)] ?? []
    const list = assigned.map(t => t.label)
    // The ANCHORS, so the post view can highlight the words that actually fired the signal.
    //
    // The renderer was searching the post text for the theme LABEL — "Disclosure &
    // Declassification" — which is a taxonomy name and essentially never appears in a drop. The
    // result was that no theme has ever highlighted anywhere. What is in the text is the anchor
    // the Themes audit recorded, so that is what gets rendered; the label belongs on the badge.
    const anchors = [...new Set(assigned.flatMap(t => t.evidence?.anchors ?? []))]
    if (!p.postAnalysis) { if (!list.length) continue; p.postAnalysis = {} }
    p.postAnalysis.themes = list
    p.postAnalysis.themeAnchors = anchors
  }
  fs.writeFileSync(postsFile, JSON.stringify(allPosts))
  console.log('  postAnalysis.themes rewritten from the certified set')
}
console.log(`\nwrote public/data/themes.json (${(fs.statSync(path.join(DATA, 'themes.json')).size / 1048576).toFixed(2)} MB)\n`)
