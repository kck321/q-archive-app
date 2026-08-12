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
const IDIOMS = /^(eyes on|godspeed|god speed|wheels up|game over|full steam|all hands|heads up|hands on deck|attention on deck|nothing to see here)\b/i

// Words that are equally common as noun and verb. Standing alone they are undecidable.
const AMBIGUOUS_SOLO = new Set('panic focus trust fight watch stand hold name question answer drop link record report count source review check note post map search trace list study rest change turn help support love hope play win control power order command force press guard rush stop'.split(' '))

const firstWord = t => (t.trim().toLowerCase().match(/^[a-z_]+/i)?.[0] ?? '').replace(/_/g, '')

/**
 * Decide whether a unit is in the imperative mood.
 * Returns { imperative: boolean, undecidable?: true, why: string }
 */
export function imperativeMood(text) {
  const t = (text ?? '').trim()
  if (!t) return { imperative: false, why: 'empty' }

  const bare = t.replace(/^[>\s]+/, '').replace(/[.!?…]+$/, '').trim()
  const w = firstWord(bare)
  const wordCount = bare.split(/\s+/).filter(Boolean).length

  if (IDIOMS.test(bare)) return { imperative: true, why: 'fixed instruction idiom' }

  // A lone verb/noun word is undecidable without the surrounding drop. Checked first: "Panic."
  // is not in the verb lexicon, so it would otherwise be silently ruled a statement.
  if (wordCount === 1 && AMBIGUOUS_SOLO.has(w)) {
    return { imperative: false, undecidable: true, why: `"${bare}" standing alone is equally a noun and a command — needs the surrounding drop` }
  }

  // Order matters: mood is refused BEFORE any family keyword is consulted, so a keyword can
  // never promote a noun phrase into a directive.
  if (OPENERS_NOT_IMPERATIVE.test(bare)) return { imperative: false, why: 'opens with a determiner, pronoun or conjunction — has a subject' }
  // …but only when the head is not itself a verb: "open", "clear", "close" and "light" are both.
  if (ADJECTIVE_HEAD.test(bare) && !VERBS.has(w)) return { imperative: false, why: 'adjective heading a noun phrase, not a command' }
  if (GERUND_HEAD.test(bare)) return { imperative: false, why: 'gerund head — a label, not a command' }
  if (NOUN_SUBJECT_VERB.test(bare)) return { imperative: false, why: 'first word is the subject of a reporting verb' }
  if (NOUN_USAGE.test(bare)) return { imperative: false, why: 'first word followed by a copula, "of" or a number — it is the subject' }

  if (/^(do not|don'?t|never|stop|cease|avoid|ignore|dismiss)\b/i.test(bare)) return { imperative: true, why: 'negative imperative' }
  if (/^be\b/i.test(bare)) return { imperative: true, why: '"be" + complement — imperative' }

  if (!VERBS.has(w)) return { imperative: false, why: `opens with "${w}", which is not a base-form verb` }
  return { imperative: true, why: `opens with the base-form verb "${w}" and has no subject` }
}

// Family is assigned only AFTER mood is confirmed.
const FAMILY_RULES = [
  ['prohibition', /^(do not|don'?t|never|stop|cease|avoid|ignore|dismiss|reject|refuse|deny)\b/i],
  ['morale', /^(trust|pray|have faith|keep faith|stay|stand|hold the line|be strong|be vigilant|be ready|be safe|be well|be brave|be patient|remain|prepare|fight|defend|protect|unite|enjoy|relax|sit back|buckle|godspeed|rest|breathe|smile|celebrate|endure|persist|go with god|god bless|keep going|have hope|believe)\b/i],
  ['attention', /^(read|re-?read|re_?read|watch|listen|observe|note|notice|see|view|look|revisit|refer|focus|monitor|scan|zoom|eyes on|pay attention|stay tuned|keep watching)\b/i],
  ['cognition', /^(think|remember|recall|consider|understand|learn|digest|imagine|apply|expand|reflect|realize|realise|recogni[sz]e|picture|visuali[sz]e|gauge|weigh|judge|decide|use logic|use your|open your eyes|open their eyes|wake|awaken|rethink|paint the picture)\b/i],
  ['dissemination', /^(share|spread|meme|archive|save|screenshot|post|publish|broadcast|organi[sz]e|rally|mobili[sz]e|educate|inform|tell|show|teach|warn|alert|vote|call|contact|demand|speak|amplify|push|distribute|release|announce|update|be heard|be loud)\b/i],
  ['research', /^(follow|dig|research|trace|compare|reconcile|cross|connect|map|investigate|verify|confirm|check|track|search|source|corroborate|audit|analy[sz]e|calculate|count|measure|locate|find|identify|gather|collect|review|study|examine|inspect|dissect|decode|decipher|solve|test|probe|hunt|chase|pursue|uncover|expose|reveal|define|list|name)\b/i],
]

export function familyOf(text) {
  const bare = (text ?? '').replace(/^[>\s]+/, '').trim()
  for (const [family, rx] of FAMILY_RULES) if (rx.test(bare)) return family
  return 'other'
}
