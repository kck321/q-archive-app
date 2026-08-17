// The shared matcher, against every shape that has fooled it or could.
//
//   node scripts/test-rendered-match.mjs
//
// This is the guard on the single definition of "can the reader see this name". Every case is
// either a failure that actually happened in this archive or a shape that would produce the same
// class of false entity if it were mishandled.
//
// The rule being protected, in two halves:
//   RENDERED, NOT STORED   — the question is asked of what the browser paints
//   COMPLETE TOKEN         — an alias inside a longer word is an extraction defect, not a mention
import {
  runtimeText, foldTokens, completeTokenMatch, containingWords,
  aliasLocation, classifyUrlDerived, urlSpans, gluedHostMatch, completeTokenRegex,
} from './lib/renderedMatch.mjs'

let failed = 0
const groups = []
let current = null
const group = name => { current = { name, rows: [] }; groups.push(current) }
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  current.rows.push({ ok, label, got, want })
}
const loc = (text, alias) => {
  const l = aliasLocation(text, alias)
  return { prose: l.inProse, url: l.inUrl, cls: l.inUrl && !l.inProse ? classifyUrlDerived(l) : null }
}

// ════════════════════════════════════════════════════════════════════════════
group('Encoded ampersands — the stored form is not the rendered form')
// #605 says `AT&amp;T`. Folded, that is "at amp t"; the alias "AT&T" folds to "at t". The company
// is plainly printed in the drop and the old check called it invisible. Three records for AT&T,
// two for McKinsey, one for Akin Gump were condemned this way.
check('AT&T is visible in a drop that stores AT&amp;T',
  completeTokenMatch('AT&amp;T&gt;No Such Agency [contract].', 'AT&T'), true)
check('McKinsey & Company is visible through the entity',
  completeTokenMatch('Read the McKinsey &amp; Company report.', 'McKinsey & Company'), true)
check('Akin Gump Strauss Hauer & Feld LLP is visible through the entity',
  completeTokenMatch('Akin Gump Strauss Hauer &amp; Feld LLP donated.', 'Akin Gump Strauss Hauer & Feld LLP'), true)
check('a decoded ampersand still matches',
  completeTokenMatch('AT&T > No Such Agency', 'AT&T'), true)
check('the raw entity is not left in the rendered text',
  /&amp;/.test(runtimeText('AT&amp;T')), false)

// ════════════════════════════════════════════════════════════════════════════
group('Board emphasis markup — 8chan italicised //')
// `https:<em>//</em>example.com` carries no "://" so the URL regex never fires. 1,236 of the
// corpus's 2,666 links were invisible to the URL classifier because of this one substitution.
check('https:<em>//</em> is a URL once rendered',
  urlSpans('see https:<em>//</em>www.foxnews.com/politics/x').length, 1)
check('and it is NOT a URL in the stored form the old check read',
  (String('see https:<em>//</em>www.foxnews.com/politics/x').match(/\bhttps?:\/\/\S+/gi) ?? []).length, 0)
check('a name inside such a link is URL-derived, not prose',
  loc('https:<em>//</em>www.foxnews.com/politics/trump-spying', 'Trump'),
  { prose: false, url: true, cls: 'url_path_fragment' })
check('other board markup is stripped too',
  completeTokenMatch('the <b>Guardian</b> reported', 'Guardian'), true)

// ════════════════════════════════════════════════════════════════════════════
group('God versus Godfather — a substring is not a mention')
// "God" is a certified entity in 47 drops, and every one of them says "Godfather III".
check('God is NOT a complete token in "Godfather III"',
  completeTokenMatch('Snow White\nGodfather III\nQ', 'God'), false)
check('and the containing word is named, so a human can see why',
  containingWords('Snow White\nGodfather III\nQ', 'God'), ['Godfather'])
check('Godspeed also contains it, and also is not a mention',
  containingWords('Godspeed.', 'God'), ['Godspeed.'])
check('God IS a mention when Q writes it',
  completeTokenMatch('May God bless the United States.', 'God'), true)
check('a real mention is never also reported as embedded',
  containingWords('God bless. Godfather III.', 'God'), [])

// ════════════════════════════════════════════════════════════════════════════
group('US inside because, must and trusted — invariant 4')
check('US is not found in "Because it must be trusted."',
  completeTokenMatch('Because it must be trusted.', 'US'), false)
check('each containing word is reported',
  containingWords('Because it must be trusted.', 'US'), ['Because', 'must', 'trusted.'])
check('US at the very start of a drop still matches',
  completeTokenMatch('US military assets deployed.', 'US'), true)
check('US at the very end still matches — the padding, not luck',
  completeTokenMatch('assets deployed to the US', 'US'), true)
check('US alone is the whole string',
  completeTokenMatch('US', 'US'), true)

// ════════════════════════════════════════════════════════════════════════════
group('Possessives, hyphens, punctuation')
check("a possessive is the same token — Trump's",
  completeTokenMatch("What did Trump's team know?", 'Trump'), true)
check('a trailing full stop does not break the token',
  completeTokenMatch('Follow the money. Soros.', 'Soros'), true)
check('a comma-separated name matches',
  completeTokenMatch('Comey, McCabe, Strzok.', 'McCabe'), true)
check('a hyphenated name matches its spaced spelling',
  completeTokenMatch('the Rothschild-Soros axis', 'Rothschild'), true)
check('a multi-word alias matches across a hyphen',
  completeTokenMatch('a presidential-advisory board', 'Presidential Advisory'), true)
check('a name split across a line break matches',
  completeTokenMatch('Hillary\nClinton', 'Hillary Clinton'), true)
check('bracketed wording matches — [Mueller]',
  completeTokenMatch('[Mueller] knew.', 'Mueller'), true)

// ════════════════════════════════════════════════════════════════════════════
group('Acronyms and designations')
check('POTUS matches as a token',
  completeTokenMatch('Why did POTUS surround himself with generals?', 'POTUS'), true)
// #2779 links to twitter.com/iHeartPOTUS. "POTUS" is glued inside the handle, so it is a token of
// NOTHING — not prose, not the URL. That is the correct answer and it is worth pinning: the record
// is real, and it was found by the glued reporting test below, not by promoting a substring here.
check('POTUS glued into a Twitter handle is a token of nothing',
  loc('https://twitter.com/iHeartPOTUS/status/1097372254441226240', 'POTUS'),
  { prose: false, url: false, cls: null })
check('MI is not found inside "MILITARY"',
  completeTokenMatch('MILITARY INTELLIGENCE.', 'MI'), false)
// The boundary rule is the renderer's rule, character for character.
check('the complete-token regex matches Q+ ',
  completeTokenRegex('Q+').test('Who is Q+ ?'), true)
// "+" is not alphanumeric, so "Q" genuinely ends a token in "Q+" — a boundary cannot tell these
// two designations apart, and pretending otherwise here would disagree with the renderer. That
// separation is an IDENTITY question, settled by normalizeItemKey one layer up (invariant 6).
check('Q ends a token in Q+ — boundaries cannot separate the designations',
  completeTokenRegex('Q').test('Q+'), true)
check('the scripts use the renderer\'s boundary rule, conditional ends included',
  completeTokenRegex('Q+').source, '(?<![A-Za-z0-9])Q\\+')
check('an alias that is only punctuation matches nothing',
  completeTokenMatch('anything at all', '+++'), false)

// ════════════════════════════════════════════════════════════════════════════
group('An entity in BOTH prose and a URL')
// The rule that protects Q's own words: a URL beside a name never withdraws the name.
check('prose wins when both are present',
  loc('https://www.foxnews.com/politics/trump-spying\nWhat did Trump know?', 'Trump'),
  { prose: true, url: true, cls: null })
check('a visible label beside a link reads as prose',
  loc('Washington Post ran this: https://www.washingtonpost.com/x/y', 'Washington Post'),
  { prose: true, url: false, cls: null })
check('a match spanning host and path is ambiguous, never automatic',
  loc('https://mccain.senate.gov/mccain-statement', 'McCain'),
  { prose: false, url: true, cls: 'ambiguous_url_reference' })

// ════════════════════════════════════════════════════════════════════════════
group('URL parts mean different things')
check('a hostname is a source reference',
  loc('https://www.reddit.com/r/greatawakening/comments/8ia0vu/x/', 'Reddit'),
  { prose: false, url: true, cls: 'hostname_source_reference' })
check('a path slug is a path fragment',
  loc('https://www.foxnews.com/politics/ig-2-0-could-be-worse-for-fbi-trump-spying', 'Trump'),
  { prose: false, url: true, cls: 'url_path_fragment' })
check('an encoded query term is a query fragment',
  loc('https://trends.google.com/trends/explore?q=black%20lives%20matter', 'Black Lives Matter'),
  { prose: false, url: true, cls: 'url_query_fragment' })
check('a scheme-less www link is still a URL',
  loc('www.reddit.com/r/greatawakening/comments/x/', 'Reddit'),
  { prose: false, url: true, cls: 'hostname_source_reference' })
check('the same URL twice is still one classification',
  loc('https://reddit.com/a https://reddit.com/a', 'Reddit'),
  { prose: false, url: true, cls: 'hostname_source_reference' })

// ════════════════════════════════════════════════════════════════════════════
group('Glued brands — reported to a human, never decided automatically')
// "Daily Beast" is not a token of "thedailybeast.com". Matching across folded boundaries is how
// "US" starts matching inside "because", so the glued test is confined to a single hostname and
// its result is evidence for a person, not an action.
check('a brand glued into a domain is not a token match',
  loc('https://amp.thedailybeast.com/qanon-melts-down', 'Daily Beast'),
  { prose: false, url: false, cls: null })
check('but the glued host test finds it, for reporting',
  gluedHostMatch('thedailybeast.com', 'Daily Beast'), true)
check('a hyphenated brand in a domain IS a token match',
  loc('https://amp.daily-beast.com/qanon-melts-down', 'Daily Beast'),
  { prose: false, url: true, cls: 'hostname_source_reference' })
check('a brand absent from the domain is not invented',
  gluedHostMatch('apnews.com', 'Associated Press'), false)
check('the glued test refuses short aliases — "US" would match usatoday.com',
  gluedHostMatch('usatoday.com', 'US'), false)

// ════════════════════════════════════════════════════════════════════════════
group('Multi-word aliases')
check('a genuine multi-word alias matches as a unit',
  completeTokenMatch('the Senate Judiciary Committee met', 'Senate Judiciary Committee'), true)
check('and not when only part of it appears',
  completeTokenMatch('the Senate met', 'Senate Judiciary Committee'), false)
check('word order matters',
  completeTokenMatch('Committee Judiciary Senate', 'Senate Judiciary Committee'), false)
check('extra internal whitespace is tolerated',
  completeTokenMatch('Senate   Judiciary\n Committee', 'Senate Judiciary Committee'), true)
check('foldTokens pads both ends so the boundary is real',
  foldTokens('US'), ' us ')

// ════════════════════════════════════════════════════════════════════════════
group('The guard is not vacuous')
// If raw and rendered text ever agree on these, the coordinate-system protection has stopped
// protecting anything and every check above passes for free.
check('rendered and stored text genuinely differ on markup',
  runtimeText('https:<em>//</em>x.com') === 'https:<em>//</em>x.com', false)
check('rendered and stored text genuinely differ on entities',
  runtimeText('AT&amp;T') === 'AT&amp;T', false)
check('a complete-token match on stored text would have been wrong',
  foldTokens('AT&amp;T').includes(foldTokens('AT&T')), false)

// ── report ──────────────────────────────────────────────────────────────────
console.log('\nRENDERED-TEXT AND COMPLETE-TOKEN MATCHING\n')
let n = 0
for (const g of groups) {
  console.log(`  ${g.name}`)
  for (const r of g.rows) {
    n++
    console.log(`    ${r.ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(58)}${r.ok ? '' : ` got ${JSON.stringify(r.got)} want ${JSON.stringify(r.want)}`}`)
  }
  console.log('')
}
console.log(`  ${failed ? `❌ ${failed} of ${n} failed` : `✅ all ${n} cases pass`}\n`)
process.exit(failed ? 1 : 0)
