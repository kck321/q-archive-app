// Apply the certified Directives dataset to production: 2,422 occurrences.
//
// Source of truth: audit/directives-final.json, which is itself gated — reconcile-directives.mjs
// exits non-zero unless sum(families) === occurrences, every directive carries one of the seven
// agreed families, no unit is double-counted across sources, and no NEEDS_CONTEXT record is in
// the total.
//
// Directives live on the post as `actionRequests` (a string[]) plus a parallel
// `directiveFamilies` map, so the existing UI keeps working while gaining families. In-post
// repeats are preserved: Q writes "Trace background." twice in #1008, and that is two
// directives, exactly as "Coincidence?" twice in #1176 is two questions.
//
// The 228 Question <-> Directive overlaps are INTENTIONAL. An information-request imperative
// ("Define 'Projection'.") and a directive-wrapped question ("Ask yourself, why...?") each
// count once in Questions and once in Directives, never twice inside either.
//
// Idempotent: rebuilds actionRequests from the certified artifact each run, so an export cannot
// silently revert it.
//
//   node scripts/apply-directives.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8')).filter(q => !q.editorialNormalization)
const final = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/directives-final.json'), 'utf8'))

const FAMILIES = ['cognition', 'research', 'morale', 'attention', 'operational', 'dissemination', 'prohibition']
const flat = t => clean(t).replace(/\s+/g, ' ').trim()

const byPost = new Map()
for (const r of final.rows) {
  if (!byPost.has(r.postNum)) byPost.set(r.postNum, [])
  byPost.get(r.postNum).push(r)
}

let written = 0, cleared = 0
for (const p of posts) {
  const list = byPost.get(p.postNum)
  if (!list?.length) {
    if (p.actionRequests?.length) cleared++
    p.actionRequests = []
    p.hasRequests = false
    delete p.directiveFamilies
    continue
  }
  p.actionRequests = list.map(r => r.qSourceText)
  p.hasRequests = true
  // family + overlap metadata, keyed by the normalised text so the UI can look it up
  p.directiveFamilies = {}
  for (const r of list) {
    p.directiveFamilies[key(r.qSourceText)] = {
      family: r.family,
      alsoQuestion: Boolean(r.alsoCertifiedQuestion),
    }
  }
  written += list.length
}

// ── QA gate ─────────────────────────────────────────────────────────────────
const all = posts.flatMap(p => (p.actionRequests ?? []).map(t => ({ postNum: p.postNum, text: t })))
const bodyOf = new Map(posts.map(p => [p.postNum, flat(p.text ?? '')]))
const unresolved = all.filter(d => !bodyOf.get(d.postNum)?.includes(flat(d.text)))

const famTally = {}
for (const p of posts) for (const v of Object.values(p.directiveFamilies ?? {})) famTally[v.family] = (famTally[v.family] ?? 0) + 1
const distinct = new Set(all.map(d => key(d.text)))
const postsWith = new Set(all.map(d => d.postNum))

const qKeys = new Set(questions.map(q => `${q.postNum}|${key(q.text)}`))
const qSrc = new Set(questions.filter(q => q.directiveSource).map(q => `${q.postNum}|${key(q.directiveSource)}`))
const overlap = all.filter(d => qKeys.has(`${d.postNum}|${key(d.text)}`) || qSrc.has(`${d.postNum}|${key(d.text)}`))

// A directive must never be counted twice INSIDE the directives section: the same text at the
// same post may repeat only as often as the certified dataset says Q wrote it.
const groups = new Map()
for (const d of all) { const k = `${d.postNum}|${key(d.text)}`; groups.set(k, (groups.get(k) ?? 0) + 1) }
const certGroups = new Map()
for (const r of final.rows) { const k = `${r.postNum}|${key(r.qSourceText)}`; certGroups.set(k, (certGroups.get(k) ?? 0) + 1) }
const countMismatch = [...groups].filter(([k, n]) => certGroups.get(k) !== n)

const checks = [
  ['directive occurrences = 2,422', all.length === 2422, all.length],
  ['all resolve to a source span', unresolved.length === 0, `${all.length - unresolved.length}/${all.length}`],
  ['distinct = 1,472', distinct.size === 1472, distinct.size],
  ['posts with a directive = 1,417', postsWith.size === 1417, postsWith.size],
  // directiveFamilies is a map keyed by normalised text PER POST, so the 53 in-post repeats
  // share one entry: 2,422 occurrences - 53 repeats = 2,369 keys. The occurrence-level
  // invariant (sum of families === 2,422) is enforced upstream by reconcile-directives.mjs;
  // what matters here is that every distinct (post, text) pair carries a family.
  ['every (post, text) pair has a family', Object.values(famTally).reduce((a, b) => a + b, 0) === groups.size, `${Object.values(famTally).reduce((a, b) => a + b, 0)}/${groups.size} keys (${all.length} occurrences incl. ${all.length - groups.size} repeats)`],
  ['every family is one of the seven', Object.keys(famTally).every(f => FAMILIES.includes(f)), Object.keys(famTally).join(', ')],
  ['Question overlap = 228', overlap.length === 228, overlap.length],
  ['no directive counted twice in-section', countMismatch.length === 0, `${countMismatch.length} mismatch(es)`],
]

console.log('\nAPPLY CERTIFIED DIRECTIVES\n')
console.log(`  directives written        : ${written.toLocaleString()}`)
console.log(`  posts cleared of old rows : ${cleared.toLocaleString()}`)
console.log('\n  by family:')
for (const f of FAMILIES) console.log(`    ${String(famTally[f] ?? 0).padStart(5)}  ${f}`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(38)} ${got}`) }
for (const u of unresolved.slice(0, 6)) console.log(`      unresolved: #${u.postNum} ${JSON.stringify(u.text.slice(0, 58))}`)
for (const [k, n] of countMismatch.slice(0, 6)) console.log(`      count: ${k} wrote ${n}, certified ${certGroups.get(k)}`)

if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: posts.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'posts.json'), JSON.stringify(posts))
console.log(`\nwrote public/data/posts.json (${(fs.statSync(path.join(DATA, 'posts.json')).size / 1048576).toFixed(1)} MB)\n`)
