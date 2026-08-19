// Supporting evidence for an analysis row: the PICTURES and URLs tied to its subject.
//
// A row like POTUS shows the drops in which Q actually wrote the term. That is the certified
// set and it is adjudicated, not computed here. But the archive also holds two other kinds of
// material that mention the same subject without Q having typed the word: an image whose vision
// analysis identifies Donald Trump, and a link whose path carries `realDonaldTrump`. Those are
// real evidence and a researcher wants them — they are simply NOT the same claim.
//
// ── The line this module must not cross ──────────────────────────────────────
// `pictureAnalysis.ts` states that image text feeds SEARCH ONLY and must never reach the
// certified analysis index (the same rule invariant 9 sets for quoted-post text). Everything
// here is therefore ADDITIVE and separately labelled: nothing in this file may be folded into a
// row's postNums, its mentions figure, its ×N posts badge, or the set "read N drops" opens.
// `#1254` means Q named the subject in that drop. `Pic #1254` means a picture there shows them.
// Collapsing the two would quietly convert a photograph into a statement Q never made.
//
// ── Two grounded routes, and the difference is kept ──────────────────────────
// 1. DIRECT — the asset itself matches the term or one of its aliases: the picture's description,
//    OCR text, identified people/orgs/places, or the URL's own domain and path.
// 2. ASSOCIATED — the asset sits in a drop already certified for this row. Weaker, but grounded:
//    it says "this certified drop carries a link", not "this link is about the subject".
// Every chip keeps the reason that admitted it, so the tooltip can say which one it was. We never
// assert anything about what an external page CONTAINS — only the URL text we hold locally.
import { loadPictureAnalysis, pictureHaystack, type PictureInfo } from './pictureAnalysis'
import { getAllTextLinks, type QTextLink } from './posts'
import { getFullAliasGroup } from './aliases'
import { wordBoundaryPattern } from './highlightConstants'

export interface EvidenceChip {
  postNum: number
  /** Qualifying assets in this post — rendered as ×N. One chip per post per kind. */
  count: number
  /** Why it qualified, for the tooltip. */
  reason: string
  direct: boolean
}

export interface RowEvidence {
  pics: EvidenceChip[]
  urls: EvidenceChip[]
}

const EMPTY: RowEvidence = { pics: [], urls: [] }

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A URL is not prose, so word boundaries alone cannot read it: `realDonaldTrump` contains "trump"
 * with a letter on its left, and `/potus-schedule` glues the term to a dash. Split on
 * non-alphanumerics AND on camelCase humps, then match against the spaced result — so "trump"
 * matches `realDonaldTrump` and `potus_briefing`, while "us" still cannot match `russia`.
 */
export function urlHaystack(url: string): string {
  return url
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

let picsByPost: Map<number, PictureInfo[]> | null = null
let linksByPost: Map<number, QTextLink[]> | null = null
let loading: Promise<void> | null = null

/** Build both indexes once. Safe to call repeatedly; concurrent callers share one load. */
export function loadRowEvidence(): Promise<void> {
  if (picsByPost && linksByPost) return Promise.resolve()
  if (loading) return loading
  loading = (async () => {
    const [pics, links] = await Promise.all([loadPictureAnalysis(), getAllTextLinks()])
    const p = new Map<number, PictureInfo[]>()
    for (const info of new Set(pics.values())) {
      for (const post of info.posts) {
        const arr = p.get(post.num); if (arr) arr.push(info); else p.set(post.num, [info])
      }
    }
    const l = new Map<number, QTextLink[]>()
    for (const link of links) {
      const arr = l.get(link.postNum); if (arr) arr.push(link); else l.set(link.postNum, [link])
    }
    picsByPost = p; linksByPost = l
  })()
  return loading
}

export function rowEvidenceReady(): boolean {
  return !!(picsByPost && linksByPost)
}

/** Terms are matched case-insensitively on word boundaries — never as bare substrings. */
function matchersFor(term: string): { rx: RegExp; label: string }[] {
  const seen = new Set<string>()
  const out: { rx: RegExp; label: string }[] = []
  for (const alias of getFullAliasGroup(term)) {
    const a = alias.trim()
    // Two characters is the floor: a one-character alias matches most of the archive and would
    // fill every row with noise rather than evidence.
    if (a.length < 2) continue
    const k = a.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ rx: new RegExp(wordBoundaryPattern(escapeRx(k), k), 'i'), label: a })
  }
  return out
}

const cache = new Map<string, RowEvidence>()

/**
 * Pictures and URLs supporting one row.
 *
 * `certifiedPosts` is the row's OWN post set and is used only to admit associated assets and to
 * describe them; it is never modified. Results are sorted oldest→newest, direct matches ranked
 * ahead of associated ones so the strongest evidence reads first.
 */
export function evidenceForRow(term: string, certifiedPosts: Iterable<number>): RowEvidence {
  if (!picsByPost || !linksByPost || !term) return EMPTY
  const certified = certifiedPosts instanceof Set ? certifiedPosts as Set<number> : new Set(certifiedPosts)
  const key = `${term}\u0000${certified.size}`
  const hit = cache.get(key)
  if (hit) return hit

  const matchers = matchersFor(term)
  if (!matchers.length) return EMPTY

  const firstMatch = (hay: string) => matchers.find(m => m.rx.test(hay))?.label ?? null

  const pics: EvidenceChip[] = []
  for (const [postNum, infos] of picsByPost) {
    let direct = 0, assoc = 0, why = ''
    for (const info of infos) {
      const label = firstMatch(pictureHaystack(info))
      if (label) { direct++; if (!why) why = `Matched picture analysis: ${label}` }
      else if (certified.has(postNum)) { assoc++ }
    }
    if (direct) pics.push({ postNum, count: direct, reason: why, direct: true })
    else if (assoc) pics.push({ postNum, count: assoc, reason: `Picture in a drop certified for ${term} — #${postNum}`, direct: false })
  }

  const urls: EvidenceChip[] = []
  for (const [postNum, links] of linksByPost) {
    let direct = 0, assoc = 0, why = ''
    for (const link of links) {
      const label = firstMatch(urlHaystack(link.url))
      if (label) { direct++; if (!why) why = `Matched URL text: ${link.domain} — ${label}` }
      else if (certified.has(postNum)) { assoc++ }
    }
    if (direct) urls.push({ postNum, count: direct, reason: why, direct: true })
    else if (assoc) urls.push({ postNum, count: assoc, reason: `URL in a drop certified for ${term} — #${postNum}`, direct: false })
  }

  // Strictly oldest -> newest, by owner ruling. Whether a chip is direct or associated is carried
  // by its tooltip and its dimming, NOT by its position: a reader scanning for post #1254 should
  // find it where the number says it is, not wherever its evidence class happened to sort it.
  const order = (a: EvidenceChip, b: EvidenceChip) => a.postNum - b.postNum
  const built: RowEvidence = { pics: pics.sort(order), urls: urls.sort(order) }
  cache.set(key, built)
  return built
}
