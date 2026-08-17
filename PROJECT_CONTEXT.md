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

## How we work (owner directive, 14 Aug 2026) — READ THIS BEFORE ASKING ANYTHING

The measured facts first, because the obvious suspect was wrong: manifest verify 2.5s, all 138
invariants 4.2s, apply-entities 0.7s. **The protections were never the cost.** Running them after
every single correction was, along with a brand-new Chrome profile per check (~40-60s) and
approval checkpoints between steps the owner had already decided.

### The operating rule

**A clear owner instruction IS an executable ruling. Execute it.**

"this is a Claim" · "remove this from Emphasis" · "Dominion is an Entity" · "US means United
States here" · "move Themes above this section" · "POTUS should be cyan in the archive"

- Do **not** ask the owner to choose implementation architecture. Claude built the artifacts, the
  materialisers, the renderers, the invariants, the chain and the browser harness — it knows where
  an Entity ruling belongs and how to drop Emphasis while preserving a Claim/Theme overlap.
- Do **not** re-ask a ruling already given.
- Do **not** stop on a QA warning unless it exposes a genuinely NEW semantic decision only the
  owner can make (a count that moves for an unexplained reason, a ruling that would change a
  frozen figure in a way the ruling did not state).
- Do **not** write a long explanation before doing the work.

### Infer the mode; never ask which it is

| Request | Path |
|---|---|
| UI, layout, ordering, colour, rendering, search behaviour | lightweight — edit, targeted check, continue. No chain, no manifest, no seed bump. |
| Claim / Entity / Theme / Emphasis / Code / Directive ruling | certified-data — canonical artifact → materialiser → targeted QA, then continue |

### While the owner is actively reviewing posts

Smallest relevant path only: make the canonical change, run the affected materialiser or section
test, use the WARM browser if it needs to be seen, move to the next correction.

**Do NOT run per correction:** the 27-step chain · global invariants · manifest certification ·
fresh-profile proof · stale-profile proof · deployment.

Corrections accumulate across the session.

### DEPLOY AFTER EVERY FIX (owner directive, 15 Aug 2026)

Supersedes the batching rule below for shipping: **every change goes live as soon as it is fixed**,
so the owner can check it from the user's side. Batch the RULINGS if several arrive together, but do
not leave a verified fix sitting undeployed — an undeployed fix reads to the owner as a broken one,
and three separate reports this session were "it still does X" about work that was never shipped.

The gates do not change: chain, invariants, manifest, seed decision, `verify-final.mjs`, deploy,
`--live`. They cost about a minute; the deploy itself is the fast part.

### At a deployment checkpoint — buy the proof the change needs (17 Aug 2026)

One profile, then deploy, then one delivery proof. Pick by WHAT CHANGED, never by how big the diff
looks:

    node scripts/validate.mjs --profile fast        UI only: colour, layout, copy, ordering
    node scripts/validate.mjs --profile standard    shared behaviour: filtering, search, readers
    node scripts/validate.mjs --profile certified   artifacts, counts, aliases, rulings, seed, manifest
    node scripts/validate.mjs --profile full        every category, viewport and interaction

    npm run deploy:web                              stamps the build, waits, names a Pages stall
    node scripts/verify-live.mjs                    DELIVERY on the deployed site

`node scripts/verify-final.mjs` still works and means `--profile certified`; `--live` still works and
means `verify-live.mjs`. `--only <gate>` appends a targeted gate to any profile.

**The cheap certified-data invariants are in EVERY profile.** Manifest, cross-section invariants,
seed fingerprint and the four pure matchers cost ~6s together. A profile chooses how much BROWSER to
buy; it never chooses whether the data is allowed to be wrong. `certified` and `full` also run the
apply chain twice, so idempotence is still proved at every certified checkpoint.

**The live pass proves delivery, not logic.** It re-ran the whole local suite against production —
12.4 min of a 27-min deploy — proving application logic a second time against the same `dist/`. What
can actually differ is delivery, so that is what it asks: the deployed commit, seed and manifest hash
(`/build-info.json`), the hashed assets `index.html` names, the service-worker `CACHE_VERSION`, every
published data file against the bytes on disk, a fresh reader, and a RETURNING one. `--smoke <gate>`
gives a changed feature its one look on production; `--full` restores the old everything-pass.

**Measured 17 Aug 2026, local, same assertions, before and after on this machine:** month chart
370.1→21.1s · entity reconciliation 65.6→12.4s · archive alias 49.9→16.6s · returning profile
37.2→8.7s · section headlines 107.0→77.6s · category ordering 125.3→96.6s. **755.1s → 233.0s.**
The last two improve least because they were never mostly sleep — they are seven and nine loads of an
app that takes ~10s to become usable, which is Part 2's problem. Every fixed sleep
in the deploy-path gates is now a condition — rows rendered, the count the artifact predicts, the
selection changed, the tooltip visible, the seed re-seeded. **Do not reintroduce a `sleep(n)` into a
gate.** `scripts/lib/browser.mjs` has `waitFor`, `waitForStable`, `press` and the named conditions.

**What a deploy costs now,** measured end to end, everything green: `fast` 22.1s · `standard` 115.4s ·
`certified` ~390s (was one 726s path) — so an ordinary UI deploy is ~4.5 min against 27, a certified
one ~9. **The expensive things left are the app, not the process:** `test-multiword-gloss` 128.9s and
`test-category-order` 101.3s never contained a sleep — they are 19 and 9 loads of a page that takes
~10s to become usable. Nothing more can come out without removing a gate.

**A Pages build that has not been served in 5 minutes is EXTERNALLY STALLED.** Normal is 33–75s.
`await-pages-build.mjs` runs inside the deploy, polls the build stamp, and at five minutes prints the
Pages API status and says to re-push. Do not wait 45 minutes; one build on 17 Aug 2026 errored at 66.

### Verify at the layer the owner sees — and never trust a zero

Three round trips on ONE ruling ("no Emphasis on a question"), 14 Aug 2026. Each pass fixed a real
layer and stopped short of the one the owner was looking at:

| pass | what I did | why it did not land |
|---|---|---|
| 1 | measured, got 0, said "already handled" | the probe read `o.text` — a field emphasis rows do not have. `String(undefined)` made every test vacuous |
| 2 | suppressed the PAINT inside questions | the analysis panel lists a row by its LINE, so the lists still showed questions |
| 3 | withdrew 1,555 rows from the certified layer | correct — but no SEED_VERSION bump, so the owner's browser kept the old copy |

Three rules, now enforced rather than remembered:

1. **A zero is not evidence until the field is proved to exist.** Assert the schema first; a probe
   that reads a missing key reports "clean" for everything.
2. **Finish at the surface the owner named.** They said "the archives side or the post analysis
   side" — chips, rows and search, not just the highlight. Fixing the paint and declaring victory
   is answering a different question than the one asked.
3. **`node scripts/seed-fingerprint.mjs` pins seeded data to the SEED_VERSION that shipped it.**
   Change `posts.json` (or any seeded artifact) without bumping the seed and cross-section
   invariant 8 now FAILS, naming the files. After a deliberate bump: `--update`.

### Architecture protections that always hold (these are not speed bumps)

- canonical artifacts are the source of truth; owner rulings NEVER live only in `postAnalysis`
- a semantic ruling is applied by OCCURRENCE IDENTITY, never propagated globally from normalised
  wording — same wording retrieves candidates, context decides membership
- Q's literal wording is never rewritten; quoted/source material stays separate from Q-authored
- debt baselines are never moved just to make a check pass
- seed bump whenever seeded data actually changes
- the final browser proof is never skipped

### No public editing, ever

Public Qdrops is **read-only for certified classifications**. There is no clickable
sentence-reclassification UI for visitors and none is to be built: the overlaps tab and every
confirm/delete control are `CAN_EDIT`-gated out of the public bundle. Visitors observe, search,
comment and suggest. The owner rules; Claude implements in the repo.

## Aliases: two registries, one read path

An alias ruling is not finished when the certified layer has it.

| Registry | Where | Who owns it |
|---|---|---|
| Editable groups | `public/data/aliases.json`, `map` in `src/lib/aliases.ts` | the owner, via the UI + Firestore |
| Certified entity aliases | `public/data/entities.json` (from `audit/entities-owner-rulings.json`) | the adjudication and owner rulings |

**Every READ path must resolve a term through `getFullAliasGroup()`**, which unions both.
`getAliasGroup()` stays editable-only, because addAlias/removeAlias may only mutate what the owner
owns. COVID-19 carried certified aliases C19 and COVID and searching it showed neither, while
POTUS worked — only because POTUS's group had been typed in by hand.

**OWNER RULE: a searched term always shows the aliases tied to it, and connecting them is done
without being asked.** Verify in a browser, not in the data, on BOTH surfaces:
`node scripts/test-alias-visibility.mjs` (Analysis) and
`node scripts/test-archive-alias-visibility.mjs` (Post Archive). Fixing one and calling the ruling
done is exactly how `/posts` — the screen the question was asked about — stayed broken for a day
after `/analysis` was fixed.

Two traps on that path, both fixed and both easy to reintroduce:

- **The certified registry is FETCHED at startup.** A search run from a URL at mount
  (`/posts?q=covid-19`) resolves its group before `entities.json` lands, so the match set comes
  back editable-only while the "Includes:" chips — plain JSX, re-evaluated on the next render —
  list the certified aliases. The page then advertises spellings it never searched for.
  PostArchive subscribes to alias changes and replays the last search.
- **Alias expansion is word-boundary matched, the typed term is not.** A half-typed word must
  still find things, but a DERIVED spelling is not what the reader asked for: expanding "USA" to
  its alias "US" as a substring matched 2,259 posts on the "us" inside *because/must/trust*, and
  "RC" would add 520 on *search/force/Church*. Use `wordBoundaryPattern`, not `\b` — "Q+" ends in
  a non-word character, so `\bq\+\b` never matches it.

Folding an alias row into its canonical row is scoped: editable groups fold in every category,
certified entity aliases fold **entity rows only** — that set holds bare tokens like US, CCP and
COVID that can equally be the text of a claim or a code.

**Two rulings the owner-ruling layer now supports** (`audit/entities-owner-rulings.json`):
`mergeRulings` folds one certified entity into another (Ray Chandler → Rachel Chandler) by moving
its mentions/posts/aliases ACROSS — never by rescanning, because her "Ray.Chandler" spelling does
not match `/\bRay Chandler\b/`. `excludePosts` on an alias ruling is `notFollowedBy` at the level
of MEANING: RC is Rachel Chandler everywhere except #2's "all his funds in a RC", which stays
QUEUED in the Resolution Center. `build-resolution-queue.mjs` clears by token AND post, so an
excluded drop is never marked answered.

## Entity rows: one row per CONNECTED SET, and every row carries evidence

Settled 17 Aug 2026. `public/data/entity-public-view.json` is the authority and the page renders it
rather than recounting anything.

    1,201 canonical identities  =  1,066 named in Q's prose  +  135 linked as a source only
    published as 1,183 rows — 33 alias-connected identities share 15 of them
    8,798 certified prose mentions, reported SEPARATELY from the identity count
    208 dormant identities, reserved forever, never public

**Never headline the Named Entities section from the frequency index.** That index groups by
NORMALISED STRING, so it counts spellings: 879 of them, or 856 once the verbatim filter empties the
ones whose text no longer appears in visible prose. The list below it is one row per IDENTITY. Those
are different populations and printing one above the other is the defect that took a full pass to
undo. `tabStats.entities` exists so the entity header reads the artifact and nothing else.

**The row rule (owner ruling).** Identities the alias registry CONNECTS are one row, labelled by the
identity with the most posts, with the other spellings ordered most-to-least posts. Two kinds of
connection, unioned so chains resolve:

- the owner's editable groups in `aliases.json` (POTUS + Donald Trump; God + Lord + Jesus Christ)
- an identity whose whole canonical is another identity's registered alias (`Strzok` inside
  `Peter Strzok`; `The Washington Post` → `Washington Post` → `WASH POST`, one row of three)

**A shared spelling is NOT a connection.** Merging on shared alias strings collapses 1,066
identities into 1,006 rows and produces Barack Obama + Bruce Ohr + Board Owner (all "BO"), CIA +
ABC News + Alphabet ("ABC"), Chuck Schumer + CrowdStrike + Christopher Steele ("CS"). 46 spellings
are shared that way and none of them merges anything. This is what "do not restore global
string-based alias folding" protects.

**No public row without evidence a reader can open.** A prose row shows its certified drops; a
source-only row shows the drops that LINKED the material, chips labelled *Publisher link* or
*Social account*, badge reading `×N source posts`, `occurrences` of 0. A source reference is never
presented as a mention. Invariant group 10d asserts all of it; `test-entity-reconciliation.mjs`
proves it in the browser.

**Per-post repeat counts are per identity**, from the certified occurrence ledger, clipped to the
registry's own post set. They were once read from a Map keyed by post number alone and shared across
the whole frequency index, so in 443 drops one entity's `×2` was painted on another's chip.

## Month charts: hover reads out, click selects

Settled 17 Aug 2026, one implementation for Analysis and the Post Archive:
`src/lib/monthFilter.ts` (state + the recharts double-click guard) and
`src/components/MonthFilter.tsx` (tooltip, keyboard picker, banner).

- **Hover** shows the month and its counts and changes NOTHING else. No chip pulse, no row recolour,
  no dimming, no selection, no filter. There is no hover state left in either page — `hoverMonth`
  and `flashMonth` are gone rather than unused, so there is nowhere to hang a new one.
- **Click** selects: filters to that month, shows ONLY that month's chips, states the active month,
  clearable and changeable.
- **Enter and Space** are not handled in code. `MonthPicker` renders real `<button>`s, so the
  native behaviour IS the click path — a recharts `<Cell>` is an SVG rect that cannot take focus,
  and the axis only draws a tick at year starts, so there was previously no keyboard path at all.
- The selection is announced through one `aria-live="polite"` region.

`scripts/test-month-chart-behaviour.mjs` sweeps all 7 Analysis categories and the Archive on desktop
and phone with real pointer and key events. Point it at a build that still has the old behaviour and
it fails — that is how you know a green run means something.

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
