// The URL cleanup applier. DRY RUN ONLY — there is deliberately no --apply.
//
//   node scripts/apply-url-cleanup.mjs
//
// Builds the row-level migration plan and PROVES the resulting totals by simulating the change
// against copies of the certified artifacts. Nothing on disk under public/data is touched.
//
// WHY THE TOTALS ARE COMPUTED AND NOT DECLARED. The provisional target — 9,327 mentions, 1,289
// records, 12 source-only, 120 dormant — came out of an analysis script. Writing those numbers
// into the applier as expectations would make the applier agree with the analysis by construction,
// and the two would then be one opinion wearing two hats. So the applier recomputes everything
// from the plan and the artifacts, and the analysis figures are compared against the result at the
// end. A disagreement is a finding, not a rounding error.
//
// THE THREE THINGS THIS MUST NEVER DO
//   - act on an ambiguous record
//   - remove a prose occurrence because the same entity also appears in a URL in that drop
//   - proceed when a before-state does not match exactly
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const read = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))

const proposal = read(OUT, 'url-cleanup-proposal.json')
const entities = read(DATA, 'entities.json')
const posts = read(DATA, 'posts.json')
const hovers = read(DATA, 'entity-hovers.json')
const byId = new Map(entities.entities.map(e => [e.id, e]))
const postByNum = new Map(posts.map(p => [p.postNum, p]))

console.log('\nURL CLEANUP APPLIER — DRY RUN\n')

// ── 1. the plan ─────────────────────────────────────────────────────────────
// One row per action, with the before-state it expects to find. The applier that eventually
// writes will refuse to act if any before-state has moved, which is what makes it safe to
// prepare a plan now and execute it later.
const plan = []
let seq = 0
for (const r of proposal.rows) {
  const e = byId.get(r.entityId)
  const post = postByNum.get(r.postNum)
  if (!e || !post) { console.error(`plan: missing entity or post for ${r.entityId} #${r.postNum}`); process.exit(1) }
  const named = post.postAnalysis?.namedEntities ?? []
  const aliasesToRemove = (r.perAlias ?? []).filter(a => !a.inProse && a.inUrl)

  const id = `url-${String(++seq).padStart(4, '0')}-${r.postNum}-${r.entityId.slice(3, 9)}`
  plan.push({
    actionId: id,
    action: r.action,
    postNum: r.postNum,
    entityId: r.entityId,
    canonical: e.canonical,
    entityType: e.type,
    occurrenceAliases: aliasesToRemove.map(a => a.alias),
    exactSpans: aliasesToRemove.map(a => ({ alias: a.alias, certifiedEntries: a.certifiedEntries })),
    urls: r.urls,
    urlComponent: r.matchPart,
    before: {
      // Everything the writing applier will re-check before it touches anything.
      entityMentions: e.mentions,
      namedEntitiesInPost: named.length,
      entriesForThisEntity: r.certifiedOccurrencesInPost,
      postTextSha: createHash('sha256').update(String(post.text ?? '')).digest('hex').slice(0, 16),
    },
    after: {
      entriesForThisEntity: r.occurrencesKept,
      entityMentions: e.mentions - (r.action === 'review' ? 0 : r.occurrencesToRemove),
    },
    occurrencesRemoved: r.action === 'review' ? 0 : r.occurrencesToRemove,
    relationshipEffect: r.relationshipEffect,
    hoverEffect: r.action === 'review' ? 'unchanged — stays in private review'
      : r.occurrencesKept > 0 ? 'post-specific hover kept; the drop still carries a prose mention'
        : 'post-specific hover withdrawn with its last occurrence in this drop',
    linkedSourceCreated: r.action === 'migrate-to-linked-source',
    confidence: r.action === 'review' ? 'none — deliberately undecided' : 'high',
    justification: r.justification,
    reversal: `Restore ${r.occurrencesToRemove} entry/entries ${JSON.stringify(aliasesToRemove.map(a => a.alias))} to postAnalysis.namedEntities in #${r.postNum} and add ${r.occurrencesToRemove} to ${e.canonical}. Recorded in audit/url-cleanup-reversal.json.`,
  })
}
console.log(`  plan rows            : ${plan.length}`)

// ── 2. refusals ─────────────────────────────────────────────────────────────
const refusals = []
for (const p of plan) {
  if (p.action === 'review') continue
  if (!p.occurrenceAliases.length) refusals.push(`${p.actionId}: nothing to remove`)
  if (p.occurrencesRemoved <= 0) refusals.push(`${p.actionId}: non-positive removal`)
  // The rule that protects Q's own words.
  const r = proposal.rows.find(x => x.postNum === p.postNum && x.entityId === p.entityId)
  if (r.alsoInProse && p.occurrencesRemoved >= r.certifiedOccurrencesInPost) {
    refusals.push(`${p.actionId}: would remove every occurrence in a drop where the entity also appears in prose`)
  }
}
const ambiguousActed = plan.filter(p => p.action !== 'review' && proposal.rows.find(r => r.postNum === p.postNum && r.entityId === p.entityId)?.classification === 'ambiguous_url_reference')
if (ambiguousActed.length) refusals.push(`${ambiguousActed.length} ambiguous record(s) have a non-review action`)
console.log(`  refusals             : ${refusals.length}`)
for (const r of refusals.slice(0, 5)) console.log(`     ${r}`)

// ── 3. simulate, and PROVE the totals ───────────────────────────────────────
// Deep copies. Nothing here writes to public/data.
const simEntities = JSON.parse(JSON.stringify(entities))
const simById = new Map(simEntities.entities.map(e => [e.id, e]))
const simNamed = new Map(posts.map(p => [p.postNum, [...(p.postAnalysis?.namedEntities ?? [])]]))

for (const p of plan) {
  if (p.action === 'review') continue
  const e = simById.get(p.entityId)
  const list = simNamed.get(p.postNum)
  for (const { alias, certifiedEntries } of p.exactSpans) {
    let removed = 0
    for (let i = list.length - 1; i >= 0 && removed < certifiedEntries; i--) {
      if (list[i].toLowerCase() === alias.toLowerCase()) { list.splice(i, 1); removed++ }
    }
    if (removed !== certifiedEntries) { console.error(`${p.actionId}: expected to remove ${certifiedEntries} "${alias}", removed ${removed}`); process.exit(1) }
    e.mentions -= removed
    if (!list.some(t => [...e.aliases.map(a => a.text), e.canonical].some(a => a.toLowerCase() === t.toLowerCase()))) {
      e.posts = e.posts.filter(n => n !== p.postNum)
    }
  }
}

const mentionsAfter = simEntities.entities.reduce((n, e) => n + e.mentions, 0)
const renderedAfter = [...simNamed.values()].reduce((n, l) => n + l.length, 0)
const zeroed = simEntities.entities.filter(e => e.mentions === 0)

// Which of the zeroed keep a linked-source reference — those stay active as source_only.
const sourceBoundIds = new Set(proposal.linkedSources.filter(l => l.entityId).map(l => l.entityId))
const sourceOnly = zeroed.filter(e => sourceBoundIds.has(e.id))
const dormant = zeroed.filter(e => !sourceBoundIds.has(e.id))
const publicRecords = simEntities.entities.length - dormant.length

console.log(`\n  PROVEN BY SIMULATION`)
console.log(`    mentions        ${entities.totals.mentions} -> ${mentionsAfter}   (-${entities.totals.mentions - mentionsAfter})`)
console.log(`    rendered        ${[...postByNum.values()].reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).length, 0)} -> ${renderedAfter}`)
console.log(`    entity records  ${entities.entities.length} -> ${publicRecords}`)
console.log(`    zero-mention    ${zeroed.length}  =  ${sourceOnly.length} source_only + ${dormant.length} dormant`)
console.log(`    headline == rendered: ${mentionsAfter === renderedAfter}`)

// ── 4. compare against the analysis, rather than trusting either ────────────
const target = { mentions: 9327, records: 1289, sourceOnly: 12, dormant: 120, linkedSources: 100 }
const got = { mentions: mentionsAfter, records: publicRecords, sourceOnly: sourceOnly.length, dormant: dormant.length, linkedSources: proposal.linkedSources.length }
console.log(`\n  AGAINST THE PROVISIONAL TARGET`)
let mismatch = 0
for (const k of Object.keys(target)) {
  const ok = target[k] === got[k]
  if (!ok) mismatch++
  console.log(`    ${ok ? 'MATCH' : 'DIFFER'}  ${k.padEnd(14)} target ${String(target[k]).padStart(6)}   proven ${String(got[k]).padStart(6)}`)
}

// ── 5. write the plan and the reversal contract ─────────────────────────────
fs.writeFileSync(path.join(OUT, 'url-cleanup-plan.json'), JSON.stringify({
  note: 'Row-level migration plan for the URL-derived entity cleanup. DRY RUN — not applied. Every row carries the before-state the writing applier must re-verify before touching anything.',
  generatedOn: '2026-08-16',
  policy: 'audit/url-derived-entity-policy.json',
  idempotent: 'Each row names an exact entity/post/alias triple and a count. Re-running against an already-migrated bundle finds the entries absent, which fails the before-state check rather than removing more.',
  reversible: 'audit/url-cleanup-reversal.json restores every removed entry with its post, alias and count.',
  refusals,
  proven: got,
  provisionalTarget: target,
  agreesWithTarget: mismatch === 0,
  rows: plan,
}, null, 1))

fs.writeFileSync(path.join(OUT, 'url-cleanup-reversal.json'), JSON.stringify({
  note: 'Reversal contract for the URL cleanup. Restoring these entries and their counts returns the archive to the pre-cleanup state exactly. Written before the change, not after it.',
  restores: plan.filter(p => p.action !== 'review').map(p => ({
    actionId: p.actionId, postNum: p.postNum, entityId: p.entityId, canonical: p.canonical,
    entries: p.exactSpans, mentionsToRestore: p.occurrencesRemoved,
  })),
}, null, 1))

console.log(`\n  wrote audit/url-cleanup-plan.json and audit/url-cleanup-reversal.json`)
console.log(`\n  DRY RUN — public/data untouched. There is no --apply.\n`)
process.exit(refusals.length ? 1 : 0)
