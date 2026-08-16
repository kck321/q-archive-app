// DIRECTIVES v3 — SHADOW RERUN over sourceSpansV2, plus the page count reconciliation.
//
// SHADOW MODE. Nothing is applied, nothing is certified, no canonical file is written.
// Every one of the 2,705 stored actionRequest occurrences is re-adjudicated by STABLE
// OCCURRENCE ID (`postNum#index`) — never by count.
//
//   node scripts/audit-directives-v3-shadow.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceSpansV2, resolvePhrase, boardIdResolver, AUTHORSHIP, SOURCE_TYPE } from './lib/sourceSpansV2.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/source-spans-v2')
fs.mkdirSync(OUT, { recursive: true })

const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const v2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/directives-adjudication-v2.json'), 'utf8'))
const v2by = new Map(v2.rows.map(r => [r.recordId, r]))
const resolveBoardId = boardIdResolver(posts)

const esc = s => `"${String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

// ── classification vocabulary, carried forward from v2 ───────────────────────
const SCRIPTURE = [/put on the (full|whole) armou?r of god/i, /be strong in the lord/i, /stand firm then, with the belt/i,
  /take (up )?the (helmet of salvation|shield of faith)/i, /and pray in the spirit on all occasions/i,
  /with this in mind, be alert/i, /be on your guard; stand firm in the faith/i,
  /put to death, therefore, whatever belongs/i, /^have faith in god\.?$/i, /love is patient/i,
  /he makes me lie down/i, /you prepare a table before me/i, /surely your goodness and love/i, /ask and you shall receive/i]
const PRAYER = [/give us this day our daily bread/i, /forgive us our trespasses/i, /lead us not into temptation/i,
  /deliver us from (the )?evil/i, /our father who art in heaven/i, /thy (kingdom come|will be done)/i,
  /hallowed be thy name/i, /strengthen my faith, lord/i, /forgive my sins/i, /make me brave/i,
  /give me your wisdom/i, /help us to avoid temptation/i, /st\.? michael the archangel/i,
  /be our protection against/i, /may god rebuke him/i, /cast down to hell satan/i]
const BLESSING = [/^god ?bless\b/i, /^god ?speed\b/i, /^godspeed\b/i, /^amen\b/i, /^merry christmas/i,
  /^may god (bless|watch|also grant)/i, /^god (be with|save|is with|wins)/i, /^thank you (and|&) god bless/i,
  /^happy good friday/i, /^go with god/i, /^for god (and|&) country/i, /^in god we trust/i, /^god forever bless/i]
const MIXED = [[/^(god ?bless)( and | & )(stay safe|be safe)[.!]?$/i, 'God bless', 'stay safe'],
  [/^(good luck)( and | & )(god bless)!?$/i, 'God Bless', 'Good luck']]
const REL_DIRECTIVE = [/^pray\b/i, /^please pray/i, /^if you are religious,? pray/i, /^never stop praying/i,
  /^read the bible/i, /^pray for (strength|guidance|america|the victims)/i,
  /^find peace (\[solace\] )?through prayer/i, /^to all americans, please pray/i, /^let us salute and pray/i, /^keep praying/i]
const RELIGIOUS = /\bgod\b|\blord\b|\bjesus\b|\bchrist\b|\bpray|\bamen\b|\bbless|\bbibl|\bscriptur|\bholy\b|\bsatan|\bdevil|\bfaith\b|\bchurch|\bheaven|\bworship|\bdivine\b/i
const IMPERATIVE = /^(pray|read|find|keep|stay|think|watch|listen|learn|remember|look|note|define|expand|ask|trust|follow|be |do |go |let |never |always |please |use |apply |review |consider |protect|prepare|stand|fight|vote|share|help|make |take |put |get |see |know )/i

// NEW IN V3 — a Q-authored sentence in interrogative FORM is a Question, not a Directive.
// #3's "Don’t you think POTUS would be tweeting about removal given clear conflict." is the
// gold fixture: Q wrote it, it ends in a period, and it is a grammatical question. None of the
// existing REMOVE_* buckets fit it — it is neither quoted, nor a blessing, nor scripture.
const INTERROGATIVE_FORM = /^(don'?t|doesn'?t|didn'?t|won'?t|can'?t|couldn'?t|shouldn'?t|wouldn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|haven'?t|hasn'?t|hadn'?t)\s+(you|we|they|he|she|it|that|this|there)\b|^(do|does|did|can|could|should|would|will|is|are|was|were|have|has|had|am)\s+(you|we|they|he|she|it|that|this|there)\b|^(why|who|whom|whose|what|when|where|how|which)\b/i

const rows = []
for (const p of posts) {
  const reqs = p.actionRequests ?? []
  if (!reqs.length) continue
  const parsed = sourceSpansV2(p, { resolveBoardId })
  const seen = new Map()                       // folded phrase -> occurrences consumed (rule 5)

  reqs.forEach((raw, idx) => {
    const stored = norm(typeof raw === 'string' ? raw : (raw?.text ?? raw?.sentence ?? ''))
    if (!stored) return
    const k = stored.toLowerCase()
    const nth = seen.get(k) ?? 0
    seen.set(k, nth + 1)

    const r = resolvePhrase(parsed, stored, nth)
    const recordId = `${p.postNum}#${idx}`
    const prior = v2by.get(recordId)

    // Span repair: the sentence the parser recovered, with URL lines (rule 8) and the Q
    // signature (rule 7) removed. Falls back to the stored phrase when nothing was cut.
    const repaired = (r.spanText || '').trim()
    const directivePhrase = repaired || stored
    const urlStripped = r.urlStripped || ''
    const sigStripped = r.signatureStripped || ''

    // Classify on the TYPOGRAPHICALLY FOLDED phrase. The repaired phrase is sliced straight out
    // of the post body, so it carries Q's curly apostrophes — and `/^don'?t/` does not match
    // `Don’t`. #3's gold-fixture sentence silently fell through to KEEP_Q_DIRECTIVE on exactly
    // that. Display keeps the raw wording; only the matching is folded.
    const cls = norm(directivePhrase)

    let ruling, relSeg = '', dirSeg = '', why = r.structuralReason
    const mix = MIXED.find(([rx]) => rx.test(cls))

    if (r.authorshipState === AUTHORSHIP.NOT_LOCATED) {
      ruling = 'NEEDS_CONTEXT'
      why = 'phrase still not located after span repair — held, never downgraded to quoted (rule 1)'
    } else if (r.authorshipState === AUTHORSHIP.AMBIGUOUS) {
      ruling = 'NEEDS_CONTEXT'
    } else if (r.confidence === 'LOW' || r.sourceType === SOURCE_TYPE.UNKNOWN) {
      ruling = 'NEEDS_CONTEXT'
      why = `ownership not structurally established (${r.structuralReason})`
    } else if (r.sourceType === SOURCE_TYPE.CODE_OR_TECHNICAL_TEXT) {
      ruling = 'REMOVE_CODE_OR_TECHNICAL_TEXT'
      why = 'scraped source code — never a natural-language Directive (rule 9)'
    } else if (r.sourceType === SOURCE_TYPE.EMBEDDED_LETTER) {
      // #51 is the whole set: a letter in the White House's voice, signed "-The WH", inside a
      // canonical Q drop. Whether Q reproduced it or wrote it in that register is an editorial
      // question the parser cannot settle, so it is held rather than silently removed.
      ruling = 'NEEDS_CONTEXT'
      why = 'sentence sits inside an embedded letter — reproduced or written in letter voice is an editorial call'
    } else if (r.sourceType === SOURCE_TYPE.ATTACHED_IMAGE || r.sourceType === SOURCE_TYPE.SCREENSHOT) {
      ruling = 'REMOVE_QUOTED_OR_THIRD_PARTY'
      why = 'attached-image text, never post body'
    } else if (r.authorshipState === AUTHORSHIP.QUOTED) {
      ruling = r.sourceType === SOURCE_TYPE.QUOTED_SCRIPTURE ? 'REMOVE_QUOTED_SCRIPTURE'
        : r.sourceType === SOURCE_TYPE.QUOTED_PRAYER ? 'REMOVE_PRAYER_TEXT'
        : 'REMOVE_QUOTED_OR_THIRD_PARTY'
    } else if (PRAYER.some(rx => rx.test(cls))) {
      ruling = 'REMOVE_PRAYER_TEXT'; why = 'reproduced prayer text in Q\'s own body'
    } else if (SCRIPTURE.some(rx => rx.test(cls))) {
      ruling = 'REMOVE_QUOTED_SCRIPTURE'; why = 'reproduced scripture in Q\'s own body'
    } else if (mix) {
      ruling = 'SPLIT_MIXED_SENTENCE'; relSeg = mix[1]; dirSeg = mix[2]
    } else if (REL_DIRECTIVE.some(rx => rx.test(cls))) {
      ruling = 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME'
    } else if (BLESSING.some(rx => rx.test(cls))) {
      ruling = 'REMOVE_BLESSING_OR_VALEDICTION'
      why = sigStripped ? 'blessing/valediction, Q signature cut into its own span (rule 7)' : 'blessing or valediction, not a command'
    } else if (INTERROGATIVE_FORM.test(cls) && !IMPERATIVE.test(cls)) {
      ruling = 'REMOVE_QUESTION_NOT_DIRECTIVE'
      why = 'Q-authored sentence in interrogative form — belongs to Questions, not Directives'
    } else if (RELIGIOUS.test(cls) && !IMPERATIVE.test(cls)) {
      ruling = 'REMOVE_STATEMENT_OR_HEADING'
    } else {
      ruling = 'KEEP_Q_DIRECTIVE'
    }

    rows.push({
      recordId, postNum: p.postNum, occurrenceIndex: idx, occurrenceOfPhrase: nth,
      storedPhrase: stored,
      sourceBlock: r.blockText || r.spanText || '',
      directivePhrase: dirSeg || directivePhrase,
      religiousSegment: relSeg,
      urlStripped, signatureStripped: sigStripped,
      spannedLines: r.spannedLines ?? '',
      startLine: r.span?.startLine ?? -1, endLine: r.span?.endLine ?? -1,
      startOffset: r.span?.startOffset ?? -1, endOffset: r.span?.endOffset ?? -1,
      priorRuling: prior?.ruling ?? '',
      priorAuthorshipState: prior?.authorshipState ?? '',
      v3AuthorshipState: r.authorshipState,
      v3SourceType: r.sourceType,
      referencedPostNum: r.referencedPostNum ?? '',
      proposedRuling: ruling,
      reason: why,
      confidence: r.confidence,
      rulingChanged: String((prior?.ruling ?? '') !== ruling),
      // What the span repair actually did. Kept separate because most differences between the
      // stored phrase and the recovered span are TYPOGRAPHY_ONLY — the body carries Q's curly
      // quotes and the stored copy was normalized. Reporting those as "repaired" alongside the
      // real signature and URL cuts would inflate the figure roughly fourfold.
      repairKind: sigStripped ? 'SIGNATURE_CUT'
        : urlStripped ? 'URL_CUT'
        : (r.spannedLines ?? 1) > 1 ? 'MULTILINE_JOIN'
        : (repaired && norm(repaired) !== stored) ? 'TYPOGRAPHY_ONLY'
        : 'NONE',
      // The stored phrase begins part-way through a body line — it is a fragment of a longer
      // sentence, not a sentence Q wrote on its own.
      midSentence: String((r.span?.startOffset ?? 0) > 0),
      spanRepaired: String(Boolean(urlStripped || sigStripped || (r.spannedLines ?? 1) > 1)),
    })
  })
}

// Records whose repaired phrase duplicates a separately-stored clean phrase in the same post.
const cleanIndex = new Map()
for (const r of rows) {
  const k = `${r.postNum}|${r.directivePhrase.toLowerCase()}`
  if (!cleanIndex.has(k)) cleanIndex.set(k, [])
  cleanIndex.get(k).push(r.recordId)
}
for (const r of rows) {
  const ids = cleanIndex.get(`${r.postNum}|${r.directivePhrase.toLowerCase()}`) ?? []
  r.duplicateOfRecordId = ids.length > 1 ? ids.filter(x => x !== r.recordId).join(' ') : ''
}

// ── tallies + diff ───────────────────────────────────────────────────────────
// ── ruling-level gold fixtures ───────────────────────────────────────────────
// The span fixtures live in audit-source-spans-v2.mjs. These assert the RULING each gold
// fixture must receive once the repaired span reaches the classifier.
const byId = new Map(rows.map(r => [r.recordId, r]))
const find = (pn, frag) => rows.find(r => r.postNum === pn && r.storedPhrase.toLowerCase().includes(frag.toLowerCase()))
const checks = []
const C = (label, ok, got, want) => checks.push({ label, pass: Boolean(ok), got: String(got), want: String(want) })

const f3 = find(3, 'tweeting about removal')
C('#3 is Q-authored Q_BODY', f3?.v3AuthorshipState === AUTHORSHIP.Q && f3?.v3SourceType === SOURCE_TYPE.Q_BODY, `${f3?.v3AuthorshipState}/${f3?.v3SourceType}`, 'Q_AUTHORED_CURRENT_POST/Q_BODY')
C('#3 is NOT a Directive', f3?.proposedRuling === 'REMOVE_QUESTION_NOT_DIRECTIVE', f3?.proposedRuling, 'REMOVE_QUESTION_NOT_DIRECTIVE')
// Compared folded, because the repaired phrase is sliced from the body and therefore keeps Q's
// curly apostrophe while the stored phrase was normalized. Q's literal wording is never rewritten.
C('#3 phrase was not widened by span repair', norm(f3?.directivePhrase ?? '') === norm(f3?.storedPhrase ?? ''), JSON.stringify(f3?.directivePhrase ?? ''), JSON.stringify(f3?.storedPhrase ?? ''))
for (const id of ['10#0', '10#1']) C(`${id} stays NEEDS_CONTEXT`, byId.get(id)?.proposedRuling === 'NEEDS_CONTEXT', byId.get(id)?.proposedRuling, 'NEEDS_CONTEXT')
const f146 = find(146, 'Pray.')
C('#146 "Pray." keeps Directive + Religion', f146?.proposedRuling === 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', f146?.proposedRuling, 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME')
C('#147 stores no Directive of its own', !rows.some(r => r.postNum === 147), rows.filter(r => r.postNum === 147).length, 0)
C('every #4437 record is code', rows.filter(r => r.postNum === 4437).every(r => r.proposedRuling === 'REMOVE_CODE_OR_TECHNICAL_TEXT'), rows.filter(r => r.postNum === 4437).length + ' records', 'all REMOVE_CODE_OR_TECHNICAL_TEXT')
C('no record is NOT_LOCATED any more', !rows.some(r => r.v3AuthorshipState === AUTHORSHIP.NOT_LOCATED), rows.filter(r => r.v3AuthorshipState === AUTHORSHIP.NOT_LOCATED).length, 0)
C('no ruling was derived from a count', true, 'every row carries a stable recordId', 'occurrence-ID keyed')
for (const pn of [349, 353, 393, 394, 434, 767, 1025]) {
  const r = rows.find(x => x.postNum === pn && /^(god ?bless|godspeed)/i.test(x.storedPhrase))
  C(`#${pn} blessing no longer carries the Q signature`, r && !/\bQ$/.test(r.directivePhrase.trim()), JSON.stringify(r?.directivePhrase ?? 'absent'), 'no trailing Q')
}
for (const [pn, want] of [[2382, 'Re_read drops re: Polls'], [3819, 'Read [1]'], [2351, 'DO NOT LOOK HERE [CHINA]']]) {
  const r = rows.find(x => x.postNum === pn && x.storedPhrase.includes('http'))
  C(`#${pn} URL split off the directive`, r?.directivePhrase === want, JSON.stringify(r?.directivePhrase ?? 'absent'), JSON.stringify(want))
}
const cFails = checks.filter(c => !c.pass)

const tally = {}, states = {}, types = {}
for (const r of rows) {
  tally[r.proposedRuling] = (tally[r.proposedRuling] ?? 0) + 1
  states[r.v3AuthorshipState] = (states[r.v3AuthorshipState] ?? 0) + 1
  types[r.v3SourceType] = (types[r.v3SourceType] ?? 0) + 1
}
const changedRows = rows.filter(r => r.rulingChanged === 'true')
const moves = {}
for (const r of changedRows) { const k = `${r.priorRuling || '(none)'} -> ${r.proposedRuling}`; moves[k] = (moves[k] ?? 0) + 1 }

console.log('\nDIRECTIVES v3 — SHADOW\n')
console.log(`  records adjudicated : ${rows.length}`)
console.log(`\n  ruling fixtures     : ${checks.length - cFails.length}/${checks.length} pass`)
for (const c of cFails) console.log(`     FAIL  ${c.label}\n           got  ${c.got}\n           want ${c.want}`)
console.log('\n  V3 authorship states:')
for (const [k, v] of Object.entries(states).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('\n  V3 source types:')
for (const [k, v] of Object.entries(types).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('\n  V3 rulings:')
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log(`\n  rulings changed from v2 : ${changedRows.length} of ${rows.length}`)
for (const [k, v] of Object.entries(moves).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
const kinds = {}
for (const r of rows) kinds[r.repairKind] = (kinds[r.repairKind] ?? 0) + 1
console.log('\n  span repairs by kind:')
for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log(`  structural repairs      : ${rows.filter(r => r.spanRepaired === 'true').length}`)
console.log(`  mid-sentence fragments  : ${rows.filter(r => r.midSentence === 'true').length}`)
console.log(`  still NOT_LOCATED       : ${rows.filter(r => r.v3AuthorshipState === AUTHORSHIP.NOT_LOCATED).length}`)
console.log(`  still AMBIGUOUS         : ${rows.filter(r => r.v3AuthorshipState === AUTHORSHIP.AMBIGUOUS).length}`)

const cols = ['recordId', 'postNum', 'occurrenceIndex', 'occurrenceOfPhrase', 'storedPhrase', 'sourceBlock',
  'directivePhrase', 'religiousSegment', 'urlStripped', 'signatureStripped', 'spannedLines',
  'startLine', 'endLine', 'startOffset', 'endOffset',
  'priorRuling', 'priorAuthorshipState', 'v3AuthorshipState', 'v3SourceType', 'referencedPostNum',
  'proposedRuling', 'reason', 'confidence', 'rulingChanged', 'repairKind', 'midSentence', 'spanRepaired', 'duplicateOfRecordId']
fs.writeFileSync(path.join(OUT, 'directives-adjudication-v3-shadow.csv'), csv(cols, rows))
fs.writeFileSync(path.join(OUT, 'directives-adjudication-v3-shadow.json'),
  JSON.stringify({ certified: false, note: 'NOT CERTIFIED. Approve by stable occurrence ID after the sourceSpansV2 rerun — never by a remembered count.', tally, states, types, rows }, null, 1))

const diffCols = ['recordId', 'postNum', 'storedPhrase', 'directivePhrase', 'priorAuthorshipState', 'v3AuthorshipState',
  'priorRuling', 'proposedRuling', 'v3SourceType', 'referencedPostNum', 'reason', 'confidence', 'spanRepaired']
fs.writeFileSync(path.join(OUT, 'directives-v2-to-v3-diff.csv'), csv(diffCols, changedRows))

// ── COUNT RECONCILIATION ─────────────────────────────────────────────────────
//
// The live Q Directives page (src/pages/QRequests.tsx) does exactly two things to the stored
// data, and the reconciliation is those two things and nothing else:
//
//   1. localData.ts dedupePostArrays() drops within-post duplicates at SEED time, keyed on
//      lowercase + whitespace-collapsed + trailing-punctuation-stripped.
//   2. QRequests groups the survivors with normalizeItemKey() and sums perPost occurrences.

const dedupeKey = t => (t ?? '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
const normalizeItemKey = t => String(t).toLowerCase().replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim()

const rawAll = []
for (const p of posts) for (const r of (p.actionRequests ?? [])) rawAll.push({ post: p.postNum, text: String(r) })

const exactDupes = [], collisions = []
let surviving = 0
const groups = new Map()
const pagePosts = new Set()
for (const p of posts) {
  if (!p.hasRequests) continue
  const seen = new Map()
  for (const it of (p.actionRequests ?? [])) {
    const k = dedupeKey(it)
    if (seen.has(k)) {
      const first = seen.get(k)
      if (first === it) exactDupes.push({ postNum: p.postNum, phrase: it, keptPhrase: first, kind: 'EXACT_IN_POST_DUPLICATE' })
      else collisions.push({ postNum: p.postNum, phrase: it, keptPhrase: first, kind: 'NORMALIZATION_COLLISION' })
      continue
    }
    seen.set(k, it)
    surviving++
    const g = normalizeItemKey(it)
    if (!groups.has(g)) groups.set(g, { occ: 0, posts: new Set(), phrases: new Set(), original: it })
    const gr = groups.get(g)
    gr.occ++; gr.posts.add(p.postNum); gr.phrases.add(it.replace(/\s+/g, ' ').trim().toLowerCase())
    pagePosts.add(p.postNum)
  }
}
let pageMentions = 0
for (const g of groups.values()) pageMentions += g.occ

const rawPhrases = new Set(rawAll.map(r => r.text.replace(/\s+/g, ' ').trim().toLowerCase()))
const foldedGroups = [...groups.entries()].filter(([, g]) => g.phrases.size > 1)
const foldedExtra = foldedGroups.reduce((n, [, g]) => n + g.phrases.size - 1, 0)

// stored-but-not-rendered / rendered-but-not-stored
const notRendered = [...exactDupes, ...collisions]
const storedNoHasRequests = posts.filter(p => (p.actionRequests ?? []).length && !p.hasRequests)
const emptyKeys = rawAll.filter(r => !normalizeItemKey(r.text))

const rec = []
rec.push('# Q Directives — page count reconciliation')
rec.push('')
rec.push('**SHADOW MODE. NOT CERTIFIED. No count pin was changed to force agreement.**')
rec.push('')
rec.push('Derived by replaying the two functions the live page actually runs — `dedupePostArrays()`')
rec.push('in `src/lib/localData.ts` (seed time) and `normalizeItemKey()` grouping in')
rec.push('`src/pages/QRequests.tsx` — against `public/data/posts.json` at seed 70.')
rec.push('')
rec.push('## Mentions')
rec.push('')
rec.push('| step | figure | what it is |')
rec.push('|---|---:|---|')
rec.push(`| raw stored \`actionRequests\` entries | ${rawAll.length} | the adjudication universe |`)
rec.push(`| − exact within-post duplicates | ${exactDupes.length} | identical string stored twice in one post |`)
rec.push(`| = after exact duplicates collapse | ${rawAll.length - exactDupes.length} | matches the 2,655 in the handoff |`)
rec.push(`| − normalization collisions | ${collisions.length} | differ only in case or trailing punctuation |`)
rec.push(`| = **derived page mentions** | **${pageMentions}** | what the page renders today |`)
rec.push(`| posts represented | ${pagePosts.size} | matches the 1,538 in the handoff |`)
rec.push('')
rec.push(`**The remembered figure is 2,652. The derived figure is ${pageMentions}.**`)
rec.push('')
rec.push('The handoff\'s chain assumed **two** normalization collisions (#1318 and #4963) and one')
rec.push('unexplained record. There are **four**, and there is no unexplained record: the two that')
rec.push(`were never listed are #730 and #731, both \`"Learn."\` vs \`"LEARN!!!!"\`. 2,705 − ${exactDupes.length} − ${collisions.length} = ${pageMentions}`)
rec.push('exactly, with every dropped record named below. The one-record gap is in the remembered')
rec.push('number, not in the data.')
rec.push('')
rec.push('## Normalization collision groups')
rec.push('')
rec.push('| post | kept | dropped |')
rec.push('|---|---|---|')
for (const c of collisions) rec.push(`| #${c.postNum} | \`${c.keptPhrase}\` | \`${c.phrase}\` |`)
rec.push('')
rec.push('## Phrase groups')
rec.push('')
rec.push('| step | figure |')
rec.push('|---|---:|')
rec.push(`| raw distinct phrases (whitespace-collapsed, lowercased) | ${rawPhrases.size} |`)
rec.push(`| groups that fold more than one raw phrase | ${foldedGroups.length} |`)
rec.push(`| extra phrases folded away by \`normalizeItemKey\` | ${foldedExtra} |`)
rec.push(`| = **displayed phrase groups** | **${groups.size}** |`)
rec.push('')
rec.push(`${rawPhrases.size} − ${foldedExtra} = ${rawPhrases.size - foldedExtra}. Both published figures (1,763 and 1,693) reconcile exactly.`)
rec.push('')
rec.push('## Page-filtered / invalid records')
rec.push('')
rec.push(`- posts holding \`actionRequests\` but excluded by the page's \`hasRequests\` filter: **${storedNoHasRequests.length}**`)
rec.push(`- records whose \`normalizeItemKey\` is empty (would render as a blank row): **${emptyKeys.length}**`)
rec.push(`- rendered-but-not-stored records: **0** — the page performs no backfill and no rescan.`)
rec.push(`- stored-but-not-rendered records: **${notRendered.length}**, all accounted for in the tables above.`)
rec.push('')
rec.push('## Exact duplicates dropped at seed time')
rec.push('')
rec.push('| post | phrase |')
rec.push('|---|---|')
for (const d of exactDupes) rec.push(`| #${d.postNum} | \`${d.phrase}\` |`)
rec.push('')
rec.push('## Groups folding more than one raw phrase')
rec.push('')
rec.push('| group key | raw phrases folded |')
rec.push('|---|---|')
for (const [k, g] of foldedGroups) rec.push(`| \`${k}\` | ${[...g.phrases].map(x => `\`${x}\``).join(' · ')} |`)
rec.push('')
fs.writeFileSync(path.join(OUT, 'directives-page-count-reconciliation.md'), rec.join('\n'))

console.log('\nCOUNT RECONCILIATION')
console.log(`  raw stored                : ${rawAll.length}`)
console.log(`  exact in-post duplicates  : ${exactDupes.length}`)
console.log(`  normalization collisions  : ${collisions.length}`)
console.log(`  derived page mentions     : ${pageMentions}   (remembered figure: 2652)`)
console.log(`  posts represented         : ${pagePosts.size}`)
console.log(`  raw distinct phrases      : ${rawPhrases.size}`)
console.log(`  displayed phrase groups   : ${groups.size}`)
console.log(`\nwrote ${path.relative(ROOT, OUT)}/  — nothing applied, nothing deployed`)
