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
        <BaseTile v-for="group in grantedSpellsByLevel" :key="`grant:${group.level}`" class="spell-group">
          <div class="sg-header">
            <span class="sg-lvl">{{ groupTitle(group.level) }}</span>
            <span class="sg-line"></span>
          </div>
          <div class="sg-spells">
            <SpellCard
              v-for="(entry, idx) in group.items"
              :key="entry.ref.key"
              :entry="entry"
              :level="group.level"
              :idx="idx"
              standalone
            />
          </div>
        </BaseTile>
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

      <BaseTile v-for="group in spellsByLevel" :key="group.level" class="spell-group">
        <div class="sg-header">
          <span class="sg-lvl">{{ groupTitle(group.level) }}</span>
          <span class="sg-line"></span>
        </div>
        <TransitionGroup
          tag="div"
          name="sp-row"
          class="sg-spells"
          :data-sortable-container="'level-' + group.level"
        >
          <SpellCard
            v-for="(entry, idx) in displayLevel(group.level)"
            :key="entry.ref.key"
            :entry="entry"
            :level="group.level"
            :idx="idx"
          />
        </TransitionGroup><!-- sg-spells -->
      </BaseTile>
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
      :fixed-filters="spellPickerFilters"
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
import { computed, inject, onMounted, provide, reactive, ref, watch } from 'vue'

import { itemsApi } from '@/shared/api/itemsApi'
import SpellCard from '@/features/character-editor/blocks/dnd/components/SpellCard.vue'
import SpellSlotsBar from '@/features/character-editor/blocks/dnd/components/SpellSlotsBar.vue'
import DndSpellbookSettingsModal from '@/features/character-editor/blocks/dnd/DndSpellbookSettingsModal.vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import { useSpellCalc } from '@/features/character-editor/blocks/dnd/composables/useSpellCalc'
import { useSpellSlots } from '@/features/character-editor/blocks/dnd/composables/useSpellSlots'
import { SPELL_LEVELS, countsTowardPreparation, formatBonus, groupTitle, spellSummary } from '@/features/character-editor/blocks/dnd/lib/spellEntry'
import { availableSpellSlotOptions as availableSlotOptions } from '@/features/character-editor/blocks/dnd/lib/spellUse'
import { abilitySpellGrantRows, syncAbilityGrantedSpells } from '@/features/character-editor/blocks/dnd/lib/abilitySpellGrants'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { useSortable } from '@sylvieshare/share-ui'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'
import { logSessionEntryAdded } from '@/features/character-editor/lib/sessionEntryEvents'
import { spellcastingRulesAt } from '@/features/character-editor/blocks/dnd/lib/spellcastingRules'
import { computeSpellSlotPools, maximumSpellLevelForEntry } from '@/features/character-editor/blocks/dnd/lib/multiclassSpellcasting'
import {
  createSpellbookKey,
  grantedSpell,
  normalizedClassItemId,
  normalizedSpellTabs,
  spellEntry,
  spellTab,
  spellbookItemIds,
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

// ─── Computeds ─────────────────────────────────────

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

// ─── Emit ──────────────────────────────────────────

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
const knownEntries = computed(() => [
  ...activeTabSpells.value,
  ...grants.value.filter((entry) => entry.counts_as_known && entry.tab_key === activeTab.value?.key),
]
  .map((ref) => ({ ref, item: itemMap[ref.id] }))
  .filter((entry) => entry.item))
const knownCounts = computed(() => {
  const rules = knownRules.value
  const leveled = knownEntries.value.filter((entry) => Number(entry.item.data?.lvl) > 0)
  const allowed = new Set((rules?.allowedSchoolIds || []).map(String))
  return {
    cantrips: knownEntries.value.filter((entry) => Number(entry.item.data?.lvl) === 0).length,
    spells: leveled.length,
    unrestricted: allowed.size
      ? leveled.filter((entry) => !allowed.has(String(entry.item.data?.schoolId))).length
      : 0,
  }
})
const spellPickerFilters = computed(() => {
  const rules = knownRules.value
  if (!rules) return {}
  const levels = Array.from({ length: Math.max(0, selectedSourceMaxSpellLevel.value) + 1 }, (_, index) => index)
  return {
    ...(rules.listClassId != null ? { 'classes.id': [rules.listClassId] } : {}),
    lvl: levels,
  }
})

function spellPickerEligibility(item) {
  const rules = knownRules.value
  if (!rules) return { eligible: true, reasons: [] }
  const level = Number(item?.data?.lvl)
  const reasons = []
  if (rules.listClassId != null && !(item?.data?.classes || []).some((entry) => String(entry?.id) === String(rules.listClassId))) {
    reasons.push('Не входит в список заклинаний выбранного класса')
  }
  if (level > selectedSourceMaxSpellLevel.value) reasons.push('Круг заклинания пока недоступен этому классу')
  if (rules.hasKnownProgression && rules.cantripsKnown != null && level === 0 && knownCounts.value.cantrips >= rules.cantripsKnown) reasons.push('Лимит известных заговоров уже заполнен')
  if (rules.hasKnownProgression && rules.spellsKnown != null && level > 0 && knownCounts.value.spells >= rules.spellsKnown) reasons.push('Лимит известных заклинаний уже заполнен')
  if (level > 0 && rules.allowedSchoolIds.length
    && !rules.allowedSchoolIds.some((id) => String(id) === String(item?.data?.schoolId))
    && knownCounts.value.unrestricted >= rules.unrestrictedSpells) {
    reasons.push('Все доступные заклинания вне основных школ уже выбраны')
  }
  return { eligible: reasons.length === 0, reasons }
}

const {
  schoolMeta,
  spellMetaLine,
  damageDiceParts,
  healDiceParts,
  hasSpellMetrics,
} = useSpellCalc({ diceMap, diceDetailsMap, damageTypeMap, damageTypeColorMap, schoolMap })

// ─── Methods ───────────────────────────────────────

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

// ─── Rolls ─────────────────────────────────────────

const dice = useDiceStore()

function spellTitle(entry) {
  return entry?.item?.name || 'Заклинание'
}

function typeTag(part) {
  if (!part.type) return ''
  return part.typeColor ? `{${part.type}|${part.typeColor}}` : `{${part.type}}`
}

function diceExpr(parts, withType) {
  return parts
    .map(p => `${p.count || 1}${p.diceLabel || p.label || ''}${withType ? typeTag(p) : ''}`)
    .filter(seg => /\d/.test(seg))
    .join('+')
}

function rollSpellAttack(entry) {
  if (spellcastingBlocked.value) return
  const bonus = spellAttackBonus(entry)
  dice.rollD20(`Атака: ${spellTitle(entry)}`, bonus, 'normal', {
    crit_mode: true,
    roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('attack') || [],
  })
}

function exprWithBonus(parts, withType) {
  let expr = diceExpr(parts, withType)
  const bonus = parts.reduce((s, p) => s + (p.bonus || 0), 0)
  if (bonus) expr += (expr ? '+' : '') + bonus
  return expr
}

function rollSpellDamage(entry, castLevel, critical = false) {
  if (spellcastingBlocked.value) return
  const parts = damageDiceParts(entry.item, castLevel, charLevel.value)
    .map((part) => critical ? { ...part, count: (Number(part.count) || 1) * 2 } : part)
  const expr = exprWithBonus(parts, true)
  if (expr) dice.roll(`${critical ? 'Критический урон' : 'Урон'}: ${spellTitle(entry)}`, expr)
}

function rollSpellHeal(entry, castLevel) {
  if (spellcastingBlocked.value) return
  const expr = exprWithBonus(healDiceParts(entry.item, castLevel, charLevel.value), false)
  if (expr) dice.roll(`Лечение: ${spellTitle(entry)}`, expr)
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

function abilityIds() {
  return [...new Set(['abilities_race', 'abilities_class', 'abilities_feats']
    .flatMap((key) => Array.isArray(props.values?.[key]) ? props.values[key] : [])
    .map((entry) => entry?.id)
    .filter((id) => id != null))]
}

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
    abilities: ['abilities_race', 'abilities_class', 'abilities_feats']
      .flatMap((key) => Array.isArray(props.values?.[key]) ? props.values[key] : [])
      .map((entry) => ({ id: entry.id, choices: entry.choices })),
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
