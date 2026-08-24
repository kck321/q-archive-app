// WRITING AN .xlsx BY HAND, AND READING A CSV BACK.
//
// This repo has no spreadsheet dependency and adding one to publish a report would be the wrong
// trade, so the workbook is written as OOXML in a zip. That code lived inside
// pack-review2-report.mjs, which was fine while it packed the only workbook. It does not any more
// — scripts/pack-report-updated-summary.mjs packs a second one — and a second COPY of a writer is
// the failure lib/queueRulings.mjs and lib/step3b1Sets.mjs both record: one copy goes short, and
// nothing fails loudly when it does. A workbook that opens is not proof the other one still does.
//
// Deliberately simple, and unchanged from the version that produced the review-2 report: one
// header style, wrapped text, a frozen header row, and nothing else.
import fs from 'node:fs'
import { deflateRawSync } from 'node:zlib'

// ── CSV in ───────────────────────────────────────────────────────────────────
// The same quoting build-review2-report.mjs writes: doubled quotes inside quoted fields, and a
// field is quoted only when it has to be.
export function parseCsv(text) {
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
export const xml = s => String(s ?? '')
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

export function sheetXml(rows) {
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

export const styles = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
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
export function zip(entries) {
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


/**
 * A whole workbook, from `[sheetName, rows[][]]` pairs, as a Buffer ready to write.
 *
 * The caller owns the sheet ORDER and the sheet NAMES; Excel refuses a name over 31 characters or
 * containing : \ / ? * [ ], so they are cleaned here rather than in each caller.
 */
export function workbookBuffer(sheets) {
  const clean = n => String(n).replace(/[:\/?*[\]]/g, '-').slice(0, 31)
  const built = sheets.map(([name, rows]) => [clean(name), sheetXml(rows), rows.length])
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'
    + built.map(([n], i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets></workbook>'
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + built.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${built.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + built.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>'
  const buf = zip([
    { name: '[Content_Types].xml', data: types },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: rels },
    { name: 'xl/styles.xml', data: styles() },
    ...built.map(([, data], i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data })),
  ])
  return { buf, sheets: built.map(([n, , rows]) => [n, rows]) }
}

/**
 * Write the workbook where the owner will look for it.
 *
 * EBUSY IS NOT A MISSING DESKTOP. It means the previous copy is OPEN IN EXCEL, so the owner would
 * be reading the old numbers believing they were the new ones. Falling back to a second filename
 * is better than either failing the run or silently leaving the stale file in place — and the
 * caller is told which name was used, so it can say so.
 */
export function writeWorkbook(buf, primary, desktop) {
  fs.writeFileSync(primary, buf)
  if (!desktop) return 'skipped'
  try { fs.writeFileSync(desktop, buf); return desktop } catch (e) {
    if (e.code !== 'EBUSY' && e.code !== 'EPERM') return `could not write (${e.code})`
    const alt = desktop.replace(/\.xlsx$/, ' (UPDATED).xlsx')
    try { fs.writeFileSync(alt, buf); return `${alt}   <- the original is open in Excel; close it and this one replaces it` }
    catch (e2) { return `could not write either name (${e.code} / ${e2.code})` }
  }
}
