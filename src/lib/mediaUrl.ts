// Image URLs for post attachments.
//
// 742 of the 1,271 attachments point at `media.8ch.net`, which has been offline since 8chan
// shut down in 2019 — every one of those images 404s. 8kun did not keep the old file store
// either (`8kun.top/file_store/<hash>` → 404), so the images are gone from their origin.
//
// qalerts mirrors them under the SAME content hash: verified HTTP 200 on 9 of 9 across a
// spread sample of the archive. Rewriting the host restores roughly 750 images.
//
// Done at RENDER time rather than by editing the bundle: reversible, applies to `refMedia`
// as well, and leaves the recorded original URL intact as provenance.
//
// Host census (Aug 2026):
//   media.8ch.net    742  dead    → rewritten
//   qalerts.app      100  live    → untouched
//   img.4plebs.org    11  live    → untouched
//   media.8kun.net    11  dead    → rewritten (domain does not resolve)

const DEAD_FILE_STORE = /^https?:\/\/(?:media\.)?(?:8ch\.net|8kun\.net)\/file_store\/(.+)$/i

/** A loadable URL for an attachment, rewriting hosts that no longer serve. */
export function mediaUrl(url: string | undefined | null): string {
  if (!url) return ''
  const m = url.match(DEAD_FILE_STORE)
  if (m) return `https://qalerts.app/media/${m[1]}`
  return url
}

/** True when the URL had to be redirected to a mirror — for an attribution note. */
export function isMirrored(url: string | undefined | null): boolean {
  return !!url && DEAD_FILE_STORE.test(url)
}
