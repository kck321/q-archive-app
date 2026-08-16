// Runtime-model span audit.
//
// SERIALIZATION PROVENANCE RULE: raw archive encoding is provenance; NORMALIZED RUNTIME TEXT is
// the rendering coordinate system. A span must resolve against the text the browser actually
// displays, never against a representation it never shows.
//
// stripBoardMarkup() runs at seed time and decodes the board's HTML entities — &amp; becomes &,
// &gt; becomes > — and strips its markup tags. So posts.json holds one representation and the
// browser holds another. Today's literal-span recovery matched the RAW file and materialised
// spans containing &amp; and &gt;, which the runtime body no longer contains. Those recoveries
// may have made rendering worse rather than better.
//
// This measures every recovered span against the runtime model and says which to keep and which
// to revert. AUDIT ONLY — writes no production data.
//
//   node scripts/audit-runtime-spans.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')

// ── the seed-time normalisation, transcribed from src/lib/localData.ts ──────
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const ENTITIES = [
  [/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"],
  [/&lt;/gi, '<'], [/&gt;/gi, '>'],
]
const runtime = t => {
  if (!t) return t ?? ''
  let out = t.includes('<') ? t.replace(MARKUP, '') : t
  if (out.includes('&')) for (const [rx, ch] of ENTITIES) out = out.replace(rx, ch)
  return out
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const resolvesIn = (text, term) => {
  if (!term || !term.trim()) return false
  const lead = /[A-Za-z0-9]/.test(term[0] ?? '') ? '(?<![A-Za-z0-9])' : ''
  const tail = /[A-Za-z0-9]/.test(term[term.length - 1] ?? '') ? '(?![A-Za-z0-9])' : ''
  try { return new RegExp(`${lead}${esc(term)}${tail}`, 'i').test(text) } catch { return false }
}
/** Whitespace-tolerant, for spans Q wrapped across lines. */
const resolvesLoose = (text, term) => {
  try {
    return new RegExp(term.split(/\s+/).map(esc).join('\\s+'), 'i').test(text)
  } catch { return false }
}

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const evidence = JSON.parse(fs.readFileSync(path.join(DATA, 'evidence.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const runtimeByNum = new Map(posts.map(p => [p.postNum, runtime(p.text ?? '')]))

const VERDICTS = ['CERTIFIED_VALUE_ALREADY_MATCHES_RUNTIME', 'HTML_ENTITY_RECOVERY_WRONG_FOR_RUNTIME',
  'WHITESPACE_RECOVERY_STILL_REQUIRED', 'BOTH_NORMALIZATIONS_REQUIRED', 'STILL_UNRESOLVED']
const byLayer = {}
const detail = []

/** certified = the semantic value; recovered = the literal span materialised today. */
function classify(layer, postNum, certified, recovered) {
  const text = runtimeByNum.get(postNum) ?? ''
  byLayer[layer] ??= Object.fromEntries(VERDICTS.map(v => [v, 0]))
  let verdict
  if (resolvesIn(text, certified)) {
    // The certified value already matches the browser text — any recovery was unnecessary, and
    // if it differs it is actively wrong.
    verdict = (recovered && recovered !== certified)
      ? 'HTML_ENTITY_RECOVERY_WRONG_FOR_RUNTIME'
      : 'CERTIFIED_VALUE_ALREADY_MATCHES_RUNTIME'
  } else if (recovered && resolvesIn(text, recovered)) {
    verdict = 'WHITESPACE_RECOVERY_STILL_REQUIRED'
  } else if (resolvesLoose(text, certified)) {
    verdict = 'BOTH_NORMALIZATIONS_REQUIRED'
  } else {
    verdict = 'STILL_UNRESOLVED'
  }
  byLayer[layer][verdict]++
  if (verdict !== 'CERTIFIED_VALUE_ALREADY_MATCHES_RUNTIME') {
    detail.push({ layer, postNum, verdict, certified: String(certified).slice(0, 100), recovered: recovered ? String(recovered).slice(0, 100) : null })
  }
}

for (const i of evidence.items) {
  if (i.kind === 'MEDIA' || !i.value) continue
  classify('evidence', i.postNum, i.value, i.literal ?? null)
}
for (const q of questions) {
  if (q.occurrences === undefined) continue
  classify('questions', q.postNum, q.unitText ?? q.text, q.literal ?? null)
}
for (const p of posts) {
  const a = p.postAnalysis
  if (!a) continue
  const pair = (field, spanField, layer) => (a[field] ?? []).forEach((t, idx) => classify(layer, p.postNum, t, a[spanField]?.[idx] ?? null))
  pair('claims', 'claimSpans', 'claims')
  pair('predictions', 'predictionSpans', 'predictions')
  pair('impliedConclusions', 'conclusionSpans', 'conclusions')
  pair('verificationHooks', 'checkableSpans', 'checkable')
  for (const u of a.contextUnits ?? []) classify('context', p.postNum, u, null)
  for (const t of a.themeAnchors ?? []) classify('themeAnchors', p.postNum, t, null)
  for (const d of p.actionRequests ?? []) classify('directives', p.postNum, d, null)
  for (const e of a.emphasis ?? []) classify('emphasis', p.postNum, e, null)
}

fs.writeFileSync(path.join(OUT, 'runtime-span-audit.json'), JSON.stringify({
  note: 'Every span measured against the RUNTIME body (seed-time entity decoding + markup stripping), not the raw posts.json representation.',
  byLayer, detail: detail.slice(0, 6000),
}, null, 1))

const totals = Object.fromEntries(VERDICTS.map(v => [v, Object.values(byLayer).reduce((n, l) => n + l[v], 0)]))
console.log('\nRUNTIME-MODEL SPAN AUDIT\n')
console.log('  layer            already-ok   entity-WRONG   ws-needed   both   unresolved')
for (const [l, v] of Object.entries(byLayer).sort((a, b) => b[1].HTML_ENTITY_RECOVERY_WRONG_FOR_RUNTIME - a[1].HTML_ENTITY_RECOVERY_WRONG_FOR_RUNTIME)) {
  console.log(`  ${l.padEnd(16)} ${String(v.CERTIFIED_VALUE_ALREADY_MATCHES_RUNTIME).padStart(9)} ${String(v.HTML_ENTITY_RECOVERY_WRONG_FOR_RUNTIME).padStart(14)} ${String(v.WHITESPACE_RECOVERY_STILL_REQUIRED).padStart(11)} ${String(v.BOTH_NORMALIZATIONS_REQUIRED).padStart(6)} ${String(v.STILL_UNRESOLVED).padStart(12)}`)
}
console.log('\n  TOTALS:')
for (const v of VERDICTS) console.log(`    ${String(totals[v]).padStart(6)}  ${v}`)
console.log('\n→ audit/runtime-span-audit.json\n')
