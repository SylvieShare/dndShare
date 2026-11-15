export const DEFAULT_RESERVE_ID = 'default'
export const DEFAULT_RESERVE = Object.freeze({ id: DEFAULT_RESERVE_ID, name: 'Запас', permanent: true })

export function encounterReserveTabs(encounter) {
  const ids = new Set([DEFAULT_RESERVE_ID])
  const tabs = [DEFAULT_RESERVE]
  for (const tab of Array.isArray(encounter?.reserveTabs) ? encounter.reserveTabs : []) {
    if (typeof tab?.id !== 'string' || !tab.id || ids.has(tab.id) || typeof tab.name !== 'string' || !tab.name.trim()) continue
    ids.add(tab.id)
    tabs.push({ id: tab.id, name: tab.name.trim(), permanent: false })
  }
  return tabs
}

export function reserveAssignment(id) {
  return id && id !== DEFAULT_RESERVE_ID ? { reserveTabId: id } : {}
}

export function createEncounterReserve(encounter, id, name) {
  const title = String(name || '').trim().slice(0, 255)
  if (!id || id === DEFAULT_RESERVE_ID || !title || encounterReserveTabs(encounter).some(tab => tab.id === id)) return encounter
  return { ...encounter, reserveTabs: [...(encounter.reserveTabs || []), { id, name: title }] }
}

export function renameEncounterReserve(encounter, id, name) {
  const title = String(name || '').trim().slice(0, 255)
  if (id === DEFAULT_RESERVE_ID || !title || !encounterReserveTabs(encounter).some(tab => tab.id === id)) return encounter
  return { ...encounter, reserveTabs: encounter.reserveTabs.map(tab => tab.id === id ? { ...tab, name: title } : tab) }
}

export function removeEncounterReserve(encounter, id) {
  if (id === DEFAULT_RESERVE_ID || !encounterReserveTabs(encounter).some(tab => tab.id === id)) return encounter
  return {
    ...encounter,
    reserveTabs: encounter.reserveTabs.filter(tab => tab.id !== id),
    combatants: encounter.combatants.map(combatant => {
      if (combatant.type !== 'npc' || combatant.reserveTabId !== id) return combatant
      const next = { ...combatant }
      delete next.reserveTabId
      return next
    }),
  }
}
