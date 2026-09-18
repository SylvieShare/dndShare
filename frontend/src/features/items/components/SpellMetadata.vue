<template>
  <div class="spell-metadata">
    <ActionTiming v-if="data.time?.kind" :time="data.time" />
    <div v-if="flags.length || components.length || rangeText || data.duration" class="spell-meta-table">
      <span v-for="flag in flags" :key="flag.key" class="spell-meta-part spell-meta-flag" :class="`spell-meta-${flag.key}`" tabindex="0" :aria-label="flag.label" @mouseenter="show($event, flag.label)" @mouseleave="tooltip = null" @focus="show($event, flag.label)" @blur="tooltip = null">{{ flag.letter }}</span>
      <span v-if="components.length" class="spell-meta-part spell-components">
        <span v-for="part in components" :key="part.key" tabindex="0" :aria-label="part.label" @mouseenter="show($event, part.label)" @mouseleave="tooltip = null" @focus="show($event, part.label)" @blur="tooltip = null"><component :is="part.icon" :size="16" aria-hidden="true" /></span>
      </span>
      <span v-if="rangeText" class="spell-meta-part" :title="rangeHint"><component :is="rangeIcon" :size="16" aria-hidden="true" />{{ rangeText }}<UserRound v-if="data.range?.can_self && data.range.kind !== 'self'" :size="14" aria-label="Можно на себя" /></span>
      <span v-if="data.duration" class="spell-meta-part" :title="data.duration"><Hourglass :size="15" aria-hidden="true" />{{ spellDurationLabel(data.duration) }}</span>
    </div>
  </div>
  <FloatingTooltip v-if="tooltip" :anchor="tooltip.anchor" :width="260" :z-index="9500">{{ tooltip.text }}</FloatingTooltip>
</template>
<script setup>
import { computed, shallowRef } from 'vue'
import { AudioLines, Hand, Fingerprint, Gem, Crosshair, UserRound, Eye, Infinity, Circle, Cone, MoveRight, Box, Cylinder, Shapes, Hourglass } from '@lucide/vue'
import { FloatingTooltip } from '@sylvieshare/share-ui'
import ActionTiming from '@/shared/ui/ActionTiming.vue'
import { rangeLabel, spellDurationLabel } from '@/shared/lib/spellPresentation'
const props = defineProps({ data: { type: Object, required: true }, rangeOverride: String })
const flags = computed(() => [
  { key: 'concentration', letter: 'К', label: 'Концентрация' },
  { key: 'ritual', letter: 'Р', label: 'Ритуал' },
].filter(flag => props.data[flag.key]))
const components = computed(() => [
  { key: 'v', icon: AudioLines, label: 'Вербальный компонент: магические слова' },
  { key: 's', icon: Hand, label: 'Соматический компонент: жесты свободной рукой' },
  { key: 'm', icon: Gem, label: `Материальный компонент${typeof props.data.components?.m === 'string' ? ': ' + props.data.components.m : ''}` },
].filter(part => props.data.components?.[part.key]))
const rangeText = computed(() => props.rangeOverride || rangeLabel(props.data.range))
const rangeHint = computed(() => [rangeText.value, props.data.range?.can_self && 'Можно выбрать себя, если это допускают условия заклинания'].filter(Boolean).join(' · '))
const rangeIcon = computed(() => props.rangeOverride ? Crosshair : ({ sphere: Circle, radius: Circle, cone: Cone, line: MoveRight, cube: Box, cylinder: Cylinder, hemisphere: Circle }[props.data.range?.shape] || { self: UserRound, touch: Fingerprint, ranged: Crosshair, sight: Eye, unlimited: Infinity }[props.data.range?.kind] || Shapes))
const tooltip = shallowRef(null)
const show = (event, text) => { tooltip.value = { anchor: event.currentTarget, text } }
</script>
<style scoped>
.spell-metadata { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; color: var(--text-2); font-size: 12px; line-height: 1.5; }
.spell-meta-table { display: flex; max-width: 100%; border: 1px solid var(--border); border-radius: 6px; background: color-mix(in srgb, var(--text-2) 3%, transparent); }
.spell-meta-part { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 5px 8px; overflow-wrap: anywhere; }
.spell-meta-part > svg, .spell-components { flex-shrink: 0; }
.spell-meta-part + .spell-meta-part { border-left: 1px solid var(--border); }
.spell-components > span { display: inline-flex; }
.spell-meta-flag { flex-shrink: 0; justify-content: center; font-weight: 800; background: color-mix(in srgb, currentColor 15%, transparent); }
.spell-meta-flag:first-child { border-radius: 5px 0 0 5px; }
.spell-meta-concentration { color: var(--accent-soft); }
.spell-meta-ritual { color: var(--success); }
</style>
