// Shared constants for the post-body highlighters in PostDetail and PostCard, so the two
// views can't drift (previously they had different glossary lists and different shades).

// Escape for regex AND normalize quote/dash variants so curly quotes (Q posts) match
// straight quotes (Claude output) and vice versa.
export function escapeAndNormalize(term: string): string {
  let e = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  e = e.replace(/['‘’‚‛]/g, "(?:'|‘|’)")
  e = e.replace(/["“”„‟]/g, '(?:"|“|”)')
  e = e.replace(/[-–—]/g, '(?:-|–|—)')
  return e
}

// Static named-entity terms — always highlighted regardless of AI analysis.
export const STATIC_ENTITIES = ['bad actor', 'bad actors']

// Military / intel glossary — highlighted without an API call.
export const MIL_INTEL_TERMS = [
  'POTUS', 'FLOTUS', 'SCOTUS', 'DECLAS', 'FISA', 'NSA', 'CIA', 'FBI', 'DOJ', 'DNI', 'DHS', 'DOD', 'USMC',
  'SIGINT', 'HUMINT', 'PSYOP', 'JSOC', 'SOCOM', 'GITMO', 'EO', 'EAS', 'DEFCON', 'STRATFOR',
  'Q clearance', 'top secret', 'classified', 'compartmentalized', 'chain of command',
  'military intelligence', 'special operations', 'covert', 'clandestine', 'black site',
  'executive order', 'national security', 'martial law', 'military tribunal', 'UCMJ',
]

// Recurring Q rhetorical phrases — highlighted without an API call.
export const Q_SIGNATURES = [
  'Future proves past', 'Think mirror', 'You are the news now', 'Where we go one we go all',
  'WWG1WGA', 'Trust the plan', 'The Great Awakening', 'Nothing can stop what is coming',
  'NCSWIC', 'Dark to light', 'Sheep no more', 'The storm is upon us', 'Pain coming',
  'Godfather III', 'White rabbit', 'Follow the white rabbit', 'Follow the money',
  'Follow the pen', 'Follow the watch', 'Patriots in control', 'We have it all',
  'Coincidence?', 'Do you believe in coincidences?', 'Logical thinking', 'Enjoy the show',
  'Popcorn ready', 'Buckle up', 'God wins', 'In God we trust', 'For God and country',
  'Shall we play a game', 'Who controls the narrative', 'Expand your thinking',
  'The truth is behind you', 'These people are stupid', 'They never thought she would lose',
  'Do you believe in coincidences', 'The calm before the storm',
]

// Regex sources — construct a fresh `new RegExp(SRC, 'g')` at each use (never share a /g
// instance, its lastIndex is stateful).
export const BRACKET_SRC = '\\[\\[?[A-Za-z0-9][A-Za-z0-9 _\\-]{0,30}\\]?\\]'
export const URL_SRC = 'https?://[^\\s<>\'")\\]]+'

// One color map for every highlight kind — used by both highlighters so a given category
// renders the exact same shade everywhere.
export const HIGHLIGHT_CLS: Record<string, string> = {
  namedEntity:       'bg-cyan-500/40 text-cyan-100',
  claim:             'bg-amber-500/40 text-amber-100',
  prediction:        'bg-violet-500/40 text-violet-100',
  theme:             'bg-indigo-500/40 text-indigo-100',
  impliedConclusion: 'bg-orange-500/40 text-orange-100',
  verificationHook:  'bg-fuchsia-500/40 text-fuchsia-100',
  // Emphasis was bg-slate-400/30 — a grey so faint on the dark background that a reader could
  // not tell it from unmarked text, which made the Emphasis chips look like they referred to
  // words that were never highlighted. It is a certified category and needs to read as one.
  emphasis:          'bg-slate-300/60 text-slate-900 font-medium',
  bracketCode:       'bg-red-800/50 text-red-200 font-mono text-[0.9em]',
  milIntel:          'bg-sky-500/40 text-sky-100 font-semibold',
  qSignature:        'bg-purple-400/30 text-purple-200 italic',
  topic:             'bg-yellow-400/40 text-yellow-100 font-semibold',
  // CONTEXT / OTHER Q TEXT — reviewed, and deliberately in no semantic category.
  //
  // 4,887 units that were read and dispositioned, then rendered as plain text indistinguishable
  // from something nobody had looked at. That is why the archive still looked unaudited.
  //
  // This was a dotted underline with no fill, so that it could never be mistaken for a semantic
  // category. The owner ruled against it on 2026-08-14: the underline is hard to see, and every
  // category should read as a fill. So the "not a semantic category" signal moves from ABSENCE OF
  // FILL to HUE — grey is the one neutral in a palette where every certified layer owns a colour
  // (amber Claims, blue Questions, indigo Themes, cyan Entities, slate Emphasis, green
  // Directives). Grey fill says reviewed-and-uncategorised as clearly as the underline did, and
  // is legible at a glance.
  //
  // The explicit bg- class is NOT cosmetic and must never be dropped. A <mark> with no background
  // class falls back to the browser's DEFAULT YELLOW, so a treatment defined purely as an
  // underline renders as a solid yellow fill — indistinguishable from a semantic category and
  // matching no legend entry. Third occurrence of that mistake: archive search, detail search,
  // and Context.
  context:           'bg-gray-500/35 text-gray-100',
  request:           'bg-green-500/40 text-green-100 font-medium',
  requestQuestion:   'animate-req-question font-medium',
  // SEARCH STATE, NOT CLASSIFICATION.
  //
  // This was a solid red fill — structurally identical to every semantic category colour, so a
  // term highlighted because the reader clicked it looked exactly like text the audit had
  // certified. "Ascension." is certified in no layer and still lit up like a Claim. A search
  // match now gets an outline and a dashed underline with no category fill, so the page can
  // never present view state with the authority of certified analysis.
  keyword:           'bg-transparent ring-1 ring-red-400/80 underline decoration-dashed decoration-red-400/80 underline-offset-2 text-red-200 font-semibold rounded-sm',
}

// ─── Word-boundary matching for highlighted terms ─────────────────────────────
// A raw regex highlights "US" inside "rUSsia", "POTUS" and "HoUSe", which makes reading a
// post with a short entity selected genuinely painful. `\b…\b` is not safe either: many
// terms here start or end with punctuation ("Q+", "[RR]", "@Snowden", "5:5"), and \b next
// to a non-word character asserts the opposite of what you want, so those stop matching.
//
// So the boundary is applied conditionally, per end, based on whether that end is actually
// a word character.
export function wordBoundaryPattern(escapedTerm: string, rawTerm: string): string {
  const startsWord = /[A-Za-z0-9]/.test(rawTerm[0] ?? '')
  const endsWord = /[A-Za-z0-9]/.test(rawTerm[rawTerm.length - 1] ?? '')
  const lead = startsWord ? '(?<![A-Za-z0-9])' : ''
  const tail = endsWord ? '(?![A-Za-z0-9])' : ''
  return `${lead}${escapedTerm}${tail}`
}
