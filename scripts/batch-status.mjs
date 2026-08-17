// What is standing between production and HEAD — the state of the current BATCH.
//
//   node scripts/batch-status.mjs
//
// The owner directive is local-first, one deploy per batch (PROJECT_CONTEXT.md): each fix is
// implemented, proved at its smallest honest gate, committed on its own, and reviewed on the dev
// server — production moves once, at the end, carrying every commit at once.
//
// That trades deploys for BOOKKEEPING, and a hand-written status file is exactly the wrong place to
// keep it: it is written by the same session that would forget, and nothing refuses when it is
// stale. Everything printed here is derived instead — the commits from git, the baseline from the
// stamp the last deploy actually wrote, the floor from the cumulative diff through the same table
// validate.mjs and preflight-deploy.mjs read. There is nothing to update and nothing to drift.
//
// It is READ-ONLY. It runs no gate, writes no receipt, and cannot make a deploy legal — it only
// says what the deploy at the end of this batch will be asked to prove.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requiredProfile, diffBaseline, readReceipt, worktreeTree, rankOf } from './lib/pipeline.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = args => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd() }
  catch { return null }
}

// ── What is live ──────────────────────────────────────────────────────────────────────────────
// The stamp the last deploy wrote is the only local record of what production is serving. It is
// also what diffBaseline() prefers, so the batch and the floor are measured from the same point.
const stampPath = path.join(ROOT, 'dist', 'build-info.json')
const stamp = fs.existsSync(stampPath) ? JSON.parse(fs.readFileSync(stampPath, 'utf8')) : null
const baseline = diffBaseline(ROOT)

console.log('\nBATCH STATUS\n')
console.log(stamp
  ? `  live      ${stamp.commitShort}  seed ${stamp.seed}  built ${stamp.builtAt}`
  : '  live      unknown — no dist/build-info.json on disk')
console.log(`  baseline  ${baseline.ref ? baseline.ref.slice(0, 7) : 'none'} — ${baseline.why}`)

// ── The commits in the batch ──────────────────────────────────────────────────────────────────
const commits = baseline.ref
  ? (git(['log', '--oneline', '--no-decorate', `${baseline.ref}..HEAD`]) ?? '').split('\n').filter(Boolean)
  : []
console.log(`\n  ${commits.length} commit${commits.length === 1 ? '' : 's'} not yet deployed`)
for (const c of commits) console.log(`    ${c}`)
if (!commits.length) console.log('    (nothing — HEAD is what production is serving)')

// ── Uncommitted work ──────────────────────────────────────────────────────────────────────────
// A fix that is not committed is not in the batch, whatever the session remembers about it: the
// deploy pre-flight refuses a dirty tree outright, and a stash or a fresh session loses it.
const dirty = (git(['status', '--porcelain', '--untracked-files=all']) ?? '').split('\n').filter(Boolean)
console.log(dirty.length
  ? `\n  ${dirty.length} uncommitted path${dirty.length === 1 ? '' : 's'} — NOT in the batch, and the deploy pre-flight will refuse them`
  : '\n  working tree clean')
for (const d of dirty.slice(0, 12)) console.log(`    ${d}`)
if (dirty.length > 12) console.log(`    … and ${dirty.length - 12} more`)

// ── The floor the batch has earned ────────────────────────────────────────────────────────────
// The CUMULATIVE diff, not the last fix. One certified path anywhere in the batch makes the whole
// batch certified — which is the cost side of batching, and the reason it is printed before the
// owner is asked to deploy rather than discovered when validate.mjs refuses.
const need = requiredProfile(ROOT)
console.log(`\n  cumulative diff   ${need.files.length} path${need.files.length === 1 ? '' : 's'}`)
console.log(`  validation floor  ${need.required.toUpperCase()}`)
for (const r of need.forcing.slice(0, 6)) console.log(`    ${r.file}  —  ${r.why}`)
if (need.forcing.length > 6) console.log(`    … and ${need.forcing.length - 6} more at this floor`)
if (need.unclassified.length) {
  console.log(`\n  ${need.unclassified.length} path${need.unclassified.length === 1 ? '' : 's'} no rule matches (floored at standard — teach RULES in scripts/lib/pipeline.mjs):`)
  for (const f of need.unclassified.slice(0, 6)) console.log(`    ${f}`)
}

// ── Whether anything has proved these bytes yet ───────────────────────────────────────────────
const receipt = readReceipt(ROOT)
const tree = worktreeTree(ROOT)
let proved = false
if (!receipt) console.log('\n  receipt   none — nothing has proved the current bytes')
else if (receipt.tree !== tree) console.log(`\n  receipt   STALE — proved tree ${String(receipt.tree).slice(0, 7)}, on disk ${String(tree).slice(0, 7)}`)
else if (rankOf(receipt.profile) < rankOf(need.required)) console.log(`\n  receipt   ${receipt.profile} — BELOW the ${need.required} floor this batch now carries`)
else { proved = true; console.log(`\n  receipt   ${receipt.profile} on the current tree — meets the ${need.required} floor`) }

// ── What to do next ───────────────────────────────────────────────────────────────────────────
console.log('\n  next')
if (dirty.length) {
  console.log('    commit the uncommitted work — one fix per commit')
} else if (!commits.length && proved) {
  console.log('    nothing to deploy')
} else if (!proved) {
  console.log(`    node scripts/validate.mjs --profile ${need.required}`)
  console.log('    then ask the owner to deploy, with this report')
} else {
  console.log('    ask the owner to deploy, with this report')
  console.log('    on their word:  npm run deploy:web  &&  node scripts/verify-live.mjs')
}
console.log('')
