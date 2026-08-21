// Build the CANONICAL artifact for the owner's review of the unhighlighted-sentence queue.
//
//   audit/unhighlighted-sentences/owner-review.csv  ->  audit/unhighlighted-owner-rulings.json
//
// The owner reviewed all 6,111 rows the unhighlighted-sentence audit produced and assigned each
// one to a section: Claims, Predictions, Directives, Questions, Entities or Brackets. This script
// turns that review into the one record every materialiser reads. It decides nothing.
//
// TWO THINGS IT MUST GET RIGHT, and both have bitten this project before:
//
//   1. Q'S WORDING COMES FROM THE DROP, NEVER FROM THE REVIEW FILE. The workbook round-tripped
//      through cp1252, so every curly quote, apostrophe and en-dash in it arrived as U+FFFD.
//      Writing that into a certified artifact would rewrite Q's literal text — the one thing the
//      architecture protections say never happens. Each row is matched to a unit from unitsFor()
//      and the UNIT's text is what is stored. Punctuation-blind comparison is used to FIND the
//      unit; the unit is what is kept.
//
//   2. THE STORED SPAN MUST RESOLVE IN THE RENDERING COORDINATE SYSTEM. unitsFor() segments
//      clean() output and joins continuation lines, so a unit can carry text that never appears
//      contiguously in the runtime body — "Q&A 5 min." in #1192 is two lines. runtimeSpan()
//      recovers the literal form; a row that cannot be located is REFUSED, never guessed.
//
//   node scripts/build-unhighlighted-owner-rulings.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor } from './lib/segment.mjs'
import { runtimeText, runtimeSpan } from './lib/runtimeText.mjs'
// The renderer's own boundary rule, so a ruled name is located exactly where it will paint.
// completeTokenRegex is the scripts' copy of wordBoundaryPattern - see renderedMatch.mjs.
import { completeTokenRegex } from './lib/renderedMatch.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, 'audit/unhighlighted-sentences/owner-review.csv')
const OUT = path.join(ROOT, 'audit/unhighlighted-owner-rulings.json')
const check = process.argv.includes('--check')

const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

// The workbook lost curly punctuation to cp1252. Matching is punctuation-blind so the row still
// finds its unit; the unit's own characters are what gets stored.
const STRIPPED = /[‘’‚‛'“”„‟"–—�?]/g
const loose = s => clean(String(s)).toLowerCase()
  .replace(STRIPPED, '')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

const SECTIONS = {
  'Q Claims': 'claims',
  'Q Predictions': 'predictions',
  'Q Directives': 'directives',
  'Q Questions': 'questions',
  'Q Entities': 'entities',
  'Q [ Brackets ]': 'brackets',
}

/** RFC4180 reader: the review file carries embedded commas, quotes and newlines. */
function readCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false }
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(f => f.trim()))
}

const raw = readCsv(fs.readFileSync(REVIEW, 'utf8'))
const header = raw[0].map(h => h.trim().toLowerCase())
const body = header[0] === 'post' ? raw.slice(1) : raw

const unitsCache = new Map()
const unitsOf = pn => {
  if (!unitsCache.has(pn)) unitsCache.set(pn, unitsFor(byNum.get(pn)?.text ?? ''))
  return unitsCache.get(pn)
}

const rulings = []
const refused = []

for (const [i, r] of body.entries()) {
  const postNum = Number(String(r[0]).trim())
  // A CELL THAT CARRIES ITS OWN OPENING SENTENCE TWICE.
  //
  // #1012's row is the pasted tweet with its first sentence repeated verbatim before the rest —
  // a spreadsheet transcription artefact, not two rulings and not something Q wrote. Collapsing
  // an IMMEDIATELY repeated leading run of 20+ characters is provable from the cell alone and
  // affects exactly one row; the drop's own line is still what gets stored.
  const wbText = String(r[1] ?? '').replace(/^(.{20,}?)\s*\1/, '$1')
  const label = String(r[2] ?? '').replace(/\s+/g, ' ').trim()
  const section = SECTIONS[label]
  const p = byNum.get(postNum)

  if (!p) { refused.push({ row: i + 2, postNum, text: wbText, why: 'POST_NOT_FOUND' }); continue }
  if (!section) { refused.push({ row: i + 2, postNum, text: wbText, why: 'UNKNOWN_SECTION ' + JSON.stringify(label) }); continue }

  const units = unitsOf(postNum)
  // Exact first, then the canonical key, then punctuation-blind. Never a substring guess.
  let hit = units.find(u => clean(u.text).trim() === clean(wbText).trim())
    ?? units.find(u => key(u.text) === key(wbText))
    ?? units.find(u => loose(u.text) === loose(wbText))

  // A RULING MAY SPAN CONSECUTIVE UNITS, because the segmenter splits on abbreviations.
  //
  // unitsFor() breaks a line at "[?!.] + space + capital", which is right for sentences and wrong
  // for "Goodbye, Mr. Rosenstein." — stored as "Goodbye, Mr." + "Rosenstein." — and for
  // "Adm. Michael S. Rogers", "Sen. Amy Klobuchar", "Coincidence vs. HUBER start?" and
  // "Military Law v. Criminal Law.". segment.mjs already names this shape (SEGMENTATION_RISK);
  // it is a unit-boundary artefact, not a classification question, and 46 of the owner's rows land
  // on it. The join is only accepted when consecutive units reconstruct the ruled sentence
  // EXACTLY under the same punctuation-blind comparison, and runtimeSpan() below still has to find
  // the result contiguously in the body Q wrote. Nothing is inferred, and a gap is never bridged.
  if (!hit) {
    const want = loose(wbText)
    outer: for (let a = 0; a < units.length && want; a++) {
      let joined = units[a].text
      for (let b = a + 1; b < Math.min(a + 8, units.length); b++) {
        joined = joined + ' ' + units[b].text
        if (loose(joined) === want) { hit = { text: joined, joinedUnits: b - a + 1 }; break outer }
        if (loose(joined).length > want.length) break
      }
    }
  }
  // A LINE THE SEGMENTER COULD NOT REPRESENT AS ONE UNIT.
  //
  // Same class of problem, one level up. #1438 is the two lines "IDEN_reconf" and "v. 11.9",
  // which unitsFor() joins and then re-splits on "v." — no unit is ever the line the owner ruled.
  // #1012 is one pasted tweet the workbook transcribed twice. #2300's line is
  // "Goodbye, Mr. Rosenstein [payment in full]" and the ruling names the sentence without its
  // bracketed marker. In all three the DROP's own line is the honest span, so the line is taken
  // whole and the extension recorded. Required to be UNAMBIGUOUS — exactly one candidate line —
  // and long enough that a prefix cannot be coincidental.
  if (!hit) {
    const want = loose(wbText)
    const lines = clean(p.text ?? '').split('\n').map(l => l.trim()).filter(l => l && !/^>>\d+/.test(l))
    let cands = lines.filter(l => loose(l) === want)
    if (!cands.length && want.length >= 12) {
      cands = lines.filter(l => loose(l).startsWith(want) || (loose(l).length >= 12 && want.startsWith(loose(l))))
    }
    if (new Set(cands.map(c => c.trim())).size === 1) hit = { text: cands[0], resolvedFromLine: true }
  }

  // AN ENTITY RULING NAMES AN INLINE SPAN, NOT A SENTENCE.
  //
  // Every other section owns a whole unit; Entities never has. "Adm. Michael S. Rogers",
  // "Sen. Amy Klobuchar" and "Mr. Russia" are names sitting inside a longer line, and requiring
  // them to be a unit would refuse the section's own natural shape. Word-boundary matched, the
  // literal span kept — the same rule the highlighter paints by.
  if (!hit && section === 'entities') {
    const rt = runtimeText(p.text ?? '')
    const probe = clean(wbText).trim().replace(/^[\s"'“”]+|[\s"'“”]+$/g, '')
    if (probe.length >= 3) {
      const m = completeTokenRegex(probe).exec(rt)
      if (m) hit = { text: m[0], inlineSpan: true }
    }
  }

  if (!hit) { refused.push({ row: i + 2, postNum, text: wbText, why: 'NO_MATCHING_Q_UNIT' }); continue }

  const sourceText = hit.text.trim()
  // The form the renderer can literally find in the body it paints.
  const paint = runtimeSpan(p.text ?? '', sourceText)
  if (!paint) { refused.push({ row: i + 2, postNum, text: sourceText, why: 'NOT_LOCATABLE_IN_RUNTIME_BODY' }); continue }

  rulings.push({
    postNum,
    postId: p.id,
    section,
    sourceText,
    ...(paint === sourceText ? {} : { paintText: paint }),
    ...(hit.joinedUnits ? { joinedUnits: hit.joinedUnits } : {}),
    ...(hit.resolvedFromLine ? { resolvedFromLine: true } : {}),
    ...(hit.inlineSpan ? { inlineSpan: true } : {}),
    was: 'unclassified',
    ruledOn: '2026-08-20',
    provenance: 'owner review of the unhighlighted-sentence queue, 2026-08-20',
  })
}

const bySection = {}
for (const r of rulings) bySection[r.section] = (bySection[r.section] ?? 0) + 1

const out = {
  note: 'Owner review of the unhighlighted-sentence queue. THE canonical record of this batch: every materialiser that gains a row from it reads this one file, so a line cannot be certified into two sections at once.',
  why: 'audit/unhighlighted-sentences/ queued 16,024 sentences carrying no highlight. The owner reviewed the 6,111 needing a classification and assigned each to a section. Rulings live here, outside the derive steps, for the same reason entities-owner-rulings.json and themes-owner-rulings.json do: a ruling written into a re-derivable artifact is erased the next time its audit runs.',
  wording: 'Q literal wording is taken from the drop, never from the review file - the workbook round-tripped through cp1252 and its curly punctuation arrived as U+FFFD. Rows are matched punctuation-blind and the unit own characters are stored. paintText, when present, is the same span as the runtime body literally holds it (unitsFor joins continuation lines; the renderer cannot match a join).',
  ruledOn: '2026-08-20',
  source: 'audit/unhighlighted-sentences/owner-review.csv',
  totals: { reviewed: body.length, ruled: rulings.length, refused: refused.length, bySection },
  refused,
  rulings,
}

if (check) {
  console.log(JSON.stringify(out.totals, null, 1))
  for (const r of refused) console.log('  REFUSED row ' + r.row + ' #' + r.postNum + ' ' + r.why + ' - ' + JSON.stringify(String(r.text).slice(0, 80)))
  process.exit(0)
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log('\nUNHIGHLIGHTED-QUEUE OWNER RULINGS\n')
console.log('  reviewed : ' + body.length.toLocaleString())
console.log('  ruled    : ' + rulings.length.toLocaleString())
for (const [s, n] of Object.entries(bySection).sort((a, b) => b[1] - a[1])) console.log('      ' + String(n).padStart(5) + '  ' + s)
console.log('  refused  : ' + refused.length)
for (const r of refused) console.log('      row ' + r.row + ' #' + r.postNum + ' ' + r.why + ' - ' + JSON.stringify(String(r.text).slice(0, 70)))
console.log('\nwrote audit/unhighlighted-owner-rulings.json\n')
