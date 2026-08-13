// Adjudicate the Evidence & References boundary cases, materialise the certified dataset,
// and gate it.
//
// Written to public/data/evidence.json so the APP READS THE CERTIFIED SET rather than
// re-deriving links from post text. src/lib/posts.ts used a different URL pattern from the
// audit — no bare "www.", no handling for the board's space-broken protocol — so the page and
// the certified figure would have disagreed the moment they shipped together. Counting comes
// from the certified rows, exactly as it now does for Questions, Directives and Claims.
//
// THE TWO ADJUDICATIONS:
//
//   20 links printed inside pasted source material
//       An article's own hyperlinks are not Q citing something. Preserved and kept attached
//       to the block that contains them, with countsAsQCitation false, and excluded from the
//       External Links total.
//
//   152 internal ">>" pointers whose target was never recoverable
//       Still genuine references — Q did point at them — so they stay as occurrences, marked
//       resolved:false / quotedContentAvailable:false. The UI must not offer a content link
//       for these, and calls them an "Unresolved archive reference": the historical target
//       could not be recovered, which is not an app defect.
//
//   node scripts/apply-evidence.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/evidence-audit.json'), 'utf8'))

const items = audit.items.map(i => {
  const o = { ...i }
  if (o.kind === 'EXTERNAL_LINK') {
    o.countsAsQCitation = !o.insideQuotedSource
    if (o.insideQuotedSource) {
      o.subtype = 'embedded_in_source_material'
      o.provenance = 'a hyperlink printed inside pasted source material — the article\'s own link, not Q citing it'
    }
    delete o.insideQuotedSource
  }
  if (o.kind === 'INTERNAL_REFERENCE') {
    o.quotedContentAvailable = Boolean(o.resolved)
    o.label = o.resolved ? 'Internal Q reference' : 'Unresolved archive reference'
    if (!o.resolved) o.provenance = 'Q pointed at this drop, but the historical target could not be recovered from the board archive'
  }
  if (o.kind === 'MEDIA') o.countsAsQCitation = true
  return o
})

const links = items.filter(i => i.kind === 'EXTERNAL_LINK')
const citations = links.filter(i => i.countsAsQCitation)
const embedded = links.filter(i => !i.countsAsQCitation)
const media = items.filter(i => i.kind === 'MEDIA')
const refs = items.filter(i => i.kind === 'INTERNAL_REFERENCE')
const quoted = items.filter(i => i.kind === 'QUOTED_SOURCE')

const domains = new Set(citations.map(l => l.domain))
const totals = {
  occurrences: items.length,
  posts: new Set(items.map(i => i.postNum)).size,
  externalLinks: {
    qCitations: citations.length,
    distinctUrls: new Set(citations.map(l => l.value)).size,
    domains: domains.size,
    embeddedInSourceMaterial: embedded.length,
    posts: new Set(citations.map(l => l.postNum)).size,
  },
  media: {
    occurrences: media.length,
    distinctAssets: new Set(media.map(m => m.value)).size,
    posts: new Set(media.map(m => m.postNum)).size,
    archiveMirror: media.filter(m => m.archived).length,
    originalHost: media.filter(m => !m.archived).length,
  },
  internalReferences: {
    occurrences: refs.length,
    distinctReferencedPosts: new Set(refs.map(r => r.referencedBoardId)).size,
    resolved: refs.filter(r => r.resolved).length,
    unresolved: refs.filter(r => !r.resolved).length,
    posts: new Set(refs.map(r => r.postNum)).size,
  },
  quotedSource: {
    occurrences: quoted.length,
    distinctPassages: new Set(quoted.map(q => key(q.value))).size,
    posts: new Set(quoted.map(q => q.postNum)).size,
  },
}

// ── QA gate ─────────────────────────────────────────────────────────────────
const checks = [
  ['total reference occurrences = 6,590', items.length === 6590, items.length],
  ['embedded-source links excluded from citations = 20', embedded.length === 20, embedded.length],
  ['Q citation links = 2,724', citations.length === 2724, citations.length],
  ['media occurrences = 1,271', media.length === 1271, media.length],
  ['internal references = 1,648', refs.length === 1648, refs.length],
  ['  resolved = 1,496', totals.internalReferences.resolved === 1496, totals.internalReferences.resolved],
  ['  unresolved = 152', totals.internalReferences.unresolved === 152, totals.internalReferences.unresolved],
  ['quoted source = 927', quoted.length === 927, quoted.length],
  ['mirrored media = 1,160', totals.media.archiveMirror === 1160, totals.media.archiveMirror],
  ['every unresolved ref offers no content', refs.filter(r => !r.resolved && r.quotedContentAvailable).length === 0, 'ok'],
  ['every embedded link keeps its URL', embedded.every(l => Boolean(l.value)), 'ok'],
]

console.log('\nAPPLY CERTIFIED EVIDENCE & REFERENCES\n')
console.log(`  external links  : ${citations.length.toLocaleString()} Q citations / ${totals.externalLinks.distinctUrls.toLocaleString()} distinct URLs / ${domains.size} domains`)
console.log(`                    ${embedded.length} embedded in source material, excluded from citations`)
console.log(`  media           : ${media.length.toLocaleString()} / ${totals.media.distinctAssets.toLocaleString()} distinct  (${totals.media.archiveMirror.toLocaleString()} mirrored, ${totals.media.originalHost} original host)`)
console.log(`  internal refs   : ${refs.length.toLocaleString()} / ${totals.internalReferences.distinctReferencedPosts.toLocaleString()} distinct  (${totals.internalReferences.resolved.toLocaleString()} resolved, ${totals.internalReferences.unresolved} unresolved)`)
console.log(`  quoted source   : ${quoted.length.toLocaleString()} / ${totals.quotedSource.distinctPassages.toLocaleString()} distinct`)
console.log(`  TOTAL           : ${items.length.toLocaleString()} across ${totals.posts.toLocaleString()} posts`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(42)} ${got}`) }
if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: evidence.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'evidence.json'), JSON.stringify({ certified: true, totals, items }))
console.log(`\nwrote public/data/evidence.json (${(fs.statSync(path.join(DATA, 'evidence.json')).size / 1048576).toFixed(2)} MB)\n`)
