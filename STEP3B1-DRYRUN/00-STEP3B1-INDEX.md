# Step 3B-1 — dry run

**Nothing was written to `public/data`. No count moved. Seed stays 85.**

## Scope, as corrected

| population | raw records | unique occurrence keys | unique sentenceIds |
|---|---|---|---|
| MULTI_PRIMARY_117 | 117 | 235 | 117 |
| MULTI_PRIMARY_EXACT_89 | 89 | 178 | 89 |
| CONTAINED_PARTIAL_28 | 28 | 57 | 28 |
| DIRECTIVE_QUESTION_220 | 220 | 440 | 220 |
| WRAPPED_PARTIAL_51 | 51 | 51 | 51 |
| BOUNDARY_CROSSING_242 | 242 | 240 | 0 |
| DUPLICATE_KEYS_148 | 148 | 102 | 0 |
| CONTEXT_COLLISION_108 | 108 | 108 | 108 |
| UNLOCATED_645 | 645 | 0 | 0 |

## The boundary/duplicate intersection

`boundaryCrossing` is disjoint from the multi-primary and directive+question populations, but it
is **not** disjoint from `duplicateKeys`. The intersection is exactly **2** keys:

- `2971|questions|561|799`
- `4454|questions|238|404`

A duplicate-record merge on those two does **not** resolve the cross-sentence geometry. They carry
both memberships and the boundary decision stays held.

## Files

| file | rows |
|---|---|
| `01-MULTI-PRIMARY-117.csv` | 117 |
| `02-PARTIAL-28.csv` | 28 |
| `03-SOURCE-DISPOSITIONS-3.csv` | 3 |
| `04-DUPLICATE-MERGES-106.csv` | 148 |
| `05-NESTED-OVERLAPS.csv` | 51 |
| `06-CONTEXT-MOVES-108.csv` | 108 |
| `07-DIRECTIVE-QUESTION-UNIFIED.csv` | 220 |
| `08-POPULATION-INTERSECTIONS.csv` | 9 |
| `09-COUNT-PROJECTION.csv` | 10 |
| `10-CONFLICTS-HELD.csv` | 945 |
| `STEP3B1-APPLY-PLAN.jsonl` | 540 |

## Entity sweep figures (source-aware, corrected)

| entity | candidates | included | distinct posts |
|---|---|---|---|
| Q | 4521 | 137 | 112 |
| QAnon | 158 | 153 | 49 |
| Anons | 112 | 111 | 109 |
| **deduplicated union** | — | — | **259** |

Exclusions reconcile to **4390**:

| reason | count |
|---|---|
| terminal signature | 4346 |
| URL or path | 15 |
| Q&A — Q means Question | 8 |
| source material — sustained prose block — pasted or quoted passage | 6 |
| FAQ label "Q:" — Q means Question | 4 |
| Q clearance / Q fever — not the persona | 2 |
| source material — excerpt beneath a source link | 2 |
| source material — dictionary entry (continuation) | 2 |
| source material — greentext excerpt | 2 |
| technical code (Q-T2810C) | 1 |
| source material — inside a multi-line quotation | 1 |
| source material — quoted FAQ question | 1 |

> The earlier figures of 116 / 111 / 52 posts are superseded. They came from a filter that removed
> *every* standalone `Q` line rather than only the terminal signature, and from counting without
> source-awareness. Retained here only as this correction note.

