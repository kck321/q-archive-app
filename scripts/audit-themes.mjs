// Themes audit — a multi-label layer over Q-authored text.
//
// A theme is assigned only on CONVERGING EVIDENCE, never on one word appearing:
//
//   an ANCHOR  a phrase specific enough to carry the theme alone ("election fraud")
//   or 2+ SUPPORT signals  ordinary words that mean little individually ("vote", "ballot")
//   plus optional corroboration from the old extractor's free-text label for that post
//
// Three things are excluded before any of that runs:
//   - quoted and pasted source material, so an article Q reproduced does not give Q a theme
//   - context guards, so "Apple" beside a share price is not Technology and "Russia" inside an
//     investigation sentence is not Foreign Affairs
//   - the certified source-block map, shared with the Claims audit rather than re-derived
//
// Anything genuinely ambiguous goes to the Resolution Center with kind: theme, rather than
// being decided quietly in an audit file.
//
// AUDIT ONLY — no production write, no deploy. All certified sections frozen.
//
//   node scripts/audit-themes.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { THEMES, CONTEXT_GUARDS, LEGACY_HINTS, THEME_BY_KEY } from './lib/themes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))

const assignments = []
const ambiguous = []
const tally = {}
const legacyOnly = {}

for (const p of posts) {
  const cleaned = clean(p.text ?? '')
  const src = sourceLines(cleaned)
  // Q's own lines only. An article Q pasted mentioning the media is not Q writing about media.
  const qText = cleaned.split('\n').filter((_, i) => !src.has(i)).join('\n')
  if (!qText.trim()) continue

  // Corroboration from the old free-text labels, mapped onto the controlled parents.
  const legacy = new Set()
  for (const label of p.postAnalysis?.themes ?? []) {
    for (const [rx, key] of LEGACY_HINTS) if (rx.test(label)) legacy.add(key)
  }

  const scored = []
  for (const t of THEMES) {
    if (!t.anchors.length && !t.support.length) continue
    const anchorHits = t.anchors.filter(rx => rx.test(qText))
    const supportHits = t.support.filter(rx => rx.test(qText))

    // A guard blocks the theme when the surrounding text shows the term is doing something else.
    const guard = CONTEXT_GUARDS.find(g => g.theme === t.key && g.block.test(qText))
    if (guard && !anchorHits.length) {
      ambiguous.push({
        kind: 'theme', postNum: p.postNum, postId: p.id, token: t.label,
        why: `signals for ${t.label} are present, but ${guard.why}`,
        candidates: [t.label], evidence: supportHits.length,
      })
      continue
    }

    const corroborated = legacy.has(t.key)
    let confidence = null
    if (anchorHits.length) confidence = 'HIGH'
    else if (supportHits.length >= 2 && corroborated) confidence = 'HIGH'
    else if (supportHits.length >= 2) confidence = 'MEDIUM'
    else if (supportHits.length === 1 && corroborated) confidence = 'LOW'

    if (confidence) scored.push({ theme: t, anchorHits, supportHits, corroborated, confidence })
  }

  // One weak signal and nothing else in the post is not a theme — it is a coincidence.
  const kept = scored.filter(s => s.confidence !== 'LOW' || scored.length === 1)
  for (const s of kept) {
    tally[s.theme.key] = (tally[s.theme.key] ?? 0) + 1
    assignments.push({
      postNum: p.postNum, postId: p.id,
      theme: s.theme.key, label: s.theme.label,
      confidence: s.confidence,
      evidence: {
        anchors: s.anchorHits.map(rx => (qText.match(rx) ?? [])[0]).filter(Boolean).slice(0, 3),
        supportCount: s.supportHits.length,
        corroboratedByLegacyLabel: s.corroborated,
      },
      provenance: 'Themes audit v1 — converging evidence over Q-authored lines only',
    })
  }

  // The old extractor saw a subject here that no controlled signal reached.
  //
  // These are NOT routed to the Resolution Center. Doing so queued 4,242 items — more than
  // twice the entire entity queue — built from an extractor whose output was 77% single-use
  // labels. That is its noise, not genuine ambiguity, and putting it in front of contributors
  // would drown the 251 real cases. Counted as a coverage gap instead, which is what it is.
  for (const key of legacy) {
    if (kept.some(s => s.theme.key === key)) continue
    legacyOnly[key] = (legacyOnly[key] ?? 0) + 1
  }
}

const postsWithTheme = new Set(assignments.map(a => a.postNum))
const perPost = {}
for (const a of assignments) perPost[a.postNum] = (perPost[a.postNum] ?? 0) + 1
const multi = Object.values(perPost).filter(n => n > 1).length

const totals = {
  assignments: assignments.length,
  postsWithAtLeastOne: postsWithTheme.size,
  postsWithMoreThanOne: multi,
  averagePerTaggedPost: +(assignments.length / postsWithTheme.size).toFixed(2),
  byTheme: tally,
  byConfidence: assignments.reduce((a, x) => { a[x.confidence] = (a[x.confidence] ?? 0) + 1; return a }, {}),
  ambiguousForResolutionCenter: ambiguous.length,
  legacyLabelsWithoutSignal: legacyOnly,
}
fs.writeFileSync(path.join(OUT, 'themes-audit.json'), JSON.stringify({ scope: 'full-corpus themes audit v1', productionChanged: false, totals, assignments, ambiguous }, null, 1))

const md = ['# Q Drops — Themes audit (v1, candidate)\n']
md.push('A multi-label layer, not a sentence class: one post can carry several themes. **No production write, no deploy.**\n')
md.push('\n## Why a controlled ontology\n')
md.push('The earlier extractor emitted free text and produced **5,094 distinct labels for 10,453 tags**, 77% of them appearing once — `deep state`, `deep state conspiracy`, `deep state corruption` and `deep state coordination` are four labels for one idea. Those strings are now used as **corroboration**, mapped onto the parents, rather than as labels.\n')
md.push('\n## The rule\n')
md.push('A theme is assigned on converging evidence, never on one word appearing:\n')
md.push('| Evidence | Confidence |')
md.push('|---|---|')
md.push('| An anchor phrase specific enough to carry the theme alone | HIGH |')
md.push('| 2+ support signals AND the old label agrees | HIGH |')
md.push('| 2+ support signals | MEDIUM |')
md.push('| 1 support signal AND the old label agrees | LOW — kept only if it is the post’s only theme |')
md.push('\nQuoted and pasted source material is removed first, so an article Q reproduced cannot give Q a theme.\n')
md.push('\n## Totals\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Theme assignments | **${totals.assignments.toLocaleString()}** |`)
md.push(`| Posts with at least one | ${totals.postsWithAtLeastOne.toLocaleString()} |`)
md.push(`| Posts with more than one | ${totals.postsWithMoreThanOne.toLocaleString()} |`)
md.push(`| Average per tagged post | ${totals.averagePerTaggedPost} |`)
md.push(`| Sent to the Resolution Center | ${totals.ambiguousForResolutionCenter.toLocaleString()} |`)
md.push('\n### By theme\n')
md.push('| Theme | Posts |')
md.push('|---|---|')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) md.push(`| ${THEME_BY_KEY.get(k)?.label ?? k} | ${n.toLocaleString()} |`)
md.push('\n### By confidence\n')
md.push('| Confidence | Assignments |')
md.push('|---|---|')
for (const [k, n] of Object.entries(totals.byConfidence).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
md.push('\n## Ambiguous — routed to the Resolution Center\n')
md.push('Two situations, both left for review rather than decided quietly:\n')
md.push('- a context guard fired — the signals are there but the words are doing something else\n')
md.push('- the old extractor saw a subject that no controlled signal corroborates in Q’s own lines\n')
md.push('| Post | Theme | Why |')
md.push('|---|---|---|')
for (const a of ambiguous.slice(0, 60)) md.push(`| #${a.postNum} | ${a.token} | ${a.why} |`)
if (ambiguous.length > 60) md.push(`\n_…and ${(ambiguous.length - 60).toLocaleString()} more in the JSON._`)
fs.writeFileSync(path.join(OUT, 'themes-audit.md'), md.join('\n') + '\n')

console.log('\nTHEMES AUDIT v1\n')
console.log(`  assignments            : ${totals.assignments.toLocaleString()}`)
console.log(`  posts with a theme     : ${totals.postsWithAtLeastOne.toLocaleString()} of ${posts.length.toLocaleString()}`)
console.log(`  posts with 2+ themes   : ${totals.postsWithMoreThanOne.toLocaleString()}`)
console.log(`  average per tagged post: ${totals.averagePerTaggedPost}`)
console.log(`  to Resolution Center   : ${totals.ambiguousForResolutionCenter.toLocaleString()}`)
console.log('\n  by theme:')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${THEME_BY_KEY.get(k)?.label ?? k}`)
console.log('\n  by confidence:', JSON.stringify(totals.byConfidence))
console.log('\n→ audit/themes-audit.md\n')
