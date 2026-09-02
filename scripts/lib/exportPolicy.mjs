// WHETHER A DEPLOY MAY SKIP THE FIRESTORE EXPORT — decided in one place, by a pure function.
//
// WHY THIS EXISTS
// ───────────────
// `SKIP_EXPORT=1` publishes the bundle already on disk instead of re-dumping Firestore. It was
// introduced as a QUOTA ESCAPE HATCH and it became a habit: five consecutive deploys shipped
// through it, each one citing the previous one's justification.
//
// The justification itself then went stale without anyone noticing. Deploys from 2026-08-27
// onward cited the "qc-pin export blocker" — export-firestore.mjs aborting because the Firestore
// dump carried hash-id question rows on #1915/#1944 that no longer prior-matched local
// questions.json, so the POSITIONALLY minted qc- ids shifted (qc-h -> qc-f) and the pinned
// literal-spans QA refused. That was true when it was written.
//
// Stage B removed the mechanism entirely. identity/question-identity-registry.json is now the
// identity authority for all 6,643 certified questions, every positional allocator is gone with
// no fallback, and an unrecognised candidate STOPS the build instead of minting a shifted id
// (scripts/lib/questionIdentity.mjs). A real read-only export was then proved twice, byte for
// byte, and shipped: commit f3f0901 on 2026-09-01, the first honest export since seed 75.
//
// The 2026-09-02 deploy still described the blocker as standing. It was not; it had been closed
// the day before, and an export had already shipped through it. That is the failure this module
// prevents: a claim about the present that nothing re-checks.
//
// THE RULE
// ────────
//   1. The ordinary path is to RUN the export. Nothing here is needed for that.
//   2. Skipping requires a CURRENT WRITTEN REASON and EXPLICIT OWNER APPROVAL, every time.
//      No standing permission, no "as previously agreed", no inherited justification.
//   3. A reason that CLAIMS the export is blocked must name CURRENT evidence — the failing run.
//      An unevidenced "the export is blocked" is exactly how the closed qc-pin claim survived
//      five deploys, so it is refused by name.
//   4. A CERTIFIED or FULL floor means the diff touches certified data. Such a deploy may never
//      skip the export SILENTLY; with a reason and approval it is allowed and reported loudly.
//
// The decision is a pure function so it can be tested without a deploy, and both
// preflight-deploy.mjs (which enforces it) and batch-status.mjs (which reports it) call the same
// one — they cannot disagree about what the rules are.
import fs from 'node:fs'
import path from 'node:path'

/** Written by export-firestore.mjs on success, and by deploy-web.sh when a deploy contains it. */
export const LEDGER = '.export-ledger.json'

/** Minimum length for a reason to count as written rather than gestured at. */
export const MIN_REASON = 20

/** A reason that asserts the export cannot run. These claims need current evidence attached. */
const CLAIMS_BLOCKED = /\b(blocked|blocker|broken|fail(s|ed|ing)?|abort(s|ed|ing)?|refus(e|es|ed)|cannot run|can't run|unavailable)\b/i

/** The specific closed claim. Naming it is not enough on its own, ever again. */
const CLOSED_QC_PIN = /\bqc[-\s]?pin\b|\bqc-h\b.*\bqc-f\b/i

export const rankOfProfile = p => ['fast', 'standard', 'certified', 'full'].indexOf(p)

/**
 * Decide what a deploy is allowed to do about the export.
 *
 * @param {object} o
 * @param {boolean} o.skipExport        SKIP_EXPORT=1 was set
 * @param {string}  o.required          the validation floor this diff earns ('fast'..'full')
 * @param {string}  [o.reason]          SKIP_EXPORT_REASON
 * @param {string}  [o.approvedBy]      SKIP_EXPORT_APPROVED_BY
 * @param {string}  [o.evidence]        SKIP_EXPORT_EVIDENCE — a current failing run
 * @returns {{allow: boolean, status: string, headline: string, why: string[]}}
 *   status is one of:
 *     'ran'                 the export will run — the ordinary path
 *     'contained-ui'        approved containment on a UI-only diff; the export was unnecessary
 *     'contained-certified' approved containment on a data-bearing diff; allowed, reported loudly
 *     'refused'             the paperwork is missing or stale; the deploy stops
 */
export function decideExport({ skipExport, required, reason = '', approvedBy = '', evidence = '' } = {}) {
  const why = []
  if (!skipExport) {
    return {
      allow: true,
      status: 'ran',
      headline: 'export runs — the ordinary path',
      why: ['SKIP_EXPORT is not set, so the deploy re-dumps Firestore into public/data.'],
    }
  }

  const r = String(reason).trim()
  const by = String(approvedBy).trim()
  const ev = String(evidence).trim()
  const dataBearing = rankOfProfile(required) >= rankOfProfile('certified')

  if (!by) why.push('SKIP_EXPORT_APPROVED_BY is empty — no owner approved this skip.')
  if (!r) why.push('SKIP_EXPORT_REASON is empty — a skip needs a written reason, this deploy, in words.')
  else if (r.length < MIN_REASON) why.push(`SKIP_EXPORT_REASON is ${r.length} characters — under the ${MIN_REASON} needed to be a reason rather than a gesture.`)

  if (r && CLOSED_QC_PIN.test(r) && !ev) {
    why.push('The reason cites the qc-pin export blocker. That blocker was CLOSED by the '
      + 'question-identity registry (Stage B) and an export shipped through it on 2026-09-01 at '
      + 'f3f0901. If the export is failing again it is a NEW fault: put the current failing run in '
      + 'SKIP_EXPORT_EVIDENCE.')
  } else if (r && CLAIMS_BLOCKED.test(r) && !ev) {
    why.push('The reason claims the export cannot run, but names no current evidence. '
      + 'Put the failing run — command, date, the error it printed — in SKIP_EXPORT_EVIDENCE.')
  }

  if (why.length) {
    return {
      allow: false,
      status: 'refused',
      headline: dataBearing
        ? 'REFUSED — a data-bearing deploy cannot skip the export on this paperwork'
        : 'REFUSED — SKIP_EXPORT=1 without a current reason and owner approval',
      why,
    }
  }

  return dataBearing
    ? {
      allow: true,
      status: 'contained-certified',
      headline: 'CONTAINED — a DATA-BEARING deploy is skipping the export, with approval',
      why: [
        `The diff earns a ${required.toUpperCase()} floor, so it touches certified data.`,
        `Reason: ${r}`,
        `Approved by: ${by}`,
        ...(ev ? [`Evidence: ${ev}`] : []),
        'The certification manifest gate still runs and still refuses a stale bundle.',
      ],
    }
    : {
      allow: true,
      status: 'contained-ui',
      headline: 'export unnecessary for this approved UI-only containment',
      why: [
        `The diff earns a ${required.toUpperCase()} floor — no certified data path changed.`,
        `Reason: ${r}`,
        `Approved by: ${by}`,
        ...(ev ? [`Evidence: ${ev}`] : []),
      ],
    }
}

/** Read the deploy-local export ledger. Untracked, like the validation receipt. */
export function readLedger(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, LEDGER), 'utf8')) } catch { return null }
}

/**
 * Record what actually happened to the export.
 *
 * Only a real export run writes `ran: true` — the record cannot be produced by describing one.
 */
export function writeLedger(root, entry) {
  const prior = readLedger(root)
  const next = {
    ...entry,
    at: new Date().toISOString(),
    // The last run that genuinely dumped Firestore, carried forward across contained deploys so
    // "when did an export last actually happen" survives a run of skips.
    lastRealExport: entry.ran ? { at: new Date().toISOString(), commit: entry.commit ?? null }
      : (prior?.lastRealExport ?? null),
  }
  fs.writeFileSync(path.join(root, LEDGER), JSON.stringify(next, null, 2) + '\n')
  return next
}
