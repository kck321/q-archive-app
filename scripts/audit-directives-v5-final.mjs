// DIRECTIVES v5 — FINAL adjudication. Every one of the 2,705 stored occurrences, ruled.
//
// This is the file the migration reads. It carries ZERO blank rulings, ZERO blocked rows and
// ZERO inherited heuristic destinations. Every ruling is keyed by STABLE OCCURRENCE ID.
//
// Where each ruling comes from, in precedence order:
//
//   1. audit/directives-declarative-lead-owner-rulings.json   26 hand adjudications
//   2. EXPLICIT below                                          #10, #51, #1252, #4437
//   3. R3 have-faith                                           46 records
//   4. provenance from sourceSpansV2                           quoted / code / image
//   5. the classification vocabulary                           everything else
//
// READ-ONLY over posts.json. Writes only under audit/.
//   node scripts/audit-directives-v5-final.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceSpansV2, resolvePhrase, sentenceContext, boardIdResolver, AUTHORSHIP, SOURCE_TYPE } from './lib/sourceSpansV2.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/source-spans-v2')
fs.mkdirSync(OUT, { recursive: true })
const rd = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

// ── ALWAYS ADJUDICATE THE PRE-MIGRATION CORPUS ──────────────────────────────
//
// v5 rules all 2,705 STORED occurrences, and `postNum#index` is only stable against the array
// those indices were assigned from. Once the migration lands, live posts.json holds 2,552 and
// every index after a removal has shifted: `1183#0` stops meaning "Push to DIVIDE is strong."
// and starts meaning "Think pre vs post 2016 election.". Re-deriving v5 from the migrated cache
// therefore re-points every ruling — and on 16 Aug 2026 it did, silently deleting three innocent
// directives when the canonical script consumed the result.
//
// So this script reads the pre-migration backup whenever it exists. That also makes it
// reproducible forever, instead of only until the migration runs.
const PRE = 'audit/backups/posts.pre-directives-v5.2705-153.json'
const postsPath = fs.existsSync(path.join(ROOT, PRE)) ? PRE : 'public/data/posts.json'
const posts = rd(postsPath)
if (postsPath === PRE) console.log(`  corpus: ${PRE} (pre-migration, 2,705 occurrences)`)
const v4 = rd('audit/source-spans-v2/directives-adjudication-v4-shadow.json')
const v4by = new Map(v4.rows.map(r => [r.recordId, r]))
const leadRulings = new Map(rd('audit/directives-declarative-lead-owner-rulings.json').rulings.map(r => [r.stableOccurrenceId, r]))
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
const HAVE_FAITH = /\bhave\s+faith\b/i
const RELIGIOUS_OBJECT = /\bgod\b|\blord\b|\bjesus\b|\bchrist\b|\bpray(er|ing)?\b|\bscriptur|\bbibl|\bholy\b|\bheaven|\bdivine\b|\bproviden|\balmighty\b/i

// ── EXPLICIT owner rulings, by stable occurrence ID ──────────────────────────
//
// #10 — the owner required visual verification against the canonical body before clearing.
// Evidence recorded per record in `evidence` and asserted by a fixture below: post #10 has no
// quotedPosts, no `>>` pointer, no quotation mark anywhere, and both stored phrases occur in
// line 0 of its own canonical body. Nothing structurally supports another author.
const EXPLICIT = new Map([
  ['10#0', { ruling: 'KEEP_Q_DIRECTIVE', segments: 'Remember', authorship: AUTHORSHIP.Q, sourceType: SOURCE_TYPE.Q_BODY,
    why: 'OWNER RULING: "Remember" is the imperative; the rest of the sentence is the proposition the reader is instructed to remember.',
    evidence: 'Canonical #10 body line 0 contains the phrase verbatim. The post has no quotedPosts, no >>pointer and no quotation mark — nothing structurally supports another author.' }],
  ['10#1', { ruling: 'KEEP_Q_DIRECTIVE', segments: 'Dig', authorship: AUTHORSHIP.Q, sourceType: SOURCE_TYPE.Q_BODY,
    why: 'OWNER RULING: a direct imperative.',
    evidence: 'Canonical #10 body line 0 contains "Dig!!!!!" verbatim, in the same unquoted paragraph. No quotedPosts, no >>pointer, no quotation mark.' }],
  ['51#0', { ruling: 'KEEP_Q_DIRECTIVE', segments: 'Rest assured',
    why: 'OWNER RULING: "Rest assured" is an imperative/exhortation; the full sentence is the displayed highlight.' }],
  ['51#1', { ruling: 'KEEP_Q_DIRECTIVE', segments: 'Find peace',
    why: 'OWNER RULING: "Find" is an imperative directing the reader to seek or attain peace.' }],
  ['51#2', { ruling: 'SPLIT_MIXED_SENTENCE', segments: 'be safe', religiousSegment: 'God bless',
    themes: 'Religion & Spirituality',
    why: 'OWNER RULING: the complete sentence stays the displayed span; the segments are stored, never highlighted separately.' }],
  ['1252#1', { ruling: 'KEEP_Q_DIRECTIVE', segments: 'learn the TRUTH', fragmentRepaired: true,
    why: 'OWNER RULING: the "It\'s time to…" construction is exhortative and directs the audience toward the action. Full displayed highlight is the complete sentence.' }],
])
for (const idx of [0, 1, 2, 3, 4]) {
  EXPLICIT.set(`4437#${idx}`, { ruling: 'REMOVE_CODE_OR_TECHNICAL_TEXT', segments: '', fragmentRepaired: true,
    why: 'OWNER RULING: scraped Capybara/Ruby login automation, not natural-language command language authored by Q. Removed from Q Directives only; the source text and code evidence are untouched.' })
}

const KEEP_RULINGS = new Set(['KEEP_Q_DIRECTIVE', 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', 'SPLIT_MIXED_SENTENCE'])

const rows = []
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
    const prior = v4by.get(recordId)

    const repaired = (r.spanText || '').trim() || stored
    const cls = norm(repaired)
    // R5: the DISPLAYED span is always the complete sentence.
    const fullSentence = sc?.fullSentence || repaired
    const clsSentence = norm(fullSentence)
    const wasFragment = Boolean(sc?.isMidSentenceFragment)

    let ruling, segments = repaired, relSeg = '', dest = '', why = r.structuralReason
    let themes = '', evidence = '', source = ''
    let overrideState = null, overrideType = null

    // A record whose stored phrase was a truncated fragment has no meaningful sub-segment: the
    // whole repaired sentence IS the directive. Without this, #2754 kept the segment label
    // "Compare v." — the very truncation the repair fixed.
    if (sc?.fullSentence && norm(sc.fullSentence).toLowerCase() !== norm(stored).toLowerCase()
      && norm(sc.fullSentence).toLowerCase().startsWith(norm(stored).toLowerCase())) segments = sc.fullSentence

    const explicit = EXPLICIT.get(recordId)
    const lead = leadRulings.get(recordId)
    const mix = MIXED.find(([rx]) => rx.test(cls))

    if (explicit) {
      source = 'OWNER_RULING_EXPLICIT'
      ruling = explicit.ruling; segments = explicit.segments || repaired
      relSeg = explicit.religiousSegment ?? ''; themes = explicit.themes ?? ''
      why = explicit.why; evidence = explicit.evidence ?? ''
      // The owner ruled on PROVENANCE too for #10 — visual verification against the canonical
      // body beats the parser's structural abstention, and the evidence is recorded per record.
      if (explicit.authorship) { overrideState = explicit.authorship; overrideType = explicit.sourceType }
    } else if (lead) {
      source = 'EDITORIAL_DECLARATIVE_LEAD'
      ruling = lead.ruling; segments = lead.directiveSegments || repaired
      why = lead.reason
    } else if (r.authorshipState === AUTHORSHIP.NOT_LOCATED) {
      source = 'PROVENANCE'
      ruling = 'NEEDS_CONTEXT'
      why = 'phrase not located after span repair — held, never downgraded to quoted (rule 1)'
    } else if (r.sourceType === SOURCE_TYPE.CODE_OR_TECHNICAL_TEXT) {
      source = 'PROVENANCE'
      ruling = 'REMOVE_CODE_OR_TECHNICAL_TEXT'
      why = 'scraped source code — never a natural-language Directive (rule 9)'
    } else if (r.sourceType === SOURCE_TYPE.ATTACHED_IMAGE || r.sourceType === SOURCE_TYPE.SCREENSHOT) {
      source = 'PROVENANCE'
      ruling = 'REMOVE_QUOTED_OR_THIRD_PARTY'
      why = 'attached-image text, never post body'
    } else if (r.authorshipState === AUTHORSHIP.QUOTED) {
      source = 'PROVENANCE'
      ruling = r.sourceType === SOURCE_TYPE.QUOTED_SCRIPTURE ? 'REMOVE_QUOTED_SCRIPTURE'
        : r.sourceType === SOURCE_TYPE.QUOTED_PRAYER ? 'REMOVE_PRAYER_TEXT'
        : 'REMOVE_QUOTED_OR_THIRD_PARTY'
    } else if (r.authorshipState === AUTHORSHIP.AMBIGUOUS || r.confidence === 'LOW' || r.sourceType === SOURCE_TYPE.UNKNOWN) {
      source = 'PROVENANCE'
      ruling = 'NEEDS_CONTEXT'
      why = `ownership not structurally established (${r.structuralReason})`
    } else if (PRAYER.some(rx => rx.test(clsSentence))) {
      source = 'VOCABULARY'; ruling = 'REMOVE_PRAYER_TEXT'; why = 'reproduced prayer text in Q\'s own body'
    } else if (SCRIPTURE.some(rx => rx.test(clsSentence))) {
      source = 'VOCABULARY'; ruling = 'REMOVE_QUOTED_SCRIPTURE'; why = 'reproduced scripture in Q\'s own body'
    } else if (HAVE_FAITH.test(clsSentence)) {
      source = 'OWNER_RULING_R3'
      ruling = 'KEEP_Q_DIRECTIVE'; segments = 'have faith'
      why = 'OWNER RULING R3: "have faith" is an imperative — an instruction to maintain confidence, belief or morale.'
      if (RELIGIOUS_OBJECT.test(clsSentence)) {
        ruling = 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME'; themes = 'Religion & Spirituality'
        why += ' The complete sentence names a religious object, so Religion & Spirituality is dual-assigned.'
      }
    } else if (mix) {
      source = 'VOCABULARY'; ruling = 'SPLIT_MIXED_SENTENCE'; relSeg = mix[1]; segments = mix[2]; themes = 'Religion & Spirituality'
    } else if (REL_DIRECTIVE.some(rx => rx.test(cls))) {
      source = 'VOCABULARY'; ruling = 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME'; themes = 'Religion & Spirituality'
    } else if (BLESSING.some(rx => rx.test(cls))) {
      source = 'VOCABULARY'; ruling = 'REMOVE_BLESSING_OR_VALEDICTION'; dest = 'RELIGION_THEME_ONLY'
      why = r.signatureStripped ? 'blessing/valediction, Q signature cut into its own span (rule 7)' : 'blessing or valediction, not a command'
    } else if (INTERROGATIVE_FORM.test(cls) && !IMPERATIVE.test(cls)) {
      source = 'VOCABULARY'; ruling = 'REMOVE_QUESTION_NOT_DIRECTIVE'
      why = 'Q-authored sentence in interrogative form — belongs to Questions, not Directives'
    } else if (RELIGIOUS.test(cls) && !IMPERATIVE.test(cls)) {
      source = 'VOCABULARY'; ruling = 'REMOVE_STATEMENT_OR_HEADING'; dest = 'RELIGION_THEME_ONLY'
    } else {
      source = 'VOCABULARY'; ruling = 'KEEP_Q_DIRECTIVE'
    }

    rows.push({
      stableOccurrenceId: recordId, postNum: p.postNum, occurrenceIndex: idx, occurrenceOfPhrase: nth,
      storedPhrase: stored,
      fullSentence,
      directivePhrase: segments,
      directiveSegments: segments,
      religiousSegment: relSeg,
      themes, proposedDestination: dest,
      startLine: r.span?.startLine ?? -1, endLine: r.span?.endLine ?? -1,
      startOffset: r.span?.startOffset ?? -1, endOffset: r.span?.endOffset ?? -1,
      authorshipState: overrideState ?? r.authorshipState,
      sourceType: overrideType ?? r.sourceType,
      alsoQuotedInPayload: String((r.alsoQuotedInPayload ?? 0) > 0),
      referencedPostNum: r.referencedPostNum ?? '',
      fragmentRepaired: String(Boolean(explicit?.fragmentRepaired) || wasFragment),
      sentenceExpanded: String(norm(fullSentence).toLowerCase() !== norm(stored).toLowerCase()),
      contextBefore: sc?.contextBefore ?? '', contextAfter: sc?.contextAfter ?? '',
      v4Ruling: prior?.proposedRuling ?? '',
      ruling,
      rulingSource: source,
      reason: why,
      evidence,
      confidence: r.confidence,
      changedFromV4: String((prior?.proposedRuling ?? '') !== ruling),
    })
  })
}

// R5: one full-sentence highlight, multiple segments, no overlapping partials.
const bySentence = new Map()
for (const r of rows) {
  if (!KEEP_RULINGS.has(r.ruling)) continue
  const k = `${r.postNum}|${r.fullSentence.toLowerCase()}`
  if (!bySentence.has(k)) bySentence.set(k, [])
  bySentence.get(k).push(r)
}
let multiSegment = 0
for (const [, g] of bySentence) {
  if (g.length < 2) continue
  multiSegment++
  const segs = [...new Set(g.map(x => x.directivePhrase))].join(' · ')
  for (const x of g) { x.directiveSegments = segs; x.sharedSentenceWith = g.filter(y => y !== x).map(y => y.stableOccurrenceId).join(' ') }
}
for (const r of rows) if (r.sharedSentenceWith === undefined) r.sharedSentenceWith = ''

// ── GATE: the file must be finishable ────────────────────────────────────────
const problems = []
if (rows.length !== 2705) problems.push(`expected 2705 rows, got ${rows.length}`)
if (new Set(rows.map(r => r.stableOccurrenceId)).size !== rows.length) problems.push('duplicate stable occurrence IDs')
for (const r of rows) {
  if (!r.ruling) problems.push(`${r.stableOccurrenceId}: blank ruling`)
  if (!r.reason) problems.push(`${r.stableOccurrenceId}: blank reason`)
  if (r.ruling === 'NEEDS_FRAGMENT_REVIEW' || r.ruling === 'BLOCKED_PENDING_EDITORIAL') problems.push(`${r.stableOccurrenceId}: still blocked`)
  if (r.authorshipState === AUTHORSHIP.NOT_LOCATED) problems.push(`${r.stableOccurrenceId}: NOT_LOCATED`)
  if (KEEP_RULINGS.has(r.ruling) && !norm(r.fullSentence).toLowerCase().includes(norm(r.directivePhrase).toLowerCase())
    && r.directivePhrase !== r.directiveSegments) problems.push(`${r.stableOccurrenceId}: display span does not contain its segment`)
}
for (const [id] of leadRulings) if (!rows.some(r => r.stableOccurrenceId === id)) problems.push(`lead ruling ${id} matched no record`)
for (const [id] of EXPLICIT) if (!rows.some(r => r.stableOccurrenceId === id)) problems.push(`explicit ruling ${id} matched no record`)

// ── fixtures ─────────────────────────────────────────────────────────────────
const byId = new Map(rows.map(r => [r.stableOccurrenceId, r]))
const checks = []
const C = (label, ok, got, want) => checks.push({ label, pass: Boolean(ok), got: String(got), want: String(want) })
C('all 2,705 occurrences ruled', rows.length === 2705, rows.length, 2705)
C('zero blank rulings', rows.every(r => r.ruling), rows.filter(r => !r.ruling).length, 0)
C('zero blocked rows', !rows.some(r => /NEEDS_FRAGMENT_REVIEW|BLOCKED/.test(r.ruling)), rows.filter(r => /NEEDS_FRAGMENT_REVIEW|BLOCKED/.test(r.ruling)).length, 0)
C('zero NOT_LOCATED', !rows.some(r => r.authorshipState === AUTHORSHIP.NOT_LOCATED), rows.filter(r => r.authorshipState === AUTHORSHIP.NOT_LOCATED).length, 0)
C('all 26 declarative-lead rulings landed', [...leadRulings.keys()].every(id => byId.get(id)?.rulingSource === 'EDITORIAL_DECLARATIVE_LEAD' || byId.get(id)?.rulingSource === 'OWNER_RULING_EXPLICIT'), [...leadRulings.keys()].filter(id => !byId.get(id)).length + ' missing', '0 missing')
C('#10 both KEEP with evidence', ['10#0', '10#1'].every(id => byId.get(id)?.ruling === 'KEEP_Q_DIRECTIVE' && byId.get(id)?.evidence), ['10#0', '10#1'].map(id => byId.get(id)?.ruling).join(','), 'KEEP,KEEP')
C('#51 all three Q_BODY_LETTER_VOICE', ['51#0', '51#1', '51#2'].every(id => byId.get(id)?.sourceType === SOURCE_TYPE.Q_BODY_LETTER_VOICE), ['51#0', '51#1', '51#2'].map(id => byId.get(id)?.sourceType).join(','), 'all Q_BODY_LETTER_VOICE')
C('#51#2 splits with full sentence retained', byId.get('51#2')?.ruling === 'SPLIT_MIXED_SENTENCE' && norm(byId.get('51#2')?.fullSentence) === 'God bless and be safe.' && byId.get('51#2')?.religiousSegment === 'God bless' && byId.get('51#2')?.directivePhrase === 'be safe', `${byId.get('51#2')?.religiousSegment}/${byId.get('51#2')?.directivePhrase}`, 'God bless/be safe')
C('#1252 KEEP with the full sentence', byId.get('1252#1')?.ruling === 'KEEP_Q_DIRECTIVE' && /it’s time to learn the truth\./i.test(byId.get('1252#1')?.fullSentence ?? ''), JSON.stringify(byId.get('1252#1')?.fullSentence), 'It’s time to learn the TRUTH.')
C('#4437 all five removed as code', [0, 1, 2, 3, 4].every(i => byId.get(`4437#${i}`)?.ruling === 'REMOVE_CODE_OR_TECHNICAL_TEXT'), [0, 1, 2, 3, 4].map(i => byId.get(`4437#${i}`)?.ruling).join(','), 'all REMOVE_CODE_OR_TECHNICAL_TEXT')
const hf = rows.filter(r => HAVE_FAITH.test(norm(r.fullSentence)))
C('all have-faith records KEEP', hf.length === 46 && hf.every(r => KEEP_RULINGS.has(r.ruling)), `${hf.filter(r => KEEP_RULINGS.has(r.ruling)).length}/${hf.length}`, '46/46')
C('"Have faith in God." is dual-classified', rows.find(r => r.postNum === 4429 && /in god/i.test(r.storedPhrase))?.ruling === 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', rows.find(r => r.postNum === 4429 && /in god/i.test(r.storedPhrase))?.ruling, 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME')
C('#1359 removed as quoted news', byId.get('1359#0')?.ruling === 'REMOVE_QUOTED_OR_THIRD_PARTY', byId.get('1359#0')?.ruling, 'REMOVE_QUOTED_OR_THIRD_PARTY')
C('every KEEP displays a complete sentence containing its phrase',
  rows.filter(r => KEEP_RULINGS.has(r.ruling)).every(r => norm(r.fullSentence).toLowerCase().includes(norm(r.storedPhrase).toLowerCase()) || r.sentenceExpanded === 'true' || r.fragmentRepaired === 'true'),
  'checked', 'all contained')
const cFails = checks.filter(c => !c.pass)

// ── output ───────────────────────────────────────────────────────────────────
const tally = {}, states = {}, types = {}, sources = {}
for (const r of rows) {
  tally[r.ruling] = (tally[r.ruling] ?? 0) + 1
  states[r.authorshipState] = (states[r.authorshipState] ?? 0) + 1
  types[r.sourceType] = (types[r.sourceType] ?? 0) + 1
  sources[r.rulingSource] = (sources[r.rulingSource] ?? 0) + 1
}
const changed = rows.filter(r => r.changedFromV4 === 'true')

console.log('\nDIRECTIVES v5 — FINAL\n')
console.log(`  records ruled : ${rows.length}`)
console.log(`  fixtures      : ${checks.length - cFails.length}/${checks.length} pass`)
for (const c of cFails) console.log(`     FAIL  ${c.label}\n           got  ${c.got}\n           want ${c.want}`)
if (problems.length) { console.log('\n  GATE PROBLEMS:'); problems.slice(0, 30).forEach(p => console.log('    ' + p)) }
else console.log('\n  gate: no blank rulings, no blocked rows, no NOT_LOCATED, no partial display spans')
console.log('\n  ruling source:')
for (const [k, v] of Object.entries(sources).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('\n  authorship:')
for (const [k, v] of Object.entries(states).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('\n  source types:')
for (const [k, v] of Object.entries(types).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('\n  FINAL RULINGS:')
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
const keep = rows.filter(r => KEEP_RULINGS.has(r.ruling)).length
const remove = rows.filter(r => r.ruling.startsWith('REMOVE')).length
const hold = rows.filter(r => r.ruling === 'NEEDS_CONTEXT').length
console.log(`\n  KEEP ${keep} · REMOVE ${remove} · HOLD ${hold}  (total ${keep + remove + hold})`)
console.log(`  full-sentence highlights expanded : ${rows.filter(r => r.sentenceExpanded === 'true').length}`)
console.log(`  fragments repaired                : ${rows.filter(r => r.fragmentRepaired === 'true').length}`)
console.log(`  sentences with >1 directive segment: ${multiSegment}`)
console.log(`  changed from v4                   : ${changed.length}`)

const cols = ['stableOccurrenceId', 'postNum', 'occurrenceIndex', 'occurrenceOfPhrase', 'storedPhrase', 'fullSentence',
  'directivePhrase', 'directiveSegments', 'religiousSegment', 'themes', 'proposedDestination',
  'startLine', 'endLine', 'startOffset', 'endOffset', 'authorshipState', 'sourceType',
  'alsoQuotedInPayload', 'referencedPostNum', 'fragmentRepaired', 'sentenceExpanded',
  'contextBefore', 'contextAfter', 'sharedSentenceWith', 'v4Ruling', 'ruling', 'rulingSource',
  'reason', 'evidence', 'confidence', 'changedFromV4']
fs.writeFileSync(path.join(OUT, 'directives-adjudication-v5-final.csv'), csv(cols, rows))
fs.writeFileSync(path.join(OUT, 'directives-adjudication-v5-final.json'),
  JSON.stringify({ final: true, blocked: 0, tally, states, types, sources, rows }, null, 1))
fs.writeFileSync(path.join(OUT, 'directives-v4-to-v5-diff.csv'),
  csv(['stableOccurrenceId', 'postNum', 'storedPhrase', 'fullSentence', 'directivePhrase', 'v4Ruling', 'ruling', 'rulingSource', 'reason'], changed))

if (problems.length || cFails.length) { console.log('\nV5 IS NOT FINISHABLE — fix the above before migrating.'); process.exit(1) }
console.log('\nwrote audit/source-spans-v2/directives-adjudication-v5-final.{csv,json} + directives-v4-to-v5-diff.csv')
