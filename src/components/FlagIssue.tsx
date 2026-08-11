import { useState } from 'react'
import { submitFeedback, MAX_MESSAGE, MAX_CONTACT, type FeedbackKind } from '../lib/feedback'

// Inline "something's wrong with this post" reporter, shown at the bottom of a post.
//
// Feeds the SAME write-only `feedback` collection as the Comments & Ideas page — one
// inbox, not two — but pre-tagged with the post number so a report never arrives without
// saying what it is about. Deliberately NOT gated on CAN_EDIT: reporting a problem is the
// one write the public build is meant to make.
//
// Collapsed by default so it never competes with the post itself.

const KINDS: { key: FeedbackKind; label: string; hint: string }[] = [
  { key: 'correction', label: '✏️ Wrong analysis', hint: 'A claim, entity, or category looks misfiled' },
  { key: 'bug',        label: '🐞 Broken',         hint: 'A link, image, or part of the page is broken' },
  { key: 'comment',    label: '💬 Something else', hint: 'Context, a source, or anything else' },
]

export default function FlagIssue({ postNum }: { postNum: number }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>('correction')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true); setError('')
    try {
      await submitFeedback({ kind, message, contact, postNum })
      setSent(true)
      setMessage(''); setContact('')
    } catch {
      setError("That didn't go through. Check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-4 text-center space-y-2">
        <p className="text-green-300 text-sm font-medium">✓ Thanks — flagged for post #{postNum}.</p>
        <button
          onClick={() => { setSent(false); setOpen(false) }}
          className="text-xs text-gray-400 hover:text-white underline"
        >
          Close
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-xs text-gray-500 hover:text-amber-300 border border-dashed border-gray-700 hover:border-amber-700/60 rounded-xl py-3 transition-colors"
      >
        🚩 Flag an issue with post #{postNum}
      </button>
    )
  }

  const remaining = MAX_MESSAGE - message.length

  return (
    <form onSubmit={handleSubmit} className="bg-q-panel border border-amber-800/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">🚩 Flag an issue — post #{postNum}</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setError('') }}
          className="text-xs text-gray-500 hover:text-white px-1"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(k => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            title={k.hint}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              kind === k.key
                ? 'bg-amber-700/50 text-amber-100 border-amber-600'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          rows={3}
          required
          autoFocus
          placeholder="What's wrong here? Be as specific as you can."
          className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-600 resize-y"
        />
        <p className={`text-[11px] mt-1 text-right ${remaining < 100 ? 'text-amber-400' : 'text-gray-600'}`}>
          {remaining} characters left
        </p>
      </div>

      <input
        value={contact}
        onChange={e => setContact(e.target.value.slice(0, MAX_CONTACT))}
        placeholder="Contact (optional — only if you want a reply)"
        className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-600"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-1.5 rounded-lg text-xs transition-colors"
        >
          {sending ? 'Sending…' : 'Send report'}
        </button>
        <span className="text-[11px] text-gray-600">Goes to the same inbox as Comments &amp; Ideas.</span>
      </div>
    </form>
  )
}
