// WHAT "THE PICTURE AUDIT IS COMPLETE" IS ALLOWED TO MEAN.
//
// All 1,690 image records are processed and published. That is true, and it is NOT the same
// claim as "every image received a complete interpretation" — 37 records are published but not
// finished being interpreted, and they are two different situations that need different work:
//
//   29 PARTIAL   the audit described the image and indexed its phrases, but some content could
//                not be transcribed. There is something to extend.
//    8 WITHHELD  the provider declined to analyse the image. The record carries no description
//                and no extracted text at all, so there is nothing to correct — it needs the
//                owner's own look. FOUR OF THE EIGHT ARE #4941 (n=1574-1577).
//
// Reported as one undifferentiated 37, those read as one kind of problem. This gate holds the
// counts, holds the distinction, holds the nine records the owner asked to be able to find, and
// holds the wording that describes them — so a later "tidy-up" cannot quietly upgrade "processed"
// into "fully analysed".
//
// It also checks the direction that matters most: a withheld record must not carry stored content
// about the image it withheld.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const results = []
let pass = 0, fail = 0
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }
const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8') } catch { return null } }

const data = JSON.parse(read('public/data/picture-analysis.json'))
const recs = data.images
const WITHHELD = /analysis withheld/i
const isWithheld = r => (r.flags ?? []).some(f => WITHHELD.test(f))

// ── 1. The published totals ─────────────────────────────────────────────────────────────────────
check('1a. 1,690 image records are published', recs.length === 1690, String(recs.length))
const posts = new Set()
for (const r of recs) for (const p of (r.posts ?? [])) posts.add(p.num)
check('1b. across 1,514 posts', posts.size === 1514, String(posts.size))

const tally = { green: 0, yellow: 0, red: 0 }
for (const r of recs) tally[r.confidence] = (tally[r.confidence] ?? 0) + 1
check('1c. confidence is 1,369 green / 260 yellow / 61 red',
  tally.green === 1369 && tally.yellow === 260 && tally.red === 61,
  `${tally.green}/${tally.yellow}/${tally.red}`)
check('1d. the three confidence grades account for every record',
  tally.green + tally.yellow + tally.red === recs.length)

// ── 2. Completeness is a DIFFERENT axis from confidence ─────────────────────────────────────────
const flagged = recs.filter(r => r.needsReview)
const withheld = flagged.filter(isWithheld)
const partial = flagged.filter(r => !isWithheld(r))
const complete = recs.filter(r => !r.needsReview)

check('2a. 37 records need an owner pass', flagged.length === 37, String(flagged.length))
check('2b. 8 of them are content-filter withholds', withheld.length === 8, String(withheld.length))
check('2c. 29 of them are partial analyses', partial.length === 29, String(partial.length))
check('2d. 1,653 carry a complete analysis', complete.length === 1653, String(complete.length))
check('2e. the three add up to every published record',
  complete.length + partial.length + withheld.length === recs.length)

// Confidence and completeness must not be conflated: a partial can be green (a compilation whose
// subject is unambiguous but whose text is too large to transcribe). If they ever line up exactly
// somebody has collapsed one into the other.
check('2f. completeness is not merely confidence renamed',
  partial.some(r => r.confidence === 'green'),
  `${partial.filter(r => r.confidence === 'green').length} partials are green`)

// ── 3. Every withhold flags itself, and none of them is silently unflagged ──────────────────────
check('3a. every withheld record is in the review queue',
  recs.filter(isWithheld).every(r => r.needsReview === true))

// ── 4. NO WITHHELD-IMAGE DETAIL IS STORED ──────────────────────────────────────────────────────
// The record exists so the image is accounted for. It must not carry an analysis of the thing the
// provider declined to analyse — not in the description, not in extracted text, not in the
// entity lists that feed search.
for (const r of withheld) {
  const n = recs.indexOf(r) + 1
  const lists = [...(r.people ?? []), ...(r.orgs ?? []), ...(r.objects ?? []), ...(r.places ?? []), ...(r.terms ?? [])]
  check(`4. n=${n} (#${r.posts?.[0]?.num}) stores no analysis of the withheld image`,
    (r.text ?? '') === '' && (r.description ?? '').length <= 40 && lists.length === 0,
    `desc ${(r.description ?? '').length} chars, text ${(r.text ?? '').length}, ${lists.length} indexed terms`)
}

// ── 5. THE NINE THE OWNER ASKED FOR, findable and correctly classified ─────────────────────────
const NINE = [
  { n: 1574, kind: 'withheld', post: 4941 },
  { n: 1575, kind: 'withheld', post: 4941 },
  { n: 1576, kind: 'withheld', post: 4941 },
  { n: 1577, kind: 'withheld', post: 4941 },
  { n: 1497, kind: 'partial' },
  { n: 1534, kind: 'partial' },
  { n: 1644, kind: 'partial' },
  { n: 1669, kind: 'partial' },
  { n: 1687, kind: 'partial' },
]
for (const want of NINE) {
  const r = recs[want.n - 1]
  const got = r ? (isWithheld(r) ? 'withheld' : 'partial') : 'MISSING'
  const postOk = want.post === undefined || (r?.posts ?? []).some(p => p.num === want.post)
  check(`5. n=${want.n} is present, flagged, and ${want.kind}`,
    Boolean(r) && r.needsReview === true && got === want.kind && postOk,
    r ? `${got}, #${(r.posts ?? []).map(p => p.num).join('/')}` : 'MISSING')
}
check('5j. all four #4941 withholds are the same post',
  NINE.filter(w => w.post === 4941).every(w => (recs[w.n - 1]?.posts ?? []).some(p => p.num === 4941)))

// ── 6. THE WORDING. "Processed and published", never "every image fully analysed" ──────────────
const OVERCLAIM = /all 1,?690 (distinct )?images are analysed|every image (was |is |has been )?(fully )?analys|fully analysed|complete analysis of every image/i
const DOCS = ['audit/PICTURE-AUDIT-RUNBOOK.md', 'audit/picture-review.md']
for (const d of DOCS) {
  const t = read(d)
  if (t === null) { check(`6. ${d} — absent`, true); continue }
  check(`6. ${d} does not claim every image was fully analysed`, !OVERCLAIM.test(t),
    (t.match(OVERCLAIM) ?? [''])[0])
}
const runbook = read('audit/PICTURE-AUDIT-RUNBOOK.md') ?? ''
check('6c. the runbook says records are PROCESSED AND PUBLISHED',
  /1,690 image records are processed and published/i.test(runbook))
check('6d. the runbook states the completeness breakdown, not only the confidence one',
  /1,653/.test(runbook) && /\b29\b/.test(runbook) && /\b8\b/.test(runbook) && /withhold/i.test(runbook))
const notes = read('audit/picture-review.md') ?? ''
check('6e. the review notes no longer say the queue holds three rows',
  !/all three are giant/i.test(notes))
check('6f. the review notes name the #4941 withholds', /n=1574-1577/.test(notes) && /4941/.test(notes))

// ── 7. The app distinguishes the two kinds rather than printing one number ─────────────────────
const lib = read('src/lib/pictureAnalysis.ts') ?? ''
const page = read('src/pages/ResolutionCenter.tsx') ?? ''
check('7a. the picture library classifies a flagged record', /export function reviewKindOf/.test(lib) && /pictureReviewQueue/.test(lib))
check('7b. a record carries its n= identity', /img\.n = i \+ 1/.test(lib))
check('7c. the Resolution Center renders the two groups separately',
  /Withheld by the content filter/.test(page) && /Partial analyses/.test(page))
check('7d. the page states that all 1,690 records are processed and published',
  /image records are processed and\s*\n?\s*published/.test(page) || /1,690<\/span> image records are processed/.test(page))
check('7e. the page does not print a withheld image\'s stored content, because there is none',
  /No description or extracted text is stored/.test(page))

console.log('\nPICTURE REVIEW ACCURACY\n')
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(64)}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) {
  console.error('\n[X] the picture audit is being described as something other than what it is.\n')
  process.exit(1)
}
console.log('')
