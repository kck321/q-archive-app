// ANTHROPIC IS REMOVED FROM q-app, PERMANENTLY, AND CANNOT COME BACK BY ACCIDENT.
//
// Owner ruling of 2026-09-02: the archive is to hold no Anthropic API key in any form, and no
// replacement key will be issued. The exposed key is revoked at the provider. What was removed:
// the browser client (src/lib/claude.ts), its `dangerouslyAllowBrowser` constructor, the dev
// server's /anthropic-proxy and the guard written for it, the Tauri `get_anthropic_key` command
// and its anthropic_key.txt lookup, the @anthropic-ai/sdk dependency, and every key entry in the
// environment templates.
//
// The danger this test exists for is not a deliberate reversal — it is a partial one. A single
// `import Anthropic` restored for "just one editorial helper" pulls the SDK back into the bundle
// and re-opens a credential pathway that has already leaked once, and the leak was silent: Vite's
// dev transform inlines the WHOLE import.meta.env into every module, so a VITE_-prefixed key is
// served to the browser inside files that never mention it. So this fails closed, on the ACTIVE
// runtime and configuration surface only.
//
// SCOPE, deliberately: DEVLOG.md, the QUESTION-IDENTITY-STABILIZATION audit records, and the
// certified data under public/data are HISTORY. They describe the incident and the removal
// accurately and must keep saying so — an accurate record of a security event is evidence, not a
// regression. Nothing under those paths is read here.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const results = []
let pass = 0, fail = 0
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }

const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8') } catch { return null } }
const exists = p => fs.existsSync(path.join(ROOT, p))

// Walk a directory for source files, skipping the build output and dependencies.
function walk(rel, exts, out = []) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'target' || e.name === 'dist' || e.name.startsWith('.')) continue
    const r = `${rel}/${e.name}`
    if (e.isDirectory()) walk(r, exts, out)
    else if (exts.some(x => e.name.endsWith(x))) out.push(r)
  }
  return out
}

// ── 1. no dependency ────────────────────────────────────────────────────────────────────────────
const pkgRaw = read('package.json') ?? '{}'
const pkg = JSON.parse(pkgRaw)
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.optionalDependencies ?? {}), ...(pkg.peerDependencies ?? {}) }
const anthropicDeps = Object.keys(deps).filter(d => /@anthropic-ai|anthropic/i.test(d))
check('package.json declares no Anthropic dependency', anthropicDeps.length === 0, anthropicDeps.join(', '))

const lock = read('package-lock.json')
check('package-lock.json resolves no Anthropic package', lock !== null && !/@anthropic-ai\//.test(lock))

check('node_modules holds no orphaned @anthropic-ai package', !exists('node_modules/@anthropic-ai'))

// ── 2. no client in the application source ──────────────────────────────────────────────────────
const SRC = walk('src', ['.ts', '.tsx', '.mts', '.js', '.jsx'])
check('src/ has files to check', SRC.length > 0, `${SRC.length} files`)

const offenders = (files, re) => files.filter(f => re.test(read(f) ?? ''))

check('no Anthropic SDK import anywhere in src/',
  offenders(SRC, /@anthropic-ai\/sdk/).length === 0,
  offenders(SRC, /@anthropic-ai\/sdk/).join(', '))

check('no module imports a Claude/Anthropic client from src/lib',
  offenders(SRC, /from\s+['"][^'"]*\/claude['"]|import\(\s*['"][^'"]*\/claude['"]\s*\)/).length === 0,
  offenders(SRC, /from\s+['"][^'"]*\/claude['"]|import\(\s*['"][^'"]*\/claude['"]\s*\)/).join(', '))

check('src/lib/claude.ts does not exist', !exists('src/lib/claude.ts'))

// The constructor flag that put a live key into browser JavaScript. Nothing may set it again.
check('no dangerouslyAllowBrowser in src/',
  offenders(SRC, /dangerouslyAllowBrowser/).length === 0,
  offenders(SRC, /dangerouslyAllowBrowser/).join(', '))

check('no `new Anthropic(` construction in src/',
  offenders(SRC, /new\s+Anthropic\s*\(/).length === 0,
  offenders(SRC, /new\s+Anthropic\s*\(/).join(', '))

// ── 3. no key in the active environment surface ─────────────────────────────────────────────────
// .env is untracked and machine-local, so it is checked when present and skipped when absent.
const ENV_FILES = ['.env', '.env.example', '.env.production', '.env.public', '.env.local']
const KEY_NAME = /\b(VITE_)?ANTHROPIC_API_KEY\b/
for (const f of ENV_FILES) {
  const t = read(f)
  if (t === null) { check(`${f} — absent, nothing to declare`, true); continue }
  check(`${f} declares no Anthropic key variable`, !KEY_NAME.test(t))
  check(`${f} carries no ANTHROPIC_BASE_URL`, !/\bANTHROPIC_BASE_URL\b/.test(t))
}

// A complete key token must never sit in a template, a script, or the app source.
const KEY_TOKEN = /sk-ant-[A-Za-z0-9]+-[A-Za-z0-9_-]{30,}/
const SCRIPTS = walk('scripts', ['.mjs', '.js', '.ts', '.sh'])
const tokenFiles = [...ENV_FILES, ...SRC, ...SCRIPTS, 'vite.config.ts', 'package.json']
  .filter(f => read(f) !== null && f !== 'scripts/test-no-anthropic-integration.mjs')
  .filter(f => KEY_TOKEN.test(read(f)))
check('no complete Anthropic key token in any active file', tokenFiles.length === 0, tokenFiles.join(', '))

// ── 4. no dev proxy ─────────────────────────────────────────────────────────────────────────────
const vite = read('vite.config.ts')
check('vite.config.ts exists', vite !== null)
check('vite.config.ts declares no /anthropic-proxy route', vite !== null && !/['"]\/anthropic-proxy['"]|\/anthropic-proxy/.test(vite))
check('vite.config.ts reads no ANTHROPIC_API_KEY', vite !== null && !KEY_NAME.test(vite))
check('no /anthropic-proxy reference anywhere in src/',
  offenders(SRC, /\/anthropic-proxy/).length === 0,
  offenders(SRC, /\/anthropic-proxy/).join(', '))
check('the Anthropic proxy guard module is gone', !exists('scripts/lib/anthropicProxyGuard.mjs'))

// ── 5. no desktop key pathway ───────────────────────────────────────────────────────────────────
const RUST = walk('src-tauri/src', ['.rs'])
check('src-tauri has Rust sources to check', RUST.length > 0, `${RUST.length} files`)
check('no get_anthropic_key command in the Tauri app',
  offenders(RUST, /get_anthropic_key/).length === 0,
  offenders(RUST, /get_anthropic_key/).join(', '))
check('the Tauri app reads no ANTHROPIC_API_KEY env var',
  offenders(RUST, /ANTHROPIC_API_KEY/).length === 0,
  offenders(RUST, /ANTHROPIC_API_KEY/).join(', '))
check('the Tauri app looks for no anthropic_key.txt',
  offenders(RUST, /anthropic_key\.txt/).length === 0,
  offenders(RUST, /anthropic_key\.txt/).join(', '))
check('no invoke("get_anthropic_key") caller in src/',
  offenders(SRC, /get_anthropic_key/).length === 0,
  offenders(SRC, /get_anthropic_key/).join(', '))

// ── 6. no AI control the owner could click ──────────────────────────────────────────────────────
// A button whose handler is gone is worse than no button: it looks like a working feature and
// fails at the click. These are the exact labels the removed controls carried.
const DEAD_CONTROLS = [
  'Detect Questions', 'Detect Requests', 'Analyze Post', 'Classify Status',
  'Research news', 'Generate Chapters with Claude', 'Run All Scans',
  'Scan Claims', 'Scan Requests', 'Classify Questions', 'Scan Threads',
]
const TSX = SRC.filter(f => f.endsWith('.tsx'))
const live = []
for (const f of TSX) {
  const t = read(f) ?? ''
  for (const label of DEAD_CONTROLS) if (t.includes(label)) live.push(`${f}: "${label}"`)
}
check('no removed AI control is still rendered', live.length === 0, live.join(' · '))

// ── 7. no key material or SDK in a built bundle ─────────────────────────────────────────────────
// dist/ is only present after a build. When it is, it is the thing the public actually receives,
// so it is the most important surface of all — and it is checked byte-wise, not by filename.
const BUNDLE_BANNED = [
  ['sk-ant- key material', KEY_TOKEN],
  ['ANTHROPIC_API_KEY', /\bANTHROPIC_API_KEY\b/],
  ['VITE_ANTHROPIC_API_KEY', /\bVITE_ANTHROPIC_API_KEY\b/],
  ['/anthropic-proxy', /\/anthropic-proxy/],
  ['@anthropic-ai/sdk', /@anthropic-ai\/sdk/],
  ['dangerouslyAllowBrowser', /dangerouslyAllowBrowser/],
]
const distDir = process.env.QDROPS_DIST ?? 'dist'
if (!exists(distDir)) {
  check(`${distDir}/ — not built in this run, bundle assertions skipped`, true)
} else {
  const assets = walk(distDir, ['.js', '.css', '.html', '.json', '.map'])
  check(`${distDir}/ holds built assets to check`, assets.length > 0, `${assets.length} files`)
  for (const [label, re] of BUNDLE_BANNED) {
    const hits = assets.filter(f => re.test(read(f) ?? ''))
    check(`no ${label} in the ${distDir} asset graph`, hits.length === 0, hits.slice(0, 4).join(', '))
  }
}

console.log('\nNO ANTHROPIC INTEGRATION\n')
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(62)}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) {
  console.error('\n[X] an Anthropic integration or credential pathway is back in q-app.')
  console.error('    Owner ruling 2026-09-02: removed permanently, no replacement key. Revert the reintroduction.\n')
  process.exit(1)
}
console.log('')
