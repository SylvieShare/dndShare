const DND_EFFECT_ITEM_TYPE_ID = 15

export function useEncounterStates({
  getCombatant,
  mutate,
}) {
  function statesBlock(c) {
    // Player effects are source-owned runtime instances and remain edited on
    // the character sheet. NPC encounter effects store catalogue item ids.
    if (c.type === 'player') return null
    return {
      id: 'npc-states',
      title: 'состояние',
      content: { item_type_id: DND_EFFECT_ITEM_TYPE_ID, variant: 'compact' },
      props: {},
    }
  }

  function statesValue(c) {
    if (c.type === 'player') return []
    return Array.isArray(c.states) ? c.states : []
  }

  function setStates(c, ids) {
    const list = Array.isArray(ids) ? ids : []
    if (c.type === 'player') return
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.states = list
    })
  }

  function setNote(c, text) {
    const value = (text ?? '').toString()
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      if (value) t.note = value
      else delete t.note
    })
  }

  return {
    statesBlock,
    statesValue,
    setStates,
    setNote,
  }
}
