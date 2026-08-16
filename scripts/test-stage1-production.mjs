// Stage 1 as the reader sees it: no duplicate rows, absorbed spellings still find their entity,
// and withdrawn wordings are gone from the highlighting but still in the drop.
//
//   node scripts/test-stage1-production.mjs [baseUrl] [--fresh]
//
// WHY THESE THREE. Each is a way Stage 1 could have succeeded in the data and failed on screen:
//   - a merge that leaves both rows rendering is the defect it was meant to fix, still visible
//   - an absorbed spelling that no longer finds anything turns a cleanup into a loss of access,
//     which is the one outcome a merge must never produce
//   - a withdrawn wording that vanishes from the POST rather than from the classification would
//     mean the archive quietly edited Q
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, ROWS_READY } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const stage1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'entities-stage1-rulings.json'), 'utf8'))
const history = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'entities-moved-out-history.json'), 'utf8'))

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(54)} ${got}`) }
console.log(`\nSTAGE 1 IN PRODUCTION  (${mode}${browser.reused ? ', reused' : ''})  ${BASE}\n`)
const started = Date.now()

// ── 1. the bundle the reader actually receives ──────────────────────────────
const page = await browser.page(`${BASE}/analysis?tab=entities`)
await page.waitFor(ROWS_READY, { timeout: 60000 })
const data = await page.evaluate(`(async () => {
  const r = await fetch('/data/entities.json', { cache: 'no-store' })
  const j = await r.json()
  const canon = j.entities.map(e => e.canonical)
  return JSON.stringify({
    rows: j.entities.length,
    mentions: j.totals.mentions,
    dupes: canon.length - new Set(canon).size,
    withIds: j.entities.filter(e => e.id).length,
  })
})()`)
const d = JSON.parse(data)
check(d.rows === 1409, 'the reader receives 1,409 entity rows', d.rows)
check(d.mentions === 9749, 'headline is 9,749 mentions', d.mentions)
check(d.dupes === 0, 'no entity is listed twice', `${d.dupes} duplicate canonicals`)
check(d.withIds === d.rows, 'every row carries a permanent id', `${d.withIds}/${d.rows}`)

// ── 2. absorbed spellings still reach their entity ──────────────────────────
// A merge must not cost a way of finding something. "Wikileaks" is how some drops spell it.
const spellings = []
for (const m of stage1.merges) for (const a of m.absorb) if (a.canonical !== m.canonical) spellings.push([a.canonical, m.canonical])
console.log(`\n  ABSORBED SPELLINGS (${spellings.length})`)
for (const [was, now] of spellings.slice(0, 6)) {
  const found = await page.evaluate(`(async () => {
    const j = await (await fetch('/data/entities.json', { cache: 'no-store' })).json()
    const hit = j.entities.find(e => e.canonical === ${JSON.stringify(now)})
    if (!hit) return 'NO SURVIVING ROW'
    const spelled = hit.aliases.some(a => a.text === ${JSON.stringify(was)})
    return spelled ? 'alias kept' : 'SPELLING LOST'
  })()`)
  check(found === 'alias kept', `"${was}" still reaches ${now}`, found)
}

// ── 3. withdrawn wordings: out of the classification, still in the drop ─────
console.log('\n  WITHDRAWN WORDINGS')
const sample = history.moveOuts.slice(0, 4)
for (const mo of sample) {
  const o = mo.occurrences[0]
  const p = await browser.page(`${BASE}/post/${o.postId ?? o.postNum}`)
  // Wait for THIS DROP, not for "a page". The site chrome alone is 549 characters, so a
  // length-based wait passes on the header and reports the drop's own words missing — which is
  // how a passing test came back saying the archive had deleted three of Q's posts.
  const ready = await p.waitFor(`document.body.innerText.includes('#${o.postNum}') && document.body.innerText.length > 800`, { timeout: 60000 })
  if (!ready) { check(false, `#${o.postNum} post page rendered`, 'TIMED OUT'); await p.close(); continue }
  const res = await p.evaluate(`(() => {
    const body = document.body.innerText
    const word = ${JSON.stringify(o.matchedAlias)}
    const inText = body.toLowerCase().includes(word.toLowerCase())
    // An entity highlight carries the entity styling; a plain word does not.
    const marks = [...document.querySelectorAll('[title*="ENTITY"], [data-entity], mark, .entity')]
      .map(m => m.textContent.trim().toLowerCase())
    return JSON.stringify({ inText, highlighted: marks.includes(word.toLowerCase()) })
  })()`)
  const r = JSON.parse(res ?? '{}')
  check(r.inText === true, `#${o.postNum} still contains "${o.matchedAlias}"`, r.inText ? 'present in the drop' : 'MISSING FROM THE DROP')
  check(r.highlighted === false, `#${o.postNum} no longer highlights it as an entity`, r.highlighted ? 'STILL HIGHLIGHTED' : 'not highlighted')
  await p.close()
}

// ── 4. a merged entity reads as one row with the combined count ─────────────
console.log('\n  MERGE RESULT ON SCREEN')
const wl = stage1.merges.find(m => m.canonical === 'WikiLeaks')
if (wl) {
  const got = await page.evaluate(`(async () => {
    const j = await (await fetch('/data/entities.json', { cache: 'no-store' })).json()
    const rows = j.entities.filter(e => e.canonical === 'WikiLeaks')
    return JSON.stringify({ n: rows.length, mentions: rows[0]?.mentions, aliases: rows[0]?.aliases.map(a => a.text) })
  })()`)
  const g = JSON.parse(got)
  check(g.n === 1, 'WikiLeaks ships as ONE row', `${g.n} row(s)`)
  check(g.mentions === wl.expectedMentions, `its mentions are the combined ${wl.expectedMentions}`, g.mentions)
  check(g.aliases.includes('Wikileaks'), 'the absorbed spelling survives as an alias', g.aliases.slice(0, 5).join(', '))
}

// ── 5. mobile ───────────────────────────────────────────────────────────────
console.log('\n  MOBILE')
const m = await browser.page(`${BASE}/analysis?tab=entities`)
await m.evaluate(`(() => { window.resizeTo(390, 844); return true })()`)
await m.waitFor(ROWS_READY, { timeout: 60000 })
const overflow = await m.evaluate(`(() => {
  const de = document.documentElement
  return JSON.stringify({ scrollW: de.scrollWidth, clientW: de.clientWidth })
})()`)
const ov = JSON.parse(overflow)
check(ov.scrollW <= ov.clientW + 2, 'the entities page does not scroll sideways', `${ov.scrollW} vs ${ov.clientW}`)
await m.close()

await page.close()
await browser.close()
console.log(`\n  ${failed ? `❌ ${failed} failed` : '✅ Stage 1 is correct as the reader sees it'} — ${((Date.now() - started) / 1000).toFixed(1)}s\n`)
process.exit(failed ? 1 : 0)
