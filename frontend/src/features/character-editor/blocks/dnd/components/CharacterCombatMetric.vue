<template>
  <component :is="interactive ? 'button' : 'div'" :type="interactive ? 'button' : undefined"
    class="combat-metric" :class="{ 'combat-metric--compact': compact }" data-sheet-swipe
    :aria-label="interactive ? actionLabel : undefined" :aria-haspopup="interactive ? 'dialog' : undefined"
    :aria-expanded="interactive ? expanded : undefined" @click.stop="interactive && emit('roll', $event)">
    <span class="combat-metric__identity" :data-metric-kind="kind">
      <component :is="icon" class="combat-metric__icon" :size="iconSize" :stroke-width="1.7" aria-hidden="true" />
      <span class="combat-metric__label">{{ label }}</span>
    </span>
    <div class="combat-metric__formula"><slot /></div>
    <div v-if="$slots.footnote" class="combat-metric__footnote"><slot name="footnote" /></div>
  </component>
</template>
<script setup>
import { computed } from 'vue'
import { Crosshair, HeartPlus, Shield, ShieldPlus, Sparkles, Swords } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
const props = defineProps({ kind: { type: String, default: 'damage' }, label: String, actionLabel: String,
  interactive: Boolean, expanded: Boolean, compact: Boolean })
const emit = defineEmits(['roll'])
const icon = computed(() => ({ attack: Crosshair, damage: Swords, healing: HeartPlus, temporary_hp: ShieldPlus, save: Shield }[props.kind] || Sparkles))
const iconSize = computed(() => layoutTokens[props.compact ? 'spell-metric-icon' : 'weapon-metrics-icon'])
</script>
<style scoped>
.combat-metric {appearance:none;display:grid;grid-template-columns:calc(var(--layout-weapon-metrics-icon) + var(--spacing-small) * 2) minmax(0,1fr);align-items:center;gap:var(--spacing-small);min-width:0;max-width:100%;min-height:var(--layout-weapon-metrics-attack-width);box-sizing:border-box;padding:var(--spacing-small);border:0;border-radius:var(--radius-row);background:var(--surface-raised);font:inherit;text-align:left;color:var(--text-2)}
button.combat-metric {cursor:pointer}
button.combat-metric[aria-expanded="true"] {background:color-mix(in srgb,var(--accent) 12%,var(--surface-raised))}
button.combat-metric:focus-visible {outline:2px solid var(--accent-soft);outline-offset:2px}
.combat-metric__identity {display:flex;flex-direction:column;align-items:center;justify-content:center;align-self:stretch;gap:var(--spacing-xs);min-width:0;padding-inline-end:var(--spacing-small);border-inline-end:var(--layout-border) solid var(--border-strong);color:var(--text-muted)}
.combat-metric__icon {flex:none;opacity:.5}
.combat-metric__label {font-size:var(--type-context-size);line-height:var(--type-context-line-height);text-align:center;overflow-wrap:anywhere}
.combat-metric__formula {display:flex;flex-direction:column;gap:var(--spacing-xs);min-width:0;max-width:100%}
.combat-metric--compact {grid-template-columns:calc(var(--layout-spell-metric-icon) + var(--spacing-small) * 4) minmax(0,1fr);min-height:var(--layout-spell-metric-height)}
.combat-metric--compact .combat-metric__label {overflow-wrap:normal}
.combat-metric {container-type:inline-size}
.combat-metric__footnote {grid-column:1/-1;min-width:0}
@container (max-width:160px) {
  .combat-metric--compact>.combat-metric__identity {grid-column:1/-1;flex-direction:row;justify-content:flex-start;align-self:auto;padding-inline-end:0;padding-block-end:var(--spacing-xs);border-inline-end:0;border-block-end:var(--layout-border) solid var(--border-strong)}
  .combat-metric--compact>.combat-metric__formula {grid-column:1/-1}
}
</style>
