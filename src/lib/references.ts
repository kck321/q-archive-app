// Resolving ">>NNNNNNN" post references.
//
// Q replies constantly, and a reply's stored text is often nothing but the pointer — drop
// #2124's entire body is ">>2950820". The `references` field that should hold the quoted
// content was destroyed at ingest (every entry is the literal string "[object Object]", in
// Firestore too), so it cannot be recovered by re-exporting.
//
// But a quarter of those pointers aim at ANOTHER Q DROP, which we already have. Each drop's
// source link ends in its board post id (…/res/2950335.html#2950846), so the pointer can be
// matched against that and resolved with no network access at all.
//
// Measured: 407 of 1,586 references (26%) resolve internally, and 34 of the 211
// pointer-only posts stop being blank rows. The remaining 1,179 point at anon posts and
// need scraping — a separate job.
import type { QPost } from '../types'
import { loadLocalData, onStoreMutated } from './localData'

export interface ResolvedReference {
  /** The ">>NNNNNNN" board post id as written in the text. */
  boardId: string
  /** The Q drop it refers to, when we have it. */
  post: QPost | null
}

/** board post id → drop, built from the anchor on each post's source link. */
export function buildReferenceIndex(posts: QPost[]): Map<string, QPost> {
  const index = new Map<string, QPost>()
  for (const p of posts) {
    const m = (p.link ?? '').match(/#(\d+)\s*$/)
    if (m) index.set(m[1], p)
  }
  return index
}

/**
 * Everything needed to render a quoted post with the same markup as a real drop.
 *
 * 48% of quoted posts ARE drops we already hold and have already analysed, so a quote can be
 * highlighted from that drop's own stored questions, requests and analysis rather than
 * re-deriving anything. Built once and shared: a search results page renders 150 cards, and
 * each one reading the store separately would be 150 round trips.
 */
export interface QuotedContext {
  byBoardId: Map<string, QPost>
  questionsByPostId: Map<string, string[]>
}

let _quotedCtx: Promise<QuotedContext> | null = null

export function getQuotedContext(): Promise<QuotedContext> {
  if (!_quotedCtx) {
    _quotedCtx = loadLocalData().then(({ posts, questions }) => {
      const questionsByPostId = new Map<string, string[]>()
      for (const q of questions as { postId?: string; text?: string }[]) {
        if (!q?.postId || !q.text) continue
        const list = questionsByPostId.get(q.postId)
        if (list) list.push(q.text)
        else questionsByPostId.set(q.postId, [q.text])
      }
      return { byBoardId: buildReferenceIndex(posts), questionsByPostId }
    })
  }
  return _quotedCtx
}

onStoreMutated(() => { _quotedCtx = null })

/**
 * Reading text for a drop, for previews and snippets.
 *
 * 211 drops are nothing but a ">>NNNNNNN" pointer, so a plain `post.text` preview renders as
 * a bare number. Those fall back to what the drop is replying to.
 */
export function postPreview(post: Pick<QPost, 'text' | 'quotedPosts'>): string {
  const text = (post.text ?? '').trim()
  if (text && !/^(>>\d+\s*)+$/.test(text)) return text
  const quoted = (post.quotedPosts ?? []).find(q => (q.depth ?? 0) === 0 && q.text?.trim())
  return quoted ? `↳ ${quoted.text.trim()}` : text
}

/** Every ">>id" in a post's text, in order, with its target when known. */
export function resolveReferences(text: string, index: Map<string, QPost>): ResolvedReference[] {
  const ids = [...new Set((text ?? '').match(/>>(\d+)/g) ?? [])].map(r => r.slice(2))
  return ids.map(boardId => ({ boardId, post: index.get(boardId) ?? null }))
}
