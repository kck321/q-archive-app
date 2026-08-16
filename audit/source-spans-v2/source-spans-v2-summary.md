# sourceSpansV2 — shadow build summary

**SHADOW MODE. NOT CERTIFIED. NOTHING APPLIED. NOTHING DEPLOYED.**

> NOT CERTIFIED. Approve by stable occurrence ID after the sourceSpansV2 rerun — never by a remembered count.

Baseline: **seed 71**, 4,966 posts, manifest certified 2026-08-16.
The Subject-theme deployment is intact and untouched: themes 2,644, resolution queue 755.

## What was built

| file | what it is |
|---|---|
| `scripts/lib/sourceSpansV2.mjs` | the parallel provenance parser. Imported by nothing in the app and by no certified consumer. |
| `scripts/audit-source-spans-v2.mjs` | standalone fixtures + the 4,966-post shadow comparison. |
| `scripts/audit-directives-v3-shadow.mjs` | the 2,705-record Directive rerun + the page count reconciliation. |
| `scripts/audit-source-spans-v2-consumers.mjs` | the downstream impact matrix. |
| `scripts/audit-source-spans-v2-summary.mjs` | this document. |

`scripts/lib/quotedBlocks.mjs`, `scripts/audit-cross-section.mjs`, `scripts/lib/contracts.mjs`, every
canonical artifact under `public/data/`, and every certification pin are **unmodified**.

## Why sourceLines() could not simply be patched

Three failure modes, all structural rather than tunable:

**1. The lookup unit is a line; the stored unit is a sentence.** `God bless,` and `Q` are two lines.
The stored Directive is the single phrase `"God bless, Q"`. A per-line `includes()` finds it nowhere, so
19 records were NOT_LOCATED for no reason but that. All 19 locate under V2.

**2. `sustained prose` inverts on Q's own long sentences.** Any run of two long flowing lines was called
pasted material. #3 is seventeen telegraphic lines with two long ones in the middle, and both were marked
quoted — including the gold-fixture sentence. That single rule produced 333 of the lines V2 hands back to Q.

**3. `^>` is not always a quotation.** By 2020 Q uses `>` as his own bullet arrow. Eight lines of #3896 are
Q enumerating his own questions and every one was marked a board excerpt; 192 greentext lines corpus-wide had no quoted source to be excerpting from.

The fix for all three needs character offsets and regions, not line membership.

## The span model

`sourceSpansV2(post)` returns contiguous spans over a **composed document**: the post body, plus each
reproduced quoted-post payload as its own region, plus attached-image filename text as a third. Every span
carries `postNum · startLine · endLine · startOffset · endOffset · exactText · authorshipState · sourceType ·
referencedPostNum · confidence · structuralReason`.

The nine non-negotiable rules are encoded, not documented:

| rule | where it lives |
|---|---|
| 1. NOT_LOCATED never defaults to quoted | `resolvePhrase()` returns `sourceType: UNKNOWN` and no quoted fallback exists |
| 2. an "Anonymous" board label proves nothing | `name` and `trip` are never read when deciding authorship of the current post |
| 3. canonical body is Q body unless structure says otherwise | the BODY region default is `Q_BODY` |
| 4. reproduced earlier posts are quoted context | QUOTED_POST regions can never return `Q_AUTHORED_CURRENT_POST` |
| 5. repeats resolve by occurrence offset | `locateIn()` returns every hit; the caller passes an occurrence index |
| 6. genuinely unresolvable → AMBIGUOUS | fires when the BODY itself carries two provenances and occurrence order runs out |
| 7. a signature never joins the sentence | `Q_SIGNATURE` spans are cut before the phrase is rebuilt |
| 8. a directive never concatenates with a URL | `URL_LINE` spans are cut before the phrase is rebuilt |
| 9. scraped code is never a Directive | `CODE_OR_TECHNICAL_TEXT` runs |

## Fixtures

**90 / 90 span fixtures pass. 20 / 20 ruling fixtures pass.** Full table in `source-spans-v2-regression-results.md`.

Every mandatory gold fixture holds:

| fixture | result |
|---|---|
| #3 "Don't you think POTUS would be tweeting about removal given clear conflict." | Q_AUTHORED_CURRENT_POST · Q_BODY · HIGH · **not a Directive** (interrogative form) |
| #10 "Remember, the FBI…" and "Dig!!!!!" | held — AMBIGUOUS_MULTIPLE_MATCHES, still NEEDS_CONTEXT, no confident quoted ruling inherited |
| #146 "Pray." | Q_AUTHORED_CURRENT_POST · Q_BODY · KEEP_DIRECTIVE_AND_RELIGIOUS_THEME |
| #147 reproduced "Pray." | QUOTED_OR_EMBEDDED · QUOTED_PRIOR_Q_POST · referencedPostNum **146** · not a #147 Directive |
| #147 "God be with us all." | Q_AUTHORED_CURRENT_POST · religious statement · not a Directive |
| #349 #353 #393 #394 #434 #767 #1025 | sentence ends before the Q signature; blessing is not a Directive |
| #2382 #2395 #2500 #2801 #3428 #3819×2 #3896 #2351 #2378 | sentence and URL are separate spans; the URL is out of `directivePhrase` |
| #4437 | all five records CODE_OR_TECHNICAL_TEXT; nothing reads as the English verb "find" |
| Armor of God · Lord's Prayer · attached-image text · "God bless." · "God bless and stay safe." | all pass |
| a phrase in both quoted material and body · a genuinely not-located sentence | both pass |

## The 4,966-post shadow comparison

sourceLines() answers per line; V2 answers per span. To compare them at all, V2's spans are projected back
down to line verdicts and the two maps diffed. **No canonical data was written.**

| direction | lines |
|---|---:|
| UNCHANGED | 0 |
| OLD_Q_BODY_TO_NEW_QUOTED | 1,701 |
| OLD_QUOTED_TO_NEW_Q_BODY | 642 |
| OLD_Q_BODY_TO_NEW_NOT_LOCATED | 0 |
| OLD_QUOTED_TO_NEW_NOT_LOCATED | 0 |
| OLD_UNKNOWN_TO_NEW_RESOLVED | 0 |
| AMBIGUOUS_MULTIPLE_MATCHES | 12 |

### Read that table with one correction

**1,626 of the 2,355 changed lines are `>>NNNNNNN` board pointers** that sourceLines() left
unlabelled and V2 labels as pointers. A pointer carries no analysable prose, no consumer keeps records on one,
and calling it a provenance change inflates the headline roughly threefold. The honest figure is:

- **729 semantic line changes across 179 posts**
- **642** returned to Q · **75** taken from Q · **12** held as unresolved

### Semantic changes by cause

| lines | direction | source type | cause |
|---:|---|---|---|
| 333 | OLD_QUOTED_TO_NEW_Q_BODY | `Q_BODY` | long sentence inside a drop whose dominant register is Q — prose shape alone is not a quotation |
| 192 | OLD_QUOTED_TO_NEW_Q_BODY | `Q_BODY` | greentext arrow with no matching quoted source — Q's own bullet |
| 114 | OLD_QUOTED_TO_NEW_Q_BODY | `Q_BODY` | canonical post body, no embedded-source evidence |
| 44 | OLD_Q_BODY_TO_NEW_QUOTED | `QUOTED_THIRD_PARTY` | pasted passage directly beneath a source link or pointer |
| 16 | OLD_Q_BODY_TO_NEW_QUOTED | `QUOTED_SCRIPTURE` | reproduced scripture |
| 12 | AMBIGUOUS_MULTIPLE_MATCHES | `UNKNOWN` | whole-post prose in early board format with no signature, pointer, quote mark or register anchor — ownership not structurally established |
| 8 | OLD_Q_BODY_TO_NEW_QUOTED | `QUOTED_THIRD_PARTY` | pasted passage opening on a quotation mark |
| 6 | OLD_Q_BODY_TO_NEW_QUOTED | `QUOTED_SCRIPTURE` | reproduced scripture (continuation) |
| 3 | OLD_QUOTED_TO_NEW_Q_BODY | `Q_BODY` | bare URL line, cut from the adjacent sentence |
| 1 | OLD_Q_BODY_TO_NEW_QUOTED | `QUOTED_PRAYER` | reproduced prayer text |

## Early 4chan format — reviewed as a cohort, not a sample

All **233** `4chan_pol` posts are in `source-spans-v2-early-4chan-review.csv`, one row each, with old
quoted-line count, new quoted-line count, delta, span kinds, directive count and first line.

The finding that matters: this cohort is where sourceLines() is least reliable, because the format has no
quoted-payload structure to lean on and Q was not yet writing telegraphically. **103 of the 233 are labelled
`Q` and 130 `Anonymous`, and the label is not evidence either way** — #3 and #10 are both `Anonymous` and both
canonical. V2 decides on register and structure instead, and holds three posts (#10, #12, #29) whose entire
body is paragraph prose with no signature, pointer, quotation mark or register anchor to decide on.

## Directives v3 — shadow rerun of all 2,705 occurrences

Keyed by stable occurrence ID (`postNum#index`). Never by count.

| authorship state | v2 | v3 |
|---|---:|---:|
| Q_AUTHORED_CURRENT_POST | 2,613 | 2,663 |
| QUOTED_OR_EMBEDDED | 71 | 40 |
| NOT_LOCATED | 19 | 0 |
| AMBIGUOUS_MULTIPLE_MATCHES | 2 | 2 |

| ruling | v2 | v3 |
|---|---:|---:|
| KEEP_Q_DIRECTIVE | 2,424 | 2,482 |
| REMOVE_BLESSING_OR_VALEDICTION | 92 | 100 |
| REMOVE_STATEMENT_OR_HEADING | 43 | 45 |
| REMOVE_QUOTED_SCRIPTURE | 33 | 33 |
| KEEP_DIRECTIVE_AND_RELIGIOUS_THEME | 27 | 27 |
| REMOVE_QUOTED_OR_THIRD_PARTY | 61 | 5 |
| REMOVE_CODE_OR_TECHNICAL_TEXT *(new in v3)* | — | 5 |
| REMOVE_PRAYER_TEXT | 2 | 3 |
| NEEDS_CONTEXT | 21 | 2 |
| SPLIT_MIXED_SENTENCE | 2 | 2 |
| REMOVE_QUESTION_NOT_DIRECTIVE *(new in v3)* | — | 1 |

**83 of 2,705 rulings change.**

| movement | records |
|---|---:|
| REMOVE_QUOTED_OR_THIRD_PARTY → KEEP_Q_DIRECTIVE | 54 |
| NEEDS_CONTEXT → KEEP_Q_DIRECTIVE | 10 |
| NEEDS_CONTEXT → REMOVE_BLESSING_OR_VALEDICTION | 7 |
| KEEP_Q_DIRECTIVE → REMOVE_CODE_OR_TECHNICAL_TEXT | 4 |
| KEEP_Q_DIRECTIVE → REMOVE_QUOTED_OR_THIRD_PARTY | 2 |
| REMOVE_QUOTED_OR_THIRD_PARTY → REMOVE_STATEMENT_OR_HEADING | 2 |
| NEEDS_CONTEXT → REMOVE_PRAYER_TEXT | 1 |
| REMOVE_QUOTED_OR_THIRD_PARTY → REMOVE_QUESTION_NOT_DIRECTIVE | 1 |
| REMOVE_QUOTED_OR_THIRD_PARTY → REMOVE_BLESSING_OR_VALEDICTION | 1 |
| NEEDS_CONTEXT → REMOVE_CODE_OR_TECHNICAL_TEXT | 1 |

### Two new ruling values

Both exist because a gold fixture demanded an outcome no existing bucket could express:

- **`REMOVE_QUESTION_NOT_DIRECTIVE`** — #3. Q wrote the sentence, it ends in a period, and it is a grammatical
  question. It is not quoted, not a blessing, not scripture and not a statement heading, so every existing
  `REMOVE_*` value would have misfiled it. One record.
- **`REMOVE_CODE_OR_TECHNICAL_TEXT`** — #4437. Five records of scraped Capybara/Ruby. Rule 9 says code is never
  a Directive; it does not say code is quoted, and calling it `REMOVE_QUOTED_OR_THIRD_PARTY` would assert a
  provenance the parser has not established.

### The 19 NOT_LOCATED records

**All 19 now locate. None was downgraded to quoted.** The handoff's breakdown needs one correction:

| handoff said | actually |
|---|---|
| 7 blessing / Q-signature artefacts | 7 ✓ — #349 #353 #393 #394 #434 #767 #1025 |
| 9 directive-plus-URL concatenations | **8** — #2382 #2395 #2500 #2801 #3428 #3819×2 #3896 |
| 2 `DO NOT LOOK HERE [CHINA]` + URL | 2 ✓ — #2351 #2378 |
| 1 scraped JavaScript in #4437 | 1 ✓ |
| — | **1 unlisted:** #154, a three-line fragment of the Lord's Prayer |

Span repair by kind — separated deliberately, because most differences between a stored phrase and its
recovered span are typography, not repair:

| kind | records |
|---|---:|
| NONE | 2,685 |
| URL_CUT | 10 |
| SIGNATURE_CUT | 7 |
| MULTILINE_JOIN | 2 |
| TYPOGRAPHY_ONLY | 1 |

`URL_CUT` + `SIGNATURE_CUT` + `MULTILINE_JOIN` = 19 — exactly the 19 that were NOT_LOCATED.

**107 records are mid-sentence fragments** — the stored phrase begins part-way through a body line, so it is
a fragment of a longer sentence rather than something Q wrote on its own. Flagged in the CSV as `midSentence`,
not ruled on. This is a new finding and not part of the brief.

## Two judgement calls that need an owner ruling

Neither is a parser bug. Both change what the numbers mean, so they are surfaced rather than decided.

**1. A phrase in the body AND in a reproduced payload resolves to the body.**
Rule 6 says a phrase in both quoted context and current body returns AMBIGUOUS *when it cannot be uniquely
resolved*. A quoted-post payload is a separate region rather than text interleaved with the body, and the
analysis index is built from body text only, so V2 treats the body occurrence as the referent and records the
payload duplication as `alsoQuotedInPayload`. Reading rule 6 the other way holds 17 records whose ownership is
not in doubt — #316 "Expand your thinking.", #1266 "Trust the plan.", #729/#730 "Learn.", #1945 "Define
'Projection'." among them. Rule 6 still fires on genuine in-body collisions.

**2. #51 is held rather than removed.** Three records sit inside a letter addressed "Dear Patriot." and signed
"-The WH". Whether Q reproduced that letter or wrote a drop in letter voice is an editorial question, so all
three route to NEEDS_CONTEXT instead of being silently removed as third-party.

## Count reconciliation — the gap is in the remembered number

Derived by replaying the two functions the live page actually runs: `dedupePostArrays()` in
`src/lib/localData.ts` at seed time, then `normalizeItemKey()` grouping in `src/pages/QRequests.tsx`.
**No count pin was changed to force agreement.**

```
  2,705  raw stored actionRequests entries
  −  50  exact within-post duplicates          → 2,655   ✓ matches the handoff
  −   4  normalization collisions              → 2,651   ← the derived page figure
```

The handoff assumed **two** collisions (#1318, #4963) and one unexplained record. There are **four**, and there
is no unexplained record. The two never listed are **#730 and #731**, both `"Learn."` vs `"LEARN!!!!"` —
they collide because `dedupePostArrays` strips trailing `?.!,;:` before comparing, so `LEARN!!!!` and `Learn.`
normalize to the same key.

**The page renders 2,651 mentions, not 2,652.** Every dropped record is named in
`directives-page-count-reconciliation.md`. Posts represented: 1,538 ✓.

Phrase groups reconcile exactly with no correction needed: **1,763 raw distinct phrases − 70 folded across 57
groups = 1,693 displayed groups.**

Also checked: stored-but-not-rendered = the 54 above and nothing else; rendered-but-not-stored = 0 (the page
performs no backfill and no rescan); page-filtered by `hasRequests` = 0; empty display keys = 0.

## Downstream impact

Full matrix in `source-spans-v2-consumer-impact.md`. **No consumer was migrated.** Headline: 7 consumers would
see certified output move, 4 are reporting-only, the invariant gate migrates last and never in the same commit
as the classifications it verifies, and Questions cannot migrate at all until its frozen auditor is unfrozen
and re-pointed at `segment.mjs`.

One debt closes: `contracts.mjs` records sourceLines() over-extending quoted blocks across 123 posts, where a
quoted sentence and its URL merge. V2 makes those two spans by construction. Discharging a debt baseline is an
owner decision, so it is reported, not taken.

## Directives v4 — the five owner rulings applied (still shadow)

**21 / 21 ruling fixtures pass.** `directives-adjudication-v4-shadow.{csv,json}`, keyed by stable occurrence ID.

| ruling | outcome |
|---|---|
| **R1** body wins over reproduced payload | 17 records resolve to the body carrying `alsoQuotedInPayload: true`. #316, #1266, #729, #730 among them. AMBIGUOUS is now reserved for in-body collisions. |
| **R2** #51 is Q-authored letter voice | new sourceType `Q_BODY_LETTER_VOICE`. All three #51 records are `Q_AUTHORED_CURRENT_POST`. "Find peace." KEEP · "God bless and be safe." SPLIT with segments `God bless` / `be safe`, full sentence retained as the displayed span. |
| **R3** "Have faith…" is a Directive | all **46** records whose complete sentence carries the imperative are KEEP — 45 Directive-only, 1 dual-classified with Religion & Spirituality. `have ` was added to the imperative verb list; its absence is exactly why these matched RELIGIOUS and failed IMPERATIVE. |
| **R4** the derived page figure | accepted. Today: 2,651 mentions · 1,693 groups · 1,538 posts, recomputed through the real page functions. The page was not changed. |
| **R5** fragments repaired before migration | worksheets written; 1 record held. See the correction below. |

`priorRuling` is measured against **v2**, not v3. v3 is derived from the same library the owner
rulings were encoded into, so a v3 re-run moves when the rulings move — it is an intermediate, not a
baseline. v2 predates this whole shadow build and nothing here can rewrite it.

| ruling | v2 (frozen) | v4 |
|---|---:|---:|
| KEEP_Q_DIRECTIVE | 2,424 | 2,526 |
| REMOVE_BLESSING_OR_VALEDICTION | 92 | 100 |
| REMOVE_QUOTED_SCRIPTURE | 33 | 32 |
| KEEP_DIRECTIVE_AND_RELIGIOUS_THEME | 27 | 28 |
| REMOVE_QUOTED_OR_THIRD_PARTY | 61 | 5 |
| REMOVE_CODE_OR_TECHNICAL_TEXT *(new since v2)* | — | 5 |
| REMOVE_PRAYER_TEXT | 2 | 3 |
| NEEDS_CONTEXT | 21 | 2 |
| SPLIT_MIXED_SENTENCE | 2 | 2 |
| NEEDS_FRAGMENT_REVIEW *(new since v2)* | — | 1 |
| REMOVE_QUESTION_NOT_DIRECTIVE *(new since v2)* | — | 1 |
| REMOVE_STATEMENT_OR_HEADING | 43 | 0 |

**128 of 2,705 rulings move from the frozen v2 baseline.**

| movement | records |
|---|---:|
| REMOVE_QUOTED_OR_THIRD_PARTY → KEEP_Q_DIRECTIVE | 56 |
| REMOVE_STATEMENT_OR_HEADING → KEEP_Q_DIRECTIVE | 43 |
| NEEDS_CONTEXT → KEEP_Q_DIRECTIVE | 10 |
| NEEDS_CONTEXT → REMOVE_BLESSING_OR_VALEDICTION | 7 |
| KEEP_Q_DIRECTIVE → REMOVE_CODE_OR_TECHNICAL_TEXT | 4 |
| KEEP_Q_DIRECTIVE → REMOVE_QUOTED_OR_THIRD_PARTY | 2 |
| KEEP_Q_DIRECTIVE → NEEDS_FRAGMENT_REVIEW | 1 |
| NEEDS_CONTEXT → REMOVE_PRAYER_TEXT | 1 |
| REMOVE_QUOTED_OR_THIRD_PARTY → REMOVE_QUESTION_NOT_DIRECTIVE | 1 |
| REMOVE_QUOTED_OR_THIRD_PARTY → REMOVE_BLESSING_OR_VALEDICTION | 1 |
| REMOVE_QUOTED_SCRIPTURE → KEEP_DIRECTIVE_AND_RELIGIOUS_THEME | 1 |
| NEEDS_CONTEXT → REMOVE_CODE_OR_TECHNICAL_TEXT | 1 |

### R5 — the 107 splits into two very different populations

`startOffset > 0` and "is a fragment" are not the same question. Q writes several whole sentences on one
line — `List. Compare. Laugh.`, `VOTE! VOTE! VOTE!` — and every one after the first begins at a non-zero
offset while being complete. Measured against real sentence boundaries:

| population | records | what it is |
|---|---:|---|
| `SENTENCE_ON_SHARED_LINE` | 101 | a whole sentence sharing a line with its neighbours. Not a fragment. |
| `MID_SENTENCE_FRAGMENT` | 6 | genuinely clipped from mid-sentence. Five are #4437's scraped code; **one** needs an editor: #1252#1 `"Learn the TRUTH."` inside `"It's time to learn the TRUTH."` |

**The defect your four examples describe is a different one, and three of the four are not in the 107 at all.**
`"Push to DIVIDE is strong."` (#1183), `"Select news members…"` (#617) and `"Release coming."` (#566) all start
at offset 0 and are complete sentences. What is wrong with them is the other half of the rule: the leading
word is a noun or adjective, and only the complete sentence shows it. That is invisible to an offset test, so
it has its own worksheet — **26 candidates** in `audit/directives-declarative-lead-candidates.csv`,
including all four of your examples. The discrimination is genuinely editorial: `"Note the pictures we post
are ALL originals."` and `"Trust there are more good than bad."` lead with real imperatives followed by a
declarative clause, so the ruling column is blank there too.

### One #51 record you did not rule on, and one ruling with no record

- **#51#0 `"Rest assured POTUS is backed by the absolute finest people alive…"`** received no ruling. Under
  letter voice it defaults to KEEP_Q_DIRECTIVE — and it also appears in the declarative-lead worksheet,
  because "Rest assured … is backed …" may be a declarative rather than a command.
- **`"God is with us."`** is not one of #51's three stored `actionRequests`. There is no Directive record to
  remove; your ruling is recorded as a Religion & Spirituality assignment on a Q-authored body line, under
  `nonDirectiveRulings` in the v4 JSON.

### Count projection

| | mentions | groups | posts |
|---|---:|---:|---:|
| today (unchanged, live) | 2,651 | 1,693 | 1,538 |
| if v4 were applied, holds retained | 2,505 | 1,647 | 1,466 |

Projection only. **The page was not changed and still renders the stored data.** Recomputed with the same
two functions the page runs, per R4.

### Migration diff — provisional, and blocked

`directives-migration-diff-provisional.csv` carries one row per stable occurrence ID with the action a
Directives-only migration would take. It is **not** ready to run:

- 1 blocked on the fragment worksheet
- 26 blocked on the declarative-lead worksheet
- 2 blocked on #10's early-4chan provenance, held as you ruled


## What this session did not do

- did not modify `sourceLines()` or `scripts/lib/quotedBlocks.mjs`
- did not modify `scripts/audit-cross-section.mjs` or any invariant
- did not change any canonical Directive record, count pin, or certification file
- did not migrate any of the 15 consumers
- did not apply a single Directive removal or split
- did not bump the seed, build, or deploy
- did not touch the Subject-theme resolutions (themes 2,644, unchanged)

### Baseline drift during the session — read this before using any figure above

This audit was commissioned against **seed 70** with a resolution queue of **958**. The manifest now reads
**seed 71**, queue **755**, certified `2026-08-16T02:40:59.870Z` — a separate certification
pass landed while this shadow build was running. It was not this session: nothing here writes outside
`audit/source-spans-v2/` and the two editorial worksheets.

What that does and does not affect:

- **`public/data/posts.json` is byte-identical to its pinned sha256.** It is the only input to every figure
  in this document, so the whole analysis stands unchanged.
- The Directives pin is still 2,705 and Themes still 2,644.
- The Resolution Center queue moved 958 → 755. Any projection built on 958 is stale.
- `node scripts/certification-manifest.mjs --verify` passes against the new state.

Items 2–6 remain parked.
