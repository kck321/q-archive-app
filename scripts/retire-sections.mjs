// RETIRED SECTIONS — Emphasis, Q Conclusions, Checkable Claims.
//
//   node scripts/retire-sections.mjs --apply
//
// OWNER RULING, 2026-08-21: "get rid of the emphasis category ... I would like to get rid of
// everything associated with it so we can get the best audit we can get. I also have to get rid of
// any Q Conclusions and Checkable Claims data/highlights as well."
//
// The three had already been retired as VIEWS — Conclusions on 2026-08-14, Checkable Claims on
// 2026-08-15, and the emphasis painting was commented out of postHighlight.tsx — but the records
// survived underneath "for provenance". That residue is exactly what would poison the residual
// census: a sentence carrying only an emphasis span reads as highlighted to any coverage scan while
// the reader sees nothing. So the data goes too.
//
// WHY THIS IS A CHAIN STEP AND NOT A ONE-OFF EDIT. apply-claims.mjs rebuilds impliedConclusions and
// verificationHooks from audit/claims-final.json on every run, and detect/audit/apply-emphasis
// rebuild emphasis. Delete the fields by hand and the next export or rebuild-bundle puts all of it
// back, with every total still reconciling — the exact failure shape lib/chainSteps.mjs was written
// to prevent. The emphasis steps are removed from the chain and this step strips what the claim
// steps still produce, running after the last of them.
//
// WHAT IS NOT TOUCHED. Claims themselves. All 966 conclusions and 1,926 checkable claims were
// ALREADY certified Claims carrying an attribute — that was the stated basis of both 2026-08
// rulings — so retiring the attribute removes a second view, never a claim. The Claims count does
// not move, and this step asserts that rather than trusting it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const apply = process.argv.includes('--apply')

/** postAnalysis arrays that ARE the retired sections. */
const RETIRED_ARRAYS = ['emphasis', 'impliedConclusions', 'conclusionSpans', 'verificationHooks', 'checkableSpans']
/** claimMeta attributes that exist only to drive the retired views. */
const RETIRED_ATTRS = ['checkable', 'isConclusion']

const postsPath = path.join(DATA, 'posts.json')
const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'))

const before = { claims: 0, claimSpans: 0, predictions: 0, predictionSpans: 0 }
const removed = Object.fromEntries(RETIRED_ARRAYS.map(k => [k, 0]))
const attrsRemoved = Object.fromEntries(RETIRED_ATTRS.map(k => [k, 0]))
let postsTouched = 0, metaTouched = 0

for (const p of posts) {
  const a = p.postAnalysis ?? {}
  for (const k of Object.keys(before)) before[k] += (a[k] ?? []).length
  let touched = false
  for (const k of RETIRED_ARRAYS) {
    if (a[k] === undefined) continue
    removed[k] += Array.isArray(a[k]) ? a[k].length : 0
    delete a[k]
    touched = true
  }
  for (const meta of Object.values(p.claimMeta ?? {})) {
    let m = false
    for (const k of RETIRED_ATTRS) {
      if (meta[k] === undefined) continue
      if (meta[k]) attrsRemoved[k]++
      delete meta[k]
      m = true
    }
    if (m) metaTouched++
  }
  if (touched) postsTouched++
}

const after = { claims: 0, claimSpans: 0, predictions: 0, predictionSpans: 0 }
for (const p of posts) for (const k of Object.keys(after)) after[k] += (p.postAnalysis?.[k] ?? []).length

// THE ONE THING THAT MUST NOT MOVE. Retiring an attribute may not retire the row it hangs on.
const moved = Object.keys(before).filter(k => before[k] !== after[k])
if (moved.length) {
  console.error('\n[X] RETIRING THE SECTIONS MOVED A CLAIM OR PREDICTION COUNT — nothing written.')
  for (const k of moved) console.error(`   ${k}: ${before[k]} -> ${after[k]}`)
  process.exit(1)
}
// And nothing may survive under a name this step does not know about.
const leftovers = new Set()
for (const p of posts) for (const k of RETIRED_ARRAYS) if (p.postAnalysis?.[k] !== undefined) leftovers.add(k)
if (leftovers.size) { console.error(`[X] retired arrays still present: ${[...leftovers].join(', ')}`); process.exit(1) }

const receipt = {
  note: 'Emphasis, Q Conclusions and Checkable Claims retired from the data by owner ruling 2026-08-21.',
  ruling: 'get rid of the emphasis category ... everything associated with it ... also Q Conclusions and Checkable Claims data/highlights',
  arraysRemoved: removed,
  claimMetaAttributesCleared: attrsRemoved,
  postsTouched, claimMetaEntriesTouched: metaTouched,
  claimsAndPredictionsUnchanged: { before, after },
}

if (!apply) {
  console.log('DRY — nothing written.')
  console.log(JSON.stringify(receipt, null, 1))
  process.exit(0)
}

fs.writeFileSync(postsPath, JSON.stringify(posts))
fs.writeFileSync(path.join(OUT, 'retired-sections-receipt.json'), JSON.stringify(receipt, null, 1))

console.log('Retired sections stripped from public/data/posts.json.')
for (const [k, v] of Object.entries(removed)) console.log(`  ${k.padEnd(20)} ${v.toLocaleString()} entries removed`)
for (const [k, v] of Object.entries(attrsRemoved)) console.log(`  claimMeta.${k.padEnd(11)} ${v.toLocaleString()} true values cleared`)
console.log(`  posts touched       ${postsTouched.toLocaleString()}   claimMeta entries ${metaTouched.toLocaleString()}`)
console.log(`  claims ${after.claims.toLocaleString()} and predictions ${after.predictions.toLocaleString()} unchanged, as asserted`)
