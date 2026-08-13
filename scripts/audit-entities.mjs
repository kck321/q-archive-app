// Entity audit — full corpus, with canonicalisation and alias handling from the start.
//
// Every mention keeps its exact source wording. Canonicalisation is a layer on top:
//
//   sourceText        what Q actually wrote        "HRC"
//   canonicalEntity   who that is                  "Hillary Clinton"
//   entityType        what kind of thing           person
//   aliasUsed         which alias matched          "HRC"
//   contextDependent  cannot be resolved by token alone
//
// Three things are kept out of the count, each for a different reason:
//   - Q's SIGNATURE. "Q" is the top stored entity at 4,384, and every one of those is Q
//     signing a drop rather than naming someone.
//   - Mentions inside QUOTED SOURCE MATERIAL. The entity appears in the post, but an article
//     Q pasted naming Comey is not Q naming Comey. Recorded with inQAuthoredText false.
//   - Ambiguous shorthand. "BO" is board-owner in some drops and Obama in others; it is
//     recorded as a mention of the literal token and never resolved to a person.
//
// AUDIT ONLY — no production write, no deploy. All certified sections frozen.
//
//   node scripts/audit-entities.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { REGISTRY, CASE_SENSITIVE, SIGNATURE_TOKENS, CONTEXT_DEPENDENT, ENTITY_TYPES } from './lib/entities.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// One matcher per alias. Longest aliases first, so "Hillary Clinton" wins over "Hillary" and a
// mention is attributed once rather than twice.
const matchers = []
for (const e of REGISTRY) {
  for (const a of e.aliases) {
    const cs = CASE_SENSITIVE.has(a)
    matchers.push({
      entity: e, alias: a, len: a.length,
      rx: new RegExp(`(?<![A-Za-z0-9_])${esc(a)}(?![A-Za-z0-9_])`, cs ? 'g' : 'gi'),
    })
  }
}
matchers.sort((a, b) => b.len - a.len)

const mentions = []
const unresolvedTokens = new Map()

for (const p of posts) {
  const text = clean(p.text ?? '')
  const lines = text.split('\n')
  const src = sourceLines(text)
  // Character ranges that belong to quoted source material.
  const srcRanges = []
  let off = 0
  lines.forEach((l, i) => {
    if (src.has(i)) srcRanges.push([off, off + l.length])
    off += l.length + 1
  })
  const inSource = idx => srcRanges.some(([a, b]) => idx >= a && idx < b)

  // URLs are NOT entity mentions. "twitter" inside https://twitter.com/... is part of a link,
  // and counting it put Twitter at 1,249 mentions when Q names it about 97 times; YouTube was
  // 169 where nearly all of them were youtube.com URLs. Those spans belong to Evidence &
  // References, which already counts them as links.
  const urlRanges = []
  for (const u of text.matchAll(/(https?:\/\/\s*[^\s<>"')\]]+|(?<![\w@.])www\.[^\s<>"')\]]+)/gi)) {
    urlRanges.push([u.index, u.index + u[0].length])
  }
  const inUrl = idx => urlRanges.some(([a, b]) => idx >= a && idx < b)

  // Claimed character spans, so a longer alias blocks a shorter one inside it.
  const taken = []
  const overlaps = (a, b) => taken.some(([x, y]) => a < y && b > x)

  for (const m of matchers) {
    m.rx.lastIndex = 0
    let hit
    while ((hit = m.rx.exec(text)) !== null) {
      const a = hit.index, b = a + hit[0].length
      if (overlaps(a, b) || inUrl(a)) continue
      taken.push([a, b])
      const ctxDep = Object.hasOwn(CONTEXT_DEPENDENT, hit[0])
      mentions.push({
        postNum: p.postNum, postId: p.id,
        sourceText: hit[0],
        canonicalEntity: ctxDep ? null : m.entity.canonical,
        entityType: ctxDep ? 'other' : m.entity.type,
        aliasUsed: m.alias,
        contextDependent: ctxDep,
        contextNote: ctxDep ? CONTEXT_DEPENDENT[hit[0]] : null,
        inQAuthoredText: !inSource(a),
        confidence: ctxDep ? 'LOW' : CASE_SENSITIVE.has(m.alias) ? 'MEDIUM' : 'HIGH',
      })
    }
  }

  // Shorthand with no registry entry at all — recorded so the tail is visible, not guessed at.
  for (const tok of Object.keys(CONTEXT_DEPENDENT)) {
    const rx = new RegExp(`(?<![A-Za-z0-9_])${esc(tok)}(?![A-Za-z0-9_])`, 'g')
    let hit
    while ((hit = rx.exec(text)) !== null) {
      if (taken.some(([x, y]) => hit.index < y && hit.index + hit[0].length > x)) continue
      if (inUrl(hit.index)) continue
      taken.push([hit.index, hit.index + hit[0].length])
      mentions.push({
        postNum: p.postNum, postId: p.id,
        sourceText: hit[0], canonicalEntity: null, entityType: 'other',
        aliasUsed: hit[0], contextDependent: true, contextNote: CONTEXT_DEPENDENT[hit[0]],
        inQAuthoredText: !inSource(hit.index), confidence: 'LOW',
      })
    }
  }

  // What the old extractor stored that the registry does not cover — the review queue.
  for (const e of p.postAnalysis?.namedEntities ?? []) {
    if (SIGNATURE_TOKENS.has(e.trim())) continue
    const k = e.trim()
    if (!k) continue
    const covered = matchers.some(m => m.alias.toLowerCase() === k.toLowerCase() || m.entity.canonical.toLowerCase() === k.toLowerCase())
    if (!covered) unresolvedTokens.set(k, (unresolvedTokens.get(k) ?? 0) + 1)
  }
}

// ── totals ───────────────────────────────────────────────────────────────────
const qAuthored = mentions.filter(m => m.inQAuthoredText)
const resolved = qAuthored.filter(m => m.canonicalEntity)
const byEntity = new Map()
for (const m of resolved) {
  if (!byEntity.has(m.canonicalEntity)) byEntity.set(m.canonicalEntity, { type: m.entityType, mentions: 0, posts: new Set(), aliases: new Map() })
  const e = byEntity.get(m.canonicalEntity)
  e.mentions++; e.posts.add(m.postNum)
  e.aliases.set(m.sourceText, (e.aliases.get(m.sourceText) ?? 0) + 1)
}
const byType = {}
for (const m of resolved) byType[m.entityType] = (byType[m.entityType] ?? 0) + 1

const storedTotal = posts.reduce((n, p) => n + (p.postAnalysis?.namedEntities?.length ?? 0), 0)
const storedSignature = posts.reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).filter(e => SIGNATURE_TOKENS.has(e.trim())).length, 0)

const totals = {
  mentions: mentions.length,
  inQAuthoredText: qAuthored.length,
  insideQuotedSource: mentions.length - qAuthored.length,
  resolvedToCanonical: resolved.length,
  contextDependent: qAuthored.filter(m => m.contextDependent).length,
  distinctEntities: byEntity.size,
  posts: new Set(qAuthored.map(m => m.postNum)).size,
  byType,
  storedExtractor: { total: storedTotal, signatureRows: storedSignature, uncoveredDistinct: unresolvedTokens.size },
}

const top = [...byEntity].sort((a, b) => b[1].mentions - a[1].mentions)
fs.writeFileSync(path.join(OUT, 'entities-audit.json'), JSON.stringify({
  scope: 'full-corpus entity audit v1', productionChanged: false, totals,
  entities: top.map(([canonical, e]) => ({
    canonical, type: e.type, mentions: e.mentions, posts: e.posts.size,
    aliases: [...e.aliases].sort((a, b) => b[1] - a[1]).map(([text, n]) => ({ text, n })),
  })),
  uncovered: [...unresolvedTokens].sort((a, b) => b[1] - a[1]).map(([text, n]) => ({ text, n })),
  mentions,
}, null, 1))

const md = ['# Q Drops — Entity audit (v1, candidate)\n']
md.push('Every mention keeps its exact source wording. Canonicalisation is a layer on top and never a rewrite. **No production write, no deploy.**\n')
md.push('\n## Why a raw token count would be wrong\n')
md.push(`| Excluded | Count | Why |`)
md.push('|---|---|---|')
md.push(`| Q's signature | ${storedSignature.toLocaleString()} | "Q" is the top stored entity, and every one is Q signing a drop, not naming someone |`)
md.push(`| Mentions inside quoted source | ${totals.insideQuotedSource.toLocaleString()} | an article Q pasted naming Comey is not Q naming Comey |`)
md.push(`| Ambiguous shorthand | ${totals.contextDependent.toLocaleString()} | recorded as the literal token, never resolved to a person |`)
md.push('\n## Totals\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Mentions in Q-authored text | **${totals.inQAuthoredText.toLocaleString()}** |`)
md.push(`| — resolved to a canonical entity | ${totals.resolvedToCanonical.toLocaleString()} |`)
md.push(`| — context-dependent, unresolved | ${totals.contextDependent.toLocaleString()} |`)
md.push(`| Distinct canonical entities | ${totals.distinctEntities.toLocaleString()} |`)
md.push(`| Posts containing a mention | ${totals.posts.toLocaleString()} |`)
md.push('\n### By type\n')
md.push('| Type | Mentions |')
md.push('|---|---|')
for (const t of ENTITY_TYPES) if (byType[t]) md.push(`| ${t.replace(/_/g, ' ')} | ${byType[t].toLocaleString()} |`)
md.push('\n## Entities, with the aliases Q actually used\n')
md.push('| Entity | Type | Mentions | Posts | Aliases used |')
md.push('|---|---|---|---|---|')
for (const [c, e] of top.slice(0, 60)) {
  const al = [...e.aliases].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ×${n}`).join(', ')
  md.push(`| ${c} | ${e.type.replace(/_/g, ' ')} | ${e.mentions.toLocaleString()} | ${e.posts.size.toLocaleString()} | ${al.slice(0, 90)} |`)
}
md.push('\n## Context-dependent shorthand — deliberately unresolved\n')
md.push('| Token | Why it is not resolved |')
md.push('|---|---|')
for (const [tok, why] of Object.entries(CONTEXT_DEPENDENT)) md.push(`| \`${tok}\` | ${why} |`)
md.push(`\n## Review queue — ${unresolvedTokens.size.toLocaleString()} stored entity strings the registry does not cover\n`)
md.push('| Stored string | Times stored |')
md.push('|---|---|')
for (const [t, n] of [...unresolvedTokens].sort((a, b) => b[1] - a[1]).slice(0, 60)) md.push(`| ${t} | ${n} |`)
fs.writeFileSync(path.join(OUT, 'entities-audit.md'), md.join('\n') + '\n')

console.log('\nENTITY AUDIT v1\n')
console.log(`  mentions found            : ${totals.mentions.toLocaleString()}`)
console.log(`    in Q-authored text      : ${totals.inQAuthoredText.toLocaleString()}`)
console.log(`    inside quoted source    : ${totals.insideQuotedSource.toLocaleString()}  (excluded)`)
console.log(`  resolved to canonical     : ${totals.resolvedToCanonical.toLocaleString()}`)
console.log(`  context-dependent         : ${totals.contextDependent.toLocaleString()}  (never guessed)`)
console.log(`  distinct entities         : ${totals.distinctEntities.toLocaleString()}`)
console.log(`  posts                     : ${totals.posts.toLocaleString()}`)
console.log(`\n  stored extractor rows     : ${storedTotal.toLocaleString()} (${storedSignature.toLocaleString()} were Q's signature)`)
console.log(`  stored strings uncovered  : ${unresolvedTokens.size.toLocaleString()} distinct — review queue`)
console.log('\n  by type:')
for (const t of ENTITY_TYPES) if (byType[t]) console.log(`    ${String(byType[t]).padStart(5)}  ${t}`)
console.log('\n→ audit/entities-audit.md\n')
