// AMEND a registry entry with a new accepted signature, after an approved editorial repair.
//
//   node scripts/amend-question-signature.mjs --id <canonicalId> --text "<new exact wording>" \
//        --reason "<why the wording changed>" [--retire-old] [--dry]
//
// THE CANONICAL ID DOES NOT MOVE. That is the entire contract.
//
// A question's wording is repairable — audit/abbreviation-span-repairs.json has repaired 24 of
// them, because a sentence splitter ends a sentence at "." and cut "What is A. Merkel's family
// history?" down to "What is A.". When that happens the build STOPS, because the new wording is
// not an accepted signature of any entry and the resolver refuses to guess which question it
// belongs to. A person then confirms the repair and runs this, which adds the new wording as an
// additional accepted signature of the SAME entry.
//
// The old signature is KEPT by default. It is historical identity evidence: it is what the row
// was called when earlier rulings were written against it, and an artifact that still carries the
// old wording must still resolve. --retire-old marks it retired (it stops resolving) for the rare
// case where the old wording was genuinely wrong rather than merely older; the record of it stays
// in the file either way, because deleting the evidence defeats the purpose of keeping it.
//
// What this will not do:
//   - move a signature between entries       (that is two questions, not one repair)
//   - change postId                          (a question does not move between drops)
//   - accept a wording another entry claims  (ambiguity fails closed)
//   - mint a new canonical id                (that is scripts/allocate-question-id.mjs)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { signatureOf, canonicaliseText, loadRegistry, registryPath, SIGNATURE_VERSION } from './lib/questionIdentity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const arg = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null }
const has = n => argv.includes(`--${n}`)
const dry = has('dry')

const canonicalId = arg('id')
const text = arg('text')
const reason = arg('reason')
if (!canonicalId || !text || !reason) {
  console.error('\n  usage: node scripts/amend-question-signature.mjs --id <canonicalId> \\')
  console.error('           --text "<new exact wording>" --reason "<why the wording changed>" [--retire-old]\n')
  console.error('  A reason is required. An amendment with no recorded justification is indistinguishable')
  console.error('  from the silent rename this mechanism exists to prevent.\n')
  process.exit(1)
}

const reg = loadRegistry(ROOT)
const entry = reg.byCanonicalId.get(canonicalId)
if (!entry) {
  console.error(`\n[X] ${canonicalId} is not a canonical id in the registry — nothing to amend.\n`)
  console.error('    A genuinely new question needs scripts/allocate-question-id.mjs.\n')
  process.exit(1)
}

const signature = signatureOf(entry.postId, text)
const owner = reg.bySignature.get(signature)
if (owner && owner.canonicalId !== canonicalId) {
  console.error(`\n[X] that wording is already an accepted signature of ${owner.canonicalId} — amendment refused.\n`)
  console.error('    Two entries cannot accept one witness; that is the ambiguity the resolver fails closed on.')
  console.error('    If these are genuinely the same question, the entries must be merged by review, not here.\n')
  process.exit(1)
}
if (owner) {
  console.log(`\n  ${canonicalId} already accepts that wording — nothing to do.\n`)
  process.exit(0)
}

// The repaired span must be in the drop, exactly as apply-questions.mjs requires of every row.
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const post = posts.find(p => String(p.id) === String(entry.postId))
const flat = s => String(s ?? '').replace(/\s+/g, ' ').trim()
if (!post) {
  console.error(`\n[X] drop ${entry.postId} (#${entry.postNum}) is not in the bundle — cannot verify the span.\n`)
  process.exit(1)
}
if (!flat(post.text).includes(flat(text))) {
  console.error(`\n[X] the proposed wording does not appear verbatim in #${entry.postNum} — amendment refused.\n`)
  console.error(`    proposed: ${JSON.stringify(text.slice(0, 90))}\n`)
  console.error('    A repair takes its wording from the drop; it never retypes it.\n')
  process.exit(1)
}

const before = entry.acceptedSignatures.map(s => s.auditFields?.text)
if (has('retire-old')) for (const s of entry.acceptedSignatures) if (!s.retired) s.retired = { reason, retiredBy: 'amend-question-signature.mjs' }
entry.acceptedSignatures.push({
  signatureVersion: SIGNATURE_VERSION,
  signature,
  auditFields: { postId: String(entry.postId), text },
  reason,
  amends: { previousWordings: before },
})

console.log('\nAMEND ACCEPTED SIGNATURE\n')
console.log(`  canonical id (UNCHANGED)  : ${canonicalId}`)
console.log(`  drop                      : #${entry.postNum}`)
console.log(`  accepted signatures       : ${entry.acceptedSignatures.length - 1} -> ${entry.acceptedSignatures.length}`)
for (const b of before) console.log(`    kept${has('retire-old') ? ' (retired)' : ''} : ${JSON.stringify(String(b).slice(0, 70))}`)
console.log(`    added        : ${JSON.stringify(text.slice(0, 70))}`)
console.log(`  reason                    : ${reason}`)
if (canonicaliseText(text) === canonicaliseText(String(before[0]))) console.log('  (the wordings differ only outside the canonicalisation rules)')

if (dry) { console.log('\n--dry: registry not written\n'); process.exit(0) }
fs.writeFileSync(registryPath(ROOT), JSON.stringify(reg.doc, null, 1) + '\n')
loadRegistry(ROOT) // fail here rather than in the next build
console.log('\n  wrote identity/question-identity-registry.json\n')
