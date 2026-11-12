import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fingerprints, readVersions, root } from './metadata.mjs'
import { bumpVersions, verifyEvolution } from './version-policy.mjs'

const versions = readVersions()
const current = fingerprints(versions)
const changed = Object.keys(current).filter(part => current[part] !== versions.fingerprints[part])
if (process.argv.includes('--bump')) {
  const force = process.argv.find(value => value.startsWith('--force='))?.slice(8)
  if (force && !['frontend', 'backend', 'android'].includes(force)) throw new Error('Unknown component')
  const result = bumpVersions(versions, current, force)
  fs.writeFileSync(path.join(root, 'release/versions.json'), JSON.stringify(result.versions, null, 2) + '\n')
  console.log(result.changed.length ? `Versions recorded: ${result.changed.join(', ')}` : 'Versions already match source inputs.')
} else {
  if (changed.length) throw new Error(`Changed release inputs: ${changed.join(', ')}. Run node scripts/release/versions.mjs --bump before committing.`)
  let previous
  try { previous = execFileSync('git', ['show', 'HEAD^:release/versions.json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { /* first versioned release */ }
  if (previous) verifyEvolution(versions, JSON.parse(previous))
  console.log('Component versions match release inputs.')
}
