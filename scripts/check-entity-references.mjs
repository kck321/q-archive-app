// Does anything still point at an entity that no longer exists?
//
//   node scripts/check-entity-references.mjs
//
// Stage 1 removed 36 rows from the entity table — 19 merged into another row, 17 withdrawn
// entirely. Every one of them was a name that other artifacts refer to BY NAME, because until
// this stage the archive had no entity id and the display label was the only handle there was.
//
// A dangling reference here is not a crash. It is a chip that filters to nothing, a relationship
// edge to a row that is gone, a search hit that lands on an empty page — all of which look like
// the data is missing rather than like a link is stale. That is why this runs as its own check
// instead of being folded into a count assertion.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const read = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const readIf = (dir, f) => fs.existsSync(path.join(dir, f)) ? read(dir, f) : null

const entities = read(DATA, 'entities.json')
const live = new Set(entities.entities.map(e => e.canonical))
const liveIds = new Set(entities.entities.map(e => e.id))
const ledger = readIf(OUT, 'entity-ids.json')
const stage1 = readIf(OUT, 'entities-stage1-rulings.json')
const history = readIf(OUT, 'entities-moved-out-history.json')

// Names that legitimately no longer have a row, and what happened to each.
//
// A merge that collapses two rows carrying the SAME canonical — "Bill Clinton" from the core
// registry and "Bill Clinton" from the adjudicated tail — absorbs a row without retiring a name.
// Treating those as removed reported Bill Clinton, Australia, New York, Julian Assange, Hong Kong
// and Valerie Jarrett as dangling while every one of them was live.
const absorbed = new Map()                                   // retired spelling -> surviving canonical
for (const m of stage1?.merges ?? []) {
  for (const a of m.absorb) if (a.canonical !== m.canonical) absorbed.set(a.canonical, m.canonical)
}
const withdrawn = new Set((stage1?.moveOuts ?? []).map(m => m.canonical))

console.log('\nENTITY REFERENCE INTEGRITY\n')
console.log(`  live entities        : ${live.size}`)
console.log(`  absorbed by a merge  : ${absorbed.size} name(s) now resolve to another row`)
console.log(`  withdrawn            : ${withdrawn.size} name(s) are no longer entities`)

let failed = 0
const check = (label, ok, detail) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${detail}`) }

// ── 1. identity is complete and unique ───────────────────────────────────────
console.log('\n  IDENTITY')
check('every entity has an immutable id', entities.entities.every(e => /^qe-[0-9a-f]{12}$/.test(e.id ?? '')), `${liveIds.size} ids`)
check('every id is unique', liveIds.size === entities.entities.length, `${liveIds.size}/${entities.entities.length}`)
check('every entity has a slug', entities.entities.every(e => e.slug), 'ok')
check('every slug is unique', new Set(entities.entities.map(e => e.slug)).size === entities.entities.length,
  `${new Set(entities.entities.map(e => e.slug)).size}/${entities.entities.length}`)
check('every canonical is unique', live.size === entities.entities.length, `${live.size}/${entities.entities.length}`)
// An id must not encode anything that legitimately changes about the entity it names.
const encodesName = entities.entities.filter(e => e.id.slice(3).includes(String(e.canonical).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)) && e.canonical.length > 5)
check('no id encodes its own name', encodesName.length === 0, `${encodesName.length} suspicious`)

// ── 2. the ledger resolves every historical name ─────────────────────────────
console.log('\n  LEDGER')
if (ledger) {
  const resolvable = new Map()
  for (const [id, e] of Object.entries(ledger.entries)) {
    resolvable.set(e.canonical, id)
    for (const p of e.previousCanonicals ?? []) resolvable.set(p, id)
  }
  const unresolvableAbsorbed = [...absorbed.keys()].filter(n => !resolvable.has(n))
  check('every absorbed spelling still resolves', unresolvableAbsorbed.length === 0,
    unresolvableAbsorbed.length ? unresolvableAbsorbed.join(', ') : `${absorbed.size} resolve to their survivor`)
  const ledgerIds = new Set(Object.keys(ledger.entries))
  const orphanLedger = [...liveIds].filter(id => !ledgerIds.has(id))
  check('every live id is in the ledger', orphanLedger.length === 0, `${ledgerIds.size} tracked`)
  // The crosswalk must cover every audit reference: mapped, or withdrawn and held in history.
  const crossed = new Set()
  for (const e of Object.values(ledger.entries)) for (const a of e.auditEntityIds ?? []) crossed.add(a)
  const heldIds = new Set((history?.moveOuts ?? []).map(m => m.entityId))
  const allAudit = (stage1?.auditCrosswalk ?? []).map(r => r.entityId)
  const uncovered = allAudit.filter(id => !crossed.has(id) && !heldIds.has(id))
  check('every ENT-#### resolves or is held', uncovered.length === 0,
    `${crossed.size} mapped + ${heldIds.size} held / ${allAudit.length}`)
}

// ── 3. nothing points at a row that is gone ──────────────────────────────────
console.log('\n  DANGLING REFERENCES')
const dangling = (label, names, extra = '') => {
  const bad = [...new Set(names)].filter(n => n && !live.has(n))
  check(label, bad.length === 0, bad.length ? `${bad.length}: ${bad.slice(0, 6).join(', ')}` : `ok${extra}`)
  return bad
}

// codes.json cross-links entities. linkedEntityId holds the ALIAS TOKEN Q wrote — "[RR]" links to
// "RR", not to "Rod Rosenstein" — so resolution goes through the alias table. Comparing it against
// canonical names reported all 32 links as broken when none was.
const aliasToCanonical = new Map()
for (const e of entities.entities) for (const a of e.aliases) aliasToCanonical.set(a.text, e.canonical)
const codes = readIf(DATA, 'codes.json')
if (codes) {
  const linked = (codes.codes ?? []).filter(c => c.linkedEntityId)
  const bad = linked.filter(c => !aliasToCanonical.has(c.linkedEntityId) && !live.has(c.linkedEntityId))
  check('codes linkedEntity targets resolve', bad.length === 0,
    bad.length ? bad.slice(0, 6).map(c => c.linkedEntityId).join(', ') : `${linked.length} cross-links resolve`)
}

// relationships.json joins every section; an edge to a withdrawn row is a link to nothing.
// relationships.json keys its entity edges off analysisMap, not a nodes array. The first version
// of this check looked for rel.nodes, found nothing, and passed on an empty set — a zero is not
// evidence until the field is proved to exist.
const rel = readIf(DATA, 'relationships.json')
if (rel) {
  // ONLY entity_code edges name an entity. An unresolved_occurrence edge also carries
  // section:'entities' on its `to` side, but its `text` is the surrounding drop, not a name —
  // reading those reported 37 broken references that were whole sentences.
  const edges = Object.values(rel.byPost ?? {}).flat().filter(e => e.type === 'entity_code')
  const names = new Set(edges.map(e => (e.to?.section === 'entities' ? e.to.id : e.from?.id)).filter(Boolean))
  const bad = [...names].filter(n => !live.has(n))
  check('relationship entity edges resolve', bad.length === 0 && names.size > 0,
    names.size === 0 ? 'NO entity edges found — check is vacuous'
      : bad.length ? `${bad.length}: ${bad.slice(0, 6).join(', ')}` : `${edges.length} edges, ${names.size} distinct entities, all live`)
}

// The search index is what a reader actually lands on.
// Search rows are compact: `s` is the section and `t` the title. Reading r.section found nothing.
const search = readIf(DATA, 'search-index.json')
if (search) {
  const rows = (search.rows ?? []).filter(r => r.s === 'entities')
  const bad = rows.map(r => r.t).filter(t => t && !live.has(t))
  check('indexed entities exist', bad.length === 0 && rows.length > 0,
    rows.length === 0 ? 'NO indexed entities found — check is vacuous'
      : bad.length ? `${bad.length}: ${bad.slice(0, 6).join(', ')}` : `${rows.length} indexed, all live`)
}

// The glossary is derived from the finished entity set.
// The glossary keys its rows under `tokens`, not `terms`.
const glossary = readIf(DATA, 'glossary.json')
if (glossary) {
  // A glossary `meaning` is a human EXPANSION ("CBS — the American broadcast television network"),
  // not a certified canonical, so requiring every one to match a row is the wrong question and
  // fails on 23 readings that never pointed at a row. The right question is narrower and is the
  // one this stage can actually break: does any reading now name something Stage 1 removed?
  const readings = Object.entries(glossary.tokens ?? {})
    .flatMap(([token, list]) => list.map(r => ({ token, ...r })))
    .filter(r => r.kind === 'entity')
  const broken = readings.filter(r => withdrawn.has(r.meaning) || absorbed.has(r.meaning))
  check('no glossary reading names a removed entity', broken.length === 0 && readings.length > 0,
    readings.length === 0 ? 'NO entity readings — check is vacuous'
      : broken.length ? broken.slice(0, 6).map(r => `${r.token}->${r.meaning}`).join(', ')
        : `${readings.length} entity readings, none names a merged or withdrawn row`)
}

// Owner rulings name entities directly; a ruling pointing at a merged-away row silently stops
// applying, which is how an editorial decision disappears without any error.
const orules = readIf(OUT, 'entities-owner-rulings.json')
if (orules) {
  const named = [
    ...(orules.rulings ?? []).map(r => r.canonical),
    ...(orules.aliasRulings ?? []).map(r => r.canonical),
    ...(orules.mergeRulings ?? []).map(r => r.canonical),
    ...(orules.aliasWithdrawals ?? []).map(r => r.canonical),
  ]
  // A ruling naming a row that no longer exists silently stops applying — an editorial decision
  // vanishing with no error. Held move-outs are the reason this passes: the one audit row that
  // would have broken a ruling was not applied.
  dangling('owner rulings target live entities', named, ` (${named.length} references)`)
}

// ── 4. the withdrawn are preserved, not deleted ──────────────────────────────
console.log('\n  WITHDRAWN OCCURRENCES ARE PRESERVED')
if (history) {
  const posts = read(DATA, 'posts.json')
  const byNum = new Map(posts.map(p => [p.postNum, p]))
  let textIntact = 0, stillPainted = [], missingPost = [], stillMissing = []
  for (const mo of history.moveOuts) {
    for (const o of mo.occurrences) {
      const p = byNum.get(o.postNum)
      if (!p) { missingPost.push(o.postNum); continue }
      // The words are still in the drop. This is the whole promise of a move-out.
      // Compared with punctuation folded away: #336's "Presidential Advisory" lives in the drop as
      // the URL slug "presidential-advisory", so a plain substring test called it missing. The
      // words ARE in the post — which is the claim being checked — and that this row existed only
      // inside a whitehouse.gov URL is precisely why the audit withdrew it.
      const fold = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (fold(p.text).includes(fold(o.matchedAlias))) textIntact++
      else stillMissing.push(`#${o.postNum} "${o.matchedAlias}"`)
      const ne = p.postAnalysis?.namedEntities ?? []
      if (ne.some(t => t.toLowerCase() === String(o.matchedAlias).toLowerCase())) {
        stillPainted.push(`#${o.postNum} "${o.matchedAlias}"`)
      }
    }
  }
  const total = history.totalOccurrences
  check('every withdrawn post still exists', missingPost.length === 0, `${total} occurrences across ${history.affectedPosts.length} posts`)
  check('the words are still in the drops', textIntact === total,
    stillMissing.length ? `${textIntact}/${total} — missing: ${stillMissing.slice(0, 5).join(', ')}` : `${textIntact}/${total} found in post text`)
  check('none is still painted as an entity', stillPainted.length === 0,
    stillPainted.length ? stillPainted.slice(0, 5).join(', ') : 'ok')
  check('every withdrawn row kept its provenance',
    history.moveOuts.every(m => m.canonical && m.entityType && m.auditReason && m.occurrences.length),
    `${history.moveOuts.length} rows, each with type, reason and occurrences`)
  check('occurrence count matches the certified drop',
    total === (stage1?.expected?.mentionsRemovedByMoveOut ?? -1), `${total}`)
}

console.log(`\n  ${failed ? `❌ ${failed} check(s) failed` : '✅ no broken or orphaned entity references'}\n`)
process.exit(failed ? 1 : 0)
