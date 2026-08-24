// WWG1WGA IS A DIRECTIVE, AND THE TWO INSIDE A URL ARE NOT.
//
//   node scripts/test-wwg1wga-directive.mjs [baseUrl] [--fresh]
//
// OWNER RULING 2026-08-24: "lets make ALL the wwg1wga directives trough all the post".
//
// 171 of the 178 occurrences already were — the archive certifies Q's valedictions, and every
// sign-off-shaped WWG1WGA carries family `morale`. Five were not, each a sub-line span in a line
// the archive certifies in another section, and those five are what this gate holds down.
//
// AND THE TWO IT REFUSES, which matter more. #1601 and #3660 write WWG1WGA inside a URL. A span
// certified there puts a fill inside a link and splits the anchor — the defect the URL work fixed
// twice — so the ruling names them as refused. A gate that only checked the five would pass just
// as happily if a later pass swept the URLs in.
import { launch, DROP_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const MARKS = `(() => {
  const host = [...document.querySelectorAll('pre[class*="post-text"]')].pop()
  if (!host) return '0'
  return JSON.stringify([...host.querySelectorAll('mark')].map(m => ({
    t: (m.textContent ?? '').trim(), c: m.getAttribute('class') ?? '',
  })))
})()`
const ANCHORS = `(() => {
  const host = [...document.querySelectorAll('pre[class*="post-text"]')].pop()
  if (!host) return '0'
  return JSON.stringify([...host.querySelectorAll('a[href]')].map(a => ({
    t: (a.textContent ?? '').trim(), h: a.getAttribute('href') ?? '',
    // WHAT THIS RULING CLAIMS, and nothing wider. Counting every mark inside the anchor failed on
    // #1601, where "potus" in the reddit slug is painted cyan — a URL-derived ENTITY that predates
    // this batch and is a separate question for the owner. The assertion here is the one the
    // refusal makes: no WWG1WGA is marked inside the address.
    wwg: [...a.querySelectorAll('mark')].filter(m => /wwg1wga/i.test(m.textContent ?? '')).length,
  })))
})()`

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${String(got).slice(0, 60)}`) }
console.log(`\nWWG1WGA IS A DIRECTIVE  (${mode}${browser.reused ? ', reused' : ''})\n`)

// The five the owner ruled, and one sign-off that was already one.
for (const n of [1183, 2347, 2543, 2565, 2567, 1227]) {
  const page = await browser.page(`${BASE}/post/${n}`)
  try {
    await page.waitFor(DROP_READY, { timeout: 60000 })
    const raw = await page.waitFor(MARKS, { timeout: 25000 }).catch(() => '[]')
    const marks = raw.startsWith('[') ? JSON.parse(raw) : []
    const hit = marks.find(m => /^WWG1WGA/i.test(m.t))
    check(Boolean(hit) && /green/.test(hit.c), `#${n} WWG1WGA is green`, hit ? hit.c.slice(0, 30) : 'no mark')
  } finally { await page.close() }
}

// The two refused. Nothing may be marked inside the link, and the link must still be whole.
for (const n of [1601, 3660]) {
  const page = await browser.page(`${BASE}/post/${n}`)
  try {
    await page.waitFor(DROP_READY, { timeout: 60000 })
    const raw = await page.waitFor(ANCHORS, { timeout: 25000 }).catch(() => '[]')
    const anchors = raw.startsWith('[') ? JSON.parse(raw) : []
    const hit = anchors.find(a => /wwg1wga/i.test(a.h) || /wwg1wga/i.test(a.t))
    check(Boolean(hit), `#${n} the address is still ONE anchor`, hit ? hit.h.slice(0, 52) : 'no anchor')
    check(Boolean(hit) && hit.wwg === 0, `#${n}   and no WWG1WGA is marked inside it`, hit ? `${hit.wwg} WWG1WGA mark(s)` : '-')
  } finally { await page.close() }
}

await browser.close()
console.log(`\n  ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}\n`)
process.exit(failed === 0 ? 0 : 1)
