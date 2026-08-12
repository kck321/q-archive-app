import { useEffect, useRef, type ReactNode } from 'react'

// On phones, timeline charts with ~60 monthly bars collapse into unreadable slivers.
// This wraps a chart so on small screens it keeps a comfortable width and scrolls
// horizontally (each bar readable + tappable), while fitting the container normally
// on desktop (lg+). Adds a subtle swipe hint on mobile only.
export default function ScrollableChart({ children, minWidth = 820, centerAt }: {
  children: ReactNode
  minWidth?: number
  /** 0-1 position along the chart to centre in view — e.g. the month a search matched. */
  centerAt?: number | null
}) {
  const box = useRef<HTMLDivElement>(null)

  // Scroll the matched month into the middle. Without this a search whose hits are late in
  // the timeline leaves the chart parked at the far left, showing months with no matches
  // while the ones you asked about sit off-screen.
  useEffect(() => {
    const el = box.current
    if (!el || centerAt == null) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 0) return
    el.scrollTo({ left: Math.max(0, Math.min(max, centerAt * el.scrollWidth - el.clientWidth / 2)), behavior: 'smooth' })
  }, [centerAt])

  return (
    <div>
      <div
        ref={box}
        className="overflow-x-auto overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
      >
        {/* Inline minWidth for phones; lg:!min-w-0 (important) overrides it on desktop */}
        <div className="lg:!min-w-0" style={{ minWidth }}>
          {children}
        </div>
      </div>
      <p className="lg:hidden text-[10px] text-gray-600 mt-1 text-center">← swipe the chart sideways to explore →</p>
    </div>
  )
}
