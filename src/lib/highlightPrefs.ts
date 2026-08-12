import { useSyncExternalStore } from 'react'

/**
 * Whether the language highlighting is on.
 *
 * With it off the archive behaves like a plain post search: no question blues, claim ambers
 * or entity cyans, just the drop as Q wrote it. The searched term stays highlighted — that
 * one is navigation, not analysis, and losing it would make a search result impossible to
 * scan.
 *
 * Kept in localStorage rather than React state so it survives a reload and applies before
 * the first paint, and exposed through useSyncExternalStore so every post on screen
 * re-renders the moment it is toggled.
 */
const KEY = 'q-language-highlights'

function read(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

let enabled = read()
const listeners = new Set<() => void>()

export function highlightsEnabled(): boolean {
  return enabled
}

export function setHighlightsEnabled(on: boolean): void {
  enabled = on
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode */ }
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function useHighlightsEnabled(): boolean {
  return useSyncExternalStore(subscribe, highlightsEnabled, () => true)
}
