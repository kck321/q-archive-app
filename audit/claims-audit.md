# Q Drops — Claims audit (v1, candidate)

Full corpus, on the shared segmenter and overrides. Certified Questions and Directives are consulted first as exclusions. **No production write, no deploy.**


## The governing rule

**A sentence is not a claim merely because it is declarative.** Classifying by elimination — "not a question, not a directive, therefore a claim" — is the over-classification that inflated Questions and Directives, and with 29,569 units in the corpus it would do far more damage here.

So a claim must positively qualify: an assertive proposition with a subject and a **finite verb**. Everything else is excluded by name rather than by default.


## Pipeline

| Outcome | Units |
|---|---|
| LABEL_OR_FRAGMENT | 6,874 |
| CERTIFIED_QUESTION | 6,596 |
| NOT_A_CLAIM | 6,439 |
| Q_CLAIM | 3,803 |
| CERTIFIED_DIRECTIVE | 2,194 |
| EVIDENCE_REFERENCE | 1,637 |
| QUOTED_SOURCE | 956 |
| Q_PREDICTION | 705 |
| SEGMENTATION_ERROR | 289 |
| QUOTED_OR_SOURCE | 50 |
| Q_CONCLUSION | 26 |

## Candidate totals

| Measure | Value |
|---|---|
| Claim occurrences | **3,829** |
| — distinct | 2,945 |
| — posts | 1,896 |
| — checkable (attribute) | 1,758 |
| — source provided | 399 |
| Prediction occurrences | 705 |
| — of which conclusions *(attribute)* | 1,217 |
| Source-material units held out | 956 |
| Stored extractor claims (for comparison) | 7,509 |

## Sample claims

| Post | Exact text | Checkable | Source | Conf |
|---|---|---|---|---|
| #1 | `HRC extradition already in motion effective yesterday with several countries i` | yes | no | MEDIUM |
| #111 | `They never thought she would lose.` | no | no | HIGH |
| #1255 | `His sole purpose [WH visit] is to convince POTUS, on behalf of the EU, to rema` | yes | no | HIGH |
| #1318 | `If RR is dirty, Mueller must also be dirty.` | yes | no | HIGH |
| #1386 | `Today was the precursor.` | no | no | HIGH |
| #1492 | `APPOINTMENT OF A 2ND SC WOULD FAIL.` | yes | no | MEDIUM |
| #1589 | `[RR] must either comply with all document demands or face impeachment.` | yes | no | MEDIUM |
| #165 | `Problem: time to complete.` | no | no | MEDIUM |
| #1767 | `Here we go.` | no | no | HIGH |
| #1847 | `The SHARING of INFORMATION IS VERY IMPORTANT.` | yes | no | HIGH |
| #1945 | `[Fiction][Sample] https://www.nbcnews.com/think/opinion/americans-have-forgott` | yes | yes | MEDIUM |
| #2037 | `Who 'elects' CA officials?https://www.foxbusiness.com/politics/california-dmv-` | yes | yes | HIGH |
| #2135 | `"Review of the new documents raises grave concerns regarding an apparent syste` | yes | yes | MEDIUM |
| #229 | `_FREEDOM-_vSA_US_yes_DC08vC_EX_y_AW_Conf-go` | no | no | MEDIUM |
| #2373 | `https://www.wsj.com/articles/google-exposed-user-data-feared-repercussions-of-` | yes | yes | MEDIUM |
| #2436 | `We are, FATHERS.` | yes | no | HIGH |
| #2524 | `Removed from SC oversight` | yes | no | MEDIUM |
| #2626 | `"There are a lot of sealed indictments" - SC` | yes | no | MEDIUM |
| #2694 | `FISA works both ways.` | yes | no | MEDIUM |
| #2807 | `NO HONEST CONTROL IN PLACE.` | yes | no | HIGH |
| #2916 | `We are far beyond statistical analysis at this stage.` | no | no | HIGH |
| #3028 | `Impeachment requires 2/3 vote of the SENATE.` | yes | no | MEDIUM |
| #3233 | `Reflections are important.` | no | no | HIGH |
| #341 | `Presidential libraries are put in place to retain control over self-incriminat` | no | no | MEDIUM |
| #3588 | `You are witnessing the largest ‘organized’ disinformation campaign to ever be ` | no | yes | HIGH |
| #3724 | `It must be done according to the rule of law.` | no | no | HIGH |
| #3882 | `The presidency of Barack Hussein Obama began at noon EST on January 20, 2009, ` | yes | no | HIGH |
| #3969 | `We are far beyond the need for proofs.` | no | no | HIGH |
| #4161 | `Insertion removed.` | no | no | MEDIUM |
| #434 | `God is LOVE.` | yes | no | HIGH |
| #4460 | `They can no longer hide in the dark.` | no | no | HIGH |
| #4540 | `THE INSURGENCY IS REAL.` | yes | no | HIGH |
| #4602 | `The choice [of information] has always been yours.` | no | no | HIGH |
| #4697 | `Unknown [https://archive.is/wZqgM]` | no | yes | MEDIUM |
| #4833 | `Nothing is random.` | no | no | HIGH |
| #515 | `Suggest new board created.` | no | no | MEDIUM |
| #60 | `Of those (less than 10 people) only three are non-military.` | yes | no | MEDIUM |
| #732 | `https://www.washingtonpost.com/news/fact-checker/wp/2016/04/08/john-mccains-cl` | yes | yes | MEDIUM |
| #816 | `[THEY must control local police / school / county officials  / etc to work].` | yes | yes | MEDIUM |
| #91 | `The truth is mind blowing and cannot fully be exposed.` | no | no | HIGH |
