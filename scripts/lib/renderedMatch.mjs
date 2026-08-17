// ONE definition of "does this name appear where a reader can see it".
//
// OWNER RULING, 2026-08-17: rendered-text normalisation and complete-token alias matching live in
// one shared implementation, used by hover validation, URL classification, entity extraction,
// glossary generation, search indexing, the invariants and the migration simulation. No caller
// keeps its own approximation.
//
// THE RULING EXISTS BECAUSE FOUR APPROXIMATIONS WERE ALREADY IN THE TREE, and each was wrong in a
// different direction:
//
//   hoverValidation   folded punctuation to spaces, then called includes() — so "US" matched
//                     inside "becaUSe" until both sides were space-padded, and even then it read
//                     the STORED text, where `AT&amp;T` is not "AT&T" and `https:<em>//</em>` is
//                     not a URL. 46% of the corpus's links were invisible to it.
//   glossary          a `\b`-anchored regex over raw post text — a fifth coordinate system, and
//                     `\b` cannot express "Q+" because "+" is not a word character.
//   search            lowercase + whitespace collapse only. No boundary concept at all.
//   entity extraction whatever the original ingest did, which is how "God" became a certified
//                     entity in 47 drops that all say "Godfather III".
//
// THE TWO IDEAS THIS FILE HOLDS
//
//   1. RENDERED, NOT STORED. Every question is asked of `runtimeText()` — the string the browser
//      paints after board markup is stripped and HTML entities decoded. A check that reads the
//      stored representation does not fail; it passes, quietly, for everything.
//
//   2. A COMPLETE TOKEN, NOT A SUBSTRING. Punctuation is folded to spaces and both sides are
//      space-padded, so the space itself is the boundary. That works for multi-word aliases and
//      for aliases ending in punctuation, which is what `\b` cannot do. An alias found only
//      INSIDE a longer word is not a mention — it is an extraction defect, and this file can name
//      the word that produced it.
import { runtimeText } from './runtimeText.mjs'

export { runtimeText }

/**
 * Fold to space-delimited tokens, padded on both sides.
 *
 * Padding is not cosmetic. Without it, `includes(' us ')` fails at the start and end of the
 * string, and with it the space is a genuine boundary in both directions — including for a
 * multi-word alias, which no single regex boundary can express.
 *
 * `%20` and friends are dropped rather than folded to a space, because a URL spells a name as
 * `black%20lives%20matter` and that IS the name, escaped.
 */
export function foldTokens(s) {
  return ` ${String(s ?? '').toLowerCase().replace(/%[0-9a-f]{2}/gi, ' ').replace(/[^a-z0-9]+/g, ' ').trim()} `
}

/** Alias reduced to bare alphanumerics — for reporting a glued match, NEVER for deciding one. */
export function glue(s) {
  return String(s ?? '').toLowerCase().replace(/%[0-9a-f]{2}/gi, '').replace(/[^a-z0-9]+/g, '')
}

/**
 * Does `alias` appear as a COMPLETE TOKEN in `text`?
 *
 * `text` may be raw or already rendered — it is normalised here either way, so no caller can
 * reintroduce the coordinate-system bug by forgetting a conversion.
 */
export function completeTokenMatch(text, alias) {
  const needle = foldTokens(alias)
  if (needle.trim() === '') return false
  return foldTokens(runtimeText(text)).includes(needle)
}

/**
 * The longer words `alias` is buried inside, when it is NOT a complete token anywhere.
 *
 * This is the evidence behind an `invalid_substring_extraction` verdict, and it is deliberately
 * returned rather than reduced to a boolean: "God" is not a mention of God because the drop says
 * "Godfather III", and a reader deciding that needs the word, not a flag.
 *
 * Returns [] when the alias IS a complete token somewhere — a real mention is never also reported
 * as an embedded one.
 */
export function containingWords(text, alias) {
  const rendered = runtimeText(text)
  if (completeTokenMatch(rendered, alias)) return []
  const g = glue(alias)
  if (g.length < 2) return []
  const out = []
  for (const word of rendered.split(/\s+/)) {
    const gw = glue(word)
    if (gw && gw !== g && gw.includes(g)) out.push(word.slice(0, 80))
  }
  return [...new Set(out)]
}

/** Spans of `text` that are inside a URL. Entities matched only in here are not prose mentions. */
export function urlSpans(text) {
  const spans = []
  const rx = /\bhttps?:\/\/\S+|\bwww\.\S+/gi
  let m
  const src = runtimeText(text)
  while ((m = rx.exec(src)) !== null) spans.push([m.index, m.index + m[0].length, m[0]])
  return spans
}

/** Split a URL into the parts that mean different things. A domain is a publisher; a slug is not. */
export function urlParts(url) {
  const withoutScheme = String(url).replace(/^https?:\/\//i, '')
  const qIdx = withoutScheme.indexOf('?')
  const hostAndPath = qIdx === -1 ? withoutScheme : withoutScheme.slice(0, qIdx)
  const query = qIdx === -1 ? '' : withoutScheme.slice(qIdx + 1)
  const slashIdx = hostAndPath.indexOf('/')
  const host = slashIdx === -1 ? hostAndPath : hostAndPath.slice(0, slashIdx)
  const path = slashIdx === -1 ? '' : hostAndPath.slice(slashIdx)
  return { host, path, query }
}

/** Normalised hostname, or null. Scheme-less `www.x.com/y` links are links. */
export function hostnameOf(url) {
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try { return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}

/**
 * Where in a drop does this alias actually appear?
 *
 * Returns { inProse, inUrl, urlParts } — an alias found only inside URLs is a very different
 * thing from one Q wrote in a sentence, and the difference decides whether it should be painted
 * as prose at all.
 */
export function aliasLocation(text, alias) {
  const src = runtimeText(String(text ?? ''))
  const spans = urlSpans(src)
  const needle = foldTokens(alias)
  if (needle.trim() === '') return { inProse: false, inUrl: false, urlParts: [] }

  // Prose = everything outside the URL spans.
  let prose = ''
  let cursor = 0
  for (const [s, e] of spans) { prose += src.slice(cursor, s) + ' '; cursor = e }
  prose += src.slice(cursor)

  const inProse = foldTokens(prose).includes(needle)

  const parts = []
  for (const [, , url] of spans) {
    if (!foldTokens(url).includes(needle)) continue
    const { host, path, query } = urlParts(url)
    if (foldTokens(host).includes(needle)) parts.push('hostname')
    if (path && foldTokens(path).includes(needle)) parts.push('path')
    if (query && foldTokens(query).includes(needle)) parts.push('query')
  }
  return { inProse, inUrl: parts.length > 0, urlParts: [...new Set(parts)] }
}

/** The five URL classes, decided from where the match sits. */
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
 * A GLUED match — the brand run together with its domain, as in "Daily Beast" inside
 * `thedailybeast.com`.
 *
 * SEPARATE FROM completeTokenMatch ON PURPOSE, and never a substitute for it. Matching across
 * folded word boundaries is exactly how "US" starts matching inside "because"; the only reason it
 * is safe here is that the haystack is a single hostname rather than a drop of prose, and the
 * answer is reported to a human rather than acted on automatically.
 */
export function gluedHostMatch(host, alias) {
  const g = glue(alias)
  return g.length >= 4 && glue(host).includes(g)
}

/**
 * Complete-token regex for callers that need positions rather than a yes/no — the glossary's
 * post-list build, for one.
 *
 * DELIBERATELY IDENTICAL to `wordBoundaryPattern` in src/lib/highlightConstants.ts. The scripts and
 * the renderer must agree about where a term starts and ends, or the archive counts one thing and
 * paints another. `\b` is not used: "Q+" ends in a non-word character, so `\bq\+\b` never matches
 * it at all, and the boundary is applied conditionally for exactly that reason.
 *
 * WHAT THIS DOES NOT DO: it does not separate "Q" from "Q+". A boundary is about characters, and
 * "+" is not alphanumeric, so "Q" legitimately ends a token in "Q+". Keeping those two designations
 * apart is a question of IDENTITY, not of boundaries, and it is settled one layer up by
 * `normalizeItemKey`, where "+" counts as a word character (invariant 6). Trying to solve it here
 * would put two disagreeing answers in the tree, which is the thing this module exists to end.
 */
export function completeTokenRegex(token, { flags = '' } = {}) {
  const raw = String(token)
  const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lead = /[A-Za-z0-9]/.test(raw[0] ?? '') ? '(?<![A-Za-z0-9])' : ''
  const tail = /[A-Za-z0-9]/.test(raw[raw.length - 1] ?? '') ? '(?![A-Za-z0-9])' : ''
  return new RegExp(`${lead}${esc}${tail}`, flags)
}
