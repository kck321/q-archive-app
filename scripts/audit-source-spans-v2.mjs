// SOURCE SPANS v2 — standalone fixtures + 4,966-post shadow comparison.
//
// SHADOW MODE. Reads posts.json, writes only under audit/source-spans-v2/.
// sourceLines() and every one of its 15 consumers are untouched by this script.
//
//   node scripts/audit-source-spans-v2.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { sourceSpansV2, resolvePhrase, boardIdResolver, AUTHORSHIP, SOURCE_TYPE, STRUCTURE } from './lib/sourceSpansV2.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/source-spans-v2')
fs.mkdirSync(OUT, { recursive: true })

// The PRE-MIGRATION corpus, for the same reason v4 and v5 use it: these fixtures assert what the
// parser does to the phrases Q Directives USED to store. Several of those phrases have since been
// removed from the section by owner ruling, so reading them from live posts.json would quietly
// make the fixtures vacuous — `#4437`'s five code records and every blessing artefact would come
// back as empty strings and pass by accident.
const PRE = 'audit/backups/posts.pre-directives-v5.2705-153.json'
const CORPUS = fs.existsSync(path.join(ROOT, PRE)) ? PRE : 'public/data/posts.json'
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, CORPUS), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const resolveBoardId = boardIdResolver(posts)
const parse = p => sourceSpansV2(p, { resolveBoardId })

const esc = s => `"${String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')

// ── FIXTURES ─────────────────────────────────────────────────────────────────

const fixtures = []
const T = (id, label, ok, got, want) => fixtures.push({ id, label, pass: Boolean(ok), got: String(got), want: String(want) })

const spanFor = (pn, frag) => {
  const parsed = parse(byNum.get(pn))
  const r = resolvePhrase(parsed, frag)
  return { parsed, r }
}

// #3 — the headline defect. sourceLines() marks this Q sentence as a pasted passage.
{
  const { r } = spanFor(3, "Don’t you think POTUS would be tweeting about removal given clear conflict.")
  T('#3', '#3 "…tweeting about removal…" is Q-authored', r.authorshipState === AUTHORSHIP.Q, r.authorshipState, AUTHORSHIP.Q)
  T('#3', '#3 … with sourceType Q_BODY', r.sourceType === SOURCE_TYPE.Q_BODY, r.sourceType, SOURCE_TYPE.Q_BODY)
  T('#3', '#3 … at HIGH confidence (not held)', r.confidence === 'HIGH', r.confidence, 'HIGH')
  T('#3', '#3 … and is not quoted', r.authorshipState !== AUTHORSHIP.QUOTED, r.authorshipState, 'not QUOTED_OR_EMBEDDED')
  const old = sourceLines(clean(byNum.get(3).text)).has(2)
  T('#3', '#3 the defect being fixed is real in sourceLines()', old === true, `sourceLines marks line 2 quoted: ${old}`, 'true')
}

// #10 — must NOT inherit the old confident quoted ruling, and must NOT be confidently flipped.
{
  const a = spanFor(10, 'Remember, the FBI, and MI, have an open investigation into the CF.')
  const b = spanFor(10, 'Dig!!!!!')
  const held = s => s.r.authorshipState === AUTHORSHIP.AMBIGUOUS || s.r.confidence === 'LOW'
  T('#10', '#10 "Remember, the FBI…" is held, not resolved', held(a), `${a.r.authorshipState}/${a.r.confidence}`, 'AMBIGUOUS or LOW')
  T('#10', '#10 "Dig!!!!!" is held, not resolved', held(b), `${b.r.authorshipState}/${b.r.confidence}`, 'AMBIGUOUS or LOW')
  T('#10', '#10 did not inherit the confident quoted ruling', a.r.sourceType !== SOURCE_TYPE.QUOTED_ANONYMOUS_POST && a.r.sourceType !== SOURCE_TYPE.QUOTED_THIRD_PARTY, a.r.sourceType, 'not a quoted subtype')
}

// #146 — Q's own "Pray."
{
  const { r } = spanFor(146, 'Pray.')
  T('#146', '#146 "Pray." is Q-authored', r.authorshipState === AUTHORSHIP.Q, r.authorshipState, AUTHORSHIP.Q)
  T('#146', '#146 "Pray." sourceType Q_BODY', r.sourceType === SOURCE_TYPE.Q_BODY, r.sourceType, SOURCE_TYPE.Q_BODY)
}

// #147 — the SAME wording, reproduced. Must resolve to the quoted payload of #146.
{
  const { parsed, r } = spanFor(147, 'Pray.')
  T('#147', '#147 reproduced "Pray." is quoted, not new', r.authorshipState === AUTHORSHIP.QUOTED, r.authorshipState, AUTHORSHIP.QUOTED)
  T('#147', '#147 … sourceType QUOTED_PRIOR_Q_POST', r.sourceType === SOURCE_TYPE.QUOTED_PRIOR_Q_POST, r.sourceType, SOURCE_TYPE.QUOTED_PRIOR_Q_POST)
  T('#147', '#147 … referencedPostNum 146', String(r.referencedPostNum) === '146', r.referencedPostNum, '146')
  T('#147', '#147 stores no Directive occurrence of its own', (byNum.get(147).actionRequests ?? []).length === 0, (byNum.get(147).actionRequests ?? []).length, 0)
  const g = resolvePhrase(parsed, 'God be with us all.')
  T('#147', '#147 "God be with us all." is Q-authored', g.authorshipState === AUTHORSHIP.Q, g.authorshipState, AUTHORSHIP.Q)
  T('#147', '#147 … sourceType Q_BODY', g.sourceType === SOURCE_TYPE.Q_BODY, g.sourceType, SOURCE_TYPE.Q_BODY)
}

// Signature artefacts — rule 7.
for (const pn of [349, 353, 393, 394, 434, 767, 1025]) {
  const stored = (byNum.get(pn).actionRequests ?? []).find(x => /^(god ?bless|godspeed)/i.test(x)) ?? ''
  const { parsed, r } = spanFor(pn, stored)
  const sigSpans = parsed.spans.filter(s => s.structure === STRUCTURE.SIGNATURE)
  T(`#${pn}`, `#${pn} "${stored}" now locates`, r.authorshipState !== AUTHORSHIP.NOT_LOCATED, r.authorshipState, 'located')
  T(`#${pn}`, `#${pn} Q signature is its own span`, sigSpans.length > 0, `${sigSpans.length} signature span(s)`, '≥1')
  T(`#${pn}`, `#${pn} sentence text excludes the signature`, !/\bQ$/.test(r.spanText.trim()), JSON.stringify(r.spanText), 'no trailing Q')
}

// URL-concatenation artefacts — rule 8.
const URL_FIXTURES = [
  [2382, 'Re_read drops re: Polls https://www.oge.gov/web/oge.nsf/Resources/Political+Activities https://osc.gov/resources/ha%20pamphlet%20sept%202014.pdf', 'Re_read drops re: Polls'],
  [3819, 'Read [1] https://www.miamiherald.com/news/politics-government/article237959369.html', 'Read [1]'],
  [2351, 'DO NOT LOOK HERE [CHINA] https://www.youtube.com/watch?v=aeVrMniBjSc', 'DO NOT LOOK HERE [CHINA]'],
  [2378, 'DO NOT LOOK HERE [CHINA] https://www.youtube.com/watch?v=aeVrMniBjSc', 'DO NOT LOOK HERE [CHINA]'],
]
for (const [pn, stored, want] of URL_FIXTURES) {
  const { parsed, r } = spanFor(pn, stored)
  T(`#${pn}`, `#${pn} URL-concatenated record now locates`, r.authorshipState !== AUTHORSHIP.NOT_LOCATED, r.authorshipState, 'located')
  T(`#${pn}`, `#${pn} clean sentence recovered`, r.spanText.trim() === want, JSON.stringify(r.spanText), JSON.stringify(want))
  T(`#${pn}`, `#${pn} URL is a separate span`, r.urlStripped.length > 0 && !r.spanText.includes('http'), JSON.stringify(r.urlStripped).slice(0, 70), 'URL cut out')
  T(`#${pn}`, `#${pn} the URL line has its own span`, parsed.spans.some(s => s.structure === STRUCTURE.URL), 'URL span present', 'present')
}

// #4437 — scraped JavaScript, rule 9.
//
// The phrases are LITERALS, not read from p.actionRequests. Q Directives has since migrated and
// these five records were removed from it by owner ruling, so reading them from the live post
// would make this fixture vacuous the moment the migration landed — which is exactly what it did.
// A parser fixture must test the parser, not the current contents of the section.
{
  const p = byNum.get(4437)
  const parsed = parse(p)
  const STORED_4437 = [
    "find('input.js-password-field').set(ENV['TWITTER_PASSWORD']) click_on('Log in') end",
    'end',
    "find('input.js-username-field').set(ENV['TWITTER_USERNAME'])",
    "find('input.js-password-field').set(ENV['TWITTER_PASSWORD'])",
    "find('input.FormControl').set(url)",
  ]
  const rows = STORED_4437.map(a => ({ a, r: resolvePhrase(parsed, a) }))
  const code = rows.filter(x => x.r.sourceType === SOURCE_TYPE.CODE_OR_TECHNICAL_TEXT)
  T('#4437', '#4437 every stored find(…) record is CODE_OR_TECHNICAL_TEXT', code.length === rows.length, `${code.length}/${rows.length}`, `${rows.length}/${rows.length}`)
  T('#4437', '#4437 the multi-line find/click_on/end record now locates',
    rows[0].r.authorshipState !== AUTHORSHIP.NOT_LOCATED, rows[0].r.authorshipState, 'located')
  T('#4437', '#4437 nothing in it reads as the English verb "find"',
    rows.every(x => x.r.sourceType === SOURCE_TYPE.CODE_OR_TECHNICAL_TEXT), 'all code', 'all code')
}

// #3896 — Q's own greentext arrows must not read as board excerpts.
{
  const { parsed, r } = spanFor(3896, '>Push new/revised P_2020 > vote by mail? [unsecure] https://twitter.com/TomFitton/status/1242071506445885441')
  T('#3896', '#3896 greentext+URL record now locates', r.authorshipState !== AUTHORSHIP.NOT_LOCATED, r.authorshipState, 'located')
  T('#3896', '#3896 Q\'s own ">" bullets are not quoted', r.authorshipState === AUTHORSHIP.Q, r.authorshipState, AUTHORSHIP.Q)
  T('#3896', '#3896 URL split off the arrow line', !r.spanText.includes('http'), JSON.stringify(r.spanText), 'no URL')
  const oldQuoted = [...sourceLines(clean(byNum.get(3896).text)).values()].filter(v => v === 'greentext excerpt').length
  T('#3896', '#3896 the defect being fixed is real in sourceLines()', oldQuoted >= 8, `${oldQuoted} lines called greentext excerpt`, '≥8')
}

// Quoted Armor of God commands.
{
  const armor = posts.filter(p => /put on the (full|whole) armou?r of god/i.test(clean(p.text ?? '')))
  const hits = armor.map(p => {
    const parsed = parse(p)
    return parsed.spans.some(s => s.sourceType === SOURCE_TYPE.QUOTED_SCRIPTURE)
  })
  T('scripture', 'Armor of God passages carry QUOTED_SCRIPTURE spans', armor.length > 0 && hits.every(Boolean), `${hits.filter(Boolean).length}/${armor.length} posts`, `${armor.length}/${armor.length}`)
}

// The Lord's Prayer — #154.
{
  const { parsed, r } = spanFor(154, 'Give us this day our daily bread, and forgive us our trespasses, as we forgive those who trespass against us,')
  T('#154', "#154 Lord's Prayer record now locates", r.authorshipState !== AUTHORSHIP.NOT_LOCATED, r.authorshipState, 'located')
  T('#154', '#154 … as QUOTED_PRAYER', r.sourceType === SOURCE_TYPE.QUOTED_PRAYER, r.sourceType, SOURCE_TYPE.QUOTED_PRAYER)
  T('#154', '#154 the prayer block is one contiguous span run', parsed.spans.filter(s => s.sourceType === SOURCE_TYPE.QUOTED_PRAYER).length >= 1, parsed.spans.filter(s => s.sourceType === SOURCE_TYPE.QUOTED_PRAYER).length, '≥1')
  const other = resolvePhrase(parsed, 'Remember, the more people there are, the more power the people have.')
  T('#154', '#154 Q\'s own line in the same post stays Q_BODY', other.sourceType === SOURCE_TYPE.Q_BODY, other.sourceType, SOURCE_TYPE.Q_BODY)
}

// Attached-image-only text never becomes body.
{
  const withMedia = posts.filter(p => (p.media?.length || p.refMedia?.length) && !(p.text ?? '').trim())
  const spans = withMedia.slice(0, 200).flatMap(p => parse(p).spans)
  const imgs = spans.filter(s => s.sourceType === SOURCE_TYPE.ATTACHED_IMAGE || s.sourceType === SOURCE_TYPE.SCREENSHOT)
  T('image', 'image-only posts produce ATTACHED_IMAGE/SCREENSHOT spans, never Q_BODY',
    imgs.length > 0 && spans.every(s => s.region !== 'ATTACHED_IMAGE' || s.authorshipState === AUTHORSHIP.QUOTED),
    `${imgs.length} image spans over ${withMedia.length} text-less posts`, '>0 and none Q-authored')
}

// "God bless." and "God bless and stay safe."
{
  const gb = posts.find(p => (p.actionRequests ?? []).some(a => /^god bless\.?$/i.test(a)))
  const r1 = resolvePhrase(parse(gb), (gb.actionRequests ?? []).find(a => /^god bless\.?$/i.test(a)))
  T('blessing', '"God bless." is Q-authored Q_BODY', r1.authorshipState === AUTHORSHIP.Q && r1.sourceType === SOURCE_TYPE.Q_BODY, `#${gb.postNum} ${r1.authorshipState}/${r1.sourceType}`, 'Q/Q_BODY')
  const gs = posts.find(p => (p.actionRequests ?? []).some(a => /^god bless and stay safe\.?$/i.test(a)))
  if (gs) {
    const r2 = resolvePhrase(parse(gs), (gs.actionRequests ?? []).find(a => /^god bless and stay safe\.?$/i.test(a)))
    T('blessing', '"God bless and stay safe." locates as one Q span', r2.authorshipState === AUTHORSHIP.Q, `#${gs.postNum} ${r2.authorshipState}`, AUTHORSHIP.Q)
  } else T('blessing', '"God bless and stay safe." present in the corpus', false, 'absent', 'present')
}

// A phrase occurring once in quoted material and once in the current body.
//
// Two distinct cases, and V2 must not confuse them:
//
//   (a) the body has it AND a separate quoted PAYLOAD reproduces it. The payload is its own
//       region and the analysis index is built from body text only, so this resolves to the
//       body and records the payload duplication. #316 "Expand your thinking." is the case.
//   (b) the BODY ITSELF carries the phrase in two different provenances and occurrence order
//       cannot pick one. That is the genuinely undecidable case -> AMBIGUOUS_MULTIPLE_MATCHES.
{
  let dual = null
  for (const p of posts) {
    if (!p.quotedPosts?.length) continue
    const parsed = parse(p)
    for (const a of (p.actionRequests ?? [])) {
      const r = resolvePhrase(parsed, a)
      if (r.authorshipState === AUTHORSHIP.Q && (r.alsoQuotedInPayload ?? 0) > 0) { dual = { p: p.postNum, a, r }; break }
    }
    if (dual) break
  }
  T('ambiguous', '(a) body + quoted-payload duplication resolves to the body', Boolean(dual),
    dual ? `#${dual.p} ${JSON.stringify(dual.a).slice(0, 40)} — also in payload ×${dual.r.alsoQuotedInPayload}` : 'none found', 'at least one')

  // (b) synthesised from real corpus text: a post whose body holds the phrase once as Q's own
  // line and once inside a scripture block, asked for occurrence 5 — past every real hit.
  const armor = posts.find(p => /put on the (full|whole) armou?r of god/i.test(clean(p.text ?? '')) && /\n/.test(p.text ?? ''))
  // #154 carries "and" in Q's own lines AND inside the Lord's Prayer block. Asked for an
  // occurrence past every real hit, there is no occurrence order left to decide on.
  const amb = resolvePhrase(parse(byNum.get(154)), 'and', 99)
  T('ambiguous', '(b) in-body mixed provenance past the occurrence index is AMBIGUOUS',
    amb.authorshipState === AUTHORSHIP.AMBIGUOUS, `#154 ${amb.authorshipState}`, AUTHORSHIP.AMBIGUOUS)
  T('ambiguous', '(b) … and never silently picks a side', amb.sourceType === SOURCE_TYPE.UNKNOWN, amb.sourceType, SOURCE_TYPE.UNKNOWN)
  T('ambiguous', 'the corpus still contains a scripture-block post to test against', Boolean(armor), armor ? `#${armor.postNum}` : 'none', 'present')
}

// A genuinely not-located sentence stays NOT_LOCATED and never becomes quoted.
{
  const r = resolvePhrase(parse(byNum.get(146)), 'this sentence appears in no Q drop anywhere')
  T('not-located', 'an absent phrase is NOT_LOCATED', r.authorshipState === AUTHORSHIP.NOT_LOCATED, r.authorshipState, AUTHORSHIP.NOT_LOCATED)
  T('not-located', 'NOT_LOCATED carries sourceType UNKNOWN, never a quoted subtype', r.sourceType === SOURCE_TYPE.UNKNOWN, r.sourceType, SOURCE_TYPE.UNKNOWN)
}

// ── OWNER RULING R2 — letter register is Q-authored ──────────────────────────
{
  const { parsed, r } = spanFor(51, 'Find peace.')
  T('#51', '#51 letter is Q-authored, not quoted', r.authorshipState === AUTHORSHIP.Q, r.authorshipState, AUTHORSHIP.Q)
  T('#51', '#51 sourceType is Q_BODY_LETTER_VOICE', r.sourceType === SOURCE_TYPE.Q_BODY_LETTER_VOICE, r.sourceType, SOURCE_TYPE.Q_BODY_LETTER_VOICE)
  const salut = parsed.spans.find(s => /Dear Patriot/i.test(s.exactText))
  T('#51', '#51 the whole letter carries one register', salut?.sourceType === SOURCE_TYPE.Q_BODY_LETTER_VOICE, salut?.sourceType ?? 'absent', SOURCE_TYPE.Q_BODY_LETTER_VOICE)
  T('#51', '#51 the `>>` pointer above it stays a pointer', parsed.spans.some(s => s.structure === STRUCTURE.POINTER), 'pointer span present', 'present')
  const g = resolvePhrase(parsed, 'God is with us.')
  T('#51', '#51 "God is with us." is Q-authored', g.authorshipState === AUTHORSHIP.Q, g.authorshipState, AUTHORSHIP.Q)
}

// ── OWNER RULING R3 — "Have faith in God." is Q's own line, not scripture ────
{
  const { r } = spanFor(4429, 'Have faith in God.')
  T('#4429', '#4429 "Have faith in God." is Q_BODY, not scripture', r.sourceType === SOURCE_TYPE.Q_BODY, r.sourceType, SOURCE_TYPE.Q_BODY)
  const armor = spanFor(4429, 'Put on the full armor of God, so that you can take your stand against the devil’s schemes.')
  T('#4429', '#4429 the pasted Ephesians block above it is still scripture', armor.r.sourceType === SOURCE_TYPE.QUOTED_SCRIPTURE, armor.r.sourceType, SOURCE_TYPE.QUOTED_SCRIPTURE)
}

// ── OWNER RULING R5 — sentence boundaries ────────────────────────────────────
{
  const { sentencesOf, sentenceContext } = await import('./lib/sourceSpansV2.mjs')
  const abbrev = 'Realize Soros, Clintons, Obama, Putin, etc. are all controlled by 3 families.'
  T('sentences', 'a sentence is not cut at "etc."', sentencesOf(abbrev).length === 1, `${sentencesOf(abbrev).length} sentences`, '1')
  const vs = 'Track donations vs. expenses.'
  T('sentences', 'a sentence is not cut at "vs."', sentencesOf(vs).length === 1, `${sentencesOf(vs).length} sentences`, '1')
  const three = 'List. Compare. Laugh.'
  T('sentences', 'three sentences on one line are three sentences', sentencesOf(three).length === 3, `${sentencesOf(three).length}`, '3')

  // The invariant that makes a displayed span trustworthy.
  let violations = 0, checked = 0
  for (const p of posts) {
    if (!(p.actionRequests ?? []).length) continue
    const parsed = parse(p)
    for (const a of p.actionRequests) {
      const rr = resolvePhrase(parsed, a)
      if (!rr.span) continue
      const sc = sentenceContext(parsed, rr.span)
      if (!sc) continue
      checked++
      const fold = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
      if (!fold(sc.fullSentence).includes(fold(rr.spanText || a))) violations++
    }
  }
  T('sentences', 'every recovered sentence contains its own phrase', violations === 0, `${violations} violations over ${checked} records`, `0 over ${checked}`)

  // #121 "List. Compare. Laugh." — whole sentences sharing a line are NOT fragments.
  const p121 = parse(byNum.get(121))
  const laugh = resolvePhrase(p121, 'Laugh.')
  const sc121 = sentenceContext(p121, laugh.span)
  T('sentences', '#121 "Laugh." shares a line but is not a fragment', sc121?.isMidSentenceFragment === false, `isMidSentenceFragment=${sc121?.isMidSentenceFragment}`, 'false')
  T('sentences', '#121 "Laugh." owns its own sentence', sc121?.fullSentence === 'Laugh.', JSON.stringify(sc121?.fullSentence), '"Laugh."')

  // #1252 — a genuine clipped fragment.
  const p1252 = parse(byNum.get(1252))
  const learn = resolvePhrase(p1252, 'Learn the TRUTH.')
  const sc1252 = sentenceContext(p1252, learn.span)
  T('sentences', '#1252 "Learn the TRUTH." IS a mid-sentence fragment', sc1252?.isMidSentenceFragment === true, `isMidSentenceFragment=${sc1252?.isMidSentenceFragment}`, 'true')
  T('sentences', '#1252 its full sentence is recovered', /it’s time to learn the truth\./i.test(sc1252?.fullSentence ?? ''), JSON.stringify(sc1252?.fullSentence), '"It’s time to learn the TRUTH."')
}

// clean() parity with the frozen segmenter — the local copy must not drift.
{
  const sample = posts.slice(0, 400).map(p => p.text ?? '')
  const same = sample.every(t => clean(t) === (async () => t)() || true)   // structural guard below
  const { cleanText } = await import('./lib/sourceSpansV2.mjs')
  const parity = sample.every(t => cleanText(t) === clean(t))
  T('hygiene', 'sourceSpansV2 cleanText() is identical to segment.mjs clean()', parity && same, parity ? 'identical over 400 posts' : 'DRIFTED', 'identical')
}

// ── 4,966-POST SHADOW COMPARISON ─────────────────────────────────────────────
//
// sourceLines() answers per LINE. V2 answers per SPAN. To compare them at all, V2's spans are
// projected back down to line verdicts, and the two line-level maps are diffed.

const DIRECTIONS = {
  UNCHANGED: 'UNCHANGED',
  OLD_Q_BODY_TO_NEW_QUOTED: 'OLD_Q_BODY_TO_NEW_QUOTED',
  OLD_QUOTED_TO_NEW_Q_BODY: 'OLD_QUOTED_TO_NEW_Q_BODY',
  OLD_Q_BODY_TO_NEW_NOT_LOCATED: 'OLD_Q_BODY_TO_NEW_NOT_LOCATED',
  OLD_QUOTED_TO_NEW_NOT_LOCATED: 'OLD_QUOTED_TO_NEW_NOT_LOCATED',
  OLD_UNKNOWN_TO_NEW_RESOLVED: 'OLD_UNKNOWN_TO_NEW_RESOLVED',
  AMBIGUOUS_MULTIPLE_MATCHES: 'AMBIGUOUS_MULTIPLE_MATCHES',
}

const changed = []
const counts = Object.fromEntries(Object.keys(DIRECTIONS).map(k => [k, 0]))
const v2States = { [AUTHORSHIP.Q]: 0, [AUTHORSHIP.QUOTED]: 0, [AUTHORSHIP.NOT_LOCATED]: 0, [AUTHORSHIP.AMBIGUOUS]: 0 }
const sourceTypeTally = {}
const postsChanged = new Set()
const early = []

for (const p of posts) {
  const text = clean(p.text ?? '')
  const lines = text.split('\n')
  const old = sourceLines(text)
  const parsed = parse(p)
  const bodySpans = parsed.spans.filter(s => s.region === 'BODY')

  // project spans -> per-line verdict
  const nv = new Map()
  for (const s of bodySpans) for (let i = s.startLine; i <= s.endLine; i++) nv.set(i, s)
  for (const s of parsed.spans) {
    v2States[s.authorshipState] = (v2States[s.authorshipState] ?? 0) + 1
    sourceTypeTally[s.sourceType] = (sourceTypeTally[s.sourceType] ?? 0) + 1
  }

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const wasQuoted = old.has(i)
    const s = nv.get(i)
    const nowQuoted = s ? s.authorshipState === AUTHORSHIP.QUOTED : false
    const nowAmbig = s ? s.authorshipState === AUTHORSHIP.AMBIGUOUS : false

    let dir
    if (nowAmbig) dir = DIRECTIONS.AMBIGUOUS_MULTIPLE_MATCHES
    else if (wasQuoted === nowQuoted) dir = DIRECTIONS.UNCHANGED
    else if (!wasQuoted && nowQuoted) dir = DIRECTIONS.OLD_Q_BODY_TO_NEW_QUOTED
    else dir = DIRECTIONS.OLD_QUOTED_TO_NEW_Q_BODY

    counts[dir]++
    if (dir === DIRECTIONS.UNCHANGED) continue
    postsChanged.add(p.postNum)
    changed.push({
      postNum: p.postNum, line: i,
      completeText: lines[i].trim(),
      oldProvenance: wasQuoted ? `QUOTED_OR_EMBEDDED (${old.get(i)})` : 'Q_AUTHORED_CURRENT_POST',
      newProvenance: s ? s.authorshipState : 'Q_AUTHORED_CURRENT_POST',
      sourceType: s ? s.sourceType : SOURCE_TYPE.Q_BODY,
      structure: s ? s.structure : STRUCTURE.PROSE,
      confidence: s ? s.confidence : 'HIGH',
      referencedPostNum: s?.referencedPostNum ?? '',
      direction: dir,
      reason: s ? s.structuralReason : '',
      affectedConsumers: '',
    })
  }

  // early 4chan format cohort — the WHOLE cohort, not a sample
  if (p.source === '4chan_pol') {
    const spanKinds = [...new Set(bodySpans.map(s => s.sourceType))].join('+')
    const oldQuotedLines = [...old.keys()].filter(i => (lines[i] ?? '').trim()).length
    const newQuotedLines = bodySpans.filter(s => s.authorshipState === AUTHORSHIP.QUOTED).reduce((n, s) => n + (s.endLine - s.startLine + 1), 0)
    const unresolved = bodySpans.filter(s => s.authorshipState === AUTHORSHIP.AMBIGUOUS).reduce((n, s) => n + (s.endLine - s.startLine + 1), 0)
    early.push({
      postNum: p.postNum, name: p.name ?? '', trip: p.trip ?? '',
      nonBlankLines: lines.filter(l => l.trim()).length,
      oldQuotedLines, newQuotedLines, unresolvedLines: unresolved,
      delta: newQuotedLines - oldQuotedLines,
      spanKinds,
      directives: (p.actionRequests ?? []).length,
      firstLine: (lines.find(l => l.trim()) ?? '').trim().slice(0, 120),
    })
  }
}

// consumers touched by each changed line
const CONSUMER_TOUCH = {
  Directives: p => (p.actionRequests ?? []).length > 0,
  Questions: p => Boolean(p.hasQuestions),
  Claims: p => (p.postAnalysis?.claims ?? []).length > 0,
  Codes: p => /\[[^\]]+\]/.test(p.text ?? ''),
  Emphasis: p => (p.postAnalysis?.emphasis ?? []).length > 0,
  Entities: p => (p.postAnalysis?.namedEntities ?? []).length > 0,
  Themes: p => (p.postAnalysis?.themes ?? []).length > 0,
}
for (const c of changed) {
  const p = byNum.get(c.postNum)
  c.affectedConsumers = Object.entries(CONSUMER_TOUCH).filter(([, f]) => f(p)).map(([k]) => k).join('|')
}

// ── writes ───────────────────────────────────────────────────────────────────

const diffCols = ['postNum', 'line', 'completeText', 'oldProvenance', 'newProvenance', 'sourceType', 'structure', 'confidence', 'referencedPostNum', 'direction', 'reason', 'affectedConsumers']
fs.writeFileSync(path.join(OUT, 'source-spans-v2-post-diff.csv'), csv(diffCols, changed))
fs.writeFileSync(path.join(OUT, 'source-spans-v2-post-diff.json'), JSON.stringify({ counts, v2States, sourceTypeTally, postsChanged: [...postsChanged].sort((a, b) => a - b), changed }, null, 1))

const earlyCols = ['postNum', 'name', 'trip', 'nonBlankLines', 'oldQuotedLines', 'newQuotedLines', 'unresolvedLines', 'delta', 'spanKinds', 'directives', 'firstLine']
fs.writeFileSync(path.join(OUT, 'source-spans-v2-early-4chan-review.csv'), csv(earlyCols, early))

const pass = fixtures.filter(f => f.pass).length
const regr = [
  '# sourceSpansV2 — standalone regression results',
  '',
  '**SHADOW MODE. NOT CERTIFIED.** `sourceLines()` is unchanged and all 15 consumers still call it.',
  '',
  `Fixtures: **${pass} / ${fixtures.length} pass**, ${fixtures.length - pass} fail.`,
  '',
  '| fixture | check | result | got | expected |',
  '|---|---|---|---|---|',
  ...fixtures.map(f => `| ${f.id} | ${f.label} | ${f.pass ? '✅ PASS' : '❌ FAIL'} | \`${f.got}\` | \`${f.want}\` |`),
  '',
].join('\n')
fs.writeFileSync(path.join(OUT, 'source-spans-v2-regression-results.md'), regr)

console.log(`fixtures: ${pass}/${fixtures.length} pass`)
for (const f of fixtures) if (!f.pass) console.log(`   FAIL  ${f.id}  ${f.label}\n         got ${f.got}\n         want ${f.want}`)
console.log('\nshadow line-verdict directions:')
for (const [k, v] of Object.entries(counts)) console.log(`   ${String(v).padStart(7)}  ${k}`)
console.log(`\nposts with provenance changes: ${postsChanged.size}`)
console.log('V2 span authorship totals:', JSON.stringify(v2States))
console.log('V2 source types:', JSON.stringify(sourceTypeTally))
console.log(`\nearly 4chan cohort reviewed: ${early.length} posts`)
console.log(`wrote ${path.relative(ROOT, OUT)}/  — nothing applied, nothing deployed`)
