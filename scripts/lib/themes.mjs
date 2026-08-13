// Theme ontology — a controlled, multi-label layer.
//
// Themes answer a different question from every other section. Questions/Directives/Claims ask
// what a sentence is DOING; Entities asks who is NAMED; Themes asks what the text is ABOUT.
// So a theme is not a keyword and not a sentence class: one post can legitimately carry
// several, and a theme has to survive alias variation — "HRC", "DNC" and "2016" can all feed
// Elections without any of them being the theme.
//
// WHY A CONTROLLED ONTOLOGY. The old extractor emitted free text and produced 5,094 distinct
// labels for 10,453 tags, 77% of them appearing exactly once: "deep state", "deep state
// conspiracy", "deep state corruption" and "deep state coordination" are four labels for one
// idea. Nothing can be browsed or counted that way.
//
// THE GOVERNING RULE: themes come from CONTEXT, not raw word presence.
//   - "Apple" is not Technology when the post is about Apple stock.
//   - "Russia" is not Foreign Affairs when the sentence is about an investigation.
//   - "media" inside quoted source material is not Q writing about media.
// Enforced three ways: an anchor must be specific enough to carry a theme alone, weaker
// signals must CONVERGE before they count, and quoted/pasted lines are excluded upstream.

export const THEMES = [
  {
    key: 'elections_voting', label: 'Elections & Voting',
    blurb: 'Elections, campaigns, ballots, voter fraud claims, primaries and results.',
    anchors: [/\b(election fraud|voter fraud|ballot harvest|rigged election|election interference|vote[- ]by[- ]mail|electoral college|swing state)\b/i],
    support: [/\belections?\b/i, /\bballots?\b/i, /\bvot(e|es|ing|ers?)\b/i, /\bcampaign\b/i, /\bprimar(y|ies)\b/i, /\bpolls?\b/i, /\bmidterms?\b/i, /\brecount\b/i],
    subthemes: ['Election integrity', 'Campaigns', 'Voter fraud claims'],
  },
  {
    key: 'government_politics', label: 'Government & Politics',
    blurb: 'Institutions, officeholders, legislation, appointments and the machinery of government.',
    anchors: [/\b(executive order|impeach\w*|confirmation hearing|cabinet|administration|legislation|congressional (hearing|testimony))\b/i],
    support: [/\bcongress\b/i, /\bsenate\b/i, /\bhouse\b/i, /\bpresident\b/i, /\bgovernor\b/i, /\bpolic(y|ies)\b/i, /\bbill\b/i, /\bvote(d)? on\b/i],
    subthemes: ['Legislation', 'Appointments', 'Political parties'],
  },
  {
    key: 'intelligence_surveillance', label: 'Intelligence & Surveillance',
    blurb: 'Intelligence agencies, collection programs, surveillance, unmasking and classified operations.',
    anchors: [/\b(FISA|unmask\w*|wiretap|SIGINT|HUMINT|Five Eyes|FVEY|surveill\w+|no such agency|mass collection)\b/i],
    support: [/\bNSA\b/, /\bCIA\b/, /\bC_A\b/, /\bintel(ligence)?\b/i, /\bclassified\b/i, /\bspy(ing)?\b/i, /\basset\b/i, /\bsource\b/i],
    subthemes: ['Surveillance programs', 'Agency operations', 'Classification'],
  },
  {
    key: 'law_enforcement', label: 'Law Enforcement & Investigations',
    blurb: 'Investigations, agencies, indictments, arrests, prosecutions and internal misconduct.',
    anchors: [/\b(special counsel|grand jury|indict\w+|subpoena|investigat\w+ into|criminal referral|sealed indictment|IG report)\b/i],
    support: [/\bFBI\b/, /\bDOJ\b/, /\bprosecut\w+/i, /\barrest\w*/i, /\bcharges?\b/i, /\bevidence\b/i, /\btestimony\b/i, /\bwitness\b/i],
    subthemes: ['Investigations', 'Prosecutions', 'Agency misconduct'],
  },
  {
    key: 'justice_courts', label: 'Justice & Courts',
    blurb: 'Courts, judges, rulings, sentencing and the administration of justice.',
    anchors: [/\b(supreme court|SCOTUS|federal judge|court ruling|sentenc\w+|plea deal|acquitt\w+|convict\w+)\b/i],
    support: [/\bcourt\b/i, /\bjudge\b/i, /\bjustice\b/i, /\btrial\b/i, /\bjury\b/i, /\bappeal\b/i, /\bruling\b/i],
    subthemes: ['Courts', 'Rulings', 'Sentencing'],
  },
  {
    key: 'media_information', label: 'Media & Information',
    blurb: 'News organisations, coverage, narrative framing and the flow of information.',
    anchors: [/\b(fake news|mainstream media|MSM|narrative (control|shift|push)|media blackout|talking points|press briefing)\b/i],
    support: [/\bmedia\b/i, /\bpress\b/i, /\bjournalis\w+/i, /\breporter\b/i, /\bheadline\b/i, /\bcoverage\b/i, /\bbroadcast\b/i],
    subthemes: ['News coverage', 'Narrative framing', 'Press conduct'],
  },
  {
    key: 'censorship_technology', label: 'Censorship & Technology',
    blurb: 'Platforms, moderation, deplatforming, algorithms and control of online speech.',
    anchors: [/\b(censor\w+|shadow ?ban|deplatform\w*|content moderation|algorithm\w*|section 230|suspend(ed)? (the )?account)\b/i],
    support: [/\btwitter\b/i, /\bfacebook\b/i, /\bgoogle\b/i, /\byoutube\b/i, /\bplatform\b/i, /\bban(ned)?\b/i, /\bsilenc\w+/i],
    subthemes: ['Platform moderation', 'Deplatforming', 'Algorithms'],
  },
  {
    key: 'national_security_military', label: 'National Security & Military',
    blurb: 'Armed forces, defence posture, operations, readiness and national security decisions.',
    anchors: [/\b(national security|military (operation|intelligence|tribunal)|DEFCON|rules of engagement|chain of command|joint chiefs)\b/i],
    support: [/\bmilitary\b/i, /\bnavy\b/i, /\barmy\b/i, /\bmarines?\b/i, /\bair force\b/i, /\btroops?\b/i, /\bdefen[cs]e\b/i, /\bwar\b/i],
    subthemes: ['Military operations', 'Defence policy', 'Readiness'],
  },
  {
    key: 'foreign_affairs', label: 'Foreign Affairs',
    blurb: 'Other countries, diplomacy, treaties, alliances and international relations.',
    anchors: [/\b(foreign (policy|actor|government)|diplomat\w+|treaty|summit|sanctions|extradit\w+|ambassador|NATO|United Nations)\b/i],
    support: [/\brussia\b/i, /\bchina\b/i, /\biran\b/i, /\bnorth korea\b/i, /\bsaudi\b/i, /\bukraine\b/i, /\bisrael\b/i, /\ballies\b/i],
    subthemes: ['Diplomacy', 'Alliances', 'Foreign influence'],
  },
  {
    key: 'finance_economy', label: 'Finance & Economic Power',
    blurb: 'Money flows, markets, banking, funding and economic leverage.',
    anchors: [/\b(money launder\w+|slush fund|federal reserve|central bank|shell (company|corporation)|offshore account|wire transfer|market (crash|manipulation))\b/i],
    support: [/\bbank\w*/i, /\bfunding\b/i, /\bdonat\w+/i, /\bmillions?\b/i, /\bbillions?\b/i, /\bstock\b/i, /\beconom\w+/i, /\btaxpayer\b/i],
    subthemes: ['Money flows', 'Markets', 'Institutional finance'],
  },
  {
    key: 'corruption_influence', label: 'Corruption & Influence',
    blurb: 'Bribery, pay-to-play, conflicts of interest, capture and abuse of position.',
    anchors: [/\b(pay[- ]?to[- ]?play|kickback|bribe\w*|quid pro quo|conflict of interest|self[- ]dealing|corrupt\w+ (official|politician))\b/i],
    support: [/\bcorrupt\w*/i, /\binfluence\b/i, /\blobby\w*/i, /\bfavor\w*/i, /\binsider\b/i, /\bcollusion\b/i],
    subthemes: ['Bribery & kickbacks', 'Conflicts of interest', 'Institutional capture'],
  },
  {
    key: 'trafficking_exploitation', label: 'Trafficking & Exploitation',
    blurb: 'Human trafficking, child exploitation, abuse networks and related prosecutions.',
    anchors: [/\b(human traffick\w+|child (traffick\w+|exploit\w+|abuse)|sex traffick\w+|pedophil\w+|missing children|epstein island)\b/i],
    support: [/\btraffick\w+/i, /\bexploit\w+/i, /\bvictims?\b/i, /\bminors?\b/i, /\babuse\b/i],
    subthemes: ['Trafficking networks', 'Child exploitation', 'Prosecutions'],
  },
  {
    key: 'health_medicine', label: 'Health & Medicine',
    blurb: 'Public health, medicine, pharmaceuticals, pandemics and health authorities.',
    anchors: [/\b(pandemic|COVID|coronavirus|vaccin\w+|lockdown|CDC|WHO guidance|big pharma|clinical trial)\b/i],
    support: [/\bhealth\b/i, /\bmedical\b/i, /\bdisease\b/i, /\bhospital\b/i, /\bdrugs?\b/i, /\bdoctors?\b/i, /\bpatients?\b/i],
    subthemes: ['Public health', 'Pharmaceuticals', 'Pandemic response'],
  },
  {
    key: 'religion_spirituality', label: 'Religion & Spirituality',
    blurb: 'Faith, scripture, prayer, good and evil, and religious institutions.',
    anchors: [/\b(armor of god|the lord is|pray(er)? for|scripture|amen\b|god bless|spiritual (war|battle)|good (versus|vs\.?) evil)\b/i],
    support: [/\bgod\b/i, /\bfaith\b/i, /\bpray\w*/i, /\bchurch\b/i, /\bevil\b/i, /\bbible\b/i, /\bsoul\b/i],
    subthemes: ['Faith & prayer', 'Scripture', 'Good versus evil'],
  },
  {
    key: 'social_movements', label: 'Social Movements & Culture',
    blurb: 'Protests, activism, cultural conflict, celebrity and public opinion.',
    anchors: [/\b(protest\w*|riot\w*|activis\w+|social justice|cancel culture|public opinion|grass ?roots|march on)\b/i],
    support: [/\bmovement\b/i, /\bculture\b/i, /\bhollywood\b/i, /\bcelebrit\w+/i, /\bunrest\b/i, /\bdivision\b/i],
    subthemes: ['Protest & activism', 'Culture', 'Public opinion'],
  },
  {
    key: 'disclosure_declassification', label: 'Disclosure & Declassification',
    blurb: 'Releasing withheld information: declassification, FOIA, leaks and document dumps.',
    anchors: [/\b(declas\w*|declassif\w+|FOIA|document dump|unseal\w+|release the|leak(ed|s)? (documents?|files?)|whistleblow\w+)\b/i],
    support: [/\brelease\b/i, /\bdisclos\w+/i, /\bredact\w+/i, /\bclassified\b/i, /\barchive\b/i, /\btransparen\w+/i],
    subthemes: ['Declassification', 'Leaks', 'Transparency'],
  },
  {
    key: 'q_movement', label: 'Q Movement & Community',
    blurb: 'The board, anons, research culture, memes and the movement around the drops.',
    anchors: [/\b(anons?\b|wwg1wga|the great awakening|q ?research|board owner|bakers?\b|meme war|dig(ging)? anons)\b/i],
    support: [/\bboard\b/i, /\bthread\b/i, /\bmemes?\b/i, /\bpatriots\b/i, /\bfollow the\b/i, /\bcrumbs?\b/i],
    subthemes: ['The board', 'Research culture', 'Memes'],
  },
  {
    key: 'historical_events', label: 'Historical Events',
    blurb: 'Past events invoked as precedent or parallel — wars, assassinations, prior scandals.',
    anchors: [/\b(world war|WWII|WWI|pearl harbor|watergate|iran[- ]contra|assassinat\w+|cold war|9\/11|september 11)\b/i],
    support: [/\bhistory\b/i, /\bhistorical\b/i, /\b19\d{2}\b/, /\bdecades?\b/i, /\bprecedent\b/i],
    subthemes: ['Wars', 'Assassinations', 'Prior scandals'],
  },
  {
    key: 'other_emerging', label: 'Other / Emerging',
    blurb: 'Recurring subjects that do not yet fit a parent theme.',
    anchors: [], support: [], subthemes: [],
  },
]

/**
 * Guards against a theme being read off a single word in the wrong context, which is the
 * specific failure the review named. Each entry blocks a theme when the surrounding text shows
 * the term is doing something else.
 */
export const CONTEXT_GUARDS = [
  {
    theme: 'censorship_technology',
    // "Apple" or "Google" beside a share price is a finance sentence, not a technology one.
    block: /\b(stock|shares?|market cap|earnings|ticker|NASDAQ|price target)\b/i,
    why: 'the company appears in a market context rather than a platform-conduct one',
  },
  {
    theme: 'foreign_affairs',
    // "Russia" inside an investigation sentence is Law Enforcement, not diplomacy.
    block: /\b(investigat\w+|collusion|probe|indict\w+|special counsel|dossier)\b/i,
    why: 'the country appears as the subject of an investigation rather than of diplomacy',
  },
  {
    theme: 'media_information',
    block: /\b(social media (post|account)|media file|media player)\b/i,
    why: '"media" is being used in a technical rather than journalistic sense',
  },
]

/** Map the old free-text labels onto parents, so 5,094 strings become corroborating evidence. */
export const LEGACY_HINTS = [
  [/\belection|ballot|voter|campaign/i, 'elections_voting'],
  [/\bgovern|political|congress|senate|policy|legislat/i, 'government_politics'],
  [/\bintel|surveil|fisa|classif|covert|spy/i, 'intelligence_surveillance'],
  [/\bfbi|doj|investigat|prosecut|indict|law enforcement/i, 'law_enforcement'],
  [/\bcourt|judge|justice|trial|sentenc/i, 'justice_courts'],
  [/\bmedia|news|narrative|press|journalis/i, 'media_information'],
  [/\bcensor|platform|tech|algorithm|social media/i, 'censorship_technology'],
  [/\bmilitary|defen[cs]e|war|troop|national security/i, 'national_security_military'],
  [/\bforeign|diplomat|russia|china|iran|korea|alliance/i, 'foreign_affairs'],
  [/\bfinanc|money|bank|econom|fund|market/i, 'finance_economy'],
  [/\bcorrupt|bribe|influence|collusion|pay.to.play/i, 'corruption_influence'],
  [/\btraffick|exploit|pedo|child abuse/i, 'trafficking_exploitation'],
  [/\bhealth|medical|pandemic|vaccin|pharma/i, 'health_medicine'],
  [/\breligio|spiritual|god|faith|prayer|evil/i, 'religion_spirituality'],
  [/\bmovement|protest|activis|culture|social/i, 'social_movements'],
  [/\bdeclas|disclos|leak|transparen|foia/i, 'disclosure_declassification'],
  [/\bq ?anon|q movement|anon|awakening|crumb|coded messag|cryptic/i, 'q_movement'],
  [/\bhistor|world war|watergate|assassinat/i, 'historical_events'],
]

export const THEME_BY_KEY = new Map(THEMES.map(t => [t.key, t]))
