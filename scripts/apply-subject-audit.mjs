// SUBJECT AUDIT — 251 theme cards.
//
// These queue rows are CANDIDATES, not assignments: the context guard fired, so the theme was
// never applied. That makes the mapping simple and means no theme-withdrawal mechanism is needed.
//
//   Keep    -> ADD the queued theme to the post
//   Move    -> ADD Censorship & Technology (the Foreign Affairs candidate is declined)
//   Remove  -> DECLINE the candidate; the row closes and no certified data moves
//   Unresolved -> stays in the Resolution Center carrying the tentative reading and why it is open
//
//   node scripts/apply-subject-audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/qdrops_subject_audit_resolved_then_unresolved.md'
const md = Buffer.from(fs.readFileSync(SRC, 'latin1'), 'latin1').toString('utf8')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const Q = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/resolution-queue.json'), 'utf8')).rows.filter(r => r.kind === 'theme')

const SLUG = { 'Foreign Affairs': 'foreign_affairs', 'Censorship & Technology': 'censorship_technology' }
const resolved = [], unresolved = []
for (const line of md.split(/\r?\n/)) {
  if (!line.startsWith('| [#')) continue
  const cells = line.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
  const post = Number((cells[0].match(/#(\d+)/) ?? [])[1])
  if (!post) continue
  const current = cells[1]
  const action = cells[2] ?? ''
  const row = { post, current, action, explanation: cells[3] ?? '', why: cells[4] ?? '' }
  ;(cells.length >= 5 ? unresolved : resolved).push(row)
}
console.log(`parsed: ${resolved.length} resolved, ${unresolved.length} unresolved  (expect 235 / 16)`)

const verdict = a => a.startsWith('Keep') ? 'KEEP' : a.startsWith('Move') ? 'MOVE' : 'REMOVE'
const counts = { KEEP: 0, MOVE: 0, REMOVE: 0 }
for (const r of resolved) counts[verdict(r.action)]++
console.log(`  keep ${counts.KEEP}, move ${counts.MOVE}, remove ${counts.REMOVE}  (expect 41 / 7 / 187)`)

// ── theme rulings for keeps and moves ────────────────────────────────────────
const TP = path.join(ROOT, 'audit/themes-owner-rulings.json')
const tj = JSON.parse(fs.readFileSync(TP, 'utf8'))
const have = new Set(tj.rulings.map(r => `${r.postNum}|${r.theme}`))
let added = 0
for (const r of resolved) {
  const v = verdict(r.action)
  if (v === 'REMOVE') continue
  const label = v === 'MOVE' ? 'Censorship & Technology' : r.current
  const p = byNum.get(r.post)
  if (!p || have.has(`${r.post}|${SLUG[label]}`)) continue
  have.add(`${r.post}|${SLUG[label]}`)
  tj.rulings.push({ postNum: r.post, postId: p.id, theme: SLUG[label], label,
    anchor: '', was: 'context-guard candidate', ruledOn: '2026-08-15',
    reasoning: `Subject audit (${v}): ${r.explanation}` })
  added++
}
fs.writeFileSync(TP, JSON.stringify(tj, null, 2) + '\n')

// ── notes on the 16 that stay open ───────────────────────────────────────────
const NP = path.join(ROOT, 'audit/resolution-owner-notes.json')
const nj = JSON.parse(fs.readFileSync(NP, 'utf8'))
const held = new Set(nj.notes.map(n => n.id))
const openKeys = new Set(unresolved.map(u => `${u.post}|${u.current}`))
let noted = 0
for (const u of unresolved) {
  const row = Q.find(r => r.postNum === u.post && r.token === u.current)
  if (!row || held.has(row.id)) continue
  nj.notes.push({ id: row.id, postNum: u.post, token: u.current, notedOn: '2026-08-15',
    ownerNote: `Tentative reading — ${u.action}. ${u.explanation} STILL OPEN: ${u.why}`,
    batch: 'Subject audit — 16 medium-confidence cards left open' })
  noted++
}
fs.writeFileSync(NP, JSON.stringify(nj, null, 2) + '\n')

// ── close the 235 ────────────────────────────────────────────────────────────
const HELD = new Set(nj.notes.map(n => n.id))
const RP = path.join(ROOT, 'audit/resolution-owner-resolved.json')
const rj = JSON.parse(fs.readFileSync(RP, 'utf8'))
const done = new Set(rj.resolved.map(x => x.id))
const byKey = new Map(resolved.map(r => [`${r.post}|${r.current}`, r]))
let closed = 0
for (const row of Q) {
  const r = byKey.get(`${row.postNum}|${row.token}`)
  if (!r || done.has(row.id) || HELD.has(row.id) || openKeys.has(`${row.postNum}|${row.token}`)) continue
  const v = verdict(r.action)
  rj.resolved.push({ id: row.id, postNum: row.postNum, token: row.token, resolvedOn: '2026-08-15',
    resolution: v === 'REMOVE' ? `Subject audit: candidate DECLINED — ${r.explanation}` : `Subject audit (${v}): ${r.explanation}`,
    batch: 'Subject audit — 235 resolved, 16 left open' })
  closed++
}
fs.writeFileSync(RP, JSON.stringify(rj, null, 2) + '\n')
console.log(`\ntheme rulings added : ${added}\nnotes on open cards : ${noted}\nqueue rows closed   : ${closed}`)
