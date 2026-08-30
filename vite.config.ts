import { defineConfig, loadEnv } from 'vite'
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

export default defineConfig(({ mode }) => {
  // Loaded with an EMPTY prefix, so this sees ANTHROPIC_API_KEY as well as the VITE_ ones.
  // It is read here, in the config, which runs in Node — nothing below puts it into `define`,
  // so it cannot reach a browser bundle. See the dev proxy in `server.proxy` and the comment
  // at the top of src/lib/claude.ts.
  const env = loadEnv(mode, process.cwd(), '')
  const anthropicKey = env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? ''

  return {
  base,
  plugins: [react(), editorialQueues()],
  build: {
    rollupOptions: {
      output: {
        // Vendor libraries split into their own chunks, for CACHING more than for size.
        //
        // One monolithic chunk meant every deploy changed its hash, so every returning visitor
        // re-downloaded ~1.4 MB of JS in which React and recharts were byte-identical to what
        // their cache already held. Split out, the vendor chunks keep their hashes across app
        // deploys — a returning visitor after a deploy re-fetches only the app's own code.
        //
        // firebase gets a named chunk too: after the fire() refactor it is only ever reached by
        // dynamic import, so on the public site this chunk is not fetched until a visitor
        // actually submits feedback or a resolution suggestion.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](recharts|victory-vendor|d3-|internmap|delaunator|robust-predicates)/.test(id)) return 'charts'
          if (/[\\/]node_modules[\\/](@firebase|firebase)[\\/]/.test(id)) return 'firebase'
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
  // Allow access through a tunnel domain (e.g. *.trycloudflare.com) for phone testing.
  preview: { allowedHosts: true },
  server: {
    allowedHosts: true,
    proxy: {
      // THE KEY IS ATTACHED HERE, ON THE SERVER, AND NEVER SENT TO THE BROWSER.
      //
      // src/lib/claude.ts points the Anthropic SDK at this path in dev with a placeholder key.
      // The placeholder is what browser JavaScript holds; the real header is written below, in
      // the Node process, on its way out. Vite's dev transform inlines the whole
      // `import.meta.env` object into every module that touches it, so a VITE_-prefixed secret
      // is served to the browser inside unrelated files — which is exactly how a key was
      // disclosed. ANTHROPIC_API_KEY has no VITE_ prefix and is therefore never in that object.
      '/anthropic-proxy': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/anthropic-proxy/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', proxyReq => {
            if (anthropicKey) proxyReq.setHeader('x-api-key', anthropicKey)
            // Never forward the browser's placeholder, and never leak an Origin that would make
            // Anthropic treat this as a browser call.
            proxyReq.removeHeader('authorization')
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
          })
        },
      },
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
  }
})
