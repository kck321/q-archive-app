import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getAllPostsWithMedia } from '../lib/posts'
import type { QPost } from '../types'
import { mediaUrl } from '../lib/mediaUrl'
import PictureChip from '../components/PictureChip'
import { loadPictureAnalysis, getPictureInfoSync, pictureHaystack } from '../lib/pictureAnalysis'
import { MEDIA_CROP } from '../lib/mediaCrop'
// What counts as a picture lives in lib/postPics — the sidebar's Q Pictures count reads the
// same definition, so this page and that number can never disagree (owner row, 2026-08-28).
import { buildPicItems, type PicItem as ImageItem } from '../lib/postPics'

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
  const [picsTick, setPicsTick] = useState(0)
  useEffect(() => {
    loadPictureAnalysis().then(() => setPicsTick(t => t + 1))
  }, [])

  // Memoised, and each item carries its own index.
  //
  // This ran on EVERY render — 1,870 items, each calling mediaUrl() — and then each tile derived
  // its key with allItems.findIndex(), which is O(n squared): ~1.7M string comparisons per render,
  // repeated on every keystroke in the search box. That stall is not just slow to type against; it
  // delayed the first paint after Back for long enough that the scroll restorer's retry window
  // expired and the page landed at the top, which the scroll gate caught as an intermittent
  // failure on /pics.
  const allItems: ImageItem[] = useMemo(() => buildPicItems(posts), [posts])

  const searched = useMemo(() => !search ? allItems
    : allItems.filter(({ post, media }) => {
        const q = search.toLowerCase()
        if (media.filename?.toLowerCase().includes(q)) return true
        if (String(post.postNum).includes(search)) return true
        // Match on what the picture SHOWS — description, extracted text, people, logos —
        // when the vision audit has an entry for it.
        const info = getPictureInfoSync(media.url)
        return !!info && pictureHaystack(info).includes(q)
      }), [allItems, search, picsTick])

  // Filter on the item's OWN index. `failedKeys` holds indices into allItems, but this filtered on
  // the position within `searched` — so with a search active it hid whichever tiles happened to sit
  // at those positions rather than the ones that actually failed to load.
  const displayed = showMode === 'loaded'
    ? searched.filter(it => !failedKeys.has(it.idx))
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
          {displayed.map(({ post, media, source, idx: origIdx }) => {
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
                    // This fixed-height thumbnail already covers the whole tile with
                    // object-fit: cover, centered on the image's geometric middle by default —
                    // which is exactly wrong when a chunk of that image is a baked-in black
                    // letterbox border (owner ruling, 2026-08-26: "there is alot of blank
                    // space... i just want the main portion of the picture showing"). Biasing
                    // object-position to the CENTER OF THE DETECTED CONTENT BOX instead keeps
                    // the simple cover-crop this grid needs, but points it at the real photo.
                    style={media.url && MEDIA_CROP[mediaUrl(media.url)] ? (() => {
                      const c = MEDIA_CROP[mediaUrl(media.url)]!
                      const cx = ((c.cropX + c.cropWidth / 2) / c.naturalWidth) * 100
                      const cy = ((c.cropY + c.cropHeight / 2) / c.naturalHeight) * 100
                      return { objectPosition: `${cx}% ${cy}%` }
                    })() : undefined}
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
