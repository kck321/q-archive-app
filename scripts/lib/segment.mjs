// Shared segmentation and text hygiene for the audit scripts.
//
// Lifted VERBATIM from the frozen v2.1 questions auditor so the directive audit segments Q's
// text identically. Two auditors drawing unit boundaries differently would produce two
// incompatible datasets — which is exactly the duplicated-logic failure this project has hit
// four times already (two question rules, three highlighters, two month-count definitions,
// six chart axes).
//
// scripts/audit-all-questions-v2.mjs is FROZEN and still carries its own copy. When it is
// unfrozen, point it here and delete the copy rather than editing both.

const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const ENTITIES = [[/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"], [/&lt;/gi, '<'], [/&gt;/gi, '>']]

export const clean = t => {
  let o = (t ?? '').replace(MARKUP, '')
  for (const [r, c] of ENTITIES) o = o.replace(r, c)
  return o
}

export const key = t => clean(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

const CONTINUES = /[,;:]$|\b(and|or|but|of|to|in|on|for|with|from|the|a|an|that|which|while|when|if|by|as)$/i

/** Q-authored semantic units for one post. Quoted/anon lines are excluded. */
export function unitsFor(text) {
  const lines = clean(text).split('\n').map(l => l.trim())
  const out = []
  let i = 0
  while (i < lines.length) {
    let line = lines[i]
    const startLine = i
    if (!line) { i++; continue }
    if (/^>>\d+/.test(line)) { i++; continue }

    let joins = 0
    let segConfidence = 'HIGH'
    while (joins < 2 && i + 1 < lines.length) {
      const next = lines[i + 1]
      if (!next || /^>>\d+/.test(next)) break
      const incomplete = !/[?.!:…]$/.test(line) && (CONTINUES.test(line) || /^[a-z]/.test(next))
      if (!incomplete) break
      line = `${line} ${next}`
      i++
      joins++
      segConfidence = 'MEDIUM'
    }

    const parts = []
    const rx = /([?!.])(\s+)(?=[A-Z(“"']|\d)/g
    let last = 0, m
    while ((m = rx.exec(line)) !== null) { parts.push(line.slice(last, m.index + 1)); last = m.index + m[0].length }
    parts.push(line.slice(last))

    for (const part of parts.map(s => s.trim()).filter(Boolean)) {
      out.push({ text: part, startLine, endLine: i, segConfidence: parts.length > 1 && segConfidence === 'HIGH' ? 'MEDIUM' : segConfidence })
    }
    i++
  }
  return out
}

/** A unit that is a fragment of a split sentence rather than something Q wrote. */
export const SEGMENTATION_RISK = /(?:\b(?:[A-Z]\.){2,}|\b[A-Z]\.|\b(?:Adm|Gen|Sen|Rep|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs|v|No|Inc|Co|Corp|Dept|Est|approx|etc|al)\.)\s*$/i
export const STARTS_TRUNCATED = /^[A-Z]\.\s/
