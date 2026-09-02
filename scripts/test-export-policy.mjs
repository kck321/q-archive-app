// A DEPLOY CANNOT SKIP THE FIRESTORE EXPORT ON A JUSTIFICATION NOBODY RE-CHECKED.
//
// The incident: `SKIP_EXPORT=1` shipped five consecutive deploys (2026-08-27, 08-28, 08-29,
// 08-30, 09-02), each citing the qc-pin export blocker. The blocker was real when first recorded
// — export-firestore.mjs aborted because the Firestore dump carried hash-id question rows on
// #1915/#1944 that no longer prior-matched local questions.json, so the POSITIONALLY minted qc-
// ids shifted (qc-h -> qc-f) and the pinned literal-spans QA refused rather than land a reviewed
// ruling on the wrong drop.
//
// Stage B removed the whole mechanism: identity/question-identity-registry.json became the
// identity authority for all 6,643 certified questions and every positional allocator was deleted
// with no fallback. A real read-only export was then proved twice byte-for-byte and SHIPPED —
// commit f3f0901, 2026-09-01, the first honest export since seed 75.
//
// The 2026-09-02 deploy nevertheless described the blocker as standing. Nothing was wrong with
// the export; what was wrong was that a claim about the present had no mechanism re-checking it.
//
// These assertions are on the pure decision in scripts/lib/exportPolicy.mjs, so they cost no
// deploy and no Firestore read. The wiring — preflight-deploy.mjs enforcing the verdict,
// batch-status.mjs reporting the same one — is asserted by reading those files, because a rule
// only one caller obeys is not a rule.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decideExport, MIN_REASON } from './lib/exportPolicy.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const results = []
let pass = 0, fail = 0
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }

const GOOD_REASON = 'Firestore free-tier read quota is exhausted until the 00:00 PT window; the bundle on disk is the certified one.'
const OWNER = 'Heath (owner, in chat)'

// ── 1. The ordinary path needs nothing ──────────────────────────────────────────────────────────
for (const required of ['fast', 'standard', 'certified', 'full']) {
  const v = decideExport({ skipExport: false, required })
  check(`1. an ordinary ${required} deploy runs the export`, v.allow && v.status === 'ran')
}

// ── 2. No standing permission: a bare skip is refused at EVERY floor ────────────────────────────
for (const required of ['fast', 'standard', 'certified', 'full']) {
  const v = decideExport({ skipExport: true, required })
  check(`2. SKIP_EXPORT with no paperwork is refused at ${required}`, !v.allow && v.status === 'refused')
}

// ── 3. Both halves are required, not either ─────────────────────────────────────────────────────
check('3a. a reason without owner approval is refused',
  decideExport({ skipExport: true, required: 'standard', reason: GOOD_REASON }).allow === false)
check('3b. owner approval without a written reason is refused',
  decideExport({ skipExport: true, required: 'standard', approvedBy: OWNER }).allow === false)
check('3c. a gesture is not a reason',
  decideExport({ skipExport: true, required: 'standard', reason: 'quota', approvedBy: OWNER }).allow === false)
check(`3d. the reason floor is ${MIN_REASON} characters`,
  decideExport({ skipExport: true, required: 'standard', reason: 'x'.repeat(MIN_REASON - 1), approvedBy: OWNER }).allow === false
  && decideExport({ skipExport: true, required: 'standard', reason: 'x'.repeat(MIN_REASON), approvedBy: OWNER }).allow === true)
check('3e. whitespace is not approval',
  decideExport({ skipExport: true, required: 'standard', reason: GOOD_REASON, approvedBy: '   ' }).allow === false)

// ── 4. THE CLOSED BLOCKER CANNOT BE RESURRECTED BY NAMING IT ────────────────────────────────────
// This is the exact sentence the five deploys shipped on. It must not work again by itself.
const STALE = 'the qc-pin export blocker still stands, as on the previous four deploys'
const staleVerdict = decideExport({ skipExport: true, required: 'certified', reason: STALE, approvedBy: OWNER })
check('4a. citing the qc-pin blocker with no current evidence is refused',
  !staleVerdict.allow, staleVerdict.status)
check('4b. the refusal says the blocker is closed and names the export that shipped through it',
  staleVerdict.why.some(w => /CLOSED/.test(w) && /f3f0901/.test(w)))
check('4c. the same claim WITH a current failing run is allowed — a new fault is a real reason',
  decideExport({ skipExport: true, required: 'certified', reason: STALE, approvedBy: OWNER,
    evidence: 'node scripts/export-firestore.mjs 2026-09-02 14:10 — aborted at materialize-literal-spans, log attached' }).allow === true)

// A general "the export is broken" needs evidence too, not only the qc-pin wording.
check('4d. any claim that the export cannot run needs current evidence',
  decideExport({ skipExport: true, required: 'standard', approvedBy: OWNER,
    reason: 'the export is failing again on this machine, same as before' }).allow === false)
check('4e. a reason that claims nothing about the export needs no evidence',
  decideExport({ skipExport: true, required: 'standard', approvedBy: OWNER, reason: GOOD_REASON }).allow === true)

// ── 5. A data-bearing deploy can never skip the export SILENTLY ─────────────────────────────────
const uiOnly = decideExport({ skipExport: true, required: 'standard', reason: GOOD_REASON, approvedBy: OWNER })
const dataBearing = decideExport({ skipExport: true, required: 'certified', reason: GOOD_REASON, approvedBy: OWNER })
const full = decideExport({ skipExport: true, required: 'full', reason: GOOD_REASON, approvedBy: OWNER })
check('5a. an approved UI-only skip reports "export unnecessary"',
  uiOnly.allow && uiOnly.status === 'contained-ui')
check('5b. a certified diff that skips is reported as data-bearing containment, not as routine',
  dataBearing.allow && dataBearing.status === 'contained-certified')
check('5c. a full diff is treated as data-bearing too',
  full.allow && full.status === 'contained-certified')
check('5d. the data-bearing headline says a DATA-BEARING deploy is skipping the export',
  /DATA-BEARING/.test(dataBearing.headline))
check('5e. an unapproved certified skip is refused, not merely reported',
  decideExport({ skipExport: true, required: 'certified' }).allow === false)

// The three states the owner is promised are distinguishable, and distinct.
const statuses = new Set([
  decideExport({ skipExport: false, required: 'certified' }).status,
  uiOnly.status, dataBearing.status,
  decideExport({ skipExport: true, required: 'certified' }).status,
])
check('5f. the four verdicts are four distinct states', statuses.size === 4, [...statuses].join(', '))

// ── 6. THE WIRING. A rule only one caller obeys is not a rule. ──────────────────────────────────
const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8') } catch { return '' } }
const preflight = read('scripts/preflight-deploy.mjs')
const status = read('scripts/batch-status.mjs')
const deploy = read('scripts/deploy-web.sh')
const exporter = read('scripts/export-firestore.mjs')

check('6a. preflight-deploy.mjs asks exportPolicy for the verdict',
  /from '\.\/lib\/exportPolicy\.mjs'/.test(preflight) && /decideExport\(/.test(preflight))
check('6b. preflight reads SKIP_EXPORT, the reason, and the approval from the environment',
  /SKIP_EXPORT_REASON/.test(preflight) && /SKIP_EXPORT_APPROVED_BY/.test(preflight)
  && /process\.env\.SKIP_EXPORT\s*===\s*'1'/.test(preflight))
check('6c. preflight FAILS the deploy on the verdict rather than only printing it',
  /t\('the export policy allows this deploy', exportVerdict\.allow/.test(preflight))
check('6d. batch-status.mjs reports the same verdict from the same function',
  /from '\.\/lib\/exportPolicy\.mjs'/.test(status) && /decideExport\(/.test(status))
check('6e. batch-status distinguishes all four states by name',
  ['ran', 'contained-ui', 'contained-certified', 'refused'].every(s => status.includes(`'${s}'`)))
check('6f. batch-status reports the most recent authoritative export',
  /lastRealExport/.test(status) && /f3f0901/.test(status))
check('6g. only a real export run writes the ledger with ran: true',
  /writeLedger\(root, \{ ran: true/.test(exporter))
check('6h. the containment path records what was approved',
  /writeLedger/.test(deploy) && /ran: false/.test(deploy))
check('6i. deploy-web.sh no longer describes SKIP_EXPORT as a standing allowance',
  /EVERY USE NEEDS ITS OWN CURRENT REASON AND OWNER APPROVAL/.test(deploy))

// ── 7. The closed blocker is not described as current anywhere a session reads as instruction ───
// DEVLOG.md is history and is deliberately not read here. These three are read as CURRENT state.
const ACTIVE_DOCS = ['NEXT-SESSION-HANDOFF.md', 'PROJECT_CONTEXT.md', 'audit/CURRENT-STATE.md']
// Broad on purpose. The first version of this pattern matched PROJECT_CONTEXT's heading and
// MISSED the handoff's 'The Firestore export is BLOCKED' three lines away — a false pass is
// worse than no check, because it is the one a session trusts.
const STALE_CLAIM = /(?:firestore )?export (?:path )?(?:is |currently |remains |still )*block(?:ed|er)|export (?:path )?blocked|blocked (?:on|by) the qc-pin|qc-pin (?:export )?blocker|the export (?:path )?(?:currently |now )?fails|export (?:is |remains )?disabled/i
for (const d of ACTIVE_DOCS) {
  const t = read(d)
  if (!t) { check(`7. ${d} — absent`, true); continue }
  const hits = t.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => STALE_CLAIM.test(l))
    // A line that marks the claim CLOSED/SUPERSEDED is a correction, not a live instruction.
    .filter(([, l]) => !/CLOSED|SUPERSEDED|no longer|was closed|historical/i.test(l))
  check(`7. ${d} does not describe the export path as currently blocked`, hits.length === 0,
    hits.map(([n]) => `line ${n}`).join(', '))
}

console.log('\nEXPORT POLICY\n')
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(64)}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) {
  console.error('\n[X] a deploy could skip the Firestore export without a current reason and owner approval,')
  console.error('    or a closed blocker is being described as current. Both are how the last five skips happened.\n')
  process.exit(1)
}
console.log('')
