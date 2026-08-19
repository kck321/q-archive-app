// Proof: the Resolution Center lists pictures flagged needsReview (two-red-dot chips).
import { launch } from './lib/browser.mjs'
const b = await launch()
const fail = m => { console.error('FAIL: ' + m); process.exitCode = 1 }

const p = await b.page('http://localhost:5173/resolve')
const section = await p.waitFor(`document.body.innerText.includes('Pictures needing review')`, { timeout: 60000 })
if (!section) fail('no "Pictures needing review" section on /resolve')
else console.log('ok: Pictures needing review section renders')

const rows = await p.evaluate(`document.body.innerText.match(/LATEST Q VERIFIED|Q Graphic|1510280445405/g)?.length ?? 0`)
if (rows < 3) fail(`expected the 3 flagged compilations listed, saw ${rows}`)
else console.log(`ok: all 3 flagged pictures listed (${rows} filename hits)`)

const link = await p.evaluate(`[...document.querySelectorAll('a')].some(a => a.getAttribute('href')?.startsWith('/post/101'))`)
console.log(link ? 'ok: rows deep-link to their posts' : (fail('no /post/101 link in section'), ''))
await p.close()
console.log(process.exitCode ? 'PICTURE RESOLUTION PROOF: FAILED' : 'PICTURE RESOLUTION PROOF: GREEN')
