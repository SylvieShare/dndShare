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
    >
      <template v-if="canInteract" #actions>
        <button
          v-if="preparation && modalSpellRef"
          type="button"
          class="sp-modal-action sp-modal-prepare"
          :class="{ active: modalSpellRef.prepared }"
          :aria-pressed="modalSpellRef.prepared"
          @click="togglePrepared(modalSpellRef.id)"
        >
          {{ modalSpellRef.prepared ? 'Снять подготовку' : 'Подготовить' }}
        </button>
      </template>
    </ItemViewModal>

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
import { SPELL_LEVELS, formatBonus, groupTitle, spellSummary } from '@/features/character-editor/blocks/dnd/lib/spellEntry'
import { availableSpellSlotLevels as availableSlotLevels } from '@/features/character-editor/blocks/dnd/lib/spellUse'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { useSortable } from '@sylvieshare/share-ui'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'
import { logSessionEntryAdded } from '@/features/character-editor/lib/sessionEntryEvents'

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
const modalSpellRef = computed(() => spells.value.find(spell => spell.id === modalSpell.value?.id) || null)

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
    logSessionEntryAdded(charCtx, {
      kind: 'spell', title: item.name, itemId: item.id, level: item.data?.lvl,
    })
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

function availableSpellSlotLevels(entry) {
  const level = Number(entry?.item?.data?.lvl) || 0
  return availableSlotLevels(localSlots.value, level)
}

function slotRemaining(level) {
  const slot = localSlots.value.find(entry => entry.level === level)
  return slot ? Math.max(0, slot.total - slot.used) : 0
}

function useSpell(entry, slotLevel) {
  if (!entry?.item) return
  const spellLevel = Number(entry?.item?.data?.lvl) || 0
  if (spellLevel > 0) {
    const available = availableSpellSlotLevels(entry)
    if (!available.includes(slotLevel)) return
    adjustSlotUsed(slotLevel, 1)
  }
  charCtx.logSessionEvent?.({
    type: 'spell_used',
    action: `Использовано: ${spellTitle(entry)}`,
    data: {
      spellId: entry?.item?.id || entry?.ref?.id || null,
      spellLevel,
      slotLevel: spellLevel === 0 ? 0 : slotLevel,
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
  availableSpellSlotLevels,
  slotRemaining,
  useSpell,
}))

// ─── Lifecycle ─────────────────────────────────────

onMounted(async () => {
  const raw = props.value && typeof props.value === 'object' && !Array.isArray(props.value) ? props.value : {}
  spells.value = (Array.isArray(raw.spells) ? raw.spells : []).map(s => ({ ...s }))
  statPath.value = raw.stat_path || ''
  saveBonusExtra.value = Number(raw.save_bonus) || 0
  attackBonusExtra.value = Number(raw.attack_bonus) || 0
  slotsRest.value = raw.slots_rest || 'long_rest'
  preparation.value = !!raw.preparation
  loadSlots(raw.slots || [])
  const { school_suggest_id, stat_suggest_type_id } = props.block.content || {}
  const ensures = [school_suggest_id, stat_suggest_type_id, damageTypeSuggestTypeId.value]
    .filter(Boolean)
    .map(id => useSuggestStore().ensure(id))
  await Promise.all([loadDetails(), ...ensures])
})
</script>

<style scoped src="./styles/DndSpells.css"></style>
