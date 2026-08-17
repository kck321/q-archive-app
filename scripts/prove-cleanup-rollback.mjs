// ROLLBACK PROOF, FROM THE APPLIED STATE, WITHOUT DISTURBING IT.
//
//   node scripts/prove-cleanup-rollback.mjs
//
// `apply-entity-cleanup.mjs --prove-rollback` proves the restore BEFORE the cleanup is applied: it
// builds the plan from the certified data, applies it in a scratch copy and puts it back. That is
// the right proof to run while deciding, and it cannot run afterwards — the plan is derived from an
// audit of 9,749 occurrences, and once the applier has written, the tree holds 8,798. The applier
// refuses, correctly, rather than re-deriving a plan against a state the audit never described.
//
// Which leaves the question that matters on the day of a deploy unanswered: with the migration
// APPLIED and about to ship, can it still be taken back? The answer does not depend on the plan at
// all. It depends on two artifacts:
//
//   the snapshot   the original bytes, kept in .snapshots/, which is what --rollback copies back
//   the contract   audit/entity-cleanup-rollback-contract.json, the hashes those bytes must have,
//                  plus audit/entity-cleanup-reversal.json, which rebuilds every withdrawn
//                  annotation in its original array position
//
// So this proves the restore by PERFORMING it — in a scratch directory, against copies — and
// comparing SHA-256. Nothing in public/data is opened for writing. A rollback that is only asserted
// is a rollback nobody has run.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const SNAPS = path.join(ROOT, '.snapshots')
const sha = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'))

let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${got}`) }

console.log('\nENTITY CLEANUP — ROLLBACK PROOF FROM THE APPLIED STATE\n')

const contractPath = path.join(OUT, 'entity-cleanup-rollback-contract.json')
check(fs.existsSync(contractPath), 'the rollback contract exists', contractPath.replace(ROOT, '.'))
if (!fs.existsSync(contractPath)) process.exit(1)
const contract = read(contractPath)
const snapDir = path.join(SNAPS, contract.snapshot)
check(fs.existsSync(snapDir), 'the snapshot the contract names is still on disk', contract.snapshot)
if (!fs.existsSync(snapDir)) process.exit(1)

// ── the snapshot really is the pre-cleanup state ────────────────────────────
// Checked against the contract's own hashes rather than trusted. A snapshot directory that has been
// overwritten by a later run would restore the wrong bytes and report success.
const wrongSnap = Object.entries(contract.before).filter(([f, h]) => {
  const p = path.join(snapDir, f)
  return !fs.existsSync(p) || sha(p) !== h
})
check(wrongSnap.length === 0, 'every snapshot file hashes to its recorded pre-cleanup value',
  `${Object.keys(contract.before).length} files, ${wrongSnap.length} mismatched`)

// ── the cleanup really is applied right now ─────────────────────────────────
// A zero is only evidence once something could have made it non-zero: if the tree still held the
// pre-cleanup bytes, "the restore returns them" would be true and meaningless.
const movedNow = Object.keys(contract.before).filter(f => sha(path.join(DATA, f)) !== contract.before[f])
check(movedNow.length === Object.keys(contract.before).length,
  'the working tree is currently the APPLIED state, not the original', `${movedNow.length} of ${Object.keys(contract.before).length} files differ`)
check(contract.created.every(f => fs.existsSync(path.join(DATA, f))),
  'every file the cleanup created is present', contract.created.join(', ') || 'none')

// ── perform the restore, in a scratch copy ──────────────────────────────────
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'q-rollback-proof-'))
try {
  const all = fs.readdirSync(DATA).filter(f => f.endsWith('.json')).sort()
  for (const f of all) fs.copyFileSync(path.join(DATA, f), path.join(scratch, f))

  for (const f of Object.keys(contract.before)) fs.copyFileSync(path.join(snapDir, f), path.join(scratch, f))
  for (const f of contract.created) { const p = path.join(scratch, f); if (fs.existsSync(p)) fs.unlinkSync(p) }

  const mismatches = Object.entries(contract.before).filter(([f, h]) => sha(path.join(scratch, f)) !== h)
  const leftover = contract.created.filter(f => fs.existsSync(path.join(scratch, f)))
  const outside = all.filter(f => !Object.keys(contract.before).includes(f) && !contract.created.includes(f)
    && sha(path.join(scratch, f)) !== sha(path.join(DATA, f)))

  check(mismatches.length === 0, 'the restore returns every certified byte', `${mismatches.length} mismatches`)
  check(leftover.length === 0, 'the files the cleanup created are removed', `${leftover.length} left`)
  check(outside.length === 0, 'nothing outside the contract is touched', `${outside.length} files`)

  // ── the arithmetic half ───────────────────────────────────────────────────
  // The bytes returning proves the snapshot. It does not prove the reversal CONTRACT, which is what
  // a human would have to work from if the snapshot were ever lost — so that is replayed on its own
  // against the applied posts, and must rebuild every annotation in its original array position.
  const reversal = read(path.join(OUT, 'entity-cleanup-reversal.json'))
  const applied = read(path.join(DATA, 'posts.json'))
  const original = read(path.join(snapDir, 'posts.json'))
  const replay = JSON.parse(JSON.stringify(applied))
  const byNum = new Map(replay.map(p => [p.postNum, p]))
  let placed = 0
  for (const r of [...reversal.restores].sort((a, b) => a.postNum - b.postNum || a.index - b.index)) {
    const p = byNum.get(r.postNum)
    if (!p) continue
    p.postAnalysis.namedEntities.splice(r.index, 0, r.alias)
    placed++
  }
  const annots = x => JSON.stringify(x.map(p => p.postAnalysis?.namedEntities ?? []))
  const appliedCount = applied.reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).length, 0)
  const replayCount = replay.reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).length, 0)
  const originalCount = original.reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).length, 0)

  check(placed === reversal.restores.length, 'every reversal record finds its drop', `${placed} of ${reversal.restores.length}`)
  check(replayCount === originalCount, 'the contract alone rebuilds the original mention count',
    `${appliedCount} + ${reversal.restores.length} = ${replayCount} (original ${originalCount})`)
  check(annots(replay) === annots(original), 'and rebuilds every annotation in its original position',
    annots(replay) === annots(original) ? 'array-identical' : 'POSITIONS DIFFER')
} finally {
  fs.rmSync(scratch, { recursive: true, force: true })
}

console.log(`\n  ${failed ? `❌ ${failed} failed — DO NOT DEPLOY` : '✅ the applied cleanup is fully reversible: byte-identical restore, and the contract rebuilds every annotation on its own.'}\n`)
process.exit(failed ? 1 : 0)
