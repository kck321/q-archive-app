# Entities — review verdicts applied, and context resolution

**No production write, no deploy.**


## Bucket 1 — the 98 named-but-untyped

| Outcome | Count |
|---|---|
| Given a type | 80 |
| Routed out of Entities | 3 |
| Left unresolved by review | 15 |

Alias merges applied: `MS13` = `MS_13` = `MS-13`; `Gang of 8` = `Gang of Eight`; `SEC of STATE` = `Sec of State`.

Routed out: `QAnon`, `DECLAS`, `Wizards & Warlocks`.


## Bucket 2a — 30 acronyms resolved on the token alone

| Token | Canonical | Type |
|---|---|---|
| `ABC` | ABC News | media organization |
| `DNI` | Director of National Intelligence | title role |
| `NYC` | New York City | location |
| `CDC` | Centers for Disease Control and Prevention | government agency |
| `WHO` | World Health Organization | organization |
| `BBC` | BBC | media organization |
| `RBG` | Ruth Bader Ginsburg | person |
| `NSC` | National Security Council | government institution |
| `MZ` | Mark Zuckerberg | person |
| `NPR` | NPR | media organization |
| `U.S.` | United States | country region |
| `IRS` | Internal Revenue Service | government agency |
| `WSJ` | The Wall Street Journal | media organization |
| `DHS` | Department of Homeland Security | government agency |
| `CBS` | CBS | media organization |
| `ICE` | Immigration and Customs Enforcement | government agency |
| `AZ` | Arizona | location |
| `TX` | Texas | location |
| `KKK` | Ku Klux Klan | political group movement |
| `UN` | United Nations | organization |
| `UBL` | Osama bin Laden | person |
| `PBS` | PBS | media organization |
| `DAG` | Deputy Attorney General | title role |
| `EPA` | Environmental Protection Agency | government agency |
| `NZ` | New Zealand | country region |
| `WWI` | World War I | event incident |
| `CFR` | Council on Foreign Relations | organization |
| `SIS` | Secret Intelligence Service | government agency |
| `FED` | Federal Reserve | government institution |
| `GER` | Germany | country region |

## Bucket 2b — context pass over 23 ambiguous tokens

Each occurrence was read with ±3 lines. A referent is assigned only where the window carries explicit evidence; everything else stays unresolved.

| Token | Occurrences | Resolved | Still unresolved | Referents found |
|---|---|---|---|---|
| `DC` | 102 | 14 | 88 | Washington, D.C. ×14 |
| `SC` | 96 | 10 | 86 | Supreme Court ×10 |
| `BO` | 77 | 16 | 61 | Barack Obama ×14, Board Owner ×2 |
| `Clinton` | 65 | 33 | 32 | Hillary Clinton ×27, Bill Clinton ×6 |
| `CA` | 62 | 13 | 49 | California ×13 |
| `LL` | 41 | 20 | 21 | Loretta Lynch ×20 |
| `JC` | 38 | 16 | 22 | James Comey ×16 |
| `AUS` | 29 | 3 | 26 | Australia ×3 |
| `BLM` | 24 | 0 | 24 | — |
| `BC` | 23 | 5 | 18 | Bill Clinton ×5 |
| `JFK` | 20 | 0 | 20 | — |
| `NY` | 20 | 1 | 19 | New York ×1 |
| `MI` | 19 | 7 | 12 | Military Intelligence ×7 |
| `WL` | 17 | 5 | 12 | WikiLeaks ×5 |
| `SR` | 17 | 3 | 14 | Seth Rich ×3 |
| `JA` | 13 | 1 | 12 | Julian Assange ×1 |
| `VJ` | 10 | 4 | 6 | Valerie Jarrett ×4 |
| `GS` | 10 | 2 | 8 | George Soros ×2 |
| `LV` | 7 | 0 | 7 | — |
| `GA` | 6 | 0 | 6 | — |
| `Maxwell` | 6 | 3 | 3 | Ghislaine Maxwell ×3 |
| `HK` | 5 | 2 | 3 | Hong Kong ×2 |
| `DWS` | 4 | 3 | 1 | Debbie Wasserman Schultz ×3 |

**161 of 711** occurrences resolved (23%). The remaining 550 stay `contextDependent: true`.


This is the behaviour the review asked for: the same token resolves differently in different drops, and to nothing at all where the drop does not say.

