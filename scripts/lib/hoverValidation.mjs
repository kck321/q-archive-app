// What makes a hover synopsis publishable — one definition, applied to every record.
//
// The first pass keyed publication off the audit's implementationStatus alone. That was right on
// the day the audit ran and wrong the moment Stage 1 landed: 523 records said "resolve the
// registry first", Stage 1 resolved it, and they stayed held anyway — leaving all 17 merge
// survivors and all 85 corrected-type entities with no tooltips at all.
//
// So publication is decided by VALIDATING THE RECORD against the current certified state, not by
// reading a status written against an earlier one. A status is evidence about the past; these
// checks are questions about now.
//
// Every rejection carries a reason, because "held" with no reason is how 523 records sat
// unexplained for a stage.

/** Spans of `text` that are inside a URL. Entities matched only in here are not prose mentions. */
export function urlSpans(text) {
  const spans = []
  const rx = /\bhttps?:\/\/\S+|\bwww\.\S+/gi
  let m
  while ((m = rx.exec(text)) !== null) spans.push([m.index, m.index + m[0].length, m[0]])
  return spans
}

/**
 * Where in the corpus does this alias actually appear?
 *
 * Returns { inProse, inUrl, urlParts } — an alias found only inside URLs is a very different
 * thing from one Q wrote in a sentence, and the difference decides whether it should be painted
 * as prose at all.
 *
 * Matching is punctuation-insensitive on BOTH sides, because a URL spells a name as
 * `black%20lives%20matter` or `presidential-advisory` and neither is a substring of the name.
 */
export function aliasLocation(text, alias) {
  const src = String(text ?? '')
  const spans = urlSpans(src)
  const fold = s => String(s).toLowerCase().replace(/%[0-9a-f]{2}/gi, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
  const needle = fold(alias)
  if (!needle) return { inProse: false, inUrl: false, urlParts: [] }

  // Prose = everything outside the URL spans.
  let prose = ''
  let cursor = 0
  for (const [s, e] of spans) { prose += src.slice(cursor, s) + ' '; cursor = e }
  prose += src.slice(cursor)

  const inProse = fold(prose).includes(needle)

  const urlParts = []
  for (const [, , url] of spans) {
    if (!fold(url).includes(needle)) continue
    // Split the URL so the match can be attributed to the part that carries it. A publisher's
    // domain is a source reference; a search term in a query string is not a mention of anything.
    const withoutScheme = url.replace(/^https?:\/\//i, '')
    const qIdx = withoutScheme.indexOf('?')
    const hostAndPath = qIdx === -1 ? withoutScheme : withoutScheme.slice(0, qIdx)
    const query = qIdx === -1 ? '' : withoutScheme.slice(qIdx + 1)
    const slashIdx = hostAndPath.indexOf('/')
    const host = slashIdx === -1 ? hostAndPath : hostAndPath.slice(0, slashIdx)
    const pathPart = slashIdx === -1 ? '' : hostAndPath.slice(slashIdx)
    if (fold(host).includes(needle)) urlParts.push('hostname')
    if (pathPart && fold(pathPart).includes(needle)) urlParts.push('path')
    if (query && fold(query).includes(needle)) urlParts.push('query')
  }
  return { inProse, inUrl: urlParts.length > 0, urlParts: [...new Set(urlParts)] }
}

/** The five classes the owner asked for, decided from where the match sits. */
export function classifyUrlDerived(loc) {
  const p = loc.urlParts
  if (!p.length) return 'ambiguous_url_reference'
  if (p.length > 1) return 'ambiguous_url_reference'
  if (p[0] === 'hostname') return 'hostname_source_reference'
  if (p[0] === 'path') return 'url_path_fragment'
  if (p[0] === 'query') return 'url_query_fragment'
  return 'ambiguous_url_reference'
}

export const URL_CLASS_MEANING = {
  hostname_source_reference: 'the domain identifies the linked publisher or organisation',
  human_readable_link_label: 'visible link text explicitly names the entity',
  url_path_fragment: 'inferred only from a URL path or slug',
  url_query_fragment: 'inferred only from query parameters, search terms or encoded content',
  ambiguous_url_reference: 'the evidence does not support an automatic decision',
}

/**
 * Validate one hover record against the CURRENT certified state.
 *
 * @returns { verdict: 'publish' | 'review' | 'quarantine' | 'withdrawn', reason, urlClass? }
 */
export function validateHover(rec, ctx) {
  const { liveById, sharedAliases, paintedIn, postText, withdrawnAuditIds } = ctx

  // THE AUDIT'S OWN REVIEW GRADE IS NOT MINE TO OVERRIDE.
  //
  // These checks are mechanical: is the entity live, is there a mention to anchor to, is the alias
  // ambiguous. "Human review before publish" is none of those — it is an editorial judgement that
  // the reading needs a person. Running the mechanical checks over it and promoting whatever
  // passed took the published set from 4,285 to 6,472 in one run, publishing 2,187 synopses a
  // human had been asked to read first.
  //
  // Only the registry-blocked records are re-decided here, and only because their stated blocker —
  // "resolve the registry action first" — is a fact about the data that Stage 1 changed.
  if (rec.status === 'Human review before publish') {
    return { verdict: 'review', reason: 'the audit graded this reading as needing human review' }
  }

  // The entity is gone. These belong to audit history, never to Publish or ordinary Review.
  if (withdrawnAuditIds.has(rec.auditEntityId)) {
    return { verdict: 'withdrawn', reason: 'the entity was withdrawn from Entities in Stage 1' }
  }
  if (!rec.entityId || !liveById.has(rec.entityId)) {
    return { verdict: 'review', reason: 'no live entity resolves from this audit id' }
  }

  // A tooltip needs something to attach to.
  const entity = liveById.get(rec.entityId)
  const aliases = new Set([...entity.aliases.map(a => a.text.toLowerCase()), entity.canonical.toLowerCase()])
  const painted = paintedIn.get(rec.postNum) ?? new Set()
  if (![...aliases].some(a => painted.has(a))) {
    return { verdict: 'review', reason: 'no certified mention of this entity in this drop to anchor the tooltip to' }
  }

  // URL-derived: quarantined rather than published, pending the URL policy ruling.
  const loc = aliasLocation(postText.get(rec.postNum) ?? '', rec.matchedAlias)
  if (!loc.inProse && loc.inUrl) {
    return { verdict: 'quarantine', reason: 'the term appears only inside a URL, never in the drop\'s prose', urlClass: classifyUrlDerived(loc) }
  }

  // A shared alias cannot be resolved by a global mapping. BO is Barack Obama, Bruce Ohr and the
  // Board Owner in different drops; only occurrence-level context settles which.
  if (sharedAliases.has(rec.matchedAlias)) {
    return { verdict: 'review', reason: 'the alias belongs to more than one entity; occurrence-level context must decide which' }
  }

  // Insufficient support is not a publishable reading, whatever the status says.
  if (rec.contextSupport === 'Insufficient') {
    return { verdict: 'review', reason: 'evidence is graded Insufficient' }
  }

  // Wording that describes a registry PROBLEM rather than the drop. These sentences were written
  // about a state Stage 1 has since fixed, and re-grading their evidence is an editorial act, not
  // a mechanical one — so they go to an editor rather than being quietly reworded.
  if (/duplicated in the current entity registry|should be merged before|before a unique tooltip|entity type .* corrected before/i.test(rec.synopsis)) {
    return { verdict: 'review', reason: 'the synopsis describes a registry state Stage 1 has resolved; the reading needs regrading' }
  }

  if (!rec.synopsis || rec.synopsis.length < 40) {
    return { verdict: 'review', reason: 'synopsis is missing or too short to be useful' }
  }
  return { verdict: 'publish', reason: 'passes every Ready validation against the seed-76 state' }
}

/**
 * Repair wording that names something the archive no longer calls by that name.
 *
 * Mechanical only: an absorbed spelling is replaced by the surviving canonical, and a stale type
 * label by the corrected one. Nothing here rewrites a reading or a piece of evidence — that is an
 * editorial judgement, and the records that need one are sent to review instead.
 */
export function refreshWording(text, { entity, absorbedNames, typeLabel, oldTypeLabel }) {
  let out = String(text ?? '')
  const changes = []
  for (const [was, now] of absorbedNames) {
    if (was === now) continue
    const rx = new RegExp(`\\b${was.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    if (rx.test(out)) { out = out.replace(rx, now); changes.push(`"${was}" -> "${now}"`) }
  }
  if (oldTypeLabel && typeLabel && oldTypeLabel !== typeLabel) {
    const rx = new RegExp(`\\b${oldTypeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    if (rx.test(out)) { out = out.replace(rx, typeLabel); changes.push(`type "${oldTypeLabel}" -> "${typeLabel}"`) }
  }
  return { text: out, changes }
}
