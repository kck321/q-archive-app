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
export function queueFamilyOf(text, postNum) {
  const bare = String(text ?? '').replace(/^[>\s]+/, '').trim()
  const frag = FRAGMENTS.get(`${postNum}|${bare}`)
  if (frag) return frag
  for (const [family, rx] of RULES) if (rx.test(bare)) return family
  return 'other'
}
