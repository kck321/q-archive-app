# Entities — adjudicating the 364 low-confidence types

**No production write, no deploy.** These are the dangerous records: they already carry a type, so a bad classification misleads in a way an honest "unresolved" never does.


358 of the 364 were typed `person` by the structural name-shape fallback. Reading the list shows what that fallback swept up.


## Outcome

| Outcome | Count |
|---|---|
| KEEP_TYPE | 215 |
| CHANGE_TYPE | 129 |
| ROUTE_TO_THEMES | 19 |
| UNRESOLVED | 1 |

## What kind of mistakes the rules were making

| Change | Count |
|---|---|
| person → media organization | 28 |
| person → organization | 26 |
| person → country region | 24 |
| person → government institution | 15 |
| person → title role | 11 |
| person → program operation project | 6 |
| person → event incident | 5 |
| person → creative work | 4 |
| person → other named entity | 3 |
| person → military asset vessel | 2 |
| event incident → event incident | 1 |
| creative work → government institution | 1 |
| event incident → organization | 1 |
| person → facility property | 1 |
| creative work → event incident | 1 |

## Final type distribution across all canonical entities

| Type | Entities |
|---|---|
| person | 714 |
| organization | 115 |
| other named entity | 101 |
| media organization | 85 |
| country region | 65 |
| government institution | 61 |
| location | 44 |
| title role | 21 |
| ROUTED TO THEMES | 19 |
| ROUTE TO THEMES | 14 |
| event incident | 12 |
| religious spiritual | 9 |
| legislation regulation | 9 |
| facility property | 8 |
| creative work | 7 |
| coded alias | 6 |
| program operation project | 6 |
| military asset vessel | 5 |
| technology platform | 4 |
| UNRESOLVED | 1 |

## CHANGE_TYPE (129)

| Source text | × | Old type | New type | Reason |
|---|---|---|---|---|
| `Shadow Brokers` | 4 | person | organization | an organisation, firm or institution |
| `Maggie NYT` | 4 | person | media_organization | a publication or programme |
| `NY AG` | 3 | person | title_role | an office held rather than a person named |
| `2016 election` | 3 | event_incident | event_incident | a named event |
| `Daily Mail` | 3 | person | media_organization | a publication or programme |
| `Daily Dot` | 3 | person | media_organization | a publication or programme |
| `National Review` | 3 | person | media_organization | a publication or programme |
| `National Guard` | 3 | person | government_institution | a government body or armed service |
| `US Intel` | 2 | person | government_institution | a government body or armed service |
| `Nazi Germany` | 2 | person | country_region | a country, region or place |
| `STATE` | 2 | creative_work | government_institution | a government body or armed service |
| `TX Congressman` | 2 | person | title_role | an office held rather than a person named |
| `Steele Dossier` | 2 | person | other_named_entity | a named document |
| `US Navy` | 2 | person | government_institution | a government body or armed service |
| `Rizvi Traverse Management` | 2 | person | organization | an organisation, firm or institution |
| `Judge K` | 2 | person | title_role | an office held rather than a person named |
| `Perkins Coie` | 2 | event_incident | organization | an organisation, firm or institution |
| `Middle East` | 2 | person | country_region | a country, region or place |
| `Daily Wire` | 2 | person | media_organization | a publication or programme |
| `US GOV` | 2 | person | government_institution | a government body or armed service |
| `Air Force` | 2 | person | government_institution | a government body or armed service |
| `Canadian PM` | 2 | person | title_role | an office held rather than a person named |
| `Black Forest` | 2 | person | country_region | a country, region or place |
| `The Fed` | 1 | person | government_institution | a government body or armed service |
| `Southern California` | 1 | person | country_region | a country, region or place |
| `Gateway Bridge Project` | 1 | person | program_operation_project | a named operation or programme |
| `Omnibus Bill` | 1 | person | other_named_entity | a named document |
| `Situation Room` | 1 | person | government_institution | a government body or armed service |
| `West Hollywood` | 1 | person | country_region | a country, region or place |
| `Harvard Muslim Alumni` | 1 | person | organization | an organisation, firm or institution |
| `Earth Day` | 1 | person | event_incident | a named event |
| `Korean Peninsula` | 1 | person | country_region | a country, region or place |
| `Burkina Faso` | 1 | person | country_region | a country, region or place |
| `National Security Action` | 1 | person | organization | an organisation, firm or institution |
| `East Caribbean` | 1 | person | country_region | a country, region or place |
| `Equatorial Guinea` | 1 | person | country_region | a country, region or place |
| `Guinea Bissau` | 1 | person | country_region | a country, region or place |
| `Netherlands Antilles` | 1 | person | country_region | a country, region or place |
| `Papua New Guinea` | 1 | person | country_region | a country, region or place |
| `San Marino` | 1 | person | country_region | a country, region or place |
| `Sierra Leone` | 1 | person | country_region | a country, region or place |
| `Hyde Park` | 1 | person | country_region | a country, region or place |
| `Marine One` | 1 | person | military_asset_vessel | a named military asset |
| `Saturday Night Live` | 1 | person | creative_work | a show, film or band |
| `Santa Fe` | 1 | person | country_region | a country, region or place |
| `Nat Guard` | 1 | person | government_institution | a government body or armed service |
| `Guardian Project` | 1 | person | organization | an organisation, firm or institution |
| `Liberal Democrats` | 1 | person | organization | an organisation, firm or institution |
| `Conservative Review` | 1 | person | media_organization | a publication or programme |
| `Mayo Clinic` | 1 | person | organization | an organisation, firm or institution |
| `Hoover Dam` | 1 | person | country_region | a country, region or place |
| `Border Patrol` | 1 | person | government_institution | a government body or armed service |
| `Operation Underground Railroad` | 1 | person | program_operation_project | a named operation or programme |
| `Australian Ambassador` | 1 | person | title_role | an office held rather than a person named |
| `Ars Technica` | 1 | person | media_organization | a publication or programme |
| `Real Clear Politics` | 1 | person | media_organization | a publication or programme |
| `National Security Adviser` | 1 | person | title_role | an office held rather than a person named |
| `Operation Specialists` | 1 | person | program_operation_project | a named operation or programme |
| `Piper Jaffray` | 1 | person | organization | an organisation, firm or institution |
| `Patriot Day` | 1 | person | event_incident | a named event |
| `America Newsroom` | 1 | person | media_organization | a publication or programme |
| `Fox Business` | 1 | person | media_organization | a publication or programme |
| `Capitol Hill` | 1 | person | country_region | a country, region or place |
| `People's Liberation Army` | 1 | person | organization | an organisation, firm or institution |
| `The Hunt For` | 1 | person | creative_work | a show, film or band |
| `Executive Branch` | 1 | person | government_institution | a government body or armed service |
| `Hyatt Regency` | 1 | person | facility_property | a named facility |
| `White Squall` | 1 | person | creative_work | a show, film or band |
| `Perth Now` | 1 | person | media_organization | a publication or programme |
| `Trump Hotels` | 1 | person | organization | an organisation, firm or institution |
| `Boy Scouts` | 1 | person | organization | an organisation, firm or institution |
| `Girl Scouts` | 1 | person | organization | an organisation, firm or institution |
| `The New Yorker` | 1 | person | media_organization | a publication or programme |
| `Rolling Stone` | 1 | person | media_organization | a publication or programme |
| `Super Bowl` | 1 | creative_work | event_incident | a named event |
| `Urban Dictionary` | 1 | person | media_organization | a publication or programme |
| `Federal Government` | 1 | person | government_institution | a government body or armed service |
| `Ivy League` | 1 | person | organization | an organisation, firm or institution |
| `Federal Agencies` | 1 | person | government_institution | a government body or armed service |
| `The Daily Beast` | 1 | person | media_organization | a publication or programme |
| `Gateway Pundit` | 1 | person | media_organization | a publication or programme |
| `Mil Intel` | 1 | person | government_institution | a government body or armed service |
| `Mueller Report` | 1 | person | media_organization | a publication or programme |
| `Presidential Advisory` | 1 | person | other_named_entity | a named document |
| `Victoria's Secret` | 1 | person | organization | an organisation, firm or institution |
| `Emergency Broadcast System` | 1 | person | program_operation_project | a named operation or programme |
| `Stealth Bomber` | 1 | person | military_asset_vessel | a named military asset |
| `Hollywood Reporter` | 1 | person | media_organization | a publication or programme |
| `Cornell Law School` | 1 | person | organization | an organisation, firm or institution |
| `American Red Cross` | 1 | person | organization | an organisation, firm or institution |
| `Oshkosh Wisconsin` | 1 | person | country_region | a country, region or place |
| `Pearson Publishing` | 1 | person | organization | an organisation, firm or institution |
| `Thousand Talents Plan` | 1 | person | program_operation_project | a named operation or programme |
| `Midterm Elections` | 1 | person | event_incident | a named event |
| `Activision Blizzard` | 1 | person | organization | an organisation, firm or institution |
| `Civil Rights Division` | 1 | person | government_institution | a government body or armed service |
| `The Lancet` | 1 | person | media_organization | a publication or programme |
| `Fox Friends` | 1 | person | media_organization | a publication or programme |
| `Ingraham Angle` | 1 | person | media_organization | a publication or programme |
| `Global Health Leaders` | 1 | person | organization | an organisation, firm or institution |
| `Cambridge Dictionary` | 1 | person | media_organization | a publication or programme |
| `Google Trends` | 1 | person | media_organization | a publication or programme |
| `French Revolution` | 1 | person | event_incident | a named event |
| `Confederate General` | 1 | person | title_role | an office held rather than a person named |
| `Yale Medicine` | 1 | person | organization | an organisation, firm or institution |
| `First Lady` | 1 | person | title_role | an office held rather than a person named |
| `World Health Organization` | 1 | person | organization | an organisation, firm or institution |
| `World Trade Organization` | 1 | person | organization | an organisation, firm or institution |
| `United Nations` | 1 | person | organization | an organisation, firm or institution |
| `El Centro` | 1 | person | country_region | a country, region or place |
| `Radnor Township` | 1 | person | country_region | a country, region or place |
| `Young Republican Federation` | 1 | person | organization | an organisation, firm or institution |
| `Intelligence Community` | 1 | person | government_institution | a government body or armed service |
| `Just Security` | 1 | person | media_organization | a publication or programme |
| `Eastern Washington` | 1 | person | country_region | a country, region or place |
| `Oregon State Park` | 1 | person | country_region | a country, region or place |
| `Daily Signal` | 1 | person | media_organization | a publication or programme |
| `Daily Sabah` | 1 | person | media_organization | a publication or programme |
| `Harvard Law School` | 1 | person | organization | an organisation, firm or institution |
| `East Africa` | 1 | person | country_region | a country, region or place |
| `New York Governor` | 1 | person | title_role | an office held rather than a person named |
| `United States Senator` | 1 | person | title_role | an office held rather than a person named |
| `Titus Nation` | 1 | person | organization | an organisation, firm or institution |
| `Zero Hedge` | 1 | person | media_organization | a publication or programme |
| `Operation Merlin` | 1 | person | program_operation_project | a named operation or programme |
| `Iran Deal` | 1 | person | event_incident | a named event |
| `Fed Judge` | 1 | person | title_role | an office held rather than a person named |
| `Comedy Central` | 1 | person | media_organization | a publication or programme |
| `Of Montreal` | 1 | person | creative_work | a show, film or band |

## ROUTE_TO_THEMES (19)

| Source text | × | Old type | New type | Reason |
|---|---|---|---|---|
| `MAGA` | 4 | person | — | a collective or concept rather than a named referent |
| `qresearch` | 2 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `Castle LOCK` | 2 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `Mad Hatter` | 2 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `RED OCTOBER` | 2 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `American People` | 2 | person | — | a collective or concept rather than a named referent |
| `Midnight Rider` | 2 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `Sparrow Red` | 1 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `Afghan Arabs` | 1 | person | — | a collective or concept rather than a named referent |
| `Ancient Egyptians` | 1 | person | — | a collective or concept rather than a named referent |
| `Red October` | 1 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `Red Castle` | 1 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `Green Castle` | 1 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `Wheels Up` | 1 | person | — | one of Q’s codewords — belongs to Codes & Brackets or Themes, not Entities |
| `Official Secrets` | 1 | person | — | a collective or concept rather than a named referent |
| `Nature's God` | 1 | person | — | a collective or concept rather than a named referent |
| `Confederate Democrats` | 1 | event_incident | — | a collective or concept rather than a named referent |
| `America's Founders` | 1 | person | — | a collective or concept rather than a named referent |
| `State Secrets` | 1 | person | — | a collective or concept rather than a named referent |

## UNRESOLVED (1)

| Source text | × | Old type | New type | Reason |
|---|---|---|---|---|
| `H. Biden` | 2 | person | — | a name reduced to an initial — the referent is not established |

## KEEP_TYPE (215)

| Source text | × | Old type | New type | Reason |
|---|---|---|---|---|
| `Hunter Biden` | 10 | person | person | a personal name left after every competing class was tested |
| `Carter Page` | 8 | person | person | a personal name left after every competing class was tested |
| `Bill Priestap` | 8 | person | person | a personal name left after every competing class was tested |
| `Bill Clinton` | 7 | person | person | a personal name left after every competing class was tested |
| `Trisha Anderson` | 6 | person | person | a personal name left after every competing class was tested |
| `AG Sessions` | 5 | person | person | a title followed by a surname — a person |
| `Jussie Smollett` | 5 | person | person | a personal name left after every competing class was tested |
| `Ray Chandler` | 4 | person | person | a personal name left after every competing class was tested |
| `Ezra Cohen-Watnick` | 4 | person | person | a personal name left after every competing class was tested |
| `Tashina Gauhar` | 4 | person | person | a personal name left after every competing class was tested |
| `Valerie Jarrett` | 4 | person | person | a personal name left after every competing class was tested |
| `Cory Booker` | 3 | person | person | a personal name left after every competing class was tested |
| `Frank LoBiondo` | 3 | person | person | a personal name left after every competing class was tested |
| `Lynn Jenkins` | 3 | person | person | a personal name left after every competing class was tested |
| `Tim Murphy` | 3 | person | person | a personal name left after every competing class was tested |
| `Allison Mack` | 3 | person | person | a personal name left after every competing class was tested |
| `Bill Maher` | 3 | person | person | a personal name left after every competing class was tested |
| `Gavin Newsom` | 3 | person | person | a personal name left after every competing class was tested |
| `Kamala Harris` | 3 | person | person | a personal name left after every competing class was tested |
| `Ian Cameron` | 3 | person | person | a personal name left after every competing class was tested |
| `Doug Collins` | 3 | person | person | a personal name left after every competing class was tested |
| `AG Barr` | 3 | creative_work | person | a title followed by a surname — a person |
| `Black Lives Matter` | 3 | person | person | a personal name left after every competing class was tested |
| `Holy See` | 2 | person | person | a personal name left after every competing class was tested |
| `JFK Jr.` | 2 | person | person | a personal name left after every competing class was tested |
| `Anne Wojcicki` | 2 | person | person | a personal name left after every competing class was tested |
| `Orrin Hatch` | 2 | person | person | a personal name left after every competing class was tested |
| `Bill Shuster` | 2 | person | person | a personal name left after every competing class was tested |
| `Carol Shea-Porter` | 2 | person | person | a personal name left after every competing class was tested |
| `Darrell Issa` | 2 | person | person | a personal name left after every competing class was tested |
| `Dave Reichert` | 2 | person | person | a personal name left after every competing class was tested |
| `Gene Green` | 2 | person | person | a personal name left after every competing class was tested |
| `Gregg Harper` | 2 | person | person | a personal name left after every competing class was tested |
| `Ileana Ros-Lehtinen` | 2 | person | person | a personal name left after every competing class was tested |
| `Jeb Hensarling` | 2 | person | person | a personal name left after every competing class was tested |
| `Niki Tsongas` | 2 | person | person | a personal name left after every competing class was tested |
| `Rodney Frelinghuysen` | 2 | person | person | a personal name left after every competing class was tested |
| `Sandy Levin` | 2 | person | person | a personal name left after every competing class was tested |
| `Blake Farenthold` | 2 | person | person | a personal name left after every competing class was tested |
| `Thad Cochran` | 2 | person | person | a personal name left after every competing class was tested |
| `Trent Franks` | 2 | person | person | a personal name left after every competing class was tested |
| `Xavier Becerra` | 2 | person | person | a personal name left after every competing class was tested |
| `Erik Prince` | 2 | person | person | a personal name left after every competing class was tested |
| `Matt Gaetz` | 2 | person | person | a personal name left after every competing class was tested |
| `Gina Haspel` | 2 | person | person | a personal name left after every competing class was tested |
| `Tony Podesta` | 2 | person | person | a personal name left after every competing class was tested |
| `Hassan Rouhani` | 2 | person | person | a personal name left after every competing class was tested |
| `Natalia Veselnitskaya` | 2 | person | person | a personal name left after every competing class was tested |
| `Sergey Brin` | 2 | person | person | a personal name left after every competing class was tested |
| `Rahm Emanuel` | 2 | person | person | a personal name left after every competing class was tested |
| `Jerome Corsi` | 2 | person | person | a personal name left after every competing class was tested |
| `Tucker Carlson` | 2 | person | person | a personal name left after every competing class was tested |
| `Ivanka Trump` | 2 | person | person | a personal name left after every competing class was tested |
| `Charlie Kirk` | 2 | person | person | a personal name left after every competing class was tested |
| `George H.W. Bush` | 2 | person | person | a personal name left after every competing class was tested |
| `Ilhan Omar` | 2 | person | person | a personal name left after every competing class was tested |
| `Imran Awan` | 2 | person | person | a personal name left after every competing class was tested |
| `Colin Skow` | 2 | person | person | a personal name left after every competing class was tested |
| `Andy Ngo` | 2 | person | person | a personal name left after every competing class was tested |
| `Greg Andres` | 2 | person | person | a personal name left after every competing class was tested |
| `Mika Brzezinski` | 2 | person | person | a personal name left after every competing class was tested |
| `Chris Christie` | 1 | person | person | a personal name left after every competing class was tested |
| `Fareed Zakaria` | 1 | person | person | a personal name left after every competing class was tested |
| `Mariah Sunshine Coogan` | 1 | person | person | a personal name left after every competing class was tested |
| `Agnes Nixon` | 1 | person | person | a personal name left after every competing class was tested |
| `Serzh Sargsyan` | 1 | person | person | a personal name left after every competing class was tested |
| `Stormy Daniels` | 1 | person | person | a personal name left after every competing class was tested |
| `Alex Jones` | 1 | person | person | a personal name left after every competing class was tested |
| `Officer Familia` | 1 | person | person | a personal name left after every competing class was tested |
| `Charlie Dent` | 1 | person | person | a personal name left after every competing class was tested |
| `Raul Labrador` | 1 | person | person | a personal name left after every competing class was tested |
| `Kashyap Patel` | 1 | person | person | a personal name left after every competing class was tested |
| `Alex Rodriguez` | 1 | person | person | a personal name left after every competing class was tested |
| `Bin Laden` | 1 | person | person | a personal name left after every competing class was tested |
| `Hugh Hefner` | 1 | person | person | a personal name left after every competing class was tested |
| `Curt Schilling` | 1 | person | person | a personal name left after every competing class was tested |
| `Shiva Ayyadurai` | 1 | person | person | a personal name left after every competing class was tested |
| `Ronan Farrow` | 1 | person | person | a personal name left after every competing class was tested |
| `Ali Velshi` | 1 | person | person | a personal name left after every competing class was tested |
| `Chris Cuomo` | 1 | person | person | a personal name left after every competing class was tested |
| `Phill Mudd` | 1 | person | person | a personal name left after every competing class was tested |
| `Bill Paxon` | 1 | person | person | a personal name left after every competing class was tested |
| `Matt Doran` | 1 | person | person | a personal name left after every competing class was tested |
| `Tim Ballard` | 1 | person | person | a personal name left after every competing class was tested |
| `Tony Blair` | 1 | person | person | a personal name left after every competing class was tested |
| `Benedict Arnold` | 1 | person | person | a personal name left after every competing class was tested |
| `Admiral Rogers` | 1 | person | person | a title followed by a surname — a person |
| `Doug Ducey` | 1 | person | person | a personal name left after every competing class was tested |
| `Jon Kyl` | 1 | person | person | a personal name left after every competing class was tested |
| `Cindy McCain` | 1 | person | person | a personal name left after every competing class was tested |
| `Brad Ahmundson` | 1 | person | person | a personal name left after every competing class was tested |
| `Pope Francis` | 1 | person | person | a title followed by a surname — a person |
| `Andre Carson` | 1 | person | person | a personal name left after every competing class was tested |
| `Louis Farrakhan` | 1 | person | person | a personal name left after every competing class was tested |
| `Gregg Jarrett` | 1 | person | person | a personal name left after every competing class was tested |
| `Chris Evans` | 1 | person | person | a personal name left after every competing class was tested |
| `Katrina Pierson` | 1 | person | person | a personal name left after every competing class was tested |
| `Marty Torrey` | 1 | person | person | a personal name left after every competing class was tested |
| `Peggy Grande` | 1 | person | person | a personal name left after every competing class was tested |
| `Don McGahn` | 1 | person | person | a personal name left after every competing class was tested |
| `Harriet Cash` | 1 | person | person | a personal name left after every competing class was tested |
| `Reince Priebus` | 1 | person | person | a personal name left after every competing class was tested |
| `Chelsey Smith` | 1 | person | person | a personal name left after every competing class was tested |
| `Sundar Pichai` | 1 | person | person | a personal name left after every competing class was tested |
| `Cardinal Pell` | 1 | person | person | a title followed by a surname — a person |
| `Maggie Haberman` | 1 | person | person | a personal name left after every competing class was tested |
| `Kirk Adams` | 1 | person | person | a personal name left after every competing class was tested |
| `Cecile Richards` | 1 | person | person | a personal name left after every competing class was tested |
| `Bianna Vitalievna` | 1 | person | person | a personal name left after every competing class was tested |
| `Jay Carney` | 1 | person | person | a personal name left after every competing class was tested |
| `Saddam Hussein` | 1 | person | person | a personal name left after every competing class was tested |
| `Senator Collins` | 1 | person | person | a title followed by a surname — a person |
| `Mitt Romney` | 1 | person | person | a personal name left after every competing class was tested |
| `Bernie Sanders` | 1 | person | person | a personal name left after every competing class was tested |
| `Cardinal George Pell` | 1 | person | person | a title followed by a surname — a person |
| `Bill Slater` | 1 | person | person | a personal name left after every competing class was tested |
| `Todd Penley` | 1 | person | person | a personal name left after every competing class was tested |
| `Trump Jr` | 1 | person | person | a personal name left after every competing class was tested |
| `Stacey Dash` | 1 | person | person | a personal name left after every competing class was tested |
| `Chris Cox` | 1 | person | person | a personal name left after every competing class was tested |
| `Nick Lewin` | 1 | person | person | a personal name left after every competing class was tested |
| `Prince Andrew` | 1 | person | person | a personal name left after every competing class was tested |
| `Michal Chelbin` | 1 | person | person | a personal name left after every competing class was tested |
| `Nicky Hilton` | 1 | person | person | a personal name left after every competing class was tested |
| `Paris Hilton` | 1 | person | person | a personal name left after every competing class was tested |
| `Sebastian Gorka` | 1 | person | person | a personal name left after every competing class was tested |
| `Dafna Linzer` | 1 | person | person | a personal name left after every competing class was tested |
| `Clare Bronfman` | 1 | person | person | a personal name left after every competing class was tested |
| `Ghislaine Maxwell` | 1 | person | person | a personal name left after every competing class was tested |
| `Jake Tapper` | 1 | person | person | a personal name left after every competing class was tested |
| `Senator Grassley` | 1 | person | person | a title followed by a surname — a person |
| `Woodrow Wilson` | 1 | person | person | a personal name left after every competing class was tested |
| `Marsha Blackburn` | 1 | person | person | a personal name left after every competing class was tested |
| `Bill Binney` | 1 | person | person | a personal name left after every competing class was tested |
| `Iris Weinshall` | 1 | person | person | a personal name left after every competing class was tested |
| `Heidi Fleiss` | 1 | person | person | a personal name left after every competing class was tested |
| `Andy Harris` | 1 | person | person | a personal name left after every competing class was tested |
| `Harmeet Dhillon` | 1 | person | person | a personal name left after every competing class was tested |
| `Luke Goldberg` | 1 | person | person | a personal name left after every competing class was tested |
| `Rochelle Coombs` | 1 | person | person | a personal name left after every competing class was tested |
| `Lou Dobbs` | 1 | person | person | a personal name left after every competing class was tested |
| `Chris Hayes` | 1 | person | person | a personal name left after every competing class was tested |
| `Greg Kotseos` | 1 | person | person | a personal name left after every competing class was tested |
| `Byron York` | 1 | person | person | a personal name left after every competing class was tested |
| `Shannon Bream` | 1 | person | person | a personal name left after every competing class was tested |
| `Anderson Cooper` | 1 | person | person | a personal name left after every competing class was tested |
| `Valerie Plame` | 1 | person | person | a personal name left after every competing class was tested |
| `Omarosa Manigault Newman` | 1 | person | person | a personal name left after every competing class was tested |
| `Tito Calloway` | 1 | person | person | a personal name left after every competing class was tested |
| `Nathalie Himmelrich` | 1 | person | person | a personal name left after every competing class was tested |

_…and 65 more in the JSON._
