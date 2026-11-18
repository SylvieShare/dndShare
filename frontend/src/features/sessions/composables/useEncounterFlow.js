import { SIDE_COLOR, matchesGroup, nextTieBreak, setCombatantLetter } from '@/features/sessions/lib/encounterHelpers'

export function useEncounterFlow({
  encounter,
  getCombatant,
  mutate,
  inCombat,
  sceneRows = inCombat,
  turnOrder,
  selectedUids,
  unselect,
  rollInitiativeFor,
  reserveTabMatches,
  onReserveDrop,
}) {
  function setInitiative(c, val) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.initiative = val == null || String(val).trim() === '' || !Number.isFinite(Number(val)) ? null : Number(val)
    })
  }

  function toggleSurprised(c) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.surprised = !t.surprised
    })
  }

  function rollCombatantInitiative(c) {
    if (encounter.value.active || !c || c.position === 'dead') return
    setInitiative(c, rollInitiativeFor(c))
  }

  function toggleSide(c) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.side = t.side === 'enemy' ? 'ally' : 'enemy'
    })
  }

  function setSide(c, side) {
    if (side != null && side !== '' && !SIDE_COLOR[side]) return
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      if (side) t.side = side
      else delete t.side
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

  function setMarkerLetter(c, letter) {
    mutate(() => setCombatantLetter(encounter.value.combatants, c.uid, letter))
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
          c.initiative = null
          c.surprised = false
        }
      })
      encounter.value = { ...encounter.value, active: false, round: 0, turnIndex: 0 }
    } else {
      if(!inCombat.value.length)return
      mutate(() => {
        let tb = nextTieBreak(encounter.value.combatants)
        for (const c of encounter.value.combatants) {
          if (c.position !== 'combat') continue
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
    if (c.position === 'dead') return false
    if (group === 'combat') return c.position !== 'combat'
    if (group === 'dead') return true
    if (group === 'reserve') return c.position !== 'reserve'
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

  function sendCombatantsTo(combatants, group) {
    const targetIds = new Set((combatants || []).map(combatant => combatant?.uid).filter(Boolean))
    if (!targetIds.size) return
    const turn = group === 'dead' ? captureTurn() : null
    mutate(() => {
      let tb = nextTieBreak(encounter.value.combatants)
      for (const c of encounter.value.combatants) {
        if (!targetIds.has(c.uid)) continue
        if (!willMoveToGroup(c, group)) continue
        if (group === 'combat') {
          c.position = 'combat'
          if (c.initiative == null && encounter.value.active) c.initiative = rollInitiativeFor(c)
          c.tieBreak = tb++
        } else if (group === 'dead') {
          if (c.position === 'combat') c.defeatedOnScene = true
          else c.initiative = null
          c.position = 'dead'
          c.surprised = false
        } else {
          c.position = 'reserve'
          c.initiative = null
          c.surprised = false
        }
      }
      restoreTurn(turn)
    })
    if (group === 'dead') for (const uid of targetIds) unselect(uid)
  }

  function sendSelectedTo(group) {
    sendCombatantsTo(
      encounter.value.combatants.filter(combatant => selectedUids.value.has(combatant.uid)),
      group,
    )
  }

  function markDefeated(c) {
    sendCombatantsTo([c], 'dead')
  }

  function sendToReserve(c) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t?.position !== 'combat') return
      t.position = 'reserve'
      t.initiative = null
      t.surprised = false
    })
  }

  function reviveCombatant(c, hpAmount) {
    const turn = captureTurn()
    const revivedHp = Math.max(1, Math.floor(Number(hpAmount) || 1))
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      if (t.position === 'dead') {
        t.position = t.defeatedOnScene ? 'combat' : 'reserve'
        delete t.defeatedOnScene
      }
      if (t.type === 'npc') {
        t.hpCurrent = revivedHp
        t.hpDsSuccess = 0
        t.hpDsFailure = 0
      }
      restoreTurn(turn)
    })
  }

  function captureTurn() {
    if (!encounter.value.active || !turnOrder?.value.length) return null
    const order = turnOrder.value.map(row => row.uid)
    const index = encounter.value.turnIndex % order.length
    return [...order.slice(index), ...order.slice(0, index)]
  }

  function restoreTurn(turn) {
    if (!turn) return
    const indices = new Map(turnOrder.value.map((row, index) => [row.uid, index]))
    const current = turn.find(uid => indices.has(uid))
    encounter.value.turnIndex = indices.get(current) ?? 0
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

  function performSortDrop({ item, fromGroup, toGroup, toIndex }) {
    if (item.position === 'dead') return
    let newCombatOrder = null
    if (toGroup === 'combat' && encounter.value.active) {
      const filtered = sceneRows.value.filter(c => c.uid !== item.uid)
      newCombatOrder = [...filtered.slice(0, toIndex), item, ...filtered.slice(toIndex)]
    }

    mutate(() => {
      const t = getCombatant(item.uid)
      if (!t) return
      const newPos = toGroup === 'combat' ? 'combat' : (fromGroup === 'reserve-npc' && toGroup === 'reserve-npc' ? t.position : 'reserve')
      t.position = newPos
      if (toGroup === 'reserve-npc' && t.type === 'npc') onReserveDrop?.(t)

      const arr = encounter.value.combatants
      const srcIdx = arr.findIndex(c => c.uid === item.uid)
      if (srcIdx !== -1) {
        const [moved] = arr.splice(srcIdx, 1)
        const groupList = arr.filter(c => matchesGroup(c, toGroup) && (toGroup !== 'reserve-npc' || !reserveTabMatches || reserveTabMatches(c)))
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
    rollCombatantInitiative,
    toggleSurprised,
    toggleSide,
    setSide,
    setIconColor,
    setMarkerLetter,
    rerollSelectedInitiative,
    toggleCombat,
    nextTurn,
    prevTurn,
    willMoveToGroup,
    selectedToMoveTo,
    sendCombatantsTo,
    sendSelectedTo,
    sendToReserve,
    markDefeated,
    reviveCombatant,
    performSortDrop,
  }
}
