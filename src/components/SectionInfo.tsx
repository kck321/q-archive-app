import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SECTION_BY_ID } from '../lib/sectionInfo'

/**
 * "About this section" — the ⓘ next to a section heading.
 *
 * Text comes from lib/sectionInfo so the blurb here and the Classification Method page cannot
 * drift apart. A user who wants to know why "Define X." shows up in two sections should get the
 * same answer wherever they ask.
 */
export default function SectionInfo({ id, className = '' }: { id: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const info = SECTION_BY_ID.get(id)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (!info) return null

  return (
    <span ref={wrap} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`About ${info.title}`}
        title={`About ${info.title}`}
        className="w-5 h-5 rounded-full border border-gray-600 text-gray-400 hover:text-blue-300 hover:border-blue-500 text-[11px] font-bold leading-none flex items-center justify-center transition-colors"
      >
        i
      </button>

      {open && (
        // Fixed max width + its own scroll so a long definition can never push the page wide
        // on a phone — the body must not scroll horizontally.
        <span
          role="dialog"
          className="absolute z-50 left-0 top-7 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-lg border border-q-border bg-q-panel shadow-xl p-4 text-left font-normal normal-case tracking-normal"
        >
          <span className="block text-sm font-semibold text-gray-200">{info.title}</span>
          <span className="block mt-1 text-xs text-gray-400 leading-relaxed">{info.covers}</span>

          {info.examples && (
            <span className="block mt-2">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Examples</span>
              {info.examples.map(ex => (
                <span key={ex} className="block text-xs text-gray-300 font-mono leading-relaxed">{ex}</span>
              ))}
            </span>
          )}

          {info.answers && (
            <span className="block mt-2 text-xs text-gray-300">
              <span className="text-gray-500">Answers: </span>“{info.answers}”
            </span>
          )}

          {info.note && <span className="block mt-2 text-xs text-gray-500 leading-relaxed">{info.note}</span>}

          {info.certified && (
            <span className="block mt-2 pt-2 border-t border-q-border text-[11px] text-gray-400">
              <span className="text-emerald-500">Certified:</span> {info.certified}
            </span>
          )}

          <Link
            to="/method"
            onClick={() => setOpen(false)}
            className="block mt-3 text-xs text-blue-400 hover:text-blue-300"
          >
            How classification works →
          </Link>
        </span>
      )}
    </span>
  )
}
