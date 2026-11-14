<template>
  <div class="spell-metadata" :class="{ 'spell-metadata--quiet': quiet }">
    <div v-if="flags.length || (showComponents && components.length) || rangeText || data.duration" class="spell-meta-table">
      <span v-if="showComponents && components.length" class="spell-meta-part spell-components">
        <span v-for="part in components" :key="part.key" tabindex="0" :aria-label="part.label" @mouseenter="show($event, part.label)" @mouseleave="tooltip = null" @focus="show($event, part.label)" @blur="tooltip = null"><component :is="part.icon" :size="16" aria-hidden="true" /></span>
      </span>
      <span v-if="rangeText" class="spell-meta-part" :title="rangeHint"><component :is="rangeIcon" :size="16" aria-hidden="true" />{{ rangeText }}<UserRound v-if="data.range?.can_self && data.range.kind !== 'self'" :size="14" aria-label="Можно на себя" /></span>
      <span v-if="data.duration" class="spell-duration-meta">
        <span class="spell-meta-part" :title="data.duration"><Hourglass :size="15" aria-hidden="true" />{{ spellDurationLabel(data.duration) }}</span>
      </span>
      <span v-if="flags.length" class="spell-meta-flags">
        <span v-for="flag in flags" :key="flag.key" class="spell-meta-part spell-meta-flag" :class="`spell-meta-${flag.key}`" :aria-label="flag.label">{{ flag.label }}</span>
      </span>
    </div>
    <ActionTiming v-if="data.time?.kind" :time="data.time" />
  </div>
  <FloatingTooltip v-if="tooltip" :anchor="tooltip.anchor" :width="260" :z-index="9500">{{ tooltip.text }}</FloatingTooltip>
</template>
<script setup>
import { computed, shallowRef } from 'vue'
import { AudioLines, Hand, Fingerprint, Gem, Crosshair, UserRound, Eye, Infinity, Circle, Cone, MoveRight, Box, Cylinder, Shapes, Hourglass } from '@lucide/vue'
import { FloatingTooltip } from '@sylvieshare/share-ui'
import ActionTiming from '@/shared/ui/ActionTiming.vue'
import { rangeLabel, spellDurationLabel, spellComponentDetails } from '@/shared/lib/spellPresentation'
const props = defineProps({ data: { type: Object, required: true }, rangeOverride: String, showComponents: { type: Boolean, default: true }, quiet: Boolean })
const flags = computed(() => [
  { key: 'concentration', label: 'Концентрация' },
  { key: 'ritual', label: 'Ритуал' },
].filter(flag => props.data[flag.key]))
const componentIcons = { v: AudioLines, s: Hand, m: Gem }
const components = computed(() => spellComponentDetails(props.data.components).map(part => ({ ...part, icon: componentIcons[part.key] })))
const rangeText = computed(() => props.rangeOverride || rangeLabel(props.data.range))
const rangeHint = computed(() => [rangeText.value, props.data.range?.can_self && 'Можно выбрать себя, если это допускают условия заклинания'].filter(Boolean).join(' · '))
const rangeIcon = computed(() => props.rangeOverride ? Crosshair : ({ sphere: Circle, radius: Circle, cone: Cone, line: MoveRight, cube: Box, cylinder: Cylinder, hemisphere: Circle }[props.data.range?.shape] || { self: UserRound, touch: Fingerprint, ranged: Crosshair, sight: Eye, unlimited: Infinity }[props.data.range?.kind] || Shapes))
const tooltip = shallowRef(null)
const show = (event, text) => { tooltip.value = { anchor: event.currentTarget, text } }
</script>
<style scoped>
.spell-metadata { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; color: var(--text-2); font-size: 12px; line-height: 1.5; }
.spell-meta-table { display: flex; flex-wrap:wrap; max-width: 100%; border: 1px solid var(--border); border-radius: 6px; background: color-mix(in srgb, var(--text-2) 3%, transparent); }
.spell-meta-part { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 5px 8px; overflow-wrap: anywhere; }
.spell-meta-part > svg, .spell-components { flex-shrink: 0; }
.spell-meta-part + .spell-meta-part { border-left: 1px solid var(--border); }
.spell-components > span { display: inline-flex; }
.spell-meta-flags {display:flex;flex-direction:column;align-items:flex-start;flex-basis:100%;gap:var(--spacing-xs);min-width:0}
.spell-meta-flags .spell-meta-flag {border:0;border-radius:var(--radius-xs);font-weight:700;background:color-mix(in srgb,var(--bg) 65%,transparent)}
.spell-meta-concentration { color: color-mix(in srgb,var(--accent-soft) 85%,var(--text-1)); }
.spell-meta-ritual { color: color-mix(in srgb,var(--success) 80%,var(--text-1)); }
.spell-duration-meta {display:contents}
.spell-metadata:not(.spell-metadata--quiet) .spell-meta-part + .spell-duration-meta>.spell-meta-part:first-child {border-left:1px solid var(--border)}
.spell-metadata--quiet {gap:var(--spacing-small)}
.spell-metadata--quiet .spell-meta-table {border:0;background:transparent;flex-wrap:wrap;gap:var(--spacing-xs)}
.spell-metadata--quiet .spell-meta-part {padding:var(--spacing-xs) var(--spacing-compact);border:0;border-radius:var(--radius-xs);background:color-mix(in srgb,var(--bg) 65%,transparent)}
.spell-metadata--quiet .spell-duration-meta {display:flex;flex-wrap:wrap;align-items:center;gap:var(--spacing-xs);min-width:0;max-width:100%}
</style>
