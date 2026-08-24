// THE OWNER'S RULINGS ON THE UPDATED REPORT, sheet "4-data-problems", 2026-08-24.
//
//   node scripts/build-report-updated-rulings.mjs [--dry]
//
// The owner annotated the Data problems sheet in Q_Unhighlighted FINAL 2 - REPORT (UPDATED).xlsx
// by replacing the generated Problem column with instructions. Two classes came back:
//
//   "this whole sentence should be a question lets fix this"   x7, and
//   "I want the whole sentence to be a question"               #4891
//   "make this portion a claim"                                #1443, on BOTH the Claims and the
//                                                              Predictions row of the same line
//
// THE SEVEN QUESTIONS ARE THE ABBREVIATION DEFECT SEEN FROM THE OTHER END.
//
// audit/abbreviation-span-repairs.json already records each of these seven sentences, with the
// full wording taken from the drop — but under category `claims`, because that is where the
// splitter had put the HEAD. The head is not in Claims any more. What IS certified is the TAIL,
// as a Question: #1944 carries "ORIG?" where Q wrote "'Foreign' tangent req to obtain warrant to
// spy on U.S. ORIG?", #1915 carries "POTUS?", #3049 carries "CENSUS?".
//
// So the record is filed against a section that no longer holds the span. The owner's ruling
// settles the section — Questions — and this re-files the repair there, `truncated` being the
// certified tail rather than a certified head. Same defect, same record, second shape; the
// artifact's `shapes` note says so, because one list with two shapes is safer than two lists.
//
// THE FULL WORDING IS NEVER RETYPED. It is read out of the existing claims-category entry, whose
// own rule took it from the drop, and then re-checked against the drop line here. A ruling that
// cannot be matched to a drop line and a certified tail is refused, not guessed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const RULING = 'this whole sentence should be a question lets fix this / I want the whole sentence to be a question / make this portion a claim'
const SOURCE = 'Q_Unhighlighted FINAL 2 - REPORT (UPDATED).xlsx, sheet 4-data-problems, owner annotations in the Problem column'
const RULED_ON = '2026-08-24'

// The seven the owner marked, as (drop, opening words of the row the owner annotated).
//
// The `lead` is how the ROW is identified, not how the sentence is spelled — #2211 carries two
// question-shaped sentences the abbreviation record already holds, so the drop alone does not say
// which one the owner meant. The full wording is then read out of the DROP LINE that begins with
// it, never out of the workbook, so a transcription slip in a sheet cell cannot rewrite Q's words.
const WHOLE_SENTENCE_IS_A_QUESTION = [
  { postNum: 1944, lead: "'Foreign' tangent req" },
  { postNum: 2211, lead: 'Federal prosecutor in N.' },
  { postNum: 4782, lead: 'FUNDS: EXPENSES V.' },
  { postNum: 4888, lead: 'Subpoena of all H.' },
  { postNum: 3049, lead: "If [D's] FIGHT to protect" },
  { postNum: 1915, lead: 'Same day as the targeted' },
  { postNum: 4871, lead: 'NAT SEC concerns re:' },
]

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const flat = s => String(s ?? '').replace(/\s+/g, ' ').trim()

const ABBREV = path.join(ROOT, 'audit', 'abbreviation-span-repairs.json')
const doc = JSON.parse(fs.readFileSync(ABBREV, 'utf8'))

const added = []
for (const { postNum, lead } of WHOLE_SENTENCE_IS_A_QUESTION) {
  const p = byNum.get(postNum)
  if (!p) { console.error(`#${postNum}: no such drop`); process.exit(1) }

  // Q'S OWN LINE IS THE WORDING. Exactly one line of the drop may begin with the owner's lead.
  const lines = (p.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  const matches = lines.filter(l => norm(l).startsWith(norm(lead)))
  if (matches.length !== 1) {
    console.error(`#${postNum}: ${JSON.stringify(lead)} matches ${matches.length} lines in the drop. Refusing to guess.`)
    process.exit(1)
  }
  const line = matches[0]
  const full = line

  // Cross-check against the record that already holds this sentence under `claims`. The owner's
  // ruling only moves which SECTION it is filed in; if the sentence itself is not the one the
  // 2026-08-21 batch read out of this drop, something else has changed and this must stop.
  const recorded = (doc.repairs ?? []).filter(r => r.postNum === postNum && r.category === 'claims' && norm(r.full) === norm(full))
  if (recorded.length !== 1) {
    console.error(`#${postNum}: ${JSON.stringify(full).slice(0, 60)} is recorded ${recorded.length} times under claims, expected 1. Refusing.`)
    process.exit(1)
  }

  // The certified tail: a question on this drop whose wording ENDS the full sentence and is
  // shorter than it. That is exactly what the splitter left behind.
  const tails = questions
    .filter(q => q.postNum === postNum && q.occurrences !== undefined)
    .map(q => q.unitText ?? q.text)
    .filter(t => norm(t) !== norm(full) && norm(full).endsWith(norm(t)))
  const uniq = [...new Set(tails)]
  if (uniq.length !== 1) {
    console.error(`#${postNum}: expected exactly 1 certified tail of ${JSON.stringify(full).slice(0, 50)}, found ${uniq.length}: ${JSON.stringify(uniq).slice(0, 160)}`)
    process.exit(1)
  }
  const truncated = uniq[0]

  const already = (doc.repairs ?? []).some(r => r.category === 'questions' && r.postNum === postNum && norm(r.truncated) === norm(truncated))
  if (already) { console.log(`  #${postNum} already re-filed — skipping`); continue }

  added.push({
    category: 'questions',
    postNum,
    truncated,
    full,
    dropLine: line,
    // The second shape this record carries. A head repair extends forwards from a span that ENDS
    // in an abbreviation; a tail repair extends BACKWARDS from the fragment the same split left
    // certified. Named on the entry so a reader never has to infer which one they are looking at.
    shape: 'tail',
    appliedOn: RULED_ON,
    provenance: `owner ruling ${RULED_ON} — "${'this whole sentence should be a question lets fix this'}". ${SOURCE}. The sentence was already recorded here under category "claims"; the owner's ruling files it in the section that actually holds the span.`,
  })
}

if (!added.length) { console.log('\nNothing to add — every ruling is already recorded.\n'); process.exit(0) }

doc.repairs.push(...added)
doc.shapes = doc.shapes ?? 'TWO SHAPES, ONE RECORD. A HEAD repair (shape absent, the 2026-08-21 batch) starts at a certified span that ENDS in an abbreviation and extends forward to the sentence end, withdrawing the tail the same splitter certified separately. A TAIL repair (shape: "tail", the owner ruling of 2026-08-24) starts at the FRAGMENT the split left certified and extends BACKWARDS to the start of the sentence; there is no head to withdraw because the section no longer holds one. Both are the same defect and the same applier — lib/abbrevRepairs.mjs replaces `truncated` with `full` either way.'
doc.totals.repairs = doc.repairs.length
doc.totals.byCategory = doc.repairs.reduce((a, r) => ({ ...a, [r.category]: (a[r.category] ?? 0) + 1 }), {})

console.log('\nWHOLE-SENTENCE QUESTION RULINGS -> audit/abbreviation-span-repairs.json\n')
for (const a of added) {
  console.log(`  #${String(a.postNum).padEnd(6)} ${JSON.stringify(a.truncated).slice(0, 44).padEnd(46)} -> ${JSON.stringify(a.full).slice(0, 78)}`)
}
console.log(`\n  questions repairs ${doc.totals.byCategory.questions}  (was ${doc.totals.byCategory.questions - added.length})`)
console.log(`  repairs total     ${doc.totals.repairs}\n`)

if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
fs.writeFileSync(ABBREV, JSON.stringify(doc, null, 2) + '\n')
console.log(`  wrote audit/abbreviation-span-repairs.json\n`)
