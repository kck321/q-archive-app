// THE VERSE BLOCKS, MATERIALISED. Owner ruling 2026-08-23.
//
// A quoted passage of scripture is ONE Directive covering the whole passage, and the reference
// label beside it is an Entity. See audit/scripture-owner-rulings.json for the ruling, the
// population and why it reverses part of the 2026-08-16 religious adjudication.
//
// WHAT THIS STEP DOES, PER BLOCK:
//
//   1. withdraws every directive whose text lies inside the block  (they were the sentence-level
//      fragments the ruling replaces)
//   2. withdraws every claim whose text lies inside the block, with its claimSpans and claimMeta
//      records — a passage certified as a Directive must not also be a Claim, or the same words
//      count twice across two sections
//   3. writes the WHOLE block as a single directive, in the position the first withdrawn fragment
//      held, so the reader's list keeps its reading order
//   4. registers the citation as a certified entity on the post and in entities.json
//
// WHERE IT RUNS. After apply-step3b1.mjs, which is the last step that rewrites actionRequests,
// postAnalysis.claims and their metadata — anything earlier would be overwritten by a later
// rebuild. Before reconcile-entity-registry.mjs and build-entity-public-view.mjs, which read the
// finished entity state, so the citation entities are part of what they reconcile and publish.
//
// IDEMPOTENT. It rebuilds from the artifact every run: a block already applied has no fragments
// left to withdraw and its directive is already present, so a second run is a no-op. That is what
// the chain proves by running twice.
//
// FAILS LOUDLY, NEVER SILENTLY. Every block must appear verbatim in its post exactly once. If a
// drop's text has moved under the ruling, this exits non-zero and names the post rather than
// applying a passage to text that no longer says it.
//
// THE FAMILY. Every verse block is filed `morale`: the seven families describe what a directive
// asks of the reader, and a passage quoted for encouragement asks for resolve. The fragments being
// withdrawn were already mostly `morale` for the same reason.
//
//   node scripts/apply-scripture-blocks.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const RULINGS = path.join(ROOT, 'audit/scripture-owner-rulings.json')
if (!fs.existsSync(RULINGS)) {
  console.error('audit/scripture-owner-rulings.json is missing. Run scripts/build-scripture-rulings.mjs first.')
  process.exit(1)
}
const ruling = JSON.parse(fs.readFileSync(RULINGS, 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const byNum = new Map(posts.map(p => [Number(p.postNum ?? p.id), p]))

/** The family every verse block is filed under. See the header. */
const FAMILY = 'morale'
/** The entity type for a scripture reference. */
const CITATION_TYPE = 'creative_work'

const norm = s => key(s)
/** Is `sentence` part of `block`? Both normalised, so curly quotes and markup cannot decide it. */
const inside = (blockKey, sentence) => {
  const s = norm(sentence)
  return s.length > 10 && blockKey.includes(s)
}

const problems = []
const stats = {
  blocks: 0, directivesWithdrawn: 0, claimsWithdrawn: 0, directivesWritten: 0,
  claimSpansWithdrawn: 0, claimMetaWithdrawn: 0, predictionsWithdrawn: 0,
  citationOccurrences: 0, citationIdentities: 0, alreadyApplied: 0,
}

for (const b of ruling.blocks) {
  const post = byNum.get(b.post)
  if (!post) { problems.push(`#${b.post}: no such post`); continue }
  const text = clean(String(post.text ?? ''))
  const block = clean(b.block)

  // The passage must still be in the drop, exactly once.
  const first = text.indexOf(block)
  if (first === -1) { problems.push(`#${b.post}: block text is no longer in the post`); continue }
  if (text.indexOf(block, first + 1) !== -1) { problems.push(`#${b.post}: block text appears more than once`); continue }

  stats.blocks++
  const blockKey = norm(block)

  // ── 1. the directive fragments this block replaces ──────────────────────────────────────────
  const directives = Array.isArray(post.actionRequests) ? post.actionRequests : []
  const already = directives.findIndex(d => norm(d) === blockKey)
  const fragments = directives.map((d, i) => ({ d, i })).filter(({ d }) => norm(d) !== blockKey && inside(blockKey, d))
  const at = fragments.length ? fragments[0].i : (already === -1 ? directives.length : already)

  const kept = directives.filter(d => norm(d) === blockKey || !inside(blockKey, d))
  stats.directivesWithdrawn += directives.length - kept.length

  if (already === -1) {
    // Insert where the first withdrawn fragment stood, so reading order survives.
    const before = kept.slice(0, Math.min(at, kept.length))
    const after = kept.slice(Math.min(at, kept.length))
    post.actionRequests = [...before, block, ...after]
    stats.directivesWritten++
  } else {
    post.actionRequests = kept
    stats.alreadyApplied++
  }
  post.hasRequests = post.actionRequests.length > 0

  // Families: drop the withdrawn fragments' entries, add the block's.
  post.directiveFamilies = post.directiveFamilies ?? {}
  for (const k of Object.keys(post.directiveFamilies)) {
    if (k !== blockKey && inside(blockKey, k)) delete post.directiveFamilies[k]
  }
  post.directiveFamilies[blockKey] = { family: FAMILY, alsoQuestion: false }

  // The span/provenance record, same shape the v5 migration writes.
  post.directiveMeta = post.directiveMeta ?? {}
  for (const k of Object.keys(post.directiveMeta)) {
    if (k !== blockKey && inside(blockKey, k)) delete post.directiveMeta[k]
  }
  post.directiveMeta[blockKey] = {
    stableOccurrenceId: `${b.post}#scripture#${blockKey.slice(0, 24).replace(/\s+/g, '-')}`,
    directiveSegments: block,
    authorshipState: 'Q_QUOTED_SCRIPTURE',
    sourceType: 'Q_BODY',
    scriptureBlock: true,
    citation: b.citation ?? null,
  }

  // ── 2. the claims the same passage was scattered across ─────────────────────────────────────
  const pa = post.postAnalysis ?? (post.postAnalysis = {})
  if (Array.isArray(pa.claims)) {
    const before = pa.claims.length
    pa.claims = pa.claims.filter(c => !inside(blockKey, c))
    stats.claimsWithdrawn += before - pa.claims.length
  }
  if (Array.isArray(pa.claimSpans)) {
    const before = pa.claimSpans.length
    pa.claimSpans = pa.claimSpans.filter(c => !inside(blockKey, c))
    stats.claimSpansWithdrawn += before - pa.claimSpans.length
  }
  // AND THE PREDICTIONS. Two sentences inside these passages were certified Predictions — #35's
  // "whoever believes in him shall not perish but have eternal life" and #1712's "Because of these,
  // the wrath of God is coming." A passage that is one Directive cannot also be a row in
  // Predictions for exactly the reason it cannot be one in Claims: that is the sentence-break split
  // the ruling removes. Every prediction carries a Prediction↔assertion edge built from claimMeta,
  // so leaving the row while withdrawing its metadata would strand the edge — build-relationships
  // asserts the two are equal and would refuse, correctly.
  if (Array.isArray(pa.predictions)) {
    const before = pa.predictions.length
    pa.predictions = pa.predictions.filter(c => !inside(blockKey, c))
    stats.predictionsWithdrawn += before - pa.predictions.length
  }
  if (post.claimMeta && typeof post.claimMeta === 'object') {
    for (const k of Object.keys(post.claimMeta)) {
      if (inside(blockKey, k)) { delete post.claimMeta[k]; stats.claimMetaWithdrawn++ }
    }
  }
}

// ── 3. the citations, as certified entities ───────────────────────────────────────────────────
//
// Held to the same rule as every other entity row: the identity carries the posts it is named in
// and a mention count that equals what the drops render. Nothing is invented — a citation is
// registered only where the ruling says Q printed it AND the post text still contains it.
const citationPosts = new Map()   // citation -> Set(postNum)
/** Every occurrence this ruling ADDS, recorded for the ledger addendum written below. */
const additions = []
const register = (citation, postNum) => {
  if (!citation) return
  if (!citationPosts.has(citation)) citationPosts.set(citation, new Set())
  citationPosts.get(citation).add(postNum)
}
for (const b of ruling.blocks) register(b.citation, b.post)
for (const c of ruling.citationOnly ?? []) register(c.citation, c.post)

for (const [citation, postSet] of citationPosts) {
  for (const num of postSet) {
    const post = byNum.get(num)
    if (!post) { problems.push(`#${num}: no such post for citation ${citation}`); continue }
    if (!clean(String(post.text ?? '')).includes(citation)) {
      problems.push(`#${num}: citation ${JSON.stringify(citation)} is not in the post text`)
      continue
    }
    const pa = post.postAnalysis ?? (post.postAnalysis = {})
    pa.namedEntities = Array.isArray(pa.namedEntities) ? pa.namedEntities : []
    let index = pa.namedEntities.findIndex(e => norm(e) === norm(citation))
    if (index === -1) {
      index = pa.namedEntities.push(citation) - 1
      stats.citationOccurrences++
    }
    additions.push({ citation, postNum: num, index })
  }

  // The registry row. One mention per post: Q prints each label once where it prints it.
  const list = [...postSet].sort((a, b) => a - b)
  // `source` is a BUCKET, not prose: audit-cross-section.mjs sums the registry into core /
  // adjudicated tail / owner ruling and asserts the three add to the headline, so a row with a
  // source string of its own falls into none of them and the sum silently loses it. The story goes
  // in `provenance`, which is where every other owner-ruled row keeps it.
  const PROVENANCE = 'owner ruling 2026-08-23 — the scripture reference Q prints beside a quoted '
    + 'passage is an entity: "lets make the verse section ... an entity for now until i can subsect '
    + 'the post later."'
  const existing = entities.entities.find(e => e.canonical === citation)
  if (existing) {
    existing.posts = list
    existing.mentions = list.length
    existing.source = 'owner ruling'
    existing.provenance = PROVENANCE
    existing.type = CITATION_TYPE
  } else {
    entities.entities.push({
      canonical: citation,
      type: CITATION_TYPE,
      mentions: list.length,
      posts: list,
      aliases: [{ text: citation, n: null }],
      source: 'owner ruling',
      provenance: PROVENANCE,
      id: `qe-scripture-${citation.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      slug: citation.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    })
    stats.citationIdentities++
  }
}

// ── 5. the identity the label supersedes ──────────────────────────────────────────────────────
//
// "Ephesians" was a certified identity with exactly two occurrences, and BOTH are the word inside
// "Ephesians 6:10-18" — the archive holds no standalone mention of the book anywhere. Once the
// label is the entity, those two occurrences are the SAME characters counted twice under two
// identities, and the drop paints them as two touching spans: "Ephesians" then "6:10-18".
//
// So the bare identity is withdrawn by occurrence, not by matcher, and retired dormant — the
// project's standing treatment for an identity that loses its last mention. Its qe- id is reserved
// forever, so a genuine future mention of the book resolves back to it rather than minting a
// second identity for something the archive already named.
const SUPERSEDED = [{ canonical: 'Ephesians', by: 'Ephesians 6:10-18', posts: [1432, 1886] }]
const superseded = []
for (const sup of SUPERSEDED) {
  const row = entities.entities.find(e => e.canonical === sup.canonical)
  if (!row) continue   // already withdrawn on a previous run — idempotent
  // Refuse if it is carrying evidence this ruling does not account for.
  const extra = (row.posts ?? []).filter(n => !sup.posts.includes(n))
  if (extra.length) {
    problems.push(`#${sup.canonical}: superseding it would drop ${extra.length} occurrence(s) this ruling never examined (${extra.join(', ')})`)
    continue
  }
  for (const num of sup.posts) {
    const post = byNum.get(num)
    const pa = post?.postAnalysis
    if (!pa || !Array.isArray(pa.namedEntities)) continue
    pa.namedEntities = pa.namedEntities.filter(e => norm(e) !== norm(sup.canonical))
  }
  entities.entities = entities.entities.filter(e => e !== row)
  superseded.push({ id: row.id, canonical: row.canonical, type: row.type, slug: row.slug,
    mentions: row.mentions, posts: row.posts, supersededBy: sup.by })
}

stats.supersededIdentities = superseded.length
stats.supersededOccurrences = superseded.reduce((n, s) => n + (s.mentions ?? 0), 0)

// The ledger must lose them too, or the registry and the occurrence record disagree by exactly 2
// and build-entity-public-view.mjs refuses — the mirror of the addendum written above, and the same
// mechanism the earlier owner rulings use to withdraw an occurrence without editing the approval.
const LEDGER = path.join(ROOT, 'audit/occurrence-provenance-audit.json')
const ledgerRows = fs.existsSync(LEDGER) ? (JSON.parse(fs.readFileSync(LEDGER, 'utf8')).rows ?? []) : []
const withdrawals = superseded.flatMap(sup => ledgerRows
  .filter(r => r.entityId === sup.id && /^(keep|hold)/.test(r.proposedAction ?? ''))
  .map(r => ({
    occurrenceId: r.occurrenceId,
    postNum: r.postNum,
    index: r.index,
    alias: r.alias,
    entityId: r.entityId,
    canonical: r.canonical,
    originalProposedAction: r.proposedAction,
    reasonForWithdrawal: `superseded by the certified citation "${sup.supersededBy}" — this occurrence is the `
      + `book name INSIDE that label, never a standalone mention, so counting both records the same `
      + `characters under two identities and paints the label as two touching spans`,
    ownerRuling: 'Owner ruling 2026-08-23: the verse section is the entity.',
    proposedAction: 'remove-annotation',
    certifiedCountEffect: -1,
  })))
if (superseded.length && withdrawals.length !== stats.supersededOccurrences) {
  problems.push(`superseded identities carry ${stats.supersededOccurrences} mentions but the ledger holds `
    + `${withdrawals.length} matching rows — refusing rather than guessing which`)
}
if (superseded.length && !dry) {
  fs.writeFileSync(path.join(ROOT, 'audit/occurrence-withdrawals-scripture.json'), JSON.stringify({
    note: 'Occurrences withdrawn by the 2026-08-23 verse-block ruling, because the citation label now '
        + 'carries them. Read BESIDE audit/occurrence-provenance-audit.json, never merged into it.',
    ruledOn: '2026-08-23',
    writtenBy: 'scripts/apply-scripture-blocks.mjs',
    withdrawals,
  }, null, 2))
}

if (superseded.length) {
  const dormantPath = path.join(ROOT, 'audit/entity-dormant-registry.json')
  const dormant = JSON.parse(fs.readFileSync(dormantPath, 'utf8'))
  for (const sup of superseded) {
    if (dormant.entities.some(e => e.id === sup.id)) continue
    dormant.entities.push({ id: sup.id, canonical: sup.canonical, type: sup.type, slug: sup.slug })
  }
  dormant.entities.sort((a, b) => a.canonical.localeCompare(b.canonical))
  dormant.total = dormant.entities.length
  if (!dry) fs.writeFileSync(dormantPath, JSON.stringify(dormant, null, 1))
}
if (problems.length) {
  console.error('SCRIPTURE BLOCKS NOT APPLIED — nothing written:\n  ' + problems.join('\n  '))
  process.exit(1)
}

// ── 4. the ledger addendum ────────────────────────────────────────────
//
// audit/occurrence-provenance-audit.json keeps its 2026-08-17 bytes — it is the record of what the
// owner approved that day, and editing it would erase that. Post-approval WITHDRAWALS already live
// beside it in their own artifacts, subtracted at read time by build-entity-public-view.mjs. These
// are the mirror image: occurrences this later ruling ADDS, in the same row shape, added at read
// time by the same builder. Without it the ledger and the registry disagree by exactly these 12
// and the public view refuses to build — that guard working, not a number to relax.
const ENTITY_BY_CITATION = new Map(entities.entities.filter(e => citationPosts.has(e.canonical)).map(e => [e.canonical, e]))
const addendum = {
  note: 'Occurrences ADDED to the certified entity ledger after the 2026-08-17 approval, by owner '
      + 'ruling 2026-08-23: the scripture reference Q prints beside a quoted passage is an entity. '
      + 'Read beside audit/occurrence-provenance-audit.json, never merged into it.',
  ruledOn: '2026-08-23',
  ownerRuling: 'lets make the verse section example: – 1 Cor 13:4-13 and – Ephesians 6:10-18 an '
             + 'entity for now until i can subsect the post later.',
  writtenBy: 'scripts/apply-scripture-blocks.mjs',
  additions: additions
    .sort((a, b) => a.postNum - b.postNum || a.citation.localeCompare(b.citation))
    .map(a => ({
      occurrenceId: `#${a.postNum}:${a.index}`,
      postNum: a.postNum,
      index: a.index,
      alias: a.citation,
      entityId: ENTITY_BY_CITATION.get(a.citation)?.id ?? null,
      canonical: a.citation,
      entityType: CITATION_TYPE,
      category: 'visible_complete_token',
      evidence: { category: 'visible_complete_token', where: 'prose' },
      proposedAction: 'keep',
      certifiedCountEffect: 0,
    })),
}

const summary = [
  `blocks              ${stats.blocks}`,
  `directives written  ${stats.directivesWritten} (${stats.alreadyApplied} already present)`,
  `directives withdrawn ${stats.directivesWithdrawn}`,
  `claims withdrawn    ${stats.claimsWithdrawn} (+${stats.claimSpansWithdrawn} spans, ${stats.claimMetaWithdrawn} meta)`,
  `predictions withdrawn ${stats.predictionsWithdrawn}`,
  `citation entities   ${stats.citationIdentities} new identities, ${stats.citationOccurrences} occurrences added`,
  `superseded          ${stats.supersededIdentities ?? 0} identities retired dormant, ${stats.supersededOccurrences ?? 0} occurrences`,
].join('\n  ')

if (dry) {
  console.log('DRY RUN — nothing written\n  ' + summary)
  process.exit(0)
}

fs.writeFileSync(path.join(DATA, 'posts.json'), JSON.stringify(posts))
fs.writeFileSync(path.join(DATA, 'entities.json'), JSON.stringify(entities))
fs.writeFileSync(path.join(ROOT, 'audit/occurrence-additions-scripture.json'), JSON.stringify(addendum, null, 2))
console.log('  ' + summary)
