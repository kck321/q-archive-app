# Q Drops — cross-section relationship QA

A product layer over frozen data. Every relationship comes from a stored cross-link, a certified span overlap, a shared certified id, or an adjudicated attribute — **none is inferred from keywords or proximity**. No certified count moves.


**4,622 relationships** across 4,945 posts.


## By type

| Relationship | Count | Certified basis |
|---|---|---|
| theme ↔ support | 1,721 | `themes.evidence.anchors` |
| prediction ↔ assertion | 935 | `claimMeta.semanticFamily` — sections stay separate |
| evidence ↔ claim | 837 | certified span overlap |
| unresolved ↔ occurrence | 353 | resolution-queue occurrence id |
| claim ↔ source ↔ provided | 330 | `claimMeta.sourceProvided` |
| question ↔ directive | 231 | canonical key match or `questions.directiveSource` |
| entity ↔ code | 180 | `codes.linkedEntityId`, the stored cross-link |
| prediction ↔ source ↔ provided | 35 | `claimMeta.sourceProvided` on a prediction — a second population, kept apart from the certified 438 |

## QA

| | Check | Observed |
|---|---|---|
| ✅ | every relationship states its basis | 0 without |
| ✅ | no duplicate relationship edges | 0 |
| ✅ | no dangling endpoint ids | 0 |
| ✅ | no orphaned cross-links | 0 |
| ✅ | Question ↔ Directive = the certified 231 | 231 |
| ✅ | Entity ↔ Code = the certified 32 links | 32 |
| ✅ | Claim ↔ Source provided = the certified 330 | 330 |
| ✅ | Prediction ↔ Source provided reported separately | 35 |
| ✅ | Prediction ↔ assertion family = the certified 935 | 935 |
| ✅ | unresolved edges = the 353 queue rows | 353 |

## Problems

| Class | Count |
|---|---|
| orphanedCrossLinks | 0 |
| danglingIds | 0 |
| noBasis | 0 |
| duplicates | 0 |
