// Claude review of "Q Unhighlighted.csv" — places every row into one of the app's 7
// analysis categories (plus NEEDS CONTEXT where honesty requires it), records agreement
// with the GPT column, and notes question-form / quoted-source / split-fragment cases.
// Read-only over app data; writes only into this gpt-review folder + a Desktop copy.
import fs from 'node:fs';

const SRC = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Q Unhighlighted.csv';
const APP = 'C:/Users/heath/q-app';

// ---------- CSV parse ----------
function parseCSV(t) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); if (row.length > 1 || row[0] !== '') rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// ---------- normalization ----------
function norm(s) {
  return s
    .replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...').replace(/[\u2013\u2014]/g, '-')
    .replace(/\uFFFD/g, "'")
    .trim();
}
function key(s) {
  let k = norm(s).toLowerCase();
  k = k.replace(/^[">\s]+/, '');                 // leading quote/pointer marks
  k = k.replace(/["\s]+$/, '');
  k = k.replace(/[.!\u2026]+$/g, '').replace(/\.+$/g, '').trim(); // trailing . ! … (keep ?)
  k = k.replace(/\s+/g, ' ');
  return k;
}

// ---------- certified layers ----------
const entities = JSON.parse(fs.readFileSync(APP + '/public/data/entities.json', 'utf8'));
const codes = JSON.parse(fs.readFileSync(APP + '/public/data/codes.json', 'utf8'));
const entitySet = new Set();
for (const e of (entities.entities || [])) {
  if (e.canonical) entitySet.add(key(e.canonical));
  for (const a of (e.aliases || [])) entitySet.add(key(String(a)));
}
const codeSet = new Set();
for (const c of (codes.codes || [])) {
  const t = c.code || c.text || c.token; if (t) codeSet.add(key(String(t)));
}

// ---------- category constants ----------
const Qn = 'Q Questions', Dr = 'Q Directives', Cl = 'Q Claims', Pr = 'Q Predictions',
  En = 'Q Entities', Br = 'Q [ Brackets ]', Th = 'Q Themes', NC = 'NEEDS CONTEXT';

// ---------- exact-wording overrides (key(): lowercased, trailing ./! stripped) ----------
const OV = new Map();
const add = (cat, note, ...words) => { for (const w of words) OV.set(w, { cat, note }); };

// — Questions written with a period / truncated by segmentation —
add(Qn, 'question form despite period',
  "don't you think potus would be tweeting about removal given clear conflict",
  'why aren\'t phones allowed in this room (one of many)', 'who is a', 'what is a',
  'what are the laws in sa v', 'what us publicly traded co. previously entered n',
  'why was the u.s', 'did you see sen', "how do you ensure 'appeals' to the u.s",
  'who briefed nunes on classified intel re: hussein spy campaign v', 'are they afraid of u.s',
  "why did [ll] [attorney general of the united states] grant 'special entry' to natalia veselnitskaya (don jr",
  'why was it important to use sources within the uk vs', 'why did u.s',
  'what more effective way is there to do this, mr',
  "why is the fbi's top child porn lawyer involved in the h", 'why would h', "why wouldn't h",
  'how about a nice game of chess', 'note the time?', 'note apple\'s stock image(s)?',
  "will the next wave of [d] 2020 candidates begin to push the 'everything will be free' 'reparations for all black americans' 'more gov't control will save us' etc. etc. etc",
  'do you think it was sen');
add(Qn, 'fragment of quoted question ("What storm, Mr. President?") — split at abbreviation',
  'president?"', '"what storm, mr');
// question-bucket rows that are NOT questions
add(Cl, 'statement, not a question', "wasn't referring to kansas' statement re: clinton emails");
add(Dr, "imperative — the '?' belongs to the game title", "play a game of 'where are they now?'");
add(Br, 'truncated stringer/bracket fragment', 'x?]?');

// — Directive bucket corrections —
add(Th, 'quoted Scripture (Ephesians 6 / 1 Cor 13 / Colossians 3) — religious theme, not a Q directive',
  'stand firm then, with the belt of truth buckled around your waist, with the breastplate of righteousness in place, and with your feet fitted with the readiness that comes from the gospel of peace',
  'take the helmet of salvation and the sword of the spirit, which is the word of god',
  '17 take the helmet of salvation and the sword of the spirit, which is the word of god',
  "put on the full armor of god, so that you can take your stand against the devil's schemes",
  "put on the full armor of god so that you can take your stand against the devil's schemes",
  'love does not delight in evil but rejoices with the truth', 'love never fails',
  'put to death, therefore, whatever belongs to your earthly nature: sexual immorality, impurity, lust, evil desires and greed, which is idolatry',
  'be on your guard; stand firm in the faith; be courageous; be strong',
  'be strong in the lord');
add(Th, 'prayer (Q-posted prayer text) — religious theme',
  'forgive my sins, so that i may be clean in your righteousness',
  'make me brave, so i can stand and fight the spiritual battles in my life and in our world',
  "give me your wisdom and discernment so i won't be caught off guard",
  'help us to avoid temptation, and deliver us from evil, lord');
add(Th, 'valediction', 'love and light, patriot');
add(Cl, 'taunt/statement, not a directive', 'hope the $7.8mm was worth it',
  'hope you enjoyed the xmas decor!', 'hope not', 'total control re: msm', 'total viewers limited',
  'select news members / journalists are vital to delivering the message (as are you)',
  'push to divide is strong', 'use of symbolism to push strength and belonging to something powerful',
  "use of that 'something' to 'frame' justice k", 'picture provides 40,000ft. v',
  'reference correct', 'honor-bound',
  "protect biden from embarrassment re: mental health [clear cognitive decline], q&a, rally attendance crowd size, lack of enthusiasm, etc");
add(Cl, 'quoted article text, not a Q directive',
  'trade between germany and iran reached 3.4 billion euros ($4 billion) last year, according to bga, another foreign trade association',
  'total s.a. is a french multinational integrated oil and gas company and one of the seven "supermajor" oil companies in the world');
add(Cl, 'quoted POTUS tweet', 'we must bring honesty back to journalism and reporting!');
add(Pr, 'prediction (Yoda-style inversion)', 'fail they will');
add(Pr, 'predictive assessment', 'resist op will not provide enough public support for cover',
  'support will always be provided [undisclosed methods]');
add(Cl, 'describes a move made, imperative in form only', 'insert rudy');
add(Br, 'operational stringer/code', 'strike package 111v-b', 'fly high');
add(Th, 'recurring concept label', 'group-think');
add(Cl, "part of split line 'You. Have. More. Than. You. Know.'", 'have');

// — Prediction bucket corrections: quoted source material —
const DECL = 'quoted Declaration of Independence — used thematically, not a Q prediction';
add(Th, DECL,
  'prudence, indeed, will dictate that governments long established should not be changed for light and transient causes; and accordingly all experience hath shewn that mankind are more disposed to suffer, while evils are sufferable than to right themselves by abolishing the forms to which they are accustomed',
  'prudence, indeed, will dictate that governments long established should not be changed for light and transient causes; and accordingly all experience hath shewn, that mankind are more disposed to suffer, while evils are sufferable, than to right themselves by abolishing the forms to which they are accustomed');
add(Th, 'quoted Reagan speech — thematic',
  "it must be fought for, protected, and handed on for them to do the same, or one day we will spend our sunset years telling our children and our children's children what it was once like in the united states where men were free",
  '"you and i have the courage to say to our enemies, "there is a price we will not pay." "there is a point beyond which they must not advance',
  "let us reaffirm america's destiny of goodness and good will");
add(Th, 'quoted Scripture — thematic',
  'for god so loved the world that he gave his one and only son, that whoever believes in him shall not perish but have eternal life',
  'even though i walk through the darkest valley, i will fear no evil, for you are with me; your rod and your staff, they comfort me',
  '6 because of these, the wrath of god is coming');
add(Th, 'quoted Thomas Paine — thematic',
  'the summer soldier and the sunshine patriot will, in this crisis, shrink from the service of their country; but he that stands by it now, deserves the love and thanks of man and woman');
add(Th, 'prayer text', 'you will bring justice in due time for all the harm and needless violence aimed at your children',
  'you are the mighty one, the one who will ultimately bring all evil to light');
add(Cl, 'quoted legal/EO/statute text ("shall/will" is the law\'s language, not a Q prediction)',
  'in accordance with article 33 of the ucmj, as amended by section 5204 of the mja, the secretary of defense, in consultation with the secretary of homeland security, will issue nonbinding guidance regarding factors that commanders, convening authorities, staff judge advocates, and judge advocates should take into account when exercising their duties with respect to the disposition of charges and specifications in the interest of justice and discipline under articles 30 and 34 of the ucmj',
  'that guidance will take into account, with appropriate consideration of military requirements, the principles contained in official guidance of the attorney general to attorneys for the federal government with respect to the disposition of federal criminal cases in accordance with the principle of fair and evenhanded administration of federal criminal law',
  'shall be fined under this title or imprisoned not more than twenty years, or both, and shall be ineligible for employment by the united states or any department or agency thereof, for the five years next following his conviction',
  'if two or more persons conspire to commit any offense named in this section, each shall be fined under this title or imprisoned not more than twenty years, or both, and shall be ineligible for employment by the united states or any department or agency thereof, for the five years next following his conviction',
  'this executive order shall remain in effect until november 3, 2020');
add(Cl, 'quoted third-party text, not a Q prediction',
  'this story must not be used as a pretext for the corrupt purpose of firing deputy attorney general rosenstein in order install an official who will allow the president to interfere with the special counsel\'s investigation," schumer said in a statement',
  'one official says investigators found that it eventually affected almost 30 companies, including a major bank, government contractors, and the world\'s most valuable company, apple inc',
  'a group representing german trade interests said the us decision to withdraw from the deal will hit german companies and urged the eu to protect their interests',
  'while we should have a larger conversation in the near future about a broader strategy for reengaging the beat press that covers hrc, for this we think we can achieve our objective and do the most shaping by going to maggie',
  'the fake news will knowingly lie and demean in order make the tremendous success of the trump administration, and me, look as bad as possible',
  'these stories will only matter/hurt us if we keep pushing hard and get too much chatter out there',
  'perhaps recognizing how offensive such ties will be to voters concerned over future terrorist attacks on this country by radical muslims professing allegiance to sharia law, the clinton campaign on monday tried to downplay ms',
  "democrats will complain long and loud about this, but i don't see how barr can be reasonably faulted for following the law",
  'priestap\'s departure, none of the high-ranking bureau officials involved in the two investigations will remain with the bureau',
  'american counterinsurgency practice rests on a number of assumptions: that the decisive effort is rarely military (although security is the essential prerequisite for success); that our efforts must be directed to the creation of local and national governmental structures that will serve their populations, and, over time, replace the efforts of foreign partners; that superior knowledge, and in particular, understanding of the \'human terrain\' is essential; and that we must have the patience to persevere in what will necessarily prove long struggles',
  'insurgency, however, can and will flourish in the modern environment',
  'we found this activity as part of our internal investigations into suspected coordinated inauthentic behavior ahead of the 2020 election in the us',
  "this is a real concern to all of us this won't ever become law, but it'll be the wishlist of the liberals, to try to change election law, fund planned parenthood, and make sure sanctuary cities get the chunk of the money");
add(Cl, 'statement about the present, not a prediction', 'always ahead',
  "we won't telegraph our moves to the enemy", 'important moment in time',
  'gowdy comments on comey (history will ....)',
  "that's part of the reason why some things that tie back to foreign heads of state will remain classified (not all)",
  'this is so critical and why information is provided in a certain order and why some topics are continually emphasized more than others as those will be the recent happenings',
  'those loyal to the office of the president and the will of the people',
  'we, the people, are who they fear will one day awake',
  'like past battles fought, we now face our greatest battle at present, a battle to save our republic, our way of life, and what we decide (each of us) now will decide our future');
add(Cl, 'describes the Hawaii false-alert event', 'fake incoming missile alert [defcon 1]',
  'unauthorized emergency incoming missile threat activated hawaii');
add(Cl, "Q voicing the media's narrative, not Q's own prediction", 'potus will destroy the world');
add(Th, 'recurring good-v-evil maxim', 'good will always defeat evil');
add(Th, 'scripture-derived slogan', 'the truth will set you free');
add(Th, 'honor/valediction family', 'your sacrifices will never be forgotten',
  'your sacrifice(s) will never be forgotten', 'their sacrifice will never be forgotten',
  'your sacrifice will never be forgotten');
add(Th, 'label/heading', 'a moment in time');

// — Acknowledgment bucket refinements —
add(Pr, 'taunt foretelling the target\'s exit ("Goodbye, Mr. Rosenstein" family)',
  'goodbye, mr', '"goodbye" mr', 'goodbye @jack', 'goodbye, valerie jarrett', 'bye bye johnny',
  'goodbye al', 'goodbye c');
add(Pr, 'taunt foretelling Snowden\'s return to the US', 'welcome home, @snowden');
add(Cl, 'rhetorical accusation — asserts the [D] party cons its voters',
  'welcome to the [d] party con', 'welcome to the [d] party', 'welcome to the con',
  'welcome to the democrat party', 'welcome to the real [d] party',
  "welcome to the [d][people's republic of china] party",
  'welcome to the no borders, pro pedo, destroy ice, socialist movement - antifa (arm of democratic party)');
add(Cl, 'rhetorical framing that asserts a condition',
  'welcome to the deep state', 'welcome to the swamp', 'welcome to the police state',
  'welcome to the shadow presidency of barack h', 'welcome to the shadow presidency of barack hussein obama',
  'welcome to epstein island', 'welcome to china', 'welcome to ca', 'welcome to the mainstream');
add(Cl, 'acknowledgment wrapping an accusation',
  'thank you for showing the world how clowns pass the narrative to journalists @ 4am',
  'thank you for confirming...', 'thank you for confirming');
add(Cl, 'quoted POTUS statement',
  'thank you to our justice department and our federal law enforcement agencies for protecting our governors and all the rest of our people without regard to politics');

// — Slogan bucket: rows that are really claims (status/assertions) —
add(Cl, 'operational status assertion, not a slogan',
  'snow white 3 now offline', 'snow white 4 now offline', 'snow white 6 now offline',
  'snow white 7 now offline', 'corona 1 now offline', 'big bird-9 now offline',
  'package complete', 'comms good', 'operational', 'delta [6] conf', 'nsa no more',
  'sa [access] closed', 'epstein island [access] closed', 'haiti [access] closed',
  'nk [access] closed', 'china [access] closed', 'russa [access] closed', 'cuba [access] closed',
  '[rr] debrief complete', 'eo active', 'new trip confirmed', '/pf/ safe', 'sec test',
  'mueller blockade end', 'panic button pushed', 'panic everywhere', 'clinton panic', 'clinton fear',
  'eu blinked', 'zero tariffs (us>eu)', 'russia delay in meeting putin (dc)', 'recent example',
  'fb returning to the news', 'darpa terminates program feb 4, 2004', 'fb founded feb 4, 2004',
  'sessions & huber weekend meeting(s)', '(9) total (6_non pub)', 'confirmed', 'good',
  'd lost slave grip', 'd lost center voters', 'msm projects as big movement', '4-6% lost forever',
  'no other vehicle to regain entry', 'treason at highest levels', "foreign agents within our gov't",
  'strings cut', 'the hunt continues', 'stage set future prevent/removal op', 'public/narrative',
  'no checks & balances in place', 'no safeguards in place', 'controlled at the top',
  'fake news only divides', 'sheep follow blindly', 'blind sheep follow', 'shadow presidency set up',
  'old guard power structure being destroyed', 'darpa panic > exposure', 'time = corruption',
  'power = protection', 'proofs negate falsehood/conspiracy attacks', 'people respond to logic/facts',
  'fisa = start', 'foundation built huber', 'not all federal/criminal', 'known conflict',
  'blackout necessary', 'careless', 'predictable', 'no power', 'offline for a reason',
  'nk defuse', 'russia testing new missiles', 'russia new threat', '2 billion people',
  '$700b - military [this year]', 'biden/china very important marker', 'iran next',
  'hostage release', 'big development', 'cleared of all charges', 'biggest fear', 'public awakening',
  'election rigging', 'vaccines [not all]', 'wars [fake][top happy][backend deal]', '(2) extinguished',
  'sr 187 discovery', '[[rr]] @ wh', 'attacks increase from all directions', 'anons catch it all!',
  'narrative shift in full force', 'swamp fighting back', 'hussein "isis jv team..."',
  'hussein "isis jv team\'."', 'mueller fake news', 'not russia', 'highest authority', 'less than 10',
  'fake maga', 'russia = the real conspiracy', 'like clockwork', 'clockwork',
  'the world is watching', 'deny proper counting u.s', 'no sleep in dc', 'fake news in full panic',
  'over the target', 'nobody walks away from this', '[1] opens the door', '[8] fired', '[x] jailed',
  '[scare] necessary event', 'these people deserve to [    ]', 'wars [fake]',
  'bigger than watergate', 'biggest scandal in us history', 'biggest scandal in american history',
  'biggest political scandal in american history', 'the greatest political scandal in history',
  'much bigger!', 'if america falls, the world falls', 'nothing', 'false', 'fake', 'fake!',
  'fake news constant attacks', 'black ops against usa', 'total takeover of our country',
  'traitors all', 'traitors everywhere', 'rats everywhere', 'traitors!!!', 'left hypocrisy',
  'liberal left lunacy [bait]', 'false in one thing', 'false in everything',
  'these people are stupid', 'all for a larp', "all for a 'conspiracy'", 'controlled submissive sheep',
  'illegal immigrants first', 'americans last', 'pay-for-play spider web', 'clinton connection',
  'the clinton connection', 'clinton foundation at the center', 'white house for sale',
  'only the illusion of democracy', 'wheel of corruption', 'the wheel of corruption',
  'power of the purse', 'power to appoint sc justices', 'leader of the free world',
  'it is truly the enemy of the people!', 'funds: expenses v', 'total u.s', 'de facto standard',
  'scaramucci model', 'monday', 'zero', 'nat sec', 'national security', 'national emergency',
  'national crisis', 'matters of national security', 'everything at stake',
  'future of our republic at stake', 'win or die', 'fifth column', 'enemies of the republic',
  'destruction of america', 'assault on america', 'infiltration', 'prevention of accountability',
  'prevention of transparancy', 'a critical moment in time', 'one leads to many',
  'full disclosure [delcas] provides truth', 'foreign corroboration provides truth',
  'the disease called corruption', 'crimes against humanity', 'enemy of humanity',
  'shadow arm [d]', '[d] efforts to regain power', 'people [united] have the power',
  'power belongs with the people', 'power back to the people', 'returning power to the people',
  'returning power to the people!', 'power to the people', 'power w/ the people',
  'fisa brings down the house', 'evil & corruption', 'heidi fleiss (evil/clown/blackmail)',
  'prepared at all costs!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
  'their only hope', 'at all costs', 'their last hope', 'red line', 'the red line', 'scam',
  'abuse of exec powers', 'illegal spying', 'frame', 'shock and awe', "'silent' majority no more",
  'silent majority no more', 'what a big news day', 'hot in dc', 'so much!', 'crooked [[[hillary]]]',
  'nothing!', 'deconstruct includes d2_spy insert', 'lmt_no_nons', 'surprise witness',
  'dark secrets', 'group think', 'public shame against those who challenge', 'hatred for america',
  'slavery', 'no deals', 'no deals!', 'no escape', 'sick & disgusting', 'sick!',
  'the shot heard around the world', 'a week to remember', 'very very very important',
  'big!', 'boom!!!!!!!!!!!!', 'fear & scare push', 'mind warfare');
add(Pr, 'predictive slogan', 'tidal wave incoming', 'not long now', 'will guide', 'game over',
  'checkmate', "2019 - year of the boomerang");
add(Dr, 'call to action', 'memes at the ready', 'battle stations', 'bombs away!', 'fire when ready',
  'for god & country - learn!', 'for humanity - wake up - learn', 'meme prep', 'memes prep',
  'memes/posts', 'think for yourself');
add(Br, 'certified/operational code or stringer', 'geronimo', 'maverick', 'apache', 'zerocool',
  'castle_rock', 'red_castle', 'green_castle', 'red castle', 'green castle', 'castle lock',
  'castle clean', 'castle_online', 'castle_green', 'red cross red red', 'red red 9/11',
  'cap_h(9)', 'splash', 'fox three', 'kill_chain', 'bridge-2', 'clas-5', 'bdt & defcon',
  '....on...and....>on....', '[ab[c]]defghijklm....', 'zebra_zebra', 'bravo-2gkvt',
  'auth b19-2', 'auth 1st s', 'sparrow red', 'snow white pounce', 'ex-rvid5774',
  'project deepdreamv2[a]]', 'operation q-t2810c', 'x to x "..............."', 'p = c',
  'd5', 'dark [10]', '[-48] dark', 'marker [9]', '[marker]', '[showers]', 'april showers',
  'april shower', 'march madness', 'march madness!', 'white squall', "'squall", 'sky event',
  'sky', 'rig for red', 'rig for silent', 'rig for silent running', 'running red', 'red october',
  'red_october', 'the hunt for red october', 'iron eagle', 'as the world turns', 'blunt & direct time',
  'bdt', 'magic sword', 'death blossom', 'green', 'green (yes)', 'for green', 'nat g',
  'jason bourne (deep dream)', 'strike package 111v-b', 'twitter rec 24d', 'missile', 'missle',
  'wizards & warlocks', 'wizards & [war]locks', 'alice & mad hatter', 'yellow brick road',
  "'yellow brick road'", 'keyhole', 'fly high', 'night_riders_fly');
add(En, 'certified entity — also a certified coded phrase (dual layer)',
  'snow white', 'godfather iii', 'jason bourne (deep dream)', 'alice & wonderland');
add(Th, 'wordplay slogan', 'pan[dem]ic', 'woke');
add(En, 'entity reference', 'potus & jfk jr', 'state_of_the_union');
add(Th, 'recurring concept', 'hive mind', 'hive-mind');

// — Claim bucket: recurring refrains → Themes; futures → Predictions; nudges → Directives —
add(Th, 'the WWG1WGA motto', 'where we go one, we go all', 'where we go one, we go all!',
  'where we go one, we go all!!!', 'wwg1wga - jfk', 'scott free > wwg1wga!!!');
add(Th, 'recurring refrain', 'what a wonderful day', 'what a wonderful day!',
  'no coincidences', 'nothing is a coincidence', 'moves & countermoves', 'moves and countermoves',
  'the more you know', 'the more you know!!!!!', 'the more you know.');
add(Pr, 'predictive', "it's only a matter of time", 'booms en route', 'history books',
  "when we're done he'll claim kenyan citizenship as a way to escape",
  'when that is revealed those who doubted may see the light', 'fireworks', 'you\'re next',
  'rbg next', 'iran next []', 'almost time', 'next week', 'done in 30', "'done in 30",
  'june eta', '[next week]', 'showtime', 'showtime!', 'only a matter of time');
add(Dr, 'elliptical imperative — a nudge to the reader', 'logical thinking', 'logical thinking!',
  'critical thinking', 'worth remembering', 'worth remembering [soon]', 'worth tracking',
  'worth following', 'worth repeating', 'worth listening (reading)', 'your move',
  "counter-argument: do not make statements based on assumption of 'worth' and/or 'value'");

// — Statement/Fragment bucket: refrains, codes, entities, splits —
add(Th, 'recurring movement refrain', 'we, the people', 'we, the people!', 'we, the people!',
  'we the people', 'we fight', 'we fight!', 'we fight together', 'we fight together.',
  'we stand', 'we stand together', 'we stand together as patriots', 'we stand together in this fight',
  'united we stand', 'united we stand!', 'united not divided', 'unity not division',
  'unity creates peace', 'united', 'strong together', 'patriots united', 'american patriots united',
  'patriots fight', 'patriots fight!', 'patriots one and all', 'patriots one & all!',
  'patriots together', 'patriots unite', 'for humanity', 'for humanity!', 'for god & country',
  'for [god & country]', 'for god and country, brother', 'for god & country (& world)',
  'truth to power', 'peace through strength', 'peace through strength.', 'feel proud', 'feel proud!',
  'we hear you', 'we hear you!', 'we hear all', 'we honor them', 'we love you!', 'hooah!',
  'vive la france!', 'freedom!', 'boom', 'boom!', 'boooom!', 'boooooooom!', 'boooooom!',
  'boom!!!!!', 'poof!', "it's time", 'game theory', 'game-theory', 'tick tock', 'dark to light',
  'dark > light', 'the great awakening', 'the great awakening!', 'great awakening', 'sheep no more',
  'sheep no more!', 'enemy of the people', 'fake news', 'witch hunt', 'maga',
  'making america great again!', 'america first', 'red wave', 'draining the swamp',
  'information warfare', 'information warfare.', '"information warfare."', 'insurgency',
  'irregular warfare', 'irregular warefare', 'infiltration not invasion',
  'infiltration instead of invasion', 'the silent war continues', 'panic', 'panic!', 'panic!!!',
  'pain', 'pain!', 'pain!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', 'pain & panic', 'justice', 'truth',
  'truth & honesty', 'truth to light', 'freedom', 'unity', 'courage', 'patience', 'light', 'love',
  'awakening', 'revolution', 'new world', 'facts matter', 'facts matter!', 'facts not fiction',
  'truth & facts matter', 'democracy matters', 'your voice matters', 'from sea to shining sea',
  'land of the free', 'home of the brave', 'a beacon of hope when flown', 'to free from oppression',
  'love of country', 'love of country!', 'love of country.', 'rip patriot!', 'strength and honor',
  'badge of honor', 'badge of honor!', 'eyes wide open', 'for freedom', 'for them!', 'together',
  'the fight to save the world', 'foreign & domestic patriots', 'vip patriots!', 'vip patriots',
  'we never left', 'we endure', 'we remember', 'here to stay', "'here to stay",
  'conspiracy no more', 'conspiracy no more!', 'good v evil', 'good vs evil', 'good v', 'darkness',
  'dark > light.', 'mental enslavement', 'the tell', 'trust the plan', 'the plan', "'the plan",
  'sheep', 'boomerang', 'boomerang suicide', 'game over', 'game over.', 'no more', 'no more!',
  'shadow game', 'army strong', 'we, thank you', 'much appreciation', 'morning, patriot',
  'we responded', 'we listened', 'we know', 'we know all', 'sea to shining sea',
  'welcome to the party', 'welcome to the real world', 'welcome to the wh', 'welcome aboard',
  'welcome mr', 'welcome aboard, judge k', 'welcome back huma', 'welcome to the awakening',
  'welcome to the revolution', 'welcome to the global war', 'welcome to the digital battlefield');
// (post-scoped split-word rulings live in OVP below)
add(En, 'entity/organization reference', 'blackwater usa', 'fusion gps', 'shareblue',
  "the 'standard' hotel", 'vatican bank', 'board of superintendence', 'mclean, virginia',
  'barcelona', 'hilton/roth', 'dopey', 'm-institute', 'operation merlin (tech)',
  'the daily "beast."', "the 'guardian'", 'renegade', 'ford', 'shadow presidency',
  'the shadow presidency', 'shadow government', 'the shadow government', 'shadow president',
  'f15', 'nightwatch', 'wargames', 'the sum of all fears', 'sum of all fears', 'house of cards',
  'msm', 'jfk con room', 'blackwater on guard', 'fake news media', '"fake news media."');
add(NC, 'single letter / truncated fragment — no honest category without the parent sentence',
  'a', 'l', 'm', 'n', 'j', 'or', 'but', 'then', 'etc', '(cont..)', 'old', 'meat', 'gen', 'sen',
  'rep', 'gov', 'mr', 'ms', '"ms', '"sec', '18 u.s', 'code \'?2385', 'michael s', 'lee s',
  'federal vs', 'usa vs', 'usa v', 'coincidence vs', 'whistleblower(s) vs', 'military law v',
  '40,000ft. v', '40,000ft', 'iden_reconf v', '& another prior to', 'upon entry',
  'recipe for', 'biden, ...."', '"after mr', 'a: no', 'august', 'days later', 'now', 'today',
  'yesterday', 'tuesday', 'tuesday (china)', 'monday.');
add(En, 'place reference (ATL airport)', 'concourse f', 'terminal 5');

// ---------- post-scoped overrides (post|key) ----------
const OVP = new Map();
const addP = (post, cat, note, ...words) => { for (const w of words) OVP.set(post + '|' + w, { cat, note }); };
addP('4255', Th, "split of 'WHERE WE GO ONE, WE GO ALL' — one word per line in the drop",
  'where', 'we', 'one', 'all', 'go');
addP('3220', Dr, "split of 'THINK FOR YOURSELF' — one word per line in the drop",
  'this', 'for', 'yourself');
addP('4683', Cl, "split of 'You. Have. More. Than. You. Know.' — recurring Q line",
  'you', 'have', 'more', 'than', 'know');
addP('4206', Th, "split of 'PANIC. IN. DC.'", 'panic', 'in', 'dc');

// ---------- family / pattern rules ----------
const SCRIPTURE = 'quoted Scripture — religion/spirituality theme, not Q-authored';
const FOUNDING = 'quoted founding/patriotic text — used thematically, not Q-authored';
const RULES = [
  { re: /for our struggle is not against flesh and blood/i, cat: Th, note: SCRIPTURE },
  { re: /^["'\s>]*(therefore put on the full armor|and pray in the spirit|in addition to all this, take up the shield|with this in mind, be alert|finally, be strong in the lord)/i, cat: Th, note: SCRIPTURE },
  { re: /^["'\s>]*(love is patient, love is kind|it does not envy|it is not rude|it always protects)/i, cat: Th, note: SCRIPTURE },
  { re: /(he makes me lie down in green pastures|he guides me along the right paths|you prepare a table before me|you anoint my head with oil)/i, cat: Th, note: SCRIPTURE },
  { re: /(thy kingdom come|thy will be done|hallowed be thy name|lead us not into temptation)/i, cat: Th, note: SCRIPTURE },
  { re: /(long train of abuses and usurpations|whenever any form of government becomes destructive|we hold these truths to be self-evident)/i, cat: Th, note: FOUNDING + ' (Declaration of Independence)' },
  { re: /tyranny, like hell, is not easily conquered/i, cat: Th, note: FOUNDING + ' (Thomas Paine)' },
  { re: /(freedom is never more than one generation away|pass it to our children in the bloodstream|we didn't pass it on to our children|last best hope of man on earth|thousand years of darkness)/i, cat: Th, note: FOUNDING + ' (Reagan speech)' },
  { re: /i pledge allegiance to the flag/i, cat: Th, note: FOUNDING + ' (Pledge of Allegiance)' },
  { re: /^god\s?bless|^god ?speed|^good speed|^may god/i, cat: Th, note: 'blessing — religion/spirituality theme' },
  { re: /^happy hunting/i, cat: Th, note: 'recurring sign-off' },
  { re: /^(thank you|thanks|thank q)/i, cat: Th, note: 'acknowledgment — movement/community language' },
  { re: /^(well done|good catch|nice catch|good job|great job|good luck|congrat|amen|roger that|goodnight|good night|sweet dreams|merry christmas|happy (sunday|friday|holidays|thanksgiving|easter|new year)|hello|hi,|adios|godspeed)/i, cat: Th, note: 'acknowledgment/valediction — movement/community language' },
  { re: /^welcome/i, cat: Th, note: 'greeting/valediction' },
  { re: /\bwwg1wga\b/i, cat: Th, note: 'WWG1WGA motto' },
];

// question detection (for rows not already ruled)
const qMark = (s) => /\?\s*["')\]]*\s*$/.test(s) || /\?/.test(s.slice(-3));
const qStart = /^[">\s'([]*(why|what|who|whom|whose|when was|when did|when do|where (is|was|are|were|did|do)|which|how (do|did|does|can|could|would|about|many|much)|do you|does|did (you|they|he|she|it)|is (it|this|that|he|she|there)|are (you|they|we|there)|was (it|this|that|he|she|there)|were (you|they)|can (you|we|they|it)|could|would|should|shall we|have you|has (he|she|it|anyone)|don'?t you|isn'?t|aren'?t|wasn'?t|will (you|they|the|it))\b/i;

// ---------- classify ----------
const rows = parseCSV(fs.readFileSync(SRC, 'utf8'));
const out = [];
const counts = {}; const disagreeCounts = {};
const gptDefault = {
  'Question': Qn, 'Directive': Dr, 'Claim': Cl, 'Prediction': Pr, 'Named Entity': En,
  'Blessing / Prayer': Th, 'Religious / Spiritual Theme': Th, 'Slogan / Heading / Label': Th,
  'Acknowledgment / Valediction': Th, 'Statement / Fragment': Cl, 'Needs Context': NC,
  'Merged into prior sentence': Th,
};
const gptToApp = { 'Question': Qn, 'Directive': Dr, 'Claim': Cl, 'Prediction': Pr, 'Named Entity': En };

const ABBR_SPLIT = /\b(mr|mrs|ms|dr|jr|sr|sen|gen|lt|gov|rep|st|u\.s|h|n|v|vs|b)\.$/i;

for (const [post, sentRaw, gptCat] of rows) {
  const sent = norm(sentRaw);
  const k = key(sentRaw);
  let cat = null, note = '', conf = 'high';

  const ov = OVP.get(post + '|' + k) || OV.get(k);
  if (ov) { cat = ov.cat; note = ov.note; }

  if (!cat) {
    for (const r of RULES) if (r.re.test(sent)) { cat = r.cat; note = r.note; break; }
  }
  if (!cat && qMark(sent)) { cat = Qn; note = 'ends with "?"'; }
  if (!cat && qStart.test(sent) && gptCat !== 'Claim' && gptCat !== 'Statement / Fragment') {
    // interrogative opener outside claim buckets
    cat = Qn; note = 'question form despite punctuation';
  }
  if (!cat) {
    // certified-layer lookups for short rows
    const words = k.split(' ').length;
    if (words <= 6) {
      if (entitySet.has(k)) { cat = En; note = 'matches certified entity'; }
      else if (codeSet.has(k)) { cat = Br; note = 'matches certified code'; }
      else if (/^\[+[^\]]+\]+$/.test(k)) { cat = Br; note = 'bare bracketed token'; }
    }
  }
  if (!cat) {
    cat = gptDefault[gptCat] ?? Cl;
    if (gptCat === 'Statement / Fragment') {
      conf = 'low';
      note = 'fragment read as an assertion in context';
    }
    if (gptCat === 'Acknowledgment / Valediction') note = 'acknowledgment/valediction — no dedicated category; themes is nearest';
    if (gptCat === 'Slogan / Heading / Label') note = 'slogan/heading — thematic language';
    if (gptCat === 'Blessing / Prayer') note = 'blessing — religion/spirituality theme';
    if (gptCat === 'Religious / Spiritual Theme') note = 'religion/spirituality theme';
    if (gptCat === 'Merged into prior sentence') note = "part of 'Good v. Evil.' — good-v-evil theme";
  }
  // question-form flag inside claims (only where the opener really is interrogative AND short-tail split)
  if (cat === Cl && qStart.test(sent) && /^(why|who|what|how)$/i.test((sent.match(/[A-Za-z']+/) || [''])[0]) && !/^[">\s'([]*what an? /i.test(sent)) {
    // conservative: only flag, do not move (exact known ones were moved via overrides)
    note = (note ? note + '; ' : '') + 'check: interrogative opener — may be a question';
    conf = 'low';
  }
  if (ABBR_SPLIT.test(sent) && sent.length < 90) {
    note = (note ? note + '; ' : '') + 'split-sentence fragment (period after abbreviation broke the sentence)';
    if (conf === 'high') conf = 'low';
  }

  const mapped = gptToApp[gptCat] ?? gptDefault[gptCat] ?? '';
  const agrees = (cat === mapped) ? 'YES' : 'NO';
  counts[cat] = (counts[cat] || 0) + 1;
  if (agrees === 'NO') disagreeCounts[gptCat + ' -> ' + cat] = (disagreeCounts[gptCat + ' -> ' + cat] || 0) + 1;
  out.push({ post, sentence: sentRaw, gpt: gptCat, claude: cat, agrees, confidence: conf, note });
}

// ---------- write ----------
const esc = (s) => /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
const header = 'Post,Sentence,GPT Category,Claude Category,Matches GPT,Confidence,Note';
const csv = [header, ...out.map(r => [r.post, r.sentence, r.gpt, r.claude, r.agrees, r.confidence, r.note].map(esc).join(','))].join('\r\n');
fs.writeFileSync('Q Unhighlighted - Claude Review.csv', '\uFEFF' + csv, 'utf8');
fs.writeFileSync('C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Q Unhighlighted - Claude Review.csv', '\uFEFF' + csv, 'utf8');
const dis = [header, ...out.filter(r => r.agrees === 'NO').map(r => [r.post, r.sentence, r.gpt, r.claude, r.agrees, r.confidence, r.note].map(esc).join(','))].join('\r\n');
fs.writeFileSync('Q Unhighlighted - Disagreements.csv', '\uFEFF' + dis, 'utf8');
fs.writeFileSync('C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/Q Unhighlighted - Disagreements.csv', '\uFEFF' + dis, 'utf8');

console.log('rows:', out.length);
console.log('category totals:', counts);
console.log('changes (GPT -> Claude):');
for (const [kk, v] of Object.entries(disagreeCounts).sort((a, b) => b[1] - a[1])) console.log(' ', kk, v);
console.log('low-confidence rows:', out.filter(r => r.confidence === 'low').length);
