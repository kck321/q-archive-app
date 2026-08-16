# sourceSpansV2 — standalone regression results

**SHADOW MODE. NOT CERTIFIED.** `sourceLines()` is unchanged and all 15 consumers still call it.

Fixtures: **90 / 90 pass**, 0 fail.

| fixture | check | result | got | expected |
|---|---|---|---|---|
| #3 | #3 "…tweeting about removal…" is Q-authored | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `Q_AUTHORED_CURRENT_POST` |
| #3 | #3 … with sourceType Q_BODY | ✅ PASS | `Q_BODY` | `Q_BODY` |
| #3 | #3 … at HIGH confidence (not held) | ✅ PASS | `HIGH` | `HIGH` |
| #3 | #3 … and is not quoted | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `not QUOTED_OR_EMBEDDED` |
| #3 | #3 the defect being fixed is real in sourceLines() | ✅ PASS | `sourceLines marks line 2 quoted: true` | `true` |
| #10 | #10 "Remember, the FBI…" is held, not resolved | ✅ PASS | `AMBIGUOUS_MULTIPLE_MATCHES/LOW` | `AMBIGUOUS or LOW` |
| #10 | #10 "Dig!!!!!" is held, not resolved | ✅ PASS | `AMBIGUOUS_MULTIPLE_MATCHES/LOW` | `AMBIGUOUS or LOW` |
| #10 | #10 did not inherit the confident quoted ruling | ✅ PASS | `UNKNOWN` | `not a quoted subtype` |
| #146 | #146 "Pray." is Q-authored | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `Q_AUTHORED_CURRENT_POST` |
| #146 | #146 "Pray." sourceType Q_BODY | ✅ PASS | `Q_BODY` | `Q_BODY` |
| #147 | #147 reproduced "Pray." is quoted, not new | ✅ PASS | `QUOTED_OR_EMBEDDED` | `QUOTED_OR_EMBEDDED` |
| #147 | #147 … sourceType QUOTED_PRIOR_Q_POST | ✅ PASS | `QUOTED_PRIOR_Q_POST` | `QUOTED_PRIOR_Q_POST` |
| #147 | #147 … referencedPostNum 146 | ✅ PASS | `146` | `146` |
| #147 | #147 stores no Directive occurrence of its own | ✅ PASS | `0` | `0` |
| #147 | #147 "God be with us all." is Q-authored | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `Q_AUTHORED_CURRENT_POST` |
| #147 | #147 … sourceType Q_BODY | ✅ PASS | `Q_BODY` | `Q_BODY` |
| #349 | #349 "God bless, Q" now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #349 | #349 Q signature is its own span | ✅ PASS | `1 signature span(s)` | `≥1` |
| #349 | #349 sentence text excludes the signature | ✅ PASS | `"God bless,"` | `no trailing Q` |
| #353 | #353 "Godspeed, Q" now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #353 | #353 Q signature is its own span | ✅ PASS | `1 signature span(s)` | `≥1` |
| #353 | #353 sentence text excludes the signature | ✅ PASS | `"Godspeed,"` | `no trailing Q` |
| #393 | #393 "Godspeed, Q" now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #393 | #393 Q signature is its own span | ✅ PASS | `1 signature span(s)` | `≥1` |
| #393 | #393 sentence text excludes the signature | ✅ PASS | `"Godspeed,"` | `no trailing Q` |
| #394 | #394 "Godspeed, Q" now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #394 | #394 Q signature is its own span | ✅ PASS | `1 signature span(s)` | `≥1` |
| #394 | #394 sentence text excludes the signature | ✅ PASS | `"Godspeed,"` | `no trailing Q` |
| #434 | #434 "God bless, Q" now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #434 | #434 Q signature is its own span | ✅ PASS | `1 signature span(s)` | `≥1` |
| #434 | #434 sentence text excludes the signature | ✅ PASS | `"God bless,"` | `no trailing Q` |
| #767 | #767 "GOD BLESS, Q" now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #767 | #767 Q signature is its own span | ✅ PASS | `1 signature span(s)` | `≥1` |
| #767 | #767 sentence text excludes the signature | ✅ PASS | `"GOD BLESS,"` | `no trailing Q` |
| #1025 | #1025 "God bless, Q" now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #1025 | #1025 Q signature is its own span | ✅ PASS | `1 signature span(s)` | `≥1` |
| #1025 | #1025 sentence text excludes the signature | ✅ PASS | `"God bless,"` | `no trailing Q` |
| #2382 | #2382 URL-concatenated record now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #2382 | #2382 clean sentence recovered | ✅ PASS | `"Re_read drops re: Polls"` | `"Re_read drops re: Polls"` |
| #2382 | #2382 URL is a separate span | ✅ PASS | `"https://www.oge.gov/web/oge.nsf/Resources/Political+Activities https:` | `URL cut out` |
| #2382 | #2382 the URL line has its own span | ✅ PASS | `URL span present` | `present` |
| #3819 | #3819 URL-concatenated record now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #3819 | #3819 clean sentence recovered | ✅ PASS | `"Read [1]"` | `"Read [1]"` |
| #3819 | #3819 URL is a separate span | ✅ PASS | `"https://www.miamiherald.com/news/politics-government/article237959369` | `URL cut out` |
| #3819 | #3819 the URL line has its own span | ✅ PASS | `URL span present` | `present` |
| #2351 | #2351 URL-concatenated record now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #2351 | #2351 clean sentence recovered | ✅ PASS | `"DO NOT LOOK HERE [CHINA]"` | `"DO NOT LOOK HERE [CHINA]"` |
| #2351 | #2351 URL is a separate span | ✅ PASS | `"https://www.youtube.com/watch?v=aeVrMniBjSc"` | `URL cut out` |
| #2351 | #2351 the URL line has its own span | ✅ PASS | `URL span present` | `present` |
| #2378 | #2378 URL-concatenated record now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #2378 | #2378 clean sentence recovered | ✅ PASS | `"DO NOT LOOK HERE [CHINA]"` | `"DO NOT LOOK HERE [CHINA]"` |
| #2378 | #2378 URL is a separate span | ✅ PASS | `"https://www.youtube.com/watch?v=aeVrMniBjSc"` | `URL cut out` |
| #2378 | #2378 the URL line has its own span | ✅ PASS | `URL span present` | `present` |
| #4437 | #4437 every stored find(…) record is CODE_OR_TECHNICAL_TEXT | ✅ PASS | `5/5` | `5/5` |
| #4437 | #4437 the multi-line find/click_on/end record now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #4437 | #4437 nothing in it reads as the English verb "find" | ✅ PASS | `all code` | `all code` |
| #3896 | #3896 greentext+URL record now locates | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `located` |
| #3896 | #3896 Q's own ">" bullets are not quoted | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `Q_AUTHORED_CURRENT_POST` |
| #3896 | #3896 URL split off the arrow line | ✅ PASS | `">Push new/revised P_2020 > vote by mail? [unsecure]"` | `no URL` |
| #3896 | #3896 the defect being fixed is real in sourceLines() | ✅ PASS | `10 lines called greentext excerpt` | `≥8` |
| scripture | Armor of God passages carry QUOTED_SCRIPTURE spans | ✅ PASS | `12/12 posts` | `12/12` |
| #154 | #154 Lord's Prayer record now locates | ✅ PASS | `QUOTED_OR_EMBEDDED` | `located` |
| #154 | #154 … as QUOTED_PRAYER | ✅ PASS | `QUOTED_PRAYER` | `QUOTED_PRAYER` |
| #154 | #154 the prayer block is one contiguous span run | ✅ PASS | `2` | `≥1` |
| #154 | #154 Q's own line in the same post stays Q_BODY | ✅ PASS | `Q_BODY` | `Q_BODY` |
| image | image-only posts produce ATTACHED_IMAGE/SCREENSHOT spans, never Q_BODY | ✅ PASS | `199 image spans over 230 text-less posts` | `>0 and none Q-authored` |
| blessing | "God bless." is Q-authored Q_BODY | ✅ PASS | `#106 Q_AUTHORED_CURRENT_POST/Q_BODY` | `Q/Q_BODY` |
| blessing | "God bless and stay safe." locates as one Q span | ✅ PASS | `#1569 Q_AUTHORED_CURRENT_POST` | `Q_AUTHORED_CURRENT_POST` |
| ambiguous | (a) body + quoted-payload duplication resolves to the body | ✅ PASS | `#103 "Godspeed." — also in payload ×1` | `at least one` |
| ambiguous | (b) in-body mixed provenance past the occurrence index is AMBIGUOUS | ✅ PASS | `#154 AMBIGUOUS_MULTIPLE_MATCHES` | `AMBIGUOUS_MULTIPLE_MATCHES` |
| ambiguous | (b) … and never silently picks a side | ✅ PASS | `UNKNOWN` | `UNKNOWN` |
| ambiguous | the corpus still contains a scripture-block post to test against | ✅ PASS | `#1432` | `present` |
| not-located | an absent phrase is NOT_LOCATED | ✅ PASS | `NOT_LOCATED` | `NOT_LOCATED` |
| not-located | NOT_LOCATED carries sourceType UNKNOWN, never a quoted subtype | ✅ PASS | `UNKNOWN` | `UNKNOWN` |
| #51 | #51 letter is Q-authored, not quoted | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `Q_AUTHORED_CURRENT_POST` |
| #51 | #51 sourceType is Q_BODY_LETTER_VOICE | ✅ PASS | `Q_BODY_LETTER_VOICE` | `Q_BODY_LETTER_VOICE` |
| #51 | #51 the whole letter carries one register | ✅ PASS | `Q_BODY_LETTER_VOICE` | `Q_BODY_LETTER_VOICE` |
| #51 | #51 the `>>` pointer above it stays a pointer | ✅ PASS | `pointer span present` | `present` |
| #51 | #51 "God is with us." is Q-authored | ✅ PASS | `Q_AUTHORED_CURRENT_POST` | `Q_AUTHORED_CURRENT_POST` |
| #4429 | #4429 "Have faith in God." is Q_BODY, not scripture | ✅ PASS | `Q_BODY` | `Q_BODY` |
| #4429 | #4429 the pasted Ephesians block above it is still scripture | ✅ PASS | `QUOTED_SCRIPTURE` | `QUOTED_SCRIPTURE` |
| sentences | a sentence is not cut at "etc." | ✅ PASS | `1 sentences` | `1` |
| sentences | a sentence is not cut at "vs." | ✅ PASS | `1 sentences` | `1` |
| sentences | three sentences on one line are three sentences | ✅ PASS | `3` | `3` |
| sentences | every recovered sentence contains its own phrase | ✅ PASS | `0 violations over 2705 records` | `0 over 2705` |
| sentences | #121 "Laugh." shares a line but is not a fragment | ✅ PASS | `isMidSentenceFragment=false` | `false` |
| sentences | #121 "Laugh." owns its own sentence | ✅ PASS | `"Laugh."` | `"Laugh."` |
| sentences | #1252 "Learn the TRUTH." IS a mid-sentence fragment | ✅ PASS | `isMidSentenceFragment=true` | `true` |
| sentences | #1252 its full sentence is recovered | ✅ PASS | `"It’s time to learn the TRUTH."` | `"It’s time to learn the TRUTH."` |
| hygiene | sourceSpansV2 cleanText() is identical to segment.mjs clean() | ✅ PASS | `identical over 400 posts` | `identical` |
