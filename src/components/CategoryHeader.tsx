import { useId, useState, type ReactNode } from 'react'

/**
 * THE STICKY HEADER OF A CATEGORY PAGE, SIZED FOR THE SCREEN IT IS ON.
 *
 * On a desktop the totals, the title and the provenance line are worth their space: they are the
 * first thing that tells you what you are looking at and how it was counted.
 *
 * On a phone they are the whole screen. Q Questions opens with two 2xl figures, a heading, a
 * repeated/asked-once line, three status chips and a keyword panel before the search box — so the
 * one control a reader on a phone actually came for is below the fold, and reaching it means
 * scrolling past the numbers every single time.
 *
 * So on phone widths the detail area starts COLLAPSED and the search box sits directly under a
 * one-line summary. Nothing is removed: a real button expands the same block, and the desktop
 * layout is untouched.
 *
 * WHY THE VISIBILITY IS CSS AND THE STATE IS NOT
 * ──────────────────────────────────────────────
 * `hidden md:block` means the desktop never depends on the toggle at all — no media query in JS,
 * no width measured at mount, no flash of a collapsed header on a wide screen during hydration,
 * and no way for a future refactor of the breakpoint to leave desktop readers with a collapsed
 * header. The button itself is `md:hidden`, so a desktop reader is never offered a control that
 * would do nothing. `open` only ever adds visibility on small screens.
 *
 * ACCESSIBILITY IS NOT DECORATION HERE. The toggle is a real <button> carrying aria-expanded and
 * aria-controls pointing at the region it owns, with an aria-label naming the section rather than
 * the generic word "Details" — a screen-reader user landing on four of these pages should not
 * hear the same anonymous control four times.
 */
interface Props {
  /** Section name, used in the toggle's accessible label — e.g. "Q Questions". */
  section: string
  /** One line that survives collapse: enough to know where you are. Rendered on phones only. */
  summary: ReactNode
  /** Totals, title and provenance. Always visible on desktop, collapsed by default on phones. */
  details: ReactNode
  /** The search box. Visible at every width, and always directly reachable. */
  search: ReactNode
  /** Filter or sort controls that belong beside the search rather than inside the details. */
  controls?: ReactNode
}

export default function CategoryHeader({ section, summary, details, search, controls }: Props) {
  const [open, setOpen] = useState(false)
  const regionId = useId()

  return (
    <>
      {/* Phone-only: the compact identity line and the control that opens the rest. */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <div className="min-w-0 flex-1">{summary}</div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls={regionId}
          aria-label={open
            ? `Hide ${section} statistics and provenance`
            : `Show ${section} statistics and provenance`}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-q-border bg-q-panel px-2.5 py-1 text-xs font-medium text-gray-400 transition-colors hover:border-gray-500 hover:text-white focus:outline-none focus:border-q-accent"
        >
          Details
          <span aria-hidden="true" className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>
      </div>

      <div id={regionId} className={`${open ? 'block' : 'hidden'} md:block space-y-3`}>
        {details}
      </div>

      {search}
      {controls}
    </>
  )
}
