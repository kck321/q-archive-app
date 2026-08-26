// Detect the black letterbox borders baked into Q's attachments and store a crop box for each.
//
// "there is alot of blank space in alot of the pictures... i just want the main portion of the
// picture showing on the app." Confirmed on #1410: the black bars are not a CSS artifact, they
// are pixels IN the source file — most of these are phone screenshots of a photo viewer, saved
// with the viewer's black letterboxing (and sometimes its scroll-indicator bar) still attached.
//
// We don't own these files (qalerts mirrors them; the app never re-hosts most attachments), and
// the mirror sends no CORS header, so a browser canvas can never read their pixels to crop them
// live. This script does the pixel read ONCE, server-side, and stores a crop RECTANGLE — not a
// re-encoded copy — so the app keeps loading the exact same remote image and only changes how
// much of it is shown. See src/lib/mediaCrop.ts / CroppedMedia.tsx for the render-time math.
//
// Border test, per edge, scanning inward from that edge in a downscaled copy (fast, and a real
// letterbox is large blocks of flat colour so it survives downscaling untouched):
//   a row/column counts as "border" when >= 99% of its pixels are within BORDER_TOL of the
//   image's own corner-sampled border colour (usually pure black, occasionally a dark grey UI
//   chrome) — NOT a fixed "is it dark" test, so a genuinely dark night-time photo (which has
//   texture/variance) is never mistaken for a flat letterbox.
// Capped at MAX_CROP_FRACTION per axis (combined top+bottom, combined left+right) so a
// legitimately mostly-dark photo can never lose the majority of its frame even if some band of
// it passes the flat-colour test.
//
//   node scripts/build-media-crop.mjs [--limit N] [--force]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POSTS = path.join(ROOT, 'public/data/posts.json')
const OUT_TS = path.join(ROOT, 'src/lib/mediaCrop.ts')
const MANIFEST = path.join(ROOT, 'audit/media-crop-manifest.json')

const args = process.argv.slice(2)
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity
const force = args.includes('--force')

const CONCURRENCY = 5
const DELAY_MS = 60
const SCAN_WIDTH = 400          // downscale target for the border scan — flat borders survive this fine
const BORDER_ROW_FRACTION = 0.99 // a row/col must be this uniform to count as border
const BORDER_TOL = 14            // per-channel tolerance vs. the sampled corner colour
// A safety net against a genuinely dark/night PHOTO being mistaken for a border, not the primary
// guard — that's the per-row 99%-flat test above, which a real photo's texture/noise essentially
// never passes across an entire row. 0.45 turned out too tight: #1410's own quoted image
// (f95a1aee...) is a landscape photo inside a portrait screenshot, genuinely letterboxed top AND
// bottom for a combined 65% of its height, and got silently rejected here even though every row
// it wanted to crop was flat pure black. Raised so a real photo only has to occupy 20% of an
// axis to survive, while an all-black or near-all-black image still gets caught.
const MAX_CROP_FRACTION = 0.8
const MIN_CROP_FRACTION = 0.02   // ignore borders too thin to be worth the layout math
const BOTH_AXES_FRACTION = 0.10  // a real crop on BOTH axes at once means centered artwork, not a letterbox

// Same rewriting the app does at render time (mediaUrl.ts), plus the 18 Wayback-rescued files
// (rescuedMedia.ts) — parsed as text since this is a plain .mjs script, not a TS build.
const FILE_STORE = /^(?:https?:)?\/\/[^/]*(?:8ch\.net|8kun\.net|8kun\.top|\.onion)\/file_store\/(.+)$/i
const rescuedSrc = fs.readFileSync(path.join(ROOT, 'src/lib/rescuedMedia.ts'), 'utf8')
const RESCUED = new Map([...rescuedSrc.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map(m => [m[1], m[2]]))
// Rescued (Wayback-mirrored) attachments are excluded before this is ever called — they are
// small, already-local files, not the letterboxed screenshots this script is looking for.
const resolveUrl = u => {
  if (!u) return ''
  const m = u.match(FILE_STORE)
  if (m) return `https://qalerts.app/media/${m[1].replace(/^thumb\//, '')}`
  if (u.startsWith('//')) return `https:${u}`
  return u
}

// KEYED BY THE RESOLVED (post-rewrite) url, not whatever original form a post happened to
// record — a quoted post's copy of an attachment is sometimes pre-rewritten to the qalerts
// mirror form while the source post's own `media` entry still holds the raw 8ch.net form. Both
// resolve to the exact same fetchable url via this same rewrite the app runs at render time
// (mediaUrl()), so keying by THAT is the only way every caller — regardless of which recorded
// form it started from — finds the same crop box. Storing under the original form caused #1410's
// quoted image to miss its own crop entirely: post #1409 (the same image's source post) won the
// insertion race for the pre-rewrite key, and the quoted copy's different recorded form never
// matched anything.
const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'))
const fetchUrls = new Set()
for (const p of posts) {
  for (const m of [...(p.media ?? []), ...(p.refMedia ?? []), ...(p.quotedPosts ?? []).flatMap(q => q.media ?? [])]) {
    if (!m?.url || RESCUED.has(m.url)) continue   // rescued files are small/local already, not letterboxed screenshots
    const resolved = resolveUrl(m.url)
    if (resolved) fetchUrls.add(resolved)
  }
}

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
const done = !force && fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {}

const queue = [...fetchUrls].filter(u => !(u in done)).slice(0, limit)
console.log(`attachments referenced : ${fetchUrls.size}`)
console.log(`already scanned        : ${Object.keys(done).length}`)
console.log(`to scan                : ${queue.length}\n`)

const sleep = ms => new Promise(r => setTimeout(r, ms))
let cropped = 0, uncropped = 0, failed = 0, completed = 0
const started = Date.now()

// How far a border extends inward, in pixels of the SCAN buffer, from one edge — walking
// row-by-row (or col-by-col) while each line stays within tolerance of `ref`.
//
// TOLERANT of a short run of non-matching lines, not just a strict "first miss stops the scan":
// #1410's own Clas_1.png has a thin grey scroll-indicator pill sitting a few pixels above the
// true bottom edge, INSIDE an otherwise large solid-black band. A strict scan starting at the
// bottom edge hit that pill on step 0, immediately gave up, and reported essentially no bottom
// border at all — leaving the real ~330px black band (everything behind the pill) untouched. A
// pill or a status-bar icon is still dead space the border extends past, so the scan is allowed
// to walk THROUGH up to GAP_TOLERANCE consecutive non-matching lines before it commits to
// "real content starts here" — `depth` only ever advances to a line that itself matched, so a
// tolerated gap never gets counted as removed unless a matching line was found beyond it.
function borderDepth(raw, width, height, channels, ref, dir) {
  const within = (o) => Math.abs(raw[o] - ref[0]) <= BORDER_TOL && Math.abs(raw[o + 1] - ref[1]) <= BORDER_TOL && Math.abs(raw[o + 2] - ref[2]) <= BORDER_TOL
  const limit = dir === 'top' || dir === 'bottom' ? height : width
  const lineLen = dir === 'top' || dir === 'bottom' ? width : height
  const gapTolerance = Math.max(4, Math.round(limit * 0.03))
  let depth = 0, sinceMatch = 0
  for (let step = 0; step < limit; step++) {
    let hits = 0
    if (dir === 'top' || dir === 'bottom') {
      const y = dir === 'top' ? step : height - 1 - step
      for (let x = 0; x < width; x++) { if (within((y * width + x) * channels)) hits++ }
    } else {
      const x = dir === 'left' ? step : width - 1 - step
      for (let y = 0; y < height; y++) { if (within((y * width + x) * channels)) hits++ }
    }
    if (hits / lineLen >= BORDER_ROW_FRACTION) {
      depth = step + 1
      sinceMatch = 0
    } else if (++sinceMatch > gapTolerance) {
      break
    }
  }
  return depth
}

async function handle(fetchUrl) {
  try {
    const res = await fetch(fetchUrl, { headers: { 'User-Agent': 'q-archive-app/1.0 (crop scan)' }, signal: AbortSignal.timeout(45000) })
    if (!res.ok) { failed++; done[fetchUrl] = null; return }
    const buf = Buffer.from(await res.arrayBuffer())
    const full = sharp(buf)
    const meta = await full.metadata()
    const naturalWidth = meta.width ?? 0, naturalHeight = meta.height ?? 0
    if (!naturalWidth || !naturalHeight) { failed++; done[fetchUrl] = null; return }

    const scale = Math.min(1, SCAN_WIDTH / naturalWidth)
    const scanW = Math.max(1, Math.round(naturalWidth * scale))
    const scanH = Math.max(1, Math.round(naturalHeight * scale))
    const { data: raw, info } = await sharp(buf)
      .resize({ width: scanW, height: scanH, fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Sample the border colour from the four corner pixels — usually pure black, occasionally
    // a dark grey status-bar colour. Requires the corners to roughly agree; if they don't, this
    // image doesn't have a uniform border to detect at all.
    const px = (x, y) => { const o = (y * info.width + x) * info.channels; return [raw[o], raw[o + 1], raw[o + 2]] }
    const corners = [px(0, 0), px(info.width - 1, 0), px(0, info.height - 1), px(info.width - 1, info.height - 1)]
    const ref = corners[0]
    const cornersAgree = corners.every(c => Math.abs(c[0] - ref[0]) <= BORDER_TOL && Math.abs(c[1] - ref[1]) <= BORDER_TOL && Math.abs(c[2] - ref[2]) <= BORDER_TOL)
    if (!cornersAgree) { done[fetchUrl] = null; uncropped++; return }

    let top = borderDepth(raw, info.width, info.height, info.channels, ref, 'top')
    let bottom = borderDepth(raw, info.width, info.height, info.channels, ref, 'bottom')
    let left = borderDepth(raw, info.width, info.height, info.channels, ref, 'left')
    let right = borderDepth(raw, info.width, info.height, info.channels, ref, 'right')

    // Safety cap — never trust a combined axis crop past MAX_CROP_FRACTION.
    if ((top + bottom) / scanH > MAX_CROP_FRACTION) { top = 0; bottom = 0 }
    if ((left + right) / scanW > MAX_CROP_FRACTION) { left = 0; right = 0 }

    const topF = top / scanH, bottomF = bottom / scanH, leftF = left / scanW, rightF = right / scanW
    if (topF + bottomF < MIN_CROP_FRACTION && leftF + rightF < MIN_CROP_FRACTION) {
      done[fetchUrl] = null; uncropped++; return
    }

    // BOTH axes wanting a real crop is centered ARTWORK, not letterboxing — reject.
    //
    // A phone screenshot's letterbox comes from fitting one photo aspect into a different
    // screen aspect, which only ever pads ONE axis (top+bottom for a landscape photo in a
    // portrait screen, or the reverse) — the OTHER axis fills edge to edge. A skull logo
    // centered on a solid black wallpaper (#…2c7bdab5…) passes every per-row flatness test on
    // all four edges just as cleanly as a real letterbox does, and would otherwise get cropped
    // down to a postage stamp of just the logo, discarding a deliberately-designed image.
    // BOTH_AXES_FRACTION is deliberately far looser than MIN_CROP_FRACTION: a few stray percent
    // of incidental black margin on the "wrong" axis is normal and must not trip this reject.
    if (topF + bottomF > BOTH_AXES_FRACTION && leftF + rightF > BOTH_AXES_FRACTION) {
      done[fetchUrl] = null; uncropped++; return
    }

    const cropX = Math.round(leftF * naturalWidth)
    const cropY = Math.round(topF * naturalHeight)
    const cropWidth = naturalWidth - cropX - Math.round(rightF * naturalWidth)
    const cropHeight = naturalHeight - cropY - Math.round(bottomF * naturalHeight)
    if (cropWidth < 10 || cropHeight < 10) { done[fetchUrl] = null; uncropped++; return }

    done[fetchUrl] = { naturalWidth, naturalHeight, cropX, cropY, cropWidth, cropHeight }
    cropped++
  } catch {
    failed++
    done[fetchUrl] = null
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
        `\r  ${completed}/${queue.length}  cropped ${cropped}  unchanged ${uncropped}  failed ${failed}  ` +
        `eta ${Math.floor(eta / 60)}m${String(eta % 60).padStart(2, '0')}s   `
      )
      fs.writeFileSync(MANIFEST, JSON.stringify(done))
    }
    await sleep(DELAY_MS)
  }
}

const lanes = Array.from({ length: CONCURRENCY }, (_, i) => queue.filter((_, j) => j % CONCURRENCY === i))
await Promise.all(lanes.map(worker))
fs.writeFileSync(MANIFEST, JSON.stringify(done))

console.log(`\n\nscanned   : ${Object.keys(done).length}`)
console.log(`cropped   : ${Object.values(done).filter(Boolean).length}`)
console.log(`unchanged : ${Object.values(done).filter(v => v === null).length}`)

// ── Emit the TS module, keyed by the RESOLVED (post-rewrite) url ──────────────────────────────
const entries = Object.entries(done).filter(([, crop]) => crop).sort((a, b) => a[0].localeCompare(b[0]))

const lines = entries.map(([url, c]) =>
  `  ${JSON.stringify(url)}: { naturalWidth: ${c.naturalWidth}, naturalHeight: ${c.naturalHeight}, cropX: ${c.cropX}, cropY: ${c.cropY}, cropWidth: ${c.cropWidth}, cropHeight: ${c.cropHeight} },`)

const ts = `// Crop boxes for the black letterbox borders baked into Q's attachments — generated by
// scripts/build-media-crop.mjs, not hand-edited. See that script for the detection method and
// src/components/CroppedMedia.tsx for how a box here becomes the on-screen crop.
//
// Keyed by the RESOLVED url — mediaUrl(m.url), the same rewrite the app applies at render time —
// NOT the raw recorded url. Two posts can record the very same image two different ways (a
// source post's own 8ch.net-form entry vs. a quote of it already rewritten to the qalerts mirror
// form), and both must find this same box.
export type MediaCrop = { naturalWidth: number; naturalHeight: number; cropX: number; cropY: number; cropWidth: number; cropHeight: number }

export const MEDIA_CROP: Record<string, MediaCrop> = {
${lines.join('\n')}
}
`
fs.writeFileSync(OUT_TS, ts)
console.log(`\n${entries.length} crop boxes written -> ${path.relative(ROOT, OUT_TS)}`)
