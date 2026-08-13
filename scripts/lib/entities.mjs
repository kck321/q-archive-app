// Canonical entity registry — shared infrastructure, so no auditor forks it.
//
// Entities are a different kind of classification from Questions/Directives/Claims. Those ask
// what a sentence is DOING; this asks who or what is NAMED. So the unit of truth is not the
// sentence but the mention, and the hard problem is not segmentation but IDENTITY.
//
// THE RULE THAT SHAPES THIS FILE: a raw token count must never become the user-facing entity
// count. Three separate things would corrupt it:
//
//   1. Q's own signature. "Q" is the single most frequent stored "entity" at 4,384 — but Q
//      signing a drop is not Q mentioning someone. Excluded by SIGNATURE_TOKENS.
//   2. Aliases counted apart from their canonical. "Hillary Clinton", "HRC" and "Hillary" are
//      one person; showing three rows of 31/107/x invents three subjects.
//   3. Shorthand that genuinely has no single referent. "BO" is the clearest case: of 77
//      mentions, a context probe put 5 as board-owner, 7 as Obama and 65 undecidable. Guessing
//      would attribute dozens of mentions to a person Q may not have meant.
//
// Anything ambiguous is marked contextDependent and is NOT auto-canonicalised. The exact
// source wording is always preserved; canonicalisation is a layer on top, never a rewrite.

export const ENTITY_TYPES = [
  'person', 'organization', 'government_agency', 'government_institution', 'country_region',
  'location', 'political_group_movement', 'media_organization', 'program_operation_project',
  'legal_investigative', 'title_role', 'coded_alias', 'religious_spiritual',
  // Added in the final typing pass, only where they materially help a reader browse or filter.
  'legislation_regulation', 'event_incident', 'military_asset_vessel', 'creative_work',
  'financial_institution', 'technology_platform', 'facility_property',
  'other_named_entity',
]

/**
 * Conceptual collectives. These are NOT entities: they name an idea or a crowd, not a specific
 * organisation, so promoting them here would turn every capitalised concept into a subject with
 * a mention count. They belong to Themes.
 *
 * The exception is when context identifies an actual named organisation — "the Patriots" as a
 * named group rather than a way of addressing readers — which is why these are routed rather
 * than deleted.
 */
export const ROUTE_TO_THEMES = new Set([
  'THE PEOPLE', 'The People', 'Patriots', 'PATRIOTS', 'Anons', 'ANONS', 'Anon',
  'MSM', 'Deep State', 'DEEP STATE', 'Big Pharma', 'Big Tech', 'Fake News', 'FAKE NEWS',
  'Black Americans', 'The Left', 'The Right', 'Silent Majority', 'Establishment',
  'Cabal', 'CABAL', 'Elites', 'Globalists', 'Swamp', 'THE SWAMP',
])

/** Titles and roles. The referent depends on who held the office at the date of the drop. */
export const TITLE_ROLES = {
  POTUS: 'President of the United States — the referent depends on the drop’s date.',
  VP: 'Vice President.',
  FLOTUS: 'First Lady of the United States.',
  AG: 'Attorney General — several different people held this office across the corpus.',
  SOS: 'Secretary of State.',
  DIRNSA: 'Director of the National Security Agency.',
  CJCS: 'Chairman of the Joint Chiefs of Staff.',
}

/**
 * Coded aliases Q used for individuals. Resolved ONLY where surrounding context supports it,
 * never globally — "NO NAME" is widely read as John McCain, but hard-mapping it everywhere
 * would put words in Q's mouth in drops where the context does not carry that.
 */
export const CODED_ALIASES = {
  'NO NAME': { likely: 'John McCain', note: 'Widely read as John McCain. Resolved only where the surrounding drop supports it.' },
  'Renegade': { likely: 'Barack Obama', note: 'A Secret Service codename; resolved where context supports it.' },
  'Snow White': { likely: null, note: 'Used as an operation name rather than a person.' },
}

/** Q's own signing tokens. A signature is not a mention of an entity. */
export const SIGNATURE_TOKENS = new Set(['Q', 'Q+', 'WWG1WGA', 'NCSWIC'])

/**
 * Shorthand with no single referent in this corpus. Recorded as mentions of the literal token,
 * never silently resolved to a person.
 */
export const CONTEXT_DEPENDENT = {
  BO: 'In this corpus "BO" is used both for the 8chan/8kun Board Owner and, in some drops, for Barack Obama. A context probe over all 77 mentions found 5 clearly board-owner, 7 clearly Obama-adjacent and 65 undecidable from surrounding text.',
  POTUS: 'A title, not a name. It refers to whoever held the office at the time of the drop — overwhelmingly Donald Trump in this corpus, but the resolution depends on the drop’s date rather than the token.',
  MSM: '"Mainstream media" is a category rather than a specific organisation, so it is recorded as a media grouping and not resolved to any one outlet.',
  AS: 'Two letters that appear both as Q’s shorthand for a named individual and as the ordinary English word. Not resolved without corroborating context.',
  MI: 'Used for Military Intelligence, and also appears as a state abbreviation and inside other tokens.',
  SR: 'Used for Seth Rich in several drops and as an ordinary abbreviation elsewhere.',
  JC: 'Used for more than one individual across the corpus.',
  LL: 'Shorthand used for a named individual in some drops and ambiguous in others.',
  SC: 'Used for both a court and a person’s initials across different drops.',
  CA: 'Used for a US state and, in some drops, a person’s initials.',
  Clinton: 'A surname shared by Hillary and Bill Clinton. Q uses it for both, so it is not resolved to a person without surrounding context.',
  DC: 'Usually Washington, D.C., but also appears as initials. Resolved to the city only where context supports it.',
  JFK: 'John F. Kennedy in some drops, JFK airport in others, and JFK Jr. in a third set. Not resolved by the token alone.',
  Jack: 'A given name used for more than one individual across the corpus.',
  Maxwell: 'A surname used for more than one individual across the corpus.',
}

/**
 * The canonical registry. `aliases` are matched case-insensitively with word boundaries;
 * ALL-CAPS shorthand is matched case-SENSITIVELY (see the auditor) so "as" is not read as "AS".
 */
export const REGISTRY = [
  // ── people ───────────────────────────────────────────────────────────────
  // "45" was an alias here and is removed: a bare number cannot be told apart from any other 45.
  { canonical: 'Donald Trump', type: 'person', aliases: ['Trump', 'Donald J. Trump', 'DJT', 'Donald Trump'], note: 'POTUS is recorded as a title, not folded in here.' },
  { canonical: 'Hillary Clinton', type: 'person', aliases: ['HRC', 'Hillary', 'Hillary Clinton', 'Hillary Rodham Clinton', 'Crooked Hillary'] },
  { canonical: 'Barack Obama', type: 'person', aliases: ['Hussein', 'Barack Obama', 'Barack', 'Barack H. Obama', 'Barack Hussein Obama', 'Renegade', 'Obama'] },
  { canonical: 'Robert Mueller', type: 'person', aliases: ['Mueller', 'Robert Mueller', 'Bob Mueller'] },
  { canonical: 'James Comey', type: 'person', aliases: ['Comey', 'James Comey'] },
  { canonical: 'Jeff Sessions', type: 'person', aliases: ['Sessions', 'Jeff Sessions'] },
  { canonical: 'Rod Rosenstein', type: 'person', aliases: ['Rosenstein', 'Rod Rosenstein', 'RR'], contextNote: 'RR is Q’s usual shorthand for Rod Rosenstein but is matched case-sensitively.' },
  { canonical: 'John Huber', type: 'person', aliases: ['Huber', 'John Huber', 'HUBER'] },
  { canonical: 'John Brennan', type: 'person', aliases: ['Brennan', 'John Brennan'] },
  { canonical: 'John Durham', type: 'person', aliases: ['Durham', 'John Durham'] },
  { canonical: 'William Barr', type: 'person', aliases: ['Barr', 'William Barr', 'Bill Barr'] },
  { canonical: 'Michael Flynn', type: 'person', aliases: ['Flynn', 'Michael Flynn', 'Gen Flynn', 'General Flynn'] },
  { canonical: 'George Soros', type: 'person', aliases: ['Soros', 'George Soros'] },
  { canonical: 'Nancy Pelosi', type: 'person', aliases: ['Pelosi', 'Nancy Pelosi'] },
  { canonical: 'Joe Biden', type: 'person', aliases: ['Biden', 'Joe Biden'] },
  { canonical: 'Edward Snowden', type: 'person', aliases: ['Snowden', 'Edward Snowden'] },
  { canonical: 'Jeffrey Epstein', type: 'person', aliases: ['Epstein', 'Jeffrey Epstein'] },
  { canonical: 'Devin Nunes', type: 'person', aliases: ['Nunes', 'Devin Nunes'] },
  { canonical: 'Anthony Weiner', type: 'person', aliases: ['Weiner', 'Anthony Weiner', 'Anthony Wiener', 'Wiener'] },
  { canonical: 'Andrew McCabe', type: 'person', aliases: ['McCabe', 'Andrew McCabe'] },
  { canonical: 'Loretta Lynch', type: 'person', aliases: ['Loretta Lynch'] },
  { canonical: 'Seth Rich', type: 'person', aliases: ['Seth Rich'] },
  { canonical: 'Adam Schiff', type: 'person', aliases: ['Adam Schiff', 'Schiff'] },
  { canonical: 'Huma Abedin', type: 'person', aliases: ['Huma', 'Huma Abedin'] },
  { canonical: 'Vladimir Putin', type: 'person', aliases: ['Putin', 'Vladimir Putin'] },
  { canonical: 'Kim Jong Un', type: 'person', aliases: ['Kim Jong Un', 'Kim Jong-un'] },
  { canonical: 'Rothschild family', type: 'person', aliases: ['Rothschild', 'Rothschilds', 'Roth'] },

  // ── government agencies ──────────────────────────────────────────────────
  { canonical: 'Federal Bureau of Investigation', type: 'government_agency', aliases: ['FBI'] },
  { canonical: 'Department of Justice', type: 'government_agency', aliases: ['DOJ', 'Justice Department', 'Department of Justice'] },
  { canonical: 'Central Intelligence Agency', type: 'government_agency', aliases: ['CIA', 'C_A', 'C-A'] },
  { canonical: 'National Security Agency', type: 'government_agency', aliases: ['NSA', 'No Such Agency'] },
  { canonical: 'Department of State', type: 'government_agency', aliases: ['State Department', 'Department of State'] },
  { canonical: 'United States Secret Service', type: 'government_agency', aliases: ['USSS', 'Secret Service'] },
  { canonical: 'Securities and Exchange Commission', type: 'government_agency', aliases: ['SEC'] },
  { canonical: 'DARPA', type: 'government_agency', aliases: ['DARPA'] },
  { canonical: 'Office of the Inspector General', type: 'legal_investigative', aliases: ['IG', 'Inspector General', 'OIG'] },
  { canonical: 'Military Intelligence', type: 'government_agency', aliases: ['Military Intelligence'] },

  // ── legal / investigative ────────────────────────────────────────────────
  { canonical: 'FISA Court', type: 'legal_investigative', aliases: ['FISA', 'FISC'] },
  { canonical: 'Supreme Court', type: 'legal_investigative', aliases: ['Supreme Court', 'SCOTUS'] },
  { canonical: 'Grand Jury', type: 'legal_investigative', aliases: ['Grand Jury', 'GJ'] },

  // ── organizations ────────────────────────────────────────────────────────
  { canonical: 'Clinton Foundation', type: 'organization', aliases: ['Clinton Foundation', 'CF'] },
  { canonical: 'Democratic National Committee', type: 'organization', aliases: ['DNC'] },
  { canonical: 'Twitter', type: 'organization', aliases: ['Twitter'] },
  { canonical: 'Facebook', type: 'organization', aliases: ['Facebook', 'FB'] },
  { canonical: 'Google', type: 'organization', aliases: ['Google'] },
  { canonical: 'YouTube', type: 'organization', aliases: ['YouTube'] },
  { canonical: 'Five Eyes', type: 'organization', aliases: ['FVEY', 'Five Eyes', '5 Eyes'] },
  { canonical: 'ISIS', type: 'organization', aliases: ['ISIS', 'ISIL'] },
  { canonical: 'Muslim Brotherhood', type: 'organization', aliases: ['Muslim Brotherhood', 'MB'] },

  // ── media organizations ──────────────────────────────────────────────────
  { canonical: 'Fox News', type: 'media_organization', aliases: ['Fox News', 'FOX'] },
  { canonical: 'CNN', type: 'media_organization', aliases: ['CNN'] },
  { canonical: 'The New York Times', type: 'media_organization', aliases: ['New York Times', 'NYT', 'NY Times'] },
  { canonical: 'The Washington Post', type: 'media_organization', aliases: ['Washington Post', 'WAPO', 'WashPost'] },
  { canonical: 'Breitbart', type: 'media_organization', aliases: ['Breitbart'] },
  { canonical: 'NBC News', type: 'media_organization', aliases: ['NBC News', 'NBC'] },
  { canonical: 'ABC News', type: 'media_organization', aliases: ['ABC News'] },
  { canonical: 'The Hill', type: 'media_organization', aliases: ['The Hill'] },

  // ── political groups ─────────────────────────────────────────────────────
  { canonical: 'Democratic Party', type: 'political_group', aliases: ['Democrats', 'Democratic Party', 'D party', 'Dems'] },
  { canonical: 'Republican Party', type: 'political_group', aliases: ['Republicans', 'Republican Party', 'GOP', 'R party'] },
  { canonical: 'Antifa', type: 'political_group', aliases: ['ANTIFA', 'Antifa'] },
  { canonical: 'United States Congress', type: 'political_group', aliases: ['Congress'] },
  { canonical: 'United States Senate', type: 'political_group', aliases: ['Senate'] },
  { canonical: 'United States House of Representatives', type: 'political_group', aliases: ['House of Representatives'] },

  // ── countries / regions ──────────────────────────────────────────────────
  { canonical: 'United States', type: 'country_region', aliases: ['United States of America', 'United States', 'USA', 'America'] },
  { canonical: 'Russia', type: 'country_region', aliases: ['Russia'] },
  { canonical: 'China', type: 'country_region', aliases: ['China'] },
  { canonical: 'Iran', type: 'country_region', aliases: ['Iran'] },
  { canonical: 'North Korea', type: 'country_region', aliases: ['North Korea', 'NK'] },
  { canonical: 'Saudi Arabia', type: 'country_region', aliases: ['Saudi Arabia', 'SA'] },
  { canonical: 'United Kingdom', type: 'country_region', aliases: ['United Kingdom', 'UK'] },
  { canonical: 'Ukraine', type: 'country_region', aliases: ['Ukraine'] },
  { canonical: 'Haiti', type: 'country_region', aliases: ['Haiti'] },
  { canonical: 'European Union', type: 'country_region', aliases: ['European Union', 'EU'] },
  { canonical: 'Israel', type: 'country_region', aliases: ['Israel'] },
  { canonical: 'Pakistan', type: 'country_region', aliases: ['Pakistan'] },

  // ── locations ────────────────────────────────────────────────────────────
  { canonical: 'The White House', type: 'location', aliases: ['White House', 'WH'] },
  { canonical: 'Washington, D.C.', type: 'location', aliases: ['Washington DC', 'Washington, D.C.'] },
  { canonical: 'California', type: 'location', aliases: ['California'] },
  { canonical: 'Guantanamo Bay', type: 'location', aliases: ['GITMO', 'Guantanamo'] },

  // ── programs / operations ────────────────────────────────────────────────
  { canonical: 'Operation Mockingbird', type: 'program_operation', aliases: ['Operation Mockingbird', 'Mockingbird'] },
  { canonical: 'Project Snow White', type: 'program_operation', aliases: ['Snow White', 'SNOW WHITE'] },
  { canonical: 'Uranium One', type: 'program_operation', aliases: ['Uranium One', 'U1'] },
  { canonical: 'Godfather III', type: 'program_operation', aliases: ['Godfather III'] },
  { canonical: 'Crossfire Hurricane', type: 'program_operation', aliases: ['Crossfire Hurricane'] },
]

/** Aliases that must match with exact capitalisation — otherwise ordinary words are swept in. */
export const CASE_SENSITIVE = new Set([
  'HRC', 'RR', 'BO', 'AS', 'MI', 'SR', 'JC', 'LL', 'SC', 'CA', 'FBI', 'DOJ', 'CIA', 'NSA', 'SEC',
  'IG', 'OIG', 'CF', 'DNC', 'FB', 'NK', 'SA', 'UK', 'EU', 'WH', 'US', 'USA', 'MB', 'GJ', 'U1',
  'FOX', 'NBC', 'NYT', 'WAPO', 'GOP', 'ISIS', 'ISIL', 'FVEY', 'DARPA', 'USSS', 'GITMO', 'DJT',
  'SCOTUS', 'FISA', 'FISC', 'C_A', 'C-A', 'MSM', 'POTUS',
])

export const byAlias = (() => {
  const m = new Map()
  for (const e of REGISTRY) {
    for (const a of e.aliases) {
      const k = CASE_SENSITIVE.has(a) ? a : a.toLowerCase()
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(e)
    }
  }
  return m
})()
