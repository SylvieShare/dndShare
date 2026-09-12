import { computed } from 'vue'
import { useSortable } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import { SPELL_LEVELS } from '../lib/spellEntry'
import { spellEntry, spellbookItemIds } from '../lib/spellbook'
import { featureItemIds } from '@/features/character-editor/lib/characterMagicItems'
import { abilitySpellGrantRows, syncAbilityGrantedSpells } from '../lib/abilitySpellGrants'
import { logSessionEntryAdded } from '@/features/character-editor/lib/sessionEntryEvents'

export function useSpellbookEntries({ props, charCtx, tabs, grants, itemMap, activeTabSpells, activeTab, preparation, spellsByLevel, emitChange, spellPickerEligibility, spellStatusSource }) {
  async function loadDetails() {
    const ids = spellbookItemIds({ tabs: tabs.value, grants: grants.value }).filter(id => !itemMap[id])
    if (ids.length) {
      const res = await itemsApi.byIds(ids)
      for (const item of res.items || []) itemMap[item.id] = item
      charCtx.characterResources?.rememberItems?.(res.items || [])
    }
    await Promise.all(spellbookItemIds({ tabs: tabs.value, grants: grants.value })
      .map((id) => charCtx.characterStatuses?.ensureLinks?.(itemMap[id])))
    normalizePreparationStatuses()
  }

  function normalizePreparationStatuses() {
    let changed = false
    for (const tab of tabs.value) {
      for (const spell of tab.spells || []) {
        const level = Number(itemMap[spell.id]?.data?.lvl)
        if (level === 0 && spell.prepared) {
          spell.prepared = false
          changed = true
        }
        if (tab.mode === 'known' && spell.prepared) {
          spell.prepared = false
          changed = true
        }
      }
    }
    if (changed) emitChange()
  }

  function activeSpellByKey(key) {
    return activeTabSpells.value.find((entry) => entry.key === key) || null
  }

  function togglePrepared(key) {
    if (!charCtx.ownerMode) return
    const entry = activeSpellByKey(key)
    const level = Number(itemMap[entry?.id]?.data?.lvl)
    if (entry && level > 0 && preparation.value) {
      entry.prepared = !entry.prepared
      emitChange()
    }
  }

  function removeSpell(key) {
    const index = activeTabSpells.value.findIndex((entry) => entry.key === key)
    if (index !== -1) {
      const ref = activeTabSpells.value[index]
      const entry = { ref, item: itemMap[ref.id] }
      if (typeof charCtx.updateValues === 'function') {
        charCtx.updateValues({ states: charCtx.characterStatuses?.removeBySource?.(spellStatusSource(entry)) || [] })
      }
      activeTab.value.spells.splice(index, 1)
      emitChange()
    }
  }

  const spellGroups = Object.fromEntries(SPELL_LEVELS.map(lvl => {
    return ['level-' + lvl, {
      items: computed(() => spellsByLevel.value.find(g => g.level === lvl)?.items || []),
      accepts: (entry) => ((entry?.item?.data?.lvl) ?? -1) === lvl,
    }]
  }))

  const sortable = useSortable({
    groups: spellGroups,
    getKey: e => e.ref.key,
    onDrop: ({ item, toGroup, toIndex }) => {
      if (!activeTab.value) return
      const targetLevel = Number(toGroup.replace('level-', ''))
      const arr = [...activeTabSpells.value]
      const srcIdx = arr.findIndex(s => s.key === item.ref.key)
      if (srcIdx === -1) return
      const [moved] = arr.splice(srcIdx, 1)
      const targetItems = arr.filter(s => (itemMap[s.id]?.data?.lvl ?? -1) === targetLevel)
      let insertAt
      if (toIndex >= targetItems.length) {
        insertAt = targetItems.length === 0 ? arr.length : arr.indexOf(targetItems[targetItems.length - 1]) + 1
      } else {
        insertAt = arr.indexOf(targetItems[toIndex])
      }
      arr.splice(insertAt, 0, moved)
      activeTab.value.spells = arr
      emitChange()
    },
  })

  function displayLevel(level) {
    return sortable.displayItems('level-' + level)
  }

  function onSpellDragStart(e, entry, level, idx) {
    if (!charCtx.ownerMode) return
    sortable.startDrag(e, entry, 'level-' + level, idx)
  }

  function addSpell(item) {
    if (!activeTab.value) return
    if (spellPickerEligibility(item).eligible && !activeTabSpells.value.some(s => String(s.id) === String(item.id))) {
      itemMap[item.id] = item
      charCtx.characterResources?.rememberItems?.([item])
      charCtx.characterStatuses?.ensureLinks?.(item)
      activeTab.value.spells.push(spellEntry(item.id, {
        prepared: preparation.value && Number(item.data?.lvl) > 0,
      }))
      emitChange()
      logSessionEntryAdded(charCtx, {
        kind: 'spell', title: item.name, itemId: item.id, level: item.data?.lvl,
      })
    }
  }

  function abilityIds() { return featureItemIds(props.values) }

  let grantSyncSequence = 0
  async function syncExternalAbilitySpells() {
    const sequence = ++grantSyncSequence
    const ids = abilityIds()
    const response = charCtx.characterResources?.ensureItems
      ? await charCtx.characterResources.ensureItems(ids)
      : (ids.length ? await itemsApi.byIds(ids) : { items: [] })
    if (sequence !== grantSyncSequence) return
    const items = response?.items || []
    const resolvedIds = new Set(items.map((item) => String(item.id)))
    if (ids.some((id) => !resolvedIds.has(String(id)))) return
    const rows = abilitySpellGrantRows(items, props.values)
    const next = syncAbilityGrantedSpells(grants.value, rows)
    if (JSON.stringify(next) === JSON.stringify(grants.value)) return
    grants.value = next
    emitChange()
    await loadDetails()
  }

  return { loadDetails, togglePrepared, removeSpell, sortable, displayLevel, onSpellDragStart, addSpell, abilityIds, syncExternalAbilitySpells }
}
