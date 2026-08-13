# Q Drops — Claims adjudication (Phase 3)

v2's source-material detector and post-level conclusion logic are frozen inputs. Questions and Directives frozen. **No production write, no deploy.** Nothing is tuned toward the stored 7,509.


## Outcome by queue


**telegraphic** — 272 units

| Proposed | Count |
|---|---|
| Q_CLAIM | 183 |
| NEEDS_CONTEXT | 85 |
| Q_STATEMENT_OR_HEADING | 4 |

**stored claim not reproduced** — 5,704 units

| Proposed | Count |
|---|---|
| NEEDS_CONTEXT | 2,815 |
| EDITORIAL_PARAPHRASE | 1,277 |
| LABEL_OR_FRAGMENT | 1,141 |
| SOURCE_MATERIAL | 235 |
| Q_PREDICTION | 231 |
| Q_CONCLUSION | 5 |

**claim/prediction disagreement** — 75 units

| Proposed | Count |
|---|---|
| Q_CLAIM | 75 |

**conclusion edge case** — 1,218 units

| Proposed | Count |
|---|---|
| Q_CLAIM | 1,218 |

**source-material boundary** — 454 units

| Proposed | Count |
|---|---|
| SOURCE_MATERIAL | 335 |
| Q_CLAIM | 119 |

## Revised totals

| Measure | v2 | After adjudication |
|---|---|---|
| Claims | 3,836 | **3,941** |
| Predictions | 705 | **630** |
| Conclusions *(attribute)* | 1,218 | **945** |

## One outcome added beyond the eight, and why

`EDITORIAL_PARAPHRASE` — stored text that appears **nowhere in the post**. It is not a Q statement, not quoted source, and not uncertain: it is wording an earlier extractor wrote. Filing it under any of the eight would misrepresent it, so it is named. This mirrors `editorialNormalization` in the Questions audit, which is retained for search but never shown as Q's words.


## Attributes are metadata

`checkable` and `sourceProvided` are recorded on surviving claims and never take part in deciding whether something is a claim. A claim with no date, number or name is still a claim.


## telegraphic (272)

| Post | Exact Q source span | v2 | Proposed | Conf | Attributes | Reason | Before | After |
|---|---|---|---|---|---|---|---|---|
| #100 | `British MI6 agents dead.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — asserts a state | `Connection to Quee` | `When?` |
| #1014 | `MZ to step down as Chairman.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `>>894658` | `MZ out of US.` |
| #1014 | `MZ out of US.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `MZ to step down as` | `@Jack` |
| #1044 | `Fake pic push by MSM.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `>>922142` | `Videos / backup.` |
| #108 | `It flushed BO out.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, conclusion, telegraphic | compressed but propositional — asserts a state | `What occurred?` | `Why is that releva` |
| #1081 | `POTUS NEVER telegraphs his moves.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `>>950959` | `Think logically.` |
| #1085 | `After all these years…….` | Q_CLAIM | **Q_CLAIM** | MEDIUM | source, telegraphic | compressed but propositional — anchored in tim | `https:// www.wsj.c` | `No MSM positive me` |
| #1093 | `Knowing what you know now.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | source, telegraphic | compressed but propositional — anchored in tim | `` | `Watch again.` |
| #11 | `State Secrets upheld under SC` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `No approval or con` | `Who is the Command` |
| #1106 | `MIL assets on the ground locked out of GZ.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `Hold until CONF.` | `ISRAEL strike harm` |
| #1112 | `They broke in during the fire.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — anchored in tim | `>>973390` | `Distraction.` |
| #1151 | `Side by side graphic.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `` | `SS/LL deal drop(s)` |
| #1155 | `POTUS validating drops via Twitter per plan/timing.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `Only dropped here.` | `Future proves past` |
| #1160 | `GOOG ‘qanon’ search stats (by country).` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Armenia.` | `Armenia #1.` |
| #1180 | `Direct discussions avail [now] w/ Mueller.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — anchored in tim | `Join POTUS’ legal ` | `Enjoy the show.` |
| #1190 | `Guided by LL/+3 CLAS.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `Memos are FAKE.` | `Think SC.` |
| #1221 | `Deposits routed from EU.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — names an agent | `Trust funds (3).` | `Why are deposits O` |
| #1253 | `https:// www.grassley.senate.gov/news/news-releases/grassley-r` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — anchored in tim | `` | `` |
| #1254 | `“Bigger problems than ever before.”` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — anchored in tim | `“Mark it down.”` | `SIG to Iran?` |
| #1264 | `We get massive amounts of ‘Q’ thank you letters from around th` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Trust the plan.` | `THE WORLD IS WATCH` |
| #1278 | `Patience isn’t always easy.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Be heard.` | `But vital to get r` |
| #1286 | `SC/Comey/RR state POTUS not under investigation.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, conclusion, telegraphic | compressed but propositional — anchored in tim | `SC attack POTUS WI` | `Flynn pleads guilt` |
| #1307 | `Knowing what you know now.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — anchored in tim | `` | `re: Israel disclos` |
| #1316 | `Mike Kortan, FBI Assistant Director for Public Affairs - FIRED` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `[Added]` | `Josh Campbell, Spe` |
| #1316 | `3 official behind Deputy AG Rosenstein - FIRED/FORCE` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `Bruce Ohr, Associa` | `Cross against Hous` |
| #1339 | `Growth due to confirmations.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Coincidence after ` | `Real source(s) com` |
| #1345 | `Carried out by Hussein.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — names an agent | `Organized/planned ` | `[remember HRC ran ` |
| #1380 | `Faces of lawmakers stepping out.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — asserts a state | `PS.` | `Focus.` |
| #140 | `Wealth (over generations) buys power.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `` | `Power (over genera` |
| #144 | `Primary objective from beginning: POTUS discredit MSM.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Who control[s] the` | `[W]hy is this rele` |
| #1443 | `Failure per WH instruction / agreement.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `#FLY[RR]FLY#` | `DECLAS_Public[3]` |
| #1450 | `Gardens by the Bay.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `>>1699199` | `See prev pic.` |
| #1462 | `The 'server' brings down the house.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — asserts a state | `Back in the news.` | `Q` |
| #148 | `New measures active and in place.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — asserts a state | `POTUS has been bri` | `Update the graphic` |
| #1496 | `[[RR]] central figure within docs (personally involved).` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, conclusion, telegraphic | compressed but propositional — anchored in tim | `Nunes/Grassley/Fre` | `KNOWN CONFLICT.` |
| #1516 | `Huber recent reveal by Sessions (Nov start).` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — names an agent | `JP / Huma NOV.` | `HRC panic / deal r` |
| #1517 | `Or, they already know hence CEO/political mass resignations.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, conclusion, telegraphic | compressed but propositional — anchored in tim | `Strategic?` | `Adding up?` |
| #1522 | `Those who don’t act now know they cannot hide the reasons why.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — anchored in tim | `How do you share w` | `What a wonderful d` |
| #1533 | `+Snopes building algo to now track and refute all claims as fa` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — anchored in tim | `https://www.snopes` | `Q` |
| #1538 | `C_A down [19] this year alone.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, conclusion, telegraphic | compressed but propositional — asserts a state | `https://www.thegua` | `When will records ` |
| #1571 | `Spelling error due to mobile.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `>>1828481` | `Q` |
| #1582 | `Now that’s what I call a VIP!` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `` | `https://mobile.twi` |
| #1585 | `Resistance far smaller than portrayed by MSM.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `Counter measures i` | `Attacks will inten` |
| #1585 | `Censorship applied to scale down impact/reach.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — asserts a state | `You, collectively,` | `It’s failing.` |
| #1602 | `You underestimated their resolve and their ability to free-thi` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — anchored in tim | `SHEEP NO MORE.` | `We will DECLAS.` |
| #1605 | `PS "Texts taken out of context"` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `` | `PS "While emotiona` |
| #1605 | `PS "I decline to answer that question on advice from counsel."` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `PS "In hindsight, ` | `: When you state "` |
| #1609 | `………………..all while under constant attack.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — anchored in tim | `POTUS restore conf` | `DO YOU NOT BELIEVE` |
| #1628 | `JA in the news a lot lately (out of nowhere).` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, conclusion, telegraphic | compressed but propositional — asserts a state | `Coincidence?` | `Crisis mode.` |
| #1641 | `It’s already begun (small > large).` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — anchored in tim | `MSM outcry to forc` | `https://www.huffin` |
| #165 | `Problem: time to complete.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — asserts a state | `Regulate?` | `Solution?` |
| #165 | `Patriots, get the word out.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — asserts a state | `Solution?` | `Jason Bourne (Deep` |
| #166 | `Problem: time to complete.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — asserts a state | `Regulate?` | `Solution?` |
| #166 | `Patriots, get the word out.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — asserts a state | `Solution?` | `Jason Bourne (Deep` |
| #1682 | `From Sea to Shining Sea.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `` | `Who does Huber rep` |
| #1731 | `CLAS removal WASH minutes after.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `Given CoC process ` | `Q` |
| #1745 | `FISA = IMPLICATES SENIOR MEMBERS OF UK MI5/6/SIS, US INTEL, WH` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `FISA = IMPLICATES ` | `FISA = TIES MSM HE` |
| #1745 | `FISA = TIES MSM HEADS (TV/BEHIND/CORP) TO D PARTY OTHER FOREIG` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `FISA = IMPLICATES ` | `FISA BRINGS DOWN T` |
| #1762 | `Declare State of Emergency and req billions from FED.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `Light fires.` | `Why did POTUS reje` |
| #1794 | `“Never Interfere With an Enemy While He’s in the Process of De` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `Re: MSM` | `Q` |
| #1822 | `DIVIDED by POLITICAL AFFILIATION.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `DIVIDED by CLASS.` | `DIVIDED YOU ARE WE` |
| #1831 | `Knowing what you know now…..` | Q_CLAIM | **Q_CLAIM** | MEDIUM | source, conclusion, telegraphic | compressed but propositional — anchored in tim | `Does POTUS make st` | `[Start @ 12:00]` |
| #1833 | `Controlled & Coordinated by Corrupt [+ so-called volunteers] S` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — names an agent | `CA/NY notorious vo` | `Logical Thinking.` |
| #1862 | `['They' prey on emotionally unstable (helpless) individuals an` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, conclusion, telegraphic | compressed but propositional — asserts a state | `` | `` |
| #1884 | `SUDAN [ACCESS] PENDING [GOV'T][SA US PUSH]` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `CUBA [ACCESS] CLOS` | `SYRIA [ACCESS] PEN` |
| #1884 | `SYRIA [ACCESS] PENDING [GOV'T]` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `SUDAN [ACCESS] PEN` | `YEMEN [ACCESS] PEN` |
| #1884 | `YEMEN [ACCESS] PENDING [GOV'T][SA US PUSH]` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `SYRIA [ACCESS] PEN` | `LIBYA [ACCESS] PEN` |
| #1884 | `LIBYA [ACCESS] PENDING [MAIN PORT CLOSED][LIMITED]` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `YEMEN [ACCESS] PEN` | `SOMALIA [ACCESS] P` |
| #1884 | `SOMALIA [ACCESS] PENDING [SA US PUSH]` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `LIBYA [ACCESS] PEN` | `Q` |
| #190 | `Necessary to cut strings from foreign bad actors.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `USA vs.` | `Necessary to form ` |
| #1902 | `Location of painting confirmed.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — asserts a state | `1=1` | `Travel to Rome.` |
| #1945 | `: the offense of attempting by overt acts to overthrow the gov` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `[Fact]` | `: the betrayal of ` |
| #1972 | `A place giving temporary protection from bad weather or danger` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Define 'Shelter'.` | `Q` |
| #1986 | `Mike Kortan - cooperating under 'resigned' title` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `-TO BE CALLED?` | `-TO BE CALLED?` |
| #2024 | `Retaliation - 'Horizon' active.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — asserts a state | `>>2809998` | `Q` |
| #2054 | `During this time, we also honor the brave men and women who se` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — anchored in tim | `https://www.whiteh` | `Over the past year` |
| #2064 | `Played by 'Operation Specialists' [pre-event] last night.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `https://www.youtub` | `Q` |
| #2129 | `FISA [FULL] BRINGS DOWN THE HOUSE [WH].` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `USE OF BACKCHANNEL` | `Q` |
| #2135 | `"Review of the new documents raises grave concerns regarding a` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — anchored in tim | `` | `` |
| #2174 | `DIVIDED by POLITICAL AFFILIATION.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `DIVIDED by CLASS.` | `DIVIDED YOU ARE WE` |
| #2223 | `Due to K confirmation push.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `>>3093917` | `Hand in hand.` |
| #2223 | `[RR] stand down due to K conf.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `Hand in hand.` | `Q` |
| #2300 | `The crime of betraying one's country, especially by attempting` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Define 'Treason'.` | `Define 'Subversion` |
| #2306 | `Refused to hand over therapy notes to FBI.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `>>3282114` | `Think WHY.` |
| #2306 | `Justice K NEVER named.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Think WHY.` | `[Mr X logged in bo` |
| #2306 | `[Mr X logged in book along w/ physical description during 'eye` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — asserts a state | `Justice K NEVER na` | `FBI no subpoena po` |
| #2307 | `Heading to TN now.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — anchored in tim | `"We will be voting` | `Q` |
| #2319 | `Goal: [per past statistical success rates] apply enough 'false` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `WERE QUESTIONS MOD` | `Mission Failed.` |
| #2322 | `By: Marty Torrey [Mad Hatter]` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `[Pg 20 - Assange A` | `Q` |
| #2324 | `Per subpoena to Sessions - Schedule 1 - 'McCabe Memos'.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `If Sessions is rec` | `https://judiciary.` |
| #2337 | `Israeli intelligence - stand down.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | telegraphic | compressed but propositional — asserts a state | `` | `[TERM_3720x380-293` |
| #2352 | `DIVIDED by POLITICAL AFFILIATION.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — names an agent | `DIVIDED by CLASS.` | `DIVIDED YOU ARE WE` |
| #2361 | `UNPLUG FROM FAKE NEWS [FALSE REALITY]` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `` | `[PROPAGANDA ARM OF` |
| #2381 | `[MUELLER] designed to demonstrate to foreign players that OLD ` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `[MUELLER] designed` | `[MUELLER] designed` |
| #2397 | `[MUELLER] designed to demonstrate to foreign players that OLD ` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `[MUELLER] designed` | `[MUELLER] designed` |
| #2398 | `$1.5 billion provided in taxpayer funding over 3-year period.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — anchored in tim | `https://www.gao.go` | `[Case 1]` |
| #2399 | `[2016 Democrat Nominee for President of the United States] htt` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — anchored in tim | `` | `` |
| #2399 | `Fake News Cover Up > Prevent Black Americans from Seeing the T` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — names an agent | `"THEY ALL LOOK ALI` | `Another FREE PASS?` |
| #2428 | `MEMES now front & center.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, source, telegraphic | compressed but propositional — anchored in tim | `https://twitter.co` | `Attack on 'Q' move` |
| #243 | `D's dropping all around over sexual misconduct (1st stage).` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Strings cut.` | `Coincidence direct` |
| #2448 | `We defied history by picking up Senate seats.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — anchored in tim | `Moves & countermov` | `Patriots delivered` |
| #2492 | `R Gov won by 328,000 votes.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `ARIZONA` | `D Sen is winning b` |
| #2492 | `R Gov won Maricopa County by 325,000 votes.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `D Sen is winning b` | `D Sen winning Mari` |
| #2538 | `Majority of leaks [by them] serve to their benefit.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `DOJ [policy] does ` | `Some do not.` |
| #2546 | `The President of the United States initiated and confirmed the` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `>>4134817` | `When was the state` |
| #2571 | `PUBLIC AWAKENING = GAME OVER` | Q_CLAIM | **Q_STATEMENT_OR_HEADING** | MEDIUM |  | topic label — names a subject without assertin | `https://twitter.co` | `Q` |
| #259 | `Those in the know never sleep.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — anchored in tim | `7/10 plane crashes` | `Q` |
| #2630 | `None left by choice.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `How many senior FB` | `Nothing To See Her` |
| #2638 | `Public 'pull out' of troops in Syria….` | Q_CLAIM | **Q_CLAIM** | MEDIUM | conclusion, telegraphic | compressed but propositional — asserts a state | `Chemical attack in` | `History will not r` |
| #2652 | `2.2 million attempted access within 1-2 minutes.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `>>4617970` | `Site crashed.` |
| #2657 | `Once an agent, always an agent.` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Hello, [AS].` | `Q` |
| #2663 | `Cocktail regimen 4x daily brain intercept [administered by    ` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `Mental institution` | `Hint:` |
| #2672 | `D House focus on POTUS = 'insurance' extension from MUELLER to` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `https://www.realcl` | `GJ testimony under` |
| #2672 | `GJ testimony underway in several states.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — asserts a state | `D House focus on P` | `Attempts to BLOCK/` |
| #2681 | `-Barr (w/ Whitaker) review [RR] notes re: strong reservations ` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — anchored in tim | `-Barr install` | `-Barr (w/ Whitaker` |
| #2681 | `-Barr executes order to DECLAS + provide members of H committe` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable, telegraphic | compressed but propositional — names an agent | `-Barr (w/ Whitaker` | `-Whitaker remain D` |
| #2681 | `-Red/Green Castle per orig plan` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `-Wall discussion e` | `Dark to Light.` |
| #2682 | `1) FAKE NEWS MEDIA push of 'by design' narrative [daily update` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `How do D's control` | `2) FAKEWOOD echo o` |
| #2682 | `2) FAKEWOOD echo of 'by design' narrative` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `1) FAKE NEWS MEDIA` | `3) SOCIAL MEDIA st` |
| #2682 | `3) SOCIAL MEDIA stream/promote of 'by design' narrative + cens` | Q_CLAIM | **NEEDS_CONTEXT** | LOW |  | compressed with no agent, state or time anchor | `2) FAKEWOOD echo o` | `Do they provide ev` |

_…and 152 more in the JSON._

## stored claim not reproduced (5,704)

| Post | Exact Q source span | v2 | Proposed | Conf | Attributes | Reason | Before | After |
|---|---|---|---|---|---|---|---|---|
| #1 | `US M's will conduct the operation while NG activated` | Q_PREDICTION | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `>>147005381` | `` |
| #1 | `US M’s will conduct the operation while NG activated.` | Q_PREDICTION | **Q_PREDICTION** | MEDIUM |  | v2 classified the same span as Q_PREDICTION | `>>147005381` | `` |
| #10 | `the FBI, and MI, have an open investigation into the CF` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Again, good people` |
| #10 | `Comey drop this` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Again, good people` |
| #10 | `How many kids disappeared` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Again, good people` |
| #10 | `How much money sent to CF under disguise of H relief went to H` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Again, good people` |
| #10 | `What countries donated big money to CF and why` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Again, good people` |
| #10 | `When she lost how would this be repaid` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Again, good people` |
| #10 | `What did Obama do with cash just prior to leaving office` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Again, good people` |
| #10 | `good people were forced into bed with this evil under personal` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `Remember, the FBI,` | `` |
| #10 | `These people worship Satan _ some openly show it` | SOURCE_MATERIAL | **SOURCE_MATERIAL** | MEDIUM |  | v2 classified the same span as SOURCE_MATERIAL | `Remember, the FBI,` | `` |
| #100 | `What political leaders worship Satan?` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `Who follows?` | `What does an upsid` |
| #1001 | `Tunnels` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `[Classified]-2` | `Table 29.` |
| #1001 | `Pure EVIL` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `D-Room C` | `'Conspiracy'` |
| #1002 | `Symbolism will be their downfall` | Q_PREDICTION | **Q_PREDICTION** | MEDIUM |  | v2 classified the same span as Q_PREDICTION | `>>885429` | `MONEY.` |
| #1005 | `NO DEALS.` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `WAR.` | `Q` |
| #1006 | `POTUS DECLINE` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `ROGUE_FAILURE.` | `PREPARED AT ALL CO` |
| #1006 | `ROGUE_FAILURE` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `UK.` | `POTUS DECLINE>` |
| #1008 | `POTUS is not under criminal investigation _ NOT YET` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Traitor.` |
| #1008 | `No investigation into WL receipt of information` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `MS[13][13=M]MSM - ` | `No pull down of NS` |
| #1008 | `No pull down of NSA metadata trace/C to WL` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `No investigation i` | `No pull down of NS` |
| #1008 | `No pull down of NSA metadata period` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `No pull down of NS` | `Nothing transferre` |
| #1008 | `Nothing transferred across web` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `No pull down of NS` | `Direct-to-Direct b` |
| #1008 | `No 'direct' investigation into DNC computer/software` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `Direct-to-Direct b` | `No 'direct' invest` |
| #1008 | `No 'direct' investigation into CS` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `No 'direct' invest` | `FBI/SC/DOJ/FED G s` |
| #1008 | `FBI/SC/DOJ/FED G simply TRUST CS's report on data breach` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `No 'direct' invest` | `HUSSEIN block?` |
| #1008 | `HUSSEIN block` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `FBI/SC/DOJ/FED G s` | `HUSSEIN control?` |
| #1008 | `HUSSEIN control` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `HUSSEIN block?` | `HUSSEIN "STATE SEC` |
| #1008 | `HUSSEIN 'STATE SECRETS' WH NAT SEC ARTICLES 1-9 - BURIED` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `HUSSEIN control?` | `Awan attached?` |
| #1008 | `Awan attached` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `HUSSEIN "STATE SEC` | `AMERICA FOR SALE.` |
| #1008 | `AMERICA FOR SALE` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `Awan attached?` | `Cheatin' Obama.` |
| #1009 | `Troops to Border` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `>>893904` | `Clown Black Ops.` |
| #1009 | `Clown Black Ops` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Troops to Border.` | `Private funds.` |
| #1009 | `Private funds` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Clown Black Ops.` | `Raised how?` |
| #1009 | `D's involved` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `To who?` | `MS_13/Illegals roa` |
| #1009 | `MS_13/Illegals road block` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `D's involved.` | `Sex traffic road b` |
| #1009 | `Sex traffic road block` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `MS_13/Illegals roa` | `Children road bloc` |
| #1009 | `Children road block` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Sex traffic road b` | `Drugs road block.` |
| #1009 | `Drugs road block` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Children road bloc` | `Guns road block.` |
| #1009 | `Guns road block` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Drugs road block.` | `China/Russia pass-` |
| #1009 | `China/Russia pass-through-intel-pull road block` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Guns road block.` | `Name we don't say ` |
| #1009 | `Name we don't say AZ road block` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `China/Russia pass-` | `Jeff Flake AZ road` |
| #1009 | `Jeff Flake AZ road block` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Name we don't say ` | `Big money TERMINAT` |
| #1009 | `Big money TERMINATE` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Jeff Flake AZ road` | `The WALL means mor` |
| #101 | `Graphic confirmed.` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `>>148147343` | `Q` |
| #1010 | `MASS EXT EVENTS DESIGNED TO DECREASE THREAT LEVEL OF POPULATIO` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `PAWNS.` | `GUN CONTROL.` |
| #1010 | `WARS [FAKE][TOP HAPPY][BACKEND DEAL]` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `GUN CONTROL.` | `ELECTION RIGGING.` |
| #1010 | `ELECTION RIGGING` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `WARS [FAKE][TOP HA` | `CONTROL.` |
| #1010 | `CHEMICALS PUSHED FOR HOME USE CLEANING [CANCER][BABY ON FLOOR-` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `AIR` | `VACCINES [NOT ALL]` |
| #1011 | `RUSSIA TESTING NEW MISSILES` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `NK DEFUSE.` | `RUSSIA NEW THREAT.` |
| #1011 | `RUSSIA NEW THREAT` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `RUSSIA TESTING NEW` | `COINCIDENCE?` |
| #1012 | `four U.S. Marines from the 3rd Marine Aircraft Wing lost their` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1013 | `Bad mixed w/ good` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Future "Conspiracy` | `Taint.` |
| #1015 | `$1.8mm Cory Booker - Singapore` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Gateway Bridge Pro` | `$3.5mm Chuck Schum` |
| #1015 | `$3.5mm Chuck Schumer - Israel` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `$1.8mm Cory Booker` | `$400k Chris Christ` |
| #1015 | `$400k Chris Christie - Mary Pat US` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `$3.5mm Chuck Schum` | `……..` |
| #1015 | `Omnibus Bill. The gift that keeps on giving.` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `` |
| #1016 | `Hussein timeline. 1/20/17 - today.` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `` |
| #1016 | `Cross against POTUS' schedule.` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `1/20/17 - today.` | `Cross against WH v` |
| #1016 | `Cross against WH visitor log 11/22-1/18/17.` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `Cross against POTU` | `This will become v` |
| #1020 | `NG now active` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Used against them.` | `Refer to old drops` |
| #1021 | `estimated wealth of religious organizations is billions` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1021 | `Vatican bank has $229B` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1021 | `Vatican bank is supervised by Board of Superintendence and Sup` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1021 | `there is a clown connection` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1021 | `Rothschild made a loan to the Holy See in 1832` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1022 | `Under the cover of his health, he will not be seeking another ` | Q_PREDICTION | **Q_PREDICTION** | MEDIUM |  | v2 classified the same span as Q_PREDICTION | `The protected flow` | `Q` |
| #1032 | `Think Navy Ship crashes.` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `Bigger than you kn` |
| #1032 | `Bigger than you know.` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Think Navy Ship cr` | `We ARE active.` |
| #1040 | `they called the WH for comment prior to publishing` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `>>919423` | `Q` |
| #1043 | `Pics will surface of Hussein holding AK47 in tribal attire` | Q_PREDICTION | **Q_PREDICTION** | MEDIUM |  | v2 classified the same span as Q_PREDICTION | `>>922075` | `One of many.` |
| #1043 | `One of many` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Pics will surface ` | `Net shut down.` |
| #1044 | `Google kill` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Videos / backup.` | `YouTube kill.` |
| #1044 | `YouTube kill` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Google kill.` | `FB kill.` |
| #1044 | `FB kill` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `YouTube kill.` | `Twitter kill.` |
| #1044 | `Twitter kill` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `FB kill.` | `Yahoo kill.` |
| #1044 | `Yahoo kill` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Twitter kill.` | `Bing kill.` |
| #1044 | `Bing kill` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Yahoo kill.` | `Instagram kill.` |
| #1044 | `Instagram kill` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Bing kill.` | `Net will be paused` |
| #1044 | `Net will be paused` | Q_PREDICTION | **Q_PREDICTION** | MEDIUM |  | v2 classified the same span as Q_PREDICTION | `Instagram kill.` | `HAMMER.` |
| #1045 | `We don't inform our enemies of the specifics` | LABEL_OR_FRAGMENT | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `>>922280` | `We instead instill` |
| #1045 | `We instead instill fear in them to make unplanned and disastro` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `We don’t inform ou` | `Q` |
| #1048 | `Connect via past religious leaders (re: Hussein)` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `>>922596` | `We have everything` |
| #105 | `High risk` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Operators are in h` | `High value targets` |
| #105 | `High value targets` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `High risk.` | `Please pause and g` |
| #1056 | `E is vocal against POTUS` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1056 | `There is a biggest connection missing` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1056 | `There are friends (2) to focus on` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1056 | `One connection involves F` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1056 | `One connection involves M` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1056 | `One connection involves a Presidential pardon` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #1056 | `One connection involves 187 MS_13` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `` |
| #106 | `SA cut the strings` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `We are at war.` | `They are scramblin` |
| #1069 | `America for sale` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Tech.` | `Systematic weakeni` |
| #1069 | `Systematic weakening of the US` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `America for sale.` | `U1.` |
| #1069 | `Inside job` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Cash flow funnel.` | `Traitors.` |
| #107 | `we just sent the go orders` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `May God also grant` | `Coincidence?` |
| #107 | `this Tweet went live` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `May God also grant` | `Coincidence?` |
| #1070 | `The 'Tone'` | LABEL_OR_FRAGMENT | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `We always see “It’` | `WAR.` |
| #1072 | `Not R vs D` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `The pipeline.` | `CA is special.` |
| #1075 | `MediaMatters 4ch` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Buckle up.` | `Narrative + anythi` |
| #1075 | `Clowns + Twitter push` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Narrative + anythi` | `MSM overdrive.` |
| #1075 | `MSM overdrive` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Clowns + Twitter p` | `All 4 a LARP?` |
| #1076 | `They want you divided` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Power.` | `Q` |
| #1077 | `Increase in chatter` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Night [4]` | `Auth B19-2.` |
| #1077 | `Auth B19-2` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Increase in chatte` | `Sparrow Red.` |
| #1077 | `Sparrow Red` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Auth B19-2.` | `Prevent at all cos` |
| #108 | `Nothing is as it seems` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `>>148155375` | `What occurred?` |
| #1082 | `Plane crash 1999` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Relationship.` | `HRC Senate 2000.` |
| #1082 | `HRC Senate 2000` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Plane crash 1999.` | `The “Start.”` |
| #1085 | `North Korea ready to discuss denuclearization` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `` | `After all these ye` |
| #1090 | `Pictures leaked for this very moment` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `>>955656` | `Who/what is not pi` |
| #1090 | `What was delivered? Smiles.` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `` | `` |
| #1090 | `Buildings E of spider web` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Exact.` | `Spider web marker.` |
| #1090 | `Spider web marker` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Buildings E of spi` | `Open source.` |
| #1090 | `Open source` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `Spider web marker.` | `Q` |
| #1091 | `Blackwater CEO Eric Prince was CIA asset` | not classified by v2 | **EDITORIAL_PARAPHRASE** | HIGH |  | appears nowhere in the post — wording an earli | `>>955760` | `Think Double.` |
| #1094 | `Refugees who work/ed US House / Senate` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `‘TRUSTED’ close pr` | `Traitor.` |
| #1097 | `Bigger than you know` | LABEL_OR_FRAGMENT | **LABEL_OR_FRAGMENT** | MEDIUM |  | v2 classified the same span as LABEL_OR_FRAGME | `Find ALL pics.` | `One example of man` |
| #1098 | `HUSSEIN PROTECT ISIS` | not classified by v2 | **NEEDS_CONTEXT** | LOW |  | verbatim in the post but not segmented as its  | `>>958655` | `POTUS ISIS focus a` |

_…and 5,584 more in the JSON._

## claim/prediction disagreement (75)

| Post | Exact Q source span | v2 | Proposed | Conf | Attributes | Reason | Before | After |
|---|---|---|---|---|---|---|---|---|
| #114 | `We will never forget.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `US Military = savi` | `Fantasy land.` |
| #1328 | `We will not be held hostage.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `THERE WILL COME A ` | `SKY EVENT.` |
| #1350 | `Through their strength, and the millions of united Patriots ar` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `They deserve our d` | `Peace through stre` |
| #1358 | `We will never forget.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `We knew this day w` | `Do not glorify us.` |
| #1376 | `We will never forget.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Godspeed, Patriot.` | `Q` |
| #144 | `Decrease altitude (we will not fly that high again).` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Paint the picture.` | `Higher the altitud` |
| #1494 | `WE WILL.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `WILL YOU DEFEND?` | `WE ARE.` |
| #153 | `For the coming days ahead.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | "coming" used as a modifier ("the coming storm | `` | `Ask yourself an ho` |
| #1602 | `We will DECLAS.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `You underestimated` | `We will shine LIGH` |
| #1602 | `We will shine LIGHT.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `We will DECLAS.` | `THERE IS NOWHERE T` |
| #1605 | `I believe everyone on this panel (minus those from the other s` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `PS "Because of the` | `………………….` |
| #1605 | `We are also following the facts and once we uncover more (whic` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `PS "Because of the` | `………………….` |
| #1608 | `“I will not be filing for re-election to Congress nor seeking ` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `` | `Should we add him ` |
| #1644 | `We will succeed.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Do not be afraid.` | `Timing is everythi` |
| #1695 | `We will never again be under their control.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Fast.` | `Q` |
| #1698 | `I [name] do solemnly swear (or affirm) that I will support and` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `` | `https://www2.fbi.g` |
| #1886 | `"For now we see only a reflection as in a mirror; then we shal` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `` | `– Corinthians 13:4` |
| #1886 | `Now I know in part; then I shall know fully, even as I am full` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `` | `– Corinthians 13:4` |
| #1941 | `There is a price we will not pay.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Global power strug` | `There is a point b` |
| #2020 | `We will gladly end our lives to ensure he lives.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `>>2806653` | `More than you can ` |
| #2032 | `If people believe the odds are hopeless their candidate will w` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | conditional | conditional — asserts a relationship rather th | `[Point 1 - FAKE NE` | `Do they still make` |
| #2032 | `If people believe the odds are overwhelming their candidate wi` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | conditional | conditional — asserts a relationship rather th | `[Point 2]` | `Do they still make` |
| #2038 | `We will do our job to protect the vote.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `>>2820100` | `Will you do yours?` |
| #2148 | `WE WILL NEVER FORGET!` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `>>2965953` | `WE WILL NEVER FORG` |
| #2148 | `WE WILL NEVER FORGIVE!` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `WE WILL NEVER FORG` | `Q` |
| #2150 | `We Will Never FORGET!` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable, source | statement of intent or policy, not a forecast  | `http://www.militar` | `We Will Never FORG` |
| #2150 | `We Will Never FORGIVE!` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable, source | statement of intent or policy, not a forecast  | `We Will Never FORG` | `https://www.whiteh` |
| #2192 | `We will not fail you.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `You are learning.` | `Q` |
| #2267 | `If you build it - they will come.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | conditional | conditional — asserts a relationship rather th | `What about startin` | `Q` |
| #2270 | `In the coming weeks it will be important to have one central l` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | "coming" used as a modifier ("the coming storm | `Good home for ex /` | `Q` |
| #2271 | `We will remain here.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `>>3131764` | `Q` |
| #2296 | `We will impeach Justice K (ZERO corroborating evidence and ALL` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `D's Playbook (Midt` | `LIBERAL LEFT LUNAC` |
| #2307 | `"We will be voting this week."` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | source | statement of intent or policy, not a forecast  | `[9:00]` | `Heading to TN now.` |
| #2314 | `We will win.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Trust your fellow ` | `God bless you and ` |
| #2358 | `We will impeach Justice K…` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Expect this.` | `CON sold to voters` |
| #2405 | `WE WILL PROTECT THE VOTE.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable, source | statement of intent or policy, not a forecast  | `https://twitter.co` | `ALL HANDS ON DECK.` |
| #241 | `We will investigate.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Whoever posted tho` | `Think.` |
| #2450 | `We are going to show you a new world.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `` | `Those who are blin` |
| #2629 | `We will have our Country back!` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `[D] Day, Patriots.` | `Q+` |
| #2645 | `WE WILL NOT GO SILENT INTO THE NIGHT.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `Do the actions of ` | `WE WILL NOT GO WIT` |
| #2645 | `WE WILL NOT GO WITHOUT A FIGHT.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `WE WILL NOT GO SIL` | `DO YOU BELIEVE THI` |
| #2793 | `Should this occur, immediate steps will be taken to classify e` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable, conditional | conditional — asserts a relationship rather th | `Think Here.` | `Why do we make thi` |
| #2816 | `(….AND WE WILL DELIVER).` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `This will be on ou` | `(Transparency and ` |
| #2839 | `You will understand why in the coming weeks.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | "coming" used as a modifier ("the coming storm | `Mueller must deliv` | `Q` |
| #3136 | `If the records become unsealed much will be revealed.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | conditional | conditional — asserts a relationship rather th | `>>5801100` | `Watch the news for` |
| #34 | `We will be initiating the Emergency Broadcast System (EMS) dur` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `Q Clearance Patrio` | `` |
| #37 | `We will never forget.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `` | `Fight the good fig` |
| #3728 | `"I will gladly take all those slings and arrows for you." - PO` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `Sometimes you must` | `But, even that, ca` |
| #381 | `We will however light a FIRE to flush them out.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `We won't telegraph` | `Q` |
| #3928 | `Together we will win.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `https://twitter.co` | `WWG1WGA!!!` |
| #4012 | `When this is finished a much bigger graphic will be needed.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | conditional | conditional — asserts a relationship rather th | `` | `MUCH BIGGER!` |
| #4387 | `WE WILL PREVAIL.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `WE ARE UNITED.` | `GOD BLESS AMERICA.` |
| #4469 | `It must be fought for, protected, and handed on for them to do` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `TO FREE FROM OPPRE` | `Q` |
| #4530 | `We will not fail.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `God bless each and` | `WWG1WGA!!!` |
| #4541 | `We will also discover that the riots in these days were provok` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `These two sides, w` | `Although it may se` |
| #4541 | `It is quite clear that the use of street protests is instrumen` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | "coming" used as a modifier ("the coming storm | `These two sides, w` | `Although it may se` |
| #4541 | `We will probably find that in this colossal operation of socia` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `We will also disco` | `__` |
| #4545 | `If America falls darkness will soon follow.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable, conditional | conditional — asserts a relationship rather th | `If America falls s` | `Only when we stand` |
| #4559 | `It must be fought for, protected, and handed on for them to do` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `Will you answer th` | `Q` |
| #466 | `We will make more public.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `PATRIOTS in FULL C` | `SA was strategic.` |
| #492 | `We will never lose again win this is finished.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `` | `Q` |
| #4966 | `We will be repressed no more.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Mankind is repress` | `Information is kno` |
| #515 | `Patriots point - we will follow.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `Current BO’s claim` | `Q` |
| #61 | `If this doesn't signal what I've been saying I don't know what` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | conditional | conditional — asserts a relationship rather th | `Expect outages per` | `Q` |
| #63 | `If you decide to take down /pol/ and the net we will be ready.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | conditional | conditional — asserts a relationship rather th | `The choice is your` | `4920-a 293883 zAj-` |
| #636 | `SHOULD THAT FAIL EXPECT A MAJOR FF TO FORCE A SHIFT.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable, conditional | conditional — asserts a relationship rather th | `RUSSIA RUSSIA RUSS` | `Predictable.` |
| #66 | `If this leaks, or the immediate action ongoing at Langley, you` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | conditional | conditional — asserts a relationship rather th | `What actions are i` | `Q` |
| #69 | `We will never forget.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `God speed to those` | `All share one titl` |
| #703 | `We will forever remember your sacrifice.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `` | `Prayer said every ` |
| #768 | `This board in the coming months will be spread & discussed acr` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable, source | "coming" used as a modifier ("the coming storm | `'Proofs' provide n` | `Important to be pr` |
| #768 | `We will help.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | source | statement of intent or policy, not a forecast  | `Important to be pr` | `TRUTH always wins.` |
| #783 | `RIP JFK - we will succeed.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `Clown Agency>No Su` | `Pyramid will colla` |
| #790 | `WE WILL NEVER FORGET.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM | checkable | statement of intent or policy, not a forecast  | `PROJECT DEEPDREAMv` | `ES FAILED.` |
| #856 | `We will never forget.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `God bless our brav` | `Q` |
| #981 | `We will not fail.` | Q_PREDICTION | **Q_CLAIM** | MEDIUM |  | statement of intent or policy, not a forecast  | `You elected us to ` | `/GA/ will change.` |

## conclusion edge case (1,218)

| Post | Exact Q source span | v2 | Proposed | Conf | Attributes | Reason | Before | After |
|---|---|---|---|---|---|---|---|---|
| #100 | `With power comes corruption.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `How long in power?` | `What happened to D` |
| #1001 | `Each prince is associated with a cardinal direction: north, so` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Where do roads lea` | `Sacrifice.` |
| #1008 | `Flynn is safe.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Why is Mueller goi` | `Define 'witness'.` |
| #1009 | `The WALL means more than you know.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `Big money TERMINAT` | `The FIGHT for the ` |
| #1009 | `The FIGHT for the WALL is for so much more.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `The WALL means mor` | `Q` |
| #1013 | `They are scared.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `Taint.` | `Q` |
| #1025 | `We are in this together.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `` | `2018 will be glori` |
| #1032 | `We ARE active.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — summary idiom | `Bigger than you kn` | `Q` |
| #1034 | `We are in control` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Timeline.` | `W` |
| #1046 | `They are all here.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `Full house.` | `24/7/365.` |
| #1048 | `We have everything.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Connect via past r` | `They know we do.` |
| #1048 | `They know we do.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `We have everything` | `RISK.` |
| #106 | `We are at war.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Nothing is a coinc` | `SA cut the strings` |
| #106 | `They are scrambling for cover and using any means necessary ou` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `SA cut the strings` | `God bless.` |
| #1066 | `We have grounds.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `RC end.` | `Reverting.` |
| #1069 | `We are in control.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `$` | `Those awake can se` |
| #1069 | `Those awake can see.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `We are in control.` | `Q` |
| #108 | `It flushed BO out.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — refers back to earlier mat | `What occurred?` | `Why is that releva` |
| #1080 | `These people are sick.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Coincidence?` | `Q` |
| #1085 | `We started asking “coincidence?” long ago for a specific reaso` | Q_CLAIM | **Q_CLAIM** | HIGH | source, conclusion | conclusion upheld — answers the question immed | `Russia flex throug` | `Those awake can fi` |
| #1085 | `Those awake can finally SEE for themselves.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, source, conclusion | conclusion upheld — refers back to earlier mat | `We started asking ` | `Conspiracy?` |
| #1100 | `RT - how DC/swamp works.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `Loud w/ findings.` | `Money talks.` |
| #1102 | `We have it ALL.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — summary idiom | `More will drop.` | `CLASS ACTION LAWSU` |
| #1103 | `This is BIGGER than you think.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable | single weak signal (refers back to earlier mat | `NO FB account requ` | `Agencies attached.` |
| #1108 | `You have been prepared.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Like Clockwork.` | `Q` |
| #111 | `They never thought she would lose.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Why is this releva` | `They never thought` |
| #111 | `They never thought she would lose.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Why is this releva` | `They never thought` |
| #111 | `POTUS is our savior.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `The complete pictu` | `Pray.` |
| #111 | `Operators are active.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Pray.` | `We are at war.` |
| #111 | `We are at war.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Operators are acti` | `Goodnight BO.` |
| #1111 | `You have more than you know.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `+ Military start /` | `Reason we are here` |
| #112 | `It is being safeguarded for these transmissions but not 100% s` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable | single weak signal (refers back to earlier mat | `Above & next drops` | `Who owns /pol/?` |
| #1123 | `Out they go!` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Bolton cleaning ho` | `A clean House is v` |
| #1123 | `A clean House is very important.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Out they go!` | `Q` |
| #1124 | `We have it all.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Testify then drop.` | `These people are s` |
| #1124 | `These people are stupid.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `We have it all.` | `Fireworks.` |
| #1157 | `Nothing stated should be discounted.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Has POTUS made a s` | `Moving fast.` |
| #1162 | `These people are stupid.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `We made sure a rep` | `Q` |
| #1165 | `They are here in force.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `Distraction.` | `Q` |
| #1174 | `These people are sick.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `New Booms - Plane ` | `Attempt to prevent` |
| #1179 | `https:// nypost.com/2017/08/05/sessions-investigating-slush-fu` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, source, conclusion | conclusion upheld — answers the question immed | `Why is the MSM agg` | `Are you awake?` |
| #1180 | `They never thought she would lose.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `Enjoy the show.` | `CARELESS.` |
| #1184 | `They have tried to ‘cover’ this.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | source | single weak signal (refers back to earlier mat | `Archive immediatel` | `Why is this releva` |
| #1186 | `Future proves past.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `“Pompeo” most seni` | `Q` |
| #120 | `They think you are stupid.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Do you believe in ` | `Who funds ISIS?` |
| #1221 | `Tweets are very important.` | Q_CLAIM | **Q_CLAIM** | HIGH | source, conclusion | conclusion upheld — answers the question immed | `How do you pass th` | `Do you feel safe?` |
| #1222 | `They all have them.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `Think public & pri` | `These people are s` |
| #1222 | `These people are stupid.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `They all have them` | `We have it all.` |
| #1222 | `We have it all.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `These people are s` | `Q` |
| #1223 | `They think they are clever.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `……….` | `Q` |
| #1226 | `Everything has meaning.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Marker.` | `Everything.` |
| #1226 | `Win.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `How do we ‘legally` | `This platform is m` |
| #1226 | `This platform is more than simply pushing the TRUTH.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable | single weak signal (refers back to earlier mat | `Win.` | `Q` |
| #1229 | `You have more than you know.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `The world is conne` | `Q` |
| #123 | `Everything has meaning.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Nothing is random.` | `+++` |
| #1238 | `She had to win at all costs.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | source | single weak signal (refers back to earlier mat | `EVIL & CORRUPTION.` | `You know why.` |
| #1239 | `https:// www.washingtonpost.com/politics/decision2012/al-gore-` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, source, conclusion | conclusion upheld — answers the question immed | `Do you feel safe?` | `Q` |
| #1241 | `Re_ read past drops.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Off the books?` | `Will become releva` |
| #1242 | `The world is awakening.` | Q_CLAIM | **Q_CLAIM** | HIGH | source, conclusion | conclusion upheld — answers the question immed | `Do you believe?` | `https:// www.aljaz` |
| #1243 | `Clowns losing control.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Why was Armenia me` | `Q` |
| #1245 | `Those who are the loudest…..` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Why is MX vocal ag` | `WWG1WGA.` |
| #1249 | `These people are sick.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `What funds are use` | `Relevant to events` |
| #1250 | `May 2 2011` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, source, conclusion | conclusion upheld — answers the question immed | `When was UBL kille` | `Where was UBL loca` |
| #1252 | `“Republicans are racists.”` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Why are teachers f` | `Learn the term ‘Pr` |
| #1252 | `MSM has you brainwashed.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — answers the question immed | `Why are they threa` | `They want you cont` |
| #1252 | `MLK was a conservative.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — answers the question immed | `Why does Pelosi me` | `Learn the TRUTH.` |
| #1252 | `APART, we are weak.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `TOGETHER, we are S` | `PATRIOTS HAVE NO S` |
| #1258 | `The world is watching.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Think logically.` | `Q` |
| #1261 | `This is about us.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | source | single weak signal (refers back to earlier mat | `They feel threaten` | `Expect more (outcr` |
| #1261 | `We are being set up and targeted (+DDoS).` | Q_CLAIM | **Q_CLAIM** | HIGH | source, conclusion | conclusion upheld — summary idiom | `Expect more (outcr` | `All for a conspira` |
| #1261 | `They must win.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | source | single weak signal (refers back to earlier mat | `https:// www.nbcne` | `New strategy?` |
| #1265 | `Flynn JR recent “did not lie to VP.”` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — answers the question immed | `Part of the plan?` | `Timing.` |
| #1265 | `You are watching a …..` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `“Beat up.”` | `What is right?` |
| #1265 | `Up is down.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `What is wrong?` | `Left is right.` |
| #1265 | `Left is right.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Up is down.` | `Left is LEFT.` |
| #1265 | `Left is LEFT.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `Left is right.` | `WH position [rapid` |
| #1265 | `They are watching.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Why?` | `Proofs provided to` |
| #1265 | `Future proves past.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Proofs provided to` | `History books.` |
| #1266 | `They never thought she would lose.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `Deep clean.` | `Insurance w/o cove` |
| #1266 | `Nothing is deleted.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Insurance w/o cove` | `No Such Agency.` |
| #1266 | `You have more than you know.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Coincidence?` | `Have faith.` |
| #1273 | `We have it all.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Planned?` | `Welcome to the WH.` |
| #1275 | `It’s nice when you can work in peace.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `Interesting theory` | `https://bigleaguep` |
| #1278 | `They are buying time.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `Precursor.` | `National crisis.` |
| #1278 | `You have a voice.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Legal case(s) buil` | `Be heard.` |
| #128 | `Everything stated is relevant.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `What is a keystone` | `Everything.` |
| #128 | `40,000ft. v. is classified.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `Picture provides 4` | `Why is a map usefu` |
| #128 | `There is an active war on your mind.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Attention on deck.` | `Be [p]repared.` |
| #128 | `Graphic is essential.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Operators [a]ctive` | `Find the ke[y]ston` |
| #128 | `They never thought she would lose.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Moves and counterm` | `Snow white.` |
| #1280 | `Flynn is safe.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Who knows where th` | `Expand your thinki` |
| #1282 | `You have more than you know.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `What is the purpos` | `Comms understood?` |
| #1284 | `You have more than you know.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — summary idiom | `Future proves past` | `Q` |
| #1286 | `http://www.foxnews.com/politics/2018/04/19/rosenstein-tells-tr` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, source, conclusion | conclusion upheld — closes a rhetorical questi | `` | `` |
| #1286 | `Disconnect exists.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Mueller report wil` | `R’s / D’s negative` |
| #1286 | `SC/Comey/RR state POTUS not under investigation.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `SC attack POTUS WI` | `Flynn pleads guilt` |
| #1286 | `More than you can imagine.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `…………` | `re: HRC insurance ` |
| #1286 | `re: HRC insurance [win]` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `More than you can ` | `Why?` |
| #1287 | `“It shouldn’t take more than “a week or two” to come to a reso` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, source, conclusion | conclusion upheld — closes a rhetorical questi | `` | `` |
| #1287 | `Not confirming SC is on /team/.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — answers the question immed | `Purpose?` | `Question everythin` |
| #1291 | `We are in this together.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Not easy for anyon` | `Much appreciation.` |
| #1292 | `You know what we have.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `You know that we k` | `Your move.` |
| #1295 | `Those who would seek personal gain at the expense of others in` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `To some, it’s only` | `You decide.` |
| #1295 | `This is not a game.` | Q_CLAIM | **Q_CLAIM** | MEDIUM |  | single weak signal (refers back to earlier mat | `You decide.` | `The only profit we` |
| #1297 | `They lay down their lives for YOU.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable | single weak signal (refers back to earlier mat | `They approach the ` | `They are SELFLESS.` |
| #1297 | `They are SELFLESS.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable | single weak signal (refers back to earlier mat | `They lay down thei` | `They are fighting ` |
| #1297 | `They are fighting for our FREEDOM.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable | single weak signal (refers back to earlier mat | `They are SELFLESS.` | `They fight uncondi` |
| #1297 | `They fight unconditionally because they hold a core value, a v` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable | single weak signal (refers back to earlier mat | `They are fighting ` | `We HONOR them.` |
| #1306 | `Patriots in control.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Define cover.` | `Q` |
| #1317 | `The World is Watching.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `The World is Conne` | `Q` |
| #1318 | `If RR is dirty, Mueller must also be dirty.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — answers the question immed | `What was RR's Sena` | `If Mueller is dirt` |
| #1318 | `If Mueller is dirty, RR must also be dirty.` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `If RR is dirty, Mu` | `Common denominator` |
| #1318 | `Everyone has an opinion.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Why did Sessions p` | `Few have the facts` |
| #1318 | `Few have the facts.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — closes a rhetorical questi | `Everyone has an op` | `Few know the plan.` |
| #1318 | `Timing is everything.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Why did SESSIONS r` | `Department of Just` |
| #1318 | `"Horowitz oversees a nationwide workforce of more than 450 spe` | Q_CLAIM | **Q_CLAIM** | HIGH | checkable, conclusion | conclusion upheld — closes a rhetorical questi | `What about the act` | `Why did MP step in` |
| #1318 | `They are deeply connected.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — refers back to earlier mat | `Why did MP step in` | `Think Offshore.` |
| #1319 | `You have more than you know.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Define roadblock.` | `Do not fall victim` |
| #1326 | `Now comes the pain.` | Q_CLAIM | **Q_CLAIM** | HIGH | conclusion | conclusion upheld — answers the question immed | `Medical or escape?` | `Q` |
| #1328 | `This is NOT about a single person.` | Q_CLAIM | **Q_CLAIM** | MEDIUM | checkable | single weak signal (refers back to earlier mat | `Stay on point.` | `This is NOT about ` |

_…and 1,098 more in the JSON._

## source-material boundary (454)

| Post | Exact Q source span | v2 | Proposed | Conf | Attributes | Reason | Before | After |
|---|---|---|---|---|---|---|---|---|
| #10 | `Again, good people were forced into bed with this evil under p` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Remember, the FBI,` | `` |
| #10 | `These people worship Satan _ some openly show it.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Remember, the FBI,` | `` |
| #107 | `May God also grant all of us the wisdom to ask what concrete s` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Code:` | `Note when we just ` |
| #1164 | `Not Public: Five Eyes UK/AUS POTUS targeting using pushed RUS ` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Public: Dossier FI` | `Hussein HRC LL Bre` |
| #1164 | `Hussein HRC LL Brennan Clapper NAT SEC WH SIT RM OP UK AUS ass` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Not Public: Five E` | `Q` |
| #12 | `Military Intelligence ref above is the absolute biggest inside` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `` | `Now think about wh` |
| #12 | `Always ahead.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Military Intellige` | `` |
| #12 | `Good guys are winning.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Military Intellige` | `` |
| #1288 | `Bill Priestap, Head of Counterintelligence and Strzok’s boss -` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `James Comey, direc` | `Peter Strzok, Depu` |
| #1288 | `Peter Strzok, Deputy Assistant Director of the Counterintellig` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Bill Priestap, Hea` | `Lisa Page, attorne` |
| #1288 | `Lisa Page, attorney with the FBI's Office of the General Couns` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Peter Strzok, Depu` | `Conspiracy?` |
| #1316 | `David Laufman, Chief of the Justice Department’s Counterintell` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `[DOJ]` | `John Carlin, Assis` |
| #1316 | `John Carlin, Assistant Attorney General – Head of DOJ’s Nation` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `David Laufman, Chi` | `Sally Yates, Deput` |
| #1399 | `The hard part for us is having to wait for the 'public' to 'kn` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `>>1444632` | `There is no bigger` |
| #1399 | `There is no bigger threat to 'them' than the public being awak` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `The hard part for ` | `Why are we here?` |
| #1454 | `Leaders of EU only care about protecting flow of MONEY - NOT t` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `EU sanctions (IRAN` | `IRAN deal orchestr` |
| #1454 | `IRAN deal orchestrated for the sole purpose of lifting sanctio` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Leaders of EU only` | `Nothing to do w/ N` |
| #1454 | `SCAM!!!` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Leaders of EU only` | `Nothing to do w/ N` |
| #153 | `Perhaps he could not stomach the thought of children being kid` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Perhaps he could n` | `Perhaps he was tir` |
| #153 | `Perhaps he was tired of seeing how certain races/countries wer` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Perhaps he could n` | `Perhaps he could n` |
| #1602 | `If you continue to proceed down this dangerous path only know ` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `>>1925226` | `You should know th` |
| #1602 | `You should know this based on earlier drops re: SA / Nat Guard` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `If you continue to` | `The game is over w` |
| #1603 | `If you are smart (stupid) you know what just occurred at the m` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `>>1925332` | `Attempts to frame ` |
| #1603 | `Attempts to frame Russia / POTUS (optics) are failing and will` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `If you are smart (` | `[Objective] to kee` |
| #1603 | `The age of taxing our citizens across the World while entry to` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `America is no long` | `The WORLD will UNI` |
| #1603 | `The WORLD will UNITE in this cause (G v E/R v W).` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `The age of taxing ` | `Forced immigration` |
| #1605 | `PS "While emotional over the election, I conduct myself w/ upm` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `PS "Texts taken ou` | `PS "In hindsight, ` |
| #1605 | `PS "In hindsight, it was a bad idea to openly discuss my feeli` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `PS "While emotiona` | `PS "I decline to a` |
| #1609 | `POTUS tax reform (more take home money) - not good enough - IM` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `POTUS record low u` | `POTUS save the wor` |
| #1609 | `POTUS save the world from NK - not good enough - IMPEACH.` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `POTUS tax reform (` | `POTUS stock market` |
| #165 | `POTUS advised by SS to terminate use of Twitter due to new web` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Two scenarios (los` | `POTUS silenced on ` |
| #165 | `POTUS silenced on Twitter due to new policy (re: SS / risk).` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `POTUS advised by S` | `Direct message fai` |
| #166 | `POTUS advised by SS to terminate use of Twitter due to new web` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Two scenarios (los` | `POTUS silenced on ` |
| #166 | `POTUS silenced on Twitter due to new policy (re: SS / risk).` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `POTUS advised by S` | `Direct message fai` |
| #1777 | `We will scrub the web to find the source no matter where poste` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Please post your p` | `WE ARE Q.` |
| #1828 | `Hussein (3) NAT SEC ORDERS OFFICIAL (POTUS CAN DECLAS)(Bottom-` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `*Go-Between(s) (me` | `FISA apps FALSE ac` |
| #1828 | `FISA apps FALSE activate domestic spy campaign (UK assist - fe` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Hussein (3) NAT SE` | `They NEVER thought` |
| #19 | `The network which controls this false narrative which in turns` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `You can’t answer t` | `False local and na` |
| #19 | `False local and national black leaders will be exposed next as` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `The network which ` | `Follow the money.` |
| #1911 | `It should be clear based on prev drop re: game comms why ES wa` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `It should be clear` | `It should be clear` |
| #1911 | `It should be clear that 'ES' was used in both (GOOG + @Snowden` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `It should be clear` | `Q` |
| #1964 | `Patriots are dying to defend this great country and the FREEDO` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `A little perspecti` | `Children are being` |
| #1964 | `Children are being kidnapped, tortured, raped, and sacrificed ` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Patriots are dying` | `Stay the course.` |
| #1990 | `Ohr FD-302 02/08/17 (interview date 02/06/17) - POTUS / JC / I` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Ohr FD-302 01/27/1` | `Ohr FD-302 02/15/1` |
| #1990 | `Ohr FD-302 02/15/17 (interview date 02/14/17) - POTUS / JC / I` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Ohr FD-302 02/08/1` | `Ohr FD-302 05/10/1` |
| #2070 | `David Laufman, Chief of the Justice Department’s Counterintell` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `DEPARTMENT OF "JUS` | `John Carlin, Assis` |
| #2070 | `John Carlin, Assistant Attorney General – Head of DOJ’s Nation` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `David Laufman, Chi` | `Sally Yates, Deput` |
| #2070 | `Mary McCord, Acting Assistant Attorney General – Acting Head o` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Sally Yates, Deput` | `Bruce Ohr, Associa` |
| #2070 | `Bruce Ohr, Associate Deputy Attorney General – Demoted 2x - co` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Mary McCord, Actin` | `Rachel Brand, Asso` |
| #2070 | `Rachel Brand, Associate Attorney General – No.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Bruce Ohr, Associa` | `Nothing to See Her` |
| #2070 | `3 official behind Deputy AG Rosenstein - FIRED/FORCED` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Bruce Ohr, Associa` | `Nothing to See Her` |
| #2119 | `There was a time when our history (heritage) was taught with P` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `There was a time w` |
| #2119 | `There was a time when respect was given to those who serve(d),` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `There was a time w` |
| #2119 | `There was a time when these UNITED STATES OF AMERICA, ONE NATI` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `There was a time w` |
| #2119 | `There was a time when these UNITED STATES OF AMERICA, ONE NATI` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `There was a time w` |
| #2119 | `There was a time when, WE, THE PEOPLE, were UNITED and STRONG.` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `“I pledge allegian` |
| #2119 | `“I pledge allegiance to the Flag of the United States of Ameri` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `There was a time w` | `It is time, WE, TH` |
| #2211 | `“Prior to joining NSA, Mr.` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `CHAIRMAN OF THE CO` | `“Earlier in his ca` |
| #2211 | `Storch served in several positions at the Department of Justic` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `CHAIRMAN OF THE CO` | `“Earlier in his ca` |
| #2211 | `He also served as chairman of the Council of the Inspectors Ge` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `CHAIRMAN OF THE CO` | `“Earlier in his ca` |
| #2211 | `The Whistleblower Ombudsperson program he helped establish is ` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `CHAIRMAN OF THE CO` | `“Earlier in his ca` |
| #2211 | `“Earlier in his career, Mr.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `“Prior to joining ` | `VEHICLE FOR CROSS-` |
| #2211 | `Storch also worked as a federal prosecutor in the Northern Dis` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `“Prior to joining ` | `VEHICLE FOR CROSS-` |
| #2211 | `Attorney.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `“Prior to joining ` | `VEHICLE FOR CROSS-` |
| #2211 | `He was also posted overseas for two years as a Department of J` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `“Prior to joining ` | `VEHICLE FOR CROSS-` |
| #2258 | `Senate Democratic Leader Chuck Schumer quickly warned Trump ag` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Schumer’s Warning` | `“This story must n` |
| #2258 | `“This story must not be used as a pretext for the corrupt purp` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Senate Democratic ` | `THE RED LINE.` |
| #2258 | `He added that many “White House and cabinet officials have bee` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Senate Democratic ` | `THE RED LINE.` |
| #23 | `They knew our agencies would grow in power so much so they cou` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Why does the Const` | `Trump nominated so` |
| #23 | `Trump nominated someone new to direct every agency but one.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `They knew our agen` | `` |
| #23 | `He controls the top.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `They knew our agen` | `` |
| #2335 | `"Multiple people familiar with the matter say investigators fo` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"Elemental’s serve` | `"One official says` |
| #2335 | `"One official says investigators found that it eventually affe` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"Multiple people f` | `"One country in pa` |
| #2335 | `"One country in particular has an advantage executing this kin` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"One official says` | `"But that’s just w` |
| #2335 | `"But that’s just what U.S. investigators found: The chips had ` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"One country in pa` | `The More You Know…` |
| #2335 | `In Supermicro, China’s spies appear to have found a perfect co` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"One country in pa` | `The More You Know…` |
| #2362 | `"Freedom is never more than one generation away from extinctio` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `` | `"You and I have th` |
| #2362 | `We didn't pass it to our children in the bloodstream.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `` | `"You and I have th` |
| #2362 | `It must be fought for, protected, and handed on for them to do` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `` | `"You and I have th` |
| #2362 | `"You and I have the courage to say to our enemies, "There is a` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"Freedom is never ` | `"We'll preserve fo` |
| #2362 | `"We'll preserve for our children this, the last best hope of m` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"You and I have th` | `-Ronald Reagan` |
| #2381 | `We understand that there is extreme fatigue and frustration re` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `General Statement:` | `Exclude emotion an` |
| #2381 | `Exclude emotion and personal desire, instead use logic and cri` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `We understand that` | `[Process & Plannin` |
| #2381 | `David Laufman, Chief of the Justice Department’s Counterintell` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Josh Campbell, Spe` | `John Carlin, Assis` |
| #2381 | `John Carlin, Assistant Attorney General – Head of DOJ’s Nation` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `David Laufman, Chi` | `Sally Yates, Deput` |
| #2381 | `Mary McCord, Acting Assistant Attorney General – Acting Head o` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Sally Yates, Deput` | `Bruce Ohr, Associa` |
| #2381 | `Bruce Ohr, Associate Deputy Attorney General – Demoted 2x - co` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Mary McCord, Actin` | `Rachel Brand, Asso` |
| #2381 | `Rachel Brand, Associate Attorney General – No.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Bruce Ohr, Associa` | `[Batter’s Box]` |
| #2381 | `3 official behind Deputy AG Rosenstein - FIRED/FORCED` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Bruce Ohr, Associa` | `[Batter’s Box]` |
| #2383 | `"We have to bypass the media in order to get straight to the p` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `` | `"We've gone around` |
| #2383 | `"We've gone around them like no one in history has gone around` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"We have to bypass` | `-POTUS @ tonight's` |
| #2416 | `If you witness members of ANTIFA or any other people or organi` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `[PANIC IN DC]` | `Internal comms sug` |
| #2416 | `Internal comms suggest preparations are being made and organiz` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `If you witness mem` | `See Something` |
| #2416 | `Uniformed and Non-Uniformed personnel will be stationed across` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Say Something` | `If you witness any` |
| #2416 | `If you witness anything out of the ordinary with regards to st` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Uniformed and Non-` | `See Something` |
| #2431 | `There was a time when our history (heritage) was taught with P` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `There was a time w` |
| #2431 | `There was a time when respect was given to those who serve(d),` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `There was a time w` |
| #2431 | `There was a time when these UNITED STATES OF AMERICA, ONE NATI` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `There was a time w` |
| #2431 | `There was a time when these UNITED STATES OF AMERICA, ONE NATI` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `There was a time w` |
| #2431 | `There was a time when, WE, THE PEOPLE, were UNITED and STRONG.` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `There was a time w` | `I pledge allegianc` |
| #2431 | `I pledge allegiance to the Flag of the United States of Americ` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `There was a time w` | `"Freedom is never ` |
| #2431 | `"Freedom is never more than one generation away from extinctio` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `I pledge allegianc` | `"You and I have th` |
| #2431 | `We didn't pass it to our children in the bloodstream.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `I pledge allegianc` | `"You and I have th` |
| #2431 | `It must be fought for, protected, and handed on for them to do` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `I pledge allegianc` | `"You and I have th` |
| #2431 | `"You and I have the courage to say to our enemies, "There is a` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"Freedom is never ` | `"We'll preserve fo` |
| #2431 | `"We'll preserve for our children this, the last best hope of m` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `"You and I have th` | `-Ronald Reagan` |
| #2436 | `We are all bound by a feeling deep inside, a feeling that cann` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Patriots from arou` | `Remember the battl` |
| #2436 | `For far too long we have been silent and allowed our bands of ` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Remember the battl` | `We became divided.` |
| #2453 | `While we cannot telegraph everything, for reasons all can unde` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `https://twitter.co` | `What are the odds ` |
| #2494 | `This election was not about fixing the economy, trade, borders` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Nothing.` | `This was not simpl` |
| #2494 | `This was not simply another 4-year election, but, a crossroads` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `This election was ` | `https://www.youtub` |
| #25 | `This all has meaning - everything stated.` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Return to comments` | `Proof to begin 11.` |
| #25 | `Big picture stuff - few positions allow for this direct knowle` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Return to comments` | `Proof to begin 11.` |
| #2578 | `Sometimes 'intrusions' are a necessary event in order to safeg` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Sometimes 'intrusi` | `Active criminal in` |
| #2578 | `Active criminal investigations of this magnitude must be handl` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Sometimes 'intrusi` | `The moment your na` |
| #2582 | `This was planned and forecasted as the 'border funding' soluti` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `Learn the Constitu` | `https://twitter.co` |
| #2682 | `They want to keep you poor and in need of government assistanc` | not classified by v2 | **SOURCE_MATERIAL** | MEDIUM |  | sustained prose block — pasted or quoted passa | `WITH CONTROL COMES` | `Bigger the gov’t, ` |
| #2682 | `Bigger the gov’t, the more CONTROL they have, the more POWER t` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `They want to keep ` | `When you are in ne` |
| #2682 | `Transparency is the only way to PROVE TO THE PUBLIC that every` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Transparency is th` | `FAKE NEWS’ [propag` |
| #2682 | `IN POWER].` | not classified by v2 | **Q_CLAIM** | MEDIUM |  | long line, but carries Q's own notation (brack | `Transparency is th` | `FAKE NEWS’ [propag` |

_…and 334 more in the JSON._
