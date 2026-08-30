// The dev Anthropic proxy is local-desktop-only, and no build ships a key.
//
//   node scripts/test-anthropic-proxy-guard.mjs
//
// Two properties, and they are different failures:
//
//   1. DISCLOSURE — the key must not be in browser JavaScript. It used to be: VITE_ANTHROPIC_API_KEY
//      meant Vite inlined the whole import.meta.env object into every module that touched it, so
//      src/lib/appMode.ts — which only reports whether this is the public build — served the key.
//      One was disclosed that way and had to be revoked.
//
//   2. SPENDING — the replacement attaches the key server-side, which fixes disclosure and creates
//      an unauthenticated way to spend money. The dev server is deliberately reachable off-machine
//      (`allowedHosts: true`, tunnel proxies for phone testing), so /anthropic-proxy has to refuse
//      everything that is not this machine, BEFORE the key is attached.
//
// The deliberate outcome: AI works on the local desktop editorial server and is unavailable
// through a phone-testing tunnel. Offline and pure — no network, no tunnel, no key.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkAnthropicProxyRequest, isLoopbackAddress, isLocalHostname, hostnameOf,
  ANTHROPIC_PROXY_PREFIX, ALLOWED_METHOD,
} from './lib/anthropicProxyGuard.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const results = []
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }

/** A request that should be allowed, with one field overridden per case. */
const req = (over = {}) => ({
  method: 'POST',
  url: `${ANTHROPIC_PROXY_PREFIX}/v1/messages`,
  headers: { host: 'localhost:5173', origin: 'http://localhost:5173' },
  remoteAddress: '::1',
  isPublicSite: false,
  isDev: true,
  ...over,
})
const allowed = over => checkAnthropicProxyRequest(req(over)).allow === true
const refusal = over => checkAnthropicProxyRequest(req(over))

// ── accepted: the owner's own machine ────────────────────────────────────────
check('localhost is accepted', allowed({ headers: { host: 'localhost:5173' }, remoteAddress: '::1' }))
check('127.0.0.1 is accepted', allowed({ headers: { host: '127.0.0.1:5173' }, remoteAddress: '127.0.0.1' }))
check('[::1] is accepted', allowed({ headers: { host: '[::1]:5173' }, remoteAddress: '::1' }))
check('an IPv4-mapped loopback socket is accepted',
  allowed({ headers: { host: '127.0.0.1:5173' }, remoteAddress: '::ffff:127.0.0.1' }))
check('127.0.0.53 is still loopback', isLoopbackAddress('127.0.0.53'))
check('a request with no Origin at all is accepted', allowed({ headers: { host: 'localhost:5173' } }))
check('Origin "null" (a sandboxed frame) does not by itself refuse',
  allowed({ headers: { host: 'localhost:5173', origin: 'null' } }))

// ── refused: everything that is not this machine ─────────────────────────────
{
  const r = refusal({ headers: { host: 'random-words-1234.trycloudflare.com' } })
  check('a Cloudflare tunnel hostname is refused', !r.allow && r.status === 403, r.reason ?? '')
}
{
  const r = refusal({ headers: { host: 'qdrops.app' } })
  check('any other public hostname is refused', !r.allow && r.status === 403, r.reason ?? '')
}
{
  // A tunnel daemon connects from loopback, so the socket check alone is not enough — the Host is.
  const r = refusal({ headers: { host: 'abc.trycloudflare.com' }, remoteAddress: '127.0.0.1' })
  check('a tunnelled request from a LOCAL daemon is still refused on its Host',
    !r.allow && r.status === 403, r.reason ?? '')
}
{
  const r = refusal({ remoteAddress: '192.168.1.42' })
  check('a non-loopback remote address is refused', !r.allow && r.status === 403, r.reason ?? '')
}
{
  const r = refusal({ remoteAddress: undefined })
  check('an unknown remote address is refused', !r.allow && r.status === 403, r.reason ?? '')
}
{
  const r = refusal({ headers: { host: 'localhost:5173', origin: 'https://evil.example' } })
  check('a non-local Origin is refused', !r.allow && r.status === 403, r.reason ?? '')
}
{
  const r = refusal({ headers: {} })
  check('a missing Host header is refused', !r.allow && r.status === 403, r.reason ?? '')
}
{
  const r = refusal({ headers: { host: 'localhost.evil.example:5173' } })
  check('a hostname merely CONTAINING localhost is refused', !r.allow && r.status === 403, r.reason ?? '')
}

// ── refused: wrong mode, method or operation ─────────────────────────────────
{
  const r = refusal({ isPublicSite: true })
  check('the public build refuses the proxy entirely', !r.allow && r.status === 404, r.reason ?? '')
}
{
  const r = refusal({ isDev: false })
  check('a non-development server refuses the proxy', !r.allow && r.status === 404, r.reason ?? '')
}
{
  const r = refusal({ method: 'GET' })
  check('GET is refused', !r.allow && r.status === 405, r.reason ?? '')
}
{
  const r = refusal({ url: `${ANTHROPIC_PROXY_PREFIX}/v1/organizations/me` })
  check('any endpoint other than the messages operation is refused',
    !r.allow && r.status === 404, r.reason ?? '')
}
{
  const r = refusal({ url: `${ANTHROPIC_PROXY_PREFIX}/v1/messages/../v1/organizations` })
  check('a traversal-shaped path is refused', !r.allow, r.reason ?? '')
}
check('the allowed method is POST', ALLOWED_METHOD === 'POST')
check('hostnameOf strips ports and brackets',
  hostnameOf('[::1]:5173') === '::1' && hostnameOf('localhost:5173') === 'localhost' &&
  hostnameOf('http://127.0.0.1:5173') === '127.0.0.1')
check('isLocalHostname rejects a tunnel host', !isLocalHostname('x.trycloudflare.com'))

// ── the guard actually runs, ahead of the proxy ──────────────────────────────
{
  const cfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8')
  check('the guard plugin is registered', /plugins:\s*\[[^\]]*anthropicProxyGuard\(\)/.test(cfg))
  check('the guard is registered BEFORE the key is attached',
    cfg.indexOf('anthropicProxyGuard()') < cfg.indexOf("setHeader('x-api-key'"))
  check('the proxy refuses to attach a key in public mode',
    /VITE_PUBLIC_SITE !== '1'[^\n]*\n?[^\n]*/.test(cfg.slice(cfg.indexOf("setHeader('x-api-key'") - 200, cfg.indexOf("setHeader('x-api-key'") + 200)) ||
    /if \(anthropicKey && process\.env\.VITE_PUBLIC_SITE !== '1'\)/.test(cfg))
  check('the key is never placed in a build-time define',
    !/define\s*:/.test(cfg) || !/ANTHROPIC/.test(cfg.slice(cfg.indexOf('define'), cfg.indexOf('define') + 400)))
}

// ── no secret-shaped value in source or in either build ──────────────────────
{
  const claude = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'claude.ts'), 'utf8')
  const live = claude.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  check('claude.ts no longer reads a VITE_-prefixed key', !/import\.meta\.env\.VITE_ANTHROPIC/.test(live))
  check('claude.ts sends only a placeholder from the browser', /proxied-by-the-dev-server/.test(live))

  const SECRET = /sk-ant-[A-Za-z0-9_\-]{20,}/
  const walk = d => { let out = []; let e = []
    try { e = fs.readdirSync(d, { withFileTypes: true }) } catch { return out }
    for (const x of e) out = out.concat(x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)])
    return out }
  const distDir = path.join(ROOT, 'dist')
  if (fs.existsSync(distDir)) {
    const bad = walk(distDir).filter(f => /\.(js|html|css|map|json)$/i.test(f))
      .filter(f => SECRET.test(fs.readFileSync(f, 'utf8')))
    check('no built asset carries a key token', bad.length === 0, bad.map(f => path.basename(f)).join(', '))
  } else {
    check('no built asset carries a key token (dist absent — build separately)', true, 'skipped: no dist/')
  }
  // The tracked env templates must never reintroduce the prefix.
  for (const f of ['.env.example', '.env.production', '.env.public']) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8')
    check(`${f} declares no VITE_-prefixed Anthropic key`, !/^VITE_ANTHROPIC_API_KEY=/m.test(t))
  }
}

console.log('\nANTHROPIC DEV PROXY — LOCAL ONLY\n')
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) { console.error('\n[X] the AI proxy is not safely restricted.\n'); process.exit(1) }
console.log('')
