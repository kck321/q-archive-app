// The URL detector, against every shape that has fooled it or could.
//
//   node scripts/test-url-detection.mjs
//
// This is the guard that stops URL fragments becoming entity mentions again. Each case below is
// either a failure that actually happened — %20 encoding, punctuation folding, scheme-less www —
// or a shape that would produce the same class of false entity if it were mishandled.
//
// The rule being protected: an entity mention is a claim that Q NAMED something. A slug, a query
// term, a tracking parameter and a subdomain are artefacts of the link he pasted.
import { aliasLocation, classifyUrlDerived } from './lib/hoverValidation.mjs'

let failed = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}
const loc = (text, alias) => {
  const l = aliasLocation(text, alias)
  return { prose: l.inProse, url: l.inUrl, cls: l.inUrl && !l.inProse ? classifyUrlDerived(l) : null }
}

console.log('\nURL DETECTION\n')

// 1. Encoded URLs. "black%20lives%20matter" is the name with its spaces escaped, and a plain
//    substring test sees nothing at all.
check('encoded %20 in a query is found',
  loc('https://trends.google.com/trends/explore?q=black%20lives%20matter Do you see a pattern?', 'Black Lives Matter'),
  { prose: false, url: true, cls: 'url_query_fragment' })

// 2. Hostname vs path. The publisher's domain is a source; the slug is not.
check('hostname match is a source reference',
  loc('https://www.reddit.com/r/greatawakening/comments/8ia0vu/x/', 'Reddit'),
  { prose: false, url: true, cls: 'hostname_source_reference' })
check('path slug match is a path fragment',
  loc('https://www.foxnews.com/politics/ig-2-0-could-be-worse-for-fbi-trump-spying', 'Trump'),
  { prose: false, url: true, cls: 'url_path_fragment' })

// 3. Prose wins. An entity Q actually wrote is a mention even when the same word is in a link.
check('prose AND url — prose is detected',
  loc('https://www.foxnews.com/politics/trump-spying\nWhat did Trump know?', 'Trump'),
  { prose: true, url: true, cls: null })

// 4. Punctuation folding, both directions. "presidential-advisory" is the name hyphenated.
check('hyphenated slug matches a spaced name',
  loc('https://www.whitehouse.gov/the-press-office/2017/presidential-advisory', 'Presidential Advisory'),
  { prose: false, url: true, cls: 'url_path_fragment' })

// 5. Repeated URLs must not multiply the classification.
check('the same URL twice is still one classification',
  loc('https://reddit.com/a https://reddit.com/a', 'Reddit'),
  { prose: false, url: true, cls: 'hostname_source_reference' })

// 6. Subdomains belong to the host — but a brand GLUED into a domain is not found, and that is
//    the honest behaviour. "Daily Beast" is not present in "thedailybeast.com" once punctuation is
//    folded to token boundaries; matching it would mean matching across word boundaries, which is
//    exactly how "US" starts matching inside "because". A documented limit, not a silent one.
check('a brand glued into a domain is NOT matched (documented limit)',
  loc('https://amp.thedailybeast.com/qanon-melts-down', 'Daily Beast'),
  { prose: false, url: false, cls: null })
check('a hyphenated brand in a subdomain IS matched',
  loc('https://amp.daily-beast.com/qanon-melts-down', 'Daily Beast'),
  { prose: false, url: true, cls: 'hostname_source_reference' })

// 7. Tracking and redirect parameters are query content, never mentions.
check('a tracking parameter is a query fragment',
  loc('https://example.com/story?utm_source=politico&ref=x', 'Politico'),
  { prose: false, url: true, cls: 'url_query_fragment' })
check('a redirect target in a query is a query fragment',
  loc('https://t.co/x?url=https%3A%2F%2Fwww.reuters.com%2Farticle', 'Reuters'),
  { prose: false, url: true, cls: 'url_query_fragment' })

// 8. Cross-boundary matches are never decided automatically.
check('a match spanning host and path is ambiguous',
  loc('https://mccain.senate.gov/mccain-statement', 'McCain'),
  { prose: false, url: true, cls: 'ambiguous_url_reference' })

// 9. A human-readable label beside a link is prose, and prose is what it is.
check('a visible label beside a URL reads as prose',
  loc('Washington Post ran this: https://www.washingtonpost.com/x/y', 'Washington Post'),
  { prose: true, url: false, cls: null })

// 10. A brand whose name is not in its domain must not be pulled out of the host.
check('a brand absent from the domain is not found in it',
  loc('https://apnews.com/article/xyz', 'Associated Press'),
  { prose: false, url: false, cls: null })

// 11. Scheme-less links are links. urlSpans matches "www.reddit.com/..." and the analysis
//     silently dropped 83 of 102 linked-source records when `new URL` threw on them.
check('a scheme-less www link is still a URL',
  loc('www.reddit.com/r/greatawakening/comments/x/', 'Reddit'),
  { prose: false, url: true, cls: 'hostname_source_reference' })

// 12. Plain prose with no link at all.
check('prose with no URL is prose',
  loc('Why did POTUS surround himself with generals?', 'POTUS'),
  { prose: true, url: false, cls: null })

// 13. A word inside a longer word is not a mention — invariant 4, one layer down.
check('a substring inside a longer word is not a match',
  loc('Because it must be trusted.', 'US'),
  { prose: false, url: false, cls: null })

console.log(`\n  ${failed ? `❌ ${failed} failed` : '✅ every URL shape is classified as ruled'}\n`)
process.exit(failed ? 1 : 0)
