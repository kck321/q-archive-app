import { useEffect, useState, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { getAllPosts, makeTermMatcher } from '../lib/posts'
import { monthCounts, gradientColor, NO_MATCH_GREY, MatchCountLabel, matchAxisMax, monthSpanLabel, monthKey } from '../lib/chartSearch'
import { catColor } from '../lib/categoryColors'
import TimeframeBreakdown from '../components/TimeframeBreakdown'
import type { QPost } from '../types'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Cell, LabelList,
} from 'recharts'
import ScrollableChart from '../components/ScrollableChart'
import TermPresenceBar from '../components/TermPresenceBar'

interface BracketEntry {
  /** Total mentions across its posts — a code can repeat inside one drop. */
  occurrences?: number
  /** postNum → times the code occurs INSIDE that post (only when > 1). */
  repeats?: Record<number, number>
  code: string      // e.g. "[RR]" or "[[HRC]]"
  inner: string     // e.g. "RR" or "HRC"
  count: number
  postNums: number[]
}

interface TimelineEntry {
  month: string
  posts: number
  brackets: number
}

// Matches [[X]] and [X] where X is uppercase/numeric, 1–30 chars
const BRACKET_RX = /\[\[?([A-Z0-9][A-Z0-9 _\-]{0,29})\]?\]/g

function extractBrackets(text: string): string[] {
  const results: string[] = []
  let m: RegExpExecArray | null
  const rx = new RegExp(BRACKET_RX.source, 'g')
  while ((m = rx.exec(text)) !== null) {
    results.push(m[0])
  }
  return results
}

function buildDeltaMonths(): Map<string, number> {
  const now = new Date()
  const map = new Map<string, number>()
  for (let delta = 1; delta <= 20; delta++) {
    const d = new Date(now)
    d.setFullYear(d.getFullYear() - delta)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    map.set(month, delta)
  }
  return map
}
const DELTA_MONTHS = buildDeltaMonths()

function CustomXAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (x === undefined || y === undefined || !payload) return <g />
  const delta = DELTA_MONTHS.get(payload.value)
  if (!delta) return <g />
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#6b7280" fontSize={10}>{delta} yr</text>
      <text x={0} y={0} dy={24} textAnchor="middle" fill="#4b5563" fontSize={9}>Delta</text>
    </g>
  )
}

export default function QBrackets() {
  const [posts, setPosts] = useState<QPost[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  // ?q= lets the "also found in" chips hand a term over from another section.
  useEffect(() => { const q = searchParams.get('q'); if (q !== null) setSearch(q) }, [searchParams])
  const [sortBy, setSortBy] = useState<'count' | 'alpha'>('count')
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [hoverMonth, setHoverMonth] = useState<string | null>(null)
  // Selecting a month flashes its chips white for a few seconds, then settles.
  const [flashMonth, setFlashMonth] = useState(false)
  // Render a page at a time — see AnalysisArchive for the measured DOM cost.
  // Show 40 post chips per row, expandable — rows with hundreds of chips dominate the DOM.
  const CHIPS = 40
  const [expandedChips, setExpandedChips] = useState<Set<string>>(new Set())
  const PAGE = 150
  const [visibleCount, setVisibleCount] = useState(PAGE)
  useEffect(() => { setVisibleCount(PAGE) }, [search, selectedMonth, sortBy])
  // A new search starts clean. Leaving the previous term's month selected meant the next
  // search opened already filtered to a month you picked for something else — results
  // silently missing with no visible cause.
  useEffect(() => { setSelectedMonth(null); setHoverMonth(null) }, [search])
  useEffect(() => {
    if (!selectedMonth) { setFlashMonth(false); return }
    setFlashMonth(true)
    const t = setTimeout(() => setFlashMonth(false), 3200)
    return () => clearTimeout(t)
  }, [selectedMonth])

  useEffect(() => {
    getAllPosts().then(posts => {
      setPosts(posts)
      setLoading(false)
    })
  }, [])

  // Build frequency map across all posts
  const allBrackets: BracketEntry[] = useMemo(() => {
    const groups: Record<string, { count: number; postNums: number[]; repeats: Record<number, number> }> = {}
    for (const post of posts) {
      if (!post.text) continue
      const found = extractBrackets(post.text)
      const seen = new Set<string>()
      for (const code of found) {
        groups[code] ??= { count: 0, postNums: [], repeats: {} }
        groups[code].count++
        groups[code].repeats[post.postNum] = (groups[code].repeats[post.postNum] ?? 0) + 1
        if (!seen.has(code)) {
          seen.add(code)
          if (!groups[code].postNums.includes(post.postNum)) {
            groups[code].postNums.push(post.postNum)
          }
        }
      }
    }
    return Object.entries(groups).map(([code, val]) => ({
      // `count` is raw occurrences from the scan; expose it under the shared name too.
      occurrences: val.count,
      // keep only the posts where the code genuinely repeats
      repeats: Object.fromEntries(Object.entries(val.repeats).filter(([, n]) => n > 1).map(([k, n]) => [Number(k), n])),
      code,
      inner: code.replace(/^\[+/, '').replace(/\]+$/, ''),
      count: val.count,
      postNums: val.postNums.sort((a, b) => a - b),
    }))
  }, [posts])

  // Build timeline: posts per month + bracket occurrences per month
  const timeline: TimelineEntry[] = useMemo(() => {
    const map = new Map<string, { posts: number; brackets: number }>()
    for (const post of posts) {
      if (!post.timestamp) continue
      const d = new Date(post.timestamp * 1000)
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = map.get(month) ?? { posts: 0, brackets: 0 }
      entry.posts++
      if (post.text) {
        entry.brackets += extractBrackets(post.text).length
      }
      map.set(month, entry)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, val]) => ({ month, ...val }))
  }, [posts])

  // Build set of postNums in selected month for filtering
  const monthPostNums = useMemo(() => {
    if (!selectedMonth) return null
    const nums = new Set<number>()
    for (const post of posts) {
      if (!post.timestamp) continue
      const d = new Date(post.timestamp * 1000)
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (month === selectedMonth) nums.add(post.postNum)
    }
    return nums
  }, [selectedMonth, posts])

  const totalOccurrences = allBrackets.reduce((s, b) => s + b.count, 0)
  const repeatedCount = allBrackets.filter(b => b.postNums.length > 1).length

  // Rank by POSTS, matching the number on the badge. Total occurrences is the tiebreak so
  // a code used twice in one post still outranks one used once, without letting a single
  // post-heavy code jump the queue.
  const byPostCount = (a: BracketEntry, b: BracketEntry) =>
    b.postNums.length - a.postNums.length || b.count - a.count || a.inner.localeCompare(b.inner)

  // Rank is a property of the item, not a row position — filtering must not renumber it.
  const rankByItem = useMemo(() => {
    const base = sortBy === 'count'
      ? [...allBrackets].sort(byPostCount)
      : [...allBrackets].sort((a, b) => a.inner.localeCompare(b.inner))
    const map = new Map<string, number>()
    base.forEach((b, n) => map.set(b.code, n + 1))
    return map
  }, [allBrackets, sortBy])

  const filtered = useMemo(() => {
    let list = allBrackets
    // filter by selected month
    if (monthPostNums) {
      list = list.filter(b => b.postNums.some(n => monthPostNums.has(n)))
    }
    if (search.trim()) {
      // Alias-aware — this is why searching "hrc" previously missed a [Hillary] bracket.
      const m = makeTermMatcher(search)
      list = list.filter(b => m.matches(b.inner) || m.matches(b.code))
    }
    if (sortBy === 'count') return [...list].sort(byPostCount)
    return [...list].sort((a, b) => a.inner.localeCompare(b.inner))
  }, [allBrackets, search, sortBy, monthPostNums])

  // ── Search-filtered timeline ──────────────────────────────────────────────
  // While searching, bars show WHERE THE MATCHES FALL, colored green→red by density.
  const postTimestamp = useMemo(() => {
    const m = new Map<number, number>()
    for (const p of posts) m.set(p.postNum, p.timestamp)
    return m
  }, [posts])

  const searchMatchMonths = useMemo(() => {
    if (!search.trim()) return null
    const nums = new Set<number>()
    for (const b of filtered) for (const n of b.postNums) nums.add(n)
    return monthCounts(nums, n => postTimestamp.get(n))
  }, [search, filtered, postTimestamp])

  const hoverPostNums = useMemo(() => {
    if (!hoverMonth) return null
    const set = new Set<number>()
    for (const p of posts) if (p.timestamp && monthKey(p.timestamp) === hoverMonth) set.add(p.postNum)
    return set
  }, [posts, hoverMonth])

  const searchMatchMax = searchMatchMonths ? Math.max(1, ...searchMatchMonths.values()) : 1
  const searchMatchTotal = searchMatchMonths ? [...searchMatchMonths.values()].reduce((a, b) => a + b, 0) : 0
  const chartData = useMemo(
    () => timeline.map(e => ({ ...e, matches: searchMatchMonths?.get(e.month) ?? 0 })),
    [timeline, searchMatchMonths],
  )

  const listRef = useRef<HTMLDivElement | null>(null)

  const handleBarClick = (data: { activePayload?: { payload: TimelineEntry }[] }) => {
    const month = data?.activePayload?.[0]?.payload?.month
    if (!month) return
    const next = selectedMonth === month ? null : month
    setSelectedMonth(next)
    // Land on the results the click just filtered to.
    if (next) setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const formatMonthLabel = (month: string) => {
    const [yr, mo] = month.split('-')
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${names[parseInt(mo) - 1]} '${yr.slice(2)}`
  }

  return (
    <div className="flex-1 overflow-y-auto bg-q-bg">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a] border-b border-q-border px-6 pt-5 pb-4 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
        <BackButton />
        <div>
          {!loading && (
            <p className="flex items-baseline gap-3 leading-none tracking-tight">
              <span className="text-2xl font-black text-amber-300/90">
                {totalOccurrences.toLocaleString()}
                <span className="text-xs font-medium text-gray-500 ml-1.5">mentions</span>
              </span>
              <span className="text-2xl font-black text-white/90">
                <span className="text-xs font-medium text-gray-500 mr-1.5">within</span>
                {new Set(allBrackets.flatMap(b => b.postNums)).size.toLocaleString()}
                <span className="text-xs font-medium text-gray-500 ml-1.5">posts</span>
              </span>
            </p>
          )}
          <h1 className="text-2xl font-bold mt-0.5" style={{ color: catColor('brackets') }}>Q [ Brackets ]</h1>
          {/* Same shape as every other section: repeated · once, with total occurrences
              appended because a bracket can repeat inside a single post. "N unique codes"
              was dropped — it duplicated the total above it. */}
          {!loading && (
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-medium" style={{ color: catColor('brackets') }}>{repeatedCount.toLocaleString()}</span> repeated ·{' '}
              <span className="text-gray-400 font-medium">{(allBrackets.length - repeatedCount).toLocaleString()}</span> found once ·{' '}
              <span className="text-gray-400 font-medium">{totalOccurrences.toLocaleString()}</span> total occurrences
            </p>
          )}
          <p className="text-gray-500 text-xs mt-1">Every bracket code found across all Q posts — names, agencies, and markers.</p>
        </div>

        {/* Controls */}
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bracket codes..."
            className="flex-1 min-w-[200px] bg-q-panel border border-q-border rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-600"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('count')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${sortBy === 'count' ? 'bg-red-700/40 border-red-600 text-red-200' : 'bg-q-panel border-q-border text-gray-400 hover:text-white'}`}
            >
              Most Used
            </button>
            <button
              onClick={() => setSortBy('alpha')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${sortBy === 'alpha' ? 'bg-red-700/40 border-red-600 text-red-200' : 'bg-q-panel border-q-border text-gray-400 hover:text-white'}`}
            >
              A–Z
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {search.trim() && <TermPresenceBar term={search} activeKey="brackets" />}

        {/* Timeline chart */}
        {!loading && timeline.length > 0 && (
          <div className="bg-q-panel border border-q-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-300">Brackets &amp; Posts by Month</h2>
              {selectedMonth && (
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-700/50 rounded-full px-3 py-0.5 transition-colors"
                >
                  ✕ Clear month filter · {formatMonthLabel(selectedMonth)}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {searchMatchMonths
                ? `${searchMatchTotal} post${searchMatchTotal !== 1 ? 's' : ''} matching "${search}" · bars colored green→red by density · click a bar to filter by month`
                : 'Click a bar to filter results by month'}
            </p>
            <ScrollableChart minWidth={920}><ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: searchMatchMonths ? 22 : 5, right: 5, left: 5, bottom: 5 }} onMouseMove={(st: { activeLabel?: string | number }) => setHoverMonth(typeof st?.activeLabel === 'string' ? st.activeLabel : null)}
                onMouseLeave={() => setHoverMonth(null)}
                onClick={(d) => handleBarClick(d as { activePayload?: { payload: TimelineEntry }[] })} style={{ cursor: 'pointer' }} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" tick={<CustomXAxisTick />} tickLine={false} axisLine={false} height={36} interval={2} />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
                {searchMatchMonths && (
                  <YAxis yAxisId="matches" orientation="right" hide domain={[0, matchAxisMax(searchMatchMax)]} />
                )}
                <Tooltip
                  position={{ y: 0 }}
                  cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    return (
                      <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        <p style={{ color: '#e5e7eb', marginBottom: 6, fontWeight: 600 }}>{formatMonthLabel(String(label))}</p>
                        {payload.map((item, i) => {
                          const col = item.name === 'Q Posts' ? '#9ca3af' : catColor('brackets')
                          return (
                            <p key={i} style={{ margin: '2px 0' }}>
                              <span style={{ color: col }}>● {item.name}: </span>
                              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{String(item.value)}</span>
                            </p>
                          )
                        })}
                      </div>
                    )
                  }}
                />
                <Legend
                  content={() => (
                    <div className="flex gap-5 justify-center mt-2">
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#9ca3af' }} />
                        Posts
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#991b1b' }} />
                        Bracket Hits
                      </span>
                    </div>
                  )}
                />
                <Bar yAxisId="left" dataKey="posts" name="Q Posts" maxBarSize={18} radius={[2, 2, 0, 0]}>
                  {timeline.map(entry => (
                    <Cell
                      key={entry.month}
                      fill={selectedMonth && selectedMonth !== entry.month ? '#374151' : '#9ca3af'}
                    />
                  ))}
                </Bar>
                {searchMatchMonths ? (
                  <Bar yAxisId="matches" dataKey="matches" name={`"${search}" matches`} maxBarSize={18} radius={[2, 2, 0, 0]} minPointSize={3}>
                    <LabelList dataKey="matches" position="top" content={MatchCountLabel} />
                    {chartData.map(entry => (
                      <Cell
                        key={entry.month}
                        fill={
                          (selectedMonth && selectedMonth !== entry.month) || entry.matches === 0
                            ? NO_MATCH_GREY
                            : gradientColor(entry.matches, searchMatchMax)
                        }
                      />
                    ))}
                  </Bar>
                ) : (
                  <Bar yAxisId="left" dataKey="brackets" name="brackets" maxBarSize={18} radius={[2, 2, 0, 0]}>
                    {timeline.map(entry => (
                      <Cell
                        key={entry.month}
                        fill={selectedMonth && selectedMonth !== entry.month ? '#1f2937' : '#991b1b'}
                      />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer></ScrollableChart>
          </div>
        )}

        {/* Month breakdown — bracket codes used that month, ranked by repeat count */}
        {selectedMonth && monthPostNums && (
          <TimeframeBreakdown
            monthLabel={formatMonthLabel(selectedMonth)}
            label="bracket codes"
            accent="red"
            monthPostNums={monthPostNums}
            items={allBrackets.map(b => ({ text: b.code, count: b.count, postNums: b.postNums, repeats: b.repeats }))}
            onClose={() => setSelectedMonth(null)}
            postLinkParams={item => `highlight=${encodeURIComponent(item.text)}&rk=bracket`}
          />
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-400">Scanning all posts…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-gray-500 text-center py-20">No bracket codes found{search ? ' matching your search' : selectedMonth ? ' in that month' : ''}.</p>
        )}

        {!loading && filtered.length > 0 && (
          <div ref={listRef} className="grid gap-3 scroll-mt-24">
            {selectedMonth && (
              <p className="text-xs text-gray-500">
                Showing {filtered.length} bracket code{filtered.length !== 1 ? 's' : ''} from <span className="text-red-400 font-medium">{formatMonthLabel(selectedMonth)}</span>
              </p>
            )}
            {filtered.slice(0, visibleCount).map((entry, idx) => (
              <div key={entry.code} className="bg-q-panel border border-q-border rounded-xl p-4 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  {/* Same left column as every other section. */}
                  <div className="shrink-0 flex flex-row sm:flex-col items-center gap-1.5 sm:mt-0.5">
                    <span className="text-[11px] font-bold text-gray-600 leading-none tabular-nums">
                      {(rankByItem.get(entry.code) ?? idx + 1).toLocaleString()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-900/60 text-red-400 border border-red-700/60">
                      Brackets
                    </span>
                    {/* Posts, matching every other section. `count` is total occurrences
                        (a code can repeat inside one post) and differs on ~8% of codes, so
                        it is kept in the tooltip rather than shown as a second number. */}
                    {(entry.occurrences ?? entry.count) > entry.postNums.length && (
                      <span className="text-[11px] font-bold text-amber-300/90 leading-none tabular-nums whitespace-nowrap">
                        {(entry.occurrences ?? entry.count).toLocaleString()} mentions
                      </span>
                    )}
                    {entry.postNums.length > 1 && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap text-white bg-gray-700 border-gray-600"
                        title={
                          entry.count !== entry.postNums.length
                            ? `${entry.postNums.length} posts · ${entry.count} total occurrences`
                            : `${entry.postNums.length} posts`
                        }
                      >
                        ×{entry.postNums.length} posts
                      </span>
                    )}
                    {(() => {
                      const span = monthSpanLabel(entry.postNums, n => {
                        const ts = postTimestamp.get(n)
                        return ts ? monthKey(ts) : undefined
                      })
                      return span ? <span className="text-[10px] text-gray-600 leading-tight text-center whitespace-nowrap">{span}</span> : null
                    })()}
                  </div>

                  {/* Code + post chips */}
                  <div className="flex-1 min-w-0">
                    {/* REPEATED badge removed — "×N posts" says it, in the same place
                        every other section says it. */}
                    <p className="mb-1">
                      <span className="inline-block font-mono text-sm leading-relaxed px-2 py-1 rounded bg-red-500/25 text-red-300 border border-red-700/50">
                        {entry.code}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {/* A selected month narrows the row to THAT month's posts; otherwise
                          the month clicked could sit past the chip cap. */}
                      {(() => { const mn = monthPostNums ? entry.postNums.filter(n => monthPostNums.has(n)) : entry.postNums; return (expandedChips.has(entry.code) ? mn : mn.slice(0, CHIPS)) })().map(num => {
                        const inMonth = monthPostNums?.has(num) ?? null
                        const pulsing = hoverPostNums?.has(num) ?? false
                        return (
                        <Link
                          key={num}
                          to={`/post/${num}?flash=1&highlight=${encodeURIComponent(entry.code)}&rk=bracket`}
                          title={inMonth ? 'in the selected month' : undefined}
                          className={`text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-red-700 text-gray-400 hover:text-red-300 rounded px-1.5 py-0.5 transition-all font-mono ${
                            inMonth ? 'ring-2 ring-white/70 text-white font-bold' : ''
                          } ${(entry.repeats?.[num] ?? 0) > 1 ? 'border-amber-500/70' : ''} ${pulsing || (inMonth && flashMonth) ? 'animate-chip-pulse font-bold z-10 relative' : ''}`}
                        >
                          #{num}
                          {(entry.repeats?.[num] ?? 0) > 1 && (
                            <span className="ml-1 text-amber-300 font-bold">×{entry.repeats?.[num]}</span>
                          )}
                        </Link>
                        )
                      })}
                      {entry.postNums.length > CHIPS && (
                        <button
                          onClick={() => setExpandedChips(prev => {
                            const next = new Set(prev)
                            if (next.has(entry.code)) next.delete(entry.code); else next.add(entry.code)
                            return next
                          })}
                          className="text-xs px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-mono"
                        >
                          {expandedChips.has(entry.code) ? '− show fewer' : `+${((monthPostNums ? entry.postNums.filter(n => monthPostNums.has(n)) : entry.postNums).length - CHIPS).toLocaleString()} more`}
                        </button>
                      )}
                      {entry.postNums.length > 30 && (
                        <span className="text-xs text-gray-600 self-center">+{entry.postNums.length - 30} more</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length > visibleCount && (
              <div className="flex items-center justify-center gap-3 py-3">
                <button
                  onClick={() => setVisibleCount(n => n + PAGE)}
                  className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-400 text-gray-200 px-5 py-2 rounded-lg transition-colors"
                >
                  Show {Math.min(PAGE, filtered.length - visibleCount).toLocaleString()} more
                </button>
                <span className="text-xs text-gray-500">
                  showing {visibleCount.toLocaleString()} of {filtered.length.toLocaleString()} bracket codes
                </span>
                <button onClick={() => setVisibleCount(filtered.length)} className="text-xs text-gray-400 hover:text-white underline">show all</button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
