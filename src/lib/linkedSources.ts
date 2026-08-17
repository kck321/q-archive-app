// Linked sources — the publisher behind a URL Q pasted.
//
// A DIFFERENT LAYER FROM ENTITY MENTIONS, DELIBERATELY.
//
// An entity mention is a claim that Q NAMED something. A domain in a link he pasted is not that:
// it is real information about where the material came from, and it belongs where sources are
// listed rather than where Q's words are painted. Keeping the two apart is the whole point of the
// 2026-08-16 URL policy — nothing here is highlighted over the drop text, counted as a mention, or
// allowed to inflate an entity's figures.
//
// The artifact is written by the URL cleanup and does not exist until that cleanup is applied.
// Everything below degrades to "no sources" rather than failing, so the app is correct both
// before and after the change lands.
import { useEffect, useState } from 'react'

/**
 * TWO KINDS, AND THE DIFFERENCE IS NOT COSMETIC.
 *
 *   publisher       the domain says who published the material Q linked
 *   social_account  Q linked to someone's account
 *
 * They share a surface because a reader asking "where did this come from" wants both. They are
 * labelled apart because "Q cited Reuters" and "Q linked to someone's Twitter profile" are
 * different claims, and rendering them identically would quietly assert the first when only the
 * second is true.
 */
export type SourceKind = 'publisher' | 'social_account'

export interface LinkedSource {
  kind: SourceKind
  url: string
  hostname: string
  platform?: string | null
  handle?: string | null
  displayName: string
  /** The permanent qe- id, but ONLY where the domain plainly belongs to the entity, or where the
   *  handle spells its canonical name. Null is not a gap to be filled in later by guessing: it
   *  means the archive can name the source without claiming it identifies a certified entity. */
  entityId: string | null
  confidence: string
  originalOccurrence: string
}

export interface HostnameSource {
  hostname: string
  displayName: string
  entityId: string | null
  posts: number[]
}

export interface AccountSource {
  platform: string
  handle: string
  displayName: string
  entityId: string | null
  posts: number[]
}

export interface LinkedSources {
  totals?: Record<string, number>
  byPost: Record<string, LinkedSource[]>
  byHostname: Record<string, HostnameSource>
  byAccount?: Record<string, AccountSource>
}

const EMPTY: LinkedSources = { byPost: {}, byHostname: {}, byAccount: {} }

let _cache: LinkedSources | null = null
let _inflight: Promise<LinkedSources> | null = null

export async function loadLinkedSources(): Promise<LinkedSources> {
  if (_cache) return _cache
  _inflight ??= (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/linked-sources.json`)
      _cache = res.ok ? await res.json() : EMPTY
    } catch { _cache = EMPTY }
    return _cache!
  })().finally(() => { _inflight = null })
  return _inflight
}

export function useLinkedSources(): LinkedSources {
  const [s, setS] = useState<LinkedSources>(() => _cache ?? EMPTY)
  useEffect(() => { let live = true; loadLinkedSources().then(x => { if (live) setS(x) }); return () => { live = false } }, [])
  return s
}

/** Sources linked in one drop, de-duplicated by URL and ordered for reading. */
export function sourcesForPost(all: LinkedSources, postNum: number): LinkedSource[] {
  const rows = all.byPost?.[String(postNum)] ?? []
  const seen = new Set<string>()
  return rows.filter(r => (seen.has(r.url) ? false : (seen.add(r.url), true)))
}

/** Every hostname the archive can name, most-linked first. Source NAVIGATION, not entity search. */
export function allSources(all: LinkedSources): HostnameSource[] {
  return Object.values(all.byHostname ?? {}).sort((a, b) =>
    b.posts.length - a.posts.length || a.hostname.localeCompare(b.hostname))
}

/** Every social account Q linked to, most-linked first. */
export function allAccounts(all: LinkedSources): AccountSource[] {
  return Object.values(all.byAccount ?? {}).sort((a, b) =>
    b.posts.length - a.posts.length || a.handle.localeCompare(b.handle))
}

/** How an account is written for a reader: @handle on its platform, never as a bare name. */
export function accountLabel(a: { platform: string, handle: string }): string {
  const platform = a.platform.replace(/\.(com|org|net|me|tv)$/, '')
  return `@${a.handle} on ${platform}`
}

/**
 * How a source-only identity must describe itself.
 *
 * An entity whose every prose mention was a URL fragment ends the cleanup with zero mentions and
 * a live linked-source record. Rendering "0 mentions" for it would read as a broken page — the
 * count is not missing, the CATEGORY is different. This is the sentence that says so.
 */
export function sourceOnlyDescription(postCount: number): string {
  return postCount === 1
    ? 'Referenced as the source of material linked in 1 drop — never named in Q\'s own words.'
    : `Referenced as the source of material linked in ${postCount.toLocaleString()} drops — never named in Q's own words.`
}
