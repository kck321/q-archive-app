// THE VERSE-BLOCK RULING, RESOLVED AGAINST THE POST TEXT.
//
// Owner ruling, 2026-08-23:
//
//   "i would like the whole verse to be a directive and lets make the whole verse as 1 directive
//    not multiples at the sentence breaks. lets do this across all the q post and for now lets
//    make the verse section example: – 1 Cor 13:4-13 and – Ephesians 6:10-18 an entity for now
//    until i can subsect the post later."
//
// So: a quoted passage of scripture is ONE Directive covering the whole passage — not one per
// sentence, and not scattered across Claims — and the reference label Q prints beside it
// ("– Ephesians 6:10-18") is an Entity.
//
// THIS REVERSES PART OF THE 2026-08-16 RELIGIOUS ADJUDICATION, deliberately. That pass removed 33
// directive occurrences with the ruling REMOVE_QUOTED_SCRIPTURE, on the reasoning that an
// imperative inside quoted scripture is not a Q-authored instruction. The owner has now ruled the
// passage itself IS the directive, so those sentences come back — as one unit each, not as the
// fragments they were.
//
// TWO WIDENINGS THE OWNER RULED ON, 2026-08-23, when shown the borderline cases:
//   · a scripture line Q compresses rather than quotes verbatim still counts — #37 "Fight the good
//     fight.", #4298 "Ask and you shall receive.", #4374 "Be strong in the Lord."
//   · prayer counts, both the liturgical (#154, the Lord's Prayer = Matthew 6:9-13) and the
//     composed (#4739), even though the composed one can carry no citation.
//
// WHY ANCHORS AND NOT OFFSETS. A block is stated as its first and last few words and resolved
// against the live post text here. Offsets rot the moment anything upstream re-ingests a drop;
// anchors either still match the text or fail loudly. Every anchor pair must resolve exactly once
// in its post — this script exits non-zero otherwise, and names the post.
//
// Q'S WORDING IS NEVER REWRITTEN. #1886 labels a quotation of 1 Cor 13:12 as "Corinthians
// 13:4-13", which is Q's error and is carried verbatim. The citation entity is the string Q typed.
//
// READ-ONLY with respect to certified data: it writes audit/scripture-owner-rulings.json and
// nothing else. scripts/apply-scripture-blocks.mjs is what materialises it.
//
//   node scripts/build-scripture-rulings.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byId = Object.fromEntries(posts.map(p => [String(p.id), p]))

/**
 * Every verse block, as [firstWords, lastWords] anchors into the post's own text.
 *
 * A single-sentence block repeats the sentence as both anchors. Curly quotes and apostrophes are
 * copied from the drop exactly — Q's text mixes ’ and ', and a straightened anchor will not match.
 */
const BLOCKS = {
  35:   [['For God so loved the world', 'Love is patient, love is kind.']],
  37:   [['Fight the good fight.', 'Fight the good fight.']],
  54:   [['For I know the plans I have for you', 'hope and a future.']],
  69:   [['The LORD is my shepherd', 'house of the LORD forever.']],
  154:  [['Our Father who art in heaven', 'but deliver us from evil.']],
  791:  [['For I know the plans I have for you', 'hope and a future.']],
  1432: [['Finally, be strong in the Lord', 'praying for all the saints.'],
         ['Love is patient, love is kind.', 'Love never fails.']],
  1646: [['Be on your guard; stand firm in the faith', 'be strong.']],
  1712: [['Put to death, therefore', 'the wrath of God is coming.']],
  1886: [['For now we see only a reflection', 'even as I am fully known.'],
         ['Finally, be strong in the Lord', 'praying for all the saints.']],
  2403: [['Finally, be strong in the Lord', 'praying for all the saints.']],
  2431: [['Be on your guard; stand firm in the faith', 'be strong.']],
  2744: [['But the Lord is faithful', 'protect you from the evil one.'],
         ['God is our refuge and strength', 'help in trouble.'],
         ['And lead us not into temptation', 'deliver us from the evil one.']],
  2904: [['Finally, be strong in the Lord', 'praying for all the Lord’s people.']],
  3593: [['Finally, be strong in the Lord', 'which is the word of God.']],
  3594: [['Finally, be strong in the Lord', 'which is the word of God.']],
  3683: [['Put on the full armor of God', 'against the devil’s schemes.']],
  3887: [['Finally, be strong in the Lord', 'praying for all the Lord’s people.']],
  3931: [['Be on your guard; stand firm in the faith', 'be strong.']],
  4207: [['Finally, be strong in the Lord', 'praying for all the Lord’s people.']],
  4298: [['Ask and you shall receive.', 'Ask and you shall receive.']],
  4374: [['Be strong in the Lord.', 'Be strong in the Lord.']],
  4390: [['The light of the righteous', 'the lamp of the wicked is extinguished.']],
  4397: [['Put on the full armor of God', 'against the devil\'s schemes.']],
  4429: [['Finally, be strong in the Lord', 'praying for all the Lord’s people.']],
  4463: [['Put on the full armor of God', 'in the heavenly realms.']],
  4739: [['Strengthen my faith, Lord.', 'Amen.']],
}

/** Every reference label Q prints, exactly as typed. Order does not matter; position decides. */
const CITATIONS = ['Jeremiah 29:11', 'Ephesians 6:10-18', '1 Cor 13:4-13', 'Colossians 3:5',
  'Corinthians 13:4-13', '1 Corinthians 16:13', '2 Thessalonians 3:3', 'Psalm 46:1',
  'Matthew 6:13', 'Proverbs 13:9']

/**
 * #522 prints "Jeremiah 29:11" and quotes nothing. The citation is still an entity — there is just
 * no passage to make a directive out of.
 */
const CITATION_ONLY = [{ post: 522, citation: 'Jeremiah 29:11' }]

/**
 * A citation binds to a block only when it sits against it. 60 characters covers "\n– Ephesians
 * 6:10-18" and the " - Psalm 46:1" that #2744 puts on the same line, and stops a label at the foot
 * of a long drop from claiming a passage at the top of it.
 */
const BIND_WINDOW = 60

const fail = []
const blocks = []

for (const [id, anchorPairs] of Object.entries(BLOCKS)) {
  const post = byId[id]
  if (!post) { fail.push(`#${id}: no such post`); continue }
  const text = String(post.text ?? '')

  // Where every citation sits in this drop, so a block can bind the nearest one.
  const sites = []
  for (const c of CITATIONS) {
    let from = 0, at
    while ((at = text.indexOf(c, from)) !== -1) { sites.push({ text: c, at, end: at + c.length }); from = at + c.length }
  }

  for (const [first, last] of anchorPairs) {
    const start = text.indexOf(first)
    if (start === -1) { fail.push(`#${id}: first anchor not found — ${JSON.stringify(first)}`); continue }
    if (text.indexOf(first, start + 1) !== -1) { fail.push(`#${id}: first anchor is ambiguous — ${JSON.stringify(first)}`); continue }
    const lastAt = text.indexOf(last, start)
    if (lastAt === -1) { fail.push(`#${id}: last anchor not found after the first — ${JSON.stringify(last)}`); continue }
    const end = lastAt + last.length
    const block = text.slice(start, end)

    const after = sites.filter(s => s.at >= end).sort((a, b) => a.at - b.at)[0]
    const before = sites.filter(s => s.end <= start).sort((a, b) => b.at - a.at)[0]
    let citation = null
    if (after && after.at - end <= BIND_WINDOW) citation = after.text
    else if (before && start - before.end <= BIND_WINDOW) citation = before.text

    blocks.push({
      post: Number(id),
      citation,
      words: block.split(/\s+/).filter(Boolean).length,
      // What the reader sees today: the same passage broken into this many separate rows.
      splitToday: {
        directives: (post.actionRequests ?? []).filter(s => contained(block, s)).length,
        claims: (post.postAnalysis?.claims ?? []).filter(s => contained(block, s)).length,
      },
      block,
    })
  }
}

/** Is `sentence` part of `block`? Compared on normalised text, because the arrays carry cleaned copies. */
function contained(block, sentence) {
  const n = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
  const s = n(sentence).replace(/^["']+|["']+$/g, '')
  return s.length > 12 && n(block).includes(s)
}

if (fail.length) {
  console.error('ANCHORS DID NOT RESOLVE — nothing written:\n  ' + fail.join('\n  '))
  process.exit(1)
}

blocks.sort((a, b) => a.post - b.post || b.words - a.words)

const distinctCitations = [...new Set([...blocks.map(b => b.citation).filter(Boolean),
  ...CITATION_ONLY.map(c => c.citation)])].sort()

const out = {
  note: 'Owner ruling 2026-08-23: a quoted passage of scripture is ONE Directive covering the whole '
      + 'passage, and the reference label beside it is an Entity. Resolved against post text by '
      + 'scripts/build-scripture-rulings.mjs; materialised by scripts/apply-scripture-blocks.mjs.',
  ruledOn: '2026-08-23',
  reverses: 'The REMOVE_QUOTED_SCRIPTURE and REMOVE_PRAYER_TEXT rulings in '
          + 'audit/directives-religious-adjudication.json, for the passages listed here.',
  totals: {
    blocks: blocks.length,
    posts: new Set(blocks.map(b => b.post)).size,
    citationOccurrences: blocks.filter(b => b.citation).length + CITATION_ONLY.length,
    distinctCitations: distinctCitations.length,
    splitTodayDirectives: blocks.reduce((n, b) => n + b.splitToday.directives, 0),
    splitTodayClaims: blocks.reduce((n, b) => n + b.splitToday.claims, 0),
  },
  distinctCitations,
  citationOnly: CITATION_ONLY,
  blocks,
}

fs.writeFileSync(path.join(ROOT, 'audit/scripture-owner-rulings.json'), JSON.stringify(out, null, 2))

console.log(`verse blocks       ${out.totals.blocks} across ${out.totals.posts} posts`)
console.log(`citation labels    ${out.totals.citationOccurrences} occurrences, ${out.totals.distinctCitations} distinct`)
console.log(`replaces           ${out.totals.splitTodayDirectives} directives + ${out.totals.splitTodayClaims} claims `
          + `= ${out.totals.splitTodayDirectives + out.totals.splitTodayClaims} rows today`)
console.log('written            audit/scripture-owner-rulings.json')
