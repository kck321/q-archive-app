// Adjudicate the 364 low-confidence typed entities.
//
// These are the dangerous ones: they already carry a type, so a bad classification misleads a
// reader in a way an honest "unresolved" never does. 358 of the 364 were typed `person` by the
// structural name-shape fallback, and reading the list shows what that fallback swept up —
// mastheads, countries, universities, government bodies, offices, operations and slogans.
//
// Outcomes: KEEP_TYPE | CHANGE_TYPE | OTHER_NAMED_ENTITY | UNRESOLVED | ROUTE_TO_THEMES |
//           NOT_AN_ENTITY
//
// Every CHANGE_TYPE keeps oldType and newType so the pattern of mistakes stays visible.
//
// AUDIT ONLY — no production write, no deploy.
//
//   node scripts/adjudicate-entities-lowconf.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

// ── the failure classes, each written from what the list actually contained ──

// Mastheads and programmes. "Maggie NYT" is a reporter-plus-outlet handle, not a person record.
const MEDIA_NAME = /\b(Daily (Mail|Dot|Wire|Beast|Signal|Sabah|Caller)|National Review|Conservative Review|Real ?Clear ?Politics|Ars Technica|Hollywood Reporter|Rolling Stone|New Yorker|Zero Hedge|Gateway Pundit|Comedy Central|Just Security|The Lancet|Fox (Business|Friends|News)|America['’]?s? Newsroom|Ingraham Angle|Perth Now|Urban Dictionary|Cambridge Dictionary|Google Trends|NYT|WaPo|Newsroom)\b/i
const MEDIA_TAIL = /\b(Times|Post|Journal|Review|Report|Wire|Dot|Mail|Signal|Pundit|Hedge|Reporter|Newsroom|Dictionary|Magazine|Gazette|Press|Media|Network|Herald)$/

// Places. The corpus names a lot of countries and regions that look like two capitalised words.
const PLACE_NAME = /^(Middle East|Nazi Germany|Korean Peninsula|Burkina Faso|East Caribbean|Equatorial Guinea|Guinea Bissau|Netherlands Antilles|Papua New Guinea|San Marino|Sierra Leone|Southern California|East Africa|Eastern Washington|Santa Fe|West Hollywood|Hyde Park|Capitol Hill|El Centro|Radnor Township|Oshkosh Wisconsin|Black Forest|Hoover Dam)$/
const PLACE_TAIL = /\b(Peninsula|Caribbean|Africa|Township|County|Hills?|Park|Valley|Forest|Dam|Island|Coast|Border)$/

// Organisations, including universities, firms and NGOs.
const ORG_NAME = /\b(Shadow Brokers|Rizvi Traverse|Perkins Coie|Piper Jaffray|Mayo Clinic|Boy Scouts|Girl Scouts|American Red Cross|Cornell Law School|Harvard Law School|Harvard Muslim Alumni|Yale Medicine|Pearson Publishing|Activision Blizzard|Trump Hotels|Victoria['’]s Secret|Young Republican Federation|Global Health Leaders|Liberal Democrats|People['’]s Liberation Army|Ivy League|World Health Organization|World Trade Organization|United Nations|National Security Action|Guardian Project|Titus Nation)\b/i
const ORG_TAIL = /\b(School|University|College|Clinic|Hospital|Scouts|Federation|Alumni|League|Army|Organization|Organisation|Publishing|Blizzard|Hotels|Management|Coie|Jaffray)$/

// Government bodies and forces.
const GOV_NAME = /^(National Guard|Nat Guard|US Navy|Air Force|US Intel|Mil Intel|US GOV|Border Patrol|Executive Branch|Federal Government|Federal Agencies|Civil Rights Division|Intelligence Community|Situation Room|The Fed|STATE)$/i

// Offices held, not people named.
const TITLE_NAME = /^(NY AG|TX Congressman|Canadian PM|Australian Ambassador|National Security Adviser|New York Governor|United States Senator|First Lady|Confederate General|Fed Judge|Judge K)$/i
// "Senator Collins", "Admiral Rogers" — a title plus a surname IS a person.
const TITLED_PERSON = /^(Senator|Sen|Rep|Representative|Congressman|Congresswoman|Judge|Justice|Admiral|Adm|General|Gen|Colonel|Ambassador|Amb|Governor|Gov|Mayor|Pope|Cardinal|Dr|Mr|Mrs|Ms|AG|President)\.?\s+[A-Z][a-z]/

// Named events.
const EVENT_NAME = /^(2016 election|2020 election|Earth Day|Patriot Day|Super Bowl|Midterm Elections|French Revolution|Iran Deal)$/i
const EVENT_TAIL = /\b(Election|Elections|Day|Revolution|War|Bowl|Summit|Games)$/

// Operations, projects and named documents.
const PROGRAM_NAME = /^(Operation |Thousand Talents Plan|Emergency Broadcast System|Gateway Bridge Project|National Presidential Alert)/i
const DOCUMENT_NAME = /^(Steele Dossier|Mueller Report|Omnibus Bill|Presidential Advisory)$/i
const MILITARY_NAME = /^(Marine One|Stealth Bomber|Air Force One)$/i
const CREATIVE_NAME = /^(Saturday Night Live|White Squall|Of Montreal|The Hunt For)$/i
const FACILITY_NAME = /^(Hyatt Regency|Oregon State Park|Hoover Dam)$/i

// Q's codewords, and collective concepts. Neither is a named referent for this section.
const CODE_NAME = /^(RED OCTOBER|Red October|Castle LOCK|Red Castle|Green Castle|Sparrow Red|Mad Hatter|Midnight Rider|Wheels Up|qresearch)$/i
const CONCEPT = /^(MAGA|American People|America['’]?s Founders|Ancient Egyptians|Afghan Arabs|Confederate Democrats|Nature['’]s God|Official Secrets|State Secrets)$/i

export function adjudicate(text, oldType) {
  const t = (text ?? '').trim()

  // Ordered so the specific beats the general, and person is checked LAST among the classes
  // that the fallback confused it with.
  if (CODE_NAME.test(t)) return { outcome: 'ROUTE_TO_THEMES', why: 'one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities' }
  if (CONCEPT.test(t)) return { outcome: 'ROUTE_TO_THEMES', why: 'a collective or concept rather than a named referent' }

  if (TITLED_PERSON.test(t)) return { outcome: 'KEEP_TYPE', newType: 'person', why: 'a title followed by a surname — a person' }
  if (TITLE_NAME.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'title_role', why: 'an office held rather than a person named' }

  if (MEDIA_NAME.test(t) || MEDIA_TAIL.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'media_organization', why: 'a publication or programme' }
  if (PLACE_NAME.test(t) || PLACE_TAIL.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'country_region', why: 'a country, region or place' }
  if (GOV_NAME.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'government_institution', why: 'a government body or armed service' }
  if (ORG_NAME.test(t) || ORG_TAIL.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'organization', why: 'an organisation, firm or institution' }
  if (PROGRAM_NAME.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'program_operation_project', why: 'a named operation or programme' }
  if (DOCUMENT_NAME.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'other_named_entity', why: 'a named document' }
  if (MILITARY_NAME.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'military_asset_vessel', why: 'a named military asset' }
  if (CREATIVE_NAME.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'creative_work', why: 'a show, film or band' }
  if (FACILITY_NAME.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'facility_property', why: 'a named facility' }
  if (EVENT_NAME.test(t) || EVENT_TAIL.test(t)) return { outcome: 'CHANGE_TYPE', newType: 'event_incident', why: 'a named event' }

  // Single ambiguous tokens that reached here should not carry a person type.
  if (/^[A-Z]{2,5}$/.test(t)) return { outcome: 'UNRESOLVED', why: 'an acronym whose referent depends on context' }
  if (/^[A-Z][a-z]+ [A-Z]$/.test(t) || /^[A-Z]\.? [A-Z][a-z]+$/.test(t)) {
    return { outcome: 'UNRESOLVED', why: 'a name reduced to an initial — the referent is not established' }
  }

  // A two- or three-token capitalised name that survived every class above really is a person.
  if (/^[A-Z][A-Za-z'’.-]+(\s+[A-Z][A-Za-z'’.-]+){1,2}$/.test(t)) {
    return { outcome: 'KEEP_TYPE', newType: 'person', why: 'a personal name left after every competing class was tested' }
  }
  return { outcome: 'OTHER_NAMED_ENTITY', why: 'named, but the kind is still not established' }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    ['Hunter Biden', 'KEEP_TYPE', 'person'],
    ['Ghislaine Maxwell', 'KEEP_TYPE', 'person'],
    ['Senator Grassley', 'KEEP_TYPE', 'person'],
    ['Admiral Rogers', 'KEEP_TYPE', 'person'],
    ['Daily Mail', 'CHANGE_TYPE', 'media_organization'],
    ['The New Yorker', 'CHANGE_TYPE', 'media_organization'],
    ['Middle East', 'CHANGE_TYPE', 'country_region'],
    ['Sierra Leone', 'CHANGE_TYPE', 'country_region'],
    ['National Guard', 'CHANGE_TYPE', 'government_institution'],
    ['US Navy', 'CHANGE_TYPE', 'government_institution'],
    ['Harvard Law School', 'CHANGE_TYPE', 'organization'],
    ['World Health Organization', 'CHANGE_TYPE', 'organization'],
    ['NY AG', 'CHANGE_TYPE', 'title_role'],
    ['First Lady', 'CHANGE_TYPE', 'title_role'],
    ['Operation Merlin', 'CHANGE_TYPE', 'program_operation_project'],
    ['Steele Dossier', 'CHANGE_TYPE', 'other_named_entity'],
    ['Marine One', 'CHANGE_TYPE', 'military_asset_vessel'],
    ['Saturday Night Live', 'CHANGE_TYPE', 'creative_work'],
    ['2016 election', 'CHANGE_TYPE', 'event_incident'],
    ['Super Bowl', 'CHANGE_TYPE', 'event_incident'],
    ['MAGA', 'ROUTE_TO_THEMES', null],
    ['RED OCTOBER', 'ROUTE_TO_THEMES', null],
    ['American People', 'ROUTE_TO_THEMES', null],
    ['Judge K', 'CHANGE_TYPE', 'title_role'],
  ]
  let bad = 0
  for (const [t, want, wantType] of cases) {
    const r = adjudicate(t, 'person')
    const ok = r.outcome === want && (wantType === null || r.newType === wantType)
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.outcome.padEnd(20)}${(r.newType ?? '').padEnd(28)}${JSON.stringify(t)}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── run ──────────────────────────────────────────────────────────────────────
const other = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-other-adjudicated.json'), 'utf8'))
const tail = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-tail-adjudicated.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const CORPUS = posts.map(p => clean(p.text ?? '')).join('\n \n')

const lowConf = other.decisions.filter(d => d.retyped && d.confidence === 'LOW')
const decisions = lowConf.map(d => {
  const r = adjudicate(d.sourceText, d.finalType)
  const i = CORPUS.indexOf(d.sourceText)
  return {
    sourceText: d.sourceText, occurrences: d.storedOccurrences,
    oldType: d.finalType,
    newType: r.newType ?? null,
    outcome: r.outcome,
    changed: r.outcome === 'CHANGE_TYPE',
    why: r.why,
    contextExample: i >= 0 ? `…${CORPUS.slice(Math.max(0, i - 50), i).replace(/\n/g, ' ')}[${d.sourceText}]${CORPUS.slice(i + d.sourceText.length, i + d.sourceText.length + 50).replace(/\n/g, ' ')}…` : null,
  }
})

const tally = {}
for (const d of decisions) tally[d.outcome] = (tally[d.outcome] ?? 0) + 1
const changes = decisions.filter(d => d.changed)
const changeMatrix = {}
for (const d of changes) {
  const k = `${d.oldType} → ${d.newType}`
  changeMatrix[k] = (changeMatrix[k] ?? 0) + 1
}

// Final distribution across all canonical entities.
const finalTypes = {}
for (const d of tail.decisions) {
  if (d.outcome !== 'CANONICAL') continue
  let t = d.type
  if (t === 'other_named_entity') {
    const o = other.decisions.find(x => x.sourceText === d.sourceText)
    if (o?.retyped) t = o.finalType
  }
  const adj = decisions.find(x => x.sourceText === d.sourceText)
  if (adj) {
    if (adj.outcome === 'ROUTE_TO_THEMES') { finalTypes.ROUTED_TO_THEMES = (finalTypes.ROUTED_TO_THEMES ?? 0) + 1; continue }
    if (adj.outcome === 'UNRESOLVED') { finalTypes.UNRESOLVED = (finalTypes.UNRESOLVED ?? 0) + 1; continue }
    t = adj.newType ?? 'other_named_entity'
  }
  finalTypes[t] = (finalTypes[t] ?? 0) + 1
}

fs.writeFileSync(path.join(OUT, 'entities-lowconf-adjudicated.json'), JSON.stringify({
  scope: 'the 364 low-confidence typed entities', productionChanged: false,
  totals: { reviewed: decisions.length, byOutcome: tally, changeMatrix, finalTypes },
  decisions,
}, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|')
const md = ['# Entities — adjudicating the 364 low-confidence types\n']
md.push('**No production write, no deploy.** These are the dangerous records: they already carry a type, so a bad classification misleads in a way an honest "unresolved" never does.\n')
md.push('\n358 of the 364 were typed `person` by the structural name-shape fallback. Reading the list shows what that fallback swept up.\n')
md.push('\n## Outcome\n')
md.push('| Outcome | Count |')
md.push('|---|---|')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
md.push('\n## What kind of mistakes the rules were making\n')
md.push('| Change | Count |')
md.push('|---|---|')
for (const [k, n] of Object.entries(changeMatrix).sort((a, b) => b[1] - a[1])) md.push(`| ${k.replace(/_/g, ' ')} | ${n.toLocaleString()} |`)
md.push('\n## Final type distribution across all canonical entities\n')
md.push('| Type | Entities |')
md.push('|---|---|')
for (const [k, n] of Object.entries(finalTypes).sort((a, b) => b[1] - a[1])) md.push(`| ${k.replace(/_/g, ' ')} | ${n.toLocaleString()} |`)
for (const oc of ['CHANGE_TYPE', 'ROUTE_TO_THEMES', 'UNRESOLVED', 'OTHER_NAMED_ENTITY', 'KEEP_TYPE']) {
  const list = decisions.filter(d => d.outcome === oc)
  if (!list.length) continue
  md.push(`\n## ${oc} (${list.length})\n`)
  md.push('| Source text | × | Old type | New type | Reason |')
  md.push('|---|---|---|---|---|')
  for (const d of list.sort((a, b) => b.occurrences - a.occurrences).slice(0, 150)) {
    md.push(`| \`${esc(d.sourceText)}\` | ${d.occurrences} | ${d.oldType} | ${d.newType ?? '—'} | ${esc(d.why)} |`)
  }
  if (list.length > 150) md.push(`\n_…and ${list.length - 150} more in the JSON._`)
}
fs.writeFileSync(path.join(OUT, 'entities-lowconf-adjudicated.md'), md.join('\n') + '\n')

console.log('\nLOW-CONFIDENCE ADJUDICATION\n')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
console.log('\n  mistake pattern:')
for (const [k, n] of Object.entries(changeMatrix).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`)
console.log('\n  FINAL TYPE DISTRIBUTION:')
for (const [k, n] of Object.entries(finalTypes).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`)
console.log('\n→ audit/entities-lowconf-adjudicated.md\n')
