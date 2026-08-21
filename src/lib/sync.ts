// Cross-device edit sync. Reads stay offline/instant from the local bundle; this layer
// pushes the user's edits to small Firestore collections and pulls them back on load so
// classifications/questions propagate across desktop, phone, and web.
//
// We deliberately use tiny side collections (postEdits / questionEdits) that only hold
// CHANGED items, so load stays fast — we never re-download the full posts collection.
import { db } from '../firebase'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import type { QPost, QQuestion } from '../types'
import type { EditMeta } from './overrideProvenance'

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
    const touched: Record<string, number> = {}
    const now = Date.now()
    for (const k of EDITABLE_FIELDS) {
      if (k in fields && fields[k] !== undefined) { payload[k] = fields[k]; touched[k as string] = now }
    }
    if (Object.keys(payload).length === 0) return
    payload._updatedAt = now
    // PER-FIELD PROVENANCE, because one timestamp per document is not enough.
    //
    // This writes with { merge: true }, so a document ACCUMULATES fields across edits. Stamping
    // only `_updatedAt` means an edit to correlatedNews restamps the whole document while a
    // months-old postAnalysis sits inside it untouched — and the runtime overlay would then treat
    // that stale snapshot as newer than the bundle and lay it back over the certified data.
    // Firestore deep-merges map fields, so this accumulates one date per field.
    payload._fieldUpdatedAt = touched
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
  /** Per-document edit provenance, keyed the same as `posts`. The overlay needs it to decide which
   *  fields are actually newer than the bundle — see src/lib/overrideProvenance.ts. It is returned
   *  ALONGSIDE the fields rather than left inside them, so a timestamp can never be written onto a
   *  post as if it were post data. */
  postMeta: Record<string, EditMeta>
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
    const postMeta: Record<string, EditMeta> = {}
    pe.forEach(d => {
      const data = d.data() as Record<string, unknown>
      // The timestamps used to be DELETED here, which threw away the only signal that could tell a
      // months-old edit from a fresh one — and the overlay downstream had no way to ask. They are
      // lifted out into `postMeta` instead: still never merged onto a post, but no longer lost.
      postMeta[d.id] = {
        _updatedAt: typeof data._updatedAt === 'number' ? data._updatedAt : undefined,
        _fieldUpdatedAt: (data._fieldUpdatedAt ?? undefined) as Record<string, number> | undefined,
      }
      delete data._updatedAt
      delete data._fieldUpdatedAt
      posts[d.id] = data as Partial<QPost>
    })
    const questions = qe.docs.map(d => {
      const data = d.data() as Record<string, unknown>
      delete data._updatedAt
      delete data._fieldUpdatedAt
      return { id: d.id, ...data } as QQuestion & { deleted?: boolean }
    })
    return { posts, questions, postMeta }
  } catch {
    return null
  }
}
