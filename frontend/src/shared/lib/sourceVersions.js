export function sourceVersions(source) {
  if (Array.isArray(source?.versions)) return source.versions
  return source?.version ? [{ id: null, sourceId: source.id, version: source.version }] : []
}

export function sourceVersionLabel(source) {
  return sourceVersions(source).map((item) => item.version).filter(Boolean).join(' · ')
}

export function findSourceVersion(source, version) {
  return sourceVersions(source).find((item) => String(item.version) === String(version)) || null
}
