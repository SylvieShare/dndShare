<template>
  <DndStatView v-bind="$attrs" class="stat-block" :data-tutorial="block.id === 'STR' ? 'character-stat' : undefined"
    :title="displayTitle"
    :color="statColor"
    :suggest-svg="titleSuggest?.svg || ''"
    :mod="mod" :check-total="checkTotal" :proficiency-bonus="profBonus"
    :raw="statDisplayValue"
    :save="save"
    :save-up="saveUp"
    :skills="skillsView"
    :check-mode="checkRollMode"
    :check-mode-source="checkModeSource"
    :check-mode-cancelled="checkResolved.cancelled"
    :save-mode="saveRollMode"
    :save-mode-source="saveModeSource"
    :save-mode-cancelled="saveResolved.cancelled"
    :skills-loading="skillsLoading"
    :skill-skeleton-count="skillSkeletonCount"
    :tooltip-max-desc="skillTooltipMaxDesc"
    :tooltip-width="skillTooltipWidth"
    :mobile-variant="isMobileVariant"
    :show-edit="canEdit"
    @edit="openEditor"
    @roll-stat="(mode, excluded) => rollD20Plus(`${displayTitle} — проверка`, checkTotal, mode, 'ability_check', {}, excluded)"
    @roll-save="(mode, excluded) => rollD20Plus(`${displayTitle} — спасбросок`, save, mode, 'saving_throw', {}, excluded)"
    @roll-skill="(id, mode, excluded) => rollD20Plus(skillTitle(id), skillBonus(id), mode, 'ability_check', { proficiencyRank: skillProficiencyRank(id) }, excluded)"
  />

  <AppModalFrame v-if="editor && canEdit" :title="editorTitle" :padded="false" :z-index="4200" :width="statEditorWidth" @close="editor = null">
    <template #title>
      <div class="stat-editor-heading">
        <h2 class="stat-editor-title">{{ editorTitle }} <small v-if="originalTitle">({{ originalTitle }})</small></h2>
        <span class="stat-editor-total"><small>Итого</small> <strong>{{ editorTotal }}</strong></span>
      </div>
    </template>
    <DndStatSkillEditor v-if="editor === 'skill' && editSkill" :skill="editSkill"
      @change="onSkillChange" @remove="removeCustomSkill" />
    <DndStatEditor v-else :saving-throw="editor === 'save'" :base-data="numData" :save-up="saveUp"
      :save-source="derivedSaveSource" :save-bonuses="statData.save_bonuses || []"
      @update-base="onBaseChange" @toggle-save="pickSave" @update-save-bonuses="onSaveBonusesChange" />
  </AppModalFrame>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
import { computed, inject, onMounted, ref, watch } from 'vue'
import { layoutTokens } from '@/app/design-tokens'
import { formatBonus as signed, abilityModifier, sumBonuses, resolveNumValue } from '@/shared/lib/dnd'
import { armorAbilityRollEffects, resolveRollMode } from '@/features/character-editor/blocks/dnd/lib/rollMode'
import DndStatEditor from '@/features/character-editor/blocks/dnd/components/DndStatEditor'
import DndStatSkillEditor from '@/features/character-editor/blocks/dnd/components/DndStatSkillEditor'
import DndStatView from '@/features/character-editor/blocks/dnd/components/DndStatView'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps(['block', 'value', 'values', 'vars'])
const emit = defineEmits(['update:value', 'update:var'])
const charCtx = inject('charCtx', { ownerMode: true })
const canEdit = computed(() => !!charCtx.ownerMode)

// ─── Editor window state ───────────────────────────────────────────────────────
const editor = ref(null)
const editSkillId = ref(null)
const statEditorWidth = layoutTokens['stat-editor-width'] + 'px'
const editorTotal = computed(() => {
  if (editor.value === 'skill') return signed(skillBonus(editSkillId.value))
  return editor.value === 'save' ? signed(save.value) : statDisplayValue.value
})
const editorTitle = computed(() => editor.value === 'skill' ? editSkill.value?.title || 'Навык'
  : editor.value === 'save' ? `${displayTitle.value} — спасбросок` : displayTitle.value)
const originalTitle = computed(() => editor.value === 'skill' && editSkill.value?.originalTitle !== editorTitle.value
  ? editSkill.value?.originalTitle : '')

// ─── Computeds ───────────────────────────────────────────────────────────────
const statData = computed(() => props.value || {})

const numData = computed(() => {
  const v = statData.value.value
  if (v && typeof v === 'object') return v
  return { base: parseInt(v) || 10, bonuses: [] }
})

const statDisplayValue = computed(() =>
  Math.max((numData.value.base || 0) + sumBonuses(numData.value.bonuses), resolveNumValue(charCtx.values?.[props.block.id]?.value))
)

const titleConfig = computed(() => props.block.content.title)

const titleSuggestTypeId = computed(() =>
  titleConfig.value && typeof titleConfig.value === 'object' ? titleConfig.value.suggest_type_id : null
)

const titleSuggestId = computed(() =>
  titleConfig.value && typeof titleConfig.value === 'object' ? String(titleConfig.value.suggest_id) : null
)

const titleSuggestItems = computed(() => {
  if (titleSuggestTypeId.value == null) return []
  return useSuggestStore().items(titleSuggestTypeId.value) || []
})

const titleSuggest = computed(() => {
  if (titleSuggestId.value == null) return null
  return titleSuggestItems.value.find(item => String(item.id) === titleSuggestId.value) || null
})

const displayTitle = computed(() => {
  if (titleConfig.value && typeof titleConfig.value === 'object') {
    return titleSuggest.value?.value || props.block.id || ''
  }
  return titleConfig.value || props.block.id || ''
})

const statColor = computed(() => titleSuggest.value?.color || 'var(--text-muted)')
const profBonus = computed(() => {
  const path = props.block.content.bonus_path
  if (!path) return 2
  return path.split('.').reduce((cur, key) => cur?.[key], props.values) ?? 2
})
const mod = computed(() => abilityModifier(statDisplayValue.value))
const checkTotal = computed(() => mod.value + (charCtx.characterDerivedEffects?.bonus?.('check_bonus', {
  kind: 'ability_check', abilitySuggestId: titleSuggestId.value, proficient: false,
})?.total || 0))
const derivedSave = computed(() => charCtx.characterDerivedEffects?.saveProficiency?.(titleSuggestId.value) || { rank: 0, sources: [] })
const saveUp = computed(() => !!statData.value.save_up || derivedSave.value.rank > 0)
const derivedSaveSource = computed(() => derivedSave.value.sources.map(rule => rule.source_label).join(' · '))
const save = computed(() => {
  const extra = sumBonuses(statData.value.save_bonuses)
  const derived = charCtx.characterDerivedEffects?.bonus?.('save_bonus', {
    kind: 'saving_throw', abilitySuggestId: titleSuggestId.value,
  })?.total || 0
  return mod.value + (saveUp.value ? profBonus.value : 0) + extra + derived
})

const suggestItems = computed(() => {
  const typeId = props.block.content.suggest_type_id
  if (typeId == null) return []
  return useSuggestStore().items(typeId) || []
})

const skillsLoading = computed(() => {
  const typeId = props.block.content.suggest_type_id
  if (typeId == null) return false
  return !useSuggestStore().loaded(typeId)
})

const skillSkeletonCount = computed(() =>
  Math.max(1, (props.block.content.suggest_ids || []).length || 3)
)

const suggestById = computed(() =>
  Object.fromEntries(suggestItems.value.map(item => [String(item.id), item]))
)

const baseSkillIds = computed(() => (props.block.content.suggest_ids || []).map(String))

const skillsMap = computed(() => {
  const skills = statData.value.skills
  return skills && typeof skills === 'object' && !Array.isArray(skills) ? skills : {}
})

const skillsList = computed(() => {
  const ids = [...new Set([...baseSkillIds.value, ...Object.keys(skillsMap.value)])]
  return ids
    .map(id => {
      const saved = skillsMap.value[id] || { up: 0 }
      const suggest = suggestById.value[id]
      return {
        id,
        up: Math.max(saved.up || 0, derivedSkillProficiency(id).rank),
        manual_up: Number(saved.up) || 0,
        originalTitle: suggest?.value || '',
        proficiency_source: derivedSkillProficiency(id).sources.map(rule => rule.source_label).join(' · '),
        override_title: saved.override_title || '',
        title: saved.override_title || suggest?.value || (baseSkillIds.value.includes(id) ? id : 'Навык'),
        desc: suggest?.desc || '',
        custom: !baseSkillIds.value.includes(id),
      }
    })
    .filter(skill => suggestById.value[skill.id] || skillsMap.value[skill.id])
})

// View list with precomputed bonus (consumed by DndStatView and DndStatEditor)
const skillsView = computed(() => skillsList.value.map(s => ({
  ...s,
  bonus: skillBonus(s.id),
  bonusDetails: skillBonusDetails(s.id),
  rollMode: skillRollMode(s.id),
  rollModeSource: skillModeSource(s.id),
  rollModeCancelled: skillResolved(s.id).cancelled,
})))

const skillTooltipMaxDesc = computed(() => Number(props.block.content.skill_tooltip_max_desc ?? 0))
const skillTooltipWidth = computed(() => Number(props.block.content.skill_tooltip_width ?? 420))
const isMobileVariant = computed(() => (props.block.props?.variant || props.block.content?.variant) === 'mobile')
const armorState = computed(() => charCtx.characterArmor?.state || {})
const checkRollEffects = computed(() => charCtx.characterRolls?.effects
  ? charCtx.characterRolls.effects({ kind: 'ability_check', abilitySuggestId: titleSuggestId.value })
  : armorAbilityRollEffects(armorState.value, titleSuggestId.value))
const saveRollEffects = computed(() => charCtx.characterRolls?.effects
  ? charCtx.characterRolls.effects({ kind: 'saving_throw', abilitySuggestId: titleSuggestId.value })
  : armorAbilityRollEffects(armorState.value, titleSuggestId.value))
const checkResolved = computed(() => resolveRollMode('auto', checkRollEffects.value))
const saveResolved = computed(() => resolveRollMode('auto', saveRollEffects.value))
const checkRollMode = computed(() => checkResolved.value.mode)
const saveRollMode = computed(() => saveResolved.value.mode)
const checkModeSource = computed(() => checkResolved.value.source)
const saveModeSource = computed(() => saveResolved.value.source)

const editSkill = computed(() => {
  if (editSkillId.value == null) return null
  const s = skillsList.value.find(x => x.id === editSkillId.value)
  if (!s) return null
  return { ...s, bonuses: skillsMap.value[editSkillId.value]?.bonuses || [] }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function skillTitle(id) { return skillsList.value.find(s => s.id === String(id))?.title || String(id) }

function skillProficiencyRank(id) {
  const skill = skillsMap.value[String(id)] || { up: 0 }
  return Math.max(skill.up || 0, derivedSkillProficiency(id).rank)
}

function skillBonus(id) {
  const skill = skillsMap.value[String(id)] || { up: 0 }
  const extra = sumBonuses(skill.bonuses)
  const rank = skillProficiencyRank(id)
  return mod.value + rank * profBonus.value + extra + derivedSkillBonus(id, rank).total
}

function derivedSkillBonus(id, rank = skillProficiencyRank(id)) {
  const result = charCtx.characterDerivedEffects?.bonus?.('skill_bonus', {
    kind: 'skill_check', abilitySuggestId: titleSuggestId.value, skillId: id, proficient: rank > 0,
  })
  return {
    total: Number(result?.total) || 0,
    sources: Array.isArray(result?.sources) ? result.sources : [],
  }
}

function skillBonusDetails(id) {
  const skill = skillsMap.value[String(id)] || { up: 0, bonuses: [] }
  const rank = skillProficiencyRank(id)
  const manualBonuses = Array.isArray(skill.bonuses) ? skill.bonuses : []
  const rows = [{ key: 'ability', label: `Модификатор: ${displayTitle.value}`, value: mod.value }]
  if (rank > 0) {
    rows.push({ key: 'proficiency', label: rank >= 2 ? 'Мастерство' : 'Владение', value: rank * profBonus.value })
  }
  manualBonuses.forEach((bonus, index) => {
    const value = bonus && typeof bonus === 'object' ? bonus.value : bonus
    const label = bonus && typeof bonus === 'object' ? (bonus.name || bonus.title) : ''
    rows.push({ key: `manual-${index}`, label: label || 'Дополнительный бонус', value: Number(value) || 0 })
  })
  const derived = derivedSkillBonus(id, rank)
  if (derived.total || derived.sources.length) {
    const sources = [...new Set(derived.sources.map(rule => rule.source_label).filter(Boolean))]
    rows.push({ key: 'derived', label: sources.length ? `Источники: ${sources.join(' · ')}` : 'Автоматический бонус', value: derived.total })
  }
  return rows
}

function derivedSkillProficiency(id) {
  return charCtx.characterDerivedEffects?.skillProficiency?.(id) || { rank: 0, sources: [] }
}

function skillRollEffects(id) {
  const effects = charCtx.characterRolls?.effects
    ? [...charCtx.characterRolls.effects({ kind: 'skill_check', abilitySuggestId: titleSuggestId.value, skillId: id })]
    : [...checkRollEffects.value]
  if (String(id) === '4' && armorState.value.stealthDisadvantage && armorState.value.body?.name) {
    effects.push({ mode: 'disadvantage', source: `${armorState.value.body.name}: помеха Скрытности` })
  }
  return effects
}

function skillRollMode(id) {
  return skillResolved(id).mode
}

function skillModeSource(id) {
  return skillResolved(id).source
}

function skillResolved(id) {
  return resolveRollMode('auto', skillRollEffects(id))
}

function emitValue(patch) {
  emit('update:value', props.block.id, { ...statData.value, mod: mod.value, ...patch })
}

function syncStatVar() {
  if (titleSuggestId.value == null) return
  const stats = props.vars?.stats || {}
  if (stats[titleSuggestId.value] === mod.value) return
  emit('update:var', { stats: { ...stats, [titleSuggestId.value]: mod.value } })
}

function emitSkills(skills) { emitValue({ skills }) }
function pickSave() { emitValue({ save_up: !statData.value.save_up }) }
function onBaseChange(data) { emitValue({ value: data }) }
function onSaveBonusesChange(b) { emitValue({ save_bonuses: b }) }
function openEditor(kind = 'check', id = null) {
  if (!canEdit.value) return
  editSkillId.value = id
  editor.value = kind
}

function removeCustomSkill() {
  if (!editSkill.value?.custom) return
  const skills = { ...skillsMap.value }
  delete skills[editSkillId.value]
  editor.value = null
  emitSkills(skills)
}

function onSkillChange(patch) {
  const id = editSkillId.value
  if (id == null) return
  emitSkills({ ...skillsMap.value, [id]: { ...skillsMap.value[id], ...patch } })
}

// ─── Dice ──────────────────────────────────────────────────────────────────────
const diceStore = useDiceStore()
function rollD20Plus(title, bonus, mode = 'normal', scope = 'ability_check', context = {}, excluded = []) {
  diceStore.rollD20(title, bonus, mode, {
    roll_kind: scope,
    crit_mode: true,
    color: statColor.value,
    eventData: { ability: { id: titleSuggestId.value, name: displayTitle.value, typeId: titleSuggestTypeId.value } },
    bonus_formula: charCtx.characterDerivedEffects?.rollBonus?.({ kind: scope }, excluded),
    roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.(scope) || [],
    roll_adjustments: charCtx.characterCombatEffects?.rollAdjustments?.(scope, context) || [],
  })
}

// ─── Watches ─────────────────────────────────────────────────────────────────
watch(mod, syncStatVar)
watch(titleSuggestId, syncStatVar)
watch(() => props.vars?.stats, syncStatVar, { deep: true })

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  if (props.block.content.suggest_type_id != null) useSuggestStore().ensure(props.block.content.suggest_type_id)
  if (titleSuggestTypeId.value != null) useSuggestStore().ensure(titleSuggestTypeId.value)
  syncStatVar()
})
</script>

<style scoped>
.stat-editor-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-medium); width: var(--layout-stat-editor-width); min-width: 0; }
.stat-editor-total { display: inline-flex; gap: var(--spacing-xs); align-items: baseline; white-space: nowrap; color: var(--text-1); font-variant-numeric: tabular-nums; }
.stat-editor-total::after { content: ""; height: 20px; align-self: center; margin-inline-start: 8px; border-inline-end: 1px solid var(--border-strong); }
.stat-editor-total small { color: var(--text-muted); }
.stat-editor-title { min-width: 0; margin: 0; color: var(--text-1); font-family: var(--font-display); font-size: 20px; overflow-wrap: anywhere; }
.stat-editor-title small { color: var(--text-muted); font-size: .85em; font-weight: 400; }
</style>
