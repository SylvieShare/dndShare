<template>
  <div class="weapons-block">
    <p v-if="loadError" role="alert">{{ loadError }} <ActionButton variant="secondary" @click="reload">Повторить</ActionButton></p>
    <p v-if="damageRolls.error.value" role="alert">{{ damageRolls.error.value }}</p>
    <p v-if="weaponUses.error.value" role="alert">{{ weaponUses.error.value }}</p>
    <p v-if="weaponMechanics.error.value" role="alert">{{ weaponMechanics.error.value }}</p>
    <div v-if="armorAttackWarning" class="w-armor-warning">
      Атаки Силой и Ловкостью совершаются с помехой: нет владения {{ armorState.nonproficient.map(row => `«${row.name}»`).join(', ') }}.
    </div>
    <SectionList embedded aria-label="Оружие">
      <template #body>
        <div v-if="variant !== 'list' && entries.length" class="weapon-table-tiles" data-sortable-container="weapons">
          <BaseTile v-for="(entry, index) in displayEntries" :key="entry._key" :outlined="false"
            class="weapon-table-tile" :data-sortable-key="entry._key">
            <table class="w-table" :class="{ 'w-edit': charCtx.ownerMode }">
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
              <tbody>
                <WeaponTableRow
                  :entry="entry"
                  :index="index"
                />
              </tbody>
            </table>
          </BaseTile>
        </div>
        <div v-else class="weapon-card-grid" data-sortable-container="weapons">
          <div v-if="!entries.length" class="w-empty">Нет оружия</div>
          <WeaponCard v-for="(entry, index) in displayEntries" :key="entry._key" :entry="entry" :index="index" />
        </div>
      </template>
      <template v-if="canAddItems" #footer>
        <AddButton block label="Добавить оружие" @click="pickerOpen = true" />
      </template>
    </SectionList>

    <SectionList :outlined="false" title="Базовые атаки">
      <PresetAttackCard
        title="Рукопашный удар"
        subtitle="Сила · урон 1 + модификатор"
        :attack-bonus="unarmedAttackBonus"
        damage-type="Дробящий"
        :icon-item="unarmedPresetItem"
        :summary="(options, scope) => presetMenuSummary('unarmed', options, scope)"
        proficient
        @attack="options => rollPresetAttack('unarmed', options)"
        @damage="rollPresetDamage('unarmed')"
        @critical="rollPresetDamage('unarmed', true)"
      />
      <PresetAttackCard
        title="Импровизированное оружие"
        subtitle="Сила · без владения"
        :attack-bonus="improvisedAttackBonus"
        :icon-item="improvisedPresetItem"
        :summary="(options, scope) => presetMenuSummary('improvised', options, scope)"
        @attack="options => rollPresetAttack('improvised', options)"
        @damage="rollPresetDamage('improvised')"
        @critical="rollPresetDamage('improvised', true)"
      />
    </SectionList>

    <ItemPickerModal
      configure-instance
      v-if="pickerOpen && block.content.item_type_id"
      :item-type-ids="[block.content.item_type_id, 19]"
      :item-eligibility="weaponEligibility"
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
      :instance="modalEntry"
      :base-item="itemMap[modalEntry?.item_id]"
      @close="modalEntry = null"
    />

    <ConfirmDialog v-if="pendingMagicRemoval" title="Удалить предмет?" message="Экземпляр будет удалён из инвентаря вместе с его настройкой и зарядами. Чтобы сохранить его, выберите «Переместить в вещи»." :z-index="4600" @confirm="discardWeapon(pendingMagicRemoval.uid); pendingMagicRemoval = null" @cancel="pendingMagicRemoval = null" @close="pendingMagicRemoval = null" />
    <MagicItemInstanceModal v-if="magicInstance && itemMap[magicInstance.magic_item_id]" :item="itemMap[magicInstance.magic_item_id]" :uid="magicInstance.uid" :values="values" @update:values="patch => charCtx.updateValues(patch)" @close="magicInstance = null" />

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

<script setup>
import { STAT_FULL, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { weaponUseDamageSelection } from '@/features/character-editor/lib/weaponUseDamage'
import { itemEventData } from '@/features/character-editor/lib/sessionEventData'

import { computed, inject, onMounted, provide, reactive, ref } from 'vue'
import { AddButton, ActionButton, BaseTile, ConfirmDialog, SectionList } from '@sylvieshare/share-ui'
import { useItemTypesStore } from '@/stores/itemTypes'
import WeaponCard from '@/features/character-editor/blocks/dnd/components/WeaponCard.vue'
import WeaponTableRow from '@/features/character-editor/blocks/dnd/components/WeaponTableRow.vue'
import PresetAttackCard from '@/features/character-editor/blocks/dnd/components/PresetAttackCard.vue'
import { useWeaponEntries } from './composables/useWeaponEntries'
import { useWeaponMechanics } from './composables/useWeaponMechanics'
import { createWeaponInstance, intrinsicWeaponBonus } from '@/features/character-editor/lib/magicWeapons'
import MagicItemInstanceModal from './components/MagicItemInstanceModal.vue'
import { useWeaponCalc } from '@/features/character-editor/blocks/dnd/composables/useWeaponCalc'
import { useWeaponItems } from '@/features/character-editor/blocks/dnd/composables/useWeaponItems'
import {
  cleanEntry,
  defaultEntry,
  findFieldByKey,
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
import { useWeaponUses } from './composables/useWeaponUses'
import { useWeaponDamageRolls } from './composables/useWeaponDamageRolls'
import { weaponUseDamageActions } from '@/features/character-editor/lib/weaponUseDamage'
import { resolveRollMode } from './lib/rollMode'
import { prepareWeaponRollEntry, withWeaponThrowAction } from './lib/weaponThrow'
import { useTwoWeaponFighting } from './composables/useTwoWeaponFighting'
import { PRESET_ATTACK_ART_ITEM_IDS } from './lib/presetAttacks'
import { usePresetAttacks } from './composables/usePresetAttacks'

const props = defineProps(['block', 'value', 'values', 'vars'])
const emit  = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: true, dictionaries: {}, var: {} }))
const suggestStore = useSuggestStore()
const weaponMechanics = useWeaponMechanics(charCtx)

const modalEntry             = ref(null)
const inferredTagSuggestTypeId = ref(null)
const activeNoteKey          = ref(null)
const pickerOpen             = ref(false)
const tooltip                = reactive({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

const magicInstance = ref(null)
const pendingMagicRemoval = ref(null)
function weaponEligibility(it) { return { eligible: Number(it.typeId) === 1 || Number(it.typeId) === 19 && !!it.data?.weapon, reasons: ['У предмета не задано использование как оружия.'] } }
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

const { entries, emitChange, loadError, reload } = useWeaponEntries({
  props, emit, charCtx, itemMap,
  loadItems: list => loadItemsRaw([...list, ...Object.values(PRESET_ATTACK_ART_ITEM_IDS).map(item_id => ({ item_id }))]),
})

const bonusActionDamageOption = useTwoWeaponFighting(charCtx, { item, propertyItems, actions: weaponDamageActions })
const {
  magicBonus,
  statMod,
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
  magicBonusModifier: entry => intrinsicWeaponBonus(entry, item(entry), props.values),
  damageBonusModifier: entry => charCtx.characterDerivedEffects?.bonus?.('weapon_damage_bonus', weaponEffectContext(entry))?.total || 0,
  bonusActionDamageOption,
})

function weaponEffectContext(entry) {
  const base = item(entry)
  return {
    kind: 'attack',
    abilitySuggestId: weaponAbilitySuggestId(entry, base, propertyItems(entry), statsVar.value),
    weaponKind: entry._attackMode === 'thrown' || base?.data?.is_long_range ? 'ranged' : 'melee',
    targetId: entry.uid, weaponAttack: true, improvisedWeapon: !!entry._improvisedThrow,
  }
}

function weaponAbilityName(entry) {
  const id = weaponEffectContext(entry).abilitySuggestId
  return statSuggests.value.find(stat => String(stat.id) === String(id))?.value || STAT_FULL[SUGGEST16_TO_STAT[id]] || 'Характеристика'
}

function modifierSources(entry, damage) {
  const rows = []
  function add(source, value) { if (value) rows.push({ source, expression: String(value) }) }
  const stat = statMod(entry)
  add(weaponAbilityName(entry), damage && entry._bonusActionDamage && !bonusActionDamageOption(entry)?.addAbilityModifier ? Math.min(0, stat) : stat)
  add('Магия оружия', magicBonus(entry))
  if (!damage && !entry._improvisedThrow && isWeaponProficient(entry)) add('Владение', profBonus.value)
  const bonus = charCtx.characterDerivedEffects?.bonus?.(damage ? 'weapon_damage_bonus' : 'weapon_attack_bonus', weaponEffectContext(entry))
  for (const part of bonus?.contributions || []) add(part.source, part.value)
  return rows
}

function weaponBaseSources(entry, expression, { critical = false, twoHanded = false } = {}) {
  const rules = critical && !entry._improvisedThrow
    ? charCtx.characterCombatEffects?.criticalWeaponDiceRules?.(criticalDiceContext(entry)) || [] : []
  const base = rules.length
    ? (twoHanded ? criticalDamageExpressionTwoHanded(entry, 0) : criticalDamageExpression(entry, 0)) : expression
  const dice = damageBonus(entry) ? base.replace(/(?:^|[+-])\d+(?:\{[^}]*\})?$/, '') : base
  const rows = dice ? [{ source: 'Оружие', expression: dice }] : []
  const die = expression !== base && dice.match(/^\d+(d\d+(?:\{[^}]*\})?)/i)
  if (die) for (const rule of rules) rows.push({ source: rule.source_label, expression: rule.extra_weapon_dice + die[1] })
  return [...rows, ...modifierSources(entry, true)]
}

function weaponMenuSummary(entry, options, scope) {
  const use = weaponUses.choices(entry).find(rule => rule.key === options.weaponUseKey)
  const prepaid = weaponUseDamageSelection(charCtx.values, entry.uid, options.actionKeys || []).action
  const mode = use?.attack_mode || prepaid?.prepaid.attackMode
  const prepared = mode ? { ...entry, _attackMode: mode, _improvisedThrow: false }
    : prepareWeaponRollEntry(entry, item(entry), propertyItems(entry), weaponDamageActions(entry), options.actionKeys)
  const context = weaponEffectContext(prepared)
  return { title: itemTitle(entry), item: item(entry), ability: weaponAbilityName(prepared),
    bonus: attackBonus(prepared), mode: attackMode(context, options.attackRollMode),
    parts: scope === 'damage' ? damageRolls.previewSources(entry, options) : modifierSources(prepared, false) }
}

function attackBonus(entry) {
  return baseAttackBonus(entry) + (charCtx.characterDerivedEffects?.bonus?.('weapon_attack_bonus', weaponEffectContext(entry))?.total || 0)
}

const modalItem = computed(() => modalEntry.value ? itemMap.value[modalEntry.value.magic_item_id ?? modalEntry.value.item_id] : null)
const variant     = computed(() => props.block.props?.variant || props.block.content?.variant || 'list')
const canAddItems = computed(() => !!charCtx.ownerMode)
const armorState = computed(() => charCtx.characterArmor?.state || {})
const armorAttackWarning = computed(() => !!armorState.value.strengthDexDisadvantage)

const dice = useDiceStore()
const { unarmedAttackBonus, improvisedAttackBonus, unarmedPresetItem, improvisedPresetItem, presetMenuSummary, rollPresetAttack, rollPresetDamage }
  = usePresetAttacks(charCtx, { statsVar, profBonus, itemMap, attackMode, dice })

const weaponUses = useWeaponUses(charCtx, { title: itemTitle, attack: rollPreparedAttack, prepare(entry, rule) {
  const prepared = { ...entry, _attackMode: rule.attack_mode, _improvisedThrow: false }
  const expression = damageExpression(prepared)
  const criticalExpression = criticalDamageExpression(prepared, extraCriticalDice(prepared))
  return {
    entry: prepared, expression, critical_expression: criticalExpression,
    base_sources: weaponBaseSources(prepared, expression),
    critical_base_sources: weaponBaseSources(prepared, criticalExpression, { critical: true }),
    critical_threshold: charCtx.characterDerivedEffects?.criticalThreshold?.(weaponEffectContext(prepared)) || 20,
  }
} })
function rollAttack(entry, { actionKeys = [], weaponUseKey = '', attackRollMode = 'auto', excludedBonuses = [] } = {}) {
  if (weaponUseKey) return weaponUses.start(entry, weaponUseKey, attackRollMode, excludedBonuses)
  entry = prepareWeaponRollEntry(entry, item(entry), propertyItems(entry), weaponDamageActions(entry), actionKeys)
  return rollPreparedAttack(entry, `Атака: ${itemTitle(entry)}`, true, undefined, attackRollMode, excludedBonuses)
}
async function rollPreparedAttack(entry, title, log = true, onReroll, attackRollMode = 'auto', excludedBonuses = []) {
  const bonus = attackBonus(entry)
  const context = weaponEffectContext(entry)
  const mode = attackMode(context, attackRollMode)
  const result = await dice.rollD20(title, bonus, mode, { log, onReroll, roll_kind: 'attack',
    eventData: { ...itemEventData({ ...item(entry), id: entry.magic_item_id || entry.item_id || item(entry)?.id }, entry.uid), attackRoll: true },
    crit_mode: true,
    critical_threshold: charCtx.characterDerivedEffects?.criticalThreshold?.(context) || 20,
    bonus_formula: charCtx.characterDerivedEffects?.rollBonus?.({ kind: 'attack' }, excludedBonuses),
      roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('attack') || [],
  })
  if (!result) return null
  const states = charCtx.characterStatuses?.endOn?.('attack')
  if (charCtx.ownerMode && states) charCtx.updateValues({ states })
  return result
}

function attackMode(context, manualMode) {
  return charCtx.characterRolls?.resolve?.(manualMode, context)?.mode || resolveRollMode(manualMode,
    armorAttackWarning.value && ['1', '2'].includes(String(context.abilitySuggestId)) ? [{ mode: 'disadvantage' }] : []).mode
}

const damageRolls = useWeaponDamageRolls(charCtx, { item, propertyItems, weaponDamageActions, damagePartsRaw,
  damageExpression, damageExpressionTwoHanded, criticalDamageExpression, criticalDamageExpressionTwoHanded,
  weaponBaseSources, bonusActionDamageOption, extraCriticalDice, itemTitle, spend: weaponMechanics.spend, planWeaponUse: weaponUses.plan })
const { damagePreview, rollDamage } = damageRolls

function hasWeaponDamage(entry) {
  return damagePartsRaw(entry).length > 0 || damageBonus(entry) !== 0
}

function weaponDamageContext(entry) {
  const base = item(entry)
  const ranged = !!base?.data?.is_long_range
  return {
    weaponUid: entry.uid,
    melee: !entry._improvisedThrow && !ranged,
    ranged: !entry._improvisedThrow && ranged,
    finesse: !entry._improvisedThrow && isFinesseWeapon(base, propertyItems(entry)),
  }
}

function weaponDamageActions(entry) {
  return [...weaponUseDamageActions(charCtx.values, entry.uid), ...weaponMechanics.bind(withWeaponThrowAction(charCtx.characterCombatEffects?.weaponDamageActions?.(weaponDamageContext(entry)) || [], item(entry), propertyItems(entry)))].map(action => {
    const type = action.damage_type != null ? suggestStore.items(12).find(row => Number(row.id) === Number(action.damage_type)) : null
    return action.damage_type != null ? { ...action, damage_type_label: type?.value || `Тип урона #${action.damage_type}`, damage_type_color: type?.color } : action
  })
}

function criticalDiceContext(entry) {
  return { weaponUid: entry.uid, melee: entry._attackMode !== 'thrown' && !item(entry)?.data?.is_long_range }
}

function extraCriticalDice(entry) {
  return entry._improvisedThrow ? 0 : charCtx.characterCombatEffects?.extraCriticalWeaponDice?.(criticalDiceContext(entry)) || 0
}

async function ensureTagSuggestType() {
  if (tagSuggestTypeId.value || !props.block.content.item_type_id) return
  const type = await useItemTypesStore().ensureType(Number(props.block.content.item_type_id))
  const tagsField = findFieldByKey(type?.fields || [], 'tags')
  if (!tagsField?.suggest_id) return
  inferredTagSuggestTypeId.value = tagsField.suggest_id
  useSuggestStore().ensure(tagsField.suggest_id)
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

function addWeapon(it, quantity = 1, params = {}) {
  if (!weaponEligibility(it).eligible) return
  const count = Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1)))
  const added = Array.from({ length: count }, () => createWeaponInstance(it, { ...defaultEntry(), item_id: it.id, params: JSON.parse(JSON.stringify(params)) }))
  if (Number(it.typeId) === 19 && !added[0].magic_item_id) return
  entries.value.push(...added.map(entry => ({ ...entry, _key: entry.uid })))
  addItem(it)
  emitChange()
  logSessionEntryAdded(charCtx, {
    kind: 'item', category: 'weapon', title: it.name, itemId: it.id, count,
  })
}

function deleteWeapon(index) {
  const entry = entries.value[index]
  if (entry?.magic_item_id) { pendingMagicRemoval.value = entry; return }
  discardWeapon(entry.uid)
}
function discardWeapon(uid) {
  if (activeNoteKey.value === uid) activeNoteKey.value = null
  entries.value = entries.value.filter(row => row.uid !== uid)
  const patch = { [props.block.id]: entries.value.map(cleanEntry) }
  if (charCtx.characterStatuses?.removeByParam) patch.states = charCtx.characterStatuses.removeByParam('weapon_uid', uid)
  if (charCtx.updateValues) charCtx.updateValues(patch)
  else emitChange()
}

function canMoveWeaponToItems(entry) {
  return !!charCtx.ownerMode
    && entry?.item_id != null
    && typeof charCtx.updateValues === 'function'
}

function moveWeaponToItems(index) {
  const entry = entries.value[index]
  if (!canMoveWeaponToItems(entry)) return
  const nextWeapons = entries.value.filter((row, entryIndex) => entryIndex !== index).map(cleanEntry)
  const patch = {
    weapon: nextWeapons,
    items: appendInventoryEntry(charCtx.values?.items, weaponEntryToOwnedEntry(entry)),
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
  itemMap,
  openMagicInstance: entry => { magicInstance.value = entry },
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
  weaponUses: weaponUses.choices,
  weaponResources: weaponMechanics.weaponResources,
  toggleWeaponResource: weaponMechanics.toggleResource,
  rollAttack,
  rollDamage,
  rollWeaponUseStep: weaponUses.rollStep,
  damagePreview,
  damageSources: damageRolls.previewSources,
  weaponMenuSummary,
  bonusActionDamageOption,
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
  openItemModal: entry => { modalEntry.value = entry },
  toggleNote: key => { activeNoteKey.value = activeNoteKey.value === key ? null : key },
  activeNoteKey,
  statOptions,
  magicOptions,
  diceOptions,
  damageTypeOptions,
}))

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
