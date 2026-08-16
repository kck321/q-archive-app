import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Serve the editorial review queues to the EDITORIAL BUILD ONLY.
 *
 * These hold 3,144 unreviewed synopses about named people, plus 441 quarantined records. They
 * must be reachable by the owner and unreachable by everyone else, and the strongest way to say
 * that is not a permission check — it is for the bytes never to exist in the published bundle.
 *
 * So they live under audit/, which Vite does not serve, and this middleware exposes them on the
 * dev server only. `npm run deploy:web` sets VITE_PUBLIC_SITE=1 and copies public/ into dist/;
 * audit/ is not public/, and a middleware is not a file, so there is nothing to copy. The public
 * site cannot serve this data even if a future route asks for it.
 */
function editorialQueues() {
  const FILES: Record<string, string> = {
    'hover-review': 'entity-hover-review-queue.json',
    'hover-url-quarantine': 'entity-hover-url-quarantine.json',
    'hover-withdrawn': 'entity-hover-withdrawn.json',
  }
  return {
    name: 'editorial-queues',
    apply: 'serve' as const,
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/editorial\/([a-z-]+)\.json/.exec(req.url ?? '')
        if (!m) return next()
        // Belt and braces: even on the dev server, refuse when the public flag is set.
        if (process.env.VITE_PUBLIC_SITE === '1') { res.statusCode = 404; return res.end('not available in the public build') }
        const file = FILES[m[1]]
        if (!file) { res.statusCode = 404; return res.end('unknown queue') }
        const abs = path.resolve(process.cwd(), 'audit', file)
        if (!fs.existsSync(abs)) { res.statusCode = 404; return res.end('queue not built') }
        res.setHeader('Content-Type', 'application/json')
        res.end(fs.readFileSync(abs))
      })
    },
  }
}

// When DEPLOY_TARGET=pages, build for GitHub Pages under the repo subpath.
// Desktop (Tauri) and the tunnel preview keep the root base "/".
const base = process.env.DEPLOY_TARGET === 'pages' ? '/q-archive-app/' : '/'

export default defineConfig({
  base,
  plugins: [react(), editorialQueues()],
  // Allow access through a tunnel domain (e.g. *.trycloudflare.com) for phone testing.
  preview: { allowedHosts: true },
  server: {
    allowedHosts: true,
    proxy: {
      '/qalerts-proxy': {
        target: 'https://qalerts.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/qalerts-proxy/, ''),
      },
      '/4plebs-proxy': {
        target: 'https://archive.4plebs.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/4plebs-proxy/, ''),
      },
      '/qanonpub-proxy': {
        target: 'https://qanon.pub',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/qanonpub-proxy/, ''),
      },
      '/8kun-proxy': {
        target: 'https://8kun.top',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/8kun-proxy/, ''),
      },
      '/4cdn-proxy': {
        target: 'https://a.4cdn.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/4cdn-proxy/, ''),
      },
    },
  },
})
