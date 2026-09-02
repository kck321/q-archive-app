import { useEffect, useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getStats, getTopRatedPosts, getRecentPosts, getQuestionsTimeline, getQuestionsForPosts, getPostNumsByMonth, getPostsByNums, funnelRequestQuestionsToCollection, searchAllPosts, migrateLocalEditsToCloud } from '../lib/posts'
import { fetchAndIngestPosts, patchRefMedia, patchMediaFromQanonPub } from '../lib/ingest'
import { bulkScanRefImages, bulkScanStaticEntities, STATIC_ENTITIES, type StaticEntityScanProgress } from '../lib/bulkScan'
import PostCard from '../components/PostCard'
import RenewalReminder from '../components/RenewalReminder'
import { postPreview } from '../lib/references'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts'
import { MonthYearTick, yearStartsOf } from '../lib/chartAxis'
import ScrollableChart from '../components/ScrollableChart'
import { useAdmin } from '../components/AdminContext'
import CoverageScan from '../components/CoverageScan'
import { seriesColor } from '../lib/categoryColors'
import type { QPost } from '../types'

interface Stats {
  totalPosts: number
  totalQuestions: number
  greenCount: number
  yellowCount: number
  redCount: number
}

interface TimelineEntry {
  month: string
  questions: number
  posts: number
  requests: number
  claims: number
  predictions: number
  namedEntities: number
  themes: number
  impliedConclusions: number
  verificationHooks: number
}


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
            {loading ? 'Loading posts…' : `${posts.length} post${posts.length !== 1 ? 's' : ''} — click any post to open it`}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded transition-colors">✕ Close</button>
      </div>
      {loading ? (
        <div className="text-gray-500 text-sm animate-pulse py-6 text-center">Loading posts…</div>
      ) : posts.length === 0 ? (
        <p className="text-gray-500 text-sm">No posts found for this month.</p>
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {posts.map(post => {
            const rCount = post.actionRequests?.length ?? 0
            const ms = post.timestamp > 1e10 ? post.timestamp : post.timestamp * 1000
            const dateStr = new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <Link key={post.id} to={`/post/${post.id}?flash=1`} className="block bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-2 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-400 font-mono text-xs font-bold">#{post.postNum}</span>
                  <span className="text-gray-600 text-xs">{dateStr}</span>
                  {post.hasQuestions && (
                    <span className="text-xs bg-blue-900/50 text-blue-400 border border-blue-800/60 px-1.5 py-0.5 rounded">Q</span>
                  )}
                  {post.hasRequests && (
                    <span className="text-xs bg-green-900/50 text-green-400 border border-green-800/60 px-1.5 py-0.5 rounded">
                      R{rCount > 0 ? ` ×${rCount}` : ''}
                    </span>
                  )}
                  {post.analysisScanned && (
                    <span className="text-xs bg-violet-900/50 text-violet-400 border border-violet-800/60 px-1.5 py-0.5 rounded">A</span>
                  )}
                </div>
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 font-mono">
                  {(() => { const t = postPreview(post); return t.slice(0, 160) + (t.length > 160 ? '…' : '') })()}
                </p>
              </Link>
            )
          })}
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
    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 12, minWidth: 180 }}>
      <p style={{ color: '#e5e7eb', marginBottom: 6, fontWeight: 600 }}>{monthLabel}</p>
      {payload.filter(item => item.value > 0).map((item, i) => {
        const col = seriesColor(item.name)
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


export default function Dashboard() {
  const { unlocked: adminUnlocked, requireAdmin } = useAdmin()
  const [migrating, setMigrating] = useState(false)
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null)
  async function handleMigrate() {
    setMigrating(true); setMigrateMsg('Pushing your local edits to the cloud…')
    try {
      const { postsPushed, questionsPushed } = await migrateLocalEditsToCloud(
        (done, total) => setMigrateMsg(`Scanning posts… ${done.toLocaleString()}/${total.toLocaleString()}`)
      )
      setMigrateMsg(`✓ Synced ${postsPushed} edited post${postsPushed === 1 ? '' : 's'} and ${questionsPushed} question change${questionsPushed === 1 ? '' : 's'} to the cloud. Refresh your other devices to see them.`)
    } catch (e) {
      setMigrateMsg('Sync failed: ' + ((e as Error)?.message ?? 'unknown error'))
    } finally {
      setMigrating(false)
    }
  }
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<QPost[]>([])
  const [topRated, setTopRated] = useState<QPost[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  // Year labels on the month axis — same tick as every other chart.
  const yearStarts = useMemo(() => yearStartsOf(timeline), [timeline])
  const [postQuestions, setPostQuestions] = useState<Record<string, string[]>>({})
  const [postNumsByMonth, setPostNumsByMonth] = useState<Record<string, number[]>>({})
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [chartSearch, setChartSearch] = useState('')
  const [chartSearching, setChartSearching] = useState(false)
  const [chartMatchMonths, setChartMatchMonths] = useState<Map<string, number> | null>(null)
  const [chartTab, setChartTab] = useState<string>('all')

  const CHART_TABS: { key: string; label: string; dataKey: string; color: string; dimColor: string }[] = [
    { key: 'questions',          label: 'Q Questions',   dataKey: 'questions',          color: '#3b82f6', dimColor: '#1e3a5f' },
    { key: 'requests',           label: 'Q Directives',    dataKey: 'requests',           color: '#22c55e', dimColor: '#14532d' },
    { key: 'claims',             label: 'Q Claims',      dataKey: 'claims',             color: '#f59e0b', dimColor: '#78350f' },
    { key: 'predictions',        label: 'Q Predictions', dataKey: 'predictions',        color: '#8b5cf6', dimColor: '#3b0764' },
    { key: 'namedEntities',      label: 'Q Entities',    dataKey: 'namedEntities',      color: '#0891b2', dimColor: '#164e63' },
    { key: 'themes',             label: 'Q Themes',      dataKey: 'themes',             color: '#6366f1', dimColor: '#312e81' },
  ]

  // Ingest state
  const [ingesting, setIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState({ done: 0, total: 0 })
  const [ingestDone, setIngestDone] = useState(false)
  const [ingestError, setIngestError] = useState('')

  // Funnel request questions state
  const [funnelRunning, setFunnelRunning] = useState(false)
  const [funnelMsg, setFunnelMsg] = useState('')
  const [funnelResult, setFunnelResult] = useState<{ found: number; added: number } | null>(null)
  const [funnelError, setFunnelError] = useState('')

  // Referenced image scan state
  const [refScanning, setRefScanning] = useState(false)
  const [refProgress, setRefProgress] = useState<{ done: number; total: number; postNum: number } | null>(null)
  const [refDone, setRefDone] = useState(false)
  const [refError, setRefError] = useState('')

  // Static entity scan state
  const [seScanning, setSeScanning] = useState(false)
  const [seProgress, setSeProgress] = useState<StaticEntityScanProgress | null>(null)
  const [seDone, setSeDone] = useState(false)
  const [seError, setSeError] = useState('')
  const seAbortRef = useRef<AbortController | null>(null)

  // Patch refMedia state
  const [patchRunning, setPatchRunning] = useState(false)
  const [patchProgress, setPatchProgress] = useState<{ done: number; total: number } | null>(null)
  const [patchDone, setPatchDone] = useState(false)
  const [patchError, setPatchError] = useState('')

  async function handlePatchRefMedia() {
    setPatchRunning(true); setPatchDone(false); setPatchError('')
    try {
      await patchRefMedia((done, total) => setPatchProgress({ done, total }))
      setPatchDone(true)
    } catch (e) { setPatchError(String(e)) }
    finally { setPatchRunning(false) }
  }

  // qanon.pub media patch state
  const [qpubRunning, setQpubRunning] = useState(false)
  const [qpubProgress, setQpubProgress] = useState<{ done: number; total: number; added: number } | null>(null)
  const [qpubDone, setQpubDone] = useState<{ patched: number; mediaAdded: number } | null>(null)
  const [qpubError, setQpubError] = useState('')

  async function handlePatchQanonPub() {
    setQpubRunning(true); setQpubDone(null); setQpubError('')
    try {
      const result = await patchMediaFromQanonPub((done, total, added) => setQpubProgress({ done, total, added }))
      setQpubDone(result)
    } catch (e) { setQpubError(String(e)) }
    finally { setQpubRunning(false) }
  }

  // qanon.pub missed questions scan state
  const [qpubQRunning, setQpubQRunning] = useState(false)
  const [qpubQProgress, setQpubQProgress] = useState<{ checked: number; total: number; found: number } | null>(null)
  const [qpubQDone, setQpubQDone] = useState<{ saved: number } | null>(null)
  const [qpubQError, setQpubQError] = useState('')

  async function handleScanMissedQuestions() {
    setQpubQRunning(true); setQpubQDone(null); setQpubQError('')
    setQpubQProgress({ checked: 0, total: 0, found: 0 })
    try {
      const [rawRes, existingSnap] = await Promise.all([
        fetch('/qanonpub-proxy/data/json/posts.json'),
        (await import('firebase/firestore')).getDocs(
          (await import('firebase/firestore')).collection(
            (await import('../firebase')).db, 'questions'
          )
        ),
      ])
      if (!rawRes.ok) throw new Error(`qanon.pub fetch failed: ${rawRes.status}`)
      const raw: { id: string | number; text?: string; timestamp?: number; number?: number }[] = await rawRes.json()
      raw.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

      // Build set of existing question keys: postNum::textPrefix
      const { collection: col2, writeBatch: wb, doc: d2 } = await import('firebase/firestore')
      const { db: firedb } = await import('../firebase')
      const existingKeys = new Set(
        existingSnap.docs.map(doc => {
          const data = doc.data() as { postNum: number; text: string }
          return `${data.postNum}::${data.text.toLowerCase().trim().slice(0, 60)}`
        })
      )

      // Scan posts for missed questions
      const toSave: { postId: string; postNum: number; text: string }[] = []
      raw.forEach((r, i) => {
        const postNum = (r as { number?: number }).number ?? i + 1
        const postId = String(postNum)
        const text = r.text ?? ''
        const sentences = text
          .split(/[\n\r]+/)
          .flatMap((line: string) => line.split(/(?<=[.!?])\s+/))
          .map((s: string) => s.replace(/\s+/g, ' ').trim())
          .filter((s: string) => s.length >= 8 && s.trimEnd().endsWith('?'))
        for (const sentence of sentences) {
          const key = `${postNum}::${sentence.toLowerCase().trim().slice(0, 60)}`
          if (!existingKeys.has(key)) {
            existingKeys.add(key) // prevent duplicates within this run
            toSave.push({ postId, postNum, text: sentence })
          }
        }
      })

      setQpubQProgress({ checked: raw.length, total: raw.length, found: toSave.length })

      // Save in batches of 400
      let saved = 0
      for (let i = 0; i < toSave.length; i += 400) {
        const chunk = toSave.slice(i, i + 400)
        const batch = wb(firedb)
        for (const { postId, postNum, text } of chunk) {
          const ref = d2(col2(firedb, 'questions'))
          batch.set(ref, { postId, postNum, text, status: 'unprocessed', infographId: null, createdAt: Date.now() })
        }
        await batch.commit()
        saved += chunk.length
        setQpubQProgress({ checked: raw.length, total: raw.length, found: toSave.length })
      }
      setQpubQDone({ saved })
    } catch (e) { setQpubQError(String(e)) }
    finally { setQpubQRunning(false) }
  }

  // qanon.pub bracket scan state
  const [bracketRunning, setBracketRunning] = useState(false)
  const [bracketProgress, setBracketProgress] = useState<{ checked: number; total: number } | null>(null)
  const [bracketDone, setBracketDone] = useState<{ newCodes: number; totalCodes: number } | null>(null)
  const [bracketError, setBracketError] = useState('')

  async function handleScanBrackets() {
    setBracketRunning(true); setBracketDone(null); setBracketError('')
    setBracketProgress({ checked: 0, total: 0 })
    try {
      const rawRes = await fetch('/qanonpub-proxy/data/json/posts.json')
      if (!rawRes.ok) throw new Error(`qanon.pub fetch failed: ${rawRes.status}`)
      const raw: { id: string | number; text?: string; timestamp?: number; number?: number }[] = await rawRes.json()
      setBracketProgress({ checked: 0, total: raw.length })

      // Extract bracket codes from qanon.pub posts
      const BRACKET_RX = /\[\[?([A-Z0-9][A-Z0-9 _\-]{0,29})\]?\]/g
      const qpubCodes = new Set<string>()
      for (const r of raw) {
        const text = r.text ?? ''
        let m: RegExpExecArray | null
        const rx = new RegExp(BRACKET_RX.source, 'g')
        while ((m = rx.exec(text)) !== null) {
          qpubCodes.add(m[0])
        }
      }
      setBracketProgress({ checked: raw.length, total: raw.length })

      // Get existing bracket codes from Firestore posts
      const { getDocs, collection, orderBy, query } = await import('firebase/firestore')
      const { db: firedb } = await import('../firebase')
      const snap = await getDocs(query(collection(firedb, 'posts'), orderBy('postNum')))
      const existingCodes = new Set<string>()
      const BRKT = /\[\[?([A-Z0-9][A-Z0-9 _\-]{0,29})\]?\]/g
      for (const doc of snap.docs) {
        const post = doc.data() as { text?: string }
        const text = post.text ?? ''
        let m2: RegExpExecArray | null
        const rx2 = new RegExp(BRKT.source, 'g')
        while ((m2 = rx2.exec(text)) !== null) {
          existingCodes.add(m2[0])
        }
      }

      const newCodes = [...qpubCodes].filter(c => !existingCodes.has(c))
      setBracketDone({ newCodes: newCodes.length, totalCodes: qpubCodes.size })
    } catch (e) { setBracketError(String(e)) }
    finally { setBracketRunning(false) }
  }

  // Raw posts.json debug inspector
  const [debugResult, setDebugResult] = useState('')
  const [debugLoading, setDebugLoading] = useState(false)

  async function handleInspectRawPosts() {
    setDebugLoading(true)
    setDebugResult('')
    try {
      const res = await fetch('/qalerts-proxy/data/json/posts.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const all: unknown[] = await res.json()
      // Find posts near #188 and #191 by index (sorted oldest-first = index+1 ≈ postNum)
      // Also check for any post that references >>150415097 or similar
      const sorted = [...all].sort((a: unknown, b: unknown) => {
        const at = (a as { timestamp?: number }).timestamp ?? 0
        const bt = (b as { timestamp?: number }).timestamp ?? 0
        return at - bt
      })
      const targets = [sorted[187], sorted[190]].filter(Boolean)
      setDebugResult(JSON.stringify(targets, null, 2))
    } catch (e) {
      setDebugResult(`Error: ${String(e)}`)
    } finally {
      setDebugLoading(false)
    }
  }
  const refAbortRef = useRef<AbortController | null>(null)

  async function handleRefImageScan() {
    refAbortRef.current = new AbortController()
    setRefScanning(true); setRefDone(false); setRefError('')
    try {
      await bulkScanRefImages(
        (done, total, postNum) => setRefProgress({ done, total, postNum }),
        refAbortRef.current.signal
      )
      setRefDone(true)
    } catch (e) { setRefError(String(e)) }
    finally { setRefScanning(false) }
  }

  // Month posts panel state
  const [monthPosts, setMonthPosts] = useState<QPost[]>([])
  const [monthPostsLoading, setMonthPostsLoading] = useState(false)

  useEffect(() => {
    if (!selectedMonth) { setMonthPosts([]); return }
    const nums = postNumsByMonth[selectedMonth] ?? []
    if (nums.length === 0) { setMonthPosts([]); return }
    setMonthPostsLoading(true)
    getPostsByNums(nums).then(setMonthPosts).finally(() => setMonthPostsLoading(false))
  }, [selectedMonth, postNumsByMonth])

  useEffect(() => {
    getStats().then(setStats)
    getQuestionsTimeline().then(setTimeline)
    getPostNumsByMonth().then(setPostNumsByMonth)
    Promise.all([getRecentPosts(6), getTopRatedPosts(5)]).then(([r, tr]) => {
      setRecent(r)
      setTopRated(tr)
      const ids = [...new Set([...r.map(p => p.id), ...tr.map(p => p.id)])]
      getQuestionsForPosts(ids).then(setPostQuestions)
    })
  }, [ingestDone, funnelResult])

  async function handleIngest() {
    setIngesting(true)
    setIngestError('')
    try {
      await fetchAndIngestPosts((done, total) => setIngestProgress({ done, total }))
      setIngestDone(true)
    } catch (e) {
      setIngestError(String(e))
    } finally {
      setIngesting(false)
    }
  }

  async function handleQuestionFunnel() {
    setFunnelRunning(true)
    setFunnelError('')
    setFunnelResult(null)
    try {
      setFunnelResult(await funnelRequestQuestionsToCollection(msg => setFunnelMsg(msg)))
    } catch (e) {
      setFunnelError(String(e))
    } finally {
      setFunnelRunning(false)
    }
  }

  async function handleStaticEntityScan() {
    setSeScanning(true); setSeDone(false); setSeError('')
    seAbortRef.current = new AbortController()
    try {
      await bulkScanStaticEntities(p => setSeProgress(p), seAbortRef.current.signal)
      setSeDone(true)
    } catch (e) {
      setSeError(String(e))
    } finally {
      setSeScanning(false)
    }
  }

  function handleStopStaticEntityScan() {
    seAbortRef.current?.abort()
  }

  async function handleChartSearch() {
    const term = chartSearch.trim()
    if (!term) { setChartMatchMonths(null); return }
    setChartSearching(true)
    try {
      const results = await searchAllPosts(term)
      const map = new Map<string, number>()
      for (const p of results) {
        const ms = p.timestamp > 1e10 ? p.timestamp : p.timestamp * 1000
        const d = new Date(ms)
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        map.set(month, (map.get(month) ?? 0) + 1)
      }
      setChartMatchMonths(map)
      setSelectedMonth(null)
    } finally {
      setChartSearching(false)
    }
  }

  function handleBarClick(data: { month: string } | null | undefined) {
    if (!data?.month) return
    setSelectedMonth(prev => prev === data.month ? null : data.month)
  }

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

  const answeredPct = stats
    ? Math.round((stats.greenCount / Math.max(stats.totalQuestions, 1)) * 100)
    : 0
  const chartMatchMax = chartMatchMonths ? Math.max(1, ...chartMatchMonths.values()) : 1

  if (!adminUnlocked) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="bg-q-panel border border-violet-800/40 rounded-xl p-8 max-w-md text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold text-white">Dashboard is locked</h1>
          <p className="text-gray-400 text-sm">
            The Dashboard holds the admin tools (ingest, image and entity scans, editorial exports). Enter the admin PIN to access it.
          </p>
          <button
            onClick={() => requireAdmin('access the Dashboard', () => {})}
            className="text-sm bg-violet-700 hover:bg-violet-600 text-white font-medium px-5 py-2 rounded-lg transition-colors"
          >
            🔓 Enter admin PIN
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Q Post Archive — Intelligence Analysis</p>
      </div>

      {/* Things that expire and would take the site down with them. Admin build only. */}
      <RenewalReminder />

      {/* Uncategorized content scan */}
      <CoverageScan />

      {/* Cloud sync migration */}
      <div className="bg-q-panel border border-cyan-800/40 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[12rem]">
          <h2 className="text-white font-semibold text-sm">☁ Push this device's edits to the cloud</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            One-time: uploads classifications/questions you made on THIS device (before sync existed) so your other devices pick them up. Safe to run more than once.
          </p>
          {migrateMsg && <p className="text-xs text-cyan-300 mt-1">{migrateMsg}</p>}
        </div>
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="text-sm bg-cyan-800 hover:bg-cyan-700 text-cyan-100 font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {migrating ? 'Syncing…' : '☁ Sync my edits'}
        </button>
      </div>

      {/* Ingest Banner */}
      {!ingesting && (
        <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-gray-300 font-semibold">
              {stats?.totalPosts === 0 ? 'No posts ingested yet' : `${stats?.totalPosts.toLocaleString()} posts in archive`}
            </p>
            <p className="text-gray-400/70 text-sm mt-1">
              {stats?.totalPosts === 0
                ? 'Fetch all 4,966 Q posts from qalerts.app.'
                : 'Re-run to fill in any missing posts (safe to run again — no duplicates).'}
            </p>
          </div>
          <button onClick={handleIngest}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold px-5 py-2 rounded-lg transition-colors text-sm">
            Ingest All Posts
          </button>
        </div>
      )}

      {/* Ingest progress */}
      {ingesting && (
        <div className="bg-q-panel border border-q-border rounded-xl p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">Ingesting posts from qalerts.app…</span>
            <span className="text-q-accent">{ingestProgress.done} / {ingestProgress.total}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-q-accent rounded-full transition-all"
              style={{ width: `${ingestProgress.total ? (ingestProgress.done / ingestProgress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {ingestError && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">Error: {ingestError}</div>
      )}

      {/* Question Funnel — pure text scan, no external service */}
      <div className="bg-q-panel border border-blue-800/50 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">❓ Question Funnel</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Scans every stored directive for a sentence containing “?” and moves it into the
              Q Questions list — catching questions the directive pass picked up. Pure local text
              scan over data already in the archive; runs instantly and calls no outside service.
            </p>
            {funnelRunning && funnelMsg && <p className="text-xs text-gray-400 mt-2 animate-pulse">{funnelMsg}</p>}
            {funnelResult && (
              <p className="text-xs text-blue-400 mt-2 font-semibold">
                ✓ Done — {funnelResult.found} directives with “?” found · <span className="text-white">{funnelResult.added} new questions added</span>
              </p>
            )}
            {funnelError && <p className="text-xs text-red-400 mt-1">{funnelError}</p>}
          </div>
          <div className="shrink-0">
            <button onClick={handleQuestionFunnel} disabled={funnelRunning}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
              {funnelRunning ? 'Running…' : 'Run Funnel'}
            </button>
          </div>
        </div>
      </div>

      {/* Raw Posts Inspector */}
      <div className="bg-q-panel border border-q-border rounded-xl p-5">
        <p className="text-white font-semibold mb-2">🔎 Raw Posts Inspector (Q #188 &amp; #191)</p>
        <p className="text-gray-400 text-sm mb-3">
          Fetches the raw qalerts.app posts.json and shows the full data for Q posts #188 and #191 —
          so we can see if image URLs are already included in the source data.
        </p>
        <button onClick={handleInspectRawPosts} disabled={debugLoading}
          className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded-lg transition-colors text-sm mb-3">
          {debugLoading ? 'Fetching…' : 'Inspect Raw Posts'}
        </button>
        {debugResult && (
          <pre className="bg-black/50 border border-gray-700 rounded-lg p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
            {debugResult}
          </pre>
        )}
      </div>

      {/* Referenced Post Image Scan */}
      <div className="bg-q-panel border border-q-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-white font-semibold">🖼 Scan Referenced Post Images</p>
            <p className="text-gray-400 text-sm mt-1">
              Some Q posts (like #188, #191) reply to anonymous posts that contain images.
              This scan fetches those images from the 4plebs archive and stores them so they
              appear in Q Post Pics and embedded in each post view. Run once — skips already-scanned posts.
            </p>
            {refProgress && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-400">Post #{refProgress.postNum} · {refProgress.done} / {refProgress.total}</p>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(refProgress.done / Math.max(refProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {refDone && <p className="text-xs text-green-400 mt-1">✓ Scan complete — refresh Q Post Pics to see results.</p>}
            {refError && <p className="text-xs text-red-400 mt-1">{refError}</p>}
          </div>
          <div className="shrink-0">
            {!refScanning ? (
              <button onClick={handleRefImageScan}
                className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
                Scan Images
              </button>
            ) : (
              <button onClick={() => refAbortRef.current?.abort()}
                className="bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">
                Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Patch refMedia from qalerts.app source data */}
      <div className="bg-q-panel border border-q-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-white font-semibold">🖼 Patch Referenced Post Images</p>
            <p className="text-gray-400 text-sm mt-1">
              Fetches the qalerts.app source data and writes the <span className="text-white">refMedia</span> field
              for any post whose referenced reply contained an image (e.g. Q posts #188 and #191).
              Fast — only updates posts that have reference images. Run once after ingestion.
            </p>
            {patchProgress && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-400">{patchProgress.done} / {patchProgress.total} posts patched</p>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(patchProgress.done / Math.max(patchProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {patchDone && <p className="text-xs text-green-400 mt-1">✓ Done — check Q Post Pics for posts #188 and #191.</p>}
            {patchError && <p className="text-xs text-red-400 mt-1">{patchError}</p>}
          </div>
          <div className="shrink-0">
            <button onClick={handlePatchRefMedia} disabled={patchRunning}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
              {patchRunning ? 'Patching…' : 'Patch Images'}
            </button>
          </div>
        </div>
      </div>

      {/* qanon.pub media patch */}
      <div className="bg-q-panel border border-q-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-white font-semibold">🖼 Patch Images from qanon.pub</p>
            <p className="text-gray-400 text-sm mt-1">
              Fetches <span className="text-white">qanon.pub</span> post data and adds any media URLs
              missing from your archive. Compares post-by-post and only writes new entries — safe to run multiple times.
            </p>
            {qpubProgress && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-400">
                  {qpubProgress.done} / {qpubProgress.total} posts checked · {qpubProgress.added} new images found
                </p>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full transition-all"
                    style={{ width: `${(qpubProgress.done / Math.max(qpubProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {qpubDone && (
              <p className="text-xs text-green-400 mt-1">
                ✓ Done — {qpubDone.patched} posts updated, {qpubDone.mediaAdded} new images added.
              </p>
            )}
            {qpubError && <p className="text-xs text-red-400 mt-1">{qpubError}</p>}
          </div>
          <div className="shrink-0">
            <button onClick={handlePatchQanonPub} disabled={qpubRunning}
              className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
              {qpubRunning ? 'Scanning…' : 'Patch from qanon.pub'}
            </button>
          </div>
        </div>
      </div>

      {/* qanon.pub missed questions scan */}
      <div className="bg-q-panel border border-q-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-white font-semibold">❓ Scan qanon.pub for Missed Questions</p>
            <p className="text-gray-400 text-sm mt-1">
              Fetches all posts from <span className="text-white">qanon.pub</span> and finds any
              sentences ending with <span className="text-white">?</span> that aren't already saved
              as questions. Saves new ones as <span className="text-yellow-400">unprocessed</span> — no AI needed, pure regex scan.
            </p>
            {qpubQProgress && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-400">
                  {qpubQProgress.checked} / {qpubQProgress.total} posts scanned
                  {qpubQProgress.found > 0 && <span className="text-blue-400 ml-2">· {qpubQProgress.found} new questions found</span>}
                </p>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(qpubQProgress.checked / Math.max(qpubQProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {qpubQDone && (
              <p className="text-xs text-green-400 mt-1">
                ✓ Done — {qpubQDone.saved} new questions saved to the database.
              </p>
            )}
            {qpubQDone?.saved === 0 && (
              <p className="text-xs text-gray-500 mt-1">No new questions found — archive is up to date.</p>
            )}
            {qpubQError && <p className="text-xs text-red-400 mt-1">{qpubQError}</p>}
          </div>
          <div className="shrink-0">
            <button onClick={handleScanMissedQuestions} disabled={qpubQRunning}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
              {qpubQRunning ? 'Scanning…' : 'Scan Missed Questions'}
            </button>
          </div>
        </div>
      </div>

      {/* Static Entity scan panel */}
      <div className="bg-q-panel border border-cyan-800/50 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">🔵 Scan All Posts for Static Entities</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Scans every post for permanent named-entity terms (no Claude call — pure text match) and adds them to <span className="font-mono text-cyan-400">postAnalysis.namedEntities</span>.
            </p>
            <p className="text-xs text-cyan-500 mt-1">
              Tracking: {STATIC_ENTITIES.map(t => <span key={t} className="font-mono bg-cyan-900/30 border border-cyan-700/40 rounded px-1 py-0.5 mr-1">{t}</span>)}
            </p>
            {seProgress && (
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">
                  {seProgress.scanned} / {seProgress.total} posts scanned
                  {seProgress.found > 0 && <span className="text-cyan-400 ml-2">· {seProgress.found} entity matches added</span>}
                  {seProgress.currentPost > 0 && <span className="text-gray-600 ml-2">· post #{seProgress.currentPost}</span>}
                </p>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(seProgress.scanned / Math.max(seProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {seDone && (
              <p className="text-xs text-cyan-400 mt-2 font-semibold">
                ✓ Done — {seProgress?.scanned ?? 0} posts scanned · <span className="text-white">{seProgress?.found ?? 0} entity matches written to Firestore</span>
              </p>
            )}
            {seError && <p className="text-xs text-red-400 mt-1">{seError}</p>}
          </div>
          <div className="shrink-0 flex flex-col gap-2 items-end">
            {!seScanning ? (
              <button onClick={handleStaticEntityScan}
                className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
                Scan Entities
              </button>
            ) : (
              <button onClick={handleStopStaticEntityScan}
                className="bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">
                Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bracket scan panel */}
      <div className="bg-q-panel border border-lime-800/50 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">🟩 Scan qanon.pub for Bracket Codes [ ]</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Fetches qanon.pub posts and extracts all <span className="font-mono text-lime-400">[CODE]</span> / <span className="font-mono text-lime-400">[[CODE]]</span> patterns, then compares against what's already in your Firestore archive to report how many new bracket codes are found.
            </p>
            {bracketProgress && (
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">
                  {bracketProgress.checked} / {bracketProgress.total} posts scanned
                </p>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-lime-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(bracketProgress.checked / Math.max(bracketProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {bracketDone && (
              <p className="text-xs text-lime-400 mt-2 font-semibold">
                ✓ Done — {bracketDone.totalCodes} unique bracket codes on qanon.pub
                {bracketDone.newCodes > 0
                  ? <span className="text-yellow-300 ml-2">· {bracketDone.newCodes} new codes not in your archive</span>
                  : <span className="text-gray-400 ml-2">· all codes already in your archive</span>
                }
              </p>
            )}
            {bracketError && <p className="text-xs text-red-400 mt-1">{bracketError}</p>}
          </div>
          <div className="shrink-0">
            <button onClick={handleScanBrackets} disabled={bracketRunning}
              className="bg-lime-700 hover:bg-lime-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
              {bracketRunning ? 'Scanning…' : 'Scan Brackets'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Posts" value={stats.totalPosts.toLocaleString()} color="text-gray-400" to="/posts" />
          <StatCard label="Questions Found" value={stats.totalQuestions.toLocaleString()} color="text-blue-400" to="/questions" />
          <StatCard label="Answered" value={stats.greenCount.toString()} color="text-green-400" to="/questions?status=green" />
          <StatCard label="Partial" value={stats.yellowCount.toString()} color="text-yellow-400" to="/questions?status=yellow" />
          <StatCard label="Unanswered" value={stats.redCount.toString()} color="text-red-400" to="/questions?status=red" />
        </div>
      )}

      {/* Analysis Totals Row */}
      {analysisTotals && (
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          <StatCard label="Requests" value={analysisTotals.requests.toLocaleString()} color="text-green-400" to="/requests" />
          <StatCard label="Claims" value={analysisTotals.claims.toLocaleString()} color="text-amber-400" to="/analysis?tab=claims" />
          <StatCard label="Predictions" value={analysisTotals.predictions.toLocaleString()} color="text-violet-400" to="/analysis?tab=predictions" />
          <StatCard label="Named Entities" value={analysisTotals.namedEntities.toLocaleString()} color="text-cyan-400" to="/analysis?tab=namedEntities" />
          <StatCard label="Themes" value={analysisTotals.themes.toLocaleString()} color="text-indigo-400" to="/analysis?tab=themes" />
          <StatCard label="Impl. Conclusions" value={analysisTotals.impliedConclusions.toLocaleString()} color="text-orange-400" to="/analysis?tab=impliedConclusions" />
        </div>
      )}

      {/* Understanding meter */}
      {stats && stats.totalQuestions > 0 && (
        <div className="bg-q-panel border border-q-border rounded-xl p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300 font-medium">Overall Understanding</span>
            <span className="text-white font-bold">{answeredPct}% Answered</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
            <div className="bg-green-500 transition-all" style={{ width: `${(stats.greenCount / stats.totalQuestions) * 100}%` }} />
            <div className="bg-yellow-500 transition-all" style={{ width: `${(stats.yellowCount / stats.totalQuestions) * 100}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${(stats.redCount / stats.totalQuestions) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="text-green-400">● Answered</span>
            <span className="text-yellow-400">● Partial</span>
            <span className="text-red-400">● Unanswered</span>
          </div>
        </div>
      )}

      {/* Timeline Chart */}
      {timeline.length > 0 && (
        <div className="bg-q-panel border border-q-border rounded-xl p-5">
          {/* Tab strip */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setChartTab('all')}
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors border"
              style={chartTab === 'all'
                ? { backgroundColor: '#ffffff22', borderColor: '#9ca3af88', color: '#e5e7eb' }
                : { background: 'transparent', borderColor: '#374151', color: '#9ca3af' }}
            >
              All
            </button>
            {CHART_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setChartTab(t.key)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors border"
                style={chartTab === t.key
                  ? { backgroundColor: t.color + '33', borderColor: t.color + '88', color: t.color }
                  : { background: 'transparent', borderColor: '#374151', color: '#9ca3af' }}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setChartTab('postsOnly')}
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors border"
              style={chartTab === 'postsOnly'
                ? { backgroundColor: '#9ca3af33', borderColor: '#9ca3af88', color: '#d1d5db' }
                : { background: 'transparent', borderColor: '#374151', color: '#9ca3af' }}
            >
              Q Posts
            </button>
          </div>

          {/* Header row */}
          {(() => {
            const activeTab = CHART_TABS.find(t => t.key === chartTab)
            const isAll = chartTab === 'all'
            const isPostsOnly = chartTab === 'postsOnly'
            const chartTitle = isAll ? 'Q Post Timeline — All Categories' : isPostsOnly ? 'Q Posts per Month' : `${activeTab?.label ?? ''} vs. Posts per Month`
            const chartSubtitle = chartMatchMonths
              ? `Gradient = density of "${chartSearch}" · red=high, green=low · ${chartMatchMonths.size} months`
              : selectedMonth
                ? `Showing posts for ${selectedMonth} — click bar again to close`
                : isAll
                  ? 'Click a bar to view all posts in that month · search a keyword to see density'
                  : isPostsOnly
                    ? 'Total Q posts published per month · click a bar to view those posts'
                    : `Grey = total posts · colored = ${activeTab?.label ?? ''} count · click a bar to view posts`
            return (
              <>
                <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
                  <div>
                    <h2 className="text-white font-semibold">{chartTitle}</h2>
                    <p className="text-gray-400 text-xs mt-0.5">{chartSubtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(chartMatchMonths || selectedMonth) && (
                      <button
                        onClick={() => { setChartMatchMonths(null); setChartSearch(''); setSelectedMonth(null) }}
                        className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        ✕ Clear
                      </button>
                    )}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={chartSearch}
                        onChange={e => { setChartSearch(e.target.value); if (!e.target.value.trim()) setChartMatchMonths(null) }}
                        onKeyDown={e => e.key === 'Enter' && handleChartSearch()}
                        placeholder="Search keyword…"
                        className="w-40 bg-gray-800 border border-gray-700 focus:border-green-600 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none transition-colors"
                      />
                      <button
                        onClick={handleChartSearch}
                        disabled={!chartSearch.trim() || chartSearching}
                        className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {chartSearching ? '…' : 'Go'}
                      </button>
                    </div>
                  </div>
                </div>

                <ScrollableChart minWidth={920}><ResponsiveContainer width="100%" height={240}>
                  <BarChart data={timeline} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} onClick={(d) => { const p = (d as { activePayload?: { payload: TimelineEntry }[] }); handleBarClick(p?.activePayload?.[0]?.payload) }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="month" tick={(props: any) => <MonthYearTick {...props} yearStarts={yearStarts} />} interval={0} height={52} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                    <Tooltip position={{ y: 0 }} content={(props: any) => <ChartTooltip {...props} keyword={chartMatchMonths ? chartSearch : null} matchCounts={chartMatchMonths} matchMax={chartMatchMax} />} />
                    <Legend content={() => {
                      const items: Array<{ name: string; color: string }> = [{ name: 'Q Posts', color: '#9ca3af' }]
                      if (isAll) {
                        items.push(
                          { name: 'Questions',         color: '#3b82f6' },
                          { name: 'Requests',          color: '#22c55e' },
                          { name: 'Claims',            color: '#f59e0b' },
                          { name: 'Predictions',       color: '#8b5cf6' },
                          { name: 'Named Entities',    color: '#0891b2' },
                          { name: 'Themes',            color: '#6366f1' },
                        )
                      } else if (!isPostsOnly && activeTab) {
                        items.push({ name: activeTab.label, color: activeTab.color })
                      }
                      return (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', fontSize: 11, paddingTop: 4 }}>
                          {items.map(item => (
                            <span key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 4, color: item.color }}>
                              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: item.color }} />
                              {item.name}
                            </span>
                          ))}
                        </div>
                      )
                    }} />

                    {/* Posts bar — always shown */}
                    <Bar dataKey="posts" name="Q Posts" radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}>
                      {timeline.map(entry => (
                        <Cell key={entry.month} fill={
                          chartMatchMonths
                            ? (chartMatchMonths.has(entry.month) ? gradientColor(chartMatchMonths.get(entry.month)!, chartMatchMax) : '#9ca3af')
                            : (!selectedMonth || selectedMonth === entry.month ? '#9ca3af' : '#374151')
                        } />
                      ))}
                    </Bar>

                    {/* All categories view */}
                    {isAll && (<>
                      <Bar dataKey="questions" name="Questions" radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}>
                        {timeline.map(entry => (
                          <Cell key={entry.month} fill={
                            chartMatchMonths
                              ? (chartMatchMonths.has(entry.month) ? gradientColor(chartMatchMonths.get(entry.month)!, chartMatchMax, true) : '#3b82f6')
                              : (!selectedMonth || selectedMonth === entry.month ? '#3b82f6' : '#1e3a5f')
                          } />
                        ))}
                      </Bar>
                      <Bar dataKey="requests"           name="Directives"           radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}>
                        {timeline.map(e => <Cell key={e.month} fill={!selectedMonth || selectedMonth === e.month ? '#22c55e' : '#14532d'} />)}
                      </Bar>
                      <Bar dataKey="claims"             name="Claims"             stackId="a" fill="#f59e0b" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="predictions"        name="Predictions"        stackId="a" fill="#8b5cf6" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="namedEntities"      name="Named Entities"     stackId="a" fill="#0891b2" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="themes"             name="Themes"             stackId="a" fill="#6366f1" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                    </>)}

                    {/* Single category view */}
                    {!isAll && !isPostsOnly && activeTab && (
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

      {/* Month posts panel */}
      {selectedMonth && (
        <MonthPostsPanel month={selectedMonth} posts={monthPosts} loading={monthPostsLoading} onClose={() => setSelectedMonth(null)} />
      )}

      {/* Recent Posts */}
      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Recent Posts</h2>
            <Link to="/posts" className="text-sm text-q-accent hover:underline">View all →</Link>
          </div>
          <div className="grid gap-3 w-full max-w-3xl">
            {recent.map(p => <PostCard key={p.id} post={p} questionTexts={postQuestions[p.id]} />)}
          </div>
        </div>
      )}

      {/* Top Rated */}
      {topRated.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">⭐ Top Rated Posts</h2>
          </div>
          <div className="grid gap-3 w-full max-w-3xl">
            {topRated.map(p => <PostCard key={p.id} post={p} questionTexts={postQuestions[p.id]} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, to }: { label: string; value: string; color: string; to?: string }) {
  const inner = (
    <>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </>
  )
  if (to) {
    return (
      <Link to={to} className="bg-q-panel border border-q-border rounded-xl p-4 block hover:border-gray-500 hover:bg-gray-800/60 transition-colors">
        {inner}
      </Link>
    )
  }
  return (
    <div className="bg-q-panel border border-q-border rounded-xl p-4">
      {inner}
    </div>
  )
}
