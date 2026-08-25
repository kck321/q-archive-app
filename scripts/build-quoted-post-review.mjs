// THE QUOTED POSTS THE ARCHIVE DOES NOT HOLD AS DROPS, AND WHAT THEIR SENTENCES ARE.
//
//   -> audit/quoted-post-review.json
//   -> audit/quoted-post-review/Q_Quoted_Posts_Review_2026-08-24.xlsx
//   -> the Desktop, as "Q Quoted Posts - REVIEW 2026-08-24.xlsx"   (--desktop)
//
//   node scripts/build-quoted-post-review.mjs [--desktop]
//
//   "can you give me an excile file with all the post that aren't q post and have writting in them
//    that we need to classify the sentence structures … with your rullings on all the sentences
//    within the post that arnen't highlighted"
//
// WHAT THIS POPULATION IS. A drop's ">>NNNNNNN" pointers are rendered as quoted blocks, and 1,320
// of the 2,785 resolve to a drop the archive holds — those are marked up from that drop's own
// certified analysis and are already highlighted. 1,077 do not resolve and still have writing in
// them. Nothing in the archive classifies a single line of those.
//
// WHY THEY ARE NOT SIMPLY CERTIFIED. Invariant 9: quoted text feeds SEARCH ONLY, never the analysis
// index, because 52% of it is anon words. Certifying an anon's question as a Q Question is the one
// thing that rule exists to prevent — so this file RULES rather than applies, and the owner decides
// what becomes certified.
//
// THE READING IS THE ARCHIVE'S OWN, NOT A NEW ONE. Question form comes from the same rule the
// certified questions use; the directive test is lib/imperative.mjs, the detector that produced the
// certified 2,552. A line this cannot place is left blank rather than guessed at.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { imperativeMood, familyOf } from './lib/imperative.mjs'
import { workbookBuffer, writeWorkbook } from './lib/xlsx.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTDIR = path.join(ROOT, 'audit/quoted-post-review')
const XLSX = path.join(OUTDIR, 'Q_Quoted_Posts_Review_2026-08-24.xlsx')
const DESKTOP = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Q Quoted Posts - REVIEW 2026-08-24.xlsx'

const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const runtime = t => String(t || '').replace(MARKUP, '')
  .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')

// board post id -> the drop we hold, from the anchor on each drop's source link
const idx = new Map()
for (const p of posts) { const m = (p.link ?? '').match(/#(\d+)\s*$/); if (m) idx.set(m[1], p) }

/** The sign-off, the same pattern lib/units.mjs uses. */
const SIGNOFF = /^(?:q\+?|q\s*!\S*|wwg1wga|ncswic|wrwy)[.!?]*$/i
/** A bare pointer line — structure, not writing. */
const POINTER = /^>>\d+$/
/** A board header the scrape sometimes keeps: "Apr 12 2018 00:36:28 (EST) Q !xowAT4Z3VQ ID: …" */
const HEADER = /^[A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2}.*ID:/

// ── collect ─────────────────────────────────────────────────────────────────
const byBoard = new Map()
for (const p of posts) {
  for (const q of p.quotedPosts ?? []) {
    if (idx.has(String(q.boardId))) continue          // already marked up from its own drop
    const text = runtime(q.text).trim()
    if (!text) continue
    const cur = byBoard.get(q.boardId)
    if (cur) { cur.quotedOn.add(p.postNum); continue }
    byBoard.set(q.boardId, { boardId: q.boardId, name: q.name ?? 'Anonymous', trip: q.trip ?? '', time: q.time ?? '', text, quotedOn: new Set([p.postNum]) })
  }
}

// ── who wrote it ────────────────────────────────────────────────────────────
// The scrape recorded almost all of these as "Anonymous ID: 000000", so the NAME is not evidence.
// What is: a tripcode, or a body that closes with the sign-off. #4957 quotes a block that ends "Q"
// and reads exactly like a drop; #4965 quotes an anon asking "Q & A ?".
for (const o of byBoard.values()) {
  const lines = o.text.split('\n').map(l => l.trim())
  o.body = lines.filter(l => l && !POINTER.test(l) && !HEADER.test(l))
  const last = o.body[o.body.length - 1]
  o.looksLikeQ = o.name === 'Q' || Boolean(o.trip) || (Boolean(last) && SIGNOFF.test(last))
  o.why = o.trip ? 'carries a tripcode'
    : o.name === 'Q' ? 'the board recorded the name as Q'
    : o.looksLikeQ ? 'closes with the sign-off'
    : 'no tripcode, no sign-off — reads as an anon'
}

// ── the reading ─────────────────────────────────────────────────────────────
// EVERY RULE HERE IS THE ARCHIVE'S OWN. Nothing new is invented for this file: if the corpus would
// not classify a line, it is left blank and says so.
const QUESTION_MARK = /\?\s*$/
const ALL_CAPS = /^[^a-z]*[A-Z]{2}[^a-z]*$/
function read(line) {
  if (SIGNOFF.test(line)) return ['—', 'the sign-off. The archive excludes it from every section, on every drop.']
  if (/^https?:\/\//i.test(line)) return ['—', 'an address on its own line. Evidence, not a sentence.']
  if (QUESTION_MARK.test(line)) {
    return ['Question', 'ends in a question mark' + (/^(ask yourself|think)/i.test(line) ? ', inside a directive wrapper — the archive certifies both' : '')]
  }
  // imperativeMood RETURNS {imperative, why}, NOT A BOOLEAN. The first cut of this file tested the
  // object for truthiness, so every line was a Directive: 2,212 of 2,800, which is what said the
  // reading was wrong rather than the corpus being strange. The `why` it returns is better evidence
  // than anything this file could write, so it is passed straight through.
  const imp = imperativeMood(line)
  if (imp?.imperative) {
    const fam = familyOf(line)
    return ['Directive', `${imp.why} — lib/imperative.mjs, the detector that produced the certified directives${fam && fam !== 'other' ? ` (family: ${fam})` : ''}`]
  }
  if (ALL_CAPS.test(line) && line.split(/\s+/).length <= 6) {
    return ['Claim', 'a short all-caps assertion — the shape the archive certifies as a telegraphic Claim']
  }
  if (/[.!]$/.test(line) && /\s/.test(line)) {
    return ['Claim', 'a finished sentence asserting something']
  }
  if (/^\[.*\]$/.test(line)) return ['[ Bracket ]', 'a bracketed token — the bracket detector paints these wherever they appear']
  return ['', 'NOT PLACED. The archive would not classify this line on its own, and guessing one is what this file exists to avoid.']
}

const rows = []
for (const o of [...byBoard.values()].sort((a, b) => [...a.quotedOn][0] - [...b.quotedOn][0])) {
  for (const line of o.body) {
    const [cat, why] = read(line)
    rows.push([
      [...o.quotedOn].sort((a, b) => a - b).join(' '),
      o.boardId,
      o.looksLikeQ ? 'Q' : 'anon',
      o.why,
      line,
      cat,
      why,
    ])
  }
}

const qRows = rows.filter(r => r[2] === 'Q')
const tally = {}
for (const r of rows) tally[r[5] || '(not placed)'] = (tally[r[5] || '(not placed)'] ?? 0) + 1

// ── the workbook ────────────────────────────────────────────────────────────
const summary = [
  ['What', 'Count', 'What it means'],
  ['Quoted blocks in the archive', 2785, 'Every ">>NNNNNNN" a drop points at, as the reader sees it.'],
  ['…that ARE a drop we hold', 1320, 'Already marked up from that drop\u2019s own certified analysis. Nothing to do.'],
  ['…that are NOT, and have writing', byBoard.size, 'This file. Nothing in the archive classifies a single line of them.'],
  ['', '', ''],
  ['Of those, written by Q', [...byBoard.values()].filter(o => o.looksLikeQ).length, 'A tripcode, or a body closing with the sign-off. The board recorded almost all of these as "Anonymous ID: 000000", so the NAME is not evidence — #4957 quotes a block that ends "Q" and reads exactly like a drop.'],
  ['Of those, written by an anon', [...byBoard.values()].filter(o => !o.looksLikeQ).length, 'No tripcode and no sign-off. #4965 is one: an anon asking "Q & A ?", to which Q replies "In time."'],
  ['', '', ''],
  ['Lines to rule', rows.length, 'Every line of every one of those blocks, pointers and board headers removed.'],
  ['…written by Q', qRows.length, 'Sheet 2 is these on their own — the ones a ruling could certify without putting an anon\u2019s words in Q\u2019s index.'],
  ['', '', ''],
  ['WHY THIS IS A RULING SHEET AND NOT A CHANGE', '', 'Invariant 9: quoted text feeds SEARCH ONLY, never the analysis index, because 52% of it is anon words. Certifying an anon\u2019s question as a Q Question is the one thing that rule exists to prevent. So nothing here is applied — you decide what becomes certified.'],
  ['HOW EACH LINE WAS READ', '', 'With the archive\u2019s own rules and no new ones. Question form is the rule the certified questions use; the directive test is lib/imperative.mjs, the detector that produced the certified 2,552. A line neither would place is left BLANK and says so, rather than being guessed at.'],
  ['', '', ''],
  ['BY CATEGORY', '', ''],
  ...Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, '']),
]

const header = ['Quoted on drop(s)', 'Board id', 'Written by', 'How that was decided', 'The line', 'My ruling', 'Why']
const { buf, sheets } = workbookBuffer([
  ['1-summary', summary],
  ['2-Q-wrote-these', [header, ...qRows]],
  ['3-every-line', [header, ...rows]],
])

const desktop = process.argv.includes('--desktop')
  ? writeWorkbook(buf, XLSX, DESKTOP)
  : (writeWorkbook(buf, XLSX, null), 'not written — pass --desktop to publish a copy there')

fs.writeFileSync(path.join(ROOT, 'audit/quoted-post-review.json'), JSON.stringify({
  note: 'Quoted posts the archive does not hold as drops, with a proposed reading for every line. A RULING SHEET, not a change: invariant 9 keeps quoted text out of the analysis index, so nothing here is applied until the owner rules.',
  ranOn: '2026-08-24',
  totals: { quotedBlocks: 2785, resolveToADrop: 1320, orphansWithWriting: byBoard.size, lines: rows.length, linesQWrote: qRows.length },
  byCategory: tally,
}, null, 1) + '\n')

console.log('\nQUOTED POSTS THE ARCHIVE DOES NOT HOLD\n')
console.log(`  blocks with writing, no drop behind them : ${byBoard.size}`)
console.log(`    written by Q                           : ${[...byBoard.values()].filter(o => o.looksLikeQ).length}`)
console.log(`    written by an anon                     : ${[...byBoard.values()].filter(o => !o.looksLikeQ).length}`)
console.log(`  lines to rule                            : ${rows.length}  (Q wrote ${qRows.length})`)
console.log('')
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('')
for (const [name, n] of sheets) console.log(`  ${name.padEnd(20)} ${String(n - 1).padStart(6)} rows`)
console.log(`\n  ${(buf.length / 1024).toFixed(0)} KB`)
console.log(`  ${path.relative(ROOT, XLSX)}`)
console.log(`  ${desktop}\n`)
