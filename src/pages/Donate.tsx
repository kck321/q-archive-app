import { useState } from 'react'
import BackButton from '../components/BackButton'
import { activeWallets } from '../lib/donations'

function WalletRow({ symbol, name, network, address }: { symbol: string; name: string; network: string; address: string }) {
  const [copied, setCopied] = useState(false)

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
  )
}

export default function Donate() {
  const wallets = activeWallets()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <BackButton />

      <div className="bg-q-panel border border-q-border rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white">Support the Archive</h1>
        <div className="text-sm text-gray-400 leading-relaxed mt-3 space-y-3">
          <p>
            This project is free, open source, and has no ads, no tracking, and nothing
            behind a paywall. It runs on time more than money.
          </p>
          <p>
            If it's been useful to you and you'd like to chip in, crypto is below. Entirely
            optional — the whole archive stays free either way.
          </p>
        </div>
      </div>

      <div className="bg-q-panel border border-q-border rounded-xl p-6">
        <h2 className="font-semibold text-white mb-1">Crypto</h2>
        <p className="text-xs text-gray-500 mb-4">
          Send only on the network listed for each coin. Crypto transfers cannot be reversed.
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
