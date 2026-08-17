// Stamp the built bundle with WHAT it is, so production can be checked instead of assumed.
//
//   node scripts/write-build-info.mjs        (run by deploy-web.sh, after vite build + sw stamp)
//
// THE QUESTION THIS ANSWERS. "Is the site live yet?" has been answered three ways, all bad: by
// waiting a fixed minute, by hard-refreshing and looking, and by running a twelve-minute browser
// suite that would have passed against the OLD bundle too. GitHub's CDN serves the previous build
// for a few minutes after a push, so "the page loaded and looked right" is not evidence that the
// change shipped — and on 17 Aug 2026 a Pages build sat queued for 45 minutes while every local
// check was green.
//
// A one-file stamp makes it a fact: the deploy records the commit, the seed, the certification
// manifest's hash and the service-worker cache version, and verify-live.mjs asks production for the
// same file. Matching means the deployed bytes are the bytes that were validated. Not matching
// names exactly what is stale.
//
// It is tiny (<400 bytes), no app route fetches it, and it is the "live-integrity verification"
// hook the process review asked to keep.
//
// WHY IT NOW REFUSES A DIRTY TREE. The stamp's whole job is to say "the deployed bytes are THESE
// bytes". Written from a working copy with uncommitted changes it says the opposite of the truth:
// it records a commit whose tree is not what vite just built, and the previous stamp on disk did
// exactly that — `"dirty": true`, pointing at b72e920, describing a bundle b72e920 does not
// contain. verify-live.mjs could then only report the failure after the fact, from production.
// A `dirty` FLAG is a description of the problem; refusing to write is the fix. So the stamp
// records `commit` AND `tree` — `git rev-parse HEAD^{tree}`, the id of the exact bytes — and it is
// only allowed to exist when the working copy has nothing the commit does not.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { builtSeedVersion } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
if (!fs.existsSync(DIST)) { console.error('dist/ does not exist — build first.'); process.exit(1) }

const sh = c => { try { return execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim() } catch { return null } }

// ── THE WORKING TREE MUST BE CLEAN ────────────────────────────────────────────────────────────
// No ALLOW_DIRTY here, deliberately. An override would let the one file whose purpose is to be
// trustworthy be written by the one path where it cannot be.
const dirty = (sh('git status --porcelain') ?? '').split('\n').filter(Boolean)
if (dirty.length) {
  console.error(`\n  REFUSED — cannot stamp a build from a working tree with ${dirty.length} uncommitted change(s).`)
  for (const d of dirty.slice(0, 10)) console.error(`      ${d}`)
  if (dirty.length > 10) console.error(`      … and ${dirty.length - 10} more`)
  console.error(`\n  build-info.json exists to state which committed bytes are live. From here it could`)
  console.error(`  only name a commit that does not contain what was built — which is what the stamp`)
  console.error(`  already on disk does ("dirty": true). Commit these, then deploy.\n`)
  process.exit(1)
}
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex')

const manifestPath = path.join(ROOT, 'audit', 'certification-manifest.json')
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null

// The service worker's cache version, as deploy-web.sh has just stamped it. A returning reader is
// only released from the old cache when this changes, so it belongs in the record of the deploy.
const swPath = path.join(DIST, 'sw.js')
const swVersion = fs.existsSync(swPath)
  ? (fs.readFileSync(swPath, 'utf8').match(/const CACHE_VERSION = '([^']*)'/) ?? [])[1] ?? null
  : null

// The hashed asset filenames index.html points at. If production serves a different set, it is
// serving a different build — no browser gate needed to say so.
const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const assets = [...indexHtml.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(m => m[1]).sort()

const info = {
  builtAt: new Date().toISOString(),
  commit: sh('git rev-parse HEAD'),
  commitShort: sh('git rev-parse --short HEAD'),
  branch: sh('git rev-parse --abbrev-ref HEAD'),
  // The id of the exact bytes this bundle was built from. The commit says WHICH commit; the tree
  // says WHAT WAS IN IT, and it is the value scripts/lib/pipeline.mjs computes for the working copy
  // at validation time — so "validated", "committed" and "deployed" are one comparable value.
  tree: sh('git rev-parse HEAD^{tree}'),
  // Always false now: the check above is the only way to reach this line. Kept because
  // verify-live.mjs asserts on it, and an assertion that can never fire is still the assertion
  // that would fire if this guard were ever removed.
  dirty: false,
  seed: builtSeedVersion(ROOT),
  certifiedAt: manifest?.certifiedAt ?? null,
  manifestSha: manifest ? sha(fs.readFileSync(manifestPath)) : null,
  swVersion,
  assets,
}

fs.writeFileSync(path.join(DIST, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`)
console.log(`Wrote dist/build-info.json — commit ${info.commitShort}, tree ${String(info.tree).slice(0, 12)}, seed ${info.seed}, sw ${info.swVersion}`)
