// Refuse to publish from a state git cannot reproduce.
//
// Production was deployed more than once from a working tree carrying uncommitted artifact
// changes, which meant no commit described what was live and git could not be used to recover
// it. This runs inside deploy-web.sh, before anything is pushed.
//
//   node scripts/preflight-deploy.mjs
//
// IT ALSO CHECKS THAT SOMETHING PROVED THESE BYTES. "It validated" and "this is what is being
// published" used to be two claims joined by memory, and memory is what fails at the end of a long
// session. validate.mjs writes a receipt naming the profile, whether the apply chain ran, and the
// git TREE of the working copy it proved. Here that tree is recomputed and compared, so a deploy
// can only carry bytes some run actually covered — at a profile the diff allows.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readReceipt, worktreeTree, requiredProfile, rankOf, RECEIPT } from './lib/pipeline.mjs'
import { decideExport } from './lib/exportPolicy.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sh = c => execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim()
let fail = 0
const t = (label, ok, detail = '') => { if (!ok) fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)} ${detail}`) }

console.log('\nPRE-FLIGHT\n')

// 1. Nothing uncommitted.
//
// ALLOW_DIRTY USED TO LIVE HERE AND HAS BEEN REMOVED. It let a deploy past this gate, and the next
// thing downstream — write-build-info.mjs — cannot honestly stamp a dirty tree and now refuses
// outright. An override that only moves the failure four minutes later, after the build, is not an
// escape hatch. Commit the change; that is the whole of the requirement.
const dirty = sh('git status --porcelain').split('\n').filter(Boolean)
t('working tree is clean', dirty.length === 0,
  dirty.length ? `${dirty.length} uncommitted — commit first` : 'clean')
if (dirty.length) for (const d of dirty.slice(0, 6)) console.log(`          ${d}`)

// 2. No other agent mid-certification.
const LOCK = path.join(ROOT, '.repo-lock.json')
if (fs.existsSync(LOCK)) {
  const l = JSON.parse(fs.readFileSync(LOCK, 'utf8'))
  const age = Math.round((Date.now() - new Date(l.acquiredAt).getTime()) / 60000)
  t('no competing writer', age >= 90 || l.pid === process.ppid, `held ${age} min by pid ${l.pid} — ${l.reason}`)
} else t('no competing writer', true, 'unlocked')

// 3. The bundle on disk is the certified one.
try { execSync('node scripts/certification-manifest.mjs --verify', { cwd: ROOT, stdio: 'pipe' }); t('certification manifest verifies', true) }
catch { t('certification manifest verifies', false, 'artifacts drifted from the manifest') }

// 4. SOMETHING PROVED THESE EXACT BYTES, AT A PROFILE THIS DIFF ALLOWS, WITH THE CHAIN.
const receipt = readReceipt(ROOT)
const need = requiredProfile(ROOT)
const tree = worktreeTree(ROOT)

if (!receipt) {
  t('a validation receipt exists', false,
    `no ${RECEIPT} — run: node scripts/validate.mjs --profile ${need.required}`)
} else {
  // The tree, not the commit: validation runs before the commit, and committing the same bytes
  // produces the same tree. A mismatch means something changed after the proof — which is exactly
  // the "one more small fix, then ship" that this gate exists to catch.
  t('the receipt covers the bytes being published', Boolean(tree) && receipt.tree === tree,
    receipt.tree === tree ? `tree ${String(tree).slice(0, 12)}`
      : `validated ${String(receipt.tree).slice(0, 12)}, publishing ${String(tree).slice(0, 12)} — re-run validate.mjs`)

  t(`the receipt's profile meets this diff's floor (${need.required})`,
    rankOf(receipt.profile) >= rankOf(need.required),
    `validated at ${receipt.profile}${rankOf(receipt.profile) >= rankOf(need.required) ? '' : ` — re-run at ${need.required}`}`)

  // A certified change is proved by the apply chain run twice. --no-chain is already refused at
  // certified/full inside validate.mjs; this is the same rule stated where the deploy can see it,
  // so a fast/standard receipt taken with --no-chain can never be stretched to cover one.
  const needsChain = rankOf(need.required) >= rankOf('certified')
  t('the apply chain ran (idempotence proved)', !needsChain || receipt.chain === true,
    needsChain ? (receipt.chain ? 'chain ran twice' : '--no-chain receipt cannot publish a certified change')
      : 'not required at this profile')
}

// 5. SKIPPING THE EXPORT IS CONTAINMENT, AND CONTAINMENT IS DECIDED HERE - NOT REMEMBERED.
//
// deploy-web.sh runs this BEFORE the export step, so SKIP_EXPORT is already in the environment
// and can be judged while the deploy is still refusable. Five consecutive deploys shipped on the
// same inherited justification, and it had been false for a day by the end of the run: the
// qc-pin blocker it cited was closed by the question-identity registry and an export had already
// shipped through it at f3f0901. The rules live in scripts/lib/exportPolicy.mjs, as a pure
// function, so they are tested without a deploy and batch-status.mjs reports the same verdict.
const exportVerdict = decideExport({
  skipExport: process.env.SKIP_EXPORT === '1',
  required: need.required,
  reason: process.env.SKIP_EXPORT_REASON,
  approvedBy: process.env.SKIP_EXPORT_APPROVED_BY,
  evidence: process.env.SKIP_EXPORT_EVIDENCE,
})
t('the export policy allows this deploy', exportVerdict.allow, exportVerdict.headline)
for (const line of exportVerdict.why) console.log(`          ${line}`)
if (!exportVerdict.allow) {
  console.log('')
  console.log('          Run the export instead - it is the ordinary path and it works:')
  console.log('              npm run deploy:web')
  console.log('')
  console.log('          Or, if the owner has approved containment for THIS deploy, set all of')
  console.log('          SKIP_EXPORT=1, SKIP_EXPORT_REASON and SKIP_EXPORT_APPROVED_BY on the')
  console.log('          deploy command, and SKIP_EXPORT_EVIDENCE too if the reason claims the')
  console.log('          export itself is failing.')
}
if (exportVerdict.status === 'contained-certified') {
  console.log('')
  console.log('          !! This deploy carries CERTIFIED DATA and is not re-dumping Firestore.')
  console.log('             It is allowed because it is approved and stated, never because it is quiet.')
}

console.log(fail ? `\n  ${fail} pre-flight check(s) failed — NOT publishing.\n` : '\n  pre-flight clear.\n')
process.exit(fail ? 1 : 0)
