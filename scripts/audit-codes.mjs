// Codes & Brackets audit — full corpus.
//
// A notation layer. Every occurrence keeps Q's exact characters; a detected pattern never
// implies its meaning is known. An interpretation is attached only where the corpus itself
// carries the evidence, and everything else ships unresolved and goes to /resolve as kind: code.
//
// Deliberately NOT absorbed, because the survey showed how large they are:
//   554 distinct brackets around ordinary lowercase words — [raid], [now], [children] — which
//       is Q marking a word for attention, i.e. Emphasis
//   date fragments (08/09, 03/31) that a numeric pattern would otherwise claim as ciphers
//   ALL CAPS on its own, which is Emphasis
//
// AUDIT ONLY — no production write, no deploy. All six certified sections frozen.
//
//   node scripts/audit-codes.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import {
  BRACKET_CODEY, BRACKET_EMPHASIS, LOOKS_LIKE_DATE, NUMERIC_CODE,
  OBFUSCATED, CODED_PHRASES, OPERATIONAL_MARKER, KNOWN_MEANINGS, CODE_TYPE_INFO,
} from './lib/codes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))

const norm = s => s.trim().replace(/\s+/g, ' ').toUpperCase()
const occurrences = []
const routedToEmphasis = new Map()
const excludedDates = new Map()

for (const p of posts) {
  const cleaned = clean(p.text ?? '')
  const src = sourceLines(cleaned)
  const lines = cleaned.split('\n')

  lines.forEach((line, i) => {
    // Notation inside pasted source material is the source's, not Q's.
    if (src.has(i)) return
    const push = (sourceText, codeType, extra = {}) => {
      const key = norm(sourceText)
      const known = KNOWN_MEANINGS[key] ?? KNOWN_MEANINGS[sourceText.trim()]
      occurrences.push({
        sourceText, codeType, normalizedKey: key,
        postNum: p.postNum, postId: p.id,
        context: lines.slice(Math.max(0, i - 1), i + 2).map(l => l.trim()).filter(Boolean),
        interpretedMeaning: known?.meaning ?? null,
        interpretationConfidence: known?.confidence ?? null,
        interpretationBasis: known?.basis ?? null,
        resolved: Boolean(known),
        provenance: 'Codes audit v1 — Q-authored lines only',
        ...extra,
      })
    }

    for (const m of line.match(/\[[^\]\n]{1,40}\]/g) ?? []) {
      if (BRACKET_EMPHASIS.test(m)) { routedToEmphasis.set(m, (routedToEmphasis.get(m) ?? 0) + 1); continue }
      if (!BRACKET_CODEY.test(m)) continue
      push(m, 'bracketed_token')
    }
    for (const m of line.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+_?\b/g) ?? []) {
      if (OBFUSCATED.test(m)) push(m, 'obfuscated_shorthand')
    }
    for (const m of line.match(/\b\d{1,3}\s*[:=+\/-]\s*\d{1,3}(\s*=\s*\d{1,3})?\b/g) ?? []) {
      const t = m.replace(/\s+/g, '')
      if (LOOKS_LIKE_DATE.test(t)) { excludedDates.set(t, (excludedDates.get(t) ?? 0) + 1); continue }
      const hit = NUMERIC_CODE.find(n => n.rx.test(t))
      if (hit) push(t, 'numeric_symbolic', { formNote: hit.note })
    }
    for (const phrase of CODED_PHRASES) {
      if (new RegExp(`(?<![A-Za-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'i').test(line)) {
        push(phrase, 'coded_phrase')
      }
    }
    const bare = line.trim().replace(/[.!?]+$/, '')
    if (OPERATIONAL_MARKER.test(bare)) push(bare, 'operational_marker')
  })
}

// ── aggregate ───────────────────────────────────────────────────────────────
const byKey = new Map()
for (const o of occurrences) {
  if (!byKey.has(o.normalizedKey)) byKey.set(o.normalizedKey, { key: o.normalizedKey, codeType: o.codeType, sourceTexts: new Set(), posts: new Set(), count: 0, interpretedMeaning: o.interpretedMeaning, interpretationConfidence: o.interpretationConfidence, resolved: o.resolved })
  const e = byKey.get(o.normalizedKey)
  e.count++; e.sourceTexts.add(o.sourceText); e.posts.add(o.postNum)
}
const codes = [...byKey.values()].map(e => ({
  ...e, sourceTexts: [...e.sourceTexts], posts: [...e.posts].sort((a, b) => a - b), recurrenceCount: e.count,
})).sort((a, b) => b.recurrenceCount - a.recurrenceCount)

const byType = {}
for (const o of occurrences) byType[o.codeType] = (byType[o.codeType] ?? 0) + 1
const resolved = codes.filter(c => c.resolved)
const unresolved = codes.filter(c => !c.resolved)

// Anything unresolved and recurring is worth community eyes; one-offs are not.
const ambiguous = unresolved.filter(c => c.recurrenceCount >= 2).map(c => ({
  kind: 'code', token: c.sourceTexts[0], postNum: c.posts[0],
  postId: occurrences.find(o => o.normalizedKey === c.key)?.postId ?? null,
  why: `a ${c.codeType.replace(/_/g, ' ')} appearing ${c.recurrenceCount} times across ${c.posts.length} posts, with no meaning established by the corpus`,
  candidates: [], recurrenceCount: c.recurrenceCount, allPosts: c.posts,
}))

const totals = {
  occurrences: occurrences.length,
  distinctCodes: codes.length,
  posts: new Set(occurrences.map(o => o.postNum)).size,
  byType,
  resolvedCodes: resolved.length,
  unresolvedCodes: unresolved.length,
  ambiguousForResolutionCenter: ambiguous.length,
  routedToEmphasis: { distinct: routedToEmphasis.size, occurrences: [...routedToEmphasis.values()].reduce((a, b) => a + b, 0) },
  excludedAsDates: { distinct: excludedDates.size, occurrences: [...excludedDates.values()].reduce((a, b) => a + b, 0) },
}
fs.writeFileSync(path.join(OUT, 'codes-audit.json'), JSON.stringify({ scope: 'full-corpus codes & brackets audit v1', productionChanged: false, totals, codes, occurrences, ambiguous }, null, 1))

const md = ['# Q Drops — Codes & Brackets audit (v1, candidate)\n']
md.push('A **notation** layer, not a semantic class. Q’s exact characters are preserved, and a detected pattern never implies its meaning is known. **No production write, no deploy.**\n')
md.push('\n> Q Drops preserves coded language exactly as written. A detected code or bracket pattern does not imply that its meaning is known. Interpretations are shown only when supported by context or a reviewed resolution, and unresolved items can be submitted to the Resolution Center.\n')
md.push('\n## Totals\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Code occurrences | **${totals.occurrences.toLocaleString()}** |`)
md.push(`| Distinct codes | ${totals.distinctCodes.toLocaleString()} |`)
md.push(`| Posts | ${totals.posts.toLocaleString()} |`)
md.push(`| With an established meaning | ${totals.resolvedCodes} |`)
md.push(`| Meaning unknown | ${totals.unresolvedCodes.toLocaleString()} |`)
md.push(`| Recurring + unresolved → Resolution Center | ${totals.ambiguousForResolutionCenter.toLocaleString()} |`)
md.push('\n### By type\n')
md.push('| Type | Occurrences | What it is |')
md.push('|---|---|---|')
for (const [k, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) md.push(`| ${k.replace(/_/g, ' ')} | ${n.toLocaleString()} | ${CODE_TYPE_INFO[k] ?? ''} |`)
md.push('\n## What is deliberately NOT here\n')
md.push('| Excluded | Distinct | Occurrences | Why |')
md.push('|---|---|---|---|')
md.push(`| Brackets around an ordinary word | ${totals.routedToEmphasis.distinct} | ${totals.routedToEmphasis.occurrences.toLocaleString()} | \`[raid]\`, \`[now]\`, \`[children]\` — Q marking a word for attention, which is **Emphasis** |`)
md.push(`| Date fragments | ${totals.excludedAsDates.distinct} | ${totals.excludedAsDates.occurrences.toLocaleString()} | \`08/09\`, \`03/31\` are timestamps Q cited, not ciphers |`)
md.push('\nALL CAPS on its own is also excluded: Q writes in caps constantly, and caps become notation only with structure — an underscore, a digit, a bracket.\n')
md.push('\n## Codes with an established meaning\n')
md.push('| Code | × | Meaning | Confidence | Basis |')
md.push('|---|---|---|---|---|')
for (const c of resolved) {
  const k = KNOWN_MEANINGS[c.key]
  md.push(`| \`${c.sourceTexts[0]}\` | ${c.recurrenceCount} | ${c.interpretedMeaning} | ${c.interpretationConfidence} | ${k?.basis ?? ''} |`)
}
md.push('\n## Most frequent, meaning unknown\n')
md.push('| Code | Type | × | Posts |')
md.push('|---|---|---|---|')
for (const c of unresolved.slice(0, 60)) md.push(`| \`${c.sourceTexts[0]}\` | ${c.codeType.replace(/_/g, ' ')} | ${c.recurrenceCount} | ${c.posts.length} |`)
fs.writeFileSync(path.join(OUT, 'codes-audit.md'), md.join('\n') + '\n')

console.log('\nCODES & BRACKETS AUDIT v1\n')
console.log(`  occurrences        : ${totals.occurrences.toLocaleString()}`)
console.log(`  distinct codes     : ${totals.distinctCodes.toLocaleString()}`)
console.log(`  posts              : ${totals.posts.toLocaleString()}`)
console.log(`  meaning known      : ${totals.resolvedCodes}`)
console.log(`  meaning unknown    : ${totals.unresolvedCodes.toLocaleString()}`)
console.log(`  to /resolve        : ${totals.ambiguousForResolutionCenter.toLocaleString()}`)
console.log('\n  by type:')
for (const [k, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${k}`)
console.log('\n  NOT absorbed:')
console.log(`    ${String(totals.routedToEmphasis.occurrences).padStart(5)}  brackets around an ordinary word → Emphasis (${totals.routedToEmphasis.distinct} distinct)`)
console.log(`    ${String(totals.excludedAsDates.occurrences).padStart(5)}  date fragments → not codes (${totals.excludedAsDates.distinct} distinct)`)
console.log('\n→ audit/codes-audit.md\n')
