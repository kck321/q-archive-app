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
// ── THREE SECTIONS RETIRED, AND FOUR COUNTS MOVED (2026-08-21) ──────────────────────────────
//
// EMPHASIS, Q CONCLUSIONS and CHECKABLE CLAIMS are retired by owner ruling: "get rid of the
// emphasis category ... everything associated with it ... also Q Conclusions and Checkable Claims
// data/highlights". Conclusions and Checkable Claims had already lost their NAV SECTIONS in
// August; what goes now is the underlying data, because a sentence carrying only a retired span
// reads as highlighted to a coverage scan while the reader sees nothing — and the residual census
// this clears the way for would inherit that lie.
//
// The four primary counts below move for Step 3B-1, each already applied and gated:
//
//   questions   6,503 -> 6,324   163 unified directive+question pairs became non-painting
//                                secondaries, 16 same-category fragments withdrawn
//   directives  3,037 -> 2,940   97 withdrawn where another category won the complete sentence
//   claims      8,912 -> 8,814   92 by the plan, 6 by the adjudicated held rows
//   predictions   847 ->   843   4 withdrawn
//
// Claims did NOT move for the retirement. All 966 conclusions and 1,926 checkable claims were
// already certified Claims carrying an attribute — that was the stated basis of both August
// rulings — so retiring the attribute removes a second view of a row, never the row.

export const CANONICAL = {
  posts: 4966,
  // 6,443 -> 6,454 on 2026-08-19 by owner ruling: 11 interrogative units certified in another
  // section (9 Claims, 2 Evidence) moved to Questions. `distinct` is restated to the value the
  // apply gate measures — it read 5,302 here against a measured 5,303 before this ruling, an
  // ungated documentation drift, now 5,313. Rulings: audit/questions-owner-rulings.json.
  // 2026-08-20 OWNER RULING - the unhighlighted-sentence queue. The owner reviewed all 6,111 rows
  // the unhighlighted-sentence audit produced and assigned each to a section; 6,108 were applied.
  // Every figure this ruling moved is marked with its arithmetic below. The record is
  // audit/unhighlighted-owner-rulings.json, and each materialiser layers it over its frozen
  // artifact rather than writing into it, so re-deriving an audit can neither erase a ruling nor
  // restore a withdrawn row.
  // +65 occurrences (67 ruled, 2 already certified), +58 wordings, +5 posts.
  // 2026-08-21 segmentation repair: -9 occurrences, -8 wordings. Ten certified questions were cut
  // short by a splitter that read an INITIAL as a sentence end ("H. Biden", "A. Merkel"); repairing
  // them absorbed the 8 orphaned tail fragments the same splitter had certified separately, and one
  // repair produced a duplicate of a row already correct. No question left the archive - the same
  // words are certified once, whole, instead of twice, in halves. Posts unchanged.
  // 2026-08-21 abbreviation/sentence-boundary repair: spans cut short at "Mr.", "Lt. Gen.",
  // "U.S. Senate", "Harris v." are extended to the full sentence, and the tail the same splitter
  // had certified separately is absorbed into them. Nothing left the archive - the same words are
  // certified once, whole, instead of twice, in halves. See audit/abbreviation-span-repairs.json.
  // 6,324 -> 6,323: B2 withdrew one question whose whole span was a link line.
  // 6,323 -> 6,321: the lane-B family-4 review withdrew the two 2026-08-20 queue-ruling question
  // records on #2971 and #4454. Each ran from pasted material — a dictionary synonyms block, a
  // quoted paragraph — into Q's own closing question, and that closing question is already
  // certified on its own at 782..799 and 386..404, where B3-NARROW put it. The owner ruled the
  // CLASSIFICATION; the span came from the segmenter and swallowed the paste.
  // ROUND 2 OF THE UNHIGHLIGHTED-QUEUE REVIEW, 2026-08-24. The census re-measured against the
  // rendered DOM queued 10,700 unpainted lines; the owner reviewed them and returned
  // Q_Unhighlighted FINAL 2.xlsx. 2,799 rulings were applied and 3,261 rows produced none at
  // all, because the section they name already certifies that span. Record:
  // audit/unhighlighted-owner-rulings-2.json.
  // 6,321 -> 6,327: 6 question rulings, carrying 5 wordings Questions did not hold.
  questions: { occurrences: 6327, distinct: 5363, posts: 1705 },
  // v5, 16 Aug 2026 — Q Directives migrated to sourceSpansV2 provenance under owner ruling.
  // 2,705 -> 2,552: 153 occurrences removed from Q Directives ONLY (quoted news, scraped code,
  // blessings, declarative-lead misreads, questions, a prediction). Nothing was deleted from the
  // post text, Religion & Spirituality, Questions, Claims or the evidence sets. `distinct` and
  // `posts` are now measured over ALL certified occurrences including owner rulings, which is
  // what the page actually renders — the old 1,472/1,417 counted directives-final.json alone and
  // never matched the UI.
  // +485 occurrences (486 ruled, 1 already certified), +185 wordings, +225 posts.
  // 2,940 -> 2,902 on 2026-08-23, the scripture ruling: "i would like the whole verse to be a
  // directive and lets make the whole verse as 1 directive not multiples at the sentence breaks."
  // 66 sentence-level fragments of a quoted passage withdrawn, 28 whole passages written in their
  // place (31 blocks, 3 of which were already certified verbatim as one-line directives). This
  // REVERSES the REMOVE_QUOTED_SCRIPTURE half of the 2026-08-16 religious adjudication, by owner
  // ruling and on purpose: the passage IS the directive now. Posts RISE by 7 — seven drops carried
  // their scripture only as Claims and gain their first certified directive.
  // 2,902 -> 3,304: 455 directive rulings, 50 of them on spans already certified.
  // 3,304 -> 3,328: the 24 rows on that sheet that were HELD - list markers, end-markers, two
  // comms strings and one assertion, each of which instructs nobody - were ruled in by the owner
  // on 2026-08-24 ("go ahead and push the directives in that held for you file tab as well").
  // Their family is declared with the ruling rather than detected; see
  // scripts/build-held-directive-rulings.mjs.
  // +1 on 2026-08-24: #417 '(Find Post)', owner ruling - "this is also a directive in that post".
  // +5 on 2026-08-24: "lets make ALL the wwg1wga directives trough all the post". 171 of the 178
  // WWG1WGA occurrences already were — the archive certifies Q's valedictions and every
  // sign-off-shaped one carries family `morale`. These are the five that were not (#1183, #2347,
  // #2543, #2565, #2567), each a sub-line span in a line certified in another section. Two are
  // refused and named in the ruling: #1601 and #3660 have WWG1WGA inside a URL, and a word inside
  // an address is not a word Q wrote. Distinct does not move — "WWG1WGA" and "WWG1WGA!!!" are both
  // wordings Directives already held 168 times over. Posts +2: #2347 and #2565 held no certified
  // directive at all before.
  // -1 on 2026-08-24: #1443's "#2." moves to Claims on the owner's ruling. A line of that drop's
  // evidence list, the same shape as "302s", "Texts" and "Tarmac" around it — all Claims.
  directives: { occurrences: 3333, distinct: 1941, posts: 1928 },
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
  // 4,221 -> 4,212 on 2026-08-19: 9 quoted questions withdrawn to Questions by owner ruling.
  // distinct -9 (each wording occurs in one post only); posts -3 (#483, #2695, #3203 each held
  // exactly one claim, and it was the quoted question).
  // +4,716 occurrences (4,782 ruled, 66 already certified), +3,581 wordings, +1,104 posts.
  // +6 on 2026-08-21 by owner ruling: #4923 "Dearest Virginia -", #4861 "House resolution passed
  // condemning 'Qanon'", #4893 "Example:" and "Federal Appeals Court reinstates conviction", #4853
  // "Wife: CIA" and "Husband: DOJ". distinct +5, not +6: "Example:" shares a key with "Example."
  // already certified on #1015 and #1220. posts +2: #4861 and #4853 gain their first claim.
  // 8,814 -> 8,721: B2/B2b/B2c withdrew 93 claims certified over nothing but URLs, board pointers
  // or bracketed labels. Owner ruling: a raw URL is not claim paint.
  // 8,721 -> 8,711: the lane-B multi-line-span reviews (2026-08-22). Nine extractor blobs and one
  // nested fragment withdrawn, each one a record whose characters were already covered by the
  // constituent records certified inside it. No sentence lost its only claim.
  // 8,711 -> 8,695: the lane-B within-line reviews (2026-08-22). Twelve paragraph-wide claims an
  // early extractor left sitting on top of the sentence-level records that superseded them, plus
  // four nested fragments — two partial quotations and two segmenter-orphaned tails absorbed by a
  // widened span. Every sentence underneath keeps its own certified record.
  // 8,695 -> 8,676: the lane-B same-category overlap reviews (2026-08-22). NOT nineteen claims
  // lost — fifteen sentences that were certified TWICE, as a head stopping at an abbreviation and
  // a tail starting after it. Each pair becomes one record covering the whole sentence, so the
  // count falls by the duplicates while the text painted goes UP. The other four withdrawals are
  // three fragments of the source-owned paragraph on #4310 and one twelve-character tail on #4801
  // reading 'Biden, ...." ' , which asserted nothing.
  // 8,676 -> 8,631 on 2026-08-23, the same scripture ruling. 45 claims withdrawn, each one a
  // sentence inside a quoted passage that is now one Directive. A passage cannot be one Directive
  // and also nine Claims — that scattering is exactly what the ruling removes.
  // 8,631 -> 10,258 on 2026-08-24, round 2 of the queue review: 1,654 claim rulings, 83 of them
  // on spans Claims already certified, so only the shortfall is added.
  // 10,258 -> 10,247 on 2026-08-24, three owner section moves: the 13 retiring-members list rows on
  // #1850 leave Claims (already certified as the member and the party, split — a list row is not an
  // assertion), and two arrive: #1443's "#2." from Directives and #4784's opening line.
  // 10,247 -> 10,237 on 2026-08-24: the ten Red October / Delta lines that were Claims are
  // Predictions now.
  claims: { occurrences: 10237, distinct: 7777, posts: 3223 },
  // 630 -> 595: -73 technical nonpredictions, -56 arguable rows withdrawn to the review
  // backlog, +66 unique moves from Claims, +28 high-confidence predictions the extractor
  // missed. posts 520 -> 490. The 91 withdrawn/held rows are NOT deleted — they sit in
  // audit/predictions-audit/review-backlog.md awaiting an owner ruling.
  // +247 occurrences (250 ruled, 3 already certified), +183 posts.
  // +1 on 2026-08-21 by owner ruling: #4910 "Freedom of information [truth] = END", which gains
  // that drop its first certified prediction.
  // +4 on 2026-08-21 (r15): "MOVIE 1 [Full]: The 'START'" and "MOVIE 3 - TBA" on #1928 and #1929.
  // posts unchanged - both drops already carried certified predictions.
  // 843 -> 841 on 2026-08-23, the same scripture ruling. Two sentences inside quoted passages were
  // certified Predictions — #35's "whoever believes in him shall not perish but have eternal life"
  // and #1712's "Because of these, the wrath of God is coming." Same rule as the claims: a passage
  // that is one Directive is not also a row in Predictions.
  // 841 -> 934 on 2026-08-24: round 2 of the unhighlighted-queue review ruled 94 more lines
  // Predictions; one span was already certified and Step 3B-1 withdrew none of the rest.
  // +1 on 2026-08-24 by owner ruling: #417 'News unlocks Map.', which stays a Claim as well.
  // 935 -> 934 on 2026-08-24, the UPDATED report: #1443's "DECLAS_Public[3]" leaves Predictions on
  // the owner's ruling "make this portion a claim". Posts unchanged — the drop keeps "Dark to
  // LIGHT.", which round 1 certified, so it does not leave the Predictions post set.
  // 934 -> 935 the same day: the owner corrected that reading — "DECLAS_Public should be a
  // prediction" — so the line goes back. Its place in Claims is taken by "Texts" on the same drop,
  // which is why claim occurrences do not move either way.
  // 935 -> 950 on 2026-08-24: "i want the term NCSWIC to be a prediction because it stands for
  // nothing can stop what is coming", "Let's do all the Red October refferences as predictions for
  // now", "Lets do all Delta references to Predictions". Ten arrive from Claims and five from no
  // section. TWO are refused and named in audit/owner-section-moves.json: NCSWIC inside a CISA URL,
  // and #1176's "Delta engine fire?" — Delta AIRLINES, the same shape of homograph the Q ruling
  // held Al-Qaeda and a 10-Q filing for.
  predictions: { occurrences: 950, posts: 672 },
  evidence: { occurrences: 6590, posts: 3883 },
  // canonical 1,240 -> 1,235: Owner Ruling 1 merged five duplicate identities. No occurrence moved.
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
    // SEED 78 — the 2026-08-17 integrated entity cleanup. 1,409 -> 1,201 rows.
    // 208 rows go DORMANT: every certified mention each of them had was a URL fragment, a slug or
    // an alias buried inside a longer word, so there is nothing left to show and a page for one
    // would be a page about nothing. THE IDS ARE RESERVED FOREVER in audit/entity-ids.json and
    // audit/entity-dormant-registry.json — a later occurrence resolves back to the same qe- id
    // rather than minting a second identity for something the archive already named.
    // A further 135 rows have zero prose mentions and STAY, because they are still referenced as
    // the publisher of linked material or as an account Q pointed at: audit/entity-source-only-registry.json.
    // 1,201 -> 1,240: 39 identities the 2026-08-20 queue rulings introduce, declared with a type
    // from the existing vocabulary in audit/unhighlighted-entity-identities.json. detectedCanonical
    // stays 1,292 - an identity the owner ruled into existence is not one a detector found.
    // 1,235 -> 1,214: OWNER RULING 3 (2026-08-22) withdrew 27 named-entity occurrences from the
    // reviewed C/D/E population of the NO_ALIAS_EVER_REGISTERED family, and 22 of those were the
    // last mention their identity had. 21 of the 22 go dormant (208 -> 229 reserved ids, never
    // published); the 22nd, Judicial Watch, keeps its row as SOURCE-ONLY (135 -> 136) because 3
    // of its 7 occurrences migrate to linked sources under the 2026-08-17 plan. detectedCanonical
    // stays 1,292 — a withdrawal re-adjudicates what a detector found, it does not unfind it.
    // The ruling is audit/occurrence-withdrawals-owner-ruling-3.json, applied beside the approved
    // audit rather than inside it, and recorded as the fourth postApprovalDeltas entry.
    // 1,214 -> 1,224 on 2026-08-23, the scripture ruling: "lets make the verse section example:
    // – 1 Cor 13:4-13 and – Ephesians 6:10-18 an entity for now until i can subsect the post
    // later." Ten reference labels Q prints beside a quoted passage become certified identities —
    // Jeremiah 29:11, Ephesians 6:10-18, 1 Cor 13:4-13, Colossians 3:5, Corinthians 13:4-13,
    // 1 Corinthians 16:13, 2 Thessalonians 3:3, Psalm 46:1, Matthew 6:13, Proverbs 13:9 — carrying
    // 12 occurrences across 8 drops. detectedCanonical stays 1,292: an identity the owner ruled
    // into existence is not one a detector found. Q's own label is used verbatim, including
    // #1886's "Corinthians 13:4-13" over a quotation of 13:12, which is Q's error to keep.
    // 1,224 -> 1,223 in the same ruling: "Ephesians" is retired. Its only two occurrences were the
    // book name INSIDE "Ephesians 6:10-18" — the archive holds no standalone mention of the book —
    // so once the label is the identity, keeping both counts the same characters twice and paints
    // the label as two touching spans. The qe- id is reserved dormant (229 -> 230), so a genuine
    // future mention of the book resolves back to it.
    // 1,223 -> 1,532 on 2026-08-24: 308 identities round 2 introduces, plus Rachel Maddow, whose
    // row was dormant because every mention she had was a URL slug and who #1515 names in prose.
    // 244 of the 308 are read off three lists Q pastes verbatim - the central banks of #135-#138,
    // the 'THE BRIDGE' media list in #1515, the retiring-Congress list in #1319/#1850 - where each
    // line names two things and is SPLIT rather than invented. 128 wordings are held, not named.
    // 1,532 -> 1,583 on 2026-08-24, from two more owner rulings on the same day:
    //   +48  the 128 wordings held above, researched against the drop each one sits in and named
    //        ("i want to classify all those as entities and i would like you to do the research
    //        for each post they are with in"). 45 stayed questions and are in
    //        audit/held-entity-resolution-center.json, not named here.
    //   +1   NAT SEC ("NAT SEC is an entity throughout all the post"), across 48 drops in four
    //        spellings. Distinct from the National Security Agency, which stays its own row.
    //   +2   Al Gore and Roseanne Barr. Both rows were RETIRED by the approved entity cleanup
    //        because their only trace on a drop was a URL path or an unexamined image. #1239's
    //        first line is "@algore" and #1863's third is "@TheRealRoseanne"; with the handles
    //        certified Q names them in his own visible text and the retirement condition is gone.
    //        Recorded as an afterOnly delta in audit/entity-cleanup-rollback-contract.json.
    // ownerRulings 118 -> 119: NAT SEC. detectedCanonical is unchanged - none of these was found
    // by a detector.
    //   +1   White House Press ("in the pic WH_POTUS_PRESS is the same as white house press"),
    //        #397 and #417, where Q writes the underscored stringer form. Its own row rather than
    //        an alias of "The White House", which the archive certifies as a location.
    canonical: 1584, detectedCanonical: 1292, ownerRulings: 120, ownerMerges: 1, queueRulings: 1007,
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
    // 9,749 -> 8,798 on 2026-08-17: -951, and NOT ONE WORD OF ANY DROP CHANGED. Q's text and every
    // image are untouched; what moved is whether a piece of that text is CLASSIFIED as a named
    // entity. Composed of, per audit/integrated-migration-plan.json:
    //     412  URL path or query fragments — a CMS slug is not Q naming a thing
    //     234  publisher hostnames, migrated to linked-source metadata (still shown, as sources)
    //     129  social accounts Q linked to, migrated the same way (still shown, as accounts)
    //      98  aliases found only inside a longer word — "God" inside "Godfather III", 41 times
    //      78  occurrences with no text, URL, image or metadata support, owner-approved 2026-08-17
    // Every one is reversible from audit/entity-cleanup-reversal.json, which restores each entry
    // at its original array index. Deliberately NOT included and still certified: 41
    // image-unconfirmed, 69 ambiguous, and 7 unsupported occurrences outside the approved set.
    // 8,798 -> 8,969: +171. 547 entity occurrences were ruled and 376 of them were already carried
    // by a certified layer at that (post, alias), so only the shortfall is added - counting the rest
    // again would show a x2 Q never wrote. The cleanup itself is unchanged: proposedWithdrawals is
    // still 951, and re-running audit-occurrence-provenance.mjs reproduced every prior verdict.
    // 8,969 -> 8,975: +6 on 2026-08-21. NO is Nellie Ohr on #1928 and #1929, three occurrences each.
    // She was already a certified identity, so no row is added - the alias was the gap. Scoped with
    // includePosts because the token matches 102 times across 75 posts and nearly all are the
    // English word. audit-occurrence-provenance.mjs re-run moved exactly four figures, classified
    // all six as visible_complete_token, and left proposedWithdrawals at 951.
    // 8,975 -> 8,948: -27 on 2026-08-22, Owner Ruling 3. Twelve INFERRED_NOT_EXPLICIT, fourteen
    // QUOTED_OR_PASTED / URL-DERIVED and three WRONG_IDENTITY rows, each reviewed individually
    // against its drop. NOT ONE WORD OF ANY DROP CHANGED — what moved is whether that wording is
    // classified as a Q-authored named entity. Every one is reversible from the ruling artifact,
    // which records the original identity, post text, adjudication letter, reason and the exact
    // restoration. The 9 F rows of the same family are deliberately left unresolved.
  // 8,948 -> 8,924 -> 8,920: the lane-B family 4 and 5 reviews moved 28 occurrences whose only
  // trace on a drop is a URL slug, a hostname or a social handle. 22 MIGRATE to linked sources
  // rather than being deleted, so the reader still sees that Q cited the publisher.
  // 8,920 -> 8,821: -99, and NOT a withdrawal of anything. apply-step3b1.mjs collapsed 99
  // DUPLICATE entity records — several records over the SAME characters for the SAME identity,
  // which is one occurrence recorded more than once and not a repeat Q wrote. #111 carried
  // "Huma" five times over one word; #1318 carried "Sessions" six times over one. The records
  // went when the merge ran and the registry did not follow, so it counted 8,920 while the drops
  // rendered 8,821. Invariant 12 exists for exactly that gap and had been failing at 99 since the
  // merges landed, unseen only because audit-cross-section.mjs could not run at all while
  // Emphasis was half-retired. reconcile-entity-registry.mjs applies the exact decrements the
  // adjudication recorded and refuses unless the two totals then agree.
  // 8,821 -> 8,833 on 2026-08-23, the scripture ruling. The 12 reference labels Q prints beside a
  // quoted passage become certified occurrences across 8 drops. They land on OWNER-RULING rows, so
  // the core and tail components are untouched and the third component carries all 12.
  // 8,831 -> 9,271 on 2026-08-24: +440 from round 2 of the queue review. 1,007 entity rulings
  // across both rounds carry 1,167 occurrences; 727 were already held by a certified layer at
  // that (post, alias), so only the shortfall is added - counting the rest again would show the
  // reader an x2 Q never wrote.
  // 9,271 -> 9,364 on 2026-08-24, the Q ruling: a standalone "Q" that is not the sign-off is an
  // Entity, and it is Alice - Q's own equation, written in #74 and #78. 93 occurrences across 75
  // drops. Occurrence-scoped: 4,534 sign-off lines are excluded by the ruling itself and 65 more
  // standalone Q tokens are HELD because they name something else (Al-Qaeda, a 10-Q filing,
  // Quicken Loans Arena, the NSA Q Group, a DOE clearance level, Q+, the word "question").
    // 9,364 -> 9,517 on 2026-08-24, from the three rulings of that afternoon: the 128 held wordings
    // named and researched, NAT SEC across 48 drops, and White House Press on #397/#417. +153, of
    // which +110 land on the core registry and +25 on the adjudicated tail; the remaining +18 land
    // on owner-ruling rows, which is also where Al Gore and Roseanne Barr now sit - both rows were
    // retired by the approved cleanup for having no trace beyond a URL path or an unexamined image,
    // and #1239's "@algore" and #1863's "@TheRealRoseanne" are Q naming them in his own text.
    // 9,517 -> 9,519 on 2026-08-24, the #2347 card: both body Qs on that drop are Entities, on the
    // owner's ruling. +2 and not +3 — the third standalone Q there is inside the twitter handle
    // "Q_ANONBaby" and stays held. Both land on the adjudicated tail, because Alice is a tail row.
    mentions: 9519,
    /** How it is composed. The core figure is the section's history, not its headline. */
    // tailEntities is what the tail adjudication produced (1,239); one of them, Ray Chandler,
    // now ships merged into Rachel Chandler, so 1,238 tail rows appear in the artifact.
    // SEED 78: the cleanup fell almost entirely on the adjudicated tail, which is where the
    // URL-derived and substring-extracted rows lived. Core registry keeps all 93 rows and loses 24
    // mentions; the tail loses 246 rows and 918 mentions.
    // +8 core, +58 tail from the queue rulings; the remaining 105 land on owner-ruling rows.
    // +6 tail: Nellie Ohr is an adjudicated-tail row.
    // Re-measured 2026-08-22 after the lane-B reviews and the duplicate-record reconciliation.
    // The three components add to the headline: 5297 core + 3015 tail + 1052 owner-ruling rows.
    // tail 2,870 -> 2,868: "Ephesians" was an adjudicated-tail row and takes its two occurrences
    // with it. The 12 citation occurrences land on owner-ruling rows, so 715 -> 727 there.
    // 5,297 + 15 core, 3,015 + 23 tail, and 1,052 + 115 on owner-ruling rows - which is where most
    // of this batch lands, because an identity the owner ruled into existence is neither a core
    // registry row nor an adjudicated-tail one. 5,312 + 3,038 + 1,167 = 9,517.
    //
    // Measured the way certification-manifest.mjs measures, by the `source` field on the artifact
    // rows. entities.json's own totals block says 5,407/3,040 instead: it is written by
    // apply-entity-cleanup and nine rows are re-added by later chain steps without it being
    // recomputed. Same 9-row gap that has been there since seed 78 (1,523 written, 1,532 shipped).
    // tail 3,038 + 2 = 3,040 on 2026-08-24: Alice is an adjudicated-tail row, so the two #2347
    // occurrences land there. 5,312 + 3,040 + 1,167 = 9,519.
    coreEntities: 93, coreRegistryMentions: 5312, tailEntities: 970, tailMentions: 3040,
  },
  // 2,393 detected + 2 owner rulings ("Ascension." -> Religion & Spirituality, #4963 and #4966).
  // The rulings live in audit/themes-owner-rulings.json and are merged by apply-themes.mjs, so
  // re-deriving audit-themes.mjs cannot erase them. detected/owner are asserted separately there.
  // 2,644 -> 2,646 on 2026-08-23: the owner ruled that every drop carrying a verse block belongs to
  // Religion & Spirituality. 26 of the 28 already did; #37 ("Fight the good fight.") and #54
  // (nothing but Jeremiah 29:11) did not. #54 gains its FIRST theme, so posts 1,898 -> 1,899;
  // #37 already carried Justice & Courts, so multi-theme posts 444 -> 445.
  themes: { assignments: 2646, detected: 2393, ownerRulings: 253, posts: 1899 },
  // +8 occurrences: 15 bracket lines ruled, 7 already certified at their post. Each of the 8 is a
  // wording Codes did not hold, and 4 posts gain their first certified code.
  // 1,957 -> 1,986 on 2026-08-24: 43 bracket rulings from round 2, 14 of them on tokens the
  // bracket detector already certifies at that post.
  codes: { occurrences: 1986, distinct: 771, posts: 861 },
  // 5,251 detected + 4 owner acrostic rulings (#4951 NCSWIC, #129 NSA, #129 CIA, #150 LDR),
  // held in audit/emphasis-owner-rulings.json so re-deriving the audit cannot erase them.
  // 5,251 detected, less 2 owner withdrawals and 2,138 rows retired by the question rule
  // (104 whose span WAS a question + 479 all-question parallel runs + 1,555 sitting INSIDE a
  // question line). Owner ruling 2026-08-14: "I do not want ... any emphasis connected to a
  // question ... app wide."
  // 3,112 -> 3,111 on 2026-08-19. #2420's parallel run retires under the standing rule that a
  // question carries no Emphasis, because the owner ruled its second line a Question. posts
  // 1,357 -> 1,356: that run was the drop's only Emphasis occurrence. Not a detector change.
  // 3,111 -> 3,105. NOT a detector change and not a withdrawal: 65 new Questions retire the
  // Emphasis sitting inside them under the standing rule that a question carries no Emphasis
  // (parallel runs 479 -> 481, rows inside questions 1,556 -> 1,560), and one bracket line moved to
  // Codes, because a span cannot be both the notation and the emphasis on it.
  // emphasis: RETIRED 2026-08-21. The section, its data and its highlights are gone.
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
  // 115 -> 353 on 2026-08-24: the owner's Resolution Center sheet, 238 comms strings,
  // coordinates and glyphs sent to the queue rather than to a section. Nothing is certified by
  // them and no section count moves; the queue is where the archive says what it has not settled.
  resolution: { total: 353, entity: 30, theme: 16, code: 266, classification: 31, source_reference: 10 },
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
  // 111 -> 114 on 2026-08-19, and NOT a detector change either. Two causes, both recorded:
  //   +2  #1975 and #2776 — quoted questions the owner ruled INTO Questions. A question Q
  //       reproduces inside a quotation is exactly the shape this tripwire tracks, so ruling it
  //       certified legitimately adds it to the debt. The ruling was made knowing that.
  //   +1  #4454 — apply-questions-final.mjs recomputed a unitText that questions.json had been
  //       shipping stale. That materialiser could not COMPLETE on the committed data (its owner-
  //       ruling gate counted pushes, and #524's ruling was already baked in, so it scored 0 of 1
  //       and aborted), which is why the stale value survived. Fixing the gate let it run.
  // 234 -> 235 and claims 597 -> 598 on 2026-08-21, one cause, recorded before it was accepted:
  //   +1  #4861 "House resolution passed condemning 'Qanon'", ruled a Claim by the owner. Q wrote
  //       that line with his ">" indent marker, and the quoted-block detector reads a ">" line as
  //       source material. That IS the over-extension this debt records — the certified section is
  //       right and the detector is wrong, exactly as it is for the other 597. Not a new defect.
  // questions 100 -> 101 in the same run, and NOT from a ruling: re-running apply-questions-final
  // corrected a stale unitText on #2971, so "proof = evidence?" left the frozen set while the
  // recomputed spans brought others in. The set file and these counts had ALREADY been out of step
  // before this batch (set: claims 594, directives 128; baseline: 597, 129), so both records were
  // re-frozen together rather than one being patched to agree with the other.
  // postsAffected stays 235: the repair removed six OCCURRENCES but no drop lost its last one —
  // #2211, #4630 and #4632 still carry other over-extended spans. Occurrence count and post count
  // move independently, which is why both are recorded.
  // 235 -> 269 on 2026-08-24, and it is the SAME cause as the +1 recorded just above for #4861:
  // Q writes a list with his own '>' bullet, and sourceLines() reads a leading '>' as a quotation
  // marker. #3838 lists '>Race / >Religion / >Class / >Political Affiliation / >Gender'; #1749
  // lists '>GOOD v EVIL / >RIGHT v WRONG / >HUMANITY'. Round 2 of the unhighlighted-sentence
  // review certified 162 such lines, every one of them Q's words with Q's punctuation in front.
  // The certified sections are right and the detector is wrong, exactly as for the other 773,
  // and the direction of the error is unchanged: sourceLines() over-claims source, so this guard
  // under-reports Q-authored text rather than admitting text Q never wrote.
  postsAffected: 269,
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
  // questions 89 -> 92 on 2026-08-19, same three occurrences as postsAffected 111 -> 114 above:
  // two quoted questions ruled into Questions (#1975, #2776) and one stale unitText recomputed
  // (#4454). The occurrence SET in audit/source-boundary-occurrences.json is re-frozen with them,
  // so the next unexplained drift still prints exactly which row moved.
  // questions 89 -> 91 on 2026-08-19, measured AFTER the full apply chain settles (not from a
  // partial run): +2 quoted questions ruled into Questions whose text sits inside a quoted
  // block (#1975, #2776), +1 stale unitText recomputed (#4454), -1 as #2420's Emphasis retired
  // under the question rule and left the set. postsAffected moves 111 -> 113 for the same
  // reasons. NOT a detector change: quotedBlocks.mjs is untouched.
  // 2026-08-20. 91/55/139 -> 100/129/597, and 113 -> 234 posts. THE DETECTOR DID NOT MOVE:
  // lib/sourceSpansV2.mjs and lib/quotedBlocks.mjs are untouched, and not one previously-frozen
  // occurrence left the set (+540 / -0). What grew is the CERTIFIED population it measures - the
  // owner's unhighlighted-sentence ruling added 6,108 occurrences, and 540 of them sit inside
  // blocks this detector over-extends, which is exactly the shape this debt tracks.
  //
  // Every one of the 540 was matched back to a row in audit/unhighlighted-owner-rulings.json before
  // the set was re-frozen; the added list is kept in audit/source-boundary-drift.json. A baseline
  // is never moved to make a check pass, and this one moved only because each added row was named.
  // 2026-08-21 abbreviation repair: claims 598 -> 593, questions 101 -> 100. The debt FELL, and it
  // fell for the right reason: on each affected drop the truncated head and its orphaned tail were
  // BOTH counted as over-extensions, and one repaired span replaces the pair. 13 rows left the set,
  // 7 entered it, net -6. Nothing about the detector changed.
  // 2026-08-22, the lane-B reviews: 37 occurrences LEAVE the debt set and 9 enter it, net -28, and
  // every one of the 46 is a span an adjudication moved. The baseline follows the set, which is the
  // only reason it is ever allowed to move.
  //
  //   -37  spans withdrawn or re-spanned off quoted material. #19's eight-sentence blob, #1841's
  //        duplicate of two already-certified quoted sentences, #2211's two pasted biographies,
  //        #4630's and #4632's abbreviation-split heads, #25's directive line — all gone or trimmed
  //        back to what they actually cover.
  //    +9  spans a repair moved ONTO quoted material, which is the honest cost of the repair and
  //        not a new defect. #2177 trimmed to items (1)-(3) of a pasted prohibition; #2939 and
  //        #2973 re-spanned onto "Criminal aliens." inside a quoted passage; #25 trimmed to Q's
  //        two-sentence commentary, which sourceLines() reads as quoted because the line above it
  //        opens a quotation; #2971 trimmed to the quoted study line it opens on.
  //
  // postsAffected 235 -> 234: one drop lost its last over-extended span. Occurrence count and post
  // count move independently, which is why both are recorded.
  // postsAffected 234 -> 235 on 2026-08-23: #2744 quoted three verses and carried no certified
  // directive or claim over any of them, so it held no debt. It now holds three verse blocks and
  // enters the set. Nine drops appear in the drift; only this one is new to it.
  // THE SCRIPTURE RULING MOVES THIS DEBT ON PURPOSE (2026-08-23), and it is the one case so far
  // where a row on quoted material is the INTENDED result rather than a detector over-reach.
  //
  // Quoted scripture IS quoted material, so sourceLines() rightly reads a verse block as
  // non-Q-authored — and the owner has ruled that the passage is nonetheless a certified Directive.
  // So these rows are permanent, declared debt, not a defect awaiting a detector fix.
  //
  //   directives 128 -> 107   -32 sentence-level fragments of quoted passages withdrawn,
  //                           +11 whole passages certified in their place. The same text, on the
  //                           same quoted lines, as ONE row each instead of many.
  //   claims     564 -> 552   -12 fragments withdrawn to the Directive that now covers them.
  //
  // Net: 44 debt occurrences out, 11 in. The set file is re-frozen with the ruling, and the drift
  // that produced it is enumerated in audit/source-boundary-drift.json.
  // 2026-08-24, round 2: directives 107 -> 115, claims 552 -> 721. Questions unchanged at 99.
  // All 162 are Q's own '>' bullet lines - see the postsAffected note above for why the count
  // moved without the detector claiming any new territory.
  baseline: { questions: 99, directives: 115, claims: 721, emphasis: 0 },
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
  'backfill-analysis.mjs', 'apply-questions.mjs', 'apply-questions-final.mjs',
  'apply-directives.mjs', 'apply-claims.mjs', 'audit-evidence.mjs', 'apply-evidence.mjs',
  'audit-entities.mjs', 'adjudicate-entities-tail.mjs', 'adjudicate-entities-other.mjs',
  'adjudicate-entities-lowconf.mjs', 'resolve-entity-context.mjs', 'apply-entities.mjs',
  'audit-themes.mjs', 'apply-themes.mjs', 'audit-codes.mjs', 'adjudicate-codes.mjs',
  'apply-codes.mjs', 'build-resolution-queue.mjs',
  // Last: relationships join every section, so every section has to exist first.
  // The literal-span materialisers must run after every apply that rewrites their inputs, or the
  // next export silently reverts them — the same failure that reverted Questions to 6,299 and
  // left postAnalysis.namedEntities on the legacy extractor for months.
  'materialize-evidence-literals.mjs', 'materialize-literal-spans.mjs', 'apply-context-units.mjs',
  // AND THE CERTIFIED ENTITY STATE, RE-MATERIALISED. apply-entities.mjs rebuilds Entities from the
  // adjudication as it stood BEFORE the 2026-08-17 integrated cleanup, so a chain without this step
  // lands on 1,409 rows / 9,749 mentions and build-search-index.mjs refuses at its QA gate. The
  // bundle was reproducible only by hand for one deploy, which is to say it was not reproducible.
  // Declared here so the chain-complete invariant fails if it is ever dropped again.
  'apply-entity-cleanup.mjs',
  // STEP 3B-1, then the two steps that finish the entity state it moved. apply-step3b1.mjs collapses
  // duplicate entity records; reconcile-entity-registry.mjs brings entities.json down to match them;
  // build-entity-public-view.mjs derives the public rows from the result. The view used to sit
  // BEFORE apply-step3b1.mjs and was therefore built from a registry 99 mentions ahead of the
  // records it described.
  'apply-step3b1.mjs', 'reconcile-entity-registry.mjs', 'build-entity-public-view.mjs',
  // RETIRED SECTIONS ARE STRIPPED LAST AMONG THE WRITERS. apply-claims.mjs rebuilds
  // impliedConclusions and verificationHooks from audit/claims-final.json on every run, so this has
  // to follow the last step that can write them — which is apply-step3b1.mjs, not apply-codes.mjs
  // where this list had it. Declared out of order, the chain-order invariant fails, and it did.
  'retire-sections.mjs',
  'build-relationships.mjs', 'build-search-index.mjs',
]

/** Artifacts covered by the certification manifest. */
export const ARTIFACTS = [
  'posts.json', 'questions.json', 'evidence.json', 'entities.json', 'themes.json',
  'codes.json', 'resolution-queue.json', 'relationships.json', 'search-index.json',
  // Reader-facing editorial text, and the only artifact here that is prose rather than counts.
  // It is covered for exactly that reason: a silent change to what the archive SAYS about a named
  // person is harder to notice than a count that moves, and impossible to notice from a total.
  'entity-hovers.json',
]

/** Whitespace-normalised comparison — the one approved reconstruction. */
export const nspace = s => String(s ?? '').replace(/\s+/g, ' ').trim()
export const nlower = s => nspace(s).toLowerCase()
