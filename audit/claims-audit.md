# Q Drops — Claims audit (v1, candidate)

Full corpus, on the shared segmenter and overrides. Certified Questions and Directives are consulted first as exclusions. **No production write, no deploy.**


## The governing rule

**A sentence is not a claim merely because it is declarative.** Classifying by elimination — "not a question, not a directive, therefore a claim" — is the over-classification that inflated Questions and Directives, and with 29,569 units in the corpus it would do far more damage here.

So a claim must positively qualify: an assertive proposition with a subject and a **finite verb**. Everything else is excluded by name rather than by default.


## Pipeline

| Outcome | Units |
|---|---|
| LABEL_OR_FRAGMENT | 6,878 |
| CERTIFIED_QUESTION | 6,596 |
| NOT_A_CLAIM | 6,456 |
| Q_CLAIM | 3,810 |
| CERTIFIED_DIRECTIVE | 2,194 |
| EVIDENCE_REFERENCE | 1,637 |
| QUOTED_SOURCE | 927 |
| Q_PREDICTION | 705 |
| SEGMENTATION_ERROR | 290 |
| QUOTED_OR_SOURCE | 50 |
| Q_CONCLUSION | 26 |

## Candidate totals

| Measure | Value |
|---|---|
| Claim occurrences | **3,836** |
| — distinct | 2,951 |
| — posts | 1,897 |
| — checkable (attribute) | 1,765 |
| — source provided | 399 |
| Prediction occurrences | 705 |
| — of which conclusions *(attribute)* | 1,218 |
| Source-material units held out | 927 |
| Stored extractor claims (for comparison) | 7,509 |

## Sample claims

| Post | Exact text | Checkable | Source | Conf |
|---|---|---|---|---|
| #1 | `HRC extradition already in motion effective yesterday with several countries i` | yes | no | MEDIUM |
| #111 | `They never thought she would lose.` | no | no | HIGH |
| #1255 | `His sole purpose [WH visit] is to convince POTUS, on behalf of the EU, to rema` | yes | no | HIGH |
| #1318 | `If RR is dirty, Mueller must also be dirty.` | yes | no | HIGH |
| #1389 | `You have a choice.` | no | yes | HIGH |
| #1493 | `THEY MUST WIN.` | yes | no | HIGH |
| #1589 | `If he failes to comply, he gets impeached (removed).` | no | no | MEDIUM |
| #165 | `Patriots, get the word out.` | no | no | MEDIUM |
| #1769 | `You are taking back control.` | no | no | HIGH |
| #1851 | `These people are SICK!` | yes | yes | HIGH |
| #1945 | `https://www.nytimes.com/2018/07/15/opinion/trump-russia-investigation-putin.ht` | yes | yes | MEDIUM |
| #204 | `We are winning bigly.` | no | no | HIGH |
| #2136 | `http://time.com/5389848/donald-trump-impeachment-rally/ https://www.huffington` | yes | yes | MEDIUM |
| #229 | `_FREEDOM-_vSA_US_yes_DC10vC_EX_y_AW_Conf-go` | no | no | MEDIUM |
| #2378 | `ALL [INSIDE] ROADS TO CHINA ARE BEING CLOSED.` | yes | yes | HIGH |
| #2436 | `We are, SONS.` | yes | no | HIGH |
| #2525 | `These people are stupid.` | no | no | HIGH |
| #2627 | `Logical thinking always wins.` | no | no | MEDIUM |
| #2696 | `We are UNITED.` | yes | no | HIGH |
| #2807 | `WE MUST RISE.` | yes | no | HIGH |
| #293 | `Pictures unlock ‘deal' presented that was declined.` | no | no | MEDIUM |
| #3038 | `When you are awake, you are able to clearly see.` | no | no | MEDIUM |
| #3241 | `[Knowingly] disseminating FALSE information is illegal.` | yes | no | MEDIUM |
| #3411 | `Without public support – they are powerless.` | no | no | MEDIUM |
| #3590 | `When [GS] calls, D's always answer.` | yes | yes | MEDIUM |
| #3724 | `There can be no mistakes.` | no | no | HIGH |
| #3896 | `[rapid spread] https://www.theepochtimes.com/the-closing-of-21-million-cell-ph` | yes | yes | MEDIUM |
| #3981 | `TOGETHER WE WIN.` | yes | no | MEDIUM |
| #417 | `(Find Post)` | yes | no | MEDIUM |
| #4348 | `You are the news now.` | no | no | HIGH |
| #4461 | `YOU MUST SHOW THEM.` | yes | no | HIGH |
| #4541 | `These two sides, which have a Biblical nature, follow the clear separation bet` | no | no | HIGH |
| #4609 | `You have a rival.` | no | no | HIGH |
| #4697 | `Unknown [https://archive.is/0pex9] [https://archive.is/8Jli1]` | no | yes | MEDIUM |
| #4845 | `Nothing is ever truly deleted.` | no | no | HIGH |
| #520 | `IT WAS NECESSARY.` | yes | no | HIGH |
| #60 | `You can count the people who have the full picture on two hands.` | no | no | HIGH |
| #732 | `https://www.washingtonpost.com/news/fact-checker/wp/2016/04/08/john-mccains-cl` | yes | yes | MEDIUM |
| #816 | `[THEY must control local police / school / county officials  / etc to work].` | yes | yes | MEDIUM |
| #91 | `The truth is mind blowing and cannot fully be exposed.` | no | no | HIGH |
