// Preserve, unmodified, the work of a concurrent lane that is NOT part of the Directives session.
//
// Read-only over the repo: it copies files into audit/preserved-lanes/<stamp>/ and records a
// hash + mtime for each. It never writes back, never deletes, and refuses to overwrite an
// existing preservation so a re-run cannot clobber an earlier one.
//
//   node scripts/preserve-unknown-lane.mjs <stampDir>
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stamp = process.argv[2] ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16) + 'Z'
const PD = path.join(ROOT, 'audit/preserved-lanes', stamp)
fs.mkdirSync(PD, { recursive: true })

const FILES = [
  // the three hand-maintained owner-ruling files no script in this repo writes
  'audit/resolution-owner-resolved.json',
  'audit/entities-owner-rulings.json',
  'audit/resolution-owner-notes.json',
  // the certification the other lane produced at 12:27 UTC, and its evidence
  'audit/certification-manifest.json',
  'audit/cross-section-integrity.json',
  'audit/seed-fingerprint.json',
  'audit/relationships-qa.json',
  'audit/search-index-qa.md',
  'audit/notation-glossary.json',
  'audit/acronym-definitions.json',
  'audit/reference-audit-parsed.json',
  // the derived artifacts that carry its Resolution Center and Entity work
  'public/data/resolution-queue.json',
  'public/data/entities.json',
  'public/data/relationships.json',
  'public/data/search-index.json',
  'public/data/glossary.json',
  // scripts it edited alongside this session
  'scripts/parse-reference-audit.mjs',
  'scripts/apply-reference-audit.mjs',
  'scripts/apply-entities.mjs',
  'scripts/build-resolution-queue.mjs',
  'scripts/build-relationships.mjs',
]

const records = []
let skipped = 0
for (const f of FILES) {
  const src = path.join(ROOT, f)
  if (!fs.existsSync(src)) continue
  const dest = path.join(PD, f.split(/[/\\]/).join('__'))
  if (fs.existsSync(dest)) { skipped++; continue }          // never overwrite a prior preservation
  const buf = fs.readFileSync(src)
  const st = fs.statSync(src)
  fs.writeFileSync(dest, buf)
  records.push({
    file: f,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    bytes: st.size,
    mtime: st.mtime.toISOString(),
    preservedAs: path.basename(dest),
  })
}

const manifestPath = path.join(PD, 'HASHES.json')
if (!fs.existsSync(manifestPath)) {
  fs.writeFileSync(manifestPath, JSON.stringify({
    preservedAt: new Date().toISOString(),
    why: 'A concurrent lane wrote these between 11:52 and 12:27 UTC on 16 Aug 2026, outside the Q Directives session. '
      + 'It ran a full rebuild chain and a certification that absorbed the Directives migration together with its own '
      + 'Resolution Center and Entity work. Preserved byte-for-byte for independent review. NOT approved, NOT deployed.',
    records,
  }, null, 1))
}

console.log(`preserved ${records.length} file(s) -> audit/preserved-lanes/${stamp}` + (skipped ? `  (${skipped} already preserved, left untouched)` : ''))
for (const r of records) console.log(`  ${r.mtime}  ${String(r.bytes).padStart(9)}  ${r.file}`)
