// One-time / repeatable export of all Firestore collections to a local JSON bundle.
// Foundation for the offline desktop (Tauri) build — run with: node scripts/export-firestore.mjs
//
// Reads Firebase config from .env (VITE_FIREBASE_*), connects to the SAME named
// database the app uses ('default'), and writes one JSON file per collection into
// public/data/, plus a manifest with counts + byte sizes.

import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { APPLY_STEPS } from './lib/chainSteps.mjs'
import { fingerprintPostText, perPostDigests } from './lib/postTextFingerprint.mjs'
import { stableStringify } from './lib/stableJson.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// ── Parse .env for VITE_FIREBASE_* ───────────────────────────────────────────
const env = {}
for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app, 'default') // MUST match src/firebase.ts

const COLLECTIONS = ['posts', 'questions', 'topics', 'resources', 'analysisConfirmed', 'infographs']

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })

// NO WALL CLOCK IN THE BUNDLE.
//
// This carried `exportedAt: new Date().toISOString()`, which made public/data/manifest.json the
// one file an export could never reproduce. Two costs, and the second is the expensive one:
// "run the pipeline twice and diff" reported a difference that was only the clock, and every
// export left the working tree dirty — so the NEXT deploy failed preflight's "working tree is
// clean" check until someone committed a changed timestamp. git already records when the bundle
// last moved, and far more reliably than a field inside the bundle.
const manifest = { collections: {} }
let grandBytes = 0

for (const name of COLLECTIONS) {
  process.stdout.write(`Exporting ${name}… `)
  const snap = await getDocs(collection(db, name))
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  const file = join(outDir, `${name}.json`)
  writeFileSync(file, stableStringify(docs))
  const bytes = statSync(file).size
  grandBytes += bytes
  manifest.collections[name] = { count: docs.length, bytes }
  console.log(`${docs.length} docs, ${(bytes / 1024 / 1024).toFixed(2)} MB`)
}

// ── Bake the cross-device edit overlays into the exported posts/questions ────────
// The public build does NOT read Firestore (every visitor would cost one read per
// document, and the free-tier quota was already exhausted by developer use alone). So the
// overlays that `sync.ts` normally applies at runtime have to be applied HERE, or the
// published site silently loses every classification and question edit.
{
  process.stdout.write('Baking postEdits / questionEdits into the bundle… ')
  const EDITABLE = ['postAnalysis','actionRequests','hasRequests','hasQuestions',
                    'analysisScanned','customBrackets','excludedBrackets','correlatedNews','newsScanned']

  const postEdits = (await getDocs(collection(db, 'postEdits'))).docs
  const questionEdits = (await getDocs(collection(db, 'questionEdits'))).docs

  const postsFile = join(outDir, 'posts.json')
  const posts = JSON.parse(readFileSync(postsFile, 'utf8'))
  const byId = new Map(posts.map(p => [String(p.id), p]))
  let patched = 0
  for (const d of postEdits) {
    const target = byId.get(d.id)
    if (!target) continue
    const data = d.data()
    for (const k of EDITABLE) if (k in data) target[k] = data[k]
    patched++
  }
  writeFileSync(postsFile, stableStringify(posts))

  const qFile = join(outDir, 'questions.json')
  let questions = JSON.parse(readFileSync(qFile, 'utf8'))
  const qById = new Map(questions.map(q => [String(q.id), q]))
  let added = 0, removed = 0
  for (const d of questionEdits) {
    const data = d.data()
    if (data.deleted) {
      if (qById.delete(d.id)) removed++
      continue
    }
    const { deleted: _d, _updatedAt: _u, ...rest } = data
    qById.set(d.id, { id: d.id, ...(qById.get(d.id) ?? {}), ...rest })
    added++
  }
  questions = [...qById.values()]
  writeFileSync(qFile, stableStringify(questions))
  console.log(`${patched} posts patched, ${added} questions upserted, ${removed} removed`)

  // Aliases live in one doc; the public build reads this file instead of Firestore.
  //
  // THE FIRESTORE COPY IS FROZEN AND WRONG, AND THE REPO COPY IS THE LIVE ONE.
  //
  // firestore.rules (12 Aug 2026) deny every write outside feedback/create, so add-alias.mjs can
  // no longer update the app/aliases document. It has gone on updating public/data/aliases.json,
  // which is why the two disagree — Firestore still spells five aliases all-lowercase ("jesus
  // christ", "trump", "djt", …) and never received the "rachel chandler" group at all.
  //
  // Seed 75 shipped through SKIP_EXPORT=1, so the corrected file was published and the stale dump
  // never ran. The first ordinary export after that overwrote all three groups and cross-section
  // invariant 9 ("no alias is stored all-lowercase") failed. The archive renders an alias the way
  // Q wrote it, so lowercase spellings are not a formatting nit.
  //
  // audit/aliases-owner.json is therefore canonical and this file is a derived cache, matching how
  // every other certified section already works.
  process.stdout.write('Exporting aliases… ')
  const aliasSnap = await getDoc(doc(db, 'app', 'aliases'))
  const fromFirestore = aliasSnap.exists() ? JSON.parse(aliasSnap.data().json ?? '{}') : {}
  const owner = JSON.parse(readFileSync(join(root, 'audit', 'aliases-owner.json'), 'utf8')).groups ?? {}
  // Per key the owner group REPLACES the Firestore one — it is the corrected, complete group, and
  // unioning the spellings would keep the lowercase forms alongside the right ones.
  const aliasMap = { ...fromFirestore, ...owner }
  const overridden = Object.keys(owner).filter(k => k in fromFirestore &&
    JSON.stringify(fromFirestore[k]) !== JSON.stringify(owner[k]))
  writeFileSync(join(outDir, 'aliases.json'), stableStringify(aliasMap))
  console.log(`${Object.keys(aliasMap).length} alias groups ` +
    `(${Object.keys(fromFirestore).length} from Firestore, ${overridden.length} corrected by audit/aliases-owner.json)`)
}

// ── Re-apply recovered reference content ────────────────────────────────────────
// The dump above overwrites posts.json wholesale, and `quotedPosts` does not live in
// Firestore — it was scraped back from qalerts after the original `references` field was
// destroyed at ingest. Without this step every export silently re-blanks 205 pointer-only
// drops and drops half a million characters of quoted text.
{
  const { execFileSync } = await import('node:child_process')
  const applyScript = join(root, 'scripts', 'apply-references.mjs')
  const cache = join(root, 'scripts', '.cache', 'references.jsonl')
  if (!existsSync(cache)) {
    console.error('\n❌ scripts/.cache/references.jsonl is missing — quoted post content would')
    console.error('   be lost from this export. Run: node scripts/scrape-references.mjs')
    process.exit(1)
  }
  process.stdout.write('Re-applying quoted post content… ')
  execFileSync(process.execPath, [applyScript], { stdio: 'inherit' })

  // ── DID THE CORPUS TEXT MOVE? ────────────────────────────────────────────────
  // The certified artifacts under audit/ are anchored to spans in Q's post text. Everything below
  // rebuilds the bundle FROM those artifacts, so if the dump brought different text, every section
  // would be rebuilt against drops that no longer say what they said when the section was
  // certified — and every count would still reconcile, because the counts come from the artifacts.
  //
  // This used to be covered by accident: the export re-ran the derive steps, which would have
  // re-measured against the new text. Those steps are out of the deploy path now (they were
  // re-certifying every section on every deploy — see lib/chainSteps.mjs), so the protection is
  // stated directly instead of being a side effect.
  {
    const fpFile = join(root, 'audit', 'post-text-fingerprint.json')
    const dumped = JSON.parse(readFileSync(join(outDir, 'posts.json'), 'utf8'))
    const got = fingerprintPostText(dumped)
    const want = JSON.parse(readFileSync(fpFile, 'utf8'))
    if (got.sha256 !== want.sha256) {
      const now = perPostDigests(dumped)
      const moved = []
      for (const [num, d] of Object.entries(want.perPost)) {
        const cur = now.get(Number(num))
        if (cur === undefined) moved.push(`#${num} missing from the dump`)
        else if (cur !== d) moved.push(`#${num} text changed`)
      }
      for (const num of now.keys()) if (!(num in want.perPost)) moved.push(`#${num} new in the dump`)
      console.error('\n❌ THE DUMP BROUGHT DIFFERENT POST TEXT — export stopped.')
      console.error(`   certified: ${want.posts} posts, ${want.chars.toLocaleString()} chars`)
      console.error(`   dumped   : ${got.posts} posts, ${got.chars.toLocaleString()} chars`)
      console.error(`   ${moved.length} drop(s) differ:`)
      for (const m of moved.slice(0, 25)) console.error(`     ${m}`)
      if (moved.length > 25) console.error(`     … and ${moved.length - 25} more`)
      console.error('\n   Every certified span is anchored to this text. Re-adjudicate the affected')
      console.error('   drops and re-certify before publishing:  node scripts/rederive-certified.mjs\n')
      process.exit(1)
    }
    console.log(`Post text unchanged (${got.posts} posts, ${got.chars.toLocaleString()} chars).`)
  }

  // Same reasoning for the derived analysis: the dump replaces posts.json wholesale, so every
  // certified section has to be reapplied or it vanishes silently. The ordering and the reason
  // each step is required live in scripts/lib/chainSteps.mjs, shared with rebuild-bundle.mjs so
  // the two entry points can never drift apart.
  //
  // APPLY steps only. A derive step re-certifies a section against today's detector, which is not
  // something a deploy may decide — see the note in lib/chainSteps.mjs and, for the run that made
  // this concrete, audit/entities-quote-boundary-pending.json.
  for (const step of APPLY_STEPS) {
    console.log(`
Re-running ${step}…`)
    execFileSync(process.execPath, [join(root, 'scripts', step), '--apply'], { stdio: 'inherit' })
  }
}

manifest.totalBytes = statSync(join(outDir, 'posts.json')).size + grandBytes
  - manifest.collections.posts.bytes
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

console.log(`\n✅ Total bundle: ${(grandBytes / 1024 / 1024).toFixed(2)} MB → public/data/`)
process.exit(0)
