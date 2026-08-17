// Wait for the deploy to actually be SERVED — and say so out loud when GitHub is the problem.
//
//   node scripts/await-pages-build.mjs [--url https://qdrops.app] [--timeout 300]
//
// A normal GitHub Pages build takes 33–75 seconds. On 17 Aug 2026 one sat queued for ~45 minutes
// with no progress and an earlier one the same day errored after 66. Re-running the deploy
// superseded it and it built in the usual minute. Nothing in the repo caused either, and nothing in
// the repo could have fixed them — but the cost was real, because the response was to keep waiting.
//
// So this polls the deployed build stamp rather than a clock, and at five minutes it stops guessing:
// it reports the build as EXTERNALLY STALLED, prints whatever the Pages API says about it, and hands
// back the one action that has ever worked. It never waits 45 minutes hoping.
//
// Exit codes:  0 the deploy is live   2 externally stalled (re-push)   1 no local stamp to compare
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const at = flag => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null }
const URL_BASE = at('--url') ?? 'https://qdrops.app'
const TIMEOUT = Number(at('--timeout') ?? 300) * 1000
const REPO = at('--repo') ?? 'kck321/q-archive-app'
const NORMAL = 75  // seconds — the top of the ordinary range, used only for the running commentary

const stampPath = path.join(ROOT, 'dist', 'build-info.json')
if (!fs.existsSync(stampPath)) {
  console.error('\n  dist/build-info.json is missing — run scripts/write-build-info.mjs during the build.\n')
  process.exit(1)
}
const expected = JSON.parse(fs.readFileSync(stampPath, 'utf8'))

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** The stamp production is currently serving. Cache-busted, because the CDN is the thing in doubt. */
async function servedStamp() {
  try {
    const res = await fetch(`${URL_BASE}/build-info.json?cb=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return { status: res.status }
    return await res.json()
  } catch (err) { return { unreachable: String(err?.message ?? err) } }
}

/** What GitHub says about the build, if `gh` is installed and authenticated. Never fatal. */
function pagesBuild() {
  try { return JSON.parse(execSync(`gh api repos/${REPO}/pages/builds/latest`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) }
  catch { return null }
}

console.log(`\nAWAITING DEPLOY — ${URL_BASE}`)
console.log(`  expecting commit ${expected.commitShort} · seed ${expected.seed} · sw ${expected.swVersion}`)
console.log(`  normal Pages build: 33–${NORMAL}s. Stall threshold: ${TIMEOUT / 1000}s.\n`)

const started = Date.now()
let lastNote = 0
for (;;) {
  const served = await servedStamp()
  const elapsed = Math.round((Date.now() - started) / 1000)

  if (served?.builtAt === expected.builtAt && served?.commit === expected.commit) {
    console.log(`  ✅ live after ${elapsed}s — commit ${served.commitShort}, seed ${served.seed}, sw ${served.swVersion}`)
    console.log(`\n  Now prove the delivery:  node scripts/verify-live.mjs\n`)
    process.exit(0)
  }

  if (Date.now() - started > TIMEOUT) {
    const why = served?.unreachable ? `unreachable (${served.unreachable})`
      : served?.status === 404 ? 'serving a build with no stamp — i.e. one published before build-info.json existed'
      : served?.status ? `HTTP ${served.status}`
      : `serving commit ${served?.commitShort ?? '?'} from ${served?.builtAt ?? '?'}`
    const build = pagesBuild()
    // NAME THE RIGHT FAILURE. "Stalled" and "built the wrong thing" want different actions, and
    // guessing between them is what cost 45 minutes on 17 Aug 2026.
    const stuck = !build || build.status === 'building' || build.status === 'queued' || build.status === 'errored'
    console.log(`\n  ❌ ${stuck ? 'EXTERNALLY STALLED' : 'NOT SERVING THIS BUILD'} — ${elapsed}s, threshold ${TIMEOUT / 1000}s.`)
    console.log(`     production is ${why}`)
    if (build) {
      console.log(`     GitHub Pages: status=${build.status} duration=${build.duration ?? '?'}ms`
        + `${build.error?.message ? ` error="${build.error.message}"` : ''}`)
      console.log(`     created ${build.created_at}, updated ${build.updated_at}`)
    } else {
      console.log(`     GitHub Pages status unavailable (gh not installed or not authenticated).`)
      console.log(`     Check by hand:  gh api repos/${REPO}/pages/builds/latest`)
    }
    console.log(stuck ? `
     This is GitHub-side, not the repo. A build that has not moved in ${TIMEOUT / 1000}s does not
     recover by being waited on — one on 17 Aug 2026 errored after 66 minutes. Re-push the IDENTICAL
     deploy; it supersedes the stuck build and lands in the usual minute:

         npm run deploy:web
` : `
     GitHub reports the build as ${build.status}, so it is not stuck — production is serving
     something other than what was just pushed. Either the push did not reach gh-pages, or the CDN
     is still holding the previous copy. Check the branch, then re-run the deploy:

         git ls-remote https://github.com/${REPO}.git gh-pages
         npm run deploy:web
`)
    process.exit(2)
  }

  if (elapsed - lastNote >= 15) {
    lastNote = elapsed
    console.log(`  … ${elapsed}s — serving ${served?.commitShort ?? served?.unreachable ?? `HTTP ${served?.status}`}`)
  }
  await sleep(5000)
}
