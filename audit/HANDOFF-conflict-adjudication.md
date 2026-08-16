# Handoff — adjudicate the 840 certification conflicts

Start here. Everything needed is in `audit/coverage-dispositions.json`.

## State of the archive

All eight analytical sections are **certified and frozen**. The canonical source-unit ledger is
complete: **29,569 / 29,569** Q-authored units carry an explicit disposition and
**TRUE_UNCATEGORIZED = 0**.

| Status | Units |
|---|---|
| CERTIFIED_ANALYSIS | 18,349 |
| CONTEXT_OR_LABEL | 4,901 |
| NON_ANALYTICAL_SOURCE_STRUCTURE | 4,190 |
| UNRESOLVED_PENDING_REVIEW | 1,347 |
| SOURCE_OR_REFERENCE | 782 |
| TRUE_UNCATEGORIZED | **0** |

This task is **not** discovery. What is missing from the certified sections is already known and
enumerated. Do not tune classifiers, do not rebuild the ledger, do not reclassify a frozen section.

## The work: 840 conflicts, in this order

| # | Conflict | Count | Note |
|---|---|---|---|
| 1 | Evidence | 21 | space-broken protocol URLs (`https:// twitter.com/…`) — near-automatic |
| 2 | Questions | 2 | manual review |
| 3 | Segmentation | 2 | repair the unit first, then classify |
| 4 | Codes vs Emphasis | 22 | direct review |
| 5 | Directives | 29 | check against the certified imperative/family rules |
| 6 | Claims | 764 | largest and most important |

### Claim verdicts

Each row in `dispositions.CLAIM_CONFLICT` has a null `verdict` to fill with one of:

`ADD_Q_CLAIM` · `KEEP_CONTEXT_OR_LABEL` · `Q_DIRECTIVE` · `Q_QUESTION` · `SOURCE_OR_REFERENCE` ·
`SEGMENTATION_ERROR` · `NEEDS_CONTEXT`

Every row already carries `claimBasis`, which is the reason it reached this list:

| claimBasis | Rows | Meaning |
|---|---|---|
| `answers_previous_question` | 393 | the fragment answers the question on the line above and inherits its subject |
| `predicate_of_previous_subject` | 21 | a predicative word with an antecedent established above |
| `standalone_proposition` | 350 | a full sentence (7+ words) that no section claims |

The 414 context-promoted rows (the first two bases) became candidates **only** because the
preceding line supplied the missing antecedent. `prevLine` is on every one of them — verify the
promotion against that line rather than taking it on trust. Preserve the basis on any row that
becomes a certified claim, so the reasoning stays auditable.

## Hard rules

- **Report proposed count changes before applying anything.** Questions, Directives, Claims,
  Evidence, Codes and Emphasis each need an explicit before/after.
- Re-certification goes through the normal path: adjudication → materialise → QA gate →
  `node scripts/certification-manifest.mjs` → apply → deploy.
- `node scripts/certification-manifest.mjs --verify` is a hard pre-deploy gate and will block any
  change that is not deliberately re-certified. That is intended.
- TRUE_UNCATEGORIZED must stay 0 throughout. Re-run `node scripts/audit-source-coverage.mjs`
  after any change.
- All 119 integrity invariants must keep passing: `node scripts/audit-cross-section.mjs`.

## Deliverables

`audit/coverage-conflicts-adjudicated.md` and `.json`.

## After this

Run the highlight-coverage audit, then add the neutral **Context / Other Q Text** treatment for
the 4,901 reviewed context/label units. That closes the original goal: every meaningful piece of
Q's text categorised, explicitly dispositioned, or openly marked unresolved — and the post itself
visually showing that accounting.

## Known debt that constrains this work

`sourceLines()` over-extends quoted blocks on **123 posts** (`audit/source-boundary-debt.json`).
The adjudicated datasets outrank the detector, so certified sections stay as they are. Fix the
detector and re-adjudicate those posts **before** any Emphasis recount, source-material re-audit,
or new classifier that consumes it.

---

# URGENT — do this BEFORE the 840 conflicts

**Production is showing pre-certification extractor results on the main analysis pages.** Found by
browsing the live site, not by any gate — the certified artifacts are correct and the screens are
not.

| Route | Live shows | Certified |
|---|---|---|
| `/analysis?tab=namedEntities` | 22,363 mentions / 3,593 posts / 2,325 items | 1,332 entities / 7,903 mentions |
| `/analysis?tab=claims` | 5,820 / 2,082 posts | 4,181 / 1,951 |
| `/analysis?tab=requests` | 4,529 / 1,417 posts | 2,422 / 1,417 |
| `/analysis?tab=predictions` | 757 / 546 posts | 630 / 520 |

## Two separate defects

**A — stale postAnalysis fields.** `apply-entities.mjs` and `apply-themes.mjs` wrote their
certified artifacts but never rewrote `postAnalysis.namedEntities` (13,881 legacy entries) or
`postAnalysis.themes` (10,453), which is what the UI reads. `apply-emphasis.mjs` was the only
apply step that did this.

*Partially fixed in this session, NOT deployed.* Themes: 10,453 → 2,393 ✅. Entities: 13,881 →
2,992 ⚠️ — see the blocker below. Claims, Predictions, Directives, Emphasis, Conclusions and
Checkable were already correct in `postAnalysis`.

**BLOCKER:** all 1,239 adjudicated-tail entities ship with `posts: []` — only the 93 core-registry
entities carry post lists (`apply-entities.mjs`, the tail row builder). So rewriting
`postAnalysis.namedEntities` from the certified set covers just the core registry: 1,263 posts
instead of 4,458. **Materialise tail post lists first**, or the Entities page will under-report as
badly as it currently over-reports. Do not deploy the half-migration.

**B — a live client-side extractor.** `getAnalysisFrequency()` in `src/lib/posts.ts` (~line 1440+)
calls `backfillFromText()` and `countPhraseOccurrences()`, re-scanning raw post text for every
phrase at render time. That is what inflates 4,181 → 5,820 and 2,422 → 4,529 even though the
underlying arrays are certified. This is the architecture rule to enforce: a user-facing section
must consume its certified artifact, never re-derive membership in the browser.

## State of the working tree

`posts.json` is half-migrated locally and **nothing was deployed**. The pre-deploy gate is
currently blocking with `artifact posts.json: CONTENT changed` — that is the gate working, and it
must not be bypassed. Either finish the migration and re-certify deliberately, or
`git checkout public/data/posts.json` to return to the deployed state.

## Also required

- Audit every `/analysis?tab=` route: name, component, data source, whether it runs a client-side
  extractor, displayed count vs certified count, PASS / LEGACY / DERIVED.
- Add a UI-provenance invariant group covering the whole chain — sidebar link → route → component
  → selector → artifact → displayed population. Asserting that `entities.json` exists is not
  enough; that check passes today while the page shows 22,363.
- Rename toward the certified taxonomy: Named Entities → Entities, Requests → Directives,
  [ Brackets ] → Codes & Brackets. Conclusions and Checkable Claims are derived claim views.
- Keep frozen counts unchanged. This is a transport/display defect, not evidence the audits erred.

## ANSWERED: where the 3,440 tail mentions came from

Checked before this session ended, so the fresh session does not have to search.

**All 1,306 CANONICAL tail decisions have `storedOccurrences` exactly equal to the legacy
`postAnalysis.namedEntities` count for the same string.** 1,306 / 1,306 — POTUS 370 = 370,
God 204 = 204, QAnon 32 = 32, and so on down the list. Only 616 of the 3,609 tail occurrences have
a mention row in `entities-audit.json`; the rest never had one.

**So the certified tail mentions were adopted wholesale from the legacy extractor's per-post
entries. They were never independently re-derived at occurrence level.**

Two consequences, and both matter:

1. **The provenance exists and can be materialised without a new classifier.** Each legacy entry
   is already a (postNum, sourceText) pair. Walk `postAnalysis.namedEntities`, keep only strings
   the tail adjudication marked CANONICAL, map through the alias merges, and emit occurrence rows
   with postNum + alias text + canonical id + occurrence index. That is a transcription of data
   already used to produce the certified count, not a new extraction — which is what makes it
   legitimate under the frozen-section rule. Verify it reconciles to 3,440 after alias merging
   (the raw CANONICAL sum is 3,609 before merges).

2. **The tail's membership — not its typing — still rests on the legacy extractor.** The
   adjudication passes decided what each tail string *is* and corrected 129 wrong types, but the
   decision that a string was an entity at all, and how many times it occurred, came from the old
   extraction. That is worth raising explicitly before the Entities page is rebuilt on it. It does
   not make the certified count wrong, and it is not a reason to reopen the section — but a
   reviewer should know the tail and the core registry were established by different methods.

## Operational safety rule (added after a real incident)

Avoid broad working-tree operations during this migration. `git checkout public/data/` rolled back
five generated artifacts that had never been committed and dropped the audit to 113/119; they had
to be rebuilt by re-running apply-entities → apply-emphasis → build-resolution-queue →
build-relationships → build-search-index. Restore specific files, and check `git status` before and
after every generated-data operation.
