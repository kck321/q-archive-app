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
  claims: { occurrences: 4181, distinct: 3226, posts: 1951 },
  predictions: { occurrences: 630, posts: 520 },
  /** Claim attributes. `conclusions` may apply to a claim or a prediction. */
  claimAttributes: { checkable: 1926, sourceProvided: 438, conclusions: 966, telegraphic: 331 },
  /** Units that are BOTH a question and a directive. */
  overlap: 228,
  totalPosts: 4966,
} as const

/**
 * Claims and Predictions are one semantic family and two sections.
 *
 * A prediction IS an assertion — but the Claims screen must never silently swell to include
 * predictions, so `displayClass` decides where a unit appears and `semanticFamily` records what
 * it is. The combined figure is shown only where it is labelled as combined.
 */
export const ASSERTIONS = {
  combined: CERTIFIED.claims.occurrences + CERTIFIED.predictions.occurrences,
  note: 'Claims and Predictions are both assertions. They are shown as separate sections; the combined figure is only ever presented as a combined figure.',
} as const

/**
 * Evidence & References — four subtypes, counted as occurrences with distinct alongside.
 *
 * Internal Q references are kept as their own subtype rather than folded into external
 * sources: they are genuinely how Q builds continuity across drops, but a reader must not
 * mistake Q citing Q for independent corroboration.
 */
export const EVIDENCE = {
  total: { occurrences: 6590, posts: 3883 },
  subtypes: [
    { key: 'external_link', label: 'External Links', occurrences: 2724, distinct: 2569, distinctLabel: 'distinct URLs', blurb: 'Articles, government documents, court records, social-media posts and other web sources Q linked to, across 393 domains.' },
    { key: 'media', label: 'Media', occurrences: 1271, distinct: 1199, distinctLabel: 'distinct assets', blurb: 'Images and video attached to the drop itself.' },
    { key: 'quoted_source', label: 'Quoted / Pasted Source Text', occurrences: 927, distinct: 783, distinctLabel: 'distinct passages', blurb: 'Text Q reproduced from somewhere else — articles, official documents, dictionary definitions, founding documents, scripture and quoted Q&A.' },
    { key: 'internal_q_reference', label: 'Internal Q References', occurrences: 1648, distinct: 1619, distinctLabel: 'distinct drops referenced', blurb: 'Pointers to earlier Q posts, used to build continuity across drops. These are references, not independent external evidence.' },
  ],
  /** Hyperlinks printed inside pasted source material — the article's own, not Q citing it. */
  embeddedInSource: {
    count: 20,
    blurb: 'Twenty hyperlinks appear inside text Q pasted from elsewhere. They are preserved and shown with the source block that contains them, but they are an article’s own links rather than Q citing something, so they are not counted as Q citations.',
  },
  /** Provenance users need in order to read a media URL correctly. */
  archivedMedia: {
    count: 1160,
    total: 1271,
    blurb: 'Some original 8chan/8kun/onion-hosted media no longer resolves at its original location. Where available, Q Drops displays preserved copies from archive mirrors and identifies them as archived/mirrored rather than original-host delivery.',
  },
  /** References whose target could not be recovered. Not an app defect. */
  unresolvedReferences: {
    count: 152,
    resolved: 1496,
    label: 'Unresolved archive reference',
    blurb: 'Q pointed at 152 drops whose historical content could not be recovered from the board archive. They are still counted as references, because Q did point to them, but no quoted content is offered for them.',
  },
  counting: 'Counts are shown as occurrences with distinct alongside. The same article cited in six drops is six occurrences of one source — how often Q returned to a source is part of what the section shows.',
} as const

/**
 * Entities — two different kinds of "we don't know", kept apart on purpose.
 *
 * `other_named_entity` says we know this names a specific thing but not what kind.
 * An unresolved alias says we cannot safely say WHICH thing the shorthand refers to.
 * Collapsing them into one label would hide the difference between an incomplete
 * classification and a deliberate refusal to guess.
 */
export const ENTITIES = {
  canonical: 1332,
  mentions: 4463,
  contextResolved: 161,
  routedToThemes: 53,
  unresolvedTokens: 1011,
  unresolvedOccurrences: 2237,
  otherNamedEntity: {
    label: 'Other named entity',
    blurb: 'A specific named referent was detected, but the available context does not support a more precise type with enough confidence.',
  },
  unresolvedAlias: {
    label: 'Unresolved reference',
    blurb: 'Some shorthand, initials, surnames, or coded references can point to more than one person, place, organization, or concept. Q Drops leaves these unresolved unless the surrounding post clearly identifies the referent.',
  },
  occurrenceSpecific: 'Resolution is occurrence-specific. "BO" resolves to Barack Obama in the drops whose context says so and to Board Owner in others, and stays unresolved in the rest — one resolved occurrence never redefines the token everywhere.',
} as const

/**
 * Themes — recurring SUBJECTS, not writing style.
 *
 * The distinction is the whole reason the ontology is controlled. The old extractor's most
 * common label was "cryptic messaging" at 401 occurrences, which describes how Q writes rather
 * than what a post is about. A coverage audit found style labels of that kind made up the
 * entire apparent gap in subject coverage. They belong to Codes & Brackets or Emphasis.
 */
export const THEMES_INFO = {
  parents: 18,
  assignments: 2393,
  posts: 1766,
  multiTheme: 378,
  unresolved: 251,
  note: 'Themes identify the recurring subjects Q discusses across the archive. They describe what a post is about, not how Q writes it. A post may have more than one theme. Style features such as cryptic phrasing, repetition, coded language, or pattern-based reasoning are classified elsewhere rather than treated as subjects.',
} as const

export interface AttributeInfo { key: string; label: string; blurb: string; count: number }

/**
 * Attribute wording, taken verbatim from the review.
 *
 * Both of these are easy to misread as verdicts, and neither is one. "Claims with evidence"
 * would imply the linked material proves the assertion, which Q Drops does not assess.
 */
export const CLAIM_ATTRIBUTES: AttributeInfo[] = [
  {
    key: 'checkable',
    label: 'Checkable',
    blurb: 'The assertion contains enough concrete information that it could potentially be compared against records, dates, events, documents, or other evidence. This label does not mean the claim has been verified or proven true.',
    count: CERTIFIED.claimAttributes.checkable,
  },
  {
    key: 'sourceProvided',
    label: 'Source Provided',
    blurb: 'Q included or pointed to source/reference material in connection with the claim. This label does not mean Q Drops independently verified that the source proves the claim.',
    count: CERTIFIED.claimAttributes.sourceProvided,
  },
  {
    key: 'isConclusion',
    label: 'Conclusion',
    blurb: 'The assertion is drawn from material earlier in the same post rather than introducing new information. A conclusion may be a claim or a prediction.',
    count: CERTIFIED.claimAttributes.conclusions,
  },
  {
    key: 'telegraphic',
    label: 'Telegraphic',
    blurb: 'Q compressed the sentence, dropping the verb — "HRC extradition already in motion effective yesterday." It still asserts something, so it counts, but the compression is recorded.',
    count: CERTIFIED.claimAttributes.telegraphic,
  },
]

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
    examples: ['HRC extradition already in motion effective yesterday.', 'They control the media.', 'AMERICA FOR SALE'],
    answers: 'What did Q assert?',
    certified: `${n(CERTIFIED.claims.occurrences)} claim occurrences · ${n(CERTIFIED.claims.distinct)} distinct · ${n(CERTIFIED.claims.posts)} posts`,
    note: 'A claim does not need to be proven true to appear here. Nothing counts as a claim merely for being a statement: it has to assert something that could meaningfully be true or false. "ELECTION RIGGING" names a topic and stays a label; "Election rigging occurred." would be a claim.',
  },
  {
    id: 'predictions',
    title: 'Q Predictions',
    short: 'Where Q says or implies that something will happen.',
    covers: 'Explicit forecasts, expected future events, warnings about what is coming, anticipated consequences, and time-dependent claims.',
    examples: ['Expect massive riots organized in defiance.', 'More will follow.'],
    answers: 'What did Q say would happen?',
    certified: `${n(CERTIFIED.predictions.occurrences)} prediction occurrences · ${n(CERTIFIED.predictions.posts)} posts`,
    note: 'Predictions and Claims are both assertions and are shown as separate sections. A conditional ("If Mueller is dirty, RR must also be dirty."), a statement of intent ("We will not comply.") and a future word used as a modifier ("the coming storm") are claims, not forecasts. Predictions can be evaluated against later events without altering Q’s original wording.',
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
    short: 'Material Q cites, links to, quotes, attaches, or points readers toward.',
    covers: 'Material Q cites, links to, quotes, attaches, or points readers toward for context or support. This includes external sources, media, quoted source text, and references to earlier Q posts.',
    answers: 'What evidence or source material did Q point to?',
    certified: `${n(EVIDENCE.total.occurrences)} references across ${n(EVIDENCE.total.posts)} posts`,
    note: 'Inclusion does not mean Q Drops verifies the source, or that the referenced material proves a nearby claim. References to earlier Q posts are shown as their own subtype so they are not mistaken for independent external evidence.',
  },
  {
    id: 'namedEntities',
    title: 'Q Entities',
    short: 'The people, organizations, agencies and places Q named.',
    covers: 'Important people, organizations, agencies, companies, governments, countries, locations, programs, operations, institutions and other named subjects appearing throughout the posts.',
    answers: 'Who or what was Q talking about?',
    certified: `${n(1332)} canonical entities · ${n(4463)} mentions`,
    note: 'Entities are secondary tags rather than sentence types — a question, claim, prediction or directive may contain several. Names are canonicalised, so "HRC", "Hillary" and "Hillary Clinton" are one person, while Q’s exact wording is preserved in every post. Where a reference is ambiguous it is left unresolved rather than guessed.',
  },
  {
    id: 'themes',
    title: 'Q Themes',
    short: 'Recurring subjects that connect posts across the archive.',
    covers: 'Recurring subjects and concepts connecting posts across the entire archive — elections, intelligence agencies, media, censorship, military matters, trafficking, financial systems, government investigations, foreign affairs, technology and other recurring topics.',
    answers: 'What larger subject was this post about?',
    certified: `${n(2393)} assignments · ${n(1766)} posts · 18 parent themes`,
    note: 'Themes identify the recurring subjects Q discusses across the archive. They describe what a post is about, not how Q writes it. A post may have more than one theme — 378 do. Style features such as cryptic phrasing, repetition, coded language, or pattern-based reasoning are classified elsewhere rather than treated as subjects. A theme is assigned only on converging evidence, never on a single word appearing.',
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
