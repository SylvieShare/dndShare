<template>
  <div class="weapons-block">
    <BaseTile v-if="entries.length === 0 && !canAddItems" class="w-empty">Нет записей</BaseTile>

    <div v-else-if="variant === 'list'" class="w-list" data-sortable-container="weapons">
      <WeaponCard
        v-for="(entry, index) in displayEntries"
        :key="entry._key"
        :entry="entry"
        :index="index"
      />
    </div>

    <table v-else class="w-table" :class="{ 'w-edit': charCtx.ownerMode }">
      <colgroup v-if="charCtx.ownerMode">
        <col class="w-order-col" />
        <col class="w-name-col" />
        <col class="w-stat-col" />
        <col class="w-magic-col" />
        <col class="w-damage-col" />
        <col class="w-delete-col" />
      </colgroup>
      <colgroup v-else>
        <col class="w-name-col" />
        <col class="w-attack-col" />
        <col class="w-damage-col" />
        <col class="w-props-col" />
      </colgroup>
      <thead>
        <tr>
          <th v-if="charCtx.ownerMode"></th>
          <th>Название</th>
          <th v-if="charCtx.ownerMode">Стата / владение</th>
          <th v-if="charCtx.ownerMode">Магия</th>
          <th v-if="!charCtx.ownerMode">Атака</th>
          <th>{{ charCtx.ownerMode ? 'Доп урон' : 'Урон' }}</th>
          <th v-if="!charCtx.ownerMode">Свойства</th>
          <th v-if="charCtx.ownerMode"></th>
        </tr>
      </thead>
      <tbody data-sortable-container="weapons">
        <WeaponTableRow
          v-for="(entry, index) in displayEntries"
          :key="entry._key"
          :entry="entry"
          :index="index"
        />
      </tbody>
    </table>

    <div v-if="canAddItems" class="w-add">
      <button class="w-picker-btn" @click="pickerOpen = true">+ Добавить оружие...</button>
    </div>
    <ItemPickerModal
      v-if="pickerOpen && block.content.item_type_id"
      :item-type-ids="[block.content.item_type_id]"
      title="Оружие"
      search-placeholder="Поиск оружия..."
      @close="pickerOpen = false"
      @pick="addWeapon"
    />

    <ItemViewModal
      v-if="modalItem"
      :item-type-id="block.content.item_type_id"
      :item-id="modalItem.id"
      :item="modalItem"
      @close="modalItemId = null"
    />

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.title"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    />
  </div>
</template>

<script>
let keyCounter = 0
function nextKey() { return ++keyCounter }
</script>

<script setup>
import { computed, inject, onMounted, provide, reactive, ref, watch } from 'vue'

import { BaseTile } from '@sylvieshare/share-ui'
import { useItemTypesStore } from '@/stores/itemTypes'
import WeaponCard from '@/features/character-editor/blocks/dnd/components/WeaponCard.vue'
import WeaponTableRow from '@/features/character-editor/blocks/dnd/components/WeaponTableRow.vue'
import { useWeaponCalc } from '@/features/character-editor/blocks/dnd/composables/useWeaponCalc'
import { useWeaponItems } from '@/features/character-editor/blocks/dnd/composables/useWeaponItems'
import {
  cleanEntry,
  defaultEntry,
  findFieldByKey,
  isSameCleanValue,
  normalizeAddAttacks,
  normalizeWeaponParams,
} from '@/features/character-editor/blocks/dnd/lib/weaponEntry'
import ItemPickerModal from "@/features/handbook/components/ItemPickerModal.vue"
import ItemTooltip from "@/features/character-editor/components/ItemTooltip"
import ItemViewModal from "@/features/handbook/components/ItemViewModal.vue"
import { useSortable } from '@sylvieshare/share-ui'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'
import { logSessionEntryAdded } from '@/features/character-editor/lib/sessionEntryEvents'
import { abilityModifiersBySuggest } from '@/features/character-editor/blocks/dnd/lib/weaponAbility'
import { hasItemProficiency } from '@/features/character-editor/lib/itemProficiency'
import {
  appendInventoryEntry,
  weaponEntryToOwnedEntry,
} from '@/features/character-editor/blocks/dnd/lib/itemPlacement'

const props = defineProps(['block', 'value', 'values', 'vars'])
const emit  = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: true, dictionaries: {}, var: {} }))
const suggestStore = useSuggestStore()

const entries                = ref([])
const modalItemId            = ref(null)
const inferredTagSuggestTypeId = ref(null)
const activeNoteKey          = ref(null)
const pickerOpen             = ref(false)
const tooltip                = reactive({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

const magicOptions = [0, 1, 2, 3].map(value => ({ value, label: value > 0 ? '+' + value : '0' }))

function suggestItems(typeId) {
  if (typeId == null) return []
  return suggestStore.items(typeId) || []
}

const tagSuggestTypeId    = computed(() => props.block.content.tag_suggest_type_id || inferredTagSuggestTypeId.value)
const statSuggests        = computed(() => suggestItems(props.block.content.stat_suggest_type_id))
const damageTypeSuggests  = computed(() => suggestItems(props.block.content.type_attack_suggest_type_id))
const tagSuggests         = computed(() => suggestItems(tagSuggestTypeId.value))

const statOptions        = computed(() => [
  { value: null, label: 'Авто' },
  ...statSuggests.value.map(s => ({ value: s.id, label: s.value })),
])
const damageTypeOptions  = computed(() => damageTypeSuggests.value.map(s => ({ value: s.id, label: s.value })))
const diceOptions        = SYSTEM_DICE.map(die => ({ value: die.id, label: die.value }))
const diceMap            = computed(() => Object.fromEntries(SYSTEM_DICE.map(die => [die.id, die.value])))
const diceDetailsMap     = computed(() => Object.fromEntries(SYSTEM_DICE.map(die => [die.id, die])))
const damageTypeMap      = computed(() => Object.fromEntries(damageTypeSuggests.value.map(s => [s.id, s.value])))
const damageTypeDetailsMap = computed(() => Object.fromEntries(damageTypeSuggests.value.map(s => [s.id, s])))
const tagMap             = computed(() => Object.fromEntries(tagSuggests.value.map(s => [s.id, s.value])))
const tagDetailsMap      = computed(() => Object.fromEntries(tagSuggests.value.map(s => [s.id, s])))

const statsVar    = computed(() => abilityModifiersBySuggest(props.values))
const profBonus   = computed(() => {
  const path = props.block.content.bonus_path
  if (!path) return 0
  return Number(path.split('.').reduce((cur, key) => cur?.[key], props.values)) || 0
})

function hasLinkedWeaponProficiency(entry) {
  return hasItemProficiency(item(entry), charCtx.values || props.values, suggestItems)
}

function isWeaponProficient(entry) {
  return !!entry.proficient || hasLinkedWeaponProficiency(entry)
}

const {
  itemMap,
  item,
  itemTitle,
  itemSubtitle,
  rangeLabel,
  propertyItems,
  itemBaseAttacks,
  itemTwoHandedAttacks,
  loadItems: loadItemsRaw,
  addItem,
} = useWeaponItems({ tagMap, tagDetailsMap })

const {
  magicBonus,
  attackBonus,
  damageBonus,
  formatBonus,
  damageExpression,
  damageExpressionTwoHanded,
  damageParts,
  damagePartsRaw,
  twoHandedParts,
} = useWeaponCalc({
  statsVar,
  profBonus,
  diceMap,
  diceDetailsMap,
  damageTypeMap,
  damageTypeDetailsMap,
  item,
  propertyItems,
  itemBaseAttacks,
  itemTwoHandedAttacks,
  isProficient: isWeaponProficient,
})

const modalItem   = computed(() => modalItemId.value != null ? itemMap.value[modalItemId.value] || null : null)
const variant     = computed(() => props.block.props?.variant || props.block.content?.variant || 'list')
const canAddItems = computed(() => !!charCtx.ownerMode)

const dice = useDiceStore()

function rollAttack(entry) {
  const bonus = attackBonus(entry)
  const expr = `1d20${bonus >= 0 ? '+' : ''}${bonus}`
  dice.roll(`Атака: ${itemTitle(entry)}`, expr, { crit_mode: true })
}

function rollDamage(entry) {
  const expr = damageExpression(entry)
  if (!expr || expr === '0') return
  dice.roll(`Урон: ${itemTitle(entry)}`, expr)
}

function rollDamageTwoHanded(entry) {
  const expr = damageExpressionTwoHanded(entry)
  if (!expr || expr === '0') return
  dice.roll(`Урон (2р): ${itemTitle(entry)}`, expr)
}

function loadItems() {
  return loadItemsRaw(entries.value)
}

async function ensureTagSuggestType() {
  if (tagSuggestTypeId.value || !props.block.content.item_type_id) return
  const type = await useItemTypesStore().ensureType(Number(props.block.content.item_type_id))
  const tagsField = findFieldByKey(type?.fields || [], 'tags')
  if (!tagsField?.suggest_id) return
  inferredTagSuggestTypeId.value = tagsField.suggest_id
  useSuggestStore().ensure(tagsField.suggest_id)
}

function emitChange() {
  emit('update:value', props.block.id, entries.value.map(cleanEntry))
}

function setField(index, field, value) {
  entries.value[index] = { ...entries.value[index], [field]: value }
  emitChange()
}

function setParam(index, field, value) {
  entries.value[index] = {
    ...entries.value[index],
    params: normalizeWeaponParams({ ...entries.value[index].params, [field]: value }),
  }
  emitChange()
}

function setAttackField(index, attackIndex, field, value) {
  const attacks = normalizeAddAttacks(entries.value[index].add_attacks)
  attacks[attackIndex] = { ...attacks[attackIndex], [field]: value }
  entries.value[index] = { ...entries.value[index], add_attacks: attacks }
  emitChange()
}

function addAttack(index) {
  const attacks = normalizeAddAttacks(entries.value[index].add_attacks)
  attacks.push({ count: 1, dice_id: null, type_suggest_id: null })
  entries.value[index] = { ...entries.value[index], add_attacks: attacks }
  emitChange()
}

function removeAttack(index, attackIndex) {
  const attacks = normalizeAddAttacks(entries.value[index].add_attacks)
  attacks.splice(attackIndex, 1)
  entries.value[index] = { ...entries.value[index], add_attacks: attacks }
  emitChange()
}

function addWeapon(it) {
  entries.value.push({ ...defaultEntry(), item_id: it.id, _key: nextKey() })
  addItem(it)
  emitChange()
  logSessionEntryAdded(charCtx, {
    kind: 'item', category: 'weapon', title: it.name, itemId: it.id,
  })
}

function deleteWeapon(index) {
  if (activeNoteKey.value === entries.value[index]?._key) activeNoteKey.value = null
  entries.value.splice(index, 1)
  emitChange()
}

function canMoveWeaponToItems(entry) {
  return !!charCtx.ownerMode
    && entry?.item_id != null
    && typeof charCtx.updateValues === 'function'
}

function moveWeaponToItems(index) {
  const entry = entries.value[index]
  if (!canMoveWeaponToItems(entry)) return
  const nextWeapons = entries.value.filter((_, entryIndex) => entryIndex !== index).map(cleanEntry)
  charCtx.updateValues({
    weapon: nextWeapons,
    items: appendInventoryEntry(charCtx.values?.items, weaponEntryToOwnedEntry(entry)),
  })
}

const sortable = useSortable({
  groups: { weapons: { items: entries } },
  getKey: e => e._key,
  onDrop: ({ item, toIndex }) => {
    const arr = [...entries.value]
    const srcIdx = arr.findIndex(e => e._key === item._key)
    if (srcIdx === -1) return
    const [moved] = arr.splice(srcIdx, 1)
    arr.splice(Math.min(toIndex, arr.length), 0, moved)
    entries.value = arr
    emitChange()
  },
})

const displayEntries = computed(() => sortable.displayItems('weapons'))

function onDragStart(e, entry, index) {
  if (!charCtx.ownerMode) return
  sortable.startDrag(e, entry, 'weapons', index)
}

function showPropertyTooltip(event, property) {
  if (!property.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const placeAbove = window.innerHeight - rect.bottom < 220
  Object.assign(tooltip, {
    visible: true, title: property.label, desc: property.desc,
    x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
    top: placeAbove ? null : rect.bottom + 8,
    bottom: placeAbove ? window.innerHeight - rect.top + 8 : null,
  })
}

function hidePropertyTooltip() { tooltip.visible = false }

provide('weaponsBlockCtx', reactive({
  charCtx,
  sortable,
  item,
  itemTitle,
  itemSubtitle,
  isWeaponProficient,
  hasLinkedWeaponProficiency,
  rangeLabel,
  propertyItems,
  magicBonus,
  attackBonus,
  damageBonus,
  formatBonus,
  damageParts,
  damagePartsRaw,
  twoHandedParts,
  rollAttack,
  rollDamage,
  rollDamageTwoHanded,
  showPropertyTooltip,
  hidePropertyTooltip,
  setField,
  setParam,
  setAttackField,
  addAttack,
  removeAttack,
  deleteWeapon,
  canMoveWeaponToItems,
  moveWeaponToItems,
  onDragStart,
  openItemModal: id => { modalItemId.value = id },
  toggleNote: key => { activeNoteKey.value = activeNoteKey.value === key ? null : key },
  activeNoteKey,
  statOptions,
  magicOptions,
  diceOptions,
  damageTypeOptions,
}))

watch(() => props.value, (nextValue, oldValue) => {
  if (oldValue !== undefined && isSameCleanValue(nextValue, entries.value)) return
  entries.value = (props.value || []).map(entry => ({
    ...defaultEntry(),
    ...entry,
    params: normalizeWeaponParams(entry.params),
    add_attacks: normalizeAddAttacks(entry.add_attacks),
    _key: entry._key || nextKey(),
  }))
  loadItems()
}, { immediate: true, deep: true })

onMounted(() => {
  [
    props.block.content.stat_suggest_type_id,
    props.block.content.type_attack_suggest_type_id,
    tagSuggestTypeId.value,
    4,
  ].filter(Boolean).forEach(id => suggestStore.ensure(id))
  ensureTagSuggestType()
})

</script>

<style scoped>
.weapons-block {
  min-width: 0;
  color: var(--text-1);
}

.w-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.w-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.w-table:not(.w-edit) .w-name-col { width: 30%; }
.w-table:not(.w-edit) .w-attack-col { width: 68px; }
.w-table:not(.w-edit) .w-damage-col { width: 30%; }
.w-table:not(.w-edit) .w-props-col { width: 40%; }

.w-table.w-edit .w-order-col { width: 28px; }
.w-table.w-edit .w-name-col { width: 25%; }
.w-table.w-edit .w-stat-col { width: 132px; }
.w-table.w-edit .w-magic-col { width: 72px; }
.w-table.w-edit .w-damage-col { width: auto; }
.w-table.w-edit .w-delete-col { width: 38px; }

.w-table th {
  padding: 0 6px 7px;
  border-bottom: 1px solid color-mix(in srgb, var(--text-muted) 30%, transparent);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-align: left;
  text-transform: uppercase;
}

.w-table td {
  min-height: 42px;
  padding: 8px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--text-muted) 18%, transparent);
  vertical-align: middle;
}

.w-table tbody tr:last-child td {
  border-bottom: none;
}

.w-props-sep {
  color: var(--text-muted);
}

.w-add {
  margin-top: 12px;
}

.w-picker-btn {
  width: 100%;
  min-height: 34px;
  border: 1px dashed color-mix(in srgb, var(--text-muted) 46%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 2%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.w-picker-btn:hover {
  color: var(--text-1);
  border-color: color-mix(in srgb, var(--text-2) 58%, transparent);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
}

.w-empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 16px 20px;
}

@media (max-width: 760px) {
  .w-list-header {
    display: none;
  }

  .w-card {
    padding: 0 0 0 16px;
  }

  .w-card-view,
  .w-card-view-edit {
    grid-template-columns: max-content minmax(0, 1fr);
    grid-template-areas:
      "title title"
      "attack damage"
      "props props";
    gap: 8px 12px;
  }

  .w-card-view .w-name-actions {
    position: absolute;
    top: 10px;
    right: 10px;
  }

  .w-card-order {
    position: absolute;
    top: 10px;
    left: 8px;
  }

  .w-card-editing .w-card-title {
    padding-left: 20px;
    padding-right: 58px;
  }

  .w-card-title {
    padding-right: 0;
  }

  .w-name-main {
    display: flex;
    width: 100%;
  }

  .w-name {
    font-size: 15px;
  }

  .w-range {
    margin-top: 4px;
    white-space: normal;
  }

  .w-attack-chip {
    justify-self: start;
    min-width: 72px;
    min-height: 36px;
  }

  .w-damage-view {
    align-self: center;
  }

  .w-props-inline {
    padding-top: 2px;
  }

  .w-card-edit-panel {
    grid-template-columns: 1fr;
  }

  .w-card-extra {
    max-width: none;
  }

  .w-card-edit-grid {
    grid-template-columns: 1fr 1fr;
  }

  .w-card-edit-grid .w-stat-select {
    grid-column: 1 / -1;
  }

  .w-extra-row {
    grid-template-columns: 32px minmax(0, 1fr) 30px;
  }

  .w-extra-row .w-type {
    grid-column: 2 / -1;
  }

  .w-empty { padding: 16px; }
}
</style>
