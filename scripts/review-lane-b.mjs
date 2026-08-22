// THE LANE-B REVIEW WORKBENCH — evidence for one human-semantic conflict row, or a whole family.
//
//   node scripts/review-lane-b.mjs --family MULTI_LINE_SPAN
//   node scripts/review-lane-b.mjs --family MULTI_LINE_SPAN --from 0 --count 10
//   node scripts/review-lane-b.mjs --id "BOUNDARY_CROSSING::1012|claims|9|222::0"
//   node scripts/review-lane-b.mjs --families                 list the families and their counts
//
// Reports only. It writes nothing and decides nothing — every disposition is made by reading
// this output against the drop, which is the whole point of the lane being called human semantic.
//
// For each row it prints exactly what the owner's instruction says to inspect:
//   the exact Q-authored source · surrounding Q context · current category · exact stored span
//   competing span/category if any · quoted/pasted/link boundaries · rendering geometry
//   provenance of the record
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const rd = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))

const argv = process.argv.slice(2)
const valueOf = f => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : null }

const tax = rd(OUT, 'step3b1-conflict-taxonomy-rebuilt.json')
const posts = rd(DATA, 'posts.json')
const questions = rd(DATA, 'questions.json')
const overlay = fs.existsSync(path.join(DATA, 'semantics.json')) ? rd(DATA, 'semantics.json') : { occurrences: [] }
const postByNum = new Map(posts.map(p => [p.postNum, p]))
const overlayByPost = new Map()
for (const o of overlay.occurrences ?? []) {
  if (!overlayByPost.has(o.postNum)) overlayByPost.set(o.postNum, [])
  overlayByPost.get(o.postNum).push(o)
}
const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q)
}

const laneB = (tax.rows ?? []).filter(r => r.lane === 'B')

if (argv.includes('--families')) {
  const byFam = new Map()
  for (const r of laneB) {
    const fam = r.subtype ?? r.reason
    byFam.set(fam, (byFam.get(fam) ?? 0) + 1)
  }
  console.log(`lane B rows: ${laneB.length}`)
  for (const [k, v] of [...byFam].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  process.exit(0)
}

const family = valueOf('--family')
const only = valueOf('--id')
let rows = laneB
if (family) rows = rows.filter(r => (r.subtype ?? r.reason) === family)
if (only) rows = rows.filter(r => r.conflictId === only)
const from = Number(valueOf('--from') ?? 0)
const count = Number(valueOf('--count') ?? rows.length)
rows = rows.slice(from, from + count)

const CAT = { claims: 'Claim', predictions: 'Prediction', questions: 'Question', directives: 'Directive',
  namedEntities: 'Entity', themeAnchors: 'Theme anchor', context: 'Context unit', emphasis: 'Emphasis' }

/** Every certified record on this drop, with the span it binds to — the competing-span view. */
function recordsOn(p) {
  const a = p.postAnalysis ?? {}
  const out = []
  const add = (kind, field, arr) => {
    if (!Array.isArray(arr)) return
    arr.forEach((t, i) => {
      const s = String(t ?? '')
      if (!s.trim()) return
      const hits = occurrencesOfSpan(p.text, s)
      out.push({ kind, field, index: i, text: s, hits })
    })
  }
  add('claims', a.claimSpans ? 'claimSpans' : 'claims', a.claimSpans ?? a.claims)
  add('predictions', a.predictionSpans ? 'predictionSpans' : 'predictions', a.predictionSpans ?? a.predictions)
  add('directives', 'actionRequests', p.actionRequests)
  add('namedEntities', 'namedEntities', a.namedEntities)
  add('context', 'contextUnits', a.contextUnits)
  add('themeAnchors', 'themeAnchors', a.themeAnchors)
  for (const q of qByPost.get(p.postNum) ?? []) {
    const s = String(q.literal ?? q.text)
    out.push({ kind: 'questions', field: `questions.json#${q.id}`, index: q.id, text: s, hits: occurrencesOfSpan(p.text, s) })
  }
  return out
}

console.log(`${rows.length} row(s)${family ? ` in ${family}` : ''}${rows.length !== laneB.length ? ` (of ${laneB.length} lane B)` : ''}\n`)

// COMPACT — the same evidence, minus the full drop listing and the full record table, for reading
// a whole family at once. Only the lines the span touches and the records that overlap it.
if (argv.includes('--compact')) {
  for (const [n, r] of rows.entries()) {
    const p = postByNum.get(r.postNum)
    const body = runtimeText(p.text ?? '')
    const src = sourceLines(p.text ?? '')
    const lines = String(p.text ?? '').split('\n')
    const isLink = l => /^\s*(https?:|www\.)|^\s*>>\d+\s*$/i.test(l)
    console.log('-'.repeat(96))
    console.log(`[${from + n}] #${r.postNum} ${r.kind} ${r.start ?? ''}..${r.end ?? ''}  ${r.conflictId}`)
    if (r.start !== undefined) {
      console.log(`  SPAN  ${JSON.stringify(body.slice(r.start, r.end))}`)
      console.log(`  over ${r.sentencesTouched} sentences: ${(r.sentenceIds ?? []).join(' ')}`)
    } else {
      console.log(`  UNLOCATED ${JSON.stringify(r.certifiedValue)}`)
    }
    let o = 0
    const touched = []
    for (let i = 0; i < lines.length; i++) {
      const s0 = runtimeText(String(p.text).slice(0, o)).length
      const s1 = s0 + runtimeText(lines[i]).length
      const hit = r.start === undefined ? false : (s1 > r.start && s0 < r.end)
      touched.push({ i, s0, s1, hit, flag: isLink(lines[i]) ? 'L' : src.has(i) ? 'Q' : '.', text: lines[i] })
      o += lines[i].length + 1
    }
    console.log('  DROP:')
    for (const t of touched) console.log(`    ${t.hit ? '>' : ' '}${t.flag} ${String(t.i).padStart(2)} @${String(t.s0).padStart(4)} ${JSON.stringify(t.text).slice(0, 120)}`)
    const bad = touched.filter(t => t.hit && (t.flag !== '.'))
    if (bad.length) console.log(`  !! span covers ${bad.length} non-prose line(s): ${bad.map(t => t.i + '=' + t.flag).join(' ')}`)
    const all = recordsOn(p)
    const ovl = all.filter(rec => r.start !== undefined && rec.hits.some(([s, e]) => s < r.end && e > r.start))
    console.log('  OVERLAPPING RECORDS:')
    for (const rec of ovl) console.log(`    ${(CAT[rec.kind] ?? rec.kind).padEnd(12)} ${rec.hits.map(([s, e]) => `${s}..${e}`).join(',').padEnd(12)} ${JSON.stringify(rec.text).slice(0, 100)}`)
    if (r.reason === 'SAME_CATEGORY_PARTIAL_OVERLAP') console.log(`  PAIR: ${r.certifiedValue}${r.nested ? '   [NESTED]' : ''}`)
    const ov = (overlayByPost.get(r.postNum) ?? []).filter(x => r.start === undefined || (x.start !== null && x.start < r.end && x.end > r.start))
    if (ov.length) console.log(`  PRIOR: ${ov.map(x => `${x.actionId}(${x.primaryCategory ?? 'none'}${x.withdrawn ? ',withdrawn' : ''})`).join(' ')}`)
  }
  process.exit(0)
}

for (const [n, r] of rows.entries()) {
  const p = postByNum.get(r.postNum)
  const body = runtimeText(p.text ?? '')
  const sentences = sentencesFor(p.text, r.postNum)
  const src = sourceLines(p.text ?? '')
  const lines = String(p.text ?? '').split('\n')

  console.log('='.repeat(100))
  console.log(`[${from + n}] ${r.conflictId}`)
  console.log(`     post #${r.postNum} · ${r.reason} :: ${r.subtype} · layer ${CAT[r.kind] ?? r.kind}`)
  console.log('='.repeat(100))

  // ── the drop, line by line, with quoted/pasted/link boundaries marked ──────
  console.log('\n  THE DROP (line: L=link  Q=quoted/pasted source  .=Q-authored prose)')
  let off = 0
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const isLink = /^\s*(https?:|www\.)|^\s*>>\d+\s*$/i.test(l)
    const flag = isLink ? 'L' : src.has(i) ? 'Q' : '.'
    const runStart = runtimeText(String(p.text).slice(0, off)).length
    console.log(`    ${flag} ${String(i).padStart(3)} @${String(runStart).padStart(5)}  ${JSON.stringify(l).slice(0, 150)}`)
    off += l.length + 1
  }
  if (src.size) console.log(`    source-line reasons: ${[...src.entries()].map(([i, why]) => `${i}=${why}`).join(' · ')}`)

  // ── the sentence ledger ───────────────────────────────────────────────────
  console.log('\n  SENTENCES (the geometry a span is measured against)')
  for (const s of sentences) console.log(`    ${s.sentenceId}  ${String(s.start).padStart(5)}..${String(s.end).padEnd(5)} ${JSON.stringify(body.slice(s.start, s.end)).slice(0, 130)}`)

  // ── the stored record ─────────────────────────────────────────────────────
  console.log('\n  THE STORED RECORD')
  if (r.reason === 'SAME_CATEGORY_PARTIAL_OVERLAP') {
    console.log(`    two spans of ONE category overlap:`)
    console.log(`    ${r.certifiedValue}`)
    console.log(`    sentence ${r.sentenceId ?? '(n/a)'}${r.nested ? ' · NESTED (one contains the other)' : ''}`)
  } else if (r.reason === 'UNLOCATED_SPAN') {
    console.log(`    ${CAT[r.kind] ?? r.kind}: ${JSON.stringify(r.certifiedValue)}`)
    console.log(`    UNLOCATED — no registered spelling of this is findable in the drop, so it binds to no characters and can never paint.`)
  } else {
    console.log(`    key   ${r.heldKey}`)
    console.log(`    span  ${r.start}..${r.end}  (${r.end - r.start} chars, ${r.sentencesTouched} sentences: ${(r.sentenceIds ?? []).join(', ')})`)
    console.log(`    text  ${JSON.stringify(r.certifiedValue)}`)
    const atOffsets = body.slice(r.start, r.end)
    console.log(`    body  ${JSON.stringify(atOffsets)}`)
    if (atOffsets !== r.certifiedValue) console.log(`    !! the stored text and the body at those offsets DIFFER`)
    // which lines the span covers, and whether any of them is source material
    const covered = []
    let o2 = 0
    for (let i = 0; i < lines.length; i++) {
      const s0 = runtimeText(String(p.text).slice(0, o2)).length
      const s1 = s0 + runtimeText(lines[i]).length
      if (s1 > r.start && s0 < r.end) covered.push({ i, isSource: src.has(i), isLink: /^\s*(https?:|www\.)|^\s*>>\d+\s*$/i.test(lines[i]) })
      o2 += lines[i].length + 1
    }
    console.log(`    covers lines ${covered.map(c => `${c.i}${c.isSource ? '[Q]' : ''}${c.isLink ? '[L]' : ''}`).join(', ')}`)
    const swallowed = covered.filter(c => c.isSource || c.isLink)
    if (swallowed.length) console.log(`    !! the span covers ${swallowed.length} non-Q-prose line(s) — quoted/pasted material or a link`)
  }

  // ── competing records over the same characters ────────────────────────────
  const all = recordsOn(p)
  const competing = all.filter(rec => rec.hits.some(([s, e]) =>
    r.start !== undefined ? (s < r.end && e > r.start) : true))
  console.log('\n  EVERY CERTIFIED RECORD ON THIS DROP')
  for (const rec of all) {
    const overlaps = r.start !== undefined && rec.hits.some(([s, e]) => s < r.end && e > r.start)
    const at = rec.hits.length ? rec.hits.map(([s, e]) => `${s}..${e}`).join(',') : 'UNLOCATED'
    console.log(`    ${overlaps ? '>>' : '  '} ${(CAT[rec.kind] ?? rec.kind).padEnd(13)} ${at.padEnd(14)} ${JSON.stringify(rec.text).slice(0, 110)}`)
  }

  // ── provenance ────────────────────────────────────────────────────────────
  const ov = (overlayByPost.get(r.postNum) ?? []).filter(o =>
    r.start === undefined || (o.start !== null && o.start < r.end && o.end > r.start))
  console.log('\n  PROVENANCE (Step 3B-1 overlay rows touching this span)')
  if (!ov.length) console.log('    none — this record has never been adjudicated by an applied action')
  for (const o of ov) {
    console.log(`    ${o.actionId} · ${o.ruleCode ?? '-'} · primary=${o.primaryCategory ?? 'none'}${o.withdrawn ? ' · WITHDRAWN' : ''}`)
    if (o.adjudicationReason) console.log(`       ${o.adjudicationReason.slice(0, 200)}`)
  }
  console.log()
}
