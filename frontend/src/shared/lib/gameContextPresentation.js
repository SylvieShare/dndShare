export function gameContextPresentation(source, version) {
  const name = source?.name || 'Игровая система'
  const edition = String(version?.version || '')
  const system = name.toLowerCase()

  if (system === 'dnd5e') {
    return {
      name: 'D&D 5e',
      detail: edition ? `Редакция ${edition}` : 'Dungeons & Dragons',
      emblem: edition === '2024' ? 'dnd-revised' : 'dnd-classic',
    }
  }
  if (system === 'vampire: tm') {
    return {
      name: 'Vampire',
      detail: ['The Masquerade', edition].filter(Boolean).join(' · '),
      emblem: 'vampire',
    }
  }
  return { name, detail: edition ? `Редакция ${edition}` : 'Выберите систему и редакцию', emblem: 'generic' }
}

export function gameContextOptions(sources) {
  return sources.flatMap(source => (source.versions || []).map(version => ({
    id: version.id,
    ...gameContextPresentation(source, version),
  })))
}
