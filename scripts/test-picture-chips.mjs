// Browser proof for the Picture chip feature (picture-analysis.json + PictureChip).
//
// Asserts, on the running editorial dev server:
//  1. /post/1001 (187_Site_E.jpg, Q-attached) renders a "📷 Picture" chip; clicking it opens
//     the panel with the analysis (kind, description, "Epstein" search-term link).
//  2. /posts searching "Wojcicki" — a term that appears ONLY inside a picture, never in any
//     drop's text — returns results with the "Pic #" chips and the picture bucket.
//  3. /pics search "Ghislaine" surfaces the #1054 GM.JPG tile via picture content.
import { launch } from './lib/browser.mjs'

const BASE = process.env.QDROPS_BASE ?? 'http://localhost:5173'
const fail = msg => { console.error(`FAIL: ${msg}`); process.exitCode = 1 }
const ok = msg => console.log(`ok: ${msg}`)

const b = await launch()
console.log(`browser on :${b.port} (${b.reused ? 'warm' : 'cold'}) against ${BASE}`)

// ── 1. Picture chip on the post page ────────────────────────────────────────────
{
  const p = await b.page(`${BASE}/post/1001`)
  const chip = await p.waitFor(`[...document.querySelectorAll('button')].some(x => x.textContent.includes('📷 Picture'))`)
  if (!chip) fail('no 📷 Picture chip on /post/1001')
  else ok('📷 Picture chip renders on /post/1001')

  await p.evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('📷 Picture'))?.click()`)
  const panel = await p.waitFor(`document.body.innerText.includes('Little St. James')`)
  if (!panel) fail('expanded panel does not show the description')
  else ok('chip expands to the analysis panel (description visible)')

  const epstein = await p.evaluate(`[...document.querySelectorAll('a')].some(a => a.getAttribute('href')?.includes('/posts?q=Epstein'))`)
  if (!epstein) fail('no search-term link to /posts?q=Epstein in the panel')
  else ok('search-term links point into the Post Archive')
  await p.close()
}

// ── 2. Archive search hits picture-only content and shows Pic chips ─────────────
{
  const p = await b.page(`${BASE}/posts?q=Wojcicki`)
  const picChip = await p.waitFor(`[...document.querySelectorAll('a')].filter(a => /^Pic #\\d+/.test(a.textContent.trim())).length`, { timeout: 60000 })
  if (!picChip) fail('search "Wojcicki" produced no Pic # chips')
  else ok(`search "Wojcicki" shows ${picChip} Pic # chip(s)`)

  const summary = await p.evaluate(`document.body.innerText.includes('matched inside a picture')`)
  if (!summary) fail('summary line missing "matched inside a picture"')
  else ok('summary line reports the picture matches')

  // Oldest → newest: the chip numbers must be ascending.
  const nums = await p.evaluate(`[...document.querySelectorAll('a')].filter(a => /^Pic #\\d+/.test(a.textContent.trim())).map(a => Number(a.textContent.match(/\\d+/)[0]))`)
  const sorted = Array.isArray(nums) && nums.every((n, i) => i === 0 || nums[i - 1] <= n)
  if (!sorted) fail(`Pic chips not oldest→newest: ${JSON.stringify(nums)}`)
  else ok(`Pic chips ordered oldest→newest: ${JSON.stringify(nums)}`)
  await p.close()
}

// ── 3. Q Post Pics search matches picture content ───────────────────────────────
{
  const p = await b.page(`${BASE}/pics`)
  await p.waitFor(`document.querySelector('input[placeholder*="Search"]') !== null`)
  await p.evaluate(`(() => {
    const el = document.querySelector('input[placeholder*="Search"]')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(el, 'Ghislaine')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  const tile = await p.waitFor(`document.body.innerText.includes('GM.JPG') ? 'yes' : null`, { timeout: 30000 })
  if (!tile) fail('qpics search "Ghislaine" did not surface GM.JPG')
  else ok('qpics search matches picture content (GM.JPG via "Ghislaine")')
  await p.close()
}

console.log(process.exitCode ? 'PICTURE CHIP PROOF: FAILED' : 'PICTURE CHIP PROOF: GREEN')
