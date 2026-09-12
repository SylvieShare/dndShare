import { createSpellbookKey, spellTab, normalizedClassItemId } from '../lib/spellbook'
import { spellcastingRulesAt } from '../lib/spellcastingRules'
import { computeSpellSlotPools } from '../lib/multiclassSpellcasting'
import { itemsApi } from '@/shared/api/itemsApi'

export function useSpellbookTabs({ props, charCtx, tabs, grants, activeTab, activeSpellTab, tabEditorOpen, classItemMap, deleteTarget, automaticSlots, replaceTotals, emitChange, profBonus, statOptions }) {
  function updateActiveTab(field, value) {
    if (!activeTab.value) return
    activeTab.value[field] = value
    emitChange()
  }

  function createTab() {
    const tab = spellTab({ key: createSpellbookKey('tab'), name: 'Магия' })
    tabs.value.push(tab)
    activeSpellTab.value = tab.key
    tabEditorOpen.value = true
    emitChange()
  }

  function setActiveTabClass(value) {
    if (!activeTab.value) return
    const classItemId = normalizedClassItemId(value)
    if (classItemId != null && tabs.value.some((tab) => (
      tab.key !== activeTab.value.key && normalizedClassItemId(tab.class_item_id) === classItemId
    ))) return
    activeTab.value.class_item_id = classItemId
    if (classItemId != null) {
      const item = classItemMap[classItemId]
      const classEntry = (props.values?.classes || []).find((entry) => normalizedClassItemId(entry.id) === classItemId)
      const subclass = classEntry?.subclass?.id != null ? classItemMap[classEntry.subclass.id] : null
      const rules = spellcastingRulesAt(subclass, Number(classEntry?.level) || 1)
        || spellcastingRulesAt(item, Number(classEntry?.level) || 1)
      if (item?.name) activeTab.value.name = item.name
      if (rules?.ability != null) activeTab.value.casting_ability = rules.ability
      activeTab.value.mode = rules?.selectionMode || (rules?.prepares ? 'prepared' : 'known')
    }
    emitChange()
  }

  function deleteTab() {
    const target = deleteTarget.value
    if (!target) return
    tabs.value = tabs.value.filter((tab) => tab.key !== target.key)
    for (const grant of grants.value) if (grant.tab_key === target.key) delete grant.tab_key
    deleteTarget.value = null
    tabEditorOpen.value = false
    activeSpellTab.value = tabs.value[0]?.key || ''
    emitChange()
  }

  function setAutomaticSlots(value) {
    automaticSlots.value = !!value
    if (automaticSlots.value) syncAutomaticSlotPools(true)
    else emitChange()
  }

  function syncAutomaticSlotPools(forceEmit = false) {
    if (!automaticSlots.value) return
    const entries = Array.isArray(props.values?.classes) ? props.values.classes : []
    const requiredIds = entries.flatMap((entry) => [entry?.id, entry?.subclass?.id]).filter((id) => id != null)
    if (requiredIds.some((id) => !classItemMap[id])) {
      if (forceEmit) emitChange()
      return
    }
    const pools = computeSpellSlotPools(entries, classItemMap)
    if (!pools.isCaster) {
      let cleared = replaceTotals('long_rest', [])
      cleared = replaceTotals('short_rest', []) || cleared
      if (cleared || forceEmit) emitChange()
      return
    }
    let changed = replaceTotals('long_rest', pools.totals)
    const shortTotals = Array(9).fill(0)
    if (pools.pact) shortTotals[pools.pact.slotLevel - 1] = pools.pact.count
    changed = replaceTotals('short_rest', shortTotals) || changed
    if (changed || forceEmit) emitChange()
  }

  function spellTabForEntry(entry) {
    if (entry?.ref?.source) return tabs.value.find((tab) => tab.key === entry.ref.tab_key) || null
    return activeTab.value
  }

  function spellCanPrepare(entry) {
    return !entry?.ref?.source && ['prepared', 'spellbook'].includes(spellTabForEntry(entry)?.mode)
  }

  function setSpellcastingSource(entry, key) {
    if (!charCtx.ownerMode) return
    const from = activeTab.value
    const target = tabs.value.find((tab) => tab.key === key)
    if (!from || !target || from.key === target.key) return
    if (target.spells.some((candidate) => String(candidate.id) === String(entry.ref.id))) return
    from.spells = from.spells.filter((candidate) => candidate.key !== entry.ref.key)
    target.spells.push(entry.ref)
    emitChange()
  }

  function spellCastingAbility(entry) {
    if (entry?.ref?.casting_ability != null) return entry.ref.casting_ability
    return spellTabForEntry(entry)?.casting_ability ?? ''
  }

  function statModifierForAbility(ability) {
    if (ability == null || ability === '') return 0
    const stats = props.values?.stats || charCtx.var?.stats || {}
    return Number(stats[String(ability)] ?? 0)
  }

  function spellStatModifier(entry) {
    return statModifierForAbility(spellCastingAbility(entry))
  }

  function spellAttackBonus(entry) {
    const tab = spellTabForEntry(entry)
    return profBonus.value + spellStatModifier(entry) + (Number(tab?.attack_bonus) || 0)
  }

  function spellSaveDC(entry) {
    const tab = spellTabForEntry(entry)
    return 8 + profBonus.value + spellStatModifier(entry) + (Number(tab?.save_bonus) || 0)
  }

  function spellAbilityLabel(entry) {
    const ability = spellCastingAbility(entry)
    return statOptions.value.find((stat) => String(stat.value) === String(ability))?.label || ''
  }

  async function loadClassItems(syncSlots = true) {
    const classIds = [...new Set((Array.isArray(props.values?.classes) ? props.values.classes : [])
      .flatMap((entry) => [entry?.id, entry?.subclass?.id]).filter((id) => id != null))]
    const missing = classIds.filter((id) => !classItemMap[id])
    if (missing.length) {
      const response = await itemsApi.byIds(missing)
      for (const item of response?.items || []) classItemMap[item.id] = item
    }
    if (!tabs.value.some((tab) => tab.key === activeSpellTab.value)) {
      activeSpellTab.value = tabs.value[0]?.key || ''
    }
    if (syncSlots) syncAutomaticSlotPools()
  }

  return { updateActiveTab, createTab, setActiveTabClass, deleteTab, setAutomaticSlots, syncAutomaticSlotPools, spellCanPrepare, setSpellcastingSource, spellCastingAbility, statModifierForAbility, spellAttackBonus, spellSaveDC, spellAbilityLabel, loadClassItems }
}
