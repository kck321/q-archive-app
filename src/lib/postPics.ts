import { getAllPostsWithMedia } from './posts'
import { mediaUrl } from './mediaUrl'
import type { QPost, QMedia } from '../types'

// THE ONE DEFINITION of what counts as a picture in the archive.
//
// Moved here from pages/QPostPics.tsx (owner request 2026-08-28: a Q Pictures row in the
// sidebar with the number of pictures under it). The sidebar count and the /pics headline
// MUST be the same computation — two copies of this logic is exactly the two-counters defect
// this project keeps paying for, so the page now imports these too.

const IMAGE_EXT_RX = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff?|ico|avif|heic|heif)(\?[^\s]*)?$/i
const IMAGE_PATH_RX = /\/(media|image|img|file_store|thumb|photos?|pictures?|uploads?)\//i
const TEXT_URL_RX = /https?:\/\/[^\s<>"')\]]+/g

// Anything whose extension says it is NOT a picture. The path heuristic below matches on
// /media/ and /uploads/, which is exactly where a news site keeps its PDFs.
const NON_IMAGE_EXT_RX = /\.(pdf|html?|php|aspx?|docx?|xlsx?|txt|json|xml)(\?[^\s]*)?$/i

export function isImageUrl(url: string): boolean {
  if (!url) return false
  if (NON_IMAGE_EXT_RX.test(url)) return false
  if (IMAGE_EXT_RX.test(url)) return true
  // Path-only match: require the LAST segment to look like a filename.
  //
  // Without this, every one of the six URLs pulled out of drop text was a false positive —
  // a Hill article under /homenews/media/, three government and news PDFs under /uploads/,
  // and a Twitter photo PAGE at /photo/1. None is an image, so each rendered as a dead tile
  // and was counted against the archive as a broken CDN link.
  if (!IMAGE_PATH_RX.test(url)) return false
  const last = url.split('?')[0].split('/').filter(Boolean).pop() ?? ''
  return last.includes('.')
}

export function extractTextImages(text: string): QMedia[] {
  if (!text) return []
  const found: QMedia[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(TEXT_URL_RX)) {
    const url = match[0].replace(/[.,;:!?]+$/, '')
    if (!seen.has(url) && isImageUrl(url)) {
      seen.add(url)
      found.push({ url, filename: url.split('/').pop()?.split('?')[0] ?? '' })
    }
  }
  return found
}

export interface PicItem {
  post: QPost
  media: QMedia
  source: string
  /** Stable position in the built list. Carried on the item because deriving it per tile
      with findIndex is O(n squared) — see the note in QPostPics where this bit. */
  idx: number
}

/** Every picture in the archive, in post order, deduped per post on the RESOLVED url. */
export function buildPicItems(posts: QPost[]): PicItem[] {
  return posts.flatMap(p => {
    const seen = new Set<string>()
    const items: PicItem[] = []
    function add(m: QMedia, source: string) {
      // Key on the RESOLVED url. 82 posts record the same picture twice — once on qalerts and
      // once on the onion or 8kun mirror — and more record a thumbnail beside the full file.
      // Those are different strings but the same image, so deduping on the recorded url let
      // them through and the page showed the same picture twice, side by side, under one post
      // number. mediaUrl() collapses them to a single address, which is what the reader sees.
      const key = m.url ? mediaUrl(m.url) : ''
      if (key && !seen.has(key)) {
        seen.add(key)
        items.push({ post: p, media: m, source, idx: -1 })
      }
    }
    for (const m of p.media) if (m.url) add(m, 'attached')
    for (const m of (p.refMedia ?? [])) if (m.url) add(m, 'referenced')
    for (const m of extractTextImages(p.text ?? '')) add(m, 'text')
    if (p.link && isImageUrl(p.link)) add({ url: p.link, filename: p.link.split('/').pop()?.split('?')[0] ?? '' }, 'link')
    return items
  }).map((it, i) => { it.idx = i; return it })
}

/** The sidebar's number: how many pictures /pics will show. Cached after the first call —
    the posts are already in memory once anything has loaded them, so this is one pass. */
let cachedCount: number | null = null
export async function countPostPics(): Promise<number> {
  if (cachedCount !== null) return cachedCount
  const posts = await getAllPostsWithMedia()
  cachedCount = buildPicItems(posts).length
  return cachedCount
}
