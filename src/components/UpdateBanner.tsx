import { useEffect, useState } from 'react'

// Auto-update banner. In the desktop (Tauri) app, checks GitHub for a newer signed
// release on launch; if one exists it shows the version + release notes ("what's new")
// and a one-click Update that downloads, installs, and relaunches. No-op in the browser.

type Status = 'idle' | 'checking' | 'downloading' | 'error'

// Minimal shape of the plugin's Update object (avoids tight coupling to plugin types).
interface TauriUpdate {
  version: string
  currentVersion: string
  body?: string | null
  downloadAndInstall: (onEvent?: (e: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void>
}

function isTauri(): boolean {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__)
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState<TauriUpdate | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(false)

  async function checkForUpdates() {
    if (!isTauri()) return
    try {
      setStatus('checking'); setError('')
      const { check } = await import('@tauri-apps/plugin-updater')
      const u = await check()
      if (u) { setUpdate(u as unknown as TauriUpdate); setDismissed(false) }
      setStatus('idle')
    } catch (e) {
      setStatus('error'); setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function installUpdate() {
    if (!update) return
    try {
      setStatus('downloading'); setProgress(0)
      let total = 0, got = 0
      await update.downloadAndInstall(e => {
        if (e.event === 'Started') total = e.data?.contentLength ?? 0
        else if (e.event === 'Progress') { got += e.data?.chunkLength ?? 0; if (total) setProgress(Math.round((got / total) * 100)) }
        else if (e.event === 'Finished') setProgress(100)
      })
      // Installed — relaunch into the new version
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (e) {
      setStatus('error'); setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => { checkForUpdates() }, [])

  if (!update || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-q-panel border border-emerald-700/60 rounded-xl shadow-2xl shadow-black/50 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-white font-semibold text-sm">⬆️ Update available</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            v{update.currentVersion} → <span className="text-emerald-300 font-medium">v{update.version}</span>
          </p>
        </div>
        {status !== 'downloading' && (
          <button onClick={() => setDismissed(true)} className="text-gray-500 hover:text-white text-xs shrink-0" title="Later">✕</button>
        )}
      </div>

      {update.body && (
        <div className="text-xs text-gray-300 bg-black/30 border border-q-border rounded-lg p-2.5 mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {update.body}
        </div>
      )}

      {status === 'downloading' ? (
        <div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Downloading… {progress}% — the app will restart automatically.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={installUpdate} className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-emerald-50 text-sm font-medium py-2 rounded-lg transition-colors">
            Update now
          </button>
          <button onClick={() => setDismissed(true)} className="text-xs text-gray-400 hover:text-white px-3 py-2">Later</button>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}
