import { useState, useEffect } from 'react'
import BackButton from '../components/BackButton'
import { activeWallets } from '../lib/donations'

/**
 * The QR at a size a phone camera can actually read across a table.
 *
 * 104px is fine for a phone held to your own screen and useless for anything else, and a reader
 * showing the code to someone — or scanning a laptop from a phone at arm's length — needs the
 * modules bigger. Nothing is re-encoded here: this is the SAME SVG the row shows, drawn larger,
 * so the enlarged code cannot say something different from the small one.
 */
function QrZoom({ symbol, address, qr, onClose }: { symbol: string; address: string; qr: string; onClose: () => void }) {
  // Escape closes it. Registered while the overlay is mounted only, so it cannot swallow the key
  // from anything else on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${symbol} address QR code, enlarged`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5"
    >
      {/* The card swallows the click so tapping the code itself does not close what you just
          opened; the backdrop closes. */}
      <div onClick={e => e.stopPropagation()} className="bg-q-panel border border-q-border rounded-xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{symbol}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto text-gray-400 hover:text-white text-lg leading-none px-2"
          >
            ✕
          </button>
        </div>
        <img
          src={qr}
          alt={`${symbol} address QR code`}
          className="w-full h-auto rounded bg-white p-3"
          style={{ imageRendering: 'pixelated' }}
        />
        <code className="block bg-gray-900/70 border border-gray-700 rounded px-2 py-1.5 text-[11px] text-gray-300 break-all leading-relaxed text-center">
          {address}
        </code>
        <p className="text-[11px] text-gray-500 text-center">Tap outside or press Esc to close.</p>
      </div>
    </div>
  )
}

function WalletRow({ symbol, name, network, address, qr }: { symbol: string; name: string; network: string; address: string; qr?: string }) {
  const [copied, setCopied] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the address is on screen to copy manually */
    }
  }

  return (
    <div className="bg-black/20 border border-q-border rounded-lg p-4 space-y-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-bold text-white">{symbol}</span>
        <span className="text-xs text-gray-400">{name}</span>
        <span className="text-[11px] text-amber-400/80 ml-auto">{network}</span>
      </div>
      {/* Stacked on a phone: side by side, a 104px QR leaves the address about ten characters
          of line width, which is unreadable for the thing the reader is checking. */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
        {/* The QR is generated FROM the address string next to it (see donations.ts), so what a
            camera reads and what the reader copies are the same characters. On white on purpose:
            a dark-inverted QR is unreadable to some scanners. */}
        {qr && (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label={`Show the ${symbol} QR code larger`}
            title="Show larger"
            className="shrink-0 rounded bg-white p-1.5 border border-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-q-accent transition-colors"
          >
            <img
              src={qr}
              alt={`${symbol} address QR code`}
              width={104}
              height={104}
              style={{ width: 104, height: 104, imageRendering: 'pixelated' }}
            />
          </button>
        )}
        <div className="w-full flex-1 min-w-0 space-y-2">
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 bg-gray-900/70 border border-gray-700 rounded px-2 py-1.5 text-[11px] text-gray-300 break-all leading-relaxed">
              {address}
            </code>
            <button
              onClick={copy}
              className={`shrink-0 text-xs px-3 rounded border transition-colors ${
                copied
                  ? 'bg-green-800/60 text-green-200 border-green-600'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:text-white hover:border-gray-500'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {zoomed && qr && (
        <QrZoom symbol={symbol} address={address} qr={qr} onClose={() => setZoomed(false)} />
      )}
    </div>
  )
}

export default function Donate() {
  const wallets = activeWallets()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <BackButton />

      <div className="bg-q-panel border border-q-border rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white">Support Qdrops.app</h1>
        <p className="text-xs text-gray-500 mt-1">Launched 8/23/26</p>
        <div className="text-sm text-gray-400 leading-relaxed mt-3 space-y-3">
          <p>
            Qdrops.app was created to make the complete Q post archive easier to search,
            study, and understand based on the language used throughout all{' '}
            <span className="font-semibold text-gray-200">4,966 Q Drops</span>.
          </p>
          <p>
            Rather than simply presenting the original posts, the site organizes the material
            into searchable categories, including:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Q Questions</li>
            <li>Q Directives</li>
            <li>Q Claims</li>
            <li>Q Predictions</li>
            <li>Q Entities — people, places, organizations, and other named subjects</li>
            <li>Q Brackets — terms, codes, and language found within brackets</li>
            <li>Links and images</li>
            <li>Tripcodes</li>
            <li>Related post clusters</li>
            <li>17 overarching themes</li>
            <li>And much more</li>
          </ul>
          <p>
            The goal is to help visitors examine the archive more clearly, follow references
            between posts, compare related information, discover connections, and review the
            material for themselves.
          </p>
        </div>
      </div>

      <div className="bg-q-panel border border-q-border rounded-xl p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-white mb-2">Thank You for Being Here</h2>
          <div className="text-sm text-gray-400 leading-relaxed space-y-3">
            <p>
              Thank you to everyone who uses Qdrops.app, shares it with others, reports an
              issue, points out a missing or incorrect highlight, or sends feedback and
              suggestions.
            </p>
            <p>
              This project continues to improve because of the people who take the time to
              review the information and help identify areas that may need correction,
              clarification, or additional context.
            </p>
            <p>
              Every report, suggestion, and contribution helps make Qdrops.app more complete,
              accurate, and useful for everyone.
            </p>
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-white mb-2">Help Support the Project</h2>
          <div className="text-sm text-gray-400 leading-relaxed space-y-3">
            <p>
              Maintaining and improving Qdrops.app requires ongoing development, research,
              data review, hosting, and other operating costs.
            </p>
            <p>
              If the site has been useful to you and you would like to support its continued
              development, you can contribute using one of the cryptocurrency QR codes or
              wallet addresses below.
            </p>
            <p>
              Your support is sincerely appreciated, but it is never required to use, search,
              or explore the site.
            </p>
            <p>
              Thank you for visiting Qdrops.app, providing feedback, and helping the project
              continue to grow.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-q-panel border border-q-border rounded-xl p-6">
        <h2 className="font-semibold text-white mb-1">Crypto</h2>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Send only on the network listed for each coin. Crypto transfers cannot be reversed.
          Each QR code is the address printed beside it — scan it or copy the text, they are the
          same. Your wallet shows the address before it sends; check it matches what is here.
        </p>

        {wallets.length === 0 ? (
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-amber-300 font-medium">No wallets configured yet</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Addresses live in <code className="text-gray-300">src/lib/donations.ts</code>.
              Coins with an empty address are hidden on purpose — showing a placeholder
              would send real money somewhere nobody controls, and crypto transfers can't
              be undone.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {wallets.map(w => <WalletRow key={w.symbol} {...w} />)}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-600 text-center">
        Donations are a gift, not a purchase — they buy no service, access, or influence
        over what the archive says.
      </p>
    </div>
  )
}
