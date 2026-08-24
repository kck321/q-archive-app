// EVERY ROW OF THE UPDATED REPORT, RE-READ AGAINST THE CERTIFIED STATE.
//
//   -> audit/report-updated-sweep.json
//   node scripts/audit-report-updated-sweep.mjs
//
// OWNER RULING 2026-08-24, on Q_Unhighlighted FINAL 2 - REPORT (UPDATED).xlsx, sheet by sheet:
//
//   2  "make sure the column for The span that was already certified is highlighted the colour
//      category it is listed under the Section it is place in and the post number it is refering to"
//   3  "take the Text section and make it highlighted the category it is listed under the What it
//      is now section and make sure it is for the correct post that is listed"
//   4  "for the url issues i think you have already fixed these problems. as for the other
//      categories please [make sure] your text section is highlighted the sheet category for that
//      post number"
//   5  "make sure you take the Text and make sure it is highlighted as the category in the sheet
//      cell for the post number it pertains too"
//   8, 9, 10  "take the theme layer off all these items as well"
//
// ONE QUESTION, ASKED OF EVERY ROW: is this exact span certified, on this exact drop, in the
// section this row names?
//
// READ FROM THE ARTIFACTS, NOT THE WORKBOOK. The workbook is generated from them by
// build-review2-report.mjs, and this repo has no spreadsheet dependency to read one back. Reading
// the artifacts is also the stronger check: each row is verified against the record the report was
// written from, so a defect cannot hide in the conversion.
//
// AND AGAINST THE CERTIFIED ARTIFACTS, NEVER THE PAINTED DOM. An Entity or a Bracket painted on
// top of a Claim HIDES the Claim from anything that reads the page, so a crawler would report the
// Claim missing and a re-ruling would double it. Same rule audit-review2-followups.mjs records,
// and the whole reason sheet 2 exists at all.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// THE STRING THE BROWSER RENDERS, not the string posts.json stores. 1,448 drops store every scheme
// as "https:<em>//</em>host" and 575 store "&gt;", "&amp;", "&lt;" raw; localData.ts strips all of
// that at load. Reading the stored text made this sweep report 1,700 bracket rows as missing when
// every one of them is on screen — the identical mistake the first URL pass made twice.
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const aud = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', f), 'utf8'))
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8')

const posts = read('posts.json')
const questions = read('questions.json')
const byNum = new Map(posts.map(p => [p.postNum, p]))
/** A drop's text as the reader sees it, normalised for comparison. Computed once per drop. */
const runtimeOf = new Map(posts.map(p => [p.postNum, runtimeText(p.text ?? '')]))
// A SPAN OF PURE PUNCTUATION IS STILL A SPAN. Folding to alphanumerics is right for comparing
// wording across the board's encodings, and it turns "$", "$$$,$$$,$$$" and "^^^^" into the empty
// string — so #261's certified Claim "$" read as "certified in NO section" when it is right there
// in the array. Where the fold empties a span, compare the literal text instead.
const fold = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const literal = s => String(s ?? '').replace(/\s+/g, ' ').trim()
/** Are these the same span? Folded where the fold says something, literal where it does not. */
const sameSpan = (a, b) => {
  const fa = fold(a), fb = fold(b)
  if (fa || fb) return fa === fb
  return literal(a) === literal(b)
}
/** Is `span` inside this drop's RENDERED text? Same two tiers, on containment. */
const inText = (rendered, span) => {
  const f = fold(span)
  if (f) return fold(rendered).includes(f)
  const l = literal(span)
  return Boolean(l) && literal(rendered).includes(l)
}

// PRIMARY ONLY. Step 3B-1 demoted 163 question records to non-painting secondaries; the record
// survives so its id and relationships survive, but the reader does not see it. "Is this row
// highlighted" has to mean the layer that paints.
const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  if (q.semanticLayer && q.semanticLayer !== 'primary') continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q.unitText ?? q.text)
}

/** Every certified section holding this exact span on this drop. */
function sectionsHolding(postNum, span) {
  const p = byNum.get(postNum)
  if (!p) return []
  const a = p.postAnalysis ?? {}
  if (!literal(span)) return []
  const has = list => (list ?? []).some(x => sameSpan(x, span))
  const out = []
  if (has(qByPost.get(postNum))) out.push('questions')
  if (has(p.actionRequests)) out.push('directives')
  if (has(a.claimSpans ?? a.claims)) out.push('claims')
  if (has(a.predictionSpans ?? a.predictions)) out.push('predictions')
  // Themes are still CERTIFIED and no longer PAINTED. The question here is which sections HOLD the
  // span, not which ones fill it — so a Theme still counts. What changed is only the consequence:
  // a span carried in Claims and Themes no longer rotates, because only one of them draws.
  if (has(a.themeAnchors)) out.push('themes')
  if (has(a.namedEntities)) out.push('entities')
  return out
}

/** A bracket row is a DETECTOR reading the drop text, not a section membership. */
function bracketedInDrop(postNum, span) {
  const p = byNum.get(postNum)
  if (!p) return false
  const t = runtimeOf.get(postNum) ?? ''
  const s = String(span ?? '').trim()
  if (!s) return false
  if (/^\[[\s\S]*\]$/.test(s)) return inText(t, s)
  return inText(t, '[' + s + ']')
}

/** A URL row is a detector too — the address has to be in the drop. */
function urlInDrop(postNum, span) {
  const p = byNum.get(postNum)
  if (!p) return false
  return inText(runtimeOf.get(postNum) ?? '', span)
}

const SECTION_OF_SHEET = {
  'Q Questions': 'questions', 'Q Claims': 'claims', 'Q Predictions': 'predictions',
  'Q Directives': 'directives', 'Q Entities': 'entities', 'Q Brackets': 'brackets',
  URL: 'url', 'Resolution Center': 'resolution',
}

/** The longest span this section certifies on this drop that the row's text CONTAINS. */
function nearestCertified(postNum, span, want) {
  const p = byNum.get(postNum)
  if (!p) return null
  const a = p.postAnalysis ?? {}
  const pool = want === 'questions' ? (qByPost.get(postNum) ?? [])
    : want === 'directives' ? (p.actionRequests ?? [])
    : want === 'claims' ? (a.claimSpans ?? a.claims ?? [])
    : want === 'predictions' ? (a.predictionSpans ?? a.predictions ?? [])
    : want === 'entities' ? (a.namedEntities ?? [])
    : []
  const f = fold(span)
  if (!f) return null
  const hits = pool.filter(x => fold(x) && f.includes(fold(x)))
  if (!hits.length) return null
  return hits.sort((x, y) => fold(y).length - fold(x).length)[0]
}

/** One row's verdict. `want` is the section the row names. */
function verdict(postNum, span, want) {
  if (!byNum.has(postNum)) return { ok: false, why: 'no such drop', held: [] }
  if (want === 'url') return { ok: urlInDrop(postNum, span), why: '', held: [] }
  if (want === 'brackets') return { ok: bracketedInDrop(postNum, span), why: '', held: [] }
  if (want === 'resolution') return { ok: true, why: 'queued, not certified — outside this check', held: [] }
  const held = sectionsHolding(postNum, span)
  if (!held.length) {
    // A CELL THAT OVER-RAN THE LINE IS NOT A MISSING HIGHLIGHT. #4595's cell reads
    // "v2_change we can believe in Q" — Q's line plus the sign-off underneath it — and #4881's
    // takes the bracket after the sentence. The archive certifies Q's line; saying "certified in
    // NO section" about that would be true of the cell and false about the drop.
    const inner = nearestCertified(postNum, span, want)
    if (inner) return { ok: false, why: 'the cell over-runs the line — ' + want + ' certifies ' + JSON.stringify(inner), held, nearMiss: inner }
    return { ok: false, why: 'certified in NO section', held }
  }
  if (!held.includes(want)) return { ok: false, why: 'certified in ' + held.join(' + ') + ', not ' + want, held }
  return { ok: true, why: held.length > 1 ? 'also carried in ' + held.filter(h => h !== want).join(' + ') : '', held }
}

// ── WHAT A LATER RULING DID TO A ROW ────────────────────────────────────────
//
// A row on these sheets records what the 2026-08-24 round did with it. Two later records can move
// it, and a sweep that does not read them reports a correction as a defect:
//
//   audit/abbreviation-span-repairs.json  says a span was cut short and names the WHOLE sentence,
//                                         and which section that sentence is certified in. The
//                                         owner re-filed seven of them under Questions on the
//                                         UPDATED report.
//   audit/unhighlighted-owner-rulings-2-corrections.json  says a round-2 ruling was WITHDRAWN, so
//                                         the span must be absent rather than present.
const abbrev = aud('abbreviation-span-repairs.json')
const corrections = (() => {
  const f = path.join(ROOT, 'audit/unhighlighted-owner-rulings-2-corrections.json')
  if (!fs.existsSync(f)) return []
  return JSON.parse(fs.readFileSync(f, 'utf8')).withdrawnRulings ?? []
})()
// A WITHDRAWAL IS OF ONE SECTION'S RULING, NOT OF THE SPAN. #1443's PREDICTIONS ruling was
// withdrawn and its CLAIMS ruling is exactly what the owner asked for, so a section-blind check
// reports the span as "withdrawn but still certified" when it is certified where it should be.
const wasWithdrawn = (postNum, span, section) =>
  corrections.some(c => c.postNum === postNum && sameSpan(c.sourceText, span)
    && (!section || c.section === section))
/** The FULL sentence a truncated span was repaired onto, and the section it now lives in.
 *
 * THE LATER RULING GOVERNS. A sentence can be named by more than one repair — seven of them are
 * recorded under `claims`, where the splitter had put the head, and again under `questions`, where
 * the owner re-filed them on 2026-08-24. The re-filing carries `shape: "tail"`, so it is the one
 * to answer with; without this the sweep asks whether a certified Question is a Claim and reports
 * the owner's own ruling as a defect. */
const repairFor = (postNum, span) => {
  const mine = (abbrev.repairs ?? []).filter(r => r.postNum === postNum
    && (sameSpan(r.truncated, span) || sameSpan(r.full, span)))
  if (!mine.length) return null
  return mine.find(r => r.shape === 'tail') ?? mine[0]
}

const sheets = {}
const exceptions = []

// WHAT KIND OF THING AN EXCEPTION IS, because "25 exceptions" is not an answer and the five kinds
// below call for five different things. Only two of them are questions for the owner.
const KIND = [
  [/over-runs the line/, 'the workbook cell took in more than Q typed on that line',
    'No action. The archive certifies the line as Q typed it; the cell reached past it into the sign-off, the bracket after it, or the words around a name.'],
  [/certified in [^,]*questions/, 'the archive reads this line as a QUESTION',
    'FOR YOU. Same family as the seven you ruled on the UPDATED report: the sheet named Claims or Directives and the line ends in "?". Say the word and they move.'],
  [/certified in [^,]*themes/, 'the cell is part of a line, and the ruling was applied to the whole line',
    'No action. The fragment on its own matches only a theme anchor; the LINE it sits in is certified in the section your sheet named.'],
  [/certified in [^,]*claims, not entities/, 'the line was SPLIT, so the whole line is not the entity',
    'No action. "Ted Poe - Republican" names two things and each is certified on its own; the line itself stays a Claim.'],
  [/certified in [^,]*predictions/, 'the archive reads this line as a PREDICTION',
    'FOR YOU. The sheet named Claims. Say the word and it moves.'],
  [/certified in NO section/, 'deliberately unsettled — awaiting a ruling',
    'FOR YOU. "L.", "45", "F-15" and the like are corpus-wide aliases: certifying one would paint hundreds of spans that mean nothing of the kind, so they were queued rather than guessed.'],
]
const classify = problem => (KIND.find(([rx]) => rx.test(problem)) ?? [null, 'unclassified', 'FOR YOU. Not one of the known shapes — read the row.'])
const note = (sheet, row) => {
  const [, kind, whatToDo] = classify(String(row.problem ?? ''))
  exceptions.push({ sheet, ...row, kind, whatToDo })
}

// ════════════════════════════════════════════════════════════════════════════
// SHEET 2 — every already-certified span, in the section the owner named
// ════════════════════════════════════════════════════════════════════════════
{
  const rulings = aud('unhighlighted-owner-rulings-2.json')
  const rows = rulings.alreadyCertified ?? []
  let ok = 0, alsoElsewhere = 0
  for (const a of rows) {
    const v = verdict(a.postNum, a.sourceText, a.section)
    if (v.ok) { ok++; if (v.why) alsoElsewhere++; continue }
    note('2-already-highlighted', { postNum: a.postNum, section: a.section, text: a.sourceText, problem: v.why })
  }
  sheets['2-already-highlighted'] = { rows: rows.length, verified: ok, exceptions: rows.length - ok, carriedInMoreThanOne: alsoElsewhere }
}

// ════════════════════════════════════════════════════════════════════════════
// SHEET 3 — what each held row BECAME, on the drop it names
// ════════════════════════════════════════════════════════════════════════════
{
  const heldDir = aud('unhighlighted-owner-rulings-2-held-directives.json')
  const held3 = aud('unhighlighted-entity-identities-3.json')
  const heldRC = aud('held-entity-resolution-center.json')
  const entities = read('entities.json')
  const entityRows = entities.entities ?? entities
  const canonicals = new Set(entityRows.map(e => e.canonical))
  const aliasText = new Set()
  for (const e of entityRows) for (const a of e.aliases ?? []) aliasText.add(fold(a.text) || literal(a.text))

  let ok = 0, rows = 0

  // The 24 directives the owner pushed. Each names its drop, so each is checkable exactly.
  for (const r of heldDir.rulings ?? []) {
    rows++
    const v = verdict(r.postNum, r.sourceText, 'directives')
    if (v.ok) ok++
    else note('3-held-for-you', { postNum: r.postNum, section: 'directives', text: r.sourceText, problem: v.why })
  }

  // A SPLIT CERTIFIES ITS PARTS, NEVER THE LINE IT WAS SPLIT OUT OF. "Philip Pines: Bangko Sentral
  // ng Pilipinas" is one line of a list Q pasted that names TWO things, so what has to be certified
  // on that drop is the country and the bank — asking for the whole line back would be asking for
  // the split to be undone.
  for (const sp of held3.splits ?? []) {
    rows++
    const parts = sp.into ?? []
    const missing = parts.filter(part => !verdict(sp.postNum, part, 'entities').ok)
    if (!missing.length && parts.length) ok++
    else note('3-held-for-you', {
      postNum: sp.postNum, section: 'entities', text: sp.spelling,
      problem: parts.length
        ? 'split into ' + parts.join(' + ') + '; not certified on this drop: ' + missing.join(', ')
        : 'the split records no parts',
    })
  }

  // An IDENTITY was ruled corpus-wide, not on one drop, so what has to be true is that the identity
  // is live and the wording reaches it. Checking it against a single post would fail rows that are
  // correct everywhere.
  for (const id of held3.identities ?? []) {
    for (const sp of id.spellings ?? []) {
      rows++
      if (canonicals.has(id.canonical) && aliasText.has(fold(sp) || literal(sp))) { ok++; continue }
      note('3-held-for-you', {
        postNum: '', section: 'entities', text: sp,
        problem: canonicals.has(id.canonical)
          ? '"' + id.canonical + '" is live but "' + sp + '" is not one of its aliases'
          : '"' + id.canonical + '" is not a live entity',
      })
    }
  }

  // Resolution Center rows are DELIBERATELY not certified — that is what the Resolution Center is.
  // Counted, never failed.
  sheets['3-held-for-you'] = { rows, verified: ok, exceptions: rows - ok, queuedNotCertified: (heldRC.rows ?? []).length }
}

// ════════════════════════════════════════════════════════════════════════════
// SHEET 4 — the data-problem rows, and the owner's rulings on them
// ════════════════════════════════════════════════════════════════════════════
{
  const issues = aud('unhighlighted-review2-issues.json')
  const IN_SHEET_4 = new Set(['URL_LIVE_BUT_SCHEME_ORPHANED_IN_DROP', 'WORKBOOK_TEXT_DIFFERS_FROM_DROP',
    'NO_MATCHING_Q_UNIT', 'SPAN_EXTENDED_BY_THE_ABBREVIATION_REPAIR', 'SPAN_IS_A_WITHDRAWN_ABBREVIATION_TAIL',
    'SINGLE_CHARACTER_ENTITY', 'BLANK_SENTENCE_INDEX'])
  let ok = 0, rows = 0, urlRows = 0, refused = 0
  for (const i of issues.issues ?? []) {
    if (!IN_SHEET_4.has(i.why)) continue
    rows++
    const want = SECTION_OF_SHEET[i.sheet]
    if (want === 'url') {
      urlRows++
      if (verdict(i.postNum, i.text, 'url').ok) ok++
      else note('4-data-problems', { postNum: i.postNum, section: 'url', text: i.text, problem: 'address not found in the drop' })
      continue
    }
    // A REFUSED row is refused ON PURPOSE and must NOT be certified. Asserting its ABSENCE is the
    // check — finding it present would mean a refusal had been quietly overturned. A ruling the
    // owner WITHDREW on the UPDATED report is the same shape of assertion.
    // Either wording can be the one the owner withdrew: the workbook cell, or the drop's line the
    // cell was resolved onto. #1443 is the second — the cell says "DECLAS_Public" and the ruling
    // that was withdrawn names the line "DECLAS_Public[3]".
    if (i.why === 'NO_MATCHING_Q_UNIT' || i.why === 'SPAN_IS_A_WITHDRAWN_ABBREVIATION_TAIL'
      || wasWithdrawn(i.postNum, i.text, want) || wasWithdrawn(i.postNum, i.drop, want)) {
      refused++
      const v = verdict(i.postNum, i.drop || i.text, want)
      if (!v.ok) ok++
      else note('4-data-problems', { postNum: i.postNum, section: want, text: i.text, problem: 'REFUSED or withdrawn, but now certified in ' + v.held.join(' + ') })
      continue
    }
    // A TRUNCATED HEAD IS NOT A SPAN THE ARCHIVE HOLDS. The row records that the splitter cut this
    // span at an abbreviation; what is certified is the WHOLE sentence the repair names. So two
    // things have to be true, and the second is the one that matters: the head is gone, and the
    // sentence is certified in the section that governs it now.
    // THE ROW CARRIES THE REPAIR TOO. A SPAN_EXTENDED row states `from` and `to`, so where the
    // canonical record holds no entry for this head — five directives repairs, not all of them
    // reachable from a head — the row's own `to` is the sentence to ask about. #2451 is that case.
    const rep = repairFor(i.postNum, i.text)
      ?? (i.to ? { truncated: i.from ?? i.text, full: i.to, category: SECTION_OF_SHEET[i.sheet] } : null)
    if (i.why === 'SPAN_EXTENDED_BY_THE_ABBREVIATION_REPAIR' && rep) {
      // ASK THE SENTENCE, NOT THE HEAD, WHICH SECTION GOVERNS IT. Looked up by the head, this row
      // can only find the repair that names that head — the 2026-08-21 one, filed under `claims`.
      // The owner's re-filing is keyed to the TAIL, so it is reached through the sentence.
      const gov = repairFor(i.postNum, rep.full) ?? rep
      const headGone = !verdict(i.postNum, rep.truncated, want).ok
      const full = verdict(i.postNum, gov.full, gov.category)
      if (headGone && full.ok) ok++
      else note('4-data-problems', {
        postNum: i.postNum, section: gov.category, text: gov.full,
        problem: !headGone ? 'the truncated head is still certified' : full.why,
      })
      continue
    }
    // Q'S OWN LINE IS THE SPAN. Where the workbook cell and the drop disagree the archive keeps
    // Q's wording, so `drop` is what has to be certified, not the cell — and where a later ruling
    // moved that sentence to another section, that section is the one to ask about.
    const span = i.drop || i.text
    const moved = repairFor(i.postNum, span)
    const section = moved && sameSpan(moved.full, span) ? moved.category : want
    const v = verdict(i.postNum, span, section)
    if (v.ok) ok++
    else note('4-data-problems', { postNum: i.postNum, section, text: span, problem: v.why })
  }
  sheets['4-data-problems'] = { rows, verified: ok, exceptions: rows - ok, urlRows, refusedRowsStillRefused: refused }
}

// ════════════════════════════════════════════════════════════════════════════
// SHEET 5 — how each row was read, and whether that reading is what got certified
// ════════════════════════════════════════════════════════════════════════════
{
  const issues = aud('unhighlighted-review2-issues.json')
  const IN_SHEET_5 = new Set(['BLANK_FINAL_CATEGORY_USED_SHEET', 'DUPLICATE_ROW_DROPPED',
    'DUPLICATE_ROW_DISAGREES_WITH_ITSELF', 'CELL_OVERRIDES_SHEET', 'CELL_SECTION_UNRESOLVABLE_USED_SHEET',
    'LEADING_APOSTROPHE_STRIPPED'])
  let ok = 0, rows = 0
  for (const i of issues.issues ?? []) {
    if (!IN_SHEET_5.has(i.why)) continue
    rows++
    // The section that was APPLIED is the one this row has to be certified in — that is precisely
    // what this sheet records. `applied` where the row states one, else what was assumed, else the
    // sheet's own section.
    const stated = i.applied ?? i.assumed ?? i.sheet
    let want = SECTION_OF_SHEET[stated] ?? stated
    // A ruling the owner WITHDREW must be absent, not present.
    if (wasWithdrawn(i.postNum, i.text, want) || wasWithdrawn(i.postNum, i.drop, want)) {
      if (!verdict(i.postNum, i.drop || i.text, want).ok) ok++
      else note('5-how-it-was-read', { postNum: i.postNum, section: want, text: i.text, problem: 'withdrawn on the UPDATED report but still certified' })
      continue
    }
    // The same two later records that move a sheet-4 row move one here: a span cut short at an
    // abbreviation is certified as the WHOLE sentence, in whatever section governs it now.
    const rep = repairFor(i.postNum, i.text)
    let span = i.text
    if (rep) { span = rep.full; want = rep.category }
    const v = verdict(i.postNum, span, want)
    if (v.ok) ok++
    else note('5-how-it-was-read', { postNum: i.postNum, section: want, text: span, problem: v.why })
  }
  sheets['5-how-it-was-read'] = { rows, verified: ok, exceptions: rows - ok }
}

// ════════════════════════════════════════════════════════════════════════════
// SHEETS 8, 9, 10 — the theme layer is off every item, on BOTH surfaces
// ════════════════════════════════════════════════════════════════════════════
const themes = (() => {
  const detail = src('src/pages/PostDetail.tsx')
  const card = src('src/lib/postHighlight.tsx')
  // COMMENTED OUT IN BOTH, not merely absent from one. These two files have shown the same drop
  // differently three times, and every one of those was a change that landed on only one of them.
  // TWO SHAPES, because the two files express the layer differently: PostDetail lists it as a pair
  // in `analysisPairs`, postHighlight calls addSegs directly. What has to be true in both is that
  // the theme line is COMMENTED OUT rather than merely absent — absent could mean it was never
  // there, and these two files have drifted apart three times.
  const LIVE = /^[ \t]*(?:\['theme',|addSegs\([^\n]*'theme'\))/m
  const COMMENTED = /^[ \t]*\/\/[ \t]*(?:\['theme',|addSegs\([^\n]*'theme'\))/m
  const live = s => LIVE.test(s)
  const commented = s => COMMENTED.test(s)
  const ov = aud('overlay-audit.json')
  const t = ov.totals ?? {}
  const inside = t.themeInsideAnotherHighlight?.spans ?? t.themeInsideAnotherHighlight ?? null
  const pairs = ov.byPair ?? ov.pairs ?? {}
  return {
    themeFillRemovedFromPostDetail: !live(detail) && commented(detail),
    themeFillRemovedFromPostCard: !live(card) && commented(card),
    themeSpansInsideAnotherHighlight: inside,
    rotatingSpans: t.twoLayersNeitherEntityNorBracket ?? {},
    rotatingPairsInvolvingATheme: Object.keys(pairs).filter(k => /theme/.test(k)),
    themeAssignmentsStillCertified: posts.reduce((n, p) => n + (p.postAnalysis?.themes ?? []).length, 0),
    themeAnchorsStillRecorded: posts.reduce((n, p) => n + (p.postAnalysis?.themeAnchors ?? []).length, 0),
  }
})()

const totals = {
  rows: Object.values(sheets).reduce((n, s) => n + s.rows, 0),
  verified: Object.values(sheets).reduce((n, s) => n + s.verified, 0),
  exceptions: exceptions.length,
}

const out = {
  note: 'Every row of Q_Unhighlighted FINAL 2 - REPORT (UPDATED).xlsx re-read against the certified state, sheet by sheet, on the owner ruling of 2026-08-24.',
  ranOn: '2026-08-24',
  readFrom: 'the artifacts build-review2-report.mjs writes the workbook from, plus public/data — never the painted DOM, because an Entity or a Bracket on top of a Claim hides the Claim from anything reading the page.',
  totals, sheets, themes,
  exceptionsByKind: exceptions.reduce((a, e) => ({ ...a, [e.kind]: (a[e.kind] ?? 0) + 1 }), {}),
  exceptions,
}
fs.writeFileSync(path.join(ROOT, 'audit/report-updated-sweep.json'), JSON.stringify(out, null, 1) + '\n')

const pad = (s, n) => String(s).padEnd(n)
console.log('\nTHE UPDATED REPORT, RE-READ AGAINST THE CERTIFIED STATE\n')
for (const [name, s] of Object.entries(sheets)) {
  console.log('  ' + pad(name, 24) + String(s.verified).padStart(5) + '/' + pad(s.rows, 6) + ' verified'
    + (s.exceptions ? '   ' + s.exceptions + ' EXCEPTION(S)' : '   clean'))
}
console.log('')
console.log('  THE THEME LAYER')
console.log('    fill removed from PostDetail.tsx      ' + themes.themeFillRemovedFromPostDetail)
console.log('    fill removed from postHighlight.tsx   ' + themes.themeFillRemovedFromPostCard)
console.log('    theme spans inside another highlight  ' + themes.themeSpansInsideAnotherHighlight)
console.log('    rotating spans left                   ' + (themes.rotatingSpans.spans ?? '?') + ' across ' + (themes.rotatingSpans.posts ?? '?') + ' drops')
console.log('    rotating pairs involving a Theme      ' + themes.rotatingPairsInvolvingATheme.length)
console.log('    theme assignments still certified     ' + themes.themeAssignmentsStillCertified.toLocaleString())
console.log('    theme anchors still recorded          ' + themes.themeAnchorsStillRecorded.toLocaleString())
console.log('')
if (exceptions.length) {
  console.log('  EXCEPTIONS BY KIND')
  for (const [k, v] of Object.entries(exceptions.reduce((a, e) => ({ ...a, [e.kind]: (a[e.kind] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])) {
    console.log('    ' + String(v).padStart(4) + '  ' + k)
  }
  console.log('')
  console.log('  ' + exceptions.length + ' EXCEPTION(S) — first 15:')
  for (const e of exceptions.slice(0, 15)) {
    console.log('    ' + pad(e.sheet, 22) + '#' + pad(e.postNum, 6) + pad(e.section, 12)
      + pad(JSON.stringify(String(e.text).slice(0, 44)), 46) + e.problem)
  }
  console.log('')
}
console.log('  ' + totals.verified.toLocaleString() + '/' + totals.rows.toLocaleString() + ' rows verified, ' + totals.exceptions + ' exception(s)')
console.log('\nwrote audit/report-updated-sweep.json\n')
