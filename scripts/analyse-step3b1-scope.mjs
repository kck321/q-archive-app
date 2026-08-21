// Refine the PARTIAL rows and cross-walk the overlapping populations.
//
//   node scripts/analyse-step3b1-scope.mjs
//
// NO WRITES to public/data. Two questions the outside review raised, both of which change what
// 3B-1 is allowed to touch:
//
//   1. PARTIAL IS NOT THE SAME AS CROSSES A SENTENCE BOUNDARY. A span can be incomplete while
//      sitting entirely inside one sentence — which is exactly what the full-sentence rule was
//      written to repair — or it can straddle two, which is genuinely blocked. Treating both as
//      "blocked" would hold back repairs the ruling explicitly allows.
//   2. THE POPULATIONS OVERLAP. boundaryCrossing242, directiveQuestion220, wrappedPartial51 and
//      multiPrimaryPartial28 are not disjoint, and applying two migrations to one occurrence — or
//      withdrawing a record another migration expects to still be there — is how a batch corrupts
//      itself while every individual step reports success.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'occurrence-ledger-dryrun.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

const sCache = new Map()
const sentencesOf = n => {
  if (!sCache.has(n)) sCache.set(n, sentencesFor(byNum.get(n)?.text, n))
  return sCache.get(n)
}
/** Which source block, if any, a character offset falls inside. */
function sourceAt(postNum, start) {
  const text = runtimeText(byNum.get(postNum)?.text ?? '')
  const src = sourceLines(text)
  const line = text.slice(0, start).split('\n').length - 1
  return src.get(line) ?? null
}

// ── 1. refine the PARTIAL rows ───────────────────────────────────────────────
//
// The five outcomes the review asked for. Only CONTAINED_PARTIAL_SAME_SENTENCE is eligible for
// automatic complete-sentence replacement.
const PARTIAL_CLASSES = {
  CONTAINED_PARTIAL_SAME_SENTENCE: 'incomplete, but wholly inside ONE sentence that every competing span also maps to — eligible',
  CROSS_SENTENCE: 'the span itself straddles a sentence boundary — blocked',
  DIFFERENT_SENTENCE_IDS: 'competing spans map to DIFFERENT sentences — blocked',
  UNLOCATED: 'the span could not be placed in the runtime body — blocked',
  SOURCE_BOUNDARY: 'competing spans sit in different source dispositions — blocked',
}

const needs = (dry.multiPrimary ?? []).filter(m => !m.certifiedOverlap)
const partialRows = []
for (const m of needs) {
  if (m.spans.every(s => s.relation === 'EXACT')) continue
  const post = byNum.get(m.postNum)
  const sentences = sentencesOf(m.postNum)
  const holder = sentences.find(s => s.sentenceId === m.sentenceId)
  const placed = []
  let cls = 'CONTAINED_PARTIAL_SAME_SENTENCE'
  const reasons = []
  for (const sp of m.spans) {
    const hits = occurrencesOfSpan(post?.text, sp.text)
    if (!hits.length) { cls = 'UNLOCATED'; reasons.push(`${sp.kind}: not locatable`); continue }
    const [st, en] = hits[0]
    const own = sentences.find(s => st >= s.start && en <= s.end)
    placed.push({ kind: sp.kind, relation: sp.relation, start: st, end: en, sentenceId: own?.sentenceId ?? null,
      source: sourceAt(m.postNum, st) })
    if (!own) { cls = cls === 'UNLOCATED' ? cls : 'CROSS_SENTENCE'; reasons.push(`${sp.kind}: straddles a boundary`) }
    else if (own.sentenceId !== m.sentenceId) {
      cls = cls === 'UNLOCATED' ? cls : 'DIFFERENT_SENTENCE_IDS'
      reasons.push(`${sp.kind}: maps to ${own.sentenceId}, not ${m.sentenceId}`)
    }
  }
  const sources = new Set(placed.map(x => x.source ?? 'q_authored'))
  if (cls === 'CONTAINED_PARTIAL_SAME_SENTENCE' && sources.size > 1) {
    cls = 'SOURCE_BOUNDARY'
    reasons.push(`competing spans sit in ${sources.size} source dispositions: ${[...sources].join(' / ')}`)
  }
  partialRows.push({
    sentenceId: m.sentenceId, postNum: m.postNum, categories: m.kinds.join(' + '),
    classification: cls, eligible: cls === 'CONTAINED_PARTIAL_SAME_SENTENCE',
    reasons: reasons.join('; '),
    sentenceText: holder?.text ?? '',
    spans: placed.map(x => `${x.kind}[${x.relation}] ${x.start}..${x.end} -> ${x.sentenceId ?? 'NONE'}${x.source ? ` (${x.source})` : ''}`).join(' | '),
  })
}

// ── 2. population cross-walk, by occurrence key ──────────────────────────────
const keysOf = {
  boundaryCrossing242: new Set((dry.crossingRows ?? []).map(r => r.occurrenceKey)),
  directiveQuestion220: new Set(),
  wrappedPartial51: new Set(),
  multiPrimaryPartial28: new Set(),
  multiPrimaryExact89: new Set(),
}
// The 220 certified directive+question sentences, and the 51 directive-wrapped partial questions.
const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q)
}
for (const m of dry.multiPrimary ?? []) {
  const target = m.certifiedOverlap ? keysOf.directiveQuestion220
    : m.spans.every(s => s.relation === 'EXACT') ? keysOf.multiPrimaryExact89
    : keysOf.multiPrimaryPartial28
  // TAKE THE KEY, NEVER REBUILD IT. This used to re-locate sp.text — which the ledger exports
  // truncated to 90 characters — and so produced a shorter span and a DIFFERENT key for the same
  // occurrence. #153's embedded question came out as 60..150 here and 60..213 from the questions
  // side, and the two populations then looked disjoint when they are the same records.
  for (const sp of m.spans) if (sp.occurrenceKey) target.add(sp.occurrenceKey)
}
// The wrapped partials, taken from the ledger's own records for the same reason.
for (const m of dry.multiPrimary ?? []) {
  for (const sp of m.spans) if (sp.directiveWrapped && sp.occurrenceKey) keysOf.wrappedPartial51.add(sp.occurrenceKey)
}
// A wrapped partial can also sit on a sentence that never reached multiPrimary — it is still one.
for (const [postNum, rows] of qByPost) {
  const post = byNum.get(postNum)
  for (const q of rows) {
    if (!(q.directiveWrapped || q.directiveSource)) continue
    const hits = occurrencesOfSpan(post?.text, q.literal ?? q.text)
    if (hits.length) keysOf.wrappedPartial51.add(`${postNum}|questions|${hits[0][0]}|${hits[0][1]}`)
  }
}

const names = Object.keys(keysOf)
const matrix = []
for (const a of names) {
  const row = { population: a, size: keysOf[a].size }
  for (const b of names) row[b] = a === b ? keysOf[a].size : [...keysOf[a]].filter(k => keysOf[b].has(k)).length
  matrix.push(row)
}

// ── output ───────────────────────────────────────────────────────────────────
const csvCell = v => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const writeCsv = (file, headers, rows) => {
  fs.writeFileSync(path.join(ROOT, file),
    [headers.join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))].join('\n') + '\n')
  console.log(`  ${file.padEnd(40)} ${rows.length} rows`)
}

console.log('\nSTEP 3B-1 SCOPE (no writes to public/data)\n')
console.log('  PARTIAL rows refined:')
const byCls = partialRows.reduce((m, r) => { m[r.classification] = (m[r.classification] ?? 0) + 1; return m }, {})
for (const [k, v] of Object.entries(PARTIAL_CLASSES)) {
  console.log(`    ${k.padEnd(34)} ${String(byCls[k] ?? 0).padStart(3)}   ${v}`)
}
console.log(`\n    ELIGIBLE for complete-sentence replacement: ${partialRows.filter(r => r.eligible).length}`)
console.log(`    blocked:                                   ${partialRows.filter(r => !r.eligible).length}`)
console.log('\n  Population intersections, by occurrence key:\n')
const pad = s => String(s).padEnd(24)
console.log('    ' + pad('') + names.map(n => String(keysOf[n].size).padStart(8)).join(''))
for (const row of matrix) console.log('    ' + pad(row.population) + names.map(n => String(row[n]).padStart(8)).join(''))
console.log('\n    columns are, in order: ' + names.join(', ') + '\n')

writeCsv('STEP3B1-28-PARTIALS-REFINED.csv',
  ['sentenceId', 'postNum', 'categories', 'classification', 'eligible', 'reasons', 'sentenceText', 'spans'], partialRows)
writeCsv('STEP3B1-POPULATION-INTERSECTIONS.csv', ['population', 'size', ...names], matrix)
fs.writeFileSync(path.join(ROOT, 'audit', 'step3b1-scope.json'),
  JSON.stringify({ partialClasses: PARTIAL_CLASSES, partialRows, intersections: matrix,
    populations: Object.fromEntries(names.map(n => [n, [...keysOf[n]]])) }, null, 1) + '\n')
console.log('  audit/step3b1-scope.json\n')
