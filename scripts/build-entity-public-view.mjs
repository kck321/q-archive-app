// The PUBLIC VIEW of the entity registry — one row per permanent qe- identity, and the
// traceability that proves each row belongs on screen.
//
// WHY THIS FILE EXISTS
// ────────────────────
// The Named Entities page was printing three different populations as though they were one
// number, and none of them was the registry:
//
//   1,201  certified canonical entities        entities.json — the authority
//   1,066  rows the list actually rendered     entities.json minus the 135 with no prose mention
//     879  "items" in the page header          DISTINCT STRINGS in the browser's frequency index
//     853  "repeated + found once"             those 879 less the 26 the verbatim filter emptied
//
// 879 and 853 are properties of `postAnalysis.namedEntities` grouped by normalised text. They
// count SPELLINGS, not identities: "Bill Clinton" and "BC" are two rows there and one entity
// here, and a string that no longer appears in visible prose drops out of the tally entirely.
// Printing either of them above a registry-backed list described a different population than the
// one underneath it.
//
// So the page stops recounting. This artifact carries the reconciled model:
//
//     1,066  named in Q's prose        (mentions >= 1)
//   +   135  linked as a source only   (mentions == 0, still referenced as a publisher/account)
//   ─────────
//     1,201  public canonical rows     == entities.json
//
// plus 208 dormant identities, which are RESERVED FOREVER and never enter the public list.
// The two components are disjoint by construction (mentions >= 1 xor mentions == 0) and the
// invariants in audit-cross-section.mjs assert both the split and the sum.
//
// TRACEABILITY IS THE POINT
// ─────────────────────────
// No public row may appear without evidence a reader can open:
//
//   prose row        its certified post list from entities.json
//   source-only row  the posts that LINKED the material, from linked-sources.json, each labelled
//                    with what the link was — a publisher domain or an account Q pointed at
//
// A source reference is never presented as a prose mention. Those 135 identities have zero
// mentions and this artifact records zero for them; what they have is `sourcePosts`, a different
// field with a different label, so the two can never be confused downstream.
//
// PER-POST MENTION COUNTS
// ───────────────────────
// The amber "x2" on a post chip is the only place a reader learns Q said a name twice in one
// drop. The browser was deriving it from a Map keyed by POST NUMBER ALONE, shared across every
// entity in the frequency index — so in 443 posts the last entity written won and every other
// entity in that drop inherited its repeat count. #1009 carries "AZ" twice and "Russia" once, and
// Russia's chip claimed x2.
//
// The fix is to attribute occurrences the only way they can honestly be attributed: from the
// certified occurrence ledger, which resolved each one to exactly one entity. Two guards:
//
//   - a count is emitted only for a (entity, post) pair the REGISTRY also lists. The registry is
//     the membership authority; the ledger is the occurrence detail underneath it.
//   - the 61 occurrences the ledger marks "attribution must be settled by an occurrence-level
//     ruling" are excluded. They are shared aliases — "CS" is Chuck Schumer, CrowdStrike AND
//     Christopher Steele — and a repeat chip drawn from an unsettled attribution is exactly the
//     leak this artifact exists to prevent. They stay certified and stay counted in the 8,798;
//     they simply do not earn a repeat badge on anyone's row.
//
// THE ROW RULE (owner ruling, 2026-08-17)
// ───────────────────────────────────────
// "If the entity connects with an alias I want them to stay together, and this rule should apply
// for all entities. Let's make the main entity the one that has the most posts, and then the alias
// with the most to least posts follow behind it."
//
// So a row is a CONNECTED SET of identities, not always a single identity:
//
//   connected   two identities are one row when the alias registry CONNECTS them — the owner's
//               editable groups in aliases.json, or a certified merge ruling. POTUS and Donald
//               Trump are one man; God, Lord, Jesus Christ and Jesus are one subject.
//   label       the identity in the set with the most posts wins the row's name.
//   aliases     every other spelling, ordered by its own post count, most to least.
//
// CONNECTED IS NOT "SHARES A SPELLING", and the difference is the whole reason this is written
// down. Merging any two identities that happen to share an alias STRING was measured against the
// registry and collapses 1,066 identities into 1,006 rows, including:
//
//     Barack Obama + Bruce Ohr + Board Owner + Nellie Ohr        all spelled "BO"
//     CIA + ABC News + Alphabet Inc.                             all spelled "ABC"
//     Chuck Schumer + CrowdStrike + Christopher Steele           all spelled "CS"
//     Hillary Clinton + Clinton Foundation + Bill Clinton        all spelled "Clinton"
//
// A collision is not a connection. Only an established link merges, which is what "do not restore
// global string-based alias folding" protects. 46 alias strings are claimed by more than one
// identity and none of them merges anything.
//
// Nothing here changes membership or any total. Every count is read from a committed artifact and
// re-derived byte-identically on every run.
//
//   node scripts/build-entity-public-view.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableStringify } from './lib/stableJson.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const AUDIT = path.join(ROOT, 'audit')

const readData = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const readAudit = f => JSON.parse(fs.readFileSync(path.join(AUDIT, f), 'utf8'))

const die = msg => { console.error(`FAIL  ${msg}`); process.exit(1) }

const registry = readData('entities.json')
const linked = readData('linked-sources.json')
const sourceOnly = readAudit('entity-source-only-registry.json')
const dormant = readAudit('entity-dormant-registry.json')
const ledger = readAudit('occurrence-provenance-audit.json')

// ── The public row set is the registry, in full ───────────────────────────────
const entities = registry.entities ?? []
if (!entities.length) die('entities.json carries no entities')

const ids = entities.map(e => e.id)
if (new Set(ids).size !== ids.length) die('entities.json repeats a qe- id — one row must be one identity')

// ── Dormant identities may never enter the public list ────────────────────────
// The ids are reserved so a later occurrence resolves back to the same identity instead of
// minting a second one for something the archive already named. Reserved is not published.
const dormantIds = new Set(
  (dormant.entities ?? []).map(d => d.id ?? d).filter(Boolean),
)
const leaked = ids.filter(id => dormantIds.has(id))
if (leaked.length) die(`${leaked.length} dormant identities are in the public registry: ${leaked.slice(0, 5).join(', ')}`)

// ── Linked sources, grouped by the entity the domain or handle belongs to ─────
// entityId is set only where the domain plainly belongs to the entity (linked-sources.json
// `boundMeaning`). An unbound record names a source we will not claim identifies an entity, so it
// contributes to no row.
const sourceByEntity = new Map()
for (const [postKey, records] of Object.entries(linked.byPost ?? {})) {
  const post = Number(postKey)
  for (const rec of records) {
    if (!rec.entityId) continue
    if (!sourceByEntity.has(rec.entityId)) sourceByEntity.set(rec.entityId, new Map())
    const byPost = sourceByEntity.get(rec.entityId)
    // One chip per post. A post that linked two Fox News articles is still one post chip, and the
    // kind it carries is the one that describes the link — publisher and social_account never
    // collide on the same (entity, post) in the certified data, and the assertion below holds it.
    const prev = byPost.get(post)
    if (prev && prev !== rec.kind) {
      byPost.set(post, 'linked_source')      // mixed evidence on one post -> the generic label
    } else {
      byPost.set(post, rec.kind)
    }
  }
}

// ── Per-post mention counts, from the certified occurrence ledger ─────────────
//
// OWNER RULING 3 WITHDREW 27 OF THE LEDGER'S "KEEP"/"HOLD" ROWS AFTER IT WAS WRITTEN.
//
// The ledger keeps its 2026-08-17 bytes on purpose — it is the approval record, and rewriting it
// would erase what the owner actually approved. So the later ruling is subtracted here rather than
// edited in, exactly as apply-entity-cleanup.mjs applies it beside the audit rather than inside it.
// Without this the retained count stays at 8,975 against a registry that now certifies 8,948, and
// the guard below stops the build — which is the guard doing its job, not a number to relax.
const ruling3Path = path.join(AUDIT, 'occurrence-withdrawals-owner-ruling-3.json')
const ruling3Withdrawn = fs.existsSync(ruling3Path)
  ? new Set(readAudit('occurrence-withdrawals-owner-ruling-3.json').withdrawals.map(w => w.occurrenceId))
  : new Set()

const SETTLED = r => /^(keep|hold)/.test(r.proposedAction ?? '') && !ruling3Withdrawn.has(r.occurrenceId)
const UNSETTLED_ATTRIBUTION = r => /attribution must be settled/.test(r.proposedAction ?? '')

const retained = (ledger.rows ?? []).filter(SETTLED)
const ledgerMentions = retained.length
if (ledgerMentions !== (registry.totals?.mentions ?? -1)) {
  die(`ledger retains ${ledgerMentions} occurrences, registry says ${registry.totals?.mentions} — these must agree`)
}

// Per-alias DISTINCT POST counts, so the row can order its spellings most-to-least as the owner
// ruled. Taken from the ledger because that is the only record of which spelling a given drop used;
// the registry stores a mention total per alias, which ranks a name shouted twice in one drop above
// one written once in each of two.
const aliasPostsByEntity = new Map()

const perPostByEntity = new Map()
let unsettledExcluded = 0
for (const r of retained) {
  // The unsettled ones arrive with entityId already null — the ledger refuses to name an entity it
  // cannot establish. Counted before that guard so the figure below is the real exclusion, not a
  // silent zero that happens to look clean.
  if (UNSETTLED_ATTRIBUTION(r)) { unsettledExcluded++; continue }
  if (!r.entityId) continue
  if (!perPostByEntity.has(r.entityId)) perPostByEntity.set(r.entityId, new Map())
  const m = perPostByEntity.get(r.entityId)
  m.set(r.postNum, (m.get(r.postNum) ?? 0) + 1)

  const alias = (r.alias ?? '').trim()
  if (alias) {
    if (!aliasPostsByEntity.has(r.entityId)) aliasPostsByEntity.set(r.entityId, new Map())
    const byAlias = aliasPostsByEntity.get(r.entityId)
    if (!byAlias.has(alias)) byAlias.set(alias, new Set())
    byAlias.get(alias).add(r.postNum)
  }
}

// ── Build the rows ───────────────────────────────────────────────────────────
const rows = {}
let prose = 0
let sourceOnlyRows = 0
let sourcePostChips = 0
let repeatBadges = 0
const untraceable = []

for (const e of entities) {
  const mentions = e.mentions ?? 0
  const posts = [...new Set(e.posts ?? [])].sort((a, b) => a - b)
  const postSet = new Set(posts)

  const srcMap = sourceByEntity.get(e.id) ?? new Map()
  const sourcePosts = [...srcMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([post, kind]) => ({ post, kind }))

  // Occurrence counts per drop, clipped to the registry's own post set. A ledger row for a post the
  // registry does not list for this entity is an attribution the registry did not make, and the
  // registry wins.
  //
  // EVERY count is emitted, including 1. The alias registry can put two identities in one row, and a
  // row that shows a badge only where a single identity repeated itself would print no badge for a
  // drop naming the same subject as both "POTUS" and "Trump" — twice, in Q's own words. The consumer
  // sums the identities sharing the row and badges the total.
  const perPost = {}
  for (const [post, n] of [...(perPostByEntity.get(e.id) ?? new Map())].sort((a, b) => a[0] - b[0])) {
    if (!postSet.has(post)) continue
    perPost[String(post)] = n
    if (n > 1) repeatBadges++
  }

  // A repeat total can never exceed what the entity was certified for.
  const perPostTotal = Object.values(perPost).reduce((a, b) => a + b, 0)
  if (perPostTotal > mentions) {
    die(`${e.canonical}: per-post repeats total ${perPostTotal} exceeds its ${mentions} certified mentions`)
  }

  const kind = mentions > 0 ? 'prose' : 'source_only'
  if (kind === 'prose') {
    prose++
    if (!posts.length) untraceable.push(`${e.canonical} (prose, no posts)`)
  } else {
    sourceOnlyRows++
    if (!sourcePosts.length) untraceable.push(`${e.canonical} (source-only, no source records)`)
  }
  sourcePostChips += sourcePosts.length

  // Distinct posts per spelling, for the most-to-least alias order.
  const aliasPosts = {}
  for (const [alias, postsWith] of (aliasPostsByEntity.get(e.id) ?? new Map())) {
    const n = [...postsWith].filter(p => postSet.has(p)).length
    if (n) aliasPosts[alias] = n
  }

  rows[e.id] = {
    kind,
    posts: posts.length,
    ...(sourcePosts.length ? { sourcePosts } : {}),
    ...(Object.keys(perPost).length ? { perPostMentions: perPost } : {}),
    ...(Object.keys(aliasPosts).length ? { aliasPosts } : {}),
  }
}

// ── Gates. This script must not be able to publish an unreconciled view ──────
if (untraceable.length) {
  die(`${untraceable.length} public rows have no traceability: ${untraceable.slice(0, 5).join('; ')}`)
}
if (prose + sourceOnlyRows !== entities.length) {
  die(`breakdown ${prose} + ${sourceOnlyRows} does not add to ${entities.length} public rows`)
}
if (sourceOnlyRows !== (sourceOnly.total ?? -1)) {
  die(`${sourceOnlyRows} source-only rows against a certified ${sourceOnly.total}`)
}
// The source-only registry is the certified enumeration of that component; the rows derived here
// must be exactly it, not merely the same size.
const certifiedSourceOnly = new Set((sourceOnly.entities ?? []).map(x => x.id))
const derivedSourceOnly = new Set(Object.entries(rows).filter(([, r]) => r.kind === 'source_only').map(([id]) => id))
const onlyInCertified = [...certifiedSourceOnly].filter(id => !derivedSourceOnly.has(id))
const onlyInDerived = [...derivedSourceOnly].filter(id => !certifiedSourceOnly.has(id))
if (onlyInCertified.length || onlyInDerived.length) {
  die(`source-only membership differs from the certified registry: +${onlyInDerived.length} / -${onlyInCertified.length}`)
}
// Each certified source-only entity's post list must be the one the linked-source records support.
for (const e of sourceOnly.entities ?? []) {
  const derived = (rows[e.id]?.sourcePosts ?? []).map(s => s.post).join(',')
  const certifiedPosts = [...new Set(e.linkedSourcePosts ?? [])].sort((a, b) => a - b).join(',')
  if (derived !== certifiedPosts) {
    die(`${e.canonical}: source posts ${derived || '(none)'} against certified ${certifiedPosts}`)
  }
}

const mentionsTotal = entities.reduce((s, e) => s + (e.mentions ?? 0), 0)
if (mentionsTotal !== (registry.totals?.mentions ?? -1)) {
  die(`mentions sum ${mentionsTotal} against declared ${registry.totals?.mentions}`)
}

// ── The row model: connected identities share a row ──────────────────────────
// Grouped exactly as the page groups them, so the number the header prints and the number of rows
// underneath it come from one calculation. A row is keyed by the owner alias group an identity
// belongs to, or by its own id when nothing connects it.
const editableAliases = readData('aliases.json')
const ownerGroupOf = name => {
  const t = (name ?? '').toLowerCase().trim()
  if (!t) return null
  if (editableAliases[t]) return t
  for (const [canon, members] of Object.entries(editableAliases)) {
    if (members.some(m => m.toLowerCase().trim() === t)) return canon
  }
  return null
}

// Connections come from two registries and both are edges in one graph, so a chain resolves to a
// single row: "The Washington Post" carries the alias "Washington Post", which is itself an identity
// carrying the alias "WASH POST", which is a third. Keyed grouping handled one hop and left the
// third as its own row.
const parent = new Map(entities.map(e => [e.id, e.id]))
const find = id => { while (parent.get(id) !== id) { parent.set(id, parent.get(parent.get(id))); id = parent.get(id) } return id }
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }

// ① AN IDENTITY WHOSE CANONICAL IS ANOTHER IDENTITY'S REGISTERED ALIAS IS THE SAME SUBJECT.
//
// The registry ships "Peter Strzok" carrying the alias "STRZOK" and, separately, an identity whose
// canonical IS "Strzok". Published as two rows those read as two people, and the second is a
// duplicate of the first under a shorter name. All 14 such pairs are one subject named two ways:
// Lisa Page / Page, Imran Awan / Awan, Christopher Wray / Wray, Paris Agreement / Paris Accord.
//
// This is a CONNECTION — one identity's whole name is the other's alias. It is not the collision
// case: "BO" is an alias of Barack Obama, Bruce Ohr AND Board Owner, and no identity is named "BO",
// so nothing merges. 46 spellings are shared that way and every one stays separate.
const byCanonical = new Map(entities.map(e => [e.canonical.toLowerCase().trim(), e]))
const canonicalAliasEdges = []
for (const e of entities) {
  for (const a of e.aliases ?? []) {
    const other = byCanonical.get((a.text ?? '').toLowerCase().trim())
    if (!other || other.id === e.id) continue
    union(e.id, other.id)
    canonicalAliasEdges.push({ alias: a.text, of: e.canonical, is: other.canonical })
  }
}

// ② The owner's editable groups, which outrank everything and can connect identities the
// adjudication kept apart (POTUS and Donald Trump; God, Lord, Jesus Christ and Jesus).
const byOwnerGroup = new Map()
for (const e of entities) {
  let group = ownerGroupOf(e.canonical)
  if (!group) {
    for (const a of e.aliases ?? []) { group = ownerGroupOf(a.text); if (group) break }
  }
  if (!group) continue
  if (byOwnerGroup.has(group)) union(e.id, byOwnerGroup.get(group))
  else byOwnerGroup.set(group, e.id)
}

const rowGroups = new Map()
for (const e of entities) {
  const key = find(e.id)
  if (!rowGroups.has(key)) rowGroups.set(key, [])
  rowGroups.get(key).push(e)
}

// Every identity lands in exactly one row — that is what makes the row count and the identity count
// reconcile rather than merely coexist.
const covered = [...rowGroups.values()].reduce((s, g) => s + g.length, 0)
if (covered !== entities.length) die(`row groups cover ${covered} identities, registry has ${entities.length}`)

// A merged row must never mix the two components. A prose identity and a source-only identity in
// one row would make "1,066 prose + 135 source-only" describe rows it does not describe.
const mixed = [...rowGroups.entries()].filter(([, g]) =>
  g.some(e => (e.mentions ?? 0) > 0) && g.some(e => (e.mentions ?? 0) === 0))
if (mixed.length) {
  die(`${mixed.length} rows mix prose and source-only identities: ${mixed.slice(0, 3).map(([k]) => k).join(', ')}`)
}

// The row an identity belongs to, so the page groups by this instead of re-deriving the rule.
// A stable, meaningful key: the label of the identity that names the row.
const rowIdOf = new Map()
for (const [key, g] of rowGroups) {
  const top = [...g].sort((a, b) =>
    (b.posts?.length ?? 0) - (a.posts?.length ?? 0)
    || (b.mentions ?? 0) - (a.mentions ?? 0)
    || a.canonical.localeCompare(b.canonical))[0]
  for (const e of g) rowIdOf.set(e.id, top.id)
  void key
}
for (const [id, r] of Object.entries(rows)) r.rowId = rowIdOf.get(id)

const mergedRows = [...rowGroups.entries()]
  .filter(([, g]) => g.length > 1)
  .map(([key, g]) => {
    // The identity with the most posts wins the label; the certified mention count and then the
    // name break ties so a rebuild reproduces the same choice byte for byte.
    const ordered = [...g].sort((a, b) =>
      (b.posts?.length ?? 0) - (a.posts?.length ?? 0)
      || (b.mentions ?? 0) - (a.mentions ?? 0)
      || a.canonical.localeCompare(b.canonical))
    return {
      rowId: ordered[0].id,
      label: ordered[0].canonical,
      identityIds: ordered.map(e => e.id),
      identities: ordered.map(e => ({ canonical: e.canonical, posts: e.posts?.length ?? 0, mentions: e.mentions ?? 0 })),
    }

  })
  .sort((a, b) => a.label.localeCompare(b.label) || a.rowId.localeCompare(b.rowId))

const mergedIdentities = mergedRows.reduce((s, r) => s + r.identityIds.length, 0)
const publicRows = rowGroups.size

// ── Emit ─────────────────────────────────────────────────────────────────────
const KIND_LABELS = {
  publisher: 'Publisher link',
  social_account: 'Social account',
  linked_source: 'Linked source',
}

const out = {
  certified: true,
  note: 'The public view of the entity registry: one row per permanent qe- identity, with the traceability that proves it belongs on screen. Derived only from committed artifacts — it changes no membership and no total.',
  ruledOn: '2026-08-17',
  derivedFrom: [
    'public/data/entities.json',
    'public/data/linked-sources.json',
    'audit/entity-source-only-registry.json',
    'audit/entity-dormant-registry.json',
    'audit/occurrence-provenance-audit.json',
  ],
  totals: {
    canonicalEntities: entities.length,
    publicRows,
    mergedRows: mergedRows.length,
    mergedIdentities,
    proseMentioned: prose,
    sourceOnly: sourceOnlyRows,
    mentions: mentionsTotal,
    dormantReserved: dormantIds.size,
    sourcePostChips,
    repeatBadges,
    unsettledAttributionsExcluded: unsettledExcluded,
  },
  rowRule: 'One row per permanent qe- identity, except where the alias registry CONNECTS identities — then the connected set is one row, labelled by the identity with the most posts, with the other spellings ordered most to least posts. Sharing an alias spelling is not a connection: 46 spellings are claimed by more than one identity and none of them merges anything.',
  mergedRows,
  // The disjoint components of the headline total, in display order. They are rendered from this
  // list, so the page cannot show a breakdown that does not add up to the total beside it.
  breakdown: [
    { key: 'prose', label: 'named in Q’s prose', count: prose },
    { key: 'sourceOnly', label: 'linked as a source only', count: sourceOnlyRows },
  ],
  kindLabels: KIND_LABELS,
  sourceNote: 'The post linked this source. It is not necessarily named in Q’s prose, and it is never counted as a mention.',
  dormantNote: 'Identities whose every certified mention turned out to be a URL fragment, a slug, or an alias inside a longer word. Their qe- ids are reserved permanently so a later occurrence resolves back to the same identity, but they are not published and are not part of the entity total.',
  rows,
}

const file = path.join(DATA, 'entity-public-view.json')
fs.writeFileSync(file, stableStringify(out, 1))

console.log('ENTITY PUBLIC VIEW')
console.log(`  identities         ${entities.length}`)
console.log(`    prose-mentioned  ${prose}`)
console.log(`    source-only      ${sourceOnlyRows}`)
console.log(`  public rows        ${publicRows}  (${mergedRows.length} rows cover ${mergedIdentities} alias-connected identities)`)
for (const r of mergedRows) console.log(`      ${r.label} <- ${r.identities.map(i => `${i.canonical} (${i.posts}p)`).join(' | ')}`)
console.log(`  mentions           ${mentionsTotal}`)
console.log(`  dormant reserved   ${dormantIds.size}  (never published)`)
console.log(`  source post chips  ${sourcePostChips}`)
console.log(`  repeat badges      ${repeatBadges}  (${unsettledExcluded} unsettled attributions excluded)`)
console.log(`→ public/data/entity-public-view.json`)
