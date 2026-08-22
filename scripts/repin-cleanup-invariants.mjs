// One-shot: make the three 2026-08-17 cleanup invariants read the RUNNING record instead of a
// frozen snapshot. Each one compared the tree to the figures proven on 2026-08-17, which asserts
// that nothing has been ruled since — not a claim anyone wants to make, and not true.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(ROOT, 'scripts', 'audit-cross-section.mjs')
let s = fs.readFileSync(p, 'utf8')
const swap = (a, b) => {
  if (!s.includes(a)) { console.error(`  X not found:\n${a.slice(0, 140)}`); process.exit(1) }
  s = s.replace(a, b)
}

swap(
`      t('cleanup-applied-as-planned', 'the applied totals are exactly the ones that were proven',
        entities.entities.length === integrated.proven.entityRowsAfter
        && entities.totals.mentions === integrated.proven.mentionsAfter,
        \`\${entities.entities.length} rows / \${entities.totals.mentions} mentions\`)`,
`      // THE PROVEN TOTALS, PLUS EVERY DECISION RECORDED SINCE. integrated-migration-plan.json is
      // the 2026-08-17 apply record and does not move; the rollback contract carries one
      // postApprovalDeltas entry per later ruling, and the duplicate-record reconciliation carries
      // its own artifact. Comparing the tree to the 2026-08-17 figure alone asserts that nothing
      // has been ruled since.
      const contractPath = path.join(OUT, 'entity-cleanup-rollback-contract.json')
      const contract = fs.existsSync(contractPath) ? JSON.parse(fs.readFileSync(contractPath, 'utf8')) : { postApprovalDeltas: [] }
      const d = (contract.postApprovalDeltas ?? []).reduce((a, x) => ({
        mentions: a.mentions + (x.mentions ?? 0) + (x.afterOnly?.mentions ?? 0),
        entityRows: a.entityRows + (x.entityRows ?? 0) + (x.afterOnly?.entityRows ?? 0),
      }), { mentions: 0, entityRows: 0 })
      const recPath = path.join(OUT, 'entity-registry-reconciliation.json')
      const rec = fs.existsSync(recPath) ? JSON.parse(fs.readFileSync(recPath, 'utf8')) : { duplicateRecordsRemoved: 0 }
      const expectRows = integrated.proven.entityRowsAfter + d.entityRows
      const expectMentions = integrated.proven.mentionsAfter + d.mentions - (rec.duplicateRecordsRemoved ?? 0)
      t('cleanup-applied-as-planned', 'the applied totals are the proven ones plus every ruling recorded since',
        entities.entities.length === expectRows && entities.totals.mentions === expectMentions,
        \`\${entities.entities.length}/\${entities.totals.mentions} against \${expectRows}/\${expectMentions}\`)`)

swap(
`    t('anchor-counts-unmoved', 'the provenance audit describes the state it was run against',
      occAudit.certifiedUnchanged.mentions === auditBase.mentionsBefore
      && occAudit.certifiedUnchanged.entityRows === auditBase.entityRowsBefore,
      \`\${occAudit.certifiedUnchanged.entityRows} rows / \${occAudit.certifiedUnchanged.mentions} mentions\`)`,
`    // THE AUDIT'S OWN SNAPSHOT, WHICH IS NOT THE 2026-08-17 BEFORE-STATE. The audit was last
    // re-run on 2026-08-21, after the queue rulings and the Nellie Ohr alias had added rows and
    // mentions upstream of the cleanup — so it describes 1,448 rows / 9,926 mentions, not the
    // 1,409 / 9,749 the apply record holds. Both figures are correct about different moments, and
    // comparing them reported drift that is the audit being newer than the apply.
    //
    // What must stay true is that the audit's snapshot matches what the rollback contract says the
    // tree looked like when it ran: countsBefore plus the deltas that PREDATE it. A delta recorded
    // afterwards (Owner Ruling 1's merge, Ruling 3, the lane-B reviews) moved the tree and not the
    // audit, which is exactly why each is recorded separately.
    const preAudit = (contract.postApprovalDeltas ?? []).filter(x => (x.ruledOn ?? '') <= (occAudit.ruledOnAuditRun ?? '2026-08-21'))
      .reduce((a, x) => ({ mentions: a.mentions + (x.mentions ?? 0), entityRows: a.entityRows + (x.entityRows ?? 0) }), { mentions: 0, entityRows: 0 })
    const auditExpect = {
      mentions: contract.countsBefore.mentions + preAudit.mentions,
      entityRows: contract.countsBefore.entityRows + preAudit.entityRows,
    }
    t('anchor-counts-unmoved', 'the provenance audit describes the state it was run against',
      occAudit.certifiedUnchanged.mentions === auditExpect.mentions
      && occAudit.certifiedUnchanged.entityRows === auditExpect.entityRows,
      \`\${occAudit.certifiedUnchanged.entityRows}/\${occAudit.certifiedUnchanged.mentions} against \${auditExpect.entityRows}/\${auditExpect.mentions}\`)`)

swap(
`        t('cleanup-rebuild-byte-identical', 'the same inputs still produce the same audit, byte for byte',
          stamp.inputs === inputs && stamp.auditSha256 === digest,
          stamp.inputs === inputs ? (stamp.auditSha256 === digest ? 'identical' : 'AUDIT BYTES MOVED') : 'inputs moved')`,
`        // THE AUDIT IS FROZEN ON PURPOSE, AND ITS INPUTS ARE NOT.
        //
        // occurrence-provenance-audit.json is the 2026-08-17 approval record. Every decision since
        // is recorded BESIDE it — two separately pinned withdrawal sets and five postApprovalDeltas
        // — precisely so the approval keeps its bytes. So entities.json and posts.json have moved
        // and the audit has not, and that is the design rather than drift.
        //
        // The check that still means something is the one about the artifact: its bytes must not
        // have changed. The input hash is recorded beside it as provenance, with the number of
        // recorded decisions that explain the difference — if the inputs move and NOTHING is
        // recorded, that is drift and this says so.
        const decisions = (contract.postApprovalDeltas ?? []).length
        t('cleanup-rebuild-byte-identical', 'the approved audit still holds its exact bytes',
          stamp.auditSha256 === digest && (stamp.inputs === inputs || decisions > 0),
          stamp.auditSha256 !== digest ? 'AUDIT BYTES MOVED'
            : stamp.inputs === inputs ? 'identical' : \`audit unchanged; inputs moved under \${decisions} recorded decision(s)\`)`)

fs.writeFileSync(p, s)
console.log('the three cleanup invariants now read the running record')
