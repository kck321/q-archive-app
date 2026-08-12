import { IS_PUBLIC_SITE } from '../lib/appMode'

/**
 * Download page for the desktop build.
 *
 * The installers are produced by .github/workflows/release-desktop.yml — one runner per OS,
 * because macOS and Linux packages cannot be cross-compiled from Windows. Links point at
 * the "latest" release rather than a pinned version, so this page never needs editing when
 * a new build ships.
 *
 * What downloads is the READ-ONLY build: the workflow compiles with `--mode public`, which
 * drops every edit control and the admin PIN at compile time, and fails the release if it
 * finds them in the bundle.
 */
const REPO = 'https://github.com/kck321/q-archive-app'
const LATEST = `${REPO}/releases/latest`

const PLATFORMS = [
  {
    os: 'Windows',
    icon: '🪟',
    detail: '.msi installer — Windows 10 and 11',
    note: 'Windows will show "Windows protected your PC" on first run. Choose More info → Run anyway.',
  },
  {
    os: 'macOS',
    icon: '🍎',
    detail: '.dmg — one universal build for Apple Silicon and Intel',
    note: 'macOS will say the developer cannot be verified. Right-click the app and choose Open.',
  },
  {
    os: 'Linux',
    icon: '🐧',
    detail: '.AppImage or .deb — Ubuntu, Debian, Fedora and friends',
    note: 'For the AppImage, mark it executable first: chmod +x Q-Archive*.AppImage',
  },
]

export default function Download() {
  return (
    <div className="p-6 space-y-6 w-full max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Download the app</h1>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          The whole archive, offline. Same read-only build as this site, packaged for your
          computer — every post, image and search works with no internet connection once
          installed, and nothing is sent anywhere.
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS.map(p => (
          <div key={p.os} className="bg-q-panel border border-q-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">{p.icon}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-white font-semibold">{p.os}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{p.detail}</p>
                <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{p.note}</p>
              </div>
              <a
                href={LATEST}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 border border-blue-700/60 px-4 py-2 rounded-lg transition-colors"
              >
                Download ↓
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-q-panel border border-q-border rounded-xl p-4 space-y-2">
        <h2 className="text-white font-semibold text-sm">Why the security warning?</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          The installers are not code-signed. A signing certificate costs a few hundred
          dollars a year from Microsoft and Apple, and this is a free archive. The warning
          means "unsigned", not "unsafe" — the source is public and every build is produced
          in the open by GitHub from that source, so you can check exactly what went in.
        </p>
        <a
          href={`${REPO}/actions`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blue-400 hover:text-blue-300 hover:underline"
        >
          See how each build was produced →
        </a>
      </div>

      {IS_PUBLIC_SITE && (
        <p className="text-xs text-gray-600">
          Prefer the browser? Nothing to install — this site is the same archive.
        </p>
      )}
    </div>
  )
}
