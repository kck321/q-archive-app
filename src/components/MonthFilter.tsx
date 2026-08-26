// The month filter's COMPONENTS: the readout, the keyboard path, and the active-month banner.
//
// Both Analysis and the Post Archive render these, so the two pages cannot describe one interaction
// two ways — which is exactly what they were doing, with two tooltips, two banners and two ideas of
// what a hover means. The state lives in lib/monthFilter.ts; the rule it enforces is written there.
import { useMemo, useRef } from 'react'
import { formatMonth } from '../lib/monthFilter'

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthTooltip({ active, payload, label, colorOf, extra }: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
  /** Series name -> colour, so each line matches the bar it describes. */
  colorOf?: (name: string) => string
  /** One extra labelled count, for the search-match series. Still a count of the same month. */
  extra?: { label: string; value: number; color?: string } | null
}) {
  if (!active || !payload || !label) return null
  return (
    <div style={{
      background: 'rgba(22,22,28,0.97)', border: '1px solid #3a3a46', borderRadius: 12,
      padding: '10px 14px', fontSize: 12, minWidth: 168,
      boxShadow: '0 12px 34px rgba(0,0,0,0.6)',
    }}>
      <p style={{ color: '#f3f4f6', marginBottom: 7, fontWeight: 700, fontSize: 13 }}>{formatMonth(String(label))}</p>
      {payload.map((item, i) => {
        const c = colorOf?.(item.name) ?? '#9ca3af'
        return (
          <p key={i} style={{ margin: '3px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: c }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
              {item.name}
            </span>
            <span style={{ color: '#f3f4f6', fontWeight: 600 }}>{item.value.toLocaleString()}</span>
          </p>
        )
      })}
      {extra && (
        <p style={{ color: '#9ca3af', margin: '7px 0 0', borderTop: '1px solid #2f2f38', paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span>{extra.label}</span>
          <span style={{ color: extra.color ?? '#f3f4f6', fontWeight: 600 }}>{extra.value.toLocaleString()}</span>
        </p>
      )}
    </div>
  )
}

/**
 * THE KEYBOARD AND TOUCH PATH INTO THE CHART.
 *
 * A recharts bar is an SVG rectangle. It cannot hold focus, it is not a button, and Enter does
 * nothing to it — so before this the month filter was reachable by mouse only. The axis was no help
 * either: it draws a tick at year starts and Delta months and nothing anywhere else, so 50 of the
 * ~60 months had no label to aim at.
 *
 * These are real buttons in a radiogroup: Tab reaches the group, arrows move within it, Enter and
 * Space select — which is what a button does natively, so "the same action as clicking" is not a
 * second code path that could diverge. It is also the only comfortable way to pick a month on a
 * phone, where 60 bars in a scrolling chart are about four pixels each.
 */
export function MonthPicker({ months, counts, selectedMonth, onSelect, label, accent = '#9ca3af', colorOf, showCounts }: {
  /** Every month with data, "YYYY-MM", oldest first. */
  months: string[]
  /** month -> the count this chart is showing for it, spoken in the button's label. */
  counts?: Record<string, number>
  selectedMonth: string | null
  onSelect: (month: string) => void
  /** What the counts are, for the spoken label: "42 posts", "42 claims". */
  label: string
  accent?: string
  // OWNER RULING, 2026-08-25: "make the q months below the graph highlighted the color that we
  // see for that month in the graph w/how many times the term is found in that month as well".
  // A keyword search colours its chart bars green→red by density (lib/chartSearch's
  // gradientColor), but the chips below stayed flat grey except for whichever ONE was selected —
  // the reader had to look back up at the chart to see which months actually mattered.
  //
  // `colorOf`, when given, replaces the plain grey/accent scheme for EVERY chip, matched or not,
  // so the picker reads as a second copy of the chart's own colour-by-density instead of a
  // separate flat control. Optional, and default-omitted: Analysis's category picker and the
  // Post Archive's own non-search (browse-by-category) picker pass neither prop and render
  // exactly as before — this is additive, not a restyle of the shared component.
  colorOf?: (month: string, count: number) => string
  // Shows the count on the chip face rather than only in the hover title/aria-label — the reader
  // asked to see "how many" without a hover, the same reason the chart bars carry LabelList totals.
  showCounts?: boolean
}) {
  const byYear = useMemo(() => {
    const out = new Map<string, string[]>()
    for (const m of months) {
      const y = m.slice(0, 4)
      if (!out.has(y)) out.set(y, [])
      out.get(y)!.push(m)
    }
    return [...out.entries()]
  }, [months])

  const refs = useRef(new Map<string, HTMLButtonElement | null>())

  // Arrow keys walk the months in time order, across year boundaries — the grid is a presentation
  // of one sequence, not a set of independent rows.
  const move = (from: string, delta: number) => {
    const i = months.indexOf(from)
    const next = months[Math.min(months.length - 1, Math.max(0, i + delta))]
    if (next) refs.current.get(next)?.focus()
  }

  if (!months.length) return null

  return (
    <div
      role="radiogroup"
      aria-label={`Filter by month — ${months.length} months`}
      className="mt-3 flex flex-col gap-1"
    >
      {byYear.map(([year, ms]) => (
        <div key={year} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-gray-600 tabular-nums w-8 shrink-0">{year}</span>
          {ms.map(m => {
            const selected = selectedMonth === m
            const n = counts?.[m] ?? 0
            // colorOf owns the whole chip's colour, selected or not, when given — it IS the
            // density colour the chart drew for this month, so "selected" still needs its own
            // signal (the ring) rather than a colour change that would otherwise look identical
            // to the unselected chip beside it.
            const bg = colorOf ? colorOf(m, n) : (selected ? accent : undefined)
            return (
              <button
                key={m}
                ref={el => { refs.current.set(m, el) }}
                type="button"
                role="radio"
                aria-checked={selected}
                // The spoken label is the whole answer — which month, how many, and that choosing it
                // filters. A bare "Mar" tells a screen-reader user nothing about what they are picking.
                aria-label={`${formatMonth(m)}, ${n.toLocaleString()} ${label}${selected ? ', selected' : ''}`}
                title={`${formatMonth(m)} — ${n.toLocaleString()} ${label}`}
                // Roving tabindex: the group is one tab stop, arrows move inside it.
                tabIndex={selected || (!selectedMonth && m === months[0]) ? 0 : -1}
                onClick={() => onSelect(m)}
                onKeyDown={e => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(m, 1) }
                  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(m, -1) }
                  else if (e.key === 'Home') { e.preventDefault(); refs.current.get(months[0])?.focus() }
                  else if (e.key === 'End') { e.preventDefault(); refs.current.get(months[months.length - 1])?.focus() }
                  // Enter and Space are NOT handled here. A <button> already fires onClick for both,
                  // and intercepting them would create a second path that could drift from the mouse one.
                }}
                className={`text-[10px] leading-none px-1.5 py-1 rounded border tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                  selected
                    ? `font-bold border-transparent ${colorOf ? 'ring-2 ring-white' : 'text-black'}`
                    : bg
                      ? 'border-transparent'
                      : n > 0
                        ? 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-400 hover:text-white'
                        : 'bg-gray-900 text-gray-600 border-gray-800 hover:border-gray-600'
                }`}
                style={bg ? { background: bg, color: colorOf ? '#0a0a0f' : undefined } : undefined}
              >
                {SHORT[Number(m.slice(5, 7)) - 1]}
                {showCounts && n > 0 && <span className="ml-0.5 font-bold">{n}</span>}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * The active month, said plainly, with the way out beside it.
 *
 * Also the screen-reader announcement: one `aria-live="polite"` region carrying the month and the
 * result count. Selecting a month rewrote the list underneath with nothing spoken at all, so a
 * non-sighted reader got silence and a changed page.
 */
export function MonthFilterBar({ month, resultCount, resultNoun, onClear, panelRef, showBar = true }: {
  month: string | null
  resultCount: number
  /** "entities", "posts", "claims" — what the count counts. */
  resultNoun: string
  onClear: () => void
  panelRef?: React.Ref<HTMLDivElement>
  /**
   * Announce only, without drawing the bar.
   *
   * The Post Archive already shows a full month panel while browsing, so a second banner above it
   * would say the same thing twice — but the ANNOUNCEMENT still has to happen, or a screen-reader
   * user gets a silently rewritten page. Suppressing the bar by passing `month={null}` would have
   * suppressed the announcement with it, and announced "cleared" while a month was selected.
   */
  showBar?: boolean
}) {
  const message = month
    ? `${formatMonth(month)} selected. ${resultCount.toLocaleString()} ${resultNoun}.`
    : ''
  return (
    <>
      {/* Announced whether or not the bar is on screen, so clearing is spoken too. */}
      <div aria-live="polite" role="status" className="sr-only">
        {month ? message : 'Month filter cleared.'}
      </div>
      {month && showBar && (
        <div
          ref={panelRef}
          className="scroll-mt-24 flex items-center gap-3 flex-wrap bg-white/5 border border-white/20 rounded-xl px-4 py-2.5"
        >
          <span className="text-sm text-white font-semibold">{formatMonth(month)}</span>
          <span className="text-xs text-gray-400">
            {resultCount.toLocaleString()} {resultNoun} — showing only this month’s posts
          </span>
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-xs text-gray-300 hover:text-white bg-gray-800 border border-gray-600 px-3 py-1 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            ✕ Clear month
          </button>
        </div>
      )}
    </>
  )
}
