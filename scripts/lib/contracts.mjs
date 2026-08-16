// The provenance contract for every certified section — machine-readable, one place.
//
// WHY THIS FILE EXISTS: there is no single rule like "shipped rows must equal the certified
// count", and pretending there is would produce false failures. Questions ships 6,576 rows for
// 6,442 certified occurrences because 134 editorial normalisations are searchable but must never
// display as Q's wording. Entities has two different metrics that are both correct. Evidence
// holds URLs that exist in the data but are not Q citations. Each section's contract is
// different, so each section states its own — and the audit asserts what is written here rather
// than assuming a shape.
//
// Nothing in this file reclassifies anything. It records what was certified and how to tell
// whether the deployed system still represents it correctly.

/** Frozen canonical counts. These are the numbers the whole project is certified against. */
export const CANONICAL = {
  posts: 4966,
  questions: { occurrences: 6443, distinct: 5302, posts: 1696 },
  // v5, 16 Aug 2026 — Q Directives migrated to sourceSpansV2 provenance under owner ruling.
  // 2,705 -> 2,552: 153 occurrences removed from Q Directives ONLY (quoted news, scraped code,
  // blessings, declarative-lead misreads, questions, a prediction). Nothing was deleted from the
  // post text, Religion & Spirituality, Questions, Claims or the evidence sets. `distinct` and
  // `posts` are now measured over ALL certified occurrences including owner rulings, which is
  // what the page actually renders — the old 1,472/1,417 counted directives-final.json alone and
  // never matched the UI.
  directives: { occurrences: 2552, distinct: 1642, posts: 1464 },
  // 4,181 -> 4,188 on 2026-08-13 by owner adjudication, not by a classifier. Six exact
  // occurrences of "Pure evil." / "PURE EVIL." plus "The 'real' racist." in #2917. The corpus
  // search that found them also showed the fuller variants ("These people are pure evil.",
  // "Nobody can possibly imagine the pure evil...") were ALREADY certified Claims — so this
  // resolved an inconsistency rather than introducing a reading.
  // 2026-08-16 sentence-level Predictions audit, owner-supplied, 403 records in 14 batches.
  // Rulings live in audit/predictions-audit/ and are re-applied by apply-claims.mjs, so
  // re-deriving claims-final.json cannot erase them. Ledger: audit/predictions-audit/ledger.jsonl.
  //
  // Claims 4,242 -> 4,221: 68 occurrences moved OUT to Predictions (future assertions filed as
  // claims), 47 moved IN from Predictions (technical nonpredictions — past mental states,
  // legal rules, blessings, contextual labels). distinct 3,245 -> 3,256 and posts 1,982 ->
  // 1,983 follow from that exchange, not from a re-derivation.
  claims: { occurrences: 4221, distinct: 3256, posts: 1983 },
  // 630 -> 595: -73 technical nonpredictions, -56 arguable rows withdrawn to the review
  // backlog, +66 unique moves from Claims, +28 high-confidence predictions the extractor
  // missed. posts 520 -> 490. The 91 withdrawn/held rows are NOT deleted — they sit in
  // audit/predictions-audit/review-backlog.md awaiting an owner ruling.
  predictions: { occurrences: 595, posts: 490 },
  evidence: { occurrences: 6590, posts: 3883 },
  entities: {
    // 1,332 detected + 1 owner ruling (Dominion Voting Systems, #4963 "Dominion." — the only
    // occurrence in the archive). Held in audit/entities-owner-rulings.json, outside the derive
    // loop that already drifted this section once.
    // 1,335 -> 1,334 on 2026-08-14: the owner ruled Ray Chandler and Rachel Chandler one person
    // (aka RC), so two certified rows became one. detectedCanonical stays 1,332 — a merge changes
    // how many rows ship, not how many the passes found.
    // SEPARATELY, 18 occurrences are HELD OUT pending an owner ruling — not because the number
    // is convenient, because they have not been ruled on. That hold is unrelated to Stage 1 and
    // survives it: none of the 18 belongs to a merged or withdrawn row, so the gap is unchanged
    // and a re-derivation would now produce 9,765 against the certified 9,747. audit/entities-audit.json was certified 2026-08-12; the
    // quoted-block boundary fix landed at seed 72 on 2026-08-16. Re-deriving with the current
    // detector flips 18 occurrences from "inside quoted source" to "Q-authored". Proven by substitution: with the pre-seed-72 quotedBlocks.mjs, audit-entities.mjs
    // reproduces the certified artifact exactly, 0 added and 0 removed.
    //
    // The 18 are a MIXED set and cannot be ruled in bulk — 11 are pasted news copy the old
    // boundary correctly excluded, 7 are Q's own lines it wrongly swallowed (#1939 and #2208
    // are unmistakable). Enumerated with line and character offsets in
    // audit/entities-quote-boundary-pending.json. KNOWN_DEBT below already governs this: the
    // adjudicated dataset outranks the detector, and a source-material re-audit is a
    // prerequisite, not a side effect of a deploy.
    // STAGE 1 of the 2026-08-16 Entities/Brackets hover audit.
    // 1,445 -> 1,409 rows: -19 merged away as duplicate canonical labels (36 rows -> 17 groups),
    // -17 withdrawn as conceptual or generic wordings. The audit proposed 18; ENT-0709
    // "Non-profit organization" is HELD because it contradicts an owner ruling of 2026-08-15. The archive was shipping 8 entities TWICE,
    // split across the core-registry and adjudicated-tail populations — "Bill Clinton" as 31
    // mentions and again as 7 — plus 10 groups of spelling variants (Wikileaks/WikiLeaks,
    // LORD/Lord, FAKE NEWS MEDIA/Fake News Media). Rulings: audit/entities-stage1-rulings.json.
    canonical: 1409, detectedCanonical: 1292, ownerRulings: 118, ownerMerges: 1,
    /** Every resolved mention across all 1,334 certified entities. The headline figure. */
    // 8,227 -> 8,239: the RC alias ruling resolved 12 occurrences to Rachel Chandler. The merge
    // moved 4 mentions from the absorbed row onto hers and added none.
    // 9,786 -> 9,749: -37, every one of them an occurrence of the 17 withdrawn rows. NOTHING was
    // deleted from a post — Q's text is untouched and those drops carry every word they carried;
    // the wording is simply no longer classified as a named entity, so it stops being highlighted
    // and stops being counted. Each withdrawn occurrence keeps its post number, the text Q wrote,
    // its prior type and the audit's reason in audit/entities-moved-out-history.json, and removing
    // an entry from the rulings file restores the row exactly as it was.
    // The 17 merges move mentions ACROSS rows and add none, so they are absent from this figure
    // by design and asserted separately in apply-entities.mjs.
    mentions: 9749,
    /** How it is composed. The core figure is the section's history, not its headline. */
    // tailEntities is what the tail adjudication produced (1,239); one of them, Ray Chandler,
    // now ships merged into Rachel Chandler, so 1,238 tail rows appear in the artifact.
    coreEntities: 93, coreRegistryMentions: 5352, tailEntities: 1239, tailMentions: 3777,
  },
  // 2,393 detected + 2 owner rulings ("Ascension." -> Religion & Spirituality, #4963 and #4966).
  // The rulings live in audit/themes-owner-rulings.json and are merged by apply-themes.mjs, so
  // re-deriving audit-themes.mjs cannot erase them. detected/owner are asserted separately there.
  themes: { assignments: 2644, detected: 2393, ownerRulings: 251, posts: 1898 },
  codes: { occurrences: 1949, distinct: 739, posts: 852 },
  // 5,251 detected + 4 owner acrostic rulings (#4951 NCSWIC, #129 NSA, #129 CIA, #150 LDR),
  // held in audit/emphasis-owner-rulings.json so re-deriving the audit cannot erase them.
  // 5,251 detected, less 2 owner withdrawals and 2,138 rows retired by the question rule
  // (104 whose span WAS a question + 479 all-question parallel runs + 1,555 sitting INSIDE a
  // question line). Owner ruling 2026-08-14: "I do not want ... any emphasis connected to a
  // question ... app wide."
  emphasis: { occurrences: 3112, detected: 3111, ownerRulings: 11, ownerWithdrawals: 2, questionRuleRetired: 2138, posts: 1357 },
  // 2,527 -> 2,526 on 2026-08-14: the owner resolved #150's [L], which is one letter of the
  // [L][d][R] acrostic rather than a notation token. Held in audit/resolution-owner-resolved.json
  // so a rebuild cannot re-queue it. #1277's "[R] = Renegade" is a different case and stays.
  // 2,526 -> 2,245: owner alias rulings resolved 281 queued entity rows (277 of them "US",
  // plus C19, CCP and the WUT pair). A ruling applied in apply-entities never reached the
  // unresolved-alias pass the queue is built from, so they stayed queued after being answered.
  // 2,245 -> 2,233: the RC ruling answered 12 of the 13 queued "RC" rows. #2 ("all his funds in
  // a RC") is excluded by the ruling and stays queued — an unanswered question, not a resolved one.
  // 105 -> 115: the Source attribution rows arrive. Ten LINES whose authorship the quoted-block
  // detector changed its mind about at seed 72 — the 18 entity mentions riding on them are the
  // whole difference between the certified 9,786 and the 9,804 a re-derivation produces. The unit
  // is the line, not the mention: all five mentions on #1553 line 0 stand or fall on one judgement.
  // Certified data is untouched — those mentions are excluded from Entities today and stay
  // excluded until ruled, which is exactly what a queue row is for.
  // Canonical file: audit/entities-quote-boundary-pending.json.
  resolution: { total: 115, entity: 30, theme: 16, code: 28, classification: 31, source_reference: 10 },
}

/**
 * Per-section provenance contracts.
 *
 *   certifiedCount   what the section is certified at
 *   shippedRows      how many rows the artifact carries, and why it may differ
 *   mayCoexist       rows that legitimately live in the artifact without counting
 *   neverDisplayed   what must never reach the reader as Q's own wording
 *   sourceResolution how a certified occurrence proves it came from the drop
 */
export const SECTION_CONTRACTS = [
  {
    id: 'questions',
    label: 'Q Questions',
    artifact: 'questions.json',
    certifiedCount: CANONICAL.questions.occurrences,
    // 6,576 + 1 owner ruling: #524 "(Why don't we say his name?)", a question the detector
    // could not see because the line ends in '?)' rather than '?'.
    shippedRows: 6577,
    mayCoexist: '134 editorial-normalisation rows are shipped so the search index can find a question a reader half-remembers in cleaned-up form.',
    neverDisplayed: 'Those 134 must never count toward any total, never highlight in a post, and never display as Q-authored. They are identified by editorialNormalization or neverDisplayAsQ.',
    countedBy: 'rows carrying an `occurrences` field',
    sourceResolution: 'literal-or-whitespace-normalised span in posts.json',
  },
  {
    id: 'directives',
    label: 'Q Directives',
    artifact: 'posts.json → actionRequests',
    certifiedCount: CANONICAL.directives.occurrences,
    mayCoexist: 'None. Every actionRequests entry is a certified directive.',
    neverDisplayed: 'n/a',
    countedBy: 'every actionRequests string across all posts',
    sourceResolution: 'literal-or-whitespace-normalised span in posts.json',
  },
  {
    id: 'claims',
    label: 'Q Claims',
    artifact: 'posts.json → postAnalysis.claims + claimMeta',
    certifiedCount: CANONICAL.claims.occurrences,
    mayCoexist: 'Predictions share the assertion family and the same storage, separated by claimMeta.displayClass. editorialParaphrases are stored per post and are NOT claims.',
    neverDisplayed: 'An editorial paraphrase must never be presented as Q’s literal wording.',
    countedBy: 'postAnalysis.claims entries whose displayClass is claim',
    sourceResolution: 'literal-or-whitespace-normalised span in posts.json',
  },
  {
    id: 'predictions',
    label: 'Q Predictions',
    artifact: 'posts.json → postAnalysis.predictions',
    certifiedCount: CANONICAL.predictions.occurrences,
    mayCoexist: 'A prediction IS an assertion; the combined 4,811 figure is only ever shown labelled as combined.',
    neverDisplayed: 'n/a',
    countedBy: 'postAnalysis.predictions entries',
    sourceResolution: 'literal-or-whitespace-normalised span in posts.json',
  },
  {
    id: 'evidence',
    label: 'Evidence & References',
    artifact: 'evidence.json',
    certifiedCount: CANONICAL.evidence.occurrences,
    mayCoexist: 'URLs embedded inside pasted source material exist in the data and are labelled as such. They are references a reader can follow, but they are not Q citing a source.',
    neverDisplayed: 'An embedded-in-source URL must never be presented as a Q citation.',
    countedBy: 'every item row',
    sourceResolution: 'value appears in the post text, or is a media asset attached to the post',
  },
  {
    id: 'entities',
    label: 'Q Entities',
    artifact: 'entities.json',
    certifiedCount: CANONICAL.entities.mentions,
    mayCoexist: 'Canonical entities (1,332) and mentions (7,903) are DIFFERENT metrics, not a row-count mismatch — one entity is mentioned many times. The headline covers every resolved mention: 4,463 from the 93-entity core registry plus 3,440 from the 1,239 adjudicated-tail entities. Unresolved alias tokens are counted in neither.',
    neverDisplayed: 'An unresolved alias must never be shown as a resolved identification.',
    countedBy: 'sum of per-entity mention counts',
    sourceResolution: 'alias text appears in the post, outside URL spans',
  },
  {
    id: 'themes',
    label: 'Q Themes',
    artifact: 'themes.json',
    certifiedCount: CANONICAL.themes.assignments,
    mayCoexist: 'Multi-label by design: 378 posts carry more than one theme, so assignments exceed posts. Legacy extractor tags are not counted.',
    neverDisplayed: 'A legacy tag must never be shown as a certified theme.',
    countedBy: 'sum of per-post theme assignments',
    sourceResolution: 'contextual — a theme is inferred from the drop, not a literal span',
  },
  {
    id: 'codes',
    label: 'Codes & Brackets',
    artifact: 'codes.json',
    certifiedCount: CANONICAL.codes.occurrences,
    mayCoexist: 'Detected as a code does not mean decoded: 734 of 739 ship with no interpretation, which is the honest state.',
    neverDisplayed: 'An undecoded code must never be shown with an invented meaning.',
    countedBy: 'sum of per-code recurrence counts',
    sourceResolution: 'exact characters preserved from the drop',
  },
  {
    id: 'emphasis',
    label: 'Q Emphasis',
    artifact: 'emphasis.json',
    certifiedCount: CANONICAL.emphasis.occurrences,
    mayCoexist: '245 arguable devices are held in the Resolution Center and counted in neither direction.',
    neverDisplayed: 'A queued borderline case must never appear as certified emphasis.',
    countedBy: 'every occurrence row',
    sourceResolution: 'sourceText appears within its recorded line, and the line within the post',
  },
  {
    id: 'resolution',
    label: 'Resolution Center',
    artifact: 'resolution-queue.json',
    certifiedCount: CANONICAL.resolution.total,
    mayCoexist: 'Every row here is DELIBERATELY excluded from its section’s certified totals. That exclusion is the point of the section, not a gap in it.',
    neverDisplayed: 'A community suggestion must never alter certified data without re-entering audit → adjudication → materialise → QA → apply → deploy.',
    countedBy: 'every queue row',
    sourceResolution: 'each row deep-links to the occurrence it came from',
  },
]

/**
 * Every intentional cross-section overlap, declared.
 *
 * Overlap is allowed only where two sections answer DIFFERENT analytical questions about the
 * same text. "Define X." is one unit that is both an instruction and a request for an answer, so
 * it counts once in Questions and once in Directives — and never twice inside either. An overlap
 * with no rule written here is a defect, whichever direction it runs.
 */
export const OVERLAPS = [
  {
    pair: 'questions ↔ directives',
    expected: 228,
    why: 'An information request ("Define X.") is grammatically an instruction and functionally a question. Each section asks a different thing of the same unit.',
    crossLink: 'directiveWrapped / semanticFunction on the question row',
  },
  {
    pair: 'codes ↔ entities',
    expected: 32,
    why: 'Entities asks who is referenced; Codes asks how Q marked the reference. "HRC" and "[HRC]" are different analytical objects.',
    crossLink: 'linkedEntityId on the code',
  },
  {
    pair: 'emphasis ↔ questions',
    expected: null, // measured, not fixed: every repeated_question must exist in Questions
    why: 'A repeated question is a stylistic fact in Emphasis and a unit in Questions. Repetition being USED rhetorically is a different observation from the question existing.',
    crossLink: 'emphasis type repeated_question, matched on post + text',
  },
  {
    pair: 'emphasis ↔ directives',
    expected: null,
    why: 'Same reasoning as repeated questions: the instruction is the unit, the repetition is the device.',
    crossLink: 'emphasis type repeated_directive, matched on post + text',
  },
  {
    pair: 'claims ↔ conclusions',
    expected: 966,
    why: 'isConclusion is an ATTRIBUTE of a claim or a prediction, not a separate population. It must never be added to the claims total.',
    crossLink: 'claimMeta.isConclusion',
  },
  {
    pair: 'claims ↔ predictions',
    expected: null,
    why: 'Both are assertions and share storage; displayClass decides which section shows a unit. The combined figure appears only where labelled combined.',
    crossLink: 'claimMeta.semanticFamily = assertion, claimMeta.displayClass',
  },
]

/**
 * KNOWN TECHNICAL DEBT — highest priority, and a PREREQUISITE, not a footnote.
 *
 * sourceLines() over-extends quoted blocks on 123 posts: a quoted sentence and its URL are
 * followed by lines that are unmistakably Q's, and the block swallows them. In #1939 those lines
 * are "BO closed door necessary.", "[WHO] ARE THE FIREWALLS?" and "What will the FAKE NEWS push
 * tomorrow?" — Q's voice, Q's brackets, Q's questions.
 *
 * The adjudicated datasets outrank the detector, so Questions, Directives and Claims stay exactly
 * as certified. The direction of the error is conservative for Emphasis, which EXCLUDES source
 * lines and therefore under-counts on those posts rather than admitting phantom Q-authored text.
 *
 * BEFORE any of the following, this detector must be fixed and the affected posts re-adjudicated:
 *   - any Emphasis recount or re-certification
 *   - any source-material re-audit
 *   - any new classifier that consumes sourceLines()
 *
 * The baseline below is frozen in the integrity gate. It is not a target to drive to zero by
 * loosening the check — it is a tripwire. Growth means the detector started claiming more
 * Q-authored text, and that must fail loudly.
 */
export const KNOWN_DEBT = {
  id: 'source-boundary-over-extension',
  priority: 'highest',
  // 120 -> 111 on 2026-08-16: the approved v5 directives migration removed 153 directives,
  // 18 of them over-extending ones. Fewer directives, fewer boundary breaches. Not a detector change.
  postsAffected: 111,
  // RECOMPUTED 2026-08-13 after the quote-boundary fix, not bumped to satisfy a gate.
  //
  // sourceLines() treated a line ENDING in a closing quotation mark as still inside the quote,
  // because parity counting is unreliable when a pasted article contains nested quotations. In
  // #1881 a whole article sits on one line with five quote marks — odd parity — so the block ran
  // on and swallowed Q's own commentary: "PURE EVIL." / "[[[[HUNTERS]]]] BECOME THE HUNTED."
  //
  // Measured before accepting: 19 occurrences REMOVED from the debt set, 0 added. The detector
  // strictly improves; it invents no new over-extension. So the baseline follows the set:
  //   questions  102 -> 89     directives 71 -> 67
  //   claims     147 -> 146    posts     123 -> 118
  // claims 146 -> 147 on 2026-08-15: owner ruling r7-524-claims certified ">Slush Fund" (#524),
  // whose single '>' indent marker the quoted-block segmenter reads as source material. The exact
  // occurrence is named in audit/source-boundary-occurrences.json changeLog — the baseline moved
  // because a ruling moved it, which is the only reason it is ever allowed to move.
  //
  // claims 147 -> 139 on 2026-08-16: the Predictions audit moved 8 of these occurrences out of
  // Claims and into Predictions. The detector did not change and nothing was fixed — the rows
  // left the layer being measured. Measured before accepting: 6 keys REMOVED, 0 ADDED, so no
  // new over-extension is admitted. The 8 are enumerated, all of them P4 records:
  //   #1603 "Attempts to frame Russia / POTUS…", #1603 "The WORLD will UNITE…",
  //   #2070 and #2381 "Bruce Ohr… TERMINATION IMMINENT",
  //   #4 ×2 and #6 ×2 "POTUS will not be addressing nation…" (two overlapping spans each).
  baseline: { questions: 89, directives: 55, claims: 139, emphasis: 0 },
  // 102 -> 103 and 123 -> 124 on 2026-08-13, ruled BENIGN and documented rather than bumped
  // quietly. Cause: literal-span materialisation. The isolation test now measures the literal
  // form of a question rather than its certified normalised text, and a longer span is
  // correspondingly more likely to cross a known quoted-block boundary.
  //   #2971  "PROOF = EVIDENCE?" replaced by its longer literal-span form
  //   #4454  added because literal materialisation expanded the measured span
  // sourceLines() is unchanged and NO new post entered the affected set — the detector claimed
  // no new territory. Verified by diffing the affected-occurrence sets before and after.
  // The 102 -> 103 excursion on 2026-08-13 was TRANSIENT, not a real move. It appeared while
  // question literal-span recovery lived inside apply-questions-final.mjs, where re-running the
  // chain produced different unitText reconstructions (#2971, #4454). Once recovery moved to the
  // single materialisation step the chain settles back at 102/123. The baseline was briefly
  // bumped to 103/124 and is restored here — a reminder that a baseline must only move after the
  // chain is idempotent, or it records a state that does not survive the next run.
  // A COUNT-ONLY TRIPWIRE IS TOO WEAK. This one fired correctly and then cost an investigation to
  // learn which row moved, because it froze an integer instead of a set. Guards over populations
  // must freeze the population: see occurrenceBaseline below, which lets the gate print the added
  // and removed rows immediately instead of forcing a reconstruction.
  occurrenceBaselineFile: 'audit/source-boundary-occurrences.json',
  direction: 'conservative — Emphasis under-counts on these posts; no phantom Q-authored text is admitted',
  ruling: 'Certified Questions/Directives/Claims are unchanged: their adjudicated datasets outrank the detector.',
  prerequisiteFor: ['Emphasis recount or re-certification', 'source-material re-audit', 'any new classifier consuming sourceLines()'],
}

/**
 * SEMANTIC IDENTITY AND RENDERING SOURCE ARE SEPARATE CONCERNS.
 *
 * A certified record may carry a canonical value for classification and identity, and a different
 * literal value for rendering. The renderer must consume the literal certified occurrence
 * provenance — it must never derive a span from the canonical semantic value.
 *
 * Every instance of this found so far produced SILENT, INVISIBLE failure: the data was correct,
 * the counts reconciled, every artifact-level check passed, and the page showed nothing.
 *
 *   Theme label            -> Theme anchor          "Disclosure & Declassification" is not in any
 *                                                    drop; "Whistleblowers" is
 *   canonical Entity       -> literal alias          #1 says "HRC", not "Hillary Clinton"
 *   cleaned Evidence URL   -> literal Q-posted URL   "https://x.com" vs "https:// x.com"
 *   Emphasis summary       -> literal source run     "what …" is a display label, not text
 *
 * When adding any layer that renders, materialise BOTH and say which field the renderer reads.
 */
export const RENDERING_PROVENANCE_RULE = {
  rule: 'The renderer consumes literal certified occurrence provenance, never the canonical semantic value.',
  knownCases: [
    { semantic: 'theme label', rendering: 'themes.evidence.anchors' },
    { semantic: 'canonical entity', rendering: 'the alias Q actually wrote' },
    { semantic: 'cleaned URL', rendering: 'the literal Q-posted URL form' },
    { semantic: 'emphasis display summary', rendering: 'the literal source run' },
  ],
  everyInstanceFailedSilently: true,
}

/**
 * NEVER RECOUNT WHAT A CERTIFIED ARTIFACT ALREADY COUNTED.
 *
 * The occurrence-identity twin of RENDERING_PROVENANCE_RULE. A certified artifact is the source
 * of truth; grouping, matching and UI reconstruction are downstream VIEWS, never new counting
 * systems. Every attempt to recount has been wrong, and wrong by a plausible-looking margin:
 *
 *   directive families    keys not occurrences        2,369 vs the certified 2,424  (-53)
 *   claim conclusions     claimMeta keys              960 vs 966                    (-6)
 *   codes, first attempt  (code, post) pairs          1,563 vs 1,949                (-386)
 *   codes, second attempt re-matched text variants    1,972 vs 1,949                (+23)
 *   Q<->D overlap         measured from the wrong side 167 / 218 vs 228
 *   claim metadata join   ad hoc key normalisation    64 vs 1,926                   (-97%)
 *
 * Every one of those numbers looks close enough to ship. That is what makes the rule necessary:
 * a recount that is obviously wrong gets caught, and a recount that is nearly right does not.
 */
export const NEVER_RECOUNT_RULE = {
  rule: 'Read counts from the certified artifact. Grouping and matching are views, not counting systems.',
}

/** The apply order the export chain must preserve. A later step must never revert an earlier one. */
export const APPLY_ORDER = [
  'backfill-analysis.mjs', 'detect-emphasis.mjs', 'apply-questions.mjs', 'apply-questions-final.mjs',
  'apply-directives.mjs', 'apply-claims.mjs', 'audit-evidence.mjs', 'apply-evidence.mjs',
  'audit-entities.mjs', 'adjudicate-entities-tail.mjs', 'adjudicate-entities-other.mjs',
  'adjudicate-entities-lowconf.mjs', 'resolve-entity-context.mjs', 'apply-entities.mjs',
  'audit-themes.mjs', 'apply-themes.mjs', 'audit-codes.mjs', 'adjudicate-codes.mjs',
  'apply-codes.mjs', 'audit-emphasis.mjs', 'apply-emphasis.mjs', 'build-resolution-queue.mjs',
  // Last: relationships join every section, so every section has to exist first.
  // The literal-span materialisers must run after every apply that rewrites their inputs, or the
  // next export silently reverts them — the same failure that reverted Questions to 6,299 and
  // left postAnalysis.namedEntities on the legacy extractor for months.
  'materialize-evidence-literals.mjs', 'materialize-literal-spans.mjs', 'apply-context-units.mjs',
  'build-relationships.mjs', 'build-search-index.mjs',
]

/** Artifacts covered by the certification manifest. */
export const ARTIFACTS = [
  'posts.json', 'questions.json', 'evidence.json', 'entities.json', 'themes.json',
  'codes.json', 'emphasis.json', 'resolution-queue.json', 'relationships.json', 'search-index.json',
  // Reader-facing editorial text, and the only artifact here that is prose rather than counts.
  // It is covered for exactly that reason: a silent change to what the archive SAYS about a named
  // person is harder to notice than a count that moves, and impossible to notice from a total.
  'entity-hovers.json',
]

/** Whitespace-normalised comparison — the one approved reconstruction. */
export const nspace = s => String(s ?? '').replace(/\s+/g, ' ').trim()
export const nlower = s => nspace(s).toLowerCase()
