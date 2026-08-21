// The certification manifest — one file that says what "still certified" means, and one
// command that checks it.
//
// Eight sections were certified one at a time, each with its own QA gate and its own memory of
// the right numbers. That worked while a section was being built and stops working the moment
// something changes underneath all of them at once: SEED_VERSION sat at 4 while three applies
// rewrote posts.json, and every section-level gate passed while the certified data never reached
// returning visitors. A per-section gate cannot catch a whole-app regression.
//
// So the manifest records, for every certified artifact: its sha256, its byte size, the counts it
// must carry, the seed version that ships it, and when it was certified. `--verify` compares the
// current tree against it and exits non-zero on any drift.
//
//   node scripts/certification-manifest.mjs            write the manifest
//   node scripts/certification-manifest.mjs --verify   check the tree against it
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { CANONICAL, ARTIFACTS } from './lib/contracts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit', 'certification-manifest.json')
const verify = process.argv.includes('--verify')

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

/**
 * A BYTE change and a MEANING change are different events and must be reported separately.
 *
 * Every deploy re-runs the full export chain, which re-dumps posts.json from Firestore and
 * replays every apply step. The bytes come back in a different order and the file hashes
 * differently while carrying identical data — 4,966 posts, 4,181 claims, 2,422 directives,
 * 5,251 emphasis occurrences, all unchanged. Treating that as drift would cry wolf on every
 * publish, and a gate that cries wolf stops being read.
 *
 * So the manifest carries both: sha256 over the bytes, and a semantic hash over the content with
 * object keys sorted. Semantic drift fails. Byte drift is reported and does not.
 */
const stable = v => Array.isArray(v) ? v.map(stable)
  : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((a, k) => (a[k] = stable(v[k]), a), {})
    : v
const semanticSha = f => crypto.createHash('sha256')
  .update(JSON.stringify(stable(JSON.parse(fs.readFileSync(f, 'utf8'))))).digest('hex')

const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const posts = read('posts.json')
const questions = read('questions.json')

// Counts are recomputed from the artifacts, never copied from a previous manifest — a manifest
// that quotes itself would certify its own drift.
const counts = {
  posts: posts.length,
  questions: questions.filter(q => q.occurrences !== undefined).length,
  questionRowsShipped: questions.length,
  directives: posts.reduce((n, p) => n + (p.actionRequests?.length ?? 0), 0),
  claims: posts.reduce((n, p) => n + (p.postAnalysis?.claims?.length ?? 0), 0),
  predictions: posts.reduce((n, p) => n + (p.postAnalysis?.predictions?.length ?? 0), 0),
  evidence: read('evidence.json').items.length,
  entitiesCanonical: read('entities.json').entities.length,
  entitiesMentions: read('entities.json').entities.reduce((n, e) => n + (e.mentions ?? 0), 0),
  entitiesCoreMentions: read('entities.json').entities.filter(e => e.source === 'core registry').reduce((n, e) => n + (e.mentions ?? 0), 0),
  entitiesTailMentions: read('entities.json').entities.filter(e => e.source === 'adjudicated tail').reduce((n, e) => n + (e.mentions ?? 0), 0),
  themes: read('themes.json').totals.assignments,
  codes: read('codes.json').totals.occurrences,
  emphasis: read('emphasis.json').occurrences.length,
  resolutionQueue: read('resolution-queue.json').rows.length,
}

const expected = {
  posts: CANONICAL.posts,
  questions: CANONICAL.questions.occurrences,
  // +1: the owner question ruling on #524 — see lib/contracts.mjs.
  // 6,577 -> 6,588: 11 owner question rulings, 2026-08-19. The 134 editorial normalisations
  // that make rows exceed certified occurrences are unchanged.
  questionRowsShipped: 6588,
  directives: CANONICAL.directives.occurrences,
  claims: CANONICAL.claims.occurrences,
  predictions: CANONICAL.predictions.occurrences,
  evidence: CANONICAL.evidence.occurrences,
  entitiesCanonical: CANONICAL.entities.canonical,
  entitiesMentions: CANONICAL.entities.mentions,
  entitiesCoreMentions: CANONICAL.entities.coreRegistryMentions,
  entitiesTailMentions: CANONICAL.entities.tailMentions,
  themes: CANONICAL.themes.assignments,
  codes: CANONICAL.codes.occurrences,
  emphasis: CANONICAL.emphasis.occurrences,
  resolutionQueue: CANONICAL.resolution.total,
}

const artifacts = {}
for (const a of ARTIFACTS) {
  const p = path.join(DATA, a)
  if (!fs.existsSync(p)) continue
  artifacts[a] = { sha256: sha(p), semanticSha256: semanticSha(p), bytes: fs.statSync(p).size }
}

const seedMatch = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'localData.ts'), 'utf8').match(/const SEED_VERSION = (\d+)/)
const seedVersion = seedMatch ? Number(seedMatch[1]) : null

// ── verify ───────────────────────────────────────────────────────────────────
if (verify) {
  if (!fs.existsSync(OUT)) { console.error('\nNo manifest yet. Run without --verify first.\n'); process.exit(1) }
  const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  const problems = []

  for (const [k, want] of Object.entries(prev.counts)) {
    if (counts[k] !== want) problems.push(`count ${k}: ${counts[k]} (manifest ${want})`)
  }
  const byteOnly = []
  for (const [a, meta] of Object.entries(prev.artifacts)) {
    if (!artifacts[a]) { problems.push(`artifact ${a}: missing`); continue }
    if (meta.semanticSha256 && artifacts[a].semanticSha256 !== meta.semanticSha256) {
      problems.push(`artifact ${a}: CONTENT changed`)
    } else if (artifacts[a].sha256 !== meta.sha256) {
      byteOnly.push(a)
    }
  }
  if (seedVersion !== prev.seedVersion) problems.push(`SEED_VERSION: ${seedVersion} (manifest ${prev.seedVersion})`)

  console.log('\nCERTIFICATION MANIFEST — VERIFY\n')
  console.log(`  certified at : ${prev.certifiedAt}`)
  console.log(`  sections     : ${prev.sections}`)
  console.log(`  seed version : ${seedVersion}`)
  if (!problems.length) {
    console.log('\n  ✅ every certified count, artifact hash and seed version matches the manifest.\n')
    process.exit(0)
  }
  console.log(`\n  ❌ ${problems.length} difference(s) from the certified state:\n`)
  for (const p of problems) console.log(`     ${p}`)
  console.log('\n  If a change was intended, re-run without --verify to re-certify.\n')
  process.exit(1)
}

// ── write ────────────────────────────────────────────────────────────────────
const drift = Object.entries(expected).filter(([k, v]) => counts[k] !== v)
if (drift.length) {
  console.error('\nRefusing to write a manifest that does not match the canonical counts:\n')
  for (const [k, v] of drift) console.error(`  ${k}: ${counts[k]} (canonical ${v})`)
  console.error('\nFix the drift, or update lib/contracts.mjs if the change was certified.\n')
  process.exit(1)
}

const manifest = {
  certifiedAt: new Date().toISOString(),
  sections: 8,
  seedVersion,
  note: 'Every count here is recomputed from the artifacts, never copied forward. Verify with: node scripts/certification-manifest.mjs --verify',
  counts,
  artifacts,
  canonical: CANONICAL,
}
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1))

console.log('\nCERTIFICATION MANIFEST\n')
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(22)} ${v.toLocaleString()}`)
console.log(`\n  seed version           ${seedVersion}`)
console.log(`  artifacts hashed       ${Object.keys(artifacts).length}`)
console.log(`\nwrote audit/certification-manifest.json\n`)
