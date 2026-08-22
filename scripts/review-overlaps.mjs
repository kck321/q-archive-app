// The 19 same-category primary overlaps, with both spans located and the sentence they sit in.
// Reports only.
//
//   node scripts/review-overlaps.mjs [--from N] [--count N]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const posts = rd('public/data/posts.json')
const dry = rd('audit/occurrence-ledger-dryrun.json')
const byNum = new Map(posts.map(p => [p.postNum, p]))
const argv = process.argv.slice(2)
const val = f => { const i = argv.indexOf(f); return i > -1 ? Number(argv[i + 1]) : null }

const rows = (dry.sameCategoryOverlap ?? []).filter(o => !o.deliberate)
const from = val('--from') ?? 0
const rest = rows.slice(from, from + (val('--count') ?? rows.length))

for (const [i, o] of rest.entries()) {
  const p = byNum.get(o.postNum)
  const body = runtimeText(p.text ?? '')
  const sentences = sentencesFor(p.text, o.postNum)
  const s = sentences.find(x => x.sentenceId === o.sentenceId)
  const src = sourceLines(p.text ?? '')
  const field = o.kind === 'directives' ? 'actionRequests' : (o.kind === 'claims' && p.postAnalysis?.claimSpans ? 'claimSpans' : o.kind)
  const holder = field === 'actionRequests' ? p : p.postAnalysis
  const arr = holder?.[field] ?? []

  const locate = t => { const h = occurrencesOfSpan(p.text, t); return h.length ? h : null }
  const la = locate(o.a), lb = locate(o.b)
  console.log('-'.repeat(96))
  console.log(`[${from + i}] #${o.postNum} ${o.kind} sentence ${o.sentenceId}${o.nested ? '  NESTED' : ''}`)
  console.log(`  SENTENCE ${s ? `${s.start}..${s.end}` : '?'}  ${JSON.stringify(s ? body.slice(s.start, s.end) : '').slice(0, 220)}`)
  console.log(`  A ${la ? la.map(([x, y]) => `${x}..${y}`).join(',') : 'UNLOCATED'}  ${JSON.stringify(o.a)}`)
  console.log(`  B ${lb ? lb.map(([x, y]) => `${x}..${y}`).join(',') : 'UNLOCATED'}  ${JSON.stringify(o.b)}`)
  // is either one exactly the sentence?
  if (s) {
    const sen = body.slice(s.start, s.end)
    console.log(`  A === sentence: ${o.a === sen}   B === sentence: ${o.b === sen}`)
  }
  // every record of this kind on the drop, so the right survivor is visible
  console.log(`  ALL ${field} ON #${o.postNum}:`)
  arr.forEach((t, idx) => {
    const h = occurrencesOfSpan(p.text, String(t))
    console.log(`    [${idx}] ${(h.length ? h.map(([x, y]) => `${x}..${y}`).join(',') : 'UNLOCATED').padEnd(14)} ${JSON.stringify(String(t)).slice(0, 130)}`)
  })
  const lines = String(p.text ?? '').split('\n')
  const flagged = [...src.keys()]
  if (flagged.length) console.log(`  quoted/pasted lines: ${flagged.join(', ')} of ${lines.length}`)
}
console.log(`\n${rows.length} overlap rows total`)
