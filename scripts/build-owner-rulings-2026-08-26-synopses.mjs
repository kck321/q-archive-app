// THE OWNER'S RULING OF 2026-08-26: real synopses for #1515's reporters, their outlets, and
// WikiLeaks — replacing the generic boilerplate with who these people/organizations actually are.
//
//   "lets put a synopsis or an explanation for any entity that doesn't for example wikileaks. we
//    obviously know what this is but a site user may not know lets fix this. i also. also pic 2 i
//    see all these reporters don't have a synopsis or explanation of who they are... lets search
//    the internet to give some insight on who the entities are so the user can be quickly
//    educated on the term or phrase they are hovering over."
//
// Researched via parallel web-search agents (one per batch of ~18 reporters, one for the media
// outlets). Every synopsis states outlet + role/beat, factually and neutrally, and does not
// mention WikiLeaks, the DNC, Hillary Clinton, or the "collusion" framing of the post they sit
// on — that context belongs to the post, not to the person's identity. Several of Q's own
// spellings are typos of the real journalist's name (Ryan Liza -> Ryan Lizza, George
// Stephanoplous -> George Stephanopoulos, etc.) — the CANONICAL field here is always read fresh
// from entities.json (never hand-typed), so a ruling can never accidentally rename a live entity;
// the synopsis text itself uses the correct real name since that is what actually educates a
// reader, exactly as Nellie Ohr's synopsis already does for a similarly garbled Q spelling.
//
//   node scripts/build-owner-rulings-2026-08-26-synopses.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULINGS_FILE = path.join(ROOT, 'audit/entity-synopsis-owner-rulings.json')
const dry = process.argv.includes('--dry')

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const byId = new Map(entities.map(e => [e.id, e]))

const RULED_ON = '2026-08-26'
const PROVENANCE = 'Owner ruling: "for any entity that doesn\'t [have a synopsis], for example wikileaks... also all these reporters don\'t have a synopsis... lets search the internet." Researched via web search.'

// [entityId, synopsis] — synopsis text as researched; canonical/provenance are filled from the
// live entity record below, never hand-typed.
const RAW = [
  // Batch 1
  ['qe-0262c2ecc2d9', 'Vicki Gordon is a longtime CBS News producer who worked as a senior producer and executive story editor on 60 Minutes.'],
  ['qe-088d9c5f3090', 'Rachel Racusen is a communications executive who served as a senior Obama administration and 2012 campaign spokesperson before holding communications leadership roles at MSNBC and the news startup Semafor.'],
  ['qe-0aff05df6680', 'Laura Meckler is a Washington Post journalist covering national education policy, who previously reported on the White House and politics for the Wall Street Journal and on health and social policy for the Associated Press.'],
  ['qe-121902823e6e', 'Geofe Earl — better known as Geoff Earle — is a Washington-based political journalist who served as the New York Post\'s Washington bureau chief for over a decade before moving to the Daily Mail.'],
  ['qe-136d33e33cea', 'Mark Murray is a political journalist who spent many years as NBC News\'s senior political editor, writing and editing the network\'s First Read political briefing.'],
  ['qe-17fc82255128', 'Alyssa Mastromonaco is a former White House deputy chief of staff for operations under President Obama who later held media and communications executive roles at Vice Media and A&E Networks.'],
  ['qe-18107b67fc6d', 'Peter Nicholas is a political journalist who covered the White House for the Wall Street Journal and later reported for The Atlantic and NBC News.'],
  ['qe-18a6c733af04', 'John Heilemann is a political journalist and analyst for NBC News and MSNBC, co-author of the bestselling campaign books Game Change and Double Down, and host of Showtime\'s The Circus.'],
  ['qe-1b22567b6fd1', 'Mike Feldman is a Democratic communications strategist who served as a senior advisor and traveling chief of staff to Vice President Al Gore before co-founding the consulting firm Glover Park Group.'],
  ['qe-20528df2a55a', 'Jon Karl is ABC News\'s chief Washington correspondent and co-anchor of This Week with George Stephanopoulos, having covered the White House and Washington politics since the 1990s.'],
  ['qe-205eab44f34d', 'John Dickerson is a veteran journalist known for hosting CBS\'s Face the Nation and later co-anchoring the CBS Evening News, as well as co-hosting Slate\'s Political Gabfest podcast.'],
  ['qe-2404e095b5d2', 'Mika Brzezinski is a broadcast journalist who has co-hosted the morning program Morning Joe alongside Joe Scarborough on MSNBC since 2007.'],
  ['qe-2466b4af6c00', 'Amanda Terkel is a political journalist who served as HuffPost\'s Washington bureau chief and editorial director for over a decade before joining NBC News as a senior politics editor.'],
  ['qe-2de11fafa366', 'Julie Pace is a journalist who covered the White House for the Associated Press before becoming the AP\'s executive editor and senior vice president.'],
  ['qe-30fdc4d56467', 'Ruby Cramer is a political journalist who covered presidential campaigns for BuzzFeed News before later writing for Politico Magazine and The Washington Post.'],
  ['qe-326da877aa4d', 'Alex Seitz-Wald is a political journalist who spent about a decade as a senior national politics reporter for NBC News, covering national campaigns, before joining a Maine local newspaper as deputy editor.'],
  ['qe-34792e9e3388', 'Maggie Haberman is a Pulitzer Prize-winning New York Times senior political correspondent and chief White House correspondent, and a CNN political analyst.'],
  ['qe-36bacd26fde5', 'Kate Bolduan is a CNN anchor who co-hosts the network\'s CNN News Central and the daily briefing 5 Things with Kate Bolduan.'],
  // Batch 2
  ['qe-3a4680ff5ce9', 'Diane Sawyer is a longtime ABC News anchor who co-anchored Good Morning America and later anchored World News with Diane Sawyer, after an earlier career at CBS News that included being the first woman correspondent on 60 Minutes.'],
  ['qe-467076948eb8', 'Sam Feist is a media executive who served as CNN\'s Washington bureau chief and senior vice president, overseeing shows like The Situation Room and The Lead, before becoming CEO of C-SPAN in 2024.'],
  ['qe-471d18693bdb', 'Ryan Lizza is a political journalist who served as The New Yorker\'s Washington correspondent and Politico\'s chief Washington correspondent, and later worked as a senior political analyst for CNN.'],
  ['qe-47cafe71e0fe', 'Erin Burnett is a CNN anchor who hosts the nightly program Erin Burnett OutFront and serves as the network\'s chief business and economics correspondent.'],
  ['qe-4852b04127e4', 'Gail Collins is a longtime New York Times op-ed columnist who previously served as the paper\'s editorial page editor, the first woman to hold that post.'],
  ['qe-49f918c2b2f5', 'John Berman is a CNN anchor who co-anchors CNN News Central, having joined the network in 2012 after nearly 17 years as a correspondent for ABC News.'],
  ['qe-4c94a6a06428', 'Maria Cardona is a Democratic political strategist and a CNN and CNN en Espanol political commentator who previously served as communications director for the Democratic National Committee.'],
  ['qe-4ce4e0e569d4', 'Thomas Roberts is a television journalist who anchored MSNBC Live for seven years and worked as an NBC News correspondent and fill-in anchor for Today and NBC Nightly News.'],
  ['qe-5583bba9d661', 'Jonathan Martin is Politico\'s politics bureau chief and senior political columnist, and a CNN political analyst, having previously served as senior political correspondent for The New York Times.'],
  ['qe-5a040717aa5b', 'Colleen McCain Nelson is a journalist who covered the White House for The Wall Street Journal and won the Pulitzer Prize for editorial writing while at The Dallas Morning News.'],
  ['qe-5ff5bfe12a7c', 'Alex Wagner is a journalist and MSNBC host, currently anchoring Alex Wagner Tonight, who previously hosted NOW with Alex Wagner on MSNBC and co-anchored CBS This Morning: Saturday.'],
  ['qe-604f2d211040', 'Brianna Keilar is a CNN anchor who co-anchors CNN News Central, having previously served as CNN\'s senior Washington correspondent.'],
  ['qe-6268825e021e', 'Emily Schultheis is a journalist who covered U.S. national politics and elections for Politico, National Journal, and CBS News in the mid-2010s, and has since reported on European politics for Politico Europe.'],
  ['qe-6964e18829c9', 'Gloria Borger is CNN\'s chief political analyst, who previously worked as CBS News\' national political correspondent and as a political columnist for U.S. News & World Report.'],
  ['qe-699fa59a120b', 'Charlie Rose is a television journalist who hosted the interview program Charlie Rose on PBS from 1991 to 2017 and co-anchored CBS This Morning.'],
  ['qe-6e107898fd4b', 'Ben Smith is a journalist and co-founder and editor-in-chief of the news site Semafor, having previously served as editor-in-chief of BuzzFeed News from 2011 to 2020.'],
  ['qe-6f49ef92ebb1', 'Mike Oreskes is a journalist and editor who served as NPR\'s senior vice president of news and editorial director, after earlier roles as Associated Press senior managing editor and Washington bureau chief of The New York Times.'],
  ['qe-75be73c02fe0', 'Sam Stein is a journalist who was HuffPost\'s founding Washington reporter and later its senior politics editor, and who now serves as Politico\'s deputy managing editor for politics and an MSNBC contributor.'],
  // Batch 3
  ['qe-762d4ad77746', 'Gayle King is a CBS News broadcast journalist and co-host of the network\'s morning program (CBS This Morning, later CBS Mornings), and also serves as editor-at-large of Oprah Daily.'],
  ['qe-76844c860b54', 'Kenneth Vogel is a reporter who covers money in politics and lobbying, having served as Politico\'s founding chief investigative reporter before joining The New York Times\' Washington bureau in 2017.'],
  ['qe-769e5ec6769b', 'Anne Gearan is a Washington Post journalist who covered the White House, State Department and national security, joining the paper in 2012 after a career at the Associated Press that included serving as chief diplomatic correspondent.'],
  ['qe-772c7e4dca65', 'Carolyn Ryan is a New York Times editor who has held roles including national politics editor and metro editor at the paper, and became one of its managing editors in 2022.'],
  ['qe-78e0639a31ff', 'Steve Chaggaris is a journalist who spent nearly two decades at CBS News, rising to political director in 2017, and later worked as Al Jazeera Digital\'s politics editor and as Washington bureau chief for Sinclair.'],
  ['qe-7a2c2c55fc1a', 'David Chalian is CNN\'s political director, later promoted to senior vice president and Washington bureau chief, overseeing the network\'s political coverage, polling and decision-desk operations since joining in 2013.'],
  ['qe-7bb3ed56a0b3', 'Mike Memoli is an NBC News journalist who has covered national politics and the White House, including extensive coverage of Joe Biden, after earlier reporting stints with RealClearPolitics and Tribune Media\'s Washington bureau.'],
  ['qe-7fdfa9aff195', 'Betsy Fischer Martin is a television news executive who spent 23 years at NBC News, including 11 years as executive producer of Meet the Press, before becoming managing editor of NBC News political programming.'],
  ['qe-81c70fd3e376', 'Rachel Maddow is an MSNBC host and political commentator who has anchored The Rachel Maddow Show since its 2008 launch.'],
  ['qe-88238dc0104e', 'Jon Allen is a political journalist who served as Vox\'s chief political correspondent in 2016 and later as a senior political analyst for NBC News, and co-authored the book Shattered: Inside Hillary Clinton\'s Doomed Campaign with Amie Parnes.'],
  ['qe-8a164b379dfe', 'Joe Scarborough is a former Republican congressman from Florida who has co-hosted MSNBC\'s Morning Joe with Mika Brzezinski since 2007.'],
  ['qe-8a8a2f9e3b5f', 'Jackie Kucinich is a journalist who has covered Washington politics for outlets including USA Today, Roll Call, The Washington Post and The Daily Beast, later becoming Washington bureau chief for The Boston Globe.'],
  ['qe-8b7ce2aa27ac', 'Andrea Mitchell is NBC News\' chief Washington correspondent and chief foreign affairs correspondent, having covered every U.S. presidential campaign for the network since 1980.'],
  ['qe-8c23d918b7ac', 'Tina Brown is a magazine editor and writer who led Tatler, Vanity Fair and The New Yorker before founding The Daily Beast in 2008, later also serving as editor-in-chief of Newsweek.'],
  ['qe-8db42a2f97d0', 'April Ryan is a veteran White House correspondent who covered the White House for American Urban Radio Networks from the Clinton era through 2020, later joining CNN and then theGrio as a White House correspondent.'],
  ['qe-918f540905de', 'Jennifer Epstein is a Bloomberg News reporter who covered the White House and national politics after joining Bloomberg from Politico in 2015, spending about a decade with the outlet.'],
  ['qe-97ad895aa3ca', 'Greg Sargent is a political columnist who wrote the Washington Post\'s Plum Line blog from 2010 to 2024 before becoming a staff writer at The New Republic.'],
  ['qe-98d61d2dce95', 'John Harwood is a political journalist who served as CNBC\'s chief Washington correspondent and wrote the "Political Memo" column for The New York Times, after earlier covering politics for The Wall Street Journal.'],
  // Batch 4
  ["qe-9b6c1fd9bc4e", "Norah O'Donnell is a CBS News journalist who anchored the CBS Evening News from 2019 to 2025 and previously served as the network's chief White House correspondent and co-anchor of CBS This Morning."],
  ['qe-9db5883ec684', 'Phil Griffin was president of MSNBC from 2008 to 2021, having joined the network at its 1996 launch and overseen the debuts of shows like Morning Joe and The Rachel Maddow Show.'],
  ['qe-9f1193aade70', 'Savannah Guthrie is a co-anchor of NBC\'s Today show, a position she has held since 2012, and also serves as NBC News\' chief legal correspondent.'],
  ['qe-a2cd94cbb82e', 'Jeff Zucker was president of CNN Worldwide from 2013 until his resignation in 2022, and previously served as president and CEO of NBCUniversal.'],
  ['qe-a65487d04890', 'Dan Merica is a political reporter who covered Hillary Clinton\'s 2016 presidential campaign and later the White House for CNN, before moving to The Washington Post.'],
  ['qe-ac98a5c779d1', 'Amy Chozik is a journalist and author who served as a national political reporter for The New York Times covering Hillary Clinton\'s 2016 presidential campaign, later writing the memoir Chasing Hillary.'],
  ['qe-ad25e7885cc8', 'Liz Kreutz is a national correspondent for NBC News who, while at ABC News, was the network\'s embedded political reporter covering Hillary Clinton\'s 2016 presidential campaign.'],
  ['qe-b5b833db00d8', 'The "Evan Handler" listed here is recorded in press contacts as a Los Angeles Times reporter or contact from the mid-2010s — not the actor of the same name — and no further biographical detail could be independently verified.'],
  ['qe-b947eb216f5e', 'Jonathan Alter is an author, columnist, and political analyst who spent 28 years at Newsweek as a senior editor and columnist and now writes for The Daily Beast and appears on NBC News and MSNBC.'],
  ['qe-ba1c6ef92eea', 'Arianna Huffington is the co-founder and former editor-in-chief of The Huffington Post, which she led from its 2005 launch until 2016, and is now founder and CEO of Thrive Global.'],
  ['qe-bd408e0c8642', 'Sandra Sobieraj Westfall is a journalist who covered the White House for the Associated Press before becoming Washington bureau chief and national political correspondent for People magazine.'],
  ['qe-be2d541fee10', 'Jeff Zeleny is CNN\'s chief national affairs correspondent, having previously served as the network\'s senior Washington and senior White House correspondent, and before that as national political correspondent for The New York Times.'],
  ['qe-c714045631fd', 'Whitney Snyder is a HuffPost journalist and editor who joined the outlet in 2008, oversaw its politics and breaking-news coverage, and became its editor-in-chief in 2025.'],
  ['qe-c84a4dc1cbd0', 'Anita Kumar is a journalist who covered the White House for McClatchy\'s newspaper chain before joining Politico in 2019 as a White House correspondent and associate editor.'],
  ['qe-c8fa0a1c60cb', 'Maria-Elena Salinas (also written Maria Elena Salinas) is a broadcast journalist who co-anchored Univision\'s Noticiero Univision for 36 years, becoming one of the most recognized Hispanic television news anchors in the United States.'],
  ['qe-cc9487841204', 'Amanda Becker is a journalist who covered national politics and Congress for Reuters starting in 2013 before becoming Washington correspondent for The 19th.'],
  ['qe-cccc95afbe20', 'David Remnick is a Pulitzer Prize-winning writer who has served as editor of The New Yorker since 1998.'],
  ['qe-cda801c70bcd', 'Amie Parnes is a political journalist and senior correspondent for The Hill who has co-authored best-selling books on Hillary Clinton\'s presidential campaigns with fellow reporter Jonathan Allen.'],
  // Batch 5
  ['qe-ce130e7572fe', 'George Stephanopoulos is the chief anchor of ABC News, co-anchoring Good Morning America and hosting the Sunday program This Week.'],
  ['qe-d030b96cb710', 'Matt Bai is a political journalist and author who served as chief political correspondent for the New York Times Magazine and national political columnist for Yahoo News before becoming a columnist for Rolling Stone.'],
  ['qe-d50d415fd127', 'David Muir is the anchor and managing editor of ABC\'s World News Tonight.'],
  ['qe-d6f510572d9e', 'Beth Fouhy is a senior politics editor at NBC News and MSNBC, previously a political reporter for the Associated Press.'],
  ['qe-dd9972e950e3', 'Ed Schultz was a broadcaster who hosted the political talk program The Ed Show on MSNBC before later hosting a show on RT America; he died in 2018.'],
  ['qe-de341ee7073e', 'Lisa Lerer is a national political correspondent for the New York Times, previously a national political writer for the Associated Press.'],
  ['qe-df17a9e55850', 'Ken Thomas is a national political and White House reporter for the Wall Street Journal who spent nearly two decades at the Associated Press covering national politics.'],
  ['qe-e009a8631960', 'Mike Allen is a co-founder of Axios who writes its Axios AM newsletter, having previously written Politico\'s Playbook.'],
  ['qe-e27af6a845d1', 'Patrick Healy is the deputy editor of Opinion at the New York Times, having previously worked there as a political reporter, culture editor, and politics editor.'],
  ['qe-e2e10c208707', 'Glenn Thrush is a New York Times reporter who has covered the White House and national politics, and later poverty and the social safety net.'],
  ['qe-e81d77390ac5', 'Chuck Todd is a political journalist who moderated NBC\'s Meet the Press from 2014 to 2023 and later served as the network\'s chief political analyst before departing NBC in 2025.'],
  ['qe-e87089f18254', 'Tamara Keith is a White House correspondent for NPR.'],
  ['qe-ec7eb3da0f00', 'Jake Tapper is a CNN anchor and chief Washington correspondent, hosting The Lead and State of the Union.'],
  ['qe-f2e77658de3a', 'Gabe Debenedetti (Gabriel Debenedetti) is a national correspondent at New York Magazine, previously a politics reporter for Politico and Reuters.'],
  ['qe-f4aa26f2c3a0', 'Annie Karni is a congressional correspondent for the New York Times, having previously covered the White House there and worked as a politics reporter at Politico.'],
  ['qe-f51df9d1e180', 'Mark Halperin is a political journalist who has covered U.S. elections for ABC News, Time, Bloomberg Politics and NBC News over several decades.'],
  ['qe-f78336075970', 'John Harwood is a political journalist who covered Washington for the Wall Street Journal, the New York Times and CNBC before serving as a CNN White House correspondent until 2022.'],
  ['qe-f9d8060e098c', 'Cecilia Vega is a journalist who spent 12 years at ABC News, including as chief White House correspondent, before joining CBS\'s 60 Minutes as a correspondent in 2023.'],
  ['qe-fb7aea8d1bc2', 'Mark Preston is a senior political analyst and executive editor of CNN Politics.'],
  // Outlets batch
  ['qe-c9f95ff52ca5', 'WikiLeaks is a nonprofit organization that publishes leaked and classified documents from anonymous sources, founded by Julian Assange in 2006.'],
  ['qe-07d56f0f5765', 'The Los Angeles Times, often abbreviated LAT, is a major daily newspaper based in Los Angeles and one of the largest metropolitan newspapers in the United States.'],
  ['qe-09b59345cc2a', 'National Journal is a Washington, D.C.-based media company, founded in 1969, that publishes journalism and analysis on U.S. politics, policy, and government for a professional audience.'],
  ['qe-2355b6b6c443', 'Buzzfeed (stylized BuzzFeed) is an American internet media company, founded in 2006, known for viral content and listicles as well as its former BuzzFeed News division.'],
  ['qe-25b87e8de5fb', 'Univision is an American Spanish-language media company operating a broadcast television network and news division that serves Hispanic audiences in the United States.'],
  ['qe-6b91c2e9c140', 'Vice (Vice Media) is an American digital media and broadcasting company, including its Vice News division, that covers youth culture, current events, and international affairs.'],
  ['qe-6cbd2d0bea8d', 'The Daily Beast is an American news and opinion website covering politics, media, and entertainment, launched in 2008.'],
  ['qe-74a000cad9fe', 'MORE was a women\'s lifestyle magazine published by Meredith Corporation and aimed at women over 40, in print from 1997 until it ceased publication in 2016.'],
  ['qe-8f32b60fbf7a', 'AURN (American Urban Radio Networks) is an African-American-owned radio network, formed in 1991, that distributes news, sports, and entertainment programming to Black-audience radio stations across the United States.'],
  ['qe-a56f76c6ac6a', 'HuffPost, originally The Huffington Post and often shortened to HuffPo, is an American online news and opinion website founded in 2005.'],
  ['qe-b3334eb51117', 'Vox is an American news and opinion website, part of Vox Media, known for explanatory journalism on politics, policy, and current events.'],
  ['qe-bc06cc9ddf5a', 'GPG (Global Strategy Group) is a Democratic-aligned public relations, polling, and communications consulting firm based in New York.'],
  ['qe-df8ff87a5e36', 'McClatchy was an American newspaper publishing company that owned dozens of daily newspapers across the United States, including the Miami Herald and Sacramento Bee, before filing for bankruptcy in 2020.'],
  ['qe-f8a7a33cc54c', 'The Hill is an American political news website based in Washington, D.C., covering Congress, the White House, and federal policy, founded in 1994.'],
  ['qe-f1d66b4e87bc', 'The Podesta Group was a Washington, D.C. lobbying and public affairs firm founded in 1988 by brothers Tony and John Podesta; it closed in 2017.'],
  ['qe-78bf450b35a7', 'An Office of the Inspector General is an independent watchdog office within a U.S. federal agency, such as the Department of Justice, that conducts audits and investigations of the agency\'s programs and personnel to identify waste, fraud, abuse, and misconduct.'],
]

const problems = []
const synopses = []
for (const [entityId, synopsis] of RAW) {
  const e = byId.get(entityId)
  if (!e) { problems.push(`${entityId}: not a live entity`); continue }
  // Exactly apply-entity-synopses.mjs's own QA check: r.synopsis.includes(r.canonical.split(' ')[0])
  const firstWord = e.canonical.split(' ')[0]
  if (!synopsis.includes(firstWord)) {
    problems.push(`${entityId} (${e.canonical}): synopsis does not contain "${firstWord}"`)
  }
  synopses.push({
    entityId,
    canonical: e.canonical,
    ruledOn: RULED_ON,
    provenance: PROVENANCE,
    synopsis,
  })
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(`   ${p}`)
  process.exit(1)
}

const doc = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'))
doc.synopses ??= []
const already = new Set(doc.synopses.map(s => s.entityId))

console.log(`\nOWNER SYNOPSIS RULING — 2026-08-26, #1515 reporters + outlets + WikiLeaks\n`)
let added = 0, skipped = 0
for (const s of synopses) {
  if (already.has(s.entityId)) { skipped++; continue }
  console.log(`  ${s.canonical}`)
  doc.synopses.push(s)
  already.add(s.entityId)
  added++
}
console.log(`\n  ${added} new, ${skipped} already recorded (total input ${synopses.length})\n`)

if (dry) { console.log('  --dry: nothing written\n'); process.exit(0) }
if (!added) { console.log('  nothing to write\n'); process.exit(0) }
fs.writeFileSync(RULINGS_FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`  wrote ${path.relative(ROOT, RULINGS_FILE)}\n`)
