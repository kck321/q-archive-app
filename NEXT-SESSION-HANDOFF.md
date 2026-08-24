# Q Drops — next session, start here

**Read `PROJECT_CONTEXT.md` first, then this.**

Round 2 of the unhighlighted-sentence review is **applied and certified at seed 90**. The Step 3B
reconciliation before it stays closed. Do not reopen either.

---

## Where things stand

| | |
|---|---|
| HEAD | see `git log -1` |
| production | **seed 88** — the round-2 batch is committed and validated but NOT deployed |
| invariants | **222/222** |
| manifest | verified at seed 90 |
| conflict queue | closed, 50 rows, actionable 0 |

### Certified counts (manifest, seed 90)

```
questions   6,327      claims      10,258      entities  1,532 canonical / 9,271 mentions
directives  3,304      predictions    934      codes     1,986 · resolution queue 353
```

---

## What round 2 did

`Q_Unhighlighted FINAL 2.xlsx` — 6,419 rows over eight sheets, one per destination section plus a
Resolution Center sheet.

```
2,775  applied as new rulings
3,261  ALREADY certified in the section named — no second record created
  238  Resolution Center (the comms strings, coordinates and glyphs)
  119  duplicate rows dropped
  152  held for the owner
    1  refused
```

**The do-not-double-highlight test reads the CERTIFIED ARTIFACTS, never the painted DOM.** An
entity or bracket painted on top of a claim hides the claim from a crawler, so a DOM-based test
would have duplicated every one of them.

The report is `audit/unhighlighted-sentences/Q_Unhighlighted_FINAL_2_REPORT.xlsx` (seven sheets,
copy on the Desktop), generated from the artifacts by `scripts/build-review2-report.mjs`.

---

## The trap that cost the most, and the guard that now prevents it

`build-unhighlighted-owner-rulings-2.mjs` reads `public/data`, and `public/data` is where its
rulings LAND. Build → apply the chain → build again, and every ruling reads back as "already
certified" and **deletes itself**. Questions went 8 rulings, then 0, and the apply gate reported 65
added where the run before it had made 72.

Subtracting the previous output was tried and is the WRONG SHAPE: it cannot tell a rebuilt bundle
from a fresh one, so it suppressed genuine prior evidence — entities' `already certified` fell from
595 to 208 and 387 live highlights were handed back for re-ruling.

**The script now refuses to run unless `public/data` is exactly what is committed.** The order is:

```
git checkout -- public/data
node scripts/build-unhighlighted-owner-rulings-2.mjs
node scripts/build-queue-entity-identities-2.mjs
node scripts/rebuild-bundle.mjs
```

`audit-occurrence-provenance.mjs` must be re-run at the point in the chain where the tree is at the
cleanup's BEFORE state — i.e. after `apply-entities` and before `apply-entity-cleanup`. Running it
on the finished bundle records 1532/9271 and the cleanup then refuses.

---

## What must not be undone

- **`lib/queueRulings.mjs` is the only list of queue rulings.** Six materialisers read it. A second
  copy goes short and nothing fails loudly when it does — the same lesson `lib/step3b1Sets.mjs`
  records.
- **`lib/queueDirectiveFamily.mjs` must never become a catch-all.** Its round-2 rules are APPENDED,
  so round 1's first-match-wins answers cannot move. 24 rows are held by `statesNoInstruction()`
  because they instruct nobody — list markers, end-markers, comms strings.
- **Entity identities are RESOLVED first and created last.** 244 of round 2's 308 come from three
  lists Q pastes verbatim, where each line names two things and is SPLIT. 128 wordings are held
  rather than named, and naming them is a separate owner decision.
- **The abbreviation record governs a ruled span.** A ruling that lands on a recorded truncated span
  is extended to the sentence the record names; one that lands on a withdrawn tail is refused.
- **Entities and brackets are on top of every category, inside a question as much as outside one.**
  Both renderers carry the identical branch. `test-queue-ruling-paint.mjs` is the gate.

---

## Open for the owner

1. **152 held rows** — sheet "Held for you" in the report. 128 entity spans with no name yet (`L.`,
   `+++`, `SEC TEST`, `Godfather lll`, `4,10,20`, …) and 24 directive rows that instruct nobody.
2. **#859 is still a data defect.** Its text splices a pointer inside a word
   (`These peo&gt;&gt;567493ple are stupid.`) so no rendered block matches it. One drop of 4,966.
3. **The `>` bullet is read as a quotation marker.** `sourceLines()` treats a leading `>` as source,
   so 935 certified occurrences sit in the source-boundary debt — 162 of them from this batch. The
   certified sections are right and the detector is wrong; fixing `sourceLines()` is the standing
   prerequisite recorded in `audit/source-boundary-debt.json`.
4. **358 entities await a hover synopsis** (`audit/entity-hover-pending.json`). A synopsis is
   authored editorial text about a real person or organisation, and a bank named once in a pasted
   list is exactly where an unreviewed one would be a guess.

---

## Re-measure rather than re-model

`node scripts/audit-painted-truth.mjs --base https://qdrops.app` re-crawls the whole archive in
~7 minutes and grades any transcription against the rendered DOM. Never hand over a leftover list
that has not been checked against the page. The census that produced this batch is in
`audit/unhighlighted-sentences/` — read its `README.md` first.
