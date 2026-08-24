// Layer owner-authored entity synopses onto the published hovers.
//
//   node scripts/apply-entity-synopses.mjs [--dry]
//
// WHY THIS EXISTS RATHER THAN AN EDIT TO THE GENERATOR. extract-entity-hovers.mjs builds
// public/data/entity-hovers.json from a handoff folder of JSONL audit files that is no longer on
// this machine, so it cannot be re-run. It would be the wrong place regardless: a ruling written
// into a derived artifact is erased the next time its audit runs, which is the rule every other
// owner overlay in this repo already follows.
//
// Idempotent. Runs against whatever hovers are published and replaces only the ids it names, so a
// future regeneration of the base file does not lose the owner's wording — this step is simply run
// again after it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const RULES = path.join(ROOT, 'audit', 'entity-synopsis-owner-rulings.json')
const HOVERS = path.join(DATA, 'entity-hovers.json')
const rules = JSON.parse(fs.readFileSync(RULES, 'utf8')).synopses ?? []
const hovers = JSON.parse(fs.readFileSync(HOVERS, 'utf8'))
const globalBefore = Object.keys(hovers.global ?? {}).length
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const byId = new Map(entities.entities.map(e => [e.id, e]))

console.log('\nOWNER ENTITY SYNOPSES\n')

// ── the byPost layer, where an owner ruling is about ONE DROP's reading ──────
//
// The global line says what an entity IS anywhere; byPost says what a particular drop does with
// the label. The owner's 2026-08-24 ruling on "Q" is the second kind: the Q = Alice equation
// stands where Q writes it (#74, #78) and every other drop should say on the card that it
// inherits the identity rather than stating it, and what Q says the designation stands for.
// build-q-persona-post-hovers.mjs derives those records from the certified occurrence list, so
// the ruling and the hover cannot drift apart.
const POST_RULES = path.join(ROOT, 'audit', 'q-persona-post-hovers.json')
const postRules = fs.existsSync(POST_RULES) ? JSON.parse(fs.readFileSync(POST_RULES, 'utf8')) : null

let applied = 0, already = 0
const problems = []
for (const r of rules) {
  const live = byId.get(r.entityId)
  // REFUSE rather than write a synopsis for something that is not there. An id that no longer
  // resolves means the entity was merged, withdrawn or re-minted, and the ruling needs re-reading
  // by a person — not silently attaching to nothing.
  if (!live) { problems.push(`${r.entityId} (${r.canonical}) is not a live entity`); continue }
  if (live.canonical !== r.canonical) {
    problems.push(`${r.entityId} is now "${live.canonical}", not "${r.canonical}" — the ruling names a different entity`)
    continue
  }
  const before = hovers.global[r.entityId]
  const text = typeof before === 'string' ? before : before?.synopsis
  if (text === r.synopsis) { already++; continue }
  // The global entry is a bare string in the published artifact. Keep that shape so every reader
  // of the file, including the app, needs no change.
  hovers.global[r.entityId] = r.synopsis
  applied++
  console.log(`  ${r.canonical}  (${r.entityId})`)
  console.log(`    was : ${JSON.stringify(String(text ?? '').slice(0, 96))}`)
  console.log(`    now : ${JSON.stringify(r.synopsis.slice(0, 96))}`)
}

// ── byPost ──────────────────────────────────────────────────────────────────
let postApplied = 0, postAlready = 0
if (postRules) {
  const live = byId.get(postRules.entityId)
  if (!live) problems.push(`${postRules.entityId} (${postRules.canonical}) is not a live entity`)
  else if (live.canonical !== postRules.canonical) {
    problems.push(`${postRules.entityId} is now "${live.canonical}", not "${postRules.canonical}"`)
  } else {
    hovers.byPost[postRules.entityId] ??= {}
    const dest = hovers.byPost[postRules.entityId]
    for (const [postNum, rec] of Object.entries(postRules.byPost ?? {})) {
      // THE DROPS THAT STATE THE EQUATION KEEP THEIR OWN READING. #74 and #78 already carry a
      // byPost record saying Alice appears there in Q's own words, and the ruling is precisely
      // that those are the drops where the equation is stated rather than inherited.
      if ((postRules.statedOn ?? []).includes(Number(postNum))) continue
      if (JSON.stringify(dest[postNum]) === JSON.stringify(rec)) { postAlready++; continue }
      dest[postNum] = rec
      postApplied++
    }
  }
}

if (problems.length) {
  console.error(`\n${problems.length} ruling(s) could not be applied:`)
  for (const p of problems) console.error(`   ${p}`)
  console.error('\nRefusing to write a partial layer.\n')
  process.exit(1)
}

const checks = [
  ['every ruling landed', applied + already === rules.length, `${applied + already}/${rules.length}`],
  // READ FROM THE FILE, NOT PINNED. This was the literal 1,201 — the global count on the day it
  // was written. normalise-entity-hovers.mjs has since given every certified entity a line and
  // the number is 1,584, so the literal reported a defect that does not exist every time the
  // entity set moved. What has to be true is that THIS step adds no global row and drops none.
  ['no global row added or dropped', Object.keys(hovers.global).length === globalBefore,
    `${Object.keys(hovers.global).length} (was ${globalBefore})`],
  ['each synopsis names its entity', rules.every(r => r.synopsis.includes(r.canonical.split(' ')[0])), 'ok'],
  // The byPost ruling must land on every drop it names, and on no drop that states the equation.
  ['every byPost record landed', !postRules
    || postApplied + postAlready === Object.keys(postRules.byPost ?? {}).length,
    postRules ? `${postApplied + postAlready}/${Object.keys(postRules.byPost ?? {}).length}` : 'none'],
  ['the drops that STATE the equation keep their own reading', !postRules
    || (postRules.statedOn ?? []).every(p => !Object.keys(postRules.byPost ?? {}).includes(String(p))),
    postRules ? (postRules.statedOn ?? []).map(p => '#' + p).join(', ') : 'none'],
]
console.log('\n  QA')
let failed = 0
for (const [l, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${l.padEnd(34)} ${got}`) }
if (failed) { console.error(`\nAborting: ${failed} check(s) failed. Nothing written.\n`); process.exit(1) }

console.log(`\n  applied ${applied}, already current ${already}`)
if (postRules) console.log(`  byPost (${postRules.canonical}): applied ${postApplied}, already current ${postAlready}; the drops that STATE the equation keep their own reading`)
if (dry) { console.log('\n--dry: nothing written\n'); process.exit(0) }
fs.writeFileSync(HOVERS, JSON.stringify(hovers))
console.log(`\nwrote public/data/entity-hovers.json\n`)
