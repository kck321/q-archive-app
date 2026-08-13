// Canonical section definitions — the single source of truth for the explanatory language.
//
// Both the per-section ⓘ popover and the Classification Method page read from here, so the
// short blurb a user sees on a section can never drift from the full methodology. Writing the
// wording twice is the same failure this project has hit repeatedly with logic (two question
// rules, three highlighters, six chart axes) and it would be worse here: the whole point is
// telling users what a number means.
//
// Certified counts are written in ONE place (CERTIFIED below) and interpolated, so a future
// recount cannot leave a stale figure in prose.

export const CERTIFIED = {
  questions: { occurrences: 6442, distinct: 5302, posts: 1696 },
  directives: { occurrences: 2422, distinct: 1472, posts: 1417 },
  /** Units that are BOTH a question and a directive. */
  overlap: 228,
  totalPosts: 4966,
} as const

const n = (x: number) => x.toLocaleString()

export interface DirectiveFamily {
  key: string
  label: string
  blurb: string
  examples: string[]
}

export const DIRECTIVE_FAMILIES: DirectiveFamily[] = [
  { key: 'cognition', label: 'Cognition', blurb: 'Instructions about thinking, reasoning, questioning assumptions, connecting information, or using logic.', examples: ['Think logically.', 'Ask yourself why.'] },
  { key: 'research', label: 'Research', blurb: 'Instructions to investigate, search, trace, dig into, identify, review, or research information.', examples: ['Trace background.', 'Dig deeper.'] },
  { key: 'morale', label: 'Morale', blurb: 'Encouragement, confidence-building, patience, perseverance, faith, or reassurance.', examples: ['Have faith.', 'Stay strong.'] },
  { key: 'attention', label: 'Attention', blurb: 'Instructions to watch, notice, focus on, remember, or pay special attention to something.', examples: ['Watch the timing.', 'Note the time.'] },
  { key: 'operational', label: 'Operational', blurb: 'Instructions to perform, initiate, prepare, maintain, organize, control, or change an action or state.', examples: ['Ready the memes.', 'Keep open.'] },
  { key: 'dissemination', label: 'Dissemination', blurb: 'Instructions involving sharing, spreading, archiving, relaying, reporting, saving, or distributing information.', examples: ['Archive this.', 'Spread the word.'] },
  { key: 'prohibition', label: 'Prohibition', blurb: 'Instructions telling someone not to do something, or to stop or avoid an action.', examples: ['Do not forget.', 'Never give up.'] },
]

export interface SectionInfo {
  /** Matches the route or the ?tab= value, so a page can look itself up. */
  id: string
  title: string
  /** One line, shown at the top of the ⓘ popover. */
  short: string
  /** The fuller "What this covers" text. */
  covers: string
  examples?: string[]
  /** The question this section answers for a reader. */
  answers?: string
  /** Certified figures, where the section has been certified. */
  certified?: string
  /** Anything the user needs to know to read the numbers correctly. */
  note?: string
}

export const SECTIONS: SectionInfo[] = [
  {
    id: 'questions',
    title: 'Q Questions',
    short: 'Every question Q asks — including ones without a question mark.',
    covers: 'Direct questions, rhetorical questions, short or elliptical questions, questions with unconventional punctuation, information requests, and questions embedded inside a directive.',
    examples: ['Why did this happen?', 'Coincidence?', "Define 'evidence'.", 'Ask yourself, why are they panicking?'],
    answers: 'What did Q ask?',
    certified: `${n(CERTIFIED.questions.occurrences)} question occurrences · ${n(CERTIFIED.questions.distinct)} distinct · ${n(CERTIFIED.questions.posts)} posts`,
    note: 'Q did not always use standard punctuation, so classification is based on meaning and context rather than simply looking for a question mark.',
  },
  {
    id: 'requests',
    title: 'Q Directives',
    short: 'Where Q instructs the reader to do, consider, investigate, notice, share, avoid or prepare for something.',
    covers: 'Statements where Q instructs the reader to do, consider, investigate, notice, share, avoid, prepare for, or otherwise act on something. A directive can also contain or function as a question — those overlaps are preserved rather than forcing the text into only one category.',
    answers: 'What did Q tell the reader to do?',
    certified: `${n(CERTIFIED.directives.occurrences)} directive occurrences · ${n(CERTIFIED.directives.distinct)} distinct · ${n(CERTIFIED.directives.posts)} posts`,
    note: `There are ${CERTIFIED.overlap} Question ↔ Directive overlaps. They count once within each section, never twice inside the same section.`,
  },
  {
    id: 'claims',
    title: 'Q Claims',
    short: 'Where Q asserts that something is true, happened, or exists.',
    covers: 'Statements where Q asserts that something is true, happened, exists, has a particular relationship, or should be understood as fact — about people, organizations, events, motives, relationships, control, finances, investigations, or history.',
    answers: 'What did Q assert?',
    note: 'A claim does not need to be proven true to appear here. Whether it can later be independently verified is tracked separately, and does not determine whether it is a claim.',
  },
  {
    id: 'predictions',
    title: 'Q Predictions',
    short: 'Where Q says or implies that something will happen.',
    covers: 'Explicit forecasts, expected future events, warnings about what is coming, anticipated consequences, and time-dependent claims.',
    answers: 'What did Q say would happen?',
    note: 'Predictions can be evaluated against later events without altering Q’s original wording.',
  },
  {
    id: 'impliedConclusions',
    title: 'Q Conclusions',
    short: 'The takeaway Q is asking the reader to reach.',
    covers: 'Statements where Q draws an inference, takeaway, deduction, or conclusion from information presented in the post.',
    answers: 'What conclusion was Q drawing?',
    note: 'This differs from a plain claim: it reflects the conclusion Q asks the reader to reach after considering the preceding facts, questions, evidence or relationships.',
  },
  {
    id: 'links',
    title: 'Q Evidence & References',
    short: 'Material Q pointed readers toward as supporting information.',
    covers: 'Links, articles, government documents, court records, screenshots, images, videos, social-media posts, quoted records, source documents and other external references.',
    answers: 'What evidence or source material did Q point to?',
    note: 'A reference being included does not mean Q Drops independently verifies the source’s accuracy.',
  },
  {
    id: 'namedEntities',
    title: 'Q Entities',
    short: 'The people, organizations, agencies and places Q named.',
    covers: 'Important people, organizations, agencies, companies, governments, countries, locations, programs, operations, institutions and other named subjects appearing throughout the posts.',
    answers: 'Who or what was Q talking about?',
    note: 'Entities are secondary tags rather than sentence types. A question, claim, prediction or directive may contain several.',
  },
  {
    id: 'themes',
    title: 'Q Themes',
    short: 'Recurring subjects that connect posts across the archive.',
    covers: 'Recurring subjects and concepts connecting posts across the entire archive — elections, intelligence agencies, media, censorship, military matters, trafficking, financial systems, government investigations, foreign affairs, technology and other recurring topics.',
    answers: 'What larger subject was this post about?',
    note: 'One post may carry several themes.',
  },
  {
    id: 'brackets',
    title: 'Q Codes & Brackets',
    short: 'Coded expressions, bracketed text, shorthand and unusual notation.',
    covers: 'Unusual coded expressions, abbreviations, bracketed text, shorthand, symbolic references, counters, markers and recurring phrases that appear throughout Q’s posts.',
    answers: 'What notation did Q use?',
    note: 'The exact source notation is preserved rather than being given an automatic interpretation. Where an interpretation is offered, it is clearly distinguished from Q’s literal wording.',
  },
  {
    id: 'emphasis',
    title: 'Q Emphasis',
    short: 'Language or formatting Q appears to have emphasized deliberately.',
    covers: 'ALL CAPS, repeated words or phrases, repeated questions, unusual punctuation, deliberate spacing, strong emphasis markers, repeated instructions and conspicuous formatting.',
    answers: 'What did Q appear to place special emphasis on?',
    note: 'Emphasis is an attribute, and can coexist with any other classification.',
  },
  {
    id: 'verificationHooks',
    title: 'Checkable Claims',
    short: 'Claims stated specifically enough to be checked against the record.',
    covers: 'Assertions containing a date, number, name, document or event specific enough that someone could go and test them against an independent source.',
    answers: 'Which claims are specific enough to check?',
    note: 'Listing a claim here says nothing about whether it turned out to be true — only that it is specific enough to be tested.',
  },
]

export const SECTION_BY_ID = new Map(SECTIONS.map(s => [s.id, s]))

/** The shared preamble, used at the top of the Classification Method page. */
export const METHOD_INTRO = [
  'Each section classifies Q’s own words by what they are doing in the post. A single passage may belong to more than one section when it genuinely performs more than one function — an information request such as “Define X.” is both a directive and a question.',
  'Quoted or anonymous material is kept separate from Q-authored material unless it is specifically identified as source or context.',
]

export const METHOD_PRINCIPLE = {
  title: 'Classification principle',
  body: [
    'The archive always preserves Q’s exact original wording. Classification is metadata layered on top of the source, and never rewrites Q’s words to make them fit a category.',
  ],
  primary: 'Question · Directive · Claim · Prediction · Conclusion · Evidence/Reference',
  primaryNote: 'Primary semantic categories describe what the text is doing.',
  secondary: 'Entities · Themes · Codes/Brackets · Emphasis',
  secondaryNote: 'Secondary classifications describe what the text contains or how it is presented.',
  overlap: 'Some classifications legitimately overlap. Overlap is preserved with explicit cross-links rather than forcing a sentence into an inaccurate single category.',
  editorial: 'Editorial paraphrases or normalizations may be retained for search and explanation, but they always carry provenance and are never displayed as though Q literally wrote them.',
}
