import Anthropic from '@anthropic-ai/sdk'
import type { AnswerStatus, PostAnalysis, CorrelatedArticle } from '../types'

// The API key is resolved at RUNTIME so it is never embedded in the shipped build:
//   • Desktop (Tauri): ask the Rust backend (`get_anthropic_key`), which reads the
//     ANTHROPIC_API_KEY env var or `<app_config_dir>/anthropic_key.txt` on the local
//     machine. A shared copy with neither has no key → AI stays disabled (can't spend).
//   • Dev (browser): fall back to the dev .env key for convenience.
let _client: Anthropic | null = null
async function getClient(): Promise<Anthropic> {
  if (_client) return _client
  let key = ''
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  if (w.__TAURI_INTERNALS__ || w.__TAURI__) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      key = await invoke<string>('get_anthropic_key')
    } catch { /* fall through to dev key */ }
  }
  if (!key) key = import.meta.env.VITE_ANTHROPIC_API_KEY ?? ''
  if (!key) {
    throw new Error('AI features are not configured on this device. Set the ANTHROPIC_API_KEY environment variable, or add anthropic_key.txt to the app config folder.')
  }
  _client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })
  return _client
}

// ─── Question Detection ───────────────────────────────────────────────────────
export interface DetectedQuestion {
  text: string
}

// Strip 8chan/4chan post references (>>12345) before sending text to Claude
// so that digits inside reference numbers are never misread as questions
function stripPostRefs(text: string): string {
  return text.replace(/>>\d+/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

// Strip markdown code fences that Claude sometimes wraps around JSON
function extractJSON(raw: string): string {
  return raw.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/i, '').trim()
}

export async function detectQuestionsInPosts(
  posts: { id: string; text: string }[]
): Promise<Record<string, DetectedQuestion[]>> {
  const result: Record<string, DetectedQuestion[]> = {}

  // Process each post individually for clarity
  for (const post of posts) {
    const response = await (await getClient()).messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Extract EVERY question from the text below. Be completely exhaustive — do NOT skip any.

A question is:
1. ANY phrase or sentence ending with "?" — always include it, no exceptions whatsoever
2. ANY sentence beginning with: Who, What, When, Where, Why, How, Which, Can, Could, Should, Would, Is, Are, Was, Were, Do, Does, Did — even if it lacks a "?"

Rules:
- Copy each question EXACTLY as it appears (preserve original wording and punctuation)
- Do NOT combine multiple questions into one
- Do NOT paraphrase or summarize
- Do NOT filter by importance or relevance — include ALL of them
- Short questions like "Why?" or "Who?" count

Return ONLY a valid JSON array of strings, nothing else. If there are zero questions return [].

Text:
${stripPostRefs(post.text)}`,
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    try {
      const questions = JSON.parse(extractJSON(raw)) as string[]
      result[post.id] = Array.isArray(questions)
        ? questions.map(q => ({ text: q }))
        : []
    } catch {
      result[post.id] = []
    }
  }

  return result
}

// ─── Chunked Detection + Verification (bulk scan) ────────────────────────────

// Split post text into chunks of N lines so no question gets buried in a long block
function splitIntoLineChunks(text: string, linesPerChunk = 6): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1)
  if (lines.length <= linesPerChunk) return [text.trim()]
  const chunks: string[] = []
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push(lines.slice(i, i + linesPerChunk).join('\n'))
  }
  return chunks
}

// Extract questions from a single small chunk
async function extractFromChunk(chunk: string): Promise<string[]> {
  const response = await (await getClient()).messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract EVERY question from this text. Be exhaustive — do NOT skip any.

A question is:
1. ANY phrase ending with "?" — no exceptions
2. ANY sentence starting with: Who, What, When, Where, Why, How, Which, Can, Could, Should, Would, Is, Are, Was, Were, Do, Does, Did

Copy each question EXACTLY as it appears. Return ONLY a JSON array of strings. If none, return [].

Text:
${chunk}`,
    }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    const parsed = JSON.parse(extractJSON(raw))
    return Array.isArray(parsed) ? parsed.filter((q: unknown) => typeof q === 'string') : []
  } catch { return [] }
}

// Verification pass — show Claude the full post + what was already found, ask what was missed
async function verificationPass(postText: string, alreadyFound: string[]): Promise<string[]> {
  const foundList = alreadyFound.length > 0
    ? alreadyFound.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : '(none found yet)'

  const response = await (await getClient()).messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `These questions have already been extracted from the post below:
${foundList}

Now read the ORIGINAL POST very carefully and find any questions that were MISSED from the list above.

A question is: anything ending with "?" OR any sentence starting with Who, What, When, Where, Why, How, Which, Can, Could, Should, Would, Is, Are, Was, Were, Do, Does, Did.

Return ONLY a JSON array of the MISSED questions. Do NOT repeat questions already listed. If nothing was missed, return [].

Original post:
${postText}`,
    }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    const parsed = JSON.parse(extractJSON(raw))
    return Array.isArray(parsed) ? parsed.filter((q: unknown) => typeof q === 'string') : []
  } catch { return [] }
}

// Pass 0: regex scan — guarantees every "?"-terminated sentence is ALWAYS captured,
// regardless of what Claude misses. Splits on sentence boundaries after [.!?] + space.
function regexScanQuestions(text: string): string[] {
  const results: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.includes('?')) continue
    // Split line into sentences/clauses at boundaries after sentence-ending punctuation
    const sentences = trimmed.split(/(?<=[.!?])\s+/)
    for (const sent of sentences) {
      const s = sent.trim()
      if (s.endsWith('?') && s.length > 3) results.push(s)
    }
  }
  return results
}

// Full pipeline: regex scan → chunk-by-chunk extraction → verification pass → deduplicate
export async function detectQuestionsWithVerification(
  postText: string
): Promise<DetectedQuestion[]> {
  const cleaned = stripPostRefs(postText)
  const chunks = splitIntoLineChunks(cleaned, 6)

  // Pass 0: regex — guaranteed catch for all ?-terminated sentences
  const allFound: string[] = regexScanQuestions(cleaned)

  // Pass 1: Claude chunk extraction (catches implicit questions without ?)
  for (const chunk of chunks) {
    const questions = await extractFromChunk(chunk)
    allFound.push(...questions)
  }

  // Pass 2: verification — catch anything missed
  const missed = await verificationPass(cleaned, allFound)
  allFound.push(...missed)

  // Deduplicate by normalized text
  const seen = new Set<string>()
  const deduped: DetectedQuestion[] = []
  for (const text of allFound) {
    const key = text.toLowerCase().trim().replace(/\s+/g, ' ')
    if (!seen.has(key) && key.length > 2) {
      seen.add(key)
      deduped.push({ text: text.trim() })
    }
  }
  return deduped
}

// ─── Answer Status Classification ────────────────────────────────────────────
export async function classifyQuestions(
  questions: { id: string; text: string }[],
  contextSummary: string
): Promise<Record<string, AnswerStatus>> {
  const qs = questions.map(q => `Q_ID:${q.id} | ${q.text}`).join('\n')

  const response = await (await getClient()).messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are classifying whether questions from a post archive have been answered.

Context about the archive: ${contextSummary}

For each question below, assign a status:
- "green" = clearly answered or well understood from publicly available information
- "yellow" = partially answered or weak understanding available
- "red" = unanswered, unknown, or very little information available

Return ONLY valid JSON, no other text:
{"Q_ID_1": "green", "Q_ID_2": "yellow", ...}

Questions:
${qs}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text) as Record<string, AnswerStatus>
  } catch {
    return {}
  }
}

// ─── Archive-Based Question Classification ────────────────────────────────────
export interface ClassifyResult {
  status: AnswerStatus
  samePost: boolean   // true if question is answered within the post that asked it
}

export async function classifyQuestionsInArchive(
  questions: { id: string; text: string; sourcePostNum: number; sourcePostText: string; relevantPosts: { postNum: number; text: string }[] }[]
): Promise<Record<string, ClassifyResult>> {
  const blocks = questions.map(q => {
    const otherPosts = q.relevantPosts
      .filter(p => p.postNum !== q.sourcePostNum)
      .slice(0, 7)
      .map(p => `[Post #${p.postNum}]: ${p.text.slice(0, 350)}`)
      .join('\n---\n')
    return [
      `Q_ID:${q.id}`,
      `Question: ${q.text}`,
      `[SOURCE POST #${q.sourcePostNum} — post that asked this question]: ${q.sourcePostText.slice(0, 400)}`,
      otherPosts ? `Other relevant posts:\n${otherPosts}` : '(no other relevant posts found)',
    ].join('\n')
  }).join('\n\n===\n\n')

  const response = await (await getClient()).messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are analyzing Q drops (the Q post archive) to determine whether each question asked in a post was ever answered within the archive.

For each question you are given:
- The SOURCE POST that contains the question
- Other relevant posts from the archive that may contain an answer

Assign a status based ONLY on the provided post text:
- "green"  = question is clearly and directly answered in one or more posts
- "yellow" = question is partially addressed, hinted at, or incompletely answered
- "red"    = no post answers or addresses this question

Also set "samePost" to true if the SOURCE POST itself contains the answer (Q answered his own question in the same drop).

Return ONLY valid JSON — no other text:
{"Q_ID_1": {"status": "green", "samePost": false}, "Q_ID_2": {"status": "red", "samePost": false}, ...}

Questions and archive evidence:
${blocks}`,
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(raw) as Record<string, ClassifyResult>
  } catch {
    return {}
  }
}

// ─── 8kun Thread Answer Detection ────────────────────────────────────────────
import type { ThreadAnswer } from '../types'

export async function findAnswersInThread(
  questions: string[],
  replies: { no: number; text: string }[]
): Promise<ThreadAnswer[]> {
  if (questions.length === 0 || replies.length === 0) return []

  const qList = questions.map((q, i) => `Q${i + 1}: ${q}`).join('\n')
  const replyBlock = replies.slice(0, 40)
    .map(r => `[Reply #${r.no}]: ${r.text.slice(0, 300)}`)
    .join('\n---\n')

  const response = await (await getClient()).messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are analyzing replies in a Q post thread on 8kun to determine if any anonymous user provided a meaningful answer to questions Q asked in that post.

Questions Q asked in this post:
${qList}

Anonymous replies in the thread:
${replyBlock}

For each question that was meaningfully answered by ANY reply, return a JSON array entry.
Only include questions that have a real, substantive answer — not just acknowledgment or further questions.

Return ONLY a valid JSON array — no other text:
[
  {
    "question": "exact question text",
    "replyNo": 12345678,
    "excerpt": "the relevant part of the reply that answers the question (max 150 chars)",
    "confidence": "high" | "medium" | "low"
  }
]

If no questions were answered, return an empty array: []`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed as ThreadAnswer[] : []
  } catch {
    return []
  }
}

// ─── Topic Clustering ─────────────────────────────────────────────────────────
export interface TopicResult {
  name: string
  description: string
  postIds: string[]
}

export async function clusterTopics(
  posts: { id: string; text: string }[]
): Promise<TopicResult[]> {
  const postsText = posts
    .map(p => `ID:${p.id} | ${p.text.slice(0, 300)}`)
    .join('\n')

  const response = await (await getClient()).messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `Analyze these posts and group them into 10-20 thematic topics/chapters.

Return ONLY valid JSON array, no other text:
[
  {
    "name": "Chapter Title",
    "description": "1-2 sentence description of this topic",
    "postIds": ["id1", "id2"]
  }
]

Posts:
${postsText}`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    const parsed = JSON.parse(extractJSON(raw))
    return Array.isArray(parsed) ? parsed as TopicResult[] : []
  } catch {
    return []
  }
}

// ─── Action Request Detection ─────────────────────────────────────────────────
// Finds sentences where Q is directing the reader to take an action.
export async function detectActionRequests(postText: string): Promise<string[]> {
  const cleaned = stripPostRefs(postText)
  const response = await (await getClient()).messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Read this post and extract every sentence or phrase where the author is directly telling or asking the reader to take an action.

Examples: "Dig.", "Spread the word.", "Follow the money.", "Pray.", "Research this yourself.", "Share this.", "Trust the plan.", "Patriots fight!", "You are the news now.", "Make it rain.", "Demand answers.", "Watch the news.", "Do you believe in coincidences?", "Think logically.", "Ask yourself why."

Rules:
- Copy each request EXACTLY as it appears in the text (preserve original wording)
- Only include genuine calls to action or directives aimed at the reader
- Short commands count (e.g. "Dig.", "Pray.", "Think.")
- Do NOT include questions that are purely rhetorical with no action implied
- Do NOT include statements of fact or predictions
- Return ONLY a valid JSON array of strings. If none, return [].

Post text:
${cleaned}`,
    }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    const parsed = JSON.parse(extractJSON(raw))
    return Array.isArray(parsed) ? parsed.filter((r: unknown) => typeof r === 'string') : []
  } catch { return [] }
}

// ─── Post Analysis ────────────────────────────────────────────────────────────
// Single Claude call extracting 7 analysis categories from a post.
// Text-based categories use EXACT phrases so they can be highlighted in the post body.
export async function analyzePost(postText: string): Promise<PostAnalysis> {
  const cleaned = stripPostRefs(postText)
  const response = await (await getClient()).messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Analyze this post and extract structured data. Return ONLY a valid JSON object with these exact keys:

{
  "claims": ["copy EXACT text of each factual assertion presented as true"],
  "predictions": ["copy EXACT text of each prediction or forecast about future events"],
  "namedEntities": ["each person, place, organization, or event name mentioned (short names only, e.g. 'Trump', 'FBI', 'Saudi Arabia')"],
  "themes": ["2-4 word topic tags summarizing major themes, e.g. 'deep state', 'military intelligence', 'election fraud'"],
  "impliedConclusions": ["paraphrase each conclusion implied but never explicitly stated"],
  "emotionalTone": "single short phrase describing the overall tone, e.g. 'urgent/conspiratorial' or 'calm/informational'",
  "verificationHooks": ["copy EXACT text of claims that could be independently verified — names, dates, events, documents"]
}

Rules:
- For claims, predictions, verificationHooks: copy exact text from the post so it can be highlighted
- For namedEntities: short identifiers only, not full sentences
- For themes: concise topic tags, not sentences
- For impliedConclusions: paraphrase the implication clearly
- Return [] for any array category with no matches
- Return "" for emotionalTone if no clear tone is present

Post text:
${cleaned}`,
    }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const parsed = JSON.parse(extractJSON(raw))
    const arr = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    return {
      claims: arr(parsed.claims),
      predictions: arr(parsed.predictions),
      namedEntities: arr(parsed.namedEntities),
      themes: arr(parsed.themes),
      impliedConclusions: arr(parsed.impliedConclusions),
      emotionalTone: typeof parsed.emotionalTone === 'string' ? parsed.emotionalTone : '',
      verificationHooks: arr(parsed.verificationHooks),
    }
  } catch { return {} }
}

// ─── News Correlator ("future proves past") ───────────────────────────────────
// Uses Claude's server-side web_search + web_fetch tools to find real news
// articles whose publication dates line up with a Q post (before = context,
// after = potential fulfillment). Returns cited articles; runs on demand.
//
// Model: Opus 4.8 for best research/judgment. To roughly halve cost, change
// NEWS_MODEL to 'claude-sonnet-4-6'.
const NEWS_MODEL = 'claude-opus-4-8'
const WEB_TOOLS = [
  { type: 'web_search_20260209', name: 'web_search' },
  { type: 'web_fetch_20260209', name: 'web_fetch' },
] as unknown as Anthropic.Tool[]

export type FoundArticle = Omit<CorrelatedArticle, 'id' | 'addedAt' | 'userRating' | 'credibility' | 'notes'>

export async function correlateNews(post: {
  text: string
  timestamp: number
  postAnalysis?: PostAnalysis
}): Promise<FoundArticle[]> {
  const ms = post.timestamp > 1e10 ? post.timestamp : post.timestamp * 1000
  const dateStr = new Date(ms).toISOString().slice(0, 10)
  const entities = (post.postAnalysis?.namedEntities ?? []).slice(0, 12).join(', ')
  const predictions = (post.postAnalysis?.predictions ?? []).slice(0, 8).join(' | ')
  const claims = (post.postAnalysis?.claims ?? []).slice(0, 8).join(' | ')

  const prompt = `You are a research assistant verifying a "Q" post (anonymous intelligence drop) against real-world news — the "future proves past" idea.

This Q post was published on ${dateStr}. Use web_search (and web_fetch when useful) to find REAL news articles whose publication dates line up with this post — both BEFORE it (context/setup) and AFTER it (events that may corroborate or fulfill its claims/predictions).

Search around these extracted signals:
- Named entities: ${entities || '(none extracted)'}
- Predictions: ${predictions || '(none)'}
- Claims: ${claims || '(none)'}

Q POST TEXT:
${stripPostRefs(post.text).slice(0, 1500)}

Return ONLY a JSON array (no prose, no markdown fences) of up to 8 of the most relevant REAL articles you actually found in search results. Each item:
{
  "title": string,
  "url": string,            // the real article URL from the search result
  "source": string,        // publication name
  "publishedDate": string, // the article's date as reported (YYYY-MM-DD if known)
  "timing": "before" | "after" | "same",   // relative to ${dateStr}
  "relevance": number,     // 0-100: how strongly it relates to / corroborates the post
  "summary": string        // 1-2 sentences on how it relates to the post
}
Only include articles you genuinely found with real URLs. If you find none, return [].`

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let response = await (await getClient()).messages.create({
    model: NEWS_MODEL,
    max_tokens: 4096,
    tools: WEB_TOOLS,
    messages,
  })

  // Server-side tools loop: if Claude pauses after hitting the tool-iteration cap, resume.
  let guard = 0
  while (response.stop_reason === 'pause_turn' && guard++ < 6) {
    messages = [{ role: 'user', content: prompt }, { role: 'assistant', content: response.content }]
    response = await (await getClient()).messages.create({ model: NEWS_MODEL, max_tokens: 4096, tools: WEB_TOOLS, messages })
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')

  let parsed: unknown
  try { parsed = JSON.parse(extractJSON(text)) } catch { parsed = [] }
  const arr = Array.isArray(parsed) ? parsed : []

  return arr.map((a: Record<string, unknown>): FoundArticle => ({
    title: String(a.title ?? ''),
    url: String(a.url ?? ''),
    source: String(a.source ?? ''),
    publishedDate: String(a.publishedDate ?? ''),
    timing: (a.timing === 'before' || a.timing === 'after' || a.timing === 'same') ? a.timing : 'same',
    relevance: Math.max(0, Math.min(100, Number(a.relevance) || 0)),
    summary: String(a.summary ?? ''),
  })).filter(a => a.url && a.title)
}
