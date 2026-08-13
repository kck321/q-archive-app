# Entities — adjudicating the uncovered tail

**No production write, no deploy.** Nothing is promoted because an older extractor stored it.


## The cutoff

| Occurrences | Rule |
|---|---|
| ≥ 2 | canonicalise if the referent is identifiable |
| 1 | canonicalise only if unmistakably named and meaningful |
| ambiguous | never guessed — the literal token is kept, `contextDependent: true` |

## Outcome

| Outcome | Strings |
|---|---|
| CANONICAL | 1,306 |
| UNRESOLVED | 972 |
| ROUTE_TO_THEMES | 17 |

### New canonical entities by type

| Type | Count |
|---|---|
| other named entity | 583 |
| person | 482 |
| organization | 83 |
| location | 44 |
| media organization | 38 |
| government institution | 37 |
| country region | 27 |
| religious spiritual | 8 |
| title role | 3 |
| coded alias | 1 |

## Why concept nouns are not entities

`THE PEOPLE`, `Patriots`, `MSM`, `Deep State` name an idea or a crowd, not a specific organisation. Promoting them would turn every capitalised concept into a subject with a mention count it never had. They are **routed to Themes**, not deleted — nothing is lost, and the Themes section is where a recurring subject belongs.


## New canonical entities (top 80 by stored frequency)

| Source text | Occurrences | Type | Why |
|---|---|---|---|
| POTUS | 370 | title role | President of the United States — the referent depends on the drop’s date. |
| God | 204 | religious spiritual | religious or spiritual referent |
| House | 37 | government institution | government institution |
| QAnon | 32 | other named entity | named referent appearing more than once, type not determined |
| MSDNC | 24 | other named entity | named referent appearing more than once, type not determined |
| NO NAME | 16 | coded alias | Widely read as John McCain. Resolved only where the surrounding drop supports it. |
| WikiLeaks | 16 | organization | named organisation |
| Grassley | 15 | person | single capitalised surname appearing more than once |
| GOOG | 15 | other named entity | named referent appearing more than once, type not determined |
| Alice & Wonderland | 15 | other named entity | named referent appearing more than once, type not determined |
| Syria | 14 | country region | country |
| Reddit | 14 | organization | named organisation |
| COVID-19 | 14 | other named entity | named referent appearing more than once, type not determined |
| President | 13 | person | single capitalised surname appearing more than once |
| New York | 13 | location | place name |
| Podesta | 13 | person | single capitalised surname appearing more than once |
| Reuters | 12 | organization | named organisation |
| James Baker | 12 | person | given name or particle followed by a surname |
| Peter Strzok | 12 | person | given name or particle followed by a surname |
| Justice K | 12 | other named entity | named referent appearing more than once, type not determined |
| Whitaker | 12 | person | single capitalised surname appearing more than once |
| Germany | 11 | country region | country |
| D's | 11 | other named entity | named referent appearing more than once, type not determined |
| MS13 | 11 | other named entity | named referent appearing more than once, type not determined |
| Lisa Page | 11 | person | given name or particle followed by a surname |
| Utah | 11 | person | single capitalised surname appearing more than once |
| Pentagon | 11 | person | single capitalised surname appearing more than once |
| Amazon | 11 | organization | named organisation |
| Politico | 11 | organization | named organisation |
| Clapper | 10 | person | single capitalised surname appearing more than once |
| France | 10 | country region | country |
| Gowdy | 10 | person | single capitalised surname appearing more than once |
| Hunter Biden | 10 | other named entity | a proper name with no signal of what kind of thing it is — named, but the type is unestablished |
| US Military | 9 | other named entity | named referent appearing more than once, type not determined |
| Bruce Ohr | 9 | person | given name or particle followed by a surname |
| Kim | 9 | other named entity | named referent appearing more than once, type not determined |
| AF1 | 9 | other named entity | named referent appearing more than once, type not determined |
| Daily Beast | 9 | other named entity | a proper name with no signal of what kind of thing it is — named, but the type is unestablished |
| Graham | 9 | person | single capitalised surname appearing more than once |
| President of the United States | 9 | other named entity | named referent appearing more than once, type not determined |
| CBS_Herridge | 9 | other named entity | named referent appearing more than once, type not determined |
| Carter Page | 8 | other named entity | a proper name with no signal of what kind of thing it is — named, but the type is unestablished |
| Awan | 8 | person | single capitalised surname appearing more than once |
| Bing | 8 | organization | named organisation |
| MSNBC | 8 | other named entity | named referent appearing more than once, type not determined |
| No Name | 8 | other named entity | a proper name with no signal of what kind of thing it is — named, but the type is unestablished |
| Wray | 8 | person | single capitalised surname appearing more than once |
| Reagan | 8 | person | single capitalised surname appearing more than once |
| Planned Parenthood | 8 | organization | named organisation |
| Bill Priestap | 8 | other named entity | named legislation or doctrine |
| AG | 8 | title role | Attorney General — several different people held this office across the corpus. |
| bad actors | 8 | other named entity | named referent appearing more than once, type not determined |
| Ryan | 8 | person | single capitalised surname appearing more than once |
| USA Today | 8 | other named entity | named referent appearing more than once, type not determined |
| Qanon | 8 | person | single capitalised surname appearing more than once |
| Hunter | 8 | person | single capitalised surname appearing more than once |
| McCain | 8 | other named entity | named referent appearing more than once, type not determined |
| Asia | 8 | person | single capitalised surname appearing more than once |
| 4chan | 7 | other named entity | named referent appearing more than once, type not determined |
| AWAN | 7 | other named entity | named referent appearing more than once, type not determined |
| Japan | 7 | country region | country |
| LEFT | 7 | other named entity | named referent appearing more than once, type not determined |
| Paul Ryan | 7 | person | given name or particle followed by a surname |
| Turley | 7 | person | single capitalised surname appearing more than once |
| Bill Clinton | 7 | other named entity | named legislation or doctrine |
| Page | 7 | person | single capitalised surname appearing more than once |
| CNBC | 7 | other named entity | named referent appearing more than once, type not determined |
| Judicial Watch | 7 | other named entity | a proper name with no signal of what kind of thing it is — named, but the type is unestablished |
| Nellie Ohr | 7 | person | given name or particle followed by a surname |
| Steele | 7 | person | single capitalised surname appearing more than once |
| ASIA | 7 | other named entity | named referent appearing more than once, type not determined |
| Feinstein | 7 | person | single capitalised surname appearing more than once |
| Daily Caller | 7 | other named entity | a proper name with no signal of what kind of thing it is — named, but the type is unestablished |
| Sara Carter | 7 | person | given name or particle followed by a surname |
| Scaramucci | 7 | person | single capitalised surname appearing more than once |
| John Perry Barlow | 7 | person | given name or particle followed by a surname |
| AC-130 | 7 | other named entity | named referent appearing more than once, type not determined |
| MI6 | 6 | organization | named organisation |
| Merkel | 6 | person | single capitalised surname appearing more than once |
| Manafort | 6 | person | single capitalised surname appearing more than once |

## Routed to Themes

| Source text | Occurrences |
|---|---|
| THE PEOPLE | 125 |
| MSM | 96 |
| Patriots | 16 |
| Anons | 12 |
| FAKE NEWS | 9 |
| State | 7 |
| Time | 4 |
| Anon | 3 |
| Media | 3 |
| Big Pharma | 2 |
| Justice | 2 |
| World | 2 |
| Deep State | 1 |
| Black Americans | 1 |
| Fake News | 1 |
| Nation | 1 |
| PATRIOTS | 1 |

## Left unresolved — deliberately

These are kept as literal tokens with `contextDependent: true`. A wrong canonicalisation is worse than an unresolved one.

| Source text | Occurrences | Why |
|---|---|---|
| DC | 67 | Usually Washington, D.C., but also appears as initials. Resolved to the city only where context supports it. |
| US | 47 | initials or shorthand with no single referent — kept as the literal token |
| Clinton | 47 | A surname shared by Hillary and Bill Clinton. Q uses it for both, so it is not resolved to a person without surrounding context. |
| BO | 41 | In this corpus "BO" is used both for the 8chan/8kun Board Owner and, in some drops, for Barack Obama. A context probe over all 77 mentions found 5 clearly board-owner, 7 clearly Obama-adjacent and 65 undecidable from surrounding text. |
| SC | 26 | Used for both a court and a person’s initials across different drops. |
| LL | 25 | Shorthand used for a named individual in some drops and ambiguous in others. |
| CA | 23 | Used for a US state and, in some drops, a person’s initials. |
| JC | 20 | Used for more than one individual across the corpus. |
| Jack | 18 | A given name used for more than one individual across the corpus. |
| JFK | 15 | John F. Kennedy in some drops, JFK airport in others, and JFK Jr. in a third set. Not resolved by the token alone. |
| ABC | 14 | initials or shorthand with no single referent — kept as the literal token |
| AUS | 14 | initials or shorthand with no single referent — kept as the literal token |
| AS | 13 | Two letters that appear both as Q’s shorthand for a named individual and as the ordinary English word. Not resolved without corroborating context. |
| BC | 13 | initials or shorthand with no single referent — kept as the literal token |
| DNI | 12 | initials or shorthand with no single referent — kept as the literal token |
| JA | 11 | initials or shorthand with no single referent — kept as the literal token |
| WL | 11 | initials or shorthand with no single referent — kept as the literal token |
| CS | 11 | initials or shorthand with no single referent — kept as the literal token |
| NYC | 11 | initials or shorthand with no single referent — kept as the literal token |
| ES | 11 | initials or shorthand with no single referent — kept as the literal token |
| CDC | 11 | initials or shorthand with no single referent — kept as the literal token |
| MI | 9 | Used for Military Intelligence, and also appears as a state abbreviation and inside other tokens. |
| FED | 9 | initials or shorthand with no single referent — kept as the literal token |
| VJ | 9 | initials or shorthand with no single referent — kept as the literal token |
| SIS | 9 | initials or shorthand with no single referent — kept as the literal token |
| WHO | 8 | initials or shorthand with no single referent — kept as the literal token |
| SR | 8 | Used for Seth Rich in several drops and as an ordinary abbreviation elsewhere. |
| GS | 8 | initials or shorthand with no single referent — kept as the literal token |
| PS | 8 | initials or shorthand with no single referent — kept as the literal token |
| BBC | 8 | initials or shorthand with no single referent — kept as the literal token |
| RBG | 7 | initials or shorthand with no single referent — kept as the literal token |
| CM | 7 | initials or shorthand with no single referent — kept as the literal token |
| BLM | 7 | initials or shorthand with no single referent — kept as the literal token |
| NG | 6 | initials or shorthand with no single referent — kept as the literal token |
| JK | 6 | initials or shorthand with no single referent — kept as the literal token |
| LP | 6 | initials or shorthand with no single referent — kept as the literal token |
| JB | 6 | initials or shorthand with no single referent — kept as the literal token |
| NSC | 6 | initials or shorthand with no single referent — kept as the literal token |
| MZ | 5 | initials or shorthand with no single referent — kept as the literal token |
| NPR | 5 | initials or shorthand with no single referent — kept as the literal token |
