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
  // 2026-08-20 OWNER RULING - the unhighlighted-sentence queue. 6,108 of the 6,111 queued
  // sentences accepted into a section; see audit/unhighlighted-owner-rulings.json.
  questions: { occurrences: 6510, distinct: 5363, posts: 1705 },
  // v5, 16 Aug 2026 — Q Directives migrated to sourceSpansV2 provenance under owner ruling.
  // 2,705 -> 2,552: 153 occurrences removed from Q Directives ONLY (quoted news, scraped code,
  // blessings, declarative-lead misreads, questions, a prediction). Nothing was deleted from the
  // post text, Religion & Spirituality, Questions, Claims or the evidence sets. `distinct` and
  // `posts` are now measured over ALL certified occurrences including owner rulings, which is
  // what the page actually renders — the old 1,472/1,417 counted directives-final.json alone and
  // never matched the UI.
  directives: { occurrences: 3037, distinct: 1827, posts: 1689 },
  claims: { occurrences: 8934, distinct: 6833, posts: 3086 },
  predictions: { occurrences: 843, posts: 674 },
  /** Claim attributes. `conclusions` may apply to a claim or a prediction. */
  // checkable, sourceProvided and conclusions do NOT move with the queue ruling: they are
  // attributes the claims audit established from evidence inside the drop, and the owner ruled a
  // section rather than an attribute. telegraphic does move, because it is not a judgement - it is
  // "four words or fewer", and the queue is overwhelmingly short label-like lines.
  claimAttributes: { checkable: 1926, sourceProvided: 438, conclusions: 966, telegraphic: 3546 },
  emphasis: { occurrences: 3105, posts: 1356, unresolved: 245 },
  /** Units that are BOTH a question and a directive. */
  overlap: 228,
  totalPosts: 4966,
} as const

/**
 * THE HEADLINE FIGURE FOR EACH ANALYSIS SECTION — certified, never recounted.
 *
 * The Post Analysis archive used to headline a number it computed from the phrase-frequency
 * index: for each distinct phrase, how many posts contain it, summed. For Claims that read
 * "4,175 mentions within 1,954 posts" against a certified 4,242, because the frequency index
 * groups by phrase and a phrase repeated inside one post collapses to that post once. Nine posts
 * carry an in-post repeat and #1888 says "You get to go to jail." four times; 4,242 - 13 = 4,175
 * exactly. Every repeat is a real occurrence, and occurrence identity is the rule the entire
 * certified system is built on.
 *
 * So the two numbers are now kept apart by construction:
 *
 *   section headline   certified occurrence truth, read from here
 *   phrase rows        "x N posts" — how many posts contain that phrase, which is what the
 *                      frequency index is genuinely for
 *
 * NEVER_RECOUNT_RULE: read the certified figure, do not re-derive it from a browsing index.
 * A cross-section invariant asserts each of these against scripts/lib/contracts.mjs, so a
 * recount cannot quietly come back.
 */
export const SECTION_TOTALS: Record<string, { occurrences: number; posts: number; unit: string }> = {
  claims: { occurrences: 8934, posts: 3086, unit: 'occurrences' },
  predictions: { occurrences: 843, posts: 674, unit: 'occurrences' },
  emphasis: { occurrences: 3105, posts: 1356, unit: 'occurrences' },
  // "mentions" is the right word here and the only section where it is: an entity is counted
  // once per resolved mention across the 1,066 canonical entities Q named in prose. The other 135
  // certified identities contribute none — they are linked sources, not words Q wrote — which is
  // why this figure sits BESIDE the 1,201 total on the page rather than under it.
  namedEntities: { occurrences: 8969, posts: 2124, unit: 'mentions' },
  // Themes are assignments rather than spans — a theme is inferred from a drop, not copied out
  // of it — so the unit is named accordingly. 2,393 detected + 2 owner rulings.
  themes: { occurrences: 2644, posts: 1898, unit: 'assignments' },
  impliedConclusions: { occurrences: 966, posts: 596, unit: 'conclusions' },
  verificationHooks: { occurrences: 1926, posts: 1028, unit: 'checkable claims' },
}

/**
 * Claims and Predictions are one semantic family and two sections.
 *
 * A prediction IS an assertion — but the Claims screen must never silently swell to include
 * predictions, so `displayClass` decides where a unit appears and `semanticFamily` records what
 * it is. The combined figure is shown only where it is labelled as combined.
 */
/**
 * Emphasis — a presentation layer, and the section most at risk of becoming a catch-all.
 *
 * Two rules keep it honest, both measured against the corpus rather than declared. Capitals
 * count only where they CONTRAST: with the surrounding line, and with the word's own usual
 * spelling — DECLAS is capitalised in 90 of its 95 appearances, so its capitals are how the word
 * is spelled, while FAKE is 207 of 284, so its capitals are a choice. Parallel phrasing counts
 * only where a rhetorical pattern actually repeats; a shared first word is not enough, and a run
 * of lines is one device rather than one device per adjacent pair.
 */
export const EMPHASIS_INFO = {
  types: [
    { label: 'Capitals', count: 2418, blurb: 'Capitalised words that contrast with the surrounding lowercase text — and with how Q normally spells that word.' },
    { label: 'Parallel phrasing', count: 631, blurb: 'A rhetorical frame repeated across consecutive lines: a cascade of three or more, a mirrored construction, or a multi-word frame repeated. Each occurrence records which pattern carried it.' },
    { label: 'Bracket emphasis', count: 715, blurb: 'An ordinary word set in brackets to mark it out — [raid], [now], [children].' },
    { label: 'Quoted word', count: 624, blurb: 'A single word in quotation marks, marking it as loaded or ironic.' },
    { label: 'Punctuation intensity', count: 157, blurb: 'Runs of punctuation beyond ordinary sentence marking.' },
    { label: 'Repeated word or phrase', count: 109, blurb: 'The same wording repeated within one drop for force.' },
    { label: 'Repeated directive', count: 11, blurb: 'The same instruction given more than once in a drop.' },
    { label: 'Deliberate spacing', count: 1, blurb: 'Spacing used to slow a reader down. The corpus contains one.' },
    { label: 'Acrostic', count: 3, blurb: 'Bracketed letters spelling a word across the line — "[N]othing [C]an [S]top [W]hat [I]s [C]oming" spells NCSWIC. Added by owner ruling: the letters are not capitalised for contrast and the brackets read as notation, so no detector saw them. Bracketed abbreviations such as [D] and [F] are a different device and are not counted here.' },
  ],
  contrast: 'Q writes in capitals constantly, so capitals alone would tag most of the corpus. A caps word inside a line that is itself mostly capitals is Q’s baseline register, not a highlight — 7,839 such candidates are excluded on that basis, along with 1,239 words Q capitalises every time they appear.',
  overlap: 'A repeated question is counted once here, as a stylistic fact, and once in Questions, as a unit. The two are cross-linked and never double-counted within a section — the same arrangement as the 228 Question/Directive and 32 Codes/Entities overlaps.',
  unresolved: 'Where no structural test settles whether a device is rhetorical, the case is not forced either way. 245 are held in the Resolution Center: 141 question series where the sequence is real but extra emphasis is not established, 69 parallel constructions needing context, and 35 borderline capitalisations.',
} as const

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
  // 1,335 -> 1,341: Ray Chandler and Rachel Chandler were certified as two people. The owner
  // ruled them one, with RC as a third spelling, so the two rows ship as one entity.
  // 1,445 -> 1,409 (hover audit Stage 1, 2026-08-16): 19 rows merged away as duplicate canonical
  // labels and 17 withdrawn as conceptual or generic wordings. The section was listing 8 entities
  // twice — "Bill Clinton" with 31 mentions and again with 7 — because the core-registry and
  // adjudicated-tail populations each carried a row for them.
  // 1,409 -> 1,201 (integrated cleanup, 2026-08-17): 208 rows went dormant because every mention
  // each of them had was a URL fragment, a slug or an alias buried inside a longer word. Their ids
  // are reserved permanently. 135 more rows have no prose mention left but STAY — they are still
  // referenced as publishers or as accounts Q linked to, and they are shown under Sources.
  // 1,201 -> 1,240 (unhighlighted-sentence queue, 2026-08-20): 39 identities the owner's entity
  // rulings introduce, each declared with a type from the vocabulary the registry already uses.
  canonical: 1240,
  /**
   * THE HEADLINE COUNTS THE WHOLE SECTION.
   *
   * This was 4,463 — alias-resolved mentions of the 93-entity core registry — which was the right
   * figure while the 1,239-entity tail was still under review. The tail is now reviewed and
   * certified, so headlining 4,463 next to 1,335 entities understated the finished section by
   * 3,440 occurrences. The core figure is kept below as provenance, because it is how the section
   * was built, not a number that turned out to be wrong.
   */
  // 9,786 -> 9,749: the 37 occurrences of the 17 withdrawn rows. Nothing left the posts.
  // 9,749 -> 8,798 (2026-08-17): 951 occurrences that were never Q naming something — URL slugs,
  // publisher domains, accounts he linked to, and aliases found only inside longer words. Again
  // nothing left the posts: every word and image is exactly as it was, and 363 of the 951 are
  // still shown to readers, under Sources rather than as words Q wrote.
  // 8,798 -> 8,969 (2026-08-20): +171. 547 entity occurrences were ruled and 376 were already
  // carried by a certified layer at that (post, alias), so only the shortfall is added.
  mentions: 8969,
  mentionScope: 'Every resolved mention across all 1,240 certified entities: 5,336 from the 93 core-registry entities, 2,917 from the entities identified in the adjudication pass, and 716 from owner rulings. Domains, URL slugs and linked accounts are NOT counted here — they are shown under Sources. Unresolved aliases are counted in neither: they are held in the Resolution Center.',
  coreEntities: 93,
  coreRegistryMentions: 4463,
  tailEntities: 1239,
  tailMentions: 3440,
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
  assignments: 2644,
  posts: 1766,
  multiTheme: 378,
  unresolved: 251,
  note: 'Themes identify the recurring subjects Q discusses across the archive. They describe what a post is about, not how Q writes it. A post may have more than one theme. Style features such as cryptic phrasing, repetition, coded language, or pattern-based reasoning are classified elsewhere rather than treated as subjects.',
} as const

/**
 * Codes & Brackets — detected as code is NOT the same as decoded.
 *
 * 732 of the 739 certified codes carry no interpretation at all, and that is the honest state.
 * A meaning is attached only where the corpus itself establishes it through repeated
 * equivalent usage.
 */
export const CODES_INFO = {
  // 2026-08-20: the owner ruled 15 bracket lines out of the unhighlighted-sentence queue; 8 were
  // not yet certified codes and each is a wording Codes did not hold.
  occurrences: 1957,
  distinct: 747,
  posts: 856,
  interpreted: 7,
  unresolved: 740,
  crossLinkedToEntities: 32,
  note: 'Codes & Brackets identifies recurring coded expressions, structured shorthand, bracketed markers, symbolic forms, and unusual notation used by Q. Inclusion in this section means the pattern appears code-like or structurally significant; it does not mean its meaning is known. Interpretations are shown only when supported by repeated context or a reviewed resolution.',
  overlap: 'A bracketed reference such as [HRC] is counted here as notation AND in Entities as a reference. The sections answer different questions — how Q marked something, and who was referenced — so each counts it once and cross-links to the other.',
  excluded: 'Ordinary words in brackets ([raid], [now]) are Emphasis, not codes. Dates and ALL CAPS on their own are not codes either: caps become notation only with structure, such as an underscore, a digit or a bracket.',
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
    // Was 1,332 canonical / 7,903 mentions — both left behind by the 2026-08-17 integrated cleanup,
    // so the ⓘ panel contradicted the header directly above it. The two components are named here
    // for the same reason they are named in the header: 1,201 with no split reads as 1,201 entities
    // Q wrote about, and 135 of them he never wrote at all.
    certified: `${n(1240)} canonical entities (${n(1105)} named in the prose · ${n(135)} linked as a source only) · ${n(8969)} certified prose mentions`,
    note: 'Entities are secondary tags rather than sentence types — a question, claim, prediction or directive may contain several. Names are canonicalised, so "HRC", "Hillary" and "Hillary Clinton" are one person, while Q’s exact wording is preserved in every post. Where a reference is ambiguous it is left unresolved rather than guessed.',
  },
  {
    id: 'themes',
    title: 'Q Themes',
    short: 'Recurring subjects that connect posts across the archive.',
    covers: 'Recurring subjects and concepts connecting posts across the entire archive — elections, intelligence agencies, media, censorship, military matters, trafficking, financial systems, government investigations, foreign affairs, technology and other recurring topics.',
    answers: 'What larger subject was this post about?',
    certified: `${n(2644)} assignments · ${n(1898)} posts · 18 parent themes`,
    note: 'Themes identify the recurring subjects Q discusses across the archive. They describe what a post is about, not how Q writes it. A post may have more than one theme — 378 do. Style features such as cryptic phrasing, repetition, coded language, or pattern-based reasoning are classified elsewhere rather than treated as subjects. A theme is assigned only on converging evidence, never on a single word appearing.',
  },
  {
    id: 'brackets',
    title: 'Q Codes & Brackets',
    short: 'Coded expressions, bracketed text, shorthand and unusual notation.',
    covers: 'Unusual coded expressions, abbreviations, bracketed text, shorthand, symbolic references, counters, markers and recurring phrases that appear throughout Q’s posts.',
    answers: 'What notation did Q use?',
    certified: `${n(1957)} occurrences · ${n(747)} distinct codes · ${n(856)} posts`,
    note: 'Inclusion means the pattern appears code-like or structurally significant — it does not mean its meaning is known. Only 7 of 739 codes carry an interpretation, each stating the evidence for it; the other 732 are preserved exactly as written with no meaning attached. Two of the seven — [D] for Democrat and [F] for Foreign — are owner adjudications rather than readings the corpus establishes on its own, and are labelled as such. Ordinary words in brackets are Emphasis, and dates and ALL CAPS alone are not codes.',
  },
  {
    id: 'emphasis',
    title: 'Q Emphasis',
    short: 'The formatting, repetition and structure Q used to draw attention to language.',
    covers: 'Capitals that contrast with the text around them, bracketed words, quoted words, punctuation runs, deliberate spacing, repeated words, questions and instructions, and parallel rhetorical structure.',
    answers: 'What did Q appear to place special emphasis on?',
    note: 'Emphasis records concrete formatting, repetition, punctuation, or rhetorical structure Q used to draw attention to language. It does not infer importance merely because a phrase is cryptic, political, or written in Q’s usual style. It is an attribute, and can coexist with any other classification.',
    certified: '3,111 occurrences across 1,356 posts, in nine device types. 245 arguable cases are held in the Resolution Center rather than counted.',
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
