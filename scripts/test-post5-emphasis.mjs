// #5 listed two whole certified questions under "Emphasis". This drives the real panel.
//
// Run on the WARM (already-seeded, therefore STALE) profile deliberately: a fresh profile would
// pass whatever SEED_VERSION says, and the failure the owner keeps hitting is precisely that a
// browser holding yesterday's IndexedDB never receives the change.
//
//   node scripts/test-post5-emphasis.mjs [baseUrl] [--fresh]
import { launch, builtSeedVersion } from './lib/browser.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED = builtSeedVersion(ROOT)
const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)} ${got}`) }
console.log(`\nPOST #5 — NO QUESTION UNDER EMPHASIS  (${mode}${browser.reused ? ', reused/stale' : ''}, expecting seed ${SEED})\n`)

const page = await browser.page(`${BASE}/post/5`)
// Two steps, not one giant expression. A single async blob that returns '' on any miss polls
// forever and reports "never rendered" against a page that is fine — which is exactly what the
// first version of this test did.
await page.waitFor(`(document.body.innerText || '').length > 1000 ? 1 : 0`, { timeout: 60000 })

const state = await page.evaluate(`(async () => {
  const openDb = () => new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const get = async k => { const db = await openDb(); return new Promise((res, rej) => { const r = db.transaction('collections').objectStore('collections').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }) }
  const posts = await get('posts')
  const p = (posts ?? []).find(x => String(x.postNum) === '5')
  const body = document.body.innerText || ''
  const i = body.indexOf('Emphasis')
  return JSON.stringify({
    seed: await get('__seed_version__'),
    storedEmphasis: p ? (p.postAnalysis?.emphasis ?? null) : 'POST NOT IN STORE',
    panelTail: i > -1 ? body.slice(i, i + 140) : '',
  })
})()`)

const s = state && !state.__error ? JSON.parse(state) : null
if (!s) { check(false, 'the drop rendered', state?.__error ?? 'no response') } else {
  console.log(`   seed in this profile: ${s.seed}   stored emphasis: ${JSON.stringify(s.storedEmphasis)}`)
  check(s.seed === SEED, `the stale profile re-seeded to ${SEED}`, s.seed)
  check(Array.isArray(s.storedEmphasis) && s.storedEmphasis.length === 0, '#5 carries no Emphasis in the store', JSON.stringify(s.storedEmphasis))
  const stillListed = /Why did Soros/i.test(s.panelTail)
  check(!stillListed, 'no question listed under Emphasis in the panel', stillListed ? JSON.stringify(s.panelTail.slice(0, 70)) : 'clean')
}

await page.close()
await browser.close()
console.log(failed ? `\n  ${failed} check(s) FAILED\n` : '\n  #5 is clean, on a profile that had the old data\n')
process.exit(failed ? 1 : 0)
