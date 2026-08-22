// Diagnostic. Compares every public/data artifact on disk against the same file at a git ref,
// and reports what actually differs rather than only that the bytes do. Writes nothing.
//
//   node scripts/diag-bundle-diff.mjs [ref]        default HEAD
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const REF = process.argv[2] ?? 'HEAD'
const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12)

const files = fs.readdirSync(DATA).filter(f => f.endsWith('.json')).sort()
const atRef = f => {
  try { return execFileSync('git', ['show', `${REF}:public/data/${f}`], { cwd: ROOT, maxBuffer: 1 << 30 }) }
  catch { return null }
}

const count = (posts, field) => posts.reduce((n, p) => n + (p.postAnalysis?.[field]?.length ?? 0), 0)

for (const f of files) {
  const now = fs.readFileSync(path.join(DATA, f))
  const was = atRef(f)
  if (!was) { console.log(`NEW      ${f}`); continue }
  if (sha(now) === sha(was)) { console.log(`same     ${f}`); continue }
  console.log(`CHANGED  ${f}   ${sha(was)} -> ${sha(now)}   ${was.length} -> ${now.length} bytes`)

  if (f === 'posts.json') {
    const A = JSON.parse(was), B = JSON.parse(now)
    const FIELDS = ['claims', 'claimSpans', 'predictions', 'predictionSpans', 'namedEntities',
      'themeAnchors', 'contextUnits', 'emphasis', 'impliedConclusions', 'verificationHooks',
      'conclusionSpans', 'checkableSpans', 'themes', 'codes', 'brackets']
    for (const fl of FIELDS) {
      const a = count(A, fl), b = count(B, fl)
      if (a !== b) console.log(`           ${fl.padEnd(20)} ${a} -> ${b}   (${b - a >= 0 ? '+' : ''}${b - a})`)
    }
    const ar = A.reduce((n, p) => n + (p.actionRequests?.length ?? 0), 0)
    const br = B.reduce((n, p) => n + (p.actionRequests?.length ?? 0), 0)
    if (ar !== br) console.log(`           actionRequests       ${ar} -> ${br}`)
    // Q's own words must be byte-identical. Nothing in this chain may rewrite a drop.
    const textChanged = []
    const bByNum = new Map(B.map(p => [p.postNum, p]))
    for (const p of A) { const q = bByNum.get(p.postNum); if (q && String(p.text) !== String(q.text)) textChanged.push(p.postNum) }
    console.log(`           post text changed on ${textChanged.length} drops${textChanged.length ? ': ' + textChanged.slice(0, 10).join(', ') : ''}`)
  }

  if (f === 'entities.json') {
    const A = JSON.parse(was), B = JSON.parse(now)
    console.log(`           rows ${A.entities.length} -> ${B.entities.length}   mentions ${A.totals.mentions} -> ${B.totals.mentions}`)
    const a = new Set(A.entities.map(e => e.id)), b = new Set(B.entities.map(e => e.id))
    const gone = A.entities.filter(e => !b.has(e.id)).map(e => e.canonical)
    const added = B.entities.filter(e => !a.has(e.id)).map(e => e.canonical)
    if (gone.length) console.log(`           removed (${gone.length}): ${gone.join(' | ')}`)
    if (added.length) console.log(`           added   (${added.length}): ${added.join(' | ')}`)
  }

  if (f === 'questions.json') {
    const A = JSON.parse(was), B = JSON.parse(now)
    const a = new Map(A.map(r => [r.id, r])), b = new Map(B.map(r => [r.id, r]))
    console.log(`           records ${A.length} -> ${B.length}`)
    console.log(`           certified ${A.filter(r => r.occurrences !== undefined).length} -> ${B.filter(r => r.occurrences !== undefined).length}`)
    const onlyA = [...a.keys()].filter(k => !b.has(k)), onlyB = [...b.keys()].filter(k => !a.has(k))
    if (onlyA.length) console.log(`           ids gone: ${onlyA.slice(0, 10).join(', ')}`)
    if (onlyB.length) console.log(`           ids new : ${onlyB.slice(0, 10).join(', ')}`)
    let textDiff = 0, unitDiff = 0, litDiff = 0
    for (const [id, r] of a) { const s = b.get(id); if (!s) continue
      if (String(r.text) !== String(s.text)) textDiff++
      if (String(r.unitText ?? '') !== String(s.unitText ?? '')) unitDiff++
      if (String(r.literal ?? '') !== String(s.literal ?? '')) litDiff++ }
    console.log(`           text differs ${textDiff} · unitText differs ${unitDiff} · literal differs ${litDiff}`)
  }

  if (f === 'semantics.json') {
    const A = JSON.parse(was), B = JSON.parse(now)
    console.log(`           overlay occurrences ${A.occurrences?.length} -> ${B.occurrences?.length}`)
    console.log(`           actionsApplied ${A.actionsApplied} -> ${B.actionsApplied}   alreadyApplied ${A.actionsAlreadyApplied} -> ${B.actionsAlreadyApplied}   held ${A.actionsHeld} -> ${B.actionsHeld}`)
    const a = new Set((A.occurrences ?? []).map(o => o.actionId)), b = new Set((B.occurrences ?? []).map(o => o.actionId))
    const gone = [...a].filter(x => !b.has(x)), add = [...b].filter(x => !a.has(x))
    if (gone.length) console.log(`           actions with no overlay row now (${gone.length}): ${gone.slice(0, 12).join(', ')}`)
    if (add.length) console.log(`           new overlay rows (${add.length}): ${add.slice(0, 12).join(', ')}`)
  }

  if (f === 'relationships.json') {
    const A = JSON.parse(was), B = JSON.parse(now)
    const ra = A.relationships ?? A, rb = B.relationships ?? B
    const by = rs => rs.reduce((m, r) => ({ ...m, [r.type]: (m[r.type] ?? 0) + 1 }), {})
    console.log(`           edges ${ra.length} -> ${rb.length}`)
    const x = by(ra), y = by(rb)
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if ((x[k] ?? 0) !== (y[k] ?? 0)) console.log(`           ${k.padEnd(28)} ${x[k] ?? 0} -> ${y[k] ?? 0}`)
    }
  }

  if (f === 'search-index.json') {
    const A = JSON.parse(was), B = JSON.parse(now)
    const ra = A.records ?? A, rb = B.records ?? B
    const by = rs => rs.reduce((m, r) => ({ ...m, [r.kind ?? r.section]: (m[r.kind ?? r.section] ?? 0) + 1 }), {})
    console.log(`           records ${ra.length} -> ${rb.length}`)
    const x = by(ra), y = by(rb)
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if ((x[k] ?? 0) !== (y[k] ?? 0)) console.log(`           ${String(k).padEnd(28)} ${x[k] ?? 0} -> ${y[k] ?? 0}`)
    }
  }

  if (f === 'entity-public-view.json') {
    const A = JSON.parse(was), B = JSON.parse(now)
    const ka = Object.keys(A.rows ?? {}), kb = Object.keys(B.rows ?? {})
    console.log(`           rows ${ka.length} -> ${kb.length}`)
    if (A.totals || B.totals) console.log(`           totals ${JSON.stringify(A.totals)} -> ${JSON.stringify(B.totals)}`)
  }
}
