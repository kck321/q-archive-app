// Canonical source-unit coverage — the number this project has never actually calculated.
//
// THE QUESTION: of all meaningful Q-authored source units in the 4,966 drops, how many have no
// certified classification and no explicit disposition at all?
//
// It cannot be answered by adding or subtracting section totals. The sections deliberately
// overlap — one sentence can be a Question and a Directive and carry Emphasis and an Entity —
// so arithmetic over the totals is mathematically invalid. The only honest method is to start
// from the raw text, divide it into units with the SAME segmentation the certified audits used,
// and ask of each unit whether anything certified touches it.
//
// This audit CONSUMES certified artifacts. It runs no classifier of its own: if it re-decided
// what a question is, it would answer a different question than the one the archive certified.
// Where it finds text no section claims, it reports it — it never fills the gap by relabelling.
//
// AUDIT ONLY. No production write. All eight sections frozen.
//
//   node scripts/audit-source-coverage.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { imperativeMood, learnVerbsFromCorpus, familyOf } from './lib/imperative.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')

const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const posts = read('posts.json')
const questions = read('questions.json')
const evidence = read('evidence.json')
const entities = read('entities.json')
const codes = read('codes.json')
// EMPHASIS IS RETIRED (owner ruling, 2026-08-21) — the section, its data and its artifact. Kept as
// an empty stand-in rather than deleted from the code, so this script keeps running and reports a
// truthful ZERO instead of crashing on a missing file.
const emphasis = { occurrences: [] }
const queue = read('resolution-queue.json')

const nl = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

// ── certified layers, indexed per post ───────────────────────────────────────
const idx = new Map()
const put = (num, layer, text, extra) => {
  if (!idx.has(num)) idx.set(num, { questions: [], directives: [], claims: [], predictions: [], emphasis: [], evidence: [], unresolved: [], codes: [], entities: [] })
  idx.get(num)[layer].push({ t: nl(text), k: key(text ?? ''), raw: text, ...extra })
}

for (const q of questions) {
  if (q.occurrences === undefined) continue
  put(q.postNum, 'questions', q.unitText ?? q.text)
}
for (const p of posts) {
  for (const d of p.actionRequests ?? []) put(p.postNum, 'directives', d)
  for (const c of p.postAnalysis?.claims ?? []) put(p.postNum, 'claims', c)
  for (const c of p.postAnalysis?.predictions ?? []) put(p.postNum, 'predictions', c)
  for (const e of p.postAnalysis?.namedEntities ?? []) put(p.postNum, 'entities', e)
}
for (const o of emphasis.occurrences) {
  // A parallel-phrasing occurrence spans a run; each line of it is what a unit can match.
  const lines = o.type === 'parallel_phrasing' ? String(o.line).split(' / ') : [o.line]
  for (const l of lines) put(o.postNum, 'emphasis', l, { device: o.sourceText, type: o.type })
}
for (const i of evidence.items) put(i.postNum, 'evidence', i.value ?? i.label ?? '', { subtype: i.subtype })
for (const r of queue.rows) put(r.postNum, 'unresolved', r.sourceSpan || r.token, { kind: r.kind, id: r.id })
for (const c of codes.codes) for (const n of c.posts ?? []) for (const v of c.sourceTexts) put(n, 'codes', v, { codeType: c.codeType })

// Entity aliases, so a unit that is only a name can be recognised as one.
const aliasByPost = new Map()
for (const e of entities.entities) {
  for (const n of e.posts ?? []) {
    if (!aliasByPost.has(n)) aliasByPost.set(n, [])
    aliasByPost.get(n).push(nl(e.canonical), ...(e.aliases ?? []).map(a => nl(a.text)))
  }
}

// ── what a unit is, when no section claims it ────────────────────────────────
//
// These are DISPOSITIONS, not classifications. None of them says the text means something; each
// says why the text needs no analytical claim. Forcing a heading into Claims to reach 100% would
// corrupt the one number this whole project rests on.
const Q_SIGNATURE = /^(Q|Q!|Q\+|Anonymous|ANON)$|^Q\s*[!#]?[A-Za-z0-9!.\/+]{0,20}$/
const BOARD_META = /^(>>\d+|>>>\/[a-z]+\/|\d{1,2}\/\d{1,2}\/\d{2,4}|\(?(?:you|OP)\)?)$/i
const SEPARATOR = /^[\s\-_=~*+.:;,|/\\<>()[\]{}#^&%$@!?'"“”’·•—–…─-╿]+$/
const HEADING = /^[A-Z][A-Za-z0-9 '’&\/-]{0,48}:$/
const SHORT_LABEL = /^[^.?!]{1,44}$/          // a terse fragment with no sentence punctuation
const TIMESTAMP = /^\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i

// ── the proposition test ─────────────────────────────────────────────────────
//
// THE RULING: a bare terse fragment defaults to CONTEXT_OR_LABEL. It becomes a telegraphic claim
// only where local context supplies a proposition that could meaningfully be true or false.
//
// "Fake." floating alone is a label. "Picture authentic? / Fake." is a claim, because it answers
// the question and inherits its subject. The difference is never in the fragment — it is always
// in the line above it, which is why this reads context rather than vocabulary.
//
// Nothing here certifies anything. A fragment that passes becomes a CERTIFICATION CONFLICT for
// explicit review; the frozen Claims count does not move.

/** Predicative words that can carry a proposition once a subject is established. */
const PREDICATIVE = /^(fake|real|true|false|evil|good|dead|gone|compromised|confirmed|corrupt|guilty|innocent|clean|dirty|safe|complicit|coordinated|planned|staged|controlled|owned|bought|paid|protected|exposed|known|unknown|classified|active|inactive|closed|open|over|done|finished|next|coming|near|close|deep|dark|old|new)[.!]?$/i
/** A participle or -ed/-ing word is a predicate looking for a subject. */
const PARTICIPLE = /^[a-z]+(?:ed|ing)[.!]?$/i
/** Conclusion connectives: the fragment closes a reasoning sequence. */
const CONCLUSIVE = /^(therefore|thus|so|hence|result|conclusion|answer|because)/i
/** Never a proposition on its own, whatever the context. */
const PURE_LABEL = /^(\d[\d\/:.-]*|[A-Z]{1,5}|[A-Z][a-z]+)[.!]?$/

// The corpus teaches the imperative detector its verbs, exactly as the certified Directives
// audit does. Using the same function is the point: a second imperative test would drift from
// the one that produced the certified 2,422.
const LEARNED = learnVerbsFromCorpus(posts.map(p => clean(p.text ?? '')))

/**
 * An imperative, held to the standard the certified Directives audit used.
 *
 * imperativeMood() alone fires on a bare "Old." and "Relevant." — a single word out of context
 * looks exactly like a verb, and trusting it turned 4,252 labels into directives. Two extra
 * conditions come from what a directive actually is: it needs more than one word, and it has to
 * land in one of the seven certified families. `other` means the family rules did not recognise
 * it, which is a reason to leave it alone rather than to file it.
 */
const isDirective = t => {
  if (t.trim().split(/\s+/).filter(Boolean).length < 2) return false
  if (!imperativeMood(t, LEARNED)) return false
  const fam = familyOf(t)
  return Boolean(fam) && fam !== 'other'
}

const dispositions = { DIRECTIVE_CONFLICT: [], CLAIM_CONFLICT: [], EVIDENCE_CONFLICT: [], QUESTION_CONFLICT: [], SEGMENTATION_CONFLICT: [], CODE_OR_EMPHASIS_CONFLICT: [], CONTEXT_BY_RULE: [], STILL_AMBIGUOUS: [] }

/**
 * Decide a terse fragment from the line before it.
 * Returns the promoting signal, or null when the fragment stays a label.
 */
function propositionSignal(unitText, prevLine, aliases) {
  const t = unitText.trim()
  const prev = (prevLine ?? '').trim()
  const wordCount = t.split(/\s+/).filter(Boolean).length

  // An isolated name is a name. This is checked first so "DARPA." can never be promoted by a
  // question sitting above it.
  const bare = t.replace(/[.!?]+$/, '').toLowerCase()
  if (aliases.some(a => a === bare)) return null
  if (PURE_LABEL.test(t) && !PREDICATIVE.test(t)) return null

  if (!prev) return null

  // 1 — the fragment answers the question immediately above it, and inherits its subject.
  if (/\?$/.test(prev) && wordCount <= 6) return 'answers_previous_question'

  // 2 — a predicative word or participle with an established antecedent above it.
  if ((PREDICATIVE.test(t) || PARTICIPLE.test(t)) && /[a-z]/i.test(prev) && prev.split(/\s+/).length >= 3) {
    return 'predicate_of_previous_subject'
  }

  // 3 — it closes a reasoning sequence.
  if (CONCLUSIVE.test(t)) return 'completes_reasoning_sequence'

  return null
}

const ledger = []
const counts = { CERTIFIED_ANALYSIS: 0, CONTEXT_OR_LABEL: 0, SOURCE_OR_REFERENCE: 0, UNRESOLVED_PENDING_REVIEW: 0, NON_ANALYTICAL_SOURCE_STRUCTURE: 0, TRUE_UNCATEGORIZED: 0 }
const byLayer = {}
const contextReasons = {}

for (const p of posts) {
  const cleaned = clean(p.text ?? '')
  const src = sourceLines(cleaned)
  const L = idx.get(p.postNum)
  const aliases = aliasByPost.get(p.postNum) ?? []

  for (const u of unitsFor(cleaned)) {
    const t = nl(u.text)
    const k = key(u.text)
    if (!t) continue

    const inSource = (() => { for (let i = u.startLine; i <= u.endLine; i++) if (src.has(i)) return true; return false })()

    // A unit is claimed by a layer when the certified occurrence and the unit are the same text,
    // or when the certified span sits inside the unit. Containment matters: Q writes several
    // sentences on one line, and a claim certified from one of them still covers that text.
    const hit = (layer) => {
      const list = L?.[layer] ?? []
      if (layer === 'evidence') {
        // The unit has to contain the reference, never the other way round: a pasted-passage
        // value runs to hundreds of characters and would otherwise claim every unit near it.
        return list.filter(x => x.t && x.t.length > 3 && t.includes(x.t))
      }
      return list.filter(x => x.t && (x.t === t || x.k === k || t.includes(x.t) || x.t.includes(t)))
    }
    const layers = {
      question: hit('questions').length > 0,
      directive: hit('directives').length > 0,
      claim: hit('claims').length > 0,
      prediction: hit('predictions').length > 0,
      emphasis: hit('emphasis').length > 0,
      evidence: hit('evidence').length > 0,
      code: (L?.codes ?? []).some(c => u.text.includes(c.raw)),
      unresolved: hit('unresolved').length > 0,
      entity: aliases.some(a => a.length > 2 && t.includes(a)),
    }
    for (const [k2, v] of Object.entries(layers)) if (v) byLayer[k2] = (byLayer[k2] ?? 0) + 1

    // ── status, in precedence order ──────────────────────────────────────────
    let status, why
    const primary = layers.question || layers.directive || layers.claim || layers.prediction
    const secondary = layers.emphasis || layers.code || layers.evidence

    if (primary) {
      status = 'CERTIFIED_ANALYSIS'
      why = Object.entries(layers).filter(([, v]) => v).map(([k2]) => k2).join(', ')
    } else if (inSource) {
      // Pasted material, already represented through Evidence & References. Checked BEFORE the
      // secondary layers: a caps word inside a quoted article is the article's formatting, and
      // calling that unit "certified analysis" would overstate what the archive knows about it.
      // Primary classifications still win above, because the adjudicated datasets outrank the
      // block detector — the known 123-post over-extension is on the detector's side.
      status = 'SOURCE_OR_REFERENCE'
      why = 'inside a quoted or pasted block'
    } else if (secondary) {
      status = 'CERTIFIED_ANALYSIS'
      why = Object.entries(layers).filter(([, v]) => v).map(([k2]) => k2).join(', ')
    } else if (Q_SIGNATURE.test(u.text.trim()) || BOARD_META.test(u.text.trim()) || SEPARATOR.test(u.text) || TIMESTAMP.test(u.text.trim())) {
      status = 'NON_ANALYTICAL_SOURCE_STRUCTURE'
      why = Q_SIGNATURE.test(u.text.trim()) ? 'Q signature' : BOARD_META.test(u.text.trim()) ? 'board metadata' : TIMESTAMP.test(u.text.trim()) ? 'timestamp' : 'separator or formatting'
    } else if (layers.unresolved) {
      status = 'UNRESOLVED_PENDING_REVIEW'
      why = 'held in the Resolution Center'
    } else if (HEADING.test(u.text.trim())) {
      status = 'CONTEXT_OR_LABEL'; why = 'heading'
    } else if (layers.entity && SHORT_LABEL.test(u.text.trim())) {
      status = 'CONTEXT_OR_LABEL'; why = 'a name or noun phrase, carried by Entities'
    } else if (SHORT_LABEL.test(u.text.trim())) {
      status = 'CONTEXT_OR_LABEL'; why = 'terse label or fragment'
    } else {
      // ── disposition pass ───────────────────────────────────────────────────
      // Everything that reaches here had no certified layer. Rather than leaving it
      // uncategorised, each unit gets an explicit disposition — and anything that looks like a
      // genuine miss becomes a CERTIFICATION CONFLICT for review rather than a silent insert.
      const tt = u.text.trim()
      const wc = tt.split(/\s+/).filter(Boolean).length
      const prevLine = (() => {
        const all = cleaned.split('\n')
        for (let i = u.startLine - 1; i >= 0; i--) {
          if (src.has(i)) continue
          const l = all[i].trim()
          if (l) return l
        }
        return ''
      })()

      if (/^(https?:|www\.)/i.test(tt)) {
        // A reference the Evidence audit missed, almost certainly to the known space-after-
        // protocol form. Not a disposition question — a defect.
        status = 'UNRESOLVED_PENDING_REVIEW'; why = 'Evidence certification conflict — reference not in the certified set'
        dispositions.EVIDENCE_CONFLICT.push({ postNum: p.postNum, text: tt })
      } else if (/\?$/.test(tt)) {
        status = 'UNRESOLVED_PENDING_REVIEW'; why = 'Questions certification conflict — asks something and is not in the certified set'
        dispositions.QUESTION_CONFLICT.push({ postNum: p.postNum, text: tt, prevLine })
      } else if (tt.length > 200) {
        status = 'UNRESOLVED_PENDING_REVIEW'; why = 'segmentation conflict — one unit holding several sentences'
        dispositions.SEGMENTATION_CONFLICT.push({ postNum: p.postNum, text: tt.slice(0, 240) })
      } else if (/^\[.*\]$/.test(tt)) {
        status = 'UNRESOLVED_PENDING_REVIEW'; why = 'Codes vs Emphasis adjudication'
        dispositions.CODE_OR_EMPHASIS_CONFLICT.push({ postNum: p.postNum, text: tt })
      } else if (wc > 6 && isDirective(tt)) {
        status = 'UNRESOLVED_PENDING_REVIEW'
        why = 'Directives certification conflict — imperative not in the certified set'
        dispositions.DIRECTIVE_CONFLICT.push({ postNum: p.postNum, text: tt, prevLine, family: familyOf(tt) })
      } else if (wc > 6) {
        // A full sentence with a subject and a verb that no section took. These are the likely
        // missed Claims and every one is listed for direct adjudication.
        status = 'UNRESOLVED_PENDING_REVIEW'; why = 'Claims certification conflict — a proposition no section claims'
        dispositions.CLAIM_CONFLICT.push({ postNum: p.postNum, text: tt, prevLine, claimBasis: 'standalone_proposition', verdict: null })
      } else if (isDirective(tt)) {
        // An imperative is a DIRECTIVE, whatever sits above it. "Know your rights." after a
        // question is not answering it, and "Try harder." is not a label — both were being
        // dispositioned as though the only choice were claim or context.
        status = 'UNRESOLVED_PENDING_REVIEW'
        why = 'Directives certification conflict — imperative not in the certified set'
        dispositions.DIRECTIVE_CONFLICT.push({ postNum: p.postNum, text: tt, prevLine, family: familyOf(tt) })
      } else {
        const signal = propositionSignal(tt, prevLine, aliases)
        if (signal) {
          status = 'UNRESOLVED_PENDING_REVIEW'
          why = `Claims certification conflict — telegraphic: ${signal}`
          // claimBasis makes the promotion auditable: the decision can be re-checked against the
          // line that justified it, rather than taken on trust because a script said so.
          dispositions.CLAIM_CONFLICT.push({ postNum: p.postNum, text: tt, prevLine, claimBasis: signal, verdict: null })
        } else {
          // The ruling's default. A reviewed disposition, not a gap.
          status = 'CONTEXT_OR_LABEL'
          why = layers.entity ? 'reviewed: a name or label, carried by Entities' : 'reviewed: label or fragment with no proposition'
          dispositions.CONTEXT_BY_RULE.push({ postNum: p.postNum, text: tt })
        }
      }
    }

    counts[status]++
    if (status === 'CONTEXT_OR_LABEL') contextReasons[why] = (contextReasons[why] ?? 0) + 1

    ledger.push({
      postNum: p.postNum, postId: p.id,
      unitId: `${p.postNum}:${u.startLine}:${ledger.filter(x => x.postNum === p.postNum).length}`,
      text: u.text, startLine: u.startLine, endLine: u.endLine, segConfidence: u.segConfidence,
      status, why, layers,
    })
  }
}

const total = ledger.length
const untouched = ledger.filter(r => r.status === 'TRUE_UNCATEGORIZED')
const accounted = total - untouched.length

// Where the uncategorised text actually sits, so the next pass has a work-list rather than a number.
const untouchedByPost = {}
for (const r of untouched) untouchedByPost[r.postNum] = (untouchedByPost[r.postNum] ?? 0) + 1
const worstPosts = Object.entries(untouchedByPost).sort((a, b) => b[1] - a[1]).slice(0, 25)

/**
 * The remainder is not one population, and reporting it as one number would hide the work.
 *
 * A terse fragment ending in a full stop — "Old.", "Fake.", "Real life." — is a disposition
 * question: label or telegraphic claim. A full sentence with a subject and a verb — "He
 * apologized the same day." — is a possible CERTIFICATION CONFLICT: a claim the Claims audit did
 * not take. Those need opposite treatment, so they are counted apart.
 */
const words = t => t.split(/\s+/).filter(Boolean).length
const shape = r => {
  const t = r.text.trim()
  if (/\?$/.test(t)) return 'ends with a question mark — possible missed Question'
  if (/^(https?:|www\.)/i.test(t)) return 'a URL'
  if (/^\[.*\]$/.test(t)) return 'fully bracketed'
  if (words(t) <= 3) return 'terse fragment (1-3 words) — label or telegraphic claim'
  if (words(t) <= 6) return 'short fragment (4-6 words)'
  if (/^(?:[A-Z][a-z]+|The|A|An|We|They|You|It|He|She|This|That|These|Those)[^?!]*[.]$/.test(t)) {
    return 'full sentence — possible missed Claim'
  }
  if (t.length > 200) return 'very long — probably several sentences'
  return 'other prose'
}
const shapes = {}
for (const r of untouched) shapes[shape(r)] = (shapes[shape(r)] ?? 0) + 1

fs.writeFileSync(path.join(OUT, 'coverage-dispositions.json'), JSON.stringify({
  note: 'Certification conflicts are REPORTED, never applied. Frozen section counts are unchanged.',
  totals: Object.fromEntries(Object.entries(dispositions).map(([k, v]) => [k, v.length])),
  dispositions,
}, null, 1))

fs.writeFileSync(path.join(OUT, 'source-unit-coverage.json'), JSON.stringify({
  scope: 'canonical source-unit coverage — audit only, production unchanged',
  productionChanged: false,
  totals: { units: total, accounted, byStatus: counts, coverage: +(accounted / total * 100).toFixed(3), byLayer, shapes },
  untouched: untouched.slice(0, 4000),
  // The CONTEXT_OR_LABEL units, emitted in full. These are reviewed Q-authored text that
  // legitimately belongs to no semantic category, and they are the largest reason the archive
  // still looks unaudited: 4,901 units that were read, dispositioned, and then rendered as plain
  // text indistinguishable from something nobody had looked at. The neutral treatment needs them
  // per post with their exact spans, so they ship here rather than staying a count in a report.
  contextUnits: ledger.filter(r => r.status === 'CONTEXT_OR_LABEL')
    .map(r => ({ postNum: r.postNum, postId: r.postId, text: r.text, why: r.why })),
  worstPosts,
}, null, 1))

const md = ['# Q Drops — canonical source-unit coverage\n']
md.push('The question this project has never actually answered: **of all meaningful Q-authored source units, how many have no certified classification and no explicit disposition?**\n')
md.push('\nIt cannot be answered by adding or subtracting section totals. The sections deliberately overlap — one sentence can be a Question and a Directive and carry Emphasis and an Entity — so arithmetic over the totals is invalid. This starts from the raw text, divides it with the same segmentation the certified audits used, and asks of each unit whether anything certified touches it. It consumes certified artifacts and runs **no classifier of its own**.\n')
md.push('\n## The number\n')
md.push('| | Units |')
md.push('|---|---|')
md.push(`| **Total canonical Q-authored units** | **${total.toLocaleString()}** |`)
md.push(`| Certified analytical classification | ${counts.CERTIFIED_ANALYSIS.toLocaleString()} |`)
md.push(`| Context, heading or label | ${counts.CONTEXT_OR_LABEL.toLocaleString()} |`)
md.push(`| Quoted or pasted source material | ${counts.SOURCE_OR_REFERENCE.toLocaleString()} |`)
md.push(`| Deliberately unresolved, tracked in /resolve | ${counts.UNRESOLVED_PENDING_REVIEW.toLocaleString()} |`)
md.push(`| Non-analytical structure (signature, separator, board metadata) | ${counts.NON_ANALYTICAL_SOURCE_STRUCTURE.toLocaleString()} |`)
md.push(`| **TRUE_UNCATEGORIZED** | **${untouched.length.toLocaleString()}** |`)
md.push(`\n**Coverage: ${(accounted / total * 100).toFixed(2)}%** of source units carry a certified classification or an explicit disposition.\n`)
md.push('\n## Which layers touch a unit\n')
md.push('Overlapping by design — these do not sum to the total.\n')
md.push('| Layer | Units touched |')
md.push('|---|---|')
for (const [k, n] of Object.entries(byLayer).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
md.push('\n## What the uncategorised text looks like\n')
md.push('| Shape | Units |')
md.push('|---|---|')
for (const [k, n] of Object.entries(shapes).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
md.push('\n## Posts holding the most uncategorised text\n')
md.push('| Post | Units |')
md.push('|---|---|')
for (const [n, c] of worstPosts) md.push(`| #${n} | ${c} |`)
md.push('\n## Samples\n')
md.push('| Post | Text |')
md.push('|---|---|')
for (let i = 0; i < Math.min(30, untouched.length); i++) {
  const r = untouched[Math.floor(i * untouched.length / Math.min(30, untouched.length))]
  md.push(`| #${r.postNum} | ${r.text.replace(/\|/g, '\\|').slice(0, 110)} |`)
}
md.push('\n## Context/label breakdown\n')
md.push('| Reason | Units |')
md.push('|---|---|')
for (const [k, n] of Object.entries(contextReasons).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
fs.writeFileSync(path.join(OUT, 'source-unit-coverage.md'), md.join('\n') + '\n')

console.log('\nCANONICAL SOURCE-UNIT COVERAGE\n')
console.log(`  total units                      : ${total.toLocaleString()}`)
for (const [k, n] of Object.entries(counts)) console.log(`  ${k.padEnd(32)} : ${n.toLocaleString()}`)
console.log(`\n  coverage                         : ${(accounted / total * 100).toFixed(2)}%`)
console.log(`\n  TRUE_UNCATEGORIZED               : ${untouched.length.toLocaleString()}`)
console.log('\n  shapes of the uncategorised:')
for (const [k, n] of Object.entries(shapes).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(6)}  ${k}`)
console.log('\n→ audit/source-unit-coverage.md\n')
