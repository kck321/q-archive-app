# Q Drops — Project Context

**Read this file FIRST in any new session, before DEVLOG.md or the code.**

DEVLOG.md is the chronological build log (what changed, when). This file is the *standing
state*: decisions that are settled, invariants that must not be broken, and traps that have
already cost time. If the two disagree, this file is newer.

---

## What the app is

A research tool for the **language** of the 4,966 Q posts. Not a post viewer — every drop is
decomposed into what it asked, claimed, predicted and named, so any phrase can be traced
across the whole archive and its timeline.

- **Stack:** React 19 + TS + Vite + Tailwind v3. Data lives in IndexedDB, seeded from
  `public/data/*.json`. Firestore is used only by the desktop build.
- **Firebase project:** `q-app-2ce0a` — SEPARATE from `pool-logbook` (Pool Tech Logbook and
  Blue Mist Hub). Nothing here can affect those.
- **Domain:** `qdrops.app` — registered 12 Aug 2026 (see the Domain section below).

## Two builds, one codebase

| | Editorial (yours) | Public |
|---|---|---|
| Command | `npm run dev` → :5173 | `npm run dev:public` → :5174 |
| Flag | `CAN_EDIT` true | `VITE_PUBLIC_SITE=1` |
| Editing UI | all of it | **not compiled in** |
| Firestore reads | yes | **zero** |

`src/lib/appMode.ts` owns this. **Import `CAN_EDIT` directly in components — never read it
through React context.** Through context it is a runtime value, the bundler cannot fold it,
and every edit control plus the admin PIN ships to the public bundle anyway. That mistake was
made once and only caught by grepping the built file.

## Invariants — do not break these

1. **The public build must never read Firestore.** Firestore bills one read per *document*.
   `fetchOverrides()` reads two whole collections, so each visitor cost ~1,506 reads and the
   free tier (50k/day) died at ~33 visitors. Edits are baked into the bundle instead.
2. **`scripts/export-firestore.mjs` must run before every deploy.** It bakes `postEdits`
   (1,353 posts), `questionEdits` and `aliases.json` into `public/data`. Skipping it silently
   publishes a site missing months of analysis. `deploy-web.sh` runs it and aborts on failure.
3. **`.env` is gitignored and must stay that way.** It holds the live Anthropic key and the
   GitHub repo is public.
4. **Word-boundary matching everywhere.** Substring matching makes "US" match "rUSsia",
   "mUSt", "becaUSe". Bitten in five separate places: search, highlighting, alias post-lists,
   bulk-apply, and the question backfill.
5. **Questions match on question FORM** (`phrase\s*\?`), not the normalized phrase.
   Normalizing strips the "?", which made the question "Twitter?" claim 960 posts instead of 6.
6. **`+` is a word character in `normalizeItemKey`.** `Q` and `Q+` are different designations.
7. **Never merge `Saddam Hussein` into the Obama alias group.** Different person.
8. **`scripts/.cache/references.jsonl` is source data, not a cache.** It is the only copy of
   the quoted-post content behind every `>>NNNNNNN` pointer — scraped back from qalerts after
   the original `references` field was destroyed at ingest (every entry is the string
   `"[object Object]"`, in Firestore too). It is committed to git. The Firestore dump
   overwrites `posts.json` wholesale, so `export-firestore.mjs` re-applies it and **aborts if
   the file is missing**. Delete it and 205 drops go back to being blank rows.
9. **Quoted text feeds SEARCH ONLY, never the analysis index.** 52% of it is anon words. If
   it reached `getAnalysisFrequency` it would turn anons into Q's questions, claims and
   predictions. Search indexes chain depth ≤ 1 — that reproduces qalerts exactly; indexing
   the full 4-deep chain returned 6 posts for MOSSAD where qalerts returns 4.
10. **Bump `SEED_VERSION` in `src/lib/localData.ts` whenever `posts.json` shape changes.**
    Returning visitors read from IndexedDB and will never see new fields otherwise. Now at 2
    (`quotedPosts`).

## Counting rules (these have gone wrong repeatedly)

Every section shows **mentions** and **posts**. They are different questions:

- **posts** = DISTINCT posts (a set union). Summing each item's post list counts
  *(item, post) pairs* and produces figures larger than the 4,966 posts that exist.
- **mentions** = total occurrences, counting repeats *inside* a post. Always ≥ posts.
- Implied Conclusions has mentions == posts by nature (they are paraphrases the AI writes,
  never text copied from the post). That is a useful sanity check, not a bug.

Six counters have been found wrong so far, always the same shape: arithmetically fine but
answering a different question than the label claimed. **When a number looks off, check what
it is counting before assuming the maths is broken.**

## Settled decisions

- Sections removed: Infographs, Storyline, Q School. Q Clusters keeps its page, loses its
  generate button publicly.
- "Verification Hooks" renamed **Checkable Claims**, colour fuchsia `#d946ef`.
- Source links point at the ORIGINAL boards. `8ch.net` is dead and 8kun did not keep the old
  thread numbers, so those 3,337 links route through the Wayback Machine and are marked 🗄.
  **Wayback coverage was never verified — archive.org rate-limited the check.**
- Donations: **crypto only**, addresses in `src/lib/donations.ts`. A coin with an empty
  address is hidden deliberately — publishing a placeholder sends real money nowhere.
- Feedback is a **write-only drop box**: visitors can `create`, nothing else.
- Tagline (public build only): "Built for researching the language of the Q posts. Every drop
  broken down into what it asked, claimed, predicted and named."

## Still open before launch

1. **Firestore rules are DEPLOYED and verified** (`firestore.rules`, 12 Aug 2026). Reads are
   public — the same data is already published in `public/data/*.json`, and denying reads
   would break `export-firestore.mjs` while protecting nothing. Writes are denied everywhere
   except `feedback` create. Verified against the LIVE rules, not by reading them:
   vandalism, deletion, feedback enumeration, oversize and bad-kind submissions all denied;
   feedback create and postEdits read still work.
   - **Do not add a `match /{document=**} { allow read: if true }` catch-all.** Firestore ORs
     matching rules, so it re-opened the feedback drop box even though the specific rule said
     `allow read: if false`. Collections are listed one by one for that reason.
   - **Consequence:** the editing build's Firestore sync is now denied. Edits still save to
     IndexedDB (every push is wrapped in try/catch), but new edits no longer reach
     `postEdits`, so the export cannot bake them. Restoring that needs Firebase Auth +
     a rule granting that one account.
   - A Firebase web API key is an identifier, not a credential. It is in the public bundle
     because the feedback form needs it, it cannot be hidden in a client app, and that is
     fine — these rules are the actual protection.
2. **Wallet addresses** — Support page renders empty until they are filled in.
3. **Dashboard still ships publicly** — user's explicit choice, to be pulled last.
4. API key HTTP-referrer restriction; Firebase App Check for feedback spam.

## Domain

**qdrops.app — bought 12 Aug 2026 at Cloudflare Registrar, renews 12 Aug 2027 (~$14/yr).**
Auto-renews while a valid card is on file. A lapse is the one failure here that cannot be
undone — an expired .app name can be registered by anyone. The Dashboard shows a countdown
(`src/components/RenewalReminder.tsx`, admin build only).

**Live since 12 Aug 2026.** `npm run deploy:web` now defaults to it, and does two things the
old subpath deploy did not:
- builds with base `/` instead of `/q-archive-app/` (the subpath build renders a BLANK PAGE
  on an apex domain — every asset would be fetched from qdrops.app/q-archive-app/assets/…)
- writes `dist/CNAME`, because the deploy force-pushes `gh-pages` and would otherwise delete
  the CNAME file GitHub's "Custom domain" box puts there, silently unsetting the domain

`kck321.github.io/q-archive-app/` now redirects here — GitHub Pages serves one domain per
site, so the old URL is no longer a separate address.

## Safety net

- **Git** — baseline commit exists. Commit before any bulk operation.
- **Data snapshots** — `node scripts/snapshot.mjs [label]`, `--list`, `--restore <name>`.
  Restoring snapshots the current state first, so restore is never the destructive step.
- **Alias edits** — `node scripts/add-alias.mjs "<canonical>" "<spelling>"…` writes to BOTH
  Firestore and `public/data/aliases.json`. Updating only one leaves the builds disagreeing.

## Known trap when testing

:5173 and :5174 look nearly identical. Several reported "bugs" were the editorial build being
mistaken for the public one, and one was the live GitHub Pages site showing an older build.
Always check the port, and hard-refresh the live site — GitHub's CDN serves the previous
bundle for a few minutes after a deploy.
