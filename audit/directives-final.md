# Q Drops — Directives, final reconciled totals

One unified set. The invariant is a **gate in `scripts/reconcile-directives.mjs`**, not a claim: the script exits non-zero unless `sum(families) === occurrences`, every directive has one of the seven agreed families, no unit is counted twice, and no `NEEDS_CONTEXT` record is in the total.


## The reconciliation issue, and what it was

The certification pass and the queue adjudication wrote two artifacts, and their numbers were reported side by side as if they were one set — family totals summing to **2,277** beside a headline of **2,422**. It was a reporting fault only: **all 145 promoted directives carry a family**, none were left unresolved. The merge now happens once, here, so the two can no longer be quoted apart.


## Where the 145 went

| Family | From certification | Promoted from queues | Final |
|---|---|---|---|
| cognition | 673 | +18 | **691** |
| research | 493 | +3 | **496** |
| morale | 427 | +76 | **503** |
| attention | 291 | +19 | **310** |
| operational | 243 | +18 | **261** |
| dissemination | 88 | +3 | **91** |
| prohibition | 62 | +8 | **70** |
| **Total** | **2,277** | **+145** | **2,422** |

Promoted directives by originating queue:

| Queue | Promoted | Left as claim / statement / held |
|---|---|---|
| stored actionRequest, fails mood | 65 | 738 |
| undecidable standing alone | 0 | 60 |
| corpus-learned verb | 80 | 183 |
| no family | 0 | 52 |
| segmentation error | 0 | 10 |

## Final certified Directives

| Measure | Value |
|---|---|
| Directive occurrences | **2,422** |
| Distinct (canonical `key()`) | 1,472 |
| Posts containing a directive | 1,417 |
| In-post repeats included | 53 |
| Held at NEEDS_CONTEXT (excluded) | 148 |

### By family

| Family | Count |
|---|---|
| cognition | 691 |
| research | 496 |
| morale | 503 |
| attention | 310 |
| operational | 261 |
| dissemination | 91 |
| prohibition | 70 |
| **Sum** | **2,422** |

## Question ↔ Directive overlap

| Measure | Value |
|---|---|
| Units that are BOTH | **228** |
| — information-request imperatives | 177 |
| — directive-wrapped questions | 51 |
| Posts containing both a question and a directive | 707 |

Each overlapping unit is counted **once in Questions and once in Directives**, never twice within either section. Questions remain frozen at 6,442 occurrences across 1,696 posts.

