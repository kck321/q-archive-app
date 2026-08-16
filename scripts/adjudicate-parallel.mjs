// Stratified adjudication of the parallel-phrasing detector.
//
// v1 fired whenever two consecutive lines opened with the same word, which is far too weak:
// "What happened yesterday? / What is the weather?" share an opener without sharing a rhetorical
// pattern. This script samples the 2,187 hits and classifies each one so the revised detector is
// built from read evidence rather than from a guess about what the detector is doing.
//
//   node scripts/adjudicate-parallel.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { classifyParallel, pWords as words, pNorm as norm } from './lib/emphasis.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))


// Rebuild the runs rather than the pairs. A run is the unit a reader actually perceives:
// three lines opening "What…" is a cascade; two lines that happen to collide is not.
const runs = []
for (const p of posts) {
  const cleaned = clean(p.text ?? '')
  const src = sourceLines(cleaned)
  const lines = cleaned.split('\n')
  const qLines = lines.map((l, i) => ({ l: l.trim(), i })).filter(x => x.l && !src.has(x.i))

  let cur = []
  const flush = () => {
    if (cur.length >= 2) runs.push({ postNum: p.postNum, lines: cur.map(x => x.l) })
    cur = []
  }
  for (let i = 0; i < qLines.length; i++) {
    const a = qLines[i]
    const prev = cur.length ? cur[cur.length - 1] : null
    const contiguous = prev ? a.i === prev.i + 1 : true
    if (prev && contiguous && norm(words(a.l)[0] ?? '') === norm(words(prev.l)[0] ?? '') && a.l !== prev.l) {
      cur.push(a)
    } else {
      flush()
      cur = [a]
    }
  }
  flush()
}


const classify = r => classifyParallel(r.lines)

const byClass = {}
for (const r of runs) {
  const c = classify(r)
  ;(byClass[c] ??= []).push(r)
}

const pairs = runs.filter(r => r.lines.length === 2).length
console.log(`\nruns: ${runs.length}  (2-line: ${pairs}, 3+: ${runs.length - pairs})`)
console.log(`v1 pair-emissions equivalent: ${runs.reduce((n, r) => n + r.lines.length - 1, 0)}\n`)
for (const [c, list] of Object.entries(byClass).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(list.length).padStart(5)}  ${c}`)
}

console.log('\n──────── stratified samples ────────')
for (const [c, list] of Object.entries(byClass)) {
  console.log(`\n■ ${c} (${list.length})`)
  const n = Math.min(8, list.length)
  for (let i = 0; i < n; i++) {
    const r = list[Math.floor(i * list.length / n)]
    console.log(`  #${r.postNum} [${r.lines.length}]  ${r.lines.map(l => l.slice(0, 46)).join('  /  ')}`.slice(0, 190))
  }
}
