// Global search over the certified archive.
//
// Two questions, one box: "where does this exact thing appear?" and "what certified analysis is
// connected to it?" The first is answered by the drops themselves, the second by the index built
// from the certified sections.
//
// Search classifies NOTHING. Every record arrived from a section that already certified it and
// carries that section's own metadata, so a filter for a directive family or an evidence subtype
// is reading the audit's answer rather than re-deciding it here.

import { getAllPosts } from './posts'

export type SearchRow = {
  s: string          // section
  p: number | null   // post number
  i: string | null   // post id, for the deep link
  t: string          // display text
  w: string          // why this can match — shown on every result
  f: Record<string, unknown>
  q?: boolean        // false ONLY for editorial rows
  src?: string | null
}

export interface SearchIndex {
  totals: { records: number; bySection: Record<string, number> }
  rows: SearchRow[]
}

export type Filters = {
  sections?: string[]
  postNum?: number
  from?: string
  to?: string
  entityType?: string
  theme?: string
  family?: string
  subtype?: string
  codeType?: string
  emphasisType?: string
  conclusion?: boolean
  checkable?: boolean
  sourceProvided?: boolean
  unresolvedOnly?: boolean
}

export type Hit = {
  row: SearchRow
  /** Which field the query actually matched. Every result shows this. */
  matchedOn: string
  score: number
}

let _cache: SearchIndex | null = null
let _inflight: Promise<SearchIndex> | null = null

export function loadSearchIndex(): Promise<SearchIndex> {
  if (_cache) return Promise.resolve(_cache)
  _inflight ??= (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/search-index.json`)
    if (!res.ok) throw new Error(`search-index.json ${res.status}`)
    _cache = await res.json()
    return _cache!
  })().finally(() => { _inflight = null })
  return _inflight
}

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Post timestamps are seconds in this corpus, milliseconds in a few rows. */
const msOf = (ts: number) => (ts > 1e10 ? ts : ts * 1000)

function passes(row: SearchRow, f: Filters, postDate: Map<number, number>): boolean {
  if (f.sections?.length && !f.sections.includes(row.s)) return false
  if (f.postNum != null && row.p !== f.postNum) return false
  if (f.unresolvedOnly && row.s !== 'unresolved') return false
  if (f.entityType && row.f.type !== f.entityType) return false
  if (f.theme && row.f.theme !== f.theme) return false
  if (f.family && row.f.family !== f.family) return false
  if (f.subtype && row.f.subtype !== f.subtype) return false
  if (f.codeType && row.f.codeType !== f.codeType) return false
  if (f.emphasisType && row.f.type !== f.emphasisType) return false
  if (f.conclusion && !row.f.conclusion) return false
  if (f.checkable && !row.f.checkable) return false
  if (f.sourceProvided && !row.f.sourceProvided) return false
  if (f.from || f.to) {
    // Entities and codes span the corpus rather than sitting in one drop, so a date range simply
    // does not apply to them. Dropping them silently would make the filter look like it found
    // fewer certified references than exist.
    if (row.p == null) return false
    const ts = postDate.get(row.p)
    if (ts == null) return false
    if (f.from && ts < Date.parse(f.from)) return false
    if (f.to && ts > Date.parse(f.to) + 86_400_000) return false
  }
  return true
}

/**
 * Run a query.
 *
 * Raw post text is searched from the copy the app already holds. Shipping 8.5 MB of drops a
 * second time just to search them would double the bundle for nothing.
 */
export async function search(query: string, filters: Filters = {}, limit = 200): Promise<{
  hits: Hit[]
  total: number
  bySection: Record<string, number>
}> {
  const [index, posts] = await Promise.all([loadSearchIndex(), getAllPosts()])
  const needle = norm(query)
  const postDate = new Map(posts.map(p => [p.postNum, msOf(p.timestamp)]))
  const hits: Hit[] = []

  if (needle) {
    for (const row of index.rows) {
      if (!passes(row, filters, postDate)) continue

      // Which field matched is part of the answer, not an implementation detail — a hit on an
      // alias and a hit on Q's own wording mean different things to a reader.
      let matchedOn = ''
      let score = 0
      const t = norm(row.t)
      if (t === needle) { matchedOn = 'exact match'; score = 100 }
      else if (t.includes(needle)) { matchedOn = row.s === 'editorial' ? 'editorial wording' : 'text'; score = 60 }
      else if (Array.isArray(row.f.aliases) && (row.f.aliases as string[]).some(a => norm(a).includes(needle))) {
        matchedOn = 'entity alias'; score = 70
      } else if (Array.isArray(row.f.variants) && (row.f.variants as string[]).some(v => norm(v).includes(needle))) {
        matchedOn = 'code variant'; score = 70
      } else if (Array.isArray(row.f.anchors) && (row.f.anchors as string[]).some(a => norm(a).includes(needle))) {
        matchedOn = 'theme anchor word'; score = 50
      } else if (row.f.domain && norm(row.f.domain).includes(needle)) {
        matchedOn = 'domain'; score = 60
      } else if (row.f.line && norm(row.f.line).includes(needle)) {
        matchedOn = 'the emphasised line'; score = 40
      } else if (row.f.span && norm(row.f.span).includes(needle)) {
        matchedOn = 'the unresolved line'; score = 40
      } else continue

      hits.push({ row, matchedOn, score })
    }

    // Raw Q text — the "where does this appear at all" half of the question.
    const wantPosts = !filters.sections?.length || filters.sections.includes('post')
    if (wantPosts && !filters.unresolvedOnly) {
      for (const p of posts) {
        if (filters.postNum != null && p.postNum !== filters.postNum) continue
        if (filters.from && msOf(p.timestamp) < Date.parse(filters.from)) continue
        if (filters.to && msOf(p.timestamp) > Date.parse(filters.to) + 86_400_000) continue
        const text = String(p.text ?? '')
        if (!norm(text).includes(needle)) continue
        hits.push({
          row: { s: 'post', p: p.postNum, i: p.id, t: text.slice(0, 400), w: 'raw Q post text', f: {} },
          matchedOn: 'post text', score: 30,
        })
      }
    }
  } else {
    // No query: filters alone are a legitimate way to browse ("every unresolved code", "all
    // conclusions in March 2018").
    for (const row of index.rows) {
      if (!passes(row, filters, postDate)) continue
      hits.push({ row, matchedOn: 'filter', score: 10 })
    }
  }

  hits.sort((a, b) => b.score - a.score || (a.row.p ?? 0) - (b.row.p ?? 0))
  const bySection: Record<string, number> = {}
  for (const h of hits) bySection[h.row.s] = (bySection[h.row.s] ?? 0) + 1
  return { hits: hits.slice(0, limit), total: hits.length, bySection }
}
