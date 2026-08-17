// The month filter's STATE, in one place, because two pages had grown two different versions of it.
//
// WHAT WENT WRONG
// ───────────────
// Analysis and Post Archive each kept their own `selectedMonth`, their own `hoverMonth`, their own
// `flashMonth` and their own copy of the double-click guard. Hovering a bar reached into the RESULT
// LIST and pulsed every chip belonging to that month — an animation on hundreds of DOM nodes, fired
// on every mousemove across the chart, in a list the reader was trying to read. Clicking then
// flashed the same chips white for five seconds. Neither told you anything the tooltip had not
// already said, and on a touch screen the "hover" fired on the tap that was meant to select, so one
// gesture pulsed the list and selected a month at the same time.
//
// THE RULE NOW, and it is one rule for both pages:
//
//   hover  reads out. The month and its counts, in a tooltip. It changes nothing else — no chip,
//          no row, no colour, no selection, no filter.
//   click  selects. It filters the list to that month, shows only that month's chips, says which
//          month is active, and can be cleared or changed.
//
// There is deliberately NO HOVER STATE here. It existed only to drive the chip pulse; keeping it
// would leave the next person somewhere to hang a new one.
//
// The components that render this live in components/MonthFilter.tsx.
import { useCallback, useMemo, useRef, useState } from 'react'

/** "2018-03" -> "March 2018". One spelling, used by every surface. */
export function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

export interface MonthFilter {
  /** The selected month as "YYYY-MM", or null for the unfiltered view. */
  selectedMonth: string | null
  /** Select a month, or re-select the current one to clear it. Safe to call from any surface. */
  selectMonth: (month?: string | null) => void
  clearMonth: () => void
  /** The posts in the selected month, or null when nothing is selected. */
  monthPostNums: Set<number> | null
}

export function useMonthFilter(
  postNumsByMonth: Record<string, number[]>,
  opts: { onSelect?: (month: string | null) => void; resetKey?: unknown } = {},
): MonthFilter {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const { onSelect, resetKey } = opts

  // A new search starts unfiltered. Leaving the previous term's month selected meant the next
  // search opened already filtered to a month picked for something else — results silently missing
  // with no visible cause.
  //
  // Adjusted during render rather than in an effect: an effect would paint one frame of the new
  // search still filtered to the old month, then clear it.
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    setSelectedMonth(null)
  }

  // RECHARTS DELIVERS ONE CLICK TO BOTH THE CHART AND THE BAR IT LANDED ON. With toggle semantics
  // that was select-then-deselect inside a single interaction, so nothing appeared to happen until
  // an odd number of extra clicks lined up. A repeat of the same month inside one gesture is
  // ignored. The keyboard path goes through here too, and 350ms is far longer than a double
  // key-repeat, so holding Enter cannot toggle a month off and on again.
  const lastClick = useRef<{ month: string; at: number }>({ month: '', at: 0 })

  const selectMonth = useCallback((m?: string | null) => {
    if (!m) return
    const now = performance.now()
    if (lastClick.current.month === m && now - lastClick.current.at < 350) return
    lastClick.current = { month: m, at: now }
    setSelectedMonth(prev => {
      const next = prev === m ? null : m
      onSelect?.(next)
      return next
    })
  }, [onSelect])

  const clearMonth = useCallback(() => {
    lastClick.current = { month: '', at: 0 }
    setSelectedMonth(null)
    onSelect?.(null)
  }, [onSelect])

  const monthPostNums = useMemo(
    () => (selectedMonth ? new Set(postNumsByMonth[selectedMonth] ?? []) : null),
    [selectedMonth, postNumsByMonth],
  )

  return { selectedMonth, selectMonth, clearMonth, monthPostNums }
}
