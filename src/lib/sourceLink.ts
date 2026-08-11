// Original-source links for each Q post.
//
// Every post carries a `link` back to the thread it was posted in, but a lot of those
// URLs have rotted. Verified state of the four domains in the archive (Aug 2026):
//
//   8ch.net             3,337 posts  DEAD — 8chan shut down in 2019. The boards that
//                                    still exist on 8kun did NOT keep the old thread
//                                    numbers (8kun.top/qresearch/res/884810.html → 404),
//                                    and /patriotsfight/ and /greatawakening/ are gone
//                                    from 8kun entirely. No 1:1 replacement exists, so
//                                    these fall back to a Wayback Machine snapshot.
//   8kun.net              326 posts  Domain no longer resolves, but the same path on
//                                    8kun.top works (verified HTTP 200) — simple rewrite.
//   8kun.top            1,070 posts  Live, used as-is.
//   archive.4plebs.org    233 posts  Live, used as-is. (Returns 403 to command-line
//                                    clients because of bot protection; fine in a browser.)
//
// Two data defects are also handled here: ~15 posts have `res/undefined.html` (the
// thread id was never captured — no link is possible), and the /thestorm/ and
// /greatawakening/ links contain a double slash after the host.

export type SourceKind = 'live' | 'archived' | 'none'

export interface SourceLink {
  /** Where to send the reader, or null when no usable original exists. */
  url: string | null
  /** Human-readable board, e.g. "8chan /qresearch/". */
  label: string
  kind: SourceKind
  /** Short explanation, suitable for a title attribute. */
  hint: string
}

const BOARD_LABELS: Record<string, string> = {
  '4chan_pol':            '4chan /pol/',
  '8chan_pol':            '8chan /pol/',
  '8chan_qresearch':      '8chan /qresearch/',
  '8chan_patriotsfight':  '8chan /patriotsfight/',
  '8chan_cbts':           '8chan /cbts/',
  '8chan_greatawakening': '8chan /greatawakening/',
  '8chan_thestorm':       '8chan /thestorm/',
  '8kun_qresearch':       '8kun /qresearch/',
  '8kun_projectdcomms':   '8kun /projectdcomms/',
}

/** "8chan_qresearch" → "8chan /qresearch/", with a readable fallback for unknown values. */
export function boardLabel(source: string | undefined): string {
  if (!source) return 'Unknown source'
  return BOARD_LABELS[source] ?? source.replace('_', ' /') + '/'
}

/** Collapse the `8ch.net//thestorm/...` double slash without touching the `https://`. */
function normalize(raw: string): string {
  return raw.replace(/([^:])\/{2,}/g, '$1/')
}

export function sourceLink(post: { link?: string; source?: string; threadId?: string }): SourceLink {
  const label = boardLabel(post.source)
  const raw = (post.link ?? '').trim()

  if (!raw) {
    return { url: null, label, kind: 'none', hint: `Originally posted on ${label}. No source link was captured.` }
  }

  let url: URL
  try {
    url = new URL(normalize(raw))
  } catch {
    return { url: null, label, kind: 'none', hint: `Originally posted on ${label}. The stored source link is malformed.` }
  }

  // Thread id was never captured for a handful of posts — the URL cannot resolve.
  if (url.pathname.includes('undefined')) {
    return { url: null, label, kind: 'none', hint: `Originally posted on ${label}. The original thread id was not captured.` }
  }

  switch (url.hostname) {
    // Dead domain, same paths still served by 8kun.top.
    case '8kun.net':
      url.hostname = '8kun.top'
      return { url: url.toString(), label, kind: 'live', hint: `View the original thread on ${label}` }

    case '8kun.top':
    case 'archive.4plebs.org':
      return { url: url.toString(), label, kind: 'live', hint: `View the original thread on ${label}` }

    // 8chan is gone and its threads were not carried over to 8kun. Best available
    // option is a Wayback Machine capture from while the board was still up.
    case '8ch.net':
      return {
        url: `https://web.archive.org/web/2019/${url.toString()}`,
        label,
        kind: 'archived',
        hint: `${label} went offline in 2019 — opens an archived snapshot of the original thread`,
      }

    default:
      return { url: url.toString(), label, kind: 'live', hint: `View the original thread on ${label}` }
  }
}
