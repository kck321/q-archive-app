// Which copy of the app is this?
//
// The GitHub Pages build is a public, read-only viewer: visitors browse every post,
// question, and analysis result, but no editing control is compiled into their bundle
// at all. `scripts/deploy-web.sh` sets VITE_PUBLIC_SITE=1 for that build only.
//
// The Tauri desktop build (and `npm run dev`) leaves the flag unset, so it keeps the
// full workbench — per-post editing, bulk operations, the AI tools, and the Dashboard.
//
// IMPORTANT — import CAN_EDIT directly in components. Do NOT route it through React
// context. Vite inlines `import.meta.env.VITE_PUBLIC_SITE`, so `CAN_EDIT` folds to a
// literal `false` and Rollup drops `CAN_EDIT && <EditButton/>` from the bundle entirely.
// Read the same value out of a context object instead and it becomes a runtime variable:
// the UI still hides, but every edit control, label, and the admin PIN stay in the
// shipped JS. That was measured — via context the public bundle still contained
// "Admin PIN required" and the PIN itself; importing directly removed them.
//
// Even so, this only controls what SHIPS. It is not access control: the real enforcement
// is the Firestore security rules, since a visitor can always call the database directly.
export const IS_PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE === '1'

/** True when this build is allowed to show editing UI at all. */
export const CAN_EDIT = !IS_PUBLIC_SITE
