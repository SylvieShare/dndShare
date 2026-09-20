export function gameContextPresentation(source, version) {
  const name = source?.name || 'Игровая система'
  const edition = String(version?.version || '')
  const system = name.toLowerCase()

  if (system === 'dnd5e') {
    return {
      name: 'D&D 5e',
      edition,
      emblem: 'dnd',
    }
  }
  if (system === 'vampire: tm') {
    return {
      name: 'Vampire',
      edition,
      emblem: 'vampire',
    }
  }
  return { name, edition, emblem: 'generic' }
}

export function gameContextOptions(sources) {
  return sources.flatMap(source => (source.versions || []).map(version => ({
    id: version.id,
    ...gameContextPresentation(source, version),
  })))
}
