import { useEffect, useRef } from 'react'

/**
 * An invisible marker that fires when it scrolls into view.
 *
 * Used by the analysis archive's inline drop reader: the owner asked for ALL of a theme's drops to
 * be open, and a theme carries up to 404 of them. Mounting 404 post cards at once locks the tab,
 * so they mount in batches — and the batches advance on SCROLL rather than on a click, which is
 * what makes it read as "all of them are open" while you scan.
 *
 * rootMargin loads the next batch before the reader reaches the end, so the scan never stalls.
 */
export default function ReaderSentinel({ onEnter }: { onEnter: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const fired = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // IntersectionObserver is missing in very old browsers; without it the "+ more" button below
    // is still there, so the reader degrades to the manual path rather than breaking.
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting || fired.current) continue
        fired.current = true          // one batch per mount; the next batch mounts its own sentinel
        onEnter()
      }
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [onEnter])
  return <div ref={ref} aria-hidden className="h-1" />
}
