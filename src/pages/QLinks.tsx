import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllPostsWithLinks } from '../lib/posts'
import type { QPost } from '../types'

function getDomain(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function QLinks() {
  const [posts, setPosts] = useState<QPost[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getAllPostsWithLinks().then(p => { setPosts(p); setLoading(false) })
  }, [])

  const filtered = search
    ? posts.filter(p =>
        p.link.toLowerCase().includes(search.toLowerCase()) ||
        p.text.toLowerCase().includes(search.toLowerCase()) ||
        String(p.postNum).includes(search)
      )
    : posts

  // Group by domain for the domain badge
  const domainCounts = posts.reduce<Record<string, number>>((acc, p) => {
    const d = getDomain(p.link)
    acc[d] = (acc[d] ?? 0) + 1
    return acc
  }, {})
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-1">All Q Links</h1>
      <p className="text-gray-500 text-sm mb-4">
        {loading ? 'Loading…' : `${posts.length} posts contain external links — chronological order`}
      </p>

      {/* Top domains quick-filter */}
      {!loading && topDomains.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {topDomains.map(([domain, count]) => (
            <button
              key={domain}
              onClick={() => setSearch(domain === search ? '' : domain)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                search === domain
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-q-panel border-q-border text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {domain} <span className="opacity-60">({count})</span>
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder="Search links, post text, or post number…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-q-panel border border-q-border rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600 mb-6"
      />

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500">No links found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => {
            const date = new Date(post.timestamp * 1000).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
            })
            const domain = getDomain(post.link)
            return (
              <div key={post.id} className="bg-q-panel border border-q-border rounded-xl p-4 hover:border-gray-600 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Link
                        to={`/post/${post.postNum}?flash=1`}
                        className="text-xs font-mono text-blue-400 hover:underline shrink-0"
                      >
                        #{post.postNum}
                      </Link>
                      <span className="text-xs text-gray-600">{date}</span>
                      <span className="text-xs bg-gray-800 border border-gray-700 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                        {domain}
                      </span>
                    </div>
                    {/* Link */}
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-300 hover:text-blue-100 break-all leading-snug"
                    >
                      {post.link}
                    </a>
                    {/* Post snippet */}
                    {post.text && (
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">
                        {post.text.slice(0, 240)}{post.text.length > 240 ? '…' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
