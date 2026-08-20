<template>
  <div class="spell-summary">
    <div v-if="levelLabel || school" class="spell-summary-kind">
      <strong v-if="levelLabel">{{ levelLabel }}</strong>
      <span v-if="school">{{ school }}</span>
    </div>

    <div class="spell-summary-casting">
      <div v-if="hasComponents" class="spell-summary-card spell-summary-components-card">
        <span><Shapes :size="14" aria-hidden="true" /> Компоненты</span>
        <strong class="spell-summary-components" :aria-label="componentAriaLabel">
          <span
            v-for="component in componentBadges"
            :key="component.short"
            :title="component.title"
            aria-hidden="true"
          >{{ component.short }}</span>
        </strong>
      </div>
      <div class="spell-summary-grid">
        <div v-if="data.time" class="spell-summary-card">
          <span><Clock3 :size="14" aria-hidden="true" /> Время</span>
          <strong>{{ data.time }}</strong>
        </div>
        <div v-if="data.range" class="spell-summary-card">
          <span><LocateFixed :size="14" aria-hidden="true" /> Дистанция</span>
          <strong>{{ data.range }}</strong>
        </div>
        <div v-if="data.duration" class="spell-summary-card">
          <span><Hourglass :size="14" aria-hidden="true" /> Длительность</span>
          <strong>{{ data.duration }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Clock3, Hourglass, LocateFixed, Shapes } from '@lucide/vue'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const { suggestItems } = useSchemaSuggests(() => props.type)
const data = computed(() => props.item.data || {})
const schoolMap = computed(() => Object.fromEntries(suggestItems('schoolId').map(item => [item.id, item.value])))
const school = computed(() => schoolMap.value[data.value.schoolId] || '')
const levelLabel = computed(() => {
  const level = data.value.lvl
  if (level === 0) return 'Заговор'
  if (level == null) return ''
  return `${level} уровень`
})

const componentBadges = computed(() => {
  const components = data.value.components || {}
  return [
    components.v && { short: 'В', title: 'Вербальный компонент' },
    components.s && { short: 'С', title: 'Соматический компонент' },
    components.m && { short: 'М', title: 'Материальный компонент' },
  ].filter(Boolean)
})
const hasComponents = computed(() => componentBadges.value.length > 0)
const componentAriaLabel = computed(() => componentBadges.value.map(component => component.title).join(', '))
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

.spell-summary-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 76%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 50%, transparent);
  backdrop-filter: blur(7px);
  box-sizing: border-box;
}

.spell-summary-card > span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: color-mix(in srgb, var(--accent-soft) 76%, var(--text-on-accent));
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.spell-summary-card strong {
  overflow: hidden;
  color: var(--text-on-accent);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  text-overflow: ellipsis;
}

.spell-summary-components {
  display: flex;
  align-items: center;
  gap: 5px;
}

.spell-summary-components-card {
  align-self: flex-end;
  width: min(180px, 100%);
  gap: 4px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.spell-summary-components span {
  min-width: 21px;
  height: 21px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  font-size: 11px;
  line-height: 1;
}

@media (max-width: 520px) {
  .spell-summary { gap: 9px; }
  .spell-summary-kind { min-width: 96px; padding: 7px 9px; }
  .spell-summary-kind strong { font-size: 12px; }
  .spell-summary-kind span { font-size: 9px; }
  .spell-summary-casting { gap: 5px; }
  .spell-summary-grid { gap: 7px; }
  .spell-summary-card { gap: 4px; padding: 9px 8px; }
  .spell-summary-components-card { width: min(150px, 100%); padding-top: 7px; padding-bottom: 7px; }
  .spell-summary-card > span { gap: 3px; font-size: 8px; letter-spacing: .04em; }
  .spell-summary-card > span svg { width: 12px; height: 12px; }
  .spell-summary-card strong { font-size: 13px; }
  .spell-summary-components { gap: 3px; }
  .spell-summary-components span { min-width: 18px; height: 18px; font-size: 10px; }
}
</style>
