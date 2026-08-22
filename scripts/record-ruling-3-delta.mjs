// Records Owner Ruling 3 as the fourth postApprovalDeltas entry on the 2026-08-17 rollback
// contract. One-shot; refuses if the entry is already there.
//
//   node scripts/record-ruling-3-delta.mjs
//
// It does NOT touch approvedByOwner, countsBefore, countsAfter, before, after or snapshot. Those
// five are the approval record and the thing rollback restores to; a deploy may not move them.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(ROOT, 'audit', 'entity-cleanup-rollback-contract.json')
const c = JSON.parse(fs.readFileSync(p, 'utf8'))
c.postApprovalDeltas ??= []
if (c.postApprovalDeltas.some(d => String(d.ruling).includes('Owner Ruling 3'))) {
  console.log('  already recorded — nothing written.')
  process.exit(0)
}
if (c.postApprovalDeltas.length !== 3) {
  console.error(`  X expected 3 existing deltas, found ${c.postApprovalDeltas.length}. Refusing.`)
  process.exit(1)
}

c.postApprovalDeltas.push({
  ruling: 'audit/occurrence-withdrawals-owner-ruling-3.json (Owner Ruling 3 — 29 reviewed C/D/E occurrence withdrawals)',
  ruledOn: '2026-08-22',
  what: 'Owner ruling, APPROVED: the 29 individually reviewed C/D/E rows from the '
    + 'NO_ALIAS_EVER_REGISTERED family must not remain attributed as Q-authored occurrences. '
    + '27 are entries in postAnalysis.namedEntities and are withdrawn BY THIS STEP; the other 2 '
    + 'are themeAnchors and are withdrawn by apply-step3b1.mjs, which owns that array. This is '
    + 'the FIRST delta that changes what this step DOES rather than the tree it starts from, so '
    + 'it is recorded under afterOnly and moves the after-state only.',
  mentions: 0,
  entityRows: 0,
  rendered: 0,
  afterOnly: { mentions: -27, entityRows: -21, rendered: -27 },
  reviewedPopulation: { C: 12, D: 14, E: 3, total: 29, namedEntities: 27, themeAnchors: 2, F_left_unresolved: 9 },
  oldApprovedSnapshot: 'countsBefore 1,409 rows / 9,749 mentions and countsAfter 1,201 / 8,798 '
    + '(2026-08-17), carried forward by the three earlier deltas to a before-state of 1,448 / 9,926 '
    + 'and an after-state of 1,235 / 8,975. Neither is rewritten.',
  originalApprovalUntouched: 'audit/occurrence-provenance-audit.json is unchanged — 9,926 rows, '
    + '951 proposedWithdrawals, every 2026-08-17 category and evidence record intact. The 27 are a '
    + 'separately pinned set (sha256 65f82ace6748eaaf1bbbdd010f8cba30802c8f9a7c918e5928be0ef2a20e21ef) '
    + 'read beside it, so the approved plan and the later ruling stay independently readable.',
  whyThisIsARe_adjudication: 'The owner stated it plainly: "This DOES re-adjudicate those specific '
    + 'occurrence decisions from the 2026-08-17 occurrence-provenance migration." 22 of the 27 were '
    + 'classified image_provenance_unconfirmed and held; 5 were classified visible_complete_token '
    + 'and kept. buildPlan still refuses a removal action on a visible_complete_token row IN THE '
    + 'APPROVED AUDIT — that check is unchanged and still governs all 9,926. These 5 are withdrawn '
    + 'by explicit per-occurrence ruling instead, which is how a semantic ruling is applied here: '
    + 'by occurrence identity, never by loosening a matcher.',
  effectMeasured: {
    occurrencesWithdrawn: 27,
    identitiesLosingTheirLastMention: 22,
    ofThoseRetiredDormant: 21,
    ofThoseBecomingSourceOnly: 1,
    sourceOnlyIdentity: 'Judicial Watch — 3 of its 7 occurrences migrate to linked sources under '
      + 'the approved plan, so the row survives as a source-only row rather than going dormant.',
    beforeMentions: 8975, afterMentions: 8948,
    beforeEntityRows: 1235, afterEntityRows: 1214,
  },
  why: 'The approval record above is left exactly as written. A delta is recorded beside it '
    + 'instead, so the guard still refuses an unrecognised tree while a later owner ruling does '
    + 'not read as drift. Same mechanism as the 2026-08-20, 2026-08-21 and Owner Ruling 1 entries.',
})

fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n')
console.log(`  recorded. postApprovalDeltas is now ${c.postApprovalDeltas.length} entries.`)
