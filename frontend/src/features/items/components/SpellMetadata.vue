<template>
  <div class="spell-metadata" :class="{ 'spell-metadata--stacked': stacked }">
    <span v-if="components.length" class="spell-meta-part spell-components">
      <span v-for="part in components" :key="part.key" tabindex="0" :aria-label="part.label" @mouseenter="show($event, part.label)" @mouseleave="tooltip = null" @focus="show($event, part.label)" @blur="tooltip = null"><component :is="part.icon" :size="16" aria-hidden="true" /></span>
    </span>
    <span v-if="data.time?.kind" class="spell-meta-part"><ActionTiming :time="data.time" /></span>
    <span v-if="rangeText" class="spell-meta-part" :title="rangeHint"><component :is="rangeIcon" :size="16" aria-hidden="true" />{{ rangeText }}<UserRound v-if="data.range?.can_self && data.range.kind !== 'self'" :size="14" aria-label="Можно на себя" /></span>
    <span v-if="data.duration" class="spell-meta-part" :title="data.duration"><Hourglass :size="15" aria-hidden="true" />{{ spellDurationLabel(data.duration) }}</span>
  </div>
  <FloatingTooltip v-if="tooltip" :anchor="tooltip.anchor" :width="260" :z-index="9500">{{ tooltip.text }}</FloatingTooltip>
</template>
<script setup>
import { computed, shallowRef } from 'vue'
import { AudioLines, Hand, Gem, Crosshair, UserRound, Eye, Infinity, Circle, Cone, MoveRight, Box, Cylinder, Shapes, Hourglass } from '@lucide/vue'
import { FloatingTooltip } from '@sylvieshare/share-ui'
import ActionTiming from '@/shared/ui/ActionTiming.vue'
import { rangeLabel, spellDurationLabel } from '@/shared/lib/spellPresentation'
const props = defineProps({ data: { type: Object, required: true }, stacked: Boolean, rangeOverride: String })
const components = computed(() => [
  { key: 'v', icon: AudioLines, label: 'Вербальный компонент: магические слова' },
  { key: 's', icon: Hand, label: 'Соматический компонент: жесты свободной рукой' },
  { key: 'm', icon: Gem, label: `Материальный компонент${typeof props.data.components?.m === 'string' ? ': ' + props.data.components.m : ''}` },
].filter(part => props.data.components?.[part.key]))
const rangeText = computed(() => props.rangeOverride || rangeLabel(props.data.range))
const rangeHint = computed(() => [rangeText.value, props.data.range?.can_self && 'Можно выбрать себя, если это допускают условия заклинания'].filter(Boolean).join(' · '))
const rangeIcon = computed(() => props.rangeOverride ? Crosshair : ({ sphere: Circle, radius: Circle, cone: Cone, line: MoveRight, cube: Box, cylinder: Cylinder, hemisphere: Circle }[props.data.range?.shape] || { self: UserRound, touch: Hand, ranged: Crosshair, sight: Eye, unlimited: Infinity }[props.data.range?.kind] || Shapes))
const tooltip = shallowRef(null)
const show = (event, text) => { tooltip.value = { anchor: event.currentTarget, text } }
</script>
<style scoped>
.spell-metadata { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 0; color: var(--text-2); font-size: 12px; line-height: 1.35; }
.spell-meta-part { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.spell-meta-part > svg { flex-shrink: 0; }
.spell-meta-part + .spell-meta-part { margin-left: 9px; padding-left: 9px; border-left: 1px solid var(--border-strong); }
.spell-components > span { display: inline-flex; }
.spell-metadata--stacked { flex-direction: column; align-items: flex-start; gap: 5px; }
.spell-metadata--stacked .spell-meta-part + .spell-meta-part { margin-left: 0; padding-left: 0; border: 0; }
</style>
