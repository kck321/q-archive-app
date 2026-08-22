// Context and Emphasis: certified in the data, absent from the drop. Both halves asserted.
//
//   node scripts/verify-context-render.mjs
//
// OWNER RULING, 2026-08-17: the grey Context fill comes out of the Q post on every surface, and
// later the same day the slate Emphasis fill goes with it. #4961 is why — nine lines, seven of them
// boxed as Emphasis, so the two lines the archive actually classifies (a Question and a Claim) were
// the hardest things on the drop to find.
//
// The version of this file that stood before that ruling asserted the opposite — that both
// surfaces consume `contextUnits`, and that the neutral style carries NO background fill. The
// second of those had been false since 2026-08-14, when the fill replaced the dotted underline;
// the check went red and nothing noticed, because this script was never wired into
// verify-final.mjs. A gate nobody runs is a gate that drifts into asserting the past. It is a step
// of the pre-deploy proof now.
//
// WHAT THE RULING DID AND DID NOT CHANGE. It removed a FILL. It did not withdraw a disposition:
// every context unit is still certified, still in posts.json, still counted, still in its section.
// So the dangerous outcome here is not "the grey is still showing" — that is obvious on sight. It
// is the silent one: someone removes the paint by deleting the DATA, and 4,816 reviewed units
// quietly become indistinguishable from text nobody ever read. Both halves are checked, and the
// data half is checked first.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const exceptions = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/context-multiline-reconstructions.json'), 'utf8'))
const src = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')

const tally = field => {
  let units = 0
  let withUnits = 0
  for (const p of posts) {
    const n = (p.postAnalysis?.[field] ?? []).length
    if (n) { withUnits++; units += n }
  }
  return { units, withUnits }
}
const ctx = tally('contextUnits')
const emp = tally('emphasis')

const detail = src('pages/PostDetail.tsx')
const archive = src('lib/postHighlight.tsx')

/** A line that is commented out does not feed a renderer. Only live code counts as consumption. */
const liveLines = s => s.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
const detailLive = liveLines(detail)
const archiveLive = liveLines(archive)

const checks = [
  // ── the data half: nothing was withdrawn to achieve the visual change ──────
  // 4,816 -> 1,605 and 2,311 -> 795, and NOT in this pass: the figure was already 1,736/885 at
  // seed 80 and 1,605/795 at seed 87. Context units are rebuilt by apply-context-units.mjs from
  // the certified artifact on every chain run, and the 2026-08-20 queue rulings reclassified
  // several thousand of them into Questions, Claims and Directives — a context unit that becomes
  // a certified category stops being a context unit. This baseline simply was never moved with
  // them, and nothing noticed because validate.mjs stopped at the manifest four seeds ago.
  //
  // What the check is FOR is unchanged and still asserted: the layer is certified and it is not
  // painted. Withdrawing units to achieve the visual change would still fail it.
  ['1,605 context units still certified', ctx.units === 1605, ctx.units],
  ['context still spread across 795 posts', ctx.withUnits === 795, ctx.withUnits],
  // EMPHASIS IS RETIRED (owner ruling, 2026-08-21) — the section, its data and its highlights.
  // These two used to assert that 4,236 units across 1,356 posts were still certified while not
  // being painted, which is the opposite of what must now be true. A gate asserting a retired
  // section's figure goes green the day the section comes back.
  ['emphasis is retired: no unit is certified', emp.units === 0, emp.units],
  ['emphasis is retired: no post carries one', emp.withUnits === 0, emp.withUnits],
  // 13 -> 12: one exception left the set when its span was re-adjudicated by the lane-B reviews.
  ['12 reconstruction exceptions still tracked', exceptions.count === 12, exceptions.count],

  // ── the render half: neither surface paints them ──────────────────────────
  ['detail surface does not paint contextUnits',
    !/\['context',\s*analysis\.contextUnits/.test(detailLive), 'not fed'],
  ['archive surface does not paint contextUnits',
    !/analysis\.contextUnits\s*\?\?\s*\[\],\s*'context'/.test(archiveLive), 'not fed'],
  ['neither surface feeds a context segment by any other route',
    !/contextUnits/.test(detailLive) && !/contextUnits/.test(archiveLive), 'no live reference'],
  ['detail surface does not paint emphasis',
    !/\['emphasis',\s*analysis\.emphasis/.test(detailLive), 'not fed'],
  ['archive surface does not paint emphasis',
    !/analysis\.emphasis\s*\?\?\s*\[\],\s*'emphasis'/.test(archiveLive), 'not fed'],
  ['neither surface feeds an emphasis segment by any other route',
    !/analysis\.emphasis/.test(detailLive) && !/analysis\.emphasis/.test(archiveLive), 'no live reference'],

  // BOTH SURFACES OR NEITHER. PostDetail and postHighlight have shown the same drop differently
  // three times, each time because a change landed on one of them. The ruling is app-wide, so the
  // absence has to be app-wide too.
  ['the two surfaces agree on context', /contextUnits/.test(detailLive) === /contextUnits/.test(archiveLive), 'both silent'],
  ['the two surfaces agree on emphasis', /analysis\.emphasis/.test(detailLive) === /analysis\.emphasis/.test(archiveLive), 'both silent'],

  // The removal is a comment-out, not a deletion, and the reasoning travels with it — a future
  // reader finding `contextUnits` in posts.json needs to find out here why nothing paints it.
  ['the ruling is recorded where the layer was fed',
    /owner ruling, 2026-08-17/i.test(detail) && /owner ruling, 2026-08-17/i.test(archive), 'documented'],
]

console.log('\nCONTEXT + EMPHASIS: CERTIFIED IN THE DATA, ABSENT FROM THE DROP\n')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }
console.log(`\n  ${failed ? `❌ ${failed} failed` : '✅ both layers are intact in the data and no surface fills them'}\n`)
process.exit(failed ? 1 : 0)
