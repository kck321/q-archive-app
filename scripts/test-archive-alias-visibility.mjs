// Prove the POST ARCHIVE search shows the aliases tied to the searched term — rendered page.
//
// The Analysis archive already unioned both alias registries (test-alias-visibility.mjs covers
// it). The Post Archive did not: its match set, mention counts, "Includes:" chips and per-alias
// post colours all read the owner-editable map only, so /posts?q=covid-19 found 38 posts and
// listed no aliases while /posts?q=potus listed six. Same OWNER RULE, different surface — so it
// gets its own proof, driven through the real page.
//
//   node scripts/test-archive-alias-visibility.mjs [baseUrl]     default http://localhost:5174
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const BASE = process.argv[2] ?? 'http://localhost:5174'
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1) }

const sleep = ms => new Promise(r => setTimeout(r, ms))
const PORT = 9384
const PROFILE = path.join(os.tmpdir(), `qdrops-archive-alias-${process.pid}`)
fs.mkdirSync(PROFILE, { recursive: true })
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore', detached: true })
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* not up */ }
  await sleep(500)
}

async function run(url, expression, settleMs = 16000) {
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
  if (r.result?.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }
  return r.result?.result?.value
}

// The "Found N posts matching …" banner and the "Includes: …" chip row, as rendered.
const readArchive = `(() => {
  const text = document.body.innerText ?? ''
  const found = (text.match(/Found\\s+([\\d,]+)\\s+posts matching/) ?? [])[1] ?? null
  const line = (text.split('\\n').map(s => s.trim()).find(l => /^Includes:/i.test(l))) ?? ''
  // The chips live one row below the "Includes:" label in the DOM, so read the whole block too.
  const block = [...document.querySelectorAll('div')]
    .map(d => (d.innerText ?? '').trim())
    .filter(t => /^Includes:/i.test(t))
    .sort((a, b) => a.length - b.length)[0] ?? line
  return JSON.stringify({ found, includes: block.replace(/\\s+/g, ' ').slice(0, 300) })
})()`

let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${got}`) }

console.log('\nPOST ARCHIVE ALIAS VISIBILITY — RENDERED PAGE\n')

for (const [term, expectAliases] of [
  ['covid-19', ['C19', 'COVID']],
  ['potus', ['Q+', 'trump']],
  // The owner ruling of 2026-08-14: one person, three spellings. Ray Chandler was a certified
  // entity of her own and RC was 13 unanswered rows in the Resolution Center.
  ['Rachel Chandler', ['Ray Chandler', 'RC']],
]) {
  const raw = await run(`${BASE}/posts?q=${encodeURIComponent(term)}`, readArchive)
  if (!raw || raw.error) { check(false, `${term} — page rendered`, raw?.error ?? 'no response'); continue }
  const data = JSON.parse(raw)
  console.log(`\n  search "${term}" — found ${data.found ?? '?'} posts`)
  console.log(`    includes: ${data.includes || 'NO INCLUDES ROW'}`)
  check(Boolean(data.found), `${term} — the search returns posts`, `${data.found} posts`)
  check(Boolean(data.includes), `${term} — the archive shows an Includes row`, data.includes ? 'shown' : 'NO INCLUDES ROW')
  for (const a of expectAliases) {
    const hit = new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(data.includes)
    check(hit, `${term} — alias "${a}" is on the Includes row`, hit ? 'shown' : 'MISSING')
  }
}

try { process.kill(-proc.pid) } catch { try { proc.kill() } catch { /* already gone */ } }
await sleep(500)
try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch { /* Chrome still holds it */ }
console.log(failed ? `\n  ${failed} check(s) FAILED\n` : '\n  the post archive shows the aliases tied to the searched term\n')
process.exit(failed ? 1 : 0)
