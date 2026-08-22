// STEP 3B-1 — the first deterministic conflict batch, PROPOSED. Nothing is applied.
//
//   node scripts/propose-step3b1-conflict-batch.mjs
//
// Reads audit/step3b1-conflict-taxonomy.json and narrows lane A to the rows that can be resolved
// mechanically WITHOUT a new judgement, then names every row it refuses and why.
//
// The narrowing exists because "resolve the entity lookup" is not one decision. Locating an
// identity case-insensitively is right for HUSSEIN/SESSIONS/GOD and wrong for FR, NY and CA:
// invariant 4 of PROJECT_CONTEXT is that substring matching makes "US" match "rUSsia", "mUSt" and
// "becaUSe", and it has been bitten in five separate places. So the batch is gated on:
//
//   1  the located form sits at a WORD BOUNDARY, with "+" counted as a word character (invariant 6)
//   2  exact-case and case-insensitive agree on WHICH occurrence to bind, or only one exists
//   3  a form of 3 characters or fewer must match in EXACT case — a two-letter country code
//      matched case-insensitively is the invariant-4 defect wearing a new hat
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const tax = JSON.parse(fs.readFileSync(path.join(OUT, 'step3b1-conflict-taxonomy.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

const isWordChar = ch => ch !== undefined && /[A-Za-z0-9+]/.test(ch)
/** First WORD-BOUNDED occurrence of `needle`, case-insensitively. -1 if none. */
function boundedIndexCI(hay, needle) {
  const h = hay.toLowerCase(), n = String(needle).toLowerCase()
  if (!n) return -1
  for (let from = 0; ;) {
    const at = h.indexOf(n, from)
    if (at < 0) return -1
    if (!isWordChar(hay[at - 1]) && !isWordChar(hay[at + n.length])) return at
    from = at + 1
  }
}
function boundedIndexExact(hay, needle) {
  const n = String(needle)
  if (!n) return -1
  for (let from = 0; ;) {
    const at = hay.indexOf(n, from)
    if (at < 0) return -1
    if (!isWordChar(hay[at - 1]) && !isWordChar(hay[at + n.length])) return at
    from = at + 1
  }
}

const ENTITY_LANE_A = new Set(['ALIAS_KEYED_IDENTITY_LOOKUP_MISS', 'CASE_VARIANT_NOT_REGISTERED'])
const accepted = [], refused = []

for (const r of tax.rows) {
  if (!ENTITY_LANE_A.has(r.subtype)) continue
  const p = byNum.get(r.postNum)
  const form = r.locatedUnder ?? r.locatedCaseInsensitivelyUnder
  const body = runtimeText(p?.text ?? '')
  const reject = why => refused.push({ ...r, form, refusedBecause: why })

  if (!p || !form) { reject('no post or no located form'); continue }
  const ci = boundedIndexCI(body, form)
  const ex = boundedIndexExact(body, form)
  if (ci < 0) { reject('the only match is mid-word — invariant 4 forbids it'); continue }
  if (String(form).length <= 3 && ex < 0) {
    reject(`form "${form}" is <= 3 characters and does not appear in exact case; a short form matched case-insensitively is the invariant-4 defect`)
    continue
  }
  if (ex >= 0 && ex !== ci) { reject('exact-case and case-insensitive bind different offsets — the occurrence ordinal needs a stated rule'); continue }
  accepted.push({ conflictId: r.conflictId, postNum: r.postNum, identity: r.identity, form,
    subtype: r.subtype, start: ex >= 0 ? ex : ci, end: (ex >= 0 ? ex : ci) + String(form).length,
    matchedText: body.slice(ex >= 0 ? ex : ci, (ex >= 0 ? ex : ci) + String(form).length),
    exactCase: ex >= 0 })
}

const tally = (list, f) => {
  const t = {}
  for (const x of list) { const k = f(x); t[k] = (t[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]))
}

const doc = {
  note: 'PROPOSED first deterministic conflict batch. Nothing applied. Requires an owner ruling before it runs.',
  sourceTaxonomy: 'audit/step3b1-conflict-taxonomy.json',
  candidateRows: accepted.length + refused.length,
  accepted: accepted.length,
  refused: refused.length,
  acceptedBySubtype: tally(accepted, a => a.subtype),
  acceptedByExactCase: tally(accepted, a => a.exactCase ? 'exact-case match' : 'case-insensitive match'),
  refusedByReason: tally(refused, r => r.refusedBecause),
  countEffect: {
    layer: 'inline',
    note: 'These are namedEntities records. They add INLINE-layer occurrences and move no primary/headline total. They DO move the certified entity mention count, which is asserted in lib/contracts.mjs — that constant needs an owner-recorded reason before this runs.',
    entityRecordsAdded: accepted.length,
  },
  topIdentities: Object.entries(tally(accepted, a => `${a.identity} -> ${a.form}`)).slice(0, 20),
  acceptedRows: accepted,
  refusedRows: refused.map(r => ({ conflictId: r.conflictId, postNum: r.postNum, identity: r.identity, form: r.form, refusedBecause: r.refusedBecause })),
}
fs.writeFileSync(path.join(OUT, 'step3b1-conflict-batch-1-proposed.json'), JSON.stringify(doc, null, 1))

console.log(`entity-lookup candidates : ${doc.candidateRows}`)
console.log(`  ACCEPTED into batch 1  : ${doc.accepted}`)
console.log(`  refused, needs a rule  : ${doc.refused}`)
console.log('\naccepted by subtype :', JSON.stringify(doc.acceptedBySubtype))
console.log('accepted by match   :', JSON.stringify(doc.acceptedByExactCase))
console.log('\nrefused because:')
for (const [k, v] of Object.entries(doc.refusedByReason)) console.log(`  ${String(v).padStart(3)}  ${k}`)
console.log('\ntop identities in the batch:')
for (const [k, v] of doc.topIdentities.slice(0, 12)) console.log(`  ${String(v).padStart(3)}  ${k}`)
console.log('\n-> audit/step3b1-conflict-batch-1-proposed.json')
