import { setLocalMedia } from './mediaUrl'

/**
 * Point the app at the attachments bundled inside the desktop app.
 *
 * Only does anything under Tauri. On the web there is nothing to bundle — the browser
 * version is online by definition, so images keep coming from the mirror.
 *
 * Deliberately fail-soft: every failure here leaves `mediaUrl()` on its existing remote
 * path, so a missing or unreadable bundle degrades to the current behaviour instead of a
 * screen of broken images.
 */
export async function initLocalMedia(): Promise<void> {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  if (!w.__TAURI_INTERNALS__ && !w.__TAURI__) return initWebMedia()

  try {
    const [{ resolveResource }, { convertFileSrc }] = await Promise.all([
      import('@tauri-apps/api/path'),
      import('@tauri-apps/api/core'),
    ])

    // manifest.json maps each original attachment URL to its bundled filename. It is built
    // by scripts/build-media-bundle.mjs and shipped alongside the images.
    const manifestPath = await resolveResource('media-bundle/manifest.json')
    const res = await fetch(convertFileSrc(manifestPath))
    if (!res.ok) return
    const manifest = (await res.json()) as Record<string, string>
    if (!manifest || typeof manifest !== 'object') return

    // Resolve the directory once, so mediaUrl() can stay synchronous — it is called from
    // render for every image on screen.
    const dir = await resolveResource('media-bundle')
    setLocalMedia(convertFileSrc(dir), manifest)
    console.info(`[media] offline bundle active — ${Object.keys(manifest).length} attachments`)
  } catch {
    /* no bundle in this build, or resource lookup unavailable — stay on the mirror */
  }
}

/**
 * Self-hosted media for the WEB build (owner directive 2026-08-28: "i really want to take
 * qalerts out of the mix on my app").
 *
 * The same 1,653-image bundle the desktop app ships (media-bundle/, built by
 * scripts/build-media-bundle.mjs) lives in the Cloudflare R2 bucket behind WEB_MEDIA_BASE
 * (uploaded by scripts/upload-media-r2.mjs). A constant, not an env var: .env* is entirely
 * gitignored here, so an env-based base would silently vanish on any other machine and the
 * site would quietly fall back to hotlinking qalerts again.
 *
 * The manifest is fetched SAME-ORIGIN (public/media-manifest.json, a committed copy of the
 * bundle's manifest) rather than from the media host — a cross-origin fetch() needs CORS
 * where a plain <img> does not, and this way the manifest is versioned with the deploy it
 * shipped in. If it fails to load, mediaUrl() falls through to the mirror exactly as
 * before: an outage degrades to today's behaviour, never to broken images.
 */
const WEB_MEDIA_BASE = 'https://media.qdrops.app/'

async function initWebMedia(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}media-manifest.json`)
    if (!res.ok) return
    const manifest = (await res.json()) as Record<string, string>
    if (!manifest || typeof manifest !== 'object') return
    setLocalMedia(WEB_MEDIA_BASE, manifest)
    console.info(`[media] self-hosted bundle active — ${Object.keys(manifest).length} attachments`)
  } catch {
    /* manifest missing — stay on the mirror */
  }
}
