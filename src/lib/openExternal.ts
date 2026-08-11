// Open a URL in the user's real browser. In the Tauri desktop app, plain web links
// don't open externally on their own — we route them through the opener plugin.
export function isTauri(): boolean {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__)
}

export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
      return
    } catch {
      /* fall through to window.open */
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
