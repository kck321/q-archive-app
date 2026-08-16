// The single write chokepoint for editorial tooling.
//
//     owner approval -> canonical certified artifact -> materialisers -> postAnalysis -> UI
//
// The first owner-approved Claims batch was written straight into
// public/data/posts.json -> postAnalysis.claims. That field is a DERIVED CACHE: apply-claims.mjs
// rebuilds it from audit/claims-final.json, so the next chain run would have erased all seven
// rulings with no error anywhere. The rule existed in a comment hours earlier and was broken by
// the person who wrote it.
//
// So it is enforced structurally instead, and it lives HERE rather than inside one script:
// Themes, Entities, Directives and Codes all still need batch apply. A rule reimplemented four
// more times is a rule whose fifth copy omits it. One chokepoint, tested once
// (scripts/test-certified-write-guard.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Canonical artifacts an editorial batch may write. Nothing else, ever. */
export const CANONICAL_WRITE_ALLOWLIST = [
  'audit/claims-final.json',
  'audit/themes-audit.json',
  'audit/editorial-batch-pending.json',
  'audit/editorial-batch-applied.json',
]

export class CertifiedWriteRefused extends Error {
  constructor(message, rel) {
    super(message)
    this.name = 'CertifiedWriteRefused'
    this.rel = rel
  }
}

const relOf = target =>
  path.relative(ROOT, path.resolve(ROOT, target)).split(path.sep).join('/')

/**
 * Decide whether `target` may receive an editorial write. Returns the repo-relative path,
 * or throws CertifiedWriteRefused. Pure — performs no I/O, so it is safe to call in a test.
 */
export function assertCertifiedPath(target) {
  const rel = relOf(target)

  // A derived cache is refused on its own terms, before the allowlist is consulted, so the
  // failure names the actual mistake rather than "not on the list".
  if (/^public\/data\//.test(rel) || /postAnalysis/i.test(rel)) {
    throw new CertifiedWriteRefused(
      `REFUSED: ${rel} is a derived cache, not a certified source.\n` +
      '  Editorial rulings go to a canonical artifact; materialisers rebuild the cache.\n' +
      '  See audit/CHATGPT-CLAUDE-HANDOFF.md — the batch that broke this rule.',
      rel,
    )
  }
  if (!CANONICAL_WRITE_ALLOWLIST.includes(rel)) {
    throw new CertifiedWriteRefused(`REFUSED: ${rel} is not on the canonical write allowlist.`, rel)
  }
  return rel
}

/**
 * Write an editorial result to a canonical artifact, or refuse.
 *
 * `data` as a string is written verbatim; anything else is serialised with `space`. Existing
 * artifacts were written with an indent of 1, so callers pass the indent their artifact already
 * uses — a reformat would read as drift in the frozen-section hash check.
 */
export function writeCertifiedArtifact(target, data, { space = 2 } = {}) {
  let rel
  try {
    rel = assertCertifiedPath(target)
  } catch (err) {
    if (err instanceof CertifiedWriteRefused) console.error(`\n  ${err.message}\n`)
    throw err
  }
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, space)
  fs.writeFileSync(path.resolve(ROOT, target), body)
  return rel
}
