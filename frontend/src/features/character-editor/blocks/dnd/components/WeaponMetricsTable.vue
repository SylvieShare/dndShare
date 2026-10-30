<template>
  <div class="weapon-metrics" role="group" aria-label="Показатели оружия">
    <div class="weapon-metrics__cell weapon-metrics__attack">
      <span class="weapon-metrics__label">Атака</span>
      <strong class="weapon-metrics__bonus">{{ attack || '—' }}</strong>
    </div>
    <div class="weapon-metrics__cell weapon-metrics__damage">
      <span class="weapon-metrics__label">Урон</span>
      <AttackDamage v-if="damageParts.length || modifier !== 0" :damage-parts="damageParts" :modifier="modifier" :two-handed-parts="twoHandedParts" wrap-damage />
      <span v-else>—</span>
    </div>
    <div class="weapon-metrics__cell weapon-metrics__properties">
      <span class="weapon-metrics__label">Свойства</span>
      <div class="weapon-metrics__property-list">
        <component :is="interactive ? 'button' : 'span'" v-for="(property, index) in properties" :key="property.id ?? index"
          :type="interactive ? 'button' : undefined" class="weapon-metrics__property"
          :class="{ 'weapon-metrics__property--described': interactive }"
          :aria-expanded="interactive ? opened === property : undefined"
          @click.stop="interactive && showDescription($event, property)" @pointerdown.stop
          @mouseenter="interactive && property.desc && !opened && $emit('property-enter', $event, property)"
          @focus="interactive && property.desc && !opened && $emit('property-enter', $event, property)"
          @mouseleave="$emit('property-leave')" @blur="$emit('property-leave')"
        >{{ property.label }}</component>
        <span v-if="!properties.length">—</span>
      </div>
    </div>
    <BasePopover :open="!!opened" :anchor="anchor" :z-index="4100" transition-preset="action-menu"
      role="dialog" :aria-label="opened?.label" @update:open="!$event && (opened = null)">
      <div class="weapon-property-description" v-if="opened">
        <strong>{{ opened.label }}</strong>
        <RichContent :html="opened.desc || 'Описание свойства пока недоступно.'" />
        <ActionButton variant="secondary" @click="opened = null">Понятно</ActionButton>
      </div>
    </BasePopover>
  </div>
</template>
<script setup>
import AttackDamage from './AttackDamage.vue'
import { shallowRef } from 'vue'
import { BasePopover, RichContent, ActionButton } from '@sylvieshare/share-ui'
defineProps({
  attack: { type: String, default: '' },
  damageParts: { type: Array, default: () => [] },
  modifier: { type: Number, default: 0 },
  twoHandedParts: { type: Array, default: () => [] },
  properties: { type: Array, default: () => [] },
  interactive: { type: Boolean, default: false },
})
const emit = defineEmits(['property-enter', 'property-leave'])
const opened = shallowRef(null), anchor = shallowRef(null)
function showDescription(event, property) {
  emit('property-leave')
  anchor.value = event.currentTarget
  opened.value = opened.value === property ? null : property
}
</script>
<style scoped>
.weapon-metrics {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--layout-weapon-metrics-gap);
  border: 0;
  min-width: 0;
  background: transparent;
  --wm-damage-basis: calc(var(--layout-weapon-metrics-wide-min) - var(--layout-weapon-metrics-attack-width) - var(--layout-weapon-metrics-properties-min) - var(--layout-weapon-metrics-gap) * 2);
}
.weapon-metrics__cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  min-width: 0;
  box-sizing: border-box;
  background: var(--surface-raised);
  border-radius: var(--radius-row);
  color: var(--text-2);
}
.weapon-metrics__label { color: var(--text-muted); font-size: 10px; line-height: 12px; }
.weapon-metrics__attack { flex: 0 0 var(--layout-weapon-metrics-attack-width); }
.weapon-metrics__bonus { color: var(--accent-soft); font-size: var(--type-weapon-attack-size); line-height: var(--type-weapon-attack-line-height); margin-block: 0; }
.weapon-metrics__damage { flex: 1.25 1 var(--wm-damage-basis); }
.weapon-metrics__properties { flex: 1 1 var(--layout-weapon-metrics-properties-min); }
.weapon-metrics__property-list { display: flex; flex-wrap: wrap; gap: 2px 8px; font-size: var(--type-weapon-property-size); line-height: var(--type-weapon-property-line-height); overflow-wrap: anywhere; }
.weapon-metrics__property { appearance: none; font: inherit; color: inherit; text-align: left; background: none; border: 0; padding: 3px 0; }
.weapon-metrics__property--described { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.weapon-metrics__property--described:focus-visible { outline: 1px solid var(--accent); border-radius: 2px; }
.weapon-property-description { width: min(296px, calc(100vw - 32px)); padding: 10px; display: grid; gap: 10px; font-size: 14px; line-height: 1.5; }
</style>
