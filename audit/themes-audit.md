# Q Drops — Themes audit (v1, candidate)

A multi-label layer, not a sentence class: one post can carry several themes. **No production write, no deploy.**


## Why a controlled ontology

The earlier extractor emitted free text and produced **5,094 distinct labels for 10,453 tags**, 77% of them appearing once — `deep state`, `deep state conspiracy`, `deep state corruption` and `deep state coordination` are four labels for one idea. Those strings are now used as **corroboration**, mapped onto the parents, rather than as labels.


## The rule

A theme is assigned on converging evidence, never on one word appearing:

| Evidence | Confidence |
|---|---|
| An anchor phrase specific enough to carry the theme alone | HIGH |
| 2+ support signals AND the old label agrees | HIGH |
| 2+ support signals | MEDIUM |
| 1 support signal AND the old label agrees | LOW — kept only if it is the post’s only theme |

Quoted and pasted source material is removed first, so an article Q reproduced cannot give Q a theme.


## Totals

| Measure | Value |
|---|---|
| Theme assignments | **2,393** |
| Posts with at least one | 1,766 |
| Posts with more than one | 378 |
| Average per tagged post | 1.36 |
| Sent to the Resolution Center | 251 |

### By theme

| Theme | Posts |
|---|---|
| Q Movement & Community | 404 |
| Media & Information | 301 |
| Intelligence & Surveillance | 246 |
| Government & Politics | 213 |
| Law Enforcement & Investigations | 205 |
| Religion & Spirituality | 139 |
| Disclosure & Declassification | 129 |
| Elections & Voting | 123 |
| Censorship & Technology | 114 |
| National Security & Military | 91 |
| Health & Medicine | 73 |
| Foreign Affairs | 69 |
| Social Movements & Culture | 59 |
| Justice & Courts | 59 |
| Corruption & Influence | 57 |
| Finance & Economic Power | 54 |
| Historical Events | 34 |
| Trafficking & Exploitation | 23 |

### By confidence

| Confidence | Assignments |
|---|---|
| HIGH | 1,732 |
| LOW | 452 |
| MEDIUM | 209 |

## Ambiguous — routed to the Resolution Center

Two situations, both left for review rather than decided quietly:

- a context guard fired — the signals are there but the words are doing something else

- the old extractor saw a subject that no controlled signal corroborates in Q’s own lines

| Post | Theme | Why |
|---|---|---|
| #1008 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #11 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1164 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1179 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #120 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1253 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1273 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1279 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1283 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1284 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1286 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1287 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1318 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1319 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1328 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1351 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1370 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #14 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1401 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1433 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1439 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1453 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1470 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1481 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1489 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1492 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1494 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1496 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #15 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #151 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1522 | Censorship & Technology | signals for Censorship & Technology are present, but the company appears in a market context rather than a platform-conduct one |
| #1546 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1547 | Censorship & Technology | signals for Censorship & Technology are present, but the company appears in a market context rather than a platform-conduct one |
| #1552 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1553 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #158 | Censorship & Technology | signals for Censorship & Technology are present, but the company appears in a market context rather than a platform-conduct one |
| #1605 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1609 | Censorship & Technology | signals for Censorship & Technology are present, but the company appears in a market context rather than a platform-conduct one |
| #165 | Censorship & Technology | signals for Censorship & Technology are present, but the company appears in a market context rather than a platform-conduct one |
| #1659 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #166 | Censorship & Technology | signals for Censorship & Technology are present, but the company appears in a market context rather than a platform-conduct one |
| #1660 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1708 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1711 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1719 | Censorship & Technology | signals for Censorship & Technology are present, but the company appears in a market context rather than a platform-conduct one |
| #1723 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1728 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1743 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1745 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1746 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1753 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1772 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1779 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1797 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #18 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1807 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1822 | Censorship & Technology | signals for Censorship & Technology are present, but the company appears in a market context rather than a platform-conduct one |
| #1822 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1826 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |
| #1829 | Foreign Affairs | signals for Foreign Affairs are present, but the country appears as the subject of an investigation rather than of diplomacy |

_…and 191 more in the JSON._
