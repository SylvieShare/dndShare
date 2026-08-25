<template>
  <div
    class="ab-block"
    :class="{
      'ab-block--embedded': block.content?.embedded,
      'ab-block--divider': block.content?.divider,
    }"
  >
    <component :is="block.content?.embedded ? 'div' : BaseTile" class="ab-tile">
      <DndAbilitiesView
        :entries="entries"
        :loading="loading"
        :skeleton-count="skeletonCount"
        :title="title"
        :manage="ownerMode"
        :expanded="!!block.content?.expanded"
        @view="onView"
        @use="useAbility"
        @remove="entry => removeAbility(entry.key)"
        @add="pickerOpen = true"
        @toggle-status="toggleAbilityStatus"
        @show-tooltip="showTooltip"
        @hide-tooltip="hideTooltip"
      />
    </component>

    <ItemPickerModal
      v-if="pickerOpen && block.content.item_id"
      :item-type-ids="[block.content.item_id]"
      :exclude-items="usedIds"
      :z-index="3200"
      title="Способности"
      search-placeholder="Поиск способности..."
      @close="pickerOpen = false"
      @pick="addFromCatalog"
    />

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.name"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    >
      <template v-if="tooltip.item && (tooltip.item.data?.max_use || tooltip.item.data?.max_use_stat || tooltip.item.data?.rollback_short_rest || tooltip.item.data?.rollback_long_rest)" #details>
        <AbilityTooltipDetails :item="tooltip.item" :values="values" />
      </template>
    </ItemTooltip>

    <FeatChoiceModal
      v-if="choiceConfigItem"
      :item="choiceConfigItem"
      :initial-choices="choiceInitialChoices"
      :excluded-choices="choiceExcludedChoices"
      :option-eligibility="choiceOptionEligibility"
      @confirm="onChoicesConfirm"
      @close="choiceConfigItem = null"
    />

    <ItemViewModal
      v-if="modalEntry && modalItem"
      :item-type-id="block.content.item_id ?? 3"
      :item-id="modalItem.id"
      :item="modalItem"
      @close="modalEntry = null"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'

import { itemsApi } from '@/shared/api/itemsApi'
import { BaseTile } from '@sylvieshare/share-ui'
import DndAbilitiesView from "@/features/character-editor/blocks/dnd/components/DndAbilitiesView"
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
import ItemPickerModal from "@/features/handbook/components/ItemPickerModal.vue"
import ItemTooltip from "@/features/character-editor/components/ItemTooltip"
import AbilityTooltipDetails from "@/features/items/detail-components/AbilityTooltipDetails"
import ItemViewModal from "@/features/handbook/components/ItemViewModal.vue"
import { featAbilityBonuses, featEntry } from '@/features/items/lib/featRules'
import { actionableItemChoices, itemChoices } from '@/features/items/lib/itemChoices'
import { resolveNumValue } from '@/shared/lib/dnd'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import { useSuggestStore } from '@/stores/suggest'
import { logSessionEntryAdded } from '@/features/character-editor/lib/sessionEntryEvents'
import { abilityScalingLabel, abilityUseTotal } from '@/shared/lib/dndAbilityUses'
import { useFeatSheetRequirements } from '@/features/character-editor/composables/useFeatSheetRequirements'
import { characterChoiceOptionEligibility } from '@/features/items/lib/characterChoiceEligibility'
import { ownedAbilityStatusSource } from '@/features/character-editor/lib/characterStatuses'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const suggestStore = useSuggestStore()
const isFeatBlock = computed(() => Number(props.block.content.item_id) === 7)

const catalog     = ref([])
const loading     = ref(true)
const modalEntry  = ref(null)
const pickerOpen  = ref(false)
const tooltip     = reactive({ visible: false, name: '', desc: '', item: null, x: 0, top: null, bottom: null })
const choiceConfigItem = ref(null)

const ownerMode = computed(() => charCtx.ownerMode)
const title = computed(() => props.block.title || props.block.content?.title || '')
const stored = computed(() => props.value || [])
const abilityResources = computed(() => {
  const value = charCtx.characterResources?.resources
  if (Array.isArray(value)) return value
  return Array.isArray(value?.value) ? value.value : []
})
const passiveEffects = computed(() => {
  const value = charCtx.characterPassiveEffects?.effects
  if (Array.isArray(value)) return value
  return Array.isArray(value?.value) ? value.value : []
})

function passiveEffectsFor(entry) {
  const key = String(entry?.uid || entry?.id || '')
  return passiveEffects.value.filter((effect) => (
    effect?.source?.valueId === props.block.id
    && String(effect?.source?.entryKey || '') === key
  ))
}

function usableResourceFor(entry) {
  const key = String(entry?.uid || entry?.id || '')
  const matches = abilityResources.value.filter(resource => (
    resource.source?.valueId === props.block.id
    && String(resource.source?.entryKey || '') === key
  ))
  return matches.length === 1 ? matches[0] : null
}

const entries = computed(() =>
  stored.value
    .map(s => {
      const item = catalog.value.find(c => c.id === s.id)
      if (!item) return null
      const maxUse = abilityUseTotal(item.data, props.values, s)
      const statusSource = ownedAbilityStatusSource(props.block.id, s, item)
      return {
        key: s.uid || String(s.id),
        uid: s.uid,
        id: s.id,
        name: item.name,
        item,
        svg: item.svg || '',
        desc: Number(props.block.content.item_id) === 7 ? (item.data?.description || '') : (item.data?.desc || ''),
        max_use: maxUse,
        rollback_short_rest: !!item.data?.rollback_short_rest,
        rollback_long_rest:  !!item.data?.rollback_long_rest,
        usable_resource: usableResourceFor(s),
        choices: s.choices || {},
        choice_summary: itemChoiceSummary(item, s.choices || {}),
        scaling_label: abilityScalingLabel(item.data, props.values),
        passive_effects: [
          ...(!requirementsMet(item) ? [{
            title: 'Требования не выполнены',
            description: 'Черта сохранена на листе, но её бонусы и другие эффекты не применяются.',
            tone: 'danger',
          }] : []),
          ...passiveEffectsFor(s),
        ],
        status_effects: (charCtx.characterStatuses?.links?.(item) || []).map(link => ({
          ...link,
          active: !!charCtx.characterStatuses?.linkedActive?.(item, link, statusSource),
        })),
        status_source: statusSource,
      }
    })
    .filter(Boolean)
)

const modalItem = computed(() => {
  if (!modalEntry.value) return null
  const item = catalog.value.find(c => c.id === modalEntry.value.id)
  return item || { name: modalEntry.value.name, data: {} }
})

const skeletonCount = computed(() => Math.max(1, stored.value.length) || 2)
const usedIds       = computed(() => stored.value
  .filter((storedEntry) => !catalog.value.find((item) => item.id === storedEntry.id)?.data?.repeatable)
  .map((storedEntry) => storedEntry.id))
const choiceExcludedChoices = computed(() => {
  const item = choiceConfigItem.value
  if (!item?.data?.repeatable) return {}
  const uniqueKeys = new Set([
    item.data.unique_choice_key,
    ...itemChoices(item).filter((choice) => choice.unique_across_takes).map((choice) => choice.key),
  ].filter(Boolean))
  const result = {}
  for (const entry of stored.value.filter((storedEntry) => storedEntry.id === item.id)) {
    for (const key of uniqueKeys) result[key] = [...(result[key] || []), ...(entry.choices?.[key] || [])]
  }
  return result
})
const choiceInitialChoices = {}
function choiceOptionEligibility(choice, value) {
  return characterChoiceOptionEligibility(choice, value, {
    values: props.values,
    items: catalog.value,
    suggestItems: (typeId) => suggestStore.items(typeId),
  })
}
const { requirementsMet, sync: syncFeatRequirements } = useFeatSheetRequirements({
  isFeatBlock: () => isFeatBlock.value,
  values: () => props.values,
  entries: () => stored.value,
  catalog: () => catalog.value,
  armorDictionary: () => suggestStore.items(3) || [],
  onActivate: applyFeatStatBonuses,
  onDeactivate: removeFeatStatBonuses,
  onChange: emitChange,
})

function itemChoiceSummary(item, selections) {
  const labels = []
  for (const choice of itemChoices(item)) {
    for (const value of (selections[choice.key] || [])) {
      if (choice.source === 'suggest') {
        labels.push(suggestStore.items(Number(choice.from_suggest_id)).find((entry) => String(entry.id) === String(value))?.value || `#${value}`)
      } else if (choice.source === 'suggest_union') {
        const [prefix, id] = String(value).split(':')
        const source = (choice.suggest_sources || []).find((entry) => String(entry.prefix) === prefix)
        labels.push(suggestStore.items(Number(source?.suggest_id)).find((entry) => String(entry.id) === id)?.value || String(value))
      } else if (choice.source === 'item') {
        labels.push(itemName(value) || `#${value}`)
      } else {
        labels.push(choice.options?.find((option) => String(option.value ?? option.label) === String(value))?.label || String(value))
      }
    }
  }
  return labels.join(', ')
}

function hydrateItemChoices() {
  const itemIds = []
  for (const item of catalog.value) {
    for (const choice of itemChoices(item)) {
      if (choice.from_suggest_id != null) suggestStore.ensure(Number(choice.from_suggest_id))
      for (const source of (choice.suggest_sources || [])) suggestStore.ensure(Number(source.suggest_id))
      if (choice.source !== 'item') continue
      for (const storedEntry of stored.value.filter((entry) => entry.id === item.id)) {
        itemIds.push(...(storedEntry?.choices?.[choice.key] || []))
      }
    }
  }
  if (itemIds.length) ensureItemNames(itemIds)
}

function emitChange(newStored) {
  emit('update:value', props.block.id, newStored)
}

function featSourceKey(item, entry) {
  return `feat:${entry.uid || item.id}`
}

function applyFeatStatBonuses(item, entry) {
  const sourceFeatKey = featSourceKey(item, entry)
  for (const bonus of featAbilityBonuses(item, entry.choices || {})) {
    const block = { ...(props.values?.[bonus.stat] || {}) }
    const oldValue = block.value
    const base = oldValue && typeof oldValue === 'object'
      ? (Number(oldValue.base) || 0)
      : (oldValue == null ? 10 : Number(oldValue) || 0)
    const bonuses = oldValue && typeof oldValue === 'object' && Array.isArray(oldValue.bonuses) ? oldValue.bonuses : []
    const applied = Math.max(0, Math.min(Number(bonus.bonus) || 0, 20 - resolveNumValue(oldValue)))
    if (!applied) continue
    emit('update:value', bonus.stat, {
      ...block,
      value: {
        base,
        bonuses: [...bonuses, {
          name: item.name || 'Черта',
          title: item.name || 'Черта',
          value: applied,
          readonly: true,
          sourceFeatKey,
        }],
      },
    })
  }
}

function removeFeatStatBonuses(item, entry) {
  const sourceFeatKey = featSourceKey(item, entry)
  for (const bonus of featAbilityBonuses(item, entry.choices || {})) {
    const block = { ...(props.values?.[bonus.stat] || {}) }
    if (!block.value || typeof block.value !== 'object') continue
    const bonuses = (block.value.bonuses || []).filter((row) => row.sourceFeatKey !== sourceFeatKey)
    emit('update:value', bonus.stat, { ...block, value: { ...block.value, bonuses } })
  }
}

function onView(entry) {
  hideTooltip()
  modalEntry.value = entry
}

function useAbility(entry) {
  hideTooltip()
  const resource = entry.usable_resource
  const available = Math.max(0, Number(resource?.value) || 0)
  if (!ownerMode.value || !resource?.key || available <= 0) return
  const remaining = available - 1
  const patch = charCtx.characterResources?.setAvailable?.(resource.key, remaining) || {}
  const updates = Object.entries(patch)
  if (!updates.length) return
  for (const [id, value] of updates) emit('update:value', id, value)
  charCtx.logSessionEvent?.({
    type: 'resource_used',
    action: `Использовано: ${entry.name || 'Способность'}`,
    data: { remaining, total: Number(resource.total) || 0 },
  })
}

function logAddedEntry(item) {
  logSessionEntryAdded(charCtx, {
    kind: Number(props.block.content.item_id) === 7 ? 'feature' : 'ability',
    title: item?.name,
    itemId: item?.id,
  })
}

function addFromCatalog(item) {
  if (!catalog.value.find(c => c.id === item.id)) catalog.value.push(item)
  charCtx.characterResources?.rememberItems?.([item])
  charCtx.characterStatuses?.ensureLinks?.(item)
  if (actionableItemChoices(item).length) {
    choiceConfigItem.value = item
    pickerOpen.value = false
    return
  }
  const entry = featEntry(item, {}, props.values)
  if (isFeatBlock.value && !requirementsMet(item)) entry.requirements_met = false
  emitChange([...stored.value, entry])
  if (Number(props.block.content.item_id) === 7 && entry.requirements_met !== false) {
    applyFeatStatBonuses(item, entry)
  }
  logAddedEntry(item)
}

function onChoicesConfirm(choices) {
  const item = choiceConfigItem.value
  const entry = featEntry(item, choices, props.values)
  if (isFeatBlock.value && !requirementsMet(item)) entry.requirements_met = false
  emitChange([...stored.value, entry])
  if (Number(props.block.content.item_id) === 7 && entry.requirements_met !== false) applyFeatStatBonuses(item, entry)
  const selectedItemIds = actionableItemChoices(item)
    .filter((choice) => choice.source === 'item')
    .flatMap((choice) => choices[choice.key] || [])
  if (selectedItemIds.length) ensureItemNames(selectedItemIds).catch(() => {})
  logAddedEntry(item)
  choiceConfigItem.value = null
}

function removeAbility(key) {
  hideTooltip()
  const removedEntry = entries.value.find(entry => String(entry.key) === String(key))
  if (Number(props.block.content.item_id) === 7) {
    const entry = stored.value.find(s => (s.uid || String(s.id)) === key)
    const item = entry && catalog.value.find(candidate => candidate.id === entry.id)
    if (entry && item) removeFeatStatBonuses(item, entry)
  }
  emitChange(stored.value.filter(s => (s.uid || String(s.id)) !== key))
  if (removedEntry?.status_source && typeof charCtx.updateValues === 'function') {
    charCtx.updateValues({ states: charCtx.characterStatuses?.removeBySource?.(removedEntry.status_source) || [] })
  }
}

function toggleAbilityStatus(entry, link) {
  if (!ownerMode.value || !link?.effect || typeof charCtx.updateValues !== 'function') return
  charCtx.updateValues({
    states: charCtx.characterStatuses.toggleLinked(link.effect, entry.item, link, entry.status_source),
  })
}

function showTooltip(e, entry) {
  if (!entry.desc && !entry.max_use && !entry.rollback_short_rest && !entry.rollback_long_rest) return
  const rect = e.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 220
  Object.assign(tooltip, {
    visible: true,
    name: entry.name, desc: entry.desc,
    item: catalog.value.find(it => it.id === entry.id) || null,
    x: Math.min(rect.left, window.innerWidth - 350),
    top: above ? null : rect.bottom + 8,
    bottom: above ? window.innerHeight - rect.top + 8 : null,
  })
}

function hideTooltip() { tooltip.visible = false }

onMounted(async () => {
  if (isFeatBlock.value) suggestStore.ensure(3)
  if (stored.value.length > 0) {
    const ids = stored.value.map(s => s.id)
    try {
      const r = charCtx.characterResources?.ensureItems
        ? await charCtx.characterResources.ensureItems(ids)
        : await itemsApi.byIds(ids)
      catalog.value = r.items || []
      await Promise.all(catalog.value.map(item => charCtx.characterStatuses?.ensureLinks?.(item)))
      hydrateItemChoices()
      syncFeatRequirements()
    } catch (e) { /* show what we have */ }
  }
  loading.value = false
})

</script>

<style scoped>
.ab-block { min-width: 0; }
.ab-block--divider { padding-top: 13px; border-top: 1px solid var(--border); }

.ab-tile {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
</style>
