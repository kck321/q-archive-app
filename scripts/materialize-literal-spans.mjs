// Materialise literal rendering spans for the remaining certified layers.
//
// Claims, Predictions, Conclusions and Checkable Claims are stored decoded and whitespace-
// normalised — the readable form, correct for identity. The renderer matches the raw drop, which
// carries the board's HTML entities and Q's original line breaks, so 694 certified occurrences
// could never mark. Same defect as themes, entities, evidence and context before them.
//
// The certified value is NOT changed. A parallel `*Spans` array carries the literal form for the
// renderer, and where no literal form exists the certified value is kept and the row is reported
// as a certification conflict rather than forced.
//
//   node scripts/materialize-literal-spans.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// Spans resolve against the RUNTIME body — the text the browser renders — never the raw archive
// encoding. See lib/runtimeText.mjs for why 2,475 spans were wrong before this.
import { runtimeSpan as literalSpan } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questionsFile = path.join(DATA, 'questions.json')
const questions = JSON.parse(fs.readFileSync(questionsFile, 'utf8'))

const FIELDS = [
  ['claims', 'claimSpans'],
  ['predictions', 'predictionSpans'],
  ['impliedConclusions', 'conclusionSpans'],
  ['verificationHooks', 'checkableSpans'],
]

const stats = {}
const unresolved = []

for (const p of posts) {
  const a = p.postAnalysis
  if (!a) continue
  const raw = p.text ?? ''
  for (const [field, spanField] of FIELDS) {
    const items = a[field] ?? []
    if (!items.length) { delete a[spanField]; continue }
    stats[field] ??= { total: 0, recovered: 0, exact: 0, unresolved: 0 }
    a[spanField] = items.map(t => {
      stats[field].total++
      const lit = literalSpan(raw, t)
      if (lit === t) { stats[field].exact++; return t }
      if (lit) { stats[field].recovered++; return lit }
      stats[field].unresolved++
      unresolved.push({ postNum: p.postNum, field, certified: String(t).slice(0, 140) })
      return t                      // keep the certified value; the conflict is reported, not hidden
    })
  }
}

// QUESTIONS. This lived inside apply-questions-final.mjs, which owns certified MEMBERSHIP — and
// because that step runs earlier in the chain and rewrites questions.json wholesale, a second
// full-chain run silently dropped all 165 literal spans and took the source-boundary debt from
// 103 back to 102. Rendering provenance belongs in one place, after semantics are settled:
//
//   certified semantics -> rendering provenance -> UI
//
// Same reasoning that put the other layers here rather than in their own apply steps.
{
  const rawByNum = new Map(posts.map(p => [p.postNum, p.text ?? '']))
  stats.questions = { total: 0, recovered: 0, exact: 0, unresolved: 0 }
  for (const r of questions) {
    if (r.occurrences === undefined) continue
    stats.questions.total++
    const certified = r.unitText ?? r.text
    const lit = literalSpan(rawByNum.get(r.postNum) ?? '', certified)
    if (lit && lit !== certified) { r.literal = lit; stats.questions.recovered++ }
    else if (lit) { delete r.literal; stats.questions.exact++ }
    else { delete r.literal; stats.questions.unresolved++ }
  }
}

// Occurrence counts must be untouched — a span array is a parallel view, never a new population.
const counts = Object.fromEntries(FIELDS.map(([f]) => [f, posts.reduce((n, p) => n + (p.postAnalysis?.[f]?.length ?? 0), 0)]))
const spanCounts = Object.fromEntries(FIELDS.map(([f, s]) => [f, posts.reduce((n, p) => n + (p.postAnalysis?.[s]?.length ?? 0), 0)]))

const questionLiterals = questions.filter(r => r.literal).length
const checks = [
  // 162, measured. The inline version inside apply-questions-final reported 165 because it ran
  // against a mid-chain state; this step is deterministic from the certified artifacts.
  // 162 -> 2 after resolving against the runtime body instead of the raw archive encoding. The
  // other 160 were entity-form overrides for text the browser never displays.
  ['question literal spans = 2', questionLiterals === 2, questionLiterals],
  ['certified questions unchanged = 6,454', questions.filter(r => r.occurrences !== undefined).length === 6454,
    questions.filter(r => r.occurrences !== undefined).length],
  ['claims unchanged = 4,212', counts.claims === 4212, counts.claims],
  ['predictions unchanged = 595', counts.predictions === 595, counts.predictions],
  ['conclusions unchanged = 965', counts.impliedConclusions === 965, counts.impliedConclusions],
  ['checkable unchanged = 1,925', counts.verificationHooks === 1925, counts.verificationHooks],
  ['every span array matches its source array', FIELDS.every(([f]) => spanCounts[f] === counts[f]), 'ok'],
]

console.log('\nMATERIALISE LITERAL SPANS\n')
for (const [f] of FIELDS) {
  const s = stats[f]
  if (!s) continue
  console.log(`  ${f.padEnd(20)} ${String(s.total).padStart(5)}  already exact ${String(s.exact).padStart(5)}  recovered ${String(s.recovered).padStart(4)}  unresolved ${s.unresolved}`)
}
console.log('\n  QA')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(42)} ${got}`) }

fs.writeFileSync(path.join(OUT, 'literal-span-unresolved.json'), JSON.stringify({ count: unresolved.length, items: unresolved }, null, 1))

if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: posts.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'posts.json'), JSON.stringify(posts))
fs.writeFileSync(questionsFile, JSON.stringify(questions))
console.log(`\nwrote public/data/posts.json`)
console.log('→ audit/literal-span-unresolved.json\n')
