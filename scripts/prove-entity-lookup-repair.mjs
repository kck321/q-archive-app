// PHASE B1A — proof, run BEFORE the repair is applied.
//
//   node scripts/prove-entity-lookup-repair.mjs
//
// Builds the entity binding twice over the SAME bundle — once with the canonical-keyed lookup the
// ledger uses today, once with lib/entityForms.mjs — and diffs them record by record.
//
// The claim being proved is narrow and has two halves, and the second half is the one that matters:
//
//   1  the repair resolves the expected population, and
//   2  it changes NOTHING that already resolved — same identity, same offsets, same matched text.
//
// A lookup repair that also moves an existing entity is not a lookup repair.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { buildEntityForms } from './lib/entityForms.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const entitiesDoc = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))

// -- the lookup as it stands today, reproduced exactly from build-occurrence-ledger.mjs ----------
const oldMap = new Map()
for (const e of entitiesDoc.entities ?? []) {
  const forms = [e.canonical, ...(e.aliases ?? []).map(a => a.text)].filter(Boolean)
  oldMap.set(String(e.canonical).toLowerCase(), [...new Set(forms)])
}
const oldForms = t => (oldMap.get(String(t).toLowerCase()) ?? []).slice().sort((a, b) => b.length - a.length)

const repaired = buildEntityForms(entitiesDoc)

/** Bind one post's namedEntities exactly the way the ledger does, under a given form lookup. */
function bind(p, formsFor) {
  const body = runtimeText(p.text ?? '')
  const taken = new Map()
  const bound = [], unlocated = []
  for (const raw of p.postAnalysis?.namedEntities ?? []) {
    const text = String(raw ?? '')
    if (!text.trim()) continue
    let hits = occurrencesOfSpan(p.text, text)
    let via = hits.length ? text : null
    if (!hits.length) {
      for (const f of formsFor(text)) {
        const h = occurrencesOfSpan(p.text, f)
        if (h.length) { hits = h; via = f; break }
      }
    }
    if (!hits.length) { unlocated.push(text); continue }
    const usedKey = `namedEntities|${text}`
    const already = taken.get(usedKey) ?? 0
    const [start, end] = hits[Math.min(already, hits.length - 1)]
    taken.set(usedKey, already + 1)
    bound.push({ key: `${p.postNum}|namedEntities|${start}|${end}`, identity: text, via,
      matched: body.slice(start, end) })
  }
  return { bound, unlocated }
}

let oldBound = 0, newBound = 0, oldUnlocated = 0, newUnlocated = 0
const added = [], changed = [], stillUnlocated = []
for (const p of posts) {
  const a = bind(p, oldForms)
  const b = bind(p, repaired.formsFor)
  oldBound += a.bound.length; newBound += b.bound.length
  oldUnlocated += a.unlocated.length; newUnlocated += b.unlocated.length
  stillUnlocated.push(...b.unlocated.map(t => ({ postNum: p.postNum, identity: t })))

  // Records are compared position-by-position: both runs walk namedEntities in the same order, so
  // the Nth bound record of one is the Nth of the other unless the repair changed something.
  const byIdentityOld = new Map()
  for (const r of a.bound) {
    const k = `${r.identity}#${(byIdentityOld.get(r.identity) ?? 0)}`
    byIdentityOld.set(r.identity, (byIdentityOld.get(r.identity) ?? 0) + 1)
    byIdentityOld.set(k, r)
  }
  const seen = new Map()
  for (const r of b.bound) {
    const n = seen.get(r.identity) ?? 0
    seen.set(r.identity, n + 1)
    const prior = byIdentityOld.get(`${r.identity}#${n}`)
    if (!prior) { added.push({ postNum: p.postNum, ...r }); continue }
    if (prior.key !== r.key || prior.matched !== r.matched || prior.via !== r.via) {
      changed.push({ postNum: p.postNum, identity: r.identity,
        before: { key: prior.key, via: prior.via, matched: prior.matched },
        after: { key: r.key, via: r.via, matched: r.matched } })
    }
  }
}

const tally = (list, f) => {
  const t = {}
  for (const x of list) { const k = f(x); t[k] = (t[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]))
}

const doc = {
  note: 'Phase B1A proof. Two bindings over one bundle: canonical-keyed vs group-aware. No data written.',
  before: { boundRecords: oldBound, unlocated: oldUnlocated },
  after: { boundRecords: newBound, unlocated: newUnlocated },
  newlyResolved: added.length,
  existingRecordsChanged: changed.length,
  changedExamples: changed.slice(0, 20),
  newlyResolvedByIdentity: Object.entries(tally(added, r => `${r.identity} -> ${r.via}`)).slice(0, 25),
  everyNewMatchIsExactCase: added.every(r => r.matched === r.via),
  matchedDiffersFromIdentity: added.filter(r => r.matched !== r.identity).length,
  stillUnlocatedCount: stillUnlocated.length,
  stillUnlocatedByIdentity: Object.entries(tally(stillUnlocated, r => r.identity)).slice(0, 25),
}
fs.writeFileSync(path.join(OUT, 'step3b1-b1a-proof.json'), JSON.stringify({ ...doc, added, changed, stillUnlocated }, null, 1))

console.log('ENTITY BINDING, SAME BUNDLE, TWO LOOKUPS')
console.log(`  canonical-keyed (today) : ${oldBound.toLocaleString()} bound, ${oldUnlocated} unlocated`)
console.log(`  group-aware (repaired)  : ${newBound.toLocaleString()} bound, ${newUnlocated} unlocated`)
console.log()
console.log(`  newly resolved            : ${added.length}`)
console.log(`  EXISTING RECORDS CHANGED  : ${changed.length}   <-- must be 0`)
console.log(`  every new match exact-case : ${doc.everyNewMatchIsExactCase}`)
console.log(`  new matches whose spelling differs from the identity: ${doc.matchedDiffersFromIdentity}`)
console.log('\ntop newly resolved:')
for (const [k, v] of doc.newlyResolvedByIdentity.slice(0, 12)) console.log(`  ${String(v).padStart(3)}  ${k}`)
console.log('\nstill unlocated after the repair:', doc.stillUnlocatedCount)
for (const [k, v] of doc.stillUnlocatedByIdentity.slice(0, 10)) console.log(`  ${String(v).padStart(3)}  ${k}`)
console.log('\n-> audit/step3b1-b1a-proof.json')
if (changed.length) { console.error('\n[X] the repair moved records that already resolved — not a lookup repair.'); process.exit(1) }
