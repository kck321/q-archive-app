// Shared loading + matching for the 2026-08-16 sentence-level Predictions audit.
//
// Record identity is POST_NUMBER + normalised sentence — the audit supplies no stable record
// id (APP_RECORD_ID is just the post number), and predictions have never carried one. Matching
// is therefore scoped to a single post, which is what makes it safe: 630 predictions spread
// over 520 posts, so a post holds a handful of candidates at most.
//
// NEVER deduplicate by sentence alone. Repeated wording in different posts stays separate —
// "Future proves past." is 40+ independent rows and must remain so.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { key } from './segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const AUDIT_DIR = path.join(ROOT, 'audit', 'predictions-audit')

export const PHASE_FILES = {
  P1: 'p1-technical-nonpredictions.json',
  P2: 'p2-arguable-current.json',
  P3: 'p3-fragment-replacements.json',
  P4: 'p4-claims-to-predictions.json',
  P5: 'p5-missing-additions.json',
  R1: 'r1-arguable-claim-moves.json',
  R2: 'r2-possible-missing.json',
  R3: 'r3-posts-4954-4966.json',
}

export function loadPhase(phase) {
  const file = path.join(AUDIT_DIR, PHASE_FILES[phase])
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** Identity key for a stored row: post + normalised sentence. The ONLY dedupe rule. */
export const rowKey = (postNum, text) => `${postNum}|${key(text)}`

// The audit was transcribed from a plain-text report, so its quotation marks, ellipses and
// dashes are not guaranteed to be byte-identical to Q's wording in the corpus. `key()` already
// strips every non-alphanumeric, which absorbs all of that. What it does NOT absorb is a
// trailing clause the report dropped, so an exact key match is tried first and a containment
// match second — reported separately, never silently.
export function matchOne(record, candidates) {
  const want = key(record.match)
  if (!want) return { status: 'empty-match' }

  const exact = candidates.filter(c => key(c.exactText) === want)
  if (exact.length) return { status: 'exact', hit: exact[0], ambiguous: exact.length > 1, count: exact.length }

  const contains = candidates.filter(c => {
    const have = key(c.exactText)
    return have.includes(want) || want.includes(have)
  })
  if (contains.length === 1) return { status: 'contains', hit: contains[0], count: 1 }
  if (contains.length > 1) return { status: 'ambiguous', candidates: contains, count: contains.length }

  return { status: 'miss' }
}

/** Group rows by post number for per-post matching. */
export function byPost(rows) {
  const m = new Map()
  for (const r of rows) {
    if (!m.has(r.postNum)) m.set(r.postNum, [])
    m.get(r.postNum).push(r)
  }
  return m
}

// ─── The transform ────────────────────────────────────────────────────────────
// Called by apply-claims.mjs BETWEEN reading audit/claims-final.json and writing posts.json,
// so the rulings survive a re-derivation of the claims artifact the same way the themes and
// entities owner rulings do. Pure: takes the certified rows and returns new ones.
//
// Every match is CONSUMED. Two records can name the same wording on the same post (#4 and #6
// each carry a claim and a longer claim containing it), and a pass that matched by text alone
// would apply both records to whichever row it found first, silently dropping one.
const PROVENANCE = 'predictions audit 2026-08-16'

const mark = r => `${r.phase}#${r.n}`

export function applyPredictionsAudit({ rows, predictions }) {
  const ledger = []
  const log = (rec, phase, requested, actual, result, extra = {}) =>
    ledger.push({ batch: rec.batch, phase, post: rec.post, record: rec.n,
      recordId: rec.post, requested, actual, result, ...extra })

  let claims = rows.map(r => ({ ...r }))
  let preds = predictions.map(r => ({ ...r }))

  const consumed = new Set()
  const take = (pool, rec, kind) => {
    const want = key(rec.match)
    const hit = pool.find(r => r.postNum === rec.post && key(r.exactText) === want && !consumed.has(r))
    if (!hit) return null
    consumed.add(hit)
    return hit
  }

  const phase = p => loadPhase(p)?.records ?? []
  const report = { p1Moved: 0, p1MovedDuplicate: 0, p1Removed: 0, p2Excluded: 0, p3Replaced: 0,
    p4ClaimsRemoved: 0, p4Added: 0, p4Duplicate: 0, p5Added: 0, p5Duplicate: 0, errors: [] }

  // ── P4 first: claims leave before P1 puts new ones in, so a move can never be undone by a
  // removal it never referred to. (The two phases touch disjoint posts today; this keeps that
  // from being load-bearing.)
  const p4 = phase('P4')
  const p4Hits = new Map()
  for (const rec of p4) {
    const hit = take(claims, rec, 'claims')
    if (!hit) { report.errors.push(`P4#${rec.n} #${rec.post}: claim not found`); log(rec, 'P4', 'remove claim + add prediction', 'not found', 'error'); continue }
    p4Hits.set(rec.n, hit)
  }
  claims = claims.filter(r => !consumed.has(r))
  report.p4ClaimsRemoved = p4Hits.size

  // ── P1: technical nonpredictions leave Predictions; 47 land in Claims, 26 go.
  for (const rec of phase('P1')) {
    const hit = take(preds, rec, 'predictions')
    if (!hit) { report.errors.push(`P1#${rec.n} #${rec.post}: prediction not found`); log(rec, 'P1', rec.action, 'not found', 'error'); continue }
    if (rec.action === 'move-to-claims') {
      // "without creating a duplicate Claim" — post + normalised sentence, never sentence alone.
      const already = claims.some(c => c.postNum === rec.post && key(c.exactText) === key(hit.exactText))
      if (already) {
        report.p1MovedDuplicate++
        log(rec, 'P1', 'move to Claims', 'removed from Predictions; Claims already held this sentence for this post', 'duplicate')
      } else {
        claims.push({
          postNum: hit.postNum, postId: hit.postId, exactText: hit.exactText,
          primaryClass: 'claim', isPrediction: false,
          isConclusion: Boolean(hit.isConclusion), checkable: Boolean(hit.checkable),
          sourceProvided: Boolean(hit.sourceProvided), telegraphic: false,
          entities: hit.entities ?? [], themes: hit.themes ?? [],
          confidence: hit.confidence,
          provenance: { origin: PROVENANCE, phase: 'P1', batch: rec.batch, record: rec.n, reason: rec.reason },
          source: 'predictions-audit',
        })
        report.p1Moved++
        log(rec, 'P1', 'move to Claims', 'removed from Predictions, added to Claims', 'changed')
      }
    } else {
      report.p1Removed++
      log(rec, 'P1', 'remove', 'removed from Predictions', 'changed')
    }
  }

  // ── P2: arguable rows leave the active high-confidence list, preserved in the backlog.
  for (const rec of phase('P2')) {
    const hit = take(preds, rec, 'predictions')
    if (!hit) { report.errors.push(`P2#${rec.n} #${rec.post}: prediction not found`); log(rec, 'P2', 'exclude to review', 'not found', 'error'); continue }
    report.p2Excluded++
    log(rec, 'P2', 'exclude from active high-confidence; retain for review', 'removed from active Predictions, written to review backlog', 'changed')
  }

  preds = preds.filter(r => !consumed.has(r))

  // ── P3: the fragment keeps Q's wording as its anchor and gains a readable sentence.
  for (const rec of phase('P3')) {
    const want = key(rec.match)
    const hit = preds.find(r => r.postNum === rec.post && key(r.exactText) === want && !consumed.has(r))
    if (!hit) { report.errors.push(`P3#${rec.n} #${rec.post}: prediction not found`); log(rec, 'P3', 'replace with complete sentence', 'not found', 'error'); continue }
    consumed.add(hit)
    hit.plainSentence = rec.sentence
    hit.fragmentType = rec.fragmentType
    hit.provenance = { ...(hit.provenance ?? {}), completeSentence: PROVENANCE, phase: 'P3', batch: rec.batch, record: rec.n }
    report.p3Replaced++
    log(rec, 'P3', 'replace displayed text with complete sentence', 'plainSentence set; Q\'s wording preserved as exactText', 'changed')
  }

  // ── Additions. Dedupe key is post + normalised COMPLETE SENTENCE, and additionally post +
  // anchor, so a sentence already carried by a surviving row is never doubled.
  const find = (post, text) => preds.find(r => r.postNum === post &&
    (key(r.exactText) === key(text) || key(r.plainSentence ?? '') === key(text)))
  const has = (post, text) => Boolean(find(post, text))

  // When two occurrences collapse to one prediction (#4 and #6 each contribute a row and a
  // longer row containing it), the survivor inherits the attributes of BOTH. Discarding the
  // loser's flags would make the result depend on which record happened to be processed
  // first — and it did: the longer row on each post was the conclusion-bearing one, so a
  // plain skip retired two certified Implied Conclusions by accident of ordering.
  const mergeAttributes = (into, src) => {
    if (!src) return
    into.isConclusion = Boolean(into.isConclusion || src.isConclusion)
    into.conclusionReason = into.conclusionReason ?? src.conclusionReason ?? null
    into.checkable = Boolean(into.checkable || src.checkable)
    into.sourceProvided = Boolean(into.sourceProvided || src.sourceProvided)
  }

  const addition = (rec, phaseId, anchor, src) => ({
    postNum: rec.post, postId: String(rec.post), exactText: anchor,
    primaryClass: 'prediction', klass: 'Q_PREDICTION',
    // isConclusion is an ATTRIBUTE of the row, not a property of the section it is filed
    // under, so it MOVES WITH the row. Forcing it false here silently retired 15 certified
    // Implied Conclusions — the count is derived from the attribute, so dropping the
    // attribute deletes the population.
    isConclusion: src ? Boolean(src.isConclusion) : false,
    conclusionReason: src?.conclusionReason ?? null,
    checkable: src ? Boolean(src.checkable) : true,
    sourceProvided: src ? Boolean(src.sourceProvided) : false,
    entities: src?.entities ?? [], themes: src?.themes ?? [],
    confidence: 'AUDIT_HIGH_CONFIDENCE',
    plainSentence: rec.sentence,
    provenance: { origin: PROVENANCE, phase: phaseId, batch: rec.batch, record: rec.n, reason: rec.why },
  })

  for (const rec of p4) {
    const src = p4Hits.get(rec.n)
    if (!src) continue
    const twin = find(rec.post, rec.sentence)
    if (twin) {
      mergeAttributes(twin, src)
      report.p4Duplicate++
      log(rec, 'P4', 'add prediction', 'Claims occurrence removed; sentence already present for this post, attributes merged into it', 'duplicate')
      continue
    }
    preds.push(addition(rec, 'P4', src.exactText, src))
    report.p4Added++
    log(rec, 'P4', 'remove Claims occurrence; add prediction', 'claim removed, prediction added', 'changed')
  }

  for (const rec of phase('P5')) {
    if (has(rec.post, rec.sentence)) {
      report.p5Duplicate++
      log(rec, 'P5', 'add missing prediction', 'already present for this post and sentence', 'duplicate')
      continue
    }
    preds.push(addition(rec, 'P5', rec.match, null))
    report.p5Added++
    log(rec, 'P5', 'add missing prediction', 'added', 'changed')
  }

  // R1, R2, R3 apply nothing by design; they are logged so the ledger accounts for all 403.
  for (const [p, verb] of [['R1', 'review only; do not auto-move'], ['R2', 'review only; do not auto-add'], ['R3', 'evidence only; zero additions']]) {
    for (const rec of phase(p)) log(rec, p, verb, 'recorded in review backlog; active list unchanged', 'review')
  }

  preds.sort((a, b) => a.postNum - b.postNum)
  claims.sort((a, b) => a.postNum - b.postNum)
  return { rows: claims, predictions: preds, report, ledger }
}
