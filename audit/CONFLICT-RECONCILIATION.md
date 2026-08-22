# Final conflict state

Rebuilt from canonical state. **50 rows survive**, and every one carries an explicit reviewed disposition.

| | |
|---|---:|
| total conflict rows | 50 |
| **actionable unresolved** | **0** |
| intentionally unresolved (F) | 11 |
| quarantined / non-actionable | 3 |
| reviewed and deliberately kept | 36 |
| affected posts | 41 |
| rows reviewed across all families | 179 |

## By reason

| reason | rows |
|---|---:|
| BOUNDARY_CROSSING | 37 |
| UNLOCATED_SPAN | 13 |

## By source layer

| layer | rows |
|---|---:|
| claims | 29 |
| namedEntities | 13 |
| directives | 4 |
| questions | 3 |
| themeAnchors | 1 |

## Every surviving row

| post | layer | subtype | disposition | why it remains |
|---|---|---|---|---|
| #23 | claims | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | one claim: an observation and the inference it carries, the second unreadable without the first |
| #25 | claims | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | already reviewed in family 1 — the repaired span intentionally covers Q's two-sentence commentary |
| #48 | namedEntities | CASE_VARIANT_REFUSED_D_MID_WORD_OR_FALSE_POSITIVE | F INTENTIONALLY_UNRESOLVED | The drop writes 'Why is the Canadian PM so important?' — the ADJECTIVE, never the country's name. Whether an adjectival form counts as naming the identity is a policy question for the whole archive, not for one row: settling it here would silently decide 'Russian', 'German', 'Iranian' and 'Chinese'  |
| #64 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one sentence: vocative address plus the statement it introduces |
| #154 | directives | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one petition of a recited prayer, set across two lines |
| #154 | directives | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one unit of a recited prayer, set across two lines |
| #154 | directives | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one sentence, hard-wrapped |
| #154 | themeAnchors | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | a passage-level theme anchor over five lines of one recited prayer |
| #466 | questions | QUESTION_LITERAL_SPANS_SENTENCES | A KEEP_AS_CERTIFIED | one question, hard-wrapped mid-phrase |
| #526 | claims | WITHIN_LINE_CROSSING | B REPAIR_GEOMETRY | The segmenter ends a sentence at '(b.', so 'His father is Edward Mezvinsky (b. 1937), who embezzled … guilty of fraud in 2001.' was certified as a stub stopping at the birth year. Widened to the whole sentence. No sentence id could express this: the sentence boundary is itself what is wrong. Same de |
| #526 | claims | WITHIN_LINE_CROSSING | B REPAIR_GEOMETRY | The same '(b.' split one sentence later, for the mother. Widened to the whole sentence and the orphaned tail withdrawn. |
| #770 | claims | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | one list entry, name plus fate |
| #770 | claims | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | one list entry, name plus fate |
| #859 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one sentence, split mid-word by a board artifact in the source text |
| #909 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | 'We are working to END.' / 'EVIL.' is one sentence Q split for emphasis. This wide record is the complete unit; the narrower record nested inside it covers only the first half and is the defect. |
| #1012 | claims | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | one complete quoted tweet, two sentences |
| #1015 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one claim, deliberately spanning the two lines Q broke it across |
| #1094 | namedEntities | ABSENT_FROM_DROP_IN_EVERY_REGISTERED_FORM | F INTENTIONALLY_UNRESOLVED | One of the nine F rows of the Owner Ruling 3 population. Only 'Senate' appears, and that spelling is already a registered form of 'United States Senate', so registering it here would make one token name two identities — invariant 4 in a new costume. The owner ruled on 2026-08-22: do not touch the 9  |
| #1098 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one claim across the two lines Q broke it across |
| #1192 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one claim over the two lines of a two-line announcement |
| #1359 | namedEntities | CASE_VARIANT_REFUSED_D_MID_WORD_OR_FALSE_POSITIVE | F INTENTIONALLY_UNRESOLVED | The drop writes 'Total S.A. is a French multinational integrated oil and gas company' — again the adjective, and here describing a company's nationality rather than an act of the state. Same open question as #48 and it must get the same answer. |
| #2061 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one claim, continued across the line break Q wrote it with |
| #2061 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one claim, continued across the line break Q wrote it with |
| #2177 | claims | MULTI_LINE_SPAN | B REPAIR_GEOMETRY | Item (4) of the pasted prohibition is already its own claim at 456..579, and this record covers it truncated by one character. Re-spanned to the lead-in plus items (1) to (3), so the enumeration is covered once and item (4) keeps its own record. |
| #2335 | namedEntities | NO_ALIAS_EVER_REGISTERED | F INTENTIONALLY_UNRESOLVED | Owner Ruling 3 F row — left explicitly unresolved by the owner's direction of 2026-08-22. |
| #2692 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one enumeration segment, three list items |
| #2692 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one enumeration segment, three list items |
| #2692 | claims | MULTI_LINE_SPAN | B REPAIR_GEOMETRY | The span starts mid-item, at 'Priestap' rather than at 'Then-Assistant Director of Counterintelligence E.W. Priestap' — the segmenter split the line at 'E.W.'. Extended to the whole of the item it half-covers, so the enumeration is not cut through a person's title. |
| #2768 | namedEntities | NO_ALIAS_EVER_REGISTERED | F INTENTIONALLY_UNRESOLVED | Owner Ruling 3 F row — left explicitly unresolved by the owner's direction of 2026-08-22. |
| #2912 | claims | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | one complete quoted tweet, three sentences |
| #2943 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one complete pasted enumeration, three clauses |
| #2955 | namedEntities | CASE_VARIANT_NOT_REGISTERED | QUARANTINED INTENTIONALLY_NON_ACTIONABLE | INTENTIONALLY_NON_ACTIONABLE |
| #3159 | namedEntities | NO_ALIAS_EVER_REGISTERED | F INTENTIONALLY_UNRESOLVED | Owner Ruling 3 F row — left explicitly unresolved by the owner's direction of 2026-08-22. A first pass proposed 'Paris' as an alias; a fragment must be at least 60% of the canonical AND unclaimed, and this is neither. |
| #3656 | directives | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one complete quoted passage, two sentences |
| #3690 | namedEntities | CASE_VARIANT_NOT_REGISTERED | QUARANTINED INTENTIONALLY_NON_ACTIONABLE | INTENTIONALLY_NON_ACTIONABLE |
| #3990 | questions | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | one compound query; the second '?' closes a bracketed qualifier |
| #4008 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one sentence, hard-wrapped mid-clause by the board |
| #4247 | namedEntities | NO_ALIAS_EVER_REGISTERED | F INTENTIONALLY_UNRESOLVED | Owner Ruling 3 F row — left explicitly unresolved by the owner's direction of 2026-08-22. |
| #4255 | claims | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | one slogan, punctuated word by word |
| #4437 | claims | CONTAINS_URL | QUARANTINED INTENTIONALLY_NON_ACTIONABLE | INTENTIONALLY_NON_ACTIONABLE |
| #4468 | namedEntities | NO_ALIAS_EVER_REGISTERED | F INTENTIONALLY_UNRESOLVED | Owner Ruling 3 F row — left explicitly unresolved by the owner's direction of 2026-08-22. |
| #4494 | questions | WITHIN_LINE_CROSSING | A KEEP_AS_CERTIFIED | one question; the trailing bracketed fragment extends it rather than starting a new one |
| #4521 | namedEntities | NO_ALIAS_EVER_REGISTERED | F INTENTIONALLY_UNRESOLVED | Owner Ruling 3 F row — left explicitly unresolved by the owner's direction of 2026-08-22. |
| #4526 | namedEntities | NO_ALIAS_EVER_REGISTERED | F INTENTIONALLY_UNRESOLVED | Owner Ruling 3 F row — left explicitly unresolved by the owner's direction of 2026-08-22. |
| #4555 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one sentence, hard-wrapped mid-list |
| #4603 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one pasted dictionary entry, headword plus gloss |
| #4630 | namedEntities | NO_ALIAS_EVER_REGISTERED | F INTENTIONALLY_UNRESOLVED | Owner Ruling 3 F row — left explicitly unresolved by the owner's direction of 2026-08-22. |
| #4656 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one pasted dictionary sense, label plus gloss |
| #4656 | claims | MULTI_LINE_SPAN | A KEEP_AS_CERTIFIED | one pasted dictionary sense, headword plus label plus gloss |
| #4935 | claims | MULTI_LINE_SPAN | B REPAIR_GEOMETRY | The span stops at 'former Virginia Gov.' — the segmenter ended a sentence at the abbreviation 'Gov.', so the record cuts off in the middle of Terry McCauliffe's title and never reaches his name. Extended to the whole of the second line. Same defect class as audit/abbreviation-span-repairs.json. |
