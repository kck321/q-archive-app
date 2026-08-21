import type { AnswerStatus } from '../types'

interface Props {
  status: AnswerStatus
  text?: string
  onClick?: () => void
  small?: boolean
  highlightClass?: string
}

const config: Record<AnswerStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
  green:       { bg: 'bg-green-900/40',  text: 'text-green-400',  border: 'border-green-700',  dot: 'bg-green-400',  label: 'Answered'       },
  yellow:      { bg: 'bg-yellow-900/40', text: 'text-yellow-400', border: 'border-yellow-700', dot: 'bg-yellow-400', label: 'Partial'         },
  red:         { bg: 'bg-red-900/40',    text: 'text-red-400',    border: 'border-red-700',    dot: 'bg-red-400',    label: 'Unanswered'     },
  unprocessed: { bg: 'bg-gray-800/60',   text: 'text-gray-400',   border: 'border-gray-600',   dot: 'bg-gray-400',   label: 'Unprocessed'    },
}

// A STATUS THIS COMPONENT DOES NOT KNOW MUST NOT BLANK THE PAGE.
//
// `config[status]` returned undefined for any value outside the four keys, and the next line read
// `.bg` off it — an uncaught TypeError during render, which React turns into an empty document.
// Three questions in the bundle carry `status: "unanswered"`, and the two drops holding them
// (#2211, #3613) rendered as a completely blank /post/:id: no body, no analysis, no error visible
// to the reader. The archive was unaffected, so the two surfaces disagreed about whether those
// drops existed at all.
//
// "unanswered" is not a foreign value, it is this component's own LABEL for `red` used in place of
// the key, so it resolves to red rather than being discarded. Anything genuinely unrecognised
// degrades to `unprocessed` — the neutral state — because a badge with the wrong colour is a small
// defect and a drop that will not render is a large one.
const ALIASES: Record<string, AnswerStatus> = { unanswered: 'red', answered: 'green', partial: 'yellow' }

export default function QuestionBadge({ status, text, onClick, small = false, highlightClass }: Props) {
  const c = config[status] ?? config[ALIASES[String(status)]] ?? config.unprocessed
  return (
    <div
      onClick={onClick}
      className={`${c.bg} ${c.text} border ${c.border} rounded-lg ${
        small ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
      } flex items-start gap-2 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
      <div className="flex-1 min-w-0">
        {text && (
          <p className="leading-snug">
            {highlightClass
              ? <mark className={`${highlightClass} rounded not-italic px-1`}>{text}</mark>
              : text
            }
          </p>
        )}
        <span className="text-xs opacity-70">{c.label}</span>
      </div>
    </div>
  )
}
