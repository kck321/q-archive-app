// Refuse to publish from a state git cannot reproduce.
//
// Production was deployed more than once from a working tree carrying uncommitted artifact
// changes, which meant no commit described what was live and git could not be used to recover
// it. This runs inside deploy-web.sh, before anything is pushed.
//
//   node scripts/preflight-deploy.mjs
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sh = c => execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim()
let fail = 0
const t = (label, ok, detail = '') => { if (!ok) fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)} ${detail}`) }

console.log('\nPRE-FLIGHT\n')

// 1. Nothing uncommitted. ALLOW_DIRTY exists for a deliberate emergency, and says so out loud.
const dirty = sh('git status --porcelain').split('\n').filter(Boolean)
if (process.env.ALLOW_DIRTY === '1') {
  console.log(`  WARN  ALLOW_DIRTY=1 — publishing with ${dirty.length} uncommitted file(s)`)
} else {
  t('working tree is clean', dirty.length === 0,
    dirty.length ? `${dirty.length} uncommitted — commit first, or ALLOW_DIRTY=1 to override` : 'clean')
  if (dirty.length) for (const d of dirty.slice(0, 6)) console.log(`          ${d}`)
}

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

console.log(fail ? `\n  ${fail} pre-flight check(s) failed — NOT publishing.\n` : '\n  pre-flight clear.\n')
process.exit(fail ? 1 : 0)
