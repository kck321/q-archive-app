// Add spellings to an alias group, in Firestore AND the baked public bundle.
//
// Usage:  node scripts/add-alias.mjs "<canonical>" "<spelling>" "<spelling>" ...
//
// Firestore holds the master copy (the desktop build reads it); public/data/aliases.json is
// what the public build reads, since it makes no Firestore calls. Both must be updated or
// the two builds disagree about what counts as the same subject.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const env = {}
for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app, 'default')

const [canonicalRaw, ...spellings] = process.argv.slice(2)
if (!canonicalRaw || spellings.length === 0) {
  console.error('usage: node scripts/add-alias.mjs "<canonical>" "<spelling>" ...')
  process.exit(1)
}
const canonical = canonicalRaw.toLowerCase().trim()

const ref = doc(db, 'app', 'aliases')
const snap = await getDoc(ref)
const map = snap.exists() ? JSON.parse(snap.data().json ?? '{}') : {}

const existing = map[canonical] ?? []
const lower = new Set([canonical, ...existing.map(s => s.toLowerCase().trim())])
const added = []
for (const sp of spellings) {
  const k = sp.toLowerCase().trim()
  if (!k || lower.has(k)) continue
  lower.add(k)
  existing.push(sp)
  added.push(sp)
}
map[canonical] = existing

console.log(`${canonical} -> ${JSON.stringify(existing)}`)
console.log(added.length ? `  added: ${added.join(', ')}` : '  nothing new to add')

if (added.length) {
  await setDoc(ref, { json: JSON.stringify(map), _updatedAt: Date.now() })
  console.log('  ✅ written to Firestore')
}

// Keep the public bundle in step — it never reads Firestore.
const outFile = join(root, 'public', 'data', 'aliases.json')
writeFileSync(outFile, JSON.stringify(map))
console.log('  ✅ public/data/aliases.json updated')
process.exit(0)
