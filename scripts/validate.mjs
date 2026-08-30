// RISK-BASED VALIDATION. Pay for the proof the change actually needs.
//
//   node scripts/validate.mjs --profile fast        UI-only: colour, layout, copy, ordering
//   node scripts/validate.mjs --profile standard    shared app behaviour (the default)
//   node scripts/validate.mjs --profile certified   posts, entities, counts, aliases, seed, manifest
//   node scripts/validate.mjs --profile full        every category, viewport and interaction
//
//   --base <url>       what the browser gates point at        (default http://localhost:5173)
//   --only <a,b>       extra targeted gates, appended to any profile (allowlisted — --only ? lists them)
//   --list             print what a profile would run, and stop
//   --no-chain         skip the twice-run apply chain — fast/standard only, never certified/full
//
// THE PROFILE IS NOT A FREE CHOICE. With no --profile, the git diff picks one: every changed path
// maps to the weakest profile that can honestly prove it, and the strongest of those is the floor.
// An explicit --profile may go UP from the floor and is REFUSED below it, naming the files that set
// it. "Pick by what changed" was already the rule; it was just unenforceable, and `--profile fast`
// is one word whether or not the diff touched audit/.
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
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { builtSeedVersion } from './lib/browser.mjs'
import {
  PROFILES, rankOf, run, GATES, gateArgv, gateList,
  requiredProfile, worktreeTree, writeReceipt, headCommit, RECEIPT,
} from './lib/pipeline.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const at = flag => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null }

// ── THE FLOOR, FROM THE DIFF ──────────────────────────────────────────────────────────────────
const need = requiredProfile(ROOT)
const asked = at('--profile')
const profile = asked ?? need.required

if (!PROFILES.includes(profile)) {
  console.error(`\nUnknown profile "${profile}". One of: ${PROFILES.join(', ')}\n`)
  process.exit(2)
}
if (rankOf(profile) < rankOf(need.required)) {
  console.error(`\n  REFUSED — "${profile}" is weaker than this diff can be proved by.`)
  console.error(`  ${need.files.length} path(s) changed since ${need.baseline?.slice(0, 7) ?? '(no baseline)'} (${need.baselineWhy}).`)
  console.error(`  The floor is ${need.required.toUpperCase()}, set by:`)
  for (const r of need.forcing.slice(0, 8)) console.error(`      ${r.file}\n          ${r.why}`)
  if (need.forcing.length > 8) console.error(`      … and ${need.forcing.length - 8} more`)
  console.error(`\n  Run at ${need.required} or stronger. A profile chooses how much BROWSER to buy;`)
  console.error(`  it does not get to choose that a certified change is a UI change.\n`)
  process.exit(2)
}

const BASE = at('--base') ?? 'http://localhost:5173'
const rank = rankOf(profile)
const inc = name => rank >= rankOf(name)

// ── --only IS AN ALLOWLIST ────────────────────────────────────────────────────────────────────
// It used to be a path: `--only foo` became `scripts/foo.mjs` and ran it, whatever it was. Half of
// scripts/ WRITES certified artifacts, and `../` left the directory entirely. A targeted gate is a
// small closed set of read-only browser checks, so that set is now spelled out in lib/pipeline.mjs.
const extra = (at('--only') ?? '').split(',').map(s => s.trim()).filter(Boolean)
const unknown = extra.filter(n => !GATES[n])
if (unknown.length || extra.includes('?')) {
  if (unknown.length) console.error(`\n  Not a gate: ${unknown.join(', ')}`)
  console.error(`\n  --only accepts these, and nothing else:\n\n${gateList()}\n`)
  process.exit(2)
}

// ── --no-chain MAY NOT BUY A CERTIFIED PASS ───────────────────────────────────────────────────
// The chain run twice IS the certified proof: it is what shows an apply step is idempotent, and
// idempotence is the property that broke when SEED_VERSION sat at 4 through three applies. A
// certified run without it is a certified run in name only, and the name is what preflight reads.
const noChain = argv.includes('--no-chain')
if (noChain && rank >= rankOf('certified')) {
  console.error(`\n  REFUSED — --no-chain is not available at ${profile}.`)
  console.error(`  The twice-run apply chain IS the certified proof; skipping it leaves a run that`)
  console.error(`  claims "certified" and never checked idempotence. Drop --no-chain, or drop to a`)
  console.error(`  profile the diff allows (this diff's floor is ${need.required}).\n`)
  process.exit(2)
}

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
// A question's id must not depend on where its row sits, what its neighbours are, how it is
// classified, or which baseline the chain started from. Pure and offline, so it runs in `fast`.
step('canonical question identity', ['node', 'scripts/test-question-identity.mjs'])
// Context is certified in the data and absent from the drop.
step('context + emphasis: certified, not painted', ['node', 'scripts/verify-context-render.mjs'])

// ── THE APPLY CHAIN, TWICE — proves idempotence. 15s a run; certified changes only. ────────────
if (!noChain) {
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
// Back returns a reader to where they were. The archive is thousands of rows long, so landing
// at the top means re-scrolling past hundreds of posts to find your place again. Runs at both
// breakpoints because the scroll container differs (<main> on desktop, the document on phones)
// and the bug this caught only ever showed on desktop.
// Pictures and links tied to an analysis row, in their own labelled groups — and, more
// importantly, NOT folded into the certified chips or counts that row is adjudicated with.
// A URL in a drop must be ONE link carrying the WHOLE address: a term classified inside a link
// used to take the span for itself and leave a truncated href, which looks like it worked.
step('fresh — url integrity', ['node', 'scripts/test-url-integrity.mjs'], 'standard')
step('fresh — row evidence chips', ['node', 'scripts/test-row-evidence.mjs'], 'standard')
step('fresh — scroll restoration', ['node', 'scripts/test-scroll-restoration.mjs'], 'standard')
// A QUOTED DROP IS MARKED UP FROM ITS OWN CERTIFIED ANALYSIS, so it has to be shown with its own
// line breaks. The re-scrape lost 106 of them, and on #1012 that let a Claim swallow the Question
// beside it. Certified, because what it protects is the certified reading of a drop.
step('fresh — a quoted drop keeps its line breaks', ['node', 'scripts/test-quoted-linebreaks.mjs', BASE, '--fresh'], 'certified')
// The two-layer hover, on the layer that is easiest to get right in the file and wrong on screen:
// "Q" reads as Alice on the two drops where Q writes the equation and as the designation itself,
// in Q's own words, on the 73 that inherit it.
step('fresh — Q is the designation, except where Q writes the equation',
  ['node', 'scripts/test-q-persona-hover.mjs', BASE, '--fresh'], 'certified')
// WWG1WGA is a Directive on the five drops where it was not already one — and NOT on the two where
// it sits inside a URL. The refusal is the half worth gating: a later sweep that swept the URLs in
// would put a fill inside a link and split the anchor.
step('fresh — WWG1WGA is a directive, except inside a URL',
  ['node', 'scripts/test-wwg1wga-directive.mjs', BASE, '--fresh'], 'certified')
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

// ── Anything named with --only, whatever the profile. Allowlisted above; the table knows which
// argument convention each gate takes, so a name is all a caller supplies. ─────────────────────
for (const name of extra) steps.push({ label: `targeted — ${name}`, argv: gateArgv(name, BASE) })

console.log(`\nVALIDATE — profile ${profile.toUpperCase()} — seed ${builtSeedVersion(ROOT)}`)
console.log(`  floor: ${need.required} (${need.files.length} path(s) changed since `
  + `${need.baseline?.slice(0, 7) ?? 'nothing'} — ${need.baselineWhy})`)
if (asked && rankOf(asked) > rankOf(need.required)) console.log(`  asked: ${asked} — stronger than the floor, running it`)
if (need.unclassified.length) console.log(`  note:  ${need.unclassified.length} path(s) match no rule and were floored at standard`)
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
  // No shell. See the header of lib/pipeline.mjs — the shell was only ever there so `npx` would
  // spawn on Windows, and it made every gate argument a place cmd.exe could be handed an operator.
  const r = run(s.argv, { cwd: ROOT })
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

// ── THE RECEIPT ───────────────────────────────────────────────────────────────────────────────
// What passed, and — the part that was previously carried in someone's head — WHICH BYTES passed.
// The tree id is of the working copy, because validation runs before the commit; committing those
// same bytes produces that same tree, so preflight-deploy.mjs can check that the thing about to be
// published is the thing that was proved, rather than trusting that it must be.
const tree = worktreeTree(ROOT)
writeReceipt(ROOT, {
  at: new Date().toISOString(),
  profile,
  requiredProfile: need.required,
  chain: !noChain,
  tree,
  // Informational only. The tree is the identity that matters; the commit is just where HEAD
  // happened to be, and the whole point is that the bytes may not be committed yet.
  headAtValidation: headCommit(ROOT),
  base: BASE,
  seed: builtSeedVersion(ROOT),
  only: extra,
  steps: steps.length,
})

console.log(`✅ ${profile} validation complete.`)
console.log(`   receipt: ${RECEIPT} — tree ${String(tree).slice(0, 12)}, chain ${!noChain}`)
console.log('   Deploy, then:  node scripts/verify-live.mjs\n')
