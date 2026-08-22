// Formatted Excel review workbook for the unhighlighted-sentence audit. No npm packages: the
// .xlsx is a zip of OOXML parts written by hand, so this runs on a clean checkout.
//
// Six sheets, in the order a reviewer actually needs them:
//   Summary            what the rule is, what was measured, and how big each population is
//   Action Plan        the queue collapsed into the decisions that actually have to be made
//   Distinct Wordings  one row per distinct sentence wording — one ruling settles every copy
//   Unclassified Prose the residue nothing in the archive has dispositioned yet
//   Review Queue       every queued line, Q post number first
//   Category Proposals what was proposed, per category and per bucket, with the counts
//
// When scripts/classify-unhighlighted-residual.mjs has been run, every row also carries a
// PROPOSED category, what the line portrays, and the evidence the proposal was made on — so the
// workbook can be compared column-for-column against an independent reviewer's pass.
//
//   node scripts/audit-unhighlighted-sentences.mjs
//   node scripts/classify-unhighlighted-residual.mjs
//   node scripts/build-unhighlighted-sentence-workbook.mjs
import fs from 'node:fs'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'audit', 'unhighlighted-sentences')
const OUTFILE = path.join(DIR, 'unhighlighted-sentence-review.xlsx')

// Prefer the classified file. Falling back silently would publish a workbook whose proposal
// columns are all blank and look answered-but-empty, so say which one was used.
const CLASSIFIED = path.join(DIR, 'residual-classified.jsonl')
const SOURCE = fs.existsSync(CLASSIFIED) ? CLASSIFIED : path.join(DIR, 'unhighlighted-sentences.jsonl')
const rows = fs.readFileSync(SOURCE, 'utf8')
  .split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
const CLASSIFIED_IN_USE = rows.some(r => r.proposal)
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'))
const P = (r, k) => r.proposal?.[k] ?? ''

// ── OOXML primitives ─────────────────────────────────────────────────────────
const colName = n => { let s = ''; for (n += 1; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s }
const xml = v => String(v ?? '')
  // XML 1.0 forbids most C0 controls, and Excel refuses to open a file that carries one.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function cell(ref, value, style = 0) {
  const s = style ? ` s="${style}"` : ''
  if (value === '' || value === null || value === undefined) return `<c r="${ref}"${s}/>`
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`
  const keep = /^\s|\s$|[\r\n\t]/.test(String(value)) ? ' xml:space="preserve"' : ''
  return `<c r="${ref}"${s} t="inlineStr"><is><t${keep}>${xml(value)}</t></is></c>`
}

// style ids, see styles() below
const S = { header: 1, wrap: 2, centre: 3, pct: 4, plain: 5, amber: 6, red: 7, title: 8, key: 9, blue: 10, review: 11, mono: 12 }

/** A generic grid sheet. `cols` = [header, width, styleId, accessor]. */
function sheet(cols, data, { freezeCols = 0, rowHeight = 42, validations = '' } = {}) {
  const last = colName(cols.length - 1)
  const lastRow = Math.max(1, data.length + 1)
  const x = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<dimension ref="A1:${last}${lastRow}"/>`,
    `<sheetViews><sheetView workbookViewId="0"><pane ${freezeCols ? `xSplit="${freezeCols}" ` : ''}ySplit="1" topLeftCell="${colName(freezeCols)}2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight"/></sheetView></sheetViews>`,
    '<sheetFormatPr defaultRowHeight="15"/><cols>']
  cols.forEach((c, i) => x.push(`<col min="${i + 1}" max="${i + 1}" width="${c[1]}" customWidth="1"/>`))
  x.push('</cols><sheetData><row r="1" ht="34" customHeight="1">')
  cols.forEach((c, i) => x.push(cell(`${colName(i)}1`, c[0], S.header)))
  x.push('</row>')
  data.forEach((r, i) => {
    const n = i + 2
    x.push(`<row r="${n}" ht="${rowHeight}" customHeight="1">`)
    cols.forEach((c, j) => {
      const v = c[3](r)
      const st = typeof c[2] === 'function' ? c[2](r, v) : c[2]
      x.push(cell(`${colName(j)}${n}`, v, st))
    })
    x.push('</row>')
  })
  x.push('</sheetData>', `<autoFilter ref="A1:${last}${lastRow}"/>`, validations,
    '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.3" footer="0.3"/></worksheet>')
  return x.join('')
}

const statusStyle = (_r, v) => v === 'PARTIAL_ONLY' ? S.amber : v === 'UNHIGHLIGHTED' ? S.red : S.centre
const join = a => (a ?? []).join(' | ')
const detail = a => (a ?? []).map(d => `${d.kind}: "${d.text}" [${d.start}-${d.end}]`).join('  ||  ')

// ── Review Queue ─────────────────────────────────────────────────────────────
const QUEUE_COLS = [
  ['Q Post Number', 13, S.centre, r => r.postNumber],
  ['Post', 9, S.centre, r => `#${r.postNumber}`],
  ['Sentence #', 11, S.centre, r => r.sentenceIndex],
  ['Audit ID', 15, S.mono, r => r.auditId],
  ['Triage Bucket', 32, S.centre, r => r.triageBucket],
  ['Complete Canonical Sentence', 72, S.wrap, r => r.sentenceText],
  ['PROPOSED CATEGORY', 30, S.blue, r => P(r, 'category')],
  ['Proposed Subtype', 34, S.blue, r => P(r, 'subtype')],
  ['What This Line Portrays', 60, S.blue, r => P(r, 'portrays')],
  ['Why — evidence for the proposal', 74, S.wrap, r => P(r, 'basis')],
  ['Proposal Confidence', 13, S.centre, r => P(r, 'confidence')],
  ['Action Needed', 46, S.wrap, r => P(r, 'action')],
  ['Post Themes (certified)', 40, S.wrap, r => (r.proposal?.topics ?? []).join(' | ')],
  ['Entities On This Line', 34, S.wrap, r => (r.proposal?.names ?? []).join(' | ')],
  ['Times This Wording Recurs', 13, S.centre, r => r.archiveRepeatCount],
  ['Coverage Status', 22, statusStyle, r => r.coverageStatus],
  ['Painted %', 11, S.pct, r => r.paintedCoverage],
  ['Sentence-Category %', 13, S.pct, r => r.categoryCoverage],
  ['Unpainted Chars', 12, S.centre, r => r.unpaintedNonWhitespaceCharacters],
  ['Total Chars', 11, S.centre, r => r.totalNonWhitespaceCharacters],
  ['Exact Unhighlighted Text', 56, S.wrap, r => r.uncoveredText],
  ['Only Punctuation Left?', 12, S.centre, r => r.uncoveredOnlyPunctuation ? 'YES' : 'NO'],
  ['Highlights Already Painted', 30, S.wrap, r => join(r.paintedLayers)],
  ['Painted Detail / Offsets', 58, S.wrap, r => detail(r.paintedDetail)],
  ['Certified But Not Painted', 34, S.wrap, r => join(r.certifiedNotPaintedLayers)],
  ['Certified-Unpainted Detail', 58, S.wrap, r => detail(r.certifiedNotPaintedDetail)],
  ['Quoted / Source Material?', 14, S.centre, r => r.quotedSource ? 'YES' : 'NO'],
  ['Quoted Source Reason', 26, S.wrap, r => r.quotedSourceReason ?? ''],
  ['Sentence Form', 24, S.centre, r => r.form],
  ['Segmentation Confidence', 13, S.centre, r => r.segConfidence],
  ['Routing Hint (non-binding)', 28, S.centre, r => r.routingHint],
  ['Why That Hint', 52, S.wrap, r => r.routingHintWhy],
  ['Context Before', 46, S.wrap, r => r.contextBefore],
  ['Context After', 46, S.wrap, r => r.contextAfter],
  ['Start', 8, S.centre, r => r.sentenceStart],
  ['End', 8, S.centre, r => r.sentenceEnd],
  ['FINAL CATEGORY', 28, S.review, () => ''],
  ['Subtype', 22, S.review, () => ''],
  ['Explanation / Why', 60, S.review, () => ''],
  ['Confidence', 13, S.review, () => ''],
  ['Q-Authored?', 13, S.review, () => ''],
  ['Quoted Source Type', 24, S.review, () => ''],
  ['Needs New Category?', 15, S.review, () => ''],
  ['Proposed New Category', 30, S.review, () => ''],
  ['Review Status', 20, S.review, () => ''],
  ['GPT CATEGORY (paste here)', 30, S.amber, () => ''],
  ['GPT Note', 46, S.amber, () => ''],
  ['GPT agrees with proposal?', 15, S.amber, () => ''],
]
// The eight live sections in src/lib/sectionInfo.ts, plus the dispositions that are honest
// answers rather than categories. Emphasis, Implied Conclusions and Checkable Claims are gone
// from this list because they are retired — offering them would invite a ruling that cannot be
// applied. Retired 2026-08-21; see NEXT-SESSION-HANDOFF.md.
const CATEGORIES = 'Q_QUESTION,Q_DIRECTIVE,Q_CLAIM,Q_PREDICTION,Q_EVIDENCE_REFERENCE,Q_ENTITY,Q_THEME,Q_CODE_BRACKET,SIGNATURE_SIGNOFF,QUOTED_SOURCE,SEGMENTATION_ERROR,SPAN_BOUNDARY_FIX,CONTEXT_NO_CATEGORY,NEEDS_CONTEXT,PROPOSE_NEW'
function validationsFor(count, firstReviewCol) {
  const end = Math.max(2, count + 1)
  const at = i => colName(firstReviewCol + i)
  return '<dataValidations count="7">'
    + `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${at(0)}2:${at(0)}${end}"><formula1>"${CATEGORIES}"</formula1></dataValidation>`
    + `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${at(3)}2:${at(3)}${end}"><formula1>"HIGH,MEDIUM,LOW"</formula1></dataValidation>`
    + `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${at(4)}2:${at(4)}${end}"><formula1>"YES,NO,MIXED"</formula1></dataValidation>`
    + `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${at(6)}2:${at(6)}${end}"><formula1>"YES,NO"</formula1></dataValidation>`
    + `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${at(8)}2:${at(8)}${end}"><formula1>"UNREVIEWED,REVIEWED,NEEDS_CONTEXT,HOLD"</formula1></dataValidation>`
    + `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${at(9)}2:${at(9)}${end}"><formula1>"${CATEGORIES}"</formula1></dataValidation>`
    + `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${at(11)}2:${at(11)}${end}"><formula1>"AGREE,DISAGREE,PARTIAL"</formula1></dataValidation>`
    + '</dataValidations>'
}

// ── Distinct Wordings — one ruling per wording, not per row ──────────────────
const byWording = new Map()
for (const r of rows) {
  let g = byWording.get(r.normalizedText)
  if (!g) { g = { key: r.normalizedText, rows: [], posts: new Set(), buckets: new Set(), hints: new Set() }; byWording.set(r.normalizedText, g) }
  g.rows.push(r); g.posts.add(r.postNumber); g.buckets.add(r.triageBucket); g.hints.add(r.routingHint)
}
const wordings = [...byWording.values()].map(g => {
  const first = g.rows[0]
  return {
    example: first.sentenceText,
    occurrences: g.rows.length,
    posts: [...g.posts].sort((a, b) => a - b),
    buckets: [...g.buckets].sort(),
    hints: [...g.hints].sort(),
    statuses: [...new Set(g.rows.map(r => r.coverageStatus))].sort(),
    forms: [...new Set(g.rows.map(r => r.form))].sort(),
    certified: [...new Set(g.rows.flatMap(r => r.certifiedNotPaintedLayers))].sort(),
    painted: [...new Set(g.rows.flatMap(r => r.paintedLayers))].sort(),
    quoted: g.rows.some(r => r.quotedSource),
    context: first.contextBefore,
    categories: [...new Set(g.rows.map(r => P(r, 'category')).filter(Boolean))].sort(),
    subtypes: [...new Set(g.rows.map(r => P(r, 'subtype')).filter(Boolean))].sort(),
    confidences: [...new Set(g.rows.map(r => P(r, 'confidence')).filter(Boolean))].sort(),
    actions: [...new Set(g.rows.map(r => P(r, 'action')).filter(Boolean))].sort(),
    portrays: P(first, 'portrays'),
    basis: P(first, 'basis'),
  }
}).sort((a, b) => b.occurrences - a.occurrences || a.example.localeCompare(b.example))

const WORDING_COLS = [
  ['Occurrences', 12, S.centre, w => w.occurrences],
  ['Distinct Posts', 12, S.centre, w => w.posts.length],
  ['Sentence Wording', 78, S.wrap, w => w.example],
  ['PROPOSED CATEGORY', 30, S.blue, w => w.categories.join(' | ')],
  ['Proposed Subtype', 34, S.blue, w => w.subtypes.join(' | ')],
  ['What This Line Portrays', 60, S.blue, w => w.portrays],
  ['Why — evidence for the proposal', 74, S.wrap, w => w.basis],
  ['Proposal Confidence', 13, S.centre, w => w.confidences.join(' | ')],
  ['Action Needed', 46, S.wrap, w => w.actions.join(' | ')],
  ['Triage Bucket(s)', 34, S.wrap, w => w.buckets.join(' | ')],
  ['Coverage Status', 24, S.centre, w => w.statuses.join(' | ')],
  ['Form', 24, S.centre, w => w.forms.join(' | ')],
  ['Already Painted', 28, S.wrap, w => w.painted.join(' | ')],
  ['Certified But Not Painted', 32, S.wrap, w => w.certified.join(' | ')],
  ['Quoted / Source?', 13, S.centre, w => w.quoted ? 'YES' : 'NO'],
  ['Routing Hint', 28, S.centre, w => w.hints.join(' | ')],
  ['First 25 Post Numbers', 46, S.wrap, w => w.posts.slice(0, 25).map(n => `#${n}`).join(' ') + (w.posts.length > 25 ? ` … +${w.posts.length - 25}` : '')],
  ['FINAL CATEGORY', 28, S.review, () => ''],
  ['Subtype', 22, S.review, () => ''],
  ['Explanation / Why', 60, S.review, () => ''],
  ['Confidence', 13, S.review, () => ''],
  ['Q-Authored?', 13, S.review, () => ''],
  ['Quoted Source Type', 24, S.review, () => ''],
  ['Needs New Category?', 15, S.review, () => ''],
  ['Proposed New Category', 30, S.review, () => ''],
  ['Review Status', 20, S.review, () => ''],
  ['GPT CATEGORY (paste here)', 30, S.amber, () => ''],
  ['GPT Note', 46, S.amber, () => ''],
  ['GPT agrees with proposal?', 15, S.amber, () => ''],
]

// ── Action Plan — the queue collapsed into decisions ─────────────────────────
// 10,648 rows is not a to-do list. Grouped by what has to be DECIDED and where it lands, it is
// a page: a handful of blanket policies, one span-boundary sweep, and the real classification
// residue at the bottom.
function group(keyFn) {
  const m = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (!k) continue
    let g = m.get(k)
    if (!g) { g = { key: k, rows: 0, wordings: new Set(), posts: new Set(), example: r.sentenceText }; m.set(k, g) }
    g.rows++; g.wordings.add(r.normalizedText); g.posts.add(r.postNumber)
  }
  return [...m.values()].sort((a, b) => b.rows - a.rows)
}
const ACTION_ORDER = { 'POLICY RULING': 1, 'PAINT POLICY': 2, 'SPAN BOUNDARY FIX': 3, 'CLASSIFY': 4 }
const planRows = group(r => `${P(r, 'action')}||${P(r, 'category')}`)
  .map(g => {
    const [action, category] = g.key.split('||')
    return { action, category, ...g }
  })
  .sort((a, b) => (ACTION_ORDER[a.action.split(' —')[0]] ?? 9) - (ACTION_ORDER[b.action.split(' —')[0]] ?? 9)
    || b.rows - a.rows)
const PLAN_COLS = [
  ['Action Needed', 52, S.wrap, g => g.action],
  ['Proposed Category', 32, S.blue, g => g.category],
  ['Lines', 10, S.centre, g => g.rows],
  ['Distinct Wordings', 12, S.centre, g => g.wordings.size],
  ['Posts Affected', 12, S.centre, g => g.posts.size],
  ['Example Line', 70, S.wrap, g => g.example],
  ['OWNER DECISION', 34, S.review, () => ''],
  ['Notes', 60, S.review, () => ''],
]

// ── Category Proposals — every proposal shape, with its size ─────────────────
const proposalRows = group(r => `${P(r, 'category')}||${P(r, 'subtype')}||${r.triageBucket}`)
  .map(g => {
    const [category, subtype, bucket] = g.key.split('||')
    return { category, subtype, bucket, ...g }
  })
  .sort((a, b) => a.category.localeCompare(b.category) || b.rows - a.rows)
const PROPOSAL_COLS = [
  ['Proposed Category', 32, S.blue, g => g.category],
  ['Proposed Subtype', 40, S.wrap, g => g.subtype],
  ['Triage Bucket', 32, S.centre, g => g.bucket],
  ['Lines', 10, S.centre, g => g.rows],
  ['Distinct Wordings', 12, S.centre, g => g.wordings.size],
  ['Posts Affected', 12, S.centre, g => g.posts.size],
  ['Example Line', 70, S.wrap, g => g.example],
  ['OWNER DECISION', 34, S.review, () => ''],
  ['GPT CATEGORY (paste here)', 32, S.amber, () => ''],
]

// ── Summary ──────────────────────────────────────────────────────────────────
const c = manifest.counts
const BUCKET_MEANING = {
  A_SIGNATURE: "Q's sign-off line (Q, Q+, WWG1WGA). One blanket ruling settles every occurrence.",
  B_LINK_OR_REFERENCE: 'The unit is a bare URL, board pointer or file reference. Already a link; decide whether Link/Citation is a category.',
  C_PUNCTUATION_ONLY: 'Everything but a period, bracket or quote mark is already painted. A span-boundary fix, not a classification.',
  D_INLINE_ONLY_FULLY_PAINTED: '100% painted, but only by inline layers (entity, bracket, theme anchor, link). No sentence-level category owns it.',
  E_CERTIFIED_QUOTED_SOURCE: 'The archive has already certified this text as quoted / source material, not Q-authored prose.',
  F_CERTIFIED_EMPHASIS_NOT_PAINTED: 'Certified Emphasis. Owner ruling 2026-08-17 removed the Emphasis fill from the drop body; the data is untouched.',
  G_CERTIFIED_CONTEXT_NOT_PAINTED: 'Certified contextUnit — reviewed and deliberately in no semantic category. Owner ruling 2026-08-17 removed the grey fill.',
  H_CERTIFIED_CODE_NOT_PAINTED: 'Certified Code occurrence. The bracket layer paints brackets; a non-bracketed code has no fill.',
  I_CERTIFIED_EVIDENCE_NOT_PAINTED: 'Certified Evidence (link / internal reference) whose span is not a painted layer.',
  J_UNCLASSIFIED_PROSE: 'The residue. Nothing in the archive has dispositioned this text. THIS IS THE REAL WORK.',
}
const summaryRows = [
  ['Q Drops — Unhighlighted Sentence Review', ''],
  ['Generated', manifest.generatedAt],
  ['Status', manifest.status],
  ['', ''],
  ['THE LOCKED RULE', manifest.rule],
  ['Emphasis', 'Never counts as coverage. Owner ruling 2026-08-17 removed its fill from the drop body; the certified layer is untouched.'],
  ['Inline highlights', 'A highlighted name, bracket, theme anchor or link never speaks for the sentence around it.'],
  ['', ''],
  ['Canonical posts', c.posts],
  ['Posts carrying body text', c.postsWithText],
  ['Q-authored units segmented', c.units],
  ['Fully painted, excluded', c.fullyPainted],
  ['QUEUED FOR REVIEW', c.queued],
  ['  …across posts', c.postsInQueue],
  ['  …distinct wordings', c.distinctSentenceTexts],
  ['', ''],
  ['Completely unhighlighted', c.unhighlighted],
  ['Partially highlighted', c.partialOnly],
  ['Inline-only, fully painted', c.inlineOnlyFullyPainted],
  ['Punctuation-only leftover', c.punctuationOnlyUncovered],
  ['Already certified but unpainted', c.alreadyCertifiedUnpainted],
  ['Quoted / source material', c.quotedSource],
  ['Never dispositioned by anything', c.trulyUnclassified],
  ['', ''],
  ['TRIAGE BUCKETS', 'rows / distinct wordings — what each one means'],
  ...Object.keys(c.byTriageBucket).sort().map(k =>
    [`${k}   ${c.byTriageBucket[k]} / ${c.distinctTextsByTriageBucket[k]}`, BUCKET_MEANING[k] ?? '']),
  ['', ''],
  ['PROPOSED CATEGORIES', CLASSIFIED_IN_USE
    ? 'Every queued line carries a proposal, the evidence it rests on, and what has to be decided. Nothing is applied.'
    : 'NOT RUN — re-run scripts/classify-unhighlighted-residual.mjs, the proposal columns are empty.'],
  ...group(r => P(r, 'category')).map(g => [`  ${g.key}`, `${g.rows} lines · ${g.wordings.size} distinct wordings · ${g.posts.size} posts`]),
  ['', ''],
  ['WHAT HAS TO BE DECIDED', 'see the Action Plan sheet'],
  ...group(r => P(r, 'action')).map(g => [`  ${g.key}`, `${g.rows} lines · ${g.wordings.size} distinct wordings · ${g.posts.size} posts`]),
  ['', ''],
  ['Canonical source', manifest.sources.postsFile],
  ['Source SHA-256', manifest.sources.postsSha256],
  ['Coordinate system', manifest.sources.coordinateSystem],
  ['Segmenter', manifest.sources.segmenter],
  ['Layers counted as painted', manifest.sources.paintedLayers.join(' · ')],
  ['Layers that can own a sentence', manifest.sources.sentenceLevelLayers.join(' · ')],
  ['Certified but never painted', manifest.sources.certifiedButUnpaintedLayers.join(' · ')],
  ['Not painted by owner ruling', manifest.sources.notPaintedByOwnerRuling.join(' · ')],
  ['', ''],
  ['Safety', 'READ-ONLY · nothing classified · no rebuild · no deploy · Emphasis not restored'],
]
function summarySheet() {
  const x = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<dimension ref="A1:B${summaryRows.length}"/>`,
    '<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
    '<sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="46" customWidth="1"/><col min="2" max="2" width="118" customWidth="1"/></cols><sheetData>']
  summaryRows.forEach((r, i) => {
    const n = i + 1, title = i === 0
    const num = typeof r[1] === 'number'
    x.push(`<row r="${n}" ht="${title ? 32 : 24}" customHeight="1">`,
      cell(`A${n}`, r[0], title ? S.title : S.key),
      cell(`B${n}`, r[1], title ? S.title : num ? S.centre : S.wrap), '</row>')
  })
  x.push('</sheetData><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/></worksheet>')
  return x.join('')
}

function styles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Aptos"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos Display"/></font><font><b/><color rgb="FF17365D"/><sz val="15"/><name val="Aptos Display"/></font><font><sz val="9"/><name val="Consolas"/></font></fonts>
<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDF6EC"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E1F2"/></left><right style="thin"><color rgb="FFD9E1F2"/></right><top style="thin"><color rgb="FFD9E1F2"/></top><bottom style="thin"><color rgb="FFD9E1F2"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`
}

// ── zip ──────────────────────────────────────────────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c2 = n; for (let k = 0; k < 8; k++) c2 = (c2 & 1) ? (0xEDB88320 ^ (c2 >>> 1)) : (c2 >>> 1); t[n] = c2 >>> 0 } return t })()
const crc32 = b => { let c2 = 0xFFFFFFFF; for (const x of b) c2 = CRC[(c2 ^ x) & 255] ^ (c2 >>> 8); return (c2 ^ 0xFFFFFFFF) >>> 0 }
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
const prose = rows.filter(r => r.triageBucket === 'J_UNCLASSIFIED_PROSE')
// The review block starts right after the last derived column, so both offsets are computed
// rather than typed — adding a column used to silently point the dropdowns at the wrong cells.
const firstReview = cols => cols.findIndex(c => c[0] === 'FINAL CATEGORY')
const SHEETS = [
  ['Summary', summarySheet()],
  ['Action Plan', sheet(PLAN_COLS, planRows, { freezeCols: 2, rowHeight: 46 })],
  ['Distinct Wordings', sheet(WORDING_COLS, wordings, { freezeCols: 3, rowHeight: 40, validations: validationsFor(wordings.length, firstReview(WORDING_COLS)) })],
  ['Unclassified Prose', sheet(QUEUE_COLS, prose, { freezeCols: 6, validations: validationsFor(prose.length, firstReview(QUEUE_COLS)) })],
  ['Review Queue', sheet(QUEUE_COLS, rows, { freezeCols: 6, validations: validationsFor(rows.length, firstReview(QUEUE_COLS)) })],
  ['Category Proposals', sheet(PROPOSAL_COLS, proposalRows, { freezeCols: 2, rowHeight: 40 })],
]
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

fs.writeFileSync(OUTFILE, zip([
  { name: '[Content_Types].xml', data: types },
  { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
  { name: 'xl/workbook.xml', data: workbook },
  { name: 'xl/_rels/workbook.xml.rels', data: rels },
  { name: 'xl/styles.xml', data: styles() },
  ...SHEETS.map(([, data], i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data })),
]))

console.log(`\nWorkbook written: ${path.relative(ROOT, OUTFILE)}`)
console.log(`  Distinct Wordings  : ${wordings.length.toLocaleString()} rows`)
console.log(`  Unclassified Prose : ${prose.length.toLocaleString()} rows`)
console.log(`  Review Queue       : ${rows.length.toLocaleString()} rows`)
console.log(`  size               : ${(fs.statSync(OUTFILE).size / 1024 / 1024).toFixed(1)} MB\n`)
