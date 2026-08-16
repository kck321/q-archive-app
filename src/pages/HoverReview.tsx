// The PRIVATE Resolution Center for entity hover synopses.
//
// 3,144 unreviewed readings about named people, plus 441 quarantined URL-derived occurrences.
// None of it is in the public bundle and none of it can be: the data is served from audit/ by a
// dev-only Vite middleware, so `npm run deploy:web` has nothing to copy into dist/. That is the
// enforcement — not a permission check that could be bypassed, but bytes that are not there.
//
// This page is CAN_EDIT-gated as well, so it is compiled out of the public bundle entirely rather
// than hidden at runtime. Both halves matter: the gate keeps the UI out, the middleware keeps the
// DATA out, and either alone would be a single point of failure.
//
// DECISIONS ARE NOT WRITES. Firestore denies every write outside feedback/create, and a certified
// artifact may never be edited from a browser anyway — the chain is ruling -> canonical artifact
// -> materialiser -> QA -> apply -> deploy. So a decision here is recorded locally with its full
// audit trail and exported as a rulings file for that chain to consume.
import { useEffect, useMemo, useState } from 'react'
import BackButton from '../components/BackButton'
import { CAN_EDIT } from '../lib/appMode'

type Verdict = 'approve' | 'edit-approve' | 'hold' | 'reject' | 'reclassify'

interface ReviewRecord {
  entityId: string
  postNum: number
  auditOccurrenceId: string
  matchedAlias: string
  localRole: string
  synopsis: string
  contextSupport: string
  evidenceConfidence: string
  evidenceBasis: string
  sourceContext: string
  status: string
  verdictReason: string
  canonical: string | null
  entityType: string | null
  aliases: string[]
  globalSynopsis: string | null
  sharedAlias?: boolean
  sharedAliasOwners?: string[]
  registryCorrected?: boolean
  urlDerived?: boolean
  urlClass?: string
}

interface Decision {
  id: string
  verdict: Verdict
  editor: string
  at: string
  previous: string
  next: string
  reason: string
}

const STORE = 'qdrops.hoverReview.decisions'
const EDITOR = 'qdrops.hoverReview.editor'

const loadDecisions = (): Record<string, Decision> => {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') } catch { return {} }
}

const VERDICTS: { key: Verdict; label: string; hint: string }[] = [
  { key: 'approve', label: 'Approve', hint: 'publish this synopsis as written' },
  { key: 'edit-approve', label: 'Edit and approve', hint: 'publish the edited text' },
  { key: 'hold', label: 'Hold', hint: 'keep it queued — not decided yet' },
  { key: 'reject', label: 'Reject', hint: 'never publish this reading' },
  { key: 'reclassify', label: 'Reclassify', hint: 'the entity or reading is wrong; send it back to the registry' },
]

export default function HoverReview() {
  // Compiled out of the public bundle. The import is folded to a literal false, so Rollup drops
  // everything below it rather than shipping a hidden page.
  if (!CAN_EDIT) return null

  const [queue, setQueue] = useState<'hover-review' | 'hover-url-quarantine' | 'hover-withdrawn'>('hover-review')
  const [records, setRecords] = useState<ReviewRecord[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<string, Decision>>(loadDecisions)
  const [editor, setEditor] = useState(() => localStorage.getItem(EDITOR) ?? '')
  const [q, setQ] = useState('')
  const [grade, setGrade] = useState('')
  const [type, setType] = useState('')
  const [flag, setFlag] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    setRecords(null); setErr(null)
    fetch(`/editorial/${queue}.json`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status} — run: node scripts/extract-entity-hovers.mjs`)))
      .then(j => setRecords(j.records ?? []))
      .catch(e => setErr(String(e.message ?? e)))
  }, [queue])

  const record = (rec: ReviewRecord, verdict: Verdict, next: string) => {
    if (!editor.trim()) { alert('Enter your name first — a decision with no editor is not an audit trail.'); return }
    const d: Decision = {
      id: rec.auditOccurrenceId, verdict, editor: editor.trim(), at: new Date().toISOString(),
      previous: rec.synopsis, next, reason: reason.trim(),
    }
    const all = { ...decisions, [rec.auditOccurrenceId]: d }
    setDecisions(all)
    localStorage.setItem(STORE, JSON.stringify(all))
    localStorage.setItem(EDITOR, editor.trim())
    setOpenId(null); setDraft(''); setReason('')
  }

  const exportDecisions = () => {
    const body = JSON.stringify({
      note: 'Editorial decisions on entity hover synopses. Feed to the apply chain; nothing here has touched a certified artifact.',
      exportedAt: new Date().toISOString(),
      total: Object.keys(decisions).length,
      decisions: Object.values(decisions),
    }, null, 1)
    // Shown for copying rather than downloaded: a download inside the sandboxed viewer is inert,
    // and this file has to end up in audit/ under version control anyway.
    navigator.clipboard?.writeText(body)
    alert(`${Object.keys(decisions).length} decision(s) copied to the clipboard.\n\nSave as audit/entity-hover-decisions.json and run the apply chain.`)
  }

  const types = useMemo(() => [...new Set((records ?? []).map(r => r.entityType).filter(Boolean))].sort() as string[], [records])

  const shown = useMemo(() => (records ?? []).filter(r => {
    if (grade && r.contextSupport !== grade) return false
    if (type && r.entityType !== type) return false
    if (flag === 'url' && !r.urlDerived && !r.urlClass) return false
    if (flag === 'shared' && !r.sharedAlias) return false
    if (flag === 'registry' && !r.registryCorrected) return false
    if (flag === 'undecided' && decisions[r.auditOccurrenceId]) return false
    if (q) {
      const hay = `${r.canonical} ${r.matchedAlias} ${r.postNum} ${r.synopsis} ${r.verdictReason}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  }), [records, grade, type, flag, q, decisions])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <BackButton />
      <h1 className="mt-2 text-xl font-semibold text-gray-100">Hover review — private</h1>
      <p className="mt-1 text-xs leading-relaxed text-gray-400">
        Editorial only. This data is served from <code className="text-gray-300">audit/</code> by the dev server and is
        not in the public bundle — the published site has no copy of it to serve. No record here reaches a reader
        without an explicit decision below.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(['hover-review', 'hover-url-quarantine', 'hover-withdrawn'] as const).map(k => (
          <button key={k} onClick={() => setQueue(k)}
            className={`rounded border px-2 py-1 text-xs ${queue === k ? 'border-blue-500 bg-blue-600 text-white' : 'border-q-border text-gray-400 hover:text-gray-200'}`}>
            {k === 'hover-review' ? 'Review' : k === 'hover-url-quarantine' ? 'URL-derived' : 'Withdrawn'}
          </button>
        ))}
        <input value={editor} onChange={e => setEditor(e.target.value)} placeholder="your name (for the audit trail)"
          className="ml-auto w-52 rounded border border-q-border bg-transparent px-2 py-1 text-xs text-gray-200" />
        <button onClick={exportDecisions} className="rounded border border-q-border px-2 py-1 text-xs text-gray-300 hover:text-white">
          Export {Object.keys(decisions).length} decision(s)
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="search entity, alias, post, text"
          className="w-64 rounded border border-q-border bg-transparent px-2 py-1 text-xs text-gray-200" />
        <select value={grade} onChange={e => setGrade(e.target.value)} className="rounded border border-q-border bg-[#11151c] px-2 py-1 text-xs text-gray-300">
          <option value="">any evidence grade</option><option>Strong</option><option>Partial</option><option>Insufficient</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className="rounded border border-q-border bg-[#11151c] px-2 py-1 text-xs text-gray-300">
          <option value="">any entity type</option>{types.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={flag} onChange={e => setFlag(e.target.value)} className="rounded border border-q-border bg-[#11151c] px-2 py-1 text-xs text-gray-300">
          <option value="">no extra filter</option>
          <option value="url">URL-derived</option>
          <option value="shared">shared alias</option>
          <option value="registry">registry-corrected</option>
          <option value="undecided">not yet decided</option>
        </select>
      </div>

      {err && <p className="mt-4 text-sm text-rose-300">{err}</p>}
      {!records && !err && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
      {records && <p className="mt-3 text-xs text-gray-500">{shown.length.toLocaleString()} of {records.length.toLocaleString()} shown</p>}

      <div className="mt-2 space-y-3">
        {shown.slice(0, 200).map(r => {
          const d = decisions[r.auditOccurrenceId]
          const open = openId === r.auditOccurrenceId
          return (
            <div key={r.auditOccurrenceId} className="rounded border border-q-border bg-q-panel p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-bold text-amber-300">{r.matchedAlias}</span>
                <span className="text-gray-400">→ {r.canonical}</span>
                <span className="rounded border border-q-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">{r.entityType}</span>
                <a href={`/post/${r.postNum}`} className="text-blue-400 hover:text-blue-300">#{r.postNum}</a>
                {/* The permanent id, shown because it is the key everything downstream uses. An
                    editor quoting a decision needs the handle that survives a rename, not the
                    display name that does not. */}
                <code className="text-[10px] text-gray-600">{r.entityId}</code>
                <span className={`text-[10px] ${r.contextSupport === 'Strong' ? 'text-emerald-300/80' : r.contextSupport === 'Partial' ? 'text-amber-300/80' : 'text-gray-400'}`}>
                  {r.contextSupport} / {r.evidenceConfidence}
                </span>
                {r.sharedAlias && <span className="rounded border border-fuchsia-500/40 px-1.5 py-0.5 text-[10px] text-fuchsia-300">shared alias</span>}
                {r.urlClass && <span className="rounded border border-cyan-500/40 px-1.5 py-0.5 text-[10px] text-cyan-300">{r.urlClass}</span>}
                {r.registryCorrected && <span className="rounded border border-blue-500/40 px-1.5 py-0.5 text-[10px] text-blue-300">registry-corrected</span>}
                {d && <span className="ml-auto rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">{d.verdict} · {d.editor}</span>}
              </div>

              <p className="mt-2 text-[11px] text-gray-500">why it is here: {r.verdictReason}</p>
              {r.sharedAliasOwners && <p className="text-[11px] text-fuchsia-300/70">“{r.matchedAlias}” also belongs to: {r.sharedAliasOwners.filter(c => c !== r.canonical).join(', ')}</p>}

              <div className="mt-2 rounded bg-black/30 p-2">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">occurrence in the drop</div>
                <div className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-300">{r.sourceContext}</div>
              </div>

              {r.globalSynopsis && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">proposed stable synopsis</div>
                  <div className="text-[11px] leading-relaxed text-gray-300">{r.globalSynopsis}</div>
                </div>
              )}
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">proposed post-specific synopsis</div>
                <div className="text-[11px] leading-relaxed text-gray-200">{r.synopsis}</div>
              </div>
              <p className="mt-1 text-[10px] text-gray-500">aliases: {r.aliases.join(', ')}</p>

              {!open ? (
                <button onClick={() => { setOpenId(r.auditOccurrenceId); setDraft(r.synopsis); setReason('') }}
                  className="mt-2 rounded border border-q-border px-2 py-1 text-xs text-gray-300 hover:text-white">
                  {d ? 'Change decision' : 'Decide'}
                </button>
              ) : (
                <div className="mt-2 space-y-2">
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
                    className="w-full rounded border border-q-border bg-transparent p-2 text-[11px] text-gray-200" />
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="reason (recorded in the audit trail)"
                    className="w-full rounded border border-q-border bg-transparent px-2 py-1 text-xs text-gray-200" />
                  <div className="flex flex-wrap gap-1.5">
                    {VERDICTS.map(v => (
                      <button key={v.key} title={v.hint}
                        onClick={() => record(r, v.key, v.key === 'edit-approve' ? draft : r.synopsis)}
                        className="rounded border border-q-border px-2 py-1 text-xs text-gray-300 hover:border-blue-500 hover:text-white">
                        {v.label}
                      </button>
                    ))}
                    <button onClick={() => setOpenId(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-300">cancel</button>
                  </div>
                </div>
              )}

              {d && (
                <p className="mt-2 border-t border-q-border/60 pt-1.5 text-[10px] text-gray-500">
                  {d.editor} · {new Date(d.at).toLocaleString()} · {d.verdict}
                  {d.reason ? ` · ${d.reason}` : ''}
                  {d.next !== d.previous ? ' · text edited' : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>
      {shown.length > 200 && <p className="mt-3 text-xs text-gray-500">Showing the first 200. Narrow the filters to reach the rest.</p>}
    </div>
  )
}
