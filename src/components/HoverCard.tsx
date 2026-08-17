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
//
// ONE TRIGGER MAY SPEAK FOR SEVERAL SEGMENTS. A glossary term the annotation layer has cut in two
// gets exactly one control, and `occurrenceId` is how the other pieces reach it — see
// lib/glossDelegation.ts. Everything below is unchanged by that: the same button, the same card,
// the same dismissal. The id only adds an address.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ANCHOR_ATTR, OCC_ATTR, inOccurrence, registerOccurrence } from '../lib/glossDelegation'

const MARGIN = 8
/** Below this width the card is pinned rather than floated. Matches Tailwind's `sm`. */
const NARROW = 640
/** A card shorter than this is not worth showing; below it, scroll inside instead. */
const MIN_CARD = 64

export function HoverCard({
  children, card, label, className = '', occurrenceId,
}: {
  /** The trigger content — the word in the drop. */
  children: ReactNode
  /** The card body. Rendered only while open. */
  card: ReactNode
  /** What a screen reader announces for the trigger, e.g. 'POTUS — more information'. */
  label: string
  className?: string
  /** Set when this trigger speaks for a term split across several rendered segments. */
  occurrenceId?: string
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
      // A SIBLING SEGMENT OF THE SAME TERM IS NOT OUTSIDE. "SUPREME" is the control and "COURT" is
      // not, but they are one word to the reader. Without this the tap on "COURT" closes the card
      // here and the delegated handler reopens it a moment later — a flicker on a mouse, and on a
      // phone a term that appears to ignore every second tap.
      if (occurrenceId && inOccurrence(t, occurrenceId)) return
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
  }, [open, close, occurrenceId])

  // The other segments of a split term drive this trigger through the shared delegation registry.
  // Registered while mounted rather than while open — a segment has to be able to OPEN the card,
  // which is precisely the state in which the card is not there to register itself.
  useEffect(() => {
    if (!occurrenceId) return
    return registerOccurrence(occurrenceId, {
      element: () => triggerRef.current,
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(o => !o),
    })
  }, [occurrenceId])

  // ── placement ──────────────────────────────────────────────────────────────
  // Positioned against the VIEWPORT, not the paragraph: the post body sits inside a <pre> with its
  // own overflow, so an absolutely-positioned card is clipped by that ancestor however it is
  // offset. Both axes are clamped unconditionally — preferring "above" and trusting it still
  // overflowed whenever the anchor itself was below the fold.
  useLayoutEffect(() => {
    if (!open) return
    // MEASURE TWICE. Focusing a trigger can scroll it into view, and that scroll lands AFTER this
    // effect runs — so the anchor rect used for placement is one the reader never sees, and the
    // card can settle on top of the word. It failed about one run in four, which is worse than
    // failing every time: the check passes, ships, and then a keyboard user hits it.
    //
    // The second pass runs on the next frame, once any scrolling has finished, and is what the
    // reader actually gets. Cheap, and it makes the placement independent of how the card was
    // opened.
    let raf = 0
    const place = () => {
      const el = cardRef.current
      const a = triggerRef.current?.getBoundingClientRect()
      const b = el?.getBoundingClientRect()
      if (!a || !b || !el) return
      // CONTENT height, not rendered height. Once a maxHeight is applied the rendered box is
      // shorter than the text inside it, so a second pass measured the clamped box, concluded it
      // now fitted above, placed it there without the clamp, and let it expand back over the
      // anchor. scrollHeight is what the card wants to be and does not move when the clamp does,
      // which is the only measurement that makes the placement stable.
      const wanted = Math.max(el.scrollHeight + 2, b.height)
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

      // BOUND THE HEIGHT ON WHICHEVER SIDE IS CHOSEN, ALWAYS.
      //
      // The earlier version only bounded the height when NEITHER side could hold the card whole,
      // and placed it unbounded otherwise. On a short viewport that put cards below the fold —
      // #1148 ran to 646px in a 484px window — because "fits below" was decided from a height the
      // card no longer had once it rendered. Deriving both the height limit and the offset from
      // the same measured space makes overflow arithmetically impossible rather than unlikely.
      const preferAbove = wanted <= spaceAbove || spaceAbove >= spaceBelow
      let maxHeight = Math.max(MIN_CARD, Math.min(wanted, preferAbove ? spaceAbove : spaceBelow))
      let top = preferAbove ? a.top - GAP - maxHeight : a.bottom + GAP

      // Degenerate case: the anchor sits in a window too short to hold the card on either side.
      // Pin to the roomier edge rather than covering the word — the reader can still see which
      // term the card belongs to, which is the property worth protecting.
      if (top < MARGIN || top + maxHeight > window.innerHeight - MARGIN) {
        if (spaceBelow >= spaceAbove) { top = a.bottom + GAP; maxHeight = Math.max(MIN_CARD, spaceBelow) }
        else { maxHeight = Math.max(MIN_CARD, spaceAbove); top = Math.max(MARGIN, a.top - GAP - maxHeight) }
      }
      // WHEN THE ANCHOR ITSELF IS OFF SCREEN, SHOWING THE CARD WINS.
      //
      // Everything above protects the anchor from being covered. That is the right priority only
      // while the reader can see the anchor. A trigger below the fold — which happens whenever a
      // box is opened programmatically, by a keyboard user tabbing ahead, or by a deep link —
      // dragged the card off screen with it, and a card nobody can read protects nothing.
      const anchorVisible = a.bottom > 0 && a.top < window.innerHeight
      if (!anchorVisible) {
        maxHeight = Math.min(wanted, window.innerHeight - 2 * MARGIN)
        top = Math.max(MARGIN, Math.min(a.top, window.innerHeight - maxHeight - MARGIN))
      }
      setPos({ left, top, pinned: false, maxHeight })
    }
    place()
    raf = requestAnimationFrame(place)
    return () => cancelAnimationFrame(raf)
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
        // The anchor is a marked segment too, so leaving it for a sibling segment is not leaving
        // the term. ANCHOR_ATTR is what stops the delegated listeners from handling the events
        // this button already handles itself.
        {...(occurrenceId ? { [OCC_ATTR]: occurrenceId, [ANCHOR_ATTR]: '' } : {})}
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
