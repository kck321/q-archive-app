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
  ['4,816 context units still certified', ctx.units === 4816, ctx.units],
  ['context still spread across 2,311 posts', ctx.withUnits === 2311, ctx.withUnits],
  // 4,238 -> 4,236 on 2026-08-19. UNITS, not occurrences: #2420's single parallel-phrasing
  // occurrence contributes BOTH its lines to postAnalysis.emphasis, and the run retired when the
  // owner ruled its second line a Question (a question carries no Emphasis). Nothing was deleted
  // from the drop; the device simply stops being certified.
  ['4,236 emphasis units still certified', emp.units === 4236, emp.units],
  // -1: that run was #2420's only Emphasis, so the drop leaves the set.
  ['emphasis still spread across 1,356 posts', emp.withUnits === 1356, emp.withUnits],
  ['13 reconstruction exceptions still tracked', exceptions.count === 13, exceptions.count],

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
