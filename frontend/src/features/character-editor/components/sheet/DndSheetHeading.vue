<template>
  <RowActionMenu ref="actions" title="Действия персонажа" :width="layoutTokens['sheet-header-menu-width']" :trigger-attrs="{ style: { maxWidth: 'var(--layout-sheet-header-tile-max)' } }" block>
    <template #trigger="{ open }">
      <CharacterSummaryTile class="dnd-heading action-menu-source" :class="{ 'action-menu-source--open': open }"
        :name="name" :icon-url="iconUrl" action-label="Действия персонажа" :expanded="open"
        :current="current" :maximum="maximum" :temporary="temporary"
        enlarged-health edit-health @health="openPanel('health')" />
    </template>
    <template #default="{ close }">
      <CharacterMenuActions :summary="menuSummary" :edit="() => select('profile', close)" :edit-disabled="!canEdit" edit-label="Изменить персонажа" />
      <RowActionItem :icon="TrendingUp" :disabled="!canEdit" @click="select('experience', close)">
        <span class="experience-action"><span>Опыт <small>{{ experience }}<template v-if="nextExperience !== null"> / {{ nextExperience }}</template></small></span>
          <span class="experience-track" role="progressbar" aria-label="Прогресс уровня" :aria-valuenow="Math.round(progress)" :aria-valuemin="0" :aria-valuemax="100"><i :style="{ width: progress + '%' }" /></span>
        </span>
      </RowActionItem>
      <RowActionItem :icon="HeartPulse" @click="select('health', close)">
        {{ canEdit ? 'Изменить HP' : 'Здоровье' }}
        <template #suffix><SheetHealth :current="current" :maximum="maximum" :temporary="temporary" /></template>
      </RowActionItem>
      <SheetPassiveTable :perception="perception" :investigation="investigation" />
      <RowActionItem action="create" :disabled="!canEdit" @click="select('add-status', close)">Добавить состояние</RowActionItem>
    </template>
  </RowActionMenu>
</template>
<script setup>
import CharacterMenuActions from '@/features/character-editor/components/CharacterMenuActions.vue'
import { computed, inject, ref } from 'vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import { HeartPulse, TrendingUp } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SheetHealth from './SheetHealth.vue'
import CharacterSummaryTile from './CharacterSummaryTile.vue'
import SheetPassiveTable from './SheetPassiveTable.vue'
import { levelExperience, levelProgressPercent } from '../../blocks/dnd/lib/experience'
import { hpMaximum, normalizeHpMaximum } from '../../blocks/dnd/lib/hp'
import { passiveScores } from '../../lib/passiveScores'
import { collectCharacterDerivedEffects } from '../../lib/characterDerivedEffects'
import { proficiencySummary } from '../../lib/utilityValues'
const props = defineProps({ name: String, subtitle: String, iconUrl: String })
const emit = defineEmits(['open'])
const actions = ref(null)
function openPanel(panel) { actions.value?.close(); emit('open', panel) }
const ctx = inject('charCtx', {})
const values = computed(() => ctx.values || {})
const canEdit = computed(() => !!ctx.ownerMode)
const level = computed(() => values.value.lvl?.level)
const proficiency = computed(() => proficiencySummary(values.value.prof_bonus, level.value).total)
const menuSummary = computed(() => [props.subtitle, level.value ? level.value + ' ур.' : ''].filter(Boolean).join(' · '))
const experience = computed(() => Number(values.value.lvl?.exp) || 0)
const nextExperience = computed(() => levelExperience(values.value.lvl).nextLevelExp)
const progress = computed(() => levelProgressPercent(values.value.lvl))
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
.experience-track {height:7px;border-radius:var(--radius-input);overflow:hidden;background:var(--surface-raised)}
.experience-track i {display:block;height:100%;background:var(--accent-soft)}
</style>
