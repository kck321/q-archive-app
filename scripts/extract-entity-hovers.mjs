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
import { validateHover, refreshWording, aliasLocation, classifyUrlDerived, URL_CLASS_MEANING } from './lib/hoverValidation.mjs'

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
// Every record is VALIDATED against the current certified state rather than filed by the status
// the audit stamped on it. A status records what was true when the audit ran; Stage 1 has moved
// the world since, and 523 records were held for a blocker that no longer exists.
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const postText = new Map(posts.map(p => [p.postNum, p.text ?? '']))
const paintedIn = new Map(posts.map(p => [p.postNum, new Set((p.postAnalysis?.namedEntities ?? []).map(t => t.toLowerCase()))]))
const aliasOwners = new Map()
for (const e of entities.entities) for (const a of e.aliases) {
  if (!aliasOwners.has(a.text)) aliasOwners.set(a.text, [])
  aliasOwners.get(a.text).push(e.canonical)
}
const sharedAliases = new Set([...aliasOwners].filter(([, v]) => v.length > 1).map(([k]) => k))

// Absorbed spelling -> surviving canonical, and the corrected type labels, for wording repair.
const stage1 = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-stage1-rulings.json'), 'utf8'))
const absorbedNames = []
for (const m of stage1.merges) for (const a of m.absorb) if (a.canonical !== m.canonical) absorbedNames.push([a.canonical, m.canonical])
const typeWas = new Map(stage1.typeCorrections.map(t => [t.canonical, t.from]))

const ctx = { liveById, sharedAliases, paintedIn, postText, withdrawnAuditIds }

const ready = []
const review = []
const quarantine = []
const withdrawn = []
const reworded = []
const fromRegistryBlocked = { publish: 0, review: 0, quarantine: 0, withdrawn: 0 }
const REGISTRY_BLOCKED = new Set(['Merge entity rows before publish', 'Correct entity type before publish'])
let seen = 0
for (let i = 1; i <= 8; i++) {
  await readJsonl(`02_ENTITY_POST_HOVERS_0${i}_of_08.jsonl.txt`, o => {
    seen++
    const id = idByAuditId.get(o.entityId)
    const rec = {
      entityId: id ?? null,
      postNum: o.postNum,
      auditOccurrenceId: o.occurrenceId,
      auditEntityId: o.entityId,
      matchedAlias: o.matchedAlias,
      localRole: o.localRole,
      synopsis: o.hoverSynopsis,
      contextSupport: o.contextSupport,
      evidenceConfidence: o.evidenceConfidence,
      evidenceBasis: o.evidenceBasis,
      sourceContext: o.sourceContext,
      glossaryMeaning: o.glossaryMeaning || null,
      status: o.implementationStatus,
    }

    // Repair wording that names something the archive no longer calls by that name. Mechanical
    // only — an absorbed spelling or a stale type label. Anything needing a re-reading goes to an
    // editor instead.
    const entity = id ? liveById.get(id) : null
    if (entity) {
      const { text, changes } = refreshWording(rec.synopsis, {
        entity, absorbedNames, typeLabel: entity.type, oldTypeLabel: typeWas.get(entity.canonical),
      })
      if (changes.length) { rec.synopsis = text; rec.rewordedFrom = changes; reworded.push({ ...rec, changes }) }
    }

    const v = validateHover(rec, ctx)
    rec.verdict = v.verdict
    rec.verdictReason = v.reason
    if (v.urlClass) rec.urlClass = v.urlClass
    // A record already in review can ALSO be URL-derived. It stays in review — it was never going
    // to be published — but it is tagged so the admin queue can filter on it, which is what the
    // URL audit needs to be complete rather than only counting the ones that nearly shipped.
    if (v.verdict === 'review') {
      const loc = aliasLocation(postText.get(rec.postNum) ?? '', rec.matchedAlias)
      if (!loc.inProse && loc.inUrl) { rec.urlDerived = true; rec.urlClass = classifyUrlDerived(loc) }
    }
    if (REGISTRY_BLOCKED.has(rec.status)) fromRegistryBlocked[v.verdict]++

    if (v.verdict === 'publish') ready.push(rec)
    else if (v.verdict === 'quarantine') quarantine.push(rec)
    else if (v.verdict === 'withdrawn') withdrawn.push(rec)
    else review.push(rec)
  })
}
console.log(`  hover records read  : ${seen}`)
console.log(`    publish           : ${ready.length}`)
console.log(`    review            : ${review.length}`)
console.log(`    url quarantine    : ${quarantine.length}`)
console.log(`    withdrawn         : ${withdrawn.length}`)
console.log(`    wording refreshed : ${reworded.length}`)
console.log(`  of the 523 registry-blocked: ${fromRegistryBlocked.publish} publish, ${fromRegistryBlocked.review} review, ${fromRegistryBlocked.quarantine} quarantine`)

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
// Asserted from both sides: only records that passed validation are in the bundle, and nothing
// held is. A Review synopsis is unreviewed editorial text about a named person.
const publishedKeys = new Set(ready.map(r => `${r.entityId} ${r.postNum}`))
const leaked = [...review, ...quarantine, ...withdrawn]
  .filter(r => publishedKeys.has(`${r.entityId} ${r.postNum}`))
  .filter(r => !ready.some(p => p.auditOccurrenceId === r.auditOccurrenceId))
if (leaked.length) {
  console.error(`
❌ ${leaked.length} held record(s) reached the public artifact. Nothing written.`)
  for (const g of leaked.slice(0, 10)) console.error(`     ${g.auditOccurrenceId} (${g.verdict}: ${g.verdictReason})`)
  process.exit(1)
}
if (!ready.every(r => r.verdict === 'publish')) { console.error(`\n❌ a non-publish verdict reached the bundle`); process.exit(1) }
const orphans = Object.keys(byEntity).filter(id => !liveById.has(id))
if (orphans.length) { console.error(`
❌ hovers reference missing entities: ${orphans.slice(0, 8).join(', ')}`); process.exit(1) }

fs.writeFileSync(path.join(DATA, 'entity-hovers.json'), JSON.stringify({
  certified: true,
  note: 'Entity hover synopses. `global` describes the entity wherever it appears; `byPost` describes how one drop uses the label and what supports that reading. Keyed by the permanent qe- entity id and the post number — never by display name, alias, slug or the audit ENT number. Only records that pass every Ready validation against the current certified state appear here.',
  source: 'Entities/Brackets hover audit, 2026-08-16',
  totals: {
    entitiesWithGlobal: Object.keys(globals).length,
    postSynopses: ready.length,
    entitiesWithPostSynopses: Object.keys(byEntity).length,
    heldInReview: review.length,
    heldInUrlQuarantine: quarantine.length,
    withdrawn: withdrawn.length,
  },
  global: Object.fromEntries(Object.entries(globals).map(([id, g]) => [id, g.synopsis])),
  byPost: byEntity,
}))

// ── the admin-only queues ───────────────────────────────────────────────────
// NOT under public/data. That directory IS the published bundle, so anything placed there is
// exposed by definition. The editorial build reads these from audit/.
const enrich = r => {
  const e = liveById.get(r.entityId)
  return {
    ...r,
    canonical: e?.canonical ?? null,
    entityType: e?.type ?? null,
    aliases: e?.aliases.map(a => a.text) ?? [],
    globalSynopsis: globals[r.entityId]?.synopsis ?? null,
    sharedAlias: sharedAliases.has(r.matchedAlias),
    sharedAliasOwners: sharedAliases.has(r.matchedAlias) ? aliasOwners.get(r.matchedAlias) : undefined,
    registryCorrected: REGISTRY_BLOCKED.has(r.status),
  }
}

fs.writeFileSync(path.join(OUT, 'entity-hover-review-queue.json'), JSON.stringify({
  note: 'Entity hover synopses awaiting an editorial decision. ADMIN ONLY — deliberately not under public/data. Each carries both proposed synopses, the drop text the reading came from, the support grade, and why it is here.',
  total: review.length,
  byReason: review.reduce((a, r) => (a[r.verdictReason] = (a[r.verdictReason] ?? 0) + 1, a), {}),
  bySupport: review.reduce((a, r) => (a[r.contextSupport] = (a[r.contextSupport] ?? 0) + 1, a), {}),
  records: review.map(enrich),
}, null, 1))

// ── URL quarantine, classified ──────────────────────────────────────────────
const byClass = {}
for (const r of quarantine) (byClass[r.urlClass] ??= []).push(r)
fs.writeFileSync(path.join(OUT, 'entity-hover-url-quarantine.json'), JSON.stringify({
  note: 'Hover records whose entity was matched ONLY inside a URL, never in the prose of the drop. Quarantined out of the public bundle pending an owner policy ruling. No certified entity count has been changed.',
  category: 'url_derived_entity_occurrence',
  total: quarantine.length,
  classMeanings: URL_CLASS_MEANING,
  byClass: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v.length])),
  recommendation: {
    url_path_fragment: 'Should NOT be an entity mention. A slug is an artefact of a content-management system, not Q naming a thing.',
    url_query_fragment: 'Should NOT be an entity mention. A search term Q typed into a URL is what he looked for, not what he said.',
    hostname_source_reference: 'Genuine information, wrong layer. A publisher domain belongs in linked-source metadata, where it can be listed as a source rather than painted as prose.',
    ambiguous_url_reference: 'Needs an occurrence-level decision; the match spans more than one part of the URL.',
    human_readable_link_label: 'Publishable as prose — the entity is named in visible text, and the URL merely accompanies it.',
  },
  records: quarantine.map(enrich),
}, null, 1))

// ── withdrawn: audit history only ───────────────────────────────────────────
fs.writeFileSync(path.join(OUT, 'entity-hover-withdrawn.json'), JSON.stringify({
  note: 'Hover records whose entity Stage 1 withdrew from Entities. Retained as audit history only — never Publish, never ordinary Review.',
  category: 'withdrawn_entity_occurrence',
  total: withdrawn.length,
  records: withdrawn,
}, null, 1))

if (reworded.length) {
  fs.writeFileSync(path.join(OUT, 'entity-hover-reworded.json'), JSON.stringify({
    note: 'Synopses whose wording named something the archive no longer calls by that name. Mechanical substitutions only — an absorbed spelling or a stale type label. Nothing here re-read a drop.',
    total: reworded.length,
    records: reworded.map(r => ({ auditOccurrenceId: r.auditOccurrenceId, postNum: r.postNum, changes: r.changes, synopsis: r.synopsis })),
  }, null, 1))
}

const bytes = fs.statSync(path.join(DATA, 'entity-hovers.json')).size
console.log(`\n  wrote public/data/entity-hovers.json (${(bytes / 1048576).toFixed(2)} MB)`)
console.log(`  wrote audit/entity-hover-review-queue.json (${review.length} admin-only)`)
console.log(`\n  ✅ publication gate: only "${READY}" records reached the bundle\n`)
