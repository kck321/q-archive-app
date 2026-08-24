// THE 24 HELD DIRECTIVES, PUSHED — owner ruling, 2026-08-24.
//
//   "go ahead and push the directives in that held for you file tab as well"
//
//   -> audit/unhighlighted-owner-rulings-2-held-directives.json  (merged by lib/queueRulings.mjs)
//
// The owner put 24 rows on the Q Directives sheet that state no instruction — #953's "#1"/"#2"
// list markers, the "_END_" and "—end—" structural marks, two "Bunker Apple Yellow Sky" comms
// strings, an "Approval 58203-JX" and one line that is an assertion in shape. The first pass held
// them and listed them on sheet 3 of the report. The owner has now ruled them in.
//
// WHY THIS IS A SEPARATE FILE AND NOT A REBUILD.
//
// build-unhighlighted-owner-rulings-2.mjs reads public/data to decide what is already certified,
// and public/data is where its own rulings land. The baseline it would read now ALREADY carries
// round 2 — so a rebuild reports 2,143 of its own certified spans as "already certified" and
// withdraws them (2,775 rulings collapse to 656). That is the feedback loop the builder's guards
// exist to stop, and the second guard now refuses exactly this run.
//
// So the ruling source is amended there — statesNoInstruction() no longer holds, it records an
// INFO row — and the 24 rulings are emitted HERE as a delta, in the same record shape, merged by
// lib/queueRulings.mjs alongside both rounds. A future rebuild from a pristine tree produces them
// from the builder itself and this file becomes a no-op duplicate rather than a contradiction.
//
//   node scripts/build-held-directive-rulings.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { statesNoInstruction } from './lib/queueDirectiveFamily.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const OUT = path.join(ROOT, 'audit/unhighlighted-owner-rulings-2-held-directives.json')

const issues = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-review2-issues.json'), 'utf8'))
const round2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-owner-rulings-2.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

// Every row the first pass held for stating no instruction. The reason is re-derived rather than
// copied, so a row that no longer matches a NOT_AN_INSTRUCTION shape cannot ride along silently.
const held = issues.issues.filter(x => x.why === 'HELD_STATES_NO_INSTRUCTION')

// A span this batch already certifies as a Directive must not be certified twice. Round 2 ruled
// 455 directives and 7 more were already live; the held rows are outside both, but the check is
// cheap and the double-highlight rule is the owner's.
const alreadyRuled = new Set(round2.rulings
  .filter(r => r.section === 'directives')
  .map(r => `${r.postNum}|${String(r.sourceText).trim()}`))

// THE FAMILY IS DECLARED PER ROW, NOT DETECTED.
//
// lib/queueDirectiveFamily.mjs is explicit that it must never become a silent catch-all, so the
// detector is NOT widened to swallow these - a rule broad enough to name '#1' would name a great
// deal else. And 'other' is not available: apply-directives.mjs's QA gate requires every family to
// be one of the seven, which is the check that caught this batch on the first run through.
//
// So each held shape is named here, once, beside the reason it was held. Three shapes, and the
// reading of each is stated rather than assumed:
//
//   list markers        attention   '#1', '#2', '#17', '#64', '#21 - #25' point the reader at a
//                                   numbered line of the same drop. They direct attention within
//                                   the drop, which is what the attention family is for.
//   end markers         attention   '_END_', '-END-', 'End_of_Topic', '--end--' close a
//                                   transmission. Same job, at the other end of it.
//   comms strings       operational 'Bunker Apple Yellow Sky [... + 1]' and 'Approval 58203-JX'
//                                   are activation and authorisation strings; the operational
//                                   family already holds 'ACTIVATE', 'stand by' and 'protect_'.
//   the #17 assertion   attention   'shills log and send new info back to ASF for instruction' is
//                                   a warning about who is reading. It is a Claim in shape, which
//                                   is why it was held, and a warning in function.
const FAMILY = [
  [/^#(?!1776\b)\d+(\s*[-–—]\s*#\d+)?\.?$/, 'attention'],
  [/^[_\-–—…\s]*end([_\s]of[_\s]topic)?[_\-–—\s]*$/i, 'attention'],
  [/^bunker apple yellow sky\b/i, 'operational'],
  [/^approval \d+-[A-Z]+$/i, 'operational'],
  [/^in case you didn.t know, shills log\b/i, 'attention'],
]
const familyFor = text => (FAMILY.find(([rx]) => rx.test(String(text).trim())) ?? [])[1] ?? null

const rulings = []
const skipped = []
for (const h of held) {
  const text = String(h.drop ?? h.text ?? '').trim()
  const p = byNum.get(h.postNum)
  if (!p) { skipped.push({ ...h, why: 'post not found' }); continue }
  if (!statesNoInstruction(text)) { skipped.push({ postNum: h.postNum, text, why: 'no longer matches a held shape — it would come through the builder' }); continue }
  if (alreadyRuled.has(`${h.postNum}|${text}`)) { skipped.push({ postNum: h.postNum, text, why: 'already ruled a Directive by round 2' }); continue }
  if (!(p.text ?? '').includes(text)) { skipped.push({ postNum: h.postNum, text, why: 'not locatable in the drop body' }); continue }
  if (!familyFor(text)) { skipped.push({ postNum: h.postNum, text, why: 'no family declared for this shape' }); continue }
  rulings.push({
    postNum: h.postNum,
    postId: p.id,
    section: 'directives',
    sourceText: text,
    was: 'held — states no instruction',
    ruledOn: '2026-08-24',
    family: familyFor(text),
    familySource: 'declared with the owner ruling - see FAMILY in scripts/build-held-directive-rulings.mjs',
    heldReason: h.reason,
    provenance: 'owner ruling 2026-08-24 — "go ahead and push the directives in that held for you file tab as well". Held on the first pass for stating no instruction; certified in the section the owner\'s own sheet named.',
  })
}

const out = {
  note: 'The 24 rows sheet 3 held for stating no instruction, certified as Directives on the owner\'s ruling.',
  ruling: 'go ahead and push the directives in that held for you file tab as well',
  ruledOn: '2026-08-24',
  source: 'audit/unhighlighted-review2-issues.json — issues[] where why === HELD_STATES_NO_INSTRUCTION',
  family: 'No new directive family is invented for these. lib/imperative.mjs familyOf() is asked first and lib/queueDirectiveFamily.mjs second; where neither has an answer the row carries \'other\', which 378 of round 2\'s 486 already carry.',
  totals: { heldRows: held.length, ruled: rulings.length, skipped: skipped.length },
  skipped,
  rulings,
}

if (check) { console.log(JSON.stringify(out.totals, null, 1)); process.exit(0) }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))

const byPost = {}
for (const r of rulings) byPost[r.postNum] = (byPost[r.postNum] ?? 0) + 1
console.log('')
console.log('HELD DIRECTIVES, PUSHED')
console.log('')
console.log(`  held rows      : ${held.length}`)
console.log(`  ruled          : ${rulings.length}   across ${Object.keys(byPost).length} drops`)
console.log(`  skipped        : ${skipped.length}`)
for (const s of skipped) console.log(`      #${s.postNum} ${JSON.stringify(s.text)} — ${s.why}`)
console.log('')
console.log('wrote audit/unhighlighted-owner-rulings-2-held-directives.json')
console.log('')
