# Q Drops — whole-app cross-section integrity audit

One question: does every certified occurrence in every section still resolve to the correct Q-authored source, carry the right provenance, overlap only where intended, and reach both first-time and returning users?


This audit validates the certified system. It reclassifies nothing and moves no count. All eight analytical sections remain frozen.


**185 of 222 invariants pass.**


## 1. Frozen canonical counts

| | Invariant | Observed |
|---|---|---|
| ✅ | posts = 4,966 | 4966 |
| ❌ | Questions = 6,454 certified occurrences | 6503 |
| ✅ | Directives = 2,552 | 2940 |
| ❌ | Claims = 4,189 | 8711 |
| ✅ | Predictions = 630 | 843 |
| ✅ | Evidence = 6,590 | 6590 |
| ✅ | Entities = 1,335 canonical | 1214 |
| ✅ | Entities = 7,903 resolved mentions (headline) | 8948 |
| ✅ | core registry submetric = 5,273 | 5336 |
| ❌ | adjudicated tail submetric = 3,476 | 2893 |
| ✅ | no scoped ruling drops a context-resolved occurrence | none |
| ✅ | every acronym-named entity has a definition or a stated reason | all defined |
| ✅ | submetrics sum to the headline | 5336 + 2893 + 719 = 8948 |
| ✅ | the artifact ships the headline figure | 8948 |
| ✅ | the headline states how it is composed | declared |
| ✅ | Themes = 2,393 assignments | 2644 |
| ✅ | Codes = 1,949 occurrences | 1957 |
| ✅ | Emphasis is retired: no artifact, no field, no occurrence | 0 posts still carry the field |
| ✅ | Resolution Center = 2,527 | 115 |
| ✅ | Resolution entity = 30 | 30 |
| ✅ | Resolution theme = 16 | 16 |
| ✅ | Resolution code = 28 | 28 |
| ✅ | Resolution classification = 31 | 31 |

## 2. Provenance contracts

| | Invariant | Observed |
|---|---|---|
| ❌ | Questions ships 6,457 rows for 6,323 certified | 6637 |
| ✅ | exactly 134 editorial-normalisation rows | 134 |
| ✅ | no editorial row carries an occurrences field | 0 counted |
| ✅ | counted + editorial = every shipped row | 6503 + 134 |
| ✅ | embedded-in-source URLs are labelled in the data | 20 labelled |
| ✅ | embedded-in-source URLs are excluded from the Q-citation figure | 2724 citations + 20 embedded of 6590 |
| ✅ | canonical and mentions are distinct metrics | 1214 vs 8948 |
| ✅ | unresolved aliases counted in neither metric | 1011 carried separately |
| ✅ | no code carries a meaning without stating its basis | 0 |
| ❌ | all ten sections declare a provenance contract | 9 |

## 3. Exact source resolution

| | Invariant | Observed |
|---|---|---|
| ✅ | every certified questions occurrence resolves to its drop | 0 unresolved |
| ✅ | every certified directives occurrence resolves to its drop | 0 unresolved |
| ✅ | every certified claims occurrence resolves to its drop | 0 unresolved |
| ✅ | every certified predictions occurrence resolves to its drop | 0 unresolved |
| ✅ | every certified emphasis occurrence resolves to its drop | 0 unresolved |
| ✅ | every certified codes occurrence resolves to its drop | 0 unresolved |
| ✅ | no editorial paraphrase is counted as a claim | 1156 paraphrases held aside, 0 leaked |

## 4. Cross-section overlap

| | Invariant | Observed |
|---|---|---|
| ❌ | Question ↔ Directive overlap = 228, declared | 173 |
| ✅ | Code ↔ Entity cross-links = 32, declared | 32 |
| ✅ | every repeated question in Emphasis exists in Questions | 0 repeated, 0 orphaned |
| ✅ | every repeated directive in Emphasis exists in Directives | 0 repeated, 0 orphaned |
| ❌ | conclusions are an attribute of 964 assertions, not a separate count | 0 |
| ✅ | every overlap pair has a written rule | 3 |

## 5. Double-count and collisions

| | Invariant | Observed |
|---|---|---|
| ✅ | no duplicate Question row id | 0 |
| ✅ | no duplicate Resolution Center id | 0 |
| ✅ | in-post repeats preserved ("Coincidence?" = 88 mentions across 86 posts) | 88 |
| ✅ | no assertion carries a contradictory family/class pair | 0 |

## 6. Source-material isolation

| | Invariant | Observed |
|---|---|---|
| ❌ | questions: quoted-block over-extension stays at its known 100 occurrences | 99 of 6503 (expected 100) |
| ❌ | directives: quoted-block over-extension stays at its known 129 occurrences | 128 of 2940 (expected 129) |
| ❌ | claims: quoted-block over-extension stays at its known 593 occurrences | 579 of 8711 (expected 593) |
| ✅ | emphasis: quoted-block over-extension stays at its known 0 occurrences | 0 of 0 (expected 0) |
| ❌ | the source-boundary occurrence SET is unchanged | +8 / -21 |
| ❌ | source-boundary debt stays at its known 235 posts | 234 posts |
| ✅ | the source-boundary risk is recorded as a prerequisite, not a footnote | highest |

## 7. Export-chain integrity

| | Invariant | Observed |
|---|---|---|
| ✅ | every apply step is chained into export | 26/26 |
| ❌ | apply order in export matches the declared order | out of order |
| ✅ | export-firestore.mjs runs the shared chain | ok |
| ✅ | rebuild-bundle.mjs runs the shared chain | ok |
| ✅ | every chained script exists on disk | ok |

## 8. Seed and cache integrity

| | Invariant | Observed |
|---|---|---|
| ❌ | SEED_VERSION is 85 (#1928/#1929 owner rulings) | 87 |
| ✅ | seeding is gated on SEED_VERSION | present |
| ✅ | seeded data matches the SEED_VERSION that shipped it | seeded data changed and SEED_VERSION moved 85 -> 87 [posts.json, questions.json, entities.json] |
| ✅ | the gate value is persisted after seeding | present |
| ✅ | service worker cache name is versioned | qdrops-v1 |
| ✅ | service worker does not pin /data to cache-only | data handled explicitly |
| ✅ | the deploy rewrites CACHE_VERSION on every publish | rewritten at build time |
| ✅ | the deploy blocks on certification-manifest --verify | armed |
| ✅ | activation deletes every cache from a previous version | present |

## 9. UI count integrity

| | Invariant | Observed |
|---|---|---|
| ❌ | sectionInfo states 6,323 | ok |
| ❌ | sectionInfo states 2,940 | ok |
| ❌ | sectionInfo states 8,721 | ok |
| ✅ | sectionInfo states 6,590 | ok |
| ❌ | sectionInfo headlines 1,214 entities and 8,948 mentions | ok |
| ✅ | no alias is stored all-lowercase | ok |
| ✅ | sectionInfo keeps 4,463 and 3,440 as provenance | ok |
| ✅ | sectionInfo states 2,644 | ok |
| ✅ | sectionInfo states 1,957 | ok |
| ❌ | sectionInfo carries no Emphasis section | ok |
| ❌ | Claims headline = certified 8,928 / 3,084 | ok |
| ❌ | Predictions headline = certified 842 / 673 | ok |
| ✅ | SECTION_TOTALS carries no Emphasis row | ok |
| ❌ | Entities headline = certified mentions / 2,115 posts | ok |
| ✅ | Themes headline = certified 2,644 assignments | ok |
| ✅ | the archive header reads SECTION_TOTALS rather than the frequency index | ok |
| ✅ | phrase rows still show how many posts contain the phrase | ok |
| ✅ | no UI file re-derives a certified category with its own regex | ok |

## 10. Resolution Center completeness

| | Invariant | Observed |
|---|---|---|
| ✅ | every row has a stable id | ok |
| ✅ | every row deep-links somewhere | ok |
| ✅ | every /post deep link resolves to a real post | 0 broken |
| ✅ | every row states where it came from | ok |
| ✅ | every row explains why it is unresolved | ok |
| ✅ | every row is OPEN or has an explicit status | ok |
| ✅ | the queue declares it does not affect certified data | true |
| ✅ | every row carries the date it entered the queue | 2 distinct dates |
| ✅ | no row is dated in the future or before the archive was built | ok |
| ✅ | every borderline Emphasis case is queued or owner-resolved | 31 queued + 214 resolved / 245 |
| ✅ | every quote-boundary line is queued or owner-resolved | 10 queued + 0 resolved / 10 |
| ✅ | the held mentions still reconcile to the certified gap | 18 held / 18 gap |
| ✅ | none of the held mentions is counted in Entities | 8948 |

## 10b. Entity hover publication

| | Invariant | Observed |
|---|---|---|
| ❌ | one global synopsis per live entity, less the 39 awaiting one | 1201 published + 39 pending |
| ❌ | no published synopsis points at an entity that is no longer live | 26 orphaned |
| ✅ | publish + review + no-anchor + quarantine + withdrawn = 7,778 | 3698 + 3992 + 36 + 15 + 37 = 7778 |
| ✅ | no held record is in the public bundle | 4080 held back |
| ✅ | the editorial queues are not under public/data | admin only |
| ✅ | no shared-alias occurrence is published | 422 held in review |
| ✅ | withdrawn records are history, not review | 37 |
| ❌ | every hover resolves to a live entity id | 846 entities |
| ✅ | hovers are keyed by qe- id, not by name | ok |
| ✅ | entity totals are unchanged by the import | 1214 entities / 8948 mentions |
| ✅ | every published synopsis carries its support grade | 0 ungraded |

## 10c. Integrated entity cleanup

| | Invariant | Observed |
|---|---|---|
| ✅ | every starting mention lands in exactly one bucket | 9749 of 9749 |
| ✅ | the provenance audit covers every certified occurrence | 9926 of 9926 |
| ❌ | the applied totals are exactly the ones that were proven | 1214 rows / 8948 mentions |
| ✅ | plan actions, reversal restores and the withdrawn total are one number | 951 actions / 951 restores / 951 withdrawn |
| ✅ | no certified occurrence is acted on twice | 951 distinct of 951 |
| ✅ | the plan carries no refusals | 0 |
| ✅ | no occurrence the reader can see is withdrawn | 0 acted on |
| ✅ | no URL-derived record has a public hover | 15 quarantined |
| ✅ | no withdrawn occurrence is still a certified annotation | 0 remaining |
| ✅ | every bound source resolves to a live entity | 0 dangling |
| ✅ | every unbound source still names who it is | 8 unbound |
| ✅ | the per-post, per-hostname and per-account indexes hold the same records | 373 records / 99 hostnames / 84 accounts |
| ✅ | publishers and accounts are separately keyed and separately labelled | 244 publisher / 129 social |
| ✅ | every dormant id is still held in the permanent ledger | 229 dormant, 0 unreserved |
| ✅ | no dormant identity is in the public entity bundle | 0 still public |
| ✅ | no dormant identity is indexed as an entity | 0 indexed |
| ❌ | no dormant identity carries a global synopsis or a hover | 21 |
| ✅ | every source-only identity keeps at least one linked drop | 136 rows |
| ✅ | a source-only identity has a sentence of its own, not a zero | described |
| ✅ | Sources is its own surface, not a filter on Entities | separate page |
| ✅ | a drop where the entity is visible never loses every occurrence | 0 over-reaching |
| ✅ | every ambiguous occurrence is retained unchanged | 72 ambiguous, 0 acted on |
| ✅ | no substring is auto-removed where other provenance exists | 98 removable of 98, 0 with other support |
| ✅ | every substring record carries the word that produced it | 98 documented |
| ✅ | every social-account reference migrates rather than being deleted | 129 references |
| ✅ | no social-account reference is counted as a prose mention | migrated out of the prose layer |
| ✅ | image-unconfirmed occurrences keep their certified mention | 41 held |
| ✅ | every one of them is in the private provenance queue | 41 queued |
| ✅ | a reclassified substring suspect still carries its evidence | 17 reclassified |
| ✅ | only the approved population is withdrawn | 78 approved, 7 held beyond it |
| ✅ | every withdrawal records its evidence search and reversal | 78 documented |
| ✅ | post text and media are untouched by a withdrawal | annotation only |
| ✅ | every withdrawal is in the reversal contract | 78 reversible |
| ✅ | every no-anchor record carries the classification, not a bare reason | 36 classified |
| ✅ | no no-anchor record is filed as a withdrawn entity occurrence | ruling honoured |
| ❌ | the provenance audit describes the state it was run against | 1448 rows / 9926 mentions |
| ✅ | image_provenance_confirmed is only claimed where something could confirm it | no OCR/annotation data in the corpus → 0 confirmed |
| ✅ | image-unconfirmed occurrences keep their certified mention | 41 held |
| ✅ | one shared implementation of rendered text and complete-token matching | renderedMatch.mjs |
| ✅ | no consumer keeps its own copy of the matching primitives | 7 consumers share it |
| ✅ | the two coordinate systems genuinely disagree, so this check can fail | raw 1430 links vs rendered 2666 — the gap this guard exists for |
| ✅ | the script definition still matches what the app strips at seed time | markup + entities |
| ✅ | the scripts use the renderer's word-boundary rule | lookaround, not \b |
| ❌ | the same inputs still produce the same audit, byte for byte | inputs moved |

## 10d. Public entity list reconciliation

| | Invariant | Observed |
|---|---|---|
| ✅ | entity-public-view.json ships | present |
| ✅ | public canonical identities = 1,201 | view 1214 / registry 1214 |
| ✅ | certified prose mentions = 8,798 | view 8948 / registry sum 8948 |
| ✅ | displayed breakdown adds exactly to the canonical total | 1078 named in Q’s prose + 136 linked as a source only = 1214 |
| ✅ | prose and source-only components share no identity | 1078 + 136, overlap 0 |
| ❌ | the 135 source-only identities are a labelled component | 136 rows / registry 136 |
| ✅ | every public row has a certified prose post or a linked-source post | all 1,201 |
| ✅ | every source-only row has at least one source record | 136/136 |
| ✅ | every source post chip is backed by a linked-source record | 347 bound pairs |
| ✅ | no source-only identity carries a prose mention | 0 violations |
| ❌ | the 208 dormant identities are reserved and never public | 229 reserved, 0 leaked |
| ✅ | no alias is published as its own row beside its canonical | none |
| ✅ | no occurrence is claimed by two identities | 9862 occurrences, 0 double-claimed |
| ✅ | per-post mention counts stay inside the identity that earned them | clean |
| ✅ | row count and identity count reconcile through the merge model | 1201 rows / 1214 identities / 23 in 10 merged rows |
| ✅ | a merged row is named by the identity with the most posts | 10 merged rows |
| ✅ | no merged row mixes prose and source-only identities | 10 merged rows checked |

## 11. Frozen-section mutation

| | Invariant | Observed |
|---|---|---|
| ❌ | no certified artifact CHANGED CONTENT since the manifest | posts.json, questions.json, entities.json, relationships.json, search-index.json, entity-hovers.json |
| ✅ | byte-level re-serialisation reported separately, not as drift | posts.json, questions.json, entities.json, relationships.json, search-index.json, entity-hovers.json re-serialised by the export chain |
| ✅ | every certified artifact is on disk | 10/10 |
| ✅ | the editorial write guard is a shared module | lib/certifiedWrite.mjs |
| ✅ | the guard has a negative test | test-certified-write-guard.mjs |
| ✅ | no editorial script carries its own allowlist | one copy in lib/ |
| ✅ | every editorial tool writes through the guard | ok |

## 12. Cross-section relationships

| | Invariant | Observed |
|---|---|---|
| ❌ | postAnalysis entries equal certified mentions | 8849 vs 8948 |
| ✅ | aliases carrying several canonicals are preserved | 32 aliases (e.g. SC) |
| ✅ | #1385 line 5 stays open though line 1 is ruled | open |
| ✅ | held reference rows are open and carry a note (30 after #2774 resolved DELTA-2774-1-16) | 30/31 |
| ✅ | 679 audit rows, unique, all adjudicated | 679 rows, 679 unique |
| ✅ | every relationship names its certified basis | 0 without |
| ✅ | the artifact declares it is derived, not inferred | true |
| ❌ | Question ↔ Directive edges = the certified 230 | 231 |
| ✅ | Entity ↔ Code edges come from the 32 stored cross-links | 32 |
| ❌ | Claim → Conclusion edges = the certified 964 | undefined |
| ❌ | Claim → Source provided edges = the certified 438 | 341 |
| ✅ | Prediction → assertion edges = the certified 843 | 843 |
| ✅ | every queue row has an edge to its occurrence | 115 |
| ✅ | every relationship belongs to a real post | 0 orphaned |
| ❌ | analysis map totals reconcile with certified Questions | 6503 |
| ✅ | analysis map totals reconcile with certified Directives | 2940 |
| ✅ | the analysis map counts no Emphasis | NaN |
| ✅ | post page: no blanket semantic rule paints without a certified occurrence | clean |
| ✅ | archive: no blanket semantic rule paints without a certified occurrence | clean |
| ✅ | post page: semantic highlights stop at the certified span | exact |
| ✅ | archive: semantic highlights stop at the certified span | exact |
| ✅ | Conclusions and Checkable reuse their certified occurrence spans | ok |
| ✅ | the Analysis Map reads the artifact and counts nothing itself | reads relationships.json |

## 13. Global search

| | Invariant | Observed |
|---|---|---|
| ✅ | the index declares it comes from certified artifacts | true |
| ✅ | indexed Questions = certified 6,454 | 6323 |
| ✅ | indexed Directives = certified 2,552 | 2940 |
| ✅ | indexed Claims = certified 4,181 | 8721 |
| ✅ | indexed Predictions = certified 630 | 843 |
| ✅ | indexed Evidence = certified 6,590 | 6590 |
| ✅ | indexed Entities = certified 1,445 | 1214 |
| ✅ | indexed Themes = certified 2,395 | 2644 |
| ✅ | indexed Codes = certified 739 distinct | 747 |
| ✅ | the search index carries no Emphasis section | 0 |
| ✅ | indexed unresolved = the 2,527 queue rows | 115 |
| ✅ | every editorial row is flagged not-Q-authored | 0 |
| ✅ | no Q-authored row is flagged editorial | 0 |
| ✅ | the results page labels editorial rows before their text | labelled |
| ✅ | in-post repeats are indexed as separate occurrences | 8721 rows, 8674 distinct (post, text) |
| ✅ | every record states why it can match | ok |
| ✅ | every post-bound record carries the id its link needs | 0 without |
| ✅ | search performs no classification of its own | reads the index |

## Provenance contracts

There is no single rule that shipped rows must equal certified counts — asserting one would produce false failures. Each section states its own contract.

| Section | Certified | Counted by | What may coexist | What must never display |
|---|---|---|---|---|
| Q Questions | 6,323 | rows carrying an `occurrences` field | 134 editorial-normalisation rows are shipped so the search index can find a question a reader half-remembers in cleaned-up form. | Those 134 must never count toward any total, never highlight in a post, and never display as Q-authored. They are identified by editorialNormalization or neverDisplayAsQ. |
| Q Directives | 2,940 | every actionRequests string across all posts | None. Every actionRequests entry is a certified directive. | n/a |
| Q Claims | 8,721 | postAnalysis.claims entries whose displayClass is claim | Predictions share the assertion family and the same storage, separated by claimMeta.displayClass. editorialParaphrases are stored per post and are NOT claims. | An editorial paraphrase must never be presented as Q’s literal wording. |
| Q Predictions | 843 | postAnalysis.predictions entries | A prediction IS an assertion; the combined 4,811 figure is only ever shown labelled as combined. | n/a |
| Evidence & References | 6,590 | every item row | URLs embedded inside pasted source material exist in the data and are labelled as such. They are references a reader can follow, but they are not Q citing a source. | An embedded-in-source URL must never be presented as a Q citation. |
| Q Entities | 8,948 | sum of per-entity mention counts | Canonical entities (1,332) and mentions (7,903) are DIFFERENT metrics, not a row-count mismatch — one entity is mentioned many times. The headline covers every resolved mention: 4,463 from the 93-entity core registry plus 3,440 from the 1,239 adjudicated-tail entities. Unresolved alias tokens are counted in neither. | An unresolved alias must never be shown as a resolved identification. |
| Q Themes | 2,644 | sum of per-post theme assignments | Multi-label by design: 378 posts carry more than one theme, so assignments exceed posts. Legacy extractor tags are not counted. | A legacy tag must never be shown as a certified theme. |
| Codes & Brackets | 1,957 | sum of per-code recurrence counts | Detected as a code does not mean decoded: 734 of 739 ship with no interpretation, which is the honest state. | An undecoded code must never be shown with an invented meaning. |
| Resolution Center | 115 | every queue row | Every row here is DELIBERATELY excluded from its section’s certified totals. That exclusion is the point of the section, not a gap in it. | A community suggestion must never alter certified data without re-entering audit → adjudication → materialise → QA → apply → deploy. |

## Overlap matrix

Overlap is allowed only where two sections answer different analytical questions about the same text.

| Pair | Occurrences | Why it is allowed | Cross-link |
|---|---|---|---|
| questions ↔ directives | 228 | An information request ("Define X.") is grammatically an instruction and functionally a question. Each section asks a different thing of the same unit. | directiveWrapped / semanticFunction on the question row |
| codes ↔ entities | 32 | Entities asks who is referenced; Codes asks how Q marked the reference. "HRC" and "[HRC]" are different analytical objects. | linkedEntityId on the code |
| claims ↔ predictions | measured | Both are assertions and share storage; displayClass decides which section shows a unit. The combined figure appears only where labelled combined. | claimMeta.semanticFamily = assertion, claimMeta.displayClass |

## Failures

- **1. Frozen canonical counts — Questions = 6,454 certified occurrences**: 6503
- **1. Frozen canonical counts — Claims = 4,189**: 8711
- **1. Frozen canonical counts — adjudicated tail submetric = 3,476**: 2893
- **2. Provenance contracts — Questions ships 6,457 rows for 6,323 certified**: 6637
- **2. Provenance contracts — all ten sections declare a provenance contract**: 9
- **4. Cross-section overlap — Question ↔ Directive overlap = 228, declared**: 173
- **4. Cross-section overlap — conclusions are an attribute of 964 assertions, not a separate count**: 0
- **6. Source-material isolation — questions: quoted-block over-extension stays at its known 100 occurrences**: 99 of 6503 (expected 100)
- **6. Source-material isolation — directives: quoted-block over-extension stays at its known 129 occurrences**: 128 of 2940 (expected 129)
- **6. Source-material isolation — claims: quoted-block over-extension stays at its known 593 occurrences**: 579 of 8711 (expected 593)
- **6. Source-material isolation — the source-boundary occurrence SET is unchanged**: +8 / -21
- **6. Source-material isolation — source-boundary debt stays at its known 235 posts**: 234 posts
- **7. Export-chain integrity — apply order in export matches the declared order**: out of order
- **8. Seed and cache integrity — SEED_VERSION is 85 (#1928/#1929 owner rulings)**: 87
- **9. UI count integrity — sectionInfo states 6,323**: ok
- **9. UI count integrity — sectionInfo states 2,940**: ok
- **9. UI count integrity — sectionInfo states 8,721**: ok
- **9. UI count integrity — sectionInfo headlines 1,214 entities and 8,948 mentions**: ok
- **9. UI count integrity — sectionInfo carries no Emphasis section**: ok
- **9. UI count integrity — Claims headline = certified 8,928 / 3,084**: ok
- **9. UI count integrity — Predictions headline = certified 842 / 673**: ok
- **9. UI count integrity — Entities headline = certified mentions / 2,115 posts**: ok
- **10b. Entity hover publication — one global synopsis per live entity, less the 39 awaiting one**: 1201 published + 39 pending
- **10b. Entity hover publication — no published synopsis points at an entity that is no longer live**: 26 orphaned
- **10b. Entity hover publication — every hover resolves to a live entity id**: 846 entities
- **10c. Integrated entity cleanup — the applied totals are exactly the ones that were proven**: 1214 rows / 8948 mentions
- **10c. Integrated entity cleanup — no dormant identity carries a global synopsis or a hover**: 21
- **10c. Integrated entity cleanup — the provenance audit describes the state it was run against**: 1448 rows / 9926 mentions
- **10c. Integrated entity cleanup — the same inputs still produce the same audit, byte for byte**: inputs moved
- **10d. Public entity list reconciliation — the 135 source-only identities are a labelled component**: 136 rows / registry 136
- **10d. Public entity list reconciliation — the 208 dormant identities are reserved and never public**: 229 reserved, 0 leaked
- **11. Frozen-section mutation — no certified artifact CHANGED CONTENT since the manifest**: posts.json, questions.json, entities.json, relationships.json, search-index.json, entity-hovers.json
- **12. Cross-section relationships — postAnalysis entries equal certified mentions**: 8849 vs 8948
- **12. Cross-section relationships — Question ↔ Directive edges = the certified 230**: 231
- **12. Cross-section relationships — Claim → Conclusion edges = the certified 964**: undefined
- **12. Cross-section relationships — Claim → Source provided edges = the certified 438**: 341
- **12. Cross-section relationships — analysis map totals reconcile with certified Questions**: 6503
