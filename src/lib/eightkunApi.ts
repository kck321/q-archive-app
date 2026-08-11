// ─── Board Thread Fetcher (4chan / 8chan / 8kun) ───────────────────────────────
// Fetches thread JSON via CORS proxies (browser CORS blocks direct fetch).

export interface EightkunReply {
  no: number
  text: string     // plain text stripped from HTML
  name: string
  trip?: string
  isQ: boolean     // true if reply has a Q tripcode
}

// Strip imageboard HTML tags and decode common entities
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

export const Q_TRIPCODES = new Set([
  '!UW.yye1fxo',    // 4chan  Oct 28–29, 2017
  '!2jsTvXXmX6',    // 4chan  Oct 29–30, 2017
  '!ITPb.qbhqo',    // 4chan  Oct 30–31, 2017
  '!xowAT4Z3VQ',    // 4chan  Oct 31 – Nov 1, 2017
  '!!mG7VJxZNCI',   // 8chan  Nov 1, 2017 – Jan 10, 2018 + Jun 26 – Nov 12, 2018
  '!!Hs1Jq13jV6',   // 8chan  Jan 10 – Jun 26, 2018
  '!!CbboFOtcZs',   // 8chan  Nov 12, 2018 – Feb 18, 2019
  '!!4pRcUA0lBE',   // 8chan  Feb 18 – Aug 5, 2019
  '!!V4cG8aHq7g',   // 8kun   Nov 2, 2019 – Dec 8, 2020
])

// Parse Q post links from 4chan, 8chan, and 8kun.
// Returns board, threadId, and platform so the correct API URL is used.
export function parseEightkunLink(link: string): { board: string; threadId: string; platform: '4chan' | '8chan' | '8kun' } | null {
  if (!link) return null
  // 4chan: https://boards.4chan.org/pol/thread/147146601
  const m4 = link.match(/(?:boards\.)?4chan(?:nel)?\.org\/([^/]+)\/thread\/(\d+)/)
  if (m4) return { board: m4[1], threadId: m4[2], platform: '4chan' }
  // 8kun: https://8kun.top/qresearch/res/123456.html
  const mk = link.match(/8kun\.top\/([^/]+)\/res\/(\d+)/)
  if (mk) return { board: mk[1], threadId: mk[2], platform: '8kun' }
  // 8chan: https://8ch.net/qresearch/res/123456.html (content migrated to 8kun API)
  const mc = link.match(/8ch\.net\/([^/]+)\/res\/(\d+)/)
  if (mc) return { board: mc[1], threadId: mc[2], platform: '8chan' }
  return null
}

// Convert external URL to local Vite proxy path (bypasses CORS entirely)
function toViteProxyUrl(url: string): string {
  if (url.startsWith('https://8kun.top/')) return url.replace('https://8kun.top', '/8kun-proxy')
  if (url.startsWith('https://a.4cdn.org/')) return url.replace('https://a.4cdn.org', '/4cdn-proxy')
  return url
}

async function proxyFetch(url: string): Promise<Response> {
  // Try Vite proxy first (no CORS, most reliable)
  const viteUrl = toViteProxyUrl(url)
  try {
    const r = await fetch(viteUrl, { signal: AbortSignal.timeout(12000) })
    if (r.ok) return r
  } catch { /* fall through */ }

  // Fallback to external proxies
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ]
  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { signal: AbortSignal.timeout(12000) })
      if (r.ok) return r
    } catch { /* try next */ }
  }
  throw new Error(`Failed to fetch ${url} via all proxies`)
}

export async function fetchThreadReplies(
  board: string,
  threadId: string,
  platform: '4chan' | '8chan' | '8kun' = '8kun'
): Promise<EightkunReply[]> {
  // 4chan uses a.4cdn.org; 8chan content was migrated to 8kun so both use 8kun API
  const url = platform === '4chan'
    ? `https://a.4cdn.org/${board}/thread/${threadId}.json`
    : `https://8kun.top/${board}/res/${threadId}.json`

  const res = await proxyFetch(url)
  const data = await res.json() as { posts?: { no: number; name?: string; trip?: string; com?: string }[] }
  if (!data.posts) return []

  // Skip the first post (Q's own OP post) — we only want replies
  return data.posts.slice(1).map(p => ({
    no: p.no,
    text: stripHtml(p.com ?? ''),
    name: p.name ?? 'Anonymous',
    trip: p.trip,
    isQ: Q_TRIPCODES.has(p.trip ?? ''),
  })).filter(p => p.text.length > 0)
}
