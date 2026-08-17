// Multi-word glossary terms, driven in a real browser across every drop that carries one.
//
//   node scripts/test-multiword-gloss.mjs [baseUrl] [--fresh]
//
// The pure matchers are proved by scripts/test-gloss-segments.mjs (finding the phrase in text) and
// scripts/test-gloss-occurrence.mjs (mapping it onto the segments an annotation layer cut it into).
// This proves the half that only a browser can: that the box actually renders, that it renders
// INSIDE a larger annotation without destroying it, that the reader can reach it by keyboard and by
// touch, and — the one that a renderer fix most easily gets wrong — that no interactive control
// ends up nested inside another and no phrase costs a keyboard user more than one stop.
//
// The first attempt at this fix passed a spot check on #2401 and silently broke BO and CM in
// #1828. So coverage here is not a sample: every one of the 19 multi-word tokens is exercised, and
// the drops that regressed are asserted by name.
//
// TWO SHAPES, BOTH CORRECT, NEITHER OPTIONAL:
//
//   contiguous   the phrase survives into one text node and becomes one button, as before
//   split        the certified intervals cut it up, and the ruling applies — every segment marked
//                with one occurrence id, exactly one of them interactive, the leftmost existing
//                control reused where there is one and its card extended rather than replaced
//
// A NOTE ON BACKTICKS. Every page expression below is a template literal. An earlier revision of
// this file quoted attribute names in backticks inside one of those comments, which terminated the
// literal — the file did not parse, and a mobile check that had never executed was reported as
// passing. Nothing inside a page expression may contain a backtick.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './lib/browser.mjs'
import { runtimeText } from './lib/renderedMatch.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { segmentGloss, multiWordTokens } = await import(new URL('../src/lib/glossSegments.ts', import.meta.url).href)
const { occurrenceId } = await import(new URL('../src/lib/glossOccurrence.ts', import.meta.url).href)

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const gloss = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'glossary.json'), 'utf8')).tokens
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'posts.json'), 'utf8'))
const TOKENS = multiWordTokens(gloss)

let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(60)} ${got}`) }
const norm = s => (s || '').replace(/\s+/g, ' ').trim()

// For each token, the first drop where it occurs AND the glossary has a reading for that drop.
// A token with no such drop is reported rather than skipped — silence would hide a broken token.
const target = new Map()
for (const p of posts) {
  const t = runtimeText(p.text ?? '')
  for (const seg of segmentGloss(t, TOKENS)) {
    if (!seg.token || target.has(seg.token)) continue
    const entries = gloss[seg.token] ?? []
    if (entries.some(e => (e.posts ?? []).includes(p.postNum))) target.set(seg.token, p.postNum)
  }
}

console.log(`\nMULTI-WORD GLOSSARY TERMS  (${mode})\n`)
console.log(`  ${TOKENS.length} multi-word tokens · ${target.size} have a drop that gloss-resolves them\n`)

const browser = await launch({ mode })

// ── shared page helpers, injected into every expression ─────────────────────
//
// One definition of "what is a tab stop" and "what is an occurrence", so the checks differ in what
// they assert rather than in how they look at the DOM.
const HELPERS = `
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim()
  const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  const stopsIn = el => (el.matches(FOCUSABLE) ? 1 : 0) + el.querySelectorAll(FOCUSABLE).length
  const nestedControls = () => [...document.querySelectorAll('button')]
    .filter(b => b.parentElement && b.parentElement.closest('button')).length
  const occurrences = () => {
    const out = {}
    for (const el of document.querySelectorAll('[data-gloss-occ]')) {
      const id = el.getAttribute('data-gloss-occ')
      ;(out[id] = out[id] || []).push(el)
    }
    return out
  }
  const occFacts = id => {
    const els = occurrences()[id]
    if (!els || !els.length) return null
    const anchors = els.filter(e => e.hasAttribute('data-gloss-anchor'))
    return {
      segments: els.length,
      text: els.map(e => e.textContent).join(''),
      anchors: anchors.length,
      anchorIsButton: anchors.length === 1 && anchors[0].tagName === 'BUTTON',
      anchorTabbable: anchors.length === 1 && anchors[0].tabIndex >= 0,
      anchorLabel: anchors.length === 1 ? anchors[0].getAttribute('aria-label') : null,
      anchorText: anchors.length === 1 ? norm(anchors[0].textContent) : null,
      anchorIndex: anchors.length === 1 ? els.indexOf(anchors[0]) : -1,
      tabStops: els.reduce((n, e) => n + stopsIn(e), 0),
      nestedInside: els.filter(e => e.parentElement && e.parentElement.closest('[data-gloss-occ]')).length,
      annotationsKept: els.map(e => (e.querySelector('mark') || e.closest('mark')) ? 1 : 0).reduce((a, b) => a + b, 0),
    }
  }
  const openCard = () => {
    const c = document.querySelector('[role="tooltip"]')
    return c ? { text: norm(c.textContent), id: c.id } : null
  }
`
const withHelpers = body => `(() => { ${HELPERS} ${body} })()`

/** The DOM facts a term needs to be usable, gathered in one pass. */
const PROBE = token => withHelpers(`
  const want = ${JSON.stringify(token)}
  const wantN = norm(want).toLowerCase()
  const btns = [...document.querySelectorAll('button[aria-expanded]')]
  const mine = btns.filter(b => norm(b.textContent).toLowerCase() === wantN)
  const dupes = {}
  for (const b of btns) {
    const r = b.getBoundingClientRect()
    const k = norm(b.textContent).toLowerCase() + '@' + Math.round(r.left) + ',' + Math.round(r.top)
    dupes[k] = (dupes[k] || 0) + 1
  }
  const occs = occurrences()
  const mineOcc = Object.keys(occs).filter(id => norm(occs[id].map(e => e.textContent).join('')).toLowerCase() === wantN)
  const first = mine[0]
  return JSON.stringify({
    count: mine.length,
    tag: first ? first.tagName : null,
    tabbable: first ? first.tabIndex >= 0 : false,
    insideAnnotation: first ? Boolean(first.closest('mark')) : false,
    annotationIntact: first && first.closest('mark') ? first.closest('mark').textContent.length > want.length : null,
    nestedButtons: nestedControls(),
    duplicateTargets: Object.values(dupes).filter(n => n > 1).length,
    textPreserved: first ? norm(first.textContent) : null,
    splitIds: mineOcc,
    split: mineOcc.map(occFacts),
  })
`)

// ── every token, on the drop that carries it ────────────────────────────────
const missing = TOKENS.filter(t => !target.has(t))
check(missing.length === 0, 'every multi-word token has a drop to prove it on', missing.length ? missing.join(', ') : `${target.size} tokens`)

let insideAnnotation = 0
let outsideAnnotation = 0
let split = 0
for (const [token, postNum] of target) {
  const page = await browser.page(`${BASE}/post/${postNum}`)
  await page.waitFor(`document.querySelectorAll('button[aria-expanded]').length > 0`, { timeout: 60000 })
  const raw = await page.evaluate(PROBE(token))
  const r = raw ? JSON.parse(raw) : null
  await page.close()

  // TWO CORRECT OUTCOMES, and the difference is not a matter of degree.
  //
  //   contiguous  the phrase reaches the renderer whole and becomes one button
  //   split       the annotation layer got there first, and the ruling governs: one occurrence id
  //               across every segment, exactly one control, one tab stop, nothing nested
  //
  // The earlier version of this check accepted the split case on the strength of an inner control
  // being present. That claim was withdrawn — the probe returned an empty list — and accepting it
  // meant six terms had no box at all while the suite reported them fine.
  // A drop may carry the same split term more than once — #1791 writes FOX NEWS twice — so EVERY
  // group has to hold, not the first one. Checking only the first is how a second occurrence loses
  // its box without anything going red.
  const contiguous = Boolean(r) && r.count > 0
  const groups = r ? r.split.filter(Boolean) : []
  const sound = g => g.segments >= 2 && norm(g.text) === norm(token)
    && g.anchors === 1 && g.anchorIsButton && g.anchorTabbable && g.tabStops === 1 && g.nestedInside === 0
  const ok = Boolean(r) && r.nestedButtons === 0 && r.duplicateTargets === 0 && (
    contiguous
      ? (r.tag === 'BUTTON' && r.tabbable)
      : groups.length > 0 && groups.length === r.splitIds.length && groups.every(sound)
  )
  if (!ok) failed++
  if (contiguous) { if (r.insideAnnotation) insideAnnotation++; else outsideAnnotation++ } else split++
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${`${token} in #${postNum}`.padEnd(60)} ${
    !r ? 'NO PROBE'
      : contiguous ? `${r.count} target(s)${r.insideAnnotation ? ', inside an annotation' : ''}${r.nestedButtons ? ` · ${r.nestedButtons} NESTED` : ''}${r.duplicateTargets ? ` · ${r.duplicateTargets} DUPLICATE` : ''}`
        : groups.length ? `${groups.length} occurrence(s) · ${groups.map(g => `${g.segments} segments, anchor ${g.anchorIndex}, ${g.tabStops} stop`).join(' · ')}`
          : `SPLIT NOT MARKED (${r.splitIds.length} occurrence groups)`}`)
}

console.log('')
check(insideAnnotation > 0, 'at least one term proves the inside-an-annotation case', `${insideAnnotation} inside, ${outsideAnnotation} outside`)
check(split === 6, 'the six split terms are the ones that take the split path', `${split} split`)

// ── the six split terms, in full ────────────────────────────────────────────
//
// Each one is named because each one exercises a different corner of the ruling: the control on the
// first segment, the control on a LATER segment, no control at all, and a phrase broken into three.
console.log('')
const SPLIT_CASES = [
  { token: 'FOX NEWS', post: 1791, inner: 'FOX', anchorAt: 0, segments: 2 },
  { token: 'ABC NEWS', post: 2770, inner: 'ABC', anchorAt: 0, segments: 2 },
  { token: 'ADAM SCHIFF', post: 3063, inner: 'SCHIFF', anchorAt: 1, segments: 2 },
  { token: 'CLINTON FOUNDATION', post: 1830, inner: null, anchorAt: 0, segments: 2 },
  { token: 'ROD ROSENSTEIN', post: 2129, inner: null, anchorAt: 0, segments: 2 },
  { token: 'SUPREME COURT', post: 2462, inner: null, anchorAt: 0, segments: 3 },
]
const GLOSS_SECTION = 'Glossary reading in this post'

for (const c of SPLIT_CASES) {
  const id = occurrenceId(c.post, c.token, 0)
  const page = await browser.page(`${BASE}/post/${c.post}`)
  await page.waitFor(`document.querySelectorAll('[data-gloss-occ]').length > 0`, { timeout: 60000 })
  const label = `${c.token} in #${c.post}`

  const facts = JSON.parse(await page.evaluate(withHelpers(`return JSON.stringify(occFacts(${JSON.stringify(id)}))`)) || 'null')
  if (!facts) {
    check(false, `${label} — the occurrence is marked`, `no segments carry ${id}`)
    await page.close()
    continue
  }

  check(facts.segments === c.segments, `${label} — every segment carries one occurrence id`, `${facts.segments} segments share ${id}`)
  check(norm(facts.text) === norm(c.token), `${label} — the drop text is unchanged`, JSON.stringify(facts.text))
  check(facts.anchors === 1 && facts.anchorIsButton && facts.anchorTabbable,
    `${label} — exactly one segment is the keyboard anchor`, `${facts.anchors} anchor(s), button=${facts.anchorIsButton}`)
  check(facts.anchorIndex === c.anchorAt,
    `${label} — the anchor is the ${c.inner ? 'leftmost existing control' : 'leftmost eligible segment'}`,
    `segment ${facts.anchorIndex} of ${facts.segments}`)
  check(facts.tabStops === 1, `${label} — one tab stop for the whole phrase`, `${facts.tabStops}`)
  check(facts.nestedInside === 0, `${label} — no marked segment sits inside another`, `${facts.nestedInside}`)
  check(facts.annotationsKept === facts.segments, `${label} — every certified annotation survives`, `${facts.annotationsKept}/${facts.segments} marks`)
  // The reader's control must announce the WHOLE term, whatever single word it happens to sit on.
  check(String(facts.anchorLabel || '').includes(c.token),
    `${label} — the control announces the complete term`, JSON.stringify(String(facts.anchorLabel || '').slice(0, 72)))
  if (c.inner) {
    check(String(facts.anchorLabel || '').includes(c.inner),
      `${label} — and still announces the ${c.inner} reading it already carried`, JSON.stringify(String(facts.anchorLabel || '').slice(0, 72)))
  }

  // ── event delegation: a NON-anchor segment opens the same card ────────────
  const pickSeg = `[...document.querySelectorAll('[data-gloss-occ="${id}"]')].find(e => !e.hasAttribute('data-gloss-anchor'))`
  await page.evaluate(`(() => { const e = ${pickSeg}; e.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return 'hovered' })()`)
  const byHover = await page.waitFor(withHelpers(`
    const a = document.querySelector('[data-gloss-occ="${id}"][data-gloss-anchor]')
    return a && a.getAttribute('aria-expanded') === 'true' ? JSON.stringify(openCard()) : null`), { timeout: 5000 })
  check(Boolean(byHover), `${label} — hovering a non-anchor segment opens the card`, byHover ? 'opened' : 'DID NOT OPEN')

  const card = byHover ? JSON.parse(byHover) : null
  if (c.inner) {
    // BOTH READINGS, VISIBLY APART. The entity reading the segment already carried is kept as its
    // own section, and the phrase reading is added under a heading of its own. An ABC entity
    // reading standing in for the ABC NEWS glossary reading is the exact substitution the ruling
    // forbids, and it would be invisible without this check.
    const t = card ? card.text : ''
    check(t.includes(GLOSS_SECTION), `${label} — the card gains a labelled glossary section`, t.includes(GLOSS_SECTION) ? 'section present' : 'MISSING')
    check(t.includes(c.inner) && t.includes(c.token),
      `${label} — both readings are on the card and distinct`, `${c.inner} + ${c.token}`)
  } else {
    const t = card ? card.text : ''
    check(t.includes(c.token), `${label} — the card is the reading for the whole phrase`, JSON.stringify(t.slice(0, 60)))
    check(!t.includes(GLOSS_SECTION), `${label} — no second section where there is no second reading`, t.includes(GLOSS_SECTION) ? 'UNEXPECTED' : 'single reading')
  }

  // Clicking a non-anchor segment toggles the same card, and Escape closes it from anywhere.
  await page.evaluate(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'esc' })()`)
  await page.evaluate(`(() => { const e = ${pickSeg}; e.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })); return 'out' })()`)
  const closed = await page.waitFor(`(() => { const a = document.querySelector('[data-gloss-occ="${id}"][data-gloss-anchor]'); return a && a.getAttribute('aria-expanded') === 'false' })()`, { timeout: 5000 })
  check(Boolean(closed), `${label} — Escape and pointer-out close it`, closed ? 'closed' : 'STILL OPEN')

  await page.evaluate(`(() => { const e = ${pickSeg}; e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); e.click(); return 'tapped' })()`)
  const byTap = await page.waitFor(`(() => { const a = document.querySelector('[data-gloss-occ="${id}"][data-gloss-anchor]'); return a && a.getAttribute('aria-expanded') === 'true' })()`, { timeout: 5000 })
  check(Boolean(byTap), `${label} — tapping a non-anchor segment opens the card`, byTap ? 'opened' : 'DID NOT OPEN')

  await page.close()
}

// ── the three named regressions ─────────────────────────────────────────────
console.log('')
{
  const page = await browser.page(`${BASE}/post/2401`)
  await page.waitFor(`document.querySelectorAll('button[aria-expanded]').length > 0`, { timeout: 60000 })
  const r = JSON.parse(await page.evaluate(PROBE('WASH POST')))
  check(r.count === 3, '#2401 — all three WASH POST occurrences have a target', `${r.count} of 3`)
  check(r.insideAnnotation === true && r.annotationIntact === true,
    '#2401 — the box sits inside the Question and the Question survives', r.annotationIntact ? 'outer mark intact' : 'OUTER LOST')
  check(r.textPreserved === 'WASH POST', '#2401 — the drop text is unchanged', r.textPreserved)
  check(r.nestedButtons === 0, '#2401 — no nested interactive controls', `${r.nestedButtons}`)
  await page.close()
}
{
  const page = await browser.page(`${BASE}/post/1828`)
  await page.waitFor(`document.querySelectorAll('button[aria-expanded]').length > 0`, { timeout: 60000 })
  // The drop the first attempt broke. BO and CM are single-word terms in a drop that also carries
  // NO NAME and SUPREME COURT — the exact interaction that regressed.
  const both = JSON.parse(await page.evaluate(withHelpers(`
    const t = [...document.querySelectorAll('button[aria-expanded]')].map(b => b.textContent.trim())
    return JSON.stringify({ bo: t.filter(x => x === 'BO').length, cm: t.filter(x => x === 'CM').length, nested: nestedControls() })`)))
  check(both.bo > 0, '#1828 — BO still has a target beside the multi-word terms', `${both.bo}`)
  check(both.cm > 0, '#1828 — CM still has a target beside the multi-word terms', `${both.cm}`)
  check(both.nested === 0, '#1828 — no nested interactive controls', `${both.nested}`)
  await page.close()
}
{
  const page = await browser.page(`${BASE}/post/3004`)
  await page.waitFor(`document.querySelectorAll('button[aria-expanded]').length > 0`, { timeout: 60000 })
  const dag = JSON.parse(await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('button[aria-expanded]')].find(x => x.textContent.trim() === 'DAG')
    return JSON.stringify({ present: Boolean(b), label: b ? b.getAttribute('aria-label') : null })
  })()`))
  check(dag.present, '#3004 — DAG still proves office versus officeholder', dag.label ? dag.label.slice(0, 46) : 'ABSENT')
  await page.close()
}

// ── interaction: keyboard, pointer, touch, Escape, focus restoration ────────
console.log('')
{
  const page = await browser.page(`${BASE}/post/2401`)
  await page.waitFor(`document.querySelectorAll('button[aria-expanded]').length > 0`, { timeout: 60000 })
  const pick = `[...document.querySelectorAll('button[aria-expanded]')].find(b => b.textContent.replace(/\\s+/g,' ').trim() === 'WASH POST')`

  const kbd = await page.evaluate(`(() => { const b = ${pick}; b.focus(); b.dispatchEvent(new FocusEvent('focus', {bubbles:true}));
    return JSON.stringify({ focused: document.activeElement === b, expanded: b.getAttribute('aria-expanded') }) })()`)
  const k = JSON.parse(kbd)
  check(k.focused, 'keyboard — the term takes focus', k.focused ? 'focused' : 'NOT FOCUSABLE')

  const opened = await page.waitFor(`(() => { const b = ${pick}; return b && b.getAttribute('aria-expanded') === 'true' })()`, { timeout: 5000 })
  check(Boolean(opened), 'keyboard — focus opens the card', opened ? 'aria-expanded=true' : 'did not open')

  const described = await page.evaluate(`(() => { const b = ${pick};
    const id = b.getAttribute('aria-describedby') || b.getAttribute('aria-controls');
    return JSON.stringify({ id, hasCard: Boolean(id && document.getElementById(id)),
      role: id && document.getElementById(id) ? document.getElementById(id).getAttribute('role') : null }) })()`)
  const d = JSON.parse(described)
  check(Boolean(d.hasCard), 'screen reader — the card is referenced by id from the trigger', d.id ?? 'NO REFERENCE')
  check(d.role === 'tooltip', 'screen reader — the card is announced as a tooltip', d.role ?? 'NO ROLE')

  await page.evaluate(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'sent' })()`)
  const closed = await page.waitFor(`(() => { const b = ${pick}; return b && b.getAttribute('aria-expanded') === 'false' })()`, { timeout: 5000 })
  check(Boolean(closed), 'keyboard — Escape closes it', closed ? 'closed' : 'still open')
  const refocused = await page.waitFor(`(() => { const b = ${pick}; return b && document.activeElement === b })()`, { timeout: 5000 })
  check(Boolean(refocused), 'keyboard — Escape returns focus to the term', refocused ? 'focus restored' : 'FOCUS LOST')

  // React state is asynchronous: reading aria-expanded in the same tick as the tap reports the
  // PREVIOUS render and looks exactly like a broken control. Tap, then poll — the same way the
  // keyboard case above does.
  await page.evaluate(`(() => { const b = ${pick};
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    b.click(); return 'tapped' })()`)
  const tapped = await page.waitFor(`(() => { const b = ${pick}; return b && b.getAttribute('aria-expanded') === 'true' })()`, { timeout: 5000 })
  check(Boolean(tapped), 'touch — tapping opens the card', tapped ? 'aria-expanded=true' : 'did not open')

  await page.evaluate(`(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return 'clicked away' })()`)
  const dismissed = await page.waitFor(`(() => { const b = ${pick}; return b && b.getAttribute('aria-expanded') === 'false' })()`, { timeout: 5000 })
  check(Boolean(dismissed), 'pointer — a click outside dismisses it', dismissed ? 'closed' : 'still open')
  await page.close()
}

// ── mobile viewport: the card must stay on screen ───────────────────────────
//
// TAP, THEN POLL, THEN MEASURE. The previous revision clicked and read the DOM in the same
// expression, which reports the render BEFORE the state change — a working card measured as absent.
// It is the same asynchrony the touch check above already accounts for, and the reason this file
// carries the lesson twice is that it was learned twice.
console.log('')
for (const [label, sel, pn] of [
  ['contiguous', `[...document.querySelectorAll('button[aria-expanded]')].find(x => x.textContent.replace(/\\s+/g,' ').trim() === 'WASH POST')`, 2401],
  ['split', `document.querySelector('[data-gloss-occ="${occurrenceId(2462, 'SUPREME COURT', 0)}"][data-gloss-anchor]')`, 2462],
]) {
  const page = await browser.page(`${BASE}/post/${pn}`, { width: 390, height: 844 })
  await page.waitFor(`document.querySelectorAll('button[aria-expanded]').length > 0`, { timeout: 60000 })
  const found = await page.evaluate(`(() => { const b = ${sel}; if (!b) return 'none'; b.click(); return 'tapped' })()`)
  check(found === 'tapped', `mobile — the ${label} term is reachable at 390px`, found === 'tapped' ? 'trigger present' : 'NO TRIGGER')
  if (found !== 'tapped') { await page.close(); continue }

  // THE PROJECT'S ACTUAL RELATIONSHIP ATTRIBUTE. HoverCard names its card with aria-describedby,
  // not aria-controls. Querying aria-controls found nothing and reported a working card as a broken
  // one. Both are accepted here, with role=tooltip as the backstop, so the check follows the
  // component rather than an assumption about it.
  const m = await page.waitFor(`(() => {
    const b = ${sel}
    const id = b.getAttribute('aria-describedby') || b.getAttribute('aria-controls')
    const card = (id && document.getElementById(id)) || document.querySelector('[role="tooltip"]')
    if (!card) return null
    const r = card.getBoundingClientRect()
    const a = b.getBoundingClientRect()
    return JSON.stringify({
      onScreen: r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
      coversAnchor: !(r.bottom <= a.top || r.top >= a.bottom),
      width: Math.round(r.width), height: Math.round(r.height), viewport: window.innerWidth,
      tooltips: document.querySelectorAll('[role="tooltip"]').length,
    })
  })()`, { timeout: 8000 })
  const mm = m ? JSON.parse(m) : null
  check(Boolean(mm), `mobile — the ${label} card opens at 390px`, mm ? 'card present' : 'NO CARD')
  if (!mm) { await page.close(); continue }
  check(mm.onScreen === true, `mobile — the ${label} card is fully on screen`, `${mm.width}x${mm.height} in ${mm.viewport}px`)
  check(mm.coversAnchor === false, `mobile — the ${label} card does not cover its own word`, mm.coversAnchor ? 'COVERS ANCHOR' : 'anchor visible')
  check(mm.tooltips === 1, `mobile — exactly one card is open`, `${mm.tooltips}`)
  await page.close()
}

// ── nested controls and duplicate tab stops, swept over every affected drop ──
console.log('')
{
  const drops = [...new Set([...target.values(), ...SPLIT_CASES.map(c => c.post), 2401, 1828, 3004])]
  let nested = 0
  let dupes = 0
  let orphaned = 0
  for (const pn of drops) {
    const page = await browser.page(`${BASE}/post/${pn}`)
    await page.waitFor(`document.querySelectorAll('button[aria-expanded]').length > 0`, { timeout: 60000 })
    const r = JSON.parse(await page.evaluate(withHelpers(`
      const occs = occurrences()
      let dup = 0, orphan = 0
      for (const id of Object.keys(occs)) {
        const els = occs[id]
        const anchors = els.filter(e => e.hasAttribute('data-gloss-anchor'))
        if (anchors.length !== 1) orphan++
        if (els.reduce((n, e) => n + stopsIn(e), 0) !== 1) dup++
      }
      const seen = {}
      let same = 0
      for (const b of document.querySelectorAll('button[aria-expanded]')) {
        const r = b.getBoundingClientRect()
        const k = norm(b.textContent) + '@' + Math.round(r.left) + ',' + Math.round(r.top)
        if (seen[k]) same++; else seen[k] = 1
      }
      return JSON.stringify({ nested: nestedControls(), dup, orphan, same, groups: Object.keys(occs).length })`)))
    nested += r.nested
    dupes += r.dup + r.same
    orphaned += r.orphan
    await page.close()
  }
  check(nested === 0, `nested controls across all ${drops.length} affected drops`, `${nested}`)
  check(dupes === 0, `duplicate tab stops across all ${drops.length} affected drops`, `${dupes}`)
  check(orphaned === 0, `every occurrence group has exactly one anchor`, `${orphaned} without`)
}

console.log(`\n  ${failed ? `❌ ${failed} failed` : '✅ every multi-word term renders, reads and behaves'}\n`)
process.exit(failed ? 1 : 0)
