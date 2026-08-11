import { db } from '../firebase'
import {
  collection, doc, getDoc, getDocs, query, limit, writeBatch
} from 'firebase/firestore'
import type { QPost } from '../types'

const POSTS_URL = '/qalerts-proxy/data/json/posts.json'
const BATCH_SIZE = 400  // Firestore max batch = 500

// Raw shape coming from qalerts.app JSON
interface RawRefPost {
  id?: string | number
  media?: { filename: string; url: string }[]
}

interface RawPost {
  id: number | string
  name?: string
  trip?: string | null
  text?: string
  timestamp?: number
  threadId?: string
  source?: string
  userId?: string
  subject?: string | null
  link?: string
  media?: { filename: string; url: string }[]
  references?: (string | RawRefPost)[]
  number?: number
}

// Firestore doesn't allow nested arrays or undefined values — sanitize everything
function sanitizeString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  return String(v)
}

function sanitizeMedia(media: unknown): { filename: string; url: string }[] {
  if (!Array.isArray(media)) return []
  return media.map(m => ({
    filename: sanitizeString(m?.filename),
    url: sanitizeString(m?.url),
  }))
}

function sanitizeRefs(refs: unknown): string[] {
  if (!Array.isArray(refs)) return []
  return refs.map(r => {
    if (Array.isArray(r)) return JSON.stringify(r)
    if (r && typeof r === 'object') return sanitizeString((r as RawRefPost).id)
    return sanitizeString(r)
  })
}

function extractRefMedia(refs: unknown): { filename: string; url: string }[] {
  if (!Array.isArray(refs)) return []
  const out: { filename: string; url: string }[] = []
  for (const r of refs) {
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      const media = (r as RawRefPost).media
      if (Array.isArray(media)) {
        for (const m of media) {
          if (m?.url) out.push({ filename: sanitizeString(m.filename), url: sanitizeString(m.url) })
        }
      }
    }
  }
  return out
}

function toQPost(raw: RawPost, index: number): QPost {
  const postNum = raw.number ?? index + 1
  return {
    id: String(postNum),   // use sequential Q post number as stable unique doc ID
    postNum,
    name: sanitizeString(raw.name) || 'Q',
    trip: raw.trip ? sanitizeString(raw.trip) : null,
    text: sanitizeString(raw.text),
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : 0,
    threadId: sanitizeString(raw.threadId),
    source: sanitizeString(raw.source),
    userId: sanitizeString(raw.userId),
    subject: raw.subject ? sanitizeString(raw.subject) : null,
    link: sanitizeString(raw.link),
    media: sanitizeMedia(raw.media),
    refMedia: extractRefMedia(raw.references),
    references: sanitizeRefs(raw.references),
    hasQuestions: false,
    topicTags: [],
    stars: 0,
    ingested: true,
  }
}

// Lightweight patch — re-fetches posts.json and updates only the refMedia field
// for posts where refMedia is missing or empty. Skips all other fields.
export async function patchRefMedia(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const res = await fetch(POSTS_URL)
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`)
  const raw: RawPost[] = await res.json()
  raw.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

  // Only process posts that have refMedia in the source
  const withMedia = raw
    .map((r, i) => ({ r, i, media: extractRefMedia(r.references) }))
    .filter(x => x.media.length > 0)

  const total = withMedia.length
  let done = 0
  onProgress?.(0, total)

  for (let i = 0; i < withMedia.length; i += BATCH_SIZE) {
    const chunk = withMedia.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const { r, i: idx, media } of chunk) {
      const postNum = (r as RawPost & { number?: number }).number ?? idx + 1
      const ref = doc(db, 'posts', String(postNum))
      batch.update(ref, { refMedia: media })
    }
    await batch.commit()
    done += chunk.length
    onProgress?.(done, total)
  }

  return total
}

export async function fetchAndIngestPosts(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const res = await fetch(POSTS_URL)
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`)
  const raw: RawPost[] = await res.json()

  // Sort oldest first so index 0 = Q post #1
  raw.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

  const total = raw.length
  let done = 0
  // Report total immediately so UI shows X/total instead of 0/0 during first batch
  onProgress?.(0, total)

  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const chunk = raw.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const [j, item] of chunk.entries()) {
      const post = toQPost(item, i + j)
      const ref = doc(db, 'posts', post.id)
      batch.set(ref, post, { merge: true })
    }
    await batch.commit()
    done += chunk.length
    onProgress?.(done, total)
  }

  return total
}

const QANONPUB_URL = '/qanonpub-proxy/data/json/posts.json'

// Fetches qanon.pub posts.json and patches any Firestore posts that are missing
// media URLs found on qanon.pub. Only updates posts where qanon.pub has more media.
export async function patchMediaFromQanonPub(
  onProgress?: (done: number, total: number, added: number) => void
): Promise<{ patched: number; mediaAdded: number }> {
  const res = await fetch(QANONPUB_URL)
  if (!res.ok) throw new Error(`Failed to fetch qanon.pub: ${res.status}`)
  const raw: RawPost[] = await res.json()
  raw.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

  // Only look at posts that have media on qanon.pub
  const withMedia = raw
    .map((r, i) => ({
      postNum: (r as RawPost & { number?: number }).number ?? i + 1,
      media: sanitizeMedia(r.media),
      refMedia: extractRefMedia(r.references),
    }))
    .filter(x => x.media.length > 0 || x.refMedia.length > 0)

  const total = withMedia.length
  let done = 0
  let patched = 0
  let mediaAdded = 0
  onProgress?.(0, total, 0)

  for (let i = 0; i < withMedia.length; i += BATCH_SIZE) {
    const chunk = withMedia.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    let batchHasWrites = false

    for (const { postNum, media, refMedia } of chunk) {
      const postRef = doc(db, 'posts', String(postNum))
      const snap = await getDoc(postRef)
      if (!snap.exists()) continue

      const existing = snap.data() as QPost
      const existingUrls = new Set([
        ...(existing.media ?? []).map((m: { url: string }) => m.url),
        ...(existing.refMedia ?? []).map((m: { url: string }) => m.url),
      ])

      // Find media from qanon.pub not already in Firestore
      const newMedia = media.filter(m => m.url && !existingUrls.has(m.url))
      const newRefMedia = refMedia.filter(m => m.url && !existingUrls.has(m.url))

      if (newMedia.length === 0 && newRefMedia.length === 0) continue

      const updates: Record<string, unknown> = {}
      if (newMedia.length > 0) {
        updates['media'] = [...(existing.media ?? []), ...newMedia]
      }
      if (newRefMedia.length > 0) {
        updates['refMedia'] = [...(existing.refMedia ?? []), ...newRefMedia]
      }

      batch.update(postRef, updates)
      batchHasWrites = true
      patched++
      mediaAdded += newMedia.length + newRefMedia.length
    }

    if (batchHasWrites) await batch.commit()
    done += chunk.length
    onProgress?.(done, total, mediaAdded)
  }

  return { patched, mediaAdded }
}

export async function getIngestStatus(): Promise<{ ingested: boolean; count: number }> {
  const snap = await getDocs(query(collection(db, 'posts'), limit(1)))
  const count = snap.size   // quick estimate — not exact
  return { ingested: !snap.empty, count }
}

export async function getPostCount(): Promise<number> {
  // Read a lightweight count document if it exists
  const countRef = doc(db, 'meta', 'postCount')
  const snap = await getDoc(countRef)
  if (snap.exists()) return (snap.data() as { count: number }).count
  return 0
}
