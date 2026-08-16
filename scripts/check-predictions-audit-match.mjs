// Dry-run matcher: does every audit record find its row in the certified artifact?
//
// Run this BEFORE applying anything. A record that cannot be located is a transcription
// problem, and applying a partial batch would leave the ledger disagreeing with the data.
//
//   node scripts/check-predictions-audit-match.mjs [P1 P2 ...]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPhase, matchOne, byPost, PHASE_FILES } from './lib/predictionsAudit.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const final = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/claims-final.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const bodyOf = new Map(posts.map(p => [p.postNum, p.text ?? '']))

const predsByPost = byPost(final.predictions)
const claimsByPost = byPost(final.rows)

const wanted = process.argv.slice(2).filter(a => PHASE_FILES[a])
const phases = wanted.length ? wanted : Object.keys(PHASE_FILES)

let totalMiss = 0
for (const phase of phases) {
  const doc = loadPhase(phase)
  if (!doc) { console.log(`${phase.padEnd(3)} — not written yet`); continue }

  const against = doc.matchAgainst
  const tally = { exact: 0, contains: 0, ambiguous: 0, miss: 0, 'empty-match': 0, 'n/a': 0 }
  const problems = []

  for (const r of doc.records) {
    // Additions have nothing to match against in the artifact; their anchor must instead be
    // verbatim in the post body, which is what makes them showable as Q's own words.
    if (against === 'postText') {
      const body = bodyOf.get(r.post) ?? ''
      const norm = s => s.replace(/\s+/g, ' ').trim()
      const ok = norm(body).includes(norm(r.match))
      tally[ok ? 'exact' : 'miss']++
      if (!ok) problems.push(`  #${r.post} rec ${r.n} — anchor not verbatim in post text: ${JSON.stringify(r.match.slice(0, 70))}`)
      continue
    }
    if (against === 'none') { tally['n/a']++; continue }

    const pool = against === 'claims' ? (claimsByPost.get(r.post) ?? []) : (predsByPost.get(r.post) ?? [])
    const res = matchOne(r, pool)
    tally[res.status]++
    if (res.status === 'miss' || res.status === 'ambiguous' || res.status === 'empty-match') {
      problems.push(`  #${r.post} rec ${r.n} [${res.status}] ${JSON.stringify(r.match.slice(0, 70))}` +
        (pool.length ? `\n      post has ${pool.length}: ${pool.map(c => JSON.stringify(c.exactText.slice(0, 55))).join(', ')}` : `\n      post has NO ${against} rows`))
    }
  }

  const bad = tally.miss + tally.ambiguous + tally['empty-match']
  totalMiss += bad
  console.log(`${phase.padEnd(3)} ${String(doc.records.length).padStart(4)} records — exact ${tally.exact}, contains ${tally.contains}, n/a ${tally['n/a']}, PROBLEMS ${bad}`)
  if (problems.length) console.log(problems.join('\n'))
}

console.log(totalMiss === 0 ? '\nAll records located.' : `\n${totalMiss} record(s) unlocated — fix before applying.`)
process.exit(totalMiss === 0 ? 0 : 1)
