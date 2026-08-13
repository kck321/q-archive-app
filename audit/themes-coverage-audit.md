# Themes — stratified coverage audit of the legacy-only gap

Population: **8,700** legacy-only tags. Sampled: **300** across four strata. Sampling is strided, so a rerun after a signal fix is comparable to this one. **No production write, no deploy.**


## Outcome

| Outcome | Count | Share |
|---|---|---|
| OLD_EXTRACTOR_NOISE | 172 | 57% |
| ONTOLOGY_GAP | 56 | 19% |
| VALID_THEME_ALREADY_COVERED_DIFFERENTLY | 51 | 17% |
| NEEDS_CONTEXT | 17 | 6% |
| VALID_THEME_SIGNAL_MISSING | 4 | 1% |

## By stratum

| Stratum | OLD_EXTRACTOR_NOISE | VALID_THEME_ALREADY_COVERED_DIFFERENTLY | ONTOLOGY_GAP | NEEDS_CONTEXT | VALID_THEME_SIGNAL_MISSING |
|---|---|---|---|---|---|
| high-frequency legacy labels | 41 | 20 | 39 | 0 | 0 |
| rare / single-use labels | 73 | 15 | 0 | 10 | 2 |
| posts with no v1 theme | 39 | 0 | 4 | 7 | 0 |
| v1 and legacy disagree | 19 | 16 | 13 | 0 | 2 |

## Actionable — signals that should have fired

| Theme | Sampled misses |
|---|---|
| Media & Information | 1 |
| Foreign Affairs | 1 |
| Law Enforcement & Investigations | 1 |
| Government & Politics | 1 |

## Possible ontology gaps — recurring labels with no home

| Legacy label | Times in corpus |
|---|---|
| information control | 4 |
| pattern recognition | 4 |
| deep state conspiracy | 3 |
| insider knowledge | 3 |
| collective action | 2 |
| deep state | 2 |
| hidden truth | 2 |
| coordinated messaging | 2 |
| deep state coordination | 2 |
| patriotism | 2 |
| operational security | 2 |
| future revelation | 2 |
| deep state resistance | 2 |
| hidden knowledge | 1 |
| hidden truth revelation | 1 |
| coordinated attacks | 1 |
| deep state control | 1 |
| call to action | 1 |
| deep state operations | 1 |
| executive authority | 1 |

## Examples


**OLD_EXTRACTOR_NOISE**

| Post | Legacy label | Mapped to | v1 assigned | Why |
|---|---|---|---|---|
| #55 | cryptic messaging | Q Movement & Community | Religion & Spirituality | the label describes how Q writes, not what the text is about — that belongs to Emphasis or |
| #327 | cryptic messaging | Q Movement & Community | — | the label describes how Q writes, not what the text is about — that belongs to Emphasis or |
| #577 | cryptic messaging | Q Movement & Community | — | the label describes how Q writes, not what the text is about — that belongs to Emphasis or |
| #831 | cryptic messaging | Q Movement & Community | Justice & Courts | the label describes how Q writes, not what the text is about — that belongs to Emphasis or |
| #955 | cryptic messaging | Q Movement & Community | — | the label describes how Q writes, not what the text is about — that belongs to Emphasis or |
| #1122 | cryptic messaging | Q Movement & Community | — | the label describes how Q writes, not what the text is about — that belongs to Emphasis or |
| #1394 | cryptic messaging | Q Movement & Community | — | the label describes how Q writes, not what the text is about — that belongs to Emphasis or |
| #1721 | cryptic messaging | Q Movement & Community | — | the label describes how Q writes, not what the text is about — that belongs to Emphasis or |

**VALID_THEME_ALREADY_COVERED_DIFFERENTLY**

| Post | Legacy label | Mapped to | v1 assigned | Why |
|---|---|---|---|---|
| #4397 | media manipulation | Media & Information | Religion & Spirituality | the post is already tagged Religion & Spirituality; the legacy label names the same subjec |
| #247 | government corruption | Government & Politics | Q Movement & Community | the post is already tagged Q Movement & Community; the legacy label names the same subject |
| #76 | political corruption | Government & Politics | Corruption & Influence, Religion & Spirituality, Q Movement & Community | the post is already tagged Corruption & Influence, Religion & Spirituality, Q Movement & C |
| #350 | deep state corruption | Corruption & Influence | Media & Information, Finance & Economic Power | the post is already tagged Media & Information, Finance & Economic Power; the legacy label |
| #3330 | deep state corruption | Corruption & Influence | Intelligence & Surveillance, Law Enforcement & Investigations, National Security & Military | the post is already tagged Intelligence & Surveillance, Law Enforcement & Investigations,  |
| #194 | classified information | Intelligence & Surveillance | Foreign Affairs | the post is already tagged Foreign Affairs; the legacy label names the same subject more n |
| #1753 | institutional corruption | Corruption & Influence | Intelligence & Surveillance, Media & Information | the post is already tagged Intelligence & Surveillance, Media & Information; the legacy la |
| #1455 | government conspiracy | Government & Politics | Law Enforcement & Investigations | the post is already tagged Law Enforcement & Investigations; the legacy label names the sa |

**ONTOLOGY_GAP**

| Post | Legacy label | Mapped to | v1 assigned | Why |
|---|---|---|---|---|
| #195 | information control | null | Foreign Affairs | "information control" recurs 68 times and fits none of the 18 parents |
| #1478 | information control | null | — | "information control" recurs 68 times and fits none of the 18 parents |
| #4024 | information control | null | — | "information control" recurs 68 times and fits none of the 18 parents |
| #953 | deep state conspiracy | null | Government & Politics, Law Enforcement & Investigations, Foreign Affairs | "deep state conspiracy" recurs 62 times and fits none of the 18 parents |
| #2789 | deep state conspiracy | null | Government & Politics, Q Movement & Community | "deep state conspiracy" recurs 62 times and fits none of the 18 parents |
| #81 | pattern recognition | null | — | "pattern recognition" recurs 60 times and fits none of the 18 parents |
| #1108 | pattern recognition | null | — | "pattern recognition" recurs 60 times and fits none of the 18 parents |
| #1872 | pattern recognition | null | — | "pattern recognition" recurs 60 times and fits none of the 18 parents |

**NEEDS_CONTEXT**

| Post | Legacy label | Mapped to | v1 assigned | Why |
|---|---|---|---|---|
| #540 | accountability and justice | Justice & Courts | — | a one-off label with no corroborating text; not enough to act on |
| #827 | Russian defector | Foreign Affairs | — | a one-off label with no corroborating text; not enough to act on |
| #2256 | law enforcement coordination | Law Enforcement & Investigations | — | a one-off label with no corroborating text; not enough to act on |
| #2649 | media obstruction | Media & Information | — | a one-off label with no corroborating text; not enough to act on |
| #2887 | national security risk | National Security & Military | — | a one-off label with no corroborating text; not enough to act on |
| #3329 | leaks and investigations | Law Enforcement & Investigations | — | a one-off label with no corroborating text; not enough to act on |
| #3656 | government tyranny | Government & Politics | — | a one-off label with no corroborating text; not enough to act on |
| #4278 | election campaign finance | Elections & Voting | — | a one-off label with no corroborating text; not enough to act on |

**VALID_THEME_SIGNAL_MISSING**

| Post | Legacy label | Mapped to | v1 assigned | Why |
|---|---|---|---|---|
| #689 | news cycle timing | Media & Information | — | the label's own words (news, cycle) appear in Q's lines but no Media & Information signal  |
| #1491 | Iranian resistance | Foreign Affairs | Censorship & Technology | the label's own words (iranian, resistance) appear in Q's lines but no Foreign Affairs sig |
| #3784 | criminal investigation | Law Enforcement & Investigations | Intelligence & Surveillance, Disclosure & Declassification | the label's own words (criminal, investigation) appear in Q's lines but no Law Enforcement |
| #4408 | political revolution | Government & Politics | Social Movements & Culture | the label's own words (political, revolution) appear in Q's lines but no Government & Poli |
