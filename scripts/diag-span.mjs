// Diagnostic: print an exact runtime slice of a drop. node scripts/diag-span.mjs <post> <start> <end>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const [n, s, e] = process.argv.slice(2)
const p = posts.find(x => x.postNum === Number(n))
const b = runtimeText(p.text ?? '')
console.log(`length ${b.length}`)
console.log(JSON.stringify(b.slice(Number(s), Number(e))))
