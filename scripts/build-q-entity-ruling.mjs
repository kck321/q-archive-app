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
      if (why) held.push({ ...row, names: why[1] })
      else persona.push(row)
    }
  })
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

if (check) { console.log(JSON.stringify(out.totals, null, 1)); console.log(JSON.stringify(heldByReason, null, 1)); process.exit(0) }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))

console.log('\nQ ENTITY RULING\n')
console.log(`  Q states the equation himself in : ${statesTheEquation.map(n => '#' + n).join(', ')}`)
console.log(`  signature lines excluded         : ${signatureLines.toLocaleString()}`)
console.log(`  RULED — Q the persona, = Alice   : ${persona.length} occurrences across ${Object.keys(byPost).length} drops`)
console.log(`  HELD — Q names something else    : ${held.length}`)
for (const [k, n] of Object.entries(heldByReason).sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(4)}  ${k}`)
console.log('\nwrote audit/q-entity-owner-ruling.json\n')
