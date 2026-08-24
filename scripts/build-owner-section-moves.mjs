// THE OWNER MOVED A SPAN FROM ONE SECTION TO ANOTHER.
//
//   -> audit/owner-section-moves.json
//   node scripts/build-owner-section-moves.mjs [--dry]
//
// The queue-ruling path ADDS a span to a section, and audit/unhighlighted-owner-rulings-2-
// corrections.json WITHDRAWS a queue ruling. Neither can touch a span the BASE artifacts certified
// — claims-final.json, the directives set — and three rulings of 2026-08-24 do exactly that:
//
//   "post 1443 i want to make the #2. a claim not a directive"
//   "post 1850 lets take all these entities out of claims: Carol Shea-Porter - Democrat …"
//   "Post 4784: Lisa Barsoomian _former Bill Clinton attorney lets highlight as a claim"
//
// ONE MECHANISM, BOTH DIRECTIONS. `from` removes the span from that section; `to` adds it. A move
// with a `to` the archive already certifies records the intent and asks for nothing — the 13 lines
// on #1850 are already certified Entities, split into the member and the party, and what the owner
// asked for is that they stop ALSO being Claims.
//
// WHY NOT EDIT THE BASE ARTIFACT. claims-final.json is the frozen certified record; an edit there
// would be erased the next time its audit ran, and it would make the ruling invisible. Every owner
// overlay in this repo layers instead, for that reason.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/owner-section-moves.json')
const dry = process.argv.includes('--dry')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

const RULED_ON = '2026-08-24'

// The 13 lines on #1850. Each names a member and a party, and each is ALREADY certified as those
// two entities — the split the round-2 entity work performed. What the owner is removing is the
// second reading: a list row is not an assertion Q is making.
const LIST_ROWS_1850 = [
  'Carol Shea-Porter - Democrat',
  'Jeb Hensarling - Republican',
  'Ted Poe - Republican',
  'Al Franken - Democratic U.S. Senate',
  'Blake Farenthold - Republican U.S. House',
  'Jason Chaffetz - Republican U.S. House',
  'John Conyers, Jr. - Democrat U.S. House',
  'Louise Slaughter - Democrat U.S. House',
  'Patrick Meehan - Republican U.S. House',
  'Patrick J. Tiberi - Republican U.S. House',
  'Thad Cochran - Republican U.S. Senate',
  'Tim Murphy - Republican U.S. House',
  'Trent Franks - Republican U.S. House',
]

const moves = []

// ── #1443: "#2." is a Claim, not a Directive ────────────────────────────────
moves.push({
  postNum: 1443, from: 'directives', to: 'claims', text: '#2.',
  ruledOn: RULED_ON,
  ruling: 'post 1443 i want to make the #2. a claim not a directive',
  why: 'A line of #1443\'s evidence list, between "JC." and "LL." — the same shape as "302s", "Texts" and "Tarmac" around it, which are Claims. It instructs nobody, which is what a Directive is for.',
})

// ── #1850: the list rows leave Claims ───────────────────────────────────────
for (const text of LIST_ROWS_1850) {
  moves.push({
    postNum: 1850, from: 'claims', to: 'entities', text,
    alreadyCertifiedInTarget: true,
    ruledOn: RULED_ON,
    ruling: 'post 1850 lets take all these entities out of claims',
    why: 'A row of the retiring-members list Q pasted. It names a member and a party and is already certified as both, split. A list row is not an assertion the drop is making, so it leaves Claims and nothing is added — the entities are already there.',
  })
}

// ── #4784: the opening line is a Claim ──────────────────────────────────────
moves.push({
  postNum: 4784, from: null, to: 'claims', text: 'Lisa Barsoomian _former Bill Clinton attorney',
  ruledOn: RULED_ON,
  ruling: 'Post 4784: Lisa Barsoomian _former Bill Clinton attorney lets highlight as a claim',
  why: 'The drop\'s opening line. It asserts who she is; the two lines under it — the scrubbed case and "Wife of Rod Rosenstein" — are already Claims.',
})

// ── EVERY MOVE IS CHECKED AGAINST THE DROP ──────────────────────────────────
// The text must be a line Q wrote, and where a move says `from`, the section must actually hold it.
// A ruling that names something the archive does not have is a ruling that needs re-reading.
const problems = []
for (const m of moves) {
  const p = byNum.get(m.postNum)
  if (!p) { problems.push(`#${m.postNum} is not a drop`); continue }
  const lines = clean(p.text ?? '').split('\n').map(l => l.trim().replace(/\s+/g, ' '))
  if (!lines.some(l => norm(l) === norm(m.text))) {
    problems.push(`#${m.postNum} ${JSON.stringify(m.text)} is not a line in the drop`)
    continue
  }
  if (m.from === 'claims') {
    const held = (p.postAnalysis?.claims ?? []).map(c => norm(clean(c)))
    // THE CERTIFIED SPAN MAY BE SHORTER THAN THE LINE, and on this list it usually is: the sentence
    // splitter cut "Patrick J. Tiberi - Republican U.S. House" at BOTH abbreviations and Claims
    // holds "Tiberi - Republican U.S.". The ruling names the LINE, because that is what the owner
    // reads; what has to leave Claims is whatever Claims actually holds inside it. Recorded on the
    // move, so the applier removes a span the archive has rather than one the ruling assumed.
    const exact = held.find(c => c === norm(m.text))
    const inside = held.filter(c => c && norm(m.text).includes(c))
    if (exact) m.certifiedAs = [m.text]
    else if (inside.length) {
      m.certifiedAs = (p.postAnalysis?.claims ?? []).filter(c => inside.includes(norm(clean(c))))
      m.certifiedShorterThanTheLine = true
    } else problems.push(`#${m.postNum} ${JSON.stringify(m.text)} is not a certified Claim, whole or truncated`)
  }
  if (m.from === 'directives') {
    const held = (p.actionRequests ?? []).find(c => norm(clean(c)) === norm(m.text))
    if (held) m.certifiedAs = [held]
    else problems.push(`#${m.postNum} ${JSON.stringify(m.text)} is not a certified Directive`)
  }
}
if (problems.length) {
  console.error(`\n${problems.length} move(s) do not match the archive:`)
  for (const p of problems) console.error(`   ${p}`)
  console.error('\nRefusing to write a ruling the drop does not support.\n')
  process.exit(1)
}

const out = {
  note: 'Spans the owner moved between sections, on 2026-08-24. Layered over the base certified artifacts by apply-claims.mjs and apply-directives.mjs — never written into them, because a correction inside a re-derivable artifact is erased the next time its audit runs.',
  ruledOn: RULED_ON,
  totals: {
    moves: moves.length,
    outOfClaims: moves.filter(m => m.from === 'claims').length,
    outOfDirectives: moves.filter(m => m.from === 'directives').length,
    intoClaims: moves.filter(m => m.to === 'claims').length,
  },
  moves,
}

console.log('\nOWNER SECTION MOVES\n')
for (const m of moves) {
  const as = m.certifiedShorterThanTheLine ? `   certified as ${JSON.stringify(m.certifiedAs)}`.slice(0, 62) : ''
  console.log(`  #${String(m.postNum).padEnd(6)} ${String(m.from ?? '—').padEnd(11)} -> ${String(m.to).padEnd(10)} ${JSON.stringify(m.text).slice(0, 50)}${as}`)
}
console.log(`\n  ${moves.length} moves · out of Claims ${out.totals.outOfClaims} · out of Directives ${out.totals.outOfDirectives} · into Claims ${out.totals.intoClaims}\n`)
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, OUT)}\n`)
