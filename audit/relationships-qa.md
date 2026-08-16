# Q Drops — cross-section relationship QA

A product layer over frozen data. Every relationship comes from a stored cross-link, a certified span overlap, a shared certified id, or an adjudicated attribute — **none is inferred from keywords or proximity**. No certified count moves.


**6,432 relationships** across 4,861 posts.


## By type

| Relationship | Count | Certified basis |
|---|---|---|
| theme ↔ support | 1,719 | `themes.evidence.anchors` |
| emphasis ↔ claim | 1,330 | certified span overlap |
| claim ↔ conclusion | 966 | `claimMeta.isConclusion` — an attribute, never an added population |
| prediction ↔ assertion | 595 | `claimMeta.semanticFamily` — sections stay separate |
| claim ↔ source ↔ provided | 439 | `claimMeta.sourceProvided` |
| evidence ↔ claim | 424 | certified span overlap |
| emphasis ↔ directive | 373 | certified span overlap |
| question ↔ directive | 230 | canonical key match or `questions.directiveSource` |
| entity ↔ code | 180 | `codes.linkedEntityId`, the stored cross-link |
| unresolved ↔ occurrence | 105 | resolution-queue occurrence id |
| emphasis ↔ question | 36 | certified span overlap |
| prediction ↔ source ↔ provided | 35 | `claimMeta.sourceProvided` on a prediction — a second population, kept apart from the certified 438 |

## QA

| | Check | Observed |
|---|---|---|
| ✅ | every relationship states its basis | 0 without |
| ✅ | no duplicate relationship edges | 0 |
| ✅ | no dangling endpoint ids | 0 |
| ✅ | no orphaned cross-links | 0 |
| ✅ | Question ↔ Directive = the certified 230 | 230 |
| ✅ | Entity ↔ Code = the certified 32 links | 32 |
| ✅ | Claim ↔ Conclusion = the certified 966 | 966 |
| ✅ | Claim ↔ Source provided = the certified 439 | 439 |
| ✅ | Prediction ↔ Source provided reported separately | 35 |
| ✅ | Prediction ↔ assertion family = 595 | 595 |
| ✅ | unresolved edges = the 105 queue rows | 105 |

## Problems

| Class | Count |
|---|---|
| orphanedCrossLinks | 0 |
| danglingIds | 0 |
| noBasis | 0 |
| duplicates | 0 |
