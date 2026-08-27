import { useState } from 'react'
import { analyticsAvailable, storedConsent, setConsent } from '../lib/analytics'

// Shown once, before any tracking script loads — analytics.ts never injects gtag.js until this
// records "granted". Declining is remembered too, so a visitor is never asked twice.
export default function CookieConsent() {
  const [choice, setChoice] = useState(() => storedConsent())
  if (!analyticsAvailable() || choice) return null

  const respond = (c: 'granted' | 'denied') => {
    setConsent(c)
    setChoice(c)
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-q-panel border-t border-q-border px-4 py-3 sm:px-6">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs text-gray-400 flex-1">
          This site uses Google Analytics to understand how the archive is used, so future changes
          can be aimed at what actually helps readers. No tracking runs until you say yes.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => respond('denied')}
            className="text-xs px-3 py-1.5 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => respond('granted')}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
