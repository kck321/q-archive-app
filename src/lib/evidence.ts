// The certified Evidence & References dataset.
//
// Read from public/data/evidence.json rather than re-derived from post text. posts.ts used to
// extract links with its own URL pattern — no bare "www.", no handling for the board's
// space-broken protocol ("https:// www.nytimes.com/…") — which meant the Links page and the
// certified figure disagreed by 78 citations. Counting comes from the certified rows now, the
// same rule that fixed the "Coincidence? 142 vs 88" problem in Questions.

export type EvidenceKind = 'EXTERNAL_LINK' | 'MEDIA' | 'INTERNAL_REFERENCE' | 'QUOTED_SOURCE'

export interface EvidenceItem {
  kind: EvidenceKind
  subtype: string
  postNum: number
  postId: string
  value: string
  domain: string | null
  archived: boolean
  provenance: string
  /** EXTERNAL_LINK / MEDIA: false for a hyperlink printed inside pasted source material. */
  countsAsQCitation?: boolean
  /** MEDIA: where the file actually comes from now. */
  servedFrom?: string
  originalHost?: string
  /** INTERNAL_REFERENCE */
  referencedBoardId?: string
  resolved?: boolean
  quotedContentAvailable?: boolean
  label?: string
}

export interface EvidenceTotals {
  occurrences: number
  posts: number
  externalLinks: { qCitations: number; distinctUrls: number; domains: number; embeddedInSourceMaterial: number; posts: number }
  media: { occurrences: number; distinctAssets: number; posts: number; archiveMirror: number; originalHost: number }
  internalReferences: { occurrences: number; distinctReferencedPosts: number; resolved: number; unresolved: number; posts: number }
  quotedSource: { occurrences: number; distinctPassages: number; posts: number }
}

let _cache: { totals: EvidenceTotals; items: EvidenceItem[] } | null = null
let _inflight: Promise<{ totals: EvidenceTotals; items: EvidenceItem[] }> | null = null

export async function loadEvidence() {
  if (_cache) return _cache
  // Share one request between concurrent callers, so opening two sections at once does not
  // pull 2 MB twice.
  _inflight ??= (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/evidence.json`)
    if (!res.ok) throw new Error(`evidence.json ${res.status}`)
    const json = await res.json()
    _cache = { totals: json.totals, items: json.items }
    return _cache
  })().finally(() => { _inflight = null })
  return _inflight
}

/** Links Q actually cited. Excludes hyperlinks printed inside pasted source material. */
export async function getQCitationLinks(): Promise<EvidenceItem[]> {
  const { items } = await loadEvidence()
  return items.filter(i => i.kind === 'EXTERNAL_LINK' && i.countsAsQCitation !== false)
}

export async function getEvidenceForPost(postNum: number): Promise<EvidenceItem[]> {
  const { items } = await loadEvidence()
  return items.filter(i => i.postNum === postNum)
}

export async function getEvidenceTotals(): Promise<EvidenceTotals> {
  return (await loadEvidence()).totals
}
