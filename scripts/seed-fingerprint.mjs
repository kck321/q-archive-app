// Make "changed the data, forgot the seed" impossible to ship.
//
// THE FAILURE THIS ENDS. Data the app seeds into IndexedDB is only re-read when SEED_VERSION
// changes. Change posts.json without bumping it and every server-side check passes — the bundle is
// right, the manifest is right, a fresh profile is right — while every returning reader, the owner
// included, keeps yesterday's copy. It has happened at seeds 4, 5, 6 and again on the Emphasis
// withdrawal, where the owner had to report the SAME defect three times because the data was fixed
// and their browser could not receive it.
//
// So the seed is now pinned to a fingerprint of what it seeds. Change the data and the fingerprint
// moves; if SEED_VERSION did not move with it, the invariants fail and say why.
//
//   node scripts/seed-fingerprint.mjs            report
//   node scripts/seed-fingerprint.mjs --update   record the current state (after a DELIBERATE bump)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const FILE = path.join(ROOT, 'audit', 'seed-fingerprint.json')

// Exactly what localData.ts seeds. A file the app does not seed does not belong here: a false
// alarm trains people to bump the seed for nothing, which is its own kind of broken.
export const SEEDED_FILES = ['posts.json', 'questions.json', 'topics.json', 'analysisConfirmed.json',
  'entities.json', 'themes.json', 'codes.json', 'emphasis.json', 'evidence.json']

export function seedVersion() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'localData.ts'), 'utf8')
  return Number((src.match(/export const SEED_VERSION = (\d+)/) ?? [])[1] ?? -1)
}

/** Semantic hash — key order does not matter, so a re-serialisation is not mistaken for a change. */
export function fingerprint() {
  const stable = v => Array.isArray(v) ? v.map(stable)
    : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((a, k) => (a[k] = stable(v[k]), a), {})
      : v
  const h = crypto.createHash('sha256')
  const per = {}
  for (const f of SEEDED_FILES) {
    const p = path.join(DATA, f)
    if (!fs.existsSync(p)) continue
    const one = crypto.createHash('sha256')
      .update(JSON.stringify(stable(JSON.parse(fs.readFileSync(p, 'utf8'))))).digest('hex')
    per[f] = one
    h.update(`${f}:${one}`)
  }
  return { sha256: h.digest('hex'), per }
}

export function readRecord() {
  return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null
}

/**
 * The gate. Returns { ok, reason, changed } — ok is false when seeded data moved and the seed
 * version did not, which is exactly the state that ships an invisible change.
 */
export function checkSeedFingerprint() {
  const rec = readRecord()
  const now = fingerprint()
  const seed = seedVersion()
  if (!rec) return { ok: true, reason: 'no record yet — this run establishes the baseline', changed: [] }
  const changed = Object.keys(now.per).filter(f => rec.per?.[f] && rec.per[f] !== now.per[f])
  if (now.sha256 === rec.sha256) {
    return { ok: seed >= rec.seedVersion, reason: seed >= rec.seedVersion ? 'unchanged' : `SEED_VERSION went backwards (${rec.seedVersion} -> ${seed})`, changed: [] }
  }
  if (seed > rec.seedVersion) return { ok: true, reason: `seeded data changed and SEED_VERSION moved ${rec.seedVersion} -> ${seed}`, changed }
  return {
    ok: false,
    reason: `seeded data CHANGED but SEED_VERSION is still ${seed} — returning readers keep the old copy`,
    changed,
  }
}

if (import.meta.url === `file://${process.argv[1].split(path.sep).join('/')}` || process.argv[1]?.endsWith('seed-fingerprint.mjs')) {
  const r = checkSeedFingerprint()
  const now = fingerprint()
  console.log(`\nSEED FINGERPRINT\n  SEED_VERSION : ${seedVersion()}\n  recorded     : ${readRecord()?.seedVersion ?? '—'}`)
  console.log(`  ${r.ok ? '✅' : '❌'} ${r.reason}`)
  if (r.changed.length) console.log(`  changed      : ${r.changed.join(', ')}`)
  if (process.argv.includes('--update')) {
    fs.writeFileSync(FILE, JSON.stringify({
      note: 'Fingerprint of everything the app seeds into IndexedDB, pinned to the SEED_VERSION that shipped it. Updated ONLY as part of a deliberate seed bump — see scripts/seed-fingerprint.mjs.',
      seedVersion: seedVersion(), sha256: now.sha256, per: now.per,
    }, null, 1))
    console.log(`\n  recorded seed ${seedVersion()} → audit/seed-fingerprint.json\n`)
  } else if (!r.ok) {
    console.error('\n  Bump SEED_VERSION in src/lib/localData.ts, then re-run with --update.\n')
    process.exit(1)
  } else {
    console.log('')
  }
}
