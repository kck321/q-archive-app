import { createContext, useContext, useState, type ReactNode } from 'react'
import { CAN_EDIT } from '../lib/appMode'

// App-wide "admin mode". Entering the PIN once unlocks every gated action for the
// session: editing post analysis, the AI Analyze button, bulk classify, adding
// questions, and the Dashboard tools.
//
// The PIN is a convenience latch that stops accidental edits on your own machine — it
// is NOT a security control, because anything the browser checks, the user can skip.
// On the public build there is nothing to latch: CAN_EDIT is false, no editing UI is
// compiled in, `unlocked` is permanently false, and the prompt never renders. Set
// VITE_ADMIN_PIN in .env to override the default on your own machine.
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN ?? '1624'

type AdminCtx = {
  unlocked: boolean
  /** True when this build ships editing UI at all (desktop/dev, never the public site). */
  canEdit: boolean
  /** Run `action` now if unlocked, otherwise prompt for the PIN and run it on success. */
  requireAdmin: (label: string, action: () => void) => void
  lock: () => void
}

const Ctx = createContext<AdminCtx | null>(null)

export function useAdmin(): AdminCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAdmin must be used within <AdminProvider>')
  return c
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pending, setPending] = useState<{ label: string; run: () => void } | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  function requireAdmin(label: string, action: () => void) {
    if (!CAN_EDIT) return          // public build: no editing exists, never prompt
    if (unlocked) { action(); return }
    setErr(''); setPin(''); setPending({ label, run: action })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pin === ADMIN_PIN) {
      setUnlocked(true); setErr('')
      const p = pending; setPending(null); setPin('')
      p?.run()
    } else {
      setErr('Incorrect admin PIN.')
    }
  }

  function close() { setPending(null); setErr('') }

  return (
    <Ctx.Provider value={{ unlocked: unlocked && CAN_EDIT, canEdit: CAN_EDIT, requireAdmin, lock: () => setUnlocked(false) }}>
      {children}
      {CAN_EDIT && pending && !unlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()}
            className="bg-q-panel border border-violet-700/60 rounded-xl p-5 w-full max-w-sm space-y-3 shadow-2xl">
            <h3 className="text-white font-semibold">🔒 Admin PIN required</h3>
            <p className="text-xs text-gray-400">Enter the admin PIN to <span className="text-violet-300">{pending.label}</span>.</p>
            <input autoFocus type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}
              placeholder="••••"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white tracking-widest text-center focus:outline-none focus:border-violet-400" />
            {err && <p className="text-xs text-red-400">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={close} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded">Cancel</button>
              <button type="submit" className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-4 py-1.5 rounded font-medium">Unlock</button>
            </div>
          </form>
        </div>
      )}
    </Ctx.Provider>
  )
}
