import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadRowEvidence, evidenceForRow, type EvidenceChip } from '../lib/rowEvidence'

// Supporting evidence beneath an analysis row: the pictures and links tied to its subject.
//
// Kept in its OWN labelled groups, never mixed into the certified post chips above. `#1254` is a
// drop in which Q wrote the term; `Pic #1254` is a photograph in that drop showing the subject.
// Merging them would turn an image into a statement, and would inflate a certified count that is
// adjudicated rather than computed. The badge above is untouched by anything rendered here.

const CHIPS = 24

function Group({
  label, icon, chips, term, focus, tone, linkParams,
}: {
  label: string
  icon: string
  chips: EvidenceChip[]
  term: string
  focus: 'pic' | 'url'
  tone: string
  linkParams: string
}) {
  const [open, setOpen] = useState(false)
  if (chips.length === 0) return null
  const shown = open ? chips : chips.slice(0, CHIPS)
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      <span className="text-[11px] text-gray-500 mr-1 shrink-0">{icon} {label}</span>
      {shown.map(c => (
        <Link
          key={c.postNum}
          to={`/post/${c.postNum}?flash=1&highlight=${encodeURIComponent(term)}${linkParams}&focus=${focus}`}
          title={c.reason}
          className={`text-xs px-1.5 py-0.5 rounded border font-mono transition-colors ${tone} ${
            c.direct ? '' : 'opacity-60'
          }`}
        >
          {icon}{focus === 'pic' ? 'Pic' : 'URL'} #{c.postNum}{c.count > 1 ? ` ×${c.count}` : ''}
        </Link>
      ))}
      {chips.length > CHIPS && (
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs px-2 py-0.5 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-mono"
        >
          {open ? '− show fewer' : `+${(chips.length - CHIPS).toLocaleString()} more`}
        </button>
      )}
    </div>
  )
}

export default function RowEvidenceChips({
  term, certifiedPosts, linkParams = '',
}: {
  term: string
  certifiedPosts: number[] | Set<number>
  /** The reader-view params this surface's CERTIFIED chips use (`&cat=…` or `&rk=…`). A Pic chip
      must land where a post chip lands — the reader feed for this row — or the two chips on one
      row open two different screens. */
  linkParams?: string
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => { let live = true; loadRowEvidence().then(() => { if (live) setReady(true) }); return () => { live = false } }, [])
  if (!ready || !term) return null
  const { pics, urls } = evidenceForRow(term, certifiedPosts)
  if (pics.length === 0 && urls.length === 0) return null
  return (
    <>
      <Group label="in pictures" icon="📷" chips={pics} term={term} focus="pic" linkParams={linkParams}
             tone="bg-teal-900/40 border-teal-700/50 text-teal-200 hover:border-teal-400" />
      <Group label="in links" icon="🔗" chips={urls} term={term} focus="url" linkParams={linkParams}
             tone="bg-blue-900/40 border-blue-700/50 text-blue-200 hover:border-blue-400" />
    </>
  )
}
