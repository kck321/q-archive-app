// Prove the archive still matches its source, field by field.
//
// Downloads qalerts' public dataset and compares every post's text, tripcode, timestamp and
// attachments against ours. Run after any ingest or export change.
//
//   node scripts/audit-vs-qalerts.mjs [--refresh]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POSTS = path.join(ROOT, 'public', 'data', 'posts.json')
const CACHE = path.join(ROOT, 'scripts', '.cache', 'qalerts-posts.json')
const SOURCE = 'https://qalerts.app/data/json/posts.json'

if (process.argv.includes('--refresh') || !fs.existsSync(CACHE)) {
  process.stdout.write('Downloading qalerts dataset… ')
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(180000) })
  if (!res.ok) { console.error(`failed: HTTP ${res.status}`); process.exit(1) }
  fs.mkdirSync(path.dirname(CACHE), { recursive: true })
  fs.writeFileSync(CACHE, Buffer.from(await res.arrayBuffer()))
  console.log(`${(fs.statSync(CACHE).size / 1e6).toFixed(1)} MB`)
}

const ours = JSON.parse(fs.readFileSync(POSTS, 'utf8'))
const theirs = JSON.parse(fs.readFileSync(CACHE, 'utf8'))

// Join on BOARD + post id, host-agnostic.
//
// Matching on the bare "#anchor" is wrong: post ids are only unique within a board, so
// /qresearch/, /cbts/ and /pol/ ids collide and ~97 posts silently pair with the wrong
// record — which looks exactly like a data corruption bug. The host varies across
// 8ch.net / 8kun.net / 8kun.top for the same post, and some links carry a doubled slash or
// "res/undefined.html", so both are normalised away.
const key = link => {
  const m = (link ?? '').replace(/([^:])\/\/+/g, '$1/').match(/^https?:\/\/[^/]+\/([^/]+)\/.*#(\d+)/i)
  return m ? `${m[1].toLowerCase()}#${m[2]}` : null
}

const theirByKey = new Map()
for (const t of theirs) { const k = key(t.link); if (k) theirByKey.set(k, t) }

const norm = s => (s ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
// Attachments are compared by content hash: the recorded host differs (8ch.net, the onion
// mirror, qalerts) for what is byte-for-byte the same file.
const hashOf = url => (String(url ?? '').match(/([0-9a-f]{40,})/i)?.[1] ?? String(url ?? '')).toLowerCase()
const hashes = list => [...new Set((list ?? []).map(m => hashOf(m?.url)))].sort()

const diffs = { text: [], media: [], trip: [], time: [], unmatched: [] }
for (const p of ours) {
  const t = theirByKey.get(key(p.link))
  if (!t) { diffs.unmatched.push(p.postNum); continue }
  if (norm(p.text) !== norm(t.text)) diffs.text.push(`#${p.postNum}  ours ${norm(p.text).length} chars vs ${norm(t.text).length}`)
  if ((p.trip ?? '') !== (t.trip ?? '')) diffs.trip.push(`#${p.postNum}  ${JSON.stringify(p.trip)} vs ${JSON.stringify(t.trip)}`)
  if (Math.abs((p.timestamp ?? 0) - (t.timestamp ?? 0)) > 1) diffs.time.push(`#${p.postNum}  ${p.timestamp} vs ${t.timestamp}`)
  const a = hashes(p.media), b = hashes(t.media)
  if (a.join() !== b.join()) diffs.media.push(`#${p.postNum}  ours ${a.length} file(s) vs ${b.length}`)
}

console.log(`\nours ${ours.length}   qalerts ${theirs.length}   joined ${ours.length - diffs.unmatched.length}\n`)
let clean = true
for (const [label, list] of Object.entries(diffs)) {
  const ok = list.length === 0
  clean &&= ok
  console.log(`${ok ? '✅' : '❌'} ${label.padEnd(10)} ${list.length}`)
  for (const l of list.slice(0, 15)) console.log(`      ${l}`)
  if (list.length > 15) console.log(`      …and ${list.length - 15} more`)
}
console.log(clean ? '\nArchive matches the source on every compared field.' : '\nDifferences found — investigate before publishing.')
process.exit(clean ? 0 : 1)
