// The multi-word glossary matcher, proved as a pure function before any of it reaches a renderer.
//
//   node scripts/test-gloss-segments.mjs
//
// This exists because the first attempt at the fix lived inside applyGlossary's JSX, fixed #2401
// and broke BO and CM in #1828 — and finding that out cost a 90-second browser run per guess. The
// string work is now a pure function, and every case below runs in milliseconds against the REAL
// glossary and the REAL text of the drops involved.
//
// THE INVARIANT THAT MATTERS MOST is the last group: concatenating every segment must reproduce the
// input exactly. A matcher that loses, duplicates or reorders a character would corrupt a drop on
// screen, and no amount of token-level testing would catch it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/renderedMatch.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The module is plain TypeScript with no JSX, so Node's type stripping runs it directly.
const { segmentGloss, multiWordTokens } = await import(
  new URL('../src/lib/glossSegments.ts', import.meta.url).href)

const gloss = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'glossary.json'), 'utf8')).tokens
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const TOKENS = multiWordTokens(gloss)
const textOf = n => runtimeText(posts.find(p => p.postNum === n)?.text ?? '')

let failed = 0
const groups = []
let current = null
const group = name => { current = { name, rows: [] }; groups.push(current) }
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  current.rows.push({ ok, label, got, want })
}
const hits = (text) => segmentGloss(text, TOKENS).filter(s => s.token).map(s => s.token)
const spelled = (text) => segmentGloss(text, TOKENS).filter(s => s.token).map(s => s.text)

// ════════════════════════════════════════════════════════════════════════════
group('The glossary really does carry multi-word tokens')
check('19 multi-word tokens are present', TOKENS.length, 19)
check('and they are the ones expected', TOKENS.includes('WASH POST') && TOKENS.includes('NO NAME')
  && TOKENS.includes('SNOW WHITE') && TOKENS.includes('Wizards & Warlocks'), true)

// ════════════════════════════════════════════════════════════════════════════
group('#2401 — the drop the box was written for')
// All three "WASH POST"s sit inside larger Question marks, which is why the whole-node branch
// never fired and why the single-word splitter could never rebuild the name.
check('all three occurrences are found', hits(textOf(2401)).filter(t => t === 'WASH POST').length, 3)
check('and nothing else in the drop matches', [...new Set(hits(textOf(2401)))], ['WASH POST'])
check('the text is returned as the drop spells it', [...new Set(spelled(textOf(2401)))], ['WASH POST'])

// ════════════════════════════════════════════════════════════════════════════
group('#1828 — the drop the first attempt broke')
// "NO NAME" and "SUPREME COURT" both occur here, and BO and CM must go on being glossed by the
// single-word path in the gaps between them.
const s1828 = segmentGloss(textOf(1828), TOKENS)
check('the multi-word terms present are found', [...new Set(s1828.filter(s => s.token).map(s => s.token))].sort(),
  ['NO NAME', 'SUPREME COURT'])
check('BO survives in an unmatched gap', s1828.some(s => !s.token && /\bBO\b/.test(s.text)), true)
check('CM survives in an unmatched gap', s1828.some(s => !s.token && /\bCM\b/.test(s.text)), true)
check('every character of #1828 is preserved', s1828.map(s => s.text).join(''), textOf(1828))

// ════════════════════════════════════════════════════════════════════════════
group('#3004 — the DAG fixture moved here by the URL ruling')
check('DAG is left to the single-word path', hits(textOf(3004)).includes('DAG'), false)
check('#3004 is preserved exactly', segmentGloss(textOf(3004), TOKENS).map(s => s.text).join(''), textOf(3004))

// ════════════════════════════════════════════════════════════════════════════
group('All 19 tokens match themselves, alone and in a sentence')
{
  const alone = TOKENS.filter(t => hits(t).length !== 1 || hits(t)[0] !== t)
  check('each token matches when it is the whole string', alone, [])
  const inSentence = TOKENS.filter(t => !hits(`Why is the ${t} involved?`).includes(t))
  check('each token matches inside a sentence', inSentence, [])
  const punctuated = TOKENS.filter(t => !hits(`[${t}], and more.`).includes(t))
  check('each token matches when bracketed and followed by a comma', punctuated, [])
}

// ════════════════════════════════════════════════════════════════════════════
group('Boundaries — no partial-word or substring matches')
check('NO NAME does not match inside NO NAMED', hits('NO NAMED SOURCE'), [])
check('NO NAME does not match inside XNO NAME', hits('XNO NAME'), [])
check('WASH POST does not match WASH POSTED', hits('WASH POSTED today'), [])
check('a single word of a term is not a match', hits('the WASH is here'), [])
check('the words must be adjacent', hits('WASH and POST'), [])
check('word order matters', hits('POST WASH'), [])

// ════════════════════════════════════════════════════════════════════════════
group('Whitespace, case and repeats')
check('a line break between the words still matches', hits('the WASH\nPOST said'), ['WASH POST'])
check('doubled spaces still match', hits('the WASH  POST said'), ['WASH POST'])
check('the drop spelling is returned, not the token', spelled('the WASH\nPOST said'), ['WASH\nPOST'])
check('lower case matches and resolves to the canonical key', hits('the wash post said'), ['WASH POST'])
check('mixed case too', hits('the Wash Post said'), ['WASH POST'])
check('repeats in one string are each found',
  hits('WASH POST here, WASH POST there, and WASH POST again'), ['WASH POST', 'WASH POST', 'WASH POST'])
check('two different terms in one string',
  hits('SNOW WHITE and the WASH POST'), ['SNOW WHITE', 'WASH POST'])

// ════════════════════════════════════════════════════════════════════════════
group('Overlaps resolve longest-first')
check('ABC NEWS wins over a shorter overlapping alternative', hits('ABC NEWS reported'), ['ABC NEWS'])
check('an ampersand term matches literally', hits('Wizards & Warlocks'), ['Wizards & Warlocks'])
check('a regex metacharacter in a token is escaped, not interpreted', hits('Wizards X Warlocks'), [])

// ════════════════════════════════════════════════════════════════════════════
group('The cover property — no character may be lost, duplicated or moved')
{
  const corpus = [2401, 1828, 3004, 88, 100, 534, 1990, 2943, 4653]
  const broken = corpus.filter(n => segmentGloss(textOf(n), TOKENS).map(s => s.text).join('') !== textOf(n))
  check('every sampled drop round-trips exactly', broken, [])
  // And across the WHOLE corpus, because a cover failure anywhere corrupts a drop on screen.
  const all = posts.filter(p => {
    const t = runtimeText(p.text ?? '')
    return segmentGloss(t, TOKENS).map(s => s.text).join('') !== t
  }).map(p => p.postNum)
  check('all 4,966 drops round-trip exactly', all, [])
  check('an empty string is handled', segmentGloss('', TOKENS), [{ text: '', token: null }])
  check('text with no match returns one unmatched segment', segmentGloss('nothing here', TOKENS),
    [{ text: 'nothing here', token: null }])
}

// ── report ──────────────────────────────────────────────────────────────────
console.log('\nMULTI-WORD GLOSSARY SEGMENTATION\n')
let n = 0
for (const g of groups) {
  console.log(`  ${g.name}`)
  for (const r of g.rows) {
    n++
    console.log(`    ${r.ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(60)}${r.ok ? '' : ` got ${JSON.stringify(r.got)} want ${JSON.stringify(r.want)}`}`)
  }
  console.log('')
}
console.log(`  ${failed ? `❌ ${failed} of ${n} failed` : `✅ all ${n} cases pass`}\n`)
process.exit(failed ? 1 : 0)
