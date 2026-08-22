// THE REGISTRY FOLLOWS THE RECORDS THAT WERE ADJUDICATED AWAY.
//
//   node scripts/reconcile-entity-registry.mjs --apply
//
// apply-step3b1.mjs collapses duplicate entity records — several records over the SAME characters
// for the SAME identity, which is one occurrence recorded more than once, not a repeat Q wrote.
// #111 carried "Huma" five times over one word; #1318 carried "Sessions" six times over one.
// It removed 99 such records and entities.json never heard about it, so the registry went on
// counting 8,920 mentions while the drops rendered 8,821.
//
// Invariant 12 exists for exactly this and said so in its own comment — "a recount must REPLACE
// render entries, not add to them. The rendered cache and the certified metric disagreed by 62
// when it did not." It had been failing at 99 since the merges landed, unseen only because
// audit-cross-section.mjs could not run at all while Emphasis was half-retired.
//
// WHICH NUMBER IS RIGHT. The rendered one. "Mentions" counts occurrences, and two records over one
// span are not two occurrences — the archive's own counting rules say a repeat is a repeat INSIDE
// a post, meaning a second place Q wrote the name. So the registry comes down to meet the records.
//
// THIS IS NOT A RECOUNT FROM THE RENDER. It does not re-scan posts.json and rebuild the entity
// set — that inversion is what re-deriving on a built bundle does, and it is forbidden for good
// reason. It applies the EXACT decrements the adjudication recorded: one per removed record, named
// by the identity that record carried, from audit/step3b1-metadata-transfers.json. Then it asserts
// the two totals agree, and refuses to write if they do not.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEntityForms } from './lib/entityForms.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const apply = process.argv.includes('--apply')

const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const transfers = JSON.parse(fs.readFileSync(path.join(OUT, 'step3b1-metadata-transfers.json'), 'utf8')).transfers ?? []

const rendered = posts.reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).length, 0)
const before = entities.totals.mentions

// Already reconciled? Then this is a re-run on this step's own output and there is nothing to do.
if (rendered === before) {
  console.log(`  registry already agrees with the records — ${before} mentions. Nothing written.\n`)
  process.exit(0)
}

const forms = buildEntityForms(entities)
const byCanonical = new Map(entities.entities.map(e => [e.canonical, e]))
const removed = transfers.filter(t => t.kind === 'namedEntities')

const drops = new Map()
// PER DROP AS WELL AS PER IDENTITY. The public view badges each drop with how many times an entity
// is named there, and that badge is read off the ledger — which still holds the pre-collapse rows.
// Without the per-post breakdown the badges would keep saying United States x525 on a row now
// certified for 519, which is the same disagreement one level down.
const dropsByPost = new Map()
const problems = []
for (const t of removed) {
  const canonical = t.canonical ?? forms.canonicalFor(t.identity ?? '')
  if (!canonical) { problems.push(`${t.actionId}: withdrawn record ${JSON.stringify(t.identity ?? t.from)} resolves to no identity`); continue }
  drops.set(canonical, (drops.get(canonical) ?? 0) + 1)
  const postNum = Number(String(t.from ?? String.fromCharCode(39)+String.fromCharCode(39)).split(String.fromCharCode(124))[0])
  if (Number.isFinite(postNum)) {
    const k = canonical + String.fromCharCode(124) + postNum
    dropsByPost.set(k, (dropsByPost.get(k) ?? 0) + 1)
  }
}
if (problems.length) {
  console.error(`\n  X ${problems.length} withdrawn record(s) name no identity:`)
  for (const m of problems.slice(0, 10)) console.error('     ' + m)
  process.exit(1)
}

const next = JSON.parse(JSON.stringify(entities))
const nextBy = new Map(next.entities.map(e => [e.canonical, e]))
const applied = []
for (const [canonical, n] of drops) {
  const e = nextBy.get(canonical)
  if (!e) { problems.push(`${canonical}: no longer in the registry`); continue }
  if (e.mentions - n < 0) { problems.push(`${canonical}: ${n} withdrawn against ${e.mentions} certified`); continue }
  applied.push({ canonical, mentionsBefore: e.mentions, withdrawn: n, mentionsAfter: e.mentions - n })
  e.mentions -= n
}
if (problems.length) {
  console.error(`\n  X ${problems.length} decrement(s) do not fit the registry:`)
  for (const m of problems.slice(0, 10)) console.error('     ' + m)
  process.exit(1)
}

// A DUPLICATE COLLAPSE MUST NEVER TAKE THE LAST MENTION OF AN IDENTITY. Collapsing several records
// over one span leaves one, so every identity that had a duplicate still has that one.
const emptied = applied.filter(a => a.mentionsAfter === 0)
if (emptied.length) {
  console.error(`\n  X ${emptied.length} identit(ies) would lose every mention to a duplicate collapse, which cannot happen:`)
  for (const a of emptied) console.error(`     ${a.canonical}`)
  process.exit(1)
}

const after = next.entities.reduce((n, e) => n + e.mentions, 0)
next.totals = { ...next.totals, mentions: after }

if (after !== rendered) {
  console.error(`\n  X the decrements bring the registry to ${after} against ${rendered} rendered records. Refusing to write.\n`)
  process.exit(1)
}

console.log('ENTITY REGISTRY RECONCILED TO THE RECORDS')
console.log(`  duplicate records collapsed by Step 3B-1 : ${removed.length}`)
console.log(`  identities affected                      : ${applied.length}`)
console.log(`  registry mentions                        : ${before} -> ${after}`)
console.log(`  rendered postAnalysis entries            : ${rendered}`)
for (const a of applied.slice(0, 8).sort((x, y) => y.withdrawn - x.withdrawn)) console.log(`     ${a.canonical.padEnd(28)} ${a.mentionsBefore} -> ${a.mentionsAfter}`)

fs.writeFileSync(path.join(OUT, 'entity-registry-reconciliation.json'), JSON.stringify({
  note: 'The registry decrements that follow Step 3B-1\'s duplicate-record collapse. One per removed '
    + 'record, named by the identity that record carried. Not a recount from the render.',
  duplicateRecordsRemoved: removed.length,
  mentionsBefore: before, mentionsAfter: after, renderedRecords: rendered,
  perIdentity: applied.sort((a, b) => b.withdrawn - a.withdrawn),
  perIdentityAndPost: Object.fromEntries([...dropsByPost.entries()].sort()),
}, null, 2) + '\n')

if (!apply) { console.log('\n  dry run — nothing written. Pass --apply.\n'); process.exit(0) }
fs.writeFileSync(path.join(DATA, 'entities.json'), JSON.stringify(next))
console.log('\n  wrote public/data/entities.json, audit/entity-registry-reconciliation.json\n')
