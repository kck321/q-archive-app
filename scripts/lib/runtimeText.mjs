// The rendering coordinate system.
//
// SERIALIZATION PROVENANCE RULE
//   Raw source preserves provenance. Runtime-normalized text defines rendering coordinates.
//   Certified semantics remain independent of both.
//
// posts.json holds the board's original encoding — `&amp;`, `&gt;`, `<em>` markup — because that
// is the archive's provenance and must not be rewritten. The app decodes and strips all of it at
// seed time, so the browser never displays that representation. A rendering span derived against
// the raw file therefore locates text that does not exist on screen.
//
// That mistake produced 2,475 wrong spans in one afternoon: 2,084 Evidence references, 161
// Questions, 120 Claims, 82 Checkable. Every one of them "fixed" a mismatch that only existed on
// disk. The 255 whitespace cases were real, which is what made the error hard to see — half the
// recovery was necessary.
//
// This function is the single definition, shared by the materialisers and asserted against the
// seed-time normalisation in src/lib/localData.ts. If the two ever diverge, spans silently stop
// resolving and nothing else notices.

/** Board markup that 8chan rendered and the app strips before display. */
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi

/** HTML entities stored raw in the archive. `&gt;` is decoded LAST so a decoded `>` is never re-read as markup. */
const ENTITIES = [
  [/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"],
  [/&lt;/gi, '<'], [/&gt;/gi, '>'],
]

/** The exact text the browser renders for a post body. */
export function runtimeText(raw) {
  if (!raw) return raw ?? ''
  let out = String(raw).includes('<') ? String(raw).replace(MARKUP, '') : String(raw)
  if (out.includes('&')) for (const [rx, ch] of ENTITIES) out = out.replace(rx, ch)
  return out
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The literal span for `value` in the RUNTIME body, or null.
 *
 * Entity decoding is not attempted here — the runtime body has already been decoded, so a
 * certified value carrying `&` matches directly. Only whitespace tolerance remains, for spans Q
 * wrapped across lines, and that is the half of the old recovery which was genuinely needed.
 */
export function runtimeSpan(rawPostText, value, opts = {}) {
  const text = runtimeText(rawPostText)
  const v = String(value ?? '')
  if (!v.trim()) return null
  if (text.includes(v)) return v            // certified value already matches — no override needed
  try {
    const m = new RegExp(v.split(/\s+/).map(esc).join('\\s+')).exec(text)
    if (m) return m[0]                      // whitespace-reconstructed span
  } catch { /* fall through to the URL matcher */ }

  // A MATCHING RULE, NOT A NORMALISATION RULE.
  //
  // The board broke long URLs after the protocol: a drop carries `https:// www.youtube.com/...`
  // for a certified `https://www.youtube.com/...`. That is not a different text REPRESENTATION —
  // runtimeText() is right that the browser renders exactly those characters — it is a question of
  // how to LOCATE a certified occurrence within them. Deliberately kept out of runtimeText(): a
  // representation function that absorbs content-specific repairs turns back into the bag of
  // heuristics this rebuild removed.
  if (opts.allowProtocolWhitespace) {
    try {
      const body = v.replace(/^https?:\/\//i, '')
      const m2 = new RegExp(`(?:https?:\\/\\/\\s*)?${esc(body)}`).exec(text)
      if (m2) return m2[0]
    } catch { /* unmatchable */ }
  }
  return null
}
