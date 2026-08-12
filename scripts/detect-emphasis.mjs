// The "Emphasis" category — Q's staccato one-word beats.
//
// 59% of everything still unhighlighted is one or two words: "Old." / "Connection." /
// "News." / "BOOM." / "Confirmed." / "Important." They fit none of the eight existing
// categories — there is no assertion to be a claim, no forecast to be a prediction, no
// entity, no question. Forcing them into "claims" would corrupt every claim count in the
// app, so they get their own category instead.
//
// Detected structurally, with no API calls: a line of 1-3 words, not already classified,
// not a URL/bracket/pointer/signature.
//
//   node scripts/detect-emphasis.mjs [--apply]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const apply = process.argv.includes('--apply')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))

const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const clean = t => (t ?? '').replace(MARKUP, '')
const norm = t => clean(t).toLowerCase().replace(/\s+/g, ' ').replace(/[?.!,;:'"‘’“”]+$/, '').trim()
const CATS = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks']

const qByPost = new Map()
for (const q of questions) {
  if (!q?.postId) continue
  if (!qByPost.has(q.postId)) qByPost.set(q.postId, new Set())
  qByPost.get(q.postId).add(norm(q.text ?? ''))
}

// Lines that already mean something structural elsewhere in the app.
const SKIP = [
  /^>>\d+$/,                    // pointer — rendered as the quoted post
  /^Q\+?$/i,                    // signature
  /^!+$/,                       // "!!!"
  /^https?:/i,                  // URL — already linked
  /^\[.*\]$/,                   // [bracket] — its own category
  /^[\d\s:.\-/+()]+$/,          // numbers, timestamps, "+++"
  /^[-*•]\s/,                   // list item
  /^#\w+$/,                     // hashtag
  /^@\w+$/,                     // @handle — an entity, not emphasis
]

// Already highlighted by the static Q_SIGNATURES / MIL_INTEL lists in highlightConstants.ts.
// Filing these as "emphasis" would double-label them and would pre-empt the separate
// decision about promoting slogans to a category of their own.
const STATIC = new Set([
  'bad actor','bad actors','potus','flotus','scotus','declas','fisa','nsa','cia','fbi','doj','dni','dhs','dod','usmc',
  'sigint','humint','psyop','jsoc','socom','gitmo','eo','eas','defcon','stratfor','q clearance','top secret',
  'classified','compartmentalized','chain of command','military intelligence','special operations','covert',
  'clandestine','black site','executive order','national security','martial law','military tribunal','ucmj',
  'future proves past','think mirror','you are the news now','where we go one we go all','wwg1wga','trust the plan',
  'the great awakening','nothing can stop what is coming','ncswic','dark to light','sheep no more',
  'the storm is upon us','pain coming','godfather iii','white rabbit','follow the white rabbit','follow the money',
  'follow the pen','follow the watch','patriots in control','we have it all','coincidence',
  'do you believe in coincidences','logical thinking','enjoy the show','popcorn ready','buckle up','god wins',
  'in god we trust','for god and country','shall we play a game','who controls the narrative','expand your thinking',
  'the truth is behind you','these people are stupid','they never thought she would lose','the calm before the storm',
])

const MAX_WORDS = 3

let touched = 0, added = 0
const freq = new Map()

for (const p of posts) {
  const text = clean(p.text ?? '')
  if (!text) continue

  const own = new Set()
  const ownItems = []
  for (const c of CATS) for (const it of p.postAnalysis?.[c] ?? []) { own.add(norm(it)); ownItems.push(it) }
  for (const it of p.actionRequests ?? []) { own.add(norm(it)); ownItems.push(it) }
  for (const t of qByPost.get(p.id) ?? []) ownItems.push(t)
  const ownQ = qByPost.get(p.id) ?? new Set()

  // Which lines are already highlighted? Decided by matching each stored item against the
  // TEXT and marking the lines it lands on — the same way the app decides what to colour.
  //
  // Testing `longerItem.includes(shortLine)` instead is the substring trap all over again:
  // it hid "Connection." on #100 because an implied conclusion contains the word
  // "connections", and hid "Corruption." because a claim contains "corruption". Worse, most
  // impliedConclusions are paraphrases that never appear in the post at all, so they were
  // suppressing lines they do not even cover.
  const lines = text.split('\n')
  const starts = []
  let at = 0
  for (const l of lines) { starts.push(at); at += l.length + 1 }
  const marked = new Set()
  for (const it of ownItems) {
    const t = (it ?? '').trim()
    if (!t) continue
    try {
      const rx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      let m
      while ((m = rx.exec(text)) !== null) {
        const s = m.index, e = m.index + m[0].length
        for (let i = 0; i < lines.length; i++) {
          const ls = starts[i], le = ls + lines[i].length
          if (s < le && e > ls) marked.add(i)
        }
        if (m.index === rx.lastIndex) rx.lastIndex++
      }
    } catch { /* unusable stored item */ }
  }

  const hits = []
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line || marked.has(i)) return
    const k = norm(line)
    if (!k || k.length < 2) return
    if (SKIP.some(rx => rx.test(line))) return
    if (line.split(/\s+/).length > MAX_WORDS) return
    if (STATIC.has(k)) return
    if (own.has(k) || ownQ.has(k)) return
    if (hits.some(h => norm(h) === k)) return
    hits.push(line)
    freq.set(k, (freq.get(k) ?? 0) + 1)
  })

  if (hits.length) {
    touched++
    added += hits.length
    if (apply) {
      p.postAnalysis ??= {}
      p.postAnalysis.emphasis = hits      // recomputed, not appended — safe to re-run
    }
  }
}

console.log(`posts gaining emphasis items : ${touched.toLocaleString()} / ${posts.length}`)
console.log(`lines newly categorised      : ${added.toLocaleString()}`)
console.log(`distinct phrases             : ${freq.size.toLocaleString()}\n`)
console.log('most frequent:')
for (const [t, n] of [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`   ${String(n).padStart(4)}  ${t}`)
}

if (!apply) { console.log('\n(dry run — pass --apply to write)'); process.exit(0) }
fs.writeFileSync(path.join(DATA, 'posts.json'), JSON.stringify(posts))
console.log('\nwrote posts.json')
