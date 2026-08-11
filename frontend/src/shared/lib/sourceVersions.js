export function sourceVersions(source) {
  return Array.isArray(source?.versions) ? source.versions : []
}

export function sourceVersionLabel(source) {
  return sourceVersions(source).map((item) => item.version).filter(Boolean).join(' · ')
}

export function findSourceVersion(source, version) {
  return sourceVersions(source).find((item) => String(item.version) === String(version)) || null
}
