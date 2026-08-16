// Prove the editorial write guard actually refuses.
//
// The guard shipped once already as UNPROVEN code: the batch run aborted at an earlier QA check
// and never reached the guarded write, so it had never refused anything. A guard nobody has seen
// refuse is a comment with a function signature.
//
// This exercises scripts/lib/certifiedWrite.mjs itself — the same module the editorial tools
// import. A duplicated allowlist in a test proves the test, not the tool.
//
//   node scripts/test-certified-write-guard.mjs
import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT,
  CANONICAL_WRITE_ALLOWLIST,
  CertifiedWriteRefused,
  writeCertifiedArtifact,
} from './lib/certifiedWrite.mjs'

let failed = 0
const line = (ok, label, got) => {
  if (!ok) failed++
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`)
}

console.log('\nEDITORIAL WRITE GUARD — NEGATIVE TEST\n')
console.log('  REFUSE cases (the write must not happen)')

// Every refusal is checked twice: the guard threw, AND the target on disk is untouched. A guard
// that reports a refusal after writing is the failure this whole file exists to catch.
const refuses = [
  ['public/data/posts.json', 'the derived cache the first batch corrupted'],
  ['public/data/questions.json', 'any path under public/data/'],
  ['audit/postAnalysis-claims.json', 'any path naming postAnalysis'],
  ['audit/foo.json', 'an audit path that is not allowlisted'],
  ['scripts/lib/certifiedWrite.mjs', 'the guard itself'],
]

for (const [rel, why] of refuses) {
  const abs = path.join(ROOT, rel)
  const before = fs.existsSync(abs) ? fs.readFileSync(abs) : null
  let refused = false
  try {
    writeCertifiedArtifact(rel, { poisoned: true })
  } catch (err) {
    refused = err instanceof CertifiedWriteRefused
    if (!refused) throw err
  }
  const after = fs.existsSync(abs) ? fs.readFileSync(abs) : null
  const untouched = before === null ? after === null : after !== null && before.equals(after)
  line(refused && untouched, `${rel} — ${why}`, refused ? (untouched ? 'refused, file untouched' : 'REFUSED BUT WROTE') : 'WROTE')
}

console.log('\n  ALLOW cases (the write must happen)')

// A real write, on an allowlisted path that holds no certified data, so the writer is proved to
// write rather than merely proved not to throw.
{
  const rel = 'audit/editorial-batch-applied.json'
  const abs = path.join(ROOT, rel)
  const existed = fs.existsSync(abs)
  const original = existed ? fs.readFileSync(abs) : null
  try {
    const payload = { test: 'certified-write-guard', rows: [1, 2, 3] }
    writeCertifiedArtifact(rel, payload, { space: 1 })
    const readBack = JSON.parse(fs.readFileSync(abs, 'utf8'))
    line(JSON.stringify(readBack) === JSON.stringify(payload), `${rel} — allowlisted, real write`, 'written and read back')
  } finally {
    if (existed) fs.writeFileSync(abs, original)
    else if (fs.existsSync(abs)) fs.unlinkSync(abs)
  }
}

// The two live certified artifacts: written back byte-for-byte identical. This proves the allow
// path on the REAL targets without mutating certified data — and doubles as a check that the
// writer's serialisation matches the format those artifacts already carry, since a reformat
// would show up as drift in the frozen-section hash check.
for (const rel of ['audit/claims-final.json', 'audit/themes-audit.json']) {
  const abs = path.join(ROOT, rel)
  const original = fs.readFileSync(abs)
  let identical = false
  try {
    writeCertifiedArtifact(rel, JSON.parse(original.toString('utf8')), { space: 1 })
    identical = fs.readFileSync(abs).equals(original)
  } finally {
    fs.writeFileSync(abs, original)          // restored whatever happened above
  }
  line(identical, `${rel} — allowlisted, round-trip byte-identical`, identical ? 'unchanged' : 'REFORMATTED')
}

console.log('\n  Structural checks')

// The allowlist must exist in exactly one place. Any editorial tool carrying its own copy is the
// fifth-copy failure this module was extracted to prevent.
const scriptsDir = path.join(ROOT, 'scripts')
const sources = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.mjs'))
const ownCopies = sources.filter(f => /CANONICAL_WRITE_ALLOWLIST\s*=/.test(fs.readFileSync(path.join(scriptsDir, f), 'utf8')))
line(ownCopies.length === 0, 'no script defines its own allowlist', ownCopies.join(', ') || 'single copy in lib/')

for (const f of ['apply-editorial-batch.mjs', 'apply-owner-claims.mjs']) {
  const src = fs.readFileSync(path.join(scriptsDir, f), 'utf8')
  const imports = /from '\.\/lib\/certifiedWrite\.mjs'/.test(src)
  const rawWrite = /fs\.writeFileSync/.test(src)
  line(imports && !rawWrite, `${f} writes through the guard only`, imports ? (rawWrite ? 'RAW writeFileSync PRESENT' : 'ok') : 'DOES NOT IMPORT GUARD')
}

line(CANONICAL_WRITE_ALLOWLIST.every(p => p.startsWith('audit/')), 'every allowlisted path is an audit artifact', `${CANONICAL_WRITE_ALLOWLIST.length} paths`)

console.log(failed ? `\n  ${failed} check(s) FAILED\n` : '\n  every check passed — the guard refuses and the writer writes\n')
process.exit(failed ? 1 : 0)
