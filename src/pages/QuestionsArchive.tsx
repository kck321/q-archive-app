import { useEffect, useMemo, useState, useRef } from 'react'
import SectionInfo from '../components/SectionInfo'
import { useEvidenceChips, visibleRowChips, type RowChip } from '../components/RowEvidenceChips'
import { Link, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { makeTermMatcher, normalizeItemKey, getQuestionFrequency, getQuestionsTimeline, getPostNumsByMonth, mergeSimilarQuestions, type QuestionFrequency, type SimilarGroup } from '../lib/posts'
import { loadLocalData } from '../lib/localData'
import { findSimilarGroups } from '../lib/similarity'
import SearchBar from '../components/SearchBar'
import TimeframeBreakdown from '../components/TimeframeBreakdown'
import { CAN_EDIT } from '../lib/appMode'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Cell, LabelList,
} from 'recharts'
import { MonthYearTick, yearStartsOf } from '../lib/chartAxis'
import ScrollableChart from '../components/ScrollableChart'
import { catColor } from '../lib/categoryColors'
import TermPresenceBar from '../components/TermPresenceBar'
import { gradientColor, NO_MATCH_GREY, MatchCountLabel, matchAxisMax, monthSpanLabel } from '../lib/chartSearch'

interface TimelineEntry {
  month: string
  questions: number
  posts: number
}

interface SyncVariant {
  text: string
  postNum: number
  wasNormalized: boolean
}

interface SyncGroup {
  canonical: string
  variants: SyncVariant[]
  hasNormalized: boolean
}

function ChartTooltip({ active, payload, label, keyword, matchCounts, matchMax }: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
  keyword?: string | null
  matchCounts?: Map<string, number> | null
  matchMax?: number
}) {
  if (!active || !payload || !label) return null
  const [y, mo] = label.split('-')
  const monthLabel = new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const keyCount = matchCounts?.get(label) ?? 0
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 12, minWidth: 160 }}>
      <p style={{ color: '#e5e7eb', marginBottom: 6, fontWeight: 600 }}>{monthLabel}</p>
      {payload.map((item, i) => {
        const col = item.name === 'Questions' ? '#3b82f6' : '#9ca3af'
        return (
          <p key={i} style={{ margin: '2px 0' }}>
            <span style={{ color: col }}>● {item.name}: </span>
            <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{item.value}</span>
          </p>
        )
      })}
      {keyword && (
        <p style={{ color: '#9ca3af', margin: '6px 0 0', borderTop: '1px solid #2a2a2a', paddingTop: 5 }}>
          "{keyword}": <span style={{ color: keyCount > 0 ? gradientColor(keyCount, matchMax ?? 1) : '#6b7280', fontWeight: 600 }}>{keyCount} match{keyCount !== 1 ? 'es' : ''}</span>
        </p>
      )}
    </div>
  )
}


function formatMonth(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

function HoverTip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <span className="relative group/tip cursor-help">
      {children}
      <span className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover/tip:flex w-72 rounded-lg bg-gray-950 border border-gray-600 px-3 py-2 text-xs text-gray-200 shadow-xl z-50 leading-relaxed">
        {tip}
      </span>
    </span>
  )
}

const CHIPS = 40

function QuestionCard({ r, selectedNums, hoverNums, flashNums, rank, monthOf }: { r: QuestionFrequency; selectedNums: Set<number> | null; hoverNums: Set<number> | null; flashNums: Set<number> | null; rank: number; monthOf: (n: number) => string | undefined }) {
  const span = monthSpanLabel(r.postNums, monthOf)
  // Same 40-chip cap as every other section.
  const [expanded, setExpanded] = useState(false)
  // A selected month narrows the row to THAT month's posts — otherwise the month clicked
  // could sit past the chip cap, and the row read as if it had none of it.
  const nums = selectedNums ? r.postNums.filter(n => selectedNums.has(n)) : r.postNums
  const certifiedChips: RowChip[] = nums.map(num => ({
    num,
    node: (
      <Link
        key={num}
        to={`/post/${num}?highlight=${encodeURIComponent(r.text)}&rk=question&flash=1`}
        className={`text-xs px-2 py-0.5 rounded transition-all ${
          selectedNums?.has(num)
            ? 'bg-blue-900/60 text-blue-300 border border-blue-600'
            : 'bg-gray-800 hover:bg-blue-900/50 text-gray-400 hover:text-blue-300'
        } ${(r.repeats?.[num] ?? 0) > 1 ? 'border border-amber-500/70' : ''} ${hoverNums?.has(num) || (flashNums?.has(num)) ? 'animate-chip-pulse font-bold z-10 relative' : ''}`}
      >
        #{num}
        {(r.repeats?.[num] ?? 0) > 1 && (
          <span className="ml-1 text-amber-300 font-bold">×{r.repeats[num]}</span>
        )}
      </Link>
    ),
  }))
  const evidenceChips = useEvidenceChips(r.text, nums, '&rk=question')
  const { shown, merged } = visibleRowChips(certifiedChips, evidenceChips, CHIPS, expanded)
  return (
    <div className="bg-q-panel border border-q-border rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
        {/* Same left column as every other section: rank → badge → mentions → posts → months */}
        <div className="shrink-0 flex flex-row sm:flex-col items-center gap-1.5 sm:mt-0.5">
          <span className="text-[11px] font-bold text-gray-600 leading-none tabular-nums">
            {rank.toLocaleString()}
          </span>
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-900/60 text-blue-400 border border-blue-700/60">
            Questions
          </span>
          {(r.occurrences ?? r.count) > r.postNums.length && (
            <span className="text-[11px] font-bold text-amber-300/90 leading-none tabular-nums whitespace-nowrap">
              {(r.occurrences ?? r.count).toLocaleString()} mentions
            </span>
          )}
          {r.count > 1 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap text-white bg-gray-700 border-gray-600">
              ×{r.count} posts
            </span>
          )}
          {span && <span className="text-[10px] text-gray-600 leading-tight text-center whitespace-nowrap">{span}</span>}
        </div>

      <div className="flex-1 min-w-0">
        <p className="mb-1">
          <span className="inline-block text-sm leading-relaxed px-2 py-1 rounded bg-blue-500/25 text-blue-300 border border-blue-700/50">
            {r.text}
          </span>
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {/* Certified post numbers, pictures and links — one merged row, oldest → newest.
              Pictures and links still read as their own kind of evidence (icon, color, and
              dimming for an associated rather than direct match); they are just interleaved by
              post number instead of stacked in their own rows underneath. */}
          {shown.map(c => c.node)}
          {merged.length > CHIPS && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-mono"
            >
              {expanded ? '− show fewer' : `+${(merged.length - CHIPS).toLocaleString()} more`}
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  green:  { label: 'Answered',   color: 'bg-green-900/40 text-green-400 border border-green-700' },
  yellow: { label: 'Partial',    color: 'bg-yellow-900/40 text-yellow-400 border border-yellow-700' },
  red:    { label: 'Unanswered', color: 'bg-red-900/40 text-red-400 border border-red-700' },
}

export default function QuestionsArchive() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') as 'green' | 'yellow' | 'red' | null
  const [allFetched, setAllFetched] = useState<QuestionFrequency[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  // ?q= lets the "also found in" chips hand a term over from another section.
  useEffect(() => { const q = searchParams.get('q'); if (q !== null) setSearch(q) }, [searchParams])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  // Year labels on the month axis — same tick as every other chart.
  const yearStarts = useMemo(() => yearStartsOf(timeline), [timeline])
  const [postNumsByMonth, setPostNumsByMonth] = useState<Record<string, number[]>>({})
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [hoverMonth, setHoverMonth] = useState<string | null>(null)
  // Selecting a month flashes its chips white for a few seconds, then settles.
  const [flashMonth, setFlashMonth] = useState(false)
  // Row pagination, matching the other sections.
  const PAGE = 150
  const [visibleRepeated, setVisibleRepeated] = useState(PAGE)
  const [visibleSingles, setVisibleSingles] = useState(PAGE)
  useEffect(() => { setVisibleRepeated(PAGE); setVisibleSingles(PAGE) }, [search, statusFilter, selectedMonth])
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

  // Sync similar questions state
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncResult, setSyncResult] = useState<{ groups: number; merged: number } | null>(null)
  const [syncGroups, setSyncGroups] = useState<SyncGroup[]>([])
  const [showSyncGroups, setShowSyncGroups] = useState(false)
  const [syncGroupSearch, setSyncGroupSearch] = useState('')
  const [syncGroupTab, setSyncGroupTab] = useState<'normalized' | 'all'>('normalized')

  useEffect(() => {
    setLoading(true)
    getQuestionFrequency(1)
      .then(data => setAllFetched(data))
      .finally(() => setLoading(false))
  }, [])

  async function handleSyncSimilar() {
    setSyncing(true)
    setSyncMsg('Loading all questions…')
    setSyncResult(null)
    try {
      const allQ = (await loadLocalData()).questions
      setSyncMsg(`Analyzing ${allQ.length} questions for similarity…`)
      await new Promise(resolve => setTimeout(resolve, 50))
      const groups: SimilarGroup[] = findSimilarGroups(allQ, 0.85)
      setSyncMsg(`Found ${groups.length} groups — merging to canonical form…`)
      const merged = await mergeSimilarQuestions(groups, msg => setSyncMsg(msg))
      setSyncResult({ groups: groups.length, merged })
      setSyncMsg('')

      const idToPostNum: Record<string, number> = {}
      for (const q of allQ) idToPostNum[q.id] = q.postNum
      const enriched: SyncGroup[] = groups.map(g => {
        const canonical = g.canonical.trim()
        const variants: SyncVariant[] = g.ids.map((id, idx) => ({
          text: g.texts[idx],
          postNum: idToPostNum[id] ?? 0,
          wasNormalized: g.texts[idx].trim() !== canonical,
        }))
        variants.sort((a, b) => a.postNum - b.postNum)
        return { canonical, variants, hasNormalized: variants.some(v => v.wasNormalized) }
      })
      enriched.sort((a, b) => {
        if (a.hasNormalized !== b.hasNormalized) return a.hasNormalized ? -1 : 1
        return b.variants.length - a.variants.length
      })
      setSyncGroups(enriched)
      setShowSyncGroups(true)
      setSyncGroupTab('normalized')

      setLoading(true)
      getQuestionFrequency(1)
        .then(data => setAllFetched(data))
        .finally(() => setLoading(false))
    } catch (e) {
      setSyncMsg(`Error: ${String(e)}`)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    getQuestionsTimeline().then(setTimeline)
    getPostNumsByMonth().then(setPostNumsByMonth)
  }, [])

  // recharts passes a BarRectangleItem/MouseHandlerDataParam here, not our shape —
  // read the bar's month off the payload via a narrow cast.
  const listRef = useRef<HTMLDivElement | null>(null)

  function handleBarClick(data: unknown) {
    const month = (data as { month?: string }).month
    if (!month) return
    const next = selectedMonth === month ? null : month
    setSelectedMonth(next)
    // Land on the results the click just filtered to.
    if (next) setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const searchLower = search.toLowerCase()
  // Alias-aware: searching "hrc" also surfaces questions that only say "Hillary Clinton".
  const termMatcher = useMemo(() => makeTermMatcher(search), [search])

  const selectedNums = useMemo(
    () => (selectedMonth ? new Set(postNumsByMonth[selectedMonth] ?? []) : null),
    [selectedMonth, postNumsByMonth]
  )

  // Posts in the hovered month — those chips pulse, so a month's posts are findable
  // inside a long chip list without clicking.
  const hoverNums = useMemo(
    () => (hoverMonth ? new Set(postNumsByMonth[hoverMonth] ?? []) : null),
    [hoverMonth, postNumsByMonth]
  )

  // Split into repeated (2+) and singles (1x), apply status + month + text filter to each
  const repeatedAll = useMemo(() => allFetched.filter(q => q.count >= 2), [allFetched])
  const singlesAll  = useMemo(() => allFetched.filter(q => q.count === 1), [allFetched])

  // Rank is a property of the question, not a row position. Built from the UNFILTERED
  // lists (repeated first, then singles) so filtering by month, status or search leaves
  // every number where it was.
  const rankByQuestion = useMemo(() => {
    const map = new Map<string, number>()
    let n = 0
    for (const r of repeatedAll) map.set(normalizeItemKey(r.text), ++n)
    for (const r of singlesAll) map.set(normalizeItemKey(r.text), ++n)
    return map
  }, [repeatedAll, singlesAll])

  const repeatedFiltered = useMemo(() => {
    let out = repeatedAll
    if (statusFilter) out = out.filter(r => r.topStatus === statusFilter)
    if (selectedNums) out = out.filter(r => r.postNums.some(n => selectedNums.has(n)))
    if (searchLower)  out = out.filter(r => termMatcher.matches(r.text))
    return out
  }, [repeatedAll, statusFilter, selectedNums, searchLower, termMatcher])

  const singlesFiltered = useMemo(() => {
    let out = singlesAll
    if (statusFilter) out = out.filter(r => r.topStatus === statusFilter)
    if (selectedNums) out = out.filter(r => r.postNums.some(n => selectedNums.has(n)))
    if (searchLower)  out = out.filter(r => termMatcher.matches(r.text))
    return out
  }, [singlesAll, statusFilter, selectedNums, searchLower, termMatcher])

  // Post number → its month. Built once per data change, not on every keystroke.
  const postNumToMonth = useMemo(() => {
    const m: Record<number, string> = {}
    for (const [month, nums] of Object.entries(postNumsByMonth)) {
      for (const n of nums) m[n] = month
    }
    return m
  }, [postNumsByMonth])

  // Months that contain posts matching the current keyword search — gradient by density
  const searchMatchMonths = useMemo<Map<string, number> | null>(() => {
    if (!searchLower) return null
    const allFiltered = [...repeatedFiltered, ...singlesFiltered]
    if (allFiltered.length === 0) return null
    const map = new Map<string, number>()
    for (const r of allFiltered) {
      for (const postNum of r.postNums) {
        const month = postNumToMonth[postNum]
        if (month) map.set(month, (map.get(month) ?? 0) + 1)
      }
    }
    return map.size > 0 ? map : null
  }, [searchLower, repeatedFiltered, singlesFiltered, postNumToMonth])

  const searchMatchMax = searchMatchMonths ? Math.max(1, ...searchMatchMonths.values()) : 1
  const searchMatchTotal = searchMatchMonths ? [...searchMatchMonths.values()].reduce((a, b) => a + b, 0) : 0
  // Same shape the other sections use: a dedicated `matches` series rather than tinting the
  // existing bars, so rare terms are readable instead of being a shade of an unrelated bar.
  const chartData = useMemo(
    () => timeline.map(e => ({ ...e, matches: searchMatchMonths?.get(e.month) ?? 0 })),
    [timeline, searchMatchMonths],
  )

  // Keyword stats — computed when a search is active
  const keywordStats = useMemo(() => {
    if (!searchLower) return null
    const allFiltered = [...repeatedFiltered, ...singlesFiltered]
    const totalAsks = allFiltered.reduce((sum, r) => sum + r.count, 0)
    const uniquePosts = new Set(allFiltered.flatMap(r => r.postNums)).size
    // Count how many times the keyword appears inside each unique question text,
    // then multiply by how many times that question was asked (its count)
    const totalMentions = allFiltered.reduce((sum, r) => {
      let hits = 0
      let idx = 0
      const t = r.text.toLowerCase()
      while ((idx = t.indexOf(searchLower, idx)) !== -1) { hits++; idx++ }
      return sum + hits * r.count
    }, 0)
    return { questions: allFiltered.length, totalAsks, uniquePosts, totalMentions }
  }, [searchLower, repeatedFiltered, singlesFiltered])

  return (
    <div className="flex flex-col">

      {/* ── Sticky toolbar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a] border-b border-q-border px-6 pt-5 pb-4 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.6)]">

        <BackButton />

        {/* Title + counts */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="flex items-baseline gap-3 leading-none tracking-tight">
              <span className="text-2xl font-black text-amber-300/90">
                {allFetched.reduce((n, q) => n + (q.occurrences ?? q.count), 0).toLocaleString()}
                <span className="text-xs font-medium text-gray-500 ml-1.5">mentions</span>
              </span>
              <span className="text-2xl font-black text-white/90">
                <span className="text-xs font-medium text-gray-500 mr-1.5">within</span>
                {new Set(allFetched.flatMap(q => q.postNums)).size.toLocaleString()}
                <span className="text-xs font-medium text-gray-500 ml-1.5">posts</span>
              </span>
            </p>
            <h1 className="text-xl font-bold leading-tight flex items-center gap-2" style={{ color: catColor('questions') }}>Q Questions<SectionInfo id="questions" /></h1>
            <p className="text-gray-500 text-xs mt-0.5">
              <span className="text-blue-400 font-medium">{repeatedAll.length}</span> repeated ·{' '}
              <span className="text-gray-400 font-medium">{singlesAll.length}</span> asked once
            </p>
          </div>
          {/* Status filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['green', 'yellow', 'red'] as const).map(s => {
              const cfg = STATUS_LABELS[s]
              const isActive = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setSearchParams(isActive ? {} : { status: s })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isActive ? cfg.color : 'bg-gray-800/50 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {cfg.label}
                </button>
              )
            })}
            {statusFilter && (
              <button onClick={() => setSearchParams({})} className="text-xs text-gray-500 hover:text-white transition-colors">
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <SearchBar value={search} onChange={setSearch} placeholder="Search all questions…" />

        {/* Keyword stats — shown when a search is active */}
        {keywordStats && (
          <div className="flex items-center gap-2 flex-wrap bg-blue-950/40 border border-blue-800/50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400">
              <span className="text-white font-semibold">"{search}"</span>
              {' '}found in{' '}
              <span className="text-blue-300 font-bold">{keywordStats.questions}</span>
              {' '}question{keywordStats.questions !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-400">
              asked{' '}
              <span className="text-blue-300 font-bold">{keywordStats.totalAsks}</span>
              {' '}time{keywordStats.totalAsks !== 1 ? 's' : ''} total
            </span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-400">
              across{' '}
              <span className="text-blue-300 font-bold">{keywordStats.uniquePosts}</span>
              {' '}unique post{keywordStats.uniquePosts !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-400">
              <span className="text-yellow-400 font-bold">{keywordStats.totalMentions}</span>
              {' '}total mention{keywordStats.totalMentions !== 1 ? 's' : ''} in question text
            </span>
          </div>
        )}

        {/* Sync similar questions — EDITING: merges and rewrites the questions collection. */}
        {CAN_EDIT && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSyncSimilar}
            disabled={syncing}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-indigo-500 text-gray-300 hover:text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {syncing ? '⟳ Syncing…' : '🔗 Sync Similar Questions'}
          </button>
          {syncing && syncMsg && (
            <span className="text-xs text-gray-400 animate-pulse">{syncMsg}</span>
          )}
          {syncResult && (
            <span className="text-xs text-green-400">
              ✓ Found {syncResult.groups} groups — normalized {syncResult.merged} questions to canonical form
            </span>
          )}
          {syncResult && syncGroups.length > 0 && (
            <button
              onClick={() => setShowSyncGroups(v => !v)}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {showSyncGroups ? '▲ Hide Groups' : '▼ View Matched Groups'}
            </button>
          )}
          {!syncing && !syncResult && (
            <span className="text-xs text-gray-600">
              Finds questions that are 85%+ the same (including . vs ? variants) and links them together
            </span>
          )}
        </div>
        )}
      </div>{/* end sticky toolbar */}

      {/* ── Scrollable content ──────────────────────────────────────────── */}
      <div className="px-6 py-4 space-y-4">

        {search.trim() && <TermPresenceBar term={search} activeKey="questions" />}

        {/* ── Timeline Chart — always at the top ───────────────────────── */}
        {timeline.length > 0 && (
          <div className="bg-q-panel border border-q-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-semibold">Interactive Q Post Timeline</h2>
              {(selectedMonth || searchMatchMonths) && (
                <button
                  onClick={() => { setSelectedMonth(null); setSearch('') }}
                  className="text-xs text-blue-400 hover:text-white bg-blue-900/30 border border-blue-700 px-2 py-0.5 rounded transition-colors"
                >
                  {selectedMonth ? `${formatMonth(selectedMonth)} ✕ Clear` : '✕ Clear filter'}
                </button>
              )}
            </div>
            <p className="text-gray-400 text-xs mb-4">
              {searchMatchMonths
                ? `${searchMatchTotal} matching post${searchMatchTotal !== 1 ? 's' : ''} · bars colored green→red by density · click a bar to filter by month`
                : selectedMonth
                  ? `Filtering to ${formatMonth(selectedMonth)} — click bar again or Clear to reset`
                  : 'Grey = total posts · blue = questions that month · click a bar to filter · search to highlight'}
            </p>
            <ScrollableChart minWidth={920}><ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: searchMatchMonths ? 22 : 4, right: 8, left: -16, bottom: 0 }}
                onMouseMove={(st: { activeLabel?: string | number }) => setHoverMonth(typeof st?.activeLabel === 'string' ? st.activeLabel : null)}
                onMouseLeave={() => setHoverMonth(null)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis
                  dataKey="month"
                  tick={(props: any) => <MonthYearTick {...props} yearStarts={yearStarts} />}
                  interval={0}
                  height={52}
                />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }} />
                {searchMatchMonths && (
                  <YAxis yAxisId="matches" orientation="right" hide domain={[0, matchAxisMax(searchMatchMax)]} />
                )}
                <Tooltip position={{ y: 0 }} content={(props: any) => <ChartTooltip {...props} keyword={searchMatchMonths ? search : null} matchCounts={searchMatchMonths} matchMax={searchMatchMax} />} />
                <Legend content={() => (
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, paddingTop: 4 }}>
                    {[{ name: 'Q Posts', color: '#9ca3af' }, searchMatchMonths ? { name: `"${search}" matches`, color: gradientColor(searchMatchMax, searchMatchMax) } : { name: 'Questions', color: '#3b82f6' }].map(item => (
                      <span key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 4, color: item.color }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: item.color }} />
                        {item.name}
                      </span>
                    ))}
                  </div>
                )} />
                <Bar yAxisId="left" dataKey="posts" name="Q Posts" radius={[2, 2, 0, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                  {timeline.map(entry => (
                    <Cell key={entry.month} fill={!selectedMonth || selectedMonth === entry.month ? '#9ca3af' : '#374151'} />
                  ))}
                </Bar>
                {searchMatchMonths ? (
                  <Bar yAxisId="matches" dataKey="matches" name={`"${search}" matches`} radius={[2, 2, 0, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }} minPointSize={3}>
                    <LabelList dataKey="matches" position="top" content={MatchCountLabel} />
                    {chartData.map(entry => (
                      <Cell key={entry.month} fill={
                        (selectedMonth && selectedMonth !== entry.month) || entry.matches === 0
                          ? NO_MATCH_GREY
                          : gradientColor(entry.matches, searchMatchMax)
                      } />
                    ))}
                  </Bar>
                ) : (
                  <Bar yAxisId="left" dataKey="questions" name="Questions" radius={[2, 2, 0, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                    {timeline.map(entry => (
                      <Cell key={entry.month} fill={!selectedMonth || selectedMonth === entry.month ? '#3b82f6' : '#1e3a5f'} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer></ScrollableChart>
          </div>
        )}

        {/* Month breakdown — questions asked that month, ranked by repeat count */}
        {selectedMonth && (
          <TimeframeBreakdown
            monthLabel={formatMonth(selectedMonth)}
            label="questions"
            accent="blue"
            monthPostNums={selectedNums ?? new Set()}
            items={allFetched}
            onClose={() => setSelectedMonth(null)}
            postLinkParams={item => `highlight=${encodeURIComponent(item.text)}&rk=question`}
          />
        )}

        {/* Sync groups detail panel — EDITING side-panel for the sync above. */}
        {CAN_EDIT && showSyncGroups && syncGroups.length > 0 && (() => {
          const normalizedGroups = syncGroups.filter(g => g.hasNormalized)
          const allGroupsDisplay = syncGroupTab === 'normalized' ? normalizedGroups : syncGroups
          const sgSearchLower = syncGroupSearch.toLowerCase()
          const displayed = sgSearchLower
            ? allGroupsDisplay.filter(g =>
                g.canonical.toLowerCase().includes(sgSearchLower) ||
                g.variants.some(v => v.text.toLowerCase().includes(sgSearchLower))
              )
            : allGroupsDisplay

          return (
            <div className="bg-q-panel border border-orange-800/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-white font-semibold text-sm">Similar Question Groups</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-orange-800/60 border border-orange-600 mr-1 align-middle" />
                    Orange = canonical (standard form) &nbsp;·&nbsp;
                    <span className="text-red-400 font-medium">Red</span> = discrepancy detected &amp; normalized
                  </p>
                </div>
                <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-0.5">
                  <button
                    onClick={() => setSyncGroupTab('normalized')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${syncGroupTab === 'normalized' ? 'bg-orange-700 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Normalized ({normalizedGroups.length})
                  </button>
                  <button
                    onClick={() => setSyncGroupTab('all')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${syncGroupTab === 'all' ? 'bg-orange-700 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    All Groups ({syncGroups.length})
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={syncGroupSearch}
                onChange={e => setSyncGroupSearch(e.target.value)}
                placeholder="Search within groups…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-600"
              />
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {displayed.length === 0 ? (
                  <p className="text-gray-500 text-xs text-center py-4">No groups match your search.</p>
                ) : displayed.map((g, gi) => (
                  <div key={gi} className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 space-y-2">
                    <HoverTip tip="CANONICAL FORM — This is the standardized phrasing that all similar variants have been linked to. The system detected these questions as 85%+ identical and merged them under this exact wording.">
                      <div className="flex items-start gap-2 bg-orange-950/50 border border-orange-800/60 rounded-md px-2 py-1.5">
                        <span className="shrink-0 text-xs bg-orange-900/80 text-orange-300 border border-orange-700 px-2 py-0.5 rounded font-bold mt-0.5 uppercase tracking-wide">
                          canonical
                        </span>
                        <p className="text-orange-200 text-sm leading-snug font-medium">{g.canonical}</p>
                      </div>
                    </HoverTip>
                    <div className="space-y-1 pl-2 border-l-2 border-gray-700">
                      {g.variants.map((v, vi) => (
                        <div key={vi} className="flex items-start gap-2 text-xs">
                          <Link
                            to={`/post/${v.postNum}?highlight=${encodeURIComponent(v.text)}&rk=question&flash=1`}
                            className="shrink-0 text-blue-400 hover:text-blue-300 font-mono mt-0.5"
                          >
                            #{v.postNum}
                          </Link>
                          {v.wasNormalized ? (
                            <HoverTip tip="DISCREPANCY DETECTED — This phrasing differed from the canonical form (e.g. a period '.' where a question mark '?' was expected, or slight wording variation). It has been normalized in the database to match the canonical version above.">
                              <span className="text-red-400 leading-snug">
                                {v.text}
                                <span className="ml-1.5 text-gray-600 not-italic">→ normalized</span>
                              </span>
                            </HoverTip>
                          ) : (
                            <HoverTip tip="MATCHED — This instance already used the canonical phrasing. No change was needed; it was grouped with the others as a repeated occurrence.">
                              <span className="text-gray-400 leading-snug">{v.text}</span>
                            </HoverTip>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 text-right">Showing {displayed.length} of {allGroupsDisplay.length} groups</p>
            </div>
          )
        })()}

        {/* ── Repeated Questions (2+) ──────────────────────────────────── */}
        {/*
          Hidden while a month is selected, and this is not cosmetic.

          The month panel above counts things IN that month: "24 repeated" means asked more
          than once DURING August 2018. This list counts questions repeated across the WHOLE
          archive that happen to have an ask in August 2018 — a different question with a
          different answer (83). Both were labelled "August 2018", so the page showed two
          contradictory counts for what looked like the same thing.

          The month panel already ranks every question in that month by how often it was
          asked, so it answers what the click was asking. These lists are the all-time view
          and come back when the month is cleared.
        */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading questions…</div>
        ) : selectedMonth ? (
          <p className="text-xs text-gray-500 border-t border-q-border pt-3">
            Showing <span className="text-gray-300 font-medium">{formatMonth(selectedMonth)}</span> only —
            the panel above ranks every question asked that month.{' '}
            <button onClick={() => setSelectedMonth(null)} className="text-blue-400 hover:text-blue-300 hover:underline">
              Clear the month
            </button>{' '}
            to browse the whole archive by how often each question repeats.
          </p>
        ) : (
          <>
            <div ref={listRef} className="scroll-mt-24">
              {/* Count and month filter sit beside the heading rather than across the page —
                  on a wide screen they were marooned at the far right, away from what they
                  describe. */}
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-white font-semibold">Repeated Questions</h2>
                {selectedMonth && (
                  <button
                    onClick={() => setSelectedMonth(null)}
                    className="text-xs text-blue-400 hover:text-white bg-blue-900/30 border border-blue-700 px-2 py-0.5 rounded transition-colors"
                  >
                    {formatMonth(selectedMonth)} ✕ Clear
                  </button>
                )}
                <span className="text-xs text-blue-400 font-medium bg-blue-900/30 border border-blue-800 px-2 py-0.5 rounded">
                  {repeatedFiltered.length} questions
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">Asked more than once — sorted by frequency</p>
            </div>

            {repeatedFiltered.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {search ? 'No repeated questions match your search.' : 'No repeated questions found yet.'}
              </div>
            ) : (
              <div className="space-y-2">
                {repeatedFiltered.slice(0, visibleRepeated).map((r, i) => (
                  <QuestionCard key={i} r={r} selectedNums={selectedNums} hoverNums={hoverNums} flashNums={flashMonth ? selectedNums : null} rank={rankByQuestion.get(normalizeItemKey(r.text)) ?? i + 1} monthOf={n => postNumToMonth[n]} />
                ))}
                {repeatedFiltered.length > visibleRepeated && (
                  <div className="flex items-center justify-center gap-3 py-3">
                    <button
                      onClick={() => setVisibleRepeated(n => n + PAGE)}
                      className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-400 text-gray-200 px-5 py-2 rounded-lg transition-colors"
                    >
                      Show {Math.min(PAGE, repeatedFiltered.length - visibleRepeated).toLocaleString()} more
                    </button>
                    <span className="text-xs text-gray-500">
                      showing {visibleRepeated.toLocaleString()} of {repeatedFiltered.length.toLocaleString()}
                    </span>
                    <button onClick={() => setVisibleRepeated(repeatedFiltered.length)} className="text-xs text-gray-400 hover:text-white underline">show all</button>
                  </div>
                )}
              </div>
            )}

            {/* ── Single Questions (1x) — below the timeline ───────────── */}
            <div className="pt-2 border-t border-q-border">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-white font-semibold">Asked Once</h2>
                <span className="text-xs text-gray-400 font-medium bg-gray-800 border border-gray-700 px-2 py-0.5 rounded">
                  {singlesFiltered.length} questions
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">Questions that have appeared in only one post so far</p>
            </div>

            {singlesFiltered.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {search ? 'No single questions match your search.' : 'No single-occurrence questions found.'}
              </div>
            ) : (
              <div className="space-y-2">
                {singlesFiltered.slice(0, visibleSingles).map((r, i) => (
                  <QuestionCard key={i} r={r} selectedNums={selectedNums} hoverNums={hoverNums} flashNums={flashMonth ? selectedNums : null} rank={rankByQuestion.get(normalizeItemKey(r.text)) ?? repeatedAll.length + i + 1} monthOf={n => postNumToMonth[n]} />
                ))}
                {singlesFiltered.length > visibleSingles && (
                  <div className="flex items-center justify-center gap-3 py-3">
                    <button
                      onClick={() => setVisibleSingles(n => n + PAGE)}
                      className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-400 text-gray-200 px-5 py-2 rounded-lg transition-colors"
                    >
                      Show {Math.min(PAGE, singlesFiltered.length - visibleSingles).toLocaleString()} more
                    </button>
                    <span className="text-xs text-gray-500">
                      showing {visibleSingles.toLocaleString()} of {singlesFiltered.length.toLocaleString()}
                    </span>
                    <button onClick={() => setVisibleSingles(singlesFiltered.length)} className="text-xs text-gray-400 hover:text-white underline">show all</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>{/* end scrollable content */}
    </div>
  )
}
