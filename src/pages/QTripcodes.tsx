import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllPosts } from '../lib/posts'
import type { QPost } from '../types'

// ─── Hardcoded Q Tripcode Timeline ───────────────────────────────────────────
const TIMELINE = [
  { num: 1,  trip: '!UW.yye1fxo',   start: 'Oct 28, 2017', end: 'Oct 29, 2017', platform: '4chan',  days: 1   },
  { num: 2,  trip: '!2jsTvXXmX6',   start: 'Oct 29, 2017', end: 'Oct 30, 2017', platform: '4chan',  days: 1   },
  { num: 3,  trip: '!ITPb.qbhqo',   start: 'Oct 30, 2017', end: 'Oct 31, 2017', platform: '4chan',  days: 1   },
  { num: 4,  trip: '!xowAT4Z3VQ',   start: 'Oct 31, 2017', end: 'Nov 1, 2017',  platform: '4chan',  days: 1   },
  { num: 5,  trip: '!!mG7VJxZNCI',  start: 'Nov 1, 2017',  end: 'Jan 10, 2018', platform: '8chan',  days: 70  },
  { num: 6,  trip: '!!Hs1Jq13jV6',  start: 'Jan 10, 2018', end: 'Jun 26, 2018', platform: '8chan',  days: 167 },
  { num: 7,  trip: '!!mG7VJxZNCI',  start: 'Jun 26, 2018', end: 'Nov 12, 2018', platform: '8chan',  days: 139 },
  { num: 8,  trip: '!!CbboFOtcZs',  start: 'Nov 12, 2018', end: 'Feb 18, 2019', platform: '8chan',  days: 98  },
  { num: 9,  trip: '!!4pRcUA0lBE',  start: 'Feb 18, 2019', end: 'Aug 5, 2019',  platform: '8chan',  days: 168 },
  { num: 10, trip: '!!V4cG8aHq7g',  start: 'Nov 2, 2019',  end: 'Dec 8, 2020',  platform: '8kun',   days: 402 },
] as const

type TripEntry = typeof TIMELINE[number]

const PLATFORM_COLOR: Record<string, string> = {
  '4chan': 'bg-green-900/40 text-green-400 border border-green-700/50',
  '8chan': 'bg-blue-900/40 text-blue-400 border border-blue-700/50',
  '8kun':  'bg-orange-900/40 text-orange-400 border border-orange-700/50',
}

// Solid colors for the activity-timeline (Gantt) bars
const PLATFORM_BAR: Record<string, string> = {
  '4chan': '#4ade80',
  '8chan': '#60a5fa',
  '8kun':  '#fb923c',
}

const MAX_DAYS = Math.max(...TIMELINE.map(t => t.days))

const parseDate = (s: string) => new Date(s).getTime()

// ─── Activity timeline (Gantt) — when each tripcode was in use ────────────────
function TripcodeGantt({ counts, selected, onSelect }: {
  counts: Record<string, number>
  selected: TripEntry | null
  onSelect: (e: TripEntry | null) => void
}) {
  const min = Math.min(...TIMELINE.map(e => parseDate(e.start)))
  const max = Math.max(...TIMELINE.map(e => parseDate(e.end)))
  const span = max - min || 1

  // Group segments by tripcode, preserving first-appearance order, so a tripcode
  // used across multiple periods (e.g. !!mG7VJxZNCI) shows several bars on one row.
  const order: string[] = []
  const byTrip: Record<string, TripEntry[]> = {}
  for (const e of TIMELINE) {
    if (!byTrip[e.trip]) { byTrip[e.trip] = []; order.push(e.trip) }
    byTrip[e.trip].push(e)
  }

  const years = [2018, 2019, 2020]

  return (
    <div className="bg-q-panel border border-q-border rounded-xl p-4 space-y-3">
      <div>
        <h2 className="text-white font-semibold">Tripcode Activity Timeline</h2>
        <p className="text-gray-400 text-xs mt-0.5">
          Each bar marks the span of time a tripcode was in use · click a bar to view its posts
        </p>
      </div>

      <div className="relative">
        {/* Year gridlines */}
        <div className="absolute left-[120px] right-0 top-0 bottom-6 pointer-events-none">
          {years.map(y => {
            const left = ((parseDate(`Jan 1, ${y}`) - min) / span) * 100
            return (
              <div key={y} style={{ left: `${left}%` }} className="absolute top-0 bottom-0 border-l border-gray-700/40">
                <span className="absolute top-0 left-1 text-[10px] text-gray-600">{y}</span>
              </div>
            )
          })}
        </div>

        {/* Rows */}
        <div className="space-y-1.5 relative">
          {order.map(trip => {
            const segs = byTrip[trip]
            const count = counts[trip] ?? 0
            return (
              <div key={trip} className="flex items-center gap-2">
                <div className="w-28 shrink-0 text-right">
                  <span className="font-mono text-[10px] text-yellow-300">{trip}</span>
                  <span className="block text-[9px] text-gray-600">{count.toLocaleString()} posts</span>
                </div>
                <div className="relative flex-1 h-7 bg-gray-800/40 rounded">
                  {segs.map((e, i) => {
                    const left = ((parseDate(e.start) - min) / span) * 100
                    const width = ((parseDate(e.end) - parseDate(e.start)) / span) * 100
                    const isSel = selected?.trip === e.trip && selected?.num === e.num
                    return (
                      <button
                        key={i}
                        onClick={() => onSelect(isSel ? null : e)}
                        title={`${e.trip}\n${e.start} → ${e.end}\n${e.platform} · ${e.days} days · ${count} posts`}
                        style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%`, background: PLATFORM_BAR[e.platform] }}
                        className={`absolute top-0.5 bottom-0.5 rounded min-w-[4px] hover:brightness-125 transition-all ${isSel ? 'ring-2 ring-white z-10' : ''}`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* X-axis end labels */}
        <div className="flex items-center gap-2 mt-1">
          <div className="w-28 shrink-0" />
          <div className="flex-1 flex justify-between text-[10px] text-gray-600">
            <span>{TIMELINE[0].start}</span>
            <span>{TIMELINE[TIMELINE.length - 1].end}</span>
          </div>
        </div>
      </div>

      {/* Platform legend */}
      <div className="flex gap-4 text-[11px] pt-1">
        <span className="text-green-400">● 4chan</span>
        <span className="text-blue-400">● 8chan</span>
        <span className="text-orange-400">● 8kun</span>
      </div>
    </div>
  )
}

export default function QTripcodes() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [totalPosts, setTotalPosts] = useState(0)
  const [noTripCount, setNoTripCount] = useState(0)
  const [unknownTrips, setUnknownTrips] = useState<Record<string, number>>({})
  const [unknownPosts, setUnknownPosts] = useState<QPost[]>([])  // all posts with non-known tripcodes
  const [unknownViewTrip, setUnknownViewTrip] = useState<string | null>(null)
  const [showQThreadReplies, setShowQThreadReplies] = useState(false)
  const [selected, setSelected] = useState<TripEntry | null>(null)
  const [showNoTrip, setShowNoTrip] = useState(false)
  const [showUnknown, setShowUnknown] = useState(false)
  const [showNoneOfAbove, setShowNoneOfAbove] = useState(false)
  const [noneOfAbovePosts, setNoneOfAbovePosts] = useState<QPost[]>([])
  const [noTripPosts, setNoTripPosts] = useState<QPost[]>([])
  const [posts, setPosts] = useState<QPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [allPostsCache, setAllPostsCache] = useState<QPost[]>([])

  const knownTrips = new Set<string>(TIMELINE.map(e => e.trip))

  // Load post counts per tripcode — cache all posts for instant sub-filtering
  useEffect(() => {
    async function loadCounts() {
      const allPosts = await getAllPosts()
      const map: Record<string, number> = {}
      let noTrip = 0
      const unknown: Record<string, number> = {}
      const unknownList: QPost[] = []
      for (const p of allPosts) {
        if (!p.trip) { noTrip++; continue }
        map[p.trip] = (map[p.trip] ?? 0) + 1
        if (!knownTrips.has(p.trip)) {
          unknown[p.trip] = (unknown[p.trip] ?? 0) + 1
          unknownList.push(p)
        }
      }
      setCounts(map)
      setTotalPosts(allPosts.length)
      setNoTripCount(noTrip)
      setUnknownTrips(unknown)
      setUnknownPosts(unknownList)
      setAllPostsCache(allPosts)
      setNoTripPosts(allPosts.filter(p => !p.trip))
      setLoadingCounts(false)
    }
    loadCounts()
  }, [])

  // Load posts for selected tripcode
  useEffect(() => {
    if (!selected) { setPosts([]); return }
    setLoadingPosts(true)
    getAllPosts().then(all => {
      setPosts(all.filter(p => p.trip === selected.trip))
      setLoadingPosts(false)
    })
  }, [selected])

  // Build "none of the 10 tripcodes" list from cache
  useEffect(() => {
    if (!showNoneOfAbove || noneOfAbovePosts.length > 0 || allPostsCache.length === 0) return
    setNoneOfAbovePosts(allPostsCache.filter(p => !p.trip || !knownTrips.has(p.trip)))
  }, [showNoneOfAbove, allPostsCache])

  // Total posts that have any known Q tripcode
  const totalCoded = Object.entries(counts)
    .filter(([t]) => knownTrips.has(t))
    .reduce((s, [, c]) => s + c, 0)

  const unknownTotal = Object.values(unknownTrips).reduce((s, c) => s + c, 0)
  const noneOfAboveTotal = noTripCount + unknownTotal
  // Sort unknown trips by count desc
  const unknownSorted = Object.entries(unknownTrips).sort((a, b) => b[1] - a[1])
  // Posts where Q replied again in the thread (from thread scan)
  const qThreadPosts = allPostsCache.filter(p => (p.qThreadReplies?.length ?? 0) > 0)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">🔐 Q Tripcode Timeline</h1>
        <p className="text-gray-400 text-sm mt-1">
          All verified Q tripcodes used across platforms · {loadingCounts ? '…' : totalPosts.toLocaleString()} total posts in archive
        </p>
      </div>

      {/* Post count breakdown */}
      {!loadingCounts && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-q-panel border border-q-border rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Archive Posts</p>
            <p className="text-2xl font-bold text-white">{totalPosts.toLocaleString()}</p>
          </div>
          <div className="bg-q-panel border border-yellow-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Tripcode-Signed Posts</p>
            <p className="text-2xl font-bold text-yellow-300">{totalCoded.toLocaleString()}</p>
          </div>
          <div
            className="bg-q-panel border border-gray-700/50 rounded-xl p-4 cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => setShowNoTrip(v => !v)}
          >
            <p className="text-xs text-gray-500 mb-1">No Tripcode (anon drops) {showNoTrip ? '▲' : '▼'}</p>
            <p className="text-2xl font-bold text-gray-400">{noTripCount.toLocaleString()}</p>
          </div>
          <div
            className="bg-q-panel border border-gray-700/50 rounded-xl p-4 cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => setShowUnknown(v => !v)}
          >
            <p className="text-xs text-gray-500 mb-1">Unknown Tripcodes {showUnknown ? '▲' : '▼'}</p>
            <p className="text-2xl font-bold text-gray-500">{unknownTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-1">Click to see all {unknownSorted.length} unique values</p>
          </div>
          <div
            className="bg-q-panel border border-yellow-800/40 rounded-xl p-4 cursor-pointer hover:border-yellow-600/60 transition-colors"
            onClick={() => setShowQThreadReplies(v => !v)}
          >
            <p className="text-xs text-gray-500 mb-1">🔐 Q Thread Replies {showQThreadReplies ? '▲' : '▼'}</p>
            <p className="text-2xl font-bold text-yellow-300">{qThreadPosts.length.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-1">Posts where Q replied in the thread</p>
          </div>
        </div>
      )}

      {/* None of the 10 tripcodes — combined view */}
      {!loadingCounts && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNoneOfAbove(v => !v)}
            className="text-sm text-gray-400 hover:text-white bg-gray-800 border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition-colors"
          >
            {showNoneOfAbove ? '▲ Hide' : '▼ Show'} all {noneOfAboveTotal.toLocaleString()} posts without a known Q tripcode
          </button>
          <span className="text-xs text-gray-600">({noTripCount} no tripcode + {unknownTotal} unknown tripcode)</span>
        </div>
      )}

      {/* Activity timeline (Gantt) */}
      {!loadingCounts && <TripcodeGantt counts={counts} selected={selected} onSelect={setSelected} />}

      {/* Timeline table */}
      <div className="bg-q-panel border border-q-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-q-border bg-gray-900/40">
              <th className="text-left px-4 py-3 text-gray-500 font-medium w-8">#</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Tripcode</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Start</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">End</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Platform</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Days</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Posts</th>
              <th className="px-4 py-3 text-gray-500 font-medium w-40">Duration</th>
            </tr>
          </thead>
          <tbody>
            {TIMELINE.map(entry => {
              const postCount = counts[entry.trip] ?? 0
              const isSelected = selected?.trip === entry.trip && selected?.num === entry.num
              return (
                <tr
                  key={`${entry.num}-${entry.trip}`}
                  onClick={() => setSelected(isSelected ? null : entry)}
                  className={`border-b border-q-border/50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-900/20' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{entry.num}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-yellow-300 text-xs bg-yellow-900/20 border border-yellow-700/30 px-2 py-0.5 rounded">
                      {entry.trip}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{entry.start}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{entry.end}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLATFORM_COLOR[entry.platform]}`}>
                      {entry.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">{entry.days}d</td>
                  <td className="px-4 py-3 text-right">
                    {loadingCounts ? (
                      <span className="text-gray-600 text-xs">…</span>
                    ) : (
                      <span className={`font-bold text-sm ${postCount > 0 ? 'text-white' : 'text-gray-600'}`}>
                        {postCount.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden w-36">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(entry.days / MAX_DAYS) * 100}%`,
                          background: entry.platform === '4chan' ? '#4ade80'
                            : entry.platform === '8chan' ? '#60a5fa'
                            : '#fb923c',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-q-border bg-gray-900/30">
              <td colSpan={5} className="px-4 py-2 text-gray-500 text-xs">Total</td>
              <td className="px-4 py-2 text-right text-gray-400 text-xs font-mono">
                {TIMELINE.reduce((s, e) => s + e.days, 0)}d
              </td>
              <td className="px-4 py-2 text-right text-white font-bold text-sm">
                {loadingCounts ? '…' : totalCoded.toLocaleString()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Platform legend */}
      <div className="flex gap-4 text-xs">
        <span className="text-green-400">● 4chan — anonymous posting, early drops</span>
        <span className="text-blue-400">● 8chan — main Q era</span>
        <span className="text-orange-400">● 8kun — final drops (Nov 2019 – Dec 2020)</span>
      </div>

      {/* Unknown tripcodes breakdown panel */}
      {showUnknown && (
        <div className="bg-q-panel border border-gray-700/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Unknown / Other Tripcodes</h2>
            <button onClick={() => setShowUnknown(false)} className="text-xs text-gray-500 hover:text-gray-300">✕ Close</button>
          </div>
          <p className="text-xs text-gray-500">
            These tripcodes appear in the archive but don't match any of the 10 known Q tripcodes.
            They may be slight formatting variants, posts from other users, or data from boards where non-Q posters used tripcodes.
          </p>
          <div className="space-y-1">
            {unknownSorted.map(([trip, count]) => (
              <div key={trip} className="flex items-center gap-3 py-1 border-b border-gray-800/50">
                <span className="font-mono text-yellow-200/60 text-xs bg-gray-800 px-2 py-0.5 rounded flex-1">{trip}</span>
                <span className="text-gray-400 text-xs font-bold w-12 text-right">{count} posts</span>
                <button
                  onClick={() => setUnknownViewTrip(unknownViewTrip === trip ? null : trip)}
                  className="text-xs text-blue-400 hover:text-blue-200 underline whitespace-nowrap"
                >
                  {unknownViewTrip === trip ? 'Hide posts' : 'View posts'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts for a specific unknown tripcode */}
      {unknownViewTrip && (() => {
        const tripPosts = unknownPosts.filter(p => p.trip === unknownViewTrip).sort((a, b) => a.postNum - b.postNum)
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-semibold">Posts with tripcode</h2>
              <span className="font-mono text-yellow-200/60 text-xs bg-gray-800 px-2 py-0.5 rounded">{unknownViewTrip}</span>
              <span className="text-gray-500 text-sm">{tripPosts.length} posts</span>
              <button onClick={() => setUnknownViewTrip(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-300">✕ Close</button>
            </div>
            <div className="space-y-1.5">
              {tripPosts.map(p => {
                const date = new Date(p.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                return (
                  <div key={p.id} onClick={() => navigate(`/post/${p.postNum}`)}
                    className="bg-q-panel border border-q-border rounded-xl p-3 cursor-pointer hover:border-gray-500 hover:bg-gray-800/60 transition-colors">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-blue-400 text-xs font-bold">#{p.postNum}</span>
                      <span className="text-gray-500 text-xs">{date}</span>
                      <span className="font-mono text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{p.trip}</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">{p.text?.slice(0, 160).replace(/\n/g, ' ')}{(p.text?.length ?? 0) > 160 ? '…' : ''}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Q Thread Replies panel */}
      {showQThreadReplies && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">🔐 Posts Where Q Replied in the Thread</h2>
            <span className="text-gray-500 text-sm">{qThreadPosts.length} posts</span>
            <button onClick={() => setShowQThreadReplies(false)} className="ml-auto text-xs text-gray-500 hover:text-gray-300">✕ Close</button>
          </div>
          <p className="text-xs text-gray-500">
            These are Q's original posts where Q came back and posted again in the same thread using a Q tripcode. Each card shows how many follow-up Q replies were found.
          </p>
          {qThreadPosts.length === 0 ? (
            <div className="text-gray-500 text-sm bg-q-panel border border-q-border rounded-xl p-4">
              No Q thread replies found yet. Run the "Scan Thread Replies" scan on the Dashboard first.
            </div>
          ) : (
            <div className="space-y-1.5">
              {qThreadPosts.map(p => {
                const date = new Date(p.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                return (
                  <div key={p.id} onClick={() => navigate(`/post/${p.postNum}`)}
                    className="bg-q-panel border border-yellow-800/30 rounded-xl p-3 cursor-pointer hover:border-yellow-600/50 hover:bg-gray-800/60 transition-colors">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-blue-400 text-xs font-bold">#{p.postNum}</span>
                      <span className="text-gray-500 text-xs">{date}</span>
                      {p.trip && <span className="font-mono text-yellow-300 text-xs bg-yellow-900/20 border border-yellow-700/30 px-1.5 py-0.5 rounded">{p.trip}</span>}
                      <span className="text-xs text-yellow-400 font-medium ml-auto">
                        🔐 {p.qThreadReplies!.length} Q {p.qThreadReplies!.length === 1 ? 'reply' : 'replies'} in thread
                      </span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">{p.text?.slice(0, 160).replace(/\n/g, ' ')}{(p.text?.length ?? 0) > 160 ? '…' : ''}</p>
                    <div className="mt-2 space-y-1">
                      {p.qThreadReplies!.slice(0, 2).map((r, i) => (
                        <p key={i} className="text-xs text-yellow-200/60 bg-yellow-900/10 border border-yellow-800/20 rounded px-2 py-1">
                          <span className="font-mono text-yellow-500/60 text-[10px] mr-1">{r.trip}</span>
                          {r.text.slice(0, 120)}{r.text.length > 120 ? '…' : ''}
                        </p>
                      ))}
                      {p.qThreadReplies!.length > 2 && (
                        <p className="text-xs text-gray-600">+{p.qThreadReplies!.length - 2} more — click post to view all</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* None-of-above posts panel */}
      {showNoneOfAbove && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">Posts Without a Known Q Tripcode</h2>
            <span className="text-gray-500 text-sm">{noneOfAbovePosts.length} posts</span>
            <button onClick={() => setShowNoneOfAbove(false)} className="ml-auto text-xs text-gray-500 hover:text-gray-300">✕ Close</button>
          </div>
          {noneOfAbovePosts.length === 0 ? (
            <div className="text-gray-500 text-sm">Loading…</div>
          ) : (
            <div className="space-y-1.5">
              {noneOfAbovePosts.map(p => {
                const date = new Date(p.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                return (
                  <div key={p.id} onClick={() => navigate(`/post/${p.postNum}`)}
                    className="bg-q-panel border border-q-border rounded-xl p-3 cursor-pointer hover:border-gray-500 hover:bg-gray-800/60 transition-colors">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-blue-400 text-xs font-bold">#{p.postNum}</span>
                      <span className="text-gray-500 text-xs">{date}</span>
                      {p.trip
                        ? <span className="font-mono text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{p.trip}</span>
                        : <span className="text-xs text-gray-600 italic">no tripcode</span>
                      }
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">{p.text?.slice(0, 160).replace(/\n/g, ' ')}{(p.text?.length ?? 0) > 160 ? '…' : ''}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* No-tripcode posts panel */}
      {showNoTrip && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">Posts with No Tripcode</h2>
            <span className="text-gray-500 text-sm">{noTripCount} posts — early anonymous drops before tripcodes were introduced</span>
            <button onClick={() => setShowNoTrip(false)} className="ml-auto text-xs text-gray-500 hover:text-gray-300">✕ Close</button>
          </div>
          {noTripPosts.length === 0 ? (
            <div className="text-gray-500 text-sm">Loading…</div>
          ) : (
            <div className="space-y-1.5">
              {noTripPosts.map(p => {
                const date = new Date(p.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                return (
                  <div key={p.id} onClick={() => navigate(`/post/${p.postNum}`)}
                    className="bg-q-panel border border-q-border rounded-xl p-3 cursor-pointer hover:border-gray-500 hover:bg-gray-800/60 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-blue-400 text-xs font-bold">#{p.postNum}</span>
                      <span className="text-gray-500 text-xs">{date}</span>
                      <span className="text-xs text-gray-600 ml-1">no tripcode</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">{p.text?.slice(0, 160).replace(/\n/g, ' ')}{(p.text?.length ?? 0) > 160 ? '…' : ''}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Posts for selected tripcode */}
      {selected && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">
              Posts with <span className="font-mono text-yellow-300">{selected.trip}</span>
            </h2>
            <span className="text-gray-500 text-sm">
              {loadingPosts ? 'Loading…' : `${posts.length} posts`}
            </span>
            <button onClick={() => setSelected(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-300">
              ✕ Close
            </button>
          </div>

          {loadingPosts ? (
            <div className="text-gray-500 text-sm">Fetching posts…</div>
          ) : posts.length === 0 ? (
            <div className="bg-q-panel border border-q-border rounded-xl p-4 text-gray-500 text-sm">
              No posts found in archive for this tripcode.
            </div>
          ) : (
            <div className="space-y-1.5">
              {posts.map(p => {
                const date = new Date(p.timestamp * 1000).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })
                const preview = p.text?.slice(0, 160).replace(/\n/g, ' ')
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/post/${p.postNum}`)}
                    className="bg-q-panel border border-q-border rounded-xl p-3 cursor-pointer hover:border-gray-500 hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-blue-400 text-xs font-bold">#{p.postNum}</span>
                      <span className="text-gray-500 text-xs">{date}</span>
                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="ml-auto text-xs text-orange-400/70 hover:text-orange-300 underline"
                        >
                          8kun ↗
                        </a>
                      )}
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      {preview}{p.text?.length > 160 ? '…' : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
