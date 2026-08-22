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
      :save-up="!!statData.save_up"
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
      @roll-stat="rollD20Plus(`${displayTitle} — проверка`, mod, checkRollMode)"
      @roll-save="rollD20Plus(`${displayTitle} — спасбросок`, save, saveRollMode)"
      @roll-skill="id => rollD20Plus(skillTitle(id), skillBonus(id), skillRollMode(id))"
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
        :save-up="!!statData.save_up"
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
        @roll-stat="rollD20Plus(`${displayTitle} — проверка`, mod, checkRollMode)"
        @roll-save="rollD20Plus(`${displayTitle} — спасбросок`, save, saveRollMode)"
        @roll-skill="id => rollD20Plus(skillTitle(id), skillBonus(id), skillRollMode(id))"
      />
    </template>

    <template #editor>
      <DndStatEditor
        :title="displayTitle"
        :base-data="numData"
        :save-up="!!statData.save_up"
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
const save = computed(() => {
  const extra = sumBonuses(statData.value.save_bonuses)
  return mod.value + (statData.value.save_up ? profBonus.value : 0) + extra
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
        up: saved.up || 0,
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
  rollMode: skillRollMode(s.id),
  rollModeSource: skillModeSource(s.id),
  rollModeCancelled: skillResolved(s.id).cancelled,
})))

const skillTooltipMaxDesc = computed(() => Number(props.block.content.skill_tooltip_max_desc ?? 0))
const skillTooltipWidth = computed(() => Number(props.block.content.skill_tooltip_width ?? 420))
const isMobileVariant = computed(() => (props.block.props?.variant || props.block.content?.variant) === 'mobile')
const armorState = computed(() => charCtx.characterArmor?.state || {})
const statRollEffects = computed(() => charCtx.characterRolls?.effects
  ? charCtx.characterRolls.effects({ kind: 'ability', abilitySuggestId: titleSuggestId.value })
  : armorAbilityRollEffects(armorState.value, titleSuggestId.value))
const checkAutomatic = computed(() => resolveRollMode('auto', statRollEffects.value))
const saveAutomatic = computed(() => resolveRollMode('auto', statRollEffects.value))
const checkResolved = computed(() => resolveRollMode(statData.value.check_roll_mode, statRollEffects.value))
const saveResolved = computed(() => resolveRollMode(statData.value.save_roll_mode, statRollEffects.value))
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

function skillBonus(id) {
  const skill = skillsMap.value[String(id)] || { up: 0 }
  const extra = sumBonuses(skill.bonuses)
  return mod.value + (skill.up || 0) * profBonus.value + extra
}

function skillRollEffects(id) {
  const effects = [...statRollEffects.value]
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
function rollD20Plus(title, bonus, mode = 'normal') {
  diceStore.rollD20(title, bonus, mode, { crit_mode: true, color: statColor.value })
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
