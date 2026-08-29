// Upload the offline media bundle to the Cloudflare R2 bucket behind media.qdrops.app.
//
// Owner directive 2026-08-28: "i really want to take qalerts out of the mix on my app."
// The bundle (media-bundle/, built by build-media-bundle.mjs) already holds every attachment
// re-encoded — this ships those bytes to our own hosting so the web app can serve them via
// VITE-free constant base in lib/localMedia.ts. Idempotent: HEADs each key first and skips
// ones already present with the same size, so a re-run only sends what is missing.
//
//   node scripts/upload-media-r2.mjs [--force]
//
// Credentials come from .env (R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
// R2_BUCKET) — gitignored, never in the repo.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = path.join(ROOT, 'media-bundle')

// Minimal .env reader — no dependency, and the deploy scripts read .env the same way.
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Missing R2_* credentials in .env'); process.exit(2)
}

const force = process.argv.includes('--force')
const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.json': 'application/json' }

const files = fs.readdirSync(BUNDLE).filter(f => fs.statSync(path.join(BUNDLE, f)).isFile())
console.log(`${files.length} files in media-bundle → r2://${R2_BUCKET}`)

let done = 0, skipped = 0, failed = 0
const CONCURRENCY = 8
const queue = [...files]

async function worker() {
  for (;;) {
    const f = queue.shift()
    if (!f) return
    const full = path.join(BUNDLE, f)
    const size = fs.statSync(full).size
    try {
      if (!force) {
        try {
          const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: f }))
          if (Number(head.ContentLength) === size) { skipped++; continue }
        } catch { /* not there yet — upload */ }
      }
      const ext = path.extname(f).toLowerCase()
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: f,
        Body: fs.readFileSync(full),
        ContentType: TYPES[ext] ?? 'application/octet-stream',
        // Image names are content hashes — safe to cache forever. The manifest is state,
        // not content-addressed, so it gets an hour.
        CacheControl: f === 'manifest.json' ? 'public, max-age=3600' : 'public, max-age=31536000, immutable',
      }))
      done++
      if ((done + skipped) % 100 === 0) console.log(`  ${done + skipped}/${files.length} (${done} uploaded, ${skipped} already there)`)
    } catch (err) {
      failed++
      console.error(`  FAILED ${f}: ${String(err?.message ?? err)}`)
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
console.log(`\nuploaded ${done} · already present ${skipped} · failed ${failed} · total ${files.length}`)
process.exit(failed ? 1 : 0)
