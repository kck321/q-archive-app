// EVERY PLACE TWO CERTIFIED LAYERS PAINT THE SAME CHARACTERS.
//
//   -> audit/overlay-audit.json
//
// The owner asked three questions about the drop body and they are all the same question underneath:
//
//   1. where does an Entity or a Bracket sit on top of another colour?      (must render SOLID)
//   2. what OTHER pairs overlap — "quite a few claims that overlay predictions"?
//   3. which Theme anchors sit inside another highlight and read as purple?
//
// So the segments are rebuilt exactly the way renderPostBody() builds them — the same sources, the
// same word-boundary rule, the same bracket and URL detectors — and every sub-interval covered by
// more than one kind is recorded with the kinds that cover it. Measuring the DATA rather than the
// DOM is right here BECAUSE the question is what the renderer is being asked to draw; the paint is
// the thing under review, so it cannot also be the evidence.
//
//   node scripts/audit-overlays.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const aliases = JSON.parse(fs.readFileSync(path.join(DATA, 'aliases.json'), 'utf8'))

const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q.unitText ?? q.text)
}

// ── the renderer's own matching rules, copied ───────────────────────────────
const escapeAndNormalize = term => {
  let e = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  e = e.replace(/['‘’‚‛]/g, "(?:'|‘|’)")
  e = e.replace(/["“”„‟]/g, '(?:"|“|”)')
  e = e.replace(/[-–—]/g, '(?:-|–|—)')
  return e
}
const wordBoundaryPattern = (escaped, raw) => {
  const startsWord = /[A-Za-z0-9]/.test(raw[0] ?? '')
  const endsWord = /[A-Za-z0-9]/.test(raw[raw.length - 1] ?? '')
  return `${startsWord ? '(?<![A-Za-z0-9])' : ''}${escaped}${endsWord ? '(?![A-Za-z0-9])' : ''}`
}
const BRACKET_RX = /\[[^[\]\n]{1,60}\]/g
const URL_RX = /https?:\/\/[ \t]{0,3}[^\s<>'")\]]+/g

// getAliasesFor(): the group a term belongs to, minus the term itself.
const aliasGroups = Object.values(aliases).map(v => v.map(String))
const aliasKeys = Object.entries(aliases)
const getAliasesFor = term => {
  const t = String(term).toLowerCase()
  const out = new Set()
  for (const [k, list] of aliasKeys) {
    const all = [k, ...list.map(String)]
    if (all.some(x => String(x).toLowerCase() === t)) for (const x of list) if (String(x).toLowerCase() !== t) out.add(String(x))
  }
  return [...out]
}

function segsFor(p) {
  const text = p.text ?? ''
  const a = p.postAnalysis ?? {}
  const segs = []
  const add = (terms, kind, expandAliases = false) => {
    for (const term of terms ?? []) {
      if (!term || !String(term).trim()) continue
      for (const variant of expandAliases ? [term, ...getAliasesFor(term)] : [term]) {
        const rx = new RegExp(wordBoundaryPattern(escapeAndNormalize(variant), String(variant)), 'gi')
        let m
        while ((m = rx.exec(text)) !== null) {
          if (m.index === rx.lastIndex) rx.lastIndex++
          segs.push({ start: m.index, end: m.index + m[0].length, kind, term: String(variant) })
        }
      }
    }
  }
  add(qByPost.get(p.postNum), 'question')
  for (const r of p.actionRequests ?? []) {
    add([r], String(r).trim().endsWith('?') ? 'requestQuestion' : 'request')
  }
  add(a.namedEntities, 'namedEntity', true)
  add(a.claimSpans ?? a.claims, 'claim')
  add(a.predictionSpans ?? a.predictions, 'prediction')
  add(a.themeAnchors, 'theme')
  // brackets and URLs come from the drop text, not from a list
  for (const rx of [BRACKET_RX, URL_RX]) {
    const r = new RegExp(rx.source, 'g')
    let m
    while ((m = r.exec(text)) !== null) {
      segs.push({ start: m.index, end: m.index + m[0].length, kind: rx === BRACKET_RX ? 'bracketCode' : 'url', term: m[0] })
    }
  }
  return segs
}

const INLINE_TOP = new Set(['namedEntity', 'bracketCode'])
const entityOverOther = []
const otherPairs = []
const themeInside = []
const pairTally = {}

for (const p of posts) {
  const segs = segsFor(p)
  if (segs.length < 2) continue
  const text = p.text ?? ''
  const bounds = new Set([0, text.length])
  for (const s of segs) { bounds.add(s.start); bounds.add(s.end) }
  const b = [...bounds].sort((x, y) => x - y)
  for (let i = 0; i < b.length - 1; i++) {
    const lo = b[i], hi = b[i + 1]
    if (hi <= lo) continue
    const active = segs.filter(s => s.start <= lo && s.end >= hi)
    const kinds = [...new Set(active.map(s => s.kind))]
    if (kinds.length < 2) continue
    const span = text.slice(lo, hi)
    if (!span.trim()) continue
    const row = { postNum: p.postNum, span: span.slice(0, 120), kinds: kinds.slice().sort() }

    const tops = kinds.filter(k => INLINE_TOP.has(k))
    const others = kinds.filter(k => !INLINE_TOP.has(k) && k !== 'url')
    if (tops.length && others.length) {
      entityOverOther.push({ ...row, top: tops.join('+'), behind: others.join('+') })
    }
    // 2+ layers, none of which is an entity or a bracket — nothing wins by rule, so the renderer
    // ROTATES. These are the ones the owner cannot read.
    if (!tops.length && others.length >= 2) {
      const key = others.slice().sort().join(' + ')
      pairTally[key] = (pairTally[key] ?? 0) + 1
      otherPairs.push({ ...row, pair: key })
    }
    if (kinds.includes('theme') && kinds.length >= 2) {
      themeInside.push({ ...row, themeAnchor: (active.find(s => s.kind === 'theme') ?? {}).term, with: kinds.filter(k => k !== 'theme').join('+') })
    }
  }
}

const distinct = rows => new Set(rows.map(r => r.postNum)).size
const out = {
  note: 'Every sub-interval of a drop covered by more than one certified layer, rebuilt from the same sources renderPostBody() paints from.',
  why: 'Three owner questions, one measurement: where an Entity or Bracket sits on another colour (must be solid), what other pairs overlap, and which Theme anchors sit inside another highlight.',
  ruledOn: '2026-08-24',
  totals: {
    entityOrBracketOverAnother: { spans: entityOverOther.length, posts: distinct(entityOverOther) },
    twoLayersNeitherEntityNorBracket: { spans: otherPairs.length, posts: distinct(otherPairs) },
    themeInsideAnotherHighlight: { spans: themeInside.length, posts: distinct(themeInside) },
    byPair: Object.fromEntries(Object.entries(pairTally).sort((x, y) => y[1] - x[1])),
  },
  entityOrBracketOverAnother: entityOverOther,
  twoLayersNeitherEntityNorBracket: otherPairs,
  themeInsideAnotherHighlight: themeInside,
}
fs.writeFileSync(path.join(ROOT, 'audit/overlay-audit.json'), JSON.stringify(out, null, 1))

console.log('\nOVERLAY AUDIT\n')
console.log(`  entity/bracket over another layer : ${entityOverOther.length.toLocaleString()} spans across ${distinct(entityOverOther).toLocaleString()} drops`)
console.log(`  two layers, neither of those      : ${otherPairs.length.toLocaleString()} spans across ${distinct(otherPairs).toLocaleString()} drops`)
console.log(`  theme inside another highlight    : ${themeInside.length.toLocaleString()} spans across ${distinct(themeInside).toLocaleString()} drops`)
console.log('\n  the pairs that ROTATE, most common first:')
for (const [k, n] of Object.entries(pairTally).sort((x, y) => y[1] - x[1])) console.log(`    ${String(n).padStart(5)}  ${k}`)
console.log('\nwrote audit/overlay-audit.json\n')
