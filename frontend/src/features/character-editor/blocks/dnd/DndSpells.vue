<template>
  <div v-show="!blockHidden" class="spells-block">

    <div v-if="spellcastingBlocked" class="sp-casting-warning" role="status">
      <strong>Сотворение заклинаний недоступно</strong>
      <span v-for="restriction in spellcastingRestrictions" :key="restriction.key">
        {{ restriction.message }}
      </span>
    </div>

    <SpellSlotsBar
      v-if="activeSlotPools.length || (canInteract && spellcastingSources.length)"
      :has-stat-config="false"
      :can-interact="canInteract"
      :stat-path="statPath"
      :stat-options="statOptions"
      :stat-label="statLabel"
      :save-d-c="saveDC"
      :attack-bonus="attackBonus"
      :save-bonus-extra="saveBonusExtra"
      :attack-bonus-extra="attackBonusExtra"
      :preparation="preparation"
      :active-slot-pools="activeSlotPools"
      :slot-pools="slotPools"
      :casting-stats="[]"
      :show-casting-config="false"
      :show-stats="false"
      :show-slots="true"
      :show-slot-config="true"
      :automatic-slots="automaticSlots"
      @set-stat-path="setStatPath"
      @set-total="setTotal"
      @set-save-bonus="setSaveBonus"
      @set-attack-bonus="setAttackBonus"
      @set-preparation="setPreparation"
      @toggle-slot="toggleSlot"
      @set-automatic-slots="setAutomaticSlots"
    />

    <section v-if="standaloneSpellsByLevel.length" class="sp-standalone">
      <div class="sp-standalone-title">Дарованные заклинания</div>
      <div class="spells-groups">
        <BaseTile v-for="group in standaloneSpellsByLevel" :key="`standalone:${group.level}`" class="spell-group">
          <div class="sg-header">
            <span class="sg-lvl">{{ groupTitle(group.level) }}</span>
            <span class="sg-line"></span>
          </div>
          <div class="sg-spells">
            <SpellCard
              v-for="(entry, idx) in group.items"
              :key="entry.ref.id"
              :entry="entry"
              :level="group.level"
              :idx="idx"
              standalone
            />
          </div>
        </BaseTile>
      </div>
    </section>

    <nav v-if="spellTabs.length" class="sp-tabs" aria-label="Класс заклинаний">
      <button
        v-for="tab in spellTabs"
        :key="tab.key"
        type="button"
        :class="{ active: activeSpellTab === tab.key }"
        @click="activeSpellTab = tab.key"
      >{{ tab.label }}</button>
    </nav>

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
      :preparation="preparation"
      :active-slot-pools="activeSlotPools"
      :slot-pools="slotPools"
      :casting-stats="displayedSpellcastingStatRows"
      :show-casting-config="true"
      :casting-label="activeCastingLabel"
      :show-stats="true"
      :show-slots="false"
      :show-slot-config="false"
      :automatic-slots="automaticSlots"
      @set-stat-path="setStatPath"
      @set-save-bonus="setSaveBonus"
      @set-attack-bonus="setAttackBonus"
      @set-preparation="setPreparation"
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
            :key="entry.ref.id"
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
      :exclude-items="spells.map(s => s.id)"
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

  </div>
</template>

<script setup>
import { computed, inject, onMounted, provide, reactive, ref, watch } from 'vue'

import { itemsApi } from '@/shared/api/itemsApi'
import SpellCard from '@/features/character-editor/blocks/dnd/components/SpellCard.vue'
import SpellSlotsBar from '@/features/character-editor/blocks/dnd/components/SpellSlotsBar.vue'
import { BaseTile } from '@sylvieshare/share-ui'
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
import { characterSpellcastingSources, spellCountsTowardKnown } from '@/features/character-editor/blocks/dnd/lib/spellcastingRules'
import { computeSpellSlotPools, maximumSpellLevelForEntry } from '@/features/character-editor/blocks/dnd/lib/multiclassSpellcasting'
import {
  loadSpellcastingSettings,
  OTHER_SPELLCASTING_SOURCE,
  serializeSpellcastingSettings,
  spellcastingSetting,
} from '@/features/character-editor/blocks/dnd/lib/spellcastingSettings'

const props = defineProps(['block', 'value', 'values'])
const emit  = defineEmits(['update:value'])
const charCtx       = inject('charCtx',       () => ({ ownerMode: true, dictionaries: {} }))
const setBlockHidden = inject('setBlockHidden', () => () => {})

const spells     = ref([])
const sourceSettings = ref({})
const itemMap    = reactive({})
const modalSpell = ref(null)
const pickerOpen = ref(false)
const classItemMap = reactive({})
const activeSpellTab = ref('')
const automaticSlots = ref(true)

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
  props.block.hide_on_empty && !charCtx.ownerMode && !canAddItems.value && spells.value.length === 0
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
const spellcastingSources = computed(() => characterSpellcastingSources(props.values?.classes, classItemMap))
const sourceKeys = computed(() => new Set(spellcastingSources.value.map((source) => source.key)))
function isStandaloneSpell(ref) {
  return !!ref?.external_only || !sourceKeys.value.has(ref?.spellcasting_source)
}
function spellMatchesActiveTab(ref) {
  return !ref?.external_only && ref?.spellcasting_source === activeSpellTab.value
}
const spellTabs = computed(() => spellcastingSources.value
  .map((source) => ({ key: source.key, label: source.label })))
const activeTabSource = computed(() => spellcastingSources.value.find((source) => source.key === activeSpellTab.value) || null)
const activeSettingsKey = computed(() => activeTabSource.value?.key || null)
const activeCastingSetting = computed(() => activeSettingsKey.value
  ? spellcastingSetting(sourceSettings.value, activeSettingsKey.value, spellcastingSources.value)
  : null)
const statPath = computed(() => activeCastingSetting.value?.stat_path ?? '')
const saveBonusExtra = computed(() => activeCastingSetting.value?.save_bonus ?? 0)
const attackBonusExtra = computed(() => activeCastingSetting.value?.attack_bonus ?? 0)
const preparation = computed(() => !!activeCastingSetting.value?.preparation)
const activeCastingLabel = computed(() => activeTabSource.value?.label
  || spellcastingSources.value.find((source) => source.key === activeSettingsKey.value)?.label
  || '')
const knownRules = computed(() => activeTabSource.value)
const selectedSourceMaxSpellLevel = computed(() => knownRules.value
  ? maximumSpellLevelForEntry(knownRules.value.entry, classItemMap)
  : maxSlotLevel.value)
function castingStatRow(key, label) {
  const setting = spellcastingSetting(sourceSettings.value, key, spellcastingSources.value)
  const modifier = statModifierForAbility(setting.stat_path)
  return {
    key,
    label,
    ability: statOptions.value.find((stat) => String(stat.value) === String(setting.stat_path))?.label || '—',
    saveDC: 8 + profBonus.value + modifier + setting.save_bonus,
    attackBonus: profBonus.value + modifier + setting.attack_bonus,
  }
}
const spellcastingStatRows = computed(() => spellcastingSources.value
  .map((source) => castingStatRow(source.key, source.label)))
const displayedSpellcastingStatRows = computed(() => spellcastingStatRows.value
  .filter((row) => row.key === activeTabSource.value?.key))

const schoolMap = computed(() => {
  const id = props.block.content?.school_suggest_id
  if (!id) return {}
  return Object.fromEntries(useSuggestStore().items(id).map(s => [s.id, s]))
})
const spellsByLevel = computed(() => {
  const groups = new Map()
  for (const spellRef of spells.value.filter(spellMatchesActiveTab)) {
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
const standaloneSpellsByLevel = computed(() => {
  const groups = new Map()
  for (const spellRef of spells.value.filter(isStandaloneSpell)) {
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
  const serializedPools = serializedSlotPools()
  emit('update:value', props.block.id, {
    source_settings: serializeSpellcastingSettings(sourceSettings.value, spellcastingSources.value),
    slots_rest: 'long_rest',
    slots_auto: automaticSlots.value,
    slot_pools: serializedPools,
    spells: spells.value.map(s => ({
      id: s.id,
      prepared: !!s.prepared,
      ...(s.always_prepared ? { always_prepared: true } : {}),
      ...(s.source ? { source: s.source } : {}),
      ...(Array.isArray(s.granted_by) && s.granted_by.length ? { granted_by: s.granted_by } : {}),
      ...(s.external_only ? { external_only: true } : {}),
      ...(s.casting_ability != null && s.casting_ability_source !== 'class'
        ? { casting_ability: s.casting_ability }
        : {}),
      ...(s.casting_ability_source && s.casting_ability_source !== 'class'
        ? { casting_ability_source: s.casting_ability_source }
        : {}),
      ...(s.slotless ? { slotless: true } : {}),
      ...(s.slotless_source ? { slotless_source: s.slotless_source } : {}),
      ...(s.cast_level != null ? { cast_level: s.cast_level } : {}),
      ...(s.cast_level_source ? { cast_level_source: s.cast_level_source } : {}),
      ...(s.counts_as_known ? { counts_as_known: true } : {}),
      ...(s.spellcasting_source ? { spellcasting_source: s.spellcasting_source } : {}),
    })),
    // Compatibility mirror for level-up code that still reads the ordinary pool.
    slots: serializedPools.long_rest,
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
const knownEntries = computed(() => spells.value
  .filter(spellCountsTowardKnown)
  .filter((ref) => !knownRules.value
    || ref.spellcasting_source === knownRules.value.key
    || (!ref.spellcasting_source && spellcastingSources.value.length === 1))
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
  schoolBadge,
  spellMetaLine,
  damageDiceParts,
  healDiceParts,
  hasSpellMetrics,
} = useSpellCalc({ diceMap, diceDetailsMap, damageTypeMap, damageTypeColorMap, schoolMap })

// ─── Methods ───────────────────────────────────────

function setStatPath(path) {
  updateActiveCastingSetting('stat_path', path)
}

function setSaveBonus(v) {
  updateActiveCastingSetting('save_bonus', Number(v) || 0)
}

function setAttackBonus(v) {
  updateActiveCastingSetting('attack_bonus', Number(v) || 0)
}

function setPreparation(v) {
  updateActiveCastingSetting('preparation', !!v)
}

function updateActiveCastingSetting(field, value) {
  const key = activeSettingsKey.value
  if (!key) return
  sourceSettings.value = {
    ...sourceSettings.value,
    [key]: {
      ...spellcastingSetting(sourceSettings.value, key, spellcastingSources.value),
      [field]: value,
    },
  }
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
    if (forceEmit) emitChange()
    return
  }
  let changed = replaceTotals('long_rest', pools.totals)
  const shortTotals = Array(9).fill(0)
  if (pools.pact) shortTotals[pools.pact.slotLevel - 1] = pools.pact.count
  changed = replaceTotals('short_rest', shortTotals) || changed
  if (changed || forceEmit) emitChange()
}

async function loadDetails() {
  const ids = spells.value.map(s => s.id).filter(id => !itemMap[id])
  if (ids.length) {
    const res = await itemsApi.byIds(ids)
    for (const item of res.items || []) itemMap[item.id] = item
    charCtx.characterResources?.rememberItems?.(res.items || [])
  }
  await Promise.all(spells.value.map(spell => charCtx.characterStatuses?.ensureLinks?.(itemMap[spell.id])))
  normalizePreparationStatuses()
  assignMissingSpellSources()
}

function isGrantedWithoutClass(ref) {
  return !!ref?.external_only
    || !!ref?.casting_ability_source
    || !!ref?.source
    || (Array.isArray(ref?.granted_by) && ref.granted_by.length > 0)
}

function inferredSpellcastingSource(ref) {
  const classIds = new Set((Array.isArray(itemMap[ref?.id]?.data?.classes) ? itemMap[ref.id].data.classes : [])
    .map((entry) => String(entry?.id ?? entry)))
  const compatible = spellcastingSources.value.filter((source) =>
    classIds.has(String(source.listClassId ?? source.classId)))
  if (compatible.length) return compatible[0]
  return spellcastingSources.value[0] || null
}

function assignMissingSpellSources() {
  let changed = false
  for (const ref of spells.value) {
    if (sourceKeys.value.has(ref.spellcasting_source) || isGrantedWithoutClass(ref)) continue
    const source = inferredSpellcastingSource(ref)
    if (!source) continue
    ref.spellcasting_source = source.key
    changed = true
  }
  if (changed) emitChange()
  return changed
}

function migrateSourceSettingAliases() {
  let next = sourceSettings.value
  let changed = false
  for (const source of spellcastingSources.value) {
    if (next[source.key]) continue
    const prefix = `class:${source.classId}:`
    const alias = Object.keys(next).find((key) => key.startsWith(prefix) && key !== source.key)
    if (!alias) continue
    next = { ...next, [source.key]: next[alias] }
    delete next[alias]
    changed = true
  }
  if (changed) sourceSettings.value = next
  return changed
}

function normalizePreparationStatuses() {
  let changed = false
  for (const spell of spells.value) {
    const level = Number(itemMap[spell.id]?.data?.lvl)
    if (level === 0 && (spell.prepared || spell.always_prepared)) {
      spell.prepared = false
      delete spell.always_prepared
      changed = true
    } else if (level > 0 && spell.always_prepared && !spell.prepared) {
      spell.prepared = true
      changed = true
    }
  }
  if (changed) emitChange()
}

function togglePrepared(id) {
  if (!charCtx.ownerMode) return
  const entry = spells.value.find(s => String(s.id) === String(id))
  const level = Number(itemMap[id]?.data?.lvl)
  if (entry && level > 0 && !entry.always_prepared) {
    entry.prepared = !entry.prepared
    emitChange()
  }
}

function toggleAlwaysPrepared(id) {
  if (!charCtx.ownerMode) return
  const entry = spells.value.find(s => String(s.id) === String(id))
  const level = Number(itemMap[id]?.data?.lvl)
  if (!entry || level <= 0) return
  entry.always_prepared = !entry.always_prepared
  if (entry.always_prepared) entry.prepared = true
  emitChange()
}

function removeSpell(id) {
  const idx = spells.value.findIndex(s => s.id === id)
  if (idx !== -1) {
    const entry = { ref: spells.value[idx], item: itemMap[id] }
    if (typeof charCtx.updateValues === 'function') {
      charCtx.updateValues({ states: charCtx.characterStatuses?.removeBySource?.(spellStatusSource(entry)) || [] })
    }
    spells.value.splice(idx, 1)
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
  getKey: e => e.ref.id,
  onDrop: ({ item, toGroup, toIndex }) => {
    const targetLevel = Number(toGroup.replace('level-', ''))
    const arr = [...spells.value]
    const srcIdx = arr.findIndex(s => s.id === item.ref.id)
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
    spells.value = arr
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
  if (spellPickerEligibility(item).eligible && !spells.value.some(s => s.id === item.id)) {
    itemMap[item.id] = item
    charCtx.characterResources?.rememberItems?.([item])
    charCtx.characterStatuses?.ensureLinks?.(item)
    const source = knownRules.value
    spells.value.push({
      id: item.id,
      prepared: false,
      ...(source?.key ? { spellcasting_source: source.key } : {}),
    })
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
    entry_key: String(entry?.ref?.id || ''),
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

function spellcastingSourceFor(entry) {
  return spellcastingSources.value.find((source) => source.key === entry?.ref?.spellcasting_source) || null
}

function spellCanPrepare(entry) {
  return spellcastingSetting(
    sourceSettings.value,
    spellSettingsKeyFor(entry),
    spellcastingSources.value,
  ).preparation
}

function spellSourceLabel(entry) {
  return spellcastingSourceFor(entry)?.label || ''
}

function setSpellcastingSource(entry, key) {
  if (!charCtx.ownerMode) return
  const source = spellcastingSources.value.find((candidate) => candidate.key === key)
  if (!source) return
  entry.ref.spellcasting_source = source.key
  delete entry.ref.casting_ability
  delete entry.ref.casting_ability_source
  emitChange()
}

function spellSettingsKeyFor(entry) {
  const source = spellcastingSourceFor(entry)
  if (source) return source.key
  if (spellcastingSources.value.length === 1 && !isGrantedWithoutClass(entry?.ref)) return spellcastingSources.value[0].key
  return OTHER_SPELLCASTING_SOURCE
}

function spellCastingAbility(entry) {
  if (entry?.ref?.casting_ability != null && entry.ref.casting_ability_source !== 'class') {
    return entry.ref.casting_ability
  }
  return spellcastingSetting(
    sourceSettings.value,
    spellSettingsKeyFor(entry),
    spellcastingSources.value,
  ).stat_path
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
  const setting = spellcastingSetting(sourceSettings.value, spellSettingsKeyFor(entry), spellcastingSources.value)
  return profBonus.value + spellStatModifier(entry) + setting.attack_bonus
}

function spellSaveDC(entry) {
  const setting = spellcastingSetting(sourceSettings.value, spellSettingsKeyFor(entry), spellcastingSources.value)
  return 8 + profBonus.value + spellStatModifier(entry) + setting.save_bonus
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
  const grants = abilitySpellGrantRows(items, props.values)
  const next = syncAbilityGrantedSpells(spells.value, grants)
  if (JSON.stringify(next) === JSON.stringify(spells.value)) return
  spells.value = next
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
  if (!spellcastingSources.value.some((source) => source.key === activeSpellTab.value)) {
    activeSpellTab.value = spellcastingSources.value[0]?.key || ''
  }
  const settingsMigrated = migrateSourceSettingAliases()
  if (syncSlots) syncAutomaticSlotPools()
  const sourcesMigrated = Object.keys(itemMap).length ? assignMissingSpellSources() : false
  if (settingsMigrated && !sourcesMigrated) emitChange()
}

provide('spellsBlockCtx', reactive({
  charCtx,
  sortable,
  onSpellDragStart,
  togglePrepared,
  toggleAlwaysPrepared,
  removeSpell,
  openSpell,
  schoolMeta,
  schoolBadge,
  spellMetaLine,
  spellSummary,
  damageDiceParts,
  healDiceParts,
  hasSpellMetrics,
  formatBonus,
  attackBonus,
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
  spellCanPrepare,
  spellSourceLabel,
  setSpellcastingSource,
  spellcastingBlocked,
  statusEffectLinks,
  statusEffectActive,
  toggleSpellStatus,
}))

// ─── Lifecycle ─────────────────────────────────────

onMounted(async () => {
  const raw = props.value && typeof props.value === 'object' && !Array.isArray(props.value) ? props.value : {}
  spells.value = (Array.isArray(raw.spells) ? raw.spells : []).map(s => ({ ...s }))
  automaticSlots.value = raw.slots_auto !== false
  loadSlotPools(raw)
  await loadClassItems(false)
  sourceSettings.value = loadSpellcastingSettings(raw, spellcastingSources.value)
  if (migrateSourceSettingAliases()) emitChange()
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
    if (spells.value.length || abilityIds().length) syncExternalAbilitySpells()
  },
)
</script>

<style scoped src="./styles/DndSpells.css"></style>
