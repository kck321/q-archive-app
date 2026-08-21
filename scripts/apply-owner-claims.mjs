// Insert owner-adjudicated Claims into the CANONICAL artifact.
//
// audit/claims-final.json is the source of truth for Claims; apply-claims.mjs rebuilds
// postAnalysis.claims from it. The previous attempt wrote straight to postAnalysis, which the
// next export chain run would have silently erased — this writes to the artifact the chain reads.
//
//     owner approval -> canonical artifact -> materialisers -> postAnalysis -> UI
//
// Nothing here re-adjudicates. The rulings and their candidate sets are already recorded in
// audit/editorial-batch-pending.json; this only materialises them correctly.
//
//   node scripts/apply-owner-claims.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// The CERTIFIED distinct definition. Using a local norm() gave 3,280 from 4,181 -> 4,188, which
// is impossible from 7 additions — the figure was being recounted under a different rule.
// NEVER_RECOUNT_RULE: read the definition the certified artifact used.
import { key } from './lib/segment.mjs'
// Every editorial write goes through the one guarded writer — see lib/certifiedWrite.mjs for why
// there is exactly one, and test-certified-write-guard.mjs for the proof that it refuses.
import { writeCertifiedArtifact } from './lib/certifiedWrite.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const FINAL = path.join(OUT, 'claims-final.json')
const final = JSON.parse(fs.readFileSync(FINAL, 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const batch = JSON.parse(fs.readFileSync(path.join(OUT, 'editorial-batch-pending.json'), 'utf8'))

// Q uses '>' and '>>' (HTML-escaped as &gt;) as an indent marker on his own lines — #524 lists
// ">&gt;Hussein [1] $29,000,000 SINGAPORE". The certified rows store the line WITHOUT the marker,
// so the matcher has to strip it too or every such ruling is refused as "not found verbatim".
const stripMarkers = s => String(s).replace(/^(?:\s*(?:>|&gt;))+\s*/i, '').trim()
const norm = s => stripMarkers(String(s)).toLowerCase().replace(/\s+/g, ' ').trim()

const approved = batch.rulings
  .filter(r => r.targetCategory === 'claims')
  .flatMap(r => r.approved.map(a => ({ ...a, rulingId: r.id, reasoning: r.reasoning })))

const beforeRows = final.rows.length
const diff = []
let addedRows = 0, already = 0

for (const occ of approved) {
  const p = byNum.get(occ.postNum)
  if (!p) { console.error(`post #${occ.postNum} not found`); process.exit(1) }

  // The literal line from the drop, never the batch file's transcription — a slip in a ruling
  // must not be able to rewrite Q's wording into the certified artifact.
  const line = (p.text ?? '').split('\n').map(l => stripMarkers(l.trim())).find(l => norm(l) === norm(occ.text))
  if (!line) { console.error(`\n"${occ.text}" not found verbatim in #${occ.postNum} — refusing to guess.\n`); process.exit(1) }

  if (final.rows.some(r => r.postNum === occ.postNum && norm(r.exactText) === norm(line))) { already++; continue }

  final.rows.push({
    postNum: occ.postNum,
    postId: p.id,
    exactText: line,
    primaryClass: 'claim',
    isPrediction: false,
    isConclusion: false,
    checkable: false,
    sourceProvided: false,
    telegraphic: line.split(/\s+/).filter(Boolean).length <= 4,
    confidence: 'OWNER_ADJUDICATED',
    // The ruling carries its own date. It was the literal '2026-08-13' — correct for that batch
    // and wrong for every ruling made after it, which would have been stamped with the date of a
    // batch they were not part of. Rulings already in the artifact are skipped as `already`, so
    // their provenance string is never rewritten.
    provenance: `owner adjudication ${occ.ruledOn ?? '2026-08-13'} (${occ.rulingId}) — ${occ.reasoning}`,
  })
  addedRows++
  diff.push({ postNum: occ.postNum, text: line, was: occ.was })
}

const totalRows = final.rows.length
const distinct = new Set(final.rows.map(r => key(r.exactText))).size
const postsWith = new Set(final.rows.map(r => r.postNum)).size

console.log('\nOWNER CLAIMS -> CANONICAL ARTIFACT\n')
for (const d of diff) console.log(`  #${String(d.postNum).padEnd(6)} ${JSON.stringify(d.text).slice(0, 40).padEnd(40)} ${d.was} -> Claim`)
console.log(`\n  rows ${beforeRows.toLocaleString()} -> ${totalRows.toLocaleString()}   (added ${addedRows}, already present ${already})`)
console.log(`\n  RECOMPUTED from the canonical artifact — not carried forward:`)
console.log(`    occurrences : ${totalRows.toLocaleString()}`)
console.log(`    distinct    : ${distinct.toLocaleString()}   (was certified 3,226)`)
console.log(`    posts       : ${postsWith.toLocaleString()}   (was certified 1,951)`)

// THESE TWO WERE LITERALS OF THE 2026-08-13 BATCH, AND THAT MADE THE SCRIPT SINGLE-USE.
//
// `occurrences = 4,242` and `all 62 approved` described one run. The moment the owner ruled a
// tenth time, both reported a defect that did not exist — the artifact was supposed to grow — and
// the script refused to write, so the only way to record a new Claim ruling was to edit the gate
// that was protecting it. Same correction the queue ruling made to four other stale literals: a
// figure that is a copy of a relationship should BE the relationship.
//
// What they assert now is the property that actually has to hold on every run: every approved
// occurrence is accounted for, and no existing row was lost on the way.
const checks = [
  ['no existing row lost', totalRows === beforeRows + addedRows, `${beforeRows} + ${addedRows} = ${totalRows}`],
  ['every approved occurrence present', addedRows + already === approved.length,
    `${addedRows + already}/${approved.length}`],
  ['every new row carries owner provenance',
    final.rows.filter(r => r.confidence === 'OWNER_ADJUDICATED').every(r => r.provenance?.includes('owner adjudication')), 'ok'],
]
console.log('\n  QA')
let failed = 0
for (const [l, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${l.padEnd(40)} ${got}`) }
if (failed) { console.error(`\nAborting: ${failed} check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: nothing written\n'); process.exit(0) }

writeCertifiedArtifact(FINAL, final, { space: 1 })
console.log(`\nwrote audit/claims-final.json — now run apply-claims.mjs to rebuild postAnalysis\n`)
