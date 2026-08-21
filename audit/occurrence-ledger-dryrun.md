# Step 3A — occurrence ledger, dry run

**Nothing in `public/data` was changed by this run.** This describes what 3B would do.

## The model

| layer | kinds | rule |
|---|---|---|
| primary | Claim, Prediction, Question, Directive | one adjudicated category per complete sentence |
| inline | Named Entity, Bracket | may overlap a primary span, renders above it |
| review | Context, Emphasis, theme anchor | a disposition, not a competing sentence colour |

An occurrence is keyed `postNum | kind | start | end` into the runtime body — never by its text.
Repeated wording stays separate because it is separate ranges: `"Fantasy land."` four times in #111 is four keys.

## Totals

```
sentences                      30187
occurrencesKeyed               35245
duplicateKeys                  148
unlocated                      645
crossingSentenceBoundary       242
```

## 247 partial primary spans replaced by their full sentence

51 more are partial ON PURPOSE — a directive-wrapped question counts its embedded span so the
Directive relationship survives. Those are excluded from the replacement set.

```
claims       199
questions    41
predictions  7
```

First 20:

| sentence | post | kind | the partial span |
|---|---|---|---|
| `p1008-s036` | #1008 | claims | "AMERICA FOR SALE" |
| `p1010-s008` | #1010 | claims | "CONTROL." |
| `p1010-s007` | #1010 | claims | "MASS EXT EVENTS DESIGNED TO DECREASE THREAT LEVEL OF POPULATION" |
| `p1011-s001` | #1011 | claims | "RUSSIA TESTING NEW MISSILES" |
| `p1012-s000` | #1012 | claims | "Marines from the 3rd Marine Aircraft Wing who lost their lives in yesterday’s Southern California helicopter c" |
| `p1072-s003` | #1072 | claims | "Not R vs D" |
| `p0120-s021` | #120 | questions | "US persons?" |
| `p1316-s014` | #1316 | claims | "3 official behind Deputy AG Rosenstein - FIRED/FORCE" |
| `p1319-s049` | #1319 | claims | "Tiberi - Republican U.S." |
| `p0134-s014` | #134 | claims | "One side of the triangle removed (1st time in history)" |
| `p0135-s000` | #135 | claims | "ROTHSCHILD OWNED & CONTROLLED BANKS" |
| `p1359-s003` | #1359 | claims | "Total S.A. is a French multinational integrated oil and gas company and one of the seven \"Supermajor\" oil comp" |
| `p1363-s004` | #1363 | questions | "Flag [post] 'Castle LOCK' - pointed ref?" |
| `p1432-s002` | #1432 | claims | "our struggle is not against flesh and blood, but against the rulers, against the authorities, against the powe" |
| `p1443-s028` | #1443 | claims | "EVIL." |
| `p1445-s006` | #1445 | claims | "Trace sale/spin off of Co" |
| `p1449-s000` | #1449 | claims | "No." |
| `p1464-s000` | #1464 | claims | "No." |
| `p1489-s012` | #1489 | claims | "Twitter throttling & shadowban (coded #Qanon)" |
| `p1515-s000` | #1515 | claims | "These reporters and networks have been named in the WikiLeaks to have colluded with the DNC or Hillary campaig" |

## 117 sentences need an adjudicated winner

220 more carry the **certified directive+question overlap** and need no action — a line that is
grammatically an instruction and functionally a request for an answer is deliberately in both sections.

| combination | count |
|---|---|
| directives + predictions | 27 |
| claims + directives | 69 |
| claims + directives + questions | 1 |
| claims + questions | 19 |
| claims + predictions | 1 |

First 15:

| sentence | post | categories | text |
|---|---|---|---|
| `p0001-s002` | #1 | directives + predictions | "Expect massive riots organized in defiance and others fleeing the US to occur." |
| `p1155-s000` | #1155 | claims + directives | "Focus should also be on Supreme Court promise." |
| `p1261-s002` | #1261 | directives + predictions | "Expect more (outcry)." |
| `p1295-s012` | #1295 | claims + directives | "The only profit we should all be striving for is TRUE FREEDOM." |
| `p1297-s006` | #1297 | claims + directives | "They fight unconditionally because they hold a core value, a value that we should all live" |
| `p1297-s008` | #1297 | claims + directives | "We must do better to protect them." |
| `p1358-s000` | #1358 | claims + directives | "Trust must be earned." |
| `p1425-s000` | #1425 | directives + predictions | "Given we have now undeniably [on purpose] verified ourselves to be an inside source, expec" |
| `p1432-s002` | #1432 | claims + directives | "our struggle is not against flesh and blood, but against the rulers, against the authoriti" |
| `p1445-s006` | #1445 | claims + directives | "Trace sale/spin off of Co" |
| `p1445-s011` | #1445 | directives + predictions | "Expect A LOT more." |
| `p1471-s002` | #1471 | claims + directives | "Let them all DIG THEIR OWN GRAVES." |
| `p1489-s004` | #1489 | directives + predictions | "Expect bigger push." |
| `p0016-s000` | #16 | directives + predictions | "Friday & Saturday will deliver on the MAGA promise." |
| `p1613-s002` | #1613 | directives + predictions | "Rest assured JUSTICE will be served." |

## 51 same-category overlaps in the primary layer

600 more sit in the inline/review layers and overlap **by design** — nested entities each keep
their own hover explanation (collapsing them was built, measured and reverted), and an acrostic
spreads its emphasis across a line. Those are reported but not swept up.

| sentence | post | kind | nested | span A | span B |
|---|---|---|---|---|---|
| `p1010-s008` | #1010 | claims | true | "GUN CONTROL." | "CONTROL." |
| `p0120-s021` | #120 | questions | true | "Why is the NSA limited re: ability to capture and unmask US persons?" | "US persons?" |
| `p1316-s014` | #1316 | claims | true | "3 official behind Deputy AG Rosenstein - FIRED/FORCE" | "Rachel Brand, Associate Attorney General – No. 3 official behind Deput" |
| `p1553-s000` | #1553 | claims | true | "Attorney General Jeff Sessions has also said U.S. Attorney John Huber " | "“Attorney General Jeff Sessions has also said U.S. Attorney John Huber" |
| `p1745-s008` | #1745 | claims | true | "'DIRTY' 'FAKE' DOSSIER WAS USED AS PRIMARY SOURCE TO SECURE HIGHEST LE" | "DECLAS BY POTUS KEY PARTS THAT FACTUALLY DEMONSTRATE THE 'DIRTY' 'FAKE" |
| `p1824-s004` | #1824 | claims | false | "Market) is ESSENTIAL for every major country in the world." | "ACCESS to the AMERICAN CONSUMER (U.S. Market) is ESSENTIAL for every m" |
| `p1929-s013` | #1929 | questions | true | "Who is [1 of 4] FIREWALLS?" | "FIREWALLS?" |
| `p1991-s002` | #1991 | claims | true | "\"Ms. Ugoretz oversaw intelligence products and briefings for the FBI D" | "Ugoretz oversaw intelligence products and briefings for the FBI Direct" |
| `p2070-s024` | #2070 | claims | true | "3 official behind Deputy AG Rosenstein - FIRED/FORCED" | "Rachel Brand, Associate Attorney General – No. 3 official behind Deput" |
| `p2072-s014` | #2072 | questions | true | "HUBER start?" | "Coincidence vs. HUBER start?" |
| `p2094-s004` | #2094 | claims | true | "Criminal Law." | "Military Law v. Criminal Law." |
| `p2211-s013` | #2211 | claims | true | "“Prior to joining NSA, Mr. Storch served in several positions at the D" | "Prior to joining NSA, Mr. Storch served in several positions at the De" |
| `p2211-s016` | #2211 | claims | true | "“Earlier in his career, Mr. Storch also worked as a federal prosecutor" | "Storch also worked as a federal prosecutor in the Northern District of" |
| `p2211-s042` | #2211 | questions | true | "HUBER start?" | "Coincidence vs. HUBER start?" |
| `p2305-s005` | #2305 | questions | true | "Graham activated?" | "Coincidence Sen. Graham activated?" |
| `p2306-s008` | #2306 | claims | false | "Ford's family has strong ties to SWAMP." | "Dr. Ford's family has strong ties to SWAMP" |
| `p2306-s006` | #2306 | claims | false | "Something did happen to Dr. Ford in her past" | "Ford in her past." |
| `p2359-s001` | #2359 | questions | true | "Justice K?" | "\"Wrap-Up Smear\" deployed v. Justice K?" |
| `p2360-s002` | #2360 | questions | true | "Justice K?" | "\"Wrap-Up Smear\" deployed v. Justice K?" |
| `p2360-s003` | #2360 | questions | true | "POTUS?" | "\"Wrap-Up Smear\" deployed v. POTUS?" |

## 1531 review-layer collisions become a disposition

A Context or Emphasis span sitting on exactly the characters of a primary span stops being a
second category and becomes `reviewDisposition`, which does not paint.

| pairing | count |
|---|---|
| emphasis → directives | 348 |
| emphasis → claims | 929 |
| emphasis → predictions | 71 |
| themeAnchors → directives | 21 |
| context → directives | 97 |
| themeAnchors → questions | 21 |
| context → predictions | 9 |
| themeAnchors → predictions | 8 |
| themeAnchors → claims | 25 |
| context → questions | 2 |

First 20:

| sentence | post | review | primary | text |
|---|---|---|---|---|
| `p1008-s004` | #1008 | emphasis | directives | "Trace background." |
| `p1008-s005` | #1008 | emphasis | directives | "Open source." |
| `p1009-s017` | #1009 | emphasis | claims | "The WALL means more than you know." |
| `p1009-s018` | #1009 | emphasis | claims | "The FIGHT for the WALL is for so much more." |
| `p1010-s002` | #1010 | emphasis | claims | "CONTROL." |
| `p1011-s002` | #1011 | emphasis | claims | "RUSSIA NEW THREAT." |
| `p1014-s000` | #1014 | emphasis | predictions | "MZ to step down as Chairman." |
| `p1014-s001` | #1014 | emphasis | predictions | "MZ out of US." |
| `p1016-s002` | #1016 | emphasis | directives | "Cross against POTUS’ schedule." |
| `p1016-s003` | #1016 | emphasis | directives | "Cross against WH visitor log 11/22-1/18/17." |
| `p1021-s000` | #1021 | themeAnchors | directives | "List the estimated wealth of religious organizations." |
| `p1027-s001` | #1027 | themeAnchors | directives | "Pray." |
| `p1030-s001` | #1030 | themeAnchors | directives | "Pray." |
| `p1045-s000` | #1045 | emphasis | claims | "We don’t inform our enemies of the specifics." |
| `p1045-s001` | #1045 | emphasis | claims | "We instead instill fear in them to make unplanned and disastrous countermoves." |
| `p1048-s000` | #1048 | themeAnchors | directives | "Connect via past religious leaders (re: Hussein)." |
| `p1049-s000` | #1049 | emphasis | directives | "Think NK." |
| `p1049-s001` | #1049 | emphasis | directives | "Think Nuke stranglehold." |
| `p1049-s002` | #1049 | emphasis | directives | "Think logically." |
| `p0105-s002` | #105 | emphasis | claims | "High risk." |

## Conflict queue — nothing here is auto-resolved

- **242** spans cross a sentence boundary. Per the ruling they are not cut automatically.
- **645** spans could not be placed in the runtime body — 643 named entities whose canonical and registered spellings do not appear literally in the drop.
- **148** duplicate occurrence keys: two records claiming the same post, kind and range.

