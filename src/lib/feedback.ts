// Visitor feedback — a WRITE-ONLY drop box.
//
// Visitors can create a document in `feedback` and nothing else. They cannot read what
// anyone else submitted, cannot edit, cannot delete. So there is no public comment wall
// to moderate, nothing to deface, and no way to reach the research data from here.
// Submissions are read in the Firebase console.
//
// This only holds if the Firestore rules say so. The matching rule is:
//
//   match /feedback/{id} {
//     allow create: if request.resource.data.keys().hasOnly(
//                        ['kind','message','contact','postNum','createdAt'])
//                   && request.resource.data.message is string
//                   && request.resource.data.message.size() > 0
//                   && request.resource.data.message.size() < 2000
//                   && request.resource.data.contact.size() < 200;
//     allow read, update, delete: if false;
//   }
//
// The caps are enforced here too, but client-side limits are a courtesy, not a control —
// the rule is what actually stops a crafted request.
import { db } from '../firebase'
import { collection, addDoc } from 'firebase/firestore'

export const FEEDBACK_KINDS = [
  { key: 'comment',    label: '💬 Comment' },
  { key: 'correction', label: '✏️ Correction' },
  { key: 'request',    label: '💡 Feature idea' },
  { key: 'bug',        label: '🐞 Something broken' },
] as const

export type FeedbackKind = typeof FEEDBACK_KINDS[number]['key']

export const MAX_MESSAGE = 2000
export const MAX_CONTACT = 200

export interface FeedbackDraft {
  kind: FeedbackKind
  message: string
  /** Optional — only if they want a reply. */
  contact?: string
  /** Optional — the post they're referring to. */
  postNum?: number
}

export async function submitFeedback(draft: FeedbackDraft): Promise<void> {
  const message = draft.message.trim().slice(0, MAX_MESSAGE)
  if (!message) throw new Error('Please write a message first.')

  // Keys must match the rule's hasOnly() list exactly, so only send fields with values.
  const payload: Record<string, unknown> = {
    kind: draft.kind,
    message,
    contact: (draft.contact ?? '').trim().slice(0, MAX_CONTACT),
    createdAt: Date.now(),
  }
  if (typeof draft.postNum === 'number' && Number.isFinite(draft.postNum)) {
    payload.postNum = draft.postNum
  }

  await addDoc(collection(db, 'feedback'), payload)
}
