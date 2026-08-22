// Diagnostic: what does the Themes tab actually render for q=control? Reports only.
import { launch, ROWS_READY } from './lib/browser.mjs'
const BASE = process.env.QDROPS_BASE ?? 'http://localhost:5173'
const D = { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false, touch: false }
const b = await launch()
const p = await b.page(`${BASE}/analysis?tab=themes&q=control`, D)
await p.waitFor(ROWS_READY, { timeout: 120000 }).catch(() => false)
await new Promise(s => setTimeout(s, 4000))
console.log('rows on page      :', await p.evaluate(`document.querySelectorAll('.bg-q-panel').length`))
console.log('any Pic/URL anchor:', await p.evaluate(`[...document.querySelectorAll('a')].filter(a => /(Pic|URL) #/.test(a.textContent||'')).length`))
console.log('plain # anchors   :', await p.evaluate(`[...document.querySelectorAll('a')].filter(a => /#\\d/.test(a.textContent||'')).length`))
console.log('first row text    :', String(await p.evaluate(`(document.querySelector('.bg-q-panel')||{}).textContent || '(none)'`)).slice(0, 300))
console.log('header            :', String(await p.evaluate(`(document.querySelector('h1,h2')||{}).textContent || ''`)).slice(0, 160))
await p.close()
process.exit(0)
