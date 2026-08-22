# Lane C — structural defects, quarantined with evidence

Measured 2026-08-22 from the rebuilt conflict queue (222 rows). Nothing here is applied.

## 1 — IDENTITY_SPLIT_ACROSS_TWO_REGISTRY_GROUPS · 16 rows · BLOCKED, needs an owner ruling

Five real-world identities are carried by the registry as **two canonical rows each**:

| kept twice as | mentions | and as | mentions |
|---|---|---|---|
| `Wray` (alias "Wray") | 7 | `Christopher Wray` (alias "WRAY") | 3 |
| `Whitaker` (alias "Whitaker") | 11 | `Matthew Whitaker` (aliases "WHITAKER", "Matthew Whitaker") | 6 |
| `Pence` (alias "Pence") | 3 | `Mike Pence` (alias "PENCE") | 2 |
| `Awan` (alias "Awan") | 8 | `Imran Awan` (aliases "Imran Awan", "AWAN") | 11 |
| `GANG OF 8` (typed `person`) | 2 | `Gang of Eight` (typed `government_institution`) | 5 |

A lookup cannot choose between two rows for one identity, so it takes whichever registered first
and reports the other's occurrences as unlocatable. That is all 16 rows.

**The merge was attempted and correctly refused, twice, and the second refusal is the real one.**

1. `apply-entities.mjs` first rejected it with *"unmapped audit references: ENT-0115 Whitaker,
   ENT-0161 Awan, ENT-0164 Wray, ENT-0352 Pence, ENT-0653 GANG OF 8"*. Cause: the ENT-crosswalk
   resolved survivors from `stage1.merges` only, so a row the OWNER merged had no survivor. That is
   a fixable defect — teach the crosswalk that an owner merge is also a merge.
2. With that fixed, three certified constants move: detected canonical entities 1,292 → 1,287,
   canonical entities 1,448 → 1,443, adjudicated-tail mentions 3,841 → 3,838. Those are exactly
   "five duplicates merged", and they can move with a recorded reason.
3. **The blocker is the third gate.** `apply-entity-cleanup.mjs --rematerialise` refuses:
   *"the tree is neither the approved before-state (1448/9926)"*. That step re-materialises the
   integrated cleanup the owner approved on 2026-08-17, and the approval is pinned to an exact
   before-state. Merging upstream invalidates the snapshot the approval names.

**This is an owner decision, not an engineering one.** Re-approving the 2026-08-17 cleanup against
a new before-state is a re-certification of an approved migration. Everything was reverted; the
registry is untouched.

## 2 — NO_ALIAS_EVER_REGISTERED · 38 rows · genuine data question

The identity has exactly one registered form and that form does not appear on the drop in any
casing — e.g. `US Senate` (#1094), `Agnes Nixon` (#1211), `Roseanne Barr` (#1863),
`Ray Chandler` (#1054, #1138), `Standard Hotel` (#1203).

Three different things look identical here and only the owner can separate them:

- the alias registry is missing the spelling Q used (a registry gap),
- Q referred to the identity without naming it (a legitimate inference the section recorded),
- the identity should not be on that post at all (a data defect).

No automation can tell these apart, because the evidence that would settle it — what Q meant —
is not in the text. Quarantined rather than guessed.
