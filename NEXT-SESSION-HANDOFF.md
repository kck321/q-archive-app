# Q Drops — next session, start here

**Read `PROJECT_CONTEXT.md` first, then this.**

The Step 3B reconciliation is **CLOSED**. Seed 88 is live at https://qdrops.app and verified
in production. Do not reopen the reconciliation machinery.

---

## Where things stand

| | |
|---|---|
| HEAD | see `git log -1` (deployed commit `89ac05d`) |
| production | **seed 88, live and verified** |
| conflict queue | 945 → **50**, actionable **0** |
| invariants | **222/222** |
| validation | full profile green, 21 steps |
| production | **36/36** live assertions |

### Certified counts (manifest, seed 88)

```
questions   6,321      claims       8,676      entities  1,214 canonical / 8,821 mentions
directives  2,940      predictions    843      relationships 4,121 · search index 31,572
```

`claims == claimSpans`, `predictions == predictionSpans`, and the entity registry now equals
the rendered records exactly.

---

## The conflict queue is closed

**50 rows survive and every one carries an explicit reviewed disposition.** Run
`node scripts/report-conflict-reconciliation.mjs` — it exits NON-ZERO if any surviving row
lacks one, which is the actual guarantee.

```
  31 A  KEEP_AS_CERTIFIED           a span that legitimately crosses a line or sentence
   5 B  REPAIR_GEOMETRY             repaired, and the repaired span still crosses
  11 F  INTENTIONALLY_UNRESOLVED    9 owner-directed + 2 waiting on the demonym question
   3 Q  INTENTIONALLY_NON_ACTIONABLE the examined-and-refused lane-A rows
```

**`audit/OWNER-REVIEW.csv` — 18 rows, the only things wanting a decision.** Two are genuinely
open (#48 "the Canadian PM", #1359 "a French multinational" — whether a DEMONYM is a mention
of the country, which would decide Russian/German/Iranian/Chinese too). Nine are the Ruling 3
F rows. Three are the quarantined refusals. Four are applied-and-reversible decisions on drops
that already carried a ruling (#2971, #4454, #4310, #4437).

The reviews themselves are in `audit/lane-b-dispositions-*.json`, five files, one per family,
every row with its reason.

---

## What must not be undone

- **Emphasis · Q Conclusions · Checkable Claims are retired** — data, fields, sections, search
  rows, relationship edges, UI. The retirement is now asserted rather than assumed in
  audit-cross-section.mjs, verify-context-render.mjs, test-category-order.mjs and
  test-returning-profile.mjs. `EMPHASIS_INFO` and the Method page block are gone.
- **The chain order.** `apply-step3b1` → `reconcile-entity-registry` → `build-entity-public-view`
  → `retire-sections`. The public view used to be built BEFORE the duplicate collapse and was
  therefore describing a registry 99 mentions ahead of its own records.
- **The idempotence stamp hashes CONTENT, not bytes.** A Firestore dump and a rebuild order
  postAnalysis keys differently; hashing raw bytes made deploy-after-validate impossible.
- **`lib/step3b1Sets.mjs` is the only copy of the action-set list.** The verifier used to keep
  its own and it went short.

---

## The census is DONE — and it was re-measured on the LIVE SITE

The transcription pass was graded against the rendered DOM over all 4,734 readable drops on
qdrops.app. **Zero false positives** — nothing it called unhighlighted is highlighted on the live
site; it under-reported by 54 lines.

**93.9% of all drop text is painted** (880,245 of 937,048 characters). 330 drops are painted end
to end. **10,700 lines still carry unpainted text, across 4,457 drops — 4,859 distinct wordings.**

Deliverable: `audit/unhighlighted-sentences/unhighlighted-sentence-review.xlsx` (six sheets), with
a dated copy on the Desktop. Read `audit/unhighlighted-sentences/README.md` first.

| Decision | Lines | Wordings |
|---|---:|---:|
| POLICY RULING — one decision settles the population | 4,542 | **7** |
| PAINT POLICY — certified already, the body just does not fill it | 3,342 | 3,042 |
| CLASSIFY — no disposition anywhere in the archive | 1,905 | 1,447 |
| SPAN BOUNDARY FIX — the highlight stops one character short | 911 | 481 |

**Do not mix the first two with the third.** Seven wordings settle 42% of the queue. The PAINT
POLICY rows are already dispositioned and only lack a colour — that is a rendering decision about
context units, codes, evidence and quoted source, not a reclassification.

**Re-measure rather than re-model.** `node scripts/audit-painted-truth.mjs --base https://qdrops.app`
re-crawls the whole archive in ~7 minutes and grades any transcription against it. Never hand over
a leftover list that has not been checked against the page.

**#859 is a data defect:** its text splices a pointer inside a word
(`These peo&gt;&gt;567493ple are stupid.`) so no rendered block matches it. Not yet fixed.

Nothing was applied, rebuilt or deployed. Production stays at seed 88.
