// Seed 5 → Seed 6 migration parity, in a real browser.
//
// Drives the installed Chrome directly over the DevTools Protocol. No Playwright, no Puppeteer,
// no new dependency — Node 24 ships a global WebSocket, and Chrome speaks CDP over it.
//
// This covers the two things the Node test could not: the IndexedDB write itself, and whether a
// returning profile's cached collections are genuinely replaced on a version bump.
//
//   Profile B  seed at version 5, restart against version 6, read IndexedDB back
//   Profile A  fresh profile straight onto version 6
//   Assert     migrated state == fresh state for every rendering-relevant field
//
//   node scripts/test-seed-migration-browser.mjs [--url http://localhost:5174]
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1) }

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function launch(profileDir, port) {
  fs.mkdirSync(profileDir, { recursive: true })
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'],
    { stdio: 'ignore', detached: true })
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) return proc
    } catch { /* not up yet */ }
    await sleep(500)
  }
  throw new Error('Chrome did not expose CDP')
}

/** Open a page, run one expression after load, return its value. */
async function evaluate(port, url, expression, settleMs = 9000) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
  const ws = new WebSocket(targets.webSocketDebuggerUrl)
  await new Promise(r => { ws.onopen = r })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => {
    const msg = JSON.parse(e.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  }
  const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })

  await send('Page.enable')
  await sleep(settleMs)                      // let the app seed IndexedDB
  const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  ws.close()
  try { await fetch(`http://127.0.0.1:${port}/json/close/${targets.id}`) } catch { /* ignore */ }
  return out?.result?.result?.value
}

/** Read the seed version and the rendering-field populations straight out of IndexedDB. */
const READ_STATE = `(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const get = k => new Promise((res, rej) => { const tx = db.transaction('collections', 'readonly'); const q = tx.objectStore('collections').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
  const seed = await get('__seed_version__')
  const posts = (await get('posts')) || []
  const count = f => posts.reduce((n, p) => n + ((p.postAnalysis && p.postAnalysis[f]) || []).length, 0)
  return JSON.stringify({
    seed, posts: posts.length,
    contextUnits: count('contextUnits'), themeAnchors: count('themeAnchors'),
    claimSpans: count('claimSpans'), checkableSpans: count('checkableSpans'),
    conclusionSpans: count('conclusionSpans'), predictionSpans: count('predictionSpans'),
    claims: count('claims'), emphasis: count('emphasis'),
  })
})()`

/** Force the stored seed marker back to 5 so the next load looks like a returning Seed-5 profile. */
const DOWNGRADE = `(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  await new Promise((res, rej) => { const tx = db.transaction('collections', 'readwrite'); tx.objectStore('collections').put(5, '__seed_version__'); tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
  const posts = await new Promise(res => { const tx = db.transaction('collections', 'readonly'); const q = tx.objectStore('collections').get('posts'); q.onsuccess = () => res(q.result || []) })
  // Strip the Seed-6-only fields so the cache genuinely looks like the old build's.
  for (const p of posts) if (p.postAnalysis) for (const f of ['contextUnits','themeAnchors','claimSpans','checkableSpans','conclusionSpans','predictionSpans']) delete p.postAnalysis[f]
  await new Promise((res, rej) => { const tx = db.transaction('collections', 'readwrite'); tx.objectStore('collections').put(posts, 'posts'); tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
  return 'downgraded'
})()`

const tmp = path.join(os.tmpdir(), 'qdrops-seedtest')
fs.rmSync(tmp, { recursive: true, force: true })
const profA = path.join(tmp, 'fresh')
const profB = path.join(tmp, 'returning')

console.log(`\nSEED 5 → 6 MIGRATION PARITY (real browser)\n\n  target : ${URL_BASE}\n  chrome : ${path.basename(CHROME)}\n`)

let procA, procB
try {
  // Profile A — fresh visitor
  procA = await launch(profA, 9401)
  const fresh = JSON.parse(await evaluate(9401, URL_BASE, READ_STATE))
  console.log('  fresh profile      :', JSON.stringify(fresh))

  // Profile B — seed, downgrade to look like Seed 5, reload, re-read
  procB = await launch(profB, 9402)
  await evaluate(9402, URL_BASE, READ_STATE)                 // initial seed
  await evaluate(9402, URL_BASE, DOWNGRADE, 2000)            // pretend to be Seed 5
  const stale = JSON.parse(await evaluate(9402, URL_BASE, READ_STATE, 2000))
  console.log('  after downgrade    :', JSON.stringify(stale))
  const migrated = JSON.parse(await evaluate(9402, URL_BASE, READ_STATE))   // reload → migrate
  console.log('  migrated profile   :', JSON.stringify(migrated))

  const FIELDS = ['seed', 'posts', 'contextUnits', 'themeAnchors', 'claimSpans', 'checkableSpans',
    'conclusionSpans', 'predictionSpans', 'claims', 'emphasis']
  const diffs = FIELDS.filter(f => fresh[f] !== migrated[f])
  const checks = [
    ['stale profile really looked like Seed 5', stale.seed === 5 && stale.contextUnits === 0, `seed ${stale.seed}, contextUnits ${stale.contextUnits}`],
    ['migrated profile reached the current seed', migrated.seed === fresh.seed, `${migrated.seed} vs ${fresh.seed}`],
    ['no stale rendering field survived', migrated.contextUnits === fresh.contextUnits, `${migrated.contextUnits}`],
    ['fresh state == migrated state', diffs.length === 0, diffs.length ? diffs.join(', ') : 'identical'],
  ]
  console.log('')
  let failed = 0
  for (const [n, ok, d] of checks) { if (!ok) failed++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(44)} ${d}`) }
  console.log(`\n  ${checks.length - failed}/${checks.length} checks pass\n`)
  process.exitCode = failed ? 1 : 0
} finally {
  for (const port of [9401, 9402]) { try { await fetch(`http://127.0.0.1:${port}/json/close`) } catch { /* ignore */ } }
  try { execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' }) } catch { /* ignore */ }
  void procA; void procB
}
