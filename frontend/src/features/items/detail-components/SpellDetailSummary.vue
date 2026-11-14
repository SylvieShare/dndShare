<template>
  <div class="spell-summary">
    <div v-if="levelLabel || school" class="spell-summary-kind">
      <strong v-if="levelLabel">{{ levelLabel }}</strong>
      <span v-if="school">{{ school }}</span>
      <span v-if="data.concentration">Концентрация</span>
      <span v-if="data.ritual">Ритуал</span>
    </div>

    <div class="spell-summary-casting">
      <div v-if="hasComponents" class="spell-summary-components-card">
        <span class="spell-summary-components-label">Компоненты</span>
        <SpellComponentBadge class="spell-summary-component-badge" :components="data.components" />
      </div>
      <div class="spell-summary-grid">
        <CoverStatCard v-if="data.time" class="spell-summary-time-card" label="Время" size="compact"><template #value><ActionTiming :time="data.time" size="inherit" /></template></CoverStatCard>
        <CoverStatCard v-if="data.range" :icon="LocateFixed" label="Дистанция" :value="rangeLabel(data.range)" size="compact" />
        <CoverStatCard v-if="data.duration" :icon="Hourglass" label="Длительность" :value="spellDurationLabel(data.duration)" size="compact" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { rangeLabel, spellComponentDetails } from '@/shared/lib/spellPresentation'
import { computed } from 'vue'
import { Hourglass, LocateFixed } from '@lucide/vue'
import ActionTiming from '@/shared/ui/ActionTiming.vue'
import SpellComponentBadge from '@/features/items/components/SpellComponentBadge.vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'
import { spellDurationLabel } from '@/features/character-editor/blocks/dnd/composables/useSpellCalc'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const { suggestItems } = useSchemaSuggests(() => props.type)
const data = computed(() => props.item.data || {})
const school = computed(() => suggestItems('schoolId').find(row => String(row.id) === String(data.value.schoolId))?.value || '')
const levelLabel = computed(() => {
  const level = data.value.lvl
  if (level === 0) return 'Заговор'
  if (level == null) return ''
  return `${level} уровень`
})

const hasComponents = computed(() => spellComponentDetails(data.value.components).length > 0)
</script>

<style scoped>
.spell-summary {
  flex: 1;
  min-height: min-content;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.spell-summary-kind {
  align-self: flex-start;
  min-width: 112px;
  max-width: min(260px, 60%);
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 11px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 16%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--scrim) 68%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 42%, transparent);
  backdrop-filter: blur(5px);
  box-sizing: border-box;
}

.spell-summary-kind strong {
  color: var(--text-on-accent);
  font-size: 13px;
  line-height: 1.15;
}

.spell-summary-kind span {
  overflow: hidden;
  color: color-mix(in srgb, var(--text-on-accent) 70%, transparent);
  font-size: 10px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spell-summary-casting {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.spell-summary-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.spell-summary-components-card {
  align-self: flex-end;
  width: min(var(--layout-spell-component-popup-width), 100%);
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:var(--spacing-xs);
}
.spell-summary-component-badge {width:100%;--spell-material-width:100%}
.spell-summary-components-label {color:var(--text-2);font-size:var(--type-context-size);line-height:var(--type-context-line-height)}
@media (--ui-phone){.spell-summary-grid{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}.spell-summary-time-card{grid-column:1 / -1}}

@media (max-width: 520px) {
  .spell-summary { gap: 9px; }
  .spell-summary-kind { min-width: 96px; padding: 7px 9px; }
  .spell-summary-kind strong { font-size: 12px; }
  .spell-summary-kind span { font-size: 9px; }
  .spell-summary-casting { gap: 5px; }
  .spell-summary-grid { gap: 7px; }
}
</style>
