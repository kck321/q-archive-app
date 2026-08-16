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
import { clean } from './lib/segment.mjs'

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
const withdrawnAliases = new Set((fs.existsSync(path.join(OUT, 'entities-owner-rulings.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'entities-owner-rulings.json'), 'utf8')).aliasWithdrawals ?? []
  : []).map(w => `${w.canonical}|${w.alias}`))
const coreMentions = audit.mentions
  .filter(m => !withdrawnAliases.has(`${m.canonicalEntity}|${m.sourceText}`))
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

const tailPostsByCanonical = new Map()
for (const o of tailOccurrences) {
  if (!tailPostsByCanonical.has(o.canonical)) tailPostsByCanonical.set(o.canonical, new Set())
  tailPostsByCanonical.get(o.canonical).add(o.postNum)
}

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
  const existing = entities.find(e => e.canonical === r.canonical)
  if (existing) {
    if (existing.posts.includes(r.postNum)) continue
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
const from_aliases = m => mergedAliasTexts.get(m.from) ?? []
let mergedRows = 0
for (const m of merges) {
  const from = entities.find(e => e.canonical === m.from)
  const into = entities.find(e => e.canonical === m.into)
  if (!from || !into) continue
  // Mentions move ONLY for aliases the target does not already count. "Patriot" was recounted
  // corpus-wide (82 occurrences) and the tail row's 2 mentions are two of those 82 — adding them
  // again produced 241 against a corpus that contains 239.
  mergedAliasTexts.set(m.from, from.aliases.map(a => a.text))
  for (const a of from.aliases) {
    if (into.aliases.some(x => x.text === a.text)) continue
    into.aliases.push(a)
    into.mentions += a.n ?? 0
  }
  for (const pn of from.posts) if (!into.posts.includes(pn)) into.posts.push(pn)
  into.posts.sort((a, b) => a - b)
  entities.splice(entities.indexOf(from), 1)
  mergedRows++
}

entities.sort((a, b) => b.mentions - a.mentions)

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
  ['detected canonical entities = 1,331', entities.length - ownerAdded + ownerMerged === 1331, entities.length - ownerAdded + ownerMerged],
  ['owner entity rulings applied = 117', ownerAdded === 117, ownerAdded],
  ['owner merge rulings applied = 1', ownerMerged === 1, ownerMerged],
  // 1,335 - 1: Ray Chandler is now an alias of Rachel Chandler, not a row of her own.
  ['canonical entities = 1,447', entities.length === 1447, entities.length],
  // 8,227 + 12 RC. The merge moves 4 mentions between rows and adds none.
  ['resolved mentions = 9,750', totals.mentions === 9750, totals.mentions],
  // C19 34 + CCP 4 + WUT 2 + US 277 + RC 12. US is the largest single alias ruling in the corpus.
  ['owner alias mentions = 2,063', aliasMentions === 2063, aliasMentions],
  ['core-registry mentions = 5,273', totals.coreRegistryMentions === 5273, totals.coreRegistryMentions],
  // 3,440 + 34 C19 + 12 RC: COVID-19 and Rachel Chandler are tail entities, so alias rulings on
  // them land here.
  ['adjudicated-tail mentions = 3,867', totals.adjudicatedTailMentions === 3867, totals.adjudicatedTailMentions],
  ['tail occurrence rows = 3,440', tailOccurrences.length === 3440, tailOccurrences.length],
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
  const supersededTail = new Set(merges.filter(m => {
    const into = entities.find(e => e.canonical === m.into)
    return into && into.aliases.some(a => from_aliases(m).includes(a.text))
  }).map(m => m.from))
  for (const o of tailOccurrences) {
    if (supersededTail.has(o.canonical)) continue
    push(o.postNum, o.sourceText || o.canonical)
  }
  // Owner rulings materialise the same way: the ALIAS Q wrote, never the canonical name. The
  // drop says "Dominion." and will never say "Dominion Voting Systems", so writing the canonical
  // here would count the mention and highlight nothing.
  for (const r of ownerEntities) push(r.postNum, r.aliasUsed || r.sourceText)
  for (const [pn, al] of aliasByPost) push(pn, al)

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
