<template>
  <div v-show="!blockHidden" class="spells-block">

    <div v-if="spellcastingBlocked" class="sp-casting-warning" role="status">
      <strong>Сотворение заклинаний недоступно</strong>
      <span v-for="restriction in spellcastingRestrictions" :key="restriction.key">
        {{ restriction.message }}
      </span>
    </div>

    <SpellSlotsBar
      v-if="activeSlotPools.length || (canInteract && tabs.length)"
      :has-stat-config="false"
      :can-interact="canInteract"
      :stat-path="statPath"
      :stat-options="statOptions"
      :stat-label="statLabel"
      :save-d-c="saveDC"
      :attack-bonus="attackBonus"
      :save-bonus-extra="saveBonusExtra"
      :attack-bonus-extra="attackBonusExtra"
      :active-slot-pools="activeSlotPools"
      :slot-pools="slotPools"
      :casting-stats="[]"
      :show-casting-config="false"
      :show-stats="false"
      :show-slots="true"
      :show-slot-config="true"
      :automatic-slots="automaticSlots"
      @set-total="setTotal"
      @toggle-slot="toggleSlot"
      @set-automatic-slots="setAutomaticSlots"
    />

    <section v-if="grantedSpellsByLevel.length" class="sp-standalone">
      <div class="sp-standalone-title">Дарованные заклинания</div>
      <div class="spells-groups">
        <SectionList v-for="group in grantedSpellsByLevel" :key="`grant:${group.level}`" :title="groupTitle(group.level)">
          <SpellCard
            v-for="(entry, idx) in group.items"
            :key="entry.ref.key"
            :entry="entry"
            :level="group.level"
            :idx="idx"
            standalone
          />
        </SectionList>
      </div>
    </section>

    <nav class="sp-tabs" aria-label="Источники магии">
      <button
        v-for="tab in spellTabs"
        :key="tab.key"
        type="button"
        :class="{ active: activeSpellTab === tab.key }"
        @click="activeSpellTab = tab.key"
      >{{ tab.label }}</button>
      <button v-if="canInteract" type="button" class="sp-tab-add" @click="createTab">+ Вкладка</button>
    </nav>

    <div v-if="!tabs.length" class="spells-empty">Создай вкладку магии, чтобы добавлять заклинания.</div>

    <SpellSlotsBar
      v-if="activeTabSource && hasStatConfig"
      :has-stat-config="hasStatConfig"
      :can-interact="canInteract"
      :stat-path="statPath"
      :stat-options="statOptions"
      :stat-label="statLabel"
      :save-d-c="saveDC"
      :attack-bonus="attackBonus"
      :save-bonus-extra="saveBonusExtra"
      :attack-bonus-extra="attackBonusExtra"
      :active-slot-pools="activeSlotPools"
      :slot-pools="slotPools"
      :casting-stats="displayedSpellcastingStatRows"
      :show-casting-config="true"
      :casting-label="activeCastingLabel"
      :show-stats="true"
      :show-slots="false"
      :show-slot-config="false"
      external-editor
      :automatic-slots="automaticSlots"
      @edit="tabEditorOpen = true"
    />

    <!-- Заклинания по уровням (мультиколонки) -->
    <div v-if="activeTabSource" class="spells-groups">
      <div v-if="spellsByLevel.length === 0" class="spells-empty">
        Нет заклинаний
      </div>

      <div v-if="preparation && spellsByLevel.length" class="sp-prep-summary">
        <span class="sp-prep-total">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
            <path d="M6.5 3.5h11a.5.5 0 0 1 .5.5v16l-6-3.6L6 20V4a.5.5 0 0 1 .5-.5z" />
          </svg>
          Подготовлено: {{ preparedSummary.total }}
        </span>
        <span v-for="row in preparedSummary.perLevel" :key="row.level" class="sp-prep-chip">
          {{ row.level }} круг · {{ row.count }}
        </span>
      </div>

      <SectionList
        v-for="group in spellsByLevel"
        :key="group.level"
        :title="groupTitle(group.level)"
        transition-name="sp-row"
        :list-attrs="{ 'data-sortable-container': 'level-' + group.level }"
      >
        <SpellCard
          v-for="(entry, idx) in displayLevel(group.level)"
          :key="entry.ref.key"
          :entry="entry"
          :level="group.level"
          :idx="idx"
        />
      </SectionList>
    </div>

    <!-- Поиск / добавление -->
    <div v-if="canAddItems && activeTabSource" class="sp-add-section">
      <div v-if="knownRules" class="sp-known-summary">
        <span>{{ knownRules.label }}</span>
        <template v-if="knownRules.hasKnownProgression">
          <span v-if="knownRules.cantripsKnown != null">Заговоры <b>{{ knownCounts.cantrips }} / {{ knownRules.cantripsKnown }}</b></span>
          <span v-if="knownRules.spellsKnown != null">Заклинания <b>{{ knownCounts.spells }} / {{ knownRules.spellsKnown }}</b></span>
          <span v-if="knownRules.allowedSchoolIds.length">Вне основных школ <b>{{ knownCounts.unrestricted }} / {{ knownRules.unrestrictedSpells }}</b></span>
        </template>
        <span>Доступно до {{ selectedSourceMaxSpellLevel }} круга</span>
      </div>
      <button class="sp-picker-btn" @click="pickerOpen = true">+ Найти заклинание...</button>
    </div>

    <ItemPickerModal
      v-if="pickerOpen && block.content.item_type_id"
      :item-type-ids="[block.content.item_type_id]"
      :exclude-items="activeTabSpells.map(s => s.id)"
      :default-filters="spellPickerFilters"
      :item-eligibility="spellPickerEligibility"
      title="Заклинания"
      search-placeholder="Поиск заклинания..."
      @close="pickerOpen = false"
      @pick="addSpell"
    />

    <!-- Модалка с описанием заклинания -->
    <ItemViewModal
      v-if="modalSpell"
      :item-type-id="block.content.item_type_id ?? 5"
      :item-id="modalSpell.id"
      :item="modalSpell"
      @close="modalSpell = null"
    />

    <DndSpellbookSettingsModal
      v-if="tabEditorOpen && activeTab"
      :slot-pools="slotPools"
      :stat-path="activeTab.casting_ability"
      :stat-options="statOptions"
      :save-bonus="activeTab.save_bonus"
      :attack-bonus="activeTab.attack_bonus"
      :automatic-slots="automaticSlots"
      :tab-name="activeTab.name"
      :class-item-id="activeTab.class_item_id"
      :class-options="classTabOptions"
      :used-class-item-ids="usedClassItemIds"
      :mode="activeTab.mode"
      :casting-label="activeTab.name"
      show-casting-config
      show-tab-config
      :show-slot-config="false"
      allow-delete
      @set-tab-name="updateActiveTab('name', $event)"
      @set-class-item="setActiveTabClass"
      @set-mode="updateActiveTab('mode', $event)"
      @set-stat-path="updateActiveTab('casting_ability', $event)"
      @set-save-bonus="updateActiveTab('save_bonus', Number($event) || 0)"
      @set-attack-bonus="updateActiveTab('attack_bonus', Number($event) || 0)"
      @delete-tab="deleteTarget = activeTab"
      @close="tabEditorOpen = false"
    />

    <ConfirmDialog
      v-if="deleteTarget"
      title="Удалить вкладку магии?"
      :message="`Вкладка «${deleteTarget.name}» и её заклинания будут удалены.`"
      confirm-label="Удалить"
      @cancel="deleteTarget = null"
      @confirm="deleteTab"
    />

  </div>
</template>

<script setup>
import { ABILITY_VALUE_IDS } from '@/shared/lib/abilityTypes'

import { computed, inject, onMounted, provide, reactive, ref, watch } from 'vue'

import SpellCard from '@/features/character-editor/blocks/dnd/components/SpellCard.vue'
import SpellSlotsBar from '@/features/character-editor/blocks/dnd/components/SpellSlotsBar.vue'
import DndSpellbookSettingsModal from '@/features/character-editor/blocks/dnd/DndSpellbookSettingsModal.vue'
import { SectionList } from '@sylvieshare/share-ui'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import { useSpellRolls } from './composables/useSpellRolls'
import { useSpellPicker } from './composables/useSpellPicker'
import { useSpellbookTabs } from './composables/useSpellbookTabs'
import { useSpellbookEntries } from './composables/useSpellbookEntries'
import { useSpellCalc } from '@/features/character-editor/blocks/dnd/composables/useSpellCalc'
import { useSpellSlots } from '@/features/character-editor/blocks/dnd/composables/useSpellSlots'
import { countsTowardPreparation, formatBonus, groupTitle, spellSummary } from '@/features/character-editor/blocks/dnd/lib/spellEntry'
import { availableSpellSlotOptions as availableSlotOptions } from '@/features/character-editor/blocks/dnd/lib/spellUse'
import { collectCharacterSpellModifiers } from '@/features/character-editor/lib/characterSpellModifiers'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { useSuggestStore } from '@/stores/suggest'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'
import { spellcastingRulesAt } from '@/features/character-editor/blocks/dnd/lib/spellcastingRules'
import { maximumSpellLevelForEntry } from '@/features/character-editor/blocks/dnd/lib/multiclassSpellcasting'
import {
  grantedSpell,
  normalizedClassItemId,
  normalizedSpellTabs,
} from '@/features/character-editor/blocks/dnd/lib/spellbook'

const props = defineProps(['block', 'value', 'values'])
const emit  = defineEmits(['update:value'])
const charCtx       = inject('charCtx',       () => ({ ownerMode: true, dictionaries: {} }))
const setBlockHidden = inject('setBlockHidden', () => () => {})

const tabs       = ref([])
const grants     = ref([])
const itemMap    = reactive({})
const modalSpell = ref(null)
const pickerOpen = ref(false)
const classItemMap = reactive({})
const activeSpellTab = ref('')
const automaticSlots = ref(true)
const tabEditorOpen = ref(false)
const deleteTarget = ref(null)

const hasStatConfig = computed(() =>
  !!(props.block.content?.stat_suggest_type_id && props.block.content?.prof_bonus_path)
)
const statSuggests = computed(() => {
  const id = props.block.content?.stat_suggest_type_id
  return id != null ? useSuggestStore().items(id) || [] : []
})
const statOptions  = computed(() => statSuggests.value.map(item => ({ value: item.id, label: item.value })))
const damageTypeSuggestTypeId = computed(() => props.block.content?.type_attack_suggest_type_id || 12)
const damageTypeSuggests = computed(() => useSuggestStore().items(damageTypeSuggestTypeId.value) || [])
const diceMap = computed(() => Object.fromEntries(SYSTEM_DICE.map(die => [die.id, die.value])))
const diceDetailsMap = computed(() => Object.fromEntries(SYSTEM_DICE.map(die => [die.id, die])))
const damageTypeMap = computed(() => Object.fromEntries(damageTypeSuggests.value.map(s => [s.id, s.value])))
const damageTypeColorMap = computed(() => Object.fromEntries(damageTypeSuggests.value.map(s => [s.id, s.color])))
const profBonus    = computed(() => {
  const path = props.block.content?.prof_bonus_path
  if (!path) return 0
  return Number(path.split('.').reduce((cur, key) => cur?.[key], props.values)) || 0
})
const statMod = computed(() => {
  if (!statPath.value) return 0
  const stats = props.values?.stats || charCtx.var?.stats || {}
  return Number(stats[String(statPath.value)] ?? 0)
})
const charLevel = computed(() => Number(props.values?.lvl?.level) || 1)
const saveDC       = computed(() => 8 + profBonus.value + statMod.value + saveBonusExtra.value)
const attackBonus  = computed(() => profBonus.value + statMod.value + attackBonusExtra.value)
const statLabel    = computed(() =>
  statOptions.value.find(stat => String(stat.value) === String(statPath.value))?.label || ''
)
const canInteract  = computed(() => charCtx.ownerMode)
const canAddItems  = computed(() => !!charCtx.ownerMode)
const blockHidden  = computed(() =>
  props.block.hide_on_empty && !charCtx.ownerMode && !canAddItems.value && tabs.value.length === 0 && grants.value.length === 0
)
const armorState = computed(() => charCtx.characterArmor?.state || {})
const spellcastingRestrictions = computed(() => {
  const restrictions = []
  if (armorState.value.castingBlocked) {
    restrictions.push({
      key: 'armor-proficiency',
      message: `Нет владения экипировкой: ${(armorState.value.nonproficient || []).map(row => row.name).join(', ')}.`,
    })
  }
  for (const block of charCtx.characterDerivedEffects?.activityBlocks?.('spellcasting') || []) {
    restrictions.push({
      key: `effect:${block.key}`,
      message: [block.source, block.label].filter(Boolean).join(': ') || 'Активный эффект запрещает сотворение заклинаний.',
    })
  }
  return restrictions
})
const spellcastingBlocked = computed(() => spellcastingRestrictions.value.length > 0)
const spellTabs = computed(() => tabs.value.map((tab) => ({ key: tab.key, label: tab.name })))
const spellcastingSources = spellTabs
const activeTab = computed(() => tabs.value.find((tab) => tab.key === activeSpellTab.value) || null)
const activeTabSource = activeTab
const activeTabSpells = computed(() => activeTab.value?.spells || [])
const statPath = computed(() => activeTab.value?.casting_ability ?? '')
const saveBonusExtra = computed(() => Number(activeTab.value?.save_bonus) || 0)
const attackBonusExtra = computed(() => Number(activeTab.value?.attack_bonus) || 0)
const preparation = computed(() => ['prepared', 'spellbook'].includes(activeTab.value?.mode))
const activeCastingLabel = computed(() => activeTab.value?.name || '')
const classEntryForActiveTab = computed(() => (Array.isArray(props.values?.classes) ? props.values.classes : [])
  .find((entry) => normalizedClassItemId(entry?.id) === normalizedClassItemId(activeTab.value?.class_item_id)) || null)
const knownRules = computed(() => {
  const entry = classEntryForActiveTab.value
  if (!entry) return null
  const classItem = classItemMap[entry.id]
  const subclassItem = entry?.subclass?.id != null ? classItemMap[entry.subclass.id] : null
  const rules = spellcastingRulesAt(subclassItem, Number(entry.level) || 1)
    || spellcastingRulesAt(classItem, Number(entry.level) || 1)
  return rules ? { ...rules, listClassId: rules.listClassId ?? entry.id, entry } : null
})
const selectedSourceMaxSpellLevel = computed(() => knownRules.value
  ? maximumSpellLevelForEntry(knownRules.value.entry, classItemMap)
  : maxSlotLevel.value)
function castingStatRow(tab) {
  const modifier = statModifierForAbility(tab.casting_ability)
  return {
    key: tab.key,
    label: tab.name,
    ability: statOptions.value.find((stat) => String(stat.value) === String(tab.casting_ability))?.label || '—',
    saveDC: 8 + profBonus.value + modifier + (Number(tab.save_bonus) || 0),
    attackBonus: profBonus.value + modifier + (Number(tab.attack_bonus) || 0),
  }
}
const spellcastingStatRows = computed(() => tabs.value.map(castingStatRow))
const displayedSpellcastingStatRows = computed(() => spellcastingStatRows.value
  .filter((row) => row.key === activeTab.value?.key))
const classTabOptions = computed(() => (Array.isArray(props.values?.classes) ? props.values.classes : []).map((entry) => ({
  value: normalizedClassItemId(entry.id),
  label: classItemMap[entry.id]?.name || entry.name || `Класс #${entry.id}`,
})))
const usedClassItemIds = computed(() => tabs.value
  .filter((tab) => tab.key !== activeTab.value?.key && tab.class_item_id != null)
  .map((tab) => tab.class_item_id))

const schoolMap = computed(() => {
  const id = props.block.content?.school_suggest_id
  if (!id) return {}
  return Object.fromEntries(useSuggestStore().items(id).map(s => [s.id, s]))
})
const spellsByLevel = computed(() => {
  const groups = new Map()
  for (const spellRef of activeTabSpells.value) {
    const item = itemMap[spellRef.id]
    const lvl = item?.data?.lvl ?? -1
    if (!groups.has(lvl)) groups.set(lvl, [])
    groups.get(lvl).push({ ref: spellRef, item })
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([level, items]) => ({
    level,
    items,
    preparedCount: Number(level) > 0
      ? items.filter(entry => countsTowardPreparation(entry.ref, level)).length
      : 0,
  }))
})
const grantedSpellsByLevel = computed(() => {
  const groups = new Map()
  for (const spellRef of grants.value) {
    const item = itemMap[spellRef.id]
    const level = item?.data?.lvl ?? -1
    if (!groups.has(level)) groups.set(level, [])
    groups.get(level).push({ ref: spellRef, item })
  }
  return [...groups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([level, items]) => ({ level, items }))
})
const preparedSummary = computed(() => {
  let total = 0
  const perLevel = []
  for (const g of spellsByLevel.value) {
    if (!g.preparedCount) continue
    total += g.preparedCount
    perLevel.push({ level: g.level, count: g.preparedCount })
  }
  return { total, perLevel }
})
// ─── Watch blockHidden → notify parent ────────────

watch(blockHidden, v => setBlockHidden(v), { immediate: true })

function emitChange() {
  emit('update:value', props.block.id, {
    schema_version: 2,
    slots_auto: automaticSlots.value,
    slot_pools: serializedSlotPools(),
    tabs: tabs.value.map((tab) => ({
      key: tab.key,
      name: tab.name,
      class_item_id: tab.class_item_id ?? null,
      casting_ability: tab.casting_ability ?? '',
      mode: tab.mode,
      save_bonus: Number(tab.save_bonus) || 0,
      attack_bonus: Number(tab.attack_bonus) || 0,
      spells: (tab.spells || []).map((entry) => ({
        key: entry.key,
        id: entry.id,
        prepared: !!entry.prepared,
      })),
    })),
    grants: grants.value.map((entry) => ({ ...entry, source: { ...(entry.source || {}) } })),
  })
}

const {
  slotPools,
  activeSlotPools,
  loadSlotPools,
  serializedSlotPools,
  toggleSlot,
  setTotal,
  replaceTotals,
  adjustSlotUsed,
} = useSpellSlots({ canInteract, emitChange })

const maxSlotLevel = computed(() => Math.max(
  ...activeSlotPools.value.flatMap((pool) => pool.slots.map((slot) => Number(slot.level) || 0)),
  0,
))
const { knownCounts, spellPickerFilters, spellPickerEligibility } = useSpellPicker({
  activeTabSpells, grants, activeTab, itemMap, knownRules, selectedSourceMaxSpellLevel,
})

const {
  schoolMeta,
  spellMetaLine,
  damageDiceParts,
  healDiceParts,
  hasSpellMetrics,
} = useSpellCalc({ diceMap, diceDetailsMap, damageTypeMap, damageTypeColorMap, schoolMap,
  spellModifiers: computed(() => collectCharacterSpellModifiers(props.values,
    charCtx.characterResources?.itemsById?.value || charCtx.characterResources?.itemsById || new Map())),
})

const {
  updateActiveTab, createTab, setActiveTabClass, deleteTab, setAutomaticSlots, syncAutomaticSlotPools,
  spellCanPrepare, setSpellcastingSource, spellCastingAbility, statModifierForAbility,
  spellAttackBonus, spellSaveDC, spellAbilityLabel, loadClassItems,
} = useSpellbookTabs({
  props, charCtx, tabs, grants, activeTab, activeSpellTab, tabEditorOpen, classItemMap,
  deleteTarget, automaticSlots, replaceTotals, emitChange, profBonus, statOptions,
})
const {
  loadDetails, togglePrepared, removeSpell, sortable, displayLevel, onSpellDragStart,
  addSpell, abilityIds, syncExternalAbilitySpells,
} = useSpellbookEntries({
  props, charCtx, tabs, grants, itemMap, activeTabSpells, activeTab, preparation,
  spellsByLevel, emitChange, spellPickerEligibility, spellStatusSource,
})
const { spellTitle, spellAttackMode, spellDamagePreview, spellHealPreview, rollSpellAttack, rollSpellDamage, rollSpellHeal } = useSpellRolls({
  charCtx, spellcastingBlocked, spellAttackBonus, spellCastingAbility, charLevel, damageDiceParts, healDiceParts,
})

function openSpell(entry) {
  if (entry.item) modalSpell.value = entry.item
}

function spellStatusSource(entry) {
  return {
    kind: 'spell',
    item_id: entry?.item?.id ?? entry?.ref?.id ?? null,
    value_id: props.block.id,
    entry_key: String(entry?.ref?.key || ''),
    label: entry?.item?.name || 'Заклинание',
  }
}

function statusEffectLinks(entry) {
  return charCtx.characterStatuses?.links?.(entry?.item) || []
}

function statusEffectActive(entry, link) {
  return !!charCtx.characterStatuses?.linkedActive?.(entry?.item, link, spellStatusSource(entry))
}

function toggleSpellStatus(entry, link) {
  if (!charCtx.ownerMode || !link?.effect || typeof charCtx.updateValues !== 'function') return
  const active = statusEffectActive(entry, link)
  if (spellcastingBlocked.value && !active) return
  const states = charCtx.characterStatuses.toggleLinked(link.effect, entry.item, link, spellStatusSource(entry))
  charCtx.updateValues({ states })
  charCtx.logSessionEvent?.({
    type: 'status_effect',
    action: `${active ? 'Снят' : 'Добавлен'} эффект «${link.effect.name || entry.item.name}»`,
  })
}

function availableSpellSlotOptions(entry) {
  const level = Number(entry?.item?.data?.lvl) || 0
  if (entry?.ref?.slotless) return [{ pool: 'slotless', level: Number(entry?.ref?.cast_level) || level, remaining: null }]
  return availableSlotOptions(slotPools.value, level)
}

function useSpell(entry, slotOption) {
  if (!entry?.item || spellcastingBlocked.value) return
  const spellLevel = Number(entry?.item?.data?.lvl) || 0
  const option = typeof slotOption === 'object' && slotOption
    ? slotOption
    : { pool: 'long_rest', level: Number(slotOption) || 0 }
  if (spellLevel > 0 && !entry.ref?.slotless) {
    const available = availableSpellSlotOptions(entry)
    if (!available.some((candidate) => candidate.pool === option.pool && candidate.level === option.level)) return
    adjustSlotUsed(option.pool, option.level, 1)
  }
  charCtx.logSessionEvent?.({
    type: 'spell_used',
    action: `Использовано: ${spellTitle(entry)}`,
    data: {
      spellId: entry?.item?.id || entry?.ref?.id || null,
      spellLevel,
      slotLevel: spellLevel === 0 ? 0 : option.level,
      slotPool: spellLevel === 0 ? 'cantrip' : option.pool,
    },
  })
}

provide('spellsBlockCtx', reactive({
  charCtx,
  sortable,
  onSpellDragStart,
  togglePrepared,
  removeSpell,
  openSpell,
  schoolMeta,
  spellMetaLine,
  spellSummary,
  damageDiceParts,
  healDiceParts,
  hasSpellMetrics,
  formatBonus,
  spellAttackBonus,
  spellSaveDC,
  spellAbilityLabel,
  charLevel,
  maxSlotLevel,
  preparation,
  spellAttackMode, spellDamagePreview, spellHealPreview,
  rollSpellAttack,
  rollSpellDamage,
  rollSpellHeal,
  availableSpellSlotOptions,
  useSpell,
  spellcastingSources,
  activeTabKey: activeSpellTab,
  spellCanPrepare,
  setSpellcastingSource,
  spellcastingBlocked,
  statusEffectLinks,
  statusEffectActive,
  toggleSpellStatus,
}))

// ─── Lifecycle ─────────────────────────────────────

onMounted(async () => {
  const raw = props.value && typeof props.value === 'object' && !Array.isArray(props.value) ? props.value : {}
  tabs.value = normalizedSpellTabs(raw.tabs)
  grants.value = (Array.isArray(raw.grants) ? raw.grants : []).map(grantedSpell)
  automaticSlots.value = raw.slots_auto !== false
  loadSlotPools(raw)
  await loadClassItems(false)
  syncAutomaticSlotPools()
  const { school_suggest_id, stat_suggest_type_id } = props.block.content || {}
  const ensures = [school_suggest_id, stat_suggest_type_id, damageTypeSuggestTypeId.value]
    .filter(Boolean)
    .map(id => useSuggestStore().ensure(id))
  await Promise.all([syncExternalAbilitySpells(), ...ensures])
  await loadDetails()
})

watch(
  () => JSON.stringify({
    abilities: ABILITY_VALUE_IDS
      .flatMap((key) => Array.isArray(props.values?.[key]) ? props.values[key] : [])
      .map((entry) => ({ id: entry.id, choices: entry.choices })),
    items: props.values?.items,
    level: props.values?.lvl?.level,
    classes: props.values?.classes,
  }),
  () => {
    loadClassItems()
    if (grants.value.length || abilityIds().length) syncExternalAbilitySpells()
  },
)
</script>

<style scoped src="./styles/DndSpells.css"></style>
