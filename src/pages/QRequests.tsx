import { useEffect, useState, useMemo, useRef } from 'react'
import SectionInfo from '../components/SectionInfo'
import { useEvidenceChips, visibleRowChips, type RowChip } from '../components/RowEvidenceChips'
import { Link, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import SearchBar from '../components/SearchBar'
import CategoryHeader from '../components/CategoryHeader'
import InlineDropReader, { ReadDropsButton, ReadablePhrase } from '../components/InlineDropReader'
import { useInlineDropReader } from '../lib/inlineDropReader'
// The text-scanning helpers are deliberately NOT imported: this page renders certified
// occurrences and must not re-derive membership or counts from raw post text.
import { getAllPosts, normalizeItemKey, makeTermMatcher } from '../lib/posts'
import type { QPost } from '../types'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Cell, LabelList,
} from 'recharts'
import { MonthYearTick, yearStartsOf } from '../lib/chartAxis'
import ScrollableChart from '../components/ScrollableChart'
import { catColor } from '../lib/categoryColors'
import TermPresenceBar from '../components/TermPresenceBar'
import { monthCounts, gradientColor, NO_MATCH_GREY, MatchCountLabel, matchAxisMax, monthSpanLabel, monthKey } from '../lib/chartSearch'

interface RequestFreq {
  text: string
  count: number
  postNums: number[]
  /** Total mentions across those posts — always >= postNums.length. */
  occurrences: number
  /** postNum → times the phrase occurs INSIDE that post (only when > 1). */
  repeats: Record<number, number>
}

/**
 * A directive's post chips, pictures and links — merged into one row, oldest → newest. Its own
 * component (rather than inline in the parent's `.map()`) because `useEvidenceChips` is a hook
 * and every row needs its own call, not one call per iteration of a loop.
 */
function RequestChips({ item, monthPostNums, hoverPostNums, flashMonth, expanded, onToggle, chipsCap, isReading, onToggleReading }: {
  item: RequestFreq
  monthPostNums: Set<number> | null
  hoverPostNums: Set<number> | null
  flashMonth: boolean
  expanded: boolean
  onToggle: () => void
  chipsCap: number
  isReading: boolean
  onToggleReading: () => void
}) {
  // A selected month narrows the CERTIFIED chips to that month's posts; evidence chips are not
  // month-filtered, matching this row's existing behaviour before the merge.
  const mn = monthPostNums ? item.postNums.filter(n => monthPostNums.has(n)) : item.postNums
  const certifiedChips: RowChip[] = mn.map(num => {
    const inMonth = monthPostNums?.has(num) ?? null
    const pulsing = hoverPostNums?.has(num) ?? false
    return {
      num,
      node: (
        <Link key={num} to={`/post/${num}?flash=1&highlight=${encodeURIComponent(item.text)}&rk=request`}
          title={inMonth ? 'in the selected month' : undefined}
          className={`text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-700 text-gray-400 hover:text-green-300 rounded px-1.5 py-0.5 transition-all font-mono ${
            inMonth ? 'ring-2 ring-white/70 text-white font-bold' : ''
          } ${item.repeats[num] > 1 ? 'border-amber-500/70' : ''} ${pulsing || (inMonth && flashMonth) ? 'animate-chip-pulse font-bold z-10 relative' : ''}`}>
          #{num}
          {item.repeats[num] > 1 && (
            <span className="ml-1 text-amber-300 font-bold">×{item.repeats[num]}</span>
          )}
        </Link>
      ),
    }
  })
  const evidenceChips = useEvidenceChips(item.text, item.postNums, '&rk=request')
  const { shown, merged } = visibleRowChips(certifiedChips, evidenceChips, chipsCap, expanded)
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(c => c.node)}
      {merged.length > chipsCap && (
        <button
          onClick={onToggle}
          className="text-xs px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-mono"
        >
          {expanded ? '− show fewer' : `+${(merged.length - chipsCap).toLocaleString()} more`}
        </button>
      )}
      {/* Same control, same wording and same place as Claims and Named Entities. The chips say
          WHICH drops; this says what they contain, without leaving the row. */}
      <ReadDropsButton count={mn.length} isReading={isReading} onToggle={onToggleReading} />
    </div>
  )
}

interface TimelineEntry {
  month: string
  posts: number
  requests: number
}

// Grouping key comes from lib/posts so requests, questions and analysis items all
// answer "is this the same phrase?" identically.
const normalize = normalizeItemKey


export default function QRequests() {
  const [posts, setPosts] = useState<QPost[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
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
    getAllPosts().then(all => {
      // Posts with requests
      const data = all.filter(p => p.hasRequests).sort((a, b) => a.postNum - b.postNum)
      setPosts(data)
      setLoading(false)

      // Build timeline: all posts for total count + request posts by month
      const postsByMonth: Record<string, number> = {}
      const requestsByMonth: Record<string, number> = {}
      for (const post of all) {
        const ms = post.timestamp > 1e10 ? post.timestamp : post.timestamp * 1000
        const date = new Date(ms)
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        postsByMonth[month] = (postsByMonth[month] ?? 0) + 1
        if (post.actionRequests && post.actionRequests.length > 0)
          requestsByMonth[month] = (requestsByMonth[month] ?? 0) + post.actionRequests.length
      }
      const allMonths = new Set([...Object.keys(postsByMonth), ...Object.keys(requestsByMonth)])
      setTimeline(
        Array.from(allMonths).sort().map(month => ({
          month,
          posts: postsByMonth[month] ?? 0,
          requests: requestsByMonth[month] ?? 0,
        }))
      )
    })
  }, [])

  const allRequests: RequestFreq[] = useMemo(() => {
    const groups: Record<string, { count: number; postNums: number[]; original: string; perPost: Map<number, number> }> = {}
    for (const post of posts) {
      // Filter by selected month if active
      if (selectedMonth) {
        const ms = post.timestamp > 1e10 ? post.timestamp : post.timestamp * 1000
        const month = `${new Date(ms).getFullYear()}-${String(new Date(ms).getMonth() + 1).padStart(2, '0')}`
        if (month !== selectedMonth) continue
      }
      for (const req of post.actionRequests ?? []) {
        const key = normalize(req)
        if (!groups[key]) groups[key] = { count: 0, postNums: [], original: req, perPost: new Map<number, number>() }
        groups[key].count++
        // The certified occurrence tally, per post, so in-post repeats survive display grouping.
        groups[key].perPost.set(post.postNum, (groups[key].perPost.get(post.postNum) ?? 0) + 1)
        if (!groups[key].postNums.includes(post.postNum))
          groups[key].postNums.push(post.postNum)
      }
    }
    // NO BACKFILL, NO RESCAN.
    //
    // This used to top up each group with every post whose raw text contained the phrase, then
    // recount occurrences by scanning that text. Live, it turned the certified 2,422 Directives
    // into 4,529 — the correct 1,417 posts, rescanned, with occurrences invented on top. The
    // certified dataset already decided which imperatives are directives and how many times Q
    // wrote each one; a browser-side scan cannot overrule an adjudicated corpus.
    return Object.values(groups).map(g => {
      let occurrences = 0
      const repeats: Record<number, number> = {}
      for (const n of g.postNums) {
        const c = g.perPost.get(n) ?? 1
        occurrences += c
        if (c > 1) repeats[n] = c
      }
      return {
        text: g.original,
        count: g.postNums.length,
        postNums: g.postNums.sort((a, b) => a - b),
        occurrences,
        repeats,
      }
    })
  }, [posts, selectedMonth])

  // Rank is a property of the item, not a row position — filtering must not renumber it.
  const rankByItem = useMemo(() => {
    const base = sortBy === 'count'
      ? [...allRequests].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
      : [...allRequests].sort((a, b) => a.text.localeCompare(b.text))
    const map = new Map<string, number>()
    base.forEach((r, n) => map.set(normalizeItemKey(r.text), n + 1))
    return map
  }, [allRequests, sortBy])

  const filtered = useMemo(() => {
    let list = allRequests
    if (search.trim()) {
      // Alias-aware: "hrc" also matches a request that only says "Hillary Clinton".
      const m = makeTermMatcher(search)
      list = list.filter(r => m.matches(r.text))
    }
    if (sortBy === 'count')
      return [...list].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    return [...list].sort((a, b) => a.text.localeCompare(b.text))
  }, [allRequests, search, sortBy])

  // ── Search-filtered timeline ──────────────────────────────────────────────
  // While searching, the chart shows WHERE THE MATCHES FALL rather than the monthly
  // request total, colored green→red by density.
  const postTimestamp = useMemo(() => {
    const m = new Map<number, number>()
    for (const p of posts) m.set(p.postNum, p.timestamp)
    return m
  }, [posts])

  const searchMatchMonths = useMemo(() => {
    if (!search.trim()) return null
    const nums = new Set<number>()
    for (const r of filtered) for (const n of r.postNums) nums.add(n)
    return monthCounts(nums, n => postTimestamp.get(n))
  }, [search, filtered, postTimestamp])

  // Post numbers in the selected month, for highlighting chips inside each card.
  const monthPostNums = useMemo(() => {
    if (!selectedMonth) return null
    const set = new Set<number>()
    for (const p of posts) {
      const ts = p.timestamp
      if (ts && monthKey(ts) === selectedMonth) set.add(p.postNum)
    }
    return set
  }, [posts, selectedMonth])

  // Posts in the hovered month — those chips pulse so you can spot them in a long list.
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

  // ── Read the drops inline ────────────────────────────────────────────────
  // The same reader Claims and Named Entities have had: clicking the directive itself opens every
  // matching drop underneath the row, oldest first, paged. The machinery is shared
  // (components/InlineDropReader); what belongs here is which drops a row means.
  const [readingKey, setReadingKey] = useState<string | null>(null)
  const readingNums = useMemo(() => {
    if (!readingKey) return null
    const item = filtered.find(r => normalizeItemKey(r.text) === readingKey)
    if (!item) return null
    return monthPostNums ? item.postNums.filter(n => monthPostNums.has(n)) : item.postNums
  }, [readingKey, filtered, monthPostNums])
  const reader = useInlineDropReader(readingKey, readingNums)

  const listRef = useRef<HTMLDivElement | null>(null)

  // Chart-level onClick reads dd.activePayload, which Recharts fills inconsistently — on a
  // stacked/multi-series chart it frequently arrives empty, so clicking a month did nothing.
  // Post Archive hit this and moved to per-Bar handlers; this chart never did. Both paths
  // now fire, with a short guard so a single click is not counted twice.
  const lastMonthClick = useRef<{ month: string; at: number }>({ month: '', at: 0 })

  function handleBarClick(entry: { month?: string } | null | undefined) {
    const month = entry?.month
    if (!month) return
    const now = performance.now()
    if (lastMonthClick.current.month === month && now - lastMonthClick.current.at < 350) return
    lastMonthClick.current = { month, at: now }
    const next = selectedMonth === month ? null : month
    setSelectedMonth(next)
    // Land on the results the click just filtered to.
    if (next) setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  function formatMonth(m: string) {
    const [y, mo] = m.split('-')
    return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  }

  const repeatedRequests = allRequests.filter(r => r.postNums.length > 1)
  const onceRequests = allRequests.filter(r => r.postNums.length === 1)

  // Year labels on the month axis — same tick as every other chart.
  const yearStarts = useMemo(() => yearStartsOf(chartData), [chartData])

  return (
    <div className="flex flex-col">

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a] border-b border-q-border px-6 pt-5 pb-4 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
        <BackButton />

        <CategoryHeader
          section="Q Directives"
          summary={
            <p className="flex items-baseline gap-2 leading-none tracking-tight min-w-0">
              <span className="text-base font-bold truncate" style={{ color: catColor('requests') }}>Q Directives</span>
              <span className="text-sm font-black text-amber-300/90 shrink-0">
                {allRequests.reduce((n, r) => n + r.occurrences, 0).toLocaleString()}
                <span className="text-[10px] font-medium text-gray-500 ml-1">mentions</span>
              </span>
            </p>
          }
          search={<SearchBar value={search} onChange={setSearch} placeholder="Search all requests…" />}
          details={<>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="flex items-baseline gap-3 leading-none tracking-tight">
              <span className="text-2xl font-black text-amber-300/90">
                {allRequests.reduce((n, r) => n + r.occurrences, 0).toLocaleString()}
                <span className="text-xs font-medium text-gray-500 ml-1.5">mentions</span>
              </span>
              <span className="text-2xl font-black text-white/90">
                <span className="text-xs font-medium text-gray-500 mr-1.5">within</span>
                {new Set(allRequests.flatMap(r => r.postNums)).size.toLocaleString()}
                <span className="text-xs font-medium text-gray-500 ml-1.5">posts</span>
              </span>
            </p>
            <h1 className="text-xl font-bold leading-tight flex items-center gap-2" style={{ color: catColor('requests') }}>Q Directives<SectionInfo id="requests" /></h1>
            <p className="text-gray-500 text-xs mt-0.5">
              <span className="text-green-400 font-medium">{repeatedRequests.length}</span> repeated ·{' '}
              <span className="text-gray-400 font-medium">{onceRequests.length}</span> issued once
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSortBy('count')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${sortBy === 'count' ? 'bg-green-700/40 border-green-600 text-green-200' : 'bg-gray-800/50 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'}`}>
              Most Used
            </button>
            <button onClick={() => setSortBy('alpha')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${sortBy === 'alpha' ? 'bg-green-700/40 border-green-600 text-green-200' : 'bg-gray-800/50 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'}`}>
              A–Z
            </button>
          </div>
        </div>
          </>}
        />
      </div>

      <div className="flex-1 overflow-y-auto bg-q-bg p-6 space-y-6">

      {search.trim() && <TermPresenceBar term={search} activeKey="requests" />}

      {/* Timeline Chart */}
      {timeline.length > 0 && (
        <div className="bg-q-panel border border-q-border rounded-xl p-5">
          <h2 className="text-white font-semibold mb-0.5">
            {searchMatchMonths ? `Q Directives Timeline — "${search}"` : 'Q Directives vs. Posts per Month'}
          </h2>
          <p className="text-gray-400 text-xs mb-4">
            {searchMatchMonths
              ? `${searchMatchTotal} matching post${searchMatchTotal !== 1 ? 's' : ''} · bars colored green→red by density · click a bar to filter the list below`
              : selectedMonth
              ? `Filtered to ${formatMonth(selectedMonth)} — click bar again to reset`
              : 'Grey = total posts · green = requests that month · click a bar to filter the list below'}
          </p>
          <ScrollableChart minWidth={920}><ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: searchMatchMonths ? 22 : 4, right: 8, left: -16, bottom: 0 }}
              onMouseMove={(st: { activeLabel?: string | number }) => setHoverMonth(typeof st?.activeLabel === 'string' ? st.activeLabel : null)}
              onMouseLeave={() => setHoverMonth(null)}
              onClick={d => {
                const dd = d as { activePayload?: { payload: TimelineEntry }[] }
                if (dd?.activePayload?.[0]?.payload) handleBarClick(dd.activePayload[0].payload)
              }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="month" tick={(props: any) => <MonthYearTick {...props} yearStarts={yearStarts} />} interval={0} height={52} />
              <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }} />
              {/* Matches scale on their own axis — sharing the left one makes a 2-post
                  result invisible next to a ~400-post total. */}
              {searchMatchMonths && (
                <YAxis yAxisId="matches" orientation="right" hide domain={[0, matchAxisMax(searchMatchMax)]} />
              )}
              <Tooltip position={{ y: 0 }} content={({ active, payload, label }) => {
                if (!active || !payload || !label) return null
                const [y, mo] = String(label).split('-')
                const monthLabel = new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
                const COLORS: Record<string, string> = { Posts: '#9ca3af', Requests: '#22c55e' }
                return (
                  <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    <p style={{ color: '#e5e7eb', marginBottom: 6, fontWeight: 600 }}>{monthLabel}</p>
                    {payload.map((item, i) => {
                      const col = COLORS[item.name as string] ?? '#9ca3af'
                      return (
                        <p key={i} style={{ margin: '2px 0' }}>
                          <span style={{ color: col }}>● {item.name}: </span>
                          <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{item.value}</span>
                        </p>
                      )
                    })}
                  </div>
                )
              }} />
              <Legend content={() => (
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, paddingTop: 4 }}>
                  {[{ name: 'Q Posts', color: '#9ca3af' }, { name: 'Requests', color: '#22c55e' }].map(item => (
                    <span key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 4, color: item.color }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: item.color }} />
                      {item.name}
                    </span>
                  ))}

                </div>
              )} />
              <Bar dataKey="posts" name="Q Posts" radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }} onClick={(d: { month?: string; payload?: { month?: string } }) => handleBarClick({ month: d?.month ?? d?.payload?.month })}>
                {timeline.map(entry => (
                  <Cell key={entry.month} fill={!selectedMonth || selectedMonth === entry.month ? '#9ca3af' : '#374151'} />
                ))}
              </Bar>
              {searchMatchMonths ? (
                <Bar yAxisId="matches" dataKey="matches" name={`"${search}" matches`} radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }} onClick={(d: { month?: string; payload?: { month?: string } }) => handleBarClick({ month: d?.month ?? d?.payload?.month })} minPointSize={3}>
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
                <Bar yAxisId="left" dataKey="requests" name="Directives" radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }} onClick={(d: { month?: string; payload?: { month?: string } }) => handleBarClick({ month: d?.month ?? d?.payload?.month })}>
                  {timeline.map(entry => (
                    <Cell key={entry.month} fill={!selectedMonth || selectedMonth === entry.month ? '#22c55e' : '#14532d'} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer></ScrollableChart>
          {selectedMonth && (
            <button onClick={() => setSelectedMonth(null)}
              className="mt-2 text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-1 rounded-lg transition-colors">
              ✕ Clear month filter
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-400">Loading requests…</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-q-panel border border-q-border rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-2">No action requests detected yet.</p>
          <p className="text-sm text-gray-500">
            Run the <span className="text-green-400 font-medium">🟢 Request Detection</span> scan from the Dashboard.
          </p>
        </div>
      ) : (
        <>
          {filtered.length === 0 && (
            <p className="text-gray-500 text-center py-20">No requests{search ? ` matching "${search}"` : selectedMonth ? ` in ${formatMonth(selectedMonth)}` : ''}.</p>
          )}

          <div ref={listRef} className="grid gap-3 scroll-mt-24">
            {filtered.slice(0, visibleCount).map((item, idx) => {
              // One identity per row, matching the one readingNums resolves against.
              const readKey = normalizeItemKey(item.text)
              return (
              <div key={idx} className="bg-q-panel border border-q-border rounded-xl p-4 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  {/* Same left column as every other section. */}
                  <div className="shrink-0 flex flex-row sm:flex-col items-center gap-1.5 sm:mt-0.5">
                    <span className="text-[11px] font-bold text-gray-600 leading-none tabular-nums">
                      {(rankByItem.get(normalizeItemKey(item.text)) ?? idx + 1).toLocaleString()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-900/60 text-green-400 border border-green-700/60">
                      Requests
                    </span>
                    {item.occurrences > item.postNums.length && (
                      <span className="text-[11px] font-bold text-amber-300/90 leading-none tabular-nums whitespace-nowrap">
                        {item.occurrences.toLocaleString()} mentions
                      </span>
                    )}
                    {item.count > 1 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap text-white bg-gray-700 border-gray-600">
                        ×{item.count} posts
                      </span>
                    )}
                    {(() => {
                      const span = monthSpanLabel(item.postNums, n => {
                        const ts = postTimestamp.get(n)
                        return ts ? monthKey(ts) : undefined
                      })
                      return span ? <span className="text-[10px] text-gray-600 leading-tight text-center whitespace-nowrap">{span}</span> : null
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* REPEATED badge removed — "×N posts" already says it, in the same
                        place every other section says it. */}
                    <p className="mb-1">
                      {/* THE PHRASE ITSELF IS THE CONTROL, exactly as on Claims and Named
                          Entities. It is the thing the reader is interested in, so it is the
                          thing they reach for; the explicit "read N drops" button stays beside
                          the chips for anyone who does not discover that. */}
                      <ReadablePhrase
                        text={item.text}
                        isReading={readingKey === readKey}
                        onToggle={() => setReadingKey(prev => (prev === readKey ? null : readKey))}
                        className="inline-block text-sm leading-relaxed px-2 py-1 rounded bg-green-500/25 text-green-300 border border-green-700/50"
                      />
                    </p>
                    <RequestChips item={item} monthPostNums={monthPostNums} hoverPostNums={hoverPostNums} flashMonth={flashMonth}
                      chipsCap={CHIPS}
                      expanded={expandedChips.has(item.text)}
                      onToggle={() => setExpandedChips(prev => {
                        const next = new Set(prev)
                        if (next.has(item.text)) next.delete(item.text); else next.add(item.text)
                        return next
                      })}
                      isReading={readingKey === readKey}
                      onToggleReading={() => setReadingKey(prev => (prev === readKey ? null : readKey))} />
                    {readingKey === readKey && <InlineDropReader reader={reader} term={item.text} />}
                  </div>
                </div>
              </div>
              )
            })}
            {filtered.length > visibleCount && (
              <div className="flex items-center justify-center gap-3 py-3">
                <button
                  onClick={() => setVisibleCount(n => n + PAGE)}
                  className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-400 text-gray-200 px-5 py-2 rounded-lg transition-colors"
                >
                  Show {Math.min(PAGE, filtered.length - visibleCount).toLocaleString()} more
                </button>
                <span className="text-xs text-gray-500">
                  showing {visibleCount.toLocaleString()} of {filtered.length.toLocaleString()} requests
                </span>
                <button onClick={() => setVisibleCount(filtered.length)} className="text-xs text-gray-400 hover:text-white underline">show all</button>
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  )
}
