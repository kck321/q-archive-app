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
// THE SELECTION LIVES IN THE URL (?m=YYYY-MM), not in component state (owner ruling 2026-08-28:
// "if you click on any series of links through the app we go straight back to the previous
// point"). As plain state it evaporated on Back: open a month, open a drop from its list, press
// Back — the archive remounted UNFILTERED, and the scroll restorer then aimed a month-list
// offset at the wrong list, because both views shared the key "/posts". In the URL the month
// survives the round trip, each selection is a history step a reader can walk back through,
// and the scroll store (keyed on pathname+search) keeps the month view's position separate
// from the unfiltered view's by construction.
//
// The components that render this live in components/MonthFilter.tsx.
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

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
  const [urlParams, setUrlParams] = useSearchParams()
  const { onSelect, resetKey } = opts

  // The URL is the state. A malformed ?m= reads as no selection rather than a broken view.
  const raw = urlParams.get('m')
  const selectedMonth = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : null

  const writeMonth = useCallback((next: string | null) => {
    // Clearing an already-clear filter must not push a history entry (runSearch clears as a
    // belt-and-braces step after it has already replaced the query string).
    if (next === selectedMonth) { onSelect?.(next); return }
    // Functional form so a q= or tab= written in the same tick is preserved, and PUSH (the
    // default) on purpose: each selection is a history step, so Back retraces the reader's
    // clicks — month view included — instead of skipping over them.
    setUrlParams(prev => {
      const p = new URLSearchParams(prev)
      if (next) p.set('m', next)
      else p.delete('m')
      return p
    })
    onSelect?.(next)
  }, [setUrlParams, onSelect])

  // A new search starts unfiltered. Leaving the previous term's month selected meant the next
  // search opened already filtered to a month picked for something else — results silently missing
  // with no visible cause. An effect rather than a render-time adjustment now that the state is
  // the URL (writing the URL during render is not allowed); `replace` so the cleared filter does
  // not become a history step of its own. PostArchive's own search-submit already replaces the
  // whole query string, so this catches the surfaces that preserve their params instead.
  const firstReset = useRef(true)
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return }
    setUrlParams(prev => {
      if (!prev.has('m')) return prev
      const p = new URLSearchParams(prev)
      p.delete('m')
      return p
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

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
    writeMonth(selectedMonth === m ? null : m)
  }, [writeMonth, selectedMonth])

  const clearMonth = useCallback(() => {
    lastClick.current = { month: '', at: 0 }
    writeMonth(null)
  }, [writeMonth])

  const monthPostNums = useMemo(
    () => (selectedMonth ? new Set(postNumsByMonth[selectedMonth] ?? []) : null),
    [selectedMonth, postNumsByMonth],
  )

  return { selectedMonth, selectMonth, clearMonth, monthPostNums }
}
