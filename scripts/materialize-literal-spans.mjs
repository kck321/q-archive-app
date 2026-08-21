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
  // 2 -> 4: two of the 65 questions the owner ruled out of the unhighlighted-sentence queue were
  // reassembled across a segmenter split, so their certified value carries a single space where
  // the drop has a line break and needs a literal span to paint.
  // 4 -> 7 with the 2026-08-21 segmentation repair. Three of the ten repaired spans now reach text
  // the raw drop encodes differently from the certified value — #2381's runs through "&gt;", the
  // #142 pair through a curly apostrophe — so they need a literal span to paint. That is this
  // step's whole job: the certified value stays readable, the rendering value matches the body.
  // 7 -> 8: one more repaired question reaches text the raw drop encodes differently from the
  // certified value, so it needs a literal span to paint.
  ['question literal spans = 8', questionLiterals === 8, questionLiterals],
  // The three "unchanged" gates below are cross-section CHECKS - this step adds a parallel *Spans
  // array and never a row. They move only when their own materialiser moved them, which is what
  // makes them useful: 6,454 -> 6,519, 4,212 -> 8,928 and 595 -> 842 are the 2026-08-20 queue
  // rulings arriving from apply-questions-final.mjs and apply-claims.mjs, and nothing else.
  // 6,510 since the segmentation repair. "Unchanged" means THIS step must not add or drop one.
  ['certified questions unchanged = 6,503', questions.filter(r => r.occurrences !== undefined).length === 6503,
    questions.filter(r => r.occurrences !== undefined).length],
  // 8,929 since the 2026-08-21 owner ruling on #4923. "Unchanged" means this step must not invent
  // or drop a claim while turning stored text into runtime spans — it is a passthrough assertion,
  // so it tracks whatever apply-claims.mjs certified rather than pinning one batch's figure.
  ['claims unchanged = 8,912', counts.claims === 8912, counts.claims],
  // 843 since the 2026-08-21 ruling on #4910 ("Freedom of information [truth] = END").
  ['predictions unchanged = 843', counts.predictions === 843, counts.predictions],
  ['conclusions unchanged = 964', counts.impliedConclusions === 964, counts.impliedConclusions],
  // 1,925 -> 1,920: five absorbed claim tails carried the checkable attribute. It travels with
  // the ROW, so it leaves with the fragment rather than being re-attached to the repaired span,
  // which the claims audit never adjudicated as checkable.
  ['checkable unchanged = 1,920', counts.verificationHooks === 1920, counts.verificationHooks],
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
