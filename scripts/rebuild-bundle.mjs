// Rebuild the public bundle from the certified artifacts, WITHOUT touching Firestore.
//
//   node scripts/rebuild-bundle.mjs
//
// Why this exists
// ───────────────
// export-firestore.mjs does two separable things: it dumps Firestore over public/data/, then it
// replays the deterministic apply chain on top of that dump. Only the first half needs the
// network, and the free-tier read quota is exhausted often enough that it blocks for hours.
//
// On 2026-08-14 the export died on quota partway through, AFTER overwriting posts.json and
// BEFORE the tail of the chain ran. The bundle it left behind had contextUnits: 0 and
// literalSpans: 0 on all 4,966 posts while every certified count still verified, because the
// counts are read from the standalone artifacts rather than from posts.json fields. It looked
// fine and was not. The certification manifest caught it; this script is what repairs it.
//
// Running this is safe whenever the canonical artifacts under audit/ are the intended state:
// every step reads those artifacts rather than post text, and the chain is idempotent, so a
// second run reproduces the same bundle byte for byte.
//
// It does NOT re-dump Firestore, so any classification edited in the app since the last
// successful export is not picked up. That is the trade: use this to repair or republish a
// certified bundle, and a real export when there are new Firestore-side edits to collect.
//
// It runs the APPLY steps only. Without a dump there is no new input to audit, and re-deriving
// a certified artifact from the cache it produced is what corrupted the entity set on the first
// attempt at this repair — see the note in lib/chainSteps.mjs.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { APPLY_INVOCATIONS } from './lib/chainSteps.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA = join(root, 'public', 'data')

const cache = join(root, 'scripts', '.cache', 'references.jsonl')
if (!existsSync(cache)) {
  console.error('\n❌ scripts/.cache/references.jsonl is missing — quoted post content would be lost.')
  console.error('   Run: node scripts/scrape-references.mjs\n')
  process.exit(1)
}
if (!existsSync(join(DATA, 'posts.json'))) {
  console.error('\n❌ public/data/posts.json is missing. This rebuilds a bundle; it cannot create one.')
  console.error('   Run a real export: node scripts/export-firestore.mjs\n')
  process.exit(1)
}

const probe = () => {
  const posts = JSON.parse(readFileSync(join(DATA, 'posts.json'), 'utf8'))
  return {
    posts: posts.length,
    quoted: posts.filter(p => p.quotedPosts?.length).length,
    contextUnits: posts.filter(p => p.postAnalysis?.contextUnits?.length).length,
    themeAnchors: posts.filter(p => p.postAnalysis?.themeAnchors?.length).length,
    // Literal spans live on the artifact rows as `literal`, NOT on postAnalysis — the first
    // version of this probe invented a postAnalysis.literalSpans field, found it empty on every
    // post, and reported a corruption that was not there.
    literalSpans: ['questions.json', 'evidence.json'].reduce((n, f) => {
      const j = JSON.parse(readFileSync(join(DATA, f), 'utf8'))
      const rows = Array.isArray(j) ? j : (j.rows ?? j.items ?? j.occurrences ?? [])
      return n + rows.filter(r => r?.literal).length
    }, 0),
  }
}

const before = probe()
console.log('\nREBUILD BUNDLE — deterministic chain, no Firestore\n')
console.log(`  before: ${before.posts} posts · quoted ${before.quoted} · contextUnits ${before.contextUnits} · themeAnchors ${before.themeAnchors} · literalSpans ${before.literalSpans}`)

console.log('\nRe-applying quoted post content…')
execFileSync(process.execPath, [join(root, 'scripts', 'apply-references.mjs')], { stdio: 'inherit' })

for (const { step, args } of APPLY_INVOCATIONS) {
  console.log(`\nRe-running ${step}…`)
  execFileSync(process.execPath, [join(root, 'scripts', step), ...args], { stdio: 'inherit' })
}

const after = probe()
console.log('\n  after : ' + `${after.posts} posts · quoted ${after.quoted} · contextUnits ${after.contextUnits} · literalSpans ${after.literalSpans}`)

// The exact corruption this script was written to repair. A rebuild that leaves either layer
// empty has not finished the chain, whatever the certified counts say.
const problems = []
if (!after.contextUnits) problems.push('contextUnits is empty on every post — the chain did not reach apply-context-units.mjs')
if (!after.themeAnchors) problems.push('themeAnchors is empty on every post — the chain did not reach apply-themes.mjs')
if (!after.literalSpans) problems.push('no artifact row carries a literal span — the chain did not reach materialize-literal-spans.mjs')
if (!after.quoted) problems.push('no post carries quotedPosts — apply-references.mjs did not land')
if (after.posts !== 4966) problems.push(`post count is ${after.posts}, expected 4,966`)

if (problems.length) {
  console.error('\n  ❌ rebuild incomplete:')
  for (const p of problems) console.error(`     ${p}`)
  console.error('')
  process.exit(1)
}

console.log('\n  ✅ bundle rebuilt. Verify before publishing:')
console.log('     node scripts/certification-manifest.mjs --verify\n')
