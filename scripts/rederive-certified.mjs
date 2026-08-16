// Re-certification, deliberately and in the open.
//
//   node scripts/rederive-certified.mjs           report what a re-derivation would change
//   node scripts/rederive-certified.mjs --adopt   adopt the result into audit/
//
// WHY THIS IS A SEPARATE COMMAND
// ──────────────────────────────
// The derive steps used to run inside export-firestore.mjs, so every deploy re-ran today's
// detectors over the corpus and overwrote the certified artifacts under audit/. That reads like
// "keeping the analysis current". It is not. A certified artifact records an adjudication — which
// occurrences the review kept, how aliases merged, what each row was ruled to be. Re-running a
// detector over it replaces a decision with a measurement.
//
// It stayed invisible while the detectors happened to reproduce their old output, and surfaced at
// seed 75 when they did not: the quoted-block boundary fix from seed 72 moved 18 entity
// occurrences out of quoted source, the export produced 9,804 mentions against the certified
// 9,786, and apply-entities.mjs refused to write. The only way to deploy was SKIP_EXPORT=1 — a
// protection had made the ordinary pipeline unrunnable.
//
// So the deploy path applies certified artifacts and never re-derives them (lib/chainSteps.mjs),
// and re-derivation lives here, where it produces a REPORT the owner can rule on rather than a
// silent count move inside a deploy.
//
// This runs in an isolated copy. The live repo is not touched unless --adopt is passed, and
// --adopt only copies artifacts — it certifies nothing. Re-certification is still:
//     ruling -> adopt -> apply chain -> invariants -> certification-manifest.mjs -> deploy
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { DERIVE_STEPS } from './lib/chainSteps.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const adopt = process.argv.includes('--adopt')
const keep = process.argv.includes('--keep')

const SKIP = new Set(['node_modules', '.git', 'dist', '.snapshots', '.vite', 'media-bundle'])
const sha = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex')

// ── isolated copy ────────────────────────────────────────────────────────────
// Never derive in place. The first attempt at this repair overwrote nine certified artifacts in
// the working tree just to find out which ones would move.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'qapp-rederive-'))
console.log('\nRE-DERIVE CERTIFIED ARTIFACTS — isolated copy\n')
console.log(`  working copy : ${work}`)
fs.cpSync(ROOT, work, {
  recursive: true,
  filter: src => !SKIP.has(path.basename(src)),
})
// Junction rather than a copy: node_modules is large and nothing here writes to it.
try {
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(work, 'node_modules'), 'junction')
} catch { /* the derive steps use node builtins only; a missing link is not fatal */ }

// ── what the certified state is now ──────────────────────────────────────────
const auditDir = f => path.join(ROOT, 'audit', f)
const workAudit = f => path.join(work, 'audit', f)
const artifacts = fs.readdirSync(path.join(ROOT, 'audit')).filter(f => f.endsWith('.json'))
const before = new Map(artifacts.map(f => [f, sha(auditDir(f))]))

// ── run the derive chain ─────────────────────────────────────────────────────
let failed = null
for (const step of DERIVE_STEPS) {
  process.stdout.write(`  ${step.padEnd(34)}`)
  try {
    execFileSync(process.execPath, [path.join(work, 'scripts', step), '--apply'], { cwd: work, stdio: 'pipe' })
    console.log('ok')
  } catch (err) {
    console.log('FAILED')
    failed = { step, out: String(err.stdout ?? '') + String(err.stderr ?? '') }
    break
  }
}
if (failed) {
  console.error(`\n  ❌ ${failed.step} failed. Nothing adopted.\n`)
  console.error(failed.out.split('\n').slice(-25).join('\n'))
  process.exit(1)
}

// ── what moved ───────────────────────────────────────────────────────────────
const changed = []
for (const f of artifacts) {
  const w = workAudit(f)
  if (!fs.existsSync(w)) continue
  if (sha(w) !== before.get(f)) changed.push(f)
}

console.log(`\n  ${changed.length} certified artifact(s) would change:`)
for (const f of changed) console.log(`    audit/${f}`)

// The counts are what a ruling is actually about, so report those rather than only file hashes.
// --dry so the isolated copy is measured without writing a bundle nobody will use.
//
// READ THESE NUMBERS AS A MAGNITUDE, NOT AS A PROPOSED COUNT.
//
// The derive ran over the BUILT bundle, and several derive steps read fields that their own apply
// step writes — audit-entities.mjs reads postAnalysis.namedEntities and apply-entities.mjs writes
// it. So part of every delta below is that inversion rather than genuine detector drift. The
// separation matters only for a real re-certification, which must derive from a fresh Firestore
// dump; it does not matter for the deploy path, which no longer derives at all.
//
// To attribute a delta properly: run this, then re-run the one section's derive step against a
// fresh dump and diff the two. That is how the seed-75 entity drift was pinned to
// lib/quotedBlocks.mjs rather than guessed at.
console.log('\n  COUNT IMPACT (apply steps, dry run)\n')
console.log('    Magnitudes, not proposals — part of each delta is the derive-on-built-bundle')
console.log('    inversion, not detector drift. See the note in this script before ruling.\n')
const probes = [
  ['entities', 'apply-entities.mjs'],
  ['themes', 'apply-themes.mjs'],
  ['codes', 'apply-codes.mjs'],
  ['emphasis', 'apply-emphasis.mjs'],
  ['evidence', 'apply-evidence.mjs'],
]
let anyFail = false
for (const [label, step] of probes) {
  if (!fs.existsSync(path.join(work, 'scripts', step))) continue
  let out = ''
  try {
    out = String(execFileSync(process.execPath, [path.join(work, 'scripts', step), '--dry'], { cwd: work, stdio: 'pipe' }))
  } catch (err) {
    out = String(err.stdout ?? '') + String(err.stderr ?? '')
    anyFail = true
  }
  const fails = out.split('\n').filter(l => l.includes('FAIL'))
  console.log(`    ${label.padEnd(10)} ${fails.length ? `${fails.length} QA check(s) would fail` : 'reproduces the certified counts'}`)
  for (const l of fails) console.log(`               ${l.trim()}`)
}

// ── report ───────────────────────────────────────────────────────────────────
const report = {
  ranAt: new Date().toISOString(),
  deriveSteps: DERIVE_STEPS,
  changedArtifacts: changed,
  certifiedCountsReproduced: !anyFail,
  note: 'A changed artifact is not a defect and not an improvement — it is a re-adjudication that has not been ruled on. Adopting it re-certifies the section.',
}
fs.writeFileSync(path.join(ROOT, 'audit', 'rederive-report.json'), JSON.stringify(report, null, 1))
console.log('\n  wrote audit/rederive-report.json')

if (!adopt) {
  console.log('\n  Nothing adopted. The live repo is unchanged.')
  console.log('  To adopt after an owner ruling:  node scripts/rederive-certified.mjs --adopt\n')
  if (keep) console.log(`  working copy kept at ${work}\n`)
  else fs.rmSync(work, { recursive: true, force: true })
  process.exit(anyFail ? 2 : 0)
}

// ── adopt ────────────────────────────────────────────────────────────────────
// Deliberate, and still not a certification. The gates downstream decide whether it ships.
for (const f of changed) fs.copyFileSync(workAudit(f), auditDir(f))
console.log(`\n  ✅ adopted ${changed.length} artifact(s) into audit/.`)
console.log('     Now: node scripts/rebuild-bundle.mjs')
console.log('          node scripts/audit-cross-section.mjs')
console.log('          node scripts/certification-manifest.mjs   (deliberate re-certification)\n')
if (!keep) fs.rmSync(work, { recursive: true, force: true })
