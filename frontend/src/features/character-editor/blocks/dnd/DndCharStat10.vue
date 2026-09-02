<template>
  <BaseTile
    ref="tileRef"
    class="stat-block"
    :class="{ 'stat-block--mobile': isMobileVariant }"
    :color="statColor"
    strip
    :style="{ '--sc': statColor }"
  >
    <DndStatView
      :title="displayTitle"
      :color="statColor"
      :suggest-svg="titleSuggest?.svg || ''"
      :mod="mod"
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
      @roll-stat="rollD20Plus(`${displayTitle} — проверка`, checkTotal, checkRollMode, 'ability_check')"
      @roll-save="rollD20Plus(`${displayTitle} — спасбросок`, save, saveRollMode, 'saving_throw')"
      @roll-skill="id => rollD20Plus(skillTitle(id), skillBonus(id), skillRollMode(id), 'ability_check', { proficiencyRank: skillProficiencyRank(id) })"
    />
  </BaseTile>

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :color="statColor"
    :nav="nav"
    @close="closeEditor"
  >
    <template #view="{ revealed }">
      <DndStatView
        mode="panel"
        :show-edit="true"
        :edit-fade="revealed"
        :mobile-variant="isMobileVariant"
        :title="displayTitle"
        :color="statColor"
        :suggest-svg="titleSuggest?.svg || ''"
        :mod="mod"
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
        @roll-stat="rollD20Plus(`${displayTitle} — проверка`, checkTotal, checkRollMode, 'ability_check')"
        @roll-save="rollD20Plus(`${displayTitle} — спасбросок`, save, saveRollMode, 'saving_throw')"
        @roll-skill="id => rollD20Plus(skillTitle(id), skillBonus(id), skillRollMode(id), 'ability_check', { proficiencyRank: skillProficiencyRank(id) })"
      />
    </template>

    <template #editor>
      <DndStatEditor
        :title="displayTitle"
        :base-data="numData"
        :save-up="saveUp"
        :save-source="derivedSaveSource"
        :save-bonuses="statData.save_bonuses || []"
        :skills="skillsView"
        :allow-add-skills="!!block.content.allow_add_skills"
        :check-roll-mode="statData.check_roll_mode || 'auto'"
        :check-auto-mode="checkAutoMode"
        :check-auto-source="checkAutoSource"
        :save-roll-mode="statData.save_roll_mode || 'auto'"
        :save-auto-mode="saveAutoMode"
        :save-auto-source="saveAutoSource"
        @update-base="onBaseChange"
        @toggle-save="pickSave"
        @update-save-bonuses="onSaveBonusesChange"
        @update-check-roll-mode="value => setRollMode('check_roll_mode', value)"
        @update-save-roll-mode="value => setRollMode('save_roll_mode', value)"
        @open-skill="onOpenSkill"
        @delete-skill="deleteSkill"
        @add-skill="addSkill"
      />
    </template>

    <template #sub>
      <DndStatSkillEditor
        v-if="editSkill"
        :key="editSkillId"
        :skill="editSkill"
        :mod="mod"
        :prof-bonus="profBonus"
        :auto-mode="skillAutoMode(editSkillId)"
        :auto-source="skillAutoSource(editSkillId)"
        @change="onSkillChange"
        @back="nav.backToDetail"
      />
    </template>
  </MorphEditorShell>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { abilityModifier, sumBonuses } from '@/shared/lib/dnd'
import { armorAbilityRollEffects, resolveRollMode } from '@/features/character-editor/blocks/dnd/lib/rollMode'
import { BaseTile } from '@sylvieshare/share-ui'
import DndStatEditor from '@/features/character-editor/blocks/dnd/components/DndStatEditor'
import DndStatSkillEditor from '@/features/character-editor/blocks/dnd/components/DndStatSkillEditor'
import DndStatView from '@/features/character-editor/blocks/dnd/components/DndStatView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useDiceStore } from '@/stores/dice'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { useSheetSubpages } from '@sylvieshare/share-ui'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps(['block', 'value', 'values', 'vars'])
const emit = defineEmits(['update:value', 'update:var'])
const charCtx = inject('charCtx', { ownerMode: true })
const canEdit = computed(() => !!charCtx.ownerMode)

// ─── Editor window state ───────────────────────────────────────────────────────
const tileRef = ref(null)
const editSkillId = ref(null)
const nav = useSheetSubpages()
const { editorOpen, originRect, originEl, openFrom, close: closeMorph } = useMorphOrigin()

// ─── Computeds ───────────────────────────────────────────────────────────────
const statData = computed(() => props.value || {})

const numData = computed(() => {
  const v = statData.value.value
  if (v && typeof v === 'object') return v
  return { base: parseInt(v) || 10, bonuses: [] }
})

const statDisplayValue = computed(() =>
  (numData.value.base || 0) + sumBonuses(numData.value.bonuses)
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
  if (!statData.value.skills || typeof statData.value.skills !== 'object' || Array.isArray(statData.value.skills)) return {}
  return Object.fromEntries(Object.entries(statData.value.skills).map(([id, data]) => [
    String(id),
    {
      up: Number(data?.up) || 0,
      override_title: data?.override_title || '',
      bonuses: Array.isArray(data?.bonuses) ? data.bonuses : [],
      roll_mode: data?.roll_mode || 'auto',
    },
  ]))
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
        manual_up: saved.up || 0,
        proficiency_source: derivedSkillProficiency(id).sources.map(rule => rule.source_label).join(' · '),
        override_title: saved.override_title || '',
        title: saved.override_title || suggest?.value || id,
        desc: suggest?.desc || '',
        custom: !baseSkillIds.value.includes(id),
        roll_mode: saved.roll_mode || 'auto',
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
const checkAutomatic = computed(() => resolveRollMode('auto', checkRollEffects.value))
const saveAutomatic = computed(() => resolveRollMode('auto', saveRollEffects.value))
const checkResolved = computed(() => resolveRollMode(statData.value.check_roll_mode, checkRollEffects.value))
const saveResolved = computed(() => resolveRollMode(statData.value.save_roll_mode, saveRollEffects.value))
const checkAutoMode = computed(() => checkAutomatic.value.mode)
const saveAutoMode = computed(() => saveAutomatic.value.mode)
const checkAutoSource = computed(() => checkAutomatic.value.source)
const saveAutoSource = computed(() => saveAutomatic.value.source)
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

function skillAutoMode(id) {
  return resolveRollMode('auto', skillRollEffects(id)).mode
}

function skillAutoSource(id) {
  return resolveRollMode('auto', skillRollEffects(id)).source
}

function skillRollMode(id) {
  return skillResolved(id).mode
}

function skillModeSource(id) {
  return skillResolved(id).source
}

function skillResolved(id) {
  return resolveRollMode(skillsMap.value[String(id)]?.roll_mode, skillRollEffects(id))
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
function setRollMode(field, value) { emitValue({ [field]: value }) }

function deleteSkill(id) {
  const newMap = { ...skillsMap.value }
  delete newMap[String(id)]
  emitSkills(newMap)
}

function addSkill(name) {
  const title = (name || '').trim()
  if (!title) return
  // Custom skill: no suggest entry, so we mint a unique non-suggest id and store the typed name as
  // the override title (skillsList resolves a custom skill's title from override_title).
  const id = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36)
  emitSkills({ ...skillsMap.value, [id]: { up: 0, override_title: title, bonuses: [] } })
}

function onSkillChange(data) {
  const id = editSkillId.value
  if (id == null) return
  const existing = skillsMap.value[id] || { up: 0 }
  const updated = { ...existing, up: data.up, bonuses: data.bonuses, roll_mode: data.roll_mode || 'auto' }
  if (data.override_title) updated.override_title = data.override_title
  else delete updated.override_title
  emitSkills({ ...skillsMap.value, [id]: updated })
}

function onOpenSkill(id) {
  editSkillId.value = String(id)
  nav.goSub('skill')
}

// ─── Editor window open/close ──────────────────────────────────────────────────
function openEditor() {
  if (!canEdit.value) return
  editSkillId.value = null
  openFrom(tileRef.value?.$el)
}

function closeEditor() {
  closeMorph()
  editSkillId.value = null
}

// ─── Dice ──────────────────────────────────────────────────────────────────────
const diceStore = useDiceStore()
function rollD20Plus(title, bonus, mode = 'normal', scope = 'ability_check', context = {}) {
  diceStore.rollD20(title, bonus, mode, {
    crit_mode: true,
    color: statColor.value,
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
.stat-block {
  padding: 12px 14px 14px;
  position: relative;
}
</style>
