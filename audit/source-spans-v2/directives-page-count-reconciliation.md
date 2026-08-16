# Q Directives — page count reconciliation

**SHADOW MODE. NOT CERTIFIED. No count pin was changed to force agreement.**

Derived by replaying the two functions the live page actually runs — `dedupePostArrays()`
in `src/lib/localData.ts` (seed time) and `normalizeItemKey()` grouping in
`src/pages/QRequests.tsx` — against `public/data/posts.json` at seed 70.

## Mentions

| step | figure | what it is |
|---|---:|---|
| raw stored `actionRequests` entries | 2552 | the adjudication universe |
| − exact within-post duplicates | 50 | identical string stored twice in one post |
| = after exact duplicates collapse | 2502 | matches the 2,655 in the handoff |
| − normalization collisions | 4 | differ only in case or trailing punctuation |
| = **derived page mentions** | **2498** | what the page renders today |
| posts represented | 1464 | matches the 1,538 in the handoff |

**The remembered figure is 2,652. The derived figure is 2498.**

The handoff's chain assumed **two** normalization collisions (#1318 and #4963) and one
unexplained record. There are **four**, and there is no unexplained record: the two that
were never listed are #730 and #731, both `"Learn."` vs `"LEARN!!!!"`. 2,705 − 50 − 4 = 2498
exactly, with every dropped record named below. The one-record gap is in the remembered
number, not in the data.

## Normalization collision groups

| post | kept | dropped |
|---|---|---|
| #1318 | `Think LOGICALLY.` | `Think logically.` |
| #4963 | `Focus.` | `FOCUS.` |
| #730 | `Learn.` | `LEARN!!!!` |
| #731 | `Learn.` | `LEARN!!!!` |

## Phrase groups

| step | figure |
|---|---:|
| raw distinct phrases (whitespace-collapsed, lowercased) | 1705 |
| groups that fold more than one raw phrase | 53 |
| extra phrases folded away by `normalizeItemKey` | 62 |
| = **displayed phrase groups** | **1642** |

1705 − 62 = 1643. Both published figures (1,763 and 1,693) reconcile exactly.

## Page-filtered / invalid records

- posts holding `actionRequests` but excluded by the page's `hasRequests` filter: **0**
- records whose `normalizeItemKey` is empty (would render as a blank row): **0**
- rendered-but-not-stored records: **0** — the page performs no backfill and no rescan.
- stored-but-not-rendered records: **54**, all accounted for in the tables above.

## Exact duplicates dropped at seed time

| post | phrase |
|---|---|
| #1008 | `Trace background.` |
| #1008 | `Open source.` |
| #1008 | `Trace background.` |
| #1008 | `Open source.` |
| #112 | `Stay alert in main US cities (DC), sporting events, and other conservative gatherings.` |
| #1250 | `Follow the timeline.` |
| #1306 | `Define cover.` |
| #1306 | `Define cover.` |
| #1318 | `Use LOGIC.` |
| #1318 | `Use LOGIC.` |
| #1345 | `Define bribe.` |
| #1345 | `Define kickback.` |
| #157 | `Define corruption.` |
| #165 | `Expand your thinking.` |
| #166 | `Expand your thinking.` |
| #1711 | `Think logically.` |
| #1945 | `Define 'Treason'.` |
| #2123 | `Reconcile.` |
| #2123 | `Reconcile.` |
| #2123 | `Reconcile.` |
| #230 | `Test` |
| #236 | `Define proxy war.` |
| #236 | `Define proxy war.` |
| #236 | `Think.` |
| #2397 | `VOTE!` |
| #2397 | `VOTE!` |
| #2398 | `VOTE!` |
| #2398 | `VOTE!` |
| #2416 | `See Something` |
| #2418 | `VOTE!` |
| #2418 | `VOTE!` |
| #2425 | `VOTE!` |
| #2425 | `VOTE!` |
| #2425 | `VOTE!` |
| #2425 | `VOTE!` |
| #2425 | `VOTE!` |
| #2425 | `VOTE!` |
| #2425 | `VOTE!` |
| #2425 | `VOTE!` |
| #2435 | `VOTE! & MEME!` |
| #2435 | `VOTE! & MEME!` |
| #2437 | `VOTE!` |
| #2437 | `VOTE!` |
| #2501 | `List advantages.` |
| #310 | `Expand your thinking.` |
| #316 | `Expand your thinking.` |
| #3586 | `Define ‘black op’ [clandestine]` |
| #4255 | `Go.` |
| #731 | `Learn.` |
| #731 | `Learn.` |

## Groups folding more than one raw phrase

| group key | raw phrases folded |
|---|---|
| `dig` | `dig!!!!!` · `dig.` |
| `trust the plan` | `trust the plan.` · `trust the plan!` |
| `water` | `water` · `water.` |
| `enjoy the show` | `enjoy the show.` · `enjoy the show!` |
| `buckle up` | `buckle up.` · `buckle up!` |
| `think` | `think.` · `think:` · `think…….` · `think!` |
| `drain the swamp` | `drain the swamp.` · `drain the [swamp].` · `drain the swamp!` |
| `follow the family` | `follow the family.` · `>follow the family` |
| `reconcile` | `reconcile.` · `reconcile:` · `reconcile?` |
| `read` | `read.` · `read` |
| `follow the pen` | `follow the ‘pen’.` · `follow the pen.` |
| `learn` | `learn.` · `learn!` |
| `stay together` | `stay together.` · `stay together!` |
| `stay strong` | `stay strong.` · `stay strong!` |
| `keep up the good fight` | `keep up the good fight!` · `keep up the good fight.` |
| `define protection` | `define protection.` · `define 'protection'.` |
| `fight` | `fight!` · `fight` · `fight.` |
| `re read` | `re_read.` · `re-read.` |
| `fight fight fight` | `fight fight fight` · `fight, fight, fight!` · `fight, fight, fight.` · `fight fight fight.` |
| `attention on deck` | `attention on deck.` · `attention on deck!` |
| `stay united` | `stay united.` · `stay united!` |
| `use logic` | `use logic.` · `use logic` · `use logic!` |
| `think for yourself` | `think for yourself.` · `think for yourself!` |
| `ask yourself why` | `ask yourself, why?` · `ask yourself - why?` |
| `watch nyc` | `watch nyc.` · `>>>>>>>>watch nyc<<<<<<<<<` |
| `be proud` | `be proud.` · `be proud!` |
| `re read crumbs` | `re-read crumbs.` · `re_read crumbs.` |
| `trust in your president` | `trust in your president!` · `trust in your president.` |
| `define censorship` | `define censorship.` · `define 'censorship'.` |
| `stay safe` | `stay safe.` · `stay safe!` |
| `ask yourself is this normal` | `ask yourself - is this normal?` · `ask yourself, is this normal?` |
| `define evidence` | `define evidence.` · `define 'evidence'.` |
| `see something` | `see something.` · `see something` |
| `say something` | `say something.` · `say something` |
| `ask yourself a simple question why` | `ask yourself a simple question – why????` · `ask yourself a simple question —– why?` |
| `define projection` | `define 'projection'.` · `define projection.` |
| `think sigint` | `think sigint.` · `think sigint` |
| `compare contrast` | `compare & contrast.` · `compare & contrast` |
| `define treason` | `define 'treason'.` · `define 'treason'` |
| `remember your oath` | `remember your oath` · `remember your oath.` |
| `trust grassley` | `trust grassley.` · `trust grassley` |
| `prepare` | `prepare.` · `prepare` |
| `test` | `test` · `test.` |
| `ask yourself a very simple question` | `ask yourself a very simple question.` · `ask yourself a very simple question:` · `ask yourself a very simple question -` |
| `vote` | `vote!` · `vote.` |
| `imagine that` | `imagine that.` · `imagine that!` |
| `stay tuned` | `stay tuned!` · `stay tuned.` |
| `let freedom ring` | `let freedom ring!` · `let freedom ring.` |
| `ask yourself a very simple q` | `ask yourself a very simple q.` · `ask yourself a very simple q -` |
| `define false flag` | `define 'false flag'.` · `define false flag?` |
| `search crumbs 2` | `search crumbs: [#2]` · `search crumbs : [#2]` |
| `apply logic and common sense` | `apply logic and common sense:` · `apply logic and common sense.` |
| `start here` | `start here:` · `start here.` |
