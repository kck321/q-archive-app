// Search-filtered timeline charts.
//
// When a search is active, every timeline chart should stop showing the whole archive and
// show WHERE THE MATCHES FALL instead — bars colored green→red by how many matches landed
// in that month. PostArchive, QuestionsArchive and Dashboard each grew their own copy of
// this; these helpers are the shared version so the remaining pages behave identically
// and `gradientColor` stops being pasted into every file.

/** YYYY-MM for a post timestamp, tolerating both seconds and milliseconds. */
export function monthKey(timestamp: number): string {
  const ms = timestamp > 1e10 ? timestamp : timestamp * 1000
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * How many of `postNums` fall in each month.
 * Post numbers with no known timestamp are skipped rather than bucketed wrongly.
 */
export function monthCounts(
  postNums: Iterable<number>,
  timestampOf: (postNum: number) => number | undefined,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const num of postNums) {
    const ts = timestampOf(num)
    if (!ts) continue
    const m = monthKey(ts)
    out.set(m, (out.get(m) ?? 0) + 1)
  }
  return out
}

/** Green (few) → yellow → red (most matches). `dark` returns a dimmed variant. */
export function gradientColor(count: number, maxCount: number, dark = false): string {
  if (count === 0 || maxCount === 0) return dark ? '#14532d' : '#1f2937'
  const ratio = Math.min(1, count / maxCount)
  let r: number, g: number, b: number
  if (ratio <= 0.5) {
    const t = ratio * 2
    r = Math.round(34 + (234 - 34) * t)
    g = Math.round(197 + (179 - 197) * t)
    b = Math.round(94 + (8 - 94) * t)
  } else {
    const t = (ratio - 0.5) * 2
    r = Math.round(234 + (239 - 234) * t)
    g = Math.round(179 + (68 - 179) * t)
    b = Math.round(8 + (68 - 8) * t)
  }
  return dark
    ? `rgb(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)})`
    : `rgb(${r},${g},${b})`
}

/** Grey used for months with no matches while a search is active. */
export const NO_MATCH_GREY = '#374151'

/**
 * Upper bound for the match axis, with headroom for the count marker.
 *
 * Without this the busiest month's bar reaches the exact top of the plot and its label —
 * drawn ABOVE the bar — is clipped off, so the highest number (the one you most want to
 * read) is the only one you can't see. 30% headroom keeps the tallest bar dominant while
 * leaving room for the marker; the chart also needs enough `margin.top` to draw into.
 */
export function matchAxisMax(max: number): number {
  return Math.max(2, Math.ceil(max * 1.3))
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2018-01" → "Jan '18". Month granularity only — the day a drop landed isn't the point. */
export function shortMonth(month: string): string {
  const [y, m] = month.split('-')
  const idx = Number(m) - 1
  if (!y || idx < 0 || idx > 11) return month
  return `${SHORT_MONTHS[idx]} '${y.slice(2)}`
}

/**
 * When an item's posts span time, say so compactly: "Jan '18" for a single month,
 * "Nov '17 – Mar '19" for a range. Returns '' when no month is known.
 */
export function monthSpanLabel(
  postNums: Iterable<number>,
  monthOf: (postNum: number) => string | undefined,
): string {
  let first: string | undefined
  let last: string | undefined
  for (const n of postNums) {
    const m = monthOf(n)
    if (!m) continue
    if (!first || m < first) first = m
    if (!last || m > last) last = m
  }
  if (!first || !last) return ''
  return first === last ? shortMonth(first) : `${shortMonth(first)} – ${shortMonth(last)}`
}

/**
 * Count marker drawn above a match bar: a small downward pointer with the number.
 *
 * A rare term is the hard case — 2 hits across 4,966 posts is a bar half a percent of an
 * axis scaled to ~400 total posts, i.e. invisible. Giving matches their own Y axis makes
 * the bar proportional, and this marker makes the exact count readable without hovering,
 * so a 1-hit month and a 3-hit month are told apart at a glance.
 *
 * Rendered via recharts <LabelList content={MatchCountLabel} />; zero-match months draw
 * nothing at all.
 */
export function MatchCountLabel(props: {
  x?: number | string
  y?: number | string
  width?: number | string
  // recharts types `value` loosely (it can be null / an array); narrow it here.
  value?: unknown
}) {
  const value = Number(props.value ?? 0)
  if (!value) return null
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const width = Number(props.width ?? 0)
  const cx = x + width / 2

  return (
    <g pointerEvents="none">
      {/* downward pointer sitting just above the bar */}
      <path d={`M ${cx - 4} ${y - 9} L ${cx + 4} ${y - 9} L ${cx} ${y - 3} Z`} fill="#f87171" />
      <text
        x={cx}
        y={y - 13}
        textAnchor="middle"
        fill="#fca5a5"
        fontSize={10}
        fontWeight={700}
      >
        {value}
      </text>
    </g>
  )
}
