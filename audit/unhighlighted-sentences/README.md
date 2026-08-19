# Q Drops — Unhighlighted Sentence Audit

**Read this first. It is the brief for whoever reviews the list.**

Generated from the live local repository at `C:\Users\heath\q-app` against
`public/data/posts.json` (4,966 canonical posts). Read-only: nothing was classified, nothing was
rebuilt, nothing was deployed, Emphasis was not restored.

Regenerate with:

```powershell
node scripts\audit-unhighlighted-sentences.mjs
node scripts\build-unhighlighted-sentence-workbook.mjs
```

---

## The locked rule

> If **any** non-whitespace character of a sentence is outside an active highlight, the **whole
> sentence** goes in the list.

- 0% painted → in the list.
- 1%–99.99% painted → in the list.
- Everything painted except a final period → in the list, flagged `Only Punctuation Left? = YES`.
- 100% painted by a real sentence-level category → excluded.
- A highlighted **name, place, bracket, theme anchor or link** inside a sentence never speaks for
  the rest of it. That was the owner's explicit instruction and it is what `PARTIAL_ONLY` means.
- **Emphasis never counts as coverage.** Owner ruling 2026-08-17 removed the Emphasis fill from
  the drop body; the certified layer is untouched and is reported per row instead.

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
| Emphasis | no (owner ruling 2026-08-17) — certified layer intact |
| Context units | no (owner ruling 2026-08-17) — certified layer intact |
| Evidence, Codes | no body fill |
| Implied Conclusions, Checkable Claims | retired / merged into Claims |

Sentence boundaries come from `scripts/lib/segment.mjs` `unitsFor()`, the frozen segmentation the
questions and directives auditors already use, extended here to carry character offsets. Quoted
`>>NNNNNN` pointer lines are not units and are never counted as unhighlighted.

---

## The headline numbers

| Measure | Count |
|---|---:|
| Canonical posts | 4,966 |
| Posts carrying body text | 4,735 |
| Q-authored units segmented | 29,569 |
| Fully painted in a category — excluded | 13,545 (45.8%) |
| **Queued for review** | **16,024** across **4,484 posts** |
| … distinct wordings behind those 16,024 rows | **8,495** |
| Completely unhighlighted | 9,898 |
| Partially highlighted | 3,505 |
| 100% painted but only by inline layers | 2,621 |
| Only punctuation left over | 1,053 |
| Already certified in *some* layer that does not paint | 9,894 |
| Certified as quoted / source material | 767 |
| Nothing in the archive has ever dispositioned it | 6,130 |
| Certified spans that fail to resolve (renderer misses) | **0** |

That last row matters: every certified occurrence resolves into the rendered body, so nothing in
this queue is here because a highlight is broken. The queue is a **classification** gap, not a
rendering bug.

---

## The plan this list implies

16,024 rows reviewed one at a time is not a plan. They collapse into ten populations, and most of
them take **one ruling each**, not one ruling per row. Every row carries a `Triage Bucket`, and
each bucket is also written out as its own CSV under `by-bucket/`.

| Bucket | Rows | Distinct wordings | What it is | What it needs |
|---|---:|---:|---|---|
| `A_SIGNATURE` | 4,524 | **3** | `Q`, `Q+`, `WWG1WGA` sign-offs | one blanket ruling |
| `B_LINK_OR_REFERENCE` | 1,636 | 1,557 | bare URLs, board pointers, file names | one policy: is Link/Citation a category? |
| `C_PUNCTUATION_ONLY` | 892 | 464 | everything painted except a period/bracket/quote | a span-boundary fix, not a classification |
| `D_INLINE_ONLY_FULLY_PAINTED` | 948 | 741 | 100% painted, but only by entity/bracket/theme/link | one policy: does an inline-only line count as classified? |
| `E_CERTIFIED_QUOTED_SOURCE` | 728 | 624 | already certified as quoted / pasted / scripture | one policy for quoted material |
| `F_CERTIFIED_EMPHASIS_NOT_PAINTED` | 1,423 | 1,137 | certified Emphasis, deliberately not filled | one policy — reopening this reopens the 2026-08-17 ruling |
| `G_CERTIFIED_CONTEXT_NOT_PAINTED` | 4,023 | 2,886 | certified `contextUnit` = reviewed, deliberately in no category | one policy — same ruling |
| `H_CERTIFIED_CODE_NOT_PAINTED` | 434 | 352 | certified Code occurrence with no bracket to paint | one policy |
| `I_CERTIFIED_EVIDENCE_NOT_PAINTED` | 93 | 92 | certified Evidence whose span is not a painted layer | one policy |
| `J_UNCLASSIFIED_PROSE` | **1,323** | **1,054** | nothing in the archive has looked at this text | **this is the actual work** |

**Read that bottom row.** Of 16,024 queued sentences, **1,323 rows / 1,054 distinct wordings** are
genuinely unclassified prose. Everything above it is a policy decision the owner has, in several
cases, already made once — the sentences are dispositioned in the data and simply do not carry a
colour in the drop body.

So the game plan is two separate questions, and they should not be mixed:

1. **Policy (buckets A–I, 14,701 rows).** Does "every sentence highlighted in a category" mean
   every sentence must carry a **visible fill**? If yes, the Emphasis and Context rulings of
   2026-08-17 need revisiting, or those layers need a different visual treatment. If no, these
   rows are already answered and the queue is 1,323 rows long.
2. **Classification (bucket J, 1,323 rows / 1,054 wordings).** Real adjudication: Question,
   Directive, Claim, Prediction, Theme, Quoted Claim, Statement/Heading, or Needs Context.

---

## Files

| File | What it is |
|---|---|
| `unhighlighted-sentence-review.xlsx` | the workbook — 4 sheets, Q post number first on every row |
| `distinct-wordings.csv` | **8,495 rows, one per distinct wording** — the file to rule on |
| `by-bucket/*.csv` | the same queue split into its ten populations, for feeding a reviewer one at a time |
| `unhighlighted-sentences.csv` | all 16,024 rows, one sentence per row |
| `unhighlighted-sentences.jsonl` | the authoritative record — offsets, every overlap, full post text, blank `review` object |
| `manifest.json` | source hash, counts, layer definitions, the exact rule |

The workbook's sheets, in the order they are useful:

1. **Summary** — the rule, the counts, and what each bucket means.
2. **Distinct Wordings** — 8,495 rows. One ruling here settles every occurrence of that wording.
3. **Unclassified Prose** — bucket J only. The 1,323 rows that are the real work.
4. **Review Queue** — all 16,024 rows.

## Every row carries

Q post number · post label · sentence number within the post · stable audit ID · the complete
canonical sentence exactly as stored · how many times that wording recurs archive-wide · coverage
status · painted % and sentence-category % · the **exact uncovered text** and its character count
· whether only punctuation is uncovered · every overlapping highlight with its category, text and
offsets · every certified-but-unpainted layer with its text · quoted-source flag and reason ·
sentence form · segmentation confidence · a non-binding routing hint and why it was given ·
context before and after · canonical start/end offsets · the source link · and blank review
columns (final category, subtype, explanation, confidence, Q-authored, quoted source type, needs
new category, proposed new category, review status).

## Review discipline

- Decide the **full-sentence** category from the drop's context, not from an isolated keyword.
- Distinguish Q-authored text from quoted anon, article, tweet, letter, Scripture or image text.
  The `Quoted / Source Material?` column already flags 767 of them from the certified layer.
- Use the existing destinations first. Propose a new category only for a coherent, recurring group
  that the existing model cannot represent honestly — and report its size, shared function,
  examples, and why each existing category fails.
- Do **not** restore `EMPHASIS` as a catch-all.
- Leave uncertain items `NEEDS_CONTEXT` rather than force-classifying them.
- Nothing here is applied. Rulings come back as filled columns; a materialiser applies them later.
