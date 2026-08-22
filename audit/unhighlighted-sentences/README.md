# Q Drops — Unhighlighted Sentence Census & Residual Classification

**Read this first. It is the brief for whoever reviews the list.**

Run against `public/data/posts.json` at SHA-256 `79711cf8…6febfe6b` — the seed-88 certified data
that is live at https://qdrops.app. Read-only: nothing was classified into a certified layer,
nothing was rebuilt, nothing was deployed.

Regenerate with:

```powershell
node scripts\audit-unhighlighted-sentences.mjs        # the census — what is still unpainted
node scripts\classify-unhighlighted-residual.mjs      # the proposal — what each line IS
node scripts\build-unhighlighted-sentence-workbook.mjs
```

The three steps are separate on purpose. The census measures; the classifier proposes; neither
writes into `public/data`. A ruling only becomes real when a materialiser applies it later.

---

## The locked rule

> If **any** non-whitespace character of a sentence is outside an active highlight, the **whole
> sentence** goes in the list.

- 0% painted → in the list.
- 1%–99.99% painted → in the list.
- Everything painted except a final period → in the list, flagged `Only Punctuation Left? = YES`.
- 100% painted by a real sentence-level category → excluded.
- A highlighted **name, place, bracket, theme anchor or link** inside a sentence never speaks for
  the rest of it. That is the owner's explicit instruction and it is what `PARTIAL_ONLY` means.

## What "highlighted" means here

The coverage set is the app's **own renderer**, transcribed from `renderPostBody()` in
`src/pages/PostDetail.tsx` and `highlightText()` in `src/lib/postHighlight.tsx` — the same layers,
the same escaping, the same alias expansion, the same word boundaries, the same `>>NNNNNN`
protection, and the same `runtimeText()` coordinate system the browser paints in. Measuring
against `posts.json` raw bytes instead would invent uncovered text that is actually painted on
screen; that failure has already cost this project 2,475 wrong spans once.

| Layer | Paints in the drop body? |
|---|---|
| Question, Directive, Claim, Prediction | yes — and these can **own a whole sentence** |
| Named Entity, Theme anchor, Bracket/Code, URL | yes — but **inline only**, they never own the sentence |
| Context units | no (owner ruling 2026-08-17) — certified layer intact |
| Evidence, Codes | no body fill |
| **Emphasis, Implied Conclusions, Checkable Claims** | **retired 2026-08-21** — data, fields, sections and UI |

Emphasis is gone, not merely unpainted. The old `F_CERTIFIED_EMPHASIS_NOT_PAINTED` bucket no
longer exists and its stale CSV has been removed rather than left to be read as live.

---

## The headline numbers

| Measure | Count |
|---|---:|
| Canonical posts | 4,966 |
| Posts carrying body text | 4,735 |
| Q-authored units segmented | 29,569 |
| Fully painted in a category — excluded | 18,921 (64.0%) |
| **Queued for review** | **10,648** across **4,458 posts** |
| … distinct wordings behind those rows | **4,815** |
| Completely unhighlighted | 5,879 |
| Partially highlighted | 2,045 |
| 100% painted but only by inline layers | 2,724 |
| Only punctuation left over | 1,020 |
| Already certified in *some* layer that does not paint | 4,533 |
| Certified as quoted / source material | 217 |
| Nothing in the archive has ever dispositioned it | 6,115 |
| **Certified spans that fail to resolve (renderer misses)** | **0** |

That last row matters: every certified occurrence resolves into the rendered body, so nothing in
this queue is here because a highlight is broken. The queue is a **classification** gap, not a
rendering bug.

**Against the 19 Aug run, the queue fell 16,024 → 10,648 and the genuinely unclassified prose fell
1,323 → 763.** The Step 3B reconciliation is what closed the difference.

---

## Triage buckets — what is still unpainted

| Bucket | Rows | Distinct wordings |
|---|---:|---:|
| `A_SIGNATURE` | 4,524 | 3 |
| `B_LINK_OR_REFERENCE` | 1,636 | 1,557 |
| `C_PUNCTUATION_ONLY` | 859 | 445 |
| `D_INLINE_ONLY_FULLY_PAINTED` | 1,051 | 839 |
| `E_CERTIFIED_QUOTED_SOURCE` | 175 | 162 |
| `G_CERTIFIED_CONTEXT_NOT_PAINTED` | 1,232 | 970 |
| `H_CERTIFIED_CODE_NOT_PAINTED` | 293 | 259 |
| `I_CERTIFIED_EVIDENCE_NOT_PAINTED` | 115 | 114 |
| `J_UNCLASSIFIED_PROSE` | **763** | **612** |

## Proposed category — what each line portrays

Every queued line now carries a proposal, its subtype, a plain reading of what the line is doing
in the drop, and the evidence the proposal rests on. Destinations are the app's **own eight live
sections** (`src/lib/sectionInfo.ts`), plus two honest non-answers.

| Proposed category | Lines | Distinct wordings | Posts |
|---|---:|---:|---:|
| `Signature / Sign-off (not a proposition)` | 4,374 | 6 | 4,353 |
| `Q Evidence & References` | 2,577 | 2,468 | 1,828 |
| `Q Codes & Brackets` | 1,536 | 984 | 802 |
| `Q Entities` | 928 | 545 | 462 |
| `NEEDS CONTEXT` | 717 | 469 | 482 |
| `Q Claims` | 385 | 313 | 234 |
| `Q Questions` | 47 | 33 | 36 |
| `Q Themes` | 44 | 34 | 44 |
| `Q Directives` | 27 | 19 | 25 |
| `Q Predictions` | 13 | 13 | 10 |

`NEEDS CONTEXT` is a result, not a gap in the pass. The archive's own rules forbid guessing: ALL
CAPS alone is not a code, a bare noun phrase is not a claim, and a unit the segmenter cut in half
at an abbreviation is not a sentence at all. Those three shapes are most of the 717.

## What actually has to be decided

| Decision | Lines | Distinct wordings | Posts |
|---|---:|---:|---:|
| `POLICY RULING` — one decision settles the whole population | 4,543 | 7 | 4,351 |
| `PAINT POLICY` — already certified in a layer the body does not fill | 3,321 | 3,021 | 2,133 |
| `CLASSIFY` — no disposition anywhere in the archive | 1,875 | 1,419 | 789 |
| `SPAN BOUNDARY FIX` — classification exists, the highlight stops short | 909 | 478 | 540 |

**Seven wordings settle 4,543 lines.** `Q`, `Q+`, `WWG1WGA`, `WRWY`, "God bless", "Godspeed" and
the spelled-out slogan are 43% of the entire queue and take one ruling between them.

The two real questions, and they should not be mixed:

1. **Paint policy (3,321 lines).** Does "every sentence highlighted in a category" mean every
   sentence must carry a **visible fill**? These lines are already dispositioned in the data —
   as context units, codes, evidence or quoted source — and simply carry no colour in the drop
   body. If the answer is yes, those layers need a visual treatment, not a reclassification.
2. **Classification (1,875 lines / 1,419 wordings).** Real adjudication against the eight live
   sections.

`SPAN BOUNDARY FIX` is neither: the classification exists and the highlight stops one character
short, or the segmenter cut a sentence at an abbreviation ("Why would H.", "…James R.").

---

## Files

| File | What it is |
|---|---|
| `unhighlighted-sentence-review.xlsx` | **the deliverable** — six sheets, Q post number first on every row |
| `distinct-wordings.csv` | 4,815 rows, one per distinct wording — one ruling settles every copy |
| `by-bucket/*.csv` | the queue split into its nine populations, for feeding a reviewer one at a time |
| `unhighlighted-sentences.csv` | all 10,648 rows, one line per row (gitignored, regenerable) |
| `unhighlighted-sentences.jsonl` | the census record — offsets, every overlap, full post text (gitignored) |
| `residual-classified.jsonl` | the same rows with a `proposal` object added (gitignored) |
| `manifest.json` | source hash, counts, layer definitions, the exact rule |

The workbook's sheets, in the order they are useful:

1. **Summary** — the rule, the counts, the proposals and what each bucket means.
2. **Action Plan** — 23 rows. The whole queue as the decisions that have to be made.
3. **Distinct Wordings** — 4,815 rows. One ruling here settles every occurrence of that wording.
4. **Unclassified Prose** — bucket J only. The 763 rows that are the real work.
5. **Review Queue** — all 10,648 rows.
6. **Category Proposals** — every proposal shape with its size and an example.

## Every row carries

Q post number · post label · sentence number within the post · stable audit ID · the complete
canonical sentence exactly as stored · **the proposed category, subtype, what the line portrays,
and the evidence for the proposal** · proposal confidence · the action needed · the post's
certified themes · the entities on the line · how many times that wording recurs archive-wide ·
coverage status · painted % and sentence-category % · the **exact uncovered text** and its
character count · whether only punctuation is uncovered · every overlapping highlight with its
category, text and offsets · every certified-but-unpainted layer with its text · quoted-source
flag and reason · sentence form · segmentation confidence · a non-binding routing hint and why ·
context before and after · canonical start/end offsets · the source link · blank owner-review
columns · and three blank **GPT** columns, so an independent pass can be pasted in beside this one
and the two compared row for row.

## Review discipline

- Decide the **full-sentence** category from the drop's context, not from an isolated keyword.
- Distinguish Q-authored text from quoted anon, article, tweet, letter, Scripture or image text.
- Use the existing eight sections first. Propose a new category only for a coherent, recurring
  group the current model cannot represent honestly — and report its size, shared function,
  examples, and why each existing category fails.
- Do **not** restore `EMPHASIS` as a catch-all. It is retired.
- Leave uncertain items `NEEDS_CONTEXT` rather than force-classifying them.
- Nothing here is applied. Rulings come back as filled columns; a materialiser applies them later.
