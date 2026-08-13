import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { loadQueue, submitSuggestion, type QueueData, type QueueItem } from '../lib/resolution'

// The Resolution Center.
//
// Everything here is occurrence-specific. Resolving "BO" in #1021 says nothing about the other
// 60 drops that use it, and the form makes that explicit rather than leaving it implied — a
// contributor has to opt IN to covering further occurrences.

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  UNDER_REVIEW: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  RESOLVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  INSUFFICIENT_EVIDENCE: 'bg-gray-500/15 text-gray-400 border-gray-500/40',
  DISPUTED: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
}

function SuggestForm({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const [proposed, setProposed] = useState('')
  const [reasoning, setReasoning] = useState('')
  const [source, setSource] = useState('')
  const [scope, setScope] = useState<'this' | 'listed'>('this')
  const [others, setOthers] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const send = async () => {
    if (!proposed.trim() || !reasoning.trim()) return
    setState('sending')
    try {
      await submitSuggestion({
        itemId: item.id, token: item.token, postNum: item.postNum,
        proposedResolution: proposed.trim(),
        reasoning: reasoning.trim(),
        sourceUrl: source.trim() || undefined,
        alsoAppliesTo: scope === 'listed' ? others.split(/[\s,]+/).filter(Boolean) : [],
        contact: contact.trim() || undefined,
      })
      setState('sent')
      setTimeout(onDone, 1800)
    } catch { setState('error') }
  }

  if (state === 'sent') {
    return (
      <div className="mt-3 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
        Thank you — your suggestion is queued for editorial review. It does not change the archive on its own.
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-q-border bg-black/20 p-3 space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Proposed meaning / entity <span className="text-rose-400">*</span></label>
        <input value={proposed} onChange={e => setProposed(e.target.value)} placeholder='e.g. "Barack Obama"'
          className="w-full bg-q-bg border border-q-border rounded px-2 py-1.5 text-sm text-gray-200" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Why do you believe this is correct? <span className="text-rose-400">*</span></label>
        <textarea value={reasoning} onChange={e => setReasoning(e.target.value)} rows={3}
          placeholder="Point to what in this drop, or a nearby drop, identifies the referent."
          className="w-full bg-q-bg border border-q-border rounded px-2 py-1.5 text-sm text-gray-200" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Supporting source or link <span className="text-gray-600">(optional, encouraged)</span></label>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="https://…"
          className="w-full bg-q-bg border border-q-border rounded px-2 py-1.5 text-sm text-gray-200" />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">What does this cover?</label>
        <div className="space-y-1.5">
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input type="radio" checked={scope === 'this'} onChange={() => setScope('this')} className="mt-1" />
            <span>This occurrence only <span className="text-gray-500">— post #{item.postNum}</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input type="radio" checked={scope === 'listed'} onChange={() => setScope('listed')} className="mt-1" />
            <span>This one and other occurrences I list below</span>
          </label>
        </div>
        {scope === 'listed' && (
          <input value={others} onChange={e => setOthers(e.target.value)} placeholder="occurrence ids, comma separated"
            className="mt-1.5 w-full bg-q-bg border border-q-border rounded px-2 py-1.5 text-sm text-gray-200" />
        )}
        <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
          Resolutions are occurrence-specific. <span className="font-mono text-gray-400">{item.token}</span> can mean
          different things in different drops, so resolving this one does not change the others.
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Contact <span className="text-gray-600">(optional)</span></label>
        <input value={contact} onChange={e => setContact(e.target.value)}
          className="w-full bg-q-bg border border-q-border rounded px-2 py-1.5 text-sm text-gray-200" />
      </div>

      {state === 'error' && <p className="text-xs text-rose-400">Could not send. Please try again.</p>}
      <div className="flex gap-2">
        <button onClick={send} disabled={state === 'sending' || !proposed.trim() || !reasoning.trim()}
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium">
          {state === 'sending' ? 'Sending…' : 'Submit suggestion'}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 rounded border border-q-border text-gray-400 hover:text-gray-200 text-sm">Cancel</button>
      </div>
    </div>
  )
}

export default function ResolutionCenter() {
  const [data, setData] = useState<QueueData | null>(null)
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get('item'))
  const token = params.get('token') ?? ''
  const [page, setPage] = useState(0)

  useEffect(() => { loadQueue().then(setData).catch(() => setData(null)) }, [])
  useEffect(() => { setPage(0) }, [token])

  const kind = params.get('kind') ?? ''
  const focusId = params.get('item')

  const rows = useMemo(() => {
    if (!data) return []
    let r = data.rows
    if (kind) r = r.filter(x => x.kind === kind)
    if (token) r = r.filter(x => x.token === token)
    // A deep link opens on the exact occurrence, not the top of the queue.
    if (focusId) {
      const hit = r.find(x => x.id === focusId)
      if (hit) return [hit, ...r.filter(x => x.id !== focusId)]
    }
    return r
  }, [data, token, kind, focusId])

  useEffect(() => { if (focusId) setOpenId(focusId) }, [focusId])

  const PAGE = 25
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)
  const topTokens = useMemo(
    () => Object.entries(data?.totals.byToken ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 30),
    [data],
  )

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <BackButton />
      <h1 className="text-2xl font-bold text-gray-100 mt-2">Resolution Center</h1>

      <div className="mt-3 rounded-lg border border-q-border bg-q-panel p-4">
        <p className="text-sm text-gray-300 leading-relaxed">
          Q Drops does not guess when the source text is ambiguous. This page contains unresolved
          references where the available context is not strong enough to make a confident
          identification. Community members may suggest resolutions by reviewing the original post
          and providing supporting context or sources. Suggestions do not alter the archive
          automatically; they are reviewed before being incorporated into certified data.
        </p>
        <p className="mt-2 text-xs text-gray-500 leading-relaxed">
          Community agreement is not certification. Suggestions stay separate until they are
          editorially approved and re-enter through the normal audit, QA and deploy process.
        </p>
        {data && (
          <p className="mt-2 text-xs text-gray-500">
            <span className="text-gray-300">{data.totals.occurrences.toLocaleString()}</span> unresolved
            occurrences across <span className="text-gray-300">{data.totals.tokens.toLocaleString()}</span> references.
          </p>
        )}
      </div>

      {data && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {data.statuses.map(st => (
            <div key={st} className={`rounded-lg border px-3 py-2 ${STATUS_STYLE[st] ?? 'border-q-border'}`}>
              <div className="text-lg font-bold leading-none">{(data.totals.byStatus?.[st] ?? 0).toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wide mt-1 opacity-80">{st.replace(/_/g, ' ').toLowerCase()}</div>
            </div>
          ))}
        </div>
      )}

      {data && data.kinds && (
        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 mr-1">Kind</span>
          <button onClick={() => { const n = new URLSearchParams(params); n.delete('kind'); setParams(n) }}
            className={`text-xs px-2 py-1 rounded border ${!kind ? 'bg-blue-600 text-white border-blue-500' : 'border-q-border text-gray-400 hover:text-gray-200'}`}>
            All
          </button>
          {data.kinds.map(k => {
            const n = data.totals.byKind?.[k] ?? 0
            return (
              <button key={k} disabled={!n}
                onClick={() => { const q = new URLSearchParams(params); q.set('kind', k); q.delete('item'); setParams(q) }}
                title={n ? undefined : 'No items of this kind yet — future audits will populate it'}
                className={`text-xs px-2 py-1 rounded border ${kind === k ? 'bg-blue-600 text-white border-blue-500' : n ? 'border-q-border text-gray-400 hover:text-gray-200' : 'border-q-border/40 text-gray-600 cursor-not-allowed'}`}>
                {k.replace(/_/g, ' ')} <span className="opacity-60">{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {!data && <p className="mt-6 text-sm text-gray-500">Loading the queue…</p>}

      {data && (
        <>
          <div className="mt-5 flex flex-wrap gap-1.5">
            <button onClick={() => setParams({})}
              className={`text-xs px-2 py-1 rounded border ${!token ? 'bg-blue-600 text-white border-blue-500' : 'border-q-border text-gray-400 hover:text-gray-200'}`}>
              All ({data.totals.occurrences.toLocaleString()})
            </button>
            {topTokens.map(([t, n]) => (
              <button key={t} onClick={() => setParams({ token: t })}
                className={`text-xs px-2 py-1 rounded border font-mono ${token === t ? 'bg-blue-600 text-white border-blue-500' : 'border-q-border text-gray-400 hover:text-gray-200'}`}>
                {t} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {shown.map(item => (
              <div key={item.id} className="rounded-lg border border-q-border bg-q-panel p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-amber-300">{item.token}</span>
                  <Link to={`/post/${item.postId}`} className="text-xs text-blue-400 hover:text-blue-300">#{item.postNum}</Link>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${STATUS_STYLE[item.status] ?? ''}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-2 rounded bg-black/30 p-2.5 font-mono text-xs text-gray-400 leading-relaxed">
                  {item.context.map((l, i) => (
                    <div key={i} className={l === item.sourceSpan ? 'text-gray-100' : ''}>{l}</div>
                  ))}
                </div>

                <p className="mt-2 text-xs text-gray-500 leading-relaxed">{item.whyUnresolved}</p>
                {item.provenance && <p className="mt-1 text-[11px] text-gray-600">Source: {item.provenance}</p>}
                {item.candidates.length > 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    <span className="text-gray-500">Readings already considered, none proven here: </span>
                    {item.candidates.join(' · ')}
                  </p>
                )}

                {openId === item.id
                  ? <SuggestForm item={item} onDone={() => setOpenId(null)} />
                  : (
                    <button onClick={() => setOpenId(item.id)}
                      className="mt-3 text-xs px-2.5 py-1 rounded border border-blue-600/50 text-blue-300 hover:bg-blue-600/10">
                      Suggest a resolution
                    </button>
                  )}
              </div>
            ))}
          </div>

          {rows.length > PAGE && (
            <div className="mt-4 flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border border-q-border text-sm text-gray-400 disabled:opacity-40">Previous</button>
              <span className="text-xs text-gray-500">
                {page * PAGE + 1}–{Math.min((page + 1) * PAGE, rows.length)} of {rows.length.toLocaleString()}
              </span>
              <button disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border border-q-border text-sm text-gray-400 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
