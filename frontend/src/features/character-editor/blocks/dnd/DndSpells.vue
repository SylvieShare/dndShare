<template>
  <div v-show="!blockHidden" class="spells-block">

    <SpellSlotsBar
      v-if="showStatsBar"
      :has-stat-config="hasStatConfig"
      :can-interact="canInteract"
      :stat-path="statPath"
      :stat-options="statOptions"
      :stat-label="statLabel"
      :save-d-c="saveDC"
      :attack-bonus="attackBonus"
      :save-bonus-extra="saveBonusExtra"
      :attack-bonus-extra="attackBonusExtra"
      :slots-rest="slotsRest"
      :preparation="preparation"
      :active-slots="activeSlots"
      :all-slots="localSlots"
      @set-stat-path="setStatPath"
      @set-total="setTotal"
      @set-save-bonus="setSaveBonus"
      @set-attack-bonus="setAttackBonus"
      @set-slots-rest="setSlotsRest"
      @set-preparation="setPreparation"
      @toggle-slot="toggleSlot"
    />

    <!-- Заклинания по уровням (мультиколонки) -->
    <div class="spells-groups">
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
          {{ row.level === 0 ? 'Заговоры' : row.level + ' круг' }} · {{ row.count }}
        </span>
      </div>

      <div v-for="group in spellsByLevel" :key="group.level" class="spell-group">
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
      </div>
    </div>

    <!-- Поиск / добавление -->
    <div v-if="canAddItems" class="sp-add-section">
      <button class="sp-picker-btn" @click="pickerOpen = true">+ Найти заклинание...</button>
    </div>

    <ItemPickerModal
      v-if="pickerOpen && block.content.item_type_id"
      :item-type-ids="[block.content.item_type_id]"
      :exclude-items="spells.map(s => s.id)"
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
import { useSpellCalc } from '@/features/character-editor/blocks/dnd/composables/useSpellCalc'
import { useSpellSlots } from '@/features/character-editor/blocks/dnd/composables/useSpellSlots'
import { SPELL_LEVELS, formatBonus, groupTitle, spellSummary } from '@/features/character-editor/blocks/dnd/lib/spellEntry'
import ItemPickerModal from '@/features/character-editor/components/ItemPickerModal'
import ItemViewModal from '@/shared/ui/ItemViewModal'
import { useSortable } from '@/shared/composables/useSortable'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps(['block', 'value', 'values'])
const emit  = defineEmits(['update:value'])
const charCtx       = inject('charCtx',       () => ({ ownerMode: true, dictionaries: {} }))
const setBlockHidden = inject('setBlockHidden', () => () => {})

const spells     = ref([])
const statPath   = ref('')
const saveBonusExtra   = ref(0)
const attackBonusExtra = ref(0)
const slotsRest  = ref('long_rest')
const preparation = ref(false)
const itemMap    = reactive({})
const modalSpell = ref(null)
const pickerOpen = ref(false)

// ─── Computeds ─────────────────────────────────────

const hasStatConfig = computed(() =>
  !!(props.block.content?.stat_suggest_type_id && props.block.content?.prof_bonus_path)
)
const statSuggests = computed(() => {
  const id = props.block.content?.stat_suggest_type_id
  return id != null ? useSuggestStore().items(id) || [] : []
})
const statOptions  = computed(() => statSuggests.value.map(item => ({ value: item.id, label: item.value })))
const diceSuggestTypeId = computed(() => props.block.content?.dice_suggest_id || props.block.content?.dice_suggest_type_id || 11)
const damageTypeSuggestTypeId = computed(() =>
  props.block.content?.damage_type_suggest_id ||
  props.block.content?.type_attack_suggest_type_id ||
  12
)
const diceSuggests = computed(() => useSuggestStore().items(diceSuggestTypeId.value) || [])
const damageTypeSuggests = computed(() => useSuggestStore().items(damageTypeSuggestTypeId.value) || [])
const diceMap = computed(() => Object.fromEntries(diceSuggests.value.map(s => [s.id, s.value])))
const diceDetailsMap = computed(() => Object.fromEntries(diceSuggests.value.map(s => [s.id, s])))
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
const showStatsBar = computed(() => hasStatConfig.value || canInteract.value || activeSlots.value.length > 0)

const schoolMap = computed(() => {
  const id = props.block.content?.school_suggest_id
  if (!id) return {}
  return Object.fromEntries(useSuggestStore().items(id).map(s => [s.id, s]))
})
const spellsByLevel = computed(() => {
  const groups = new Map()
  for (const spellRef of spells.value) {
    const item = itemMap[spellRef.id]
    const lvl = item?.data?.lvl ?? -1
    if (!groups.has(lvl)) groups.set(lvl, [])
    groups.get(lvl).push({ ref: spellRef, item })
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([level, items]) => ({
    level,
    items,
    preparedCount: items.filter(entry => entry.ref.prepared).length,
  }))
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
    stat_path: statPath.value,
    save_bonus: saveBonusExtra.value,
    attack_bonus: attackBonusExtra.value,
    slots_rest: slotsRest.value,
    preparation: preparation.value,
    spells: spells.value.map(s => ({ id: s.id, prepared: s.prepared })),
    slots: serializedSlots(),
  })
}

const {
  localSlots,
  activeSlots,
  loadSlots,
  serializedSlots,
  toggleSlot,
  setTotal,
  adjustSlotUsed,
} = useSpellSlots({ canInteract, emitChange })

const maxSlotLevel = computed(() => activeSlots.value.reduce((m, s) => Math.max(m, s.level), 0))

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
  statPath.value = path
  emitChange()
}

function setSaveBonus(v) {
  saveBonusExtra.value = Number(v) || 0
  emitChange()
}

function setAttackBonus(v) {
  attackBonusExtra.value = Number(v) || 0
  emitChange()
}

function setSlotsRest(v) {
  slotsRest.value = v
  emitChange()
}

function setPreparation(v) {
  preparation.value = !!v
  emitChange()
}

async function loadDetails() {
  const ids = spells.value.map(s => s.id).filter(id => !itemMap[id])
  if (!ids.length) return
  const res = await itemsApi.byIds(ids)
  for (const item of res.items || []) itemMap[item.id] = item
}

function togglePrepared(id) {
  if (!charCtx.ownerMode) return
  const entry = spells.value.find(s => s.id === id)
  if (entry) { entry.prepared = !entry.prepared; emitChange() }
}

function removeSpell(id) {
  const idx = spells.value.findIndex(s => s.id === id)
  if (idx !== -1) { spells.value.splice(idx, 1); emitChange() }
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
  if (!spells.value.some(s => s.id === item.id)) {
    itemMap[item.id] = item
    spells.value.push({ id: item.id, prepared: false })
    emitChange()
  }
}

function openSpell(entry) {
  if (entry.item) modalSpell.value = entry.item
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
  const bonus = attackBonus.value
  dice.roll(`Атака: ${spellTitle(entry)}`, `1d20${bonus >= 0 ? '+' : ''}${bonus}`, { crit_mode: true })
}

function exprWithBonus(parts, withType) {
  let expr = diceExpr(parts, withType)
  const bonus = parts.reduce((s, p) => s + (p.bonus || 0), 0)
  if (bonus) expr += (expr ? '+' : '') + bonus
  return expr
}

function rollSpellDamage(entry, castLevel) {
  const expr = exprWithBonus(damageDiceParts(entry.item, castLevel, charLevel.value), true)
  if (expr) dice.roll(`Урон: ${spellTitle(entry)}`, expr)
}

function rollSpellHeal(entry, castLevel) {
  const expr = exprWithBonus(healDiceParts(entry.item, castLevel, charLevel.value), false)
  if (expr) dice.roll(`Лечение: ${spellTitle(entry)}`, expr)
}

provide('spellsBlockCtx', reactive({
  charCtx,
  sortable,
  onSpellDragStart,
  togglePrepared,
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
  charLevel,
  maxSlotLevel,
  preparation,
  rollSpellAttack,
  rollSpellDamage,
  rollSpellHeal,
}))

// ─── Lifecycle ─────────────────────────────────────

onMounted(async () => {
  const raw = props.value
  const spellsArr = Array.isArray(raw) ? raw : (raw?.spells || [])
  spells.value = spellsArr.map(s => ({ ...s }))
  statPath.value = Array.isArray(raw) ? '' : (raw?.stat_path || '')
  saveBonusExtra.value = Array.isArray(raw) ? 0 : (Number(raw?.save_bonus) || 0)
  attackBonusExtra.value = Array.isArray(raw) ? 0 : (Number(raw?.attack_bonus) || 0)
  slotsRest.value = Array.isArray(raw) ? 'long_rest' : (raw?.slots_rest || 'long_rest')
  preparation.value = Array.isArray(raw) ? false : !!raw?.preparation
  loadSlots(Array.isArray(raw) ? [] : (raw?.slots || []))
  const { school_suggest_id, source_suggest_id, stat_suggest_type_id } = props.block.content || {}
  const ensures = [school_suggest_id, source_suggest_id, stat_suggest_type_id, diceSuggestTypeId.value, damageTypeSuggestTypeId.value]
    .filter(Boolean)
    .map(id => useSuggestStore().ensure(id))
  await Promise.all([loadDetails(), ...ensures])
})
</script>

<style scoped>
.spells-block {
  min-width: 0;
  color: var(--text-1);
}

.sg-lvl {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  line-height: 1.15;
  text-transform: uppercase;
}

/* ── Группы заклинаний (каждый уровень — своя строка) ── */
.spells-groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.spells-empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 8px 4px;
}

/* ── Сводка по подготовленным (перед заговорами) ── */
.sp-prep-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.sp-prep-total {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: color-mix(in srgb, var(--accent) 50%, var(--text-on-accent));
  font-size: 13px;
  font-weight: 700;
}
.sp-prep-total svg { color: var(--accent); }

.sp-prep-chip {
  padding: 5px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
}

.spell-group {
  min-width: 0;
}

.sg-spells {
  display: flex;
  flex-direction: column;
}

/* Row removal: collapse height + fade + slide out. No `*-move` rule on purpose — live drag
   reordering (handled by useSortable) must not trigger FLIP moves that fight the drag ghost. */
.sp-row-leave-active {
  overflow: hidden;
  pointer-events: none;
  transition:
    opacity 0.22s ease,
    transform 0.26s ease,
    max-height 0.3s ease,
    padding-top 0.3s ease,
    padding-bottom 0.3s ease,
    border-top-color 0.2s ease;
}
.sp-row-leave-from { max-height: 120px; }
.sp-row-leave-to {
  opacity: 0;
  transform: translateX(18px);
  max-height: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  border-top-color: transparent !important;
}
.sp-row-enter-active { transition: opacity 0.22s ease, transform 0.26s ease; }
.sp-row-enter-from { opacity: 0; transform: translateX(18px); }

.sg-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.sg-line {
  min-width: 20px;
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--text-muted) 42%, transparent);
}


/* ── Search / add ─────────────────────────────── */
.sp-add-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--text-muted) 22%, transparent);
}

.sp-picker-btn {
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

.sp-picker-btn:hover {
  color: var(--text-1);
  border-color: color-mix(in srgb, var(--text-2) 58%, transparent);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
}

@media (max-width: 760px) {
  .sp-stat-row {
    grid-template-columns: 1fr;
  }

  .sp-slots-row {
    grid-template-columns: 1fr;
  }

  .sp-slots-wrap {
    grid-template-columns: repeat(9, minmax(40px, 1fr));
    gap: 4px;
    overflow-x: auto;
  }

  .spell-row {
    grid-template-columns: 18px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
  }

  .spell-row-edit {
    grid-template-columns: 18px 18px minmax(0, 1fr) auto;
  }

  .sp-metrics {
    grid-column: 2 / -1;
    justify-content: flex-start;
  }

  .sp-del {
    grid-column: 3;
    grid-row: 1;
  }

  .sp-name {
    font-size: 16px;
  }

  .sp-summary {
    white-space: normal;
  }
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: grab;
  padding: 4px 3px;
  border-radius: 4px;
  touch-action: none;
  transition: color 0.12s, background 0.12s;
  flex-shrink: 0;
}
.drag-handle:hover { color: var(--text-1); background: color-mix(in srgb, var(--text-on-accent) 8%, transparent); }
.drag-handle:active { cursor: grabbing; }

.sp-drag { margin-right: 2px; }

.sortable-placeholder {
  background: color-mix(in srgb, var(--accent) 8%, transparent) !important;
  outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  outline-offset: -2px;
  border-radius: 8px;
}
.sortable-placeholder > * { visibility: hidden; }
</style>
