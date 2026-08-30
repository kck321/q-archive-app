// The cross-section audit must never silently downgrade its own certified report.
//
//   node scripts/test-cross-section-completeness.mjs
//
// WHAT WENT WRONG.
//
// Six invariants in group 10b read the editorial review queues — entity-hover-review-queue.json,
// entity-hover-url-quarantine.json, entity-hover-withdrawn.json. Those are deliberately untracked:
// they hold thousands of unreviewed synopses about named people, and the privacy guarantee is the
// ABSENCE of the bytes rather than a permission check. A fresh worktree therefore does not have
// them, and the audit skipped all six WITHOUT SAYING SO — emitting 216 invariants, reporting
// "216/216 pass", and overwriting the committed 222-invariant report with the shorter one.
//
// Nothing was ever wrong with the generator or the artifact: given the same inputs the script
// reproduces the committed bytes exactly. What was wrong is that an incomplete run looked
// identical to a complete one and was allowed to replace it. Every count still looked perfect,
// which is the signature of this whole class of defect.
//
// So this asserts the property that actually protects the report: running the audit changes no
// tracked file, in EITHER environment. Where the queues exist it reproduces 222 byte for byte;
// where they do not it refuses to write and names what it could not check.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const JSON_ARTIFACT = path.join(OUT, 'cross-section-integrity.json')
const MD_ARTIFACT = path.join(OUT, 'cross-section-integrity.md')

const QUEUES = ['entity-hover-review-queue.json', 'entity-hover-url-quarantine.json', 'entity-hover-withdrawn.json']
const GATED = ['hover-reconciles', 'hover-no-review-leak', 'hover-queues-private',
  'hover-shared-alias-held', 'hover-withdrawn-history', 'url-excluded-from-hovers']

let pass = 0, fail = 0
const results = []
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }

const sha = f => fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null
const src = fs.readFileSync(path.join(ROOT, 'scripts', 'audit-cross-section.mjs'), 'utf8')
const committed = JSON.parse(fs.readFileSync(JSON_ARTIFACT, 'utf8'))
const haveQueues = QUEUES.every(f => fs.existsSync(path.join(OUT, f)))

// ── the committed artifact is the COMPLETE one ───────────────────────────────
check('the committed report carries the full invariant set (222)', committed.totals.invariants === 222,
  String(committed.totals.invariants))
check('the committed report has no failures', committed.totals.failed === 0, String(committed.totals.failed))
{
  const ids = new Set(committed.results.map(r => r.id))
  const missing = GATED.filter(id => !ids.has(id))
  check('all six queue-gated invariants are in the committed report', missing.length === 0, missing.join(', '))
}

// ── the generator still defines them, and records a skip when it cannot run them ──
{
  const undefinedIds = GATED.filter(id => !src.includes(`'${id}'`))
  check('the generator still defines all six', undefinedIds.length === 0, undefinedIds.join(', '))
  const notSkipped = GATED.filter(id => !new RegExp(`skip\\([^)]*'${id}'`).test(src))
  check('the generator records a SKIP for each when the queues are absent', notSkipped.length === 0, notSkipped.join(', '))
  check('the generator refuses to write a partial report',
    /if \(skipped\.length\)/.test(src) && /process\.exit\(0\)/.test(src) &&
    src.indexOf('if (skipped.length)') < src.indexOf("writeFileSync(path.join(OUT, 'cross-section-integrity.json')"))
}

// ── THE PROPERTY THAT MATTERS: running it changes no tracked file ────────────
{
  const before = { json: sha(JSON_ARTIFACT), md: sha(MD_ARTIFACT) }
  let ran = true
  try { execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'audit-cross-section.mjs')], { cwd: ROOT, stdio: 'pipe' }) }
  catch { ran = false }
  const after = { json: sha(JSON_ARTIFACT), md: sha(MD_ARTIFACT) }
  check('the audit exits cleanly', ran)
  check(`running the audit rewrites nothing (${haveQueues ? 'queues present — reproduces 222 byte for byte' : 'queues absent — refuses to write'})`,
    before.json === after.json && before.md === after.md,
    before.json === after.json ? '' : 'the artifact changed')
  const now = JSON.parse(fs.readFileSync(JSON_ARTIFACT, 'utf8'))
  check('the report on disk is still the complete one', now.totals.invariants === 222, String(now.totals.invariants))
}

console.log('\nCROSS-SECTION REPORT COMPLETENESS\n')
console.log(`  editorial queues in this checkout: ${haveQueues ? 'present' : 'absent'}\n`)
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) { console.error('\n[X] the cross-section report can be silently downgraded.\n'); process.exit(1) }
console.log('')
