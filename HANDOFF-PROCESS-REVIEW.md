# Handoff: where the time goes, and what is dead

**Written 17 Aug 2026 at the owner's request, to be handed to another model for a process
review.** Everything below is MEASURED on this machine today, not estimated, except where a
line says otherwise.

The question being answered: *why does one small request take so long to reach the live site,
and what can we cut?*

---

## 1. The measured cost of shipping one change

Every change — a one-line colour tweak included — currently pays this:

| Step | Time | Notes |
|---|---:|---|
| Data gates (manifest, 223 invariants, seed fingerprint, 4 pure matchers) | **6s** | cheap; keep all of it |
| Full apply chain, `rebuild-bundle.mjs` | **15s** | reproduces `public/data` byte-identically |
| `vite build` | **19s** | |
| **Local browser proof** (`verify-final.mjs`) | **~12.5 min** | 9 browser gates |
| Push + GitHub Pages build | **1–2 min** | normally 33–75s; see §4 |
| **Live browser proof** (`verify-final.mjs --live`) | **12.4 min** | the same 9 gates again, against production |
| **Total** | **≈ 27 min** | |

### The browser proof, gate by gate

Timings printed by `verify-final` itself on the live run of 17 Aug 2026.

| Gate | Time | Fixed sleeps declared in it |
|---|---:|---|
| `test-month-chart-behaviour.mjs` | **371.9s** | 22.4s, **× 16 page loads** |
| `test-category-order.mjs` | 140.4s | none |
| `test-multiword-gloss.mjs` | 95.6s | none |
| `test-entity-reconciliation.mjs` | **65.3s** | **49.5s** |
| `test-returning-profile.mjs` | 38.1s | — |
| `test-term-info.mjs` | 18.7s | none |
| `test-alias-visibility.mjs` | 5.3s | none |
| `test-hover-accessibility.mjs` | 4.5s | none |
| `test-inline-drop-reader.mjs` | 3.9s | none |

**437 of those 744 seconds are the two gates added on 17 Aug 2026, in the session that
produced this file.** Before that day the live proof was ~5.1 min and the whole cycle ~11 min.
The deploy cost was roughly **2.4×'d** while fixing the entity list. That is the single
biggest regression in this table and the first thing to fix.

---

## 2. Where the fat is — ranked, with the fix

### 2.1 Two new gates wait on a clock instead of a condition (≈10 min/deploy)

`scripts/lib/browser.mjs` already solves this. It exposes:

    waitFor(expression, { timeout = 45000, every = 400 })   // poll until truthy
    ROWS_READY   // "the archive is ready when its rows exist — not when the clock says so"

Every older gate uses it and declares **zero** fixed sleeps. The two gates added on 17 Aug
(`test-month-chart-behaviour.mjs`, `test-entity-reconciliation.mjs`) hand-roll their own CDP
session and use `sleep(14000)` / `sleep(20000)` instead. That is waiting, not work.

**Fix:** rewrite both onto `lib/browser.mjs` + `waitFor`. A 14s settle becomes ~2–3s. On the
month gate that is 16 page loads × ~11s ≈ **176s saved**; the per-step `sleep(2500)` after each
key press becomes a `waitFor` on the selection actually changing.

### 2.2 The month gate proves one shared module 16 times (≈5 min/deploy)

It sweeps 7 Analysis categories + the Archive × desktop + mobile. But the behaviour is now a
**single shared module** (`src/lib/monthFilter.ts` + `src/components/MonthFilter.tsx`) — testing
all 7 categories runs the same code 7 times.

**Fix:** default to 1 representative category + the Archive × 2 viewports (4 surfaces); put the
full 16-surface sweep behind `--full` for a weekly or pre-release run. An `--only <cat>` flag
already exists.

### 2.3 The live proof re-runs the entire local proof (≈6 min/deploy)

`verify-final.mjs --live` repeats all 9 gates against production. Most cannot differ between a
local `vite preview` of `dist/` and the same `dist/` served by Pages — they test app logic, not
delivery.

**Fix:** the live pass only needs gates that can fail *because of delivery*:
`test-returning-profile.mjs` (the seed / service-worker path, the one that has actually failed
in production) plus a cheap smoke check that new artifacts are served. Keep the rest local-only.

### 2.4 The deploy force-pushes 28 MB to `gh-pages` every time

`dist/data` is 28 MB. Three of those files are **never fetched by the app** (§3.2) — 1.6 MB of
pure deploy tax. `posts.json` (9.4 MB) and `search-index.json` (7 MB) are legitimately needed.

**Fix:** stop copying build-only artifacts into `dist/data`.

### 2.5 Keep: the run-the-chain-twice rule

`PROJECT_CONTEXT.md` requires running the full chain twice at a deployment checkpoint. The chain
is 15s, so this costs 30s. **Cheap and worth keeping** — listed here only so a reviewer does not
cut it by mistake.

---

## 3. Dead items

### 3.1 Scripts: 65 of 141 are referenced by nothing

Not all are dead — some are hand-run tools the docs tell you to use (`snapshot.mjs`,
`add-alias.mjs`, `test-archive-alias-visibility.mjs`, `verify-section-headlines.mjs`). The
genuinely spent ones are **one-shot migrations and adjudications whose output is already
committed under `audit/`**:

    apply-2774-delta-q.mjs      apply-h-1589.mjs            apply-qplus.mjs
    apply-device-audit.mjs      apply-device-audit-v2.mjs   apply-subject-audit.mjs
    migrate-directives-v5.mjs   apply-directives-v5-canonical.mjs
    audit-directives.mjs        audit-directives-v4-shadow.mjs
    audit-directives-v5-final.mjs
    adjudicate-claims.mjs       adjudicate-questions.mjs    adjudicate-conflicts.mjs
    adjudicate-directives.mjs   adjudicate-directives-queues.mjs
    adjudicate-stored-uncovered.mjs   adjudicate-uncovered-questions.mjs
    parse-religious-audit.mjs   classify-religious-audit.mjs
    export-religious-rejected.mjs
    reconcile-claims.mjs        reconcile-distinct.mjs      finalize-questions.mjs
    finalize-questions-context.mjs    certify-directives.mjs

These do not slow a deploy — nothing runs them. They slow a **human or model reading the repo**,
which is the more expensive cost here. Suggested: move to `scripts/attic/` with a README saying
"already applied, kept for provenance". **Do not delete** — several are the only record of how a
certified figure was reached.

### 3.2 Data shipped to production that the app never fetches

The app requests exactly: `posts, questions, topics, resources, analysisConfirmed, infographs,
aliases, entities, entity-public-view, entity-hovers, evidence, glossary, linked-sources,
relationships, resolution-queue, search-index`.

Shipped anyway:

| File | Size | Status |
|---|---:|---|
| `emphasis.json` | 892 KB | build/gate input only |
| `themes.json` | 481 KB | build/gate input only |
| `codes.json` | 207 KB | build/gate input only |
| `manifest.json` | <1 KB | build/gate input only |

**1.6 MB of deploy payload for zero visitor benefit.** They are NOT downloaded by visitors —
nothing requests them — so this is a deploy-time cost, not a page-load cost.

### 3.3 Two empty artifacts still fetched on every fresh load

`infographs.json` and `resources.json` are **2 bytes each**. The sections that used them
(Infographs, Resources) were removed, but `src/lib/localData.ts:638-643` still fetches both
during seeding. Two pointless round trips on every first visit.

### 3.4 Repo weight

| Path | Size | In git? |
|---|---:|---|
| `.git` | 232 MB | — |
| `.snapshots` | 222 MB | gitignored, local only |
| `audit/` | 106 MB | **tracked** |
| `audit/source-spans-v2` | 18 MB | tracked |
| `audit/preserved-lanes` | 12 MB | tracked |
| `audit/backups` | 8.9 MB | tracked |
| `public/data` | 28 MB | tracked |

`audit/` at 106 MB tracked is why clones and pushes are slow. Several single files are
multi-megabyte intermediates: `claims-audit.json` 6.8 MB, `entity-hover-review-queue.json`
6.1 MB, `claims-adjudicated.json` 4.9 MB, `questions-audit-v2.json` 3.7 MB,
`questions-adjudication.json` 3.7 MB. Worth deciding which are still chain inputs versus
superseded intermediates. `.snapshots` at 222 MB is already correctly gitignored and can simply
be pruned on disk.

**Caution for whoever acts on this:** `scripts/.cache/references.jsonl` is *source data*, not a
cache — it is the only copy of the quoted-post content behind every `>>NNNNNNN` pointer. Deleting
it silently blanks 205 drops. See `PROJECT_CONTEXT.md` invariant 8.

### 3.5 Known-parked items (from PROJECT_CONTEXT, not new findings)

- Dashboard still ships publicly — the owner's explicit choice, to be pulled last.
- Wallet addresses are empty, so the Support page renders blank.
- The editing build's Firestore sync is denied by the deployed rules, so new edits no longer
  reach `postEdits` and the export cannot bake them.

---

## 4. One non-repo cause, for completeness

On 17 Aug 2026 a GitHub Pages build sat queued ~45 min with no progress (normal: 33–75s). An
earlier build the same day showed the identical signature and errored after 66 min. Re-running
the deploy superseded it and it built normally. This is GitHub-side, not caused by anything in
the repo — but if a deploy appears to hang, check

    gh api repos/kck321/q-archive-app/pages/builds/latest

and re-push rather than waiting.

---

## 5. Suggested target

| | now | after §2.1–2.3 |
|---|---:|---:|
| Local proof | 12.5 min | ~3 min |
| Live proof | 12.4 min | ~1 min |
| **Total per deploy** | **~27 min** | **~6 min** |

None of that requires weakening a gate. It requires waiting on conditions instead of clocks,
not proving one shared module seven times, and not re-running logic tests against production
when only delivery can differ.

---

## 6. The full request history

`DEVLOG.md` (4,840 lines, 149 entries) is the chronological record — every request and what was
done about it. The index below is every entry heading with its `DEVLOG.md` line number, so a
reviewer can jump straight to any one.

| # | DEVLOG line | Entry |
|---:|---:|---|
| 1 | 8 | Session 1 — Initial Build (Phase 1–2) |
| 2 | 44 | Session 2 — Post Analysis Feature |
| 3 | 76 | Session 3 — Overlaps, Confirmations, Flash Effects, Colors |
| 4 | 121 | Session 4 — Dashboard Expansion + Analysis Sidebar Links |
| 5 | 216 | Session 5 — Link Rendering + Q School Fix |
| 6 | 236 | Session 6 — Constant Category Flash Animations + QRequests Highlight Links |
| 7 | 258 | Session 7 — Three New Zero-Cost Highlight Scanners |
| 8 | 272 | Architecture Reference |
| 9 | 326 | Session — Q [Brackets] Chart + Post Archive Improvements |
| 10 | 340 | Session — Chart UX, Stats in Post Archive, Q Classification + 8kun Threads + Q Tripcodes Page |
| 11 | 409 | Session 8 — 8kun CORS Fix |
| 12 | 418 | Session 9 — Entity/Item Reader Feed |
| 13 | 448 | Session 10 — Offline / Desktop (Tauri) migration |
| 14 | 486 | Session 11 — AI Research Workers (Q-proof verification platform) |
| 15 | 542 | 2026-06-26 — Permanent phone link (GitHub Pages hosting) |
| 16 | 559 | 2026-06-27 — Red highlight for clicked topic (phone + desktop) |
| 17 | 567 | 2026-06-27 — Chart legend removed + balloon-bubble tooltip (v0.2.2) |
| 18 | 577 | 2026-06-27 — More visible scrollbar + per-tab connection counts (v0.2.3) |
| 19 | 586 | 2026-06-27 — Back button on category pages + removed redundant stat cards (v0.2.4) |
| 20 | 596 | 2026-06-27 — Hover-preview chart tabs (v0.2.5) |
| 21 | 603 | 2026-06-27 — Tripcode Activity Timeline / Gantt chart (v0.2.6) |
| 22 | 610 | 2026-06-27 — Date-aware search (v0.2.7) |
| 23 | 617 | 2026-06-27 — Admin-gated bulk classify across matching posts (v0.2.8) |
| 24 | 626 | 2026-06-27 — Theme highlighting + admin-gated Analyze + uncategorized-repeats scanner (v0.2.9) |
| 25 | 636 | 2026-06-27 — App-wide Admin Mode + Questions row + theme highlight confirm (v0.3.0) |
| 26 | 648 | 2026-06-27 — PostCard editor: PIN gate + theme highlight + Questions row (v0.3.1) |
| 27 | 660 | 2026-06-27 — Cross-device edit sync (v0.3.2) |
| 28 | 672 | 2026-06-27 — One-time local-edits → cloud migration (v0.3.3) |
| 29 | 679 | 2026-06-27 — Upgraded uncategorized scanner, pinned to top (v0.3.4) |
| 30 | 689 | 2026-06-27 — Scanner: multi-word phrase detection (v0.3.5) |
| 31 | 696 | 2026-06-27 — Scanner discoverability fix (v0.3.6) |
| 32 | 703 | 2026-06-27 — Dashboard "Uncategorized content scan" (v0.3.7) |
| 33 | 714 | 2026-06-27 — Undo classifications (v0.3.8) |
| 34 | 723 | 2026-06-27 — Reader post-number opens single post with highlight (v0.3.9) |
| 35 | 730 | 2026-06-27 — Bulk "add all" for questions (v0.4.0) |
| 36 | 740 | 2026-06-27 — Post Analysis panel: always-on Requests + Brackets add-rows (v0.4.1) |
| 37 | 752 | 2026-06-27 — Bulk "add all" for Requests & Brackets (v0.4.2) |
| 38 | 761 | 2026-06-27 — Mixed-case bracket highlighting (v0.4.3) |
| 39 | 768 | 2026-06-27 — External post links open in browser (v0.4.4) |
| 40 | 778 | 2026-06-27 — Auto-scroll to month breakdown (v0.4.5) |
| 41 | 787 | 2026-06-27 — Entity/tag aliases (v0.4.6) |
| 42 | 799 | 2026-06-27 — Aliases auto-fill from highlighted text (v0.4.7) |
| 43 | 806 | 2026-06-27 — Alias connections in entity list + connect known names (v0.4.8) |
| 44 | 817 | 2026-06-27 — Merged alias post count + reader highlights aliases in red (v0.4.9) |
| 45 | 826 | 2026-06-27 — Alias-aware search (v0.5.0) |
| 46 | 836 | 2026-06-27 — Search results: post-number chips (v0.5.1) |
| 47 | 843 | 2026-06-27 — Search result opens post with term+aliases in red (v0.5.2) |
| 48 | 850 | 2026-06-27 — Search highlight flashes red & white (v0.5.3) |
| 49 | 857 | 2026-06-27 — Alias-search breakdown + exact-term-first chips (v0.5.4) |
| 50 | 864 | 2026-06-27 — Exact-term full posts shown first (v0.5.5) |
| 51 | 871 | 2026-06-27 — Entity-list search matches aliases (v0.5.6) |
| 52 | 878 | 2026-06-27 — Q Brackets chart tab + brighter yellow hooks (v0.5.7) |
| 53 | 887 | 2026-06-27 — Brackets timeline bars + universal colors (v0.5.8) |
| 54 | 896 | 2026-06-27 — Occurrence-aware question de-duplication (v0.5.9) |
| 55 | 905 | 2026-06-27 — Within-post dup cleanup for requests/analysis (v0.6.0) + full audit |
| 56 | 911 | v0.6.1 — Fresh-eyes cleanup pass (A + B + C) |
| 57 | 938 | v0.6.2 — Per-alias highlight colors in the Entities reader |
| 58 | 952 | v0.6.3 — Per-alias colors on the Entities post-chip grid |
| 59 | 966 | v0.6.4 — Entity alias-count fix + search alias highlighting |
| 60 | 982 | v0.6.5 — Post Archive search color-codes aliases (matches Entities) |
| 61 | 996 | v0.6.6 — Robust Back button (return to search/list without starting over) |
| 62 | 1010 | v0.6.7 — Connect aliases from the Post Archive "Edit Analysis" editor |
| 63 | 1023 | v0.6.8 — Aliases merge into the whole group on connect |
| 64 | 1039 | v0.6.9 — Pre-launch trim, category rename, and real source links |
| 65 | 1092 | v0.7.0 — Read-only public build + item-text normalization |
| 66 | 1160 | v0.7.1 — Category counts mean "posts containing the phrase", clickable chips |
| 67 | 1209 | v0.7.2 — Backfill for Requests/Questions, search-filtered charts everywhere |
| 68 | 1244 | v0.7.3 — Rare search hits are visible on the timeline |
| 69 | 1275 | v0.7.4 — Flag an issue from the bottom of a post |
| 70 | 1301 | v0.7.5 — Always show ×1, and make the header tally match the rows |
| 71 | 1326 | v0.7.6 — Section totals, rank numbers, colored tooltips, label headroom |
| 72 | 1356 | v0.7.7 — Questions chart matches the others; duplicate counts removed |
| 73 | 1380 | PUBLIC LAUNCH — parked decisions & pre-launch checklist |
| 74 | 1592 | Reference recovery — quoted post content (Aug 11, 2026) |
| 75 | 1642 | Truth audit vs qalerts + clickable links (Aug 12, 2026) |
| 76 | 1686 | Q Emphasis — certified (section 8 of 8) |
| 77 | 1729 | Whole-app cross-section integrity audit |
| 78 | 1776 | Entity metric ruling + source-boundary debt recorded |
| 79 | 1808 | Resolution Center usability — pass 1 |
| 80 | 1855 | Cross-section relationships + post-level Analysis Map |
| 81 | 1903 | Global search + filtering |
| 82 | 1942 | Canonical source-unit coverage — the number that had never been calculated |
| 83 | 1983 | Coverage disposition pass — TRUE_UNCATEGORIZED driven to 0 |
| 84 | 2021 | Handoff prepared for the conflict adjudication |
| 85 | 2036 | Sidebar migration — LIVE and reconciled |
| 86 | 2079 | Independent audit reconciliation — two of my "verified" claims were false |
| 87 | 2113 | 2026-08-14 — Owner claim rulings shipped; export-chain repair path |
| 88 | 2139 | 2026-08-14 — "still not presented as a claim": the seed gate, not the renderer |
| 89 | 2160 | 2026-08-14 — Do the Claim rulings propagate to every statistic? |
| 90 | 2191 | 2026-08-14 — Claims graph verified; Ascension theme; Context restyled |
| 91 | 2226 | 2026-08-14 — Section headlines read certified totals, never a recount |
| 92 | 2259 | 2026-08-14 — ACROSTIC: a tenth Emphasis device (owner ruling) |
| 93 | 2287 | 2026-08-14 — Dominion entity + Brackets panel (owner rulings executed, not re-asked) |
| 94 | 2315 | 2026-08-14 — Span precision: acrostic brackets, and brackets painted in the drop |
| 95 | 2340 | 2026-08-14 — #150 emphasis withdrawn; overlap rotation generalised |
| 96 | 2360 | 2026-08-14 — Containment is not overlap; bracket chips clickable |
| 97 | 2381 | 2026-08-14 — Highlight rule finalised: colour = what it IS classified as |
| 98 | 2411 | 2026-08-14 — The overlap animation was a fixed rainbow |
| 99 | 2436 | 2026-08-14 — [barrage] withdrawn, Runbeck entity, all chips clickable |
| 100 | 2454 | 2026-08-14 — the write guard proved, and COVID made an entity everywhere |
| 101 | 2541 | 2026-08-14 — the second alias registry nobody read, and drops that open in place |
| 102 | 2597 | 2026-08-14 — Aliases in the Post Archive, and the Rachel Chandler ruling |
| 103 | 2664 | 2026-08-14 — warm browser, and a workflow that pays for protection once |
| 104 | 2710 | 2026-08-14 — a theme chip now opens its drops, oldest first, and keeps opening as you scroll |
| 105 | 2737 | 2026-08-14 — the theme's name is the way into it |
| 106 | 2754 | 2026-08-14 — a question carries no Emphasis (rendering rule, certified data untouched) |
| 107 | 2791 | 2026-08-14 — a question carries no Emphasis, in the DATA this time |
| 108 | 2832 | 2026-08-14 — why one ruling took three round trips, and the guard that ends it |
| 109 | 2859 | 2026-08-14 — three owner rulings on #5 and #4965, one of them corrected by the corpus |
| 110 | 2893 | 2026-08-14 — DEPLOYED: the whole session's batch, seed 45 |
| 111 | 2943 | 2026-08-14 — #4963 reclassified, Implied Conclusions retired, Search out of the sidebar |
| 112 | 2976 | 2026-08-15 — every Patriot/Patriots is one Entity; the drop's own number connects |
| 113 | 3006 | 2026-08-15 — the drop header actually connects, and Checkable Claims folds into Claims |
| 114 | 3038 | 2026-08-15 — #524, and a question the detector could not see |
| 115 | 3069 | 2026-08-15 — the phrase opens its own drops, and the archive jump actually arrives |
| 116 | 3098 | 2026-08-15 — the jump lands on the drop, and the two NPs become two entities |
| 117 | 3118 | 2026-08-15 — first owner claim review, and the jump stops walking the archive |
| 118 | 3142 | 2026-08-15 — deploy-every-fix, and the lowercase "sessions" alias withdrawn |
| 119 | 3168 | 2026-08-15 — SR / NG rulings, and owner notes on rows that stay (seed 59) |
| 120 | 3207 | 2026-08-15 — DNI / MI / SIS, and a silent-data-loss repair (seed 60) |
| 121 | 3254 | 2026-08-15 — RT split three ways, and the reader info box (seed 61) |
| 122 | 3293 | 2026-08-15 — Seven tokens, 92 occurrences (seed 62) |
| 123 | 3326 | 2026-08-15 — Info box: off-screen fix + acronym coverage (seed 63) |
| 124 | 3357 | 2026-08-15 — DAG / JB / JK / HCQ / NYC / RBG / AWAN, 74 cards (seed 64) |
| 125 | 3397 | 2026-08-15 — 11 tokens, 233 cards (seed 65) |
| 126 | 3425 | 2026-08-15 — WASH POST joined, + ABC / RE / OP (seed 66) |
| 127 | 3460 | sourceSpansV2 — shadow provenance parser (SHADOW MODE, nothing applied) |
| 128 | 3527 | Directives v4 — the five owner rulings applied (still SHADOW, nothing migrated) |
| 129 | 3591 | Q Directives v5 — FINAL adjudication applied locally. DEPLOY HALTED on a lane conflict. |
| 130 | 3658 | Recovery inspection after an interrupted turn — UNEXPECTED_CANONICAL_CHANGE. Not deployed. |
| 131 | 3702 | 2026-08-16 — Seed 73: hover-box repair + Wizards & Warlocks resolved |
| 132 | 3746 | 2026-08-16 — Seed 74: four certified facts that never reached the screen |
| 133 | 3820 | 2026-08-16 — Entity cards: certified alias posts + alias chip spelling |
| 134 | 3863 | 2026-08-16 — Sentence-level Predictions audit (403 records, 14 batches) |
| 135 | 3920 | 16 Aug 2026 — Pipeline repair: a deploy applies certified artifacts, it never re-derives them |
| 136 | 3992 | 16 Aug 2026 — The quote-boundary rows go into the Resolution Center |
| 137 | 4044 | 16 Aug 2026 — Resolution Center rows show how long they have been open |
| 138 | 4081 | 16 Aug 2026 — Stage 1 deployed; Stage 2 entity hovers implemented |
| 139 | 4140 | 16 Aug 2026 — Stage 2 cleanup: reprocessing, URL quarantine, private review |
| 140 | 4188 | 2026-08-16 — the rendering coordinate system, and what it had been hiding |
| 141 | 4266 | 2026-08-17 — the integrated audit: one matcher, one plan, 9,749 occurrences |
| 142 | 4336 | 2026-08-17 — the three rulings, and the final integrated simulation |
| 143 | 4377 | 2026-08-17 — seed 78 APPLIED locally, deploy HELD at the browser gate |
| 144 | 4418 | 2026-08-17 — mobile blocker resolved by measurement; combined-card work handed off |
| 145 | 4449 | 2026-08-17 — the six split terms, and the rebuild that could not reproduce the bundle |
| 146 | 4580 | 2026-08-17 — the grey Context fill comes out of the drop, and the 435 drops that went silent |
| 147 | 4640 | 2026-08-17 — Emphasis comes out of the drop too, and three defects the gates caught behind it |
| 148 | 4692 | 2026-08-17 — the badge number is now the sort key |
| 149 | 4746 | 2026-08-17 — The Entity list reconciles, and the month charts stop reaching into it |
