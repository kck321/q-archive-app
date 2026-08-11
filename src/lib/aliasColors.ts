// Shared alias chip/highlight colors so the Entities cards and the Post Archive search color-code
// the same way: an "anchor" term (the canonical name on Entities, or the searched term on Post
// Archive) gets a fixed color, and every other alias in the group gets its own distinct color.

// Anchor colors.
export const CANON_CHIP = 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border-gray-600 hover:border-gray-400'
export const SEARCHED_CHIP = 'bg-red-900/40 hover:bg-red-800/60 text-red-200 hover:text-red-100 border-red-700/60 hover:border-red-500 font-bold'

// Distinct per-alias colors (Link-chip friendly: base + hover). Kept < 11 so a large group still
// cycles predictably.
export const ALIAS_CHIP_PALETTE = [
  'bg-blue-900/30 hover:bg-blue-800/60 text-blue-300 hover:text-blue-100 border-blue-700/50 hover:border-blue-500',
  'bg-amber-900/30 hover:bg-amber-800/60 text-amber-300 hover:text-amber-100 border-amber-700/50 hover:border-amber-500',
  'bg-green-900/30 hover:bg-green-800/60 text-green-300 hover:text-green-100 border-green-700/50 hover:border-green-500',
  'bg-violet-900/30 hover:bg-violet-800/60 text-violet-300 hover:text-violet-100 border-violet-700/50 hover:border-violet-500',
  'bg-pink-900/30 hover:bg-pink-800/60 text-pink-300 hover:text-pink-100 border-pink-700/50 hover:border-pink-500',
  'bg-teal-900/30 hover:bg-teal-800/60 text-teal-300 hover:text-teal-100 border-teal-700/50 hover:border-teal-500',
  'bg-orange-900/30 hover:bg-orange-800/60 text-orange-300 hover:text-orange-100 border-orange-700/50 hover:border-orange-500',
  'bg-fuchsia-900/30 hover:bg-fuchsia-800/60 text-fuchsia-300 hover:text-fuchsia-100 border-fuchsia-700/50 hover:border-fuchsia-500',
  'bg-lime-900/30 hover:bg-lime-800/60 text-lime-300 hover:text-lime-100 border-lime-700/50 hover:border-lime-500',
  'bg-rose-900/30 hover:bg-rose-800/60 text-rose-300 hover:text-rose-100 border-rose-700/50 hover:border-rose-500',
]

// Map every group member (lowercased) → a chip class. `anchor` gets `anchorCls`; the rest cycle the
// palette in the order given. `priority` returns the members in the order colors should win when a
// post carries more than one (anchor first, then group order) — use it to pick a post's single color.
export function assignAliasColors(members: string[], anchor: string, anchorCls: string): {
  colorOf: Map<string, string>
  priority: string[]
} {
  const anchorL = anchor.toLowerCase().trim()
  const colorOf = new Map<string, string>([[anchorL, anchorCls]])
  const priority: string[] = [anchorL]
  let i = 0
  for (const term of members) {
    const t = term.toLowerCase().trim()
    if (!t || t === anchorL) continue
    if (!colorOf.has(t)) { colorOf.set(t, ALIAS_CHIP_PALETTE[i % ALIAS_CHIP_PALETTE.length]); i++ }
    priority.push(t)
  }
  return { colorOf, priority }
}
