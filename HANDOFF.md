# Q Drops — brief for an outside reviewer

Paste this into another assistant (ChatGPT, Gemini, whatever) when you want a second opinion.
It is written to be self-contained: architecture, the rules that must not be broken, the
mistakes this codebase keeps making, and what is actually open.

**The source is public:** https://github.com/kck321/q-archive-app
Point the assistant at that URL and it can read the real code rather than guess.

**Live site:** https://qdrops.app

---

## What it is

A research tool for the **language** of the 4,966 Q posts. Not a post viewer — every drop is
decomposed into what it asked, claimed, predicted and named, so any phrase can be traced
across the whole archive and its timeline.

- React 19 + TypeScript + Vite + Tailwind v3
- Data ships as JSON in `public/data/` (7.5 MB posts, 1.8 MB questions), seeded into
  IndexedDB on first load. Browsing and searching need no network and no database.
- Firestore is used by the editing build only. The public build reads **zero** Firestore.
- Also builds as a desktop app (Tauri 2) and installs as a PWA.

## Two builds, one codebase

| | Editing (local) | Public (qdrops.app + installers) |
|---|---|---|
| Command | `npm run dev` | `npm run dev:public` |
| Flag | `CAN_EDIT` true | `VITE_PUBLIC_SITE=1` |
| Edit UI | all of it | **not compiled in** |
| Firestore reads | yes | zero |

`src/lib/appMode.ts` owns this. **Import `CAN_EDIT` directly — never through React context.**
Through context it becomes a runtime value the bundler cannot fold, and every edit control
plus the admin PIN ships to the public bundle anyway.

## The mistake this codebase keeps making

**Duplicated logic that drifts apart.** Four separate bugs, all the same shape:

1. Two definitions of "what counts as a question match" — the index said a post asking
   "power." matches the question "Power?", the highlighter searched for the literal
   "Power?" and found nothing.
2. Three highlighters. The reader feed had its own term-only version, so scrolling posts
   showed no questions, claims or entities at all.
3. Two definitions of "repeated this month" on the same screen, both labelled with the same
   month, showing 24 and 83.
4. Six copies of the chart axis tick; five never got the year labels.

**When reviewing this code, look for the same phrase implemented twice.** That is where the
bugs are. Counting bugs in particular are almost never arithmetic — the number is right and
answers a different question than its label claims.

## Invariants — do not break these

1. **The public build must never read Firestore.** It bills one read per document;
   `fetchOverrides()` reads two whole collections, so each visitor cost ~1,506 reads and the
   free tier died at ~33 visitors/day.
2. **`scripts/export-firestore.mjs` runs before every deploy** and re-applies the derived
   data afterwards (quoted posts, backfill, emphasis). The Firestore dump overwrites
   `posts.json` wholesale, so skipping any of it silently publishes a broken bundle.
3. **`scripts/.cache/references.jsonl` is source data, not a cache.** It is the only copy of
   the quoted-post content behind every `>>NNNNNNN` pointer, scraped back from qalerts after
   the original field was destroyed at ingest. Committed to git.
4. **Word-boundary matching everywhere.** Substring matching makes "US" match "rUSsia".
   Bitten in five separate places.
5. **Quoted text feeds SEARCH ONLY, never the analysis index.** 52% of it is anon words; it
   must not become Q's claims. Search indexes chain depth ≤ 1, which reproduces qalerts.
6. **Bump `SEED_VERSION` in `src/lib/localData.ts`** whenever `posts.json` shape changes, or
   returning visitors keep the old IndexedDB copy forever.
7. **Themes and implied conclusions are paraphrases**, not text from the posts (96% and 100%
   absent). Do not "fix" them by filtering — it would empty both sections.

## Data integrity

`node scripts/audit-vs-qalerts.mjs` compares every post against the source archive field by
field. It currently reports text, attachments, tripcodes and timestamps matching on
**4,966 of 4,966**. Run it after any ingest change.

## Performance notes

Two indexes are built in the browser and cached in IndexedDB, keyed by post/item counts:

- analysis frequency: 52,531 items → ~32,900 rows (~700 ms desktop)
- question frequency: 6,450 distinct questions

Both are warmed at startup. A backfill that tested every question against every post
(32 million regex runs, 6.9 s) was fixed by narrowing candidates through the word index
first — 123 ms. **If something is slow here, check whether it is using the index.**

---

## Open issues — where a second opinion would help

1. **Unconfirmed:** a standalone `"Why?"` reportedly does not highlight on post #100, though
   the question is stored for that post and the regex matches it exactly once when tested
   offline. Everything else on the page highlights. Not reproduced from the data — needs
   the actual render inspected.
2. **Firebase Auth is not set up.** Firestore rules now deny all client writes
   (`firestore.rules`), which closed a hole where anyone could delete the archive — but it
   also means the editing build can no longer sync edits to the cloud. Auth + a rule for
   that one account would restore it.
3. **Admin PIN default `1624` is in public source** (`AdminContext.tsx`). Harmless for the
   site and installers (both compile it out) but it is the local editing build's default.
4. **Old GitHub releases** from July are still published and were built before the read-only
   fix, so they contain the editing build.
5. **Offline image bundle** (1,653 files, 186 MB) is built and wired into the Tauri config
   but not yet shipped in a release. 63 images failed to download and need a retry.
6. **Not started:** paid distribution (Gumroad), multi-language UI, native Android build.

## Things that look like bugs and are not

- **Themes / Implied Conclusions never highlight.** They are summaries written about a post,
  not phrases from it. The sections say so.
- **Mentions ≥ posts, always.** Mentions count repeats inside a drop; posts are a set union.
- **qalerts is the upstream source** for the recovered quoted posts and the mirrored images.
  Any "why do our numbers differ" question should be checked against it first.
