// The linked-source reader surfaces, driven in a real browser BEFORE the cleanup is approved.
//
//   node scripts/test-linked-sources.mjs [baseUrl] [--fresh]
//
// WHY THIS RUNS AGAINST A FIXTURE. linked-sources.json does not exist until the URL cleanup is
// applied, and the cleanup is waiting on a ruling. Shipping the presentation on the strength of
// "it will work once the data lands" is how a feature arrives broken on the day it matters, so
// the applier emits the artifact it WOULD write, the fixture is staged, the app is driven for
// real, and the fixture is removed again in a finally block.
//
// WHAT IS BEING PROVEN, beyond "it renders":
//   - a source is presented as a SOURCE, never as a word Q wrote
//   - bound and unbound rows say different things, because they mean different things
//   - the region is reachable and announceable, not a hover
//   - search returns a source under its own section, distinguishable from an entity hit
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { launch } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const LINKED = path.join(DATA, 'linked-sources.json')
const INDEX = path.join(DATA, 'search-index.json')
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'q-linked-src-'))
const indexBackup = path.join(scratch, 'search-index.json')

let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${got}`) }

// ── stage the fixture ───────────────────────────────────────────────────────
// The guard rails: linked-sources.json must NOT already exist (that would mean the cleanup is
// applied and this test would be deleting live data), and the search index is copied aside byte
// for byte so the restore is a restore rather than a rebuild.
if (fs.existsSync(LINKED)) {
  console.error('\n  linked-sources.json already exists — the cleanup is applied. This fixture test is for the unapplied state only.\n')
  process.exit(1)
}
fs.copyFileSync(INDEX, indexBackup)

const cleanup = () => {
  if (fs.existsSync(LINKED)) fs.unlinkSync(LINKED)
  if (fs.existsSync(indexBackup)) fs.copyFileSync(indexBackup, INDEX)
  fs.rmSync(scratch, { recursive: true, force: true })
}
process.on('exit', cleanup)
process.on('SIGINT', () => { cleanup(); process.exit(130) })

try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'apply-entity-cleanup.mjs'), '--emit', scratch], { stdio: 'ignore' })
  fs.copyFileSync(path.join(scratch, 'linked-sources.json'), LINKED)
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-search-index.mjs')], { stdio: 'ignore' })

  const linked = JSON.parse(fs.readFileSync(LINKED, 'utf8'))
  const hosts = Object.values(linked.byHostname)
  const accounts = Object.values(linked.byAccount ?? {})
  const boundHost = hosts.find(h => h.entityId)
  const unboundHost = hosts.find(h => !h.entityId)
  const boundAccount = accounts.find(a => a.entityId)
  const samplePost = Object.entries(linked.byPost).sort((a, b) => b[1].length - a[1].length)[0][0]

  console.log(`\nLINKED SOURCES — READER SURFACES  (${mode})\n`)
  console.log(`  fixture: ${linked.totals.records} records · ${linked.totals.hostnames} hostnames · ${accounts.length} accounts · ${linked.totals.boundToEntity} bound · ${linked.totals.unbound} unbound`)
  console.log(`  drop #${samplePost}, bound "${boundHost?.displayName}", unbound "${unboundHost?.displayName}"\n`)

  const browser = await launch({ mode })

  // ── 1. the drop ───────────────────────────────────────────────────────────
  const page = await browser.page(`${BASE}/post/${samplePost}`)
  // Case-insensitive on purpose. The heading is styled `uppercase`, so innerText renders it as
  // "SOURCES LINKED IN THIS DROP" — matching the authored casing reported the region missing while
  // it was plainly on the page. The same class of mistake as testing the stored text instead of
  // the rendered text, one layer up.
  const ok = await page.waitFor(`/sources linked in this drop/i.test(document.body.innerText)`, { timeout: 60000 })
  check(Boolean(ok), 'the drop shows a linked-source region', ok ? 'present' : 'MISSING')

  const region = await page.evaluate(`(() => {
    const h = [...document.querySelectorAll('h3')].find(x => /Sources linked in this drop/.test(x.textContent))
    if (!h) return ''
    const sec = h.closest('section')
    const items = [...(sec?.querySelectorAll('li') ?? [])]
    return JSON.stringify({
      labelled: sec?.getAttribute('aria-labelledby') === h.id,
      isSection: sec?.tagName === 'SECTION',
      items: items.length,
      identified: items.filter(li => /identified source/.test(li.textContent)).length,
      named: items.filter(li => /named, not identified/.test(li.textContent)).length,
      saysNotAMention: /not counted as entity mentions/.test(sec?.textContent ?? ''),
      links: [...(sec?.querySelectorAll('a[href^="http"]') ?? [])].length,
      rel: [...(sec?.querySelectorAll('a[href^="http"]') ?? [])].every(a => /noopener/.test(a.rel)),
    })
  })()`)
  const r = region ? JSON.parse(region) : null
  check(r?.isSection === true, 'it is a labelled region, not a tooltip', r?.isSection ? 'section' : '—')
  check(r?.labelled === true, 'the region is named for a screen reader', r?.labelled ? 'aria-labelledby' : 'UNLABELLED')
  check((r?.items ?? 0) > 0, 'the sources are a list', `${r?.items} rows`)
  check(r?.saysNotAMention === true, 'it states these are not entity mentions', r?.saysNotAMention ? 'stated' : 'NOT STATED')
  check((r?.links ?? 0) > 0 && r?.rel === true, 'outbound links carry noopener', r?.rel ? 'safe' : 'UNSAFE')

  // ── 2. the Sources surface ────────────────────────────────────────────────
  const sp = await browser.page(`${BASE}/sources`)
  await sp.waitFor(`document.body.innerText.includes('Sources')`, { timeout: 60000 })
  const listed = await sp.evaluate(`(() => {
    const items = [...document.querySelectorAll('li')]
    return JSON.stringify({
      rows: items.length,
      bound: items.filter(li => /identified source/.test(li.textContent)).length,
      unbound: items.filter(li => /named, not identified/.test(li.textContent)).length,
      hasBound: document.body.innerText.includes(${JSON.stringify(boundHost?.hostname ?? '')}),
      saysSourceOnly: /never named in Q's own words/.test(document.body.innerText),
      separateFromEntities: !/certified entity mention/i.test(document.body.innerText),
    })
  })()`)
  const l = listed ? JSON.parse(listed) : null
  check((l?.rows ?? 0) >= hosts.length + accounts.length, 'every publisher and account is navigable',
    `${l?.rows} rows for ${hosts.length} hostnames + ${accounts.length} accounts`)
  check(l?.hasBound === true, 'a bound publisher is listed by domain', boundHost?.hostname ?? '—')
  check(l?.bound > 0 && l?.unbound >= 0, 'bound and unbound rows are distinguished', `${l?.bound} identified / ${l?.unbound} named-only`)
  check(l?.saysSourceOnly === true, 'a source-only identity is described, not shown as a zero', l?.saysSourceOnly ? 'described' : 'MISSING')

  // ── 3. search finds a source, and knows it is not an entity ───────────────
  const term = boundHost?.displayName ?? ''
  const qp = await browser.page(`${BASE}/search?q=${encodeURIComponent(term)}`)
  await qp.waitFor(`document.querySelectorAll('a[href*="/post/"], li, article').length > 0`, { timeout: 60000 })
  const found = await qp.evaluate(`(() => {
    const text = document.body.innerText
    return JSON.stringify({
      // The FILTER CHIP, not the word anywhere on the page — the sidebar carries a Sources link
      // now too, and matching that would pass without search knowing the section exists at all.
      // The chip carries its hit count inside the same button ("Sources43"), so this is a prefix
      // test rather than equality. And no backslash escapes: this string travels through a
      // template literal and a CDP payload before a browser ever parses it, and a regex that
      // survives one hop but not the other silently evaluates to false — which reads exactly like
      // a missing feature.
      hasSourcesFilter: [...document.querySelectorAll('button')].some(b => b.textContent.trim().startsWith('Sources')),
      sourceRow: /linked source/i.test(text),
      entityRow: /certified entity/i.test(text),
    })
  })()`)
  const f = found ? JSON.parse(found) : null
  check(f?.hasSourcesFilter === true, 'search offers Sources as its own section', f?.hasSourcesFilter ? 'offered' : 'MISSING')
  check(f?.sourceRow === true, `search returns "${term}" as a linked source`, f?.sourceRow ? 'found' : 'NOT FOUND')

  // The index itself: a source row must never be filed under entities.
  const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
  const srcRows = idx.rows.filter(x => x.s === 'sources')
  const misfiled = idx.rows.filter(x => x.s === 'entities' && /linked source/i.test(x.w ?? ''))
  const idxPublishers = srcRows.filter(x => x.f?.kind === 'publisher').length
  const idxAccounts = srcRows.filter(x => x.f?.kind === 'social_account').length
  check(idxPublishers === hosts.length && idxAccounts === accounts.length,
    'publishers and accounts are each indexed, in the Sources section',
    `${idxPublishers} publishers + ${idxAccounts} accounts = ${srcRows.length} rows`)
  // A handle must be findable AS a handle. Indexing only the display name would mean a reader who
  // remembers "@CBS_Herridge" and not "Catherine Herridge" finds nothing.
  const byHandle = srcRows.filter(x => x.f?.kind === 'social_account' && x.t === `@${x.f.handle}`)
  check(byHandle.length === accounts.length, 'every account is searchable by its handle', `${byHandle.length} of ${accounts.length}`)
  // And an account must never be described as something Q wrote.
  const overclaimed = srcRows.filter(x => x.f?.kind === 'social_account' && !/not a word he wrote|identity not established/.test(x.w ?? ''))
  check(overclaimed.length === 0, 'no account row reads as Q naming the person', `${overclaimed.length} overclaimed`)
  check(misfiled.length === 0, 'no source is indexed as a prose entity mention', `${misfiled.length} misfiled`)

  console.log(`\n  ${failed ? `❌ ${failed} failed` : '✅ the linked-source surfaces work against the artifact the cleanup will write'}\n`)
} finally {
  cleanup()
}
process.exit(failed ? 1 : 0)
