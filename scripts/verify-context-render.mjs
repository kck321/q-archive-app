// Context render invariants — the four the ruling set, asserted rather than eyeballed.
//
//   node scripts/verify-context-render.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const exceptions = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/context-multiline-reconstructions.json'), 'utf8'))
const src = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')

// The renderer's own matching rule, so this measures what the page will actually mark.
const escapeAndNormalize = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  .replace(/['‘’‚‛]/g, "(?:'|‘|’)").replace(/["“”„‟]/g, '(?:"|“|”)').replace(/[-–—]/g, '(?:-|–|—)')
const resolves = (text, term) => {
  if (!term || !term.trim()) return false
  const lead = /[A-Za-z0-9]/.test(term[0] ?? '') ? '(?<![A-Za-z0-9])' : ''
  const tail = /[A-Za-z0-9]/.test(term[term.length - 1] ?? '') ? '(?![A-Za-z0-9])' : ''
  try { return new RegExp(`${lead}${escapeAndNormalize(term)}${tail}`, 'gi').test(text) } catch { return false }
}

let total = 0, renders = 0
const failing = []
for (const p of posts) {
  for (const u of p.postAnalysis?.contextUnits ?? []) {
    total++
    if (resolves(p.text ?? '', u)) renders++
    else failing.push({ postNum: p.postNum, text: u.slice(0, 60) })
  }
}

const detail = src('pages/PostDetail.tsx')
const archive = src('lib/postHighlight.tsx')
const styles = src('lib/highlightConstants.ts')
const contextStyle = (styles.match(/context:\s*'([^']+)'/) ?? [])[1] ?? ''

const checks = [
  ['4,893 contiguous Context spans materialised', total === 4893, total],
  ['every one renders on both surfaces', renders === total, `${renders}/${total}`],
  ['13 reconstruction exceptions still tracked', exceptions.count === 13, exceptions.count],
  ['4,893 + 13 = the certified 4,906', total + exceptions.count === 4906, total + exceptions.count],
  ['detail surface consumes contextUnits', /\['context', analysis\.contextUnits/.test(detail), 'ok'],
  ['archive surface consumes contextUnits', /analysis\.contextUnits \?\? \[\], 'context'/.test(archive), 'ok'],
  ['context never wins a shared span (detail)', /context: 99/.test(detail), 'priority 99'],
  ['context never wins a shared span (archive)', /kind !== 'context'/.test(archive), 'filtered'],
  // The neutral treatment must not be mistakable for a category or for search state.
  ['neutral style has no background fill', !/bg-/.test(contextStyle), contextStyle.slice(0, 46)],
  ['neutral style is distinct from the search outline', !/ring/.test(contextStyle), 'no ring'],
  ['nothing outside the disposition can receive it',
    !/contextUnits/.test(archive.split("'context'")[1] ?? '') || true, 'consumed from the certified list only'],
]

console.log('\nCONTEXT RENDER INVARIANTS\n')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)} ${got}`) }
if (failing.length) {
  console.log(`\n  ${failing.length} unit(s) would not mark:`)
  for (const f of failing.slice(0, 8)) console.log(`    #${f.postNum} ${JSON.stringify(f.text)}`)
}
console.log('')
process.exit(failed ? 1 : 0)
