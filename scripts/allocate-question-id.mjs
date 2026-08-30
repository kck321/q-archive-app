// ALLOCATE a canonical id for a genuinely new certified question. Explicit, reviewed, never automatic.
//
//   node scripts/allocate-question-id.mjs --post <postNum> --text "<exact span>" [--reason "…"] [--dry]
//   node scripts/allocate-question-id.mjs --from-review [--dry]
//
// The apply chain never reaches this file. When a candidate does not resolve, the chain STOPS and
// writes audit/question-identity-unregistered.jsonl; a person then reads that artifact and runs
// this. That is the whole point: an id that a build can mint on its own is an id that can move on
// its own, and the archive has already paid for that once.
//
// WHAT THIS MINTS
// ───────────────
// An opaque UUID. Not a counter, not a hash of the text, not a continuation of qc-*, qf-*, bf-*,
// q-owner-* or q-queue-*:
//
//   - a counter makes the id a function of how many rows came before it
//   - a hash of the text makes the id a function of wording, so an approved editorial repair
//     would rename the question — the exact failure the registry exists to prevent
//   - continuing an existing family implies a position inside it that no longer exists
//
// A UUID means nothing, which is precisely what a permanent identifier should mean. The wording
// is recorded beside it as the first accepted signature, as evidence, not as identity.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { signatureOf, loadRegistry, registryPath, SCHEMA_VERSION, SIGNATURE_VERSION, UNREGISTERED_RELPATH } from './lib/questionIdentity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const arg = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null }
const has = n => argv.includes(`--${n}`)
const dry = has('dry')

const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const postByNum = new Map(posts.map(p => [p.postNum, p]))

/** Every candidate to allocate: either one named on the command line, or the whole review artifact. */
let requests = []
if (has('from-review')) {
  const f = path.join(ROOT, UNREGISTERED_RELPATH)
  if (!fs.existsSync(f)) { console.error(`\n[X] ${UNREGISTERED_RELPATH} does not exist — nothing to allocate.\n`); process.exit(1) }
  requests = fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
    .filter(r => r.reason === 'UNREGISTERED_QUESTION_IDENTITY' && !r.incomingIdResolvesTo)
    .map(r => ({ postNum: r.postNum, postId: r.postId, text: r.text, reason: arg('reason') ?? `allocated from ${UNREGISTERED_RELPATH}` }))
} else {
  const postNum = Number(arg('post'))
  const text = arg('text')
  if (!Number.isFinite(postNum) || !text) {
    console.error('\n  usage: node scripts/allocate-question-id.mjs --post <postNum> --text "<exact span>" [--reason "…"]')
    console.error('     or: node scripts/allocate-question-id.mjs --from-review\n')
    process.exit(1)
  }
  const post = postByNum.get(postNum)
  if (!post) { console.error(`\n[X] no drop #${postNum}.\n`); process.exit(1) }
  requests = [{ postNum, postId: String(post.id), text, reason: arg('reason') ?? 'new certified question' }]
}
if (!requests.length) { console.log('\n  nothing to allocate.\n'); process.exit(0) }

const reg = loadRegistry(ROOT)
const doc = reg.doc
const refusals = []
const allocated = []

for (const r of requests) {
  const post = postByNum.get(r.postNum)
  const postId = String(r.postId ?? post?.id ?? '')
  if (!post) { refusals.push(`#${r.postNum}: no such drop`); continue }
  if (!postId) { refusals.push(`#${r.postNum}: no immutable drop id`); continue }

  const signature = signatureOf(postId, r.text)
  const clash = reg.bySignature.get(signature)
  if (clash) {
    // The overwhelmingly common case: this is not a new question at all.
    refusals.push(`#${r.postNum} ${JSON.stringify(r.text.slice(0, 50))}: already registered as ${clash.canonicalId}`)
    continue
  }
  // The span must genuinely be in the drop. A question that is not in the archive has no identity
  // to allocate, and this is the same check apply-questions.mjs makes before it writes a row.
  const flat = s => String(s ?? '').replace(/\s+/g, ' ').trim()
  if (!flat(post.text).includes(flat(r.text))) {
    refusals.push(`#${r.postNum} ${JSON.stringify(r.text.slice(0, 50))}: does not appear verbatim in the drop`)
    continue
  }

  const canonicalId = crypto.randomUUID()
  allocated.push({
    schemaVersion: SCHEMA_VERSION,
    canonicalId,
    postId,
    postNum: r.postNum,
    originFamily: 'allocated',
    acceptedSignatures: [{
      signatureVersion: SIGNATURE_VERSION,
      signature,
      auditFields: { postId, text: r.text },
      reason: r.reason,
    }],
    externalAliases: [],
  })
}

console.log('\nALLOCATE CANONICAL QUESTION IDS\n')
for (const a of allocated) console.log(`  + ${a.canonicalId}  #${a.postNum}  ${JSON.stringify(a.acceptedSignatures[0].auditFields.text.slice(0, 60))}`)
for (const r of refusals) console.log(`  X ${r}`)
console.log(`\n  allocated ${allocated.length}, refused ${refusals.length}`)

if (refusals.length && !has('ignore-refusals')) {
  console.error('\n[X] refusing to allocate while any candidate is refused. Nothing written.')
  console.error('    Re-run with --ignore-refusals once each refusal above is understood.\n')
  process.exit(1)
}
if (!allocated.length) { console.log('') ; process.exit(0) }
if (dry) { console.log('\n--dry: registry not written\n'); process.exit(0) }

doc.entries.push(...allocated)
doc.entries.sort((a, b) => (a.postNum - b.postNum) || (a.canonicalId < b.canonicalId ? -1 : a.canonicalId > b.canonicalId ? 1 : 0))
fs.writeFileSync(registryPath(ROOT), JSON.stringify(doc, null, 1) + '\n')
loadRegistry(ROOT) // re-load, so an inconsistency is caught here rather than in the next build
console.log(`\n  wrote identity/question-identity-registry.json — ${doc.entries.length} entries\n`)
