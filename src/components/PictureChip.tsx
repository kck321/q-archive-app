import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPictureAnalysis, getPictureInfoSync, type PictureInfo } from '../lib/pictureAnalysis'

/**
 * The "Picture" chip under an analysed image.
 *
 * Collapsed: a single chip with a confidence dot (green = subject identified, yellow =
 * partly identified / location inferred, red = subject could not be identified).
 * Expanded: the full analysis — description, the exact text visible in the image,
 * people / organizations / objects / places, extra search terms, and any claim flags.
 * Every listed item links into the Post Archive search so a reader can pivot from
 * what is IN the picture to every drop that mentions it.
 */

const DOT: Record<PictureInfo['confidence'], string> = {
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
}

const DOT_TITLE: Record<PictureInfo['confidence'], string> = {
  green: 'Identified with confidence',
  yellow: 'Partly identified — see notes',
  red: 'Subject not identified',
}

function TermLinks({ label, items, className }: { label: string; items: string[]; className: string }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[11px] text-gray-500 mr-0.5">{label}:</span>
      {items.map(t => (
        <Link key={t} to={`/posts?q=${encodeURIComponent(t)}`}
          onClick={e => e.stopPropagation()}
          className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors hover:brightness-125 ${className}`}>
          {t}
        </Link>
      ))}
    </div>
  )
}

export default function PictureChip({ url }: { url: string | undefined | null }) {
  const [info, setInfo] = useState<PictureInfo | null>(() => getPictureInfoSync(url))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!info) {
      loadPictureAnalysis().then(() => {
        if (!cancelled) setInfo(getPictureInfoSync(url))
      })
    }
    return () => { cancelled = true }
  }, [url])

  if (!info) return null

  return (
    <div className="mt-1.5">
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        title={info.needsReview ? 'Flagged for manual review — analysis incomplete' : DOT_TITLE[info.confidence]}
        className={`text-xs border px-2 py-0.5 rounded flex items-center gap-1.5 font-medium transition-colors ${
          open
            ? 'bg-teal-800/60 text-teal-100 border-teal-500/70'
            : 'bg-teal-900/40 text-teal-300 border-teal-700/50 hover:bg-teal-800/50 hover:text-teal-200'
        }`}
      >
        📷 Picture
        {info.needsReview ? (
          // TWO red dots = flagged for the owner's manual review queue (incomplete analysis),
          // distinct from one red dot = analysed but subject unidentified.
          <span className="flex items-center gap-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          </span>
        ) : (
          <span className={`inline-block w-2 h-2 rounded-full ${DOT[info.confidence]}`} />
        )}
        <span className="text-teal-500/80">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="mt-1.5 bg-black/30 border border-teal-800/50 rounded-lg p-3 space-y-2 text-left"
          onClick={e => e.stopPropagation()}>
          <p className="text-xs text-gray-300">
            <span className="text-teal-400 font-semibold">{info.kind}</span>
            <span className="text-gray-500"> · confidence </span>
            <span className={info.confidence === 'green' ? 'text-green-400' : info.confidence === 'yellow' ? 'text-yellow-300' : 'text-red-400'}>
              {info.confidence}
            </span>
            {info.needsReview && (
              <span className="ml-2 text-red-400 font-semibold">🔴🔴 needs manual review</span>
            )}
          </p>
          <p className="text-xs text-gray-300 leading-relaxed">{info.description}</p>

          {info.text && (
            <div>
              <p className="text-[11px] text-gray-500 mb-0.5">Text visible in the image:</p>
              <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words bg-black/30 rounded p-2 max-h-40 overflow-y-auto">{info.text}</pre>
            </div>
          )}

          <TermLinks label="People" items={info.people} className="bg-cyan-500/15 text-cyan-200 border-cyan-700/50" />
          <TermLinks label="Organizations" items={info.orgs} className="bg-indigo-500/15 text-indigo-200 border-indigo-700/50" />
          <TermLinks label="Places" items={info.places} className="bg-emerald-500/15 text-emerald-200 border-emerald-700/50" />
          <TermLinks label="Objects" items={info.objects} className="bg-slate-500/15 text-slate-200 border-slate-600/50" />
          <TermLinks label="Search terms" items={info.terms} className="bg-teal-500/15 text-teal-200 border-teal-700/50" />

          {info.flags.length > 0 && (
            <div className="border-t border-gray-800 pt-1.5">
              {info.flags.map(f => (
                <p key={f} className="text-[11px] text-amber-300/90">⚠ {f}</p>
              ))}
            </div>
          )}

          {info.posts.length > 1 && (
            <p className="text-[11px] text-gray-500">
              Also appears in:{' '}
              {info.posts.map(p => (
                <Link key={`${p.num}-${p.source}`} to={`/post/${p.num}?flash=1`} className="text-blue-400 hover:underline mr-1.5">
                  #{p.num}
                </Link>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
