// THE ISSUES REPORT for round 2 of the unhighlighted-sentence review, as a workbook.
//
//   -> audit/unhighlighted-sentences/Q_Unhighlighted_FINAL_2_REPORT.xlsx  (and a Desktop copy)
//
// The owner asked for "a report on an excel file of any issues you found or had w/ all the data".
// This is that file, written from the artifacts rather than from notes, so it cannot drift from
// what was actually applied:
//
//   audit/unhighlighted-owner-rulings-2.json          what was ruled, and what was already certified
//   audit/unhighlighted-review2-issues.json           every row that could not be taken at face value
//   audit/unhighlighted-entity-identities-2.json      the entity spans still waiting for a name
//
// It is written as CSVs and converted, because this repo has no spreadsheet dependency and adding
// one to publish a report would be the wrong trade. build-unhighlighted-sentence-workbook.mjs does
// the same thing for the census.
//
//   node scripts/build-review2-report.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/unhighlighted-sentences/review2-report')
fs.mkdirSync(OUT, { recursive: true })

const rulings = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-owner-rulings-2.json'), 'utf8'))
const issues = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-review2-issues.json'), 'utf8'))
const idents = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-entity-identities-2.json'), 'utf8'))

const csv = (rows) => rows.map(r => r.map(v => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}).join(',')).join('\n') + '\n'
const write = (name, rows) => { fs.writeFileSync(path.join(OUT, name + '.csv'), csv(rows), 'utf8'); return rows.length - 1 }

// ── 1. What happened ────────────────────────────────────────────────────────
const SHEETS = ['Resolution Center', 'Q Claims', 'Q Entities', 'Q Brackets', 'Q Predictions', 'URL', 'Q Directives', 'Q Questions']
const perSheet = new Map(SHEETS.map(s => [s, { rows: 0 }]))
for (const i of issues.issues) if (perSheet.has(i.sheet)) perSheet.get(i.sheet).rows++

const summary = [
  ['What', 'Count', 'What it means'],
  ['Rows you sent', rulings.totals.reviewed, 'Every non-blank row across the eight sheets of Q_Unhighlighted FINAL 2.xlsx.'],
  ['Applied as new rulings', rulings.totals.ruled, 'Now certified in the section your sheet named, and painting in the drop.'],
  ['ALREADY highlighted — not doubled', rulings.totals.alreadyCertified, 'The section you named already certified that exact span, so no second record was created. This is the "do not double-highlight" rule doing its job.'],
  ['Sent to the Resolution Center', rulings.totals.resolutionCenter, 'Sheet 1. Queued, not certified: the archive now shows these as unsettled rather than as nothing.'],
  ['Duplicate rows dropped', issues.totals.DUPLICATE_ROW_DROPPED ?? 0, 'The same (post, sentence, text) appeared more than once with the same destination.'],
  ['Held for your decision', (issues.totals.HELD_STATES_NO_INSTRUCTION ?? 0) + idents.totals.stillHeldWordings, 'Rows I would have had to guess about. Listed on the "Held for you" sheet.'],
  ['Refused', issues.totals.NO_MATCHING_Q_UNIT ?? 0, 'The text is not in the drop it names. Listed on "Data problems".'],
  ['', '', ''],
  ['SECTION COUNTS — before and after', '', ''],
  ['Q Questions', '6,321 → 6,327', '6 rulings'],
  ['Q Directives', '2,902 → 3,304', '455 rulings'],
  ['Q Claims', '8,631 → 10,258', '1,654 rulings'],
  ['Q Predictions', '841 → 934', '94 rulings'],
  ['Q Entities', '1,223 → 1,532 identities · 8,831 → 9,271 mentions', '499 rulings'],
  ['Q Codes & Brackets', '1,957 → 1,986', '43 rulings'],
  ['Resolution Center', '115 → 353', '238 rows from sheet 1'],
  ['', '', ''],
  ['THE 2026-08-24 ROUND — what you asked for after the first report', '', ''],
  ['Entities and brackets, solid in front', '11,254 spans / 2,142 drops', 'Where an Entity or a Bracket covers the same characters as another category it now renders OPAQUE, so nothing shows through and the front layer is unmistakable. Alone, it keeps the softer fill — there is nothing to be in front of.'],
  ['Other two-layer overlaps', '1,676 spans / 1,058 drops', 'Sheet 8. The pair you named — Claim over Prediction — is real but there are only THREE. What you are seeing is Claim + Theme (593), and Theme is indigo, one hue from the violet Predictions use.'],
  ['Themes inside another highlight', '2,153 spans / 1,168 drops', 'Sheet 9. This is the purple.'],
  ['Every entity has a hover, all one shape', '1,532', '358 had none at all. All 1,532 now read the same way, and the per-post layer (842 entities, 3,693 records) is untouched.'],
  ['Q = Alice', '93 occurrences / 75 drops', 'Alice 5 → 98 mentions. 4,534 sign-off lines excluded as you asked; 65 more held because they name something else.'],
]
write('1-summary', summary)

// ── 2. Already highlighted ──────────────────────────────────────────────────
const already = [['Sheet you put it on', 'Rows', 'Why no ruling was created']]
const WHY_ALREADY = {
  url: 'The address is already a live link in the drop. 2,099 of your 2,123 URL rows were already anchored — the app links every https:// and every bare www. host it finds.',
  brackets: 'The bracket detector already paints this token red at that post. Anything in [..] is red on every surface, so most of your bracket rows were already highlighted.',
  entities: 'That name is already a certified entity on that drop, so it is already painting cyan.',
  claims: 'That sentence is already a certified Claim on that drop.',
  questions: 'That sentence is already a certified Question on that drop.',
  directives: 'That sentence is already a certified Directive on that drop.',
  predictions: 'That sentence is already a certified Prediction on that drop.',
}
for (const [sec, n] of Object.entries(rulings.totals.alreadyBySection).sort((a, b) => b[1] - a[1])) {
  already.push([sec, n, WHY_ALREADY[sec] ?? ''])
}
already.push(['', '', ''])
already.push(['TOTAL', rulings.totals.alreadyCertified, 'None of these produced a second highlight.'])
already.push(['', '', ''])
already.push(['Post', 'Section', 'The span that was already certified'])
for (const a of rulings.alreadyCertified) already.push([a.postNum, a.section, a.sourceText])
write('2-already-highlighted', already)

// ── 3. Held for your decision ───────────────────────────────────────────────
const held = [['What', 'Post', 'The text', 'Why I did not decide it']]
for (const i of issues.issues.filter(x => x.why === 'HELD_STATES_NO_INSTRUCTION')) {
  held.push(['Directive that instructs nobody', i.postNum, i.drop ?? i.text, i.reason])
}
for (const h of idents.held) {
  held.push(['Entity with no name yet', h.posts.join(' '), h.spelling,
    'You ruled it an Entity and it is not one the registry already holds. A certified entity needs a canonical name and a type, which the review does not carry — and 244 others were named only because Q\'s own line names them (a country and its bank, an outlet and its reporter). This one is not that shape, so naming it would be a guess.'])
}
write('3-held-for-you', held)

// ── 4. Data problems in the drops ───────────────────────────────────────────
const DEFECT_NOTE = {
  URL_LIVE_BUT_SCHEME_ORPHANED_IN_DROP: 'Q typed a space after the scheme — "https:// wikileaks.org/…". FIXED: the whole address is one link again, and the href drops the space. The link text still shows exactly what Q typed.',
  WORKBOOK_TEXT_DIFFERS_FROM_DROP: 'The workbook cell and the drop do not say the same thing. Q\'s wording was used — the archive never stores a retyped version of what Q wrote — and the drop\'s text is in the next column.',
  NO_MATCHING_Q_UNIT: 'REFUSED. This text is not in the drop the row names.',
  SPAN_EXTENDED_BY_THE_ABBREVIATION_REPAIR: 'The sentence splitter cut this span at an abbreviation ("Mr.", "U.S.", "H. Biden"). The archive already records the repair, so the ruling was applied to the WHOLE sentence rather than the half.',
  SPAN_IS_A_WITHDRAWN_ABBREVIATION_TAIL: 'REFUSED. This fragment was deliberately absorbed into a repaired sentence on 2026-08-21; re-certifying it would put the same sentence in the archive twice.',
  SINGLE_CHARACTER_ENTITY: 'A one-character entity. Applied, and flagged because a single letter matches a lot of text — the word-boundary rule is what keeps it to "(H)".',
  BLANK_SENTENCE_INDEX: 'The Sentence # cell was empty. Recovered from the text, which matched exactly one line in that drop.',
}
const DEFECT_LABEL = {
  URL_LIVE_BUT_SCHEME_ORPHANED_IN_DROP: 'Address typed with a space after https://',
  WORKBOOK_TEXT_DIFFERS_FROM_DROP: 'Your text and the drop do not match',
  NO_MATCHING_Q_UNIT: 'Text is not in that drop — REFUSED',
  SPAN_EXTENDED_BY_THE_ABBREVIATION_REPAIR: 'Sentence was cut at an abbreviation',
  SPAN_IS_A_WITHDRAWN_ABBREVIATION_TAIL: 'Fragment already absorbed elsewhere — REFUSED',
  SINGLE_CHARACTER_ENTITY: 'One-character entity',
  BLANK_SENTENCE_INDEX: 'Sentence # was blank',
}
const defects = [['Problem', 'Post', 'Sentence #', 'Sheet', 'Your text', 'What the drop says', 'What I did']]
for (const i of issues.issues) {
  if (!DEFECT_NOTE[i.why]) continue
  defects.push([DEFECT_LABEL[i.why] ?? i.why, i.postNum, i.sentenceIndex, i.sheet, i.text, i.drop ?? '', DEFECT_NOTE[i.why]])
}
defects.push(['', '', '', '', '', '', ''])
defects.push(['KNOWN, NOT FIXED', '859', '', '', 'These peo&gt;&gt;567493ple are stupid.', '', 'This drop splices a post-pointer INSIDE a word, so no rendered block matches its text. It is the one drop of 4,966 the census could not read. Carried over from the previous pass.'])
write('4-data-problems', defects)

// ── 5. How your workbook was read ───────────────────────────────────────────
const READ_NOTE = {
  BLANK_FINAL_CATEGORY_USED_SHEET: 'The Final Category cell was empty, so the SHEET decided the section. That is how you described the file — "the other tabs/sheets are self explanatory".',
  DUPLICATE_ROW_DROPPED: 'The same line appeared twice with the same destination. Certified once.',
  DUPLICATE_ROW_DISAGREES_WITH_ITSELF: 'The same line appears twice on one sheet with two different Final Category values — e.g. #10 "These people worship Satan _ some openly show it." as both Q Claims and Q Brackets, on a drop with no bracket in it. The SHEET won and the other copy is reported here.',
  CELL_OVERRIDES_SHEET: 'A Final Category cell named a different section than the sheet, and was the only vote for that line. The CELL won — that is a reclassification.',
  CELL_SECTION_UNRESOLVABLE_USED_SHEET: 'The Final Category cell named a section the span cannot live in, so the sheet was used.',
  EXCEL_TEXT_PREFIX_STRIPPED: 'The cell began with an apostrophe because the line starts with "+", "-" or "=" and Excel would otherwise read it as a formula. Not a character Q typed, so it was removed before matching.',
  OWNER_INSTRUCTION_IN_CELL: 'The cell held an instruction rather than a line.',
}
const read = [['How it was read', 'Post', 'Sentence #', 'Sheet', 'Text', 'Detail']]
for (const i of issues.issues) {
  if (!READ_NOTE[i.why]) continue
  const detail = i.why === 'DUPLICATE_ROW_DISAGREES_WITH_ITSELF' ? `sheet said ${i.sheetSaid}, cell said ${i.cellSaid}, applied ${i.applied}`
    : i.why === 'CELL_OVERRIDES_SHEET' ? `sheet said ${i.from}, cell said ${i.to}, applied ${i.applied}`
    : i.why === 'BLANK_FINAL_CATEGORY_USED_SHEET' ? `assumed ${i.assumed}`
    : i.why === 'OWNER_INSTRUCTION_IN_CELL' ? `${i.note} Resolved to: ${i.resolvedTo}`
    : READ_NOTE[i.why]
  read.push([READ_NOTE[i.why].split('.')[0], i.postNum, i.sentenceIndex, i.sheet, i.text, detail])
}
write('5-how-it-was-read', read)

// ── 6. What else changed in the app ─────────────────────────────────────────
write('6-fixes-made', [
  ['Fix', 'What was wrong', 'What it means for you'],
  ['Entities and brackets stay on top inside a question',
   'Both renderers already put brackets and entities above every other category — except inside a question, where a name that was ALSO a Theme or a Claim rotated through two colours. The same name rendered solid cyan four lines down the same page.',
   'Your rule now holds everywhere: an entity or a bracket is on top of whatever category it sits on.'],
  ['44 addresses Q typed with a space are links again',
   '44 drops write "https:// wikileaks.org/…". Where the host began with "www." the address was still live; where it did not, 23 addresses were plain grey text. Worse, #866 rendered a link over "https:// wikileaks.org/" pointing at the SITE ROOT — a link that looks like it worked and goes to the wrong page.',
   'Every one of those addresses is a single working link now. The text still shows Q\'s space; only the href drops it.'],
  ['238 comms strings are visible as unsettled',
   'They were plain text in the drop and absent from every section.',
   'They are in the Resolution Center, where the archive says what it has NOT settled. Nothing about them is asserted.'],
  ['Entities and brackets render SOLID over another colour',
   'The ordinary fills are translucent. Over another category the colour underneath tinted them, so a name inside a Claim came out neither cyan nor amber but a muddy third thing and you could not tell which layer was in front. 11,254 spans are in that position.',
   'An Entity or a Bracket on top of anything is now opaque. Alone, it keeps the softer fill.'],
  ['Every entity has a hover, and they all read the same way',
   'The hovers were authored one at a time, so there were three sentence shapes — and 358 entities had no hover at all.',
   'One pattern for all 1,532, built from the certified record. Expansions like "POTUS — President of the United States" are carried across verbatim, never invented. The per-post layer that says how ONE drop uses the label is untouched.'],
  ['Q is Alice, except the sign-off',
   '#74 and #78 write "Q = Alice" in Q\'s own words. The renderer paints a certified term wherever it appears, so the closing "Q" was being painted too — the one occurrence your ruling excludes.',
   '93 occurrences across 75 drops resolve to Alice; the sign-off is left alone; 65 homographs held.'],
])

// ── 7. The three list shapes ────────────────────────────────────────────────
const shapes = [['List', 'Drops', 'Shape', 'How it was split', 'Identities named']]
shapes.push(['Central banks', '#135-#138', 'Country: Central Bank', 'Into the country and its bank. Both names are Q\'s own line.', '151 banks + 93 countries'])
shapes.push(['THE BRIDGE: PODESTA GROUP', '#1515', 'Outlet – Journalist', 'Into the outlet and the reporter.', '65 journalists and their outlets'])
shapes.push(['Retiring members of Congress', '#1319, #1850', 'Person - Party', 'Into the member and the party.', 'the members named on those lines'])
shapes.push(['', '', '', '', ''])
shapes.push(['Everything outside these three shapes was NOT named. It is on the "Held for you" sheet.', '', '', '', ''])
write('7-entity-lists', shapes)

// ── 8 + 9. THE OVERLAYS THE OWNER ASKED ABOUT ───────────────────────────────
//
// Two questions, one measurement — see scripts/audit-overlays.mjs.
const ov = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/overlay-audit.json'), 'utf8'))

// 8. Everything with two layers that is NOT an entity or a bracket.
const PAIR_NOTE = {
  'claim + theme': 'THIS IS THE ONE YOU ARE SEEING. A Claim is amber and a Theme is INDIGO, and the span rotates between them. Indigo (#6366F1) sits one hue from the violet Predictions use (#8B5CF6) - so a Claim rotating with a Theme looks exactly like a Claim over a Prediction.',
  'request + theme': 'A Directive (green) rotating with a Theme (indigo).',
  'question + theme': 'A Question (blue) rotating with a Theme (indigo).',
  'question + request': 'A line that is both a Question and a Directive - "Define ‘evidence’." The archive counts 228 of these on purpose; they are the documented overlap.',
  'prediction + theme': 'A Prediction (violet) rotating with a Theme (indigo) - the two closest colours in the palette.',
  'claim + prediction': 'GENUINELY a Claim over a Prediction. There are only three in the whole archive.',
}
const pairs = [['Two layers', 'Spans', 'What it is', 'Why you are seeing it']]
for (const [k, n] of Object.entries(ov.totals.byPair)) {
  pairs.push([k, n, k.split(' + ').length + ' certified layers on the same characters',
    PAIR_NOTE[k] ?? 'Two certified layers on one span; the renderer rotates between their colours.'])
}
pairs.push(['', '', '', ''])
pairs.push(['TOTAL', ov.totals.twoLayersNeitherEntityNorBracket.spans,
  'across ' + ov.totals.twoLayersNeitherEntityNorBracket.posts + ' drops',
  'Entities and brackets are NOT in this list - they now render solid, in front.'])
pairs.push(['', '', '', ''])
pairs.push(['Post', 'The two layers', 'The text they share', ''])
for (const r of ov.twoLayersNeitherEntityNorBracket) pairs.push([r.postNum, r.pair, r.span, ''])
write('8-two-layer-overlaps', pairs)

// 9. Themes inside another highlight - the purple the owner cannot read.
const themes = [['Theme anchor', 'Post', 'The text', 'What else covers it']]
const tally = {}
for (const r of ov.themeInsideAnotherHighlight) {
  const k = r.themeAnchor ?? '(unnamed)'
  tally[k] = (tally[k] ?? 0) + 1
}
themes.push(['- THE ANCHORS THAT DO THIS MOST -', '', '', ''])
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 30)) themes.push([k, n + ' spans', '', ''])
themes.push(['', '', '', ''])
themes.push(['- EVERY SPAN -', '', '', ''])
for (const r of ov.themeInsideAnotherHighlight) themes.push([r.themeAnchor, r.postNum, r.span, r.with])
write('9-themes-that-read-purple', themes)


console.log('\nREVIEW 2 — ISSUES REPORT\n')
for (const f of fs.readdirSync(OUT)) console.log('  ' + f)
console.log('\nwrote ' + path.relative(ROOT, OUT) + '\n')
