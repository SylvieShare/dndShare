<template>
  <div class="weapons-block">
    <div v-if="armorAttackWarning" class="w-armor-warning">
      Атаки Силой и Ловкостью совершаются с помехой: нет владения {{ armorState.nonproficient.map(row => `«${row.name}»`).join(', ') }}.
    </div>
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

    <div class="w-preset-divider" role="separator" aria-label="Базовые атаки">
      <span>Базовые атаки</span>
    </div>
    <div class="w-preset-grid" aria-label="Базовые атаки">
      <PresetAttackCard
        title="Рукопашный удар"
        subtitle="Сила · урон 1 + модификатор"
        :attack-bonus="unarmedAttackBonus"
        :flat-damage="unarmedDamageFormula"
        damage-type="Дробящий"
        :icon-item="unarmedPresetItem"
        proficient
        @attack="rollPresetAttack('unarmed')"
        @damage="rollPresetDamage('unarmed')"
        @critical="rollPresetDamage('unarmed', true)"
      />
      <PresetAttackCard
        title="Импровизированное оружие"
        subtitle="Сила · без владения"
        :attack-bonus="improvisedAttackBonus"
        :damage-parts="improvisedDamageParts"
        :damage-modifier="strengthModifier + presetDamageBonus"
        :icon-item="improvisedPresetItem"
        @attack="rollPresetAttack('improvised')"
        @damage="rollPresetDamage('improvised')"
        @critical="rollPresetDamage('improvised', true)"
      />
    </div>

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
import PresetAttackCard from '@/features/character-editor/blocks/dnd/components/PresetAttackCard.vue'
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
import { abilityModifiersBySuggest, isFinesseWeapon, weaponAbilitySuggestId } from '@/features/character-editor/blocks/dnd/lib/weaponAbility'
import { hasItemProficiency } from '@/features/character-editor/lib/itemProficiency'
import {
  appendInventoryEntry,
  weaponEntryToOwnedEntry,
} from '@/features/character-editor/blocks/dnd/lib/itemPlacement'
import { selectedWeaponDamageExpression } from '@/features/character-editor/blocks/dnd/lib/weaponDamageAction'
import {
  improvisedWeaponAttackBonus as resolveImprovisedWeaponAttackBonus,
  PRESET_ATTACK_ART_ITEM_IDS,
  presetDamageExpression as resolvePresetDamageExpression,
  unarmedStrikeAttackBonus,
  unarmedStrikeDamage,
} from '@/features/character-editor/blocks/dnd/lib/presetAttacks'

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
  return hasItemProficiency(
    item(entry),
    charCtx.values || props.values,
    suggestItems,
    charCtx.characterDerivedEffects?.grantedProficiencies?.('weapon_proficiency') || [],
  )
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
  attackBonus: baseAttackBonus,
  damageBonus,
  formatBonus,
  damageExpression,
  damageExpressionTwoHanded,
  criticalDamageExpression,
  criticalDamageExpressionTwoHanded,
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
  damageBonusModifier: entry => charCtx.characterDerivedEffects?.bonus?.('weapon_damage_bonus', weaponEffectContext(entry))?.total || 0,
})

function weaponEffectContext(entry) {
  const base = item(entry)
  return {
    kind: 'attack',
    abilitySuggestId: weaponAbilitySuggestId(entry, base, propertyItems(entry), statsVar.value),
    weaponKind: base?.data?.is_long_range ? 'ranged' : 'melee',
    targetId: entry.uid,
  }
}

function attackBonus(entry) {
  return baseAttackBonus(entry) + (charCtx.characterDerivedEffects?.bonus?.('weapon_attack_bonus', weaponEffectContext(entry))?.total || 0)
}

const modalItem   = computed(() => modalItemId.value != null ? itemMap.value[modalItemId.value] || null : null)
const variant     = computed(() => props.block.props?.variant || props.block.content?.variant || 'list')
const canAddItems = computed(() => !!charCtx.ownerMode)
const armorState = computed(() => charCtx.characterArmor?.state || {})
const armorAttackWarning = computed(() => !!armorState.value.strengthDexDisadvantage)
const strengthModifier = computed(() => Number(statsVar.value['1']) || 0)
const unarmedAttackBonus = computed(() => unarmedStrikeAttackBonus(strengthModifier.value, profBonus.value))
const improvisedAttackBonus = computed(() => resolveImprovisedWeaponAttackBonus(strengthModifier.value))
const presetDamageBonus = computed(() => charCtx.characterDerivedEffects?.bonus?.('weapon_damage_bonus', {
  kind: 'attack', abilitySuggestId: 1, weaponKind: 'melee',
})?.total || 0)
const unarmedDamage = computed(() => unarmedStrikeDamage(strengthModifier.value, presetDamageBonus.value))
const unarmedDamageFormula = computed(() => ({
  base: 1,
  modifier: strengthModifier.value + presetDamageBonus.value,
  total: unarmedDamage.value,
}))
const improvisedDamageParts = [{ count: 1, diceSides: 4, diceLabel: 'd4', type: 'Дробящий', typeColor: 'var(--warning)' }]
const unarmedPresetItem = computed(() => itemMap.value[PRESET_ATTACK_ART_ITEM_IDS.unarmed] || null)
const improvisedPresetItem = computed(() => itemMap.value[PRESET_ATTACK_ART_ITEM_IDS.improvised] || null)

const dice = useDiceStore()

function rollAttack(entry) {
  const bonus = attackBonus(entry)
  const context = weaponEffectContext(entry)
  const resolved = charCtx.characterRolls?.resolve?.('auto', context)
  const mode = resolved?.mode || (armorAttackWarning.value && ['1', '2'].includes(String(context.abilitySuggestId)) ? 'disadvantage' : 'normal')
  dice.rollD20(`Атака: ${itemTitle(entry)}`, bonus, mode, {
    crit_mode: true,
    critical_threshold: charCtx.characterDerivedEffects?.criticalThreshold?.(context) || 20,
    roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('attack') || [],
  })
}

function presetAttackDefinition(kind) {
  if (kind === 'unarmed') {
    return { title: 'Рукопашный удар', attackBonus: unarmedAttackBonus.value }
  }
  return { title: 'Импровизированное оружие', attackBonus: improvisedAttackBonus.value }
}

function rollPresetAttack(kind) {
  const preset = presetAttackDefinition(kind)
  const context = { kind: 'attack', abilitySuggestId: 1, weaponKind: 'melee' }
  const resolved = charCtx.characterRolls?.resolve?.('auto', context)
  const mode = resolved?.mode || (armorAttackWarning.value ? 'disadvantage' : 'normal')
  dice.rollD20(`Атака: ${preset.title}`, preset.attackBonus, mode, {
    crit_mode: true,
    critical_threshold: charCtx.characterDerivedEffects?.criticalThreshold?.(context) || 20,
    roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('attack') || [],
  })
}

function presetDamageExpression(kind, critical) {
  return resolvePresetDamageExpression(kind, strengthModifier.value, critical, presetDamageBonus.value)
}

function rollPresetDamage(kind, critical = false) {
  const preset = presetAttackDefinition(kind)
  dice.roll(`${critical ? 'Критический урон' : 'Урон'}: ${preset.title}`, presetDamageExpression(kind, critical))
}

function rollDamage(entry, { critical = false, twoHanded = false, actionKeys = [] } = {}) {
  const baseExpression = critical
    ? (twoHanded ? criticalDamageExpressionTwoHanded(entry, extraCriticalDice(entry)) : criticalDamageExpression(entry, extraCriticalDice(entry)))
    : (twoHanded ? damageExpressionTwoHanded(entry) : damageExpression(entry))
  const actions = weaponDamageActions(entry)
  const primary = damagePartsRaw(entry)[0] || {}
  const expr = selectedWeaponDamageExpression({ baseExpression, actions, actionKeys, critical, damageType: primary.type, damageTypeColor: primary.typeColor })
  if (!expr || expr === '0') return
  const labels = actions.filter(action => actionKeys.includes(action.key)).map(action => action.label || action.source_label)
  dice.roll(`${critical ? 'Критический урон' : 'Урон'}${twoHanded ? ' (2р)' : ''}: ${itemTitle(entry)}${labels.length ? ` — ${labels.join(', ')}` : ''}`, expr)
}

function hasWeaponDamage(entry) {
  return damagePartsRaw(entry).length > 0 || damageBonus(entry) !== 0
}

function weaponDamageContext(entry) {
  const base = item(entry)
  const ranged = !!base?.data?.is_long_range
  return {
    melee: !ranged,
    ranged,
    finesse: isFinesseWeapon(base, propertyItems(entry)),
  }
}

function weaponDamageActions(entry) {
  return charCtx.characterCombatEffects?.weaponDamageActions?.(weaponDamageContext(entry)) || []
}

function extraCriticalDice(entry) {
  return charCtx.characterCombatEffects?.extraCriticalWeaponDice?.({
    melee: !item(entry)?.data?.is_long_range,
  }) || 0
}

function loadItems() {
  return loadItemsRaw([
    ...entries.value,
    { item_id: PRESET_ATTACK_ART_ITEM_IDS.unarmed },
    { item_id: PRESET_ATTACK_ART_ITEM_IDS.improvised },
  ])
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
  const entry = { ...defaultEntry(), item_id: it.id }
  entries.value.push({ ...entry, _key: entry.uid })
  addItem(it)
  emitChange()
  logSessionEntryAdded(charCtx, {
    kind: 'item', category: 'weapon', title: it.name, itemId: it.id,
  })
}

function deleteWeapon(index) {
  const entry = entries.value[index]
  if (activeNoteKey.value === entry?._key) activeNoteKey.value = null
  entries.value.splice(index, 1)
  const nextWeapons = entries.value.map(cleanEntry)
  if (typeof charCtx.updateValues === 'function') {
    const patch = { [props.block.id]: nextWeapons }
    if (typeof charCtx.characterStatuses?.removeByParam === 'function') {
      patch.states = charCtx.characterStatuses.removeByParam('weapon_uid', entry?.uid)
    }
    charCtx.updateValues(patch)
  } else {
    emit('update:value', props.block.id, nextWeapons)
  }
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
  const patch = {
    weapon: nextWeapons,
    items: appendInventoryEntry(charCtx.values?.items, weaponEntryToOwnedEntry(entry)),
  }
  if (typeof charCtx.characterStatuses?.removeByParam === 'function') {
    patch.states = charCtx.characterStatuses.removeByParam('weapon_uid', entry.uid)
  }
  charCtx.updateValues(patch)
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
  hasWeaponDamage,
  weaponDamageActions,
  rollAttack,
  rollDamage,
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
  entries.value = (props.value || []).map(entry => {
    const normalized = {
      ...defaultEntry(),
      ...entry,
      params: normalizeWeaponParams(entry.params),
      add_attacks: normalizeAddAttacks(entry.add_attacks),
    }
    return { ...normalized, _key: entry._key || normalized.uid || nextKey() }
  })
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

<style scoped src="./DndWeapons.css"></style>
