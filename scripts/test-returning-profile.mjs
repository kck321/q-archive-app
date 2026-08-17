// Does a RETURNING reader receive the owner-adjudicated Claims?
//
// The seven Claims were certified, deployed, and confirmed live in posts.json — and the owner
// still could not see them, because a returning profile keeps whatever it seeded into IndexedDB
// until SEED_VERSION changes. A fresh headless profile painted both #2917 sentences amber the
// whole time. "Live in the bundle" and "reaches the reader" are different claims, and only the
// second one is the finish line.
//
// So this test never uses a fresh profile for the assertion:
//
//   1. load the site once, let it seed             (profile now holds the current data)
//   2. force the profile to look like the old one  (__seed_version__ -> 6, Claims stripped
//      from #2917 and #570 in the cached posts collection)
//   3. reload, and require the app to REPAIR it    (Claims back, painted in the drop body)
//
// Step 2 is what makes this a real test. Without it the browser is fresh and passes no matter
// what SEED_VERSION says — which is exactly how this defect survived a "verified live" report.
//
//   node scripts/test-returning-profile.mjs [--url https://qdrops.app]
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { builtSeedVersion } from './lib/browser.mjs'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1) }

const SEED = builtSeedVersion(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const PORT = 9381
const PROFILE = path.join(os.tmpdir(), 'qdrops-returning-profile')

fs.rmSync(PROFILE, { recursive: true, force: true })
fs.mkdirSync(PROFILE, { recursive: true })
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore', detached: true })
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* not up */ }
  await sleep(500)
}

async function run(url, expression, settleMs = 12000) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise(r => { ws.onopen = r })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  await sleep(settleMs)
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  ws.close()
  await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`)
  if (r.result?.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 400) }
  return r.result?.result?.value
}

const idb = `
  const openDb = () => new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const get = async k => { const db = await openDb(); return new Promise((res, rej) => { const r = db.transaction('collections').objectStore('collections').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }) }
  const put = async (k, v) => { const db = await openDb(); return new Promise((res, rej) => { const r = db.transaction('collections', 'readwrite').objectStore('collections').put(v, k); r.onsuccess = () => res(true); r.onerror = () => rej(r.error) }) }
`

// Reads what the reader would actually SEE: the amber Claim marks inside the drop body.
const readPainted = postNum => `(async () => {
  ${idb}
  const host = [...document.querySelectorAll('pre[class*="post-text"]')].pop()
  const marks = host ? [...host.querySelectorAll('mark')].map(m => ({
    text: m.textContent, cls: String(m.className ?? ''), title: m.getAttribute('title') ?? '',
    bg: getComputedStyle(m).backgroundColor })) : []
  const posts = await get('posts')
  const p = (posts ?? []).find(x => String(x.postNum) === '${postNum}')
  return JSON.stringify({
    seed: await get('__seed_version__'),
    storedClaims: p?.postAnalysis?.claims ?? null,
    storedEmphasis: p?.postAnalysis?.emphasis ?? null,
    claimMarks: marks.filter(m => /amber/.test(m.cls)).map(m => m.text),
    overlapMarks: marks.filter(m => /animate-overlap/.test(m.cls)).map(m => ({ t: m.text, title: m.title })),
    allMarks: marks.map(m => m.text),
  })
})()`

// Step 2: make the profile look like one that seeded BEFORE the owner rulings existed.
const makeStale = `(async () => {
  ${idb}
  const posts = await get('posts')
  if (!posts) return JSON.stringify({ error: 'no posts collection cached' })
  let stripped = 0
  for (const p of posts) {
    if (['2917', '570'].includes(String(p.postNum)) && p.postAnalysis) {
      const drop = new Set(["Pure evil.", "The 'real' racist.", 'Pure EVIL.', 'PURE EVIL.'])
      p.postAnalysis.claims = (p.postAnalysis.claims ?? []).filter(c => !drop.has(String(c).trim()))
      p.postAnalysis.claimSpans = (p.postAnalysis.claimSpans ?? []).filter(c => !drop.has(String(c).trim()))
      stripped++
    }
  }
  await put('posts', posts)
  await put('__seed_version__', 6)
  // Read back HERE, in the same evaluation. A separate page load cannot serve as the control:
  // the app repairs the profile while that page is loading, so the check would always observe
  // the repaired state and silently pass whatever SEED_VERSION did.
  const back = await get('posts')
  const p = (back ?? []).find(x => String(x.postNum) === '2917')
  return JSON.stringify({
    stripped,
    seedAfterWrite: await get('__seed_version__'),
    claimsAfterWrite: p?.postAnalysis?.claims ?? null,
  })
})()`

const parse = v => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return { error: String(v).slice(0, 300) } } }

console.log(`\nRETURNING-PROFILE TEST — ${URL_BASE}\n`)

console.log('1. first visit — let the profile seed')
const first = parse(await run(`${URL_BASE}/post/2917`, readPainted(2917)))
console.log(`   seed=${first.seed}  stored claims=${JSON.stringify(first.storedClaims)}`)
console.log(`   amber Claim marks in the drop: ${JSON.stringify(first.claimMarks)}`)

console.log('\n2. downgrade the profile to look like the pre-ruling state')
const staled = parse(await run(`${URL_BASE}/post/2917`, makeStale, 9000))
console.log(`   ${JSON.stringify(staled)}`)

// The control lives in step 2, at write time. This load is where the repair happens — the app
// sees seed 6, re-seeds from the bundle, and the downgrade is gone before anything can read it.
console.log('\n3. returning visit — the app sees seed 6 and re-seeds')
const stale = parse(await run(`${URL_BASE}/post/2917`, readPainted(2917), 3000))
console.log(`   seed=${stale.seed}  stored claims=${JSON.stringify(stale.storedClaims)}`)

console.log('\n4. and it stays repaired on the next load')
const after = parse(await run(`${URL_BASE}/post/2917`, readPainted(2917)))
console.log(`   seed=${after.seed}  stored claims=${JSON.stringify(after.storedClaims)}`)
console.log(`   amber Claim marks in the drop: ${JSON.stringify(after.claimMarks)}`)
console.log(`   'real' still certified as Emphasis in the store: ${(after.storedEmphasis ?? []).some(e => String(e).includes("'real'"))}`)

const claimText = (after.claimMarks ?? []).join('')
const checks = [
  // The control, observed at write time rather than after a reload (see makeStale).
  ['profile was genuinely downgraded first',
    staled.seedAfterWrite === 6 && !(staled.claimsAfterWrite ?? []).includes('Pure evil.')],
  // Read from source, never a literal. This pinned 7 and rotted the moment the seed moved on,
  // reporting FAILURE on a profile that had repaired itself perfectly. The deliberate-bump gate
  // belongs in cross-section invariant 8; here the only question is whether a returning visitor
  // ends up on the CURRENT build.
  [`returning profile re-seeded to ${SEED}`, after.seed === SEED],
  ['"Pure evil." restored to the store', (after.storedClaims ?? []).includes('Pure evil.')],
  ['"The \'real\' racist." restored to the store', (after.storedClaims ?? []).includes("The 'real' racist.")],
  ['"Pure evil." painted as a Claim in the drop', (after.claimMarks ?? []).includes('Pure evil.')],
  ['"The \'real\' racist." painted as a Claim', claimText.includes('The ') && claimText.includes(' racist.')],
  // THE SPAN IS STILL BOTH — IT JUST NO LONGER SAYS SO IN PAINT.
  //
  // This asserted that 'real' renders as a Claim+Emphasis overlap. The owner ruled the Emphasis
  // fill out of the drop on 2026-08-17, so there is no overlap to paint and the span reads as the
  // Claim it also is. Asserting the old paint here would have blocked the ruling from ever
  // shipping, which is not what this test is for: its question is whether a RETURNING reader
  // receives the current certified data, not which colour it wears.
  //
  // So the membership is checked where it now lives — in the seeded record. A returning profile
  // that re-seeded correctly still holds 'real' under Emphasis; one that did not, does not.
  ["'real' still certified as Emphasis in the re-seeded record",
    (after.storedEmphasis ?? []).some(e => String(e).includes("'real'"))],
]
console.log('\n  RESULT')
let failed = 0
for (const [label, ok] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label}`) }

try { process.kill(-proc.pid) } catch { try { proc.kill() } catch { /* gone */ } }
console.log(failed ? `\n  ${failed} check(s) FAILED\n` : '\n  a returning reader receives and sees the owner rulings\n')
process.exit(failed ? 1 : 0)
