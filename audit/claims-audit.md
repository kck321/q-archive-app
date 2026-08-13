# Q Drops — Claims audit (v1, candidate)

Full corpus, on the shared segmenter and overrides. Certified Questions and Directives are consulted first as exclusions. **No production write, no deploy.**


## The governing rule

**A sentence is not a claim merely because it is declarative.** Classifying by elimination — "not a question, not a directive, therefore a claim" — is the over-classification that inflated Questions and Directives, and with 29,569 units in the corpus it would do far more damage here.

So a claim must positively qualify: an assertive proposition with a subject and a **finite verb**. Everything else is excluded by name rather than by default.


## Pipeline

| Outcome | Units |
|---|---|
| LABEL_OR_FRAGMENT | 7,044 |
| CERTIFIED_QUESTION | 6,596 |
| NOT_A_CLAIM | 6,479 |
| Q_CLAIM | 4,300 |
| CERTIFIED_DIRECTIVE | 2,194 |
| EVIDENCE_REFERENCE | 1,639 |
| Q_PREDICTION | 767 |
| SEGMENTATION_ERROR | 327 |
| QUOTED_OR_SOURCE | 191 |
| Q_CONCLUSION | 32 |

## Candidate totals

| Measure | Value |
|---|---|
| Claim occurrences | **4,300** |
| — distinct | 3,325 |
| — posts | 1,974 |
| — checkable (attribute) | 2,040 |
| — source provided | 438 |
| Prediction occurrences | 767 |
| Conclusion occurrences | 32 |
| Stored extractor claims (for comparison) | 7,509 |

## Sample claims

| Post | Exact text | Checkable | Source | Conf |
|---|---|---|---|---|
| #1 | `HRC extradition already in motion effective yesterday with several countries i` | yes | no | MEDIUM |
| #1123 | `Out they go!` | no | no | MEDIUM |
| #1265 | `Future proves past.` | no | no | MEDIUM |
| #1328 | `This is NOT about fame, followers, or profiteering.` | yes | no | HIGH |
| #1432 | `With this in mind, be alert and always keep on praying for all the saints."` | no | no | MEDIUM |
| #1518 | `Shows commitment.` | no | no | MEDIUM |
| #1605 | `PS "Because of the ongoing investigation, such answers may violate the securit` | yes | no | MEDIUM |
| #17 | `Since they misjudged the influence of the MSM they are aggressively looking to` | yes | no | MEDIUM |
| #1822 | `They would rather see NK peace negotiations fail (WAR!) than see POTUS resolve` | yes | no | HIGH |
| #189 | `The ‘cult’ runs the world.` | no | no | HIGH |
| #1988 | `Hannity 8.28.18 https://www.youtube.com/watchv=d3p7aqtUSJc&feature=youtu.be` | yes | yes | MEDIUM |
| #2100 | `THE WORLD IS CHANGING.` | yes | no | HIGH |
| #224 | `The map is in front of you.` | no | no | HIGH |
| #2345 | `A phone was present.` | no | no | HIGH |
| #2424 | `It was the 'end' that sealed it.` | no | no | HIGH |
| #2468 | `Attacks occur from all directions.` | no | yes | MEDIUM |
| #2587 | `GOOG says NO PLAN TO LAUNCH…….` | yes | no | MEDIUM |
| #2673 | `FAKE NEWS control over those who do not think for themselves limits exposure o` | yes | no | HIGH |
| #2776 | `“What justification did you have to effectively expand the mandate, not report` | yes | no | MEDIUM |
| #2881 | `This attempt to remove/silence (‘FASCISM’) those who oppose their view/narrati` | yes | no | HIGH |
| #2989 | `THE LARGEST 'COLLECTIVE' SOCIAL MEDIA PLATFORM IN THE WORLD (BILLIONS LOGGED) ` | yes | no | HIGH |
| #3128 | `This is NOT a game.` | yes | no | HIGH |
| #337 | `You are safe.` | no | no | HIGH |
| #3525 | `It is now.` | no | no | HIGH |
| #3662 | `Knowledge is power.` | no | no | HIGH |
| #3837 | `BIGGER THAN YOU CAN IMAGINE.` | yes | no | MEDIUM |
| #3907 | `WE MUST UNITE AGAIN.` | yes | no | HIGH |
| #4076 | `This is about regaining POWER.` | yes | no | HIGH |
| #4278 | `Control of narrative.` | no | no | MEDIUM |
| #4397 | `Re-obtain power by any means necessary.` | no | no | MEDIUM |
| #4484 | `The stakes are high.` | no | no | HIGH |
| #4545 | `Humanity is good, but, when we let our guard down we allow darkness to infiltr` | no | no | HIGH |
| #4620 | `Your voice and your vote matters.` | no | no | HIGH |
| #4652 | `Knowing what you know now….` | no | no | MEDIUM |
| #476 | `POTUS Tweet - RR/out.` | yes | no | MEDIUM |
| #4959 | `Your vote matters.` | no | no | HIGH |
| #57 | `Abedin in letters sent to the Inspectors General of the Department of Defense,` | yes | no | MEDIUM |
| #69 | `You are the bravest men and women on earth.` | no | no | HIGH |
| #791 | `"For I know the plans I have for you,” declares the Lord, “plans to prosper yo` | no | no | MEDIUM |
| #895 | `Coded message (accept) by LdR/HRC/others.` | yes | no | MEDIUM |
