// Single-writer lock. Two agents certifying q-app at once will interleave artifact writes and
// produce a bundle neither of them verified.
//
//   node scripts/repo-lock.mjs acquire "what I am doing"
//   node scripts/repo-lock.mjs release
//   node scripts/repo-lock.mjs status
//
// A lock older than STALE_MIN is reported as stale and can be taken with --force.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOCK = path.join(ROOT, '.repo-lock.json')
const STALE_MIN = 90
const [cmd, ...rest] = process.argv.slice(2)
const read = () => (fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : null)
const ageMin = l => Math.round((Date.now() - new Date(l.acquiredAt).getTime()) / 60000)

if (cmd === 'acquire') {
  const held = read()
  if (held && ageMin(held) < STALE_MIN && !rest.includes('--force')) {
    console.error(`LOCKED by pid ${held.pid} for ${ageMin(held)} min — ${held.reason}`)
    console.error('Wait, or take it with --force if you are certain the holder is gone.')
    process.exit(1)
  }
  if (held) console.error(`(taking a ${ageMin(held)} min old lock from pid ${held.pid})`)
  fs.writeFileSync(LOCK, JSON.stringify({
    pid: process.ppid, acquiredAt: new Date().toISOString(),
    reason: rest.filter(a => a !== '--force').join(' ') || 'unstated',
  }, null, 2) + '\n')
  console.log('lock acquired')
} else if (cmd === 'release') {
  fs.rmSync(LOCK, { force: true })
  console.log('lock released')
} else {
  const l = read()
  console.log(l ? `LOCKED ${ageMin(l)} min by pid ${l.pid} — ${l.reason}` : 'unlocked')
  process.exit(l && ageMin(l) < STALE_MIN ? 1 : 0)
}
