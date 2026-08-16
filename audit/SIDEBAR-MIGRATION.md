# Sidebar migration — make the public app show the certified work

**Do this before the 840 conflicts and before highlight coverage.** This is a presentation and
materialisation repair. No certified semantics change. No section is reopened.

Confirmed still legacy on live qdrops.app after a hard refresh:

| Section | Live | Certified |
|---|---|---|
| Directives (`Requests`) | 4,529 / 1,417 posts | **2,422** / 1,417 posts |
| Claims | 5,820 / 2,082 | **4,181** / 1,951 |
| Predictions | 757 / 546 | **630** / 520 |
| Entities | 22,363 mentions / 2,325 items | **1,332** canonical / **7,903** mentions |
| Themes (materialised) | 10,453 | **2,393** |

The identical post count on Directives is the tell: the page has the right posts and re-scans them
at render time. A cache clear cannot fix it.

## Two defects

**A — stale `postAnalysis` fields.** `apply-entities.mjs` and `apply-themes.mjs` never rewrote
`postAnalysis.namedEntities` / `.themes`, which is what the UI reads. Claims, Predictions,
Directives, Emphasis, Conclusions and Checkable are already correct in `postAnalysis`.

**B — a live client-side extractor.** `getAnalysisFrequency()` in `src/lib/posts.ts` calls
`backfillFromText()` and `countPhraseOccurrences()`, re-scanning raw text per phrase at render.
This is what inflates every count in the table above. **This is the main fix.** Replace
*display phrase → raw-text rescan → inferred occurrences* with *certified occurrence records →
grouping for display*. Cards, frequency ordering, post chips, aliases and in-card search can all
stay; only what supplies them changes.

## The Entity tail ruling

The certified tail's occurrence counts were adopted from historical `postAnalysis.namedEntities`
entries — all 1,306 CANONICAL decisions match their legacy count exactly. That legacy data may be
used **only as transcription for occurrences the adjudication already approved**:

    legacy occurrence → adjudication decision → canonical/alias merge → certified occurrence

never `legacy occurrence → public Entity`. Do not rerun or improve the entity extractor.

Reconcile to **1,239 tail entities / 3,440 mentions** after alias merges. The raw pre-merge
CANONICAL sum is 3,609 — that is not the public metric. Then clear the guard in
`apply-entities.mjs` and materialise `postAnalysis.namedEntities`.

Prove the adjudication overrides the extractor: a routed/rejected token must not appear in
certified Entities, corrected types must win, merged aliases must resolve to the canonical entity.
Read `PEOPLE` / `THE PEOPLE`'s actual decision rather than assuming from the old screen.

## Verified sub-section reference

Read from the artifacts just now, not transcribed.

**Questions — 6,442** (5,302 distinct / 1,696 posts). 228 Question↔Directive overlaps: 177
information-request imperatives, 51 directive-wrapped. 134 editorial normalisations are searchable
and must never inflate the Q-authored count.

**Directives — 2,422** (1,472 distinct / 1,417 posts), seven families.

> ⚠️ **Counting hazard.** `postAnalysis.directiveFamilies` is keyed by normalised text *per post*,
> so summing its keys gives **2,369**, not 2,422 — the 53 in-post repeats collapse. Per-key counts
> are cognition 678 · morale 502 · research 479 · attention 309 · operational 258 ·
> dissemination 73 · prohibition 70. The published per-occurrence figures are cognition 691 ·
> morale 503 · research 496 · attention 310 · operational 261 · dissemination 91 · prohibition 70
> = 2,422. **Count occurrences, not keys**, or the families will silently under-report.

**Claims — 4,181** (3,226 distinct / 1,951 posts). Attributes: checkable 1,926 · source provided
438 · conclusion 966 · telegraphic 331.

> ⚠️ **Lookup hazard.** `claimMeta` keys are not plain lowercase-trimmed text. A naive
> `meta[text.toLowerCase().trim()]` lookup returns 64 checkable instead of 1,926 — it silently
> misses ~97% and looks like a small discrepancy rather than a broken join. Use the same key
> function the apply step used and assert the totals reconcile before shipping.

**Predictions — 630** (520 posts). Source provided 46, reported separately from the claims 438.

**Entities — 1,332 canonical / 7,903 mentions.** Core registry 93 / 4,463 · adjudicated tail
1,239 / 3,440.

**Codes & Brackets — 1,949 occurrences / 739 distinct / 852 posts.** By type: bracketed_token
1,329 · obfuscated_shorthand 286 · coded_phrase 195 · numeric_symbolic 134 · operational_marker 5.
Only 5 carry an interpretation; 734 ship undecoded, which is the honest state. Rename the sidebar
from `Q [ Brackets ]`.

**Themes — 2,393 assignments / 1,766 posts**, 18 frozen parents, multi-label by design.

**Conclusions — 966.** A *derived* Claim view (`claimMeta.isConclusion`). No independent
classifier.

**Checkable Claims — 1,926.** A *derived* Claim view (`claimMeta.checkable`). Checkable means
concrete enough to compare against records — never verified or true.

**Emphasis — 5,251 / 1,737 posts.** Capitals 2,418 · parallel phrasing 1,111 · bracket emphasis
716 · quoted word 624 · punctuation intensity 157 · repeated word 118 · repeated question 95 ·
repeated directive 11 · deliberate spacing 1.

**Evidence & References — 6,590 / 3,883 posts.** External links, media, internal Q references,
quoted source. Consider giving it a sidebar slot alongside the others. Verify the public
links/resources path does not rescan raw text for URLs.

**Resolution Center — 2,527**: 1,858 Reference · 251 Subject · 173 Notation · 245 Device.

**Context / Other Q Text — 4,901** reviewed context/label units. Not a sidebar section; a neutral
highlight class for the coverage work that follows.

## Order of work

1. Materialise tail entity occurrence provenance (postNum, alias text, canonical id, occurrence
   index, type, population) → reconcile 93+1,239 = 1,332 and 4,463+3,440 = 7,903
2. Clear the guard; apply Entities; apply Themes
3. Remove render-time recounting from `getAnalysisFrequency()`
4. Migrate every sidebar route to CERTIFIED_DIRECT or CERTIFIED_DERIVED — no LEGACY remains
5. Machine-readable sidebar provenance contract: label → route → component → artifact →
   direct/derived → expected metric
6. New UI-provenance invariant group testing the whole chain, kept separate from the 119
7. `tsc -b` → all invariants → regenerate manifest deliberately → `--verify` gate → deploy
8. **Poll live** until Pages propagates (it served stale artifacts for ~40s twice this session),
   then read every sidebar headline off the live site

## Acceptance test

Live qdrops.app shows: Questions 6,442 · Directives 2,422 · Claims 4,181 · Predictions 630 ·
Entities 1,332 / 7,903 · Codes 1,949 · Themes 2,393 · Conclusions 966 · Checkable 1,926 ·
Emphasis 5,251 — and every card beneath them is formed only from certified occurrences.

Deliverable: `audit/sidebar-certified-migration.md` with legacy → target → final-live per section.

## Architecture rule to encode

`postAnalysis` is a **derived cache**, never the source of truth:
certified artifacts → materialised post indexes → UI. The whole defect exists because
`entities.json` and `postAnalysis.namedEntities` could disagree indefinitely with nothing checking.

## Operational safety

Avoid broad working-tree operations. `git checkout public/data/` rolled back five uncommitted
generated artifacts and dropped the audit to 113/119. Restore specific files; check `git status`
before and after every generated-data operation.

## The facet-reconciliation invariant

Add this for **every** sidebar section that shows subsections or facets. It is the general form of
the two traps above, and it fires automatically instead of depending on someone noticing a 2%
discrepancy.

For each section, assert both:

1. **Facet sum = certified parent occurrence count.**
   Directive families must sum to 2,422, not 2,369. Emphasis types to 5,251. Code types to 1,949.
   Claim attributes are *attributes*, not a partition — assert each against its own certified
   figure (checkable 1,926 · conclusions 966 · source provided 438) and never sum them into the
   claims total.

2. **Occurrences are unique by occurrence identity, never by normalised text.**
   A grouped card may aggregate; the underlying rows must stay individually identifiable. If
   deduplicating by text changes a count, the count was wrong — that single test catches every
   collapsed in-post repeat, including the 53 in Directives and the six conclusions that briefly
   read as 960.

These two rules together are the non-negotiables:

- **Count certified occurrences, never normalised keys.**
- **Every metadata join uses the exact key function the apply step used** — no lowercase/trim, no
  ad hoc normalisation. A join that looks reasonable and returns 64 of 1,926 is worse than one
  that throws.

---

# Highlight phase — findings recorded before the pass begins

## 1. Themes can never highlight — root cause found

`PostDetail.tsx` builds its highlight pairs as `['theme', analysis.themes ?? []]`, so it searches
the post text for the theme **label**. The label is a taxonomy name — "Disclosure &
Declassification" — and is almost never literal text in the drop. What IS in the drop is the
certified **anchor**: the word the Themes audit recorded as firing the signal.

Confirmed on #4963: certified Theme *Disclosure & Declassification*, anchor `Whistleblowers`,
which appears in the post text. Nothing highlights, because the renderer is looking for the label.

**Fix:** highlight `themes.json` → `byPost[n][].evidence.anchors`, not the label. The anchors are
certified data recorded by the audit, so this is consumption rather than a new keyword rule. The
label belongs in the badge; the anchor is the span.

Verify on #4963 specifically: assignment exists, anchor resolves to a span, badge/count displays,
highlight renders on `Whistleblowers` and not on the label.

## 2. Search state must not look like certified truth

`Ascension.` is certified in NO layer in either #4963 or #4966. Any highlight it carries comes
from the `keyword` branch of `highlightText()` — view state from clicking or searching a term,
not classification. A reader cannot currently tell that apart from a category highlight, which
means the app can show search state with the authority of certified analysis.

**Fix:** give keyword/search matches a structurally different treatment — outline, underline or a
dedicated search state — never a semantic category colour.

## Two invariants for the phase

1. **Certified-render.** Every certified occurrence or anchor intended for display resolves to an
   exact source span and renders its category treatment.
2. **Uncertified-render.** No unclassified span may render with a treatment indistinguishable
   from a certified category highlight.

Verify **both directions**: certified must visibly render; not-certified must not look certified.

## Cross-post consistency review

For every canonical term certified in one post, report identical occurrences elsewhere with their
categories present/absent. **Flag for review; never auto-classify.** The same text can legitimately
carry different classifications in different contexts — that is what Themes and context-dependent
Entities are for. `Apple` the company and `Apple` the fruit is the case this protects.

---

# The actual finish line: no visually unexplained Q-authored text

`TRUE_UNCATEGORIZED = 0` proves every unit has a **disposition**. It does not prove the reader can
**see** that it was reviewed. Those are different claims, and only the first is currently true.

A reader scrolling the archive still sees large amounts of plain text. That text is not
uncategorised — it is one of these, and none of them yet has an on-screen treatment:

| Why a line looks plain | Units | Status |
|---|---|---|
| Context / Other Q Text — reviewed, legitimately no semantic category | 4,901 | **no neutral treatment yet** |
| Certified but materialisation broken | 2,145 remaining | in repair |
| Certified span exists, renderer does not paint it | ~7,606 | live-audit population |
| Badge-only — certified with no body span | 2,186 | correct as-is, needs a badge a reader understands |
| Unresolved — shown as chips below the post | 2,527 | not marked inline |
| Non-analytical structure | 4,190 | signature, separators, board metadata |

**The standard for all 4,966 posts:**

Every meaningful Q-authored unit must carry one of —
- its certified semantic category colour, where a certified span exists
- a secondary certified annotation
- a neutral **Context / Other Q Text** treatment
- a visible **unresolved** marking
- a visible **source / reference** treatment
- an explicit structural/non-analytical treatment

and there must be:
- **no plain, unexplained Q-authored text**
- **no uncertified semantic-looking highlight**

The second half already has a rule (`RENDERING_PROVENANCE_RULE`). The first half is the work that
makes the audit visible instead of buried in the data — and it is what the user actually asked for
at the start of this project.
