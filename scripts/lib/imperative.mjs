// Imperative-mood detection, shared so no future auditor forks it.
//
// The directives auditor used a whitelist of ~40 verbs. That is why it derived only 1,460
// directives and left 1,860 stored actionRequests in disagreement: Q's instruction vocabulary
// is open-ended. "Enjoy the show." (34x), "Be ready.", "Re_read.", "Vote!", "Eyes on." are all
// instructions its verb list never contained.
//
// So decide MOOD structurally rather than by keyword, then assign family. An English imperative
// opens with a base-form verb and has no subject. The failures to guard against are noun
// phrases that merely look like commands:
//
//   "Logical thinking."      adjective + gerund — a label, not an order   (58 occurrences)
//   "Critical thinking."     same
//   "Sec detail background." three nouns, no verb at all
//   "The more you know…."    opens with a determiner
//   "Together we win."       has an explicit subject
//   "Review shows nothing."  "Review" is the subject of a reporting verb
//
// The review's warning — that keyword presence alone must not make something a directive — is
// enforced in two places: NOT_IMPERATIVE runs BEFORE any family keyword is consulted, and a
// single ambiguous verb/noun word standing alone ("Panic.", "Focus.") returns NEEDS_CONTEXT
// rather than guessing.

// Base-form verbs Q actually uses. Broad on purpose: mood is decided here, family later.
const VERBS = new Set(`
follow dig research trace compare reconcile connect map investigate verify confirm check track
search source corroborate audit analyze analyse calculate count measure locate find identify
gather collect review study examine inspect dissect decode decipher solve test probe hunt chase
pursue uncover expose reveal cross reference dig deconstruct rewind replay
read reread watch listen observe note notice see view look revisit refer focus monitor scan
zoom pay keep stay
think remember recall consider understand learn digest imagine apply expand reflect realize
realise recognize recognise picture visualize visualise gauge weigh judge decide question ask
answer wonder ponder question rethink reimagine
share spread meme archive save screenshot post publish broadcast organize organise rally
mobilize mobilise educate inform tell show teach warn alert vote call contact demand speak
amplify push distribute update release drop deliver forward relay report announce
trust pray have hold stand remain prepare fight defend protect unite enjoy relax sit buckle
rest breathe smile celebrate hope endure persist continue return come go move act help support
serve honor honour respect love forgive believe
do dont don be get make take give put set bring send bring build create start begin finish end
stop cease avoid ignore dismiss reject refuse deny leave stay wait pause hold open close turn
add remove clear clean fix repair correct adjust change replace restore reset
choose pick select define describe explain clarify list name label mark flag highlight
count sum total rank order sort filter group split join merge link tie bind
win lose survive fight resist rise fall wake awaken arise
use paint handle carry hide seek guard cover reach touch draw write speak walk run drive fly
catch throw hit strike cut break burn shine grow feed water plant harvest count trade buy sell
pass fail rank score train practice practise prepare deploy launch execute engage disengage
`.trim().split(/\s+/))

// Words that can open a sentence without it being a command.
const OPENERS_NOT_IMPERATIVE = /^(the|a|an|this|that|these|those|my|your|our|their|his|her|its|every|each|all|both|some|any|no|none|most|many|few|another|other|there|here|it|he|she|they|we|you|i|who|whom|whose|which|what|when|where|why|how|if|unless|because|since|although|though|while|whereas|and|but|or|nor|so|yet|for|of|in|on|at|to|from|by|with|about|as|than|then|thus|hence|therefore|however|also|too|very|more|most|less|least|just|only|even|still|already|always|never|often|sometimes|maybe|perhaps|likely|nothing|nobody|everything|everyone|someone|something|anything|anyone)\b/i

// Adjectives that head a label rather than a command: "Logical thinking.", "Critical mass."
const ADJECTIVE_HEAD = /^(logical|critical|important|necessary|possible|impossible|serious|major|minor|full|total|complete|final|initial|primary|secondary|public|private|internal|external|foreign|domestic|federal|national|global|local|real|fake|true|false|good|bad|big|small|large|huge|massive|strong|weak|deep|dark|light|new|old|next|last|first|second|third|future|past|present|current|former|latter|higher|lower|upper|inner|outer|open|closed|clear|clean|dirty|safe|dangerous|special|general|common|rare|simple|complex|direct|indirect|active|passive|silent|loud|quick|slow|early|late|hard|soft|sec|op|ops)\s+\w/i

// A gerund head is a noun phrase: "Thinking logically." is a label; "Think logically." is not.
const GERUND_HEAD = /^\w+ing\b/i

// Reporting verbs only ever take a subject before them. Up to two intervening tokens, so
// "Post 1234 shows the connection." and "Review of the case proves nothing." both land here.
// The intervening tokens must not be determiners — otherwise "Enjoy the show." parses as
// subject "Enjoy" + reporting verb "show", which is exactly backwards.
export const NOUN_SUBJECT_VERB = /^[\w\d]+(?:\s+(?!the\b|a\b|an\b|this\b|that\b|these\b|those\b|my\b|your\b|our\b|their\b|his\b|her\b|its\b)[\w\d'’-]+){0,2}\s+(shows?|reveals?|proves?|confirms?|indicates?|suggests?|says?|states?|means?|appears?|seems?|remains?|continues?|includes?|contains?|reflects?|demonstrates?|tells?|points?|matters?|counts?|helps?|begins?|ends?|comes?|goes?|works?|wins?|loses?)\b/i

// A copula, "of", or a number after the first word makes that word the subject.
const NOUN_USAGE = /^\w+\s+(is|are|was|were|will|would|can|could|should|may|might|must|has|have|had|of|\d)/i

// Fixed instruction idioms with no leading verb.
// Only idioms that actually INSTRUCT. "nothing to see here", "game over" and "wheels up" were
// in this list and forced three statements into imperative mood — Q characterising a situation
// ("GAME OVER.", "Wheels up.") is not an instruction to the reader.
const IDIOMS = /^(eyes on|godspeed|god speed|all hands|heads up|hands on deck|attention on deck)\b/i

// Words that are equally common as noun and verb. Standing alone they are undecidable.
const AMBIGUOUS_SOLO = new Set('panic focus trust fight watch stand hold name question answer drop link record report count source review check note post map search trace list study rest change turn help support love hope play win control power order command force press guard rush stop'.split(' '))

const firstWord = t => (t.trim().toLowerCase().match(/^[a-z_]+/i)?.[0] ?? '').replace(/_/g, '')

// An adverb in front of a command does not stop it being a command: "Now think fire(s).",
// "Highly recommend someone take all my crumbs…". Stripped before the verb test, never before
// the subject tests — "Never forget." is a prohibition and must keep its lead.
const LEADING_ADVERB = /^(now|then|again|first|next|finally|quickly|immediately|carefully|closely|highly|strongly|simply|please|really|truly|literally|also|likewise|meanwhile|today|tomorrow|tonight|soon)\s+(?=[a-z])/i

/**
 * Verbs learned from the corpus itself, so the lexicon is not a closed hand-list.
 *
 * A fixed verb list is exactly what made the frozen directives auditor miss ~1,300 units, and
 * hand-extending it only moves the boundary. Instead: a word is a verb if the corpus uses it
 * as one somewhere — directly after a MODAL, which in English is followed by a bare infinitive.
 *
 * The infinitive marker "to" looks like the obvious extra signal and must NOT be used: "to" is
 * also a preposition, so "to power", "to justice", "to war" and "to POTUS" all mint nouns as
 * verbs. Including it produced 1,793 unfamilied "directives" led by POTUS, FISA, HRC, MSM and
 * JUSTICE — a precision collapse that made the whole pass worthless.
 *
 * Requires two independent sightings so a one-off typo cannot mint a verb.
 */
export function learnVerbsFromCorpus(texts) {
  const seen = new Map()
  const RX = /\b(?:will|would|can|could|should|shall|must|may|might|let\s+us|let's|cannot)\s+([a-z][a-z-]{2,})\b/gi
  // A modal only precedes a bare infinitive in a STATEMENT. In a question it is inverted and
  // what follows is the SUBJECT: "Will POTUS declassify?", "Can Mueller prove it?". Learning
  // from those minted POTUS, MUELLER, SESSIONS and DECLAS as verbs, which then read
  // "POTUS DECLINE>" and "FBI burning midnight oil." as commands.
  const NEGATOR = /^(not|never|no|also|still|only|just|always|then|now|well|really|ever|even|soon|already|almost|simply|surely|certainly|probably)$/i
  for (const t of texts) {
    for (const line of (t ?? '').split('\n')) {
      if (/\?\s*$/.test(line.trim())) continue          // interrogative — modal is inverted
      const s = line.toLowerCase()
      let m
      RX.lastIndex = 0
      while ((m = RX.exec(s)) !== null) {
        const w = m[1]
        if (NEGATOR.test(w) || OPENERS_NOT_IMPERATIVE.test(w)) continue
        seen.set(w, (seen.get(w) ?? 0) + 1)
      }
    }
  }
  const out = new Set()
  for (const [w, n] of seen) if (n >= 2) out.add(w)
  return out
}

/**
 * Decide whether a unit is in the imperative mood.
 * Returns { imperative: boolean, undecidable?: true, why: string }
 */
export function imperativeMood(text, extraVerbs) {
  const t = (text ?? '').trim()
  if (!t) return { imperative: false, why: 'empty' }

  const bare = t.replace(/^[>\s]+/, '').replace(/[.!?…]+$/, '').trim()
  const w = firstWord(bare)
  const wordCount = bare.split(/\s+/).filter(Boolean).length
  const knows = x => VERBS.has(x) || Boolean(extraVerbs?.has(x))

  if (IDIOMS.test(bare)) return { imperative: true, why: 'fixed instruction idiom' }

  // A hyphenated compound of three or more parts is a NOUN, whatever its first token is:
  // "PAY-FOR-PLAY SPIDER WEB." opens with "pay", which is a verb, and was read as a command.
  // Two-part compounds are left alone so "Re-read the crumbs." keeps working.
  if (/^[a-z]+(-[a-z]+){2,}/i.test(bare)) {
    return { imperative: false, why: 'multi-part hyphenated compound — a noun phrase, not a command' }
  }

  // A lone verb/noun word is undecidable without the surrounding drop. Checked first: "Panic."
  // is not in the verb lexicon, so it would otherwise be silently ruled a statement.
  if (wordCount === 1 && AMBIGUOUS_SOLO.has(w)) {
    return { imperative: false, undecidable: true, why: `"${bare}" standing alone is equally a noun and a command — needs the surrounding drop` }
  }

  // Order matters: mood is refused BEFORE any family keyword is consulted, so a keyword can
  // never promote a noun phrase into a directive.
  if (OPENERS_NOT_IMPERATIVE.test(bare)) return { imperative: false, why: 'opens with a determiner, pronoun or conjunction — has a subject' }
  // …but only when the head is not itself a verb: "open", "clear", "close" and "light" are both.
  if (ADJECTIVE_HEAD.test(bare) && !knows(w)) return { imperative: false, why: 'adjective heading a noun phrase, not a command' }
  if (GERUND_HEAD.test(bare)) return { imperative: false, why: 'gerund head — a label, not a command' }
  if (NOUN_SUBJECT_VERB.test(bare)) return { imperative: false, why: 'first word is the subject of a reporting verb' }
  if (NOUN_USAGE.test(bare)) return { imperative: false, why: 'first word followed by a copula, "of" or a number — it is the subject' }

  if (/^(do not|don'?t|never|stop|cease|avoid|ignore|dismiss)\b/i.test(bare)) return { imperative: true, why: 'negative imperative' }
  if (/^be\b/i.test(bare)) return { imperative: true, why: '"be" + complement — imperative' }

  if (VERBS.has(w)) return { imperative: true, why: `opens with the base-form verb "${w}" and has no subject` }
  // Verb known only from corpus evidence, never from the curated list. Flagged so callers can
  // band it lower: the modal signal is good but not clean — Q writes questions without question
  // marks, so a few subjects still slip through as "verbs".
  if (extraVerbs?.has(w)) return { imperative: true, learned: true, why: `opens with "${w}", used as a verb elsewhere in the corpus` }

  // A leading adverb does not stop a command being a command.
  if (LEADING_ADVERB.test(bare)) {
    const after = bare.replace(LEADING_ADVERB, '')
    const w2 = firstWord(after)
    if (knows(w2)) return { imperative: true, learned: !VERBS.has(w2), why: `adverb "${w}" in front of the base-form verb "${w2}"` }
  }
  return { imperative: false, why: `opens with "${w}", which is not a base-form verb` }
}

// Family is assigned only AFTER mood is confirmed.
const FAMILY_RULES = [
  // The apostrophe class matters: Q writes "Don’t forget about Huma." with a CURLY
  // apostrophe, and a straight-quote-only pattern sent all 7 of those to no-family.
  ['prohibition', /^(do not|don['’]?t|never|stop|cease|avoid|ignore|dismiss|reject|refuse|deny)\b/i],
  // "be" + a disposition adjective is morale generically — a fixed "be strong|be ready" list
  // left "Be proud.", "Be prepared.", "Be careful who you follow." and "Be aware of your
  // surroundings." with no family. "Be here tomorrow." is deliberately NOT covered: that is
  // operational, and the adjective list keeps the two apart.
  ['morale', /^(trust|pray|have faith|keep faith|have a (nice|wonderful|great|good|blessed)|stay|stand|hold the line|be\s+(strong|vigilant|ready|safe|well|brave|patient|proud|prepared|careful|aware|calm|smart|wise|kind|good|blessed|encouraged|fearless|confident)|remain|prepare|fight|defend|protect|unite|unify|rise up|enjoy|relax|sit back|buckle|godspeed|rest|breathe|smile|celebrate|endure|persist|go with god|god bless|keep going|have hope|believe)\b/i],
  ['attention', /^(attention on deck|all hands on deck|eyes on|read|re-?read|re_?read|watch|listen|observe|note|notice|see|view|look|revisit|refer|focus|monitor|scan|zoom|eyes on|pay attention|stay tuned|keep watching)\b/i],
  // "ask yourself" and "question everything" are cognition instructions, not research: the
  // deliverable is a realisation, not a finding. They were in the old adjudicator's family map
  // and were lost when it moved here, sending 12 units to no-family.
  ['cognition', /^(think|remember|recall|consider|understand|learn|digest|imagine|apply|expand|reflect|realize|realise|recogni[sz]e|picture|visuali[sz]e|gauge|weigh|judge|decide|use logic|use your|open your eyes|open their eyes|wake|awaken|rethink|paint the picture|ask yourself|question everything|wonder)\b/i],
  ['dissemination', /^(share|spread|meme|archive|save|screenshot|post|publish|broadcast|organi[sz]e|rally|mobili[sz]e|educate|inform|tell|show|teach|warn|alert|vote|call|contact|demand|speak|amplify|push|distribute|release|announce|update|report|relay|flag|be heard|be loud)\b/i],
  ['research', /^(follow|dig|research|trace|compare|reconcile|cross|connect|map|investigate|verify|confirm|check|track|search|source|corroborate|audit|analy[sz]e|calculate|count|measure|locate|find|identify|gather|collect|review|study|examine|inspect|dissect|decode|decipher|solve|test|probe|hunt|chase|pursue|uncover|expose|reveal|define|list|name)\b/i],
  // OPERATIONAL — the seventh family. Directives whose primary function is to perform,
  // initiate, maintain, alter, prepare, organise or control an action or state, rather than to
  // research, think, attend, sustain morale, spread, or forbid.
  //
  //   "Keep open (+6 mo)."   "Open source."   "Make a list."
  //   "Control the information (THEY)."   "READY THE MEMES."   "DISARM."
  //
  // Last in the list so it can only take what the other six leave. It is deliberately a verb
  // set and NOT a bare catch-all: a genuine no-family residue has to stay visible for
  // adjudication rather than being quietly absorbed here.
  ['operational', /^(keep|make|put|take|start|begin|end|add|remove|set|handle|get|give|select|clear|clean|build|create|continue|buy|sell|trade|wait|pause|come|close|deploy|launch|execute|engage|disengage|pick|choose|join|leave|move|turn|change|fix|repair|adjust|replace|restore|reset|control|ready|disarm|arm|activate|initiate|maintain|organi[sz]e|return|go|drop|use|do|open|feed|water|plant|harvest|cut|break|mark|flag|link|tie|bind|sort|rank|order|filter|split|merge|pass|run|deliver|send|bring|carry|cover|reach|draw|write|walk|drive|catch|throw|hit|strike|grow|act|hold|correct|assemble|install|remain)\b/i],
]

export function familyOf(text) {
  const bare = (text ?? '').replace(/^[>\s]+/, '').trim()
  for (const [family, rx] of FAMILY_RULES) if (rx.test(bare)) return family
  // The mood test already strips a leading adverb; family assignment did not, so "Please pray."
  // (11 units) and "Now think about the timing…" landed in no-family despite being plain
  // morale and cognition. Same strip, same rules — never a different rule.
  if (LEADING_ADVERB.test(bare)) {
    const after = bare.replace(LEADING_ADVERB, '')
    for (const [family, rx] of FAMILY_RULES) if (rx.test(after)) return family
  }
  return 'other'
}
