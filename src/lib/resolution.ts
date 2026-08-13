// Resolution Center data + submission.
//
// TWO STORES, deliberately separate:
//   public/data/resolution-queue.json   READ-ONLY, built by the editorial pipeline
//   Firestore `resolutionSuggestions`   WRITE-ONLY, where community suggestions land
//
// A submission can never reach a certified artifact. Approved suggestions re-enter through
// the same audit → materialise → QA → apply → deploy chain as everything else, which is what
// keeps the published counts defensible.

export type ResolutionStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'INSUFFICIENT_EVIDENCE' | 'DISPUTED'

export interface QueueItem {
  id: string
  kind: 'entity_alias' | 'theme' | 'code' | 'source_reference' | 'other'
  token: string
  postNum: number
  postId: string
  sourceSpan: string
  context: string[]
  lineIndex: number
  charIndex: number
  candidates: string[]
  whyUnresolved: string
  status: ResolutionStatus
}

export interface QueueData {
  statuses: ResolutionStatus[]
  totals: { occurrences: number; tokens: number; byToken: Record<string, number> }
  rows: QueueItem[]
}

let _cache: QueueData | null = null
let _inflight: Promise<QueueData> | null = null

export async function loadQueue(): Promise<QueueData> {
  if (_cache) return _cache
  _inflight ??= (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/resolution-queue.json`)
    if (!res.ok) throw new Error(`resolution-queue.json ${res.status}`)
    _cache = await res.json()
    return _cache!
  })().finally(() => { _inflight = null })
  return _inflight
}

export interface Suggestion {
  /** The exact occurrence this applies to. NOT the token — one occurrence at a time. */
  itemId: string
  token: string
  postNum: number
  proposedResolution: string
  reasoning: string
  sourceUrl?: string
  /** Other occurrence ids the submitter explicitly says this also covers. */
  alsoAppliesTo?: string[]
  contact?: string
}

/**
 * Send a suggestion to the moderation queue.
 *
 * Writes to `resolutionSuggestions`, which is create-only in the Firestore rules: no read, so
 * there is no public wall to deface and no way to enumerate what others submitted. Nothing
 * here touches entities.json or any other certified file.
 */
export async function submitSuggestion(s: Suggestion): Promise<void> {
  const { db } = await import('../firebase')
  const { collection, addDoc } = await import('firebase/firestore')
  await addDoc(collection(db, 'resolutionSuggestions'), {
    itemId: s.itemId.slice(0, 200),
    token: s.token.slice(0, 80),
    postNum: s.postNum,
    proposedResolution: s.proposedResolution.slice(0, 300),
    reasoning: s.reasoning.slice(0, 3000),
    sourceUrl: (s.sourceUrl ?? '').slice(0, 500),
    // Occurrence-specific by default. A submitter has to name any other occurrences.
    alsoAppliesTo: (s.alsoAppliesTo ?? []).slice(0, 50),
    contact: (s.contact ?? '').slice(0, 200),
    status: 'OPEN',
    createdAt: Date.now(),
  })
}
