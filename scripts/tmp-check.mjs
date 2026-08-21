import fs from 'node:fs'
import { makeEntityResolver } from './lib/queueEntityResolve.mjs'
const entities = JSON.parse(fs.readFileSync('public/data/entities.json','utf8')).entities
const ids = JSON.parse(fs.readFileSync('audit/unhighlighted-entity-identities.json','utf8'))
const { resolve } = makeEntityResolver(entities, ids)
const rows = JSON.parse(fs.readFileSync('audit/unhighlighted-owner-rulings.json','utf8')).rulings.filter(r => r.section === 'entities')
let ok = 0, occ = 0, neu = new Map(), heldList = []
for (const r of rows) {
  const res = resolve(r)
  if (res.heldWhy) { heldList.push(`#${r.postNum} ${JSON.stringify(r.sourceText.slice(0,70))} — ${res.heldWhy}`); continue }
  ok++; occ += res.hits.length
  for (const h of res.hits) if (h.isNew) neu.set(h.canonical, (neu.get(h.canonical) ?? 0) + 1)
}
console.log('rulings resolved :', ok, '/', rows.length)
console.log('entity occurrences produced :', occ)
console.log('new identities :', neu.size)
console.log([...neu].sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${c}(${n})`).join(', '))
console.log('HELD :', heldList.length)
for (const h of heldList) console.log('   ', h)
