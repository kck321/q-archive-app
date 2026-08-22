// One-shot: the certification manifest counted the wrong question population, exactly as the
// cross-section invariant did. Both counted every row carrying an occurrences field; since
// Step 3B-1 that includes 182 records MARKED secondary or withdrawn rather than deleted, which the
// search index, the section headline and every certified total exclude.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(ROOT, 'scripts', 'certification-manifest.mjs')
let s = fs.readFileSync(p, 'utf8')
const swap = (a, b) => {
  if (!s.includes(a)) { console.error(`  X not found:\n${a.slice(0, 120)}`); process.exit(1) }
  s = s.replace(a, b)
}

swap(
`  questions: questions.filter(q => q.occurrences !== undefined).length,
  questionRowsShipped: questions.length,`,
`  // THE CERTIFIED POPULATION IS THE PRIMARY ONE. A question record Step 3B-1 marked secondary or
  // withdrawn keeps its occurrences field — the record is not deleted, which is asserted by its own
  // gate — so counting the field's presence counts 182 records no certified total includes.
  questions: questions.filter(q => q.occurrences !== undefined
    && (!q.semanticLayer || q.semanticLayer === 'primary')).length,
  questionRowsShipped: questions.length,`)

swap(
`  // DERIVED, not written twice. The shipped file is always the certified occurrence count plus the
  // 134 editorial normalisations, and that relationship IS the contract — a literal here went stale
  // the moment the 2026-08-20 queue ruling moved the certified figure and refused a healthy
  // manifest. 6,588 -> 6,653.
  questionRowsShipped: CANONICAL.questions.occurrences + 134,`,
`  // DERIVED, not written twice. The shipped file is the certified occurrence count, plus the
  // records Step 3B-1 MARKED rather than deleted, plus the 134 editorial normalisations. That
  // relationship IS the contract — a literal here went stale the moment the 2026-08-20 queue ruling
  // moved the certified figure and refused a healthy manifest, and the marked records made the
  // two-term version go stale the same way.
  questionRowsShipped: CANONICAL.questions.occurrences + 134
    + questions.filter(q => q.occurrences !== undefined && q.semanticLayer && q.semanticLayer !== 'primary').length,`)

fs.writeFileSync(p, s)
console.log('manifest question population corrected')
