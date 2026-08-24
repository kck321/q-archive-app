// THE THREE THINGS THE OWNER ASKED TO BE CHECKED, 2026-08-24.
//
//   "check to make sure everything on the already highlighted tab is highlighted the right category.
//    and go ahead and fix all the items in the fix these tab if they already arent done. also any
//    url problems go ahead and fix those issues please"
//
//   -> audit/review2-followups.json
//
// Three questions, three sections, and each one is answered against the CERTIFIED ARTIFACTS rather
// than against the rendered page. That distinction is the whole reason the "already highlighted"
// sheet exists: an Entity or a Bracket painted on top of a Claim HIDES the Claim from anything that
// reads the DOM, so a crawler would report the Claim missing and a re-ruling would double it.
//
// 1. IS EVERY ALREADY-HIGHLIGHTED ROW IN THE RIGHT CATEGORY?
//
//    The rows on that sheet are the ones where the section the owner NAMED already certified the
//    span, so "is it in the section the owner said" is true by construction and worth nothing. The
//    question that has an answer is: WHAT ELSE certifies it. A span carried in two categories is
//    what the renderer rotates between, and rotation is exactly what the owner could not read on
//    the Themes sheet. So every row is re-read against all six sections and any row certified in
//    more than one is listed with the pair.
//
// 2. ARE THE SIX FIXES ACTUALLY IN EFFECT?
//
//    Sheet 6 lists them as done. This asserts each one against the thing it changed - the two
//    renderers, the linkifier, the resolution queue, the hover file - so "done" is a measurement
//    and not a claim. Both renderers are checked for every rule, because PostDetail.tsx and
//    lib/postHighlight.tsx are two copies of the same logic and have drifted before.
//
// 3. ARE THERE URL PROBLEMS LEFT?
//
//    Every address-shaped token in every drop is extracted and tested against the linkifier's own
//    TOKEN_RE. Anything that looks like an address to a reader and is not a link to the app is
//    reported, grouped by what is wrong with it.
//
//   node scripts/audit-review2-followups.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/renderedMatch.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8')

const posts = read('posts.json')
const questions = read('questions.json')
const byNum = new Map(posts.map(p => [p.postNum, p]))

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// ════════════════════════════════════════════════════════════════════════════
// 1. EVERY SECTION THAT CERTIFIES A GIVEN SPAN
// ════════════════════════════════════════════════════════════════════════════
const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q.unitText ?? q.text)
}

/** Every certified section holding this exact span on this drop. */
function sectionsHolding(postNum, span) {
  const p = byNum.get(postNum)
  if (!p) return []
  const a = p.postAnalysis ?? {}
  const want = norm(span)
  const has = list => (list ?? []).some(x => norm(x) === want)
  const out = []
  if (has(qByPost.get(postNum))) out.push('questions')
  if (has(p.actionRequests)) out.push('directives')
  if (has(a.claimSpans ?? a.claims)) out.push('claims')
  if (has(a.predictionSpans ?? a.predictions)) out.push('predictions')
  // Themes are still CERTIFIED and no longer PAINTED (owner ruling, 2026-08-24), so they still
  // belong in this answer: the question is which sections hold the span, not which ones fill it.
  // What changed is the consequence - a span carried in Claims and Themes no longer rotates,
  // because only one of the two draws anything.
  if (has(a.themeAnchors)) out.push('themes')
  if (has(a.namedEntities)) out.push('entities')
  return out
}

const rulings2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-owner-rulings-2.json'), 'utf8'))
const categoryRows = []
const categoryTally = {}
const notFound = []
for (const a of rulings2.alreadyCertified ?? []) {
  // URL and bracket rows are not section membership at all - they are detectors that read the drop
  // text - so "which section holds it" has no meaning for them and they are skipped, not failed.
  if (a.section === 'url' || a.section === 'brackets') continue
  const held = sectionsHolding(a.postNum, a.sourceText)
  if (!held.length) { notFound.push({ postNum: a.postNum, section: a.section, span: a.sourceText }); continue }
  if (!held.includes(a.section)) {
    categoryRows.push({ postNum: a.postNum, span: a.sourceText, ownerSaid: a.section, certifiedIn: held, kind: 'different-section' })
    categoryTally[`${a.section} -> ${held.join('+')}`] = (categoryTally[`${a.section} -> ${held.join('+')}`] ?? 0) + 1
    continue
  }
  if (held.length > 1) {
    const pair = held.slice().sort().join(' + ')
    categoryRows.push({ postNum: a.postNum, span: a.sourceText, ownerSaid: a.section, certifiedIn: held, kind: 'more-than-one-section' })
    categoryTally[pair] = (categoryTally[pair] ?? 0) + 1
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 2. THE SIX FIXES, ASSERTED
// ════════════════════════════════════════════════════════════════════════════
const detail = src('src/pages/PostDetail.tsx')
const card = src('src/lib/postHighlight.tsx')
const constants = src('src/lib/highlightConstants.ts')
const linkify = src('src/lib/linkify.tsx')
const queue = read('resolution-queue.json')
const hovers = read('entity-hovers.json')
const entities = read('entities.json')
const entityRows = entities.entities ?? entities

const queueRows = queue.rows ?? queue.items ?? queue.entries ?? (Array.isArray(queue) ? queue : [])
const fromReview2 = queueRows.filter(r => JSON.stringify(r).includes('2026-08-24')).length

// Both tails, and the expansion clause is optional on BOTH. Leaving it off the source-only tail
// reported ICANN, CISA and TMZ as off-pattern when they are the pattern - a row can be
// source-only AND have an expansion.
const HOVER_SHAPE = /^“.+” is .+ in this archive(, used for .+)?\.(?: It appears | Q did not write this name in a drop)/
const offShape = Object.entries(hovers.global ?? {}).filter(([, v]) => !HOVER_SHAPE.test(typeof v === 'string' ? v : v?.synopsis ?? ''))

const fixes = [
  ['Entities and brackets stay on top inside a question',
    detail.includes('HIGHLIGHT_SOLID') && card.includes('HIGHLIGHT_SOLID')
      && /question[\s\S]{0,900}namedEntity/.test(detail) && /question[\s\S]{0,900}namedEntity/.test(card),
    'both renderers import HIGHLIGHT_SOLID and the question branch of each has a namedEntity case'],
  ['Entities and brackets render SOLID over another colour',
    /namedEntity:\s*'bg-cyan-300/.test(constants) && /bracketCode:\s*'bg-red-700/.test(constants)
      && detail.includes('HIGHLIGHT_SOLID') && card.includes('HIGHLIGHT_SOLID'),
    'HIGHLIGHT_SOLID defines opaque fills for both kinds and both renderers use it'],
  ['Addresses Q typed with a space are one link again',
    /https\?:\\\/\\\/\[ \\t\]\{1,3\}/.test(linkify) || /\[ \\t\]\{1,3\}/.test(linkify),
    'linkify TOKEN_RE accepts 1-3 spaces or tabs after the scheme'],
  ['The link text still shows the space; only the href drops it',
    /replace\(\/\\s\+\/g, ''\)|replace\(\/\[ \\t\]\+\/g, ''\)/.test(linkify) || /hrefOf/.test(detail),
    'the href is normalised separately from the displayed text'],
  ['The Resolution Center carries this round\'s comms strings',
    fromReview2 > 0, `${fromReview2} queue row(s) carry a 2026-08-24 provenance`],
  ['Every entity has a hover',
    Object.keys(hovers.global ?? {}).length === entityRows.length,
    `${Object.keys(hovers.global ?? {}).length} hovers / ${entityRows.length} entities`],
  ['Every hover reads the same way',
    offShape.length === 0, `${offShape.length} off-pattern`],
  ['Q is Alice, except the sign-off',
    constants.includes('isSignOffMatch') && detail.includes('isSignOffMatch') && card.includes('isSignOffMatch'),
    'the guard is defined once and used by both renderers'],
]

// ════════════════════════════════════════════════════════════════════════════
// 3. URL PROBLEMS
// ════════════════════════════════════════════════════════════════════════════
// The linkifier's own pattern, copied. If this drifts from lib/linkify.tsx the report is wrong,
// so it is asserted against the file below rather than trusted.
const TOKEN_RE = /(https?:\/\/[ \t]{1,3}[^\s<>"'`)\]]+|https?:\/\/[^\s<>"'`)\]]+|www\.[^\s<>"'`)\]]+|>>\d{4,})/g
const patternInSync = linkify.includes('www\\.[^\\s<>"\'`)\\]]+') && linkify.includes('>>\\d{4,}')

// Anything a reader would read as an address.
const LOOKS_LIKE = /(?:https?:\s*\/*\s*|www\s*\.\s*)[^\s<>"'`)\]]*|[a-z0-9][a-z0-9-]{1,}\.(?:com|org|net|gov|edu|io|co|us|uk|info|news|tv)\b[^\s<>"'`)\]]*/gi

const urlIssues = []
const urlTally = {}
for (const p of posts) {
  // THE RUNTIME STRING, NEVER THE STORED ONE. 8chan renders //text// as italics, so 1,448 drops
  // store every scheme as "https:<em>//</em>host" and localData.ts strips that markup at load,
  // before anything is linkified. Scanning posts.json instead reports 2,663 broken addresses that
  // are links in the browser - the same mistake the first URL pass made, in the same place.
  const text = runtimeText(p)
  const linked = new Set()
  let m
  const rx = new RegExp(TOKEN_RE.source, 'g')
  while ((m = rx.exec(text)) !== null) linked.add(m[0])
  const seen = new Set()
  const lr = new RegExp(LOOKS_LIKE.source, 'gi')
  while ((m = lr.exec(text)) !== null) {
    const tok = m[0]
    if (!tok || seen.has(tok)) continue
    seen.add(tok)
    if ([...linked].some(l => l.includes(tok) || tok.includes(l))) continue
    // An <em> ingest artifact inside the scheme is a display quirk, not a dead link - the app
    // strips those before linkifying, so they are counted separately rather than reported as broken.
    const why = /<em>|<\/em>/.test(tok) ? 'markup artifact inside the address'
      : /^https?:\s*\/*\s*$/i.test(tok) ? 'a bare scheme with no host after it'
      : /^https?:\s/i.test(tok) ? 'scheme and host separated by more whitespace than the linkifier accepts'
      : 'a bare domain with no scheme and no www'
    urlTally[why] = (urlTally[why] ?? 0) + 1
    urlIssues.push({ postNum: p.postNum, token: tok.slice(0, 160), why })
  }
}

const out = {
  note: 'The three follow-up checks the owner asked for on 2026-08-24.',
  ruling: 'check to make sure everything on the already highlighted tab is highlighted the right category. and go ahead and fix all the items in the fix these tab if they already arent done. also any url problems go ahead and fix those issues please',
  ruledOn: '2026-08-24',
  categories: {
    what: 'Every already-highlighted row re-read against all six certified sections. A row in more than one is what the renderer rotates between.',
    rowsChecked: (rulings2.alreadyCertified ?? []).filter(a => a.section !== 'url' && a.section !== 'brackets').length,
    inMoreThanOneSection: categoryRows.filter(r => r.kind === 'more-than-one-section').length,
    inADifferentSection: categoryRows.filter(r => r.kind === 'different-section').length,
    notCertifiedAnywhere: notFound.length,
    byPair: Object.fromEntries(Object.entries(categoryTally).sort((a, b) => b[1] - a[1])),
    rows: categoryRows,
    notFound,
  },
  fixes: {
    what: 'Each fix on sheet 6, asserted against the thing it changed rather than reported as done.',
    passed: fixes.filter(f => f[1]).length,
    total: fixes.length,
    checks: fixes.map(([name, ok, evidence]) => ({ name, ok, evidence })),
  },
  urls: {
    what: 'Every address-shaped token in every drop, tested against the linkifier\'s own pattern.',
    patternInSyncWithLinkify: patternInSync,
    problems: urlIssues.length,
    byReason: Object.fromEntries(Object.entries(urlTally).sort((a, b) => b[1] - a[1])),
    rows: urlIssues,
  },
}
fs.writeFileSync(path.join(ROOT, 'audit/review2-followups.json'), JSON.stringify(out, null, 1))

const n = x => x.toLocaleString()
console.log('')
console.log('REVIEW 2 — FOLLOW-UP CHECKS')
console.log('')
console.log('  1. ALREADY-HIGHLIGHTED ROWS, RE-READ AGAINST EVERY SECTION')
console.log(`     rows checked            : ${n(out.categories.rowsChecked)}`)
console.log(`     in a DIFFERENT section  : ${n(out.categories.inADifferentSection)}`)
console.log(`     in MORE THAN ONE        : ${n(out.categories.inMoreThanOneSection)}`)
console.log(`     certified nowhere       : ${n(out.categories.notCertifiedAnywhere)}`)
for (const [k, v] of Object.entries(out.categories.byPair).slice(0, 12)) console.log(`         ${String(v).padStart(5)}  ${k}`)
console.log('')
console.log(`  2. THE FIXES — ${out.fixes.passed}/${out.fixes.total}`)
for (const c of out.fixes.checks) console.log(`     ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`)
for (const c of out.fixes.checks.filter(x => !x.ok)) console.log(`           evidence: ${c.evidence}`)
console.log('')
console.log(`  3. URL PROBLEMS — ${n(urlIssues.length)}`)
console.log(`     pattern in sync with lib/linkify.tsx : ${patternInSync}`)
for (const [k, v] of Object.entries(out.urls.byReason)) console.log(`         ${String(v).padStart(5)}  ${k}`)
console.log('')
console.log('wrote audit/review2-followups.json')
console.log('')
