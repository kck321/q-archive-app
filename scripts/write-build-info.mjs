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
  dirty: (sh('git status --porcelain') ?? '').length > 0,
  seed: builtSeedVersion(ROOT),
  certifiedAt: manifest?.certifiedAt ?? null,
  manifestSha: manifest ? sha(fs.readFileSync(manifestPath)) : null,
  swVersion,
  assets,
}

fs.writeFileSync(path.join(DIST, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`)
console.log(`Wrote dist/build-info.json — commit ${info.commitShort}, seed ${info.seed}, sw ${info.swVersion}`)
