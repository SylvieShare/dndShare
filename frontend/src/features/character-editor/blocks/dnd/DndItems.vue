<template>
  <div class="di-block">
    <SectionLabel v-if="block.title" :title="block.title" border>
      <template #actions>
        <button
          v-if="block.hide_button"
          class="di-collapse-btn"
          :title="contentHidden ? 'Развернуть' : 'Свернуть'"
          @click="contentHidden = !contentHidden"
        >{{ contentHidden ? '▸' : '▾' }}</button>
      </template>
    </SectionLabel>

    <template v-if="!contentHidden">
      <InventorySkeleton v-if="loading" :sections="allSections" />

      <template v-else>
        <BaseTile
          v-for="section in allSections"
          :key="section.id"
          class="di-section"
          :class="{ 'di-section-locked': section.locked }"
        >
          <div class="di-section-head">
            <input
              v-if="canManage && !section.locked && renamingId === section.id"
              ref="renameInputs"
              class="di-section-rename"
              :value="section.name"
              @blur="finishRename(section.id, $event.target.value)"
              @keydown.enter.prevent="finishRename(section.id, $event.target.value)"
              @keydown.escape.prevent="renamingId = null"
            />
            <button
              v-else
              class="di-section-name"
              :class="{ 'di-section-name-editable': canManage && !section.locked }"
              :disabled="!canManage || section.locked"
              :title="canManage && !section.locked ? 'Переименовать' : ''"
              @click="canManage && !section.locked && startRename(section.id)"
            >{{ section.name }}</button>
            <span v-if="visibleItems(section).length" class="di-section-count">{{ visibleItems(section).length }}</span>
            <span class="di-section-line" aria-hidden="true"></span>
            <RemoveButton icon="trash" label="Удалить секцию" v-if="canManage && !section.locked && model.sections.length > 1"
              @click="askDeleteSection(section)" />
          </div>

          <div
            class="di-rows"
            :data-sortable-container="sectionGroup(section.id)"
          >
            <InventoryItemRow v-for="(entry, idx) in displaySectionItems(section.id)" :key="entry.uid" :entry="entry" :section-id="section.id" :index="idx" />

            <div v-if="!visibleItems(section).length" class="di-empty">пусто</div>
          </div>

          <div v-if="canAdd" class="di-add-row">
            <button class="di-add-catalog" @click="openPicker(section.id)">+ Добавить из справочника</button>
            <button
              class="di-add-custom"
              title="Добавить предмет вручную"
              @click="openInlineForm(section.id, null)"
            >+ предмет</button>
          </div>
        </BaseTile>

        <div v-if="canManage" class="di-add-section-row">
          <button class="di-add-section" @click="addSection">+ Добавить секцию</button>
        </div>
      </template>
    </template>

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.name"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    >
      <template v-if="tooltip.item && (tooltip.item.data?.cost || tooltip.item.data?.weight != null)" #details>
        <ItemTooltipDetails :item="tooltip.item" />
      </template>
    </ItemTooltip>

    <MagicItemInstanceModal v-if="magicSelection" :item="catalog[magicSelection.item_id]" :uid="magicSelection.uid" :items="model" @update:items="emitModel" @close="magicSelection = null" />

    <ItemViewModal
      v-if="modalItem"
      :item-type-id="modalItem.typeId ?? 2"
      :item-id="modalItem.id"
      :item="modalItem"
      @close="modalSelection = null"
    />

    <MagicEquipmentInstanceModal v-if="pendingCopy" :item="pendingCopy.item" @close="pendingCopy = null" @confirm="params => { increment(pendingCopy.sectionId, pendingCopy.uid, params); pendingCopy = null }" />
    <ItemPickerModal
      configure-instance
      v-if="pickerOpen && pickerTypeIds.length"
      :item-type-ids="pickerTypeIds"
      title="Предметы"
      search-placeholder="Поиск предмета..."
      allow-quantity
      @close="pickerOpen = false"
      @pick="onPickerPick"
    />

    <ItemInlineFormModal
      v-if="form.open"
      :entry="form.entry"
      :base-item="form.baseItem"
      :instance-fields="form.instanceFields"
      @close="form.open = false"
      @save="onInlineFormSave"
    />

    <ConfirmDialog
      v-if="confirmDel.open"
      title="Удалить секцию?"
      :message="`Секция «${confirmDel.name}» и все её предметы будут удалены.`"
      confirm-label="Удалить"
      @confirm="doDeleteSection"
      @cancel="confirmDel.open = false"
    />
  </div>
</template>

<script setup>
import { useInventoryRowActions } from './composables/useInventoryRowActions'
import InventorySkeleton from './components/InventorySkeleton.vue'
import InventoryItemRow from './components/InventoryItemRow.vue'
import MagicItemInstanceModal from './components/MagicItemInstanceModal.vue'
import { MAGIC_ITEM_TYPE_ID } from '@/features/character-editor/lib/characterMagicItems'
import { RemoveButton } from '@sylvieshare/share-ui'
import { computed, provide, inject, nextTick, onMounted, reactive, ref, watch } from 'vue'

import { BaseTile } from '@sylvieshare/share-ui'
import ItemInlineFormModal from '@/features/character-editor/components/ItemInlineFormModal'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import ItemTooltipDetails from '@/features/items/detail-components/ItemTooltipDetails'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import { SectionLabel } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useSuggestStore } from '@/stores/suggest'
import MagicEquipmentInstanceModal from '@/features/items/components/MagicEquipmentInstanceModal.vue'
import { magicBaseParams, magicEquipmentKinds, magicBaseId } from '@/features/items/lib/magicEquipmentBases'
import { applicableInstanceFields, defaultInstanceParams, mergeEditedInstanceParams } from '@/features/items/lib/itemInstance'
import { hasItemProficiency } from '@/features/character-editor/lib/itemProficiency'
import { abilityModifier, formatBonus as signed, proficiencyBonus, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { STAT_FULL, STAT_KEYS } from '@/shared/lib/dndStats'
import { armorAbilityRollEffects, resolveRollMode } from '@/features/character-editor/blocks/dnd/lib/rollMode'
import { useDiceStore } from '@/stores/dice'
import { useSortable } from '@sylvieshare/share-ui'
import { logSessionEntryAdded } from '@/features/character-editor/lib/sessionEntryEvents'
import {
  EQUIPPED_ID,
  EQUIPPED_NAME,
  allCatalogIds,
  cloneModel,
  entryDisplayData,
  makeEntryUid,
  makeSectionId,
  normalizeValue,
} from '@/features/character-editor/blocks/dnd/lib/itemSection'
import {
  appendOwnedEntry,
  ownedEntryToWeapons,
  takeInventoryEntry,
} from '@/features/character-editor/blocks/dnd/lib/itemPlacement'

const props = defineProps({ block: Object, value: { default: null } })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: false }))

const catalog = reactive({})
const pendingCopy = ref(null)
const loading = ref(true)
const contentHidden = ref(false)
const modalSelection = ref(null)
const magicSelection = ref(null)
const pickerOpen = ref(false)
const pickerSectionId = ref(null)
const form = reactive({ open: false, sectionId: null, entry: null, baseItem: null, instanceFields: [] })
const confirmDel = reactive({ open: false, id: null, name: '' })
const renamingId = ref(null)
const renameInputs = ref([])
const itemTypesStore = useItemTypesStore()
const suggestStore = useSuggestStore()
const diceStore = useDiceStore()
const toolAbilityOptions = STAT_KEYS.map((key, index) => ({ key, suggestId: index + 1, label: STAT_FULL[key] }))

const model = computed(() => normalizeValue(props.value))
const { tooltip, showTooltip, hideTooltip, viewEntry, deleteOneEntry, addEntry, editEntry, deleteEntry } = useInventoryRowActions({ model, modalSelection, charCtx, increment, decrement, openInlineForm, removeEntry })

const allSections = computed(() => [
  { id: EQUIPPED_ID, name: EQUIPPED_NAME, items: model.value.equipped, locked: true },
  ...model.value.sections.map(s => ({ ...s, locked: false })),
])

function visibleItems(section) {
  return section.items || []
}

// Returns mutable reference to items array (equipped or sections[i].items) on a cloned model
function itemsRef(next, sectionId) {
  if (sectionId === EQUIPPED_ID) return next.equipped
  const sec = next.sections.find(s => s.id === sectionId)
  return sec ? sec.items : null
}

function setItems(next, sectionId, items) {
  if (sectionId === EQUIPPED_ID) { next.equipped = items; return }
  const sec = next.sections.find(s => s.id === sectionId)
  if (sec) sec.items = items
}

const rootTypeId = computed(() => Number(props.block.content?.item_type_id || props.block.content?.item_ids?.[0] || 2))
// Single mode: owners get every control (add / manage / drag); viewers see a read-only list.
const canManage = computed(() => !!charCtx.ownerMode)
const canAdd = computed(() => !!charCtx.ownerMode)
const canDrag = computed(() => !!charCtx.ownerMode)

const typeById = computed(() => Object.fromEntries(itemTypesStore.allTypes.map((type) => [type.id, type])))
const modalItem = computed(() => modalSelection.value?.item_id != null ? catalog[modalSelection.value.item_id] ?? null : null)
const pickerTypeIds = computed(() => {
  const related = props.block.content?.include_related_types
    ? itemTypesStore.relatedTypeIds(rootTypeId.value)
    : (props.block.content?.item_ids || [rootTypeId.value])
  return related.length ? related : [rootTypeId.value]
})
const specializedDestinations = computed(() => props.block.content?.specialized_destinations || [])
const toolTypeId = computed(() => Number(props.block.content?.tool_type_id) || 14)

function sectionGroup(id) { return 'sec_' + id }

function entryWithDisplay(entry) {
  return { ...entry, display: entryDisplayData(entry, catalog, typeById.value, rootTypeId.value) }
}

function entryTypeId(entry) {
  return Number(entry.display?.base?.typeId ?? catalog[entry.item_id]?.typeId)
}

function isToolEntry(entry) {
  return entryTypeId(entry) === toolTypeId.value
}

function entryHasProficiency(entry) {
  const kind = entryTypeId(entry) === 14 ? 'tool_proficiency' : entryTypeId(entry) === 1 ? 'weapon_proficiency' : 'armor_proficiency'
  return hasItemProficiency(
    entry.display?.base,
    charCtx.values,
    (typeId) => suggestStore.items(typeId),
    charCtx.characterDerivedEffects?.grantedProficiencies?.(kind) || [],
  )
}

function toolProficiencyRank(entry) {
  const ids = Array.isArray(entry.display?.base?.data?.required_tool_proficiencies)
    ? entry.display.base.data.required_tool_proficiencies
    : []
  const derived = ids.reduce((rank, id) => Math.max(
    rank,
    Number(charCtx.characterDerivedEffects?.toolProficiency?.(id)?.rank) || 0,
  ), 0)
  return Math.max(entryHasProficiency(entry) ? 1 : 0, derived)
}

function armorMeta(entry) {
  if (entryTypeId(entry) !== 12) return null
  return charCtx.characterArmor?.state?.byUid?.[String(entry.uid)] || null
}

function toolCategoryLabel(entry) {
  return ({
    artisan: 'Ремесленный инструмент',
    gaming: 'Игровой набор',
    musical: 'Музыкальный инструмент',
    kit: 'Набор инструментов',
  })[entry.display.base?.data?.category] || 'Инструмент'
}

function characterProficiencyBonus() {
  const values = charCtx.values || {}
  const stored = values.prof_bonus || {}
  const base = stored.auto === false
    ? Number(stored.v) || 0
    : proficiencyBonus(values.lvl?.level)
  return base + sumBonuses(stored.bonuses)
}

function toolCheckBonus(entry, ability) {
  const values = charCtx.values || {}
  const modifier = abilityModifier(resolveNumValue(values?.[ability.key]?.value ?? 10))
  const proficiencyRank = toolProficiencyRank(entry)
  const proficient = proficiencyRank > 0
  const derived = charCtx.characterDerivedEffects?.bonus?.('check_bonus', {
    kind: 'tool', abilitySuggestId: ability.suggestId, proficient, item: entry.display.base,
  })?.total || 0
  return modifier + proficiencyRank * characterProficiencyBonus() + derived
}

function rollTool(entry, ability, closeAbilities, closeMenu) {
  const armorState = charCtx.characterArmor?.state || {}
  const resolved = charCtx.characterRolls?.resolve
    ? charCtx.characterRolls.resolve('auto', { kind: 'tool', abilitySuggestId: ability.suggestId, item: entry.display.base })
    : resolveRollMode('auto', armorAbilityRollEffects(armorState, ability.suggestId))
  diceStore.rollD20(
    `${entry.display.name} — ${ability.label}`,
    toolCheckBonus(entry, ability),
    resolved.mode,
    {
      crit_mode: true,
      roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('ability_check') || [],
      roll_adjustments: charCtx.characterCombatEffects?.rollAdjustments?.('ability_check', {
        proficiencyRank: toolProficiencyRank(entry),
      }) || [],
    },
  )
  closeAbilities()
  closeMenu()
}

function specializedDestination(entry) {
  const typeId = entryTypeId(entry)
  return specializedDestinations.value.find(destination => Number(destination.type_id) === typeId) || null
}

function canMoveToSpecialized(entry) {
  return canManage.value && typeof charCtx.updateValues === 'function' && !!specializedDestination(entry)
}

function moveToSpecialized(sectionId, entry, close) {
  const destination = specializedDestination(entry)
  const taken = takeInventoryEntry(model.value, sectionId, entry.uid)
  if (!destination || !taken) return
  const currentValues = charCtx.values || {}
  const targetId = destination.value_id
  const target = targetId === 'weapon'
    ? [...(Array.isArray(currentValues.weapon) ? currentValues.weapon : []), ...ownedEntryToWeapons(taken.entry)]
    : appendOwnedEntry(currentValues[targetId], taken.entry)
  charCtx.updateValues({ items: taken.inventory, [targetId]: target })
  close()
}

function sectionItems(sectionId) {
  if (sectionId === EQUIPPED_ID) return model.value.equipped.map(entryWithDisplay)
  const sec = model.value.sections.find(s => s.id === sectionId)
  return sec ? sec.items.map(entryWithDisplay) : []
}

const sortable = useSortable({
  groups: new Proxy({}, {
    get(_, groupName) {
      return {
        items: { get value() { return sectionItems(parseGroup(groupName)) } },
      }
    },
    has() { return true },
    ownKeys() {
      return [sectionGroup(EQUIPPED_ID), ...model.value.sections.map(s => sectionGroup(s.id))]
    },
    getOwnPropertyDescriptor() { return { enumerable: true, configurable: true } },
  }),
  getKey: e => e.uid,
  onDrop: ({ item, fromGroup, toGroup, toIndex }) => {
    const fromSecId = parseGroup(fromGroup)
    const toSecId = parseGroup(toGroup)
    const next = cloneModel(model.value)
    const fromList = itemsRef(next, fromSecId)
    const toList = itemsRef(next, toSecId)
    if (!fromList || !toList) return
    const idx = fromList.findIndex(i => i.uid === item.uid)
    if (idx === -1) return
    const [moved] = fromList.splice(idx, 1)
    const adjustedIdx = (fromSecId === toSecId && idx < toIndex) ? toIndex - 1 : toIndex
    toList.splice(Math.min(adjustedIdx, toList.length), 0, moved)
    emit('update:value', props.block.id, next)
  },
})

function parseGroup(g) { return String(g).slice(4) }

function displaySectionItems(sectionId) {
  return sortable.displayItems(sectionGroup(sectionId))
    .map(entryWithDisplay)
}

// Whole-row drag (like spells/weapons). The sortable's 4px threshold keeps a plain tap a click; a
// drag flips `sortable.dragging` mid-gesture, which we remember so the trailing click does not
// open the row action menu.
const draggedThisGesture = ref(false)
watch(() => sortable.dragging, v => { if (v) draggedThisGesture.value = true })

function onRowDown(e, entry, sectionId, idx) {
  if (e.target.closest('button') || e.target.closest('input')) return
  draggedThisGesture.value = false
  if (!canDrag.value) return
  sortable.startDrag(e, entry, sectionGroup(sectionId), idx)
}

function emitModel(next) {
  emit('update:value', props.block.id, next)
}

function startRename(id) {
  renamingId.value = id
  nextTick(() => {
    const el = renameInputs.value?.[0]
    el?.focus()
    el?.select()
  })
}

function finishRename(id, value) {
  if (renamingId.value !== id) return
  const trimmed = (value || '').trim()
  const next = cloneModel(model.value)
  const sec = next.sections.find(s => s.id === id)
  if (sec) sec.name = trimmed || sec.name
  renamingId.value = null
  emitModel(next)
}

function addSection() {
  const next = cloneModel(model.value)
  next.sections.push({ id: makeSectionId(), name: 'Новая секция', items: [] })
  emitModel(next)
}

function askDeleteSection(section) {
  Object.assign(confirmDel, { open: true, id: section.id, name: section.name })
}

function doDeleteSection() {
  const next = cloneModel(model.value)
  next.sections = next.sections.filter(s => s.id !== confirmDel.id)
  if (next.sections.length === 0) {
    next.sections.push({ id: makeSectionId(), name: 'Рюкзак', items: [] })
  }
  confirmDel.open = false
  emitModel(next)
}

function decrement(sectionId, uid) {
  const next = cloneModel(model.value)
  const list = itemsRef(next, sectionId)
  if (!list) return
  const idx = list.findIndex(i => i.uid === uid)
  if (idx === -1) return
  const item = list[idx]
  if ((item.count || 1) > 1) item.count -= 1
  else list.splice(idx, 1)
  emitModel(next)
}

function increment(sectionId, uid, selectedParams = null) {
  const next = cloneModel(model.value)
  const list = itemsRef(next, sectionId)
  const entry = list?.find(item => item.uid === uid)
  if (!entry) return null
  if (Number(catalog[entry.item_id]?.typeId) === MAGIC_ITEM_TYPE_ID) {
    const item = catalog[entry.item_id], params = selectedParams || entry.params
    if (magicEquipmentKinds(item).some(kind => !magicBaseId(item, params, kind))) { pendingCopy.value = { item, sectionId, uid }; return null }
    list.push({ uid: makeEntryUid(), item_id: entry.item_id, count: 1, params: magicBaseParams(item, params), override: entry.override ? { ...entry.override } : null })
    emitModel(next)
    return 1
  }
  entry.count = Math.min(999, Math.max(1, Number(entry.count) || 1) + 1)
  emitModel(next)
  return entry.count
}

function removeEntry(sectionId, uid) {
  const next = cloneModel(model.value)
  const list = itemsRef(next, sectionId)
  if (!list) return
  setItems(next, sectionId, list.filter(i => i.uid !== uid))
  emitModel(next)
}

function openPicker(sectionId) {
  pickerSectionId.value = sectionId
  pickerOpen.value = true
}

function onPickerPick(item, qty = 1, params = {}) {
  const n = Math.max(1, Math.min(999, Math.floor(Number(qty) || 1)))
  if (!catalog[item.id]) catalog[item.id] = item
  itemsApi.byIds([item.id]).then((response) => {
    const enriched = response?.items?.[0]
    if (enriched) catalog[item.id] = enriched
  }).catch(() => null)
  const next = cloneModel(model.value)
  const list = itemsRef(next, pickerSectionId.value) || next.sections[0]?.items
  if (!list) return
  const type = typeById.value[item.typeId]
  const copies = item.typeId === MAGIC_ITEM_TYPE_ID ? n : 1
  for (let index = 0; index < copies; index += 1) list.push({ uid: makeEntryUid(), item_id: item.id, count: copies > 1 ? 1 : n, params: { ...defaultInstanceParams(type, item), ...params }, override: null })
  emitModel(next)
  logSessionEntryAdded(charCtx, { kind: 'item', title: item.name, itemId: item.id, count: n })
}

function openInlineForm(sectionId, entry) {
  const baseItem = entry?.item_id != null ? (catalog[entry.item_id] || null) : null
  const instanceFields = applicableInstanceFields(typeById.value[baseItem?.typeId], baseItem)
  Object.assign(form, { open: true, sectionId, entry, baseItem, instanceFields })
}

function onInlineFormSave(fields) {
  const next = cloneModel(model.value)
  const list = itemsRef(next, form.sectionId) || next.sections[0]?.items
  if (!list) return
  const isNew = !form.entry
  if (form.entry) {
    const item = list.find(i => i.uid === form.entry.uid)
    if (item) {
      const baseData = form.baseItem?.data || {}
      const baseName = form.baseItem?.name
      const ov = {}
      if (fields.name !== baseName) ov.name = fields.name
      if (fields.desc !== (baseData.desc || '')) ov.desc = fields.desc
      if (fields.consumable !== !!baseData.consumable) ov.consumable = fields.consumable
      item.override = Object.keys(ov).length ? ov : null
      item.params = mergeEditedInstanceParams(item.params, fields.params, form.instanceFields)
    }
  } else {
    list.push({
      uid: makeEntryUid(),
      item_id: null,
      count: 1,
      params: {},
      override: { name: fields.name, desc: fields.desc, consumable: fields.consumable },
    })
  }
  form.open = false
  emitModel(next)
  if (isNew) logSessionEntryAdded(charCtx, { kind: 'item', title: fields.name })
}

provide('inventoryRowCtx', reactive({
  draggedThisGesture,
  canManage,
  sortable,
  canDrag,
  onRowDown,
  showTooltip,
  hideTooltip,
  isToolEntry,
  entryHasProficiency,
  armorMeta,
  toolCategoryLabel,
  toolProficiencyRank,
  entryTypeId,
  viewEntry,
  toolAbilityOptions,
  rollTool,
  signed,
  toolCheckBonus,
  canMoveToSpecialized,
  moveToSpecialized,
  specializedDestination,
  addEntry,
  deleteOneEntry,
  editEntry,
  deleteEntry,
  openMagic(entry, close) { magicSelection.value = entry; close() },
}))

onMounted(async () => {
  try {
    await Promise.all([
      itemTypesStore.ensureAll().catch(() => []),
      ...[3, 4, 5].map((typeId) => suggestStore.ensure(typeId).catch(() => [])),
    ])
    const ids = allCatalogIds(model.value)
    if (ids.length) {
      const r = await itemsApi.byIds(ids)
      for (const item of r?.items || []) catalog[item.id] = item
    }
  } catch { /* ignore */ } finally {
    loading.value = false
  }
})
</script>

<style scoped src="./styles/DndItems.css"></style>
