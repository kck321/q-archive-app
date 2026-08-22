# Q Drops — next session, start here

**Read `PROJECT_CONTEXT.md` first, then this.** This file is the state of the Step 3B
reconciliation as of 2026-08-22 and what is left to do. It is written so the next session can act
inside five minutes.

---

## Where things stand

| | |
|---|---|
| HEAD | `b04419b` |
| branch | `master`, 53 commits ahead of `origin/master`, tree clean |
| local `SEED_VERSION` | **87** |
| production | **still seed 78** — nothing from this work is deployed |
| Step 3B-1 gates | 17/17 pass (`node scripts/verify-step3b1.mjs`) |

### Certified primary counts (all measured, all gated)

```
questions   6,323      claims       8,721      entities  1,235 canonical / 8,975 mentions
directives  2,940      predictions    843
```

`claims == claimSpans` and `predictions == predictionSpans` are asserted by a gate.

### Retired entirely — do not restore

**Q Emphasis · Q Conclusions · Checkable Claims.** Sections, data, highlights, search rows,
relationship edges and rebuild behaviour. `scripts/retire-sections.mjs` is in the chain and strips
them on every rebuild, because `apply-claims.mjs` regenerates two of them from
`audit/claims-final.json` every time it runs. `public/data/emphasis.json` is deleted.

### Conflict queue — rebuilt from canonical state, never by subtraction

```
945  ->  207        lane A 3   ·   lane B 159   ·   lane C 45
```

Rebuild it any time with:

```
node scripts/rebuild-conflict-queue.mjs
node scripts/taxonomize-step3b1-conflicts.mjs --rebuilt
```

The single lane-A row (#4437) is a pasted Ruby code block, refused as multi-sentence prose. **There
is no deterministic work outstanding.**

---

## The four things left, in the order they should happen

### 1. ~~Lane C — the identity merge~~ · **DONE 2026-08-22** (owner rulings 1 & 2)

Five identities merged, occurrences fully preserved (9,926 → 9,926 across the merge; 8,975 after
the cleanup replay). The cleanup guard was **not** weakened — a third `postApprovalDeltas` entry
was recorded beside the 2026-08-17 approval, which is the mechanism that file already documents
for exactly this. Two couplings were fixed by following the identity rather than loosening a check:
the ENT-crosswalk now resolves owner merges, and the cleanup plan resolves retired entity ids
through `audit/entity-ids.json`. See `54b0141`.

### 2. Lane C — the 38 `NO_ALIAS_EVER_REGISTERED` rows · REVIEWED, none applicable

Every row reviewed individually against its drop (`audit/step3b1-entity-review.json`, commit
`b04419b`). Result:

| | |
|---|---|
| **C** 12 | nothing on the drop names the identity — inferred, not written |
| **D** 14 | the only trace is a quoted line or a URL — Vice News, Judicial Watch, Google Trends, Cambridge Dictionary, Yale Medicine, all cited by link |
| **E** 3 | the stored "identity" is a whole SENTENCE (#4875, #4949, #56) — a malformed record |
| **F** 9 | only a fragment of the name appears |
| **B** 0 | **no alias is supportable** |

**A cannot apply to this family** — `NO_ALIAS_EVER_REGISTERED` means the identity *is* registered,
so "the registry has no such entity" is impossible by construction.

**B came out zero, and that is the finding.** A first pass proposed nine aliases off partial-name
matches: "Paris" → Paris Hilton, "2020" → 2020 Presidential Election, "Daily" → Daily Beast,
"Senate" → US Senate — and "Senate" is *already* a registered form of "United States Senate", so
that one would have made a single token name two identities. Invariant 4 in a new costume, and
exactly what "do not bulk-create aliases" was protecting against. A fragment now needs to be ≥60%
of the canonical AND unclaimed by another identity; nine of nine fail.

**Why nothing was applied.** All 29 C/D/E rows resolve to withdrawing an entity *occurrence*, and
the only path for that is `audit/occurrence-provenance-audit.json` — the input to the migration the
owner approved on 2026-08-17. Adding withdrawals there re-adjudicates an approved migration and
moves its occurrence total, which the plan builder checks against `entities.totals.mentions`.
**That is an owner decision of the same kind as Ruling 2.**

### 3. Lane B — 159 genuine semantic decisions · NOT YET ADJUDICATED

| rows | family |
|---|---|
| ~52 | `BOUNDARY_CROSSING::MULTI_LINE_SPAN` — one span over two prose lines |
| ~32 | `CASE_VARIANT_REFUSED_E` — the casing appears on drops that do not record the identity |
| ~26 | `BOUNDARY_CROSSING::WITHIN_LINE_CROSSING` |
| ~19 | `SAME_CATEGORY_PARTIAL_OVERLAP` |
| ~12 | `CASE_VARIANT_REFUSED_C` — competing candidates, the ordinal is a guess |
| rest | quoted-material, absent-identity and question-literal rows |

Every row carries its refusal reason in `audit/step3b1-conflict-taxonomy-rebuilt.json`. The owner's
standing instruction: **a multi-line or within-line crossing is not automatically a defect** — if a
legitimate semantic unit intentionally spans lines, preserve it and mark it an intentional
certified span rather than chopping it to satisfy a sentence boundary. Only repair geometry where a
span accidentally swallowed quoted material, a URL, neighbouring prose or another sentence.

### 4. Deploy · AUTHORIZED BUT NOT DONE

The owner authorized deployment **conditional on certification passing**. It does not yet:

- `node scripts/validate.mjs` stops at the certification manifest, which is pinned at **seed 80**
  while local is 87. It needs re-certifying (`scripts/certification-manifest.mjs` without
  `--verify`) once the bundle is final.
- `scripts/deploy-web.sh` runs `export-firestore.mjs` first (**invariant 2**), which needs live
  Firestore and re-applies the whole chain. That chain now includes `retire-sections.mjs` and
  `apply-step3b1.mjs`, so it should come out the same — but it has never been run end to end.

**Do not deploy until both are green.** Production is nine seeds behind; one more careful pass is
cheaper than a bad publish.

---

## How the machinery fits together

Everything applies through **one applier**, `scripts/apply-step3b1.mjs`, so every batch inherits
every gate. It reads:

| artifact | what it is |
|---|---|
| `audit/step3b1-plan.jsonl` | the reviewed 540 (530 automatic + 10 held) |
| `audit/step3b1-held-dispositions.jsonl` | supersedes held rows by `actionId` — 8 applied, 2 still held |
| `audit/step3b1-b2-actions.jsonl` | boundary repairs — 144 |
| `audit/step3b1-b2b-actions.jsonl` | collisions the trims uncovered — 3 |
| `audit/step3b1-b2c-actions.jsonl` | spaced-protocol link lines — 2 |
| `audit/step3b1-b3-actions.jsonl` | segmentation recoveries — 3 |

Every one is **pinned by sha256** in `EXTRA_ACTION_SETS` / the two constants at the top. Change a
file and the applier refuses until you update the pin — that is deliberate.

### Traps this session paid for

- **The applier is only safe on a full rebuild or its own exact output.** A partial rebuild made
  `FIGHT! FIGHT! FIGHT!` siblings slide into vacated offsets and lost four legitimate repeats.
  Removal families now carry a **slot witness** (how many entries with that text the field should
  hold afterwards) instead of relying on a file hash.
- **`claims` and `claimSpans` are one section in two index-aligned views.** The renderer paints
  `claimSpans ?? claims`; `contracts.mjs` counts `claims`. Edit one without the other and the count
  stops describing the pixels. There is a gate for it now.
- **An action can own more than one overlay row** (#34's clause partition owns two). `priorByAction`
  is keyed to a list.
- **A span can hold more than one record and only one may be the mistake.** #2971 and #4454 each
  carry a segmentation recovery AND an owner-ruling queue record over the same characters. Actions
  can name a `targetQuestionId`.
- **The Bash tool eats backslashes in heredocs.** Write patch scripts with the Write tool, or build
  regexes with `String.fromCharCode(92)`.

### The census — the actual goal

`node scripts/audit-unhighlighted-sentences.mjs` is the tool. It used to count emphasis as coverage
and had an `F_CERTIFIED_EMPHASIS_NOT_PAINTED` bucket; both are gone, so it now measures what a
reader actually sees. **Do not run it as the final census until the queue is closed** — it would
mix known conflicts into the "what did we miss" population, which is the whole reason for this
reconciliation.
