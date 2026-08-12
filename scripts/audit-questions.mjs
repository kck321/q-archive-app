// Question extraction audit — how many questions Q actually asked, and what we missed.
//
// Answers with counts rather than estimates:
//   - how many questions exist in the posts
//   - how many we extracted
//   - which ones we MISSED (in the text, not in our data)
//   - which ones we INVENTED (in our data, not in the text)
//
// A "question" here follows the rule the app uses: a line that ends a sentence with ? . or !
// and was classified as a question. Q's punctuation is inconsistent — the same line appears
// as "Define stages?" and "Define stages." — so requiring "?" alone drops over a thousand
// real questions.
//
//   node scripts/audit-questions.mjs [--list-missed N]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8'))

const listMissed = process.argv.includes('--list-missed')
  ? Number(process.argv[process.argv.indexOf('--list-missed') + 1]) || 40
  : 0

// Same cleaning the app applies at load — the raw JSON carries board markup and entities.
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const ENT = [[/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"], [/&lt;/gi, '<'], [/&gt;/gi, '>']]
const clean = t => { let o = (t ?? '').replace(MARKUP, ''); for (const [r, c] of ENT) o = o.replace(r, c); return o }
const norm = t => clean(t).toLowerCase().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '').trim()

// The app's question rule, mirrored here so the audit measures what the app does.
function questionFormRegex(coreOrText) {
  const core = coreOrText.toLowerCase().replace(/\s+/g, ' ').replace(/[?.!,;:\s]+$/, '').trim()
  if (!core) return null
  const esc = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-z0-9])${esc}\\s*[?.!](?![a-z0-9])`, 'gi')
}

const byId = new Map(posts.map(p => [p.id, p]))

// ── what we stored ───────────────────────────────────────────────────────────
const storedByPost = new Map()
for (const q of questions) {
  if (!q?.postId) continue
  if (!storedByPost.has(q.postId)) storedByPost.set(q.postId, new Set())
  storedByPost.get(q.postId).add(norm(q.text))
}

const distinctStored = new Set(questions.map(q => norm(q.text)).filter(Boolean))

// ── what is actually in the posts ────────────────────────────────────────────
// Every line that ends a sentence. Interrogatives without punctuation cannot be detected
// mechanically, so this is the floor, not the ceiling.
const QUESTION_WORDS = /^(who|what|when|where|why|how|which|whose|whom|is|are|was|were|do|does|did|can|could|should|would|will|shall|have|has|had|if|define|name|think|explain)\b/i

let occurrencesVerified = 0
let missedOccurrences = 0
let ghostRows = 0
const postsWithQuestions = new Set()
const perPost = []
const missedSamples = []
const distinctInText = new Set()
const formCounts = { '?': 0, '.': 0, '!': 0 }

for (const p of posts) {
  const text = clean(p.text ?? '')
  if (!text) continue
  const stored = storedByPost.get(p.id) ?? new Set()

  let inThisPost = 0
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const term = line.slice(-1)
    const isSentence = term === '?' || term === '.' || term === '!'
    if (!isSentence) continue

    const k = norm(line)
    if (!k) continue

    // A question by our rule: ends with "?", OR reads as an interrogative and was
    // classified as one somewhere in the archive.
    const looksInterrogative = term === '?' || QUESTION_WORDS.test(line)
    if (!looksInterrogative) continue

    const isStoredHere = stored.has(k)
    const knownQuestion = distinctStored.has(k)

    if (isStoredHere) {
      occurrencesVerified++
      inThisPost++
      distinctInText.add(k)
      formCounts[term]++
    } else if (term === '?' || knownQuestion) {
      // In the text, reads as a question, but we never recorded it for this post.
      missedOccurrences++
      if (missedSamples.length < listMissed) missedSamples.push([p.postNum, line.slice(0, 88)])
    }
  }

  if (inThisPost > 0) {
    postsWithQuestions.add(p.postNum)
    perPost.push({ n: p.postNum, count: inThisPost })
  }

  // Stored rows pointing at text that does not ask them.
  //
  // Uses the APP'S rule (phrase followed by ? . or !), not whole-line equality. A question
  // can legitimately sit mid-line, and testing for a line match reported 1,867 "ghosts"
  // where the app's own rule finds far fewer. Auditing with a stricter rule than the code
  // uses produces a number that is true of nothing.
  for (const k of stored) {
    if (!k) continue
    const rx = questionFormRegex(k)
    if (rx && !rx.test(text)) ghostRows++
  }
}

perPost.sort((a, b) => b.count - a.count)
const counts = perPost.map(x => x.count)
const median = counts.length ? counts.slice().sort((a, b) => a - b)[Math.floor(counts.length / 2)] : 0

const pct = (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : '—'

console.log('\nQ QUESTION AUDIT — counted, not estimated\n')
console.log('SOURCE')
console.log(`  posts in archive                    : ${posts.length.toLocaleString()}`)
console.log(`  posts containing >=1 question       : ${postsWithQuestions.size.toLocaleString()}  ${pct(postsWithQuestions.size, posts.length)}`)
console.log(`  posts with none                     : ${(posts.length - postsWithQuestions.size).toLocaleString()}`)

console.log('\nHOW MANY QUESTIONS')
console.log(`  question occurrences (every ask)    : ${occurrencesVerified.toLocaleString()}`)
console.log(`  distinct questions (deduplicated)   : ${distinctInText.size.toLocaleString()}`)
console.log(`  average per questioning post        : ${(occurrencesVerified / Math.max(1, postsWithQuestions.size)).toFixed(1)}`)
console.log(`  median per questioning post         : ${median}`)
console.log(`  most in a single drop               : ${perPost[0]?.count ?? 0}  (#${perPost[0]?.n ?? '—'})`)

console.log('\nPUNCTUATION — why "count the ? marks" undercounts')
const totalForm = formCounts['?'] + formCounts['.'] + formCounts['!']
console.log(`  ends with "?"                       : ${formCounts['?'].toLocaleString()}  ${pct(formCounts['?'], totalForm)}`)
console.log(`  ends with "." (asked as statement)  : ${formCounts['.'].toLocaleString()}  ${pct(formCounts['.'], totalForm)}`)
console.log(`  ends with "!"                       : ${formCounts['!'].toLocaleString()}  ${pct(formCounts['!'], totalForm)}`)

console.log('\nEXTRACTION QUALITY')
console.log(`  stored question rows                : ${questions.length.toLocaleString()}`)
console.log(`  verified against post text          : ${occurrencesVerified.toLocaleString()}`)
console.log(`  rows whose text is NOT in the post  : ${ghostRows.toLocaleString()}  (dropped from the lists)`)
console.log(`  questions in the text we MISSED     : ${missedOccurrences.toLocaleString()}`)

console.log('\nTOP 10 MOST QUESTIONING DROPS')
for (const r of perPost.slice(0, 10)) console.log(`  #${String(r.n).padEnd(6)} ${r.count} questions`)

if (missedSamples.length) {
  console.log(`\nMISSED — in the post text, never extracted (first ${missedSamples.length})`)
  for (const [n, l] of missedSamples) console.log(`  #${String(n).padEnd(6)} ${l}`)
}
console.log()
