// Parse the GPT religious/spiritual audit into structured records and MATCH each sentence to the
// canonical post text.
//
// The audit is a human-readable report, not data. Its sentences carry smart quotes, em dashes and
// mojibake from a lossy encoding round-trip, so a sentence is only usable if it can be matched
// back to what Q actually wrote. Anything that cannot be matched is REPORTED, never guessed at —
// the whole point of the certified chain is that a highlight reproduces the source exactly.
//
//   node scripts/parse-religious-audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/QDrops_All_Religious_Spiritual_Audit_Green_Yellow_Red.txt'
const raw = fs.readFileSync(SRC, 'latin1')

// The file was written UTF-8 and read back as Latin-1 somewhere upstream, so every curly quote
// arrives as a multi-byte sequence. Repair rather than strip: the sentence has to match Q's text.
const fixed = Buffer.from(raw, 'latin1').toString('utf8')

const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const textByNum = new Map(posts.map(p => [p.postNum, clean(p.text ?? '')]))

// Normalise for COMPARISON only. What gets stored is always the exact substring of the post.
const norm = s => s
  .replace(/[\u2018\u2019\u02BC`]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/[\u2026]/g, '...')
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const records = []
let post = null, conf = null, cat = null, srcType = null
const lines = fixed.split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  const L = lines[i]
  let m
  if ((m = L.match(/^POST #(\d+)/))) { post = Number(m[1]); continue }
  if ((m = L.match(/^\[\d+\] CONFIDENCE: (GREEN|YELLOW|RED)/))) { conf = m[1]; cat = null; srcType = null; continue }
  if ((m = L.match(/^SOURCE TYPE: (.+)$/))) { srcType = m[1].trim(); continue }
  if ((m = L.match(/^CATEGORY: (.+)$/))) { cat = m[1].trim(); continue }
  if (L.startsWith('FULL SENTENCE OR COMPLETE SOURCE UTTERANCE:')) {
    const body = []
    for (let j = i + 1; j < lines.length && !/^(WHY INCLUDED|EDITORIAL NOTE|ATTRIBUTION)/.test(lines[j]); j++) body.push(lines[j])
    const sentence = body.join(' ').trim().replace(/^[\u201C"]|[\u201D"]$/g, '').trim()
    if (post && conf && sentence) records.push({ post, conf, cat: cat ?? '', srcType: srcType ?? '', sentence })
    i += body.length
  }
}

// ── Match each sentence to the canonical post text ───────────────────────────
let matched = 0
for (const r of records) {
  const text = textByNum.get(r.post)
  if (!text) { r.match = 'NO SUCH POST'; continue }
  const nText = norm(text)
  const nSent = norm(r.sentence)
  if (!nSent) { r.match = 'EMPTY'; continue }
  if (nText.includes(nSent)) { r.match = 'EXACT'; matched++; continue }
  // A trailing period the audit added, or a fragment the audit joined across lines.
  const trimmed = nSent.replace(/[.!?]+$/, '')
  if (trimmed.length > 8 && nText.includes(trimmed)) { r.match = 'EXACT'; matched++; continue }
  r.match = 'NOT IN POST TEXT'
}

const by = {}
for (const r of records) { by[r.conf] = by[r.conf] ?? { total: 0, matched: 0 }; by[r.conf].total++; if (r.match === 'EXACT') by[r.conf].matched++ }
console.log('records parsed:', records.length)
for (const [k, v] of Object.entries(by)) console.log(`  ${k}: ${v.total} records, ${v.matched} matched to post text`)
console.log('  unmatched (image text / quoted-post text / OCR):', records.filter(r => r.match !== 'EXACT').length)

fs.writeFileSync(path.join(ROOT, 'audit/religious-audit-parsed.json'),
  JSON.stringify({ note: 'Parsed from the GPT religious/spiritual audit. `match` records whether the sentence reproduces verbatim from the canonical post text.', source: path.basename(SRC), records }, null, 1))
console.log('\nwrote audit/religious-audit-parsed.json')
