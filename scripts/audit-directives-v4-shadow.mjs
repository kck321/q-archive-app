// DIRECTIVES v4 — SHADOW. V3 plus the five owner rulings of 15 Aug 2026.
//
// SHADOW MODE. Nothing applied, nothing certified, no canonical file written, no consumer
// migrated. Every record is keyed by STABLE OCCURRENCE ID (`postNum#index`) — never by count.
//
// The rulings, and where each one lives in this file:
//
//   R1  body wins over a reproduced payload            -> resolvePhrase() in the lib + ALSO_PAYLOAD
//   R2  #51 is Q-authored letter voice                 -> Q_BODY_LETTER_VOICE + LETTER_RULINGS
//   R3  "Have faith…" is an imperative Directive       -> HAVE_FAITH
//   R4  the derived page figure is 2,651               -> the reconciliation block at the end
//   R5  mid-sentence fragments repaired before migration -> FRAGMENT handling + the review export
//
//   node scripts/audit-directives-v4-shadow.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceSpansV2, resolvePhrase, sentenceContext, boardIdResolver, AUTHORSHIP, SOURCE_TYPE } from './lib/sourceSpansV2.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/source-spans-v2')
fs.mkdirSync(OUT, { recursive: true })
const rd = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

// Same reason as v5: shadow adjudications are keyed by pre-migration occurrence index.
const PRE = 'audit/backups/posts.pre-directives-v5.2705-153.json'
const posts = rd(fs.existsSync(path.join(ROOT, PRE)) ? PRE : 'public/data/posts.json')

// ── WHICH BASELINE V4 IS MEASURED AGAINST ────────────────────────────────────
//
// v2 (`audit/directives-adjudication-v2.json`) is the durable baseline: it predates this whole
// shadow build and nothing here can rewrite it.
//
// v3 is NOT durable, and treating it as such produced a wrong number once already. v3 is derived
// from `scripts/lib/sourceSpansV2.mjs`, and encoding owner rulings R2 and R3 in that library
// changed what a v3 re-run produces — #51 stopped being an embedded letter, so the "NEEDS_CONTEXT
// → KEEP" movement those rulings caused vanished from the v3→v4 diff the moment v3 was
// regenerated. A baseline that moves when the thing it measures moves is not a baseline.
//
// So: `priorRuling` is v2. v3 is carried alongside as `v3Ruling` for continuity, clearly labelled
// as a derived intermediate.
const v2 = rd('audit/directives-adjudication-v2.json')
const v2by = new Map(v2.rows.map(r => [r.recordId, r]))
const v3 = rd('audit/source-spans-v2/directives-adjudication-v3-shadow.json')
const v3by = new Map(v3.rows.map(r => [r.recordId, r]))
const resolveBoardId = boardIdResolver(posts)

const esc = s => `"${String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

// ── classification vocabulary ────────────────────────────────────────────────
const SCRIPTURE = [/put on the (full|whole) armou?r of god/i, /be strong in the lord/i, /stand firm then, with the belt/i,
  /take (up )?the (helmet of salvation|shield of faith)/i, /and pray in the spirit on all occasions/i,
  /with this in mind, be alert/i, /be on your guard; stand firm in the faith/i,
  /put to death, therefore, whatever belongs/i, /love is patient/i,
  /he makes me lie down/i, /you prepare a table before me/i, /surely your goodness and love/i, /ask and you shall receive/i]
const PRAYER = [/give us this day our daily bread/i, /forgive us our trespasses/i, /lead us not into temptation/i,
  /deliver us from (the )?evil/i, /our father who art in heaven/i, /thy (kingdom come|will be done)/i,
  /hallowed be thy name/i, /strengthen my faith, lord/i, /forgive my sins/i, /make me brave/i,
  /give me your wisdom/i, /help us to avoid temptation/i, /st\.? michael the archangel/i,
  /be our protection against/i, /may god rebuke him/i, /cast down to hell satan/i]
const BLESSING = [/^god ?bless\b/i, /^god ?speed\b/i, /^godspeed\b/i, /^amen\b/i, /^merry christmas/i,
  /^may god (bless|watch|also grant)/i, /^god (be with|save|is with|wins)/i, /^thank you (and|&) god bless/i,
  /^happy good friday/i, /^go with god/i, /^for god (and|&) country/i, /^in god we trust/i, /^god forever bless/i]
const MIXED = [[/^(god ?bless)( and | & )(stay safe|be safe)[.!]?$/i, 'God bless', 'be safe'],
  [/^(good luck)( and | & )(god bless)!?$/i, 'God Bless', 'Good luck']]
const REL_DIRECTIVE = [/^pray\b/i, /^please pray/i, /^if you are religious,? pray/i, /^never stop praying/i,
  /^read the bible/i, /^pray for (strength|guidance|america|the victims)/i,
  /^find peace (\[solace\] )?through prayer/i, /^to all americans, please pray/i, /^let us salute and pray/i, /^keep praying/i]
const RELIGIOUS = /\bgod\b|\blord\b|\bjesus\b|\bchrist\b|\bpray|\bamen\b|\bbless|\bbibl|\bscriptur|\bholy\b|\bsatan|\bdevil|\bfaith\b|\bchurch|\bheaven|\bworship|\bdivine\b/i
const IMPERATIVE = /^(pray|read|find|keep|stay|think|watch|listen|learn|remember|look|note|define|expand|ask|trust|follow|be |do |go |let |never |always |please |use |apply |review |consider |protect|prepare|stand|fight|vote|share|help|make |take |put |get |see |know |have )/i
const INTERROGATIVE_FORM = /^(don'?t|doesn'?t|didn'?t|won'?t|can'?t|couldn'?t|shouldn'?t|wouldn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|haven'?t|hasn'?t|hadn'?t)\s+(you|we|they|he|she|it|that|this|there)\b|^(do|does|did|can|could|should|would|will|is|are|was|were|have|has|had|am)\s+(you|we|they|he|she|it|that|this|there)\b|^(why|who|whom|whose|what|when|where|how|which)\b/i

// ── R3: "Have faith…" ────────────────────────────────────────────────────────
//
// OWNER RULING: "have faith" is an imperative. It tells the reader to maintain confidence,
// belief, trust or morale. The OBJECT of that faith may change the theme; it does not remove the
// directive function. `have ` is therefore added to IMPERATIVE above, which is what let
// REMOVE_STATEMENT_OR_HEADING claim these records in the first place: they matched RELIGIOUS on
// the word "faith" and failed IMPERATIVE only because the verb list had no "have".
const HAVE_FAITH = /\bhave\s+faith\b/i

// Religion & Spirituality is DUAL-ASSIGNED only when the complete sentence invokes a religious
// object. The word "faith" alone does not: "Have faith in Humanity." and "Have faith in your
// research." are morale and cognition directives.
const RELIGIOUS_OBJECT = /\bgod\b|\blord\b|\bjesus\b|\bchrist\b|\bpray(er|ing)?\b|\bscriptur|\bbibl|\bholy\b|\bheaven|\bdivine\b|\bproviden|\balmighty\b/i

// ── R2: #51, ruled explicitly by the owner ───────────────────────────────────
// Keyed by post + folded sentence so a re-ingest cannot silently re-point them.
const LETTER_RULINGS = new Map([
  ['51|find peace.', { ruling: 'KEEP_Q_DIRECTIVE', why: 'OWNER RULING: "Find" is an imperative directing the reader to seek or attain peace.' }],
  ['51|god bless and be safe.', {
    ruling: 'SPLIT_MIXED_SENTENCE', religiousSegment: 'God bless', directiveSegment: 'be safe',
    why: 'OWNER RULING: the full sentence stays the displayed span; the segments are stored, not highlighted separately.',
  }],
])
// The owner also ruled on a #51 body line that carries NO stored Directive record. Recorded here
// so the ruling is not lost, and reported separately — it is a theme assignment, not a removal.
const NON_DIRECTIVE_RULINGS = [{
  postNum: 51, sentence: 'God is with us.', ruling: 'REMOVE_STATEMENT_OR_HEADING',
  proposedDestination: 'RELIGION_THEME_ONLY',
  note: 'OWNER RULING. This line is not among #51\'s three stored actionRequests, so there is no Directive record to remove. It is a Religion & Spirituality assignment on a Q-authored body line.',
}]

// ── R5: mechanical fragment rules ────────────────────────────────────────────
// The owner's editorial rules that a parser CAN decide. The noun-vs-verb discrimination
// ("Push to DIVIDE is strong." — Push is a noun) cannot be, and is held.
const SENTENCE_IS_QUESTION = s => /\?["'”’)\]]*\s*$/.test(s.trim())

const rows = []
const fragments = []

for (const p of posts) {
  const reqs = p.actionRequests ?? []
  if (!reqs.length) continue
  const parsed = sourceSpansV2(p, { resolveBoardId })
  const seen = new Map()

  reqs.forEach((raw, idx) => {
    const stored = norm(typeof raw === 'string' ? raw : (raw?.text ?? raw?.sentence ?? ''))
    if (!stored) return
    const k = stored.toLowerCase()
    const nth = seen.get(k) ?? 0
    seen.set(k, nth + 1)

    const r = resolvePhrase(parsed, stored, nth)
    const sc = sentenceContext(parsed, r.span)
    const recordId = `${p.postNum}#${idx}`
    const prior = v2by.get(recordId)
    const v3row = v3by.get(recordId)

    const repaired = (r.spanText || '').trim()
    const directivePhrase = repaired || stored
    const cls = norm(directivePhrase)
    const fullSentence = sc?.fullSentence || directivePhrase
    const clsSentence = norm(fullSentence)
    const isFragment = Boolean(sc?.isMidSentenceFragment)

    let ruling, relSeg = '', dirSeg = '', dest = '', why = r.structuralReason
    let themes = []
    const explicit = LETTER_RULINGS.get(`${p.postNum}|${cls.toLowerCase()}`)
    const mix = MIXED.find(([rx]) => rx.test(cls))

    if (explicit) {
      // ── R2 ──
      ruling = explicit.ruling; why = explicit.why
      relSeg = explicit.religiousSegment ?? ''; dirSeg = explicit.directiveSegment ?? ''
      if (ruling === 'SPLIT_MIXED_SENTENCE') themes = ['Religion & Spirituality']
    } else if (r.authorshipState === AUTHORSHIP.NOT_LOCATED) {
      ruling = 'NEEDS_CONTEXT'
      why = 'phrase not located after span repair — held, never downgraded to quoted (rule 1)'
    } else if (r.authorshipState === AUTHORSHIP.AMBIGUOUS) {
      // #10's two records land here and stay held, per the owner's ruling.
      ruling = 'NEEDS_CONTEXT'
    } else if (r.confidence === 'LOW' || r.sourceType === SOURCE_TYPE.UNKNOWN) {
      ruling = 'NEEDS_CONTEXT'
      why = `ownership not structurally established (${r.structuralReason})`
    } else if (r.sourceType === SOURCE_TYPE.CODE_OR_TECHNICAL_TEXT) {
      ruling = 'REMOVE_CODE_OR_TECHNICAL_TEXT'
      why = 'scraped source code — never a natural-language Directive (rule 9)'
    } else if (r.sourceType === SOURCE_TYPE.ATTACHED_IMAGE || r.sourceType === SOURCE_TYPE.SCREENSHOT) {
      ruling = 'REMOVE_QUOTED_OR_THIRD_PARTY'
      why = 'attached-image text, never post body'
    } else if (r.authorshipState === AUTHORSHIP.QUOTED) {
      ruling = r.sourceType === SOURCE_TYPE.QUOTED_SCRIPTURE ? 'REMOVE_QUOTED_SCRIPTURE'
        : r.sourceType === SOURCE_TYPE.QUOTED_PRAYER ? 'REMOVE_PRAYER_TEXT'
        : 'REMOVE_QUOTED_OR_THIRD_PARTY'
    } else if (isFragment && SENTENCE_IS_QUESTION(fullSentence)) {
      // ── R5: full sentence is a question ──
      ruling = 'REMOVE_QUESTION_NOT_DIRECTIVE'
      why = 'OWNER RULE R5: the clipped fragment sits inside a sentence that is a question'
    } else if (PRAYER.some(rx => rx.test(clsSentence))) {
      ruling = 'REMOVE_PRAYER_TEXT'; why = 'reproduced prayer text in Q\'s own body'
    } else if (SCRIPTURE.some(rx => rx.test(clsSentence))) {
      ruling = 'REMOVE_QUOTED_SCRIPTURE'; why = 'reproduced scripture in Q\'s own body'
    } else if (HAVE_FAITH.test(clsSentence)) {
      // ── R3 ── evaluated on the COMPLETE sentence, before the blessing and religious-statement
      // branches that used to claim these records.
      ruling = 'KEEP_Q_DIRECTIVE'
      dirSeg = 'have faith'
      why = 'OWNER RULING R3: "have faith" is an imperative — an instruction to maintain confidence, belief or morale.'
      if (RELIGIOUS_OBJECT.test(clsSentence)) {
        ruling = 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME'
        themes = ['Religion & Spirituality']
        why += ' The complete sentence names a religious object, so Religion & Spirituality is dual-assigned.'
      }
    } else if (mix) {
      ruling = 'SPLIT_MIXED_SENTENCE'; relSeg = mix[1]; dirSeg = mix[2]; themes = ['Religion & Spirituality']
    } else if (REL_DIRECTIVE.some(rx => rx.test(cls))) {
      ruling = 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME'; themes = ['Religion & Spirituality']
    } else if (BLESSING.some(rx => rx.test(cls))) {
      ruling = 'REMOVE_BLESSING_OR_VALEDICTION'
      dest = 'RELIGION_THEME_ONLY'
      why = r.signatureStripped ? 'blessing/valediction, Q signature cut into its own span (rule 7)' : 'blessing or valediction, not a command'
    } else if (INTERROGATIVE_FORM.test(cls) && !IMPERATIVE.test(cls)) {
      ruling = 'REMOVE_QUESTION_NOT_DIRECTIVE'
      why = 'Q-authored sentence in interrogative form — belongs to Questions, not Directives'
    } else if (RELIGIOUS.test(cls) && !IMPERATIVE.test(cls)) {
      ruling = 'REMOVE_STATEMENT_OR_HEADING'; dest = 'RELIGION_THEME_ONLY'
    } else {
      ruling = 'KEEP_Q_DIRECTIVE'
    }

    // ── R5: hold every genuine fragment the mechanical rules did not settle ──
    //
    // The owner's remaining rule needs a human: does the complete sentence show the word is
    // actually a noun, adjective, heading or declarative clause? A parser cannot tell "Push to
    // DIVIDE is strong." (noun) from "Push back." (verb), so those records are HELD rather than
    // guessed, and the visual highlight becomes the whole sentence either way.
    const settledMechanically = ['REMOVE_QUESTION_NOT_DIRECTIVE', 'REMOVE_CODE_OR_TECHNICAL_TEXT',
      'REMOVE_QUOTED_OR_THIRD_PARTY', 'REMOVE_QUOTED_SCRIPTURE', 'REMOVE_PRAYER_TEXT', 'NEEDS_CONTEXT'].includes(ruling)
    let heldAsFragment = false
    if (isFragment && !settledMechanically) {
      heldAsFragment = true
      ruling = 'NEEDS_FRAGMENT_REVIEW'
      why = 'OWNER RULING R5: stored phrase is clipped from the middle of a longer sentence; part-of-speech of the leading word must be read from the complete sentence by an editor.'
    }

    rows.push({
      recordId, postNum: p.postNum, occurrenceIndex: idx, occurrenceOfPhrase: nth,
      storedPhrase: stored,
      // The DISPLAYED span is always the complete sentence — never a half-sentence highlight.
      sentenceText: fullSentence,
      directivePhrase: dirSeg || directivePhrase,
      directiveSegments: dirSeg || directivePhrase,
      religiousSegment: relSeg,
      themes: themes.join('|'),
      proposedDestination: dest,
      urlStripped: r.urlStripped || '', signatureStripped: r.signatureStripped || '',
      startLine: r.span?.startLine ?? -1, endLine: r.span?.endLine ?? -1,
      startOffset: r.span?.startOffset ?? -1, endOffset: r.span?.endOffset ?? -1,
      authorshipState: r.authorshipState,
      sourceType: r.sourceType,
      alsoQuotedInPayload: String((r.alsoQuotedInPayload ?? 0) > 0),
      referencedPostNum: r.referencedPostNum ?? '',
      isMidSentenceFragment: String(isFragment),
      sentencesOnLine: sc?.sentencesOnLine ?? 1,
      contextBefore: sc?.contextBefore ?? '', contextAfter: sc?.contextAfter ?? '',
      priorRuling: prior?.ruling ?? '',
      v3Ruling: v3row?.proposedRuling ?? '',
      proposedRuling: ruling,
      reason: why,
      confidence: r.confidence,
      rulingChanged: String((prior?.ruling ?? '') !== ruling),
      changedSinceV3: String((v3row?.proposedRuling ?? '') !== ruling),
      heldAsFragment: String(heldAsFragment),
    })
  })
}

// ── R5: one full-sentence highlight, multiple directive segments ─────────────
// Records sharing a post and a sentence are collapsed to a single displayed span carrying every
// directive segment, rather than overlapping partial highlights.
const bySentence = new Map()
for (const r of rows) {
  if (!r.proposedRuling.startsWith('KEEP')) continue
  const k = `${r.postNum}|${r.sentenceText.toLowerCase()}`
  if (!bySentence.has(k)) bySentence.set(k, [])
  bySentence.get(k).push(r)
}
let multiSegment = 0
for (const [, group] of bySentence) {
  if (group.length < 2) continue
  multiSegment++
  const segs = [...new Set(group.map(g => g.directivePhrase))].join(' · ')
  for (const g of group) { g.directiveSegments = segs; g.sharedSentenceWith = group.filter(x => x !== g).map(x => x.recordId).join(' ') }
}
for (const r of rows) if (r.sharedSentenceWith === undefined) r.sharedSentenceWith = ''

// ── R5: the editorial review export ──────────────────────────────────────────
// EVERY record the offset test flagged, so the owner reviews the full 107 — but with the two
// populations separated, because they are different problems.
for (const r of rows) {
  const offsetFlagged = r.startOffset > 0
  if (!offsetFlagged) continue
  fragments.push({
    stableOccurrenceId: r.recordId,
    postNum: r.postNum,
    fullSentence: r.sentenceText,
    storedFragment: r.storedPhrase,
    directivePhrase: r.directivePhrase,
    startOffset: r.startOffset,
    endOffset: r.endOffset,
    authorshipState: r.authorshipState,
    sourceType: r.sourceType,
    contextBefore: r.contextBefore,
    contextAfter: r.contextAfter,
    fragmentClass: r.isMidSentenceFragment === 'true' ? 'MID_SENTENCE_FRAGMENT' : 'SENTENCE_ON_SHARED_LINE',
    sentencesOnLine: r.sentencesOnLine,
    shadowRulingForReference: r.proposedRuling,
    proposedRuling: '',                    // BLANK, per the owner's instruction
    reason: '',                            // blank for the editor to fill
  })
}

// ── R5, second population: the defect the owner's own examples actually describe ─────────────
//
// Three of the four examples the ruling gives — "Push to DIVIDE is strong." (#1183),
// "Select news members…" (#617), "Release coming." (#566) — are NOT mid-sentence fragments. They
// start at offset 0 and are complete sentences. What is wrong with them is the OTHER half of the
// rule: the leading word is a noun or adjective, not an imperative verb, and only the complete
// sentence shows it. That defect is invisible to the offset test, so it gets its own worksheet.
//
// The discrimination is genuinely editorial — "Note the pictures we post are ALL originals." and
// "Trust there are more good than bad." lead with real imperatives followed by a declarative
// clause. So this is a CANDIDATE list with a blank ruling column, not a set of verdicts.
const AMBIGUOUS_LEAD = /^(push|release|select|trade|report|post|rest|count|track|cross|focus|force|order|plan|play|point|show|sign|test|time|turn|work|break|change|charge|check|claim|control|cover|deal|demand|doubt|drop|end|fight|fire|form|guard|hand|help|hold|hope|increase|influence|interest|issue|lead|link|look|move|need|offer|open|pass|pay|place|press|promise|purchase|question|reach|record|request|research|result|return|review|rise|risk|rule|run|search|set|share|shift|signal|sound|split|stand|start|state|step|stop|store|study|support|surge|switch|talk|target|thought|threat|trust|value|view|watch|win|access|advance|aid|attack|balance|blame|call|care|cause|challenge|command|comment|concern|conflict|contact|contract|debate|defeat|delay|design|detail|display|dispute|effect|escape|exchange|export|fall|favor|fear|feature|flow|fund|gain|grant|group|guide|harm|host|hunt|impact|import|kill|lack|land|last|launch|light|limit|list|load|loss|mark|match|matter|measure|mind|name|note|notice|number|object|pardon|part|pattern|permit|phase|pick|piece|pitch|pledge|plot|poll|power|practice|praise|profile|profit|program|progress|project|proof|protest|pull|purge|raise|rally|range|rank|rate|reason|reform|refuse|regard|reply|rescue|reserve|respect|response|restore|reverse|reward|route|sample|save|scale|scan|schedule|scope|score|screen|seal|seat|secure|sense|serve|service|shape|shield|shock|shoot|shot|shut|slide|solve|sort|source|space|spark|speed|spend|spike|spread|spring|stage|stake|stall|stamp|stock|storm|strain|stream|stress|stretch|strike|strip|struggle|style|subject|sum|surface|survey|suspect|swap|sweep|swing|tag|tap|tax|team|term|throw|tie|tip|toll|tour|trace|trail|train|transfer|transport|trap|travel|treat|trend|trial|trigger|trip|tune|update|upgrade|use|visit|voice|volume|vote|wage|walk|want|war|warn|waste|wave|weight|witness|wonder|yield)\b/i
const DECLARATIVE_TAIL = /\b(is|are|was|were|has|have|had|will be|remains?|coming|reached|became|becomes?|continues?|appears?|seems?|means?|equals?|includes?|shows?|indicates?|represents?|deemed)\b/i

const leadCandidates = []
for (const r of rows) {
  if (!r.proposedRuling.startsWith('KEEP')) continue
  const s = norm(r.sentenceText)
  if (!AMBIGUOUS_LEAD.test(s)) continue
  if (!DECLARATIVE_TAIL.test(s.replace(/^\S+\s*/, ''))) continue
  leadCandidates.push({
    stableOccurrenceId: r.recordId, postNum: r.postNum,
    fullSentence: r.sentenceText, storedFragment: r.storedPhrase, directivePhrase: r.directivePhrase,
    leadingWord: s.split(/\s+/)[0].replace(/[^A-Za-z]/g, ''),
    startOffset: r.startOffset, endOffset: r.endOffset,
    authorshipState: r.authorshipState, sourceType: r.sourceType,
    contextBefore: r.contextBefore, contextAfter: r.contextAfter,
    shadowRulingForReference: r.proposedRuling,
    proposedRuling: '', reason: '',
  })
}
const leadCols = ['stableOccurrenceId', 'postNum', 'fullSentence', 'storedFragment', 'directivePhrase', 'leadingWord',
  'startOffset', 'endOffset', 'authorshipState', 'sourceType', 'contextBefore', 'contextAfter',
  'shadowRulingForReference', 'proposedRuling', 'reason']
fs.writeFileSync(path.join(ROOT, 'audit/directives-declarative-lead-candidates.csv'), csv(leadCols, leadCandidates))
fs.writeFileSync(path.join(ROOT, 'audit/directives-declarative-lead-candidates.json'),
  JSON.stringify({
    certified: false,
    note: 'NOT CERTIFIED. Candidates only — proposedRuling is intentionally blank. These are complete sentences whose LEADING WORD may be a noun or adjective rather than an imperative verb. Approve by stableOccurrenceId, never by count.',
    total: leadCandidates.length, rows: leadCandidates,
  }, null, 1))

const fragCols = ['stableOccurrenceId', 'postNum', 'fullSentence', 'storedFragment', 'directivePhrase',
  'startOffset', 'endOffset', 'authorshipState', 'sourceType', 'contextBefore', 'contextAfter',
  'fragmentClass', 'sentencesOnLine', 'shadowRulingForReference', 'proposedRuling', 'reason']
fs.writeFileSync(path.join(ROOT, 'audit/directives-mid-sentence-107-editorial-review.csv'), csv(fragCols, fragments))
fs.writeFileSync(path.join(ROOT, 'audit/directives-mid-sentence-107-editorial-review.json'),
  JSON.stringify({
    certified: false,
    note: 'NOT CERTIFIED. proposedRuling is intentionally blank — this is the editorial worksheet for owner ruling R5. Approve by stableOccurrenceId, never by count.',
    totals: {
      offsetFlagged: fragments.length,
      midSentenceFragments: fragments.filter(f => f.fragmentClass === 'MID_SENTENCE_FRAGMENT').length,
      sentenceOnSharedLine: fragments.filter(f => f.fragmentClass === 'SENTENCE_ON_SHARED_LINE').length,
    },
    rows: fragments,
  }, null, 1))

// ── tallies + diff vs v3 ─────────────────────────────────────────────────────
const tally = {}, states = {}, types = {}
for (const r of rows) {
  tally[r.proposedRuling] = (tally[r.proposedRuling] ?? 0) + 1
  states[r.authorshipState] = (states[r.authorshipState] ?? 0) + 1
  types[r.sourceType] = (types[r.sourceType] ?? 0) + 1
}
const changed = rows.filter(r => r.rulingChanged === 'true')
const moves = {}
for (const r of changed) { const k = `${r.priorRuling || '(none)'} -> ${r.proposedRuling}`; moves[k] = (moves[k] ?? 0) + 1 }

// ── ruling fixtures ──────────────────────────────────────────────────────────
const byId = new Map(rows.map(r => [r.recordId, r]))
const find = (pn, frag) => rows.find(r => r.postNum === pn && r.storedPhrase.toLowerCase().includes(frag.toLowerCase()))
const checks = []
const C = (label, ok, got, want) => checks.push({ label, pass: Boolean(ok), got: String(got), want: String(want) })

// R1
const dual = rows.filter(r => r.alsoQuotedInPayload === 'true')
C('R1 body wins over payload — records carry alsoQuotedInPayload', dual.length > 0, `${dual.length} records`, '>0')
C('R1 none of them was held as ambiguous', dual.every(r => r.proposedRuling !== 'NEEDS_CONTEXT' || r.postNum === 10), `${dual.filter(r => r.proposedRuling === 'NEEDS_CONTEXT').length} held`, '0 held')
for (const [pn, frag] of [[316, 'Expand your thinking'], [1266, 'Trust the plan'], [729, 'Learn'], [730, 'Learn']]) {
  const r = find(pn, frag)
  C(`R1 #${pn} "${frag}" resolves to the body`, r?.authorshipState === AUTHORSHIP.Q, `${r?.authorshipState}/${r?.alsoQuotedInPayload}`, 'Q_AUTHORED_CURRENT_POST')
}
// R2
C('R2 #51 is Q-authored', rows.filter(r => r.postNum === 51).every(r => r.authorshipState === AUTHORSHIP.Q), rows.filter(r => r.postNum === 51).map(r => r.authorshipState).join(','), 'all Q_AUTHORED_CURRENT_POST')
C('R2 #51 sourceType is Q_BODY_LETTER_VOICE', rows.filter(r => r.postNum === 51).every(r => r.sourceType === SOURCE_TYPE.Q_BODY_LETTER_VOICE), rows.filter(r => r.postNum === 51).map(r => r.sourceType).join(','), 'all Q_BODY_LETTER_VOICE')
C('R2 #51 "Find peace." KEEP_Q_DIRECTIVE', find(51, 'Find peace')?.proposedRuling === 'KEEP_Q_DIRECTIVE', find(51, 'Find peace')?.proposedRuling, 'KEEP_Q_DIRECTIVE')
{
  const r = find(51, 'God bless and be safe')
  C('R2 #51 "God bless and be safe." SPLIT_MIXED_SENTENCE', r?.proposedRuling === 'SPLIT_MIXED_SENTENCE', r?.proposedRuling, 'SPLIT_MIXED_SENTENCE')
  C('R2 … religiousSegment "God bless"', r?.religiousSegment === 'God bless', r?.religiousSegment, 'God bless')
  C('R2 … directiveSegment "be safe"', r?.directivePhrase === 'be safe', r?.directivePhrase, 'be safe')
  C('R2 … full sentence stays the displayed span', norm(r?.sentenceText ?? '') === 'God bless and be safe.', JSON.stringify(r?.sentenceText ?? ''), '"God bless and be safe."')
}
// R3
const hf = rows.filter(r => HAVE_FAITH.test(norm(r.sentenceText)))
C('R3 every "have faith" sentence is a Directive', hf.every(r => r.proposedRuling.startsWith('KEEP')), `${hf.filter(r => !r.proposedRuling.startsWith('KEEP')).length} not kept of ${hf.length}`, `0 of ${hf.length}`)
C('R3 directivePhrase is "have faith"', hf.every(r => r.directivePhrase === 'have faith'), `${hf.filter(r => r.directivePhrase !== 'have faith').length} wrong`, '0 wrong')
{
  const god = find(4429, 'Have faith in God')
  C('R3 "Have faith in God." is dual-classified', god?.proposedRuling === 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', god?.proposedRuling, 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME')
  const hum = find(4427, 'Have faith in Humanity')
  C('R3 "Have faith in Humanity." is Directive only', hum?.proposedRuling === 'KEEP_Q_DIRECTIVE' && !hum?.themes, `${hum?.proposedRuling} themes=${hum?.themes}`, 'KEEP_Q_DIRECTIVE, no theme')
  const cmp = find(4, 'lot more good people than bad')
  C('R3 compound sentence keeps the whole sentence as the highlight',
    /^again, there are a lot more good people than bad so have faith\.$/i.test(norm(cmp?.sentenceText ?? '')), JSON.stringify(cmp?.sentenceText ?? ''), 'the full sentence')
}
// R5
C('R5 #10 stays NEEDS_CONTEXT', ['10#0', '10#1'].every(id => byId.get(id)?.proposedRuling === 'NEEDS_CONTEXT'), ['10#0', '10#1'].map(id => byId.get(id)?.proposedRuling).join(','), 'NEEDS_CONTEXT,NEEDS_CONTEXT')
C('R5 review file has proposedRuling blank on every row', fragments.every(f => f.proposedRuling === ''), `${fragments.filter(f => f.proposedRuling !== '').length} filled`, '0 filled')
C('R5 no half-sentence highlight — sentenceText always contains directivePhrase',
  rows.filter(r => r.proposedRuling.startsWith('KEEP') && r.directivePhrase !== 'have faith' && r.directivePhrase !== 'be safe')
    .every(r => norm(r.sentenceText).toLowerCase().includes(norm(r.directivePhrase).toLowerCase())),
  'checked', 'all contained')
const cFails = checks.filter(c => !c.pass)

// ── output ───────────────────────────────────────────────────────────────────
console.log('\nDIRECTIVES v4 — SHADOW (owner rulings applied)\n')
console.log(`  records adjudicated : ${rows.length}`)
console.log(`  ruling fixtures     : ${checks.length - cFails.length}/${checks.length} pass`)
for (const c of cFails) console.log(`     FAIL  ${c.label}\n           got  ${c.got}\n           want ${c.want}`)
console.log('\n  V4 authorship states:')
for (const [k, v] of Object.entries(states).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('\n  V4 source types:')
for (const [k, v] of Object.entries(types).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('\n  V4 rulings:')
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log(`\n  changed from v2 (frozen baseline)      : ${changed.length} of ${rows.length}`)
console.log(`  changed from v3 (derived intermediate) : ${rows.filter(r => r.changedSinceV3 === 'true').length}`)
for (const [k, v] of Object.entries(moves).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log(`\n  offset-flagged records   : ${fragments.length}`)
console.log(`    MID_SENTENCE_FRAGMENT  : ${fragments.filter(f => f.fragmentClass === 'MID_SENTENCE_FRAGMENT').length}`)
console.log(`    SENTENCE_ON_SHARED_LINE: ${fragments.filter(f => f.fragmentClass === 'SENTENCE_ON_SHARED_LINE').length}`)
console.log(`  held as NEEDS_FRAGMENT_REVIEW : ${rows.filter(r => r.heldAsFragment === 'true').length}`)
console.log(`  sentences carrying >1 directive segment : ${multiSegment}`)
console.log(`  records with alsoQuotedInPayload : ${dual.length}`)

const cols = ['recordId', 'postNum', 'occurrenceIndex', 'occurrenceOfPhrase', 'storedPhrase', 'sentenceText',
  'directivePhrase', 'directiveSegments', 'religiousSegment', 'themes', 'proposedDestination',
  'urlStripped', 'signatureStripped', 'startLine', 'endLine', 'startOffset', 'endOffset',
  'authorshipState', 'sourceType', 'alsoQuotedInPayload', 'referencedPostNum',
  'isMidSentenceFragment', 'sentencesOnLine', 'contextBefore', 'contextAfter', 'sharedSentenceWith',
  'priorRuling', 'v3Ruling', 'proposedRuling', 'reason', 'confidence', 'rulingChanged', 'changedSinceV3', 'heldAsFragment']
fs.writeFileSync(path.join(OUT, 'directives-adjudication-v4-shadow.csv'), csv(cols, rows))
fs.writeFileSync(path.join(OUT, 'directives-adjudication-v4-shadow.json'),
  JSON.stringify({
    certified: false,
    note: 'NOT CERTIFIED. Approve by stable occurrence ID after the sourceSpansV2 rerun — never by a remembered count.',
    ownerRulings: ['R1 body wins over reproduced payload', 'R2 #51 Q_BODY_LETTER_VOICE', 'R3 have-faith is a Directive',
      'R4 derived page figure 2,651', 'R5 mid-sentence fragments repaired before migration'],
    nonDirectiveRulings: NON_DIRECTIVE_RULINGS,
    tally, states, types, rows,
  }, null, 1))
const diffCols = ['recordId', 'postNum', 'storedPhrase', 'sentenceText', 'directivePhrase', 'authorshipState',
  'sourceType', 'priorRuling', 'v3Ruling', 'proposedRuling', 'themes', 'reason']
fs.writeFileSync(path.join(OUT, 'directives-v2-to-v4-diff.csv'), csv(diffCols, changed))
fs.writeFileSync(path.join(OUT, 'directives-v3-to-v4-diff.csv'), csv(diffCols, rows.filter(r => r.changedSinceV3 === 'true')))

// ── R4: counts, recomputed through the real page functions ──────────────────
const dedupeKey = t => (t ?? '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
const normalizeItemKey = t => String(t).toLowerCase().replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim()
const pageCounts = (keep) => {
  const groups = new Map(); const postsIn = new Set(); let mentions = 0
  for (const p of posts) {
    if (!p.hasRequests) continue
    const seen = new Set()
    ;(p.actionRequests ?? []).forEach((it, idx) => {
      if (keep && !keep(`${p.postNum}#${idx}`)) return
      const dk = dedupeKey(it)
      if (seen.has(dk)) return
      seen.add(dk)
      const g = normalizeItemKey(it)
      if (!groups.has(g)) groups.set(g, 0)
      groups.set(g, groups.get(g) + 1)
      mentions++; postsIn.add(p.postNum)
    })
  }
  return { mentions, groups: groups.size, posts: postsIn.size }
}
const KEEP = new Set(rows.filter(r => r.proposedRuling.startsWith('KEEP') || r.proposedRuling === 'SPLIT_MIXED_SENTENCE').map(r => r.recordId))
const HELD = new Set(rows.filter(r => r.proposedRuling === 'NEEDS_CONTEXT' || r.proposedRuling === 'NEEDS_FRAGMENT_REVIEW').map(r => r.recordId))
const today = pageCounts(null)
const projected = pageCounts(id => KEEP.has(id) || HELD.has(id))
const projectedIfHeldResolveToKeep = pageCounts(id => KEEP.has(id) || HELD.has(id))

console.log('\nCOUNTS, recomputed through dedupePostArrays() + normalizeItemKey()')
console.log(`  today   : ${today.mentions} mentions · ${today.groups} groups · ${today.posts} posts`)
console.log(`  if V4 applied (holds retained): ${projected.mentions} mentions · ${projected.groups} groups · ${projected.posts} posts`)
console.log('  NOT applied. The page is unchanged and still renders the stored data.')

fs.writeFileSync(path.join(OUT, 'directives-v4-count-projection.json'), JSON.stringify({
  certified: false,
  note: 'Projection only. Recomputed with the same functions the live page runs. The page was not changed.',
  today, projectedIfV4Applied: projected,
  removedByV4: rows.filter(r => r.proposedRuling.startsWith('REMOVE')).length,
  heldByV4: HELD.size,
}, null, 1))

// ── The Directives-only migration diff ───────────────────────────────────────
//
// PROVISIONAL, and it says so on every row. It cannot be final until the fragment worksheet and
// the declarative-lead worksheet come back and #10 is settled — those three sets are listed as
// BLOCKED rather than folded into a projected count.
const blocked = rows.filter(r => r.proposedRuling === 'NEEDS_FRAGMENT_REVIEW' || r.proposedRuling === 'NEEDS_CONTEXT')
const blockedIds = new Set([...blocked.map(r => r.recordId), ...leadCandidates.map(r => r.stableOccurrenceId)])
const mig = rows.map(r => ({
  stableOccurrenceId: r.recordId, postNum: r.postNum,
  storedPhrase: r.storedPhrase, sentenceText: r.sentenceText,
  directiveSegments: r.directiveSegments, religiousSegment: r.religiousSegment,
  themes: r.themes, proposedDestination: r.proposedDestination,
  authorshipState: r.authorshipState, sourceType: r.sourceType,
  alsoQuotedInPayload: r.alsoQuotedInPayload,
  action: r.proposedRuling.startsWith('KEEP') ? 'KEEP'
    : r.proposedRuling === 'SPLIT_MIXED_SENTENCE' ? 'KEEP_AND_SPLIT_SEGMENTS'
    : r.proposedRuling.startsWith('REMOVE') ? 'REMOVE_FROM_DIRECTIVES'
    : 'HOLD',
  proposedRuling: r.proposedRuling,
  status: blockedIds.has(r.recordId) ? 'BLOCKED_PENDING_EDITORIAL' : 'READY',
  blockedBy: blockedIds.has(r.recordId)
    ? (r.proposedRuling === 'NEEDS_CONTEXT' ? 'post-#10 early-4chan provenance'
      : r.proposedRuling === 'NEEDS_FRAGMENT_REVIEW' ? 'R5 fragment worksheet'
      : 'R5 declarative-lead worksheet')
    : '',
  reason: r.reason,
}))
const migCols = ['stableOccurrenceId', 'postNum', 'storedPhrase', 'sentenceText', 'directiveSegments',
  'religiousSegment', 'themes', 'proposedDestination', 'authorshipState', 'sourceType',
  'alsoQuotedInPayload', 'action', 'proposedRuling', 'status', 'blockedBy', 'reason']
fs.writeFileSync(path.join(OUT, 'directives-migration-diff-provisional.csv'), csv(migCols, mig))

const actions = {}
for (const m of mig) actions[m.action] = (actions[m.action] ?? 0) + 1
console.log('\nDIRECTIVES-ONLY MIGRATION DIFF (PROVISIONAL — not applied, not migrated)')
for (const [k, v] of Object.entries(actions).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log(`    ${String(mig.filter(m => m.status === 'BLOCKED_PENDING_EDITORIAL').length).padStart(5)}  BLOCKED_PENDING_EDITORIAL`)

console.log(`\nwrote audit/source-spans-v2/directives-adjudication-v4-shadow.{csv,json}`)
console.log(`      audit/source-spans-v2/directives-v3-to-v4-diff.csv`)
console.log(`      audit/directives-mid-sentence-107-editorial-review.{csv,json}`)
console.log('nothing applied · nothing migrated · nothing deployed')
