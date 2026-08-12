/**
 * The month axis shared by every timeline chart in the app.
 *
 * Each page had its own copy of this tick, and all six only drew a label for months that
 * carry a "delta" — so the axis was blank almost everywhere and the charts gave no sense of
 * WHEN you were looking. Post Archive got years first; this is that version, extracted so
 * the other five cannot drift from it again.
 *
 * The year is drawn once per year, at its first month present in the data, with a tick mark.
 * That is enough to place any bar without trying to fit ~62 month labels into the width.
 */

/** Months that fall N years before today — Q's "delta" markers. */
function buildDeltaMonths(): Map<string, number> {
  const now = new Date()
  const map = new Map<string, number>()
  for (let delta = 1; delta <= 20; delta++) {
    const d = new Date(now)
    d.setFullYear(d.getFullYear() - delta)
    map.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, delta)
  }
  return map
}

export const DELTA_MONTHS = buildDeltaMonths()

/** First month present for each year — where the year label and its tick are drawn. */
export function yearStartsOf(rows: { month: string }[]): Set<string> {
  const seen = new Set<string>()
  const out = new Set<string>()
  for (const r of rows) {
    const yr = r.month.slice(0, 4)
    if (!seen.has(yr)) { seen.add(yr); out.add(r.month) }
  }
  return out
}

export function MonthYearTick({ x, y, payload, yearStarts }: {
  x?: number
  y?: number
  payload?: { value: string }
  yearStarts?: Set<string>
}) {
  if (x === undefined || y === undefined || !payload) return <g />
  const delta = DELTA_MONTHS.get(payload.value)
  const showYear = yearStarts?.has(payload.value)
  if (!delta && !showYear) return <g />
  return (
    <g transform={`translate(${x},${y})`}>
      {delta && <>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="#6b7280" fontSize={10}>{delta} yr</text>
        <text x={0} y={0} dy={24} textAnchor="middle" fill="#4b5563" fontSize={9}>Delta</text>
      </>}
      {showYear && <>
        <line x1={0} y1={0} x2={0} y2={5} stroke="#4b5563" strokeWidth={1} />
        <text x={0} y={0} dy={delta ? 38 : 17} textAnchor="middle" fill="#9ca3af" fontSize={11} fontWeight={700}>
          {payload.value.slice(0, 4)}
        </text>
      </>}
    </g>
  )
}
