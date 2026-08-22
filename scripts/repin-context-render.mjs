// One-shot: verify-context-render.mjs asserts a data half that has been stale for four seeds and
// an Emphasis half that describes a retired section.
//
// The POINT of this test is the rendering half — "certified in the data, absent from the drop" —
// and all nine of those checks pass and always have. What went stale is the five that guard the
// data behind them, and they went stale unseen because validate.mjs stopped at the certification
// manifest long before reaching this step.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const units = posts.reduce((n, p) => n + (p.postAnalysis?.contextUnits?.length ?? 0), 0)
const withUnits = posts.filter(p => p.postAnalysis?.contextUnits?.length).length

const p = path.join(ROOT, 'scripts', 'verify-context-render.mjs')
let s = fs.readFileSync(p, 'utf8')
const swap = (a, b) => {
  if (!s.includes(a)) { console.error(`  X not found:\n${a.slice(0, 120)}`); process.exit(1) }
  s = s.replace(a, b)
}

swap(
`  ['4,816 context units still certified', ctx.units === 4816, ctx.units],
  ['context still spread across 2,311 posts', ctx.withUnits === 2311, ctx.withUnits],`,
`  // 4,816 -> 1,605 and 2,311 -> 795, and NOT in this pass: the figure was already 1,736/885 at
  // seed 80 and 1,605/795 at seed 87. Context units are rebuilt by apply-context-units.mjs from
  // the certified artifact on every chain run, and the 2026-08-20 queue rulings reclassified
  // several thousand of them into Questions, Claims and Directives — a context unit that becomes
  // a certified category stops being a context unit. This baseline simply was never moved with
  // them, and nothing noticed because validate.mjs stopped at the manifest four seeds ago.
  //
  // What the check is FOR is unchanged and still asserted: the layer is certified and it is not
  // painted. Withdrawing units to achieve the visual change would still fail it.
  ['${units.toLocaleString()} context units still certified', ctx.units === ${units}, ctx.units],
  ['context still spread across ${withUnits} posts', ctx.withUnits === ${withUnits}, ctx.withUnits],`)

swap(
`  // 4,238 -> 4,236 on 2026-08-19. UNITS, not occurrences: #2420's single parallel-phrasing
  // occurrence contributes BOTH its lines to postAnalysis.emphasis, and the run retired when the
  // owner ruled its second line a Question (a question carries no Emphasis). Nothing was deleted
  // from the drop; the device simply stops being certified.
  ['4,236 emphasis units still certified', emp.units === 4236, emp.units],
  // -1: that run was #2420's only Emphasis, so the drop leaves the set.
  ['emphasis still spread across 1,356 posts', emp.withUnits === 1356, emp.withUnits],`,
`  // EMPHASIS IS RETIRED (owner ruling, 2026-08-21) — the section, its data and its highlights.
  // These two used to assert that 4,236 units across 1,356 posts were still certified while not
  // being painted, which is the opposite of what must now be true. A gate asserting a retired
  // section's figure goes green the day the section comes back.
  ['emphasis is retired: no unit is certified', emp.units === 0, emp.units],
  ['emphasis is retired: no post carries one', emp.withUnits === 0, emp.withUnits],`)

swap(
  `['13 reconstruction exceptions still tracked'`,
  `// 13 -> 12: one exception left the set when its span was re-adjudicated by the lane-B reviews.
  ['12 reconstruction exceptions still tracked'`)
s = s.replace(/exceptions\.length === 13/, 'exceptions.length === 12')

fs.writeFileSync(p, s)
console.log(`verify-context-render.mjs re-pinned: context ${units}/${withUnits}, emphasis asserted retired`)
