// DIRECTIVES AUDIT v2 — four-state authorship, occurrence-anchored.
//
// v1 used a boolean: "found in Q's lines" or else quoted. That turned a LOOKUP FAILURE into a
// verdict — #3's sentence is in neither the quoted block nor the matched Q lines, and was
// labelled third-party by default. Same shape as the sourceLines inversion one layer along.
//
//   Q_AUTHORED_CURRENT_POST      the phrase sits on a line this post's author wrote
//   QUOTED_OR_EMBEDDED           it sits inside a quoted/embedded block (with a subtype)
//   NOT_LOCATED                  it cannot be found — NEVER downgraded to quoted
//   AMBIGUOUS_MULTIPLE_MATCHES   it appears both quoted and in the body, and the occurrence
//                                index cannot separate them
//
// The board author label is NOT evidence. #3 renders as "Anonymous" in the board export and is
// still canonical Q-corpus body text. Authorship here means: is this span inside a quoted block.
//
// READ-ONLY.  node scripts/audit-directives-v2.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
const lo = s => norm(s).toLowerCase()

const SCRIPTURE = [/put on the full armor of god/i, /be strong in the lord/i, /stand firm then, with the belt/i,
  /take (up )?the (helmet of salvation|shield of faith)/i, /and pray in the spirit on all occasions/i,
  /with this in mind, be alert/i, /be on your guard; stand firm in the faith/i,
  /put to death, therefore, whatever belongs/i, /^have faith in god\.?$/i, /love is patient/i,
  /he makes me lie down/i, /you prepare a table before me/i, /surely your goodness and love/i, /ask and you shall receive/i]
const PRAYER = [/give us this day our daily bread/i, /forgive us our trespasses/i, /lead us not into temptation/i,
  /deliver us from (the )?evil/i, /our father who art in heaven/i, /thy (kingdom come|will be done)/i,
  /hallowed be thy name/i, /strengthen my faith, lord/i, /forgive my sins/i, /make me brave/i,
  /give me your wisdom/i, /help us to avoid temptation/i, /st\.? michael the archangel/i,
  /be our protection against/i, /may god rebuke him/i, /cast down to hell satan/i]
const BLESSING = [/^god ?bless\b/i, /^god ?speed\b/i, /^godspeed\b/i, /^amen\b/i, /^merry christmas/i,
  /^may god (bless|watch|also grant)/i, /^god (be with|save|is with|wins)/i, /^thank you (and|&) god bless/i,
  /^happy good friday/i, /^go with god/i, /^for god (and|&) country/i, /^in god we trust/i, /^god forever bless/i]
const MIXED = [[/^(god ?bless)( and | & )(stay safe|be safe)\.?$/i, 'God bless', 'stay safe'],
  [/^(good luck)( and | & )(god bless)!?$/i, 'God Bless', 'Good luck']]
const REL_DIRECTIVE = [/^pray\b/i, /^please pray/i, /^if you are religious,? pray/i, /^never stop praying/i,
  /^read the bible/i, /^pray for (strength|guidance|america|the victims)/i,
  /^find peace (\[solace\] )?through prayer/i, /^to all americans, please pray/i, /^let us salute and pray/i, /^keep praying/i]
const RELIGIOUS = /\bgod\b|\blord\b|\bjesus\b|\bchrist\b|\bpray|\bamen\b|\bbless|\bbibl|\bscriptur|\bholy\b|\bsatan|\bdevil|\bfaith\b|\bchurch|\bheaven|\bworship|\bdivine\b/i
const IMPERATIVE = /^(pray|read|find|keep|stay|think|watch|listen|learn|remember|look|note|define|expand|ask|trust|follow|be |do |go |let |never |always |please |use |apply |review |consider |protect|prepare|stand|fight|vote|share|help|make |take |put |get |see |know )/i

const quotedMap = text => { try { const r = sourceLines(text); return r instanceof Map ? r : new Map() } catch { return new Map() } }

const rows = []
for (const p of posts) {
  const reqs = p.actionRequests ?? []
  if (!reqs.length) continue
  const text = clean(p.text ?? '')
  const lines = text.split(String.fromCharCode(10))
  const q = quotedMap(text)
  const seen = new Map()                       // phrase -> how many of it we've consumed

  reqs.forEach((req, idx) => {
    const sentence = norm(typeof req === 'string' ? req : (req.text ?? req.sentence ?? ''))
    if (!sentence) return
    const needle = lo(sentence)
    const hits = []
    lines.forEach((l, i) => { if (lo(l).includes(needle)) hits.push({ line: i, quoted: q.has(i) }) })

    // Same wording twice in one drop: consume matches in order, so the second directive maps to
    // the second occurrence rather than both collapsing onto the first.
    const nth = seen.get(needle) ?? 0
    seen.set(needle, nth + 1)
    const anchored = hits[nth] ?? null

    let state, sourceType = 'q_post_body', originalPostNum = ''
    if (!hits.length) { state = 'NOT_LOCATED'; sourceType = 'not_located' }
    else if (anchored) {
      state = anchored.quoted ? 'QUOTED_OR_EMBEDDED' : 'Q_AUTHORED_CURRENT_POST'
    } else if (hits.every(h => h.quoted)) state = 'QUOTED_OR_EMBEDDED'
    else if (hits.every(h => !h.quoted)) state = 'Q_AUTHORED_CURRENT_POST'
    else { state = 'AMBIGUOUS_MULTIPLE_MATCHES'; sourceType = 'ambiguous' }

    if (state === 'QUOTED_OR_EMBEDDED') {
      const at = (anchored ?? hits[0]).line
      // A >>NNNN backreference above the span that resolves to a real Q drop means Q is quoting
      // HIMSELF — the command was authored, just not here.
      let prior = ''
      for (let i = at; i >= 0 && i > at - 12; i--) {
        const m = lines[i].match(/>>(\d{2,8})/)
        if (m) { const ref = posts.find(x => String(x.id) === m[1] || String(x.postNum) === m[1]); if (ref) { prior = ref.postNum; break } }
      }
      if (SCRIPTURE.some(rx => rx.test(sentence))) sourceType = 'QUOTED_SCRIPTURE'
      else if (PRAYER.some(rx => rx.test(sentence))) sourceType = 'QUOTED_PRAYER'
      else if (prior) { sourceType = 'QUOTED_PRIOR_Q_POST'; originalPostNum = prior }
      else sourceType = 'QUOTED_ANONYMOUS_POST'
    }

    let ruling, relSeg = '', dirSeg = ''
    const mix = MIXED.find(([rx]) => rx.test(sentence))
    if (state === 'NOT_LOCATED') ruling = 'NEEDS_CONTEXT'
    else if (state === 'AMBIGUOUS_MULTIPLE_MATCHES') ruling = 'NEEDS_CONTEXT'
    else if (mix && state === 'Q_AUTHORED_CURRENT_POST') { ruling = 'SPLIT_MIXED_SENTENCE'; relSeg = mix[1]; dirSeg = mix[2] }
    else if (state === 'QUOTED_OR_EMBEDDED') {
      ruling = sourceType === 'QUOTED_SCRIPTURE' ? 'REMOVE_QUOTED_SCRIPTURE'
        : sourceType === 'QUOTED_PRAYER' ? 'REMOVE_PRAYER_TEXT' : 'REMOVE_QUOTED_OR_THIRD_PARTY'
    }
    else if (PRAYER.some(rx => rx.test(sentence))) ruling = 'REMOVE_PRAYER_TEXT'
    else if (SCRIPTURE.some(rx => rx.test(sentence))) ruling = 'REMOVE_QUOTED_SCRIPTURE'
    else if (REL_DIRECTIVE.some(rx => rx.test(sentence))) ruling = 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME'
    else if (BLESSING.some(rx => rx.test(sentence))) ruling = 'REMOVE_BLESSING_OR_VALEDICTION'
    else if (RELIGIOUS.test(sentence) && !IMPERATIVE.test(sentence)) ruling = 'REMOVE_STATEMENT_OR_HEADING'
    else ruling = 'KEEP_Q_DIRECTIVE'

    rows.push({ postNum: p.postNum, recordId: `${p.postNum}#${idx}`, occurrenceIndex: idx,
      fullSentence: sentence, directivePhrase: dirSeg || sentence, religiousSegment: relSeg,
      lineIndex: anchored ? anchored.line : (hits[0]?.line ?? -1),
      authorshipState: state, sourceType, originalPostNum, ruling,
      religious: String(RELIGIOUS.test(sentence)) })
  })
}

const tally = {}, states = {}
for (const r of rows) { tally[r.ruling] = (tally[r.ruling] ?? 0) + 1; states[r.authorshipState] = (states[r.authorshipState] ?? 0) + 1 }
console.log('\nDIRECTIVES AUDIT v2\n\n  authorship states:')
for (const [k, v] of Object.entries(states).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log('\n  rulings:')
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`)

// ── diff against v1 ──────────────────────────────────────────────────────────
const v1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/directives-religious-adjudication.json'), 'utf8'))
const v1by = new Map(v1.rows.map(r => [`${r.post}#${r.index}`, r.ruling]))
const changed = rows.filter(r => v1by.get(r.recordId) && v1by.get(r.recordId) !== r.ruling)
console.log(`\n  rulings changed from v1 : ${changed.length} of ${rows.length}`)
const moves = {}
for (const r of changed) { const k = `${v1by.get(r.recordId)} -> ${r.ruling}`; moves[k] = (moves[k] ?? 0) + 1 }
for (const [k, v] of Object.entries(moves).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`      ${String(v).padStart(4)}  ${k}`)

// ── regression suite ─────────────────────────────────────────────────────────
const find = (pn, frag) => rows.find(r => r.postNum === pn && lo(r.fullSentence).includes(lo(frag)))
let fails = 0
const T = (label, ok, got) => { if (!ok) fails++; console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${got}`) }
console.log('\n  regression suite:')
const r146 = find(146, 'Pray.')
T('#146 "Pray." is Q-authored', r146?.authorshipState === 'Q_AUTHORED_CURRENT_POST', r146?.authorshipState ?? 'absent')
T('#146 "Pray." keeps Directive + Religion', r146?.ruling === 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', r146?.ruling ?? 'absent')
const r147 = find(147, 'Pray.')
T('#147 "Pray." is quoted, not a new directive', r147 ? r147.authorshipState === 'QUOTED_OR_EMBEDDED' : true, r147 ? `${r147.authorshipState}/${r147.sourceType}` : 'not a directive record')
const r3 = find(3, "tweeting about removal")
T('#3 sentence is Q-authored, not quoted', r3?.authorshipState === 'Q_AUTHORED_CURRENT_POST', r3?.authorshipState ?? 'absent')
T('NOT_LOCATED never becomes quoted', rows.every(r => r.authorshipState !== 'NOT_LOCATED' || r.sourceType === 'not_located'), 'held')
T('NOT_LOCATED always routes to NEEDS_CONTEXT', rows.every(r => r.authorshipState !== 'NOT_LOCATED' || r.ruling === 'NEEDS_CONTEXT'), 'held')
T('quoted Scripture detected as scripture', rows.some(r => r.sourceType === 'QUOTED_SCRIPTURE'), String(rows.filter(r => r.sourceType === 'QUOTED_SCRIPTURE').length))
T('prior-Q quotations identified', rows.some(r => r.sourceType === 'QUOTED_PRIOR_Q_POST'), String(rows.filter(r => r.sourceType === 'QUOTED_PRIOR_Q_POST').length))
const mixRows = rows.filter(r => r.ruling === 'SPLIT_MIXED_SENTENCE')
T('mixed sentence kept whole + segmented', mixRows.length > 0 && mixRows.every(r => r.religiousSegment && r.directivePhrase !== r.fullSentence), String(mixRows.length))
console.log(fails ? `\n   ${fails} regression check(s) FAILED` : '\n   all regression checks pass')

// ── count reconciliation ─────────────────────────────────────────────────────
const exactKeys = new Set(rows.map(r => `${r.postNum}|${r.fullSentence}`))
const ciKeys = new Set(rows.map(r => `${r.postNum}|${lo(r.fullSentence)}`))
console.log(`\n  raw occurrences            : ${rows.length}`)
console.log(`  exact per-post mentions    : ${exactKeys.size}`)
console.log(`  case/punct-insensitive     : ${ciKeys.size}`)
console.log(`  posts represented          : ${new Set(rows.map(r => r.postNum)).size}`)
console.log(`  page figure                : 2652`)
if (exactKeys.size - ciKeys.size) {
  const seenCI = new Map()
  for (const r of rows) { const k = `${r.postNum}|${lo(r.fullSentence)}`; if (!seenCI.has(k)) seenCI.set(k, []); if (!seenCI.get(k).includes(r.fullSentence)) seenCI.get(k).push(r.fullSentence) }
  console.log('\n  NORMALIZATION COLLISIONS (exact differs, normalized identical):')
  for (const [k, v] of seenCI) if (v.length > 1) console.log(`    #${k.split('|')[0]}  ${v.map(x => JSON.stringify(x)).join('   vs   ')}`)
}

fs.writeFileSync(path.join(ROOT, 'audit/directives-adjudication-v2.json'), JSON.stringify({ tally, states, rows }, null, 1))
const esc = s => `"${String(s).replace(/"/g, '""')}"`
const cols = ['postNum', 'recordId', 'occurrenceIndex', 'fullSentence', 'directivePhrase', 'religiousSegment', 'lineIndex', 'authorshipState', 'sourceType', 'originalPostNum', 'ruling', 'religious']
fs.writeFileSync(path.join(ROOT, 'audit/directives-adjudication-v2.csv'),
  [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c] ?? '')).join(','))].join('\n'))
console.log('\nwrote audit/directives-adjudication-v2.{json,csv}   — nothing applied')
