# Picture audit — the runbook

**The format is the point.** 850 images are analysed and published; ~840 remain. The next batch
must look and read EXACTLY like the ones already live, or the archive ends up with two standards.
This file exists so that can be reproduced months later without re-deriving anything.

Written 19 Aug 2026, at 850 images compiled, with the audit paused for token budget.

---

## 1. Where everything lives

    audit/picture-audit-500/checkpoint-2026-08-18/
      SPEC.md                 the ENTRY FORMAT. The canonical contract — read it first, follow it exactly.
      batch500.json           rows n=101-600   (the first published 500)
      batch850.json           rows n=601-850   (the second 250)
      build_next250.py        enumerates the archive and emits the NEXT batch file
      make_manifests.py       per-agent manifests for batch500 rows
      make_manifests850.py    per-agent manifests for batch850 rows (handles FETCHED: and video frames)
      fetch_missing.py        pulls rows whose image is not in media-bundle
      merge500.py             check / compile for batch500
      merge850.py             check / compile for batch850
      agent-out/              one JSONL per agent for the 500
      agent-out-850/          one JSONL per agent for the 250
      manifests/              generated per-agent manifests
      fetched/                images recovered when media-bundle lacked them
      vframes/                extracted video frames (nNNN_f0..f2.jpg)

    audit/picture-review.md   the owner's review queue + the PRIVATE withheld table
    public/data/picture-analysis.json   the published artifact (850 images)

## 2. Coverage so far

| batch | sequences | status |
|---|---|---|
| first 100 | n=1-100   | published |
| 500       | n=101-600 | published |
| 250       | n=601-850 | published |
| **next**  | **n=851-**  | **not started** |

The archive holds **1,690 distinct images**. 850 done, ~840 to go.

## 3. Starting the next batch

1. Copy `build_next250.py` to the new range and run it. It REFUSES to emit unless it first
   reproduces every existing row hash-for-hash — that guard is the whole reason the enumeration
   can be trusted, so never remove it.
2. Rows whose `file` is `FETCH` need `fetch_missing.py` (qalerts full-size before thumb, then the
   Wayback Machine). Verify each download decodes before accepting it.
3. Videos: extract 3 frames (start / middle / end) into `vframes/nNNN_f0..2.jpg` with ffmpeg and
   let the manifest carry `framePaths`; the agent analyses the frames as ONE attempt and sets
   `kind: "video"`.

## 4. The loop that produced the current 850 — do not vary it

- Work in **groups of 25**, as **5 agents x 5 images**. Groups are recovery boundaries, not
  stopping points.
- Take the next 25 missing sequence numbers from `merge*.py check`. **They are not always
  consecutive** — always read them from the checker, never assume a range.
- **One model-analysis attempt per image. Never retry an image.** This is what keeps the run
  bounded and the output comparable.
- Each agent appends **one JSON line per image, immediately** after analysing it. Never buffer a
  whole group in memory — a session limit mid-group then costs nothing but the un-attempted images.
- After each group: run `merge*.py check`, then commit with **explicit file paths only**. Never
  `git add -A` — unrelated dirty files must stay out of the audit's commits.
- **Refuse to continue** if duplicates or structural problems are non-zero, a saved record
  disappears, or the checkpoint count goes DOWN.

## 5. The two record shapes that are NOT ordinary analyses

**Blocked by content filtering.** Write exactly this line, add nothing, retry nothing, and describe
the triggering content nowhere:

    {"n": N, "kind": "image", "description": "Analysis withheld.", "text": "", "people": [],
     "orgs": [], "objects": [], "places": [], "terms": [], "flags":
     ["FLAGGED FOR MANUAL REVIEW: analysis withheld"], "confidence": "red",
     "needsReview": true, "ocrStatus": "withheld"}

Then add a row to the **"Withheld analyses"** table in `audit/picture-review.md` (seq, post, hash,
filename, source, `review_required`, `withheld`). Two so far: **308** and **554**.

**Incomplete transcription.** Keep the partial OCR — it is real evidence and must not be thrown
away — summarise per SPEC rule 3, set `needsReview: true`, and add a flag beginning
`FLAGGED FOR MANUAL REVIEW:` that says exactly what is missing. Add a queue row + a short note in
`picture-review.md` describing what a human still has to do.

Both render as **two red dots** on the Picture chip; one red dot means "analysed, subject not
identified". That distinction is load-bearing — do not collapse it.

## 6. Publishing

    python merge850.py check      # must read: 0 gaps, 0 dupes, 0 problems
    python merge850.py compile    # appends into public/data/picture-analysis.json

- **No `SEED_VERSION` bump.** `picture-analysis.json` is NOT in `SEEDED_FILES` — it is fetched at
  runtime, never seeded to IndexedDB, so the seed fingerprint invariant does not apply.
- The deploy bumps the service-worker `CACHE_VERSION`, which is what drops the old cached copy for
  returning readers.
- **The file must be written with LF.** Python text mode on Windows emits CRLF, which made it the
  only CRLF file in `public/data`; git normalises to LF on the gh-pages push, so `verify-live.mjs`
  compared LF against CRLF and could never call them identical. The compile step now opens with
  `newline='\n'` and `.gitattributes` pins `public/data/*.json` to `eol=lf`. Keep both.

## 7. What the numbers should look like

Per-image cost, measured over 51 Fable 5 agents: **~7,700 tokens**; a 25-image group ~205,000
including orchestration. Roughly **1.7%** of images end up `needsReview` — a batch that flags far
more than that means something is wrong with the run, not with the archive.

Current published totals: **850 images, 767 posts, green 699 / yellow 118 / red 33, needsReview 16.**

## 8. Interruptions are normal — this is how they were handled

Session limits, connection drops and a stalled agent all happened during the 850. In every case:
records already appended were kept, only **never-attempted** images were relaunched, and no image
was analysed twice. `merge*.py check` is the arbiter — if it says a sequence is missing, it is
missing; if it reports a duplicate, stop.
