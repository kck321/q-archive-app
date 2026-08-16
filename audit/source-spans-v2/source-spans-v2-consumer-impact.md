# sourceSpansV2 — downstream consumer impact matrix

**SHADOW MODE. NO CONSUMER WAS MIGRATED. `sourceLines()` is unchanged and every consumer still calls it.**

## What "potentially changed" counts

The 4,966-post shadow diff moves **2355** non-blank body lines. They are not equal in weight:

- **1626** are `>>NNNNNNN` board pointers that sourceLines() left unlabelled and V2 labels as pointers. A pointer carries no analysable prose, so no consumer's records live on one. This is a definitional change, not a semantic one.
- **729** are semantic: a line that carried prose changed sides.
- Of those, **642** move quoted → Q body (text returned to Q) and **75** move Q body → quoted (text taken away from Q).
- **179** posts carry at least one semantic change.

## Matrix

| # | consumer | file | records | potentially changed | certified output changes? | current pin | projected | editorial review? |
|---:|---|---|---:|---:|---|---|---|---|
| 1 | **Directives** | `scripts/audit-directives-v2.mjs · scripts/audit-directives-religious.mjs · scripts/apply-directives.mjs` | 2705 | 83 | YES | 2705 occurrences | 2705 occurrences unchanged; 2509 KEEP, 83 rulings move | YES — every ruling change is an editorial decision |
| 2 | **Questions** | `scripts/audit-all-questions-v2.mjs (FROZEN — carries its own copy of segment.mjs)` | 6577 | 127 | YES | 6443 occurrences (6577 rows shipped) | 6577 … 6577 | YES |
| 3 | **Claims** | `scripts/audit-claims.mjs (imports sourceLines + unitIsSource)` | 4242 | 164 | YES | 4242 claims | 4242 ± 164 | YES |
| 4 | **Codes** | `scripts/audit-codes.mjs` | 1949 | 139 | YES | 1949 occurrences, 739 codes | 1949 ± 139 | YES |
| 5 | **Emphasis** | `scripts/audit-emphasis.mjs` | 3112 | 12 | YES | 3112 occurrences | 3112 ± 12 | YES |
| 6 | **Entities** | `scripts/audit-entities.mjs` | 9250 | 409 | YES | 1358 canonical / 9250 mentions | 1358 canonical; mentions ± the 409 entities touching a changed post | YES — mention counts are published figures |
| 7 | **Themes** | `scripts/audit-themes.mjs` | 2644 | 142 | YES | 2644 assignments across 1898 posts | 2644 ± anchors on the 142 affected posts | YES |
| 8 | **Themes coverage** | `scripts/audit-themes-coverage.mjs` | 2644 | 179 | NO — reporting only | no pinned count (diagnostic output) | coverage percentages shift with the 642 quoted → Q body lines | NO |
| 9 | **Source coverage** | `scripts/audit-source-coverage.mjs` | 29569 | 2355 | NO — reporting only | no pinned count (diagnostic output) | every one of the 2355 changed lines re-buckets here by construction | NO |
| 10 | **Parallel phrasing** | `scripts/adjudicate-parallel.mjs` | 591 | 0 | NO | 591 parallel_phrasing occurrences inside the 3112 emphasis pin | 591 ± 0 | NO |
| 11 | **Directives reconciliation** | `scripts/reconcile-directives.mjs` | 2705 | 83 | NO — reporting only | quotes 2,652 mentions / 1,538 posts as the page figure | 2,651 mentions / 1,538 posts, fully derived (see directives-page-count-reconciliation.md) | YES — the quoted page figure is one too high |
| 12 | **Cross-section invariant gate** | `scripts/audit-cross-section.mjs` | 138 | all of them, indirectly | N/A — it verifies, it does not publish | 138 invariants | 138 invariants, re-derived | NO |
| 13 | **Contracts & debt registry** | `scripts/lib/contracts.mjs` | 1 | 1 | NO | source-boundary debt: 123 posts | the debt is DISCHARGED by V2 — the URL-after-quoted-sentence case is now two spans | YES — closing a debt baseline is an owner decision |
| 14 | **sourceLines() definition** | `scripts/lib/quotedBlocks.mjs` | n/a | n/a | NO — unchanged this session | n/a | unchanged; V2 lives in scripts/lib/sourceSpansV2.mjs alongside it | NO |
| 15 | **Resolution Center queue** | `scripts/build-resolution-queue.mjs` | 755 | 2 | YES | 755 open items (seed 71) | 755 − 2 v3 directive holds + 3 v4 directive holds = 756 | YES |

## Purpose and notes, per consumer

### 1. Directives

- **File:** `scripts/audit-directives-v2.mjs · scripts/audit-directives-religious.mjs · scripts/apply-directives.mjs`
- **What sourceLines() does there:** Decides whether a stored actionRequest sits on a Q-authored line or inside a quoted block, and rules on it.
- **Note:** 54 records move REMOVE_QUOTED_OR_THIRD_PARTY → KEEP_Q_DIRECTIVE; 19 previously NOT_LOCATED records now locate; NEEDS_CONTEXT falls 21 → 2.

### 2. Questions

- **File:** `scripts/audit-all-questions-v2.mjs (FROZEN — carries its own copy of segment.mjs)`
- **What sourceLines() does there:** Excludes quoted/anon lines before extracting question units, so an anon question never becomes Q's.
- **Note:** FROZEN auditor. It must be unfrozen and re-pointed at segment.mjs before any migration, per its own header.

### 3. Claims

- **File:** `scripts/audit-claims.mjs (imports sourceLines + unitIsSource)`
- **What sourceLines() does there:** Files a claim as QUOTED_SOURCE instead of a Q assertion when its unit falls inside a source block.
- **Note:** The Declaration/1 Corinthians leak this file was built to stop is unaffected — V2 keeps every scripture and founding-document seed and adds five more.

### 4. Codes

- **File:** `scripts/audit-codes.mjs`
- **What sourceLines() does there:** Skips bracketed tokens that sit on quoted lines so a pasted article's brackets never become Q notation.
- **Note:** V2 marks 1,626 `>>NNNNNNN` pointer lines as pointers. Those lines carry no bracket tokens, so the practical exposure is the 642 lines moving quoted → Q body.

### 5. Emphasis

- **File:** `scripts/audit-emphasis.mjs`
- **What sourceLines() does there:** Emphasis is only counted on Q-authored lines — a pasted article in caps is not Q shouting.
- **Note:** Emphasis already excludes 932 occurrences as quotedSource. That exclusion set is drawn straight from sourceLines() and is the largest single quantity a migration would move.

### 6. Entities

- **File:** `scripts/audit-entities.mjs`
- **What sourceLines() does there:** A name inside quoted material is not Q naming it — the source map gates mention attribution.
- **Note:** Counted at ENTITY granularity, not mention granularity: an entity is listed if any of its posts has a semantically changed line.

### 7. Themes

- **File:** `scripts/audit-themes.mjs`
- **What sourceLines() does there:** Theme anchors are matched against Q-authored lines only.
- **Note:** Seed 70 has just shipped the Subject-theme resolutions. A themes re-run must not be started until that deployment is settled.

### 8. Themes coverage

- **File:** `scripts/audit-themes-coverage.mjs`
- **What sourceLines() does there:** Measures the legacy-only theme gap; uses the source map to decide which lines could carry an anchor.
- **Note:** Diagnostic. Re-run after Themes, never before.

### 9. Source coverage

- **File:** `scripts/audit-source-coverage.mjs`
- **What sourceLines() does there:** Reports which post lines are covered by some certified unit and which are source material.
- **Note:** This is the consumer that changes MOST and matters LEAST — it exists to describe the source map, so it moves whenever the source map moves.

### 10. Parallel phrasing

- **File:** `scripts/adjudicate-parallel.mjs`
- **What sourceLines() does there:** Detects repeated grammatical shapes; excludes quoted lines so a pasted list is not read as Q's cadence.
- **Note:** Not independently pinned — it ships inside emphasis.json, so it migrates with Emphasis or not at all.

### 11. Directives reconciliation

- **File:** `scripts/reconcile-directives.mjs`
- **What sourceLines() does there:** Explains the stored-vs-page count gap and regression-tests the authorship detector.
- **Note:** Its regression suite asserts #147 "Pray." appears in the QUOTED block. V2 agrees, by a different route: the phrase is absent from #147's body and present in the reproduced payload of #146.

### 12. Cross-section invariant gate

- **File:** `scripts/audit-cross-section.mjs`
- **What sourceLines() does there:** The gate. Verifies section isolation and source-material handling across all 8 sections.
- **Note:** MIGRATES LAST, and never in the same commit as the classifications it verifies. A gate rewritten alongside the data it checks proves nothing.

### 13. Contracts & debt registry

- **File:** `scripts/lib/contracts.mjs`
- **What sourceLines() does there:** Records the known sourceLines() over-extension debt (123 posts) and names its prerequisites.
- **Note:** It already lists "any new classifier that consumes sourceLines()" as a prerequisite holder. sourceSpansV2 is that classifier.

### 14. sourceLines() definition

- **File:** `scripts/lib/quotedBlocks.mjs`
- **What sourceLines() does there:** The shared block-level detector every consumer above imports.
- **Note:** Verified byte-identical to HEAD at the end of this session.

### 15. Resolution Center queue

- **File:** `scripts/build-resolution-queue.mjs`
- **What sourceLines() does there:** Collects everything the adjudications refused to guess, including NEEDS_CONTEXT directives.
- **Note:** Queue length n/a in the shipped artifact. This figure is read live from the manifest — it moved from 958 to 755 when a separate session certified seed 71 mid-audit.

## Migration order

Not started, and not to be started from this session. The order the evidence supports:

1. **Directives** alone, because it is the only consumer whose defects are already adjudicated fixture-by-fixture.
2. **Emphasis**, because its 932-occurrence `quotedSource` exclusion is the largest single quantity drawn from sourceLines().
3. **Claims → Entities → Themes → Codes**, each with its own owner review of the moved records.
4. **Questions** only after its frozen auditor is unfrozen and re-pointed at `segment.mjs`.
5. **The cross-section invariant gate LAST**, and never in the same commit as the classifications it verifies.
