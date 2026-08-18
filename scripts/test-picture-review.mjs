// Quick proof: two red dots + review note on /post/101's picture chip, and the
// pic-matched card tag on a /posts search.
import { launch } from './lib/browser.mjs'
const b = await launch()
const fail = m => { console.error('FAIL: ' + m); process.exitCode = 1 }

{
  const p = await b.page('http://localhost:5173/post/101')
  const chip = await p.waitFor(`[...document.querySelectorAll('button')].some(x => x.textContent.includes('📷 Picture'))`, { timeout: 45000 })
  if (!chip) fail('no Picture chip on /post/101')
  const dots = await p.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find(x => x.textContent.includes('📷 Picture'))
    return btn ? btn.querySelectorAll('.bg-red-500').length : -1
  })()`)
  if (dots !== 2) fail(`expected 2 red dots on #101 chip, got ${dots}`)
  else console.log('ok: #101 chip shows TWO red dots (review queue)')
  await p.evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('📷 Picture'))?.click()`)
  const note = await p.waitFor(`document.body.innerText.includes('needs manual review')`)
  console.log(note ? 'ok: expanded panel shows the review note' : (fail('no review note in panel'), ''))
  await p.close()
}

{
  const p = await b.page('http://localhost:5173/posts?q=vatican')
  const tag = await p.waitFor(`document.body.innerText.includes("matched inside this post's picture")`, { timeout: 60000 })
  console.log(tag ? 'ok: pic-matched card carries the 📷 Pic tag in results' : (fail('no card tag'), ''))
  await p.close()
}
console.log(process.exitCode ? 'REVIEW-DOTS PROOF: FAILED' : 'REVIEW-DOTS PROOF: GREEN')
