import { useHighlightsEnabled, setHighlightsEnabled } from '../lib/highlightPrefs'
import { CATEGORY_COLOR } from '../lib/categoryColors'

/**
 * Turn the language highlighting off, so the archive reads as a plain post search.
 *
 * The label is coloured letter by letter, blended through the category colours in the order
 * they appear in the app — questions blue, requests green, claims amber, and so on to
 * checkable-claims fuchsia. The control therefore shows you exactly what it switches off.
 */
const STOPS = [
  CATEGORY_COLOR.questions,
  CATEGORY_COLOR.requests,
  CATEGORY_COLOR.claims,
  CATEGORY_COLOR.predictions,
  CATEGORY_COLOR.namedEntities,
  CATEGORY_COLOR.brackets,
  CATEGORY_COLOR.themes,
  CATEGORY_COLOR.impliedConclusions,
  CATEGORY_COLOR.verificationHooks,
]

const hex = (c: string) => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
]

/** Colour at position `t` (0→1) along the category gradient. */
function blend(t: number): string {
  const span = (STOPS.length - 1) * Math.min(Math.max(t, 0), 1)
  const i = Math.min(Math.floor(span), STOPS.length - 2)
  const f = span - i
  const [r1, g1, b1] = hex(STOPS[i])
  const [r2, g2, b2] = hex(STOPS[i + 1])
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f)
  return `rgb(${mix(r1, r2)},${mix(g1, g2)},${mix(b1, b2)})`
}

const LABEL = 'Turn OFF Language Highlights'

export default function HighlightToggle() {
  const on = useHighlightsEnabled()

  // Only the letters are graded — spaces would waste steps of the gradient on nothing.
  const letters = LABEL.split('')
  const total = Math.max(1, letters.filter(c => c !== ' ').length - 1)
  let seen = -1

  return (
    <label
      className="flex items-center gap-2 cursor-pointer select-none shrink-0"
      title={on ? 'Hide every category highlight and read the posts plainly' : 'Language highlighting is off — click to bring it back'}
    >
      <input
        type="checkbox"
        checked={!on}
        onChange={e => setHighlightsEnabled(!e.target.checked)}
        className="w-4 h-4 accent-blue-500 cursor-pointer"
      />
      <span className="text-xs font-semibold whitespace-nowrap">
        {letters.map((ch, i) => {
          if (ch === ' ') return <span key={i}>&nbsp;</span>
          seen++
          return <span key={i} style={{ color: on ? blend(seen / total) : '#6b7280' }}>{ch}</span>
        })}
      </span>
    </label>
  )
}
