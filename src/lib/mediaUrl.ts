// Image URLs for post attachments.
//
// Almost none of the recorded hosts still serve these files. 8chan shut down in 2019 and
// `media.8ch.net` went with it; `media.8kun.net` no longer resolves; 8kun did not keep the
// old file store, so `8kun.top/file_store/<hash>` times out; and 475 attachments were
// recorded from a Tor `.onion` mirror, which no browser can load at all.
//
// qalerts mirrors every one of them under the SAME content hash, so any `file_store/<hash>`
// URL can be pointed there regardless of which host recorded it. Verified HTTP 200 across a
// spread sample, including the onion-hosted files (1.5 MB and 507 KB responses).
//
// Done at RENDER time rather than by editing the bundle: reversible, applies to `refMedia`
// and quoted-post media too, leaves the recorded original URL intact as provenance, and
// survives the next Firestore export overwriting posts.json.
//
// Host census (Aug 2026), 2,003 attachment entries:
//   media.8ch.net                 1300  dead (8chan gone)      → rewritten
//   media.jthnx5wyvjvzsxtu.onion   475  Tor-only, unloadable   → rewritten
//   qalerts.app                    133  live                   → untouched
//   media.8kun.top                  57  times out              → rewritten
//   img.4plebs.org                  26  live                   → untouched
//   media.8kun.net                  11  does not resolve       → rewritten
//   archive.fo                       1  live                   → untouched

import { RESCUED_MEDIA } from './rescuedMedia'

// Any host's file_store, including protocol-relative ("//media.…") URLs, which are how the
// onion and 8kun.top entries were recorded.
const FILE_STORE = /^(?:https?:)?\/\/[^/]*(?:8ch\.net|8kun\.net|8kun\.top|\.onion)\/file_store\/(.+)$/i

/**
 * Offline image bundle (desktop app only).
 *
 * The desktop build ships every attachment, re-encoded, so the archive works with no
 * internet — and so the app stops streaming ~1.24 GB of images off qalerts' server on other
 * people's behalf. `initLocalMedia()` fills this in at startup; on the web it stays null and
 * everything falls through to the mirror exactly as before.
 */
let localBase: string | null = null
let localNames: Record<string, string> | null = null
// bundled filename → the MIRROR form of its original URL. Per-image records (the crop
// manifest) are keyed by the mirror form, so a self-hosted URL needs a way back to it.
let localReverse: Record<string, string> | null = null

export function setLocalMedia(base: string, manifest: Record<string, string>): void {
  localBase = base.endsWith('/') ? base : `${base}/`
  localNames = manifest
  localReverse = {}
  for (const [orig, file] of Object.entries(manifest)) localReverse[file] = remoteUrl(orig)
}

/**
 * The key other per-image records are indexed by, for an already-resolved URL.
 *
 * MEDIA_CROP is keyed by the mirror form (qalerts.app/media/<hash>). While the self-hosted
 * bundle is active, mediaUrl() resolves to media.qdrops.app and a direct MEDIA_CROP lookup
 * misses — every letterbox crop silently vanishes. This maps a self-hosted URL back through
 * the manifest to the mirror key; any other URL is returned unchanged.
 */
export function cropKey(resolved: string): string {
  if (localBase && localReverse && resolved.startsWith(localBase)) {
    return localReverse[resolved.slice(localBase.length)] ?? resolved
  }
  return resolved
}

/** A loadable URL for an attachment, rewriting hosts that no longer serve. */
export function mediaUrl(url: string | undefined | null): string {
  if (!url) return ''

  // Prefer the bundled copy. Keyed by the ORIGINAL url because that is what a post holds.
  if (localBase && localNames) {
    const local = localNames[url] ?? localNames[remoteUrl(url)]
    if (local) return localBase + local
  }

  // Then anything we rescued and publish ourselves — the 4plebs images no surviving host
  // serves. Checked before the mirror because the mirror is exactly what does not have them.
  const rescued = RESCUED_MEDIA[url]
  if (rescued) return `${import.meta.env.BASE_URL}media/${rescued}`

  return remoteUrl(url)
}

function remoteUrl(url: string): string {
  const m = url.match(FILE_STORE)
  // 38 attachments were recorded as the board's THUMBNAIL path. qalerts mirrors by content
  // hash and keeps only the full file, so forwarding `thumb/<hash>` asks for something the
  // mirror never had, while `<hash>` — the same image at full size — is sitting right there.
  // Every one of those 38 rendered as a broken chip and was counted as a dead CDN link; none
  // of them has ever loaded, so dropping the segment cannot regress an image that works.
  if (m) return `https://qalerts.app/media/${m[1].replace(/^thumb\//, '')}`
  // A protocol-relative URL on a host we don't rewrite still needs a scheme to load.
  if (url.startsWith('//')) return `https:${url}`
  return url
}

/** True when the URL had to be redirected to a mirror — for an attribution note. */
export function isMirrored(url: string | undefined | null): boolean {
  return !!url && FILE_STORE.test(url)
}

/**
 * Attachments with the dead-host duplicates collapsed.
 *
 * 82 posts record the same image twice — once on qalerts and once on the onion or 8kun.top
 * mirror — which rendered as the image followed by a broken copy of itself. Both resolve to
 * the same mirrored URL, so dedupe after rewriting.
 */
export function dedupeMedia<T extends { url?: string | null }>(media: T[] | undefined | null): T[] {
  if (!media?.length) return []
  const seen = new Set<string>()
  return media.filter(m => {
    const key = mediaUrl(m?.url) || JSON.stringify(m)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
