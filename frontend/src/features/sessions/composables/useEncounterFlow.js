import { SIDE_COLOR, matchesGroup, nextTieBreak } from '@/features/sessions/lib/encounterHelpers'

export function useEncounterFlow({
  encounter,
  getCombatant,
  mutate,
  inCombat,
  turnOrder,
  selectedUids,
  unselect,
  rollInitiativeFor,
  npcHpMax,
}) {
  function setInitiative(c, val) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.initiative = val === '' ? null : Number(val)
    })
  }

  function toggleSurprised(c) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.surprised = !t.surprised
    })
  }

  function toggleSide(c) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.side = t.side === 'enemy' ? 'ally' : 'enemy'
    })
  }

  function setSide(c, side) {
    if (!SIDE_COLOR[side]) return
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.side = side
    })
  }

  function setIconColor(c, color) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      if (color) t.iconColor = color
      else delete t.iconColor
    })
  }

  function rerollSelectedInitiative() {
    const ids = selectedUids.value
    if (!ids.size) return
    mutate(() => {
      for (const c of encounter.value.combatants) {
        if (!ids.has(c.uid)) continue
        if (c.position === 'dead') continue
        c.initiative = rollInitiativeFor(c)
      }
    })
    encounter.value = { ...encounter.value, turnIndex: 0 }
  }

  function toggleCombat() {
    if (encounter.value.active) {
      mutate(() => {
        for (const c of encounter.value.combatants) {
          if (c.position === 'combat') c.position = 'reserve'
          c.initiative = null
          c.surprised = false
        }
      })
      encounter.value = { ...encounter.value, active: false, round: 0, turnIndex: 0 }
    } else {
      mutate(() => {
        let tb = nextTieBreak(encounter.value.combatants)
        for (const c of encounter.value.combatants) {
          if (!selectedUids.value.has(c.uid)) continue
          if (c.position === 'dead') continue
          c.position = 'combat'
          if (c.initiative == null) c.initiative = rollInitiativeFor(c)
          c.tieBreak = tb++
        }
      })
      const hasSurprised = encounter.value.combatants.some(c => c.surprised && c.position === 'combat')
      encounter.value = { ...encounter.value, active: true, round: hasSurprised ? 0 : 1, turnIndex: 0 }
    }
  }

  function willMoveToGroup(c, group) {
    if (group === 'combat') {
      if (c.position === 'combat') return false
      if (c.position === 'dead') return false
      return true
    }
    if (group === 'dead') return c.position !== 'dead'
    if (group === 'reserve-npc') return c.type === 'npc' && c.position !== 'reserve'
    if (group === 'reserve-player') return c.type === 'player' && c.position !== 'reserve'
    return false
  }

  function selectedToMoveTo(group) {
    let n = 0
    for (const c of encounter.value.combatants) {
      if (!selectedUids.value.has(c.uid)) continue
      if (willMoveToGroup(c, group)) n++
    }
    return n
  }

  function sendSelectedTo(group) {
    const targetIds = [...selectedUids.value]
    if (!targetIds.length) return
    mutate(() => {
      let tb = nextTieBreak(encounter.value.combatants)
      for (const c of encounter.value.combatants) {
        if (!targetIds.includes(c.uid)) continue
        if (!willMoveToGroup(c, group)) continue
        if (group === 'combat') {
          c.position = 'combat'
          if (c.initiative == null && encounter.value.active) c.initiative = rollInitiativeFor(c)
          c.tieBreak = tb++
        } else if (group === 'dead') {
          c.position = 'dead'
          c.initiative = null
        } else {
          c.position = 'reserve'
          c.initiative = null
        }
      }
    })
  }

  function sendToGraveyard(c) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      t.position = 'dead'
      t.initiative = null
    })
    unselect(c.uid)
  }

  function reviveCombatant(c) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      if (t.position === 'dead') t.position = 'reserve'
      if (t.type === 'npc') {
        if (!t.hpCurrent || t.hpCurrent <= 0) {
          const max = npcHpMax ? npcHpMax(t) : 0
          t.hpCurrent = Math.max(1, Number(max) || 1)
        }
        t.hpDsSuccess = 0
        t.hpDsFailure = 0
      }
    })
  }

  function turnCount() {
    return (turnOrder?.value?.length) ?? inCombat.value.length
  }

  function nextTurn() {
    const n = turnCount()
    if (!n) return
    const next = (encounter.value.turnIndex + 1) % n
    encounter.value = {
      ...encounter.value,
      turnIndex: next,
      round: next === 0 ? encounter.value.round + 1 : encounter.value.round,
    }
  }

  function prevTurn() {
    const n = turnCount()
    if (!n) return
    const prev = (encounter.value.turnIndex - 1 + n) % n
    encounter.value = {
      ...encounter.value,
      turnIndex: prev,
      round: encounter.value.turnIndex === 0 && encounter.value.round > 1
        ? encounter.value.round - 1
        : encounter.value.round,
    }
  }

  function performSortDrop({ item, toGroup, toIndex }) {
    let newCombatOrder = null
    if (toGroup === 'combat' && encounter.value.active) {
      const filtered = inCombat.value.filter(c => c.uid !== item.uid)
      newCombatOrder = [...filtered.slice(0, toIndex), item, ...filtered.slice(toIndex)]
    }

    mutate(() => {
      const t = getCombatant(item.uid)
      if (!t) return
      const newPos = toGroup === 'combat' ? 'combat' : (toGroup === 'dead' ? 'dead' : 'reserve')
      t.position = newPos
      if (newPos === 'dead') t.initiative = null

      const arr = encounter.value.combatants
      const srcIdx = arr.findIndex(c => c.uid === item.uid)
      if (srcIdx !== -1) {
        const [moved] = arr.splice(srcIdx, 1)
        const groupList = arr.filter(c => matchesGroup(c, toGroup))
        let insertAt
        if (toIndex >= groupList.length) {
          insertAt = groupList.length === 0 ? arr.length : arr.indexOf(groupList[groupList.length - 1]) + 1
        } else {
          insertAt = arr.indexOf(groupList[toIndex])
        }
        arr.splice(insertAt, 0, moved)
      }

      if (newCombatOrder) {
        const tierCount = new Map()
        newCombatOrder.forEach(c => {
          const k = c.initiative ?? '∅'
          const pos = tierCount.get(k) ?? 0
          tierCount.set(k, pos + 1)
          const target = getCombatant(c.uid)
          if (target) target.tieBreak = pos
        })
      }
    })
  }

  return {
    setInitiative,
    toggleSurprised,
    toggleSide,
    setSide,
    setIconColor,
    rerollSelectedInitiative,
    toggleCombat,
    nextTurn,
    prevTurn,
    willMoveToGroup,
    selectedToMoveTo,
    sendSelectedTo,
    sendToGraveyard,
    reviveCombatant,
    performSortDrop,
  }
}
