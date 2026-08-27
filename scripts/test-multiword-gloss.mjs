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
  const nestedControls = () => [...document.querySelectorAll('pre[class*="post-text"] button')]
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
  // Scoped to the drop for the same reason the wait above is: a control in the page shell is not
  // a glossary control, and counting one would put a sidebar row into duplicateTargets.
  const btns = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')]
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
//
// 2026-08-26: a token can legitimately have no drop of its own for two reasons that are not
// defects — the same reasons test-gloss-segments.mjs documents for the pure matcher:
//
//   dominated   every post where this token's text appears, a LONGER sibling registered for the
//               SAME entity also matches there, and the longest-match rule (glossSegments.ts)
//               correctly prefers the fuller phrase — e.g. "Charles W" beside "Charles W. Dent",
//               "THE FED" beside "Fed Judge". The short form stays registered so aliasRulings can
//               still match it on some OTHER drop that carries only the bare form; it simply never
//               wins on the drops in this token's own `posts` list.
//   collision   two DIFFERENT entities share a spelling that differs only by case ("Paris accord"
//               vs "Paris Accord" — qe-101cfb6d8051 "Paris Agreement" and qe-a5aa42432253 "Paris
//               Accord"). build-glossary.mjs's case-fold only merges spellings resolving to the
//               SAME entity, by design, so exactly one survives lookup by normalised text.
//
// Neither excuses a token that has NO covering sibling anywhere and NO collision — that is still a
// real dead alias and still fails below.
// Same-entity domination (Charles W / Charles W. Dent) is the common case, but the registry also
// has near-duplicate ENTITIES whose aliases nest the same way (Joseph R / Joseph R. Biden, JFK JR
// / JFK JR., House Oversight / House Oversight and Government Reform Committee — two separately
// registered identities, not one). Either way the effect on rendering is identical: the shorter
// span can never win where the longer one is also present, so both count as excused here. Whether
// any of those pairs OUGHT to be merged into one entity is a separate owner-ruling question, not
// something this render-proof check should adjudicate.
const entityIdsOf = t => new Set((gloss[t] ?? []).map(e => e.entityId).filter(Boolean))
const dominatedElsewhere = t => TOKENS.some(other => other !== t && other.length > t.length
  && other.toLowerCase().includes(t.toLowerCase()))
const collidesWithAnotherEntity = t => {
  const ids = entityIdsOf(t)
  if (!ids.size) return false
  const tNorm = norm(t).toLowerCase()
  return TOKENS.some(other => other !== t && norm(other).toLowerCase() === tNorm
    && [...entityIdsOf(other)].some(id => !ids.has(id)))
}
const excusable = t => dominatedElsewhere(t) || collidesWithAnotherEntity(t)
const missing = TOKENS.filter(t => !target.has(t) && !excusable(t))
const excused = TOKENS.filter(t => !target.has(t) && excusable(t))
check(missing.length === 0, 'every multi-word token has a drop to prove it on',
  missing.length ? missing.join(', ') : `${target.size} tokens${excused.length ? ` (+${excused.length} dominated by a longer sibling or a cross-entity spelling collision, expected)` : ''}`)

let insideAnnotation = 0
let outsideAnnotation = 0
const splitTokens = []
for (const [token, postNum] of target) {
  const page = await browser.page(`${BASE}/post/${postNum}`)
  // WAIT FOR THE DROP, NOT FOR ANY BUTTON ON THE PAGE.
  //
  // This waited on document-wide `button[aria-expanded]`, which was the glossary control for as
  // long as nothing else used the attribute. The sidebar's "Q Extras" disclosure now does, and it
  // renders with the shell — so the wait returned IMMEDIATELY, the probe ran against a page whose
  // post body did not exist yet, and all 46 tokens reported "SPLIT NOT MARKED (0 occurrence
  // groups)". Every one of them was fine; the gate was measuring an empty page.
  await page.waitFor(`document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]').length > 0`, { timeout: 60000 })
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
  // 2026-08-26: case-insensitive, like every other comparison in this pipeline. UNITED STATES OF
  // AMERICA (#104) is the token key in the glossary but the drop itself spells it "United States
  // of America" — matching is already case-insensitive everywhere else (test-gloss-segments.mjs's
  // "lower case matches and resolves to the canonical key"), so the text check here must be too.
  const sound = g => g.segments >= 2 && norm(g.text).toLowerCase() === norm(token).toLowerCase()
    && g.anchors === 1 && g.anchorIsButton && g.anchorTabbable && g.tabStops === 1 && g.nestedInside === 0
  const ok = Boolean(r) && r.nestedButtons === 0 && r.duplicateTargets === 0 && (
    contiguous
      ? (r.tag === 'BUTTON' && r.tabbable)
      : groups.length > 0 && groups.length === r.splitIds.length && groups.every(sound)
  )
  if (!ok) failed++
  if (contiguous) { if (r.insideAnnotation) insideAnnotation++; else outsideAnnotation++ } else splitTokens.push(token)
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${`${token} in #${postNum}`.padEnd(60)} ${
    !r ? 'NO PROBE'
      : contiguous ? `${r.count} target(s)${r.insideAnnotation ? ', inside an annotation' : ''}${r.nestedButtons ? ` · ${r.nestedButtons} NESTED` : ''}${r.duplicateTargets ? ` · ${r.duplicateTargets} DUPLICATE` : ''}`
        : groups.length ? `${groups.length} occurrence(s) · ${groups.map(g => `${g.segments} segments, anchor ${g.anchorIndex}, ${g.tabStops} stop`).join(' · ')}`
          : `SPLIT NOT MARKED (${r.splitIds.length} occurrence groups)`}`)
}

console.log('')
check(insideAnnotation > 0, 'at least one term proves the inside-an-annotation case', `${insideAnnotation} inside, ${outsideAnnotation} outside`)

// HOW MANY TERMS SPLIT IS A PROPERTY OF THE BUILD, NOT OF THE READER'S EXPERIENCE.
//
// The workbench renders the live Firestore analysis; the published site renders only the certified
// artifacts. So a question span that carries an uncertified Claim underneath it paints amber on
// localhost and blue on qdrops.app, the intervals fall differently, and nine terms split in
// production where six split in the workbench. Asserting "exactly six" pinned a gate to one build
// and failed on the other while every term behaved correctly on both.
//
// What has to hold everywhere is the part the ruling is about: the six named terms are split — they
// are the reason this work exists — and EVERY term that splits, however many, satisfies the
// contract. That is already asserted per token above, so a tenth split term is proved, not
// tolerated.
// WHICH terms split is not fixed either, and pinning it was the same mistake one layer along.
// Removing the Emphasis fill on 2026-08-17 changed the interval decomposition, and SUPREME COURT
// stopped being three marks and became one — so it now takes the CONTIGUOUS path and reads better
// for it. The named six are proved individually below, on whichever path they take; all this line
// records is what today's build does.
console.log(`    ----  ${splitTokens.length} term(s) split in this build: ${splitTokens.join(', ') || 'none'}`)

// ── the six split terms, in full ────────────────────────────────────────────
//
// Each one is named because each one exercises a different corner of the ruling: the control on the
// first segment, the control on a LATER segment, no control at all, and a phrase broken into three.
console.log('')
// 2026-08-26: casing and two structural facts moved since this list was written.
//   - FOX NEWS/ABC NEWS/ADAM SCHIFF/ROD ROSENSTEIN/SUPREME COURT are now stored in their natural
//     entity-canonical casing (matching is case-insensitive either way; see test-gloss-segments.mjs).
//   - CLINTON FOUNDATION: #1830 actually reads "THE CLINTON FOUNDATION.", so the longest-match
//     rule (correctly) extends the split across the leading "THE " segment too — 3 segments now,
//     not 2 (same fact test-gloss-occurrence.mjs records for this drop).
//   - ROD ROSENSTEIN: the anchor is the pre-existing ROSENSTEIN entity control, the same
//     later-segment-control shape as ADAM SCHIFF/SCHIFF — anchor on segment 1, `inner: 'ROSENSTEIN'`
//     — not the no-existing-control case `inner: null` incorrectly recorded here before.
const SPLIT_CASES = [
  { token: 'Fox News', post: 1791, inner: 'FOX', anchorAt: 0, segments: 2 },
  { token: 'ABC News', post: 2770, inner: 'ABC', anchorAt: 0, segments: 2 },
  { token: 'Adam Schiff', post: 3063, inner: 'SCHIFF', anchorAt: 1, segments: 2 },
  { token: 'THE CLINTON FOUNDATION', post: 1830, inner: null, anchorAt: 0, segments: 3 },
  { token: 'Rod Rosenstein', post: 2129, inner: 'ROSENSTEIN', anchorAt: 1, segments: 2 },
  { token: 'Supreme Court', post: 2462, inner: null, anchorAt: 0, segments: 3 },
]
const GLOSS_SECTION = 'Glossary reading in this post'

for (const c of SPLIT_CASES) {
  const id = occurrenceId(c.post, c.token, 0)
  const page = await browser.page(`${BASE}/post/${c.post}`)
  await page.waitFor(`document.querySelectorAll('[data-gloss-occ]').length > 0`, { timeout: 60000 })
  const label = `${c.token} in #${c.post}`

  const facts = JSON.parse(await page.evaluate(withHelpers(`return JSON.stringify(occFacts(${JSON.stringify(id)}))`)) || 'null')
  if (!facts) {
    // NOT SPLIT IN THIS BUILD — the annotation layer left the phrase whole, so it takes the
    // ordinary path and must have its own single control. That is a correct outcome, not a
    // missing one: what the ruling protects is that the reader can reach the term exactly once,
    // and this asserts precisely that rather than assuming today's interval layout.
    const solo = JSON.parse(await page.evaluate(withHelpers(`
      const want = ${JSON.stringify(c.token)}.toLowerCase()
      const mine = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')].filter(b => norm(b.textContent).toLowerCase() === want)
      const b = mine[0]
      return JSON.stringify({ count: mine.length, tabbable: b ? b.tabIndex >= 0 : false,
        label: b ? b.getAttribute('aria-label') : null, text: b ? norm(b.textContent) : null,
        nested: nestedControls(), markKept: b ? Boolean(b.querySelector('mark') || b.closest('mark')) : false })`)))
    check(solo.count >= 1 && solo.tabbable, `${label} — contiguous here, and it has its own control`, `${solo.count} button(s)`)
    // Case-insensitive: the drop keeps Q's own casing ("SUPREME COURT"), the token key is now the
    // entity's natural-case canonical spelling ("Supreme Court") — see test-gloss-segments.mjs.
    check(norm(solo.text).toLowerCase() === norm(c.token).toLowerCase(), `${label} — the drop text is unchanged`, JSON.stringify(solo.text))
    check(String(solo.label || '').includes(c.token), `${label} — the control announces the complete term`, JSON.stringify(String(solo.label || '').slice(0, 60)))
    check(solo.nested === 0, `${label} — no nested interactive controls`, `${solo.nested}`)
    await page.close()
    continue
  }

  check(facts.segments === c.segments, `${label} — every segment carries one occurrence id`, `${facts.segments} segments share ${id}`)
  // Case-insensitive, same reason as the solo branch above.
  check(norm(facts.text).toLowerCase() === norm(c.token).toLowerCase(), `${label} — the drop text is unchanged`, JSON.stringify(facts.text))
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
  await page.waitFor(`document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]').length > 0`, { timeout: 60000 })
  const r = JSON.parse(await page.evaluate(PROBE('WASH POST')))
  check(r.count === 3, '#2401 — all three WASH POST occurrences have a target', `${r.count} of 3`)
  // WHETHER this occurrence is inside an annotation depends on the build — the workbench paints an
  // uncertified Claim over it that the published bundle does not carry. What must hold on both is
  // that a box never destroys the annotation it sits in. Asserted where there is one, and the
  // inside-an-annotation case itself is proved by the aggregate check above, which holds on both.
  check(r.insideAnnotation ? r.annotationIntact === true : true,
    '#2401 — where the box sits inside an annotation, the annotation survives',
    r.insideAnnotation ? (r.annotationIntact ? 'outer mark intact' : 'OUTER LOST') : 'not annotated in this build')
  check(r.textPreserved === 'WASH POST', '#2401 — the drop text is unchanged', r.textPreserved)
  check(r.nestedButtons === 0, '#2401 — no nested interactive controls', `${r.nestedButtons}`)
  await page.close()
}
{
  const page = await browser.page(`${BASE}/post/1828`)
  await page.waitFor(`document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]').length > 0`, { timeout: 60000 })
  // The drop the first attempt broke. BO and CM are single-word terms in a drop that also carries
  // NO NAME and SUPREME COURT — the exact interaction that regressed.
  const both = JSON.parse(await page.evaluate(withHelpers(`
    const t = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')].map(b => b.textContent.trim())
    return JSON.stringify({ bo: t.filter(x => x === 'BO').length, cm: t.filter(x => x === 'CM').length, nested: nestedControls() })`)))
  check(both.bo > 0, '#1828 — BO still has a target beside the multi-word terms', `${both.bo}`)
  check(both.cm > 0, '#1828 — CM still has a target beside the multi-word terms', `${both.cm}`)
  check(both.nested === 0, '#1828 — no nested interactive controls', `${both.nested}`)
  await page.close()
}
{
  const page = await browser.page(`${BASE}/post/3004`)
  await page.waitFor(`document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]').length > 0`, { timeout: 60000 })
  const dag = JSON.parse(await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')].find(x => x.textContent.trim() === 'DAG')
    return JSON.stringify({ present: Boolean(b), label: b ? b.getAttribute('aria-label') : null })
  })()`))
  check(dag.present, '#3004 — DAG still proves office versus officeholder', dag.label ? dag.label.slice(0, 46) : 'ABSENT')
  await page.close()
}

// ── interaction: keyboard, pointer, touch, Escape, focus restoration ────────
console.log('')
{
  const page = await browser.page(`${BASE}/post/2401`)
  await page.waitFor(`document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]').length > 0`, { timeout: 60000 })
  const pick = `[...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')].find(b => b.textContent.replace(/\\s+/g,' ').trim() === 'WASH POST')`

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
  ['contiguous', `[...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')].find(x => x.textContent.replace(/\\s+/g,' ').trim() === 'WASH POST')`, 2401],
  // A term that is ACTUALLY split in this build. #2462 used to be the example and stopped being
  // one when the Emphasis fill came out, so the fixture is chosen from what the page does rather
  // than from what it did.
  ['split', `document.querySelector('[data-gloss-occ="${occurrenceId(1791, 'FOX NEWS', 0)}"][data-gloss-anchor]')`, 1791],
]) {
  const page = await browser.page(`${BASE}/post/${pn}`, { width: 390, height: 844 })
  await page.waitFor(`document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]').length > 0`, { timeout: 60000 })
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
    // THE SWEEP WAITS FOR THE DROP, NOT FOR A CONTROL IN IT.
    //
    // Unlike the per-token checks above, a drop with ZERO glossary controls is a valid input
    // here - it contributes nothing to the nested/duplicate tallies and that is the correct
    // answer. Waiting on a control made every such drop burn the full 60s timeout, which is why
    // this sweep is the slowest thing in the suite; the body is the honest readiness condition.
    await page.waitFor(`document.querySelectorAll('pre[class*="post-text"]').length > 0`, { timeout: 60000 })
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
      for (const b of document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')) {
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
