# Q Drops — Directives certification (candidate)

Full-corpus pass. Questions stay frozen; **nothing written to `public/data`, nothing deployed.**


## Why the order matters

Running the mood detector over the raw corpus reports **2,780 imperatives** — but 279 open with `Do` (`Do you believe in coincidences?`) and 31 with `Have` (`Have the puppet masters traveled to this island?`). Those are interrogatives; `do` and `have` are also base-form verbs, so mood alone cannot separate them. The earlier adjudication never hit this because it tested `/\?$/` before asking about mood.

So the certified Questions dataset is consulted **first**. A unit already certified as a question is settled and mood is never asked about it.


## Pipeline

| Stage | Units |
|---|---|
| NOT_A_DIRECTIVE | 20,190 |
| CERTIFIED_QUESTION_ONLY | 6,368 |
| DIRECTIVE_CERTIFIABLE | 1,746 |
| DIRECTIVE_UNFAMILIED | 359 |
| SEGMENTATION_ERROR | 326 |
| DIRECTIVE_LEARNED_VERB | 263 |
| INFO_REQUEST_BOTH | 177 |
| NEEDS_CONTEXT | 60 |
| DIRECTIVE_WITH_EMBEDDED_QUESTION | 51 |
| QUESTION_MARK_NOT_CERTIFIED | 29 |

## Candidate totals

| Measure | Value |
|---|---|
| Directive occurrences | **1,974** |
| Distinct (canonical `key()`) | 1,159 |
| Posts containing a directive | 1,208 |
| Also a certified question (cross-linked) | 228 |
| Not currently stored as an actionRequest | 302 |
| Stored as actionRequest but NOT a directive | 1,074 |
| Held at NEEDS_CONTEXT | 60 |

### By family

| Family | Count |
|---|---|
| cognition | 658 |
| research | 493 |
| morale | 400 |
| attention | 284 |
| dissemination | 84 |
| prohibition | 55 |

## Evidence bands

A unit joins the **certified candidate** total only if its verb comes from the curated lexicon AND it lands in one of the six agreed families. Everything resting on weaker evidence is queued, not counted.

| Band | Units | Counted? |
|---|---|---|
| Curated verb + agreed family | 1,746 | yes |
| Directive-wrapped question | 51 | yes — also a certified question |
| Information-request imperative | 177 | yes — also a certified question |
| Curated verb, no agreed family | 359 | no — queued |
| Corpus-learned verb only | 263 | no — queued |
| Stored actionRequest, not imperative | 1,074 | no — queued |
| Undecidable standing alone | 60 | no — queued |

## The open-vocabulary problem

The frozen auditor used ~40 verbs and missed roughly 1,300 units. Hand-extending that list only moves the boundary, so the detector also learns verbs from Q's own writing: a word is a verb if a MODAL precedes it, since English modals take a bare infinitive. That recovers `READY THE MEMES.` and `DISARM.`, which no hand-list held. **111 verbs** were learned this way.

Two signals had to be excluded, both caught by the output being obviously wrong:

- **The infinitive marker `to` is unusable** — it is also a preposition, so `to power`, `to justice`, `to POTUS` mint nouns as verbs. Including it produced 1,793 unfamilied "directives" led by POTUS, FISA, HRC and JUSTICE, with `POTUS DECLINE>` read as a command.
- **Modals inside questions are inverted** — `Will POTUS declassify?` puts the SUBJECT after the modal. Interrogative lines are now skipped; without that, SESSIONS and DECLAS became verbs.

Residue remains, because Q writes questions without question marks. That is exactly why every corpus-learned decision is banded LOW and queued rather than certified.


## Two decisions needed before this can be certified


### 1. Information-request imperatives are BOTH

`List the Billionaires.`, `List advantages.`, `List out all who have foundations.` are already **certified questions** (`semanticFunction: information_request`) and are plainly also directives — they tell the reader to produce something.

This is the mirror of the directive-wrapped case: there the wrapper instructs and the embedded span asks; here one unit does both at once. Since Questions are frozen, they are kept as certified questions and given a directive cross-link — counted once as a question, once as a directive, never twice within either total. **228 units** are affected.

Confirm that reading, or say they should be directives only.


### 2. 359 directives fit none of the six families

The agreed families are research / cognition / attention / morale / prohibition / dissemination. These do not fit:

| Leading verb | Count | Example |
|---|---|---|
| keep | 27 | `Keep open (+6 mo).` |
| be | 27 | `Be [p]repared.` |
| make | 19 | `Make a list.` |
| put | 17 | `Put on the full armor of God so that you can take your stand a` |
| open | 16 | `Open source.` |
| take | 14 | `Take the helmet of salvation and the sword of the Spirit, whic` |
| please | 11 | `Please pray.` |
| start | 11 | `Start.` |
| ask | 9 | `Ask yourself simple questions.` |
| use | 9 | `USE A STEALTH BOMBER` |
| add | 8 | `ADD RUDY (quiet).` |
| don | 7 | `Don’t forget about Huma.` |
| do | 7 | `Don’t forget about Huma.` |
| (symbol) | 7 | `Open source.` |
| end | 6 | `End.` |
| go | 6 | `Go deeper.` |
| drop | 6 | `DROP THE MEMES` |
| correct | 5 | `Correct.` |
| return | 5 | `Return to SA.` |
| have | 5 | `Have a wonderful weekend.` |

They read as **operational tasking** — `Keep open (+6 mo).`, `ADD RUDY (quiet).`, `SET UP.`, `CLEAR ALL NONS.`, `Return to SA.`, `Close to door.` — instructions about handling or state, often addressed to insiders rather than to readers. A seventh family (`operational`) would hold them cleanly. I have **not** invented one: they are parked as `other` at MEDIUM confidence pending your call.


## Adjudication queue — stored as actionRequest, not a directive

1,074 stored records do not survive the mood test.

| Post | Text | Proposed | Why | Before | After |
|---|---|---|---|---|---|
| #1001 | `Sacrifice.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "sacrifice", which is not  | `Each prince is associa` | `Collect.` |
| #1001 | `Tunnels.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "tunnels", which is not a  | `[Classified]-2` | `Table 29.` |
| #1004 | `ACTIVATE D-PRIV` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "activate", which is not a | `B` | `Q` |
| #1010 | `Choice is yours.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `UK/GER [5 days].` | `REVELATIONS.` |
| #1017 | `Happy Hunting!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "happy", which is not a ba | `The Analysis Corporati` | `Q` |
| #1029 | `Thank you for your prayers.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "thank", which is not a ba | `` | `Forced reaction.` |
| #103 | `Come home safe.` | Q_DIRECTIVE | opens with the base-form verb "come" and has no subjec | `You are all heroes.` | `Godspeed.` |
| #1034 | `Timeline.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "timeline", which is not a | `Track events.` | `We are in control` |
| #104 | `Now is the time to pray.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `` | `We're operational.` |
| #1044 | `Videos / backup.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "videos", which is not a b | `Fake pic push by MSM.` | `Google kill.` |
| #1047 | `Spray.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "spray", which is not a ba | `Red, White, and Blue.` | `Q` |
| #105 | `Please pray.` | Q_DIRECTIVE | adverb "please" in front of the base-form verb "pray"  | `` | `Operators are in harms` |
| #105 | `Please pause and give thanks to those who would die to save our republ` | Q_DIRECTIVE | adverb "please" in front of the base-form verb "pause" | `High value targets.` | `More to follow.` |
| #1050 | `Patriots together.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "patriots", which is not a | `Stand strong.` | `Q` |
| #1051 | `We Fight for FREEDOM.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `For God & Country!` | `Q` |
| #1055 | `Open source.` | Q_DIRECTIVE | opens with the base-form verb "open" and has no subjec | `Friends lead to others` | `Q` |
| #1057 | `Report to FBI / DOJ.` | Q_DIRECTIVE | opens with the base-form verb "report" and has no subj | `>>925311` | `Watch what happens.` |
| #1059 | `“Watch the news.”` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "", which is not a base-fo | `>>926634` | `Q` |
| #1063 | `Open the door.` | Q_DIRECTIVE | opens with the base-form verb "open" and has no subjec | `Waiting.` | `@Snowden` |
| #1070 | `Talking to you, anon.` | Q_STATEMENT_OR_CLAIM | not imperative — gerund head — a label, not a command | `>>936346` | `We always see “It’s Ha` |
| #1078 | `Prevent.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "prevent", which is not a  | `>>946456` | `Auth 1st S.` |
| #1079 | `Tracking good.` | Q_STATEMENT_OR_CLAIM | not imperative — gerund head — a label, not a command | `>>946546` | `Relay back channel S-W` |
| #1079 | `Relay back channel S-WH-E-P1.` | Q_DIRECTIVE | opens with the base-form verb "relay" and has no subje | `Tracking good.` | `Fly High.` |
| #1079 | `Fly High.` | Q_DIRECTIVE | opens with the base-form verb "fly" and has no subject | `Relay back channel S-W` | `Q` |
| #1093 | `God bless you all.` | Q_DIRECTIVE | opens with "god", used as a verb elsewhere in the corp | `https:// m.youtube.com` | `` |
| #1094 | `Flag.` | Q_DIRECTIVE | opens with the base-form verb "flag" and has no subjec | `` | `SEC detail background.` |
| #1094 | `SEC detail background.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `Flag.` | `All looking away.` |
| #1098 | `Bring back the gallows!` | Q_STATEMENT_OR_CLAIM | not imperative — gerund head — a label, not a command | `Sold out.` | `Q` |
| #1100 | `Drain the swamp.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "drain", which is not a ba | `Money talks.` | `How do politicians acc` |
| #1106 | `Hold until CONF.` | Q_DIRECTIVE | opens with the base-form verb "hold" and has no subjec | `Syria.` | `MIL assets on the grou` |
| #112 | `Important to archive.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `` | `Above & next drops hav` |
| #112 | `Repeat.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "repeat", which is not a b | `Stay alert in main US ` | `Stay alert in main US ` |
| #112 | `Summarize and paint the picture.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "summarize", which is not  | `Above will have contex` | `Critical.` |
| #1120 | `Start.` | Q_DIRECTIVE | opens with the base-form verb "start" and has no subje | `US.` | `Q` |
| #1124 | `Testify then drop.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "testify", which is not a  | `Yes.` | `We have it all.` |
| #1130 | `Finder of this should apply to NSA.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `>>1003248` | `Q` |
| #1132 | `Welcome aboard.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "welcome", which is not a  | `Thank you Alan.` | `Freedom!` |
| #1137 | `Welcome aboard.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "welcome", which is not a  | `Alan.` | `Plane.` |
| #1152 | `Thank you, Patriot.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "thank", which is not a ba | `>>1056562` | `Proofs being lost.` |
| #1157 | `Nothing stated should be discounted.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Has POTUS made a state` | `Moving fast.` |
| #116 | `Upload to graphic.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "upload", which is not a b | `Archive immediately.` | `Q` |
| #1176 | `Think State of the Union - FREE.` | Q_STATEMENT_OR_CLAIM | not imperative — first word is the subject of a report | `Good vs Evil is real.` | `Coincidence?` |
| #1180 | `Join POTUS’ legal team.` | Q_DIRECTIVE | opens with the base-form verb "join" and has no subjec | `Quiet until now.` | `Direct discussions ava` |
| #1186 | `Archive OFFLINE immediately.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `The importance of this` | `Offline only.` |
| #1186 | `Offline only.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "offline", which is not a  | `Archive OFFLINE immedi` | `Future events re: Inte` |
| #1188 | `Data mine NP +1 +5` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "data", which is not a bas | `Engineers.` | `All.` |
| #1188 | `Build profile 1XD x7` | Q_DIRECTIVE | opens with the base-form verb "build" and has no subje | `Architects.` | `All.` |
| #1198 | `Keep up the good fight!` | Q_DIRECTIVE | opens with the base-form verb "keep" and has no subjec | `Time limited.` | `Q` |
| #1199 | `Answer Q re: SR.` | SEGMENTATION_ERROR | fragment of a split sentence | `` | `SR June JA.` |
| #1208 | `Open source.` | Q_DIRECTIVE | opens with the base-form verb "open" and has no subjec | `https:// www.wehoville` | `Q` |
| #1209 | `The choice, to know, will be yours.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `This door will be open` | `END.` |
| #1213 | `Open source.` | Q_DIRECTIVE | opens with the base-form verb "open" and has no subjec | `>>1123519` | `Q` |
| #1226 | `Everything has meaning.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Marker.` | `Everything.` |
| #1226 | `Everything.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Everything has meaning` | `Q&A.` |
| #1226 | `Win.` | NEEDS_CONTEXT | "Win" standing alone is equally a noun and a command — | `How do we ‘legally’ ……` | `This platform is more ` |
| #1229 | `You have more than you know.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `The world is connected` | `Q` |
| #1232 | `Fire up those Memes!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "fire", which is not a bas | `>>1133332` | `Please stand by.` |
| #1232 | `Please stand by.` | Q_DIRECTIVE | adverb "please" in front of the base-form verb "stand" | `Fire up those Memes!` | `On the clock.` |
| #1235 | `Don’t forget about Huma.` | Q_DIRECTIVE | opens with the base-form verb "don" and has no subject | `Good article.` | `AWAN.` |
| #1241 | `Re_ read past drops.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "re", which is not a base- | `Off the books?` | `Will become relevant.` |
| #1247 | `Happy hunting!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "happy", which is not a ba | `>>1158853` | `http:// www.un.org/en/` |
| #1248 | `Question.` | NEEDS_CONTEXT | "Question" standing alone is equally a noun and a comm | `Learn.` | `Fight!` |
| #1248 | `Fight!` | NEEDS_CONTEXT | "Fight" standing alone is equally a noun and a command | `Question.` | `https:// www.npr.org/2` |
| #1254 | `“Mark it down.”` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "", which is not a base-fo | `POTUS today.` | `“Bigger problems than ` |
| #1254 | `Sweet Dreams.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "sweet", which is not a ba | `IRON EAGLE.` | `Q` |
| #1255 | `You decide.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `His sole purpose [WH v` | `Q` |
| #1263 | `Strategically.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "strategically", which is  | `Apply leverage.` | `1-by-1.` |
| #1263 | `Unity.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "unity", which is not a ba | `1-by-1.` | `Power shift.` |
| #1263 | `Rise of the people.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `Power shift.` | `WW.` |
| #1267 | `Try harder.` | Q_DIRECTIVE | opens with "try", used as a verb elsewhere in the corp | `WW = worldwide.` | `Q` |
| #1268 | `Quiet.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "quiet", which is not a ba | `Did you know?` | `Army Lt. Gen. Paul Nak` |
| #127 | `The graphic is your key.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `` | `Let's pause and say he` |
| #1274 | `Try harder.` | Q_DIRECTIVE | opens with "try", used as a verb elsewhere in the corp | `>>1189008` | `Ready for tomorrow?` |
| #1275 | `#Releasethetexts` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "", which is not a base-fo | `https://bigleaguepolit` | `No redactions.` |
| #1275 | `No redactions.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `#Releasethetexts` | `Q` |
| #128 | `Re-review graphic (in full) each day post news release.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "re", which is not a base- | `Time stamp(s) and orde` | `Learn to distinguish b` |
| #128 | `Attention on deck.` | Q_DIRECTIVE | fixed instruction idiom — no family in the agreed six | `Dissemination.` | `There is an active war` |
| #128 | `Be [p]repared.` | Q_DIRECTIVE | "be" + complement — imperative — no family in the agre | `There is an active war` | `Ope[r]ations underway.` |
| #1282 | `You have more than you know.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `What is the purpose of` | `Comms understood?` |
| #1284 | `Future proves past.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `Re_read drops.` | `You have more than you` |
| #1284 | `You have more than you know.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Future proves past.` | `Q` |
| #1287 | `Question everything.` | Q_DIRECTIVE | opens with the base-form verb "question" and has no su | `Not confirming SC is o` | `Timing important.` |
| #1288 | `Only the above.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Think about the above.` | `Get the picture?` |
| #1291 | `Step back.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "step", which is not a bas | `Trust the plan.` | `Remove arrests.` |
| #1291 | `Remove arrests.` | Q_DIRECTIVE | opens with the base-form verb "remove" and has no subj | `Step back.` | `What do you see?` |
| #1292 | `Your move.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `You know what we have.` | `Q` |
| #1295 | `Be careful who you are following.` | Q_DIRECTIVE | "be" + complement — imperative — no family in the agre | `` | `Some are profiting off` |
| #1295 | `You decide.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Those who would seek p` | `This is not a game.` |
| #1295 | `God bless you all.` | Q_DIRECTIVE | opens with "god", used as a verb elsewhere in the corp | `The only profit we sho` | `Q` |
| #1297 | `We HONOR them.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `They fight uncondition` | `We must do better to p` |
| #1297 | `We must do better to protect them.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `We HONOR them.` | `WWG1WGA.` |
| #13 | `Now think about the timing of POTUS traveling to China/SK.` | Q_DIRECTIVE | adverb "now" in front of the base-form verb "think" —  | `` | `` |
| #1305 | `No name out.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `` | `Now.` |
| #1305 | `Now.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "now", which is not a base | `No name out.` | `https://mobile.twitter` |
| #131 | `Please stand by.` | Q_DIRECTIVE | adverb "please" in front of the base-form verb "stand" | `POTUS NAT SEC E briefi` | `Q` |
| #1325 | `Happy hunting!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "happy", which is not a ba | `http://www.iran-daily.` | `Q` |
| #1328 | `[Be careful who you follow]` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "", which is not a base-fo | `There was however a st` | `Incorrect message tran` |
| #1328 | `Stay on point.` | Q_STATEMENT_OR_CLAIM | not imperative — first word is the subject of a report | `Use LOGIC.` | `This is NOT about a si` |
| #1332 | `We FIGHT.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `WWG1WGA.` | `Conspiracy no more.` |
| #1334 | `Overcome.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "overcome", which is not a | `Not Forgotten.` | `Q` |
| #1338 | `Explore further.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "explore", which is not a  | `>>1368028` | `Q` |
| #1339 | `Be careful who you follow.` | Q_DIRECTIVE | "be" + complement — imperative — no family in the agre | `Selling makes money.` | `Define 'Patriot'.` |
| #1343 | `"Be careful who you follow."` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "", which is not a base-fo | `Simple 'non-direct' st` | `"Some are profiting of` |
| #1346 | `Next.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "next", which is not a bas | `Digest.` | `What CEOs have resigne` |
| #1346 | `You have more than you know.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Cross check against Co` | `Happy Hunting!` |
| #1346 | `Happy Hunting!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "happy", which is not a ba | `You have more than you` | `Q` |
| #1358 | `God bless you all.` | Q_DIRECTIVE | opens with "god", used as a verb elsewhere in the corp | `The choice will always` | `Where we go one, we go` |
| #1363 | `Image search for 'fire truck / engine'.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "image", which is not a ba | `` | `Letter common in front` |
| #1369 | `We Fight!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `]SESSIONS[` | `Q` |
| #1373 | `We Fight!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `CORRUPTION everywhere.` | `We, The PEOPLE.` |
| #1375 | `Be proud.` | Q_DIRECTIVE | "be" + complement — imperative — no family in the agre | `History books.` | `TOGETHER.` |
| #1375 | `TOGETHER.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "together", which is not a | `Be proud.` | `WWG1WGA!` |
| #1378 | `Start a Storm.` | Q_DIRECTIVE | opens with the base-form verb "start" and has no subje | `Politicians bought & p` | `Q` |
| #1380 | `Focus.` | NEEDS_CONTEXT | "Focus" standing alone is equally a noun and a command | `Faces of lawmakers ste` | `When did Adm R step do` |
| #1389 | `Do what is right.` | Q_DIRECTIVE | opens with the base-form verb "do" and has no subject  | `You have a choice.` | `https://www.youtube.co` |
| #139 | `Re-read crumbs.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "re", which is not a base- | `Why is this relevant?` | `Q` |
| #140 | `Return to SA.` | Q_DIRECTIVE | opens with the base-form verb "return" and has no subj | `What is the keystone?` | `Strings cut (+++).` |
| #141 | `We can't do it without you.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `The picture will open ` | `God bless you all.` |
| #141 | `God bless you all.` | Q_DIRECTIVE | opens with "god", used as a verb elsewhere in the corp | `We can't do it without` | `Q` |
| #1419 | `I'd watch the news that day.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `>>1472580` | `Q` |
| #1425 | `Be prepared.` | Q_DIRECTIVE | "be" + complement — imperative — no family in the agre | `Given we have now unde` | `TRUST the plan.` |
| #143 | `Go deeper.` | Q_DIRECTIVE | opens with the base-form verb "go" and has no subject  | `Confirmed.` | `Signatures are IMPORTA` |
| #1430 | `Be careful who you follow.` | Q_DIRECTIVE | "be" + complement — imperative — no family in the agre | `Understood?` | `Q` |
| #1432 | `Put on the full armor of God so that you can take your stand against t` | Q_DIRECTIVE | opens with the base-form verb "put" and has no subject | `` | `– Ephesians 6:10-18` |
| #1432 | `Take the helmet of salvation and the sword of the Spirit, which is the` | Q_DIRECTIVE | opens with the base-form verb "take" and has no subjec | `` | `– Ephesians 6:10-18` |
| #1434 | `Slowly & carefully.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "slowly", which is not a b | `Re_read.` | `http://www.breitbart.c` |
| #1441 | `Start the Clock.` | Q_DIRECTIVE | opens with the base-form verb "start" and has no subje | `` | `A Week to [Remember].` |
| #1443 | `Do what is right.` | Q_DIRECTIVE | opens with the base-form verb "do" and has no subject  | `You have a choice.` | `FBI agents willing to ` |
| #1445 | `Trace sale/spin off of Co.` | SEGMENTATION_ERROR | fragment of a split sentence | `Trace from China/MX to` | `Trace to CF.` |
| #1449 | `You are watching a 'plan' being set in motion.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `How was this known?` | `Enjoy the show.` |
| #1453 | `Slowly & carefully.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "slowly", which is not a b | `Re_read (again).` | `http://www.breitbart.c` |
| #1458 | `PANIC.` | NEEDS_CONTEXT | "PANIC" standing alone is equally a noun and a command | `Hint: Those responsibl` | `Q` |
| #1461 | `Good decoding.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `These are spread to di` | `Technically US 11th = ` |
| #147 | `You are witnessing history.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `The article is disinfo` | `Coincidence?` |
| #1471 | `Let them all DIG THEIR OWN GRAVES.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "let", which is not a base | `Does Acosta's continue` | `Q` |
| #1478 | `Critical thinking.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `Some areas we cannot e` | `Q` |
| #1479 | `Reverse image search.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "reverse", which is not a  | `>>1718830` | `Think hack.` |
| #1481 | `Connected.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "connected", which is not  | `` | `http://www.foxnews.com` |
| #1486 | `You will need soon.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `No links within each p` | `Q` |
| #1492 | `Re_read 10x 50x 100x.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `>>1731991` | `Slowly & CAREFULLY.` |
| #1492 | `Slowly & CAREFULLY.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "slowly", which is not a b | `Re_read 10x 50x 100x.` | `STOP AFTER EACH SENTEN` |
| #1492 | `CONTINUE.` | Q_DIRECTIVE | opens with the base-form verb "continue" and has no su | `RE_READ.` | `APPOINTMENT OF A 2ND S` |
| #1493 | `GOD SAVE US.` | Q_DIRECTIVE | opens with "god", used as a verb elsewhere in the corp | `C_A RUSSIA MASK HACK (` | `Q` |
| #1498 | `Critical thinking.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `Why was Rachel Brand r` | `Q` |
| #1509 | `Obtain name.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "obtain", which is not a b | `No facial hair.` | `Cross FBI sec clearanc` |
| #1510 | `Keep your eyes on the ball.` | Q_DIRECTIVE | opens with the base-form verb "keep" and has no subjec | `IG report on HRC email` | `POTUS is not going thr` |
| #1516 | `You have more than you know.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Coincidence?` | `News unlocks past.` |
| #1516 | `News unlocks past.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "news", which is not a bas | `You have more than you` | `MAP.` |
| #1516 | `MAP.` | NEEDS_CONTEXT | "MAP" standing alone is equally a noun and a command — | `News unlocks past.` | `Q` |
| #1517 | `Careful of clickbait.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `Logical?` | `Q` |
| #1519 | `WWG1WGA!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "wwg", which is not a base | `We are in this togethe` | `Q` |
| #153 | `Make a list.` | Q_DIRECTIVE | opens with the base-form verb "make" and has no subjec | `What about voter ID la` | `Reconcile.` |
| #153 | `Laugh.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "laugh", which is not a ba | `What about voter ID la` | `Reconcile.` |
| #1546 | `Happy Hunting D!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "happy", which is not a ba | `[J C]` | `http://thehill.com/hil` |
| #1557 | `You asked for popcorn.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `>>1807979` | `Let’s start here.` |
| #1557 | `Let’s start here.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "let", which is not a base | `You asked for popcorn.` | `Q` |
| #1558 | `Free Iran!!!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "free", which is not a bas | `` | `Fight` |
| #1558 | `Fight` | NEEDS_CONTEXT | "Fight" standing alone is equally a noun and a command | `Free Iran!!!` | `Fight` |
| #1558 | `Fight` | NEEDS_CONTEXT | "Fight" standing alone is equally a noun and a command | `Fight` | `Fight` |
| #1558 | `Fight` | NEEDS_CONTEXT | "Fight" standing alone is equally a noun and a command | `Fight` | `Regime change.` |
| #1558 | `We stand with you.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `People have the power.` | `Q` |
| #1569 | `Thank you for your service.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "thank", which is not a ba | `>>1823342` | `God bless and stay saf` |
| #1569 | `God bless and stay safe.` | Q_DIRECTIVE | opens with "god", used as a verb elsewhere in the corp | `Thank you for your ser` | `Q` |
| #1573 | `Fireworks.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "fireworks", which is not  | `[RR]` | `Rank & file testifying` |
| #1575 | `Abandon ship!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "abandon", which is not a  | `` | `Hussein staff talking.` |
| #1583 | `God bless you all.` | Q_DIRECTIVE | opens with "god", used as a verb elsewhere in the corp | `Do you believe in coin` | `Q` |
| #1585 | `We fight.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `We stand.` | `TOGETHER.` |
| #1595 | `Time to FEED.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "time", which is not a bas | `Conspiracy no more.` | `Q` |
| #1601 | `Keep up the good fight, Patriot.` | Q_DIRECTIVE | opens with the base-form verb "keep" and has no subjec | `Fist pumps re: POTUS /` | `This will be a very co` |
| #1601 | `Feel proud.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "feel", which is not a bas | `This will be a very co` | `#Winning` |
| #1602 | `The fight to keep the LIGHTS OFF is all that matters to you.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `The game is over when ` | `You will FAIL.` |
| #1604 | `RISE UP and DEMAND THEY BE REMOVED.` | Q_DIRECTIVE | opens with the base-form verb "rise" and has no subjec | `TRUE RULE, THE PEOPLE ` | `At some point military` |
| #1604 | `We stand with you.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `At some point military` | `We are monitoring the ` |
| #1612 | `You have time.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Just landed.` | `Q` |
| #1614 | `We see you.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `` | `So many VIPs @ the ral` |
| #164 | `Keep up the good fight.` | Q_DIRECTIVE | opens with the base-form verb "keep" and has no subjec | `Bots deactivated upon ` | `It’s spreading.` |
| #1643 | `We are waiting for a reporter to ask the ultimate question.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `>>1952489` | `What are they waiting ` |
| #1644 | `Think of every post made.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `Conspiracy no more.` | `It would force us to p` |
| #1645 | `Play LOUD.` | Q_DIRECTIVE | opens with "play", used as a verb elsewhere in the cor | `` | `Be PROUD!` |
| #1645 | `Be PROUD!` | Q_DIRECTIVE | "be" + complement — imperative — no family in the agre | `Play LOUD.` | `https://m.youtube.com/` |
| #1646 | `WE FIGHT.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `WE STAND AT THE READY.` | `DARK TO LIGHT.` |
| #165 | `Re-read crumbs on this topic (necessary).` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "re", which is not a base- | `What transpired w/ POT` | `Two scenarios (lose/lo` |
| #165 | `Patriots, get the word out.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "patriots", which is not a | `Solution?` | `Jason Bourne (Deep Dre` |
| #166 | `Re-read crumbs on this topic (necessary).` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "re", which is not a base- | `What transpired w/ POT` | `Two scenarios (lose/lo` |
| #166 | `Patriots, get the word out.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "patriots", which is not a | `Solution?` | `Jason Bourne (Deep Dre` |
| #1660 | `Think 470.` | Q_STATEMENT_OR_CLAIM | not imperative — first word followed by a copula, "of" | `20-25?` | `The more you know.` |
| #1660 | `The more you know.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Think 470.` | `Q` |
| #1666 | `Re_ read drops re: Five Eyes / FVEY.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "re", which is not a base- | `https://www.breitbart.` | `Will be extremely impo` |
| #1672 | `Logical thinking.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `` | `Why was the case again` |
| #1684 | `PANIC!` | NEEDS_CONTEXT | "PANIC" standing alone is equally a noun and a command | `https://www.huffington` | `Q` |
| #1685 | `Logical thinking.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `Now do you understand ` | `[20]` |
| #1686 | `WWG1WGA!` | Q_STATEMENT_OR_CLAIM | not imperative — opens with "wwg", which is not a base | `Think HUBER.` | `Q` |
| #1688 | `Dark to LIGHT.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `Who is financing now?` | `GOOD WINS.` |
| #1698 | `We stand with you.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `To your children.` | `The time is now.` |
| #1708 | `The more you know.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Think source files.` | `Q` |
| #1711 | `LOGICAL THINKING.` | Q_STATEMENT_OR_CLAIM | not imperative — adjective heading a noun phrase, not  | `Do you believe POTUS w` | `Clickbait derails logi` |
| #1712 | `Put to death, therefore, whatever belongs to your earthly nature: sexu` | Q_DIRECTIVE | opens with the base-form verb "put" and has no subject | `` | `-Colossians 3:5` |
| #1721 | `Keep your promise.` | Q_DIRECTIVE | opens with the base-form verb "keep" and has no subjec | `>>2310449` | `This is not a game.` |
| #1733 | `The more you know.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `Why did China suddenly` | `Q` |
| #1735 | `The choice to know will ultimately be yours.` | Q_STATEMENT_OR_CLAIM | not imperative — opens with a determiner, pronoun or c | `https://genius.com/Sla` | `These people are SICK!` |

_…and 874 more in the JSON._
