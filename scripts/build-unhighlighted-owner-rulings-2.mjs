// Build the CANONICAL artifact for the owner's SECOND pass over the unhighlighted queue.
//
//   audit/unhighlighted-sentences/owner-review-final2.csv
//     -> audit/unhighlighted-owner-rulings-2.json
//     -> audit/unhighlighted-review2-issues.json   (everything that could not be taken at face value)
//
// Same shape of work as build-unhighlighted-owner-rulings.mjs (2026-08-20), and it inherits that
// script's two hard rules:
//
//   1. Q'S WORDING COMES FROM THE DROP, NEVER FROM THE REVIEW FILE. The workbook round-tripped
//      through cp1252, so curly punctuation arrived as U+FFFD. Rows are matched punctuation-blind;
//      the DROP's characters are what gets stored.
//   2. THE STORED SPAN MUST RESOLVE IN THE RENDERING COORDINATE SYSTEM, via runtimeSpan().
//
// It adds the thing this pass actually turns on — DO NOT DOUBLE-HIGHLIGHT. A row whose target
// section ALREADY certifies that span is recorded in alreadyCertified and produces no ruling. The
// test reads the CERTIFIED ARTIFACTS, not the painted DOM: an entity or bracket painted on top of
// a claim hides the claim from a crawler, and treating that as "not certified" would duplicate
// every one of them.
//
//   node scripts/build-unhighlighted-owner-rulings-2.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor } from './lib/segment.mjs'
import { runtimeText, runtimeSpan } from './lib/runtimeText.mjs'
import { completeTokenRegex } from './lib/renderedMatch.mjs'
import { loadAbbrevRepairs } from './lib/abbrevRepairs.mjs'
import { statesNoInstruction } from './lib/queueDirectiveFamily.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, 'audit/unhighlighted-sentences/owner-review-final2.csv')
const OUT = path.join(ROOT, 'audit/unhighlighted-owner-rulings-2.json')
const ISSUES = path.join(ROOT, 'audit/unhighlighted-review2-issues.json')
const check = process.argv.includes('--check')
const RULED_ON = '2026-08-24'

// THE PATTERNS THE RENDERER ACTUALLY PAINTS BY — bracketSpansIn() and the URL scan in
// PostDetail.tsx, which postHighlight.tsx imports and shares. Copied as literals because those
// files are TypeScript and this is a build script.
//
// NOT highlightConstants.ts's BRACKET_SRC / URL_SRC. Those two constants are exported and no
// longer read by anything, and BRACKET_SRC is much stricter than what ships — it rejects
// "[$115,000,000]", "[:27]" and every bracket holding punctuation. Checking against it reported
// 123 brackets as uncertified that the page has been painting red all along.
const BRACKET_RX = /\[[^[\]\n]{1,60}\]/g
// TOKEN_RE from src/lib/linkify.tsx — the pass that actually turns an address into an anchor.
// It matches a BARE www. host as well as a scheme, which is why 1,633 rows the earlier
// scheme-only check called uncertified are in fact already live links: Q typed "https:// www.x"
// with a space, the scheme is orphaned, and linkify still links the www. half.
const URL_RX = /https?:\/\/[^\s<>"'`)\]]+|www\.[^\s<>"'`)\]]+/g
/** Q's own stray space after the scheme — "https:// www.fbi.gov/…". Not ours to rewrite. */
const STRAY_SCHEME = /^https?:\/\/\s+/i
/** linkify() drops trailing sentence punctuation before building the href. */
const dropTrailing = s => s.replace(/[.,;:!?]+$/, '')
/** bracketSpansIn() decodes entities before comparing; the drop text carries &amp; and &gt;. */
const decodeEntities = s => s
  .replace(/&amp;/gi, '&').replace(/&gt;/gi, '>').replace(/&lt;/gi, '<')
  .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ')

const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

// THE REVIEW'S OWN JOIN KEY. Every row carries the (post, sentence) pair the census stamped, so
// the unit a row is talking about is a lookup rather than a text search — and 6,418 of the 6,419
// rows resolve through it. It settles the cases a text search cannot: #2451 says "Thank you for
// your service to our Country," and the drop says that twice, once for Gowdy and once for
// Goodlatte, so only the sentence index knows which line was reviewed.
const truth = new Map()
for (const line of fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-sentences/unhighlighted-from-truth.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue
  const d = JSON.parse(line)
  truth.set(d.postNumber + '|' + d.sentenceIndex, d)
}
// The 114 recorded abbreviation repairs and the 45 tails they absorb. See the block that uses it.
const repairs = loadAbbrevRepairs(ROOT)
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8'))
const questionsByPost = new Map()
for (const q of questions) {
  if (!questionsByPost.has(q.postNum)) questionsByPost.set(q.postNum, [])
  questionsByPost.get(q.postNum).push(q)
}

// ── matching helpers ────────────────────────────────────────────────────────
// U+FFFD stands in for whatever character cp1252 ate, so it is dropped rather than compared.
const STRIPPED = /[‘’‚‛'“”„‟"–—�?]/g
const loose = s => clean(String(s)).toLowerCase()
  .replace(STRIPPED, '')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
/** Trailing sentence punctuation is not part of a name or a bracket. */
const bare = s => String(s).trim().replace(/^[\s"'“”]+|[\s"'“”.,;:!]+$/g, '')

// The sheet a row sits on is the owner's classification; a filled Final Category cell overrides it.
const SHEET_SECTION = {
  'Q Claims': 'claims',
  'Q Entities': 'entities',
  'Q Brackets': 'brackets',
  'Q Predictions': 'predictions',
  'Q Directives': 'directives',
  'Q Questions': 'questions',
  'URL': 'url',
  'Resolution Center': 'resolution',
}
const CELL_SECTION = {
  'q claims': 'claims', 'q claim': 'claims',
  'q entities': 'entities', 'q entity': 'entities',
  'q brackets': 'brackets', 'q bracket': 'brackets', 'q [ brackets ]': 'brackets',
  'q predictions': 'predictions', 'q prediction': 'predictions',
  'q directives': 'directives', 'q directive': 'directives',
  'q questions': 'questions', 'q question': 'questions',
  'url': 'url',
}
/** Sections that name an INLINE span rather than owning a whole sentence. */
const INLINE = new Set(['entities', 'brackets', 'url'])

// EXCEL'S TEXT PREFIX. 98 cells begin with an apostrophe because the line they hold begins with
// "+", "=" or "-" and a spreadsheet would otherwise read it as a formula. It is a storage
// artefact, not a character Q typed, and it must not reach a comparison.
const unprefix = s => String(s).replace(/^'(?=[+\-=@])/, '')

// A CELL THAT CARRIES AN INSTRUCTION INSTEAD OF THE LINE.
//
// #1927 row 759 reads "personnel removal (CLAUDE HIGHLIGHT ALL PERSNNEL REMOVAL as CLAIMS)". The
// drop has seven "+ X personnel removal" lines and the workbook already lists six of them by
// name; the seventh, sentence 16, is the one this cell stands in for. The instruction is
// therefore satisfied by taking that line, and it is recorded here rather than applied silently.
const OWNER_INSTRUCTIONS = new Map([
  ['1927|16', {
    text: '+ C_A personnel removal',
    note: 'Owner instruction in the cell: highlight ALL "personnel removal" lines as Claims. #1927 is the only drop that carries the wording, in seven lines; the workbook names six of them and this row stands for the seventh.',
  }],
])

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
const body = raw.slice(1)

const unitsCache = new Map()
const unitsOf = pn => {
  if (!unitsCache.has(pn)) unitsCache.set(pn, unitsFor(byNum.get(pn)?.text ?? ''))
  return unitsCache.get(pn)
}

// ── THIS SCRIPT MUST READ THE DEPLOYED BASELINE, NOT ITS OWN OUTPUT ─────────
//
// The already-certified test reads public/data, and public/data is where these rulings LAND.
// Build, apply the chain, build again — and every round-2 ruling reads back as "already
// certified" and deletes itself. Not a hypothetical: questions went 8 rulings, then 0, and the
// apply gate reported 65 added where the run before it had made 72.
//
// Subtracting the previous output was tried and is the wrong shape: it cannot tell a bundle that
// HAS been rebuilt from one that has not, so it suppresses genuine prior evidence in the second
// case — entities' `already certified` fell from 595 to 208 and 387 live highlights were handed
// back for re-ruling.
//
// The honest condition is the one git can answer. public/data must be exactly what is committed,
// which is the state the census was measured against and the state seed 88 shipped. Round 1's
// 6,108 rulings are IN that baseline — they are applied, deployed and live — so a span they
// certified reads as already certified, which is the whole point of the pass.
if (!process.env.QDROPS_ALLOW_DIRTY_DATA) {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', 'public/data'], { cwd: ROOT, encoding: 'utf8' }).trim()
  if (dirty) {
    console.error('\nbuild-unhighlighted-owner-rulings-2.mjs: public/data has uncommitted changes.\n')
    console.error('  The already-certified test reads public/data, and this script writes rulings INTO it')
    console.error('  through the apply chain. Against a rebuilt bundle it would read its own output back')
    console.error('  and withdraw every ruling as already certified.\n')
    console.error('  Build the rulings from the committed baseline first:\n')
    console.error('      git checkout -- public/data')
    console.error('      node scripts/build-unhighlighted-owner-rulings-2.mjs')
    console.error('      node scripts/rebuild-bundle.mjs\n')
    console.error(dirty.split('\n').map(l => '  ' + l).join('\n') + '\n')
    process.exit(2)
  }
}

// ── is this span ALREADY certified in the target section? ───────────────────
// Read from the certified artifacts, never from paint. See the header note.
function alreadyCertified(section, p, span) {
  const a = p.postAnalysis ?? {}
  const L = loose(span), B = loose(bare(span))
  const has = list => (list ?? []).some(x => { const l = loose(x); return l === L || l === B })
  switch (section) {
    case 'claims': return has(a.claimSpans) || has(a.claims)
    case 'predictions': return has(a.predictionSpans) || has(a.predictions)
    case 'directives': return has(p.actionRequests)
    case 'questions': return (questionsByPost.get(p.postNum) ?? [])
      .some(q => { const l = loose(q.unitText ?? q.text); return l === L || l === B })
    case 'entities': return has(a.namedEntities)
    // Brackets and URLs are DETECTED from the drop text by the same patterns the renderer paints
    // by, so "already certified" means the detector already finds this exact span.
    case 'brackets': {
      const rx = new RegExp(BRACKET_RX.source, 'g')
      let m
      while ((m = rx.exec(runtimeText(p.text ?? ''))) !== null) {
        const shown = decodeEntities(m[0])
        if (loose(shown) === B || loose(shown) === L) return true
      }
      return false
    }
    // A URL row counts as covered when linkify() already builds an anchor over the address. The
    // stray-scheme form is covered TOO — the address is live and clickable; what is left over is
    // the orphaned "https:// " Q typed, which is a defect in the drop, reported not rewritten.
    // A URL row counts as covered when linkify() already anchors the address.
    //
    // The ruled text is NOT necessarily just the address. The owner reviewed by SENTENCE, and a
    // unit spans continuation lines — #612's unit is "/_\Council on Foreign Relations/_\" and the
    // wikipedia link on the next line, joined. So the addresses INSIDE the ruled text are what is
    // tested, not the whole unit; comparing the unit called 398 live links uncertified.
    case 'url': {
      const live = new Set()
      const rx = new RegExp(URL_RX.source, 'g')
      let m
      while ((m = rx.exec(runtimeText(p.text ?? ''))) !== null) live.add(loose(dropTrailing(m[0])))
      if (live.has(L) || live.has(B)) return 'linked'
      const wanted = String(span).match(new RegExp(URL_RX.source, 'g')) ?? []
      // "https:// www.x" — Q's own stray space orphans the scheme. linkify still anchors the
      // www. half, so the address is live; the leftover scheme is a defect in the drop, reported.
      const stray = STRAY_SCHEME.test(String(span).trim()) || /https?:\/\/\s/.test(String(span))
      if (wanted.length && wanted.every(u => live.has(loose(dropTrailing(u))))) {
        return stray ? 'linked-stray-scheme' : 'linked'
      }
      return false
    }
    default: return false
  }
}

const rulings = []
const already = []
const issues = []
const resolution = []

// ── the workbook carries the same line more than once ───────────────────────
//
// 129 rows are a repeat of an earlier (post, sentence, text). 83 of those keys repeat with the
// SAME destination and are simply a duplicated row. The other 43 disagree with themselves, and
// they disagree in one direction: a row sitting on its own sheet, plus a second copy of the same
// line whose Final Category cell names a different section. #10's "These people worship Satan _
// some openly show it." is on the Q Claims sheet twice, once as Q Claims and once as Q Brackets —
// and the drop holds no bracket at all, so certifying that sentence as a code would put a line of
// prose in the Codes section.
//
// THE SHEET WINS WHEN A KEY DISAGREES WITH ITSELF, and the losing copy is reported rather than
// dropped silently. A cell that names a different section is still honoured where it is the row's
// only vote — that is a reclassification, not a conflict.
const keyOf = r => String(r[1]).trim() + '|' + String(r[2]).trim() + '|' + clean(unprefix(r[3] ?? '')).trim()
const votes = new Map()
for (const r of body) {
  const k = keyOf(r)
  if (!votes.has(k)) votes.set(k, [])
  votes.get(k).push(r)
}
/** Destinations already claimed by a ruling, so a duplicated row cannot certify twice. */
const emitted = new Set()

for (const [i, r] of body.entries()) {
  const rowNo = i + 2
  const sheet = String(r[0] ?? '').trim()
  const postNum = Number(String(r[1] ?? '').trim())
  const sentIdx = String(r[2] ?? '').trim()
  const instruction = OWNER_INSTRUCTIONS.get(postNum + '|' + sentIdx)
  const wbText = instruction?.text ?? unprefix(r[3] ?? '')
  const label = String(r[4] ?? '').replace(/\s+/g, ' ').trim()

  const cell = CELL_SECTION[label.toLowerCase()]
  const sheetSec = SHEET_SECTION[sheet]
  const copies = votes.get(keyOf(r)) ?? [r]
  // Does another copy of this exact line sit on a sheet that agrees with itself?
  const selfConsistent = copies.some(c => {
    const cSheet = SHEET_SECTION[String(c[0] ?? '').trim()]
    const cCell = CELL_SECTION[String(c[4] ?? '').replace(/\s+/g, ' ').trim().toLowerCase()]
    return cSheet && (!cCell || cCell === cSheet)
  })
  /** The cell names a different section than the sheet — a reclassification, or a conflict. */
  const conflictedCell = Boolean(cell && sheetSec && cell !== sheetSec)
  // TWO SPANS ON ONE SENTENCE IS THE SIGNATURE OF AN INLINE SECTION.
  //
  // #1887's line is "Operation Cyclone>> Mujahideen/Afghanistan" and the Q Entities sheet carries
  // BOTH names against sentence 20, each with a stray "Q Claims" cell. A sentence can only be one
  // claim, so two rows naming different text on one sentence cannot both be the cell's answer —
  // and the Claims section's own rule says a bare noun phrase is not a claim. The sheet wins.
  const siblingSpans = sheetSec && INLINE.has(sheetSec) && body.some(o =>
    String(o[1]).trim() === String(r[1]).trim() &&
    String(o[2]).trim() === String(r[2]).trim() &&
    String(o[0]).trim() === sheet &&
    clean(unprefix(o[3] ?? '')).trim() !== clean(wbText).trim())
  const conflicted = conflictedCell && ((copies.length > 1 && selfConsistent) || siblingSpans)
  let section = conflicted ? sheetSec : (cell ?? sheetSec)
  const p = byNum.get(postNum)

  const issue = (why, extra = {}) =>
    issues.push({ row: rowNo, sheet, postNum, sentenceIndex: sentIdx, text: wbText, why, ...extra })

  if (!p) { issue('POST_NOT_FOUND'); continue }
  if (!section) { issue('UNKNOWN_SECTION', { label }); continue }
  if (instruction) issue('OWNER_INSTRUCTION_IN_CELL', { resolvedTo: instruction.text, note: instruction.note, severity: 'info' })
  if (String(r[3] ?? '') !== unprefix(r[3] ?? '')) issue('EXCEL_TEXT_PREFIX_STRIPPED', { severity: 'info' })
  if (!label && sheetSec !== 'resolution') issue('BLANK_FINAL_CATEGORY_USED_SHEET', { assumed: sheetSec, severity: 'info' })
  if (conflicted) issue('DUPLICATE_ROW_DISAGREES_WITH_ITSELF', { sheetSaid: sheetSec, cellSaid: cell, applied: sheetSec, severity: 'warn' })
  else if (cell && sheetSec && cell !== sheetSec) issue('CELL_OVERRIDES_SHEET', { from: sheetSec, to: cell, applied: cell, severity: 'info' })
  if (!sentIdx) issue('BLANK_SENTENCE_INDEX', { severity: 'warn' })

  // A key ruled into the SAME section twice is one classification, not two occurrences.
  const dedupeKey = keyOf(r) + '::' + section
  if (emitted.has(dedupeKey)) {
    issue('DUPLICATE_ROW_DROPPED', { section, severity: 'info' })
    continue
  }
  emitted.add(dedupeKey)

  // The Resolution Center sheet is not a paint ruling — it is a queue entry.
  if (section === 'resolution') {
    resolution.push({ postNum, postId: p.id, sentenceIndex: sentIdx ? Number(sentIdx) : null, text: wbText, row: rowNo })
    continue
  }

  // ── locate the ruled span ─────────────────────────────────────────────────
  // The order matters, and it differs by section. An INLINE section owns a span INSIDE a line, so
  // it must try the inline matcher before anything that could hand back a whole sentence: the
  // entity "H" in #3354 sits in "(H) + [C] = D", and resolving it to the unit would certify the
  // whole equation as a name. A sentence-level section is the other way round.
  const locate = sec => {
    const units = unitsOf(postNum)
    const rt = runtimeText(p.text ?? '')
    const probe = clean(wbText).trim().replace(/^[\s"'“”]+|[\s"'“”]+$/g, '')
    const inline = () => {
      if (!INLINE.has(sec) || !probe.length) return null
      const m = completeTokenRegex(probe).exec(rt)
      if (m) return { text: m[0], inlineSpan: true }
      return rt.includes(probe) ? { text: probe, inlineSpan: true } : null
    }
    let h = units.find(u => clean(u.text).trim() === clean(wbText).trim())
      ?? units.find(u => key(u.text) === key(wbText))
      ?? units.find(u => loose(u.text) === loose(wbText))
    if (!h) h = inline()

    // A ruling may span consecutive units — the segmenter splits at abbreviations
    // ("J. Biden" -> "J." + "Biden."). Accepted only on an EXACT punctuation-blind reconstruction.
    if (!h) {
      const want = loose(wbText)
      outer: for (let a = 0; a < units.length && want; a++) {
        let joined = units[a].text
        for (let b = a + 1; b < Math.min(a + 8, units.length); b++) {
          joined = joined + ' ' + units[b].text
          if (loose(joined) === want) { h = { text: joined, joinedUnits: b - a + 1 }; break outer }
          if (loose(joined).length > want.length) break
        }
      }
    }
    // A line the segmenter could not represent as one unit — take the drop's own line, unambiguously.
    if (!h) {
      const want = loose(wbText)
      const lines = clean(p.text ?? '').split('\n').map(l => l.trim()).filter(l => l && !/^>>\d+/.test(l))
      let cands = lines.filter(l => loose(l) === want)
      if (!cands.length && want.length >= 12) {
        cands = lines.filter(l => loose(l).startsWith(want) || (loose(l).length >= 12 && want.startsWith(loose(l))))
      }
      if (new Set(cands.map(c => c.trim())).size === 1) h = { text: cands[0], resolvedFromLine: true }
    }
    // THE ROW'S OWN (post, sentence) KEY, last, and only for a section that owns whole sentences.
    //
    // It settles what no text search can: #2451 says "Thank you for your service to our Country,"
    // and the drop says that twice, once for Gowdy and once for Goodlatte, so only the index knows
    // which line was reviewed. Accepted only where the two genuinely overlap — one is a leading run
    // of the other. A row whose text does not overlap its own indexed unit is a transcription
    // error, and is reported rather than resolved.
    if (!h && !INLINE.has(sec) && sentIdx) {
      const t = truth.get(postNum + '|' + Number(sentIdx))
      if (t) {
        const a = loose(t.sentenceText), b = loose(wbText)
        if (a && b && (a.startsWith(b) || b.startsWith(a))) h = { text: t.sentenceText, resolvedFromIndex: true }
      }
    }
    return h
  }

  let hit = locate(section)
  // A Final Category cell that names a section the span cannot live in. #1887's line is
  // "Operation Cyclone>> Mujahideen/Afghanistan" and both names are on the Q Entities sheet with a
  // Q Claims cell; as a claim neither resolves, as an entity both do. The sheet is the fallback.
  if (!hit && conflictedCell && section !== sheetSec) {
    const alt = locate(sheetSec)
    if (alt) {
      issue('CELL_SECTION_UNRESOLVABLE_USED_SHEET', { cellSaid: section, applied: sheetSec, severity: 'warn' })
      section = sheetSec
      hit = alt
    }
  }
  if (hit?.inlineSpan && String(hit.text).trim().length === 1 && section === 'entities') {
    // A one-character entity is real — "(H)" in #3354 is the Horowitz report — and the boundary
    // match is what keeps it from lighting up every H in the drop. Reported so the single
    // characters can be read as a group rather than trusted silently.
    issue('SINGLE_CHARACTER_ENTITY', { severity: 'warn' })
  }

  if (!hit) { issue('NO_MATCHING_Q_UNIT'); continue }

  let sourceText = hit.text.trim()

  // ── THE ABBREVIATION RECORD ALREADY GOVERNS SOME OF THESE SPANS ───────────
  //
  // audit/abbreviation-span-repairs.json holds 114 spans a sentence splitter cut at "Mr.",
  // "Lt. Gen.", "U.S. Senate", "H. Biden", and the 45 tail fragments the same splitter certified
  // beside them. The census segments the same way, so the owner reviewed some of those halves:
  // ten rows land on one.
  //
  // A ruled TRUNCATED span means the full sentence, not the half — the repair record is the
  // project's own statement of what that span IS, and every materialiser applies it. Storing the
  // half would either double the sentence or fight the repair on the next run; apply-directives
  // caught exactly that and refused to write ("repairs recorded 5, applied 6").
  //
  // A ruled WITHDRAWN TAIL is refused outright. That fragment was absorbed into a repaired span
  // on purpose, and re-certifying it would restore the same-category duplicate the 2026-08-21
  // ruling removed.
  if (repairs) {
    if (repairs.isWithdrawn(section, postNum, sourceText)) {
      issue('SPAN_IS_A_WITHDRAWN_ABBREVIATION_TAIL', { drop: sourceText })
      continue
    }
    const full = repairs.fullFor(section, postNum, sourceText)
    if (full && loose(full) !== loose(sourceText)) {
      issue('SPAN_EXTENDED_BY_THE_ABBREVIATION_REPAIR', { from: sourceText, to: full, severity: 'info' })
      sourceText = String(full).trim()
    }
  }

  // The owner typed something the drop does not say. Q's wording wins; the divergence is reported.
  if (loose(sourceText) !== loose(wbText)) {
    issue('WORKBOOK_TEXT_DIFFERS_FROM_DROP', { drop: sourceText, severity: 'warn' })
  }

  // A DIRECTIVE HAS TO INSTRUCT SOMEBODY TO DO SOMETHING — AND THE OWNER OVERRODE THAT.
  //
  // Four shapes on the Q Directives sheet do not instruct anyone: #953's "#1"/"#2" list markers,
  // the "_END_" and "—end—" structural marks, two comms strings, and one line that is an assertion
  // in shape. 24 rows. They were HELD on the first pass and listed on sheet 3 of the report.
  //
  // OWNER RULING, 2026-08-24: "go ahead and push the directives in that held for you file tab as
  // well". So they are certified as Directives, in the section the owner's own sheet put them.
  //
  // Nothing is invented to do it. lib/queueDirectiveFamily.mjs is explicit that it must not become
  // a silent catch-all, so no new family is written for these: the detector is asked, and where it
  // has no answer the row carries the family 'other' — which 378 of round 2's 486 already carry.
  // The reason each was held is still recorded, as an INFO row rather than a hold, so the trail
  // from "held" to "certified on the owner's word" stays readable in the report.
  if (section === 'directives') {
    const why = statesNoInstruction(sourceText)
    if (why) issue('PUSHED_ON_OWNER_RULING_STATES_NO_INSTRUCTION', { drop: sourceText, reason: why, severity: 'info' })
  }

  const covered = alreadyCertified(section, p, sourceText)
  if (covered) {
    if (covered === 'linked-stray-scheme') {
      issue('URL_LIVE_BUT_SCHEME_ORPHANED_IN_DROP', { drop: sourceText, severity: 'info' })
    }
    already.push({ postNum, section, sourceText, ...(typeof covered === 'string' ? { how: covered } : {}), row: rowNo })
    continue
  }

  const paint = runtimeSpan(p.text ?? '', sourceText)
  if (!paint) { issue('NOT_LOCATABLE_IN_RUNTIME_BODY', { drop: sourceText }); continue }

  rulings.push({
    postNum,
    postId: p.id,
    section,
    sourceText,
    ...(paint === sourceText ? {} : { paintText: paint }),
    ...(hit.joinedUnits ? { joinedUnits: hit.joinedUnits } : {}),
    ...(hit.resolvedFromLine ? { resolvedFromLine: true } : {}),
    ...(hit.resolvedFromIndex ? { resolvedFromIndex: true } : {}),
    ...(hit.inlineSpan ? { inlineSpan: true } : {}),
    was: 'unclassified',
    ruledOn: RULED_ON,
    provenance: 'owner review of the unhighlighted-sentence queue, round 2, ' + RULED_ON,
  })
}

const bySection = {}
for (const r of rulings) bySection[r.section] = (bySection[r.section] ?? 0) + 1
const alreadyBySection = {}
for (const r of already) alreadyBySection[r.section] = (alreadyBySection[r.section] ?? 0) + 1
const issuesByWhy = {}
for (const r of issues) issuesByWhy[r.why] = (issuesByWhy[r.why] ?? 0) + 1

const out = {
  note: 'Owner review of the unhighlighted-sentence queue, ROUND 2. THE canonical record of this batch, alongside audit/unhighlighted-owner-rulings.json for round 1.',
  why: 'The 2026-08-22 census measured 10,700 unpainted lines on the published site. The owner reviewed them and returned Q_Unhighlighted FINAL 2.xlsx: one sheet per destination section, plus a Resolution Center sheet for the coded strings that resolve to nothing.',
  doNotDoubleHighlight: 'A row whose target section ALREADY certifies that span produces no ruling and is recorded in alreadyCertified. The test reads the certified artifacts, not the painted DOM - an entity or bracket painted on top of a claim hides the claim from a crawler.',
  wording: 'Q literal wording is taken from the drop, never from the review file. Rows are matched punctuation-blind and the drop own characters are stored.',
  ruledOn: RULED_ON,
  source: 'audit/unhighlighted-sentences/owner-review-final2.csv (from Q_Unhighlighted FINAL 2.xlsx)',
  totals: {
    reviewed: body.length,
    ruled: rulings.length,
    alreadyCertified: already.length,
    resolutionCenter: resolution.length,
    issues: issues.length,
    bySection,
    alreadyBySection,
  },
  resolutionCenter: resolution,
  alreadyCertified: already,
  rulings,
}

if (check) {
  console.log(JSON.stringify(out.totals, null, 1))
  console.log('issues:', JSON.stringify(issuesByWhy, null, 1))
  process.exit(0)
}
// ── AND THE OTHER HALF OF THE SAME GUARD ─────────────────────────────────────
//
// The clean-tree check above is necessary and NOT sufficient. It refuses a HALF-applied bundle.
// It cannot refuse a FULLY applied one, because once this batch is materialised and committed,
// public/data is clean again — and every ruling in it now reads back as already certified. Run
// the builder a second time and `ruled` collapses from 2,775 to 656 while `alreadyCertified`
// climbs from 3,261 to 5,404, silently withdrawing 2,119 certified spans. That happened, and the
// only reason it was caught is that the totals were compared by hand.
//
// So the second condition is stated against the PREVIOUS OUTPUT: if the rows this run calls
// already-certified are the rows the last run RULED, the baseline already carries this batch and
// there is nothing to build. Amend the ruling source and re-run the chain instead; or set
// QDROPS_REBASELINE_QUEUE=1 to deliberately rebuild against a bundle that already contains it.
const priorRuled = fs.existsSync(OUT)
  ? new Set((JSON.parse(fs.readFileSync(OUT, 'utf8')).rulings ?? [])
      .map(r => `${r.postNum}|${r.section}|${loose(r.sourceText)}`))
  : new Set()
const withdrawn = already.filter(a => priorRuled.has(`${a.postNum}|${a.section}|${loose(a.sourceText)}`)).length
if (withdrawn > 0 && !process.env.QDROPS_REBASELINE_QUEUE) {
  console.error('')
  console.error('build-unhighlighted-owner-rulings-2.mjs: the committed baseline already carries this batch.')
  console.error('')
  console.error(`  ${withdrawn.toLocaleString()} span(s) this run would report as ALREADY CERTIFIED are spans the`)
  console.error('  previous run RULED. public/data is clean, but what it is clean AGAINST is a tree that')
  console.error('  already has these rulings applied, so rebuilding here withdraws them.')
  console.error('')
  console.error(`  previous rulings   : ${priorRuled.size.toLocaleString()}`)
  console.error(`  this run would rule: ${rulings.length.toLocaleString()}`)
  console.error('')
  console.error('  To change a ruling, edit the source and re-run the chain. To rebuild on purpose:')
  console.error('      QDROPS_REBASELINE_QUEUE=1 node scripts/build-unhighlighted-owner-rulings-2.mjs')
  console.error('')
  process.exit(2)
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
fs.writeFileSync(ISSUES, JSON.stringify({
  note: 'Everything in the round-2 review that could not be taken at face value. severity info = recorded and applied as read; warn = applied with a substitution; no severity = refused, nothing was applied.',
  ruledOn: RULED_ON,
  totals: issuesByWhy,
  issues,
}, null, 1))

console.log('\nUNHIGHLIGHTED-QUEUE OWNER RULINGS - ROUND 2\n')
console.log('  reviewed          : ' + body.length.toLocaleString())
console.log('  ruled (new)       : ' + rulings.length.toLocaleString())
for (const [s, n] of Object.entries(bySection).sort((a, b) => b[1] - a[1])) console.log('        ' + String(n).padStart(5) + '  ' + s)
console.log('  already certified : ' + already.length.toLocaleString())
for (const [s, n] of Object.entries(alreadyBySection).sort((a, b) => b[1] - a[1])) console.log('        ' + String(n).padStart(5) + '  ' + s)
console.log('  resolution centre : ' + resolution.length.toLocaleString())
console.log('  issues            : ' + issues.length.toLocaleString())
for (const [w, n] of Object.entries(issuesByWhy).sort((a, b) => b[1] - a[1])) console.log('        ' + String(n).padStart(5) + '  ' + w)
console.log('\nwrote audit/unhighlighted-owner-rulings-2.json + audit/unhighlighted-review2-issues.json\n')
