import { useEffect, useMemo, useRef, useState } from 'react'
import SectionInfo from '../components/SectionInfo'
import { Link, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import SearchBar from '../components/SearchBar'
import TimeframeBreakdown from '../components/TimeframeBreakdown'
import {
  getAnalysisFrequency, getOverlappingItems, loadAnalysisConfirmed, saveAnalysisConfirmed, removeAnalysisConfirmed,
  clearAnalysisCategoriesFromPosts, getQuestionsTimeline, getPostNumsByMonth, getPostNumsContaining,
  OVERLAP_CAT_LABELS, normalizeItemKey, makeTermMatcher, getQuestionsForPosts, type AnalysisCategoryFreq, type OverlapItem, type OverlapCat,
} from '../lib/posts'
import { getAliasesFor, getAliasSet, getCertifiedEntityAliasSet, subscribeAliases, displayAlias } from '../lib/aliases'
import PostCard from '../components/PostCard'
import ReaderSentinel from '../components/ReaderSentinel'
import { loadLocalData } from '../lib/localData'
import type { QPost } from '../types'
import { SECTION_TOTALS } from '../lib/sectionInfo'
import { CANON_CHIP, ALIAS_CHIP_PALETTE } from '../lib/aliasColors'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Cell, LabelList,
} from 'recharts'
import { MonthYearTick, yearStartsOf } from '../lib/chartAxis'
import ScrollableChart from '../components/ScrollableChart'
import TermPresenceBar from '../components/TermPresenceBar'
import { catColor } from '../lib/categoryColors'
import { CAN_EDIT } from '../lib/appMode'
import { monthCounts, gradientColor, NO_MATCH_GREY, MatchCountLabel, matchAxisMax, monthSpanLabel } from '../lib/chartSearch'

interface TimelineEntry {
  month: string
  posts: number
  claims: number
  predictions: number
  namedEntities: number
  themes: number
  impliedConclusions: number
  verificationHooks: number
  emphasis: number
}

const CAT_CHART: Record<AnalysisCategoryFreq['category'], { color: string; dimColor: string; dataKey: string }> = {
  claims:             { color: catColor('claims'), dimColor: '#78350f', dataKey: 'claims' },
  predictions:        { color: catColor('predictions'), dimColor: '#3b0764', dataKey: 'predictions' },
  namedEntities:      { color: catColor('namedEntities'), dimColor: '#164e63', dataKey: 'namedEntities' },
  themes:             { color: catColor('themes'), dimColor: '#312e81', dataKey: 'themes' },
  emphasis:           { color: catColor('emphasis'), dimColor: '#334155', dataKey: 'emphasis' },
  impliedConclusions: { color: catColor('impliedConclusions'), dimColor: '#7c2d12', dataKey: 'impliedConclusions' },
  verificationHooks:  { color: catColor('verificationHooks'), dimColor: '#701a75', dataKey: 'verificationHooks' },
}


type Cat = AnalysisCategoryFreq['category'] | 'all' | 'overlaps'

const CAT_LABELS: Record<AnalysisCategoryFreq['category'], string> = {
  claims: 'Claims',
  predictions: 'Predictions',
  namedEntities: 'Named Entities',
  themes: 'Themes',
  emphasis: 'Emphasis',
  impliedConclusions: 'Emphasis',
  verificationHooks: 'Emphasis',
}

const CAT_COLORS: Record<AnalysisCategoryFreq['category'], string> = {
  claims: 'bg-amber-500/25 text-amber-300 border border-amber-700/50',
  predictions: 'bg-violet-500/25 text-violet-300 border border-violet-700/50',
  namedEntities: 'bg-cyan-500/25 text-cyan-300 border border-cyan-700/50',
  themes: 'bg-indigo-500/25 text-indigo-300 border border-indigo-700/50',
  emphasis: 'bg-slate-500/25 text-slate-300 border border-slate-600/50',
  impliedConclusions: 'bg-orange-500/25 text-orange-300 border border-orange-700/50',
  verificationHooks: 'bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-700/50',
}

const CAT_BADGE: Record<AnalysisCategoryFreq['category'], string> = {
  claims: 'bg-amber-900/60 text-amber-400 border border-amber-700/60',
  predictions: 'bg-violet-900/60 text-violet-400 border border-violet-700/60',
  namedEntities: 'bg-cyan-900/60 text-cyan-400 border border-cyan-700/60',
  themes: 'bg-indigo-900/60 text-indigo-400 border border-indigo-700/60',
  emphasis: 'bg-slate-800/60 text-slate-400 border border-slate-600/60',
  impliedConclusions: 'bg-orange-800/60 text-orange-400 border border-orange-700/60',
  verificationHooks: 'bg-fuchsia-800/60 text-fuchsia-400 border border-fuchsia-700/60',
}

const OVERLAP_CAT_COLORS: Record<OverlapCat, string> = {
  // Retired as sections, but OverlapCat still types them — the editorial overlaps view can
  // still surface a legacy row, and it must render rather than crash.
  impliedConclusions: 'bg-orange-900/60 text-orange-300 border-orange-700/60',
  verificationHooks: 'bg-fuchsia-900/60 text-fuchsia-300 border-fuchsia-700/60',
  claims: 'bg-amber-900/60 text-amber-300 border-amber-700/60',
  predictions: 'bg-violet-900/60 text-violet-300 border-violet-700/60',
  namedEntities: 'bg-cyan-900/60 text-cyan-300 border-cyan-700/60',
  themes: 'bg-indigo-900/60 text-indigo-300 border-indigo-700/60',
  emphasis: 'bg-slate-800/60 text-slate-300 border-slate-600/60',
  request: 'bg-green-900/60 text-green-300 border-green-700/60',
  question: 'bg-blue-900/60 text-blue-300 border-blue-700/60',
}

// Button style for assignable category in overlaps
const OVERLAP_BTN_COLORS: Record<OverlapCat, string> = {
  // Retired as sections, but OverlapCat still types them — the editorial overlaps view can
  // still surface a legacy row, and it must render rather than crash.
  impliedConclusions: 'bg-orange-800/60 hover:bg-orange-700/80 text-orange-200 border-orange-600',
  verificationHooks: 'bg-fuchsia-800/60 hover:bg-fuchsia-700/80 text-fuchsia-200 border-fuchsia-600',
  claims: 'bg-amber-800/60 hover:bg-amber-700/80 text-amber-200 border-amber-600',
  predictions: 'bg-violet-800/60 hover:bg-violet-700/80 text-violet-200 border-violet-600',
  namedEntities: 'bg-cyan-800/60 hover:bg-cyan-700/80 text-cyan-200 border-cyan-600',
  themes: 'bg-indigo-800/60 hover:bg-indigo-700/80 text-indigo-200 border-indigo-600',
  emphasis: 'bg-slate-700/60 hover:bg-slate-600/80 text-slate-200 border-slate-500',
  request: 'bg-green-800/60 hover:bg-green-700/80 text-green-200 border-green-600',
  question: 'bg-blue-800/60 hover:bg-blue-700/80 text-blue-200 border-blue-600',
}

// Confirmed key helpers
// These MUST use the same normalization as saveAnalysisConfirmed/removeAnalysisConfirmed
// in posts.ts, or a ✓ tick won't line up with the row it was set on.
function overlapConfirmKey(postNum: number, text: string) {
  return `${postNum}|${normalizeItemKey(text)}`
}
function itemConfirmKey(category: string, text: string) {
  return `global|${category}|${normalizeItemKey(text)}`
}

export default function AnalysisArchive() {
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<AnalysisCategoryFreq[]>([])
  const [aliasPostMap, setAliasPostMap] = useState<Record<string, number[]>>({})  // alias(lower) -> post #s
  const [aliasTick, setAliasTick] = useState(0)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [postNumsByMonth, setPostNumsByMonth] = useState<Record<string, number[]>>({})
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  // Month currently under the cursor on the timeline — drives the chip pulse below.
  const [hoverMonth, setHoverMonth] = useState<string | null>(null)
  // Clicking a month flashes that month's chips white for a few seconds, then settles to a
  // static ring. A ring alone is easy to miss inside a wall of several hundred chips; an
  // endless pulse is noise. The flash draws the eye, the ring keeps the answer.
  const [flashMonth, setFlashMonth] = useState(false)
  // How many rows are rendered. Implied Conclusions alone is 9,010 rows / ~9,000 chips in a
  // single pass — every one a DOM node with handlers, which is what makes the heavy tabs
  // slow. Rendering a page at a time cuts that by ~98% without hiding anything.
  const PAGE = 150
  const [visibleCount, setVisibleCount] = useState(PAGE)
  // Rows with hundreds of post chips (Twitter has 962) dominate the DOM. Show a slice and
  // let the row expand on demand — nothing is hidden, it just isn't all mounted at once.
  const CHIPS = 40
  // Opened a page at a time: a theme can carry 300+ drops, and rendering every one of them
  // at once turns a scan into a freeze.
  const READ_PAGE = 25
  const [expandedChips, setExpandedChips] = useState<Set<string>>(new Set())
  // ── Read the posts inline ────────────────────────────────────────────────
  // The chips answer "which posts", and then made you leave the page to find out what they SAY —
  // one post per round trip, losing the row you were reading. This opens the drops themselves
  // underneath, in post order, so a theme can be scanned in one pass.
  const [readingKey, setReadingKey] = useState<string | null>(null)
  const [readPosts, setReadPosts] = useState<QPost[]>([])
  const [readLoading, setReadLoading] = useState(false)
  const [readLimit, setReadLimit] = useState(READ_PAGE)
  const [readQuestions, setReadQuestions] = useState<Record<string, string[]>>({})
  useEffect(() => {
    if (!selectedMonth) { setFlashMonth(false); return }
    setFlashMonth(true)
    const t = setTimeout(() => setFlashMonth(false), 5000)
    return () => clearTimeout(t)
  }, [selectedMonth])
  const breakdownRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  // Month selection lives here so the chart AND the individual bars can both trigger it.
  // Chart-level `activePayload` is not reliable across recharts versions; a click handler
  // on the Bar itself receives the data entry directly, which is why both are wired.
  // Recharts delivers a single click to BOTH the chart-level handler and the bar it landed
  // on. With toggle semantics that meant on-then-off in the same click, so nothing appeared
  // to happen until an odd number of extra clicks lined up. Ignore a repeat of the same
  // month inside one interaction.
  const lastMonthClick = useRef<{ month: string; at: number }>({ month: '', at: 0 })
  const selectMonth = (m?: string | null) => {
    if (!m) return
    const now = performance.now()
    if (lastMonthClick.current.month === m && now - lastMonthClick.current.at < 350) return
    lastMonthClick.current = { month: m, at: now }
    const next = selectedMonth === m ? null : m
    setSelectedMonth(next)
    if (next) setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  // NOTE: no auto-scroll here. The bar-click handler scrolls to the results list, and a
  // second smooth scroll to the breakdown panel fought it — whichever landed last won,
  // which looked like the click "sometimes" worked.
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Cat>(() => {
    const t = searchParams.get('tab') as Cat | null
    return t && (t === 'all' || (t === 'overlaps' && CAN_EDIT) || t in CAT_LABELS) ? t : 'all'
  })

  // Sync tab when URL param changes (e.g. clicking sidebar links while already on this page)
  useEffect(() => {
    const t = searchParams.get('tab') as Cat | null
    const next = t && (t === 'all' || (t === 'overlaps' && CAN_EDIT) || t in CAT_LABELS) ? t : 'all'
    setActiveTab(next)
    // ?q= lets the "also found in" chips hand a term from one section to another.
    const q = searchParams.get('q')
    if (q !== null) setSearch(q)
  }, [searchParams])
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  // A new search starts clean. Leaving the previous term's month selected meant the next
  // search opened already filtered to a month you picked for something else — results
  // silently missing with no visible cause.
  useEffect(() => { setSelectedMonth(null); setHoverMonth(null) }, [search])
  useEffect(() => { setVisibleCount(PAGE) }, [search, activeTab, selectedMonth])
  const [overlaps, setOverlaps] = useState<OverlapItem[]>([])
  const [overlapsLoading, setOverlapsLoading] = useState(false)
  const [overlapsLoaded, setOverlapsLoaded] = useState(false)

  // Hover + confirmation state
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [confirmedMap, setConfirmedMap] = useState<Map<string, string>>(new Map())
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  useEffect(() => {
    getAnalysisFrequency()
      .then(setItems)
      .finally(() => setLoading(false))
    loadAnalysisConfirmed().then(setConfirmedMap)
    getQuestionsTimeline().then(data => setTimeline(data as unknown as TimelineEntry[]))
    getPostNumsByMonth().then(setPostNumsByMonth)
  }, [])

  // Re-render when aliases change (added/removed elsewhere).
  useEffect(() => subscribeAliases(() => setAliasTick(t => t + 1)), [])

  // For every alias referenced by the loaded items, find which posts contain it,
  // so each entity's row can fold in its alias-spelling posts.
  useEffect(() => {
    const all = new Set<string>()
    for (const it of items) for (const al of getAliasesFor(it.text)) all.add(al)
    if (all.size === 0) { setAliasPostMap({}); return }
    // THE CERTIFIED OCCURRENCES FIRST, a text scan only where there are none.
    //
    // This was a pure text search, and it silently lost whole aliases. Q+ is 36 drops of
    // certified Donald Trump, and postsContainingPhrase refuses any single token of two
    // characters or fewer — a guard that exists to stop US matching becaUSe — so the POTUS
    // card listed Q+ among its other names and not one of its 36 drops. Punctuation is
    // normalised away in that index too, which is the same hazard for every name Q writes with
    // a symbol.
    //
    // A certified row already knows exactly which drops carry the spelling, and using it means
    // every chip on the card is a drop that will actually highlight when you open it. The scan
    // stays as the fallback for hand-typed spellings the adjudication never certified.
    const certifiedPosts = new Map<string, number[]>()
    for (const it of items) {
      if (it.category !== 'namedEntities') continue
      const k = it.text.toLowerCase().trim()
      const prev = certifiedPosts.get(k)
      certifiedPosts.set(k, prev ? [...new Set([...prev, ...it.postNums])] : it.postNums)
    }
    let cancelled = false
    Promise.all([...all].map(async a => {
      const k = a.toLowerCase().trim()
      return [k, certifiedPosts.get(k) ?? await getPostNumsContaining(a)] as const
    })).then(entries => { if (!cancelled) setAliasPostMap(Object.fromEntries(entries)) })
    return () => { cancelled = true }
  }, [items, aliasTick])

  useEffect(() => {
    if (activeTab !== 'overlaps' || overlapsLoaded) return
    setOverlapsLoading(true)
    getOverlappingItems()
      .then(loaded => {
        setOverlaps(loaded)
        // Auto-confirm any unconfirmed overlap whose text ends with '?' as 'question'
        const toAutoConfirm = loaded.filter(o =>
          !confirmedMap.has(overlapConfirmKey(o.postNum, o.text))
          && o.text.trim().endsWith('?')
          && o.categories.includes('question')
        )
        if (toAutoConfirm.length > 0) {
          Promise.all(toAutoConfirm.map(o => saveAnalysisConfirmed(o.postNum, o.text, 'question')))
            .then(() => setConfirmedMap(prev => {
              const m = new Map(prev)
              for (const o of toAutoConfirm) m.set(overlapConfirmKey(o.postNum, o.text), 'question')
              return m
            }))
            .catch(() => {})
        }
      })
      .finally(() => { setOverlapsLoading(false); setOverlapsLoaded(true) })
  }, [activeTab, overlapsLoaded])

  async function handleConfirmOverlap(postNum: number, text: string, category: string, allCategories: OverlapCat[]) {
    const key = overlapConfirmKey(postNum, text)
    setSavingKey(key)
    try {
      await saveAnalysisConfirmed(postNum, text, category)
      setConfirmedMap(prev => new Map(prev).set(key, category))

      // Remove text from all other analysis categories on this post
      const analysisCats = ['claims','predictions','namedEntities','themes','impliedConclusions','verificationHooks','emphasis']
      const othersToRemove = allCategories
        .filter(c => c !== category && analysisCats.includes(c))
        .map(c => ({ category: c as AnalysisCategoryFreq['category'], text, postNums: [postNum] }))

      if (othersToRemove.length > 0) {
        await clearAnalysisCategoriesFromPosts(othersToRemove)
        const norm = text.toLowerCase().trim()
        setItems(prev => prev.filter(
          i => !(i.text.toLowerCase().trim() === norm && othersToRemove.some(o => o.category === i.category))
        ))
      }

      // Remove from overlaps list — it's no longer ambiguous
      setOverlaps(prev => prev.filter(
        o => !(o.postNum === postNum && o.text.toLowerCase().trim() === text.toLowerCase().trim())
      ))
    } finally {
      setSavingKey(null)
    }
  }

  async function handleUnconfirmOverlap(postNum: number, text: string, category: string) {
    const key = overlapConfirmKey(postNum, text)
    setSavingKey(key)
    try {
      await removeAnalysisConfirmed(postNum, text, category)
      setConfirmedMap(prev => { const m = new Map(prev); m.delete(key); return m })
    } finally {
      setSavingKey(null)
    }
  }

  async function handleConfirmItem(category: string, text: string) {
    const key = itemConfirmKey(category, text)
    setSavingKey(key)
    try {
      await saveAnalysisConfirmed(null, `${category}::${text}`, category)
      setConfirmedMap(prev => new Map(prev).set(key, category))

      // Find all other category entries for this same text and remove them from Firestore + local state
      const norm = text.toLowerCase().trim()
      const others = items.filter(
        i => i.text.toLowerCase().trim() === norm && i.category !== category
      ) as { category: AnalysisCategoryFreq['category']; text: string; postNums: number[] }[]

      if (others.length > 0) {
        await clearAnalysisCategoriesFromPosts(others)
        setItems(prev => prev.filter(
          i => !(i.text.toLowerCase().trim() === norm && i.category !== category)
        ))
        // Also clear from overlaps — phrase no longer has conflicting categories
        setOverlaps(prev => prev.filter(o => o.text.toLowerCase().trim() !== norm))
      }
    } finally {
      setSavingKey(null)
    }
  }

  async function handleUnconfirmItem(category: string, text: string) {
    const key = itemConfirmKey(category, text)
    setSavingKey(key)
    try {
      await removeAnalysisConfirmed(null, `${category}::${text}`, category)
      setConfirmedMap(prev => { const m = new Map(prev); m.delete(key); return m })
    } finally {
      setSavingKey(null)
    }
  }

  async function handleDeleteItem(category: AnalysisCategoryFreq['category'], text: string, postNums: number[]) {
    const key = itemConfirmKey(category, text)
    setDeletingKey(key)
    try {
      await clearAnalysisCategoriesFromPosts([{ category, text, postNums }])
      setItems(prev => prev.filter(i => !(i.category === category && i.text === text)))
      // Clean up any confirmation record too
      setConfirmedMap(prev => { const m = new Map(prev); m.delete(key); return m })
    } finally {
      setDeletingKey(null)
    }
  }

  const monthPostNums: Set<number> | null = useMemo(
    () => (selectedMonth ? new Set(postNumsByMonth[selectedMonth] ?? []) : null),
    [selectedMonth, postNumsByMonth],
  )

  // Posts in the hovered month — chips in this set pulse so you can spot them inside a
  // list of hundreds of post numbers without clicking anything.
  const hoverPostNums: Set<number> | null = useMemo(
    () => (hoverMonth ? new Set(postNumsByMonth[hoverMonth] ?? []) : null),
    [hoverMonth, postNumsByMonth],
  )

  // Shared ordering so the ranked base list and the filtered view agree.
  // Ranked by TOTAL MENTIONS — a term said 124 times in one drop outranks one mentioned
  // once across three. Posts break ties so equal-mention items still read sensibly, and
  // post number orders the single-mention tail chronologically.
  // Load the drops for whichever row is open, in POST ORDER — the order Q wrote them, which is
  // the only order a scan can be resumed in.
  useEffect(() => {
    if (!readingKey) { setReadPosts([]); return }
    // itemConfirmKey is the row identity used in the markup — the rank map uses a DIFFERENT
    // format ('cat::text'), and matching on that one found nothing, so the panel opened empty.
    const item = items.find(i => itemConfirmKey(i.category, i.text) === readingKey)
    if (!item) { setReadPosts([]); return }
    let cancelled = false
    setReadLoading(true)
    const wanted = new Set(monthPostNums ? item.postNums.filter(n => monthPostNums.has(n)) : item.postNums)
    // loadLocalData, not getPosts: getPosts pages at PAGE_SIZE, so a row whose drops sit past the
    // first page would open with most of them silently missing.
    loadLocalData()
      .then(({ posts: all }) => {
        if (cancelled) return
        // Oldest -> latest, by the drop's own timestamp. Post-number order was checked against
        // time order across all 4,966 posts and they agree in every case, so this is the same
        // sequence — it just says what it means rather than relying on the numbering holding.
        const list = all.filter(pp => wanted.has(pp.postNum))
          .sort((x, y) => (x.timestamp ?? 0) - (y.timestamp ?? 0) || x.postNum - y.postNum)
        setReadPosts(list)
        // Questions are NOT on the post record — they live in their own collection — so a card
        // rendered without them paints every layer except the blue ones. That is why drops opened
        // HERE showed no questions while the same drop on /posts and /post/:id showed them all.
        getQuestionsForPosts(list.map(pp => pp.id)).then(qMap => { if (!cancelled) setReadQuestions(qMap) })
      })
      .finally(() => { if (!cancelled) setReadLoading(false) })
    return () => { cancelled = true }
  }, [readingKey, items, monthPostNums])

  // Alias rows are folded into their canonical row. Two registries feed this and they have
  // different scopes: the owner-editable groups apply to every category (that is how "HRC" folds
  // into "Hillary Clinton"), while the CERTIFIED entity aliases apply to entity rows ONLY. The
  // certified set holds bare tokens like "US", "CCP" and "COVID" that can equally be the text of
  // a claim or a code, and folding those would silently delete a row from a section the entity
  // ruling never touched.
  const isFoldedAlias = (
    text: string,
    category: string,
    editable: Set<string>,
    cert: Set<string>,
  ) => {
    const t = text.toLowerCase().trim()
    return editable.has(t) || (category === 'namedEntities' && cert.has(t))
  }

  const byRank = (a: AnalysisCategoryFreq, b: AnalysisCategoryFreq) =>
    b.occurrences - a.occurrences
    || b.postNums.length - a.postNums.length
    || (a.postNums[0] ?? 0) - (b.postNums[0] ?? 0)

  // Rank is a PROPERTY OF THE ITEM, not a row position: "the 47th most-referenced entity"
  // stays #47 whether you searched, picked a month, or arrived from another section.
  // Computing it off the filtered list made every click renumber the whole column.
  const rankByItem = useMemo(() => {
    const aliasSet = getAliasSet()
    const certSet = getCertifiedEntityAliasSet()
    const base = items
      .filter(i =>
        (activeTab === 'all' || i.category === activeTab)
        && !isFoldedAlias(i.text, i.category, aliasSet, certSet),
      )
      .sort(byRank)
    const map = new Map<string, number>()
    base.forEach((i, n) => map.set(`${i.category}::${normalizeItemKey(i.text)}`, n + 1))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aliasTick forces re-read of getAliasSet()
  }, [items, activeTab, aliasTick])

  const filtered = useMemo(() => {
    const aliasSet = getAliasSet()
    const certSet = getCertifiedEntityAliasSet()
    return items
      .filter(item => {
        if (activeTab === 'overlaps') return false
        if (activeTab !== 'all' && item.category !== activeTab) return false
        // Fold alias entities (e.g. HRC) into their canonical (Hillary Clinton) — hide the alias row.
        if (isFoldedAlias(item.text, item.category, aliasSet, certSet)) return false
        if (monthPostNums && !item.postNums.some(n => monthPostNums.has(n))) return false
        if (search) {
          // Words-only match: punctuation in either the query or the stored item is
          // ignored, so "future proves past" finds "Future proves past." too.
          // Alias-aware both ways: the typed term's alias group AND the item's own
          // aliases, so "hrc" finds a row stored as "Hillary Clinton" and vice versa.
          const m = makeTermMatcher(search)
          return m.matches(item.text) || getAliasesFor(item.text).some(a => m.matches(a))
        }
        return true
      })
      .sort(byRank)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aliasTick forces re-read of getAliasSet()/getAliasesFor()
  }, [items, activeTab, search, monthPostNums, aliasTick])

  // Arriving from a theme chip (/analysis?tab=themes&q=<theme>) lands on ONE row. Open its drops
  // without a second click — the click on the theme WAS the request to read them.
  //
  // Only when the search resolves to a single row: opening every row of an unfiltered list would
  // mount thousands of drops. And once the reader has been closed by hand for a given row, it
  // stays closed — an auto-open that fights the reader is worse than no auto-open.
  const autoOpened = useRef<string | null>(null)
  useEffect(() => {
    if (!search.trim() || filtered.length !== 1) return
    const only = itemConfirmKey(filtered[0].category, filtered[0].text)
    if (autoOpened.current === only) return
    autoOpened.current = only
    setReadLimit(READ_PAGE)
    setReadingKey(only)
  }, [search, filtered])

  function formatMonth(m: string) {
    const [y, mo] = m.split('-')
    return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  }

  const filteredOverlaps = useMemo(() => overlaps.filter(o => {
    if (confirmedMap.has(overlapConfirmKey(o.postNum, o.text))) return false
    if (search && !normalizeItemKey(o.text).includes(normalizeItemKey(search))) return false
    return true
  }), [overlaps, confirmedMap, search])

  const totalScanned = useMemo(() => new Set(items.flatMap(i => i.postNums)).size, [items])

  // ── Search-filtered timeline ────────────────────────────────────────────────
  // While a search is active the chart stops showing the category total per month and
  // shows WHERE THE MATCHES FALL instead, colored green→red by density. postNumsByMonth
  // is already loaded for the month-click behaviour, so inverting it is cheaper than
  // going back to the posts for timestamps.
  const monthOfPost = useMemo(() => {
    const m = new Map<number, string>()
    for (const [month, nums] of Object.entries(postNumsByMonth)) for (const n of nums) m.set(n, month)
    return m
  }, [postNumsByMonth])

  const searchMatchMonths = useMemo(() => {
    if (!search.trim() || activeTab === 'all' || activeTab === 'overlaps') return null
    const nums = new Set<number>()
    for (const it of filtered) for (const n of it.postNums) nums.add(n)
    return monthCounts(nums, n => {
      const m = monthOfPost.get(n)
      return m ? Date.parse(`${m}-02T00:00:00Z`) : undefined
    })
  }, [search, activeTab, filtered, monthOfPost])

  const searchMatchMax = searchMatchMonths ? Math.max(1, ...searchMatchMonths.values()) : 1
  const searchMatchTotal = searchMatchMonths
    ? [...searchMatchMonths.values()].reduce((a, b) => a + b, 0)
    : 0

  // Same months as the timeline, plus a `matches` series the chart swaps to while searching.
  const chartData = useMemo(
    () => timeline.map(e => ({ ...e, matches: searchMatchMonths?.get(e.month) ?? 0 })),
    [timeline, searchMatchMonths],
  )

  // Per-tab stats for subtitle
  // Must apply the SAME filters the list does (minus search, since this header describes
  // the category as a whole) — otherwise it tallies alias rows the list then hides, and
  // the numbers don't add up to the rows on screen.
  const tabStats = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'overlaps') return null
    const aliasSet = getAliasSet()
    const certSet = getCertifiedEntityAliasSet()
    const catItems = items.filter(i =>
      i.category === activeTab
      && !isFoldedAlias(i.text, i.category, aliasSet, certSet)
      && (!monthPostNums || i.postNums.some(n => monthPostNums.has(n))),
    )
    const repeated = catItems.filter(i => i.postNums.length > 1).length
    const once = catItems.filter(i => i.postNums.length === 1).length
    // DISTINCT posts. Summing each item's post list counts (item, post) pairs — a drop
    // holding 12 entities contributed 12 — which produced a "posts" figure larger than the
    // 4,966 posts that exist. The giveaway was the number exceeding the archive itself.
    const postSet = new Set<number>()
    for (const i of catItems) for (const n of i.postNums) postSet.add(n)
    const posts = postSet.size
    const occurrences = catItems.reduce((n, i) => n + i.occurrences, 0)

    // THE HEADLINE IS CERTIFIED, NOT RECOUNTED.
    //
    // Summing the frequency rows gave 4,175 for Claims against a certified 4,188: the index is
    // grouped by phrase, so a phrase Q repeats inside one post collapses to that post once, and
    // the 13 in-post repeats vanished from a user-facing total. The frequency index is for
    // browsing and ranking phrases; it is not a counting system. See SECTION_TOTALS.
    //
    // The certified figure describes the whole section, so it applies only to the unfiltered
    // view — with a month selected or an alias hidden, the honest number is the filtered one,
    // and it is labelled as a filtered subset rather than as the section total.
    const certified = SECTION_TOTALS[activeTab]
    const filtered = Boolean(monthPostNums)
    return {
      repeated, once,
      posts: certified && !filtered ? certified.posts : posts,
      occurrences: certified && !filtered ? certified.occurrences : occurrences,
      unit: certified && !filtered ? certified.unit : 'shown here',
      isCertified: Boolean(certified) && !filtered,
    }
    // aliasTick: recount when an alias is added/removed elsewhere.
  }, [items, activeTab, monthPostNums, aliasTick])

  // Year labels on the month axis — same tick as every other chart.
  const yearStarts = useMemo(() => yearStartsOf(chartData), [chartData])

  return (
    <div className="flex flex-col">

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a] border-b border-q-border px-6 pt-5 pb-4 space-y-3 shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
        <BackButton />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {/* Total items in this section, above the title — the headline number for
                "how big is this category", with repeated/once as the breakdown below. */}
            {tabStats && (
              <p className="flex items-baseline gap-3 leading-none tracking-tight">
                <span className="text-2xl font-black text-amber-300/90">
                  {tabStats.occurrences.toLocaleString()}
                  <span className="text-xs font-medium text-gray-500 ml-1.5">{tabStats.unit}</span>
                </span>
                <span className="text-2xl font-black text-white/90">
                  <span className="text-xs font-medium text-gray-500 mr-1.5">within</span>
                  {tabStats.posts.toLocaleString()}
                  <span className="text-xs font-medium text-gray-500 ml-1.5">posts</span>
                </span>
              </p>
            )}
            {/* Title carries the category colour, so the heading matches the sidebar
                entry, the chart bars and the badges on every row below. */}
            {(activeTab === 'themes' || activeTab === 'impliedConclusions') && (
              <p className="text-[11px] text-gray-500 mt-1 max-w-2xl">
                These are summaries written from the posts, not phrases copied out of them —
                so opening a post from here will not highlight anything. Every other section
                lists text that appears verbatim.
              </p>
            )}
            <h1
              className="text-xl font-bold leading-tight flex items-center gap-2"
              style={{
                color: activeTab === 'all' ? '#f3f4f6'
                  : activeTab === 'overlaps' ? '#eab308'
                  : catColor(activeTab),
              }}
            >
              {activeTab === 'all' ? 'Post Analysis' : activeTab === 'overlaps' ? '⚠ Overlaps' : `Q ${CAT_LABELS[activeTab as AnalysisCategoryFreq['category']]}`}
              {/* Each analysis tab is its own section, so the ⓘ follows the active tab. */}
              <SectionInfo id={activeTab} />
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {activeTab === 'all' && !loading && (
                <><span className="text-violet-400 font-medium">{items.length.toLocaleString()}</span> unique entries across <span className="text-gray-400 font-medium">{totalScanned.toLocaleString()}</span> analyzed posts</>
              )}
              {activeTab === 'overlaps' && (
                <span className="text-yellow-400 font-medium">{overlaps.length} conflicting phrases</span>
              )}
              {tabStats && (
                <>
                  <span className={`font-medium ${CAT_BADGE[activeTab as AnalysisCategoryFreq['category']]?.split(' ').find(c => c.startsWith('text-')) ?? 'text-gray-400'}`}>{tabStats.repeated}</span> repeated ·{' '}
                  <span className="text-gray-400 font-medium">{tabStats.once}</span> found once
                  {' '}· <span className="text-gray-400 font-medium">{(tabStats.repeated + tabStats.once).toLocaleString()}</span> items
                </>
              )}
              {loading && 'Loading analysis data…'}
            </p>
          </div>
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search within category…" />
      </div>

      <div className="p-6 space-y-6">

      {/* Timeline chart — only for specific category tabs */}
      {search.trim() && <TermPresenceBar term={search} activeKey={activeTab} />}

      {timeline.length > 0 && activeTab !== 'all' && activeTab !== 'overlaps' && (() => {
        const cfg = CAT_CHART[activeTab as AnalysisCategoryFreq['category']]
        if (!cfg) return null
        const label = CAT_LABELS[activeTab as AnalysisCategoryFreq['category']]
        return (
          <div className="bg-q-panel border border-q-border rounded-xl p-5">
            <h2 className="text-white font-semibold mb-0.5">
              {searchMatchMonths ? `${label} Timeline — "${search}"` : `${label} vs. Posts per Month`}
            </h2>
            <p className="text-gray-400 text-xs mb-4">
              {searchMatchMonths
                ? `${searchMatchTotal} matching post${searchMatchTotal !== 1 ? 's' : ''} · bars colored green→red by density · click a bar to filter the list below`
                : selectedMonth
                ? `Filtered to ${formatMonth(selectedMonth)} — click bar again to reset`
                : `Grey = total posts · colored = ${label} count · click a bar to filter the list below`}
            </p>
            <ScrollableChart minWidth={920}><ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={chartData}
                margin={{ top: searchMatchMonths ? 22 : 4, right: 8, left: -16, bottom: 0 }}
                onMouseMove={(st: { activeLabel?: string | number }) => {
                  const m = st?.activeLabel
                  setHoverMonth(typeof m === 'string' ? m : null)
                }}
                onMouseLeave={() => setHoverMonth(null)}
                onClick={d => selectMonth(
                  (d as { activeLabel?: string; activePayload?: { payload?: { month?: string } }[] } | undefined)
                    ?.activePayload?.[0]?.payload?.month
                  ?? (d as { activeLabel?: string } | undefined)?.activeLabel,
                )}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="month" tick={(props: any) => <MonthYearTick {...props} yearStarts={yearStarts} />} interval={0} height={52} />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 10 }} />
                {/* Matches get their OWN axis. Sharing the left one made a 2-post result
                    half a percent of an axis scaled to ~400 total posts — invisible. */}
                {searchMatchMonths && (
                  <YAxis yAxisId="matches" orientation="right" hide domain={[0, matchAxisMax(searchMatchMax)]} />
                )}
                <Tooltip position={{ y: 0 }} content={({ active, payload, label: lbl }) => {
                  if (!active || !payload || !lbl) return null
                  return (
                    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      <p style={{ color: '#e5e7eb', marginBottom: 6, fontWeight: 600 }}>{formatMonth(String(lbl))}</p>
                      {payload.map((item, i) => {
                        const col = item.name === 'Q Posts' ? '#9ca3af' : cfg.color
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
                    {[{ name: 'Q Posts', color: '#9ca3af' }, searchMatchMonths ? { name: `"${search}" matches`, color: gradientColor(searchMatchMax, searchMatchMax) } : { name: label, color: cfg.color }].map(item => (
                      <span key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 4, color: item.color }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: item.color }} />
                        {item.name}
                      </span>
                    ))}
                  </div>
                )} />
                <Bar yAxisId="left" dataKey="posts" name="Q Posts" radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}
                  onClick={(d: { month?: string; payload?: { month?: string } }) => selectMonth(d?.month ?? d?.payload?.month)}>
                  {timeline.map(e => (
                    <Cell key={e.month} fill={!selectedMonth || selectedMonth === e.month ? '#9ca3af' : '#374151'} />
                  ))}
                </Bar>
                {searchMatchMonths ? (
                  /* Searching: bar height IS the match count for that month, colored by density. */
                  <Bar yAxisId="matches" dataKey="matches" name={`"${search}" matches`} radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }} minPointSize={3}
                    onClick={(d: { month?: string; payload?: { month?: string } }) => selectMonth(d?.month ?? d?.payload?.month)}>
                    <LabelList dataKey="matches" position="top" content={MatchCountLabel} />
                    {chartData.map(e => (
                      <Cell
                        key={e.month}
                        fill={
                          selectedMonth && selectedMonth !== e.month
                            ? NO_MATCH_GREY
                            : e.matches > 0
                              ? gradientColor(e.matches, searchMatchMax)
                              : NO_MATCH_GREY
                        }
                      />
                    ))}
                  </Bar>
                ) : (
                  <Bar yAxisId="left" dataKey={cfg.dataKey} name={label} radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}
                    onClick={(d: { month?: string; payload?: { month?: string } }) => selectMonth(d?.month ?? d?.payload?.month)}>
                    {timeline.map(e => (
                      <Cell key={e.month} fill={!selectedMonth || selectedMonth === e.month ? cfg.color : cfg.dimColor} />
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
        )
      })()}

      {/* Month breakdown — items recorded that month, ranked by repeat count */}
      {/* Selected-month banner — unambiguous feedback that the bar click landed, and how
          many chips below are lit. Without it, "did my click do anything?" is unanswerable. */}
      {selectedMonth && (
        <div ref={listRef} className="scroll-mt-24 flex items-center gap-3 flex-wrap bg-white/5 border border-white/20 rounded-xl px-4 py-2.5">
          <span className="text-sm text-white font-semibold">{formatMonth(selectedMonth)}</span>
          <span className="text-xs text-gray-400">
            {filtered.length.toLocaleString()} item{filtered.length !== 1 ? 's' : ''} ·{' '}
            {(monthPostNums?.size ?? 0).toLocaleString()} posts that month — their chips are
            flashing white below
          </span>
          <button
            onClick={() => setSelectedMonth(null)}
            className="ml-auto text-xs text-gray-300 hover:text-white bg-gray-800 border border-gray-600 px-3 py-1 rounded-lg transition-colors"
          >
            ✕ Clear month
          </button>
        </div>
      )}

      {selectedMonth && monthPostNums && !search.trim() && activeTab !== 'all' && activeTab !== 'overlaps' && (() => {
        const cat = activeTab as AnalysisCategoryFreq['category']
        const ACCENT_BY_CAT: Record<AnalysisCategoryFreq['category'], 'amber' | 'violet' | 'cyan' | 'indigo' | 'orange' | 'fuchsia' | 'slate'> = {
          claims: 'amber', predictions: 'violet', namedEntities: 'cyan', themes: 'indigo', impliedConclusions: 'orange', verificationHooks: 'fuchsia', emphasis: 'slate',
        }
        return (
          <div ref={breakdownRef} className="scroll-mt-4">
            <TimeframeBreakdown
              monthLabel={formatMonth(selectedMonth)}
              label={CAT_LABELS[cat].toLowerCase()}
              accent={ACCENT_BY_CAT[cat]}
              monthPostNums={monthPostNums}
              items={items.filter(i => i.category === cat)}
              onClose={() => setSelectedMonth(null)}
              postLinkParams={item => `highlight=${encodeURIComponent(item.text)}&cat=${cat}`}
            />
          </div>
        )
      })()}


      {/* Results count */}
      {!loading && activeTab !== 'overlaps' && (
        <p ref={selectedMonth ? undefined : listRef} className="text-xs text-gray-500 scroll-mt-24">
          Showing {filtered.length.toLocaleString()} {activeTab === 'all' ? 'entries' : CAT_LABELS[activeTab as AnalysisCategoryFreq['category']]?.toLowerCase() ?? 'entries'}
          {search ? ` matching "${search}"` : ''}
          {' '}— repeated items by frequency, singles by post # · hover to confirm category
        </p>
      )}
      {activeTab === 'overlaps' && !overlapsLoading && (
        <p className="text-xs text-gray-500">
          {filteredOverlaps.length.toLocaleString()} conflicting phrase{filteredOverlaps.length !== 1 ? 's' : ''} found
          {search ? ` matching "${search}"` : ''} — hover to assign a definitive category
        </p>
      )}

      {/* Items list */}
      {loading ? (
        <div className="text-gray-500 text-sm animate-pulse py-8 text-center">Loading analysis data…</div>
      ) : filtered.length === 0 && activeTab !== 'overlaps' ? (
        <div className="text-gray-500 text-sm py-8 text-center">
          {items.length === 0
            ? 'No analysis data yet — run "Analyze All Posts" from the Dashboard first.'
            : 'No entries match your search.'}
        </div>
      ) : /* With a month selected the panel above IS the list for that month, ranked by how
             often each appeared in it. Showing the archive-wide list underneath as well gave
             two lists for one click, with different rankings and different counts. */
        selectedMonth && !search.trim() ? (
        <p className="text-xs text-gray-500">
          Showing <span className="text-gray-300 font-medium">{formatMonth(selectedMonth)}</span> only.{' '}
          <button onClick={() => setSelectedMonth(null)} className="text-blue-400 hover:text-blue-300 hover:underline">
            Clear the month
          </button>{' '}
          to browse the whole archive.
        </p>
      ) : activeTab !== 'overlaps' ? (
        <div className="space-y-3">
          {filtered.slice(0, visibleCount).map((item, idx) => {
            const key = itemConfirmKey(item.category, item.text)
            const confirmed = confirmedMap.has(key)
            const isHovered = hoveredKey === key
            const isSaving = savingKey === key
            const isDeleting = deletingKey === key
            // Fold in alias spellings + the posts where they appear.
            const aliases = getAliasesFor(item.text)
            // Each distinct name → its own chip color (canonical grey, aliases from the palette).
            const termColor = new Map<string, string>([[item.text.toLowerCase(), CANON_CHIP]])
            aliases.forEach((al, j) => termColor.set(al.toLowerCase(), ALIAS_CHIP_PALETTE[j % ALIAS_CHIP_PALETTE.length]))
            const seenNums = new Set<number>()
            const chips: { num: number; term: string }[] = []
            // Aliases claim their posts FIRST so a distinctive alias (e.g. "4,10,20", 2 posts) keeps
            // its own color even when that post ALSO carries the canonical name — otherwise the
            // common canonical (POTUS, grey) would swallow it and the alias would look emptier than
            // it is. Canonical then fills the remaining (canonical-only) posts in grey.
            for (const al of aliases) for (const n of (aliasPostMap[al.toLowerCase()] ?? [])) { if (!seenNums.has(n)) { seenNums.add(n); chips.push({ num: n, term: al }) } }
            for (const n of item.postNums) { if (!seenNums.has(n)) { seenNums.add(n); chips.push({ num: n, term: item.text }) } }
            // Chronological. Density is already visible on each chip as "×N", so ordering
            // by it as well made the post numbers impossible to scan or cross-reference.
            chips.sort((a, b) => a.num - b.num)
            // With a month selected, show only THAT month's posts under each term.
            //
            // Selecting a month already filtered which terms appear, but every term still
            // listed all of its posts — so for a term used across five years, the month you
            // clicked could sit hundreds of chips down and past the 40-chip cap, leaving a
            // row that appeared to contain none of the month you asked for.
            const monthChips = monthPostNums ? chips.filter(c => monthPostNums.has(c.num)) : chips
            return (
              <div
                key={`${item.category}-${idx}`}
                className={`bg-q-panel border rounded-xl p-4 transition-all cursor-default ${
                  confirmed ? 'border-green-700/50' : isHovered ? 'border-gray-500' : 'border-q-border'
                }`}
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey(null)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  {/* Rank + category + count column (row on mobile, column on desktop) */}
                  <div className="shrink-0 flex flex-row sm:flex-col items-center gap-1.5 sm:mt-0.5">
                    {/* Position in the current list — #1 is the most-referenced item.
                        Follows the active sort and search, so it always reads top-down. */}
                    <span
                      className="text-[11px] font-bold text-gray-600 leading-none tabular-nums"
                      title="Rank across the whole category — stays the same when you filter"
                    >
                      {(rankByItem.get(`${item.category}::${normalizeItemKey(item.text)}`) ?? idx + 1).toLocaleString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${CAT_BADGE[item.category]}`}>
                      {CAT_LABELS[item.category]}
                    </span>
                    {/* Always shown, including ×1. A row with no badge reads as "listed
                        once" only by inference, and ~1,194 badge-less entity rows in a row
                        made the category look far bigger than the header claimed. */}
                    {/* Mentions sits ABOVE the post count: it is what the list is ranked
                        by, so it should be the number you read first. */}
                    {/* Shown from 2 upward. "1 mention" adds nothing that "x1 posts"
                        below it doesn't already say. */}
                    {item.occurrences > item.postNums.length && (
                      <span
                        className="text-[11px] font-bold text-amber-300/90 leading-none tabular-nums whitespace-nowrap"
                        title={
                          item.occurrences > item.postNums.length
                            ? `${item.occurrences} mentions — the phrase repeats inside some posts`
                            : `${item.occurrences} mentions, one per post`
                        }
                      >
                        {item.occurrences.toLocaleString()} mentions
                      </span>
                    )}
                    {/* From 2 upward only. (This showed ×1 for a while — that was to stop
                        badge-less rows reading as ambiguous, but the rank number now sits
                        above every row, so a row with no count badge unambiguously means
                        one post.) */}
                    {monthChips.length > 1 && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap text-white bg-gray-700 border-gray-600"
                      title={
                        aliases.length > 0
                          ? `${item.postNums.length} for "${item.text}" + alias mentions = ${chips.length} posts`
                          : `${monthChips.length} post${monthChips.length !== 1 ? 's' : ''}`
                      }
                    >
                      ×{monthChips.length} posts
                    </span>
                    )}
                    {/* Month span of this item's posts — month granularity only. */}
                    {(() => {
                      const span = monthSpanLabel(monthChips.map(c => c.num), n => monthOfPost.get(n))
                      return span ? (
                        <span className="text-[10px] text-gray-600 leading-tight text-center whitespace-nowrap">
                          {span}
                        </span>
                      ) : null
                    })()}
                    {confirmed && (
                      <span className="text-xs font-bold text-green-400 bg-green-900/40 border border-green-700/50 px-2 py-0.5 rounded-full">
                        ✓ confirmed
                      </span>
                    )}
                  </div>

                  {/* Text + post chips + confirm action */}
                  <div className="flex-1 min-w-0">
                    {/* inline-block so the highlight hugs the phrase instead of painting a
                        full-width bar across the row — the colour marks the term, not the row. */}
                    {/* The item's own name is the way IN to it: it links to this section filtered
                        to just this item, where the row arrives with its drops already open, oldest
                        first. A theme label never appears inside a drop, so a text search for it
                        returns nothing — this is the only link that can answer "what is this theme
                        actually about". */}
                    <p className="mb-1">
                      {/* The phrase IS the control. Clicking it opens every drop it appears in,
                          right here, oldest first — the same thing the "read N drops" button does.
                          It used to navigate to this section filtered to this row, which took you
                          to another screen to do what the row can do in place. */}
                      <button
                        onClick={() => {
                          setReadLimit(READ_PAGE)
                          setReadingKey(prev => (prev === key ? null : key))
                        }}
                        title={readingKey === key
                          ? 'Close the drops'
                          : `Read all ${monthChips.length} drop${monthChips.length !== 1 ? 's' : ''} containing "${item.text}", oldest first`}
                        className={`inline-block text-left text-sm leading-relaxed px-2 py-1 rounded transition-all hover:brightness-125 hover:underline underline-offset-2 cursor-pointer ${CAT_COLORS[item.category]} ${readingKey === key ? 'ring-1 ring-white/40' : ''}`}
                      >
                        {item.text}
                      </button>
                    </p>
                    {aliases.length > 0 && (
                      <p className="text-xs text-gray-400 mb-2 px-2 flex items-center gap-1.5 flex-wrap">
                        <span className="italic">also known as:</span>
                        <span className={`px-1.5 py-0.5 rounded border font-mono ${CANON_CHIP}`}>{displayAlias(item.text)}</span>
                        {aliases.map((al, j) => (
                          <span key={al} className={`px-1.5 py-0.5 rounded border font-mono ${ALIAS_CHIP_PALETTE[j % ALIAS_CHIP_PALETTE.length]}`}>{displayAlias(al)}</span>
                        ))}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(expandedChips.has(key) ? monthChips : monthChips.slice(0, CHIPS)).map(({ num, term }) => {
                        // Clicking a month bar should point AT the posts from that month,
                        // not just shorten the list — ring the ones that belong to it and
                        // fade the rest so the answer is visible inside each row.
                        const inMonth = monthPostNums?.has(num) ?? null
                        const pulsing = hoverPostNums?.has(num) ?? false
                        return (
                          <Link
                            key={num}
                            to={`/post/${num}?flash=1&highlight=${encodeURIComponent(term)}&cat=${item.category}`}
                            title={
                              inMonth
                                ? `in ${formatMonth(selectedMonth!)}`
                                : term !== item.text ? `mentions "${term}"` : undefined
                            }
                            className={`text-xs px-2 py-0.5 border rounded font-mono transition-all ${termColor.get(term.toLowerCase()) ?? CANON_CHIP} ${
                              inMonth ? 'ring-2 ring-white/70 font-bold' : ''
                            } ${item.repeats[num] > 1 ? 'border-amber-500/70' : ''} ${
                              pulsing || (inMonth && flashMonth) ? 'animate-chip-pulse font-bold z-10 relative' : ''
                            }`}
                          >
                            #{num}
                            {item.repeats[num] > 1 && (
                              <span className="ml-1 text-amber-300 font-bold">×{item.repeats[num]}</span>
                            )}
                          </Link>
                        )
                      })}
                      {/* Open the drops themselves, in post order, underneath the numbers.
                          The chips say WHICH posts; this says what they contain, without
                          leaving the row you are reading. */}
                      {monthChips.length > 0 && (
                        <button
                          onClick={() => {
                            setReadLimit(READ_PAGE)
                            setReadingKey(prev => (prev === key ? null : key))
                          }}
                          className={`text-xs px-2 py-0.5 rounded border font-mono transition-colors ${
                            readingKey === key
                              ? 'border-cyan-500 bg-cyan-900/50 text-cyan-200'
                              : 'border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400'
                          }`}
                          title={readingKey === key ? 'Close the drops' : `Read all ${monthChips.length} drops here, in post order`}
                        >
                          {readingKey === key ? '− close drops' : `▼ read ${monthChips.length.toLocaleString()} drop${monthChips.length !== 1 ? 's' : ''}`}
                        </button>
                      )}
                      {monthChips.length > CHIPS && (
                        <button
                          onClick={() => setExpandedChips(prev => {
                            const next = new Set(prev)
                            if (next.has(key)) next.delete(key); else next.add(key)
                            return next
                          })}
                          className="text-xs px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-mono"
                        >
                          {expandedChips.has(key)
                            ? '− show fewer'
                            : `+${(monthChips.length - CHIPS).toLocaleString()} more`}
                        </button>
                      )}
                    </div>
                    {readingKey === key && (
                      <div className="mt-2 mb-3 border-t border-q-border pt-3 space-y-3">
                        {readLoading && <p className="text-xs text-gray-500 animate-pulse">opening drops…</p>}
                        {!readLoading && readPosts.length === 0 && (
                          <p className="text-xs text-gray-500">No drops loaded for this row.</p>
                        )}
                        {readPosts.slice(0, readLimit).map(rp => (
                          <div key={rp.id ?? rp.postNum}>
                            {/* searchKeyword carries the row's own term, so the phrase that put
                                the drop in this list is highlighted inside it. */}
                            <PostCard post={rp} questionTexts={readQuestions[rp.id]} searchKeyword={item.text} />
                          </div>
                        ))}
                        {/* Scrolling IS the request for more. The sentinel loads the next batch
                            as it comes into view, so every drop opens as you scan without a
                            click — while still mounting them in batches, because 404 PostCards
                            rendered at once locks the tab. */}
                        {readPosts.length > readLimit && (
                          <ReaderSentinel onEnter={() => setReadLimit(n => n + READ_PAGE)} />
                        )}
                        {readPosts.length > readLimit && (
                          <button
                            onClick={() => setReadLimit(n => n + READ_PAGE)}
                            className="text-xs px-3 py-1 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-mono"
                          >
                            + {Math.min(READ_PAGE, readPosts.length - readLimit)} more
                            <span className="text-gray-500"> ({readLimit.toLocaleString()} of {readPosts.length.toLocaleString()})</span>
                          </button>
                        )}
                      </div>
                    )}
                    {/* Hover confirm + delete actions — EDITING. Not compiled into the
                        public build; these write to Firestore. */}
                    {CAN_EDIT && (isHovered || confirmed || isDeleting) && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {confirmed ? (
                          <>
                            <span className="text-xs text-green-400 font-medium">✓ Confirmed as {CAT_LABELS[item.category]}</span>
                            <button
                              onClick={() => handleUnconfirmItem(item.category, item.text)}
                              disabled={isSaving || isDeleting}
                              className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                            >
                              {isSaving ? '…' : 'undo'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleConfirmItem(item.category, item.text)}
                            disabled={isSaving || isDeleting}
                            className="text-xs bg-green-900/40 hover:bg-green-800/60 text-green-400 hover:text-green-200 border border-green-700/50 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
                          >
                            {isSaving ? 'Saving…' : `✓ Confirm as ${CAT_LABELS[item.category]}`}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.category, item.text, item.postNums)}
                          disabled={isSaving || isDeleting}
                          className="text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 hover:text-red-200 border border-red-700/50 px-2 py-0.5 rounded transition-colors disabled:opacity-40 ml-auto"
                        >
                          {isDeleting ? 'Removing…' : '✕ Delete from category'}
                        </button>
                      </div>
                    )}
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
                showing {visibleCount.toLocaleString()} of {filtered.length.toLocaleString()}
              </span>
              <button
                onClick={() => setVisibleCount(filtered.length)}
                className="text-xs text-gray-400 hover:text-white underline"
              >
                show all
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Overlaps tab */}
      {activeTab === 'overlaps' && (
        overlapsLoading ? (
          <div className="text-gray-500 text-sm animate-pulse py-8 text-center">Scanning for conflicts…</div>
        ) : filteredOverlaps.length === 0 ? (
          <div className="text-gray-500 text-sm py-8 text-center">
            {!overlapsLoaded
              ? 'Loading…'
              : overlaps.length === 0
              ? 'No overlapping phrases detected. Run the Intelligence Scan Suite first.'
              : 'No conflicts match your search.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOverlaps.map((item, idx) => {
              const key = overlapConfirmKey(item.postNum, item.text)
              const resolvedCategory = confirmedMap.get(key)
              const isResolved = !!resolvedCategory
              const isHovered = hoveredKey === key
              const isSaving = savingKey === key
              return (
                <div
                  key={idx}
                  className={`bg-q-panel rounded-xl p-4 transition-all cursor-default ${
                    isResolved
                      ? 'border border-green-700/50'
                      : isHovered
                      ? 'border border-yellow-600/60'
                      : 'border border-yellow-800/40'
                  }`}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                    {/* Icon + count */}
                    <div className="shrink-0 flex flex-row sm:flex-col items-center gap-1.5 sm:mt-0.5">
                      {isResolved
                        ? <span className="text-green-400 text-base">✓</span>
                        : <span className="text-yellow-400 text-base">⚠</span>
                      }
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        isResolved
                          ? 'text-green-500 bg-green-900/40 border border-green-700/50'
                          : 'text-yellow-500 bg-yellow-900/40 border border-yellow-700/50'
                      }`}>
                        ×{item.categories.length}
                      </span>
                    </div>

                    {/* Text + badges + actions */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed mb-2 px-2 py-1.5 rounded ${
                        isResolved
                          ? 'text-green-200 bg-green-950/20 border border-green-800/30'
                          : 'text-white bg-yellow-950/20 border border-yellow-800/30'
                      }`}>
                        {item.text}
                      </p>

                      {/* Category badges */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {item.categories.map(cat => (
                          <span key={cat} className={`text-xs px-2 py-0.5 rounded border font-medium ${OVERLAP_CAT_COLORS[cat]} ${
                            isResolved && resolvedCategory === cat ? 'ring-1 ring-green-500' : ''
                          }`}>
                            {OVERLAP_CAT_LABELS[cat]}
                            {isResolved && resolvedCategory === cat && ' ✓'}
                          </span>
                        ))}
                      </div>

                      {/* Hover: assign buttons OR resolved state — EDITING. */}
                      {CAN_EDIT && (isHovered || isResolved) && (
                        <div className="mt-2">
                          {isResolved ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-400 font-medium">
                                ✓ Resolved as {OVERLAP_CAT_LABELS[resolvedCategory as OverlapCat] ?? resolvedCategory}
                              </span>
                              <button
                                onClick={() => handleUnconfirmOverlap(item.postNum, item.text, resolvedCategory!)}
                                disabled={isSaving}
                                className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                              >
                                {isSaving ? '…' : 'undo'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-gray-500 mr-1">Assign to:</span>
                              {item.categories.map(cat => (
                                <button
                                  key={cat}
                                  onClick={() => handleConfirmOverlap(item.postNum, item.text, cat, item.categories)}
                                  disabled={isSaving}
                                  className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors disabled:opacity-40 ${OVERLAP_BTN_COLORS[cat]}`}
                                >
                                  {isSaving ? '…' : OVERLAP_CAT_LABELS[cat]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Post chip */}
                      <div className="mt-2">
                        <Link
                          to={`/post/${item.postNum}?flash=1&highlight=${encodeURIComponent(item.text)}&rk=overlap`}
                          className="inline-block text-xs px-2 py-0.5 bg-gray-800 hover:bg-blue-900/50 text-gray-400 hover:text-blue-300 border border-gray-700 hover:border-blue-600 rounded font-mono transition-colors"
                        >
                          #{item.postNum}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
      </div>
    </div>
  )
}
