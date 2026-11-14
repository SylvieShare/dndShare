<template>
  <RowActionMenu ref="actions" title="Действия персонажа" :heading="menuSummary" :width="layoutTokens['sheet-header-menu-width']" :trigger-attrs="{ style: { maxWidth: 'var(--layout-sheet-header-tile-max)' } }" block>
    <template #trigger="{ open }">
      <CharacterSummaryTile class="dnd-heading action-menu-source" :class="{ 'action-menu-source--open': open }"
        :name="name" :icon-url="iconUrl" action-label="Действия персонажа" :expanded="open"
        :armor="armor" :current="current" :maximum="maximum" :temporary="temporary"
        :edit-armor="canEdit" armor-control edit-health @armor="openPanel('armor')" @health="openPanel('health')" />
    </template>
    <template #default="{ close }">
      <RowActionItem action="edit" :disabled="!canEdit" @click="select('profile', close)">Изменить персонажа</RowActionItem>
      <RowActionItem :icon="TrendingUp" :disabled="!canEdit" @click="select('experience', close)">
        <span class="experience-action"><span>Опыт <small>{{ experience }}<template v-if="nextExperience !== null"> / {{ nextExperience }}</template></small></span>
          <span class="experience-track" role="progressbar" aria-label="Прогресс уровня" :aria-valuenow="Math.round(progress)" :aria-valuemin="0" :aria-valuemax="100"><i :style="{ width: progress + '%' }" /></span>
        </span>
      </RowActionItem>
      <RowActionItem :icon="HeartPulse" @click="select('health', close)">
        {{ canEdit ? 'Изменить HP' : 'Здоровье' }}
        <template #suffix><SheetHealth :current="current" :maximum="maximum" :temporary="temporary" /></template>
      </RowActionItem>
      <div class="character-utility-grid" role="group" aria-label="Показатели персонажа">
        <UtilityCell v-for="metric in metrics" :key="metric.key" stacked role="menuitem"
          :label="metric.label" :disabled="!canEdit && !metric.rollable" aria-haspopup="dialog" @click="select(metric.key, close)">
          <span class="utility-label">{{ metric.label }}</span>
          <span class="utility-readout"><component :is="metric.icon" :size="20" aria-hidden="true" /><strong>{{ metric.value }}</strong></span>
        </UtilityCell>
      </div>
      <SheetPassiveTable :perception="perception" :investigation="investigation" />
      <RowActionItem action="create" :disabled="!canEdit" @click="select('add-status', close)">Добавить состояние</RowActionItem>
    </template>
  </RowActionMenu>
</template>
<script setup>
import { computed, inject, ref } from 'vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import { Award, Footprints, HeartPulse, Shield, TrendingUp, Zap } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import UtilityCell from '../UtilityCell.vue'
import SheetHealth from './SheetHealth.vue'
import CharacterSummaryTile from './CharacterSummaryTile.vue'
import SheetPassiveTable from './SheetPassiveTable.vue'
import { levelExperience, levelProgressPercent } from '../../blocks/dnd/lib/experience'
import { hpMaximum, normalizeHpMaximum } from '../../blocks/dnd/lib/hp'
import { abilityModifier, formatBonus as signed, resolveNumValue } from '@/shared/lib/dnd'
import { passiveScores } from '../../lib/passiveScores'
import { collectCharacterDerivedEffects } from '../../lib/characterDerivedEffects'
import { initiativeSummary, proficiencySummary, speedSummary } from '../../lib/utilityValues'
const props = defineProps({ name: String, subtitle: String, iconUrl: String })
const emit = defineEmits(['open'])
const actions = ref(null)
function openPanel(panel) { actions.value?.close(); emit('open', panel) }
const ctx = inject('charCtx', {})
const values = computed(() => ctx.values || {})
const canEdit = computed(() => !!ctx.ownerMode)
const level = computed(() => values.value.lvl?.level)
const speed = computed(() => speedSummary(values.value.speed, ctx).total)
const initiative = computed(() => initiativeSummary(values.value.initiative, values.value, ctx).total)
const proficiency = computed(() => proficiencySummary(values.value.prof_bonus, level.value).total)
const menuSummary = computed(() => [props.subtitle, level.value ? level.value + ' ур.' : ''].filter(Boolean).join(' · '))
const experience = computed(() => Number(values.value.lvl?.exp) || 0)
const nextExperience = computed(() => levelExperience(values.value.lvl).nextLevelExp)
const progress = computed(() => levelProgressPercent(values.value.lvl))
const armor = computed(() => ctx.characterArmor?.state?.total ?? 10 + abilityModifier(resolveNumValue(values.value.DEX?.value) || 10))
const metrics = computed(() => [
  { key: 'speed', label: 'Скорость', icon: Footprints, value: speed.value + ' фт' },
  { key: 'initiative', label: 'Инициатива', icon: Zap, value: signed(initiative.value), rollable: true },
  { key: 'proficiency', label: 'Мастерство', icon: Award, value: signed(proficiency.value), rollable: true },
  { key: 'armor', label: 'КД', icon: Shield, value: armor.value },
])
const current = computed(() => Number(values.value.hp?.current) || 0)
const temporary = computed(() => Math.max(0, Number(values.value.hp?.temp) || 0))
const maximum = computed(() => {
  const max = normalizeHpMaximum(values.value.hp?.max)
  return hpMaximum({ max: { ...max, bonuses: [...max.bonuses, ...(ctx.characterHitPoints?.bonuses || [])] } })
})
const passives = computed(() => passiveScores(values.value,
  collectCharacterDerivedEffects(values.value, ctx.characterResources?.itemsById || new Map()), proficiency.value))
const perception = computed(() => passives.value[0].value)
const investigation = computed(() => passives.value[1].value)
function select(panel, close) { close(); emit('open', panel) }
</script>
<style scoped>
.experience-action {display:flex;flex-direction:column;gap:5px;width:100%;min-width:0}
.experience-action small {color:var(--text-muted);font-size:12px}
.character-utility-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:var(--layout-sheet-header-menu-cell-height);gap:var(--layout-border);margin:var(--spacing-xs);overflow:hidden;border-radius:var(--radius-input);background:var(--border)}
.character-utility-grid .utility-cell {background:var(--bg)}
.utility-label {color:var(--text-muted);font-size:var(--type-context-size);font-weight:500}
.utility-readout {display:flex;align-items:center;gap:var(--spacing-small);font-size:var(--type-sheet-header-size);font-variant-numeric:tabular-nums;white-space:nowrap}
.utility-readout svg {flex:none;color:var(--text-muted)}
.experience-track {height:7px;border-radius:var(--radius-input);overflow:hidden;background:var(--surface-raised)}
.experience-track i {display:block;height:100%;background:var(--accent-soft)}
</style>
