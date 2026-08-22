# Q Drops — next session, start here

**Read `PROJECT_CONTEXT.md` first, then this.** This file is the state of the Step 3B
reconciliation as of 2026-08-22 and what is left to do. It is written so the next session can act
inside five minutes.

---

## Where things stand

| | |
|---|---|
| HEAD | `ae3ad18` |
| branch | `master`, 50 commits ahead of `origin/master`, tree clean |
| local `SEED_VERSION` | **87** |
| production | **still seed 78** — nothing from this work is deployed |
| Step 3B-1 gates | 17/17 pass (`node scripts/verify-step3b1.mjs`) |

### Certified primary counts (all measured, all gated)

```
questions   6,323      claims       8,721
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
945  ->  220        lane A 1   ·   lane B 158   ·   lane C 61
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

### 1. Lane C — the identity merge (16 rows) · BLOCKED ON AN OWNER RULING

Five identities are in the registry twice: `Wray`/`Christopher Wray`, `Whitaker`/`Matthew
Whitaker`, `Pence`/`Mike Pence`, `Awan`/`Imran Awan`, `GANG OF 8`/`Gang of Eight`.

The merge was attempted and **correctly refused**. Full evidence in
`audit/step3b1-lane-c-quarantine.md`. The blocker, precisely:

> `apply-entity-cleanup.mjs --rematerialise` refuses with *"the tree is neither the approved
> before-state (1448/9926)"*. That step re-materialises the integrated cleanup the owner approved
> on **2026-08-17**, and the approval is pinned to an exact before-state. Merging upstream
> invalidates the snapshot the approval names.

Re-approving an approved migration against a new before-state is the owner's call. Two smaller
fixes are already known-good and were reverted with it: teaching the ENT-crosswalk that an owner
merge is also a merge, and moving three certified constants (1,292→1,287, 1,448→1,443,
3,841→3,838) which are exactly "five duplicates merged".

### 2. Lane C — `NO_ALIAS_EVER_REGISTERED` (38 rows) · needs the owner

The identity has one registered form and it appears on the drop in no casing — `US Senate`,
`Agnes Nixon`, `Roseanne Barr`, `Ray Chandler`, `Standard Hotel`. Three different things look
identical: a registry gap, a legitimate inference where Q named nobody, or an identity that should
not be on the post. The evidence that separates them is not in the text.

### 3. Lane B — 158 genuine semantic decisions

| rows | family |
|---|---|
| 52 | `BOUNDARY_CROSSING::MULTI_LINE_SPAN` — one span over two prose lines |
| 32 | `CASE_VARIANT_REFUSED_E` — the casing appears on drops that do not record the identity |
| 26 | `BOUNDARY_CROSSING::WITHIN_LINE_CROSSING` |
| 19 | `SAME_CATEGORY_PARTIAL_OVERLAP` |
| 12 | `CASE_VARIANT_REFUSED_C` — competing candidates, the ordinal is a guess |
| 17 | the remainder — quoted-material, absent-identity and question-literal rows |

Every row carries its refusal reason in `audit/step3b1-conflict-taxonomy-rebuilt.json`.

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
