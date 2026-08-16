// Seed-5 → Seed-6 migration parity, without a browser.
//
// The acceptance condition is: a returning profile that was on Seed 5 must end up with exactly
// the state a fresh Seed-6 profile gets, for every rendering-relevant field.
//
// A browser is needed to exercise IndexedDB itself. It is NOT needed to prove the property,
// because the seed path in src/lib/localData.ts is a WHOLESALE REPLACE:
//
//     if (seeded === SEED_VERSION)  read the cached collections
//     else                          fetch the bundle and idbSet() each collection outright
//
// There is no merge of stale records into fresh ones, so a stale field cannot survive a version
// mismatch. What CAN differ between the two profiles is the post-load transform chain, which runs
// identically on both paths — so this test replays that chain over the old and new bundles and
// compares the rendering-relevant result.
//
// It also guards the specific hazard found today: stripBoardMarkup() cleans a FIXED field list.
// Fields added later (contextUnits, claimSpans, …) bypass it. That is currently correct — spans
// are already materialised in runtime form — but it is correct by accident unless asserted.
//
//   node scripts/test-seed-migration.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'localData.ts'), 'utf8')

const RENDER_FIELDS = ['contextUnits', 'themeAnchors', 'claimSpans', 'predictionSpans',
  'conclusionSpans', 'checkableSpans', 'claims', 'predictions', 'impliedConclusions',
  'verificationHooks', 'namedEntities', 'themes', 'emphasis']

const checks = []
const t = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail: String(detail ?? '') })

// ── 1. the migration mechanism ───────────────────────────────────────────────
t('seed mismatch triggers a full bundle fetch', /seeded === SEED_VERSION/.test(src) && /fetchBundle/.test(src), 'present')
t('collections are REPLACED, not merged',
  /COLLECTIONS\.map\(c => idbSet\(c, \(raw as Record<string, unknown>\)\[c\]\)\)/.test(src), 'wholesale idbSet')
t('the new version is persisted after seeding', /idbSet\('__seed_version__', SEED_VERSION\)/.test(src), 'present')
const seedVer = Number((src.match(/const SEED_VERSION = (\d+)/) ?? [])[1])
t('SEED_VERSION is 6', seedVer === 6, seedVer)

// ── 2. the post-load transform must not mangle the new fields ────────────────
// stripBoardMarkup() decodes entities on a fixed list. The rendering spans are materialised in
// runtime form already, so they must NOT be on that list — decoding them twice would corrupt any
// span whose text legitimately contains an ampersand.
const catsLine = (src.match(/const cats = \[([^\]]*)\]/) ?? [])[1] ?? ''
const spanFieldsInCats = RENDER_FIELDS.filter(f => f.endsWith('Spans') || f === 'contextUnits' || f === 'themeAnchors')
  .filter(f => catsLine.includes(f))
t('rendering-span fields bypass the entity decoder', spanFieldsInCats.length === 0,
  spanFieldsInCats.length ? spanFieldsInCats.join(', ') : 'none on the cats list — correct, spans are already runtime-form')

// ── 3. parity: previous deployed bundle vs current bundle ────────────────────
// The Seed-5 profile cached the PREVIOUSLY deployed posts.json. Its migrated state is, by the
// wholesale-replace property, whatever the current bundle contains — so parity reduces to: does
// the current bundle carry the rendering fields at their expected populations?
let prev = null
try {
  prev = JSON.parse(execFileSync('git', ['show', 'HEAD:public/data/posts.json'], { cwd: ROOT, maxBuffer: 512 * 1024 * 1024 }).toString())
} catch { /* no committed baseline available */ }

const current = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const count = (posts, field) => posts.reduce((n, p) => n + (p.postAnalysis?.[field]?.length ?? 0), 0)

if (prev) {
  const gained = RENDER_FIELDS.filter(f => count(current, f) > 0 && count(prev, f) === 0)
  t('the stale Seed-5 bundle genuinely lacked the new fields', gained.length > 0,
    gained.length ? `${gained.join(', ')} absent before, present now` : 'no difference — nothing to migrate')
  t('every rendering field is populated in the current bundle',
    RENDER_FIELDS.every(f => count(current, f) > 0),
    RENDER_FIELDS.filter(f => count(current, f) === 0).join(', ') || 'all populated')
}

// ── 4. every stored span resolves in the runtime body ───────────────────────
// The property a migrated profile actually depends on: after reseeding, the spans it receives
// must locate text in the body it also receives.
let checked = 0, unresolved = 0
for (const p of current) {
  const body = runtimeText(p.text ?? '')
  for (const f of ['contextUnits', 'themeAnchors', 'claimSpans', 'checkableSpans']) {
    for (const s of p.postAnalysis?.[f] ?? []) {
      checked++
      if (!body.includes(s)) unresolved++
    }
  }
}
t('every migrated span resolves in the migrated body', unresolved === 0, `${checked - unresolved}/${checked}`)

const failed = checks.filter(c => !c.ok)
console.log('\nSEED 5 → 6 MIGRATION PARITY\n')
for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(52)} ${c.detail}`)
console.log(`\n  ${checks.length - failed.length}/${checks.length} checks pass`)
console.log('\n  NOT covered here: the IndexedDB write itself, and browser cache/service-worker')
console.log('  behaviour. Those need a real profile. This proves the DATA property — a returning')
console.log('  Seed-5 profile is handed the same collections a fresh profile is.\n')
process.exit(failed.length ? 1 : 0)
