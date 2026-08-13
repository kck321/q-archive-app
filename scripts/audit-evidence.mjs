// Evidence & References audit — full corpus.
//
// Seeded from work already done rather than started fresh: the 927 source-material units the
// Claims audit held out are already classified quoted/pasted material with provenance, and the
// reference recovery already resolved every ">>" pointer.
//
// The section answers: what evidence or source material did Q point to?
//
// Counting follows the house rule established across Questions, Directives and Claims:
// OCCURRENCES are counted from the occurrence data, and distinct is reported separately. The
// same link posted in six drops is six occurrences of one URL — collapsing them would hide
// how often Q returned to a source.
//
// Including a reference does NOT mean Q Drops verifies the source, and this audit records
// nothing about whether a source supports whatever Q said near it.
//
// AUDIT ONLY — no production write, no deploy. All five certified sections frozen.
//
//   node scripts/audit-evidence.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const v2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/claims-audit.json'), 'utf8'))

const URL_RX = /(https?:\/\/[^\s<>"')\]]+|(?<![\w@.])www\.[^\s<>"')\]]+)/gi
// Hosts that no longer serve: the board itself and its onion mirrors. Media is served from the
// qalerts mirror instead (see src/lib/mediaUrl.ts), so these are archived, not lost.
const DEAD_HOST = /(8ch\.net|8kun\.net|8kun\.top|\.onion)/i

const domainOf = u => (u.replace(/^https?:\/\//i, '').split('/')[0] || '').replace(/^www\./i, '').toLowerCase()

// Map the source-material provenance reasons onto reader-facing subtypes.
const SUBTYPE = {
  'sustained prose block — pasted or quoted passage': 'pasted passage',
  'greentext excerpt': 'greentext excerpt',
  'excerpt beneath a source link': 'excerpt beneath a link',
  'inside a multi-line quotation': 'quotation',
  'opens a multi-line quotation': 'quotation',
  'numbered definition': 'definition',
  'numbered definition (continuation)': 'definition',
  'dictionary entry': 'definition',
  'dictionary entry (continuation)': 'definition',
  'founding document': 'founding document',
  'founding document (continuation)': 'founding document',
  scripture: 'scripture',
  'scripture (continuation)': 'scripture',
  'quoted FAQ question': 'quoted Q&A',
  'quoted FAQ answer': 'quoted Q&A',
}

const items = []
const add = o => items.push(o)

for (const p of posts) {
  const text = clean(p.text ?? '')
  const sourceProvided = /https?:\/\//i.test(text)

  // 1 — external links Q posted
  for (const u of text.match(URL_RX) ?? []) {
    const d = domainOf(u)
    add({
      kind: 'EXTERNAL_LINK', subtype: DEAD_HOST.test(u) ? 'board archive' : 'web link',
      postNum: p.postNum, postId: p.id,
      value: u, domain: d,
      archived: DEAD_HOST.test(u),
      provenance: 'URL in the drop text',
    })
  }

  // 2 — media attached to the drop
  for (const m of p.media ?? []) {
    const u = m.url ?? ''
    add({
      kind: 'MEDIA', subtype: /\.(mp4|webm|mov)$/i.test(u) ? 'video' : 'image',
      postNum: p.postNum, postId: p.id,
      value: u, domain: domainOf(u),
      archived: DEAD_HOST.test(u),
      provenance: 'file attached to the drop',
    })
  }

  // 3 — internal references to other Q drops
  for (const r of text.match(/>>\d+/g) ?? []) {
    add({
      kind: 'INTERNAL_REFERENCE', subtype: 'Q drop pointer',
      postNum: p.postNum, postId: p.id,
      value: r, domain: null, archived: false,
      provenance: 'pointer to another drop; quoted content recovered from the board archive',
    })
  }
}

// 4 — quoted / pasted source text, already classified by the Claims audit
for (const s of v2.sourceRows) {
  add({
    kind: 'QUOTED_SOURCE', subtype: SUBTYPE[s.provenance.reason] ?? 'quoted material',
    postNum: s.postNum, postId: s.postId,
    value: s.exactText, domain: null, archived: false,
    provenance: s.provenance.reason,
  })
}

// ── totals ───────────────────────────────────────────────────────────────────
const byKind = {}
const bySubtype = {}
for (const i of items) {
  byKind[i.kind] = (byKind[i.kind] ?? 0) + 1
  const k = `${i.kind} · ${i.subtype}`
  bySubtype[k] = (bySubtype[k] ?? 0) + 1
}
const links = items.filter(i => i.kind === 'EXTERNAL_LINK')
const domains = new Map()
for (const l of links) domains.set(l.domain, (domains.get(l.domain) ?? 0) + 1)

const totals = {
  occurrences: items.length,
  posts: new Set(items.map(i => i.postNum)).size,
  byKind,
  externalLinks: {
    occurrences: links.length,
    distinctUrls: new Set(links.map(l => l.value)).size,
    domains: domains.size,
    archivedBoardLinks: links.filter(l => l.archived).length,
    posts: new Set(links.map(l => l.postNum)).size,
  },
  media: {
    occurrences: items.filter(i => i.kind === 'MEDIA').length,
    posts: new Set(items.filter(i => i.kind === 'MEDIA').map(i => i.postNum)).size,
    mirrored: items.filter(i => i.kind === 'MEDIA' && i.archived).length,
  },
  internalReferences: {
    occurrences: items.filter(i => i.kind === 'INTERNAL_REFERENCE').length,
    posts: new Set(items.filter(i => i.kind === 'INTERNAL_REFERENCE').map(i => i.postNum)).size,
  },
  quotedSource: {
    occurrences: items.filter(i => i.kind === 'QUOTED_SOURCE').length,
    posts: new Set(items.filter(i => i.kind === 'QUOTED_SOURCE').map(i => i.postNum)).size,
  },
}
fs.writeFileSync(path.join(OUT, 'evidence-audit.json'), JSON.stringify({ scope: 'full-corpus evidence & references audit v1', productionChanged: false, totals, items }, null, 1))

const md = ['# Q Drops — Evidence & References audit (v1, candidate)\n']
md.push('Seeded from work already done rather than started fresh: the 927 source-material units the Claims audit held out are already classified with provenance, and the reference recovery already resolved every `>>` pointer. **No production write, no deploy.**\n')
md.push('\n> Including a reference does not mean Q Drops verifies the source. This audit records what Q pointed to, never whether it supports what Q said near it.\n')
md.push('\n## Totals\n')
md.push('| Kind | Occurrences | Posts |')
md.push('|---|---|---|')
md.push(`| External links | ${totals.externalLinks.occurrences.toLocaleString()} | ${totals.externalLinks.posts.toLocaleString()} |`)
md.push(`| Media (images / video) | ${totals.media.occurrences.toLocaleString()} | ${totals.media.posts.toLocaleString()} |`)
md.push(`| Internal drop references | ${totals.internalReferences.occurrences.toLocaleString()} | ${totals.internalReferences.posts.toLocaleString()} |`)
md.push(`| Quoted / pasted source text | ${totals.quotedSource.occurrences.toLocaleString()} | ${totals.quotedSource.posts.toLocaleString()} |`)
md.push(`| **Total** | **${totals.occurrences.toLocaleString()}** | **${totals.posts.toLocaleString()}** |`)
md.push('\n### External links\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Occurrences | ${totals.externalLinks.occurrences.toLocaleString()} |`)
md.push(`| Distinct URLs | ${totals.externalLinks.distinctUrls.toLocaleString()} |`)
md.push(`| Domains | ${totals.externalLinks.domains.toLocaleString()} |`)
md.push(`| Board links now served from the archive | ${totals.externalLinks.archivedBoardLinks.toLocaleString()} |`)
md.push('\nMost-cited domains:\n')
md.push('| Domain | Links |')
md.push('|---|---|')
for (const [d, n] of [...domains].sort((a, b) => b[1] - a[1]).slice(0, 20)) md.push(`| ${d} | ${n.toLocaleString()} |`)
md.push('\n### Quoted / pasted source text, by subtype\n')
md.push('| Subtype | Units |')
md.push('|---|---|')
for (const [k, n] of Object.entries(bySubtype).filter(([k]) => k.startsWith('QUOTED_SOURCE')).sort((a, b) => b[1] - a[1])) {
  md.push(`| ${k.replace('QUOTED_SOURCE · ', '')} | ${n.toLocaleString()} |`)
}
md.push('\n## Two decisions before this can be certified\n')
md.push('\n### 1. Do internal `>>` pointers belong in this section?\n')
md.push(`There are **${totals.internalReferences.occurrences.toLocaleString()}** pointers to other drops across ${totals.internalReferences.posts.toLocaleString()} posts. They are genuinely references — Q citing his own earlier material — but they are not *external* source material, and the section definition reads "material Q presents or points readers toward as supporting information or source material". Counting them would make Q's self-citation the largest single category after links.\n`)
md.push('They are recorded separately above so the call is yours: include, exclude, or show as their own sub-section.\n')
md.push('\n### 2. Counting occurrences vs distinct sources\n')
md.push(`Links are counted as **occurrences** (${totals.externalLinks.occurrences.toLocaleString()}) with distinct URLs reported alongside (${totals.externalLinks.distinctUrls.toLocaleString()}), matching the rule used for Questions, Directives and Claims. The same article cited in six drops is six occurrences of one source — collapsing them would hide how often Q returned to it. Confirm that reading for this section too.\n`)
fs.writeFileSync(path.join(OUT, 'evidence-audit.md'), md.join('\n') + '\n')

console.log('\nEVIDENCE & REFERENCES — v1\n')
console.log(`  external links     : ${totals.externalLinks.occurrences.toLocaleString()}  (${totals.externalLinks.distinctUrls.toLocaleString()} distinct URLs, ${totals.externalLinks.domains} domains)`)
console.log(`  media              : ${totals.media.occurrences.toLocaleString()}  (${totals.media.posts.toLocaleString()} posts, ${totals.media.mirrored.toLocaleString()} served from the archive)`)
console.log(`  internal refs      : ${totals.internalReferences.occurrences.toLocaleString()}  (${totals.internalReferences.posts.toLocaleString()} posts)`)
console.log(`  quoted source text : ${totals.quotedSource.occurrences.toLocaleString()}  (${totals.quotedSource.posts.toLocaleString()} posts)`)
console.log(`\n  TOTAL              : ${totals.occurrences.toLocaleString()} across ${totals.posts.toLocaleString()} posts`)
console.log('\n→ audit/evidence-audit.md\n')
