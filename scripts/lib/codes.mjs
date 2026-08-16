// Codes & Brackets — a NOTATION layer, not a semantic class.
//
// The question is what unusual notation, shorthand, bracket syntax, coded phrase, marker or
// recurring symbolic pattern Q used. Not what it means: this section preserves the notation
// exactly and says plainly when the meaning is unknown.
//
// THE TWO BOUNDARIES THAT KEEP IT HONEST, both found by surveying the corpus first:
//
//   A bracket around an ordinary word is not a code. 554 of the 1,923 distinct bracketed
//   tokens wrap a plain lowercase word — [raid], [now], [children], [vital], [knowingly].
//   That is Q marking a word for attention, which is EMPHASIS. Absorbing it here would make
//   Codes the biggest section in the app by swallowing a formatting habit.
//
//   ALL CAPS on its own is not a code either. Q writes in caps constantly; caps become
//   notation only with structure — an underscore, a digit, a bracket.
//
// And most of what looks numeric is dates: 08/09, 03/31, 04/06 are timestamps Q cited, not
// ciphers. Only genuinely symbolic forms count — 5:5, 1=1, 2+2=6.

export const CODE_TYPES = [
  'bracketed_token', 'coded_phrase', 'numeric_symbolic',
  'obfuscated_shorthand', 'operational_marker', 'formatting_pattern',
]

/** A bracketed token is notation when it carries structure, not when it wraps a plain word. */
export const BRACKET_CODEY = /^\[(?=[^\]]*[A-Z0-9_])[A-Z0-9_ .:#\/&+-]{1,40}\]$/
/** Brackets around an ordinary lowercase word or phrase — Emphasis, not Codes. */
export const BRACKET_EMPHASIS = /^\[[a-z][a-z\s'’-]{0,30}\]$/

/** Dates masquerading as codes. MM/DD, M/D, MM/DD/YY and bare year ranges. */
export const LOOKS_LIKE_DATE = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/
/** Genuinely symbolic numeric forms. */
export const NUMERIC_CODE = [
  { rx: /^\d{1,2}:\d{1,2}$/, note: 'radio-style pair, e.g. 5:5' },
  { rx: /^\d+\s*=\s*\d+$/, note: 'equivalence assertion, e.g. 1=1' },
  { rx: /^\d+\s*\+\s*\d+\s*=\s*\d+$/, note: 'arithmetic assertion, e.g. 2+2=5' },
  { rx: /^\d+\/\d{2,3}$/, note: 'ratio, e.g. 1/100' },
]

/** Underscore obfuscation — Q splitting a name so it does not read as the plain word. */
export const OBFUSCATED = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+_?$/

/** Coded phrases and operation-style names carried over from the entity passes. */
export const CODED_PHRASES = new Set([
  'RED OCTOBER', 'RED_OCTOBER', 'Red October', 'CASTLE ROCK', 'CASTLE_ROCK', 'Castle Rock',
  'Castle LOCK', 'Red Castle', 'Green Castle', 'Sparrow Red', 'Mad Hatter', 'Wizards & Warlocks',
  'Snow White', 'SNOW WHITE', 'Iron Eagle', 'Godfather III', 'Alice & Wonderland',
  'Wheels Up', 'Watch the water', 'Clowns In America', 'The Hunt For',
])

/** Status and phase markers. */
// The underscore is required on CONF_: without it this matched a bare "Confirmed." twenty
// times, which is Q asserting something — a claim, already certified as one — not a status
// marker. A marker has to look like notation.
export const OPERATIONAL_MARKER = /^(DEFCON\s*\d?|CONF_\w+|NO GO|GREEN LIGHT|STANDBY|PHASE\s*\d|STAGE\s*\d|COMMS?\s*(DARK|OPEN|CLEAR))$/i

/**
 * Interpretations offered ONLY where the corpus itself carries the evidence. Everything else
 * ships with no meaning attached, which is the honest state for most of this section.
 */
export const KNOWN_MEANINGS = {
  C_A: { meaning: 'CIA, written with an underscore', confidence: 'HIGH', basis: 'Q writes C_A and CIA interchangeably across the corpus in the same contexts' },
  '5:5': { meaning: 'Radio idiom for "loud and clear" — a confirmation check', confidence: 'MEDIUM', basis: 'appears alone after a statement or link, immediately before Q\'s signature, in all 29 occurrences' },
  D_PARTY: { meaning: 'The Democratic Party', confidence: 'HIGH', basis: 'Q alternates D_PARTY, D party and Democrats in equivalent sentences' },
  MS_13: { meaning: 'The MS-13 gang', confidence: 'HIGH', basis: 'Q writes MS_13, MS13 and MS-13 for the same subject' },
  RE_READ: { meaning: 'An instruction to read an earlier drop again', confidence: 'HIGH', basis: 'used interchangeably with "Re_read" and "Reread" as a directive' },
  // Owner decode, 2026-08-14. These were the two largest undecoded bracketed tokens in the
  // corpus — [D] at 195 occurrences across 121 posts, [F] at 23 across 18 — and they sat with no
  // interpretation because the corpus never spells either one out. The owner supplied the
  // reading; the confidence is OWNER rather than HIGH so the provenance stays visible, since
  // this is an adjudication rather than a pattern the corpus established on its own.
  '[D]': { meaning: 'Democrat', confidence: 'OWNER', basis: 'owner ruling 2026-08-14 — Q uses [D] as the party abbreviation, alongside D_PARTY and "D party" in equivalent sentences' },
  '[F]': { meaning: 'Foreign', confidence: 'OWNER', basis: 'owner ruling 2026-08-14 — Q pairs [D] and [F] as actor abbreviations, e.g. "[D]s in coordination w/ [D]&[F] assets"' },
}

export const CODE_TYPE_INFO = {
  bracketed_token: 'Bracketed shorthand carrying structure — initials, digits or a classification string.',
  coded_phrase: 'A named phrase used as a codeword rather than for its literal meaning.',
  numeric_symbolic: 'Numeric or symbolic forms used as notation rather than as quantities.',
  obfuscated_shorthand: 'A name split with underscores so it does not read as the plain word.',
  operational_marker: 'Status, phase or readiness markers.',
  formatting_pattern: 'Recurring stylised notation that is meaningful beyond ordinary emphasis.',
}
