// Vision analysis of the images attached to (or referenced by) Q posts.
//
// public/data/picture-analysis.json holds one entry per DISTINCT image (content hash),
// with every post that carries it. Each entry stores what the picture shows: a neutral
// description, the exact text visible in the image, people/organizations/objects/places,
// extra search terms, claim flags, and a green/yellow/red confidence grade.
//
// TEXT FROM IMAGES FEEDS SEARCH ONLY. It is never Q-authored prose, so it must never
// reach the certified analysis index (same rule as quoted-post text — invariant 9).
// A search hit here is labelled as coming from inside a picture, not from the drop.

export interface PictureInfo {
  hash: string
  filename: string
  posts: { num: number; source: string }[]
  kind: string
  description: string
  text: string
  people: string[]
  orgs: string[]
  objects: string[]
  places: string[]
  terms: string[]
  flags: string[]
  confidence: 'green' | 'yellow' | 'red'
  /** Owner review queue: the record is published but not finished being interpreted. Rendered
      as TWO red dots on the chip. Two different situations carry it — see reviewKindOf. */
  needsReview?: boolean
  /** 1-based position in the audit's own record list, so a row here can be matched to the
      n= numbering the batch runbooks and the review notes use. Assigned at load. */
  n?: number
}

/**
 * WHY A FLAGGED RECORD IS FLAGGED. Two situations, and they need different work from the owner.
 *
 *   'partial'  the audit described the image and indexed its phrases, but some content could not
 *              be transcribed — a stitched compilation of dozens of posts, or text below the
 *              resolution the image carries. There is something to correct and extend.
 *   'withheld' the provider declined to analyse the image at all. The record carries no
 *              description and no extracted text, so there is nothing to correct: it needs the
 *              owner's own look. Four of the eight are #4941.
 *
 * Reported as one undifferentiated count of 37, these read as one kind of problem. They are not.
 */
export type PictureReviewKind = 'partial' | 'withheld'

const WITHHELD_FLAG = /analysis withheld/i

export function reviewKindOf(info: PictureInfo): PictureReviewKind {
  return info.flags.some(f => WITHHELD_FLAG.test(f)) ? 'withheld' : 'partial'
}

/** The owner's picture queue, split by what it will take to clear each row. */
export function pictureReviewQueue(map: Map<string, PictureInfo>): {
  withheld: PictureInfo[]
  partial: PictureInfo[]
  total: number
} {
  const flagged = [...map.values()].filter(i => i.needsReview)
  const byPost = (a: PictureInfo, b: PictureInfo) => (a.posts[0]?.num ?? 0) - (b.posts[0]?.num ?? 0) || (a.n ?? 0) - (b.n ?? 0)
  return {
    withheld: flagged.filter(i => reviewKindOf(i) === 'withheld').sort(byPost),
    partial: flagged.filter(i => reviewKindOf(i) === 'partial').sort(byPost),
    total: flagged.length,
  }
}

let _cache: Map<string, PictureInfo> | null = null
let _inflight: Promise<Map<string, PictureInfo>> | null = null

/**
 * Key an attachment URL to its analysis entry: the basename without extension.
 * Works for every recorded host — file_store hashes, the qalerts mirror, and the
 * old 4chan timestamp names (1509926281137.png) — because the name IS the content id.
 * The extension is deliberately dropped: posts.json records .png for files the
 * mirror serves as .jpg.
 */
export function pictureKey(url: string | undefined | null): string {
  if (!url) return ''
  const base = url.split('/').pop() ?? ''
  return base.split('?')[0].replace(/\.[a-z0-9]+$/i, '').toLowerCase()
}

export function loadPictureAnalysis(): Promise<Map<string, PictureInfo>> {
  if (_cache) return Promise.resolve(_cache)
  _inflight ??= (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/picture-analysis.json`)
      if (!res.ok) throw new Error(`picture-analysis.json ${res.status}`)
      const data = await res.json()
      const map = new Map<string, PictureInfo>()
      // The record's position IS its n= identity in the runbooks and the review notes, and it is
      // lost the moment the array becomes a hash map. Carry it.
      const list = (data.images ?? []) as PictureInfo[]
      list.forEach((img, i) => {
        img.n = i + 1
        map.set(img.hash.toLowerCase(), img)
      })
      _cache = map
    } catch {
      // No analysis file (or fetch failed): every lookup misses, nothing renders.
      _cache = new Map()
    }
    return _cache
  })().finally(() => { _inflight = null })
  return _inflight
}

/** Sync lookup once loadPictureAnalysis has resolved; null before then. */
export function getPictureInfoSync(url: string | undefined | null): PictureInfo | null {
  if (!_cache) return null
  return _cache.get(pictureKey(url)) ?? null
}

/** Everything searchable about one picture, joined for substring/word-boundary matching. */
export function pictureHaystack(info: PictureInfo): string {
  return [
    info.filename, info.kind, info.description, info.text,
    ...info.people, ...info.orgs, ...info.objects, ...info.places,
    ...info.terms, ...info.flags,
  ].join(' ').toLowerCase()
}

let _byPost: Map<number, string> | null = null

/**
 * Per-post searchable picture text — SEARCH ONLY, never the analysis index.
 * Built once: each analysed image contributes its haystack to every post that carries it.
 */
export async function getPictureTextByPost(): Promise<Map<number, string>> {
  if (_byPost) return _byPost
  const map = await loadPictureAnalysis()
  const byPost = new Map<number, string>()
  for (const info of map.values()) {
    const hay = pictureHaystack(info)
    for (const p of info.posts) {
      byPost.set(p.num, `${byPost.get(p.num) ?? ''} ${hay}`)
    }
  }
  _byPost = byPost
  return byPost
}
