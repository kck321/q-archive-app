// THE PRE-DEPLOY PROOF. Everything expensive, run once, in the order that catches things earliest.
//
// The workflow this belongs to:
//
//   while iterating   targeted materialiser + the one test for the section + WARM browser
//   before deploying  this script: full chain gates, then fresh + returning + live browsers
//
// Why the browser steps are not negotiable. Three times in one day a change was correct in
// posts.json, correct in the manifest, correct on a fresh profile — and invisible to the owner,
// because a returning visitor keeps whatever it seeded until SEED_VERSION changes. Server-side
// green does not predict what a returning reader sees. The fresh/returning pair is the only check
// that has ever caught it.
//
//   node scripts/verify-final.mjs                     local proof (run BEFORE deploying)
//   node scripts/verify-final.mjs --live              live proof (run AFTER deploying)
//   node scripts/verify-final.mjs --base http://localhost:5175
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { builtSeedVersion } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const liveOnly = args.includes('--live')
const BASE = (args.find(a => a.startsWith('--base='))?.split('=')[1])
  ?? (args.includes('--base') ? args[args.indexOf('--base') + 1] : null)
  ?? 'http://localhost:5173'
const LIVE = 'https://qdrops.app'

const step = (label, cmd, argv) => {
  const started = Date.now()
  process.stdout.write(`\n▶ ${label}\n`)
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  const ok = r.status === 0
  console.log(`  ${ok ? '✅' : '❌'} ${label} — ${secs}s`)
  if (!ok) {
    console.error(`\nSTOPPED at "${label}". Nothing further ran; fix this before deploying.\n`)
    process.exit(1)
  }
}

console.log(`\nPRE-DEPLOY PROOF — seed ${builtSeedVersion(ROOT)}\n${'─'.repeat(60)}`)

if (!liveOnly) {
  // Cheap gates first: seconds each, and they fail on exactly the states the browser cannot see.
  step('certification manifest', 'node', ['scripts/certification-manifest.mjs', '--verify'])
  step('cross-section invariants', 'node', ['scripts/audit-cross-section.mjs'])

  // A FIRST-TIME visitor. Fresh profile, nothing cached, the app builds everything from the bundle.
  step('fresh profile — alias visibility', 'node', ['scripts/test-alias-visibility.mjs', BASE, '--fresh'])
  step('fresh profile — inline drop reader', 'node', ['scripts/test-inline-drop-reader.mjs', BASE, '--fresh'])
  // The acronym info box asserts MEANING per drop, not merely that a box opened. BO is three
  // different people depending on the drop, so "it popped up" is not the property that matters.
  step('fresh profile — reader info box', 'node', ['scripts/test-term-info.mjs', BASE, '--fresh'])

  // A RETURNING visitor, deliberately downgraded to the pre-change state. The one that has failed
  // in production while every other check was green.
  // --url, explicitly: this test defaults to qdrops.app, so without it the LOCAL proof was
  // checking production for a seed production has not been given yet, and reported the change
  // broken when it was merely undeployed.
  step('returning/stale profile — repairs itself', 'node', ['scripts/test-returning-profile.mjs', '--url', BASE])

  console.log(`\n${'─'.repeat(60)}\n✅ local proof complete. Deploy, then:  node scripts/verify-final.mjs --live\n`)
} else {
  // The deployed site itself — not a build that resembles it. The CDN serves the previous bundle
  // for a few minutes after a deploy, so a pass here means the real thing, not a local optimism.
  step('live site — alias visibility', 'node', ['scripts/test-alias-visibility.mjs', LIVE, '--fresh'])
  step('live site — inline drop reader', 'node', ['scripts/test-inline-drop-reader.mjs', LIVE, '--fresh'])
  step('live site — reader info box', 'node', ['scripts/test-term-info.mjs', LIVE, '--fresh'])
  // The one that matters most on production: a reader who already had the app must receive it.
  step('live site — returning/stale profile', 'node', ['scripts/test-returning-profile.mjs', '--url', LIVE])
  console.log(`\n${'─'.repeat(60)}\n✅ live proof complete — ${LIVE}\n`)
}
