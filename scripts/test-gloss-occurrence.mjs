// Mapping a glossary term back onto the segments the annotation layer cut it into.
//
//   node scripts/test-gloss-occurrence.mjs
//
// The pure half of the split-term work. `test-gloss-segments.mjs` proves the phrase can be FOUND in
// a run of text; this proves it can be found when there is no run of text — when the certified
// intervals have already broken the line into siblings and the phrase spans two or three of them.
//
// Every case here is character arithmetic, so it runs in milliseconds and can be exhaustive. The
// browser test that follows it can then spend its 90 seconds a run on the things only a browser
// knows: whether the box opens, whether a keyboard reaches it, and whether a control ended up
// inside another control.
//
// THE INVARIANT THAT MATTERS MOST, again, is reassembly: the parts of a plan must concatenate back
// to the matched text, and every part must lie inside the sibling it names. A plan that is off by
// one character would mark the wrong word on screen, and no token-level check would notice.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/renderedMatch.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const { multiWordTokens } = await import(new URL('../src/lib/glossSegments.ts', import.meta.url).href)
const { planSplitOccurrences, occurrenceId } = await import(
  new URL('../src/lib/glossOccurrence.ts', import.meta.url).href)

const gloss = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'glossary.json'), 'utf8')).tokens
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const TOKENS = multiWordTokens(gloss)

let failed = 0
const groups = []
let current = null
const group = name => { current = { name, rows: [] }; groups.push(current) }
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  current.rows.push({ ok, label, got, want })
}
const plan = texts => planSplitOccurrences(texts, TOKENS)
/** Everything a plan claims, reduced to something readable. */
const shape = texts => plan(texts).map(p => ({
  token: p.token,
  parts: p.parts.map(x => `${x.index}[${x.start},${x.end})`).join(' + '),
  rebuilt: p.parts.map(x => texts[x.index].slice(x.start, x.end)).join(''),
}))

// ── the six terms, exactly as the renderers hand them over ──────────────────
//
// These sibling lists are not invented. Each one is the rendered segmentation read out of the live
// DOM for that drop, so a change in how the annotation layer cuts a line shows up here as a failing
// case rather than as a term that quietly stops having a box.
// 2026-08-26: the entity-synopsis sweep and the alias work before it normalised several glossary
// keys out of all-caps into their natural entity-canonical casing (matching is case-insensitive
// either way, so the rendered text and the reassembly are unaffected) and registered "THE CLINTON
// FOUNDATION" alongside the bare "CLINTON FOUNDATION" — a real, more specific multi-word term Q
// also writes, so the planner now correctly extends the match across the leading "THE " sibling
// too rather than starting at "CLINTON".
group('the six split terms, as the certified intervals actually split them')
{
  check('ABC NEWS — entity mark, then the rest of the phrase',
    shape(['ABC', ' NEWS']),
    [{ token: 'ABC News', parts: '0[0,3) + 1[0,5)', rebuilt: 'ABC NEWS' }])

  check('FOX NEWS — same shape, control on the first segment',
    shape(['Did you notice the ', 'FOX', ' NEWS', " coverage of 'Qanon' last night?"]),
    [{ token: 'Fox News', parts: '1[0,3) + 2[0,5)', rebuilt: 'FOX NEWS' }])

  check('ADAM SCHIFF — the control is on the SECOND segment',
    shape(['ADAM ', 'SCHIFF', ' IS PART OF THE ']),
    [{ token: 'Adam Schiff', parts: '0[0,5) + 1[0,6)', rebuilt: 'ADAM SCHIFF' }])

  check('CLINTON FOUNDATION — three marks, the leading "THE " now part of the match',
    shape(['THE ', 'CLINTON', ' FOUNDATION', '.']),
    [{ token: 'THE CLINTON FOUNDATION', parts: '0[0,4) + 1[0,7) + 2[0,11)', rebuilt: 'THE CLINTON FOUNDATION' }])

  check('ROD ROSENSTEIN — the space belongs to the first segment',
    shape([' REMOVAL OF ', 'ROD ', 'ROSENSTEIN', '.']),
    [{ token: 'Rod Rosenstein', parts: '1[0,4) + 2[0,10)', rebuilt: 'ROD ROSENSTEIN' }])

  check('SUPREME COURT — THREE segments, the middle one being the space',
    shape(['a majority in the ', 'SUPREME', ' ', 'COURT', ' [CONSTITUTION']),
    [{ token: 'Supreme Court', parts: '1[0,7) + 2[0,1) + 3[0,5)', rebuilt: 'SUPREME COURT' }])
}

// ── what must NOT be planned ────────────────────────────────────────────────
group('the cases that must stay on the untouched path')
{
  check('a phrase inside one sibling is not a split occurrence',
    shape(['all three ', 'WASH POST', ' in one node']), [])
  check('a single sibling can never split', shape(['SUPREME COURT']), [])
  check('an empty list plans nothing', shape([]), [])
  check('siblings with no term plan nothing', shape(['nothing ', 'to see ', 'here']), [])
  check('a term the drop spells across a line break is still one match',
    shape(['SUPREME', '\n', 'COURT']).map(p => p.rebuilt), ['SUPREME\nCOURT'])
  check('a partial word does not match across the boundary',
    shape(['SUPREMELY', ' COURTS']), [])
  check('NO NAME does not match inside NO NAMED',
    shape(['NO ', 'NAMED']), [])
  check('a zero-width overlap does not put a marker on an untouched sibling',
    shape(['', 'ADAM ', 'SCHIFF', '']).map(p => p.parts), ['1[0,5) + 2[0,6)'])
}

// ── identifiers ─────────────────────────────────────────────────────────────
group('the identifier every segment of one occurrence shares')
{
  check('derived from post, token and ordinal', occurrenceId(2462, 'SUPREME COURT', 0), 'qg-2462-supreme-court-0')
  check('punctuation folds into the slug', occurrenceId(144, 'Wizards & Warlocks', 1), 'qg-144-wizards-warlocks-1')
  check('the same inputs always give the same id',
    occurrenceId(2770, 'ABC NEWS', 1) === occurrenceId(2770, 'ABC NEWS', 1), true)
  check('different occurrences of one term differ',
    occurrenceId(2770, 'ABC NEWS', 0) === occurrenceId(2770, 'ABC NEWS', 1), false)
  check('different drops differ',
    occurrenceId(2770, 'ABC NEWS', 0) === occurrenceId(2401, 'ABC NEWS', 0), false)

  // ORDINALS COUNT EVERY OCCURRENCE, split or not. If they counted only the split ones, a drop
  // whose first "ABC NEWS" happened to be contiguous would renumber the second one the day an
  // annotation boundary moved, and the three segments would stop agreeing on their own name.
  check('an ordinal counts past a contiguous occurrence of the same term',
    plan(['ABC NEWS and then ', 'ABC', ' NEWS']).map(p => p.ordinal), [1])
  check('two split occurrences of one term number 0 and 1',
    plan(['ABC', ' NEWS x ', 'ABC', ' NEWS']).map(p => p.ordinal), [0, 1])
}

// ── the reassembly invariant, over every drop that carries a term ───────────
group('reassembly, across the whole corpus')
{
  // Each drop is cut at every character where a term begins or ends and at a few arbitrary points
  // besides, which stands in for whatever the annotation layer might do to it. Whatever the cuts,
  // a plan must rebuild the phrase exactly and stay inside the siblings it names.
  const bad = []
  let planned = 0
  let drops = 0
  for (const p of posts) {
    const text = runtimeText(p.text ?? '')
    if (!text) continue
    for (const width of [1, 3, 7, 40]) {
      const texts = []
      for (let i = 0; i < text.length; i += width) texts.push(text.slice(i, i + width))
      if (texts.length < 2) continue
      const joined = texts.join('')
      if (joined !== text) { bad.push(`#${p.postNum} w${width} sibling text lost`); continue }
      for (const occ of planSplitOccurrences(texts, TOKENS)) {
        planned++
        const rebuilt = occ.parts.map(x => texts[x.index].slice(x.start, x.end)).join('')
        if (rebuilt !== occ.text) bad.push(`#${p.postNum} w${width} ${occ.token}: rebuilt "${rebuilt}"`)
        if (occ.parts.length < 2) bad.push(`#${p.postNum} w${width} ${occ.token}: single part`)
        for (const x of occ.parts) {
          if (x.start < 0 || x.end > texts[x.index].length || x.start >= x.end) {
            bad.push(`#${p.postNum} w${width} ${occ.token}: part out of bounds`)
          }
        }
        for (let k = 1; k < occ.parts.length; k++) {
          if (occ.parts[k].index <= occ.parts[k - 1].index) bad.push(`#${p.postNum} ${occ.token}: parts out of order`)
        }
      }
    }
    drops++
  }
  check('every planned occurrence rebuilds its phrase exactly', bad.slice(0, 6), [])
  check(`plans were actually produced (a zero here would make the check vacuous)`, planned > 0, true)
  console.error(`    ${planned.toLocaleString()} split occurrences planned across ${drops.toLocaleString()} drops at 4 cut widths`)
}

// ── report ──────────────────────────────────────────────────────────────────
console.log('\nSPLIT GLOSSARY OCCURRENCES\n')
let n = 0
for (const g of groups) {
  console.log(`  ${g.name}`)
  for (const r of g.rows) {
    n++
    console.log(`    ${r.ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(62)}${r.ok ? '' : ` got ${JSON.stringify(r.got)} want ${JSON.stringify(r.want)}`}`)
  }
  console.log('')
}
console.log(`  ${failed ? `❌ ${failed} of ${n} failed` : `✅ all ${n} cases pass`}\n`)
process.exit(failed ? 1 : 0)
