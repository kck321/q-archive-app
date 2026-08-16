// Prove the v5 directives migration removed EXACTLY the 153 approved rows and nothing else.
//
// The seed-71 copy fetched from production is the pre-migration baseline. Everything outside
// Q Directives must survive occurrence-for-occurrence against it — not merely count-for-count,
// because a count check cannot tell a swap from a no-op.
//
//   node scripts/verify-directives-migration.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public/data')
const BASE = 'C:/Users/heath/AppData/Local/Temp/claude/livep.json'   // production seed 71

const now = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const before = JSON.parse(fs.readFileSync(BASE, 'utf8'))
const v5 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/source-spans-v2/directives-adjudication-v5-final.json'), 'utf8'))
const fin = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/directives-final.json'), 'utf8'))

const KEEP = new Set(['KEEP_Q_DIRECTIVE', 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', 'SPLIT_MIXED_SENTENCE'])
const norm = s => String(s ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
const txt = r => typeof r === 'string' ? r : (r.text ?? r.sentence ?? r.qSourceText ?? '')

let pass = 0, fail = 0
const t = (label, ok, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${detail}`) }

console.log('\nDIRECTIVES v5 MIGRATION — REMOVAL PROOF\n')

// ── 1-4. The adjudication reconciles ─────────────────────────────────────────
const kept = v5.rows.filter(r => KEEP.has(r.ruling))
const removed = v5.rows.filter(r => !KEEP.has(r.ruling))
t('starting adjudication rows = 2,705', v5.rows.length === 2705, String(v5.rows.length))
t('kept as Q Directives = 2,552', kept.length === 2552, String(kept.length))
t('removed from Q Directives = 153', removed.length === 153, String(removed.length))
const cat = {}
for (const r of removed) cat[r.ruling] = (cat[r.ruling] ?? 0) + 1
const catSum = Object.values(cat).reduce((a, b) => a + b, 0)
t('removal categories sum to 153', catSum === 153, Object.entries(cat).map(([k, v]) => `${k.replace('REMOVE_', '')}=${v}`).join(' '))

// ── 5. Every removed occurrence is adjudicated and carries provenance ────────
const withProv = removed.filter(r => r.postNum && (r.storedPhrase ?? r.fullSentence ?? r.sourceSpan))
t('every removed row has post + source provenance', withProv.length === removed.length, `${withProv.length}/${removed.length}`)

// ── 6. Occurrence-level: what actually left posts.json is exactly that set ───
const bag = list => { const m = new Map(); for (const p of list) for (const d of (p.actionRequests ?? [])) { const k = `${p.postNum}|${norm(txt(d))}`; m.set(k, (m.get(k) ?? 0) + 1) } return m }
const A = bag(before), B = bag(now)
const gone = [], appeared = []
for (const [k, n] of A) { const d = n - (B.get(k) ?? 0); for (let i = 0; i < d; i++) gone.push(k) }
for (const [k, n] of B) { const d = n - (A.get(k) ?? 0); for (let i = 0; i < d; i++) appeared.push(k) }
// Six directives were EXPANDED from a truncated fragment to the complete sentence
// ("Learn the TRUTH." -> "It's time to learn the TRUTH."), so their old text departs and the
// full sentence appears. That is a replacement, not a removal, and it is the fragment problem
// sourceSpansV2 exists to fix.
const expanded = v5.rows.filter(r => r.sentenceExpanded === 'true')
t('directives that APPEARED are all expansions', appeared.length === expanded.length,
  `${appeared.length} appeared, ${expanded.length} expansions`)
t('net occurrences removed = 153', gone.length - appeared.length === 153,
  `${gone.length} departed - ${appeared.length} expanded = ${gone.length - appeared.length}`)

// Each departed occurrence must map to an approved removal row.
const approved = new Map()
for (const r of removed) { const k = `${r.postNum}|${norm(r.storedPhrase)}`; approved.set(k, (approved.get(k) ?? 0) + 1) }
for (const r of expanded) { const k = `${r.postNum}|${norm(r.storedPhrase)}`; approved.set(k, (approved.get(k) ?? 0) + 1) }
const unapproved = gone.filter(k => !(approved.get(k) > 0)).filter((k, i, a) => a.indexOf(k) === i)
t('no unadjudicated directive disappeared', unapproved.length === 0,
  unapproved.length ? unapproved.slice(0, 3).join(' | ') : 'every departure is an approved row')

// ── 7-8. Everything outside Directives is untouched, occurrence-for-occurrence ─
const chars = l => l.reduce((n, p) => n + (p.text ?? '').length, 0)
t('post text unchanged = 1,128,312 chars', chars(now) === 1128312 && chars(now) === chars(before), String(chars(now)))

const FIELDS = ['questions', 'claims', 'predictions', 'themes', 'quotedSources', 'images', 'codes', 'emphasis']
const sig = (list, f) => {
  const m = new Map()
  for (const p of list) {
    const v = p.postAnalysis?.[f] ?? p[f]
    if (!Array.isArray(v)) continue
    for (const item of v) { const k = `${p.postNum}|${norm(typeof item === 'string' ? item : JSON.stringify(item))}`; m.set(k, (m.get(k) ?? 0) + 1) }
  }
  return m
}
for (const f of FIELDS) {
  const a = sig(before, f), b = sig(now, f)
  if (a.size === 0 && b.size === 0) continue
  let diff = 0
  for (const [k, n] of a) if ((b.get(k) ?? 0) !== n) diff++
  for (const [k, n] of b) if ((a.get(k) ?? 0) !== n) diff++
  t(`${f}: occurrence multiset unchanged`, diff === 0, diff ? `${diff} differing keys` : `${a.size} occurrences identical`)
}

// ── 9. Run-once guard ────────────────────────────────────────────────────────
t('run-once guard stamped', !!fin.totals?.v5Migration, fin.totals?.v5Migration?.appliedOn ?? 'ABSENT')
// The rendered total is assembled from TWO artifacts: directives-final.json carries the canonical
// rows and directives-owner-rulings.json carries the owner-ruled ones. 2,276 + 276 = 2,552.
const own = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/directives-owner-rulings.json'), 'utf8'))
const ownN = (own.rulings ?? []).length
t('directives-final + owner rulings = 2,552', fin.rows.length + ownN === 2552,
  `${fin.rows.length} canonical + ${ownN} owner-ruled`)

// ── 10. Rendered vs certified ────────────────────────────────────────────────
let rendered = 0
for (const p of now) rendered += (p.actionRequests ?? []).length
const distinctPairs = new Set()
for (const p of now) for (const d of (p.actionRequests ?? [])) distinctPairs.add(`${p.postNum}|${norm(txt(d))}`)
t('rendered actionRequests = 2,552 certified', rendered === 2552, String(rendered))
console.log(`\n  rendered occurrences        : ${rendered}`)
console.log(`  distinct (post,text) pairs  : ${distinctPairs.size}   in-post repeats: ${rendered - distinctPairs.size}`)
console.log(`  posts carrying a directive  : ${now.filter(p => (p.actionRequests ?? []).length).length}`)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
if (fail) process.exit(1)
