// Extract Stage 1 of the Entities/Brackets hover audit into canonical artifacts.
//
//   node scripts/extract-entities-stage1.mjs [--handoff <dir>]
//
// Reads the audit handoff package (JSONL, streamed — never loaded whole) and writes the two
// canonical files the materialiser consumes:
//
//   audit/entities-stage1-rulings.json      merges, type corrections, move-outs
//   audit/entities-moved-out-history.json   the occurrences leaving the certified count
//
// It writes RULINGS, not results. apply-entities.mjs is still the only thing that materialises
// entities.json, so this cannot bypass the QA gate — the same rule that keeps every other
// editorial decision inside the audit -> materialise -> QA -> apply chain.
//
// WHICH SPELLING SURVIVES A MERGE. The audit says two rows are one entity; it does not say which
// label to keep. The rule here is the highest mention count, with the core registry breaking a
// tie — the form the corpus most supports. Every other spelling is preserved as an alias, so a
// merge loses no way of finding the entity, and the arguable cases are flagged in the report
// rather than settled quietly: "LORD" and "Lord" are different registers, and so are
// "FAKE NEWS MEDIA" and "Fake News Media".
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argIdx = process.argv.indexOf('--handoff')
const HANDOFF = argIdx > -1 ? process.argv[argIdx + 1]
  : 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Entities Handolf folder'

const readJsonl = async (file, onRow) => {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(HANDOFF, file), { encoding: 'utf8' }), crlfDelay: Infinity })
  let n = 0
  for await (const line of rl) { if (!line.trim()) continue; n++; onRow(JSON.parse(line)) }
  return n
}

// Same normalisation the audit used to decide two rows carry "the same normalized canonical label".
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '')
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ── read the registry audit ──────────────────────────────────────────────────
const mergeRows = [], typeRows = [], moveRows = []
const byEntityId = new Map()
// Every audit reference, not only the ones Stage 1 acts on. The owner asked for a crosswalk from
// ENT-#### to the permanent id for EVERY row, because the audit's later stages quote ENT numbers
// for rows Stage 1 leaves untouched — and those numbers are positional, so they are worthless the
// moment a count moves. Resolving all 1,445 now is what keeps stages 2-5 anchored.
const auditCrosswalk = []
const total = await readJsonl('01_ENTITY_REGISTRY_AUDIT.jsonl.txt', o => {
  byEntityId.set(o.entityId, o)
  auditCrosswalk.push({ entityId: o.entityId, canonical: o.canonical, source: o.source, auditDecision: o.auditDecision })
  if (o.auditDecision.startsWith('Merge')) mergeRows.push(o)
  else if (o.auditDecision === 'Correct entity type') typeRows.push(o)
  else if (o.auditDecision.startsWith('Move from Entities')) moveRows.push(o)
})
console.log(`\nEXTRACT ENTITIES STAGE 1\n\n  registry audit rows : ${total}`)

// ── merge groups ─────────────────────────────────────────────────────────────
const groups = new Map()
for (const r of mergeRows) {
  const k = norm(r.canonical)
  if (!groups.has(k)) groups.set(k, [])
  groups.get(k).push(r)
}
const ours = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'entities.json'), 'utf8'))
// Our rows are not uniquely keyed by canonical — that is the defect being fixed — so a group's
// members are matched by (canonical, source, mentions), the triple that is unique today.
const ourKey = e => `${e.canonical}\u0000${e.source}\u0000${e.mentions}`
const ourByKey = new Map(ours.entities.map(e => [ourKey(e), e]))

const merges = []
for (const [key, rows] of groups) {
  const sorted = [...rows].sort((a, b) =>
    b.mentions - a.mentions ||
    (a.source === 'core registry' ? -1 : b.source === 'core registry' ? 1 : 0) ||
    a.canonical.localeCompare(b.canonical))
  const [target, ...absorbed] = sorted
  const spellings = [...new Set(rows.map(r => r.canonical))]
  merges.push({
    groupKey: key,
    canonical: target.canonical,
    keepFrom: { entityId: target.entityId, source: target.source, mentions: target.mentions },
    absorb: absorbed.map(a => ({ entityId: a.entityId, canonical: a.canonical, source: a.source, mentions: a.mentions })),
    expectedMentions: rows.reduce((n, r) => n + r.mentions, 0),
    // Flagged when the group holds more than one SPELLING — then keeping one is an editorial
    // choice about how the archive names the entity, not a mechanical dedup.
    spellingChoice: spellings.length > 1,
    spellings,
    auditReason: target.auditReason,
    entityType: target.recommendedType || target.entityType,
  })
}
merges.sort((a, b) => b.expectedMentions - a.expectedMentions)
const rowsRemoved = mergeRows.length - merges.length
console.log(`  merges              : ${mergeRows.length} rows -> ${merges.length} groups (-${rowsRemoved} rows)`)
console.log(`  spelling choices    : ${merges.filter(m => m.spellingChoice).length} groups hold more than one spelling`)

// ── type corrections ─────────────────────────────────────────────────────────
const typeCorrections = typeRows.map(r => ({
  entityId: r.entityId, canonical: r.canonical, source: r.source,
  from: r.entityType, to: r.recommendedType,
  confidence: r.auditConfidence, reason: r.auditReason,
}))
console.log(`  type corrections    : ${typeCorrections.length}`)

// ── move-outs, with every occurrence ─────────────────────────────────────────
const moveIds = new Set(moveRows.map(r => r.entityId))
const occurrences = []
for (let i = 1; i <= 8; i++) {
  await readJsonl(`02_ENTITY_POST_HOVERS_0${i}_of_08.jsonl.txt`, o => {
    if (!moveIds.has(o.entityId)) return
    occurrences.push({
      occurrenceId: o.occurrenceId, auditEntityId: o.entityId,
      canonical: o.canonical, postNum: o.postNum, postDate: o.postDate,
      // The text Q actually wrote, which is what the renderer matched on. Preserving this is the
      // difference between a reversible record and a note saying something used to be here.
      matchedAlias: o.matchedAlias,
      priorEntityType: o.entityType, localRole: o.localRole,
      sourceContext: o.sourceContext, contextSupport: o.contextSupport,
      evidenceConfidence: o.evidenceConfidence,
      postUrl: o.postUrl,
    })
  })
}
// ── AN OWNER RULING OUTRANKS AN AUDIT PASS ───────────────────────────────────
// The audit is a first-pass classifier. Where it contradicts a ruling the owner has already made
// and reasoned about, the ruling wins and the audit row is HELD, not applied.
//
// This is not hypothetical: ENT-0709 "Non-profit organization" is ruled a generic class by the
// audit, and was ruled an entity by the owner on 2026-08-15 — "the NP in this drop is a
// NON-PROFIT, and must be a separate thing from Nancy Pelosi so a search for her never returns
// it." Applying the audit here would have quietly reversed a decision made for a specific reason,
// which is the one thing the whole canonical-artifact architecture exists to prevent.
//
// Detected structurally rather than by listing the known case, so the next conflict is caught too.
const ORULES = path.join(ROOT, 'audit', 'entities-owner-rulings.json')
const ownerNamed = new Map()
if (fs.existsSync(ORULES)) {
  const o = JSON.parse(fs.readFileSync(ORULES, 'utf8'))
  for (const key of ['rulings', 'aliasRulings', 'mergeRulings', 'aliasWithdrawals']) {
    for (const r of o[key] ?? []) {
      if (!r.canonical) continue
      if (!ownerNamed.has(r.canonical)) ownerNamed.set(r.canonical, [])
      ownerNamed.get(r.canonical).push({ list: key, ruledOn: r.ruledOn, reasoning: r.reasoning })
    }
  }
}
const heldMoveRows = moveRows.filter(r => ownerNamed.has(r.canonical))
const applyMoveRows = moveRows.filter(r => !ownerNamed.has(r.canonical))
if (heldMoveRows.length) {
  console.log(`  HELD by owner ruling: ${heldMoveRows.length} move-out(s) contradict a standing owner ruling`)
  for (const r of heldMoveRows) console.log(`     ${r.entityId} "${r.canonical}" — ruled ${ownerNamed.get(r.canonical)[0].ruledOn}`)
}

const moveOuts = applyMoveRows.map(r => ({
  entityId: r.entityId, canonical: r.canonical, entityType: r.entityType,
  mentions: r.mentions, postCount: r.postCount, aliases: r.aliases,
  auditDecision: r.auditDecision, auditConfidence: r.auditConfidence, auditReason: r.auditReason,
  occurrences: occurrences.filter(o => o.auditEntityId === r.entityId),
}))
const applyIds = new Set(applyMoveRows.map(r => r.entityId))
const appliedOccurrences = occurrences.filter(o => applyIds.has(o.auditEntityId))
const occTotal = appliedOccurrences.length
const declared = applyMoveRows.reduce((n, r) => n + r.mentions, 0)
console.log(`  move-outs applied   : ${applyMoveRows.length} entities, ${declared} declared mentions, ${occTotal} occurrence records`)
if (occTotal !== declared) console.log(`    !! occurrence records (${occTotal}) do not match declared mentions (${declared})`)

// ── write the rulings ────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, 'audit', 'entities-stage1-rulings.json'), JSON.stringify({
  note: 'Stage 1 of the Entities/Brackets hover audit: duplicate merges, type corrections and move-outs. Extracted by scripts/extract-entities-stage1.mjs from the audit handoff package; materialised by apply-entities.mjs. These are RULINGS — nothing here is a certified result.',
  extractedOn: '2026-08-16',
  source: 'qdrops_entities_brackets_hover_audit.xlsx -> 01_ENTITY_REGISTRY_AUDIT.jsonl.txt',
  auditRows: total,
  mergeTargetRule: 'Highest mention count wins the canonical label, core registry breaks a tie, then alphabetical. Every other spelling is preserved as an alias. Groups holding more than one spelling are flagged spellingChoice for owner review.',
  // The baseline is STATED, not read off disk. Reading it from entities.json made this block
  // wrong the moment Stage 1 was applied: a second extraction reported 1,408 -> 1,371, projecting
  // the same withdrawals a second time from an already-withdrawn state. These are one-time
  // historical figures — what seed 75 shipped — so they belong here as facts, not measurements.
  expected: {
    baseline: 'seed 75, certified 2026-08-16',
    entitiesBefore: 1445,
    rowsRemovedByMerge: rowsRemoved,
    rowsRemovedByMoveOut: applyMoveRows.length,
    moveOutsHeldByOwnerRuling: heldMoveRows.length,
    entitiesAfter: 1445 - rowsRemoved - applyMoveRows.length,
    mentionsBefore: 9786,
    mentionsRemovedByMoveOut: declared,
    mentionsAfter: 9786 - declared,
    mergesMoveNoMentions: true,
  },
  auditCrosswalk,
  merges, typeCorrections,
  // Held, with the ruling that outranks them. Not applied, not discarded.
  heldMoveOuts: heldMoveRows.map(r => ({
    entityId: r.entityId, canonical: r.canonical, entityType: r.entityType, mentions: r.mentions,
    auditDecision: r.auditDecision, auditReason: r.auditReason,
    conflictsWith: ownerNamed.get(r.canonical),
  })),
  moveOuts: moveOuts.map(({ occurrences: _o, ...rest }) => rest),
}, null, 1))

// ── write the reversible history ─────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, 'audit', 'entities-moved-out-history.json'), JSON.stringify({
  note: 'Every entity occurrence withdrawn from the certified Entities count by Stage 1 of the hover audit, with enough provenance to put it back. Nothing here was deleted from a post: Q\'s text is untouched and these drops still carry every word they carried before. What changed is that this wording is no longer classified as a named entity, so it stops being highlighted and stops being counted.',
  withdrawnOn: '2026-08-16',
  withdrawnBy: 'Entities/Brackets hover audit, Stage 1 — "Move from Entities - conceptual or generic label"',
  reversible: 'Remove an entry from moveOuts in audit/entities-stage1-rulings.json and re-run apply-entities.mjs. The canonical, type, aliases, post numbers and matched text are all recorded here, so a restored row is the row that left.',
  totalEntities: moveOuts.length,
  totalOccurrences: occTotal,
  affectedPosts: [...new Set(appliedOccurrences.map(o => o.postNum))].sort((a, b) => a - b),
  moveOuts,
}, null, 1))

console.log(`\n  wrote audit/entities-stage1-rulings.json`)
console.log(`  wrote audit/entities-moved-out-history.json`)
// Projected from the STATED baseline, never from what happens to be on disk. Reading the live
// file made this line claim "1,408 -> 1,371" once Stage 1 was applied — projecting the same
// withdrawals a second time from an already-withdrawn state.
console.log(`\n  projected from the seed-75 baseline: 1445 -> ${1445 - rowsRemoved - moveRows.length} entities · 9786 -> ${9786 - declared} mentions`)
console.log(`  on disk now                        : ${ours.entities.length} entities · ${ours.totals.mentions} mentions\n`)
