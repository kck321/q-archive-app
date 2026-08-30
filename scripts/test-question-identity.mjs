// The canonical question-identity registry: 30 regression tests.
//
//   node scripts/test-question-identity.mjs
//
// Offline and pure — it reads the registry, the certified bundle and the apply scripts, and never
// touches Firestore or the network. Registered in validate.mjs under the `fast` profile.
//
// What these protect, in one sentence each: an id must not depend on where its row sits, what its
// neighbours are, how it is classified, or which baseline the chain happened to start from; and
// anything the registry cannot recognise must stop the build rather than receive a fresh id.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  signatureOf, canonicaliseText, loadRegistry, createResolver, transientIdFor,
  TRANSIENT_PREFIX, SCHEMA_VERSION, SIGNATURE_VERSION, REGISTRY_RELPATH,
} from './lib/questionIdentity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')

let pass = 0, fail = 0
const results = []
const check = (label, ok, detail = '') => {
  results.push([label, ok, detail])
  ok ? pass++ : fail++
}
const eq = (label, got, want) => check(label, JSON.stringify(got) === JSON.stringify(want),
  JSON.stringify(got) === JSON.stringify(want) ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

const reg = loadRegistry(ROOT)
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const byId = new Map(questions.map(q => [q.id, q]))
const resolver = createResolver(ROOT, { step: 'test' })
const R = (postId, text, incomingId = null, uncertified = false) =>
  resolver.resolve({ postId, postNum: 0, text, incomingId, site: 'test', uncertified })

/** A throwaway registry on disk, so the loader's own collision gates can be exercised. */
function withRegistry(entries, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qid-'))
  fs.mkdirSync(path.join(dir, 'identity'), { recursive: true })
  fs.writeFileSync(path.join(dir, REGISTRY_RELPATH),
    JSON.stringify({ schemaVersion: SCHEMA_VERSION, signatureVersion: SIGNATURE_VERSION, entries }))
  try { return fn(dir) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const entryFor = (canonicalId, postId, text, aliases = []) => ({
  schemaVersion: SCHEMA_VERSION, canonicalId, postId, postNum: 1, originFamily: 'test',
  acceptedSignatures: [{ signatureVersion: SIGNATURE_VERSION, signature: signatureOf(postId, text),
    auditFields: { postId, text }, reason: 'test' }],
  externalAliases: aliases,
})
const throws = fn => { try { fn(); return null } catch (e) { return e.message } }

// A representative slice of real certified rows to resolve repeatedly.
const sample = questions.slice(0, 400)
const resolveAll = rows => rows.map(q => R(q.postId, q.text, q.id))
const baselineIds = resolveAll(sample)

// ── 1-4: position, neighbours and classification cannot move an id ────────────
{
  const shuffled = [...sample]
  for (let i = shuffled.length - 1; i > 0; i--) { const j = (i * 7919) % (i + 1);[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]] }
  const got = new Map(shuffled.map(q => [q.id, R(q.postId, q.text, q.id)]))
  eq('1. reordering candidate rows changes no canonical id', sample.map(q => got.get(q.id)), baselineIds)
}
{
  const extra = questions[500]
  const withExtra = [extra, ...sample]
  const got = new Map(withExtra.map(q => [q.id, R(q.postId, q.text, q.id)]))
  eq('2. adding an unrelated candidate changes no existing id', sample.map(q => got.get(q.id)), baselineIds)
}
{
  const trimmed = sample.filter((_, i) => i !== 5)
  const got = new Map(trimmed.map(q => [q.id, R(q.postId, q.text, q.id)]))
  eq('3. removing an unrelated candidate changes no remaining id', trimmed.map(q => got.get(q.id)), trimmed.map(q => q.id))
}
{
  const mangled = sample.map(q => ({ ...q, status: 'answered', semanticFunction: 'information_request', certified: false, occurrences: 99 }))
  eq('4. changing metadata or classification changes no id', resolveAll(mangled), baselineIds)
}

// ── 5-6: a text change fails closed; an approved amendment preserves the id ───
{
  const q = sample[0]
  const before = resolver.failures.length
  const got = R(q.postId, q.text + ' EDITED')
  check('5. changing text fails closed until explicitly amended',
    got === null && resolver.failures.length === before + 1 &&
    resolver.failures.at(-1).reason === 'UNREGISTERED_QUESTION_IDENTITY')
}
{
  const q = sample[0]
  const amended = JSON.parse(JSON.stringify(reg.entries.find(e => e.canonicalId === q.id)))
  amended.acceptedSignatures.push({ signatureVersion: SIGNATURE_VERSION, signature: signatureOf(q.postId, q.text + ' EDITED'),
    auditFields: { postId: q.postId, text: q.text + ' EDITED' }, reason: 'approved repair' })
  withRegistry([amended], dir => {
    // A fresh resolver per wording, because within ONE run two rows resolving to a single
    // canonical id is a duplicate — which is test 12's job, and is asserted separately below.
    const oldWording = createResolver(dir, { step: 'test' }).resolve({ postId: q.postId, text: q.text, site: 't' })
    const newWording = createResolver(dir, { step: 'test' }).resolve({ postId: q.postId, text: q.text + ' EDITED', site: 't' })
    check('6. an approved new signature preserves the old canonical id',
      oldWording === q.id && newWording === q.id, `${oldWording} / ${newWording}`)

    // And the amended entry must still refuse to hand its id to two rows in one run.
    const r = createResolver(dir, { step: 'test' })
    r.resolve({ postId: q.postId, text: q.text, site: 't' })
    const second = r.resolve({ postId: q.postId, text: q.text + ' EDITED', site: 't' })
    check('6b. two rows cannot both claim one canonical id in a single run',
      second === null && r.failures.at(-1)?.reason === 'DUPLICATE_CANONICAL_ID')
  })
}

// ── 7-9: the declared canonicalisation rules ─────────────────────────────────
eq('7. CRLF and lone CR sign identically to LF',
  [signatureOf('p', 'a\r\nb'), signatureOf('p', 'a\rb')], [signatureOf('p', 'a\nb'), signatureOf('p', 'a\nb')])
eq('8. Unicode NFD signs identically to NFC',
  signatureOf('p', 'Müller?'), signatureOf('p', 'Müller?'))
{
  // No array reaches the hash, so an occurrence collection cannot reorder an identity.
  const q = sample[0]
  const a = R(q.postId, q.text, q.id)
  const b = resolver.resolve({ postId: q.postId, text: q.text, incomingId: q.id, site: 't',
    extra: { occurrences: [3, 1, 2] } })
  check('9. occurrence-array order changes no signature', a === b && a === q.id)
}

// ── 10-15: every fail-closed stop condition ──────────────────────────────────
{
  const before = resolver.failures.length
  const got = R('no-such-post', 'a question nobody wrote?')
  check('10. an unknown candidate fails closed', got === null && resolver.failures.length === before + 1)
}
{
  const dup = [entryFor('A', 'p1', 'same wording?'), entryFor('B', 'p1', 'same wording?')]
  const msg = withRegistry(dup, dir => throws(() => loadRegistry(dir)))
  check('11. an ambiguous signature fails closed', !!msg && /accepted by both/.test(msg), msg ?? 'no error')
}
{
  const dup = [entryFor('A', 'p1', 'one?'), entryFor('A', 'p1', 'two?')]
  const msg = withRegistry(dup, dir => throws(() => loadRegistry(dir)))
  check('12. a duplicate canonical id fails closed', !!msg && /duplicate canonicalId/.test(msg), msg ?? 'no error')
}
{
  const clash = [entryFor('A', 'p1', 'one?', ['X']), entryFor('B', 'p1', 'two?', ['X'])]
  const msg = withRegistry(clash, dir => throws(() => loadRegistry(dir)))
  check('13. an alias collision fails closed', !!msg && /points at both/.test(msg), msg ?? 'no error')
}
{
  const two = [entryFor('A', 'p1', 'one?', ['B']), entryFor('B', 'p1', 'two?')]
  const msg = withRegistry(two, dir => throws(() => loadRegistry(dir)))
  check('13b. an alias that collides with a canonical id fails closed',
    !!msg && /collides with the canonical id/.test(msg), msg ?? 'no error')
}
{
  const a = sample[0], b = sample[1]
  const before = resolver.failures.length
  const got = R(a.postId, a.text, b.id) // b's id on a's wording
  check('14. alias and signature disagreement fails closed',
    got === null && resolver.failures.at(-1)?.reason === 'SIGNATURE_ALIAS_DISAGREEMENT' &&
    resolver.failures.length === before + 1)
}
{
  // The defect that started all of this: a shifted positional id is perfectly well-formed and
  // names the wrong question. It must not be believed just because it looks canonical.
  const cal = byId.get('qc-h')
  const got = R(cal.postId, cal.text, 'qc-f')
  check('15. a canonical-looking shifted id cannot bypass signature verification', got === null)
  const honest = R(cal.postId, cal.text, 'qc-h')
  check('15b. …while the correct id still resolves', honest === 'qc-h')
}

// ── 16-17: the two proven Firestore aliases ──────────────────────────────────
eq('16. 5n1ZTUuUTW8PKpvHTk1Z resolves to qc-b', reg.byAlias.get('5n1ZTUuUTW8PKpvHTk1Z')?.canonicalId, 'qc-b')
eq('17. nZW8pYgbnneY3vmbsfOJ resolves to qc-c', reg.byAlias.get('nZW8pYgbnneY3vmbsfOJ')?.canonicalId, 'qc-c')
{
  const b = byId.get('qc-b'), c = byId.get('qc-c')
  check('17b. …and each still resolves from its own wording, with the alias as incoming id',
    R(b.postId, b.text, '5n1ZTUuUTW8PKpvHTk1Z') === 'qc-b' && R(c.postId, c.text, 'nZW8pYgbnneY3vmbsfOJ') === 'qc-c')
}

// ── 18-24: the named rows keep their semantic targets ────────────────────────
const target = (id, postNum, starts) => {
  const q = byId.get(id)
  check(`${id} still names #${postNum}`, !!q && q.postNum === postNum && q.text.startsWith(starts),
    q ? `#${q.postNum} ${JSON.stringify(q.text.slice(0, 40))}` : 'absent')
}
check('18. post #1915 remains qc-b', byId.get('qc-b')?.postNum === 1915)
check('19. post #1944 remains qc-c', byId.get('qc-c')?.postNum === 1944)
check('20. the CalMatters row remains qc-h', byId.get('qc-h')?.postNum === 2782 && byId.get('qc-h')?.text.includes('calmatters.org'))
check('21. post #311 "Define." remains qc-l', byId.get('qc-l')?.postNum === 311 && byId.get('qc-l')?.text === 'Define.')
check('22. post #53 "List out all who have foundations." remains qc-v',
  byId.get('qc-v')?.postNum === 53 && byId.get('qc-v')?.text === 'List out all who have foundations.')
check('23. post #97 "Define." remains qc-w', byId.get('qc-w')?.postNum === 97 && byId.get('qc-w')?.text === 'Define.')
{
  const pins = ['q-queue-2740-35', 'q-queue-2971-39', 'q-queue-4454-53']
  const nums = pins.map(p => byId.get(p)?.postNum)
  eq('24. the three pinned q-queue rows keep their exact semantic targets', nums, [2740, 2971, 4454])
  const literalIds = questions.filter(r => r.literal).map(r => r.id).sort()
  const owed = ['JPIqQwo0moEuwzhHMzXL', 'q-queue-2740-35', 'q-queue-2971-39', 'q-queue-4454-53', 'qc-h'].sort()
  eq('24b. the five OWED_LITERALS rows are exactly the rows carrying a literal span',
    literalIds.filter(id => owed.includes(id)), owed)
}

// ── 25-26: no positional allocator survives anywhere ─────────────────────────
{
  const src = f => fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8')
  // Comments describing the removed counters are allowed; a live assignment is not. Strip
  // line comments before looking, so the history in those files stays readable.
  const code = f => src(f).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  const MINTERS = [
    ['apply-questions.mjs', /`qc-\$\{/],
    ['apply-questions-final.mjs', /`qf-\$\{/],
    ['apply-questions-final.mjs', /`q-owner-\$\{/],
    ['apply-questions-final.mjs', /`q-queue-\$\{/],
    ['backfill-analysis.mjs', /`bf-\$\{/],
  ]
  const live = MINTERS.filter(([f, re]) => re.test(code(f))).map(([f, re]) => `${f} ${re}`)
  eq('25. all five positional allocator families are inactive', live, [])
  const counters = ['apply-questions.mjs', 'apply-questions-final.mjs', 'backfill-analysis.mjs']
    .filter(f => /\(\+\+next[A-Za-z]*\)\.toString\(36\)/.test(code(f)))
  eq('25b. no base-36 counter remains in any question applier', counters, [])
  // Any OTHER script that both writes questions.json and mints an id would be a new allocator.
  const all = fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.mjs'))
  const rogue = all.filter(f => {
    const c = code(f)
    return /writeFileSync\([^)]*questions\.json/.test(c) && /`(qc|qf|bf)-\$\{|`q-owner-\$\{|`q-queue-\$\{/.test(c)
  })
  eq('26. no additional positional canonical allocator remains', rogue, [])
}

// ── 27-28: the registry cannot be regenerated by a build ─────────────────────
{
  const chain = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'chainSteps.mjs'), 'utf8')
  const rebuild = fs.readFileSync(path.join(ROOT, 'scripts', 'rebuild-bundle.mjs'), 'utf8')
  const exportF = fs.readFileSync(path.join(ROOT, 'scripts', 'export-firestore.mjs'), 'utf8')
  const names = /bootstrap-question-identity|allocate-question-id|amend-question-signature/
  check('27. a normal rebuild cannot overwrite or regenerate the registry',
    !names.test(rebuild) && !names.test(chain))
  check('28. the Firestore export cannot overwrite or regenerate the registry', !names.test(exportF))
  // Nothing in the chain may WRITE the registry file either.
  const writers = fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.mjs'))
    .filter(f => /writeFileSync\([^)]*question-identity-registry|registryPath\(/.test(fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8')))
  eq('28b. only the three review tools write the registry', writers.sort(),
    ['allocate-question-id.mjs', 'amend-question-signature.mjs', 'bootstrap-question-identity.mjs'])
}

// ── 29-30: a new question and a repair each need their own explicit tool ─────
{
  const boot = fs.readFileSync(path.join(ROOT, 'scripts', 'bootstrap-question-identity.mjs'), 'utf8')
  check('29. a new certified question requires the explicit allocator',
    fs.existsSync(path.join(ROOT, 'scripts', 'allocate-question-id.mjs')) &&
    /randomUUID/.test(fs.readFileSync(path.join(ROOT, 'scripts', 'allocate-question-id.mjs'), 'utf8')))
  check('30. a text repair requires the explicit signature-amendment tool',
    fs.existsSync(path.join(ROOT, 'scripts', 'amend-question-signature.mjs')))
  check('30b. the bootstrap refuses to overwrite an existing registry', /already exists/.test(boot) && /--force/.test(boot))
  check('30c. the bootstrap refuses a baseline it was not authorised for', /NOT THE AUTHORISED BASELINE/.test(boot))
}

// ── registry-wide invariants ─────────────────────────────────────────────────
{
  eq('registry covers every published row', reg.entries.length, questions.length)
  const missing = questions.filter(q => !reg.byCanonicalId.has(q.id)).length
  eq('no published row is unregistered', missing, 0)
  const orphan = reg.entries.filter(e => !byId.has(e.canonicalId)).length
  eq('no registry entry is orphaned', orphan, 0)
  const unresolved = questions.filter(q => reg.bySignature.get(signatureOf(q.postId, q.text))?.canonicalId !== q.id).length
  eq('every published row resolves to itself by signature', unresolved, 0)
  check('a transient id is content-addressed and prefixed',
    transientIdFor('p', 'x?') === transientIdFor('p', 'x?') &&
    transientIdFor('p', 'x?').startsWith(TRANSIENT_PREFIX) &&
    transientIdFor('p', 'x?') !== transientIdFor('p', 'y?'))
  const transientCanonical = reg.entries.filter(e => String(e.canonicalId).startsWith(TRANSIENT_PREFIX)).length
  eq('no transient id is a canonical id', transientCanonical, 0)
  eq('canonicalisation is idempotent', canonicaliseText(canonicaliseText('a\r\nb')), canonicaliseText('a\r\nb'))
}

// ── report ───────────────────────────────────────────────────────────────────
console.log('\nQUESTION IDENTITY REGISTRY — REGRESSION TESTS\n')
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) { console.error('\n[X] question-identity regressions.\n'); process.exit(1) }
console.log('')
