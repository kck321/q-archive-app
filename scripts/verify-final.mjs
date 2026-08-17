// THE PRE-DEPLOY PROOF — now a front door onto two scripts, so every command in the docs and the
// DEVLOG keeps working while the proof itself got 5× cheaper.
//
//   node scripts/verify-final.mjs                  →  validate.mjs --profile certified
//   node scripts/verify-final.mjs --live           →  verify-live.mjs   (delivery, not logic)
//   node scripts/verify-final.mjs --base http://localhost:5175
//
// Pick the profile deliberately when you know what changed — most changes do not need `certified`:
//
//   node scripts/validate.mjs --profile fast       UI only: colour, layout, copy
//   node scripts/validate.mjs --profile standard   shared behaviour: filtering, search, readers
//   node scripts/validate.mjs --profile certified  artifacts, counts, aliases, seed, manifest
//   node scripts/validate.mjs --profile full       every category, viewport and interaction
//
// WHY THE BROWSER STEPS ARE STILL NOT NEGOTIABLE. Three times in one day a change was correct in
// posts.json, correct in the manifest, correct on a fresh profile — and invisible to the owner,
// because a returning visitor keeps whatever it seeded until SEED_VERSION changes. Server-side green
// does not predict what a returning reader sees. The fresh/returning pair is the only check that has
// ever caught it, and it is in every profile from `standard` up and in the live proof.
//
// WHAT DID CHANGE. The live pass no longer re-runs the local suite. It proves DELIVERY — the
// deployed commit, the seed, the assets, the service-worker cache version, the published data files,
// a fresh reader and a returning one — because that is the only thing that can differ between the
// dist/ that passed locally and the same dist/ served by GitHub. Application logic is proved once,
// on the bytes that ship. See the header of verify-live.mjs.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const liveOnly = args.includes('--live')
const BASE = (args.find(a => a.startsWith('--base='))?.split('=')[1])
  ?? (args.includes('--base') ? args[args.indexOf('--base') + 1] : null)

const passthrough = args.filter(a => a !== '--live' && a !== '--base' && !a.startsWith('--base=') && a !== BASE)

const argv = liveOnly
  ? ['scripts/verify-live.mjs', ...passthrough]
  : ['scripts/validate.mjs', '--profile', 'certified', '--base', BASE ?? 'http://localhost:5173', ...passthrough]

const r = spawnSync('node', argv, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(r.status ?? 1)
