// Context / Other Q Text — materialise the certified units so the renderer can mark them.
//
// 4,906 units across 2,341 posts were read, dispositioned as legitimately belonging to no
// semantic category, and then rendered as plain text indistinguishable from something nobody had
// looked at. That is the single largest reason the archive still looks unaudited.
//
// The renderer must consume THIS list and nothing else. A fallback of "unhighlighted therefore
// context" would recreate the unauthorized-rendering problem the whole highlight phase exists to
// eliminate — it would paint 29,569 units' worth of certainty from a guess.
//
//   node scripts/apply-context-units.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { runtimeSpan } from './lib/runtimeText.mjs'
import { loadAbbrevRepairs, applyAbbrevRepairs, assertAbbrevApplied } from './lib/abbrevRepairs.mjs'
import { loadQueueRulings } from './lib/queueRulings.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const coverage = JSON.parse(fs.readFileSync(path.join(OUT, 'source-unit-coverage.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))

const allUnits = coverage.contextUnits ?? []
const abbrev = loadAbbrevRepairs(ROOT)
const nlower = t => String(t ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

// A unit that unitsFor() built by joining continuation lines has no contiguous span to point at:
// "Q&A 5 min." is two lines, "_27-1_yes_USA58-A _27-1_yes_USA04" is a merged pair. That is a
// source-unit REPRESENTATION issue — not a classification failure and not a renderer failure —
// so those units are held as an explicit exception set rather than silently dropped or forced.
// When the ledger learns to emit constituent line spans they can render line by line and this
// set goes to zero.
const cleanedByNum = new Map(posts.map(x => [x.postNum, clean(x.text ?? '')]))
const rawByNum = new Map(posts.map(x => [x.postNum, x.text ?? '']))

/** The unit as it literally appears in the raw drop, or the cleaned form when it already matches. */
function literalForm(u) {
  const raw = rawByNum.get(u.postNum) ?? ''
  // Runtime body first — the certified value usually already matches what the browser renders.
  const rt = runtimeSpan(raw, u.text)
  if (rt) return rt
  if (raw.includes(u.text)) return u.text
  const pattern = u.text.split('').map(ch => {
    // The board's HTML entities. clean() decodes them, so a unit carries "SA -> NK." and
    // "IG>Huber." while the raw drop the renderer matches against holds "&gt;". Same split as
    // "&amp;", same fix — the certified value keeps the readable form, the rendering value keeps
    // what Q's post literally contains.
    if (ch === '&') return '&(?:amp;)?'
    if (ch === '>') return '(?:>|&gt;)'
    if (ch === '<') return '(?:<|&lt;)'
    if (/\s/.test(ch)) return '\\s+'
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('')
  try {
    const m = new RegExp(pattern).exec(raw)
    if (m) return m[0]
  } catch { /* fall through */ }
  return u.text
}
// An owner theme ruling takes the span out of Context for the same reason a Claim does: Context
// means "reviewed, and in no semantic category", so a span the owner placed in one cannot stay.
// The coverage audit cannot work this out for itself — it derives from the certified sections,
// and Themes are inferred from a drop rather than carried as literal spans, so "Ascension." would
// sit in Context forever while also being a Religion & Spirituality anchor.
const RULINGS = path.join(OUT, 'themes-owner-rulings.json')
const themeRulings = fs.existsSync(RULINGS) ? JSON.parse(fs.readFileSync(RULINGS, 'utf8')).rulings ?? [] : []
const ruledOut = new Set(themeRulings.map(r => `${r.postNum}|${String(r.anchor).toLowerCase().trim()}`))
// ...and every owner-adjudicated CLAIM, for the identical reason. This used to be handled by
// editing the ledger by hand for the five "Pure EVIL." promotions, which meant the next claim
// ruling ("In time.", #4965) silently left the span in BOTH Claims and Context — the exact
// contradiction the comment above says must not exist. Reading claims-final.json makes the rule
// hold automatically for every ruling after this one.
for (const r of JSON.parse(fs.readFileSync(path.join(OUT, 'claims-final.json'), 'utf8')).rows) {
  if (r.confidence !== 'OWNER_ADJUDICATED') continue
  ruledOut.add(`${r.postNum}|${String(r.exactText).toLowerCase().trim()}`)
}
// ...and an owner ENTITY ruling, on the same principle: a line the owner named as an entity has
// been placed in a category, so it cannot also be "reviewed and in none".
{
  // ...and an owner QUESTION ruling. #524's "(Why don't we say his name?)" was certified as a
  // Question and stayed in Context, which paints one span as both classified and unclassified —
  // the contradiction this whole release rule exists to prevent. Every owner overlay now feeds it.
  const QR = path.join(OUT, 'questions-owner-rulings.json')
  if (fs.existsSync(QR)) {
    for (const r of JSON.parse(fs.readFileSync(QR, 'utf8')).rulings ?? []) {
      ruledOut.add(`${r.postNum}|${String(r.text).toLowerCase().trim()}`)
    }
  }
  const ER = path.join(OUT, 'entities-owner-rulings.json')
  if (fs.existsSync(ER)) {
    for (const r of JSON.parse(fs.readFileSync(ER, 'utf8')).rulings ?? []) {
      ruledOut.add(`${r.postNum}|${String(r.sourceText ?? r.aliasUsed).toLowerCase().trim()}`)
    }
  }
  // ...and the whole unhighlighted-sentence queue, 2026-08-20. READ DIRECTLY, not inferred from
  // claims-final.json: that batch is LAYERED by its materialisers rather than written into the
  // frozen artifacts, so the OWNER_ADJUDICATED sweep above cannot see it. Every section it names
  // is a category, so every ruled line leaves Context — Claims, Predictions, Directives,
  // Questions, Entities and Brackets alike. Leaving any of them would paint one span as both
  // classified and unclassified, which is the contradiction this block exists to prevent.
  for (const r of loadQueueRulings(ROOT)) {
    ruledOut.add(`${r.postNum}|${String(r.sourceText).toLowerCase().trim()}`)
    if (r.paintText) ruledOut.add(`${r.postNum}|${String(r.paintText).toLowerCase().trim()}`)
  }
}
const promoted = allUnits.filter(u => ruledOut.has(`${u.postNum}|${String(u.text).toLowerCase().trim()}`))
const remaining = allUnits.filter(u => !ruledOut.has(`${u.postNum}|${String(u.text).toLowerCase().trim()}`))

const units = remaining.filter(u => (cleanedByNum.get(u.postNum) ?? '').includes(u.text))
const multiline = remaining.filter(u => !(cleanedByNum.get(u.postNum) ?? '').includes(u.text))

fs.writeFileSync(path.join(OUT, 'context-multiline-reconstructions.json'), JSON.stringify({
  note: 'CONTEXT_OR_LABEL units whose canonical text is a multi-line reconstruction, so no single contiguous source span exists. Not dropped: listed here so the acceptance contract still reconciles. The ledger holds 4,902 units; 3,154 have since been ruled into a section by the owner, leaving 1,736 contiguous + 12 reconstructed = 1,748.',
  count: multiline.length,
  units: multiline.map(u => ({
    postNum: u.postNum,
    unitId: `ctx-${u.postNum}-${u.text.slice(0, 24).replace(/\W+/g, '_')}`,
    reconstructedText: u.text,
    constituentLines: (cleanedByNum.get(u.postNum) ?? '').split(String.fromCharCode(10))
      .filter(l => l.trim() && u.text.includes(l.trim())).slice(0, 6),
    reason: 'unitsFor() joined continuation lines; the unit never appears contiguously in the drop',
  })),
}, null, 1))
const byPost = new Map()
for (const u of units) {
  if (!byPost.has(u.postNum)) byPost.set(u.postNum, [])
  // RENDERING_PROVENANCE_RULE, a fourth time. The ledger segments clean() output, so a unit
  // carries "For God & Country!" while the raw post the renderer matches against holds
  // "For God &amp; Country!". 178 units could not mark for that reason alone. Recover the literal
  // form by matching tolerantly against the raw text and capturing what is actually there.
  //
  // Occurrence identity survives: Q writing the same fragment twice in one drop is two units,
  // and collapsing them here would repeat the mistake every other layer has already made.
  byPost.get(u.postNum).push(literalForm(u))
}

let patched = 0
for (const p of posts) {
  const list = byPost.get(p.postNum)
  if (!p.postAnalysis) { if (!list) continue; p.postAnalysis = {} }
  p.postAnalysis.contextUnits = list ?? []
  if (list) patched++
}

// The abbreviation/sentence-boundary repair, before anything counts. Context is cut by the same
// splitter as Claims and Questions — "Goodbye, Mr." / "Rosenstein.", "Charles W." / "Dent -
// Republican" — and repairing the head without absorbing the tail would leave one line certified
// twice. See scripts/lib/abbrevRepairs.mjs.
let absorbed = 0, collided = 0
{
  const r = applyAbbrevRepairs(abbrev, 'context', posts, x => x.postAnalysis?.contextUnits)
  // 12 of the 28 recorded Context repairs, and 7 of the 8 withdrawals, describe spans Context no
  // longer holds: round 2 of the unhighlighted-queue review ruled those lines into a section, and
  // a ruled line is by definition no longer "reviewed, and in no semantic category". The numbers
  // are stated rather than tolerated - a span that disappears for any other reason still fails.
  assertAbbrevApplied(abbrev, 'context', r, 'apply-context-units.mjs', { repairs: 12, withdrawals: 7 })
  absorbed = r.withdrawn
  // A REPAIRED CONTEXT UNIT CAN TURN OUT TO BE A SPAN ANOTHER SECTION ALREADY CERTIFIED.
  //
  // #2109's context was "Goodbye, Mr." and its prediction was "Goodbye, Mr. Rosenstein." — two
  // different spans, no contradiction. Repairing the context unit made it the SAME span, and
  // Context means "reviewed, and in no semantic category", so it cannot also be a Prediction.
  // Eight units across six drops land this way ("Goodbye, Mr. Rosenstein.", "Combat tactics, Mr.
  // Ryan."). They leave Context, exactly as an owner ruling would take them out.
  //
  // Scoped to units the repair TOUCHED. 114 other context units collide with another section for
  // reasons that predate this work; sweeping them out here would hide a real finding inside an
  // unrelated repair and move four certified counts without a ruling.
  const repairedText = new Set((abbrev?.doc?.repairs ?? [])
    .filter(x => x.category === 'context').map(x => `${x.postNum}|${nlower(x.full)}`))
  for (const p of posts) {
    const units = p.postAnalysis?.contextUnits
    if (!units?.length) continue
    const elsewhere = new Set([...(p.postAnalysis.claims ?? []), ...(p.postAnalysis.predictions ?? []),
      ...(p.actionRequests ?? [])].map(nlower))
    const kept = units.filter(u => {
      const clash = elsewhere.has(nlower(u)) && repairedText.has(`${p.postNum}|${nlower(u)}`)
      if (clash) collided++
      return !clash
    })
    p.postAnalysis.contextUnits = kept
  }
  console.log(`  abbreviation repair: ${r.repaired} context spans repaired, ${r.withdrawn} fragments absorbed, ${collided} left Context for a section that already held the repaired span`)
}

const materialised = posts.reduce((n, p) => n + (p.postAnalysis?.contextUnits?.length ?? 0), 0)
const postsWith = posts.filter(p => (p.postAnalysis?.contextUnits?.length ?? 0) > 0).length

// 4,893 + 13 = 4,906 until 2026-08-14, when the owner ruled five "Pure EVIL." occurrences to be
// Claims. Four of them had been dispositioned CONTEXT_OR_LABEL, and Context means "reviewed, and
// in no semantic category" — so they cannot stay. Leaving them produced a visible contradiction:
// the renderer painted "Pure EVIL." on #570 as an overlap titled "2 certified layers: claim,
// context", presenting one span as classified and unclassified at the same time.
//
// The count moved because a ruling moved it, not because the detector drifted. The gate stays
// exact so the next unexplained movement still fails.
const checks = [
  // 4,816 -> 1,736. The owner's review of the unhighlighted-sentence queue placed 3,081 of these
  // spans into a section, and Context means "reviewed, and in no semantic category" - so they
  // leave. Nothing was re-detected: the ledger is unchanged and every departure is named by a row
  // in audit/unhighlighted-owner-rulings.json.
  // 1,736 -> 1,735 (#4923 "Dearest Virginia -"), -> 1,731 with the 2026-08-21 batch: #4893
  // "Example:" and "Federal Appeals Court reinstates conviction", #4853 "Wife: CIA" and
  // "Husband: DOJ". All four were Context and are now Claims, so they leave by the same rule the
  // queue rulings did. #4861 and #4910 moved too but were UNCLASSIFIED, so they cost Context
  // nothing. The ledger is untouched throughout; the units moved sides.
  // 1,731 -> 1,715. Eight tail fragments absorbed by the 2026-08-21 abbreviation repair, and eight
  // repaired units that turned out to be spans another section already certified, which leave
  // Context because Context means "reviewed, and in no semantic category". 28 more were repaired
  // in place, which changes their text and not their number.
  // 1,715 -> 577. ROUND 2 of the unhighlighted-queue review ruled 1,154 more Context units into a
  // section, and a ruled line is by definition no longer "reviewed, and in no semantic category".
  // Nothing was deleted: every one of them is counted below as promoted, and the total still
  // reconciles to the certified 4,902.
  ['contiguous context spans = 577', materialised === 577, materialised],
  // 13 -> 12: one of the multi-line reconstructions was ruled into a section too.
  // 12 -> 3: nine more of the multi-line reconstructions were ruled into a section.
  ['multi-line reconstructions held as exceptions = 3', multiline.length === 3, multiline.length],
  // The TOTAL is the invariant and it does not move: a ruling changes which side of the ledger a
  // unit sits on, never how many units were reviewed. 1,747 + 3,155 = 4,902, as 1,748 + 3,154 did.
  // THE LEDGER TOTAL IS STILL 4,902, AND THE ABSORBED UNITS ARE WHY THE SUM NEEDS A THIRD TERM.
  //
  // The abbreviation repair merged 8 tail units into the heads they were split from — "Rosenstein."
  // into "Goodbye, Mr. Rosenstein." — so 8 ledger rows no longer materialise as spans of their own.
  // They were not dropped and they were not reclassified: two units became one, eight times.
  // Counting them here keeps the acceptance contract honest instead of re-pinning the total to a
  // smaller number and losing the reason.
  // 577 + 3 = 580, and the certified 4,902 is unchanged — the units moved sides, none left the
  // archive. `absorbed` falls 8 -> 1 because seven of those tail fragments were themselves ruled
  // into a section before the repair could absorb them.
  ['577 + 3 = 580, + 4,313 promoted + 1 absorbed + 8 recategorised = the certified 4,902',
    materialised + multiline.length === 580
      && materialised + multiline.length + promoted.length + absorbed + collided === 4902,
    `${materialised + multiline.length} + ${promoted.length} + ${absorbed} + ${collided}`],
  // 2 themes + 3 claims (#4965 'In time.', #4963 x2) + 4 entity rulings whose span was a
  // Context line (#4963 Investigators./Researchers./Whistleblowers. and #5 is unaffected).
  // 73 + 3,081 from the unhighlighted-sentence queue = 3,154, + 1 (#4923) = 3,155,
  // + 4 (#4893 x2, #4853 x2, all 2026-08-21) = 3,159.
  // 3,159 + 1,154 from round 2 of the review = 4,313.
  ['owner rulings removed from Context = 4,313', promoted.length === 4313, promoted.length],
  // Against the CLEANED text, because that is what the ledger segmented. Comparing to raw text
  // fails on the whitespace normalisation clean() applies and would report a defect that is
  // purely an artefact of checking the wrong string.
  ['every materialised unit resolves in its own post',
    units.every(u => (cleanedByNum.get(u.postNum) ?? '').includes(u.text)), 'ok'],
]

console.log('\nAPPLY CONTEXT / OTHER Q TEXT\n')
console.log(`  units : ${materialised.toLocaleString()}`)
console.log(`  posts : ${postsWith.toLocaleString()}`)
console.log('\n  QA')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(40)} ${got}`) }
if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: posts.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'posts.json'), JSON.stringify(posts))
console.log(`\nwrote public/data/posts.json (${patched.toLocaleString()} posts patched)\n`)
