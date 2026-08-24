// THE OWNER'S RULINGS ON THE UNHIGHLIGHTED-SENTENCE QUEUE — every round, in one list.
//
// The queue was reviewed twice. Round 1 (2026-08-20) ruled 6,108 lines out of the transcribed
// census; round 2 (2026-08-24) ruled 2,802 more out of the census re-measured against the
// rendered DOM. Both are canonical records, neither supersedes the other, and SIX materialisers
// read them — claims, codes, context units, directives, entities and questions.
//
// They read them through here rather than each opening a path of its own. That is the same
// lesson lib/step3b1Sets.mjs records: when a second copy of a list exists, one of the copies goes
// short, and nothing fails loudly when it does — a materialiser still quietly certified from
// round 1 would simply omit round 2's rows and report success.
//
// ORDER IS ROUND ORDER, and it matters. Every consumer inserts the SHORTFALL between what a
// ruling asks for and what the artifact already holds, so a line ruled in both rounds is
// certified once, by whichever round is read first.
import fs from 'node:fs'
import path from 'node:path'

/** The rulings artifacts, oldest first. A missing file is not an error — a fresh clone still runs. */
export const QUEUE_RULING_FILES = [
  'audit/unhighlighted-owner-rulings.json',
  'audit/unhighlighted-owner-rulings-2.json',
]

/**
 * Every ruling from every round, concatenated.
 *
 * @param root repo root
 * @param section optional — return only this section's rulings
 */
export function loadQueueRulings(root, section) {
  const out = []
  for (const rel of QUEUE_RULING_FILES) {
    const file = path.join(root, rel)
    if (!fs.existsSync(file)) continue
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const r of doc.rulings ?? []) {
      if (section && r.section !== section) continue
      out.push(r)
    }
  }
  return out
}

/** Per-round counts, for a materialiser that reports what it read. */
export function queueRulingRounds(root) {
  return QUEUE_RULING_FILES.map(rel => {
    const file = path.join(root, rel)
    if (!fs.existsSync(file)) return { file: rel, present: false, rulings: 0 }
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { file: rel, present: true, ruledOn: doc.ruledOn, rulings: (doc.rulings ?? []).length }
  })
}
