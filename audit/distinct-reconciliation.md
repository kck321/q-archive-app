# Distinct-question count reconciliation

Occurrences and post coverage agree exactly. The two counts differ only in how "distinct" was defined.

| Measure | Value |
|---|---|
| Occurrences (Q-authored) | 6,299 |
| Posts | 1,665 |
| Distinct — audit `key()` | 5,202 |
| Distinct — `toLowerCase()` | 5,231 |
| Difference | 29 |

## The two definitions

**A — certified audit (`scripts/lib/segment.mjs` `key()`)**

```js
clean(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
```

Strips board markup and HTML entities, lowercases, then reduces every run of non-alphanumeric characters — punctuation, quote style, line breaks — to a single space. Two spellings of the same question collapse.

**B — post-deploy verification**

```js
text.toLowerCase()
```

Lowercases and nothing else. `Who is P?` and `Who is P?\n` are two different questions under B.


## The 29 extra groups

| Cause | Groups |
|---|---|
| punctuation / quote style only | 17 |
| other — inspect | 11 |

### Every group, in full

| Cause | Spellings the audit key merges | Occurrences | Posts |
|---|---|---|---|
| punctuation / quote style only | `Why?`<br>`Why???`<br>`WHY???????????` | 48 / 1 / 1 | 100, 118, 1183, 120, 1241, 1265<br>144<br>778 |
| punctuation / quote style only | `Why is Adm R so important?`<br>`Why is Adm R. so important?` | 1 / 1 | 120<br>151 |
| other — inspect | `Define protection.`<br>`Define 'Protection'.` | 1 / 1 | 1245<br>3007 |
| punctuation / quote style only | `Shall we play a game?`<br>`>Shall we play a game?` | 15 / 1 | 1292, 1443, 1991, 2017, 2697, 3019<br>520 |
| punctuation / quote style only | `Who is HUBER?`<br>`>Who is HUBER?` | 1 / 1 | 1318<br>2462 |
| other — inspect | `All For A LARP?`<br>`All for a 'LARP'?` | 3 / 1 | 1361, 2386, 2519<br>3312 |
| punctuation / quote style only | `Would you believe Hussein tried to call Kim prior to the Summit?`<br>`"Would you believe Hussein tried to call Kim prior to the Summit?` | 1 / 1 | 1465<br>3583 |
| other — inspect | `Define censorship.`<br>`Define 'Censorship'.` | 1 / 3 | 157<br>1926, 2171, 4553 |
| punctuation / quote style only | `Define evidence.`<br>`Define 'evidence'.` | 1 / 1 | 1682<br>2971 |
| punctuation / quote style only | `All for a conspiracy?`<br>`All for a 'conspiracy'?` | 4 / 1 | 1770, 1785, 2000, 2100<br>3877 |
| other — inspect | `Define 'Projection'.`<br>`DEFINE PROJECTION.` | 14 / 2 | 1862, 1926, 1935, 1944, 1945, 2171<br>2206, 3836 |
| punctuation / quote style only | `Define 'Treason'.`<br>`Define 'Treason'` | 2 / 1 | 1945, 2300<br>2523 |
| punctuation / quote style only | `Why wasn't Congress notified?`<br>`Why wasn’t Congress notified?` | 3 / 1 | 1948, 71, 77<br>39 |
| other — inspect | `Is Russian a common language to learn?`<br>`Is 'RUSSIAN' a common language to learn?` | 3 / 1 | 2004, 3514, 4098<br>3126 |
| other — inspect | `How about a nice game of chess?`<br>`>How about a nice game of CHESS?` | 5 / 1 | 2211, 350, 354, 365, 568<br>520 |
| other — inspect | `Logical Thinking > WHY?`<br>`Logical thinking, why?` | 1 / 2 | 2491<br>2657, 3507 |
| other — inspect | `Why is "The Clinton Foundation" back in the news?`<br>`Why is the 'CLINTON FOUNDATION' back in the news?` | 1 / 1 | 2560<br>2581 |
| punctuation / quote style only | `Who audits where the money 'actually' goes?`<br>`Who audits where the money actually goes?` | 1 / 2 | 2650<br>3647, 489 |
| other — inspect | `Nellie Ohr > C_A?`<br>`NELLIE OHR = C_A?` | 1 / 1 | 3006<br>3065 |
| punctuation / quote style only | `[MUELLER] sealed indictments installed [DC] prior to [RR] loss of powe`<br>`>>[MUELLER] sealed indictments installed [DC] prior to [RR] loss of >>` | 1 / 1 | 3028<br>3036 |
| punctuation / quote style only | `Sealed indictments [DC][blockade last resort] installed post SESSIONS `<br>`>>Sealed indictments [DC][blockade last resort] installed post >>SESSI` | 1 / 1 | 3028<br>3036 |
| punctuation / quote style only | `Sealed indictment count [DC] post_SESSIONS departure?`<br>`>>Sealed indictment count [DC] post_SESSIONS departure?` | 1 / 1 | 3028<br>3036 |
| punctuation / quote style only | `Sealed indictment count [DC] pre_WHITAKER assumption?`<br>`>>Sealed indictment count [DC] pre_WHITAKER assumption?` | 1 / 1 | 3028<br>3036 |
| punctuation / quote style only | `Power of BARR?`<br>`>>Power of BARR?` | 1 / 1 | 3028<br>3036 |
| punctuation / quote style only | `Can a sealed indictment be pulled post filing?`<br>`>>Can a sealed indictment be pulled post filing?` | 1 / 1 | 3028<br>3036 |
| other — inspect | `Define 'False Flag'.`<br>`Define false flag?` | 1 / 1 | 3501<br>830 |
| other — inspect | `Where is BO today?`<br>`WHERE IS BO TODAY?!?!?` | 2 / 1 | 46, 50<br>62 |
| punctuation / quote style only | `How’s Russia?`<br>`How's Russia?` | 1 / 1 | 601<br>628 |

## What the shipped app counts

`src/lib/posts.ts` groups questions with `normalizeItemKey`, which differs from the audit `key()` only by keeping `+` as a word character:

```js
text.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim()
```

Across the 76 question rows containing `+`, that distinction never separates two rows that `key()` merges. The live app therefore already reports **5,202** — identical to the certified audit. Definition B appeared only in a one-off post-deploy verification command and was never a user-visible number.


## Canonical definition

**Definition A — the shared `key()`, equivalently the app's `normalizeItemKey` — is canonical for every distinct-question statistic.**

It is the same normaliser the certified dataset, the QA gate and the highlighter agree on, so adopting it means one rule instead of two. Under B, a question Q asked twice with a line break in a different place counts as two different questions, which is wrong on the merits — the app is counting what Q asked, not how the text happened to wrap.

**Canonical distinct question count: 5,202** across 6,299 occurrences in 1,665 posts.


No reclassification follows from this. All 6,299 occurrences resolve verbatim to their posts (0 failures), and the 6,299 occurrence dataset is untouched.
