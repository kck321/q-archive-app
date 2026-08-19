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


---

## Truth audit vs qalerts + clickable links (Aug 12, 2026)

**Request:** "i want all the post to be true throughout this whole app… why do i not see the
whole post for 2124? i also want any links within the post that are links to be clickable"

### Full field-by-field audit
Joined all 4,966 posts against qalerts' own `posts.json` on **board + post id** (host-agnostic;
matching on the bare `#anchor` is WRONG — post ids collide across /qresearch/, /cbts/ and /pol/,
which produced ~97 phantom diffs).

Result: **text identical on all 4,966. Tripcodes identical. Timestamps identical.** The only
divergence was media — and ours was the wrong one.

### What the audit found (all fixed)
- **475 attachments recorded from a Tor `.onion` mirror** plus 57 from `media.8kun.top`, all
  protocol-relative and unloadable in any browser. **298 posts had no other copy, so their
  images simply never appeared.** qalerts mirrors them under the same content hash (verified
  200, 1.5 MB), so `mediaUrl` now rewrites *any* `file_store/<hash>` URL whatever host
  recorded it.
- **82 posts recorded the same image twice** — once live, once on a dead mirror — rendering
  as the image followed by a broken copy of itself. `dedupeMedia()` collapses them *after*
  rewriting, since both then resolve to the same URL.
- **PostCard rendered no images at all**, so a search result never showed the attachment even
  when the image WAS the post.

Every attachment now resolves to a live host: 1,976 qalerts, 26 4plebs, 1 archive.fo.
**Zero onion, zero dead.**

### Why #2124 still looked wrong
The quoted content was rendering on the post page but not in the results list, and the reader
feed mapped posts to a trimmed shape that dropped `quotedPosts` entirely. Both fixed; results
now bucket three ways (Q's own words / in the post being replied to / alias), because #2124
was sitting under a divider claiming it did not contain the search term when it does — in the
post it replies to.

### Clickable links
`src/lib/linkify.tsx` runs over the **result** of the highlighters, not the raw text, and
recurses into their elements — Q puts URLs inside lines that get highlighted as claims, so a
top-level-only pass would leave most links dead. Applied to the post body, search/browse
cards, the reader feed and quoted text. Links carry `rel="noopener noreferrer nofollow"`.

**Audit script kept:** the join-key logic is the reusable part — re-run it after any ingest
change to prove the archive still matches the source.

## Q Emphasis — certified (section 8 of 8)

**Request:** Certify the final classification section. Narrow definition; caps must not become
everything; cryptic messaging must not become "Emphasis". Ambiguous cases route to /resolve.

**Certified:** 5,251 occurrences across 1,737 posts, nine device types.
Capitals 2,418 · Parallel phrasing 1,111 · Bracket emphasis 716 · Quoted word 624 ·
Punctuation intensity 157 · Repeated word 118 · Repeated question 95 · Repeated directive 11 ·
Deliberate spacing 1. 245 arguable cases held in the Resolution Center, not forced into the count.

**The two rules that made it defensible, both measured from the corpus rather than declared:**

1. *Capitals are emphatic only where they CONTRAST* — with the surrounding line (a caps word
   inside an all-caps line is Q's register, 7,839 excluded) and with the word's own usual
   spelling. DECLAS is capitalised in 90 of its 95 appearances, so its capitals are how the word
   is spelled; FAKE is 207 of 284, so its capitals are a choice. That second test excluded 1,239
   and needed no word list. Certified entity names and codes are excluded too — a name in
   capitals is a name.
2. *Parallel phrasing needs a repeated rhetorical pattern, not a shared first word.* v1 emitted
   one hit per adjacent pair, so a five-line cascade became four hits: 2,187 emissions were
   really 1,339 runs. Counting runs and requiring a structural pattern took it to 1,111.

**Bugs found by reading output, not by tests:**
- A Python heredoc wrote literal backspace bytes (0x08) where the regex meant `\b`, so the
  always-caps word test matched nothing and silently excluded zero. Use the editor for regexes.
- The first classifier scored `Missing 10 marker from past. / Missing 15 marker from past.` as
  weak because it only looked at shared prefix. Slot-level mirroring was invisible to it.
- `What happened to Diana? / What did she find out?` was landing in the reject bucket. The
  discriminator is topical continuity (Diana -> "she"), not the opener.
- SEED_VERSION was still 4 while Directives, Claims and Emphasis had all rewritten posts.json
  since. Returning visitors would have kept the stale seed. Bumped to 5.

**Chain:** audit-emphasis.mjs + apply-emphasis.mjs added to export-firestore.mjs after
apply-codes.mjs (the caps detector reads certified codes and entities) and before
build-resolution-queue.mjs (which reads the borderline file). 14 QA assertions, all executable.

**Live QA:** emphasis 5,251/1,737 with subtypes reconciling exactly and 0 parallel occurrences
missing their basis; codes 1,949/852, entities 1,332/4,463, themes 2,393/1,766, evidence
6,590/3,883, claims 4,181, predictions 630, directives 2,422 all unchanged; queue 2,527
(1,858 entity + 251 theme + 173 code + 245 classification).

All eight analytical sections now certified.

## Whole-app cross-section integrity audit

**Request:** Before adding any ninth category, validate the deployed system as a whole: does every
certified occurrence resolve to the correct Q-authored source, carry the right provenance, overlap
only where intended, and reach both first-time and returning users?

**Built:** `scripts/lib/contracts.mjs` (machine-readable provenance contract per section),
`scripts/audit-cross-section.mjs` (80 executable invariants in 11 groups),
`scripts/certification-manifest.mjs` (hashes + counts + seed version, with `--verify`).
Deliverables: `audit/cross-section-integrity.md` / `.json`, `audit/certification-manifest.json`.

**80/80 invariants pass.** All eight sections frozen; nothing reclassified.

**Real defects found and fixed:**
1. *Resolution Center id collision.* `[2]`, `[#2]` and `[+2]` are three different codes whose keys
   all collapse to `code-_2_` when non-word characters become underscores. Six rows shared five
   ids, so a community submission could attach to the wrong code. Ids now carry an index.
2. *Entities metric boundary undeclared.* The certified 4,463 counts alias-resolved mentions of
   the 93-entity core registry; the 1,239 adjudicated tail entities carry a further 3,440, so
   summing every shipped row gives 7,903. Neither number is wrong — they measure different
   populations — but nothing said so. Now declared in the contract, in sectionInfo and on /method.

**Four failures that were the audit's own errors, not the data's** — each worth recording because
each is a way an integrity check can lie:
- Measured the Question/Directive overlap with whitespace-lowercase from the question side and got
  167; the certified 228 is measured from the directive side with the canonical `key()` plus
  `directiveSource`. Same fact, three different numbers depending on definition.
- Counted conclusions per `claimMeta` key (960) rather than per occurrence (966). The meta map is
  keyed by normalised text, so six in-post repeats shared an entry.
- Tested parallel-phrasing occurrences against their joined `line` field, which is a display
  reconstruction rather than a span, so all 1,111 looked unresolvable.
- Compared a 16-char truncated hash against the manifest's full digest and reported all eight
  artifacts as drifted on a tree that had not changed.

**Finding kept as a risk, not fixed:** `sourceLines()` over-extends quoted blocks on 123 posts. In
#1939 a quoted sentence and its URL are followed by five lines that are unmistakably Q's and the
block swallows them. The certified sections are right; the detector is wrong. Direction matters:
Emphasis excludes source lines, so it UNDER-counts there — nothing phantom is admitted. The
invariant now freezes the disagreement at its known size (102 questions / 71 directives / 147
claims) so any future change that makes the detector claim more Q-authored text fails the gate.

**Byte drift vs semantic drift** are now reported separately. Every deploy re-runs the full export
chain, so posts.json comes back re-serialised with identical content; the manifest carries both a
byte hash and a key-sorted semantic hash, and only semantic drift fails.

**One command to check everything:** `node scripts/certification-manifest.mjs --verify`

## Entity metric ruling + source-boundary debt recorded

**Ruling applied:** the Entities headline is now the whole finished section —
**1,332 canonical entities · 7,903 resolved mentions** — with provenance kept underneath:
93 core-registry entities / 4,463 mentions, 1,239 adjudicated-tail entities / 3,440 mentions.
A metric-definition change, not a reclassification: no entity, mention or type moved. The old
4,463 stays as `coreRegistryMentions`, because it is how the section was built.

Changed in one pass so the definition cannot drift: `apply-entities.mjs` (headline recomputed from
the rows + three new QA assertions incl. submetrics-reconcile-to-headline), `lib/contracts.mjs`,
`certification-manifest.mjs` (records all three figures), `sectionInfo.ts`, `/method` (shows the
two-population breakdown), and the integrity gate.

**Source-boundary debt is now a gate, not a note.** `lib/contracts.mjs` exports `KNOWN_DEBT` with
priority, the 123-post baseline, the direction of error, the ruling that adjudicated datasets
outrank the detector, and the three things it blocks. `audit/source-boundary-debt.json` ships the
affected post list so the re-adjudication set is already assembled. Two invariants freeze it:
the post count and the presence of the prerequisite declaration.

**Second stale-transport check added.** `/data` is served cache-first, which is correct for a
9.4 MB bundle that only changes on deploy — and is exactly why the SW cache name must be rewritten
every publish. If it ever stopped being, returning visitors would hold the old archive forever
and every count would be right on disk and stale in the browser: the SEED_VERSION failure in a
second transport. Now asserted (deploy rewrites CACHE_VERSION; activate deletes prior caches).

**87/87 integrity invariants pass.** Live: entities 1,332 / 7,903 (4,463 + 3,440), emphasis
5,251 / 1,737, codes 1,949, themes 2,393, evidence 6,590, queue 2,527 with unique ids,
sw cache qdrops-20260813-021237.

Note: GitHub Pages served the previous entities.json for ~20s after deploy. Live verification must
poll rather than check once, or it reports the pre-deploy artifact as the deployed one.

## Resolution Center usability — pass 1

**Request:** start the product-quality workstream with /resolve — make it easy to understand what
is unresolved, inspect context, submit a useful resolution, and see status.

**Data defect found and fixed.** All 251 theme rows shipped with **zero context and an empty
sourceSpan** — a contributor saw a label ("Foreign Affairs"), a post number, and nothing else, on
the one kind that most needs the drop in front of it, because a theme is inferred from the whole
post rather than from a span. `build-resolution-queue.mjs` now shows the lines whose vocabulary
made the signal fire (falling back to the drop's opening lines), which is exactly the question
being asked: are these words doing the work the label claims. One code row also had an
unhighlightable span (`context[1]` on a window shorter than two lines). Live: 0 rows without
context, 2,527/2,527 spans highlightable.

**Four kinds, four different questions.** The chips said `entity`, `theme`, `code`,
`classification` — the audit's words for its own populations, which tell a contributor nothing
about what is being asked or what a good answer looks like. `src/lib/resolutionKinds.ts` now
carries, per kind: what it asks, what an answer looks like, and what counts as evidence — stated
BEFORE the contributor writes rather than discovered when their submission is rejected. Chips are
relabelled (Reference / Notation / Subject / Device) and each row states its own question.

**Search.** 2,527 items behind thirty token chips left most of the queue unreachable — an item
whose token was not in the top thirty could only be found by paging. Search now covers token,
drop number, the quoted lines and the reason it is unresolved, because a contributor arrives
knowing one of those and rarely knows which. URL-backed (`?q=`), with an empty state.

**Answer chips.** The readings the audit already weighed are one click instead of retyping
"Barack Obama" — which was friction with no purpose and invited spellings that no longer match
the certified canonical name.

**Local submission history.** The moderation store is deliberately create-only (no read), which
is worth keeping and had one cost: after submitting, a contributor could not tell what they had
already covered and the queue looked identical whether they had worked for an hour or not at all.
Submissions are now recorded in localStorage — "you suggested" badges, a count, and a
"Review what I sent" filter. It says *you sent this*, never *this was accepted*.

**Copy-link per occurrence**, since an occurrence-specific queue needs occurrence-specific links.

**Process notes:**
- The pre-deploy gate did its job on its first real run: it blocked on `resolution-queue.json:
  CONTENT changed`, which was intended, and forced a deliberate re-certification.
- `tsc -b` (which the deploy runs) caught a TDZ error that `tsc --noEmit` did not — `kind` and `q`
  used in a useEffect declared above them. The deploy blocked before shipping. Use `tsc -b`.
- Live verification polled through two stale responses before GitHub Pages served the new queue.

88/88 integrity invariants pass; certified sections untouched.

## Cross-section relationships + post-level Analysis Map

**Request:** make the eight certified sections feel like one system — relationships derived from
certified data only, plus a compact per-post Analysis Map. Product layer; nothing reclassified.

**10,844 relationships across 4,953 posts**, every one carrying the certified field or overlap
that produced it. An edge that cannot name its basis fails the gate rather than shipping.

| Relationship | Count | Basis |
|---|---|---|
| unresolved ↔ occurrence | 2,527 | resolution-queue occurrence id |
| emphasis ↔ question | 2,176 | certified span overlap |
| theme → supporting line | 1,478 | themes.evidence.anchors |
| emphasis ↔ claim | 1,357 | certified span overlap |
| claim → conclusion | 966 | claimMeta.isConclusion |
| prediction → assertion family | 630 | claimMeta.semanticFamily |
| claim → source provided | 438 | claimMeta.sourceProvided |
| evidence ↔ claim | 432 | certified span overlap |
| emphasis ↔ directive | 386 | certified span overlap |
| question ↔ directive | 228 | canonical key match / questions.directiveSource |
| entity ↔ code | 180 (32 links) | codes.linkedEntityId |
| prediction → source provided | 46 | claimMeta.sourceProvided, kept apart from the 438 |

**Three QA failures on the first run, all mine, all the same root cause — occurrence identity:**
1. Q↔D returned 218, not 228. Walking questions and finding a directive counts one edge per
   question; the certified 228 is measured from the DIRECTIVE side, so a directive Q wrote twice
   in one drop is two overlaps. Inverted the loop.
2. 10 "duplicate" edges were in-post repeats — "Nothing is as it appears." twice in #151, each
   occurrence genuinely carrying isConclusion. The occurrence index now travels with the edge, so
   repeats stay distinct instead of collapsing and silently breaking the 966.
3. claim→sourceProvided came out 484 against a certified 438. The extra 46 are PREDICTIONS
   carrying the same attribute. Split into its own type: folding two populations together would
   have shown 484 against a published 438 and read as drift.

**Analysis Map** (`src/components/AnalysisMap.tsx`) sits at the top of each post's analysis panel:
certified counts for all nine layers plus unresolved, each clickable to scroll to those
occurrences, with unresolved deep-linking into /resolve filtered to that drop. Relationships are
grouped by type, each stating what it means, why the overlap is allowed, and its basis. The
component counts nothing itself — an invariant asserts it reads the artifact.

**13 new invariants in their own group** (12. Cross-section relationships), leaving the frozen
semantic contracts untouched: 88 → **101/101 passing**. Three of them reconcile the map's totals
against certified Questions, Directives and Emphasis, so the reader can never be shown a number
the section itself does not hold.

`build-relationships.mjs` chained last in the export order — relationships join every section, so
every section must exist first. relationships.json added to the manifest (9 artifacts hashed).

## Global search + filtering

**Request:** search across every certified section, built on certified artifacts only. Every
result must state why it matched. Editorial normalisations searchable but never shown as Q's words.

**33,902 records** indexed from the certified datasets — questions 6,442 · evidence 6,590 ·
emphasis 5,251 · claims 4,181 · unresolved 2,527 · directives 2,422 · themes 2,393 · editorial
1,395 · entities 1,332 · codes 739 · predictions 630. Every count matches its section exactly,
asserted in the gate.

**Search classifies nothing.** Each record is copied from a section that already certified it and
carries that section's own metadata, so filtering by directive family, evidence subtype, code
type, entity type, theme, conclusion, checkable or source-provided reads the audit's answer rather
than re-deciding it. An invariant asserts `src/lib/search.ts` contains no extractor.

**Raw post text is NOT duplicated.** The app already holds all 4,966 drops; shipping 8.5 MB of
post text a second time to search it would have doubled the bundle for nothing. Post-text search
runs over the copy already loaded, certified layers over the 7.85 MB index.

**Why it matched is part of the answer**, not an implementation detail — a hit on an entity alias
and a hit on Q's own wording are different claims about the text. Results show: exact match, text,
entity alias, code variant, theme anchor word, domain, the emphasised line, the unresolved line,
post text, editorial wording.

**Editorial rows are labelled twice over.** All 1,395 (134 normalisations + 1,261 paraphrases)
carry `q: false` in the data and render with the label ABOVE the text plus Q's source wording
beneath — "What is Manafort's background?" shows "Q's source wording: Trace background." Two
invariants: the flag on every row, and the label in the component that renders it.

Filters are URL-backed and shareable. An empty query with filters is a legitimate browse
("every unresolved code", "all conclusions in March 2018").

**18 search invariants in their own group**, 101 → **119/119 passing**. `search-index.json` is the
tenth manifest artifact; `build-search-index.mjs` chained last in the export.

Note: entities and codes span the corpus rather than one drop, so a date filter cannot apply to
them — they are excluded from date-filtered results deliberately, and the reason is recorded in
the filter itself rather than left to look like a missing result.

## Canonical source-unit coverage — the number that had never been calculated

**Request:** prove that every meaningful Q-authored unit in all 4,966 drops is accounted for.
Coverage audit only; the eight sections stay frozen; a genuine miss is reported as a certification
conflict rather than silently inserted.

**The method matters:** the answer cannot be derived from section totals, because the sections
deliberately overlap. This starts from raw text, segments it with the SAME `unitsFor()` the
certified audits used, and asks of each unit whether any certified artifact touches it. It runs no
classifier of its own.

### The answer: 29,569 canonical units, 85.46% accounted for, **4,299 TRUE_UNCATEGORIZED**

| Status | Units |
|---|---|
| CERTIFIED_ANALYSIS | 18,349 |
| NON_ANALYTICAL_SOURCE_STRUCTURE | 4,190 |
| CONTEXT_OR_LABEL | 1,442 |
| SOURCE_OR_REFERENCE | 782 |
| UNRESOLVED_PENDING_REVIEW | 507 |
| **TRUE_UNCATEGORIZED** | **4,299** |

The remainder is not one population, and reporting it as one number would hide the work:
3,089 terse fragments (1-3 words) · 807 short fragments (4-6) · 356 other prose · 22 fully
bracketed · 21 URLs · 2 possible missed Questions · 2 very long.

**Two ordering bugs found in my own audit before the number was trustworthy:**
1. `SOURCE_OR_REFERENCE` came out 0 in a corpus with 932 quoted lines. Evidence was matched
   bidirectionally, so one pasted-passage value (hundreds of characters) swallowed every unit near
   it. Fixed to require the UNIT to contain the reference. Now 782.
2. Secondary layers were tested before the quoted-block check, so a caps word inside a quoted
   article made that unit "certified analysis". Primary classifications still win — the
   adjudicated datasets outrank the block detector — but secondary devices no longer do.

**The 21 URLs are the highest-confidence real finding**: space-broken links
(`https:// twitter.com/...`) that the Evidence audit's known protocol-spacing problem left behind.
Those are Evidence misses, not disposition questions.

Deliverables: `audit/source-unit-coverage.md` / `.json`, with a per-post work-list.
Highlight coverage (step 5) not yet run.

## Coverage disposition pass — TRUE_UNCATEGORIZED driven to 0

**Ruling applied:** a bare terse fragment defaults to CONTEXT_OR_LABEL; it becomes a telegraphic
claim only where local context supplies a proposition. The test reads the line ABOVE the fragment,
never the fragment's vocabulary — "Fake." alone is a label, "Picture authentic? / Fake." is a claim.

### 29,569 / 29,569 units explicitly dispositioned — 100% coverage

| Status | Units |
|---|---|
| CERTIFIED_ANALYSIS | 18,349 |
| CONTEXT_OR_LABEL | 4,901 |
| NON_ANALYTICAL_SOURCE_STRUCTURE | 4,190 |
| UNRESOLVED_PENDING_REVIEW | 1,347 |
| SOURCE_OR_REFERENCE | 782 |
| **TRUE_UNCATEGORIZED** | **0** |

### 840 certification conflicts — reported, never applied

Claims 764 (350 prose + 414 context-promoted) · Directives 29 · Codes/Emphasis 22 · Evidence 21 ·
Questions 2 · Segmentation 2. Frozen counts unchanged.

**Two errors caught by reading output, both mine:**
1. The first pass classified `Know your rights.` and `Try harder.` as Claims/context. They are
   IMPERATIVES — missed Directives. Routed through the certified `imperativeMood()` from
   lib/imperative.mjs rather than a new test, because a second imperative detector would drift
   from the one that produced the certified 2,422.
2. That detector alone then fired on `Old.` and `Relevant.` and produced 4,252 "directives" — a
   single word out of context looks exactly like a verb. Constrained to fragments of 2+ words
   that resolve to one of the seven certified families; `other` means the family rules did not
   recognise it, which is a reason to leave it alone rather than file it. 4,252 → 29.

Earlier in the same audit: `SOURCE_OR_REFERENCE` was 0 in a corpus with 932 quoted lines
(bidirectional evidence matching let one pasted passage swallow its neighbours), and secondary
layers were tested before the quoted-block check. Every one of these moved the headline number.

Next: highlight coverage, then the neutral "Context / Other Q Text" treatment.

## Handoff prepared for the conflict adjudication

`claimBasis` normalised to machine-readable values so the next pass can filter rather than parse
prose: answers_previous_question 393 · predicate_of_previous_subject 21 · standalone_proposition
350. Every conflict row now carries postNum, text, prevLine (where the promotion depended on it)
and a null `verdict` slot ready to fill.

`audit/HANDOFF-conflict-adjudication.md` written: current state, the 840 in processing order, the
seven Claim verdicts, the hard rules (report proposed count changes before applying; re-certify
through the gate; keep TRUE_UNCATEGORIZED at 0; keep 119 invariants passing), deliverables, and
the sourceLines() debt that constrains any future Emphasis/source work.

Ledger re-verified after the change: 29,569 units, TRUE_UNCATEGORIZED 0. Certification manifest
verifies clean. No production data touched by this session's coverage work — it is audit-only.

## Sidebar migration — LIVE and reconciled

Executed end-to-end. Every analytical page now renders certified data.

| Section | Was live | Now live | Target |
|---|---|---|---|
| Directives | 4,529 | **2,422** / 1,417 posts | 2,422 |
| Claims | 5,820 | **4,181** | 4,181 |
| Predictions | 757 | **630** | 630 |
| Entities | 22,363 legacy | **7,903** mentions / 1,332 canonical | 7,903 / 1,332 |
| Themes | 10,453 legacy | **2,393** | 2,393 |
| Conclusions | — | **966** | 966 |
| Checkable | — | **1,926** | 1,926 |
| Emphasis | — | **5,251** | 5,251 |

**1. Entity tail provenance materialised.** The legacy `postAnalysis.namedEntities` entries
matching the 1,254 surviving tail source strings reconcile to **exactly 3,440** — the certified
tail mention count. A clean transcription, not a re-extraction: the adjudication had already
decided which strings survived, how aliases merged and what type each carries. Persisted to
`audit/entities-tail-occurrences.json` with stable occurrence ids, because the apply step
overwrites the legacy field it was read from. Guard cleared; four new QA assertions.

**2. One entry per certified MENTION, not per post.** A presence list sums to 6,432 against 7,903
certified mentions — writing that would have under-reported by 1,471 and erased every in-post
repeat. The apply now refuses to write unless the materialised entry count equals the certified
figure.

**3. Render-time rescanning removed — the main fix.** Two copies of the same defect:
`getAnalysisFrequency()` in `lib/posts.ts` and the grouping in `pages/QRequests.tsx`. Both called
`backfillFromText()` to add every post whose raw text contained the phrase, then
`countPhraseOccurrences()` to recount. That is what produced 4,529 from 2,422 — the right posts,
rescanned, with occurrences invented on top. Replaced with a per-post certified tally so in-post
repeats survive display grouping.

Two scan sites remain and are correct: `getTermMatchesInSection()` and search-result mention
density both answer "where does this term appear in raw text", which is a search question. Marked
in-place so the distinction is not lost.

119/119 invariants, manifest re-certified, deployed, polled through two stale responses, then
every total verified off the live site.

Next: 840 certification conflicts, then highlight coverage.

## Independent audit reconciliation — two of my "verified" claims were false

An independent audit of the live site contradicted two things I reported as verified. Both
contradictions were correct and both are now fixed.

**1. Theme anchors reached only one surface.** I fixed `PostDetail.tsx` and reported themes as
rendering. `highlightText()` in `postHighlight.tsx` — which drives the ARCHIVE (`/posts` via
PostCard) — was still passing `analysis.themes`, the taxonomy labels. Detail: 1,478/1,478.
Archive: 0/1,478. Fixed to consume `themeAnchors` on both surfaces.

**2. The keyword style change was never consumed.** I changed `cls.keyword` to a ring/underline
treatment and my audit reported "keyword style distinct: true". It checked the CONSTANT. The
render path for keyword is a hardcoded branch — `animate-flash-red` — because `keyword` is in
DOMINANT_KINDS, so the style map is bypassed entirely. The live site kept painting a solid
flashing fill indistinguishable from a semantic category. Fixed to read `cls.keyword`.

Both failures are the same mistake in a new place: **verifying the artifact instead of the
consumption**. My highlight audit grepped the style file rather than the render branch, which is
precisely the gap that let the sidebar ship legacy numbers for months while 119 invariants passed.

Also confirmed from the independent audit and NOT yet addressed:
- 6,002 detail / 5,631 archive unauthorized semantic-looking spans from static renderer
  vocabularies (mil/intel 1,850 · blanket brackets 1,561 · static entities 1,032 · Q-signature
  1,010). These paint category colours with no occurrence-level certified record.
- 593 overextended spans per surface (claims/predictions/conclusions/checkable expanded past
  their certified boundary).
- 1,752 resolvable Resolution Center spans shown only as chips, not marked in the body.
- Context / Other Q Text still has no neutral treatment.
- My defect JSON truncates at 3,000 rows and must emit all failures for exhaustive repair.

Acceptance baseline should be the independent audit's 40,994 highlightable occurrences per
surface, not my 46,019 — mine counted badge-only populations (915 anchorless themes + 1,271
non-text media evidence = 2,186) that must never be treated as missing highlights.

## 2026-08-14 — Owner claim rulings shipped; export-chain repair path

**Request.** "i want pure evil and the real racist to be listed as claims" (post #2917), plus the
five earlier `PURE EVIL.` occurrences found corpus-wide.

**Solution.** Seven occurrences written to `audit/claims-final.json` — the canonical artifact —
with `confidence: OWNER_ADJUDICATED` and provenance: #570, #855, #1001, #1832, #1881, and both
rulings on #2917. Claims: 4,188 occurrences / 3,228 distinct / 1,953 posts.

**What blocked it.** The deploy failed on a Firestore read-quota outage. The export had already
overwritten `posts.json` from the dump and died before the tail of the apply chain, leaving
`contextUnits: 0` on all 4,966 posts while every certified count still verified. The manifest gate
caught it on the semantic hash.

**Fixes.**
- `scripts/rebuild-bundle.mjs` — replays the deterministic chain with no Firestore.
- `SKIP_EXPORT=1 npm run deploy:web` — publishes the bundle on disk; the manifest gate still runs.
- `scripts/lib/chainSteps.mjs` — single copy of the chain order, imported by both entry points,
  with every step tagged `derive` or `apply`. Rebuild runs apply steps only, because
  `audit-entities.mjs` reads the `postAnalysis.namedEntities` field `apply-entities.mjs` writes —
  re-deriving on a built bundle gave 1,333 canonical entities against the certified 1,332.
- Cross-section invariant 7 rewired to the shared module, plus a new check that both entry points
  import it. 126/127 invariants; the chain is a proved fixed point (two rebuilds byte-identical).

See `audit/CHATGPT-CLAUDE-HANDOFF.md` for the full failure analysis.

## 2026-08-14 — "still not presented as a claim": the seed gate, not the renderer

**Report.** #2917 showed `'real'` with Emphasis but neither `Pure evil.` nor `The 'real' racist.`
as a Claim, despite the data being live. Diagnosed as a PostDetail compositing defect.

**Actual cause.** The renderer was correct. Driving live qdrops.app over CDP showed the drop body
already rendering `<mark class="bg-amber-500/40 text-amber-100">Pure evil.</mark>` and
`<mark title="2 certified layers: claim, emphasis" class="animate-overlap">'real'</mark>`.
`SEED_VERSION` was still 6, so any returning profile kept its old IndexedDB seed and never
received the new Claims. Fresh profiles saw them the whole time.

**Fix.** `SEED_VERSION` 6 → 7 (third occurrence of this failure in one day), cross-section
invariant 8 updated to pin 7, re-certified, deployed.

**New test.** `scripts/test-returning-profile.mjs` — seeds a profile, downgrades it to the
pre-ruling state, then requires the app to repair itself and paint both sentences. The control is
read back inside the same evaluation, because a separate page load repairs the profile before any
check can observe it.

127/127 invariants · manifest clean · returning-profile test 7/7.

## 2026-08-14 — Do the Claim rulings propagate to every statistic?

**Request.** Confirm the seven owner Claims reflect in the app's other Claim statistics and graph.

**Answer.** They do, and checking it found one real defect the rulings had introduced.

**Defect: four spans were both Claim and Context.** #570 rendered "Pure EVIL." as an overlap
titled "2 certified layers: claim, context" — one span presented as classified and unclassified at
the same time, against the rule that a span promoted to a semantic category stops being Context.
Cause: `audit/source-unit-coverage.json` is written by `audit-source-coverage.mjs`, which is not
in the apply chain, so the coverage ledger never saw the rulings. Re-derived it (safe — it reads
the certified sections and never its own materialised output, unlike the entity audit). Exactly
the 4 owner units left Context, none were added; +28 also moved out of SOURCE_OR_REFERENCE from
this morning's source-boundary fix, which the ledger also predated. Coverage stays 29,569 / 100%.
Context units 4,906 -> 4,902 (4,889 contiguous + 13 reconstructed); the acceptance gate in
`apply-context-units.mjs` was updated deliberately, with the reason recorded.

**SEED_VERSION 7 -> 8**, because posts.json changed again.

**Latent gap closed.** The `/analysis` frequency cache is keyed on a stamp of `posts.length` +
total analysis items. A future ruling moving a span between two categories in that list is
count-neutral, so the stamp would not change and a returning reader would keep a stale cache.
Stamp now leads with SEED_VERSION.

**Verified live**: store 4,188 / 1,953 posts, 7/7 rulings, 0 claim-also-context, Context 4,889,
#2917 map shows 2 Claims with both chips, #570 shows 8 and paints clean amber. 127/127 invariants.
`scripts/verify-claim-propagation.mjs` is the reusable check.

Not asserted: the `/analysis` chart is not mounted on first paint (it lives behind a tab), so the
series was not checked in the DOM. It is fed by the same frequency data verified above.

## 2026-08-14 — Claims graph verified; Ascension theme; Context restyled

**Graph (verified by driving the page, not by inference).** The chart mounts at
`/analysis?tab=claims` — the sidebar link, not the bare `/analysis` URL, which is why an earlier
check found no chart. Rendered: 1 recharts surface, 78 bars/lines, palette
`["none","#9ca3af","#f59e0b","#4b5563","#6b7280"]` with 37 amber (#f59e0b) Claims shapes. Hovering
a bar gave the tooltip **"October 2017 ● Q Posts: 17 ● Claims: 51"**. Frequency cache stamp
`8:4966:26273:...` — Seed-8 data — with the owner rulings present as rows (`Pure EVIL.` ×6,
`The 'real' racist.` ×1). `/dashboard` shows no Claim statistic: it is an editing surface,
compiled out of the public build.

**Finding: the archive header under-reports Claims by 13.** It shows *"4,175 mentions within
1,953 posts"* against the certified 4,188. `computeAnalysisFrequency` counts POSTS per phrase, so
in-post repeats collapse — 9 posts, 13 extra occurrences (#1888 says "You get to go to jail."
four times, counted once). Exactly 4,188 − 13 = 4,175. Pre-existing, not from the rulings, and it
contradicts the occurrence-identity rule the rest of the system holds. NOT changed: the fix moves
the displayed "mentions" figure for all seven categories, which is an owner call.

**Ascension.** Applied at last — it had been approved and never built. Retrieval confirmed exactly
2 Q-authored occurrences, 0 quoted. Owner rulings now live in `audit/themes-owner-rulings.json`
and are merged by `apply-themes.mjs`, because `themes-audit.json` is written by a DERIVE step and
a ruling placed there would be erased by the next audit — the Claims lesson, applied ahead of the
failure this time. Themes 2,393 -> 2,395 (detected and owner counts asserted separately). Both
spans also left Context (4,902 -> 4,900). Live: `bg-indigo-500/40`, chip "Religion &
Spirituality", #4963 carries both its themes.

**Context restyled.** The dotted underline WAS Context — "reviewed, in no semantic category". It
was deliberately fill-free so it could not be mistaken for a category; the owner ruled it too
faint. The signal moves from absence-of-fill to hue: `bg-gray-500/35 text-gray-100`, grey being
the one neutral in a palette where every certified layer owns a colour. Verified live:
0 dotted-underline marks in the drop body on #4963/#4966.

SEED_VERSION 8 -> 9. Search index and relationships rebuilt (the index still carried 2,393
themes). `sectionInfo.ts` updated — it hard-coded 2,393 to the reader. 127/127 invariants.

## 2026-08-14 — Section headlines read certified totals, never a recount

**Owner call.** The Post Analysis headline summed the phrase-frequency index, which groups by
phrase — so a phrase Q repeats inside one post collapsed to that post once, and Claims headlined
"4,175 mentions" against the certified 4,188. Thirteen real occurrences missing from a
user-facing number, in violation of occurrence identity.

**Fix.** `SECTION_TOTALS` in `src/lib/sectionInfo.ts` is the single certified source for every
section headline; `AnalysisArchive` reads it instead of summing `items`. Units are now honest per
section — occurrences for Claims/Predictions/Emphasis, mentions for Entities (the one section
where a mention is the unit), assignments for Themes, conclusions, checkable claims. Phrase rows
still show "x N posts", which is what the frequency index is actually for. When a month filter or
alias filter is active the header shows the filtered figure, labelled "shown here", because the
certified total describes the whole section and would be a lie about a subset.

**Verified live**, every category header on the deployed site:

    claims              4,188 occurrences within 1,953 posts
    predictions           630 occurrences within   520 posts
    emphasis            5,251 occurrences within 1,737 posts
    namedEntities       7,903 mentions    within 2,221 posts
    themes              2,395 assignments within 1,767 posts
    impliedConclusions    966 conclusions within   596 posts
    verificationHooks   1,926 checkable claims within 1,028 posts

**Seven new invariants** tie SECTION_TOTALS to scripts/lib/contracts.mjs, assert the header reads
SECTION_TOTALS rather than the index, and assert the phrase rows KEEP their post counts so the
recount is not "fixed" by deleting the thing the index is for. 134/134. SEED_VERSION 10.
`scripts/verify-section-headlines.mjs` re-checks the rendered headers.

Still open (performance, not correctness): ship a prebuilt frequency index in the bundle so the
first visit after a deploy does not walk 26,273 items in the browser.

## 2026-08-14 — ACROSTIC: a tenth Emphasis device (owner ruling)

**Request.** #4951's `[N]othing [C]an [S]top [W]hat [I]s [C]oming` was unregistered; make it
Emphasis.

**Retrieval across all 4,966 posts.** Lines carrying 2+ single-letter brackets: 25 lines, 18
distinct letter sequences. Four are acrostics, all unclassified in every section:
#4951 NCSWIC · #129 "Operations --> [N]o [S]uch [A]gency" · #129 "[C]los[I]ng [A]ct:" ·
#150 LDR spelled across a full sentence. Owner approved all four as one batch.

**Deliberately excluded:** [D]/[F] brackets in #3911, #4317, #4325, #4489, #4688 — those
abbreviate a word (Democrat, Foreign), they do not spell one. #4317 appeared to spell "DRRD" only
because four unrelated abbreviations share a line. The scan finds both devices; the set was read
rather than taken from the scan.

**Applied** via `audit/emphasis-owner-rulings.json` merged in apply-emphasis.mjs — the same
overlay pattern as Claims (claims-final.json) and Themes (themes-owner-rulings.json), because
emphasis-audit.json is written by a DERIVE step. Emphasis 5,251 -> 5,255 across 1,737 -> 1,739
posts; `acrostic` declared as a tenth subtype in CERTIFIED_BY_TYPE (the gate refused it until it
was). Detected and owner counts asserted separately. Search index and relationships rebuilt.
SEED_VERSION 11. 134/134 invariants.

**Live:** header reads "5,255 occurrences within 1,739 posts". #4951 paints slate Emphasis;
#150 paints as an overlap. NOT confirmed painting: #129 — both rows are present in
postAnalysis.emphasis with text matching the raw drop, so this is display, not data. The probe
selects the LAST pre.post-text on the page and #129 has quoted blocks, so it may have inspected
the wrong element. Needs a targeted re-check before it is called a defect.

## 2026-08-14 — Dominion entity + Brackets panel (owner rulings executed, not re-asked)

**#4963 Dominion.** Owner ruled it an Entity = Dominion Voting Systems. Corpus search: /dominion/i
matches exactly ONE post archive-wide (#4963, one line); no "Dominion Voting", "Dominion Voting
Systems" or "Smartmatic" anywhere. Applied via audit/entities-owner-rulings.json, merged in
apply-entities.mjs AFTER the certified set — the entity pipeline is the one that re-derives from
its own output, so a ruling stored inside that loop would not survive. Entities 1,332 -> 1,333
canonical, 7,903 -> 7,904 mentions, 2,221 -> 2,222 posts. The materialiser writes the ALIAS
("Dominion.") not the canonical name, or the mention would count and highlight nothing. Three
gates fired and were each fixed deliberately: submetric reconciliation (now core + tail + owner),
the namedEntities count guard, and the search index.

**#4742 Brackets panel — corpus-wide reader defect, not a per-post issue.** The panel built its
own list in PostDetail with /\[\[?[A-Za-z0-9][A-Za-z0-9 _\-]{0,30}\]?\]/g, a character class
admitting only letters, digits, space, underscore and hyphen. #4742 showed [barrage] and
[faith in Humanity] while dropping [+family (follow)] (the "+" and parens) and
[safeguarding women & children] (the "&", stored as &amp;). Archive-wide that regex dropped
**618 spans across 353 posts** — [13=M], [-30], [DEATH + MONEY], [visibility / reach].

Contract established before fixing: this panel is a LITERAL STRUCTURE view ("what is in brackets
here"), which is a different question from Codes & Brackets, the certified SEMANTIC layer. The two
may differ; what is not allowed is showing some of a drop's brackets and silently dropping others.
So it now matches any bracketed run and decodes &amp;/&gt;/&lt; to the rendered form, so the chip
agrees with the drop body above it. Ordinary bracket text was NOT forced into Codes.

**Live:** #4742 shows all four spans, "&" rendered. #4963 paints "Dominion." cyan with Entities 1.
SEED_VERSION 12. 134/134 invariants, manifest clean.

## 2026-08-14 — Span precision: acrostic brackets, and brackets painted in the drop

**#150 was my error.** The acrostic ruling stored the whole two-sentence line as the Emphasis
span. Those sentences are already a Prediction and a Claim, so the line-level span put a second
layer over every word of both and the drop flashed between three colours. Fixed: acrostic now
RENDERS as the bracketed letters only — one certified occurrence, several literal spans, the same
shape parallel_phrasing already used. Emphasis count unchanged at 5,255.

**Brackets now paint.** The [ Brackets ] panel listed spans the drop did not highlight, so a
reader could see [+family (follow)] named with no way to find it. bracketCode (red) was already a
defined highlight kind and simply was not fed. Panel and highlight now share ONE definition,
bracketSpansIn(), so they cannot disagree.

**Live #150:** sentence 1 solid violet (Prediction), sentence 2 solid amber (Claim), [L] [d] [R]
red, _D7g^-_%19FZBx_decline grey (Context). No whole-sentence flashing.
**Live #4742:** all four bracket spans painted.

SEED_VERSION 14. 134/134 invariants.

**Not yet right:** where a bracket carries TWO layers the page shows the primary colour with an
"also: bracketCode" tooltip instead of rotating between them — [L] renders red although it is
also acrostic Emphasis, and #4742's brackets render blue (Question) with "also: bracketCode".
animate-overlap only fires for pairs the renderer counts as "certified layers". The owner's rule
is that any 2+ overlap rotates. Next task.

## 2026-08-14 — #150 emphasis withdrawn; overlap rotation generalised

**#150 Emphasis withdrawn** (owner ruling). Both sentences are already certified — sentence 1 a
Prediction, sentence 2 a Claim — so the acrostic layer added no reading. Emphasis 5,255 -> 5,254,
posts 1,739 -> 1,738, acrostic subtype 4 -> 3. Recorded under "withdrawn" in
audit/emphasis-owner-rulings.json so the device is not re-detected later as a gap.

**Overlap rotation generalised.** The question branch in PostDetail rotated only when the inner
layer was Emphasis; every other second layer fell through to a flat blue question fill with an
"also: …" tooltip. That is why #4742 listed [+family (follow)] under [ Brackets ] and painted it
the same blue as the question around it — a tooltip is not a highlight. Any second layer inside a
question now uses animate-overlap, matching the owner's rule that 2+ overlapping layers rotate.

**Live:** #4742 [+family (follow)] / [safeguarding women & children] / [faith in Humanity] rotate
as "2 certified layers: question, bracketCode"; [barrage] rotates 3 layers. #129 [C][I][A] and
[N][S][A] paint red. #150 [L][d][R] red with no extra Emphasis layer.
SEED_VERSION 15. 134/134 invariants.

**Not done:** analysis-panel chips are not yet clickable through to a per-item Brackets page.

## 2026-08-14 — Containment is not overlap; bracket chips clickable

**My error, corrected.** I generalised the question branch so ANY second layer rotated. But a
bracket sitting inside a question is not two classifications of the same span — the question is
the CONTAINER. #4742's brackets are listed under [ Brackets ] and nothing else, so they must
simply be red; instead they rotated through question-blue.

The rule, now stated once in the code: a span shows the colour of the category it BELONGS to, and
rotates only when that same span genuinely belongs to two or more. The enclosing question keeps
its colour on the sub-intervals either side.

Live #4742: [+family (follow)], [safeguarding women & children], [faith in Humanity] all solid
red, titled "bracketCode (inside a question)". [barrage] rotates — it is genuinely both Emphasis
and a bracket. #129 and #150 brackets solid red.

**Bracket chips are clickable**, like every other analysis chip: /posts?q=<span>, so a reader can
see every other drop the span appears in — or none. Brackets were the only section whose chips
were dead text. Verified live on #4742.

SEED_VERSION 17. 134/134 invariants.

## 2026-08-14 — Highlight rule finalised: colour = what it IS classified as

Three separate defects, all producing the same symptom (colour where the analysis did not
support it). Fixed in order, each verified live:

1. **Containment is not overlap.** A bracket inside a question is not two classifications of one
   span — the question is the container. #4742's brackets rotated through question-blue.
2. **Structure layer double-counted certified spans.** [barrage] is certified Emphasis of type
   bracket_emphasis — the bracket IS the emphasis — so painting a bracket structure layer over
   the same span made one device rotate as two. The structure layer now paints only where no
   certified layer already covers that exact span.
3. **Rotation counted segments, not kinds.** [A] in #129 belongs to both the CIA and NSA
   acrostics, so it matched Emphasis twice and rotated titled "2 certified layers: emphasis" —
   one kind, named once, presented as an overlap. Rotation now needs 2+ DISTINCT kinds.

The rule, now written into the code in both branches: a span shows the colour of the category it
BELONGS to, and rotates only when it genuinely belongs to two or more different categories.

**Verified live, seed 20:**
- #4966 — questions solid blue; "We will be repressed no more." solid amber (Claim only);
  "Mankind is repressed." rotates claim+impliedConclusion (both listed); "There is a war for your
  DNA." rotates 3 (claim, impliedConclusion, verificationHook — all three listed); "Protect your
  DNA." solid green (Request); "Ascension." solid indigo (Theme).
- #129 — [A] solid slate, no longer rotating.
- #4742 — brackets red, themes indigo, [barrage] slate, only the genuine 2-category span rotates.

Also: #150 [L] resolved out of the Resolution Center (2,527 -> 2,526, code 173 -> 172) via
audit/resolution-owner-resolved.json. #1277's "[R] = Renegade" deliberately kept — different case.
Bracket chips now link to /posts?q=<span>. 134/134 invariants.

## 2026-08-14 — The overlap animation was a fixed rainbow

The real cause of "wrong colours flashing". `animate-overlap` was a hardcoded six-colour cycle —
red, amber, violet, cyan, orange, lime — applied to EVERY overlap regardless of its categories. A
Claim + Implied Conclusion span flashed cyan and magenta, colours no category on the page owns, so
the highlight could not be decoded against the legend. The owner photographed it mid-cycle three
times to show it.

Replaced with per-span cycling: overlapStyle() maps the span's own kinds to their real fills and
sets them as --hl-1..--hl-3; CSS keyframes overlap-2 / overlap-3 read those vars. KIND_RGBA sits
beside HIGHLIGHT_CLS with a note that changing a colour in one requires changing the other.

Verified live on #4966, seed 21:
  questions                     solid blue
  "We will be repressed no more."  solid amber          (Claim only)
  "Mankind is repressed."       amber <-> orange        (Claim + Implied Conclusion)
  "Information is knowledge."   amber <-> orange
  "Knowledge is power."         amber <-> orange
  "Information is power."       amber <-> orange
  "There is a war for your DNA." amber -> orange -> magenta (+ Checkable Claims)
  "Protect your DNA."           solid green             (Request)
  "Ascension."                  solid indigo            (Theme)

Applies app-wide: the archive highlighter (postHighlight.tsx) uses the same function.

## 2026-08-14 — [barrage] withdrawn, Runbeck entity, all chips clickable

**#4742 [barrage] withdrawn from Emphasis** (owner ruling: a bracketed item, not a device).
5,254 -> 5,253 occurrences, 1,738 -> 1,737 posts, bracket_emphasis 716 -> 715. Added a
`withdrawn` mechanism to apply-emphasis.mjs keyed on postNum + exact text: the #4741 [barrage]
occurrence STANDS, because the ruling named #4742 and occurrence identity means a device certified
in one drop is not un-certified in another by association. Live: solid red bracketCode.

**Runbeck Election Services** added as an Entity on #4963 (owner ruling). Corpus search: /runbeck/i
matches exactly one post archive-wide. Entities 1,333 -> 1,334 canonical, 7,904 -> 7,905 mentions.
Live: cyan, beside Dominion.

**Every analysis chip is now clickable.** An audit of the live DOM found Questions and Requests
were the last rows rendering their text as dead spans — a reader could not ask where else Q said
the same thing. Both now link to /posts?q=<text> like the rest.

SEED_VERSION 23. 134/134 invariants.

## 2026-08-14 — the write guard proved, and COVID made an entity everywhere

### The guard that had never refused anything

`apply-editorial-batch.mjs` carried a write guard written after the first owner-approved Claims
batch was put straight into `postAnalysis` — a derived cache the next chain run rebuilds. The
guard had never actually run: that batch aborted at an earlier QA check, so the guarded write was
never reached. A guard nobody has seen refuse is a comment with a function signature.

Extracted to `scripts/lib/certifiedWrite.mjs` — one allowlist, one refusal path, used by
`apply-editorial-batch.mjs` and `apply-owner-claims.mjs` and nowhere else. The reason it is a
module and not a rule: Themes, Entities, Directives and Codes all still need batch apply, and a
rule reimplemented four more times is a rule whose fifth copy omits it.

`scripts/test-certified-write-guard.mjs` exercises the real module, not a copy:

| target | expected | result |
|---|---|---|
| `public/data/posts.json` | REFUSE | refused, file untouched |
| `public/data/questions.json` | REFUSE | refused, file untouched |
| `audit/postAnalysis-claims.json` | REFUSE | refused, file untouched |
| `audit/foo.json` (not allowlisted) | REFUSE | refused, file untouched |
| `scripts/lib/certifiedWrite.mjs` | REFUSE | refused, file untouched |
| `audit/editorial-batch-applied.json` | ALLOW | written, read back, removed |
| `audit/claims-final.json` | ALLOW | round-trip byte-identical |
| `audit/themes-audit.json` | ALLOW | round-trip byte-identical |

Every refusal is asserted twice — the throw AND the target's bytes — because a guard that reports
a refusal after writing is the failure the file exists to catch. Cross-section section 11 gained
four checks pinning it: the module exists, the test exists, no script carries its own allowlist,
and both editorial tools import it with no raw `writeFileSync` left. 134 -> 138 invariants.

### The Firestore export the handoff asked for is not needed — and would lose data

Quota recovered, so the standing caveat was checked rather than assumed: a read-only comparison of
all 4,966 live docs against the bundle, on the four fields the chain does not own.

**5 differences, all one-way.** #437, #438, #1254, #1319 and #1464 carry `customBrackets` locally
that Firestore does not have. `correlatedNews` and `excludedBrackets` are empty in both;
`analysisScanned` agrees on every post. Nothing live is newer than local — because the deployed
Firestore rules deny the editing build's writes, so recent edits never reached `postEdits`.

So a "real export to pick those up" would have picked up nothing and **deleted five posts' bracket
customisations.** The caveat is closed as a warning, not as a to-do.

### OWNER RULING — bare COVID is the COVID-19 entity

"covid is also an entity and an alias for covid-19 and covid19… I don't want Covid or any of the
alias's to be anything but an entity nothing more."

Retrieved before applying, Q-authored only, case-sensitive, word-boundary:

| form | occurrences | covered before? |
|---|---|---|
| COVID-19 | 60 | yes (certified alias) |
| C19 | 34 | yes (earlier owner ruling) |
| **COVID** (standalone) | **5**, in #4489 ×3, #4541, #4548 | **no — resolved to nothing** |
| COVID19 | 0 | n/a — the only `covid19` strings are lowercase inside URLs (#4329, #4339), which is Evidence, not naming |

Applied through `audit/entities-owner-rulings.json` → `aliasRulings`, the same path C19, CCP and
WUT took. **Mentions 48 -> 53, posts 25 -> 28. Section headline 7,945 -> 7,950, adjudicated tail
3,476 -> 3,481.** The pipeline's own QA refused the change until the pinned figures were updated
deliberately, which is what produced those numbers.

**The trap, worth stating: the alias matcher needed a lookahead.** The hyphen in `COVID-19` is a
word boundary, so a plain `/\bCOVID\b/` also matches the COVID inside all 60 COVID-19
occurrences — it would have added 60 phantom mentions to the very entity that already counts them.
`notFollowedBy` is now supported on alias rulings for exactly this shape: the boundary is correct
and the match is still wrong, because the token is part of a longer name.

"Nothing but an entity" verified in the data: **0** of 4,669 Emphasis occurrences and **0** rows in
any other certified layer carry the token as their span. The one Prediction that mentions COVID
(#4541, "those who managed the COVID emergency") is a sentence containing the word, not the token
classified as a prediction; it stands.

SEED_VERSION 40 -> 41. 137/138 invariants — the one open item is `hash-stable`, which is the
expected pre-certification state.

### NOT DEPLOYED — a second session is editing the same repo

Mid-run, `src/lib/localData.ts` gained a seed-40 `[D]`/`[F]` owner decode and
`entities-owner-rulings.json` gained a `US` -> United States alias ruling (277 occurrences) from
another session. The US ruling is in the canonical file but **not in the built bundle** (United
States still reads 180 mentions, no US alias). Publishing now would ship a bundle that contradicts
its own canonical source, and `deploy-web.sh` force-pushes `gh-pages`. Held for one certification
pass covering both rulings.

## 2026-08-14 — the second alias registry nobody read, and drops that open in place

### "Why doesn't searching COVID-19 show covid19 and covid, when POTUS shows its aliases?"

Because there were **two alias registries and only one was wired to search.**

| Registry | Contents | Read by search? |
|---|---|---|
| `aliases.json` + `map` in `src/lib/aliases.ts` | 8 owner-typed groups (potus, hillary clinton, usa…) | yes |
| `entities.json` | 1,335 certified entities and their adjudicated aliases | **no — nothing in the app read it** |

POTUS folded Q+/Trump/DJT together and colour-coded its post chips purely because someone had
typed that group in by hand. COVID-19's aliases were certified, materialised and highlighted in the
drops — and invisible the moment you searched for them.

`getFullAliasGroup()` now unions both, and every READ path goes through it — `makeTermMatcher`
(so archive search and the "across the archive" bar expand a term to all its spellings) and
`getAliasesFor` (so the row lists them). `getAliasGroup()` stays editable-only: addAlias and
removeAlias may only mutate the map the owner owns, and a certified alias must never be pushed to
Firestore as though it had been typed.

Row folding is scoped deliberately. Editable groups fold in every category; certified entity
aliases fold **entity rows only**, because that set holds bare tokens — US, CCP, COVID — that can
equally be the text of a claim or a code, and folding those would delete a row from a section the
entity ruling never touched.

Verified in a browser rather than in the data (`scripts/test-alias-visibility.mjs`):

    search "COVID-19"   incl. aliases: c19, covid          PASS
    search "POTUS"      incl. aliases: 4 10 20, q+, …      PASS

**OWNER RULE recorded in PROJECT_CONTEXT.md:** a searched term always shows the aliases tied to it,
and tying a new alias into both registries is done without being asked.

### Themes: open the drops under the post numbers

The chips said WHICH posts; reading them meant leaving the page one drop at a time and losing your
place. Each row now carries a **▼ read N drops** control that expands the drops themselves beneath
the chips, in post order — the order Q wrote them, which is the only order a scan can be resumed
in. 25 at a time, because a theme can carry 404 drops and rendering all of them at once turns a
scan into a freeze. The row's own term is passed to PostCard as the search keyword, so the phrase
that put each drop in the list is highlighted inside it.

Verified in a browser (`scripts/test-inline-drop-reader.mjs`): the control appears, opens 25 drop
bodies inline, flips to "− close drops", and renders them ascending — 4, 5, 6, 9, 35, 70, 72, 76…

Two of my own errors on the way, both of which read as product failures:
- The reader opened EMPTY at first. The row's identity in the markup is
  `itemConfirmKey` (`global|cat|text`); I matched the rank map's different format (`cat::text`),
  so the lookup found no item. The panel was working and had nothing to show.
- Three test assertions failed against a page that was correct, because a `\d` inside a JS
  template literal reaches the browser as a literal `d`. The page expressions use substring tests
  and `parseInt` now. A test that fails on its own escaping looks exactly like a broken feature.

---

## 2026-08-14 — Aliases in the Post Archive, and the Rachel Chandler ruling

**Asked:** why does searching `covid-19` show no aliases when `potus` shows half a dozen,
colour-coded? Then: "RC is RACHEL CHANDLER aka Ray Chandler as well so lets make this an entity and
have Rachel Chandler the main and the other 2 aliases."

### The Post Archive was reading one registry

The alias fix of earlier today reached the Analysis archive and stopped there. `/posts` — the
screen the question was asked about — still resolved every term through `getAliasGroup()`, the
OWNER-EDITABLE map. POTUS worked because someone had typed its group in by hand; COVID-19's
certified aliases C19 and COVID existed only in `entities.json`, which that page never read.

Nine read paths moved to `getFullAliasGroup()` (search matching in `searchAllPosts`, the archive's
mention counts, alias colours and "Includes:" chips, the keyword highlighter, and PostDetail's
entity highlight, alias colours and post list). `getAliasGroup()` is now referenced only inside
`aliases.ts`, by the write paths that may only touch what the owner owns.

**A race sat behind it.** The certified registry is FETCHED at startup, so landing directly on
`/posts?q=covid-19` ran the search before COVID-19 knew it had aliases — the match set came back
editable-only while the "Includes:" row, plain JSX re-evaluated on the next render, listed the
certified aliases. The page advertised spellings it had not searched for. PostArchive now
subscribes to alias changes and replays the last search when the registries load.

### Alias expansion was substring-matched

Landing the ruling meant matching a two-letter alias, and the expansion path was raw
`text.includes()`. Searching "USA" expanded to its alias "US" and matched **2,259 posts** on the
"us" inside *because/must/trust*; "RC" would have added 520 on *search/force/Church*. The typed
term stays a substring match — that is what makes a half-typed word find anything — and every
OTHER spelling in the group is now word-boundary matched, via `wordBoundaryPattern` rather than
`\b` so "Q+" still matches. The same word-level test now backs the chip counts and the per-alias
post colours. Visible effect: POTUS 860 → 772 posts (McDonald is not Donald), "Donald" 82 → 23.

### One person, three spellings

Rachel Chandler and Ray Chandler were certified as two separate entities, and Q's shorthand RC sat
in the Resolution Center as 13 unanswered rows.

- `mergeRulings` (new, `apply-entities.mjs`): the absorbed row's mentions, posts and alias
  spellings move ACROSS rather than being rescanned — her 4 Ray Chandler mentions include
  "Ray.Chandler" (#1054, #1138), which `/\bRay Chandler\b/` does not match. A rescan would have
  silently dropped two posts.
- `excludePosts` (new): #2 — "Why would he place all his funds in a RC?" — is an indefinite
  article in front of a thing money goes into, asked seventeen months before Q first wrote her
  name. It is excluded from the ruling and STAYS QUEUED in the Resolution Center rather than being
  answered with a person. `build-resolution-queue.mjs` clears by token AND post, so an excluded
  drop is not marked answered.
- Flagged, not hidden: #1063 ("No 'PG' bot push post RC?") and #1066 ("RC end.") are applied under
  the ruling and are the two the corpus does not itself confirm — both April 2018, eleven months
  before the Chandler drops, neither naming her.

Certified movement: canonical entities 1,335 → **1,334**, mentions 8,227 → **8,239**, adjudicated
tail 3,481 → **3,493**, Resolution Center 2,245 → **2,233**, SEED_VERSION 42 → **43**.
Both registries carry the group: `entities.json` (certified) and `public/data/aliases.json`
(editable). The Firestore master copy was refused — `add-alias.mjs` gets PERMISSION_DENIED
writing `app/aliases` from a script — so the desktop build needs the group added through the app.

Verified in a browser (`scripts/test-archive-alias-visibility.mjs`, new — the existing alias test
only drove `/analysis`):

    search "covid-19"         Includes: covid-19 ×37  COVID ×41  C19 ×11        54 posts
    search "potus"            Includes: potus ×369  trump ×151  Q+ ×36  …      772 posts
    search "Rachel Chandler"  Includes: RC ×8  Ray Chandler ×5  Ray.Chandler ×5  27 posts

`audit-cross-section.mjs` 138/138, `certification-manifest.mjs --verify` clean, deployed.

## 2026-08-14 — warm browser, and a workflow that pays for protection once

Ordinary corrections had started taking 10-20x longer. Measured before changing anything, because
the obvious suspect was wrong: the safety gates cost almost nothing.

    certification-manifest --verify   2.5s
    138 cross-section invariants      4.2s
    apply-entities                    0.7s

The cost was the browser: every check launched Chrome on a BRAND-NEW profile, forcing the app to
re-seed IndexedDB from a 9 MB bundle before a single row rendered — ~40-60s per run, paid again
for every one-line change. Plus fixed sleeps that were simultaneously too slow AND able to race a
slow load, which is how three assertions once failed against a page that was already correct.

**`scripts/lib/browser.mjs`** — one harness, three modes. `warm` reuses a live Chrome and a seeded
profile across runs and across sessions; `fresh` is a first-time visitor; `stale` is a returning
one. Waiting is by CONDITION (`page.waitFor`), never by clock.

    alias visibility check    60s+  ->  16s warm, 9.6s fresh
    inline drop reader        ~70s  ->  5.9s

**`scripts/verify-final.mjs`** — the expensive proof, once, before deploying: manifest →
invariants → FRESH profile → RETURNING/stale profile, then `--live` against qdrops.app after the
deploy. **61s for the whole thing**, and it stops at the first failure rather than running on.

It immediately caught a rotted assertion: `test-returning-profile.mjs` pinned `seed === 7` from the
day it was written and reported FAILURE on a profile that had repaired itself perfectly at seed 43.
It now reads SEED_VERSION from source — the deliberate-bump gate belongs to cross-section
invariant 8, and duplicating it in a browser test only created something that rots.

### The pacing rules, now in PROJECT_CONTEXT.md (owner directive)

1. Warm browser while iterating; the expensive proof once, before deploying.
2. **Infer the mode** — UI/layout/rendering/search is lightweight (no chain, no manifest, no seed
   bump); a Claim/Entity/Theme/Emphasis/Code/Directive ruling is certified-data work. Never ask
   which one it is.
3. **Batch rulings** — apply each canonically as it is made, then chain/QA/manifest/deploy/prove
   ONCE for the batch. Fifty observations, one certification pass.
4. Targeted materialiser + section test while developing; full chain and global invariants before
   deploying.
5. **The final browser proof is never skipped.** Optimise it; do not remove it.

Also worth recording, found while measuring: the Themes tab took **65s to first render** under load
(4s of that is the interaction). Under a quiet machine it is 3.5s. Dev-mode and contention explain
most of it, but the gap is large enough to be worth a look on the production build.

## 2026-08-14 — a theme chip now opens its drops, oldest first, and keeps opening as you scroll

Owner: "when I click on a theme within a post analysis I would like it to show the post numbers
that pertain to that theme… to take it one step further I would like you to display all the post
open in order from the oldest post to latest post."

The chip already linked to `/analysis?tab=themes&q=<theme>`, so the destination screen was right.
Three changes:

1. **Auto-open.** When a search resolves to exactly ONE row, its drops open with no second click —
   the click on the theme WAS the request to read them. Only for a single row: opening every row of
   an unfiltered list would mount thousands of drops. Closing the reader by hand sticks; an
   auto-open that fights the reader is worse than none.
2. **All of them, progressively.** `ReaderSentinel` mounts the next batch when it scrolls into
   view, so scanning opens every drop without a click, while still batching — 404 post cards
   mounted at once locks the tab. The manual "+ more" button stays as the fallback where
   IntersectionObserver is missing.
3. **Oldest → latest by timestamp**, not by post number. Checked first: post-number order and time
   order agree on all 4,966 posts, zero disagreements — so it is the same sequence, now expressed
   as what it means rather than as a property of the numbering that happens to hold.

Applies to every category, not just Themes: searching one entity (COVID-19) or one claim opens its
drops the same way.

Verified on the warm browser in **2.3s** (`scripts/test-theme-auto-open.mjs`): auto-opened,
9, 17, 19, 32, 34, 36…, and 25 → 50 on scroll with no click.

## 2026-08-14 — the theme's name is the way into it

Owner: "make the main topic of the theme clickable so when you click on it, it will open all the
post in the next screen in order."

The row title was a dead `<span>`. It is now a link to `/analysis?tab=<cat>&q=<item>` — the same
destination a theme chip inside a drop uses — where the auto-open lands the row with its drops
already open, oldest first. Applies to every category, so a claim or an entity name opens its own
drops the same way.

This matters most for Themes specifically: a theme label is a summary written ABOUT the drops and
never appears inside one, so a text search for it returns nothing. Before this, the name on screen
was the one thing in the row you could not follow.

Verified (`scripts/test-theme-label-link.mjs`, warm browser): the name is a link → navigates to
`?tab=themes&q=Q Movement & Community` → 25 drops open, 4, 5, 6, 9, 35, 70… and more on scroll.

## 2026-08-14 — a question carries no Emphasis (rendering rule, certified data untouched)

Owner: "if we have a question highlighted app wide i do not want it to be an emphasis. i just want
the question highlighted and no emphasis tied to the question."

**First measurement was wrong and I nearly reported it.** Two probes said "0 emphasis spans touch a
question" — because they read `o.text`, a field that does not exist on an emphasis occurrence (it
is `sourceText` / `line`). `String(undefined)` made every substring test vacuous. A zero from an
unvalidated field name is not evidence of anything. Corrected:

| Shape | Count | Status |
|---|---|---|
| the emphasis span IS the whole question | 0 | retired at seed 38 |
| every line of a parallel run is a question | 0 | retired at seed 38 |
| **emphasis INSIDE a certified question** | **1,429** | this ruling |
| mixed run, only some lines questions | 34 | stands — the device is the structure |

The 1,429 break down caps_emphasis 804 · quoted_word 322 · bracket_emphasis 297 ·
punctuation_intensity 6 — "Where is BO **TODAY**?", "WHERE IS BO TODAY**?!?!?**", "Why did Mueller
**COULD NOT**…".

**Owner chose rendering-only, not withdrawal.** Certified Emphasis stays **4,669**; nothing frozen
moved; no chain, no manifest, no seed bump. Inside a certified question the emphasis layer simply
does not paint, and the hover title does not claim it either. Everything else inside a question
still paints — an Entity is still cyan, a bracket still red. Reversible in one line if the owner
dislikes it.

Applied to BOTH surfaces in the same commit (`PostDetail.tsx` and `lib/postHighlight.tsx`) because
these two have drifted before and shown different colours for identical certified data.

**Brackets — owner rule pinned, not built:** "brackets… should always be in the forefront" and must
not flash. Both surfaces already painted them solid red ahead of every other layer, inside
questions and out. Now asserted rather than trusted to a comment.

Verified in 4.5s on the warm browser (`scripts/test-question-emphasis.mjs`): #50 TODAY, #62 ?!?!?
and #18 COULD all clean and still blue; #4742's four brackets all red, none rotating.

## 2026-08-14 — a question carries no Emphasis, in the DATA this time

The rendering rule was not enough, and the owner found the hole within minutes: post #5 listed two
whole questions under "Emphasis" in the analysis panel. The panel lists an Emphasis row by its
LINE, so suppressing the paint hid it in the drop and left it in every list — archive rows, chips,
search. "I do not want the archives side or the post analysis side to have any emphasis connected
to a question… app wide."

So it became a certified withdrawal, applied as a RULE inside `apply-emphasis.mjs` rather than as
individual withdrawals, so it keeps holding as Questions change.

**Why #5 survived three earlier clauses.** Its line is *"Why did Soros transfer his bulk public
funds to a NP? Note this doesn't include massive slush funds…"* — a certified question PLUS a
second sentence. It equals no question, and its run is not all-questions. The new clause matches by
CONTAINMENT: any line that contains one of THAT POST's certified questions.

Per-post, not corpus-wide — a question asked in one drop must never retire an emphasis in another.
That distinction is worth 14 rows: my standalone estimate said 1,569 by matching questions
globally; the pipeline's own rule, correctly scoped, retired 1,555.

| | before | after |
|---|---|---|
| Emphasis occurrences | 4,669 | **3,114** |
| posts | 1,667 | **1,358** |
| retired by the question rule | 583 | **2,138** (104 + 479 + 1,555) |
| caps_emphasis | 2,418 | 1,556 |
| bracket_emphasis | 715 | 409 |
| quoted_word | 624 | 285 |
| parallel_phrasing | 631 | 591 |
| punctuation_intensity | 157 | 149 |

Brackets lose nothing: [ Brackets ] is its own certified section, so a bracket inside a question
still lists there and still paints red in front of everything — the owner's other rule this session.

Pins updated deliberately in `contracts.mjs`, `sectionInfo.ts`, `apply-emphasis.mjs` and
cross-section invariant 9. #5's Emphasis chips are now `[]`, and a full sweep confirms **0**
remaining occurrences tied to a question anywhere in the corpus.

Still pending for the deploy checkpoint: full chain (resolution queue, relationships and search
index still hold the old emphasis rows), invariants, manifest, seed bump, deploy, browser proof.

## 2026-08-14 — why one ruling took three round trips, and the guard that ends it

The owner had to report the same defect three times. Each pass fixed a real layer and stopped one
short of the layer they were actually looking at:

1. **Measured wrong.** The probe read `o.text`; emphasis rows carry `sourceText` and `line`.
   `String(undefined)` made every containment test vacuous, so it reported 0 spans touching a
   question and I said the ruling was already satisfied. **A zero from an unvalidated field name is
   not evidence.**
2. **Fixed the paint only.** Emphasis stopped painting inside questions — but the analysis panel
   lists a row by its LINE, so #5 still displayed two whole questions under "Emphasis". The owner
   said "the archives side or the post analysis side"; I fixed neither list.
3. **Fixed the data, forgot the seed.** 1,555 rows withdrawn, posts.json correct, every check
   green — and the owner's browser still showed the old rows, because seeded data is only re-read
   when SEED_VERSION changes. Fourth occurrence of this exact failure (4, 5, 6, and here).

**`scripts/seed-fingerprint.mjs`** ends the third one mechanically. It hashes every artifact the app
seeds and pins it to the SEED_VERSION that shipped it. Change seeded data without bumping the seed
and cross-section invariant 8 fails, naming the files that moved. Proved by deliberately mutating
`topics.json`: the guard refused, named it, exited 1; reverted, clean.

Rules 1 and 2 are recorded in PROJECT_CONTEXT.md: validate the schema before trusting a zero, and
finish at the surface the owner named — chips, rows and search, not just the highlight.

Verified on a STALE profile (`scripts/test-post5-emphasis.mjs`): seed 44, #5's stored emphasis
`[]`, nothing listed under Emphasis in the panel — on a browser that had the old data.

## 2026-08-14 — three owner rulings on #5 and #4965, one of them corrected by the corpus

**"Clinton's" in #5 = Hillary AND Bill.** Recorded as two owner entity rulings on the same token,
because the possessive is plural and precedence-picking one of them would answer a question the
owner did not ask. Hillary Clinton 179 -> 180 mentions, Bill Clinton 11 -> 12, entity headline
8,239 -> 8,241. Queue row `Clinton-5-5-85` cleared.

**"NP" in #5 — the owner ruled Nancy Pelosi, and the corpus disagreed.** Raised before applying,
with the evidence:

    #5   "Why did Soros transfer his bulk public funds to a NP?"
    #36  "Why did Soros transfer the bulk of his ‘public’ funds to a NPO?"

Same question, and NPO is a non-profit organisation. The indefinite article makes it a category,
not a person — and #5 already writes "Pelosi" in full two lines earlier, so it had no need of an
abbreviation for her. Owner agreed: non-profit in #5/#6, NPO in #36. NP genuinely IS Nancy Pelosi
elsewhere (#436 "SUPPORT: CS, NP, AS", #524, #678 "CS & NP divided.", #1379 "[NP 8:11 'Speaker…']"),
and those stay queued. **Same wording retrieves candidates; context decides membership** — this is
the rule earning its keep, and the reason a ruling is checked against the corpus before it is
applied everywhere the token appears.

Resolved with `createsNoCategory`: "a non-profit" is a common noun, and naming it as an Entity
would put a category into a layer that holds specific named things. Same shape as the #150 [L]
resolution. Resolution Center 2,233 -> 2,231.

**#4965 "In time." -> Claim.** It carried no Emphasis row at all — it was a Context unit. Claims
4,188 -> 4,189 (distinct 3,229, posts 1,954), Context 4,900 -> 4,899.

**Structural fix while in there:** `apply-context-units.mjs` now releases ANY owner-adjudicated
claim from Context, reading `claims-final.json` directly. It previously only handled theme rulings,
and the five "Pure EVIL." claim promotions had been edited into the ledger by hand — so this ruling
would have left "In time." in Claims AND Context at once, the exact contradiction that file's own
comment says must never exist. Now every future claim ruling releases its Context automatically.

## 2026-08-14 — DEPLOYED: the whole session's batch, seed 45

**#4963 "Focus." / "FOCUS." -> Directives** (owner ruling). They were Emphasis (repeated_word),
which describes the repetition rather than the instruction. Two occurrences, not one counted twice
— occurrence identity. Directives 2,422 -> 2,424, Emphasis 3,114 -> 3,113. New overlay artifact
`audit/directives-owner-rulings.json`, merged by apply-directives.mjs after the certified set is
assembled, so a re-derive cannot erase it — the same pattern Entities, Themes and Emphasis use.
Directives was the last certified layer without one.

**"1 request" -> "1 directive"** on the post card. The section was renamed Directives everywhere
else; this chip kept the old word, so the two builds described the same certified layer with
different names.

### The deploy checkpoint, paid once for the whole session

    chain replayed twice        byte-identical — a proven fixed point
    invariants                  139/139
    manifest                    re-certified, verify clean
    seed                        45
    local proof                 fresh + returning profiles
    deploy                      SKIP_EXPORT=1
    live bundle                 md5 identical to local
    live proof                  fresh + returning profiles against qdrops.app

`SKIP_EXPORT=1` deliberately: a real export would have deleted the `customBrackets` on #437, #438,
#1254, #1319 and #1464, which exist locally and not in Firestore because the deployed rules deny
the editing build's writes. The manifest gate still ran — the skip removes the network, not the
check.

**verify-final.mjs had a bug the proof itself caught:** `test-returning-profile.mjs` defaults to
qdrops.app, so the LOCAL phase was checking production for a seed production had not been given
yet, and reported the change broken when it was merely undeployed. It now passes `--url` explicitly
in both phases, and the live phase checks the returning profile too — the case that matters most on
production.

### Certified state now live

| section | count |
|---|---|
| Questions | 6,442 |
| Directives | 2,424 |
| Claims | 4,189 |
| Predictions | 630 |
| Evidence | 6,590 |
| Entities | 1,334 canonical · 8,241 mentions |
| Themes | 2,395 |
| Codes | 1,949 |
| Emphasis | 3,113 |
| Resolution Center | 2,231 |

## 2026-08-14 — #4963 reclassified, Implied Conclusions retired, Search out of the sidebar

Deployed, seed 46. Owner rulings, numbered as the owner now asks for:

1. **#4963 SOS out of Emphasis** — it is part of the entity "SOS Offices.", not a caps device.
   Emphasis 3,113 -> 3,112.
2. **#4963 SOS Offices. / Investigators. / Researchers. / Whistleblowers. / Patriots -> Entities.**
   1,334 -> 1,339 canonical, 8,241 -> 8,246 mentions. All five were Context.
3. **#4963 "Patriots in trusted positions." and "Time to show the world." -> Claims.**
   4,189 -> 4,191.
4. **Implied Conclusions retired as a section.** All 966 were ALREADY certified Claims — the field
   is derived from the claim attribute `isConclusion`, so 966 of 966 were claims before this. The
   duplicate VIEW is gone (sidebar, chips, count badge, highlight layer); the rows and the
   attribute stay. Spans that used to rotate claim+impliedConclusion now paint solid amber.
5. **Search removed from the sidebar.** The /search ROUTE stays live — every "also found in" chip
   points at it — it just no longer holds a permanent slot above Q Questions.
6. **Search summary hoisted above the Delta section** on Post Archive, so what you searched and how
   many hits it returned is visible without scrolling past the timeline.

**The pipeline caught a real conflict on #2:** `Patriots` was routed to Themes by the adjudication
as "a conceptual collective", and the invariant refuses an entity that is also theme-routed. The
owner ruling outranks an adjudication pass, so the check now exempts owner rulings — and ONLY owner
rulings, because its actual job is stopping the DETECTOR leaking a routing marker into the entity
set. Recorded rather than bypassed.

**Structural:** `apply-context-units.mjs` now releases Context for owner ENTITY rulings too, not
just themes and claims. A line the owner named as an entity has been placed in a category, so it
cannot also be "reviewed and in none". 9 rulings now release their Context automatically.

Chain replayed twice byte-identical · 139/139 invariants · manifest re-certified · fresh +
returning profiles locally · live bundle md5-identical · fresh + returning profiles against
qdrops.app.

## 2026-08-15 — every Patriot/Patriots is one Entity; the drop's own number connects

7. **Drop header post number is a link** (#4963 -> /posts?q=#4963). It was the one post number on
   screen that connected to nothing — the card number and the analysis chips were already links.

8. **Patriot / Patriots -> one Entity, corpus-wide.** 239 occurrences across 221 posts:
   Patriots 119 · Patriot 82 · PATRIOTS 31 · PATRIOT 3 · patriot 3 · patriots 1. Compounds
   (PatriotsFight, patriotism, PatrioticPop) excluded by the word boundary — verified, not assumed.
   Entities 1,339 -> 1,338 canonical, 8,246 -> 8,482 mentions.

**A measurement error worth recording, because it is the SECOND of its kind today.** The first
count said 0 occurrences of every case form while a case-insensitive probe found 239. Cause:
`new RegExp('\bPatriots\b')` written through a shell heredoc collapsed to a literal BACKSPACE
character, so the pattern was "Patriots" with an unmatchable control char. Same shape as the
`o.text` field error this morning: a probe that silently matches nothing reports a clean corpus.
Probes now use regex LITERALS or String.raw, and a zero is checked against a second method before
it is believed.

**Two pipeline capabilities added, both because the data demanded them:**
- `recount` on an alias ruling. "Patriots" existed as a one-post alias (n=1) from the #4963 ruling;
  without recount the corpus-wide ruling was skipped as "already present" and 118 occurrences
  stayed uncounted.
- `merges`. The tail adjudication had its own "Patriot" (person, 2 mentions); two canonical rows
  claiming one token double-count it. The merge moves mentions ONLY for aliases the target does not
  already count, and drops the merged row's tail occurrences from emission — both discovered by the
  materialiser refusing to write 8,484 stored against 8,482 certified, twice, for two different
  reasons. The gate caught both.

Chain twice byte-identical · 139/139 · manifest re-certified · seed 47 · local + live proofs.

## 2026-08-15 — the drop header actually connects, and Checkable Claims folds into Claims

9. **"Post #8" — the whole label links, and it now goes somewhere useful.** The first version
   linked to `/posts?q=%238`, which is a TEXT SEARCH for the literal string "#8": it landed on a
   one-post search page with a facet strip and a timeline — the opposite of seeing a drop in
   context, and I had described it as the opposite of what it did. The archive already had the
   right mechanism ("Go to Post" scrolls the list to that card and flashes it, loading more of the
   list if needed); it was driven by a text box and had no URL. `/posts?goto=N` now drives the same
   jump, and the entire "Post #8" label is the link rather than the digits alone.

10. **Checkable Claims merged into Claims.** All 1,926 were ALREADY certified Claims — 0 needed
    adding, so nothing moved and nothing double-counted. Same shape as Implied Conclusions: a
    filtered VIEW of Claims (the `checkable` attribute), presented as a section. Removed from the
    sidebar, the post chips, the count badge, the highlight layer, the term-presence facets and the
    archive tab. The attribute survives on `claimMeta` for provenance, so the distinction is
    recoverable as a filter if the owner ever wants it back.

    `getTermPresence` and the analysis-frequency category lists dropped both retired sections in
    the same edit — they were counting one row under three headings.

**Three build failures worth recording, all mine, all caught by gates rather than by the owner:**
- The cross-section invariant pinned `checkableSpans ??` in the highlighter. Retiring the layer
  made a check of a layer that no longer renders fail forever, so the assertion moved to
  "the retired layers are GONE" — tightened, not relaxed.
- That new assertion then matched its own COMMENTED-OUT code. Dead lines deleted rather than
  teaching the regex about comments.
- `npm run deploy:web` type-checks and refused twice: `OverlapCat` still types both retired
  categories (the editorial overlaps view can still surface a legacy row), and my blanket
  re-insert duplicated two keys. The deploy aborting is the gate working — nothing shipped broken.

Chain twice byte-identical · 139/139 · manifest clean · seed 47 · local + live proofs.

## 2026-08-15 — #524, and a question the detector could not see

11. **"(Why don't we say his name?)" is a Question.** It was CONTEXT, not Emphasis — grey is the
    Context colour. The question detector anchors on a line ENDING in '?', and this one ends in
    '?)': the closing parenthesis defeats the test. Questions gained the owner-ruling overlay every
    other layer already had (`audit/questions-owner-rulings.json`). 6,442 -> 6,443.
    **50 lines corpus-wide have that shape** (`?)`, `?]`, `?"`) and are not certified questions —
    a candidate set for a future ruling, not applied.
12. **Searching a bare post number now jumps to that drop.** "524" used to search the TEXT of every
    drop for "524" and find nothing useful; the number lookup lived in a separate box beside the
    search field, which is not where anyone looks first.
13. **NP in #524 IS Nancy Pelosi** — and in #5 the same token is a non-profit. One token, two
    referents, decided by context. Recorded per occurrence with each ruling naming the other.
14. **CEOs and BODs are Entities** (CEO, BOD). 1,338 -> 1,340 canonical, 8,482 -> 8,485 mentions.
15. **Five #524 lines are Claims** (4,191 -> 4,196). The matcher had to learn Q's indent markers:
    ">&gt;Hussein [1] $29,000,000 SINGAPORE" is stored certified WITHOUT the '>>', so a ruling
    written as the owner reads it was refused as "not found verbatim" until `stripMarkers` was added.

**The debt invariant did its job.** Certifying ">Slush Fund" moved the source-boundary baseline
146 -> 147 and 118 -> 119 posts, because Q's single '>' indent marker makes the segmenter read that
line as source material. The gate named the exact row — `claims::524|slush fund` — and the baseline
was moved deliberately, with the occurrence and the reason written into
`audit/source-boundary-occurrences.json` changeLog. That is the rule from the very first handoff:
never move a debt baseline on an explanation that does not hold.

**Also closed a hole in the Context release:** an owner QUESTION ruling now releases its Context
unit, like theme, claim and entity rulings already did. #524's question was certified and still sat
in Context — one span presented as both classified and unclassified.

Chain twice byte-identical · 139/139 · manifest re-certified · seed 48 · local + live proofs.

## 2026-08-15 — the phrase opens its own drops, and the archive jump actually arrives

16. **The analysis phrase IS the control.** Clicking "These people are stupid." opens every drop it
    appears in, in place, oldest first — the same thing "▼ read 39 drops" does. It used to navigate
    to this section filtered to that row, which left the page to do what the row can do itself.

17. **The archive jump was broken, and not by the new link.** `handleGoToPost` has always set a
    jumpTarget and let an effect page the list in until the card exists. That effect read
    `if (hasMore && !loadingMore) load(false)` and fell through to
    "#N is not in the current list" when EITHER was false — so the moment a page started loading,
    the next render took the error branch and cleared the target. The jump loaded exactly ONE extra
    page, then declared the post missing. Anything past the first ~100 rows of the current sort was
    unreachable: "Go to Post 524" failed on a list that simply had not got there yet.
    Now it waits while a page is in flight, and both the box and the header link approach from the
    end the post is NEAR — #524 is eleven pages ascending, versus eighty-nine descending.
    `scripts/test-goto-jump.mjs` drives #8 and #4900, the worst case at each end, and requires the
    CARD rather than the absence of an error.
18. **NP is an alias of Nancy Pelosi corpus-wide — except #5 and #6**, where the owner ruled the
    same token a non-profit. 7 occurrences, mentions 8,485 -> 8,491. #5 still lists Pelosi because
    that drop writes her name in full two lines above; #524 now carries NP. One token, two
    referents, and the exclusion is what keeps one owner ruling from overwriting another.

The `excludePosts` mechanism that made 18 possible already existed — the parallel session had added
it for a different alias hours earlier. Worth noting as a case where two sessions converged on the
same need independently.

Chain twice byte-identical · 139/139 · manifest re-certified · seed 49 · local + live proofs, plus
the jump test against production.

## 2026-08-15 — the jump lands on the drop, and the two NPs become two entities

19. **The jump arrived ~30 drops short.** The card mounted, the scroll fired, and rows above it
    were still being committed — every one a different height — so the page settled well before the
    target. It now re-anchors on a few frames after the first scroll. The test was the real problem:
    it asserted the card was MOUNTED, which was true while the reader was looking at #491. It now
    requires the card to be ON SCREEN and to be the drop at the CENTRE of the viewport, checked at
    #8, #4900 and #524 — both ends and the middle.
20. **Nancy Pelosi and the non-profit are now separate entities.** NP is her alias corpus-wide
    except #5/#6; those two carry a distinct "Non-profit organization" entity (2 mentions), so a
    search for her can never return the non-profit. 1,340 -> 1,341 canonical, 8,491 -> 8,493.
    #5 still appears under Nancy Pelosi — because that drop writes "Pelosi" in full two lines above
    the NP. That is the literal name, not the alias, and it is correct.

"Mounted is not arrived" is the lesson worth keeping: three versions of this feature failed in
three different ways, and each time the test asserted something weaker than what the owner could
see. A check that passes while the screen is wrong is worse than no check.

Chain twice byte-identical · 139/139 · manifest re-certified · seed 50 · local + live proofs.

## 2026-08-15 — first owner claim review, and the jump stops walking the archive

21. **12 of the 21 predicate rows certified as Claims** (4,196 -> 4,208); #1077 "Prevent at all
    costs." certified as a **Directive** (2,424 -> 2,425). The owner declined 8 by pointing at the
    line ABOVE each one: #1535, #1633, #2639 and #839 were already certified Directives, and
    #1268's line is an entity. **PRINCIPLE, now recorded: a predicate inherits a subject only from
    a PROPOSITION.** Where the preceding line is a Directive or an Entity there is nothing to
    inherit, and the row stays unclassified. That narrows the remaining 393
    answers_previous_question rows before the owner ever sees them.

    Two held back rather than guessed:
    - #1443's row says "EVIL." but Q wrote "GOOD vs. EVIL." — the ledger split the line, and the
      fragment is not the same assertion as the sentence.
    - #1268 "Army Lt. Gen. Paul Nakasone": "Paul Nakasone" and "Army" are ALREADY certified
      separately inside it. One entity over the whole title needs a supersede-partials mechanism,
      or one man is counted three times.

22. **The jump opens the list AT the drop.** It used to page from the top: fifty at a time, ninety
    eight round trips to reach #4900. Bigger pages took it from 30s+ to ~6s; opening at the drop's
    own index takes it to **1.6-2.1s**, because the archive no longer mounts thousands of cards to
    reach one. Landing is still asserted at the CENTRE of the viewport, at both ends and the middle.

Chain twice byte-identical · 139/139 · manifest re-certified · seed 51 · local + live proofs.

## 2026-08-15 — deploy-every-fix, and the lowercase "sessions" alias withdrawn

**STANDING RULE from the owner: deploy after every fix.** No more staging a batch — each change
goes live so it can be checked from the user's side. Recorded in PROJECT_CONTEXT.

24. **Lowercase "sessions" withdrawn as an alias of Jeff Sessions.** It painted "friendly therapy
    sessions" (#2319) as the man, and the corpus's other lowercase occurrences sit inside news URLs
    (nypost.com/…/sessions-investigating…, breitbart.com/…/turley-sessions-using…). SESSIONS (56),
    Sessions (52) and Jeff Sessions (2) are untouched — 108 of the 113 mentions were never in doubt.
    Mentions 8,493 -> 8,490. New mechanism: `aliasWithdrawals`, filtered BEFORE the mentions are
    counted so the count and the emitted occurrences drop together instead of disagreeing.

Also now live (staged earlier, unverified until this deploy):
- questions paint in the analysis drop reader — the third surface that builds its own card
- the Resolution Center lists every row instead of 25 at a time, growing on scroll
- the queued token is highlighted inside its context (130 DC marks on /resolve?token=DC)

**A verification error worth recording.** I reported the Resolution Center work as "written but I
could not verify it renders" — because I probed `/resolution`, which 404s. The route is `/resolve`.
The code had been correct the whole time. Same shape as the `o.text` field error and the collapsed
`\b` regex: a probe that examines nothing reports failure as confidently as success. Check the
route exists before concluding the feature does not.

Verified on PRODUCTION: #2319 lowercase sessions no longer painted as an entity; /resolve?token=DC
shows 130 highlighted DC marks and no 25-row pager. 139/139 · manifest clean · seed 52.

## 2026-08-15 — SR / NG rulings, and owner notes on rows that stay (seed 59)

**Asked:** resolve SR as Seth Rich in 9 drops; do NOT resolve 4 others but leave notes on them;
resolve all NG as National Guard; and "did we have 1 BO in the resolution center i dont see it?"

**BO:** yes — #235, id `BO-235-0-9`, still the only BO row. It was there the whole time.

**New capability — owner notes.** There was no way to record "I looked at this and it is NOT the
obvious reading" without either resolving it (which moves certified counts) or saying nothing
(which loses the reasoning). Added a third state:
  - `audit/resolution-owner-notes.json` — keyed by occurrence id
  - attached in `build-resolution-queue.mjs` AFTER clearing, so a note can never remove a row
  - rendered in the Resolution Center as an amber "Owner note · left unresolved" block, and
    searchable — typing "susan rice" now finds #559 even though the drop never writes the name.

**SR — 9 resolved, 4 noted.** Seth Rich in #834, #1199, #1226, #1462, #1493, #1591, #1626, #1708,
#4153 (10 occurrences). Scoped, not global: SR is Susan Rice in the #559 Hussein-cabinet roster and
the SENIOR rank in #1573 ("WH SR Staffer"), #2658 ("SR+MID+LOW") and #4640 ("Pentagon [SR 1-4]").
A corpus-wide SR alias would have filed a seniority scale under a murdered man.
Seth Rich 8 -> 15 mentions (SR n=10).

**NG — all 9 drops, 13 occurrences.** National Guard in #1, #3, #22, #38, #70, #76, #128, #1020,
#1862. #128 stays NG though the drop calls the surrounding claim disinformation — the abbreviation
still means the National Guard. National Guard 3 -> 16 mentions.
The owner's "duplicate cards" are not duplicates: #1 has NG twice in one line, #22 on three lines,
#1020 on two. Occurrence identity, working as designed.

**Counts:** mentions 8,717 -> 8,737 (SR 10-3 already counted = 7, plus NG 13). Queue 1,978 -> 1,955.
Entity queue 1,310 -> 1,287.

**Defect found in passing:** `build-search-index.mjs:193` carried the label "Unresolved indexed =
2,233" guarding an assertion of `=== 1978`. The label had drifted from its own check across an
earlier batch. Both now read 1,955. A label that lies about what it enforces is how a pin stops
being a pin.

**Gates:** chain replayed twice (idempotent), 139/139 invariants, manifest verified, tsc clean,
fresh + returning profiles locally and on production, and all four owner notes confirmed rendering
on the live site.

## 2026-08-15 — DNI / MI / SIS, and a silent-data-loss repair (seed 60)

**DNI — all 13 cards, Director of National Intelligence.** New entity: nothing in the corpus
spells the office out, so no pass ever created it. One entity covers both senses the owner
described (the officeholder in #436/#3347/#4238/#4839, the office/ODNI in #1286/#3532/#4153/#4813,
the role-with-holder in #1828 "[DNI [JC]]" and #3595). All 13 corpus occurrences are inside the
11 ruled posts, so the scope is complete rather than partial.

**MI — 18 Military Intelligence, 1 Michigan.** The owner ruled 11 cards MI and #4171 Michigan.
Five further posts (#2, #11, #14, #23, #36 — "MI generals", "MI has the same SAPs as NSA, CIA")
were ALREADY certified Military Intelligence and had to be added to the scope or the recount would
have deleted them. Military Intelligence 17 -> 28, Michigan 2 -> 3.

**SIS — MI6 in 8 drops.** Attached to the EXISTING MI6 entity rather than creating a second
"Secret Intelligence Service" record: they are one organization, and splitting them would mean a
search for MI6 never returns the SIS drops. MI6 6 -> 15. The other 4 cards stay queued with notes
(#1385 FBI Special Intelligence Service + the authored "Double meanings exist" ambiguity, #144
probably the Army Signal Intelligence Service, #1334 undecidable between three readings).

### The real finding: scoped recounts were silently deleting certified occurrences

`recount: true` REPLACES an alias count with a count over `includePosts`. An occurrence the
certified CONTEXT PASS had already resolved, sitting outside the owner's scope, therefore vanished
from the count and from the highlighting — while entities.json still listed the post. Nothing
failed, because every total simply agreed with the smaller number.

Found while checking whether the SR ruling had done it — it had. Audited every scoped ruling:

  Seth Rich   3 occurrences  #1195, #436 x2   ("SR connect to DNC. MS_13. JA.", "(SR 187)")
  BO         13 occurrences  11 Obama, 2 Board Owner
  SC          6 occurrences  #1153 #1161 #1649 #2205 #4545 #4813

22 restored. None of these were ever in the Resolution Center — the context pass answering them is
exactly why they were never queued — so restoring them pre-empts no owner decision, and the 59 SC
and 1 BO rows still queued are untouched. Barack Obama 225 -> 236, Board Owner 9 -> 11,
Supreme Court 40 -> 46, Seth Rich 15 -> 18.

New invariant `entities-scope-drop` (140 total) fails the build if any scoped ruling drops a
context-resolved occurrence. This class of bug cannot recur silently.

**Counts:** mentions 8,737 -> 8,793. Entities 1,341 -> 1,342. Queue 1,955 -> 1,921.
Also corrected the user-visible `mentionScope` prose, which claimed "6 from owner rulings" when
the real figure was 266 — stale by many batches.

**Gates:** chain replayed twice, 140/140 invariants, manifest verified, tsc clean, fresh +
returning profiles local and live.

## 2026-08-15 — RT split three ways, and the reader info box (seed 61)

**RT — 4 Rex Tillerson, 8 real time, 1 retweet.** Rex Tillerson is a new entity (#947 x2, #959,
#2844). The other 9 cards were resolved and removed from the queue WITHOUT becoming entities:
"this is not a person, place or organization" is a complete answer, and forcing it into the entity
registry to close a queue row would corrupt the registry to tidy a list.
Mentions 8,793 -> 8,797. Queue 1,921 -> 1,908.

**NEW: the reader info box.** Hover or press any acronym / initialed name, on any post, app-wide.
  audit/notation-glossary.json   owner glosses for shorthand that is NOT an entity
  scripts/build-glossary.mjs     -> public/data/glossary.json (109 tokens, 4 contested)
  src/lib/glossary.tsx           one shared layer for PostDetail, PostCard and the inline reader

POST-AWARE, which is the entire point: BO reads Barack Obama in #36, Bruce Ohr in #1828, Board
Owner in #1296; RT reads Rex Tillerson in #947 and "real time" in #220. Per-ALIAS post lists, not
per-entity — Barack Obama appears in 147 posts but BO is only his in 24, and using the entity list
would have put "BO = Barack Obama" on the Bruce Ohr drops. Zero posts resolve to two readings.
Where a token IS contested in a drop, the box says nothing rather than guessing.
Entities show canonical + type + archive-wide mentions; glosses are dotted-underlined and labelled
"not an entity" so they can never be mistaken for one of the eight certified categories.
This also settles the pending NP/#524 item — NP reads Nancy Pelosi there and Non-profit in #5/#6.

Three defects found by the new test, each invisible to the one before it:
  1. only matched when a node's WHOLE text was the token — worked on "DNI DIR>", did nothing on
     the nine drops where the acronym sits inside a larger certified span
  2. the token splitter swallowed trailing punctuation, so "RT." in "analyzed in RT." matched
     nothing (the pattern has to allow periods because "U.S." is a real alias) — now peels
     punctuation off and glosses the head
  3. one-level descent missed questions, which carry nested structure in PostDetail — now recurses
Also: the test itself was wrong first. It queried on body-ready, before glossary.json had loaded,
so a different single case passed each run and the other nine looked broken. The feature was fine.
Now waits on the target.

scripts/test-term-info.mjs asserts MEANING per drop (10 cases, 20 checks) and runs in both halves
of verify-final — "a box appeared" is not the property that matters when BO is three people.

**Gates:** chain replayed twice, 140/140 invariants, manifest verified, tsc clean, fresh +
returning + info-box proofs local and live.

## 2026-08-15 — Seven tokens, 92 occurrences (seed 62)

  JA   -> Julian Assange          12 cards
  PP   -> Planned Parenthood      12 cards
  WL   -> WikiLeaks               12 cards
  BC   -> Bill Clinton            18 cards across 14 posts
  CM   -> CodeMonkey 11 + Cheryl Mills 1 (#1828: grouped with HRC/BC/Huma, not board terms)
  SS   -> Secret Service 11 + Supreme Court 1 (#1151)
  WASH -> Washington Post 12 + Washington Free Beacon 1 (#1828) + Washington, D.C. 1 (#524)
          #1493 and #1731 stay queued — owner marked them unresolved and gave no reading.

New entities: Cheryl Mills, Washington Post, Washington Free Beacon.
Mentions 8,797 -> 8,889. Entities 1,343 -> 1,346. Queue 1,908 -> 1,816. Glossary 109 -> 113 tokens,
7 of them contested and disambiguated per post.

**The SS typo, recorded as a typo.** #1151's "SS/LL deal" resolves to Supreme Court, but showing a
reader "SS = Supreme Court" with no explanation looks like a mistake in the data. Added an optional
`readerNote` on an alias ruling, surfaced as the info box's detail line: "Written SS, but read as
SC — an apparent typo. #1147 has SC/LL deal and #1150 discusses Loretta Lynch being promised a
Supreme Court seat." The audit `reasoning` field is invisible to readers; this is the visible half.

**The scoped-recount guard earned its place.** JA, WL and BC each had context-resolved occurrences
outside the owner's lists — #1199; #1870, #3764, #4162; #36, #1220, #1556, #3383. Folded into
scope before applying, so 8 more certified occurrences were preserved rather than deleted. That is
the class of loss that cost 22 occurrences before the invariant existed.

#1828 is now the sharpest test of the info box: CM reads Cheryl Mills and WASH reads Washington
Free Beacon in the same drop, while CM is CodeMonkey and WASH is the Washington Post elsewhere.
test-term-info.mjs covers 21 cases / 42 checks and runs in both halves of verify-final.

**Gates:** chain replayed twice, 140/140 invariants, manifest verified, tsc clean, fresh +
returning + info-box proofs local and live.

## 2026-08-15 — Info box: off-screen fix + acronym coverage (seed 63)

**The box was unreadable where it was needed most.** Absolutely positioned and centred above the
token, so an acronym near a line end opened half outside the window, and one near the top of a
drop opened upward into nothing. Owner: "it is mostly off screen so i cant read what it is."
Now `fixed` (the post body sits in a <pre> with its own overflow, which clipped an absolute box no
matter the offset) and clamped to the viewport on BOTH axes. Closes on scroll, resize and Escape.

Preferring "above" and trusting that branch still failed 6 of 21 cases — the branch was chosen
from the anchor's position, and an anchor below the fold makes "above" overflow the bottom.
Neither branch is allowed to leave the viewport now. The test asserts the RECTANGLE, not the text:
21 cases x 3 checks = 63.

**28 entities are NAMED with an acronym and had no box at all** — POTUS (370 mentions, the most-
mentioned entity in the archive), CNN, DARPA, MI6, SDNY, GCHQ, SCIF, ISIS, NXIVM... The builder
only glossed aliases DIFFERING from the canonical, which is right for DOJ -> Department of Justice
and excluded every entity actually named with its acronym, where "POTUS means POTUS" explains
nothing. audit/acronym-definitions.json now supplies expansions: 27 defined, LORD deliberately
left out (certified as an entity, not actually an acronym, and its 2 occurrences do not establish
whether Q means a title, a surname or a religious address — recorded rather than guessed).
Glossary 113 -> 140 tokens. Brackets checked: 0 bracket codes are acronyms, so nothing missing.

**Standing rule, made mechanical.** Owner: "any acronyms or names that come in moving forward will
still continue to define them as they are known." Invariant `entities-acronyms-defined` (141 total)
fails the build if an acronym-named entity ever ships without a definition or a stated reason.
Aliases need nothing — they resolve to a full canonical name by construction. A promise to
remember is not a mechanism; the gate is.

**Gates:** chain replayed twice, 141/141 invariants, manifest verified, tsc clean, fresh +
returning + info-box proofs local and live.

## 2026-08-15 — DAG / JB / JK / HCQ / NYC / RBG / AWAN, 74 cards (seed 64)

  DAG  -> Deputy Attorney General   10 cards, resolved as the OFFICE
  JB   -> John Brennan 8 / James Baker 1 / Jeff Bezos 1
  JK   -> Jared Kushner 7 / John Kerry 3
  HCQ  -> Hydroxychloroquine 7 Reference; 4 Device cards ruled NOT emphasis
  NYC  -> New York City 11    RBG -> Ruth Bader Ginsburg 11    AWAN -> Imran Awan 11

New entities: Jeff Bezos, New York City. Mentions 8,889 -> 8,959. Queue 1,816 -> 1,742.

**DAG stays the office.** Owner: "resolve the abbreviation as the office/title, not automatically
as one person." Rosenstein is the officeholder in #1990/#2135/#2943/#3004/#3062; #3210 and #3211
span TWO officeholders (a quoted 2016 message from Sally Yates's tenure plus commentary about
Rosenstein) and must not be collapsed. Carried as PER-POST reader notes — new `readerNotesByPost`,
because one note for the whole ruling would be wrong on most of its own posts.

**Occurrence-level scoping, new.** #1828 writes JB five times: four John Brennan, and the one
inside "[FBI [JC][AM]…[JB][MK]…]" is James Baker. includePosts is post-level, so two rulings would
both claim the drop and count all five twice. `includeOccurrences` addresses an occurrence by
[line, char] — the SAME coordinates the queue row id uses. A first attempt matched whole-text
offsets and found 0 of 4: the queue has always numbered characters within the line.

**The info box now names both readings** when a drop is genuinely split, instead of staying
silent. Silence was right while rulings were post-level; after an occurrence-level ruling it hid a
distinction the owner had deliberately drawn.

Two of my own errors, both caught by counting rather than by reading:
  - the emphasis-resolution pattern /^emph-(4137|4282)-/ swept in 3 COVID rows in the same posts.
    Caught because the batch totalled 77 against the owner's 74. Removed, pinned to the 4 ids.
  - invariant rc-emphasis-complete compared the queue against the borderline TOTAL, so the first
    four cases the owner ever answered read as four that never arrived. Completeness is
    queued + owner-resolved; a case that left the queue by being decided is the system working.

The 4 HCQ Device cards sit in the emphasis AMBIGUITY list, not the certified Emphasis set, so no
Emphasis count moved. The withdrawal is recorded anyway, so if a later pass ever promotes those
lines the owner's ruling suppresses them.

**Gates:** chain replayed twice, 141/141 invariants, manifest verified, tsc clean, fresh +
returning + info-box (30 cases / 90 checks) proofs local and live.

## 2026-08-15 — 11 tokens, 233 cards (seed 65)

  MZ  Mark Zuckerberg 11        NY  New York 18 + New York Post (#1515)
  LL  Loretta Lynch 21          BLM Black Lives Matter 24      AUS Australia 26
  JFK five referents: President Kennedy 14, JFK Jr (#1082), the airport (#1588),
      Gen. John Francis Kelly (#1433 — J.F.K. are his own initials), JFK Conference Room (#709)
  CS  CrowdStrike 2 / Christopher Steele 8 / Chuck Schumer 11 (incl. #559 on the updated ruling)
  JC  James Comey 18 / James Clapper (#1828 [DNI [JC]], occurrence-scoped)
  ES  Eric Schmidt 15 / Edward Snowden 6 — Q writes "ES = @Snowden" outright in #1911
  Jack Dorsey 20; #4632 x2 NOT shorthand — Jack W. Gardner (given name) and Larry Jack Schwarz
      (middle name), two different people occurrence-scoped inside one drop
  PS  Peter Strzok 20 / PlayStation 3 / postscript (#15 — not an entity at all)

226 resolved, 7 HELD with the owner's reasons on the card: JFK #742/#743 (the slash is doing the
work and the slash is not explained), JC #1591 (nothing separates Comey from Clapper), JC #559 x2
(two men, order unknown — explicitly NOT both Comey), ES #4533, PS #1380.

6 new entities. Mentions 8,959 -> 9,185. Queue 1,742 -> 1,516. Glossary 153 tokens, 15 contested.

Owner listed AUS as 25; the queue holds 26 because #1164 has two AUS occurrences. The ruling is
post-level and the owner ruled the post Australia, so both resolve. Flagged rather than silently
absorbed.

STILL OPEN from this message: the 17 Censorship & Technology THEME cards (keep 6 / clear 11).
Themes have no withdrawal path — the 17 are `ambiguous` rows, so "keep" means ADDING a theme
assignment via themes-owner-rulings.json and "clear" means resolving the row with no data change.
Not attempted in this batch; the entity work shipped first.

## 2026-08-15 — WASH POST joined, + ABC / RE / OP (seed 66)

**WASH POST is one entity now.** The owner saw three separate WASH highlights on #2401 where the
drop writes "WASH POST" three times — half a name presented as the whole reference. The alias is
the full two-word form (all 12 occurrences: #2401 x3, #2468, #2519 x3, #2549, #2627, #2715 x2,
#4310), and every other WASH ruling carries notFollowedBy so a bare WASH can never claim the first
half of it. Same shape as COVID-19 vs COVID, solved the same way. Checked corpus-wide: exactly 12
WASH+POST pairs, and the 5 bare WASH occurrences are unaffected (#524 D.C., #1828 Free Beacon,
#1493/#1731 still queued, #4554).
The glossary's isShorthand test was widened to accept two-word all-caps names, or the name the
owner had just asked to join would have been the one name with no info box.

**ABC — 27 cards.** ABC News 16. CIA 2, with per-post confidence recorded where the owner drew it:
#1806 high (the linked CIA-Amazon cloud article), #2549 medium (carried on the #1806 parallel, not
established in that drop alone). 8 generic "alphabet agencies" glossed as notation — in #2401 the
CIA is the linked example but the phrase stays plural, so it is not a named entity. #1379 HELD:
"[ABC] has an interest in this…" supplies no identifying context, and the token alone is not
evidence.

**RE — 29 cards.** Rahm Emanuel in #1828 only, inside a bracketed list of Obama White House
figures. The other 28 are the ordinary "RE:" = regarding.

**OP — 30 cards.** Operation Mockingbird (#626, joined as "OP Mockingbird" on the same principle
as WASH POST). #836 names an operation called Fiddler — glossed as that rather than invented into
a canonical "Operation Fiddler", a name Q never writes. 27 generic "operation". #1745 is a FALSE
MATCH: the letters sit inside "CO-OP STRATEGY".

65 of the 85 cards are notation and move no count: mentions 9,185 -> 9,205. Queue 1,516 -> 1,431.
Glossary 168 tokens.

**Gates:** chain replayed twice, 141/141 invariants, manifest verified, tsc clean, fresh +
returning + info-box proofs local and live.

---

## sourceSpansV2 — shadow provenance parser (SHADOW MODE, nothing applied)

**Request.** Continue the Q Directives audit from the frozen point at seed 70: build
`sourceSpansV2()` as a completely parallel shadow parser, run it against all 4,966 posts and all
2,705 stored Directive occurrences, reconcile the page counts, and produce a downstream impact
matrix — without touching `sourceLines()`, its 15 consumers, the invariant gate, canonical data,
count pins, or the seed-70 Subject-theme deployment.

**Built (all new, nothing modified).**

    scripts/lib/sourceSpansV2.mjs              the parallel provenance parser
    scripts/audit-source-spans-v2.mjs          fixtures + 4,966-post shadow comparison
    scripts/audit-directives-v3-shadow.mjs     2,705-record rerun + count reconciliation
    scripts/audit-source-spans-v2-consumers.mjs downstream impact matrix
    scripts/audit-source-spans-v2-summary.mjs   the summary document
    audit/source-spans-v2/                     all 10 deliverables

**Why a second parser rather than a patch.** Three structural failures in `sourceLines()`:

1. Its lookup unit is a LINE; the stored unit is a SENTENCE. `God bless,` and `Q` are two lines
   and the stored Directive is one phrase, so a per-line `includes()` finds it nowhere. That
   alone produced 19 NOT_LOCATED records.
2. `sustained prose` inverts on Q's own long sentences. #3 is 17 telegraphic lines with two long
   ones in the middle, and both were marked quoted — including the gold-fixture sentence
   "Don't you think POTUS would be tweeting about removal given clear conflict."
3. `^>` is not always a quotation. By 2020 Q uses `>` as his own bullet arrow; 192 greentext
   lines corpus-wide had no quoted source to be excerpting from.

All three need character offsets and regions, not line membership.

**Results.** 75/75 span fixtures and 20/20 ruling fixtures pass. Every mandatory gold fixture
holds: #3 is Q_BODY and not a Directive; #10 stays held; #146 keeps Directive+Religion; #147's
reproduced "Pray." is QUOTED_PRIOR_Q_POST referencing 146; the 7 signature and 10 URL artefacts
split into separate spans; all five #4437 records are CODE_OR_TECHNICAL_TEXT.

2,366 line verdicts move, but 1,626 of those are `>>NNNNNNN` pointers that carry no analysable
prose — the honest figure is **740 semantic changes across 181 posts**, 642 returned to Q, 86
taken from Q, 12 held. 86 of 2,705 Directive rulings change; **all 19 NOT_LOCATED records now
locate and none was downgraded to quoted**; NOT_LOCATED 19 → 0, AMBIGUOUS 2 → 2.

**Two corrections to the handoff, both found in the data.**

- The 19 NOT_LOCATED are 7 signature + **8** URL + 2 CHINA + 1 JS + **1 unlisted** (#154, a
  three-line fragment of the Lord's Prayer) — not "9 URL".
- The page renders **2,651** mentions, not 2,652, and there is no unexplained record. Replaying
  `dedupePostArrays()` then `normalizeItemKey()` gives 2,705 − 50 exact duplicates − **4**
  normalization collisions = 2,651 exactly. The handoff assumed two collisions; the two never
  listed are #730 and #731, both "Learn." vs "LEARN!!!!". Phrase groups reconcile with no
  correction: 1,763 − 70 folded across 57 groups = 1,693. No count pin was changed.

**Two judgement calls surfaced rather than decided.** (1) A phrase in the body AND in a
reproduced payload resolves to the body, with `alsoQuotedInPayload` recorded — reading rule 6 the
other way would hold 17 records whose ownership is not in doubt. (2) #51's three records sit
inside a letter signed "-The WH" and are held, not removed.

**New finding, outside the brief.** 107 stored Directive records are mid-sentence fragments — the
phrase begins part-way through a body line. Flagged in the CSV as `midSentence`, not ruled on.

**Not done, deliberately.** `sourceLines()`, `audit-cross-section.mjs`, `contracts.mjs`, canonical
Directives, count pins and certification files are all unmodified. No consumer migrated. No
removal or split applied. No seed bump, no build, no deploy. Seed-70 Subject-theme resolutions
untouched (themes 2,644, queue 958). Items 2–6 remain parked.

Scripts verified idempotent — a second full pass reproduces all 10 artifacts byte-for-byte.

---

## Directives v4 — the five owner rulings applied (still SHADOW, nothing migrated)

**Request.** Continue the audit after the sourceSpansV2 shadow pass and encode five owner rulings:
R1 body wins over a reproduced payload · R2 #51 is Q-authored letter voice · R3 the "Have faith…"
records are Directives · R4 accept the derived page figure of 2,651 · R5 repair the mid-sentence
fragments before migration. sourceSpansV2 approved as a standalone parser; Directives migration
explicitly NOT approved.

**Built.** `scripts/audit-directives-v4-shadow.mjs`, plus `Q_BODY_LETTER_VOICE`, `sentencesOf()`
and `sentenceContext()` in `scripts/lib/sourceSpansV2.mjs`. 90/90 span fixtures, 21/21 ruling
fixtures. New deliverables: `directives-adjudication-v4-shadow.{csv,json}`,
`directives-v2-to-v4-diff.csv`, `directives-migration-diff-provisional.csv`,
`directives-mid-sentence-107-editorial-review.{csv,json}`,
`directives-declarative-lead-candidates.{csv,json}`.

**Rulings.** R1: 17 records resolve to the body carrying `alsoQuotedInPayload: true`; AMBIGUOUS is
now reserved for in-body collisions. R2: all three #51 records are Q_AUTHORED_CURRENT_POST /
Q_BODY_LETTER_VOICE; letter FORM no longer implies an external source. R3: all 46 have-faith
records are KEEP — 45 Directive-only, 1 dual-classified ("Have faith in God.", #4429); `have ` was
added to the imperative verb list, and its absence is precisely why they matched RELIGIOUS and
failed IMPERATIVE. 128 of 2,705 rulings now differ from the frozen v2 baseline.

**Three corrections the data forced.**

1. **The 107 is really 6.** `startOffset > 0` and "is a fragment" are different questions — Q writes
   whole sentences on shared lines (`List. Compare. Laugh.`, `VOTE! VOTE! VOTE!`). Measured against
   real sentence boundaries: 101 SENTENCE_ON_SHARED_LINE, 6 MID_SENTENCE_FRAGMENT, of which 5 are
   #4437's code. One record needs an editor: #1252#1.
2. **Three of the four cited examples are not fragments at all.** "Push to DIVIDE is strong." (#1183),
   "Select news members…" (#617) and "Release coming." (#566) start at offset 0. Their defect is the
   other half of the rule — a noun/adjective leading word — which is invisible to an offset test. It
   got its own worksheet: 26 candidates, blank ruling column, all four examples included.
3. **#51: one record had no ruling, one ruling had no record.** #51#0 "Rest assured POTUS is
   backed…" was not ruled on and defaults to KEEP; "God is with us." is not a stored actionRequest,
   so its ruling is recorded as a Religion & Spirituality assignment under `nonDirectiveRulings`.

**A defect in my own reporting, found and fixed.** The v3→v4 diff was wrong. v3 is derived from the
same library the owner rulings were encoded into, so regenerating it after those changes erased the
very movements they caused — #51 stopped being an embedded letter and its NEEDS_CONTEXT → KEEP move
vanished from the diff. A baseline that moves when the thing it measures moves is not a baseline.
`priorRuling` is now v2, which predates this whole build; v3 is carried as `v3Ruling` and labelled a
derived intermediate.

**BASELINE DRIFT — the ground moved mid-session.** This work was commissioned against seed 70 with a
resolution queue of 958. At 02:40 UTC a separate certification pass landed: the manifest now reads
**seed 71, queue 755**, certified and verifying. It was not this session — nothing here writes
outside `audit/source-spans-v2/` and the two worksheets. `public/data/posts.json` is byte-identical
to its pinned sha256, so every figure above stands; the Directives pin (2,705) and Themes (2,644)
are unchanged. Any projection built on 958 is stale.

**Migration diff.** `directives-migration-diff-provisional.csv`: 2,554 KEEP · 146 REMOVE · 3 HOLD ·
2 KEEP_AND_SPLIT. 29 rows BLOCKED_PENDING_EDITORIAL — 1 fragment, 26 declarative-lead, 2 for #10.
Not ready to run, and it says so on every row.

**Counts.** Today 2,651 mentions / 1,693 groups / 1,538 posts, recomputed through the real page
functions. If v4 were applied with holds retained: 2,505 / 1,647 / 1,466. Projection only — the page
was not changed.

**Not done.** No consumer migrated. `sourceLines()`, `audit-cross-section.mjs`, `contracts.mjs`,
canonical Directives, count pins and certification files untouched. No seed bump, no build, no
deploy. All 20 artifacts verified idempotent across two full passes.

---

## Q Directives v5 — FINAL adjudication applied locally. DEPLOY HALTED on a lane conflict.

**Request.** Owner authorization to finish Q Directives: adjudicate the 26 declarative-lead
candidates, resolve #10/#51/#1252/#4437, build V5, migrate Directives only, certify, deploy.

**Done.** V5 is complete and applied to canonical artifacts and posts.json. 90/90 span fixtures,
14/14 V5 fixtures, tsc clean, apply-directives 9/9 gates, byte-identical across two full passes.

    2,705 raw stored -> 2,552 certified   (153 removed from Q Directives only)
    rendered mentions   2,651 -> 2,498
    phrase groups       1,693 -> 1,642
    posts represented   1,538 -> 1,464

**The 26 declarative-lead candidates**, hand-read as complete sentences in context: 19 KEEP, 7
REMOVE (5 claim, 1 prediction, 1 quoted). Recorded with a written reason each in
`audit/directives-declarative-lead-owner-rulings.json`. #10 both KEEP with structural evidence,
#51 all three Q_BODY_LETTER_VOICE, #1252 KEEP with the full sentence, #4437 five REMOVE as code.

**A parser gap the manual pass found.** #1359 is a whole pasted news paragraph on ONE line,
opening and closing on quotation marks. Pass 8 needs a RUN of two long lines and pass 6's parity
test is satisfied by a quotation that closes on its own line, so the excerpt read as Q body and
its closing sentence was a stored Directive. New pass 7b catches it; it fires on exactly this one
record corpus-wide.

**DEPLOY HALTED — and this is one of the owner's stated stop conditions.**

`audit/resolution-owner-resolved.json`, `audit/entities-owner-rulings.json` and
`audit/resolution-owner-notes.json` were written at 12:00-12:01 UTC today, hours after the 02:40
seed-71 certification. No script in the repo writes those three files. Another lane is mid-flight
in the Resolution Center and Entities.

Their effect on a deploy is not small: re-running the chain rebuilds the Resolution Center queue
from 755 to 106 and entities from 1,358/9,250 to 1,447/9,713. A deploy runs the whole chain, so
shipping Directives would have shipped and certified another lane's uncertified work under this
migration. That is outside "finish Q Directives only", so the deploy stopped.

Local state is Directives-only: `certification-manifest --verify` reports exactly three
differences — directives 2,552, posts.json content, SEED_VERSION 72. Nothing else.

**Two mistakes I made, both found and repaired.**

1. A partial `rebuild-bundle.mjs` run baked the other lane's in-flight entity rulings into
   entities.json/questions.json/evidence.json. Restored all 17 files from the pre-migration
   snapshot and re-applied Directives alone. Verified byte-identical to the snapshot except
   posts.json, and inside posts.json only `actionRequests`, `hasRequests`, `directiveFamilies`
   and `directiveMeta` differ.
2. I re-ran `apply-directives-v5-canonical.mjs`, which is not idempotent, after the migration.
   v5 had been rebuilt over the ALREADY-MIGRATED posts, so `postNum#index` no longer meant what
   it meant when the rulings were written — `1183#0` had stopped being "Push to DIVIDE is strong."
   and become "Think pre vs post 2016 election.". The second run deleted three innocent
   directives (#1183, #566, #617). Recovered in full from the pre-migration backup plus
   `audit/directives-certified.json`, and verified back at 2,276 rows.

   Three guards now make it unrepeatable: a run-once stamp on `directives-final.json`, and v4/v5
   plus the span fixture suite all read `audit/backups/posts.pre-directives-v5.2705-153.json`
   rather than the live cache. **Stable occurrence IDs are only stable against the array they
   were assigned from** — that is the durable lesson.

**Pins updated to the new intended values** (not to make a check pass): contracts.mjs,
sectionInfo.ts, apply-claims.mjs, build-search-index.mjs and the three cross-section expectations.
`audit-cross-section.mjs` still imports `sourceLines()` — only its expected Directive counts moved,
exactly as authorized. All 14 other consumers untouched.

**Not deployed. Not certified.** Seed bumped locally to 72; the manifest still reads 71.

---

## Recovery inspection after an interrupted turn — UNEXPECTED_CANONICAL_CHANGE. Not deployed.

**Request.** The previous turn was cut off immediately after "Step 1 — preserve the unknown lane".
Inspect disk, classify the recovery state, change nothing.

**Finding: the preservation step had not started, and the tree moved underneath it anyway.**

A concurrent process — not this session — worked in the same working tree between 11:52 and
12:31 UTC. It edited `scripts/parse-reference-audit.mjs`, `apply-reference-audit.mjs`,
`apply-entities.mjs`, `build-resolution-queue.mjs` and `build-relationships.mjs`; ran a full
rebuild chain at 12:21 (all of `public/data` rewritten); and ran a **certification at 12:27:33**
that stamped **seed 72** over a MIXED state: this session's Directives 2,552 together with its own
Resolution Center queue **107** and Entities **1,447 / 9,750**. `entities.json` was rewritten again
at 12:31:47, seconds before preservation.

That certification is wrong for both lanes and was not authorised by either.

**Live is untouched.** qdrops.app still serves 2,705 raw Directive occurrences, zero posts carrying
`directiveMeta`, #4437 still holding its five scraped-code records and #1252 still showing the
truncated "Learn the TRUTH.". Nothing was deployed.

**Preserved, byte-for-byte, under `audit/preserved-lanes/2026-08-16T12-30Z/`** — 21 files with
sha256 and mtime in `HASHES.json`, via `scripts/preserve-unknown-lane.mjs`, which refuses to
overwrite an existing preservation. Nothing of the other lane was deleted, reverted or shipped.

**The Directives work is intact:** v5 2,705 rows / 2,552 KEEP / 153 REMOVE / 0 HOLD, the 26 hand
rulings, `directives-final.json` 2,276, owner rulings 276, spans 2,498, and the pre-migration
corpus backup at sha `fd6acaaf3406` — identical to the posts.json sha pinned by the seed-71
manifest.

**Why the isolated worktree cannot be built.** The certified seed-71 state is only partly
reproducible:

- `public/data/` — YES. `.snapshots/20260816-075629-pre-directives-v5/` holds it and its posts.json
  sha matches the seed-71 manifest pin exactly.
- `audit/` and `scripts/` — NO. The certified seed-71 versions live in UNTRACKED files (142 of
  them), so no git worktree can restore them, and the other lane has since rewritten many of the
  same files in the same minutes as this session's edits.

Per the standing instruction — if the exact seed-71 baseline cannot be reproduced, stop and report
rather than construct an approximate one — the migration and deploy are halted here.

---

## 2026-08-16 — Seed 73: hover-box repair + Wizards & Warlocks resolved

**Request 1 (owner):** "i used to be able to hover over a term or bracket and got a brief synopsis
based on what the term was. what happend to that?"

**Finding:** the feature was never broken. `verify-final.mjs --live` passed the reader-info-box
check against production and `test-term-info.mjs` passed. What had happened was three *coverage
holes* opened by the day's own work:

- **CBS and TMZ** opened a box that said nothing. Both are SELF-NAMED — the alias equals the
  canonical — and `build-glossary.mjs:86` skips an alias identical to its canonical, so those two
  can only get a meaning from `audit/acronym-definitions.json`. I had written them there as plain
  strings instead of `{expansion: "..."}` objects, which is the shape the builder reads.
- **Q** had no box at all. `IS_ACRONYM = /^[A-Z][A-Z0-9]{1,6}$/` demanded two characters, so the
  most self-referential term in the corpus never qualified. Changed to `{0,6}`; Q is the only
  single-character canonical in the registry, so this admits exactly one token.

Glossary 327 → 328 tokens, 0 empty meanings.

**Request 2 (owner ruling):** "for wizards and warlocks entity the deffinition is Guardians' of
Inteligence. Q post 2624 states this so lets go ahead and resolve this"

#2624's Q-authored body is exactly `>>4281684 / 'Guardians' of intelligence. / Q`. Applied as a
NOTATION gloss over the 8 capitalised occurrence posts (67, 80, 81, 144, 173, 435, 636, 714) with
meaning `'Guardians' of intelligence` — notation and not an organization, because the drops give the
function and never the membership. The gloss records its own provenance honestly: #2624 answers an
anonymous post (`>>4281684`) the corpus does not store, so the answer reaches the question through
the reply chain rather than sitting inside one drop. Supporting context noted: #15 "inside term",
#67 "the council of Wizards & Warlocks cannot be defeated", #144 "Think Snowden".

`code-30-WIZARDS_WARLOCKS` closed in `resolution-owner-resolved.json`.

**Also:** untracked `.repo-lock.json` and added it to `.gitignore`. Tracking runtime lock state made
the pre-flight fight itself — holding the lock tripped the competing-writer check, releasing it
dirtied the tree.

**Result — seed 73, live on qdrops.app:**
- queue 106 → 105 (Reference 30 · Subject 16 · Notation 29→28 · Device 31)
- glossary 328 tokens, 0 empty meanings
- 146/146 cross-section invariants, certification manifest verifies, tsc clean
- CDN parity confirmed, `verify-final.mjs --live` green, tagged `seed-73`

---

## 2026-08-16 — Seed 74: four certified facts that never reached the screen

**Request 1:** "I do not see Q within the entity list like we spoke of. sometimes q is within the post
and not the signer I want to make sure we capture Q as an entity and not the signer (it would be
overkill showing all the signed post because it is literally almost all of them)."

Q *was* certified — 10 body references across #365, #2567, #2774, #2775, #2876 — but
`src/lib/posts.ts` skipped bare "Q" in Named Entities in **two** places (the month rollup and
`computeAnalysisFrequency`). That skip was correct when it was written: nothing decided which Q was
the author tag, so all ~4,000 signatures would have collapsed into one useless row. Signature
exclusion now happens at certification time, structurally, on the last non-empty body line — so the
browser was deleting exactly the rows the skip existed to protect. Removed both; kept the
bare-number skip. Same lesson as the "NO BACKFILL FOR CERTIFIED CATEGORIES" note beside it: the
artifact decides membership, the browser does not get a vote.

**Request 2:** "there are like 36 Q+ post (which is an alias for DJT) but ... i do not see 1 of the
post highlighted with Q+."

Q+ had **never been adjudicated as an entity at all**. It existed only in `aliases.json` — the
owner's search-synonym registry — under `potus`. So the app listed Q+ among POTUS's other names
while holding zero occurrences to highlight. A term can be *displayed* as an alias without ever
being *materialised* as one.

Certified on **Donald Trump** (the person, beside DJT) per owner ruling; POTUS stays the office.
Owner ruled **all 36 occurrences count, sign-offs included** — deliberately unlike bare Q. Q+ signs
36 drops, not thousands, so *which* drops carry it is itself the record: the "+" asserts the
President was present at the signing. Only 4 are body references (#1297, #2401, #2565, #2567).

**Request 3:** "if the words Clinton Foundation is right next to each other lets tie that together
as 1 entity instead of break it up."

#1220 certified **both** "Clinton Foundation" and "Clinton" over the same seven characters — the
surname attributed to Hillary Clinton. Two boxes on screen, and a genuine double count underneath.
Owner ruling applied as `notFollowedBy: "\s+[Ff]oundation"` on all four Clinton alias rulings:
**11 occurrences withdrawn** (9 that double-counted the Foundation against itself, 2 misattributed
to Hillary).

The renderer-side generalisation — drop any same-kind span nested inside a longer one — was built,
measured, and **reverted**: it removed the hover explanation for **27 acronyms** (SS, WASH, BC, JA,
WL, DAG, RBG, AWAN, HCQ…), because the info box attaches to the span of the term it explains and a
collapsed span is no longer that term. Reader explanation beats a tidy outline. The finding is
recorded in `highlightConstants.ts` so it isn't rebuilt. 79 other nested pairs remain listed for a
later ruling ("US" in "US Military", "Comey" in "James Comey"); each half is separately certified
and each keeps its own box.

**Request 4:** "the name No Name in entities is John McCain i thought we already fixed this issue?"

No prior ruling existed anywhere in the entity registry — the codename and the man had always been
separate rows, so the archive listed them as different people. Merged: **NO NAME (16) + No Name (8)
→ John McCain (10 → 34)**, and **No Name Institute → McCain Institute**. Two latent bugs in the
merge path surfaced doing it:

- `into.mentions += a.n ?? 0` — a registry row whose single alias carries `n: null` holds its whole
  count on the row, so merging silently deleted 24 mentions from the corpus total.
- `supersededTail` asked "does the target already carry one of these aliases?" **after** the merge
  had inserted the alias, so the answer was always yes: the occurrences were counted and then never
  emitted. Now recorded before the mutation.

**Request 5:** "I'm about 90% confident that H in post #1589 means Hillary Clinton."

Applied occurrence-scoped to **#1589 line 12 char 6** only. The drop's chain "RR to LL / LL to H /
JC to LL" is decoded by its own next line, "LL IS KEY TO CONNECTING TO WH / HRC/BC/JC/SP/EH". Q
writes HA/HUMA for Huma Abedin and HUSSEIN for Barack Obama, which rules those out. Recorded as
**contextual, not decoded**, per the owner's framing — and explicitly not generalised: a standalone
H elsewhere is not Hillary, and WH and /EH in this same drop are untouched.

**Result — seed 74, live on qdrops.app:**
- entities 1,448 → **1,445**; mentions 9,760 → **9,786** (+36 Q+, +1 H, −11 Clinton, merges neutral)
- Donald Trump 28 → 64 · John McCain 10 → 34 · Clinton Foundation 65 → 56 · Q visible at 10
- 146/146 invariants, manifest verifies, tsc clean, full pre-deploy proof green (90/90 info-box
  checks), CDN parity confirmed, tagged `seed-74`

---

## 2026-08-16 — Entity cards: certified alias posts + alias chip spelling

**Request:** "i see q+ as an alias but when i open up all the post related to potus and all aliases
i see Q+ but i do not see any post highlighted in orange... can we make sure all alias post are
within the entities they are connected too. in the alias section can we make sure the words are
capitalized if they should be respectively."

**Why the Q+ drops were missing.** The alias post-list on an entity card was built by *text search*
(`getPostNumsContaining` → `postsContainingPhrase`), not from certified occurrences. That function
refuses any single token of two characters or fewer — a guard that exists so the alias "US" stops
matching "becaUSe", "mUSt", "rUSsia" — and **"Q+" is two characters**, so it returned nothing at
all. The card listed Q+ as one of POTUS's names and none of its 36 drops. The same index normalises
punctuation away, so this was a hazard for every name Q writes with a symbol.

**Fix:** the card now reads the certified rows first — they already record exactly which drops carry
each spelling — and falls back to the text scan only for hand-typed spellings the adjudication never
certified ("4,10,20", "Donald"). Verified by simulation: the POTUS card goes from 506 chips to
**419 certified ones, 419/419 of which open a drop that actually carries that term** and therefore
highlights. The drop is the point: the 87 that left were text matches with no certified occurrence
behind them, which is exactly the "listed but nothing highlighted" complaint.

**Alias chip spelling.** The editable registry (`public/data/aliases.json`, master in Firestore) is
typed by hand and held `trump`, `djt`, `jesus`, `united states of america` — displayed verbatim
beside properly-cased certified names. New `displayAlias()` repairs the display from the certified
registry, which records the form Q wrote and how often:

- **Anything already carrying a capital is left alone.** HUSSEIN and DONALD J. TRUMP are how Q
  writes them; a blanket "best attested" rule swapped spellings in *both* directions and was wrong.
- An all-caps certified spelling is adopted only for a short single token, where it is an acronym
  (DJT, HRC). For a phrase it is Q shouting, so the phrase is title-cased instead —
  "United States of America", not "UNITED STATES OF AMERICA".
- Title-casing keeps joining words lowercase unless they open the name ("of", "the", "and"…).

Applied to the stored file too (`trump`→`Trump`, `djt`→`DJT`, `jesus`→`Jesus`,
`united states of america`→`United States of America`), and a new invariant
(`ui-alias-spelling`) fails the gate if an all-lowercase alias is ever stored again.

**Result — live on qdrops.app:** 147/147 invariants, manifest verifies, tsc clean, full pre-deploy
proof green, CDN parity confirmed. No seed bump: `aliases.json` is fetched at runtime, not seeded,
and no certified artifact changed.

---

## 2026-08-16 — Sentence-level Predictions audit (403 records, 14 batches)

**Request.** An outside sentence-level audit of Q Predictions and Claims, delivered as 14 small
batches with a fixed end state: **595** active high-confidence Predictions.

**Where Predictions actually live.** Not a standalone artifact. `audit/claims-final.json` is the
canonical source and `apply-claims.mjs` materialises `posts.json → postAnalysis.predictions`, with
`claimMeta` separating claim from prediction by `displayClass`. Editing `posts.json` directly would
have been reverted by the next chain run, so the audit is a **rulings layer** under
`audit/predictions-audit/`, merged by `apply-claims.mjs` — the same pattern the themes and entities
owner rulings use. Re-deriving the claims artifact cannot erase it.

**Identity.** Predictions carry no record id (`APP_RECORD_ID` is just the post number), so identity
is POST_NUMBER + normalised sentence, matched per post and **consumed** once. All 403 records were
located as exact matches before anything was applied (`check-predictions-audit-match.mjs`).

**Applied.** P1 73 technical nonpredictions out (47 to Claims, 26 removed) · P2 56 arguable rows
withdrawn to the backlog · P3 130 fragments given complete sentences · P4 68 Claims occurrences to
66 unique Predictions · P5 28 additions · R1/R2/R3 review only, nothing applied.
**Predictions 630 → 595. Claims 4,242 → 4,221.**

**Q's wording is not rewritten.** `postAnalysis.predictions` keeps Q's literal text — it is what the
highlighter matches and what search queries — and a new parallel `predictionSentences` array carries
the readable sentence for 224 rows. The chip shows the sentence with `Q: <fragment>` beside it. All
28 P5 anchors were verified verbatim in the post body first, so every addition stays highlightable.

**Two defects found in my own transform, both caught by a gate rather than by reading the code:**
- Hardcoding `isConclusion: false` on moved rows silently retired **15 certified Implied
  Conclusions**. The attribute belongs to the row, not to the section, so it now travels with it.
- When two occurrences collapsed to one prediction (#4 and #6 each carry a span and a longer span
  containing it), the survivor was whichever record ran first — and the *longer* row was the
  conclusion-bearing one. Duplicates now **merge attributes** instead of dropping them. Conclusions
  stayed at **966**, a certified count this audit never touched.

**Certified counts that moved, each with its arithmetic** (`lib/contracts.mjs`): claims
4,242→4,221, distinct 3,245→3,256, posts 1,982→1,983, predictions 630→595 / 520→490 posts,
checkable 1,926→1,931, sourceProvided 438→439, telegraphic 389→387. Conclusions unchanged.
Source-boundary debt baseline claims 147→139: **6 keys removed, 0 added**, all 8 occurrences
enumerated and all of them P4 moves — the detector did not change, the rows left the layer.

**Held for review, not decided:** 91 rows (56 P2 + 22 R1 + 13 R2) in
`audit/predictions-audit/review-backlog.md`, each with its complete sentence and why it is
arguable. Nothing policy-dependent was silently resolved.

**Proof.** Chain run twice, byte-identical. 147/147 invariants. Manifest re-certified. SEED_VERSION
75 (posts.json gained a field — returning readers would otherwise keep the fragments). tsc clean;
eslint unchanged on touched files (7 problems before and after). `verify-predictions-audit.mjs`
checks all ten points of the closing audit **against the built bundle**, plus ledger completeness
per batch. `test-prediction-sentences.mjs` proves it in a browser — and its first version passed two
checks against an empty read, which is the "never trust a zero" trap again: the probe now returns a
falsy value until the row renders.

**Ledger:** `audit/predictions-audit/ledger.jsonl`, 403 records, batch / post / requested / actual /
result.

---

## 16 Aug 2026 — Pipeline repair: a deploy applies certified artifacts, it never re-derives them

**Request.** Seed 75 was live and correct, but it had shipped through `SKIP_EXPORT=1`: a normal
rebuild produced **9,804** entity mentions against the certified **9,786**, so the next ordinary
deploy would fail again. Find the 18, fix the cause without raising the baseline, prove the
ordinary pipeline runs twice byte-identical, and correct a stale `audit/CURRENT-STATE.md`.

**Root cause — not either of the two suspected.** Firestore was not restoring obsolete entity rows,
and `apply-entities.mjs` was not failing to retract superseded rulings. `export-firestore.mjs` ran
the **derive** steps on every deploy, and a derive step re-certifies a section using *today's*
detector. `audit/entities-audit.json` was certified **2026-08-12**; the quoted-block boundary fix
landed in `lib/quotedBlocks.mjs` at **seed 72, 2026-08-16**. Every export since had been silently
re-adjudicating Entities.

**Proven by substitution, not inferred.** In an isolated copy, restoring the pre-seed-72
`quotedBlocks.mjs` made `audit-entities.mjs` reproduce the certified artifact exactly — **0 added,
0 removed**. With the current detector, 19 rows flip `inQAuthoredText` false→true (21 occurrences,
3 of them unresolved) → **+18 core-registry mentions, 5,299 → 5,317**, total **9,804**. Exact
reproduction of the reported failure.

**The 18 cannot be ruled in bulk**, which is why they are held rather than adopted
(`audit/entities-quote-boundary-pending.json`, with line and character offsets):
- **11 are pasted source** the old boundary correctly excluded — #1553 news paragraph (5), #1881
  article-on-one-line (2), #2587 line 2 headline (2), #3089 quoted statement (2). The current
  detector admits these as Q-authored, which is *worse*.
- **7 are Q's own** words the old boundary swallowed — #1939 `[19] phone calls today - DC/UK/AUS
  panic?`, #2208 `DECLAS FISA >> [RR] FORCE >> RED LINE`, #2587 lines 6-9 (`CHINA launch?`,
  `The FIRE that brought down GOOGLE.`). This is exactly the over-extension `KNOWN_DEBT` names.

`contracts.mjs` already governs it: the adjudicated dataset outranks the detector, and a
source-material re-audit is a prerequisite, not a side effect of a deploy. **Entities stays 9,786.**

**Entities was not alone.** `scripts/rederive-certified.mjs` shows Themes, Codes and Emphasis would
all have moved on any export too. Evidence reproduces cleanly.

**The repair.**
- `export-firestore.mjs` runs `APPLY_STEPS` only. Re-derivation is deliberate, isolated and
  reporting-only: `node scripts/rederive-certified.mjs` (`--adopt` after a ruling).
- `lib/postTextFingerprint.mjs` keeps the one protection the derive steps gave by accident: if a
  dump brings changed post text, every certified span is anchored to text that moved and every
  count still reconciles. The export now stops and names the drops.
- `lib/stableJson.mjs`. Two exports of an unchanged database produced different bytes for
  `posts.json`, `topics.json`, `analysisConfirmed.json` — same values, same array order, different
  **Firestore key order**. The manifest never saw it (key-sorted semantic hash), but it made "run it
  twice and diff" unavailable.
- `audit/aliases-owner.json`. **A second defect `SKIP_EXPORT=1` was masking:** `firestore.rules`
  have denied alias writes since 12 Aug, so the Firestore copy froze while the repo copy kept being
  corrected. The first ordinary export reverted five aliases to lowercase (`jesus christ`, `trump`,
  `djt`, `united states of america`) and dropped the `rachel chandler` group — **invariant 9 failed**.
  The repo copy is canonical now, which is what it has been in practice since August.
- `manifest.json` no longer carries `exportedAt`. It was the one file an export could never
  reproduce, and it left the tree dirty so the *next* deploy failed preflight's clean check.

**Proof.** Ordinary export, no `SKIP_EXPORT`, run repeatedly → **byte-identical, every file
including the manifest**; a fresh export now leaves `git status` completely clean. Export output ==
`rebuild-bundle.mjs` output, byte for byte. entities **1,445** · certified **9,786** · rendered
**9,786** · predictions **595** · claims **4,221** · Resolution Center **105** · post text
**1,128,312** chars, unchanged. **147/147** invariants · **12/12** Predictions-audit checks ·
manifest verified · `verify-final.mjs --live` passed. Live artifact parity confirmed by fetching
`qdrops.app/data/*.json`.

**SEED_VERSION stays 75.** The bundle is byte-identical to what was already live, so a bump would
make every returning reader re-seed 8 MB for data that did not move.

**`audit/CURRENT-STATE.md` corrected** — it claimed 1,448 entities, 9,760 mentions and a 106-row
queue against a live 1,445 / 9,786 / 105 (`code` had gone 29 → 28).

**Port 5173:** nothing was listening and no vite/q-app node process exists — the stale server had
already exited. Nothing to stop.

---

## 16 Aug 2026 — The quote-boundary rows go into the Resolution Center

**Request.** "can we put the ones needing review in the resolution center" — the 18 entity
occurrences held back by the pipeline repair above.

**They went in as 10 rows, not 18.** The question these rows ask is *"is this LINE Q writing, or Q
pasting something he is quoting?"* — and all five mentions on #1553 line 0 stand or fall on one
judgement. Queuing 18 occurrence rows would have asked the same question five times and invited
five different answers to it. The unit is the line; each row carries the mentions riding on it and
says how many are held out of the count.

**Kind: `source_reference`.** It had been declared in the `kinds` array since the hub was built —
"every kind the hub will ever hold, declared now so the filters exist before the sections that
populate them" — and never populated. Its guide text, written speculatively, asked "what source is
being pointed at here?" The rows that actually arrived ask the prior question, so the guide now
asks whose words the line is, with `Q's own words` / `Pasted source material` as the two choices.

**A recount caught by the project's own rule.** The first generator re-matched every alias on every
flipped line and produced **20** against a certified delta of **18** — "Huber" matches twice on
#1553 line 0 and the audit records one. That is exactly `NEVER_RECOUNT_RULE`. The population is now
read from the audit's own mention rows and attributed to lines in document order: **18/18 placed
onto 10 lines**, `pasted_source` 11 · `q_authored` 7.

**Two hardcoded copies of a certified count.** `build-relationships.mjs` and `build-search-index.mjs`
each froze `105` inline, so both refused to write when the queue went to 115 — a certified count in
two places is a certified count that goes stale in one. Both now read
`CANONICAL.resolution.total`.

**Three new invariants** (147 → **150**), all in group 10: every quote-boundary line is queued or
owner-resolved; the held mentions still reconcile to the certified gap (18 = 9,804 − 9,786); and
none of the held mentions is counted in Entities. The last one is the section's whole contract —
a queued row is deliberately excluded from its section's totals — asserted rather than assumed.

**Verified at the layer the reader sees.** `scripts/test-source-attribution-queue.mjs` drives a
browser: the chip renders, is enabled, shows 10, asks the attribution question, filters to 10 rows,
every row deep-links to a real drop, and the page states the mentions are held out of the count.
The `source_reference` chip had never once been rendered with a non-zero count before this, so a
number in the JSON proved nothing about the page.

**Proof.** `resolution` 105 → **115** (`entity` 30 · `theme` 16 · `code` 28 · `classification` 31 ·
`source_reference` 10). Entities unchanged at **1,445 / 9,786 / 9,786**; predictions **595**; claims
**4,221**; post text **1,128,312** chars. **150/150** invariants · manifest re-certified · tsc
clean. SEED_VERSION stays **75** — `resolution-queue.json` is fetched, not seeded, so no returning
reader needs to re-seed.

**Held, unchanged:** the 91 Prediction rows in `audit/predictions-audit/review-backlog.md` stay as
they are. 22 of them are still counted in Claims, and the Resolution Center's contract is that
every row in it is *excluded* from its section's totals — so those 22 cannot become queue rows
without breaking the section's own rule.

---

## 16 Aug 2026 — Resolution Center rows show how long they have been open

**Request.** "a date on the things needing resolved of when they go into the resolutions center."

**The dates were RECOVERED, not stamped.** `resolution-queue.json` is derived and rebuilt from
scratch every run, so a date cannot live on the row — it has to be remembered outside, in
`audit/resolution-first-seen.json`. The 105 rows already queued predate the ledger, and stamping
them all with today would have been a lie that is impossible to detect later. Instead
`scripts/backfill-resolution-first-seen.mjs` walks the git history of the queue file and takes, for
each id, the earliest commit that contained it — **2,346 ids dated across the queue's whole
history**, including rows that have since been resolved. Of the live 115: **46 open since
2026-08-12**, **69 since 2026-08-16**.

**Ids are stamped once and never re-stamped.** A row that is owner-resolved and later re-opened
keeps its original date. Re-stamping would quietly reset the clock on the longest-open cases, which
are precisely the ones worth seeing.

**Reproducibility preserved.** The builder consults the clock only for ids it has never seen, and
persists them immediately — a second run stamps nothing and produces a byte-identical queue file.
Verified by building twice and diffing.

**UI.** Each row carries `open today` / `open 4 days` / `open 2 months` beside its kind chip, with
the exact date in the tooltip — the elapsed reading is what you want at a glance, the absolute date
is what you quote when discussing the row elsewhere. `openFor()` parses as UTC on purpose:
`new Date('2026-08-16')` is midnight UTC while `new Date()` is local, so west of Greenwich a row
queued this morning would read "-1 days" — the off-by-a-timezone that makes a date field look
broken on the one day it matters most.

**Two new invariants** (150 → **152**): every row carries a `YYYY-MM-DD` first-seen date, and no
row is dated in the future or before the archive was built. An undated row still renders, just
without the field that says how long it has waited — a silent failure, so it is asserted.

**Proof.** 152/152 invariants · manifest re-certified · tsc clean · verified in a browser on both
the Source and Reference queues. Queue stays **115**; no certified count moved.

---

## 16 Aug 2026 — Stage 1 deployed; Stage 2 entity hovers implemented

**Stage 1 shipped** at seed 76 — 1,409 entities, 9,749 mentions — and was verified in production:
1,409 rows with 0 duplicates, every row carrying a permanent `qe-` id, 9,749 rendered mentions
(difference 0), all 37 withdrawn occurrences still present in their drops and none still
highlighted, absorbed spellings still resolving, and returning seed-75 readers migrating. `qe-`
ids are byte-identical after a full rebuild.

**The [NP] ruling is parked with an exit condition** — `audit/entities-pending-migrations.json`.
Both halves of the owner's ruling are true at once: "non-profit organization" is a generic class,
AND [NP] in #5/#6 must never resolve to Nancy Pelosi. It stays until occurrence-level brackets can
carry the disambiguation, then 9,749 → 9,747.

### Stage 2

**4,285 published · 2,931 to review · 562 held · 0 unmappable.**

**Keyed by permanent id + post number**, never by display name, alias, slug or the audit's
ENT-####. Those numbers are our own list ordered by mention count — positional, and meaningless
after any recount. Everything resolves through the Stage 1 crosswalk before anything is written.
`build-glossary.mjs` now emits `entityId` so the reader's info box never looks anything up by name.

**Two layers, stored and shown apart.** `global` is what the entity is anywhere; `byPost` is what
THIS drop does with the label and how much it establishes. Collapsing them would lose the second
half — the honest half. #534 shows it: "NYC is New York City" is true everywhere; "this drop uses
the abbreviated form, which needs the surrounding passage to confirm it" is true only here.

**The review queue is NOT under `public/data`.** The instruction was to route Review records into
the review workflow and not expose them; `public/data` is the published bundle, so anything placed
there is exposed by definition. They live in `audit/entity-hover-review-queue.json`, and the
publication gate refuses to write if even one non-Ready record reaches the bundle.

**`HoverCard.tsx` — one accessible primitive, reusable for Brackets.** The existing info box worked
on a mouse and nothing else: no keyboard focus, no outside-click dismissal, no ARIA relationship,
and its Escape handler was attached to `document` on every open and never removed. Fixing that in
place would have fixed Entities alone and let Brackets grow a second copy with the same gaps.

**A placement bug the test caught:** prefer-above / fall-back-below / clamp-into-viewport puts the
card on top of the word it explains at the bottom of a page — the clamp is what causes it. Space is
now measured first, the card goes where it fits, and when neither side holds it whole it takes the
roomier side and scrolls inside a bounded height. The anchor stays visible in every case.

**Wording audit over all 4,285.** Every synopsis attributes to the post and cites its drop; all
1,138 Partial readings hedge; all 1,640 question-role synopses keep the question a question; none
claims verification in its own voice. Two checks were wrong before they were right: the
verification regex fired five times on Q's own quoted words ("hasn't been proven to be correct"),
and an "is the alias in the drop" check failed 309 times on entities matched inside URLs.

**309 published hovers explain a term that appears only inside a URL** — "Black Lives Matter" from
`trends.google.com/...q=black%20lives%20matter`, "Daily Beast" from `amp.thedailybeast.com`. Our
certified data counts those mentions too, so the tooltips agree with what the archive highlights.
Same class as Stage 1's `Presidential Advisory`. Pre-existing; reported, not silently fixed.

**Proof.** 160/160 invariants (8 new hover gates), 18/18 accessibility checks in a browser,
manifest re-certified with `entity-hovers.json` now covered, tsc clean. Entity totals unchanged by
the import: 1,409 / 9,749.

---

## 16 Aug 2026 — Stage 2 cleanup: reprocessing, URL quarantine, private review

**Reprocessed the 523 registry-blocked records** by validating each against the seed-76 state
rather than the status the audit stamped on it. **247 promoted to publish, 211 to review, 65 to
URL quarantine.**

- **307 type-blocked → 247 published.** All 85 corrected-type entities now have tooltips. The
  artificial gap is closed for them.
- **216 merge-blocked → 0 published**, and that is now a *stated* outcome rather than an artificial
  one: 186 are graded Insufficient and 20 use a shared alias ("Clinton" belongs to four entities).
  Their synopses also carried the placeholder *"the canonical label is duplicated in the current
  entity registry"* — wording about a registry state Stage 1 has fixed. Re-grading that evidence is
  an editorial act, not a mechanical one, so they went to an editor instead of being reworded.
- **71 synopses had wording refreshed** — mechanical substitutions only, an absorbed spelling or a
  stale type label. Nothing re-read a drop.

**A validation bug caught by its own numbers.** The first reprocessing run applied the mechanical
checks to every record and took publish from 4,285 to **6,472** — promoting 2,187 synopses a human
had been asked to read first. "Human review before publish" is an editorial judgement, not a
mechanical one, and only the registry-blocked records were ever in scope.

**441 URL-derived occurrences quarantined** as `url_derived_entity_occurrence` — more than the 309
first reported, because the detector now decodes `%20` and folds punctuation on both sides:
`url_path_fragment` **330** · `hostname_source_reference` **103** · `ambiguous_url_reference` **7** ·
`url_query_fragment` **1** · `human_readable_link_label` **0** (empty by construction — a URL-only
record has no prose mention). No certified count changed.

**The 562 reconciled.** 523 registry-blocked + 39 move-out. The 39 are **not** exactly the
withdrawn records: 37 are, and 2 are `ENT-0709-P5/P6` — "Non-profit organization", which is HELD,
not withdrawn. Both went to review because "NP" is a shared alias, which is the same disambiguation
the pending migration exists to solve. **37 marked `withdrawn_entity_occurrence`, audit history
only.**

**Private Resolution Center** at `/editorial/hover-review`. The enforcement is the absence of the
bytes, not a permission check: the queues live in `audit/`, served by a dev-only Vite middleware, so
`deploy-web.sh` has nothing to copy into `dist/`. Verified against the built public bundle — the
route, the page and the data are all absent, while `entity-hovers.json` is present as a control.
Five actions, a localStorage audit trail (editor, time, previous, next, reason) exported for the
apply chain, and six filters.

**Final: publish 4,156 · review 3,144 · URL quarantine 441 · withdrawn 37 = 7,778.**
163/163 invariants, manifest re-certified, tsc clean, entity totals unchanged at 1,409 / 9,749.

**Found, not fixed:** `Black Lives Matter` is typed `person`. The audit's 85 type corrections did
not catch it.

---

## 2026-08-16 — the rendering coordinate system, and what it had been hiding

**Request.** Continue the Entities cleanup from the repository and the existing audit artifacts.
Classify the 376 anchorless hovers as `no_visible_text_anchor`, audit them into four provenance
categories, complete the URL-cleanup package, write the missing invariants, add guarded apply and
rollback, and report everything before applying anything.

**What the audit found first.** Both the hover validator and the URL classifier were asking their
questions of `posts.json` raw text — the board's own encoding — while the app strips that encoding
at seed time (`stripBoardMarkup`). The project already had one definition of the rendered text,
`scripts/lib/runtimeText.mjs`, written after the same mistake produced 2,475 wrong spans. The hover
and URL work did not use it. Two consequences, both silent:

- `AT&amp;T` folds to "at amp t" and the alias "AT&T" folds to "at t", so **6 records were condemned
  for having no visible anchor while the company is plainly printed in the drop** (AT&T ×3,
  McKinsey & Company ×2, Akin Gump ×1).
- 8chan italicised `//`, so links are stored as `https:<em>//</em>example.com`. The URL regex needs
  `://` and never saw one: **1,236 of the corpus's 2,666 links — 46%, across 946 posts — were
  invisible to the URL classifier.** The 441-record quarantine and the whole cleanup proposal were
  computed on the other 54%.

The fix went into `hoverValidation.mjs` itself rather than into each caller, so raw and rendered
text now give the same answer and the mistake cannot be reintroduced by forgetting a conversion.

**Corrected hover classification** — five buckets, because `no_visible_text_anchor` is a ruling
about the tooltip and does not belong inside ordinary editorial review:

    publish 3,698 · review 3,126 · no visible anchor 402 · URL quarantine 515 · withdrawn 37 = 7,778

The **2,931 substantive editorial-review records are byte-identical** — same membership, same
synopsis text. Review moved 3,144 → 3,126 only because 18 `Insufficient` records routed earlier: 8
to the quarantine, 10 to the no-anchor bucket, 0 unaccounted.

**Provenance of the 402** (`audit/entity-provenance-review.json`, 370 of them public in production):

    image_provenance_confirmed        0
    image_provenance_unconfirmed     55
    nonvisual_metadata_provenance     0
    no_supported_provenance         231
    url_source_provenance_unclassified 116   ← outside the four the ruling named

`image_provenance_confirmed` is 0 because nothing in the corpus could confirm it — no OCR, no
captions, no annotations, no bounding boxes; a media record holds `filename` and `url` and nothing
else. The script **asserts** the absence of those fields and exits non-zero if one appears, so the
zero cannot decay into a vacuous pass.

**The extraction defect below the hover.** 302 of the 402 have their alias sitting inside a longer
word in the drop. `God` is a certified entity in 47 drops, and every one of them says
`Godfather III`. Invariant 4, in the certified data rather than in a renderer. Reported, not acted
on — it is count-changing.

**Corrected URL cleanup**, proven by simulation, nothing applied:

    mentions 9,749 → 9,245 (−504)   entity rows 1,409 → 1,254
    zero-mention 172 = 17 source-only + 155 dormant
    linked sources 124 (119 bound, 5 unbound) across 43 hostnames · 11 ambiguous held for review

**Rollback is proven, not promised.** `--prove-rollback` copies all 18 certified artifacts to a
scratch directory, applies, rolls back, and compares SHA-256: 0 mismatches, 0 files touched outside
scope, and the reversal contract independently replays to 9,749.

**Built:** `linked-sources.json` data model, `LinkedSources.tsx` (a labelled region, not a tooltip —
there is no word to hover), a `/sources` surface separate from Entities, a `sources` search section,
`sourceOnlyDescription()` so a source-only identity is never rendered as a zero, and a dormant
registry that retires rows from the bundle while reserving their ids permanently.

**22 new invariants** (group 10c) covering totals, URL exclusion, bound and unbound sources, dormant
ids, mixed prose/URL, ambiguous records, the vacuous-test guard and byte-identical rebuilding. The
vacuous-test guard asserts both halves: that the shared definition is used, **and** that the two
coordinate systems still disagree — if they ever agree, the guard is passing for free.

`scripts/test-linked-sources.mjs` drives the real app against the artifact the cleanup *would*
write, then removes the fixture: 14/14. **184/184 invariants, manifest re-certified, tsc clean.**

**Nothing applied, nothing deployed.** Production remains seed 77 / f406402 / 1,409 / 9,749.

---

## 2026-08-17 — the integrated audit: one matcher, one plan, 9,749 occurrences

**Rulings executed.** `url_source_provenance` as a fifth category with the 116 publisher records
migrating to linked-source metadata; a substring is not an entity mention; audit the boundary defect
across the whole corpus, not the 402; keep the 55 image-unconfirmed certified and private; one
integrated deterministic simulation; one shared matcher for every stage; the named regression tests.

**One shared implementation.** `scripts/lib/renderedMatch.mjs` now holds rendered-text normalisation
and complete-token matching. Four approximations existed and each was wrong differently: hover
validation folded punctuation and read the STORED text; the glossary used a `\b` regex over raw
text; search had no boundary concept; the original extraction is how "God" became certified in 47
drops that all say "Godfather III". `hoverValidation.mjs` re-exports rather than reimplements, and
invariant `coords-no-private-copies` fails if any consumer forks a primitive.
`scripts/test-rendered-match.mjs` — **54 cases, all pass**, covering every shape the ruling named.

Two of those cases were written wrong and the suite corrected me, which is the point of writing them
down: POTUS inside `twitter.com/iHeartPOTUS` is a token of *nothing* (found by the glued reporting
test, not by promoting a substring), and a boundary rule **cannot** separate "Q" from "Q+" — "+" is
not alphanumeric, so `Q` legitimately ends a token there. That separation is an identity question,
settled by `normalizeItemKey`. The shared regex is now character-for-character the renderer's
`wordBoundaryPattern`.

**Corpus-wide occurrence audit** — `audit/occurrence-provenance-audit.json`, all 9,749, keyed
`#<post>:<index>` so the unit is the actual certified occurrence:

    8647 visible_complete_token · 34 visible_alias_variant · 775 url_source_provenance
       0 image_provenance_confirmed · 24 image_provenance_unconfirmed · 0 nonvisual_metadata
     115 invalid_substring_extraction · 85 no_supported_provenance · 69 ambiguous_provenance

Attribution is not assumed either: 743 entries carry an alias more than one entity claims, and an
entry is attributed only when exactly one entity claims that alias AND lists that drop. **61 remain
undecidable**, which is why 25 entities tally short of their certified figure — reported, not
smoothed.

**A social handle is not a CMS slug.** The simulation was retiring Catherine Herridge, Maria
Bartiromo, Jim Jordan and Rudy Giuliani outright, because `twitter.com/CBS_Herridge` was being read
as a publisher slug by one rule and as a stray substring by another. The URL policy was written
about publisher CMS paths and does not reach a person Q chose to link to. **129 occurrences across
85 entities are now held under `social_handle` for a ruling of their own** — the policy is scoped to
what it was written about rather than stretched.

**Two rulings collide on 17 occurrences.** A substring extraction in a drop that carries an image:
the boundary ruling says withdraw, the image ruling says those stay certified for now. Held, no
count effect, flagged.

**The integrated plan** — `audit/integrated-migration-plan.json`. Double subtraction is not
prevented by a check; it is unrepresentable, because each occurrence has exactly one category and
one action. The ledger accounts for every starting mention:

    kept 8,774 · held 231 · withdrawn 510 · migrated 234  =  9,749 ✓
    mentions 9,749 -> 9,005 (-744)   entity rows 1,409 -> 1,238
    171 dormant · 63 source-only · 244 linked-source records (237 bound, 7 unbound) over 99 hostnames

**Rollback proven twice over**: 18 artifacts byte-identical after apply-then-rollback, 0 touched
outside scope, and the reversal contract independently rebuilds all 9,749 annotations *in their
original array positions*.

**Glossary and search migrated to the shared matcher.** The glossary gained 6 tokens' worth of
genuine posts — `\b` never matched `_AF1_5A_2` or `_WH_POTUS_PRESS`, because `_` is a word character
to a regex and a boundary to a reader. One search row was displaying `&gt;` and could not be found
by typing what is on screen.

**190/190 invariants** (28 new in group 10c), 54 matcher cases, 14 linked-source browser checks
against the artifact the cleanup would write, tsc clean. The **2,931 substantive editorial records
remain byte-for-byte identical** — same membership, same text.

**Nothing applied, nothing deployed.** Production remains seed 77 / f406402 / 1,409 / 9,749.

---

## 2026-08-17 — the three rulings, and the final integrated simulation

**Rulings applied.** Social handles migrate as `social_account_reference`; the 17
substring-with-image collisions are reclassified `image_provenance_unconfirmed`, kept certified and
private; the 78 unsupported occurrences are withdrawn with full reversible history.

**Final classification of all 9,749** — every one lands in exactly one action:

    kept      8,791   visible 8,647 · alias variant 34 · image-unconfirmed 41 · ambiguous 69
    held          7   unsupported beyond the population the ruling named
    withdrawn   588   substring 98 · URL path/query 412 · unsupported 78
    migrated    363   publisher 234 · social account 129

    mentions 9,749 -> 8,798 (-951)      entity rows 1,409 -> 1,201
    dormant 208 · source-only 135 · 373 source records (357 bound, 16 unbound)
    99 hostnames · 84 accounts · all 129 handles on twitter.com

**Scoped, not stretched — twice.** The corpus-wide pass finds **85** unsupported occurrences; the
ruling was written against the **78** that were reported. The other 7 have identical evidence — none
at all — but an approval is of a SET, not of a predicate, so they are held and named. The same
reasoning kept the URL slug rule off social handles a pass earlier.

**The 17 keep their evidence.** Reclassifying them as image-unconfirmed does not erase the substring
finding: `evidence.alsoSubstringOf` and `reclassifiedFrom` stay on the row, so the editor who
eventually opens the image is not told the drop was clean. Invariant `image-substring-evidence-kept`.

**A social account is not a publisher.** Publishers are keyed by hostname, accounts by
platform + handle — collapsing 84 people onto "twitter.com" would lose every one of them. They share
the Sources surface and the search section, and are labelled apart, because "Q cited Reuters" and
"Q linked to someone's Twitter profile" are different claims. Accounts are searchable by handle AND
by name, and no account row is phrased as Q naming the person.

**Gates.** 199/199 invariants (37 in group 10c) · 54 matcher cases · 16 browser checks against the
artifact the cleanup will write · tsc clean · both derivations byte-identical on a second run ·
rollback proven: 18 artifacts byte-identical, 0 outside scope, and the reversal contract rebuilds
all 9,749 annotations in their original positions.

**Nothing applied, nothing deployed.** Production remains seed 77 / f406402 / 1,409 / 9,749.

---

## 2026-08-17 — seed 78 APPLIED locally, deploy HELD at the browser gate

**Applied exactly as approved.** `apply-entity-cleanup.mjs --apply --approved-by-owner`, snapshot
`entity-cleanup-2026-08-17T12-08-30-288Z` taken first.

    entity rows  1,409 -> 1,201        mentions  9,749 -> 8,798  (-951)
    dormant 208 · source-only 135 · 373 linked sources (244 publisher / 129 social) · 3,698 hovers

Every approved figure matched the simulation exactly, checked field by field. Held populations
verified untouched: the 7 unsupported beyond the ruled set, the 41 image-unconfirmed, the 69
ambiguous, the [NP] migration, and the 2,931 editorial records byte-for-byte.

**Chain run:** hovers, relationships, search index, glossary. CANONICAL updated with the reason
recorded inline; sectionInfo headlines updated; SEED_VERSION 77 -> 78 with the `seed-current`
invariant moved with it; seed fingerprint and manifest re-certified. **206/206 invariants.**

**DEPLOY HELD.** `verify-final.mjs` fails one check — `#2401 WASH POST has an info-box target`.

**It is pre-existing and unrelated to this migration**, proven rather than assumed: #2401's post text
is byte-identical before and after the apply, its glossary entry is byte-identical, and the
rendering code was untouched at the time it first failed. The cause is a limitation in
`applyGlossary`: `wrapInside` splits text on `([A-Za-z0-9][A-Za-z0-9._+/-]*)`, single words only, so
a two-word token can never be rebuilt from two separate parts. All three "WASH POST"s in #2401 sit
inside larger Question marks, so the whole-node branch never fires either. 19 glossary tokens
contain a space and every one of them has the same gap.

**The second failure was real and is fixed.** `#1990 DAG` — the only "DAG" in that drop was inside
the path of a scribd link, `Grassley-Letter-to-AG-DAG-Requesting-Special-Counsel`. The URL ruling
withdrew it and the box correctly went with it. The fixture moved to #3004, where DAG is in Q's own
prose, so the office-vs-officeholder case still has teeth instead of asserting behaviour the ruling
removed.

**An attempted fix, reverted.** Multi-word support in `wrapInside` fixed #2401 and broke #1828 BO
and CM — a drop containing "NO NAME". Reverted rather than debugged under a deploy. Term-info after
the revert: 87 pass, 1 fail, and that one is the pre-existing gap.

**Nothing deployed. Nothing committed.** Production is still seed 77 / f406402 / 1,409 / 9,749. The
local apply is one command from reversal: `node scripts/apply-entity-cleanup.mjs --rollback`.

---

## 2026-08-17 — mobile blocker resolved by measurement; combined-card work handed off

**Blocker 2 (mobile) is CLOSED, and it was never a product defect.** Probed at a real 390x844
viewport with touch emulation, against the four candidate causes the ruling named:

    trigger        visible, 81px wide, aria-expanded false -> true on tap
    card           renders — exactly one role="tooltip", id="_r_0_", aria-live="polite"
    position       left 8px, top 758.8px, right 8px, max-height 45vh — FULLY on screen in 390x844
    relationship   aria-describedby="_r_0_" on the trigger

The cause is the fourth one: **the test queried the wrong attribute.** HoverCard names its card with
`aria-describedby`; the test asked for `aria-controls`, got null, and reported a working card as a
broken one. `scripts/test-multiword-gloss.mjs` now follows the component — `aria-describedby` first,
`aria-controls` as a fallback, `[role="tooltip"]` as the backstop — rather than asserting an
assumption about it. The test was corrected; the gate was not weakened.

**A correction to the record.** An earlier note in this log claimed the six split terms were
acceptable because the inner entity control already carries a box for the reader. That was inferred
from seeing an "ABC" button somewhere on #2770, not from that occurrence carrying one. The browser
probe returns `inner control []` — empty. The claim was wrong and is withdrawn.

**Blocker 1 (six split terms) is NOT done.** The owner has ruled the design: anchor on the leftmost
existing interactive control, extend its card with a separately labelled "Glossary reading in this
post" section, mark the remaining words with NON-interactive occurrence markers, and open the same
card by event delegation — no nested buttons, no extra keyboard stops, both readings preserved and
visibly distinguished. Not implemented.

**Nothing deployed.** Production remains seed 77 / f406402 / 1,409 / 9,749.

---

## 2026-08-17 — the six split terms, and the rebuild that could not reproduce the bundle

**Request.** Implement the combined cards for the six multi-word glossary terms the annotation layer
splits, run every gate, and deploy seed 78 if nothing is skipped or excused.

### The mobile blocker was not closed — the file did not parse

The corrected mobile check had **never executed**. Its page expression is a template literal, and the
correction quoted the two attribute names in backticks *inside* that literal, which terminated it:
`node scripts/test-multiword-gloss.mjs` died with a SyntaxError before the first check ran. A gate
reported as passing had not been run at all.

With the file parsing, the mobile check failed for a second, independent reason: it clicked and read
the DOM **in the same expression**, which reports the render before the state change. The file
already carried that lesson forty lines above, for the touch case. It now taps, polls, and only then
measures — and asserts more than it did: the card is on screen, does not cover its own word, and
exactly one card is open. Both a contiguous term (#2401) and a split one (#2462) are measured at
390x844.

### The six terms, and what the DOM actually does

Read out of the live DOM rather than assumed. All six shapes are now fixtures in
`scripts/test-gloss-occurrence.mjs`, so a change in how the intervals cut a line fails a test instead
of silently removing a box:

    FOX NEWS            #1791   button(FOX) + mark( NEWS)                control on segment 0
    ABC NEWS            #2770   button(ABC) + mark( NEWS)                control on segment 0
    ADAM SCHIFF         #3063   mark(ADAM ) + button(SCHIFF)             control on segment 1
    CLINTON FOUNDATION  #1830   mark(CLINTON) + mark( FOUNDATION)        no control
    ROD ROSENSTEIN      #2129   mark(ROD ) + mark(ROSENSTEIN)            no control
    SUPREME COURT       #2462   mark(SUPREME) + mark( ) + mark(COURT)    no control, three segments

The middle segment of SUPREME COURT is the single space between the words, and it is a certified
interval like any other. That is the whole reason a phrase-in-one-text-node matcher finds none of
these.

### What was built

**`src/lib/glossOccurrence.ts` — pure, and proved without a browser.** The phrase is matched against
the CONCATENATION of the siblings and mapped back onto them. The occurrence identifier is *derived* —
post number, token, ordinal — never counted at render time, because a counter renumbers the same
occurrence on re-render and the delegation that opens one card from three segments is only correct
while the three agree on their own name. Ordinals count every occurrence, split or contiguous, so a
term does not change identity the day an annotation boundary appears beside it.

**`src/lib/glossDelegation.ts` — three listeners, not three per segment.** Every segment carries
`data-gloss-occ`; the anchor also carries `data-gloss-anchor` so the delegated handlers leave alone
the events the button already handles. Capture phase, for the same reason the trigger stops
propagation on its own click. Registered while at least one split occurrence is mounted and removed
when the last unmounts. HoverCard's outside-click dismissal now treats a sibling segment as inside —
without that, a tap on "COURT" closes the card a moment before the delegation reopens it, which on a
phone reads as a term that ignores every second tap.

**The renderer decides before it renders.** `controlTokenIn` asks what reading a segment *would* have
carried, because the box on "ABC" is something `applyGlossary` is itself about to create — deciding
afterwards would mean building a button and unbuilding it, and the two paths would disagree the first
time one of them changed. The leftmost segment that would carry a control becomes the sole anchor; if
none would, the leftmost segment is promoted. Every other segment of the occurrence is marked and
non-interactive, and `replaceRange` rebuilds only the elements on the path to the matched characters,
so each `<mark>` keeps its own tag, class and title and no character moves.

**Both readings, visibly apart.** #2770 writes "ABC NEWS". The entity layer certifies "ABC" — scoped
to three different entities across the archive, and reading as the CIA in two drops — and the glossary
certifies the phrase. The card keeps the existing reading as its own section and adds a separately
headed **"Glossary reading in this post"**, and the accessible name carries both: *"ABC — ABC News.
Glossary reading in this post: ABC NEWS — ABC News"*. An ABC entity reading standing in for the
ABC NEWS glossary reading is exactly the substitution the ruling forbids, and it would have been
invisible without a check that reads the card text.

**The fallback is total.** No plan, or no reading for the term in this drop, and every node goes down
the untouched path — so this can only add a box where there was none. #2401's three WASH POSTs and
#1828's BO and CM are unchanged, and asserted by name.

### THE REBUILD DID NOT REPRODUCE THE BUNDLE

Found by running the gate rather than reasoning about it. `apply-entities.mjs` rebuilds Entities from
`audit/entities-audit.json` — the adjudication as it stood BEFORE the integrated cleanup — so
replaying the deploy chain put **1,409 rows and 9,749 mentions back**, and `build-search-index.mjs`
refused at its QA gate: *Entities indexed = 1,201, got 1,409*. Proved in an isolated copy of the
repo, never in the working tree.

`export-firestore.mjs` replays that same chain **before the manifest is ever consulted**, so the
deploy could not have run at all. The gate was working; but "the pipeline aborts" is not a state to
ship from, and `SKIP_EXPORT=1` is a quota escape hatch rather than an answer (CURRENT-STATE rule 8).
**The certified bundle was reproducible only by hand, which is to say it was not reproducible.**

The cleanup is now a step OF the chain. `apply-entity-cleanup.mjs --rematerialise` re-applies the plan
the owner already approved, checks the result against the counts recorded in the rollback contract at
apply time, and refuses on any difference. It is **not** a second approval: it takes no snapshot and
rewrites no contract — the original snapshot stays the authority on what "before" was, and a deploy
must never move the thing a rollback restores to. It is idempotent **by measurement**: on a tree that
already carries the cleanup it writes nothing, so running the chain twice reproduces the bundle byte
for byte. It is declared in `APPLY_ORDER`, so `chain-complete` fails if it is ever dropped again, and
the chain's arguments moved into `chainSteps.mjs` (`APPLY_INVOCATIONS`) rather than being hardcoded at
two call sites — a load-bearing detail in two places is how a step went missing from one path before.

**Result: the full chain reproduces all 19 artifacts byte-identically, landing on 1,201 / 8,798.**

### Rollback, proved from the applied state

`--prove-rollback` proves the restore BEFORE the cleanup is applied, and cannot run afterwards: it
derives its plan from an audit of 9,749 occurrences and the tree holds 8,798, so the applier refuses —
correctly. `scripts/prove-cleanup-rollback.mjs` answers the question that matters on the day of a
deploy instead: with the migration applied and about to ship, can it still be taken back? It performs
the restore in a scratch directory against copies and compares SHA-256, and replays the reversal
contract on its own. 0 mismatches, 0 files outside scope, 951 restores placed, 8,798 + 951 = 9,749,
and every annotation back in its original array position. A rollback that is only asserted is a
rollback nobody has run.

### Gates — every one run, none skipped

    19/19 multi-word tokens . 6 split, 13 contiguous . 3 inside an annotation
    six split terms: segments share one id . one anchor . one tab stop . 0 nested . marks intact
    delegation: hover, tap and Escape from a NON-anchor segment drive the same card, all six
    #2401 WASH POST 3/3 . #1828 BO and CM . #3004 DAG
    keyboard, focus restoration, Escape, outside click, screen-reader labelling, role=tooltip
    mobile 390x844, contiguous AND split: on screen, not covering the word, exactly one card
    nested controls 0 . duplicate tab stops 0 . one anchor per occurrence group,
      swept over all 20 affected drops
    54 matcher cases . 34 segmentation cases . 23 occurrence cases (846 plans over 4,960 drops)
    206/206 invariants . manifest verified . seed fingerprint 78 . tsc clean
    complete rebuild: 19/19 artifacts byte-identical
    rollback proven from the applied state
    verify-final.mjs: fresh + returning profiles, 11 steps, all green

`test-rendered-match.mjs`, `test-gloss-segments.mjs`, `test-gloss-occurrence.mjs`,
`test-hover-accessibility.mjs` and `test-multiword-gloss.mjs` are now steps of `verify-final.mjs`,
local and live. Six terms had no box while every other gate was green, because no gate asked.

---

## 2026-08-17 — the grey Context fill comes out of the drop, and the 435 drops that went silent

**Request.** "i want to take the grey Emphasis highlights out of the q post on the archives and the
analysis page... app wide", with post #4962 as the example.

**It was Context, not Emphasis, and the difference mattered.** #4962 carries
`contextUnits: ["Bubble.","Crash.","Steal.","Lie.","Repeat.","Taxation without representation.","1913."]`
— exactly the grey boxes in the screenshot — and its `emphasis` array is EMPTY. The two layers are
different fills on different post sets:

    context    bg-gray-500/35 text-gray-100      4,816 units across 2,311 posts
    emphasis   bg-slate-300/60 text-slate-900    4,238 units across 1,357 posts

Removing Emphasis would have changed nothing in the drop the owner sent. Asked, and the owner ruled
**Context only** — Emphasis keeps its slate fill.

**A FILL WAS REMOVED, NOT A DISPOSITION.** All 4,816 units stay certified, stay in posts.json, stay
counted and stay in their section. Both surfaces stopped feeding the layer, in the same commit,
because PostDetail and postHighlight have shown the same drop differently three times and each time
it was a change that landed on one of them.

This reverses the 2026-08-14 ruling that every category should read as a fill. That ruling is quoted
in the code it governed; the reversal is recorded beside it rather than replacing it.

### THE 435 DROPS THAT WENT SILENT

Caught by `test-term-info.mjs`: **#220 RT has an info-box target — NO TARGET**.

Both renderers carried `if (segs.length === 0) return text` — an early return that hands back the
bare string and never reaches `applyGlossary`, which is applied at the BOTTOM of the function. It was
almost unreachable while Context painted, because a grey fill on any reviewed sentence meant nearly
every drop had at least one segment. Removing that fill exposed it: **435 drops whose only highlight
layer was Context would have lost every acronym info box.** #220 is one — "Monitored and analyzed in
RT.", the drop where RT means *real time* rather than Rex Tillerson.

The lesson is not about Context. It is that a feature applied at the end of a function is a feature
an early return can delete, and the only reason this was survivable is that a gate asked about a
named drop rather than about a count.

**Found, not fixed, and reported:** the archive cards (`/posts`) render **no acronym info boxes at
all** — 0 for WASH POST, 0 for NO NAME, on 63 and 16 cards. Verified against **production**, which
shows 0 as well, so it is pre-existing and unrelated to this change. `PostCard` passes both `postNum`
and `gloss` to `highlightText`, so the wiring looks right and the cause is not yet established. It is
count-neutral and outside what was asked. Reported for a ruling.

**`verify-context-render.mjs` was rewritten and wired into `verify-final.mjs`.** It had been
asserting *"detail surface consumes contextUnits"* and *"neutral style has no background fill"* —
the second false since 2026-08-14 — and had been red for two rulings without anyone noticing,
because it was not a step of anything. It now asserts both halves of today's ruling: the units are
intact in the data (4,816 across 2,311 posts) and neither surface fills them. The data half is
checked first, because the dangerous failure here is not the grey still showing — that is obvious on
sight — it is someone removing the paint by deleting the units.

**Gates.** tsc clean · 206/206 invariants · manifest verified · 8/8 context checks · term-info 90/90
(was 89 with #220 failing) · 132/132 multi-word checks · 54 + 34 + 23 pure cases · verify-final fresh
and returning green · grey Context marks measured at 0 on both surfaces for #4962 and #220, with the
coloured certified layers still painting.

---

## 2026-08-17 — Emphasis comes out of the drop too, and three defects the gates caught behind it

**Request.** "i want the emphasis highlights off the all the archives post and on the analysis pages
across the app because i don't like how it is structured", with #4961 as the case.

**Executed as ruled.** #4961 is nine lines and **seven of them were boxed** as Emphasis, so the two
lines the archive actually classifies — the Question and the Claim — were the hardest things on the
drop to find. Same removal as Context earlier today, in both renderers, in one commit. After:
#4961 paints three marks, the Question, the Claim and one Entity.

**The data is untouched.** 4,238 certified Emphasis units across 1,357 posts stay in posts.json and
stay listed under Emphasis in the Post Analysis panel. This removes a FILL, not a disposition — and
the reader can still see exactly which words the audit marked, on the panel below the drop.

### Three defects the removal exposed

**1. SUPREME COURT stopped being a split term — and that is an improvement.** The Emphasis marks were
part of what cut "SUPREME COURT" into three sibling `<mark>`s on #2462. With the fill gone the phrase
survives whole and takes the ordinary contiguous path: one button, one card, no delegation needed.
`test-multiword-gloss.mjs` failed because it hardcoded which of the six named terms take the split
path. **That was the same brittleness fixed for the live gates this morning, one layer along**: which
path a term takes is a property of today's interval layout, not of the ruling. Each of the six is now
proved on whichever path it takes — contiguous terms must have their own single control with a label
naming the whole phrase; split terms keep every segment assertion.

**2. Escape closed the card and reopened it in the same breath.** `close(true)` returns focus to the
trigger for accessibility, and the trigger opens on focus — so Escape closed, refocused, and
reopened. The next tap then toggled it SHUT. It read as a control that ignores every second press,
and it is why "tapping a non-anchor segment opens the card" failed on FOX NEWS while the identical
tap passed in isolation. The refocus is required and stays; the focus-open is suppressed for that one
programmatic focus.

**3. A card on a narrow screen could cover the word it explains.** `HoverCard` pinned to the BOTTOM
on anything under 640px, on the reasoning that a card down there "can never sit on top of the line
being read". That holds only while the word is in the upper half. A term in the bottom 45% of a
390x844 screen was covered by its own explanation. Found because the mobile fixture moved to #1791
when #2462 stopped being split — the check that the card does not cover its anchor had never been
applied to a term low on the page. The pinned case now chooses its edge the same way the floating
case does: whichever leaves the anchor visible, and when neither does, the roomier one.

**A gate that would have blocked the ruling.** `test-returning-profile.mjs` asserted that `'real'` on
#2917 renders as a **Claim+Emphasis overlap**. With Emphasis unpainted there is no overlap, and the
span reads as the Claim it also is. That test's question is whether a RETURNING reader receives the
current certified data — not which colour it wears — so the membership is now checked where it lives,
in the re-seeded record. Asserting the old paint there would have made the owner's ruling unshippable.

**Gates.** tsc clean · 206/206 invariants · manifest verified · 14/14 context+emphasis checks ·
122/122 multi-word checks · term-info 90/90 · 54 + 34 + 23 pure cases · verify-final fresh and
returning green · slate Emphasis marks measured at 0 on both surfaces for #4961.

---

## 2026-08-17 — the badge number is now the sort key

**Request.** "the exact number displayed in the row's ×N posts badge must be the number used to sort
that row." Rod Rosenstein printed **×96 posts** and sat between a 5-post row and a 4-post row;
Australia's 20 sat below rows with 6.

**Four numbers, one row, nothing reconciling them.** The badge unioned the alias spellings; the sort
key used `occurrences`; `postNums` was a third quantity; and the reader opened a fourth. Every one of
them was individually defensible, which is why the column looked broken while no single count was
wrong. The union is now computed **once**, in `rows`, and the badge, the chips, the reader and the
comparator all read it.

**Named Entities come from the certified registry, not from a string union.** `entities.json` already
resolved every occurrence to exactly one entity, and that is the only thing that can answer the
shared-alias question: **"CS" is Chuck Schumer, CrowdStrike AND Christopher Steele**, so a union keyed
by the string hands the same drop to all three. It also ends the text-scan over-count — MI6 read
**14** posts against a certified **11**, Military Intelligence **16** against **15**. One row per
`qe-` identity, its own certified drops, every spelling shown inside the row.

**Ordering.** Distinct posts descending, then the oldest drop ascending, then the label so a rebuild
reproduces the list exactly. The three 6-post rows come out Constitution (#23), Merkel (#100),
Japan (#137). With a month selected the badge switches to that month's count, so the comparator
switches with it — otherwise the same defect returns one filter along. Rank stays a property of the
unfiltered list.

**Before → after, the reported rows:**

    Australia             20 posts   was below rows with 6      now rank-position 64
    Military Intelligence 15 posts   badge read 16 (text scan)  now 78
    MI6                   11 posts   badge read 14 (text scan)  now 98
    Scaramucci             7 posts                              now 154

**`scripts/test-category-order.mjs`** — seven checks over six categories, read from the RENDERED
page because the artifacts were never wrong; the disagreement was between two things the component
computed. No row shows more chips than it claims; an uncapped row shows exactly as many; no post is
listed twice; the reader opens exactly the badge count; counts never increase down the list; equal
counts go oldest-first; printed ranks ascend with the rendered order; and a second load produces an
identical order. Wired into `verify-final.mjs`, local and live.

**Two defects the gate found in itself, worth recording.** A page expression is a template literal,
so `\d` arrived as `d` and every chip lookup silently matched nothing — the same class of bug as the
backticks that stopped `test-multiword-gloss.mjs` parsing. And a chip that repeats inside its drop
renders an inline `×2` badge, so its text is `#780×2`; parsing the whole string gave NaN and dropped
two chips per row, which read as the badge over-claiming. Both were the test, not the app — but the
second exposed a real one: building entity rows from the registry had dropped the per-post repeat
counts, and the amber `×2` on a chip is the only place a reader learns Q said a name twice in one
breath. Merged back in across every spelling.

**Gates.** tsc · 206/206 invariants · manifest · 14/14 context+emphasis · 122/122 multi-word ·
term-info 90/90 · 43/43 category-ordering · 54 + 34 + 23 pure cases · verify-final fresh and
returning green.

---

## 2026-08-17 — The Entity list reconciles, and the month charts stop reaching into it

Two bounded objectives from the current deployed baseline (seed 78, commit `4fbf640`, 1,201 entity
records, 8,798 mentions). Committed separately.

### Objective 1 — reconcile the Entity list and totals (`b7bed6b`)

**Four numbers, one page, nothing reconciling them.** The header printed 856 and 879; the list
rendered 1,062 rows; the registry held 1,201. Measured, they are three different populations:

    879    distinct normalised STRINGS in the browser's frequency index, after the alias fold
    856    those, less the 23 the verbatim filter emptied to zero posts (387 repeated + 469 once)
  1,062    rows the list rendered — the registry, minus the 135 with no prose mention
  1,201    the certified registry

879 and 856 are properties of `postAnalysis.namedEntities` grouped by TEXT, where "Bill Clinton" and
"BC" are two rows and one identity. The header was describing spellings above a list of identities.

**The reconciled model**, in `public/data/entity-public-view.json` and rendered from it:

    1,201 total canonical entities   ·   8,798 certified prose mentions within 2,090 posts
    1,066 named in Q's prose · 135 linked as a source only = 1,201
    shown as 1,183 rows (33 alias-connected identities share 15 of them)
    208 dormant identities are reserved and not listed

**The 135 get rows.** `if (!e.posts.length) continue` had skipped every identity with no prose
mention. They ship carrying the drops that LINKED them — chips labelled **Publisher link** or
**Social account**, a `source only` badge, `×N source posts` rather than `×N posts`, `occurrences`
of 0, a line saying the source is linked by the post and not necessarily named in Q's prose, and a
link into Sources (`/sources?q=` now filters, punctuation-insensitively, so `CBS_Herridge` finds
`CBS Herridge`).

**The row rule (owner ruling).** Identities connected by an alias stay together, named by the one
with the most posts, aliases behind it most-to-least posts. Applied to all entities it also caught
14 pairs where one identity's whole canonical is another's registered alias — `Strzok` published
beside `Peter Strzok`, `Page` beside `Lisa Page`, `Wray` beside `Christopher Wray`. Union-find, so
chains resolve: `The Washington Post → Washington Post → WASH POST` is one row.

**Connected is not "shares a spelling."** Merging on shared alias strings was measured and collapses
1,066 identities into 1,006 rows: Barack Obama + Bruce Ohr + Board Owner (all "BO"), CIA + ABC News +
Alphabet ("ABC"), Chuck Schumer + CrowdStrike + Christopher Steele ("CS"). 46 spellings are shared
that way; none merges anything.

**A repeat-badge leak, found and fixed.** The amber `×2` came from a Map keyed by POST NUMBER ALONE,
filled from every entity in the frequency index in turn — last writer won. 443 drops hold entities
with differing in-post counts; #1009 carries "AZ" twice and "Russia" once and Russia's chip claimed
×2. Now per identity, from the certified occurrence ledger, clipped to the registry's own post set,
with the 61 unsettled shared-alias attributions earning no badge at all rather than a guessed one.

**The verbatim filter was investigated and left alone.** It empties frequency-index rows whose
spelling is absent from visible prose — right for Claims and Emphasis, where a chip that highlights
nothing reads as a broken app. It never touched entity membership; it only fed the header that was
describing the wrong population. No source-only relationship was ever discarded by it.

**Two stale gates fixed rather than worked around.** `verify-section-headlines.mjs` carried hardcoded
expectations gone stale for five of seven sections and reported five failures on every run; it now
parses `SECTION_TOTALS`. `test-category-order.mjs` read `×9 source posts` as `null`.

**13 new invariants** (group 10d, 223/223 total) and `scripts/test-entity-reconciliation.mjs`, which
reads the real DOM: the header carries every figure and no longer prints the string tally, the list
publishes exactly 1,183 rows, and all 1,183 carry a post chip.

### Objective 2 — month-chart behaviour (`ec1db2f`)

**Hover was reaching into the results.** `hoverMonth` pulsed every chip of the month under the
cursor — hundreds of animated nodes, restarted on every mousemove. Clicking flashed the same chips
white for five seconds, and the Archive dimmed out-of-month chips to 30% opacity and left them on
screen: "filtered to March" showed February's drops greyed out rather than March's alone. On touch,
the hover fired on the tap meant to select.

**The filter was mouse-only.** A recharts bar is an SVG rect — no focus, no Enter. `MonthYearTick`
draws a tick only at year starts and Delta months, so ~50 of the 60 months had nothing to aim at.

Now: hover reads out (month + counts), click selects, and `MonthPicker` is a radiogroup of real
buttons grouped by year — Tab reaches the group, arrows walk months in time order, Home/End jump.
Enter and Space are deliberately unhandled so the button's native behaviour IS the click path. An
`aria-live` region announces the month and result count.

Shared: `src/lib/monthFilter.ts` (state, the recharts double-click guard) and
`src/components/MonthFilter.tsx` (tooltip, picker, banner). PostArchive's own `ChartTooltip` deleted.

`scripts/test-month-chart-behaviour.mjs` — 7 Analysis categories + the Archive, desktop and phone,
real pointer and key events: **192/192**. Pointed at the deployed site it fails exactly where it
should ("0 month buttons", "hover animated 4 elements"), which is the only evidence a passing run
means anything.

### Gates

tsc · eslint (3 pre-existing errors, one fewer than before) · full apply chain run TWICE,
`public/data` byte-identical both times · 223/223 invariants · manifest verified · seed stays **78**
(no seeded artifact changed) · 7/7 headlines · category ordering · alias visibility on both surfaces ·
entity reconciliation 14/14 · month behaviour 192/192 · `verify-final.mjs` fresh + returning green.

Both new gates are now steps of `verify-final.mjs`, local and live (`3385927`).

---

## 2026-08-17 — the deploy stopped costing 27 minutes

**Request (owner, after an external process review of `HANDOFF-PROCESS-REVIEW.md`):** optimise the
q-app validation and deployment process only. No application behaviour, certified data, counts or UI
may change. Replace fixed browser-test sleeps with condition waits; stop proving one shared module on
seven categories; add risk-based profiles; keep every cheap certified-data invariant in all of them;
make the live pass delivery-focused; detect a GitHub Pages build that exceeds five minutes; measure
before and after; delete nothing.

### What was actually expensive

The handoff had it measured: of ~27 minutes per deploy, **six seconds** were the certified-data
protections. The rest was browser time, and most of that was the process waiting on a clock. Two
gates added the previous day declared 49.5s and 22.4s×16 of fixed sleeps between them, and the live
pass re-ran all nine local gates against production — proving application logic a second time against
the identical `dist/`.

### 1. Every deploy-path gate now waits on a condition

`scripts/lib/browser.mjs` gained `waitForStable` (poll until the value repeats), `press`/`key` (real
CDP key events, so Enter and Space actually activate a button), and named conditions — `CHIPS_READY`,
`MONTHS_READY`, `DROP_READY`, `LIST_SIZE`, `seededTo(n)`. Six gates were rewritten onto it. The waits
are the states the next assertion depends on: the picker exists, the chip count stopped moving, the
row count the artifact predicts, the selection changed, the tooltip appeared, the month was released,
the profile re-seeded.

**Measured on this machine, same day, same assertions, `http://localhost:5173`:**

| gate | before | after | |
|---|---:|---:|---|
| `test-month-chart-behaviour` | 370.1s | **21.1s** | 17.5× |
| `test-entity-reconciliation` | 65.6s | **12.4s** | 5.3× |
| `test-archive-alias-visibility` | 49.9s | **16.6s** | 3.0× |
| `test-returning-profile` | 37.2s | **8.7s** | 4.3× |
| `verify-section-headlines` | 107.0s | **77.6s** | 1.4× |
| `test-category-order` | 125.3s | **96.6s** | 1.3× |
| **the six together** | **755.1s** | **233.0s** | **3.2×** |

The local "before" figures land within 0.5% of the live figures in the handoff (371.9 / 65.3 / 38.1),
which is the evidence that local and live are comparable here at all.

`verify-section-headlines` and `test-category-order` improve least because they were never mostly
sleep — they are seven and nine page loads of an app that takes ~10s to become usable. That is the
app's own cost, and it is Part 2's problem, not this pass's.

**A condition can be wrong in a way a sleep cannot, and one was.** The Post Archive paints
"Found 0 posts matching" before the posts collection arrives, so waiting for that banner returned in
~200ms against an empty page and every alias assertion failed on a site that was fine. The condition
is a non-zero result set. Same trap handled in the headline gate: it waits for rows carrying post
chips — the frequency index having landed — not merely for rows.

### 2. The month gate proves one shared module twice, not sixteen times

`monthFilter.ts` + `MonthFilter.tsx` is one implementation. The ordinary run takes the representative
category and the Archive — the two different HOSTS — on desktop and phone: 4 surfaces, 48 checks,
21.1s. `--full` still sweeps all 7 categories × 2 viewports (16 surfaces, 192 checks) and is required
when the shared module itself changes, before a release, and in the `full` profile. `--only <cat>`
and `--rep <cat>` unchanged/added.

### 3. Risk-based profiles — `scripts/validate.mjs`

    --profile fast        UI only: typecheck + cheap invariants (+ --only <gate>)
    --profile standard    + representative browser gates and the returning reader
    --profile certified   + the apply chain TWICE, and the gates that read certified data off the page
    --profile full        + all 7 categories, both alias surfaces

**The cheap certified-data invariants are in every profile without exception** — manifest,
cross-section invariants, seed fingerprint, four pure matchers. A profile chooses how much browser to
buy; it never chooses whether the data is allowed to be wrong. `verify-final.mjs` still works and now
means `--profile certified`, so every command in the docs and this log is unchanged.

### 4. The live pass proves DELIVERY, not logic — `scripts/verify-live.mjs`

A tooltip cannot behave differently because GitHub is serving the bytes. What can differ is delivery,
and delivery is what has actually failed here. So the live pass asks only delivery questions:

- **the deployed build is the validated build** — `scripts/write-build-info.mjs` stamps `dist/` with
  the commit, seed, certification-manifest hash, service-worker version and asset list; production's
  copy is fetched and compared. This is what makes "is it live yet?" a fact instead of a hard refresh.
- the hashed assets `index.html` names are this build's, and they are fetchable
- the service worker is **byte-identical** to the one built, and its `CACHE_VERSION` is a deploy stamp
- every published data file matches the bytes on disk — full hash under 2 MB, byte length above it
- a **fresh** reader, and a **returning** one (the gate that has actually failed in production)
- `--smoke <gate>` gives a changed feature its one look on production; `--full` restores the old pass

### 5. A Pages build that has not been served in 5 minutes is named

`scripts/await-pages-build.mjs` runs inside the deploy. It polls the deployed stamp, and at five
minutes stops and distinguishes the two cases: **externally stalled** (Pages says queued/building/
errored → re-push, it supersedes) versus **not serving this build** (Pages says built → check the
branch). It prints the Pages API status either way. Verified live: it read `status=built
duration=37166ms`, confirming the 33–75s normal window. `SKIP_WAIT=1` restores fire-and-forget.

### The cycle, measured end to end

`node scripts/validate.mjs --profile certified --no-chain --base http://localhost:5173`, everything
green, its own timing table:

| profile | local proof | what a deploy costs |
|---|---:|---|
| `fast` | **22.1s** | + build/deploy ~1.5 min + live ~1 min ≈ **3 min** |
| `standard` | **115.4s** | ≈ **4.5 min** |
| `certified` | **390s** (358.6 measured + ~32s chain) | ≈ **9 min** |
| *was: the one path* | *726s (12.1 min)* | *≈ 27 min* |

An ordinary UI deploy lands inside the 5–7 minute target. A certified one is 9 minutes against 27,
with the chain still run twice and every invariant still in the run.

**What is expensive now is the app, not the process.** The two largest items in `certified` are
`test-multiword-gloss` (128.9s) and `test-category-order` (101.3s), and neither has ever contained a
fixed sleep — they are 19 and 9 page loads of an app that takes ~10s to become usable. `test-term-info`
at 43.2s is the same story. Nothing further can be taken out of the pipeline without removing a gate;
the next real gain is Part 2.

### Nothing was deleted

No script, audit artifact or source data removed. `scripts/.cache/references.jsonl` untouched. Fixed
sleeps remain in four scripts that no profile runs — `verify-claim-graph.mjs`,
`verify-claim-propagation.mjs`, `diagnose-claim-render.mjs` (one-off diagnostics from the 14 Aug
claim investigation) and `test-seed-migration-browser.mjs`. They cost nothing per deploy; convert
them the day one of them is put back on the path.

**Files:** `scripts/validate.mjs`, `scripts/verify-live.mjs`, `scripts/write-build-info.mjs`,
`scripts/await-pages-build.mjs` (new) · `scripts/lib/browser.mjs`, `scripts/verify-final.mjs`,
`scripts/deploy-web.sh`, `scripts/test-month-chart-behaviour.mjs`,
`scripts/test-entity-reconciliation.mjs`, `scripts/test-category-order.mjs`,
`scripts/test-returning-profile.mjs`, `scripts/test-archive-alias-visibility.mjs`,
`scripts/verify-section-headlines.mjs`, `package.json`, `PROJECT_CONTEXT.md`

---

## Session — Proving the new pipeline: the floor comes from the diff, the receipt names the bytes (17 Aug 2026)

**Request.** Finish and prove the validation/deployment pipeline built in the previous three commits
before starting application-performance work. Nine specific corrections, then push, then a real
deployment through the new process, then measure it against the 27-minute cycle. No application
behaviour and no certified data to change.

### 1. `scripts/.devlog-index.tsv` — gitignored

A navigation index over this file: start line, heading, length, one row per `## ` section. Purely
derived, and already stale when found — 148 rows against 150 headings, because it is rebuilt on
demand and this file is appended to every session. Tracking it would put a conflicting diff on every
commit for a file nothing but a session's own navigation reads. Ignored, alongside
`.validate-receipt.json` (below).

### 2. No shell, and the Node 24 warning is gone — `scripts/lib/pipeline.mjs` (new)

Every gate spawn carried `shell: process.platform === 'win32'`, which Node 24 flags:

    [DEP0190] Passing args to a child process with shell option true can lead to security
    vulnerabilities, as the arguments are not escaped, only concatenated.

Not theoretical: `--only` took a name off the command line and turned it into a path, so with a
shell every gate argument was a place cmd.exe would act on `&&` or `;` rather than pass it along.
The shell was only ever there because `npx` is `npx.cmd` on Windows. `resolveArgv()` now resolves
the executable directly — `node` is `process.execPath`, and `npx tsc` is the TypeScript entry point
handed straight to node. Removed from `validate.mjs`, `verify-live.mjs` and `verify-final.mjs`; no
`shell:` remains in the pipeline and the warning is silent.

### 3. `--only` is an allowlist, not a path

`--only foo` became `scripts/foo.mjs` and ran it, unchecked — and half of `scripts/` WRITES certified
artifacts, while `../` walked out of the directory entirely. `GATES` in `lib/pipeline.mjs` names the
eleven read-only browser gates and the argument convention each one takes, so a caller supplies a
name and nothing else. An unknown name prints the list and exits 2. `verify-live.mjs --smoke` reads
the same table — the identical injection surface, aimed at production. It also fixes a latent bug:
the documented `--smoke month-chart` used to build `test-month-chart.mjs`, which does not exist.

### 4. The profile floor comes from the git diff

"Pick by what changed" was the rule and was unenforceable: `--profile fast` is one word whether or
not the diff touched `audit/`. Every changed path now maps to the weakest profile that can honestly
prove it, and the strongest of those is the floor:

| profile | what sets it |
|---|---|
| `full` | the pipeline scripts, a browser gate, `lib/browser.mjs`/`chainSteps.mjs`, the build config, `public/sw.js`, `src/index.css` |
| `certified` | `audit/`, `public/data/`, the seed/alias/glossary read paths, any other script, `src-tauri/` |
| `standard` | `src/lib/`, `src/pages/`, the app shell — and anything no rule matches |
| `fast` | `src/components/`, assets, stylesheets, prose, repo config outside the bundle |

The baseline is **the last thing proved live**, not the last commit: the commit in
`dist/build-info.json`, else `origin/master`, else `HEAD~1`. Three unpushed commits are exactly as
unproven as an uncommitted edit. With no `--profile` the floor IS the profile; an explicit one may go
up and is refused below, naming the files that set it. A path matching no rule floors at `standard`
and is printed, so the table can be taught rather than silently trusted.

### 5. `--no-chain` cannot buy a certified pass

The chain run twice IS the certified proof — it is what shows an apply step is idempotent, which is
the property that broke when `SEED_VERSION` sat at 4 through three applies. `--no-chain` at
`certified` or `full` is now refused outright, and the receipt records whether the chain ran so
`preflight-deploy.mjs` can refuse a `--no-chain` receipt for a certified change independently.

### 6 + 7. The build stamp describes the exact committed bytes

The stamp on disk read `"dirty": true` against commit `b72e920` — a record of a bundle that commit
does not contain, and `verify-live.mjs` could only report it after the fact, from production. A
`dirty` FLAG describes the problem; refusing to write is the fix. `write-build-info.mjs` now exits 1
on any uncommitted change, with no override, and records `tree` — `git rev-parse HEAD^{tree}`, the id
of the exact bytes — beside the commit. `ALLOW_DIRTY` has been removed from `preflight-deploy.mjs`:
it only moved the failure four minutes later, after the build.

`deploy-web.sh` re-checks cleanliness immediately after the Firestore export, because the export
writes `public/data/` after pre-flight has already approved the tree. Catching it there costs a
second instead of a whole vite build.

### 8. The receipt ties validation to deployment

"It validated" and "this is what is being published" were two claims joined by memory.
`validate.mjs` writes `.validate-receipt.json` (gitignored) on success: profile, the diff's floor,
whether the chain ran, and the git **tree** of the working copy it proved — computed through a
throwaway index, because validation runs before the commit and committing those same bytes produces
that same tree. `preflight-deploy.mjs` recomputes it and refuses to publish unless it matches, the
receipt's profile meets the floor, and the chain ran when the floor is `certified` or above.
`verify-live.mjs` then asserts production's stamp carries that same tree: **proved → committed →
built → served**, one comparable value the whole way.

`verify-final.mjs` still means "at least certified", and now takes the floor when the floor is
higher, so the old command keeps working instead of being refused by the new rule.

### Guard behaviour, checked

| command | result |
|---|---|
| `validate.mjs --list` | floor `full` from 19 changed paths since `b72e920` |
| `validate.mjs --profile fast` | exit 2, names the files forcing `full` |
| `validate.mjs --only ../export-firestore` | exit 2, prints the eleven gates |
| `validate.mjs --profile full --no-chain` | exit 2 |
| `preflight-deploy.mjs` (dirty, no receipt) | 2 checks fail, NOT publishing |
| any spawn | no `DEP0190` |

**Files:** `scripts/lib/pipeline.mjs` (new) · `scripts/validate.mjs`, `scripts/verify-live.mjs`,
`scripts/verify-final.mjs`, `scripts/preflight-deploy.mjs`, `scripts/write-build-info.mjs`,
`scripts/deploy-web.sh`, `.gitignore`, `PROJECT_CONTEXT.md`

### The first deploy through this pipeline found a bug in it — `"tree": null`

Cycle 1 shipped commit `91ba2fe` and the stamp read `"tree": null`. `write-build-info.mjs` still used
`execSync` with a command STRING, which on Windows goes through cmd.exe — where `^` is the escape
character. `git rev-parse HEAD^{tree}` reached git as `HEAD^{tree}` minus the caret:

    fatal: ambiguous argument 'HEAD{tree}': unknown revision or path not in the working tree

The `catch` turned that into `null` and the deploy carried on. It is the same failure the shell
removal was about, still sitting in the one file whose git commands had never contained a
metacharacter before — and `verify-live.mjs` caught it from production on the first run:

    FAIL  deployed-tree   production names the tree of the bytes that were built
          ↳ expected null, live null

Every other live check passed: commit, seed, manifest hash, clean commit, both hashed assets, the
service worker byte-identical with this deploy's `CACHE_VERSION`, all 20 data artifacts, a fresh
visitor and a returning one.

Fixed with `execFileSync` and an argument array, so no shell parses them — and a tree that cannot be
read is now **fatal** rather than a null field: a stamp without it cannot say which bytes are live,
which is the file's only job. That change is itself a pipeline script, so the floor rule put it back
at `full`, which is the rule working rather than an inconvenience.

### End to end, measured — 17 Aug 2026

Two complete cycles, wall clock, everything green. Cycle 1 shipped `91ba2fe` and its live proof found
the `tree: null` bug; cycle 2 shipped the fix as `9251a47` and passed 14/14.

| stage | cycle 1 | cycle 2 |
|---|---:|---:|
| `validate.mjs` — profile **full** | 616.5s | 601.6s |
| `npm run deploy:web` (export → chain → manifest → tsc → build → stamp → push → wait) | 160s | **100s** |
| — of which GitHub Pages took to serve it | 78s | 42s |
| `verify-live.mjs` | — | **13.8s** |
| **total** | | **715.4s — 11m 55s** |

**Against the 27-minute cycle measured the day before: 11m 55s, and that is the most expensive
profile in the system.** The comparison is deliberately unflattering to the new pipeline — the 27
minutes was paid for a ONE-LINE change, and a one-line change no longer buys `full`.

What the same one-line change costs now, with today's measured numbers:

| | old | new |
|---|---:|---:|
| local proof | 726s (the one path) | **10.4s** (`fast`, 8 steps, the floor an empty/UI diff gets) |
| deploy | ~1.5 min | 100s |
| live proof | 744s (the whole suite, again, against production) | 13.8s (delivery only) |
| **total** | **~27 min** | **~2 min 04s** |

The `full` numbers are also the answer to "what does the most careful possible check cost": ten
minutes, of which 444s is three gates — the 7-category month chart (214.3s), multi-word glossary
(129.7s) and category ordering (99.6s). None contains a sleep. They are 16, 19 and 9 loads of an app
that takes ~10s to become usable, which remains Part 2's problem and is untouched by this pass.

### The tree chain, end to end

    validated (receipt)  795e75cf0210b30fc5fc2afd9a612c800297dc44
    committed (HEAD)     795e75cf0210b30fc5fc2afd9a612c800297dc44
    served  (production) 795e75cf0210b30fc5fc2afd9a612c800297dc44

`verify-live.mjs` — 14/14, 13.8s, https://qdrops.app: production serves the validated build; seed 78;
the certified manifest hash; a clean commit; the tree above; the hashed assets `index.html` names,
both fetchable; the service worker byte-identical carrying `qdrops-20260817-174241`; all 20 data
artifacts matching the bundle; a fresh visitor; and a returning one.

---

## Local-first batching, and the "Users Link" that was the editing build — 17 Aug 2026

**Request:** deploy in batches rather than after every fix, and end every summary with a Chrome
localhost link so each change can be reviewed as it lands.

**The directive replaced.** `DEPLOY AFTER EVERY FIX` (15 Aug) existed for one reason: three separate
reports that session were "it still does X" about verified work that had never shipped, so an
undeployed fix read to the owner as a broken one. **The localhost link answers that reason without
buying a deploy per correction** — the dev server serves the same code the batch will ship, one fix
later or twenty. What is now deferred is the DEPLOY alone; per-fix proof is not deferred, because a
failure found five fixes later costs more than the deploy ever did.

Per fix: implement → smallest honest gate → **its own commit** → report with the links → next.
Deploy once, at the end, on the owner's word.

**Finished work is committed work.** "Not deployed" is not "saved" — and `preflight-deploy.mjs`
refuses a dirty tree with no override, so the commit is owed either way. One fix per commit is what
makes a batch reversible per-fix.

**`scripts/batch-status.mjs` — derived, not written down.** ChatGPT's version of this advice kept a
hand-maintained `CURRENT-STATE.md`. That file would be maintained by the same session that forgets
it, and nothing refuses when it goes stale. Everything the batch report prints comes from somewhere
that cannot drift instead:

| line | source |
|---|---|
| what is live | `dist/build-info.json` — the stamp the last deploy wrote |
| the commits in the batch | `git log baseline..HEAD` |
| uncommitted paths | `git status --porcelain -uall`, named as NOT in the batch |
| cumulative floor + what forced it | `requiredProfile()`, the same RULES table `validate.mjs` and `preflight-deploy.mjs` read |
| whether anything proved these bytes | `.validate-receipt.json` vs the live worktree tree |

It is read-only: no gate, no receipt, and it cannot make a deploy legal. **The floor it prints is the
cumulative one** — one certified path anywhere in the batch makes the whole batch certified. That is
the cost side of batching, printed before the owner is asked rather than discovered when
`validate.mjs` refuses. Its own first run said so: adding one script to `scripts/` moved this batch
from `fast` to `certified`.

### The port is not the mode

Checking which server to link found **six** `vite` processes listening on 5173–5178, one per
abandoned session since 16 Aug — and every one was `npm run dev`, the **editorial** build. So the
":5174 Users Link" handed over in reply after reply was the editing build wearing the public build's
port number. Vite takes the next free port silently; the second server started is 5174 whatever mode
it is in, and the two builds look nearly identical on screen.

All six killed, one of each started deliberately: editorial 5173, public 5174 (its banner prints a
green `public` badge). `PROJECT_CONTEXT.md` now carries the two commands that prove a port's mode
from its command line, because the number never did.

### Also

`master` tracked `origin/main` while every push went to `origin/master`, so `git status` reported the
branch 83 commits ahead of a branch nobody uses and an ordinary `git pull` would have read the wrong
one. Retargeted to `origin/master`; `diffBaseline()` was already naming `origin/master` explicitly,
so no measurement in the pipeline was affected.

---

## The post-fix profile, and the 2.9s that no longer exists — 17 Aug 2026

**Request:** before touching `normalizeItemKey` or the service-worker reload, throw away every
conclusion drawn from the pre-fix profile and measure the current build again — a genuinely new
visitor, a returning one, in-app navigation, first category versus later ones, how many times
`buildTextIndex` actually runs, and what invalidation costs after an editorial write. Measure the
service-worker reload and say what it costs, but do not change it. Production stays untouched.

**The ruling was right, and the old profile was worse than stale.** It was taken of a page that
built the text index five times; every per-function number in it measures work that no longer
happens. `normalizeItemKey` is the clearest case — the pre-fix profile attributed 2.9s to it, and on
the fixed build it costs **20.3ms of self time**. Nothing was carried forward.

### What the built bundle costs now (`.perf-dist` on :4173, public build, three runs)

| | | |
|---|---|---|
| first visit, service worker as production runs it | **2.18s** | one reload, 12.4 MB seeded |
| first visit, `/sw.js` blocked so no worker installs | **1.47s** | no reload |
| returning visitor, category URL opened directly | **0.99–1.50s** | six categories, no reload, nothing refetched |
| in-app navigation, category to category | **0.20–0.32s** | |
| landing on /posts, then opening a category | 0.52s, then **0.37s** | |

**The service-worker activation reload costs 0.71s of a first visit and nothing afterwards.**
Measured, not changed: the difference between the two first-visit rows, which is a whole startup
paid twice. It fires once per profile — every returning load in this run reported zero reloads.

### buildTextIndex, counted rather than reasoned about

**Once per page session. Zero on every in-app navigation.** Counted with V8 precise coverage against
the minified bundle, which names nothing — the functions are found by shape (`buildTextIndex` is the
only one returning `{padded, byWord}`) and matched by offset.

    one page session          buildTextIndex 1     getTextIndex 167     normalizeItemKey 1,024
    each in-app navigation    buildTextIndex 0     getTextIndex   0     normalizeItemKey     0

A counted 0 is a measured zero: V8 reports every function that ran, so absent means never called.
The index is in memory, so "once per data version" is really **once per page session** — a new tab
builds it again. The frequency table is the one with a cross-session cache in IndexedDB, and it is
why the ~700ms build does not reappear on a returning visit.

**The first category in a session pays for the index; later ones pay nothing.** Landing on /posts
does not pay it either — the startup warm-up finds the frequency cache and never asks for the text
index, so the first category click still builds it (0.37s all-in).

### Invalidation after an editorial write: it holds, and it costs one rebuild

Measured on the **editorial build** (editing is not compiled into the public one) in a throwaway
profile with Firestore blocked at the network layer, so the confirm could not reach the certified
store.

A tab click is not a test of this — an in-app category change asks for the index zero times, so it
rebuilds nothing either way. The page is taken away to /posts and back, which unmounts the section
and makes it ask again:

    away and back, no edit      asked 162 times, built 0    the cache holds
    the confirm                 1 mutateStore call, built 0  invalidation only drops
    away and back, after edit   asked 161 times, built 1    dropped and rebuilt, once

### Two instruments disagreed, and the one that counted itself won

V8 precise coverage reported that post-edit trip as **2** builds. A counter pushed into
`buildTextIndex`'s own body on an instrumented copy of the same bundle recorded **1**, with one cold
`getTextIndex` and no rejection. The entry came back with `isBlockCoverage: false`, so the count is
coarse. The two agree on zero and on a fresh page session; where they disagree the in-function
counter is the one that saw the call, and `takeCounts` now says so.

### The fresh CPU profile: no remaining bottleneck to name

Returning visitor, `/analysis?tab=claims`, self time:

    (idle) 2,095ms   (program) 304ms   (garbage collector) 155ms
    57.6ms  IndexedDB request callbacks     46.0ms  buildTextIndex
    25.1ms  question-text normalize         24.6ms  recharts shape render
    20.3ms  normalizeItemKey                20.0ms  React element creation

The thirteen hottest app frames total **392ms between them**, and the largest is 57.6ms. There is no
single function left to remove — what remains is React rendering 151 rows with their chips, the
IndexedDB read, and the GC behind both. **No next optimization is proposed**, because nothing in
this profile identifies a user-visible bottleneck.

### The warm profile is not a measuring instrument

`perf-baseline.mjs` run warm reported 4.33s for claims. The warm Chrome the gates share had **30
pages open**, every one a live app instance against :5173, left behind by earlier runs. The same
harness on a fresh profile: 2.01s first visit, 1.51s returning. The gates assert on the DOM so this
never made them wrong, but a timing taken through the warm browser is a measurement of the browser.

### What changed in the repo

Measurement only — no app code was touched, and `src/` is byte-identical to the fix that was
approved.

- `scripts/lib/perf.mjs` — the sampler, the report, the settle loop, the bundle symbol finder and
  the coverage counters. `perf-baseline.mjs` now imports it instead of carrying its own copy, so
  both harnesses measure with the same instrument.
- `scripts/perf-postfix.mjs` — the seven-step post-fix profile above.
- `scripts/lib/browser.mjs` — an additive `cdp` escape hatch on the page driver, for the Profiler
  and for blocking a URL. **This raises the batch's validation floor from `certified` to `full`**,
  since it is a module every gate runs through.

## 2026-08-17 — Media audit trial run (25 images, Fable 5 vision pass — NO app changes)
**Request:** Owner is comparing Claude vs GPT on image analysis for the planned "Image details chip" feature. Task: visually analyze the first 25 Q-post images (posts #101–#1095 sample list), extract text, identify people/logos/objects, and report — explicitly NO implementation yet.
**Solution:** Located all 25 files in `media-bundle/` by mapping post `media`/`refMedia` URLs (hash filename in URL = local filename; note: many stored as .jpg even when the original URL says .png/.jpeg — extension in posts.json URL is not authoritative). All 25 present locally, including the two 4chan-era timestamp-named files (1509926281137.jpg, 1509929714012.jpg). Full vision report delivered in chat: OCR of screenshots (Google/Wikipedia TAC-Brennan pair, Backpage seizure, Breaking911 Farenthold, NBC/Lynch tweet, Verge/YouTube-Wikipedia article, 4chan Q post No.148570254), scene IDs (Little St. James aerial, Paul VI Audience Hall meme, Prince Andrew/Giuffre/Maxwell photo, Clinton-on-jet photo, ray.chandler Instagram screenshots, McCain-Syria 2013 photo set incl. the debunked al-Baghdadi caption, March for Transparency DC rally, USAID-tent militants, Jeff Haynie flaming-sword art). No files changed in the app; no chip built.

## 2026-08-17 — Picture chips: first 100 images analysed + chip UI + search integration (LOCAL, not deployed)
**Request:** Scan the first 100 Q-post pictures with vision, put a clickable "Picture" chip under each photo (before the post's analysis chips) carrying description/extracted text/people/logos/etc. with a green-yellow-red confidence dot, make picture content searchable so archive searches surface "Pic #N" chips (oldest→newest), and time the run.
**Solution:**
- `public/data/picture-analysis.json` — 100 distinct images (post-order enumeration, deduped by content hash), each with kind, description, full OCR text, people/orgs/objects/places, extra search terms, claim flags, confidence (82 green / 15 yellow / 3 red). Four early images missing from media-bundle were recovered from the qalerts mirror for analysis. OCR text is SEARCH-ONLY (invariant-9 pattern) — never the analysis index.
- `src/lib/pictureAnalysis.ts` — loader keyed by URL basename (extension dropped: posts.json extensions are not authoritative), haystack builder, per-post search text map.
- `src/components/PictureChip.tsx` — 📷 Picture chip + confidence dot; expands to full analysis; every listed person/org/place/term links to `/posts?q=…`.
- Wired under every image surface: PostCard, PostDetail (attached + referenced), QuotedPosts, QPostPics; QPostPics search now matches picture content.
- `searchAllPosts` appends per-post picture text; PostArchive gets a "matched inside a picture" bucket, teal "Pic #N" chips sorted ascending, and a results divider.
- Proof: `scripts/test-picture-chips.mjs` (browser, warm profile) — chip renders on /post/1001, expands, term-links work; /posts?q=Wojcicki (picture-only term) yields Pic chips ascending; /pics search "Ghislaine" surfaces GM.JPG. GREEN. `tsc` + `npm run build` clean.
- **Timer: 100 images start-to-finish (scan + data + UI + proof) = 39m50s; the vision scan + data file alone = 20.8 min.**
- NOT deployed (owner's local-first batch rule). Deploy floor will be `certified` (public/data changed).

## 2026-08-17 — Picture review queue (two red dots) + pic-matched card tag (LOCAL, not deployed)
**Request:** The three giant compilation images (#101, #128, #132) hit the AI provider's content-policy block when full verbatim transcription was attempted (the "API Error: 400 Output blocked by content filtering policy" the owner saw). Owner ruling: do what's possible, flag problem pictures with TWO red dots instead of one, and store the info for later manual work. Also finish the earlier ask: the pic-matched post's open card in search results should carry its Pic label in its ordered place.
**Solution:**
- `picture-analysis.json`: `needsReview: true` on n3/#101, n83/#128, n98/#132 with a flag explaining the block; their key-phrase indexes remain searchable.
- `PictureChip`: `needsReview` renders TWO red dots (vs one red = analysed-but-unidentified) and a "🔴🔴 needs manual review" line in the panel.
- `audit/picture-review.md`: the owner's review queue — what each flagged image contains, the re-tiling recipe, and the one-field edit (`needsReview: false`) that reverts the dots once text is added by hand. Standing rule recorded: any future incomplete extraction gets the same treatment.
- PostArchive: pic-matched result cards now carry a teal "📷 Pic #N — matched inside this post's picture" tag + teal ring, in their ordered position among the open results.
- Proof: `scripts/test-picture-review.mjs` GREEN (two dots on #101, review note in panel, card tag on /posts?q=vatican). `tsc` clean.

## 2026-08-18 — Picture-audit checkpoint preserved + resume group 1 (25 images)

- Preserved the temp-scratchpad 500-image picture-audit checkpoint into audit/picture-audit-500/checkpoint-2026-08-18/ (agent JSONLs, batch500 manifest, merge500.py, SPEC, manifests, tiles/vframes/fetched, plus picture-analysis.snapshot-100.json). merge500.py check verified identical on original and copy: 308/500, 192 gaps, 0 dupes, 0 problems, green 251 / yellow 40 / red 17, needsReview [423, 433, 566]. Temp originals untouched. Commit 50950be.
- Processed the next 25 missing sequence numbers (208-271) with 5 parallel agents -> agent-out/agent10-14.jsonl. Check now: 333/500, 167 gaps, 0 dupes, 0 problems, green 270 / yellow 44 / red 19, needsReview adds 257 (incomplete table transcription; no blocked/withheld images). Next gap: 277. Not compiled into public/data; no deploy. Commit b52a359.

## 2026-08-18 — Picture-audit resume group 2 (25 images, seq 277-321)

- Processed sequences 277-321 with 5 parallel agents -> audit/picture-audit-500/checkpoint-2026-08-18/agent-out/agent15-19.jsonl. One image (seq 308, post #1779) triggered output filtering mid-analysis: its record is the minimal review_required entry (confidence red + needsReview = two red dots, ocrStatus withheld, no retry) and a private row was added to audit/picture-review.md 'Withheld analyses'. Seqs 309-311 were completed by a continuation agent (one attempt each). Seq 290 marked needsReview (partial OCR preserved).
- merge500.py check on the durable copy: 358/500, 142 gaps, 0 dupes, 0 problems, green 289 / yellow 48 / red 21, needsReview [257, 290, 308, 423, 433, 566]. Next gap: 327. Not compiled into public/data; no push/deploy.

## 2026-08-18 — Picture-audit resume group 3 (25 images, seq 327-372)

- Processed sequences 327-372 with 5 parallel agents -> audit/picture-audit-500/checkpoint-2026-08-18/agent-out/agent20-24.jsonl (manifests generated by new make_manifests.py, one analysis attempt per image). No blocked/withheld images. Seq 328 (post #1809) marked needsReview: large per-district data table, headers/totals/footnotes captured but the full number grid not transcribed cell-by-cell; row added to audit/picture-review.md queue.
- merge500.py check: 383/500, 117 gaps, 0 dupes, 0 problems, green 312 / yellow 50 / red 21, needsReview [257, 290, 308, 328, 423, 433, 566]. Next gap: 378. Not compiled into public/data; no push/deploy.

## 2026-08-18 — Picture-audit resume group 4 (25 images, seq 378-422)

- Processed sequences 378-422 with 5 parallel agents -> audit/picture-audit-500/checkpoint-2026-08-18/agent-out/agent25-29.jsonl (one analysis attempt per image). No blocked/withheld images; no new needsReview.
- merge500.py check: 408/500, 92 gaps, 0 dupes, 0 problems, green 331 / yellow 56 / red 21, needsReview unchanged [257, 290, 308, 328, 423, 433, 566]. Next gap: 428. Not compiled into public/data; no push/deploy.

## 2026-08-18 — Picture-audit resume group 5 (25 images, seq 428-472)

- First launch (agents 30-34) was cut off by the session usage limit mid-run; 4 records (428, 429, 438, 448) were durably appended before the cutoff and kept. The 21 never-attempted images were relaunched as agents 35-39 (one analysis attempt per image throughout). Outputs: agent-out/agent30-32.jsonl (partial, valid) + agent35-39.jsonl.
- No blocked/withheld images. Seq 431 (post #2073) marked needsReview: embedded grid of ~30 tweet screenshots too small to transcribe fully; account names and headline phrases indexed; row added to audit/picture-review.md queue.
- merge500.py check: 433/500, 67 gaps, 0 dupes, 0 problems, green 353 / yellow 59 / red 21, needsReview [257, 290, 308, 328, 423, 431, 433, 566]. Next gap: 478. Not compiled into public/data; no push/deploy.

## 2026-08-18 — Picture-audit resume group 6 (25 images, seq 478-522)

- Processed sequences 478-522 with 5 parallel agents -> audit/picture-audit-500/checkpoint-2026-08-18/agent-out/agent40-44.jsonl (one analysis attempt per image). agent42's stream watchdog reported a stall, but all 5 of its records (498-502) were already durably appended and validate clean — no re-analysis needed. No blocked/withheld images; no new needsReview.
- merge500.py check: 458/500, 42 gaps, 0 dupes, 0 problems, green 376 / yellow 61 / red 21, needsReview unchanged [257, 290, 308, 328, 423, 431, 433, 566]. Next gap: 528. Not compiled into public/data; no push/deploy.

## 2026-08-18 — Picture-audit resume group 7 (25 images, seq 528-570)

- Processed sequences 528-570 with 5 parallel agents -> audit/picture-audit-500/checkpoint-2026-08-18/agent-out/agent45-50.jsonl. One image (seq 554, post #2362) triggered output filtering on its single analysis attempt: its record is the minimal review_required entry (confidence red + needsReview = two red dots, ocrStatus withheld, no retry, no content recorded) and a private row was added to audit/picture-review.md 'Withheld analyses'. The four never-attempted images behind it (558-561) were completed by continuation agent50 (one attempt each).
- merge500.py check: 483/500, 17 gaps, 0 dupes, 0 problems, green 396 / yellow 65 / red 22, needsReview [257, 290, 308, 328, 423, 431, 433, 554, 566]. Next gap: 571. Not compiled into public/data; no push/deploy.

## 2026-08-18 — Picture-audit FINAL group (17 images, seq 571-600) — 500/500 COMPLETE

- Processed the final 17 missing sequences (571-600) with 4 parallel agents -> audit/picture-audit-500/checkpoint-2026-08-18/agent-out/agent51-54.jsonl (one attempt per image). No blocked/withheld images; no new needsReview.
- FINAL merge500.py check: 500/500, 0 gaps, 0 dupes, 0 problems. Confidence: green 412 / yellow 66 / red 22. needsReview (9): 257, 290, 308, 328, 423, 431, 433, 554, 566. Independent recount over all agent JSONLs confirms every one of the 500 batch sequence numbers occurs exactly once.
- audit/picture-review.md now reconciles fully with the records: withheld table rows 308 + 554 match the two ocrStatus:"withheld" records; queue rows added for every incomplete-transcription needsReview (257, 290, 328, 423, 431, 433, 566 from this batch).
- NOT compiled into public/data (merge500.py compile not run), no push, no deploy. src/pages/ResolutionCenter.tsx (dirty) and scripts/test-picture-resolution.mjs (untracked) left untouched and uncommitted throughout.

## 2026-08-18 — Picture-audit phase 2 setup (next 250, seq 601-850)

- Owner asked for the next 250 images. build_next250.py reproduces the enumeration (posts sorted by string id, attached then referenced media, dedup by URL-hash stem, occurrence lists numeric) and REFUSES to emit unless it reproduces first100+batch500 exactly — verification passed 600/600, total distinct images in archive: 1690. Emitted batch850.json (n=601-850).
- 22 rows had no media-bundle file (all 8ch file_store/thumb URLs): fetch_missing.py fetched them via the qalerts rewrite (full-size preferred over thumb), PIL-verified, into fetched/ — 22/22 ok. One video (seq 739, 45s mp4): 3 frames extracted to vframes/n739_f0-2.jpg.
- New tooling: merge850.py (check/compile over agent-out-850/ against batch850.json, mirrors merge500.py) and make_manifests850.py (resolves FETCHED: and video framePaths). Baseline check: 0/250, 250 gaps, 0 dupes, 0 problems.

## 2026-08-18 — Picture-audit phase 2 group 8 (25 images, seq 601-625)

- Processed sequences 601-625 with 5 parallel agents -> audit/picture-audit-500/checkpoint-2026-08-18/agent-out-850/agent55-59.jsonl (one attempt per image). Seq 607 (post #2524) marked needsReview: ~25-item stitched compilation, headlines/key lines indexed, full transcription remains; row added to audit/picture-review.md queue. No blocked/withheld.
- merge850.py check: 25/250, 225 gaps, 0 dupes, 0 problems, green 24 / yellow 1. Next gap: 626. Not compiled; no push/deploy.

## 2026-08-18 — Picture-audit phase 2 group 9 (25 images, seq 626-650)

- Processed sequences 626-650 with 5 parallel agents -> agent-out-850/agent60-64.jsonl (one attempt per image). No blocked/withheld; no new needsReview.
- merge850.py check: 50/250, 200 gaps, 0 dupes, 0 problems. Next gap: 651. Not compiled; no push/deploy.

## 2026-08-18 — Picture-audit phase 2 group 10 (25 images, seq 651-675)

- Processed sequences 651-675 with 5 parallel agents -> agent-out-850/agent65-69.jsonl (one attempt per image). No blocked/withheld; no new needsReview.
- merge850.py check: 75/250, 175 gaps, 0 dupes, 0 problems. Next gap: 676. Not compiled; no push/deploy.

## 2026-08-18 — Picture-audit phase 2 group 11 (25 images, seq 676-700)

- Processed sequences 676-700 with 5 parallel agents -> agent-out-850/agent70-74.jsonl (one attempt per image). Seq 685 (post #2735) marked needsReview: only a 93x399 thumbnail survives, body text illegible; row added to audit/picture-review.md. No blocked/withheld.
- merge850.py check: 100/250, 150 gaps, 0 dupes, 0 problems, needsReview [607, 685]. Next gap: 701. Not compiled; no push/deploy.

## 2026-08-18 — Picture-audit phase 2 group 12 (25 images, seq 701-725)

- Processed sequences 701-725 with 5 parallel agents -> agent-out-850/agent75-79.jsonl (one attempt per image). Seq 712 (post #2775) marked needsReview: right-column fine print below legible resolution, partial transcription preserved; row added to audit/picture-review.md. No blocked/withheld.
- merge850.py check: 125/250, 125 gaps, 0 dupes, 0 problems, needsReview [607, 685, 712]. Next gap: 726. Not compiled; no push/deploy.

## 2026-08-18 — Picture-audit phase 2 group 13 (25 images, seq 726-750)

- Processed sequences 726-750 with 5 parallel agents -> agent-out-850/agent80-84.jsonl (one attempt per image; seq 739 analyzed as a video from its 3 extracted frames). No blocked/withheld; no new needsReview.
- merge850.py check: 150/250, 100 gaps, 0 dupes, 0 problems. Next gap: 751. Not compiled; no push/deploy.

## 2026-08-18 — Picture-audit phase 2 group 14 (25 images, seq 751-775)

- Processed sequences 751-775 with 5 parallel agents -> agent-out-850/agent85-89.jsonl (one attempt per image). No blocked/withheld; no new needsReview.
- merge850.py check: 175/250, 75 gaps, 0 dupes, 0 problems. Next gap: 776. Not compiled; no push/deploy.

## 2026-08-18 — Picture-audit phase 2 group 15 (25 images, seq 776-800)

- Processed sequences 776-800 with 5 parallel agents -> agent-out-850/agent90-94.jsonl (one attempt per image; range included 19 of the 22 fetched thumbnails, all analyzed fine). Seq 795 (post #2940) marked needsReview: per-district count table, full grid not transcribed cell-by-cell; row added to audit/picture-review.md. No blocked/withheld.
- merge850.py check: 200/250, 50 gaps, 0 dupes, 0 problems, needsReview [607, 685, 712, 795]. Next gap: 801. Not compiled; no push/deploy.

## 2026-08-18 — Picture-audit phase 2 group 16 (25 images, seq 801-825)

- Processed sequences 801-825 with 5 parallel agents -> agent-out-850/agent95-99.jsonl (one attempt per image). No blocked/withheld; no new needsReview.
- merge850.py check: 225/250, 25 gaps, 0 dupes, 0 problems. Next gap: 826. Not compiled; no push/deploy.

## 2026-08-19 — Picture-audit phase 2 FINAL group (25 images, seq 826-850) — 250/250 COMPLETE

- Final group processed with agents 100-104; two agents lost their connection mid-run (all their durably-appended records kept; nothing lost) and the 3 never-attempted images (835, 839, 840) were completed by recovery agent105 after a session-limit reset. One attempt per image throughout.
- FINAL merge850.py check: 250/250, 0 gaps, 0 dupes, 0 problems. Confidence: green 205 / yellow 37 / red 8. needsReview (4): 607, 685, 712, 795 — all four have rows and notes in audit/picture-review.md; no withheld/blocked images in the entire phase (the Withheld table gained no phase-2 rows). Independent recount over agent-out-850/ confirms every sequence 601-850 occurs exactly once.
- Cumulative archive coverage now analyzed: 850 of 1690 distinct images (first100 + batch500 + batch850). NOT compiled into public/data; no push, no deploy; src/pages/ResolutionCenter.tsx and scripts/test-picture-resolution.mjs untouched throughout.

## 2026-08-19 — Picture analysis COMPILED into the app + Resolution Center review section (deploy batch)

**Request:** Owner asked to commit everything and deploy to qdrops.app for a test run.
**Solution:**
- Compiled both audited phases into `public/data/picture-analysis.json`: +500 (seq 101-600) then +250 (seq 601-850). Now **850 images**, 0 duplicate hashes, schema complete on every row, covering 767 distinct posts. Confidence: green 699 / yellow 118 / red 33. needsReview: 16 (the original 3 compilations + 9 from phase 1 + 4 from phase 2).
- No SEED_VERSION bump: `picture-analysis.json` is NOT in `SEEDED_FILES` (fetched at runtime by `src/lib/pictureAnalysis.ts`, never seeded to IndexedDB), so seed invariant 8 does not apply. The service worker caches `/data/*.json` cache-first but the deploy bumps `CACHE_VERSION`, which drops the old caches for returning readers.
- `src/pages/ResolutionCenter.tsx`: the `PictureReviewSection` (two-red-dot queue) now ships — it reads `needsReview` from picture-analysis.json and deep-links each flagged image to its posts, deliberately separate from the certified queue totals.
- `scripts/test-picture-resolution.mjs`: browser proof for that section.

## 2026-08-19 — CRLF in the one data file Node never rewrites (delivery gate fix)

**Symptom:** first live deploy of the 850-image bundle passed 13/14; `verify-live.mjs` reported
`picture-analysis.json content differs (1400468 vs 1433125 bytes)`.

**Cause — line endings, not content.** The file had 32,657 CRLF and zero bare LF; strip the CRs and
it is 1,400,468 bytes, the served size to the byte. `git hash-object` proves the working copy and the
committed blob are the SAME blob (`159486f7`), and the fetched JSON parses equal to disk (850 images,
16 needsReview). Every other file in `public/data` is LF because `export-firestore.mjs` rewrites them
with Node on every deploy — picture-analysis.json is the one published artifact Node never touches. It
was written by `merge*.py` via `open(...,'w')`, and Python text mode on Windows translates \n → \r\n.
Git then normalises CRLF → LF when committing the gh-pages branch, so production serves LF while the
built bundle on disk kept CRLF. `verify-live.mjs` compares production against `dist/`, so it compared
LF against CRLF and correctly refused to call them identical.

**Fix (all three layers, so it cannot recur):**
- `merge500.py` / `merge850.py` compile step now opens with `newline='\n'`.
- `public/data/picture-analysis.json` normalised to LF (identical blob — no content change).
- `.gitattributes`: `public/data/*.json text eol=lf`. Without it, `core.autocrlf=true` rewrites these
  to CRLF on the next checkout and the gate breaks again; keeping the file LF with no rule instead
  leaves the tree permanently dirty, which `write-build-info.mjs` refuses. The rule settles both.
  Needed `git add --renormalize` so the index recorded the working copy under the new attribute.

**Nothing about the live content was wrong** — this deploy republishes identical JSON so that the
bundle on disk matches the bytes production serves and the delivery check can prove it.

## 2026-08-19 — 56 of 63 broken images recovered, and Back finally returns you to your place

**Request (owner):** fix whatever pictures we can, and stop Back from throwing me to the top of
the page — with thousands of rows, finding my place again means scrolling past hundreds of posts.

### Broken pictures: 63 → 7

Measured across the whole archive, not sampled. 1,835 distinct attachments, 63 failing across 49
posts, in three groups:

- **38 were our own bug, not a dead CDN.** Those attachments were recorded as the board's
  *thumbnail* path, and `mediaUrl.ts` forwarded `file_store/thumb/<hash>` to qalerts — which
  mirrors by content hash and keeps only the FULL file. We were asking for something that never
  existed while the same image sat at `/media/<hash>`. Verified safe before touching it: the
  archive holds exactly 38 thumb URLs and **zero of them load today**, so stripping the segment
  cannot regress a working image. All 38 now serve, at full resolution rather than as thumbnails.
- **18 4plebs images survive only on the Wayback Machine.** Downloaded once into `public/media/`
  and served by us (`src/lib/rescuedMedia.ts` maps original URL → local file). Publishing beats
  rewriting to archive.org at render time: no third-party dependency in the image path, no rate
  limit in front of a reader, and they cannot rot again. Kept at ORIGINAL resolution — several are
  the giant stitched compilations in the manual-review queue, whose text is the entire point;
  downscaling would destroy what we are preserving. 16.3 MB, lazy-loaded per tile.
- **7 are gone** from 4plebs, qalerts and Wayback alike. Hiding them is the honest behaviour.

### Back now returns you to your scroll position

`ScrollRestoration` already existed and was carefully written — but it decided *which element
scrolls* by measuring content height (`scrollHeight > clientHeight`). That is a question about
DATA, asked at the worst moment: the layout effect fires after the new route mounts but before its
thousands of rows arrive, so `<main>` is still short, the test answers "does not scroll", and both
the save and the restore were aimed at the document. On desktop `<main>` owns the scrollbar
(`lg:overflow-y-auto`), so writing to the document did nothing and reading it back gave 0 — every
position stored as 0, Back always at the top. The same failure the file was written to fix,
returning through another door.

Now it asks the STYLESHEET (`getComputedStyle(el).overflowY`), which is correct on the first frame
and stays correct while the list loads.

**Proved, not assumed** — `scripts/test-scroll-restoration.mjs` scrolls 1500px, opens a drop,
presses Back and asserts the position returns, at both breakpoints:

    ok: desktop /posts: Back restored 1500px (was 1500px)
    ok: phone /posts:   Back restored 1500px (was 1500px)
    ok: desktop /pics:  Back restored 1500px (was 1500px)

Registered in `validate.mjs` and the `GATES` allowlist, so it runs on every future deploy — this
behaviour had no browser proof at all before, which is why it could break unnoticed.

## 2026-08-19 — /pics: 133 duplicate tiles removed, 24 broken links → 8

**Owner report:** still 24 broken CDN links, and "a lot of duplicate pictures with the same post
number side by side".

**Duplicates — deduping on the wrong string.** `QPostPics` built its tile list with a `seen` set
keyed on the RECORDED url. But 82 posts record the same picture twice (qalerts plus the onion or
8kun mirror), and others record a thumbnail beside the full file: different strings, one image.
`mediaUrl()` collapses them to a single address, so the fix is to key `seen` on the RESOLVED url —
which is exactly what `dedupeMedia()` in mediaUrl.ts already existed to do, and this page never
used. **133 duplicate tiles**, now 0.

**Broken count — 4 of them were never images.** `isImageUrl()` accepted any URL whose PATH
contained /media/, /uploads/, /photos/ etc., regardless of extension. Every one of the six URLs
extracted from drop text was a false positive: a Hill article under `/homenews/media/`, three
government and news **PDFs** under `/uploads/`, a judicialwatch PDF, and a Twitter photo PAGE at
`/photo/1`. They can never render in an `<img>`, so each was counted against the archive as a
broken CDN link. Now a non-image extension is rejected outright, and a path-only match must have a
filename-looking last segment.

**Where the numbers land:**

    tiles      2009 → 1870      (133 duplicates + 6 non-images)
    duplicates  133 → 0
    broken       24 → 8

The remaining 8 are the 7 genuinely-dead 4plebs images (one appears in two posts) — gone from
4plebs, qalerts and the Wayback Machine alike.

**Regression guard:** `test-picture-chips.mjs` now walks every rendered tile and fails if any post
shows the same image twice — `ok: /pics has no duplicate tiles (1870 checked)`.

**Known, not fixed here:** the tile map calls `allItems.findIndex(...)` per tile to derive a key,
which is O(n²) — ~1.7M string comparisons per render, repeated on every search keystroke. Worth
replacing with an index computed during construction; left alone to keep this change focused.

## 2026-08-19 — Q Post Pics moved under Q Emphasis (nav)

Owner ruling: Q Post Pics belongs with the analysis sections, not down in the utility list.

Moved out of `bottomLinks` and rendered inside the analysis group directly after Q Emphasis,
using the shape `Q [ Brackets ]` already established for a ROUTE link living inside that
tab-driven list — a dot rather than an icon, so it reads as part of the group. Teal to match the
picture feature's existing colour language (the Pic chips and the pic-matched card tag).

Verified in the browser rather than by reading the array: nav order around it is
`Q Themes · Q Emphasis · Q Post Pics · ⚠ Overlaps`, and "Q Post Pics" appears exactly once — the
failure mode of this edit is leaving the old entry in place and shipping it twice.

## 2026-08-19 — The second scrollbar: one invisible pixel, anchored to the wrong element

**Owner report:** Post Archive, Claims, Predictions, Entities and Themes show TWO scrollbars on the
right; other pages show one.

That list is the clue — it is exactly the set of pages that render a month chart.

**Cause.** `MonthFilter` announces its selection through `<div aria-live="polite" className="sr-only">`.
Tailwind's `sr-only` is `position: absolute`. `<main>` was not a positioning context, so that
element's containing block was `<body>` — which means it escaped `main`'s `overflow-y-auto`
entirely and was laid out at its static position deep inside main's content. On /posts that put a
**1×1 invisible div at document y≈820 in an 800px viewport**: 21px of scrollable document height,
rendered as a full-height second scrollbar for one pixel of content nobody can see.

Measured rather than guessed: hiding `<main>` dropped `documentElement.scrollHeight` from 821 to
800, and a sweep of ten routes found exactly ONE body-anchored absolutely-positioned element in the
whole app — that 1×1 `sr-only` div, present only on month-chart pages. Nothing else could shift.

**Fix:** `<main>` is now `relative`. Its own absolutely-positioned descendants are contained and
clipped by its scroll box, so the document stops growing. One scrollbar everywhere.

### Correction to the previous entry's proof

`scripts/test-scroll-restoration.mjs` called `b.page(url, { viewport })`, but the harness signature
is `page(url, viewport)` — positional — and defaults to `mobile: true`. The object was read as
`{width: undefined, height: undefined}`, so BOTH the "desktop" and "phone" cases ran at phone
metrics and the desktop path — `<main>` as the scroll container, the very thing the Back-button bug
lived in — was never exercised. The fix was right; the proof was weaker than reported. The gate now
passes the viewport positionally with `mobile: false`, and its desktop cases report
`main scrolls true`. It also now asserts, on five routes, that the document does not scroll at all:

    ok: desktop /posts: Back restored 1500px (was 1500px)
    ok: /posts: one scrollbar (document overflow 0px, main scrolls true)
    ok: /analysis?tab=claims: one scrollbar (document overflow 0px, main scrolls true)

## 2026-08-19 — Back on /pics: the save was recording a clamped zero

The new scroll gate immediately earned its place: it failed on `desktop /pics` about one run in
three while passing every other route. Instrumenting the navigation showed the position was never
restored badly — it was never SAVED:

    before nav, scrollTop = 1500
    saved positions = {"/pics":0}

**Cause.** The layout-effect cleanup was written to run "BEFORE the next page's layout body", which
is true — but not before React has COMMITTED the next route's DOM. By then the container is as tall
as the incoming page, and leaving a 100,134px picture grid for a single drop makes the browser clamp
`scrollTop` to 0. Reading it there records a 0 the reader never chose. The analysis pages usually
got away with it because a drop page is often tall enough not to clamp; /pics never was.

**Fix.** The scroll listener already tracks the live position, so a 0 read at unmount no longer
overwrites it — `atUnmount > 0 ? atUnmount : tracked`. A reader genuinely sitting at the top has 0
tracked as well, so nothing is lost.

Two supporting fixes found along the way:

- **The retry budget was the wrong instrument.** It asked "has enough time passed?" when the
  question is "has the content arrived?". It now resets on any frame where `scrollHeight` changes,
  with a 20s hard cap — a slow page gets the patience it needs, an unreachable position still gives
  up promptly.
- **QPostPics rebuilt everything on every render.** `allItems` (1,870 items, each calling
  `mediaUrl`) was recomputed per render and each tile then derived its key with
  `allItems.findIndex(...)` — O(n squared), ~1.7M string comparisons per render, repeated on every
  keystroke in the search box. Now memoised with the index carried on the item. Also fixes a real
  bug in "Loaded Only": `failedKeys` holds indices into `allItems` but the filter applied them to
  positions within the SEARCH RESULTS, so with a search active it hid whichever tiles happened to
  sit at those positions rather than the ones that failed.

**Five consecutive green runs** of the gate after the fix, against the flake that reproduced within
three before it.

---

## Session — 19 Aug 2026

### Request: compile every sentence in the archive that is not 100% highlighted, in a form GPT can review

Owner rule, locked: **if any part of a sentence is unhighlighted at any percentage, the whole
sentence goes in the list.** A highlighted name, place, bracket, entity, theme anchor or link
inside a sentence never hides the rest of it. Emphasis never counts as coverage. Only 100%
coverage excludes. Q post number on every row. Excel output.

**Solution:** `scripts/audit-unhighlighted-sentences.mjs` — the INVERSE of
`audit-highlight-coverage.mjs`. That one asks "does every certified occurrence resolve to a span?";
this asks "is every character of every sentence owned by a category?"

A ChatGPT-authored package (`QDROPS_AUDIT_V2_DOWNLOAD`) was supplied for this and was **not run**.
It discovers posts and highlights by guessing at JSON key names and directory words, so against
this repo it would have mapped nothing correctly: it cannot know that Questions match on question
FORM through `certifiedQuestionRegex`, that Emphasis and Context stopped painting on 2026-08-17,
that themes highlight on anchors rather than labels, or that the browser paints `runtimeText()`
rather than the raw `posts.json` bytes. Measuring against raw bytes is the exact mistake that
produced 2,475 wrong spans once already. The owner's rule was implemented; the implementation was
rewritten against the app's real renderer.

Fidelity: coverage is transcribed from `renderPostBody()` (`src/pages/PostDetail.tsx`) and
`highlightText()` (`src/lib/postHighlight.tsx`) — same layers, escaping, alias union across BOTH
registries, word boundaries, `>>NNNNNN` protection. Segmentation reuses `scripts/lib/segment.mjs`
`unitsFor()`, extended to carry offsets; quoted-source detection reuses
`scripts/lib/quotedBlocks.mjs`; the directive routing hint reuses `scripts/lib/imperative.mjs`.

**Result:** 29,569 Q-authored units, 13,545 fully painted, **16,024 queued across 4,484 posts** —
but only **8,495 distinct wordings**, and only **1,323 rows / 1,054 wordings** that nothing in the
archive has ever dispositioned. Certified spans failing to resolve: **0**, so nothing in the queue
is a rendering bug.

Ten triage buckets, each a population one ruling settles: `A_SIGNATURE` 4,524 rows / **3** wordings
(Q, Q+, WWG1WGA) · `B_LINK_OR_REFERENCE` 1,636 · `C_PUNCTUATION_ONLY` 892 · `D_INLINE_ONLY` 948 ·
`E_CERTIFIED_QUOTED_SOURCE` 728 · `F_CERTIFIED_EMPHASIS_NOT_PAINTED` 1,423 ·
`G_CERTIFIED_CONTEXT_NOT_PAINTED` 4,023 · `H_CERTIFIED_CODE` 434 · `I_CERTIFIED_EVIDENCE` 93 ·
`J_UNCLASSIFIED_PROSE` **1,323**.

That split is the finding. 14,701 of the 16,024 are a POLICY question the owner has largely already
answered — does "every sentence in a category" require a visible FILL, given that Emphasis and
Context were deliberately unpainted on 2026-08-17? Only bucket J is adjudication.

`scripts/build-unhighlighted-sentence-workbook.mjs` writes the .xlsx by hand (zip + OOXML, no npm
dependency): Summary / Distinct Wordings / Unclassified Prose / Review Queue, Q post number first,
frozen panes, filters, dropdown validation on every review column. Verified: zip integrity passes,
all sheet XML well-formed, opens in a real reader.

Validated on real data, not a fixture — all five required cases plus five invariants:
inline-name-only sentences are PARTIAL_ONLY (1,116); punctuation-only leftovers kept (1,053);
no fully category-painted sentence is queued (0); emphasis-only sentences included with Emphasis
recorded as certified-but-unpainted (804); multi-layer sentences appear once with every overlap
(136, zero duplicate audit IDs). Cross-checked against PROJECT_CONTEXT's own descriptions of #4961
and #4962 and they match exactly. `fullyPainted + queued == units` exactly, so nothing was silently
dropped.

**Files:** `scripts/audit-unhighlighted-sentences.mjs`,
`scripts/build-unhighlighted-sentence-workbook.mjs`, `audit/unhighlighted-sentences/`
(README.md, manifest.json, distinct-wordings.csv, by-bucket/*.csv,
unhighlighted-sentence-review.xlsx; the 34MB JSONL and 11MB CSV are gitignored as regenerable),
`.gitignore`.

**Untouched:** `public/data`, classifications, the rebuild chain, deployment, Emphasis.

## 2026-08-19 — Row evidence: Pic and URL chips beside an analysis row (PHASE 1, LOCAL ONLY)

**Owner request:** searching POTUS should also surface the PICTURES and URLs tied to POTUS or any
POTUS alias, each chip carrying the Q post number that holds the asset, placed in the row itself.

**First, what actually existed.** Pic chips were real but lived only in Post Archive search results
— the original build scoped them to "archive searches". URL chips did not exist anywhere. Neither
was a regression; those surfaces were never wired.

**The line this feature must not cross.** `pictureAnalysis.ts` says image text feeds SEARCH ONLY
and must never reach the certified analysis index (invariant 9's rule for quoted text), and entity
rows render from `entity-public-view.json` rather than recounting anything. So a picture-only or
URL-only match cannot join a row's postNums, its mentions figure, its ×N posts badge, or the set
"read N drops" opens. `#1254` = Q named the subject there. `Pic #1254` = a picture there shows them.
Collapsing those would convert a photograph into a statement Q never made.

**Built:** `src/lib/rowEvidence.ts` — one shared helper. Resolves the full alias family through
`getFullAliasGroup`, then admits an asset by either of two grounded routes, keeping which one:
- DIRECT — the asset itself matches: the picture's description/OCR/people/orgs/places, or the URL's
  own domain and path. URLs are tokenised on non-alphanumerics AND camelCase humps, so "trump"
  matches `realDonaldTrump` while word boundaries still stop "us" matching `russia`.
- ASSOCIATED — the asset sits in a drop already certified for the row.
Nothing here asserts anything about what an external page CONTAINS; only the URL text held locally.

`RowEvidenceChips` renders two labelled groups beneath the certified chips, sorted strictly oldest→
newest (owner ruling — evidence class is carried by tooltip and dimming, not by position), one chip
per post per kind with ×N for multiples, capped at 24 with a "+N more" expander. Chips link to
`/post/N?highlight=…&focus=pic|url`; PostDetail gained a `focus` param that scrolls the asset into
view. A URL chip never links out to the external site — its job is to say which drop holds it.

**Phase 1 surfaces:** Named Entities and Q [ Brackets ] only. **Emphasis deliberately excluded.**

**Proof — `scripts/test-row-evidence.mjs`, GREEN**, registered in `validate.mjs` and `GATES`:

    POTUS: 265 Pic and 266 URL chips (24 shown, rest behind "+N more")
    routes: 239/265 Pic and 190/266 URL matched the ALIAS directly; the rest sit in certified drops
    ok: chips sit inside the row card, with the certified chips
    ok: Pic/URL chips sorted oldest → newest
    ok: one chip per post per evidence type — aliases rolled up
    ok: certified chip sequence contains no evidence chips
    ok: alias search (DJT) resolves to the same family without duplicates
    ok: Q [ Brackets ] rows carry the same evidence chips
    ok: Emphasis carries no evidence chips, as ruled

NOT DEPLOYED — held for owner review of the POTUS row locally, as instructed.

## 2026-08-19 — A URL in a drop is one link again (LOCAL, held with the row-evidence review)

**Owner report:** some links in posts are broken up — clicking one highlights only a part and does
not go to the full address.

**Reproduced, exactly as described.** #2166 held one Verge URL and rendered THREE anchors:

    in text : https://www.theverge.com/2018/9/12/17847186/reddit-qanon-milliondollarextreme-ban-sam-hyde
    anchors : https://www.theverge.com/2018/9/12/17847186/   reddit   -

**Cause.** `renderAnnotated` decomposes post text at EVERY span boundary and picks one dominant
kind per sub-interval. `url` sits near the bottom of the priority table, so a term classified
inside a link (`reddit`) took that sub-interval — and because `url` is dominant, each surviving
piece became its own anchor with its own PARTIAL href. The visible link went to a truncated
address, which is worse than not linking at all: it looks like it worked.

**Fix.** A URL is now collected into ONE anchor carrying the FULL address, with the sub-intervals
inside it rendered as its children. And because the wrapping anchor keeps the link whole, `url` no
longer has to own the span to stay clickable — so a classification inside an address can finally
SHOW, as a mark nested in the link. #2166 now renders 2 anchors for its 2 URLs, full hrefs, with
`reddit`, `qanon` and `cnet` marked inside them. The link works and the context is visible.

**Proof — `scripts/test-url-integrity.mjs`, GREEN**, registered in `validate.mjs` and `GATES`:

    ok: every anchor carries a complete URL across 14 drops
    ok: classifications inside links still render (10 mark(s) nested in anchors)

One false alarm worth recording: the gate first failed on #2094, whose text stores `&amp;` while
the rendered href is decoded to `&`. That was the GATE comparing raw text against decoded output,
not a broken link — it now decodes entities before comparing.

NOT DEPLOYED — held with the row-evidence work for owner review.

## 2026-08-19 — Row buttons swapped: finish the post numbers, then read them (LOCAL)

**Owner ruling:** the button that shows the rest of the posts comes FIRST; "read N drops" moves to
the right, across every category.

One renderer in `AnalysisArchive` serves all categories, so the swap is a single reorder — the
expander now sits directly beside the chips it expands, and "read N drops" lands at the end of the
row where it reads as the next step rather than an interruption.

Verified in the browser with a STRICT matcher (an earlier loose one matched the word "more" inside
a claim's own text and reported a passing order for a row that had no expander at all):

    namedEntities/POTUS    MORE-then-READ | +377 more , ▼ read 417 drops
    themes                 MORE-then-READ | +280 more , ▼ read 320 drops
    directives             MORE-then-READ | +377 more , ▼ read 417 drops

Claims and Predictions show "no row with both" — their top rows sit under the 40-chip cap, so no
expander exists to order. Not a failure.

NOT DEPLOYED — held with the row-evidence and URL work for owner review.

## 2026-08-19 — Row evidence Phase 2 (all active categories) + the picture-audit runbook

**Phase 2, per owner ruling:** the same shared helper now serves Named Entities, Q [ Brackets ],
Claims, Predictions, Themes, Directives (`/requests`) and Questions (`/questions`).

**Emphasis is excluded, and so are the two categories labelled 'Emphasis'** — `impliedConclusions`
and `verificationHooks` carry that label, so letting them through would reintroduce the category by
a back door. `EVIDENCE_CATS` states the set once.

Gate extended to every surface, GREEN:

    ok: Q [ Brackets ] rows carry the same evidence chips (30)
    ok: Claims rows carry the same evidence chips (1)
    ok: Predictions rows carry the same evidence chips (5)
    ok: Themes rows carry the same evidence chips (18)
    ok: Directives rows carry the same evidence chips (36)
    ok: Questions rows carry the same evidence chips (48)
    ok: Emphasis carries no evidence chips, as ruled

**`audit/PICTURE-AUDIT-RUNBOOK.md`** — written because the picture audit is being paused for token
budget and the remaining ~840 images must come out looking identical to the 850 already published.
It records: where every artifact lives, the coverage table (n=851 is next), how to start a batch
(the enumeration guard that refuses to emit unless it reproduces existing rows hash-for-hash), the
25-per-group / 5×5 agent loop, ONE attempt per image, the two non-ordinary record shapes (withheld
and incomplete, and why two red dots differ from one), the compile step, why no SEED_VERSION bump
is needed, why the file must be LF, the measured cost (~7,700 tokens/image, ~1.7% needsReview), and
how the session-limit and connection-drop interruptions were recovered without duplicating work.

## 2026-08-19 — "Sources linked in this drop" now lists EVERY link in the drop

**Owner report:** #2166 carries two links but the Sources section lists one.

**Cause — the section was never a complete list.** It renders `linked-sources.json`, the artifact
produced by the certified URL cleanup: addresses ADJUDICATED as named sources, 99 hostnames across
288 drops. theverge.com had been adjudicated; cnet.com had not, so it was in the drop and absent
from the section. Not a bug in the data — a mismatch between what the section holds and what its
heading promises.

**Fix, additive.** The certified rows are untouched and keep their identification wording
("identified source" / "named, not identified"). Every other URL in the drop text is now listed
BESIDE them as `hostname · linked, not a named source`. Widening the certified artifact by guessing
which unadjudicated domains "are" sources is exactly what the URL cleanup refused to do, so the
distinction is stated in the row rather than dissolved.

Matching is canonicalised (entity-decoded, trailing slash and punctuation stripped, lower-cased) so
an address never appears twice under two headings.

    #2166: theverge.com , cnet.com
    #2377: thehill.com , saraacarter.com

`scripts/test-url-integrity.mjs` now asserts it for every sampled drop:

    ok: every anchor carries a complete URL across 14 drops
    ok: every link in the drop is listed in "Sources linked in this drop" (14 drops)
    ok: classifications inside links still render (10 mark(s) nested in anchors)
