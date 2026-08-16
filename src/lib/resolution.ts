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

/** Every kind the hub will hold. Declared before the sections that populate them. */
export type QueueKind = 'entity' | 'theme' | 'code' | 'source_reference' | 'classification' | 'other'

export interface QueueItem {
  id: string
  kind: QueueKind
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
  /** Which audit left this unresolved, and where it lives in the app. */
  provenance: string
  deepLink: string
  /**
   * The owner's reasoning on a case deliberately left OPEN — "SR here is the senior rank, not
   * Seth Rich". Not a ruling and not a resolution: the row stays queued and no count moves.
   * Set from audit/resolution-owner-notes.json when the build attaches one.
   */
  ownerNote?: string
  ownerNotedOn?: string
}

export interface QueueData {
  statuses: ResolutionStatus[]
  kinds: QueueKind[]
  totals: {
    occurrences: number
    tokens: number
    byToken: Record<string, number>
    byKind: Record<string, number>
    byStatus: Record<string, number>
  }
  rows: QueueItem[]
}

/** Deep link to one exact occurrence, not the top of the queue. */
export const resolveLinkFor = (itemId: string) => `/resolve?item=${encodeURIComponent(itemId)}`

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
  rememberSubmission(s.itemId, s.proposedResolution)
}

/**
 * A contributor's own submission history, kept in this browser.
 *
 * The moderation store is deliberately create-only — no read — so there is no public wall to
 * deface and no way to enumerate what other people sent. That security property is worth keeping,
 * and it has one cost: after submitting, a contributor had no way to tell what they had already
 * covered, and the queue looked identical whether they had worked on it for an hour or not at
 * all. Recording it locally answers that without opening the store to reads.
 *
 * This is a personal record, not a status: it says "you sent this", never "this was accepted".
 * Only an editorial pass through audit → adjudication → QA → apply → deploy can do that.
 */
const SENT_KEY = 'qdrops.resolve.sent'

export type SentRecord = { itemId: string; proposed: string; at: number }

export function sentSubmissions(): Record<string, SentRecord> {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') } catch { return {} }
}

function rememberSubmission(itemId: string, proposed: string) {
  try {
    const all = sentSubmissions()
    all[itemId] = { itemId, proposed: proposed.slice(0, 300), at: Date.now() }
    localStorage.setItem(SENT_KEY, JSON.stringify(all))
  } catch { /* private browsing, a full quota — never block a submission over its receipt */ }
}
