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
import { randomBytes } from 'node:crypto'
import { clean } from './lib/segment.mjs'
// Identity resolution for the owner's queue entity rulings - see the module for the ladder.
import { makeEntityResolver } from './lib/queueEntityResolve.mjs'
import { loadQueueRulings } from './lib/queueRulings.mjs'

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
// ── Owner ALIAS WITHDRAWALS ─────────────────────────────────────────────────
// A certified alias the owner rules a false positive. Lowercase "sessions" was an alias of Jeff
// Sessions and matched "friendly therapy sessions" (#2319) and a dozen news URLs — the man is
// always "Sessions" or "SESSIONS" when Q names him. Filtered HERE, before the mentions are
// counted, so the count and the emitted occurrences drop together instead of disagreeing.
//
// POST-SCOPED WITHDRAWAL, added 2026-08-25 for a different shape of the same defect. Every
// withdrawal above removes an alias CORPUS-WIDE because the alias itself is always wrong
// ("sessions" never means the man). #3778/#4935's problem is the opposite: "Nancy Pelosi" IS
// Nancy Pelosi everywhere, including #2036 where it is the only span on the line — but on #3778
// it is a SECOND, redundant span duplicating the fuller "Nancy Pelosi (D-CA) – Speaker of the
// House" alias the owner's title-conjoining ruling already extends. Withdrawing it corpus-wide
// would silently un-highlight #2036 too. An optional `onlyPosts` on the withdrawal entry scopes
// it to the exact drop(s) named; omitting it keeps every existing entry's corpus-wide behaviour
// unchanged. Consumed here for core-registry mentions and again below for the adjudicated tail
// (Andrew Cuomo, Jerry Nadler), because a duplicate-span identity can live in either population.
const aliasWithdrawalRulings = fs.existsSync(path.join(OUT, 'entities-owner-rulings.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'entities-owner-rulings.json'), 'utf8')).aliasWithdrawals ?? []
  : []
const withdrawnAliases = new Set(aliasWithdrawalRulings.filter(w => !w.onlyPosts).map(w => `${w.canonical}|${w.alias}`))
const withdrawnAliasesScoped = new Map()
for (const w of aliasWithdrawalRulings) {
  if (!w.onlyPosts) continue
  const key = `${w.canonical}|${w.alias}`
  if (!withdrawnAliasesScoped.has(key)) withdrawnAliasesScoped.set(key, new Set())
  for (const pn of w.onlyPosts) withdrawnAliasesScoped.get(key).add(pn)
}
const isWithdrawn = (canonical, alias, postNum) => {
  if (withdrawnAliases.has(`${canonical}|${alias}`)) return true
  const scoped = withdrawnAliasesScoped.get(`${canonical}|${alias}`)
  return scoped ? scoped.has(postNum) : false
}
const coreMentions = audit.mentions
  .filter(m => !isWithdrawn(m.canonicalEntity, m.sourceText, m.postNum))
  .filter(m => m.inQAuthoredText && m.canonicalEntity)
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

// ── tail occurrence provenance ──────────────────────────────────────────────
//
// The certified tail mentions were adopted from the historical postAnalysis.namedEntities
// entries — every CANONICAL decision's storedOccurrences matches its legacy count exactly. Those
// entries are therefore the occurrence records BEHIND the certified count, and transcribing them
// is not a re-extraction: the adjudication already decided which strings survived, how aliases
// merged, and what type each carries. Legacy data is used as provenance for occurrences the
// review approved, never as a classifier.
//
//   legacy occurrence -> adjudication decision -> canonical/alias merge -> certified occurrence
//
// Persisted to audit/ because this step rewrites postAnalysis.namedEntities at the end; on the
// next run the legacy strings are gone, so the artifact is the durable source.
const TAIL_OCC = path.join(OUT, 'entities-tail-occurrences.json')
const survivingTail = new Map()
for (const e of merged.values()) for (const a of e.aliases) survivingTail.set(a, e.canonical)

let tailOccurrences
if (fs.existsSync(TAIL_OCC)) {
  tailOccurrences = JSON.parse(fs.readFileSync(TAIL_OCC, 'utf8')).occurrences
} else {
  const src = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
  tailOccurrences = []
  for (const post of src) {
    const list = post.postAnalysis?.namedEntities ?? []
    list.forEach((text, i) => {
      const canonical = survivingTail.get(text)
      if (!canonical) return
      tailOccurrences.push({
        canonical, sourceText: text, postNum: post.postNum, postId: post.id,
        occurrenceIndex: i,
        id: `ent-tail-${post.postNum}-${i}`,
        population: 'adjudicated_tail',
      })
    })
  }
  if (!dry) fs.writeFileSync(TAIL_OCC, JSON.stringify({
    note: 'Occurrence provenance for the certified adjudicated-tail mentions, transcribed from the historical postAnalysis.namedEntities entries the tail counts were adopted from. Not a re-extraction: only strings the adjudication kept as CANONICAL appear here.',
    total: tailOccurrences.length,
    occurrences: tailOccurrences,
  }, null, 1))
}
// Same post-scoped withdrawal as the core registry above (isWithdrawn), applied here because a
// duplicate-span identity can be a TAIL row: Andrew Cuomo and Jerry Nadler on #3778/#4935 are
// both "adjudicated tail", not core registry.
//
// THE COUNT MUST FALL WITH THE OCCURRENCE, same rule as every withdrawal in this file. A tail
// row's `mentions` comes from `merged` (built at the top of the file from tailFinal), entirely
// separate from tailOccurrences — filtering the render list alone would leave Cuomo/Nadler's
// mentions count one higher than what actually renders, the exact count-vs-paint disagreement
// this file's comments warn against everywhere else. Decremented on `merged` directly, before the
// `entities` array reads `e.occurrences` from it.
const withdrawnTailPosts = new Map()   // canonical -> Set<postNum> the withdrawal fired on
{
  const withdrawnTailCount = new Map()
  for (const o of tailOccurrences) {
    if (!isWithdrawn(o.canonical, o.sourceText, o.postNum)) continue
    withdrawnTailCount.set(o.canonical, (withdrawnTailCount.get(o.canonical) ?? 0) + 1)
    if (!withdrawnTailPosts.has(o.canonical)) withdrawnTailPosts.set(o.canonical, new Set())
    withdrawnTailPosts.get(o.canonical).add(o.postNum)
  }
  for (const [canonical, n] of withdrawnTailCount) {
    const row = merged.get(canonical)
    if (!row) { console.error(`tail withdrawal: canonical "${canonical}" not found in merged tail rows`); process.exit(1) }
    row.occurrences -= n
  }
}
tailOccurrences = tailOccurrences.filter(o => !isWithdrawn(o.canonical, o.sourceText, o.postNum))

const tailPostsByCanonical = new Map()
for (const o of tailOccurrences) {
  if (!tailPostsByCanonical.has(o.canonical)) tailPostsByCanonical.set(o.canonical, new Set())
  tailPostsByCanonical.get(o.canonical).add(o.postNum)
}
// A WITHDRAWN OCCURRENCE'S POST STAYS ON THE RECORD IF AN EXTENSION KEEPS THE IDENTITY THERE.
// Cuomo's only tail-occurrence record was the bare "Andrew Cuomo" on #4935 — the ONLY thing that
// had been putting #4935 in his posts list — and withdrawing it left him with mentions but no
// post, which the QA gate below correctly refuses. The drop still names him; it is rendered now
// through the OWNER EXTENSION below ("Gov. Andrew Cuomo, D-N.Y"), a mechanism this array is built
// before running. So the withdrawn post is added back for exactly the canonicals it was withdrawn
// from — the identity's presence on the drop is unchanged, only which words are boxed moved.
for (const [canonical, postSet] of withdrawnTailPosts) {
  if (!tailPostsByCanonical.has(canonical)) tailPostsByCanonical.set(canonical, new Set())
  for (const pn of postSet) tailPostsByCanonical.get(canonical).add(pn)
}

// AN ALIAS THE OWNER ADDS, SYMMETRIC WITH aliasWithdrawals.
//
// A withdrawal removes a spelling the detector found and the owner rejected. An ADDITION registers
// a spelling the detector never recorded but Q demonstrably wrote — "GOD" in capitals, on 35 drops
// that already carry the God identity. It is a LOCATION aid only: an alias never adds a mention,
// because a mention is a record a section already made. Applied after the certified set is built,
// for the same reason the withdrawals are applied before it — so the count and the emitted aliases
// cannot disagree.
const aliasAdditions = fs.existsSync(path.join(OUT, 'entities-owner-rulings.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'entities-owner-rulings.json'), 'utf8')).aliasAdditions ?? []
  : []

const entities = [
  ...[...coreEntities.values()].map(e => ({
    canonical: e.canonical, type: e.type, mentions: e.mentions, posts: [...e.posts].sort((a, b) => a - b),
    aliases: [...e.aliases].sort((a, b) => b[1] - a[1]).map(([text, n]) => ({ text, n })),
    source: 'core registry',
  })),
  ...[...merged.values()].map(e => ({
    canonical: e.canonical, type: e.type, mentions: e.occurrences,
    posts: [...(tailPostsByCanonical.get(e.canonical) ?? [])].sort((a, b) => a - b),
    aliases: e.aliases.map(text => ({ text, n: null })),
    source: 'adjudicated tail',
  })),
]

// ── Owner rulings ────────────────────────────────────────────────────────────
// Merged AFTER the certified set is assembled, from a file no derive step writes. The entity
// pipeline is the one that already proved it re-derives itself: audit-entities.mjs reads
// postAnalysis.namedEntities, which this script writes, so re-running the audit on a built
// bundle produced 1,333 entities against the certified 1,339. A ruling stored anywhere inside
// that loop would not survive. See audit/entities-owner-rulings.json.
const ORULES = path.join(OUT, 'entities-owner-rulings.json')
const allPostsForAlias = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const ownerEntities = fs.existsSync(ORULES) ? JSON.parse(fs.readFileSync(ORULES, 'utf8')).rulings ?? [] : []
let ownerAdded = 0, ownerMentions = 0
for (const r of ownerEntities) {
  // A SPAN EXTENSION IS NOT A NEW MENTION. #3383's list is certified as "Waters", "Pelosi",
  // "Biden" — the initial in front of each was cut off — and the owner ruled the initial part of
  // the name. Adding a second entry beside the first would paint a box inside a box and count one
  // person twice on one line, so these rulings only lengthen the span the drop already carries.
  // Applied where byPost is built; see replacesAliasOnPost there.
  if (r.replacesAliasOnPost) continue
  const existing = entities.find(e => e.canonical === r.canonical)
  if (existing) {
    // A SECOND OCCURRENCE ON A DROP THE IDENTITY ALREADY APPEARS ON IS STILL AN OCCURRENCE.
    // #1319 certifies "Bob Goodlatte - Republican" in the list and names him again by surname on
    // line 59. Skipping on post membership alone would paint that second span while the count
    // stayed put, and the materialised-vs-certified equality below would refuse the write.
    if (existing.posts.includes(r.postNum) && !r.additionalOccurrence) continue
    if (r.additionalOccurrence) { existing.mentions += 1; ownerMentions++; continue }
    existing.posts.push(r.postNum); existing.posts.sort((a, b) => a - b)
    existing.mentions += 1
    ownerMentions++
    continue
  }
  entities.push({
    canonical: r.canonical,
    type: r.type,
    mentions: 1,
    posts: [r.postNum],
    // The alias Q actually wrote, never the canonical name — the renderer matches on this.
    aliases: [{ text: r.aliasUsed, n: 1 }],
    source: 'owner ruling',
    provenance: `owner ruling ${r.ruledOn} — ${r.reasoning}`,
  })
  ownerAdded++; ownerMentions++
}

// AN ALIAS ADDITION MAY NAME AN ENTITY AN OWNER RULING JUST CREATED.
//
// This loop used to run BEFORE the rulings above, which meant an addition could only ever attach
// to a canonical the derive step had already produced. The 2026-08-24 NAT SEC ruling is the first
// that creates an entity AND registers extra spellings for it in one go - Q writes it four ways,
// and alias matching is exact - so the addition named a canonical that did not exist yet and the
// step refused. Running it here instead lets an addition see everything the rulings built.
//
// Nothing already certified moves: all 84 existing additions name canonicals the derive step
// produces, and those are in `entities` at both points.
for (const a of aliasAdditions) {
  const target = entities.find(e => e.canonical === a.canonical)
  if (!target) { console.error(`alias addition names an unknown canonical: ${a.canonical}`); process.exit(1) }
  if (target.aliases.some(x => x.text === a.alias)) continue
  target.aliases.push({ text: a.alias, n: null, ownerAdded: true })
}
// ── Owner TYPE rulings ───────────────────────────────────────────────────────
// A type the owner corrects directly, kept here rather than in the Stage 1 rulings because that
// file is regenerated from the audit package — a correction written there would be erased the next
// time the extractor ran. This is the same reasoning that put every other owner ruling in this
// file: it is the one place no derive step writes.
//
// A type says what the row IS, never how often it appears, so this moves no mention and no row.
const typeRulings = fs.existsSync(ORULES) ? JSON.parse(fs.readFileSync(ORULES, 'utf8')).typeRulings ?? [] : []
let ownerTyped = 0
for (const r of typeRulings) {
  const row = entities.find(e => e.canonical === r.canonical)
  if (!row) { console.error(`type ruling: "${r.canonical}" not found`); process.exit(1) }
  if (row.type === r.to) continue
  row.type = r.to
  row.provenance = `${row.provenance ? `${row.provenance} · ` : ''}owner type ruling ${r.ruledOn} — ${r.from} -> ${r.to}: ${r.reasoning}`
  ownerTyped++
}
if (typeRulings.length) console.log(`  owner type rulings    : ${ownerTyped} applied of ${typeRulings.length}`)

// ── Owner MERGE rulings ──────────────────────────────────────────────────────
// Two certified rows, one person. The detector saw "Rachel Chandler" and "Ray Chandler" spelled
// differently in different drops and certified each as its own entity, so the archive held her
// under two names and neither row carried the other's posts.
//
// The absorbed entity's mentions, posts and alias spellings move ACROSS rather than being
// re-scanned from the corpus: its 4 certified mentions include "Ray.Chandler" (#1054, #1138),
// which a /\bRay Chandler\b/ rescan does not match — the period is not a space. Re-deriving
// would have quietly dropped two mentions and both posts. Section totals are unchanged by a
// merge; only the entity COUNT falls, by one per absorbed row.
const mergeRulings = fs.existsSync(ORULES) ? JSON.parse(fs.readFileSync(ORULES, 'utf8')).mergeRulings ?? [] : []
let ownerMerged = 0
for (const r of mergeRulings) {
  const target = entities.find(e => e.canonical === r.canonical)
  const idx = entities.findIndex(e => e.canonical === r.absorb)
  if (!target) { console.error(`merge ruling: canonical "${r.canonical}" not found`); process.exit(1) }
  if (idx === -1) continue                                   // already merged on a previous run
  const [absorbed] = entities.splice(idx, 1)
  target.mentions += absorbed.mentions
  target.posts = [...new Set([...target.posts, ...absorbed.posts])].sort((a, b) => a - b)
  for (const a of absorbed.aliases) if (!target.aliases.some(x => x.text === a.text)) target.aliases.push(a)
  target.provenance = `${target.provenance ? `${target.provenance} · ` : ''}owner merge ${r.ruledOn} — absorbed "${r.absorb}": ${r.reasoning}`
  ownerMerged++
}

// ── Owner ALIAS rulings ──────────────────────────────────────────────────────
// An alias the detector never had. COVID-19 was certified with "COVID-19" as its only alias, so
// Q's shorthand C19 — 34 occurrences across 11 posts — resolved to nothing at all.
const aliasRulings = fs.existsSync(ORULES) ? JSON.parse(fs.readFileSync(ORULES, 'utf8')).aliasRulings ?? [] : []
let aliasMentions = 0
const aliasByPost = []
// Render entries indexed by canonical+alias so a later recount can retract exactly what the
// earlier ruling emitted, and nothing else.
const aliasEmit = new Map()
for (const r of aliasRulings) {
  let target = entities.find(e => e.canonical === r.canonical)
  if (!target && r.createIfMissing) {
    // The canonical may not exist at all: nothing in the corpus spells out "Chinese Communist
    // Party", only CCP, so no pass ever created it. The ruling supplies the identity and the
    // alias supplies every occurrence.
    target = { canonical: r.canonical, type: r.type, mentions: 0, posts: [], aliases: [],
               source: 'owner ruling', provenance: `owner ruling ${r.ruledOn} — ${r.reasoning}` }
    entities.push(target)
    ownerAdded++
  }
  if (!target) { console.error(`alias ruling: canonical "${r.canonical}" not found`); process.exit(1) }
  const existingAlias = target.aliases.find(a => a.text === r.alias)
  // `recount` exists because an alias can be created by a single-post entity ruling (n=1) and
  // LATER ruled to cover the whole corpus. Without it the alias is simply skipped as "already
  // present" and 118 of its 119 occurrences stay uncounted.
  if (existingAlias && !r.recount) continue
  // `notFollowedBy` exists because a shorter alias can sit inside a longer certified one: the
  // hyphen in "COVID-19" is a word boundary, so a bare /\bCOVID\b/ matches all 60 COVID-19
  // occurrences too and would have double-counted every one of them into the same entity. This is
  // invariant 4 (word-boundary matching) one layer down — the boundary is right and the match is
  // still wrong, because the token is part of a longer name.
  // Boundaries as LOOKAROUNDS, not . An alias ending in punctuation — "U.S." — can never
  // satisfy a trailing , which needs a word character beside it: the ruling matched 2 of 72
  // occurrences and looked like the corpus did not contain them. Same defect as the "Q+"
  // assertion earlier. For aliases ending in a letter or digit the two are equivalent.
  // A trailing \\b cannot match after punctuation: "U.S." found 2 of its 72 occurrences and
  // looked like the corpus lacked them. Aliases ending in a word character keep \\b exactly as
  // certified; only the punctuation-ending ones switch to a lookahead.
  const endsWord = /[A-Za-z0-9]$/.test(r.alias)
  const rx = new RegExp(
    `\\b${r.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${endsWord ? '\\b' : '(?![A-Za-z0-9])'}${r.notFollowedBy ? `(?!${r.notFollowedBy})` : ''}`, 'g')
  // `excludePosts` is the same idea as `notFollowedBy` at the level of MEANING rather than
  // spelling: the token is the right token and still names something else in that drop. RC is
  // Rachel Chandler across the 2019 Epstein drops, but #2 asks "Why would he place all his funds
  // in a RC?" — an indefinite article in front of a thing you put money in, seventeen months
  // before Q first wrote her name. Sweeping it in would put a person inside a sentence about
  // Soros's money.
  const excluded = new Set(r.excludePosts ?? [])
  // includePosts is the mirror of excludePosts: a WHITELIST. SC means the Supreme Court in the
  // drops the owner reviewed and a person's initials elsewhere, so that ruling is scoped to the
  // named posts instead of applied corpus-wide. Same occurrence-identity rule, other direction.
  const included = r.includePosts ? new Set(r.includePosts) : null
  // OCCURRENCE-LEVEL SCOPING. includePosts is post-level, and one drop can use the same token for
  // two different people: #1828 writes JB five times — four are John Brennan, and the one inside
  // the FBI personnel list "[FBI [JC][AM][JR][MS][BP][PS][LP][JB][MK]...]" is James Baker. Two
  // post-level rulings would both claim the post and count all five twice.
  //
  // `includeOccurrences` maps a post number to the character offsets that belong to THIS ruling.
  // Offsets come straight from the queue row ids the owner ruled on, so the ruling is anchored to
  // the exact occurrence rather than to a re-derived guess about which match is which.
  //
  // Addressed as [lineIndex, charIndex] — the SAME coordinates the Resolution Center row id uses
  // ("JB-1828-7-34" is line 7, character 34). A first attempt matched whole-text offsets and found
  // 0 of 4, because the queue has always numbered characters within the line.
  const occScope = r.includeOccurrences
    ? new Map(Object.entries(r.includeOccurrences).map(([p, pairs]) => [Number(p), new Set(pairs.map(([l, c]) => `${l}|${c}`))]))
    : null
  let n = 0
  // Render entries for THIS ruling, held aside so a recount can replace them the same way it
  // replaces the count.
  const emit = []
  for (const p of allPostsForAlias) {
    if (excluded.has(p.postNum)) continue
    if (included && !included.has(p.postNum)) continue
    if (occScope && occScope.has(p.postNum)) {
      const want = occScope.get(p.postNum)
      let k = 0
      clean(p.text ?? '').split(String.fromCharCode(10)).forEach((line, li) => {
        rx.lastIndex = 0
        let m
        while ((m = rx.exec(line)) !== null) {
          if (!want.has(`${li}|${m.index}`)) continue
          n++; k++
          emit.push([p.postNum, r.alias])
        }
      })
      if (k && !target.posts.includes(p.postNum)) target.posts.push(p.postNum)
      if (k !== want.size) {
        console.error(`alias ruling ${r.alias} -> ${r.canonical}: #${p.postNum} named ${want.size} occurrence(s), matched ${k}`)
        process.exit(1)
      }
      continue
    }
    const hits = (p.text ?? '').match(rx)
    if (!hits) continue
    n += hits.length
    if (!target.posts.includes(p.postNum)) target.posts.push(p.postNum)
    for (let k = 0; k < hits.length; k++) emit.push([p.postNum, r.alias])
  }
  // A RECOUNT REPLACES THE RENDER ENTRIES, NOT JUST THE COUNT.
  //
  // `target.mentions += n - existingAlias.n` moves only the DELTA, because the recount supersedes
  // whatever the earlier ruling counted. The render entries have to be superseded in step. They
  // were not: the earlier ruling's rows stayed in aliasByPost while the total moved by the delta
  // alone, so postAnalysis carried 9,775 entries against 9,713 certified mentions. The 62 were
  // BO -> Barack Obama and PS -> Peter Strzok, the only two alias+canonical pairs ruled in both an
  // earlier batch and the 679-row reference audit. Keyed by canonical AND alias: SC is Special
  // Counsel on one entity and Sara Carter on another, and those must not clear each other.
  const emitKey = `${target.canonical}\u0000${r.alias}`
  if (existingAlias) {
    const prev = aliasEmit.get(emitKey)
    if (prev) for (const e of prev) { const i = aliasByPost.indexOf(e); if (i >= 0) aliasByPost.splice(i, 1) }
    target.mentions += n - (existingAlias.n ?? 0)
    existingAlias.n = n
  } else {
    target.aliases.push({ text: r.alias, n })
    target.mentions += n
  }
  aliasEmit.set(emitKey, emit)
  for (const e of emit) aliasByPost.push(e)
  target.posts.sort((a, b) => a - b)
  aliasMentions += n
}

// ── Owner MERGES ────────────────────────────────────────────────────────────
// Two canonical rows claiming the same token would double-count every occurrence of it. The tail
// adjudication created "Patriot" (person, 2 mentions) while the owner has now ruled Patriot and
// Patriots to be one entity, so the rows are merged rather than left to compete.
const merges = fs.existsSync(ORULES) ? JSON.parse(fs.readFileSync(ORULES, 'utf8')).merges ?? [] : []
const mergedAliasTexts = new Map()
const supersededFrom = new Set()
const from_aliases = m => mergedAliasTexts.get(m.from) ?? []
let mergedRows = 0
for (const m of merges) {
  const from = entities.find(e => e.canonical === m.from)
  const into = entities.find(e => e.canonical === m.into)
  if (!from || !into) continue
  // Mentions move ONLY for aliases the target does not already count. "Patriot" was recounted
  // corpus-wide (82 occurrences) and the tail row's 2 mentions are two of those 82 — adding them
  // again produced 241 against a corpus that contains 239.
  //
  // n === null means "this alias was never recounted", and the two kinds of row it appears on
  // want opposite answers. A registry row like NO NAME (16 mentions, ONE alias, n null) keeps its
  // whole count on the row — read `?? 0` and the 16 vanish from the corpus total on merge. A row
  // with several un-recounted aliases cannot be split between them from here, so it contributes
  // nothing rather than guessing, and the recount pins catch it.
  const soleAlias = from.aliases.length === 1
  // Recorded BEFORE the loop mutates into.aliases. The occurrence emitter downstream asks
  // "does the target already carry one of these aliases?" to decide whether the merged row's
  // tail occurrences are already covered by a corpus-wide recount. Asked AFTER the merge, the
  // answer is always yes — the merge just put the alias there — so NO NAME's 16 occurrences and
  // No Name's 8 were counted and then never emitted.
  if (from.aliases.some(a => into.aliases.some(x => x.text === a.text))) supersededFrom.add(m.from)
  mergedAliasTexts.set(m.from, from.aliases.map(a => a.text))
  for (const a of from.aliases) {
    if (into.aliases.some(x => x.text === a.text)) continue
    const n = a.n ?? (soleAlias ? from.mentions : 0)
    into.aliases.push({ ...a, n })
    into.mentions += n
  }
  for (const pn of from.posts) if (!into.posts.includes(pn)) into.posts.push(pn)
  into.posts.sort((a, b) => a - b)
  entities.splice(entities.indexOf(from), 1)
  mergedRows++
}

// ── STAGE 1 of the Entities/Brackets hover audit ─────────────────────────────
// Rulings live in audit/entities-stage1-rulings.json, extracted from the audit handoff by
// scripts/extract-entities-stage1.mjs. Three actions, applied in this order because each depends
// on the one before: merge duplicate rows, correct types on what survives, then withdraw the rows
// the audit ruled are not entities at all.
//
// Rows are addressed by (canonical, source). That pair is unique across all 1,445 rows today —
// canonical alone is NOT, which is the very defect the merges fix: "Bill Clinton" ships twice,
// once from the core registry with 31 mentions and once from the adjudicated tail with 7.
const STAGE1 = path.join(OUT, 'entities-stage1-rulings.json')
const stage1 = fs.existsSync(STAGE1) ? JSON.parse(fs.readFileSync(STAGE1, 'utf8')) : null
const movedOutOccurrences = []
let s1Merged = 0, s1Typed = 0, s1MovedRows = 0
if (stage1) {
  const find = (canonical, source) => entities.find(e => e.canonical === canonical && e.source === source)

  // 1. MERGES. A merge changes how many rows ship, never how many mentions were found — the same
  //    rule as the Ray/Rachel Chandler merge. Mentions and posts move ACROSS; every absorbed
  //    spelling survives as an alias, so no way of finding the entity is lost.
  for (const m of stage1.merges) {
    const target = find(m.canonical, m.keepFrom.source)
    if (!target) { console.error(`stage1 merge: target "${m.canonical}" (${m.keepFrom.source}) not found`); process.exit(1) }
    for (const a of m.absorb) {
      const idx = entities.findIndex(e => e.canonical === a.canonical && e.source === a.source)
      if (idx === -1) continue                                  // already merged on a previous run
      const [row] = entities.splice(idx, 1)
      target.mentions += row.mentions
      target.posts = [...new Set([...target.posts, ...row.posts])].sort((x, y) => x - y)
      // The absorbed CANONICAL becomes an alias too. "Wikileaks" is how some drops spell it, and
      // dropping the spelling would make those drops unreachable by the name they use.
      for (const al of [...row.aliases, { text: row.canonical, n: null }]) {
        if (!target.aliases.some(x => x.text === al.text)) target.aliases.push(al)
      }
      target.provenance = `${target.provenance ? `${target.provenance} · ` : ''}hover audit 2026-08-16 — absorbed "${row.canonical}" (${row.source}, ${row.mentions} mentions): duplicate canonical`
      s1Merged++
    }
    if (m.entityType && target.type !== m.entityType) target.type = m.entityType
  }

  // 2. TYPE CORRECTIONS. No count moves — this is what the row IS, not how often it appears.
  for (const t of stage1.typeCorrections) {
    const row = find(t.canonical, t.source)
    if (!row) continue                                          // absorbed by a merge above
    if (row.type === t.to) continue
    row.type = t.to
    s1Typed++
  }

  // 3. MOVE-OUTS. "Russian", "Military", "Republic", "Speed", "John" — wordings that name a broad
  //    concept, an adjective or an incomplete name rather than a specific thing.
  //
  //    NOTHING IS DELETED. Q's text is untouched and these drops still carry every word they
  //    carried; what changes is that this wording is no longer CLASSIFIED as a named entity, so it
  //    stops being highlighted and stops being counted. Every withdrawn occurrence — post number,
  //    the text Q wrote, the prior type and the audit's reason — is preserved in
  //    audit/entities-moved-out-history.json, and removing an entry from the rulings file puts the
  //    row back exactly as it was.
  for (const mo of stage1.moveOuts) {
    const idx = entities.findIndex(e => e.canonical === mo.canonical)
    if (idx === -1) continue
    entities.splice(idx, 1)
    s1MovedRows++
  }
  // Collected for the render pass below: the count and the render entries must fall together, or
  // the materialiser's own gate refuses to write — which is the check working.
  const history = path.join(OUT, 'entities-moved-out-history.json')
  if (fs.existsSync(history)) {
    for (const mo of JSON.parse(fs.readFileSync(history, 'utf8')).moveOuts) {
      for (const o of mo.occurrences) movedOutOccurrences.push({ postNum: o.postNum, alias: o.matchedAlias, canonical: mo.canonical })
    }
  }
  console.log(`\n  STAGE 1 hover audit: ${s1Merged} rows merged away, ${s1Typed} types corrected, ${s1MovedRows} rows withdrawn (${movedOutOccurrences.length} occurrences)`)
}

entities.sort((a, b) => b.mentions - a.mentions)

// ── Immutable entity identity ────────────────────────────────────────────────
// The archive had no entity ID at all: rows were addressed by their display name, so correcting a
// spelling silently created a different entity. The audit's own ENT-#### numbers cannot fill the
// gap either — they are our list numbered by mention count, so ENT-0058 means "the 58th busiest
// row on the day the audit ran" and every number after a recount shifts.
//
// So identity is MINTED ONCE and stored, never derived. An id does not encode the name, the type,
// the mention count or the position, because every one of those is a thing that legitimately
// changes about an entity that is still the same entity. The canonical name and the URL slug are
// stored beside the id as attributes of it.
//
// Renames are the whole point: when a canonical changes, the ledger keeps the old spelling in
// previousCanonicals and the id survives. Merges record the absorbed spellings the same way, so a
// link to an entity that was merged away still resolves.
// ── THE UNHIGHLIGHTED-SENTENCE QUEUE, RULED BY THE OWNER (2026-08-20 + 2026-08-24), PHASE A ──
//
// 508 spans the owner ruled to BE entities. An entity ruling names a SPAN; a certified row needs an
// IDENTITY, and the review carries neither a canonical name nor a type. lib/queueEntityResolve.mjs
// closes that gap by RESOLUTION first and creation last - verbatim, then with titles and role tails
// removed, then initial+surname, then a connector split where every part resolves, and only then
// audit/unhighlighted-entity-identities.json, which declares the identities this batch introduces
// with a type from the vocabulary entities.json already uses. Three spans are HELD rather than
// guessed and are listed there with the reason.
//
// SPLIT IN TWO PHASES, and the split is load-bearing. Identities have to exist before ids are
// minted below, but the MENTION for each ruling cannot be decided until the render map is built:
// 313 of the 508 name an entity already certified in that very drop, and counting those again
// would show the reader an x2 that Q never wrote. Phase B is immediately after the render map.
// BOTH ROUNDS OF IDENTITIES, MERGED. Round 1's file is hand-authored, 41 identities and 23
// splits. Round 2's is generated from the three list shapes Q pastes verbatim — the central-bank
// list, the "THE BRIDGE" media list, the retiring-Congress list — and holds the 128 wordings that
// fall outside them rather than naming them. Merged here for the same reason lib/queueRulings.mjs
// merges the rulings: a resolver that reads one file and not the other reports success while
// holding every span the other one names.
// Round 3 is the 128 wordings round 2 HELD. The owner ruled them all Entities on 2026-08-24 and
// asked for the research per drop, so each is named from the line it sits on; 44 that would have
// needed a guess, or whose alias would paint the wrong text corpus-wide, are in
// audit/held-entity-resolution-center.json instead of here.
const IDENT_FILES = ['unhighlighted-entity-identities.json', 'unhighlighted-entity-identities-2.json', 'unhighlighted-entity-identities-3.json']
  .map(f => path.join(OUT, f)).filter(f => fs.existsSync(f))
const queueEntityRulings = loadQueueRulings(ROOT, 'entities')
const queueHits = []
const queueHeld = []
let queueEntitiesCreated = 0
if (queueEntityRulings.length && IDENT_FILES.length) {
  const docs = IDENT_FILES.map(f => JSON.parse(fs.readFileSync(f, 'utf8')))
  // A LATER ROUND'S NAME BEATS AN EARLIER ROUND'S HOLD.
  //
  // makeEntityResolver checks held[] FIRST, by prefix, before any identity is consulted - which is
  // right within one round and wrong across rounds. Round 2 held 128 wordings it would not name;
  // round 3 is the owner's ruling that they be named, researched drop by drop. Merged naively,
  // every one of those names would be refused by round 2's own hold and the ruling would be a
  // no-op that still reported success.
  //
  // So a hold is dropped when a LATER file declares that spelling, or declares a split for it. The
  // 44 round-3 sent to the Resolution Center instead of naming are NOT declared here, so their
  // holds stand and they are still reported held, which is what should happen to them.
  const declaredLater = new Set()
  docs.forEach((d, i) => {
    if (i === 0) return
    for (const id of d.identities ?? []) for (const sp of id.spellings ?? []) declaredLater.add(String(sp).toLowerCase())
    for (const sp of d.splits ?? []) declaredLater.add(String(sp.spelling).toLowerCase())
  })
  const heldAll = docs.flatMap((d, i) => (d.held ?? []).map(h => ({ ...h, round: i })))
  const heldKept = heldAll.filter(h => {
    const sp = String(h.spelling).toLowerCase()
    if (!declaredLater.has(sp)) return true
    // only a hold from an EARLIER file can be overridden
    return !docs.some((d, i) => i > h.round &&
      ((d.identities ?? []).some(id => (id.spellings ?? []).some(x => String(x).toLowerCase() === sp)) ||
       (d.splits ?? []).some(x => String(x.spelling).toLowerCase() === sp)))
  })
  const holdsOverridden = heldAll.length - heldKept.length
  const merged = {
    identities: docs.flatMap(d => d.identities ?? []),
    splits: docs.flatMap(d => d.splits ?? []),
    held: heldKept,
  }
  console.log(`  identity holds lifted : ${holdsOverridden} (named by a later round's ruling)`)
  const { resolve } = makeEntityResolver(entities, merged)
  const byCanonical = new Map(entities.map(e => [e.canonical, e]))
  for (const r of queueEntityRulings) {
    const res = resolve(r)
    if (res.heldWhy) { queueHeld.push({ postNum: r.postNum, text: r.sourceText, why: res.heldWhy }); continue }
    for (const h of res.hits) {
      if (!byCanonical.has(h.canonical)) {
        const row = {
          canonical: h.canonical, type: h.type, mentions: 0, posts: [], aliases: [],
          source: 'owner ruling',
          provenance: `owner ruling ${r.ruledOn} - unhighlighted-sentence queue`,
        }
        entities.push(row)
        byCanonical.set(h.canonical, row)
        queueEntitiesCreated++
      }
      queueHits.push({ postNum: r.postNum, canonical: h.canonical, aliasUsed: h.aliasUsed })
    }
  }
}


const ID_LEDGER = path.join(OUT, 'entity-ids.json')
const ledger = fs.existsSync(ID_LEDGER)
  ? JSON.parse(fs.readFileSync(ID_LEDGER, 'utf8'))
  : { note: '', entries: {} }
const ledgerEntries = ledger.entries ?? {}
// canonical (current or previous) -> id
const idByName = new Map()
for (const [id, e] of Object.entries(ledgerEntries)) {
  idByName.set(e.canonical, id)
  for (const p of e.previousCanonicals ?? []) idByName.set(p, id)
}
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const usedSlugs = new Map()
let minted = 0
for (const e of entities) {
  let id = idByName.get(e.canonical)
  if (!id) {
    // Opaque and random, so nothing about the entity can be read out of it or drift with it.
    // Minted once and persisted immediately, so a second run mints nothing and the bundle is
    // reproducible — the same discipline as the Resolution Center's first-seen ledger.
    do { id = `qe-${randomBytes(6).toString('hex')}` } while (id in ledgerEntries)
    minted++
  }
  // A slug can collide where two entities differ only by punctuation; the id never can, so the
  // slug is disambiguated and the id is left alone.
  let slug = slugify(e.canonical) || 'entity'
  if (usedSlugs.has(slug) && usedSlugs.get(slug) !== id) slug = `${slug}-${id.slice(3, 9)}`
  usedSlugs.set(slug, id)

  const prev = new Set(ledgerEntries[id]?.previousCanonicals ?? [])
  if (ledgerEntries[id]?.canonical && ledgerEntries[id].canonical !== e.canonical) prev.add(ledgerEntries[id].canonical)
  ledgerEntries[id] = {
    canonical: e.canonical,
    slug,
    previousCanonicals: [...prev].sort(),
    // The crosswalk back to every audit that referred to this row.
    auditEntityIds: [...new Set(ledgerEntries[id]?.auditEntityIds ?? [])].sort(),
  }
  e.id = id
  e.slug = slug
}
// ── ENT-#### crosswalk ───────────────────────────────────────────────────────
// Every audit reference resolves to a permanent id, including the rows Stage 1 left alone — the
// later stages of the audit quote ENT numbers for those too, and an ENT number is positional, so
// it stops meaning anything the moment a count moves. Withdrawn rows resolve to no id on purpose;
// they are traceable through audit/entities-moved-out-history.json instead.
if (stage1?.auditCrosswalk) {
  const survivorOf = new Map()
  for (const m of stage1.merges) {
    survivorOf.set(`${m.canonical} ${m.keepFrom.source}`, m.canonical)
    for (const a of m.absorb) survivorOf.set(`${a.canonical} ${a.source}`, m.canonical)
  }
  // AN OWNER MERGE IS ALSO A MERGE. This crosswalk resolved survivors from stage1.merges alone,
  // so a row the OWNER merged away had no survivor here and its ENT number came back unmapped.
  // Owner merges are keyed by canonical only: entities-owner-rulings.json records no source.
  const ownerSurvivor = new Map()
  for (const m of merges) ownerSurvivor.set(m.from, m.into)
  const resolveOwner = c => { let x = c, n = 0; while (ownerSurvivor.has(x) && n++ < 10) x = ownerSurvivor.get(x); return x }

  const withdrawn = new Set(stage1.moveOuts.map(m => m.canonical))
  const byCanonical = new Map(entities.map(e => [e.canonical, e]))
  let mapped = 0, unmapped = []
  for (const row of stage1.auditCrosswalk) {
    if (withdrawn.has(row.canonical)) continue
    const target = resolveOwner(survivorOf.get(`${row.canonical} ${row.source}`) ?? row.canonical)
    const e = byCanonical.get(target)
    if (!e) { unmapped.push(`${row.entityId} ${row.canonical}`); continue }
    const entry = ledgerEntries[e.id]
    const ids = new Set(entry.auditEntityIds)
    ids.add(row.entityId)
    entry.auditEntityIds = [...ids].sort()
    mapped++
  }
  console.log(`  ENT-#### crosswalk    : ${mapped} audit references mapped, ${stage1.moveOuts.length} withdrawn rows held in history${unmapped.length ? `, ${unmapped.length} UNMAPPED` : ''}`)
  if (unmapped.length) { console.error(`
❌ unmapped audit references: ${unmapped.slice(0, 10).join(', ')}
`); process.exit(1) }
}

// Absorbed spellings keep resolving to the surviving entity.
if (stage1) {
  for (const m of stage1.merges) {
    const target = entities.find(e => e.canonical === m.canonical)
    if (!target) continue
    const entry = ledgerEntries[target.id]
    const prev = new Set(entry.previousCanonicals)
    for (const a of m.absorb) if (a.canonical !== m.canonical) prev.add(a.canonical)
    entry.previousCanonicals = [...prev].sort()
    const ids = new Set(entry.auditEntityIds)
    ids.add(m.keepFrom.entityId)
    for (const a of m.absorb) ids.add(a.entityId)
    entry.auditEntityIds = [...ids].sort()
  }
}
if (!dry) {
  fs.writeFileSync(ID_LEDGER, JSON.stringify({
    note: 'Immutable entity identity. An id is minted once and never derived from the canonical name, the type, the mention count or the row position — all of which legitimately change about an entity that is still the same entity. canonical and slug are attributes stored beside the id; previousCanonicals keeps every earlier or absorbed spelling resolving to it. auditEntityIds is the crosswalk to the ENT-#### numbers used by the 2026-08-16 hover audit, which were positional and must never be stored as identity.',
    minted: Object.keys(ledgerEntries).length,
    entries: ledgerEntries,
  }, null, 1))
}
console.log(`  entity ids            : ${minted} minted, ${Object.keys(ledgerEntries).length} tracked`)

const unresolvedAliases = [
  ...unresolvedTail,
  ...Object.entries(ctx.contextPass.perToken).filter(([, s]) => s.unresolved > 0)
    .map(([token, s]) => ({ sourceText: token, occurrences: s.unresolved, why: 'the surrounding post does not identify the referent' })),
]

// ── THE RENDER LAYER, BUILT BEFORE THE TOTALS ────────────────────────
//
// This map used to be assembled at the very end, next to the write. It moved here for one
// reason: the queue entity rulings below have to know what the certified layers ALREADY paint at
// a post before deciding how many occurrences to add. 313 of the 508 ruled spans name an entity
// that is already certified in that very drop, and adding a mention for each of those would show
// the reader a x2 that Q never wrote.
//
// Nothing about the map changed. It is still one entry per certified mention, still the ALIAS Q
// wrote rather than the canonical name, and the totals computed after it still have to equal it
// exactly — that equality is asserted at the write, unchanged.
  const byPost = new Map()
  const push = (n, canonical) => {
    if (!byPost.has(n)) byPost.set(n, [])
    byPost.get(n).push(canonical)
  }
  // THE ALIAS Q ACTUALLY WROTE, not the canonical name.
  //
  // Writing canonical names broke entity highlighting for 4,207 of 7,903 mentions: the post says
  // "HRC", "SEC", "UK", and the renderer looks for the literal string it is given. "Hillary
  // Clinton" is not in drop #1 and never will be. The canonical identity lives in entities.json
  // where the alias resolves to it; what belongs on the post is the text a reader can see.
  for (const m of coreMentions) push(m.postNum, m.aliasUsed || m.sourceText || m.canonicalEntity)
  // A RECOUNTED alias already covers its context-resolved occurrences.
  //
  // `recount` replaces the alias count with a fresh corpus-wide (or scoped) count, which INCLUDES
  // the occurrences the context pass had resolved individually. Emitting those rows here as well
  // stored them twice: 8,623 entries against 8,599 certified mentions — 14 DC + 10 SC, exactly the
  // two aliases that were recounted. The materialiser refused to write, which is how it surfaced.
  const recounted = new Set((fs.existsSync(ORULES)
    ? JSON.parse(fs.readFileSync(ORULES, 'utf8')).aliasRulings ?? [] : [])
    .filter(r => r.recount).map(r => r.alias))
  for (const r of ctx.resolutions) {
    if (recounted.has(r.token)) continue
    push(r.postNum, r.token || r.canonical)
  }
  // A merged-away canonical's tail occurrences are already emitted by the corpus-wide alias scan
  // that replaced it, so emitting them here too stored 8,484 entries against 8,482 certified.
  // The materialiser refused, which is the gate doing its job.
  const supersededTail = supersededFrom
  for (const o of tailOccurrences) {
    if (supersededTail.has(o.canonical)) continue
    push(o.postNum, o.sourceText || o.canonical)
  }
  // Owner rulings materialise the same way: the ALIAS Q wrote, never the canonical name. The
  // drop says "Dominion." and will never say "Dominion Voting Systems", so writing the canonical
  // here would count the mention and highlight nothing.
  for (const r of ownerEntities) {
    if (r.replacesAliasOnPost) continue          // lengthened below, never added beside
    push(r.postNum, r.aliasUsed || r.sourceText)
  }
  for (const [pn, al] of aliasByPost) push(pn, al)

  // ── Stage 1 withdrawals leave the render layer too ─────────────────────────
  // The count and the paint must fall together. Removing a row from entities.json while its
  // occurrences stay in postAnalysis.namedEntities would leave the drop highlighting a word that
  // no longer belongs to any entity — the exact shape of every silent failure in this project.
  //
  // Removal is OCCURRENCE-SCOPED: one entry per recorded occurrence, in that post, never "all
  // entries matching this text". "Independent" is withdrawn from #1797, a post carrying 14 entity
  // entries; a sweep by text would be a global ruling derived from one drop.
  //
  // The audit recorded the text as the POST writes it and the render layer stores the certified
  // ALIAS spelling, so four of the 39 differ only in case — "russian" vs "Russian" in #1864 and
  // #3861, "independent" in #1797, "the Party" in #4495. Exact match is tried first and the
  // case-insensitive fallback is only ever used where it resolves to exactly one entry.
  let withdrawn = 0
  const unwithdrawable = []
  for (const o of movedOutOccurrences) {
    const list = byPost.get(o.postNum)
    if (!list) { unwithdrawable.push(`#${o.postNum} "${o.alias}" — post has no entity entries`); continue }
    let i = list.indexOf(o.alias)
    if (i === -1) {
      const ci = list.map((t, n) => [t, n]).filter(([t]) => t.toLowerCase() === o.alias.toLowerCase())
      if (ci.length === 1) i = ci[0][1]
      else { unwithdrawable.push(`#${o.postNum} "${o.alias}" — ${ci.length} case-insensitive matches`); continue }
    }
    list.splice(i, 1)
    withdrawn++
  }
  if (unwithdrawable.length) {
    console.error(`\n❌ ${unwithdrawable.length} withdrawn occurrence(s) could not be located in the render layer:`)
    for (const u of unwithdrawable) console.error(`     ${u}`)
    console.error('   The count would fall without the paint. Nothing written.\n')
    process.exit(1)
  }
  if (movedOutOccurrences.length) console.log(`  withdrawn from render   : ${withdrawn} occurrence(s) across ${new Set(movedOutOccurrences.map(o => o.postNum)).size} posts`)

// ── QUEUE ENTITY RULINGS, PHASE B: MENTIONS AND PAINT, TOGETHER ─────────────
//
// Phase A created any identity this batch introduces. This decides how many OCCURRENCES each
// ruling adds, and it adds them to the count and to the render layer in the same step - the count
// and the paint must never move apart.
//
// THE SHORTFALL, NOT THE RULING COUNT. 313 of the 508 ruled spans name an entity the certified
// layers already paint in that drop, so what is owed is (times the owner ruled it) minus (times
// the render layer already carries it) at that (post, alias). Case-insensitive, because the
// renderer matches case-insensitively and "MOCKINGBIRD" and "Mockingbird" are one occurrence of
// one identity, not two.
//
// Conservative by construction: where the drop writes a name more often than the queue ruled it,
// nothing is added. That cannot cost the reader a highlight - the renderer paints every occurrence
// of a listed term, so presence in the list is what lights the drop up, and the count stays the
// one the certified layers established.
let queueEntityMentions = 0
{
  const already = new Map()
  for (const [pn, list] of byPost) for (const a of list) {
    const k = `${pn}|${String(a).toLowerCase()}`
    already.set(k, (already.get(k) ?? 0) + 1)
  }
  const ruled = new Map()
  for (const h of queueHits) {
    const k = `${h.postNum}|${h.aliasUsed.toLowerCase()}`
    ruled.set(k, (ruled.get(k) ?? 0) + 1)
  }
  const byCanonical = new Map(entities.map(e => [e.canonical, e]))
  const emitted = new Map()
  for (const h of queueHits) {
    const k = `${h.postNum}|${h.aliasUsed.toLowerCase()}`
    const done = emitted.get(k) ?? 0
    emitted.set(k, done + 1)
    if (done < (already.get(k) ?? 0)) continue
    const e = byCanonical.get(h.canonical)
    if (!e) { console.error(`queue entity ruling: canonical "${h.canonical}" vanished`); process.exit(1) }
    e.mentions += 1
    if (!e.posts.includes(h.postNum)) { e.posts.push(h.postNum); e.posts.sort((a, b) => a - b) }
    const al = e.aliases.find(x => x.text === h.aliasUsed)
    if (al) al.n = (al.n ?? 0) + 1
    else e.aliases.push({ text: h.aliasUsed, n: 1 })
    push(h.postNum, h.aliasUsed)
    queueEntityMentions++
  }
}
console.log(`  queue entity rulings  : ${queueEntityRulings.length} ruled -> ${queueHits.length} occurrence(s), ${queueEntitiesCreated} new identities, +${queueEntityMentions} mentions, ${queueHeld.length} held`)
for (const h of queueHeld) console.log(`      held #${h.postNum} ${JSON.stringify(String(h.text).slice(0, 60))} - ${h.why}`)


// ── totals ──────────────────────────────────────────────────────────────────
const tailTypes = {}
for (const e of merged.values()) tailTypes[e.type] = (tailTypes[e.type] ?? 0) + 1
const allTypes = {}
for (const e of entities) allTypes[e.type] = (allTypes[e.type] ?? 0) + 1

const totals = {
  canonicalEntities: entities.length,
  coreRegistryEntities: coreEntities.size,
  adjudicatedTailEntities: merged.size,
  // THE HEADLINE METRIC IS THE WHOLE SECTION.
  //
  // This was `coreMentions.length + ctx.resolutions.length` — 4,463 — which counted only the
  // 93-entity core registry. That was the right figure while the tail was still under review.
  // The tail is now reviewed and certified, so a section holding 1,332 entities headlining the
  // mentions of 93 of them understates its own finished work by 3,440 occurrences. The core
  // figure is kept as a submetric, not discarded: it is how the section was built.
  mentions: entities.reduce((n, e) => n + (e.mentions ?? 0), 0),
  // Derived from the FINAL table, not from the pre-merge coreMentions array. An owner alias
  // added to a core-registry entity — US -> United States, +277 — lands on the entity but never
  // reached this figure, so the headline and its submetrics stopped reconciling.
  coreRegistryMentions: entities.filter(e => e.source === 'core registry').reduce((n, e) => n + (e.mentions ?? 0), 0),
  adjudicatedTailMentions: entities.filter(e => e.source === 'adjudicated tail').reduce((n, e) => n + (e.mentions ?? 0), 0),
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
  // 1,332 detected + 1 owner ruling (Dominion Voting Systems, #4963). Both asserted separately
  // so a lost ruling fails here instead of silently reverting the total to 1,332.
  // The merge is added back: 1,332 is what the passes DETECTED, and absorbing Ray Chandler into
  // Rachel Chandler changes how many rows ship, not how many the detector found. Without the
  // term this check would drift down by one every time two rows turn out to be one person.
  // queueEntitiesCreated is subtracted with ownerAdded, for the same reason: an identity the owner
  // ruled into existence is not something a detector found. Keeping this at 1,292 is what makes a
  // LOST DETECTION still fail here after 39 rulings raised the row count.
  // 1,292 -> 1,287 · 1,448 -> 1,443 · 3,841 -> 3,838 on 2026-08-22 — OWNER RULING 1, five
  // duplicate canonical identities merged: Wray/Christopher Wray, Whitaker/Matthew Whitaker,
  // Pence/Mike Pence, Awan/Imran Awan, GANG OF 8/Gang of Eight (the caps row additionally typed
  // 'person' rather than government_institution).
  //
  // THIS IS IDENTITY NORMALIZATION, NOT OCCURRENCE DELETION, and the owner said so explicitly.
  // Five ROWS go; no occurrence does. The archive mention total is unchanged and asserted below.
  // The tail figure falls by 3 because three mentions RECLASSIFY: a tail row merged into a core
  // canonical stops being tail. Populations move, evidence does not.
  // 1,287 -> 1,286 on 2026-08-25: the Harris merge, via merges[] (from/into) like Patriot ->
  // Patriots before it — NOT mergeRulings[] (canonical/absorb), which is what `ownerMerged` counts
  // and what this formula adds back. A merges[]-mechanism merge falls straight through uncompensated,
  // same as Patriot's did.
  ['detected canonical entities = 1,286',
    entities.length - ownerAdded - queueEntitiesCreated + ownerMerged === 1286,
    entities.length - ownerAdded - queueEntitiesCreated + ownerMerged],
  // 508 (round 1) + 499 (round 2) = 1,007 rulings.
  ['queue entity rulings accounted for = 1,007',
    queueEntityRulings.length === 1007 && queueHits.length + queueHeld.length >= 1007,
    `${queueEntityRulings.length} ruled, ${queueHits.length} occurrences, ${queueHeld.length} held`],
  // 3 (round 1) + 185 (round 2). Round 2's held spans fall outside the three list shapes its
  // identities file covers; each is listed there and reported for the owner rather than named.

  // 2026-08-24 round 3: the owner ruled the 128 held wordings Entities and each was researched
  // against the drop it sits in; 103 ruling rows resolved, 85 remain held and are in
  // audit/held-entity-resolution-center.json. NAT SEC certified across 48 drops in the same batch.
  // -1 on 2026-08-24: "L." was one of the held wordings — a corpus-wide alias nobody had named —
  // and the owner named it on #300. A hold lifts when a later ruling answers it.
  ['queue entity holds = 85, all listed', queueHeld.length === 85, queueHeld.length],
  // 118 + NAT SEC + White House Press = 120.
  // 120 -> 123: three identities the 2026-08-24 post-scoped rulings create — "L." (#300),
  // "House Oversight" and "Government Reform Committee" (#1319, one line naming two bodies). The
  // other ten rulings reuse an identity the registry already holds, which is the point: a second
  // row for a person the archive already knows is the duplicate-identity defect.
  // 123 -> 124: "Vault 7" (#836). Typed creative_work, like the Steele Dossier the archive already
  // carries — a named document release, not an organisation and not an event.
  ['owner entity rulings applied = 124', ownerAdded === 124, ownerAdded],
  ['owner merge rulings applied = 1', ownerMerged === 1, ownerMerged],
  // 1,335 - 1: Ray Chandler is now an alias of Rachel Chandler, not a row of her own.
  // 1,445 -> 1,408: -19 rows merged away as duplicate canonicals, -18 rows withdrawn as
  // conceptual/generic labels. Both from the 2026-08-16 hover audit, Stage 1.
  // 1,409 + 39 identities the owner's queue rulings introduce = 1,448.
  // 1,443 + 308 identities round 2 introduces = 1,751. 151 central banks and 93 countries from
  // the list Q pastes across #135-#138, 65 journalists and their outlets from #1515's "THE BRIDGE"
  // list, and the retiring members of Congress from #1319/#1850 — every name read off Q's own line.
  // 1,751 + 48 named out of round 2's held list + NAT SEC + White House Press = 1,801.
  // 1,801 -> 1,803. Three identities are created by the rulings above and one queue-created row
  // is no longer minted, because "L." is now an owner identity rather than a held wording.
  // +1: Vault 7.
  // 1,804 -> 1,803 on 2026-08-25: the "Harris" merge. A separate "Harris" canonical (2 mentions,
  // #2854 and #4935) duplicated Kamala Harris — both occurrences are her, not a second Harris —
  // and one row is retired into the survivor.
  ['canonical entities = 1,803', entities.length === 1803, entities.length],
  // 8,227 + 12 RC. The merge moves 4 mentions between rows and adds none.
  // 9,786 -> 9,747: -39, the occurrences of the 18 withdrawn rows. The 17 merges move mentions
  // ACROSS rows and add none, so they are absent from this arithmetic by design — asserted
  // separately below so a merge that silently double-counted could not hide inside the total.
  // 9,749 + 171 from the queue rulings = 9,920. 547 occurrences were ruled and 376 of them were
  // already carried by a certified layer at that (post, alias), so only the shortfall is added.
  // +6 on 2026-08-21: NO -> Nellie Ohr, three occurrences each on #1928 and #1929 (twice in the
  // '>>BO>>CS>>BO>>NO>>CS>>NO>>BO>>' chain, once in '[BO][NO]'). Scoped by includePosts, because
  // the token matches 102 times across 75 posts and almost all of them are the English word.
  // +440 from round 2 of the queue review.
  // 10,366 -> 10,459 on 2026-08-24, the Q ruling: a standalone "Q" that is not the sign-off is an
  // Entity, and it is Alice. 93 occurrences across 75 drops. OCCURRENCE-SCOPED, which is the whole
  // safety of it: 4,534 sign-off lines are excluded by the ruling itself, and 65 more standalone
  // Q tokens are HELD because they name something else - Al-Qaeda, a 10-Q filing, Quicken Loans
  // Arena, the NSA Q Group, a DOE clearance level, Q+ and the word "question".
  // See audit/q-entity-owner-ruling.json.
  // 10,459 + 150 from round 3's identities and NAT SEC's 48 drops + 2 for WH_POTUS_PRESS
  // (#397, #417) = 10,611.
  // +2 on 2026-08-24: "lets make both the Q's an Entity (not the signiture)" on #2347. Both body
  // Qs — "The signifier will 'force' the Q." and "The Q will be answered (((WWG1WGA)))." — were
  // held by the "the word question" rule, which was written for those two lines; the owner read the
  // drop and ruled otherwise. TWO, not three: the third Q on that drop is inside the twitter handle
  // "Q_ANONBaby" and stays held, which is what includeOccurrences is for.
  // +9 on 2026-08-24, the post-scoped entity rulings. Eight are a first occurrence of an identity
  // on the drop named; the ninth is #1319's "Goodlatte", a SECOND occurrence on a drop the identity
  // already appears on — the list certifies "Bob Goodlatte - Republican" and line 59 names him
  // again by surname.
  //
  // The four SPAN EXTENSIONS add nothing: #836 "Fiddler" -> "OP Name: Fiddler" and #3383's
  // "Waters"/"Pelosi"/"Biden" -> "M. Waters"/"N. Pelosi"/"J. Biden" lengthen a span the drop
  // already carries, so one occurrence stays one occurrence.
  // +1 on 2026-08-24: "in post 836 i want Vault7 or any Vault 7 to be classified as an entitiy
  // throughout all the post". A corpus sweep returns exactly ONE occurrence — "Who leaked Vault7 to
  // WL?" — so corpus-wide and post-scoped are the same ruling here.
  //
  // 10,623 -> 10,624 on 2026-08-25: #4926's CIA. Five span extensions on that day (Senate Minority
  // Leader x2, Mayor de Blasio x2, Gov. Cuomo, Gov. McCauliffe, Harris) add nothing — same shape as
  // Fiddler/Waters/Pelosi/Biden above, one occurrence lengthened, not doubled. The Harris merge
  // moves mentions between rows and adds none, same as every merge above. CIA is the one drop that
  // gains a mention it did not certify before: "Non_CIA_background next?" never fired.
  // 10,624 -> 10,702 on 2026-08-25: +82 from the "D's"/"R's" party alias ruling, -4 from the four
  // duplicate-span withdrawals (Pelosi, Schiff, Nadler, Cuomo) discovered while conjoining titles.
  // 82 - 4 = 78; 10,624 + 78 = 10,702.
  ['resolved mentions = 10,702', totals.mentions === 10702, totals.mentions],
  ['stage 1: 19 rows merged away', !stage1 || s1Merged === 19, s1Merged],
  ['stage 1: 85 types corrected', !stage1 || s1Typed === 85, s1Typed],
  // 18 in the audit, 17 applied: ENT-0709 "Non-profit organization" is HELD because it
  // contradicts a standing owner ruling (2026-08-15). An owner ruling outranks an audit pass.
  ['stage 1: 17 rows withdrawn', !stage1 || s1MovedRows === 17, s1MovedRows],
  ['stage 1: 1 move-out held by owner ruling', !stage1 || (stage1.heldMoveOuts ?? []).length === 1, (stage1?.heldMoveOuts ?? []).length],
  ['stage 1: 37 occurrences withdrawn', !stage1 || movedOutOccurrences.length === 37, movedOutOccurrences.length],
  // The defect the merges exist to fix: one canonical, one row.
  ['every canonical is unique', new Set(entities.map(e => e.canonical)).size === entities.length,
    `${new Set(entities.map(e => e.canonical)).size} distinct / ${entities.length} rows`],
  ['every entity carries an immutable id', entities.every(e => /^qe-[0-9a-f]{12}$/.test(e.id ?? '')), 'ok'],
  ['every id is unique', new Set(entities.map(e => e.id)).size === entities.length, new Set(entities.map(e => e.id)).size],
  ['every entity carries a slug', entities.every(e => e.slug), 'ok'],
  // C19 34 + CCP 4 + WUT 2 + US 277 + RC 12. US is the largest single alias ruling in the corpus.
  // +6, the same six: they arrive through an owner alias ruling.
  // +2, the two #2347 occurrences the owner ruled in. They arrive through the Q -> Alice alias
  // ruling, which is where every occurrence of that ruling arrives.
  // +82 on 2026-08-25: the "D's" (52 posts) / "R's" (9 posts) party alias ruling — a corpus census
  // that read all 82 occurrences individually before writing the ruling, deliberately excluding the
  // bracket "[D]"/"[R]" forms (D-Day on #2629, "[R] = Renegade" on #1277, delta markers "[D][1-6]"
  // on #3604/#3654 — the same shape as the owner's own "D5 is a prediction not a democrat" caution).
  ['owner alias mentions = 2,282', aliasMentions === 2282, aliasMentions],
  // Every mention of the 39 is accounted for, and the submetrics move for two separate reasons.
  // MERGES move mentions ACROSS populations without changing the headline: 53 tail mentions are
  // absorbed into core-registry rows (Bill Clinton +7, Australia +6, New York +13, WikiLeaks +17,
  // Julian Assange +1, Valerie Jarrett +4, Hong Kong +4, Ghislaine Maxwell +1) and 24 more move
  // between tail rows, which is invisible here. MOVE-OUTS remove mentions outright: 37 from the
  // tail, 2 from an owner ruling ("Non-profit organization", alias NP).
  //   core  5,299 + 53           = 5,352
  //   tail  3,867 - 53 - 37      = 3,777
  //   owner   620 (unchanged)    =   620      sum 9,749
  // The owner submetric does NOT fall: the only owner-sourced move-out, "Non-profit organization"
  // (alias NP, 2 mentions), is held because it contradicts a standing owner ruling.
  // +8: queue rulings that landed on a core-registry identity.
  // +61: round-2 rulings that landed on a core-registry identity.
  // +2: two of the nine land on a core-registry identity.
  // +1 on 2026-08-25: #4926's CIA, a core-registry identity (126 mentions before this). The Harris
  // merge does not move this figure — Harris and Kamala Harris are both tail-population rows.
  // +80 on 2026-08-25: +82 from the D's/R's ruling (Democratic Party and Republican Party are both
  // core-registry canonicals) minus 2 for the Pelosi and Schiff duplicate-span withdrawals on
  // #3778, both core-registry people.
  ['core-registry mentions = 5,519', totals.coreRegistryMentions === 5519, totals.coreRegistryMentions],
  // 3,440 + 34 C19 + 12 RC: COVID-19 and Rachel Chandler are tail entities, so alias rulings on
  // them land here.
  // +58: queue rulings that landed on an adjudicated-tail identity.
  // +6, the same six again - one movement, counted in three places by design.
  // +54: round-2 rulings that landed on an adjudicated-tail identity.
  // +2, the same two: Alice is an adjudicated-tail identity, so an alias ruling on it lands here.
  // +4: four land on an adjudicated-tail identity. The remaining three land on owner-ruling rows,
  // which is where an identity the owner created lives.
  // -2 on 2026-08-25: the Nadler and Cuomo duplicate-span withdrawals on #3778/#4935, both
  // adjudicated-tail identities. Decremented on `merged` directly (see the withdrawal block
  // above tailPostsByCanonical) so the count falls with the occurrence, not just the render list.
  ['adjudicated-tail mentions = 4,011', totals.adjudicatedTailMentions === 4011, totals.adjudicatedTailMentions],
  // -2 on 2026-08-25: the same two withdrawn render records (Nadler #3778, Cuomo #4935) drop out
  // of the occurrence-provenance list itself.
  ['tail occurrence rows = 3,438', tailOccurrences.length === 3438, tailOccurrences.length],
  ['every tail occurrence carries a post identity', tailOccurrences.every(o => o.postNum && o.id), 'ok'],
  ['every tail entity now has post provenance',
    [...merged.values()].every(e => (tailPostsByCanonical.get(e.canonical) ?? new Set()).size > 0),
    `${[...merged.values()].filter(e => !(tailPostsByCanonical.get(e.canonical) ?? new Set()).size).length} without`],
  // Three populations now, not two: core registry + adjudicated tail + owner rulings. The
  // headline counts the whole section, so an owner mention has to appear in the reconciliation
  // or the check reads as drift. Keeping it exact is the point — it caught this addition.
  ['submetrics reconcile to the headline',
    // Summed from the entities themselves, not from an increment counter: CCP arrived with 4
    // mentions on one owner-source entity, so counting "+1 per ruling" understated it by 3.
    // An alias added to an EXISTING entity (C19 -> COVID-19, a tail entity) is already inside
    // that entity's submetric and must not be counted twice here.
    totals.coreRegistryMentions + totals.adjudicatedTailMentions
      + entities.filter(e => e.source === 'owner ruling').reduce((n, e) => n + e.mentions, 0) === totals.mentions,
    `${totals.coreRegistryMentions} + ${totals.adjudicatedTailMentions} + ${entities.filter(e => e.source === 'owner ruling').reduce((n, e) => n + e.mentions, 0)}`],
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
  // Owner rulings are exempt, and only owner rulings. This check exists to stop the DETECTOR
  // leaking a routing marker into the entity set. When the owner names something an entity, that
  // outranks an adjudication pass that called it "a conceptual collective" — #4963 "Patriots" is
  // exactly that case. Anything else appearing in both is still a defect.
  ['no DETECTED entity is also routed to Themes',
    !entities.some(e => e.source !== 'owner ruling' && themed.some(t => t.sourceText === e.canonical)), 'ok'],
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
// The UI reads postAnalysis.namedEntities, and this step never rewrote it — so entities.json
// carried the certified 1,339 while the Entities page went on rendering 13,881 pre-certification
// extractor entries under the same section name. Certified data is worth nothing if the screen
// shows something else. Rewritten here from the certified set, as apply-emphasis already does.
{
  // GUARD — do not half-migrate. Every one of the 1,239 adjudicated-tail entities currently ships
  // with `posts: []`, so only the 93 core-registry entities carry post provenance. Rewriting from
  // that covers 1,263 posts against the 4,458 the legacy field holds, which would replace an
  // over-count with an under-count and read as a regression to anyone browsing the Entities page.
  //
  // Materialise tail occurrence provenance from the adjudicated source that produced the 3,440
  // tail mentions, then delete this guard. Until then the legacy field is left alone and the
  // defect stays visible rather than half-fixed and hidden.
  const tail = entities.filter(e => e.source === 'adjudicated tail')
  const tailWithPosts = tail.filter(e => (e.posts ?? []).length).length
  if (tail.length && tailWithPosts === 0) {
    console.log(`\n  ⚠ postAnalysis.namedEntities NOT rewritten: ${tail.length} adjudicated-tail`)
    console.log('    entities carry no post provenance, so the rewrite would under-report.')
    console.log('    See audit/HANDOFF-conflict-adjudication.md → URGENT.\n')
  } else {
  const postsFile = path.join(DATA, 'posts.json')
  const allPosts = JSON.parse(fs.readFileSync(postsFile, 'utf8'))
  // ONE ENTRY PER CERTIFIED MENTION, not one per post.
  //
  // A post-presence list sums to 6,432 while the certified metric is 7,903 mentions — the
  // difference is entities Q names more than once in a drop. Writing presence would make the
  // Entities page under-report by 1,471 and the in-post repeats would vanish, which is the same
  // occurrence-identity mistake that produced every wrong count in this project.

  // ── OWNER SPAN EXTENSIONS — one occurrence, spelled the way Q spelled it ────
  //
  // LAST, deliberately. The span being lengthened may have been pushed by ANY of the layers
  // above — #836's "Fiddler" arrives from the queue entity rulings, hundreds of lines after the
  // owner-ruling push — so running this earlier found nothing to lengthen and refused.
  //
  // "Lets make each one of these full entities you are forgetting to highlight the first letter of
  // their names" (2026-08-24). The certified span on #3383 was "Waters"; Q wrote "M. Waters". This
  // LENGTHENS the entry already on the drop rather than adding a second one, so the mention count
  // does not move and the reader does not get a box inside a box.
  //
  // Refuses rather than under-apply: a ruling naming a span the drop does not carry is a ruling
  // that needs re-reading, not one to drop quietly.
  let extended = 0
  for (const r of ownerEntities) {
    if (!r.replacesAliasOnPost) continue
    const list = byPost.get(r.postNum)
    const at = list ? list.indexOf(r.replacesAliasOnPost) : -1
    if (at < 0) {
      console.error(`
❌ span extension: #${r.postNum} does not carry ${JSON.stringify(r.replacesAliasOnPost)}, so it cannot be lengthened to ${JSON.stringify(r.aliasUsed)}.
`)
      process.exit(1)
    }
    list[at] = r.aliasUsed
    extended++
  }
  if (extended) console.log(`  owner span extensions : ${extended} span(s) lengthened, no mention added`)


  const materialised = [...byPost.values()].reduce((n, l) => n + l.length, 0)
  if (materialised !== totals.mentions) {
    console.error(`
❌ postAnalysis.namedEntities would carry ${materialised} entries against ${totals.mentions} certified mentions. Not written.
`)
    process.exit(1)
  }
  for (const p of allPosts) {
    if (!p.postAnalysis) { if (!byPost.has(p.postNum)) continue; p.postAnalysis = {} }
    p.postAnalysis.namedEntities = byPost.get(p.postNum) ?? []
  }
  fs.writeFileSync(postsFile, JSON.stringify(allPosts))
  console.log(`  postAnalysis.namedEntities rewritten from the certified set (${byPost.size} posts)`)
  }
}

console.log(`\nwrote public/data/entities.json (${(fs.statSync(path.join(DATA, 'entities.json')).size / 1048576).toFixed(2)} MB)\n`)
