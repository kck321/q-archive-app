import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAllPostsWithMedia } from '../lib/posts'
import type { QPost, QMedia } from '../types'
import { mediaUrl } from '../lib/mediaUrl'
import PictureChip from '../components/PictureChip'
import { loadPictureAnalysis, getPictureInfoSync, pictureHaystack } from '../lib/pictureAnalysis'

const IMAGE_EXT_RX = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff?|ico|avif|heic|heif)(\?[^\s]*)?$/i
const IMAGE_PATH_RX = /\/(media|image|img|file_store|thumb|photos?|pictures?|uploads?)\//i
const TEXT_URL_RX = /https?:\/\/[^\s<>"')\]]+/g

// Anything whose extension says it is NOT a picture. The path heuristic below matches on
// /media/ and /uploads/, which is exactly where a news site keeps its PDFs.
const NON_IMAGE_EXT_RX = /\.(pdf|html?|php|aspx?|docx?|xlsx?|txt|json|xml)(\?[^\s]*)?$/i

function isImageUrl(url: string): boolean {
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

function extractTextImages(text: string): QMedia[] {
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

interface ImageItem {
  post: QPost
  media: QMedia
  source: string
}

type ShowMode = 'all' | 'loaded'

export default function QPostPics() {
  const [posts, setPosts] = useState<QPost[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showMode, setShowMode] = useState<ShowMode>('all')
  const [loadedCount, setLoadedCount] = useState(0)
  const [failedKeys, setFailedKeys] = useState<Set<number>>(new Set())

  useEffect(() => {
    getAllPostsWithMedia().then(p => { setPosts(p); setLoading(false) })
  }, [])

  // Picture-analysis entries load in the background; bump a tick so the search filter
  // and the Picture chips see them once they land.
  const [, setPicsTick] = useState(0)
  useEffect(() => {
    loadPictureAnalysis().then(() => setPicsTick(t => t + 1))
  }, [])

  const allItems: ImageItem[] = posts.flatMap(p => {
    const seen = new Set<string>()
    const items: ImageItem[] = []
    function add(m: QMedia, source: string) {
      // Key on the RESOLVED url. 82 posts record the same picture twice — once on qalerts and
      // once on the onion or 8kun mirror — and more record a thumbnail beside the full file.
      // Those are different strings but the same image, so deduping on the recorded url let
      // them through and the page showed the same picture twice, side by side, under one post
      // number. mediaUrl() collapses them to a single address, which is what the reader sees.
      const key = m.url ? mediaUrl(m.url) : ''
      if (key && !seen.has(key)) {
        seen.add(key)
        items.push({ post: p, media: m, source })
      }
    }
    for (const m of p.media) if (m.url) add(m, 'attached')
    for (const m of (p.refMedia ?? [])) if (m.url) add(m, 'referenced')
    for (const m of extractTextImages(p.text ?? '')) add(m, 'text')
    if (p.link && isImageUrl(p.link)) add({ url: p.link, filename: p.link.split('/').pop()?.split('?')[0] ?? '' }, 'link')
    return items
  })

  const searched = search
    ? allItems.filter(({ post, media }) => {
        const q = search.toLowerCase()
        if (media.filename?.toLowerCase().includes(q)) return true
        if (String(post.postNum).includes(search)) return true
        // Match on what the picture SHOWS — description, extracted text, people, logos —
        // when the vision audit has an entry for it.
        const info = getPictureInfoSync(media.url)
        return !!info && pictureHaystack(info).includes(q)
      })
    : allItems

  const displayed = showMode === 'loaded'
    ? searched.filter((_, i) => !failedKeys.has(i))
    : searched

  const handleLoad = useCallback(() => {
    setLoadedCount(c => c + 1)
  }, [])

  const handleError = useCallback((i: number, el: HTMLElement | null) => {
    setFailedKeys(prev => new Set(prev).add(i))
    if (el) el.style.display = 'none'
  }, [])

  const uniquePosts = new Set(allItems.map(x => x.post.postNum)).size
  const failedCount = failedKeys.size

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-1">Q Post Pics</h1>
      <p className="text-gray-500 text-sm mb-1">
        {loading ? 'Loading…' : `${allItems.length} image links across ${uniquePosts} posts`}
      </p>
      {!loading && (
        <p className="text-xs text-gray-600 mb-4">
          <span className="text-green-400">{loadedCount} loaded</span>
          {failedCount > 0 && <span className="text-red-400 ml-3">{failedCount} broken CDN links hidden</span>}
          <span className="text-gray-600 ml-3">— old 4chan/8kun links from 2017–2021 may no longer exist</span>
        </p>
      )}

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by filename, post number, or what's in the picture…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-q-panel border border-q-border rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600"
        />
        <div className="flex rounded-lg overflow-hidden border border-q-border">
          <button
            onClick={() => setShowMode('all')}
            className={`px-3 py-2 text-xs font-medium transition-colors ${showMode === 'all' ? 'bg-blue-700 text-white' : 'bg-q-panel text-gray-400 hover:text-gray-200'}`}
          >
            Show All
          </button>
          <button
            onClick={() => setShowMode('loaded')}
            className={`px-3 py-2 text-xs font-medium transition-colors ${showMode === 'loaded' ? 'bg-green-700 text-white' : 'bg-q-panel text-gray-400 hover:text-gray-200'}`}
          >
            Loaded Only
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading images…</div>
      ) : displayed.length === 0 ? (
        <div className="text-gray-500">No images found. Make sure posts are ingested.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {displayed.map(({ post, media, source }) => {
            // Use original index for stable failure tracking
            const origIdx = allItems.findIndex(x => x.media.url === media.url && x.post.postNum === post.postNum)
            const date = new Date(post.timestamp * 1000).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
            })
            return (
              <div
                key={origIdx}
                className="bg-q-panel border border-q-border rounded-xl overflow-hidden flex flex-col"
              >
                <div className="relative bg-black/40 flex items-center justify-center min-h-32">
                  <img
                    src={mediaUrl(media.url)}
                    alt={media.filename}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                    onLoad={handleLoad}
                    onError={e => {
                      const wrapper = e.currentTarget.closest('.bg-q-panel') as HTMLElement
                      handleError(origIdx, wrapper)
                    }}
                  />
                  <a
                    href={mediaUrl(media.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white text-xs px-1.5 py-0.5 rounded transition-colors"
                  >
                    ↗
                  </a>
                  {source !== 'attached' && (
                    <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-gray-400 text-xs px-1.5 py-0.5 rounded">
                      {source}
                    </span>
                  )}
                </div>
                <div className="px-2.5 py-2 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/post/${post.postNum}?flash=1`}
                      className="text-xs font-mono text-blue-400 hover:underline"
                    >
                      #{post.postNum}
                    </Link>
                    <span className="text-xs text-gray-600">{date}</span>
                  </div>
                  {media.filename && (
                    <p className="text-xs text-gray-600 truncate">{media.filename}</p>
                  )}
                  <PictureChip url={media.url} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
