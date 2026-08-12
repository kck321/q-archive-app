import { useHighlightsEnabled, setHighlightsEnabled } from '../lib/highlightPrefs'
import { CATEGORY_COLOR } from '../lib/categoryColors'

/**
 * Turn the language highlighting off, so the archive reads as a plain post search.
 *
 * The BOX carries the meaning: it is filled with a blend of the highlight colours — blue,
 * green, red, orange — so the control shows what it switches off. Tick it and the box drains
 * to grey, which is what the posts do too. The label stays plain text; colouring both was
 * noise.
 */
// Four stops, not all nine. Nine colours in a 16px square blur into mud; four hold their
// edges at that size and still read as "the highlight colours".
const STOPS = [
  CATEGORY_COLOR.questions,           // blue
  CATEGORY_COLOR.requests,            // green
  CATEGORY_COLOR.brackets,            // red
  CATEGORY_COLOR.impliedConclusions,  // orange
]

const GRADIENT = `linear-gradient(135deg, ${STOPS.join(', ')})`

export default function HighlightToggle() {
  const on = useHighlightsEnabled()

  return (
    <label
      className="flex items-center gap-2 cursor-pointer select-none shrink-0 group"
      title={on
        ? 'Hide every category highlight and read the posts plainly'
        : 'Language highlighting is off — click to bring it back'}
    >
      {/* Native input kept for keyboard and screen readers; the visible box is the span. */}
      <input
        type="checkbox"
        checked={!on}
        onChange={e => setHighlightsEnabled(!e.target.checked)}
        className="sr-only peer"
      />
      <span
        aria-hidden
        className="relative w-4 h-4 rounded border border-gray-500 shrink-0 transition-all
                   peer-focus-visible:ring-2 peer-focus-visible:ring-white/70 group-hover:border-gray-300"
        style={on
          ? { background: GRADIENT }
          : { background: '#374151' }}
      >
        {!on && (
          <svg viewBox="0 0 16 16" className="absolute inset-0 w-full h-full text-gray-200" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
          </svg>
        )}
      </span>
      <span className="text-xs font-semibold whitespace-nowrap text-gray-300 group-hover:text-white transition-colors">
        Turn OFF Language Highlights
      </span>
    </label>
  )
}
