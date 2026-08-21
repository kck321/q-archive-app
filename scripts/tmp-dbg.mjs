import fs from 'node:fs'
import { makeEntityResolver, stripSpan } from './lib/queueEntityResolve.mjs'
const entities = JSON.parse(fs.readFileSync('public/data/entities.json','utf8')).entities
const byName = new Map()
for (const e of entities) { byName.set(e.canonical.toLowerCase(), e); for (const a of e.aliases ?? []) byName.set(String(a.text ?? a).toLowerCase(), e) }
for (const q of ['hilton','roth','rothschild','potus','jfk jr','jfk','the analysis corporation','jason bourne','operation merlin','deep dream','u1','ca','eu','asia','nk','sc','supreme court','mueller','usa','iran','pakistan','sis','uk','standard hotel','joe biden','alice'])
  console.log('  ', q.padEnd(28), byName.has(q) ? byName.get(q).canonical + ' [' + byName.get(q).type + ']' : 'ABSENT')
console.log('--- raw sourceTexts held ---')
const rows = JSON.parse(fs.readFileSync('audit/unhighlighted-owner-rulings.json','utf8')).rulings.filter(r => r.section === 'entities')
for (const r of rows) if ([165,166,666,751,1017,1082].includes(r.postNum)) console.log('  ', r.postNum, JSON.stringify(r.sourceText), '->', JSON.stringify(stripSpan(r.sourceText)))
