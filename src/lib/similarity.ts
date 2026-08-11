import type { SimilarGroup } from './posts'

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'do','does','did','of','in','to','for','with','at','by',
  'from','on','as','it','its','or','and','but','what','why',
  'how','who','when','where','which','that','this','these',
  'those','will','would','could','should','have','has','had',
])

// Strip trailing punctuation, lowercase, collapse whitespace
export function normalizeQ(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[?.!,;:]+$/, '')
    .replace(/\s+/g, ' ')
}

// Canonical form: prefer ending with '?', then longest
export function canonicalText(texts: string[]): string {
  const withQ = texts.filter(t => t.trim().endsWith('?'))
  const pool = withQ.length > 0 ? withQ : texts
  return pool.reduce((best, cur) => cur.length >= best.length ? cur : best)
}

// Token-based Jaccard similarity (ignores stop words)
function tokenize(text: string): Set<string> {
  return new Set(
    normalizeQ(text)
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  )
}

export function jaccardSimilarity(a: string, b: string): number {
  const na = normalizeQ(a)
  const nb = normalizeQ(b)
  if (na === nb) return 1.0

  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0

  let intersection = 0
  for (const w of ta) if (tb.has(w)) intersection++
  const union = ta.size + tb.size - intersection
  return union === 0 ? 0 : intersection / union
}

// Two-phase grouping:
//   Phase 1 — exact match after punctuation normalization (handles . vs ?)
//   Phase 2 — Jaccard fuzzy match within same 3-word prefix groups
export function findSimilarGroups(
  questions: { id: string; text: string }[],
  threshold = 0.85
): SimilarGroup[] {
  const result: SimilarGroup[] = []

  // ── Phase 1: exact normalized key groups ─────────────────────────────────
  const exactMap: Record<string, { id: string; text: string }[]> = {}
  for (const q of questions) {
    const key = normalizeQ(q.text)
    if (!exactMap[key]) exactMap[key] = []
    exactMap[key].push(q)
  }

  const assignedIds = new Set<string>()
  const representatives: { id: string; text: string; exactKey: string }[] = []

  for (const [key, group] of Object.entries(exactMap)) {
    if (group.length > 1) {
      // Multi-item exact group — merge them
      result.push({
        canonical: canonicalText(group.map(q => q.text)),
        ids: group.map(q => q.id),
        texts: group.map(q => q.text),
      })
      for (const q of group) assignedIds.add(q.id)
    }
    // One representative per exact group for phase 2
    representatives.push({ ...group[0], exactKey: key })
  }

  // ── Phase 2: fuzzy grouping by 3-word prefix ─────────────────────────────
  const prefixMap: Record<string, typeof representatives> = {}
  for (const rep of representatives) {
    if (assignedIds.has(rep.id)) continue
    const prefix = rep.exactKey.split(' ').slice(0, 3).join(' ')
    if (!prefixMap[prefix]) prefixMap[prefix] = []
    prefixMap[prefix].push(rep)
  }

  for (const candidates of Object.values(prefixMap)) {
    if (candidates.length < 2) continue

    const localAssigned = new Set<number>()
    for (let i = 0; i < candidates.length; i++) {
      if (localAssigned.has(i)) continue

      const matches: number[] = [i]
      for (let j = i + 1; j < candidates.length; j++) {
        if (localAssigned.has(j)) continue
        if (jaccardSimilarity(candidates[i].text, candidates[j].text) >= threshold) {
          matches.push(j)
        }
      }

      if (matches.length > 1) {
        // Expand each representative to include its full exact group
        const allIds: string[] = []
        const allTexts: string[] = []
        for (const idx of matches) {
          const rep = candidates[idx]
          const exactGroup = exactMap[rep.exactKey] ?? [rep]
          for (const q of exactGroup) {
            allIds.push(q.id)
            allTexts.push(q.text)
            assignedIds.add(q.id)
          }
          localAssigned.add(idx)
        }
        result.push({
          canonical: canonicalText(allTexts),
          ids: allIds,
          texts: allTexts,
        })
      }
    }
  }

  return result.filter(g => g.ids.length > 1)
}
