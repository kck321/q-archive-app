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

// THE MATCHING PRIMITIVES NOW LIVE IN ONE PLACE (owner ruling, 2026-08-17).
// This file used to carry its own copy of urlSpans/aliasLocation/classifyUrlDerived, and that copy
// was the one that read the STORED text. Re-exporting rather than reimplementing is the point:
// there is now exactly one answer to "can the reader see this name", and every caller gets it.
import { runtimeText, urlSpans, aliasLocation, classifyUrlDerived, completeTokenMatch, containingWords, URL_CLASS_MEANING } from './renderedMatch.mjs'

export { runtimeText, urlSpans, aliasLocation, classifyUrlDerived, completeTokenMatch, containingWords, URL_CLASS_MEANING }

/**
 * Validate one hover record against the CURRENT certified state.
 *
 * @returns { verdict: 'publish' | 'review' | 'no_visible_text_anchor' | 'quarantine' | 'withdrawn',
 *            reason, urlClass? }
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

  // THE READER MUST BE ABLE TO SEE THE WORD.
  //
  // A hover explains a term in a drop. If the term is nowhere in that drop — not in Q's prose, not
  // in a URL, not in quoted content — then the tooltip explains something invisible, and no amount
  // of good wording rescues it.
  //
  // This was found the hard way. Fixing the substring defect stopped 21 records matching inside
  // URLs, and they fell straight through to publish; the obvious reading was that they had been
  // wrongly quarantined and were genuine prose. They were not. None of the 21 contains its alias
  // as a complete token anywhere: 16 have no textual basis at all and 5 have only an image. The
  // certified mention behind them is real, but its wording is not visible in the text the reader
  // is looking at, so the explanation belongs to an editor rather than to the page.
  // Tested across EVERY alias of the entity, not just the one the audit happened to record. The
  // tooltip attaches to whichever spelling the renderer finds, so an entity written "HRC" in the
  // drop is visible even when the audit matched "Hillary Clinton". Testing matchedAlias alone
  // condemned 376 records whose entity is plainly on the page under another name.
  //
  // IT IS A RULING ABOUT THE TOOLTIP, NOT ABOUT THE OCCURRENCE (owner, 2026-08-16). These records
  // get their own verdict rather than being folded into ordinary review, because "an editor should
  // re-read this synopsis" and "there is no word on screen to hover" are different problems with
  // different remedies, and the second one says nothing at all about whether the mention is real.
  // Withdrawing the occurrence because a tooltip cannot render would be the inference the ruling
  // forbids.
  const quoted = ctx.quotedText?.get(rec.postNum) ?? ''
  const visible = [...aliases].some(a => {
    const t = entity.aliases.find(x => x.text.toLowerCase() === a)?.text ?? a
    return aliasLocation(postText.get(rec.postNum) ?? '', t).inProse || aliasLocation(quoted, t).inProse
  })
  if (!visible && !loc.inUrl) {
    return { verdict: 'no_visible_text_anchor', reason: 'no spelling of this entity appears in the drop — not in the prose, a URL, or quoted content' }
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
