# Questions — final context pass

v2.1 and production remain **frozen**. The global scorer is untouched, no production file is written, nothing is deployed.


Decided by the response Q is soliciting, not by the first verb or the punctuation. Each of the 44 open units was read together with its surrounding lines; the run aborts if any record falls outside a stated decision group.


## Final classes

| Class | Units | Counts |
|---|---|---|
| Q_QUESTION | 88 | yes |
| Q_DIRECTIVE_WITH_EMBEDDED_QUESTION | 51 | yes — the embedded span |
| SEGMENTATION_ERROR | 4 | no — but any span trapped inside it does |
| Q_DIRECTIVE | 2 | no |
| QUOTED_SOURCE | 1 | no — not Q-authored |

## Revised totals

| Measure | Live now | Previous baseline | **Final** |
|---|---|---|---|
| Question occurrences | 6,299 | 6,397 | **6,442** |
| Distinct (canonical `key()`) | 5,202 | 5,279 | **5,302** |
| Posts containing questions | 1,665 | 1,682 | **1,696** |
| Directive-wrapped questions | 0 | 51 | **51** |

**45 occurrences added since the 6,397 baseline** — 44 resolved from NEEDS_CONTEXT and 4 recovered from inside segmentation errors.


## Every change from the 6,397 baseline

| Post | Text | From | To | Counts | Basis |
|---|---|---|---|---|---|
| #1318 | `What about the active investigation into leaks?` | SEGMENTATION_ERROR (trapped) | **Q_QUESTION (recovered span)** | yes | stranded-recovery |
| #1372 | `Fight to reinstall roadblock?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | elliptical-info-request |
| #144 | `Why was Sarah A. C. attacked (hack-attempt)?` | SEGMENTATION_ERROR (trapped) | **Q_QUESTION (recovered span)** | yes | stranded-recovery |
| #1506 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #1584 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #1646 | `DEFEND MS-13?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | rhetorical-series |
| #1646 | `DEFEND THE DESTRUCTION OF OUR BORDERS?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | rhetorical-series |
| #1660 | `20-25?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | elliptical-numeric |
| #1804 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #1876 | `Stand down orders?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | elliptical-info-request |
| #1979 | `1 = 1?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | arithmetic-judgment |
| #1979 | `1 = 0?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | arithmetic-judgment |
| #2123 | `Note the time?` | NEEDS_CONTEXT | **Q_DIRECTIVE** | no | attention-directive |
| #2123 | `Note Apple’s stock image(s)?` | NEEDS_CONTEXT | **Q_DIRECTIVE** | no | attention-directive |
| #2249 | `Use BAIT?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | answers-adjacent-question |
| #2509 | `Q post timestamp re: DECLAS prior to/post testimony?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | elliptical-info-request |
| #2510 | `Q post timestamp re: DECLAS prior to/post testimony?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | elliptical-info-request |
| #2511 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #2548 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #2682 | `Hold people accountable?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | rhetorical-series |
| #2686 | `2019?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | elliptical-numeric |
| #2746 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #2847 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #2849 | `1=1?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | arithmetic-judgment |
| #2971 | `PROOF = EVIDENCE?` | SEGMENTATION_ERROR (trapped) | **Q_QUESTION (recovered span)** | yes | stranded-recovery |
| #3254 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3417 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3418 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3560 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3581 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3588 | `1/100?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | arithmetic-judgment |
| #3708 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3750 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3751 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3759 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3819 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #3836 | `2 + 2 = 6?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | arithmetic-judgment |
| #3915 | `HOLD HOSTAGE PUBLIC AID in exchange for GREEN NEW DEAL?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | rhetorical-series |
| #3969 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #4122 | `Q: Can I obtain detailed information about a current FBI investigation that ` | NEEDS_CONTEXT | **QUOTED_SOURCE** | no | quoted-faq |
| #4343 | `2 + 2 = 5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | arithmetic-judgment |
| #4454 | `virus OR ELECTION?` | SEGMENTATION_ERROR (trapped) | **Q_QUESTION (recovered span)** | yes | stranded-recovery |
| #4591 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #4663 | `5:5?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | comms-check |
| #4774 | `Check Gmail?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | elliptical-info-request |
| #4802 | `Rally POTUS v BIDEN attendance?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | elliptical-info-request |
| #4872 | `Protect truth re: Hillary/DNC Russia collusion?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | rhetorical-series |
| #4872 | `Protect truth re: Biden/[CLAS 1-99] Ukraine collusion?` | NEEDS_CONTEXT | **Q_QUESTION** | yes | rhetorical-series |

## Decision groups


**`quoted-faq` → QUOTED_SOURCE — 1 unit, does not count**

verbatim from https://www.fbi.gov/about/faqs — the line directly above is the source URL and the line below is the "A:" answer. Copied source material, not Q-authored language.


**`attention-directive` → Q_DIRECTIVE (attention) — 2 units, does not count**

Q is telling the reader to notice the timestamps — the unit sits among bracketed markers ([0:21], [9:41], [100%]) and the directive "Reconcile.". Question punctuation does not convert an attention command into an ask.


**`comms-check` → Q_QUESTION — 20 units, counts**

radio idiom — "do you read me five-by-five?". Solicits confirmation, and in all 20 occurrences it closes a statement or link immediately before Q's signature.


**`arithmetic-judgment` → Q_QUESTION — 6 units, counts**

Q sets out facts then asks whether they reconcile ("1 = 1?" after "Reconcile."; "2 + 2 = 5?" after contradictory COVID figures). Solicits a judgment.


**`elliptical-numeric` → Q_QUESTION — 2 units, counts**

an elliptical numeric answer offered as a question — "How large is Mueller's team?" then "20-25?"; "Will action be taken by DOJ/FBI?" then "2019?". Solicits confirmation of a figure.


**`rhetorical-series` → Q_QUESTION — 6 units, counts**

an incredulous rhetorical question inside a run of "?"-terminated lines — it challenges the proposition rather than ordering the reader to carry it out ("DEFEND MS-13?" sits between "THE TRUTH IS CLEARLY VISIBLE." and "PROMOTE THE FEAR NUCLEAR WAR…?").


**`answers-adjacent-question` → Q_QUESTION — 1 unit, counts**

directly answers the line above it — "How do you catch a FISH?" / "Use BAIT?". Solicits a strategy determination, not an action.


**`elliptical-info-request` → Q_QUESTION — 6 units, counts**

an elliptical information request inside a run of "?"-terminated lines — "Off-book meetings?" / "Play dates?" / "Stand down orders?"; "Economy today?" / "Unemployment today?" / "Rally POTUS v BIDEN attendance?".


## Stranded questions recovered

The malformed unit still does not count; the question trapped inside it does. Each recovered span was verified to be a literal line in its post.

| Post | Malformed unit | Recovered span (exact line) | Already certified? |
|---|---|---|---|
| #1318 | `Department of Justice does not discuss ongoing investigation` | `What about the active investigation into leaks?` | no — counted |
| #144 | `C. attacked (hack-attempt)?` | `Why was Sarah A. C. attacked (hack-attempt)?` | no — counted |
| #2971 | `"you will be asked to give proof of your identity" synonyms:` | `PROOF = EVIDENCE?` | no — counted |
| #4454 | `At the same time, they gave more power to their obedient fol` | `virus OR ELECTION?` | no — counted |

The review expected three; there are **four**. #144 is the one it did not have: the segmenter split `Why was Sarah A. C. attacked (hack-attempt)?` on the lone initial `A.`, leaving the fragment `C. attacked (hack-attempt)?`. The whole line is the question.


## Corrections applied from the review

- **Code tokens are no longer rejected for lacking letters.** All 20 `5:5?` occurrences, the arithmetic forms and the elliptical numerics were read against their neighbours and now count. `5:5?` closes a statement or link immediately before Q's signature in every instance — it asks for confirmation.
- **`Note the time?` / `Note Apple's stock image(s)?` stay directives.** The surrounding lines are bracketed markers `[0:21]`, `[9:41]`, `[100%]` and the directive `Reconcile.`. Q is telling the reader to notice the timing; a question mark does not convert an attention command into an ask.
- **`Check Gmail?` is resolved, not held.** It is item 1 in an enumerated answer to `What did we learn this week?` directly above it, so it solicits recognition rather than instructing anyone to open a mailbox.
- **#4122 gets its own class, `QUOTED_SOURCE`.** Not Q-authored, so it is excluded from the total rather than parked as unresolved.
