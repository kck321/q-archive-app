import type { QPost, QQuestion, QTopic, QResource, PostAnalysis, AnswerStatus } from '../types'
import { loadLocalData, mutateStore, onStoreMutated } from './localData'
import { pushPostEdit, pushQuestionAdd, pushQuestionDelete } from './sync'
import { getAliasGroup } from './aliases'

// ─── Item text normalization ──────────────────────────────────────────────────
// One key for "the same phrase" across the whole app. What matters when grouping or
// searching an extracted item is the WORDS, not how it was punctuated in that post —
// the AI copies text verbatim, so "Future proves past", "Future proves past." and
// "FUTURE PROVES PAST" all arrive as separate strings and would otherwise split one
// phrase into several rows with fragmented counts.
//
// Handles: case, leading/trailing punctuation, curly vs straight quotes, [brackets],
// @handles, hyphens/underscores/dots inside names (MS-13 = MS_13, Ray.Chandler =
// Ray Chandler), and collapsed whitespace.
//
// '+' is deliberately kept as a word character: Q and Q+ are DIFFERENT designations in
// this archive and must never merge. Measured over all 4,966 posts this collapses 249
// duplicate rows without merging anything that should stay apart.
export function normalizeItemKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── Text index: "which posts contain this phrase?" ───────────────────────────
// Shared by every frequency list (analysis categories, questions, requests) so they all
// answer that question the same way.
//
// WHY it exists: the AI only tags a phrase where it happened to notice it. "Future proves
// past" was extracted as a Prediction in 25 posts while the phrase appears in 38; "Enjoy
// the show" was tagged as a Request in 66 while it appears in 69. A researcher wants every
// post that CONTAINS the phrase, so the tagged posts get topped up from the text.
//
// WHY the index: brute force (30,981 items × 4,966 posts = 153.8M substring tests) measured
// 26.7 seconds — unusable in a browser. Taking the phrase's RAREST word and checking only
// the posts already known to contain it drops that to ~309K checks and ~450ms.
export interface TextIndex {
  /** postNum → normalized text, space-padded on both ends for word-boundary matching. */
  padded: Map<number, string>
  /** word → post numbers containing it. */
  byWord: Map<string, number[]>
}

// ─── Derived caches ───────────────────────────────────────────────────────────
// The text index and the frequency table are both derived purely from the store, and both
// are expensive: the index normalizes all 4,966 post bodies (~42ms) and getAnalysisFrequency
// costs ~700ms end to end. getAnalysisFrequency is called from FIVE places — four of them on
// PostDetail alone — so an uncached page paid it repeatedly for identical output.
//
// Both are dropped whenever the store is written, so an edit can never be served stale data.
let _textIndex: TextIndex | null = null
let _freqPromise: Promise<AnalysisCategoryFreq[]> | null = null
onStoreMutated(() => { _textIndex = null; _freqPromise = null })

/** Shared text index, built once per data version. */
export async function getTextIndex(): Promise<TextIndex> {
  if (!_textIndex) {
    const { posts } = await loadLocalData()
    _textIndex = buildTextIndex(posts)
  }
  return _textIndex
}

export function buildTextIndex(posts: QPost[]): TextIndex {
  const padded = new Map<number, string>()
  const byWord = new Map<string, number[]>()
  for (const post of posts) {
    const t = normalizeItemKey(post.text ?? '')
    padded.set(post.postNum, ` ${t} `)
    for (const w of new Set(t.split(' '))) {
      if (!w) continue
      let list = byWord.get(w)
      if (!list) { list = []; byWord.set(w, list) }
      list.push(post.postNum)
    }
  }
  return { padded, byWord }
}

/**
 * Post numbers whose text contains `phrase` on word boundaries.
 *
 * Returns [] for a single token that is ≤2 characters or a common English word. Those
 * cannot be matched on text alone without swamping the list — measured: "WHO" the
 * organization is indistinguishable from the question word (8 → 493 posts) and "EM" from
 * the syllable (2 → 1,445). The padding is what enforces word boundaries; without it a
 * raw substring test matches "q" inside "question" (68 → 4,328).
 */
export function postsContainingPhrase(index: TextIndex, phrase: string): number[] {
  const key = normalizeItemKey(phrase)
  if (!key) return []
  const words = key.split(' ')
  if (words.length === 1 && (key.length <= 2 || SCAN_STOPWORDS.has(key))) return []

  let candidates: number[] | null = null
  for (const w of words) {
    const list = index.byWord.get(w)
    if (!list) return []                 // a word appears nowhere → no match possible
    if (!candidates || list.length < candidates.length) candidates = list
  }
  if (!candidates) return []

  const target = ` ${key} `
  const out: number[] = []
  for (const num of candidates) if (index.padded.get(num)?.includes(target)) out.push(num)
  return out
}

/**
 * How many times `normPhrase` occurs in one post's padded normalized text.
 *
 * Post counts alone understate presence: a name repeated four times in one drop counts
 * once. Measured across the archive, counting in-post repeats adds 13,843 occurrences —
 * +27% on Named Entities, +18% on Checkable Claims, and exactly +0% on Implied
 * Conclusions (those are paraphrases the AI writes, not text copied from the post, so
 * they can never repeat in the body — a useful sanity check that this counts what we think).
 *
 * Steps by `needle.length - 1` so back-to-back repeats share their separating space and
 * both get counted.
 */
export function countPhraseOccurrences(paddedNormText: string, normPhrase: string): number {
  if (!normPhrase) return 0
  const needle = ` ${normPhrase} `
  let n = 0
  let i = 0
  for (;;) {
    const at = paddedNormText.indexOf(needle, i)
    if (at === -1) return n
    n++
    i = at + needle.length - 1
  }
}

// ─── Sentence expansion ───────────────────────────────────────────────────────
// The extractor was told to "copy EXACT text", but it frequently lifts a clause instead of
// the sentence: "the FBI, and MI, have an open investigation into the CF" from "Remember,
// the FBI, and MI, have an open investigation into the CF." Measured across the archive,
// 21% of Claims, 12% of Predictions and 37% of Checkable Claims are fragments like that.
//
// A chopped Checkable Claim is often no longer checkable, which is the whole point of the
// category — so items are expanded back out to their sentence in the source post, at read
// time. Deterministic, costs nothing, and changes no stored data.
//
// Only applied to the three categories the prompt asks to be copied verbatim. Named entities
// are identifiers, themes are tags, and implied conclusions are paraphrases that never
// appear in the text at all — expanding those would be wrong.
const SENTENCE_CATS = new Set(['claims', 'predictions', 'verificationHooks'])
const NEWLINE = String.fromCharCode(10)
const MAX_SENTENCE = 400   // a terminator-free paragraph should not become one giant "sentence"

export function expandToSentence(item: string, postText: string): string {
  const needle = item.trim()
  if (!needle || !postText) return needle
  const at = postText.toLowerCase().indexOf(needle.toLowerCase())
  if (at === -1) return needle            // paraphrased — there is nothing to expand to

  const isSentenceEnd = (i: number) => {
    if (!'.!?'.includes(postText[i])) return false
    // "twitter.com" and "9.11" are not sentence ends.
    return !/[A-Za-z0-9]/.test(postText[i + 1] ?? '')
  }

  let start = at
  while (start > 0) {
    const c = postText[start - 1]
    if (c === NEWLINE) break
    if (isSentenceEnd(start - 1)) break
    start--
  }
  let end = at + needle.length
  while (end < postText.length) {
    if (postText[end] === NEWLINE) break
    if (isSentenceEnd(end)) { end++; break }
    end++
  }

  const out = postText.slice(start, end).trim().replace(/\s+/g, ' ')
  return !out || out.length > MAX_SENTENCE ? needle : out
}

// ─── Question-form matching ───────────────────────────────────────────────────
// A QUESTION must be matched as a question. `normalizeItemKey` strips punctuation, so the
// generic backfill turned the question "Twitter?" into the bare token "twitter" and claimed
// it was asked in 960 posts — when it is actually asked in 6. Every short question ending
// in "?" was inflated the same way.
//
// So question backfill matches the phrase FOLLOWED BY a question mark, against the raw
// (lowercased, whitespace-collapsed) post body rather than the normalized one.
let _rawText: Map<number, string> | null = null
onStoreMutated(() => { _rawText = null })

async function getRawTextIndex(): Promise<Map<number, string>> {
  if (!_rawText) {
    const { posts } = await loadLocalData()
    _rawText = new Map(posts.map(p => [p.postNum, (p.text ?? '').toLowerCase().replace(/\s+/g, ' ')]))
  }
  return _rawText
}

function questionRegex(questionText: string): RegExp | null {
  // Match the phrase where it ENDS A SENTENCE — followed by ? . or !
  //
  // Not "?" alone: Q's punctuation is inconsistent, so the same line appears as
  // "Define stages?" and "Define stages." Requiring "?" dropped 1,116 real questions.
  //
  // Not a bare word either: matching the token anywhere is what made the question
  // "Twitter?" claim 960 posts instead of 6.
  //
  // The terminator must NOT be followed by a word character, or "twitter.com" reads as
  // the sentence "twitter." — that alone took Twitter? from 18 posts to 887.
  const core = questionText.toLowerCase().replace(/\s+/g, ' ').replace(/[?.!,;:\s]+$/, '').trim()
  if (!core) return null
  const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-z0-9])${escaped}\\s*[?.!](?![a-z0-9])`, 'g')
}

/** Times `questionText` is asked (as a question) inside one post. */
export function countQuestionOccurrences(rawLowerText: string, questionText: string): number {
  const rx = questionRegex(questionText)
  if (!rx) return 0
  return (rawLowerText.match(rx) ?? []).length
}

/** Add every post that ASKS `questionText` to `postNums`. */
export async function backfillQuestionFromText(questionText: string, postNums: number[]): Promise<void> {
  const rx = questionRegex(questionText)
  if (!rx) return
  const raw = await getRawTextIndex()
  const seen = new Set(postNums)
  for (const [num, text] of raw) {
    if (seen.has(num)) continue
    rx.lastIndex = 0
    if (rx.test(text)) { seen.add(num); postNums.push(num) }
  }
}

/** Add every post containing `phrase` (or any alias spelling of it) to `postNums`. */
export function backfillFromText(
  index: TextIndex,
  phrase: string,
  postNums: number[],
  { withAliases = false } = {},
): void {
  const seen = new Set(postNums)
  const spellings = withAliases
    ? new Set([phrase, ...getAliasGroup(phrase)])
    : new Set([phrase])
  for (const spelling of spellings) {
    for (const num of postsContainingPhrase(index, spelling)) {
      if (!seen.has(num)) { seen.add(num); postNums.push(num) }
    }
  }
}

// ─── Generic local writes (used by components in place of direct Firestore calls) ──
export async function updatePost(postId: string, fields: Partial<QPost>): Promise<void> {
  await mutateStore('posts', store => {
    const post = store.postsById.get(postId)
    if (post) Object.assign(post, fields)
  })
  pushPostEdit(postId, fields)   // sync to cloud (fire-and-forget; offline-safe)
}

// Grammatical words that get capitalized at the start of sentences — excluded from the
// "uncategorized repeats" scan so it surfaces real proper-noun/topic candidates.
const SCAN_STOPWORDS = new Set<string>([
  'the','a','an','this','that','these','those','there','then','they','their','them','they\'re',
  'we','us','our','you','your','yours','he','she','it','its','his','her','him','me','my','mine','i',
  'who','what','when','where','why','how','which','whose','whom',
  'do','does','did','is','are','am','was','were','be','been','being','will','would','can','could',
  'should','shall','may','might','must','have','has','had','and','but','or','nor','so','if','as',
  'at','by','for','from','in','into','of','on','to','with','no','not','now','all','any','one','some',
  'yes','ok','okay','more','than','then','too','very','just','also','about','out','up','down','over',
])

// Count of posts that contain at least one bracket code — for the Q Brackets chart tab.
const BRACKET_COUNT_RX = /\[\[?[A-Za-z0-9][A-Za-z0-9 _\-]{0,30}\]?\]/
export async function countPostsWithBrackets(): Promise<number> {
  const { posts } = await loadLocalData()
  let n = 0
  for (const p of posts) if (p.text && BRACKET_COUNT_RX.test(p.text)) n++
  return n
}

// Posts-with-brackets per YYYY-MM month — for the Q Brackets series on the timeline chart.
export async function getBracketsByMonth(): Promise<Record<string, number>> {
  const { posts } = await loadLocalData()
  const out: Record<string, number> = {}
  for (const p of posts) {
    if (!p.text || !BRACKET_COUNT_RX.test(p.text) || !p.timestamp) continue
    const d = new Date(p.timestamp * 1000)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out[m] = (out[m] ?? 0) + 1
  }
  return out
}

// Post numbers whose body contains `text` (case-insensitive). Used to fold an entity's
// alias-spelling occurrences into its post list.
export async function getPostNumsContaining(text: string): Promise<number[]> {
  const key = normalizeItemKey(text)
  if (!key) return []
  // Word-boundary matched, and short/common single tokens return nothing at all.
  //
  // This fed the alias post-lists on the entity rows, and it was the last place still doing
  // a raw substring test. The alias "US" (United States) was matching the English pronoun
  // "us" plus "mUSt", "becaUSe", "rUSsia" — inflating the USA row to 2,270 posts while its
  // own properly-matched count was 233. Two numbers on the same card disagreeing was the
  // giveaway: mentions can never be lower than posts.
  // Uses the shared index rather than re-normalizing all 4,966 post bodies on every call —
  // this runs once per alias per render pass, so the repeat cost added up fast.
  const index = await getTextIndex()
  return postsContainingPhrase(index, key)
}

export interface UncategorizedTerm { term: string; count: number; occurrences: number; postNums: number[] }

export interface UncategorizedReport {
  totalPosts: number
  postsHighlighted: number   // posts with at least one classification (analysis/request/question)
  postsUnhighlighted: number // posts with nothing classified
  pctUnhighlighted: number   // % of posts not highlighted
  terms: UncategorizedTerm[] // uncategorized words/phrases, ranked by repeats
}

// Dashboard scan: coverage stats (% of posts not highlighted) + the full list of
// uncategorized terms with the post numbers they appear in, ranked by repeats.
export async function getUncategorizedReport(): Promise<UncategorizedReport> {
  const { posts, questions } = await loadLocalData()
  const qPostIds = new Set(questions.map(q => q.postId))
  const cats: (keyof PostAnalysis)[] = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks', 'emphasis']
  let highlighted = 0
  for (const p of posts) {
    const a = p.postAnalysis
    const hasAnalysis = !!a && cats.some(c => ((a[c] as string[] | undefined)?.length ?? 0) > 0)
    const hasReq = (p.actionRequests?.length ?? 0) > 0
    const hasQ = qPostIds.has(p.id)
    if (hasAnalysis || hasReq || hasQ) highlighted++
  }
  const total = posts.length
  const unhighlighted = total - highlighted
  const terms = await getUncategorizedRepeats(1, 800)
  return {
    totalPosts: total,
    postsHighlighted: highlighted,
    postsUnhighlighted: unhighlighted,
    pctUnhighlighted: total ? Math.round((unhighlighted / total) * 1000) / 10 : 0,
    terms,
  }
}

// Auto-highlighted glossary terms (military/intel acronyms, Q signatures, static entities).
// Excluded from the scan because they already get highlighted without being classified.
const SCAN_GLOSSARY = new Set<string>([
  'potus','flotus','scotus','declas','fisa','nsa','cia','fbi','doj','dni','dhs','dod','usmc',
  'sigint','humint','psyop','jsoc','socom','gitmo','eo','eas','defcon','stratfor','ng',
  'q clearance','top secret','classified','compartmentalized','chain of command',
  'military intelligence','special operations','covert','clandestine','black site',
  'executive order','national security','martial law','military tribunal','ucmj',
  'bad actor','bad actors','wwg1wga','ncswic','q',
  'future proves past','trust the plan','the great awakening','the storm','dark to light',
  'follow the money','enjoy the show','god wins','where we go one we go all',
])

// Scan every post for words/phrases that are NOT highlighted/classified anywhere, so the user
// can decide what to categorize. Returns each candidate with the number of posts it appears in
// (`count`) and total `occurrences`, ranked by how widely it repeats.
//   • Capitalized words & multi-word phrases (proper nouns) are always included.
//   • Plain lowercase words are included only when they repeat (≥2 posts) to cut noise.
// Use `minPosts` to filter (1 = everything found, 2 = repeated only).
export async function getUncategorizedRepeats(minPosts = 1, limit = 800): Promise<UncategorizedTerm[]> {
  const { posts, questions } = await loadLocalData()

  // Everything already covered: analysis categories + requests + question texts (lowercased).
  const covered = new Set<string>()
  const cats: (keyof PostAnalysis)[] = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks', 'emphasis']
  for (const p of posts) {
    const a = p.postAnalysis
    if (a) for (const c of cats) {
      const arr = a[c] as string[] | undefined
      if (arr) for (const t of arr) covered.add(t.toLowerCase().trim())
    }
    if (p.actionRequests) for (const r of p.actionRequests) covered.add(r.toLowerCase().trim())
  }
  for (const q of questions) covered.add(q.text.toLowerCase().trim())

  const groups = new Map<string, { term: string; postNums: Set<number>; occurrences: number; cap: boolean }>()
  const consider = (raw: string, postNum: number, cap: boolean) => {
    const term = raw.trim().replace(/^[''"']+|[.,;:!?'’"]+$/g, '')
    const key = term.toLowerCase()
    if (key.length < 3) return
    if (/^\d+$/.test(key)) return
    if (SCAN_STOPWORDS.has(key) || SCAN_GLOSSARY.has(key) || covered.has(key)) return
    let g = groups.get(key)
    if (!g) { g = { term, postNums: new Set(), occurrences: 0, cap }; groups.set(key, g) }
    g.postNums.add(postNum)
    g.occurrences++
    if (cap) g.cap = true
  }

  // Capitalized words / phrases (proper nouns)
  const capRx = /\b[A-Z][a-zA-Z0-9'’.]*(?:\s+[A-Z][a-zA-Z0-9'’.]*){0,3}\b/g
  // Any word of 4+ letters (catches lowercase content words like "removal", "agenda")
  const wordRx = /\b[a-z][a-z'’]{3,}\b/g

  for (const p of posts) {
    if (!p.text) continue
    const cleaned = p.text.replace(/>>\d+/g, ' ')
    capRx.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = capRx.exec(cleaned)) !== null) consider(m[0], p.postNum, true)
    const lower = cleaned.toLowerCase()
    wordRx.lastIndex = 0
    while ((m = wordRx.exec(lower)) !== null) consider(m[0], p.postNum, false)

    // Multi-word phrases (2–3 words) within a sentence/clause — surfaces repeated phrases
    // like "criminal elements". Lowercase phrases only count when they repeat (cap=false rule).
    for (const seg of cleaned.split(/[.!?\n;:()[\]"]+/)) {
      const toks = seg.match(/\b[A-Za-z][A-Za-z'’]*\b/g)
      if (!toks) continue
      for (let i = 0; i < toks.length; i++) {
        for (let n = 2; n <= 3 && i + n <= toks.length; n++) {
          const slice = toks.slice(i, i + n)
          if (slice.every(w => /^[A-Z]/.test(w))) continue // all-caps phrase already caught above
          const first = slice[0].toLowerCase(), last = slice[n - 1].toLowerCase()
          if (SCAN_STOPWORDS.has(first) || SCAN_STOPWORDS.has(last)) continue // trim filler at edges
          consider(slice.join(' '), p.postNum, false)
        }
      }
    }
  }

  const out: UncategorizedTerm[] = []
  for (const g of groups.values()) {
    // Keep capitalized terms always; lowercase-only words only when they repeat.
    if (!g.cap && g.postNums.size < 2) continue
    if (g.postNums.size < minPosts) continue
    out.push({ term: g.term, count: g.postNums.size, occurrences: g.occurrences, postNums: [...g.postNums].sort((a, b) => a - b) })
  }
  out.sort((a, b) => b.count - a.count || b.occurrences - a.occurrences || a.term.localeCompare(b.term))
  return out.slice(0, limit)
}

// Classify a snippet into `category` on EVERY post whose text contains that snippet
// (case-insensitive). Skips posts that already have it in that category. Returns the
// number of posts changed. Used by the admin "apply to all" action.
export async function applyAnalysisToMatchingPosts(
  snippet: string,
  category: keyof PostAnalysis,
): Promise<{ changed: number; matched: number }> {
  const trimmed = snippet.trim()
  const norm = trimmed.toLowerCase()
  if (!norm) return { changed: 0, matched: 0 }
  let changed = 0
  let matched = 0
  const changedPosts: { id: string; postAnalysis: PostAnalysis }[] = []
  await mutateStore('posts', store => {
    for (const post of store.posts) {
      // Word-boundary matched. These functions WRITE to every matching post, so a raw
      // substring test made "apply to every post containing US" hit 2,259 posts via
      // "rUSsia", "mUSt" and "becaUSe" — a one-click way to corrupt the archive.
      if (!post.text || !` ${normalizeItemKey(post.text)} `.includes(` ${normalizeItemKey(norm)} `)) continue
      matched++
      const analysis = (post.postAnalysis ?? {}) as PostAnalysis
      const arr = (analysis[category] as string[] | undefined) ?? []
      if (arr.some(i => i.toLowerCase().trim() === norm)) continue // already classified
      ;(analysis[category] as string[]) = [...arr, trimmed]
      post.postAnalysis = analysis
      post.analysisScanned = true
      changed++
      changedPosts.push({ id: post.id, postAnalysis: analysis })
    }
  })
  // Sync every changed post to the cloud
  for (const c of changedPosts) pushPostEdit(c.id, { postAnalysis: c.postAnalysis, analysisScanned: true })
  return { changed, matched }
}

// Inverse of applyAnalysisToMatchingPosts — removes `snippet` from `category` on every post
// that has it. Used to undo an accidental bulk classify.
export async function removeAnalysisFromMatchingPosts(
  snippet: string,
  category: keyof PostAnalysis,
): Promise<{ removed: number }> {
  const norm = snippet.trim().toLowerCase()
  if (!norm) return { removed: 0 }
  let removed = 0
  const changedPosts: { id: string; postAnalysis: PostAnalysis }[] = []
  await mutateStore('posts', store => {
    for (const post of store.posts) {
      const arr = post.postAnalysis?.[category] as string[] | undefined
      if (!arr || arr.length === 0) continue
      const next = arr.filter(i => i.toLowerCase().trim() !== norm)
      if (next.length !== arr.length) {
        const analysis = { ...(post.postAnalysis as PostAnalysis), [category]: next }
        post.postAnalysis = analysis
        removed++
        changedPosts.push({ id: post.id, postAnalysis: analysis })
      }
    }
  })
  for (const c of changedPosts) pushPostEdit(c.id, { postAnalysis: c.postAnalysis })
  return { removed }
}

// One-time migration: push THIS device's existing local edits to the cloud. Diffs the local
// store against the original bundle so only the user's actual edits are uploaded (keeps the
// postEdits collection small). Run once on the device that holds the edits (e.g. desktop).
export async function migrateLocalEditsToCloud(
  onProgress?: (done: number, total: number) => void,
): Promise<{ postsPushed: number; questionsPushed: number }> {
  const store = await loadLocalData()
  const base = `${import.meta.env.BASE_URL}data`
  const [basePosts, baseQuestions] = await Promise.all([
    fetch(`${base}/posts.json`).then(r => r.json()) as Promise<QPost[]>,
    fetch(`${base}/questions.json`).then(r => r.json()) as Promise<QQuestion[]>,
  ])
  const baseById = new Map(basePosts.map(p => [p.id, p]))
  const fields: (keyof QPost)[] = ['postAnalysis', 'actionRequests', 'customBrackets', 'excludedBrackets', 'correlatedNews']

  let postsPushed = 0
  const total = store.posts.length
  for (let i = 0; i < store.posts.length; i++) {
    const p = store.posts[i]
    const b = baseById.get(p.id)
    const differs = fields.some(f => JSON.stringify((p as unknown as Record<string, unknown>)[f] ?? null) !== JSON.stringify((b as unknown as Record<string, unknown> | undefined)?.[f] ?? null))
    if (differs) {
      await pushPostEdit(p.id, {
        postAnalysis: p.postAnalysis, actionRequests: p.actionRequests,
        hasRequests: p.hasRequests, hasQuestions: p.hasQuestions, analysisScanned: p.analysisScanned,
        customBrackets: p.customBrackets, excludedBrackets: p.excludedBrackets,
        correlatedNews: p.correlatedNews, newsScanned: p.newsScanned,
      })
      postsPushed++
    }
    if (onProgress && (i % 250 === 0 || i === total - 1)) onProgress(i + 1, total)
  }

  // Questions: push local adds (not in bundle) and deletes (bundle ones missing locally).
  let questionsPushed = 0
  const baseQIds = new Set(baseQuestions.map(q => q.id))
  for (const q of store.questions) {
    if (!baseQIds.has(q.id)) { await pushQuestionAdd(q); questionsPushed++ }
  }
  const localQIds = new Set(store.questions.map(q => q.id))
  for (const q of baseQuestions) {
    if (!localQIds.has(q.id)) { await pushQuestionDelete(q.id); questionsPushed++ }
  }

  return { postsPushed, questionsPushed }
}

// Bulk: add `text` as a question on EVERY post whose body contains it (case-insensitive),
// skipping posts that already have that question. Mirrors applyAnalysisToMatchingPosts.
export async function addQuestionToMatchingPosts(text: string): Promise<{ added: number; matched: number }> {
  const trimmed = text.trim()
  const norm = trimmed.toLowerCase()
  if (!norm) return { added: 0, matched: 0 }
  let added = 0, matched = 0
  const newQs: QQuestion[] = []
  await mutateStore(['questions', 'posts'], store => {
    for (const post of store.posts) {
      // Word-boundary matched. These functions WRITE to every matching post, so a raw
      // substring test made "apply to every post containing US" hit 2,259 posts via
      // "rUSsia", "mUSt" and "becaUSe" — a one-click way to corrupt the archive.
      if (!post.text || !` ${normalizeItemKey(post.text)} `.includes(` ${normalizeItemKey(norm)} `)) continue
      matched++
      if (store.questions.some(q => q.postId === post.id && q.text.toLowerCase().trim() === norm)) continue
      const q: QQuestion = {
        id: crypto.randomUUID(), postId: post.id, postNum: post.postNum,
        text: trimmed, status: 'unprocessed', infographId: null, createdAt: Date.now(),
      }
      store.questions.push(q)
      newQs.push(q)
      post.hasQuestions = true
      added++
    }
  })
  for (const q of newQs) pushQuestionAdd(q)
  return { added, matched }
}

// Bulk: add `text` as an action request on every post whose body contains it.
export async function addRequestToMatchingPosts(text: string): Promise<{ added: number; matched: number }> {
  const trimmed = text.trim(); const norm = trimmed.toLowerCase()
  if (!norm) return { added: 0, matched: 0 }
  let added = 0, matched = 0
  const changed: { id: string; actionRequests: string[] }[] = []
  await mutateStore('posts', store => {
    for (const post of store.posts) {
      // Word-boundary matched. These functions WRITE to every matching post, so a raw
      // substring test made "apply to every post containing US" hit 2,259 posts via
      // "rUSsia", "mUSt" and "becaUSe" — a one-click way to corrupt the archive.
      if (!post.text || !` ${normalizeItemKey(post.text)} `.includes(` ${normalizeItemKey(norm)} `)) continue
      matched++
      const arr = post.actionRequests ?? []
      if (arr.some(r => r.toLowerCase().trim() === norm)) continue
      const next = [...arr, trimmed]
      post.actionRequests = next
      post.hasRequests = true
      changed.push({ id: post.id, actionRequests: next })
      added++
    }
  })
  for (const c of changed) pushPostEdit(c.id, { actionRequests: c.actionRequests, hasRequests: true })
  return { added, matched }
}

// Bulk: add `code` as a custom bracket on every post whose body contains it.
export async function addBracketToMatchingPosts(code: string): Promise<{ added: number; matched: number }> {
  const trimmed = code.trim(); const norm = trimmed.toLowerCase()
  if (!norm) return { added: 0, matched: 0 }
  let added = 0, matched = 0
  const changed: { id: string; customBrackets: string[] }[] = []
  await mutateStore('posts', store => {
    for (const post of store.posts) {
      // Word-boundary matched. These functions WRITE to every matching post, so a raw
      // substring test made "apply to every post containing US" hit 2,259 posts via
      // "rUSsia", "mUSt" and "becaUSe" — a one-click way to corrupt the archive.
      if (!post.text || !` ${normalizeItemKey(post.text)} `.includes(` ${normalizeItemKey(norm)} `)) continue
      matched++
      const arr = post.customBrackets ?? []
      if (arr.some(b => b.toLowerCase().trim() === norm)) continue
      const next = [...arr, trimmed]
      post.customBrackets = next
      changed.push({ id: post.id, customBrackets: next })
      added++
    }
  })
  for (const c of changed) pushPostEdit(c.id, { customBrackets: c.customBrackets })
  return { added, matched }
}

export async function addQuestions(items: QQuestion[]): Promise<void> {
  if (items.length === 0) return
  await mutateStore(['questions', 'posts'], store => {
    store.questions.push(...items)
    for (const pid of new Set(items.map(i => i.postId))) {
      const p = store.postsById.get(pid)
      if (p) p.hasQuestions = true
    }
  })
  for (const q of items) pushQuestionAdd(q)   // sync to cloud
}

export async function removeQuestionById(id: string): Promise<void> {
  await mutateStore(['questions', 'posts'], store => {
    const q = store.questions.find(x => x.id === id)
    store.questions = store.questions.filter(x => x.id !== id)
    if (q) {
      const p = store.postsById.get(q.postId)
      if (p) p.hasQuestions = store.questions.some(x => x.postId === q.postId)
    }
  })
  pushQuestionDelete(id)   // sync to cloud
}

export async function setQuestionStatuses(updates: Record<string, AnswerStatus>): Promise<void> {
  await mutateStore('questions', store => {
    for (const q of store.questions) {
      if (updates[q.id]) q.status = updates[q.id]
    }
  })
}

// Local id generator (replaces Firestore auto-ids now that writes are local).
function genId(): string {
  return (crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.floor(Math.random() * 1e9)}`)
}

const PAGE_SIZE = 50

// ─── Posts ───────────────────────────────────────────────────────────────────
// Local paginated browse. `cursor` is the index offset into the sorted list (0 to start).
export async function getPosts(
  cursor?: number,
  searchText?: string,
  direction: 'asc' | 'desc' = 'asc'
): Promise<{ posts: QPost[]; nextCursor: number | null }> {
  const { posts } = await loadLocalData()           // sorted by postNum asc
  const ordered = direction === 'desc' ? [...posts].reverse() : posts
  const start = cursor ?? 0
  let page = ordered.slice(start, start + PAGE_SIZE)
  if (searchText) {
    const lower = searchText.toLowerCase()
    page = page.filter(p => p.text.toLowerCase().includes(lower))
  }
  const nextStart = start + PAGE_SIZE
  return { posts: page, nextCursor: nextStart < ordered.length ? nextStart : null }
}

// Searches ALL 4,966 posts for a keyword — returns every match ordered by date.
// Strips 8chan/4chan post references (>>\d+) before matching to prevent false positives
// where a search term happens to appear inside a reference number.
// ─── Date-aware search ────────────────────────────────────────────────────────
// Lets a search term like "Nov 4", "November 4 2018", "11/4", or "2018-11-04"
// match posts by their publish date (not just text content).
type DateQuery = { year?: number; month?: number; day?: number }

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
}

export function parseDateQuery(termLower: string): DateQuery | null {
  const t = termLower.trim()
  if (!t) return null

  // ISO: 2018-11-04 or 2018/11/04 (day optional)
  let m = t.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/)
  if (m) {
    const month = +m[2] - 1
    if (month >= 0 && month <= 11) {
      const q: DateQuery = { year: +m[1], month }
      if (m[3]) q.day = +m[3]
      return q
    }
  }

  // Numeric: 11/4 or 11/4/2018 (month/day[/year])
  m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (m) {
    const month = +m[1] - 1, day = +m[2]
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const q: DateQuery = { month, day }
      if (m[3]) q.year = +m[3] < 100 ? +m[3] + 2000 : +m[3]
      return q
    }
  }

  // Month name: "nov", "november 4", "Nov 4 2018", "4 nov 2018"
  const monMatch = t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/)
  if (monMatch) {
    const q: DateQuery = { month: MONTHS[monMatch[1]] }
    const dayM = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/)
    if (dayM && +dayM[1] >= 1 && +dayM[1] <= 31) q.day = +dayM[1]
    const yearM = t.match(/\b(19|20)\d{2}\b/)
    if (yearM) q.year = +yearM[0]
    return q
  }

  // Year only: 2018
  if (/^(19|20)\d{2}$/.test(t)) return { year: +t }

  return null
}

function dateMatches(ts: number, q: DateQuery): boolean {
  if (!ts) return false
  const d = new Date(ts * 1000)
  if (q.year !== undefined && d.getFullYear() !== q.year) return false
  if (q.month !== undefined && d.getMonth() !== q.month) return false
  if (q.day !== undefined && d.getDate() !== q.day) return false
  return true
}

export async function searchAllPosts(term: string, exact = false): Promise<QPost[]> {
  const lower = term.toLowerCase()
  const dateQuery = parseDateQuery(lower)
  // Expand to the term's alias group so searching one name (e.g. "Hillary") also finds
  // posts using its other names ("Hillary Clinton", "HRC").
  const group = [...new Set([lower, ...getAliasGroup(term).map(t => t.toLowerCase().trim())])].filter(Boolean)
  const matchers = group.map(t =>
    exact ? new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) : t
  )
  const { posts } = await loadLocalData()   // already sorted by postNum asc
  return posts.filter(p => {
    // Date match (e.g. "Nov 4" → posts published on Nov 4 of any year)
    if (dateQuery && dateMatches(p.timestamp, dateQuery)) return true
    // Attachment filenames are searchable content we already hold and were ignoring —
    // names like "187_Site_E.jpg" or "Free_Speech_Systems.png" often carry the only
    // reference to a subject in an image-only drop. qalerts indexes these; we didn't.
    const names = [
      ...(p.media ?? []),
      ...(p.refMedia ?? []),
      ...(p.quotedPosts ?? []).flatMap(q => q.media ?? []),
    ]
      .map(m => (m?.filename ?? '').replace(/[_\-.]+/g, ' '))
      .join(' ')
    // The post a drop replies to is searchable content too — it is what the drop is ABOUT.
    // Drop #2124 is nothing but ">>2950820"; searching its subject matched nothing before.
    // This is also why qalerts reported more hits than we did (MOSSAD: 4 vs our 2).
    // Quoted text feeds SEARCH ONLY — it is anon words 74% of the time, so it is kept out of
    // the analysis index that extracts Q's questions, claims and predictions.
    // Depth ≤ 1 only. The stored chain runs 4 deep, but a subject three hops upstream is not
    // what the drop is about — indexing all of it returned 6 posts for MOSSAD where qalerts
    // returns 4. One hop reproduces qalerts exactly (#1489, #2104, #2123, #2124); the deeper
    // links stay readable on the post page.
    const quoted = (p.quotedPosts ?? [])
      .filter(q => (q.depth ?? 0) <= 1)
      .map(q => (q.text ?? '').replace(/>>\d+/g, ''))
      .join(' ')
    const text = `${(p.text ?? '').replace(/>>\d+/g, '')} ${names} ${quoted}`.toLowerCase()
    return matchers.some(mx => typeof mx === 'string' ? text.includes(mx) : mx.test(text))
  })
}

export async function getPost(id: string): Promise<QPost | null> {
  const { postsById, postsByNum } = await loadLocalData()
  // id may be a Firestore doc id or a stringified postNum — match either
  return postsById.get(id) ?? postsByNum.get(Number(id)) ?? null
}

export async function starPost(id: string): Promise<void> {
  await mutateStore('posts', store => {
    const post = store.postsById.get(id)
    if (post) post.stars = (post.stars ?? 0) + 1
  })
}

export async function getTopRatedPosts(n = 10): Promise<QPost[]> {
  const { posts } = await loadLocalData()
  return [...posts].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)).slice(0, n)
}

export async function getRecentPosts(n = 20): Promise<QPost[]> {
  const { posts } = await loadLocalData()
  return [...posts].sort((a, b) => b.postNum - a.postNum).slice(0, n)
}

// ─── Questions ────────────────────────────────────────────────────────────────
export async function addManualQuestion(
  postId: string,
  postNum: number,
  text: string
): Promise<string> {
  const id = genId()
  await mutateStore(['questions', 'posts'], store => {
    store.questions.push({
      id, postId, postNum, text: text.trim(),
      status: 'unprocessed', infographId: null, createdAt: Date.now(),
    })
    const post = store.postsById.get(postId)
    if (post) post.hasQuestions = true
  })
  return id
}

export interface SimilarGroup {
  canonical: string
  ids: string[]
  texts: string[]
}

// Updates all questions in each group to use the canonical text,
// so getQuestionFrequency naturally groups them together.
export async function mergeSimilarQuestions(
  groups: SimilarGroup[],
  onProgress?: (msg: string) => void
): Promise<number> {
  let totalMerged = 0
  const updates = new Map<string, string>()   // question id → canonical text
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]
    onProgress?.(`Merging group ${g + 1} of ${groups.length}…`)
    group.ids.forEach((id, idx) => {
      if (group.texts[idx].trim() !== group.canonical.trim()) {
        updates.set(id, group.canonical)
        totalMerged++
      }
    })
  }
  if (updates.size > 0) {
    await mutateStore('questions', store => {
      for (const q of store.questions) {
        const canonical = updates.get(q.id)
        if (canonical !== undefined) q.text = canonical
      }
    })
  }
  return totalMerged
}

export async function getQuestionsForPost(postId: string): Promise<QQuestion[]> {
  const { questions } = await loadLocalData()
  return questions.filter(q => q.postId === postId)
}

// Returns a map of postId → question text[] for a batch of posts.
export async function getQuestionsForPosts(
  postIds: string[]
): Promise<Record<string, string[]>> {
  if (postIds.length === 0) return {}
  const want = new Set(postIds)
  const { questions } = await loadLocalData()
  const map: Record<string, string[]> = {}
  for (const q of questions) {
    if (!want.has(q.postId)) continue
    if (!map[q.postId]) map[q.postId] = []
    map[q.postId].push(q.text)
  }
  return map
}

const Q_PAGE_SIZE = 200

export async function getAllQuestions(
  status?: string,
  cursor?: number
): Promise<{ questions: QQuestion[]; nextCursor: number | null }> {
  const { questions } = await loadLocalData()
  const list = status && status !== 'all'
    ? questions.filter(q => q.status === status)
    : [...questions].sort((a, b) => a.postNum - b.postNum)
  const start = cursor ?? 0
  const nextStart = start + Q_PAGE_SIZE
  return {
    questions: list.slice(start, nextStart),
    nextCursor: nextStart < list.length ? nextStart : null,
  }
}

// ─── Question Frequency ───────────────────────────────────────────────────────
export interface QuestionFrequency {
  /** Total mentions across its posts — always >= postNums.length. */
  occurrences: number
  /** postNum → times the phrase occurs INSIDE that post (only when > 1). */
  repeats: Record<number, number>
  text: string
  count: number
  postNums: number[]
  topStatus: import('../types').AnswerStatus
}

// Status priority for "best" status in a group: green > yellow > red > unprocessed
const STATUS_RANK: Record<import('../types').AnswerStatus, number> = {
  green: 3, yellow: 2, red: 1, unprocessed: 0,
}

export async function getQuestionFrequency(minCount = 2): Promise<QuestionFrequency[]> {
  const { questions } = await loadLocalData()

  const groups: Record<string, { count: number; postNums: number[]; originalText: string; topStatus: import('../types').AnswerStatus }> = {}

  for (const q of questions) {
    // Same key as every other frequency list — see normalizeItemKey.
    const key = normalizeItemKey(q.text)
    if (!groups[key]) {
      groups[key] = { count: 0, postNums: [], originalText: q.text, topStatus: 'unprocessed' }
    }
    groups[key].count++
    if (!groups[key].postNums.includes(q.postNum)) {
      groups[key].postNums.push(q.postNum)
    }
    // Track the best status seen for this group
    if (STATUS_RANK[q.status] > STATUS_RANK[groups[key].topStatus]) {
      groups[key].topStatus = q.status
    }
  }

  // A question asked in 10 posts but only extracted from 7 should list all 10 — but ONLY
  // where it is actually asked. Using the generic phrase backfill here stripped the "?" and
  // matched bare mentions, so the question "Twitter?" claimed 960 posts instead of 6.
  // No alias folding either — aliases are an entity concept, not a question one.
  const rawText = await getRawTextIndex()
  for (const g of Object.values(groups)) {
    await backfillQuestionFromText(g.originalText, g.postNums)
  }

  return Object.values(groups)
    .filter(g => g.postNums.length >= minCount)
    .map(g => {
      // Mentions: the same phrase said twice in one drop counts twice.
      let occurrences = 0
      const repeats: Record<number, number> = {}
      for (const n of g.postNums) {
        const c = Math.max(1, countQuestionOccurrences(rawText.get(n) ?? '', g.originalText))
        occurrences += c
        if (c > 1) repeats[n] = c
      }
      return {
        text: g.originalText,
        count: g.postNums.length,
        postNums: g.postNums.sort((a, b) => a - b),
        topStatus: g.topStatus,
        occurrences,
        repeats,
      }
    })
    .sort((a, b) => b.count - a.count)
}

// ─── Timeline ────────────────────────────────────────────────────────────────
export async function getQuestionsTimeline(): Promise<{
  month: string; questions: number; posts: number; requests: number
  claims: number; predictions: number; namedEntities: number
  themes: number; impliedConclusions: number; verificationHooks: number
}[]> {
  // Load all posts to build postId → timestamp map and count per-category by month
  const { posts: allPostsTL, questions: allQuestionsTL } = await loadLocalData()
  const tsByPostId: Record<string, number> = {}
  const postsByMonth: Record<string, number> = {}
  const requestsByMonth: Record<string, number> = {}
  const claimsByMonth: Record<string, number> = {}
  const predictionsByMonth: Record<string, number> = {}
  const namedEntitiesByMonth: Record<string, number> = {}
  const themesByMonth: Record<string, number> = {}
  const impliedConclusionsByMonth: Record<string, number> = {}
  const verificationHooksByMonth: Record<string, number> = {}

  for (const post of allPostsTL) {
    tsByPostId[post.id] = post.timestamp
    const ms = post.timestamp > 1e10 ? post.timestamp : post.timestamp * 1000
    const date = new Date(ms)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    postsByMonth[month] = (postsByMonth[month] ?? 0) + 1
    if (post.actionRequests && post.actionRequests.length > 0) {
      requestsByMonth[month] = (requestsByMonth[month] ?? 0) + post.actionRequests.length
    }
    const a = post.postAnalysis
    if (a) {
      claimsByMonth[month] = (claimsByMonth[month] ?? 0) + (a.claims?.length ?? 0)
      predictionsByMonth[month] = (predictionsByMonth[month] ?? 0) + (a.predictions?.length ?? 0)
      const filteredEntities = (a.namedEntities ?? []).filter(e => !/^Q$/i.test(e.trim()) && !/^\d+$/.test(e.trim()))
      namedEntitiesByMonth[month] = (namedEntitiesByMonth[month] ?? 0) + filteredEntities.length
      themesByMonth[month] = (themesByMonth[month] ?? 0) + (a.themes?.length ?? 0)
      impliedConclusionsByMonth[month] = (impliedConclusionsByMonth[month] ?? 0) + (a.impliedConclusions?.length ?? 0)
      verificationHooksByMonth[month] = (verificationHooksByMonth[month] ?? 0) + (a.verificationHooks?.length ?? 0)
    }
  }

  // Count questions by month
  const questionsByMonth: Record<string, number> = {}

  for (const q of allQuestionsTL) {
    const ts = tsByPostId[q.postId]
    if (!ts) continue
    const ms = ts > 1e10 ? ts : ts * 1000
    const date = new Date(ms)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    questionsByMonth[month] = (questionsByMonth[month] ?? 0) + 1
  }

  // Merge and sort by month
  const allMonths = new Set([...Object.keys(postsByMonth), ...Object.keys(questionsByMonth)])
  return Array.from(allMonths)
    .sort()
    .map(month => ({
      month,
      posts: postsByMonth[month] ?? 0,
      questions: questionsByMonth[month] ?? 0,
      requests: requestsByMonth[month] ?? 0,
      claims: claimsByMonth[month] ?? 0,
      predictions: predictionsByMonth[month] ?? 0,
      namedEntities: namedEntitiesByMonth[month] ?? 0,
      themes: themesByMonth[month] ?? 0,
      impliedConclusions: impliedConclusionsByMonth[month] ?? 0,
      verificationHooks: verificationHooksByMonth[month] ?? 0,
    }))
}

// Returns a map of month → postNums[] for filtering questions by timeline click
export async function getPostNumsByMonth(): Promise<Record<string, number[]>> {
  const { posts } = await loadLocalData()
  const result: Record<string, number[]> = {}
  for (const post of posts) {
    const ms = post.timestamp > 1e10 ? post.timestamp : post.timestamp * 1000
    const date = new Date(ms)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!result[month]) result[month] = []
    result[month].push(post.postNum)
  }
  return result
}

// ─── All posts (for client-side analysis) ─────────────────────────────────────
export async function getAllPosts(): Promise<QPost[]> {
  const { posts } = await loadLocalData()
  return posts   // already sorted by postNum asc
}

// ─── Media / Links ────────────────────────────────────────────────────────────
const IMAGE_EXT_RX = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff?|ico|avif|heic|heif)(\?[^\s]*)?$/i
const IMAGE_PATH_RX = /\/(media|image|img|file_store|thumb|photos?|pictures?|uploads?)\//i
const TEXT_URL_RX = /https?:\/\/[^\s<>"')\]]+/g

function textHasImage(text: string): boolean {
  if (!text) return false
  for (const m of text.matchAll(TEXT_URL_RX)) {
    const url = m[0]
    if (IMAGE_EXT_RX.test(url) || IMAGE_PATH_RX.test(url)) return true
  }
  return false
}

export async function getAllPostsWithMedia(): Promise<QPost[]> {
  const { posts } = await loadLocalData()
  return posts.filter(p =>
    (p.media && p.media.length > 0) ||
    (p.refMedia && p.refMedia.length > 0) ||
    (p.link && (IMAGE_EXT_RX.test(p.link) || IMAGE_PATH_RX.test(p.link))) ||
    textHasImage(p.text ?? '')
  )
}

export async function getAllPostsWithLinks(): Promise<QPost[]> {
  const { posts } = await loadLocalData()
  return posts.filter(p => p.link && p.link.trim() !== '')
}

export interface QTextLink {
  postNum: number
  id: string
  timestamp: number
  url: string
  domain: string
}

/**
 * Every external URL Q actually posted, one row per link.
 *
 * NOT `post.link` — that is the drop's own permalink on 8chan, which every post has, so
 * filtering on it returned all 4,966 posts and the Q Links page listed the board's own URLs
 * while claiming they were external links Q shared.
 *
 * A post can carry several links, so this is flattened: 2,614 links across 1,715 posts.
 */
export async function getAllTextLinks(): Promise<QTextLink[]> {
  const { posts } = await loadLocalData()
  const rx = /https?:\/\/[^\s<>'")\]]+/g
  const out: QTextLink[] = []
  for (const p of posts) {
    for (const m of (p.text ?? '').match(rx) ?? []) {
      // Trailing sentence punctuation is not part of the URL.
      const url = m.replace(/[.,;:!?)\]]+$/, '')
      if (!url) continue
      let domain = url
      try { domain = new URL(url).hostname.replace(/^www\./, '') } catch { /* keep raw */ }
      out.push({ postNum: p.postNum, id: p.id, timestamp: p.timestamp, url, domain })
    }
  }
  return out
}

// ─── Topics ───────────────────────────────────────────────────────────────────
export async function getTopics(): Promise<QTopic[]> {
  const { topics } = await loadLocalData()
  return topics
}

export async function getTopic(id: string): Promise<QTopic | null> {
  const { topics } = await loadLocalData()
  return topics.find(t => t.id === id) ?? null
}

// Adds a post to a topic cluster, updating both the topic and the post
export async function addPostToTopic(topicId: string, postDocId: string, _postNum: number, topicName: string): Promise<void> {
  await mutateStore(['topics', 'posts'], store => {
    const topic = store.topics.find(t => t.id === topicId)
    if (topic && !topic.postIds.includes(postDocId)) topic.postIds.push(postDocId)
    const post = store.postsById.get(postDocId)
    if (post && !(post.topicTags ?? []).includes(topicName)) post.topicTags = [...(post.topicTags ?? []), topicName]
  })
}

// Removes a post from a topic cluster, updating both the topic and the post
export async function removePostFromTopic(topicId: string, postDocId: string, topicName: string): Promise<void> {
  await mutateStore(['topics', 'posts'], store => {
    const topic = store.topics.find(t => t.id === topicId)
    if (topic) topic.postIds = topic.postIds.filter(id => id !== postDocId)
    const post = store.postsById.get(postDocId)
    if (post) post.topicTags = (post.topicTags ?? []).filter(t => t !== topicName)
  })
}

// ─── Resources ───────────────────────────────────────────────────────────────
export async function getResources(): Promise<QResource[]> {
  const { resources } = await loadLocalData()
  return resources
}

// ─── Post Analysis Frequency ──────────────────────────────────────────────────
const ANALYSIS_CATS = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks', 'emphasis'] as const
type AnalysisCat = typeof ANALYSIS_CATS[number]

export interface AnalysisCategoryFreq {
  category: AnalysisCat
  text: string
  /** Number of posts the phrase appears in. */
  count: number
  postNums: number[]
  /** postNum → how many times the phrase occurs INSIDE that post (only when > 1). */
  repeats: Record<number, number>
  /** Sum of occurrences across all posts — always >= count. */
  occurrences: number
}

export function getAnalysisFrequency(): Promise<AnalysisCategoryFreq[]> {
  // Memoized per data version. Called from AnalysisArchive and four times on PostDetail;
  // each computation is ~700ms (index + backfill + repeat counts) for identical output.
  if (!_freqPromise) {
    _freqPromise = computeAnalysisFrequency().catch(err => {
      _freqPromise = null            // don't cache a failure
      throw err
    })
  }
  return _freqPromise
}

async function computeAnalysisFrequency(): Promise<AnalysisCategoryFreq[]> {
  const { posts } = await loadLocalData()

  const groups: Record<string, { category: AnalysisCat; count: number; postNums: number[]; seen: Set<number>; originalText: string }> = {}

  // Yield to the browser every so often. This walks ~56,000 analysis items and, run as one
  // unbroken task, it froze the page for the length of the whole computation — which is what
  // made opening a post from the archive feel slow: the post had already rendered, then the
  // main thread locked up behind this.
  let sinceYield = 0
  const breathe = async () => {
    if (++sinceYield < 400) return
    sinceYield = 0
    await new Promise(r => setTimeout(r, 0))
  }

  for (const post of posts) {
    await breathe()
    if (!post.analysisScanned) continue
    const analysis = post.postAnalysis as PostAnalysis | undefined
    if (!analysis) continue

    for (const cat of ANALYSIS_CATS) {
      const items = (analysis[cat] as string[] | undefined) ?? []
      for (const item of items) {
        // Grow fragments back to their full sentence, for the categories the extractor was
        // told to copy verbatim. Grouping on the expanded text is what merges the several
        // partial versions of one sentence into a single row.
        const trimmed = SENTENCE_CATS.has(cat)
          ? expandToSentence(item, post.text ?? '')
          : item.trim()
        // Skip "Q" alone and bare numbers (Q post numbers) in Named Entities
        if (cat === 'namedEntities') {
          if (/^Q$/i.test(trimmed)) continue
          if (/^\d+$/.test(trimmed)) continue
        }
        const key = `${cat}::${normalizeItemKey(trimmed)}`
        if (!groups[key]) groups[key] = { category: cat, count: 0, postNums: [], seen: new Set(), originalText: trimmed }
        groups[key].count++
        // Set membership, not postNums.includes(): a chip like "POTUS" collects thousands of
        // post numbers, and re-scanning that array for every one of its items made this
        // quadratic — the single biggest cost in opening a post.
        if (!groups[key].seen.has(post.postNum)) {
          groups[key].seen.add(post.postNum)
          groups[key].postNums.push(post.postNum)
        }
      }
    }
  }

  // Top up each item with the posts that contain the phrase but were never tagged.
  // Aliases are folded in so a chip counts the PERSON not the string: "HRC" picks up the
  // posts that only ever say "Hillary". Before this the chip read 113 while searching
  // "hrc" returned 140, because search already expanded aliases — one number, two answers.
  const textIndex = await getTextIndex()
  sinceYield = 0
  for (const g of Object.values(groups)) {
    await breathe()
    backfillFromText(textIndex, g.originalText, g.postNums, { withAliases: true })
  }

  // In-post repeat counts. A name said four times in one drop counts once by post but
  // four times by presence — surfacing that is the difference between "20,688 posts" and
  // "26,179 occurrences" on Named Entities.
  const repeatsByGroup = new Map<string, { repeats: Record<number, number>; occurrences: number }>()
  for (const [key, g] of Object.entries(groups)) {
    const spellings = [...new Set([g.originalText, ...getAliasGroup(g.originalText)])]
      .map(normalizeItemKey)
      .filter(Boolean)
    const repeats: Record<number, number> = {}
    let occurrences = 0
    for (const num of g.postNums) {
      const text = textIndex.padded.get(num)
      if (!text) { occurrences += 1; continue }
      let n = 0
      for (const sp of spellings) n += countPhraseOccurrences(text, sp)
      n = Math.max(1, n)          // it is in postNums, so it counts at least once
      occurrences += n
      if (n > 1) repeats[num] = n
    }
    repeatsByGroup.set(key, { repeats, occurrences })
  }

  return Object.values(groups)
    .map(g => ({
      category: g.category,
      text: g.originalText,
      // Post count, not extraction count — after the backfill these are the posts the
      // phrase actually appears in, which is what the ×N badge and the repeated/found-once
      // tallies should reflect.
      count: g.postNums.length,
      postNums: g.postNums.sort((a, b) => a - b),
      repeats: repeatsByGroup.get(`${g.category}::${normalizeItemKey(g.originalText)}`)?.repeats ?? {},
      occurrences: repeatsByGroup.get(`${g.category}::${normalizeItemKey(g.originalText)}`)?.occurrences ?? g.postNums.length,
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Overlap / Conflict Detection ────────────────────────────────────────────
// Finds phrases that appear in 2+ categories — either multiple analysis
// categories on the same post, or a phrase that's both a Request AND a Question.

export type OverlapCat = AnalysisCategoryFreq['category'] | 'request' | 'question'

export interface OverlapItem {
  text: string
  categories: OverlapCat[]
  postNum: number
}

const OVERLAP_CAT_LABELS: Record<OverlapCat, string> = {
  claims: 'Claim',
  emphasis: 'Emphasis',
  predictions: 'Prediction',
  namedEntities: 'Named Entity',
  themes: 'Theme',
  impliedConclusions: 'Implied Conclusion',
  verificationHooks: 'Verification Hook',
  request: 'Request',
  question: 'Question',
}
export { OVERLAP_CAT_LABELS }

export async function getOverlappingItems(): Promise<OverlapItem[]> {
  const overlaps: OverlapItem[] = []
  const { posts } = await loadLocalData()

  // ① Analysis category overlaps: same normalized text in 2+ categories on the same post
  for (const post of posts) {
    if (!post.analysisScanned) continue
    const analysis = post.postAnalysis as PostAnalysis | undefined
    if (!analysis) continue

    const textMap = new Map<string, { cats: Set<AnalysisCategoryFreq['category']>; original: string }>()
    for (const cat of ANALYSIS_CATS) {
      const items = (analysis[cat] as string[] | undefined) ?? []
      for (const item of items) {
        const key = normalizeItemKey(item)
        if (!textMap.has(key)) textMap.set(key, { cats: new Set(), original: item })
        textMap.get(key)!.cats.add(cat)
      }
    }
    for (const { cats, original } of textMap.values()) {
      if (cats.size >= 2) {
        overlaps.push({ text: original, categories: Array.from(cats), postNum: post.postNum })
      }
    }
  }

  // ② Request-Question overlaps: actionRequests containing '?' (multi-classified phrases)
  for (const post of posts) {
    if (!post.hasRequests) continue
    for (const text of (post.actionRequests ?? []).filter(r => r.includes('?'))) {
      overlaps.push({ text, categories: ['request', 'question'], postNum: post.postNum })
    }
  }

  // Sort: most categories first, then by post number
  return overlaps.sort((a, b) => b.categories.length - a.categories.length || a.postNum - b.postNum)
}

// ─── Funnel request questions into Q Questions collection ─────────────────────
// Scans all posts with actionRequests, extracts any that contain '?',
// deduplicates against existing questions for that post, and saves them.
export async function funnelRequestQuestionsToCollection(
  onProgress?: (msg: string) => void
): Promise<{ found: number; added: number }> {
  const store = await loadLocalData()
  const norm = (t: string) => t.toLowerCase().trim().replace(/[?.!,;:]+$/, '')

  // Index existing questions by post for dedup
  const existingByPost = new Map<string, Set<string>>()
  for (const q of store.questions) {
    if (!existingByPost.has(q.postId)) existingByPost.set(q.postId, new Set())
    existingByPost.get(q.postId)!.add(norm(q.text))
  }

  let found = 0
  let added = 0
  const newQuestions: QQuestion[] = []
  const touchedPosts = new Set<string>()

  for (const post of store.posts) {
    if (!post.hasRequests) continue
    const requests = (post.actionRequests ?? []).filter(r => r.includes('?'))
    if (requests.length === 0) continue
    found += requests.length

    const existing = existingByPost.get(post.id) ?? new Set()
    const toAdd = requests.filter(r => !existing.has(norm(r)))
    if (toAdd.length === 0) continue

    for (const text of toAdd) {
      newQuestions.push({
        id: genId(), postId: post.id, postNum: post.postNum, text: text.trim(),
        status: 'unprocessed', infographId: null, createdAt: Date.now(),
      })
    }
    touchedPosts.add(post.id)
    added += toAdd.length
    onProgress?.(`Post #${post.postNum} — ${added} question${added !== 1 ? 's' : ''} added so far`)
  }

  if (newQuestions.length > 0) {
    await mutateStore(['questions', 'posts'], s => {
      s.questions.push(...newQuestions)
      for (const id of touchedPosts) {
        const p = s.postsById.get(id)
        if (p) p.hasQuestions = true
      }
    })
  }

  return { found, added }
}

// Fetch posts by their postNum values (for MonthPostsPanel etc.)
// Chunks into groups of 30 to stay within Firestore's `in` query limit.
export async function getPostsByNums(nums: number[]): Promise<QPost[]> {
  if (nums.length === 0) return []
  const { postsByNum } = await loadLocalData()
  const out: QPost[] = []
  for (const n of nums) {
    const p = postsByNum.get(n)
    if (p) out.push(p)
  }
  out.sort((a, b) => a.postNum - b.postNum)
  return out
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function getStats(): Promise<{
  totalPosts: number
  totalQuestions: number
  greenCount: number
  yellowCount: number
  redCount: number
}> {
  const { posts, questions } = await loadLocalData()
  return {
    totalPosts: posts.length,
    totalQuestions: questions.length,
    greenCount: questions.filter(q => q.status === 'green').length,
    yellowCount: questions.filter(q => q.status === 'yellow').length,
    redCount: questions.filter(q => q.status === 'red').length,
  }
}

// ─── Analysis Confirmations ───────────────────────────────────────────────────
// Stores user-confirmed category assignments for analysis phrases.
// Key format: "{postNum}_{normalizedText}" for post-specific confirmations,
//             "global_{category}_{normalizedText}" for archive-wide confirmations.

function confirmDocId(postNum: number | null, text: string, category: string): string {
  const norm = normalizeItemKey(text).slice(0, 80).replace(/\s+/g, '_')
  return postNum !== null ? `${postNum}_${norm}` : `global_${category}_${norm}`
}

export async function loadAnalysisConfirmed(): Promise<Map<string, string>> {
  const { analysisConfirmed } = await loadLocalData()
  const map = new Map<string, string>()
  for (const d of analysisConfirmed) map.set(d.key, d.category)
  return map
}

export async function saveAnalysisConfirmed(
  postNum: number | null,
  text: string,
  category: string
): Promise<string> {
  const key = postNum !== null ? `${postNum}|${normalizeItemKey(text)}` : `global|${category}|${normalizeItemKey(text)}`
  const docId = confirmDocId(postNum, text, category)
  await mutateStore('analysisConfirmed', store => {
    const existing = store.analysisConfirmed.find(d => d.id === docId)
    if (existing) { existing.key = key; existing.category = category }
    else store.analysisConfirmed.push({ id: docId, key, category })
  })
  return key
}

export async function removeAnalysisConfirmed(
  postNum: number | null,
  text: string,
  category: string
): Promise<string> {
  const key = postNum !== null ? `${postNum}|${normalizeItemKey(text)}` : `global|${category}|${normalizeItemKey(text)}`
  const docId = confirmDocId(postNum, text, category)
  await mutateStore('analysisConfirmed', store => {
    store.analysisConfirmed = store.analysisConfirmed.filter(d => d.id !== docId)
  })
  return key
}

// Removes a text phrase from specified analysis categories across the given posts.
// Used when a phrase is confirmed as one category — clears it from all other categories.
export async function clearAnalysisCategoriesFromPosts(
  itemsToRemove: { category: AnalysisCat; text: string; postNums: number[] }[]
): Promise<void> {
  if (itemsToRemove.length === 0) return
  await mutateStore('posts', store => {
    for (const { category, text, postNums } of itemsToRemove) {
      const norm = text.toLowerCase().trim()
      for (const postNum of postNums) {
        const post = store.postsByNum.get(postNum)
        const arr = post?.postAnalysis?.[category] as string[] | undefined
        if (post?.postAnalysis && arr) {
          post.postAnalysis[category] = arr.filter(t => t.toLowerCase().trim() !== norm)
        }
      }
    }
  })
}

// ─── Alias-aware term matching ────────────────────────────────────────────────
// Searching "hrc" should surface a `[Hillary]` bracket and a request that only says
// "Hillary Clinton" — the alias group is what makes them the same subject. This is a
// SEARCH concern, separate from item identity: a question isn't a different question
// because a name inside it is spelled differently, so aliases are folded in when
// MATCHING even where they aren't folded into the item's own count.
export interface TermMatcher {
  /** Every spelling being searched for, normalized. First entry is the typed term. */
  spellings: string[]
  /** True when `text` contains the term or any alias of it. */
  matches: (text: string) => boolean
}

export function makeTermMatcher(term: string): TermMatcher {
  const typed = normalizeItemKey(term)
  const group = getAliasGroup(term).map(normalizeItemKey)
  const spellings = [...new Set([typed, ...group])].filter(Boolean)
  // Padded on both sides so a match must land on WORD boundaries. A raw substring test
  // makes "US" match "rUSsia", "mUSt", "becaUSe" and "HUSSEIN" — short terms become
  // useless, which is exactly what short terms like US, DC and NG are here.
  const needles = spellings.map(sp => ` ${sp} `)
  return {
    spellings,
    matches: (text: string) => {
      if (!needles.length) return true
      const t = ` ${normalizeItemKey(text)} `
      return needles.some(n => t.includes(n))
    },
  }
}

// ─── Where else does this term appear? ────────────────────────────────────────
// Powers the "also found in" bar above each section's chart, so a search in one section
// shows every other section carrying the same term instead of hiding them.
export interface TermPresence {
  key: string
  label: string
  /** Distinct posts in that section whose matching items mention the term. */
  posts: number
  /** How many item rows matched. */
  items: number
  /** Route that opens the section with the search pre-filled. */
  to: string
}

const PRESENCE_LABELS: Record<string, string> = {
  questions: 'Q Questions',
  requests: 'Q Requests',
  brackets: 'Q [ Brackets ]',
  claims: 'Q Claims',
  predictions: 'Q Predictions',
  namedEntities: 'Q Entities',
  themes: 'Q Themes',
  impliedConclusions: 'Q Conclusions',
  verificationHooks: 'Checkable Claims',
}

function presenceRoute(key: string, term: string): string {
  const q = encodeURIComponent(term)
  if (key === 'questions') return `/questions?q=${q}`
  if (key === 'requests') return `/requests?q=${q}`
  if (key === 'brackets') return `/brackets?q=${q}`
  return `/analysis?tab=${key}&q=${q}`
}

export async function getTermPresence(term: string): Promise<TermPresence[]> {
  const trimmed = term.trim()
  if (!trimmed) return []
  const matcher = makeTermMatcher(trimmed)
  const { posts, questions } = await loadLocalData()
  const index = await getTextIndex()

  const acc: Record<string, { posts: Set<number>; items: Set<string> }> = {}
  const bump = (key: string, postNum: number, itemText: string) => {
    const a = (acc[key] ??= { posts: new Set(), items: new Set() })
    a.posts.add(postNum)
    a.items.add(normalizeItemKey(itemText))
  }

  // Analysis categories come from the SAME backfilled table the section rows render, so the
  // chip count and the row badge can never disagree. They used to be computed separately —
  // extraction-only here vs text-backfilled there — which showed "Q Entities · 142" above a
  // row reading "×962 posts".
  const freq = await getAnalysisFrequency()
  for (const f of freq) {
    if (!matcher.matches(f.text)) continue
    for (const n of f.postNums) bump(f.category, n, f.text)
  }

  // Questions / requests / brackets aren't in that table, so backfill them the same way.
  const collect = (key: string, itemText: string, postNum: number) => {
    bump(key, postNum, itemText)
    for (const n of postsContainingPhrase(index, itemText)) bump(key, n, itemText)
  }
  for (const p of posts) {
    for (const req of p.actionRequests ?? []) if (matcher.matches(req)) collect('requests', req, p.postNum)
    for (const code of (p.text ?? '').match(/\[\[?[A-Za-z0-9][A-Za-z0-9 _\-]{0,30}\]?\]/g) ?? []) {
      if (matcher.matches(code)) bump('brackets', p.postNum, code)
    }
  }
  for (const q of questions) if (matcher.matches(q.text)) collect('questions', q.text, q.postNum)

  return Object.entries(acc)
    .map(([key, v]) => ({
      key,
      label: PRESENCE_LABELS[key] ?? key,
      posts: v.posts.size,
      items: v.items.size,
      to: presenceRoute(key, trimmed),
    }))
    .sort((a, b) => b.posts - a.posts)
}

// ─── Matching items within one section, for a term ────────────────────────────
// Backs the inline section panel on the Post Archive: clicking "Q Requests · 2" there
// shows those two requests in place rather than navigating away, so the post list you
// were reading stays put.
export interface TermSectionMatch {
  text: string
  postNums: number[]
  /** Total mentions across those posts (>= postNums.length). */
  occurrences: number
  /** postNum → times the phrase occurs INSIDE that post (only when > 1). */
  repeats: Record<number, number>
}

export async function getTermMatchesInSection(term: string, section: string): Promise<TermSectionMatch[]> {
  const trimmed = term.trim()
  if (!trimmed || !section) return []
  const matcher = makeTermMatcher(trimmed)
  const { posts, questions } = await loadLocalData()

  const groups = new Map<string, { text: string; postNums: Set<number> }>()
  const bump = (itemText: string, postNum: number) => {
    const key = normalizeItemKey(itemText)
    if (!key) return
    let g = groups.get(key)
    if (!g) { g = { text: itemText.trim(), postNums: new Set() }; groups.set(key, g) }
    g.postNums.add(postNum)
  }

  if (section === 'questions') {
    for (const q of questions) if (matcher.matches(q.text)) bump(q.text, q.postNum)
  } else if (section === 'requests') {
    for (const p of posts) for (const r of p.actionRequests ?? []) if (matcher.matches(r)) bump(r, p.postNum)
  } else if (section === 'brackets') {
    for (const p of posts) {
      for (const code of (p.text ?? '').match(/\[\[?[A-Za-z0-9][A-Za-z0-9 _\-]{0,30}\]?\]/g) ?? []) {
        if (matcher.matches(code)) bump(code, p.postNum)
      }
    }
  } else {
    const cat = section as AnalysisCat
    if (!(ANALYSIS_CATS as readonly string[]).includes(cat)) return []
    for (const p of posts) {
      const analysis = p.postAnalysis as PostAnalysis | undefined
      if (!analysis) continue
      for (const item of ((analysis[cat] as string[] | undefined) ?? [])) {
        if (matcher.matches(item)) bump(item, p.postNum)
      }
    }
  }

  // Mention counts, so a dense post is visible here the same way it is elsewhere.
  const padded = new Map<number, string>()
  for (const p of posts) padded.set(p.postNum, ` ${normalizeItemKey(p.text ?? '')} `)

  return [...groups.values()]
    .map(g => {
      const nums = [...g.postNums].sort((a, b) => a - b)
      const key = normalizeItemKey(g.text)
      let occurrences = 0
      const repeats: Record<number, number> = {}
      for (const n of nums) {
        const c = Math.max(1, countPhraseOccurrences(padded.get(n) ?? '', key))
        occurrences += c
        if (c > 1) repeats[n] = c
      }
      return { text: g.text, postNums: nums, occurrences, repeats }
    })
    .sort((a, b) => b.occurrences - a.occurrences || b.postNums.length - a.postNums.length)
}
