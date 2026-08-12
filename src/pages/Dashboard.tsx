import { useEffect, useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getStats, getTopRatedPosts, getRecentPosts, getQuestionsTimeline, getQuestionsForPosts, getPostNumsByMonth, getPostsByNums, funnelRequestQuestionsToCollection, searchAllPosts, migrateLocalEditsToCloud } from '../lib/posts'
import { fetchAndIngestPosts, patchRefMedia, patchMediaFromQanonPub } from '../lib/ingest'
import { bulkScanAllPosts, resetForRescan, bulkScanAllRequests, bulkScanAllAnalysis, bulkScanRefImages, bulkScanStaticEntities, bulkClassifyQuestions, bulkScanThreadAnswers, resetThreadScan, STATIC_ENTITIES, type ScanProgress, type RequestScanProgress, type AnalysisScanProgress, type StaticEntityScanProgress, type ClassifyProgress, type ThreadScanProgress } from '../lib/bulkScan'
import PostCard from '../components/PostCard'
import RenewalReminder from '../components/RenewalReminder'
import { postPreview } from '../lib/references'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts'
import ScrollableChart from '../components/ScrollableChart'
import { useAdmin } from '../components/AdminContext'
import CoverageScan from '../components/CoverageScan'
import { catColor, seriesColor } from '../lib/categoryColors'
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
  const [postQuestions, setPostQuestions] = useState<Record<string, string[]>>({})
  const [postNumsByMonth, setPostNumsByMonth] = useState<Record<string, number[]>>({})
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [chartSearch, setChartSearch] = useState('')
  const [chartSearching, setChartSearching] = useState(false)
  const [chartMatchMonths, setChartMatchMonths] = useState<Map<string, number> | null>(null)
  const [chartTab, setChartTab] = useState<string>('all')

  const CHART_TABS: { key: string; label: string; dataKey: string; color: string; dimColor: string }[] = [
    { key: 'questions',          label: 'Q Questions',   dataKey: 'questions',          color: '#3b82f6', dimColor: '#1e3a5f' },
    { key: 'requests',           label: 'Q Requests',    dataKey: 'requests',           color: '#22c55e', dimColor: '#14532d' },
    { key: 'claims',             label: 'Q Claims',      dataKey: 'claims',             color: '#f59e0b', dimColor: '#78350f' },
    { key: 'predictions',        label: 'Q Predictions', dataKey: 'predictions',        color: '#8b5cf6', dimColor: '#3b0764' },
    { key: 'namedEntities',      label: 'Q Entities',    dataKey: 'namedEntities',      color: '#06b6d4', dimColor: '#164e63' },
    { key: 'themes',             label: 'Q Themes',      dataKey: 'themes',             color: '#6366f1', dimColor: '#312e81' },
    { key: 'impliedConclusions', label: 'Q Conclusions', dataKey: 'impliedConclusions', color: '#f97316', dimColor: '#7c2d12' },
    { key: 'verificationHooks',  label: 'Checkable Claims',       dataKey: 'verificationHooks',  color: catColor('verificationHooks'), dimColor: '#701a75' },
  ]

  // Ingest state
  const [ingesting, setIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState({ done: 0, total: 0 })
  const [ingestDone, setIngestDone] = useState(false)
  const [ingestError, setIngestError] = useState('')

  // Bulk scan state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [scanDone, setScanDone] = useState(false)
  const [scanError, setScanError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // Reset + re-scan state
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  // Request scan state
  const [reqScanning, setReqScanning] = useState(false)
  const [reqProgress, setReqProgress] = useState<RequestScanProgress | null>(null)
  const [reqDone, setReqDone] = useState(false)
  const [reqError, setReqError] = useState('')

  // Funnel request questions state
  const [funnelRunning, setFunnelRunning] = useState(false)
  const [funnelMsg, setFunnelMsg] = useState('')
  const [funnelResult, setFunnelResult] = useState<{ found: number; added: number } | null>(null)
  const [funnelError, setFunnelError] = useState('')

  // Full scan suite state
  const [fullScanRunning, setFullScanRunning] = useState(false)
  const [fullScanStep, setFullScanStep] = useState(0) // 0=idle 1-4=active step 5=done
  const [fullScanError, setFullScanError] = useState('')
  const fullScanAbortRef = useRef<AbortController | null>(null)

  // Analysis scan state
  const [anScanning, setAnScanning] = useState(false)
  const [anProgress, setAnProgress] = useState<AnalysisScanProgress | null>(null)
  const [anDone, setAnDone] = useState(false)
  const [anError, setAnError] = useState('')

  // Question classification state
  const [clScanning, setClScanning] = useState(false)
  const [clProgress, setClProgress] = useState<ClassifyProgress | null>(null)
  const [clDone, setClDone] = useState(false)
  const [clError, setClError] = useState('')
  const clAbortRef = useRef<AbortController | null>(null)

  // Thread reply scan state
  const [thScanning, setThScanning] = useState(false)
  const [thProgress, setThProgress] = useState<ThreadScanProgress | null>(null)
  const [thDone, setThDone] = useState(false)
  const [thError, setThError] = useState('')
  const thAbortRef = useRef<AbortController | null>(null)
  const [thResetting, setThResetting] = useState(false)
  const [thResetMsg, setThResetMsg] = useState('')

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

  // qanon.pub claims scan state
  const [qpubClaimsRunning, setQpubClaimsRunning] = useState(false)
  const [qpubClaimsProgress, setQpubClaimsProgress] = useState<{ done: number; total: number; found: number; newFound: number } | null>(null)
  const [qpubClaimsDone, setQpubClaimsDone] = useState<{ scanned: number; found: number; newFound: number } | null>(null)
  const [qpubClaimsError, setQpubClaimsError] = useState('')

  async function handleScanQpubClaims() {
    setQpubClaimsRunning(true); setQpubClaimsDone(null); setQpubClaimsError('')
    setQpubClaimsProgress({ done: 0, total: 0, found: 0, newFound: 0 })
    try {
      const { getDocs: gd, collection: col, writeBatch: wb, doc: d, query: q, orderBy: ob, limit: lim } = await import('firebase/firestore')
      const { db: firedb } = await import('../firebase')
      const { analyzePost } = await import('../lib/claude')

      const [rawRes, snap] = await Promise.all([
        fetch('/qanonpub-proxy/data/json/posts.json'),
        gd(q(col(firedb, 'posts'), ob('postNum'), lim(5000))),
      ])
      if (!rawRes.ok) throw new Error(`qanon.pub fetch failed: ${rawRes.status}`)
      const raw: { id: string | number; text?: string; timestamp?: number; number?: number }[] = await rawRes.json()

      raw.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

      const qpubMap = new Map<number, string>()
      raw.forEach((r, i) => {
        const num = (r as { number?: number }).number ?? (i + 1)
        if (r.text) qpubMap.set(num, r.text)
      })

      const posts = snap.docs
        .map(dc => ({ id: dc.id, ...(dc.data() as { postNum: number; claimsScanned?: boolean; postAnalysis?: { claims?: string[] } }) }))
        .filter(p => !p.claimsScanned && qpubMap.has(p.postNum))

      const total = posts.length
      let done = 0, found = 0, newFound = 0
      setQpubClaimsProgress({ done, total, found, newFound })

      for (let i = 0; i < posts.length; i += 3) {
        const chunk = posts.slice(i, i + 3)
        const batch = wb(firedb)
        for (const post of chunk) {
          const text = qpubMap.get(post.postNum) ?? ''
          const analysis = await analyzePost(text)
          const claims = analysis.claims ?? []
          const existingNorm = new Set((post.postAnalysis?.claims ?? []).map(c => c.toLowerCase().trim()))
          const novelClaims = claims.filter(c => !existingNorm.has(c.toLowerCase().trim()))
          batch.update(d(col(firedb, 'posts'), post.id), {
            'postAnalysis.claims': claims,
            claimsScanned: true,
          })
          found += claims.length
          newFound += novelClaims.length
          done++
          setQpubClaimsProgress({ done, total, found, newFound })
        }
        await batch.commit()
        if (i + 3 < posts.length) await new Promise(r => setTimeout(r, 8000))
      }
      setQpubClaimsDone({ scanned: done, found, newFound })
    } catch (e) { setQpubClaimsError(String(e)) }
    finally { setQpubClaimsRunning(false) }
  }

  // qanon.pub requests scan state
  const [qpubReqRunning, setQpubReqRunning] = useState(false)
  const [qpubReqProgress, setQpubReqProgress] = useState<{ done: number; total: number; found: number; newFound: number } | null>(null)
  const [qpubReqDone, setQpubReqDone] = useState<{ scanned: number; found: number; newFound: number } | null>(null)
  const [qpubReqError, setQpubReqError] = useState('')

  async function handleScanQpubRequests() {
    setQpubReqRunning(true); setQpubReqDone(null); setQpubReqError('')
    setQpubReqProgress({ done: 0, total: 0, found: 0, newFound: 0 })
    try {
      const { getDocs: gd, collection: col, writeBatch: wb, doc: d, query: q, orderBy: ob, limit: lim } = await import('firebase/firestore')
      const { db: firedb } = await import('../firebase')
      const { detectActionRequests } = await import('../lib/claude')

      const [rawRes, snap] = await Promise.all([
        fetch('/qanonpub-proxy/data/json/posts.json'),
        gd(q(col(firedb, 'posts'), ob('postNum'), lim(5000))),
      ])
      if (!rawRes.ok) throw new Error(`qanon.pub fetch failed: ${rawRes.status}`)
      const raw: { id: string | number; text?: string; timestamp?: number; number?: number }[] = await rawRes.json()

      raw.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

      const qpubMap = new Map<number, string>()
      raw.forEach((r, i) => {
        const num = (r as { number?: number }).number ?? (i + 1)
        if (r.text) qpubMap.set(num, r.text)
      })

      const posts = snap.docs
        .map(dc => ({ id: dc.id, ...(dc.data() as { postNum: number; qpubRequestsScanned?: boolean; actionRequests?: string[] }) }))
        .filter(p => !p.qpubRequestsScanned && qpubMap.has(p.postNum))

      const total = posts.length
      let done = 0, found = 0, newFound = 0
      setQpubReqProgress({ done, total, found, newFound })

      for (let i = 0; i < posts.length; i += 3) {
        const chunk = posts.slice(i, i + 3)
        const batch = wb(firedb)
        for (const post of chunk) {
          const text = qpubMap.get(post.postNum) ?? ''
          const requests = await detectActionRequests(text)
          const existingNorm = new Set((post.actionRequests ?? []).map(r => r.toLowerCase().trim()))
          const novelReqs = requests.filter(r => !existingNorm.has(r.toLowerCase().trim()))
          batch.update(d(col(firedb, 'posts'), post.id), {
            actionRequests: requests,
            requestsScanned: true,
            hasRequests: requests.length > 0,
            qpubRequestsScanned: true,
          })
          found += requests.length
          newFound += novelReqs.length
          done++
          setQpubReqProgress({ done, total, found, newFound })
        }
        await batch.commit()
        if (i + 3 < posts.length) await new Promise(r => setTimeout(r, 8000))
      }
      setQpubReqDone({ scanned: done, found, newFound })
    } catch (e) { setQpubReqError(String(e)) }
    finally { setQpubReqRunning(false) }
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
  }, [ingestDone, scanDone])

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

  async function handleResetAndRescan() {
    if (!window.confirm('This will DELETE all detected questions and re-scan every post from scratch with the improved prompt. This cannot be undone. Continue?')) return
    setResetting(true)
    setResetMsg('')
    setScanError('')
    setScanDone(false)
    try {
      await resetForRescan(msg => setResetMsg(msg))
      setResetting(false)
      // Now run the full scan
      setScanning(true)
      abortRef.current = new AbortController()
      await bulkScanAllPosts(p => setScanProgress(p), abortRef.current.signal)
      setScanDone(true)
      getStats().then(setStats)
    } catch (e) {
      setScanError(String(e))
    } finally {
      setResetting(false)
      setScanning(false)
    }
  }

  async function handleClassifyQuestions() {
    setClScanning(true); setClDone(false); setClError('')
    clAbortRef.current = new AbortController()
    try {
      await bulkClassifyQuestions(p => setClProgress(p), clAbortRef.current.signal)
      setClDone(true)
    } catch (e) {
      setClError(String(e))
    } finally {
      setClScanning(false)
    }
  }

  function handleStopClassify() {
    clAbortRef.current?.abort()
  }

  async function handleThreadScan() {
    setThScanning(true); setThDone(false); setThError('')
    thAbortRef.current = new AbortController()
    try {
      await bulkScanThreadAnswers(p => setThProgress(p), thAbortRef.current.signal)
      setThDone(true)
    } catch (e) {
      setThError(String(e))
    } finally {
      setThScanning(false)
    }
  }

  function handleStopThreadScan() {
    thAbortRef.current?.abort()
  }

  async function handleResetThreadScan() {
    if (!confirm('Reset thread scan? This keeps all found answers but allows every thread to be re-scanned.')) return
    setThResetting(true); setThResetMsg('')
    await resetThreadScan(msg => setThResetMsg(msg))
    setThResetting(false); setThDone(false); setThProgress(null)
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

  async function handleFullScan() {
    setFullScanRunning(true)
    setFullScanError('')
    setFullScanStep(0)
    fullScanAbortRef.current = new AbortController()
    const signal = fullScanAbortRef.current.signal
    try {
      // Reset all states upfront
      setScanProgress(null); setScanDone(false); setScanError('')
      setReqProgress(null); setReqDone(false); setReqError('')
      setFunnelResult(null); setFunnelMsg(''); setFunnelError('')
      setAnProgress(null); setAnDone(false); setAnError('')

      // Steps 1, 2→3, and 4 run in parallel — step 3 chains after step 2 completes
      setScanning(true); setReqScanning(true); setAnScanning(true)
      await Promise.all([
        // Step 1: Question Detection
        bulkScanAllPosts(p => setScanProgress(p), signal)
          .then(() => { setScanning(false); if (!signal.aborted) setScanDone(true) })
          .catch(e => { setScanning(false); setScanError(String(e)) }),

        // Step 2: Request Detection → Step 3: Question Funnel
        bulkScanAllRequests(p => setReqProgress(p), signal)
          .then(async () => {
            setReqScanning(false)
            if (signal.aborted) return
            setReqDone(true)
            setFunnelRunning(true)
            const funnelRes = await funnelRequestQuestionsToCollection(msg => setFunnelMsg(msg))
            setFunnelRunning(false)
            if (!signal.aborted) setFunnelResult(funnelRes)
          })
          .catch(e => { setReqScanning(false); setFunnelRunning(false); setReqError(String(e)) }),

        // Step 4: Deep Analysis
        bulkScanAllAnalysis(p => setAnProgress(p), signal)
          .then(() => { setAnScanning(false); if (!signal.aborted) setAnDone(true) })
          .catch(e => { setAnScanning(false); setAnError(String(e)) }),
      ])

      if (!signal.aborted) {
        setFullScanStep(5)
        getStats().then(setStats)
      }
    } catch (e) {
      setFullScanError(String(e))
    } finally {
      setFullScanRunning(false)
      setScanning(false); setReqScanning(false); setAnScanning(false); setFunnelRunning(false)
    }
  }

  function handleStopFullScan() {
    fullScanAbortRef.current?.abort()
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
            The Dashboard holds the admin tools (ingest, bulk scans, AI analysis). Enter the admin PIN to access it.
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

      {/* Intelligence Scan Suite — single unified panel */}
      {stats && stats.totalPosts > 0 && (
        <div className="bg-q-panel border border-q-border rounded-xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-white font-bold text-base">🧠 Intelligence Scan Suite</p>
              <p className="text-gray-400 text-sm mt-1">
                Runs all 4 scans in sequence across all {stats.totalPosts.toLocaleString()} posts.
                Each step skips already-processed posts — safe to stop and resume at any time.
              </p>
            </div>
            <div className="shrink-0 ml-4 flex flex-col gap-2 items-end">
              {!fullScanRunning ? (
                <>
                  <button onClick={handleFullScan}
                    className="bg-q-accent hover:bg-q-accent/80 text-white font-bold px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap">
                    Run All Scans
                  </button>
                  <button onClick={handleResetAndRescan}
                    className="bg-red-900/60 hover:bg-red-700 text-red-300 hover:text-white border border-red-700 px-4 py-1.5 rounded-lg transition-colors text-xs whitespace-nowrap">
                    ↺ Reset &amp; Re-scan Questions
                  </button>
                </>
              ) : (
                <button onClick={handleStopFullScan}
                  className="bg-red-600 hover:bg-red-500 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm">
                  Stop
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {([
              {
                step: 1,
                icon: '🔍',
                label: 'Question Detection',
                desc: 'Sends each post to Claude AI and extracts every question asked. Questions appear highlighted in blue on each post and are collected in the Q Questions archive for Green / Yellow / Red classification.',
                barColor: 'bg-blue-500',
                activeStyle: 'bg-blue-950/30 border-blue-800/50',
                isActive: scanning || fullScanStep === 1,
                isDone: scanDone || (fullScanStep > 1 && fullScanStep !== 0),
                progressLabel: scanProgress ? `Post #${scanProgress.currentPost} · ${scanProgress.questionsFound} questions found` : null,
                progressValue: scanProgress ? scanProgress.scanned / Math.max(scanProgress.total, 1) : null,
                resultMsg: scanDone ? `${scanProgress?.questionsFound ?? 0} questions found across ${scanProgress?.scanned ?? 0} posts` : null,
              },
              {
                step: 2,
                icon: '🟢',
                label: 'Request Detection',
                desc: 'Finds sentences where Q directs readers to take action — "Dig", "Follow the money", "Spread the word", etc. Requests appear highlighted in green on posts and collected in the Q Requests archive.',
                barColor: 'bg-green-500',
                activeStyle: 'bg-green-950/30 border-green-800/50',
                isActive: reqScanning || fullScanStep === 2,
                isDone: reqDone || (fullScanStep > 2 && fullScanStep !== 0),
                progressLabel: reqProgress ? `Post #${reqProgress.currentPost} · ${reqProgress.requestsFound} requests found` : null,
                progressValue: reqProgress ? reqProgress.scanned / Math.max(reqProgress.total, 1) : null,
                resultMsg: reqDone ? `${reqProgress?.requestsFound ?? 0} requests found across ${reqProgress?.scanned ?? 0} posts` : null,
              },
              {
                step: 3,
                icon: '❓',
                label: 'Question Funnel',
                desc: 'Scans all detected requests for sentences containing "?" and moves them into the Q Questions list. Catches questions that the request scanner picked up but the question scanner missed. No Claude call — runs instantly.',
                barColor: 'bg-blue-400',
                activeStyle: 'bg-blue-950/20 border-blue-800/40',
                isActive: funnelRunning || fullScanStep === 3,
                isDone: funnelResult !== null || (fullScanStep > 3 && fullScanStep !== 0),
                progressLabel: funnelMsg || null,
                progressValue: null,
                resultMsg: funnelResult ? `${funnelResult.found} requests with "?" found · ${funnelResult.added} new questions added` : null,
              },
              {
                step: 4,
                icon: '🔬',
                label: 'Deep Analysis',
                desc: 'Extracts 7 intelligence categories from each post: claims, predictions, named entities, themes, implied conclusions, emotional tone, and checkable claims. Results stored on each post and browsable in the Post Analysis archive.',
                barColor: 'bg-violet-500',
                activeStyle: 'bg-violet-950/30 border-violet-800/50',
                isActive: anScanning || fullScanStep === 4,
                isDone: anDone || fullScanStep === 5,
                progressLabel: anProgress ? `Post #${anProgress.currentPost} · ${anProgress.scanned} / ${anProgress.total} · ${anProgress.questionsFound} questions` : null,
                progressValue: anProgress ? anProgress.scanned / Math.max(anProgress.total, 1) : null,
                resultMsg: anDone ? `${anProgress?.scanned ?? 0} posts analyzed · ${anProgress?.questionsFound ?? 0} questions detected` : null,
              },
            ] as const).map(s => (
              <div key={s.step} className={`flex items-start gap-3 rounded-lg p-3 border transition-all ${
                s.isActive ? s.activeStyle : s.isDone ? 'bg-gray-800/20 border-gray-700/30' : 'bg-transparent border-gray-800/40'
              }`}>
                <div className="shrink-0 mt-1 w-5 text-center">
                  {s.isDone
                    ? <span className="text-green-400 font-bold text-sm">✓</span>
                    : s.isActive
                    ? <span className="text-gray-300 text-sm animate-pulse">⟳</span>
                    : <span className="text-gray-700 text-xs font-bold">{s.step}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{s.icon}</span>
                    <span className={`text-sm font-semibold ${s.isActive ? 'text-white' : s.isDone ? 'text-gray-400' : 'text-gray-600'}`}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
                  {s.isActive && s.progressLabel && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-400">{s.progressLabel}</p>
                      {s.progressValue !== null && (
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full ${s.barColor} rounded-full transition-all`}
                            style={{ width: `${s.progressValue * 100}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                  {!s.isActive && s.isDone && s.resultMsg && (
                    <p className="text-xs text-green-400 mt-1">{s.resultMsg}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {fullScanStep === 5 && !fullScanRunning && (
            <p className="mt-4 text-green-400 text-sm font-semibold">✓ All scans complete — archive is fully up to date!</p>
          )}
          {resetting && resetMsg && <p className="mt-3 text-yellow-400 text-sm animate-pulse">{resetMsg}</p>}
          {(fullScanError || scanError || reqError || funnelError || anError) && (
            <p className="mt-3 text-red-400 text-sm">{fullScanError || scanError || reqError || funnelError || anError}</p>
          )}
        </div>
      )}

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

      {/* qanon.pub Claims scan panel */}
      <div className="bg-q-panel border border-amber-800/50 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">🔶 Scan qanon.pub for Claims</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Uses qanon.pub post text as the source and runs Claude AI to extract factual claims from each post. Only processes posts not yet claims-scanned. Results saved to <span className="font-mono text-amber-400">postAnalysis.claims</span>.
            </p>
            {qpubClaimsProgress && (
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">
                  {qpubClaimsProgress.done} / {qpubClaimsProgress.total} posts
                  {qpubClaimsProgress.newFound > 0 && <span className="text-amber-400 ml-2">· {qpubClaimsProgress.newFound} new claims</span>}
                  {qpubClaimsProgress.found > qpubClaimsProgress.newFound && <span className="text-gray-500 ml-1">({qpubClaimsProgress.found - qpubClaimsProgress.newFound} already existed)</span>}
                </p>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(qpubClaimsProgress.done / Math.max(qpubClaimsProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {qpubClaimsDone && (
              <p className="text-xs text-amber-400 mt-2 font-semibold">
                ✓ Done — {qpubClaimsDone.scanned} posts scanned · <span className="text-white">{qpubClaimsDone.newFound} new claims</span>{qpubClaimsDone.found > qpubClaimsDone.newFound && <span className="text-gray-500"> · {qpubClaimsDone.found - qpubClaimsDone.newFound} already existed</span>}
              </p>
            )}
            {qpubClaimsError && <p className="text-xs text-red-400 mt-1">{qpubClaimsError}</p>}
          </div>
          <div className="shrink-0">
            <button onClick={handleScanQpubClaims} disabled={qpubClaimsRunning}
              className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
              {qpubClaimsRunning ? 'Scanning…' : 'Scan Claims'}
            </button>
          </div>
        </div>
      </div>

      {/* qanon.pub Requests scan panel */}
      <div className="bg-q-panel border border-green-800/50 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">🟢 Scan qanon.pub for Requests</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Uses qanon.pub post text as the source and runs Claude AI to extract action requests / directives from each post. Only processes posts not yet requests-scanned. Results saved to <span className="font-mono text-green-400">actionRequests</span>.
            </p>
            {qpubReqProgress && (
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">
                  {qpubReqProgress.done} / {qpubReqProgress.total} posts
                  {qpubReqProgress.newFound > 0 && <span className="text-green-400 ml-2">· {qpubReqProgress.newFound} new requests</span>}
                  {qpubReqProgress.found > qpubReqProgress.newFound && <span className="text-gray-500 ml-1">({qpubReqProgress.found - qpubReqProgress.newFound} already existed)</span>}
                </p>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(qpubReqProgress.done / Math.max(qpubReqProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {qpubReqDone && (
              <p className="text-xs text-green-400 mt-2 font-semibold">
                ✓ Done — {qpubReqDone.scanned} posts scanned · <span className="text-white">{qpubReqDone.newFound} new requests</span>{qpubReqDone.found > qpubReqDone.newFound && <span className="text-gray-500"> · {qpubReqDone.found - qpubReqDone.newFound} already existed</span>}
              </p>
            )}
            {qpubReqError && <p className="text-xs text-red-400 mt-1">{qpubReqError}</p>}
          </div>
          <div className="shrink-0">
            <button onClick={handleScanQpubRequests} disabled={qpubReqRunning}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
              {qpubReqRunning ? 'Scanning…' : 'Scan Requests'}
            </button>
          </div>
        </div>
      </div>

      {/* Question Classification panel */}
      <div className="bg-q-panel border border-blue-800/50 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">🔍 Classify Questions Against Archive</p>
            <p className="text-gray-400 text-sm mt-0.5">
              For each unprocessed question, finds the most relevant Q posts by keyword match, then asks Claude whether those posts answer the question.
              Sets status to <span className="text-green-400 font-semibold">Answered</span>, <span className="text-yellow-400 font-semibold">Partial</span>, or <span className="text-red-400 font-semibold">Unanswered</span> based solely on what appears in the archive.
            </p>
            {clProgress && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-gray-400">
                  {clProgress.done} / {clProgress.total} processed
                  {clProgress.currentQuestion && <span className="text-gray-600 ml-2">· "{clProgress.currentQuestion}…"</span>}
                </p>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-400">✓ Answered: {clProgress.greenFound}</span>
                  <span className="text-yellow-400">~ Partial: {clProgress.yellowFound}</span>
                  <span className="text-red-400">✗ Unanswered: {clProgress.redFound}</span>
                  {clProgress.samePostFound > 0 && <span className="text-cyan-400">⚡ Same-post: {clProgress.samePostFound}</span>}
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(clProgress.done / Math.max(clProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {clDone && (
              <p className="text-xs text-blue-400 mt-2 font-semibold">
                ✓ Done — <span className="text-green-400">{clProgress?.greenFound ?? 0} Answered</span> · <span className="text-yellow-400">{clProgress?.yellowFound ?? 0} Partial</span> · <span className="text-red-400">{clProgress?.redFound ?? 0} Unanswered</span>
                {(clProgress?.samePostFound ?? 0) > 0 && <span className="text-cyan-400 ml-1">· {clProgress?.samePostFound} answered in same post</span>}
              </p>
            )}
            {clError && <p className="text-xs text-red-400 mt-1">{clError}</p>}
          </div>
          <div className="shrink-0 flex flex-col gap-2 items-end">
            {!clScanning ? (
              <button onClick={handleClassifyQuestions}
                className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
                Classify Questions
              </button>
            ) : (
              <button onClick={handleStopClassify}
                className="bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">
                Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 8kun Thread Reply Scan panel */}
      <div className="bg-q-panel border border-orange-800/50 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">🔗 Scan Thread Replies for Answers (4chan / 8chan / 8kun)</p>
            <p className="text-gray-400 text-sm mt-0.5">
              For each Q post with a board link, fetches the full thread from 4chan, 8chan, or 8kun and checks whether anonymous users answered Q's questions. Also detects any follow-up posts Q made in the same thread using a Q tripcode. Results stored per post and visible in Post Detail.
            </p>
            <p className="text-xs text-orange-400/70 mt-1">
              Note: Uses a CORS proxy to reach the boards. Rate limited to ~1 post every 2s to avoid throttling.
            </p>
            {thProgress && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-gray-400">
                  Post #{thProgress.currentPost} · {thProgress.done} / {thProgress.total} processed
                  {thProgress.fetchFailed > 0 && <span className="text-red-500/70 ml-2">· {thProgress.fetchFailed} unreachable (CORS/network)</span>}
                </p>
                <div className="flex gap-3 text-xs flex-wrap">
                  <span className="text-blue-400">💬 Anon replies: {thProgress.repliesFound}</span>
                  <span className="text-yellow-400">🔐 Q replies in thread: {thProgress.qRepliesFound}</span>
                  <span className="text-green-400">✓ Answers found: {thProgress.answersFound}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(thProgress.done / Math.max(thProgress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}
            {thDone && (
              <p className="text-xs text-orange-400 mt-2 font-semibold">
                ✓ Done — <span className="text-white">{(thProgress?.done ?? 0) - (thProgress?.fetchFailed ?? 0)} threads fetched</span> · <span className="text-green-400">{thProgress?.answersFound ?? 0} answers found</span> · <span className="text-yellow-400">{thProgress?.qRepliesFound ?? 0} Q replies</span> · <span className="text-blue-400">{thProgress?.repliesFound ?? 0} anon replies</span>{(thProgress?.fetchFailed ?? 0) > 0 && <span className="text-red-400/70"> · {thProgress?.fetchFailed} unreachable</span>}
              </p>
            )}
            {thError && <p className="text-xs text-red-400 mt-1">{thError}</p>}
          </div>
          <div className="shrink-0 flex flex-col gap-2 items-end">
            {!thScanning ? (
              <button onClick={handleThreadScan}
                className="bg-orange-700 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm">
                Scan Threads
              </button>
            ) : (
              <button onClick={handleStopThreadScan}
                className="bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">
                Stop
              </button>
            )}
            <button onClick={handleResetThreadScan} disabled={thScanning || thResetting}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 font-medium px-4 py-1.5 rounded-lg transition-colors text-xs">
              {thResetting ? thResetMsg || 'Resetting…' : '↺ Reset & Rescan All'}
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
          <StatCard label="Checkable Claims" value={analysisTotals.verificationHooks.toLocaleString()} color="text-fuchsia-400" to="/analysis?tab=verificationHooks" />
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
                    <XAxis dataKey="month" tick={<CustomXAxisTick />} interval={0} height={44} />
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
                          { name: 'Named Entities',    color: '#06b6d4' },
                          { name: 'Themes',            color: '#6366f1' },
                          { name: 'Impl. Conclusions', color: '#f97316' },
                          { name: 'Checkable Claims',      color: catColor('verificationHooks') },
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
                      <Bar dataKey="requests"           name="Requests"           radius={[2, 2, 0, 0]} style={{ cursor: 'pointer' }}>
                        {timeline.map(e => <Cell key={e.month} fill={!selectedMonth || selectedMonth === e.month ? '#22c55e' : '#14532d'} />)}
                      </Bar>
                      <Bar dataKey="claims"             name="Claims"             stackId="a" fill="#f59e0b" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="predictions"        name="Predictions"        stackId="a" fill="#8b5cf6" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="namedEntities"      name="Named Entities"     stackId="a" fill="#06b6d4" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="themes"             name="Themes"             stackId="a" fill="#6366f1" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="impliedConclusions" name="Impl. Conclusions"  stackId="a" fill="#f97316" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="verificationHooks"  name="Checkable Claims" stackId="a" fill={catColor('verificationHooks')} radius={[2,2,0,0]} style={{ cursor: 'pointer' }} />
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
