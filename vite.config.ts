import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When DEPLOY_TARGET=pages, build for GitHub Pages under the repo subpath.
// Desktop (Tauri) and the tunnel preview keep the root base "/".
const base = process.env.DEPLOY_TARGET === 'pages' ? '/q-archive-app/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
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
