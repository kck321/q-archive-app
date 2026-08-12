// Build the offline image bundle for the desktop app.
//
// Downloads every attachment once and re-encodes it for reading, then the desktop build
// ships them so the archive works with no internet and stops hotlinking qalerts' server.
//
// Why re-encode: these are raw phone screenshots. Measured on 29 sampled images, the
// originals total ~1.24 GB and come out at ~155 MB as JPEG with no visible loss at reading
// size — one 1125x2436 PNG goes from 4.9 MB to 121 KB.
//
// Why JPEG and not WebP: WebP would be ~118 MB, but a browser saves what it is given, so
// "right-click → Save image as" would hand every user a .webp. People re-share these drops,
// and .webp still trips up older tools and some upload forms. 37 MB is not worth that.
//
// Small images are left ALONE: below the threshold the saving is negligible and JPEG
// softens small text, which matters for the screenshots that are mostly words.
//
//   node scripts/build-media-bundle.mjs [--limit N] [--force]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'media-bundle')
const POSTS = path.join(ROOT, 'public', 'data', 'posts.json')

const MAX_WIDTH = 1600        // nothing in the archive needs more to read
const QUALITY = 82
const KEEP_AS_IS_UNDER = 150 * 1024
const CONCURRENCY = 4         // polite: one person's archive, not a CDN
const DELAY_MS = 80

const args = process.argv.slice(2)
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity
const force = args.includes('--force')

// Same rewriting the app does, so the bundle covers exactly what the app asks for.
const FILE_STORE = /^(?:https?:)?\/\/[^/]*(?:8ch\.net|8kun\.net|8kun\.top|\.onion)\/file_store\/(.+)$/i
const mediaUrl = u => {
  if (!u) return ''
  const m = u.match(FILE_STORE)
  if (m) return `https://qalerts.app/media/${m[1]}`
  if (u.startsWith('//')) return `https:${u}`
  return u
}

const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'))
const urls = new Set()
for (const p of posts) {
  for (const m of [...(p.media ?? []), ...(p.refMedia ?? []), ...(p.quotedPosts ?? []).flatMap(q => q.media ?? [])]) {
    const u = mediaUrl(m?.url)
    if (u) urls.add(u)
  }
}

fs.mkdirSync(OUT, { recursive: true })
const MANIFEST = path.join(OUT, 'manifest.json')
const done = !force && fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {}

// Local name keyed by the ORIGINAL url, since that is what the app has at render time.
const queue = [...urls].filter(u => !done[u]).slice(0, limit)
console.log(`attachments referenced : ${urls.size}`)
console.log(`already bundled        : ${Object.keys(done).length}`)
console.log(`to fetch               : ${queue.length}\n`)

const sleep = ms => new Promise(r => setTimeout(r, ms))
let ok = 0, failed = 0, skipped = 0, bytesIn = 0, bytesOut = 0, completed = 0
const started = Date.now()

async function handle(url) {
  const base = (url.split('/').pop() ?? '').split('?')[0]
  const stem = base.replace(/\.[a-z0-9]+$/i, '') || String(ok)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'q-archive-app/1.0 (offline bundle build)' },
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) { failed++; return }
    const buf = Buffer.from(await res.arrayBuffer())
    bytesIn += buf.length

    // Non-images (a handful of mp4/gif) are copied through untouched.
    if (!/\.(jpe?g|png)$/i.test(base)) {
      fs.writeFileSync(path.join(OUT, base), buf)
      done[url] = base; bytesOut += buf.length; skipped++; return
    }

    if (buf.length < KEEP_AS_IS_UNDER) {
      fs.writeFileSync(path.join(OUT, base), buf)
      done[url] = base; bytesOut += buf.length; skipped++; return
    }

    const meta = await sharp(buf).metadata()
    let pipe = sharp(buf)
    if ((meta.width ?? 0) > MAX_WIDTH) pipe = pipe.resize({ width: MAX_WIDTH, withoutEnlargement: true })
    const out = await pipe.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer()

    // If re-encoding somehow made it bigger, keep the original.
    if (out.length >= buf.length) {
      fs.writeFileSync(path.join(OUT, base), buf)
      done[url] = base; bytesOut += buf.length; skipped++; return
    }
    const name = `${stem}.jpg`
    fs.writeFileSync(path.join(OUT, name), out)
    done[url] = name; bytesOut += out.length; ok++
  } catch {
    failed++
  }
}

async function worker(items) {
  for (const u of items) {
    await handle(u)
    completed++
    if (completed % 25 === 0 || completed === queue.length) {
      const rate = completed / ((Date.now() - started) / 1000)
      const eta = Math.round((queue.length - completed) / Math.max(rate, 0.01))
      process.stdout.write(
        `\r  ${completed}/${queue.length}  converted ${ok}  kept ${skipped}  failed ${failed}  ` +
        `${(bytesOut / 1048576).toFixed(0)}MB out  eta ${Math.floor(eta / 60)}m${String(eta % 60).padStart(2, '0')}s   `
      )
      fs.writeFileSync(MANIFEST, JSON.stringify(done))
    }
    await sleep(DELAY_MS)
  }
}

const lanes = Array.from({ length: CONCURRENCY }, (_, i) => queue.filter((_, j) => j % CONCURRENCY === i))
await Promise.all(lanes.map(worker))
fs.writeFileSync(MANIFEST, JSON.stringify(done))

const mb = b => (b / 1048576).toFixed(1)
console.log(`\n\nbundled  : ${Object.keys(done).length} files`)
console.log(`re-encoded: ${ok}   left as-is: ${skipped}   failed: ${failed}`)
console.log(`downloaded: ${mb(bytesIn)} MB  →  bundle: ${mb(bytesOut)} MB` +
  (bytesIn ? `  (${Math.round((1 - bytesOut / bytesIn) * 100)}% smaller)` : ''))
console.log(`\n→ ${path.relative(ROOT, OUT)}`)
