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
import { execFileSync } from 'node:child_process'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/owner-section-moves.json')
const dry = process.argv.includes('--dry')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

const RULED_ON = '2026-08-24'

// THIS BUILDER READS public/data, AND public/data IS WHERE ITS RULINGS LAND.
//
// Build -> apply -> build again, and every move reads back as "already applied", `certifiedAs`
// comes out empty, and the next apply removes nothing while reporting success. It happened on the
// first run of the corpus sweep: 14 of the 30 came back already-applied and the directive count
// went the wrong way. Same trap build-unhighlighted-owner-rulings-2.mjs records, same guard.
//
//   git checkout -- public/data
//   node scripts/build-owner-section-moves.mjs
//   node scripts/rebuild-bundle.mjs
if (!process.argv.includes('--allow-dirty')) {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', 'public/data'], { cwd: ROOT, encoding: 'utf8' }).trim()
  if (dirty) {
    console.error('\n  REFUSED — public/data is not what is committed.')
    console.error('  This builder reads the bundle its own rulings land in, so a rebuilt tree makes')
    console.error('  every move read back as already-applied and the next apply remove nothing.\n')
    console.error('    git checkout -- public/data')
    console.error('    node scripts/build-owner-section-moves.mjs')
    console.error('    node scripts/rebuild-bundle.mjs\n')
    console.error(`  changed:\n${dirty.split('\n').map(l => '    ' + l).join('\n')}\n`)
    process.exit(1)
  }
}

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

// ── RED OCTOBER, NCSWIC, DELTA — corpus-wide, swept rather than typed ───────
//
//   "i want the term NCSWIC to be a prediction because it stands for nothing can stop what is
//    coming"
//   "Let's do all the Red October refferences as predictions for now"
//   "Lets do all Delta references to Predictions"
//
// Swept from the drops, so the ruling covers what the corpus actually holds and the count cannot
// drift from a hand-kept list.
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const runtime = t => String(t || '').replace(MARKUP, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')

const REFUSED = []

/** Every line matching `rx`, with the section that holds it today. */
function sweepToPredictions(rx, ruling, holdIf) {
  for (const p of posts) {
    runtime(p.text).split('\n').map(l => l.trim()).forEach(line => {
      if (!line || !rx.test(line)) return
      const a = p.postAnalysis ?? {}
      const held = arr => (arr ?? []).some(x => norm(clean(x)) === norm(line))
      // A WORD INSIDE AN ADDRESS IS NOT A WORD Q WROTE — the same refusal the WWG1WGA ruling and
      // the Q ruling both carry. #4951 writes NCSWIC twice: once as the term, and once inside
      // https://www.cisa.gov/safecom/NCSWIC, which is a federal interoperability council.
      if (/https?:\/\//i.test(line)) {
        REFUSED.push({ postNum: p.postNum, line, why: 'inside a URL — a span certified there puts a fill inside a link and splits the address' })
        return
      }
      const hold = holdIf?.(p.postNum, line)
      if (hold) { REFUSED.push({ postNum: p.postNum, line, why: hold }); return }
      if (held(a.predictions)) return                    // already what the owner asked for
      moves.push({
        postNum: p.postNum, from: held(a.claims) ? 'claims' : null, to: 'predictions', text: line,
        ruledOn: RULED_ON, ruling,
        why: held(a.claims)
          ? 'Certified a Claim; the owner has ruled the term a Prediction.'
          : 'Certified in no section; the owner has ruled the term a Prediction.',
      })
    })
  }
}

sweepToPredictions(/NCSWIC/i,
  'i want the term NCSWIC to be a prediction because it stands for nothing can stop what is coming')
sweepToPredictions(/red[ _]october/i,
  "Let's do all the Red October refferences as predictions for now")
sweepToPredictions(/\bdelta\b/i,
  'Lets do all Delta references to Predictions',
  // #1176 is Delta AIRLINES. The drop reads "Coincidence? / Delta engine fire? / Coincidence? /
  // How rare are engine fires?" — a plane, not a timestamp delta, and the same shape of homograph
  // the Q ruling held Al-Qaeda and a 10-Q filing for. Named here rather than swept in.
  (postNum) => (postNum === 1176 ? 'Delta AIRLINES — the drop asks about an engine fire, not a timestamp delta' : null))

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
// What the last run recorded, so an already-applied move can carry its span forward. Read before
// anything is written — this file is its own prior art.
const previous = new Map()
if (fs.existsSync(OUT)) {
  for (const m of JSON.parse(fs.readFileSync(OUT, 'utf8')).moves ?? []) {
    if (m.certifiedAs?.length) previous.set(`${m.postNum}|${norm(m.text)}|${m.from}`, m.certifiedAs)
  }
}

const problems = []
for (const m of moves) {
  const p = byNum.get(m.postNum)
  if (!p) { problems.push(`#${m.postNum} is not a drop`); continue }
  const lines = clean(p.text ?? '').split('\n').map(l => l.trim().replace(/\s+/g, ' '))
  if (!lines.some(l => norm(l) === norm(m.text))) {
    problems.push(`#${m.postNum} ${JSON.stringify(m.text)} is not a line in the drop`)
    continue
  }
  // THIS BUILDER READS public/data, AND public/data IS WHERE ITS OUTPUT LANDS.
  //
  // Same trap build-unhighlighted-owner-rulings-2.mjs records: once the moves are applied, "#2." is
  // no longer a Directive and the 13 list rows are no longer Claims, so a second run found 14
  // rulings the archive "does not support" and refused. The ruling had not stopped being true — it
  // had come true.
  //
  // So the question is not "is it still in `from`" but "is it where the ruling wants it". Already
  // in the target is SATISFIED; still in the source is TO DO; in neither is a real problem.
  const inSection = (sec) => {
    if (sec === 'claims') return (p.postAnalysis?.claims ?? []).map(c => norm(clean(c)))
    if (sec === 'predictions') return (p.postAnalysis?.predictions ?? []).map(c => norm(clean(c)))
    if (sec === 'directives') return (p.actionRequests ?? []).map(c => norm(clean(c)))
    if (sec === 'entities') return (p.postAnalysis?.namedEntities ?? []).map(c => norm(clean(c)))
    return []
  }
  const target = m.to ? inSection(m.to) : []
  // A target that already holds the span, whole or as the part the splitter left, is done.
  const alreadyThere = m.alreadyCertifiedInTarget
    || target.some(c => c === norm(m.text) || (c && norm(m.text).includes(c)))

  if (m.from) {
    const held = inSection(m.from)
    // THE CERTIFIED SPAN MAY BE SHORTER THAN THE LINE, and on #1850's list it usually is: the
    // splitter cut "Patrick J. Tiberi - Republican U.S. House" at BOTH abbreviations and Claims
    // held "Tiberi - Republican U.S.". The ruling names the LINE, because that is what the owner
    // reads; what has to move is whatever the section actually holds inside it.
    const exact = held.find(c => c === norm(m.text))
    const inside = held.filter(c => c && norm(m.text).includes(c))
    const raw = m.from === 'directives' ? (p.actionRequests ?? [])
      : m.from === 'claims' ? (p.postAnalysis?.claims ?? [])
      : m.from === 'predictions' ? (p.postAnalysis?.predictions ?? []) : []
    if (exact) m.certifiedAs = raw.filter(c => norm(clean(c)) === norm(m.text))
    else if (inside.length) {
      m.certifiedAs = raw.filter(c => inside.includes(norm(clean(c))))
      m.certifiedShorterThanTheLine = true
    } else if (alreadyThere) {
      // ALREADY APPLIED — AND THE SPAN STILL HAS TO BE CARRIED.
      //
      // Once the move is in the committed bundle the source section no longer holds the span, so
      // there is nothing left to derive `certifiedAs` from. Writing an empty list here would make
      // the NEXT rebuild silently restore it: apply-directives rebuilds actionRequests from the
      // certified set every run, and a move with nothing to remove removes nothing while reporting
      // success. That is exactly what happened — "#2." came back green and the count read 3,472.
      //
      // So the previous record is carried forward. The artifact is the ruling; a re-run of its
      // builder must not be able to forget what the ruling was about.
      m.alreadyApplied = true
      m.certifiedAs = previous.get(`${m.postNum}|${norm(m.text)}|${m.from}`) ?? [m.text]
    } else {
      problems.push(`#${m.postNum} ${JSON.stringify(m.text)} is in neither ${m.from} nor ${m.to}`)
    }
  } else if (!alreadyThere && !target.length) {
    // An add-only move with an empty target is fine on the first run; it is only worth reporting
    // when the target section does not exist at all, which cannot happen here.
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
    intoPredictions: moves.filter(m => m.to === 'predictions').length,
    alreadyApplied: moves.filter(m => m.alreadyApplied).length,
    refused: REFUSED.length,
  },
  // NAMED, NEVER SILENTLY SKIPPED. A sweep that quietly dropped what it could not take would read
  // as "the ruling covered everything" — which is the one thing it must not be able to say.
  refused: REFUSED,
  moves,
}

console.log('\nOWNER SECTION MOVES\n')
for (const m of moves) {
  const as = m.certifiedShorterThanTheLine ? `   certified as ${JSON.stringify(m.certifiedAs)}`.slice(0, 62) : ''
  console.log(`  #${String(m.postNum).padEnd(6)} ${String(m.from ?? '—').padEnd(11)} -> ${String(m.to).padEnd(10)} ${JSON.stringify(m.text).slice(0, 50)}${as}`)
}
console.log(`\n  ${moves.length} moves · out of Claims ${out.totals.outOfClaims} · out of Directives ${out.totals.outOfDirectives}`
  + ` · into Claims ${out.totals.intoClaims} · into Predictions ${out.totals.intoPredictions} · already applied ${out.totals.alreadyApplied}`)
if (REFUSED.length) {
  console.log(`\n  REFUSED (${REFUSED.length}) — named, never silently skipped:`)
  for (const r of REFUSED) console.log(`    #${String(r.postNum).padEnd(6)} ${JSON.stringify(r.line.slice(0, 44)).padEnd(48)} ${r.why}`)
}
console.log('')
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, OUT)}\n`)
