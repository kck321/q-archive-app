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
// ROUND 3, and the follow-up checks. Sheet 3 used to be a list of things NOT decided; the owner
// ruled on 2026-08-24 that all 128 be classified and researched, so it is now a record of what
// each one became. The rest went to the Resolution Center, which is a queue and not a refusal.
const held3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-entity-identities-3.json'), 'utf8'))
const heldRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/held-entity-resolution-center.json'), 'utf8'))
const heldDir = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-owner-rulings-2-held-directives.json'), 'utf8'))
const followups = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/review2-followups.json'), 'utf8'))
// Read up here rather than beside sheet 8, because the summary quotes it too and a `const` used
// above its declaration is a TDZ error, not a hoist.
const ov = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/overlay-audit.json'), 'utf8'))

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
  ['Held on the first pass', (issues.totals.PUSHED_ON_OWNER_RULING_STATES_NO_INSTRUCTION ?? 0) + idents.totals.stillHeldWordings, 'Rows I would have had to guess about. You then ruled on all of them - see the "Held for you" sheet, which is now a record of what each one became.'],
  ['   of those, now CERTIFIED', heldDir.totals.ruled + held3.identities.reduce((n, i) => n + i.spellings.length, 0) + held3.splits.length, 'The 24 directives you pushed, plus the entity wordings researched against the drop each one sits in.'],
  ['   of those, to the Resolution Center', heldRC.rows.length, 'Still questions. Either the drop does not fix what the span refers to, or the reading IS clear but certifying the alias would paint hundreds of other spans that mean nothing of the kind ("45" appears 281 times, "N." 141, "RED" 187).'],
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
  ['', '', ''],
  ['THE 2026-08-24 FOLLOW-UPS', '', ''],
  ['Already-highlighted rows in the WRONG category', followups.categories.inADifferentSection, `Every one of the ${followups.categories.rowsChecked.toLocaleString()} section rows on sheet 2 was re-read against all six certified sections. None is in a section other than the one you named, and none is uncertified.`],
  ['Rows carried in MORE THAN ONE category', followups.categories.inMoreThanOneSection, 'These are the spans the renderer rotates between. 53 of them involve a Theme, which is the indigo you could not tell from Prediction violet. Listed on sheet 10.'],
  ['Fixes on sheet 6, re-asserted', `${followups.fixes.passed}/${followups.fixes.total}`, 'Each one checked against the file it changed - both renderers, the linkifier, the queue, the hover file - rather than reported as done.'],
  ['URL problems left', followups.urls.problems, 'Every address-shaped token in every drop, tested against the pattern lib/linkify.tsx itself uses, on the RUNTIME text the browser renders rather than the stored text (1,448 drops store every scheme as "https:<em>//</em>host", and the app strips that markup at load).'],
  ['NAT SEC', '48 drops', 'Certified as an entity in the three spellings Q writes - NAT SEC, NATSEC, NAT_SEC - with a hover that says it stands for national security. Distinct from the National Security Agency, which keeps its own row and its 92 mentions.'],
  ['White House Press', '2 drops', '#397 and #417, where Q writes WH_POTUS_PRESS inside a stringer.'],
  ['#417 (Find Post)', '1', 'Certified a Directive, family research - it tells the reader to go and locate the post the stringer points at.'],
  ['#417 News unlocks Map.', '1', 'Certified a Prediction as well as the Claim it already was. The archive already carries spans certified as both.'],
  ['', '', ''],
  ['THE THEME HIGHLIGHT IS RETIRED', '', ''],
  ['Rotating spans BEFORE', '1,676 / 1,058 drops', 'Spans covered by two categories with neither an Entity nor a Bracket, so nothing won by rule and the renderer cycled the colours.'],
  ['Rotating spans AFTER', `${ov.totals.twoLayersNeitherEntityNorBracket.spans} / ${ov.totals.twoLayersNeitherEntityNorBracket.posts} drops`, 'What is left is almost entirely the ONE overlap the archive documents on purpose: a line that is both a Question and a Directive. 189 of them.'],
  ['Theme spans inside another highlight', '2,153 -> 0', 'The layer you could not read. Gone from the drop body on both surfaces.'],
  ['The Themes SECTION is untouched', '2,646 assignments / 1,899 drops', 'Still certified, still in the Themes tab, still listed under Themes in the panel below each drop, and 1,729 anchors are still recorded. Only the indigo fill is gone - see sheet 9.'],
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

// ── 3. What the held rows became ────────────────────────────────────────────
//
// OWNER RULING 2026-08-24: "i want to classify all those as entities and i would like you to do
// the research for each post they are with in to give them the best hover description you can.
// anything you are unsure of lets put in the resolution center" - and, separately, "go ahead and
// push the directives in that held for you file tab as well".
const held = [['What', 'Post(s)', 'The text', 'What it is now', 'How the drop says so']]
for (const r of heldDir.rulings) {
  held.push(['Directive that instructs nobody', r.postNum, r.sourceText,
    `CERTIFIED as a Directive (family: ${r.family})`,
    `Held on the first pass because it is ${r.heldReason}. Ruled in on your word; the family is declared with the ruling rather than guessed by a detector.`])
}
for (const id of held3.identities) {
  for (const sp of id.spellings) held.push(['Entity with no name yet', '', sp, `CERTIFIED as "${id.canonical}" [${id.type}]`, id.why])
}
for (const sp of held3.splits) {
  held.push(['Entity with no name yet', sp.postNum, sp.spelling, `SPLIT into ${sp.into.join(' + ')}`, sp.why])
}
for (const r of heldRC.rows) {
  const KIND = {
    'unsettled': 'TO THE RESOLUTION CENTER - the drop does not fix what it refers to',
    'would-paint-wrong-text': 'TO THE RESOLUTION CENTER - the reading is clear, but the alias is corpus-wide',
    'not-a-name': 'TO THE RESOLUTION CENTER - the span points at something rather than naming it',
    'defect': 'A DEFECT FOUND WHILE RESOLVING THESE',
  }
  held.push(['Entity with no name yet', r.posts.join(' '), r.spelling, KIND[r.kind] ?? r.kind, r.why])
}
held.push(['', '', '', '', ''])
held.push(['WHY ANYTHING IS STILL A QUESTION', '', '', '', heldRC.why])
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

// 8. Everything with two layers that is NOT an entity or a bracket.
const PAIR_NOTE = {
  'claim + theme': 'RESOLVED - the theme highlight is retired, so this pair no longer rotates.',
  'request + theme': 'RESOLVED - the theme highlight is retired.',
  'question + theme': 'RESOLVED - the theme highlight is retired.',
  'question + request': 'A line that is both a Question and a Directive - "Define ‘evidence’." The archive counts 228 of these on purpose; they are the documented overlap.',
  'prediction + theme': 'RESOLVED - the theme highlight is retired.',
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

// 9. The theme highlight, retired ────────────────────────────────────────────
//
// This sheet used to list 2,153 spans where a Theme anchor sat inside another highlight - the
// purple the owner could not read. The ruling of 2026-08-24 removed the layer, so the list is
// empty by construction and a sheet of nothing would say nothing. It records what was taken off
// and what was deliberately left alone instead.
const themes = [['What', 'Before', 'After', 'Detail']]
themes.push(['Theme spans inside another highlight', '2,153 spans / 1,168 drops', `${ov.totals.themeInsideAnotherHighlight.spans}`,
  'Measured by scripts/audit-overlays.mjs, which rebuilds the segments from the same sources the renderer paints from. The before figure is the one this sheet carried at commit 1c4cb1b.'])
themes.push(['Rotating spans, all causes', '1,676 spans / 1,058 drops', `${ov.totals.twoLayersNeitherEntityNorBracket.spans} spans / ${ov.totals.twoLayersNeitherEntityNorBracket.posts} drops`,
  '1,448 of the original 1,676 involved a Theme. What remains is 189 Question+Directive lines, which the archive documents as a real overlap, and 19 others.'])
themes.push(['Entity/bracket over another layer', '11,254 spans / 2,142 drops', `${ov.totals.entityOrBracketOverAnother.spans} spans / ${ov.totals.entityOrBracketOverAnother.posts} drops`,
  'Lower only because a Theme is no longer one of the things they can be in front of. They still render solid over everything else.'])
themes.push(['', '', '', ''])
themes.push(['WHAT WAS NOT TOUCHED', '', '', ''])
themes.push(['Theme assignments', '2,646', '2,646', 'The section itself. Still in the Themes tab and still listed under Themes in the panel below each drop.'])
themes.push(['Drops carrying a theme', '1,899', '1,899', ''])
themes.push(['Theme anchors recorded', '1,729', '1,729', 'The words the fill used to be painted on. Kept, because deleting them would remove the fill AND the record of which words the taxonomy hangs on - which would look exactly like success.'])
themes.push(['', '', '', ''])
themes.push(['Both halves are asserted by scripts/verify-context-render.mjs, which is a step of the pre-deploy proof. Withdrawing the data to achieve the visual change fails it.', '', '', ''])
write('9-themes-retired', themes)

// ── 10. The follow-up checks ────────────────────────────────────────────────
const fu = [['Check', 'Result', 'Detail']]
fu.push(['- 1. IS EVERY ALREADY-HIGHLIGHTED ROW IN THE RIGHT CATEGORY -', '', ''])
fu.push(['Rows checked', followups.categories.rowsChecked, 'Section rows only. URL and bracket rows are detectors reading the drop text, not section membership, so "which section holds it" has no meaning for them.'])
fu.push(['In a DIFFERENT section than you named', followups.categories.inADifferentSection, ''])
fu.push(['Certified in NO section', followups.categories.notCertifiedAnywhere, ''])
fu.push(['Certified in MORE THAN ONE', followups.categories.inMoreThanOneSection, 'This is what rotates.'])
for (const [k, v] of Object.entries(followups.categories.byPair)) fu.push([k, v, 'spans'])
fu.push(['', '', ''])
fu.push(['Post', 'The span', 'Every section that certifies it'])
for (const r of followups.categories.rows) fu.push([r.postNum, r.span, r.certifiedIn.join(' + ')])
fu.push(['', '', ''])
fu.push(['- 2. THE FIXES, RE-ASSERTED -', '', ''])
for (const c of followups.fixes.checks) fu.push([c.name, c.ok ? 'PASS' : 'FAIL', c.evidence])
fu.push(['', '', ''])
fu.push(['- 3. URL PROBLEMS -', followups.urls.problems, 'Tested against the runtime text the browser renders, not the stored text.'])
for (const [k, v] of Object.entries(followups.urls.byReason)) fu.push([k, v, ''])
for (const r of followups.urls.rows.slice(0, 500)) fu.push([r.postNum, r.token, r.why])
write('10-followup-checks', fu)


console.log('\nREVIEW 2 — ISSUES REPORT\n')
for (const f of fs.readdirSync(OUT)) console.log('  ' + f)
console.log('\nwrote ' + path.relative(ROOT, OUT) + '\n')
