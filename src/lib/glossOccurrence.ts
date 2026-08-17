// ONE GLOSSARY OCCURRENCE, SPREAD ACROSS SEVERAL RENDERED SEGMENTS.
//
// `glossSegments.ts` answers "where is this term inside a run of text?". It cannot answer the
// question this file exists for, because by the time the reader sees a drop the term may not be in
// a run of text at all. The certified annotation layer cuts the line into intervals first, so
// "ABC NEWS" arrives at the glossary as two siblings — <mark>ABC</mark> and <mark> NEWS</mark> —
// and "SUPREME COURT" as three, the middle one being the single space between the words.
//
//     ABC NEWS            <mark>ABC</mark>  <mark> NEWS</mark>
//     ADAM SCHIFF         <mark>ADAM </mark>  <mark>SCHIFF</mark>
//     SUPREME COURT       <mark>SUPREME</mark>  <mark> </mark>  <mark>COURT</mark>
//
// A matcher that requires the phrase to live in one text node finds none of those, which is why
// six terms had no info box while the archive plainly certifies the reading. Merging the segments
// is not an option: each one is a certified interval with its own colour, and the boundary between
// them is data, not decoration.
//
// So the phrase is matched against the CONCATENATION of the siblings and mapped back onto them.
// Every part of one occurrence carries one identifier, and the renderer decides from that plan
// which single segment becomes the reader's control.
//
// PURE, and deliberately so. The first attempt at multi-word support lived in the JSX, fixed #2401
// and broke BO and CM in #1828, and every guess cost a 90-second browser round trip. The string
// arithmetic here is proved in milliseconds by scripts/test-gloss-occurrence.mjs.
// The explicit extension is what lets Node's type stripping load this file directly, which is what
// lets the plan be proved without a browser. `allowImportingTsExtensions` is already on and Vite
// resolves it unchanged, so the app is not paying for the test's convenience.
import { segmentGloss } from './glossSegments.ts'

/** One segment's share of an occurrence: a half-open range inside sibling `index`. */
export interface OccurrencePart {
  index: number
  start: number
  end: number
}

export interface SplitOccurrence {
  /** The glossary key this occurrence resolves against. */
  token: string
  /** The matched text exactly as the drop spells it, across all its parts. */
  text: string
  /** Which occurrence of this token it is within the sibling list, counting from 0. */
  ordinal: number
  /** In document order. Always two or more — a single-segment match is not this file's business. */
  parts: OccurrencePart[]
}

/**
 * The identifier every segment of one occurrence shares.
 *
 * DERIVED, NEVER COUNTED AT RENDER TIME. A counter would renumber the same occurrence whenever the
 * component re-rendered or a neighbouring annotation changed, and the delegation that opens one
 * card from three separate segments is only correct while the three agree on the name. Post number
 * plus token plus ordinal is the same string on every render of the same drop.
 *
 * The ordinal counts occurrences of the token in the whole line, split or not, so a term does not
 * change identity on the day an annotation boundary appears next to it.
 */
export function occurrenceId(postNum: number, token: string, ordinal: number): string {
  const slug = token.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `qg-${postNum}-${slug || 'term'}-${ordinal}`
}

/**
 * Plan the occurrences that straddle a sibling boundary.
 *
 * `texts` is the rendered text of each sibling, in order. The return value covers only the matches
 * that touch two or more of them — a match that sits inside one sibling already had a working path
 * and is deliberately left on it, so this file can only ever add a box where there was none.
 *
 * Guarantees, all asserted by the test suite:
 *   · concatenating a plan's parts reproduces `text` exactly
 *   · every part lies inside its sibling
 *   · parts are contiguous in document order and never overlap another plan
 */
export function planSplitOccurrences(texts: string[], tokens: string[]): SplitOccurrence[] {
  if (texts.length < 2 || !tokens.length) return []
  const joined = texts.join('')
  if (!joined) return []

  const starts: number[] = []
  let acc = 0
  for (const t of texts) { starts.push(acc); acc += t.length }

  const out: SplitOccurrence[] = []
  const seen = new Map<string, number>()
  let at = 0
  for (const seg of segmentGloss(joined, tokens)) {
    const start = at
    at += seg.text.length
    if (!seg.token) continue
    // Counted for EVERY match, including the ones that stay inside one sibling, so the ordinal is
    // a property of the drop rather than of today's annotation layout.
    const ordinal = seen.get(seg.token) ?? 0
    seen.set(seg.token, ordinal + 1)

    const end = start + seg.text.length
    const parts: OccurrencePart[] = []
    for (let i = 0; i < texts.length; i++) {
      const s = starts[i]
      const e = s + texts[i].length
      const from = Math.max(start, s)
      const to = Math.min(end, e)
      // `to > from` and not `>=`: a zero-width overlap is a sibling the phrase merely touches,
      // and marking it would put an occurrence identifier on text the reader is not being told
      // anything about.
      if (to > from) parts.push({ index: i, start: from - s, end: to - s })
    }
    if (parts.length >= 2) out.push({ token: seg.token, text: seg.text, ordinal, parts })
  }
  return out
}
