import React from 'react'
import { Link } from 'react-router-dom'
import { resolveRef } from './refIndex'

/**
 * Turn URLs and ">>NNNNNNN" board pointers inside already-rendered post text into links.
 *
 * Post bodies go through several highlighters first (questions, claims, entities, the search
 * term), each returning a mix of strings and elements — so this runs over the RESULT rather
 * than the raw text, and recurses into those elements. Q's drops put URLs inside lines that
 * get highlighted as claims, so skipping element children would leave most links dead.
 */

// Stops at whitespace and at the quote/bracket characters that fence a URL in prose.
// The last alternative is Q's board pointer: ">>11001375". All are matched in ONE pass so a
// pointer sitting inside a URL's query string cannot be linked twice.
//
// THE FIRST ALTERNATIVE IS Q'S OWN TYPO, AND IT HAS TO COME FIRST.
//
// 44 drops write the scheme with a space after it — "https:// wikileaks.org/podesta-emails/629",
// "http:// thehill.com/homenews/...". Where the host then began with "www." the second
// alternative still caught it and the address was live, which is why this went unnoticed; where
// it did not, 23 addresses rendered as plain grey text and were not links at all. Matching the
// space repairs both: the anchor now covers the whole address Q typed.
//
// Only spaces and tabs, never \s — a newline after the scheme is a different drop shape and
// swallowing one would link across a line break. Leftmost-alternation means this must precede the
// unspaced form, or that one matches "https://" and stops.
const TOKEN_RE = /(https?:\/\/[ \t]{1,3}[^\s<>"'`)\]]+|https?:\/\/[^\s<>"'`)\]]+|www\.[^\s<>"'`)\]]+|>>\d{4,})/g

/** Trailing sentence punctuation is not part of the URL: "see https://x.com/a." */
function splitTrailing(url: string): [string, string] {
  const m = url.match(/[.,;:!?]+$/)
  return m ? [url.slice(0, -m[0].length), m[0]] : [url, '']
}

const LINK_CLS = 'text-blue-400 hover:text-blue-300 underline decoration-blue-400/40 hover:decoration-blue-300 break-all'
// Deliberately NOT the blue of a URL. A pointer is navigation inside the archive, and a reader
// who cannot tell it from an outbound link learns nothing from the colour.
const REF_CLS = 'font-mono text-emerald-400 hover:text-emerald-300 underline decoration-emerald-400/40 hover:decoration-emerald-300'

/**
 * ">>NNNNNNN" — a link when we can honestly say where it goes, plain text otherwise.
 *
 * A drop we hold becomes internal navigation. A recovered anon post becomes an anchor to the
 * quoted block rendered under this same drop. Anything else stays exactly as Q typed it: a dead
 * link is worse than no link, because it promises the reader something and then wastes the click.
 */
function refNode(token: string, key: number): React.ReactNode {
  const boardId = token.slice(2)
  const target = resolveRef(boardId)
  if (!target) return token
  if (target.postNum !== undefined) {
    return (
      <Link
        key={key}
        to={`/post/${target.postNum}?flash=1`}
        className={REF_CLS}
        onClick={e => e.stopPropagation()}
        title={`Drop #${target.postNum}`}
      >
        {token}
      </Link>
    )
  }
  return (
    <a
      key={key}
      href={`#quoted-${boardId}`}
      className={REF_CLS}
      onClick={e => e.stopPropagation()}
      title="The quoted post, shown below"
    >
      {token}
    </a>
  )
}

function linkifyString(text: string): React.ReactNode {
  const parts = text.split(TOKEN_RE)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    if (i % 2 === 0) return part                     // capture group → matches sit at odd indices
    if (part.startsWith('>>')) return refNode(part, i)
    const [url, tail] = splitTrailing(part)
    if (!url) return part
    // The LINK TEXT stays exactly what Q typed, space and all — this archive never rewrites his
    // wording, not even a typo. Only the href is repaired, because a browser cannot follow a
    // space and a link that does not work is worse than no link.
    const href = url.startsWith('www.')
      ? `https://${url}`
      : url.replace(/^(https?:\/\/)[ \t]+/i, '$1')
    return (
      <React.Fragment key={i}>
        <a
          href={href}
          target="_blank"
          // noreferrer/nofollow: these are links Q posted, not endorsements, and several
          // point at sites that should not receive this archive as a referrer.
          rel="noopener noreferrer nofollow"
          className={LINK_CLS}
          onClick={e => e.stopPropagation()}
          title={href}
        >
          {url}
        </a>
        {tail}
      </React.Fragment>
    )
  })
}

export function linkify(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') return linkifyString(node)
  if (Array.isArray(node)) {
    return node.map((n, i) => <React.Fragment key={i}>{linkify(n)}</React.Fragment>)
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>
    if (el.type === 'a' || el.type === Link || el.props?.children === undefined) return node   // never nest anchors
    return React.cloneElement(el, undefined, linkify(el.props.children))
  }
  return node
}
