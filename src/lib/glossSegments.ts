// Finding a multi-word glossary term inside a run of rendered text.
//
// WHY THIS IS ITS OWN MODULE. The token splitter in applyGlossary walks single words —
// `([A-Za-z0-9][A-Za-z0-9._+/-]*)` — so a two-word name can never be rebuilt from two separate
// parts. 19 glossed tokens contain a space (WASH POST, SNOW WHITE, NO NAME, CLINTON FOUNDATION,
// ROD ROSENSTEIN…), and every one of them only ever worked where it happened to be its own
// certified highlight span. In #2401 all three "WASH POST"s sit inside larger Question marks, so
// the whole-node branch never fired either and the reader got no box on the one drop the box was
// written for.
//
// The first attempt at the fix lived inside applyGlossary, mixed into the JSX, and it broke BO and
// CM in #1828 — a drop that happens to contain "NO NAME". Debugging that meant a 90-second browser
// round trip per guess. So the string work lives here, as a pure function over strings, provable in
// milliseconds and exhaustively: `scripts/test-gloss-segments.mjs` covers all 19 tokens, repeats,
// boundaries, punctuation and the exact text of the drops that regressed.
//
// WHAT IT DOES NOT DO: it does not decide whether a term is glossed in a given drop, does not touch
// post text, and returns the matched text EXACTLY as the drop spells it. Case, punctuation and
// whitespace come back verbatim; only the lookup is normalised.

export interface GlossSegment {
  /** The text exactly as it appears in the drop. Never normalised, never re-cased. */
  text: string
  /** The glossary key this segment matches, or null for the text between matches. */
  token: string | null
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A term may be written across a line break or with doubled spaces — the board wraps long lines —
 * so the words are joined by `\s+` rather than a literal space. The boundaries are the same
 * "not alphanumeric" rule the rest of the archive uses, which is what keeps "NO NAME" out of
 * "NO NAMED" and stops any partial-word match.
 */
function buildPattern(tokens: string[]): RegExp | null {
  const multi = tokens.filter(t => /\s/.test(t))
  if (!multi.length) return null
  // Longest first, so "ABC NEWS" is never consumed by a shorter overlapping alternative.
  const ordered = [...multi].sort((a, b) => b.length - a.length)
  const alts = ordered.map(t => t.trim().split(/\s+/).map(esc).join('\\s+'))
  return new RegExp(`(?<![A-Za-z0-9])(?:${alts.join('|')})(?![A-Za-z0-9])`, 'gi')
}

/** Normalised form used only for looking a match back up in the token list. */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Split `text` into alternating unmatched runs and multi-word glossary terms.
 *
 * Always returns a complete cover of the input: concatenating every `text` reproduces the original
 * string exactly. That is the property that makes this safe to render — no character can be lost,
 * duplicated or reordered by a matching bug.
 */
export function segmentGloss(text: string, tokens: string[]): GlossSegment[] {
  const rx = buildPattern(tokens)
  if (!rx || !text) return [{ text, token: null }]

  const byNorm = new Map<string, string>()
  for (const t of tokens) if (/\s/.test(t)) byNorm.set(norm(t), t)

  const out: GlossSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  rx.lastIndex = 0
  while ((m = rx.exec(text)) !== null) {
    // A zero-length match would loop forever. It cannot happen with these patterns, but a guard
    // costs nothing and a hung render costs everything.
    if (m[0].length === 0) { rx.lastIndex++; continue }
    const key = byNorm.get(norm(m[0]))
    if (!key) continue
    if (m.index > last) out.push({ text: text.slice(last, m.index), token: null })
    out.push({ text: m[0], token: key })
    last = m.index + m[0].length
  }
  if (!out.length) return [{ text, token: null }]
  if (last < text.length) out.push({ text: text.slice(last), token: null })
  return out
}

/** Every multi-word key in a glossary, for callers that hold the whole map. */
export function multiWordTokens(gloss: Record<string, unknown>): string[] {
  return Object.keys(gloss).filter(k => /\s/.test(k))
}
