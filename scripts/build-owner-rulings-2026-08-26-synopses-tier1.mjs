// THE OWNER'S RULING OF 2026-08-26 (tier 1, part B): real synopses for the archive's 72
// highest-mention entities (>=20 mentions) not already covered by the #1515 batch or tier 1a's
// archive-specific terms. Researched via 4 parallel web-search agents.
//
//   "yes i want it uniform across the app so i want to get rid of the genaric synopsis and give
//    the detail we did"
//
//   node scripts/build-owner-rulings-2026-08-26-synopses-tier1.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entity-synopsis-owner-rulings.json')
const dry = process.argv.includes('--dry')

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byId = new Map(entities.map(e => [e.id, e]))

const RULED_ON = '2026-08-26'
const PROVENANCE = 'Owner ruling: "yes i want it uniform across the app so i want to get rid of the genaric synopsis and give the detail we did." Researched via web search (tier 1: mentions >= 20).'

const RAW = [
  // Batch A
  ['qe-e4b9b2985b7c', 'The United States is a federal republic of 50 states in North America and the world\'s largest economy, exercising global military and diplomatic influence through institutions like the presidency, Congress, and the federal court system.'],
  ['qe-f918f4a7fbe4', 'POTUS is the standard abbreviation for "President of the United States," the head of state and head of government of the U.S. and commander-in-chief of its armed forces, elected to a four-year term.'],
  ['qe-27e676aae866', 'The Democratic Party is one of the two major political parties in the United States, generally associated with liberal and progressive policy positions, that has held the presidency and majorities in Congress at various points in U.S. history.'],
  ['qe-e39142bdc502', 'The Federal Bureau of Investigation (FBI) is the United States\' principal federal law enforcement and domestic intelligence agency, operating under the Department of Justice to investigate federal crimes and threats to national security.'],
  ['qe-ca3f699d20ac', 'Barack Obama is an American politician and attorney who served as the 44th President of the United States from 2009 to 2017, the first African American to hold the office.'],
  ['qe-cb07cff77084', 'Hillary Clinton is an American politician and attorney who served as U.S. Secretary of State (2009-2013), a U.S. Senator from New York, and First Lady, and was the Democratic Party\'s presidential nominee in 2016.'],
  ['qe-8206c14d727c', 'Rod Rosenstein was the U.S. Deputy Attorney General from 2017 to 2019, who appointed Robert Mueller as special counsel to lead the investigation into Russian interference in the 2016 election.'],
  ['qe-f1095d932a99', 'Russia is the world\'s largest country by land area, spanning Eastern Europe and northern Asia, and a nuclear-armed global power whose government under Vladimir Putin has been a major factor in U.S. foreign policy and intelligence matters.'],
  ['qe-a3bd83a14e22', 'The Department of Justice (DOJ) is the U.S. federal executive department responsible for enforcing federal law, headed by the Attorney General, and overseeing agencies including the FBI.'],
  ['qe-30f4e75293aa', 'Robert Mueller is an American lawyer who served as FBI Director from 2001 to 2013 and later served as special counsel from 2017 to 2019, leading the Department of Justice investigation into Russian interference in the 2016 U.S. election.'],
  ['qe-59d19d09a92e', 'Saudi Arabia is an absolute monarchy on the Arabian Peninsula and one of the world\'s largest oil producers, and a longstanding U.S. security and economic partner in the Middle East.'],
  ['qe-e7ce1dad3228', 'The FISA Court (formally the Foreign Intelligence Surveillance Court) is a specialized U.S. federal court, established in 1978, that reviews government applications for surveillance and search warrants in foreign intelligence investigations, typically in closed, classified proceedings.'],
  ['qe-3a4e3df6e631', 'The Central Intelligence Agency (CIA) is the U.S. federal agency responsible for gathering, analyzing, and acting on foreign intelligence and national security information, operating independently of the FBI\'s domestic law enforcement role.'],
  ['qe-9e93984165b1', 'The United States Senate is the upper chamber of the U.S. Congress, composed of 100 members (two per state), with powers including confirming presidential appointments, ratifying treaties, and trying impeachments.'],
  ['qe-2930bf2822b7', 'China is the world\'s most populous country and a major global economic and military power, governed as a one-party state by the Chinese Communist Party, and a central subject of U.S. trade, security, and diplomatic policy.'],
  ['qe-f932f71142c9', 'The White House is the official residence and workplace of the President of the United States, located in Washington, D.C., and a common shorthand for the presidency and its executive staff.'],
  ['qe-f4dabfcc4006', 'Washington, D.C. is the capital city of the United States, seat of the federal government, and home to the White House, Congress, and the Supreme Court.'],
  ['qe-b4af4d0b0bbd', 'Jeff Sessions is an American politician and attorney who served as a U.S. Senator from Alabama and as U.S. Attorney General from 2017 to 2018, recusing himself from the Russia investigation due to his role in the Trump campaign.'],
  // Batch B
  ['qe-5307e91b2681', 'John Huber is the former U.S. Attorney for Utah whom Attorney General Jeff Sessions assigned in 2017 to review the FBI and DOJ\'s handling of the Clinton Foundation inquiry and the FISA warrant process; the review closed in early 2020 without producing charges.'],
  ['qe-60b5212c9376', 'Twitter was a social media platform for short public posts, founded in 2006, that Elon Musk acquired in 2022 and rebranded as X the following year.'],
  ['qe-8c2a4a24bf3c', 'The National Security Agency is a U.S. Department of Defense intelligence agency responsible for signals intelligence collection and cryptologic operations, including foreign communications interception and cybersecurity.'],
  ['qe-374b8e34afd1', 'North Korea is an East Asian nation ruled since its 1948 founding by the Kim family under a one-party communist system, known internationally for its nuclear weapons program and diplomatic isolation.'],
  ['qe-23b3f3882ba3', 'Iran is a Middle Eastern country governed since its 1979 Islamic Revolution as a theocratic republic under a Supreme Leader, and has long been a focus of U.S. sanctions and nuclear-proliferation diplomacy.'],
  ['qe-39ac279949d9', 'The Republican Party is one of the two major political parties in the United States, generally associated with conservative policy positions, founded in 1854.'],
  ['qe-3b4c46b9f74d', 'James Comey was director of the FBI from 2013 until President Trump fired him in May 2017, a dismissal that led to the appointment of Special Counsel Robert Mueller.'],
  ['qe-82b9af384407', 'Facebook is a social networking platform launched by Mark Zuckerberg in 2004 that is now operated by parent company Meta Platforms.'],
  ['qe-190d29e92cd1', 'Edward Snowden is a former NSA contractor who in 2013 leaked classified documents revealing the scope of U.S. government mass surveillance programs, after which he fled the U.S. and was granted asylum in Russia.'],
  ['qe-09f72af3159d', 'The United Kingdom is a sovereign country in northwestern Europe comprising England, Scotland, Wales, and Northern Ireland, and one of the United States\' closest intelligence and diplomatic allies.'],
  ['qe-253d3de45502', 'The Securities and Exchange Commission is the U.S. federal agency responsible for regulating securities markets, enforcing securities laws, and protecting investors.'],
  ['qe-781474651855', 'Donald Trump is an American businessman and politician who served as the 45th U.S. president from 2017 to 2021 and was elected to a second, non-consecutive term as the 47th president.'],
  ['qe-b80ea6d8ed16', 'Joe Biden is an American politician who served as vice president under Barack Obama from 2009 to 2017 and as the 46th president of the United States from 2021 to 2025.'],
  ['qe-50a7ff9629dd', 'The Clinton Foundation is a charitable organization established by Bill Clinton in 1997 that funds global health, economic development, and other philanthropic programs.'],
  ['qe-40fbc6a6e6a7', 'California is the most populous U.S. state, located on the Pacific coast, home to Silicon Valley\'s technology industry and Hollywood\'s entertainment industry.'],
  ['qe-9218c9c91be5', 'COVID-19 is the infectious respiratory disease caused by the SARS-CoV-2 virus, first identified in Wuhan, China, in late 2019, which spread globally and was declared a pandemic by the World Health Organization in March 2020.'],
  ['qe-838607b59e0a', 'William Barr served as U.S. Attorney General from February 2019 to December 2020 under President Trump, and had previously held the same post under President George H.W. Bush from 1991 to 1993.'],
  ['qe-4938fd5a6aa1', 'The Special Counsel investigation was a Justice Department inquiry led by former FBI Director Robert Mueller from 2017 to 2019 into Russian interference in the 2016 U.S. election and related matters, which resulted in numerous indictments but no criminal charges against Trump himself.'],
  // Batch C
  ['qe-99b2829ea340', 'George Soros is a Hungarian-American billionaire investor and philanthropist who built his fortune in hedge-fund management and founded the Open Society Foundations, which funds pro-democracy, human-rights, and progressive causes worldwide.'],
  ['qe-e6feac51369e', 'The Supreme Court is the highest federal court in the United States, with final authority to interpret the U.S. Constitution and federal law and to review decisions of lower courts.'],
  ['qe-3ddd7cab456e', 'Adam Schiff is an American Democratic politician who represented California in the U.S. House of Representatives for over two decades, chairing the House Intelligence Committee, before being elected to the U.S. Senate in 2024.'],
  ['qe-dbbf1d039297', 'Nancy Pelosi is an American Democratic politician from California who served as Speaker of the U.S. House of Representatives (2007-2011 and 2019-2023), the first woman to hold that position.'],
  ['qe-2417a9a7706e', 'The United States Congress is the bicameral national legislature of the United States, composed of the Senate and the House of Representatives, responsible for writing federal law.'],
  ['qe-08c421d8f81b', 'The Democratic National Committee is the formal governing body of the U.S. Democratic Party, responsible for coordinating national campaign strategy, fundraising, and organizing the party\'s presidential nominating convention.'],
  ['qe-bfee4149db99', 'Loretta Lynch is an American attorney who served as U.S. Attorney General from 2015 to 2017 under President Barack Obama, the first Black woman to hold that office.'],
  ['qe-73ee55145bd3', 'Huma Abedin is an American political aide who served as deputy chief of staff to Hillary Clinton at the U.S. State Department and as a longtime senior advisor throughout Clinton\'s political career.'],
  ['qe-474a80e57429', 'The European Union is a political and economic union of 27 member states, primarily in Europe, that operates through shared institutions and a common set of laws governing trade, travel, and other policy areas among members.'],
  ['qe-4ead3b5cebe9', 'Antifa is a decentralized, loosely organized political movement made up of autonomous groups and individuals who oppose fascism and far-right extremism, sometimes through direct-action protest tactics, rather than a formal or unified organization.'],
  ['qe-0e4a61226ee3', 'Uranium One was a Canadian-based uranium mining company whose 2010 sale, approved by a U.S. interagency review committee, gave Russia\'s state nuclear agency Rosatom majority ownership and control of a share of American uranium extraction capacity.'],
  ['qe-22cd36d3d850', 'The United States Secret Service is a federal law enforcement agency, part of the Department of Homeland Security, responsible for protecting current and former national leaders and investigating financial and cyber crimes.'],
  ['qe-f55feaee1a46', 'Michael Flynn is a retired U.S. Army lieutenant general who directed the Defense Intelligence Agency from 2012 to 2014 and briefly served as National Security Advisor under President Trump in early 2017 before resigning.'],
  ['qe-f927052c1e12', 'Bill Clinton is an American politician who served as the 42nd President of the United States from 1993 to 2001, after previously serving as Governor of Arkansas.'],
  ['qe-a273cc0d54f7', 'Bruce Ohr is a career U.S. Department of Justice attorney who headed its Organized Crime and Racketeering Section and later served as an Associate Deputy Attorney General, a senior post he was demoted from in 2017.'],
  ['qe-c9af2e3ab31e', 'Ukraine is a country in Eastern Europe bordering Russia, Belarus, and Poland among others, and a former Soviet republic that regained independence in 1991.'],
  ['qe-c2efbbd275fc', 'Australia is a country occupying the Australian continent along with the island of Tasmania and numerous smaller islands, and a member of the Commonwealth of Nations.'],
  ['qe-e15775752e6e', 'John Brennan is an American intelligence official who served as Director of the Central Intelligence Agency from 2013 to 2017 under President Barack Obama.'],
  // Batch D
  ['qe-dd22a6644c88', 'The House, formally the United States House of Representatives, is the lower chamber of the U.S. Congress, whose members are elected from congressional districts to represent the population of each state.'],
  ['qe-4ac310ee36a2', 'Five Eyes is an intelligence-sharing alliance among the United States, United Kingdom, Canada, Australia, and New Zealand, formed around a shared signals-intelligence agreement dating to the mid-20th century.'],
  ['qe-5d44c220df65', 'John McCain was a U.S. Senator from Arizona and Republican Party presidential nominee in 2008, and a former Navy pilot who was held as a prisoner of war during the Vietnam War.'],
  ['qe-ce9b4b609ab5', 'New York refers to the U.S. state in the northeastern United States or, in narrower usage, to New York City, the state\'s largest city and the most populous city in the country.'],
  ['qe-32f8adee9548', 'ISIS, also known as the Islamic State, is a militant Islamist group and former self-declared caliphate that seized and held territory across parts of Iraq and Syria before losing most of its territorial control.'],
  ['qe-f340ce9f7070', 'Military Intelligence is a general term for the intelligence-gathering and analysis components within the U.S. armed forces, including branch-level units such as the Army\'s Military Intelligence Corps and defense-wide bodies such as the Defense Intelligence Agency.'],
  ['qe-d9d07dd12ec3', 'The United States Military is the armed forces of the United States, comprising the Army, Navy, Air Force, Marine Corps, Space Force, and Coast Guard under the authority of the Department of Defense (and Department of Homeland Security for the Coast Guard).'],
  ['qe-1f02f604ec23', 'Jeffrey Epstein was an American financier who was convicted in 2008 of soliciting prostitution from a minor and was later federally indicted on sex-trafficking charges involving multiple underage girls before he died by suicide in jail in 2019.'],
  ['qe-72c96d957a8a', 'Black Lives Matter is a decentralized political and social movement, originating in the United States in 2013, that campaigns against violence and systemic racism directed at Black people.'],
  ['qe-d545e231cd32', 'Andrew McCabe is a former FBI official who served as Deputy Director of the FBI and briefly as acting director in 2017 before being fired in 2018.'],
  ['qe-89ec708993ff', 'John Durham is a federal prosecutor who served as U.S. Attorney for the District of Connecticut and was appointed by the Justice Department to lead an investigation into the origins of the FBI\'s Russia probe of the 2016 Trump campaign.'],
  ['qe-ee9037e0a937', 'CNN, short for Cable News Network, is an American cable and digital news outlet that broadcasts national and international news coverage around the clock.'],
  ['qe-9699caced7cc', 'The Muslim Brotherhood is a transnational Sunni Islamist organization founded in Egypt in 1928 that has operated as a religious, social, and political movement across the Middle East and beyond.'],
  ['qe-8233a383ef14', 'The New York Times is an American daily newspaper based in New York City, widely regarded as one of the country\'s newspapers of record.'],
  ['qe-0d652fbf34ee', 'A Grand Jury is a body of citizens in the U.S. legal system, convened by a prosecutor, that reviews evidence presented to it to decide whether there is sufficient cause to formally charge someone with a crime.'],
  ['qe-ca21097a3dd5', 'DARPA, the Defense Advanced Research Projects Agency, is a U.S. Department of Defense agency responsible for funding and developing emerging technologies for military use.'],
  ['qe-462c7edc86af', 'Rachel Chandler is an American fashion photographer and co-founder of the Midland modeling and casting agency, known for casting work in the fashion industry.'],
  ['qe-45881247e81b', 'Jack Dorsey is an American entrepreneur who co-founded and served as CEO of Twitter, and who separately founded the payments company Square, later renamed Block.'],
]

const problems = []
const synopses = []
for (const [entityId, synopsis] of RAW) {
  const e = byId.get(entityId)
  if (!e) { problems.push(`${entityId}: not a live entity`); continue }
  const firstWord = e.canonical.split(' ')[0]
  if (!synopsis.includes(firstWord)) problems.push(`${entityId} (${e.canonical}): synopsis does not contain "${firstWord}"`)
  synopses.push({ entityId, canonical: e.canonical, ruledOn: RULED_ON, provenance: PROVENANCE, synopsis })
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))
doc.synopses ??= []
const already = new Set(doc.synopses.map(s => s.entityId))

console.log(`\nOWNER SYNOPSIS RULING — 2026-08-26, tier 1 (mentions >= 20)\n`)
let added = 0, skipped = 0
for (const s of synopses) {
  if (already.has(s.entityId)) { skipped++; continue }
  console.log(`  ${s.canonical}`)
  doc.synopses.push(s)
  already.add(s.entityId)
  added++
}
console.log(`\n  ${added} new, ${skipped} already recorded (input ${synopses.length})\n`)

if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added) { console.log('  nothing to write\n'); process.exit(0) }
fs.writeFileSync(RULINGS_FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, RULINGS_FILE)}\n`)
