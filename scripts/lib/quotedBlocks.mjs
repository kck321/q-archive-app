// Block-level quoted / source-material detection, shared so no auditor forks it.
//
// Per-line detection is not enough, and that is exactly how source text leaked into Claims:
// Q pastes the Declaration of Independence and 1 Corinthians 13 across SEVERAL lines, and a
// per-line scripture test caught only the opening line. Every continuation line then scored as
// Q's own assertion.
//
// A quotation mark on its own is NOT sufficient evidence either. Q quotes words inside his own
// sentences constantly — `Define 'Projection'.`, `Think "BIG PICTURE".` — and treating any
// quoted text as source material would delete thousands of genuine Q units. So this works on
// BLOCKS and CONTEXT: where a passage starts, how far it runs, and what ends it.
//
// Nothing is deleted. Lines are returned with a reason so callers can file them as
// QUOTED_SOURCE with provenance.

/** Seeds for passages Q reproduces verbatim from an external text. */
const SOURCE_SEEDS = [
  // scripture — the openers Q actually uses
  [/^(love is patient|love is kind|love does not|it always protects|for our struggle is not|put on the full armor|therefore put on|stand firm then|take the helmet|take up the shield|give us this day|help us to avoid|our father,? who art|the lord is my shepherd|be strong and courageous)/i, 'scripture'],
  // founding documents
  [/^(prudence, indeed|when in the course of human events|we hold these truths|that whenever any form of government|governments long established|but when a long train|he has refused|and for the support of this declaration)/i, 'founding document'],
  [/^[–—-]\s*that whenever any form of government/i, 'founding document'],
  // pasted definitions / dictionary blocks
  [/^(noun|verb|adjective|adverb)\s*$/i, 'dictionary entry'],
  [/^synonyms\s*:/i, 'dictionary entry'],
  [/^\d+\.\s*\[?[a-z]/, 'numbered definition'],
]

/** A line that unmistakably belongs to Q rather than to a quoted passage. Ends a block. */
const Q_MARKER = /^(q\+?$|wwg1wga|ncswic)|^\[[A-Z_\d\s|+-]+\]$|^>>\d+/i

const isBlank = l => !l.trim()
const quoteParity = l => {
  const marks = (l.match(/["“”]/g) ?? []).length
  return marks % 2 === 1
}

/**
 * A line ENDING in a closing quotation mark closes the quotation, whatever the parity says.
 *
 * #1881 pastes a whole article on one line carrying five quote marks — an odd count, so parity
 * reported an unbalanced quote still open, and the block ran on to swallow Q's own commentary:
 * PURE EVIL. / [[[[HUNTERS]]]] BECOME THE HUNTED. Nested quotations inside a passage make parity
 * unreliable; where the passage visibly ends, it ends.
 */
const CLOSES_QUOTE = /[”"]\s*$/

/**
 * Identify source-material lines in one post.
 *
 * @param {string} text  cleaned post text
 * @returns {Map<number, string>} line index → reason
 */
export function sourceLines(text) {
  const lines = (text ?? '').split('\n')
  const out = new Map()
  const mark = (i, reason) => { if (!out.has(i)) out.set(i, reason) }

  let openQuote = -1          // index where an unbalanced quote opened
  let seedRun = null          // { reason, until } while inside a seeded passage

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const l = raw.trim()

    // ── greentext: a single ">" excerpt, NOT a ">>123456" post pointer ──────
    if (/^>(?!>)/.test(l)) { mark(i, 'greentext excerpt'); continue }

    // ── an unbalanced quote opens a block and runs until it closes ──────────
    // BOUNDED, because a stray quote mark that never closes would otherwise swallow the whole
    // remainder of the drop. In #520 a pasted tweet leaves an unbalanced quote and the run
    // reached Q's own closing lines, marking "Future proves past." as quoted material when it
    // is Q's own. A quotation also cannot survive a blank line or one of Q's marker lines.
    if (openQuote >= 0) {
      if (isBlank(l) || Q_MARKER.test(l) || i - openQuote > 15) { openQuote = -1 }
      else {
        mark(i, 'inside a multi-line quotation')
        if (quoteParity(l) || CLOSES_QUOTE.test(l)) openQuote = -1      // this line closes it
        continue
      }
    }
    if (quoteParity(l) && !CLOSES_QUOTE.test(l) && l.length > 0) {
      // Opens a quotation that does not close on this line.
      openQuote = i
      mark(i, 'opens a multi-line quotation')
      continue
    }

    // ── seeded external passages, continued across lines ────────────────────
    if (seedRun) {
      const ended = isBlank(l) || Q_MARKER.test(l) || i > seedRun.until
      if (!ended) { mark(i, `${seedRun.reason} (continuation)`); continue }
      seedRun = null
    }
    let seeded = false
    // Seeds are anchored with ^, so the opening quote mark or dash has to come off first:
    // `"We hold these truths to be self-evident…` and `“That whenever any Form of Government…`
    // are the Declaration, and both were missed purely because of the leading character.
    const bare = l.replace(/^["“”'‘’–—-]+\s*/, '')
    for (const [rx, reason] of SOURCE_SEEDS) {
      if (rx.test(bare)) {
        mark(i, reason)
        // Run on for a bounded number of lines — long enough for a passage, short
        // enough that a mis-seed cannot swallow a whole drop.
        seedRun = { reason, until: i + 12 }
        seeded = true
        break
      }
    }
    if (seeded) continue

    // ── pasted FAQ / Q&A pairs ─────────────────────────────────────────────
    if (/^q\s*:\s/i.test(l) && /^a\s*:\s/i.test((lines[i + 1] ?? '').trim())) {
      mark(i, 'quoted FAQ question')
      mark(i + 1, 'quoted FAQ answer')
      continue
    }
    if (/^a\s*:\s/i.test(l) && /^q\s*:\s/i.test((lines[i - 1] ?? '').trim())) {
      mark(i, 'quoted FAQ answer')
      continue
    }

    // ── sustained flowing prose ────────────────────────────────────────────
    // The structural signal, rather than an ever-longer seed list. Q writes telegraphically:
    // the median line is a handful of words. A RUN of consecutive long, flowing prose lines
    // with no Q markers is almost always something pasted in — Psalm 23, the Declaration, a
    // news article. One long line proves nothing; a run of them does.
    if (!out.has(i)) {
      const isProse = l => {
        const s = l.trim()
        if (s.split(/\s+/).length < 12) return false
        if (/^\[|\]$/.test(s) || Q_MARKER.test(s)) return false
        if (s === s.toUpperCase()) return false          // all-caps is Q's own emphasis
        if (/\?$/.test(s)) return false                  // a long question is Q asking
        return /^[A-Z"“(]/.test(s) || /^[a-z]/.test(s)
      }
      if (isProse(l) && isProse(lines[i + 1] ?? '')) {
        let j = i
        while (j < lines.length && isProse(lines[j])) { mark(j, 'sustained prose block — pasted or quoted passage'); j++ }
        i = j - 1
        continue
      }
    }

    // ── source excerpt introduced by a bare URL ────────────────────────────
    // A link on its own line, then an indented or quoted excerpt beneath it.
    if (/^(https?:\/\/|www\.)\S+$/i.test(l)) {
      const next = lines[i + 1] ?? ''
      if (/^\s{2,}\S/.test(next) || /^["“]/.test(next.trim())) mark(i + 1, 'excerpt beneath a source link')
      continue
    }
  }
  return out
}

/** Convenience: is this exact unit text inside a source block for the post? */
export function unitIsSource(sourceMap, startLine, endLine) {
  for (let i = startLine; i <= endLine; i++) if (sourceMap.has(i)) return sourceMap.get(i)
  return null
}
