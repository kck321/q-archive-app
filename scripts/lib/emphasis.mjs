// Emphasis — a presentation layer. HOW Q draws attention, not what the post is about.
//
// THE RISK THAT SHAPES THIS FILE: Q writes in capitals constantly, so a caps detector alone
// would tag most of the corpus and Emphasis would become the catch-all every other section
// avoided being. The answer is structural rather than a word list:
//
//   EMPHASIS IS CONTRAST. Capitals are emphatic when they stand out from the text AROUND them.
//   A capitalised word inside a lowercase line is emphasis; a line that is entirely capitals
//   inside a post that is entirely capitals is Q's baseline register, not a highlight.
//
// The second risk is subtler. "Cryptic messaging" was the old extractor's most common label at
// 401, and it is an INTERPRETATION, not an observation — nothing about it can be pointed at on
// the page. Emphasis records only concrete, checkable signals: a bracket, a repetition, a
// punctuation run, a spacing choice. If a reader cannot see the device, it is not recorded.
//
// Each category is detected SEPARATELY so no single signal can swallow the section.

export const EMPHASIS_TYPES = [
  { key: 'bracket_emphasis', label: 'Bracket emphasis', blurb: 'A word or phrase set in brackets to mark it out — [raid], [now], [children].' },
  { key: 'caps_emphasis', label: 'Capitals', blurb: 'Capitalised words that contrast with the surrounding lowercase text.' },
  { key: 'repeated_word', label: 'Repeated word or phrase', blurb: 'The same word or phrase repeated in one drop for force.' },
  { key: 'repeated_question', label: 'Repeated question', blurb: 'The same question asked more than once in a drop.' },
  { key: 'repeated_directive', label: 'Repeated directive', blurb: 'The same instruction given more than once in a drop.' },
  { key: 'punctuation_intensity', label: 'Punctuation intensity', blurb: 'Runs of punctuation — ???, !!!, ?!?! — beyond ordinary sentence marking.' },
  { key: 'deliberate_spacing', label: 'Deliberate spacing', blurb: 'Spacing or fragmentation used to slow a reader down: S P A C E D, or one word per line.' },
  { key: 'quoted_word', label: 'Quoted word', blurb: 'A single word in quotation marks to mark it as loaded or ironic.' },
  { key: 'preserved_markup', label: 'Preserved markup', blurb: 'Bold, underline or other markup surviving from the board.' },
  { key: 'parallel_phrasing', label: 'Parallel phrasing', blurb: 'A repeated rhetorical frame across consecutive lines — a cascade of three or more, a mirrored construction, or a frame of several words repeated. A shared first word alone is not enough.' },
]

/** A line that is entirely capitals inside an all-caps post is register, not emphasis. */
export const capsShare = text => {
  const letters = (text.match(/[A-Za-z]/g) ?? []).length
  if (!letters) return 0
  return (text.match(/[A-Z]/g) ?? []).length / letters
}

/** Caps emphasis requires CONTRAST: caps words inside a line that is mostly lowercase. */
export const CAPS_WORD = /\b[A-Z][A-Z0-9]{2,}\b/g
export const PUNCT_RUN = /([?!])\1{1,}|[?!]{3,}|\?!|!\?/
export const SPACED_OUT = /\b(?:[A-Za-z]\s){3,}[A-Za-z]\b/
export const QUOTED_WORD = /["“']\s*[A-Za-z][A-Za-z'’-]{1,20}\s*["”']/
export const MARKUP = /<\/?(?:b|u|strong|em|i)\b[^>]*>/i

/**
 * Not emphasis, however it looks. Each of these was a real over-count risk:
 *   a heading is formatting, not emphasis
 *   an acronym is a name, not a highlight
 *   anything already certified as a code belongs to Codes & Brackets
 *   repetition inside quoted source material is the source repeating itself, not Q
 */
export const HEADING_LIKE = /^[A-Z][A-Za-z0-9 '’&-]{0,40}:$/
export const ORDINARY_ACRONYM = /^(FBI|DOJ|CIA|NSA|USA|US|UK|EU|UN|NATO|GOP|DNC|RNC|POTUS|FLOTUS|VP|AG|IG|SEC|IRS|DHS|ICE|CDC|WHO|NYT|CNN|ABC|NBC|CBS|BBC|MSM|PDF|URL|CEO|CFO|COO)$/

/** Godfather III is a numeral, not a shout. */
export const ROMAN_NUMERAL = /^[IVXLC]{2,}$/

// ── parallel phrasing ─────────────────────────────────────────────────────────
//
// v1 defined this as "two consecutive lines share their first word", which produced 2,187 hits
// and could not tell these apart:
//
//   What happened to Diana? / What did she find out?     ← a deliberate sequence
//   What happened yesterday? / What is the weather?      ← two questions that collide on a word
//
// A shared opener is weak evidence on its own. Certified parallel structure needs a repeated
// rhetorical or syntactic pattern, which the adjudication of 1,339 runs showed arrives in four
// recognisable forms — a cadence of three or more, a mirrored construction, a shared frame of
// more than one token, or a sequence that stays on its subject.
//
// Both the detector and the adjudication script import these, so the certified definition and
// the sample that justified it cannot drift apart.

export const pWords = l => l.trim().split(/\s+/).filter(Boolean)
export const pNorm = w => w.toLowerCase().replace(/[^a-z0-9']/g, '')

/** A question series is not a directive series; the frame includes the sentence type. */
export const pShape = l => /\?\s*$/.test(l) ? 'Q'
  : /^(follow|think|read|watch|trust|learn|expand|find|dig|remember|listen|look|ask|define|review|study|compare|track|apply|be|stay|do not|don'?t|never|always)\b/i.test(l) ? 'I'
    : 'D'

export const P_STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'is', 'was', 'are', 'were', 'be', 'been',
  'do', 'does', 'did', 'you', 'your', 'we', 'they', 'it', 'that', 'this', 'and', 'or', 'for', 'on', 'at', 'by',
  'with', 'from', 'what', 'who', 'why', 'how', 'when', 'where', 'which', 'has', 'have', 'had', 'not', 'no',
  'all', 'if', 'as'])

/** Layout, not rhetoric: bullets, numbering, and Q's >> internal-reference marker. */
export const P_ARTIFACT = /^(?:[-–—•*]|>>|\d+[.)\s])/

export const sharedPrefix = ls => {
  const t = ls.map(l => pWords(l).map(pNorm))
  let n = 0
  while (t.every(x => x[n] && x[n] === t[0][n])) n++
  return n
}

/**
 * Slot-level mirroring — the signal a prefix test cannot see.
 * "Missing 10 marker from past." / "Missing 15 marker from past." share one opening token, so a
 * prefix test scores them weak; they are the strongest parallel construction in the corpus.
 */
export const mirrorScore = ls => {
  const t = ls.map(l => pWords(l).map(pNorm))
  const len = t[0].length
  if (!t.every(x => x.length === len) || len < 2) return 0
  let same = 0
  for (let i = 0; i < len; i++) if (t.every(x => x[i] === t[0][i])) same++
  return same / len
}

/**
 * Does the run stay on one subject? Diana → "she", "the pic" → "the camera", SA → SA.
 * Two-letter tokens count: SA, MZ and DC carry the continuity in a great many drops.
 */
export const staysOnSubject = ls => {
  const content = ls.map(l => new Set(pWords(l).map(pNorm).filter(w => w.length >= 2 && !P_STOP.has(w))))
  for (let i = 1; i < ls.length; i++) {
    for (const w of content[i]) if (content[i - 1].has(w)) return true
    if (/\b(she|he|her|his|him|their|them|its|those|these)\b/i.test(ls[i])) return true
  }
  return false
}

/** One verdict for a run of consecutive lines sharing an opening token. */
export function classifyParallel(ls) {
  const shapes = new Set(ls.map(pShape))
  const pre = sharedPrefix(ls)

  if (ls.every(l => P_ARTIFACT.test(l))) return 'SOURCE_OR_FORMAT_ARTIFACT'
  if (ls.some(l => !/[A-Za-z]/.test(l))) return 'SOURCE_OR_FORMAT_ARTIFACT'
  if (new Set(ls.map(l => l.toLowerCase())).size === 1) return 'ORDINARY_REPETITION'

  // A cadence of three or more, even where the punctuation varies across the run:
  // "Hired/install _ SC? / _ Federal Judiciary? / _ DOJ / _ C_A" is one construction.
  if (ls.length >= 3) return 'TRUE_PARALLEL_EMPHASIS'
  if (mirrorScore(ls) >= 0.5) return 'TRUE_PARALLEL_EMPHASIS'
  if (pre >= 2) return 'TRUE_PARALLEL_EMPHASIS'
  if (shapes.size === 1 && staysOnSubject(ls)) return 'TRUE_PARALLEL_EMPHASIS'

  if (shapes.size === 1 && [...shapes][0] === 'Q') return 'QUESTION_SERIES_WITHOUT_EXTRA_EMPHASIS'
  return 'NEEDS_CONTEXT'
}

/** Which rule carried it — recorded on every certified occurrence as its evidence. */
export function parallelBasis(ls) {
  if (ls.length >= 3) return `${ls.length} consecutive lines in one frame`
  const m = mirrorScore(ls)
  if (m >= 0.5) return `mirrored construction — ${Math.round(m * 100)}% of positions identical`
  const pre = sharedPrefix(ls)
  if (pre >= 2) return `${pre}-word frame repeated`
  return 'repeated frame continuing the same subject'
}

/**
 * A token capitalised in 80–89% of its appearances is weak contrast — the capitals are close to
 * being that word's normal spelling. COVID and MIL sit here. Such a token counts only where the
 * line around it is genuinely lowercase prose, so the capitals visibly stand out; otherwise the
 * occurrence goes to the borderline queue rather than into the certified count.
 */
export const BORDERLINE_CAPS_LO = 0.8
export const BORDERLINE_CAPS_HI = 0.9
export const BORDERLINE_NEEDS_LINE_CAPS_UNDER = 0.25

export const EMPHASIS_NOTE =
  'Emphasis records concrete formatting, repetition, punctuation, or rhetorical structure Q used to draw attention to language. It does not infer importance merely because a phrase is cryptic, political, or written in Q’s usual style.'
