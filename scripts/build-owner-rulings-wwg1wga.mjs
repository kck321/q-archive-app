// THE OWNER'S RULINGS OF 2026-08-24, THIRD BATCH.
//
//   -> audit/unhighlighted-owner-rulings-2-wwg1wga.json  (read through lib/queueRulings.mjs)
//   node scripts/build-owner-rulings-wwg1wga.mjs [--dry]
//
//   "lets make the wwg1wga a directive. lets make ALL the wwg1wga directives trough all the post"
//   "post 1443 lets make Texts a claim."
//
// WWG1WGA — 171 OF 178 WERE ALREADY DIRECTIVES.
//
// The archive certifies Q's valedictions as Directives, and it already did that for every
// sign-off-shaped WWG1WGA — 168 of them, family `morale`, the same family lib/queueDirectiveFamily
// gives the string on its own. Three more are already covered inside a longer certified directive
// (#1025, #2853, #3030). So "all of them" is a five-row ruling, not a 178-row one, and this file
// says which five and why the other two are refused.
//
// TWO ARE REFUSED, AND THE REASON IS A STANDING RULE.
//
//   #1601  https://www.reddit.com/r/greatawakening/comments/8tzk3w/potus_signed_my_hat_last…
//   #3660  http://twitter.com/WWG1WGA_Every1/status/1203368497750913024
//
// Both are WWG1WGA inside a URL. Certifying a span there would put a green fill inside a link and
// split the anchor, which is the defect the URL work fixed twice — and it is the same rule that
// held `ROTHS` inside `+FLYROTHSFLY+` (`invalid_substring_extraction`) and that holds the third Q
// on #2347 inside the handle "Q_ANONBaby". A word inside an address is not a word Q wrote.
//
// THE FAMILY IS NOT DECLARED HERE. lib/queueDirectiveFamily.mjs already answers `morale` for
// WWG1WGA, which is what the 168 already-certified ones carry. Declaring it again would be a second
// copy of an answer the resolver owns.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/unhighlighted-owner-rulings-2-wwg1wga.json')
const dry = process.argv.includes('--dry')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// THIS BUILDER READS public/data, AND ITS RULINGS LAND IN public/data.
//
// It decides what to rule by asking which WWG1WGA occurrences are NOT yet Directives — so once the
// batch is applied the answer is "none", and a re-run wrote an EMPTY ruling list over the record.
// Directives fell 3,471 -> 3,466 and the five rulings were gone. Same trap
// build-unhighlighted-owner-rulings-2.mjs and build-owner-section-moves.mjs both record.
//
//   git checkout -- public/data
//   node scripts/build-owner-rulings-wwg1wga.mjs
//   node scripts/rebuild-bundle.mjs
if (!process.argv.includes('--allow-dirty')) {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', 'public/data'], { cwd: ROOT, encoding: 'utf8' }).trim()
  if (dirty) {
    console.error('
  REFUSED — public/data is not what is committed.')
    console.error('  This builder asks which occurrences are NOT yet Directives, so a rebuilt tree')
    console.error('  makes the answer "none" and the record is overwritten with nothing.
')
    process.exit(1)
  }
}

const RULED_ON = '2026-08-24'
const WWG = 'lets make the wwg1wga a directive. lets make ALL the wwg1wga directives trough all the post'
const TEXTS = 'post 1443 lets make Texts a claim.'

/** Every WWG1WGA in the corpus, with the line it sits on and whether a Directive already covers it. */
const occurrences = []
for (const p of posts) {
  const t = clean(p.text ?? '')
  if (!/wwg1wga/i.test(t)) continue
  const ranges = []
  for (const d of p.actionRequests ?? []) {
    const i = t.toLowerCase().indexOf(String(d).toLowerCase().trim())
    if (i >= 0) ranges.push([i, i + String(d).trim().length])
  }
  const rx = /wwg1wga/gi
  let m
  while ((m = rx.exec(t)) !== null) {
    const s = m.index, e = s + m[0].length
    const ls = t.lastIndexOf('\n', s - 1) + 1
    const nl = t.indexOf('\n', e)
    const line = t.slice(ls, nl === -1 ? t.length : nl).trim()
    occurrences.push({
      postNum: p.postNum, postId: p.id, line,
      alreadyDirective: ranges.some(([a, b]) => s >= a && e <= b),
      inUrl: /https?:\/\//i.test(line),
    })
  }
}

const already = occurrences.filter(o => o.alreadyDirective)
const refused = occurrences.filter(o => !o.alreadyDirective && o.inUrl)
const toRule = occurrences.filter(o => !o.alreadyDirective && !o.inUrl)

// THE SPAN IS THE TOKEN Q TYPED, taken from the line rather than retyped, so "WWG1WGA!!!" keeps its
// marks and "WWG1WGA" does not gain any. 139 certified directives are already sub-line spans —
// "Define." inside "What is HUMA? Define." — so this is the archive's existing shape, not a new one.
const rulings = []
for (const o of toRule) {
  // THE WRAPPER IS PART OF THE SPAN WHERE Q WROTE ONE (owner ruling, 2026-08-24: "#2347 it bothers
  // me that (((WWG1WGA))) isn't all a directive"). Q sets the phrase inside triple parentheses on
  // #2347 and the ruling is about what a reader sees — a green word inside grey brackets reads as
  // half a decision. Taken from the line, so the marks are Q's own and nothing is invented.
  const m = o.line.match(/\(\(\(\s*WWG1WGA[!.?]*\s*\)\)\)|WWG1WGA[!.?]*/i)
  if (!m) { console.error(`#${o.postNum}: no WWG1WGA token on ${JSON.stringify(o.line)} — refusing.`); process.exit(1) }
  rulings.push({
    postNum: o.postNum, postId: o.postId, section: 'directives',
    sourceText: m[0],
    was: 'unclassified within a line certified elsewhere',
    ruledOn: RULED_ON,
    hostLine: o.line.slice(0, 120),
    provenance: `owner ruling ${RULED_ON} — "${WWG}". 171 of the 178 WWG1WGA occurrences were already Directives; this is one of the five that were not, and it is a sub-line span in a line the archive certifies in another section.`,
  })
}

// ── #1443 "Texts" ───────────────────────────────────────────────────────────
{
  const p = byNum.get(1443)
  const line = clean(p.text ?? '').split('\n').map(l => l.trim()).find(l => norm(l) === norm('Texts'))
  if (!line) { console.error('#1443: no line "Texts" — refusing to guess.'); process.exit(1) }
  const held = (p.postAnalysis?.claims ?? []).some(c => norm(c) === norm(line))
  if (!held) {
    rulings.push({
      postNum: 1443, postId: p.id, section: 'claims',
      sourceText: line, was: 'unclassified', ruledOn: RULED_ON,
      provenance: `owner ruling ${RULED_ON} — "${TEXTS}". One of the bare evidence lines in #1443's list; "302s", "Tarmac" and "FBI" beside it are already certified.`,
    })
  }
}

const out = {
  note: 'The owner rulings of 2026-08-24 on the #2347 card and on #1443. Read through lib/queueRulings.mjs, like every other round.',
  rulings: rulings.length,
  ruledOn: RULED_ON,
  rulingText: [WWG, TEXTS],
  wwg1wga: {
    occurrences: occurrences.length,
    alreadyDirective: already.length,
    ruledHere: toRule.length,
    refusedInsideAUrl: refused.map(o => ({ postNum: o.postNum, line: o.line.slice(0, 110), why: 'WWG1WGA inside a URL. Certifying a span there puts a fill inside a link and splits the anchor — the same rule that holds ROTHS inside +FLYROTHSFLY+ and the third Q on #2347 inside the handle "Q_ANONBaby". A word inside an address is not a word Q wrote.' })),
    family: 'Not declared. lib/queueDirectiveFamily.mjs answers `morale` for WWG1WGA, which is what the 168 already-certified ones carry.',
  },
  totals: { ruled: rulings.length, directives: rulings.filter(r => r.section === 'directives').length, claims: rulings.filter(r => r.section === 'claims').length },
  rulings_: undefined,
}
delete out.rulings_
out.rulings = rulings

console.log('\nOWNER RULINGS — WWG1WGA + #1443\n')
console.log(`  WWG1WGA occurrences in the corpus     : ${occurrences.length}`)
console.log(`    already certified as a Directive    : ${already.length}`)
console.log(`    ruled here                          : ${toRule.length}`)
console.log(`    refused, inside a URL               : ${refused.length}`)
for (const o of refused) console.log(`        #${String(o.postNum).padEnd(6)} ${JSON.stringify(o.line.slice(0, 70))}`)
console.log('')
for (const r of rulings) console.log(`  #${String(r.postNum).padEnd(6)} ${r.section.padEnd(11)} ${JSON.stringify(r.sourceText).padEnd(16)} ${r.hostLine ? 'inside ' + JSON.stringify(r.hostLine.slice(0, 46)) : ''}`)
console.log('')
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, OUT)}\n`)
