// Build the reader-facing glossary: who or what is this, IN THIS DROP?
//
// The owner's original ask: "all the acronyms and initialed names to have an info box if you
// hover over it or press it so the reader knows who he or she is looking at app wide on any
// post." Broadened by owner ruling, 2026-08-26: "hussein is the alias for barrak obama but i do
// want it site wide if we have identified the entity i would like a synopsis of who it is and
// how it pertains to that post if there is any clarity on that front." Every certified alias of
// every certified entity now gets a token — full names ("Hussein", "Barack Obama") included, not
// only shorthand. The mechanism does not change: still post-scoped, still one insertion point
// (applyGlossary), still the same per-post disambiguation for a name with competing readings.
//
// Two populations, one lookup:
//   certified entities   entities.json — alias -> canonical, type, mention count
//   owner glosses        audit/notation-glossary.json — shorthand that is NOT an entity
//
// POST-SCOPED, because that is the whole point. BO is Barack Obama in #36, Bruce Ohr in #1828 and
// the Board Owner in #1296; RT is Rex Tillerson in #947 and "real time" in #220. A corpus-wide
// alias->meaning map would tell the reader the wrong thing on most of those drops — which is the
// same mistake the entity audit spent three passes avoiding, one layer up in the UI.
//
// READ-ONLY: this reads certified artifacts and writes one derived display file. It moves no
// count, and the glossary is never an input to any other stage.
//
//   node scripts/build-glossary.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText, completeTokenRegex } from './lib/renderedMatch.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8')).entities
const glossPath = path.join(ROOT, 'audit', 'notation-glossary.json')
const glosses = fs.existsSync(glossPath) ? JSON.parse(fs.readFileSync(glossPath, 'utf8')).glosses ?? [] : []

// FORMERLY gated to isShorthand(text) — "Hillary Clinton spelled out explains itself" — which
// excluded every full name. Removed by the 2026-08-26 broadening; every certified alias, short
// or long, now becomes a token. See the file header for the ruling.

// Reader-facing category names. A type missing from here falls back to "Named entity", which is
// not wrong but says nothing — the Black Lives Matter correction landed on political_group and the
// info box immediately downgraded from "Person" to "Named entity". Every type the registry
// actually uses is listed, so a correct type never reads as a vaguer one.
const TYPE_LABEL = {
  person: 'Person', people: 'Person', organization: 'Organization', media_organization: 'Media organization',
  government_agency: 'Government body', government_institution: 'Government body', country: 'Country/region',
  country_region: 'Country/region', location: 'Location', title_role: 'Title or role', other: 'Named entity',
  political_group: 'Political group', event_incident: 'Event or incident',
  legislation_regulation: 'Law or regulation', technology_platform: 'Technology platform',
  creative_work: 'Creative work', facility_property: 'Facility or property',
  religious_spiritual: 'Religious or spiritual', legal_investigative: 'Legal or investigative body',
  military_asset_vessel: 'Military asset', financial_institution: 'Financial institution',
  program_operation: 'Program or operation', program_operation_project: 'Program or operation',
  coded_alias: 'Coded alias', other_named_entity: 'Named entity',
}

/** alias -> [{ meaning, kind, type, detail, posts }] — several readings per token is normal. */
const byToken = new Map()
const add = (token, entry) => {
  if (!byToken.has(token)) byToken.set(token, [])
  byToken.get(token).push(entry)
}

// PER-ALIAS post lists, not per-entity.
//
// entity.posts is every post the entity appears in under ANY spelling. Barack Obama claims 147
// posts, but BO is only his in 24 of them; using the entity list would put "BO = Barack Obama" on
// the Bruce Ohr drops, which is precisely the confusion this popover exists to remove.
//
// Where the owner ruled a scope, that scope IS the answer. Everywhere else, intersect: the posts
// where the token literally appears AND the entity is certified present.
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const rulePath = path.join(ROOT, 'audit', 'entities-owner-rulings.json')
const aliasRules = fs.existsSync(rulePath) ? JSON.parse(fs.readFileSync(rulePath, 'utf8')).aliasRulings ?? [] : []
const ruledScope = new Map()
// A ruling may carry a note meant for READERS rather than for the audit trail — "written SS, but
// read as SC, an apparent typo". That belongs in the info box; the reasoning field does not, since
// nothing shows it to anyone browsing the archive.
const readerNotes = new Map()
const notesByPost = new Map()
for (const r of aliasRules) {
  if (!r.includePosts) continue
  ruledScope.set(`${r.canonical}|${r.alias}`, new Set(r.includePosts))
  if (r.readerNote) readerNotes.set(`${r.canonical}|${r.alias}`, r.readerNote)
  // Per-post notes: one office, several officeholders. DAG is the Deputy Attorney General in every
  // drop, but the person meant is Rosenstein in five of them and Sally Yates in a quoted 2016
  // message — a single note for the whole ruling would be wrong on most of its own posts.
  if (r.readerNotesByPost) notesByPost.set(`${r.canonical}|${r.alias}`, r.readerNotesByPost)
}
// THE SHARED MATCHER, not a fifth approximation (owner ruling, 2026-08-17). This used to build a
// \b-anchored regex over RAW post text — a coordinate system the reader never sees, and a boundary
// rule that cannot express "Q+" because "+" is not a word character. Both now come from
// scripts/lib/renderedMatch.mjs, which is the same rule the renderer and every audit use.
const literalPosts = token => {
  const rx = completeTokenRegex(token)
  return posts.filter(p => rx.test(runtimeText(p.text ?? ''))).map(p => p.postNum)
}
const literalCache = new Map()

for (const e of entities) {
  for (const a of e.aliases ?? []) {
    const text = a.text
    if (!text) continue
    const ruled = ruledScope.get(`${e.canonical}|${text}`)
    if (!literalCache.has(text)) literalCache.set(text, literalPosts(text))
    const where = ruled
      ? literalCache.get(text).filter(n => ruled.has(n))
      : literalCache.get(text).filter(n => (e.posts ?? []).includes(n))
    // A spelling with no literal occurrence on any of this entity's own posts resolves nowhere —
    // publishing it would be a token nothing can ever match.
    if (!where.length) continue
    add(text, {
      meaning: e.canonical,
      // The PERMANENT id, so the reader's info box can look up this entity's post-specific
      // synopsis without going through the display name — the one field that changes when an
      // entity is renamed or merged.
      entityId: e.id,
      kind: 'entity',
      type: TYPE_LABEL[e.type] ?? 'Named entity',
      mentions: e.mentions ?? 0,
      scoped: Boolean(ruled),
      detail: readerNotes.get(`${e.canonical}|${text}`) ?? '',
      detailByPost: notesByPost.get(`${e.canonical}|${text}`) ?? undefined,
      posts: where,
    })
  }
}

// ENTITIES WHOSE CANONICAL NAME IS ITSELF AN ACRONYM.
//
// The loop above only glosses aliases that DIFFER from the canonical, which is right for
// DOJ -> Department of Justice but silently excluded 28 entities actually named POTUS, CNN, MI6,
// DARPA, SDNY... — including POTUS, the most-mentioned entity in the archive at 370. The owner
// saw the symptom directly: "i noticed a few didn't have anything."
//
// These need an expansion, since "POTUS means POTUS" helps nobody. Expansions come from
// audit/acronym-definitions.json; an acronym-named entity with no definition is skipped rather
// than shown with its own name echoed back.
const defsPath = path.join(ROOT, 'audit', 'acronym-definitions.json')
const DEFS = fs.existsSync(defsPath) ? JSON.parse(fs.readFileSync(defsPath, 'utf8')).definitions ?? {} : {}
// {0,6} not {1,6}: Q is a one-character entity name and the two-character floor left the most
// self-referential term in the corpus with no hover box at all. Q is the only single-character
// canonical, so this admits exactly one token.
const IS_ACRONYM = /^[A-Z][A-Z0-9]{0,6}$/
let acronymEntities = 0, undefinedAcronyms = []
for (const e of entities) {
  if (!IS_ACRONYM.test(e.canonical)) continue
  if (byToken.has(e.canonical)) continue        // already covered as somebody's alias
  const def = DEFS[e.canonical]
  if (!def) { undefinedAcronyms.push(e.canonical); continue }
  if (!literalCache.has(e.canonical)) literalCache.set(e.canonical, literalPosts(e.canonical))
  add(e.canonical, {
    meaning: def.expansion,
    entityId: e.id,
    kind: 'entity',
    type: TYPE_LABEL[e.type] ?? 'Named entity',
    mentions: e.mentions ?? 0,
    detail: def.detail ?? '',
    posts: literalCache.get(e.canonical).filter(n => (e.posts ?? []).includes(n)),
  })
  acronymEntities++
}

for (const g of glosses) {
  add(g.token, { meaning: g.meaning, kind: g.kind ?? 'notation', detail: g.detail ?? '', posts: g.posts ?? [] })
}

// A token whose only reading covers every post it appears in needs no post list shipped; one with
// competing readings does. Keep the lists — they are small, and dropping them is how a popover
// starts telling a reader that BO is Barack Obama inside a Bruce Ohr drop.
// TWO SPELLINGS OF ONE NAME THAT DIFFER ONLY IN CASE ARE ONE TOKEN.
//
// The reader's matcher is case-insensitive, so of "FREEDOM CAUCUS" and "FREEDOM Caucus" — both
// registered aliases of Freedom Caucus, added together on 2026-08-21 — exactly one can ever match.
// The other is a glossary entry that cannot be reached, and test-multiword-gloss.mjs found it by
// asserting that every token matches itself.
//
// Folded rather than deduplicated arbitrarily: the surviving spelling is the one that covers more
// drops (ties broken alphabetically, so the output is a function of the data and not of iteration
// order), and the post lists are UNIONED, because both spellings really do occur and a reader
// hovering either one is asking the same question. Only case variants of the SAME entity fold —
// two identities sharing a spelling is a registry collision and is left alone, exactly as
// buildEntityForms leaves it.
let caseFolded = 0
{
  const groups = new Map()
  for (const [token, entries] of byToken) {
    const k = `${token.toLowerCase()}|${entries.map(e => e.entityId ?? e.meaning).sort().join(',')}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(token)
  }
  for (const spellings of groups.values()) {
    if (spellings.length < 2) continue
    const postsOf = t => new Set(byToken.get(t).flatMap(e => e.posts ?? []))
    const winner = [...spellings].sort((a, b) => postsOf(b).size - postsOf(a).size || a.localeCompare(b))[0]
    const union = [...new Set(spellings.flatMap(t => [...postsOf(t)]))].sort((a, b) => a - b)
    for (const e of byToken.get(winner)) e.posts = union
    for (const t of spellings) if (t !== winner) { byToken.delete(t); caseFolded++ }
  }
}

const out = { generated: 'scripts/build-glossary.mjs', certifiedDataUnaffected: true, tokens: {} }
for (const [token, entries] of [...byToken].sort((a, b) => a[0].localeCompare(b[0]))) out.tokens[token] = entries

fs.writeFileSync(path.join(DATA, 'glossary.json'), JSON.stringify(out))
const multi = [...byToken.values()].filter(v => v.length > 1).length
console.log('\nGLOSSARY\n')
console.log(`  tokens explained        : ${byToken.size.toLocaleString()}`)
console.log(`  with competing readings : ${multi} (disambiguated per post)`)
console.log(`  case variants folded    : ${caseFolded}`)
console.log(`  owner glosses (non-entity): ${glosses.length}`)
console.log(`  acronym-named entities  : ${acronymEntities} expanded${undefinedAcronyms.length ? `, ${undefinedAcronyms.length} left undefined (${undefinedAcronyms.join(', ')})` : ''}`)
console.log(`\n  wrote public/data/glossary.json`)
