// Diagnostic. Replicates the questions block of materialize-literal-spans.mjs and prints which
// records need a literal span, against whatever is on disk right now. Writes nothing.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeSpan as literalSpan } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const rawByNum = new Map(posts.map(p => [p.postNum, p.text ?? '']))

let total = 0, exact = 0, unresolved = 0
const recovered = []
for (const r of questions) {
  if (r.occurrences === undefined) continue
  total++
  const certified = r.unitText ?? r.text
  const lit = literalSpan(rawByNum.get(r.postNum) ?? '', certified)
  if (lit && lit !== certified) recovered.push({ id: r.id, postNum: r.postNum, certified, lit })
  else if (lit) exact++
  else unresolved++
}
console.log(`certified ${total}  exact ${exact}  recovered ${recovered.length}  unresolved ${unresolved}`)
console.log(`records already carrying .literal on disk: ${questions.filter(r => r.literal).length}`)
for (const r of recovered) {
  console.log(`\n  ${r.id}  #${r.postNum}`)
  console.log(`     certified ${JSON.stringify(r.certified)}`)
  console.log(`     literal   ${JSON.stringify(r.lit)}`)
}
