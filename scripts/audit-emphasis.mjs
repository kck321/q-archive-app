// Emphasis audit — a presentation layer, detected one signal at a time.
//
// Each category runs SEPARATELY and reports its own count, so no single detector can swallow
// the section. That matters most for capitals: Q writes in caps constantly, so caps are only
// emphatic where they CONTRAST with the text around them.
//
// Excluded by name, each one a real over-count risk found in earlier audits:
//   codes already certified in Codes & Brackets  — 739 of them
//   headings and titles, which are formatting
//   ordinary acronyms, which are names
//   repetition inside quoted source material, which is the source repeating itself
//   anything that requires INTERPRETATION rather than pointing at a device on the page
//
// AUDIT ONLY — no production write, no deploy. Seven certified sections frozen.
//
//   node scripts/audit-emphasis.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import {
  EMPHASIS_TYPES, capsShare, CAPS_WORD, PUNCT_RUN, SPACED_OUT, QUOTED_WORD, MARKUP,
  HEADING_LIKE, ORDINARY_ACRONYM, ROMAN_NUMERAL,
  classifyParallel, parallelBasis, pWords, pNorm,
  BORDERLINE_CAPS_LO, BORDERLINE_CAPS_HI, BORDERLINE_NEEDS_LINE_CAPS_UNDER,
} from './lib/emphasis.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const codes = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/codes.json'), 'utf8'))

// Anything already certified as a code is not also an emphasis device.
const codeKeys = new Set(codes.codes.flatMap(c => c.sourceTexts.map(t => t.toUpperCase())))

// A NAME in capitals is a name, not a highlight. Q writes HRC, MUELLER, FISA, SESSIONS and
// HUSSEIN in caps as a naming convention, and counting those as emphasis put entity mentions
// at the top of this section — 114 for HRC alone. Every certified entity name and alias is
// excluded, which is the same reasoning as the ordinary-acronym rule, generalised.
const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8'))
const entityNames = new Set()
for (const e of entities.entities) {
  entityNames.add(e.canonical.toUpperCase())
  for (const a of e.aliases) entityNames.add(String(a.text).toUpperCase())
}

// The second contrast test, and the one no word list could have produced.
//
// DECLAS, CLAS, NAT, MIL, IDEN, VIP and C19 survived every exclusion above and are still not
// emphasis: Q writes those words in capitals EVERY time, so the capitals are the word's normal
// spelling and there is nothing to contrast with. FAKE, TRUTH and POWER appear in lowercase all
// over the corpus, which is what makes their capitalised form a choice.
//
// So: measure each word against its own usage. A word that is capitalised in at least 90% of its
// appearances is being spelled, not emphasised. This is read off the corpus, not declared.
const caseCounts = new Map()
for (const p of posts) {
  for (const w of clean(p.text ?? '').match(/\b[A-Za-z][A-Za-z0-9]{2,}\b/g) ?? []) {
    const k = w.toUpperCase()
    const rec = caseCounts.get(k) ?? { caps: 0, total: 0 }
    if (w === k) rec.caps++
    rec.total++
    caseCounts.set(k, rec)
  }
}
const ALWAYS_CAPS = new Set()
const BORDERLINE = new Set()
for (const [w, r] of caseCounts) {
  if (r.total < 4) continue
  const share = r.caps / r.total
  if (share >= BORDERLINE_CAPS_HI) ALWAYS_CAPS.add(w)
  else if (share >= BORDERLINE_CAPS_LO) BORDERLINE.add(w)
}

const found = []
const excluded = { alreadyACode: 0, heading: 0, acronym: 0, alwaysCaps: 0, borderlineCaps: 0,
  weakParallel: 0, parallelArtifact: 0, quotedSource: 0, capsBaseline: 0 }
const borderline = []

for (const p of posts) {
  const cleaned = clean(p.text ?? '')
  const src = sourceLines(cleaned)
  const lines = cleaned.split('\n')
  const qLines = lines.filter((_, i) => !src.has(i))
  const postCaps = capsShare(qLines.join(' '))

  const add = (type, sourceText, line, note) => found.push({
    postNum: p.postNum, postId: p.id, type, sourceText, line: line.trim(), note,
    provenance: 'Emphasis audit v1 — Q-authored lines only',
  })

  lines.forEach((raw, i) => {
    if (src.has(i)) { excluded.quotedSource++; return }
    const line = raw.trim()
    if (!line) return

    // 1 — bracket emphasis: an ordinary word in brackets. The Codes audit already set these
    // aside as NOT codes, which makes them the strongest seed this section has.
    for (const m of line.match(/\[[a-z][a-z\s'’-]{0,30}\]/g) ?? []) {
      if (codeKeys.has(m.toUpperCase())) { excluded.alreadyACode++; continue }
      add('bracket_emphasis', m, line)
    }

    // 2 — capitals, but only where they CONTRAST. A caps word inside a line that is itself
    // mostly capitals is Q's register; the same word inside a lowercase line is a highlight.
    // Capitals INSIDE brackets are the bracket's business, not this section's. [CLAS 1-99],
    // [IDEN], [SURV] and [MIL] are Q's bracket notation; counting the word inside as well put
    // CLAS and DECLAS in the top five caps words when both are already certified codes.
    const bracketed = new Set()
    for (const b of line.match(/\[[^\]]*\]/g) ?? []) for (const w of b.match(CAPS_WORD) ?? []) bracketed.add(w)

    const lineCaps = capsShare(line)
    if (lineCaps < 0.6 && postCaps < 0.6) {
      for (const m of line.match(CAPS_WORD) ?? []) {
        if (bracketed.has(m)) { excluded.alreadyACode++; continue }
        if (ROMAN_NUMERAL.test(m)) { excluded.acronym++; continue }
        if (ALWAYS_CAPS.has(m.toUpperCase())) { excluded.alwaysCaps++; continue }
        if (codeKeys.has(m.toUpperCase())) { excluded.alreadyACode++; continue }
        if (ORDINARY_ACRONYM.test(m) || entityNames.has(m.toUpperCase())) { excluded.acronym++; continue }
        if (HEADING_LIKE.test(line)) { excluded.heading++; continue }

        // Weak contrast: a token capitalised 80–89% of the time is close to being spelled that
        // way. COVID and MIL sit here. It counts only where the surrounding line is genuinely
        // lowercase prose, so the capitals visibly stand out; otherwise it is a judgement call
        // and goes to the queue rather than into the certified count.
        if (BORDERLINE.has(m.toUpperCase()) && lineCaps >= BORDERLINE_NEEDS_LINE_CAPS_UNDER) {
          excluded.borderlineCaps++
          borderline.push({ postNum: p.postNum, postId: p.id, kind: 'caps', sourceText: m, line })
          continue
        }
        add('caps_emphasis', m, line, `the line is ${Math.round(lineCaps * 100)}% capitals, so this word stands out`)
      }
    } else if (lineCaps >= 0.6) excluded.capsBaseline++

    if (PUNCT_RUN.test(line)) add('punctuation_intensity', (line.match(/[?!]{2,}/) ?? [''])[0], line)
    if (SPACED_OUT.test(line)) add('deliberate_spacing', (line.match(SPACED_OUT) ?? [''])[0], line)
    if (QUOTED_WORD.test(line) && line.split(/\s+/).length > 2) add('quoted_word', (line.match(QUOTED_WORD) ?? [''])[0], line)
    if (MARKUP.test(raw)) add('preserved_markup', (raw.match(MARKUP) ?? [''])[0], line)
  })

  // 3 — repetition, measured across the drop rather than within a line.
  const counts = new Map()
  for (const l of qLines.map(x => x.trim()).filter(Boolean)) {
    const k = key(l)
    if (!k || k.length < 3) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  for (const [k, n] of counts) {
    if (n < 2) continue
    const example = qLines.map(x => x.trim()).find(x => key(x) === k) ?? ''
    const type = /\?$/.test(example) ? 'repeated_question'
      : /^(follow|think|read|watch|trust|learn|expand|find|dig|remember|be|stay|do not|don'?t)\b/i.test(example) ? 'repeated_directive'
        : 'repeated_word'
    add(type, example, example, `repeated ${n} times in this drop`)
  }

  // 4 — parallel phrasing, rebuilt around RUNS rather than pairs.
  //
  // v1 emitted one hit per adjacent pair sharing a first word, which both over-counted (a
  // five-line cascade became four separate hits) and under-tested (a shared opener is weak
  // evidence on its own). A run is what a reader actually perceives as one device, so a run is
  // one occurrence — and it is only certified where classifyParallel finds a real repeated
  // pattern. Everything else goes to the queue instead of into the count.
  const indexed = lines.map((l, i) => ({ l: l.trim(), i })).filter(x => x.l && !src.has(x.i))
  let run = []
  const closeRun = () => {
    if (run.length >= 2) {
      const ls = run.map(x => x.l)
      const verdict = classifyParallel(ls)
      if (verdict === 'TRUE_PARALLEL_EMPHASIS') {
        add('parallel_phrasing', `${pNorm(pWords(ls[0])[0])} …`, ls.join(' / '), parallelBasis(ls))
      } else if (verdict === 'QUESTION_SERIES_WITHOUT_EXTRA_EMPHASIS' || verdict === 'NEEDS_CONTEXT') {
        excluded.weakParallel++
        borderline.push({ postNum: p.postNum, postId: p.id, kind: 'parallel', verdict, sourceText: ls.join(' / '), line: ls.join(' / ') })
      } else excluded.parallelArtifact++
    }
    run = []
  }
  for (const x of indexed) {
    const prev = run.length ? run[run.length - 1] : null
    if (prev && x.i === prev.i + 1 && pNorm(pWords(x.l)[0] ?? '') === pNorm(pWords(prev.l)[0] ?? '') && x.l !== prev.l) run.push(x)
    else { closeRun(); run = [x] }
  }
  closeRun()
}

const byType = {}
for (const f of found) byType[f.type] = (byType[f.type] ?? 0) + 1
const postsWith = new Set(found.map(f => f.postNum))

const totals = {
  occurrences: found.length,
  posts: postsWith.size,
  byType,
  excluded,
}
fs.writeFileSync(path.join(OUT, 'emphasis-borderline.json'), JSON.stringify({ count: borderline.length, items: borderline }, null, 1))
fs.writeFileSync(path.join(OUT, 'emphasis-audit.json'), JSON.stringify({ scope: 'full-corpus emphasis audit v1', productionChanged: false, totals, found }, null, 1))

const md = ['# Q Drops — Emphasis audit (v1, candidate)\n']
md.push('A presentation layer: **how** Q draws attention, not what a post is about and not whether the highlighted material is a code. **No production write, no deploy.**\n')
md.push('\n## The rule that keeps capitals from swallowing the section\n')
md.push('Q writes in capitals constantly, so a caps detector alone would tag most of the corpus. **Emphasis is CONTRAST**: a capitalised word inside a lowercase line is a highlight; a caps line inside an all-caps post is Q’s baseline register. Lines and posts at 60% capitals or more are excluded on that basis alone.\n')
md.push('\nAnd nothing is recorded that a reader cannot see. "Cryptic messaging" was the old extractor’s most common label at 401, and it is an interpretation — there is no device on the page to point at. Only brackets, repetitions, punctuation runs and spacing count.\n')
md.push('\n## Totals\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Emphasis occurrences | **${totals.occurrences.toLocaleString()}** |`)
md.push(`| Posts | ${totals.posts.toLocaleString()} |`)
md.push('\n### By type\n')
md.push('| Type | Occurrences | What it is |')
md.push('|---|---|---|')
for (const t of EMPHASIS_TYPES) {
  if (!byType[t.key]) continue
  md.push(`| ${t.label} | ${byType[t.key].toLocaleString()} | ${t.blurb} |`)
}
md.push('\n## Excluded, and why\n')
md.push('| Excluded | Count | Why |')
md.push('|---|---|---|')
md.push(`| Already a certified code | ${excluded.alreadyACode.toLocaleString()} | belongs to Codes & Brackets |`)
md.push(`| Caps that are Q’s baseline register | ${excluded.capsBaseline.toLocaleString()} | a caps line inside an all-caps post is not a highlight |`)
md.push(`| Quoted source lines | ${excluded.quotedSource.toLocaleString()} | repetition in pasted material is the source repeating itself |`)
md.push(`| Ordinary acronyms | ${excluded.acronym.toLocaleString()} | FBI and DOJ are names, not highlights |`)
md.push(`| Words Q always capitalises | ${excluded.alwaysCaps.toLocaleString()} | DECLAS and CLAS have no lowercase form to contrast with |`)
md.push(`| Parallel runs without a repeated pattern | ${excluded.weakParallel.toLocaleString()} | a shared first word alone is weak evidence |`)
md.push(`| Borderline capitalisation | ${excluded.borderlineCaps.toLocaleString()} | COVID and MIL are capitalised 80-89% of the time, which is weak contrast |`)
md.push(`| List and layout runs | ${excluded.parallelArtifact.toLocaleString()} | bullets and >> reference lists are layout, not rhetoric |`)
md.push(`| Headings | ${excluded.heading.toLocaleString()} | formatting, not emphasis |`)
md.push('\n## Examples\n')
for (const t of EMPHASIS_TYPES) {
  const list = found.filter(f => f.type === t.key)
  if (!list.length) continue
  md.push(`\n**${t.label}** (${list.length.toLocaleString()})\n`)
  md.push('| Post | Device | Line |')
  md.push('|---|---|---|')
  for (let i = 0; i < Math.min(6, list.length); i++) {
    const f = list[Math.floor(i * list.length / Math.min(6, list.length))]
    md.push(`| #${f.postNum} | \`${String(f.sourceText).replace(/\|/g, '\\|').slice(0, 30)}\` | ${String(f.line).replace(/\|/g, '\\|').slice(0, 70)} |`)
  }
}
fs.writeFileSync(path.join(OUT, 'emphasis-audit.md'), md.join('\n') + '\n')

console.log('\nEMPHASIS AUDIT v1\n')
console.log(`  occurrences : ${totals.occurrences.toLocaleString()}`)
console.log(`  posts       : ${totals.posts.toLocaleString()}`)
console.log('\n  by type:')
for (const t of EMPHASIS_TYPES) if (byType[t.key]) console.log(`    ${String(byType[t.key]).padStart(5)}  ${t.label}`)
console.log('\n  excluded:')
for (const [k, n] of Object.entries(excluded)) console.log(`    ${String(n).padStart(5)}  ${k}`)
console.log('\n→ audit/emphasis-audit.md\n')
