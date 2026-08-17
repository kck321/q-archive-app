// DRY RUN. What would actually happen if the URL policy were applied.
//
//   node scripts/analyse-url-derived-cleanup.mjs
//
// Writes a proposal and changes nothing. No certified artifact is touched, no count moves, and
// the script has no --apply.
//
// THE ARITHMETIC TRAP THIS EXISTS TO AVOID. There are 441 quarantined hover records, and it is
// tempting to read that as 441 certified mentions. It is not. A hover record is one per
// (entity, post) pair; a certified mention is one per OCCURRENCE. #2401 carries three occurrences
// of WASH POST behind a single hover record, and an entity can appear in a post both inside a URL
// and in Q's prose — where only the URL half may be withdrawn. Every figure below is computed
// per occurrence, from posts.json, and reconciled against the hover records rather than assumed
// from them.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aliasLocation, urlSpans, classifyUrlDerived, URL_CLASS_MEANING } from './lib/hoverValidation.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const read = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))

const entities = read(DATA, 'entities.json')
const posts = read(DATA, 'posts.json')
const hovers = read(DATA, 'entity-hovers.json')
const quarantine = read(OUT, 'entity-hover-url-quarantine.json')
const byId = new Map(entities.entities.map(e => [e.id, e]))
const postByNum = new Map(posts.map(p => [p.postNum, p]))

console.log('\nURL-DERIVED CLEANUP — DRY RUN\n')
console.log(`  quarantined hover records : ${quarantine.total}`)

// ── per (entity, post): how many certified occurrences, and how many are URL-only ──
//
// postAnalysis.namedEntities is a list of alias STRINGS with no coordinates, so an individual
// entry cannot be pointed at a character offset. What can be established is stronger than it
// sounds: for each alias, whether it appears in the prose at all. An alias with zero prose
// occurrences contributes only URL matches, so every certified entry carrying that alias in that
// post is URL-derived. An alias that appears in both is NOT decided here — it goes to review,
// because withdrawing the wrong one would delete a legitimate mention of Q's own words.
const rows = []
for (const rec of quarantine.records) {
  const e = byId.get(rec.entityId)
  const post = postByNum.get(rec.postNum)
  if (!e || !post) { rows.push({ ...rec, error: 'entity or post missing' }); continue }
  const text = String(post.text ?? '')
  const named = post.postAnalysis?.namedEntities ?? []
  // CASE-INSENSITIVE DEDUPLICATION. A Stage 1 merge folds absorbed spellings in as aliases, so an
  // entity can carry both "WikiLeaks" and "Wikileaks". They match the SAME certified entries, and
  // counting each of them separately inflated the occurrence total — the applier caught it by
  // trying to remove an entry that a previous alias had already taken.
  const aliasTexts = []
  const seenLower = new Set()
  for (const t of [...e.aliases.map(a => a.text), e.canonical]) {
    const k = t.toLowerCase()
    if (seenLower.has(k)) continue
    seenLower.add(k)
    aliasTexts.push(t)
  }

  // Every certified entry in this post that belongs to this entity.
  const entriesForEntity = named.filter(t => aliasTexts.some(a => a.toLowerCase() === t.toLowerCase()))

  // Per alias: does it appear in prose, in a URL, or both?
  const perAlias = []
  for (const a of aliasTexts) {
    const n = named.filter(t => t.toLowerCase() === a.toLowerCase()).length
    if (!n) continue
    const loc = aliasLocation(text, a)
    perAlias.push({ alias: a, certifiedEntries: n, inProse: loc.inProse, inUrl: loc.inUrl, urlParts: loc.urlParts })
  }

  const urlOnly = perAlias.filter(a => !a.inProse && a.inUrl)
  const proseBacked = perAlias.filter(a => a.inProse)
  const bothSides = perAlias.filter(a => a.inProse && a.inUrl)

  const occurrencesToRemove = urlOnly.reduce((n, a) => n + a.certifiedEntries, 0)
  const occurrencesKept = entriesForEntity.length - occurrencesToRemove

  // The URLs that carry the match, and which part of each.
  const carriers = []
  for (const [, , url] of urlSpans(text)) {
    for (const a of urlOnly) {
      const loc = aliasLocation(url, a.alias)
      if (loc.inUrl) carriers.push({ url, alias: a.alias, parts: loc.urlParts })
    }
  }
  const parts = [...new Set(urlOnly.flatMap(a => a.urlParts))]
  const cls = bothSides.length ? 'ambiguous_url_reference'
    : parts.length > 1 ? 'ambiguous_url_reference'
      : parts[0] === 'hostname' ? 'hostname_source_reference'
        : parts[0] === 'path' ? 'url_path_fragment'
          : parts[0] === 'query' ? 'url_query_fragment'
            : 'ambiguous_url_reference'

  // What the action does to the RELATIONSHIP, not just the count. If the entity still has a
  // prose mention in this drop, the entity-post edge survives and only the count falls.
  const relationship = occurrencesKept > 0 ? 'kept — the entity still appears in this drop\'s prose'
    : 'removed — this drop\'s only mentions of the entity were inside URLs'

  const action = cls === 'ambiguous_url_reference' ? 'review'
    : cls === 'hostname_source_reference' ? 'migrate-to-linked-source'
      : 'remove-annotation'

  rows.push({
    postNum: rec.postNum,
    entityId: rec.entityId,
    canonical: e.canonical,
    entityType: e.type,
    matchedAlias: rec.matchedAlias,
    urls: [...new Set(carriers.map(c => c.url))],
    matchPart: parts.join('+') || 'none',
    certifiedOccurrencesInPost: entriesForEntity.length,
    occurrencesToRemove,
    occurrencesKept,
    alsoInProse: proseBacked.length > 0,
    proseAliases: proseBacked.map(a => a.alias),
    relationshipEffect: relationship,
    classification: cls,
    action,
    justification: cls === 'url_path_fragment' ? 'A path slug is generated by the publisher\'s CMS, not written by Q.'
      : cls === 'url_query_fragment' ? 'A query term records what Q searched for, not what he wrote.'
        : cls === 'hostname_source_reference' ? 'The domain identifies the publisher of the linked material — real information, wrong layer.'
          : bothSides.length ? 'The alias appears BOTH in prose and in a URL in this drop; withdrawing the wrong occurrence would delete Q\'s own words.'
            : 'The match spans more than one part of the URL.',
    perAlias,
  })
}

const by = k => rows.reduce((a, r) => (a[r[k]] = (a[r[k]] ?? 0) + 1, a), {})
console.log(`  by classification         : ${JSON.stringify(by('classification'))}`)
console.log(`  by action                 : ${JSON.stringify(by('action'))}`)

// ── occurrence arithmetic ───────────────────────────────────────────────────
const removable = rows.filter(r => r.action !== 'review')
const totalOccurrencesRemoved = removable.reduce((n, r) => n + r.occurrencesToRemove, 0)
const byAction = {}
for (const r of removable) byAction[r.action] = (byAction[r.action] ?? 0) + r.occurrencesToRemove
console.log(`\n  certified occurrences that would be withdrawn : ${totalOccurrencesRemoved}`)
console.log(`    ${JSON.stringify(byAction)}`)
console.log(`  hover records involved                        : ${removable.length}`)
console.log(`  (hover records != occurrences — ${removable.length} records carry ${totalOccurrencesRemoved} occurrences)`)

// ── entity lifecycle ────────────────────────────────────────────────────────
const lossByEntity = new Map()
for (const r of removable) {
  if (!lossByEntity.has(r.entityId)) lossByEntity.set(r.entityId, { removed: 0, posts: new Set(), migrated: 0 })
  const l = lossByEntity.get(r.entityId)
  l.removed += r.occurrencesToRemove
  l.posts.add(r.postNum)
  if (r.action === 'migrate-to-linked-source') l.migrated += r.occurrencesToRemove
}
const lifecycle = []
for (const [id, l] of lossByEntity) {
  const e = byId.get(id)
  const after = e.mentions - l.removed
  lifecycle.push({
    entityId: id, canonical: e.canonical, type: e.type,
    mentionsBefore: e.mentions, mentionsAfter: after,
    postsBefore: e.posts.length, postsLosingTheEntity: [...l.posts].filter(pn => {
      const row = rows.find(r => r.entityId === id && r.postNum === pn)
      return row && row.occurrencesKept === 0
    }).length,
    losesAllMentions: after === 0,
    retainsLinkedSourceOnly: after === 0 && l.migrated > 0,
    hasPublicHover: Boolean(hovers.byPost[id] && Object.keys(hovers.byPost[id]).length),
    hoversLost: Object.keys(hovers.byPost[id] ?? {}).filter(pn => rows.some(r => r.entityId === id && String(r.postNum) === pn && r.action !== 'review')).length,
  })
}
lifecycle.sort((a, b) => b.mentionsBefore - b.mentionsAfter - (a.mentionsBefore - a.mentionsAfter))
const zeroed = lifecycle.filter(l => l.losesAllMentions)
console.log(`\n  entities affected                : ${lifecycle.length}`)
console.log(`  entities losing ALL mentions     : ${zeroed.length}`)
console.log(`    of those, retaining a source ref: ${zeroed.filter(l => l.retainsLinkedSourceOnly).length}`)

// ── linked-source records ───────────────────────────────────────────────────
// A hostname is only bound to an entity when the domain plainly belongs to it. Where the brand
// and the domain disagree, or the platform merely HOSTS the material, the record is written
// without an entityId rather than asserting a relationship the URL does not establish.
const normaliseHost = u => {
  // urlSpans also matches scheme-less "www.reddit.com/..." links, and `new URL` throws on those —
  // which silently dropped 83 of 102 linked-source records on the first run. A missing scheme is
  // a spelling difference, not a different link.
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`
  try { return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}
const PLATFORMS = /^(twitter\.com|x\.com|youtube\.com|youtu\.be|t\.co|archive\.org|web\.archive\.org|docs\.google\.com|drive\.google\.com|pastebin\.com|imgur\.com|scribd\.com|documentcloud\.org|assets\.documentcloud\.org)$/
const linkedSources = []
for (const r of rows.filter(x => x.action === 'migrate-to-linked-source')) {
  for (const url of r.urls) {
    const host = normaliseHost(url)
    if (!host) continue
    const brandInHost = host.replace(/[^a-z0-9]/g, '').includes(String(r.canonical).toLowerCase().replace(/[^a-z0-9]/g, ''))
    const platform = PLATFORMS.test(host)
    linkedSources.push({
      postNum: r.postNum,
      url,
      hostname: host,
      displayName: r.canonical,
      // Bound only when the domain plainly belongs to the entity and is not a general platform.
      entityId: brandInHost && !platform ? r.entityId : null,
      confidence: brandInHost && !platform ? 'high' : platform ? 'platform-host — the domain hosts the material, it does not identify the publisher' : 'low — the brand name does not appear in the domain',
      reason: 'hostname_source_reference migrated out of prose entity annotation under the 2026-08-16 URL policy',
      originalOccurrence: r.matchedAlias,
      migratedFrom: { layer: 'postAnalysis.namedEntities', entityId: r.entityId, canonical: r.canonical, on: '2026-08-16', policy: 'audit/url-derived-entity-policy.json' },
    })
  }
}
const bound = linkedSources.filter(l => l.entityId).length
console.log(`\n  linked-source records            : ${linkedSources.length} (${bound} bound to an entity, ${linkedSources.length - bound} left unbound)`)

// ── reconciliation ──────────────────────────────────────────────────────────
const outcomes = { 'remove-annotation': 0, 'migrate-to-linked-source': 0, review: 0 }
for (const r of rows) outcomes[r.action]++
const sum = Object.values(outcomes).reduce((a, b) => a + b, 0)
console.log(`\n  RECONCILIATION`)
console.log(`    ${JSON.stringify(outcomes)}  = ${sum} of ${quarantine.total} quarantined records`)
const before = entities.totals.mentions
console.log(`    certified mentions ${before} -> ${before - totalOccurrencesRemoved}`)
console.log(`    entity rows ${entities.entities.length} -> ${entities.entities.length - zeroed.filter(l => !l.retainsLinkedSourceOnly).length} (if fully-zeroed rows are retired)`)

fs.writeFileSync(path.join(OUT, 'url-cleanup-proposal.json'), JSON.stringify({
  note: 'DRY RUN. What applying the 2026-08-16 URL policy would do. Nothing here has been applied; no certified artifact was modified and no count has moved.',
  generatedOn: '2026-08-16',
  policy: 'audit/url-derived-entity-policy.json',
  classMeanings: URL_CLASS_MEANING,
  reconciliation: {
    quarantinedRecords: quarantine.total,
    byAction: outcomes,
    everyRecordLandsSomewhere: sum === quarantine.total,
    certifiedOccurrencesWithdrawn: totalOccurrencesRemoved,
    occurrencesByAction: byAction,
    mentionsBefore: before,
    mentionsAfter: before - totalOccurrencesRemoved,
    entityRowsBefore: entities.entities.length,
    entitiesLosingAllMentions: zeroed.length,
  },
  lifecycle,
  linkedSources,
  rows,
}, null, 1))
console.log(`\n  wrote audit/url-cleanup-proposal.json`)
console.log(`\n  DRY RUN — nothing applied.\n`)
