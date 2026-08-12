import { CAN_EDIT } from '../lib/appMode'

/**
 * Renewal reminders for things that expire and would take the site down with them.
 *
 * Admin-only: this is a note to the operator, not information for visitors.
 *
 * A domain lapsing is the one failure here that is genuinely hard to undo — an expired name
 * can be picked up by anyone, and .app names in particular get sniped. Cloudflare auto-renews
 * while a valid card is on file, so this is a backstop for an expired card, not a to-do.
 */
interface Renewal {
  label: string
  detail: string
  /** ISO date the registration/subscription lapses. */
  renews: string
  purchased: string
  cost: string
  where: string
  url: string
}

const RENEWALS: Renewal[] = [
  {
    label: 'qdrops.app',
    detail: 'Domain — points at GitHub Pages',
    purchased: '2026-08-12',
    renews: '2027-08-12',
    cost: '~$14/yr',
    where: 'Cloudflare Registrar',
    url: 'https://dash.cloudflare.com/?to=/:account/domains',
  },
]

const DAY = 86_400_000

function daysUntil(iso: string): number {
  const then = new Date(`${iso}T00:00:00Z`).getTime()
  const today = new Date()
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((then - utcToday) / DAY)
}

export default function RenewalReminder() {
  if (!CAN_EDIT) return null

  return (
    <div className="space-y-2">
      {RENEWALS.map(r => {
        const days = daysUntil(r.renews)
        // Colour only when it actually matters — a year out this should read as a note.
        const urgent = days <= 14
        const soon = days <= 45
        const tone = urgent
          ? 'border-red-700/60 bg-red-950/30'
          : soon
            ? 'border-amber-700/60 bg-amber-950/20'
            : 'border-q-border bg-q-panel'
        const dayTone = urgent ? 'text-red-300' : soon ? 'text-amber-300' : 'text-gray-400'

        return (
          <div key={r.label} className={`border rounded-xl px-4 py-3 ${tone}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-white font-semibold text-sm">{r.label}</span>
              <span className="text-xs text-gray-500">{r.detail}</span>
              <span className={`ml-auto text-xs font-medium ${dayTone}`}>
                {days < 0
                  ? `EXPIRED ${Math.abs(days)} days ago`
                  : days === 0
                    ? 'renews today'
                    : `renews in ${days.toLocaleString()} days`}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
              <span>bought {r.purchased}</span>
              <span>·</span>
              <span>renews {r.renews}</span>
              <span>·</span>
              <span>{r.cost}</span>
              <span>·</span>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline"
              >
                {r.where} ↗
              </a>
            </div>
            {urgent && (
              <p className="mt-2 text-[11px] text-red-300">
                Check the card on file. If this lapses the name can be registered by anyone else.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
