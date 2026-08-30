// WHO IS ALLOWED TO SPEND MONEY THROUGH THE DEV ANTHROPIC PROXY.
//
// /anthropic-proxy exists so the editorial dev server can reach the Anthropic API without the key
// ever entering browser JavaScript: vite.config.ts attaches it on the way out, in Node. That
// solves disclosure and creates a different hazard — the endpoint itself is now an unauthenticated
// way to spend the owner's money, and it carries no credential a caller has to know.
//
// The dev server is deliberately reachable from off-machine. `server.allowedHosts: true` and the
// qalerts/4plebs/8kun proxies exist so the archive can be opened on a phone through a Cloudflare
// tunnel. Anyone who reached that tunnel would also reach /anthropic-proxy, and the proxy would
// helpfully attach the real key to whatever they sent.
//
// So the AI tools are LOCAL-DESKTOP-ONLY, on purpose, and phone testing through a tunnel gets the
// archive without them. That is the trade this file enforces, and it is enforced BEFORE the key is
// attached — the request is refused while it is still just bytes.
//
// The decision is a pure function so it can be tested without a network, a tunnel, or a key.
// scripts/test-anthropic-proxy-guard.mjs exercises every branch.

export const ANTHROPIC_PROXY_PREFIX = '/anthropic-proxy'

/** The one operation the app performs. Anything else is refused. */
export const ALLOWED_METHOD = 'POST'
export const ALLOWED_PATHS = ['/v1/messages']

/** Loopback literals a browser can put in a Host header. */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** IPv4 loopback is a whole /8, and Node reports IPv4-mapped IPv6 for dual-stack sockets. */
export function isLoopbackAddress(addr) {
  if (!addr) return false
  const a = String(addr).trim().replace(/^\[|\]$/g, '')
  if (a === '::1' || a === '::ffff:127.0.0.1') return true
  const v4 = a.startsWith('::ffff:') ? a.slice(7) : a
  if (v4 === 'localhost') return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v4)
  if (!m) return false
  const parts = m.slice(1).map(Number)
  if (parts.some(n => n > 255)) return false
  return parts[0] === 127
}

/** The hostname a Host or Origin header names, minus any port and brackets. */
export function hostnameOf(value) {
  if (!value) return ''
  let v = String(value).trim()
  if (v.includes('://')) { try { v = new URL(v).host } catch { return '' } }
  // [::1]:5173 -> ::1   |   localhost:5173 -> localhost
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(v)
  if (bracket) return bracket[1].toLowerCase()
  return v.replace(/:\d+$/, '').toLowerCase()
}

export function isLocalHostname(value) {
  const h = hostnameOf(value)
  if (!h) return false
  return LOCAL_HOSTNAMES.has(h) || isLoopbackAddress(h)
}

/**
 * Decide whether one request may reach Anthropic with the owner's key attached.
 *
 * Returns { allow: true } or { allow: false, status, reason }. A refusal is deliberately terse to
 * the caller and specific in the log: a tunnel visitor learns nothing, the owner learns why.
 */
export function checkAnthropicProxyRequest({
  method, url, headers = {}, remoteAddress, isPublicSite = false, isDev = true,
}) {
  // 1. The public build has no AI at all, and the endpoint must not exist for it even by accident.
  if (isPublicSite) return { allow: false, status: 404, reason: 'the public build has no AI proxy' }
  // 2. Never in a built/preview server — this is a development convenience only.
  if (!isDev) return { allow: false, status: 404, reason: 'the AI proxy is development-only' }

  // 3. The socket must be loopback. This is the check a tunnel cannot forge: a tunnelled request
  //    arrives from the tunnel daemon, which is local — so it is necessary but NOT sufficient,
  //    which is why the Host and Origin checks below exist too.
  if (!isLoopbackAddress(remoteAddress)) {
    return { allow: false, status: 403, reason: `non-loopback remote address (${remoteAddress ?? 'unknown'})` }
  }

  // 4. The Host must be a loopback name. A Cloudflare tunnel forwards the PUBLIC hostname here
  //    (…​.trycloudflare.com), so this is what actually separates "the owner's browser on this
  //    machine" from "anyone who found the tunnel".
  const host = headers.host ?? headers.Host
  if (!isLocalHostname(host)) {
    return { allow: false, status: 403, reason: `non-local Host header (${hostnameOf(host) || 'missing'})` }
  }

  // 5. An Origin, when the browser sends one, must agree.
  const origin = headers.origin ?? headers.Origin
  if (origin && origin !== 'null' && !isLocalHostname(origin)) {
    return { allow: false, status: 403, reason: `non-local Origin (${hostnameOf(origin) || 'unparseable'})` }
  }

  // 6. Exactly one operation. A general-purpose passthrough to api.anthropic.com would let a caller
  //    reach every endpoint the key can reach, including account-level ones.
  if ((method ?? '').toUpperCase() !== ALLOWED_METHOD) {
    return { allow: false, status: 405, reason: `method ${method} is not allowed` }
  }
  const rawPath = String(url ?? '').split('?')[0]
  const suffix = rawPath.startsWith(ANTHROPIC_PROXY_PREFIX) ? rawPath.slice(ANTHROPIC_PROXY_PREFIX.length) : rawPath
  if (!ALLOWED_PATHS.includes(suffix.replace(/\/+$/, '') || '/')) {
    return { allow: false, status: 404, reason: `path ${suffix} is not a permitted operation` }
  }

  return { allow: true }
}
