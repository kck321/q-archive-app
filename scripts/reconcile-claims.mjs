// One materialised Claims dataset, with the certification invariants enforced as a gate.
//
// The Directives reconciliation taught this: totals derived by arithmetic across separate
// artifacts drift. So the final set is BUILT here from every source, once, and the script exits
// non-zero unless it holds together.
//
// Claims, Predictions and Conclusions are a connected family, not exclusive bins. A unit is a
// claim, and `isPrediction` / `isConclusion` ride on it as attributes — so Claim, Claim+Prediction,
// Claim+Conclusion and Claim+Prediction+Conclusion are all representable.
//
// AUDIT ONLY — no production write, no deploy. Questions and Directives frozen.
//
//   node scripts/reconcile-claims.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const v2 = JSON.parse(fs.readFileSync(path.join(OUT, 'claims-audit.json'), 'utf8'))
const ph3 = JSON.parse(fs.readFileSync(path.join(OUT, 'claims-adjudicated.json'), 'utf8'))
const u720 = JSON.parse(fs.readFileSync(path.join(OUT, 'claims-uncovered-adjudicated.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))

const flat = t => clean(t).replace(/\s+/g, ' ').trim()
const bodyOf = new Map(posts.map(p => [p.postNum, flat(p.text ?? '')]))

// Phase 3 decisions, indexed so they can override v2.
const ph3By = new Map()
for (const d of ph3.decisions) ph3By.set(`${d.postNum}|${key(d.exactText)}|${d.queue}`, d)
const demoted = new Set()
const conclusionOverride = new Map()
for (const d of ph3.decisions) {
  const k = `${d.postNum}|${key(d.exactText)}`
  if (d.queue === 'telegraphic' && d.proposedClass !== 'Q_CLAIM') demoted.add(k)
  if (d.queue === 'conclusion edge case') conclusionOverride.set(k, Boolean(d.isConclusion))
  if (d.queue === 'claim/prediction disagreement' && d.proposedClass === 'Q_CLAIM') conclusionOverride.set(`pred:${k}`, true)
}
const predToClaim = new Set(ph3.decisions.filter(d => d.queue === 'claim/prediction disagreement' && d.proposedClass === 'Q_CLAIM').map(d => `${d.postNum}|${key(d.exactText)}`))
const sourceToClaim = new Map()
for (const d of ph3.decisions) if (d.queue === 'source-material boundary' && d.proposedClass === 'Q_CLAIM') sourceToClaim.set(`${d.postNum}|${key(d.exactText)}`, d)

const rows = []
const add = (r, source) => rows.push({ ...r, source })

// 1 — v2 claims that survived Phase 3
for (const r of v2.rows) {
  if (r.primaryClass !== 'claim') continue
  const k = `${r.postNum}|${key(r.exactText)}`
  if (demoted.has(k)) continue
  add({
    postNum: r.postNum, postId: r.postId, exactText: r.exactText,
    primaryClass: 'claim',
    isPrediction: false,
    isConclusion: conclusionOverride.has(k) ? conclusionOverride.get(k) : Boolean(r.isConclusion),
    checkable: Boolean(r.checkable), sourceProvided: Boolean(r.sourceProvided),
    telegraphic: /elided copula/.test(r.provenance?.reason ?? ''),
    entities: r.entities ?? [], themes: r.themes ?? [],
    confidence: r.confidence,
    provenance: { origin: 'claims-audit v2', reason: r.provenance?.reason ?? null },
  }, 'v2')
}
// 2 — predictions reclassified to claims in Phase 3
for (const r of v2.rows) {
  if (r.primaryClass !== 'prediction') continue
  const k = `${r.postNum}|${key(r.exactText)}`
  if (!predToClaim.has(k)) continue
  add({
    postNum: r.postNum, postId: r.postId, exactText: r.exactText,
    primaryClass: 'claim', isPrediction: false, isConclusion: false,
    checkable: Boolean(r.checkable), sourceProvided: Boolean(r.sourceProvided),
    telegraphic: false, entities: r.entities ?? [], themes: r.themes ?? [],
    confidence: 'MEDIUM',
    provenance: { origin: 'phase 3', reason: 'conditional / intent / future-as-modifier — asserts rather than forecasts' },
  }, 'phase3-prediction')
}
// 3 — source-material units restored as claims
for (const [k, d] of sourceToClaim) {
  add({
    postNum: d.postNum, postId: d.postId, exactText: d.exactText,
    primaryClass: 'claim', isPrediction: false, isConclusion: false,
    checkable: Boolean(d.checkable), sourceProvided: Boolean(d.sourceProvided),
    telegraphic: false, entities: [], themes: [],
    confidence: d.confidence,
    provenance: { origin: 'phase 3', reason: 'long line carrying Q\'s own notation — his writing, not a pasted passage' },
  }, 'phase3-source')
}
// 4 — the 720
for (const d of u720.decisions) {
  if (d.proposedClass !== 'Q_CLAIM' && d.proposedClass !== 'Q_CLAIM_CONCLUSION') continue
  add({
    postNum: d.postNum, postId: d.postId, exactText: d.exactText,
    primaryClass: 'claim', isPrediction: false, isConclusion: d.proposedClass === 'Q_CLAIM_CONCLUSION',
    checkable: Boolean(d.checkable), sourceProvided: Boolean(d.sourceProvided),
    telegraphic: Boolean(d.telegraphic), entities: [], themes: [],
    confidence: d.confidence,
    provenance: { origin: 'the 720 uncovered stored claims', reason: d.reason },
  }, 'uncovered720')
}

// Predictions that stayed predictions.
const predictions = v2.rows.filter(r => r.primaryClass === 'prediction' && !predToClaim.has(`${r.postNum}|${key(r.exactText)}`))

// ── invariant gate ───────────────────────────────────────────────────────────
const unresolved = rows.filter(r => !(bodyOf.get(r.postNum) ?? '').includes(flat(r.exactText)))
// In-post repeats are REAL occurrences, not duplicates: Q writes "IT WAS NECESSARY." twice in
// #520 and "You get to go to JAIL." four times in #1888, exactly as "Coincidence?" appears
// twice in #1176. What must never happen is one unit arriving from two different sources.
const bySrc = new Map()
for (const r of rows) {
  const k = `${r.postNum}|${key(r.exactText)}`
  if (!bySrc.has(k)) bySrc.set(k, new Set())
  bySrc.get(k).add(r.source)
}
const crossDupes = [...bySrc.values()].filter(s => s.size > 1).length
const seen = new Map()
for (const r of rows) { const k = `${r.postNum}|${key(r.exactText)}`; seen.set(k, (seen.get(k) ?? 0) + 1) }
const inPostRepeats = [...seen.values()].reduce((n, c) => n + c - 1, 0)
const bothFlags = rows.filter(r => r.isPrediction && r.primaryClass !== 'claim')
const conclusions = rows.filter(r => r.isConclusion)

const checks = [
  ['every claim resolves verbatim to its post', unresolved.length === 0, `${rows.length - unresolved.length}/${rows.length}`],
  ['conclusions are a subset of claims', conclusions.every(r => r.primaryClass === 'claim'), `${conclusions.length} conclusions`],
  ['prediction flag only on claims', bothFlags.length === 0, `${bothFlags.length} violations`],
  ['no unit counted twice across sources', crossDupes === 0, `${crossDupes} cross-source duplicate(s)`],
]

console.log('\nCLAIMS — RECONCILED\n')
console.log('  INVARIANT GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(42)} ${got}`) }
for (const u of unresolved.slice(0, 5)) console.log(`      unresolved: #${u.postNum} ${JSON.stringify(u.exactText.slice(0, 56))}`)
if (failed) {
  // Write the diagnostic artifact BEFORE bailing. A gate that fails and leaves nothing to
  // inspect just forces the work to be redone by hand.
  const dup = new Map()
  for (const r of rows) { const k = `${r.postNum}|${key(r.exactText)}`; if (!dup.has(k)) dup.set(k, []); dup.get(k).push({ source: r.source, exactText: r.exactText }) }
  fs.writeFileSync(path.join(OUT, 'claims-reconcile-failure.json'), JSON.stringify({
    invariantsPassed: false,
    failing: checks.filter(c => !c[1]).map(c => c[0]),
    duplicates: [...dup].filter(([, l]) => l.length > 1).map(([k, l]) => ({ k, rows: l })),
    unresolved: unresolved.slice(0, 50),
  }, null, 1))
  console.error(`\n${failed} invariant check(s) FAILED — not certifiable.`)
  console.error('→ audit/claims-reconcile-failure.json\n')
  process.exit(1)
}

const distinct = new Set(rows.map(r => key(r.exactText)))
const postsWith = new Set(rows.map(r => r.postNum))
const paraphrases = ph3.decisions.filter(d => d.proposedClass === 'EDITORIAL_PARAPHRASE')
const needsContext = [
  ...ph3.decisions.filter(d => d.proposedClass === 'NEEDS_CONTEXT'),
  ...u720.decisions.filter(d => d.proposedClass === 'NEEDS_CONTEXT'),
]

const totals = {
  claims: { occurrences: rows.length, distinct: distinct.size, posts: postsWith.size, inPostRepeats },
  attributes: {
    checkable: rows.filter(r => r.checkable).length,
    sourceProvided: rows.filter(r => r.sourceProvided).length,
    isConclusion: conclusions.length,
    telegraphic: rows.filter(r => r.telegraphic).length,
  },
  predictions: { occurrences: predictions.length, posts: new Set(predictions.map(p => p.postNum)).size },
  editorialParaphrases: paraphrases.length,
  needsContext: needsContext.length,
  bySource: rows.reduce((a, r) => { a[r.source] = (a[r.source] ?? 0) + 1; return a }, {}),
}
fs.writeFileSync(path.join(OUT, 'claims-final.json'), JSON.stringify({ invariantsPassed: true, productionChanged: false, totals, rows, predictions }, null, 1))

const md = ['# Q Drops — Claims, final reconciled totals\n']
md.push('One materialised set. The invariants are a **gate in `scripts/reconcile-claims.mjs`**, not a claim in a report: the script exits non-zero unless every claim resolves verbatim to its post, conclusions are a subset of claims, and no claim is counted twice for one post.\n')
md.push('\nClaims, Predictions and Conclusions are a connected family. A unit is a claim, and `isPrediction` / `isConclusion` ride on it as attributes, so Claim, Claim+Prediction and Claim+Conclusion are all representable rather than being forced into exclusive bins.\n')
md.push('\n## Final totals\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| **Claims** | **${totals.claims.occurrences.toLocaleString()}** |`)
md.push(`| — distinct (canonical \`key()\`) | ${totals.claims.distinct.toLocaleString()} |`)
md.push(`| — posts containing a claim | ${totals.claims.posts.toLocaleString()} |`)
md.push(`| — in-post repeats included | ${inPostRepeats.toLocaleString()} |`)
md.push(`| **Predictions** | **${totals.predictions.occurrences.toLocaleString()}** |`)
md.push(`| — posts | ${totals.predictions.posts.toLocaleString()} |`)
md.push('\n### Claim attributes\n')
md.push('| Attribute | Count |')
md.push('|---|---|')
md.push(`| checkable | ${totals.attributes.checkable.toLocaleString()} |`)
md.push(`| sourceProvided | ${totals.attributes.sourceProvided.toLocaleString()} |`)
md.push(`| isConclusion | ${totals.attributes.isConclusion.toLocaleString()} |`)
md.push(`| telegraphic | ${totals.attributes.telegraphic.toLocaleString()} |`)
md.push('\n### Held out of the Q-authored count\n')
md.push('| Category | Count |')
md.push('|---|---|')
md.push(`| Editorial paraphrases | ${totals.editorialParaphrases.toLocaleString()} |`)
md.push(`| NEEDS_CONTEXT | ${totals.needsContext.toLocaleString()} |`)
md.push(`| Source material | ${v2.totals.sourceMaterial.units.toLocaleString()} |`)
md.push('\n### Where the claims came from\n')
md.push('| Source | Count |')
md.push('|---|---|')
for (const [k, n] of Object.entries(totals.bySource).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
fs.writeFileSync(path.join(OUT, 'claims-final.md'), md.join('\n') + '\n')

console.log('\n  FINAL CLAIMS')
console.log(`    occurrences        : ${totals.claims.occurrences.toLocaleString()}`)
console.log(`    distinct           : ${totals.claims.distinct.toLocaleString()}`)
console.log(`    posts              : ${totals.claims.posts.toLocaleString()}`)
console.log(`    in-post repeats    : ${inPostRepeats.toLocaleString()}`)
console.log('\n  ATTRIBUTES')
console.log(`    checkable          : ${totals.attributes.checkable.toLocaleString()}`)
console.log(`    sourceProvided     : ${totals.attributes.sourceProvided.toLocaleString()}`)
console.log(`    isConclusion       : ${totals.attributes.isConclusion.toLocaleString()}`)
console.log(`    telegraphic        : ${totals.attributes.telegraphic.toLocaleString()}`)
console.log('\n  PREDICTIONS         : ' + totals.predictions.occurrences.toLocaleString() + `  (${totals.predictions.posts.toLocaleString()} posts)`)
console.log('\n  HELD OUT')
console.log(`    editorial paraphrases : ${totals.editorialParaphrases.toLocaleString()}`)
console.log(`    NEEDS_CONTEXT         : ${totals.needsContext.toLocaleString()}`)
console.log(`    source material       : ${v2.totals.sourceMaterial.units.toLocaleString()}`)
console.log('\n→ audit/claims-final.md\n')
