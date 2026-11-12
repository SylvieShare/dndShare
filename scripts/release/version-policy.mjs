export const parts = ['backend', 'frontend', 'android']
export function compareVersion(left, right) {
  const a = left.split('.').map(Number), b = right.split('.').map(Number)
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return Math.sign(a[index] - b[index])
  return 0
}
export function bumpVersions(input, hashes, force) {
  const versions = structuredClone(input)
  const changed = parts.filter(part => hashes[part] !== versions.fingerprints[part] || force === part)
  for (const part of changed) {
    if (versions.fingerprints[part]) {
      const pieces = versions[part].version.split('.').map(Number)
      pieces[2]++
      versions[part].version = pieces.join('.')
      versions[part].build++
    }
    versions.fingerprints[part] = hashes[part]
  }
  return { versions, changed }
}
export function verifyEvolution(current, previous) {
  if (!previous) return
  for (const part of parts) {
    if (current[part].build < previous[part].build || compareVersion(current[part].version, previous[part].version) < 0) throw new Error(`${part} version moved backwards`)
    if (current.fingerprints[part] !== previous.fingerprints[part] || current[part].version !== previous[part].version) {
      if (current[part].build <= previous[part].build || compareVersion(current[part].version, previous[part].version) <= 0) throw new Error(`${part} changed without a new release version and build`)
    }
  }
}
