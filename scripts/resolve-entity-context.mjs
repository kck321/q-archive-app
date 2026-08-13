// Apply the outside-review verdicts, and run a CONTEXT pass on the ambiguous tokens.
//
// The context pass is deliberately narrow: only the tokens the review named, and only where
// the surrounding lines carry explicit evidence. An occurrence with no evidence stays
// unresolved. That is the whole point — "BO" resolves to Board Owner in the drops that talk
// about the board and to Barack Obama in the drops that talk about the president, and to
// nothing at all in the 65 that do neither.
//
// AUDIT ONLY — no production write, no deploy.
//
//   node scripts/resolve-entity-context.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { BUCKET1, SAFE_GLOBAL, ROUTE_OUT, CONTEXT_RESOLVE } from './lib/entityVerdicts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ── 1. bucket 1 verdicts ────────────────────────────────────────────────────
const b1 = { typed: 0, routed: 0, unresolved: 0, merged: 0 }
for (const v of Object.values(BUCKET1)) {
  if (v.route) b1.routed++
  else if (v.unresolved) b1.unresolved++
  else { b1.typed++; if (v.mergedInto) b1.merged++ }
}

// ── 2. context resolution, occurrence by occurrence ─────────────────────────
const resolutions = []
const perToken = {}

for (const [token, candidates] of Object.entries(CONTEXT_RESOLVE)) {
  perToken[token] = { total: 0, resolved: 0, unresolved: 0, byReferent: {} }
  const rx = new RegExp(`(?<![A-Za-z0-9_])${esc(token)}(?![A-Za-z0-9_])`, 'g')

  for (const p of posts) {
    const lines = clean(p.text ?? '').split('\n')
    lines.forEach((line, i) => {
      rx.lastIndex = 0
      let hit
      while ((hit = rx.exec(line)) !== null) {
        perToken[token].total++
        // ±3 lines, as the review specified.
        const window = lines.slice(Math.max(0, i - 3), i + 4).join(' ')
        const match = candidates.find(c => c.evidence.test(window))
        if (match) {
          perToken[token].resolved++
          perToken[token].byReferent[match.canonical] = (perToken[token].byReferent[match.canonical] ?? 0) + 1
          resolutions.push({
            token, postNum: p.postNum, line: i,
            canonical: match.canonical, type: match.type,
            evidence: (window.match(match.evidence) ?? [])[0] ?? null,
            confidence: 'MEDIUM',
          })
        } else {
          perToken[token].unresolved++
        }
      }
    })
  }
}

const totalOcc = Object.values(perToken).reduce((n, t) => n + t.total, 0)
const totalRes = Object.values(perToken).reduce((n, t) => n + t.resolved, 0)

fs.writeFileSync(path.join(OUT, 'entities-context-resolved.json'), JSON.stringify({
  scope: 'review verdicts + context resolution of the named ambiguous tokens',
  productionChanged: false,
  bucket1: b1,
  safeGlobal: Object.keys(SAFE_GLOBAL).length,
  routedOut: Object.keys(ROUTE_OUT).length,
  contextPass: { tokens: Object.keys(CONTEXT_RESOLVE).length, occurrences: totalOcc, resolved: totalRes, unresolved: totalOcc - totalRes, perToken },
  resolutions,
}, null, 1))

const md = ['# Entities — review verdicts applied, and context resolution\n']
md.push('**No production write, no deploy.**\n')
md.push('\n## Bucket 1 — the 98 named-but-untyped\n')
md.push('| Outcome | Count |')
md.push('|---|---|')
md.push(`| Given a type | ${b1.typed} |`)
md.push(`| Routed out of Entities | ${b1.routed} |`)
md.push(`| Left unresolved by review | ${b1.unresolved} |`)
md.push(`\nAlias merges applied: \`MS13\` = \`MS_13\` = \`MS-13\`; \`Gang of 8\` = \`Gang of Eight\`; \`SEC of STATE\` = \`Sec of State\`.\n`)
md.push(`Routed out: ${Object.entries(BUCKET1).filter(([, v]) => v.route).map(([k]) => `\`${k}\``).join(', ')}.\n`)
md.push(`\n## Bucket 2a — ${Object.keys(SAFE_GLOBAL).length} acronyms resolved on the token alone\n`)
md.push('| Token | Canonical | Type |')
md.push('|---|---|---|')
for (const [k, v] of Object.entries(SAFE_GLOBAL)) md.push(`| \`${k}\` | ${v.canonical} | ${v.type.replace(/_/g, ' ')} |`)
md.push(`\n## Bucket 2b — context pass over ${Object.keys(CONTEXT_RESOLVE).length} ambiguous tokens\n`)
md.push('Each occurrence was read with ±3 lines. A referent is assigned only where the window carries explicit evidence; everything else stays unresolved.\n')
md.push('| Token | Occurrences | Resolved | Still unresolved | Referents found |')
md.push('|---|---|---|---|---|')
for (const [t, s] of Object.entries(perToken).sort((a, b) => b[1].total - a[1].total)) {
  const refs = Object.entries(s.byReferent).map(([r, n]) => `${r} ×${n}`).join(', ') || '—'
  md.push(`| \`${t}\` | ${s.total} | ${s.resolved} | ${s.unresolved} | ${refs} |`)
}
md.push(`\n**${totalRes} of ${totalOcc}** occurrences resolved (${Math.round(totalRes / totalOcc * 100)}%). The remaining ${totalOcc - totalRes} stay \`contextDependent: true\`.\n`)
md.push('\nThis is the behaviour the review asked for: the same token resolves differently in different drops, and to nothing at all where the drop does not say.\n')
fs.writeFileSync(path.join(OUT, 'entities-context-resolved.md'), md.join('\n') + '\n')

console.log('\nREVIEW VERDICTS + CONTEXT RESOLUTION\n')
console.log(`  bucket 1 (98)  : ${b1.typed} typed, ${b1.routed} routed out, ${b1.unresolved} left unresolved (${b1.merged} alias merges)`)
console.log(`  safe acronyms  : ${Object.keys(SAFE_GLOBAL).length} resolved on the token alone`)
console.log(`  routed out     : ${Object.keys(ROUTE_OUT).length}`)
console.log(`\n  context pass over ${Object.keys(CONTEXT_RESOLVE).length} tokens:`)
console.log(`    occurrences  : ${totalOcc}`)
console.log(`    resolved     : ${totalRes}  (${Math.round(totalRes / totalOcc * 100)}%)`)
console.log(`    still unresolved: ${totalOcc - totalRes}`)
console.log('\n  per token:')
for (const [t, s] of Object.entries(perToken).sort((a, b) => b[1].total - a[1].total).slice(0, 14)) {
  const refs = Object.entries(s.byReferent).map(([r, n]) => `${r} x${n}`).join(', ') || '—'
  console.log(`    ${t.padEnd(9)} ${String(s.resolved).padStart(3)}/${String(s.total).padEnd(4)} ${refs}`)
}
console.log('\n→ audit/entities-context-resolved.md\n')
