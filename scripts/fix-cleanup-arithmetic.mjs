// One-shot. Two corrections to group 10c.
//
// 1. DOUBLE COUNTING. `integrated.proven` is already offset by the UPSTREAM deltas a few lines
//    above — the ones that move the before-state and the after-state together. Adding the full
//    delta again on top of it counted those twice and expected 1,248/8,998 where the tree holds
//    1,214/8,821. Only the afterOnly deltas and the duplicate reconciliation belong here.
//
// 2. A STAMP THAT WENT STALE ON 2026-08-21 AND NOBODY SAW. audit-occurrence-provenance.mjs was
//    deliberately re-run for the Nellie Ohr ruling (commit 32d168e) and the determinism stamp was
//    not re-baselined with it, so it has been pointing at the pre-Nellie bytes ever since — unseen
//    because audit-cross-section.mjs could not run at all while Emphasis was half-retired. The
//    audit file is unchanged against HEAD; it is the stamp that is behind.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(ROOT, 'scripts', 'audit-cross-section.mjs')
let s = fs.readFileSync(p, 'utf8')
const swap = (a, b) => {
  if (!s.includes(a)) { console.error(`  X not found:\n${a.slice(0, 120)}`); process.exit(1) }
  s = s.replace(a, b)
}

swap(
`      const d = (contract.postApprovalDeltas ?? []).reduce((a, x) => ({
        mentions: a.mentions + (x.mentions ?? 0) + (x.afterOnly?.mentions ?? 0),
        entityRows: a.entityRows + (x.entityRows ?? 0) + (x.afterOnly?.entityRows ?? 0),
      }), { mentions: 0, entityRows: 0 })`,
`      // ONLY THE afterOnly DELTAS. \`integrated.proven\` above is already offset by the upstream
      // ones — the deltas that move the before-state and the after-state together — so adding the
      // whole set again counts those twice. An afterOnly delta changes what the step DOES rather
      // than the tree it starts from, so it lands here and nowhere else.
      const d = (contract.postApprovalDeltas ?? []).reduce((a, x) => ({
        mentions: a.mentions + (x.afterOnly?.mentions ?? 0),
        entityRows: a.entityRows + (x.afterOnly?.entityRows ?? 0),
      }), { mentions: 0, entityRows: 0 })`)

fs.writeFileSync(p, s)
console.log('double count removed')

// ── re-baseline the determinism stamp ───────────────────────────────────────
const OUT = path.join(ROOT, 'audit')
const DATA = path.join(ROOT, 'public', 'data')
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const digest = sha(path.join(OUT, 'occurrence-provenance-audit.json'))
const inputs = ['entities.json', 'posts.json'].map(f => sha(path.join(DATA, f))).join('|')
const stampPath = path.join(OUT, 'cleanup-determinism.json')
const old = JSON.parse(fs.readFileSync(stampPath, 'utf8'))
fs.writeFileSync(stampPath, JSON.stringify({
  note: 'Determinism stamp. The approved audit must keep its exact bytes; the inputs move whenever a '
    + 'later decision moves the certified state, and every such decision is recorded in '
    + 'audit/entity-cleanup-rollback-contract.json postApprovalDeltas.',
  rebaselinedOn: '2026-08-22',
  why: 'The previous stamp recorded the audit as it stood BEFORE the 2026-08-21 Nellie Ohr ruling '
    + 're-ran audit-occurrence-provenance.mjs (commit 32d168e). The re-run was deliberate and its '
    + 'evidence is in the rollback contract; the stamp simply was not re-baselined with it, and the '
    + 'discrepancy went unseen because audit-cross-section.mjs could not run at all while Emphasis '
    + 'was half-retired. The audit file is unchanged against HEAD.',
  previousAuditSha256: old.auditSha256,
  inputs, auditSha256: digest,
}, null, 1) + '\n')
console.log(`determinism stamp re-baselined: ${old.auditSha256.slice(0, 12)} -> ${digest.slice(0, 12)}`)
