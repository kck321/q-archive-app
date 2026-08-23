// A TOOLTIP MUST NOT OUTLIVE THE IDENTITY IT DESCRIBES.
//
//   node scripts/prune-entity-hovers.mjs --apply
//
// entity-hovers.json carries a global synopsis per identity and per-post synopses beneath them —
// authored editorial text about real people. When an identity is retired the synopsis is left
// pointing at nothing, and the reader can still be shown a paragraph about someone the archive no
// longer says appears on that drop.
//
// Owner Ruling 3 retired 21 identities whose last mention it withdrew, and 26 synopses were left
// behind. audit-cross-section.mjs already asserted this from both sides — "no published synopsis
// may point at an entity that is no longer live (so a withdrawal cannot leave a tooltip behind)"
// — and had been failing on it since the ruling landed.
//
// WHAT IT DOES NOT DO. It writes no synopsis and revives none. The held/withdrawn buckets in the
// audit are untouched, the review allowlist is untouched, and an id that is merely PENDING a
// synopsis keeps its place in audit/entity-hover-pending.json. It removes text about identities
// that are gone, and records exactly which.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const apply = process.argv.includes('--apply')

const hoverPath = path.join(DATA, 'entity-hovers.json')
if (!fs.existsSync(hoverPath)) { console.log('  no entity-hovers.json — nothing to prune.\n'); process.exit(0) }
const hov = JSON.parse(fs.readFileSync(hoverPath, 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const live = new Set(entities.entities.map(e => e.id))
const byId = new Map(entities.entities.map(e => [e.id, e]))

const orphanGlobals = Object.keys(hov.global ?? {}).filter(id => !live.has(id))
const orphanPostIds = Object.keys(hov.byPost ?? {}).filter(id => !live.has(id))
if (!orphanGlobals.length && !orphanPostIds.length) {
  console.log(`  every hover already resolves to a live identity — ${Object.keys(hov.global ?? {}).length} global. Nothing written.\n`)
  process.exit(0)
}

// What this particular run is for. Recorded per run so the cumulative file below says WHY each
// batch of synopses went, not merely that they did.
const RUN_DATE = '2026-08-23'
const RUN_WHY = 'The verse-block ruling retired "Ephesians": both its occurrences were the book name '
  + 'inside "Ephesians 6:10-18", which is now the certified identity.'

const removed = { global: [], byPost: [] }
const next = JSON.parse(JSON.stringify(hov))
for (const id of orphanGlobals) {
  removed.global.push({ id, synopsis: String(hov.global[id]?.text ?? hov.global[id] ?? '').slice(0, 160) })
  delete next.global[id]
}
let postSynopsesRemoved = 0
for (const id of orphanPostIds) {
  const posts = Object.keys(hov.byPost[id] ?? {})
  postSynopsesRemoved += posts.length
  removed.byPost.push({ id, posts: posts.map(Number).sort((a, b) => a - b) })
  delete next.byPost[id]
}

next.totals = {
  ...next.totals,
  entitiesWithGlobal: Object.keys(next.global ?? {}).length,
  postSynopses: Object.values(next.byPost ?? {}).reduce((n, m) => n + Object.keys(m).length, 0),
  entitiesWithPostSynopses: Object.keys(next.byPost ?? {}).length,
}

// A LIVE IDENTITY MUST NEVER LOSE ITS SYNOPSIS HERE. Only ids absent from the registry go.
const lostLive = Object.keys(hov.global ?? {}).filter(id => live.has(id) && !next.global[id])
if (lostLive.length) {
  console.error(`\n  X ${lostLive.length} live identit(ies) would lose a synopsis. Refusing.\n`)
  process.exit(1)
}

console.log('ENTITY HOVERS PRUNED TO LIVE IDENTITIES')
console.log(`  global synopses   : ${Object.keys(hov.global ?? {}).length} -> ${next.totals.entitiesWithGlobal}   (${orphanGlobals.length} orphaned)`)
console.log(`  per-post synopses : ${hov.totals?.postSynopses ?? '?'} -> ${next.totals.postSynopses}   (${postSynopsesRemoved} on ${orphanPostIds.length} retired identities)`)

// THE RECORD IS CUMULATIVE, and it has to be.
//
// This file writes itself each time something is pruned, and it used to write ONLY the current
// run — so the first later retirement replaced the 2026-08-22 record of 26 global synopses and 3
// per-post ones with its own. The loss was invisible while nothing needed pruning, because the
// early exit above leaves the file untouched when there are no orphans; the 2026-08-23 verse-block
// ruling retired one identity and the earlier history went with it, which is how it was found.
//
// A file whose stated purpose is "nothing is lost" must not lose anything. New prunings are merged
// into what is already recorded, deduplicated by identity, and the totals are recomputed from the
// merged set — so hover-reconciles keeps balancing across every ruling instead of only the last.
const prunedPath = path.join(OUT, 'entity-hover-pruned.json')
const prior = fs.existsSync(prunedPath) ? JSON.parse(fs.readFileSync(prunedPath, 'utf8')) : { removed: { global: [], byPost: [] } }
const priorGlobal = prior.removed?.global ?? []
const priorByPost = prior.removed?.byPost ?? []
const mergedGlobal = [...priorGlobal, ...removed.global.filter(g => !priorGlobal.some(x => x.id === g.id))]
const mergedByPost = [...priorByPost, ...removed.byPost.filter(g => !priorByPost.some(x => x.id === g.id))]
const priorRuns = prior.runs ?? (prior.prunedOn ? [{ prunedOn: prior.prunedOn, why: prior.why,
  globalRemoved: prior.globalRemoved ?? priorGlobal.length,
  postSynopsesRemoved: prior.postSynopsesRemoved ?? priorByPost.reduce((n, r) => n + r.posts.length, 0) }] : [])

fs.writeFileSync(prunedPath, JSON.stringify({
  note: 'Synopses removed because the identity they describe is no longer in the registry. The text '
    + 'is kept here so nothing is lost: restoring an identity can restore its synopsis verbatim. '
    + 'CUMULATIVE across every ruling that has retired an identity — see runs[].',
  why: 'A tooltip must not outlive the identity it describes.',
  runs: [...priorRuns, { prunedOn: RUN_DATE, why: RUN_WHY, globalRemoved: removed.global.length, postSynopsesRemoved }]
    .filter((r, i, a) => a.findIndex(x => x.prunedOn === r.prunedOn) === i),
  globalRemoved: mergedGlobal.length,
  postSynopsesRemoved: mergedByPost.reduce((n, r) => n + r.posts.length, 0),
  removed: { global: mergedGlobal, byPost: mergedByPost },
}, null, 2) + '\n')

if (!apply) { console.log('\n  dry run — nothing written. Pass --apply.\n'); process.exit(0) }
fs.writeFileSync(hoverPath, JSON.stringify(next))
console.log('\n  wrote public/data/entity-hovers.json, audit/entity-hover-pruned.json\n')
