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
// A DERIVE STEP IS A RE-CERTIFICATION, AND A DEPLOY MAY NOT PERFORM ONE (seed 76, 2026-08-16)
// ──────────────────────────────────────────────────────────────────────────────────────────
// The note above already knew derive steps were dangerous on a BUILT bundle. It was still wrong
// about the other half: they are not safe after a dump either, and the reason has nothing to do
// with the input.
//
// A derive step re-runs TODAY's detector to produce a certified artifact. The artifacts under
// audit/ were produced by the detector as it stood the day each section was certified. So every
// export was quietly re-certifying every section against a codebase that had moved underneath it.
// That is not "picking up new input" — it is an unreviewed re-adjudication inside a deploy.
//
// It surfaced on 2026-08-16. audit/entities-audit.json was certified 2026-08-12. The quoted-block
// boundary fix landed in lib/quotedBlocks.mjs at seed 72, 2026-08-16. Re-deriving flipped 18
// entity occurrences from "inside quoted source" to "Q-authored":
//
//     certified   9,786 mentions      re-derived   9,804      (+18, zero removed)
//
// Proven by substitution, not inferred: with the pre-seed-72 quotedBlocks.mjs restored,
// audit-entities.mjs reproduces the certified artifact exactly — 0 occurrences added, 0 removed.
// The full list is audit/entities-quote-boundary-pending.json, and it is a MIXED set that only the
// owner can rule on. #1939 "[19] phone calls today - DC/UK/AUS panic?" and #2208 "DECLAS FISA >>
// [RR] FORCE >> RED LINE" are unmistakably Q's own lines that the old detector swallowed — exactly
// the over-extension KNOWN_DEBT names. But #1553, #1881 and #3089 are pasted news copy, where the
// OLD boundary was right and the new one admits quoted source as Q-authored. A deploy cannot split
// that, and contracts.mjs already rules it: the adjudicated dataset outranks the detector, and a
// source-material re-audit is a prerequisite, not a side effect.
//
// apply-entities.mjs refused to write, which is the gate working. But the only way past it was
// SKIP_EXPORT=1, so the protection had made the ordinary pipeline unrunnable.
//
// THE DEPLOY PATH NOW RUNS APPLY STEPS ONLY. Re-derivation is deliberate and opt-in:
//
//     node scripts/rederive-certified.mjs          report what would change, adopt nothing
//     node scripts/rederive-certified.mjs --adopt  after an owner ruling, with re-certification
//
// The one protection the derive steps incidentally provided is kept and made explicit instead:
// if the dump brings CHANGED POST TEXT, apply-only would rebuild every certified section against
// text that no longer says what it said when the section was certified, and every count would
// still reconcile. lib/postTextFingerprint.mjs stops the export in that case and names the drops.
//
// Every apply step is idempotent: running them twice produces the same bundle.
export const CHAIN = [
  { step: 'backfill-analysis.mjs', kind: 'apply' },
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
  // EMPHASIS IS RETIRED (owner ruling, 2026-08-21). detect-emphasis.mjs, audit-emphasis.mjs and
  // apply-emphasis.mjs are out of the chain: a step that rebuilds a retired section is a step that
  // silently un-retires it on the next export. The scripts are kept on disk for provenance —
  // nothing calls them.
  { step: 'build-resolution-queue.mjs', kind: 'apply' },
  { step: 'materialize-evidence-literals.mjs', kind: 'apply' },
  { step: 'materialize-literal-spans.mjs', kind: 'apply' },
  { step: 'apply-context-units.mjs', kind: 'apply' },
  // THE CERTIFIED ENTITY STATE, RE-MATERIALISED. apply-entities.mjs rebuilds Entities from
  // audit/entities-audit.json, which is the adjudication as it stood BEFORE the 2026-08-17
  // integrated cleanup — so without this step a rebuild puts 1,409 rows and 9,749 mentions back and
  // build-search-index.mjs refuses at its QA gate. The bundle was reproducible only by hand, which
  // means it was not reproducible.
  //
  // It runs LAST among the steps that write entities.json or posts.json and FIRST among the ones
  // that read entity counts, and it re-applies the plan the owner already approved rather than
  // deciding anything: see the --rematerialise block in the applier.
  // THE PROVENANCE AUDIT MUST BE MEASURED HERE, immediately before the cleanup and never after.
  //
  // apply-entity-cleanup refuses to replay unless the audit it reads covers exactly the occurrence
  // count in the tree, and the tree it is meant to act on is the PRE-cleanup one. Run on the
  // finished bundle the audit records the post-cleanup totals, so the next rebuild refuses with
  // "the audit covers N occurrences but M are certified" - which is what happened on 2026-08-24,
  // twice, and had to be fixed by hand both times. It is also the measurement every
  // postApprovalDeltas entry cites as its evidence, so it has to be taken at the point the delta
  // describes.
  // kind 'apply' with no args: it is a measurement, but only steps marked 'apply' are actually
  // invoked by rebuild-bundle.mjs, and this one has to run. It takes no --apply flag.
  { step: 'audit-occurrence-provenance.mjs', kind: 'apply', args: [] },
  { step: 'apply-entity-cleanup.mjs', kind: 'apply', args: ['--rematerialise'] },
  // STEP 3B-1 — THE FULL-SENTENCE REPLACEMENT. It must run here and it must not be dropped.
  //
  // The 530 adjudicated actions resolve sentences certified in two primary categories at once,
  // collapse same-category fragments, merge duplicate occurrence records and turn context
  // collisions into review dispositions. Every one of those edits lands on an array that an
  // EARLIER step in this chain rebuilds from a pre-ruling artifact — apply-questions,
  // apply-directives, apply-claims, apply-emphasis, apply-context-units and
  // apply-entity-cleanup all write arrays it edits. So it runs after the last of them, and
  // before build-relationships / build-search-index, which read the finished counts.
  //
  // Drop it and the bundle silently reverts 530 resolved collisions while every total still
  // reconciles — the exact failure shape this chain's header describes.
  { step: 'apply-step3b1.mjs', kind: 'apply' },
  // THE VERSE BLOCKS (owner ruling 2026-08-23). A quoted passage of scripture is ONE Directive
  // over the whole passage, and the reference label beside it is an Entity.
  //
  // It runs HERE for the same reason apply-step3b1.mjs does: every array it edits — actionRequests,
  // directiveFamilies, directiveMeta, postAnalysis.claims, claimSpans, claimMeta — is rebuilt from a
  // pre-ruling artifact by an earlier step, so anything sooner is silently overwritten on the next
  // export. And it runs BEFORE reconcile-entity-registry.mjs and build-entity-public-view.mjs,
  // which read the finished entity state: the 10 citation identities have to be part of what those
  // two reconcile and publish, not an addition made behind their backs.
  { step: 'apply-scripture-blocks.mjs', kind: 'apply' },
  // THE REGISTRY FOLLOWS THE RECORDS. apply-step3b1.mjs collapses duplicate entity records — 99 of
  // them, several over one span for one identity — and entities.json never heard about it, so the
  // registry counted 8,920 mentions while the drops rendered 8,821. Invariant 12 exists for exactly
  // that gap and had been failing at 99 since the merges landed. This applies the EXACT decrements
  // the adjudication recorded and refuses unless the two totals then agree.
  { step: 'reconcile-entity-registry.mjs', kind: 'apply' },
  // THE PUBLIC ROW MODEL, derived from the FINISHED entity state — which is here, not before
  // apply-step3b1.mjs where it used to sit. It reads entities.json to decide which identities are
  // prose rows and which are source-only, and until the duplicate collapse and its reconciliation
  // had both run, "finished" was not true: the view was built from a registry 99 mentions ahead of
  // the records it describes.
  //
  // Read-only with respect to every certified count: it writes one new artifact and asserts, rather
  // than assumes, that its own components add up and that its per-entity occurrence counts never
  // exceed the certified total. It exits non-zero instead of publishing a list that does not
  // reconcile.
  { step: 'build-entity-public-view.mjs', kind: 'apply', args: [] },
  // A TOOLTIP MUST NOT OUTLIVE THE IDENTITY IT DESCRIBES. entity-hovers.json carries authored
  // editorial text about real people, and a retired identity left 26 synopses pointing at nothing.
  // Runs after the entity state is final and before the steps that read it.
  // ONE SHAPE FOR EVERY HOVER, and it has to be in the chain or a rebuild ships 52 entities with no
  // tooltip at all. It reads its type vocabulary and its expansion clauses from the FROZEN authored
  // layer (audit/entity-hovers-authored.json), never from the file it writes, which is what makes
  // running it every rebuild safe. It takes no --apply flag.
  { step: 'normalise-entity-hovers.mjs', kind: 'apply', args: [] },
  // AND THE OWNER LAYER ON TOP OF IT, or the rebuild above reverts every ruling about a hover.
  //
  // normalise-entity-hovers.mjs writes one generated sentence per entity from the certified
  // record. That is right for the 1,584 rows nobody has ruled on and wrong for the ones somebody
  // has: Nellie Ohr's authored synopsis had been silently replaced by "“Nellie Ohr” is a person in
  // this archive." on every rebuild since, because this step was never in the chain and was only
  // ever run by hand. It also carries the owner's post-scoped readings — what "Q" means on the 73
  // drops that inherit the Q = Alice equation rather than stating it.
  //
  // Idempotent, and it refuses rather than half-apply: an id that no longer resolves to the entity
  // the ruling names stops the run instead of attaching the wording to nothing.
  { step: 'apply-entity-synopses.mjs', kind: 'apply' },
  { step: 'prune-entity-hovers.mjs', kind: 'apply' },
  // THE RETIRED SECTIONS, STRIPPED. apply-claims.mjs rebuilds impliedConclusions and
  // verificationHooks from audit/claims-final.json on every run, so removing them by hand would
  // last exactly until the next rebuild. This runs after the last step that writes them and before
  // the two that read the finished counts, so nothing downstream ever sees a retired section.
  { step: 'retire-sections.mjs', kind: 'apply' },
  { step: 'build-relationships.mjs', kind: 'apply' },
  { step: 'build-search-index.mjs', kind: 'apply' },
  // Last, and read-only: the reader's acronym info box is derived from the finished entity set
  // plus the owner's non-entity glosses. It is a display artifact — nothing downstream reads it,
  // and it moves no count.
  { step: 'build-glossary.mjs', kind: 'apply' },
]

/**
 * Every step, in order. This is the RE-CERTIFICATION chain, not the deploy chain — the only
 * caller is rederive-certified.mjs, which runs it in an isolated copy and reports the deltas.
 */
export const CHAIN_STEPS = CHAIN.map(c => c.step)

/** The deploy chain. export-firestore.mjs and rebuild-bundle.mjs both run exactly this. */
export const APPLY_STEPS = CHAIN.filter(c => c.kind === 'apply').map(c => c.step)

/**
 * The same chain WITH each step's arguments.
 *
 * Every step used to take a bare `--apply`, and both callers hardcoded it. One step now needs a
 * different word — the entity cleanup re-materialises rather than re-deciding — and a chain where
 * the arguments live at the call site is a chain with two copies of a load-bearing detail, which is
 * exactly the shape that let a step go missing from one path before.
 */
export const APPLY_INVOCATIONS = CHAIN.filter(c => c.kind === 'apply')
  .map(c => ({ step: c.step, args: c.args ?? ['--apply'] }))

/** The re-certification steps, kept out of the deploy path. See the note above. */
export const DERIVE_STEPS = CHAIN.filter(c => c.kind === 'derive').map(c => c.step)
