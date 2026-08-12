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
  if (!w.__TAURI_INTERNALS__ && !w.__TAURI__) return

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
