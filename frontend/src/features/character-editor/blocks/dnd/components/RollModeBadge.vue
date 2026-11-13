<template>
  <span v-if="mode !== 'normal' || cancelled" class="roll-badge" :class="[`roll-badge--${cancelled ? 'cancelled' : mode}`, { 'roll-badge--large': variant === 'large', 'roll-badge--embedded': embedded }]" :title="title" role="img" :aria-label="title" :style="{ '--roll-mode-color': color, '--roll-mode-die-size': `${dieSize}px` }">
    <template v-if="cancelled">ОБЫЧ.</template>
    <template v-else>
      <span class="roll-badge__dice" aria-hidden="true">
        <span v-for="value in [1, 20]" :key="value" class="roll-badge__die" :class="{ 'roll-badge__die--discarded': value === (mode === 'advantage' ? 1 : 20) }" :data-roll-value="value">
          <span class="roll-badge__face"><SystemDie :sides="20" :value="value" :size="dieSize" :color="color" :animated="false" :style="{ width: 'var(--roll-mode-fit-die-size,var(--roll-mode-die-size))', height: 'var(--roll-mode-fit-die-size,var(--roll-mode-die-size))' }" /></span>
          <span v-if="value === (mode === 'advantage' ? 1 : 20)" class="roll-badge__strike" />
        </span>
      </span>
      <small v-if="showCaption" class="roll-badge__caption" aria-hidden="true">{{ mode === 'advantage' ? 'Преимущество' : 'Помеха' }}</small>
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { layoutTokens } from '@/app/design-tokens'
import SystemDie from '@/shared/ui/SystemDie.vue'

const props = defineProps({
  mode: { type: String, default: 'normal' },
  source: { type: String, default: '' },
  cancelled: { type: Boolean, default: false },
  variant: { type: String, default: 'compact', validator: value => ['compact', 'large'].includes(value) },
  showCaption: { type: Boolean, default: true },
  embedded: { type: Boolean, default: false },
})
const title = computed(() => [props.cancelled ? 'Обычный бросок' : props.mode === 'advantage' ? 'Преимущество' : 'Помеха', props.source].filter(Boolean).join(' · '))
const color = computed(() => props.cancelled ? 'var(--text-muted)' : props.mode === 'advantage' ? 'var(--success)' : 'var(--danger)')
const dieSize = computed(() => layoutTokens[props.variant === 'large' ? 'roll-mode-menu-die' : 'roll-mode-badge-die'])
</script>

<style scoped>
.roll-badge {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  align-self: center;
  flex-shrink: 0;
  vertical-align: middle;
  color: var(--roll-mode-color);
  font-family: var(--type-badge-compact-family);
  font-size: var(--type-badge-compact-size);
  font-weight: var(--type-badge-compact-weight);
  letter-spacing: var(--type-badge-compact-tracking);
  line-height: var(--type-badge-compact-line-height);
}
.roll-badge--advantage,.roll-badge--disadvantage {padding:2px var(--spacing-xs);border-radius:var(--radius-input);background:color-mix(in srgb,var(--roll-mode-color) 9%,transparent)}
.roll-badge__dice {display:inline-flex;align-items:center}
.roll-badge__caption {padding-inline:var(--spacing-xs);font-family:var(--type-roll-mode-caption-family);font-size:var(--type-roll-mode-caption-size);line-height:var(--type-roll-mode-caption-line-height);font-weight:var(--type-roll-mode-caption-weight);letter-spacing:var(--type-roll-mode-caption-tracking);white-space:nowrap}
.roll-badge--large .roll-badge__caption {font-size:var(--roll-mode-caption-size,var(--type-context-size));line-height:var(--roll-mode-caption-line-height,var(--type-context-line-height))}
.roll-badge__die {position:relative;display:inline-flex;flex:none;width:var(--roll-mode-fit-die-size,var(--roll-mode-die-size));height:var(--roll-mode-fit-die-size,var(--roll-mode-die-size))}
.roll-badge__die + .roll-badge__die {margin-inline-start:calc(var(--spacing-xs) / -2)}
.roll-badge__face {display:inline-flex}
.roll-badge__die--discarded .roll-badge__face {opacity:.6}
.roll-badge__strike {position:absolute;left:8%;right:8%;top:50%;height:1.5px;border-radius:var(--radius-xs);background:currentColor;box-shadow:0 0 0 .5px var(--surface);transform:rotate(-45deg);pointer-events:none}
.roll-badge--cancelled {padding:1px 5px;border-radius:var(--radius-badge);background:var(--surface-raised)}
.roll-badge--embedded:not(.roll-badge--cancelled) {padding:0;background:transparent}
</style>
