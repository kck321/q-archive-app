// Literal-span recovery — RENDERING_PROVENANCE_RULE, factored out.
//
// This is now the fifth layer needing it (themes, entities, evidence, emphasis, context), so it
// stops being copied and becomes one function. Certified values are stored decoded and
// whitespace-normalised because that is the readable form; the raw drop the renderer matches
// against holds the board's HTML entities and Q's original line breaks.
//
//   certified : "SA -> NK."        raw : "SA -&gt; NK."
//   certified : "For God & Country" raw : "For God &amp; Country"
//   certified : "one sentence"      raw : "one\nsentence"
//
// Returns the exact characters the span occupies in the raw text, or null when the certified
// value corresponds to nothing there — which is a certification conflict, not a rendering bug,
// and must never be papered over by loosening the match.

const esc = ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A pattern accepting every way the board rewrote the text, capturing what is actually present. */
export function literalPattern(value) {
  return String(value).split('').map(ch => {
    if (ch === '&') return '&(?:amp;)?'
    if (ch === '>') return '(?:>|&gt;)'
    if (ch === '<') return '(?:<|&lt;)'
    if (ch === '"') return '(?:"|&quot;|[“”])'
    if (ch === "'") return "(?:'|&#039;|&apos;|[‘’])"
    // Any run of whitespace, so a unit joined across Q's line breaks still resolves.
    if (/\s/.test(ch)) return '\\s+'
    return esc(ch)
  }).join('')
}

/** The literal form of `value` as it appears in `raw`, or null. */
export function literalSpan(raw, value) {
  const text = String(raw ?? '')
  const v = String(value ?? '')
  if (!v.trim()) return null
  if (text.includes(v)) return v
  try {
    const m = new RegExp(literalPattern(v)).exec(text)
    return m ? m[0] : null
  } catch { return null }
}
