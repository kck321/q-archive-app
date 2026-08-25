// Local writable data layer — the app's database when running offline / as a desktop app.
//
// Source of truth = IndexedDB, seeded once from the exported JSON bundle (public/data/*.json).
// The whole ~8 MB archive is held in memory for instant reads; every write mutates the
// in-memory store AND persists the affected collection back to IndexedDB (debounced), so
// edits survive restarts with zero network. No Firestore needed for browsing or editing.
//
// Reseed from a fresh export by bumping SEED_VERSION (or clearing the IndexedDB) and running
// `node scripts/export-firestore.mjs` to regenerate public/data/*.json.

import type { QPost, QQuestion, QTopic, QResource } from '../types'
import { fetchOverrides } from './sync'
import { IS_PUBLIC_SITE } from './appMode'
import { selectOverrideFields } from './overrideProvenance'
import { buildRefIndex } from './refIndex'

export interface AnalysisConfirmedDoc { id: string; key: string; category: string }
export interface InfographDoc { id: string; questionId?: string; [k: string]: unknown }

export type CollectionName = 'posts' | 'questions' | 'topics' | 'resources' | 'analysisConfirmed' | 'infographs'

export interface LocalStore {
  posts: QPost[]                 // sorted by postNum ascending
  questions: QQuestion[]
  topics: QTopic[]
  resources: QResource[]
  analysisConfirmed: AnalysisConfirmedDoc[]
  infographs: InfographDoc[]
  postsById: Map<string, QPost>
  postsByNum: Map<number, QPost>
}

const COLLECTIONS: CollectionName[] = ['posts', 'questions', 'topics', 'resources', 'analysisConfirmed', 'infographs']

// Bump to force a re-seed from the JSON bundle (discards local IndexedDB edits).
// 5: certified Emphasis — 5,251 occurrences. Every apply step since v4 rewrote postAnalysis
// inside posts.json (Directives, Claims, Emphasis), and a returning visitor keeps the seeded
// copy until this number changes, so certified counts would show only to first-time visitors.
// 6: literal rendering spans + Context units. contextUnits, themeAnchors, claimSpans,
// predictionSpans, conclusionSpans and checkableSpans were all materialised into posts.json and
// deployed while this number stayed at 5, so every returning profile kept its cached bodies and
// analysis and saw NONE of it — Context rendered 0/4,893 live, theme anchors 655/1,478. The
// certified data was correct on the server and invisible in the browser.
//
// This is the SECOND time in one day: it sat at 4 through the Directives, Claims and Emphasis
// applies for the same reason. Any change to posts.json content must bump this number, and the
// invariant below now asserts it against the materialised fields rather than trusting memory.
//
// 7: the seven owner-adjudicated Claims (#570/#855/#1001/#1832/#1881 "Pure EVIL.", and #2917
// "Pure evil." + "The 'real' racist."). THIRD time. The bundle was correct on the server, the
// live Claim total read 4,188, and a fresh browser profile painted both #2917 sentences amber
// with the overlap rotation on 'real' — while the owner's own browser, which had seeded at 6,
// showed neither. "Deployed and verified in JSON" is not the same as "reaches a returning
// reader", and only this number decides the difference.
//
// 8: Context corrected for those same rulings. Four of the five "Pure EVIL." occurrences had been
// dispositioned CONTEXT_OR_LABEL, and Context means "reviewed, and in no semantic category" — so
// #570 rendered the sentence as an overlap titled "2 certified layers: claim, context", one span
// presented as classified and unclassified at once. Context units 4,906 -> 4,902.
//
// 9: "Ascension." ruled into Religion & Spirituality on #4963 and #4966 (themes 2,393 -> 2,395),
// those two spans removed from Context (4,902 -> 4,900), and Context's own treatment changed from
// a dotted underline to a grey fill because the underline was too faint to see.
//
// 10: section headlines read certified totals instead of summing the phrase-frequency index,
// which had been reporting Claims as 4,175 against the certified 4,188 — the index groups by
// phrase, so 13 in-post repeats collapsed. No posts.json change, but the frequency cache is
// stamped with this number and the header wording changed, so returning readers re-seed.
//
// 11: four ACROSTIC Emphasis rulings — [N]othing [C]an [S]top [W]hat [I]s [C]oming (#4951),
// [N]o [S]uch [A]gency and [C]los[I]ng [A]ct: (#129), and LDR spelled across #150. A tenth
// device type; Emphasis 5,251 -> 5,255 across 1,737 -> 1,739 posts.
//
// 12: owner Entity ruling — "Dominion." (#4963) -> Dominion Voting Systems, the only occurrence
// in the archive. Entities 1,332 -> 1,333 canonical, 7,903 -> 7,904 mentions. Also widens the
// per-post Brackets panel, which had been dropping 618 bracketed spans across 353 posts.
//
// 13: acrostic Emphasis renders as the BRACKETS, not the containing line. #150 spreads [L] [d]
// [R] across two sentences that are already a Prediction and a Claim, so the line-level span put
// a second layer over every word of both and the whole drop flashed between three colours. One
// certified occurrence, several literal spans — same shape as parallel_phrasing. Count unchanged.
//
// 14: bracketed spans now PAINT in the drop, in the red the [ Brackets ] panel uses. The panel
// listed them while the drop showed nothing, so a reader could see [+family (follow)] named and
// have no idea where it was. Panel and highlight share one definition (bracketSpansIn).
//
// 15: #150 acrostic Emphasis WITHDRAWN by owner ruling (both sentences are already a Prediction
// and a Claim, so the extra layer added nothing) -> 5,254 across 1,738 posts. Plus: any second
// layer inside a question now rotates instead of showing a flat blue fill with an "also:" tooltip.
//
// 16: containment is not overlap. A bracket inside a question is not two classifications of the
// same span — the question is the container — so it shows its own colour and rotates only when
// the SAME span belongs to two or more categories.
//
// 17: [ Brackets ] chips are clickable, like every other analysis chip — they search the archive
// for the span so a reader can see every other drop it appears in.
//
// 18: #150's [L] resolved out of the Resolution Center — it is one letter of the [L][d][R]
// acrostic, not a notation token. Queue 2,527 -> 2,526, code kind 173 -> 172. No new category.
//
// 19: the bracket structure layer no longer paints where a certified layer already covers the
// same span. [barrage] is certified Emphasis of type bracket_emphasis — the bracket IS the
// emphasis — so painting a structure layer over it made one device rotate as if it were two.
//
// 20: rotation counts DISTINCT KINDS, not segments. [A] in #129 belongs to both the CIA and NSA
// acrostics, so it matched Emphasis twice and rotated as "2 certified layers: emphasis".
//
// 21: the overlap animation cycles the span's OWN category colours. It was a fixed six-colour
// rainbow (red, amber, violet, cyan, orange, lime) applied to every overlap regardless of its
// categories, so a Claim + Implied Conclusion span flashed cyan and magenta — colours no category
// on the page owns — and the highlight could not be decoded against the legend.
//
// 22: [barrage] withdrawn from Emphasis on #4742 by owner ruling (bracketed item, not a device) —
// 5,254 -> 5,253, 1,738 -> 1,737 posts; the #4741 occurrence stands. Runbeck Election Services
// added as an Entity on #4963 — 1,333 -> 1,334 canonical, 7,904 -> 7,905 mentions.
//
// 23: Questions and Requests chips are clickable — they were the last analysis rows left as dead
// text, so a reader could not ask where else Q said the same thing.
//
// 24: analysis chips carry an ARCHIVE-WIDE count. The x19 shown before was a per-category figure
// ("Knowledge is power." is x19 as a Claim, x6 as an Implied Conclusion), so a phrase classified
// in one post showed no number at all and the same wording showed two different ones.
//
// 25: OWNER RULE — anything in brackets is red, always, and never rotates. The layer had been
// deferring to certified spans, so #4741 showed [past 7 days] red while [barrage] and [counter],
// both certified Emphasis, showed slate: three bracketed items, two colours.
//
// 26: bracketed spans are COUNTED as bracket items in the analysis map, so the map total agrees
// with the [ Brackets ] list under it. Owner rule: anything in [..] is red and is counted.
//
// 27: OWNER RULE — a span certified as a Question is not also Emphasis. Applied as a rule, not a
// list, so it keeps holding: 104 rows retired (the whole repeated_question device, 95, plus 9
// repeated_word rows that were questions). Emphasis 5,253 -> 5,149 across 1,737 -> 1,731 posts.
//
// 28: every category's chips carry the archive-wide count, brackets included. A missing number
// used to mean "this row was never counted" and read as "appears once".
//
// 29: C19 ruled an alias of COVID-19. The entity shipped with COVID-19 as its ONLY alias, so 34
// occurrences across 11 posts resolved to nothing. Mentions 7,905 -> 7,939, posts 2,222 -> 2,233.
//
// 30: CCP ruled to be the Chinese Communist Party — no entity existed for it at all, because
// nothing in the corpus spells the name out. 1,334 -> 1,335 canonical, 7,939 -> 7,943 mentions.
//
// 31: brackets outrank entities. "[Mueller failed]" rendered as a red "[", a cyan "Mueller" and a
// red " failed]" — one bracket, two colours, the bracket rule broken inside the thing it governs.
//
// 32: Themes render first in Post Analysis — the subject of a drop is the orienting fact.
//
// 33: Themes renders directly under the Tone line, above the Analysis map, Questions and
// Requests. Seed 32 only moved it to the top of the CATS loop, which runs after all three.
//
// 34: the archive list and the post page now paint identically. /posts had its own copy of the
// question branch that painted a whole question blue whatever sat under it, so ">End POTUS
// rally(s)?" hid the certified Entity POTUS there while /post/:id showed it cyan — two surfaces
// disagreeing about the same certified data. It also never fed the bracket layer, so /posts
// painted no brackets at all. Both fixed, with the same rules in both files.
//
// 35: "University of Technology" and "WUT" ruled aliases of Wuhan University of Technology. The
// entity already existed with only its full name as an alias, and that string never appears —
// Q wrote "[Wuhan] University of Technology (WUT)", so the bracket breaks the contiguous name.
//
// 36: the parallel_phrasing run on #4738 withdrawn from Emphasis by owner ruling — both lines are
// Questions. The standing question rule missed it because that row's sourceText is the LABEL
// "why …", and the rule matches sourceText against certified questions.
//
// 37: open tabs reload themselves once when a new build activates. The worker already claimed
// them, but they kept running the JS they had downloaded — including the old SEED_VERSION, the
// value that decides whether to re-seed. That is why correct, already-deployed data kept being
// reported as missing: the browser was running yesterday's code against today's bundle.
//
// 38: OWNER RULING — "if it's a question I would rather it be a question not an emphasis." The
// rule now also retires parallel runs whose every line is a certified question: 479 runs, on top
// of the 104 whose span WAS the question. Emphasis 5,148 -> 4,669 across 1,731 -> 1,667 posts.
// Runs that MIX questions with other lines stand: there the device is the structure, not the
// questions.
//
// 39: theme chips link to /analysis?tab=themes instead of a text search. A theme label is
// inferred from a drop and never appears in one, so /posts?q="Media & Information" returned
// "No posts found" while the facet beside it reported 301.
//
// 40: OWNER DECODE — [D] = Democrat, [F] = Foreign. Not a new category: both were already
// certified codes (195 and 23 occurrences) carrying no interpretation, because the corpus never
// spells either out. Interpreted codes 5 -> 7, unresolved 734 -> 732. Confidence OWNER, not HIGH,
// so the provenance stays visible: this is an adjudication, not a corpus-established reading.
// 41: OWNER RULING — bare COVID is the COVID-19 entity. It was certified with COVID-19 and C19
// as its only aliases, so the standalone form Q writes in #4489, #4541 and #4548 resolved to
// nothing. Mentions 7,945 -> 7,950, adjudicated tail 3,476 -> 3,481. The alias matcher needed a
// lookahead: the hyphen in COVID-19 is a word boundary, so a plain /\bCOVID\b/ also matches all
// 60 COVID-19 occurrences and would have added 60 phantom mentions to the same entity.
//
// 42: "Go to Post" stays in the archive. It used to navigate(`/post/N`), leaving /posts entirely
// and losing the scroll position, the surrounding drops and any active filter. Jumping to a post
// number is a request to look at it IN CONTEXT; opening the detail page stays a click.
// 43: OWNER RULING — Rachel Chandler, Ray Chandler and RC are one person. Two certified rows
// held her under two names, and Q's shorthand RC sat in the Resolution Center as 13 unanswered
// rows. Ray Chandler is absorbed as an alias (canonical 1,335 -> 1,334) and 12 RC occurrences
// resolve to her (mentions 8,227 -> 8,239, queue 2,245 -> 2,233). #2's "all his funds in a RC"
// is excluded and stays queued. posts.json is rewritten, so returning visitors need this bump.
// 44: OWNER RULING — no Emphasis is tied to a question, app wide. The rule now also retires any
// occurrence whose LINE contains one of that post's certified questions: 1,555 rows on top of the
// 104 whose span WAS a question and the 479 all-question parallel runs. Emphasis 4,669 -> 3,114
// across 1,667 -> 1,358 posts. #5 listed two whole questions under Emphasis because the panel
// lists a row by its line — suppressing the paint hid it in the drop and left it in every list.
// 45: OWNER RULINGS — "Clinton's" in #5 is Hillary AND Bill (two mentions, entities 8,239 ->
// 8,241); NP in #5/#6 is a non-profit, NOT Nancy Pelosi (#36 asks the same question with NPO),
// resolved without creating an entity; "In time." in #4965 is a Claim, not Context
// (Claims 4,188 -> 4,189, Context 4,900 -> 4,899). Resolution Center 2,233 -> 2,231.
// 46: OWNER RULINGS on #4963 — SOS Offices./Investigators./Researchers./Whistleblowers./
// Patriots are Entities (1,334 -> 1,339 canonical, 8,241 -> 8,246 mentions); "Patriots in
// trusted positions." and "Time to show the world." are Claims (4,189 -> 4,191); SOS out of
// Emphasis (3,113 -> 3,112). Implied Conclusions retired as a SECTION — all 966 were already
// certified Claims, so the view goes and the rows stay.
// 47: OWNER RULING — every Patriot/Patriots form is one Entity, registered in the Entities
// stats: Patriots 119, Patriot 82, PATRIOTS 31, PATRIOT 3, patriot 3, patriots 1 = 239
// mentions across 221 posts. The tail's separate 'Patriot' row (person, 2) was MERGED in —
// two canonical rows claiming one token would double-count it. Entities 1,339 -> 1,338
// canonical, 8,246 -> 8,484 mentions.
// 48: OWNER RULINGS on #524 — "(Why don't we say his name?)" is a QUESTION (the detector
// anchors on a line ending in '?', and this one ends in '?)'; 6,442 -> 6,443); five lines are
// Claims (4,191 -> 4,196); NP here IS Nancy Pelosi, unlike #5 where the same token is a
// non-profit; CEOs and BODs are Entities (1,338 -> 1,340, 8,482 -> 8,485). Searching a bare
// post number now jumps to that drop instead of searching text for the digits.
// 49: OWNER RULING — NP is an alias of Nancy Pelosi corpus-wide, EXCLUDING #5/#6 where the
// same token was ruled a non-profit. 7 occurrences added, mentions 8,485 -> 8,491. Also: the
// analysis phrase itself now opens its drops in place, and the archive jump waits for pages
// in flight instead of declaring the post missing after one page.
// 50: the two NPs are now separate ENTITIES — Nancy Pelosi everywhere except #5/#6, and
// "Non-profit organization" on those two, so a search for her can never return the
// non-profit. 1,340 -> 1,341 canonical, 8,491 -> 8,493 mentions. Also: the archive jump
// re-anchors after the list settles — the card mounted but the page sat ~30 drops short.
// 51: owner review of the 21 predicate_of_previous_subject rows — 12 certified as Claims
// (4,196 -> 4,208), #1077 "Prevent at all costs." certified as a Directive (2,424 -> 2,425).
// PRINCIPLE: a predicate inherits a subject only from a PROPOSITION; where the line above is
// a Directive or an Entity there is nothing to inherit. Also: the archive jump now OPENS the
// list at the drop instead of paging to it — 30s+ down to under 2s.
// 52: OWNER RULING — lowercase "sessions" withdrawn as an alias of Jeff Sessions. It matched
// "friendly therapy sessions" (#2319) and news URLs; the man is always Sessions/SESSIONS.
// Mentions 8,493 -> 8,490. Also live now: questions paint in the analysis drop reader, the
// Resolution Center lists every row instead of 25 at a time, and the queued token is
// highlighted inside its context.
// 53: OWNER RULING — "Panic in DC." is a Claim wherever Q states it. 34 occurrences added
// (4,208 -> 4,242 across 1,957 -> 1,982 posts). 12 quoted occurrences stay out, and the two
// interrogative "PANIC IN DC?" lines stay Questions — they ask rather than assert.
// 54: owner-supplied Q-authored directive audit merged — 2,198 entries reviewed, 1,899 already
// certified, 280 added as COMPLETE sentences, 6 skipped because the audit wording does not appear
// verbatim in the drop. Directives 2,425 -> 2,705 across 1,418 -> 1,538 posts.
// 55: OWNER RULING — every DC in the archive is Washington, D.C. The context pass had resolved
// 14 and left 88 queued as "city or initials"; the owner reviewed the set and ruled the city
// throughout. Mentions 14 -> 102 across 80 posts, Resolution Center 2,224 -> 2,136.
// 56: OWNER RULING — SC is the Supreme Court in 24 named drops (#4 … #4153). Scoped with a new
// includePosts whitelist rather than applied corpus-wide, because SC is also a person's initials
// elsewhere. 31 occurrences in those posts; mentions 8,578 -> 8,599, queue -27 rows.
// 57: OWNER RULING — U.S. = United States, all 71 queued appearances (none meant anything else).
// Mentions 8,599 -> 8,670. Two matcher defects fixed to get there: a trailing \b can never match
// after a period (U.S. found 2 of 72), and a recounted alias was double-emitting the occurrences
// the context pass had already resolved (14 DC + 10 SC). SC rows outside the 24 ruled posts are
// back in the Resolution Center — a scoped ruling now clears only the posts it names.
// 58: OWNER RULING — BO resolved PER OCCURRENCE into three referents: Barack Obama (16 drops),
// Bruce Ohr (10: Steele/Nellie Ohr/DOJ/Huber/testimony), Board Owner (9: /BO/, Bakers, Vols,
// IP-hash). No global BO alias, which would have corrupted the later two. #235 left queued as too
// short to decide. Mentions 8,670 -> 8,717.
// 59: OWNER RULINGS — SR and NG, both scoped per occurrence.
// SR = Seth Rich in 9 drops (SR/JA/WL lawsuit, "Q: SR" + DNC suit, SR 187, server unlocks SR).
// NOT global: SR is Susan Rice in the #559 Hussein-cabinet roster and the SENIOR rank in #1573,
// #2658 (SR+MID+LOW) and #4640 (Pentagon [SR 1-4]) — all four stay queued, now carrying owner
// NOTES, a new third state between resolved and silent that records reasoning without moving a
// count. NG = National Guard in all 9 queued drops (#128 stays NG even though the drop calls the
// surrounding claim disinformation — the abbreviation still means the National Guard).
// Mentions 8,717 -> 8,737, queue 1,978 -> 1,955.
// 60: OWNER RULINGS — DNI, MI and SIS, plus a REPAIR of two earlier batches.
// DNI = Director of National Intelligence, all 13 cards (new entity; nothing in the corpus
// spells the office out). MI = Military Intelligence in 14 drops and Michigan in #4171 alone
// ("lockdown CA, NY, OR, MI"). SIS = MI6 in 8 UK-prefixed drops, attached to the EXISTING MI6
// entity so one organization stays one record; the 4 US-lineage/ambiguous cards stay queued
// with owner notes.
// REPAIR: a scoped recount REPLACES an alias count, so occurrences the certified context pass
// had already resolved but which sat outside the owner scope were dropped from the count AND
// the highlighting, while entities.json still listed the post. 22 lost occurrences restored:
// 3 Seth Rich (#1195, #436 x2), 13 BO, 6 SC. New invariant entities-scope-drop makes it
// impossible to repeat silently. Mentions 8,737 -> 8,793, queue 1,955 -> 1,921.
// 61: OWNER RULING — RT split three ways, and the READER INFO BOX.
// RT = Rex Tillerson in #947 (x2), #959, #2844 (new entity). RT = "real time" in 8 drops and
// "retweet" in #1109 — both resolved and removed from the queue WITHOUT becoming entities,
// because "this is not a person, place or organization" is a complete answer.
// NEW: hover/press info box on every acronym and initialed name, app-wide. Post-aware, so BO
// reads Barack Obama in #36 and Bruce Ohr in #1828; built by scripts/build-glossary.mjs from the
// certified entities plus audit/notation-glossary.json for non-entity shorthand. One shared
// layer (src/lib/glossary.tsx) drives PostDetail, PostCard and the inline reader, so the three
// surfaces cannot drift. Mentions 8,793 -> 8,797, queue 1,921 -> 1,908.
// 62: OWNER RULINGS — seven tokens, 92 occurrences, all post-scoped.
//   JA   -> Julian Assange (12 cards)        PP -> Planned Parenthood (12)
//   WL   -> WikiLeaks (12)                   BC -> Bill Clinton (18 across 14 posts)
//   CM   -> CodeMonkey (11) + Cheryl Mills (#1828, grouped with HRC/BC/Huma, not board terms)
//   SS   -> Secret Service (11) + Supreme Court (#1151, written SS but read SC — a typo,
//           carried as a readerNote so the info box explains itself instead of looking wrong)
//   WASH -> Washington Post (12) + Washington Free Beacon (#1828) + Washington, D.C. (#524);
//           #1493 and #1731 stay queued, the owner marked them unresolved.
// New entities: Cheryl Mills, Washington Post, Washington Free Beacon.
// JA/WL/BC each carried context-resolved occurrences OUTSIDE the owner list (#1199; #1870,
// #3764, #4162; #36, #1220, #1556, #3383) — folded into scope so the recount preserves them.
// Mentions 8,797 -> 8,889, queue 1,908 -> 1,816, glossary 109 -> 113 tokens.
// 63: INFO BOX — off-screen fix, and acronym coverage.
// Positioning: the box was absolutely positioned and centred above the token, so it opened
// half outside the window near a line end and upward into nothing at the top of a drop. Now
// fixed-positioned and clamped to the viewport on BOTH axes (preferring above, but never
// trusting that branch — 6 of 21 test cases still overflowed when the anchor sat below the
// fold). Closes on scroll, resize and Escape.
// Coverage: 28 entities are NAMED with an acronym (POTUS at 370 mentions, CNN, DARPA, MI6,
// SDNY...), and the builder only glossed aliases that DIFFER from the canonical, so all 28 had
// no info box at all. audit/acronym-definitions.json supplies expansions; 27 defined, LORD
// deliberately left out with a stated reason. Glossary 113 -> 140 tokens.
// Standing rule, now enforced: invariant entities-acronyms-defined fails the build if an
// acronym-named entity ever ships without a definition or a recorded reason.
// 64: OWNER RULINGS — DAG, JB, JK, HCQ, NYC, RBG, AWAN (74 cards).
// DAG resolves to the OFFICE, Deputy Attorney General, never automatically to one person:
// Rosenstein is the officeholder in 5 drops, and #3210/#3211 span TWO officeholders (a quoted
// 2016 message from Sally Yates + commentary on Rosenstein). Carried as per-post reader notes.
// JB is three people, and #1828 needed OCCURRENCE-level scoping: four JB there are John Brennan
// and the one inside the FBI personnel list is James Baker. New includeOccurrences addresses an
// occurrence by [line, char] — the same coordinates the queue row id uses.
// JK = Jared Kushner (7) / John Kerry (3). HCQ = hydroxychloroquine (7 Reference cards); the 4
// Device cards ruled NOT emphasis. NYC (11), RBG (11), AWAN = Imran Awan (11).
// New entities: Jeff Bezos, New York City. Mentions 8,889 -> 8,959, queue 1,816 -> 1,742.
// Info box: a drop with two readings now names both instead of staying silent.
// 65: OWNER RULINGS — 11 tokens, 233 cards (226 resolved, 7 deliberately held).
//   MZ Mark Zuckerberg 11 | NY New York 18 + New York Post (#1515) | LL Loretta Lynch 21
//   BLM Black Lives Matter 24 | AUS Australia 26 | MZ/NY/LL/BLM/AUS all single-referent
//   JFK five referents: the president 14, JFK Jr (#1082), the airport (#1588), Gen. John
//     Francis Kelly (#1433 — his own initials), the JFK Conference Room (#709)
//   CS CrowdStrike 2 / Christopher Steele 8 / Chuck Schumer 11 (incl #559 on the updated ruling)
//   JC James Comey 18 / James Clapper (#1828 [DNI [JC]], occurrence-scoped)
//   ES Eric Schmidt 15 / Edward Snowden 6 — Q writes "ES = @Snowden" outright in #1911
//   Jack Dorsey 20; #4632 x2 are NOT shorthand (Jack W. Gardner given name, Larry Jack Schwarz
//     middle name) — occurrence-scoped to two different people in one drop
//   PS Peter Strzok 20 / PlayStation 3 / postscript (#15, not an entity at all)
// HELD with reasons: JFK #742 #743, JC #1591, JC #559 x2 (two men, order unknown — explicitly
// not both Comey), ES #4533, PS #1380. New entities: 6. Mentions 8,959 -> 9,185.
// Queue 1,742 -> 1,516.
// 66: WASH POST joined into ONE entity, + ABC / RE / OP (85 cards).
// The owner saw three separate WASH highlights on #2401 where the drop says "WASH POST" three
// times — half a name presented as the whole reference. The alias is now the full two-word form
// (12 occurrences), and every other WASH ruling carries notFollowedBy so a bare WASH can never
// claim the first half of it. Same shape as COVID-19 vs COVID.
// ABC: ABC News 16, CIA 2 (#1806 high / #2549 medium confidence, noted per post), 8 generic
// "alphabet agencies" glossed as notation, #1379 held — the token alone is not evidence.
// RE: Rahm Emanuel in #1828 only; the other 28 are the ordinary "RE:" = regarding.
// OP: Operation Mockingbird (#626, joined as OP Mockingbird), an operation named Fiddler (#836),
// 27 generic "operation", and #1745 a FALSE MATCH inside "CO-OP STRATEGY".
// Mentions 9,185 -> 9,205 (65 of the 85 cards are notation, and move no count).
// Queue 1,516 -> 1,431.
// 67: RELIGIOUS / SPIRITUAL AUDIT — 581 sentences into Religion & Spirituality.
// Owner supplied a 1,264-record GPT audit graded GREEN/YELLOW/RED. GREEN taken as concrete;
// YELLOW and RED reviewed sentence by sentence, not by category label — "Have faith in Humanity"
// and "What faith does HUMA represent?" share a category and only one is about religion.
// Kept: 514 GREEN, 59 YELLOW, 8 RED = 581 across 328 posts (204 newly themed).
// Every anchor is the COMPLETE sentence, so no religious highlight stops mid-sentence.
// 232 records could not be used: they are image text, OCR, or wording from posts QUOTED by Q,
// and do not reproduce verbatim from the canonical body. Listed for re-checking, not discarded.
// Theme assignments 2,395 -> 2,599; posts with a theme 1,767 -> 1,887.
// 68: ABC / Clinton / FED / VIP — 99 cards on the full-context resolution map.
// Clinton is not one person: Clinton Foundation 9, Hillary/campaign 8, Bill 1 (#3035, named in the
// linked court material), and 8 that mean the family/network — glossed as such rather than forced
// onto an individual. 5 held (#2848, #300, #666, #4819 x2) where the post cannot distinguish them.
// FED splits Federal Reserve 14 from the federal GOVERNMENT 13 (FED G / FED GOV), plus 4 uses of
// the adjective and #2399 where FED is the verb fed — a false positive kept on the record.
// VIP: VIPAnon (@Q_ANONBaby) 3, Adm. John Richardson #2669 on the Navy date match, 3 VIP-access,
// and 29 VIP Patriot honorifics addressed to different supporters — not one entity.
// ABC #1379 closed as Alphabet Inc. with a confidence note; the drop never decodes it.
// Mentions 9,205 -> 9,250, queue 1,431 -> 1,336.
// 69: NOTATION AUDIT — 172 code cards: 143 approved, 29 held.
// The Codes queue mapped one-to-one onto the audit, so every card was adjudicated.
// Approved means the notation FUNCTION or textual referent is identifiable — SCI[F] completing
// SCIF, [R] = Renegade stated outright, timestamps, day/night sequence markers, [187] as
// homicide shorthand. It does not endorse any factual claim the drop makes.
// The 29 held are held for one reason: the corpus never establishes a single safe meaning, and
// outside-community lore was not used to force one. Snow White, Wizards & Warlocks, RED_RED,
// CASTLE_ROCK, [CLAS 1-99] and the bare markers stay in the Resolution Center with the reason
// on the card. #757 keeps three of them and #1828 two, so the holds are keyed per occurrence
// rather than per post — a post-level hold would have stranded resolvable cards in those drops.
// Codes queue 172 -> 29. Queue 1,336 -> 1,193.
// 70: SUBJECT AUDIT — 251 theme cards: 235 resolved, 16 left open.
// These rows were CANDIDATES, not assignments — the context guard fired, so the theme was never
// applied. That is why 187 removals move no certified data: declining a candidate simply closes
// the question. Keep 41 and Move 7 ADD the theme (a Move declines Foreign Affairs and applies
// Censorship & Technology instead).
// The standard held throughout: a country name attached to a domestic DOJ/FBI/Mueller/FISA
// dispute is not Foreign Affairs. Russia naming the ALLEGATION is not the same as Russia being
// the subject — which is why 234 Foreign Affairs candidates produced only ~30 keeps.
// The 16 medium-confidence cards stay in the Resolution Center carrying both the tentative
// reading and the reason it is still open.
// Theme assignments 2,599 -> 2,644; posts with a theme 1,887 -> 1,898. Queue 1,193 -> 958.
// 71: DEVICE AUDIT — 234 rhetorical-device cards: 203 resolved (83 keep / 120 remove), 31 held.
// Device here means a possible RHETORICAL device, not hardware. A repeated question word is not
// enough: "Why X? / Why Y?" is ordinary question grammar. A keep needs a non-obligatory repeated
// opening or a matched frame — anaphora, contrast, cadence.
// Matching took three passes and two of my own bugs. The export is UTF-8 round-tripped through
// Latin-1, so it holds "canât" where the queue holds "can't" — read as plain utf8, every
// affected row misses. And 19 rows are all-caps-emphasis candidates whose stored token is the
// trigger WORD (MIL, COVID, DRAIN) while sourceSpan carries the sentence the audit actually
// judged — keying on token alone leaves them unmatchable forever. Indexing both stored fields
// removed the need for the authorised prefix fallback entirely: 0 fuzzy matches.
// The 83 keeps are recorded but NOT materialised. Their label is a synthetic "A / B" join whose
// separator exists nowhere in the drop; each now carries its clauses as separate spans with
// offsets, awaiting a multi-span parallel-phrasing representation before it can be highlighted.
// Classification queue 234 -> 31. Queue 958 -> 755.
// 73: hover-glossary repair + Wizards & Warlocks resolved.
// Three terms opened a hover box that said nothing, or none at all. CBS and TMZ are SELF-NAMED -
// the alias equals the canonical - so build-glossary skips them in the entity pass and they can
// only come from acronym-definitions.json, where they had been written as bare strings instead of
// {expansion}. And IS_ACRONYM required two characters, which left Q - the most self-referential
// term in the corpus - with no hover box at all. Q is the only single-character canonical.
// Wizards & Warlocks: Q defines it outright in #2624 as "'Guardians' of intelligence". Recorded
// as notation, not an organization - the drops give the function and never the membership. The
// answer reaches the question through a reply to an anon post the corpus does not store, and the
// gloss says so rather than implying one drop states both.
// Queue 106 -> 105. Notation 29 -> 28.
// 74: Q becomes visible as an entity, and Q+ becomes a real alias of Donald Trump.
//
// Two different ways a term can exist on paper and not on screen.
//
// Q was certified with 10 body references, but posts.ts skipped bare "Q" in Named Entities in
// TWO places. That skip was right when it was written - nothing decided which Q was the author
// tag, so all ~4,000 signatures would have piled into one useless row. Certification now makes
// that call structurally, so the browser was deleting the 10 rows it had been built to protect.
// Membership belongs to the artifact; the browser does not get a vote. Same lesson as the
// backfill it sits next to.
//
// Q+ was never adjudicated at all. It lived only in aliases.json, the SEARCH registry, under
// potus - so the app listed Q+ among POTUS aliases while holding no occurrences to highlight.
// Now certified on DONALD TRUMP, the person, beside DJT. POTUS stays the office.
//
// All 36 Q+ occurrences count, sign-offs included - deliberately UNLIKE bare Q. Q+ signs 36
// drops, not thousands, so which drops carry it is itself the record: the + is the claim that
// the President was present at the signing. Scale is what made the bare-Q signature worthless
// and what makes this one evidence.
//
// Donald Trump 28 -> 64.
//
// CLINTON FOUNDATION IS ONE NAME. #1220 certified both "Clinton Foundation" and "Clinton", so
// the renderer drew the organisation as two boxes and the same seven characters counted twice —
// once as the Foundation, once as Hillary. Owner ruling: the surname is not a standalone
// occurrence when "Foundation" follows it. 11 duplicates withdrawn (9 Foundation, 2 Hillary).
// Fixed in the DATA, not the renderer. Collapsing nested spans at render time was built and
// reverted: it removed the hover explanation for 27 acronyms, because the info box attaches to
// the span of the term it explains. 79 other nested pairs remain ("US" in "US Military") and are
// listed for a later ruling; each half is separately certified and each keeps its own box.
//
// NO NAME is John McCain. Q's codename for the Senator and the Senator himself sat as separate
// entities - the archive listed them as different people. NO NAME (16) and No Name (8) merge
// into John McCain (10 -> 34); No Name Institute into McCain Institute. Two merge bugs surfaced
// doing it: a null alias count silently dropped 24 mentions, and the "already covered by a
// recount" test was asked AFTER the merge had inserted the alias, so it always said yes and the
// occurrences were counted but never emitted.
//
// "H" in #1589 is Hillary Clinton - that ONE occurrence, at the owner's ~90% confidence and
// recorded as contextual, not decoded. The drop's chain "LL to H" is read against its own next
// line, "LL IS KEY TO CONNECTING TO WH / HRC/BC/JC/SP/EH". Scoped by line/char: a standalone H
// elsewhere is not Hillary, and WH and /EH in this same drop are untouched.
//
// mentions 9,760 -> 9,786. entities 1,448 -> 1,445.
// 75: sentence-level Predictions audit — 630 -> 595 predictions, 4,242 -> 4,221 claims, and a
// NEW postAnalysis.predictionSentences array carrying the complete-sentence reading of 224
// telegraphic rows. Returning readers must re-seed or they keep the fragments and the old counts.
// 76: Entities/Brackets hover audit, Stage 1. The section was listing 8 entities TWICE — "Bill
// Clinton" with 31 mentions and again with 7 — because the core-registry and adjudicated-tail
// populations each carried a row for them, and 10 more groups differed only in spelling
// (Wikileaks/WikiLeaks, LORD/Lord, FAKE NEWS MEDIA/Fake News Media). 36 rows merged into 17.
// 85 types corrected, most of them a specific place or outlet mistyped as a person (Utah,
// Hollywood, Hawaii, Guardian). 18 rows withdrawn as conceptual or generic wordings.
//   entities 1,445 -> 1,408   mentions 9,786 -> 9,747
// Every entity now also carries an immutable id and a slug. THIS is why the seed must move:
// posts.json lost 39 namedEntities entries and entities.json gained two fields on every row, so
// a returning reader holding the seed-75 copy would keep highlighting words that are no longer
// entities and would have no id to key a tooltip by.
// 77: Stage 2 — entity hover synopses, and the Black Lives Matter type correction.
// entities.json is SEEDED, so a returning reader holding the seed-76 copy would keep BLM typed
// as a person however many times the tooltip said otherwise, and would see the corrected wording
// beside the stale category. entity-hovers.json is fetched rather than seeded and needs no bump
// of its own; this one is required by the entity row that changed underneath it.
// ── Cloud-overlay provenance ─────────────────────────────────────────────────
//
// The newest Firestore edit the last export already consumed and baked into public/data. An edit
// at or before this instant is ALREADY IN THE BUNDLE — and then repaired by the apply chain, which
// the browser cannot re-run — so laying it back over the seeded data can only subtract. Only an
// edit written AFTER this carries anything the bundle lacks.
//
// Measured 2026-08-21 across postEdits (1,355 docs) and questionEdits (153 docs). Not a wall clock
// and not a guess: it is the maximum `_updatedAt` / `_fieldUpdatedAt` in those collections, so the
// same Firestore state always yields the same number.
//
// scripts/export-firestore.mjs RECOMPUTES this on every export and ABORTS if the constant no longer
// covers what it consumed, naming the value to set. That is why it cannot silently drift: the check
// sits in the deploy path, not in anyone's memory.
export const OVERRIDES_BAKED_THROUGH = 1786458148021   // 2026-08-11T14:22:28.021Z

// One-time recovery for browsers that already cached the damage.
//
// The broken overlay did not merely display stale analysis, it PERSISTED it — applyCloudOverrides
// ended with idbSet('posts', ...). A returning profile therefore holds a poisoned `posts`
// collection stamped with a seed version that matches, so the seed check short-circuits and the
// bundle is never re-read. Filtering Firestore fixes new loads and does nothing for those caches.
//
// Bumping SEED_VERSION would also clear it, but it would say something untrue — the seeded data did
// not change, the client's copy of it was corrupted — and it would drag the seed fingerprint and
// every returning-reader gate along with a repair that is not about the bundle at all. This marker
// is the narrow version: it invalidates the cache exactly once, on the exact defect, and any future
// overlay defect bumps it again without touching the seed.
export const OVERLAY_REPAIR = 1

// 88: THE STEP 3B RECONCILIATION. Owner Ruling 3's 29 reviewed occurrence withdrawals, all 159
//     lane-B human-semantic reviews, and the duplicate-record reconciliation that brought the
//     entity registry down to the records it describes. Claims 8,912 -> 8,676, questions 6,323 ->
//     6,321, entities 1,235 -> 1,214 rows and 8,975 -> 8,821 mentions. A returning reader holding
//     87 would keep the pre-review paint on 41 drops and a registry counting one written word up
//     to five times, so the seed has to move.
export const SEED_VERSION = 98   // 98: "Vault 7" is an Entity on #836 — the WikiLeaks release Q
                                 //     asks about in "Who leaked Vault7 to WL?". A corpus sweep
                                 //     returns exactly one occurrence, so "throughout all the post"
                                 //     and this one drop are the same ruling.
                                 // 97: #2347's directive is the WHOLE "(((WWG1WGA)))", brackets
                                 //     included — "it bothers me that (((WWG1WGA))) isn't all a
                                 //     directive". A reader on 96 keeps a green word inside grey
                                 //     brackets.
                                 // 96: THE POST-SCOPED ENTITY RULINGS, 2026-08-24. #300 "L.",
                                 //     #836 "OP Name: Fiddler", six on #1319, "45" on #1565, "F-15"
                                 //     on #2734 and the three initials on #3383. Four are span
                                 //     EXTENSIONS — the short form goes and the whole name Q wrote
                                 //     paints instead — so a reader on 95 keeps "Waters" where it
                                 //     should read "M. Waters".
                                 // 95: NCSWIC, RED OCTOBER AND DELTA ARE PREDICTIONS, 2026-08-24.
                                 //     15 lines arrive in Predictions — 10 from Claims, 5 from no
                                 //     section — and TWO are refused: NCSWIC inside a CISA URL, and
                                 //     #1176's "Delta engine fire?", which is Delta AIRLINES. A
                                 //     reader on 94 keeps ten amber lines that should be violet.
                                 // 94: THE OWNER'S SECTION MOVES, 2026-08-24. #1443's "#2." moves
                                 //     from Directives to Claims; the 13 retiring-members list rows
                                 //     on #1850 leave Claims for the Entities they already are; and
                                 //     #4784's opening line becomes a Claim. A reader on 93 keeps
                                 //     "#2." green, thirteen amber list rows and no amber on #4784.
                                 // 93: THE SAME BATCH, RE-STAMPED. 92 was recorded and then posts.json
                                 //     CHANGED AGAIN inside it — the #2347 Q entities landed after the
                                 //     bump, and seed-fingerprint.json was re-recorded at 92 rather
                                 //     than bumped. A browser that had loaded 92 in that window kept a
                                 //     #2347 with no entity on either Q, which is exactly what the
                                 //     owner was looking at. The fingerprint guard is only as good as
                                 //     the choice to BUMP rather than re-record.
                                 // 92: THE #2347 CARD AND #1443, 2026-08-24. Both body Qs on #2347
                                 //     are Entities (the sign-off is not); WWG1WGA is a Directive on
                                 //     the five drops where it was not already one — 171 of the 178
                                 //     already were; #1443's "Texts" is a Claim and its
                                 //     "DECLAS_Public[3]" goes back to Predictions, correcting the
                                 //     reading taken from the sheet earlier the same day. A reader on
                                 //     91 keeps #2347 with no entity on either Q and no green on
                                 //     WWG1WGA, and #1443 amber where it should be violet.
                                 // 91: THE UPDATED-REPORT RULINGS, 2026-08-24. Seven sentences the
                                 //     splitter had cut at an abbreviation are certified WHOLE as
                                 //     Questions (#1944 #2211 #4782 #4888 #3049 #1915 #4871), #1443's
                                 //     "DECLAS_Public[3]" moves from Predictions to Claims, and
                                 //     #4891's "Why would H." — the head of a certified Question — is
                                 //     withdrawn from Claims. posts.json, questions.json,
                                 //     entity-hovers.json, relationships.json and search-index.json all
                                 //     move. A returning reader on 90 would keep seven blue fragments
                                 //     where the whole sentence is now the question, an amber fragment
                                 //     inside #4891's question, and violet on #1443.
                                 // 90: ROUND 2 of the unhighlighted-queue review — 2,799 owner rulings
                                 //     across Claims, Directives, Entities, Predictions, Brackets,
                                 //     Questions and the URL layer, plus 238 lines sent to the
                                 //     Resolution Center. posts.json, questions.json, entities.json and
                                 //     codes.json all move; a returning reader on 89 would keep the old
                                 //     paint on 3,223 drops and a registry 309 identities short.
                                 // 89: the verse-block ruling — a quoted passage of scripture is ONE
                                 //     Directive over the whole passage, and the reference label beside it
                                 //     is an Entity. posts.json and entities.json both move, so a returning
                                 //     reader must re-seed or keep 66 fragment highlights that no longer exist.
                                 // 87: Emphasis, Q Conclusions and Checkable Claims retired — data, highlights and sections
// (6 mentions, and she gains both drops), her hover gains a real synopsis instead of the generated
// "appears 8 times across 7 posts" line, and MOVIE 1 / MOVIE 3 join MOVIE 2 as Predictions. A
// reader on 84 sees NO unhighlighted and two of the three MOVIE lines unclassified.
// 84: the abbreviation/sentence-boundary repair, 2026-08-21 —
// 114 certified spans across Claims, Context, Directives and Questions were cut short at "Mr.",
// "Lt. Gen.", "U.S. Senate", "Harris v."; each is extended to the full sentence and the 45 tails
// the same splitter certified separately are absorbed. A reader on 83 keeps "Goodbye, Mr." and
// "Welcome Mr." painted as whole classified spans.
// 83: the 2026-08-21 ruling batch — 5 Claims (#4861, #4893 x2,
// #4853 x2), 1 Prediction (#4910), and 10 certified questions repaired from a splitter that read an
// INITIAL as a sentence end ("H. Biden", "A. Merkel", "N. Korea", "U.S. Supreme Court"), with the 8
// orphaned tail fragments absorbed. A reader on 82 sees the truncated questions and none of the new
// classifications.
// 82: dead-drop recovery, 2026-08-21 — 41 drops whose >> pointer was
// stored HTML-encoded were never scraped, so their quoted post was missing. 12 of the 15 drops that
// rendered as nothing but a bare pointer now carry their quoted content (#4862 and 11 others); the
// remaining 3 are dead at the source. quotedPosts changed on 1,505 drops and feeds SEARCH, so a
// reader on 81 keeps the blank rows and the narrower index.
// 81: owner ruling 2026-08-21 — #4923 "Dearest Virginia -" moves
// Context -> Claim (Claims 8,928->8,929, Context 1,736->1,735). Context does not paint, so on 80 a
// reader sees an unhighlighted opening line above five classified ones on that drop.
// 80: the unhighlighted-sentence queue, ruled 2026-08-20 — 6,108 of the
// 6,111 queued sentences accepted into a section. Claims 4,212->8,928, Directives 2,552->3,037,
// Predictions 595->842, Questions 6,454->6,519, Entities 1,201->1,240 rows / 8,798->8,969 mentions,
// Codes 1,949->1,957, Emphasis 3,111->3,105, Context 4,829->1,748. A reader on 79 would keep seeing
// four thousand sentences rendered as plain unclassified text on both the drop page and the archive.
// 79: owner question rulings, 2026-08-19 — 11 interrogative units moved
// into Questions from Claims/Evidence (6,443->6,454), 9 withdrawn from Claims (4,221->4,212), and #2420's
// parallel-phrasing Emphasis retired by the standing 'a question carries no Emphasis' rule (3,112->3,111).
// A reader on 78 would keep seeing those eleven sentences painted amber instead of blue.
// 78: integrated entity cleanup — entities.json 1,409->1,201 rows / 9,749->8,798 mentions and posts.json namedEntities lost 951 entries, so a reader on 77 would keep seeing URL slugs and 'God' inside 'Godfather' painted as entities
// 77: 72: Q Directives on sourceSpansV2 — 2,552 occurrences, directiveMeta spans
// 71: 4: final certified questions — 6,442 occurrences, exact source spans

// ── Minimal IndexedDB key/value wrapper (one record per collection) ──────────
const DB_NAME = 'q-archive'
const STORE = 'collections'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Exposed so derived indexes (e.g. the analysis frequency) can be cached across sessions. */
export async function idbGetRaw<T>(key: string): Promise<T | undefined> { return idbGet<T>(key) }
export async function idbSetRaw(key: string, value: unknown): Promise<void> { return idbSet(key, value) }

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function fetchBundle<T>(name: string): Promise<T[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`)
  if (!res.ok) throw new Error(`Failed to load data bundle ${name}.json (${res.status})`)
  return res.json() as Promise<T[]>
}

function buildIndexes(store: Omit<LocalStore, 'postsById' | 'postsByNum'>): LocalStore {
  store.posts.sort((a, b) => a.postNum - b.postNum)
  return {
    ...store,
    postsById: new Map(store.posts.map(p => [p.id, p])),
    postsByNum: new Map(store.posts.map(p => [p.postNum, p])),
  }
}

let storePromise: Promise<LocalStore> | null = null
let cache: LocalStore | null = null

// Loads (and caches) the archive. On first ever run, seeds IndexedDB from the JSON bundle;
// afterwards reads straight from IndexedDB so local edits persist across restarts.
// Remove spurious duplicate questions while KEEPING genuine repeats: for each post+question,
// keep at most as many entries as the question actually appears in that post's body.
function dedupeQuestions(qs: QQuestion[], posts: QPost[]): QQuestion[] {
  const norm = (t: string) => (t ?? '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
  const bodyById = new Map<string, string>()
  const bodyByNum = new Map<number, string>()
  for (const p of posts) {
    const b = (p.text ?? '').toLowerCase().replace(/\s+/g, ' ')
    bodyById.set(p.id, b); bodyByNum.set(p.postNum, b)
  }
  const allowed = new Map<string, number>()  // how many entries are legitimate per key
  const kept = new Map<string, number>()
  const out: QQuestion[] = []
  for (const q of qs) {
    const key = `${q.postId ?? q.postNum}|${norm(q.text)}`
    if (!allowed.has(key)) {
      const body = bodyById.get(q.postId) ?? bodyByNum.get(q.postNum) ?? ''
      const needle = norm(q.text)
      let occ = 0, idx = 0
      if (needle) { while ((idx = body.indexOf(needle, idx)) !== -1) { occ++; idx += needle.length } }
      allowed.set(key, Math.max(1, occ))  // genuine N-times → keep N; otherwise keep 1
    }
    const k = kept.get(key) ?? 0
    if (k < allowed.get(key)!) { out.push(q); kept.set(key, k + 1) }
  }
  return out
}

/**
 * Strip the board's own markup out of post text.
 *
 * 8chan renders `//text//` as italics, so every `https://` in a drop was stored as
 * `https:<em>//</em>example.com` — literal tags, in 1,448 posts (2,054 pairs), plus a few
 * <u>/<span>/<p>. They are in qalerts' data too, so this is the SOURCE's markup, not a bug
 * in our ingest — but it splits every URL in half, which is why the Twitter links in #2880
 * were not clickable and why "twitter" highlighted separately from ".com/…".
 *
 * Done here rather than in posts.json so the bundle stays byte-identical to the source and
 * the qalerts audit keeps passing. Applied to quoted posts and stored analysis items too,
 * or a claim carrying a tag would stop matching the text it came from.
 */
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
// HTML entities were stored raw as well: 607 "&gt;", 561 "&amp;", 26 "&lt;" across 575 posts.
// "&amp;" is what Q typed as "&", so leaving it makes the text wrong and unsearchable.
// "&gt;" is decoded LAST, so a decoded ">" can never be re-read as markup.
const ENTITIES: [RegExp, string][] = [
  [/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"],
  [/&lt;/gi, '<'], [/&gt;/gi, '>'],
]

function stripBoardMarkup(posts: QPost[]): void {
  const clean = (t: string) => {
    if (!t) return t
    let out = t.includes('<') ? t.replace(MARKUP, '') : t
    if (out.includes('&')) for (const [rx, ch] of ENTITIES) out = out.replace(rx, ch)
    return out
  }
  const cleanArr = (arr?: string[]) => Array.isArray(arr) ? arr.map(clean) : arr
  const cats = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks']
  for (const p of posts) {
    if (p.text) p.text = clean(p.text)
    const a = p.postAnalysis as Record<string, unknown> | undefined
    if (a) for (const c of cats) { if (Array.isArray(a[c])) a[c] = cleanArr(a[c] as string[]) }
    p.actionRequests = cleanArr(p.actionRequests)
    p.customBrackets = cleanArr(p.customBrackets)
    if (p.quotedPosts) for (const q of p.quotedPosts) { if (q.text) q.text = clean(q.text) }
  }
}

// Remove exact within-post duplicate items from a post's analysis/request/bracket arrays.
function dedupePostArrays(posts: QPost[]): void {
  const norm = (t: string) => (t ?? '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
  const dd = (arr: string[]) => {
    const seen = new Set<string>(); const out: string[] = []
    for (const it of arr) { const k = norm(it); if (seen.has(k)) continue; seen.add(k); out.push(it) }
    return out.length === arr.length ? arr : out
  }
  const cats = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks']
  for (const p of posts) {
    const a = p.postAnalysis as Record<string, unknown> | undefined
    if (a) for (const c of cats) { if (Array.isArray(a[c])) a[c] = dd(a[c] as string[]) }
    if (Array.isArray(p.actionRequests)) p.actionRequests = dd(p.actionRequests)
    if (Array.isArray(p.customBrackets)) p.customBrackets = dd(p.customBrackets)
  }
}

export function loadLocalData(): Promise<LocalStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const seeded = await idbGet<number>('__seed_version__').catch(() => undefined)
      const repaired = await idbGet<number>('__overlay_repair__').catch(() => undefined)

      let raw: Omit<LocalStore, 'postsById' | 'postsByNum'>
      // A cache is only usable if it is BOTH the current seed and past the overlay repair. See
      // OVERLAY_REPAIR: the cached `posts` collection may hold analysis the old overlay destroyed.
      if (seeded === SEED_VERSION && repaired === OVERLAY_REPAIR) {
        const [posts, questions, topics, resources, analysisConfirmed, infographs] = await Promise.all(
          COLLECTIONS.map(c => idbGet<unknown[]>(c).then(v => v ?? []))
        )
        raw = { posts, questions, topics, resources, analysisConfirmed, infographs } as typeof raw
      } else {
        const [posts, questions, topics, resources, analysisConfirmed, infographs] = await Promise.all([
          fetchBundle<QPost>('posts'),
          fetchBundle<QQuestion>('questions'),
          fetchBundle<QTopic>('topics'),
          fetchBundle<QResource>('resources'),
          fetchBundle<AnalysisConfirmedDoc>('analysisConfirmed'),
          fetchBundle<InfographDoc>('infographs'),
        ])
        raw = { posts, questions, topics, resources, analysisConfirmed, infographs }
        // Seed IndexedDB so subsequent runs (and edits) read from local storage.
        try {
          await Promise.all(COLLECTIONS.map(c => idbSet(c, (raw as Record<string, unknown>)[c])))
          await idbSet('__seed_version__', SEED_VERSION)
          await idbSet('__overlay_repair__', OVERLAY_REPAIR)
        } catch { /* private-mode / quota — fall back to in-memory only */ }
      }

      // Drop spurious duplicate questions (keeps genuine in-body repeats) so counts are
      // accurate. Idempotent — safe to run every load.
      raw.questions = dedupeQuestions(raw.questions as QQuestion[], raw.posts as QPost[])
      stripBoardMarkup(raw.posts as QPost[])
      for (const q of raw.questions as QQuestion[]) if (q.text) q.text = q.text.replace(MARKUP, '')
      dedupePostArrays(raw.posts as QPost[])

      cache = buildIndexes(raw)
      // Where every ">>NNNNNNN" pointer goes. Built once here, not per render — resolving a
      // pointer sits on the render path of every drop body. See src/lib/refIndex.ts.
      buildRefIndex(raw.posts as QPost[])
      // Overlay cross-device edits from the cloud — DESKTOP/DEV ONLY.
      //
      // fetchOverrides() reads two whole collections, and Firestore bills one read per
      // DOCUMENT returned, so every public visitor would cost (postEdits + questionEdits)
      // reads. Measured Aug 2026: the free-tier quota was already exhausted by developer
      // use alone. The public bundle ships those edits baked in by
      // scripts/export-firestore.mjs instead, so it needs no reads at all and scales
      // without limit.
      if (!IS_PUBLIC_SITE) {
        await applyCloudOverrides(cache)
        // Editorial only, and deliberately on `window`: the browser gate has to be able to ASK what
        // the overlay did. A gate that can only see the rendered page cannot tell "the overlay
        // correctly applied nothing" from "the overlay never ran".
        const r = getOverlayReport()
        if (r) {
          ;(globalThis as unknown as Record<string, unknown>).__qOverlayReport = r
          console.info(`[overlay] ${r.docsApplied}/${r.docs} docs applied · ${r.fieldsApplied} fields applied · ${r.fieldsSkipped} skipped as not newer than the bundle`)
        }
      }
      return cache
    })()
  }
  return storePromise
}

// Pull edits from Firestore and apply them on top of the local store, then persist so the
// overlaid data survives the next offline launch. Failures are silent (stays local-only).
/** What the last overlay actually did. Read by the browser gate and logged in dev — see the note
 *  at `overlayReport =` below on why this is counted rather than assumed. */
export interface OverlayReport { docs: number; docsApplied: number; fieldsApplied: number; fieldsSkipped: number }
let overlayReport: OverlayReport | null = null
export function getOverlayReport(): OverlayReport | null { return overlayReport }

async function applyCloudOverrides(store: LocalStore): Promise<void> {
  const ov = await fetchOverrides().catch(() => null)
  if (!ov) return
  let postsTouched = false
  let questionsTouched = false

  // PROVENANCE, NOT Object.assign.
  //
  // This was `Object.assign(p, fields)`, which replaces `postAnalysis` WHOLESALE with Firestore's
  // copy. That copy is months old: measured 2026-08-21, all 1,348 docs carrying a postAnalysis
  // differed from the bundle, none had claimSpans at all, and the newest edit in the collection
  // predates the queue ruling by ten days. It erased 1,208 claims, 62 predictions and 930 entity
  // mentions across 244 posts — on the editorial surface, the one the owner reviews on.
  //
  // The export path performs the same bake and then re-runs the apply chain, which rebuilds every
  // certified section on top. There is no apply chain in a browser, so the overlay has to decline
  // the stale field instead of repairing it afterwards. See src/lib/overrideProvenance.ts.
  let fieldsApplied = 0, fieldsSkipped = 0, docsApplied = 0
  for (const [postId, fields] of Object.entries(ov.posts)) {
    const p = store.postsById.get(postId)
    if (!p) continue
    const { apply, applied, skipped } = selectOverrideFields(
      fields as Record<string, unknown>, ov.postMeta?.[postId], OVERRIDES_BAKED_THROUGH,
    )
    fieldsSkipped += skipped.length
    if (applied.length === 0) continue
    fieldsApplied += applied.length
    docsApplied++
    Object.assign(p, apply)
    postsTouched = true
  }
  // Counted rather than assumed. A run that silently applied nothing and a run that silently
  // applied everything look identical from the outside, and this defect lived for months inside
  // exactly that silence.
  overlayReport = { docs: Object.keys(ov.posts).length, docsApplied, fieldsApplied, fieldsSkipped }

  for (const qe of ov.questions) {
    if (qe.deleted) {
      const before = store.questions.length
      store.questions = store.questions.filter(q => q.id !== qe.id)
      if (store.questions.length !== before) questionsTouched = true
    } else {
      const { deleted: _d, ...qdata } = qe
      const idx = store.questions.findIndex(q => q.id === qe.id)
      if (idx >= 0) store.questions[idx] = qdata as QQuestion
      else store.questions.push(qdata as QQuestion)
      questionsTouched = true
    }
  }

  // Keep hasQuestions consistent with the synced question set.
  if (questionsTouched) {
    const withQ = new Set(store.questions.map(q => q.postId))
    for (const p of store.posts) {
      const has = withQ.has(p.id)
      if (!!p.hasQuestions !== has) { p.hasQuestions = has; postsTouched = true }
    }
    try { await idbSet('questions', store.questions) } catch { /* best-effort */ }
  }
  if (postsTouched) { try { await idbSet('posts', store.posts) } catch { /* best-effort */ } }
}

// ── Writes ───────────────────────────────────────────────────────────────────
// Debounced persistence of changed collections back to IndexedDB.
const dirty = new Set<CollectionName>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(async () => {
    flushTimer = null
    if (!cache || dirty.size === 0) return
    const cols = [...dirty]
    dirty.clear()
    try {
      await Promise.all(cols.map(c => idbSet(c, (cache as unknown as Record<string, unknown[]>)[c])))
    } catch { /* persistence best-effort; in-memory store is still correct this session */ }
  }, 400)
}

// Apply a synchronous mutation to the in-memory store, mark the touched collections dirty,
// and schedule a persist. Returns the result of `fn`.
// Anything that derives an expensive cache from the store registers here so a write can
// drop it. Without this, caching derived data silently serves stale results after an edit.
const invalidators = new Set<() => void>()
export function onStoreMutated(fn: () => void): () => void {
  invalidators.add(fn)
  return () => { invalidators.delete(fn) }
}

export async function mutateStore<T>(
  collections: CollectionName | CollectionName[],
  fn: (store: LocalStore) => T,
): Promise<T> {
  const store = await loadLocalData()
  const result = fn(store)
  for (const c of Array.isArray(collections) ? collections : [collections]) dirty.add(c)
  // Keep post indexes consistent if the posts array identity/order changed.
  if (dirty.has('posts')) {
    store.posts.sort((a, b) => a.postNum - b.postNum)
    store.postsById.clear(); store.postsByNum.clear()
    for (const p of store.posts) { store.postsById.set(p.id, p); store.postsByNum.set(p.postNum, p) }
  }
  invalidators.forEach(fn => fn())
  scheduleFlush()
  return result
}
