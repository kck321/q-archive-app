// Export the rejected/unused religious-audit records for second-opinion review.
//
// Schema requested: post number, full source sentence, current category, proposed category,
// rejection reason, source type. Nothing here writes certified data or deploys — this is an
// export for review.
//
// It also runs the CONSERVATIVE NORMALIZATION recovery pass on the not-verbatim records:
// whitespace, line wrapping, quotation marks, punctuation and capitalization only. Substantive
// words are never altered. A record that recovers is reported as recoverable; it is NOT applied.
//
//   node scripts/export-religious-rejected.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { records } = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/religious-audit-classified.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const textByNum = new Map(posts.map(p => [p.postNum, clean(p.text ?? '')]))

// Conservative only. Quote shape, dash shape, ellipsis, entities, case, and run-together
// whitespace. No word is added, removed or replaced.
const soften = s => s
  .replace(/[‘’ʼ`]/g, "'")
  .replace(/[“”„]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'")
  .replace(/[ \s]+/g, ' ')
  .trim()
const key = s => soften(s).toLowerCase()

// Recover the EXACT canonical substring when the softened forms agree.
const recover = r => {
  const text = textByNum.get(r.post)
  if (!text) return null
  const soft = soften(text), lo = soft.toLowerCase()
  let probe = key(r.sentence)
  if (!probe) return null
  let at = lo.indexOf(probe)
  if (at < 0) { probe = probe.replace(/[.!?]+$/, ''); if (probe.length < 9) return null; at = lo.indexOf(probe) }
  if (at < 0) return null
  return soft.slice(at, at + probe.length)
}

const PROPOSED = r => {
  const c = (r.cat || '').toLowerCase()
  if (/great awakening/.test(c)) return 'Religiously Derived Language / Historical Religious Allusion'
  if (/evil|moral|purity|good versus/.test(c)) return 'Statements/Headings or Q Claims — moral register, not religion'
  if (/light|dark/.test(c)) return 'Statements/Headings — metaphor'
  if (/sheep|shepherd|flock/.test(c)) return 'Statements/Headings — metaphor'
  if (/awake|awakening/.test(c)) return 'Religiously Derived Language / Historical Religious Allusion'
  if (/sacrifice/.test(c)) return 'Q Claims or Statements/Headings — civic/military sacrifice'
  if (/faith|belief/.test(c)) return 'Statements/Headings — secular encouragement'
  if (/soul|spirit|heaven|hell/.test(c)) return 'Statements/Headings — idiom'
  return 'Needs Context'
}

const rows = []
for (const r of records) {
  if (r.keep && r.match === 'EXACT') continue      // already in the theme
  const notVerbatim = r.keep && r.match !== 'EXACT'
  const rec = notVerbatim ? recover(r) : null
  rows.push({
    post: r.post, confidence: r.conf, sentence: r.sentence,
    currentCategory: r.cat || '(none)',
    proposedCategory: notVerbatim ? 'Religion & Spirituality (source-typed)' : PROPOSED(r),
    rejectionReason: notVerbatim
      ? (rec ? 'NOT VERBATIM — RECOVERABLE by conservative normalization' : 'NOT VERBATIM — no canonical sentence recoverable (image / OCR / quoted-only text)')
      : `NOT RELIGIOUS — ${r.why}`,
    sourceType: r.srcType || '(unstated)',
    recoveredSentence: rec ?? '',
  })
}

const recoverable = rows.filter(r => r.rejectionReason.includes('RECOVERABLE')).length
const notVerbatim = rows.filter(r => r.rejectionReason.startsWith('NOT VERBATIM')).length
const notReligious = rows.filter(r => r.rejectionReason.startsWith('NOT RELIGIOUS')).length

fs.writeFileSync(path.join(ROOT, 'audit/religious-audit-rejected.json'), JSON.stringify({
  note: 'Records from the religious/spiritual audit NOT currently in the theme. Nothing here is applied.',
  totals: { rows: rows.length, notReligious, notVerbatim, recoverableByNormalization: recoverable },
  rows,
}, null, 1))

const esc = s => `"${String(s).replace(/"/g, '""')}"`
const csv = ['post_number,confidence,full_source_sentence,current_category,proposed_category,rejection_reason,source_type,recovered_canonical_sentence']
for (const r of rows) csv.push([r.post, r.confidence, r.sentence, r.currentCategory, r.proposedCategory, r.rejectionReason, r.sourceType, r.recoveredSentence].map(esc).join(','))
fs.writeFileSync(path.join(ROOT, 'audit/religious-audit-rejected.csv'), csv.join('\n'))

console.log(`\nrows exported            : ${rows.length}`)
console.log(`  not religious          : ${notReligious}`)
console.log(`  not verbatim           : ${notVerbatim}`)
console.log(`    of which RECOVERABLE : ${recoverable}  (conservative normalization only)`)
console.log(`    unrecoverable        : ${notVerbatim - recoverable}  (image / OCR / quoted-only)`)
console.log('\nwrote audit/religious-audit-rejected.json')
console.log('wrote audit/religious-audit-rejected.csv')
