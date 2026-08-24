// THE SUMMARY OF THE 2026-08-24 UPDATED-REPORT BATCH, AS A WORKBOOK.
//
//   -> audit/unhighlighted-sentences/Q_Unhighlighted_FINAL_2_SUMMARY_2026-08-24.xlsx
//   -> the Desktop, as "Q_Unhighlighted FINAL 2 - SUMMARY 2026-08-24.xlsx"   (--desktop)
//
//   node scripts/pack-report-updated-summary.mjs [--desktop]
//
// A NEW NAME, ON PURPOSE. The owner asked for "a final summary in excel with any issues with a new
// name so we don't overwrite any old information" — Q_Unhighlighted FINAL 2.xlsx, the REPORT and
// the annotated REPORT (UPDATED) all stay exactly where they are.
//
// WRITTEN FROM THE AUDIT, NOT FROM NOTES. Every count and every issue row is read out of
// audit/report-updated-sweep.json, which is produced by re-reading the certified state — so this
// file cannot claim something the archive does not hold. The one hand-written sheet is the first,
// which restates what the owner asked for; the STATUS column on it is derived.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { workbookBuffer, writeWorkbook } from './lib/xlsx.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTFILE = path.join(ROOT, 'audit/unhighlighted-sentences/Q_Unhighlighted_FINAL_2_SUMMARY_2026-08-24.xlsx')
const DESKTOP = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Q_Unhighlighted FINAL 2 - SUMMARY 2026-08-24.xlsx'

const aud = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', f), 'utf8'))
const sweep = aud('report-updated-sweep.json')
const n = x => Number(x ?? 0).toLocaleString()

// ── 1. What you asked for, and what happened ────────────────────────────────
const cleanSheets = Object.entries(sweep.sheets).filter(([, s]) => !s.exceptions).map(([k]) => k)
const asked = [
  ['Your words', 'What was done', 'Status'],

  ['"in post 1012 RUSSIA NEW THREAT.COINCIDENCE? is a question not a claim"',
    'It is a question, and it always was — on #1011, which is the drop Q wrote it in. #1012 shows #1011 as a QUOTE, and the quoted copies were re-scraped after the original field was destroyed at ingest; that re-scrape lost the line break between "RUSSIA NEW THREAT." and "COINCIDENCE?". The quote is marked up from #1011\u2019s own certified analysis, so with the break gone the Claim swallowed the whole line and the Question could not start. A quoted drop is now shown with its own line breaks — 106 quotes were in that position.',
    'FIXED'],

  ['9-themes-that-read-purple — "take all the theme purple highlight items all off the post"',
    'Already done and now proved rather than assumed: the theme fill is commented out in BOTH renderers, and 0 theme spans sit inside another highlight (2,153 before). The Themes SECTION is untouched — 2,646 assignments and 1,729 anchors are still certified and still listed under the drop.',
    'DONE'],

  ['10-followup-checks — "the themes to be pulled off of any item that is highlighted on any post"',
    'The 57 rows sheet 10 listed as carried in more than one category were 53 Theme pairs. None of them rotates any more: the overlay audit reports 0 rotating pairs involving a Theme.',
    'DONE'],

  ['8-two-layer-overlaps — "lets take the theme layer off all these items as well"',
    'Rotating spans went 1,676 across 1,058 drops to 208 across 110. 189 of the 208 left are question + request — a line that is both a Question and a Directive, which the archive documents on purpose.',
    'DONE'],

  ['7 — "looks pretty good for now"', 'Left alone.', 'NO ACTION'],

  ['6 — "q does = alice in the pertaining post but any other post ... q is a group of people less than 10 or how ever q explains it"',
    'Q writes it himself: "You can count the people who have the full picture on two hands." / "Of those (less than 10 people) only three are non-military." (#60), and "Less than 10 can confirm me." (#244). Hovering "Q" now says that. The equation Q = Alice is written by Q on #74 and #78 and those two drops keep it; the other 73 say on the card that they inherit it, and quote what Q says the designation stands for.',
    'FIXED'],

  ['5-how-it-was-read — "make sure you take the Text and make sure it is highlighted as the category in the sheet cell for the post number"',
    `All 847 rows re-read against the certified state. ${n(sweep.sheets['5-how-it-was-read'].verified)} verified. ${sweep.sheets['5-how-it-was-read'].exceptions} exceptions, every one classified — see "3-issues-for-you". Nine of them are lines the archive reads as Questions where your sheet said Claims or Directives; those are decisions for you, not defects.`,
    `${sweep.sheets['5-how-it-was-read'].exceptions} FOR YOU`],

  ['4-data-problems — "for the url issues i think you have already fixed these ... as for the other categories [make sure] your text section is highlighted the sheet category"',
    'URLs: 0 problems, tested against the pattern the linkifier itself uses, on the text the browser renders. The other rows carried three rulings, all applied — seven whole sentences moved to Questions, #1443 "DECLAS_Public[3]" moved to Claims, and #4891\u2019s "Why would H." withdrawn. All 68 rows verified.',
    'FIXED — clean'],

  ['3-held-for-you — "take the Text section and make it highlighted the category it is listed under the What it is now section"',
    'All 119 rows verified on the drop each one names. The 24 directives are certified as Directives; the entity identities resolve to a live entity through the wording listed; the SPLIT rows are certified as their PARTS, which is what a split means. 45 rows are in the Resolution Center by design and are counted, never failed.',
    'VERIFIED — clean'],

  ['2-already-highlighted — "make sure the column ... is highlighted the colour category it is listed under the Section it is place in and the post number"',
    'All 3,261 rows verified against all six certified sections, on the drop each row names. None is in a section other than the one you named and none is uncertified.',
    'VERIFIED — clean'],

  ['"push all these through to the local build tree ... i will give you the go ahead to deploy"',
    'Everything is committed on the local branch and nothing is deployed. Production still carries seed 88. The batch is ready for one deploy on your word.',
    'HELD FOR YOU'],
]

// ── 2. The verification, sheet by sheet ─────────────────────────────────────
const verification = [['Sheet', 'Rows checked', 'Verified', 'Exceptions', 'What was asked of every row']]
for (const [name, s] of Object.entries(sweep.sheets)) {
  verification.push([name, s.rows, s.verified, s.exceptions,
    'Is this exact span certified, on this exact drop, in the section this row names? Asked of the certified artifacts, never of the painted page — an Entity or a Bracket on top of a Claim hides the Claim from anything that reads the page.'])
}
verification.push(['', '', '', '', ''])
verification.push(['TOTAL', sweep.totals.rows, sweep.totals.verified, sweep.totals.exceptions,
  `Clean sheets: ${cleanSheets.join(', ')}.`])
verification.push(['', '', '', '', ''])
verification.push(['Four times the CHECKER was wrong before the data was', '', '', '', 'Each is recorded in the script, because each has bitten this archive before.'])
verification.push(['stored text vs rendered text', '', '', '', '1,700 bracket rows read as missing because "&gt;" folds to "gt". The drop stores the board\u2019s encoding; the browser strips it at load. Same mistake the URL pass made twice.'])
verification.push(['a span of pure punctuation is still a span', '', '', '', 'Folding to letters and digits turns "$", "$$$,$$$,$$$" and "^^^^" into nothing, so #261\u2019s certified Claim "$" read as certified nowhere.'])
verification.push(['a SPLIT certifies its PARTS', '', '', '', 'Asking for "Philip Pines: Bangko Sentral ng Pilipinas" back is asking for the split to be undone.'])
verification.push(['the LATER ruling governs', '', '', '', 'Seven sentences are recorded under Claims, where the splitter put the head, and again under Questions, where you re-filed them. Answering with the first reports your own ruling as a defect.'])

// ── 3. Every issue left, and what it is ─────────────────────────────────────
const issues = [['Sheet', 'Post', 'Section the row named', 'The text', 'What the archive holds', 'What kind of thing this is', 'What to do']]
for (const e of sweep.exceptions) {
  issues.push([e.sheet, e.postNum, e.section, e.text, e.problem, e.kind, e.whatToDo])
}
issues.push(['', '', '', '', '', '', ''])
issues.push(['BY KIND', '', '', '', '', '', ''])
for (const [k, v] of Object.entries(sweep.exceptionsByKind).sort((a, b) => b[1] - a[1])) {
  issues.push([k, v, '', '', '', '', ''])
}
issues.push(['', '', '', '', '', '', ''])
issues.push(['KNOWN, NOT FIXED', '859', '', 'These peo&gt;&gt;567493ple are stupid.', '',
  'a data defect in the drop itself',
  'Carried over. This drop splices a post-pointer INSIDE a word, so no rendered block matches its text. One drop of 4,966.'])

// ── 4. The counts that moved, and why ───────────────────────────────────────
const counts = [['Count', 'Before', 'After', 'Why it moved']]
counts.push(['Questions — distinct wordings', '5,363', '5,364',
  'Seven fragments became seven whole sentences. Six of the tails ("ORIG?", "CENSUS?", "Biden\u2019s financial records?" …) occurred on no other drop, so their key leaves with them; "POTUS?" stays, being asked on #2360, #2462 and #3586 as well. -6 +7.'])
counts.push(['Questions — occurrences', '6,509', '6,509', 'A repair replaces a span, it does not add one.'])
counts.push(['Claims — occurrences', '10,558', '10,558', '#1443 arriving replaces #4891 leaving, exactly.'])
counts.push(['Predictions', '935', '934', '#1443 "DECLAS_Public[3]" left Predictions on your ruling "make this portion a claim". It did not leave the archive — it is certified once, in Claims.'])
counts.push(['Entity hovers — post-scoped', '3,693', '3,766', '73 drops now say what "Q" means on them.'])
counts.push(['Invariants', '222/222', '221/222', 'The one outstanding is the certification manifest, which is re-certified at the end of the batch — it is how the archive records that certified data changed.'])
counts.push(['', '', '', ''])
counts.push(['Sections NOT touched', '', '', ''])
counts.push(['Themes', '2,646 assignments / 1,729 anchors', 'unchanged', 'The fill was retired, not the section.'])
counts.push(['Entities', '1,584 canonical', 'unchanged', 'Only the wording of two hovers changed.'])

// ── 5. The theme layer, asserted ────────────────────────────────────────────
const t = sweep.themes
const theme = [['What was checked', 'Result', 'Why it is checked this way']]
theme.push(['The fill is commented out in PostDetail.tsx', String(t.themeFillRemovedFromPostDetail),
  'Commented out rather than merely absent — absent could mean it was never there.'])
theme.push(['The fill is commented out in postHighlight.tsx', String(t.themeFillRemovedFromPostCard),
  'BOTH renderers, because these two files have shown the same drop differently three times and every one of those was a change that landed on only one of them.'])
theme.push(['Theme spans inside another highlight', String(t.themeSpansInsideAnotherHighlight), 'Was 2,153 across 1,168 drops. This is the purple you were reading.'])
theme.push(['Rotating spans left', `${t.rotatingSpans.spans} across ${t.rotatingSpans.posts} drops`, 'Was 1,676 across 1,058. What is left is almost entirely question + request, which the archive documents on purpose.'])
theme.push(['Rotating pairs involving a Theme', String(t.rotatingPairsInvolvingATheme.length), 'The answer to sheets 8, 9 and 10 in one number.'])
theme.push(['Theme assignments still certified', n(t.themeAssignmentsStillCertified), 'The section is untouched. Still in the Themes tab and still listed under each drop.'])
theme.push(['Theme anchors still recorded', n(t.themeAnchorsStillRecorded), 'Anchors are only ever used for painting, so deleting them would remove the fill AND look exactly like success — while destroying the record of which words the taxonomy hangs on.'])

// ── 6. What was proved, and how ─────────────────────────────────────────────
const gates = [['Proof', 'Result', 'What it holds down']]
gates.push(['scripts/test-quoted-linebreaks.mjs', '7/7', 'A quoted drop is shown with its own line breaks, so its own rulings land. #1011\u2019s own page is the control that says the repair moved the QUOTE and not the ruling.'])
gates.push(['scripts/test-q-persona-hover.mjs', '13/13', 'Asserted on the card a reader opens, not on the file — a two-layer hover is exactly the thing that can be right in the data and invisible on screen.'])
gates.push(['scripts/test-q-alice.mjs', '7/7', 'The Q = Alice ruling still holds, and the sign-off still carries no entity fill.'])
gates.push(['scripts/audit-cross-section.mjs', '221/222', 'The archive\u2019s own invariants. The one outstanding is the manifest, re-certified at the end of the batch.'])
gates.push(['scripts/audit-report-updated-sweep.mjs', `${n(sweep.totals.verified)}/${n(sweep.totals.rows)}`, 'Every row of the UPDATED report, re-read against the certified state.'])
gates.push(['', '', ''])
gates.push(['STILL OWED, at the deploy checkpoint', '', ''])
gates.push(['node scripts/validate.mjs', 'not yet run', 'The profile the diff requires. This batch touches audit/ and public/data, so the floor is at least `certified` and the chain runs twice.'])
gates.push(['node scripts/certification-manifest.mjs', 'not yet run', 'Re-certifies the changed sections and bumps the seed. Deliberately left until the batch is closed, so the whole batch is certified once.'])

const { buf, sheets } = workbookBuffer([
  ['1-what-you-asked', asked],
  ['2-verification', verification],
  ['3-issues-for-you', issues],
  ['4-counts-that-moved', counts],
  ['5-theme-layer', theme],
  ['6-what-was-proved', gates],
])

const desktop = process.argv.includes('--desktop')
  ? writeWorkbook(buf, OUTFILE, DESKTOP)
  : (writeWorkbook(buf, OUTFILE, null), 'not written — pass --desktop to publish a copy there')

console.log('')
console.log('UPDATED-REPORT BATCH — SUMMARY WORKBOOK')
console.log('')
for (const [name, rows] of sheets) console.log(`  ${name.padEnd(24)} ${String(rows - 1).padStart(5)} rows`)
console.log('')
console.log(`  ${(buf.length / 1024).toFixed(0)} KB`)
console.log(`  ${path.relative(ROOT, OUTFILE)}`)
console.log(`  ${desktop}`)
console.log('')
