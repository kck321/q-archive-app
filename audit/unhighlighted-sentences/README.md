# Q Drops — Unhighlighted Sentence Audit, measured on the published site

**Read this first. It is the brief for whoever reviews the list.**

Every drop on **https://qdrops.app** was crawled and the highlights were read out of the rendered
DOM. This is not a model of the renderer — it is the marks a reader can actually see.

```powershell
node scripts\audit-painted-truth.mjs --base https://qdrops.app   # crawl: what the site paints
node scripts\audit-unhighlighted-from-truth.mjs                  # units measured against it
node scripts\classify-unhighlighted-residual.mjs                 # what each leftover IS
node scripts\build-unhighlighted-sentence-workbook.mjs           # the .xlsx
```

Read-only throughout: nothing classified into a certified layer, nothing rebuilt, nothing deployed.

---

## Why this pass exists, and what changed

`audit-unhighlighted-sentences.mjs` **transcribes** `renderPostBody()` into Node and measures
against the transcription. PROJECT_CONTEXT already names the risk — *"a near-enough
reimplementation would invent uncovered text that is actually painted"* — and a transcription is
only true until the renderer moves.

So the transcription was graded against the DOM, over all 4,734 readable drops:

| | |
|---|---:|
| transcription queued | 10,646 |
| DOM queued | 10,700 |
| **transcription WRONG — it said unpainted, the site paints it** | **0** |
| transcription MISSED — the site does not paint it, and it said nothing | 54 |

**Zero false positives.** Nothing the earlier handoff listed as unhighlighted is highlighted on
the live site. It under-reported by 54 lines. The queue is real, and this file supersedes it only
by being measured rather than modelled.

## How much of the archive is painted

| Measure | Count |
|---|---:|
| Drops crawled on the published site | **4,734** of 4,966 (231 carry no body text; **#859 could not be read**) |
| Marks read from the DOM | 53,874 |
| **Characters painted** | **880,245 of 937,048 — 93.9%** |
| Characters left unpainted | 56,803, in 7,350 runs |
| Drops painted end to end | 330 |
| Drops with at least one leftover | 4,404 |

By sentence rather than by character:

| Measure | Count |
|---|---:|
| Units segmented | 29,563 |
| Fully painted in a category — excluded | 18,863 (63.8%) |
| **Queued for review** | **10,700** across **4,457** drops |
| … distinct wordings behind those rows | **4,859** |
| Completely unhighlighted | 5,842 |
| Partially highlighted | 2,086 |
| 100% painted but only by inline layers | 2,772 |
| Only punctuation left over | 1,020 |

**#859 is a data defect, not a harness failure.** Its source text splices a pointer into the middle
of a word — `These peo&gt;&gt;567493ple are stupid.` — so no rendered block matches the drop text.

## The locked rule

> If **any** non-whitespace character of a sentence is outside an active highlight, the **whole
> sentence** goes in the list.

A highlighted **name, bracket, theme anchor or link** inside a sentence never speaks for the rest
of it — that is the owner's explicit instruction and it is what `PARTIAL_ONLY` means. Emphasis,
Implied Conclusions and Checkable Claims are **retired** (2026-08-21) and are not coverage.

Unit boundaries come from `scripts/lib/units.mjs`, shared with the transcription pass, so the two
can only ever disagree about what is *painted* — never about where a sentence starts.

---

## Triage buckets

| Bucket | Rows | Distinct wordings |
|---|---:|---:|
| `A_SIGNATURE` | 4,523 | 3 |
| `B_LINK_OR_REFERENCE` | 1,636 | 1,557 |
| `C_PUNCTUATION_ONLY` | 859 | 445 |
| `D_INLINE_ONLY_FULLY_PAINTED` | 1,099 | 879 |
| `E_CERTIFIED_QUOTED_SOURCE` | 177 | 164 |
| `G_CERTIFIED_CONTEXT_NOT_PAINTED` | 1,232 | 970 |
| `H_CERTIFIED_CODE_NOT_PAINTED` | 293 | 259 |
| `I_CERTIFIED_EVIDENCE_NOT_PAINTED` | 113 | 112 |
| `J_UNCLASSIFIED_PROSE` | **768** | **616** |

## Proposed category — what each leftover portrays

Every queued line carries a proposal, its subtype, a plain reading of what the line is doing in the
drop, and the evidence the proposal rests on. Destinations are the app's **own eight live
sections** (`src/lib/sectionInfo.ts`) plus two honest non-answers.

| Proposed category | Lines |
|---|---:|
| `Signature / Sign-off (not a proposition)` | 4,373 |
| `Q Evidence & References` | 2,579 |
| `Q Codes & Brackets` | 1,560 |
| `Q Entities` | 923 |
| `NEEDS CONTEXT` | 720 |
| `Q Claims` | 385 |
| `Q Questions` | 74 |
| `Q Themes` | 44 |
| `Q Directives` | 29 |
| `Q Predictions` | 13 |

`NEEDS CONTEXT` is a result, not a gap in the pass. The archive's own rules forbid the guesses that
would empty it: ALL CAPS alone is not a code, a bare noun phrase is not a claim, and a unit the
segmenter cut in half at an abbreviation is not a sentence at all.

## What actually has to be decided

| Decision | Lines | Distinct wordings |
|---|---:|---:|
| `POLICY RULING` — one decision settles the whole population | 4,542 | **7** |
| `PAINT POLICY` — already certified in a layer the body does not fill | 3,342 | 3,042 |
| `CLASSIFY` — no disposition anywhere in the archive | 1,905 | 1,447 |
| `SPAN BOUNDARY FIX` — classification exists, the highlight stops short | 911 | 481 |

**Seven wordings settle 4,542 lines** — 42% of the queue. `Q`, `Q+`, `WWG1WGA`, `WRWY`,
"God bless", "Godspeed" and the spelled-out slogan take one ruling between them.

The two real questions, and they should not be mixed:

1. **Paint policy (3,342 lines).** Does "every sentence highlighted" mean every sentence must carry
   a **visible fill**? These are already dispositioned in the data — context units, codes, evidence,
   quoted source — and simply carry no colour in the drop body. If yes, those layers need a visual
   treatment, not a reclassification.
2. **Classification (1,905 lines / 1,447 wordings).** Real adjudication against the eight sections.

`SPAN BOUNDARY FIX` is neither: the classification exists and the highlight stops one character
short, or the segmenter cut a sentence at an abbreviation ("Why would H.", "…James R.").

---

## Files

| File | What it is |
|---|---|
| `unhighlighted-sentence-review.xlsx` | **the deliverable** — six sheets, Q post number first on every row |
| `truth-manifest.json` | the evidence: what was crawled, what was read, how the two passes agree |
| `distinct-wordings.csv` · `by-bucket/*.csv` | the queue split for feeding a reviewer one bite at a time |
| `painted-truth.jsonl` | every painted range read from the DOM (gitignored, ~7 min to re-crawl) |
| `unhighlighted-from-truth.jsonl` | the units measured against it (gitignored) |
| `residual-classified.jsonl` | the same rows with a `proposal` object added (gitignored) |
| `manifest.json` · `unhighlighted-sentences.*` | the older transcription pass, kept for comparison |

Workbook sheets, in the order they are useful:

1. **Summary** — the rule, the measurement, the counts, the proposals.
2. **Action Plan** — 23 rows. The whole queue as the decisions that have to be made.
3. **Distinct Wordings** — 4,859 rows. One ruling settles every occurrence of that wording.
4. **Unclassified Prose** — bucket J only. The 768 rows that are the real work.
5. **Review Queue** — all 10,700 rows.
6. **Category Proposals** — every proposal shape with its size and an example.

Three blank **GPT** columns sit beside the owner-review block on every row sheet, with an
AGREE/DISAGREE/PARTIAL dropdown, so an independent pass pastes in and merges row for row.

## Review discipline

- Decide the **full-sentence** category from the drop's context, not from an isolated keyword.
- Distinguish Q-authored text from quoted anon, article, tweet, letter, Scripture or image text.
- Use the existing eight sections first. Propose a new category only for a coherent, recurring
  group the current model cannot represent honestly — with its size, function and examples.
- Do **not** restore `EMPHASIS` as a catch-all. It is retired.
- Leave uncertain items `NEEDS_CONTEXT` rather than force-classifying them.
- Nothing here is applied. Rulings come back as filled columns; a materialiser applies them later.
