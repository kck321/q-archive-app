import { useEffect, useState, useMemo, useRef } from 'react'
import {  Link, useSearchParams } from 'react-router-dom'
import { getFullAliasGroup, subscribeAliases } from '../lib/aliases'
import { SEARCHED_CHIP, assignAliasColors } from '../lib/aliasColors'
import { countPhraseOccurrences, normalizeItemKey, countPostsOnMonthDay, parseDateQuery, getTermPresence, type TermPresence, getPosts, searchAllPosts, getQuestionsForPosts, addManualQuestion, getQuestionsTimeline, getPostNumsByMonth, getPostsByNums, getStats, countPostsWithBrackets, getBracketsByMonth } from '../lib/posts'
import PostCard from '../components/PostCard'
import type { QPost } from '../types'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, LabelList,
} from 'recharts'
import { MonthYearTick, yearStartsOf } from '../lib/chartAxis'
import { MonthTooltip, MonthPicker, MonthFilterBar } from '../components/MonthFilter'
import { useMonthFilter, formatMonth } from '../lib/monthFilter'
import ScrollableChart from '../components/ScrollableChart'
import TermPresenceBar from '../components/TermPresenceBar'
import { matchAxisMax, MatchCountLabel, NO_MATCH_GREY } from '../lib/chartSearch'
import { getTermMatchesInSection, type TermSectionMatch } from '../lib/posts'
import { getPictureTextByPost } from '../lib/pictureAnalysis'
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

// ChartTooltip lived here. It was the Post Archive's own copy of a month tooltip — same job as
// the one on Analysis, different markup, different wording, and free to drift from it. Both pages
// now render MonthTooltip from components/MonthFilter, which is the point of that module.

const CHART_TABS: { key: string; label: string; dataKey: string; color: string; dimColor: string; to: string }[] = [
  { key: 'questions',          label: 'Q Questions',   dataKey: 'questions',          color: '#3b82f6', dimColor: '#1e3a5f', to: '/questions' },
  { key: 'requests',           label: 'Q Directives',    dataKey: 'requests',           color: '#22c55e', dimColor: '#14532d', to: '/requests' },
  { key: 'claims',             label: 'Q Claims',      dataKey: 'claims',             color: '#f59e0b', dimColor: '#78350f', to: '/analysis?tab=claims' },
  { key: 'predictions',        label: 'Q Predictions', dataKey: 'predictions',        color: '#8b5cf6', dimColor: '#3b0764', to: '/analysis?tab=predictions' },
  { key: 'namedEntities',      label: 'Q Entities',    dataKey: 'namedEntities',      color: '#06b6d4', dimColor: '#164e63', to: '/analysis?tab=namedEntities' },
  { key: 'brackets',           label: 'Q [ Brackets ]', dataKey: 'brackets',          color: '#ef4444', dimColor: '#7f1d1d', to: '/brackets' },
  { key: 'themes',             label: 'Q Themes',      dataKey: 'themes',             color: '#6366f1', dimColor: '#312e81', to: '/analysis?tab=themes' },
  { key: 'impliedConclusions', label: 'Q Conclusions', dataKey: 'impliedConclusions', color: '#f97316', dimColor: '#7c2d12', to: '/analysis?tab=impliedConclusions' },
  { key: 'verificationHooks',  label: 'Checkable Claims',       dataKey: 'verificationHooks',  color: '#d946ef', dimColor: '#701a75', to: '/analysis?tab=verificationHooks' },
  { key: 'emphasis',           label: 'Q Emphasis',    dataKey: 'emphasis',           color: '#94a3b8', dimColor: '#334155', to: '/analysis?tab=emphasis' },
]


/**
 * X-axis tick: the year the timeline has reached, plus the delta marker.
 *
 * Only months carrying a delta used to render anything at all, so most of the axis was
 * blank and the chart gave no sense of WHEN you were looking. The year is drawn once per
 * year — at its first month present in the data — with a tick mark, which is enough to
 * place any bar without crowding ~62 months of labels into 920px.
 */
export default function PostArchive() {
  const [urlParams, setUrlParams] = useSearchParams()

  // Paginated browse mode
  const [posts, setPosts] = useState<QPost[]>([])
  const [postQuestions, setPostQuestions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [jumpTarget, setJumpTarget] = useState<number | null>(null)
  // Which target the list was already re-opened for, so the reset happens once per jump.
  const openedAt = useRef<number | null>(null)
  const [error, setError] = useState('')

  // Keyword search-all mode
  // ?goto=N — arrive from a drop's own header and land on that card IN THE LIST, neighbours
  // visible, exactly as typing N into "Go to Post" does. The first version of that link used
  // ?q=#N, which is a SEARCH for the literal text "#N": it returned a one-post filtered view
  // with a facet strip and a timeline, which is the opposite of seeing a drop in context.
  const gotoParam = Number(urlParams.get('goto') ?? '')
  useEffect(() => {
    if (!Number.isFinite(gotoParam) || gotoParam < 1 || gotoParam > 4966) return
    // Approach from the END THE POST IS NEAR. The archive pages in, and the jump loads pages until
    // the card exists — so asking for #8 while sorted #4966 -> #1 means walking the ENTIRE archive
    // to reach the last row, and the reader gets "#8 is not in the current list" long before it
    // arrives. Sorted #1 -> #4966, #8 is on the first page.
    const nearStart = gotoParam <= 2483
    if ((nearStart && sortDir !== 'asc') || (!nearStart && sortDir !== 'desc')) {
      setSortDir(nearStart ? 'asc' : 'desc')   // triggers the reload effect below
    }
    // A jump is a request to SEE that drop; an active search would hide it and produce the same
    // misleading "not in the current list".
    if (searchTerm) { setSearchTerm(''); setSearchInput(''); load(true, nearStart ? 'asc' : 'desc') }
    setPostNumError('')
    setJumpTarget(gotoParam)
  }, [gotoParam])

  const initialQ = urlParams.get('q') ?? ''
  const initialExact = urlParams.get('exact') === '1'
  const [searchInput, setSearchInput] = useState(initialQ ? (initialExact ? `"${initialQ}"` : initialQ) : '')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<QPost[]>([])
  // What the visible results were searched for — replayed when the alias registries load.
  const lastSearchRef = useRef<{ term: string; isExact: boolean } | null>(null)
  const [searching, setSearching] = useState(false)
  const isSearchMode = searchTerm.length > 0

  // Post number jump
  const [postNumInput, setPostNumInput] = useState('')
  const [postNumError, setPostNumError] = useState('')

  // Stats
  const [stats, setStats] = useState<{ totalPosts: number; totalQuestions: number; greenCount: number; yellowCount: number; redCount: number } | null>(null)
  const [bracketCount, setBracketCount] = useState<number | null>(null)

  // Sort direction
  // Newest first: the archive opens on the most recent drops rather than October 2017.
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Timeline chart
  const [timeline, setTimeline] = useState<{ month: string; questions: number; posts: number; requests: number; claims: number; predictions: number; namedEntities: number; themes: number; impliedConclusions: number; verificationHooks: number; emphasis: number; brackets: number }[]>([])
  const [postNumsByMonth, setPostNumsByMonth] = useState<Record<string, number[]>>({})
  // ── The month filter, shared with Analysis ────────────────────────────────
  //
  // Selection, the double-delivery guard and the post set all come from useMonthFilter. There is no
  // hover state left: `hoverMonth` and `flashMonth` existed only to pulse the jump-chips in the
  // results below, which fired from a mousemove over the chart and, on a touch screen, from the very
  // tap that was meant to select. Hover reads out; click selects.
  const { selectedMonth, selectMonth, clearMonth, monthPostNums } = useMonthFilter(postNumsByMonth)
  const [chartTab, setChartTab] = useState<string>('all')
  const [hoverTab, setHoverTab] = useState<string | null>(null) // hovering a tab previews that category's chart
  const [chartSearch, setChartSearch] = useState('')
  const [chartMatchMonths, setChartMatchMonths] = useState<Map<string, number> | null>(null)
  const [monthPosts, setMonthPosts] = useState<QPost[]>([])
  const [monthPostsLoading, setMonthPostsLoading] = useState(false)

  // startAt: begin the list AT a position instead of walking to it. A jump to #4900 used to mount
  // every card from the top — thousands of them — which is why it took half a minute and still
  // felt slow at six seconds. Opening the archive at the drop is O(1), the way opening a book at a
  // page is: you arrive there, and scrolling continues from there.
  async function load(reset = false, dir: 'asc' | 'desc' = sortDir, pageSize?: number, startAt?: number) {
    if (reset) { setLoading(true); setError('') }
    else setLoadingMore(true)
    try {
      const { posts: newPosts, nextCursor } = await getPosts(
        startAt ?? (reset ? undefined : (cursor ?? undefined)),
        undefined,
        dir,
        pageSize,
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

  // Re-run the search when the alias registries change.
  //
  // The certified groups are FETCHED at startup (entities.json), so landing on
  // /posts?q=covid-19 ran the search before COVID-19 knew it carried C19 and COVID: the match
  // set came back editable-only while the "Includes:" row — plain JSX, re-evaluated on the next
  // render — listed the certified aliases. The page then advertised spellings it had not
  // searched for, which is worse than showing none. Also covers a live alias edit.
  useEffect(() => subscribeAliases(() => {
    const last = lastSearchRef.current
    if (last) runSearch(last.term, last.isExact)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  // Scroll position is owned by <ScrollRestoration> in App.tsx. It already handles both
  // scroll containers (<main> on desktop, the document on phones), saves in the layout-effect
  // cleanup so the value is not clobbered by the next page, and retries until the position
  // sticks. A second implementation here fought it and hardcoded <main>, which is the wrong
  // element below the lg breakpoint.
  //
  // What this page DOES own is list DEPTH. The archive pages in via "Load More", so returning
  // from a drop you scrolled 600 posts to reach re-rendered only the first page — and no scroll
  // restorer can reach a position in content that has not been loaded. Refilling to the previous
  // depth is what makes the restoration achievable.
  useEffect(() => {
    return () => { sessionStorage.setItem('postArchiveCount', String(posts.length)) }
  }, [posts.length])

  const refillRef = useRef(false)
  useEffect(() => {
    if (refillRef.current || loading || searchResults || posts.length === 0) return
    const want = Number(sessionStorage.getItem('postArchiveCount') ?? 0)
    if (posts.length >= want) { refillRef.current = true; return }
    if (hasMore && !loadingMore) load(false)
  }, [posts.length, loading, loadingMore, hasMore, searchResults])

  async function runSearch(term: string, isExact: boolean) {
    // A bare in-range number means "show me that drop", not "find this text".
    if (tryPostNumberJump(term)) { setSearchInput(term.trim()); return }
    lastSearchRef.current = { term, isExact }
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
      clearMonth()
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

  // Recomputed per render; the page is not open long enough for the date to change, and
  // pinning it in state would go stale across midnight for anyone who leaves a tab open.
  const todaysDelta = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Shown on the button itself, so the count is known before tapping.
  const [deltaCount, setDeltaCount] = useState<number | null>(null)
  useEffect(() => {
    const now = new Date()
    countPostsOnMonthDay(now.getMonth(), now.getDate()).then(setDeltaCount)
  }, [])

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
    clearMonth()
    setActiveSection(null)
    setSectionMatches(null)
    setChartTab('all')
    setHoverTab(null)
    setPostNumInput('')
    setError('')
  }

  // A BARE NUMBER IS A POST NUMBER.
  //
  // Typing "524" into the search box searched the TEXT of every drop for "524" and returned
  // nothing useful — the post-number lookup lived in a separate box beside it, which is not where
  // anyone looks first. A query that is only digits, inside the archive's range, now jumps to that
  // drop instead. Anything else still searches text, so "1776" as a phrase is unaffected: it is
  // out of range, and in-range digits are what a reader means by a post number.
  function tryPostNumberJump(raw: string): boolean {
    const t = raw.trim().replace(/^#/, '')
    if (!/^\d{1,4}$/.test(t)) return false
    const n = Number(t)
    if (n < 1 || n > 4966) return false
    setJumpTarget(n)
    return true
  }

  function handleGoToPost() {
    const num = parseInt(postNumInput.trim(), 10)
    if (isNaN(num) || num < 1 || num > 4966) {
      setPostNumError('Enter a valid post number (1–4966)')
      return
    }
    setPostNumError('')
    // Approach from the end the post is NEAR — sorted #4966 -> #1, reaching #524 means paging
    // through 4,442 drops fifty at a time. Ascending, it is eleven pages.
    const nearStart = num <= 2483
    if ((nearStart && sortDir !== 'asc') || (!nearStart && sortDir !== 'desc')) setSortDir(nearStart ? 'asc' : 'desc')
    // STAY IN THE ARCHIVE.
    //
    // This used to navigate(`/post/${num}`), which left /posts entirely — losing the scroll
    // position, the surrounding drops and any active filter, so getting back meant rebuilding
    // the whole list. Jumping to a post number is a request to LOOK at it in context, not to
    // leave. The card is brought into view and flashed; opening the detail page stays a click.
    setJumpTarget(num)
  }

  // Bring the requested post's card into view, loading more of the list if it has not been
  // fetched yet — the archive pages in as you scroll, so an arbitrary post number is usually
  // not mounted when the jump is requested.
  useEffect(() => {
    if (jumpTarget == null) return
    const el = document.querySelector(`[data-post-num="${jumpTarget}"]`)
    if (el) {
      // SCROLL AGAIN AFTER THE LIST SETTLES.
      //
      // The card exists, but rows above it are still being committed and every one of them has a
      // different height, so a single scrollIntoView lands tens of drops short — #524 arrived at
      // #491. Re-anchoring on a few frames afterwards costs nothing and puts the card where the
      // reader was promised. 'auto' first so the position is correct before the smooth pass.
      const anchor = (behavior: ScrollBehavior) =>
        document.querySelector(`[data-post-num="${jumpTarget}"]`)?.scrollIntoView({ behavior, block: 'center' })
      anchor('auto')
      const again = [120, 400, 900, 1600].map(ms => setTimeout(() => anchor(ms > 400 ? 'smooth' : 'auto'), ms))
      el.classList.add('ring-2', 'ring-blue-400', 'animate-jump-flash')
      const t = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-blue-400', 'animate-jump-flash')
      }, 3200)
      setJumpTarget(null)
      return () => { clearTimeout(t); again.forEach(clearTimeout) }
    }
    // WAIT while a page is in flight. This used to read `hasMore && !loadingMore`, and fall
    // through to the error when either was false — so the moment load(false) set loadingMore, the
    // very next render took the "not in the current list" branch and cleared jumpTarget. The jump
    // loaded exactly ONE extra page and then declared the post missing, which is why "Go to Post
    // 524" failed on a list that simply had not reached #524 yet.
    if (loading || loadingMore) return
    // Open the list AT the drop rather than paging to it: its index is known from its number.
    if (!openedAt.current || openedAt.current !== jumpTarget) {
      openedAt.current = jumpTarget
      const idx = sortDir === 'asc' ? jumpTarget - 1 : 4966 - jumpTarget
      load(true, sortDir, 60, Math.max(0, idx - 4))
      return
    }
    if (hasMore) { load(false, sortDir, 800); return }
    // Every page is loaded and the post is still not here — it is filtered out rather than
    // missing, and saying so beats scrolling to nothing.
    setPostNumError(`#${jumpTarget} is not in the current list — clear the search or filter first`)
    setJumpTarget(null)
  }, [jumpTarget, posts, hasMore, loadingMore, loading])

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
  // The guard against recharts delivering one click twice now lives in useMonthFilter, so both pages
  // get it from the same place. This only adds the phone readout, which is a Post Archive affordance.
  function handleBarClick(data: { month: string } | null | undefined) {
    const month = data?.month
    if (!month) return
    selectMonth(month)
    setTappedMonth(prev => (prev === month ? null : month))
  }


  // A search for a bare date ("Aug 12") is a DELTA — the same calendar day across every
  // year of the archive. It needs its own presentation: the alias breakdown, mention totals
  // and "contains the term exactly" furniture all describe a keyword search and mean nothing
  // for a date.
  const deltaQuery = useMemo(() => {
    if (!searchTerm.trim()) return null
    const q = parseDateQuery(searchTerm.toLowerCase().trim())
    return q && q.month !== undefined && q.day !== undefined && q.year === undefined ? q : null
  }, [searchTerm])

  // Delta results grouped by year — the same day can carry drops from several years, and
  // showing them as one flat list gives no sense of that.
  const deltaByYear = useMemo(() => {
    if (!deltaQuery) return []
    const byYear = new Map<number, QPost[]>()
    for (const p of searchResults) {
      const y = new Date(p.timestamp * 1000).getFullYear()
      const list = byYear.get(y)
      if (list) list.push(p); else byYear.set(y, [p])
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0])
  }, [deltaQuery, searchResults])

  const chartMatchMax = chartMatchMonths ? Math.max(1, ...chartMatchMonths.values()) : 1

  // Where to centre the chart: the month with the most matches for the current search.
  const centerAt = useMemo(() => {
    if (!chartMatchMonths || !timeline.length) return null
    let best: string | null = null, bestN = 0
    for (const [m, n] of chartMatchMonths) if (n > bestN) { bestN = n; best = m }
    if (!best) return null
    const idx = timeline.findIndex(e => e.month === best)
    return idx < 0 ? null : (idx + 0.5) / timeline.length
  }, [chartMatchMonths, timeline])

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
      emphasis: acc.emphasis + (e.emphasis ?? 0),
    }), { requests: 0, claims: 0, predictions: 0, namedEntities: 0, themes: 0, impliedConclusions: 0, verificationHooks: 0, emphasis: 0 })
  }, [timeline])

  // Phone-sized screens get a PINNED tooltip (see the Tooltip props below).
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const on = () => setIsNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Close any open chart tooltip when the page scrolls.
  //
  // Recharts hides a tooltip on mouseleave, which never fires on a touchscreen: tapping the
  // chart opens it and nothing closes it, so it stays pinned over the page as you scroll.
  // Dispatching the leave events the library is listening for is what actually dismisses it;
  // hiding it with CSS only makes it reappear when scrolling stops.
  useEffect(() => {
    let timer: number | undefined
    const dismiss = (e: Event) => {
      // Ignore the chart's own horizontal scroll container. With capture:true this handler
      // also saw that scroll, so swiping the chart sideways to read the tooltip dismissed
      // it immediately — which is why it "sometimes just disappears".
      const t = e.target as HTMLElement | null
      if (t && typeof t.closest === 'function' && t.closest?.('.overflow-x-auto')) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        for (const el of document.querySelectorAll('.recharts-wrapper')) {
          for (const type of ['pointerleave', 'mouseleave', 'mouseout']) {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true }))
          }
        }
      }, 60)
    }
    window.addEventListener('scroll', dismiss, { passive: true, capture: true })
    return () => { window.clearTimeout(timer); window.removeEventListener('scroll', dismiss, true) }
  }, [])

  // Per-post searchable text from the picture-analysis audit (what the attached images
  // SHOW). Loaded once; search-only, never the analysis index.
  const [picTextByPost, setPicTextByPost] = useState<Map<number, string> | null>(null)
  useEffect(() => {
    getPictureTextByPost().then(setPicTextByPost)
  }, [])

  // Search results ordered with the EXACT searched-term posts first (so they're read first).
  const { searchedNums, quotedNums, picNums, orderedResults: allOrdered } = useMemo(() => {
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
    // Matched inside an attached/referenced PICTURE — the vision audit's description,
    // extracted text, people or logos. Shown as its own bucket with "Pic #N" chips.
    const viaPic = new Set(
      termLower && picTextByPost
        ? searchResults
            .filter(p => !searched.has(p.postNum) && !viaQuote.has(p.postNum) &&
              (picTextByPost.get(p.postNum) ?? '').includes(termLower))
            .map(p => p.postNum)
        : []
    )
    const rank = (p: QPost) => searched.has(p.postNum) ? 0 : viaQuote.has(p.postNum) ? 1 : viaPic.has(p.postNum) ? 2 : 3
    const ordered = [...searchResults].sort((a, b) => rank(a) - rank(b) || a.postNum - b.postNum)
    return { searchedNums: searched, quotedNums: viaQuote, picNums: viaPic, orderedResults: ordered }
  }, [searchResults, searchTerm, picTextByPost])

  // Alias color-coding: the searched term gets the red "searched" color, each other alias in the
  // group its own distinct color. `postColor` picks a single color per post by which member it
  // contains (searched term wins, then group order); posts matched only by date fall back to grey.
  // How many times the term (or any alias of it) actually appears in each matching post.
  // "32 posts" undercounts when a drop says "proof" four times — and knowing which post is
  // dense is how you decide what to open first.
  const mentionCounts = useMemo(() => {
    const group = getFullAliasGroup(searchTerm).map(normalizeItemKey).filter(Boolean)
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
  // Hide the toolbar while scrolling DOWN, bring it back on the first scroll UP — so the
  // search is one flick away without permanently costing a phone screen its top strip.
  // It slides back to just under the fixed "Q Drops" bar rather than over it.
  const [hideBar, setHideBar] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        // Near the top it is always shown, and small jitters are ignored so it does not
        // flicker as the browser's own address bar collapses.
        if (y < 90) setHideBar(false)
        else if (Math.abs(y - last) > 8) setHideBar(y > last)
        last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { if (frame) cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll) }
  }, [])

  // Month tapped on a phone, for the readout under the chart.
  const [tappedMonth, setTappedMonth] = useState<string | null>(null)

  // First month present for each year — where the year label and its tick are drawn.
  const yearStarts = useMemo(() => yearStartsOf(timeline), [timeline])

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
    const group = getFullAliasGroup(searchTerm)
    const { colorOf, priority } = assignAliasColors(group, searchTerm, SEARCHED_CHIP)
    const byPost = new Map<number, string>()
    for (const p of searchResults) {
      // Word-level, not substring: colouring a post by `text.includes('us')` paints it as a
      // "USA" hit for the "us" inside because/trust, and a two-letter alias like RC would
      // colour every post containing search/force/Church. Same padded-normalized test the
      // mention counts use, so the chip colour and the count agree about what a hit is.
      const padded = ` ${normalizeItemKey(p.text ?? '')} `
      const hit = priority.find(m => countPhraseOccurrences(padded, normalizeItemKey(m)) > 0)
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
    emphasis:           analysisTotals?.emphasis ?? null,
    brackets:           bracketCount,
  }


  const browsePosts = posts

  return (
    <div className="flex flex-col">

      {/* ── Sticky toolbar ─────────────────────────────────────────────── */}
      {/* Only the title + search stay pinned. Everything else was pinned too, which ate
          most of a phone screen before a single post was visible. z-30 keeps it above the
          chart tooltip, which paints at a higher z-index than the old z-20 and so hung over
          this bar while scrolling past. */}
      {/* Sticks BELOW the fixed "Q Drops" bar on phones (that bar is h-12), and at the
          very top on desktop where there is no such bar. z-20 keeps it under the header and
          over the chart tooltip, which sits at z-10. */}
      <div className={`sticky top-[calc(3rem+env(safe-area-inset-top))] lg:top-0 z-20 bg-[#0a0e1a] border-b border-q-border px-4 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition-transform duration-200 lg:!translate-y-0 ${hideBar ? '-translate-y-[130%]' : 'translate-y-0'}`}>

        {/* Title + search row */}
        {/* One line, always. flex-wrap plus a 220px minimum on the input meant the button
            wrapped onto its own row on a phone, costing a whole line of a screen that has
            few to spare. The input shrinks instead (min-w-0), the buttons never do. */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="shrink-0">
            <button
              onClick={handleClearSearch}
              className="text-base sm:text-xl font-bold text-white leading-tight hover:text-blue-300 transition-colors text-left"
              title="Back to the full archive"
            >
              Post Archive
            </button>
            <p className="hidden sm:block text-gray-500 text-xs">4,966 Q posts</p>
          </div>
          {/* Keyword search */}
          <div className="flex-1 min-w-0 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={isNarrow ? "Search 4,966 posts…" : "Search all 4,966 posts…"}
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
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium px-3 sm:px-5 py-2 rounded-lg transition-colors text-sm shrink-0 whitespace-nowrap"
          >
            {searching ? 'Searching…' : isNarrow ? 'Search' : 'Search All'}
          </button>
          {isSearchMode && (
            <button
              onClick={handleClearSearch}
              className="bg-q-panel border border-q-border hover:border-gray-500 text-gray-400 hover:text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm shrink-0"
            >
              Clear
            </button>
          )}
        </div>

          {/* Post # jump + sort direction */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <input
                type="number"
                min={1}
                max={4966}
                value={postNumInput}
                onChange={e => { setPostNumInput(e.target.value); setPostNumError('') }}
                onKeyDown={e => e.key === 'Enter' && handleGoToPost()}
                placeholder="Post #"
                className="w-[4.5rem] bg-q-panel border border-q-border rounded-lg px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-q-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <button
              onClick={handleGoToPost}
              disabled={!postNumInput.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium px-3 py-1.5 rounded-lg transition-colors text-sm shrink-0 whitespace-nowrap"
            >
              Go<span className="hidden sm:inline"> to Post</span>
            </button>
            {/* Sort direction — inline next to Go to Post */}
            <div className="flex gap-1 bg-q-panel border border-q-border rounded-lg p-1 shrink-0">
              <button
                onClick={() => setSortDir('asc')}
                title="Post #1 → #4966 (oldest first)"
                className={`px-2 sm:px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${sortDir === 'asc' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <span className="sm:hidden">↑ Oldest</span><span className="hidden sm:inline">#1 → #4966</span>
              </button>
              <button
                onClick={() => setSortDir('desc')}
                title="Post #4966 → #1 (newest first)"
                className={`px-2 sm:px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${sortDir === 'desc' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <span className="sm:hidden">↓ Newest</span><span className="hidden sm:inline">#4966 → #1</span>
              </button>
            </div>
            {postNumError && (
              <span className="text-red-400 text-xs">{postNumError}</span>
            )}
          </div>



      </div>

      {/* ── Scrollable content ──────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-4 space-y-4 w-full max-w-5xl">

        {/* SEARCH SUMMARY — hoisted above the Delta button by owner ruling 2026-08-14: the count
            used to sit below the timeline, so on a long page you scrolled past the chart to find
            out what you had searched and how many hits it returned. It reads the same state as
            the banner further down, so the two can never disagree. */}
        {isSearchMode && !searching && !deltaQuery && searchResults.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-4 py-2">
            <p className="text-blue-300 text-sm">
              Found <span className="font-bold text-white">{searchResults.length}</span> posts
              matching <span className="font-bold text-white">"{searchTerm}"</span>
              {totalMentions > searchResults.length && (
                <> · <span className="font-bold text-amber-300">{totalMentions.toLocaleString()}</span> total mentions</>
              )}
              {' '}— text, date, or alias · sorted oldest to newest
            </p>
          </div>
        )}

        {/* "Deltas" — every drop posted on today's month and day, in any year. The search
            already understands a bare date ("Aug 12" → month + day, year unspecified), so
            this is the same query you could type, one tap away. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setSearchInput(todaysDelta); runSearch(todaysDelta, false) }}
            className="text-xs bg-amber-900/30 hover:bg-amber-900/50 text-amber-200 border border-amber-700/60 hover:border-amber-500 px-3 py-1.5 rounded-lg transition-colors"
            title={`Every drop posted on ${todaysDelta}, across all years`}
          >
            📅 See Today's Delta — {todaysDelta}
            {deltaCount !== null && (
              <span className="ml-1.5 font-semibold">
                · {deltaCount} post{deltaCount === 1 ? '' : 's'}
              </span>
            )}
          </button>
        </div>



        {IS_PUBLIC_SITE && (
          <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
            Built for researching the <span className="text-gray-200 font-medium">language</span> of
            the Q posts. Every drop broken down into what it asked, claimed, predicted and named.
          </p>
        )}



        {/* Which analysis sections also carry this term. Renders nothing at all when the
            term appears in none of them, so an unmatched search adds no empty furniture. */}
        {searchTerm.trim() && <TermPresenceBar term={searchTerm} activeKey="postArchive" />}

        {/* Timeline Chart — identical to Dashboard */}
        {timeline.length > 0 && (
          <div className="bg-q-panel border border-q-border rounded-xl p-5">
            {/* Tab strip */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => { setChartTab('all'); setChartMatchMonths(null); setChartSearch(''); clearMonth() }}
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
                onClick={() => { setChartTab('postsOnly'); setChartMatchMonths(null); setChartSearch(''); clearMonth() }}
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
                        onClick={clearMonth}
                        className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        ✕ Close month
                      </button>
                    )}
                  </div>

                  <ScrollableChart minWidth={920} centerAt={centerAt}><ResponsiveContainer width="100%" height={240}>
                    {/* NO onMouseMove / onMouseLeave: they tracked the hovered month only so the
                        jump-chips below could pulse. Hover is the tooltip and nothing else. */}
                    <BarChart data={chartData} margin={{ top: chartMatchMonths ? 22 : 4, right: 8, left: -16, bottom: 0 }}
                      onClick={d => { const p = (d as { activePayload?: { payload: { month: string } }[] }); if (p) handleBarClick(p.activePayload?.[0]?.payload) }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis dataKey="month" tick={(props: any) => <MonthYearTick {...props} yearStarts={yearStarts} />} interval={0} height={52} />
                      <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }} />
                      {chartMatchMonths && (
                        <YAxis yAxisId="matches" orientation="right" hide domain={[0, matchAxisMax(chartMatchMax)]} />
                      )}
                      <Tooltip
                        // The chart is 920px wide inside a horizontal scroller. A tooltip that
                        // follows the tap, offset 28px to the right, lands off-screen for any
                        // bar in the right half. On narrow screens it is pinned to the top-left
                        // of the chart instead, where it is always readable.
                        // Pinned to the top of the plot area: it never covers the bar you are
                        // pointing at, and cannot run off the bottom of a short chart.
                        position={{ y: 0 }}
                        offset={28}
                        // Suppressed on phones — the readout is rendered under the chart
                        // instead, so it covers nothing and has a visible way to close.
                        active={isNarrow ? false : undefined}
                        cursor={{ fill: 'rgba(255,255,255,0.06)' }} wrapperStyle={{ zIndex: 10 }}
                        // One tooltip component, shared with Analysis: the month and its counts.
                        content={props => (
                          <MonthTooltip
                            active={props.active}
                            payload={(props.payload ?? []) as { name: string; value: number }[]}
                            label={props.label as string | undefined}
                            colorOf={seriesColor}
                            extra={chartMatchMonths
                              ? {
                                label: `"${chartSearch}"`,
                                value: chartMatchMonths.get(String(props.label)) ?? 0,
                                color: (chartMatchMonths.get(String(props.label)) ?? 0) > 0 ? gradientColor(chartMatchMonths.get(String(props.label)) ?? 0, chartMatchMax) : '#6b7280',
                              }
                              : null}
                          />
                        )} />

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

                  {/* THE KEYBOARD AND TOUCH PATH, the same component Analysis uses. A recharts bar is
                      an SVG rect that cannot take focus, and the axis only draws a tick at year
                      starts — so ~50 of the 60 months had nothing a keyboard could reach at all. */}
                  <MonthPicker
                    months={chartData.map(e => e.month)}
                    counts={Object.fromEntries(chartData.map(e => [
                      e.month,
                      chartMatchMonths
                        ? (chartMatchMonths.get(e.month) ?? 0)
                        : ((e as unknown as Record<string, number>)[activeTab?.dataKey ?? 'posts'] ?? 0),
                    ]))}
                    selectedMonth={selectedMonth}
                    onSelect={m => handleBarClick({ month: m })}
                    label={chartMatchMonths ? `matches for "${chartSearch}"` : (activeTab?.label ?? 'posts').toLowerCase()}
                    accent={activeTab?.color ?? '#9ca3af'}
                  />

                  {/* Phone readout. Sits UNDER the chart, so it hides none of it, and closes
                      on demand — a touch tooltip never receives a "pointer left" event, which
                      is why the floating one stayed on screen after you lifted your finger. */}
                  {isNarrow && tappedMonth && (() => {
                    const row = chartData.find(d => d.month === tappedMonth)
                    if (!row) return null
                    const series = (isAll
                      ? CHART_TABS.map(t => ({ name: t.label, value: (row as unknown as Record<string, number>)[t.dataKey] ?? 0 }))
                      : activeTab
                        ? [{ name: activeTab.label, value: (row as unknown as Record<string, number>)[activeTab.dataKey] ?? 0 }]
                        : []
                    ).filter(x => x.value > 0)
                    return (
                      <div className="mt-2 bg-q-panel border border-q-border rounded-lg p-3 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-white font-semibold">{formatMonth(tappedMonth)}</span>
                          <button
                            onClick={() => setTappedMonth(null)}
                            className="text-gray-500 hover:text-white px-2 -mr-1"
                            aria-label="Close month readout"
                          >✕</button>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span className="text-gray-400">Posts <span className="text-gray-100 font-semibold">{row.posts}</span></span>
                          {series.map(x => (
                            <span key={x.name} style={{ color: seriesColor(x.name) }}>
                              {x.name} <span className="font-semibold">{x.value}</span>
                            </span>
                          ))}
                          {chartMatchMonths && (
                            <span className="text-amber-300">"{chartSearch}" <span className="font-semibold">{chartMatchMonths.get(tappedMonth) ?? 0}</span></span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
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
                      {/* ONLY THE SELECTED MONTH'S CHIPS. They used to all stay on screen with the
                          out-of-month ones at 30% opacity — still there, still clickable, still
                          counted by eye — so "filtered to March" showed you February's drops greyed
                          out rather than March's drops alone. */}
                      {(monthPostNums ? m.postNums.filter(n => monthPostNums.has(n)) : m.postNums).map(num => {
                        return (
                          <Link
                            key={num}
                            to={`/post/${num}?flash=1&highlight=${encodeURIComponent(m.text)}`}
                            className="text-xs px-1.5 py-0.5 rounded font-mono border bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-white transition-colors"
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
          <MonthPostsPanel month={selectedMonth} posts={monthPosts} loading={monthPostsLoading} onClose={() => clearMonth()} />
        )}

        {/* The active month and the screen-reader announcement, from the same component Analysis
            uses — so the two pages cannot describe one interaction two ways. Selecting a month
            rewrote the list underneath with nothing spoken at all. */}
        <MonthFilterBar
          month={selectedMonth}
          resultCount={selectedMonth
            ? (isSearchMode
              ? searchResults.filter(p => monthOfPost.get(p.postNum) === selectedMonth).length
              : (monthPostNums?.size ?? 0))
            : 0}
          resultNoun={isSearchMode ? `of your ${searchResults.length.toLocaleString()} matching posts` : 'posts'}
          onClear={clearMonth}
          // While browsing, MonthPostsPanel below is the visible confirmation; this still speaks.
          showBar={isSearchMode}
        />

        {/* Error banner — shown in both search and browse modes */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">
            {error} <button onClick={() => { setError(''); if (!isSearchMode) load(true) }} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Search results mode */}
        {isSearchMode ? (
          <>
            {deltaQuery ? (
              <div className="bg-amber-900/20 border border-amber-800/70 rounded-xl p-4">
                <p className="text-amber-200 text-sm">
                  📅 <span className="font-bold text-white">{searchTerm}</span> —{' '}
                  <span className="font-bold text-white">{searchResults.length}</span>{' '}
                  drop{searchResults.length === 1 ? '' : 's'} posted on this day across{' '}
                  <span className="font-bold text-white">{deltaByYear.length}</span>{' '}
                  year{deltaByYear.length === 1 ? '' : 's'}
                  {deltaByYear.length > 0 && (
                    <span className="text-amber-300/80"> · {deltaByYear.map(([y]) => y).join(', ')}</span>
                  )}
                </p>
              </div>
            ) : (
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
            )}
            {/* Alias breakdown + quick-jump chips (searched term first & highlighted) */}
            {!searching && !deltaQuery && searchResults.length > 0 && (() => {
              const group = getFullAliasGroup(searchTerm)
              const termLower = searchTerm.toLowerCase().trim()
              // Word-level containment, the same test the mention counts and chip colours use
              // — an alias chip reading "US ×2,259" would be counting the "us" inside because.
              const paddedOf = (p: QPost) => ` ${normalizeItemKey(p.text ?? '')} `
              const holds = (p: QPost, t: string) => countPhraseOccurrences(paddedOf(p), normalizeItemKey(t)) > 0
              // post #s that contain the EXACT searched term
              const searchedNums = new Set(searchResults.filter(p => holds(p, termLower)).map(p => p.postNum))
              // per-alias counts (only meaningful when there's a group)
              const breakdown = group.length > 1
                ? group.map(g => ({
                    term: g,
                    isSearched: g.toLowerCase().trim() === termLower,
                    count: searchResults.filter(p => holds(p, g)).length,
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
                  {(() => {
                    // Only the selected month's jump-chips. The rest were kept on screen at 30%
                    // opacity, which is not a filter — it is the same list, harder to read.
                    const shown = monthPostNums ? ordered.filter(p => monthPostNums.has(p.postNum)) : ordered
                    return (
                      <>
                        <p className="text-xs text-gray-500">
                          {shown.length} posts — click a number to jump
                          {monthPostNums && <span className="text-gray-400"> in {formatMonth(selectedMonth!)} (of {searchResults.length.toLocaleString()} matching)</span>}
                          {searchedNums.size > 0 && breakdown.length > 0 && <span className="text-red-300"> · {searchedNums.size} contain "{searchTerm}" exactly (shown first, in red)</span>}
                          {quotedNums.size > 0 && <span className="text-amber-300"> · {quotedNums.size} in the post being replied to</span>}
                          {picNums.size > 0 && <span className="text-teal-300"> · {picNums.size} matched inside a picture</span>}
                        </p>
                        {/* Posts where the term is INSIDE an attached picture (its text, people,
                            logos or description) — oldest first, per owner. */}
                        {picNums.size > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pb-1">
                            <span className="text-xs text-teal-400/80 mr-0.5">📷 In pictures:</span>
                            {[...picNums].sort((a, b) => a - b).map(num => (
                              <Link key={num} to={`/post/${num}?flash=1&highlight=${encodeURIComponent(searchTerm)}`}
                                title={`"${searchTerm}" matched inside a picture in #${num}`}
                                className="text-xs px-2 py-0.5 rounded font-mono border bg-teal-900/40 text-teal-300 border-teal-700/50 hover:bg-teal-800/50 hover:text-teal-100 transition-colors">
                                Pic #{num}
                              </Link>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 max-h-44 overflow-y-auto pr-1">
                          {shown.map(p => {
                            const mentions = mentionCounts.get(p.postNum) ?? 0
                            return (
                              <Link key={p.id} to={`/post/${p.postNum}?flash=1&highlight=${encodeURIComponent(searchTerm)}`}
                                title={mentions > 1 ? `mentioned ${mentions} times in #${p.postNum}` : undefined}
                                className={`text-xs px-2 py-0.5 rounded font-mono border transition-colors ${postColor.get(p.postNum) ?? 'bg-gray-800 hover:bg-blue-900/50 text-gray-400 hover:text-blue-300 border-gray-700 hover:border-blue-600'} ${mentions > 1 ? 'border-amber-500/70' : ''}`}>
                                #{p.postNum}
                                {mentions > 1 && <span className="ml-1 text-amber-300 font-bold">×{mentions}</span>}
                              </Link>
                            )
                          })}
                        </div>
                      </>
                    )
                  })()}
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
              deltaQuery ? (
              /* Delta: grouped by year, newest first, so it is obvious the same calendar day
                 carries drops from several different years. */
              <div className="space-y-5 w-full max-w-3xl">
                {deltaByYear.map(([year, list]) => (
                  <div key={year}>
                    <div className="flex items-baseline gap-2 mb-2 border-b border-q-border pb-1">
                      <span className="text-lg font-black text-amber-300">{year}</span>
                      <span className="text-xs text-gray-500">
                        {list.length} drop{list.length === 1 ? '' : 's'} on {searchTerm}
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {list.map(p => (
                        <PostCard key={p.id} post={p}
                          questionTexts={postQuestions[p.id]}
                          onAddQuestion={CAN_EDIT ? handleAddQuestion : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              ) : (
              <div className="grid gap-3 w-full max-w-3xl">
                {orderedResults.map((p, i) => {
                  const exact = searchedNums.has(p.postNum)
                  const bucketOf = (x: QPost) =>
                    searchedNums.has(x.postNum) ? 0 : quotedNums.has(x.postNum) ? 1 : picNums.has(x.postNum) ? 2 : 3
                  const bucket = bucketOf(p)
                  const prev = orderedResults[i - 1]
                  const prevBucket = !prev ? -1 : bucketOf(prev)
                  return (
                    <div key={p.id}>
                      {/* divider each time the match kind changes */}
                      {i > 0 && bucket !== prevBucket && (
                        <p className="text-xs text-gray-500 mb-3 mt-1 border-t border-q-border pt-3">
                          {bucket === 1
                            ? <>↓ Posts where "{searchTerm}" is in the post being replied to</>
                            : bucket === 2
                            ? <>📷 Posts where "{searchTerm}" matched inside an attached picture</>
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
              )
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
