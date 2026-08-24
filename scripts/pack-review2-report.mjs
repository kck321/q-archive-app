// THE REPORT CSVs, PACKED INTO ONE WORKBOOK.
//
//   audit/unhighlighted-sentences/review2-report/*.csv
//     -> audit/unhighlighted-sentences/Q_Unhighlighted_FINAL_2_REPORT.xlsx
//     -> the Desktop, as "Q_Unhighlighted FINAL 2 - REPORT.xlsx"
//
// build-review2-report.mjs writes the sheets as CSVs, because this repo has no spreadsheet
// dependency and adding one to publish a report would be the wrong trade. The FIRST time this
// workbook was produced, the packing was done by hand in a throwaway script that no longer exists
// — so the .xlsx on the Desktop could not be regenerated from the repo, which makes it a document
// rather than an artifact. This is that step, written down.
//
// .xlsx is a zip of OOXML parts, written by hand here for the same reason. The zip and the styles
// are the ones build-unhighlighted-sentence-workbook.mjs already uses, deliberately kept simple:
// one header style, wrapped text, frozen header row, and nothing else.
//
//   node scripts/pack-review2-report.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// The OOXML writer and the CSV reader moved to lib/ when a SECOND workbook needed them —
// scripts/pack-report-updated-summary.mjs. See the note at the top of that file for why a second
// copy was not the answer.
import { parseCsv, workbookBuffer, writeWorkbook } from './lib/xlsx.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'audit/unhighlighted-sentences/review2-report')
const OUTFILE = path.join(ROOT, 'audit/unhighlighted-sentences/Q_Unhighlighted_FINAL_2_REPORT.xlsx')
const DESKTOP = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Q_Unhighlighted FINAL 2 - REPORT.xlsx'

// ── build ────────────────────────────────────────────────────────────────────
// Sorted by the numeric prefix, not lexically: "10-followup-checks" sorts before "2-already" as a
// string, which would put the last sheet second.
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.csv'))
  .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0))
if (!files.length) { console.error('no CSVs in ' + DIR + ' — run scripts/build-review2-report.mjs first'); process.exit(1) }

// Excel refuses a sheet name over 31 characters or containing : \ / ? * [ ]
const sheetName = f => f.replace(/\.csv$/, '').replace(/[:\\/?*[\]]/g, '-').slice(0, 31)

const { buf, sheets: built } = workbookBuffer(files.map(f =>
  [sheetName(f), parseCsv(fs.readFileSync(path.join(DIR, f), 'utf8'))]))
// THE DESKTOP COPY IS OPT-IN NOW. This step used to write it on every run, and on 2026-08-24 a
// run made only to verify a refactor replaced the report the owner was reading from — a file they
// had annotated by hand, and had just asked not to be overwritten. The artifact under audit/ is
// the deliverable; putting a copy on someone's Desktop is a publishing act and should be asked for.
//
//   node scripts/pack-review2-report.mjs --desktop
const desktop = process.argv.includes('--desktop')
  ? writeWorkbook(buf, OUTFILE, DESKTOP)
  : (writeWorkbook(buf, OUTFILE, null), 'not written — pass --desktop to publish a copy there')

console.log('')
console.log('REVIEW 2 REPORT — WORKBOOK')
console.log('')
for (const [name, rows] of built) console.log(`  ${name.padEnd(26)} ${String(rows - 1).padStart(6)} rows`)
console.log('')
console.log(`  ${(buf.length / 1024).toFixed(0)} KB`)
console.log(`  ${path.relative(ROOT, OUTFILE)}`)
console.log(`  ${desktop}`)
console.log('')
