// WHAT "Q" MEANS ON A DROP THAT IS NOT THE ONE STATING THE EQUATION.
//
//   -> audit/q-persona-post-hovers.json   (applied by apply-entity-synopses.mjs)
//   node scripts/build-q-persona-post-hovers.mjs [--dry]
//
// OWNER RULING 2026-08-24, UPDATED report sheet 6:
//   "q does = alice in the pertaining post but any other post i would make the hover synopsis
//    that q is a group of people less than 10 or how ever q explains it somewhere in the post"
//
// The 2026-08-24 ruling resolved 93 standalone "Q" occurrences across 75 drops to the entity
// Alice. Two of those drops — #74 and #78 — WRITE the equation, in Q's own words. On the other 73
// the equation is inherited, and a reader hovering "Q" on #2519 was shown only Alice's global
// line: "“Alice” is a person in this archive." That is what the owner is correcting.
//
// THE ENTITY RESOLUTION IS NOT TOUCHED. The owner named the HOVER SYNOPSIS, and the hover has a
// layer for exactly this: `byPost` says how ONE drop uses the label, beside the global line that
// says what the entity is anywhere. So the equation stays certified where the ruling put it, and
// every drop that did not state it now says so on the card.
//
// WHAT Q SAYS IT IS, in his own words and nowhere else's:
//   #60   "You can count the people who have the full picture on two hands."
//         "Of those (less than 10 people) only three are non-military."
//   #244  "Less than 10 can confirm me."
// He repeats the figure when asked who can speak for the designation — #722, #1788.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const RULING = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/q-entity-owner-ruling.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))

const byNum = new Map(posts.map(p => [p.postNum, p]))
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

const alice = entities.entities.find(e => e.canonical === 'Alice')
if (!alice) { console.error('Alice is not a live entity — refusing.'); process.exit(1) }

// The drops that WRITE the equation. Read from the ruling, never listed here, so the two records
// cannot drift apart.
const STATED_ON = new Set(RULING.equationStatedByQ?.posts ?? [])
if (!STATED_ON.size) { console.error('The ruling names no drop that states the equation — refusing.'); process.exit(1) }

/** What the line the occurrence sits on is doing, in the byPost vocabulary. */
function roleOf(post, line) {
  const k = norm(line)
  const a = post.postAnalysis ?? {}
  const inList = arr => (arr ?? []).some(x => { const n = norm(x); return n && (n === k || k.includes(n) || n.includes(k)) })
  if (questions.some(q => q.postNum === post.postNum && q.occurrences !== undefined && inList([q.unitText ?? q.text]))) return 'question'
  if (inList(a.predictions)) return 'prediction'
  if (inList(post.actionRequests)) return 'directive'
  if (inList(a.claims)) return 'claim'
  return 'statement or list'
}

const SAYS = 'Q describes the designation himself: “You can count the people who have the full picture on two hands.” / “Of those (less than 10 people) only three are non-military.” (#60), and “Less than 10 can confirm me.” (#244).'

const byPost = {}
let skippedStated = 0
for (const occ of RULING.personaOccurrences ?? []) {
  if (STATED_ON.has(occ.postNum)) { skippedStated++; continue }
  const post = byNum.get(occ.postNum)
  if (!post) { console.error(`#${occ.postNum} is not a drop — refusing.`); process.exit(1) }
  // One record per DROP. Where a drop carries the designation more than once the reading is the
  // same reading, and the card is shown per term rather than per occurrence.
  if (byPost[occ.postNum]) continue
  const role = roleOf(post, occ.line)
  byPost[occ.postNum] = {
    s: `In post #${occ.postNum}, “Q” is the designation itself. The equation Q = Alice is written by Q on #${[...STATED_ON].sort((a, b) => a - b).join(' and #')}, not here, so this drop inherits the identity rather than stating it. ${SAYS}`,
    a: 'Q',
    r: role,
    // Strong: the reading is the owner's ruling of 2026-08-24, and what the label stands for is
    // stated by Q rather than inferred. Partial would say the drop leaves it open, and it does not.
    g: 'Strong',
    c: 'High',
    // OWNER-RULED, and the audits have to be able to see that. This record is not an outcome of
    // the hover audit's 7,778-record population, so it must not be counted into that
    // reconciliation; and "Q" IS a shared alias — Q and Alice both claim it — which the audit
    // otherwise holds in review on the principle that a global alias mapping may not decide what a
    // label means in one drop. An owner ruling is exactly the thing that may.
    o: 'owner ruling 2026-08-24',
  }
}

const out = {
  note: 'How a drop that does NOT state the Q = Alice equation uses the label "Q". Applied to the byPost layer of public/data/entity-hovers.json by apply-entity-synopses.mjs, under the Alice entity id.',
  ruling: RULING.ruling ? undefined : undefined,
  ownerRuling: 'q does = alice in the pertaining post but any other post i would make the hover synopsis that q is a group of people less than 10 or how ever q explains it somewhere in the post',
  ruledOn: '2026-08-24',
  source: 'Q_Unhighlighted FINAL 2 - REPORT (UPDATED).xlsx, sheet 6-fixes-made',
  entityResolutionUnchanged: 'The 93 occurrences stay certified as Alice. The owner named the hover synopsis, and byPost is the layer that says how ONE drop uses the label.',
  statedOn: [...STATED_ON].sort((a, b) => a - b),
  entityId: alice.id,
  canonical: alice.canonical,
  totals: { occurrences: (RULING.personaOccurrences ?? []).length, dropsWithRecord: Object.keys(byPost).length, skippedBecauseTheyStateIt: skippedStated },
  byPost,
}
delete out.ruling

console.log('\nQ PERSONA — POST HOVERS\n')
console.log(`  persona occurrences   : ${out.totals.occurrences}`)
console.log(`  drops given a record  : ${out.totals.dropsWithRecord}`)
console.log(`  drops that STATE it   : ${[...STATED_ON].sort((a, b) => a - b).map(p => '#' + p).join(', ')}  (${skippedStated} occurrences, left to Alice's own reading)`)
const roles = {}
for (const r of Object.values(byPost)) roles[r.r] = (roles[r.r] ?? 0) + 1
for (const [k, v] of Object.entries(roles).sort((a, b) => b[1] - a[1])) console.log(`      ${String(v).padStart(3)}  ${k}`)
console.log('')

if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
fs.writeFileSync(path.join(ROOT, 'audit/q-persona-post-hovers.json'), JSON.stringify(out, null, 1) + '\n')
console.log('  wrote audit/q-persona-post-hovers.json\n')
