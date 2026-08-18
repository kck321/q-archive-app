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
  /** Owner review queue: analysis exists but is incomplete (e.g. a giant compilation whose
      full transcript needs a human pass). Rendered as TWO red dots on the chip. */
  needsReview?: boolean
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
      for (const img of (data.images ?? []) as PictureInfo[]) {
        map.set(img.hash.toLowerCase(), img)
      }
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
