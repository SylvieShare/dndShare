<template>
  <div class="participant-stats" aria-label="Защита и пассивные навыки">
    <LoadingIndicator v-if="loading" inline size="xs" label="Расчёт показателей" />
    <p v-else-if="error" role="alert" :title="error">{{ error }}</p>
    <template v-else>
      <span v-for="indicator in indicators" :key="indicator.key" class="participant-stat" :class="{ 'participant-stat--passive': indicator.key !== 'ac' }" tabindex="0" :aria-label="`${indicator.label}: ${indicator.value}`"
        @mouseenter="showTooltip($event, indicator)" @mouseleave="tooltip = null" @focus="showTooltip($event, indicator)" @blur="tooltip = null">
        <strong>{{ indicator.value }}</strong><component :is="indicator.icon" :size="14" aria-hidden="true" />
      </span>
    </template>
  </div>
  <ItemTooltip v-if="tooltip" :anchor="tooltip.anchor" :title="tooltip.label" :desc="tooltip.description" :width="280" :z-index="9500" />
</template>
<script setup>
import { computed, shallowRef } from 'vue'
import { Eye, Search, Shield } from '@lucide/vue'
import { LoadingIndicator } from '@sylvieshare/share-ui'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import { useParticipantDefenses } from '../composables/useParticipantDefenses'
const props = defineProps({ participant: { type: Object, required: true } })
const { stats, loading, error } = useParticipantDefenses(() => props.participant)
const indicators = computed(() => [
  { key: 'ac', label: 'Класс доспеха', value: stats.value.armorClass, icon: Shield, description: 'Защита от попадания атакой. Учитывает экипированные доспехи, щит и настроенные бонусы.' },
  ...stats.value.passives.map(skill => ({ ...skill, key: skill.id, icon: skill.id === '10' ? Eye : Search,
    description: `${skill.id === '10' ? 'Мудрость (Внимательность): заметить скрытое или опасность.' : 'Интеллект (Расследование): найти подсказки и сделать выводы.'}<br>${skill.description}` })),
])
const tooltip = shallowRef(null)
function showTooltip(event, indicator) { tooltip.value = { ...indicator, anchor: event.currentTarget } }

</script>
<style scoped>
.participant-stats { display: flex; align-items: center; min-height: 18px; line-height: 18px; }
.participant-stat { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: flex-start; gap: 4px; padding: 0 8px; color: var(--text-2); cursor: help; }
.participant-stat:first-child { padding-left: 0; }
.participant-stat + .participant-stat { border-left: 1px solid var(--border); }
.participant-stat:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--r-sm); }
.participant-stat svg { flex-shrink: 0; color: var(--info); }
.participant-stat strong { color: var(--text-1); font-size: 13px; font-variant-numeric: tabular-nums; }
.participant-stat--passive strong, .participant-stat--passive svg { color: var(--text-muted); }
.participant-stats p { margin: 0; overflow: hidden; color: var(--danger); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
</style>
