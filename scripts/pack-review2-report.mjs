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
import { deflateRawSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'audit/unhighlighted-sentences/review2-report')
const OUTFILE = path.join(ROOT, 'audit/unhighlighted-sentences/Q_Unhighlighted_FINAL_2_REPORT.xlsx')
const DESKTOP = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Q_Unhighlighted FINAL 2 - REPORT.xlsx'

// ── CSV in ───────────────────────────────────────────────────────────────────
// The same quoting build-review2-report.mjs writes: doubled quotes inside quoted fields, and a
// field is quoted only when it has to be.
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
      continue
    }
    if (c === '"') { inQ = true; continue }
    if (c === ',') { row.push(field); field = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ── OOXML out ────────────────────────────────────────────────────────────────
const xml = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // A control character is legal in a CSV field and illegal in XML, and Excel reports the whole
  // file as corrupt rather than naming the cell.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

const colName = n => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}

/** A whole number is written as a number so it sorts and totals; everything else is inline text. */
const cell = (ref, v, style) => {
  const s = String(v ?? '')
  const sAttr = style ? ` s="${style}"` : ''
  if (s !== '' && /^-?\d{1,15}$/.test(s)) return `<c r="${ref}"${sAttr}><v>${s}</v></c>`
  if (s === '') return `<c r="${ref}"${sAttr}/>`
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xml(s)}</t></is></c>`
}

function sheetXml(rows) {
  const widths = []
  for (const r of rows) r.forEach((v, i) => {
    widths[i] = Math.min(90, Math.max(widths[i] ?? 10, Math.min(90, String(v ?? '').length + 2)))
  })
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const body = rows.map((r, ri) =>
    `<row r="${ri + 1}"${ri === 0 ? ' ht="28" customHeight="1"' : ''}>`
    + r.map((v, ci) => cell(`${colName(ci + 1)}${ri + 1}`, v, ri === 0 ? 1 : 2)).join('')
    + '</row>').join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`
}

const styles = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
  + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

// ── zip ──────────────────────────────────────────────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0 } return t })()
const crc32 = b => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
function zip(entries) {
  const d = new Date()
  const dt = { date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2) }
  const local = [], central = []
  let offset = 0
  for (const e of entries) {
    const name = Buffer.from(e.name), data = Buffer.from(e.data), z = deflateRawSync(data, { level: 6 }), crc = crc32(data)
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034B50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(8, 8)
    h.writeUInt16LE(dt.time, 10); h.writeUInt16LE(dt.date, 12); h.writeUInt32LE(crc, 14)
    h.writeUInt32LE(z.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26)
    local.push(h, name, z)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014B50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x800, 8)
    cd.writeUInt16LE(8, 10); cd.writeUInt16LE(dt.time, 12); cd.writeUInt16LE(dt.date, 14); cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(z.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42)
    central.push(cd, name)
    offset += 30 + name.length + z.length
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, dir, end])
}

// ── build ────────────────────────────────────────────────────────────────────
// Sorted by the numeric prefix, not lexically: "10-followup-checks" sorts before "2-already" as a
// string, which would put the last sheet second.
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.csv'))
  .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0))
if (!files.length) { console.error('no CSVs in ' + DIR + ' — run scripts/build-review2-report.mjs first'); process.exit(1) }

// Excel refuses a sheet name over 31 characters or containing : \ / ? * [ ]
const sheetName = f => f.replace(/\.csv$/, '').replace(/[:\\/?*[\]]/g, '-').slice(0, 31)

const SHEETS = files.map(f => {
  const rows = parseCsv(fs.readFileSync(path.join(DIR, f), 'utf8'))
  return [sheetName(f), sheetXml(rows), rows.length]
})

const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'
  + SHEETS.map(([n], i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
  + '</sheets></workbook>'
const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + SHEETS.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
  + `<Relationship Id="rId${SHEETS.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
  + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  + SHEETS.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  + '</Types>'

const buf = zip([
  { name: '[Content_Types].xml', data: types },
  { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
  { name: 'xl/workbook.xml', data: workbook },
  { name: 'xl/_rels/workbook.xml.rels', data: rels },
  { name: 'xl/styles.xml', data: styles() },
  ...SHEETS.map(([, data], i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data })),
])
fs.writeFileSync(OUTFILE, buf)

// The Desktop copy is a convenience, not the artifact — a missing Desktop is not a failure.
// The Desktop copy is a convenience, not the artifact - a missing Desktop is not a failure. But
// EBUSY is: it means the previous report is OPEN IN EXCEL, so the owner would look at the old
// numbers believing they were the new ones. Falling back to a second filename is better than
// either failing the run or silently leaving the stale file in place.
let desktop = 'skipped'
try {
  fs.writeFileSync(DESKTOP, buf)
  desktop = DESKTOP
} catch (e) {
  if (e.code !== 'EBUSY' && e.code !== 'EPERM') { desktop = `could not write (${e.code})` }
  else {
    const alt = DESKTOP.replace(/\.xlsx$/, ' (UPDATED).xlsx')
    try { fs.writeFileSync(alt, buf); desktop = `${alt}   <- the original is open in Excel; close it and this one replaces it` }
    catch (e2) { desktop = `could not write either name (${e.code} / ${e2.code})` }
  }
}

console.log('')
console.log('REVIEW 2 REPORT — WORKBOOK')
console.log('')
for (const [name, , rows] of SHEETS) console.log(`  ${name.padEnd(26)} ${String(rows - 1).padStart(6)} rows`)
console.log('')
console.log(`  ${(buf.length / 1024).toFixed(0)} KB`)
console.log(`  ${path.relative(ROOT, OUTFILE)}`)
console.log(`  ${desktop}`)
console.log('')
