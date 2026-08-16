// Cross-section relationships, loaded from the certified artifact.
//
// The app never derives these. relationships.json is built by scripts/build-relationships.mjs
// from stored cross-links, certified span overlaps, shared ids and adjudicated attributes, and
// its QA gate refuses to write an edge that cannot name its basis. Recomputing any of it here
// would put a second, uncertified definition of "related" in the codebase.

export type EdgeSide = { section?: string; id?: string; text?: string; index?: number; attribute?: string }
export type Edge = { postNum: number; type: string; from: EdgeSide; to: EdgeSide; basis: string; detail: string | null }
export type PostMap = { counts: Record<string, number>; relationships: number }

export interface RelationshipData {
  totals: { relationships: number; byType: Record<string, number>; postsWithAnalysis: number }
  analysisMap: Record<string, PostMap>
  byPost: Record<string, Edge[]>
}

let _cache: RelationshipData | null = null
let _inflight: Promise<RelationshipData> | null = null

/**
 * Loaded once and shared. The file is ~4 MB, so a per-post fetch would re-download it on every
 * navigation; the archive is static between deploys, which is what makes caching it safe.
 */
export function loadRelationships(): Promise<RelationshipData> {
  if (_cache) return Promise.resolve(_cache)
  _inflight ??= (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/relationships.json`)
    if (!res.ok) throw new Error(`relationships.json ${res.status}`)
    _cache = await res.json()
    return _cache!
  })().finally(() => { _inflight = null })
  return _inflight
}
