// Point-in-time snapshot of the data bundle, so a bad bulk operation is recoverable.
//
//   node scripts/snapshot.mjs            → create a snapshot
//   node scripts/snapshot.mjs --list     → list snapshots
//   node scripts/snapshot.mjs --restore <name>
//
// WHY separate from git: git covers code, and public/data is 8 MB of JSON that changes on
// every export. Snapshots are cheap, explicit, and restore in one command without touching
// code history. Kept OUTSIDE public/ so they never ship to the website.
import { readdirSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataDir = join(root, 'public', 'data')
const snapRoot = join(root, '.snapshots')

const arg = process.argv[2]

function list() {
  if (!existsSync(snapRoot)) return []
  return readdirSync(snapRoot).filter(d => statSync(join(snapRoot, d)).isDirectory()).sort().reverse()
}

function humanSize(dir) {
  let n = 0
  for (const f of readdirSync(dir)) n += statSync(join(dir, f)).size
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

if (arg === '--list') {
  const snaps = list()
  if (!snaps.length) { console.log('No snapshots yet. Run: node scripts/snapshot.mjs'); process.exit(0) }
  console.log('Snapshots (newest first):')
  for (const s of snaps) console.log(`  ${s}   ${humanSize(join(snapRoot, s))}`)
  process.exit(0)
}

if (arg === '--restore') {
  const name = process.argv[3]
  const from = name ? join(snapRoot, name) : null
  if (!from || !existsSync(from)) {
    console.error('Usage: node scripts/snapshot.mjs --restore <name>')
    console.error('Available:'); for (const s of list()) console.error('  ' + s)
    process.exit(1)
  }
  // Snapshot the CURRENT state first — restoring should never be the destructive step.
  const safety = join(snapRoot, `pre-restore-${stamp()}`)
  mkdirSync(safety, { recursive: true })
  for (const f of readdirSync(dataDir)) copyFileSync(join(dataDir, f), join(safety, f))

  for (const f of readdirSync(from)) copyFileSync(join(from, f), join(dataDir, f))
  console.log(`✅ Restored public/data from ${name}`)
  console.log(`   (previous state saved as ${safety.split(/[\\/]/).pop()})`)
  process.exit(0)
}

function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

const label = arg && !arg.startsWith('--') ? `-${arg.replace(/[^a-z0-9-]/gi, '')}` : ''
const dest = join(snapRoot, `${stamp()}${label}`)
mkdirSync(dest, { recursive: true })
let n = 0
for (const f of readdirSync(dataDir)) { copyFileSync(join(dataDir, f), join(dest, f)); n++ }
console.log(`✅ Snapshot ${dest.split(/[\\/]/).pop()} — ${n} files, ${humanSize(dest)}`)
console.log('   restore with: node scripts/snapshot.mjs --restore ' + dest.split(/[\\/]/).pop())
