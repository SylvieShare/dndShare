import { ref } from 'vue'
import { makeUid, nextTieBreak } from '@/features/sessions/lib/encounterHelpers'
import { parseDiceExpression } from '@/shared/lib/dice'

function averageFromFormula(raw) {
  const formula = String(raw || '').replace(/[()]/g, '')
  if (!formula) return 0
  const tokens = parseDiceExpression(formula)
  let total = 0
  for (const t of tokens) {
    const mult = t.sign === '-' ? -1 : 1
    if (t.kind === 'dice') total += mult * Math.floor(t.n * (t.sides + 1) / 2)
    else if (t.kind === 'flat') total += mult * t.value
  }
  return Math.max(0, total)
}

function resolveStartHp(item) {
  const combat = item?.data?.combat || {}
  const raw = Number(combat.hp ?? item?.data?.hp)
  if (Number.isFinite(raw) && raw > 0) return { hp: raw, fromFormula: false }
  const avg = averageFromFormula(combat.hp_formula ?? item?.data?.hp_formula)
  if (avg > 0) return { hp: avg, fromFormula: true }
  return { hp: 1, fromFormula: true }
}

export function useEncounterNpcs({ encounter, unselect, pruneToExisting, selectedUids, cacheItem }) {
  const showNpcPicker = ref(false)
  const showSimpleForm = ref(false)
  const detailNpc = ref(null)

  function openNpcDetail(c) {
    detailNpc.value = c
  }

  function closeNpcDetail() {
    detailNpc.value = null
  }

  function addNpc(item, count = 1) {
    const n = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)))
    cacheItem?.(item)
    const { hp: hpVal, fromFormula } = resolveStartHp(item)
    let tb = nextTieBreak(encounter.value.combatants)
    const additions = []
    for (let i = 0; i < n; i++) {
      additions.push({
        uid: makeUid(),
        type: 'npc',
        itemId: item.id,
        override: fromFormula ? { hp: hpVal } : {},
        side: 'enemy',
        position: 'reserve',
        initiative: null,
        hpCurrent: hpVal,
        hpTemp: 0,
        hpDsSuccess: 0,
        hpDsFailure: 0,
        surprised: false,
        tieBreak: tb++,
      })
    }
    encounter.value = {
      ...encounter.value,
      combatants: [...encounter.value.combatants, ...additions],
    }
  }

  function addSimpleNpc(form) {
    const name = String(form?.name ?? '').trim() || 'Существо'
    const hpMax = Math.max(0, Math.floor(Number(form?.hpMax) || 0))
    const hpCur = Math.max(0, Math.floor(Number(form?.hp ?? form?.hpMax) || 0))
    const override = { name }
    if (form?.ac != null && form.ac !== '') override.ac = Math.max(0, Math.floor(Number(form.ac) || 0))
    if (hpMax || hpCur) override.hp = hpMax || hpCur
    const desc = String(form?.description ?? '').trim()
    if (desc) override.description = desc
    const combatant = {
      uid: makeUid(),
      type: 'npc',
      itemId: null,
      override,
      side: 'enemy',
      position: 'reserve',
      initiative: null,
      hpCurrent: hpCur || hpMax,
      hpTemp: 0,
      hpDsSuccess: 0,
      hpDsFailure: 0,
      surprised: false,
      tieBreak: nextTieBreak(encounter.value.combatants),
    }
    encounter.value = {
      ...encounter.value,
      combatants: [...encounter.value.combatants, combatant],
    }
  }

  function cloneNpc(c, count = 1) {
    if (c.type !== 'npc') return
    const n = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)))
    const additions = []
    let tb = nextTieBreak(encounter.value.combatants)
    for (let i = 0; i < n; i++) {
      const copy = {
        ...JSON.parse(JSON.stringify(c)),
        uid: makeUid(),
        position: 'reserve',
        initiative: null,
        surprised: false,
        hpDsSuccess: 0,
        hpDsFailure: 0,
        tieBreak: tb++,
      }
      additions.push(copy)
    }
    encounter.value = {
      ...encounter.value,
      combatants: [...encounter.value.combatants, ...additions],
    }
  }

  function removeNpc(c) {
    encounter.value = {
      ...encounter.value,
      combatants: encounter.value.combatants.filter(x => x.uid !== c.uid),
    }
    unselect(c.uid)
  }

  function removeSelectedNpcs() {
    const ids = selectedUids.value
    if (!ids.size) return
    encounter.value = {
      ...encounter.value,
      combatants: encounter.value.combatants.filter(x => !(x.type === 'npc' && ids.has(x.uid))),
    }
    pruneToExisting()
  }

  function removeAllDeadNpcs() {
    encounter.value = {
      ...encounter.value,
      combatants: encounter.value.combatants.filter(x => !(x.type === 'npc' && x.position === 'dead')),
    }
    pruneToExisting()
  }

  return {
    showNpcPicker,
    showSimpleForm,
    detailNpc,
    openNpcDetail,
    closeNpcDetail,
    addNpc,
    addSimpleNpc,
    cloneNpc,
    removeNpc,
    removeSelectedNpcs,
    removeAllDeadNpcs,
  }
}
