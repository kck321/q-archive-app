// STEP 3B-0 — the occurrence record, and the vocabulary it is allowed to use.
//
// SCHEMA ONLY. Nothing here classifies anything, reads posts.json, or moves a count. It defines
// the shape 3B-1 writes into and the rules that make a malformed record fail loudly instead of
// travelling downstream as a plausible-looking row.
//
// WHY THE MODEL CHANGED. The archive painted one colour per certified span and had no way to say
// "this sentence is a Question that also functions as a Directive" except by certifying it twice
// and painting it twice. That produced a contradiction the review caught: the model claimed one
// category per sentence while 220 directive+question pairs were deliberately kept as two. Both
// cannot be PAINTED. Both can be CERTIFIED.
//
//   primaryCategory      exactly one, and it is what paints the sentence background
//   secondarySemantics   every other genuinely correct function — counted, searchable, listed in
//                        its own section, and NOT painted
//
// The two are reported separately and must never be summed into one figure, because "8,912 Claims"
// meaning "claims plus sentences that are also a bit like a claim" is exactly the kind of number
// this archive exists not to publish.

/** The four painted sentence categories. One per sentence, never more. */
export const PRIMARY_CATEGORIES = Object.freeze(['claim', 'prediction', 'question', 'directive'])

/**
 * How a span relates to Q's authorship. This is provenance, not a category: a quoted sentence can
 * be a Claim — it just is not Q's claim, and must never enter a Q-authored total.
 */
export const SOURCE_DISPOSITIONS = Object.freeze([
  'q_authored',            // Q wrote it
  'quoted_source',         // pasted or quoted material, reproduced inside the drop
  'editorial_paraphrase',  // the archive's own wording, never displayed as Q's
  'quoted_post',           // text from a recovered anon post the drop replies to
  'picture',               // read out of an image
])

/**
 * A review disposition records that a span was LOOKED AT. It never paints.
 *
 * `contextual` and `context_only` are the two halves of the owner's Context ruling: a span that
 * also carries a primary category keeps the category and is merely marked contextual, while a span
 * with no category at all stays deliberately unpainted rather than becoming an open question.
 */
export const REVIEW_DISPOSITIONS = Object.freeze([
  'contextual',                // reviewed, and a primary category also applies
  'context_only',             // reviewed, and deliberately in no semantic category
  'emphasis',                 // a certified emphasis device
  'signature',                // Q's terminal sign-off
  'structural',               // a list marker, header or separator
  'source_boundary_exception',// a span whose completion would cross into source material
])

/** How an entity is tied to a drop. Only a LITERAL tie may paint characters. */
export const ENTITY_ASSOCIATION_KINDS = Object.freeze([
  'literal',   // the drop contains the canonical name or a registered alias, at these offsets
  'indirect',  // the drop refers to the identity without naming it — never painted
])

/**
 * The identity of an occurrence: a post, a kind, and a range of characters.
 *
 * NOT its text. Identifying records by wording is what collapsed 48 legitimate in-post repeats,
 * detached 64 repaired claims from their metadata, and let one tab character hide a repair.
 */
export const occurrenceKey = (postNum, kind, start, end) => `${postNum}|${kind}|${start}|${end}`

/** A new occurrence record, with every optional field present and empty rather than absent. */
export function makeOccurrence({
  postNum, kind, start, end, text, sentenceId = null,
  primaryCategory = null, secondarySemantics = [], themeTags = [],
  reviewDisposition = null, sourceDisposition = 'q_authored',
  entityAssociations = [], provenance = null,
}) {
  return {
    occurrenceKey: occurrenceKey(postNum, kind, start, end),
    postNum, kind, start, end, text, sentenceId,
    primaryCategory, secondarySemantics, themeTags,
    reviewDisposition, sourceDisposition, entityAssociations, provenance,
  }
}

/**
 * Every way a record can be wrong, as a list of reasons. Empty means valid.
 *
 * Returns ALL failures rather than the first, so a migration reports what is wrong with a batch in
 * one pass instead of one defect per run.
 */
export function validateOccurrence(o) {
  const errs = []
  const n = v => typeof v === 'number' && Number.isInteger(v) && v >= 0
  if (!n(o?.postNum)) errs.push('postNum must be a non-negative integer')
  if (!o?.kind) errs.push('kind is required')
  if (!n(o?.start) || !n(o?.end)) errs.push('start and end must be non-negative integers')
  else if (o.end <= o.start) errs.push(`empty or reversed range ${o.start}..${o.end}`)
  if (o?.occurrenceKey !== occurrenceKey(o?.postNum, o?.kind, o?.start, o?.end)) {
    errs.push('occurrenceKey does not match postNum|kind|start|end')
  }
  if (o?.primaryCategory !== null && !PRIMARY_CATEGORIES.includes(o?.primaryCategory)) {
    errs.push(`primaryCategory ${JSON.stringify(o?.primaryCategory)} is not one of ${PRIMARY_CATEGORIES.join(', ')}`)
  }
  if (!Array.isArray(o?.secondarySemantics)) errs.push('secondarySemantics must be an array')
  else {
    for (const s of o.secondarySemantics) {
      if (!PRIMARY_CATEGORIES.includes(s?.category)) errs.push(`secondary ${JSON.stringify(s?.category)} is not a category`)
      if (!s?.reason) errs.push(`secondary ${s?.category} carries no reason`)
      // A category cannot be both the painted one and a secondary one: that is the double-count
      // the whole primary/secondary split exists to prevent.
      if (s?.category === o.primaryCategory) errs.push(`${s.category} is both the primary and a secondary`)
    }
    const seen = new Set()
    for (const s of o.secondarySemantics) {
      if (seen.has(s?.category)) errs.push(`secondary ${s.category} listed twice`)
      seen.add(s?.category)
    }
  }
  if (o?.reviewDisposition !== null && !REVIEW_DISPOSITIONS.includes(o?.reviewDisposition)) {
    errs.push(`reviewDisposition ${JSON.stringify(o?.reviewDisposition)} is not recognised`)
  }
  if (!SOURCE_DISPOSITIONS.includes(o?.sourceDisposition)) {
    errs.push(`sourceDisposition ${JSON.stringify(o?.sourceDisposition)} is not recognised`)
  }
  if (!Array.isArray(o?.entityAssociations)) errs.push('entityAssociations must be an array')
  else {
    for (const e of o.entityAssociations) {
      if (!ENTITY_ASSOCIATION_KINDS.includes(e?.kind)) errs.push(`entity association kind ${JSON.stringify(e?.kind)} is not recognised`)
      if (!e?.identity) errs.push('entity association carries no identity')
      // The rule that stops a canonical name being painted over characters that do not contain it.
      if (e?.kind === 'literal' && !e?.aliasUsed) errs.push(`literal association to ${e?.identity} names no alias — a painted span must say which spelling it covers`)
    }
  }
  if (!Array.isArray(o?.themeTags)) errs.push('themeTags must be an array')
  return errs
}

/**
 * The two figures, reported apart.
 *
 * A primary occurrence paints and counts as the section's own. A secondary one is real, certified
 * and searchable, and belongs in a separate line of any report. Summing them is the defect this
 * function exists to make awkward.
 */
export function countByLayer(occurrences) {
  const primary = {}, secondary = {}
  for (const o of occurrences) {
    if (o.primaryCategory) primary[o.primaryCategory] = (primary[o.primaryCategory] ?? 0) + 1
    for (const s of o.secondarySemantics ?? []) secondary[s.category] = (secondary[s.category] ?? 0) + 1
  }
  return { primary, secondary }
}

/**
 * Spans of the SAME primary category covering overlapping characters, by range.
 *
 * The check the owner's no-same-category-overlap rule needs, and the reason it is here rather than
 * written inline at each call site: an identical range is one occurrence seen twice, which is a
 * duplicate-key problem, while a partial overlap is a boundary problem. They are not the same
 * defect and must not be collapsed into one number.
 */
export function findSameCategoryOverlaps(occurrences) {
  const out = []
  const byPost = new Map()
  for (const o of occurrences) {
    if (!o.primaryCategory) continue
    if (!byPost.has(o.postNum)) byPost.set(o.postNum, [])
    byPost.get(o.postNum).push(o)
  }
  for (const rows of byPost.values()) {
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j]
        if (a.primaryCategory !== b.primaryCategory) continue
        if (a.start === b.start && a.end === b.end) { out.push({ a, b, relation: 'IDENTICAL_RANGE' }); continue }
        if (a.start < b.end && b.start < a.end) {
          const nested = (a.start <= b.start && a.end >= b.end) || (b.start <= a.start && b.end >= a.end)
          out.push({ a, b, relation: nested ? 'NESTED' : 'PARTIAL_OVERLAP' })
        }
      }
    }
  }
  return out
}
