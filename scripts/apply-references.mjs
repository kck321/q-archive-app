// Merge scraped reference content into public/data/posts.json as `quotedPosts`.
//
// Run scripts/scrape-references.mjs first. Idempotent: re-running replaces quotedPosts
// rather than appending, so it is safe to scrape more and re-apply.
//
//   node scripts/apply-references.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POSTS = path.join(ROOT, 'public', 'data', 'posts.json')
const CACHE = path.join(ROOT, 'scripts', '.cache', 'references.jsonl')
const dry = process.argv.includes('--dry')

if (!fs.existsSync(CACHE)) {
  console.error('no scrape cache — run: node scripts/scrape-references.mjs')
  process.exit(1)
}

const scraped = new Map()
let failedRows = 0
for (const line of fs.readFileSync(CACHE, 'utf8').split('\n')) {
  if (!line.trim()) continue
  let r
  try { r = JSON.parse(line) } catch { continue }
  if (r.error || !Array.isArray(r.refs)) { failedRows++; continue }
  scraped.set(r.postNum, r.refs)          // later rows win — a re-scrape supersedes
}

const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'))

// ── the quote chain ────────────────────────────────────────────────────────────
// A quoted post usually quotes something itself, and that content is part of what the drop
// is about. #2124 quotes #2123, which quotes the anon who says MOSSAD — which is why qalerts
// returns #2124 for that search and we returned nothing. Every scraped reference goes into
// one pool keyed by board id, so a chain can be walked without any further fetching.
const pool = new Map()
for (const refs of scraped.values()) {
  for (const r of refs) if (r.boardId && !pool.has(r.boardId)) pool.set(r.boardId, r)
}
// Drops we hold are quotable too, in case the chain reaches one nobody happened to quote.
const asQDrop = new Map()
for (const p of posts) {
  const m = (p.link ?? '').match(/#(\d+)\s*$/)
  if (m && !asQDrop.has(m[1])) asQDrop.set(m[1], p)
}

const MAX_DEPTH = 4     // deepest observed chain is 3; the cap is a cycle backstop
const pointersIn = text => [...new Set((text ?? '').match(/>>(\d+)/g) ?? [])].map(r => r.slice(2))

function recordFor(boardId) {
  const r = pool.get(boardId)
  if (r) return { ...r, boardId }
  const p = asQDrop.get(boardId)
  if (!p) return null
  return {
    boardId,
    link: p.link ?? '',
    name: p.name || 'Q',
    trip: p.trip ?? '',
    userId: p.userId ?? '',
    time: '',
    text: p.text ?? '',
    media: p.media ?? [],
  }
}

/** Every post in the drop's reply chain, nearest first, deduped and cycle-safe. */
function walkChain(startText) {
  const seen = new Set()
  const out = []
  let layer = pointersIn(startText)
  for (let depth = 0; depth < MAX_DEPTH && layer.length; depth++) {
    const next = []
    for (const id of layer) {
      if (seen.has(id)) continue
      seen.add(id)
      const rec = recordFor(id)
      if (!rec) continue
      out.push({ ...rec, depth })
      next.push(...pointersIn(rec.text))
    }
    layer = next
  }
  return out
}

let touched = 0, quoted = 0, chars = 0, unblanked = 0, withMedia = 0
const anonCount = { Anonymous: 0, Q: 0, other: 0 }

let chained = 0
for (const p of posts) {
  const refs = walkChain(p.text ?? '')
  if (!refs.length) { delete p.quotedPosts; continue }
  const pointerOnly = /^(>>\d+\s*)+$/.test((p.text ?? '').trim())
  p.quotedPosts = refs.map(r => ({
    boardId: r.boardId ?? '',
    link: r.link ?? '',
    name: r.name ?? '',
    trip: r.trip ?? '',
    userId: r.userId ?? '',
    time: r.time ?? '',
    text: r.text ?? '',
    media: Array.isArray(r.media) ? r.media : [],
    depth: r.depth ?? 0,
  }))
  touched++
  quoted += refs.length
  chained += refs.filter(r => r.depth > 0).length
  if (pointerOnly) unblanked++
  for (const r of refs) {
    chars += (r.text ?? '').length
    if (r.media?.length) withMedia++
    const k = r.name === 'Q' ? 'Q' : r.name === 'Anonymous' ? 'Anonymous' : 'other'
    anonCount[k]++
  }
}

console.log(`drops given quoted content : ${touched}`)
console.log(`quoted posts recovered     : ${quoted}`)
console.log(`  reached via the chain    : ${chained}  (a quote's own quote)`)
console.log(`  by Anonymous             : ${anonCount.Anonymous}`)
console.log(`  by Q                     : ${anonCount.Q}`)
console.log(`  other/unnamed            : ${anonCount.other}`)
console.log(`  carrying images          : ${withMedia}`)
console.log(`text recovered             : ${chars.toLocaleString()} characters`)
console.log(`pointer-only drops fixed   : ${unblanked}  (were blank rows)`)
if (failedRows) console.log(`scrape rows skipped        : ${failedRows}`)

if (dry) { console.log('\n--dry: posts.json not written'); process.exit(0) }
fs.writeFileSync(POSTS, JSON.stringify(posts))
console.log(`\nwrote ${path.relative(ROOT, POSTS)} (${(fs.statSync(POSTS).size / 1e6).toFixed(1)} MB)`)
