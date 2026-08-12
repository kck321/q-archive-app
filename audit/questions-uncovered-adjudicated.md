# Questions — narrow adjudication of the 146 uncovered `?` units

Scope is these 146 units only. **The frozen scorer is unchanged, no production file is written, nothing is deployed.** Nothing was added merely because it contains `?`.


## Why these were missing

`scripts/audit-all-questions-v2.mjs:144` subtracts `0.6` for a leading imperative verb, a question mark adds `0.6`, and `THRESHOLD` is `0.5`. Any `?`-terminated unit opening with `ask, have, remember, think, defend, protect, note, look, hold, fight` scored exactly `0.0`. The question mark could not save it.


## The model change

A directive and a question are not mutually exclusive. The unit keeps one primary class; an embedded ask is captured separately rather than lost:

```json
{
  "primaryClass": "Q_DIRECTIVE_WITH_EMBEDDED_QUESTION",
  "containsQuestion": true,
  "embeddedQuestion": "why are they panicking?",
  "countsTowardQQuestionTotal": true
}
```

Embedded spans are sliced out of the source string by index, never rebuilt, and every one is verified to be a literal substring of its unit.


## Decisions

| Class | Units | Counts toward the question total |
|---|---|---|
| Q_DIRECTIVE_WITH_EMBEDDED_QUESTION | 51 | yes — the embedded span |
| Q_QUESTION | 47 | yes |
| NEEDS_CONTEXT | 44 | no — pending review |
| SEGMENTATION_ERROR | 4 | no |

## Revised totals

| Measure | Certified | Adjudicated additions | Revised |
|---|---|---|---|
| Question occurrences | 6,299 | +98 | **6,397** |
| Distinct normalised questions | 5,202 | +77 | **5,279** |
| Posts containing questions | 1,665 | +17 | **1,682** |
| Directive-wrapped questions | 0 | +51 | **51** |

48 of the 146 do **not** count: segmentation errors, and imperative-plus-`?` units held at NEEDS_CONTEXT.


## Q_DIRECTIVE_WITH_EMBEDDED_QUESTION (51)

| Post | Q source text (exact) | Embedded question (exact span) | Counts | Conf | Reason | Before | After |
|---|---|---|---|---|---|---|---|
| #1320 | `Ask yourself, why are they panicking?` | `why are they panicking?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Treason is 1/10th.` | `Ask yourself, why is UK, F` |
| #1320 | `Ask yourself, why is UK, France, and Germany so involved?` | `why is UK, France, and Germany so involved?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, why are they` | `Trips to the WH?` |
| #1361 | `Ask yourself, WHY?` | `WHY?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `[ATTACKS WILL ONLY INTENSI` | `Q` |
| #153 | `Ask yourself an honest question, why would a billionaire who has it all, fame, fortune, a warm and l` | `why would a billionaire who has it all, fame, fortune, a warm and lovi` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `For the coming days ahead.` | `Why would he want to targe` |
| #1647 | `Ask yourself - is this normal?` | `is this normal?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Think logically.` | `Conspiracy?` |
| #1648 | `Ask yourself - is this normal?` | `is this normal?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Think logically.` | `Conspiracy?` |
| #1658 | `Ask yourself - is this normal?` | `is this normal?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Good tracking.` | `This is bigger than people` |
| #1659 | `Ask yourself - who is filing the indictments?` | `who is filing the indictments?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `>>1986043` | `It would take a very large` |
| #1660 | `Ask yourself - does Huber have the ability to file across all 50 states?` | `does Huber have the ability to file across all 50 states?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `>>1986153` | `Is any of this normal?` |
| #1796 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `False ‘violent’ narrative ` | `Enjoy the show!` |
| #1822 | `Ask yourself a simple question – WHY????` | `WHY????` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Logical thinking.` | `Q` |
| #1873 | `Ask yourself - WHY?` | `WHY?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Nothing to see here.` | `Q` |
| #1908 | `Ask yourself, would you NOT want to be at your preferred destination PRIOR TO going public?` | `would you NOT want to be at your preferred destination PRIOR TO going ` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `What if Russia was the ori` | `Logical thinking.` |
| #1935 | `Ask yourself, if above are central to operational success, who would you pick to lead such orgs?` | `if above are central to operational success, who would you pick to lea` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `6. F_ASSETS` | `HRC election loss = CF inf` |
| #2000 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `All for a conspiracy?` | `Q` |
| #2248 | `Ask yourself, how would 'FOREIGN' Allies' KNOW what is within a US TOP SECRET FISA warrant?` | `how would 'FOREIGN' Allies' KNOW what is within a US TOP SECRET FISA w` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `` | `"NO INTELLIGENCE SHARED TH` |
| #2248 | `Ask yourself, why are [2] 'KEY' Allies' VERY CONCERNED re: DECLAS & RELEASE?` | `why are [2] 'KEY' Allies' VERY CONCERNED re: DECLAS & RELEASE?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `"NO INTELLIGENCE SHARED TH` | `YOU HAVE MORE THAN YOU KNO` |
| #2534 | `Ask yourself a very simple question, why is there a  total & complete MSM blackout re: France, Belgi` | `why is there a  total & complete MSM blackout re: France, Belgium, Ger` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `>>4119614` | `When you are awake you can` |
| #2645 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Complete BLACKOUT by the F` | `Are they afraid of U.S. Pa` |
| #2678 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `FAKE NEWS attacks continue` | `What happens when the news` |
| #2691 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `You are witnessing the gre` | `FEAR of what?` |
| #2788 | `Ask yourself, why are 'Liberals' always angry?` | `why are 'Liberals' always angry?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `———————————-` | `Why do they curse?` |
| #2887 | `Ask yourself a simple question, should a woman who travels to Syria to support and encourage 'JIHAD'` | `should a woman who travels to Syria to support and encourage 'JIHAD' a` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `` | `Ask yourself a simpler que` |
| #2887 | `Ask yourself a simpler question, if brainwashed by ISIS terrorists (her husband and other close-prox` | `if brainwashed by ISIS terrorists (her husband and other close-proximi` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself a simple ques` | `Why did ISIS launch a soci` |
| #2993 | `ASK YOURSELF A VERY SIMPLE QUESTION, WOULD YOU RELEASE (GO LIVE) TO THE PUBLIC ACROSS THE MEDIA ALL ` | `WOULD YOU RELEASE (GO LIVE) TO THE PUBLIC ACROSS THE MEDIA ALL HIGHLY ` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Where did @Snowden work pr` | `OR, WOULD YOU LOGICALLY TR` |
| #3399 | `Ask yourself, is this normal?` | `is this normal?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Welcome to Epstein Island.` | `What does a 'Temple' typic` |
| #3459 | `Ask yourself a very simple Q - why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Every single 'dirty' tacti` | `Why are the biggest media ` |
| #3540 | `Ask yourself a simple Q - why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `No coverage by US MSM?` | `Anti-narrative?` |
| #3582 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `MSM constant attacks?` | `Q` |
| #3588 | `Ask yourself a very basic question – would the FAKE NEWS complex [NYT, WASHPOST, NBC, ABC, BBC, …………` | `would the FAKE NEWS complex [NYT, WASHPOST, NBC, ABC, BBC, ……………………………` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `But, the ‘narrative’ sugge` | `Ask yourself a very basic ` |
| #3588 | `Ask yourself a very basic question – why is the ‘forum’ where [drops] are made under constant attack` | `why is the ‘forum’ where [drops] are made under constant attack?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself a very basic ` | `Narrative: De-platform nec` |
| #3661 | `Ask yourself a very simple question, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `` | `The 'why' will be (publicl` |
| #3857 | `Ask yourself a simple question —– why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Coordinated?` | `It's time to wake up.` |
| #3881 | `Think: re: why [no] arrests (justice) yet?` | `why [no] arrests (justice) yet?` | yes | HIGH | "think:" directive wrapping an interrogative — Q issues an instruction | `Listen carefully.` | `What if (almost) every cri` |
| #4097 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Prevent public exposure of` | `[D]_People's_Republic_of_C` |
| #4337 | `Ask yourself a very simple question - was it known [common sense and [early] medical reports] elderl` | `was it known [common sense and [early] medical reports] elderly commun` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `What other [D] GOV(s) mand` | `WHY WOULD [4] [D] GOVS PUS` |
| #4428 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Attempt [another] to remov` | `Enemy of the People.` |
| #4635 | `Ask yourself, why are [D] party leaders refusing to condemn the violence?` | `why are [D] party leaders refusing to condemn the violence?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Assault on America.` | `Ask yourself, why are [D] ` |
| #4635 | `Ask yourself, why are [D] party leaders refusing to seek a unified republic?` | `why are [D] party leaders refusing to seek a unified republic?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, why are [D] ` | `IT WAS NEVER ABOUT THE VIR` |
| #725 | `Ask yourself, why is NK participating in the O-games this year?` | `why is NK participating in the O-games this year?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `>>339583` | `Ask yourself, why is the '` |
| #725 | `Ask yourself, why is the 'sister' w/ Pence?` | `why is the 'sister' w/ Pence?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, why is NK pa` | `Ask yourself, if controlle` |
| #725 | `Ask yourself, if controlled, how might you protect yourself and look for a way out?` | `if controlled, how might you protect yourself and look for a way out?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, why is the '` | `Ask yourself, what is a di` |
| #725 | `Ask yourself, what is a distraction?` | `what is a distraction?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, if controlle` | `Ask yourself, why did Kore` |
| #725 | `Ask yourself, why did Korea come together as a country v N&S?` | `why did Korea come together as a country v N&S?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, what is a di` | `Ask yourself, what occurre` |
| #725 | `Ask yourself, what occurred in Asia (ref pics) just prior to the O-games?` | `what occurred in Asia (ref pics) just prior to the O-games?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, why did Kore` | `Ask yourself, what does FR` |
| #725 | `Ask yourself, what does FREED mean?` | `what does FREED mean?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, what occurre` | `Ask yourself, do we want a` |
| #725 | `Ask yourself, do we want a WAR?` | `do we want a WAR?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, what does FR` | `Ask yourself, who is tryin` |
| #725 | `Ask yourself, who is trying to start a WAR?` | `who is trying to start a WAR?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, do we want a` | `Ask yourself, if a missile` |
| #725 | `Ask yourself, if a missile was launched by rogue actors, what would be the purpose?` | `if a missile was launched by rogue actors, what would be the purpose?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, who is tryin` | `Ask yourself, what would/s` |
| #725 | `Ask yourself, what would/should immediately start a WAR?` | `what would/should immediately start a WAR?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `Ask yourself, if a missile` | `Ask yourself, would the PU` |
| #856 | `Ask yourself, why?` | `why?` | yes | HIGH | "ask yourself" directive wrapping an interrogative — Q issues an instr | `A parade that will never b` | `God bless our brave men & ` |

## Q_QUESTION (47)

| Post | Q source text (exact) | Embedded question (exact span) | Counts | Conf | Reason | Before | After |
|---|---|---|---|---|---|---|---|
| #133 | `Have the puppet masters traveled to this island?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `Who are the puppet masters` | `When? How often? Why?` |
| #1509 | `Have you IDEN other person?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `>>1764453` | `Search Hussein admin.` |
| #1746 | `HAVE YOU EVER WITNESSED SO MANY CONGRESS/SENATE SEATS VACATE IN A SHORT PERIOD OF TIME?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `WITNESSING HIGHEST LEVEL T` | `HAVE YOU EVER WITNESSED SO` |
| #1746 | `HAVE YOU EVER WITNESSED SO MANY CEO/BOD VACATE EVENTS IN A SHORT PERIOD OF TIME?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED SO` | `HAVE YOU EVER WITNESSED TH` |
| #1746 | `HAVE YOU EVER WITNESSED THE DOJ/FBI (WHAT IS KNOWN) FIRE/RELEASE (VACATE) EVENTS IN A SHORT PERIOD O` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED SO` | `HAVE YOU EVER WITNESSED TH` |
| #1746 | `HAVE YOU EVER WITNESSED THE VACATING PARTY (ALL POSITIONS) CHALLENGE/FIGHT/PUSH FOR THE REMOVAL OF T` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED TH` | `HAVE YOU EVER WITNESSED A ` |
| #1746 | `HAVE YOU EVER WITNESSED A FORMER US PRESIDENT TRAVEL THE WORLD AHEAD/BEHIND OF THE CURRENT ATTEMPTIN` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED TH` | `HAVE YOU EVER WITNESSED 40` |
| #1746 | `HAVE YOU EVER WITNESSED 40-50K SEALED INDICTMENTS?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED A ` | `HAVE YOU EVER WITNESSED SO` |
| #1746 | `HAVE YOU EVER WITNESSED SO MANY PEDO/CHILD EXP PEOPLE GO DOWN?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED 40` | `HAVE YOU EVER WITNESSED A ` |
| #1746 | `HAVE YOU EVER WITNESSED A SIMILAR LIKE GROUP RISE UP (MIMICS NAZI GERMANY) W/ SIMILAR-LIKE LOGO, PUS` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED SO` | `HAVE YOU EVER WITNESSED A ` |
| #1746 | `HAVE YOU EVER WITNESSED A DEFCON SCARE?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED A ` | `HAVE YOU EVER WITNESSED UN` |
| #1746 | `HAVE YOU EVER WITNESSED UNAUTH MISSILES FIRED?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED A ` | `HAVE YOU EVER WITNESSED PO` |
| #1746 | `HAVE YOU EVER WITNESSED POLITICAL FOUNDATIONS REC HUNDREDS OF MILLIONS OF DOLLARS FROM SPECIFIC TERR` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `HAVE YOU EVER WITNESSED UN` | `ALL DURING THE SAME PERIOD` |
| #190 | `Think Merkel is a coincidence?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `Necessary to form WW allia` | `They are puppets.` |
| #1920 | `Remember Southwest?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `What a coincidence.` | `Remember TX?` |
| #1920 | `Remember TX?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `Remember Southwest?` | `Four?` |
| #2072 | `But… interestingly, if nothing is being done behind the scenes, why are so many FBI & DOJ senior off` | — | yes | HIGH | contains a wh-clause and is not imperative — a question | `But… POTUS is attacking SE` | `But… interestingly, if not` |
| #2087 | `Have the most to FEAR [hide]?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `Those who are the loudest…` | `http://video.foxnews.com/v` |
| #2211 | `But… interestingly, if nothing is being done behind the scenes, why are so many FBI & DOJ senior off` | — | yes | HIGH | contains a wh-clause and is not imperative — a question | `But… POTUS is attacking SE` | `But… interestingly, if not` |
| #243 | `Don't you realize the war has gone public?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `Coincidence directly after` | `List who will not be runni` |
| #247 | `Have you been watching the news since Friday?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `` | `Who is Peter Strzok?` |
| #249 | `Remember?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `RED_RED` | `Hussein AIDS Video.` |
| #2658 | `Remember when D's and the FAKE NEWS media [+FAKEWOOD] pushed mass fear that POTUS would start WWIII ` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `` | `POTUS > PEACE on the Korea` |
| #2658 | `Remember when D's and the FAKE NEWS media [+FAKEWOOD] pushed a stock market collapse if POTUS was el` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `Refusal to provide coverag` | `POTUS E + policies > large` |
| #2658 | `Remember when D's and the FAKE NEWS media [+FAKEWOOD] pushed complete economic collapse if POTUS was` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `[Use FED to inc rates to c` | `POTUS E + policies > lowes` |
| #2682 | `Psych 101: If you hear & see something over and over again by multiple (supposedly credible) news ag` | — | yes | HIGH | contains a wh-clause and is not imperative — a question | `How many experiments have ` | `Do FACT-LESS claims become` |
| #2729 | `Remember the cover story for this?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `` | `Helicopter?` |
| #2945 | `Have you ever witnessed a public all-out attack by the opposition party against the President of the` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `You should update your T-b` | `Those who would normally h` |
| #2976 | `Look familiar?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `Sometimes you need a littl` | `Q` |
| #3053 | `Have you seen the movie 'Snowden'?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `Whistle while you work……` | `"Facebook is my B*TCH." – ` |
| #3247 | `Have you applied to an intel agency?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `>>5943598` | `Q` |
| #3792 | `Remember when the FAKE NEWS MEDIA told you this was all in relation to a gas tax over a year ago?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `https://twitter.com/BasedP` | `Sheep no more!` |
| #3881 | `List of 'in the news now [names]' w/ known ties to Islam?` | — | yes | MEDIUM | noun phrase requesting information, marked as a question | `Muslim Brotherhood` | `THIS IS NOT ANOTHER 4-YEAR` |
| #3911 | `Have you ever witnessed the media, Hwood, [D] party [full], [F] leaders, [F] media, etc. push so muc` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `` | `Why are 'division' tactics` |
| #4423 | `Have you not been following?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `Follow the pen.` | `Q` |
| #4477 | `Q: can we prove it?` | `can we prove it?` | yes | MEDIUM | Q labels the line "Q:" — the label is formatting, the line is a questi | `It's not what you know but` | `Q: can we prove coordinati` |
| #4477 | `Q: can we prove coordination?` | `can we prove coordination?` | yes | MEDIUM | Q labels the line "Q:" — the label is formatting, the line is a questi | `Q: can we prove it?` | `Q: can we prove deliberate` |
| #4477 | `Q: can we prove deliberate action to inc death count to justify vote-by-mail, stay-at-home, bail-out` | `can we prove deliberate action to inc death count to justify vote-by-m` | yes | MEDIUM | Q labels the line "Q:" — the label is formatting, the line is a questi | `Q: can we prove coordinati` | `Q` |
| #4699 | `Have all refusal to bring charges been related to “low-level” arrests?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `DA: will not act re: “low-` | `https://twitter.com/MrAndy` |
| #4741 | `Have you ever witnessed a full-blown international mainstream media constant [barrage] [counter]atta` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `https://www.bing.com/news/` | `Simple logic answers the q` |
| #481 | `Look familiar?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `>>8109` | `Note the desk.` |
| #489 | `Think GS pays for Antifa out of his own pocket?` | — | yes | MEDIUM | elided auxiliary — "[Do you] remember / think / look …?"; interrogativ | `Slush funds everywhere.` | `The hole is deep.` |
| #49 | `Have secret sessions been underway?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `U1 FBI informant.` | `How could this be discover` |
| #536 | `Have you not discovered the CONFIRMED correlation between posts here and Tweets yet?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `>>43719` | `Q` |
| #624 | `Have you learned how to read the message?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `Coincidence?` | `Q` |
| #773 | `Have any recent [shooters] received therapy in the past?` | — | yes | HIGH | auxiliary–subject inversion — a direct question | `>>388082` | `Be the autists we know you` |
| #928 | `Name of FATHER?` | — | yes | MEDIUM | noun phrase requesting information, marked as a question | `Daughter of a Pastor?` | `History of FATHER?` |

## NEEDS_CONTEXT (44)

| Post | Q source text (exact) | Embedded question (exact span) | Counts | Conf | Reason | Before | After |
|---|---|---|---|---|---|---|---|
| #1372 | `Fight to reinstall roadblock?` | — | no | LOW | imperative form carrying a question mark ("Fight …?") with no embedded | `Coincidence?` | `https://www.bloomberg.com/` |
| #1506 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `:32 POTUS` | `Q` |
| #1584 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Be ready.` | `We thank you for your serv` |
| #1646 | `DEFEND MS-13?` | — | no | LOW | imperative form carrying a question mark ("DEFEND …?") with no embedde | `THE TRUTH IS CLEARLY VISIB` | `DEFEND THE DESTRUCTION OF ` |
| #1646 | `DEFEND THE DESTRUCTION OF OUR BORDERS?` | — | no | LOW | imperative form carrying a question mark ("DEFEND …?") with no embedde | `DEFEND MS-13?` | `PROMOTE THE FEAR NUCLEAR W` |
| #1660 | `20-25?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `How large is Mueller’s tea` | `Think 470.` |
| #1804 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Message sent.` | `Q` |
| #1876 | `Stand down orders?` | — | no | LOW | imperative form carrying a question mark ("Stand …?") with no embedded | `Play dates?` | `Non-action orders?` |
| #1979 | `1 = 1?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Reconcile.` | `1 = 0?` |
| #1979 | `1 = 0?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `1 = 1?` | `Evidence of an ongoing inv` |
| #2123 | `Note the time?` | — | no | LOW | imperative form carrying a question mark ("Note …?") with no embedded  | `Reconcile.` | `[9:41]` |
| #2123 | `Note Apple’s stock image(s)?` | — | no | LOW | imperative form carrying a question mark ("Note …?") with no embedded  | `[100%]` | `[9:41]` |
| #2249 | `Use BAIT?` | — | no | LOW | imperative form carrying a question mark ("Use …?") with no embedded i | `How do you catch a FISH?` | `Imagine the information be` |
| #2509 | `Q post timestamp re: DECLAS prior to/post testimony?` | — | no | LOW | ends with "?" but is neither interrogative in form nor imperative | `>>4092602` | `Come timestamp re: attorne` |
| #2510 | `Q post timestamp re: DECLAS prior to/post testimony?` | — | no | LOW | ends with "?" but is neither interrogative in form nor imperative | `Edit:` | `Come[y] timestamp re: atto` |
| #2511 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `re: MUELLER` | `Q` |
| #2548 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Coincidences > > > bypass ` | `SENATE WAS THE TARGET.` |
| #2682 | `Hold people accountable?` | — | no | LOW | imperative form carrying a question mark ("Hold …?") with no embedded  | `How do you 'restore' the i` | `Equal justice under the la` |
| #2686 | `2019?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Will action be taken by DO` | `Q` |
| #2746 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Re: the ‘Scaramucci’ model` | `Those who left (majority) ` |
| #2847 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `You have more than you kno` | `Q` |
| #2849 | `1=1?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Reconcile.` | `When will the FBI conclude` |
| #3254 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `` | `Q` |
| #3417 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `News unlocks.` | `Q` |
| #3418 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `NYC?` | `Watch CA.` |
| #3560 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `News unlocks…` | `Q` |
| #3581 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Do you believe in coincide` | `Be ready, Patriots.` |
| #3588 | `1/100?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Mathematically impossible?` | `But, the ‘narrative’ sugge` |
| #3708 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `[Corn] harvest.` | `Q` |
| #3750 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `At what point will your vo` | `Q` |
| #3751 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `https://twitter.com/M2Madn` | `Q` |
| #3759 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Post drop?` | `Q` |
| #3819 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `https://www.miamiherald.co` | `Welcome to the [D] party.` |
| #3836 | `2 + 2 = 6?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `What advanced weapons did ` | `Define projection.` |
| #3915 | `HOLD HOSTAGE PUBLIC AID in exchange for GREEN NEW DEAL?` | — | no | LOW | imperative form carrying a question mark ("HOLD …?") with no embedded  | `How do you appease radical` | `THE TRUTH WILL SHOCK THE W` |
| #3969 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `Q OP start.` | `Q` |
| #4122 | `Q: Can I obtain detailed information about a current FBI investigation that I see in the news?` | — | no | HIGH | a "Q:"/"A:" pair quoted from an external FAQ (the preceding line is th | `https://www.fbi.gov/about/` | `A: No. Such information is` |
| #4343 | `2 + 2 = 5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `COVID-19 deaths: 850 [no l` | `Q` |
| #4591 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `https://www.breitbart.com/` | `Q` |
| #4663 | `5:5?` | — | no | LOW | no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?");  | `If 20% of those points fai` | `Q` |
| #4774 | `Check Gmail?` | — | no | LOW | imperative form carrying a question mark ("Check …?") with no embedded | `What did we learn this wee` | `Q` |
| #4802 | `Rally POTUS v BIDEN attendance?` | — | no | LOW | imperative form carrying a question mark ("Rally …?") with no embedded | `Trade today [China phase I` | `BIDEN interview(s) non_bas` |
| #4872 | `Protect truth re: Hillary/DNC Russia collusion?` | — | no | LOW | imperative form carrying a question mark ("Protect …?") with no embedd | `Why was POTUS framed re: R` | `Why was POTUS impeached re` |
| #4872 | `Protect truth re: Biden/[CLAS 1-99] Ukraine collusion?` | — | no | LOW | imperative form carrying a question mark ("Protect …?") with no embedd | `Why was POTUS impeached re` | `Blame 'opponent' for what ` |

## SEGMENTATION_ERROR (4)

| Post | Q source text (exact) | Embedded question (exact span) | Counts | Conf | Reason | Before | After |
|---|---|---|---|---|---|---|---|
| #1318 | `Department of Justice does not discuss ongoing investigations or confirm specific matters, What abou` | — | no | HIGH | a declarative and a question joined into one unit | `` | `` |
| #144 | `C. attacked (hack-attempt)?` | — | no | HIGH | starts on a lone initial — the front of the sentence was cut off | `How are people inform[e]d?` | `Why was Op[e]ration Mockin` |
| #2971 | `"you will be asked to give proof of your identity" synonyms:	evidence, verification, corroboration, ` | — | no | HIGH | a pasted dictionary/definition block glued to a trailing question | `` | `` |
| #4454 | `At the same time, they gave more power to their obedient followers, like Antifa, while keeping the r` | — | no | HIGH | quoted material with an unbalanced quote mark, glued to a trailing que | `` | `` |

## Held for your decision

- **NEEDS_CONTEXT, imperative + `?`** — `DEFEND MS-13?`, `Hold people accountable?`, `Protect truth re: Hillary/DNC Russia collusion?`, `Check Gmail?`, `Use BAIT?`, `Rally POTUS v BIDEN attendance?`. Each reads as an incredulous rhetorical question inside a list, but the unit alone cannot settle it. Context columns are provided.
- **NEEDS_CONTEXT, code tokens** — `5:5?` (18 occurrences), `1=1?`, `2 + 2 = 6?`, `2019?`, `20-25?`. `5:5?` is a genuine radio-idiom question ("do you read me five by five?"), but it carries no letters and certifying it from the unit alone would be a guess.
- **`Q:`/`A:` FAQ pairs** — #4122 is quoted verbatim from `https://www.fbi.gov/about/faqs`, the line directly above it, and is answered by an `A:` line below. Detected by rule and held at `NEEDS_CONTEXT`: Q is pasting someone else's Q&A, not asking. The three `Q: can we prove …?` lines in #4477 have no `A:` reply and no source URL, so they stand as Q's own.
- **Segmentation errors carrying a real question** — #1318 strands `What about the active investigation into leaks?` after a declarative. Recorded in `strandedQuestion`, not counted, because the unit boundary is wrong rather than the classification.
