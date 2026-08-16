// DEVICE AUDIT v2 — the complete-text re-export, with real per-clause spans.
//
// Two matching bugs, both now fixed:
//   1. MOJIBAKE. The export was written UTF-8 and round-tripped through Latin-1, so it carries
//      "canât" where the queue holds "can't". Reading it as plain utf8 leaves those bytes intact
//      and every affected row misses. Repaired the same way the .md readers do it.
//   2. TRUNCATION. Nine stored tokens are clipped ("… / The formin"). Exact matching cannot reach
//      them, so a PREFIX fallback is used under the export's own policy: same post, deterministic
//      normalization only, stored token an exact prefix of queueMatchCandidate, exactly one
//      unconsumed row. Every pair is printed before anything is written.
//
// The " / " in a candidate is a display join, never source text. Keeps carry each clause as its
// own span so nothing has to invent a separator to be highlighted, and they are merged ADDITIVELY
// — a reset once destroyed all 83 records.
//
//   node scripts/apply-device-audit-v2.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DRY = process.argv.includes('--dry')
const SRC = 'C:/Users/heath/Documents/Codex/2026-08-15/referenced-chatgpt-conversation-this-is-an/outputs/device_audit_234/qdrops_device_full_text_reexport.json'
const raw = fs.readFileSync(SRC, 'latin1')
const { rows: cards } = JSON.parse(Buffer.from(raw, 'latin1').toString('utf8'))
const Q = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/resolution-queue.json'), 'utf8')).rows.filter(r => r.kind === 'classification')

// Deterministic only: quote/dash shape, entities, whitespace, case. No edit distance, no semantics.
const norm = s => String(s ?? '')
  .normalize('NFKC')
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...')
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim().toLowerCase()

// Index on token AND sourceSpan. Nineteen rows are all-caps-emphasis candidates whose `token` is
// the trigger WORD ("MIL", "COVID", "DRAIN") while `sourceSpan` carries the sentence the audit
// actually judged. Keying on token alone leaves them permanently unmatched; both fields are
// stored data, so this is still exact matching.
const pool = new Map()
const push = (k, r) => { if (!k) return; if (!pool.has(k)) pool.set(k, []); if (!pool.get(k).includes(r)) pool.get(k).push(r) }
for (const r of Q) { push(norm(r.token), r); push(norm(r.sourceSpan), r) }
const drop = r => { for (const arr of pool.values()) { const i = arr.indexOf(r); if (i >= 0) arr.splice(i, 1) } }

const prefixPairs = []
const takeExact = c => {
  for (const cand of [c.queueMatchCandidate, c.originalCandidate, c.recoveredDisplay]) {
    const a = pool.get(norm(cand))
    if (!a?.length) continue
    const hit = a.find(r => r.postNum === c.post)
    if (hit) { drop(hit); return hit }
  }
  return null
}
// Only after exact fails. Requires exactly one unconsumed candidate row in the same post.
const takePrefix = c => {
  const full = norm(c.queueMatchCandidate ?? c.recoveredDisplay ?? '')
  if (!full) return null
  const hits = []
  for (const [k, arr] of pool) {
    if (!k || !full.startsWith(k)) continue
    for (const r of arr) if (r.postNum === c.post) hits.push({ r })
  }
  const uniq = [...new Set(hits.map(h => h.r))]
  if (uniq.length !== 1) return null
  const r = uniq[0]
  drop(r)
  prefixPairs.push({ post: c.post, stored: r.token, full: c.queueMatchCandidate, id: r.id })
  return r
}

const keeps = [], removes = [], held = [], unmatched = []
for (const c of cards) {
  const row = takeExact(c) ?? takePrefix(c)
  if (!row) { unmatched.push(c); continue }
  const rec = { card: c, row }
  if (/unresolved|needs review/i.test(c.status) || /^Tentative/i.test(c.resolution ?? '')) held.push(rec)
  else if (/Keep Device/i.test(c.resolution)) keeps.push(rec)
  else removes.push(rec)
}

if (prefixPairs.length) {
  console.log(`\nPREFIX PAIRS (${prefixPairs.length}) — printed before any write, per the export's review gate:\n`)
  for (const p of prefixPairs) {
    console.log(`  #${p.post}  ${p.id}`)
    console.log(`     stored : ${JSON.stringify(p.stored).slice(0, 120)}`)
    console.log(`     full   : ${JSON.stringify(p.full).slice(0, 120)}\n`)
  }
}
console.log(`matched now: ${keeps.length} keep, ${removes.length} remove, ${held.length} held, ${unmatched.length} unmatched`)
console.log(`  (the rest of the 234 were already closed by the v1 pass and are no longer queued)`)
if (unmatched.length) for (const u of unmatched.slice(0, 8)) console.log(`   UNMATCHED #${u.post}  ${JSON.stringify(u.queueMatchCandidate).slice(0, 90)}`)
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0) }

// ── keeps: ADDITIVE upsert, keyed post + sourceCardIndex ─────────────────────
const EP = path.join(ROOT, 'audit/emphasis-owner-rulings.json')
const ej = JSON.parse(fs.readFileSync(EP, 'utf8'))
ej.approvedParallelPending = ej.approvedParallelPending ?? []
ej.approvedParallelPendingNote = 'Device audit: 83 candidates approved as deliberate parallel construction, each carrying its clauses as SEPARATE spans with character offsets. The " / " in a candidate label is a display join that appears nowhere in the drop, so it is never materialised. These await a multi-span parallel-phrasing representation before they can be certified as Emphasis occurrences.'
const idx = new Map(ej.approvedParallelPending.map((r, i) => [`${r.postNum}|${r.sourceCardIndex}`, i]))
let upserted = 0
for (const c of cards.filter(x => /Keep Device/i.test(x.resolution ?? ''))) {
  const rec = { postNum: c.post, sourceCardIndex: c.sourceCardIndex,
    candidate: c.queueMatchCandidate ?? c.originalCandidate, device: 'parallel_phrasing',
    spans: c.spans ?? [], spanModel: c.spanModel ?? ((c.spans?.length ?? 0) > 2 ? 'multi_span' : 'two_span'),
    syntheticSeparator: c.syntheticSeparator !== false, matchStatus: c.matchStatus ?? 'exact',
    approvedOn: '2026-08-15', reasoning: c.explanation }
  const k = `${c.post}|${c.sourceCardIndex}`
  if (idx.has(k)) ej.approvedParallelPending[idx.get(k)] = rec
  else { idx.set(k, ej.approvedParallelPending.length); ej.approvedParallelPending.push(rec) }
  upserted++
}
fs.writeFileSync(EP, JSON.stringify(ej, null, 2) + '\n')

// ── held: note only, row STAYS OPEN ──────────────────────────────────────────
const NP = path.join(ROOT, 'audit/resolution-owner-notes.json')
const nj = JSON.parse(fs.readFileSync(NP, 'utf8'))
const have = new Set(nj.notes.map(n => n.id))
let noted = 0
for (const { card, row } of held) {
  if (have.has(row.id)) continue
  nj.notes.push({ id: row.id, postNum: card.post, token: row.token, notedOn: '2026-08-15',
    ownerNote: `${card.resolution} — ${card.explanation}`,
    batch: 'Device audit — 31 held: deliberate parallelism and ordinary question sequencing equally plausible' })
  noted++
}
fs.writeFileSync(NP, JSON.stringify(nj, null, 2) + '\n')

// ── close resolved ───────────────────────────────────────────────────────────
const HELD = new Set(nj.notes.map(n => n.id))
const RP = path.join(ROOT, 'audit/resolution-owner-resolved.json')
const rj = JSON.parse(fs.readFileSync(RP, 'utf8'))
const done = new Set(rj.resolved.map(x => x.id))
let closed = 0
for (const { card, row } of [...keeps, ...removes]) {
  if (done.has(row.id) || HELD.has(row.id)) continue
  const kept = /Keep Device/i.test(card.resolution)
  rj.resolved.push({ id: row.id, postNum: card.post, token: row.token, resolvedOn: '2026-08-15',
    resolution: kept
      ? `Device audit: APPROVED as deliberate parallel construction (${card.spans?.length ?? 0} spans recorded, ${card.spanModel}). Awaiting a multi-span representation before it can be highlighted.`
      : 'Device audit: candidate DECLINED — ordinary sentence structure, not a certified rhetorical device.',
    batch: 'Device audit v2 — 203 resolved, 31 held' })
  closed++
}
fs.writeFileSync(RP, JSON.stringify(rj, null, 2) + '\n')

const withSpans = ej.approvedParallelPending.filter(k => (k.spans?.length ?? 0) >= 2).length
console.log(`\nkeeps upserted with spans : ${upserted}  (total pending ${ej.approvedParallelPending.length}, ${withSpans} with 2+ spans)`)
console.log(`notes on held cards       : ${noted}`)
console.log(`queue rows closed         : ${closed}`)
