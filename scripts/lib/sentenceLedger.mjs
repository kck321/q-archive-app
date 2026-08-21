// SENTENCES WITH CHARACTER OFFSETS — the identity every occurrence is keyed by.
//
// WHY THIS EXISTS. The archive has identified analysis records by their TEXT since the beginning,
// and four separate defects in one week came from that single decision:
//
//   · a dedupe collapsed 48 legitimate in-post repeats, because "Fantasy land." written four times
//     in #111 is four occurrences and one string
//   · 64 repaired claims silently lost every attribute, because claimMeta is keyed by claim text
//     and the text had changed
//   · a repair went missing because #1319 stores a literal tab where the artifact stored a space
//   · the same wording in two sections collided as if it were one thing
//
// Text is not an identity. An occurrence is a POST, a KIND, and a RANGE OF CHARACTERS, and this
// module is where that range comes from.
//
// OFFSETS ARE INTO THE RUNTIME BODY, never the raw archive encoding. runtimeText() strips the
// board's markup and decodes its entities, and the renderer matches against exactly those
// characters — so a ledger built on the raw string would hand every consumer offsets that are
// wrong by however many "&gt;" the drop contains.
import { runtimeText } from './runtimeText.mjs'

// Tokens that end in "." WITHOUT ending a sentence. unitsFor() splits on /([?!.])(\s+)(?=[A-Z...])/
// and therefore cuts "Mr. President", "Army Lt. Gen.", "U.S. Senate" and "Harris v. McRae" in half
// — 227 of its 29,569 units end at one of these. This ledger refuses those boundaries.
const ABBREVIATIONS = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Rev', 'Hon',
  'Sen', 'Rep', 'Gov', 'Gen', 'Col', 'Lt', 'Adm', 'Capt', 'Sgt', 'Maj', 'Cmdr', 'Det',
  'Jr', 'Sr', 'St', 'Ave', 'Dept', 'Univ', 'Inc', 'Corp', 'Co', 'Ltd',
  'vs', 'v', 'No', 'Nos', 'Art', 'Sec', 'Fig', 'Vol', 'pp', 'al', 'etc', 'approx', 'est',
]
const ABBR_RE = new RegExp(`(?:^|[\\s(\\[“"'])(?:${ABBREVIATIONS.join('|')})\\.$`, 'i')
// A single initial: "H. Biden", "A. Merkel", "N. Korea", "DONALD J. TRUMP". Also "U.S.", "D.C." and
// any other dotted acronym, which is the same shape repeated.
//
// Written as `(?:[A-Z]\.)+` and NOT `(?:[A-Z]\.)+[A-Z]?\.` — the second form demands two dotted
// segments, so it matched "U.S." and missed the bare "H." that started this whole repair.
const INITIAL_RE = /(?:^|[\s(["'])(?:[A-Z]\.)+$/

/** Would ending a sentence at `head` cut an abbreviation in half? */
export function endsWithAbbreviation(head) {
  const h = String(head ?? '')
  return ABBR_RE.test(h) || INITIAL_RE.test(h)
}

/** `p0097-s044` — stable, sortable, and readable in a manifest. */
export const sentenceIdFor = (postNum, index) =>
  `p${String(postNum).padStart(4, '0')}-s${String(index).padStart(3, '0')}`

/**
 * Split one post's runtime body into sentences carrying exact offsets.
 *
 * Boundaries, in order of authority:
 *   1. a newline ALWAYS ends a sentence — Q writes one thought per line and the renderer paints
 *      per line, so a span crossing a line break has no contiguous box to live in
 *   2. inside a line, ".", "?" or "!" followed by whitespace and a capital or digit
 *   3. unless the text before it ends in an abbreviation, in which case the sentence continues
 *
 * Board pointers (">>11070453") are skipped: they are navigation, not prose, and no section
 * certifies them.
 */
export function sentencesFor(rawText, postNum) {
  const text = runtimeText(rawText ?? '')
  const out = []
  let index = 0

  const push = (start, end) => {
    const raw = text.slice(start, end)
    const lead = raw.length - raw.trimStart().length
    const trail = raw.length - raw.trimEnd().length
    const s = start + lead
    const e = end - trail
    if (e <= s) return
    const body = text.slice(s, e)
    if (/^(?:>|&gt;){0,2}\s*\d{5,}$/.test(body)) return       // a bare board pointer
    out.push({ sentenceId: sentenceIdFor(postNum, index++), index: out.length, start: s, end: e, text: body })
  }

  // Walk line by line, so a newline can never be swallowed into a sentence.
  let lineStart = 0
  for (let i = 0; i <= text.length; i++) {
    if (i !== text.length && text[i] !== '\n') continue
    const lineEnd = i
    // Within the line, break on terminal punctuation that is not part of an abbreviation.
    let segStart = lineStart
    for (let j = lineStart; j < lineEnd; j++) {
      if (!'.?!'.includes(text[j])) continue
      // consume a run of terminators ("?!", "...")
      let k = j
      while (k + 1 < lineEnd && '.?!'.includes(text[k + 1])) k++
      const after = text.slice(k + 1, lineEnd)
      const m = after.match(/^(\s+)(?=[A-Z(“"'\[]|\d)/)
      if (!m) { j = k; continue }
      const head = text.slice(segStart, k + 1)
      if (endsWithAbbreviation(head)) { j = k; continue }
      push(segStart, k + 1)
      segStart = k + 1 + m[1].length
      j = segStart - 1
    }
    push(segStart, lineEnd)
    lineStart = i + 1
  }
  return out
}

/**
 * Every position at which `value` occurs in the runtime body, as [start, end] pairs.
 *
 * Returns ALL of them, in order, so a caller can bind the Nth certified occurrence of a repeated
 * line to the Nth position in the drop instead of collapsing them.
 */
export function occurrencesOfSpan(rawText, value) {
  const text = runtimeText(rawText ?? '')
  const v = String(value ?? '')
  if (!v.trim()) return []
  const hits = []
  let from = 0
  for (;;) {
    const at = text.indexOf(v, from)
    if (at < 0) break
    hits.push([at, at + v.length])
    from = at + Math.max(1, v.length)
  }
  if (hits.length) return hits
  // Whitespace-tolerant fallback, for spans Q wrapped across a line break. Same rule runtimeSpan
  // uses — the ledger must be able to place a span the materialisers could already resolve.
  try {
    const rx = new RegExp(v.split(/\s+/).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g')
    let m
    while ((m = rx.exec(text)) !== null) {
      hits.push([m.index, m.index + m[0].length])
      if (m.index === rx.lastIndex) rx.lastIndex++
    }
  } catch { /* an unusable pattern is a miss, not a crash */ }
  return hits
}

/** The sentence a [start,end) range sits in, or null when it spans more than one. */
export function sentenceAt(sentences, start, end) {
  const holder = sentences.find(s => start >= s.start && end <= s.end)
  if (holder) return holder
  return null
}
