// STEP 3B-1 — the 10 held actions, with the evidence needed to rule on each.
//
//   node scripts/adjudicate-step3b1-held.mjs
//
// Reports only. Writes audit/step3b1-held-evidence.json and prints a per-row dossier.
//
// A held action is one apply-step3b1.mjs refused to touch. The plan records WHY it was held, but
// the hold reasons were written against the bundle as it stood when the plan was generated, and
// the abbreviation/sentence-boundary repair (ba8ff32) landed after several of them. So every hold
// reason is re-tested here against the bundle as it is now, rather than restated.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { classify } from './lib/shapeRules.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const overlay = JSON.parse(fs.readFileSync(path.join(DATA, 'semantics.json'), 'utf8'))
const ledger = JSON.parse(fs.readFileSync(path.join(OUT, 'occurrence-ledger.json'), 'utf8'))
const plan = fs.readFileSync(path.join(OUT, 'step3b1-plan.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l))

const held = plan.filter(a => a.humanReviewRequired).sort((a, b) => a.actionId.localeCompare(b.actionId))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const live = new Map()
for (const r of ledger.records) {
  if (!live.has(r.key)) live.set(r.key, [])
  live.get(r.key).push(r)
}

const rows = held.map(h => {
  const p = byNum.get(h.postNum)
  const body = runtimeText(p?.text ?? '')
  const sentences = sentencesFor(p?.text ?? '', h.postNum)

  // What the sentence ledger says TODAY about the region the action's records occupy. The plan's
  // own sentenceStart/sentenceEnd are reported beside it, never instead of it.
  const keys = h.oldOccurrenceKeys ?? []
  const bounds = keys.map(k => k.split('|')).map(([, , s, e]) => [Number(s), Number(e)])
  const lo = Math.min(...bounds.map(b => b[0])), hi = Math.max(...bounds.map(b => b[1]))
  const touched = sentences.filter(s => s.start < hi && lo < s.end)
  const named = sentences.find(s => s.sentenceId === h.sentenceId) ?? null

  const records = keys.map(k => {
    const recs = live.get(k) ?? []
    return { occurrenceKey: k, liveRecordCount: recs.length,
      kind: k.split('|')[1], start: Number(k.split('|')[2]), end: Number(k.split('|')[3]),
      text: recs[0]?.text ?? null, relation: recs[0]?.relation ?? null }
  })

  // Every primary record now sitting anywhere on the sentences these records touch, so the
  // resulting state of any decision can be stated exactly rather than guessed.
  const onTouched = ledger.records.filter(r => r.postNum === h.postNum && r.layer === 'primary'
    && touched.some(s => r.start < s.end && s.start < r.end))

  // Is the union of the records' offsets the whole sentence, or is text left bare?
  const cover = named ? (() => {
    const painted = new Set()
    for (const r of onTouched) for (let i = Math.max(r.start, named.start); i < Math.min(r.end, named.end); i++) painted.add(i)
    const total = named.end - named.start
    return { sentenceChars: total, paintedChars: painted.size, fullyCovered: painted.size === total }
  })() : null

  // THE RULE, RE-RUN ON THE SENTENCE IT WAS NEVER SHOWN.
  //
  // classify('') fails R1, R5, R2, R3 and R2B in turn and falls out of the bottom at
  // R4_DECLARATIVE, because the last test is `kinds.includes('claims')` and nothing before it can
  // match an empty string. That is why six rows carry R4_DECLARATIVE: not a reading of the
  // sentence, but the absence of one. Given the measured text, the same cascade — the same file,
  // imported, not a paraphrase — returns what it would have returned all along.
  const kinds = [...new Set(keys.map(k => k.split('|')[1]))]
  const reclassified = named ? classify(named.text, kinds) : null
  const asPlanned = classify(h.sentenceText ?? '', kinds)

  return {
    actionId: h.actionId, ruleCode: h.ruleCode, kind: h.kind, postNum: h.postNum,
    heldReason: h.heldReason ?? null,
    ruleReRun: { onPlanText: asPlanned, onMeasuredSentence: reclassified,
      ruleChanges: Boolean(reclassified && reclassified.rule !== asPlanned.rule) },
    plan: {
      sentenceId: h.sentenceId, sentenceStart: h.sentenceStart, sentenceEnd: h.sentenceEnd,
      sentenceText: h.sentenceText, proposedPrimaryCategory: h.proposedPrimaryCategory,
      proposedSecondarySemantics: (h.proposedSecondarySemantics ?? []).map(s => s.category),
      sourceDisposition: h.sourceDisposition, oldCategories: h.oldCategories,
      excessRecordsRemoved: h.excessRecordsRemoved ?? null,
    },
    measuredNow: {
      namedSentence: named ? { sentenceId: named.sentenceId, start: named.start, end: named.end, text: named.text } : null,
      planGeometryAgreesWithLedger: Boolean(named && named.start === h.sentenceStart && named.end === h.sentenceEnd),
      planTextIsTheWholeSentence: Boolean(named && named.text === h.sentenceText),
      recordsSpan: [lo, hi],
      recordsSpanText: body.slice(lo, hi),
      sentencesTouched: touched.map(s => ({ sentenceId: s.sentenceId, start: s.start, end: s.end, text: s.text })),
      records,
      otherPrimaryOnTheseSentences: onTouched.map(r => ({ key: r.key, kind: r.kind, text: r.text.slice(0, 90) })),
      coverage: cover,
      alreadyInOverlay: overlay.occurrences.some(o => o.actionId === h.actionId),
    },
  }
})

fs.writeFileSync(path.join(OUT, 'step3b1-held-evidence.json'), JSON.stringify({ heldActions: rows }, null, 1))

for (const r of rows) {
  console.log('='.repeat(100))
  console.log(`${r.actionId}   [${r.ruleCode}]   #${r.postNum}   ${r.kind}`)
  console.log(`  HELD BECAUSE : ${r.heldReason}`)
  console.log(`  PLAN         : primary=${r.plan.proposedPrimaryCategory} secondary=[${r.plan.proposedSecondarySemantics}] source=${r.plan.sourceDisposition}`)
  console.log(`  RULE RE-RUN  : on plan text -> ${r.ruleReRun.onPlanText.primary}/${r.ruleReRun.onPlanText.rule}` +
    (r.ruleReRun.onMeasuredSentence ? `   on measured sentence -> ${r.ruleReRun.onMeasuredSentence.primary}/${r.ruleReRun.onMeasuredSentence.rule}${r.ruleReRun.ruleChanges ? '   <-- CHANGES' : ''}` : '   (no sentence to test)'))
  console.log(`  plan geometry: ${r.plan.sentenceStart}..${r.plan.sentenceEnd}   agrees with ledger: ${r.measuredNow.planGeometryAgreesWithLedger}   text is whole sentence: ${r.measuredNow.planTextIsTheWholeSentence}`)
  if (r.measuredNow.namedSentence) {
    const n = r.measuredNow.namedSentence
    console.log(`  LEDGER SAYS  : ${n.sentenceId} ${n.start}..${n.end}`)
    console.log(`                 ${JSON.stringify(n.text)}`)
  } else console.log(`  LEDGER SAYS  : sentenceId ${r.plan.sentenceId} not found`)
  console.log(`  records span : ${r.measuredNow.recordsSpan[0]}..${r.measuredNow.recordsSpan[1]}  touching ${r.measuredNow.sentencesTouched.length} sentence(s)`)
  for (const rec of r.measuredNow.records)
    console.log(`     ${rec.occurrenceKey}  live=${rec.liveRecordCount} ${rec.relation ?? ''}  ${JSON.stringify(String(rec.text).slice(0, 80))}`)
  if (r.measuredNow.coverage)
    console.log(`  coverage     : ${r.measuredNow.coverage.paintedChars}/${r.measuredNow.coverage.sentenceChars} chars painted   fullyCovered=${r.measuredNow.coverage.fullyCovered}`)
  console.log(`  in overlay   : ${r.measuredNow.alreadyInOverlay}  (must be false — held actions were not applied)`)
}
console.log(`\n-> audit/step3b1-held-evidence.json  (${rows.length} rows)`)
