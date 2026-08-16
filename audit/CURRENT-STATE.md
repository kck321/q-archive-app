# CURRENT STATE — the only executable handoff

Everything else under `audit/` that looks like a handoff is HISTORY. Do not act on it.

## Production

    seed 75 — https://qdrops.app
    queue 115   Reference 30 · Subject 16 · Notation 28 · Device 31 · Source 10
    entities 1,445   certified mentions 9,786   rendered 9,786 (difference 0)
    Q Directives 2,552 raw · 2,500 distinct (post,text) · 1,464 posts
    post text 1,128,312 chars
    Predictions 595 · Claims 4,221   (sentence-level audit, 2026-08-16)
    147/147 invariants · manifest verified

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

- **10 Source rows are live in the Resolution Center** — `/resolve?kind=source_reference`,
  canonical file `audit/entities-quote-boundary-pending.json`. They hold the 18 entity mentions
  that are the whole difference between the certified 9,786 and the 9,804 a re-derivation produces.
  Nothing in the drops changed; `lib/quotedBlocks.mjs` did, at seed 72. **The unit is the LINE, not
  the mention** — all five mentions on #1553 line 0 stand or fall on one judgement. 4 lines (11
  mentions) are pasted news copy the OLD boundary correctly excluded; 6 lines (7 mentions) are Q's
  own words it wrongly swallowed (#1939 "[19] phone calls today - DC/UK/AUS panic?", #2208 "DECLAS
  FISA >> [RR] FORCE >> RED LINE", #2587 lines 6-9). Each row carries the reading the text supports
  in `reading` / `readingNote`; none is applied. Entities stays at 9,786 until ruled.
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
