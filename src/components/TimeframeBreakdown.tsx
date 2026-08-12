import { Link } from 'react-router-dom'

// Reusable "what was said in this timeframe" panel — shown when a user clicks a
// month bar on any timeline chart. Given the same frequency data each page already
// has ({text, count, postNums}), it ranks the items that occurred in the selected
// month by how many times they repeated *that month*, with click-through post chips.

export interface FreqItem {
  text: string
  count: number          // total occurrences across the whole archive
  postNums: number[]
  /** postNum → times the phrase occurs INSIDE that post (only when > 1). */
  repeats?: Record<number, number>
}

type Accent = 'blue' | 'cyan' | 'amber' | 'violet' | 'indigo' | 'orange' | 'yellow' | 'fuchsia' | 'green' | 'red' | 'slate'

const ACCENT: Record<Accent, { border: string; text: string; badge: string; chip: string }> = {
  blue:   { border: 'border-blue-800/50',   text: 'text-blue-300',   badge: 'bg-blue-900/50 text-blue-300 border-blue-700/60',     chip: 'hover:bg-blue-900/50 hover:text-blue-300 hover:border-blue-600' },
  cyan:   { border: 'border-cyan-800/50',   text: 'text-cyan-300',   badge: 'bg-cyan-900/50 text-cyan-300 border-cyan-700/60',     chip: 'hover:bg-cyan-900/50 hover:text-cyan-300 hover:border-cyan-600' },
  amber:  { border: 'border-amber-800/50',  text: 'text-amber-300',  badge: 'bg-amber-900/50 text-amber-300 border-amber-700/60',   chip: 'hover:bg-amber-900/50 hover:text-amber-300 hover:border-amber-600' },
  violet: { border: 'border-violet-800/50', text: 'text-violet-300', badge: 'bg-violet-900/50 text-violet-300 border-violet-700/60', chip: 'hover:bg-violet-900/50 hover:text-violet-300 hover:border-violet-600' },
  indigo: { border: 'border-indigo-800/50', text: 'text-indigo-300', badge: 'bg-indigo-900/50 text-indigo-300 border-indigo-700/60', chip: 'hover:bg-indigo-900/50 hover:text-indigo-300 hover:border-indigo-600' },
  orange: { border: 'border-orange-800/50', text: 'text-orange-300', badge: 'bg-orange-900/50 text-orange-300 border-orange-700/60', chip: 'hover:bg-orange-900/50 hover:text-orange-300 hover:border-orange-600' },
  yellow: { border: 'border-yellow-800/50', text: 'text-yellow-300', badge: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/60', chip: 'hover:bg-yellow-900/50 hover:text-yellow-300 hover:border-yellow-600' },
  slate:  { border: 'border-slate-700/50',  text: 'text-slate-300',  badge: 'bg-slate-800/50 text-slate-300 border-slate-600/60',  chip: 'hover:bg-slate-800/50 hover:text-slate-200 hover:border-slate-500' },
  fuchsia:{ border: 'border-fuchsia-800/50',text: 'text-fuchsia-300',badge: 'bg-fuchsia-900/50 text-fuchsia-300 border-fuchsia-700/60', chip: 'hover:bg-fuchsia-900/50 hover:text-fuchsia-300 hover:border-fuchsia-600' },
  green:  { border: 'border-green-800/50',  text: 'text-green-300',  badge: 'bg-green-900/50 text-green-300 border-green-700/60',   chip: 'hover:bg-green-900/50 hover:text-green-300 hover:border-green-600' },
  red:    { border: 'border-red-800/50',    text: 'text-red-300',    badge: 'bg-red-900/50 text-red-300 border-red-700/60',         chip: 'hover:bg-red-900/50 hover:text-red-300 hover:border-red-600' },
}

interface Props {
  monthLabel: string                 // e.g. "February 2019"
  label: string                      // e.g. "questions", "named entities"
  monthPostNums: Set<number>         // post numbers belonging to the clicked month
  items: FreqItem[]                  // the page's frequency data
  accent?: Accent
  onClose: () => void
  /** Builds the query string for a post chip, e.g. item => `highlight=${enc(item.text)}&rk=question` */
  postLinkParams?: (item: FreqItem) => string
}

export default function TimeframeBreakdown({
  monthLabel, label, monthPostNums, items, accent = 'blue', onClose, postLinkParams,
}: Props) {
  const a = ACCENT[accent]

  // Rank items by how many times they occurred *in this month*.
  const ranked = items
    .map(it => ({ item: it, inMonth: it.postNums.filter(n => monthPostNums.has(n)).sort((x, y) => x - y) }))
    .filter(r => r.inMonth.length > 0)
    .sort((p, q) => q.inMonth.length - p.inMonth.length || (p.inMonth[0] ?? 0) - (q.inMonth[0] ?? 0))

  const totalOccurrences = ranked.reduce((s, r) => s + r.inMonth.length, 0)
  const repeated = ranked.filter(r => r.inMonth.length > 1).length

  return (
    <div className={`bg-q-panel border ${a.border} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="text-white font-semibold text-sm">{monthLabel}</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            <span className={`${a.text} font-medium`}>{ranked.length.toLocaleString()}</span> unique {label} ·{' '}
            <span className="text-gray-400 font-medium">{totalOccurrences.toLocaleString()}</span> total ·{' '}
            <span className={`${a.text} font-medium`}>{repeated.toLocaleString()}</span> repeated — ranked by how often each appeared this month
          </p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded transition-colors shrink-0">✕ Close</button>
      </div>

      {ranked.length === 0 ? (
        <p className="text-gray-500 text-sm py-2">Nothing recorded for this month.</p>
      ) : (
        // No inner scroll box: every item for the month is listed and the PAGE scrolls. A
        // 60vh scroller inside a scrolling page is awkward on a phone and made the list look
        // truncated.
        <div className="space-y-1.5">
          {ranked.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-black/20 border border-q-border rounded-lg px-3 py-2">
              <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${a.badge}`} title={`Appeared ${r.inMonth.length}× this month`}>
                ×{r.inMonth.length}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-200 leading-snug">{r.item.text}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.inMonth.map(num => {
                    const reps = r.item.repeats?.[num] ?? 0
                    return (
                      <Link
                        key={num}
                        to={`/post/${num}?flash=1${postLinkParams ? `&${postLinkParams(r.item)}` : ''}`}
                        title={reps > 1 ? `mentioned ${reps} times in #${num}` : undefined}
                        className={`text-[11px] px-1.5 py-0.5 bg-gray-800 text-gray-400 border rounded font-mono transition-colors ${a.chip} ${reps > 1 ? 'border-amber-500/70' : 'border-gray-700'}`}
                      >
                        #{num}
                        {reps > 1 && <span className="ml-1 text-amber-300 font-bold">×{reps}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
              {r.item.count > r.inMonth.length && (
                <span className="shrink-0 text-[10px] text-gray-600 mt-1" title="Total across the whole archive">
                  {r.item.count}× all-time
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
