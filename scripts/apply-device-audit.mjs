// DEVICE AUDIT — 234 rhetorical-device cards. 203 resolved (83 keep / 120 remove), 31 held.
//
// Like the Subject cards these are CANDIDATES: the borderline pass never certified them, so a
// "Remove" declines the candidate and moves no data.
//
// A "Keep" is an editorial decision that CANNOT be materialised as a highlight from the stored
// candidate, because the candidate is a synthetic join — "Why is this relevant? / Why now?" — with
// a " / " that appears nowhere in the drop. Writing that as an emphasis span would invent text.
// So keeps are recorded as approved rulings awaiting a two-span representation, and the reason is
// written down rather than quietly dropped.
//
//   node scripts/apply-device-audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/qdrops_device_resolved_then_unresolved.md'
const md = Buffer.from(fs.readFileSync(SRC, 'latin1'), 'latin1').toString('utf8')
const Q = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/resolution-queue.json'), 'utf8')).rows.filter(r => r.kind === 'classification')
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

const resolved = [], held = []
for (const line of md.split(/\r?\n/)) {
  if (!line.startsWith('| [#')) continue
  const c = line.split('|').map(x => x.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
  const post = Number((c[0].match(/#(\d+)/) ?? [])[1]); if (!post) continue
  const row = { post, text: norm(c[1] ?? ''), verdict: c[3] ?? '', why: norm(c[4] ?? '') }
  if (/Tentative/i.test(row.verdict)) held.push(row); else resolved.push(row)
}
const keep = resolved.filter(r => /Keep Device/i.test(r.verdict))
const remove = resolved.filter(r => /Remove Device/i.test(r.verdict))
console.log(`parsed: ${resolved.length} resolved (${keep.length} keep, ${remove.length} remove), ${held.length} held  (expect 203 / 83 / 120 / 31)`)

// Match a card to its queue row by post + candidate text.
const key = (p, t) => `${p}|${norm(t).toLowerCase()}`
const qByKey = new Map()
for (const r of Q) { const k = key(r.postNum, r.token); if (!qByKey.has(k)) qByKey.set(k, []); qByKey.get(k).push(r) }
const take = (p, t) => { const a = qByKey.get(key(p, t)); return a && a.length ? a.shift() : null }

// ── keeps recorded as approved-but-unmaterialised ────────────────────────────
const EP = path.join(ROOT, 'audit/emphasis-owner-rulings.json')
const ej = JSON.parse(fs.readFileSync(EP, 'utf8'))
ej.approvedParallelPending = ej.approvedParallelPending ?? []
ej.approvedParallelPendingNote = 'Device audit: 83 candidates the owner APPROVED as deliberate parallel construction. They are not yet emphasis occurrences because the stored candidate is a synthetic "A / B" join whose separator does not exist in the drop; materialising one span from it would invent text. These need a two-span parallel representation (one span per clause, one occurrence) before they can be certified and highlighted.'
const seen = new Set(ej.approvedParallelPending.map(r => `${r.postNum}|${r.candidate}`))
for (const r of keep) {
  if (seen.has(`${r.post}|${r.text}`)) continue
  seen.add(`${r.post}|${r.text}`)
  ej.approvedParallelPending.push({ postNum: r.post, candidate: r.text, device: 'parallel_phrasing',
    approvedOn: '2026-08-15', reasoning: r.verdict.replace(/\*\*/g, '') })
}
fs.writeFileSync(EP, JSON.stringify(ej, null, 2) + '\n')

// ── notes on the 31 ──────────────────────────────────────────────────────────
const NP = path.join(ROOT, 'audit/resolution-owner-notes.json')
const nj = JSON.parse(fs.readFileSync(NP, 'utf8'))
const have = new Set(nj.notes.map(n => n.id))
const heldIds = new Set()
let noted = 0
for (const h of held) {
  const row = take(h.post, h.text); if (!row) continue
  heldIds.add(row.id)
  if (have.has(row.id)) continue
  nj.notes.push({ id: row.id, postNum: h.post, token: row.token, notedOn: '2026-08-15',
    ownerNote: `${h.verdict.replace(/\*\*/g, '')} — ${h.why}`,
    batch: 'Device audit — 31 cards where deliberate parallelism and ordinary question sequencing are equally plausible' })
  noted++
}
fs.writeFileSync(NP, JSON.stringify(nj, null, 2) + '\n')

// ── close the 203 ────────────────────────────────────────────────────────────
const RP = path.join(ROOT, 'audit/resolution-owner-resolved.json')
const rj = JSON.parse(fs.readFileSync(RP, 'utf8'))
const done = new Set(rj.resolved.map(x => x.id))
const HELD = new Set(nj.notes.map(n => n.id))
let closed = 0
for (const r of resolved) {
  const row = take(r.post, r.text); if (!row || done.has(row.id) || HELD.has(row.id)) continue
  const kept = /Keep Device/i.test(r.verdict)
  rj.resolved.push({ id: row.id, postNum: r.post, token: row.token, resolvedOn: '2026-08-15',
    resolution: kept
      ? 'Device audit: APPROVED as deliberate parallel construction. Recorded in emphasis-owner-rulings.approvedParallelPending — awaiting a two-span representation before it can be highlighted.'
      : 'Device audit: candidate DECLINED — ordinary sentence structure, not a certified rhetorical device.',
    batch: 'Device audit — 203 resolved, 31 held' })
  closed++
}
fs.writeFileSync(RP, JSON.stringify(rj, null, 2) + '\n')
console.log(`\nkeeps recorded pending : ${keep.length}\nnotes on held cards    : ${noted}\nqueue rows closed      : ${closed}`)
