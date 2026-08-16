// SOURCE SPANS v2 — SHADOW MODE. NOTHING IN THE APP CONSUMES THIS FILE.
//
// A parallel provenance parser built alongside sourceLines(), never in place of it.
// sourceLines() stays byte-identical and all 15 certified consumers stay on it until a
// separate, later migration. This file is additive: import it, run it, diff it, argue with it.
//
// ─── Why a second parser rather than a patch ─────────────────────────────────
//
// sourceLines() answers "which LINE INDICES look quoted", and three of its failure modes are
// structural rather than tunable:
//
//   1. It cannot see a sentence that spans lines. `God bless,\nQ` is stored as the single
//      phrase "God bless, Q", and a per-line `includes()` finds it nowhere — so 19 Directive
//      records are NOT_LOCATED purely because the lookup unit is a line and the stored unit
//      is a sentence.
//   2. Its `sustained prose` rule marks any run of two long flowing lines as pasted material.
//      #3 (17 lines, telegraphic, Q-signed) has two long lines in the middle and BOTH are
//      marked quoted — including the gold-fixture sentence "Don't you think POTUS would be
//      tweeting about removal given clear conflict." That is Q's own text ruled third-party.
//   3. `^>` means quoted excerpt. By 2020 Q uses `>` as his own bullet arrow: eight lines of
//      #3896 are Q enumerating his own questions and every one is marked quoted.
//
// The fix in all three cases needs CHARACTER OFFSETS and REGIONS, not line membership. So V2
// returns contiguous spans over a composed document: the post body plus each quoted-post
// payload as its own region, every span carrying where it starts, where it ends, who wrote
// it, and WHY the parser thinks so.
//
// ─── Non-negotiable rules, encoded ───────────────────────────────────────────
//
//   1. NOT_LOCATED never defaults to quoted.            (locate() returns null; no fallback)
//   2. An "Anonymous" board label proves nothing.       (name/trip are never read for authorship)
//   3. Canonical body text is Q body unless structural  (BODY region default is Q_BODY)
//      evidence identifies an embedded source.
//   4. Earlier posts reproduced inside a later drop are (QUOTED_POST regions are never Q body)
//      quoted context, never newly authored here.
//   5. Repeated wording resolves by occurrence offset.  (locateAll + occurrence index)
//   6. Unresolvable both-places wording is AMBIGUOUS.   (crossRegion → AMBIGUOUS_MULTIPLE_MATCHES)
//   7. A Q signature never joins the preceding sentence.(SIGNATURE spans are cut out first)
//   8. A directive never concatenates with a URL.       (URL_LINE spans are cut out first)
//   9. Scraped code never becomes a natural-language    (CODE_OR_TECHNICAL_TEXT runs)
//      Directive.
//
// READ-ONLY over posts.json. Writes nothing.

// ─── Provenance vocabulary ───────────────────────────────────────────────────

export const AUTHORSHIP = {
  Q: 'Q_AUTHORED_CURRENT_POST',
  QUOTED: 'QUOTED_OR_EMBEDDED',
  NOT_LOCATED: 'NOT_LOCATED',
  AMBIGUOUS: 'AMBIGUOUS_MULTIPLE_MATCHES',
}

export const SOURCE_TYPE = {
  Q_BODY: 'Q_BODY',
  QUOTED_PRIOR_Q_POST: 'QUOTED_PRIOR_Q_POST',
  QUOTED_ANONYMOUS_POST: 'QUOTED_ANONYMOUS_POST',
  QUOTED_THIRD_PARTY: 'QUOTED_THIRD_PARTY',
  QUOTED_SCRIPTURE: 'QUOTED_SCRIPTURE',
  QUOTED_PRAYER: 'QUOTED_PRAYER',
  EMBEDDED_LETTER: 'EMBEDDED_LETTER',
  // Q writing a reply in letter register. Q-AUTHORED, not quoted — see pass 4.
  Q_BODY_LETTER_VOICE: 'Q_BODY_LETTER_VOICE',
  ATTACHED_IMAGE: 'ATTACHED_IMAGE',
  SCREENSHOT: 'SCREENSHOT',
  CODE_OR_TECHNICAL_TEXT: 'CODE_OR_TECHNICAL_TEXT',
  UNKNOWN: 'UNKNOWN',
}

// Structural sub-kinds that are Q-authored but are NOT prose the classifiers should read as a
// sentence. They are cut into their own spans so nothing downstream can glue them to a neighbour.
export const STRUCTURE = {
  SIGNATURE: 'Q_SIGNATURE',
  POINTER: 'BOARD_POINTER',
  URL: 'URL_LINE',
  PROSE: 'PROSE',
}

// ─── Text hygiene ────────────────────────────────────────────────────────────
// Deliberately a local copy of clean() rather than an import: segment.mjs is shared with the
// FROZEN question auditor, and a shadow parser must not be able to perturb a frozen consumer
// by so much as a changed regex. Kept identical on purpose — verified by a fixture below.

const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const ENTITIES = [[/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"], [/&lt;/gi, '<'], [/&gt;/gi, '>']]

export const cleanText = t => {
  let o = (t ?? '').replace(MARKUP, '')
  for (const [r, c] of ENTITIES) o = o.replace(r, c)
  return o
}

/**
 * Fold the typography that differs between a stored phrase and the post body it came from.
 *
 * STRICTLY 1:1 PER CHARACTER. The flat stream carries a parallel index array mapping every
 * emitted character back to (line, offset); a fold that changed length desyncs it and the hit
 * is then silently dropped. It was: an earlier draft expanded the single ellipsis character to
 * three dots, and the two posts built on Q's long ellipsis runs (#524, #2072) came back
 * NOT_LOCATED for phrases plainly present in their bodies. Anything added here must replace one
 * character with exactly one.
 */
export const fold = s => String(s ?? '')
  .replace(/[‘’ʼ]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—‒]/g, '-')
  .replace(/ /g, ' ')
  .toLowerCase()

// ─── Structural detectors ────────────────────────────────────────────────────

/** A Q sign-off line. Rule 7: this is cut out so no sentence can absorb it. */
const SIGNATURE_LINE = /^(q\+?|q\s*!\S+|wwg1wga!?|ncswic!?)[.!]?$/i

/** `>>123456` board pointer — NOT greentext. */
const POINTER_LINE = /^>>\s*(\d{1,10})\b/

/** A line that is only a URL. Rule 8: cut out so no directive can absorb it. */
const URL_ONLY_LINE = /^\(?(?:https?:\/\/|www\.)\S+\)?$/i

/** Single `>` arrow. Q's own bullet by 2019-2020; a board excerpt in 2017-2018. Corroborate. */
const GREENTEXT_LINE = /^>(?!>)\s*\S/

const SCRIPTURE_SEED = [
  /^(love is patient|love is kind|love does not|it always protects)/i,
  /^(for our struggle is not|put on the (full|whole) armou?r of god|therefore put on|stand firm then|take (up )?the (helmet|shield))/i,
  /^(finally,?\s+)?be strong in the lord\b/i,
  /^(be strong and courageous|with this in mind, be alert|be on your guard; stand firm)/i,
  /^and pray in the spirit on all occasions/i,
  /^for now we see (only )?a reflection/i,
  /^(the lord is my shepherd|he makes me lie down|you prepare a table before me|surely your goodness)/i,
  // NOT `have faith in god` — OWNER RULING R3. In #4429 it is the third line of Q's own parallel
  // triple (Humanity / Yourself / God), two lines below where the pasted Ephesians block ends.
  // Seeding it as scripture ruled a Q-authored directive out of the section.
  /^(ask and (you shall|it will be)|put to death, therefore)/i,
  /^(i can do all things through|the lord bless you and keep you|trust in the lord with all)/i,
  // A book:chapter:verse citation line is itself part of the reproduced passage, not Q's prose.
  /^(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|(1|2|first|second)?\s*corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\s+\d+[:\d\s,–—-]*$/i,
]

const PRAYER_SEED = [
  /^(our father,? who art in heaven|hallowed be thy name|thy (kingdom come|will be done)|give us this day)/i,
  /^(and )?(forgive us our trespasses|lead us not into temptation|but deliver us from|deliver us from (the )?evil)/i,
  /^(st\.? michael the archangel|be our protection against|may god rebuke him|cast (him )?down to hell)/i,
  /^(strengthen my faith|forgive my sins|make me brave|give me your wisdom|help us to avoid temptation)/i,
  /^(o my jesus|hail mary|glory be to the father)/i,
]

const FOUNDING_SEED = [
  /^(when in the course of human events|we hold these truths|that whenever any form of government)/i,
  /^(prudence, indeed|governments long established|but when a long train|he has refused|and for the support of this declaration)/i,
  /^(we the people of the united states, in order to form)/i,
]

const LETTER_OPEN = /^(dear\s+[a-z]|to whom it may concern|my fellow americans\b)/i
const LETTER_CLOSE = /^([–—-]\s*)?(sincerely|respectfully( yours)?|yours truly|warm(est)? regards|with (great )?respect|god bless america|the wh|the white house|potus)[,.]?\s*$/i

/** Strong evidence a line is scraped source code rather than English. */
// Deliberately NARROW. Two rules were tried and removed because Q's own register triggers them:
//
//   /^\s*[\w.$#-]+\s*:\s*[\w'"(-]/   a yaml/css `key: value` line — but Q labels lines that way
//                                    constantly. It pulled #321 "Post: 1:34 US Military",
//                                    #1804 "Rally: USSS threat IDEN > action taken." and
//                                    #4566 "Counter-argument: …" into the code bucket.
//   /\b(url|input|field|set|visit|log in)\b/i   ordinary English words.
//
// What remains is syntax English does not produce, and a run of two lines is still required.
const CODE_STRONG = [
  /^\s*(def|class|function|var|let|const|return|import|require|public|private)\b/,
  /\w+\s*\(\s*['"][^'"]*['"]\s*\)/,             // find('input.x')
  /\)\s*\.\s*\w+\s*\(/,                          // ).set(
  /\bENV\s*\[/,
  /=>|===|!==|&&|\|\|/,
  /^\s*[{}\[\]();]+\s*$/,
  /^\s*<\/?[a-z][\w-]*(\s[^>]*)?>\s*$/i,         // a bare HTML tag line
]
const CODE_WEAK = [
  /^\s{2,}\S/,                                   // indented continuation
  /^\s*end\s*$/i,                                // block terminator — only ever inside a run
  /\w+\(\)/,                                     // empty call parens
  /[;{]\s*$/,
]

const isBlank = l => !l.trim()

const anySeed = (line, seeds) => seeds.some(rx => rx.test(line))

const codeScore = line => {
  if (!line.trim()) return 0
  let n = 0
  for (const rx of CODE_STRONG) if (rx.test(line)) n += 2
  for (const rx of CODE_WEAK) if (rx.test(line)) n += 1
  return n
}

/**
 * Q's telegraphic register: the anchor that separates "Q wrote a long sentence" from
 * "Q pasted a paragraph". Short lines, bracket notation, all-caps emphasis, a signature.
 */
const isQRegisterLine = l => {
  const s = l.trim()
  if (!s) return false
  if (SIGNATURE_LINE.test(s)) return true
  if (/^\[.*\]$/.test(s)) return true
  if (/\[[^\]]+\]/.test(s) && s.split(/\s+/).length <= 14) return true
  if (s === s.toUpperCase() && /[A-Z]/.test(s) && s.split(/\s+/).length <= 12) return true
  return s.split(/\s+/).length <= 8
}

const isProseLine = l => {
  const s = (l ?? '').trim()
  if (s.split(/\s+/).length < 12) return false
  if (POINTER_LINE.test(s) || GREENTEXT_LINE.test(s)) return false
  if (/^\[|\]$/.test(s)) return false
  if (s === s.toUpperCase()) return false
  if (URL_ONLY_LINE.test(s)) return false
  return true
}

// ─── The offset-mapped flat stream ───────────────────────────────────────────
//
// Every region is flattened to a single whitespace-collapsed string, with an index entry per
// emitted character pointing back at (line, offset-in-line). That is what makes a stored
// phrase spanning three lines locatable at all, and what turns a hit into real start/end
// offsets instead of a line number.

function flatten(lines) {
  let flat = ''
  const at = []                                   // flat position -> { line, off }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (flat && !/\s$/.test(flat)) { flat += ' '; at.push({ line: i, off: 0, filler: true }) }
    let pendingSpace = false
    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c]
      if (/\s/.test(ch)) { pendingSpace = true; continue }
      if (pendingSpace && flat && !/\s$/.test(flat)) { flat += ' '; at.push({ line: i, off: c, filler: true }) }
      pendingSpace = false
      flat += ch
      at.push({ line: i, off: c, filler: false })
    }
  }
  return { flat, at, folded: fold(flat) }
}

// ─── Region assembly ─────────────────────────────────────────────────────────

function bodyRegion(post) {
  const text = cleanText(post.text ?? '')
  const lines = text.split('\n')
  return { kind: 'BODY', lines, ...flatten(lines) }
}

function quotedRegions(post, resolveBoardId) {
  const out = []
  const qs = post.quotedPosts ?? []
  qs.forEach((q, i) => {
    const text = cleanText(q?.text ?? '')
    const lines = text.split('\n')
    const referenced = resolveBoardId ? resolveBoardId(q?.boardId) : null
    out.push({
      kind: 'QUOTED_POST', index: i, lines, ...flatten(lines),
      boardId: q?.boardId ?? '', depth: q?.depth ?? 0,
      referencedPostNum: referenced ?? '',
      // Rule 2 in the other direction: the name/trip on a QUOTED payload is not being used to
      // decide authorship of the CURRENT post — the payload is quoted no matter who wrote it.
      // It only chooses between "prior Q post" and "anonymous board post" as the SOURCE TYPE.
      quotedAuthorIsQ: Boolean(referenced) || q?.name === 'Q' || Boolean(q?.trip),
      hasMedia: Boolean(q?.media?.length),
    })
  })
  return out
}

function mediaRegion(post) {
  const files = [...(post.media ?? []), ...(post.refMedia ?? [])]
  if (!files.length) return null
  const lines = files.map(f => String(f?.filename ?? '').replace(/[_-]+/g, ' ').replace(/\.\w+$/, '').trim()).filter(Boolean)
  if (!lines.length) return null
  const screenshot = files.some(f => /screen ?shot|scrn|capture/i.test(String(f?.filename ?? '')))
  return { kind: 'ATTACHED_IMAGE', lines, ...flatten(lines), screenshot }
}

// ─── Span classification inside the body ─────────────────────────────────────

/**
 * Walk the body once and assign every line a provisional (state, sourceType, reason, confidence).
 * Contiguous identical labels are merged into spans afterwards.
 */
function labelBody(region, ctx) {
  const { lines } = region
  const n = lines.length
  const label = new Array(n).fill(null)
  const put = (i, sourceType, reason, confidence, structure = STRUCTURE.PROSE, extra = {}) => {
    if (!label[i]) label[i] = { sourceType, reason, confidence, structure, ...extra }
  }

  // Corroboration set: everything this post demonstrably quotes, folded, for content matching.
  const quotedBlob = ctx.quotedBlob

  // ── pass 1: unambiguous single-line structures ────────────────────────────
  for (let i = 0; i < n; i++) {
    const l = lines[i].trim()
    if (!l) continue
    if (SIGNATURE_LINE.test(l)) {
      put(i, SOURCE_TYPE.Q_BODY, 'Q sign-off line, cut from the preceding sentence', 'HIGH', STRUCTURE.SIGNATURE)
      continue
    }
    const ptr = l.match(POINTER_LINE)
    if (ptr) {
      const ref = ctx.resolveBoardId(ptr[1])
      put(i, ref ? SOURCE_TYPE.QUOTED_PRIOR_Q_POST : SOURCE_TYPE.QUOTED_ANONYMOUS_POST,
        'board back-reference pointer', 'HIGH', STRUCTURE.POINTER,
        { quoted: true, referencedPostNum: ref ?? '' })
      continue
    }
    if (URL_ONLY_LINE.test(l)) {
      put(i, SOURCE_TYPE.Q_BODY, 'bare URL line, cut from the adjacent sentence', 'HIGH', STRUCTURE.URL)
      continue
    }
  }

  // ── pass 2: code runs ─────────────────────────────────────────────────────
  // Rule 9. A run scores as code when two or more neighbouring lines carry code evidence;
  // one `end` on its own is English, `end` inside a def/find run is Ruby.
  for (let i = 0; i < n; i++) {
    if (label[i] || isBlank(lines[i])) continue
    if (codeScore(lines[i]) < 2) continue
    let j = i
    while (j + 1 < n && !isBlank(lines[j + 1]) && !SIGNATURE_LINE.test(lines[j + 1].trim()) && codeScore(lines[j + 1]) >= 1) j++
    // widen backwards over indented/short lines that belong to the same block
    let k = i
    while (k - 1 >= 0 && !isBlank(lines[k - 1]) && !label[k - 1] && codeScore(lines[k - 1]) >= 1) k--
    if (j - k >= 1) {
      for (let x = k; x <= j; x++) put(x, SOURCE_TYPE.CODE_OR_TECHNICAL_TEXT, 'scraped code block — two or more lines of source-code syntax', 'HIGH')
      i = j
    }
  }

  // ── pass 3: seeded external passages ──────────────────────────────────────
  for (let i = 0; i < n; i++) {
    if (label[i]) continue
    const bare = lines[i].trim().replace(/^["'‘’“”–—-]+\s*/, '')
    let type = null, why = ''
    if (anySeed(bare, PRAYER_SEED)) { type = SOURCE_TYPE.QUOTED_PRAYER; why = 'reproduced prayer text' }
    else if (anySeed(bare, SCRIPTURE_SEED)) { type = SOURCE_TYPE.QUOTED_SCRIPTURE; why = 'reproduced scripture' }
    else if (anySeed(bare, FOUNDING_SEED)) { type = SOURCE_TYPE.QUOTED_THIRD_PARTY; why = 'reproduced founding document' }
    if (!type) continue
    let j = i
    // Run on while the following lines keep the same register: not blank, not a Q marker, and
    // still either seeded or a continuation of the passage.
    while (j + 1 < n && j + 1 <= i + 14) {
      const nx = lines[j + 1].trim()
      if (!nx || SIGNATURE_LINE.test(nx) || POINTER_LINE.test(nx) || URL_ONLY_LINE.test(nx)) break
      const bareNx = nx.replace(/^["'‘’“”–—-]+\s*/, '')
      const stillIn = anySeed(bareNx, PRAYER_SEED) || anySeed(bareNx, SCRIPTURE_SEED) || anySeed(bareNx, FOUNDING_SEED)
        || /^(and|but|as|that|for|so|then|nor|or|with|of|to|in|on)\b/i.test(bareNx)
        || /[,;]$/.test(lines[j].trim())
      if (!stillIn) break
      j++
    }
    for (let x = i; x <= j; x++) put(x, type, why + (x > i ? ' (continuation)' : ''), 'HIGH', STRUCTURE.PROSE, { quoted: true })
    i = j
  }

  // ── pass 4: letter register ───────────────────────────────────────────────
  //
  // OWNER RULING (#51): letter FORM is not evidence of an external source. #51 is a `>>` reply
  // to an Anonymous board post, answered "Dear Patriot. … -The WH". The structure is a Q-corpus
  // reply written in letter voice, and the sign-off is attribution inside that voice — not proof
  // the text was copied from somewhere. So a letter in the body is Q-authored by default and
  // only becomes EMBEDDED_LETTER on the same corroboration every other quoted call requires:
  // its wording appears in a reproduced payload, or it sits directly beneath a source link.
  for (let i = 0; i < n; i++) {
    if (label[i]) continue
    if (!LETTER_OPEN.test(lines[i].trim())) continue
    let j = i
    while (j + 1 < n && j + 1 <= i + 40) { j++; if (LETTER_CLOSE.test(lines[j].trim())) break }
    if (j <= i) continue
    const head = fold(lines[i].trim()).slice(0, 40)
    const above = (lines[i - 1] ?? '').trim()
    const external = (head.length > 8 && quotedBlob.includes(head)) || URL_ONLY_LINE.test(above)
    for (let x = i; x <= j; x++) {
      if (external) put(x, SOURCE_TYPE.EMBEDDED_LETTER, 'embedded letter matched against an external source above it', 'MEDIUM', STRUCTURE.PROSE, { quoted: true })
      else put(x, SOURCE_TYPE.Q_BODY_LETTER_VOICE, 'Q reply written in letter register — salutation through sign-off, no external source', 'HIGH')
    }
    i = j
  }

  // ── pass 5: greentext, CORROBORATED only ──────────────────────────────────
  // The single biggest false-positive source in sourceLines(). A `>` line is a board excerpt
  // only when the post actually carries the source it would be excerpting. Otherwise it is Q's
  // own arrow bullet and stays Q body — with the reason recorded so the call is reviewable.
  for (let i = 0; i < n; i++) {
    if (label[i]) continue
    const l = lines[i].trim()
    if (!GREENTEXT_LINE.test(l)) continue
    const inner = fold(l.replace(/^>+\s*/, ''))
    const corroborated = inner.length > 6 && quotedBlob.includes(inner.slice(0, Math.min(60, inner.length)))
    if (corroborated) {
      put(i, ctx.quotedAuthorIsQ ? SOURCE_TYPE.QUOTED_PRIOR_Q_POST : SOURCE_TYPE.QUOTED_ANONYMOUS_POST,
        'greentext excerpt matched against this post\'s quoted payload', 'HIGH', STRUCTURE.PROSE,
        { quoted: true, referencedPostNum: ctx.primaryReferenced })
    } else {
      put(i, SOURCE_TYPE.Q_BODY, 'greentext arrow with no matching quoted source — Q\'s own bullet', 'MEDIUM')
    }
  }

  // ── pass 6: multi-line quotation, bounded ─────────────────────────────────
  // Kept from sourceLines() including the CLOSES_QUOTE fix, but it can no longer run past a
  // signature, a pointer, a blank line or 15 lines, and it never overrides an earlier label.
  const parity = l => ((l.match(/["“”]/g) ?? []).length % 2 === 1)
  const closes = /["”]\s*$/
  let open = -1
  for (let i = 0; i < n; i++) {
    const l = lines[i].trim()
    if (open >= 0) {
      if (isBlank(l) || SIGNATURE_LINE.test(l) || POINTER_LINE.test(l) || i - open > 15) { open = -1 }
      else {
        put(i, SOURCE_TYPE.QUOTED_THIRD_PARTY, 'inside a multi-line quotation', 'MEDIUM', STRUCTURE.PROSE, { quoted: true })
        if (parity(l) || closes.test(l)) open = -1
        continue
      }
    }
    if (label[i]) continue
    if (parity(l) && !closes.test(l) && l.length > 0) {
      open = i
      put(i, SOURCE_TYPE.QUOTED_THIRD_PARTY, 'opens a multi-line quotation', 'MEDIUM', STRUCTURE.PROSE, { quoted: true })
    }
  }

  // ── pass 7: excerpt beneath a source link ─────────────────────────────────
  for (let i = 0; i < n; i++) {
    if (!URL_ONLY_LINE.test(lines[i].trim())) continue
    const nx = lines[i + 1]
    if (nx === undefined || label[i + 1]) continue
    if (/^\s{2,}\S/.test(nx) || /^["“]/.test(nx.trim())) {
      put(i + 1, SOURCE_TYPE.QUOTED_THIRD_PARTY, 'excerpt indented or quoted beneath a source link', 'MEDIUM', STRUCTURE.PROSE, { quoted: true })
    }
  }

  // ── pass 7b: a self-contained quotation on ONE line ───────────────────────
  //
  // Found by hand-adjudicating #1359, not by a fixture. Q pastes a whole news paragraph onto a
  // single line: it opens with `“`, closes with `”`, and runs 40+ words. Pass 8 could not see it
  // because a prose RUN needs two neighbouring long lines, and pass 6's parity test is satisfied
  // by a quotation that opens and closes on the same line. So the excerpt read as Q's own body
  // and its closing sentence — "Trade between Germany and Iran reached 3.4 billion euros…" — was
  // stored as a Q Directive.
  //
  // A short quoted phrase is NOT this: Q writes `Define 'Projection'.` and `Think "BIG PICTURE".`
  // constantly. The length floor is what separates a pasted paragraph from Q quoting a word.
  for (let i = 0; i < n; i++) {
    if (label[i]) continue
    const l = lines[i].trim()
    if (!/^["“]/.test(l) || !/["”]\s*$/.test(l)) continue
    if (l.split(/\s+/).length < 20) continue
    put(i, SOURCE_TYPE.QUOTED_THIRD_PARTY, 'self-contained quotation: one line opening and closing on quotation marks, paragraph length', 'HIGH', STRUCTURE.PROSE, { quoted: true })
  }

  // ── pass 8: sustained prose — DOWNGRADED, NOT INVERTED ────────────────────
  //
  // sourceLines() calls a run of two long lines quoted. That is what put #3's gold-fixture
  // sentence in the third-party bucket. V2 splits the judgement:
  //
  //   corroborated (quote mark opening the run, a URL or pointer immediately above, or a
  //   content match against the post's quoted payload)   -> QUOTED_THIRD_PARTY, HIGH
  //
  //   the prose is a MINORITY of a post whose dominant register is telegraphic Q      -> Q_BODY,
  //   (short lines / bracket notation / a Q signature)                                    HIGH
  //
  //   the prose IS the whole post and there is no Q register anchor anywhere          -> UNKNOWN,
  //   -> ownership is not structurally established; the caller must hold it              LOW
  //
  // The third branch is the honest answer for the early 4chan format (#10): two paragraph
  // lines, no signature, no marker, nothing to decide on. It is not quoted and it is not
  // provably Q — it is unresolved, and it says so.
  const qRegisterLines = lines.filter(l => l.trim() && isQRegisterLine(l)).length
  const nonBlank = lines.filter(l => l.trim()).length
  const hasSignature = lines.some(l => SIGNATURE_LINE.test(l.trim()))

  for (let i = 0; i < n; i++) {
    if (label[i] || !isProseLine(lines[i])) continue
    if (!isProseLine(lines[i + 1] ?? '') && !isProseLine(lines[i - 1] ?? '')) continue
    let j = i
    while (j + 1 < n && isProseLine(lines[j + 1]) && !label[j + 1]) j++

    const runLen = j - i + 1
    const above = (lines[i - 1] ?? '').trim()
    const opensQuote = /^["“]/.test(lines[i].trim())
    const belowSource = URL_ONLY_LINE.test(above) || POINTER_LINE.test(above)
    const headFold = fold(lines[i].trim()).slice(0, 60)
    const contentMatch = headFold.length > 20 && quotedBlob.includes(headFold)

    let type, why, conf
    if (opensQuote || belowSource || contentMatch) {
      type = SOURCE_TYPE.QUOTED_THIRD_PARTY; conf = 'HIGH'
      why = contentMatch ? 'pasted passage matched against this post\'s quoted payload'
        : opensQuote ? 'pasted passage opening on a quotation mark'
        : 'pasted passage directly beneath a source link or pointer'
    } else if (hasSignature || (nonBlank - runLen) >= 3 || qRegisterLines / Math.max(1, nonBlank) >= 0.5) {
      type = SOURCE_TYPE.Q_BODY; conf = 'HIGH'
      why = 'long sentence inside a drop whose dominant register is Q — prose shape alone is not a quotation'
    } else {
      type = SOURCE_TYPE.UNKNOWN; conf = 'LOW'
      why = 'whole-post prose in early board format with no signature, pointer, quote mark or register anchor — ownership not structurally established'
    }
    for (let x = i; x <= j; x++) put(x, type, why, conf, STRUCTURE.PROSE, { quoted: type !== SOURCE_TYPE.Q_BODY && type !== SOURCE_TYPE.UNKNOWN, unresolved: type === SOURCE_TYPE.UNKNOWN })
    i = j
  }

  // ── default: Q body (rule 3) ──────────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    if (label[i]) continue
    put(i, SOURCE_TYPE.Q_BODY, isBlank(lines[i]) ? 'blank line' : 'canonical post body, no embedded-source evidence', 'HIGH')
  }
  return label
}

const stateOf = lab =>
  lab.unresolved ? AUTHORSHIP.AMBIGUOUS
  : lab.quoted ? AUTHORSHIP.QUOTED
  : AUTHORSHIP.Q

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Contiguous provenance spans for one post, with character offsets.
 *
 * @param {object} post                      a posts.json record
 * @param {object} [opts]
 * @param {(boardId:string)=>number|null} [opts.resolveBoardId]  boardId -> canonical postNum
 * @returns {{ postNum:number, regions:object[], spans:object[] }}
 */
export function sourceSpansV2(post, opts = {}) {
  const resolveBoardId = opts.resolveBoardId ?? (() => null)
  const body = bodyRegion(post)
  const quoted = quotedRegions(post, resolveBoardId)
  const media = mediaRegion(post)

  const quotedBlob = quoted.map(r => r.folded).join('  ')
  const primaryReferenced = quoted.find(r => r.referencedPostNum)?.referencedPostNum ?? ''
  const quotedAuthorIsQ = quoted.some(r => r.quotedAuthorIsQ)

  const label = labelBody(body, { quotedBlob, primaryReferenced, quotedAuthorIsQ, resolveBoardId })

  const spans = []
  const pushSpan = (region, startLine, endLine, lab) => {
    const text = region.lines.slice(startLine, endLine + 1).join('\n')
    if (!text.trim()) return
    const startOffset = region.lines[startLine].length - region.lines[startLine].trimStart().length
    const endOffset = region.lines[endLine].trimEnd().length
    spans.push({
      postNum: post.postNum,
      region: region.kind + (region.index !== undefined ? `#${region.index}` : ''),
      startLine, endLine, startOffset, endOffset,
      exactText: region.lines.slice(startLine, endLine + 1).map(l => l.trim()).join(' ').trim(),
      authorshipState: lab.state,
      sourceType: lab.sourceType,
      structure: lab.structure ?? STRUCTURE.PROSE,
      referencedPostNum: lab.referencedPostNum ?? '',
      confidence: lab.confidence,
      structuralReason: lab.reason,
    })
  }

  // merge contiguous identical labels in the body
  let s = 0
  for (let i = 0; i < body.lines.length; i++) {
    const cur = label[i], nx = label[i + 1]
    const same = nx && cur.sourceType === nx.sourceType && cur.reason === nx.reason
      && cur.structure === nx.structure && cur.confidence === nx.confidence
      && !isBlank(body.lines[i]) && !isBlank(body.lines[i + 1])
    if (same) continue
    if (body.lines.slice(s, i + 1).join('').trim())
      pushSpan(body, s, i, { ...cur, state: stateOf(cur) })
    s = i + 1
  }

  // quoted-post payloads: whole region, one span per quoted post (rule 4)
  for (const r of quoted) {
    if (!r.lines.join('').trim()) continue
    pushSpan(r, 0, r.lines.length - 1, {
      state: AUTHORSHIP.QUOTED,
      sourceType: r.quotedAuthorIsQ ? SOURCE_TYPE.QUOTED_PRIOR_Q_POST : SOURCE_TYPE.QUOTED_ANONYMOUS_POST,
      confidence: r.referencedPostNum ? 'HIGH' : 'MEDIUM',
      referencedPostNum: r.referencedPostNum,
      structure: STRUCTURE.PROSE,
      reason: r.referencedPostNum
        ? `reproduced payload of canonical post #${r.referencedPostNum} quoted inside this drop`
        : 'reproduced payload of a board post quoted inside this drop',
    })
  }

  if (media) {
    pushSpan(media, 0, media.lines.length - 1, {
      state: AUTHORSHIP.QUOTED,
      sourceType: media.screenshot ? SOURCE_TYPE.SCREENSHOT : SOURCE_TYPE.ATTACHED_IMAGE,
      confidence: 'MEDIUM', structure: STRUCTURE.PROSE,
      reason: 'attached-image filename text — never post body',
    })
  }

  return { postNum: post.postNum, regions: { body, quoted, media }, spans }
}

// ─── Phrase location over the spans ──────────────────────────────────────────

/** Every place `needle` occurs in a region, as flat-stream offsets resolved to lines. */
function locateIn(region, needle) {
  const hay = region.folded
  const nd = fold(needle).replace(/\s+/g, ' ').trim()
  if (!nd) return []
  const out = []
  let from = 0, at
  while ((at = hay.indexOf(nd, from)) !== -1) {
    const a = region.at[at], b = region.at[at + nd.length - 1] ?? region.at[region.at.length - 1]
    if (a && b) out.push({ flatStart: at, flatEnd: at + nd.length - 1, startLine: a.line, startOffset: a.off, endLine: b.line, endOffset: b.off + 1 })
    from = at + 1
  }
  return out
}

/**
 * Resolve a stored phrase to a provenance verdict.
 *
 * Rules 1, 5 and 6 live here: occurrence order picks between repeats, a phrase found in both
 * the body and a quoted payload with no way to separate them is AMBIGUOUS, and a phrase found
 * nowhere is NOT_LOCATED with sourceType UNKNOWN — never quoted.
 *
 * @param {object} parsed        result of sourceSpansV2()
 * @param {string} phrase        the stored phrase, verbatim
 * @param {number} [occurrence]  0-based index when the same phrase is stored more than once
 */
export function resolvePhrase(parsed, phrase, occurrence = 0) {
  const { body, quoted, media } = parsed.regions
  const inBody = locateIn(body, phrase)
  const inQuoted = quoted.flatMap((r, i) => locateIn(r, phrase).map(h => ({ ...h, region: r, qi: i })))
  const inMedia = media ? locateIn(media, phrase) : []

  if (!inBody.length && !inQuoted.length && !inMedia.length) {
    return {
      authorshipState: AUTHORSHIP.NOT_LOCATED, sourceType: SOURCE_TYPE.UNKNOWN,
      confidence: 'HIGH', referencedPostNum: '',
      structuralReason: 'phrase does not occur in the body, in any quoted payload, or in attached-image text',
      span: null, spanText: '', urlStripped: '',
    }
  }

  if (inBody.length) {
    // ── Rule 5 before rule 6 ─────────────────────────────────────────────────
    //
    // A quoted-post PAYLOAD is a separate region, not text interleaved with the body, and the
    // analysis index is built from body text only. So a phrase present in the body is resolved
    // to the body even when the same wording is also reproduced in the payload — the payload
    // occurrence is recorded as `alsoQuotedInPayload` for review rather than collapsing the
    // record to NEEDS_CONTEXT. Treating that as ambiguous held 17 plainly-Q lines (#316
    // "Expand your thinking.", #1266 "Trust the plan.", #729/#730 "Learn." …) whose ownership
    // is not actually in doubt.
    //
    // Rule 6 still fires where it should: when the BODY ITSELF carries the phrase in two
    // different provenances and occurrence order runs out, there is nothing left to decide on.
    const spanAt = h => parsed.spans.find(s => s.region === 'BODY' && h.startLine >= s.startLine && h.startLine <= s.endLine)
    const provenances = new Set(inBody.map(h => { const s = spanAt(h); return s ? `${s.authorshipState}/${s.sourceType}` : 'Q_AUTHORED_CURRENT_POST/Q_BODY' }))
    if (provenances.size > 1 && occurrence >= inBody.length) {
      return {
        authorshipState: AUTHORSHIP.AMBIGUOUS, sourceType: SOURCE_TYPE.UNKNOWN,
        confidence: 'LOW', referencedPostNum: '',
        structuralReason: `phrase occurs ${inBody.length}× in the body across ${provenances.size} different provenances and the stored occurrence index (${occurrence}) runs past them`,
        span: null, spanText: '', urlStripped: '', alsoQuotedInPayload: inQuoted.length,
      }
    }
    const hit = inBody[Math.min(occurrence, inBody.length - 1)]
    // the span that owns the START of the match
    const owning = parsed.spans.find(s => s.region === 'BODY' && hit.startLine >= s.startLine && hit.startLine <= s.endLine)
    // rules 7 & 8: report what the span repair had to cut off the stored phrase
    const covered = parsed.spans.filter(s => s.region === 'BODY' && s.startLine <= hit.endLine && s.endLine >= hit.startLine)
    const cutUrl = covered.filter(s => s.structure === STRUCTURE.URL).map(s => s.exactText).join(' ')
    const cutSig = covered.filter(s => s.structure === STRUCTURE.SIGNATURE).map(s => s.exactText).join(' ')
    const prose = covered.filter(s => s.structure === STRUCTURE.PROSE)

    // ── Span repair NARROWS, it never widens ──────────────────────────────────
    //
    // The repaired phrase is built from the MATCHED CHARACTER RANGE, per line, with any part
    // falling inside a URL span (rule 8) or a signature span (rule 7) dropped. Rebuilding it
    // from whole covering LINES instead was wrong in both directions: "Define." in #117 came
    // back as the whole line "What is HUMA? Define.", "Follow Huma." in #2 as "Where is Huma?
    // Follow Huma.", and thirteen records were then reclassified on wording Q had put in a
    // different sentence. A stored phrase that sits inside one line is returned unchanged.
    const structureAt = i => (covered.find(s => i >= s.startLine && i <= s.endLine)?.structure ?? STRUCTURE.PROSE)
    const parts = []
    for (let i = hit.startLine; i <= hit.endLine; i++) {
      const line = body.lines[i] ?? ''
      const from = i === hit.startLine ? hit.startOffset : 0
      const to = i === hit.endLine ? hit.endOffset : line.length
      const seg = line.slice(from, to).trim()
      if (!seg) continue
      const st = structureAt(i)
      if (st === STRUCTURE.URL || st === STRUCTURE.SIGNATURE) continue
      parts.push(seg)
    }
    const cleanSpan = parts.join(' ')
    const base = owning ?? prose[0] ?? covered[0]
    return {
      authorshipState: base ? base.authorshipState : AUTHORSHIP.Q,
      sourceType: base ? base.sourceType : SOURCE_TYPE.Q_BODY,
      confidence: base ? base.confidence : 'MEDIUM',
      referencedPostNum: base?.referencedPostNum ?? '',
      structuralReason: base ? base.structuralReason : 'body match with no span label',
      span: { startLine: hit.startLine, endLine: hit.endLine, startOffset: hit.startOffset, endOffset: hit.endOffset },
      spanText: cleanSpan || (base?.exactText ?? ''),
      blockText: base?.exactText ?? '',
      urlStripped: cutUrl,
      signatureStripped: cutSig,
      spannedLines: hit.endLine - hit.startLine + 1,
      alsoQuotedInPayload: inQuoted.length,
    }
  }

  if (inQuoted.length) {
    const hit = inQuoted[Math.min(occurrence, inQuoted.length - 1)]
    const r = hit.region
    return {
      authorshipState: AUTHORSHIP.QUOTED,
      sourceType: r.quotedAuthorIsQ ? SOURCE_TYPE.QUOTED_PRIOR_Q_POST : SOURCE_TYPE.QUOTED_ANONYMOUS_POST,
      confidence: r.referencedPostNum ? 'HIGH' : 'MEDIUM',
      referencedPostNum: r.referencedPostNum ?? '',
      structuralReason: r.referencedPostNum
        ? `found only inside the reproduced payload of canonical post #${r.referencedPostNum}`
        : 'found only inside a reproduced board-post payload',
      span: { startLine: hit.startLine, endLine: hit.endLine, startOffset: hit.startOffset, endOffset: hit.endOffset },
      spanText: r.lines.slice(hit.startLine, hit.endLine + 1).map(l => l.trim()).join(' '),
      urlStripped: '',
    }
  }

  const hit = inMedia[Math.min(occurrence, inMedia.length - 1)]
  return {
    authorshipState: AUTHORSHIP.QUOTED, sourceType: SOURCE_TYPE.ATTACHED_IMAGE,
    confidence: 'LOW', referencedPostNum: '',
    structuralReason: 'found only in attached-image filename text, never in the post body',
    span: { startLine: hit.startLine, endLine: hit.endLine, startOffset: hit.startOffset, endOffset: hit.endOffset },
    spanText: '', urlStripped: '',
  }
}

// ─── Sentence boundaries inside a span ───────────────────────────────────────
//
// `startOffset > 0` is NOT the same question as "is this a fragment". Q routinely writes several
// whole sentences on one line — `List. Compare. Laugh.`, `VOTE! VOTE! VOTE!` — and every one of
// those after the first begins at a non-zero offset while being a complete sentence. The 107
// records flagged `midSentence` by offset alone therefore mix two very different problems:
//
//   SENTENCE_ON_SHARED_LINE   a whole sentence that happens to share a line with its neighbours
//   MID_SENTENCE_FRAGMENT     a clause clipped out of the middle of a longer sentence
//
// Only the second can make Q appear to have issued a fragment as a standalone command.

// The split rule is LIFTED FROM segment.mjs, deliberately. Two auditors drawing unit boundaries
// differently produce two incompatible datasets, and this project has hit that four times. A
// terminator only ends a sentence when the next thing looks like a new sentence, and never after
// an abbreviation — otherwise `Realize Soros, Clintons, Obama, Putin, etc. are all controlled…`
// truncates at `etc.`, `Note: Not all are USA v. [ ]` at `v.`, and `Track donations vs. expenses.`
// at `vs.`, each producing a displayed span shorter than the phrase it is meant to display.
const SPLIT = /([?!.])(\s+)(?=[A-Z(“"']|\d)/g
const ABBREV_END = /(?:\b(?:[A-Z]\.){2,}|\b[A-Z]\.|\b(?:Adm|Gen|Sen|Rep|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs|v|No|Inc|Co|Corp|Dept|Est|approx|etc|al)\.)\s*$/i

/** Sentence spans of one line, as [start, end) offsets. */
export function sentencesOf(line) {
  const out = []
  let last = 0, m
  SPLIT.lastIndex = 0
  while ((m = SPLIT.exec(line)) !== null) {
    const end = m.index + 1
    if (ABBREV_END.test(line.slice(last, end))) continue     // not a sentence end
    out.push([last, end])
    last = m.index + m[0].length
  }
  if (last < line.length) out.push([last, line.length])
  return out.filter(([a, b]) => line.slice(a, b).trim())
}

/**
 * The sentence that owns a located phrase, and whether the phrase is a fragment of it.
 *
 * @param {object} parsed  result of sourceSpansV2()
 * @param {object} hit     the `span` returned by resolvePhrase()
 */
export function sentenceContext(parsed, hit) {
  if (!hit) return null
  const lines = parsed.regions.body.lines
  const line = lines[hit.startLine] ?? ''
  const sents = sentencesOf(line)
  let owning = sents.find(([a, b]) => hit.startOffset >= a && hit.startOffset < b) ?? [0, line.length]
  // INVARIANT: a displayed span must contain what it displays. Where segmentation still cuts
  // short of the located phrase — a quotation mark mid-sentence is the residual case,
  // `Do not let personal (emotional) desires ("do it now""now"…` — the sentence is widened to
  // cover the phrase rather than the phrase being trimmed to fit the sentence.
  if (hit.endLine === hit.startLine && hit.endOffset > owning[1]) {
    const ext = sents.find(([a, b]) => hit.endOffset > a && hit.endOffset <= b)
    owning = [owning[0], Math.max(owning[1], ext ? ext[1] : hit.endOffset)]
  }
  // A phrase that runs past its own line takes the rest of the joined lines with it.
  const tail = hit.endLine > hit.startLine
    ? ' ' + lines.slice(hit.startLine + 1, hit.endLine + 1).map(l => l.trim()).filter(Boolean).join(' ')
    : ''
  const fullSentence = (line.slice(owning[0], hit.endLine > hit.startLine ? line.length : owning[1]).trim() + tail).trim()
  const idx = sents.findIndex(s => s === owning)
  return {
    fullSentence,
    sentenceStart: owning[0],
    sentenceEnd: owning[1],
    // The fragment test: does the phrase start after its own sentence starts?
    isMidSentenceFragment: hit.startOffset > owning[0],
    sentencesOnLine: sents.length,
    contextBefore: (idx > 0 ? line.slice(sents[idx - 1][0], sents[idx - 1][1]).trim() : (lines[hit.startLine - 1] ?? '').trim()),
    contextAfter: (idx >= 0 && idx + 1 < sents.length ? line.slice(sents[idx + 1][0], sents[idx + 1][1]).trim() : (lines[hit.endLine + 1] ?? '').trim()),
  }
}

/** boardId -> canonical postNum, built once from the corpus. */
export function boardIdResolver(posts) {
  const m = new Map()
  for (const p of posts) {
    const a = String(p.link ?? '').match(/#q?(\d+)/)
    if (a) m.set(a[1], p.postNum)
    if (p.id != null) m.set(String(p.id), p.postNum)
  }
  return id => (id == null ? null : (m.get(String(id)) ?? null))
}
