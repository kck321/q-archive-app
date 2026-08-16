// DIRECTIVES AUDIT — is every certified Directive actually a Q-authored instruction?
//
// The owner's rule, and it is the whole point: religious content is NOT disqualified. "Pray.",
// "If you are religious, PRAY." and "Have faith in God." are genuine Q-authored religious
// commands and stay Directives while also belonging to Religion & Spirituality. What must come
// out is different: blessings and valedictions ("God bless."), prayer addressed to God rather
// than to the reader, imperatives inside quoted Scripture, and commands that belong to an
// Anonymous poster, an article, a letter, an image or a screenshot rather than to Q.
//
// ADJUDICATED PER OCCURRENCE, never per phrase. The same wording is Q-authored in one drop and
// quoted in another — #147 writes "Pray." itself, and also shows an Anon post that says it.
//
// READ-ONLY. This writes three report files and touches no certified data.
//
//   node scripts/audit-directives-religious.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))

const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
const lo = s => norm(s).toLowerCase()

// ── the tests, in priority order ─────────────────────────────────────────────
const SCRIPTURE = [
  /put on the full armor of god/i, /be strong in the lord/i, /stand firm then, with the belt/i,
  /take (up )?the (helmet of salvation|shield of faith)/i, /and pray in the spirit on all occasions/i,
  /with this in mind, be alert/i, /be on your guard; stand firm in the faith/i,
  /put to death, therefore, whatever belongs/i, /have faith in god\.?$/i,
  /love is patient/i, /he makes me lie down/i, /you prepare a table before me/i,
  /surely your goodness and love/i, /ask and you shall receive/i,
]
const PRAYER_TO_GOD = [
  /give us this day our daily bread/i, /forgive us our trespasses/i, /lead us not into temptation/i,
  /deliver us from (the )?evil/i, /our father who art in heaven/i, /thy (kingdom come|will be done)/i,
  /hallowed be thy name/i, /strengthen my faith, lord/i, /forgive my sins/i, /make me brave/i,
  /give me your wisdom/i, /help us to avoid temptation/i, /st\.? michael the archangel/i,
  /be our protection against/i, /may god rebuke him/i, /cast down to hell satan/i,
]
const BLESSING = [
  /^god ?bless\b/i, /^god speed\b/i, /^godspeed\b/i, /^amen\b/i, /^merry christmas/i,
  /^may god (bless|watch|also grant)/i, /^god (be with|save|is with|wins|speed)/i,
  /^thank you (and|&) god bless/i, /^good luck (and|&) god bless/i, /^happy good friday/i,
  /^go with god/i, /^for god (and|&) country/i, /^in god we trust/i, /^god forever bless/i,
]
// A blessing welded to a real instruction. The complete sentence stays the highlight; the
// segments are metadata, because two half-sentence highlights would be worse than one whole one.
const MIXED = [
  [/^(god ?bless)( and | & )(stay safe|be safe)\.?$/i, 'God bless', 'stay safe'],
  [/^(good luck)( and | & )(god bless)!?$/i, 'God Bless', 'Good luck'],
]
const RELIGIOUS_DIRECTIVE = [
  /^pray\b/i, /^please pray/i, /^if you are religious,? pray/i, /^never stop praying/i,
  /^read the bible/i, /^pray for (strength|guidance|america|the victims)/i,
  /^find peace (\[solace\] )?through prayer/i, /^to all americans, please pray/i,
  /^let us salute and pray/i, /^have faith in god/i, /^keep praying/i,
]
const RELIGIOUS_WORD = /\bgod\b|\blord\b|\bjesus\b|\bchrist\b|\bpray|\bprayer|\bamen\b|\bbless|\bbibl|\bscriptur|\bholy\b|\bsatan|\bdevil|\bfaith\b|\bchurch|\bheaven|\bsoul\b|\bworship|\bsacred|\bdivine\b/i

const IMPERATIVE = /^(pray|read|find|keep|stay|think|watch|listen|learn|remember|look|note|define|expand|ask|trust|follow|be |do |go |let |never |always |please |use |apply |review |consider |protect|prepare|stand|fight|vote|share|help|make |take |put |get |see |know )/i

const rows = []
for (const p of posts) {
  const reqs = p.actionRequests ?? []
  if (!reqs.length) continue
  const text = clean(p.text ?? '')
  // sourceLines returns a Map of QUOTED line indices -> reason. Q-authored is the complement.
  // Read as "the lines Q wrote" and it returns {} for every post, which is how a first run of
  // this audit produced 2,495 NEEDS_CONTEXT and zero keeps.
  const allLines = text.split(String.fromCharCode(10))
  let quoted = new Map()
  try { const r = sourceLines(text); if (r instanceof Map) quoted = r } catch { quoted = new Map() }
  const qLines = allLines.filter((_, i) => !quoted.has(i)).map(lo).filter(Boolean)
  const qBlob = qLines.join(' \n ')

  reqs.forEach((req, idx) => {
    const sentence = norm(typeof req === 'string' ? req : (req.text ?? req.sentence ?? ''))
    if (!sentence) return
    const s = lo(sentence)
    // Q-authored when the wording appears in a line the quoted-block pass attributes to Q.
    const qAuthored = qBlob.length ? qBlob.includes(s) || qLines.some(l => l.includes(s)) : null
    const religious = RELIGIOUS_WORD.test(sentence)

    let ruling, reason, relSeg = '', dirSeg = ''
    const mix = MIXED.find(([rx]) => rx.test(sentence))
    if (mix) {
      ruling = 'SPLIT_MIXED_SENTENCE'; relSeg = mix[1]; dirSeg = mix[2]
      reason = 'One sentence carries a blessing and a real instruction. Keep the complete sentence as the highlight; store the segments as metadata.'
    } else if (PRAYER_TO_GOD.some(rx => rx.test(sentence))) {
      ruling = 'REMOVE_PRAYER_TEXT'; reason = 'A petition addressed to God, not an instruction to the reader.'
    } else if (SCRIPTURE.some(rx => rx.test(sentence))) {
      ruling = 'REMOVE_QUOTED_SCRIPTURE'; reason = 'Grammatically imperative, but the imperative belongs to quoted Bible text, not to Q.'
    } else if (RELIGIOUS_DIRECTIVE.some(rx => rx.test(sentence))) {
      ruling = qAuthored === false ? 'REMOVE_QUOTED_OR_THIRD_PARTY' : 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME'
      reason = qAuthored === false
        ? 'A genuine religious command, but in this drop it belongs to a quoted source rather than to Q.'
        : 'Q-authored religious command. Stays a Directive AND belongs to Religion & Spirituality.'
    } else if (BLESSING.some(rx => rx.test(sentence))) {
      ruling = 'REMOVE_BLESSING_OR_VALEDICTION'; reason = 'A blessing, greeting or closing — it instructs no one.'
    } else if (qAuthored === false) {
      ruling = 'REMOVE_QUOTED_OR_THIRD_PARTY'; reason = 'The command belongs to an Anonymous post, article, letter, image or screenshot quoted by Q.'
    } else if (religious && !IMPERATIVE.test(sentence)) {
      ruling = 'REMOVE_STATEMENT_OR_HEADING'; reason = 'Religious, but declarative — a statement, slogan or label rather than an instruction.'
    } else if (qAuthored === null) {
      ruling = 'NEEDS_CONTEXT'; reason = 'Source boundaries could not be established for this drop.'
    } else {
      ruling = 'KEEP_Q_DIRECTIVE'; reason = 'Q instructs or urges the reader directly.'
    }

    rows.push({ post: p.postNum, index: idx, fullSentence: sentence,
      directivePhrase: dirSeg || sentence, religiousSegment: relSeg,
      qAuthored: qAuthored === null ? 'unknown' : String(qAuthored),
      sourceType: qAuthored === false ? 'quoted_or_third_party' : 'q_post_body',
      currentClassification: 'Q Directive',
      proposedClassification: ruling.startsWith('KEEP') ? (ruling.includes('RELIGIOUS') ? 'Q Directive + Religion & Spirituality' : 'Q Directive')
        : ruling === 'SPLIT_MIXED_SENTENCE' ? 'Q Directive + Religion & Spirituality (segmented)'
        : ruling === 'NEEDS_CONTEXT' ? 'Needs Context' : 'Removed from Q Directives',
      religious: String(religious), ruling, reason })
  })
}

const tally = {}
for (const r of rows) tally[r.ruling] = (tally[r.ruling] ?? 0) + 1
const removed = rows.filter(r => r.ruling.startsWith('REMOVE')).length
const ORDER = ['KEEP_Q_DIRECTIVE', 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', 'SPLIT_MIXED_SENTENCE',
  'REMOVE_BLESSING_OR_VALEDICTION', 'REMOVE_PRAYER_TEXT', 'REMOVE_QUOTED_SCRIPTURE',
  'REMOVE_QUOTED_OR_THIRD_PARTY', 'REMOVE_STATEMENT_OR_HEADING', 'NEEDS_CONTEXT']

console.log('\nDIRECTIVES AUDIT — occurrence-level adjudication\n')
console.log(`  directives examined : ${rows.length}`)
for (const k of ORDER) console.log(`    ${String(tally[k] ?? 0).padStart(5)}  ${k}`)
console.log(`\n  BEFORE : ${rows.length} certified Directives`)
console.log(`  AFTER  : ${rows.length - removed} would remain  (${removed} proposed for removal)`)
console.log(`  religious occurrences KEPT as Directives : ${rows.filter(r => r.ruling === 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME').length}`)

const out = path.join(ROOT, 'audit')
fs.writeFileSync(path.join(out, 'directives-religious-adjudication.json'), JSON.stringify({
  note: 'Occurrence-level adjudication of every certified Directive. NOTHING IS APPLIED.',
  before: rows.length, after: rows.length - removed, tally, rows }, null, 1))

const esc = s => `"${String(s).replace(/"/g, '""')}"`
const cols = ['post', 'index', 'fullSentence', 'directivePhrase', 'religiousSegment', 'qAuthored', 'sourceType',
  'currentClassification', 'proposedClassification', 'religious', 'ruling', 'reason']
fs.writeFileSync(path.join(out, 'directives-religious-adjudication.csv'),
  [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'))

const txt = ['QDROPS — DIRECTIVES AUDIT: RELIGIOUS, QUOTED AND NON-DIRECTIVE MATERIAL', '='.repeat(78), '',
  'Religious content is NOT disqualified. A Q-authored religious command stays a Directive and',
  'also belongs to Religion & Spirituality. Removed instead: blessings and valedictions, prayer',
  'addressed to God, imperatives inside quoted Scripture, and commands belonging to a quoted',
  'source. Judged per OCCURRENCE — the same phrase can be Q-authored in one drop and quoted in',
  'another.', '',
  `BEFORE: ${rows.length} certified Directives`, `AFTER:  ${rows.length - removed} remain  (${removed} proposed for removal)`, '']
for (const k of ORDER) {
  const set = rows.filter(r => r.ruling === k)
  txt.push('', '='.repeat(78), `${k} — ${set.length}`, '='.repeat(78), '')
  for (const r of set.slice(0, k.startsWith('KEEP_Q') ? 40 : set.length)) {
    txt.push(`#${r.post}  Q-authored: ${r.qAuthored}  [${r.sourceType}]`)
    txt.push(`   full sentence : "${r.fullSentence}"`)
    if (r.religiousSegment) txt.push(`   religious seg : "${r.religiousSegment}"   directive seg : "${r.directivePhrase}"`)
    txt.push(`   ${r.currentClassification}  ->  ${r.proposedClassification}`)
    txt.push(`   reason: ${r.reason}`, '')
  }
  if (k.startsWith('KEEP_Q') && set.length > 40) txt.push(`   … ${set.length - 40} further KEEP_Q_DIRECTIVE rows omitted from this TXT; all are in the CSV and JSON.`, '')
}
fs.writeFileSync(path.join(out, 'directives-religious-adjudication.txt'), txt.join('\n'))
console.log('\nwrote audit/directives-religious-adjudication.{txt,csv,json}   — nothing applied')
