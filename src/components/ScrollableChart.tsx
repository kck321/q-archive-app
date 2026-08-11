import type { ReactNode } from 'react'

// On phones, timeline charts with ~60 monthly bars collapse into unreadable slivers.
// This wraps a chart so on small screens it keeps a comfortable width and scrolls
// horizontally (each bar readable + tappable), while fitting the container normally
// on desktop (lg+). Adds a subtle swipe hint on mobile only.
export default function ScrollableChart({ children, minWidth = 820 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div>
      <div
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
