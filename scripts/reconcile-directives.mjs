// (1) Why does the adjudication start at 2,705 when the Directives page says 2,652?
// (2) A regression suite for the authorship detector, because its meaning was inverted once.
// (3) Export the 45 held rows with surrounding context and a proposed destination.
//
// READ-ONLY. Nothing is applied.
//
//   node scripts/reconcile-directives.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const adj = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/directives-religious-adjudication.json'), 'utf8'))
const norm = s => String(s).replace(/\s+/g, ' ').trim()

// ── 1. COUNT RECONCILIATION ──────────────────────────────────────────────────
const all = []
for (const p of posts) for (const r of (p.actionRequests ?? [])) {
  const t = norm(typeof r === 'string' ? r : (r.text ?? r.sentence ?? ''))
  all.push({ post: p.postNum, text: t })
}
const stored = all.length
const nonEmpty = all.filter(r => r.text).length
const distinctPerPost = new Set(all.filter(r => r.text).map(r => r.post + '|' + r.text.toLowerCase())).size
const distinctPhrases = new Set(all.filter(r => r.text).map(r => r.text.toLowerCase())).size
const postsRepresented = new Set(all.filter(r => r.text).map(r => r.post)).size

console.log('\n1. DIRECTIVE COUNT RECONCILIATION\n')
console.log(`  raw stored occurrences (post.actionRequests entries) : ${stored}`)
console.log(`  non-empty occurrences                                : ${nonEmpty}`)
console.log(`  distinct occurrences per post (in-post repeats merged): ${distinctPerPost}`)
console.log(`  distinct phrases corpus-wide                         : ${distinctPhrases}`)
console.log(`  posts represented                                    : ${postsRepresented}`)
console.log(`  in-post duplicates (stored - distinct-per-post)       : ${stored - distinctPerPost}`)
console.log(`\n  adjudication universe                                : ${adj.before}`)
console.log(`  page figure quoted by the owner                       : 2,652 mentions / 1,538 posts`)
console.log(`  difference stored vs page                            : ${stored - 2652}`)

// ── 2. AUTHORSHIP REGRESSION SUITE ───────────────────────────────────────────
const quotedIdx = text => { try { const r = sourceLines(text); return r instanceof Map ? r : new Map() } catch { return new Map() } }
const isQAuthored = (postNum, phrase) => {
  const p = posts.find(x => x.postNum === postNum); if (!p) return null
  const text = clean(p.text ?? ''), lines = text.split(String.fromCharCode(10))
  const q = quotedIdx(text)
  const mine = lines.filter((_, i) => !q.has(i)).map(l => norm(l).toLowerCase())
  return mine.some(l => l.includes(norm(phrase).toLowerCase()))
}
const inQuotedPart = (postNum, phrase) => {
  const p = posts.find(x => x.postNum === postNum); if (!p) return null
  const text = clean(p.text ?? ''), lines = text.split(String.fromCharCode(10))
  const q = quotedIdx(text)
  return [...q.keys()].some(i => norm(lines[i] ?? '').toLowerCase().includes(norm(phrase).toLowerCase()))
}

console.log('\n2. AUTHORSHIP REGRESSION SUITE\n')
let fails = 0
const T = (label, got, want) => { const ok = got === want; if (!ok) fails++; console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(62)} ${got}`) }
// a) a Q-authored command reads as Q-authored
T('#111 "Pray." is Q-authored', isQAuthored(111, 'Pray.'), true)
T('#587 "PRAY." is Q-authored', isQAuthored(587, 'PRAY.'), true)
// b) a command inside an Anonymous post reads as quoted
T('#147 "Pray." also appears in the QUOTED block', inQuotedPart(147, 'Pray.'), true)
// c) a Bible command reproduced by Q is detected in the scripture set
const scripture = adj.rows.filter(r => r.ruling === 'REMOVE_QUOTED_SCRIPTURE')
T('quoted-Scripture commands detected', scripture.length > 0, true)
T('  … "full armor of God" among them', scripture.some(r => /full armor of god/i.test(r.fullSentence)), true)
// d) image-only text never becomes body text
const bodyBlob = posts.map(p => norm(clean(p.text ?? '')).toLowerCase()).join(' ')
T('image-only sentence absent from all body text',
  !bodyBlob.includes('note the satanic cross she wears'), true)
// e) the mixed sentence keeps its whole self and separates its segments
const mixed = adj.rows.filter(r => r.ruling === 'SPLIT_MIXED_SENTENCE')
T('mixed sentences kept whole', mixed.every(r => /god bless/i.test(r.fullSentence)), true)
T('  … with a separate religious segment', mixed.every(r => r.religiousSegment.length > 0), true)
T('  … and a separate directive segment', mixed.every(r => r.directivePhrase !== r.fullSentence), true)
console.log(fails ? `\n   ${fails} regression check(s) FAILED` : '\n   authorship detector behaves correctly on all cases')

// ── manual spot-check sample across boards/formats ───────────────────────────
const third = adj.rows.filter(r => r.ruling === 'REMOVE_QUOTED_OR_THIRD_PARTY')
console.log(`\n   spot-check sample from the ${third.length} quoted/third-party rows:`)
for (const r of third.filter((_, i) => i % Math.ceil(third.length / 8) === 0).slice(0, 8)) {
  const p = posts.find(x => x.postNum === r.post)
  console.log(`     #${r.post} [${p?.board ?? p?.sourceBoard ?? '?'}]  "${r.fullSentence.slice(0, 68)}"`)
  console.log(`        re-test: in quoted block = ${inQuotedPart(r.post, r.fullSentence)}, in Q lines = ${isQAuthored(r.post, r.fullSentence)}`)
}

// ── 3. EXPORT THE 45 HELD ROWS ───────────────────────────────────────────────
const held = adj.rows.filter(r => r.ruling === 'REMOVE_STATEMENT_OR_HEADING' || r.ruling === 'NEEDS_CONTEXT')
const DEST = s => {
  const t = s.toLowerCase()
  if (/^(god bless|godspeed|god speed|amen|merry christmas|thank you)/.test(t)) return 'BLESSING_OR_VALEDICTION'
  if (/\bwill\b|\bcoming\b|\bsoon\b|\bnext week\b/.test(t)) return 'Q_PREDICTION'
  if (/^(for god|in god we trust|god wins|dark to light|divided by religion|religion v)/.test(t)) return 'STATEMENT_OR_HEADING'
  if (/\?$/.test(t)) return 'NEEDS_CONTEXT'
  if (/\b(is|are|was|were|has|have)\b/.test(t)) return 'Q_CLAIM'
  return 'RELIGION_THEME_ONLY'
}
const rows = held.map(r => {
  const p = posts.find(x => x.postNum === r.post)
  const lines = clean(p?.text ?? '').split(String.fromCharCode(10)).map(norm).filter(Boolean)
  const at = lines.findIndex(l => l.toLowerCase().includes(r.fullSentence.toLowerCase()))
  return { ...r, contextBefore: at > 0 ? lines[at - 1] : '', contextAfter: at >= 0 && at < lines.length - 1 ? lines[at + 1] : '',
    proposedDestination: r.ruling === 'NEEDS_CONTEXT' ? 'NEEDS_CONTEXT' : DEST(r.fullSentence) }
})
const esc = s => `"${String(s).replace(/"/g, '""')}"`
const cols = ['post', 'fullSentence', 'directivePhrase', 'contextBefore', 'contextAfter', 'qAuthored', 'sourceType', 'ruling', 'proposedDestination', 'reason']
fs.writeFileSync(path.join(ROOT, 'audit/directives-held-45.csv'),
  [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c] ?? '')).join(','))].join('\n'))
fs.writeFileSync(path.join(ROOT, 'audit/directives-held-45.json'), JSON.stringify({ note: 'The 43 statement/heading rows and 2 needs-context rows, held for second opinion. Nothing applied.', rows }, null, 1))
const d = {}; for (const r of rows) d[r.proposedDestination] = (d[r.proposedDestination] ?? 0) + 1
console.log(`\n3. HELD ROWS EXPORTED: ${rows.length}`)
for (const [k, v] of Object.entries(d).sort((a, b) => b[1] - a[1])) console.log(`     ${String(v).padStart(3)}  ${k}`)
console.log('\nwrote audit/directives-held-45.{csv,json}   — nothing applied')
