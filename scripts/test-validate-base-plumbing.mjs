// THE SERVER YOU NAME IS THE SERVER EVERY GATE USES.
//
// `validate.mjs --profile full --base http://localhost:5291` once reached twenty browser gates and
// silently missed three. url-integrity, row-evidence and scroll-restoration were declared
// `url: 'none'` in the GATES allowlist, so gateArgv built an argv with no URL in it and validate
// registered them with no BASE; each then fell back to QDROPS_BASE ?? http://localhost:5173 on its
// own. Against a stopped 5173 that cost a 48-minute run and 14 FAILs. The dangerous case is the
// other one: with any server alive on 5173 — a stale editorial server, another worktree, master —
// those three gates pass against a checkout nobody asked about, and the receipt still records the
// branch tree. A gate that reports success on work it never did is the defect Gate 1 removed from
// the cross-section audit; this asserts it cannot come back through the base.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GATES, gateArgv, resolveBase } from './lib/pipeline.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const results = []
let pass = 0, fail = 0
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }

// ── 1. resolveBase: an explicit URL outranks the environment, which outranks the default ────────
const FALLBACK = 'http://localhost:5173'
const envWith = v => (v === undefined ? {} : { QDROPS_BASE: v })
check('an explicit URL wins over QDROPS_BASE',
  resolveBase(['http://localhost:5291'], { env: envWith('http://localhost:9999') }) === 'http://localhost:5291')
check('an explicit URL wins over the literal default',
  resolveBase(['http://localhost:5291'], { env: envWith(undefined) }) === 'http://localhost:5291')
check('QDROPS_BASE is used only when no URL was passed',
  resolveBase(['--fresh'], { env: envWith('http://localhost:9999') }) === 'http://localhost:9999')
check('the default is the last resort, not the first',
  resolveBase(['--fresh'], { env: envWith(undefined) }) === FALLBACK)
check('a non-URL argument never becomes the base',
  resolveBase(['--fresh', '--full'], { env: envWith(undefined) }) === FALLBACK)
check('the first URL argument is the one used',
  resolveBase(['http://a.test', 'http://b.test'], { env: envWith(undefined) }) === 'http://a.test')
check('https is honoured too',
  resolveBase(['https://qdrops.app'], { env: envWith('http://localhost:5173') }) === 'https://qdrops.app')

// ── 2. every allowlisted gate is handed the base ─────────────────────────────────────────────────
const noneGates = Object.entries(GATES).filter(([, g]) => g.url === 'none').map(([k]) => k)
check('no gate declares url: none — every gate takes the base it is given', noneGates.length === 0,
  noneGates.length ? noneGates.join(', ') : '0 gates opt out')

const PROBE = 'http://localhost:65535'
const missing = Object.keys(GATES).filter(name => !(gateArgv(name, PROBE) ?? []).includes(PROBE))
check('gateArgv puts the base in every gate argv', missing.length === 0,
  missing.length ? missing.join(', ') : `${Object.keys(GATES).length} gates`)

// ── 3. no gate reaches for QDROPS_BASE before its own arguments ──────────────────────────────────
// A gate declares how it takes the URL. Hold each one to the shape it declares: a positional gate
// must read an http argument, a flag gate must read --url. Either way the caller's URL is what the
// gate uses, and QDROPS_BASE may not be consulted ahead of it.
const SHAPE = {
  positional: /resolveBase\(|startsWith\('http'\)/,
  flag: /indexOf\('--url'\)|at\('--url'\)|resolveBase\(/,
}
for (const [name, g] of Object.entries(GATES)) {
  const src = fs.readFileSync(path.join(ROOT, g.file), 'utf8')
  const readsEnvFirst = /const BASE = process\.env\.QDROPS_BASE/.test(src)
  const shape = SHAPE[g.url]
  check(`${name} reads the ${g.url} URL it is given`, Boolean(shape) && shape.test(src) && !readsEnvFirst,
    !shape ? `unknown url shape: ${g.url}` : readsEnvFirst ? 'reads QDROPS_BASE before argv' : '')
}

// ── 4. validate.mjs hands BASE to every gate it registers ───────────────────────────────────────
// Registrations span lines, so match each step(...) call whole rather than line by line.
const vsrc = fs.readFileSync(path.join(ROOT, 'scripts/validate.mjs'), 'utf8')
const calls = vsrc.match(/step\((?:[^()]|\([^()]*\))*\)/g) ?? []
const files = new Set(Object.values(GATES).map(g => g.file))
let registered = 0
const withoutBase = []
for (const call of calls) {
  const file = [...files].find(f => call.includes(`'${f}'`))
  if (!file) continue
  registered++
  if (!/\bBASE\b/.test(call)) withoutBase.push(file)
}
check('validate.mjs registers browser gates with BASE', withoutBase.length === 0,
  withoutBase.length ? withoutBase.join(', ') : `${registered} registrations`)
check('the three gates from the incident are registered and carry BASE',
  ['test-url-integrity.mjs', 'test-row-evidence.mjs', 'test-scroll-restoration.mjs']
    .every(f => calls.some(c => c.includes(f) && /\bBASE\b/.test(c))))

console.log('\nVALIDATE BASE PLUMBING\n')
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) { console.error('\n[X] a browser gate can still be pointed somewhere the caller did not ask for.\n'); process.exit(1) }
console.log('')
