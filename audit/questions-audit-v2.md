# Q Drops — all-questions audit v2

`scripts/audit-all-questions-v2.mjs`. Audit only; no app data changed; hold in place.


## Totals

| Measure | v1 | v2 |
|---|---|---|
| Q-authored question units | 6,815 | **6,385** |
| Distinct questions | 5,564 | **5,240** |
| Posts with >=1 question | 1,836 | 1,685 (33.9%) |
| Confirmed against questions.json | 6,524 | 6,287 |
| Missed (in text, not stored) | 291 | 98 |
| Stored, present verbatim (do NOT delete) | 1,181 | 1,242 |
| Stored, NOT in Q source (removal candidates) | 144 | 144 |
| Anon/quoted questions excluded | 2,144 | 2,144 |
| Segmentation-risk units (never auto-added) | — | 13 |

## Semantic score bands

| Band | Count | Share |
|---|---|---|
| certain (>=0.85) | 2,007 | 31.4% |
| likely (0.6-0.85) | 4,202 | 65.8% |
| borderline (0.5-0.6) | 176 | 2.8% |

## Terminal punctuation

| Ends with | Count | Share |
|---|---|---|
| `?` | 6,123 | 95.9% |
| `.` | 240 | 3.8% |
| `(none)` | 17 | 0.3% |
| `:` | 4 | 0.1% |
| `!` | 1 | 0.0% |

## Subtype

| Subtype | Count |
|---|---|
| Other | 1,276 |
| Elliptical | 1,048 |
| What | 941 |
| Why | 909 |
| Yes/No | 758 |
| Who | 538 |
| How | 473 |
| Information request | 231 |
| When | 120 |
| Where | 77 |
| Which | 14 |

## Missed — in Q's text, absent from questions.json (98)

| Post | Source text (exact) | Score | Signals |
|---|---|---|---|
| #1021 | `List the estimated wealth of religious organizations.` | 0.5 | requests information |
| #1120 | `Clarify.` | 0.5 | requests information |
| #117 | `Define.` | 0.5 | requests information |
| #119 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #121 | `List.` | 0.5 | requests information |
| #121 | `Compare.` | 0.5 | requests information |
| #1286 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #1318 | `Department of Justice does not discuss ongoing investigations or confirm specific matters, What abou` | 0.6 | question mark |
| #134 | `List names, family history, investment/ownership stakes, and point-to-point contacts.` | 0.5 | requests information |
| #1377 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #1380 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #139 | `List of Republicans, in the House and Senate, who have announced they will not seek re-election:` | 0.5 | requests information |
| #142 | `Who is A.` | 0.5 | wh + auxiliary inversion |
| #142 | `What is A.` | 0.5 | wh + auxiliary inversion |
| #1423 | `Compare against 2.16.18.` | 0.5 | requests information |
| #144 | `Why was Sarah A.` | 0.5 | wh + auxiliary inversion |
| #144 | `C. attacked (hack-attempt)?` | 0.6 | question mark |
| #153 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #157 | `Define ‘controlled’ censorship.` | 0.5 | requests information |
| #165 | `Define the ‘known’ action.` | 0.5 | requests information |
| #166 | `Define the ‘known’ action.` | 0.5 | requests information |
| #1682 | `Define evidence.` | 0.5 | requests information |
| #1818 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #184 | `Identify and list.` | 0.5 | requests information |
| #1841 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #189 | `Identify symbolism (Owl / Y).` | 0.5 | requests information |
| #1915 | `POTUS?` | 0.6 | question mark |
| #192 | `Compare.` | 0.5 | requests information |
| #1935 | `Compare donors.` | 0.5 | requests information |
| #1944 | `ORIG?` | 0.6 | question mark |
| #1948 | `Why was the U.S.` | 0.5 | wh + auxiliary inversion |
| #1957 | `Compare.` | 0.5 | requests information |
| #1979 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2032 | `Reconcile against results.` | 0.5 | requests information |
| #2072 | `But… interestingly, if nothing is being done behind the scenes, why are so many FBI & DOJ senior off` | 0.6 | question mark |
| #2072 | `X?]?` | 0.6 | question mark |
| #2072 | `But… interestingly, if nothing is being done behind the scenes, why are many ‘powerful’ CEOs, member` | 0.6 | question mark |
| #2123 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2165 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2211 | `But… interestingly, if nothing is being done behind the scenes, why are so many FBI & DOJ senior off` | 0.6 | question mark |
| #2211 | `X?]?` | 0.6 | question mark |
| #2211 | `Example: Pre_POTUS did the SPEAKER OF THE HOUSE indicate wanting to leave politics?` | 0.6 | question mark |
| #2309 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #235 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #236 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2360 | `POTUS?` | 0.6 | question mark |
| #2381 | `How do you ensure 'appeals' to the U.S.` | 0.5 | wh + auxiliary inversion |
| #2462 | `POTUS?` | 0.6 | question mark |
| #2639 | `Compare & Contrast.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2646 | `RECONCILE.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2664 | `Compare & Contrast.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2682 | `Psych 101: If you hear & see something over and over again by multiple (supposedly credible) news ag` | 0.6 | question mark |
| #2740 | `Why did [LL]  [ATTORNEY GENERAL OF THE UNITED STATES] grant 'special entry' to Natalia Veselnitskaya` | 0.5 | wh + auxiliary inversion |
| #2754 | `Compare v.` | 0.5 | requests information |
| #2782 | `[Example CA] https://calmatters.org/articles/commentary/gavin-newsoms-keeping-it-all-in-the-family/a` | 0.6 | question mark |
| #2801 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2849 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #2938 | `Why was it important to use sources within the UK vs.` | 0.5 | wh + auxiliary inversion |
| #2938 | `US?` | 0.6 | question mark |
| #2971 | `"you will be asked to give proof of your identity" synonyms:	evidence, verification, corroboration, ` | 0.6 | question mark |
| #2989 | `How do you keep the project running w/o 'public' taxpayer funds? [DoD reported LifeLog was TERMINATE` | 0.5 | wh + auxiliary inversion |
| #3049 | `CENSUS?` | 0.6 | question mark |
| #311 | `Define.` | 0.5 | requests information |
| #3429 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #3453 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #3455 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #3586 | `POTUS?` | 0.6 | question mark |
| #3597 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #365 | `Unlock?` | 0.6 | question mark |
| #3909 | `Why was impeachment pushed through H fast? [did they count on R’s blocking new witnesses?]` | 0.5 | wh + auxiliary inversion |
| #3990 | `FBI CHAIN OF COMMAND FISA-RUSSIA-POTUS-FLYNN-STONE-PAPADOP-MANAF? [CIA BRIDGE_BRENNAN_INTEL ASSESS[1` | 0.6 | question mark |
| #3990 | `FBI CHAIN OF COMMAND DNC HACK? [CIA BRIDGE > UKRAINE CROWDSTRIKE_BRENNAN]?` | 0.6 | question mark |
| #3990 | `RECONCILE.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4088 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4226 | `Why did U.S.` | 0.5 | wh + auxiliary inversion |
| #4232 | `WHO WAS DIRECTING AMB.` | 0.5 | wh + auxiliary inversion |
| #4292 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4294 | `Reconcile:` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4336 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4381 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4436 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4454 | `At the same time, they gave more power to their obedient followers, like Antifa, while keeping the r` | 0.6 | question mark |
| #4476 | `Compare & Contrast` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4493 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4494 | `What happens if coordination exists with select states to deliver 'printing' and 'paper' ballot reci` | 0.7 | question mark, wh lead, no inversion |
| #4535 | `No MSDNC retraction of POTUS_RUSSIA collusion narrative [propaganda]? _why?` | 0.6 | question mark |
| #4536 | `How do you circumvent? [controlled lines of comm [propaganda]]` | 0.5 | wh + auxiliary inversion |
| #4635 | `Compare & Contrast` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4651 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #4831 | `What is the going rate for THE SPEAKER OF THE HOUSE to obstruct Congressional investigations for the` | 0.5 | wh + auxiliary inversion |
| #4891 | `Why would H.` | 0.5 | wh + auxiliary inversion |
| #4898 | `Why is the FBI's top child porn lawyer involved in the H.` | 0.5 | wh + auxiliary inversion |
| #53 | `List out all who have foundations.` | 0.5 | requests information |
| #551 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #639 | `Reconcile.` | 0.85 | requests information, asked with "?" elsewhere in the corpus |
| #70 | `What are the laws in SA v.` | 0.5 | wh + auxiliary inversion |
| #76 | `What are the laws in SA v.` | 0.5 | wh + auxiliary inversion |
| #97 | `Define.` | 0.5 | requests information |

## Method

- **First token is not a classifier.** An auxiliary or interrogative only scores with inversion (`wh + auxiliary`, or `auxiliary + subject`) — so `Have faith.`, `Will of the people.`, `Where we go one, we go ALL.` and `When you are divided, you are weak.` score below threshold.
- **The corpus arbitrates.** A unit with no `?` gains confidence when the identical text is asked WITH one elsewhere in the archive. That is Q's own usage, not a guess.
- **Three confidences.** `questionMarkPresent` (evidence), `semanticQuestionScore` (grammar + usage), `segmentationConfidence` (unit boundaries) are separate fields; a `?` no longer forces certainty.
- **Cross-line reconstruction.** An incomplete line is joined to the next (max two joins); `sourceLines` records the original span and `reconstructed` flags it.
- **Information requests are questions; action directives are not.** `Define X.` / `List X.` / `Reconcile.` score as questions; `Follow` / `Read` / `Think` / `Have faith` do not.
- Threshold: **0.5**. Everything below it is excluded, and everything not plainly certain goes to the adjudication file.
