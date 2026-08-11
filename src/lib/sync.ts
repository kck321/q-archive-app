// Cross-device edit sync. Reads stay offline/instant from the local bundle; this layer
// pushes the user's edits to small Firestore collections and pulls them back on load so
// classifications/questions propagate across desktop, phone, and web.
//
// We deliberately use tiny side collections (postEdits / questionEdits) that only hold
// CHANGED items, so load stays fast — we never re-download the full posts collection.
import { db } from '../firebase'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import type { QPost, QQuestion } from '../types'

const POST_EDITS = 'postEdits'
const QUESTION_EDITS = 'questionEdits'

// Post fields that are user-editable and worth syncing.
const EDITABLE_FIELDS: (keyof QPost)[] = [
  'postAnalysis', 'actionRequests', 'hasRequests', 'hasQuestions',
  'analysisScanned', 'customBrackets', 'excludedBrackets', 'correlatedNews', 'newsScanned',
]

function timeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>(res => setTimeout(() => res(null), ms))])
}

// Strip undefined (Firestore rejects undefined values).
function clean<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out
}

export async function pushPostEdit(postId: string, fields: Partial<QPost>): Promise<void> {
  try {
    const payload: Record<string, unknown> = {}
    for (const k of EDITABLE_FIELDS) if (k in fields && fields[k] !== undefined) payload[k] = fields[k]
    if (Object.keys(payload).length === 0) return
    payload._updatedAt = Date.now()
    await setDoc(doc(db, POST_EDITS, postId), payload, { merge: true })
  } catch { /* offline / rules — local copy already saved, will retry on next edit */ }
}

export async function pushQuestionAdd(q: QQuestion): Promise<void> {
  try {
    await setDoc(doc(db, QUESTION_EDITS, q.id), clean({ ...q, deleted: false, _updatedAt: Date.now() }), { merge: true })
  } catch { /* best-effort */ }
}

export async function pushQuestionDelete(id: string): Promise<void> {
  try {
    await setDoc(doc(db, QUESTION_EDITS, id), { deleted: true, _updatedAt: Date.now() }, { merge: true })
  } catch { /* best-effort */ }
}

export interface CloudOverrides {
  posts: Record<string, Partial<QPost>>
  questions: (QQuestion & { deleted?: boolean })[]
}

// Pull all edits. Returns null on failure/offline (caller keeps local data only).
export async function fetchOverrides(): Promise<CloudOverrides | null> {
  try {
    const res = await timeout(Promise.all([
      getDocs(collection(db, POST_EDITS)),
      getDocs(collection(db, QUESTION_EDITS)),
    ]), 6000)
    if (!res) return null
    const [pe, qe] = res
    const posts: Record<string, Partial<QPost>> = {}
    pe.forEach(d => {
      const data = d.data() as Record<string, unknown>
      delete data._updatedAt
      posts[d.id] = data as Partial<QPost>
    })
    const questions = qe.docs.map(d => {
      const data = d.data() as Record<string, unknown>
      delete data._updatedAt
      return { id: d.id, ...data } as QQuestion & { deleted?: boolean }
    })
    return { posts, questions }
  } catch {
    return null
  }
}
