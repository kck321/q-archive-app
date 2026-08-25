// Family assignment for the 486 directives the owner ruled out of the unhighlighted-sentence
// queue, 2026-08-20.
//
// WHY THIS IS NOT A CHANGE TO imperative.mjs
// ─────────────────────────────────────────
// familyOf() in lib/imperative.mjs is the DETECTOR that produced the certified 2,552 directives
// and their family split. Widening its regexes to swallow this batch would silently re-family
// rows in that certified set — a derive-step drift, of exactly the kind the chain notes describe,
// arriving inside an unrelated ruling. So the detector is untouched: familyOf() is asked first and
// its answer is always kept, and only the residue it calls 'other' is decided here.
//
// WHAT THE RESIDUE ACTUALLY IS
// ────────────────────────────
// 378 of the 486 fall outside the detector, and they are not a random tail. The detector keys on a
// leading imperative VERB, and this queue is dominated by four shapes that carry no verb at all:
//
//   nominal instructions      "Logical thinking."  "Critical thinking."   -> cognition
//   worth-framed pointers     "Worth remembering."  "Worth following."    -> attention
//   thanks and valedictions   "Thank you Anon."  "Sweet dreams."          -> morale
//   unity slogans and prayer  "UNITED WE STAND."  "Our Father who art..." -> morale
//
// Each rule below states the FUNCTION it is claiming, because that is what a family is. Ordered,
// first match wins, and anything still unmatched is returned as 'other' so the applier can refuse
// rather than absorb it — a silent catch-all is the one thing this file must not become.
const RULES = [
  // PROHIBITION — forbidding, wherever the negation sits in the line.
  ['prohibition', /^["'“”\s]*never\b|\b(do not|don['’]?t)\s+(?!know\b|say\b)/i],

  // COGNITION — the deliverable is a realisation. Nominal forms of the detector's own verbs
  // ("Logical thinking." is "think logically"), plus the civic reasoning Q quotes from the
  // Declaration, whose whole function is "reason about when government must be replaced".
  ['cognition', /^["'“”\s]*(logical|critical|independent|free)\s+think|^["'“”\s]*(think|thought)\b|^["'“”\s]*you decide\b|^["'“”\s]*try harder\b|^["'“”\s]*(prudence|but when a long train|[—–—]?\s*that whenever any form|that to secure these rights|we hold these truths)\b/i],

  // ATTENTION — the deliverable is noticing. "Worth X" is Q's standard way of pointing at
  // something without an imperative verb, and re-review / re-listen / refocus are the same act.
  ['attention', /^["'“”\s]*worth\b|^["'“”\s]*re[-_ ]?(review|listen|watch|visit)\b|^["'“”\s]*refocus\b|^["'“”\s]*(eyes on|watch)\b|^["'“”\s]*(final|finally)[.!]?$|^["'“”\s]*(you['’]ll know when|let['’]s see what happens)\b/i],

  // DISSEMINATION — the deliverable reaches other people. Memes are this archive's own word for it.
  ['dissemination', /\bmemes?\b|^["'“”\s]*(destroy the narrative|shine the light)\b|^["'“”\s]*(spread|share|post|educate and inform)\b|^["'“”\s]*we must bring honesty back\b/i],

  // RESEARCH — the deliverable is a finding.
  ['research', /^["'“”\s]*(explore|obtain|scroll|dig|trace|source)\b|^["'“”\s]*\(?compare\b|\bfind out\b|^["'“”\s]*play a game of\b/i],

  // MORALE — the deliverable is that the reader keeps going: thanks, blessing, prayer, pledge,
  // valediction, and the unity slogans. Scripture and the Lord's Prayer are here because Q quotes
  // them to steady the reader, which is what this family means, not because they are religious.
  ['morale', /^["'“”\s]*(thank|thanks|personal thank)\b|^["'“”\s]*(god|thy|our father|amen|so help me god|may god)\b|\bgod bless\b|^["'“”\s]*(happy|sweet dreams|good ?night|goodnight|godspeed|good speed|roger that|feel proud|hooah|honor|rip|love of country)\b|^["'“”\s]*(united|unity|together|strong together|we stand|patriots united|we are united)\b|^["'“”\s]*(for (god|humanity|our struggle|freedom)|therefore put on|finally, be strong|in addition to all this|with this in mind|you prepare a table|and (pray|lead us)|i pledge allegiance|let us reaffirm)\b|^["'“”\s]*(your (president|country|move))\b|^["'“”\s]*(fly high|stay strong|hope you|try to get some sleep|welcome (aboard|to the))\b|^["'“”\s]*(simply )?be (strong|on your guard|diligent|vigilant|ready|safe|proud|courageous)\b|^["'“”\s]*\d*\s*take the (helmet|shield)\b|^["'“”\s]*forgive my sins\b/i],

  // OPERATIONAL — the deliverable is an action or a state change. Last, so it can only take what
  // the six above leave, and still a stated verb/idiom set rather than a catch-all.
  ['operational', /^["'“”\s]*(fire|battle stations|insert|deboard|rig for|green|sky|blue|red|it['’]?s time|stand ?by|standby|prepare|ready|activate|deploy|launch|proceed|hold|clean|clear|lock|load|open|close|every asset)\b|^["'“”\s]*that guidance will take into account\b/i],
]

// FRAGMENTS OF A DIRECTIVE THE SEGMENTER SPLIT, named by post so nothing else can match them.
//
// #3220 writes "THINK. FOR. YOURSELF." on one line and unitsFor() makes three units of it. "FOR."
// and "YOURSELF." are cognition because "THINK." is — they are the same instruction — and a regex
// broad enough to catch a bare "FOR." would catch it everywhere else too. #3220's "This." is the
// opening of "This. Is. CNN." and points at the video above it, which is attention.
//
// Listed rather than inferred, because a two-word fragment cannot state its own function and
// guessing one would put invented certainty into a certified count.
const FRAGMENTS = new Map([
  ['3220|FOR.', 'cognition'],
  ['3220|YOURSELF.', 'cognition'],
  ['3220|This.', 'attention'],
])

/** The family for one ruled directive, or 'other' when no rule states one. */
// ── ROUND 2 OF THE REVIEW, 2026-08-24 ───────────────────────────────────────
//
// 479 more directives, of which 371 fall outside both the detector and the round-1 rules. They
// are a different residue from round 1's: where that batch was nominal instructions and
// valedictions, this one is dominated by three shapes.
//
//   the unity slogan       WWG1WGA!!!  ·  We, the PEOPLE.        ~200 occurrences -> morale
//   the hashtag            #FLAGSOUT  ·  #FactsMatter  ·  #FLYROTHSFLY#          -> dissemination
//   the alert marker       ::::WARNING::::  ·  IMPORTANT:  ·  WARNING_UK_        -> attention
//
// APPENDED, never interleaved, so round 1's answers cannot move: RULES is first-match-wins and
// round 1 leaves no line unmatched, so nothing already classified can reach these.
//
// A HASHTAG IS AN INSTRUCTION TO SPREAD IT. That is what dissemination means here and it is why
// the family is not a stretch — Q posts "#InternetBillOfRights" so the board carries it. But the
// rule requires a LETTER after the hash, because "#1", "#2" and "#17" are counters and a rule
// broad enough to take them would certify a list marker as a call to action.
RULES.push(
  // MORALE — the unity slogans, the seasonal and valedictory lines, and the quoted encouragement.
  ['morale', /^["'“”\s]*wwg1wga\b|^["'“”\s]*we,?\s*the\s*people\b|^["'“”\s]*merry christmas\b|^["'“”\s]*thoughts and prayers\b|^["'“”\s]*to all americans, please pray\b|^["'“”\s]*the armor of god\b|^["'“”\s]*keep fighting\b|^["'“”\s]*feel privileged\b|^["'“”\s]*[“"]?the great awakening\b|^["'“”\s]*for anons\b|^["'“”\s]*[“"]?but the lord is faithful\b|^["'“”\s]*[“"]?when you can.t make them see the light\b|^["'“”\s]*it must be fought for\b/i],

  // ATTENTION — the alert markers and the pointers. Q's ":::::Flash Traffic:::::" and
  // "::::WARNING::::" exist to make the reader look; so do the board paths he posts bare.
  ['attention', /^["'“”\s]*:*\s*warning\b|^warning_|^["'“”\s]*:+\s*flash traffic\b|^["'“”\s]*important( context| to remember)?\s*:|^["'“”\s]*a little perspective\b|^\/[a-z]+\/\s*$|^["'“”\s]*mayday\b/i],

  // DISSEMINATION — a hashtag, in every shape Q writes one. A LETTER (or a bracket, for
  // "#[[[RR]]]#") must follow the hash: see the note above about counters.
  ['dissemination', /^#{1,2}[A-Za-z[]|^["'“”\s]*_the_floor_is_yours_|^#1776\b/i],

  // RESEARCH — "track & follow" names a finding as the deliverable.
  ['research', /\btrack\s*&\s*follow\b/i],

  // COGNITION — the deliverable is a realisation, including the Declaration's opening, which
  // round 1 already places here for its later paragraphs.
  ['cognition', /^["'“”\s]*comprehend\b|^["'“”\s]*['‘]?group.think|^["'“”\s]*when in the course of human events\b/i],

  // OPERATIONAL — an action or a state change, including the numbers Q posts so the reader
  // CALLS them (the White House switchboard, the crisis line) and the instructions he quotes.
  ['operational', /^["'“”\s]*:?\s*stay at home\b|^["'“”\s]*[“"]keep them (starved|blind|stupid)|^["'“”\s]*command away from generals\b|^["'“”\s]*[“"]set the stage\b|^["'“”\s]*\*think scramble\b|^["'“”\s]*:?protect[_ ]|^["'“”\s]*\(?\d{3}[)\s-]\s*\d{3}-\d{4}\s*$|^["'“”\s]*1-\d{3}-\d{3}-\d{4}\s*$/i],
)

// APPENDED 2026-08-25 for the owner's #4949 ruling: the Gettysburg Address line ("that this
// nation, under God, shall have a new birth of freedom…") is a Directive. Quoted patriotic
// exhortation, the same bucket as the unity slogans and the Declaration's opening — morale.
// Without this the span falls through to 'other', which the QA gate refuses.
RULES.push(
  ['morale', /^["'“”\s]*that this nation, under god\b/i],
)

// ── LINES THAT STATE NO INSTRUCTION ────────────────────────────────────────
//
// Four shapes on the Q Directives sheet instruct nobody to do anything, and no honest family
// exists for them. Rather than invent one — which is what a catch-all would be — they are named
// here, HELD out of the directive rulings, and reported for the owner to place.
//
//   list markers      "#1"  "#2"  "#17"  "#64"  "#21 - #25"   — #953 numbers its own lines
//   structural ends   "_END_"  "-END-"  "—end—"  "End_of_Topic"
//   comms strings     "Bunker Apple Yellow Sky [… + 1]"  "Approval 58203-JX"
//   one assertion     #17's "…shills log and send new info back to ASF for instruction."
//
// A directive is where Q instructs the reader to act. A counter is not one, and certifying it as
// one would put a list marker in a section that answers "what did Q tell the reader to do?".
const NOT_AN_INSTRUCTION = [
  // "#1776" is excluded by name: it is the founding year used as a rallying hashtag, which is the
  // one all-digit hash in this batch that IS a call to spread something.
  [/^#(?!1776\b)\d+(\s*[-–—]\s*#\d+)?\.?$/, 'a list marker numbering the drop\'s own lines, not an instruction'],
  [/^[_\-–—…\s]*end([_\s]of[_\s]topic)?[_\-–—\s]*$/i, 'a structural end-marker, not an instruction'],
  [/^bunker apple yellow sky\b/i, 'a comms string — belongs with the Resolution Center lines, not Directives'],
  [/^approval \d+-[A-Z]+$/i, 'a comms string — belongs with the Resolution Center lines, not Directives'],
  [/^in case you didn.t know, shills log\b/i, 'an assertion about what shills do — a Claim in shape, not an instruction'],
]

/** Why this line states no instruction, or null when it does. */
export function statesNoInstruction(text) {
  const bare = String(text ?? '').replace(/^[>\s]+/, '').trim()
  for (const [rx, why] of NOT_AN_INSTRUCTION) if (rx.test(bare)) return why
  return null
}

export function queueFamilyOf(text, postNum) {
  // Q'S OWN WRAPPING IS NOT PART OF THE PHRASE. He writes "(((WWG1WGA)))" on #2347 and "WWG1WGA" on
  // 168 other drops — the same valediction, and the same family. The leading ">" strip was already
  // here for the same reason; triple parentheses are the other wrapper he uses, and without this a
  // span the owner widened to include them fell through to 'other', which the QA gate refuses.
  //
  // Symmetric on purpose: only marks that come in pairs are stripped, so a phrase is never
  // shortened into a different phrase.
  const wrapped = String(text ?? '').trim().match(/^(\(+)\s*([\s\S]*?)\s*(\)+)$/)
  const unwrapped = wrapped && wrapped[1].length === wrapped[3].length ? wrapped[2] : text
  const bare = String(unwrapped ?? '').replace(/^[>\s]+/, '').trim()
  const frag = FRAGMENTS.get(`${postNum}|${bare}`)
  if (frag) return frag
  for (const [family, rx] of RULES) if (rx.test(bare)) return family
  return 'other'
}
