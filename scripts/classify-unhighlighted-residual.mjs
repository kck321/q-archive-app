// Residual classification pass over the unhighlighted-sentence census.
//
// The census (audit-unhighlighted-sentences.mjs) says WHAT is still unpainted. This says what
// each of those lines IS — the category it portrays, read from the drop it sits in.
//
// It classifies nothing into the certified layers and writes nothing into public/data. Output is
// a review file: a proposal per row, with the evidence it was proposed on, for the owner to rule.
//
// Destinations are the app's OWN eight live sections (src/lib/sectionInfo.ts SECTIONS) plus the
// two honest non-answers — a sign-off that is not a proposition, and NEEDS CONTEXT.
//
//   node scripts/classify-unhighlighted-residual.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { imperativeMood, familyOf } from './lib/imperative.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'audit', 'unhighlighted-sentences')
const DATA = path.join(ROOT, 'public', 'data')
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))

// Prefer the rows measured in the RENDERED DOM. The transcription pass models the renderer and is
// only true until the renderer moves; the DOM pass reads the marks a reader can actually see.
// --census forces the transcription rows, for comparing the two.
const TRUTH = path.join(DIR, 'unhighlighted-from-truth.jsonl')
const SRC = (!process.argv.includes('--census') && fs.existsSync(TRUTH))
  ? TRUTH : path.join(DIR, 'unhighlighted-sentences.jsonl')
const rows = fs.readFileSync(SRC, 'utf8')
  .split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
console.log(`\n  source: ${path.basename(SRC)}  (${rows.length.toLocaleString()} rows)`)
const themesJson = read('themes.json')
const entitiesJson = read('entities.json')

// ── the app's live destinations ──────────────────────────────────────────────
const QUESTION = 'Q Questions'
const DIRECTIVE = 'Q Directives'
const CLAIM = 'Q Claims'
const PREDICTION = 'Q Predictions'
const EVIDENCE = 'Q Evidence & References'
const ENTITY = 'Q Entities'
const THEME = 'Q Themes'
const CODE = 'Q Codes & Brackets'
const SIGNOFF = 'Signature / Sign-off (not a proposition)'
const NEEDS = 'NEEDS CONTEXT'

// Work the owner has to authorise before anything can be applied.
const A_POLICY = 'POLICY RULING — one decision settles the whole population'
const A_SPAN = 'SPAN BOUNDARY FIX — classification exists, the highlight stops short'
const A_PAINT = 'PAINT POLICY — already certified in a layer the body does not fill'
const A_CLASSIFY = 'CLASSIFY — no disposition anywhere in the archive'

// ── theme vocabulary, taken from the certified pass's own anchors ────────────
const themeLabel = new Map((themesJson.themes ?? []).map(t => [t.key, t.label]))
const anchorTheme = new Map()
for (const [, list] of Object.entries(themesJson.byPost ?? {})) {
  for (const t of list) {
    for (const a of t.evidence?.anchors ?? []) {
      const k = String(a).toLowerCase().trim()
      if (k.length >= 4 && !anchorTheme.has(k)) anchorTheme.set(k, t.label ?? themeLabel.get(t.theme))
    }
  }
}
const anchorKeys = [...anchorTheme.keys()]
const postThemes = new Map()
for (const [pn, list] of Object.entries(themesJson.byPost ?? {})) {
  postThemes.set(Number(pn), list.map(t => t.label ?? themeLabel.get(t.theme)).filter(Boolean))
}
const entityNames = new Set()
for (const e of entitiesJson.entities ?? []) {
  if (e.canonical) entityNames.add(String(e.canonical).toLowerCase())
  for (const a of e.aliases ?? []) if (a.text) entityNames.add(String(a.text).toLowerCase())
}

// ── shape tests ──────────────────────────────────────────────────────────────
const INTERROGATIVE = /^(who|whom|whose|what|which|when|where|why|how|is|are|was|were|do|does|did|can|could|will|would|should|shall|have|has|had|am)\b/i
// A forecast, not merely a future-tense word. PROJECT_CONTEXT: a conditional, a statement of
// intent and a future word used as a modifier ("the coming storm") are CLAIMS, not predictions.
const FORECAST = /\b(?:will\s+[a-z]{2,}|is\s+coming|are\s+coming|incoming|expect\b|in\s+the\s+coming|days?\s+ahead|next\s+week|it\s+begins|coming\s+(?:soon|days|weeks|months))/i
const INTENT = /^(?:we|i)\s+(?:will|shall)\b/i
const CONDITIONAL = /^(?:if|unless|should)\b/i
// Verbs that cannot also be the noun heading a label.
const COPULA_OR_VERB = /\b(?:is|are|was|were|be|been|being|has|have|had|does|did|controls|controlled|owns|owned|ran|holds|held|knows|knew|worked|means|meant|shows|showed|proves|proved|remains|remained|stays|stayed|goes|went|comes|came|makes|made|takes|took|gives|gave|gets|got|keeps|kept|uses|used|wants|needs|leads|led|follows|followed|protects|protected|funded|paid|received|created|built|killed|removed|arrested|indicted|charged|failed|won|lost|said|says|told|tries|tried|attempted|declares|declined|refuses|refused|kills|admits|admitted|denies|denied|sent|met|pays|owes|hides|hid|thinks|believes|helps|helped|serves|served|laughs|harmed|swayed|hired|oversees|manages|managed|directed|collapse[sd]?|expose[sd]?|threaten(?:s|ed)?)\b/i
// Words that are equally noun and verb. They only count as a verb with a complement behind them:
// "OP Name: Fiddler" is a label, "HUBER reports directly to SESSIONS" is an assertion.
const AMBIGUOUS_VERB = /\b(?:names?|calls?|points?|reports?|files?|signs?|links?|ties?|stands?|falls?|acts?|votes?|opens?|closes?|sits?|rises?|carries|carry|passes?|delays?|blocks?|drops?|counts?|records?|orders?|forces?|guards?|watches|matters?|runs?|works?|finds?|founds?|claims?)\s+(?:to|the|a|an|at|on|in|for|with|from|as|out|up|down|back|directly|into|onto|over|under|his|her|their|its|our|your|my|that|this|no|not)\b/i
const ED_ING = /\b\w+(?:ed|ing)\b/i
const TIMESTAMP = /^\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[A-Z]{1,4})?$/
const DATEISH = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/
const BRACKETY = /[[\]<>_]|-{2,}|={2,}|^>+/
const ALLCAPS_LABEL = /^[^a-z]{3,}$/
const LIST_ITEM = /^[^:]{2,45}:\s*\S/
const SCRIPTURE = /\b(?:god|lord|jesus|christ|bible|scripture|pray(?:er|ing)?|amen|psalm|corinthians|ephesians|colossians|heaven|thy|thee|thou|hallowed|almighty|holy\s+spirit|armor\s+of\s+god)\b/i

// Devices Q writes that no mood/verb test can read, because they are notation rather than
// grammar. Each was read in its own drop before it was written down here; the drop is named so
// the ruling can be checked rather than trusted.
const STRINGER = /(?:^[_:>])|(?:[A-Za-z]{2,}_(?:[A-Za-z0-9^&*-]|$))|(?:_[A-Za-z0-9]{2,}_)|(?:\b[A-Za-z]{1,3}\d{3,}[A-Za-z]?\b)|(?:\b[A-Za-z0-9]{6,}\b.*\^)/
// "(MB)(Votes)(Attacks)", "(glimpse)(what to expect)" — chained parentheses are Q's notation,
// not a sentence, even when a certified entity sits inside one of them.
const BRACKET_CHAIN = /^(?:[([][^)\]]{0,40}[)\]]\s*){2,}$/
const BLESSING = /^(?:god\s*bless(?:\s+(?:you|us|america|all)?)?|god\s*speed|godspeed|amen)\b[\s,.!]*(?:q\+?)?[\s,.!]*$/i
const WWG1WGA_SPELLED = /where\s+we\s+go\s+one,?\s+we\s+go\s+all/i
const QUOTED_WHOLE = /^["“][^"”]{8,}["”][.!?]?$/
const DASH_LIST = /^[^\s–—-][^–—]{1,80}\s+[–—-]\s+\S/
const BULLET = /^[-•*+>]\s*[A-Za-z[(]/
// `\bw\/\b` never fired: `/` and the following space are both non-word, so there is no boundary
// there and "W/ A STRATEGIC PURPOSE" fell through to the label fallback.
const ELLIPTIC = /=|\bw\/o?(?=\s|$)|\bvs?\.?(?=\s)|>|→|^(?:no|all|every|only|nothing|none)\s+\w+|\b(?:biggest|largest|highest|lowest|worst|best|first|last|most|greatest)\b/i
const ABBREV_TAIL = /(?:^|\s|\()(?:U\.S|Mr|Mrs|Ms|Dr|Sen|Rep|Gov|Gen|Adm|Col|Lt|Sgt|Jr|Sr|St|No|vs|etc|Inc|Corp|Co|Dept|Univ|Rd|Ave|[A-Z])\.$/
// A single capital letter or a title before the final period is an initial, effectively always.
// "Why would H." · "Federal prosecutor in N." · "…Intelligence James R." · "…to our Country, Mr."
const STRONG_ABBREV = /(?:^|\s|\()(?:U\.S|Mr|Mrs|Ms|Dr|Sen|Rep|Gov|Gen|Adm|Col|Lt|Sgt|Jr|Sr|[A-Z])\.$/
const RE_PREFIXED = /^re[-_](?:read|listen|watch|review|check|visit|trace|post|examine|verify|confirm)\b/i

// ── researched rulings ───────────────────────────────────────────────────────
// Keyed on the census's own normalizedText. These are lines whose category cannot be derived
// from the line — the drop had to be opened. The drop is cited in every basis string.
const RESEARCHED = new Map(Object.entries({
  'boom': [CODE, 'Recurring emphasis marker',
    'in #844 the whole drop is BOOM repeated four times on a rising indent — a countdown device, with no proposition in it',
    'HIGH', "Q's escalating countdown marker, used as notation rather than as a statement"],
  'conspiracy': [CODE, 'Scare-quoted term used as a device',
    "in #1010 'CONSPIRACY' is repeated three times inside a list of alleged control mechanisms — Q quoting the label back rather than asserting it",
    'HIGH', 'Q throwing the word back in scare quotes — a rhetorical marker, not an assertion'],
  'like mother': [CLAIM, 'Elliptical assertion (two-line aphorism)',
    'in #2081 the drop is only "Like Mother / Like Daughter / Q" — the idiom asserts an inherited likeness',
    'MEDIUM', 'Asserts that a daughter carries her mother’s character, by idiom rather than by sentence'],
  'like daughter': [CLAIM, 'Elliptical assertion (two-line aphorism)',
    'in #2081 the drop is only "Like Mother / Like Daughter / Q" — the idiom asserts an inherited likeness',
    'MEDIUM', 'Asserts that a daughter carries her mother’s character, by idiom rather than by sentence'],
  'aggression projection': [CLAIM, 'Itemized assertion under a list header',
    'in #1926 and #2171 it is a bullet under "Actions of [ANTIFA]:", "[FAKE NEWS]:" and "[TWITTER, FB, GOOG, YT, REDDIT]:" — Q asserting what those actors do',
    'HIGH', 'Asserts aggression is one of the named actors’ tactics, and reads it as projection'],
  'suppression fascism': [CLAIM, 'Itemized assertion under a list header',
    'in #1926 and #2171 it is a bullet under "Actions of [ANTIFA]:", "[FAKE NEWS]:" and the platform list',
    'HIGH', 'Asserts suppression is one of the named actors’ tactics, and reads it as fascism'],
  'censorship narrative dogma': [CLAIM, 'Itemized assertion under a list header',
    'in #1926 and #2171 it is a bullet under the same three "Actions of […]" headers',
    'HIGH', 'Asserts censorship is one of the named actors’ tactics'],
  'text a text b': [CODE, 'Evidence label used as notation',
    'in #1563 "Text A / Text B / Text C" label the three Strzok-Page messages the rest of the drop argues about',
    'HIGH', 'Labels the pieces of evidence the drop then reasons over'],
  'text c': [CODE, 'Evidence label used as notation',
    'in #1563 "Text A / Text B / Text C" label the three messages the rest of the drop argues about',
    'HIGH', 'Labels the pieces of evidence the drop then reasons over'],
  'r': [CODE, 'Single-letter section marker',
    'in #2300 "R" heads RED OCTOBER and "D" heads DECLAS — initials organising the drop into blocks',
    'HIGH', 'A one-letter heading marking a block of the drop'],
  'd': [CODE, 'Single-letter section marker',
    'in #2300 "R" heads RED OCTOBER and "D" heads DECLAS — initials organising the drop into blocks',
    'HIGH', 'A one-letter heading marking a block of the drop'],
  'federal bureau of investigation': [ENTITY, 'Entity written with a scare-quote device',
    'Q writes FEDERAL BUREAU OF "INVESTIGATION" in #2070, #2697 and #3990 — the agency named, with the quotes carrying the accusation',
    'HIGH', 'Names the FBI while using quotation marks to deny that it investigates'],
  'department of justice': [ENTITY, 'Entity written with a scare-quote device',
    'Q writes DEPARTMENT OF "JUSTICE" in #2070 — the agency named, with the quotes carrying the accusation',
    'HIGH', 'Names the DOJ while using quotation marks to deny that it delivers justice'],
  'mayday': [CODE, 'Wordplay marker',
    'in #3170 "MAYday" capitalises MAY inside the distress call — a date pun used as a marker',
    'MEDIUM', 'A distress-call pun pointing at the month of May'],
  '#4437|end': [EVIDENCE, 'Pasted source code',
    'in #4437 the drop reproduces a Ruby/Capybara snippet — "end" closes the def, it is not English',
    'HIGH', 'A line of source code Q pasted, not a sentence Q wrote'],
  'd room h': [CODE, 'Room designator', 'in #1001 D-Room H / R / C label rooms in the drop\'s scheme', 'HIGH', 'A designator naming a room in the drop\'s scheme'],
  'd room r': [CODE, 'Room designator', 'in #1001 D-Room H / R / C label rooms in the drop\'s scheme', 'HIGH', 'A designator naming a room in the drop\'s scheme'],
  'd room c': [CODE, 'Room designator', 'in #1001 D-Room H / R / C label rooms in the drop\'s scheme', 'HIGH', 'A designator naming a room in the drop\'s scheme'],
  'threat 1': [CODE, 'Numbered list label', 'in #1805 "Threat 1" and "Threat 2" head the two items the drop then describes', 'HIGH', 'A numbered heading over one item of the drop'],
  'threat 2': [CODE, 'Numbered list label', 'in #1805 "Threat 1" and "Threat 2" head the two items the drop then describes', 'HIGH', 'A numbered heading over one item of the drop'],
  'traitor defector deserter': [EVIDENCE, 'Pasted thesaurus entry',
    'in #4603 the drop reproduces a thesaurus block of synonyms for "traitor"', 'HIGH',
    'A row of a dictionary/thesaurus entry Q pasted'],
  'turncoat betrayer rebel': [EVIDENCE, 'Pasted thesaurus entry',
    'in #4603 the drop reproduces a thesaurus block of synonyms for "traitor"', 'HIGH',
    'A row of a dictionary/thesaurus entry Q pasted'],
  'renegado tergiversator': [EVIDENCE, 'Pasted thesaurus entry',
    'in #4603 the drop reproduces a thesaurus block of synonyms for "traitor"', 'HIGH',
    'A row of a dictionary/thesaurus entry Q pasted'],
  'crossfire typhoon': [ENTITY, 'Operation codename',
    'the FBI codename for the Flynn strand of Crossfire Hurricane, written in #4011 as a bare line',
    'HIGH', 'Names an FBI operation as a standalone line'],
  'tarmac': [CODE, 'One-word shorthand for a known event',
    'in #1443 "Tarmac" stands alone for the Lynch–Clinton aircraft meeting the archive discusses elsewhere',
    'MEDIUM', 'Shorthand pointing at a specific meeting without describing it'],
  'key': [CODE, 'Legend header',
    'in #11 "Key:" introduces the legend the rest of the drop is read through', 'HIGH',
    'A heading announcing the legend that follows'],
  'timestamp': [CODE, 'Field label',
    'in #731 "Timestamp:" labels the value beneath it', 'HIGH', 'A field label over a value'],
  'q a q': [SIGNOFF, 'Q&A header run together with the sign-off',
    'in #2216 and #2605 the segmenter joined the "Q&A" header to the trailing "Q" signature',
    'HIGH', 'A section header and the signature, merged by the unit boundary'],
}))

const quotedKind = r => r.certifiedNotPaintedLayers.find(k => k.startsWith('evidence:'))
const clip = (s, n = 120) => (s.length > n ? s.slice(0, n) + '…' : s)

/** The topic the line sits in, for the "what it portrays" reading. */
function topicOf(r) {
  const t = r.sentenceText.toLowerCase()
  const hits = []
  for (const anchor of anchorKeys) {
    if (t.includes(anchor)) {
      const label = anchorTheme.get(anchor)
      if (label && !hits.includes(label)) hits.push(label)
      if (hits.length >= 3) break
    }
  }
  if (hits.length) return hits
  return (postThemes.get(r.postNumber) ?? []).slice(0, 3)
}

const namedIn = r => [...new Set(r.paintedDetail.filter(d => d.kind === 'namedEntity').map(d => d.text))]

// ── the classifier ───────────────────────────────────────────────────────────
function classify(r) {
  const t = r.sentenceText.trim()
  let bare = t.replace(/^[>"'\s]+/, '').replace(/["'\s]+$/, '')
  const painted = new Set(r.paintedLayers)
  const ev = quotedKind(r)
  const names = namedIn(r)
  const topics = topicOf(r)
  // A leading bullet is layout, not meaning. Strip it before reading the line, and remember it,
  // so "-HUBER reports 'directly' to SESSIONS" is read as the assertion it is.
  const bulleted = BULLET.test(bare)
  const listHeader = (r.contextBefore.split('\n').filter(Boolean).pop() ?? '').trim()
  if (bulleted) bare = bare.replace(/^[-•*+>]\s*/, '')
  const words = bare.match(/[A-Za-z'’]+/g) ?? []
  // The segmenter ends a unit at any ". " — so a sentence containing "U.S." or an initial comes
  // out cut in two. Noted rather than returned here: a half-sentence can still read as a
  // question or a claim, and saying which is more use than saying only that it is broken.
  const artifact = ABBREV_TAIL.test(bare) && (/^[a-z)\]]/.test(r.contextAfter) || STRONG_ABBREV.test(bare))
  const cut = artifact ? ' (the unit is cut short at an abbreviation — rejoin before applying)' : ''

  const out = (category, subtype, basis, confidence, action, portrays) =>
    ({ category, subtype, basis, confidence, action, portrays, topics, names })

  // 1 — Q's sign-off. Not a sentence anybody classifies 4,524 times.
  if (r.form === 'q_signature') {
    const isSlogan = /^(wwg1wga|ncswic|wrwy)/i.test(bare)
    return isSlogan
      ? out(CODE, 'Movement slogan / sign-off acronym',
        `"${bare}" is a fixed acronym Q closes with, not a proposition`, 'HIGH', A_POLICY,
        'A recurring slogan used as a closing device — notation, not an assertion')
      : out(SIGNOFF, 'Tripcode signature',
        'the bare "Q" that ends a drop — an authorship mark', 'HIGH', A_POLICY,
        "Q's signature closing the drop; it asserts, asks and predicts nothing")
  }

  // 2 — a ruling that came from reading the drop, not the line. A post-scoped key wins over a
  // corpus-wide one: "end" is a Ruby keyword in #4437 and nothing of the kind anywhere else.
  const ruled = RESEARCHED.get(`#${r.postNumber}|${r.normalizedText}`) ?? RESEARCHED.get(r.normalizedText)
  if (ruled) {
    const [cat, subtype, basis, conf, portrays] = ruled
    return out(cat, subtype, basis, conf, A_CLASSIFY, portrays)
  }

  // 3 — everything painted except punctuation. The category already exists.
  if (r.uncoveredOnlyPunctuation) {
    const inherited = painted.has('claim') ? CLAIM : painted.has('question') ? QUESTION
      : painted.has('request') || painted.has('requestQuestion') ? DIRECTIVE
        : painted.has('prediction') ? PREDICTION
          : painted.has('namedEntity') ? ENTITY
            : painted.has('bracketCode') ? CODE
              : painted.has('theme') ? THEME : NEEDS
    return out(inherited, 'Existing classification, span stops short',
      `only ${JSON.stringify(r.uncoveredText)} is outside the highlight; the line is already painted ${[...painted].join(' + ') || 'by nothing'}`,
      'HIGH', A_SPAN,
      'Already classified — the highlight excludes trailing punctuation only')
  }

  // 3 — links and citations. The app has a section for exactly this.
  if (r.form === 'url_or_reference' || ev === 'evidence:EXTERNAL_LINK' || /^https?:\/\/|^www\./i.test(bare)) {
    const host = (bare.match(/https?:\/\/\s*([^/\s]+)/i) ?? [])[1] ?? ''
    return out(EVIDENCE, 'External link',
      `the line is a bare URL${host ? ` (${host})` : ''} Q pasted as source material`, 'HIGH',
      ev ? A_PAINT : A_CLASSIFY,
      `A source Q pointed the reader to${host ? ` — ${host}` : ''}`)
  }
  if (/^>>\d+/.test(bare) || ev === 'evidence:INTERNAL_REFERENCE') {
    return out(EVIDENCE, 'Internal Q reference',
      'a pointer to an earlier drop, not independent external evidence', 'HIGH', A_PAINT,
      'Continuity pointer back into the archive')
  }

  // 4 — text Q reproduced from somewhere else. Q-authored analysis must not absorb it.
  if (ev === 'evidence:QUOTED_SOURCE' || r.quotedSource) {
    const scriptural = SCRIPTURE.test(bare)
    return out(EVIDENCE, scriptural ? 'Quoted source text — scripture / prayer' : 'Quoted / pasted source text',
      `certified as source material${r.quotedSourceReason ? ` (${clip(r.quotedSourceReason, 70)})` : ''} — not Q's own assertion`,
      'HIGH', A_PAINT,
      scriptural
        ? 'Scripture or prayer Q reproduced — religious material carried into the drop'
        : `Material Q copied in from elsewhere${topics.length ? ` about ${topics[0]}` : ''}`)
  }

  // 5 — certified notation.
  if (r.certifiedNotPaintedLayers.includes('code') || (BRACKETY.test(bare) && painted.has('bracketCode'))) {
    return out(CODE, 'Certified code occurrence',
      'already a certified code; the drop body has no bracket to fill on this line', 'HIGH', A_PAINT,
      `Q's shorthand notation${names.length ? ` involving ${names[0]}` : ''} — inclusion means code-like, not decoded`)
  }

  // 5b — closings. "God bless, Q" and "Godspeed, Q" are valedictions, not instructions: the
  // imperative test reads "bless" as a command to the reader, which is backwards.
  if (BLESSING.test(bare) || WWG1WGA_SPELLED.test(bare)) {
    const slogan = WWG1WGA_SPELLED.test(bare)
    return out(SIGNOFF, slogan ? 'Movement slogan, spelled out' : 'Blessing / valediction',
      slogan ? 'the WWG1WGA slogan written in full rather than as the acronym'
        : 'a closing blessing addressed to the reader — a valediction, not an instruction and not an assertion',
      'HIGH', A_POLICY,
      slogan ? 'The movement slogan used as a closing device'
        : 'Closes the drop with a blessing; the drop carries the Religion & Spirituality theme, the line itself asserts nothing')
  }

  // 5c — chained parentheses. Notation, even when a certified entity sits inside one.
  if (BRACKET_CHAIN.test(bare)) {
    return out(CODE, 'Chained bracket notation',
      'two or more bracketed tokens run together with nothing between them — Q\'s notation, not a sentence',
      'HIGH', A_CLASSIFY,
      `Strings ${clip(bare, 60)} together as notation${names.length ? `; ${names[0]} appears inside it` : ''}`)
  }

  // 6 — Q's stringer notation. Underscored command strings and alphanumeric identifiers.
  if (STRINGER.test(bare) && !/\s(?:the|a|an|is|are|was|were|of|to)\s/i.test(bare) && words.length <= 12) {
    return out(CODE, 'Stringer / identifier string',
      'underscored or alphanumeric command-string notation with no grammatical sentence in it', 'HIGH',
      A_CLASSIFY,
      'One of Q’s stringers — structured notation whose meaning is not established')
  }

  // 7 — real prose. Read what it is doing.
  const q = /[?][\])'"”’]*$/.test(bare)
    || (INTERROGATIVE.test(bare) && words.length <= 12 && (!/[.!]$/.test(bare) || artifact))
  if (q) {
    const hasMark = /[?]/.test(bare)
    return out(QUESTION, hasMark ? 'Uncertified question, question mark present' : 'Question form without a question mark',
      (hasMark ? 'ends in a question mark but no certified question covers this line'
        : `opens with "${words[0]}" in interrogative form with no terminal punctuation`) + cut,
      hasMark && !artifact ? 'HIGH' : 'MEDIUM', artifact ? A_SPAN : A_CLASSIFY,
      `Asks the reader${topics.length ? ` about ${topics[0]}` : ''}`)
  }

  // "Re-listen to yesterday's speech." and "Re_read." are instructions the verb list cannot see,
  // because the base verb is behind a hyphen or an underscore.
  if (RE_PREFIXED.test(bare)) {
    return out(DIRECTIVE, 'Directive — re-do instruction',
      `opens with "${bare.split(/\s/)[0]}" — a re-prefixed base verb telling the reader to go back over something`,
      'HIGH', A_CLASSIFY,
      `Tells the reader to go back over material already published${topics.length ? ` — ${topics[0]}` : ''}`)
  }

  const mood = imperativeMood(bare)
  if (mood.imperative) {
    return out(DIRECTIVE, `Directive — ${familyOf(bare)} family`, mood.why + cut,
      artifact ? 'MEDIUM' : 'HIGH', artifact ? A_SPAN : A_CLASSIFY,
      `Tells the reader to act${topics.length ? ` in connection with ${topics[0]}` : ''}`)
  }

  if (FORECAST.test(bare) && !CONDITIONAL.test(bare) && !INTENT.test(bare)) {
    return out(PREDICTION, 'Forecast / expected event',
      'future-facing language that names something as coming rather than conditional or intended',
      'MEDIUM', A_CLASSIFY,
      `Says something is going to happen${topics.length ? ` around ${topics[0]}` : ''}`)
  }

  const hasVerb = COPULA_OR_VERB.test(bare) || AMBIGUOUS_VERB.test(bare) || ED_ING.test(bare)
    || /\b(?:will|would|shall|can|could|may|might|must)\s+[a-z]{3,}\b/i.test(bare)
  const assertive = hasVerb && words.length >= 2
  if (assertive && (r.form === 'complete_sentence' || r.form === 'sentence_like_no_terminal' || words.length >= 4)) {
    const why = CONDITIONAL.test(bare) ? 'conditional — a claim, not a forecast'
      : INTENT.test(bare) ? 'statement of intent — a claim, not a forecast'
        : 'declarative with a finite verb; asserts something that could be true or false'
    return out(CLAIM, CONDITIONAL.test(bare) ? 'Conditional claim' : INTENT.test(bare) ? 'Statement of intent' : 'Assertion',
      why + cut, r.form === 'complete_sentence' && !artifact ? 'HIGH' : 'MEDIUM',
      artifact ? A_SPAN : A_CLASSIFY,
      `Asserts${names.length ? ` about ${names.slice(0, 2).join(' / ')}` : ''}${topics.length ? ` — ${topics[0]}` : ''}`)
  }

  // 8 — a half-sentence is not a label. Ask this before the label tests, or "Subpoena of all H."
  // gets filed as a topic label when it is really the front of a sentence.
  if (artifact) {
    return out(NEEDS, 'Segmentation artifact — split at an abbreviation',
      `the line ends on "${bare.split(/\s/).pop()}" and the drop continues "${clip(r.contextAfter, 50)}" — one sentence cut in two by the ". " unit boundary`,
      'HIGH', A_SPAN,
      'Not a whole sentence: rejoin the two halves before classifying either')
  }

  // A line that is nothing but a quotation is material Q reproduced — a headline, a title or a
  // line someone else said.
  if (QUOTED_WHOLE.test(t) && words.length >= 4) {
    return out(EVIDENCE, 'Quoted headline / title',
      'the entire line sits inside quotation marks — Q reproducing wording rather than writing it',
      'MEDIUM', A_CLASSIFY,
      `Reproduces "${clip(bare.replace(/^["“]|["”]$/g, ''), 70)}" as quoted material`)
  }

  // 9 — label-shaped lines. These are the ones an auditor keeps mislabelling as claims.
  if (TIMESTAMP.test(bare) || DATEISH.test(bare) || /^[\W\d\s]+$/u.test(bare)) {
    return out(CODE, 'Marker / counter / timestamp',
      'numeric or symbolic device with no proposition in it', 'HIGH', A_CLASSIFY,
      'A timestamp, counter or symbolic marker Q used as notation')
  }
  if (LIST_ITEM.test(bare) && !hasVerb) {
    const head = bare.split(':')[0].trim()
    const isEntityList = entityNames.has(head.toLowerCase()) || /^[A-Z]/.test(head)
    return out(isEntityList ? EVIDENCE : CODE, 'Pasted list row',
      `"${clip(head, 40)}:" heads a value with no verb — a row of a list Q pasted, not a sentence`,
      'MEDIUM', A_CLASSIFY,
      `One row of a list Q reproduced${topics.length ? ` — ${topics[0]}` : ''}`)
  }
  // "MSNBC – Rachel Maddow", "Xavier Becerra - Democrat Attorney General of California" — a row
  // of a roster Q pasted. The dash separates two sides; neither side is a sentence.
  if (DASH_LIST.test(bare) && !hasVerb && words.length <= 12) {
    const [left, right] = bare.split(/\s+[–—-]\s+/)
    const known = entityNames.has((left ?? '').toLowerCase().trim()) || entityNames.has((right ?? '').toLowerCase().trim())
    return out(known ? ENTITY : EVIDENCE, 'List or citation row (two sides split by a dash)',
      `"${clip(left ?? '', 30)}" and "${clip(right ?? '', 40)}" are the two sides of a pasted roster row, not a sentence`,
      'MEDIUM', A_CLASSIFY,
      `Pairs ${clip(left ?? '', 30)} with ${clip(right ?? '', 40)} inside a list Q reproduced`)
  }

  // A bullet under a header that ends in a colon inherits the header's job: it itemises what
  // the header asserts.
  if (bulleted && /:$/.test(listHeader)) {
    return out(CLAIM, 'Itemized assertion under a list header',
      `bulleted under "${clip(listHeader, 60)}" — the header states whose actions these are and the bullet states one of them`,
      'MEDIUM', A_CLASSIFY,
      `One item of what the drop asserts under "${clip(listHeader, 45)}"`)
  }

  // Verbless predication: "Puppets w/o power.", "No power left.", "WAR = scam (trillions)".
  // A bare noun phrase stays a label (the archive's own rule); a predication marker makes it an
  // assertion. The stringer test above has already taken the notation, so a bracket here is
  // punctuation inside a sentence rather than a reason to refuse.
  if (!hasVerb && ELLIPTIC.test(bare) && words.length >= 2 && !/^\[[^\]]*\]$/.test(bare)) {
    return out(CLAIM, 'Elliptical assertion (verbless predication)',
      'no finite verb, but the line predicates something — an equals sign, "w/o", "vs", a superlative or a "No X" frame — so it asserts rather than labels',
      'MEDIUM', A_CLASSIFY,
      `Asserts${names.length ? ` about ${names.slice(0, 2).join(' / ')}` : ''} without writing a full sentence${topics.length ? ` — ${topics[0]}` : ''}`)
  }

  // The entity must be most of the line. "Target/weaken conservative base (IRS/MSM)" contains
  // two certified entities and is still a statement about what someone is doing to them.
  const nameChars = names.reduce((n, s) => n + s.length, 0)
  if (names.length && words.length <= 6 && nameChars >= bare.replace(/\s/g, '').length * 0.5) {
    return out(ENTITY, 'Bare name used as a line',
      `the whole line is the entity ${names.map(n => `"${n}"`).join(', ')} standing alone`, 'HIGH',
      painted.size ? A_PAINT : A_CLASSIFY,
      `Names ${names.join(' / ')} as a standalone line — a label, not an assertion`)
  }
  if (entityNames.has(bare.toLowerCase().replace(/[.!]+$/, ''))) {
    return out(ENTITY, 'Bare name used as a line',
      'the line matches a certified entity exactly', 'HIGH', A_CLASSIFY,
      `Names ${bare} as a standalone line`)
  }
  // An ALL-CAPS shorthand line ("DECLAS CoC", "DEFLECT DECLAS") is notation, not a subject
  // heading — the theme test would otherwise claim it off a single anchor word.
  const anchorHit = anchorKeys.find(a => bare.toLowerCase().includes(a))
  if (anchorHit && !hasVerb && words.length >= 2 && !ALLCAPS_LABEL.test(bare)) {
    return out(THEME, 'Topic label',
      `contains the certified theme anchor "${anchorHit}" and no finite verb — it names a subject`,
      'MEDIUM', A_CLASSIFY,
      `Names ${anchorTheme.get(anchorHit)} as the subject without asserting anything about it`)
  }
  // Nothing above read it. Say why honestly rather than forcing a category. The archive's own
  // rule is that ALL CAPS alone is not a code and a bare noun phrase is not a claim, so a label
  // with no predication in it stays unplaced until the owner reads the drop.
  if (ALLCAPS_LABEL.test(bare) || words.length <= 3) {
    return out(NEEDS, 'Short label / heading',
      `${words.length} word${words.length === 1 ? '' : 's'}, no finite verb — a heading or slogan; the archive rule is that a label is not a claim`,
      'MEDIUM', A_CLASSIFY,
      `A heading or slogan${topics.length ? ` in a ${topics[0]} drop` : ''} — needs the drop's context to place`)
  }
  return out(NEEDS, 'Fragment',
    'no verb, no question form, no imperative — not resolvable from the line alone', 'LOW', A_CLASSIFY,
    `Fragment${topics.length ? ` in a ${topics[0]} drop` : ''} — read the surrounding drop to place it`)
}

// ── run ──────────────────────────────────────────────────────────────────────
const out = rows.map(r => ({ ...r, proposal: classify(r) }))
fs.writeFileSync(path.join(DIR, 'residual-classified.jsonl'), out.map(r => JSON.stringify(r)).join('\n') + '\n')

const tally = (key, filter = () => true) => {
  const m = {}
  for (const r of out) if (filter(r)) m[r.proposal[key]] = (m[r.proposal[key]] ?? 0) + 1
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]))
}
console.log('\nRESIDUAL CLASSIFICATION  —', out.length.toLocaleString(), 'queued lines\n')
console.log('by proposed category:')
for (const [k, v] of Object.entries(tally('category'))) console.log(`  ${k.padEnd(42)} ${String(v).padStart(6)}`)
console.log('\nby action needed:')
for (const [k, v] of Object.entries(tally('action'))) console.log(`  ${k.padEnd(62)} ${String(v).padStart(6)}`)
console.log('\nby confidence:')
for (const [k, v] of Object.entries(tally('confidence'))) console.log(`  ${k.padEnd(10)} ${String(v).padStart(6)}`)
console.log('\nJ_UNCLASSIFIED_PROSE only — the actual work:')
for (const [k, v] of Object.entries(tally('category', r => r.triageBucket === 'J_UNCLASSIFIED_PROSE'))) console.log(`  ${k.padEnd(42)} ${String(v).padStart(6)}`)
console.log('')
