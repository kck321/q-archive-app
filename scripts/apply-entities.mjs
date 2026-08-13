// Materialise the certified Entities dataset.
//
// Assembles every pass into ONE table and gates it, rather than deriving totals by arithmetic
// across five artifacts — the lesson from the Directives reconcile.
//
//   entities-audit              mentions of the 82-entity core, alias-resolved
//   entities-tail-adjudicated   the 2,295-string tail, cut off at the agreed thresholds
//   entities-other-adjudicated  typing pass over the miscellaneous bucket
//   entities-lowconf-adjudicated  the 364 low-confidence types, 129 of them corrected
//   entities-context-resolved   review verdicts + the ±3-line context pass
//
// Two kinds of "we don't know" are kept apart, because they mean different things:
//   other_named_entity  we know this names a specific thing, not what kind
//   unresolved alias    we cannot safely say WHICH thing the shorthand refers to
//
// Written to public/data/entities.json so the app reads the certified rows rather than
// re-deriving mentions from post text.
//
//   node scripts/apply-entities.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUCKET1, SAFE_GLOBAL, CONTEXT_RESOLVE } from './lib/entityVerdicts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-audit.json'), 'utf8'))
const tail = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-tail-adjudicated.json'), 'utf8'))
const other = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-other-adjudicated.json'), 'utf8'))
const lowconf = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-lowconf-adjudicated.json'), 'utf8'))
const ctx = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-context-resolved.json'), 'utf8'))

const otherBy = new Map(other.decisions.map(d => [d.sourceText, d]))
const lowBy = new Map(lowconf.decisions.map(d => [d.sourceText, d]))

// ── final type for every tail entity, after all three passes ────────────────
const tailFinal = []
const themed = []
const unresolvedTail = []
for (const d of tail.decisions) {
  if (d.outcome === 'ROUTE_TO_THEMES') { themed.push({ sourceText: d.sourceText, occurrences: d.storedOccurrences, why: d.why }); continue }
  if (d.outcome === 'UNRESOLVED') { unresolvedTail.push({ sourceText: d.sourceText, occurrences: d.storedOccurrences, why: d.why }); continue }
  if (d.outcome !== 'CANONICAL') continue

  let type = d.type
  let canonical = d.canonical ?? d.sourceText

  // pass 2 — typing of the miscellaneous bucket.
  // That pass signalled a Themes routing by putting 'ROUTE_TO_THEMES' in the type field, so
  // without this it arrives here as though it were a type and 14 concepts would ship as a
  // pseudo-category on the Entities screen.
  const o = otherBy.get(d.sourceText)
  if (type === 'other_named_entity' && o?.retyped) {
    if (o.finalType === 'ROUTE_TO_THEMES') { themed.push({ sourceText: d.sourceText, occurrences: d.storedOccurrences, why: o.why }); continue }
    type = o.finalType
  }

  // pass 3 — correction of the low-confidence types
  const l = lowBy.get(d.sourceText)
  if (l) {
    if (l.outcome === 'ROUTE_TO_THEMES') { themed.push({ sourceText: d.sourceText, occurrences: d.storedOccurrences, why: l.why }); continue }
    if (l.outcome === 'UNRESOLVED') { unresolvedTail.push({ sourceText: d.sourceText, occurrences: d.storedOccurrences, why: l.why }); continue }
    if (l.newType) type = l.newType
    if (l.outcome === 'OTHER_NAMED_ENTITY') type = 'other_named_entity'
  }

  // review verdicts outrank the classifier
  const v = BUCKET1[d.sourceText]
  if (v) {
    if (v.route) { themed.push({ sourceText: d.sourceText, occurrences: d.storedOccurrences, why: v.why }); continue }
    if (v.unresolved) { unresolvedTail.push({ sourceText: d.sourceText, occurrences: d.storedOccurrences, why: v.unresolved }); continue }
    if (v.type) type = v.type
    if (v.canonical) canonical = v.canonical
  }
  tailFinal.push({ sourceText: d.sourceText, canonical, type, occurrences: d.storedOccurrences })
}

// Alias merges collapse to one canonical row.
const merged = new Map()
for (const e of tailFinal) {
  const cur = merged.get(e.canonical)
  if (cur) { cur.occurrences += e.occurrences; cur.aliases.push(e.sourceText) }
  else merged.set(e.canonical, { canonical: e.canonical, type: e.type, occurrences: e.occurrences, aliases: [e.sourceText] })
}

// ── mentions of the core registry ───────────────────────────────────────────
const coreMentions = audit.mentions.filter(m => m.inQAuthoredText && m.canonicalEntity)
const coreEntities = new Map()
for (const m of coreMentions) {
  if (!coreEntities.has(m.canonicalEntity)) coreEntities.set(m.canonicalEntity, { canonical: m.canonicalEntity, type: m.entityType, mentions: 0, posts: new Set(), aliases: new Map() })
  const e = coreEntities.get(m.canonicalEntity)
  e.mentions++; e.posts.add(m.postNum)
  e.aliases.set(m.sourceText, (e.aliases.get(m.sourceText) ?? 0) + 1)
}

// Context-resolved occurrences become mentions of the referent the drop actually supports.
for (const r of ctx.resolutions) {
  if (!coreEntities.has(r.canonical)) coreEntities.set(r.canonical, { canonical: r.canonical, type: r.type, mentions: 0, posts: new Set(), aliases: new Map() })
  const e = coreEntities.get(r.canonical)
  e.mentions++; e.posts.add(r.postNum)
  e.aliases.set(r.token, (e.aliases.get(r.token) ?? 0) + 1)
}

const entities = [
  ...[...coreEntities.values()].map(e => ({
    canonical: e.canonical, type: e.type, mentions: e.mentions, posts: [...e.posts].sort((a, b) => a - b),
    aliases: [...e.aliases].sort((a, b) => b[1] - a[1]).map(([text, n]) => ({ text, n })),
    source: 'core registry',
  })),
  ...[...merged.values()].map(e => ({
    canonical: e.canonical, type: e.type, mentions: e.occurrences, posts: [],
    aliases: e.aliases.map(text => ({ text, n: null })),
    source: 'adjudicated tail',
  })),
]

const unresolvedAliases = [
  ...unresolvedTail,
  ...Object.entries(ctx.contextPass.perToken).filter(([, s]) => s.unresolved > 0)
    .map(([token, s]) => ({ sourceText: token, occurrences: s.unresolved, why: 'the surrounding post does not identify the referent' })),
]

// ── totals ──────────────────────────────────────────────────────────────────
const tailTypes = {}
for (const e of merged.values()) tailTypes[e.type] = (tailTypes[e.type] ?? 0) + 1
const allTypes = {}
for (const e of entities) allTypes[e.type] = (allTypes[e.type] ?? 0) + 1

const totals = {
  canonicalEntities: entities.length,
  coreRegistryEntities: coreEntities.size,
  adjudicatedTailEntities: merged.size,
  mentions: coreMentions.length + ctx.resolutions.length,
  contextResolvedMentions: ctx.resolutions.length,
  routedToThemes: themed.length,
  unresolvedAliasTokens: unresolvedAliases.length,
  unresolvedAliasOccurrences: unresolvedAliases.reduce((n, u) => n + (u.occurrences ?? 0), 0),
  typeDistributionAdjudicatedTail: tailTypes,
  typeDistributionAll: allTypes,
}

// ── QA gate ─────────────────────────────────────────────────────────────────
// Asserted against the MATERIALISED artifact, not against the pre-verdict classifier counts.
// The manual verdicts are authoritative: other_named_entity falling from 101 to 6 is the
// review having done its job, not a regression.
const T = tailTypes
const checks = [
  ['canonical entities = 1,332', entities.length === 1332, entities.length],
  ['resolved mentions = 4,463', totals.mentions === 4463, totals.mentions],
  ['context-resolved mentions = 161', ctx.resolutions.length === 161, ctx.resolutions.length],
  // 53, not the 39 reported earlier: the ROUTE_TO_THEMES fix routes the 14 concepts that were
  // previously leaking through as though 'ROUTE_TO_THEMES' were a type. 39 + 14 = 53.
  ['routed to Themes = 53', themed.length === 53, themed.length],
  ['unresolved alias tokens = 1,011', unresolvedAliases.length === 1011, unresolvedAliases.length],
  ['unresolved occurrences = 2,237', totals.unresolvedAliasOccurrences === 2237, totals.unresolvedAliasOccurrences],
  ['people = 722', T.person === 722, T.person],
  ['organizations = 122', T.organization === 122, T.organization],
  ['media organizations = 95', T.media_organization === 95, T.media_organization],
  ['other named entities = 6', T.other_named_entity === 6, T.other_named_entity],
  ['countries/regions = 65', T.country_region === 65, T.country_region],
  ['government institutions = 62', T.government_institution === 62, T.government_institution],
  ['locations = 44', T.location === 44, T.location],
  ['title/roles = 22', T.title_role === 22, T.title_role],
  // No routing marker may survive as though it were a type.
  ['no ROUTE_TO_THEMES pseudo-type', !Object.keys(allTypes).includes('ROUTE_TO_THEMES'), 'ok'],
  ['every entity carries a type', entities.every(e => e.type), 'ok'],
  ['no entity is also routed to Themes', !entities.some(e => themed.some(t => t.sourceText === e.canonical)), 'ok'],
  ['review verdicts applied', Object.keys(BUCKET1).length > 90, `${Object.keys(BUCKET1).length} bucket-1 verdicts`],
]

console.log('\n  ADJUDICATED-TAIL TYPES (after the review verdicts):')
for (const [k, n] of Object.entries(T).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`)

console.log('\nAPPLY CERTIFIED ENTITIES\n')
console.log(`  canonical entities      : ${entities.length.toLocaleString()}  (${coreEntities.size} core + ${merged.size} adjudicated tail)`)
console.log(`  mentions                : ${totals.mentions.toLocaleString()}  (${ctx.resolutions.length} resolved by context)`)
console.log(`  routed to Themes        : ${themed.length}`)
console.log(`  unresolved alias tokens : ${unresolvedAliases.length.toLocaleString()}  (${totals.unresolvedAliasOccurrences.toLocaleString()} occurrences)`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(38)} ${got}`) }
if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: entities.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'entities.json'), JSON.stringify({ certified: true, totals, entities, routedToThemes: themed, unresolvedAliases }))
console.log(`\nwrote public/data/entities.json (${(fs.statSync(path.join(DATA, 'entities.json')).size / 1048576).toFixed(2)} MB)\n`)
