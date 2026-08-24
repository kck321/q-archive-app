// THE HELD ROWS, RESEARCHED AND NAMED — owner ruling, 2026-08-24.
//
//   "you made a held for you tab on the excel file. i want to classify all those as entities and i
//    would like you to do the research for each post they are with in to give them the best hover
//    description you can. anything you are unsure of lets put in the resolution center"
//
//   -> audit/unhighlighted-entity-identities-3.json   (identities + splits, merged by apply-entities)
//   -> audit/held-entity-resolution-center.json       (the ones that stay questions)
//
// Sheet 3 of the report held 128 wordings the owner had ruled Entities and the round-2 generator
// would not name, because naming them was not derivable from Q's own line. This file names them
// from the DROP each one sits in — the line above and below, the list it belongs to, the link Q
// posted beside it. Every `why` states the evidence in the drop.
//
// WHAT STAYS A QUESTION, AND WHY THAT IS NOT A DODGE.
//
// Two different things end up in the Resolution Center, and only one of them is uncertainty:
//
//   1. THE REFERENT IS GENUINELY UNSETTLED. "[J C]" is James Comey in one drop and reads as James
//      Clapper in the next. "L." is a single initial addressed to someone the drop does not name.
//
//   2. CERTIFYING IT WOULD PAINT THE WRONG TEXT. The renderer paints a certified alias EVERYWHERE
//      it appears, so an alias is a corpus-wide claim, not a per-drop one. "45" means Trump in
//      #1565 and appears 281 times across 255 drops as a number. "L." 157 times, "N." 141, "RED"
//      187, "BIG" 89. Certifying those would light up hundreds of spans that mean nothing of the
//      kind. The archive HAS an occurrence-scoped mechanism for exactly this (aliasRulings with
//      includeOccurrences) and these are the rows that need it — which is a decision, so it goes
//      to the owner rather than being taken here.
//
//   node scripts/build-held-entity-identities.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const prev = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-entity-identities-2.json'), 'utf8'))

// ── identities: spelling -> a canonical name and a type from the existing vocabulary ────────
const I = (canonical, type, spellings, why, expansion = null) => ({ canonical, type, spellings, why, ...(expansion ? { expansion } : {}) })

const identities = [
  // ── Q's own designations ───────────────────────────────────────────────────
  I('Q Clearance Patriot', 'coded_alias', ['Q Clearance Patriot'],
    'The opening line of #34, the "My fellow Americans" drop. It is how the poster designates himself, so it is a name in the drop rather than a description of one.',
    'the designation the poster of these drops opens #34 with'),
  I('4,10,20', 'coded_alias', ['4,10,20', '4, 10, 20'],
    'Q signs off #35, #40 and #533 with it in place of the usual "Q". The three numbers are positions in the alphabet — 4=D, 10=J, 20=T — and #40 spells the alphabet out on the very next line ("A,b,c,d,e......"), which is Q showing the reader how to read the line above.',
    'D.J.T. — the initials the numbers give when read as alphabet positions, which #40 demonstrates on the following line'),
  I('SEC TEST', 'coded_alias', ['SEC TEST', 'SEC Test 1', 'SEC Test 2'],
    'Whole-drop lines in #870, #871, #1003, #1004 and #1639 — a drop whose entire content is the label. Q is testing the board, and the label is the designation for that.',
    'a board test post — the drop contains nothing but this label and the sign-off'),
  I('VIP Patriot', 'coded_alias', ['VIP Patriot'],
    'Q writes it in #2240 and #2243 beside a linked photograph and "Front Row." — a designation for a named supporter at a rally, not a description.',
    'a supporter Q singles out beside a rally photograph in #2240 and #2243'),
  I('+Sleepers', 'coded_alias', ['+Sleepers'],
    'A line of #3881\'s infiltration list, in Q\'s "+" prefix notation, between "THE SWAMP RUNS DEEP" and "Backgrounds are important."',
    'placed operatives, in the "+" prefix notation Q uses for a category he is adding to a list'),
  I('PAN-DEM-IC', 'coded_alias', ['PAN-DEM-IC'],
    'The first line of #4294, immediately followed by "DEM–PANIC". Q hyphenates the word so that the same letters read as the second line, which is the point of the drop.',
    'Q\'s hyphenation of "pandemic", set against "DEM–PANIC" on the next line'),
  I('Joe 30330', 'coded_alias', ['Joe 30330'],
    'The first line of #4826, followed by "What is 2020 [current year] divided by 30330?" — the number is a text-to-donate shortcode Joe Biden gave in a 2019 debate, and Q treats it as a designation.',
    'the shortcode Joe Biden gave on a 2019 debate stage, which #4826 then divides into the year'),
  I('DECLAS CoC', 'coded_alias', ['DECLAS CoC'],
    'The heading of #3784, with the chain itself on the following lines: "POTUS > Barr" and "Barr > Durham".',
    'declassification chain of command — the drop lists the chain on the next two lines'),
  I('CLAS 1-99', 'coded_alias', ['CLAS 1-99', 'CLAS 1-99 Defense', 'CLAS 1-99 Intel'],
    'Q\'s classification-range marker, standing alone in #2776 and #3837 and split by department in #4645 ("CLAS 1-99 Defense", "CLAS 1-99 Intel").',
    'a classification range Q marks withheld material with, split by department in #4645'),
  I('Lord d R.', 'coded_alias', ['Lord d R.'],
    'A line of #178\'s stringer-reading sequence, two lines above "++". The archive separately certifies the Rothschild family, and this is Q\'s abbreviated form of a title in it — which is as far as the drop goes, so no individual is named here.',
    'Q\'s abbreviated form of a Rothschild title; the drop does not name which member'),
  I('Owls', 'coded_alias', [':Owls:', ':OWLS:'],
    'The opening line of #328 and a line of #452, written inside colons both times — Q\'s marker form for a symbol group.',
    'a symbol group Q marks off inside colons'),
  I('D-Room C', 'coded_alias', ['D-Room C'],
    'One of three "D-Room" designations listed together in #1001, under "Tunnels." and "Table 29."'),
  I('D-Room H', 'coded_alias', ['D-Room H'],
    'One of three "D-Room" designations listed together in #1001, under "Tunnels." and "Table 29."'),
  I('D-Room R', 'coded_alias', ['D-Room R'],
    'One of three "D-Room" designations listed together in #1001, under "Tunnels." and "Table 29."'),
  I('BLUE METAL', 'coded_alias', ['BLUE METAL'],
    'A line of #1473\'s comms block, directly under "CASTLE ARRIVAL GOOD" and among alphanumeric strings — a status token in the same series.'),
  I('JDLKD-8382KDJDzAZ7301', 'coded_alias', ['JDLKD-8382KDJDzAZ7301'],
    'The first line of #1473\'s comms block, one of three alphanumeric strings above "CASTLE ARRIVAL GOOD".'),
  I('PACKET HDQ-7309217392', 'coded_alias', ['PACKET HDQ-7309217392'],
    'The entire content of #1839 apart from the sign-off — a packet label posted on its own.'),
  I('DWS_DIR', 'coded_alias', ['DWS_DIR>', 'DWS_DIR'],
    'A node in #436\'s "ONE OF TWENTY TWO" chain, between "(SR 187)(MS13 (2) 187)>" and "F-I/D-J ASSIST>". DWS is the initial form Q uses for Debbie Wasserman Schultz, whom the archive certifies separately; DIR marks the role and ">" is the chain arrow.',
    'the DNC chair position in #436\'s chain — Q\'s initials for Debbie Wasserman Schultz, plus the role marker'),
  I('_4ch_n', 'coded_alias', ['_4ch_n'],
    'A line of #233\'s code block, directly above "_8ch_y" and below "Start_code_activated/instruction". The pair reads as the two boards with a no/yes flag, which is the migration #233 is about.',
    '4chan, flagged "n", in the board pair #233 sets against "_8ch_y"'),
  I('_8ch_y', 'coded_alias', ['_8ch_y'],
    'A line of #233\'s code block, directly below "_4ch_n". The pair reads as the two boards with a no/yes flag, which is the migration #233 is about.',
    '8chan, flagged "y", in the board pair #233 sets against "_4ch_n"'),
  I('Kerry\'s son', 'coded_alias', ['Kerry\'s son'],
    'One of four parallel lines in #3590 — "Pelosi\'s son", "Kerry\'s son", "Romney\'s son", "Biden\'s son" — followed by "Hint: Geo location: Ukraine" and "Hint: Energy". Q names the relationship rather than the person, and that is what is recorded.',
    'the oblique form Q uses in #3590\'s Ukraine-energy list; the drop names the parent, not the son'),
  I('Romney\'s son', 'coded_alias', ['Romney\'s son'],
    'One of four parallel lines in #3590 — "Pelosi\'s son", "Kerry\'s son", "Romney\'s son", "Biden\'s son" — followed by "Hint: Geo location: Ukraine" and "Hint: Energy". Q names the relationship rather than the person, and that is what is recorded.',
    'the oblique form Q uses in #3590\'s Ukraine-energy list; the drop names the parent, not the son'),

  // ── people the drop names, that the sentence splitter cut in half ───────────
  I('Charles W. Dent', 'person', ['Charles W.'],
    'The line in #1319 and #1850 is "Charles W. Dent - Republican" in Q\'s not-seeking-re-election list. The sentence splitter cut at "W." and the review ruled the fragment; the person is on the line.'),
  I('John J. Duncan Jr.', 'person', ['John J.'],
    'The line in #1319 and #1850 is "John J. Duncan, Jr. - Republican" in Q\'s not-seeking-re-election list. The splitter cut at "J.".'),
  I('Luis V. Gutierrez', 'person', ['Luis V.'],
    'The line in #1319 and #1850 is "Luis V. Gutierrez - Democrat" in Q\'s not-seeking-re-election list. The splitter cut at "V.".'),
  I('Patrick J. Tiberi', 'person', ['Patrick J.'],
    'The line in #1319 and #1850 is "Patrick J. Tiberi - Republican U.S. House" in Q\'s resigned list. The splitter cut at "J.".'),
  I('Ruben J. Kihuen', 'person', ['Ruben J.'],
    'The line in #1319 and #1850 is "Ruben J. Kihuen - Democrat" in Q\'s not-seeking-re-election list. The splitter cut at "J.".'),
  I('Jason V. Herring', 'person', ['Jason V.'],
    'The line in #2692 and #2697 is "Jason V. Herring – track & follow", among the FBI names Q lists after the Weiner-laptop passage. The splitter cut at "V.".'),
  I('Michael S. Rogers', 'person', ['Michael S.'],
    'The whole of #3319 is "Michael S. Rogers." and #4310 quotes the Washington Post on "Adm. Michael S. Rogers". The archive certifies him separately under Q\'s shorthand "Adm R"; this is the full name as written.'),
  I('Richard Pollock', 'person', ['Richard -'],
    'The line above it in #1960 is the link https://twitter.com/rpollockDC/... and the line below is "Pro TIP: Look @ CrowdStrike" — Q is addressing the reporter whose account he just linked.'),
  I('Renee J James', 'person', ['Renee J James'],
    'The whole of #303 apart from the sign-off. Renée James was president of Intel at the time of the drop.'),
  I('Roseanne Barr', 'person', ['@TheRealRoseanne'],
    'Q lists the account in #1863 beside @SeanHannity and @FoxNews under "Do not let this HYPOCRISY stand." — the handle names her.'),
  I('Al Gore', 'person', ['@algore'],
    'The first line of #1239, followed by "Today is Earth Day." and a Washington Post link about his green-tech investments. The handle names him.'),
  I('David Muir', 'person', ['David Muir'],
    'Named in #1515\'s WikiLeaks media list as an ABC journalist. The name is Q\'s own line.'),
  I('Beth Fouhy', 'person', ['Beth Fouhy'],
    'Named in #1515\'s WikiLeaks media list as an MSNBC journalist. The name is Q\'s own line.'),

  // ── organizations, agencies and units the drop names in full ───────────────
  I('ABC News', 'media_organization', ['ABC News'],
    'The outlet #1515\'s WikiLeaks media list means by "ABC" — a television news network, not the holding company the registry resolves the bare letters to.'),
  I('FBI Portland', 'government_agency', ['@FBIPortland'],
    'Q posts the handle in #4715 directly under two Instagram links. It is the Portland field office\'s own account.'),
  I('Federal Bureau of Investigation', 'government_agency', ['FEDERAL BUREAU OF "INVESTIGATION"'],
    'The header Q puts over his fired/forced FBI list in #2070, #2697 and #3990, with the quotation marks his own. Already certified; this registers the spelling he heads the list with.'),
  I('Department of Justice', 'government_agency', ['DEPARTMENT OF "JUSTICE"'],
    'The header Q puts over his fired/forced DOJ list in #2070, with the quotation marks his own. Already certified; this registers the spelling he heads the list with.'),
  I('Military Intelligence Team', 'organization', ['MILITARY INTELLIGENCE TEAM'],
    'One of the three unit designations #755 lists and then repeats under "DESIGNATION:" with unit codes beside them.'),
  I('Military Intelligence Battalion (Strategic Signals Intelligence)', 'organization', ['MILITARY INTELLIGENCE BATTALION (STRATEGIC SIGNALS INTELLIGENCE)'],
    'One of the three unit designations #755 lists and then repeats under "DESIGNATION:" with unit codes beside them.'),
  I('Military Intelligence Brigade (Strategic Signals Intelligence)', 'organization', ['MILITARY INTELLIGENCE BRIGADE (STRATEGIC SIGNALS INTELLIGENCE)'],
    'One of the three unit designations #755 lists and then repeats under "DESIGNATION:" with unit codes beside them, abbreviated "MI BRIGADE (STRAT SIGINT)" on the second pass.'),
  I('Barron\'s', 'media_organization', ['Barron\'s'],
    'One of four outlet names #1718 puts under its own headline — Barron\'s, Fortune, Daily Mail — in a drop that stacks the same Zuckerberg story from each.'),
  I('Bangko Sentral ng Pilipinas', 'organization', ['Bangko Sentral ng Pilipinas'],
    'Named in Q\'s central-bank list (#135-#138) as the Philippines\' central bank. The name is Q\'s own line, not supplied.'),
  I('Philippines', 'country', ['Philip Pines'],
    'Named in Q\'s central-bank list (#138) as the country whose bank the same line names. Q typed it as two words, which is why the round-2 rule did not match the line.'),
  I('Saudi Arabian Monetary Agency', 'organization', ['Saudi Arabian Monetary Agency'],
    'Named in Q\'s central-bank list (#138) as Saudi Arabia\'s central bank. The round-2 rule looked for "Monetary Authority"; this line says "Monetary Agency".'),

  // ── programs, operations, documents and law ────────────────────────────────
  I('Operation Cyclone', 'program_operation', ['Operation Cyclone'],
    'Q names it in #1887 and states its own subject on the same line — "Operation Cyclone>> Mujahideen/Afghanistan" — with the aid, withdrawal and funding lines under it.'),
  I('Crossfire Typhoon', 'program_operation', ['CROSSFIRE TYPHOON'],
    'Listed in #4011 between CROSSFIRE HURRICANE, which the archive already certifies, and CROSS WIND — the three codenames of the same investigation series.'),
  I('Fiddler', 'program_operation', ['Fiddler'],
    'Q gives it as "OP Name: Fiddler" in #836 and then uses the name again eight lines later ("Mission 6: Fiddler > Ghost-PRIME"), so the drop both names the operation and uses the name.'),
  I('Dragonfly', 'program_operation_project', ['Dragonfly'],
    'Q writes the name in #2378 directly under an Intercept link about Google\'s censored Chinese search engine, and above "Look HERE [RUSSIA] | DO NOT LOOK HERE [CHINA]".'),
  I('Project DeepDream', 'program_operation_project', ['Project DeepDream'],
    'Q quotes his own earlier drop back in #3584 — "[Feb 18 2018] “Project DeepDream v2[A]?” – Q" — beside "Project DeepMind?" and a whistleblower story about Google planetary-surveillance AI. The original is #790\'s "PROJECT DEEPDREAMv2[A]]".'),
  I('Executive Order 13526', 'legislation_regulation', ['Executive Order 13526'],
    'Q names it in #2177, #2207 and #2501 immediately under the GPO link to its text, then quotes Sec 1.7 from it verbatim.'),
  I('1996 Telecommunications Act', 'legislation_regulation', ['1996 Telecommunications Act'],
    'Q names it in #4278 under "Corporate media control [source]:" as "Bill Clinton_ 1996 Telecommunications Act".'),
  I('FBI 302', 'legal_investigative', ['302s', 'FBI 302\'s'],
    'The FBI interview form. Q lists it bare in #1443 ("302s | Texts | Tarmac | FBI | DOJ") and names it in full in #3330 ("FBI 302\'s"), both times among the evidence items of the same investigation.'),
  I('CIA-RDP84B00049R001303260026-4', 'other_named_entity', ['CIA-RDP84B00049R001303260026-4'],
    'Q posts it in #239 directly under "The Asia Foundation." and above "Happy hunting." It is a CIA CREST reading-room document identifier, which is what makes the line a pointer rather than a code.'),
  I('John 3:16', 'religious_spiritual', ['JOHN 3:16'],
    'The last line before the sign-off in #790, after "THE DAY OF RECKONING IS UPON US." — a chapter-and-verse citation.'),
  I('Senate Judiciary Chairman', 'title_role', ['Senate Judiciary Chairman'],
    'One of four committee-chair roles #2445 names in sequence — House Oversight, House Judiciary, then "TRUST GRASSLEY" and this line, which is the office Grassley held.'),
  I('Airbus A321', 'other_named_entity', ['A321'],
    'Q gives it in #1588 under "SFO>JFK" and above "Direct" — the aircraft type on the route the drop is about.'),
  I('Mujahideen', 'political_group', ['Mujahideen'],
    'Named on Q\'s own line in #1887, "Operation Cyclone>> Mujahideen/Afghanistan", with the anti-Soviet resistance lines beneath it.'),
  I('The Godfather Part III', 'creative_work', ['Godfather lll'],
    'Q lists it in #75 and #84 beside "Alice & Wonderland" and "Snow White" as one of the film titles he uses as codenames. He spells the numeral with three lowercase Ls.'),

  // ── spellings of things the archive already certifies ──────────────────────
  I('CrowdStrike', 'technology_platform', ['CROWDSTRIKE>'],
    'A node in #436\'s "ONE OF TWENTY TWO" chain, between "GOOG>" and "DNC>". Already certified; this registers the spelling the chain writes it in, arrow included.'),
  I('Christopher Steele', 'person', ['STEELE>'],
    'A node in #436\'s "ONE OF TWENTY TWO" chain, between "CLAS: 1-4 PAY>" and "PODESTA>". Already certified; this registers the spelling the chain writes it in, arrow included.'),
  I('Donald Trump', 'person', ['DONALD J.'],
    'The line in #2054 and #4010 is the proclamation formula "I, DONALD J. TRUMP, President of the United States of America". The splitter cut at "J.".'),
  I('Joe Biden', 'person', ['Joseph R.'],
    'The line in #4801 is "an intern in the office of Delaware Sen. Joseph R. Biden", quoted from Steve Scully\'s university biography. The splitter cut at "R.".'),
  I('Paul Nakasone', 'person', ['Army Lt.'],
    'The line in #1268 is "Army Lt. Gen. Paul Nakasone", under "Quiet." and above "Good." The splitter cut at "Lt." and the ruling landed on the rank; the person is on the line and already certified.'),
  I('Jeff Sessions', 'person', [']SESSIONS['],
    'Q writes the name inside inverted brackets in #1369, above "We Fight!". The bracket form is his, and the name inside it is already certified.'),
  I('Jerome Corsi', 'person', ['CORSI'],
    'Q writes the surname in capitals three times in #2500 — "CORSI > [attempt infiltrate] Q", "MUELLER > CORSI", "CORSI PLEA DEAL". Already certified; this registers the capitalised form.'),
  I('GOOG', 'technology_platform', ['+GOOG'],
    'One of three "+"-prefixed lines in #1841 — "+GOOG | +FB | +TWITTER" — under an FTC antitrust quotation. Already certified; this registers the prefixed form the list writes it in.'),
  I('Fox News', 'media_organization', ['@FoxNews'],
    'Q lists the account in #1863 between @SeanHannity and @TheRealRoseanne. Already certified; this registers the handle.'),
  I('Sean Hannity', 'person', ['@SeanHannity'],
    'The first line of #1863, above @FoxNews. Already certified; this registers the handle.'),
  I('Edward Snowden', 'person', ['@Snowden'],
    'Q addresses the handle in #728, #731 and #790. Already certified; this registers the handle form.'),
]

// ── splits: one span of Q's text that names more than one certified thing ────
const S = (spelling, postNum, into, why) => ({ spelling, postNum, into, why })
const splits = [
  S('Philip Pines: Bangko Sentral ng Pilipinas', 138, ['Philip Pines', 'Bangko Sentral ng Pilipinas'],
    'A country and its central bank on one line of the list Q pasted. Q typed the country as two words.'),
  S('Saudi Arabia: Saudi Arabian Monetary Agency', 138, ['Saudi Arabia', 'Saudi Arabian Monetary Agency'],
    'A country and its central bank on one line of the list Q pasted.'),
  S('ABC - David Muir', 1515, ['ABC News', 'David Muir'],
    'An outlet and one of its journalists on one line of the list Q pasted. This line uses a hyphen where the rest of the list uses an en dash, which is why the round-2 rule did not match it.'),
  S('MSNBC - Beth Fouhy', 1515, ['MSNBC', 'Beth Fouhy'],
    'An outlet and one of its journalists on one line of the list Q pasted. This line uses a hyphen where the rest of the list uses an en dash.'),
  S('Tag: USSS', 347, ['United States Secret Service'],
    'Q tags the drop with the agency\'s initials. The agency is already certified.'),
  S('HUSSEIN CABINET / STAFF', 559, ['Barack Obama'],
    'The header over #559\'s private-email list. "Hussein" is the form Q uses throughout for Barack Obama and is already a certified alias; "CABINET / STAFF" says whose list follows, not who.'),
  S('@Snowden "Truth To Power"', 728, ['@Snowden'],
    'A handle and a quoted phrase on one line. The handle names a certified person; the phrase is what he is being quoted saying, and is treated as quotation rather than as a name.'),
  S('@Snowden "Truth To Power"', 731, ['@Snowden'],
    'A handle and a quoted phrase on one line. The handle names a certified person; the phrase is what he is being quoted saying, and is treated as quotation rather than as a name.'),
  S('OP Name: Fiddler', 836, ['Fiddler'],
    'Q gives the operation\'s name after the label "OP Name:". The label is the field, the name is the value.'),
  S('SUM of ALL FEARS //\\\\', 864, ['The Sum of All Fears'],
    'Q names the Tom Clancy title and appends his own "//\\\\" marker. The archive already certifies the title.'),
  S('-Hillary Clinton & Foundation', 2365, ['Hillary Clinton', 'Clinton Foundation'],
    'A line of the IG-report notes Q quotes in #2365. Two certified entities on one line, with Q\'s leading dash.'),
  S('Hillary Clinton & Foundation', 2697, ['Hillary Clinton', 'Clinton Foundation'],
    'The same line of the same notes, quoted again in #2697 without the leading dash.'),
  S('Susan Wojcicki - CEO of YouTube', 2061, ['Susan Wojcicki', 'YouTube'],
    'A person and the company she led, on one line of #2061\'s family-tree chain. Both are already certified.'),
  S('Lisa Barsoomian _former Bill Clinton attorney', 4784, ['Lisa Barsoomian', 'Bill Clinton'],
    'The first line of #4784 names her and the person she is described as having represented. Both are already certified.'),
  S('Today: JK & Iran', 1317, ['JK', 'Iran'],
    'A person and a country on one line, under "Re_read drops." The archive certifies "JK" already, and the drop\'s next line — "Why is Hussein/JK traveling WW and meeting w/ foreign heads of state" — is what fixes the reading.'),
  S('Michael S. Rogers.', 3319, ['Michael S.'],
    'The whole of #3319 apart from the sign-off.'),
]

// ── the ones that stay questions ─────────────────────────────────────────────
const R = (spelling, postNums, why, kind) => ({ spelling, posts: postNums, why, kind })
const resolutionCenter = [
  R('L.', [300], 'A single initial on its own line in #300, between a question about Alwaleed and "Heard you can\'t sleep anymore." Q is addressing someone the drop does not name. It also appears 157 times across 125 drops as an ordinary initial, so certifying it would paint all of them.', 'unsettled'),
  R('[J C]', [1541], 'Q writes "[J C]" in #1541, #1546, #1559, #2070 and #2531. #1546 puts it under a Clapper article and #2531 puts it beside "Comey testimony?" — two different men with the same initials, and the drops do not settle which.', 'unsettled'),
  R('Eagle', [180], '#180 asks "What US President was nicknamed \'Eagle\' by the USSS?" without answering. The other seven occurrences in the corpus are all "Iron Eagle", which the archive certifies as a separate coded alias, so certifying the bare word would paint inside them.', 'unsettled'),
  R('Eagles', [180], 'Part of "FlyEaglesFly" in #180. The drop does not say whether the hashtag means the Secret Service codename it just asked about or the football team.', 'unsettled'),
  R('RED', [273], '#273 is three lines — "R", "RED", "D" — with no other text. The word appears 187 times across 88 drops (RED WAVE, RED CROSS, RED OCTOBER, Red_Red), so a single reading cannot be certified for all of them.', 'unsettled'),
  R('BRAVO', [1004], 'A line of #1004\'s comms block between "SEC TEST" and "B" — the phonetic alphabet letter for the "B" on the next line, rather than a name.', 'unsettled'),
  R('AIR', [1010], 'A one-word line in #1010\'s list of vectors — WATER, AIR, CHEMICALS, VACCINES, TOBACCO, OPIOIDS. It names a medium, not a named thing, and appears in nine drops.', 'unsettled'),
  R('BIG', [2040], 'Three identical lines in #2040 under a Judicial Watch link. It is emphasis, and it appears 89 times across 71 drops.', 'unsettled'),
  R('45', [1565], 'The whole of #1565 apart from a post reference. It reads as the 45th President, but the two characters appear 281 times across 255 drops as an ordinary number, so it needs an occurrence-scoped ruling rather than a corpus-wide alias.', 'would-paint-wrong-text'),
  R('Mr.', [4850], 'The line in #4850 is "Mr. Russia collusion pusher himself now involved?" — a description, not a name. The abbreviation appears in 27 drops.', 'unsettled'),
  R('Sen.', [3778, 4935], 'The rank prefix in front of five different senators across #3778 and #4935. It names no one on its own and appears in nine drops.', 'would-paint-wrong-text'),
  R('Rep.', [3778], 'The rank prefix in front of three different representatives in #3778. It names no one on its own.', 'would-paint-wrong-text'),
  R('Gov.', [4935], 'The rank prefix in front of two different governors in #4935 — Cuomo and McAuliffe.', 'would-paint-wrong-text'),
  R('M.', [3383], 'The line in #3383 is "M. Waters $4mm House?" and names Maxine Waters, but the two characters appear 67 times across 57 drops as an ordinary initial.', 'would-paint-wrong-text'),
  R('N.', [3383], 'The line in #3383 is "N. Pelosi net worth $150mm+?" and names Nancy Pelosi, but the two characters appear 141 times across 113 drops.', 'would-paint-wrong-text'),
  R('IN.', [4206], '#4206 breaks one sentence across three lines — "PANIC." / "IN." / "DC." The middle line is a preposition and appears in 33 drops.', 'unsettled'),
  R('+', [124, 126, 134, 679, 1218, 2165], 'Q writes "+", "++" and "+++" as a three-tier series, and #134 sets them under "One side of the triangle removed (1st time in history)." The drops never say who each tier is. A "+" also has no word boundary, so certifying the single character would paint inside "++", "+++", "+GOOG", "+Sleepers" and every arithmetic plus in the corpus.', 'would-paint-wrong-text'),
  R('++', [124, 126, 134, 156, 177, 178, 679], 'The middle tier of the same series, 51 occurrences across 23 drops. Certifying it would paint inside every "+++".', 'would-paint-wrong-text'),
  R('+++', [123, 124, 126, 134, 679], 'The top tier of the same series, 31 occurrences across 17 drops. The drops never state who it stands for.', 'unsettled'),
  R('***', [3989, 4506, 4607, 4762], 'A whole-drop line in #3989 and a line above "Are you ready to serve once again?" in #4607. It marks something rather than naming it.', 'unsettled'),
  R('Mr. President, my prayer is constantly turned to the beloved American nation, …', [4542], 'A paragraph of the Viganò letter #4542 reproduces. It is a quotation, not a name — the entity in it is the writer, and the drop names him elsewhere.', 'not-a-name'),
  R('Twitter keywords - coincidence', [244], 'A line of #244\'s proof list, in the shape "X - coincidence". It states a claim about a coincidence rather than naming a thing.', 'not-a-name'),
  R('Twitter retweet - coincidence', [244], 'A line of #244\'s proof list, in the shape "X - coincidence".', 'not-a-name'),
  R('Revise Constitution', [570], 'A policy item in #570\'s "HRC [8] WWIII" list, beside "Open borders" and "Ban sale of firearms". It names an action, not a thing.', 'not-a-name'),
  R('@[19][1st]', [952], 'A bracketed pointer at the top of #952, above "@[3][1st]" and "The LINK." It indexes something rather than naming it.', 'not-a-name'),
  R('@[3][1st]', [952], 'A bracketed pointer at the top of #952.', 'not-a-name'),
  R('LINE CONF B-Z', [983], 'A line of #983\'s comms block, which is entirely "SEC T / [ / [ / ] / SEC 1 / SEC A / SEC / / SEC # / LINE CONF B-Z / /RUN/". A confirmation instruction, not a name.', 'not-a-name'),
  R('SEC A SEC /', [983], 'Two adjacent lines of the same comms block, run together by the splitter.', 'not-a-name'),
  R('IN GOD WE TRUST.', [1602], 'The last line before the sign-off in #1602, after "RED WAVE." and "WHITE SQUALL." The app already treats it as a recurring Q phrase and paints it as one.', 'not-a-name'),
  R('Bandwagon shills', [1796], 'A line of #1796\'s attack list, beside "Paid shills (Media Matters)" and "Fake MAGA supporters". It names a category of people, not a named group.', 'not-a-name'),
  R('(………………..)(………………….)', [1871], 'The bottom row of #1871\'s "Ex 1.1" diagram. Q leaves the two boxes blank on purpose — that is the exercise.', 'not-a-name'),
  R('GMAIL DRAFTS', [1876], 'The header of #1876, over a list of what Q says was passed through them. It names a technique, and the platform in it is already certified.', 'not-a-name'),
  R('Line 4', [1912], 'A pointer into the document #1912 then quotes. It names a position in a text.', 'not-a-name'),
  R('Sec 1.7', [2177, 2207, 2501], 'The section of Executive Order 13526 that #2177, #2207 and #2501 then quote. The order itself is now certified; this is a pointer into it.', 'not-a-name'),
  R('FISA = FISC', [1944], 'An equation Q writes in #1944 between two acronyms. The archive types neither FISA nor FISC as an entity — they sit with DECLAS, SIGINT and GITMO as domain terms — so certifying the equation would introduce them by the back door.', 'not-a-name'),
  R('NOFORN', [1944], 'A dissemination-control marking, in the same family as CLAS and DECLAS, which the archive does not type as entities.', 'not-a-name'),
  R('-House testimony', [1986], 'A repeated follow-on line under three different names in #1986\'s cooperating-witness list. It says what happened next, not who.', 'not-a-name'),
  R('-OIG report', [2681], 'A line of #2681\'s sequence list, beside "-Barr meeting Huber & OIG". It names a document that does not exist yet in the drop.', 'not-a-name'),
  R('GOOG whistleblower', [3584], 'The first line of #3584. It describes a person the drop does not name; the company is already certified.', 'not-a-name'),
  R('Desk', [3627], 'One of four items in #3627\'s "Future trip(c) re_verify:" list — Notebook, Pen, Watch, Desk. They are objects to be photographed, not named things.', 'not-a-name'),
  R('Notebook', [3627], 'One of four items in #3627\'s "Future trip(c) re_verify:" list.', 'not-a-name'),
  R('Pen', [3627], 'One of four items in #3627\'s "Future trip(c) re_verify:" list. It also appears in 15 drops, mostly in "Follow the pen".', 'not-a-name'),
  R('Alexander Jones, 36', [4697], 'A name and age from the arrest list #4697 reproduces. Certifying it would put a private individual in the registry under a name one character from Alex Jones the broadcaster, whom the archive already certifies as someone else.', 'unsettled'),
  R('ROTHS', [263], 'Q writes it only inside a longer token - "#FLYROTHSFLY#" in #248, #252 and #301, "+FLYROTHSFLY+" in #263 - and spells the family out in full as "ROTHSCHILD." in #1010 and #135. Certifying the fragment as an alias of the Rothschild family makes its ONLY occurrence a substring extraction, which audit-occurrence-provenance.mjs flags and proposes removing (it did, on the first run through: invalid_substring_extraction 98 -> 99, #263:0). The family itself is already certified, so nothing is lost by leaving the hashtag alone.', 'would-paint-wrong-text'),
  R('ABC → Alphabet Inc.', [1515], 'NOT a held row — a defect found while resolving them. #1515\'s WikiLeaks media list has 16 lines reading "ABC – <journalist>", and the registry resolves the bare letters "ABC" to Alphabet Inc., so those lines certify the television network as Google\'s holding company. "ABC News" is now declared as a separate identity and this line\'s split points at it; the other 15 lines still point at Alphabet.', 'defect'),
]

const out = {
  note: 'The 128 wordings sheet 3 held, researched against the drop each one sits in.',
  ruling: 'i want to classify all those as entities and i would like you to do the research for each post they are with in to give them the best hover description you can. anything you are unsure of lets put in the resolution center',
  ruledOn: '2026-08-24',
  resolutionOrder: prev.resolutionOrder,
  typeVocabulary: 'Only types already present in public/data/entities.json are used. No new type is introduced by this batch.',
  heldRowsIn: 'audit/unhighlighted-entity-identities-2.json held[] (128 wordings)',
  totals: {
    heldRowsAddressed: 128,
    identitiesDeclared: identities.length,
    splitsDeclared: splits.length,
    sentToResolutionCenter: resolutionCenter.length,
  },
  identities,
  splits,
  // held[] is deliberately EMPTY. The resolver treats held[] as a PREFIX BLOCKLIST checked before
  // anything else, so a row named here would be refused before any identity above could resolve it.
  // What is not certified is in audit/held-entity-resolution-center.json instead, which is a queue
  // rather than a refusal.
  held: [],
}
const RC = {
  note: 'Held rows that stay questions, for the Resolution Center.',
  ruledOn: '2026-08-24',
  why: 'Two different things land here and only one is uncertainty. "unsettled" means the drop does not fix the referent. "would-paint-wrong-text" means the reading IS clear but the alias is corpus-wide: the renderer paints a certified alias everywhere it appears, so certifying "45" or "N." would light up hundreds of spans that mean nothing of the kind — those need an occurrence-scoped ruling, which is the owner\'s call. "not-a-name" means the span states or points at something rather than naming it. "defect" is a problem found while resolving the rest.',
  totals: Object.fromEntries(Object.entries(
    resolutionCenter.reduce((a, r) => ((a[r.kind] = (a[r.kind] ?? 0) + 1), a), {})
  ).sort((x, y) => y[1] - x[1])),
  rows: resolutionCenter,
}

if (check) { console.log(JSON.stringify({ ...out.totals, byKind: RC.totals }, null, 1)); process.exit(0) }
fs.writeFileSync(path.join(ROOT, 'audit/unhighlighted-entity-identities-3.json'), JSON.stringify(out, null, 1))
fs.writeFileSync(path.join(ROOT, 'audit/held-entity-resolution-center.json'), JSON.stringify(RC, null, 1))

const spellings = new Set(identities.flatMap(i => i.spellings))
console.log('\nHELD ROWS, RESEARCHED\n')
console.log('  held wordings addressed : 128')
console.log(`  identities declared     : ${identities.length}  (${spellings.size} spellings)`)
console.log(`  splits declared         : ${splits.length}`)
console.log(`  to the Resolution Center: ${resolutionCenter.length}`)
for (const [k, n] of Object.entries(RC.totals)) console.log(`      ${String(n).padStart(3)}  ${k}`)
console.log('\nwrote audit/unhighlighted-entity-identities-3.json')
console.log('wrote audit/held-entity-resolution-center.json\n')
