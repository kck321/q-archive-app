# CURRENT STATE — the only executable handoff

Everything else under `audit/` that looks like a handoff is HISTORY. Do not act on it.

## Production

    seed 78 — https://qdrops.app
    queue 115   Reference 30 · Subject 16 · Notation 28 · Device 31 · Source 10
    entities 1,201   certified mentions 8,798   rendered 8,798 (difference 0)
    208 dormant · 135 source-only · 373 linked-source records · 3,698 public hovers
    588 withdrawn occurrences · 363 migrated source references
    Q Directives 2,552 raw · 2,500 distinct (post,text) · 1,464 posts
    post text 1,128,312 chars
    Predictions 595 · Claims 4,221   (sentence-level audit, 2026-08-16)
    206/206 invariants · manifest verified · seed fingerprint 78

    The 2026-08-17 integrated entity cleanup is APPLIED and DEPLOYED, and the deploy chain
    reproduces it: `apply-entity-cleanup.mjs --rematerialise` is a step of the chain, so a full
    rebuild lands on 1,201 / 8,798 with all 19 artifacts byte-identical. Rollback stays one
    command away — `--rollback`, re-proved any time by `scripts/prove-cleanup-rollback.mjs`.

## Standing rules

1. **Deploy after every fix.** Direct to production once all gates pass — no preview step.
2. **Firebase preview only when the owner asks for it.**
3. **Never deploy from an uncommitted or mixed-lane state.** `scripts/preflight-deploy.mjs`
   enforces this and runs inside `deploy-web.sh`.
4. **One writer at a time.** `scripts/repo-lock.mjs acquire|release` — two agents must not certify
   q-app simultaneously.
5. `npm run dev` and `npm run dev:public` are development tools, not deployment steps, and are not
   reported as deliverables.
6. Certified counts live in `scripts/lib/contracts.mjs` (`CANONICAL`). Change them only with the
   reason recorded inline.
7. **A deploy applies certified artifacts; it never re-derives them.** `export-firestore.mjs` runs
   the APPLY steps only. Re-derivation is `node scripts/rederive-certified.mjs` — isolated, and it
   reports rather than adopts. A derive step re-runs today's detector over a section that was
   adjudicated on an earlier one, so running it inside a deploy re-certifies without a ruling.
8. `SKIP_EXPORT=1` is a quota escape hatch, not a workflow. If the ordinary export cannot run, that
   is the bug to fix.

## Open work

- **The URL cleanup is DONE — superseded by the integrated cleanup and shipped at seed 78.** It was
  never applied in its own right: the −504/1,254 simulation was computed before the corpus-wide
  boundary audit and before the publisher and social-handle rulings, and
  `apply-entity-cleanup.mjs` replaced it with one plan over all 9,749 certified occurrences.
  Final: kept 8,791 · held 7 · withdrawn 588 · migrated 363. `apply-url-cleanup.mjs` is gone; the
  applier is `apply-entity-cleanup.mjs`, and `--rematerialise` is the form the deploy chain runs.

- **A REBUILD MUST LAND ON THE CERTIFIED STATE, AND FOR ONE DEPLOY IT DID NOT.** `apply-entities.mjs`
  rebuilds Entities from `audit/entities-audit.json`, which is the adjudication as it stood BEFORE
  the cleanup — so replaying the chain put 1,409 / 9,749 back and `build-search-index.mjs` refused at
  its QA gate. Since `export-firestore.mjs` replays that chain before the manifest is consulted, the
  deploy could not run at all. Fixed by making the cleanup a chain step; declared in `APPLY_ORDER`
  so `chain-complete` fails if it is dropped. **The lesson generalises: any count-changing applier
  that is not in the chain makes the bundle unreproducible, and the only way you find out is by
  running the rebuild.**

- **THE COORDINATE SYSTEM IS THE TRAP HERE.** The hover and URL logic asked its questions of
  `posts.json` raw text; the app strips board markup at seed time. `https:<em>//</em>` hid **46% of
  the corpus's links** from the URL detector and `AT&amp;T` made a visible company read as absent.
  `scripts/lib/runtimeText.mjs` is the one definition, now used inside `hoverValidation.mjs` so no
  caller can forget it. Invariant `coords-guard-is-not-vacuous` fails if the two ever agree.

- **3,126 hover synopses await editorial review** — `/editorial/hover-review`, served from `audit/`
  by a dev-only Vite middleware so the published bundle has no copy. The **2,931 substantive
  audit-graded records are untouched and byte-identical**; the 3,144 → 3,126 move is 18
  `Insufficient` records routing earlier (8 to the quarantine, 10 to no-anchor).

- **402 hovers classified `no_visible_text_anchor`** — `audit/entity-hover-no-visible-anchor.json`,
  provenance in `audit/entity-provenance-review.json`. A ruling about the TOOLTIP, not the
  occurrence: **no certified count moved**. 0 image-confirmed (the corpus holds no OCR, caption,
  annotation or bounding-box data — the audit asserts their absence), 55 image-unconfirmed, 231
  unsupported, 116 outside the ruled four (the entity is the publisher behind a link but its name
  is not a token of the URL — needs its own ruling). 302 of the 402 have their alias inside a
  longer word: `God` is certified in 47 drops that all say `Godfather III`. Count-changing,
  reported, not acted on. Design for the image case: `audit/image-entity-presentation.md`.

- **[NP] migration is ruled and parked** — `audit/entities-pending-migrations.json`. "Non-profit
  organization" stays a certified entity until occurrence-level bracket classification exists
  (Stage 3). Then [NP] in #5 and #6 becomes the bracket interpretation "non-profit organization",
  is proven separate from Nancy Pelosi in a browser, and only then does the generic entity go.
  That moves entities 1,409 → 1,408 and mentions 9,749 → 9,747. **Do not withdraw it early**: the
  two occurrences would fall back to unclassified, and the only thing keeping them out of the
  Pelosi alias group is an `excludePosts` entry a later recount could stop honouring.

- **10 Source rows are live in the Resolution Center** — `/resolve?kind=source_reference`,
  canonical file `audit/entities-quote-boundary-pending.json`. They hold the 18 entity mentions
  that are the whole difference between the certified total and the 18-higher figure a
  re-derivation produces (9,749 vs 9,765 after Stage 1).
  Nothing in the drops changed; `lib/quotedBlocks.mjs` did, at seed 72. **The unit is the LINE, not
  the mention** — all five mentions on #1553 line 0 stand or fall on one judgement. 4 lines (11
  mentions) are pasted news copy the OLD boundary correctly excluded; 6 lines (7 mentions) are Q's
  own words it wrongly swallowed (#1939 "[19] phone calls today - DC/UK/AUS panic?", #2208 "DECLAS
  FISA >> [RR] FORCE >> RED LINE", #2587 lines 6-9). Each row carries the reading the text supports
  in `reading` / `readingNote`; none is applied. Entities stays at 9,749 until ruled.
  Ruling one is an owner resolution: add its id to `audit/resolution-owner-resolved.json`, then
  materialise the accepted mentions through `apply-entities.mjs`.

- **91 Predictions rows await an owner ruling** — `audit/predictions-audit/review-backlog.md`.
  56 were published Predictions and are now withdrawn (maxims, commemorative pledges, prayers,
  quoted statute, bare "Coming soon."), 22 are arguable Claims that stayed in Claims ("We will
  win."), 13 are possible missing Predictions in quoted source material. Each carries its complete
  sentence and why it is arguable. Ruling on one is a data change, not a UI change: the canonical
  file is `audit/predictions-audit/*.json`, re-applied by `apply-claims.mjs`.

- 31 → 30 held Reference rows carry their audit notes and stay open for exploration.
- 236 nonterminal `Q` candidates across 180 posts await a REVIEW pass. Only 10 high-confidence
  body references are materialised so far. Never sweep with a regex: 10-Q, AL-Q, Q&A, "Q:", ?q=,
  Q Clearance and Q+ are not the persona.
- Held elsewhere: 16 Subject, 29 Notation, 31 Device cards, each with its reasoning on the card.
- Row-level second opinion outstanding on `directives-held-45-editorial-review.csv` and
  `religious-audit-rejected.csv`.
- 160 religious records exist only in images/OCR/quoted text and cannot be body-anchored; they
  need a source-typed mechanism before they can be shown.
- 83 approved Device keeps need a multi-span parallel-phrasing representation before they can be
  highlighted.

## Hard-won lessons — do not relearn these

- Counting and CLEARING and RENDERING must all be scoped the same way. Three separate bugs came
  from one layer working per-occurrence while another worked per-post.
- A recount REPLACES: it must retract the superseded ruling's render entries, not just its count.
- One alias can carry several rulings. A Map keyed by alias silently keeps only the last.
- A difference from production is not a loss. Check whether it was intended before calling it a
  regression.
- Never restore certified state from git HEAD. Git lags production.
- **Ask the question of the text the READER sees.** A check that reads the stored representation
  does not fail — it passes, quietly, for everything. Two separate audits were computed against
  strings that are never on screen.
- A zero is only evidence once you have proved something could have made it non-zero. Assert the
  field exists before reporting that nothing was found in it.
