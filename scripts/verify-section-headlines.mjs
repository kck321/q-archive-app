// Every Post Analysis section headline, read off the live page and compared to the contract.
//
// The headline used to be summed from the phrase-frequency index, which groups by phrase — so a
// phrase Q repeats inside one post collapsed to that post once and Claims read "4,175 mentions"
// against a certified 4,188. Thirteen real occurrences, missing from a user-facing number.
//
// The invariant in audit-cross-section.mjs asserts the SOURCE is certified. This asserts what a
// reader actually sees, which is not the same claim.
//
//   node scripts/verify-section-headlines.mjs [--url https://qdrops.app]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1) }

const sleep = ms => new Promise(r => setTimeout(r, ms))
const PORT = 9411
const PROFILE = path.join(os.tmpdir(), 'qdrops-headlines')
fs.rmSync(PROFILE, { recursive: true, force: true })
fs.mkdirSync(PROFILE, { recursive: true })
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore', detached: true })
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* not up */ }
  await sleep(500)
}

async function run(url, expression, settle = 15000) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise(r => { ws.onopen = r })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  await sleep(settle)
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  ws.close()
  await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`)
  try { return JSON.parse(r.result?.result?.value) } catch { return { error: String(r.result?.result?.value).slice(0, 200) } }
}

// The contract, stated here so the test cannot be satisfied by whatever the page happens to say.
const EXPECT = [
  ['claims', 4188, 1953, 'occurrences'],
  ['predictions', 630, 520, 'occurrences'],
  ['emphasis', 5251, 1737, 'occurrences'],
  ['namedEntities', 7903, 2221, 'mentions'],
  ['themes', 2395, 1767, 'assignments'],
  ['impliedConclusions', 966, 596, 'conclusions'],
  ['verificationHooks', 1926, 1028, 'checkable claims'],
]

const probe = `(() => {
  const main = document.querySelector('main') || document.body
  const head = (main.innerText || '').split(String.fromCharCode(10)).filter(Boolean).slice(0, 10)
  return JSON.stringify({ head })
})()`

console.log(`\nSECTION HEADLINES — ${URL_BASE}\n`)
let failed = 0
for (const [tab, occ, posts, unit] of EXPECT) {
  const r = await run(`${URL_BASE}/analysis?tab=${tab}`, probe)
  const line = (r.head ?? []).join(' | ')
  // The header renders as "<n><unit>" and "within<n>posts", so compare on digits and wording
  // rather than on exact spacing.
  const okOcc = line.includes(occ.toLocaleString())
  const okPosts = line.includes(posts.toLocaleString())
  const okUnit = line.toLowerCase().includes(unit.toLowerCase())
  const ok = okOcc && okPosts && okUnit
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${tab.padEnd(19)} expect ${occ.toLocaleString()} ${unit} / ${posts.toLocaleString()} posts`)
  console.log(`        page: ${line.slice(0, 150)}`)
  if (!ok) console.log(`        occ=${okOcc} posts=${okPosts} unit=${okUnit}`)
}

try { process.kill(-proc.pid) } catch { try { proc.kill() } catch { /* gone */ } }
console.log(failed ? `\n  ${failed} of ${EXPECT.length} headlines wrong\n` : `\n  all ${EXPECT.length} headlines match the certified contract\n`)
process.exit(failed ? 1 : 0)
