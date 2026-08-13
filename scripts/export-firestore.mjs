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

const manifest = { exportedAt: new Date().toISOString(), collections: {} }
let grandBytes = 0

for (const name of COLLECTIONS) {
  process.stdout.write(`Exporting ${name}… `)
  const snap = await getDocs(collection(db, name))
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  const file = join(outDir, `${name}.json`)
  writeFileSync(file, JSON.stringify(docs))
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
  writeFileSync(postsFile, JSON.stringify(posts))

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
  writeFileSync(qFile, JSON.stringify(questions))
  console.log(`${patched} posts patched, ${added} questions upserted, ${removed} removed`)

  // Aliases live in one doc; the public build reads this file instead of Firestore.
  process.stdout.write('Exporting aliases… ')
  const aliasSnap = await getDoc(doc(db, 'app', 'aliases'))
  const aliasMap = aliasSnap.exists() ? JSON.parse(aliasSnap.data().json ?? '{}') : {}
  writeFileSync(join(outDir, 'aliases.json'), JSON.stringify(aliasMap))
  console.log(`${Object.keys(aliasMap).length} alias groups`)
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

  // Same reasoning for the derived analysis: the dump replaces posts.json wholesale, so the
  // recall backfill and the emphasis detection have to be reapplied or they vanish silently.
  // Both are deterministic and idempotent, so re-running is always safe.
  // apply-questions.mjs rebuilds the 6,299 certified base from audit/questions-final.json;
  // apply-questions-final.mjs then layers on the 143 occurrences the uncovered-"?" audit
  // recovered, taking it to 6,442. They MUST run in that order and both must run — dropping
  // the second one silently reverts the live count to 6,299 on the next export.
  // apply-directives.mjs must run LAST: it rewrites posts.json actionRequests from the
  // certified set, and the earlier steps rewrite posts.json too. Dropping it silently reverts
  // Directives to the old extractor output on the next export, exactly as dropping
  // apply-questions-final.mjs would revert Questions to 6,299.
  for (const step of ['backfill-analysis.mjs', 'detect-emphasis.mjs', 'apply-questions.mjs', 'apply-questions-final.mjs', 'apply-directives.mjs']) {
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
