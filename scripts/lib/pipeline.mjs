// THE PIPELINE'S SHARED MACHINERY — four things that validate.mjs, verify-live.mjs and
// preflight-deploy.mjs each need, and each used to answer for itself.
//
//   run()               spawn a gate WITHOUT a shell
//   GATES               the only scripts --only and --smoke are allowed to name
//   requiredProfile()   the weakest profile the current diff is allowed to be proved by
//   receipt             the record tying "this profile passed" to "these exact bytes"
//
// ── 1. NO SHELL ──────────────────────────────────────────────────────────────────────────────
// Every spawn here used to carry `shell: process.platform === 'win32'`, because on Windows `npx`
// is `npx.cmd` and will not spawn without one. Node 24 rightly warns about it:
//
//   [DEP0190] Passing args to a child process with shell option true can lead to security
//   vulnerabilities, as the arguments are not escaped, only concatenated.
//
// That is not theoretical here: --only takes a name from the command line and turns it into a
// path, so a shell made every gate argument a place where a `&&` or a `;` would be executed by
// cmd.exe rather than passed to the gate. The fix is to stop needing a shell at all — resolve the
// executable ourselves. `node` is `process.execPath`, and the one `npx` binary the pipeline runs
// (tsc) is a JavaScript file we can hand straight to node.
//
// ── 2. AN ALLOWLIST, NOT A PATH ──────────────────────────────────────────────────────────────
// `--only foo` used to become `scripts/foo.mjs` with no check that `foo` was a gate — so it would
// run any script in the repo, including the ones that WRITE certified artifacts, and `../` walked
// straight out of scripts/. A targeted gate is a small, closed set. It is now spelled out.
//
// ── 3. THE PROFILE IS A PROPERTY OF THE DIFF ─────────────────────────────────────────────────
// A profile chooses how much browser to buy, and the note in validate.mjs said to "pick by what
// changed". Picking is exactly the step a tired session skips: `--profile fast` is one word and
// there was nothing to say it was the wrong word for a diff that touched audit/. So the diff now
// names the floor, an explicit --profile may only go UP from it, and the default IS the floor.
//
// ── 4. THE RECEIPT ───────────────────────────────────────────────────────────────────────────
// "It validated" and "it is what got deployed" were separate claims joined by memory. The receipt
// records the profile, whether the apply chain ran, and the git TREE of the working copy that
// passed. preflight-deploy.mjs then refuses to publish bytes that no run covers.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync, execFileSync } from 'node:child_process'

export const PROFILES = ['fast', 'standard', 'certified', 'full']
export const rankOf = p => PROFILES.indexOf(p)

// ── 1. RUNNING A CHILD PROCESS, WITHOUT A SHELL ───────────────────────────────────────────────

/** `npx <bin>` for the binaries this pipeline actually runs, as a plain JS entry point. */
const NPX_BINS = {
  tsc: ['node_modules', 'typescript', 'bin', 'tsc'],
  vite: ['node_modules', 'vite', 'bin', 'vite.js'],
}

/**
 * Turn a step's argv into a (file, args) pair that spawns with no shell on every platform.
 * Anything it cannot resolve is an error rather than a silent fallback — a fallback here would be
 * a fallback back to the shell.
 */
export function resolveArgv(argvv, root) {
  const [cmd, ...rest] = argvv
  if (cmd === 'node') return [process.execPath, rest]
  if (cmd === 'npx') {
    const rel = NPX_BINS[rest[0]]
    if (!rel) throw new Error(`pipeline: no shell-free resolution for "npx ${rest[0]}". Add it to NPX_BINS.`)
    const bin = path.join(root, ...rel)
    if (!fs.existsSync(bin)) throw new Error(`pipeline: ${rest[0]} is not installed at ${bin} — run npm install.`)
    return [process.execPath, [bin, ...rest.slice(1)]]
  }
  return [cmd, rest]
}

/** Run a step to completion, inheriting stdio. No shell, ever. */
export function run(argvv, { cwd, stdio = 'inherit' } = {}) {
  const [file, args] = resolveArgv(argvv, cwd)
  return spawnSync(file, args, { cwd, stdio })
}

// ── 2. THE GATE ALLOWLIST ─────────────────────────────────────────────────────────────────────

/**
 * The gates `--only` (validate) and `--smoke` (verify-live) may name. Every one of them is
 * read-only, takes a URL and exits non-zero on failure. Adding a gate here is a deliberate act;
 * nothing else in scripts/ is reachable from a command-line argument.
 *
 * `url: 'positional'` gates take `<url> --fresh`; `url: 'flag'` gates take `--url <url>`. Passing
 * both conventions at once used to paper over the difference, which meant a typo'd gate name and
 * a gate invoked wrongly looked identical.
 */
export const GATES = {
  'alias-visibility': { file: 'scripts/test-alias-visibility.mjs', url: 'positional', what: 'a searched term shows its aliases (Analysis)' },
  'archive-alias-visibility': { file: 'scripts/test-archive-alias-visibility.mjs', url: 'positional', what: 'a searched term shows its aliases (Post Archive)' },
  'category-order': { file: 'scripts/test-category-order.mjs', url: 'positional', what: 'the badge number is the sort key on every category' },
  'entity-reconciliation': { file: 'scripts/test-entity-reconciliation.mjs', url: 'flag', what: 'the entity list reconciles at the layer the reader sees' },
  'hover-accessibility': { file: 'scripts/test-hover-accessibility.mjs', url: 'positional', what: 'every route into the hover card' },
  'inline-drop-reader': { file: 'scripts/test-inline-drop-reader.mjs', url: 'positional', what: 'the inline drop reader' },
  'month-chart': { file: 'scripts/test-month-chart-behaviour.mjs', url: 'flag', what: 'the month chart on both hosts' },
  'multiword-gloss': { file: 'scripts/test-multiword-gloss.mjs', url: 'positional', what: 'multi-word glossary terms, including the six the annotation layer splits' },
  'returning-profile': { file: 'scripts/test-returning-profile.mjs', url: 'flag', what: 'a returning/stale reader repairs itself' },
  'url-integrity': { file: 'scripts/test-url-integrity.mjs', url: 'none', what: 'a URL in a drop is one link carrying the whole address' },
  'row-evidence': { file: 'scripts/test-row-evidence.mjs', url: 'none', what: 'Pic/URL evidence chips sit beside a row without joining its certified counts' },
  'scroll-restoration': { file: 'scripts/test-scroll-restoration.mjs', url: 'none', what: 'Back returns you to where you were, at both breakpoints' },
  'section-headlines': { file: 'scripts/verify-section-headlines.mjs', url: 'flag', what: 'the certified headline figures, on the page' },
  'term-info': { file: 'scripts/test-term-info.mjs', url: 'positional', what: 'the acronym info box means the right person per drop' },
}

/** argv for a named gate, or null with the reason printed by the caller. */
export function gateArgv(name, base) {
  const g = GATES[name]
  if (!g) return null
  return g.url === 'flag'
    ? ['node', g.file, '--url', base]
    : ['node', g.file, base, '--fresh']
}

export const gateList = () => Object.entries(GATES)
  .map(([k, g]) => `    ${k.padEnd(26)} ${g.what}`).join('\n')

// ── 3. WHAT THE DIFF REQUIRES ─────────────────────────────────────────────────────────────────

/**
 * First match wins, so the table reads top-down from "this changes the machine that proves things"
 * to "this changes a colour". The `why` is printed, because a refused profile has to say what
 * forced the floor or it is just an obstacle.
 */
const RULES = [
  // full — the thing doing the proving changed, so nothing it says about itself counts until
  // every gate has run once against it.
  [/^scripts\/(validate|verify-live|verify-final|preflight-deploy|write-build-info|await-pages-build|certification-manifest|seed-fingerprint|rebuild-bundle)\.mjs$/, 'full', 'the validation/deployment pipeline itself'],
  [/^scripts\/deploy-web\.sh$/, 'full', 'the deployment script itself'],
  [/^scripts\/lib\/(pipeline|browser|chainSteps)\.mjs$/, 'full', 'a module every gate or the apply chain runs through'],
  [/^scripts\/test-[^/]+\.mjs$/, 'full', 'a browser gate — a changed gate proves nothing until the whole suite has run'],
  [/^(package\.json|package-lock\.json|vite\.config\.ts|tsconfig[^/]*\.json|index\.html|postcss\.config\.js|tailwind\.config\.js|eslint\.config\.js)$/, 'full', 'the build itself'],
  [/^public\/sw\.js$/, 'full', 'the service worker decides what every returning reader is allowed to see'],
  [/^src\/index\.css$/, 'full', 'the global stylesheet reaches every viewport and every gate'],

  // certified — the data, or the code that decides what the data means on the way to the reader.
  [/^audit\//, 'certified', 'a certified artifact'],
  [/^public\/data\//, 'certified', 'seeded data'],
  [/^src\/lib\/(localData|aliases|entities|entityHovers|glossary|glossSegments|glossOccurrence|posts|ingest)\./, 'certified', 'the seed version, an alias read path or a certified render path'],
  [/^scripts\//, 'certified', 'a script that writes or audits certified artifacts'],
  [/^src-tauri\//, 'certified', 'the desktop shell'],

  // standard — behaviour shared across pages.
  [/^src\/lib\//, 'standard', 'shared application behaviour'],
  [/^src\/(App|main|types|firebase)\.tsx?$/, 'standard', 'the application shell'],
  [/^src\/pages\//, 'standard', 'a page'],

  // fast — nothing outside components, styles and prose.
  [/^src\/components\//, 'fast', 'a component'],
  [/^src\/assets\//, 'fast', 'a static asset'],
  [/\.(css|svg|png|jpg|jpeg|webp|ico|webmanifest)$/, 'fast', 'an asset or stylesheet'],
  [/\.md$/, 'fast', 'documentation'],
  [/^(\.gitignore|firebase\.json|firestore\.rules|\.firebaserc|q-app\.code-workspace|\.env\.[^/]+)$/, 'fast', 'repo configuration outside the bundle'],
]

// trimEnd, never trim: `git status --porcelain` puts the status in the first two columns, so a
// file modified-but-unstaged starts with a SPACE. Trimming both ends ate it and every such path
// came back with its first character missing — ".gitignore" arrived as "gitignore" and matched no
// rule, which is the quiet failure mode where a real change looks unclassified.
const git = (root, args) => {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd() }
  catch { return null }
}

export const headCommit = root => git(root, ['rev-parse', 'HEAD'])

/** True if `ref` names something this repo actually has. */
const resolves = (root, ref) => Boolean(git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]))

/**
 * The baseline is THE LAST THING PROVED LIVE, not the last commit — because the question a profile
 * answers is "what has not been proved on production yet", and three commits sitting unpushed are
 * exactly as unproven as an uncommitted edit.
 *
 *   1. the commit in dist/build-info.json — what the last deploy stamped
 *   2. origin/master — what has at least been pushed
 *   3. HEAD~1 — a fresh clone with neither
 */
export function diffBaseline(root) {
  const stamp = path.join(root, 'dist', 'build-info.json')
  if (fs.existsSync(stamp)) {
    try {
      const { commit } = JSON.parse(fs.readFileSync(stamp, 'utf8'))
      if (commit && resolves(root, commit)) return { ref: commit, why: 'the commit the last deploy stamped' }
    } catch { /* fall through */ }
  }
  if (resolves(root, 'origin/master')) return { ref: 'origin/master', why: 'the last pushed commit' }
  if (resolves(root, 'HEAD~1')) return { ref: 'HEAD~1', why: 'the previous commit' }
  return { ref: null, why: 'no baseline — treating the whole tree as changed' }
}

/** Every path that differs from the baseline, committed or not, tracked or not. */
export function changedFiles(root) {
  const { ref, why } = diffBaseline(root)
  const files = new Set()
  const committed = ref
    ? git(root, ['diff', '--name-only', `${ref}...HEAD`])
    : git(root, ['ls-files'])
  for (const f of (committed ?? '').split('\n')) {
    if (f) files.add(f)
  }
  // The working copy, including files git has never seen. Ignored paths are absent by definition.
  for (const line of (git(root, ['status', '--porcelain', '--untracked-files=all']) ?? '').split('\n')) {
    if (!line) continue
    const p = line.slice(3).trim()
    // A rename is "old -> new"; both sides changed as far as a profile is concerned.
    for (const part of p.split(' -> ')) if (part) files.add(part.replace(/^"|"$/g, ''))
  }
  return { files: [...files].sort(), baseline: ref, baselineWhy: why }
}

/**
 * The weakest profile this diff may be proved by, with the file that forced it.
 * An empty diff floors at `fast`: there is nothing to prove, but the cheap certified-data
 * invariants still run because they are in every profile.
 */
export function requiredProfile(root) {
  const { files, baseline, baselineWhy } = changedFiles(root)
  let required = 'fast'
  const reasons = []
  const unclassified = []
  for (const f of files) {
    const hit = RULES.find(([re]) => re.test(f))
    // Something the table has never seen is not automatically cheap. `standard` is the floor for
    // an unknown path, and it is named out loud so the table can be taught.
    const [, profile, why] = hit ?? [null, 'standard', 'unclassified — no rule matches this path']
    if (!hit) unclassified.push(f)
    if (rankOf(profile) > rankOf(required)) required = profile
    reasons.push({ file: f, profile, why })
  }
  const forcing = reasons.filter(r => r.profile === required)
  return { required, files, reasons, forcing, unclassified, baseline, baselineWhy }
}

// ── 4. THE RECEIPT ────────────────────────────────────────────────────────────────────────────

export const RECEIPT = '.validate-receipt.json'

/**
 * The git tree object for the WORKING COPY — the identity of the exact bytes on disk, computed
 * through a throwaway index so the real one is never touched.
 *
 * Why a tree and not "the commit": validation runs before the commit. The bytes that passed and
 * the bytes that get committed are the same bytes, and this is the id both of them have. It also
 * costs the same 2 seconds whether one file changed or a thousand, and it is what git itself would
 * compute, so line-ending normalisation cannot make an identical tree look different.
 */
export function worktreeTree(root) {
  const idx = path.join(os.tmpdir(), `qdrops-index-${crypto.randomBytes(6).toString('hex')}`)
  const env = { ...process.env, GIT_INDEX_FILE: idx }
  const q = args => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    q(['read-tree', 'HEAD'])
    q(['add', '-A'])
    return q(['write-tree'])
  } catch { return null }
  finally { try { fs.rmSync(idx, { force: true }) } catch { /* a temp file */ } }
}

export function writeReceipt(root, data) {
  fs.writeFileSync(path.join(root, RECEIPT), `${JSON.stringify(data, null, 2)}\n`)
}

export function readReceipt(root) {
  const p = path.join(root, RECEIPT)
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}
