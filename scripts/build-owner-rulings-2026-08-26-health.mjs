// THE OWNER'S RULING OF 2026-08-26: disease/medical-authority terms sweep into Health & Medicine.
//
//   "i want to have alll the diseases shown in the themes medical section... i can see post 252
//    talks about aids and disease but it is not within the medical. lets do all aids covid cancer
//    and items like this that are medical go into [Health & Medicine]... cdc hostpial medical or
//    anything of that nature that relates to health should be used as a term to make sure it
//    covers"
//
// A corpus census for AIDS/HIV/cancer/COVID/CDC/hospital/pharma/opioid/disease/virus/mental-health
// terms found 216 posts carrying one, 149 not yet certified Health & Medicine. Read individually,
// not swept blind — two shapes turned out to be near-total noise and are named here so they are
// never revisited by mistake:
//
//   "WHO" (48 hits) — every single one is the capitalised RELATIVE PRONOUN ("THOSE WHO CHALLENGE",
//   "WHO HAS THE INFORMATION"), never the World Health Organization. Zero included.
//
//   "sick"/"sickness" (most of the 55 disease/illness hits) — almost all are "These people are
//   sick", a moral judgement, not a health subject. Only the genuinely medical disease/illness
//   mentions are kept; the rhetorical ones are named in EXCLUDED below.
//
// EXCLUDED — read and judged NOT health subject matter, not silently dropped:
//   #1851  "You people are a DISEASE"                    — insult, not the topic of disease
//   #111   "would put 99% ... in a hospital"              — hyperbole about shock, not healthcare
//   #142   same construction as #111
//   #3808  "epidemic of leaks"                            — metaphor, DOJ leak investigations
//   #1806  "there's a virus in Trumpland" (Aug 2018)       — pre-COVID political metaphor
//
// SCOPED-BROAD, PER THE OWNER'S OWN WORDS ("anything relates ... make sure it covers"): the
// COVID-era "virus or election" posts and #2651's "spread like cancer" are included even though
// several read as primarily political commentary that happens to use a health-domain word or
// metaphor — the owner's ruling here is deliberately more inclusive than the general theme-sweep
// standard used elsewhere in this project, and that trade is recorded rather than silently applied.
//
//   node scripts/build-owner-rulings-2026-08-26-health.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'audit/themes-owner-rulings.json')
const dry = process.argv.includes('--dry')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

const RULED_ON = '2026-08-26'
const R = (postNum, anchor, reasoning) => ({
  postNum, postId: String(postNum), theme: 'health_medicine', label: 'Health & Medicine',
  anchor, was: 'unclassified', ruledOn: RULED_ON, reasoning,
})

const NEW = [
  R(249, 'Hussein AIDS Video', 'Owner ruling: AIDS sweep. "Focus on Hussein AIDS Video" — a named disease referenced as the subject of a specific claimed video.'),
  R(251, 'Focus on Hussein AIDS Video', 'Owner ruling: AIDS sweep, the follow-up drop re-reviewing the same claimed video.'),
  R(252, 'Diseases created by families in power (pop control + pharma billions kb).\nThink AIDS.', 'Owner ruling: the post the owner named directly — "post 252 talks about aids and disease but it is not within the medical."'),
  R(1220, 'HIV/AIDS.', 'Owner ruling: AIDS/HIV sweep. Same drop also names "CHAI discounted pharmaceuticals" and "Pharma alliance" — the whole drop is Clinton Foundation pharma/disease-conflict content.'),
  R(2651, 'The corruption (infiltration) at the top (WW) has spread like cancer.', 'Owner ruling: cancer sweep, named explicitly ("lets do all aids covid cancer"). The sentence uses cancer as a simile for corruption rather than discussing the disease itself — included per the owner\'s broader instruction to sweep the term, not excluded for being metaphorical the way the general theme standard would.'),
  R(1609, 'POTUS combatting opioids - not good enough - IMPEACH.', 'Owner ruling: opioid sweep — the opioid crisis as a named policy subject.'),
  R(4645, 'Centers for Disease Control and Prevention?', 'Owner ruling: "cdc ... should be used as a term" — CDC spelled out in full here.'),
  R(732, 'Wonder if his so-called illness/condition will flare up.', 'Owner ruling: illness sweep — a public figure\'s health condition as the subject.'),
  R(776, 'Target subjects are pre disposable to certain mental illnesses.', 'Owner ruling: illness sweep — mental illness named as a targeting criterion.'),
  R(3926, 'cbs-news-caught-broadcasting-fake-hospital-footage', 'Owner ruling: hospital sweep. COVID-era fake-footage claim (Breitbart URL slug); the subject is hospital/pandemic coverage, not the shock-value hyperbole #111/#142 use the word for.'),
  R(1573, 'Doctor(s) treating.', 'Owner ruling: doctor sweep — medical treatment named directly, the same drop as "These people are SICK."'),
  R(4631, 'offering a bounty to anybody who murders an abortion doctor', 'Owner ruling: doctor sweep — a medical-procedure provider named as the subject of the sentence.'),
  // ── COVID / C19, all ten named occurrences outside the corpus's own theme yet ──────────────
  R(3909, 'coronavirus-elections-wisconsin', 'Owner ruling: covid sweep, named explicitly ("lets do all aids covid cancer").'),
  R(4172, 'FIRST case of COVID-19 lands in UNITED STATES', 'Owner ruling: covid sweep.'),
  R(4239, 'Refusal to testify re: fear of COVID-19', 'Owner ruling: covid sweep.'),
  R(4339, 'deadly-covid19-nursing-home-policy', 'Owner ruling: covid sweep.'),
  R(4409, "attempt to prevent a 'medically verifiable' solution [prevention] re: COVID-19", 'Owner ruling: covid sweep.'),
  R(4583, 'What would be the primary purpose of inflating C19 numbers?', 'Owner ruling: covid sweep (Q\'s own C19 shorthand).'),
  R(4587, 'C19 narrative kill date: Election Day +1', 'Owner ruling: covid sweep.'),
  R(4635, 'force economic hardships [C19]?', 'Owner ruling: covid sweep.'),
  R(4639, 'C19 aid package(s) have failed?', 'Owner ruling: covid sweep.'),
  R(4817, '1st C19 case lands @ Seattle-Tacoma Airport', 'Owner ruling: covid sweep, the same case referenced from #4172.'),
  // ── the recurring "virus or election" COVID-era cluster, plus two standalone virus mentions ──
  R(3896, '“the CHINA virus”', 'Owner ruling: virus/covid sweep.'),
  R(4114, 'for both viruses, the viral proteins used for host cell entry', 'Owner ruling: virus sweep — literal virology content.'),
  R(4157, 'Is this about the virus OR THE ELECTION?', 'Owner ruling: virus/covid sweep, the recurring 2020 "virus or election" framing — included broadly per the owner\'s instruction even where the post\'s emphasis is political.'),
  R(4170, 'Is this about the virus OR THE ELECTION?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4219, 'Is this about the virus OR THE ELECTION?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4245, 'IS THIS ABOUT THE ELECTION OR THE VIRUS?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4254, 'Is this about the virus OR THE ELECTION?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4305, 'Is this about the virus OR SOMETHING ELSE?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4316, 'Is this about the virus OR THE ELECTION?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4327, 'australian-researchers-see-virus-design-manipulati', 'Owner ruling: virus/covid sweep — origin/lab-manipulation claim.'),
  R(4328, 'Was this ever about the virus?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4494, 'Is this about the virus OR THE ELECTION?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4551, 'Is this about the virus OR THE ELECTION?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
  R(4687, 'Virus or election?', 'Owner ruling: virus/covid sweep, same recurring framing, shortened form.'),
  R(4722, '1. Virus', 'Owner ruling: virus/covid sweep — virus named as the first item of a three-item 2020 crisis list.'),
  R(4754, 'Virus or Election?', 'Owner ruling: virus/covid sweep, same recurring framing, shortened form.'),
  R(4825, 'Was this ever about the virus?', 'Owner ruling: virus/covid sweep, same recurring framing.'),
]

const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const runtime = t => String(t || '').replace(MARKUP, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')

const problems = []
for (const r of NEW) {
  const p = byNum.get(r.postNum)
  if (!p) { problems.push(`#${r.postNum} is not a drop`); continue }
  const t = runtime(p.text)
  if (!t.includes(r.anchor)) {
    problems.push(`#${r.postNum} does not contain anchor ${JSON.stringify(r.anchor)}`)
  }
  const already = (p.postAnalysis?.themes ?? []).includes('Health & Medicine')
  if (already) problems.push(`#${r.postNum} already carries Health & Medicine`)
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const have = new Set((doc.rulings ?? []).map(r => `${r.postNum}|${r.theme}`))
const added = NEW.filter(r => !have.has(`${r.postNum}|${r.theme}`))

console.log(`\nOWNER THEME RULING — 2026-08-26, disease/medical-authority sweep into Health & Medicine\n`)
for (const r of NEW) console.log(`  #${String(r.postNum).padEnd(6)} ${JSON.stringify(r.anchor).slice(0, 60)}`)
console.log(`\n  ${added.length} new, ${NEW.length - added.length} already recorded\n`)
if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added.length) { console.log('  nothing to write\n'); process.exit(0) }

doc.rulings = [...(doc.rulings ?? []), ...added]
fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, FILE)}\n`)
