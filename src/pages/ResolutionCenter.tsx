import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { loadQueue, submitSuggestion, sentSubmissions, type QueueData, type QueueItem } from '../lib/resolution'
import { guideFor } from '../lib/resolutionKinds'
import ReaderSentinel from '../components/ReaderSentinel'

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

        <div className="font-medium">Thank you — this is queued for editorial review.</div>
        <div className="mt-1 text-xs text-emerald-300/80 leading-relaxed">
          It does not change the archive on its own. Accepted resolutions re-enter through the same
          path every certified figure took: audit → adjudication → materialise → QA gate → deploy.
          That is why nothing here can be changed by agreement alone.
        </div>
      </div>
    )
  }

  const guide = guideFor(item.kind)
  const choices = guide.choices?.(item) ?? []

  return (
    <div className="mt-3 rounded-lg border border-q-border bg-black/20 p-3 space-y-3">
      {/* What makes a submission adjudicable, said before the contributor writes it rather than
          discovered when it is rejected. */}
      <p className="text-xs text-gray-400 leading-relaxed">
        <span className="text-gray-300 font-medium">What counts as evidence here.</span>{' '}
        {guide.goodEvidence}
      </p>

      <div>
        <label className="block text-xs text-gray-400 mb-1">
          {guide.answerLooksLike} <span className="text-rose-400">*</span>
        </label>
        {/* The readings the audit already considered are offered as one click. Retyping
            "Barack Obama" to say "it is the obvious one" is friction with no purpose, and a
            free-text box invites spellings that no longer match the certified canonical name. */}
        {choices.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {choices.map(c => (
              <button key={c} type="button" onClick={() => setProposed(c)}
                className={`text-xs px-2 py-1 rounded border ${proposed === c
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'border-q-border text-gray-300 hover:text-white hover:border-blue-500/60'}`}>
                {c}
              </button>
            ))}
          </div>
        )}
        <input value={proposed} onChange={e => setProposed(e.target.value)} placeholder={guide.placeholder}
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
  const [sent, setSent] = useState<Record<string, { proposed: string; at: number }>>({})

  const kind = params.get('kind') ?? ''
  const focusId = params.get('item')
  const q = params.get('q') ?? ''
  const mine = params.get('mine') === '1'

  useEffect(() => { loadQueue().then(setData).catch(() => setData(null)) }, [])
  useEffect(() => { setSent(sentSubmissions()) }, [])
  // Any change to what is being filtered returns to the first page — otherwise a search from
  // page 4 lands on page 4 of the results and reads as "nothing found".
  useEffect(() => { setPage(0) }, [token, kind, q, mine])

  const rows = useMemo(() => {
    if (!data) return []
    let r = data.rows
    if (kind) r = r.filter(x => x.kind === kind)
    if (token) r = r.filter(x => x.token === token)
    // 2,527 items behind thirty token chips left most of the queue unreachable: an item whose
    // token was not in the top thirty could only be found by paging. Search covers the token,
    // the drop number, the quoted lines and the reason it is unresolved, because a contributor
    // arrives knowing one of those and rarely knows which.
    if (mine) r = r.filter(x => sent[x.id])
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      const num = needle.replace(/^#/, '')
      r = r.filter(x =>
        String(x.token).toLowerCase().includes(needle)
        || String(x.postNum) === num
        || x.context.some(l => l.toLowerCase().includes(needle))
        || String(x.whyUnresolved).toLowerCase().includes(needle)
        // Notes are searchable too — "susan rice" should find #559 even though the drop
        // never writes the name and the automated audit never proposed it.
        || String(x.ownerNote ?? '').toLowerCase().includes(needle))
    }
    // A deep link opens on the exact occurrence, not the top of the queue.
    if (focusId) {
      const hit = r.find(x => x.id === focusId)
      if (hit) return [hit, ...r.filter(x => x.id !== focusId)]
    }
    return r
  }, [data, token, kind, focusId, q, mine, sent])

  useEffect(() => { if (focusId) setOpenId(focusId) }, [focusId])

  // ALL of them, not 25 at a time — owner ruling 2026-08-15. The queue is a work list: paging it
  // hid how much was actually open and made a row you half-remembered impossible to find by
  // scrolling. Rows mount progressively as you scroll (a sentinel at the end), because 2,224 rows
  // rendered at once locks the tab — the same shape as the drop reader.
  const PAGE = 200
  const shown = rows.slice(0, page * PAGE + PAGE)
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

      {Object.keys(sent).length > 0 && (
        <div className="mt-3 rounded-lg border border-blue-600/40 bg-blue-500/5 px-3 py-2 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-blue-200">
            You have sent <span className="font-bold">{Object.keys(sent).length}</span>{' '}
            {Object.keys(sent).length === 1 ? 'suggestion' : 'suggestions'} from this browser.
          </span>
          <button
            onClick={() => { const n = new URLSearchParams(params); mine ? n.delete('mine') : n.set('mine', '1'); n.delete('item'); setParams(n) }}
            className={`text-xs px-2 py-1 rounded border ${mine ? 'bg-blue-600 text-white border-blue-500' : 'border-blue-600/50 text-blue-300 hover:bg-blue-600/10'}`}>
            {mine ? 'Show the whole queue' : 'Review what I sent'}
          </button>
          <span className="text-[11px] text-gray-500">
            Kept on this device only — the moderation store cannot be read back. Sent is not accepted.
          </span>
        </div>
      )}

      {/* Search first: it is the only way to reach an item whose token is not in the top thirty. */}
      {data && (
        <div className="mt-3">
          <input
            value={q}
            onChange={e => { const n = new URLSearchParams(params); e.target.value ? n.set('q', e.target.value) : n.delete('q'); n.delete('item'); setParams(n) }}
            placeholder="Search the queue — a reference, a drop number, or words from the post"
            className="w-full bg-q-bg border border-q-border rounded px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
          />
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
                title={n ? guideFor(k).asks : 'No items of this kind yet — future audits will populate it'}
                className={`text-xs px-2 py-1 rounded border ${kind === k ? 'bg-blue-600 text-white border-blue-500' : n ? 'border-q-border text-gray-400 hover:text-gray-200' : 'border-q-border/40 text-gray-600 cursor-not-allowed'}`}>
                {guideFor(k).label} <span className="opacity-60">{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {data && kind && (
        <p className="mt-2 text-xs text-gray-400 leading-relaxed">
          <span className="text-gray-300 font-medium">{guideFor(kind).label}:</span>{' '}
          {guideFor(kind).asks}
        </p>
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

          {rows.length === 0 && (
            <p className="mt-6 text-sm text-gray-500">
              Nothing matches{q ? ` “${q}”` : ''}{kind ? ` in ${guideFor(kind).label.toLowerCase()}` : ''}.{' '}
              <button className="text-blue-400 hover:text-blue-300" onClick={() => setParams({})}>Clear filters</button>
            </p>
          )}

          <div className="mt-4 space-y-3">
            {shown.map(item => (
              <div key={item.id} className="rounded-lg border border-q-border bg-q-panel p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-amber-300">{item.token}</span>
                  <Link to={`/post/${item.postId}`} className="text-xs text-blue-400 hover:text-blue-300">#{item.postNum}</Link>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${STATUS_STYLE[item.status] ?? ''}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-q-border text-gray-500 uppercase tracking-wide">
                    {guideFor(item.kind).label}
                  </span>
                  {/* An occurrence-specific queue needs occurrence-specific links, or a
                      contributor discussing one item elsewhere can only say "somewhere in BO". */}
                  {sent[item.id] && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-300 uppercase tracking-wide"
                      title={`You suggested “${sent[item.id].proposed}” on ${new Date(sent[item.id].at).toLocaleDateString()}. Awaiting editorial review.`}>
                      you suggested
                    </span>
                  )}
                  <button type="button" onClick={() => navigator.clipboard?.writeText(`${location.origin}/resolve?item=${encodeURIComponent(item.id)}`)}
                    className="ml-auto text-[10px] text-gray-500 hover:text-gray-300" title="Copy a link to this exact occurrence">
                    copy link
                  </button>
                </div>

                {/* MARK THE TOKEN BEING ASKED ABOUT. The context showed the drop's lines with the
                    source line merely brighter, so on a line like ">>HRC/BC [3] $15,000,000 Banco
                    de MEXICO" the reader still had to hunt for which two letters the question is
                    about. Word-boundary matched, so asking about "US" does not paint the "us"
                    inside "because" — the same rule the whole archive matches on. */}
                <div className="mt-2 rounded bg-black/30 p-2.5 font-mono text-xs text-gray-400 leading-relaxed">
                  {item.context.map((l, i) => {
                    const token = String(item.token ?? '').trim()
                    const isSource = l === item.sourceSpan
                    if (!token) return <div key={i} className={isSource ? 'text-gray-100' : ''}>{l}</div>
                    const rx = new RegExp(`(^|[^A-Za-z0-9])(${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![A-Za-z0-9])`, 'g')
                    const parts: (string | { hit: string })[] = []
                    let last = 0
                    for (const m of l.matchAll(rx)) {
                      const at = (m.index ?? 0) + m[1].length
                      if (at > last) parts.push(l.slice(last, at))
                      parts.push({ hit: m[2] })
                      last = at + m[2].length
                    }
                    parts.push(l.slice(last))
                    return (
                      <div key={i} className={isSource ? 'text-gray-100' : ''}>
                        {parts.map((part, j) => typeof part === 'string' ? <span key={j}>{part}</span> : (
                          <mark key={j} className="bg-amber-400/30 text-amber-100 rounded px-0.5 not-italic">{part.hit}</mark>
                        ))}
                      </div>
                    )
                  })}
                </div>

                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-500">Asked here: </span>{guideFor(item.kind).asks}
                </p>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">{item.whyUnresolved}</p>
                {/* The owner looked at this one and chose NOT to certify it. Shown above the
                    provenance line and visibly separated, so it is never mistaken for the
                    automated audit's reasoning underneath. */}
                {item.ownerNote && (
                  <p className="mt-2 rounded border-l-2 border-amber-400/50 bg-amber-400/5 py-1.5 pl-2.5 pr-2 text-xs leading-relaxed text-amber-100/80">
                    <span className="text-amber-300/90 uppercase tracking-wide text-[10px]">Owner note · left unresolved</span>
                    {item.ownerNotedOn && <span className="text-amber-300/50 text-[10px]"> · {item.ownerNotedOn}</span>}
                    <br />{item.ownerNote}
                  </p>
                )}
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

          {shown.length < rows.length && (
            <>
              {/* Scrolling is the request for more — no clicking through pages. */}
              <ReaderSentinel onEnter={() => setPage(p => p + 1)} />
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded border border-q-border text-sm text-gray-400 hover:text-white hover:border-gray-500">
                  + {Math.min(PAGE, rows.length - shown.length).toLocaleString()} more
                </button>
                <span className="text-xs text-gray-500">
                  showing {shown.length.toLocaleString()} of {rows.length.toLocaleString()}
                </span>
              </div>
            </>
          )}
          {shown.length === rows.length && rows.length > PAGE && (
            <p className="mt-4 text-xs text-gray-500">all {rows.length.toLocaleString()} shown</p>
          )}
        </>
      )}
    </div>
  )
}
