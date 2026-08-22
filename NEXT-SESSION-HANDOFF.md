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

## The next piece of work — and it is a different one

The census. `node scripts/audit-unhighlighted-sentences.mjs` crawls the finished corpus for
Q-authored sentences that still lack visible classification. It was deliberately NOT run as
this pass's final measure: mixing known conflicts into a "what did we miss" population is the
whole reason the reconciliation came first. The queue is closed now, so the census finally
measures unknown misses instead of known ones.

GPT performs the independent live-site residual audit first.
