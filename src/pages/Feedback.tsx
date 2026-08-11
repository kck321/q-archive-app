import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { submitFeedback, FEEDBACK_KINDS, MAX_MESSAGE, MAX_CONTACT, type FeedbackKind } from '../lib/feedback'

export default function Feedback() {
  // /feedback?post=1543 pre-fills the post number, so anything that wants to hand off to
  // this page can carry the context with it instead of asking the visitor to retype it.
  const [searchParams] = useSearchParams()
  const [kind, setKind] = useState<FeedbackKind>('comment')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [postNum, setPostNum] = useState(() => (searchParams.get('post') ?? '').replace(/\D/g, '').slice(0, 5))
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const remaining = MAX_MESSAGE - message.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const n = parseInt(postNum, 10)
      await submitFeedback({
        kind,
        message,
        contact,
        postNum: Number.isFinite(n) && n > 0 ? n : undefined,
      })
      setSent(true)
      setMessage(''); setContact(''); setPostNum('')
    } catch {
      setError("That didn't go through. Check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <BackButton />

      {/* ── Intro ─────────────────────────────────────────────────────────── */}
      <div className="bg-q-panel border border-q-border rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white">An Open Archive for Q Research</h1>
        <div className="text-sm text-gray-400 leading-relaxed mt-3 space-y-3">
          <p>
            This is an early build — rough in places and far from finished. The goal is a
            tool anyone can use to study the Q operation on their own terms: every post,
            searchable, cross-referenced, and open source from top to bottom.
          </p>
          <p>
            It gets better faster with more eyes on it. Found a bug, a gap, or a better way
            to organize something? Tell me below. Thanks for stopping by.
          </p>
        </div>
      </div>

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <div className="bg-q-panel border border-q-border rounded-xl p-6">
        <h2 className="font-semibold text-white mb-1">Comments &amp; Requests</h2>
        <p className="text-xs text-gray-500 mb-4">
          Questions, corrections, feature ideas — sent straight to me. Nothing you write is
          shown publicly on this site.
        </p>

        {sent ? (
          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-5 text-center space-y-3">
            <p className="text-green-300 font-medium">✓ Got it — thank you.</p>
            <p className="text-xs text-gray-400">
              Every message gets read. If you left a contact I'll reply when I can.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-1.5 rounded-lg transition-colors"
            >
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Kind */}
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_KINDS.map(k => (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setKind(k.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    kind === k.key
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200 hover:border-gray-600'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            {/* Message */}
            <div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                rows={6}
                required
                placeholder="What's on your mind? If it's about a specific drop, add the post number below."
                className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-y"
              />
              <p className={`text-[11px] mt-1 text-right ${remaining < 100 ? 'text-amber-400' : 'text-gray-600'}`}>
                {remaining} characters left
              </p>
            </div>

            {/* Optional fields */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">
                  Post number <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  value={postNum}
                  onChange={e => setPostNum(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  inputMode="numeric"
                  placeholder="e.g. 1543"
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">
                  Contact <span className="text-gray-600">(optional — only if you want a reply)</span>
                </label>
                <input
                  value={contact}
                  onChange={e => setContact(e.target.value.slice(0, MAX_CONTACT))}
                  placeholder="email or handle"
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={!message.trim() || sending}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>

            <p className="text-[11px] text-gray-600">
              Don't include anything sensitive — treat this like a postcard.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
