// RISK-BASED VALIDATION. Pay for the proof the change actually needs.
//
//   node scripts/validate.mjs --profile fast        UI-only: colour, layout, copy, ordering
//   node scripts/validate.mjs --profile standard    shared app behaviour (the default)
//   node scripts/validate.mjs --profile certified   posts, entities, counts, aliases, seed, manifest
//   node scripts/validate.mjs --profile full        every category, viewport and interaction
//
//   --base <url>       what the browser gates point at        (default http://localhost:5173)
//   --only <a,b>       extra targeted gates, appended to any profile
//   --list             print what a profile would run, and stop
//   --no-chain         skip the twice-run apply chain in certified/full
//
// WHY PROFILES, AND WHAT IS NOT NEGOTIABLE.
//
// Measured 17 Aug 2026: one one-line change paid ~27 minutes to reach the live site. Six of those
// seconds were the certified-data protections. Everything else was browser time — including proving
// one shared month-chart module on seven categories and then proving the same application logic a
// second time against production, where only DELIVERY can differ.
//
// So the cheap certified-data invariants are in EVERY profile, without exception: the certification
// manifest, the cross-section invariants, the seed fingerprint and the four pure matchers cost about
// six seconds together and each one has caught something no browser gate can see. A profile chooses
// how much BROWSER to buy. It never chooses whether the data is allowed to be wrong.
//
// Pick by what changed, not by how big the diff looks:
//
//   fast       nothing outside components/styles — no artifact, no count, no seeded file
//   standard   behaviour shared across pages: filtering, search, readers, the month chart
//   certified  anything under audit/ or public/data, any count, alias, ruling or SEED_VERSION
//   full       before a release, when a shared module itself changed, or on a schedule
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { builtSeedVersion } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const at = flag => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null }

const PROFILES = ['fast', 'standard', 'certified', 'full']
const profile = at('--profile') ?? 'standard'
if (!PROFILES.includes(profile)) {
  console.error(`\nUnknown profile "${profile}". One of: ${PROFILES.join(', ')}\n`)
  process.exit(2)
}
const BASE = at('--base') ?? 'http://localhost:5173'
const extra = (at('--only') ?? '').split(',').map(s => s.trim()).filter(Boolean)
const rank = PROFILES.indexOf(profile)
const inc = name => rank >= PROFILES.indexOf(name)

/**
 * A step is [label, argv, minimum profile].
 *
 * Everything above the browser line is seconds and runs everywhere. Everything below it is a real
 * Chrome, and is what a profile is choosing between.
 */
const steps = []
const step = (label, argvv, from = 'fast') => { if (inc(from)) steps.push({ label, argv: argvv }) }

// ── The type check. A UI change that does not compile cannot be anything else. ─────────────────
step('typecheck (tsc -b)', ['npx', 'tsc', '-b'])

// ── CHEAP CERTIFIED-DATA INVARIANTS — every profile, always. ~6s for all of it. ────────────────
step('certification manifest', ['node', 'scripts/certification-manifest.mjs', '--verify'])
step('cross-section invariants', ['node', 'scripts/audit-cross-section.mjs'])
step('seed fingerprint', ['node', 'scripts/seed-fingerprint.mjs'])
// The pure matchers. Milliseconds each, and each has already caught a defect that would otherwise
// have cost a 90-second browser round trip: the shared boundary rule, the multi-word text matcher,
// and the plan that maps a phrase onto the segments an annotation layer cut it into.
step('rendered-text matcher', ['node', 'scripts/test-rendered-match.mjs'])
step('multi-word glossary segmentation', ['node', 'scripts/test-gloss-segments.mjs'])
step('split glossary occurrences', ['node', 'scripts/test-gloss-occurrence.mjs'])
// Context is certified in the data and absent from the drop.
step('context + emphasis: certified, not painted', ['node', 'scripts/verify-context-render.mjs'])

// ── THE APPLY CHAIN, TWICE — proves idempotence. 15s a run; certified changes only. ────────────
if (!argv.includes('--no-chain')) {
  step('apply chain (run 1 of 2)', ['node', 'scripts/rebuild-bundle.mjs'], 'certified')
  step('apply chain (run 2 of 2 — idempotence)', ['node', 'scripts/rebuild-bundle.mjs'], 'certified')
  step('manifest still verifies after the chain', ['node', 'scripts/certification-manifest.mjs', '--verify'], 'certified')
}

// ── BROWSER: a first-time visitor. ─────────────────────────────────────────────────────────────
step('fresh — alias visibility', ['node', 'scripts/test-alias-visibility.mjs', BASE, '--fresh'], 'standard')
step('fresh — inline drop reader', ['node', 'scripts/test-inline-drop-reader.mjs', BASE, '--fresh'], 'standard')
// The acronym info box asserts MEANING per drop, not merely that a box opened. BO is three
// different people depending on the drop, so "it popped up" is not the property that matters.
step('fresh — reader info box', ['node', 'scripts/test-term-info.mjs', BASE, '--fresh'], 'standard')
// Every route into the card — hover, keyboard, tap, Escape, outside click, screen-reader labelling.
step('fresh — tooltip accessibility', ['node', 'scripts/test-hover-accessibility.mjs', BASE, '--fresh'], 'standard')
// The month chart on its two DIFFERENT hosts (Analysis + Archive), desktop and phone. `full` sweeps
// all seven categories; ordinary runs do not, because it is one shared module.
if (profile !== 'full') step('fresh — month chart behaviour', ['node', 'scripts/test-month-chart-behaviour.mjs', '--url', BASE], 'standard')
step('fresh — month chart, all 7 categories', ['node', 'scripts/test-month-chart-behaviour.mjs', '--url', BASE, '--full'], 'full')

// ── BROWSER: the gates that read certified DATA off the rendered page. ─────────────────────────
// MULTI-WORD TERMS, INCLUDING THE SIX THE ANNOTATION LAYER SPLITS. Six terms had no box at all
// while every other gate was green, because no gate asked.
step('fresh — multi-word glossary terms', ['node', 'scripts/test-multiword-gloss.mjs', BASE, '--fresh'], 'certified')
// CATEGORY ORDERING. The badge number must be the sort key, on every category.
step('fresh — category ordering', ['node', 'scripts/test-category-order.mjs', BASE, '--fresh'], 'certified')
// THE ENTITY LIST RECONCILES AT THE LAYER THE READER SEES.
step('fresh — entity list reconciliation', ['node', 'scripts/test-entity-reconciliation.mjs', '--url', BASE], 'certified')
// An alias ruling is not finished until BOTH surfaces show it. /analysis was fixed a day before
// /posts, which is the screen the question had been asked about.
step('fresh — archive alias visibility', ['node', 'scripts/test-archive-alias-visibility.mjs', BASE, '--fresh'], 'full')

// ── BROWSER: a RETURNING visitor. The one that has failed in production while everything else
// was green. --url explicitly, or the local proof would check production for a seed production
// has not been given yet and report the change broken when it was merely undeployed.
step('returning/stale profile — repairs itself', ['node', 'scripts/test-returning-profile.mjs', '--url', BASE], 'standard')

// ── Anything named with --only, whatever the profile. ──────────────────────────────────────────
for (const name of extra) {
  const file = name.endsWith('.mjs') ? name : `${name}.mjs`
  const rel = file.startsWith('scripts/') ? file : `scripts/${file}`
  // Both arg conventions at once: the older gates take a positional URL and `--fresh`, the newer
  // ones take `--url`. Passing all three suits either, and an unknown flag is ignored by both.
  steps.push({ label: `targeted — ${name}`, argv: ['node', rel, BASE, '--url', BASE, '--fresh'] })
}

console.log(`\nVALIDATE — profile ${profile.toUpperCase()} — seed ${builtSeedVersion(ROOT)}`)
console.log(`  base: ${BASE}   steps: ${steps.length}\n${'─'.repeat(64)}`)

if (argv.includes('--list')) {
  for (const s of steps) console.log(`  ${s.label}\n      ${s.argv.join(' ')}`)
  console.log(`\n  ${steps.length} step(s). Nothing was run.\n`)
  process.exit(0)
}

const timings = []
const overall = Date.now()
for (const s of steps) {
  const started = Date.now()
  process.stdout.write(`\n▶ ${s.label}\n`)
  const r = spawnSync(s.argv[0], s.argv.slice(1), { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
  const secs = (Date.now() - started) / 1000
  timings.push({ label: s.label, secs, ok: r.status === 0 })
  console.log(`  ${r.status === 0 ? '✅' : '❌'} ${s.label} — ${secs.toFixed(1)}s`)
  if (r.status !== 0) {
    console.error(`\nSTOPPED at "${s.label}". Nothing further ran; fix this before deploying.\n`)
    report(timings, overall)
    process.exit(1)
  }
}

function report(rows, startedAt) {
  const total = (Date.now() - startedAt) / 1000
  console.log(`\n${'─'.repeat(64)}\n  TIMING — profile ${profile}`)
  for (const r of [...rows].sort((a, b) => b.secs - a.secs)) {
    if (r.secs >= 1) console.log(`    ${r.secs.toFixed(1).padStart(7)}s  ${r.label}`)
  }
  const cheap = rows.filter(r => r.secs < 1).length
  if (cheap) console.log(`    ${'<1'.padStart(7)}s  × ${cheap} further step(s)`)
  console.log(`    ${'─'.repeat(9)}`)
  console.log(`    ${total.toFixed(1).padStart(7)}s  TOTAL\n`)
}

report(timings, overall)
console.log(`✅ ${profile} validation complete.`)
console.log('   Deploy, then:  node scripts/verify-live.mjs\n')
