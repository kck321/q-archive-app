import React from 'react'

/**
 * Turn URLs inside already-rendered post text into clickable links.
 *
 * Post bodies go through several highlighters first (questions, claims, entities, the search
 * term), each returning a mix of strings and elements — so this runs over the RESULT rather
 * than the raw text, and recurses into those elements. Q's drops put URLs inside lines that
 * get highlighted as claims, so skipping element children would leave most links dead.
 */

// Stops at whitespace and at the quote/bracket characters that fence a URL in prose.
const URL_RE = /(https?:\/\/[^\s<>"'`)\]]+|www\.[^\s<>"'`)\]]+)/g

/** Trailing sentence punctuation is not part of the URL: "see https://x.com/a." */
function splitTrailing(url: string): [string, string] {
  const m = url.match(/[.,;:!?]+$/)
  return m ? [url.slice(0, -m[0].length), m[0]] : [url, '']
}

const LINK_CLS = 'text-blue-400 hover:text-blue-300 underline decoration-blue-400/40 hover:decoration-blue-300 break-all'

function linkifyString(text: string): React.ReactNode {
  const parts = text.split(URL_RE)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    if (i % 2 === 0) return part                     // capture group → matches sit at odd indices
    const [url, tail] = splitTrailing(part)
    if (!url) return part
    const href = url.startsWith('www.') ? `https://${url}` : url
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
    if (el.type === 'a' || el.props?.children === undefined) return node   // never nest anchors
    return React.cloneElement(el, undefined, linkify(el.props.children))
  }
  return node
}
