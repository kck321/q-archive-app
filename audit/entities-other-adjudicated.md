# Entities — final typing pass over `other_named_entity`

**No production write, no deploy.** The 972 unresolved aliases are untouched and the Themes routing stands.


Type is never inferred from capitalisation. Every decision rests on a known suffix/pattern or on CONTEXT — how the string is actually used in the drops.


## Outcome

| | Count |
|---|---|
| Reviewed | 583 |
| Given a type | **477** |
| Remain `other_named_entity` | 106 |

### New types assigned

| Type | Count |
|---|---|
| person | 407 |
| media organization | 9 |
| legislation regulation | 9 |
| government institution | 8 |
| event incident | 8 |
| facility property | 7 |
| creative work | 6 |
| title role | 6 |
| coded alias | 5 |
| organization | 5 |
| technology platform | 4 |
| military asset vessel | 3 |

## Final type distribution across all canonical entities

| Type | Entities |
|---|---|
| person | 889 |
| other named entity | 106 |
| organization | 88 |
| media organization | 47 |
| government institution | 45 |
| location | 44 |
| country region | 27 |
| title role | 9 |
| legislation regulation | 9 |
| religious spiritual | 8 |
| event incident | 8 |
| facility property | 7 |
| coded alias | 6 |
| creative work | 6 |
| technology platform | 4 |
| military asset vessel | 3 |

## The fix that mattered most

Legislation keywords now have to come **last**. `Hatch Act` and `Eleventh Amendment` are laws; `Bill Priestap` and `Bill Clinton` are people whose given name happens to be Bill, and a keyword-anywhere rule had filed both of them as legislation.


## Retyped, top 80

| Source text | × | New type | Basis | Context |
|---|---|---|---|---|
| MSDNC | 24 | media organization | a news outlet | …THE [MSDNC] IS DEAD.… |
| GOOG | 15 | technology platform | a technology platform or service | …[GOOG].… |
| Alice & Wonderland | 15 | creative work | a known title | …[Alice & Wonderland] – understood.… |
| Justice K | 12 | coded alias | one of Q’s coded names; resolved only where context supports it | …[Justice K] confirmation… |
| Hunter Biden | 10 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| US Military | 9 | government institution | a government body | …[US Military] = savior of mankind.… |
| AF1 | 9 | military asset vessel | military designation or vessel prefix | …[AF1] (inside) thereafter.… |
| Daily Beast | 9 | media organization | a news outlet | …[Daily Beast] – Jackie Kucinich… |
| President of the United States | 9 | title role | an office description rather than a named person | …Was the former [President of the United States] groomed to  |
| CBS_Herridge | 9 | media organization | a news outlet | …https://twitter.com/[CBS_Herridge]/status/12606358722712289 |
| Carter Page | 8 | person | a capitalised personal-name shape left after every other pattern was tested | …[Carter Page] was a plant.… |
| MSNBC | 8 | media organization | a news outlet | …[MSNBC] next?… |
| No Name | 8 | coded alias | one of Q’s coded names; resolved only where context supports it | …What forces shadowed [No Name]?… |
| Bill Priestap | 8 | person | a capitalised personal-name shape left after every other pattern was tested | …[Bill Priestap], Head of Counterintelligence and Strzok… |
| USA Today | 8 | media organization | a news outlet |  |
| 4chan | 7 | technology platform | a technology platform or service | …ttp://nymag.com/selectall/2017/12/qanon-[4chan]-the-storm-c |
| Bill Clinton | 7 | person | a capitalised personal-name shape left after every other pattern was tested | …Think [Bill Clinton] impeachment.… |
| CNBC | 7 | media organization | a news outlet | …[CNBC] – John Harwood… |
| Judicial Watch | 7 | organization | a named organisation |  |
| Daily Caller | 7 | media organization | a news outlet |  |
| AC-130 | 7 | military asset vessel | military designation or vessel prefix |  |
| Adm R | 6 | coded alias | one of Q’s coded names; resolved only where context supports it | …Why is [Adm R] so important? … |
| Red Cross | 6 | organization | a named organisation | …[Red Cross] Iran.… |
| 8ch | 6 | technology platform | a technology platform or service | …[8ch] risk (DDOS_+_inject).… |
| SDNY | 6 | government institution | a government body | …[[SDNY]-AG]?… |
| Trisha Anderson | 6 | person | used with a personal title or a verb only a person takes | …[Trisha Anderson]?… |
| CrowdStrike | 6 | technology platform | a technology platform or service | …Pro TIP: Look @ [CrowdStrike] … |
| DoD | 6 | government institution | a government body | …TEST [Thursday] by [DoD] to confirm 'free-flow' of direct c |
| AG Sessions | 5 | person | used with a personal title or a verb only a person takes | …t slush fund was recently terminated by [AG Sessions]?… |
| Josh Campbell | 5 | person | used with a personal title or a verb only a person takes (in 5 places) | …[Josh Campbell], Special Assistant to James Comey - FIR… |
| Clowns In America | 5 | coded alias | one of Q’s coded names; resolved only where context supports it | …No Such Agency vs [Clowns In America].… |
| Freedom Caucus | 5 | government institution | a government body | …[Freedom Caucus].… |
| John M | 5 | coded alias | one of Q’s coded names; resolved only where context supports it | …What if [John M]’s surgery was fake?… |
| US President | 5 | title role | an office description rather than a named person | …Which [US President] is affiliated w/ HUMA?… |
| Jussie Smollett | 5 | person | a capitalised personal-name shape left after every other pattern was tested | …"FBI & DOJ to review the outrageous [Jussie Smollett] case  |
| Midnight Riders | 5 | person | a capitalised personal-name shape left after every other pattern was tested | …Modern day '[Midnight Riders]'. … |
| Ray Chandler | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …[Ray Chandler] = Allison Mack x 100… |
| Ezra Cohen-Watnick | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …[Ezra Cohen-Watnick]… |
| Iron Eagle | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …[Iron Eagle].… |
| Special Counsel | 4 | person | used with a personal title or a verb only a person takes (in 2 places) | …er any matters merit the appointment of [Special Counsel].” |
| Hong Kong | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …Hong Kong: [Hong Kong] Monetary Authority… |
| NXIVM | 4 | person | used with a personal title or a verb only a person takes (in 2 places) | …Allison Mack [[NXIVM]] arrested [date]?… |
| Shadow Brokers | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …[Shadow Brokers] release actual code (NSA_key(s)).… |
| Business Insider | 4 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| The Guardian | 4 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| Tashina Gauhar | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …[Tashina Gauhar]?… |
| Attorney General | 4 | title role | an office description rather than a named person | …John Carlin, Assistant [Attorney General] – Head of DOJ’s N |
| NAT SEC | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …HUSSEIN "STATE SECRETS" WH [NAT SEC] ARTICLES 1-9 - BURIED? |
| MAGA | 4 | person | used with a personal title or a verb only a person takes | …https://mobile.twitter.com/KB[MAGA]FL/status/10083869459055 |
| The Atlantic | 4 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| VIP Patriot | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …[VIP Patriot]s!… |
| Valerie Jarrett | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …Who is [Valerie Jarrett]? … |
| Maggie NYT | 4 | person | a capitalised personal-name shape left after every other pattern was tested | …(above) v last drops [HouseOfCards] re: [Maggie NYT] re: WL |
| Washington Examiner | 4 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| Cory Booker | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …$1.8mm [Cory Booker] - Singapore.… |
| Trump Tower | 3 | facility property | a named facility or installation |  |
| Building 8 | 3 | facility property | a named facility or installation | …[Building 8].… |
| Mr. President | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …Welcome [Mr. President].… |
| MIL INTEL | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …[MIL INTEL] providing support during this time?… |
| Frank LoBiondo | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …[Frank LoBiondo] - Republican … |
| Lynn Jenkins | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …[Lynn Jenkins] - Republican … |
| Tim Murphy | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …[Tim Murphy] - Republican U.S. House… |
| NY AG | 3 | person | used with a personal title or a verb only a person takes | …Why is the [NY AG] resignation important? … |
| Allison Mack | 3 | person | used with a personal title or a verb only a person takes | …[Allison Mack] [NXIVM] arrested [date]?… |
| New Zealand | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …New Zealand: Reserve Bank of [New Zealand]… |
| 2016 election | 3 | event incident | discussed as something that happened | …Think pre vs post [2016 election].… |
| Daily Mail | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …[Daily Mail]… |
| Bill Maher | 3 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| New York Magazine | 3 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| Catholic Church | 3 | person | a capitalised personal-name shape left after every other pattern was tested | … See is the universal government of the [Catholic Church] a |
| The Great Awakening | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …[The Great Awakening].… |
| Gavin Newsom | 3 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| The Verge | 3 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| Daily Dot | 3 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| National Review | 3 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| Kamala Harris | 3 | person | used with a personal title or a verb only a person takes | …letter sent to Johnson on Tuesday, Sen. [Kamala Harris] of  |
| Ian Cameron | 3 | person | a capitalised personal-name shape left after every other pattern was tested | …ABC NEWS exec producer [Ian Cameron] married to Susan Rice  |
| The Federalist | 3 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| Doug Collins | 3 | person | a capitalised personal-name shape left after every other pattern was tested |  |
| AG Barr | 3 | creative work | discussed as a film, book or show | …Will newly discovered evidence ([AG Barr] - SDNY) FREE FLYN |

## Still untyped — an honest remainder

| Source text | × |
|---|---|
| QAnon | 32 |
| COVID-19 | 14 |
| D's | 11 |
| MS13 | 11 |
| Kim | 9 |
| bad actors | 8 |
| McCain | 8 |
| AWAN | 7 |
| LEFT | 7 |
| ASIA | 7 |
| Ohr | 5 |
| SCIF | 5 |
| WHITAKER | 5 |
| LifeLog | 5 |
| USMC | 4 |
| Sec of State | 4 |
| DECLAS | 4 |
| SpaceX | 4 |
| Breaking911 | 4 |
| C-SPAN | 4 |
| AT&T | 4 |
| MS_13 | 3 |
| MS-13 | 3 |
| R's | 3 |
| /pol/ | 3 |
| DEFCON | 3 |
| Bush family | 3 |
| WRAY | 3 |
| NYPD | 3 |
| 4ch | 3 |
| MarketWatch | 3 |
| Gang of Eight | 3 |
| RealClearPolitics | 3 |
| TIME | 3 |
| OpenSecrets | 3 |
| SOTU | 3 |
| Xi | 2 |
| 23andMe | 2 |
| 9-11 | 2 |
| Paris accord | 2 |
