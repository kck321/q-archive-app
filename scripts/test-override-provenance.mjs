// The cloud-overlay provenance rule, proved against the REAL module.
//
//   node scripts/test-override-provenance.mjs
//
// WHY THIS EXISTS. The editorial build lays Firestore `postEdits` over the seeded bundle. It used
// `Object.assign`, which replaces `postAnalysis` wholesale with a copy that is months old — 1,208
// claims, 62 predictions and 930 entity mentions erased across 244 posts, on the one surface the
// owner reviews on. The export path performs the same bake and then re-runs the apply chain, which
// rebuilds every certified section on top. A browser has no apply chain, so the overlay has to
// decline the stale field rather than repair it afterwards.
//
// WHY IT IMPORTS RATHER THAN REPLICATES. This project has shipped a correct artifact that the app
// never consumed more than once, and every time the audit that checked a REPLICA reported success.
// src/lib/overrideProvenance.ts is transformed with the repo's own esbuild and the exported
// functions are called directly, so a change to the rule fails here instead of passing against a
// copy of the rule as it used to be.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src', 'lib', 'overrideProvenance.ts')

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qprov-')), 'overrideProvenance.mjs')
fs.writeFileSync(out, esbuild.transformSync(fs.readFileSync(SRC, 'utf8'), {
  loader: 'ts', format: 'esm', target: 'es2022',
}).code)
const { selectOverrideFields, fieldTouchedAt, CHAIN_OWNED_FIELDS } = await import(pathToFileURL(out).href)

// The constant the runtime actually compares against, read from source so this cannot pin a stale
// value while localData.ts moves on.
const BAKED = Number(
  (fs.readFileSync(path.join(ROOT, 'src', 'lib', 'localData.ts'), 'utf8')
    .match(/OVERRIDES_BAKED_THROUGH = (\d+)/) ?? [])[1] ?? NaN,
)

let failed = 0
const check = (ok, label, got = '') => {
  if (!ok) failed++
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(72)} ${got}`)
}

console.log('\nCLOUD-OVERLAY PROVENANCE\n')

check(Number.isFinite(BAKED) && BAKED > 0, 'OVERRIDES_BAKED_THROUGH is declared and parseable', String(BAKED))
check(CHAIN_OWNED_FIELDS.includes('postAnalysis'), 'postAnalysis is recorded as chain-owned')

const OLD = BAKED - 86_400_000   // a day before the bundle was baked
const NEW = BAKED + 86_400_000   // a day after

// ── 1. The whole existing collection: legacy docs, all older than the bundle ────────────────
{
  const { applied, skipped } = selectOverrideFields(
    { postAnalysis: { claims: ['stale'] }, correlatedNews: ['x'] },
    { _updatedAt: OLD },
    BAKED,
  )
  check(applied.length === 0, 'a legacy doc older than the bundle applies nothing', `applied ${JSON.stringify(applied)}`)
  check(skipped.length === 2, 'and both its fields are reported as skipped', `skipped ${JSON.stringify(skipped)}`)
}

// ── 2. Exactly at the boundary is ALREADY BAKED, so it is declined ──────────────────────────
{
  const { applied } = selectOverrideFields({ postAnalysis: { claims: ['stale'] } }, { _updatedAt: BAKED }, BAKED)
  check(applied.length === 0, 'an edit stamped exactly at bakedThrough is already in the bundle')
}

// ── 3. A genuine newer cross-device edit still propagates ───────────────────────────────────
{
  const { apply, applied } = selectOverrideFields(
    { postAnalysis: { claims: ['fresh'] } },
    { _updatedAt: NEW, _fieldUpdatedAt: { postAnalysis: NEW } },
    BAKED,
  )
  check(applied.includes('postAnalysis'), 'a genuinely newer postAnalysis edit IS applied')
  check(apply.postAnalysis?.claims?.[0] === 'fresh', 'and it carries the new value through')
}

// ── 4. THE HAZARD. An unrelated newer field must not drag an old postAnalysis along ──────────
//
// pushPostEdit writes with { merge: true }, so a document accumulates fields. Edit correlatedNews
// today and the document is restamped while a months-old postAnalysis sits inside it untouched.
// Per-DOCUMENT provenance would call that snapshot newer than the bundle and lay it back down.
{
  const { apply, applied, skipped } = selectOverrideFields(
    { postAnalysis: { claims: ['stale'] }, correlatedNews: ['fresh story'] },
    { _updatedAt: NEW, _fieldUpdatedAt: { correlatedNews: NEW } },   // postAnalysis NOT redated
    BAKED,
  )
  check(applied.includes('correlatedNews'), 'the field that actually changed is applied')
  check(!applied.includes('postAnalysis'), 'the untouched stale postAnalysis is NOT dragged along', `applied ${JSON.stringify(applied)}`)
  check(skipped.includes('postAnalysis'), 'and it is reported as skipped rather than silently dropped')
  check(apply.postAnalysis === undefined, 'the applied patch carries no postAnalysis key at all')
}

// ── 5. Undated field on a per-field doc scores 0 — the fallback must be pessimistic ──────────
{
  check(fieldTouchedAt({ _updatedAt: NEW, _fieldUpdatedAt: { correlatedNews: NEW } }, 'postAnalysis') === 0,
    'an undated field on a per-field doc dates to 0, not to the document stamp')
  check(fieldTouchedAt({ _updatedAt: NEW }, 'postAnalysis') === NEW,
    'a fully legacy doc still falls back to its document stamp')
}

// ── 6. Metadata never reaches a post ────────────────────────────────────────────────────────
{
  const { apply } = selectOverrideFields(
    { postAnalysis: { claims: ['fresh'] }, _updatedAt: NEW, _fieldUpdatedAt: { postAnalysis: NEW } },
    { _updatedAt: NEW, _fieldUpdatedAt: { postAnalysis: NEW } },
    BAKED,
  )
  check(!('_updatedAt' in apply) && !('_fieldUpdatedAt' in apply),
    'timestamps are never written onto the post as if they were post data')
}

// ── 7. A missing/garbage meta is treated as undatable, not as newer ──────────────────────────
{
  check(selectOverrideFields({ postAnalysis: {} }, undefined, BAKED).applied.length === 0,
    'a doc with no metadata at all applies nothing')
  check(selectOverrideFields({ postAnalysis: {} }, { _updatedAt: NaN }, BAKED).applied.length === 0,
    'a doc with an unparseable timestamp applies nothing')
}

fs.rmSync(path.dirname(out), { recursive: true, force: true })
console.log(`\n  ${failed ? `${failed} FAILED` : 'all checks passed'}\n`)
process.exit(failed ? 1 : 0)
