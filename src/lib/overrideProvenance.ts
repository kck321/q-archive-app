// WHICH FIELDS OF A CLOUD EDIT MAY BE LAID OVER THE BUNDLE.
//
// The editorial build seeds from public/data (correct, ruled, certified) and then overlays the
// Firestore `postEdits` collection on top. That overlay used `Object.assign`, which replaces
// `postAnalysis` WHOLESALE — and Firestore's copy of it is months old. Measured 2026-08-21:
// 1,348 of 1,355 docs carry a postAnalysis, every one of them differs from the bundle, not one
// has `claimSpans` at all, and the newest edit in the whole collection predates the queue ruling
// by ten days. The overlay erased 1,208 claims, 62 predictions and 930 entity mentions across
// 244 posts on the one surface the owner reviews on.
//
// WHY THE EXPORT PATH SURVIVED THE SAME BUG. scripts/export-firestore.mjs performs the identical
// destructive bake and then re-runs APPLY_INVOCATIONS, which rebuilds every certified section on
// top. It bakes stale data and then repairs it. The runtime overlay has no repair step — there is
// no apply chain in a browser. So the protection has to be "don't bake it in the first place".
//
// THE RULE. The bundle already CONTAINS every edit the last export consumed, baked and then
// repaired by the chain. So an edit that is not NEWER than the bundle carries no information the
// bundle lacks; overlaying it can only subtract. Apply a field only when that field was written
// after `bakedThrough`.
//
// WHY PER-FIELD AND NOT PER-DOCUMENT. `pushPostEdit` writes with `{ merge: true }` and stamps ONE
// `_updatedAt` for the whole document. Editing an unrelated field — correlatedNews, say — restamps
// the document while leaving a months-old `postAnalysis` sitting inside it. A per-document
// timestamp would then declare that stale snapshot "newer than the bundle" and lay it back down.
// `_fieldUpdatedAt` dates each field separately so that cannot happen.
//
// THE FALLBACK IS PESSIMISTIC ON PURPOSE. A document that has a `_fieldUpdatedAt` map has been
// written by this code; a field MISSING from that map was last written by the old code, at an
// unknown time no later than the document's first new-style write. Dating it from the document's
// `_updatedAt` is exactly the hole described above, so an undated field on a per-field document
// scores 0 and is never applied. Only a fully legacy document — no map at all — falls back to
// `_updatedAt`, and every one of those is older than the bundle anyway.

/** Fields the apply chain re-materialises at export time. Informational: the rule above is what
 *  protects them. Kept because a reader asking "which of these does the chain own?" should not
 *  have to reconstruct it from chainSteps.mjs. */
export const CHAIN_OWNED_FIELDS: readonly string[] = [
  'postAnalysis', 'actionRequests', 'hasQuestions', 'hasRequests',
]

export interface EditMeta {
  _updatedAt?: number
  _fieldUpdatedAt?: Record<string, number>
}

/** When `field` was last written, in ms. 0 means "not datable, therefore not newer than anything". */
export function fieldTouchedAt(meta: EditMeta | undefined, field: string): number {
  const per = meta?._fieldUpdatedAt
  if (per && typeof per === 'object') {
    const t = per[field]
    return typeof t === 'number' && Number.isFinite(t) ? t : 0
  }
  const doc = meta?._updatedAt
  return typeof doc === 'number' && Number.isFinite(doc) ? doc : 0
}

export interface OverrideSelection<T> {
  apply: Partial<T>
  applied: string[]
  skipped: string[]
}

/**
 * Split one cloud edit into the fields that may be laid over the bundle and the fields that may not.
 *
 * Metadata keys (leading underscore) are never applied — they describe the edit, they are not part
 * of the post.
 */
export function selectOverrideFields<T extends Record<string, unknown>>(
  fields: T,
  meta: EditMeta | undefined,
  bakedThrough: number,
): OverrideSelection<T> {
  const apply: Record<string, unknown> = {}
  const applied: string[] = []
  const skipped: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    if (k.startsWith('_')) continue
    if (fieldTouchedAt(meta, k) > bakedThrough) { apply[k] = v; applied.push(k) }
    else skipped.push(k)
  }
  return { apply: apply as Partial<T>, applied, skipped }
}
