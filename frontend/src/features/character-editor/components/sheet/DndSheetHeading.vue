<template>
  <RowActionMenu title="Действия персонажа" :heading="menuSummary" :trigger-attrs="{ style: { maxWidth: 'var(--layout-sheet-header-tile-max)' } }" block>
    <template #trigger="{ open }">
      <button class="dnd-heading action-menu-source" :class="{ 'action-menu-source--open': open }"
        type="button" aria-label="Действия персонажа" :aria-expanded="open"
        :aria-description="`${name || 'Персонаж'}: здоровье ${current} из ${maximum}${temporary ? ', временные HP ' + temporary : ''}, класс доспеха ${armor}, пассивное внимание ${perception}, расследование ${investigation}`">
        <span class="portrait">
          <img v-if="iconUrl && !failed" :src="iconUrl" alt="" @error="failed = true" />
          <span v-else>{{ Array.from(name || '?')[0] }}</span>
        </span>
        <span class="identity"><strong>{{ name || 'Лист персонажа' }}</strong>
        </span>
        <span class="heading-combat">
          <span class="heading-armor" :aria-label="`Класс доспеха ${armor}`" title="Класс доспеха">
            <Shield class="heading-armor-icon" :stroke-width="1.35" aria-hidden="true" />
            <span class="heading-armor-value">{{ armor }}</span>
          </span>
          <SheetHealth :current="current" :maximum="maximum" :temporary="temporary" />
          <span class="heading-metrics">
            <span class="heading-metric" :aria-label="`Пассивное внимание ${perception}`" title="Пассивное внимание"><Eye :size="14" />{{ perception }}</span>
            <span class="heading-metric" :aria-label="`Пассивное расследование ${investigation}`" title="Пассивное расследование"><Search :size="14" />{{ investigation }}</span>
          </span>
        </span>
      </button>
    </template>
    <template #default="{ close }">
      <RowActionItem action="edit" :disabled="!canEdit" @click="select('profile', close)">Изменить персонажа</RowActionItem>
      <RowActionItem :icon="TrendingUp" :disabled="!canEdit" @click="select('experience', close)">
        <span class="experience-action"><span>Опыт <small>{{ experience }}<template v-if="nextExperience !== null"> / {{ nextExperience }}</template></small></span>
          <span class="experience-track" role="progressbar" aria-label="Прогресс уровня" :aria-valuenow="Math.round(progress)" :aria-valuemin="0" :aria-valuemax="100"><i :style="{ width: progress + '%' }" /></span>
        </span>
      </RowActionItem>
      <RowActionItem :icon="HeartPulse" @click="select('health', close)">{{ canEdit ? 'Изменить HP' : 'Здоровье' }}</RowActionItem>
      <RowActionItem action="create" :disabled="!canEdit" @click="select('add-status', close)">Добавить состояние</RowActionItem>
    </template>
  </RowActionMenu>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import { Eye, HeartPulse, Search, Shield, TrendingUp } from '@lucide/vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import SheetHealth from './SheetHealth.vue'
import { levelExperience, levelProgressPercent } from '../../blocks/dnd/lib/experience'
import { hpMaximum, normalizeHpMaximum } from '../../blocks/dnd/lib/hp'
import { abilityModifier, resolveNumValue, sumBonuses, proficiencyBonus } from '@/shared/lib/dnd'
const props = defineProps({ name: String, subtitle: String, iconUrl: String })
const emit = defineEmits(['open'])
const ctx = inject('charCtx', {})
const values = computed(() => ctx.values || {})
const canEdit = computed(() => !!ctx.ownerMode)
const level = computed(() => values.value.lvl?.level)
const menuSummary = computed(() => [props.subtitle, level.value ? level.value + ' ур.' : ''].filter(Boolean).join(' · '))
const experience = computed(() => Number(values.value.lvl?.exp) || 0)
const nextExperience = computed(() => levelExperience(values.value.lvl).nextLevelExp)
const progress = computed(() => levelProgressPercent(values.value.lvl))
const armor = computed(() => ctx.characterArmor?.state?.total ?? 10 + abilityModifier(resolveNumValue(values.value.DEX?.value) || 10))
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
  const stored = values.value.prof_bonus || {}
  const proficiency = (stored.auto === false ? Number(stored.v) || 0 : proficiencyBonus(level.value || 1)) + sumBonuses(stored.bonuses)
  const bonus = derived?.bonus?.('skill_bonus', { kind: 'skill_check', abilitySuggestId, skillId, proficient: rank > 0 })?.total || 0
  return 10 + abilityModifier(resolveNumValue(values.value[stat]?.value) || 10) + rank * proficiency + sumBonuses(skill.bonuses) + bonus
}
const perception = computed(() => passive('WIS', '5', '10'))
const investigation = computed(() => passive('INT', '4', '5'))
const failed = ref(false)
watch(() => props.iconUrl, () => { failed.value = false })
function select(panel, close) { close(); emit('open', panel) }
</script>
<style scoped>
.dnd-heading {display:grid;grid-template-columns:var(--layout-sheet-header-icon) minmax(0,1fr);column-gap:var(--spacing-small);row-gap:calc(var(--spacing-xs) / 2);width:100%;min-width:0;padding:0;border:0;background:transparent;color:var(--text-1);text-align:left;font:inherit;cursor:pointer}
.portrait {grid-row:1/3;align-self:center;display:grid;place-items:center;width:var(--layout-sheet-header-icon);height:var(--layout-sheet-header-icon);overflow:hidden;border-radius:var(--radius-input);color:var(--accent-soft);font-size:var(--type-sheet-header-size)}
.portrait img {width:100%;height:100%;object-fit:cover}
.identity {display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.identity strong,.identity small {max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.identity strong {font-size:var(--type-sheet-header-size);line-height:var(--type-sheet-header-line-height)}
.identity small {font-size:var(--type-context-size);color:var(--text-muted)}
.heading-combat {display:flex;align-items:center;flex-wrap:wrap;gap:var(--spacing-xs);min-width:0;font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-variant-numeric:lining-nums tabular-nums}
.heading-metrics {display:flex;flex:none;flex-direction:column;justify-content:center;height:var(--layout-sheet-health-height);color:var(--text-muted);font-size:var(--type-context-size);line-height:calc(var(--layout-sheet-health-height) / 2)}
.heading-armor {display:grid;place-items:center;flex:none;width:var(--layout-sheet-header-armor);height:var(--layout-sheet-header-armor)}
.heading-armor-icon,.heading-armor-value {grid-area:1/1}
.heading-armor-icon {width:100%;height:100%;color:var(--text-muted)}
.heading-armor-value {padding-bottom:2px;font-weight:700;line-height:1}
.heading-metric {display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
.heading-metrics svg {color:var(--text-muted)}
.experience-action {display:flex;flex-direction:column;gap:5px;width:100%;min-width:0}
.experience-action small {color:var(--text-muted);font-size:12px}
.experience-track {height:7px;border-radius:var(--radius-input);overflow:hidden;background:var(--surface-raised)}
.experience-track i {display:block;height:100%;background:var(--accent-soft)}
@media (--ui-compact) {.identity {display:block}.identity strong,.identity small{display:block}.identity small{font-size:var(--type-caption-size,12px)}}
</style>
