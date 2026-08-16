// The deterministic apply chain — the ONLY copy of this ordering.
//
// The Firestore dump in export-firestore.mjs overwrites posts.json wholesale. Everything below
// rebuilds the certified analysis on top of that raw dump, reading canonical artifacts under
// audit/ rather than post text. None of it touches Firestore, so it can be re-run on its own
// (see rebuild-bundle.mjs) when the export is blocked by quota.
//
// The order is load-bearing and every step is required. The failures that got through were never
// wrong counts — they were dropped steps that silently reverted a section to its old extractor
// output while every total still looked right:
//
//   apply-questions.mjs        rebuilds the certified 6,299 base from audit/questions-final.json
//   apply-questions-final.mjs  layers on the 143 the uncovered-"?" audit recovered -> 6,442
//                              (drop it and the live count silently reverts to 6,299)
//   apply-directives.mjs       rewrites actionRequests from the certified set; must land after
//                              the earlier steps that also rewrite posts.json
//   apply-claims.mjs           reads audit/claims-final.json, so it must land on top of
//                              apply-directives.mjs (drop it -> Claims reverts to 7,509)
//   audit-emphasis.mjs         the caps detector excludes certified codes and entity names, so it
//   apply-emphasis.mjs         must read those AFTER they are rebuilt; apply-emphasis replaces the
//                              legacy detect-emphasis.mjs output produced earlier in this chain
//   apply-context-units.mjs    last of the analysis steps — a partial run that stops before it
//                              leaves contextUnits empty on all 4,966 posts, which is exactly how
//                              the quota-killed export of 2026-08-14 corrupted the bundle
//
// Two kinds of step, and the difference decides whether a rebuild may run it
// ──────────────────────────────────────────────────────────────────────────
//   derive   re-reads public/data/posts.json and REGENERATES a canonical artifact under audit/
//   apply    reads a canonical artifact and rebuilds the derived cache in public/data/
//
// A derive step is only correct when posts.json carries genuinely new input — i.e. straight
// after a Firestore dump. Re-running one on an already-built bundle re-derives a certified
// artifact FROM the cache that artifact produced, which is the same inversion as writing an
// editorial ruling into postAnalysis.
//
// That is not hypothetical. audit-entities.mjs reads postAnalysis.namedEntities (line 119) and
// apply-entities.mjs writes that very field (line 296). Re-deriving on 2026-08-14 pulled stored
// code names ("RED October", "Iran deal") into the entity set and produced 1,333 canonical
// entities against the certified 1,332, with 7,938 mentions against 7,903. Restoring the
// committed adjudication artifacts and running apply-entities alone reproduced 1,332 exactly.
//
// So rebuild-bundle.mjs runs the apply steps only. The export runs everything, because after a
// dump there IS new input — and the certification gate is what decides whether what came back
// may ship.
//
// Ordering below is load-bearing and every step is required. The failures that got through were
// never wrong counts — they were dropped steps that silently reverted a section to its old
// extractor output while every total still looked right:
//
//   apply-questions.mjs        rebuilds the certified 6,299 base from audit/questions-final.json
//   apply-questions-final.mjs  layers on the 143 the uncovered-"?" audit recovered -> 6,442
//                              (drop it and the live count silently reverts to 6,299)
//   apply-directives.mjs       rewrites actionRequests from the certified set; must land after
//                              the earlier steps that also rewrite posts.json
//   apply-claims.mjs           reads audit/claims-final.json, so it must land on top of
//                              apply-directives.mjs (drop it -> Claims reverts to 7,509)
//   audit-emphasis.mjs         the caps detector excludes certified codes and entity names, so it
//   apply-emphasis.mjs         must read those AFTER they are rebuilt; apply-emphasis replaces the
//                              legacy detect-emphasis.mjs output produced earlier in this chain
//   apply-context-units.mjs    last of the analysis steps — a partial run that stops before it
//                              leaves contextUnits empty on all 4,966 posts, which is exactly how
//                              the quota-killed export of 2026-08-14 corrupted the bundle
//
// Every apply step is idempotent: running them twice produces the same bundle.
export const CHAIN = [
  { step: 'backfill-analysis.mjs', kind: 'apply' },
  { step: 'detect-emphasis.mjs', kind: 'apply' },
  { step: 'apply-questions.mjs', kind: 'apply' },
  { step: 'apply-questions-final.mjs', kind: 'apply' },
  { step: 'apply-directives.mjs', kind: 'apply' },
  { step: 'apply-claims.mjs', kind: 'apply' },
  { step: 'audit-evidence.mjs', kind: 'derive' },
  { step: 'apply-evidence.mjs', kind: 'apply' },
  { step: 'audit-entities.mjs', kind: 'derive' },
  { step: 'adjudicate-entities-tail.mjs', kind: 'derive' },
  { step: 'adjudicate-entities-other.mjs', kind: 'derive' },
  { step: 'adjudicate-entities-lowconf.mjs', kind: 'derive' },
  { step: 'resolve-entity-context.mjs', kind: 'derive' },
  { step: 'apply-entities.mjs', kind: 'apply' },
  { step: 'audit-themes.mjs', kind: 'derive' },
  { step: 'apply-themes.mjs', kind: 'apply' },
  { step: 'audit-codes.mjs', kind: 'derive' },
  { step: 'adjudicate-codes.mjs', kind: 'derive' },
  { step: 'apply-codes.mjs', kind: 'apply' },
  { step: 'audit-emphasis.mjs', kind: 'derive' },
  { step: 'apply-emphasis.mjs', kind: 'apply' },
  { step: 'build-resolution-queue.mjs', kind: 'apply' },
  { step: 'materialize-evidence-literals.mjs', kind: 'apply' },
  { step: 'materialize-literal-spans.mjs', kind: 'apply' },
  { step: 'apply-context-units.mjs', kind: 'apply' },
  { step: 'build-relationships.mjs', kind: 'apply' },
  { step: 'build-search-index.mjs', kind: 'apply' },
  // Last, and read-only: the reader's acronym info box is derived from the finished entity set
  // plus the owner's non-entity glosses. It is a display artifact — nothing downstream reads it,
  // and it moves no count.
  { step: 'build-glossary.mjs', kind: 'apply' },
]

export const CHAIN_STEPS = CHAIN.map(c => c.step)
export const APPLY_STEPS = CHAIN.filter(c => c.kind === 'apply').map(c => c.step)
