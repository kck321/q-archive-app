# Q App — Development Log

All user requests and implemented solutions, maintained across sessions.
Used as reference context for future development decisions.

---

## Session 1 — Initial Build (Phase 1–2)

### Request: Scaffold the app
**Solution:** Created full Vite + React 19 + TypeScript + Tailwind CSS v3 + Firebase Firestore project.
Sidebar navigation, Dashboard, Post Archive, Post Detail, Q Questions Archive, Q School pages.
**Files:** All `src/` files, `vite.config.ts`, `tailwind.config.ts`, `firebase.ts`

### Request: Ingest all Q posts from qalerts.app
**Solution:** `fetchAndIngestPosts()` in `src/lib/ingest.ts` — fetches `posts.json`, deduplicates,
stores in Firestore `posts` collection. Dashboard "Ingest All Posts" button with progress bar.
**Files:** `src/lib/ingest.ts`, `src/pages/Dashboard.tsx`

### Request: Detect questions in every post using Claude AI
**Solution:** `detectQuestionsWithVerification()` in `src/lib/claude.ts` — splits post text into
6-line chunks, runs Claude Haiku on each, runs a verification pass, deduplicates results.
`bulkScanAllPosts()` in `src/lib/bulkScan.ts` processes all posts in batches of 3 with 8s delay.
Questions saved to Firestore `questions` collection.
**Files:** `src/lib/claude.ts`, `src/lib/bulkScan.ts`, `src/pages/Dashboard.tsx`

### Request: Green / Yellow / Red answer status classification
**Solution:** Each question gets `status: 'green' | 'yellow' | 'red' | 'unprocessed'`.
`QuestionBadge` component shows colored dot + label. Q Questions Archive filterable by status.
**Files:** `src/components/QuestionBadge.tsx`, `src/pages/QuestionsArchive.tsx`

### Request: Infograph generator (React Flow diagram per question)
**Solution:** `generateInfograph()` in claude.ts — Claude Sonnet generates A→Z JSON flowchart.
Rendered with React Flow in `/infograph/:questionId`. Export to PNG.
**Files:** `src/lib/claude.ts`, `src/pages/InfographViewer.tsx`, `src/components/InfographCanvas.tsx`

### Request: Topic clusters / Q Book chapters
**Solution:** Claude Sonnet groups posts by common entities/themes into chapters.
`/topics` page shows TOC → click a chapter → linked posts.
**Files:** `src/pages/Topics.tsx`, `src/lib/claude.ts`

---

## Session 2 — Post Analysis Feature

### Request: Deep post analysis extracting 7 categories via Claude
**Solution:** `analyzePost()` in claude.ts using Claude Haiku. Extracts: Claims, Predictions,
Named Entities, Themes, Implied Conclusions, Emotional Tone, Verification Hooks.
Results stored as `postAnalysis` on post doc + `analysisScanned: true`.
**Files:** `src/lib/claude.ts`, `src/types.ts` (added `PostAnalysis` interface, extended `QPost`)

### Request: Bulk analysis scan from Dashboard
**Solution:** `bulkScanAllAnalysis()` + `AnalysisScanProgress` in bulkScan.ts.
Violet progress bar, Stop button, integrated into "Intelligence Scan Suite" panel.
**Files:** `src/lib/bulkScan.ts`, `src/pages/Dashboard.tsx`

### Request: Post Analysis archive page (/analysis)
**Solution:** New `AnalysisArchive.tsx` — tab strip (All | Claims | Predictions | Named Entities |
Themes | Implied Conclusions | Verification Hooks | Overlaps), frequency-ranked items,
post number chips linking to `/post/:num`, search bar, totals per category.
**Files:** `src/pages/AnalysisArchive.tsx`, `src/components/Sidebar.tsx`, `src/App.tsx`

### Request: Highlight analysis categories in post body (PostDetail)
**Solution:** Extended `renderPostBody` in PostDetail with new segment kinds:
`namedEntity` (cyan), `claim` (amber), `prediction` (violet), `impliedConclusion` (orange),
`verificationHook` (rose). Priority order: highlight > request > topic > question > namedEntity >
claim > prediction > impliedConclusion > verificationHook.
**Files:** `src/pages/PostDetail.tsx`

### Request: "Analyzed" badge on PostCard
**Solution:** Small violet `🔬 Analyzed` badge in PostCard header when `post.analysisScanned === true`.
**Files:** `src/components/PostCard.tsx`

---

## Session 3 — Overlaps, Confirmations, Flash Effects, Colors

### Request: Confirm a Post Analysis item as definitive — clear it from other categories
**Solution:** `handleConfirmItem()` in AnalysisArchive — saves to `analysisConfirmed` Firestore
collection, calls `clearAnalysisCategoriesFromPosts()` to `arrayRemove` text from other category
arrays on affected post docs, removes from local `items` and `overlaps` state.
`clearAnalysisCategoriesFromPosts()` added to posts.ts — batches Firestore updates by doc ID.
**Files:** `src/pages/AnalysisArchive.tsx`, `src/lib/posts.ts`

### Request: Remove confirmed items from Overlaps tab (stop showing them)
**Solution:** `filteredOverlaps` now filters out items where `confirmedMap.has(overlapConfirmKey())`.
Confirmed overlaps no longer reappear on reload.
**Files:** `src/pages/AnalysisArchive.tsx`

### Request: Auto-confirm overlapping phrases ending with "?" as "question" category
**Solution:** In overlaps-loading `useEffect`, any unconfirmed overlap where
`text.trim().endsWith('?') && categories.includes('question')` is auto-confirmed via
`saveAnalysisConfirmed()` as a question on load.
**Files:** `src/pages/AnalysisArchive.tsx`

### Request: Requests ending with "?" should flash between green (request) and blue (question)
**Solution:** Added `requestQuestion` segment kind to PostCard and PostDetail. When a request
text ends with `?`, it gets `animate-req-question` CSS class instead of plain green highlight.
Animation: 2s ease-in-out infinite, alternates between green-400/40 and blue-400/40.
**Files:** `src/index.css` (added keyframes + class), `src/components/PostCard.tsx`,
`src/pages/PostDetail.tsx`

### Request: Flash the post body white when navigating to a post from a link
**Solution:** Added `?flash=1` URL param to ALL post links across the app. PostDetail reads
`cardFlash` param — on mount sets `bodyFlash: true`, applies `animate-body-flash` class to `<pre>`,
clears after 1800ms. Added `@keyframes body-flash` to index.css.
**Files:** `src/index.css`, `src/pages/PostDetail.tsx`, `src/pages/AnalysisArchive.tsx`,
`src/pages/QRequests.tsx`, `src/pages/Dashboard.tsx`, `src/pages/PostArchive.tsx`,
`src/pages/QPostPics.tsx`, `src/pages/QLinks.tsx`, `src/pages/InfographViewer.tsx`,
`src/pages/Topics.tsx`

### Request: Rename "Questions Detected" to "Detected" and color each item to match post body
**Solution:** Heading changed to "Detected". Each detected question computes `highlightClass`:
if text is in `actionRequests` AND ends with `?` → `animate-req-question`; if just request
→ `bg-green-500/35 text-green-200`; otherwise → `bg-blue-500/30 text-blue-200`.
`QuestionBadge` accepts `highlightClass` prop and wraps text in `<mark>` when provided.
**Files:** `src/pages/PostDetail.tsx`, `src/components/QuestionBadge.tsx`

---

## Session 4 — Dashboard Expansion + Analysis Sidebar Links

### Request: Dashboard — show all detected category counts as stat cards
**Solution:** `analysisTotals` derived via `useMemo` from timeline data (no extra Firestore call).
Added second stat cards row (7 cards): Requests / Claims / Predictions / Named Entities / Themes /
Impl. Conclusions / Verif. Hooks — each with category color.
**Files:** `src/pages/Dashboard.tsx`

### Request: Dashboard timeline chart — colored bars for each analysis category + hover tooltip
**Solution:** Extended `getQuestionsTimeline()` to accumulate per-month counts for all 6 analysis
categories. Updated `TimelineEntry` interface. Added `CATEGORY_COLORS` map. Added 6 stacked bars
(stackId="analysis") to BarChart: claims/amber, predictions/violet, namedEntities/cyan,
themes/indigo, impliedConclusions/orange, verificationHooks/rose.
Updated `ChartTooltip` to show colored dot `●` per category, filters out zero-value rows.
**Files:** `src/lib/posts.ts` (getQuestionsTimeline), `src/pages/Dashboard.tsx`

### Request: Analysis scan should also detect questions (run both scans together)
**Solution:** Updated `bulkScanAllAnalysis()` in bulkScan.ts — now filters posts missing EITHER
`analysisScanned` OR `questionsScanned`. For each post: runs `analyzePost` if not analysis-scanned,
AND `detectQuestionsWithVerification` if not question-scanned, saves both in the same batch.
`AnalysisScanProgress` now includes `questionsFound`. Progress label shows question count.
**Files:** `src/lib/bulkScan.ts`, `src/pages/Dashboard.tsx`

### Request: Add individual sidebar links for each analysis category (Q Claims, Q Entities, etc.)
**Solution:** Sidebar restructured — `Post Analysis` link now has 6 indented sub-links beneath it:
Q Claims (amber), Q Predictions (violet), Q Entities (cyan), Q Themes (indigo),
Q Conclusions (orange), Q Hooks (rose). Each links to `/analysis?tab=<category>`.
Active sub-link shows colored dot + text color. Uses `useLocation` to detect active tab.
`AnalysisArchive.tsx` updated to read `?tab=` search param on init via `useSearchParams`.
**Files:** `src/components/Sidebar.tsx`, `src/pages/AnalysisArchive.tsx`

### Request: Sidebar — add individual links for each analysis category (Q Claims, Q Entities, etc.)
**Solution:** Sidebar restructured. `Post Analysis` has 6 indented sub-links: Q Claims (amber),
Q Predictions (violet), Q Entities (cyan), Q Themes (indigo), Q Conclusions (orange), Q Hooks (rose).
Each links to `/analysis?tab=<category>`. Sidebar reads `?tab=` param via `useLocation`.
`AnalysisArchive` reads `?tab=` via `useSearchParams` to pre-select the tab on load.
**Files:** `src/components/Sidebar.tsx`, `src/pages/AnalysisArchive.tsx`

### Request: Clicking post # chip from analysis item opens post with that text highlighted in category color
**Solution:**
- `AnalysisArchive` post number chips updated from `?flash=1` to `?flash=1&highlight=<encodedText>&cat=<category>`
  (e.g. clicking #258 from a claim links to `/post/258?flash=1&highlight=Future+proves+past&cat=claims`)
- `PostDetail` reads new `?cat=` search param (`highlightCat`)
- Added `CAT_HL_COLORS` map in PostDetail: claims→amber/60, predictions→violet/60, entities→cyan/60,
  themes→indigo/60, conclusions→orange/60, hooks→rose/60
- `renderPostBody` updated with `highlightCat?` param — when set, the `highlight` segment uses the
  category color class instead of generic green. With `flash=1`, `animate-flash` is appended so text
  pulses white then settles to the category color (no `forwards` fill-mode, falls back to CSS class).
- Overlap section post chips also pass `?highlight=<text>` (no cat since overlaps span multiple categories)
**Files:** `src/pages/AnalysisArchive.tsx`, `src/pages/PostDetail.tsx`

### Request: Q Requests page — All tab + Repeated tab (frequency ordered)
**Solution:** Rewrote `QRequests.tsx` with two tabs:
- **All** — existing grouped-by-post view, ordered by postNum, with search filtering request text
- **Repeated (×2+)** — frequency view: normalizes all request texts (lowercase/trim/strip punctuation),
  groups by normalized key, filters count >= 2, sorts by count desc. Each entry shows `×N` count badge,
  the request text, and post number chips linking to `/post/:num?flash=1` (max 20 shown + "+N more").
  Same `useMemo` + `normalize()` pattern as `QuestionFrequency`.
- Shared search bar filters active tab.
- Header shows total requests, post count, and repeated phrase count.
**Files:** `src/pages/QRequests.tsx`

### Request: Fix sidebar category sub-links not switching tabs when already on the page
**Solution:** `AnalysisArchive` had `activeTab` in `useState` with a lazy initializer — only ran on
mount, so navigating between `/analysis?tab=X` links while already on the page did nothing.
Fixed by adding `useEffect` that watches `searchParams` and calls `setActiveTab` whenever the URL
tab param changes. `QuestionsArchive` was not affected (uses `statusFilter` derived directly from
`searchParams` on every render).
**Files:** `src/pages/AnalysisArchive.tsx`

### Request: Sidebar links flash white when clicked (same 1.8s fade as post body flash)
**Solution:** Added `flashKey` state + `flash(key)` callback to Sidebar. Each NavLink gets
`onClick={() => flash(uniqueKey)}` and `animate-nav-flash` class when `flashKey` matches.
The `flash()` helper resets the key first (via double rAF to restart CSS animation), then clears
after 1800ms. Added `@keyframes nav-flash` + `.animate-nav-flash` to `index.css` (white 0.22
opacity fading to transparent over 1.8s ease-out forwards — same duration as body-flash).
**Files:** `src/components/Sidebar.tsx`, `src/index.css`

### Request: Dashboard stat cards clickable + all items accessible from sidebar
**Solution:**
- `StatCard` updated with optional `to?: string` prop — wraps in `<Link>` with hover border when provided
- All stat cards wired to routes: Posts→`/posts`, Questions→`/questions`, Answered→`/questions?status=green`,
  Partial→`/questions?status=yellow`, Unanswered→`/questions?status=red`, Requests→`/requests`,
  Claims/Predictions/Entities/Themes/Conclusions/Hooks → `/analysis?tab=<category>`
- Sidebar: Q Questions now has 3 status sub-links (Answered/green, Partial/yellow, Unanswered/red)
  linking to `/questions?status=<status>`. Uses `activeStatus = searchParams.get('status')` for active state.
- QuestionsArchive: added `useSearchParams`, `statusFilter` state, `STATUS_LABELS` config, status filter
  chips in toolbar, `applyFilters` checks `topStatus === statusFilter`
- `QuestionFrequency` extended with `topStatus: AnswerStatus` (best status in the group).
  `getQuestionFrequency()` tracks `topStatus` using `STATUS_RANK: green=3 > yellow=2 > red=1 > unprocessed=0`
**Files:** `src/pages/Dashboard.tsx`, `src/components/Sidebar.tsx`, `src/pages/QuestionsArchive.tsx`,
`src/lib/posts.ts`

---

## Session 5 — Link Rendering + Q School Fix

### Request: Clickable links throughout the app (noticed in Q Clusters)
**Solution:** `PostCard` already rendered URLs as clickable `<a>` tags + `LinkPreview` cards below.
`PostDetail.tsx` `renderPostBody` was missing URL support — added `'url'` Kind, URL segment detection
(`/https?:\/\/[^\s<>'")\]]+/g`), lowest priority (9), renders as `<a target="_blank">` blue underline.
Also fixed highlight scroll: now scrolls to `[data-hl="1"]` mark in post body (not just questions list).
**Files:** `src/pages/PostDetail.tsx`

### Request: Q School returning unhelpful answers (asked about Iran, got nothing)
**Root cause:** `limit(500)` only fetched posts #1–500; `.slice(0, 20)` only sent 20 to Claude.
Iran posts are scattered across all 4,966 posts.
**Solution:** Removed `limit(500)` — fetches all posts. Relevance scored by keyword occurrence count,
sorted highest first. Sends top 50 to Claude. Added stop words. `askQSchool` in claude.ts: removed
`.slice(0, 20)`, `max_tokens` 2048 → 4096, improved prompt for thorough analysis with direct quotes.
Added status display: "Found X matching posts — sending top Y to Claude…"
**Files:** `src/pages/QSchool.tsx`, `src/lib/claude.ts`

---

## Session 6 — Constant Category Flash Animations + QRequests Highlight Links

### Request: Analysis highlight flash — want constant white ↔ category color (not one-shot)
**Root cause:** CSS `animation` fully overrides static Tailwind `background-color`. The generic
`animate-flash` at 50% used `rgba(255,255,255,0.08)` (near-transparent), so amber never appeared —
the `bg-amber-500/60` Tailwind class was completely replaced by the keyframe value.
**Solution:** Created 6 per-category infinite keyframe animations that explicitly hardcode each
category's color at 50%: `flash-claims` (amber), `flash-predictions` (violet), `flash-entities` (cyan),
`flash-themes` (indigo), `flash-conclusions` (orange), `flash-hooks` (rose). Also updated generic
`text-flash` to pulse white ↔ blue (for questions/requests). Flash state kept permanently `true`
when `cardFlash=true` (constant pulsing), cleared after 1800ms otherwise.
Added `CAT_FLASH_ANIM` map in PostDetail. Body flash suppressed when `highlightCat` is set.
**Files:** `src/index.css`, `src/pages/PostDetail.tsx`

### Request: Uniform highlight flash from QRequests Repeated tab chips
**Solution:** Updated QRequests.tsx Repeated tab post number chips from `?flash=1` to
`?flash=1&highlight=${encodeURIComponent(item.text)}` so clicking a post chip opens that post
with the specific repeated request text flashing white ↔ green.
**Files:** `src/pages/QRequests.tsx`

---

## Session 7 — Three New Zero-Cost Highlight Scanners

### Request: Highlight bracket codes, mil-intel terms, and Q signature phrases
**Gap identified:** Post content had unhighlighted bracket codes ([RR], [[name]]), military/intel
acronyms (POTUS, DECLAS, FISA), and Q's recurring signature phrases (Future proves past, WWG1WGA).
**Solution:** Three pure regex/static keyword scanners — no Claude API calls, runs instantly:
- **Bracket Code** (`bracketCode`): regex `/\[\[?[A-Z0-9][A-Z0-9 _\-]{0,30}\]?\]/g` → lime green
- **Mil-Intel Glossary** (`milIntel`): 35-term static list (POTUS, FISA, DECLAS, GITMO, etc.) → sky blue
- **Q Signatures** (`qSignature`): 34-phrase static list (Future proves past, Trust the plan, etc.) → purple italic
Priority order: bracketCode(9) > milIntel(10) > qSignature(11) > url(12)
**Files:** `src/pages/PostDetail.tsx`, `src/components/PostCard.tsx`

---

## Architecture Reference

### Tech Stack
| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Backend/DB | Firebase Firestore |
| AI | Claude API (Haiku for bulk, Sonnet for infographs) |
| Diagrams | React Flow |
| Charts | Recharts |
| Routing | React Router v6 |

### Firebase Collections
| Collection | Purpose |
|---|---|
| `posts` | All 4,966 posts with metadata, `questionsDetected[]`, `postAnalysis`, `actionRequests[]` |
| `questions` | Extracted questions: `postId`, `text`, `status` (green/yellow/red/unprocessed) |
| `infographs` | Claude-generated JSON flowchart data per question |
| `topics` | Topic clusters with linked `postIds[]` and chapter name |
| `resources` | External links (Epstein, WikiLeaks, QUID, Q Videos, Podcasts) |
| `analysisConfirmed` | User-confirmed category assignments for analysis phrases |

### Key Highlight Colors (post body segments)
| Segment | Color |
|---|---|
| questions | `bg-blue-500/30 text-blue-200` |
| requests | `bg-green-500/35 text-green-200` |
| request+question | `animate-req-question` (flashes green ↔ blue) |
| namedEntity | `bg-cyan-500/30 text-cyan-200` |
| claim | `bg-amber-500/30 text-amber-200` |
| prediction | `bg-violet-500/30 text-violet-200` |
| impliedConclusion | `bg-orange-500/30 text-orange-200` |
| verificationHook | `bg-rose-500/30 text-rose-200` |

### Analysis Category Colors (consistent across app)
| Category | Color |
|---|---|
| Claims | amber (`#f59e0b`) |
| Predictions | violet (`#8b5cf6`) |
| Named Entities | cyan (`#06b6d4`) |
| Themes | indigo (`#6366f1`) |
| Implied Conclusions | orange (`#f97316`) |
| Verification Hooks | rose (`#f43f5e`) |
| Requests | green (`#22c55e`) |
| Questions | blue (`#3b82f6`) |

### Scan Batch Config (bulkScan.ts)
- `BATCH_SIZE = 3` posts per batch
- `BATCH_DELAY_MS = 8000` (8 seconds between batches)
- `withRetry` — up to 4 retries, 15s wait on 429 rate-limit errors

---

## Session — Q [Brackets] Chart + Post Archive Improvements

### Request: Add a chart to Q [Brackets] page
**Solution**: Added Recharts `BarChart` to `QBrackets.tsx` showing Posts (grey `#9ca3af`) + Bracket Hits (blood red `#991b1b`) per month. Clicking a bar filters the bracket list to only show codes appearing in that month. Custom colored Legend (no black boxes). Clear month filter button. `timeline` computed via `useMemo` from existing `posts` state — no extra Firestore queries needed.

### Request: Post Archive — same chart as Dashboard + post order flip
**Solution**:
- Fixed Legend in `PostArchive.tsx`: replaced `<Legend wrapperStyle=...>` with custom `content` renderer showing correct grey/blue/green colored boxes for Posts/Questions/Requests.
- Added sort direction toggle buttons to sticky header: `#1 → #4966` (oldest first) and `#4966 → #1` (newest first).
- Updated `getPosts` in `posts.ts` to accept `direction: 'asc' | 'desc'` parameter, passed through from PostArchive state.
- `useEffect` now depends on `[filter, sortDir]` so changing direction triggers a fresh load.

---

## Session — Chart UX, Stats in Post Archive, Q Classification + 8kun Threads + Q Tripcodes Page

### Request: Clear button in Post Archive chart — move right, span full height, flash white, add "off Chart"
**Solution:**
- Moved clear button to a right-side sibling of the title+subtitle block, with `self-stretch` to match both lines height
- Button text: `✕ Clear "{chartSearch}" off Chart`
- Added `@keyframes btn-flash-white` + `.animate-btn-flash` to `index.css` — 1.2s ease-in-out infinite, pulses gray ↔ white ↔ gray
- Button uses `animate-btn-flash hover:animate-none` so hovering stops the flash
**Files:** `src/pages/PostArchive.tsx`, `src/index.css`

### Request: Chart tab buttons cancel keyword search when clicked
**Solution:** Each tab button (All / Q Questions / Q Requests / etc.) got `onClick` handler that calls `setChartMatchMonths(null); setChartSearch(''); setSelectedMonth(null)` to clear any active keyword search when switching tabs.
**Files:** `src/pages/PostArchive.tsx`

### Request: Same Dashboard stat cards shown below the Post Archive chart
**Solution:**
- Added `getStats` import + `stats` state + fetch in `useEffect` alongside timeline
- Added `analysisTotals` via `useMemo` from timeline data (same as Dashboard)
- Added `answeredPct` for Overall Understanding bar
- Added `StatCard` component (copy from Dashboard)
- Stats grid + Understanding bar rendered below chart panel
**Files:** `src/pages/PostArchive.tsx`

### Request: Q Questions classification — show live Answered/Partial/Unanswered/Same-post counts while scanning
**Solution:**
- `ClassifyProgress` interface updated: replaced `updated` field with `greenFound`, `yellowFound`, `redFound`, `samePostFound`
- `bulkClassifyQuestions` in `bulkScan.ts` now increments live counters per result as it processes
- Dashboard classify panel shows live colored counts: ✅ Answered (green), 🟡 Partial (yellow), ❌ Unanswered (red), 🔄 Same-post (gray)
- Added `answeredInSamePost?: boolean` to `QQuestion` type; classification prompt detects same-post answers
- Updated `ClassifyResult` in `claude.ts` to return `{ status, samePost }` and stores `answeredInSamePost` in Firestore
**Files:** `src/types.ts`, `src/lib/claude.ts`, `src/lib/bulkScan.ts`, `src/pages/Dashboard.tsx`

### Request: Fix 5000 question limit (10,191 questions exist)
**Solution:** Replaced `limit(5000)` Firestore query with full pagination loop using `startAfter` + `QueryDocumentSnapshot`, page size 1000, `while(true)` loop breaks when page returns < 1000 docs. Added `Query` and `QuerySnapshot` type imports to resolve TypeScript circular inference.
**Files:** `src/lib/bulkScan.ts`

### Request: 8kun thread reply scan — scan all Q posts with 8kun links, find anon replies answering Q's questions
**Solution:**
- New `src/lib/eightkunApi.ts`: `stripHtml()`, `Q_TRIPCODES` Set, `parseEightkunLink()`, `proxyFetch()` (tries direct → allorigins.win → corsproxy.io), `fetchThreadReplies()`
- `findAnswersInThread(questions, replies)` added to `claude.ts` — Claude Haiku analyzes anon replies against Q's questions
- `ThreadScanProgress` interface + `bulkScanThreadAnswers()` added to `bulkScan.ts`
- Dashboard: "🔗 Scan 8kun Thread Replies for Answers" orange panel with progress
- `PostDetail.tsx`: "🔗 8kun Thread Replies" panel at bottom showing `threadScanned` posts with answer cards
- `ThreadAnswer` interface + `threadReplyCount`, `threadAnswers`, `threadScanned` added to `QPost` type
**Files:** `src/lib/eightkunApi.ts` (new), `src/lib/claude.ts`, `src/lib/bulkScan.ts`, `src/types.ts`, `src/pages/Dashboard.tsx`, `src/pages/PostDetail.tsx`

### Request: Q Tripcodes page — full timeline of all Q tripcodes with dates, platform, days, post counts
**Solution:** New `src/pages/QTripcodes.tsx`:
- Hardcoded `TIMELINE` array with 10 entries (rows 5 and 7 both use `!!mG7VJxZNCI` for two separate periods)
- Loads all 4,966 posts in one Firestore query, counts per tripcode in a single pass
- Stat cards: Total Archive Posts, Tripcode-Signed, No Tripcode (anon drops), Unknown Tripcodes
- Timeline table with duration bars (colored by platform: 4chan=green, 8chan=blue, 8kun=orange)
- Click a row → expands posts for that tripcode
- Added `{ to: '/tripcodes', label: 'Q Tripcodes', icon: '🔐' }` to Sidebar `bottomLinks`
- Added route `/tripcodes` in App.tsx
**Files:** `src/pages/QTripcodes.tsx` (new), `src/components/Sidebar.tsx`, `src/App.tsx`

### Request: Fix tripcode count discrepancy (4,284 shown vs 4,966 total) + show unknown tripcodes and posts without known tripcodes
**Solution:**
- Gap explanation: 4,966 − 4,284 known-tripcode posts = 682 posts split between no-tripcode (early anon drops) and unknown tripcodes (518 unique non-Q values)
- Added `unknownTrips` (Record<string,number>), `unknownPosts` (all posts with non-known trips), `noTripPosts` state
- "No Tripcode" stat card (clickable) → expands posts with no tripcode
- "Unknown Tripcodes" stat card (clickable) → expands sorted panel showing all 518 unique unknown tripcodes with counts and "View posts" button per tripcode
- "Show all N posts without a known Q tripcode" combined button → shows union of no-trip + unknown-trip posts
- Unknown tripcodes explanation: may be slight formatting variants, other users, or boards where non-Q posters used tripcodes
**Files:** `src/pages/QTripcodes.tsx`

---

## Session 8 — 8kun CORS Fix

### Request: 179 threads unreachable (CORS/network) — Q replies in those threads were being missed
**Root cause:** `proxyFetch` in `eightkunApi.ts` tried external proxy services (allorigins.win, corsproxy.io) which are unreliable/rate-limited. Browser CORS blocks direct fetch.
**Solution:** Added `/8kun-proxy` and `/4cdn-proxy` entries to `vite.config.ts` (same pattern as existing qalerts/4plebs proxies). Updated `proxyFetch` to first try Vite proxy path (Node.js server-side, no CORS), falling back to external proxies only if needed. Requires dev server restart to pick up config change.
**Files:** `vite.config.ts`, `src/lib/eightkunApi.ts`

---

## Session 9 — Entity/Item Reader Feed

### Request: From Q Entities, clicking a repeated entity's post chip (e.g. "Clinton" #666) should open a reader showing that post fully, then let the user scroll up/down through every other post pertaining to that entity, in chronological (post-number) order — including touch/finger scrolling
**Solution:** Added a "reader feed" to `PostDetail`. When the page is opened from a list chip (URL carries `highlight` + a reader mode), it loads every post tied to that item and renders them as **full post bodies** in one scrollable container, in post-number order, with the entity term highlighted cyan throughout.
- New module helpers in `PostDetail.tsx`: `highlightEntity(text, term)` (lightweight full-text cyan highlighter, reuses `escapeAndNormalize`), plus `ANALYSIS_CAT_LABEL` / `ANALYSIS_CAT_BADGE` maps for the header chip.
- Feed **leads the page** (rendered right after the nav bar, before the post-detail card) so clicking a chip lands the user straight in the reader. The clicked post auto-scrolls to the top of the feed (`feedRef` + `currentCardRef`, scroll math via `getBoundingClientRect`), ringed cyan and marked `● current`; others tagged `↑ earlier` / `↓ later`.
- Touch support: feed container uses `overflow-y-auto overscroll-contain` + `style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}` so finger-drag rolls posts up/down with momentum.
- Each post header shows `#num` (a Link that re-opens that post standalone, preserving reader context) + date + position marker.

### Request: Add the same reader to Q Questions and every other section where it makes sense
**Solution:** Generalized the reader in `PostDetail` to multiple "reader kinds" via a `rk` URL param (alongside the existing analysis `cat` param). `readerActive` / `readerKey` / `readerQuery` / `readerVerb` drive the trigger, badge/label, in-feed link continuity, and header wording.
- **Sibling-post resolution by kind:**
  - analysis category (`cat=…`, no `rk`) → `getAnalysisFrequency` (curated AI-tagged set — keeps the exact "47 Clinton posts" count)
  - `rk=question` → `getQuestionFrequency` (posts asking the same question)
  - `rk=request|bracket|overlap|term` → `searchAllPosts(highlight)` (full-text substring across all posts)
- **Wired source chips** to pass the right `rk`: `QuestionsArchive.tsx` (×2 — QuestionCard + sync-group variants, `rk=question`), `QRequests.tsx` (`rk=request`), `QBrackets.tsx` (`rk=bracket`), `AnalysisArchive.tsx` Overlaps tab (`rk=overlap`), `QUncategorized.tsx` (`rk=term`). The six analysis tabs (Claims/Predictions/Entities/Themes/Conclusions/Hooks) already passed `cat` and needed no change.
- Per-kind label + badge colors added to `ANALYSIS_CAT_LABEL`/`ANALYSIS_CAT_BADGE` (question=blue, request=green, bracket=red, overlap=yellow, term=gray).
- Sections intentionally skipped (no repeated-item model): Dashboard, Post Archive, Q Tripcodes, Q Clusters, Q Post Pics, Storyline, Infographs, All Q Links, Resources, Q School.
**Files:** `src/pages/PostDetail.tsx` (reader feed + generalization), `src/pages/QuestionsArchive.tsx`, `src/pages/QRequests.tsx`, `src/pages/QBrackets.tsx`, `src/pages/AnalysisArchive.tsx`, `src/pages/QUncategorized.tsx`

**Note:** `npm run build` (full `tsc`) still fails on pre-existing type errors in other files (Dashboard, PostArchive, QBrackets, QuestionsArchive, QRequests — mostly recharts `MouseHandlerDataParam`/`activePayload` typings and unused-var warnings). These predate this work and don't affect the Vite dev server. The reader feature itself compiles clean.

### Request: In reader mode show ONLY the full-post reader — hide the old single-post card + "Detected" questions list (disliked style); make every reader section behave like Entities
**Solution:** Restructured `PostDetail`'s render so reader mode is a focused layout. Extracted the nav bar into a `navBar` const and the reader feed into a `readerPanel` const (defined once, before the returns). Added an **early return** when `readerActive`: renders `{navBar}{readerPanel}` only — the standard post-header card, Post Analysis panel, Requests, "Detected" questions list, and Thread Replies are skipped entirely. Opening a post directly (Post Archive / prev-next, no `rk`/`cat`) still shows the full analysis layout.
- Also made the reader panel always render in reader mode (condition simplified to `readerActive &&`), with the inner loading state keyed on `relatedLoading || !relatedPosts`, so there's no blank flash before the frequency index loads.
- Implementation note: first attempted wrapping the lower blocks in a `{!readerActive && (<>…</>)}` fragment but that spans ~600 lines and broke JSX balance (babel "Expected corresponding JSX closing tag for <>"); the const-extraction + early-return approach is cleaner and isolates the change.
**Files:** `src/pages/PostDetail.tsx`

---

## Session 10 — Offline / Desktop (Tauri) migration

Goal: convert the web+Firestore app into a fast, offline, downloadable **Tauri** desktop app. The whole archive is tiny (~8 MB), so the strategy is to load it entirely into memory and serve all reads locally — instant navigation, $0 to run, works offline. Phased so the app keeps working throughout.

### Phase 1 — Export Firestore → local bundle
**Solution:** `scripts/export-firestore.mjs` reads Firebase config from `.env`, connects to the same named DB (`getFirestore(app, 'default')`), and dumps all six collections to `public/data/*.json` plus a `manifest.json` with counts + byte sizes. Run with `node scripts/export-firestore.mjs`.
**Measured sizes:** posts 4,966 (6.24 MB) · questions 10,169 (1.78 MB) · topics 100 · resources 0 · analysisConfirmed 286 · infographs 0 → **total ~8.09 MB** (≈2 MB gzipped). Confirms the entire dataset fits trivially in RAM.
**Note:** post doc IDs === stringified `postNum`; questions reference posts via `postId` = that same id.

### Phase 2 — In-memory data layer
**Solution:** New `src/lib/localData.ts` — `loadLocalData()` fetches `public/data/*.json` once (cached promise), sorts posts by `postNum`, builds `postsById` / `postsByNum` indexes, returns a typed `LocalStore`. Rewrote **all read functions** in `src/lib/posts.ts` to serve from this store instead of Firestore: `searchAllPosts`, `getPost`, `getTopRatedPosts`, `getRecentPosts`, `getQuestionsForPost(s)`, `getQuestionFrequency`, `getQuestionsTimeline`, `getPostNumsByMonth`, `getAllPosts`, `getAllPostsWith{Media,Links}`, `getTopics`, `getTopic`, `getResources`, `getAnalysisFrequency`, `getOverlappingItems`, `getPostsByNums`, `getStats`, `loadAnalysisConfirmed`. This eliminates the ~25k Firestore reads/visit that made section navigation slow — those aggregations are now instant in-memory.
**Still on Firestore (intentional, for now):** all **writes** (confirm/clear analysis, add question, topic tagging, scans), the cursor-paginated `getPosts` (PostArchive infinite scroll) + unused `getAllQuestions`, and a few component-direct reads (`PostDetail` per-post questions, `InfographViewer`). These get localized in Phase 5 / the Tauri cutover.
**Interim consistency caveat:** because reads come from the static bundle but edits/scans still write to Firestore, new edits show in the current screen (optimistic React state) but won't appear in re-navigated aggregations until the bundle is regenerated (`node scripts/export-firestore.mjs`). Phase 5 removes this by making writes update the local store directly.
**Files:** `scripts/export-firestore.mjs` (new), `src/lib/localData.ts` (new), `public/data/*.json` (generated), `src/lib/posts.ts` (reads → in-memory)

### Phase 3 — Tauri 2 shell (desktop, mobile-ready)
**Solution:** Installed `@tauri-apps/cli@2.11.3` + `@tauri-apps/api`, ran `tauri init --ci` to scaffold `src-tauri/` (Rust lib+bin, `tauri.conf.json`, capabilities, icons). Config: productName "Q Archive", identifier `com.qarchive.desktop`, window 1440×900 (min 900×600, centered), `frontendDist: ../dist`, `devUrl: http://localhost:5173`, `beforeDevCommand: npm run dev`, `beforeBuildCommand: npm run build:app`. Added npm scripts: `build:app` (`vite build` — skips the failing `tsc -b`), `tauri`, `app:dev` (`tauri dev`), `app:build` (`tauri build`).
**Platforms:** Tauri 2 targets desktop (Win/Mac/Linux) + mobile (Android, iOS) from one codebase. PC + Android buildable on Windows; iOS requires a Mac + Apple Developer account (Apple restriction).
**Files:** `src-tauri/*` (new), `package.json` (scripts + Tauri devDep)

### Phase 3 (cont.) — Built & running on Windows
**Rust installed** (1.96.0). `npm run app:dev` compiled the shell in **3m 56s** (284 crates) and launched the native window; app runs fully offline from the local bundle. Then `npm run app:build` produced release artifacts in `src-tauri/target/release/`:
- standalone **`app.exe`** — 11 MB (self-contained: UI + code + the 8 MB archive embedded; ~29 MB RAM at runtime)
- **`bundle/nsis/Q Archive_0.1.0_x64-setup.exe`** — 3.7 MB installer (Start Menu + desktop shortcuts)
- **`bundle/msi/Q Archive_0.1.0_x64_en-US.msi`** — 4.6 MB installer
Created a Desktop shortcut **"Q Archive.lnk"** → standalone exe (lands in OneDrive-redirected Desktop). Smoke-tested: release exe launches standalone, window opens, no crash, offline data loads.
**Note:** Tauri's default logo is the current icon — replace by running `tauri icon <square-png>` when a brand image is available. Pre-existing `tsc` errors don't block builds because `beforeBuildCommand` uses `vite build` (esbuild, no type-check).

### Phase 5 — Writable local store (IndexedDB), Firestore fully cut for browsing + editing
**Solution:** Upgraded `src/lib/localData.ts` into a writable store. Source of truth = **IndexedDB** (one record per collection), seeded once from `public/data/*.json` (guarded by `SEED_VERSION`); held in memory for instant reads. New `mutateStore(collections, fn)` applies a synchronous mutation to the in-memory store, marks collections dirty, rebuilds post indexes when posts change, and debounce-persists (400ms) the changed collections back to IndexedDB. So edits survive restarts with zero network.
- **`src/lib/posts.ts`** is now 100% Firestore-free — all Firebase imports removed. Reads serve from the store (Phase 2); writes mutate the store: `addManualQuestion`, `mergeSimilarQuestions`, `starPost`, `addPostToTopic`/`removePostFromTopic`, `saveAnalysisConfirmed`/`removeAnalysisConfirmed`, `clearAnalysisCategoriesFromPosts`, `funnelRequestQuestionsToCollection`. Added generic write helpers used by components: `updatePost`, `addQuestions`, `removeQuestionById`, `setQuestionStatuses`. Local id generation via `crypto.randomUUID()` replaces Firestore auto-ids. `getPosts`/`getAllQuestions` switched from Firestore cursors to numeric-offset pagination (`nextCursor`).
- **Components converted off direct Firestore** to the store / posts.ts helpers: `PostDetail.tsx` (~16 call sites: question add/detect/remove/classify, analysis items, requests, brackets, analyze), `PostCard.tsx`, `PostArchive.tsx` (numeric cursor), `QuestionsArchive.tsx` (sync), `QUncategorized.tsx` (funnel), `QBrackets.tsx`, `QRequests.tsx`, `QSchool.tsx`, `QTripcodes.tsx`, `QTopics`/`Topics.tsx`, `Resources.tsx`.
- **Verified:** `vite build` succeeds; `tsc` shows only pre-existing errors (recharts typings, PostCard JSX namespace, Dashboard null-checks, QTripcodes literal-Set) — no new errors. No remaining `Cannot find name 'db'` etc.
**Still on Firestore (Phase 4 — online admin actions only):** `Dashboard.tsx` bulk scans, `lib/bulkScan.ts`, `lib/ingest.ts`, `InfographViewer.tsx` (generate+save), `StorylineGenerator.tsx` (`storylines` collection not in bundle). These need Claude/network anyway; they don't affect offline browsing/editing.
**Files:** `src/lib/localData.ts`, `src/lib/posts.ts`, `src/pages/{PostDetail,PostArchive,QuestionsArchive,QUncategorized,QBrackets,QRequests,QSchool,QTripcodes,Topics,Resources}.tsx`, `src/components/PostCard.tsx`

---

## Session 11 — AI Research Workers (Q-proof verification platform)

### Request: AI "sub-agents" to (1) find dated news that correlates with Q posts, (2) crawl web/social for Q-proofs and link them, (3) keep proofs honest with relevancy / fake-news / evidence ratings + like/dislike
**Design decisions (via AskUserQuestion):** ratings = **personal/local** (single-user, offline — community vote counts would require an online backend, which conflicts with the now-offline app); build **News Correlator first**; run **on-demand per post** (cheap, user-triggered) rather than bulk. Workers are Claude API calls with the server-side `web_search_20260209` + `web_fetch_20260209` tools (citations = evidence trail) — NOT Managed Agents (overkill/cost). Honest constraints surfaced: social media is best-effort (live platform APIs are walled; web search reaches publicly-indexed content); cost scales with scan volume (Batch API = 50% off for future bulk runs); calls use the API key so they should ride the Phase 4 Tauri backend when packaged.

### Phase 6.1–6.3 — News Correlator ("future proves past")
**Solution:**
- **Types** (`types.ts`): `CorrelatedArticle` { title, url, source, publishedDate, timing (before/same/after vs drop date), relevance 0-100, summary, + local honesty layer: userRating up/down, credibility credible/questionable/fake/unverified, notes, addedAt }. Added `QPost.correlatedNews?` + `newsScanned?`.
- **Worker** (`claude.ts` → `correlateNews(post)`): builds a prompt from the post's date + extracted entities/predictions/claims, calls Claude (`NEWS_MODEL = 'claude-opus-4-8'`; switch to `claude-sonnet-4-6` to ~halve cost) with `web_search`/`web_fetch` tools, handles the server-tool `pause_turn` resume loop, parses a JSON array of real cited articles (before/after the drop), returns `FoundArticle[]`.
- **UI** (`PostDetail.tsx`): a "🔎 News Correlation — future proves past" panel (single-post view only, not reader mode) with a "Research news"/"Find more" button. Lists found articles sorted before→after, each with timing badge, source · date, title link (↗), relevance %, summary, and the **local honesty layer**: 👍/👎, fake-news verdict chips (credible/questionable/fake/unverified), and a notes field. All ratings persist to the offline IndexedDB store via `updatePost` (no network). `crypto.randomUUID()` ids; de-dupes by URL.
**Verified:** `vite build` ✓. Live web_search requires the Anthropic org to have the web-search tool enabled; errors surface in the panel.
**Pending:** Phase 6.4 — Proof Hunter + Honesty Auditor workers; optional Dashboard bulk/Batch run for whole-archive coverage.
**Files:** `src/types.ts`, `src/lib/claude.ts`, `src/pages/PostDetail.tsx`

### Request: Clicking a month bar on a timeline chart should reveal the frequency breakdown (what items were asked/used that month + how many times each repeated) instead of a raw grid of post numbers — and make this universal across charts
**Solution:** New reusable component `src/components/TimeframeBreakdown.tsx`. Given the `{text, count, postNums}` frequency data each page already has + the clicked month's post-number set, it ranks the items that occurred that month by their **in-month repeat count** (×N badge), shows each item's text, its in-month post-# chips (click-through, carrying the right highlight/`rk`/`cat` params), and an "N× all-time" secondary count. Accent-colored per page. Header summarizes "X unique · Y total · Z repeated".
- **Q Questions** (`QuestionsArchive.tsx`): replaced the old `MonthPostsPanel` (plain post-number grid) with `TimeframeBreakdown` (items = all question frequencies, accent blue, `rk=question` chips). Deleted the now-dead `MonthPostsPanel`.
- **Analysis charts** (`AnalysisArchive.tsx`): added the breakdown on month-click for all six category tabs (Claims/Predictions/Entities/Themes/Conclusions/Hooks), accent per category, `cat=…` chips.
- **Q Brackets** (`QBrackets.tsx`): added the breakdown (maps `code`→`text`), accent red, `rk=bracket` chips.
- Q Requests already filters its list inline by month (no post-grid popup), so left as-is; PostArchive's multi-category chart can get the same panel later if wanted.
**Verified:** `vite build` ✓.
**Files:** `src/components/TimeframeBreakdown.tsx` (new), `src/pages/{QuestionsArchive,AnalysisArchive,QBrackets}.tsx`

### Request: Remove the Answered/Partial/Unanswered sub-links under Q Questions in the sidebar
**Solution:** Deleted the `questionSubLinks` array + its render block in `Sidebar.tsx`. Q Questions is now a single item; status data + page untouched (easy to restore). `activeStatus` kept (still de-highlights the parent when a `?status=` URL is present).
**Files:** `src/components/Sidebar.tsx`

### Request: PIN-gate the paid AI feature (162424), and lock down the API key so a shared copy can't spend (Phase 4)
**PIN (soft lock):** `PostDetail.tsx` — the "🔒 Research news" button now opens a PIN field; entering `162424` unlocks AI research for the session, then runs. Wrong PIN errors. Browsing is unaffected. (`AI_PIN` constant; `aiUnlocked`/`pinPromptOpen`/`pinInput`/`pinError` state; `requestResearch`/`submitPin`.)
**Phase 4 — key out of the build:**
- New Rust command `get_anthropic_key` (`src-tauri/src/lib.rs`, registered in `invoke_handler`): reads `ANTHROPIC_API_KEY` env var, else `<app_config_dir>/anthropic_key.txt`; returns `""` if neither → AI disabled on that machine.
- `claude.ts`: replaced the build-time `new Anthropic({apiKey: VITE_...})` with a lazy `getClient()` that resolves the key at runtime — Tauri → `invoke('get_anthropic_key')`, dev browser → `VITE_ANTHROPIC_API_KEY`. Throws a friendly "AI not configured" error when no key. All `client.messages` calls → `(await getClient()).messages` (14 sites).
- `.env.production` sets `VITE_ANTHROPIC_API_KEY=` (empty) so production/desktop builds embed NO key (dev `.env` still has it for `npm run dev`). Firebase web config stays embedded (not secret).
- Wrote the owner's key to `%APPDATA%\com.qarchive.desktop\anthropic_key.txt` so this machine's desktop app keeps AI; a friend's copy has no such file.
**Verified:** rebuilt desktop app; `grep` confirms the key is in **neither** `dist/` **nor** `app.exe`. App launches and runs. Sharing the installer is now safe (AI inert + PIN-gated on other machines).
**To enable AI on another of your own machines:** set `ANTHROPIC_API_KEY` env var, or drop `anthropic_key.txt` into that machine's `%APPDATA%\com.qarchive.desktop\`.
**Files:** `src/pages/PostDetail.tsx`, `src/lib/claude.ts`, `src-tauri/src/lib.rs`, `.env.production` (new)

### Request: In-app auto-update button that appears when an update is available and lists the new features
**Solution:** Full **Tauri 2 auto-updater** over a download-only GitHub repo.
- **Signing:** `tauri signer generate` → private key `C:\Users\heath\.tauri\q-archive-updater.key` (KEEP — required to sign all future updates), public key in `tauri.conf.json`.
- **Config:** `tauri.conf.json` — version → `0.2.0`, `bundle.createUpdaterArtifacts: true`, `plugins.updater.endpoints = [github releases/latest/download/latest.json]` + `pubkey`. `Cargo.toml` — `tauri-plugin-updater`/`tauri-plugin-process` under a desktop-only target. `lib.rs` — init both under `#[cfg(desktop)]`. `capabilities/default.json` — added `updater:default` + `process:default`.
- **UI:** `src/components/UpdateBanner.tsx` (mounted in `App.tsx`) — on launch (Tauri only) calls `check()`; if newer, shows a bottom-right banner with `currentVersion → version`, the release notes (`update.body`), and **Update now** → `downloadAndInstall` (progress bar) → `relaunch()`. No-op in the browser.
- **Hosting:** public repo **github.com/kck321/q-archive-app** (installers + `latest.json` only, no source). Build signed via `TAURI_SIGNING_PRIVATE_KEY` env. Published **release v0.2.0** with `QArchive-0.2.0-Setup.exe` + `latest.json` (version, notes, signed url). Verified `releases/latest/download/latest.json` resolves.
- **Publishing future updates:** bump `version` in `tauri.conf.json` → `TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/q-archive-updater.key) TAURI_SIGNING_PRIVATE_KEY_PASSWORD= npm run app:build` → copy NSIS exe to a clean name, build `latest.json` from its `.sig` → `gh release create vX.Y.Z --repo kck321/q-archive-app <exe> latest.json`.
- **Caveat:** the pre-updater 0.1.0 build can't self-update to 0.2.0 — install v0.2.0 manually once; thereafter the banner handles it.
**Files:** `src-tauri/{tauri.conf.json,Cargo.toml,src/lib.rs,capabilities/default.json}`, `src/components/UpdateBanner.tsx`, `src/App.tsx`, repo `kck321/q-archive-app`

### Request: Phone charts hard to read; make mobile-friendly / more appealing
**Solution:**
- **Responsive shell** (`App.tsx` + `Sidebar.tsx`): on small screens the sidebar becomes a slide-in drawer behind a hamburger top-bar (with backdrop; closes on nav tap); on `lg+` it's the static sidebar as before. Main content padded for the mobile header.
- **Scrollable charts** (`src/components/ScrollableChart.tsx`, new): wraps each timeline chart so on phones it keeps a comfortable `minWidth` (920px) and scrolls horizontally (bars readable + tappable), while fitting normally on `lg+` (via `lg:!min-w-0` overriding the inline minWidth). Adds a "swipe sideways" hint on mobile only. Chart height bumped 220→240. Applied to all six chart pages: PostArchive, QuestionsArchive, AnalysisArchive, QRequests, QBrackets, Dashboard.
- **Phone preview:** keyless prod build served via `vite preview --host` + a Cloudflare quick tunnel (`npx cloudflared`), with `server/preview.allowedHosts: true` in `vite.config.ts`. (Temporary; lives while PC + tunnel run.)
**Verified:** `vite build` ✓ (902 modules), tunnel HTTP 200.
**Files:** `src/components/ScrollableChart.tsx` (new), `src/App.tsx`, `src/components/Sidebar.tsx`, `vite.config.ts`, `src/pages/{PostArchive,QuestionsArchive,AnalysisArchive,QRequests,QBrackets,Dashboard}.tsx`

## 2026-06-26 — Permanent phone link (GitHub Pages hosting)

**Request:** User wanted the phone link to stay the same one given to friends. The Cloudflare quick-tunnel URL changes on every restart and the old one is unrecoverable, so switched to permanent online hosting.

**Solution:** Deployed the web build to GitHub Pages.
- Permanent link: **https://kck321.github.io/q-archive-app/** (works on any phone, PC can be off).
- `vite.config.ts`: conditional `base` — `/q-archive-app/` only when `DEPLOY_TARGET=pages`; stays `/` for Tauri desktop + tunnel preview.
- `src/App.tsx`: `<BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>` so deep routes work under the subpath (empty basename for desktop).
- Data loader already used `${import.meta.env.BASE_URL}data/*.json`, so the 8MB JSON bundle loads correctly under the subpath.
- SPA deep-link refresh: copy `dist/index.html` → `dist/404.html`.
- Published to `gh-pages` branch; Pages enabled (legacy build, branch=gh-pages, path=/).
- Verified: HTML 200, JS 200, data 200, deep link serves SPA.
- Future redeploys: `npm run deploy:web` (scripts/deploy-web.sh).
- Shut down the temporary Cloudflare tunnel + preview server (no longer needed).

Also shipped today (same deploy): mobile full-width post chips (Analysis/Questions/Requests/Brackets) and interactive color-coded PostArchive chart tabs that navigate to each category page, with the redundant colored count cards removed.

## 2026-06-27 — Red highlight for clicked topic (phone + desktop)

**Request:** When clicking a named entity (e.g. "Jack") and reading the related posts, highlight the clicked term in RED. Apply to both phone and desktop.

**Solution:** In `src/pages/PostDetail.tsx`, the reader-feed `highlightEntity()` `<mark>` changed from cyan (`bg-cyan-500/40 text-cyan-50`) to red (`bg-red-500/50 text-red-50 font-semibold`). Shared by all reader feeds, so every clicked topic now reads red.
- **Phone/web:** redeployed via `npm run deploy:web` — live at https://kck321.github.io/q-archive-app/ (verified red class in shipped JS).
- **Desktop:** bumped `tauri.conf.json` 0.2.0 → 0.2.1, built signed installer (`TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/q-archive-updater.key) TAURI_SIGNING_PRIVATE_KEY_PASSWORD=`), copied NSIS exe to clean name `QArchive-0.2.1-Setup.exe`, generated `latest.json` (version/notes/pub_date/platforms.windows-x86_64.signature+url), published `gh release create v0.2.1`. Verified `releases/latest/download/latest.json` → version 0.2.1 with signature; installer asset 200. Desktop app v0.2.0 will show the in-app "update available" banner with the 0.2.1 notes.

## 2026-06-27 — Chart legend removed + balloon-bubble tooltip (v0.2.2)

**Requests:** (1) Remove the colored legend strip under the Post Archive timeline chart (the Q Posts/Questions/Requests/… key). (2) Restyle the hover info box into a rounded "balloon bubble" with a pointer/tail and spacing between the cursor and the box.

**Solution (src/pages/PostArchive.tsx):**
- Removed the `<Legend content={…}/>` block from the timeline `<BarChart>` and dropped the now-unused `Legend` recharts import.
- `ChartTooltip`: rounded 16px corners, larger padding, soft layered box-shadow, translucent bg + backdropFilter blur, two-triangle left-pointing balloon tail, label/value rows now space-between aligned.
- `<Tooltip offset={28} cursor={{fill:'rgba(255,255,255,0.06)'}} wrapperStyle={{zIndex:50}} … />` for breathing room from the bar + subtle hover column.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.2.2 signed release; `latest.json` verified version 0.2.2, installer 200).

## 2026-06-27 — More visible scrollbar + per-tab connection counts (v0.2.3)

**Requests:** (1) Make the right-side scrollbar more defined so users know they can scroll. (2) Show the actual connection count under each Post Archive chart tab (All, Questions, Requests, Claims, Predictions, Entities, Themes, Conclusions, Hooks, Q Posts) — like the "Questions Found 10,166" stat.

**Solution:**
- `src/index.css`: scrollbar widened 6px → 14px, lighter thumb (#4b5563) with a 3px track-colored inset border (rounded-pill look), min-height 48px, hover #6b7280 / active amber, plus Firefox `scrollbar-width: auto; scrollbar-color`.
- `src/pages/PostArchive.tsx`: added `tabCounts` map (questions→stats.totalQuestions; requests/claims/predictions/namedEntities/themes/impliedConclusions/verificationHooks→analysisTotals; All & Q Posts→stats.totalPosts). Each tab button/Link is now a vertical stack (`flex flex-col items-center leading-tight`) with the label on top and a bold `text-[10px]` count below (`.toLocaleString()`, em-dash while loading).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.2.3 signed release; endpoint verified version 0.2.3, installer 200, scrollbar CSS confirmed live).

## 2026-06-27 — Back button on category pages + removed redundant stat cards (v0.2.4)

**Requests:** (1) Remove the Total Posts / Questions Found cards at the bottom of Post Archive (now redundant — counts live under the chart tabs). (2) Add a Back button on category pages (e.g. Questions) to return to the previous screen.

**Solution:**
- `src/pages/PostArchive.tsx`: removed the `{stats && (…StatCard Total Posts / Questions Found…)}` block below the chart.
- New `src/components/BackButton.tsx`: "← Back" button calling `useNavigate()(-1)`; styled pill (bg-white/5, border-q-border).
- Added `<BackButton />` to the sticky header of QuestionsArchive, QRequests, AnalysisArchive, and QBrackets (above each title row).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.2.4 signed release; endpoint verified version 0.2.4, installer 200).

## 2026-06-27 — Hover-preview chart tabs (v0.2.5)

**Request:** Hovering a category tab (e.g. Questions) should change the chart to that category's specific chart view.

**Solution (src/pages/PostArchive.tsx):** Added `hoverTab` state. In the chart IIFE, `effTab = chartMatchMonths ? chartTab : (hoverTab ?? chartTab)` now drives `activeTab/isAll/isPostsOnly` (so the title, subtitle, and bars all switch to the hovered category). Added `onMouseEnter/onMouseLeave` to all tabs (All → 'all', each category Link → t.key, Q Posts → 'postsOnly') setting/clearing hoverTab. Click behavior unchanged (category Links still navigate; All/Q Posts still select). Hover ignored while a keyword search is painting the chart.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.2.5 signed release; endpoint verified version 0.2.5, installer 200).

## 2026-06-27 — Tripcode Activity Timeline / Gantt chart (v0.2.6)

**Request:** On the Q Tripcodes page, show a chart listing the sections of time each individual tripcode was used.

**Solution (src/pages/QTripcodes.tsx):** Added `TripcodeGantt` component — a horizontal Gantt timeline built from the hardcoded TIMELINE data. One row per unique tripcode (grouped by trip string, preserving order, so `!!mG7VJxZNCI`'s two periods show as two separate bars on one row). Each bar is positioned by `(start−min)/span` and `(end−start)/span` across the full Oct 2017–Dec 2020 range, colored by platform (4chan green / 8chan blue / 8kun orange), with year gridlines (2018/2019/2020), a label column (tripcode + post count), x-axis end-date labels, and a platform legend. Clicking a bar calls `onSelect` → reuses existing `selected` state to show that tripcode's posts below. Rendered above the existing timeline table. Also fixed pre-existing `knownTrips` Set typing (`new Set<string>(...)`).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.2.6 signed release; endpoint verified version 0.2.6, installer 200).

## 2026-06-27 — Date-aware search (v0.2.7)

**Request:** Typing a date like "Nov 4" should pull up posts from that date (search returned 0 because it only matched post text).

**Solution (src/lib/posts.ts):** Added `parseDateQuery(termLower)` → `{year?, month?, day?}` handling: ISO `2018-11-04`, numeric `11/4` & `11/4/2018`, month-name forms (`nov`, `November 4`, `Nov 4 2018`, `4 nov 2018`), and year-only `2018`. `searchAllPosts` now matches a post if its publish date (`new Date(p.timestamp*1000)`, local) matches the parsed query (compares only the parts given — e.g. month+day with any year) OR the text matches as before. Non-date terms parse to null and fall through to text search unchanged. Both the results list and the chart density coloring use searchAllPosts, so both reflect date matches. Verified parser against 10 sample inputs. Updated results header copy "containing" → "matching … text or date".
- Shipped to phone (`npm run deploy:web`) and desktop (v0.2.7 signed release; endpoint verified version 0.2.7, installer 200).

## 2026-06-27 — Admin-gated bulk classify across matching posts (v0.2.8)

**Request:** When classifying a snippet (e.g. "Remember, disinformation is real") into an analysis category on a post, apply that same classification to all other posts containing the same phrase — gated behind admin PIN 1624.

**Solution:**
- `src/lib/posts.ts`: new `applyAnalysisToMatchingPosts(snippet, category)` — adds the snippet to `postAnalysis[category]` on every post whose text contains it (case-insensitive), skips posts already classified, sets analysisScanned, returns `{changed, matched}`.
- `src/pages/PostDetail.tsx`: added `ADMIN_PIN='1624'` + admin state (adminUnlocked, adminPinInput/Error, pendingBulk, bulkBusy, bulkMsg). Each analysis chip now has a hover action ("🔒 all" → "⇉ apply all" once unlocked) calling `requestBulkClassify(key,item)`. First use opens an inline admin-PIN form (`submitAdminPin`); correct PIN unlocks for the session and runs `runBulkClassify`, which calls the lib fn, refreshes this post's analysis + the frequency map, and shows a result message ("✓ Classified … on N posts (of M containing the phrase)"). Individual single-post add/remove edits are unchanged (not PIN-gated).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.2.8 signed release; endpoint verified version 0.2.8, installer 200).

## 2026-06-27 — Theme highlighting + admin-gated Analyze + uncategorized-repeats scanner (v0.2.9)

**Requests:** (1) A word classified as a Theme (e.g. "Mockingbird") wasn't highlighted in the post body, and should highlight every occurrence (and classify across all posts). (2) The AI "Analyze Post" button wasn't PIN-gated. (3) A way to scan posts for repeated terms that aren't categorized yet (like Mockingbird).

**Solution:**
- **(1) Highlighting (src/pages/PostDetail.tsx):** the body highlighter only colored namedEntity/claim/prediction. Added `theme` Kind (indigo `bg-indigo-500/30`) + added themes, impliedConclusions, verificationHooks to `analysisPairs`, and `theme` to the priority map. Now classified themes highlight at every occurrence in their color. (Cross-post propagation = the v0.2.8 "apply all" / new scanner.)
- **(2) Admin gate generalized:** replaced `pendingBulk` with generic `pendingAdmin {label, run}` + `requestAdmin(label, action)`; admin PIN now a centered fixed modal at the page root (visible wherever triggered). The "🔬 Analyze Post" button calls `requestAdmin('analyze this post with AI', handleAnalyzePost)` and shows 🔒 until unlocked. Bulk classify routes through the same gate. Unlock is per session.
- **(3) Scanner (src/lib/posts.ts + src/components/UncategorizedRepeats.tsx):** `getUncategorizedRepeats(minPosts=2)` extracts capitalized words/phrases via regex, excludes grammatical SCAN_STOPWORDS, pure numbers, and anything already in any post's analysis arrays; ranks by # of posts. New `UncategorizedRepeats` component (collapsible) on the AnalysisArchive 'all' tab: Scan button → ranked list with post-link chips and a "Classify all as…" dropdown that (admin-PIN-gated, 1624) calls `applyAnalysisToMatchingPosts` to classify that term across every matching post and drops it from the list.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.2.9 signed release; endpoint verified version 0.2.9, installer 200).

## 2026-06-27 — App-wide Admin Mode + Questions row + theme highlight confirm (v0.3.0)

**Requests:** (1) Q Themes highlighted on the post. (2) Add-question feature inside the analysis panel, PIN-gated, displayed like other categories. (3) PIN also required to edit a post's analysis and to access the Dashboard tab.

**Solution:**
- **Shared admin lock:** new `src/components/AdminContext.tsx` (`AdminProvider` + `useAdmin`) holds one session-wide `unlocked` flag and a global `requireAdmin(label, action)` that renders a single centered PIN modal (PIN 1624). Wrapped `<App>` in `<AdminProvider>`. Replaced PostDetail's local admin state and UncategorizedRepeats' local PIN with the shared hook — entering the PIN once unlocks everything.
- **PostDetail editing gated:** `AddRow` returns null when locked (no +add); analysis-chip ✕ remove hidden when locked; header shows "🔒 Unlock to edit" → `requireAdmin`. AI "Analyze Post" + bulk "apply all" route through `requireAdmin`.
- **Questions row (#2):** new first row in the Post Analysis panel showing the post's questions as blue chips with +add (rowKey `questions` → `handleAddQuestionText` creates a QQuestion via addQuestions) and ✕ remove (both admin-gated), styled like the other category rows.
- **Dashboard gated (#3):** `Dashboard` now shows a lock screen ("🔒 Dashboard is locked") until `adminUnlocked`; "Enter admin PIN" → `requireAdmin('access the Dashboard', ...)`.
- **Themes (#1):** confirmed live from v0.2.9 (themes/impl-conclusions/verification-hooks highlight in the body where the exact phrase appears). Abstract AI themes that aren't verbatim in the post have nothing to highlight.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.0 signed release; endpoint verified version 0.3.0, installer 200).

## 2026-06-27 — PostCard editor: PIN gate + theme highlight + Questions row (v0.3.1)

**Root cause:** The analysis editor the user was actually using ("🔬 ▼ Edit Analysis" button) lives in `src/components/PostCard.tsx` — a SEPARATE editor from PostDetail's panel that was never gated and never highlighted themes. v0.3.0 only fixed PostDetail.

**Fix (src/components/PostCard.tsx):**
- **Theme highlighting:** added `theme`/`impliedConclusion`/`verificationHook` to the Kind type, the `addSegs` calls (themes/impliedConclusions/verificationHooks), and the `cls` color map (indigo/orange/yellow). Now classified themes (e.g. "Mockingbird") highlight every occurrence in the card body.
- **Admin gate:** imported `useAdmin`; the "Edit Analysis" toggle now calls `requireAdmin("edit this post's analysis", () => setAnalysisOpen(true))` to open (shows 🔒 until unlocked). Since opening requires the global unlock, the inner +add/✕ controls are inherently gated.
- **Questions row (#2 follow-up):** added a "Questions" row at the top of the editor (like the other categories) backed by `getQuestionsForPost(post.id)` → `localQuestions`; +add → `handleAddQuestionText` (creates QQuestion via addQuestions), ✕ → `handleRemoveQuestionLocal` (removeQuestionById). Removed the standalone footer "+ Add Question Found" button.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.1 signed release; endpoint verified version 0.3.1, installer 200).

**Note:** abstract AI themes (e.g. "government corruption") still won't highlight because they're not verbatim in the post text — only literal terms like "Mockingbird" do.

## 2026-06-27 — Cross-device edit sync (v0.3.2)

**Request:** Edits made on desktop (e.g. adding "God" to Entities) don't appear on the phone. Root cause: each device seeds its own IndexedDB from the bundle and `updatePost` wrote ONLY locally — no server, so devices never shared edits.

**Solution (chosen: cloud sync, apply on load):**
- New `src/lib/sync.ts`: uses the existing `src/firebase.ts` client (`db`, named DB 'default'). Small side collections `postEdits/{postId}` and `questionEdits/{questionId}` hold only CHANGED items (keeps load fast — never re-downloads the 8MB posts collection). `pushPostEdit` (merges editable fields), `pushQuestionAdd`, `pushQuestionDelete`, and `fetchOverrides` (6s timeout, returns null offline). All writes are fire-and-forget + try/catch (offline-safe).
- `src/lib/posts.ts`: `updatePost`, `addQuestions`, `removeQuestionById`, and `applyAnalysisToMatchingPosts` now also push to the cloud after the local mutate.
- `src/lib/localData.ts`: `loadLocalData` calls `applyCloudOverrides(store)` after building indexes — overlays post-field edits (Object.assign, preserves map refs) and question add/deletes onto the local store, recomputes `hasQuestions`, and persists posts/questions back to IndexedDB so the overlay survives the next offline launch.
- Verified Firestore rules permit read/write to the new collections (live test write+read+delete on `postEdits` succeeded).
- Reads stay offline/instant (bundle); only editing + the on-load overlay need internet. Last-write-wins across devices (single-user assumption).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.2 signed release; endpoint verified version 0.3.2, installer 200).

## 2026-06-27 — One-time local-edits → cloud migration (v0.3.3)

**Issue:** After v0.3.2 sync shipped, desktop edits (God entity, Mockingbird theme) still didn't appear on phone. Diagnosis: cloud `postEdits`/`questionEdits` were EMPTY (verified live) — those edits were made before sync existed, so they live only in the desktop's IndexedDB and were never pushed.

**Solution:** `migrateLocalEditsToCloud(onProgress)` in posts.ts — fetches the original bundle (public/data/posts.json + questions.json) as a baseline, diffs each local post's editable fields (postAnalysis/actionRequests/customBrackets/excludedBrackets/correlatedNews) via JSON.stringify, and `pushPostEdit`s only the posts that differ (keeps postEdits small). For questions: pushes local adds (id not in bundle) and deletes (bundle id missing locally). Added an admin Dashboard card "☁ Sync my edits" with progress + result that calls it. User runs it ONCE on the device holding the edits (desktop); other devices pick up on refresh. Idempotent.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.3 signed release; endpoint verified version 0.3.3, installer 200).

## 2026-06-27 — Upgraded uncategorized scanner, pinned to top (v0.3.4)

**Request:** A feature to scan all posts for everything NOT highlighted/classified yet, pinned to the top, showing what's found and what repeats.

**Solution:**
- `src/lib/posts.ts` `getUncategorizedRepeats(minPosts=1, limit=600)`: now scans capitalized proper-noun phrases AND lowercase content words (4+ letters); `covered` set expanded to analysis categories + actionRequests + question texts; added `SCAN_GLOSSARY` exclusion (POTUS/FBI/mil-intel/Q-signatures/static entities — they auto-highlight). Rule: capitalized terms always included; lowercase only if repeated (≥2 posts). Returns `{term, count (posts), occurrences, postNums}` sorted by post count then occurrences.
- `src/components/UncategorizedRepeats.tsx`: renamed to "🔍 Scan for uncategorized terms"; added a "Repeated (N) / All found (N)" toggle, a text filter, occurrence display, and "N shown". Per-term "Classify all as…" stays (admin-gated → applyAnalysisToMatchingPosts).
- `src/pages/AnalysisArchive.tsx`: moved the scanner to the TOP of the overview ('all') tab (above the chart).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.4 signed release; endpoint verified version 0.3.4, installer 200).

## 2026-06-27 — Scanner: multi-word phrase detection (v0.3.5)

**Request:** A comprehensive list of everything not highlighted, plus anything significant that repeats.

**Solution (src/lib/posts.ts getUncategorizedRepeats):** added an n-gram pass — within each sentence/clause segment, generates 2–3 word phrases, skips all-caps phrases (already caught), skips phrases starting/ending with a stopword, and feeds them through `consider(..., cap=false)` so lowercase phrases are included only when they repeat (≥2 posts). Now surfaces repeated phrases like "criminal elements" alongside single words and proper nouns. Bumped result cap 600→800. "Repeated"/"All found" toggle + filter (from v0.3.4) make it browsable.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.5 signed release; endpoint verified version 0.3.5, installer 200).

## 2026-06-27 — Scanner discoverability fix (v0.3.6)

**Issue:** User couldn't find "Scan archive" (looked in Dashboard). Root cause: scanner only rendered on AnalysisArchive `activeTab === 'all'`, but every sidebar link goes to `/analysis?tab=<specific>` — no nav reaches the 'all' tab, so it was effectively hidden.

**Fix:** `src/pages/AnalysisArchive.tsx` — render `<UncategorizedRepeats />` for all analysis tabs except 'overlaps' (`activeTab !== 'overlaps'`), so it's pinned to the top of Q Claims/Predictions/Entities/Themes/Conclusions/Hooks (all sidebar-reachable). Collapsed by default (just the header + "Scan archive" button).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.6 signed release; endpoint verified version 0.3.6).

## 2026-06-27 — Dashboard "Uncategorized content scan" (v0.3.7)

**Request:** Move the scan to a DASHBOARD feature: show the % of posts not highlighted, and a list of unhighlighted terms with their Q post numbers, ranked by significant repeats. (Reverted the v0.3.6 all-analysis-tabs placement.)

**Solution:**
- Reverted `AnalysisArchive.tsx` (removed UncategorizedRepeats + import); deleted `src/components/UncategorizedRepeats.tsx`.
- `src/lib/posts.ts`: new `getUncategorizedReport()` → `{ totalPosts, postsHighlighted, postsUnhighlighted, pctUnhighlighted, terms }`. A post counts as "highlighted" if it has any analysis category item, an actionRequest, or a question; pct = unhighlighted/total. `terms` from getUncategorizedRepeats (words + proper nouns + repeated phrases).
- New `src/components/CoverageScan.tsx` (Dashboard): "Scan all posts" button → 4 stat cards (% not highlighted, % highlighted, # uncategorized terms, # repeated 2+), Repeated/All-found toggle, filter, and a list where each term shows its post-number chips (up to 15 + "+N more", linking to the post) and a "Classify all as…" admin action. Default Repeated view, sorted by repeats.
- Mounted `<CoverageScan />` at the top of the Dashboard (admin-gated page).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.7 signed release; endpoint verified version 0.3.7).

## 2026-06-27 — Undo classifications (v0.3.8)

**Request:** Accidentally classified "em twitter" as Named Entities — wants to undo from the scanner.

**Solution:**
- `src/lib/posts.ts`: new `removeAnalysisFromMatchingPosts(snippet, category)` — inverse of applyAnalysisToMatchingPosts; removes the term from that category on every post that has it, syncs each changed post to the cloud, returns count.
- `src/components/CoverageScan.tsx`: (1) per-action `↩ Undo` button on the classify confirmation (remembers lastAction, restores the term to the list on undo); (2) an "↩ Undo a classification" box (term input + category select + "Remove from all") for fixing already-classified mistakes after the fact (admin-gated → removeAnalysisFromMatchingPosts). classify() now takes the full UncategorizedTerm so undo can restore it.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.8 signed release; endpoint verified version 0.3.8).

## 2026-06-27 — Reader post-number opens single post with highlight (v0.3.9)

**Request:** In the reader feed ("Reading every post mentioning NO NAME"), clicking a post number should open that post on its own with the searched topic highlighted, to verify it.

**Fix (src/pages/PostDetail.tsx):** the reader post-number `<Link>` included `&${readerQuery}` (cat=/rk=), which re-triggered reader mode on the target. Removed it so it links to `/post/{num}?flash=1&highlight={term}` → single-post view where the `highlight` param highlights the term (with flash). Updated the title tooltip.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.3.9 signed release; endpoint verified version 0.3.9).

## 2026-06-27 — Bulk "add all" for questions (v0.4.0)

**Request:** Questions section should have the same "add all" bulk feature as the analysis categories — add a found question (e.g. "Why?") to every post that contains it.

**Solution:**
- `src/lib/posts.ts`: new `addQuestionToMatchingPosts(text)` — for every post whose body contains `text` (case-insensitive), creates a QQuestion (skipping posts that already have it), sets hasQuestions, syncs each via pushQuestionAdd; returns `{added, matched}`.
- `src/pages/PostDetail.tsx`: Questions-row chips now have an "⇉ add all / 🔒 all" button → `requestBulkAddQuestion` → `requireAdmin` → `runBulkAddQuestion` (refreshes this post's questions + shows bulkMsg).
- `src/components/PostCard.tsx`: same on its Questions-row chips → `handleAddQuestionAll` (admin-gated) with a small inline `qMsg` confirmation.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.0 signed release; endpoint verified version 0.4.0).

## 2026-06-27 — Post Analysis panel: always-on Requests + Brackets add-rows (v0.4.1)

**Request:** Want all add-options in the Post Analysis panel (Questions/Requests/Claims/Predictions/Entities/Brackets/Themes/Conclusions/Hooks); specifically couldn't add a missed bracket because the Brackets row only appeared when brackets were auto-detected.

**Solution (src/pages/PostDetail.tsx):**
- AddRow now handles `rowKey === 'request'` → handleAddRequest.
- Added a always-visible "Requests" row in the panel (AddRow rowKey="request" + actionRequests chips + admin-gated remove), right after the Questions row.
- Removed the `showBrackets` guard so the "[ Brackets ]" row (with + add) is always present; bracket chips/excluded still render only when present.
- Removed the now-duplicate Requests management block from the "Detected" section.
- Note: "⚠ Overlaps" is a cross-post conflict view, not a per-post addable category, so it's intentionally not an add-row.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.1 signed release; endpoint verified version 0.4.1).

## 2026-06-27 — Bulk "add all" for Requests & Brackets (v0.4.2)

**Request:** The newly-added Requests and Brackets rows should also have the "add all" bulk feature.

**Solution:**
- `src/lib/posts.ts`: `addRequestToMatchingPosts(text)` (adds to actionRequests + hasRequests on every matching post) and `addBracketToMatchingPosts(code)` (adds to customBrackets), both skip posts that already have it and sync each via pushPostEdit; return `{added, matched}`.
- `src/pages/PostDetail.tsx`: generic `runBulk(label, fn)` helper + `requestBulkAddRequest` / `requestBulkAddBracket` (admin-gated). Added "⇉ add all / 🔒 all" buttons to the Requests-row and Brackets-row chips. Now every category (Questions, Requests, Entities, Claims, Predictions, Themes, Conclusions, Hooks, Brackets) supports bulk add.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.2 signed release; endpoint verified version 0.4.2).

## 2026-06-27 — Mixed-case bracket highlighting (v0.4.3)

**Issue:** User added [Marker] and [important] but they didn't highlight red. Root cause: the bracket regex `/\[\[?[A-Z0-9][A-Z0-9 _\-]{0,30}\]?\]/g` only matched all-caps/digit codes (no lowercase), so [Marker] (mixed) and [important] (lowercase start) never matched. The body highlighter uses the regex (not the user's customBrackets list), so manually adding them didn't help.

**Fix:** broadened the regex to `/\[\[?[A-Za-z0-9][A-Za-z0-9 _\-]{0,30}\]?\]/g` in all three spots — PostDetail body highlighter (172), PostDetail panel auto-detect (1552), and PostCard body highlighter (143). Now mixed-case/lowercase brackets auto-detect and highlight red, and show up in the Brackets row automatically.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.3 signed release; endpoint verified version 0.4.3).

## 2026-06-27 — External post links open in browser (v0.4.4)

**Issue:** Clicking a website link in a post did nothing in the desktop app — Tauri's webview doesn't open external http(s) links on its own.

**Solution:**
- Added the `tauri-plugin-opener` plugin: Cargo.toml dep, `.plugin(tauri_plugin_opener::init())` in lib.rs, `opener:default` + `opener:allow-open-url` in capabilities/default.json, npm `@tauri-apps/plugin-opener`.
- New `src/lib/openExternal.ts`: `isTauri()` + `openExternal(url)` → uses plugin `openUrl()` in Tauri, else `window.open`.
- `src/App.tsx`: global **capture-phase** document click handler — intercepts every `<a href="http(s)…">` click when running in Tauri and routes to `openExternal` (capture phase so it fires before link `stopPropagation`; internal `/route` links ignored). Works for post-body URLs, the link-preview "Open →", and "8kun ↗" links alike. No-op in the browser (native anchors).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.4 signed release with the new plugin; endpoint verified version 0.4.4).

## 2026-06-27 — Auto-scroll to month breakdown (v0.4.5)

**Request:** Clicking a graph bar should show the names of the entities/items in that month, "for any graph." User thought it was already built.

**Finding:** It IS built on the per-category charts (AnalysisArchive entities/claims/predictions/themes/conclusions/hooks via TimeframeBreakdown; QuestionsArchive & QBrackets too; QRequests filters its list). Likely the breakdown was just below the fold so the user didn't notice. PostArchive & Dashboard use post-number grids (all-category overviews).

**Solution (this pass):** `src/pages/AnalysisArchive.tsx` — added `breakdownRef` + effect to `scrollIntoView` when `selectedMonth` changes; wrapped the `<TimeframeBreakdown>` in `<div ref={breakdownRef} className="scroll-mt-4">`. Now clicking a month bar auto-scrolls to the named breakdown panel. (PostArchive/Dashboard item-breakdown deferred — offered to user.)
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.5 signed release; endpoint verified version 0.4.5).

## 2026-06-27 — Entity/tag aliases (v0.4.6)

**Request:** Classified entity "Anthony Weiner" didn't highlight in post #2365 because the post spells it "Anthony Wiener" [sic]. Wanted an alias system so alternate spellings highlight under one canonical name.

**Solution:**
- New `src/lib/aliases.ts`: global alias map (canonical-lowercase → alias strings) in localStorage for instant offline reads, synced to Firestore doc `app/aliases` (stored as a JSON string field to dodge field-name limits). `getAliasesFor`, `addAlias`, `removeAlias`, `subscribeAliases`, `loadAliasesFromCloud` (union merge). Cloud write verified live.
- `App.tsx`: `loadAliasesFromCloud()` on startup.
- Highlighters now match aliases: `renderPostBody` (PostDetail) iterates `[item, ...getAliasesFor(item)]`; PostCard `highlightText` wraps each category's list with `withAliases`.
- PostDetail analysis chips: show registered aliases inline ("also: …" with ✕ remove), plus a "🔤 alias" button (admin) that opens an inline input to add an alternate spelling; subscribeAliases bumps a tick to re-highlight live.
- Pre-seeded the "anthony weiner" → "Anthony Wiener" alias in the cloud (the user's exact case) so #2365 highlights on reload.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.6 signed release; endpoint verified version 0.4.6).

## 2026-06-27 — Aliases auto-fill from highlighted text (v0.4.7)

**Request:** When adding an alias, highlighting a word in the post should auto-drop it into the alias box (like the + add flow).

**Solution (src/pages/PostDetail.tsx):** added `aliasForRef` (mirrors aliasFor for the document mouseup handler); the body-selection handler now also `setAliasInput(text)` when an alias box is open. The "🔤 alias" button pre-fills `aliasInput` with the current `selectedText` on open and shows "📋 🔤 alias" when a selection is ready. So: highlight a word → click alias → it's in the box (or highlight while the box is open → it jumps in).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.7 signed release; endpoint verified version 0.4.7).

## 2026-06-27 — Alias connections in entity list + connect known names (v0.4.8)

**Requests:** (1) In the Named Entities list, show an entity's aliases and fold in the posts where the alias spellings appear. (2) Connect two already-known entities as aliases (HRC = Hillary Clinton).

**Solution:**
- `src/lib/posts.ts`: `getPostNumsContaining(text)` — post numbers whose body contains a term.
- `src/lib/aliases.ts`: `getAliasSet()` (all alias strings) + `canonicalOf(term)`.
- `src/pages/AnalysisArchive.tsx`: builds `aliasPostMap` (alias → post #s via getPostNumsContaining) for all aliases referenced by loaded items, recomputed on alias change (subscribeAliases). Each entity row now renders "also known as: …" and a merged post-chip list (own posts in grey, alias-mention posts in cyan, each linking with the matching term as `highlight`). `filtered` now hides items whose text is in `getAliasSet()`, folding alias entities (HRC) into their canonical (Hillary Clinton).
- `src/pages/PostDetail.tsx`: captures `knownEntities` (named-entity texts from getAnalysisFrequency); the "🔤 alias" input now has a `<datalist>` autocomplete of known entities, so you can connect an existing name (type HRC → pick it).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.8 signed release; endpoint verified version 0.4.8).

## 2026-06-27 — Merged alias post count + reader highlights aliases in red (v0.4.9)

**Requests:** (1) Entity badge should show the true total posts including aliases (147 for Hillary Clinton, not 31), for every entity. (2) In the reader ("Reading every post mentioning X"), the searched name AND all aliases should highlight in red.

**Solution:**
- `src/pages/AnalysisArchive.tsx`: entity count badge now shows `chips.length` (distinct posts incl. alias mentions) instead of `item.count`; tooltip breaks down own vs alias when aliases exist; removed the now-redundant "· N posts total" from the aka line.
- `src/pages/PostDetail.tsx`: `highlightEntity` (reader feed) now builds an alternation regex over `[term, ...getAliasesFor(term)]`, so the searched entity and every alias highlight red (Hillary Clinton → also "Hillary", "HRC").
- Shipped to phone (`npm run deploy:web`) and desktop (v0.4.9 signed release; endpoint verified version 0.4.9).

## 2026-06-27 — Alias-aware search (v0.5.0)

**Request:** When searching a name, also bring up posts that use an alias of it.

**Solution:**
- `src/lib/aliases.ts`: `getAliasGroup(term)` — given any member (canonical or alias), returns the whole group (canonical + all aliases).
- `src/lib/posts.ts` `searchAllPosts`: expands the query to `getAliasGroup(term)` and matches a post if its text contains ANY group member (or the date matches). So "Hillary" → also finds "Hillary Clinton" / "HRC" posts. Drives both the results list and the Post Archive chart density.
- `src/pages/PostArchive.tsx`: results label now "text, date, or alias".
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.0 signed release; endpoint verified version 0.5.0).

## 2026-06-27 — Search results: post-number chips (v0.5.1)

**Request:** On the main search, show all related post numbers (like the entity pages) between the "Found N posts" banner and the full post cards.

**Solution (src/pages/PostArchive.tsx):** added a panel of clickable `#postNum` chips for all `searchResults`, placed right after the "Found N" banner and before the post-card grid. Scrollable (max-h-44), each links to `/post/{num}?flash=1&highlight={searchTerm}`.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.1 signed release; endpoint verified version 0.5.1).

## 2026-06-27 — Search result opens post with term+aliases in red (v0.5.2)

**Issue:** Searched "HRC", opened a result (#4872) — nothing highlighted because the post uses "Hillary" (alias) and the single-post highlighter only matched the exact "HRC", in green.

**Solution (src/pages/PostDetail.tsx):** `renderPostBody` direct-highlight now loops over `getAliasGroup(highlight)` (so highlight=HRC also matches "Hillary"/"Hillary Clinton"); the no-category highlight color changed from green (`bg-green-500/40`) to red (`bg-red-500/50 text-red-50 font-semibold`), keeping the flash animation. Search-result chips already link with `?highlight={searchTerm}`, so opening one now lights up the term + aliases in red.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.2 signed release; endpoint verified version 0.5.2).

## 2026-06-27 — Search highlight flashes red & white (v0.5.3)

**Feedback:** The opened-search highlight flashed green/white (the old `flash` keyframe) over a blue question sentence; user wants it to flash RED & white.

**Solution:** `tailwind.config.js` — added a `flash-red` keyframe (red `rgba(239,68,68,0.75)`/white text ↔ white bg/dark-red text) + `animation['flash-red'] = 'flash-red 0.6s ease-in-out 4 forwards'`. `src/pages/PostDetail.tsx` no-category highlight now uses `animate-flash-red` (instead of `animate-flash`) and settles to solid red. The 'highlight' kind already wins over 'question' (priority 0 < 3), so the searched word flashes red within the blue question sentence.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.3 signed release; endpoint verified version 0.5.3).

## 2026-06-27 — Alias-search breakdown + exact-term-first chips (v0.5.4)

**Request:** When an alias search returns the whole group's posts, (1) list the searched-term posts first and highlight them in the chips, and (2) show each alias name with its post count.

**Solution (src/pages/PostArchive.tsx):** the search-results chip panel now computes `getAliasGroup(searchTerm)`; when the group has >1 member it renders an "Includes:" breakdown (each alias as a badge with ×count of matching posts; the searched term in red, others in cyan, sorted searched-first then by count). The post-number chips are reordered so posts containing the EXACT searched term come first and render in red; a caption notes "N contain '…' exactly (shown first, in red)". Imported `getAliasGroup`.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.4 signed release; endpoint verified version 0.5.4).

## 2026-06-27 — Exact-term full posts shown first (v0.5.5)

**Request:** In an alias search, show the searched-term posts first in the full readable post list, then the others below.

**Solution (src/pages/PostArchive.tsx):** added a component-level `useMemo` → `{ searchedNums, orderedResults }` (posts containing the exact `searchTerm` first, then by postNum). The search post-card grid now maps `orderedResults`; exact-match cards get a `ring-1 ring-red-700/50`, and a divider ("↓ Other posts via alias …") is inserted at the boundary where exact matches end. Chips already ordered (v0.5.4).
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.5 signed release; endpoint verified version 0.5.5).

## 2026-06-27 — Entity-list search matches aliases (v0.5.6)

**Issue:** User classified "Q+" on 36 posts but searching "Q+" on the Entities page showed 0. Cause: "Q+" is registered as an alias of POTUS (cloud aliases: potus → [4,10,20, Q+]); the v0.4.8 alias-fold hides alias entities (folds Q+ into POTUS), so "Q+" has no standalone row, and the search only matched item.text.

**Solution (src/pages/AnalysisArchive.tsx):** the list search filter now also matches an item by its aliases — `item.text.includes(q) || getAliasesFor(item.text).some(a => a.includes(q))`. So typing "Q+" surfaces POTUS (which carries Q+ and its 36 posts via the merged-post logic). Verified data: 36 postEdits have Q+ as a named entity.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.6 signed release; endpoint verified version 0.5.6).

## 2026-06-27 — Q Brackets chart tab + brighter yellow hooks (v0.5.7)

**Requests:** (1) Q Brackets missing from the Post Archive chart tabs. (2) Make Q Hooks yellow on the graph + sidebar.

**Solution (src/pages/PostArchive.tsx + src/lib/posts.ts):**
- Added a `brackets` entry to CHART_TABS (label "Q [ Brackets ]", color red #ef4444, `to: '/brackets'`). New `countPostsWithBrackets()` (scans posts for the bracket regex) → `bracketCount` state, fed into `tabCounts.brackets` so the tab shows a number.
- Q Hooks color bumped #eab308 → #facc15 (yellow-400) in CHART_TABS and the All-categories `verificationHooks` bar fill, matching the sidebar's existing `text-yellow-400`.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.7 signed release; endpoint verified version 0.5.7).

## 2026-06-27 — Brackets timeline bars + universal colors (v0.5.8)

**Requests:** (1) Hovering Q Brackets showed no red bars (no per-month data). (2) Move Q Brackets after Entities. (3) Q Hooks looked orange / colors not universal across the app.

**Solution:**
- `src/lib/posts.ts`: `getBracketsByMonth()` → posts-with-brackets per YYYY-MM. PostArchive merges it into the timeline (`brackets` field added to timeline state + type) via `Promise.all([getQuestionsTimeline(), getBracketsByMonth()])`; the single-category `<Bar dataKey="brackets">` now renders red bars. Moved the `brackets` CHART_TABS entry to right after `namedEntities`.
- Universal colors: new `src/lib/categoryColors.ts` (canonical hex). `src/components/Sidebar.tsx` bumped from `-400` to `-500` shades (which equal the chart hex) for claims/predictions/entities/themes/conclusions/questions/requests/brackets; Hooks kept yellow-400 (#facc15) to match the charts. AnalysisArchive hooks chart color #eab308 → #facc15. Now every category is one consistent color in the sidebar + chart tabs + bars.
- Shipped to phone (`npm run deploy:web`) and desktop (v0.5.8 signed release; endpoint verified version 0.5.8).

## 2026-06-27 — Occurrence-aware question de-duplication (v0.5.9)

**Issue:** Many questions showed "2x asked" but only 1 post. Cause: the questions data had duplicate entries — same question text saved twice on the same post (bundle had 2,295 same-post+text dupes), inflating "asked" counts and the total. User wants to KEEP genuine repeats (a question actually asked 2× in one post's body) but remove the spurious ones.

**Solution:**
- Re-fetched the original questions bundle (10,169) from gh-pages and cleaned it occurrence-aware: for each post+question, keep at most as many entries as the question text appears in that post's body. Result: 7,912 (removed 2,257 spurious; preserved 227 genuine in-body repeats).
- `src/lib/localData.ts`: `dedupeQuestions(qs, posts)` rewritten to the same occurrence-aware logic (counts `norm(text)` occurrences in the normalized post body; keeps `max(1, occ)` per key), run on every `loadLocalData()` so existing local IndexedDB data is corrected too (no reseed/SEED_VERSION bump needed). Idempotent.
- Shipped to phone (`npm run deploy:web`, clean bundle) and desktop (v0.5.9 signed release; endpoint verified version 0.5.9).

## 2026-06-27 — Within-post dup cleanup for requests/analysis (v0.6.0) + full audit
- Extended occurrence-aware dedup: `dedupePostArrays()` in localData.ts removes exact within-post duplicate items from postAnalysis arrays + actionRequests + customBrackets on every load; cleaned the bundle posts.json (removed 46). Scan showed other categories essentially clean (Requests 45, Claims 1; Predictions/Entities/Themes/Conclusions/Hooks 0).
- Ran a full fresh-eyes code+UX audit (Fable 5 agent). Headline: `tsc` fails with 44 errors but deploys bypass it via vite build; heavy view-layer duplication (chart utils, highlighter, category colors, glossary constants); Dashboard hooks color still drifted (#eab308/#f43f5e vs unified #facc15); reader/entity path doesn't expand aliases via getAliasGroup; empty-term regex infinite-loop risk; per-keystroke full-store scans unmemoized in Analysis/Questions pages; AddRow defined in render (autofocus churn); dead code (Dashboard false-block + 7 orphaned handlers, PostArchive dead copies, unused @xyflow/react dep). Data core (localData/aliases/sync) is clean.

---

## v0.6.1 — Fresh-eyes cleanup pass (A + B + C)

**Request:** After a Fable-5 fresh-eyes audit, grouped issues into A (quick visible fixes), B (perf), C (consolidation / dead code / TS errors). User: "lets clean all this up a b and c."

**A — Visible fixes**
- Dashboard "Q Hooks" now uses the canonical yellow (`catColor('verificationHooks')` #facc15) — was mismatched.
- Alias-reader gap fixed: opening an alias reader now highlights the searched name **and** its whole alias group (e.g. HRC → Hillary Clinton), both in `highlightEntity` variants and the entity post-fetch (expands alias group + `getPostNumsContaining`).
- Highlight shade drift fixed: PostDetail and PostCard now share one color map, so the same tag looks identical in both views.
- Empty-term freeze guard: alias/entity highlight loops skip blank terms (was able to spin on an empty regex).

**B — Performance**
- AnalysisArchive & QuestionsArchive: memoized the per-keystroke full-store scans (`filtered`, `filteredOverlaps`, `totalScanned`, stats, month maps) with `useMemo` — no more re-scanning ~5k posts on every character.
- (Deferred) Hoisting `AddRow` out of PostDetail's render — the memoization above was the bigger win.

**C — Consolidation**
- New `src/lib/highlightConstants.ts`: single source for the glossary lists (`STATIC_ENTITIES`, `MIL_INTEL_TERMS`, `Q_SIGNATURES`), regex sources (`BRACKET_SRC`, `URL_SRC`), and the color map (`HIGHLIGHT_CLS`). PostDetail/PostCard import from it instead of keeping drifting local copies.
- Category colors routed through `categoryColors.ts` on Dashboard + AnalysisArchive; verified consistent across Sidebar / PostArchive / Questions / Brackets / Requests.
- Removed dead code: Dashboard `{false && …}` block + 7 orphaned handlers, PostArchive duplicate SearchBar/StatCard/chart-search, unused vars across QTripcodes/QBrackets/QRequests/PostDetail/PostCard, and the unused `@xyflow/react` dependency.
- Fixed all **44** TypeScript errors → **0**. Sidebar list now uses a proper `<Fragment key>`.
- Re-enabled type-checking in the deploy paths: `scripts/deploy-web.sh` runs `npx tsc -b` before the web build, and `build:app` is now `tsc -b && vite build` (Tauri's beforeBuildCommand) — so type errors can't silently regress again.

**Shipped:** web (gh-pages) + signed desktop v0.6.1 (updater `latest.json` verified live).

**Still available (not requested as part of A/B/C):** extract shared recharts tooltip/legend into a chart-utils component; hoist AddRow; add alias add/remove UI + a "disconnect alias" action to the PostCard editor.

---

## v0.6.2 — Per-alias highlight colors in the Entities reader

**Request:** "if there are multiple POTUS, 4, 10, 20, Q+ aliases can we make them all different colors within the entities section so we can see which post they are in, b/c you highlight the post the same color as the alias."

**Change:** In `highlightEntity` (the reader-feed highlighter), when the researched entity has 2+ aliases, each alias now renders in its own color from a 10-shade palette (`ALIAS_HL_PALETTE`) instead of every alias sharing one red. Implemented by giving each variant its own regex capture group (longest-first) so we can tell which alias produced each match and pick its color.

- `aliasColors` useMemo maps the current highlight's alias group → palette shades (recomputes on `aliasTick` so it updates when aliases load/change).
- Added a **color legend** at the top of the reader header (only shown when 2+ aliases) mapping each color chip back to its alias name.
- Single-name entities (no aliases) still highlight in the usual red — behavior unchanged.

**Shipped:** web (gh-pages) + signed desktop v0.6.2 (updater `latest.json` verified live).

---

## v0.6.3 — Per-alias colors on the Entities post-chip grid

**Request:** (follow-up to v0.6.2, which colored the reader feed) On the Entities cards, color each alias distinctly on the **post-number chip grid** — main name grey, 2nd alias blue, 3rd another color, etc. — and have the chip colors correlate to which alias each post used.

**Change (`AnalysisArchive.tsx`):**
- Added `CANON_CHIP` (grey) + a 10-shade `ALIAS_CHIP_PALETTE`.
- Per entity card, built `termColor` map: canonical name → grey, each alias → its palette color (by index).
- Each post chip is colored by the term that produced it (`termColor.get(term)`), replacing the old 2-state canonical-vs-any-alias cyan.
- The "also known as:" line now renders the canonical name + each alias as a matching colored swatch, so it doubles as the color legend.

**Shipped:** web (gh-pages) + signed desktop v0.6.3 (updater verified live).

---

## v0.6.4 — Entity alias-count fix + search alias highlighting

**Reports:**
1. Searching "4,10,20" (Post Archive) shows 2 exact posts (#35, #40), but the Entities → POTUS card only showed 1 in the alias color.
2. Post Archive search results didn't highlight the alias that caused a match, so it was unclear why a post matched.

**Cause of #1:** In the entity card, canonical `item.postNums` (POTUS) chips were built BEFORE alias chips. #35 contains both "POTUS" (as a named entity) and the literal "4,10,20", so canonical claimed it grey and the alias pass skipped it (already-seen dedupe) — leaving only #40 in the alias color.

**Fixes:**
- `AnalysisArchive.tsx`: build alias chips FIRST, then canonical fills the remainder. A distinctive alias now keeps its color even when the post also carries the canonical name; grey = canonical-only posts. Counts now line up with the Post Archive search.
- `PostCard.tsx`: `highlightText` expands the search keyword to its full alias group (`getAliasGroup`), so searching "4,10,20" highlights POTUS / Q+ / 4,10,20 wherever they occur in each result — showing why the post matched.

**Shipped:** web (gh-pages) + signed desktop v0.6.4 (updater verified live).

---

## v0.6.5 — Post Archive search color-codes aliases (matches Entities)

**Request:** Color-coordinate the aliases on the Post Archive search page too (like the Entities cards).

**Change:**
- New `src/lib/aliasColors.ts` — shared `CANON_CHIP` / `SEARCHED_CHIP` / `ALIAS_CHIP_PALETTE` + `assignAliasColors(members, anchor, anchorCls)`, so Entities and Post Archive color-code identically (an "anchor" term gets a fixed color; every other alias gets its own). `AnalysisArchive.tsx` refactored to import these instead of its local copies.
- `PostArchive.tsx`: added `postColor` memo mapping each result post → the color of whichever group member its text contains (searched term wins, then group order; date-only matches fall back to grey). Wired into:
  - the "Includes:" breakdown chips (now the color legend — searched term red, each alias its own color),
  - the quick-jump post-number chips (colored by which reference each post contains).

**Shipped:** web (gh-pages) + signed desktop v0.6.5 (updater verified live).

---

## v0.6.6 — Robust Back button (return to search/list without starting over)

**Request:** "Can we have a back button so I can go back to the previous screen so I don't have to start from scratch."

**Context:** Search state already persists to the URL (`?q=`) and PostDetail already had a subtle text "← Back". The real gaps: (1) the button was easy to miss; (2) the prev/next `#N →` buttons PUSHED history, so after browsing several posts one Back only stepped back one post instead of returning to the search; (3) on a direct link / refresh, `navigate(-1)` dead-ended.

**Changes:**
- `BackButton.tsx`: added a `fallback` route + history-index check (`window.history.state.idx`). When there's no prior entry (direct load/refresh) it navigates to the fallback instead of leaving the app.
- `PostDetail.tsx`: swapped the plain text back link for the shared `<BackButton fallback="/archive" />` (more visible, consistent with the other pages), and made the prev/next buttons use `navigate(..., { replace: true })` so stepping through posts doesn't grow history — one Back always returns to wherever you entered from (search results, Entities list, etc.).

**Shipped:** web (gh-pages) + signed desktop v0.6.6 (updater verified live).

---

## v0.6.7 — Connect aliases from the Post Archive "Edit Analysis" editor

**Request:** In the Post Archive, when you click "Edit Analysis," be able to click an entity (e.g. Trump) and add an alias (Q+, Donald J. Trump, …) that joins that entity's group — like the alias UI in other areas.

**Change (`PostCard.tsx`):**
- Ported PostDetail's alias UI onto the analysis chips in the inline Edit Analysis editor. Imported `addAlias` / `removeAlias` / `subscribeAliases`; added `aliasFor` / `aliasInput` state + an alias-tick effect so chips re-render (and highlights update) when the alias map changes.
- Each analysis chip now shows: existing aliases inline ("also: …" each with an × to disconnect, admin only), and a hover "🔤 alias" button that opens an inline input to add an alternate name. Submitting calls `addAlias(item, value)` → persists to localStorage + Firestore and syncs everywhere.
- Highlighting picks up new aliases immediately (search keyword + entity highlighting already expand via `getAliasGroup` / `getAliasesFor`). If a word is highlighted in the post, it pre-fills the alias box.

**Shipped:** web (gh-pages) + signed desktop v0.6.7 (updater verified live).

---

## v0.6.8 — Aliases merge into the whole group on connect

**Report:** Connecting "Trump" to "Q+" only linked Trump↔Q+ as a new 2-name group, instead of adding Trump to the entire existing group Q+ belongs to (POTUS · 4,10,20 · Q+ · Donald J. Trump · Donald).

**Cause:** `addAlias(canonical, alias)` always keyed a group by `canonical`, so connecting a loose entity to a name that's already an alias of another group created a separate `{trump: [Q+]}` group — with Q+ now living in two groups.

**Fix (`aliases.ts`):**
- Added `normalizeAliases()`: repeatedly merges any two groups that share a member (case-insensitive), keeping the larger group's canonical. A name can no longer live in two groups.
- `addAlias` now calls `normalizeAliases()` after adding, so connecting to ANY one member folds the new name into that whole group.
- Runs on module load (`if (normalizeAliases()) persistLocal()`) and after cloud merge (persists the healed map back to Firestore) — so the pre-existing Trump/Q+ split auto-heals and re-merges into the full POTUS group across devices.
- Verified with a simulation of the exact reported data: `{potus:[…,Q+,…], trump:[Q+]}` → single `potus` group with `trump` folded in.

**Shipped:** web (gh-pages) + signed desktop v0.6.8 (updater verified live).

---

## v0.6.9 — Pre-launch trim, category rename, and real source links

**Requests (one session):** remove Infographs / Storyline / Q School; keep Q Clusters
without its generate button; fix the miscolored hooks badge; rename "Verification
Hooks"; make source links point at the original boards instead of qalerts.app.

**Removals.** Infographs, Storyline, and Q School are gone — sidebar links, routes,
page files (`InfographViewer.tsx`, `StorylineGenerator.tsx`, `InfographCanvas.tsx`,
`QSchool.tsx`), and their claude.ts functions (`generateInfograph`,
`generateStoryline`, `askQSchool`). `reactflow` dropped from package.json (only
InfographCanvas used it) — bundle went 1,532,417 → 1,382,906 bytes. Left the
`infographId` field and `infographs` collection in place: inert, and removing them
would force a `SEED_VERSION` bump and re-seed of everyone's IndexedDB for no gain.

**Color bug.** `verificationHooks` is `#facc15` in `categoryColors.ts`, but
`PostCard.tsx` rendered its count pill in `rose`, and `AnalysisArchive.tsx:374` had a
ternary chain that fell through to `text-rose-400` for the only category it didn't
name — hooks. Both fixed; the ternary was replaced with a lookup that reads the color
out of `CAT_BADGE` so a new category can't silently render red.

**Rename + recolor.** "Verification Hooks" → **Checkable Claims**, yellow → **fuchsia
`#d946ef`**, across 11 files. Reason for fuchsia: five categories were crowded into
0–48° of hue (red/orange/amber/gold/yellow) with hooks and overlaps only 3° apart,
while 258°–360° was empty. Also had to widen a hardcoded color union in
`AnalysisArchive.tsx` and add a fuchsia accent to `TimeframeBreakdown.tsx`. The data
key `verificationHooks` is unchanged — display-only, no migration.

**Source links (`src/lib/sourceLink.ts`, new).** Posts already carried `source`,
`threadId`, and a deep `link`; only the sidebar footer said "qalerts.app". Verified
each domain live:

| Domain | Posts | State |
|---|---|---|
| `8ch.net` | 3,337 | Dead. 8kun did NOT keep the old thread numbers (`8kun.top/qresearch/res/884810.html` → 404) and `/patriotsfight/` + `/greatawakening/` don't exist there at all. |
| `8kun.net` | 326 | Domain doesn't resolve, but same path on `8kun.top` → HTTP 200. Simple rewrite. |
| `8kun.top` | 1,070 | Live, used as-is. |
| `archive.4plebs.org` | 233 | Live (403s to curl via bot protection; fine in a browser). |

`sourceLink()` normalizes the `8ch.net//thestorm/` double slash, suppresses links whose
path contains `undefined` (thread id never captured), rewrites `8kun.net` → `8kun.top`,
and routes dead `8ch.net` URLs through a Wayback Machine snapshot. Result across all
4,966 posts: **1,629 direct, 3,335 archived, 2 with no link possible.** Wired into the
`PostCard` header chip and the `PostDetail` header; archived links are marked 🗄 rather
than ↗ so readers know it's a snapshot. Sidebar footer now credits the original boards.

**NOT verified:** archive.org rate-limited (HTTP 429/403) during testing, so actual
Wayback coverage of those 3,335 threads is unconfirmed. Spot-check before launch — if
coverage is poor, the fallback should become a plain "original thread offline" note.

**Shipped:** nothing. All of the above is local only — `npm run deploy:web` not run.

---

## v0.7.0 — Read-only public build + item-text normalization

**Request 1:** "future proves past" shows 38 posts in search but only ×21 on the
Predictions tab. Is this an issue throughout the app?

**Diagnosis.** Two different measurements — 38 = posts whose raw text contains the
phrase; 21 = times it was extracted *as a prediction*. All 38 posts were analyzed, so
coverage was not the problem. Two real causes:

1. The frequency grouping key at `posts.ts` was `` `${cat}::${trimmed.toLowerCase()}` ``
   — case-insensitive but NOT punctuation-insensitive. So `Future proves past.` (×4,
   trailing period) sat as a SEPARATE row from `Future proves past` + `Future Proves
   Past` (=21). Notably `posts.ts` already stripped trailing punctuation in three other
   places, so line 855 was the outlier — an oversight, not a decision.
2. The same phrase was filed into three different categories across posts (26
   predictions / 15 claims / 4 checkable claims = 45 extractions over 38 posts). That is
   inherent to per-post AI classification; the ⚠ Overlaps tab exists to surface it.

**Fix — `normalizeItemKey()` in `posts.ts`,** now the single key for "the same phrase":
lowercase, strip all non-alphanumerics, collapse whitespace. Handles case, trailing
punctuation, curly vs straight quotes, `[brackets]`, `@handles`, and hyphen/underscore/
dot variants (`MS-13` = `MS_13`, `Ray.Chandler` = `Ray Chandler`).

**`+` is deliberately preserved as a word character.** Measured first: plain words-only
normalization merged `Q` with `Q+`, which are DIFFERENT designations in this archive.
Keeping `+` collapses 249 duplicate rows across all 4,966 posts while keeping those
apart. Verified the merge list — remaining merges are all correct (case variants,
`5:5?`/`5:5`, `[RR]`/`RR`, `@Snowden`/`SNOWDEN`).

Routed through it: frequency grouping, overlap detection, confirmation keys + doc ids
(these MUST match the grouping key or ✓ ticks orphan), and both AnalysisArchive search
filters — so search is now words-only too. Result on the reported case: predictions for
that phrase **21 → 25**, claims 14 → 15.

**⚠ Caveat:** existing `analysisConfirmed` entries were keyed with the old
normalization. A handful of ✓ confirmations may need re-confirming.

**Request 2:** finish the read-only public build.

`src/lib/appMode.ts` exports `IS_PUBLIC_SITE` / `CAN_EDIT` from `VITE_PUBLIC_SITE`,
which `scripts/deploy-web.sh` now sets to `1`. Gated every editing surface in
`PostDetail.tsx` and `PostCard.tsx`: the detect/classify/analyze action bar, topic chips
and `+ topic`, the news-research button and its PIN gate, article remove/rate/notes
controls, all four bulk "apply all" chips, bracket exclude/restore, and question delete.
`AdminContext` no-ops `requireAdmin` and never renders the PIN prompt when `CAN_EDIT` is
false. `ADMIN_PIN` moved to `VITE_ADMIN_PIN`. Post detail title reads **"Qpost #N
Editing"** on the desktop build, plain "Post #N" publicly. Readers still see the recorded
credibility verdict and notes on correlated articles — just not the controls.

**GOTCHA WORTH REMEMBERING — the first attempt did not actually work.** `canEdit` was
read from React context, which is a runtime value Rollup cannot fold, so the public
bundle still contained every edit control AND the admin PIN. The UI hid; the code
shipped. Fix: import `CAN_EDIT` directly in components so `false && <jsx>` is statically
eliminated. Verified both directions:

| String | Public bundle | Desktop bundle |
|---|---|---|
| "Edit Analysis" / "Detect Questions" / "Analyze Post" | absent | present |
| "Admin PIN required", `"1624"`, `162424` | absent | present |
| "Qpost #" / "Research news" / "apply all" | absent | present |
| "Post Archive" / "Checkable Claims" / source links | present | present |

Public bundle 1,366,056 bytes vs desktop 1,379,698.

**Shipped:** nothing. `npm run deploy:web` not run — the live site is still the old build.

---

## v0.7.1 — Category counts mean "posts containing the phrase", clickable chips

**Report:** search finds 38 posts with "future proves past" but Q Predictions shows ×25.
"If it has the exact phrase I want it listed in that section."

**Change — text backfill in `getAnalysisFrequency`.** Category items now include every
post whose TEXT contains the phrase, not only the posts where the AI happened to tag it.
`count` changed from extraction-occurrences to `postNums.length`. Predictions for that
phrase: **25 → 38**.

**Performance.** Brute force (30,981 items × 4,966 posts = 153.8M substring tests) measured
**26.7s** — unusable in a browser. Replaced with an inverted word index: take the phrase's
RAREST word, substring-check only the posts already known to contain it. **~450ms**, 309K
checks. Index build is 130ms.

**TWO BUGS CAUGHT BY MEASURING — do not remove these guards:**

1. *Substring vs word boundary.* Naive `text.includes(key)` matched the letter "q" inside
   "question": the Checkable Claims entry for "Q" went 68 → **4,328** posts. Fixed by
   space-padding both sides (` ${text} `.includes(` ${key} `)).
2. *Short/common single tokens.* Even with boundaries, "WHO" the organization is
   indistinguishable from the question word (8 → 493), and "EM" from the syllable
   (2 → 1,445). Backfill is skipped for single tokens that are ≤2 chars or in
   `SCAN_STOPWORDS`. Verified after fix: Q 68→68, WHO 8→8, EM 2→2. "Twitter" 142→962 is
   correct — the word genuinely appears in 962 posts.

**Alias folding.** A chip now counts the PERSON, not the string. Backfill matches the
phrase plus every spelling from `getAliasGroup()`. Before this, "HRC" read 113 while
searching "hrc" returned 140 — search already expanded aliases, so one number had two
answers. The 27-post gap was posts that say "Hillary" but never "HRC". Note the exact
figure depends on the alias map loaded at runtime (localStorage/Firestore), not on
`posts.json`, so it can't be verified from the data bundle alone.

**Clickable chips.** In the Post Analysis panel the phrase and its ×N badge are now
`Link`s to `/posts?q=<phrase>` — click "HRC" or "×113" to open every post containing it.

**Also fixed:** the v0.7.0 normalization broke PostDetail's frequency lookups, which
still keyed on `.toLowerCase().trim()` and no longer matched the merged group keys —
some ×N badges would have silently disappeared. All four sites now use
`normalizeItemKey`.

**Dev preview:** added `npm run dev:public` / `preview:public` + `.env.public` so the
read-only build can be previewed without fighting PowerShell-vs-bash env-var syntax.
Sidebar footer now lists all nine original boards instead of "qalerts.app".

**Shipped:** nothing. Still local only.

---

## v0.7.2 — Backfill for Requests/Questions, search-filtered charts everywhere

**Report:** "Enjoy the show" → 69 posts in search, 66 under Requests.

**Cause:** v0.7.1's backfill only touched `getAnalysisFrequency`. Requests and Questions
are separate code paths with their own grouping and never got it — same bug, three
implementations.

**Fix:** extracted `buildTextIndex` / `postsContainingPhrase` / `backfillFromText` into
`lib/posts.ts` and pointed all three at them, so the Q / WHO / EM guards live in ONE place
instead of three copies waiting to drift. Both switched to `normalizeItemKey`, merging
22 duplicate request rows and **162** duplicate question rows. "Enjoy the show" as a
Request: **66 → 69**.

Deliberate difference: Questions and Requests do NOT fold aliases. Aliases are an entity
concept — a question isn't a different question because a name inside it is spelled
differently. Only entity chips expand aliases.

Known limitation: on Q Requests the backfill is skipped when a month bar is selected,
because the backfill spans the whole archive and would pull in posts outside that month.
Month-filtered counts stay extraction-only.

**Search-filtered charts.** PostArchive, QuestionsArchive and Dashboard each had their own
copy of this; `lib/chartSearch.ts` is now the shared version (`monthCounts`,
`gradientColor`, `NO_MATCH_GREY`) and it was added to the three that lacked it —
**AnalysisArchive, QRequests, QBrackets**. While a search is active the chart swaps its
category series for a `matches` series: bar height is the match count for that month,
colored green→red by density, with the title and legend following. All six pages now
behave the same. `gradientColor` is still duplicated in PostArchive/QuestionsArchive/
Dashboard — worth collapsing onto the shared one next time those files are touched.

**Shipped:** nothing.

---

## v0.7.3 — Rare search hits are visible on the timeline

**Report:** searching a term that appears only 2–3 times draws bars too small to see
(screenshot: "berman", 3 matching posts).

**Cause:** the match series shared the left Y axis with the total-posts series, which
scales to ~400. A 2-post month is ~0.5% of the axis height — not small, invisible.

**Fix, two parts:**

1. **Independent axis.** Matches now render on their own hidden right-hand axis with
   `domain={[0, searchMatchMax]}`, so the tallest match month fills the plot regardless of
   how few hits there are. Every other series moved to `yAxisId="left"`. Also
   `minPointSize={3}` so a single hit still paints something.
2. **`MatchCountLabel`** (in `lib/chartSearch.tsx`) — a small red downward pointer with the
   count above each match bar, per the user's suggestion. Makes a 1-hit month
   distinguishable from a 3-hit month at a glance without hovering. Zero-match months draw
   nothing.

Applied to AnalysisArchive, QRequests, QBrackets. `chartSearch.ts` → `.tsx` since it now
contains JSX.

**Not applied to** PostArchive / QuestionsArchive / Dashboard — those use a different
design (they tint the full-height total-posts bar by match density rather than drawing a
separate short bar), so they never had the visibility problem. Worth revisiting for
consistency, but not broken.

**Shipped:** nothing.

---

## v0.7.4 — Flag an issue from the bottom of a post

**Request:** let readers flag a problem at the bottom of a Q post, feeding the same
comments/ideas pipeline.

`components/FlagIssue.tsx` — collapsed by default as a dashed "🚩 Flag an issue with post
#N" strip so it never competes with the post; expands to three kinds (Wrong analysis /
Broken / Something else), a message box, and an optional contact.

Key points:
- Writes to the SAME write-only `feedback` collection as the Comments & Ideas page — one
  inbox, not two — but pre-tagged with `postNum`, so a report can never arrive without
  saying which post it is about.
- **NOT gated on CAN_EDIT.** Reporting is the one write the public build is meant to make.
  Verified in the public bundle: "Flag an issue with post" present, while "Edit Analysis",
  "Admin PIN required" and "Qpost #" remain absent.
- `/feedback?post=1543` now pre-fills the post number too, so anything that prefers to
  hand off to the full page carries the context instead of asking the reader to retype it.

No new Firestore rule needed — it uses the existing `feedback` create rule documented
above, `postNum` included in the `hasOnly` list.

**Shipped:** nothing.

---

## v0.7.5 — Always show ×1, and make the header tally match the rows

**Report:** "Named Entities says 1155 repeated · 1193 found once, but scrolling shows way
more names listed once."

**The tally was actually right.** Verified against the bundle: 2,348 distinct
namedEntities groups, 1,154 with one post and 1,194 with more — matching the header's
2,348 total (±1 from alias data that only exists at runtime).

**Why it looked wrong:** the ×N badge only rendered when `chips.length > 1`, so all ~1,194
single-post rows had NO badge and sort last. The bottom of the list was an unbroken run of
badge-less rows, which reads as far more than the number claims. The badge is now always
rendered, ×1 included, dimmed rather than hidden so it stays visually secondary. Q Requests
and Q Brackets already did this; only AnalysisArchive hid it.

**A real bug the question exposed:** `tabStats` counted `items` WITHOUT the alias-fold and
month filters that `filtered` applies to the list. So the header tallied rows the list then
hid, and the numbers could never add up to what was on screen. It now applies the same
filters (minus search, since the header describes the whole category) and recounts on
`aliasTick` when an alias changes elsewhere.

**Shipped:** nothing.

---

## v0.7.6 — Section totals, rank numbers, colored tooltips, label headroom

- **Total above each section title.** `2,348 total` in large type above "Q Named Entities",
  with repeated/once as the breakdown below. Added to all six analysis tabs, Q Requests and
  Q Questions. Q Brackets / Q Links / Q Post Pics / Q Tripcodes already showed their own
  totals and were left alone. Derived from the same filtered set as the breakdown, so a
  selected month narrows all three numbers together.

- **Rank numbers.** Each row shows its position in the current list (#1 = most-referenced —
  e.g. Twitter ×962 at Named Entities #1). Follows the active sort, search and month filter.
  Added to AnalysisArchive, QRequests, QBrackets, QuestionsArchive. Questions has two lists
  (repeated, then singles) so the rank runs continuously across both rather than restarting.

- **Tooltip rows tinted to match their bars.** Recharts hands a tooltip the `name` prop from
  each `<Bar>`, not its data key, so tooltips need a display-name lookup — added
  `SERIES_COLOR` / `seriesColor()` to `categoryColors.ts`, derived from `CATEGORY_COLOR` so
  it cannot drift. Removed TWO duplicate colour sources while doing it: Dashboard's private
  `CATEGORY_COLORS` map, and PostArchive's hardcoded bar fills (`fill="#f59e0b"` etc.) which
  are now `catColor(...)`. Hardcoded hexes in charts are exactly what produced the earlier
  rose-vs-yellow hooks bug.

- **Count markers no longer clipped.** The busiest month's match bar reached the exact top of
  the plot, so its label — drawn ABOVE the bar — was cut off, meaning the highest number was
  the only unreadable one. `matchAxisMax()` adds 30% headroom (tallest bar lands ~75% height)
  and `margin.top` goes to 22 while searching so there is somewhere to draw it.

**Shipped:** nothing.

---

## v0.7.7 — Questions chart matches the others; duplicate counts removed

**Questions page chart** was the last one on the OLD design: it tinted the existing
posts/questions bars by match density instead of drawing a dedicated match series. A rare
term therefore showed up as a shade of an unrelated bar rather than a readable value.
Converted to the shared pattern — `matches` series on its own right-hand axis,
`MatchCountLabel` markers, `matchAxisMax()` headroom, legend swap. AnalysisArchive,
QRequests, QBrackets and QuestionsArchive are now identical. Also deleted the file-local
`gradientColor` copy in favour of the shared one (Dashboard and PostArchive still have
their own copies — they use the tint design and were left alone).

**Duplicate counts removed.** Each card showed `×N` in the section colour AND "N posts" in
grey underneath.
- Q Requests: `count` IS `postNums.length` since v0.7.2, so the grey line was pure
  duplication → removed, kept as a title tooltip.
- Q Brackets: NOT duplication — `count` is total occurrences (a code can repeat within one
  post) and differs from post count on **118 of 1,478 codes (8%)**. Rather than drop a real
  metric, the big number now shows POSTS (consistent with every other section) and the
  occurrence count moved into the tooltip, shown only when the two differ.

**Shipped:** nothing.

---

## PUBLIC LAUNCH — parked decisions & pre-launch checklist

**Status:** NOT LAUNCHED. Nothing below is implemented yet. Revisit before making the
site public to a general audience.

### 📌 Decisions locked

- **Domain: `qdrops.app`** — chosen Aug 10 2026. No DNS record at time of checking, so
  likely unregistered; confirm at a registrar. ~$12–20/yr, free to point at GitHub
  Pages. On purchase: set `base` back to `'/'` in `vite.config.ts` (the
  `/q-archive-app/` subpath goes away), add a `CNAME` file to the `dist` publish, and
  enable HTTPS. `.app` is HSTS-preloaded so HTTPS is mandatory — GitHub Pages handles it.

- **🔴 DASHBOARD IS THE LAST THING TO PULL.** Keep the Dashboard in the public build
  FOR NOW at the user's explicit request. Removing it from the public bundle is the
  FINAL step before going live — do not do it early. When the time comes: drop the
  `/dashboard` route + sidebar link behind `CAN_EDIT` in `App.tsx` / `Sidebar.tsx`.
  Until then it ships publicly, and the public admin PIN caveat below still applies.

- **Editing model:** public build = read-only, no editing UI compiled in. The editable
  "carbon copy" is the Tauri desktop build — same source, `CAN_EDIT` true, every
  section editable in place. NOT a PIN-gated admin mode inside the public bundle: any
  PIN shipped to the browser is readable (see blocker #2), so that would re-introduce
  the exact hole we are closing. Editing from a phone would require real Firebase Auth,
  not a PIN — deferred.

### 🗣 Dashboard / admin-mode discussion — PARKED, resume later

User's proposal: make Dashboard an admin entry point — enter the PIN and get a "carbon
copy" of the whole site with editing enabled, while the public sees read-only.

**Why the goal is right but the PIN mechanism isn't:** to unlock an editable copy on the
public site, the editing code has to already BE in the public bundle — that is what
unlocking means. The PIN is then just a string comparison the visitor's own browser runs.
Proven concretely: the old `ADMIN_PIN = '1624'` was readable in the live published JS.

**What we built instead:** the editable carbon copy is the Tauri desktop build. Same
source files, same sections, editing in place — `CAN_EDIT` true. The public build sets
`VITE_PUBLIC_SITE=1` and the editing code is never compiled in. Verified by string
search on both bundles (see v0.7.0 entry).

**The one real trade-off:** no editing from a phone via the qdrops.app link, because
there is no login. Fixing that properly means Firebase Auth (a real account), which
would also solve the database side. Deferred until after launch.

**Still undecided (user will choose at the end):** whether Dashboard is removed from the
public build entirely, or kept behind a login. Until then it ships publicly — see the
🔴 reminder above.

### 🚨 SCALE BLOCKER — Firestore reads will fail before ~100 visitors/day

**Measured Aug 10 2026: the Firestore free-tier quota is ALREADY EXHAUSTED** — every REST
call returns `429 RESOURCE_EXHAUSTED / Quota exceeded`, with only the developer using it.
This is not a launch-day risk, it is a today problem.

**Cause:** `loadLocalData()` → `applyCloudOverrides()` → `fetchOverrides()` runs on EVERY
page load and does:

    getDocs(collection(db, 'postEdits'))       // sync.ts:62
    getDocs(collection(db, 'questionEdits'))   // sync.ts:63
    getDoc(doc(db, 'app', 'aliases'))          // aliases.ts:156

Firestore bills **one read per DOCUMENT returned**, not per query. So each visitor costs
`postEdits + questionEdits + 1` reads. Spark (free) allows 50,000 reads/day — if those
collections hold ~500 docs between them, that is **~100 visitors per day** before the whole
site stops loading cloud data for everyone.

**Fix (recommended): the public build must not read Firestore at all.** Bake the edits into
`public/data/*.json` at deploy time via `scripts/export-firestore.mjs`, and skip
`fetchOverrides()` / `loadAliasesFromCloud()` when `IS_PUBLIC_SITE`. Reads drop to ZERO,
the site scales without limit, and it costs nothing. Cross-device sync stays in the desktop
build where it belongs.

**Fallback if live sync is wanted publicly:** collapse `postEdits` + `questionEdits` into
ONE document each (the way `app/aliases` already works) — 3 reads per visitor instead of
~500, ~16,000 visitors/day on the free tier.

**Do NOT just upgrade to Blaze to make it go away.** It converts a hard stop into an
unbounded bill, and with rules still open a scripted read loop could run one up deliberately.

### 📦 GitHub Pages is NOT the bottleneck (measured)

Fresh visitor downloads **2.3 MB gzipped** (398 KB JS + 1,468 KB posts.json + 447 KB
questions.json + misc; 9.3 MB raw). Against the 100 GB/month soft bandwidth limit that is
**~44,600 fresh visitors/month**. Repeat visitors cost almost nothing — the archive is
cached in IndexedDB by `SEED_VERSION` and the JS is browser-cached.

So Pages supports roughly **450× more traffic than Firestore currently does**. Note Pages
soft limits are advisory and GitHub may throttle or make contact if greatly exceeded; it is
also not intended for commercial use.

### ⛔ Blockers — must be fixed before launch

1. **Firestore rules are wide open.** Project `q-app-2ce0a`, database `default`.
   Verified with unauthenticated REST calls: read = 200, write = 200, delete = 200.
   Anyone can read, overwrite, or delete `posts`, `questions`, `postEdits`,
   `questionEdits`, `infographs`, `storylines`, `app/aliases`. Because
   `fetchOverrides()` (`sync.ts`) merges `postEdits` into every visitor's view,
   injected text would display to all visitors as if we wrote it.
   → Fix: lock rules to `read: true` / `write: only owner UID` (needs Firebase Auth),
   or deny writes entirely. Back up via `scripts/export-firestore.mjs` first.

2. **Both admin PINs are public.** `ADMIN_PIN = '1624'` (`AdminContext.tsx:6`) and
   `AI_PIN = '162424'` (`PostDetail.tsx:20`) compile into the shipped JS. Confirmed
   present in the LIVE bundle at kck321.github.io. Any client-side secret is not a
   secret. → Remove from source; strip admin/Dashboard code from the public build.

3. **Bulk operations are the highest-risk surface.** `PostDetail.tsx` lines 906 / 924 /
   941 / 945 fan one click out across thousands of posts. With public PINs + open
   rules this is a one-click mass-defacement button on the live site.

4. **`.env` is not in `.gitignore`** and holds the live Anthropic key. Currently safe
   only because `main` holds just README.md. MUST be gitignored before ever pushing
   source — including before making the repo "100% open source" as the blurb claims.

### ✅ Verified safe (re-check if the build changes)

- Anthropic API key is NOT in the web bundle — `.env.production` blanks it, and the
  key resolves at runtime only inside Tauri. `dist/` greps clean for `sk-ant-`.
- Public repo `kck321/q-archive-app` exposes no source: `main` = README.md only,
  `gh-pages` = built site only. Deploy script force-pushes fresh history each time.
- All five AI tabs are button-triggered, never automatic on page load.

### 🔐 Firestore rules the app now NEEDS (write these when locking down)

The feedback drop box is the ONLY thing on the public site that writes to the database.
Its rule must allow `create` and nothing else — no read, no update, no delete — so there
is no public comment wall, nothing to deface, and no route from feedback to the research
data. Field caps must be in the RULE, not just the form; client-side limits are a
courtesy, not a control.

    match /feedback/{id} {
      allow create: if request.resource.data.keys().hasOnly(
                         ['kind','message','contact','postNum','createdAt'])
                    && request.resource.data.message is string
                    && request.resource.data.message.size() > 0
                    && request.resource.data.message.size() < 2000
                    && request.resource.data.contact.size() < 200;
      allow read, update, delete: if false;
    }
    match /{document=**} {
      allow read: if true;
      allow write: if false;      // tighten to owner-UID once Firebase Auth exists
    }

Read submissions in the Firebase console → Firestore → `feedback`.
Spam risk: an open `create` rule can be scripted against. Firebase App Check
(reCAPTCHA) is the fix if it becomes a problem; until then expect some junk.

### 💰 Donations — crypto only (decided Aug 10 2026)

**DECIDED:** crypto wallet addresses only, most common coins, to be tweaked over time.
No Ko-fi / PayPal / Stripe / GitHub Sponsors — chosen partly because no processor can
deplatform a wallet address.

**⚠️ ACTION REQUIRED BEFORE LAUNCH:** addresses are EMPTY in `src/lib/donations.ts`.
Scaffolded coins: BTC, ETH, SOL, XMR, LTC, USDT. A coin with an empty address is hidden
from the page entirely and the page shows a "no wallets configured" notice — deliberate,
because publishing a placeholder address would send real money to a wallet nobody
controls and crypto transfers cannot be reversed. Paste each address from the wallet
itself; never retype one.

### 💰 Donations — original options survey (superseded by the decision above)

Static site on GitHub Pages = no backend, so payment must be handled by an external
processor we link out to. **Never build a card form on our own page** (PCI scope).

| Option | Notes |
|---|---|
| Ko-fi / Buy Me a Coffee | Purpose-built, minutes to set up, handles receipts + recurring |
| Stripe Payment Links | Hosted checkout, plain `<a href>`, ~2.9% + 30c, needs business/bank details |
| GitHub Sponsors | Fits the open-source framing, no fees, ties to the repo |
| PayPal.me | Lowest friction, widely trusted |
| Crypto address + QR | No intermediary, no deplatforming risk |

**Operational risk:** payment processors enforce acceptable-use policies, and
Q-adjacent projects have had accounts closed by mainstream processors before. Do not
build funding on a single processor — set up two independent paths (e.g. Ko-fi +
crypto) and read the AUP before investing time in either.

### Other decisions made (not yet implemented)

- **Intro blurb:** approved wording — "An Open Archive for Q Research / This is an early
  build - rough in places and far from finished. The goal is a tool anyone can use to
  study the Q operation on their own terms: every post, searchable, cross-referenced,
  and open source from top to bottom. It gets better faster with more eyes on it. Found
  a bug, a gap, or a better way to organize something? Tell me below. Thanks for
  stopping by."
- **Remove tabs:** Storyline, Infographs, Q School. (`infographs.json` and
  `resources.json` are both 2 bytes = empty arrays — Resources is a removal candidate
  too.) OPEN QUESTION: remove from the public build only, or from the desktop app too?
- **Q Clusters:** keep the page, remove the "Generate Chapters with Claude" button
  (`Topics.tsx:93` + `handleCluster`). Page still works — `getTopics()` reads the
  34KB `topics.json` bundle independently of the generate path.
- **Dashboard:** recommended to strip from the public build entirely rather than add
  2FA. It needs the API key, which only resolves on desktop, so the public loses
  nothing. Stronger than any client-side gate and less work.
- **2FA:** Firebase's free tier has no MFA. SMS/TOTP second factors require upgrading
  to Google Cloud Identity Platform (Blaze plan). Only meaningful once rules enforce
  server-side; a strong unique password + locked rules gets ~95% of the benefit.
- **Comments/suggestions box:** design as a write-only drop box — visitors can `create`
  into a `feedback` collection with field validation + length caps; read/update/delete
  denied to everyone. No public comment wall to moderate. Spam mitigation = Firebase
  App Check. Zero-risk alternative: embed a Google Form or use `mailto:`.
- **Analytics:** Firebase Analytics (GA4, already in the stack, free, supports custom
  events but cookie-based + heavily ad-blocked) vs Cloudflare Web Analytics (free, no
  cookies, no consent banner, far less blocked, but traffic only — no custom events).
  Could run both. GitHub Pages provides no server logs.


---

## Reference recovery — quoted post content (Aug 11, 2026)

**Request:** "i see post 2124 on qalerts holds all the data, our sight only holds the pic" /
"i want to fix all the post that are like this that are missing the correct data. and lets
fix whatever else we need to for 3."

**Problem.** The `references` field was destroyed at ingest — every entry is the literal
string `"[object Object]"`, in Firestore too, so re-exporting could not recover it. 1,586
`>>NNNNNNN` pointers across 1,547 drops rendered as bare numbers, and 211 drops were nothing
but a pointer, showing as blank rows. #2124's entire body is `>>2950820`.

**Why the boards could not supply it.** 8ch.net is gone. 8kun.top 302s every one of those old
thread ids to its index — tested, not assumed. qalerts' public `posts.json` has no reference
field either. But qalerts *server-renders* the quoted post inside each drop's card, so one
page fetch per referencing drop recovers author, tripcode, device ID, board link, text and
images.

**Built.**
- `scripts/scrape-references.mjs` — 1,547 fetches, concurrency 4, resumable, `--only N` to
  check selectors. Result: 1,468 references, 0 failures.
- `scripts/apply-references.mjs` — merges into `posts.json` as `quotedPosts`, walking the
  reply chain so #2124 -> #2123 -> the anon who says MOSSAD is recovered too.
  **2,715 quoted posts, 514,903 characters, 828 carrying images.**
- `src/components/QuotedPosts.tsx` — renders the chain; anything past one hop folds away.
- `src/lib/references.ts` — resolves a pointer to a Q drop we already hold, used as the
  fallback where the scrape came up empty and to link a quoted drop through to its post page.

**Results.**
- 205 of the 211 blank rows now have content.
- #1, the very first drop, now shows the anon it was answering ("Hillary Clinton will be
  arrested between 7:45 AM - 8:30 AM EST on Monday…").
- MOSSAD search: was 2 posts, qalerts had 4. Full-chain indexing gave 6; depth <= 1 gives
  exactly qalerts' four — #1489, #2104, #2123, #2124.

**Two traps handled.**
- The Firestore dump overwrites `posts.json` wholesale, so `export-firestore.mjs` now
  re-applies the references and **aborts if `scripts/.cache/references.jsonl` is missing.**
  That file is committed — it is the only copy of this data.
- `SEED_VERSION` bumped to 2, or returning visitors keep their old IndexedDB copy forever.

**Parser bug worth remembering:** walking back from a nested card header with
`lastIndexOf('<div class="card')` matches `card-header` too, so it sliced the header instead
of the card and every post parsed as zero references. The trailing space fixes it.

**Deliberately NOT done:** quoted text is kept out of the analysis index. 52% of it is anon
words and must not become Q's questions, claims or predictions.
