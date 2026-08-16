// Stage 2: import the entity hover synopses.
//
//   node scripts/extract-entity-hovers.mjs [--handoff <dir>]
//
// TWO LAYERS, KEPT APART. A global synopsis describes the entity wherever it appears; a
// post-specific synopsis describes how THIS drop uses the label and what supports that reading.
// They answer different questions and are stored in different places, so a UI can never show the
// general one where the specific one was meant.
//
// KEYED BY PERMANENT ID + POST NUMBER, never by display name, alias, slug or the audit's ENT
// number. The audit keys on ENT-####, which is our own list ordered by mention count — positional,
// and meaningless the moment a count moves. Everything is resolved through the Stage 1 crosswalk
// into qe- ids before anything is written.
//
// PUBLICATION IS ALLOWLIST-ONLY. A record reaches the public bundle if and only if its
// implementationStatus is exactly "Ready for first-pass publish" AND its entity is live. Every
// other status is held, and the gate at the bottom refuses to write if even one held record
// reaches the public file — a Review synopsis is unreviewed editorial text about a real person,
// and shipping one is not a formatting mistake.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const argIdx = process.argv.indexOf('--handoff')
const HANDOFF = argIdx > -1 ? process.argv[argIdx + 1]
  : 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Entities Handolf folder'

const READY = 'Ready for first-pass publish'
const REVIEW = 'Human review before publish'

const readJsonl = async (file, onRow) => {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(HANDOFF, file), { encoding: 'utf8' }), crlfDelay: Infinity })
  let n = 0
  for await (const line of rl) { if (!line.trim()) continue; n++; onRow(JSON.parse(line)) }
  return n
}

// ── the crosswalk: ENT-#### -> permanent id ─────────────────────────────────
const ledger = JSON.parse(fs.readFileSync(path.join(OUT, 'entity-ids.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const liveById = new Map(entities.entities.map(e => [e.id, e]))
const idByAuditId = new Map()
for (const [id, e] of Object.entries(ledger.entries)) for (const a of e.auditEntityIds ?? []) idByAuditId.set(a, id)
const withdrawnAuditIds = new Set(
  JSON.parse(fs.readFileSync(path.join(OUT, 'entities-moved-out-history.json'), 'utf8')).moveOuts.map(m => m.entityId))

console.log(`\nEXTRACT ENTITY HOVERS (Stage 2)\n`)
console.log(`  crosswalk           : ${idByAuditId.size} ENT-#### -> qe- ids`)
console.log(`  live entities       : ${liveById.size}`)

// ── global synopses, one per entity ─────────────────────────────────────────
const globals = {}
let globalRows = 0, globalUnmapped = 0
await readJsonl('01_ENTITY_REGISTRY_AUDIT.jsonl.txt', o => {
  globalRows++
  if (!o.globalSynopsis) return
  const id = idByAuditId.get(o.entityId)
  if (!id || !liveById.has(id)) { globalUnmapped++; return }
  // A merge collapses several audit rows onto one entity. The survivor's own synopsis wins;
  // an absorbed row's would describe a count that no longer exists.
  const isSurvivor = liveById.get(id).canonical === o.canonical
  if (globals[id] && !isSurvivor) return
  globals[id] = { synopsis: o.globalSynopsis, auditEntityId: o.entityId, type: o.recommendedType || o.entityType }
})
console.log(`  global synopses     : ${Object.keys(globals).length} of ${globalRows} audit rows (${globalUnmapped} belong to withdrawn/absorbed rows)`)

// ── post-specific synopses ──────────────────────────────────────────────────
const ready = []
const review = []
const held = []
const problems = []
let seen = 0
for (let i = 1; i <= 8; i++) {
  await readJsonl(`02_ENTITY_POST_HOVERS_0${i}_of_08.jsonl.txt`, o => {
    seen++
    const id = idByAuditId.get(o.entityId)
    const record = {
      // The key. Permanent id plus post number — never the display name, which is exactly what
      // changes when an entity is renamed or merged.
      entityId: id ?? null,
      postNum: o.postNum,
      auditOccurrenceId: o.occurrenceId,
      auditEntityId: o.entityId,
      matchedAlias: o.matchedAlias,
      localRole: o.localRole,
      synopsis: o.hoverSynopsis,
      // Review metadata travels with the record even where the public UI shows only the synopsis.
      contextSupport: o.contextSupport,
      evidenceConfidence: o.evidenceConfidence,
      evidenceBasis: o.evidenceBasis,
      sourceContext: o.sourceContext,
      glossaryMeaning: o.glossaryMeaning || null,
      status: o.implementationStatus,
    }
    if (withdrawnAuditIds.has(o.entityId)) { held.push({ ...record, heldBecause: 'entity withdrawn from Entities in Stage 1' }); return }
    if (!id || !liveById.has(id)) { problems.push({ occurrenceId: o.occurrenceId, entityId: o.entityId, why: 'no live entity for this audit id' }); return }
    if (o.implementationStatus === READY) { ready.push(record); return }
    if (o.implementationStatus === REVIEW) { review.push(record); return }
    // "Merge entity rows before publish" / "Correct entity type before publish". Stage 1 resolved
    // both registry actions, so the blocker named in the status is gone — but the audit never
    // graded these synopses as ready, and only the 4,285 are authorised for publication.
    held.push({ ...record, heldBecause: `registry action resolved in Stage 1; synopsis not graded ready (${o.implementationStatus})` })
  })
}
console.log(`  hover records read  : ${seen}`)
console.log(`    ready to publish  : ${ready.length}`)
console.log(`    review queue      : ${review.length}`)
console.log(`    held              : ${held.length}`)
console.log(`    unmappable        : ${problems.length}`)

// ── the public artifact ─────────────────────────────────────────────────────
// Keyed by entity id, then post number. A reader's lookup is always "this entity, in this drop",
// so the shape matches the question rather than forcing a scan.
const byEntity = {}
for (const r of ready) {
  (byEntity[r.entityId] ??= {})[r.postNum] = {
    s: r.synopsis,
    a: r.matchedAlias,
    r: r.localRole,
    // Support grade travels to the reader: a Partial reading must not look like a Strong one.
    g: r.contextSupport,
    c: r.evidenceConfidence,
  }
}

// ── PUBLICATION GATE ────────────────────────────────────────────────────────
const gate = []
const readySet = new Set(ready.map(r => `${r.entityId}\u0000${r.postNum}`))
for (const r of [...review, ...held]) {
  if (readySet.has(`${r.entityId}\u0000${r.postNum}`)) continue      // a different, ready record for the same pair
  if (byEntity[r.entityId]?.[r.postNum]) gate.push(`${r.auditOccurrenceId} (${r.status})`)
}
if (gate.length) {
  console.error(`\n❌ ${gate.length} non-Ready record(s) reached the public artifact. Nothing written.`)
  for (const g of gate.slice(0, 10)) console.error(`     ${g}`)
  process.exit(1)
}
const publishedStatuses = new Set(ready.map(r => r.status))
if (publishedStatuses.size !== 1 || !publishedStatuses.has(READY)) {
  console.error(`\n❌ published set contains statuses other than "${READY}": ${[...publishedStatuses].join(', ')}`)
  process.exit(1)
}
const orphanGlobals = Object.keys(globals).filter(id => !liveById.has(id))
const orphanPosts = Object.keys(byEntity).filter(id => !liveById.has(id))
if (orphanGlobals.length || orphanPosts.length) {
  console.error(`\n❌ hovers reference entities that do not exist: ${[...orphanGlobals, ...orphanPosts].slice(0, 8).join(', ')}`)
  process.exit(1)
}

fs.writeFileSync(path.join(DATA, 'entity-hovers.json'), JSON.stringify({
  certified: true,
  note: 'Entity hover synopses. `global` describes the entity wherever it appears; `byPost` describes how one drop uses the label and what supports that reading. Keyed by the permanent qe- entity id and the post number — never by display name, alias, slug or the audit ENT number. Only records graded "Ready for first-pass publish" appear here.',
  source: 'Entities/Brackets hover audit, 2026-08-16',
  totals: {
    entitiesWithGlobal: Object.keys(globals).length,
    postSynopses: ready.length,
    entitiesWithPostSynopses: Object.keys(byEntity).length,
    heldInReview: review.length,
    heldOther: held.length,
  },
  global: Object.fromEntries(Object.entries(globals).map(([id, g]) => [id, g.synopsis])),
  byPost: byEntity,
}))

// ── the admin-only queues ───────────────────────────────────────────────────
// NOT under public/data. The owner's instruction was to route Review records into the review
// workflow and not expose them: public/data is the published bundle, so anything placed there is
// exposed by definition. These live in audit/ where the editorial build reads them.
fs.writeFileSync(path.join(OUT, 'entity-hover-review-queue.json'), JSON.stringify({
  note: 'Entity hover synopses that need human review before they can be published. ADMIN ONLY — this file is deliberately not under public/data. Each carries its support grade, evidence basis and the drop text the reading came from.',
  total: review.length,
  bySupport: review.reduce((a, r) => (a[r.contextSupport] = (a[r.contextSupport] ?? 0) + 1, a), {}),
  records: review,
}, null, 1))

fs.writeFileSync(path.join(OUT, 'entity-hover-held.json'), JSON.stringify({
  note: 'Hover records that are neither ready nor in human review. Two populations: synopses whose registry blocker Stage 1 already cleared but which the audit never graded ready, and synopses for entities Stage 1 withdrew.',
  total: held.length,
  byReason: held.reduce((a, r) => (a[r.heldBecause] = (a[r.heldBecause] ?? 0) + 1, a), {}),
  records: held,
}, null, 1))

if (problems.length) {
  fs.writeFileSync(path.join(OUT, 'entity-hover-unmappable.json'), JSON.stringify({ total: problems.length, records: problems }, null, 1))
}

const bytes = fs.statSync(path.join(DATA, 'entity-hovers.json')).size
console.log(`\n  wrote public/data/entity-hovers.json (${(bytes / 1048576).toFixed(2)} MB)`)
console.log(`  wrote audit/entity-hover-review-queue.json (${review.length} admin-only)`)
console.log(`  wrote audit/entity-hover-held.json (${held.length})`)
console.log(`\n  ✅ publication gate: only "${READY}" records reached the bundle\n`)
