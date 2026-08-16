// Build the reader-facing glossary: what does this acronym mean, IN THIS DROP?
//
// The owner's ask: "all the acronyms and initialed names to have an info box if you hover over it
// or press it so the reader knows who he or she is looking at app wide on any post."
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8')).entities
const glossPath = path.join(ROOT, 'audit', 'notation-glossary.json')
const glosses = fs.existsSync(glossPath) ? JSON.parse(fs.readFileSync(glossPath, 'utf8')).glosses ?? [] : []

// Only shorthand needs explaining. "Hillary Clinton" spelled out explains itself, and glossing
// every ordinary name would put a popover on half the corpus.
// Two-word all-caps names count too: "WASH POST" is one entity, and excluding it would leave
// the name the owner just asked to join with no info box at all.
const isShorthand = t => /^[A-Z0-9][A-Z0-9._+/-]{0,6}$/.test(t) || /^[A-Z]\.[A-Z]\.?$/.test(t) || /^[A-Z][a-z]+ [A-Z]$/.test(t) || /^[A-Z]{2,8} [A-Z][A-Za-z]{1,10}$/.test(t)

const TYPE_LABEL = {
  person: 'Person', people: 'Person', organization: 'Organization', media_organization: 'Media organization',
  government_agency: 'Government body', government_institution: 'Government body', country: 'Country/region',
  location: 'Location', title_role: 'Title or role', other: 'Named entity',
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
const BS = String.fromCharCode(92)
const escRx = s => s.split('').map(c => '.*+?^${}()|[]\\'.includes(c) ? BS + c : c).join('')
const literalPosts = token => {
  const endsWord = /[A-Za-z0-9]$/.test(token)
  const rx = new RegExp(BS + 'b' + escRx(token) + (endsWord ? BS + 'b' : '(?![A-Za-z0-9])'))
  return posts.filter(p => rx.test(p.text ?? '')).map(p => p.postNum)
}
const literalCache = new Map()

for (const e of entities) {
  for (const a of e.aliases ?? []) {
    const text = a.text
    if (!text || text === e.canonical || !isShorthand(text)) continue
    const ruled = ruledScope.get(`${e.canonical}|${text}`)
    if (!literalCache.has(text)) literalCache.set(text, literalPosts(text))
    const where = ruled
      ? literalCache.get(text).filter(n => ruled.has(n))
      : literalCache.get(text).filter(n => (e.posts ?? []).includes(n))
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
const out = { generated: 'scripts/build-glossary.mjs', certifiedDataUnaffected: true, tokens: {} }
for (const [token, entries] of [...byToken].sort((a, b) => a[0].localeCompare(b[0]))) out.tokens[token] = entries

fs.writeFileSync(path.join(DATA, 'glossary.json'), JSON.stringify(out))
const multi = [...byToken.values()].filter(v => v.length > 1).length
console.log('\nGLOSSARY\n')
console.log(`  tokens explained        : ${byToken.size.toLocaleString()}`)
console.log(`  with competing readings : ${multi} (disambiguated per post)`)
console.log(`  owner glosses (non-entity): ${glosses.length}`)
console.log(`  acronym-named entities  : ${acronymEntities} expanded${undefinedAcronyms.length ? `, ${undefinedAcronyms.length} left undefined (${undefinedAcronyms.join(', ')})` : ''}`)
console.log(`\n  wrote public/data/glossary.json`)
