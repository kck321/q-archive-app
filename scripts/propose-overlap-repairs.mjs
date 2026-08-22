// Proposes the repair for each same-category primary overlap, so the reviewed file states offsets
// that were measured rather than typed. Reports only — nothing is applied, and every proposal is
// checked against the drop by hand before it becomes a disposition.
//
// The shape it looks for, which is what 17 of the 19 turned out to be: the sentence splitter ends
// a sentence at an abbreviation — a middle initial ("Richard A."), a title ("Dr.", "Adm.", "Sen."),
// or "U.S." — so one sentence was certified as a HEAD that stops at the abbreviation and a TAIL
// that starts after it. Neither is the sentence. The repair widens the head to the whole sentence
// and withdraws the tail.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const posts = rd('public/data/posts.json')
const dry = rd('audit/occurrence-ledger-dryrun.json')
const byNum = new Map(posts.map(p => [p.postNum, p]))

const seen = new Set()
const out = []
for (const o of (dry.sameCategoryOverlap ?? []).filter(x => !x.deliberate)) {
  const k = `${o.postNum}|${o.sentenceId}`
  if (seen.has(k)) continue          // one repair per SENTENCE, however many pairs it produced
  seen.add(k)
  const p = byNum.get(o.postNum)
  const body = runtimeText(p.text ?? '')
  const s = sentencesFor(p.text, o.postNum).find(x => x.sentenceId === o.sentenceId)
  const field = o.kind === 'directives' ? 'actionRequests'
    : (o.kind === 'claims' && p.postAnalysis?.claimSpans ? 'claimSpans' : o.kind)
  const holder = field === 'actionRequests' ? p : p.postAnalysis
  const arr = holder?.[field] ?? []

  // every record of this kind that lies inside the sentence
  const inside = []
  arr.forEach((t, idx) => {
    for (const [a, b] of occurrencesOfSpan(p.text, String(t))) {
      if (a >= s.start && b <= s.end) inside.push({ idx, start: a, end: b, text: String(t) })
    }
  })
  inside.sort((x, y) => x.start - y.start || y.end - x.end)
  const exact = inside.find(r => r.start === s.start && r.end === s.end)
  const head = inside[0]
  const tails = inside.filter(r => r !== head)

  out.push({
    conflictSentence: `${o.postNum}|${o.sentenceId}`,
    postNum: o.postNum, kind: o.kind, sentenceId: o.sentenceId,
    sentence: { start: s.start, end: s.end, text: body.slice(s.start, s.end) },
    alreadyExact: Boolean(exact),
    records: inside.map(r => ({ key: `${o.postNum}|${o.kind}|${r.start}|${r.end}`, text: r.text })),
    proposal: exact
      ? { keep: `${o.postNum}|${o.kind}|${exact.start}|${exact.end}`,
          withdraw: inside.filter(r => r !== exact).map(r => `${o.postNum}|${o.kind}|${r.start}|${r.end}`) }
      : { widen: `${o.postNum}|${o.kind}|${head.start}|${head.end}`,
          to: { start: s.start, end: s.end, expectText: body.slice(s.start, s.end) },
          withdraw: tails.map(r => `${o.postNum}|${o.kind}|${r.start}|${r.end}`) },
  })
}

fs.writeFileSync(path.join(ROOT, 'audit', 'overlap-repair-proposal.json'),
  JSON.stringify({ note: 'Proposal only. Measured from the ledger; reviewed by hand before it becomes a disposition.', sentences: out.length, rows: out }, null, 2) + '\n')

for (const r of out) {
  console.log(`#${r.postNum} ${r.sentenceId}  ${r.records.length} records  ${r.alreadyExact ? 'one is EXACT' : 'none is the sentence'}`)
  console.log(`   sentence ${r.sentence.start}..${r.sentence.end} ${JSON.stringify(r.sentence.text).slice(0, 120)}`)
  for (const rec of r.records) console.log(`     ${rec.key.padEnd(24)} ${JSON.stringify(rec.text).slice(0, 110)}`)
  console.log(`   -> ${JSON.stringify(r.proposal).slice(0, 300)}`)
}
console.log(`\n${out.length} sentences  ->  audit/overlap-repair-proposal.json`)
