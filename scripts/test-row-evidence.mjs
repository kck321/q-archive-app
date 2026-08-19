// Browser proof: Pic and URL chips beside an analysis row's certified chips.
//
// The property under test is a SEPARATION, not merely a rendering. Picture-only and URL-only
// matches must appear as their own labelled evidence and must NOT move the figures a row is
// adjudicated with. `#1254` = Q named the subject in that drop. `Pic #1254` = a picture there
// shows them. Merging the two would turn a photograph into a statement Q never made, which is
// the same line invariant 9 draws around quoted-post text.
//
// Reads are deliberately PRIMITIVE (numbers and strings). Returning a JSON blob through the
// harness sometimes arrives parsed and sometimes as text, and guessing which cost an afternoon.
import { launch } from './lib/browser.mjs'

const BASE = process.env.QDROPS_BASE ?? 'http://localhost:5173'
const D = { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false, touch: false }
const fail = m => { console.error(`FAIL: ${m}`); process.exitCode = 1 }
const ok = m => console.log(`ok: ${m}`)
const b = await launch()
console.log(`browser on :${b.port} (${b.reused ? 'warm' : 'cold'}) against ${BASE}`)

// Scope every read to ONE row card. A search returns several rows, and collecting chips across
// all of them makes the post numbers restart mid-list, which reads as 'out of order' and as
// duplicates when it is neither.
const CARD = `(() => { const a = [...document.querySelectorAll('a')].find(x => /(Pic|URL) #/.test(x.textContent || '')); return a ? a.closest('.bg-q-panel') : document.body })()`
const CHIPS = kind => `[...${CARD}.querySelectorAll('a')].filter(a => /${kind} #/.test(a.textContent || ''))`
const NUMS = kind => `${CHIPS(kind)}.map(a => parseInt(String(a.textContent).split('#')[1], 10))`

async function open(url) {
  const p = await b.page(url, D)
  await p.waitFor(`document.querySelectorAll('.bg-q-panel').length > 0`, { timeout: 60000 })
  // The index is built from picture-analysis.json plus every link in the archive, so it lands
  // seconds after the row itself. Poll for the chips instead of trusting a fixed delay.
  for (let i = 0; i < 40; i++) {
    const n = Number(await p.evaluate(`${CHIPS('(Pic|URL)')}.length`))
    if (n > 0) break
    await new Promise(s => setTimeout(s, 500))
  }
  await new Promise(s => setTimeout(s, 600))
  return p
}

const asc = a => a.every((v, i, arr) => i === 0 || arr[i - 1] <= v)

// ── Named Entities: POTUS ──────────────────────────────────────────────────────
{
  const p = await open(`${BASE}/analysis?tab=namedEntities&q=POTUS`)
  const pics = Number(await p.evaluate(`${CHIPS('Pic')}.length`))
  const urls = Number(await p.evaluate(`${CHIPS('URL')}.length`))
  const picNums = String(await p.evaluate(`${NUMS('Pic')}.join(',')`)).split(',').filter(Boolean).map(Number)
  const urlNums = String(await p.evaluate(`${NUMS('URL')}.join(',')`)).split(',').filter(Boolean).map(Number)
  const picTip = String(await p.evaluate(`${CHIPS('Pic')}[0]?.getAttribute('title') || ''`))
  const urlTip = String(await p.evaluate(`${CHIPS('URL')}[0]?.getAttribute('title') || ''`))
  const picHref = String(await p.evaluate(`${CHIPS('Pic')}[0]?.getAttribute('href') || ''`))
  const urlHref = String(await p.evaluate(`${CHIPS('URL')}[0]?.getAttribute('href') || ''`))
  const inRow = Number(await p.evaluate(`${CHIPS('Pic')}[0]?.closest('.bg-q-panel') ? 1 : 0`))
  const mentions = String(await p.evaluate(`(() => { const t = document.body.innerText; const i = t.indexOf(' mentions'); if (i < 0) return ''; return t.slice(Math.max(0, i - 12), i).split(/[^0-9,]/).filter(Boolean).pop() || '' })()`))
  const postsBadge = String(await p.evaluate(`(document.body.innerText.match(/\u00d7([\d,]+) posts/)||[])[1] || ''`))

  console.log(`   POTUS: ${mentions} mentions / ×${postsBadge} posts · ${pics} Pic · ${urls} URL chips`)
  pics > 0 ? ok(`Pic chips render (first Pic #${picNums[0]})`) : fail('no Pic chips on the POTUS row')
  urls > 0 ? ok(`URL chips render (first URL #${urlNums[0]})`) : fail('no URL chips on the POTUS row')
  inRow ? ok('chips sit inside the row card, with the certified chips') : fail('chips are not inside the row card')
  asc(picNums) ? ok('Pic chips sorted oldest → newest') : fail('Pic chips out of post order')
  asc(urlNums) ? ok('URL chips sorted oldest → newest') : fail('URL chips out of post order')
  const dupes = (picNums.length - new Set(picNums).size) + (urlNums.length - new Set(urlNums).size)
  dupes === 0 ? ok('one chip per post per evidence type — aliases rolled up') : fail(`${dupes} duplicate chips`)
  ;/picture analysis|certified/i.test(picTip) ? ok(`Pic tooltip names the route: "${picTip}"`) : fail(`Pic tooltip missing: "${picTip}"`)
  ;/URL text|certified/i.test(urlTip) ? ok(`URL tooltip names the route: "${urlTip}"`) : fail(`URL tooltip missing: "${urlTip}"`)
  ;/^\/post\/\d+\?.*focus=pic/.test(picHref) ? ok('Pic chip opens the Q post and focuses the picture') : fail(`Pic href wrong: ${picHref}`)
  ;/^\/post\/\d+\?.*focus=url/.test(urlHref) ? ok('URL chip opens the Q post, never the external site') : fail(`URL href wrong: ${urlHref}`)
  // Certified totals are rendered from the adjudicated artifact; evidence chips must not appear in them.
  const certifiedHasPic = Number(await p.evaluate(
    `(() => { const c = ${CHIPS('Pic')}[0]?.closest('.bg-q-panel'); if (!c) return 0
       const certified = [...c.querySelectorAll('a')].filter(a => String(a.textContent).trim().startsWith('#'))
       return certified.filter(a => String(a.textContent).includes('Pic ') || String(a.textContent).includes('URL ')).length })()`))
  // Both routes must actually be present, not just the weaker one. Expand the groups first —
  // a direct match can easily sit past the 24-chip cap.
  await p.evaluate(`${CARD}.querySelectorAll('button')?.forEach(btn => { if (String(btn.textContent).includes('more')) btn.click() })`)
  await new Promise(s => setTimeout(s, 700))
  const directPic = Number(await p.evaluate(`${CHIPS('Pic')}.filter(a => String(a.getAttribute('title')).startsWith('Matched picture analysis')).length`))
  const directUrl = Number(await p.evaluate(`${CHIPS('URL')}.filter(a => String(a.getAttribute('title')).startsWith('Matched URL text')).length`))
  const totalPic = Number(await p.evaluate(`${CHIPS('Pic')}.length`))
  const totalUrl = Number(await p.evaluate(`${CHIPS('URL')}.length`))
  console.log(`   routes: ${directPic}/${totalPic} Pic and ${directUrl}/${totalUrl} URL chips matched the ALIAS directly; the rest are assets inside certified drops`)
  directPic > 0 ? ok('at least one picture matched a POTUS alias through its own analysis') : fail('no direct picture match — only associated ones')
  directUrl > 0 ? ok('at least one URL matched a POTUS alias through its own text') : fail('no direct URL match — only associated ones')

  certifiedHasPic === 0 ? ok('certified chip sequence contains no evidence chips') : fail('evidence chips leaked into the certified sequence')
  await p.close()
}

// ── An alias reaches the same row without duplicating its evidence ─────────────
{
  const p = await open(`${BASE}/analysis?tab=namedEntities&q=DJT`)
  const picNums = String(await p.evaluate(`${NUMS('Pic')}.join(',')`)).split(',').filter(Boolean).map(Number)
  const d = picNums.length - new Set(picNums).size
  d === 0 ? ok(`alias search (DJT) resolves to the same family without duplicates (${picNums.length} Pic chips)`)
          : fail(`alias search duplicated ${d} chips`)
  await p.close()
}

// ── Every surface the owner ruled IN uses the same helper ─────────────────────
for (const [label, url] of [
  ['Q [ Brackets ]', `${BASE}/brackets`],
  ['Claims',         `${BASE}/analysis?tab=claims&q=Trump`],
  ['Predictions',    `${BASE}/analysis?tab=predictions&q=will`],
  ['Themes',         `${BASE}/analysis?tab=themes&q=control`],
  ['Directives',     `${BASE}/requests`],
  ['Questions',      `${BASE}/questions`],
]) {
  const p = await open(url)
  const n = Number(await p.evaluate(`${CHIPS('(Pic|URL)')}.length`))
  n > 0 ? ok(`${label} rows carry the same evidence chips (${n})`) : fail(`no evidence chips on ${label}`)
  await p.close()
}

// ── Emphasis is excluded by owner ruling ──────────────────────────────────────
{
  const p = await b.page(`${BASE}/analysis?tab=emphasis`, D)
  await p.waitFor(`document.querySelectorAll('.bg-q-panel').length > 0`, { timeout: 60000 })
  await new Promise(s => setTimeout(s, 6000))
  const n = Number(await p.evaluate(`${CHIPS('(Pic|URL)')}.length`))
  n === 0 ? ok('Emphasis carries no evidence chips, as ruled') : fail(`Emphasis shows ${n} evidence chips`)
  await p.close()
}

console.log(process.exitCode ? '\nROW EVIDENCE PROOF: FAILED' : '\nROW EVIDENCE PROOF: GREEN')

// Exit explicitly. The harness keeps a socket open per browser, so a gate that only
// sets process.exitCode can print its verdict and then sit there — which hung validate.mjs
// for 1,155s on a run whose own output said GREEN.
process.exit(process.exitCode ? 1 : 0)
