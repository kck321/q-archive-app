import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { getAliasGroup } from '../lib/aliases'
import { SEARCHED_CHIP, assignAliasColors } from '../lib/aliasColors'
import { countPhraseOccurrences, normalizeItemKey, getTermPresence, type TermPresence, getPosts, searchAllPosts, getQuestionsForPosts, addManualQuestion, getQuestionsTimeline, getPostNumsByMonth, getPostsByNums, getStats, countPostsWithBrackets, getBracketsByMonth } from '../lib/posts'
import PostCard from '../components/PostCard'
import type { QPost } from '../types'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, LabelList,
} from 'recharts'
import ScrollableChart from '../components/ScrollableChart'
import TermPresenceBar from '../components/TermPresenceBar'
import { matchAxisMax, MatchCountLabel, NO_MATCH_GREY } from '../lib/chartSearch'
import { getTermMatchesInSection, type TermSectionMatch } from '../lib/posts'
import { catColor, seriesColor } from '../lib/categoryColors'
import { CAN_EDIT, IS_PUBLIC_SITE } from '../lib/appMode'

function gradientColor(count: number, maxCount: number, dark = false): string {
  if (count === 0 || maxCount === 0) return dark ? '#14532d' : '#1f2937'
  const ratio = Math.min(1, count / maxCount)
  // green → yellow → red (most matches = red)
  let r: number, g: number, b: number
  if (ratio <= 0.5) {
    const t = ratio * 2
    r = Math.round(34 + (234 - 34) * t)
    g = Math.round(197 + (179 - 197) * t)
    b = Math.round(94 + (8 - 94) * t)
  } else {
    const t = (ratio - 0.5) * 2
    r = Math.round(234 + (239 - 234) * t)
    g = Math.round(179 + (68 - 179) * t)
    b = Math.round(8 + (68 - 8) * t)
  }
  return dark
    ? `rgb(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)})`
    : `rgb(${r},${g},${b})`
}

function MonthPostsPanel({ month, posts, loading, onClose }: {
  month: string
  posts: QPost[]
  loading: boolean
  onClose: () => void
}) {
  const [y, mo] = month.split('-')
  const monthLabel = new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  return (
    <div className="bg-q-panel border border-blue-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold text-sm">{monthLabel}</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {loading ? 'Loading…' : `${posts.length} posts — click any number to open`}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded transition-colors">✕ Close</button>
      </div>
      {loading ? (
        <div className="text-center py-4 text-gray-500 animate-pulse text-sm">Loading posts…</div>
      ) : posts.length === 0 ? (
        <p className="text-gray-500 text-sm">No posts found for this month.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
          {posts.map(p => (
            <Link key={p.postNum} to={`/post/${p.postNum}?flash=1`} className="text-xs px-2 py-1 bg-gray-800 hover:bg-blue-900/50 text-gray-300 hover:text-blue-300 border border-gray-700 hover:border-blue-600 rounded transition-colors font-mono">
              #{p.postNum}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
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
    <div style={{
      position: 'relative',
      background: 'rgba(22,22,28,0.97)',
      border: '1px solid #3a3a46',
      borderRadius: 16,
      padding: '13px 17px',
      fontSize: 12,
      minWidth: 172,
      boxShadow: '0 12px 34px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(3px)',
    }}>
      {/* balloon tail pointing back toward the selected bar */}
      <span style={{ position: 'absolute', left: -9, top: 22, width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: '9px solid #3a3a46' }} />
      <span style={{ position: 'absolute', left: -7, top: 22, width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: '9px solid rgba(22,22,28,0.97)' }} />
      <p style={{ color: '#f3f4f6', marginBottom: 8, fontWeight: 700, fontSize: 13 }}>{monthLabel}</p>
      {payload.map((item, i) => {
        // Tint each row to match the bar it describes, so the tooltip reads as the same
        // legend rather than nine identical grey lines.
        const c = seriesColor(item.name)
        return (
          <p key={i} style={{ margin: '3px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: c }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
              {item.name}
            </span>
            <span style={{ color: '#f3f4f6', fontWeight: 600 }}>{item.value}</span>
          </p>
        )
      })}
      {keyword && (
        <p style={{ color: '#9ca3af', margin: '8px 0 0', borderTop: '1px solid #2f2f38', paddingTop: 7, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span>"{keyword}"</span><span style={{ color: keyCount > 0 ? gradientColor(keyCount, matchMax ?? 1) : '#6b7280', fontWeight: 600 }}>{keyCount} match{keyCount !== 1 ? 'es' : ''}</span>
        </p>
      )}
    </div>
  )
}

const CHART_TABS: { key: string; label: string; dataKey: string; color: string; dimColor: string; to: string }[] = [
  { key: 'questions',          label: 'Q Questions',   dataKey: 'questions',          color: '#3b82f6', dimColor: '#1e3a5f', to: '/questions' },
  { key: 'requests',           label: 'Q Requests',    dataKey: 'requests',           color: '#22c55e', dimColor: '#14532d', to: '/requests' },
  { key: 'claims',             label: 'Q Claims',      dataKey: 'claims',             color: '#f59e0b', dimColor: '#78350f', to: '/analysis?tab=claims' },
  { key: 'predictions',        label: 'Q Predictions', dataKey: 'predictions',        color: '#8b5cf6', dimColor: '#3b0764', to: '/analysis?tab=predictions' },
  { key: 'namedEntities',      label: 'Q Entities',    dataKey: 'namedEntities',      color: '#06b6d4', dimColor: '#164e63', to: '/analysis?tab=namedEntities' },
  { key: 'brackets',           label: 'Q [ Brackets ]', dataKey: 'brackets',          color: '#ef4444', dimColor: '#7f1d1d', to: '/brackets' },
  { key: 'themes',             label: 'Q Themes',      dataKey: 'themes',             color: '#6366f1', dimColor: '#312e81', to: '/analysis?tab=themes' },
  { key: 'impliedConclusions', label: 'Q Conclusions', dataKey: 'impliedConclusions', color: '#f97316', dimColor: '#7c2d12', to: '/analysis?tab=impliedConclusions' },
  { key: 'verificationHooks',  label: 'Checkable Claims',       dataKey: 'verificationHooks',  color: '#d946ef', dimColor: '#701a75', to: '/analysis?tab=verificationHooks' },
]

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

export default function PostArchive() {
  const navigate = useNavigate()
  const [urlParams, setUrlParams] = useSearchParams()

  // Paginated browse mode
  const [posts, setPosts] = useState<QPost[]>([])
  const [postQuestions, setPostQuestions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')

  // Keyword search-all mode
  const initialQ = urlParams.get('q') ?? ''
  const initialExact = urlParams.get('exact') === '1'
  const [searchInput, setSearchInput] = useState(initialQ ? (initialExact ? `"${initialQ}"` : initialQ) : '')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<QPost[]>([])
  const [searching, setSearching] = useState(false)
  const isSearchMode = searchTerm.length > 0

  // Post number jump
  const [postNumInput, setPostNumInput] = useState('')
  const [postNumError, setPostNumError] = useState('')

  // Stats
  const [stats, setStats] = useState<{ totalPosts: number; totalQuestions: number; greenCount: number; yellowCount: number; redCount: number } | null>(null)
  const [bracketCount, setBracketCount] = useState<number | null>(null)

  // Sort direction
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Timeline chart
  const [timeline, setTimeline] = useState<{ month: string; questions: number; posts: number; requests: number; claims: number; predictions: number; namedEntities: number; themes: number; impliedConclusions: number; verificationHooks: number; brackets: number }[]>([])
  const [postNumsByMonth, setPostNumsByMonth] = useState<Record<string, number[]>>({})
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [hoverMonth, setHoverMonth] = useState<string | null>(null)
  // Selecting a month flashes that month's jump-chips white for a few seconds.
  const [flashMonth, setFlashMonth] = useState(false)
  useEffect(() => {
    if (!selectedMonth) { setFlashMonth(false); return }
    setFlashMonth(true)
    const t = setTimeout(() => setFlashMonth(false), 5000)
    return () => clearTimeout(t)
  }, [selectedMonth])
  const [chartTab, setChartTab] = useState<string>('all')
  const [hoverTab, setHoverTab] = useState<string | null>(null) // hovering a tab previews that category's chart
  const [chartSearch, setChartSearch] = useState('')
  const [chartMatchMonths, setChartMatchMonths] = useState<Map<string, number> | null>(null)
  const [monthPosts, setMonthPosts] = useState<QPost[]>([])
  const [monthPostsLoading, setMonthPostsLoading] = useState(false)

  async function load(reset = false, dir: 'asc' | 'desc' = sortDir) {
    if (reset) { setLoading(true); setError('') }
    else setLoadingMore(true)
    try {
      const { posts: newPosts, nextCursor } = await getPosts(
        reset ? undefined : (cursor ?? undefined),
        undefined,
        dir
      )
      setPosts(reset ? newPosts : prev => [...prev, ...newPosts])
      setCursor(nextCursor)
      setHasMore(nextCursor !== null)
      const ids = newPosts.filter(p => p.hasQuestions).map(p => p.id)
      if (ids.length > 0) {
        getQuestionsForPosts(ids).then(qMap =>
          setPostQuestions(prev => ({ ...prev, ...qMap }))
        )
      }
    } catch (e) {
      setError('Failed to load posts — Firestore may be busy. Try refreshing in a moment.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => { load(true, sortDir) }, [sortDir])
  useEffect(() => {
    Promise.all([getQuestionsTimeline(), getBracketsByMonth()]).then(([tl, bm]) =>
      setTimeline(tl.map(e => ({ ...e, brackets: bm[e.month] ?? 0 }))))
    getPostNumsByMonth().then(setPostNumsByMonth)
    getStats().then(setStats)
    countPostsWithBrackets().then(setBracketCount)
  }, [])

  // Auto-run search from URL params (restores state when navigating back)
  useEffect(() => {
    const q = urlParams.get('q')
    if (q) runSearch(q, urlParams.get('exact') === '1')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save scroll position when leaving; restore after search results render
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const saved = sessionStorage.getItem('postArchiveScroll')
    if (saved) requestAnimationFrame(() => { main.scrollTop = Number(saved) })
    return () => {
      sessionStorage.setItem('postArchiveScroll', String(main.scrollTop))
    }
  }, [searchResults])

  async function runSearch(term: string, isExact: boolean) {
    setSearching(true)
    setSearchTerm(term)
    setError('')
    // Persist in URL so back-navigation restores the search
    setUrlParams(isExact ? { q: term, exact: '1' } : { q: term }, { replace: true })
    try {
      const results = await searchAllPosts(term, isExact)
      setSearchResults(results)
      const ids = results.filter(p => p.hasQuestions).map(p => p.id)
      if (ids.length > 0) {
        getQuestionsForPosts(ids).then(qMap =>
          setPostQuestions(prev => ({ ...prev, ...qMap }))
        )
      }
      // A new search starts clean — otherwise it opens already narrowed to whatever month
      // was selected for the PREVIOUS term, hiding results with no visible cause.
      setSelectedMonth(null)
      setHoverMonth(null)
      // Auto-populate chart with search term density — reuse results already fetched
      setChartSearch(term)
      const map = new Map<string, number>()
      for (const p of results) {
        const ms = p.timestamp > 1e10 ? p.timestamp : p.timestamp * 1000
        const d = new Date(ms)
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        map.set(month, (map.get(month) ?? 0) + 1)
      }
      setChartMatchMonths(map)
    } catch (e) {
      console.error('searchAllPosts error:', e)
      setError(`Search failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSearching(false)
    }
  }

  async function handleSearch() {
    const raw = searchInput.trim()
    // "BO" (quoted) → exact word-boundary match; BO (unquoted) → substring match
    const isExact = /^["'].*["']$/.test(raw)
    const term = raw.replace(/^["']|["']$/g, '').trim()
    if (!term) return
    await runSearch(term, isExact)
  }

  // Full reset back to a clean page. Every piece of search state has to go, not just the
  // chart overlay: a leftover month, an open section panel or a stale chart tab all keep
  // filtering the next search invisibly.
  function handleClearSearch() {
    setSearchInput('')
    setSearchTerm('')
    setSearchResults([])
    setUrlParams({}, { replace: true })
    setChartMatchMonths(null)
    setChartSearch('')
    setSelectedMonth(null)
    setHoverMonth(null)
    setActiveSection(null)
    setSectionMatches(null)
    setChartTab('all')
    setHoverTab(null)
    setPostNumInput('')
    setError('')
  }

  function handleGoToPost() {
    const num = parseInt(postNumInput.trim(), 10)
    if (isNaN(num) || num < 1 || num > 4966) {
      setPostNumError('Enter a valid post number (1–4966)')
      return
    }
    setPostNumError('')
    navigate(`/post/${num}`)
  }

  async function handleAddQuestion(postId: string, postNum: number, text: string) {
    await addManualQuestion(postId, postNum, text)
    // Update local question highlights
    setPostQuestions(prev => ({
      ...prev,
      [postId]: [...(prev[postId] ?? []), text],
    }))
    // Mark post as having questions in whichever list is active
    const updater = (p: QPost) => p.id === postId ? { ...p, hasQuestions: true } : p
    if (isSearchMode) {
      setSearchResults(prev => prev.map(updater))
    } else {
      setPosts(prev => prev.map(updater))
    }
  }

  useEffect(() => {
    if (!selectedMonth) { setMonthPosts([]); return }
    const nums = postNumsByMonth[selectedMonth] ?? []
    if (nums.length === 0) { setMonthPosts([]); return }
    setMonthPostsLoading(true)
    getPostsByNums(nums).then(setMonthPosts).finally(() => setMonthPostsLoading(false))
  }, [selectedMonth, postNumsByMonth])

  // Recharts delivers one click to BOTH the chart-level handler and the bar under the
  // cursor. With toggle semantics that is on-then-off in a single click — which looked
  // like "it takes three clicks". Ignore a repeat of the same month within one interaction.
  const lastMonthClick = useRef<{ month: string; at: number }>({ month: '', at: 0 })
  function handleBarClick(data: { month: string } | null | undefined) {
    const month = data?.month
    if (!month) return
    const now = performance.now()
    if (lastMonthClick.current.month === month && now - lastMonthClick.current.at < 350) return
    lastMonthClick.current = { month, at: now }
    setSelectedMonth(prev => prev === month ? null : month)
  }


  const chartMatchMax = chartMatchMonths ? Math.max(1, ...chartMatchMonths.values()) : 1

  const analysisTotals = useMemo(() => {
    if (timeline.length === 0) return null
    return timeline.reduce((acc, e) => ({
      requests: acc.requests + e.requests,
      claims: acc.claims + e.claims,
      predictions: acc.predictions + e.predictions,
      namedEntities: acc.namedEntities + e.namedEntities,
      themes: acc.themes + e.themes,
      impliedConclusions: acc.impliedConclusions + e.impliedConclusions,
      verificationHooks: acc.verificationHooks + e.verificationHooks,
    }), { requests: 0, claims: 0, predictions: 0, namedEntities: 0, themes: 0, impliedConclusions: 0, verificationHooks: 0 })
  }, [timeline])

  // Search results ordered with the EXACT searched-term posts first (so they're read first).
  const { searchedNums, quotedNums, orderedResults: allOrdered } = useMemo(() => {
    const termLower = searchTerm.toLowerCase().trim()
    const searched = new Set(searchResults.filter(p => (p.text ?? '').toLowerCase().includes(termLower)).map(p => p.postNum))
    // Matched in the post being replied to rather than in Q's own words. These used to fall
    // in with the alias matches under a label saying they don't contain the term — but they
    // do, in the quoted post, which is the whole reason the drop exists. #2124's body is only
    // ">>2950820"; "Breitbart article" is in what it replies to.
    const viaQuote = new Set(
      searchResults
        .filter(p => !searched.has(p.postNum) &&
          (p.quotedPosts ?? []).some(q => (q.depth ?? 0) <= 1 && (q.text ?? '').toLowerCase().includes(termLower)))
        .map(p => p.postNum)
    )
    const rank = (p: QPost) => searched.has(p.postNum) ? 0 : viaQuote.has(p.postNum) ? 1 : 2
    const ordered = [...searchResults].sort((a, b) => rank(a) - rank(b) || a.postNum - b.postNum)
    return { searchedNums: searched, quotedNums: viaQuote, orderedResults: ordered }
  }, [searchResults, searchTerm])

  // Alias color-coding: the searched term gets the red "searched" color, each other alias in the
  // group its own distinct color. `postColor` picks a single color per post by which member it
  // contains (searched term wins, then group order); posts matched only by date fall back to grey.
  // How many times the term (or any alias of it) actually appears in each matching post.
  // "32 posts" undercounts when a drop says "proof" four times — and knowing which post is
  // dense is how you decide what to open first.
  const mentionCounts = useMemo(() => {
    const group = getAliasGroup(searchTerm).map(normalizeItemKey).filter(Boolean)
    const map = new Map<number, number>()
    if (group.length === 0) return map
    for (const p of searchResults) {
      const padded = ` ${normalizeItemKey(p.text ?? '')} `
      let n = 0
      for (const g of group) n += countPhraseOccurrences(padded, g)
      if (n > 0) map.set(p.postNum, n)
    }
    return map
  }, [searchResults, searchTerm])

  // Clicking a section tab shows that section's matches INLINE rather than navigating —
  // the post list you were reading stays where it is.
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [sectionMatches, setSectionMatches] = useState<TermSectionMatch[] | null>(null)
  const [sectionLoading, setSectionLoading] = useState(false)
  useEffect(() => {
    const t = searchTerm.trim()
    if (!t || !activeSection) { setSectionMatches(null); return }
    let cancelled = false
    setSectionLoading(true)
    getTermMatchesInSection(t, activeSection)
      .then(m => { if (!cancelled) setSectionMatches(m) })
      .finally(() => { if (!cancelled) setSectionLoading(false) })
    return () => { cancelled = true }
  }, [searchTerm, activeSection])
  // A new search closes the panel.
  useEffect(() => { setActiveSection(null) }, [searchTerm])

  // Carry the active search across to whichever section you click. Landing on Q Requests
  // with an empty search after searching "Proof" here means retyping it — and the count on
  // the tab you just clicked was for the term, so an unfiltered page contradicts it.
  const withSearch = (to: string) => {
    const t = searchTerm.trim()
    if (!t) return to
    return `${to}${to.includes('?') ? '&' : '?'}q=${encodeURIComponent(t)}`
  }

  const monthOfPost = useMemo(() => {
    const m = new Map<number, string>()
    for (const [month, nums] of Object.entries(postNumsByMonth)) for (const n of nums) m.set(n, month)
    return m
  }, [postNumsByMonth])

  // Clicking a month narrows the cards below to that month, in post order — so the posts
  // you highlighted on the chart are the ones you can actually read, without scrolling
  // past the rest of the result set.
  const orderedResults = useMemo(() => {
    if (!selectedMonth) return allOrdered
    const inMonth = allOrdered.filter(p => monthOfPost.get(p.postNum) === selectedMonth)
    return inMonth.length ? [...inMonth].sort((a, b) => a.postNum - b.postNum) : allOrdered
  }, [allOrdered, selectedMonth, monthOfPost])

  // Same shape as every other section: a dedicated `matches` series beside the grey posts
  // bar, rather than tinting the posts bar itself. Tinting hid the actual match count —
  // a month with 1 hit and a month with 9 were the same height, only a different shade.
  const chartData = useMemo(
    () => timeline.map(e => ({ ...e, matches: chartMatchMonths?.get(e.month) ?? 0 })),
    [timeline, chartMatchMonths],
  )

  // Which analysis sections carry the searched term — drives the tab strip below so it
  // shows the term's own counts and hides sections the term never appears in.
  const [termPresence, setTermPresence] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    const t = searchTerm.trim()
    if (!t) { setTermPresence(null); return }
    let cancelled = false
    getTermPresence(t).then((list: TermPresence[]) => {
      if (cancelled) return
      setTermPresence(Object.fromEntries(list.map((x: TermPresence) => [x.key, x.posts])))
    })
    return () => { cancelled = true }
  }, [searchTerm])


  const totalMentions = useMemo(
    () => [...mentionCounts.values()].reduce((a, b) => a + b, 0),
    [mentionCounts],
  )

  const { aliasColor, postColor } = useMemo(() => {
    const group = getAliasGroup(searchTerm)
    const { colorOf, priority } = assignAliasColors(group, searchTerm, SEARCHED_CHIP)
    const byPost = new Map<number, string>()
    for (const p of searchResults) {
      const t = (p.text ?? '').toLowerCase()
      const hit = priority.find(m => t.includes(m))
      if (hit) byPost.set(p.postNum, colorOf.get(hit)!)
    }
    return { aliasColor: colorOf, postColor: byPost }
  }, [searchResults, searchTerm])

  // Total connections per category — shown under each chart tab label.
  const tabCounts: Record<string, number | null> = {
    questions:          stats?.totalQuestions ?? null,
    requests:           analysisTotals?.requests ?? null,
    claims:             analysisTotals?.claims ?? null,
    predictions:        analysisTotals?.predictions ?? null,
    namedEntities:      analysisTotals?.namedEntities ?? null,
    themes:             analysisTotals?.themes ?? null,
    impliedConclusions: analysisTotals?.impliedConclusions ?? null,
    verificationHooks:  analysisTotals?.verificationHooks ?? null,
    brackets:           bracketCount,
  }


  const browsePosts = posts

  function formatMonth(m: string) {
    const [y, mo] = m.split('-')
    return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex flex-col">

      {/* ── Sticky toolbar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a] border-b border-q-border px-6 pt-5 pb-4 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.6)]">

        {/* What this site is — public build only. On the editing build it is just noise:
            you already know what the app does, and the toolbar is crowded enough. */}
        {IS_PUBLIC_SITE && (
          <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
            Built for researching the <span className="text-gray-200 font-medium">language</span> of
            the Q posts. Every drop broken down into what it asked, claimed, predicted and named.
          </p>
        )}

        {/* Title + search row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-white leading-tight">Post Archive</h1>
            <p className="text-gray-500 text-xs">4,966 Q posts</p>
          </div>
          {/* Keyword search */}
          <div className="flex-1 min-w-[220px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search all 4,966 posts…"
              className="w-full bg-q-panel border border-q-border rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-q-accent transition-colors"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
              >✕</button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={!searchInput.trim() || searching}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shrink-0"
          >
            {searching ? 'Searching…' : 'Search All'}
          </button>
          {isSearchMode && (
            <button
              onClick={handleClearSearch}
              className="bg-q-panel border border-q-border hover:border-gray-500 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Go to post # + filter tabs */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Post # jump + sort direction */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">#</span>
              <input
                type="number"
                min={1}
                max={4966}
                value={postNumInput}
                onChange={e => { setPostNumInput(e.target.value); setPostNumError('') }}
                onKeyDown={e => e.key === 'Enter' && handleGoToPost()}
                placeholder="Post number…"
                className="w-36 bg-q-panel border border-q-border rounded-lg pl-7 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-q-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <button
              onClick={handleGoToPost}
              disabled={!postNumInput.trim()}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-medium px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              Go to Post
            </button>
            {/* Sort direction — inline next to Go to Post */}
            <div className="flex gap-1 bg-q-panel border border-q-border rounded-lg p-1 ml-4">
              <button
                onClick={() => setSortDir('asc')}
                title="Post #1 → #4966 (oldest first)"
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${sortDir === 'asc' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                #1 → #4966
              </button>
              <button
                onClick={() => setSortDir('desc')}
                title="Post #4966 → #1 (newest first)"
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${sortDir === 'desc' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                #4966 → #1
              </button>
            </div>
            {postNumError && (
              <span className="text-red-400 text-xs">{postNumError}</span>
            )}
          </div>

        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────── */}
      <div className="px-6 py-4 space-y-4 w-full max-w-5xl">

        {/* Which analysis sections also carry this term. Renders nothing at all when the
            term appears in none of them, so an unmatched search adds no empty furniture. */}
        {searchTerm.trim() && <TermPresenceBar term={searchTerm} activeKey="postArchive" />}

        {/* Timeline Chart — identical to Dashboard */}
        {timeline.length > 0 && (
          <div className="bg-q-panel border border-q-border rounded-xl p-5">
            {/* Tab strip */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => { setChartTab('all'); setChartMatchMonths(null); setChartSearch(''); setSelectedMonth(null) }}
                onMouseEnter={() => setHoverTab('all')}
                onMouseLeave={() => setHoverTab(null)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors border flex flex-col items-center leading-tight"
                style={chartTab === 'all'
                  ? { backgroundColor: '#ffffff22', borderColor: '#9ca3af88', color: '#e5e7eb' }
                  : { background: 'transparent', borderColor: '#374151', color: '#9ca3af' }}
              >
                <span>All</span>
                <span className="text-[10px] font-bold opacity-90">{stats ? stats.totalPosts.toLocaleString() : '—'}</span>
              </button>
              {CHART_TABS.filter(t => !termPresence || termPresence[t.key] != null).map(t => (
                searchTerm.trim() ? (
                <button
                  key={t.key}
                  onClick={() => setActiveSection(prev => prev === t.key ? null : t.key)}
                  onMouseEnter={() => setHoverTab(t.key)}
                  onMouseLeave={() => setHoverTab(null)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border hover:brightness-125 flex flex-col items-center leading-tight ${activeSection === t.key ? 'ring-2 ring-white/70' : ''}`}
                  style={{ backgroundColor: t.color + (activeSection === t.key ? '44' : '22'), borderColor: t.color + '88', color: t.color }}
                  title={`Show ${t.label} matching "${searchTerm.trim()}" below`}
                >
                  <span>{t.label}</span>
                  <span className="text-[10px] font-bold opacity-90">
                    {(termPresence?.[t.key] ?? 0).toLocaleString()}
                  </span>
                </button>
                ) : (
                <Link
                  key={t.key}
                  to={withSearch(t.to)}
                  onMouseEnter={() => setHoverTab(t.key)}
                  onMouseLeave={() => setHoverTab(null)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors border hover:brightness-125 flex flex-col items-center leading-tight"
                  style={{ backgroundColor: t.color + '22', borderColor: t.color + '88', color: t.color }}
                  title={`Hover to preview · click to open ${t.label}`}
                >
                  <span>{t.label} ↗</span>
                  <span className="text-[10px] font-bold opacity-90">
                    {termPresence
                      ? (termPresence[t.key] ?? 0).toLocaleString()
                      : tabCounts[t.key] != null ? tabCounts[t.key]!.toLocaleString() : '—'}
                  </span>
                </Link>
                )
              ))}
              <button
                onClick={() => { setChartTab('postsOnly'); setChartMatchMonths(null); setChartSearch(''); setSelectedMonth(null) }}
                onMouseEnter={() => setHoverTab('postsOnly')}
                onMouseLeave={() => setHoverTab(null)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors border flex flex-col items-center leading-tight"
                style={chartTab === 'postsOnly'
                  ? { backgroundColor: '#9ca3af33', borderColor: '#9ca3af88', color: '#d1d5db' }
                  : { background: 'transparent', borderColor: '#374151', color: '#9ca3af' }}
              >
                <span>Q Posts</span>
                <span className="text-[10px] font-bold opacity-90">{stats ? stats.totalPosts.toLocaleString() : '—'}</span>
              </button>
            </div>

            {(() => {
              // Hovering a tab previews that category's chart (click still navigates / selects).
              // Ignore hover while a keyword search is painting the chart.
              const effTab = chartMatchMonths ? chartTab : (hoverTab ?? chartTab)
              const activeTab = CHART_TABS.find(t => t.key === effTab)
              const isAll = effTab === 'all'
              const isPostsOnly = effTab === 'postsOnly'
              const chartTitle = chartMatchMonths
                ? `Q Post Timeline — "${chartSearch}" appearances`
                : isAll ? 'Q Post Timeline — All Categories' : isPostsOnly ? 'Q Posts per Month' : `${activeTab?.label ?? ''} vs. Posts per Month`
              const chartSubtitle = chartMatchMonths
                ? `${[...chartMatchMonths.values()].reduce((a,b)=>a+b,0)} posts matched · bars colored green→red by density · click a bar to view those posts`
                : selectedMonth
                  ? `Showing posts for ${formatMonth(selectedMonth)} — click bar again to close`
                  : isAll
                    ? 'Click a bar to view all posts in that month'
                    : isPostsOnly
                      ? 'Total Q posts published per month · click a bar to view those posts'
                      : `Grey = total posts · colored = ${activeTab?.label ?? ''} count · click a bar to view posts`
              const matchCount = chartMatchMonths ? [...chartMatchMonths.values()].reduce((a,b)=>a+b,0) : 0
              return (
                <>
                  <div className="inline-flex items-stretch gap-4 mb-1">
                    <div className="min-w-0">
                      <h2 className="text-white font-semibold">{chartTitle}</h2>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {chartMatchMonths
                          ? `${matchCount} posts matched · bars colored green→red by density · click a bar to view those posts`
                          : chartSubtitle}
                      </p>
                    </div>
                    {chartMatchMonths && (
                      <button
                        onClick={handleClearSearch}
                        className="text-xs bg-gray-800 border px-3 rounded-lg self-stretch animate-btn-flash hover:animate-none hover:text-white hover:bg-gray-700 hover:border-gray-500"
                      >
                        ✕ Clear "{chartSearch}"
                      </button>
                    )}
                    {!chartMatchMonths && selectedMonth && (
                      <button
                        onClick={() => setSelectedMonth(null)}
                        className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        ✕ Close month
                      </button>
                    )}
                  </div>

                  <ScrollableChart minWidth={920}><ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: chartMatchMonths ? 22 : 4, right: 8, left: -16, bottom: 0 }}
                      onMouseMove={(st: { activeLabel?: string | number }) => setHoverMonth(typeof st?.activeLabel === 'string' ? st.activeLabel : null)}
                      onMouseLeave={() => setHoverMonth(null)}
                      onClick={d => { const p = (d as { activePayload?: { payload: { month: string } }[] }); if (p) handleBarClick(p.activePayload?.[0]?.payload) }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis dataKey="month" tick={<CustomXAxisTick />} interval={0} height={44} />
                      <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }} />
                      {chartMatchMonths && (
                        <YAxis yAxisId="matches" orientation="right" hide domain={[0, matchAxisMax(chartMatchMax)]} />
                      )}
                      <Tooltip offset={28} cursor={{ fill: 'rgba(255,255,255,0.06)' }} wrapperStyle={{ zIndex: 50 }} content={(props: any) => <ChartTooltip {...props} keyword={chartMatchMonths ? chartSearch : null} matchCounts={chartMatchMonths} matchMax={chartMatchMax} />} />

                      {/* Posts bar — always shown */}
                      <Bar yAxisId="left" dataKey="posts" name="Q Posts" radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}
                        onClick={(d: { month?: string; payload?: { month?: string } }) => handleBarClick({ month: d?.month ?? d?.payload?.month ?? '' })}>
                        {chartData.map(entry => (
                          <Cell key={entry.month} fill={!selectedMonth || selectedMonth === entry.month ? '#9ca3af' : '#374151'} />
                        ))}
                      </Bar>

                      {/* Matches — its own bar on its own axis, green (few) → red (many). */}
                      {chartMatchMonths && (
                        <Bar yAxisId="matches" dataKey="matches" name={`"${chartSearch}" matches`} radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }} minPointSize={3}
                          onClick={(d: { month?: string; payload?: { month?: string } }) => handleBarClick({ month: d?.month ?? d?.payload?.month ?? '' })}>
                          <LabelList dataKey="matches" position="top" content={MatchCountLabel} />
                          {chartData.map(entry => (
                            <Cell
                              key={entry.month}
                              fill={
                                (selectedMonth && selectedMonth !== entry.month) || entry.matches === 0
                                  ? NO_MATCH_GREY
                                  : gradientColor(entry.matches, chartMatchMax)
                              }
                            />
                          ))}
                        </Bar>
                      )}

                      {/* All categories view — hidden when keyword search is active */}
                      {isAll && !chartMatchMonths && (<>
                        <Bar dataKey="questions" name="Questions" radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}>
                          {timeline.map(entry => (
                            <Cell key={entry.month} fill={!selectedMonth || selectedMonth === entry.month ? '#3b82f6' : '#1e3a5f'} />
                          ))}
                        </Bar>
                        <Bar dataKey="requests"           name="Requests"           radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}>
                          {timeline.map(e => <Cell key={e.month} fill={!selectedMonth || selectedMonth === e.month ? '#22c55e' : '#14532d'} />)}
                        </Bar>
                        <Bar dataKey="claims"             name="Claims"             stackId="a" fill={catColor('claims')} radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                        <Bar dataKey="predictions"        name="Predictions"        stackId="a" fill={catColor('predictions')} radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                        <Bar dataKey="namedEntities"      name="Named Entities"     stackId="a" fill={catColor('namedEntities')} radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                        <Bar dataKey="themes"             name="Themes"             stackId="a" fill={catColor('themes')} radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                        <Bar dataKey="impliedConclusions" name="Impl. Conclusions"  stackId="a" fill={catColor('impliedConclusions')} radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                        <Bar dataKey="verificationHooks"  name="Checkable Claims" stackId="a" fill={catColor('verificationHooks')} radius={[2,2,0,0]} style={{ cursor: 'pointer' }} />
                      </>)}

                      {/* Single category view — hidden when keyword search is active */}
                      {!isAll && !isPostsOnly && !chartMatchMonths && activeTab && (
                        <Bar dataKey={activeTab.dataKey} name={activeTab.label} radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}>
                          {timeline.map(entry => (
                            <Cell key={entry.month} fill={!selectedMonth || selectedMonth === entry.month ? activeTab.color : activeTab.dimColor} />
                          ))}
                        </Bar>
                      )}
                    </BarChart>
                  </ResponsiveContainer></ScrollableChart>
                </>
              )
            })()}
          </div>
        )}

        {/* Inline section results — what the Requests/Claims/etc page would show for this
            term, rendered here so you never leave the post list you were reading. */}
        {activeSection && searchTerm.trim() && (() => {
          const tab = CHART_TABS.find(t => t.key === activeSection)
          const color = tab?.color ?? '#9ca3af'
          const totalPosts = new Set((sectionMatches ?? []).flatMap(m => m.postNums)).size
          return (
            <div className="bg-q-panel border rounded-xl p-4 space-y-3" style={{ borderColor: color + '66' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold" style={{ color }}>{tab?.label ?? activeSection}</span>
                <span className="text-xs text-gray-400">
                  matching “{searchTerm.trim()}”
                  {!sectionLoading && sectionMatches && (
                    <> · {sectionMatches.length.toLocaleString()} item{sectionMatches.length !== 1 ? 's' : ''} across {totalPosts.toLocaleString()} post{totalPosts !== 1 ? 's' : ''}</>
                  )}
                </span>
                {sectionLoading && <span className="text-[11px] text-gray-600 animate-pulse">loading…</span>}
                <button
                  onClick={() => setActiveSection(null)}
                  className="ml-auto text-xs text-gray-300 hover:text-white bg-gray-800 border border-gray-600 px-3 py-1 rounded-lg transition-colors"
                >
                  ✕ Close
                </button>
              </div>

              {!sectionLoading && sectionMatches?.length === 0 && (
                <p className="text-xs text-gray-500">Nothing in this section matches that term.</p>
              )}

              <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
                {(sectionMatches ?? []).map((m, i) => (
                  <div key={i} className="bg-black/20 border border-q-border rounded-lg p-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-gray-600 tabular-nums">{i + 1}</span>
                      <span className="text-sm text-gray-200 flex-1 min-w-0">{m.text}</span>
                      {/* Only worth saying when it repeats — "1 mention" is just noise
                          next to "x1 posts", which already says the same thing. */}
                      {m.occurrences > m.postNums.length && (
                        <span className="text-[11px] font-bold text-amber-300/90 whitespace-nowrap">{m.occurrences.toLocaleString()} mentions</span>
                      )}
                      {m.postNums.length > 1 && (
                        <span className="text-[11px] font-bold text-white bg-gray-700 border border-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                          ×{m.postNums.length} posts
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {m.postNums.map(num => {
                        const month = monthOfPost.get(num)
                        const inMonth = selectedMonth ? month === selectedMonth : null
                        const pulsing = (hoverMonth && month === hoverMonth) || (inMonth && flashMonth)
                        return (
                          <Link
                            key={num}
                            to={`/post/${num}?flash=1&highlight=${encodeURIComponent(m.text)}`}
                            className={`text-xs px-1.5 py-0.5 rounded font-mono border bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-white transition-all ${
                              inMonth === null ? '' : inMonth ? 'ring-2 ring-white/70 font-bold' : 'opacity-30'
                            } ${pulsing ? 'animate-chip-pulse font-bold z-10 relative' : ''}`}
                          >
                            #{num}
                            {(m.repeats?.[num] ?? 0) > 1 && (
                              <span className="ml-1 text-amber-300 font-bold">×{m.repeats[num]}</span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Month posts panel — only when NOT searching. With a search active it would list
            every post in the month, burying the handful that actually matched; the chips
            below are already highlighted, which is the answer you wanted. */}
        {selectedMonth && !isSearchMode && (
          <MonthPostsPanel month={selectedMonth} posts={monthPosts} loading={monthPostsLoading} onClose={() => setSelectedMonth(null)} />
        )}

        {/* While searching, a compact confirmation instead: how many of the MATCHING posts
            fall in the month you clicked. */}
        {selectedMonth && isSearchMode && (() => {
          const inMonth = searchResults.filter(p => monthOfPost.get(p.postNum) === selectedMonth)
          const mentions = inMonth.reduce((n, p) => n + (mentionCounts.get(p.postNum) ?? 0), 0)
          return (
            <div className="flex items-center gap-3 flex-wrap bg-white/5 border border-white/20 rounded-xl px-4 py-2.5">
              <span className="text-sm text-white font-semibold">{formatMonth(selectedMonth)}</span>
              <span className="text-xs text-gray-400">
                {inMonth.length.toLocaleString()} of your {searchResults.length.toLocaleString()} matching
                post{searchResults.length !== 1 ? 's' : ''}
                {mentions > inMonth.length && <> · {mentions.toLocaleString()} mentions</>}
                {' '}— flashing white below
              </span>
              <button
                onClick={() => setSelectedMonth(null)}
                className="ml-auto text-xs text-gray-300 hover:text-white bg-gray-800 border border-gray-600 px-3 py-1 rounded-lg transition-colors"
              >
                ✕ Clear month
              </button>
            </div>
          )
        })()}

        {/* Error banner — shown in both search and browse modes */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">
            {error} <button onClick={() => { setError(''); if (!isSearchMode) load(true) }} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Search results mode */}
        {isSearchMode ? (
          <>
            <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
              <p className="text-blue-300 text-sm">
                Found <span className="font-bold text-white">{searchResults.length}</span> posts
                matching <span className="font-bold text-white">"{searchTerm}"</span>
                {totalMentions > searchResults.length && (
                  <> · <span className="font-bold text-amber-300">{totalMentions.toLocaleString()}</span> total mentions</>
                )}
                {' '}— text, date, or alias · sorted oldest to newest
              </p>
            </div>
            {/* Alias breakdown + quick-jump chips (searched term first & highlighted) */}
            {!searching && searchResults.length > 0 && (() => {
              const group = getAliasGroup(searchTerm)
              const termLower = searchTerm.toLowerCase().trim()
              const textOf = (p: QPost) => (p.text ?? '').toLowerCase()
              // post #s that contain the EXACT searched term
              const searchedNums = new Set(searchResults.filter(p => textOf(p).includes(termLower)).map(p => p.postNum))
              // per-alias counts (only meaningful when there's a group)
              const breakdown = group.length > 1
                ? group.map(g => ({
                    term: g,
                    isSearched: g.toLowerCase().trim() === termLower,
                    count: searchResults.filter(p => textOf(p).includes(g.toLowerCase().trim())).length,
                  })).sort((a, b) => (b.isSearched ? 1 : 0) - (a.isSearched ? 1 : 0) || b.count - a.count)
                : []
              // searched-term posts first, then the rest
              const ordered = [...searchResults].sort((a, b) =>
                (searchedNums.has(a.postNum) ? 0 : 1) - (searchedNums.has(b.postNum) ? 0 : 1) || a.postNum - b.postNum)
              return (
                <div className="bg-q-panel border border-q-border rounded-xl p-3 space-y-2">
                  {breakdown.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-q-border">
                      <span className="text-xs text-gray-500">Includes:</span>
                      {breakdown.map(b => (
                        <span key={b.term}
                          className={`text-xs px-2 py-0.5 rounded border font-mono ${aliasColor.get(b.term.toLowerCase().trim()) ?? 'bg-gray-800 text-gray-300 border-gray-600'}`}>
                          {b.term} <span className="opacity-70 font-bold">×{b.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    {searchResults.length} posts — click a number to jump
                    {searchedNums.size > 0 && breakdown.length > 0 && <span className="text-red-300"> · {searchedNums.size} contain "{searchTerm}" exactly (shown first, in red)</span>}
                    {quotedNums.size > 0 && <span className="text-amber-300"> · {quotedNums.size} in the post being replied to</span>}
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-44 overflow-y-auto pr-1">
                    {ordered.map(p => {
                      const mentions = mentionCounts.get(p.postNum) ?? 0
                      const month = monthOfPost.get(p.postNum)
                      const inMonth = selectedMonth ? month === selectedMonth : null
                      const pulsing = (hoverMonth && month === hoverMonth) || (inMonth && flashMonth)
                      return (
                        <Link key={p.id} to={`/post/${p.postNum}?flash=1&highlight=${encodeURIComponent(searchTerm)}`}
                          title={mentions > 1 ? `mentioned ${mentions} times in #${p.postNum}` : undefined}
                          className={`text-xs px-2 py-0.5 rounded font-mono border transition-all ${postColor.get(p.postNum) ?? 'bg-gray-800 hover:bg-blue-900/50 text-gray-400 hover:text-blue-300 border-gray-700 hover:border-blue-600'} ${mentions > 1 ? 'border-amber-500/70' : ''} ${
                            inMonth === null ? '' : inMonth ? 'ring-2 ring-white/70 font-bold scale-105' : 'opacity-30'
                          } ${pulsing ? 'animate-chip-pulse font-bold z-10 relative' : ''}`}>
                          #{p.postNum}
                          {mentions > 1 && <span className="ml-1 text-amber-300 font-bold">×{mentions}</span>}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
            {searching ? (
              <div className="text-center py-12 text-gray-500 animate-pulse">
                Searching all 4,966 posts…
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No posts found containing "{searchTerm}".
              </div>
            ) : (
              <div className="grid gap-3 w-full max-w-3xl">
                {orderedResults.map((p, i) => {
                  const exact = searchedNums.has(p.postNum)
                  const viaQuote = quotedNums.has(p.postNum)
                  const bucket = exact ? 0 : viaQuote ? 1 : 2
                  const prev = orderedResults[i - 1]
                  const prevBucket = !prev ? -1
                    : searchedNums.has(prev.postNum) ? 0 : quotedNums.has(prev.postNum) ? 1 : 2
                  return (
                    <div key={p.id}>
                      {/* divider each time the match kind changes */}
                      {i > 0 && bucket !== prevBucket && (
                        <p className="text-xs text-gray-500 mb-3 mt-1 border-t border-q-border pt-3">
                          {bucket === 1
                            ? <>↓ Posts where "{searchTerm}" is in the post being replied to</>
                            : <>↓ Other posts via alias (don't contain "{searchTerm}" exactly)</>}
                        </p>
                      )}
                      <div className={exact ? 'ring-1 ring-red-700/50 rounded-xl' : ''}>
                        <PostCard post={p}
                          questionTexts={postQuestions[p.id]}
                          searchKeyword={searchTerm}
                          onAddQuestion={CAN_EDIT ? handleAddQuestion : undefined}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* Browse mode */
          <>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading posts…</div>
            ) : !error && browsePosts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No posts found.</div>
            ) : (
              <>
                <p className="text-xs text-gray-500">{browsePosts.length} posts shown</p>
                <div className="grid gap-3 w-full max-w-3xl">
                  {browsePosts.map(p => (
                    <PostCard key={p.id} post={p}
                      questionTexts={postQuestions[p.id]}
                      onAddQuestion={CAN_EDIT ? handleAddQuestion : undefined}
                    />
                  ))}
                </div>
                {hasMore && (
                  <button
                    onClick={() => load(false)}
                    disabled={loadingMore}
                    className="w-full py-3 bg-q-panel border border-q-border rounded-xl text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm"
                  >
                    {loadingMore ? 'Loading…' : 'Load More Posts'}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
