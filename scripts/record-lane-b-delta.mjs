// Records the lane-B family-4 occurrence decisions as the fifth postApprovalDeltas entry on the
// 2026-08-17 rollback contract. One-shot; refuses if the entry is already there.
//
//   node scripts/record-lane-b-delta.mjs
//
// It does NOT touch approvedByOwner, countsBefore, countsAfter, before, after or snapshot.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(ROOT, 'audit', 'entity-cleanup-rollback-contract.json')
const c = JSON.parse(fs.readFileSync(p, 'utf8'))
const w = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'occurrence-withdrawals-lane-b.json'), 'utf8'))

if (c.postApprovalDeltas.some(d => String(d.ruling).includes('lane B famil'))) {
  console.log('  already recorded — nothing written.'); process.exit(0)
}
if (c.postApprovalDeltas.length !== 4) {
  console.error(`  X expected 4 existing deltas, found ${c.postApprovalDeltas.length}. Refusing.`); process.exit(1)
}

const byAction = w.withdrawals.reduce((m, x) => ({ ...m, [x.proposedAction]: (m[x.proposedAction] ?? 0) + 1 }), {})

c.postApprovalDeltas.push({
  ruling: 'audit/occurrence-withdrawals-lane-b.json (lane B families 4-5 — the UNLOCATED and structural review)',
  ruledOn: '2026-08-22',
  what: `Under the owner instruction of 2026-08-22 to give every human-semantic conflict row an `
    + `explicit disposition: ${w.withdrawals.length} entity occurrences whose only trace on the drop `
    + `is a URL slug, a hostname, a social handle or nothing at all. ${byAction['migrate-to-linked-source'] ?? 0} `
    + `migrate to linked sources and ${byAction['migrate-to-social-account'] ?? 0} to social accounts — `
    + `the reference is real and only the layer was wrong — and ${byAction['remove-annotation'] ?? 0} are `
    + `withdrawn outright. Applied BY THIS STEP, so only the after-state moves.`,
  mentions: 0, entityRows: 0, rendered: 0,
  afterOnly: { mentions: -28, entityRows: 0, rendered: -28 },
  originalApprovalUntouched: 'audit/occurrence-provenance-audit.json is unchanged — 9,926 rows, 951 '
    + 'proposedWithdrawals, every 2026-08-17 category and evidence record intact. This is a separately '
    + 'pinned set (sha256 c51a2d80ad5b65ef245ba0929b7b989ad32ead240b66521c5e0d59efe84691c6) read beside it.',
  whyThisIsNotDrift: 'The 2026-08-17 audit classified each of these occurrences `keep` because its '
    + 'matcher could see no evidence category for them at all — the identity was UNLOCATABLE on the '
    + 'drop, so no visible-token, URL-source or image test could fire and the safe answer was to leave '
    + 'them alone. Reading each drop supplies the evidence the matcher could not: the name is in a '
    + 'CMS slug, a hostname or a twitter handle. That is the same finding the approved plan made about '
    + '646 URL-derived and 129 social-account occurrences, reached the same way and given the same '
    + 'treatment.',
  effectMeasured: {
    occurrencesMoved: w.withdrawals.length,
    byAction,
    identitiesLosingTheirLastMention: w.measuredAtBuildTime.entitiesWhoseLastMentionThisWithdraws,
    ofThoseRetiredDormant: 0,
    ofThoseBecomingSourceOnly: w.measuredAtBuildTime.entitiesWhoseLastMentionThisWithdraws,
    note: 'Reuters and Ann Coulter lose their last prose mention and BOTH migrate, so both keep a row '
      + 'as a source-only identity rather than going dormant. No identity is retired by this delta.',
  },
  why: 'The approval record above is left exactly as written. A delta is recorded beside it instead, '
    + 'so the guard still refuses an unrecognised tree while a later decision does not read as drift. '
    + 'Same mechanism as the four entries above it.',
})

fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n')
console.log(`  recorded. postApprovalDeltas is now ${c.postApprovalDeltas.length} entries.`)
