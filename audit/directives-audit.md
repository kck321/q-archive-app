# Q Drops — directives audit

`scripts/audit-directives.mjs`. Same method as the certified Questions audit. **Nothing applied to production.**


## Totals

| Measure | Count |
|---|---|
| **Q-authored directives (occurrences)** | **1,461** |
| **Distinct directives** | **906** |
| Posts containing at least one | 964 of 4,966 (19.4%) |
| Already stored as an actionRequest | 1,312 |
| Not currently stored | 149 |
| Fragments excluded | 16 |
| Quoted/anon directives excluded | 504 |

## By family

| Family | Count | What Q is asking for |
|---|---|---|
| cognition | 610 | think, remember, understand, learn |
| morale | 291 | trust, pray, stand, prepare |
| attention | 230 | read, watch, listen, note |
| research | 227 | investigate, compare, trace, verify |
| prohibition | 75 | do not, never, avoid |
| dissemination | 28 | share, spread, archive, organise |

## Cross-check against the certified Questions dataset

The Questions audit reclassified **57** units as directives. This audit re-derives **57** of them.

**All of them.** The two audits agree completely on the seed set.

## Method

- Segmentation is imported from `scripts/lib/segment.mjs`, lifted verbatim from the frozen v2.1 questions auditor, so both audits draw unit boundaries identically.
- A question outranks a directive: anything ending in `?`, and any information request (`Define` / `Identify` / `List <object>`), belongs to the Questions dataset and is excluded here.
- Quoted/anon lines are excluded, and counted separately to prove it.
- Fragments (ending or starting on a lone initial) are excluded, same guard as the certified audit.
