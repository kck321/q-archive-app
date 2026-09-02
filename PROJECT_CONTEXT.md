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
3. **`.env` is gitignored and must stay that way.** It holds this machine's Firebase and
   Cloudflare R2 values and the GitHub repo is public. It holds **no Anthropic key**: by owner
   ruling of 2026-09-02 Anthropic is removed from q-app permanently — client, dev proxy, Tauri
   key command and dependency — and **no replacement key will be issued**. Do not add one back;
   `scripts/test-no-anthropic-integration.mjs` fails the build if any of it returns.
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

### LOCAL-FIRST, ONE DEPLOY PER BATCH (owner directive, 17 Aug 2026)

**Supersedes "DEPLOY AFTER EVERY FIX" (15 Aug 2026).** The reason that rule existed — an undeployed
fix reads to the owner as a broken one — is answered by the LOCALHOST LINK instead of by a deploy:
every reply ends with the local URLs, so each fix is reviewable on the running dev server the same
minute it lands. Production then moves ONCE, at the end, carrying the whole batch.

Per fix, in this order, and nothing else:

1. implement it locally
2. run the smallest validation that honestly proves it — the affected materialiser, the one section
   gate, the WARM browser if it has to be seen. **Never defer testing to the end of the batch**; a
   failure found five fixes later costs more than the deploy ever did.
3. commit it on its own, message saying what changed
4. report it, ending with the localhost links so the owner can look
5. next fix. **Do not deploy.**

Rules that make the batch safe rather than merely fast:

- **Finished work is COMMITTED work.** "Not deployed" is not "saved". Uncommitted edits are what a
  rollback, a stash or a fresh session quietly loses — and `preflight-deploy.mjs` refuses a dirty
  tree, so the commit is owed either way.
- **One fix per commit.** The batch is reversible per-fix only if its commits are.
- **A certified-data migration never rides inside an unrelated UI batch.** Its own commit and its own
  chain evidence, so it can be reverted without taking the UI work with it.
- **Never undo completed local work just because it has not shipped yet.**
- `node scripts/batch-status.mjs` IS the batch state — the commits standing between production and
  HEAD, the floor their CUMULATIVE diff has already earned, what forced it, and whether the tree is
  clean. Derived from git and `dist/build-info.json`, so it cannot drift the way a hand-kept status
  file does. Print it before asking to deploy.

At the end of the batch, and only then: `batch-status.mjs` → the profile it names → `npm run
deploy:web` → `node scripts/verify-live.mjs`. **The floor comes from the CUMULATIVE diff, not from
the last fix** — one certified path anywhere in the batch makes the whole batch certified, which is
the tradeoff being bought: fewer deploys, each proved at the strongest floor in the set.

**Deploying is the owner's word, asked once, at the end, with the batch report.** Do not ship
mid-batch because a fix looks urgent; do not ship a gate that refused. Keep the commits and name the
blocker.

### Every reply ends with the links, and the dev server is kept warm

The link block at the end of a reply is the review path now, not a convenience. Keep `npm run dev`
running through a batch and give its real port (Vite moves to 5174/5175 when one is taken), because
a link to a server that is not listening is worse than no link — it reads as a broken fix.

### At a deployment checkpoint — buy the proof the change needs (17 Aug 2026)

One profile, then deploy, then one delivery proof:

    node scripts/validate.mjs                       the profile the DIFF requires — this is the normal command
    npm run deploy:web                              stamps the build, waits, names a Pages stall
    node scripts/verify-live.mjs                    DELIVERY on the deployed site

**YOU NO LONGER PICK THE PROFILE — THE DIFF DOES (17 Aug 2026).** Every changed path maps to the
weakest profile that can honestly prove it, and the strongest of those is the floor. `--profile` may
go UP from the floor and is REFUSED below it, naming the files that set it. "Pick by what changed"
was already the rule; `--profile fast` was one word whether or not the diff touched `audit/`.

| floor | set by |
|---|---|
| `full` | the pipeline scripts, any `test-*.mjs` gate, `lib/browser.mjs`, `lib/chainSteps.mjs`, build config, `public/sw.js`, `src/index.css` |
| `certified` | `audit/`, `public/data/`, the seed/alias/glossary read paths, any other script, `src-tauri/` |
| `standard` | `src/lib/`, `src/pages/`, the app shell — and any path no rule matches |
| `fast` | `src/components/`, assets, stylesheets, prose, repo config outside the bundle |

The baseline is **the last thing proved live** — the commit in `dist/build-info.json`, else
`origin/master`, else `HEAD~1`. Unpushed commits are as unproven as uncommitted edits. The table
lives in `scripts/lib/pipeline.mjs`; teach it rather than working around it.

`--only <gate>` and `verify-live.mjs --smoke <gate>` take names from an **allowlist** of eleven
read-only browser gates (`GATES`, same file); anything else exits 2 and prints the list. They used to
build a path from the argument and run whatever it named. `node scripts/verify-final.mjs` still
works and means "at least certified" (it takes the floor when the floor is higher); `--live` still
means `verify-live.mjs`.

**`--no-chain` cannot buy a certified pass.** It is refused at `certified` and `full`: the chain run
twice IS that proof.

### Nothing ships that nothing proved (17 Aug 2026)

`validate.mjs` writes `.validate-receipt.json` (gitignored) on success — profile, the floor, whether
the chain ran, and the git **tree** of the working copy it proved. The tree, not the commit, because
validation runs before the commit and committing the same bytes yields the same tree.

- `preflight-deploy.mjs` recomputes that tree and refuses to publish unless it matches, the
  receipt's profile meets the floor, and the chain ran when the floor is `certified` or above.
- `write-build-info.mjs` **refuses a dirty working tree**, with no override, and records `tree`
  beside `commit`. `ALLOW_DIRTY` is gone: it only moved the failure to after the build. The stamp
  that shipped before this said `"dirty": true` — a record of a bundle its own commit did not hold.
- `deploy-web.sh` re-checks cleanliness right after the Firestore export, which writes
  `public/data/` after pre-flight has already approved the tree.
- `verify-live.mjs` asserts production's stamp carries that same tree.

**proved → committed → built → served, one comparable value the whole way.** If a step refuses, the
answer is to commit and re-validate, never to reach for a flag.

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

## Sidebar order is the site's one listing order (owner ruling, 28 Aug 2026)

Every list of the sections follows the sidebar: categories MOST → LEAST by certified count
(Claims · Entities · Questions · Directives · Themes · Brackets · Predictions), Post text above
them, the Extras fold below in its own order. `sidebarOrder`/`SIDEBAR_RANK` in
`src/lib/sectionInfo.ts` is the one comparator — SECTIONS sorts through it (the Method page
inherits), and the search chips, analysis-map chips, Support bullets and post-card chip/row
lists all follow it. PostDetail keeps its Themes-first block by its own standing ruling. Certified
figures in SECTIONS are INTERPOLATED from the constants, never typed — the entities ⓘ line went
stale twice before this. Trap: the `headline-emphasis-gone` invariant text-scans sectionInfo.ts
after SECTION_TOTALS for any `emphasis` key — comments included — so the retired section must not
be named with a colon anywhere below that line. The mobile top bar stays TEXT-ONLY (a 28px icon
was tried and pulled the same day).

## EXPORT PATH: OPEN. The 28 Aug blocker is CLOSED. (corrected 2026-09-02)

**The ordinary path is to run the export.** `npm run deploy:web` dumps Firestore into
`public/data` and that works. It is not blocked, and it has not been blocked since 2026-08-31.

**Authoritative proof.** Two read-only exports from separate worktrees, 2026-08-31, byte-identical
across all 21 `public/data` files. Then a real deploy export shipped: commit `f3f0901`,
2026-09-01, **no `SKIP_EXPORT`**, reproducing the committed bundle byte-for-byte — the first
honest export since seed 75. Both commits are on master and are ancestors of HEAD.

**Why the old blocker cannot recur.** It was: the Firestore dump carried hash-id question rows on
#1915/#1944 that no longer prior-matched local `questions.json`, so the POSITIONALLY minted `qc-`
ids shifted (`qc-h` -> `qc-f`) and `materialize-literal-spans.mjs` aborted rather than land a
reviewed ruling on the wrong drop. Stage B deleted that mechanism:
`identity/question-identity-registry.json` is the identity authority for all 6,643 certified
questions, every positional allocator is gone with no fallback, and an unrecognised candidate
STOPS the build (`scripts/lib/questionIdentity.mjs`; 61 assertions in
`scripts/test-question-identity.mjs`). There is nothing left to shift.

**The historical record stays as written.** The DEVLOG entries for 2026-08-27 through 2026-09-02
describe the blocker as standing because that is what those sessions believed. The last of them
(2026-09-02, `9136952`) was already wrong when written — corrected in place at the end of this
DEVLOG, not by editing the original.

`SKIP_EXPORT=1` IS CONTAINMENT, NOT A DEFAULT. Every use needs its own **current written reason**
and **explicit owner approval**, this deploy, in words — `scripts/lib/exportPolicy.mjs` decides,
`scripts/preflight-deploy.mjs` enforces, `scripts/batch-status.mjs` reports the same verdict:

    SKIP_EXPORT=1 SKIP_EXPORT_REASON="..." SKIP_EXPORT_APPROVED_BY="..." npm run deploy:web

A reason that claims the export is failing must also set `SKIP_EXPORT_EVIDENCE` naming the current
failing run — a reason citing the closed qc-pin blocker without it is refused by name. A
certified/data-bearing diff can never skip the export *silently*: with approval it is allowed and
reported loudly; without it the deploy stops.

If the export genuinely aborts again, that is a NEW fault. Do not reach for the flag and do not
edit `OWED_LITERALS`. The old trap still applies: an aborted export leaves
`public/data/{posts,questions,entities}.json` half-rebuilt — `git restore` them.

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

**THE PORT IS NOT THE MODE (17 Aug 2026).** Six `vite` dev servers were found listening on
5173–5178, one per abandoned session, and **every one was `npm run dev` — the EDITORIAL build.**
:5174 was being handed to the owner as the "Users Link" while serving the editing build, which is
this trap firing through the very habit meant to avoid it. Vite takes the next free port silently,
so the second server started is 5174 whatever mode it is in.

Before giving a localhost link, prove the mode rather than trusting the number:

    netstat -ano | grep LISTENING | grep -E ":517[0-9]"        what is up
    powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>' | Select CommandLine"

`--mode public` in the command line is the only proof, and `dev:public` prints a green `public`
badge in its startup banner. One of each is enough; kill the strays.
