// THE CANONICAL QUESTION-IDENTITY REGISTRY.
//
// A question's id is PERMANENT and lives in identity/question-identity-registry.json, which is
// source-controlled and reviewed. public/data/questions.json is generated output; it is no longer
// the thing that remembers what a question is called.
//
// WHY THIS EXISTS
// ───────────────
// Until seed 116 the id of a question was decided by whichever questions.json happened to be on
// disk when the chain ran, with a positional counter as the fallback:
//
//     id: prior?.id ?? mkId()          // mkId() = `qc-${(++nextId).toString(36)}`
//
// `prior` came from public/data/questions.json — which is the chain's OWN previous output on a
// rebuild, and the raw Firestore dump on an export. Those two baselines do not agree, so the same
// certified question came out with different ids depending on which path produced the bundle.
//
// Measured on the seed-116 tree, a real export moved 23 rows:
//
//   #1915 and #1944 legitimately match Firestore documents 5n1ZTUuUTW8PKpvHTk1Z and
//   nZW8pYgbnneY3vmbsfOJ, so they adopt those ids and consume two fewer counter values. Every
//   qc-* minted after them then shifts down by two — qc-d becomes qc-b, qc-h becomes qc-f, and
//   #2782's CalMatters row surrenders qc-h to #2989. The three bf-* rows shift for the same
//   reason from their own counter.
//
// That is not cosmetic. apply-step3b1.mjs records its demotions keyed on these ids and applies
// them by id at the end of the chain, and materialize-literal-spans.mjs pins five of them by
// name. A shifted id lands a reviewed ruling on a question nobody ruled on, and every total still
// looks plausible afterwards.
//
// WHAT A SIGNATURE IS, AND WHAT IT IS NOT
// ───────────────────────────────────────
// The registry is the identity authority. A signature is only the WITNESS used to find a registry
// entry — reviewed evidence, not the identity itself, and never the id.
//
// The id is NOT derived from the text. It cannot be, because editorial text is repairable:
// audit/abbreviation-span-repairs.json rewrites the wording of questions the sentence splitter cut
// short, and a text-derived id would rename the row every time that happened. That is precisely
// the failure this file removes.
//
// So when an approved repair changes a question's wording the build STOPS. The canonical id does
// not move; a reviewed amendment (scripts/amend-question-signature.mjs) adds the new wording as a
// second accepted signature on the SAME entry, and the old signature is kept as historical
// identity evidence. Nothing here ever silently mints a replacement id.
//
//     canonical id  →  permanent registry entry  →  one or more accepted signatures  →  aliases
//
// A later project may add true parser-derived source offsets and immutable source-segment ids and
// migrate the matching evidence onto them. That will not rename a single canonical id, which is
// the whole point of keeping identity and evidence in separate layers.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const SCHEMA_VERSION = 1
export const SIGNATURE_VERSION = 1
export const REGISTRY_RELPATH = path.join('identity', 'question-identity-registry.json')
export const UNREGISTERED_RELPATH = path.join('audit', 'question-identity-unregistered.jsonl')

/** THE SIGNATURE CANONICALISATION RULES. Changing any of these invalidates every signature.
 *
 *  - UTF-8 throughout.
 *  - Line endings: CRLF and lone CR both become LF, so a file checked out on Windows and one
 *    checked out on Linux sign identically. (core.autocrlf=true rewrites audit/*.json on
 *    checkout; that must never be able to move a question's identity.)
 *  - Unicode: NFC. Q's drops carry composed accents and curly quotes; a decomposed copy of the
 *    same wording is the same wording.
 *  - EXACT otherwise. No lowercasing, no punctuation collapsing, no whitespace squeezing, no
 *    trimming. lib/segment.mjs `key()` does all of those and is the right tool for FINDING a
 *    row; it is the wrong tool for deciding a row's identity, because it maps "Define." and
 *    "DEFINE?" onto one another.
 */
export const canonicaliseText = t => String(t ?? '').replace(/\r\n?/g, '\n').normalize('NFC')

/** The signature of a candidate. postId is the immutable drop id; text is the exact span.
 *
 *  Deliberately excluded: the canonical id itself (a signature that contained it could never
 *  detect a shifted id), status, semanticFunction, grammaticalForm, certified, createdAt,
 *  infographId and every other mutable classification field, and every array — occurrence
 *  collections included — so that discovery order can never reach the hash.
 */
export function signatureOf(postId, text) {
  const payload = JSON.stringify([`qsig/${SIGNATURE_VERSION}`, String(postId), canonicaliseText(text)])
  return 'sha256:' + crypto.createHash('sha256').update(payload, 'utf8').digest('hex')
}

export function registryPath(root) { return path.join(root, REGISTRY_RELPATH) }
export function registryExists(root) { return fs.existsSync(registryPath(root)) }

/** The prefix every non-certified, intermediate-only row id carries. */
export const TRANSIENT_PREFIX = 'bf-uncertified-'

/**
 * An id for a row that is a PROPOSAL, not a certified question.
 *
 * backfill-analysis.mjs runs first in the chain and offers rows it thinks fill a hole. On an
 * export it offers 54 of them; apply-questions.mjs then rebuilds questions.json from the
 * certified artifact and every one of them is discarded. They are never published, never
 * canonical, and never seen by a reader — but they need SOME id while they exist.
 *
 * This is deliberately NOT a canonical id and must never become one:
 *
 *   - it is content-addressed, so re-ordering the posts cannot move it (the old
 *     `bf-${postNum}-${newQuestions.length}` was a running counter over every drop, and all
 *     three surviving bf-* rows moved between the rebuild and export paths because of it)
 *   - it is prefixed, so it is recognisable on sight and assertable in a test
 *   - it can never reach public/data/questions.json, because identity there comes from the
 *     registry and the registry contains no entry whose canonicalId carries this prefix
 *
 * Content-addressing an id is exactly what the registry forbids for a CANONICAL id, because a
 * canonical id must survive an editorial repair. A row that is deleted a step later has no
 * identity to preserve, so the objection does not apply.
 */
export function transientIdFor(postId, text) {
  const h = crypto.createHash('sha256').update(JSON.stringify([String(postId), canonicaliseText(text)]), 'utf8').digest('hex')
  return TRANSIENT_PREFIX + h.slice(0, 16)
}

/** Load and index the registry, failing closed on any internal inconsistency. */
export function loadRegistry(root) {
  const file = registryPath(root)
  if (!fs.existsSync(file)) {
    throw new Error(`question-identity registry is missing: ${REGISTRY_RELPATH}\n` +
      `   Bootstrap it once from a certified baseline: node scripts/bootstrap-question-identity.mjs`)
  }
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (doc.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`registry schemaVersion ${doc.schemaVersion}, expected ${SCHEMA_VERSION}`)
  }
  const byCanonicalId = new Map()
  const bySignature = new Map()
  const byAlias = new Map()
  let signatureCount = 0, aliasCount = 0
  for (const e of doc.entries) {
    if (byCanonicalId.has(e.canonicalId)) throw new Error(`registry: duplicate canonicalId ${e.canonicalId}`)
    byCanonicalId.set(e.canonicalId, e)
    for (const s of e.acceptedSignatures) {
      const prev = bySignature.get(s.signature)
      if (prev && prev.canonicalId !== e.canonicalId) {
        throw new Error(`registry: signature ${s.signature.slice(0, 20)} is accepted by both ` +
          `${prev.canonicalId} and ${e.canonicalId}`)
      }
      bySignature.set(s.signature, e)
      signatureCount++
    }
  }
  // Aliases are indexed in a second pass so that "an alias collides with a canonical id" is
  // decided against the COMPLETE set of canonical ids, not just the ones seen so far.
  for (const e of doc.entries) {
    for (const a of e.externalAliases ?? []) {
      const prev = byAlias.get(a)
      if (prev && prev.canonicalId !== e.canonicalId) {
        throw new Error(`registry: alias ${a} points at both ${prev.canonicalId} and ${e.canonicalId}`)
      }
      const clash = byCanonicalId.get(a)
      if (clash && clash.canonicalId !== e.canonicalId) {
        throw new Error(`registry: alias ${a} collides with the canonical id of ${clash.canonicalId}`)
      }
      byAlias.set(a, e)
      aliasCount++
    }
  }
  return { doc, entries: doc.entries, byCanonicalId, bySignature, byAlias, signatureCount, aliasCount }
}

/** One machine-readable record per candidate the registry could not resolve. */
function writeReviewArtifact(root, records) {
  const file = path.join(root, UNREGISTERED_RELPATH)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''))
  return file
}

/**
 * A resolver for one apply step.
 *
 * resolve() returns the PERMANENT canonical id for a candidate, or records a failure and returns
 * null. It never invents one. Every stop condition below is a refusal to guess:
 *
 *   unknown signature            a genuinely new question, or an unamended text repair
 *   ambiguous signature          two entries accept the same witness (rejected at load)
 *   alias / canonical collision  rejected at load
 *   signature != incoming id     the incoming id belongs to a different question
 *   duplicate emission           two candidates resolved to one canonical id
 *
 * The incoming id is CHECKED, never trusted: a shifted positional id looks perfectly valid and
 * refers to the wrong question, which is the entire defect this file exists to close.
 */
export function createResolver(root, { step }) {
  const reg = loadRegistry(root)
  const emitted = new Map()
  const failures = []

  const transient = []

  /**
   * `uncertified: true` says this candidate is a proposal that a later step will discard, so an
   * unknown signature is expected rather than a defect. Every OTHER stop condition still applies:
   * a proposal whose signature the registry DOES know still resolves to the canonical id, and a
   * proposal that contradicts a known id still stops the build.
   */
  const resolve = ({ postId, postNum, text, incomingId = null, site = 'unknown', uncertified = false, extra = {} }) => {
    const signature = signatureOf(postId, text)
    const bySig = reg.bySignature.get(signature) ?? null
    const byId = incomingId
      ? (reg.byCanonicalId.get(incomingId) ?? reg.byAlias.get(incomingId) ?? null)
      : null

    if (bySig && byId && bySig.canonicalId !== byId.canonicalId) {
      failures.push({ reason: 'SIGNATURE_ALIAS_DISAGREEMENT', step, site, postId, postNum, text,
        signature, incomingId, signatureResolvesTo: bySig.canonicalId, idResolvesTo: byId.canonicalId, ...extra })
      return null
    }
    if (!bySig && uncertified) {
      const id = transientIdFor(postId, text)
      transient.push({ id, postId, postNum, text, site })
      return id
    }
    if (!bySig) {
      failures.push({ reason: 'UNREGISTERED_QUESTION_IDENTITY', step, site, postId, postNum, text,
        signature, incomingId,
        incomingIdResolvesTo: byId?.canonicalId ?? null,
        possibleMatches: candidatesFor(reg, postId, text),
        why: byId
          ? 'the incoming id is known but this exact wording is not an accepted signature for it — ' +
            'an approved text repair needs scripts/amend-question-signature.mjs'
          : 'no registry entry accepts this signature — a genuinely new question needs ' +
            'scripts/allocate-question-id.mjs',
        ...extra })
      return null
    }

    const id = bySig.canonicalId
    const prior = emitted.get(id)
    if (prior && prior.signature !== signature) {
      failures.push({ reason: 'DUPLICATE_CANONICAL_ID', step, site, postId, postNum, text,
        signature, canonicalId: id, alreadyEmittedFor: prior.text, ...extra })
      return null
    }
    emitted.set(id, { signature, text })
    return id
  }

  /** Stop the build unless every candidate resolved. */
  const assertResolved = () => {
    if (!failures.length) return
    const file = writeReviewArtifact(root, failures)
    const first = failures[0]
    console.error(`\n[X] ${first.reason} — ${step} stopped. Nothing written.\n`)
    console.error(`    ${failures.length} candidate(s) did not resolve through ${REGISTRY_RELPATH}.`)
    for (const f of failures.slice(0, 8)) {
      console.error(`      #${f.postNum} ${JSON.stringify(String(f.text).slice(0, 64))}`)
      console.error(`        ${f.reason}  incoming=${f.incomingId ?? '(none)'}  sig=${f.signature.slice(7, 19)}`)
    }
    if (failures.length > 8) console.error(`      … and ${failures.length - 8} more`)
    console.error(`\n    Full review artifact: ${path.relative(root, file)}`)
    console.error('\n    An id is never minted to get past this. Either the question is new')
    console.error('    (scripts/allocate-question-id.mjs) or its wording was repaired')
    console.error('    (scripts/amend-question-signature.mjs). Both require review.\n')
    process.exit(1)
  }

  return { resolve, assertResolved, registry: reg,
    get failures() { return failures },
    get transient() { return transient } }
}

/** Best-effort neighbours for the review artifact — never used to resolve anything. */
function candidatesFor(reg, postId, text) {
  const out = []
  const want = canonicaliseText(text)
  const loose = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  for (const e of reg.entries) {
    if (String(e.postId) !== String(postId)) continue
    for (const s of e.acceptedSignatures) {
      const have = canonicaliseText(s.auditFields?.text ?? '')
      if (have === want || loose(have) === loose(want) || have.includes(want) || want.includes(have)) {
        out.push({ canonicalId: e.canonicalId, acceptedText: s.auditFields?.text ?? null, signatureVersion: s.signatureVersion })
        break
      }
    }
    if (out.length >= 5) break
  }
  return out
}
