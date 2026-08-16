// Decide which YELLOW/RED records belong in the Religious & Spiritual theme.
//
// THE RULE, STATED SO IT CAN BE ARGUED WITH.
//
// A record joins the theme when the sentence refers to religion ITSELF — a deity, scripture, a
// prayer, a religious institution, an observance, an occult or mythological figure, a doctrine.
// It does NOT join when the sentence borrows vocabulary that merely has religious ancestry:
// evil, light and darkness, sheep, awakening, sacrifice and secular "faith" are Q's ordinary
// political register, and tagging them would make the theme mean "Q wrote emphatically" instead
// of "this is about religion".
//
// The line is drawn at the SENTENCE, not the word. "Have faith in Humanity" is not religious;
// "What faith does HUMA represent?" is. Both are CATEGORY: Faith / belief in the source audit,
// which is why category alone cannot decide anything.
//
//   node scripts/classify-religious-audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { records } = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/religious-audit-parsed.json'), 'utf8'))

const S = r => r.sentence.toLowerCase()

// Sentences that name religion itself, whatever the audit's category said.
const RELIGIOUS_SENTENCE = [
  /\bgod\b|\blord\b|\bjesus\b|\bchrist\b|\bdivine\b|\balmighty\b|\bcreator\b/i,
  /\bpray|\bprayer|\bamen\b|\bbless/i,
  /\bbibl|\bscriptur|\bgospel|\bpsalm|\bproverbs\b|\bcorinthians\b|\bephesians\b|\bthessalonians\b/i,
  /\bchurch|\bvatican|\bpope\b|\bcardinal\b|\bbishop|\bclergy|\bnuncio|\bholy see\b|\bsynagogue|\bshrine\b/i,
  /\bsatan|\bdevil|\bdemon|\boccult|\britual|\bpagan|\bmoloch|\bwarlock|\bwitch|\bspirit cooking/i,
  /\bmuslim|\bislam|\bjihad|\bjewish\b|\bjews\b|\bchristian|\bcatholic|\breligio|\bfaithful\b|\bapostate/i,
  /\bheaven\b|\bhell\b|\bsoul\b|\bssouls\b|\beternal\b|\bdamnation|\bsalvation|\bresurrect/i,
  /\btemple\b|\bmasonic\b|\bfreemason|\bhigh priest/i,
  /\bcult\b|\bdogma\b|\brevelation\b|\bprophet|\bsaint|\bangel\b|\bmiracle|\bmilagro/i,
  /\bchristmas\b|\bxmas\b|\beaster\b|\bgood friday\b|\bsermon on the mount\b|\btrinity\b/i,
  /\bthor\b|\bodin\b|\bsun god\b|\bpharaoh|\bserpent\b|\bthe beast\b/i,
  /\bjudgement day|\bjudgment day|\bday of reckoning|\bfear no evil\b/i,
  /\bsin\b|\bsins\b|\btrespass|\brighteous|\bmercy of\b|\bblasphem/i,
  /children of (light|darkness)|offspring of the (woman|serpent)/i,
  /\bupside down cross|\bsatanic cross|\bcross\b.*\brepresent/i,
  /\bfaith\b.*\b(represent|religio|muslim|islam|christian)|\breligious faith\b|\bif you are religious/i,
  /\bwizards? (&|and) warlocks?\b/i,
  /\bascension\b/i,
]

// Sentences that only LOOK religious. Checked first: these are Q's political vocabulary.
const NOT_RELIGIOUS = [
  /^have faith[.!]?$/i,
  /have faith (in (humanity|yourself|your research|us)|and trust|, patriots?)/i,
  /keep (the )?faith/i,
  /faith in (humanity|yourself|democracy|the virtual world|us)\b/i,
  /(restore|regain|public) faith|faith of the american people|trust and put faith/i,
  /\b(hell to pay|what the hell|fucking hell|one hell of a|captcha hell|hell on earth|unleash hell|like hell)\b/i,
  /good spirits/i,
  /^(the )?great awakening[.!]?$/i,     // a movement label in this corpus, not a revival
  /\bbelief|\bbeliefs\b|\bbelievers\b|\bdoubters\b/i,
]

const decide = r => {
  if (r.conf === 'GREEN') return { keep: true, why: 'GREEN — explicit religious content' }
  const s = S(r)
  for (const rx of NOT_RELIGIOUS) if (rx.test(s)) return { keep: false, why: 'borrowed vocabulary, not about religion' }
  for (const rx of RELIGIOUS_SENTENCE) if (rx.test(r.sentence)) return { keep: true, why: 'sentence names religion itself' }
  return { keep: false, why: 'no religious referent in the sentence' }
}

for (const r of records) Object.assign(r, decide(r))

const usable = r => r.match === 'EXACT'
const kept = records.filter(r => r.keep && usable(r))
const rejected = records.filter(r => !r.keep)
const unusable = records.filter(r => r.keep && !usable(r))

const tally = c => ({
  total: records.filter(r => r.conf === c).length,
  kept: records.filter(r => r.conf === c && r.keep && usable(r)).length,
  rejected: records.filter(r => r.conf === c && !r.keep).length,
  unmatched: records.filter(r => r.conf === c && r.keep && !usable(r)).length,
})
console.log('\nRELIGIOUS / SPIRITUAL AUDIT — EDITORIAL PASS\n')
for (const c of ['GREEN', 'YELLOW', 'RED']) {
  const t = tally(c)
  console.log(`  ${c.padEnd(7)} ${String(t.total).padStart(4)} records → ${String(t.kept).padStart(4)} kept, ${String(t.rejected).padStart(4)} not religious, ${String(t.unmatched).padStart(3)} unusable (not verbatim in post text)`)
}
console.log(`\n  kept & usable total : ${kept.length}  across ${new Set(kept.map(r => r.post)).size} posts`)

fs.writeFileSync(path.join(ROOT, 'audit/religious-audit-classified.json'), JSON.stringify({ records }, null, 1))

// The list the owner asked for: everything NOT used, with the reason, so it can be re-checked.
const lines = ['QDROPS — RELIGIOUS/SPIRITUAL AUDIT: RECORDS NOT ADDED TO THE THEME', '='.repeat(78), '',
  'Two reasons a record is not used:', '',
  '  NOT RELIGIOUS  the sentence borrows religious-sounding vocabulary but is not about religion',
  '                 (evil, light/darkness, sheep, awakening, sacrifice, secular "faith").',
  '  NOT VERBATIM   the sentence does not reproduce exactly from the canonical post text — it is',
  '                 image text, OCR, or wording from a post QUOTED by Q rather than Q\'s own body.',
  '                 These are not rejected on meaning; they simply cannot be highlighted safely.', '']
for (const label of ['NOT RELIGIOUS', 'NOT VERBATIM']) {
  const set = label === 'NOT RELIGIOUS' ? rejected : unusable
  lines.push('', '='.repeat(78), `${label} — ${set.length} records`, '='.repeat(78), '')
  for (const c of ['GREEN', 'YELLOW', 'RED']) {
    const rows = set.filter(r => r.conf === c)
    if (!rows.length) continue
    lines.push(`--- ${c} (${rows.length}) ---`)
    for (const r of rows.sort((a, b) => a.post - b.post)) {
      lines.push(`#${r.post}  [${r.cat}]${label === 'NOT VERBATIM' ? ` (${r.srcType})` : ''}`)
      lines.push(`   "${r.sentence}"`)
      if (label === 'NOT RELIGIOUS') lines.push(`   reason: ${r.why}`)
      lines.push('')
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'audit/religious-audit-not-used.txt'), lines.join('\n'))
console.log('\nwrote audit/religious-audit-classified.json')
console.log('wrote audit/religious-audit-not-used.txt  (the list for GPT)')
