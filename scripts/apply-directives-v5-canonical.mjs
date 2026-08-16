// Push the v5 adjudication down into the CANONICAL Directive artifacts.
//
// The migration is not finished when posts.json changes — posts.json is a derived cache.
// `apply-directives.mjs` rebuilds `actionRequests` from `audit/directives-final.json` plus
// `audit/directives-owner-rulings.json` on every chain run, so a migration that lives only in
// the cache is reverted by the next rebuild. This script moves it to the source of truth.
//
// It also writes `audit/directives-v5-spans.json`: the span, segment and provenance metadata
// that apply-directives.mjs attaches as `post.directiveMeta`.
//
//   node scripts/apply-directives-v5-canonical.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dry = process.argv.includes('--dry')
const spansOnly = process.argv.includes('--spans-only')   // regenerate the spans artifact alone
const rd = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

// ── RUN-ONCE GUARD ──────────────────────────────────────────────────────────
//
// This script is NOT idempotent and must never run twice. It removes rows from the canonical
// artifacts using a quota derived from the v5 adjudication, and v5 is itself derived from
// posts.json. Run it a second time and v5 has been rebuilt over the ALREADY-MIGRATED posts, so
// its stable occurrence IDs point at different sentences — `1183#0` stops meaning "Push to
// DIVIDE is strong." and starts meaning "Think pre vs post 2016 election.", the record that now
// occupies index 0. The second run then deletes three innocent directives.
//
// That happened on 16 Aug 2026. The three rows (#1183, #566, #617) were recovered from the
// pre-migration posts.json backup and audit/directives-certified.json. This guard is why it
// cannot happen again.
const fin = rd('audit/directives-final.json')
if (fin.totals?.v5Migration && !spansOnly) {
  console.error('ABORT: audit/directives-final.json already carries a v5Migration stamp.')
  console.error('This script is not idempotent — see the RUN-ONCE GUARD comment. To re-run it,')
  console.error('restore the pre-migration artifacts first.')
  process.exit(1)
}
const own = rd('audit/directives-owner-rulings.json')
const v5 = rd('audit/source-spans-v2/directives-adjudication-v5-final.json')
const KEEP = new Set(['KEEP_Q_DIRECTIVE', 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', 'SPLIT_MIXED_SENTENCE'])
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

// How many occurrences of each (post, normalised text) v5 removes, and which it expands.
const removeQuota = new Map()
const expansions = new Map()
for (const r of v5.rows) {
  const k = `${r.postNum}|${key(r.storedPhrase)}`
  if (!KEEP.has(r.ruling)) removeQuota.set(k, (removeQuota.get(k) ?? 0) + 1)
  else if (r.sentenceExpanded === 'true') expansions.set(k, r.fullSentence)
}

// ── directives-final.json ────────────────────────────────────────────────────
const quota = new Map(removeQuota)
const keptRows = []
let removedFin = 0, expandedFin = 0
for (const row of fin.rows) {
  const k = `${row.postNum}|${key(row.qSourceText)}`
  if ((quota.get(k) ?? 0) > 0) { quota.set(k, quota.get(k) - 1); removedFin++; continue }
  if (expansions.has(k)) { row.qSourceText = expansions.get(k); expandedFin++ }
  keptRows.push(row)
}

// ── directives-owner-rulings.json ────────────────────────────────────────────
const keptRulings = []
let removedOwn = 0, expandedOwn = 0
for (const r of (own.rulings ?? [])) {
  const k = `${r.postNum}|${key(r.sourceText)}`
  if ((quota.get(k) ?? 0) > 0) { quota.set(k, quota.get(k) - 1); removedOwn++; continue }
  if (expansions.has(k)) { r.sourceText = expansions.get(k); expandedOwn++ }
  keptRulings.push(r)
}

const unspent = spansOnly ? [] : [...quota].filter(([, n]) => n > 0)
if (unspent.length) {
  console.error('ABORT: removals that matched no canonical row:', unspent.slice(0, 10))
  process.exit(1)
}

// ── recompute directives-final totals from the surviving rows ────────────────
const famTally = {}
for (const r of keptRows) famTally[r.family] = (famTally[r.family] ?? 0) + 1
const allKept = [...keptRows.map(r => ({ postNum: r.postNum, text: r.qSourceText })),
  ...keptRulings.map(r => ({ postNum: r.postNum, text: r.sourceText }))]
const distinct = new Set(allKept.map(d => key(d.text)))
const postsWith = new Set(allKept.map(d => d.postNum))
const groups = new Map()
for (const d of allKept) { const k = `${d.postNum}|${key(d.text)}`; groups.set(k, (groups.get(k) ?? 0) + 1) }
const inPostRepeats = allKept.length - groups.size

fin.rows = keptRows
fin.totals = {
  ...fin.totals,
  occurrences: keptRows.length,
  distinct: new Set(keptRows.map(r => key(r.qSourceText))).size,
  posts: new Set(keptRows.map(r => r.postNum)).size,
  inPostRepeats: keptRows.length - new Set(keptRows.map(r => `${r.postNum}|${key(r.qSourceText)}`)).size,
  byFamily: famTally,
  familySum: Object.values(famTally).reduce((a, b) => a + b, 0),
  v5Migration: {
    appliedOn: '2026-08-16',
    removedFromDirectivesFinal: removedFin,
    removedFromOwnerRulings: removedOwn,
    displaySpansExpanded: expandedFin + expandedOwn,
    note: 'Directives-only migration to sourceSpansV2 provenance. Removal is from Q Directives only — post text, themes, questions, claims, quoted-source and image evidence are untouched.',
  },
}
own.rulings = keptRulings

// ── the span/segment artifact apply-directives.mjs attaches ──────────────────
const spans = {}
for (const r of v5.rows) {
  if (!KEEP.has(r.ruling)) continue
  const text = r.sentenceExpanded === 'true' ? r.fullSentence : r.storedPhrase
  const k = `${r.postNum}|${key(text)}`
  spans[k] = {
    stableOccurrenceId: r.stableOccurrenceId,
    directiveSegments: r.directiveSegments,
    ...(r.religiousSegment ? { religiousSegment: r.religiousSegment } : {}),
    ...(r.themes ? { themes: r.themes.split('|') } : {}),
    authorshipState: r.authorshipState,
    sourceType: r.sourceType,
    ...(r.alsoQuotedInPayload === 'true' ? { alsoQuotedInPayload: true } : {}),
    ...(r.referencedPostNum ? { referencedPostNum: Number(r.referencedPostNum) } : {}),
    ...(r.fragmentRepaired === 'true' ? { fragmentRepaired: true } : {}),
  }
}

console.log('\nCANONICAL DIRECTIVE ARTIFACTS — v5\n')
console.log(`  directives-final.json rows   : ${fin.rows.length}  (was 2422, removed ${removedFin}, expanded ${expandedFin})`)
console.log(`  owner rulings                : ${own.rulings.length}  (was 283, removed ${removedOwn}, expanded ${expandedOwn})`)
console.log(`  total certified occurrences  : ${allKept.length}`)
console.log(`  distinct (post,text) groups  : ${groups.size}   in-post repeats: ${inPostRepeats}`)
console.log(`  distinct normalised phrases  : ${distinct.size}`)
console.log(`  posts with a directive       : ${postsWith.size}`)
console.log(`  span/segment entries         : ${Object.keys(spans).length}`)

if (dry) { console.log('\nDRY RUN — nothing written.'); process.exit(0) }

fs.writeFileSync(path.join(ROOT, 'audit/directives-final.json'), JSON.stringify(fin, null, 1))
fs.writeFileSync(path.join(ROOT, 'audit/directives-owner-rulings.json'), JSON.stringify(own, null, 1))
fs.writeFileSync(path.join(ROOT, 'audit/directives-v5-spans.json'), JSON.stringify({
  note: 'Span, segment and provenance metadata for every certified Directive, keyed by "postNum|normalisedText". Attached to posts as directiveMeta by apply-directives.mjs.',
  total: Object.keys(spans).length, spans,
}, null, 1))
console.log('\nwrote audit/directives-final.json · audit/directives-owner-rulings.json · audit/directives-v5-spans.json')
console.log('EXPECTED GATE VALUES for apply-directives.mjs:')
console.log(`  occurrences ${allKept.length} · owner rulings ${own.rulings.length} · distinct ${distinct.size} · posts ${postsWith.size}`)
