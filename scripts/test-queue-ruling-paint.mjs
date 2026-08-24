// The 2026-08-20 queue ruling, AT THE SURFACE THE OWNER NAMED.
//
//   node scripts/test-queue-ruling-paint.mjs [baseUrl] [--fresh]
//
// The owner asked for two things and this asserts both, in a browser, on BOTH pages:
//
//   1. a ruled sentence carries its section's colour in the drop body — /post/:id AND /posts
//   2. an entity or a bracket inside that sentence keeps ITS OWN colour on top of it
//
// WHY A BROWSER AND NOT THE DATA. Every count in this batch already reconciles; a count is not a
// highlight. This project has shipped a correct dataset that painted nothing more than once —
// /posts rendered no brackets at all while /post/:id did, and 593 highlights ran past their
// certified boundary — and each time the artifact-level check said everything was fine. The two
// surfaces are asserted together for the same reason: they have drifted apart before, and a fix
// applied to one of them is exactly how the last drift lasted a day.
//
// COLOUR IS READ FROM THE TAILWIND CLASS the renderer actually emits, so a change to
// HIGHLIGHT_CLS that forgets a surface fails here rather than passing on a stale constant.
import { launch, DROP_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

// The fill each section paints, as it appears in the emitted class list.
const FILL = {
  claim: 'bg-amber-500',
  prediction: 'bg-violet-500',
  request: 'bg-green-500',        // Q Directives
  question: 'bg-blue-500',
  namedEntity: 'bg-cyan-500',
  bracketCode: 'bg-red-800',
}

// ON TOP MEANS SOLID — owner rule, 2026-08-24.
//
// An Entity or a Bracket covering the same characters as another category renders with an OPAQUE
// fill instead of the translucent one, so nothing shows through and the front layer is
// unmistakable. That is exactly what the `inside` column of every case below is testing, so the
// on-top assertion wants the SOLID class specifically: accepting the translucent one would let the
// rule quietly regress to the muddy blend it replaced.
const SOLID = {
  namedEntity: 'bg-cyan-300',
  bracketCode: 'bg-red-700',
}

// post · the ruled sentence · the fill it must carry · an inline span inside it and ITS fill.
//
// Every row is a real ruling from audit/unhighlighted-owner-rulings.json. The `inside` column is
// what makes this test about layering rather than about one colour: if the sentence fill were
// painted over the whole line, the entity and the bracket would vanish under it, which is exactly
// the defect a question container had on /posts until it was fixed.
const CASES = [
  // Claims — the bulk of the batch.
  { post: 2, text: 'Fantasy.', fill: 'claim' },
  { post: 3, text: 'Gowdy comments on Comey (history will ....)', fill: 'claim', inside: { text: 'Comey', fill: 'namedEntity' } },
  { post: 128, text: '[C]oordinated effort to misdirect.', fill: 'claim', inside: { text: '[C]', fill: 'bracketCode' } },
  { post: 111, text: 'Fantasy land.', fill: 'claim' },
  { post: 88, text: 'Ten days.', fill: 'claim' },

  // Predictions.
  { post: 364, text: 'Dark [10].', fill: 'prediction', inside: { text: '[10]', fill: 'bracketCode' } },
  { post: 830, text: 'BOOM.', fill: 'prediction' },
  { post: 1546, text: 'PAIN.', fill: 'prediction' },

  // Directives.
  { post: 2, text: 'God bless fellow Patriots.', fill: 'request' },
  { post: 972, text: 'Shine the LIGHT BRIGHT [DOA].', fill: 'request', inside: { text: '[DOA]', fill: 'bracketCode' } },
  { post: 3613, text: 'Logical thinking.', fill: 'request' },

  // Questions — most of these end in a full stop, which is Q's habit and which
  // certifiedQuestionRegex has always matched.
  { post: 3, text: 'Don’t you think POTUS would be tweeting about removal given clear conflict.', fill: 'question',
    inside: { text: 'POTUS', fill: 'namedEntity' } },
  { post: 666, text: 'Stock market DIVE [666 - coincidence?].', fill: 'question', inside: { text: '[666 - coincidence?]', fill: 'bracketCode' } },

  // Entities — the ruling names an inline span, so the whole line is the entity.
  { post: 3, text: 'Operation Mockingbird.', fill: 'namedEntity' },
  { post: 158, text: 'Iron Eagle.', fill: 'namedEntity' },
  // The drop writes this line with a BANG, not a full stop. fillsOver() requires the body to
  // contain `want` verbatim before it will read any mark, so the period spelling reported
  // "no mark" on a drop that paints the entity correctly — a bug in the case, not the app.
  { post: 533, text: 'WE, THE PEOPLE!', fill: 'namedEntity' },

  // Brackets.
  { post: 392, text: '[HAITI].', fill: 'bracketCode' },
  { post: 1334, text: '[SIS Good].', fill: 'bracketCode' },
]

/**
 * The fills painted over `needle` inside the rendered drop body.
 *
 * Walks the <mark> elements rather than the text, because that is what a colour IS here: a mark
 * whose class carries the fill. Matching on innerText alone would call a sentence "painted"
 * because some other mark elsewhere in the drop happened to contain the words.
 */
const SEP = '~~|~~'      // printable, and no Tailwind class or Q sentence contains it
const ROW = '~~||~~'

const fillsOver = needle => `(() => {
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim()
  const want = norm(${JSON.stringify(needle)})
  const bodies = [...document.querySelectorAll('pre[class*="post-text"], .post-text, [data-post-body]')]
  const scope = bodies.length ? bodies : [document.body]
  const out = []
  for (const b of scope) {
    if (!norm(b.innerText).includes(want)) continue
    for (const m of b.querySelectorAll('mark')) {
      const t = norm(m.innerText)
      if (!t) continue
      if (want.includes(t) || t.includes(want)) out.push(m.className + ${JSON.stringify(SEP)} + t)
    }
  }
  return out.join(${JSON.stringify(ROW)})
})()`

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(64)} ${got}`) }

console.log(`\nQUEUE RULING — PAINT ON BOTH SURFACES  (${mode}${browser.reused ? ', reused' : ''})\n`)

for (const c of CASES) {
  // The Post Archive is asked for the drop by number so the row is on screen without scrolling.
  const surfaces = [
    ['post', `${BASE}/post/${c.post}`],
    ['archive', `${BASE}/posts?q=${encodeURIComponent(String(c.post))}`],
  ]
  for (const [where, url] of surfaces) {
    const page = await browser.page(url)
    try {
      await page.waitFor(where === 'post' ? DROP_READY : `document.body.innerText.length > 400 ? 1 : 0`, { timeout: 60000 })
      // Wait for the SENTENCE, not for the page: highlights are applied after the seed lands, and
      // querying on body-ready reports a feature broken when the test was simply early.
      const raw = await page.waitFor(fillsOver(c.text), { timeout: 25000 }).catch(() => '')
      const marks = String(raw || '').split(ROW).filter(Boolean)
        .map(s => { const [cls, txt] = s.split(SEP); return { cls, txt } })

      // A ruled span that is ITSELF an entity or a bracket may legitimately be solid too, when
      // something else covers it — #533's "WE, THE PEOPLE!" is both an entity and a directive.
      const want = FILL[c.fill]
      const painted = marks.some(m => m.cls.includes(want) || (SOLID[c.fill] && m.cls.includes(SOLID[c.fill])))
      check(painted, `#${c.post} ${where}: "${c.text.slice(0, 34)}" paints ${c.fill}`,
        painted ? want : (marks.map(m => m.cls.split(' ')[0]).join(',') || 'no mark'))

      if (c.inside) {
        const insideWant = SOLID[c.inside.fill] ?? FILL[c.inside.fill]
        const innerRaw = await page.evaluate(fillsOver(c.inside.text)).catch(() => '')
        const inner = String(innerRaw || '').split(ROW).filter(Boolean)
          .map(s => { const [cls, txt] = s.split(SEP); return { cls, txt } })
        // The inline layer must be ON TOP: a mark whose own text is the entity or the bracket,
        // carrying that layer's fill — not the sentence fill spread across it.
        const onTop = inner.some(m => m.cls.includes(insideWant))
        check(onTop, `#${c.post} ${where}:   "${c.inside.text}" is ${c.inside.fill}, SOLID, on top`,
          onTop ? insideWant : (inner.map(m => m.cls.split(' ')[0]).join(',') || 'not painted'))
      }
    } finally {
      await page.close()
    }
  }
}

console.log(`\n  ${failed ? `${failed} FAILED` : 'all checks passed'}\n`)
await browser.close()
process.exit(failed ? 1 : 0)
