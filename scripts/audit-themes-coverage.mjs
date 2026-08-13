// Stratified coverage audit of the legacy-only theme gap.
//
// 4,242 posts carry an old free-text theme label that no controlled signal corroborates. The
// question is not how to clear them but WHY they disagree: extractor noise, or a real class of
// themes we are systematically missing?
//
// Sampled rather than reviewed wholesale, in four strata that answer different questions:
//   100  high-frequency legacy labels     is the bulk of the gap one repeated mistake?
//   100  rare / single-use labels         is the 77% singleton tail meaningful at all?
//    50  posts with NO v1 theme           are we missing whole posts, not just labels?
//    50  posts where v1 and legacy differ are we assigning the wrong parent?
//
// Outcomes: OLD_EXTRACTOR_NOISE | VALID_THEME_ALREADY_COVERED_DIFFERENTLY |
//           VALID_THEME_SIGNAL_MISSING | ONTOLOGY_GAP | NEEDS_CONTEXT
//
// Sampling is STRIDED, not random: the same corpus gives the same sample every run, so a
// rerun after a signal fix is comparable to this one.
//
//   node scripts/audit-themes-coverage.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { THEMES, LEGACY_HINTS, THEME_BY_KEY } from './lib/themes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const v1 = JSON.parse(fs.readFileSync(path.join(OUT, 'themes-audit.json'), 'utf8'))

const v1ByPost = new Map()
for (const a of v1.assignments) {
  if (!v1ByPost.has(a.postNum)) v1ByPost.set(a.postNum, new Set())
  v1ByPost.get(a.postNum).add(a.theme)
}

// Labels that describe HOW Q writes rather than WHAT the text is about. "cryptic messaging" is
// the single most common legacy label at 401 — and it is a style observation, which belongs to
// Emphasis or Codes, not to a subject taxonomy.
const META_LABEL = /\b(cryptic|coded messag|pattern recognition|insider knowledge|hidden (truth|knowledge|connection)|information warfare|collective action|mass awakening|good versus evil|messaging|communication style|rhetoric|speculation|ambigu|vague|symbolism|numerology|anticipation|suspense|urgency|call to action|community|engagement|trust|loyalty|hope|fear|emotion)\b/i

const labelFreq = new Map()
for (const p of posts) for (const l of p.postAnalysis?.themes ?? []) labelFreq.set(l, (labelFreq.get(l) ?? 0) + 1)

// Build the legacy-only population.
const population = []
for (const p of posts) {
  const cleaned = clean(p.text ?? '')
  const src = sourceLines(cleaned)
  const qText = cleaned.split('\n').filter((_, i) => !src.has(i)).join('\n')
  const assigned = v1ByPost.get(p.postNum) ?? new Set()
  for (const label of p.postAnalysis?.themes ?? []) {
    const mapped = LEGACY_HINTS.find(([rx]) => rx.test(label))?.[1] ?? null
    // Unmapped labels are KEPT. They are the only place a genuine ontology gap can show up —
    // a label that maps to an existing parent is by definition not a missing parent.
    if (mapped && assigned.has(mapped)) continue
    population.push({ postNum: p.postNum, label, mapped, qText, assigned: [...assigned], freq: labelFreq.get(label) ?? 1 })
  }
}

const stride = (arr, n) => {
  if (arr.length <= n) return arr
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)])
}

const highFreq = stride(population.filter(x => x.freq >= 10).sort((a, b) => b.freq - a.freq || a.postNum - b.postNum), 100)
const rare = stride(population.filter(x => x.freq <= 2).sort((a, b) => a.postNum - b.postNum), 100)
const noTheme = stride(population.filter(x => x.assigned.length === 0).sort((a, b) => a.postNum - b.postNum), 50)
const disagree = stride(population.filter(x => x.assigned.length > 0 && !x.assigned.includes(x.mapped)).sort((a, b) => a.postNum - b.postNum), 50)

// ── the classifier ──────────────────────────────────────────────────────────
function classify(item) {
  const t = THEME_BY_KEY.get(item.mapped)
  // No parent at all is the ONLY thing that can be an ontology gap. If it recurs, the ontology
  // may be missing something; if it is a one-off, it is the extractor inventing a label.
  if (!t) {
    return item.freq >= 5
      ? { outcome: 'ONTOLOGY_GAP', why: `"${item.label}" recurs ${item.freq} times and fits none of the ${THEMES.length - 1} parents` }
      : { outcome: 'OLD_EXTRACTOR_NOISE', why: 'a one-off label that fits no parent — invented rather than observed' }
  }

  // 1 — a style observation is not a subject.
  if (META_LABEL.test(item.label)) {
    return { outcome: 'OLD_EXTRACTOR_NOISE', why: 'the label describes how Q writes, not what the text is about — that belongs to Emphasis or Codes, not a subject taxonomy' }
  }

  // 2 — is there evidence we MISSED? This has to be a different test from the one v1 ran, or
  // it can never fire: anything v1's anchors/support matched would already be assigned and
  // would not be in this population at all. The real question is whether the LEGACY LABEL'S OWN
  // VOCABULARY appears in Q's lines while our signal list does not cover it.
  const labelWords = item.label.toLowerCase().match(/[a-z]{4,}/g) ?? []
  const STOP = new Set(['this', 'that', 'with', 'from', 'their', 'about', 'into', 'over', 'been', 'were', 'they', 'them'])
  const present = labelWords.filter(w => !STOP.has(w) && new RegExp(`\\b${w}`, 'i').test(item.qText))
  const covered = w => t.anchors.some(rx => rx.test(w)) || t.support.some(rx => rx.test(w))
  const uncovered = present.filter(w => !covered(w))
  if (present.length && uncovered.length === present.length && present.length >= 2) {
    return {
      outcome: 'VALID_THEME_SIGNAL_MISSING',
      why: `the label's own words (${present.join(', ')}) appear in Q's lines but no ${t.label} signal covers them`,
      fixable: true, missingTerms: uncovered,
    }
  }

  // 3 — the post already has a theme, and the legacy label is a near-synonym of it.
  if (item.assigned.length) {
    return {
      outcome: 'VALID_THEME_ALREADY_COVERED_DIFFERENTLY',
      why: `the post is already tagged ${item.assigned.map(k => THEME_BY_KEY.get(k)?.label ?? k).join(', ')}; the legacy label names the same subject more narrowly`,
    }
  }

  // 4 — no evidence anywhere and no theme assigned. Either the label was invented, or it names
  // something the ontology has no home for.
  const anyThemeEvidence = THEMES.some(x => x.anchors.some(rx => rx.test(item.qText)) || x.support.filter(rx => rx.test(item.qText)).length >= 2)
  if (anyThemeEvidence) {
    return { outcome: 'OLD_EXTRACTOR_NOISE', why: 'the post carries evidence for a different theme entirely; this label does not match its own post' }
  }
  // The label maps to a parent that exists, but the post carries no evidence for any theme.
  // That is the extractor asserting a subject its own post does not support — not a gap in the
  // ontology, which is what an earlier version of this classifier wrongly called it.
  if (item.freq >= 5) {
    return { outcome: 'OLD_EXTRACTOR_NOISE', why: `"${item.label}" maps to ${t.label}, which exists, but the post carries no evidence for it` }
  }
  return { outcome: 'NEEDS_CONTEXT', why: 'a one-off label with no corroborating text; not enough to act on' }
}

const strata = [
  ['high-frequency legacy labels', highFreq],
  ['rare / single-use labels', rare],
  ['posts with no v1 theme', noTheme],
  ['v1 and legacy disagree', disagree],
]

const results = []
for (const [name, sample] of strata) {
  for (const item of sample) {
    const r = classify(item)
    results.push({ stratum: name, postNum: item.postNum, legacyLabel: item.label, legacyFreq: item.freq, mappedTo: THEME_BY_KEY.get(item.mapped)?.label ?? item.mapped, v1Assigned: item.assigned.map(k => THEME_BY_KEY.get(k)?.label ?? k), ...r })
  }
}

const byOutcome = {}
const byStratum = {}
for (const r of results) {
  byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1
  byStratum[r.stratum] ??= {}
  byStratum[r.stratum][r.outcome] = (byStratum[r.stratum][r.outcome] ?? 0) + 1
}
const pct = n => `${Math.round(n / results.length * 100)}%`

// Which themes keep showing up as "signal missing"? That is the actionable list.
const fixable = {}
const missingTerms = {}
for (const r of results) if (r.outcome === 'VALID_THEME_SIGNAL_MISSING') {
  fixable[r.mappedTo] = (fixable[r.mappedTo] ?? 0) + 1
  for (const w of r.missingTerms ?? []) {
    missingTerms[r.mappedTo] ??= {}
    missingTerms[r.mappedTo][w] = (missingTerms[r.mappedTo][w] ?? 0) + 1
  }
}
const gaps = {}
for (const r of results) if (r.outcome === 'ONTOLOGY_GAP') gaps[r.legacyLabel] = (gaps[r.legacyLabel] ?? 0) + 1

fs.writeFileSync(path.join(OUT, 'themes-coverage-audit.json'), JSON.stringify({
  scope: 'stratified sample of the legacy-only theme gap', productionChanged: false,
  population: population.length,
  sampled: results.length,
  totals: { byOutcome, byStratum, signalMissingByTheme: fixable, missingTermsByTheme: missingTerms, ontologyGapLabels: gaps },
  results,
}, null, 1))

const md = ['# Themes — stratified coverage audit of the legacy-only gap\n']
md.push(`Population: **${population.length.toLocaleString()}** legacy-only tags. Sampled: **${results.length}** across four strata. Sampling is strided, so a rerun after a signal fix is comparable to this one. **No production write, no deploy.**\n`)
md.push('\n## Outcome\n')
md.push('| Outcome | Count | Share |')
md.push('|---|---|---|')
for (const [k, n] of Object.entries(byOutcome).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n} | ${pct(n)} |`)
md.push('\n## By stratum\n')
md.push('| Stratum | ' + Object.keys(byOutcome).join(' | ') + ' |')
md.push('|---' .repeat(Object.keys(byOutcome).length + 1) + '|')
for (const [name, counts] of Object.entries(byStratum)) {
  md.push(`| ${name} | ` + Object.keys(byOutcome).map(k => counts[k] ?? 0).join(' | ') + ' |')
}
if (Object.keys(fixable).length) {
  md.push('\n## Actionable — signals that should have fired\n')
  md.push('| Theme | Sampled misses |')
  md.push('|---|---|')
  for (const [k, n] of Object.entries(fixable).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n} |`)
}
if (Object.keys(gaps).length) {
  md.push('\n## Possible ontology gaps — recurring labels with no home\n')
  md.push('| Legacy label | Times in corpus |')
  md.push('|---|---|')
  for (const [k, n] of Object.entries(gaps).sort((a, b) => b[1] - a[1]).slice(0, 20)) md.push(`| ${k} | ${n} |`)
}
md.push('\n## Examples\n')
for (const oc of Object.keys(byOutcome)) {
  md.push(`\n**${oc}**\n`)
  md.push('| Post | Legacy label | Mapped to | v1 assigned | Why |')
  md.push('|---|---|---|---|---|')
  for (const r of results.filter(x => x.outcome === oc).slice(0, 8)) {
    md.push(`| #${r.postNum} | ${r.legacyLabel} | ${r.mappedTo} | ${r.v1Assigned.join(', ') || '—'} | ${r.why.slice(0, 90)} |`)
  }
}
fs.writeFileSync(path.join(OUT, 'themes-coverage-audit.md'), md.join('\n') + '\n')

console.log('\nTHEMES COVERAGE AUDIT (stratified sample)\n')
console.log(`  population : ${population.length.toLocaleString()} legacy-only tags`)
console.log(`  sampled    : ${results.length}\n`)
for (const [k, n] of Object.entries(byOutcome).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${pct(n).padStart(4)}  ${k}`)
if (Object.keys(fixable).length) {
  console.log('\n  signals that should have fired:')
  for (const [k, n] of Object.entries(fixable).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${k}`)
}
if (Object.keys(gaps).length) {
  console.log('\n  possible ontology gaps:')
  for (const [k, n] of Object.entries(gaps).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${String(n).padStart(3)}  ${k}`)
}
console.log('\n→ audit/themes-coverage-audit.md\n')
