// ─── Post Analysis ────────────────────────────────────────────────────────────
export interface PostAnalysis {
  claims?: string[]
  predictions?: string[]
  namedEntities?: string[]
  themes?: string[]
  impliedConclusions?: string[]
  emotionalTone?: string        // single descriptor string
  verificationHooks?: string[]
}

// ─── Post ────────────────────────────────────────────────────────────────────
export interface ThreadAnswer {
  question: string
  replyNo: number        // 8kun post number of the reply
  excerpt: string        // relevant portion of the reply
  confidence: 'high' | 'medium' | 'low'
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
  references: string[]
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
