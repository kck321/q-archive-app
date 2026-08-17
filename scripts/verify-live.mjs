// THE LIVE PROOF — delivery, not logic.
//
//   node scripts/verify-live.mjs                       the delivery proof (run AFTER deploying)
//   node scripts/verify-live.mjs --smoke month-chart   plus a targeted gate for what changed
//   node scripts/verify-live.mjs --full                every browser gate, against production
//   node scripts/verify-live.mjs --url https://qdrops.app
//
// WHAT CHANGED HERE, AND WHY IT IS NOT A WEAKENING.
//
// The live pass used to re-run all nine local browser gates against production: 12.4 minutes of a
// 27-minute deploy, proving application logic a second time against THE SAME dist/ that had just
// passed locally. A tooltip cannot behave differently because GitHub is serving the bytes.
//
// What CAN differ between `vite preview dist/` and `https://qdrops.app` is delivery, and delivery is
// what has actually failed here:
//
//   · the CDN serves the previous bundle for minutes after a push — so "it looked right" proves
//     nothing about whether the change shipped
//   · a returning reader keeps whatever they seeded until SEED_VERSION changes, and the service
//     worker keeps whatever it cached until CACHE_VERSION changes. Both have stranded readers on an
//     old build while every server-side check was green.
//   · a data file can simply fail to be published
//
// So this asks the delivery questions and only those: is production serving the build that was
// validated, are its assets and service worker this deploy's, are the critical data files the ones
// on disk, does a first-time visitor get a working site, and does a RETURNING one receive the new
// seed. Everything about how the app behaves was proved locally, on these exact bytes.
//
// --smoke is how a changed feature gets its one look on production. --full is the escape hatch that
// restores the old behaviour when something warrants it.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const argv = process.argv.slice(2)
const at = flag => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null }
const LIVE = at('--url') ?? 'https://qdrops.app'
const FULL = argv.includes('--full')
const smoke = (at('--smoke') ?? '').split(',').map(s => s.trim()).filter(Boolean)
// The CDN serves the previous bundle for a short while after a push. This is how long the identity
// check is willing to keep asking before calling it stale.
const SETTLE = Number(at('--settle') ?? 120) * 1000

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const bust = u => `${u}${u.includes('?') ? '&' : '?'}cb=${Date.now()}`

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, ok: Boolean(ok), description, detail: String(detail) })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(30)} ${description}`)
  if (!ok) console.log(`        ↳ ${String(detail).slice(0, 300)}`)
}

console.log(`\nLIVE DELIVERY PROOF — ${LIVE}\n`)
const started = Date.now()

// ── 1. IDENTITY: production is serving the build that was validated ──────────
const stampPath = path.join(DIST, 'build-info.json')
if (!fs.existsSync(stampPath)) {
  console.error(`\n  dist/build-info.json is missing.\n`
    + `  It is written during the deploy (scripts/write-build-info.mjs). Without it there is no way\n`
    + `  to tell "the site is up" from "the site is serving the build from an hour ago" — which is\n`
    + `  the exact failure this file exists to end. Re-deploy, or build and stamp:\n\n`
    + `      npx vite build && node scripts/write-build-info.mjs\n`)
  process.exit(1)
}
const expected = JSON.parse(fs.readFileSync(stampPath, 'utf8'))
console.log(`  expecting commit ${expected.commitShort} · seed ${expected.seed} · sw ${expected.swVersion}\n`)

let served = null
{
  const deadline = Date.now() + SETTLE
  for (;;) {
    try {
      const res = await fetch(bust(`${LIVE}/build-info.json`), { cache: 'no-store' })
      served = res.ok ? await res.json() : { status: res.status }
    } catch (err) { served = { unreachable: String(err?.message ?? err) } }
    if (served?.builtAt === expected.builtAt) break
    if (Date.now() > deadline) break
    process.stdout.write(`  … CDN still serving ${served?.commitShort ?? '?'} — waiting\n`)
    await sleep(5000)
  }
}
check('deployed-build', 'production serves the build that was validated',
  served?.builtAt === expected.builtAt && served?.commit === expected.commit,
  `expected ${expected.commitShort}@${expected.builtAt}, serving ${served?.commitShort ?? JSON.stringify(served)}@${served?.builtAt ?? '?'}`)
check('deployed-seed', `production declares SEED_VERSION ${expected.seed}`,
  served?.seed === expected.seed, `live seed=${served?.seed}`)
check('deployed-manifest', 'production carries the certified manifest that was verified',
  Boolean(expected.manifestSha) && served?.manifestSha === expected.manifestSha,
  `expected ${String(expected.manifestSha).slice(0, 12)}, live ${String(served?.manifestSha).slice(0, 12)}`)
check('clean-commit', 'the deployed commit is one git can reproduce',
  expected.dirty === false, expected.dirty ? 'built from a dirty working tree' : `${expected.commitShort} on ${expected.branch}`)

// ── 2. THE ASSETS index.html POINTS AT ───────────────────────────────────────
// index.html names the current hashed bundles. If the live copy names different ones, readers are
// being handed a different build regardless of what any other file says.
{
  let liveHtml = ''
  try { liveHtml = await (await fetch(bust(`${LIVE}/index.html`), { cache: 'no-store' })).text() } catch { /* reported below */ }
  const liveAssets = [...liveHtml.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(m => m[1]).sort()
  const same = JSON.stringify(liveAssets) === JSON.stringify(expected.assets ?? [])
  check('index-assets', 'live index.html names this build\'s hashed assets', same,
    same ? `${liveAssets.length} assets` : `live [${liveAssets.join(' ')}] vs built [${(expected.assets ?? []).join(' ')}]`)

  // And they must actually be fetchable — a hashed bundle that 404s is a white screen.
  for (const a of (expected.assets ?? []).slice(0, 6)) {
    let ok = false, status = 'error'
    try { const r = await fetch(`${LIVE}${a.startsWith('/') ? '' : '/'}${a}`, { method: 'HEAD' }); ok = r.ok; status = r.status } catch (e) { status = String(e?.message ?? e) }
    check(`asset-served`, `${a} is served`, ok, `HTTP ${status}`)
  }
}

// ── 3. SERVICE WORKER / CACHE MIGRATION ──────────────────────────────────────
// An installed reader is released from the old cache only when CACHE_VERSION changes. This is the
// mechanism, checked at the layer it lives in rather than inferred from a green page.
{
  let liveSw = ''
  try { liveSw = await (await fetch(bust(`${LIVE}/sw.js`), { cache: 'no-store' })).text() } catch { /* reported below */ }
  const liveVersion = (liveSw.match(/const CACHE_VERSION = '([^']*)'/) ?? [])[1] ?? null
  check('sw-version', 'the live service worker carries this deploy\'s cache version',
    Boolean(liveVersion) && liveVersion === expected.swVersion,
    `live "${liveVersion}" vs built "${expected.swVersion}"`)
  check('sw-stamped', 'the cache version is a deploy stamp, not the unstamped default',
    Boolean(liveVersion) && liveVersion !== 'qdrops-v1', `"${liveVersion}"`)
  // Byte identity, not a spot check. The worker is the one file that decides what every installed
  // reader is allowed to see; "it has the right version string" is weaker than "it is the file".
  const localSw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8')
  check('sw-identical', 'the live service worker is byte-identical to the one built',
    liveSw === localSw, `live ${liveSw.length}B vs built ${localSw.length}B`)
}

// ── 4. THE CRITICAL DATA FILES ARE PUBLISHED, AND ARE THE ONES ON DISK ───────
// Byte length for everything, plus a full hash for anything small enough to fetch cheaply. A 9 MB
// posts.json that matches to the byte is not plausibly a different file.
{
  const dataDir = path.join(DIST, 'data')
  const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(f => f.endsWith('.json')).sort() : []
  const HASH_UNDER = 2 * 1024 * 1024
  let sizeOk = 0, hashOk = 0
  const bad = []
  for (const f of files) {
    const local = fs.readFileSync(path.join(dataDir, f))
    const url = bust(`${LIVE}/data/${f}`)
    try {
      if (local.length <= HASH_UNDER) {
        const buf = Buffer.from(await (await fetch(url, { cache: 'no-store' })).arrayBuffer())
        if (sha(buf) === sha(local)) { hashOk++; sizeOk++ } else bad.push(`${f} content differs (${buf.length} vs ${local.length} bytes)`)
      } else {
        // Identity encoding, or content-length reports the gzipped size and every large file "differs".
        const r = await fetch(url, { method: 'HEAD', headers: { 'accept-encoding': 'identity' }, cache: 'no-store' })
        const len = Number(r.headers.get('content-length'))
        if (r.ok && len === local.length) sizeOk++
        else bad.push(`${f} ${r.status} length ${len} vs ${local.length}`)
      }
    } catch (err) { bad.push(`${f} ${String(err?.message ?? err)}`) }
  }
  check('data-files-published', `all ${files.length} data artifacts are served and match the bundle`,
    bad.length === 0 && files.length > 0,
    bad.length ? bad.slice(0, 5).join(' · ') : `${sizeOk} verified (${hashOk} by full hash)`)
}

// ── 5 + 6. A FIRST-TIME AND A RETURNING READER, IN A REAL BROWSER ────────────
const gate = (label, argvv) => {
  const t0 = Date.now()
  process.stdout.write(`\n▶ ${label}\n`)
  const r = spawnSync(argvv[0], argvv.slice(1), { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  check(label.replace(/\s+/g, '-'), `${label} (${secs}s)`, r.status === 0, `exit ${r.status}`)
  return r.status === 0
}

if (FULL) {
  // The old behaviour, kept deliberately: everything, against production. For a release, or when a
  // delivery failure needs the whole surface re-proved.
  gate('live — alias visibility', ['node', 'scripts/test-alias-visibility.mjs', LIVE, '--fresh'])
  gate('live — inline drop reader', ['node', 'scripts/test-inline-drop-reader.mjs', LIVE, '--fresh'])
  gate('live — reader info box', ['node', 'scripts/test-term-info.mjs', LIVE, '--fresh'])
  gate('live — tooltip accessibility', ['node', 'scripts/test-hover-accessibility.mjs', LIVE, '--fresh'])
  gate('live — multi-word glossary terms', ['node', 'scripts/test-multiword-gloss.mjs', LIVE, '--fresh'])
  gate('live — category ordering', ['node', 'scripts/test-category-order.mjs', LIVE, '--fresh'])
  gate('live — entity list reconciliation', ['node', 'scripts/test-entity-reconciliation.mjs', '--url', LIVE])
  gate('live — month chart behaviour', ['node', 'scripts/test-month-chart-behaviour.mjs', '--url', LIVE, '--full'])
} else {
  // A FRESH VISITOR: nothing cached, the app builds everything from the bundle it just downloaded.
  // The cheapest gate that proves the seeded data reached the rendered page.
  gate('live — fresh visitor', ['node', 'scripts/test-alias-visibility.mjs', LIVE, '--fresh'])
  for (const name of smoke) {
    const file = name.endsWith('.mjs') ? name : `test-${name.replace(/^test-/, '')}.mjs`
    const rel = file.startsWith('scripts/') ? file : `scripts/${file}`
    if (!fs.existsSync(path.join(ROOT, rel))) { check(`smoke-${name}`, 'the named smoke gate exists', false, rel); continue }
    gate(`live — smoke: ${name}`, ['node', rel, '--url', LIVE])
  }
}

// A RETURNING VISITOR, deliberately downgraded to the pre-change state. The one that has failed in
// production while every other check was green — and the reason a live pass exists at all.
gate('live — returning visitor', ['node', 'scripts/test-returning-profile.mjs', '--url', LIVE])

const failed = results.filter(r => !r.ok)
console.log(`\n${'─'.repeat(64)}`)
console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s — ${results.length - failed.length}/${results.length} checks pass`)
console.log(failed.length
  ? `\n  ❌ ${failed.length} FAILED:\n${failed.map(f => `     ${f.id} — ${f.detail}`).join('\n')}\n`
  : `\n  ✅ production is serving the validated build, and both a new and a returning reader receive it — ${LIVE}\n`)
process.exit(failed.length ? 1 : 0)
