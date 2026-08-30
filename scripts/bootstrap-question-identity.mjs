// ONE-TIME BOOTSTRAP of identity/question-identity-registry.json from a certified baseline.
//
//   node scripts/bootstrap-question-identity.mjs [--dry] [--force] [--authorise-different-baseline]
//
// This is the only tool that may CREATE canonical question ids in bulk, and it creates none of
// them: it adopts the ids the certified baseline already published, so that every id ever shown
// to a reader, stored in a browser's IndexedDB cache, or referenced by a reviewed ruling keeps
// meaning exactly what it meant. After this runs once, ordinary workflows READ the registry.
//
// It is never invoked by rebuild-bundle.mjs or export-firestore.mjs. Neither imports this file;
// scripts/test-question-identity.mjs asserts that they never will.
//
// WHAT A BOOTSTRAPPED ENTRY CONTAINS
// ──────────────────────────────────
// One entry per published row, carrying the row's PUBLISHED wording as its first accepted
// signature, plus every reviewed SOURCE wording that the chain presents for that row and that
// differs from it — 25 of them, from the three records named further down.
//
// Those extra signatures are not guesses. Each comes from a committed, reviewed artifact, and
// each is located by replaying the very rewrite the chain applies. Both wordings are the same
// question, which is exactly what an accepted-signature history is for. Registering them here is
// the difference between a chain that resolves and a chain that stops on rows nothing is wrong
// with.
//
// THE TWO EXTERNAL ALIASES, AND THE 2,125 THAT ARE NOT ALIASES
// ────────────────────────────────────────────────────────────
// Firestore holds 10,158 question documents for 6,643 certified questions, so thousands of
// documents share a drop and a wording with a certified row. Only TWO of them are ids the
// pipeline actually adopts as a row's identity — proven by running the export path and watching
// #1915 and #1944 take them:
//
//     5n1ZTUuUTW8PKpvHTk1Z -> qc-b   (#1915)
//     nZW8pYgbnneY3vmbsfOJ -> qc-c   (#1944)
//
// The other 2,123 are duplicate documents, and registering them as aliases would be actively
// destructive. 53 of the 78 questionEdits deletions name one. Today each of those deletions
// removes a duplicate document from the raw dump and the certified row survives; canonicalise
// them and three of those deletions land on certified rows qf-3g, qf-3h and qf-1l and delete
// them. A deletion must never move to another question — so a duplicate document is not an
// alias, and this file registers none of them. See QUESTION-IDENTITY-STABILIZATION/
// 10-FIRESTORE-ALIAS-CROSSWALK.jsonl for the full census.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { signatureOf, canonicaliseText, SCHEMA_VERSION, SIGNATURE_VERSION, registryPath, REGISTRY_RELPATH } from './lib/questionIdentity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')
const force = process.argv.includes('--force')
const anyBaseline = process.argv.includes('--authorise-different-baseline')

// ── The baseline this registry is authorised to adopt ────────────────────────
// Seed 116, deployed at commit 0e968f3 / tree ad244e7. A registry built from anything else would
// silently canonicalise whatever ids happened to be on disk, which is the failure being fixed.
const EXPECT = {
  rows: 6643,
  questionsSha256: '9407140deb4f70b4ced88bd969da14167aa1a64d770c607c3b0b6f3047a17b01',
  seed: 116,
  deployedCommit: '0e968f3f2285e744a70d91b387dc16a189e436da',
}

const PROVEN_ALIASES = [
  { alias: '5n1ZTUuUTW8PKpvHTk1Z', canonicalId: 'qc-b', postNum: 1915,
    proof: 'export-path prior hands #1915 this Firestore document id; byte-identical wording and drop; sole competing document' },
  { alias: 'nZW8pYgbnneY3vmbsfOJ', canonicalId: 'qc-c', postNum: 1944,
    proof: 'export-path prior hands #1944 this Firestore document id; byte-identical wording and drop; sole competing document' },
]

const qFile = path.join(DATA, 'questions.json')
const raw = fs.readFileSync(qFile)
const gotSha = crypto.createHash('sha256').update(raw).digest('hex')
const rows = JSON.parse(raw.toString('utf8'))

const problems = []
if (rows.length !== EXPECT.rows) problems.push(`public/data/questions.json holds ${rows.length} rows, expected ${EXPECT.rows}`)
if (gotSha !== EXPECT.questionsSha256) problems.push(`questions.json sha256 is ${gotSha}, expected ${EXPECT.questionsSha256}`)
if (problems.length && !anyBaseline) {
  console.error('\n[X] NOT THE AUTHORISED BASELINE — bootstrap stopped.\n')
  for (const p of problems) console.error(`    ${p}`)
  console.error('\n    The registry adopts the ids a certified baseline already published. Building it')
  console.error('    from a different tree would canonicalise whatever happened to be on disk.')
  console.error('    Re-run with --authorise-different-baseline only if that is genuinely intended.\n')
  process.exit(1)
}
if (problems.length) for (const p of problems) console.log(`  ! baseline override: ${p}`)

const out = registryPath(ROOT)
if (fs.existsSync(out) && !force) {
  console.error(`\n[X] ${REGISTRY_RELPATH} already exists — bootstrap stopped.\n`)
  console.error('    The registry is the identity authority; regenerating it is how ids get lost.')
  console.error('    A new question needs scripts/allocate-question-id.mjs; a repaired wording needs')
  console.error('    scripts/amend-question-signature.mjs. Pass --force only to rebuild from scratch.\n')
  process.exit(1)
}

// ── Build ────────────────────────────────────────────────────────────────────
const famOf = id =>
  /^qc-[0-9a-z]+$/.test(id) ? 'qc' :
  /^qf-[0-9a-z]+$/.test(id) ? 'qf' :
  /^q-owner-\d+-\d+$/.test(id) ? 'q-owner' :
  /^q-queue-\d+-\d+$/.test(id) ? 'q-queue' :
  /^bf-\d+-\d+$/.test(id) ? 'bf' :
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id) ? 'uuid' :
  /^[A-Za-z0-9]{20}$/.test(id) ? 'firestore-20' : 'other'

const aliasByCanonical = new Map()
for (const a of PROVEN_ALIASES) {
  if (!aliasByCanonical.has(a.canonicalId)) aliasByCanonical.set(a.canonicalId, [])
  aliasByCanonical.get(a.canonicalId).push(a)
}

// The reviewed abbreviation repairs, indexed by drop + repaired wording.
const repairsFile = path.join(ROOT, 'audit', 'abbreviation-span-repairs.json')
const repairs = fs.existsSync(repairsFile)
  ? (JSON.parse(fs.readFileSync(repairsFile, 'utf8')).repairs ?? []).filter(r => r.category === 'questions')
  : []

// ── The wordings the chain actually PRESENTS, which are not always the published ones ─────────
//
// A row is published under the wording it ends up with, but the resolver sees the wording its
// SOURCE artifact carries, and three reviewed records rewrite one into the other:
//
//   audit/abbreviation-span-repairs.json   a truncated span becomes the full one
//   audit/questions-owner-rulings.json     an owner ruling's wording, before any repair
//   the unhighlighted-sentence queue       a ruling's sourceText, before any repair
//
// #2740 needs all three ideas at once: the queue ruling reads "Why did [LL]  [ATTORNEY GENERAL…"
// with two spaces after [LL] and stops at "Don Jr.", the repair record matches it through a
// whitespace-insensitive key and replaces it with the full single-spaced sentence, and THAT is
// what q-queue-2740-35 publishes. Only the published form would be registered if this pass did
// not exist, and the build would stop on a row nothing is wrong with.
//
// So every reviewed source wording is registered as an accepted signature of the row it produces,
// located by replaying the same repair the chain applies. These are historical identity evidence:
// several wordings, one permanent id.
const norm = t => canonicaliseText(t).toLowerCase().replace(/\s+/g, ' ').trim()
const repairTruncatedToFull = new Map()
for (const r of repairs) repairTruncatedToFull.set(`${r.postNum}|${norm(r.truncated)}`, r.full)
const publishedByNorm = new Map()
for (const q of rows) publishedByNorm.set(`${q.postNum}|${norm(q.text)}`, q)

/** The published row a reviewed source wording ends up as, or null. */
const publishedFor = (postNum, wording) => {
  const repaired = repairTruncatedToFull.get(`${postNum}|${norm(wording)}`) ?? wording
  return publishedByNorm.get(`${postNum}|${norm(repaired)}`) ?? null
}

const sourceWordings = new Map() // canonicalId -> [{ text, reason }]
const addWording = (postNum, wording, reason) => {
  const row = publishedFor(postNum, wording)
  if (!row) return
  if (canonicaliseText(row.text) === canonicaliseText(wording)) return // already the published form
  if (!sourceWordings.has(row.id)) sourceWordings.set(row.id, [])
  if (!sourceWordings.get(row.id).some(w => w.text === wording)) sourceWordings.get(row.id).push({ text: wording, reason })
}
for (const r of repairs) addWording(r.postNum, r.truncated,
  `pre-repair wording, audit/abbreviation-span-repairs.json (${r.appliedOn ?? 'undated'})`)
{
  const f = path.join(ROOT, 'audit', 'questions-owner-rulings.json')
  if (fs.existsSync(f)) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).rulings ?? []) {
    addWording(r.postNum, r.text, `owner question ruling ${r.ruledOn ?? ''}`.trim())
  }
}
{
  const { loadQueueRulings } = await import('./lib/queueRulings.mjs')
  for (const r of loadQueueRulings(ROOT, 'questions')) {
    addWording(r.postNum, r.sourceText, `unhighlighted-sentence queue ruling ${r.ruledOn ?? ''}`.trim())
  }
}

const entries = []
let extraSignatures = 0
for (const q of rows) {
  const accepted = [{
    signatureVersion: SIGNATURE_VERSION,
    signature: signatureOf(q.postId, q.text),
    auditFields: { postId: String(q.postId), text: q.text },
    reason: 'seed-116 registry bootstrap — the published wording',
  }]
  for (const w of sourceWordings.get(q.id) ?? []) {
    const sig = signatureOf(q.postId, w.text)
    if (accepted.some(a => a.signature === sig)) continue
    accepted.push({
      signatureVersion: SIGNATURE_VERSION,
      signature: sig,
      auditFields: { postId: String(q.postId), text: w.text },
      reason: `${w.reason} — retained as historical identity evidence`,
    })
    extraSignatures++
  }
  entries.push({
    schemaVersion: SCHEMA_VERSION,
    canonicalId: q.id,
    postId: String(q.postId),
    postNum: q.postNum,
    originFamily: famOf(q.id),
    acceptedSignatures: accepted,
    externalAliases: (aliasByCanonical.get(q.id) ?? []).map(a => a.alias),
  })
}

// Deterministic order: by drop, then by canonical id. Never by array position in the input.
entries.sort((a, b) => (a.postNum - b.postNum) || (a.canonicalId < b.canonicalId ? -1 : a.canonicalId > b.canonicalId ? 1 : 0))

// ── Uniqueness and collision audit ───────────────────────────────────────────
const audit = { canonicalIdCollisions: [], signatureCollisions: [], aliasCollisions: [], aliasUnresolved: [] }
const seenId = new Set(), seenSig = new Map(), seenAlias = new Map()
for (const e of entries) {
  if (seenId.has(e.canonicalId)) audit.canonicalIdCollisions.push(e.canonicalId)
  seenId.add(e.canonicalId)
  for (const s of e.acceptedSignatures) {
    if (seenSig.has(s.signature) && seenSig.get(s.signature) !== e.canonicalId) {
      audit.signatureCollisions.push({ signature: s.signature, a: seenSig.get(s.signature), b: e.canonicalId })
    }
    seenSig.set(s.signature, e.canonicalId)
  }
  for (const a of e.externalAliases) {
    if (seenAlias.has(a)) audit.aliasCollisions.push({ alias: a, a: seenAlias.get(a), b: e.canonicalId })
    if (seenId.has(a) && a !== e.canonicalId) audit.aliasCollisions.push({ alias: a, clashesWithCanonicalId: true })
    seenAlias.set(a, e.canonicalId)
  }
}
for (const a of PROVEN_ALIASES) if (!entries.some(e => e.externalAliases.includes(a.alias))) audit.aliasUnresolved.push(a)

const famTally = {}
for (const e of entries) famTally[e.originFamily] = (famTally[e.originFamily] ?? 0) + 1
const signatureCount = entries.reduce((n, e) => n + e.acceptedSignatures.length, 0)
const aliasCount = entries.reduce((n, e) => n + e.externalAliases.length, 0)

console.log('\nBOOTSTRAP QUESTION IDENTITY REGISTRY\n')
console.log(`  baseline questions.json   : ${rows.length.toLocaleString()} rows, sha256 ${gotSha.slice(0, 16)}…`)
console.log(`  registry entries          : ${entries.length.toLocaleString()}`)
console.log(`  accepted signatures       : ${signatureCount.toLocaleString()}  (+${extraSignatures} pre-repair wordings)`)
console.log(`  external aliases          : ${aliasCount}`)
console.log(`  id families preserved     : ${Object.entries(famTally).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log('\n  COLLISION AUDIT')
console.log(`    canonical id collisions : ${audit.canonicalIdCollisions.length}`)
console.log(`    signature collisions    : ${audit.signatureCollisions.length}`)
console.log(`    alias collisions        : ${audit.aliasCollisions.length}`)
console.log(`    aliases not placed      : ${audit.aliasUnresolved.length}`)

const failed = audit.canonicalIdCollisions.length || audit.signatureCollisions.length ||
  audit.aliasCollisions.length || audit.aliasUnresolved.length
if (failed) {
  console.error('\n[X] the registry is not internally consistent. Nothing written.\n')
  for (const c of audit.signatureCollisions.slice(0, 5)) console.error(`    signature shared by ${c.a} and ${c.b}`)
  for (const c of audit.aliasCollisions.slice(0, 5)) console.error(`    alias ${c.alias} collides`)
  for (const c of audit.aliasUnresolved.slice(0, 5)) console.error(`    alias ${c.alias} names ${c.canonicalId}, which is not in the baseline`)
  console.error('')
  process.exit(1)
}

const doc = {
  schemaVersion: SCHEMA_VERSION,
  signatureVersion: SIGNATURE_VERSION,
  bootstrappedFrom: {
    deployedCommit: EXPECT.deployedCommit,
    seed: EXPECT.seed,
    questionsSha256: gotSha,
    rows: rows.length,
  },
  signatureRules: {
    encoding: 'UTF-8',
    lineEndings: 'CRLF and lone CR are normalised to LF',
    unicode: 'NFC',
    caseSensitive: true,
    punctuationSensitive: true,
    whitespaceSensitive: true,
    payload: '["qsig/1", postId, canonicalisedText]  JSON-serialised, then sha256',
    excluded: ['canonicalId', 'status', 'semanticFunction', 'grammaticalForm', 'certified',
      'createdAt', 'infographId', 'occurrences', 'every array and every classification field'],
  },
  entries,
}

if (dry) { console.log('\n--dry: registry not written\n'); process.exit(0) }
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n')
console.log(`\n  wrote ${REGISTRY_RELPATH} (${(fs.statSync(out).size / 1048576).toFixed(2)} MB)\n`)
