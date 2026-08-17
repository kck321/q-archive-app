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

  // The pure matchers, before anything pays for a browser. Each one is milliseconds, and each one
  // has already caught a defect that would otherwise have cost a 90-second round trip to find:
  // the shared boundary rule, the multi-word text matcher, and the plan that maps a phrase onto the
  // segments an annotation layer cut it into.
  step('rendered-text matcher', 'node', ['scripts/test-rendered-match.mjs'])
  step('multi-word glossary segmentation', 'node', ['scripts/test-gloss-segments.mjs'])
  step('split glossary occurrences', 'node', ['scripts/test-gloss-occurrence.mjs'])
  // Context is certified in the data and absent from the drop. This gate had been asserting the
  // opposite of the live style since 2026-08-14 and nobody saw it, because it was not a step of
  // anything. It is one now.
  step('context + emphasis: certified, not painted', 'node', ['scripts/verify-context-render.mjs'])

  // A FIRST-TIME visitor. Fresh profile, nothing cached, the app builds everything from the bundle.
  step('fresh profile — alias visibility', 'node', ['scripts/test-alias-visibility.mjs', BASE, '--fresh'])
  step('fresh profile — inline drop reader', 'node', ['scripts/test-inline-drop-reader.mjs', BASE, '--fresh'])
  // The acronym info box asserts MEANING per drop, not merely that a box opened. BO is three
  // different people depending on the drop, so "it popped up" is not the property that matters.
  step('fresh profile — reader info box', 'node', ['scripts/test-term-info.mjs', BASE, '--fresh'])
  // Every route into the card — hover, keyboard, tap, Escape, outside click, screen-reader
  // labelling, and the two placement rules — on a drop that carries a Partial reading.
  step('fresh profile — tooltip accessibility', 'node', ['scripts/test-hover-accessibility.mjs', BASE, '--fresh'])
  // MULTI-WORD TERMS, INCLUDING THE SIX THE ANNOTATION LAYER SPLITS. Six terms had no box at all
  // while every other gate was green, because no gate asked. This one asks about all 19, and about
  // nesting and tab stops on every drop that carries one.
  step('fresh profile — multi-word glossary terms', 'node', ['scripts/test-multiword-gloss.mjs', BASE, '--fresh'])
  // CATEGORY ORDERING. The badge number must be the sort key, on every category. The list was
  // ordered by `occurrences` while the badge showed an alias-inclusive post count, so Australia's
  // 20 posts sat below rows with 6 and nothing was measuring it.
  step('fresh profile — category ordering', 'node', ['scripts/test-category-order.mjs', BASE, '--fresh'])
  // THE ENTITY LIST RECONCILES AT THE LAYER THE READER SEES. entities.json said 1,201 for weeks
  // while the header printed 856 and the list rendered 1,062 — every server-side gate green. This
  // reads the real DOM: the header's figures, the published row count, and a post chip on every
  // one of those rows.
  step('fresh profile — entity list reconciliation', 'node', ['scripts/test-entity-reconciliation.mjs', '--url', BASE])
  // MONTH CHART BEHAVIOUR, on every Analysis category and the Archive, desktop and phone, with real
  // pointer and key events: hover reads out and changes nothing, click selects and filters, Enter
  // and Space match the mouse, and the selection is announced.
  step('fresh profile — month chart behaviour', 'node', ['scripts/test-month-chart-behaviour.mjs', '--url', BASE])

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
  step('live site — tooltip accessibility', 'node', ['scripts/test-hover-accessibility.mjs', LIVE, '--fresh'])
  step('live site — multi-word glossary terms', 'node', ['scripts/test-multiword-gloss.mjs', LIVE, '--fresh'])
  step('live site — category ordering', 'node', ['scripts/test-category-order.mjs', LIVE, '--fresh'])
  step('live site — entity list reconciliation', 'node', ['scripts/test-entity-reconciliation.mjs', '--url', LIVE])
  step('live site — month chart behaviour', 'node', ['scripts/test-month-chart-behaviour.mjs', '--url', LIVE])
  // The one that matters most on production: a reader who already had the app must receive it.
  step('live site — returning/stale profile', 'node', ['scripts/test-returning-profile.mjs', '--url', LIVE])
  console.log(`\n${'─'.repeat(60)}\n✅ live proof complete — ${LIVE}\n`)
}
