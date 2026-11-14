<template>
  <RowActionMenu ref="actions" title="Действия персонажа" :heading="menuSummary" :width="layoutTokens['sheet-header-menu-width']" :trigger-attrs="{ style: { maxWidth: 'var(--layout-sheet-header-tile-max)' } }" block>
    <template #trigger="{ open }">
      <div class="dnd-heading action-menu-source" :class="{ 'action-menu-source--open': open }">
        <button class="portrait" type="button" aria-label="Действия персонажа" aria-haspopup="menu" :aria-expanded="open"
          :aria-description="`${name || 'Персонаж'}: здоровье ${current} из ${maximum}${temporary ? ', временные HP ' + temporary : ''}, класс доспеха ${armor}, пассивное внимание ${perception}, расследование ${investigation}`">
          <img v-if="iconUrl && !failed" :src="iconUrl" alt="" @error="failed = true" />
          <span v-else>{{ Array.from(name || '?')[0] }}</span>
        </button>
        <span class="identity"><strong>{{ name || 'Лист персонажа' }}</strong>
        </span>
        <span class="heading-combat" @click.stop>
          <button class="heading-armor" type="button" :disabled="!canEdit" :aria-label="`Класс доспеха ${armor}`" title="Класс доспеха" aria-haspopup="dialog" @click="openPanel('armor')">
            <Shield class="heading-armor-icon" :stroke-width="1.35" aria-hidden="true" />
            <span class="heading-armor-value">{{ armor }}</span>
          </button>
          <SheetHealth interactive :current="current" :maximum="maximum" :temporary="temporary" aria-haspopup="dialog" @click="openPanel('health')" />
          <button class="heading-metrics" type="button" :aria-label="`Пассивные показатели: внимание ${perception}, расследование ${investigation}`"
            title="Пассивные показатели" aria-haspopup="dialog" :aria-expanded="passiveOpen" @click="openPassive($event)">
            <span class="heading-metric"><Eye :size="14" aria-hidden="true" />{{ perception }}</span>
            <span class="heading-metric"><Search :size="14" aria-hidden="true" />{{ investigation }}</span>
          </button>
        </span>
      </div>
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
      <RowActionItem action="create" :disabled="!canEdit" @click="select('add-status', close)">Добавить состояние</RowActionItem>
    </template>
  </RowActionMenu>
  <SheetPassiveDetails :open="passiveOpen" :anchor="passiveAnchor"
    :perception="perception" :investigation="investigation" @update:open="passiveOpen = $event" />
</template>
<script setup>
import { computed, inject, ref, shallowRef, watch } from 'vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import { Award, Eye, Footprints, HeartPulse, Search, Shield, TrendingUp, Zap } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import UtilityCell from '../UtilityCell.vue'
import SheetHealth from './SheetHealth.vue'
import SheetPassiveDetails from './SheetPassiveDetails.vue'
import { levelExperience, levelProgressPercent } from '../../blocks/dnd/lib/experience'
import { hpMaximum, normalizeHpMaximum } from '../../blocks/dnd/lib/hp'
import { abilityModifier, formatBonus as signed, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { initiativeSummary, proficiencySummary, speedSummary } from '../../lib/utilityValues'
const props = defineProps({ name: String, subtitle: String, iconUrl: String })
const emit = defineEmits(['open'])
const actions = ref(null), passiveOpen = ref(false), passiveAnchor = shallowRef(null)
function openPanel(panel) { actions.value?.close(); passiveOpen.value = false; emit('open', panel) }
function openPassive(event) {
  actions.value?.close()
  passiveAnchor.value = event.currentTarget
  passiveOpen.value = !passiveOpen.value
}
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
function passive(stat, abilitySuggestId, skillId) {
  const skill = values.value[stat]?.skills?.[skillId] || {}
  const derived = ctx.characterDerivedEffects
  const rank = Math.max(Number(skill.up) || 0, derived?.skillProficiency?.(skillId)?.rank || 0)
  const bonus = derived?.bonus?.('skill_bonus', { kind: 'skill_check', abilitySuggestId, skillId, proficient: rank > 0 })?.total || 0
  return 10 + abilityModifier(resolveNumValue(values.value[stat]?.value) || 10) + rank * proficiency.value + sumBonuses(skill.bonuses) + bonus
}
const perception = computed(() => passive('WIS', '5', '10'))
const investigation = computed(() => passive('INT', '4', '5'))
const failed = ref(false)
watch(() => props.iconUrl, () => { failed.value = false })
function select(panel, close) { close(); emit('open', panel) }
</script>
<style scoped>
.dnd-heading {display:grid;grid-template-columns:var(--layout-sheet-header-icon) minmax(0,1fr);column-gap:var(--spacing-small);row-gap:calc(var(--spacing-xs) / 2);width:100%;min-width:0;padding:0;border:0;border-radius:var(--radius-tile);background:transparent;color:var(--text-1);text-align:left;font:inherit;cursor:pointer}
.portrait {grid-row:1/3;align-self:center;display:grid;place-items:center;width:var(--layout-sheet-header-icon);height:var(--layout-sheet-header-icon);padding:0;border:0;background:transparent;cursor:pointer;overflow:hidden;border-radius:var(--radius-input);color:var(--accent-soft);font-size:var(--type-sheet-header-size)}
.portrait img {width:100%;height:100%;object-fit:cover}
.identity {display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.identity strong,.identity small {max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.identity strong {font-size:var(--type-sheet-header-size);line-height:var(--type-sheet-header-line-height)}
.identity small {font-size:var(--type-context-size);color:var(--text-muted)}
.heading-combat {display:flex;align-items:center;flex-wrap:wrap;gap:var(--spacing-xs) var(--spacing-small);min-width:0;font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-variant-numeric:lining-nums tabular-nums}
.heading-metrics {display:flex;flex:none;flex-direction:column;justify-content:center;min-width:var(--layout-touch-min);height:var(--layout-sheet-health-height);padding:0 var(--spacing-xs);border:0;border-radius:var(--radius-input);background:transparent;color:var(--text-muted);font:inherit;font-size:var(--type-context-size);line-height:calc(var(--layout-sheet-health-height) / 2);text-align:left;cursor:pointer}
.heading-armor {display:grid;place-items:center;flex:none;width:var(--layout-sheet-header-armor);height:var(--layout-sheet-header-armor);padding:0;border:0;background:transparent;color:inherit;font:inherit;border-radius:var(--radius-input);cursor:pointer}
.heading-armor-icon,.heading-armor-value {grid-area:1/1}
.heading-armor-icon {width:100%;height:100%;color:var(--text-muted)}
.heading-armor-value {padding-bottom:2px;font-weight:700;line-height:1}
.heading-metric {display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
.portrait:focus-visible,.heading-armor:focus-visible,.heading-metrics:focus-visible {outline:2px solid var(--accent-soft);outline-offset:2px}
.heading-armor:hover:not(:disabled),.heading-metrics:hover,.heading-metrics[aria-expanded="true"] {background:var(--surface-raised)}
.heading-armor:disabled {cursor:default}
.heading-metrics svg {color:var(--text-muted)}
.experience-action {display:flex;flex-direction:column;gap:5px;width:100%;min-width:0}
.experience-action small {color:var(--text-muted);font-size:12px}
.character-utility-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:var(--layout-sheet-header-menu-cell-height);gap:var(--layout-border);margin:var(--spacing-xs);overflow:hidden;border-radius:var(--radius-input);background:var(--border)}
.character-utility-grid .utility-cell {background:var(--bg)}
.utility-label {color:var(--text-muted);font-size:var(--type-context-size);font-weight:500}
.utility-readout {display:flex;align-items:center;gap:var(--spacing-small);font-size:var(--type-sheet-header-size);font-variant-numeric:tabular-nums;white-space:nowrap}
.utility-readout svg {flex:none;color:var(--text-muted)}
.experience-track {height:7px;border-radius:var(--radius-input);overflow:hidden;background:var(--surface-raised)}
.experience-track i {display:block;height:100%;background:var(--accent-soft)}
@media (--ui-compact) {.identity {display:block}.identity strong,.identity small{display:block}.identity small{font-size:var(--type-caption-size,12px)}}
@media (--ui-phone) {.dnd-heading {column-gap:var(--spacing-xs)}}
</style>
