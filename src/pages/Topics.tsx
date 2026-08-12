import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTopics, getAllPosts } from '../lib/posts'
import { loadLocalData, mutateStore } from '../lib/localData'
import { clusterTopics } from '../lib/claude'
import PostCard from '../components/PostCard'
import type { QTopic, QPost } from '../types'
import { CAN_EDIT } from '../lib/appMode'

function sortedIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10)
    return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b)
  })
}

export default function Topics() {
  const [topics, setTopics] = useState<QTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [clustering, setClustering] = useState(false)
  const [error, setError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Full post content for the selected cluster
  const [clusterPosts, setClusterPosts] = useState<QPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  const selected = selectedIndex !== null ? topics[selectedIndex] ?? null : null

  useEffect(() => {
    getTopics().then(t => {
      setTopics(t)
      if (t.length > 0) setSelectedIndex(0)
    }).finally(() => setLoading(false))
  }, [])

  // Fetch full post content whenever the selected cluster changes
  useEffect(() => {
    if (!selected) { setClusterPosts([]); return }
    setLoadingPosts(true)
    setClusterPosts([])
    const ids = sortedIds(selected.postIds)
    loadLocalData()
      .then(store => {
        setClusterPosts(ids.map(id => store.postsById.get(id)).filter(Boolean) as QPost[])
      })
      .finally(() => setLoadingPosts(false))
  }, [selectedIndex])

  async function handleCluster() {
    setClustering(true)
    setError('')
    try {
      const allPosts = await getAllPosts()
      const posts = allPosts.slice(0, 200).map(p => ({ id: p.id, text: p.text }))
      const results = await clusterTopics(posts)
      const saved: QTopic[] = results.map(r => ({
        id: crypto.randomUUID(),
        name: r.name,
        description: r.description,
        postIds: r.postIds,
        createdAt: Date.now(),
      }))
      await mutateStore('topics', store => { store.topics.push(...saved) })
      setTopics(saved)
      setSelectedIndex(saved.length > 0 ? 0 : null)
    } catch (e) {
      setError(String(e))
    } finally {
      setClustering(false)
    }
  }

  function goPrev() {
    if (selectedIndex === null || topics.length === 0) return
    setSelectedIndex((selectedIndex - 1 + topics.length) % topics.length)
  }

  function goNext() {
    if (selectedIndex === null || topics.length === 0) return
    setSelectedIndex((selectedIndex + 1) % topics.length)
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a] border-b border-q-border px-6 pt-5 pb-4 shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Q Clusters</h1>
            <p className="text-gray-500 text-xs mt-0.5">Posts grouped by theme — each cluster is a chapter</p>
          </div>
          {CAN_EDIT && (
          <button
            onClick={handleCluster}
            disabled={clustering}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {clustering ? 'Clustering…' : topics.length > 0 ? '↺ Regenerate Chapters' : '📖 Generate Chapters with Claude'}
          </button>
          )}
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading chapters…</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No chapters generated yet.</p>
          <p className="text-gray-600 text-sm">Click "Generate Chapters with Claude" to automatically cluster posts by topic.</p>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 gap-4 px-6 py-4">

          {/* Left: Table of Contents */}
          <div className="w-64 shrink-0 overflow-y-auto space-y-1 pr-1">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 sticky top-0 bg-[#0a0e1a] py-1">
              Table of Contents
            </h2>
            {topics.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setSelectedIndex(i)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedIndex === i
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-600'
                    : 'bg-q-panel border border-q-border text-gray-300 hover:border-gray-500'
                }`}
              >
                <span className="text-gray-500 mr-2">{i + 1}.</span>
                {t.name}
                <span className="ml-2 text-xs text-gray-600">({t.postIds.length})</span>
              </button>
            ))}
          </div>

          {/* Right: sticky cluster info + scrollable full posts below */}
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <div className="space-y-4 pb-8">

                {/* ── Stationary cluster info panel ── */}
                <div className="sticky top-0 z-10 bg-q-panel border border-q-border rounded-xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
                  {/* Prev / Next navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={goPrev}
                      className="flex items-center gap-1 text-sm bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ← Prev Chapter
                    </button>
                    <span className="text-xs text-gray-600">
                      {(selectedIndex ?? 0) + 1} / {topics.length}
                    </span>
                    <button
                      onClick={goNext}
                      className="flex items-center gap-1 text-sm bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Next Chapter →
                    </button>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-1">{selected.name}</h2>
                  <p className="text-gray-400 text-sm mb-3">{selected.description}</p>
                  <p className="text-xs text-gray-500 mb-3">{selected.postIds.length} posts in this cluster</p>

                  {/* Chip-style post links */}
                  <div className="flex flex-wrap gap-2">
                    {sortedIds(selected.postIds).map(pid => (
                      <Link
                        key={pid}
                        to={`/post/${pid}?topic=${encodeURIComponent(selected.name)}&flash=1`}
                        className="text-xs bg-gray-800 hover:bg-indigo-900/40 text-gray-300 hover:text-indigo-300 border border-gray-700 hover:border-indigo-600 px-2 py-1 rounded transition-colors"
                      >
                        #{pid}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* ── Full post content — scrolls below the info panel ── */}
                <div className="space-y-3 w-full max-w-3xl">
                  <p className="text-xs text-gray-600 px-1">
                    — {selected.postIds.length} posts in this cluster, oldest to newest —
                  </p>
                  {loadingPosts ? (
                    <div className="text-center py-12 text-gray-500 animate-pulse">Loading posts…</div>
                  ) : clusterPosts.map(p => (
                    <PostCard
                      key={p.id}
                      post={p}
                    />
                  ))}
                </div>

              </div>
            ) : (
              <div className="bg-q-panel border border-q-border rounded-xl p-5 flex items-center justify-center h-48">
                <p className="text-gray-500 text-sm">Select a chapter to view its posts</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
