// The one accessible disclosure primitive. Entities use it now; Brackets will use it next.
//
// WHY A SHARED PRIMITIVE. The reader's info box already existed and worked well on a mouse, but
// it was reachable only by hovering or tapping: no keyboard focus, no outside-click dismissal, no
// ARIA relationship, and its Escape handler was added to `document` on every open and never
// removed, so the listeners accumulated for as long as the page stayed up. Fixing that in place
// would have fixed it for Entities alone, and Brackets would have grown a second copy with the
// same gaps — which is how the alias registries ended up disagreeing.
//
// WHAT ACCESSIBLE MEANS HERE, concretely:
//   mouse         hover opens, leaving closes
//   keyboard      the trigger is focusable and opens on focus; Escape closes and returns focus
//   touch/click   tap toggles; a second tap anywhere else closes
//   screen reader the trigger is a button describing itself, the card is aria-describedby it,
//                 and the card announces politely rather than interrupting
//   viewport      the card is clamped to the screen in both axes and never covers its own anchor
//
// THE CARD MUST NOT HIDE THE PASSAGE IT EXPLAINS. A tooltip that covers the sentence it is about
// forces the reader to choose between the words and the explanation. It opens above by default,
// flips below when there is no room above, and on a narrow screen it is pinned to the bottom of
// the viewport where it can never sit on top of the line being read.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const MARGIN = 8
/** Below this width the card is pinned rather than floated. Matches Tailwind's `sm`. */
const NARROW = 640

export function HoverCard({
  children, card, label, className = '',
}: {
  /** The trigger content — the word in the drop. */
  children: ReactNode
  /** The card body. Rendered only while open. */
  card: ReactNode
  /** What a screen reader announces for the trigger, e.g. 'POTUS — more information'. */
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; pinned: boolean; maxHeight?: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  const close = useCallback((refocus = false) => {
    setOpen(false)
    setPos(null)
    if (refocus) triggerRef.current?.focus()
  }, [])

  // ── dismissal ──────────────────────────────────────────────────────────────
  // Every listener is registered on open and removed on close. The previous implementation added
  // a keydown handler with an inline arrow function, which cannot be removed and therefore never
  // was — one more dead listener per box the reader opened.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(true) } }
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || cardRef.current?.contains(t)) return
      close()
    }
    // A fixed card has to close when the page moves under it, or it detaches from its word.
    const onMove = () => close()
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onOutside, true)
    document.addEventListener('touchstart', onOutside, true)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onOutside, true)
      document.removeEventListener('touchstart', onOutside, true)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, close])

  // ── placement ──────────────────────────────────────────────────────────────
  // Positioned against the VIEWPORT, not the paragraph: the post body sits inside a <pre> with its
  // own overflow, so an absolutely-positioned card is clipped by that ancestor however it is
  // offset. Both axes are clamped unconditionally — preferring "above" and trusting it still
  // overflowed whenever the anchor itself was below the fold.
  useLayoutEffect(() => {
    if (!open) return
    const a = triggerRef.current?.getBoundingClientRect()
    const b = cardRef.current?.getBoundingClientRect()
    if (!a || !b) return
    if (window.innerWidth < NARROW) { setPos({ left: MARGIN, top: window.innerHeight - b.height - MARGIN, pinned: true }); return }
    const left = Math.max(MARGIN, Math.min(a.left + a.width / 2 - b.width / 2, window.innerWidth - b.width - MARGIN))

    // PICK THE SIDE BY THE ROOM IT HAS, THEN LIMIT THE HEIGHT TO FIT IT.
    //
    // The obvious version — prefer above, fall back to below, then clamp into the viewport —
    // fails at the bottom of the page: "below" is chosen, the clamp pulls the card back up to stay
    // on screen, and it lands squarely on top of the word it is explaining. The reader can see the
    // explanation or the sentence, never both. Clamping cannot fix that, because the clamp is what
    // causes it.
    //
    // So the space is measured first. The card goes wherever it actually fits, and when neither
    // side can hold it whole it takes the roomier side and scrolls inside a bounded height —
    // which keeps the anchor visible in every case rather than in most of them.
    const GAP = 6
    const spaceAbove = a.top - MARGIN - GAP
    const spaceBelow = window.innerHeight - a.bottom - MARGIN - GAP
    let top: number
    let maxHeight: number | undefined
    if (b.height <= spaceAbove) top = a.top - b.height - GAP
    else if (b.height <= spaceBelow) top = a.bottom + GAP
    else if (spaceAbove >= spaceBelow) { maxHeight = spaceAbove; top = MARGIN }
    else { maxHeight = spaceBelow; top = a.bottom + GAP }
    setPos({ left, top, pinned: false, maxHeight })
  }, [open, card])

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        // A real button, so it is in the tab order and announced as operable without any extra
        // wiring. Styled to disappear into the prose — it is a word in a drop, not a control.
        className={`cursor-help appearance-none border-0 bg-transparent p-0 text-left font-[inherit] text-[inherit] leading-[inherit] ${className}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o) }}
      >
        {children}
      </button>
      {open && (
        <span
          ref={cardRef}
          id={id}
          role="tooltip"
          // Polite, not assertive: this is supplementary reading, and it must never cut across
          // whatever the reader is already being told.
          aria-live="polite"
          style={pos?.pinned
            ? { visibility: 'visible', left: MARGIN, right: MARGIN, top: pos.top, width: 'auto', maxHeight: '45vh', overflowY: 'auto' }
            : { visibility: pos ? 'visible' : 'hidden', left: pos?.left ?? 0, top: pos?.top ?? 0,
                ...(pos?.maxHeight ? { maxHeight: pos.maxHeight, overflowY: 'auto' } : {}) }}
          className={`pointer-events-none fixed z-50 rounded border border-q-border bg-[#11151c]
                      px-2.5 py-2 text-left shadow-xl
                      ${pos?.pinned ? '' : 'w-max max-w-[min(24rem,calc(100vw-1rem))]'}`}
          // VISIBILITY, NOT `hidden`. `hidden` removes the element from layout, so the very first
          // measurement returned a zero-height rect — which satisfied "it fits above", placed the
          // card flush against the top of the word, and let it grow downward over the anchor once
          // it rendered for real. It has to occupy layout to be measured and be invisible while it
          // is measured, and only visibility does both.
        >
          {card}
        </span>
      )}
    </span>
  )
}
