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

/** Every ">>id" in a post's text, in order, with its target when known. */
export function resolveReferences(text: string, index: Map<string, QPost>): ResolvedReference[] {
  const ids = [...new Set((text ?? '').match(/>>(\d+)/g) ?? [])].map(r => r.slice(2))
  return ids.map(boardId => ({ boardId, post: index.get(boardId) ?? null }))
}
