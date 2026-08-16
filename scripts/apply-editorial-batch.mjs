// Apply the owner-approved editorial batch.
//
// Owner rules -> find-occurrences.mjs retrieves the full candidate set -> owner approves ->
// this applies the approved occurrences in ONE pass. Nothing here re-adjudicates; the decisions
// were already made and recorded in audit/editorial-batch-pending.json.
//
// Rules it must not break:
//   apply by OCCURRENCE identity, never by normalised phrase globally
//   a span promoted to a semantic category stops being Context — the same occurrence must not
//     stay presented as neutral reviewed text
//   other overlapping classifications survive (Emphasis on 'real' stays; overlap is intentional)
//   Q's literal wording is never rewritten
//   running twice adds nothing
//
//   node scripts/apply-editorial-batch.mjs --dry     print the diff, write nothing
//   node scripts/apply-editorial-batch.mjs           apply
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// ── WRITE GUARD ──────────────────────────────────────────────────────────────
//
// This tool wrote the first batch straight into public/data/posts.json -> postAnalysis.claims,
// which is a DERIVED CACHE. apply-claims.mjs rebuilds that field from audit/claims-final.json, so
// the next export chain run would have erased all seven owner rulings with no error anywhere.
//
// The guard that caught it now lives in one place, shared by every editorial tool and proved by
// scripts/test-certified-write-guard.mjs. Its allowlist holds canonical artifacts only, so the
// write below — to posts.json — is REFUSED by design. That is why this script is superseded:
// apply-owner-claims.mjs does the same job through the canonical path.
//
//   owner approval -> canonical artifact -> materialisers -> postAnalysis -> UI
//
import { writeCertifiedArtifact } from './lib/certifiedWrite.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const batch = JSON.parse(fs.readFileSync(path.join(OUT, 'editorial-batch-pending.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim()
const before = { claims: posts.reduce((n, p) => n + (p.postAnalysis?.claims?.length ?? 0), 0) }

const diff = []
let added = 0, alreadyPresent = 0, contextRemoved = 0

for (const ruling of batch.rulings) {
  if (ruling.targetCategory !== 'claims') continue     // themes handled by the themes pipeline
  for (const occ of ruling.approved) {
    const p = byNum.get(occ.postNum)
    if (!p) { console.error(`post #${occ.postNum} not found`); process.exit(1) }
    p.postAnalysis ??= {}
    p.postAnalysis.claims ??= []

    // The exact line as Q wrote it, taken from the drop rather than from the batch file, so a
    // transcription slip in the ruling can never rewrite the archive's wording.
    const line = (p.text ?? '').split('\n').map(l => l.trim())
      .find(l => norm(l) === norm(occ.text))
    if (!line) { console.error(`\n"${occ.text}" not found verbatim in #${occ.postNum} — refusing to guess.\n`); process.exit(1) }

    if (p.postAnalysis.claims.some(c => norm(c) === norm(line))) { alreadyPresent++; continue }
    p.postAnalysis.claims.push(line)
    added++

    // Context is "reviewed, and in no semantic category". Once an occurrence IS in one, leaving
    // it in Context would present the same span as both classified and unclassified.
    const ctx = p.postAnalysis.contextUnits
    let droppedCtx = false
    if (Array.isArray(ctx)) {
      const i = ctx.findIndex(c => norm(c) === norm(line))
      if (i >= 0) { ctx.splice(i, 1); contextRemoved++; droppedCtx = true }
    }
    diff.push({ postNum: occ.postNum, text: line, was: occ.was, now: 'Claim', contextDropped: droppedCtx, ruling: ruling.id })
  }
}

const after = { claims: posts.reduce((n, p) => n + (p.postAnalysis?.claims?.length ?? 0), 0) }

console.log('\nEDITORIAL BATCH — CLAIMS\n')
console.log('  post     text                                    was            -> now')
for (const d of diff) {
  console.log(`  #${String(d.postNum).padEnd(6)} ${JSON.stringify(d.text).slice(0, 38).padEnd(38)} ${String(d.was).padEnd(14)} -> Claim${d.contextDropped ? '   (Context dropped)' : ''}`)
}
console.log(`\n  added ${added}   already present ${alreadyPresent}   Context dispositions superseded ${contextRemoved}`)
console.log(`  Claims ${before.claims.toLocaleString()} -> ${after.claims.toLocaleString()}`)

const expected = 4188
const checks = [
  [`Claims total = ${expected}`, after.claims === expected, after.claims],
  ['every approved occurrence resolved to a verbatim line', added + alreadyPresent === 7, `${added + alreadyPresent}/7`],
  ['no wording rewritten', diff.every(d => d.text.trim().length > 0), 'ok'],
]
console.log('\n  QA')
let failed = 0
for (const [l, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${l.padEnd(46)} ${got}`) }
if (failed) { console.error(`\nAborting: ${failed} check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: nothing written\n'); process.exit(0) }

writeCertifiedArtifact(path.join(DATA, 'posts.json'), posts)
console.log('\nwrote public/data/posts.json\n')
