// ─── Post Analysis ────────────────────────────────────────────────────────────
export interface PostAnalysis {
  claims?: string[]
  predictions?: string[]
  namedEntities?: string[]
  themes?: string[]
  impliedConclusions?: string[]
  emotionalTone?: string        // single descriptor string
  verificationHooks?: string[]
  /**
   * Q's staccato one-to-three-word beats: "Old." / "Connection." / "News." / "BOOM."
   * 59% of everything left unhighlighted was this shape. They are not claims (no
   * assertion), predictions, entities or questions, so filing them under any existing
   * category would corrupt that category's counts. Detected structurally, no API calls.
   */
  emphasis?: string[]
  /** Reviewed Q-authored text in no semantic category — rendered with a neutral treatment. */
  contextUnits?: string[]
  /** Literal rendering spans, parallel to their certified arrays. Never a separate population. */
  claimSpans?: string[]
  predictionSpans?: string[]
  conclusionSpans?: string[]
  checkableSpans?: string[]
  /** The certified words that fired each theme — what the post view highlights. */
  themeAnchors?: string[]
}

// ─── Post ────────────────────────────────────────────────────────────────────
export interface ThreadAnswer {
  question: string
  replyNo: number        // 8kun post number of the reply
  excerpt: string        // relevant portion of the reply
  confidence: 'high' | 'medium' | 'low'
}

/**
 * A post quoted by a drop via ">>NNNNNNN". Usually an anon (74%), sometimes another Q drop.
 * These are NOT Q's words — they are excluded from question/claim/prediction extraction and
 * surface only as reading context and in search.
 */
export interface QuotedPost {
  boardId: string        // the ">>NNNNNNN" id
  link: string           // permalink on the original board / 4plebs archive
  name: string           // "Anonymous", "Q", …
  trip: string
  userId: string
  time: string
  text: string
  media: QMedia[]
  /** 0 = quoted by the drop itself; 1 = quoted by that quote, and so on up the chain. */
  depth: number
}

export interface QPost {
  id: string            // Firestore doc ID (stringified post id)
  postNum: number       // sequential Q post number
  name: string
  trip: string | null
  text: string
  timestamp: number     // Unix epoch
  threadId: string
  source: string
  userId: string
  subject: string | null
  link: string
  media: QMedia[]
  refMedia?: QMedia[]       // images fetched from 4plebs for >>referenced posts
  references: string[]      // legacy — destroyed at ingest, every entry is "[object Object]"
  /** The posts quoted by this drop's ">>NNNNNNN" pointers, recovered by scrape-references. */
  quotedPosts?: QuotedPost[]
  hasQuestions: boolean
  hasRequests?: boolean
  actionRequests?: string[]
  customBrackets?: string[]
  excludedBrackets?: string[]
  postAnalysis?: PostAnalysis
  analysisScanned?: boolean
  threadReplyCount?: number        // total anon replies in the thread
  threadAnswers?: ThreadAnswer[]   // questions answered by anons in thread
  qThreadReplies?: { no: number; text: string; trip: string }[]  // Q's own follow-up posts in the thread
  threadScanned?: boolean
  topicTags: string[]
  stars: number
  ingested: boolean
  correlatedNews?: CorrelatedArticle[]   // AI-found date-correlated articles
  newsScanned?: boolean
}

export interface QMedia {
  filename: string
  url: string
}

// ─── News Correlation ("future proves past") ──────────────────────────────────
// An article the AI found whose date lines up with a Q post, plus a local
// (single-user, offline) honesty layer the user fills in.
export interface CorrelatedArticle {
  id: string
  title: string
  url: string
  source: string
  publishedDate: string            // as reported by the source (ISO or human)
  timing: 'before' | 'after' | 'same'   // relative to the Q post's date
  relevance: number                // 0-100, AI's relevance score
  summary: string                  // how the article relates to the post
  // Local honesty layer (your own, stored offline):
  userRating?: 'up' | 'down' | null
  credibility?: 'credible' | 'questionable' | 'fake' | 'unverified'
  notes?: string
  addedAt: number
}

// ─── Question ────────────────────────────────────────────────────────────────
export type AnswerStatus = 'green' | 'yellow' | 'red' | 'unprocessed'

export interface QQuestion {
  id: string            // Firestore doc ID
  postId: string
  postNum: number
  text: string
  status: AnswerStatus
  answeredInSamePost?: boolean   // true if Q answered his own question in the same drop
  infographId: string | null
  createdAt: number
  /** Set by scripts/apply-questions.mjs from the certified audit. */
  certified?: boolean
  semanticFunction?: 'question' | 'information_request'
  grammaticalForm?: 'interrogative' | 'imperative' | 'declarative'
  /**
   * A paraphrase an earlier extractor wrote — e.g. "Who is Seth Rich?" where Q wrote
   * "Seth Rich?". Kept so search still finds it, never shown or counted as Q's words.
   */
  editorialNormalization?: boolean
  neverDisplayAsQ?: boolean
  qAuthoredSource?: string | null
  /**
   * How many times THIS post asks it, from the same segmentation the audit used. Usually 1;
   * "Coincidence?" is asked twice in #1176 and #1266. The frequency list sums this rather
   * than re-scanning post text, which is what inflated it to 142.
   */
  occurrences?: number
  /**
   * The full Q-authored unit the span came from. For a directive-wrapped question the unit is
   * "Ask yourself, why are they panicking?" while `text` is the counted span
   * "why are they panicking?".
   */
  unitText?: string
  /** A question Q asked inside a directive. Counts as a question, stays a directive. */
  directiveWrapped?: boolean
  directiveFamily?: string
  directiveSource?: string
  /** Recovered from inside a malformed unit — the enclosing segment never counts, this does. */
  recoveredFromSegmentationError?: boolean
}

// ─── Infograph ───────────────────────────────────────────────────────────────
export interface InfographNode {
  id: string
  label: string
  description: string
  evidenceType: string
  nodeType: 'start' | 'step' | 'end' | 'evidence'
}

export interface InfographEdge {
  source: string
  target: string
  label?: string
}

export interface Infograph {
  id: string
  questionId: string
  question: string
  nodes: InfographNode[]
  edges: InfographEdge[]
  createdAt: number
}

// ─── Topic ───────────────────────────────────────────────────────────────────
export interface QTopic {
  id: string
  name: string
  description: string
  postIds: string[]
  createdAt: number
}

// ─── Resource ────────────────────────────────────────────────────────────────
export interface QResource {
  id: string
  category: 'doj' | 'wikileaks' | 'videos' | 'podcasts' | 'quid' | 'other'
  title: string
  description: string
  url: string
  addedAt: number
}
