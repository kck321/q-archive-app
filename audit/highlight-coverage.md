# Q Drops — exhaustive highlight coverage (#1–#4966)

Both directions checked, using the renderer’s own matching rule transcribed from `addSegs()` — same escaping, same smart-quote and dash folding, same word boundaries. This proves **span resolution**, not pixels: a certified occurrence whose text cannot be found in its own post can never highlight.


## Totals

| Measure | Count |
|---|---|
| Certified occurrences intended to highlight | 40,994 |
| Resolve correctly | **39,785** |
| Fail to resolve | **1,209** |
| Badge-only, no certified span (correct) | 2,186 |
| Posts affected by failures | 749 |
| Cross-post cases for review | 1,687 |

## By layer

| Layer | Intended | Resolves | Fails |
|---|---|---|---|
| entities | 7,903 | 7,176 | **727** |
| claims | 4,181 | 4,082 | **99** |
| evidence | 5,319 | 5,232 | **87** |
| checkable | 1,926 | 1,840 | **86** |
| directives | 2,422 | 2,346 | **76** |
| unresolved | 2,527 | 2,453 | **74** |
| emphasis | 5,251 | 5,229 | **22** |
| codes | 1,949 | 1,932 | **17** |
| conclusions | 966 | 951 | **15** |
| predictions | 630 | 626 | **4** |
| questions | 6,442 | 6,440 | **2** |
| themeAnchors | 1,478 | 1,478 | 0 |

## Render → certified

- Theme highlight consumes certified anchors, not the taxonomy label: **yes**
- Keyword/search highlight is structurally distinct from category colours: **yes** (`ring-1 ring-red-400/80 underline decoration-dashed decoratio`)

The renderer draws only one span without a certified record — the keyword/search match. It is allowed to exist and must not look certified.


## Failures — a sample

| Post | Layer | Text |
|---|---|---|
| #2782 | questions | [Example CA] https://calmatters.org/articles/commentary/gavin-newsoms-keeping- |
| #1208 | entities | West Hollywood |
| #1305 | entities | Lindsey Graham |
| #1538 | entities | Guardian |
| #1694 | entities | Federal Reserve |
| #1785 | claims | [Sample 3] https://www.washingtonpost.com/news/morning-mix/wp/2018/08/01/we-ar |
| #1821 | entities | House Intelligence Committee |
| #1902 | directives | Compare & contrast. |
| #1947 | entities | Ars Technica |
| #2029 | checkable | https://www.washingtontimes.com/news/2018/aug/31/more-americans-support-jeff-s |
| #2114 | entities | John Podesta |
| #2180 | entities | Lisa Page |
| #2372 | entities | Peggy Grande |
| #2513 | entities | Clintons |
| #2657 | entities | Guardian |
| #2801 | entities | The New Yorker |
| #2883 | checkable | (2) Remove Control from Gov't and provide to CA (who controls CA?) https://www |
| #2993 | entities | Hong Kong |
| #3186 | entities | Anthony Comello |
| #3415 | entities | Planned Parenthood |
| #3563 | entities | American Red Cross |
| #3654 | entities | Pearl Harbor |
| #3836 | directives | Think US AID > Ukraine |
| #3990 | entities | Papadopoulos |
| #4163 | entities | Anderson Cooper |
| #4300 | entities | The Federalist |
| #4416 | entities | Keith Ellison |
| #4529 | entities | Cornell Law |
| #4631 | entities | Donald Lukens |
| #4697 | claims | Jedidiah Fulton, 39 [https://archive.is/GWLYq] |
| #4697 | claims | Jonathan Maas, 44 [https://archive.is/Hw9JK] |
| #4750 | entities | Harvard Law School |
| #4901 | entities | Hunter Biden |
| #898 | entities | Hong Kong |
| #179 | evidence | >>150398185 |
| #4796 | evidence | >>10863556 |
| #1369 | evidence | But when a long train of abuses and usurpations, pursuing invariably the same  |
| #1711 | unresolved | Foreign Affairs |
| #3062 | unresolved | Foreign Affairs |
| #4594 | unresolved | Foreign Affairs |
