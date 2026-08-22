import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { search, type Filters, type Hit } from '../lib/search'

// Global search across every certified section.
//
// The archive had eight accurate sections and no way to ask a question that crossed them. This
// answers both halves at once: where a thing appears, and what certified analysis is attached
// to it — with every result stating WHY it matched, because a hit on an entity alias and a hit
// on Q's own wording are different claims about the text.
//
// Filters live in the URL so a result set can be shared, which matters for a research archive
// where the interesting output is often "look at this specific slice".

const SECTIONS = [
  { key: 'post', label: 'Post text' },
  { key: 'questions', label: 'Questions' },
  { key: 'directives', label: 'Directives' },
  { key: 'claims', label: 'Claims' },
  { key: 'predictions', label: 'Predictions' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'entities', label: 'Entities' },
  { key: 'sources', label: 'Sources' },
  { key: 'themes', label: 'Themes' },
  { key: 'codes', label: 'Codes' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'editorial', label: 'Editorial' },
]

const SECTION_STYLE: Record<string, string> = {
  post: 'text-gray-300 border-gray-600',
  questions: 'text-blue-300 border-blue-700',
  directives: 'text-violet-300 border-violet-700',
  claims: 'text-amber-300 border-amber-700',
  predictions: 'text-orange-300 border-orange-700',
  evidence: 'text-cyan-300 border-cyan-700',
  entities: 'text-emerald-300 border-emerald-700',
  // Sources are deliberately NOT emerald. A reader must be able to tell at a glance that a result
  // is where material came from, not a word Q wrote.
  sources: 'text-sky-300 border-sky-700',
  themes: 'text-teal-300 border-teal-700',
  codes: 'text-rose-300 border-rose-700',
  unresolved: 'text-blue-300 border-blue-600',
  editorial: 'text-gray-400 border-gray-600 border-dashed',
}

const TOGGLES: { key: keyof Filters; label: string; hint: string }[] = [
  { key: 'conclusion', label: 'Conclusions', hint: 'assertions the audit marked as conclusions' },
  { key: 'checkable', label: 'Checkable', hint: 'claims stated concretely enough to be checked — not claims that are true' },
  { key: 'sourceProvided', label: 'Source provided', hint: 'the drop points at something a reader can follow' },
  { key: 'unresolvedOnly', label: 'Unresolved only', hint: 'items deliberately left undecided' },
]

export default function Search() {
  const [params, setParams] = useSearchParams()
  const [result, setResult] = useState<{ hits: Hit[]; total: number; bySection: Record<string, number> } | null>(null)
  const [busy, setBusy] = useState(false)

  const q = params.get('q') ?? ''
  const sections = params.get('s')?.split(',').filter(Boolean) ?? []

  const filters = useMemo<Filters>(() => ({
    sections,
    postNum: params.get('post') ? Number(params.get('post')) : undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    entityType: params.get('etype') || undefined,
    theme: params.get('theme') || undefined,
    family: params.get('family') || undefined,
    subtype: params.get('subtype') || undefined,
    codeType: params.get('codetype') || undefined,
    conclusion: params.get('conclusion') === '1',
    checkable: params.get('checkable') === '1',
    sourceProvided: params.get('source') === '1',
    unresolvedOnly: params.get('unresolved') === '1',
  }), [params])

  useEffect(() => {
    const hasFilter = q.trim() || sections.length || [...params.keys()].some(k => k !== 'q' && k !== 's')
    if (!hasFilter) { setResult(null); return }
    setBusy(true)
    let live = true
    search(q, filters).then(r => { if (live) { setResult(r); setBusy(false) } })
      .catch(() => { if (live) { setResult(null); setBusy(false) } })
    return () => { live = false }
  }, [q, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(params)
    v ? n.set(k, v) : n.delete(k)
    setParams(n)
  }
  const toggleSection = (k: string) => {
    const next = sections.includes(k) ? sections.filter(x => x !== k) : [...sections, k]
    set('s', next.join(',') || null)
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <BackButton />
      <h1 className="text-2xl font-bold text-gray-100 mt-2">Search</h1>
      <p className="mt-1 text-sm text-gray-500">
        Across the drops and every certified section. Each result says why it matched.
      </p>

      <input
        autoFocus
        value={q}
        onChange={e => set('q', e.target.value || null)}
        placeholder="A phrase, a name, a code, a domain, a drop number…"
        className="mt-3 w-full bg-q-bg border border-q-border rounded px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-600"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => toggleSection(s.key)}
            className={`text-xs px-2 py-1 rounded border ${sections.includes(s.key)
              ? 'bg-blue-600 text-white border-blue-500'
              : `${SECTION_STYLE[s.key] ?? 'text-gray-400 border-q-border'} hover:text-white`}`}>
            {s.label}
            {result?.bySection[s.key] ? <span className="opacity-60 ml-1">{result.bySection[s.key]}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 items-center">
        {TOGGLES.map(t => (
          <button key={String(t.key)} title={t.hint}
            onClick={() => set(t.key === 'sourceProvided' ? 'source' : t.key === 'unresolvedOnly' ? 'unresolved' : String(t.key),
              filters[t.key] ? null : '1')}
            className={`text-xs px-2 py-1 rounded border ${filters[t.key]
              ? 'bg-blue-600 text-white border-blue-500' : 'border-q-border text-gray-400 hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
        <input type="number" placeholder="Drop #" value={params.get('post') ?? ''}
          onChange={e => set('post', e.target.value || null)}
          className="w-24 bg-q-bg border border-q-border rounded px-2 py-1 text-xs text-gray-200" />
        <input type="date" value={params.get('from') ?? ''} onChange={e => set('from', e.target.value || null)}
          className="bg-q-bg border border-q-border rounded px-2 py-1 text-xs text-gray-400" />
        <span className="text-xs text-gray-600">to</span>
        <input type="date" value={params.get('to') ?? ''} onChange={e => set('to', e.target.value || null)}
          className="bg-q-bg border border-q-border rounded px-2 py-1 text-xs text-gray-400" />
        {[...params.keys()].length > 0 && (
          <button onClick={() => setParams({})} className="text-xs text-blue-400 hover:text-blue-300">Clear</button>
        )}
      </div>

      {busy && <p className="mt-6 text-sm text-gray-500 animate-pulse">Searching…</p>}

      {!busy && result && (
        <>
          <p className="mt-4 text-sm text-gray-400">
            <span className="text-gray-200 font-semibold">{result.total.toLocaleString()}</span> result{result.total === 1 ? '' : 's'}
            {result.total > result.hits.length && <span className="text-gray-600"> · showing the first {result.hits.length}</span>}
          </p>

          <div className="mt-3 space-y-2">
            {result.hits.map((h, i) => (
              <div key={i} className="rounded-lg border border-q-border bg-q-panel p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${SECTION_STYLE[h.row.s] ?? ''}`}>
                    {SECTIONS.find(s => s.key === h.row.s)?.label ?? h.row.s}
                  </span>
                  {h.row.p != null && h.row.i && (
                    <Link to={`/post/${h.row.i}`} className="text-xs text-blue-400 hover:text-blue-300">#{h.row.p}</Link>
                  )}
                  <span className="text-[11px] text-gray-500">matched on {h.matchedOn}</span>
                  {h.row.s === 'unresolved' && h.row.f.itemId != null && (
                    <Link to={`/resolve?item=${encodeURIComponent(String(h.row.f.itemId))}`}
                      className="text-[11px] text-blue-400 hover:text-blue-300">help resolve →</Link>
                  )}
                </div>

                {/* An editorial row can never be shown as Q's wording. The label comes first, and
                    Q's own source wording is shown beneath it wherever the audit recorded it. */}
                {h.row.q === false ? (
                  <div className="mt-1.5">
                    <div className="text-[11px] text-amber-400/90">Editorial normalisation — not Q’s literal wording</div>
                    <div className="text-sm text-gray-400 italic">{h.row.t}</div>
                    {h.row.src && (
                      <div className="mt-1 text-xs text-gray-300">
                        <span className="text-gray-500">Q’s source wording: </span>{h.row.src}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-gray-200 whitespace-pre-wrap break-words">{h.row.t}</p>
                )}

                <p className="mt-1 text-[11px] text-gray-500">{h.row.w}</p>
              </div>
            ))}
          </div>

          {result.total === 0 && (
            <p className="mt-6 text-sm text-gray-500">
              Nothing matched. Try fewer filters, or search the drops themselves with the Post text section on.
            </p>
          )}
        </>
      )}

      {!busy && !result && (
        <p className="mt-6 text-sm text-gray-500">
          Search the drops and every certified layer at once — Q’s wording, questions, directives,
          claims, references, entities and their aliases, linked sources, themes, codes, and the items
          deliberately left unresolved.
        </p>
      )}
    </div>
  )
}
