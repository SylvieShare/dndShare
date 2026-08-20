import { ref } from 'vue'
import { charactersApi } from '@/shared/api/charactersApi'
import { pvHp, pvHpPath } from '@/features/sessions/lib/participantView'
import { useDiceStore } from '@/stores/dice'

export function useEncounterHp({
  getCombatant,
  mutate,
  canEditPlayers,
  findParticipant,
  applyLocalPatches,
  getPlayerHp,
  getPlayerAc,
  npcName,
  npcAc,
  npcHpMax,
  npcHpFormula: resolveNpcHpFormula,
}) {
  const hpCalcNpc = ref(null)
  const hpEditNpc = ref(null)
  const hpCalcPlayer = ref(null)

  function displayAc(c) {
    if (c.type === 'player') return getPlayerAc(c.charId) ?? '—'
    return npcAc(c) ?? '—'
  }

  function hpParts(c) {
    if (c.type === 'player') {
      const hp = getPlayerHp(c.charId) ?? { current: 0, max: 0, temp: 0 }
      return { current: hp.current, max: hp.max, temp: hp.temp }
    }
    const max = npcHpMax(c)
    return { current: c.hpCurrent ?? max ?? 0, max, temp: c.hpTemp ?? 0 }
  }

  function hpPercent(c) {
    const { current, max } = hpParts(c)
    if (!max) return 100
    return Math.min(100, Math.max(0, (current / max) * 100))
  }

  function hpTempPercent(c) {
    const { max, temp } = hpParts(c)
    if (!max || !temp) return 0
    return Math.min(100 - hpPercent(c), (temp / max) * 100)
  }

  function hpColor(c) {
    const pct = hpPercent(c)
    if (pct > 50) return 'var(--success)'
    if (pct > 25) return 'var(--warning)'
    return 'var(--danger)'
  }

  function hpLabel(c) {
    if (c.type === 'player') {
      const hp = getPlayerHp(c.charId)
      if (!hp) return '—'
      return `${hp.current}/${hp.max}`
    }
    return `${c.hpCurrent ?? '?'}/${npcHpMax(c) || '?'}`
  }

  function playerHpLabel(c) {
    const hp = getPlayerHp(c.charId)
    if (!hp) return ''
    return `${hp.current}/${hp.max}`
  }

  function hpTempValue(c) {
    return hpParts(c).temp
  }

  function npcHpObj(c) {
    return { current: c.hpCurrent ?? 0, max: npcHpMax(c), temp: c.hpTemp ?? 0, hitDice: [] }
  }

  function playerHpObj(c) {
    const p = findParticipant(c.charId)
    return (p && pvHp(p)) || {
      current: 0, max: 0, temp: 0, hitDice: [], ds_success: 0, ds_failure: 0,
    }
  }

  function npcDsHp(c) {
    return {
      current: c.hpCurrent ?? 0,
      max: npcHpMax(c),
      temp: c.hpTemp ?? 0,
      ds_success: c.hpDsSuccess ?? 0,
      ds_failure: c.hpDsFailure ?? 0,
    }
  }

  function playerDsHp(c) {
    const p = findParticipant(c.charId)
    const v = (p && pvHp(p)) || {}
    return {
      current: Number(v.current) || 0,
      max: Number(v.max) || 0,
      temp: Number(v.temp) || 0,
      ds_success: Number(v.ds_success) || 0,
      ds_failure: Number(v.ds_failure) || 0,
    }
  }

  function canEditPlayerHp() {
    return canEditPlayers ? !!canEditPlayers.value : false
  }

  function openHpCalc(c) {
    if (c.type === 'npc') {
      hpCalcNpc.value = c
      return
    }
    if (!canEditPlayerHp()) return
    const p = findParticipant(c.charId)
    if (!p) return
    hpCalcPlayer.value = c
  }

  function closeHpCalc() {
    hpCalcNpc.value = null
  }

  function closeHpCalcPlayer() {
    hpCalcPlayer.value = null
  }

  function openNpcHpEdit(c) {
    if (c.type !== 'npc') return
    hpEditNpc.value = c
  }

  function closeNpcHpEdit() {
    hpEditNpc.value = null
  }

  function setNpcHpField(field, value) {
    if (!hpEditNpc.value) return
    const v = Math.max(0, Number(value) || 0)
    mutate(() => {
      const t = getCombatant(hpEditNpc.value.uid)
      if (!t) return
      if (field === 'current') t.hpCurrent = v
      else if (field === 'max') { t.override = { ...(t.override || {}), hp: v } }
      else if (field === 'temp') t.hpTemp = v
    })
  }

  function onNpcHpChange(hp) {
    mutate(() => {
      const t = getCombatant(hpCalcNpc.value.uid)
      if (!t) return
      t.hpCurrent = hp.current
      t.override = { ...(t.override || {}), hp: hp.max }
      t.hpTemp = hp.temp ?? 0
    })
  }

  function onNpcDsChange(c, hp) {
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      t.hpCurrent = Number(hp.current) || 0
      t.hpDsSuccess = Number(hp.ds_success) || 0
      t.hpDsFailure = Number(hp.ds_failure) || 0
    })
  }

  async function onPlayerHpChange(hp) {
    const c = hpCalcPlayer.value
    if (!c) return
    const p = findParticipant(c.charId)
    if (!p) return
    const hpPath = pvHpPath(p)
    if (!hpPath) return
    const updates = [
      { path: `${hpPath}.current`,    value: Number(hp.current) || 0 },
      { path: `${hpPath}.max`,        value: Number(hp.max) || 0 },
      { path: `${hpPath}.temp`,       value: Number(hp.temp) || 0 },
      { path: `${hpPath}.hitDice`,    value: Array.isArray(hp.hitDice) ? hp.hitDice : [] },
      { path: `${hpPath}.ds_success`, value: Number(hp.ds_success) || 0 },
      { path: `${hpPath}.ds_failure`, value: Number(hp.ds_failure) || 0 },
    ]
    applyLocalPatches(c.charId, updates)
    await charactersApi.patchData(p.charUuid, updates)
  }

  async function onPlayerDsChange(c, hp) {
    const p = findParticipant(c.charId)
    if (!p) return
    const hpPath = pvHpPath(p)
    if (!hpPath) return
    const updates = [
      { path: `${hpPath}.current`,    value: Number(hp.current) || 0 },
      { path: `${hpPath}.ds_success`, value: Number(hp.ds_success) || 0 },
      { path: `${hpPath}.ds_failure`, value: Number(hp.ds_failure) || 0 },
    ]
    applyLocalPatches(c.charId, updates)
    await charactersApi.patchData(p.charUuid, updates)
  }

  async function revivePlayer(c, hpAmount) {
    const p = findParticipant(c.charId)
    if (!p) throw new Error('Игрок не найден')
    const hpPath = pvHpPath(p)
    if (!hpPath) throw new Error('У персонажа нет блока HP')
    const updates = [
      { path: `${hpPath}.current`,    value: Math.max(1, Math.floor(Number(hpAmount) || 1)) },
      { path: `${hpPath}.ds_success`, value: 0 },
      { path: `${hpPath}.ds_failure`, value: 0 },
    ]
    await charactersApi.patchData(p.charUuid, updates)
    applyLocalPatches(c.charId, updates)
  }

  function npcHpFormula(c) {
    return resolveNpcHpFormula ? resolveNpcHpFormula(c) : ''
  }

  function rollNpcHpFromFormula(c) {
    const raw = npcHpFormula(c)
    if (!raw) return
    const norm = raw.replace(/[()]/g, '')
    const result = useDiceStore().roll('Хиты', norm, {
      actor: { name: npcName ? npcName(c) : 'НПС', charUuid: null },
    })
    if (!result || !result.parts.length) return
    const val = Math.max(1, result.total)
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      t.override = { ...(t.override || {}), hp: val }
      t.hpCurrent = val
      t.hpTemp = 0
      t.hpDsSuccess = 0
      t.hpDsFailure = 0
    })
  }

  return {
    hpCalcNpc,
    hpEditNpc,
    hpCalcPlayer,
    displayAc,
    hpParts,
    hpPercent,
    hpTempPercent,
    hpColor,
    hpLabel,
    playerHpLabel,
    hpTempValue,
    npcHpObj,
    playerHpObj,
    npcDsHp,
    playerDsHp,
    canEditPlayerHp,
    openHpCalc,
    closeHpCalc,
    closeHpCalcPlayer,
    openNpcHpEdit,
    closeNpcHpEdit,
    setNpcHpField,
    onNpcHpChange,
    onNpcDsChange,
    onPlayerHpChange,
    onPlayerDsChange,
    revivePlayer,
    npcHpFormula,
    rollNpcHpFromFormula,
  }
}
