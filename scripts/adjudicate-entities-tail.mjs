// Adjudicate the uncovered entity tail — 2,295 stored strings the 82-entity core does not hold.
//
// THE CUTOFF, from the review:
//   occurrence >= 2   canonicalise if the referent is identifiable
//   occurrence == 1   canonicalise only if unmistakably named and meaningful
//   ambiguous         never guess — keep the literal token, contextDependent true
//
// And the boundary that keeps this section from becoming noise: a conceptual collective is not
// an entity. "THE PEOPLE", "Patriots", "MSM", "Deep State" name an idea or a crowd, not a
// specific organisation. They are ROUTED TO THEMES rather than deleted, so nothing is lost and
// nothing is promoted to a subject with a mention count that it never was.
//
// AUDIT ONLY — no production write, no deploy.
//
//   node scripts/adjudicate-entities-tail.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTE_TO_THEMES, TITLE_ROLES, CODED_ALIASES, CONTEXT_DEPENDENT } from './lib/entities.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

// ── identifiability signals ──────────────────────────────────────────────────
// Two or more capitalised words reads as a proper name: "Peter Strzok", "Kevin Clinesmith".
const FULL_NAME = /^[A-Z][a-z'’-]+(?:\s+(?:[A-Z]\.|[A-Z][a-z'’-]+|van|von|de|del|di|la|Mc[A-Z][a-z]+)){1,3}$/
const NAME_WITH_INITIAL = /^[A-Z][a-z'’-]+\s+[A-Z]\.\s+[A-Z][a-z'’-]+$/
// A single capitalised word that is not an ordinary English word reads as a surname.
const SINGLE_CAP = /^[A-Z][a-z'’-]{3,}$/

const ORG_SUFFIX = /\b(News|Times|Post|Journal|Herald|Tribune|Corp|Corporation|Inc|LLC|Group|Foundation|Institute|Agency|Bureau|Department|Dept|Committee|Commission|Council|Association|Society|Union|Bank|University|College|Airlines|Media|Network|Press|Broadcasting|Party|Fund|Trust|Holdings|Systems|Technologies|Labs?)\b/i
const KNOWN_ORGS = new Set(['Bing', 'Microsoft', 'Apple', 'Amazon', 'HuffPost', 'AP', 'Reuters', 'Bloomberg', 'Politico', 'Newsweek', 'Fortune', 'WikiLeaks', 'Wikileaks', 'Telegram', 'Instagram', 'Snapchat', 'Reddit', 'PayPal', 'Boeing', 'Lockheed', 'Raytheon', 'Halliburton', 'Monsanto', 'Pfizer', 'Moderna', 'NASA', 'NATO', 'UN', 'WHO', 'IMF', 'FEMA', 'ATF', 'DEA', 'IRS', 'TSA', 'DHS', 'ICE', 'NSC', 'GCHQ', 'MI5', 'MI6', 'KGB', 'FSB', 'Mossad', 'Interpol', 'Planned Parenthood', 'KKK', 'Titanic'])
const GAZETTEER = new Set(['Canada', 'Mexico', 'France', 'Germany', 'Italy', 'Spain', 'Japan', 'India', 'Brazil', 'Australia', 'Egypt', 'Turkey', 'Syria', 'Iraq', 'Libya', 'Yemen', 'Afghanistan', 'Venezuela', 'Cuba', 'Taiwan', 'Vietnam', 'Poland', 'Ukraine', 'Sweden', 'Norway', 'Switzerland', 'Austria', 'Greece', 'Ireland', 'Scotland', 'Wales', 'England', 'Texas', 'California', 'Florida', 'Georgia', 'Arizona', 'Nevada', 'Michigan', 'Wisconsin', 'Pennsylvania', 'Ohio', 'Virginia', 'Maryland', 'Chicago', 'New York', 'Los Angeles', 'Houston', 'Atlanta', 'Boston', 'Seattle', 'Vatican', 'Jerusalem', 'Moscow', 'Beijing', 'London', 'Paris', 'Berlin', 'Tehran', 'Baghdad'])
const RELIGIOUS = new Set(['God', 'GOD', 'Lord', 'LORD', 'Jesus', 'Jesus Christ', 'Christ', 'Holy Spirit', 'Almighty', 'Satan', 'Vatican'])

// Two capitalised words is NOT enough to make a person. Without these guards the tail put
// "Federal Reserve", "Solomon Islands", "Hatch Act" and "Star Wars" into the people list.
const LEGISLATION = /\b(Act|Bill|Amendment|Resolution|Treaty|Accord|Doctrine|Clause)\b/
const PLACE_SUFFIX = /\b(Islands?|Republic|Kingdom|Territory|County|City|Beach|Valley|Springs|Bay|Harbou?r|Airport|Base)\b/
const ORG_EXTRA = /\b(Reserve|Capital|Partners|Associates|Ventures|Industries|Enterprises|Firm|LLP)\b/
// A person is recognised by a GIVEN NAME, a particle surname, or an initial — not by capitals.
const GIVEN_NAMES = new Set(('James John Robert Michael William David Richard Joseph Thomas Charles Christopher Daniel Matthew Anthony Donald Mark Paul Steven Andrew Kenneth George Joshua Kevin Brian Edward Ronald Timothy Jason Jeffrey Ryan Jacob Gary Nicholas Eric Jonathan Stephen Larry Justin Scott Brandon Benjamin Samuel Gregory Alexander Patrick Frank Raymond Jack Dennis Jerry Tyler Aaron Jose Adam Nathan Henry Zachary Douglas Peter Kyle Noah Ethan Jeremy Walter Christian Keith Roger Terry Austin Sean Gerald Carl Harold Dylan Arthur Lawrence Jordan Jesse Bryan Billy Bruce Gabriel Joe Logan Alan Juan Albert Willie Elijah Wayne Randy Vincent Mason Roy Ralph Bobby Russell Bradley Philip Eugene '
  + 'Mary Patricia Jennifer Linda Elizabeth Barbara Susan Jessica Sarah Karen Nancy Lisa Betty Margaret Sandra Ashley Kimberly Emily Donna Michelle Carol Amanda Dorothy Melissa Deborah Stephanie Rebecca Sharon Laura Cynthia Kathleen Amy Angela Shirley Anna Brenda Pamela Nicole Ruth Katherine Samantha Christine Emma Catherine Debra Virginia Rachel Carolyn Janet Maria Heather Diane Julie Joyce Victoria Kelly Christina Joan Evelyn Lauren Judith Olivia Frances Martha Cheryl Megan Andrea Hannah Jacqueline Ann Jean Alice Kathryn Gloria Teresa Doris Sara Janice Marie Julia Grace Judy Theresa Beverly Denise Marilyn Amber Danielle Rose Brittany Diana Abigail Natalie Jane Lori Alexis Tiffany Kayla Claire Louise Tara Sally Roseanne '
  + 'Patton Terrence Guadalupe Huma Loretta Devin Hillary Barack Rod Jeff Bill Ted Jared Jim Chuck Lindsey Mitch Rudy Mike Mick Preet Sidney Nellie Glenn Trey Bob Rick Tom Steve Dan Ben Sam Al Ed Seth Anthony Kim Maxine Elijah Trey').split(/\s+/).filter(Boolean))
const PARTICLE = /^(De|Van|Von|Del|Della|Di|La|Le|Mac|Mc|O')/
const GOV_INSTITUTION = /\b(House|Senate|Congress|Parliament|Supreme Court|Cabinet|Judiciary|Administration)\b/
// Initials, underscore tokens and 2-3 letter caps: shorthand, never guessed.
const SHORTHAND = /^([A-Z]{1,3}|[A-Z]+_[A-Z_]+|[A-Z]\.[A-Z]\.?)$/
// Ordinary words that happen to be capitalised in Q's all-caps style.
const COMMON_WORD = /^(The|This|That|These|Those|And|But|For|Not|All|You|Your|Our|Their|His|Her|Its|What|When|Where|Why|How|Who|Now|Then|Here|There|Yes|No|More|Most|Many|Some|Any|Every|Each|Big|New|Old|Good|Bad|True|False|Real|Fake|Deep|Dark|Light|Free|Full|Open|Close|Next|Last|First|Time|Day|Week|Year|Month|People|Public|Private|Power|Control|Truth|Justice|Freedom|Future|Past|Present|War|Peace|Money|Media|News|Information|Evidence|Proof|Plan|Game|Story|Message|Question|Answer|Point|Reason|Result|Change|Order|Force|Level|State|World|Country|Nation|Government|System|Program|Project|Operation|Mission|Team|Group|Party|Side|Line|Way|End|Start|Stop)$/

export function adjudicate(text, occurrences) {
  const t = (text ?? '').trim()
  if (!t) return { outcome: 'DROP', why: 'empty', confidence: 'HIGH' }

  // 1 — conceptual collectives belong to Themes, whatever their frequency.
  if (ROUTE_TO_THEMES.has(t)) {
    return { outcome: 'ROUTE_TO_THEMES', why: 'a conceptual collective — names an idea or a crowd, not a specific organisation', confidence: 'HIGH' }
  }
  // 2 — titles and coded aliases have their own types and stay unresolved by default.
  if (Object.hasOwn(TITLE_ROLES, t)) {
    return { outcome: 'CANONICAL', type: 'title_role', canonical: t, contextDependent: true, why: TITLE_ROLES[t], confidence: 'HIGH' }
  }
  if (Object.hasOwn(CODED_ALIASES, t)) {
    return { outcome: 'CANONICAL', type: 'coded_alias', canonical: t, contextDependent: true, why: CODED_ALIASES[t].note, confidence: 'MEDIUM' }
  }
  if (Object.hasOwn(CONTEXT_DEPENDENT, t)) {
    return { outcome: 'UNRESOLVED', why: CONTEXT_DEPENDENT[t], confidence: 'LOW' }
  }
  // 3 — shorthand is never guessed.
  if (SHORTHAND.test(t)) {
    return { outcome: 'UNRESOLVED', why: 'initials or shorthand with no single referent — kept as the literal token', confidence: 'LOW' }
  }
  if (COMMON_WORD.test(t)) {
    return { outcome: 'ROUTE_TO_THEMES', why: 'an ordinary word capitalised in Q’s style, not a named referent', confidence: 'MEDIUM' }
  }

  // 4 — identifiable classes
  if (RELIGIOUS.has(t)) return { outcome: 'CANONICAL', type: 'religious_spiritual', canonical: t, why: 'religious or spiritual referent', confidence: 'HIGH' }
  if (GAZETTEER.has(t)) {
    const country = /^(Canada|Mexico|France|Germany|Italy|Spain|Japan|India|Brazil|Australia|Egypt|Turkey|Syria|Iraq|Libya|Yemen|Afghanistan|Venezuela|Cuba|Taiwan|Vietnam|Poland|Ukraine|Sweden|Norway|Switzerland|Austria|Greece|Ireland|Scotland|Wales|England)$/.test(t)
    return { outcome: 'CANONICAL', type: country ? 'country_region' : 'location', canonical: t, why: country ? 'country' : 'place name', confidence: 'HIGH' }
  }
  if (KNOWN_ORGS.has(t)) return { outcome: 'CANONICAL', type: 'organization', canonical: t, why: 'named organisation', confidence: 'HIGH' }
  if (GOV_INSTITUTION.test(t)) return { outcome: 'CANONICAL', type: 'government_institution', canonical: t, why: 'government institution', confidence: 'MEDIUM' }
  if (ORG_SUFFIX.test(t) || ORG_EXTRA.test(t)) {
    const media = /\b(News|Times|Post|Journal|Herald|Tribune|Media|Network|Press|Broadcasting)\b/i.test(t)
    return { outcome: 'CANONICAL', type: media ? 'media_organization' : 'organization', canonical: t, why: 'organisation name carrying an organisational suffix', confidence: 'HIGH' }
  }
  if (LEGISLATION.test(t)) return { outcome: 'CANONICAL', type: 'other_named_entity', canonical: t, why: 'named legislation or doctrine', confidence: 'MEDIUM' }
  if (PLACE_SUFFIX.test(t)) return { outcome: 'CANONICAL', type: 'location', canonical: t, why: 'place name carrying a geographic suffix', confidence: 'MEDIUM' }

  if (FULL_NAME.test(t) || NAME_WITH_INITIAL.test(t)) {
    const first = t.split(/\s+/)[0]
    const looksPersonal = GIVEN_NAMES.has(first) || PARTICLE.test(first) || NAME_WITH_INITIAL.test(t) || /^[A-Z]\.$/.test(first)
    if (looksPersonal) {
      return { outcome: 'CANONICAL', type: 'person', canonical: t, why: 'given name or particle followed by a surname', confidence: 'HIGH' }
    }
    // Capitalised pair with no personal signal. Named, but the KIND is not established.
    return { outcome: 'CANONICAL', type: 'other_named_entity', canonical: t, why: 'a proper name with no signal of what kind of thing it is — named, but the type is unestablished', confidence: 'LOW' }
  }

  // 5 — a lone surname. Identifiable enough at 2+ occurrences; at 1 it is not.
  if (SINGLE_CAP.test(t)) {
    if (occurrences >= 2) return { outcome: 'CANONICAL', type: 'person', canonical: t, why: 'single capitalised surname appearing more than once', confidence: 'MEDIUM' }
    return { outcome: 'UNRESOLVED', why: 'a lone capitalised word appearing once — not unmistakably identifiable', confidence: 'LOW' }
  }
  if (occurrences === 1) {
    return { outcome: 'UNRESOLVED', why: 'appears once and is not unmistakably named', confidence: 'LOW' }
  }
  return { outcome: 'CANONICAL', type: 'other_named_entity', canonical: t, why: 'named referent appearing more than once, type not determined', confidence: 'LOW' }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    ['Peter Strzok', 12, 'CANONICAL', 'person'],
    ['Federal Reserve', 5, 'CANONICAL', 'organization'],
    ['Solomon Islands', 1, 'CANONICAL', 'location'],
    ['Hatch Act', 1, 'CANONICAL', 'other_named_entity'],
    ['Star Wars', 1, 'CANONICAL', 'other_named_entity'],
    ['Kevin Clinesmith', 5, 'CANONICAL', 'person'],
    ['Clapper', 10, 'CANONICAL', 'person'],
    ['Chris', 1, 'UNRESOLVED', null],
    ['WikiLeaks', 16, 'CANONICAL', 'organization'],
    ['HuffPost', 2, 'CANONICAL', 'organization'],
    ['Canada', 5, 'CANONICAL', 'country_region'],
    ['Vatican', 3, 'CANONICAL', 'religious_spiritual'],
    ['House', 37, 'CANONICAL', 'government_institution'],
    ['POTUS', 370, 'CANONICAL', 'title_role'],
    ['NO NAME', 16, 'CANONICAL', 'coded_alias'],
    ['God', 204, 'CANONICAL', 'religious_spiritual'],
    ['THE PEOPLE', 125, 'ROUTE_TO_THEMES', null],
    ['Patriots', 16, 'ROUTE_TO_THEMES', null],
    ['MSM', 96, 'ROUTE_TO_THEMES', null],
    ['JP', 2, 'UNRESOLVED', null],
    ['D_PARTY', 2, 'UNRESOLVED', null],
    ['Clinton', 47, 'UNRESOLVED', null],
    ['JFK', 15, 'UNRESOLVED', null],
    ['DC', 67, 'UNRESOLVED', null],
  ]
  let bad = 0
  for (const [t, n, want, wantType] of cases) {
    const r = adjudicate(t, n)
    const ok = r.outcome === want && (wantType === null || r.type === wantType)
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.outcome.padEnd(18)}${(r.type ?? '').padEnd(24)}${JSON.stringify(t)}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── run over the tail ────────────────────────────────────────────────────────
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-audit.json'), 'utf8'))
const decisions = audit.uncovered.map(u => {
  const a = adjudicate(u.text, u.n)
  return { sourceText: u.text, storedOccurrences: u.n, ...a }
})

const tally = {}
const typeTally = {}
for (const d of decisions) {
  tally[d.outcome] = (tally[d.outcome] ?? 0) + 1
  if (d.type) typeTally[d.type] = (typeTally[d.type] ?? 0) + 1
}
const canonical = decisions.filter(d => d.outcome === 'CANONICAL')
const themed = decisions.filter(d => d.outcome === 'ROUTE_TO_THEMES')
const unresolved = decisions.filter(d => d.outcome === 'UNRESOLVED')

fs.writeFileSync(path.join(OUT, 'entities-tail-adjudicated.json'), JSON.stringify({
  scope: 'the 2,295 uncovered stored entity strings', productionChanged: false,
  totals: { adjudicated: decisions.length, canonical: canonical.length, routedToThemes: themed.length, unresolved: unresolved.length, byType: typeTally },
  decisions,
}, null, 1))

const md = ['# Entities — adjudicating the uncovered tail\n']
md.push('**No production write, no deploy.** Nothing is promoted because an older extractor stored it.\n')
md.push('\n## The cutoff\n')
md.push('| Occurrences | Rule |')
md.push('|---|---|')
md.push('| ≥ 2 | canonicalise if the referent is identifiable |')
md.push('| 1 | canonicalise only if unmistakably named and meaningful |')
md.push('| ambiguous | never guessed — the literal token is kept, `contextDependent: true` |')
md.push('\n## Outcome\n')
md.push('| Outcome | Strings |')
md.push('|---|---|')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
md.push('\n### New canonical entities by type\n')
md.push('| Type | Count |')
md.push('|---|---|')
for (const [k, n] of Object.entries(typeTally).sort((a, b) => b[1] - a[1])) md.push(`| ${k.replace(/_/g, ' ')} | ${n.toLocaleString()} |`)
md.push('\n## Why concept nouns are not entities\n')
md.push('`THE PEOPLE`, `Patriots`, `MSM`, `Deep State` name an idea or a crowd, not a specific organisation. Promoting them would turn every capitalised concept into a subject with a mention count it never had. They are **routed to Themes**, not deleted — nothing is lost, and the Themes section is where a recurring subject belongs.\n')
md.push('\n## New canonical entities (top 80 by stored frequency)\n')
md.push('| Source text | Occurrences | Type | Why |')
md.push('|---|---|---|---|')
for (const d of canonical.sort((a, b) => b.storedOccurrences - a.storedOccurrences).slice(0, 80)) {
  md.push(`| ${d.sourceText} | ${d.storedOccurrences} | ${d.type.replace(/_/g, ' ')} | ${d.why} |`)
}
md.push('\n## Routed to Themes\n')
md.push('| Source text | Occurrences |')
md.push('|---|---|')
for (const d of themed.sort((a, b) => b.storedOccurrences - a.storedOccurrences).slice(0, 40)) md.push(`| ${d.sourceText} | ${d.storedOccurrences} |`)
md.push('\n## Left unresolved — deliberately\n')
md.push('These are kept as literal tokens with `contextDependent: true`. A wrong canonicalisation is worse than an unresolved one.\n')
md.push('| Source text | Occurrences | Why |')
md.push('|---|---|---|')
for (const d of unresolved.sort((a, b) => b.storedOccurrences - a.storedOccurrences).slice(0, 40)) md.push(`| ${d.sourceText} | ${d.storedOccurrences} | ${d.why} |`)
fs.writeFileSync(path.join(OUT, 'entities-tail-adjudicated.md'), md.join('\n') + '\n')

console.log('\nENTITY TAIL ADJUDICATION\n')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`)
console.log('\n  new canonical entities by type:')
for (const [k, n] of Object.entries(typeTally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${k}`)
console.log(`\n  registry would grow from 82 to ${82 + canonical.length}`)
console.log('\n→ audit/entities-tail-adjudicated.md\n')
