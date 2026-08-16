# CURRENT STATE — the only executable handoff

Everything else under `audit/` that looks like a handoff is HISTORY. Do not act on it.

## Production

    seed 72 — https://qdrops.app
    queue 106   Reference 30 · Subject 16 · Notation 29 · Device 31
    entities 1,448   certified mentions 9,760   rendered 9,760 (difference 0)
    Q Directives 2,552 raw · 2,500 distinct (post,text) · 1,464 posts
    post text 1,128,312 chars
    146/146 invariants · manifest verified · git tag seed-72

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

## Open work

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
