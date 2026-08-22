// LANE B — turn a reviewed disposition file into applier actions.
//
//   node scripts/build-lane-b-actions.mjs <disposition-file.json> <out.jsonl> <ID-PREFIX>
//
// Writes an action set in the Step 3B-1 schema and prints its sha256 for the pin. It decides
// nothing: every disposition and every reason comes from the reviewed file. What it DOES is
// compute offsets, because a hand-typed offset is a defect waiting to happen — a repair names the
// SENTENCE it should cover and the ledger says where that sentence is.
//
// Dispositions and what each emits:
//   A  keep      no action. Recorded in the report so the row survives the rebuild reviewed.
//   B  repair    SPAN_TRIM onto the named sentence(s), plus any pairedWithdrawal.
//   C  reclass   RECLASSIFY_RECORD — the wording stays, the category moves.
//   D  split     SPLIT_RECORD — one record becomes two over disjoint spans.
//   E  withdraw  WITHDRAW_RECORD.
//   F  unresolved  no action, and the row is reported as intentionally unresolved.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { sentencesFor } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const [inFile, outFile, PREFIX] = process.argv.slice(2)
if (!inFile || !outFile || !PREFIX) {
  console.error('usage: build-lane-b-actions.mjs <dispositions.json> <out.jsonl> <ID-PREFIX>')
  process.exit(1)
}

const disp = JSON.parse(fs.readFileSync(path.resolve(ROOT, inFile), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const postByNum = new Map(posts.map(p => [p.postNum, p]))

/** post|kind|start|end -> the pieces, so an action can be built from a conflictId alone. */
const parseKey = k => { const [n, kind, s, e] = k.split('|'); return { postNum: Number(n), kind, start: Number(s), end: Number(e) } }
const keyOf = c => c.replace(/^[A-Z_]+::/, '').replace(/::\d+$/, '')

const PRIMARY_OF = { claims: 'claim', predictions: 'prediction', questions: 'question', directives: 'directive' }

const actions = []
const problems = []
const kept = []
const unresolved = []

for (const row of disp.rows) {
  const key = keyOf(row.conflictId)
  const { postNum, kind, start, end } = parseKey(key)
  if (postNum !== row.postNum) { problems.push(`${row.conflictId}: post mismatch`); continue }
  const p = postByNum.get(postNum)
  if (!p) { problems.push(`${row.conflictId}: no such drop`); continue }
  const body = runtimeText(p.text ?? '')
  const sentences = sentencesFor(p.text, postNum)
  const byId = new Map(sentences.map(s => [s.sentenceId, s]))

  if (row.disposition === 'A') { kept.push(row); if (!row.pairedWithdrawal) continue }
  if (row.disposition === 'F') { unresolved.push(row); continue }

  // ── the paired withdrawal a KEEP can carry ────────────────────────────────
  // Keeping a wide span is only correct if the fragment nested inside it goes; otherwise the row
  // is "resolved" while the same characters stay painted twice.
  if (row.pairedWithdrawal) {
    const w = parseKey(row.pairedWithdrawal.occurrenceKey)
    if (body.slice(w.start, w.end).length === 0) { problems.push(`${row.conflictId}: paired withdrawal span is empty`); continue }
    actions.push({
      postNum: w.postNum, sentenceId: null, sourceDisposition: 'q_authored',
      oldOccurrenceKeys: [row.pairedWithdrawal.occurrenceKey],
      oldCategories: [`${w.kind}@${w.start}..${w.end}`],
      proposedSecondarySemantics: [], proposedReviewDispositions: [],
      recordsWithdrawn: [row.pairedWithdrawal.occurrenceKey],
      withdrawReason: row.pairedWithdrawal.why,
      metadataTransferred: row.pairedWithdrawal.occurrenceKey, relationshipsPreserved: '',
      confidence: 'HIGH', humanReviewRequired: false,
      actionId: `${PREFIX}-DROP-${w.postNum}-${w.kind}-${w.start}-${w.end}`,
      kind: 'WITHDRAW_RECORD',
      sentenceStart: w.start, sentenceEnd: w.end, sentenceText: body.slice(w.start, w.end),
      proposedPrimaryCategory: null,
      ruleCode: 'LANEB_NESTED_FRAGMENT_WITHDRAWN',
      adjudication: 'A — KEEP_AS_CERTIFIED (wide span) with the nested fragment withdrawn',
      adjudicationReason: row.reason,
      laneBDisposition: row.disposition, laneBFamily: disp.family,
    })
    continue
  }

  if (row.disposition === 'B') {
    let s0, s1
    if (row.trimToSentences) {
      const ss = row.trimToSentences.map(id => byId.get(id))
      if (ss.some(x => !x)) { problems.push(`${row.conflictId}: unknown sentence id`); continue }
      s0 = Math.min(...ss.map(x => x.start)); s1 = Math.max(...ss.map(x => x.end))
    } else if (row.trimToSpan) {
      const a = byId.get(row.trimToSpan.startSentence), b = byId.get(row.trimToSpan.endSentence)
      if (!a || !b) { problems.push(`${row.conflictId}: unknown sentence id in trimToSpan`); continue }
      s0 = a.start; s1 = b.end
    } else { problems.push(`${row.conflictId}: disposition B with no target`); continue }
    const text = body.slice(s0, s1)
    if (!text.trim()) { problems.push(`${row.conflictId}: repaired span is blank`); continue }
    if (s0 === start && s1 === end) { problems.push(`${row.conflictId}: repair is a no-op`); continue }
    actions.push({
      postNum, sentenceId: row.trimToSentences?.length === 1 ? row.trimToSentences[0] : null,
      sourceDisposition: 'q_authored',
      oldOccurrenceKeys: [key], oldCategories: [`${kind}@${start}..${end}`],
      proposedSecondarySemantics: [], proposedReviewDispositions: [],
      recordsWithdrawn: [], withdrawReason: '',
      metadataTransferred: key, relationshipsPreserved: '',
      confidence: 'HIGH', humanReviewRequired: false,
      actionId: `${PREFIX}-SPAN-${postNum}-${kind}-${start}-${end}`,
      kind: 'SPAN_TRIM',
      sentenceStart: s0, sentenceEnd: s1, sentenceText: text,
      proposedPrimaryCategory: PRIMARY_OF[kind] ?? null,
      ruleCode: 'LANEB_SPAN_REPAIR',
      adjudication: 'B — REPAIR_GEOMETRY',
      adjudicationReason: row.reason,
      laneBDisposition: row.disposition, laneBFamily: disp.family,
      ...(s0 < start || s1 > end ? { spanOverride: true, spanOverrideReason: 'the repair WIDENS the span: the stored record stopped inside a unit it was meant to cover' } : {}),
    })
    continue
  }

  if (row.disposition === 'E') {
    actions.push({
      postNum, sentenceId: null, sourceDisposition: row.sourceDisposition ?? 'q_authored',
      oldOccurrenceKeys: [key], oldCategories: [`${kind}@${start}..${end}`],
      proposedSecondarySemantics: [], proposedReviewDispositions: [],
      recordsWithdrawn: [key], withdrawReason: row.reason,
      metadataTransferred: key, relationshipsPreserved: '',
      confidence: 'HIGH', humanReviewRequired: false,
      actionId: `${PREFIX}-DROP-${postNum}-${kind}-${start}-${end}`,
      kind: 'WITHDRAW_RECORD',
      sentenceStart: start, sentenceEnd: end, sentenceText: body.slice(start, end),
      proposedPrimaryCategory: null,
      ruleCode: 'LANEB_RECORD_WITHDRAWN',
      adjudication: 'E — WITHDRAW',
      adjudicationReason: row.reason,
      laneBDisposition: row.disposition, laneBFamily: disp.family,
      ...(row.flagForOwner ? { flaggedForOwner: true } : {}),
    })
    continue
  }

  if (row.disposition === 'C') {
    actions.push({
      postNum, sentenceId: row.sentenceId ?? null, sourceDisposition: 'q_authored',
      oldOccurrenceKeys: [key], oldCategories: [`${kind}@${start}..${end}`],
      proposedSecondarySemantics: [], proposedReviewDispositions: [],
      recordsWithdrawn: [key], withdrawReason: row.reason,
      metadataTransferred: key, relationshipsPreserved: '',
      confidence: 'HIGH', humanReviewRequired: false,
      actionId: `${PREFIX}-RECLASS-${postNum}-${kind}-${start}-${end}`,
      kind: 'RECLASSIFY_RECORD',
      reclassifyTo: row.reclassifyTo,
      sentenceStart: start, sentenceEnd: end, sentenceText: body.slice(start, end),
      proposedPrimaryCategory: row.reclassifyTo,
      ruleCode: 'LANEB_RECLASSIFIED',
      adjudication: 'C — RECLASSIFY',
      adjudicationReason: row.reason,
      laneBDisposition: row.disposition, laneBFamily: disp.family,
    })
    continue
  }

  problems.push(`${row.conflictId}: disposition ${row.disposition} is not buildable yet`)
}

if (problems.length) {
  console.error(`\n[X] ${problems.length} problem(s):`)
  for (const m of problems) console.error('   ' + m)
  process.exit(1)
}

const out = path.resolve(ROOT, outFile)
fs.writeFileSync(out, actions.map(a => JSON.stringify(a)).join('\n') + (actions.length ? '\n' : ''))
const sha = crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex')

const byDisp = disp.rows.reduce((m, r) => ({ ...m, [r.disposition]: (m[r.disposition] ?? 0) + 1 }), {})
console.log(`${disp.family}`)
console.log(`  rows reviewed   : ${disp.rows.length}`)
console.log(`  dispositions    : ${Object.entries(byDisp).sort().map(([k, v]) => `${k}=${v}`).join('  ')}`)
console.log(`  actions written : ${actions.length}   (${actions.filter(a => a.kind === 'SPAN_TRIM').length} repairs, ${actions.filter(a => a.kind === 'WITHDRAW_RECORD').length} withdrawals, ${actions.filter(a => a.kind === 'RECLASSIFY_RECORD').length} reclassifications)`)
console.log(`  kept as certified: ${kept.length}   intentionally unresolved: ${unresolved.length}`)
console.log(`  ${outFile}`)
console.log(`  sha256 ${sha}`)
