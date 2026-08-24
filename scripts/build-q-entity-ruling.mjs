// THE OWNER'S Q RULING, 2026-08-24.
//
//   "in post 74 i want the Q in this to be an entity and any other post that has Q within it
//    that isn't the signature at the bottom   Q = Alice"
//
//   -> audit/q-entity-owner-ruling.json
//
// #74 and #78 both write the equation in Q's own hand: "Q = Alice". So the ruling is applied, and
// the sign-off is excluded exactly as asked — 4,534 signature lines are skipped before anything
// else is considered.
//
// WHAT THIS FILE EXISTS TO STOP.
//
// "Q" outside the sign-off is not one thing. Of the 158 occurrences, a large group IS the persona
// the ruling means — the drops about attacks on 'Q', the 'Q' movement, Q posts, Q proofs. The rest
// are homographs, and applying the equation to them would certify, as Alice:
//
//     AL-Q            Al-Qaeda                                #1887
//     10-Q            an SEC filing form                      #2588
//     THE 'Q'         Quicken Loans Arena, Cleveland          #2263
//     Q Group         the NSA body                            #144, #148
//     Q Clearance     a Department of Energy clearance level  #34, #48
//     Q+              a DIFFERENT designation, and the one    #2401, #2565, #2567
//                     thing PROJECT_CONTEXT invariant 6 names
//     Q&A / "a Q"     the word question                       ~30 lines
//     Right on Q      the idiom                               #1221
//
// Naming Al-Qaeda "Alice" is the shape of error this archive's rules exist to prevent, so the
// homographs are HELD and listed rather than ruled. Every rule below states what it is claiming.
//
//   node scripts/build-q-entity-ruling.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/q-entity-owner-ruling.json')
const check = process.argv.includes('--check')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))

/** The sign-off, excluded by the ruling itself. Same pattern lib/units.mjs uses. */
const SIGNATURE = /^(?:q\+?|q\s*!\S*|wwg1wga|ncswic|wrwy)[.!?]*$/i
/** A standalone Q. Word-boundary on both ends, so "Quantum" and "IQ" are never touched. */
const BARE_Q = /(?<![A-Za-z0-9])Q(?![A-Za-z0-9])/g

// ── the homographs, each with the thing it actually names ───────────────────
// Tested against the WHOLE LINE, because that is where the evidence is.
const NOT_THE_PERSONA = [
  [/\bAL[- ]?Q\b/i, 'Al-Qaeda — "AL-Q" is Q\'s abbreviation for it'],
  [/\b10[- ]Q\b/i, 'an SEC filing form (10-Q)'],
  [/@ ?THE '?Q'?\b|RALLY @ THE/i, 'Quicken Loans Arena in Cleveland, known as "The Q"'],
  [/\bQ[- ]group\b/i, 'the NSA Q Group, a body rather than the poster'],
  [/\bQ Clearance\b/i, 'a Department of Energy clearance level'],
  [/\bQ\s*\+|\(\(\(Q\+\)\)\)|Q 0 = Q\+/i, 'Q+ — a different designation; Q and Q+ are not the same (PROJECT_CONTEXT invariant 6)'],
  [/\bQ ?& ?A\b/i, 'Question & Answer'],
  [/twitter\.com|8ch\.net|8kun|https?:\/\//i, 'part of a link or a handle, not a word Q wrote'],
  // The bracket may sit BESIDE the Q rather than around it: #1279 is the whole line "Q [auth478-24zgP]".
  [/\[(?:auth|CLAS)[^\]]*\]|Operation Q-|Q-T\d/i, 'a comms or operation code'],
  [/\bRight on Q\b/i, 'the idiom "right on cue"'],
  [/^▶Q \(You\)/i, 'a quoted board header — Q\'s own tripcode line inside a paste'],
  // Q meaning "question". The tells are a following colon, an article or an adjective before it,
  // or the verbs a question takes.
  [/\b(?:a|the|simple|logical|common|excellent|another|very simple)\s+'?Q'?\b/i, 'the word "question"'],
  [/\bQ\s*:\s/i, 'the word "question", used as a label before the question itself'],
  [/\b(?:Answer|Ask)\s+(?:yourself\s+)?(?:a\s+)?Q\b/i, 'the word "question"'],
  [/\bQ will be (?:answered|asked)\b|force' the Q\b/i, 'the word "question"'],
  [/names start w\/ a 'Q'|'Q' stocking|'O' made into 'Q'/i, 'the LETTER Q, not the poster'],
  // "Q #" is the drop-number label, with or without a number after it (#1323 quotes it bare).
  [/\bQ ?#/i, 'a drop number, not a name'],
]

// ── THE OWNER OVERRULES A READING, OCCURRENCE BY OCCURRENCE ─────────────────
//
// OWNER RULING 2026-08-24, on the #2347 card: "lets make both the Q's an Entity (not the
// signiture)".
//
// Both of #2347's body Qs were held above by the "the word question" rule — and that rule was
// written FOR them: `Q will be (answered|asked)` and `force' the Q`. Reading them as the noun is
// defensible, and the owner has read the drop and ruled the other way. The ruling stands; the rule
// keeps the ~30 other lines it holds.
//
// SCOPED TO THE LINE, never to the drop. The THIRD Q on #2347 stays held: it is inside the twitter
// handle "Q_ANONBaby" on the link line, which is not a word Q wrote — the same reason the two
// WWG1WGAs inside URLs were refused in this batch. The sign-off never reaches any of this;
// SIGNATURE excludes it first, which is what "(not the signiture)" asks for.
const OWNER_OVERRIDES = [
  { postNum: 2347, lineIndex: 3, expect: "force' the Q" },
  { postNum: 2347, lineIndex: 4, expect: 'The Q will be answered' },
]
const overrideUsed = new Set()

const persona = []
const held = []
let signatureLines = 0

for (const p of posts) {
  const lines = clean(p.text ?? '').split('\n')
  lines.forEach((raw, lineIndex) => {
    const line = raw.trim()
    if (SIGNATURE.test(line)) { signatureLines++; return }
    const rx = new RegExp(BARE_Q.source, 'g')
    let m
    while ((m = rx.exec(line)) !== null) {
      const why = NOT_THE_PERSONA.find(([re]) => re.test(line))
      const row = { postNum: p.postNum, postId: p.id, lineIndex, charIndex: m.index, line: line.slice(0, 160) }
      const override = OWNER_OVERRIDES.find(o => o.postNum === p.postNum && o.lineIndex === lineIndex)
      if (override && line.includes(override.expect)) {
        overrideUsed.add(`${override.postNum}|${override.lineIndex}`)
        persona.push({ ...row, ownerOverride: 'owner ruling 2026-08-24 — "lets make both the Q\'s an Entity (not the signiture)". Held before that by: ' + (why ? why[1] : 'nothing') })
        continue
      }
      if (why) held.push({ ...row, names: why[1] })
      else persona.push(row)
    }
  })
}

// REFUSE RATHER THAN SILENTLY MISS. An override names a line by index and by the words on it; if
// the drop no longer reads that way the ruling needs re-reading by a person, not dropping.
const missed = OWNER_OVERRIDES.filter(o => !overrideUsed.has(`${o.postNum}|${o.lineIndex}`))
if (missed.length) {
  console.error(`\n${missed.length} owner override(s) matched no Q on the line they name:`)
  for (const o of missed) console.error(`   #${o.postNum} line ${o.lineIndex} — expected ${JSON.stringify(o.expect)}`)
  console.error('')
  process.exit(1)
}

const statesTheEquation = posts
  .filter(p => /\bQ\s*=\s*Alice\b/i.test(clean(p.text ?? '')))
  .map(p => p.postNum)

const byPost = {}
for (const r of persona) byPost[r.postNum] = (byPost[r.postNum] ?? 0) + 1
const heldByReason = {}
for (const r of held) heldByReason[r.names] = (heldByReason[r.names] ?? 0) + 1

const out = {
  note: 'Owner ruling: a standalone "Q" that is not the sign-off is an Entity, and it is Alice.',
  ruling: 'in post 74 i want the Q in this to be an entity and any other post that has Q within it that isn\'t the signature at the bottom   Q = Alice',
  ruledOn: '2026-08-24',
  equationStatedByQ: {
    posts: statesTheEquation,
    what: 'These drops write "Q = Alice" in Q\'s own words. The ruling is his equation, not an inference from context.',
  },
  scope: {
    signatureLinesExcluded: signatureLines,
    what: 'A line that is only the sign-off — "Q", "Q+", a tripcode, WWG1WGA, NCSWIC, WRWY — is skipped before anything else is considered, exactly as the ruling says.',
  },
  held: {
    what: '"Q" outside the sign-off is not one thing. These occurrences name something else, and applying the equation to them would certify Al-Qaeda, an SEC form, a basketball arena, a clearance level and the word "question" as Alice.',
    byReason: heldByReason,
    rows: held,
  },
  totals: {
    personaOccurrences: persona.length,
    personaPosts: Object.keys(byPost).length,
    heldOccurrences: held.length,
    signatureLinesExcluded: signatureLines,
  },
  personaOccurrences: persona,
}

// THIS FILE IS THE RULING; THE ALIAS LIST IS WHAT MAKES IT PAINT, AND THEY MUST NOT DRIFT.
//
// The equation reaches the drop through an alias ruling in audit/entities-owner-rulings.json —
// `{ alias: "Q", canonical: "Alice", includePosts: [...] }` — and THAT list is what apply-entities
// reads. Ruling here and forgetting there is silent: the ruling records 76 drops, the alias paints
// 75, and every count still reconciles because nothing ever compares them.
//
// It happened on 2026-08-24. The owner ruled #2347's two body Qs in; this file said so and the drop
// went on showing no entity at all. So the two are compared, here, every run.
{
  const aliasFile = path.join(ROOT, 'audit/entities-owner-rulings.json')
  if (fs.existsSync(aliasFile)) {
    const doc = JSON.parse(fs.readFileSync(aliasFile, 'utf8'))
    const row = (doc.aliasRulings ?? []).find(r => r.alias === 'Q' && r.canonical === 'Alice')
    if (row) {
      const want = [...new Set(persona.map(r => r.postNum))].sort((a, b) => a - b)
      const have = [...(row.includePosts ?? [])].sort((a, b) => a - b)
      const missing = want.filter(p => !have.includes(p))
      const extra = have.filter(p => !want.includes(p))
      // AND THE OCCURRENCES, WHICH ARE THE HALF THAT DECIDES WHAT PAINTS. includePosts is a
      // whitelist of drops; includeOccurrences is the [lineIndex, charIndex] list within them, and
      // it is what stops the alias claiming the "Q" inside the handle "Q_ANONBaby" on #2347. Post
      // scope alone would have added a third mention there and painted it inside the link.
      const wantOcc = new Set(persona.map(r => `${r.postNum}|${r.lineIndex}|${r.charIndex}`))
      const haveOcc = new Set(Object.entries(row.includeOccurrences ?? {})
        .flatMap(([p, pairs]) => pairs.map(([l, c]) => `${Number(p)}|${l}|${c}`)))
      const occMissing = [...wantOcc].filter(k => !haveOcc.has(k))
      const occExtra = [...haveOcc].filter(k => !wantOcc.has(k))
      if (missing.length || extra.length || occMissing.length || occExtra.length) {
        console.error('\nThe Q -> Alice alias ruling does not match this ruling.')
        if (missing.length) console.error(`   ruled here but NOT in includePosts: ${missing.join(', ')}`)
        if (extra.length) console.error(`   in includePosts but not ruled here : ${extra.join(', ')}`)
        if (occMissing.length) console.error(`   ruled here but NOT in includeOccurrences: ${occMissing.slice(0, 12).join('  ')}`)
        if (occExtra.length) console.error(`   in includeOccurrences but not ruled here: ${occExtra.slice(0, 12).join('  ')}`)
        console.error('   audit/entities-owner-rulings.json is what apply-entities reads. Refusing.\n')
        process.exit(1)
      }
    }
  }
}

if (check) { console.log(JSON.stringify(out.totals, null, 1)); console.log(JSON.stringify(heldByReason, null, 1)); process.exit(0) }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))

console.log('\nQ ENTITY RULING\n')
console.log(`  Q states the equation himself in : ${statesTheEquation.map(n => '#' + n).join(', ')}`)
console.log(`  signature lines excluded         : ${signatureLines.toLocaleString()}`)
console.log(`  RULED — Q the persona, = Alice   : ${persona.length} occurrences across ${Object.keys(byPost).length} drops`)
console.log(`  HELD — Q names something else    : ${held.length}`)
for (const [k, n] of Object.entries(heldByReason).sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(4)}  ${k}`)
console.log('\nwrote audit/q-entity-owner-ruling.json\n')
