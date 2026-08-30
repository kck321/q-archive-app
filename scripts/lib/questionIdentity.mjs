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

/**
 * Every id-like prefix that must never appear in a generated questions.json.
 *
 * `bf-uncertified-` was a real mechanism here for one commit: backfill-analysis.mjs gave unknown
 * proposals a content-addressed id so the chain could carry them to apply-questions.mjs, which
 * discards them. It is gone. A proposal is now recorded outside the dataset and its row is not
 * written at all, so no interrupted chain can strand a hash-derived identity in certified data.
 * The prefix is kept here only so the regression suite can assert its continued absence.
 */
export const FORBIDDEN_ID_PREFIXES = ['bf-uncertified-']

/** Where a step records the questions it proposed but did not write. */
export const PROPOSALS_RELPATH = path.join('audit', 'question-identity-proposals.jsonl')

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
  const bySignature = new Map()        // ACTIVE signatures only — what a build may resolve through
  const byRetiredSignature = new Map() // retired ones, kept so a build can SAY the wording was retired
  const byAlias = new Map()
  let signatureCount = 0, activeSignatureCount = 0, retiredSignatureCount = 0, aliasCount = 0

  // A RETIRED SIGNATURE MUST NOT RESOLVE.
  //
  // amend-question-signature.mjs --retire-old stamps `retired` on the wordings an approved repair
  // replaced, and the whole point of retiring one is that the old wording stops being accepted.
  // Indexing it here anyway would keep it resolving for ever, so the flag would document a
  // behaviour the code did not have — the tool would say "it stops resolving" and it would not.
  // It stays in the FILE as historical identity evidence, and in byRetiredSignature so the resolver
  // can fail closed with the real reason instead of a bare "unregistered".
  for (const e of doc.entries) {
    if (byCanonicalId.has(e.canonicalId)) throw new Error(`registry: duplicate canonicalId ${e.canonicalId}`)
    byCanonicalId.set(e.canonicalId, e)
    for (const s of e.acceptedSignatures) {
      signatureCount++
      if (s.retired) {
        retiredSignatureCount++
        // A retired wording may legitimately be retired on more than one entry over time; what it
        // must never do is resolve. Collisions among retired signatures are recorded, not fatal.
        if (!byRetiredSignature.has(s.signature)) byRetiredSignature.set(s.signature, e)
        continue
      }
      const prev = bySignature.get(s.signature)
      if (prev && prev.canonicalId !== e.canonicalId) {
        throw new Error(`registry: signature ${s.signature.slice(0, 20)} is accepted by both ` +
          `${prev.canonicalId} and ${e.canonicalId}`)
      }
      bySignature.set(s.signature, e)
      activeSignatureCount++
    }
    if (e.acceptedSignatures.length && !e.acceptedSignatures.some(s => !s.retired)) {
      throw new Error(`registry: ${e.canonicalId} has no ACTIVE accepted signature — every wording ` +
        'was retired, so nothing could ever resolve to it again')
    }
  }
  // An active signature and a retired one are different things and are allowed to coexist; a
  // signature that is active on one entry while retired on another is recorded for the audit,
  // because the active one wins and that should never be silent.
  const retiredAlsoActive = [...byRetiredSignature.keys()].filter(s => bySignature.has(s))
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
  return { doc, entries: doc.entries, byCanonicalId, bySignature, byRetiredSignature, byAlias,
    signatureCount, activeSignatureCount, retiredSignatureCount, retiredAlsoActive, aliasCount }
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

  const proposals = []

  const resolve = ({ postId, postNum, text, incomingId = null, site = 'unknown', extra = {} }) => {
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
    // A wording an amendment retired is not merely unknown — it is known and refused. Saying so
    // is the difference between "someone must register this" and "this was replaced on purpose".
    const retired = !bySig ? (reg.byRetiredSignature.get(signature) ?? null) : null
    if (retired) {
      failures.push({ reason: 'RETIRED_SIGNATURE', step, site, postId, postNum, text,
        signature, incomingId, retiredFrom: retired.canonicalId,
        activeWordings: retired.acceptedSignatures.filter(s => !s.retired).map(s => s.auditFields?.text ?? null),
        why: 'this wording was retired by scripts/amend-question-signature.mjs and no longer resolves. ' +
          'The source artifact still carries the old wording, or the retirement was a mistake.',
        ...extra })
      return null
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

  /**
   * For a step that PROPOSES questions rather than certifying them — today only
   * backfill-analysis.mjs, which offers rows it thinks fill a hole in a drop's analysis.
   *
   * Returns the permanent canonical id when the registry already knows the wording, and `null`
   * when it does not. `null` means DROP THE ROW: the caller must not write it, and must not give
   * it an id of any kind.
   *
   * An earlier version of this file handed unknown proposals a content-addressed `bf-uncertified-…`
   * id and let them into the intermediate public/data/questions.json on the grounds that
   * apply-questions.mjs discards them a step later. That is true right up until the chain is
   * interrupted between the two steps — an export that dies on a quota error, a Ctrl-C, a failing
   * gate — and then a hash-derived identity is sitting in the certified dataset on disk with
   * nothing left to remove it. The registry is supposed to be the only source of identity in that
   * file, so the proposal is recorded OUTSIDE it instead and the row is simply not written.
   *
   * Every other stop condition still applies: a proposal that contradicts a known id still fails
   * closed, and a proposal whose wording was retired still fails closed.
   */
  const resolveProposal = ({ postId, postNum, text, site = 'proposal', extra = {} }) => {
    const signature = signatureOf(postId, text)
    const bySig = reg.bySignature.get(signature) ?? null
    if (bySig) return resolve({ postId, postNum, text, site, extra })
    if (reg.byRetiredSignature.has(signature)) return resolve({ postId, postNum, text, site, extra })
    proposals.push({ step, site, postId, postNum, text, signature,
      possibleMatches: candidatesFor(reg, postId, text),
      disposition: 'not written to public/data/questions.json — no identity assigned',
      ...extra })
    return null
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

  /**
   * Record the proposals this step declined to write.
   *
   * Always called, so a run that proposes nothing REMOVES a file left by an earlier run rather
   * than leaving a stale list of questions that are no longer being proposed. A rebuild proposes
   * none, so on the certified tree this file does not exist — which is why it is a finding when
   * it does.
   */
  const writeProposals = () => {
    const file = path.join(root, PROPOSALS_RELPATH)
    if (!proposals.length) { if (fs.existsSync(file)) fs.rmSync(file); return file }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, proposals.map(r => JSON.stringify(r)).join('\n') + '\n')
    return file
  }

  return { resolve, resolveProposal, assertResolved, writeProposals, registry: reg,
    get failures() { return failures },
    get proposals() { return proposals } }
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
