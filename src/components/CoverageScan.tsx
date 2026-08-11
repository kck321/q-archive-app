import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getUncategorizedReport, applyAnalysisToMatchingPosts, removeAnalysisFromMatchingPosts, type UncategorizedReport, type UncategorizedTerm } from '../lib/posts'
import { useAdmin } from './AdminContext'
import type { PostAnalysis } from '../types'

const CLASSIFY_CATS: { key: keyof PostAnalysis; label: string }[] = [
  { key: 'namedEntities',      label: 'Named Entities' },
  { key: 'claims',             label: 'Claims' },
  { key: 'predictions',        label: 'Predictions' },
  { key: 'themes',             label: 'Themes' },
  { key: 'impliedConclusions', label: 'Impl. Conclusions' },
  { key: 'verificationHooks',  label: 'Checkable Claims' },
]

// Dashboard scanner: reports the % of posts with nothing highlighted, then lists every
// uncategorized term/phrase with the post numbers it appears in, ranked by repeats.
export default function CoverageScan() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<UncategorizedReport | null>(null)
  const [view, setView] = useState<'repeated' | 'all'>('repeated')
  const [filter, setFilter] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Remembers the last classify so it can be undone.
  const [lastAction, setLastAction] = useState<{ term: UncategorizedTerm; category: keyof PostAnalysis; label: string } | null>(null)
  // Manual "fix a mistake" remover.
  const [rmTerm, setRmTerm] = useState('')
  const [rmCat, setRmCat] = useState<keyof PostAnalysis>('namedEntities')
  const { unlocked: adminUnlocked, requireAdmin } = useAdmin()

  async function removeManual() {
    const term = rmTerm.trim()
    if (!term) return
    const label = CLASSIFY_CATS.find(c => c.key === rmCat)?.label ?? rmCat
    requireAdmin(`remove "${term}" from ${label} on all posts`, async () => {
      setBusyKey('__rm__'); setMsg(null)
      try {
        const { removed } = await removeAnalysisFromMatchingPosts(term, rmCat)
        setMsg(removed > 0
          ? `↩ Removed "${term}" from ${label} on ${removed} post${removed === 1 ? '' : 's'}.`
          : `No posts had "${term}" in ${label}.`)
        setRmTerm('')
        setReport(r => r) // keep current
      } catch { setMsg('Remove failed.') }
      finally { setBusyKey(null) }
    })
  }

  async function scan() {
    setLoading(true); setMsg(null); setLastAction(null)
    try { setReport(await getUncategorizedReport()) }
    finally { setLoading(false) }
  }

  async function classify(item: UncategorizedTerm, category: keyof PostAnalysis, label: string) {
    setBusyKey(item.term); setMsg(null)
    try {
      const { changed, matched } = await applyAnalysisToMatchingPosts(item.term, category)
      setReport(r => r ? { ...r, terms: r.terms.filter(t => t.term !== item.term) } : r)
      setLastAction({ term: item, category, label })
      setMsg(`✓ Classified "${item.term}" as ${label} on ${changed} post${changed === 1 ? '' : 's'} (of ${matched}).`)
    } catch { setMsg('Classify failed.') }
    finally { setBusyKey(null) }
  }

  async function undoLast() {
    if (!lastAction) return
    const { term, category, label } = lastAction
    setBusyKey(term.term); setMsg(null)
    try {
      const { removed } = await removeAnalysisFromMatchingPosts(term.term, category)
      // Put the term back into the list (sorted by count) so it can be re-classified.
      setReport(r => r ? { ...r, terms: [term, ...r.terms].sort((a, b) => b.count - a.count || a.term.localeCompare(b.term)) } : r)
      setLastAction(null)
      setMsg(`↩ Undone — removed "${term.term}" from ${label} on ${removed} post${removed === 1 ? '' : 's'}.`)
    } catch { setMsg('Undo failed.') }
    finally { setBusyKey(null) }
  }

  const terms = report?.terms ?? []
  const repeatedCount = terms.filter(t => t.count >= 2).length
  const visible = terms.filter(t =>
    (view === 'all' || t.count >= 2) &&
    (!filter.trim() || t.term.toLowerCase().includes(filter.toLowerCase().trim()))
  )

  return (
    <div className="bg-q-panel border border-violet-800/40 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[14rem]">
          <h2 className="text-white font-semibold">🔍 Uncategorized content scan</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Scans all {report ? report.totalPosts.toLocaleString() : '4,966'} posts for anything not highlighted/classified yet, shows the coverage %, and lists what to research — ranked by what repeats.
          </p>
        </div>
        <button onClick={scan} disabled={loading}
          className="text-sm bg-violet-700 hover:bg-violet-600 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
          {loading ? 'Scanning…' : report ? '↻ Rescan' : '🔍 Scan all posts'}
        </button>
      </div>

      {/* Fix a mistake — remove a term from a category across all posts */}
      <div className="flex items-center gap-2 flex-wrap bg-gray-900/30 border border-gray-800/60 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-400">↩ Undo a classification:</span>
        <input value={rmTerm} onChange={e => setRmTerm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && removeManual()}
          placeholder='e.g. em twitter'
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 w-40" />
        <span className="text-xs text-gray-500">from</span>
        <select value={rmCat} onChange={e => setRmCat(e.target.value as keyof PostAnalysis)}
          className="text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-amber-400 cursor-pointer">
          {CLASSIFY_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button onClick={removeManual} disabled={!rmTerm.trim() || busyKey === '__rm__'}
          className="text-xs bg-amber-800 hover:bg-amber-700 text-amber-100 px-3 py-1 rounded transition-colors disabled:opacity-40">
          {busyKey === '__rm__' ? 'Removing…' : 'Remove from all'}
        </button>
      </div>

      {msg && (
        <div className="text-xs text-green-300 bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span>{msg}</span>
          <div className="flex items-center gap-2 shrink-0">
            {lastAction && (
              <button onClick={undoLast} disabled={!!busyKey}
                className="text-amber-300 hover:text-amber-100 bg-amber-900/30 border border-amber-700/50 px-2 py-0.5 rounded disabled:opacity-50">
                ↩ Undo
              </button>
            )}
            <button onClick={() => setMsg(null)} className="text-gray-500 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {loading && <div className="text-gray-500 text-sm animate-pulse py-3">Scanning all posts…</div>}

      {report && !loading && (
        <>
          {/* Coverage stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3">
              <p className="text-[11px] text-gray-500">Posts NOT highlighted</p>
              <p className="text-2xl font-bold text-amber-300">{report.pctUnhighlighted}%</p>
              <p className="text-[11px] text-gray-600">{report.postsUnhighlighted.toLocaleString()} of {report.totalPosts.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3">
              <p className="text-[11px] text-gray-500">Posts highlighted</p>
              <p className="text-2xl font-bold text-green-300">{(100 - report.pctUnhighlighted).toFixed(1)}%</p>
              <p className="text-[11px] text-gray-600">{report.postsHighlighted.toLocaleString()} of {report.totalPosts.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3">
              <p className="text-[11px] text-gray-500">Uncategorized terms</p>
              <p className="text-2xl font-bold text-white">{terms.length.toLocaleString()}</p>
              <p className="text-[11px] text-gray-600">unique words/phrases</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3">
              <p className="text-[11px] text-gray-500">Repeated (2+ posts)</p>
              <p className="text-2xl font-bold text-violet-300">{repeatedCount.toLocaleString()}</p>
              <p className="text-[11px] text-gray-600">significant to research</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
              <button onClick={() => setView('repeated')}
                className={`px-3 py-1 transition-colors ${view === 'repeated' ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                Repeated ({repeatedCount})
              </button>
              <button onClick={() => setView('all')}
                className={`px-3 py-1 transition-colors ${view === 'all' ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                All found ({terms.length})
              </button>
            </div>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-400 w-32" />
            <span className="text-xs text-gray-500">{visible.length} shown{adminUnlocked ? '' : ' · PIN needed to classify'}</span>
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-[34rem] overflow-y-auto pr-1">
            {visible.length === 0 ? (
              <p className="text-gray-500 text-sm py-3">Nothing to show.</p>
            ) : visible.map(t => (
              <div key={t.term} className="flex items-start gap-2 flex-wrap bg-gray-900/30 border border-gray-800/60 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap min-w-[10rem]">
                  <span className="text-sm text-white font-medium">{t.term}</span>
                  <span className={`text-xs font-bold ${t.count >= 2 ? 'text-violet-300' : 'text-gray-500'}`}>
                    {t.count >= 2 ? `in ${t.count} posts` : 'once'}{t.occurrences > t.count ? ` · ${t.occurrences}×` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 flex-1">
                  {t.postNums.slice(0, 15).map(n => (
                    <Link key={n} to={`/post/${n}`} className="text-[10px] font-mono text-blue-400 hover:text-blue-200 bg-blue-900/20 border border-blue-800/40 px-1.5 py-0.5 rounded">#{n}</Link>
                  ))}
                  {t.postNums.length > 15 && <span className="text-[10px] text-gray-600 self-center">+{t.postNums.length - 15} more</span>}
                </div>
                <select
                  defaultValue=""
                  disabled={busyKey === t.term}
                  onChange={e => {
                    const cat = CLASSIFY_CATS.find(c => c.key === e.target.value)
                    e.target.value = ''
                    if (cat) requireAdmin(`classify "${t.term}" as ${cat.label} on all ${t.count} posts`, () => classify(t, cat.key, cat.label))
                  }}
                  className="text-xs bg-gray-800 border border-gray-600 text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-violet-400 cursor-pointer self-start">
                  <option value="" disabled>{adminUnlocked ? 'Classify all as…' : '🔒 Classify…'}</option>
                  {CLASSIFY_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
