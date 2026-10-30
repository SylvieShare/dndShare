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
        <span v-for="(property, index) in properties" :key="property.id ?? index"
          :class="{ 'weapon-metrics__property--described': interactive && property.desc }"
          :tabindex="interactive && property.desc ? 0 : undefined"
          @mouseenter="interactive && $emit('property-enter', $event, property)"
          @focus="interactive && $emit('property-enter', $event, property)"
          @mouseleave="$emit('property-leave')" @blur="$emit('property-leave')"
        >{{ index ? ' · ' : '' }}{{ property.label }}</span>
        <span v-if="!properties.length">—</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import AttackDamage from './AttackDamage.vue'
defineProps({
  attack: { type: String, default: '' },
  damageParts: { type: Array, default: () => [] },
  modifier: { type: Number, default: 0 },
  twoHandedParts: { type: Array, default: () => [] },
  properties: { type: Array, default: () => [] },
  interactive: { type: Boolean, default: false },
})
defineEmits(['property-enter', 'property-leave'])
</script>
<style scoped>
.weapon-metrics {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--layout-weapon-metrics-stroke);
  border: var(--layout-weapon-metrics-stroke) solid var(--bg);
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-row);
  background: var(--bg);
  --wm-damage-basis: calc(var(--layout-weapon-metrics-wide-min) - var(--layout-weapon-metrics-attack-width) - var(--layout-weapon-metrics-properties-min) - var(--layout-weapon-metrics-stroke) * 4);
}
.weapon-metrics__cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  min-width: 0;
  box-sizing: border-box;
  background: var(--surface);
  color: var(--text-2);
}
.weapon-metrics__label { color: var(--text-muted); font-size: 10px; line-height: 12px; }
.weapon-metrics__attack { flex: 0 0 var(--layout-weapon-metrics-attack-width); }
.weapon-metrics__bonus { color: var(--accent-soft); font-size: 18px; line-height: 23px; margin-block: 0; }
.weapon-metrics__damage { flex: 1.25 1 var(--wm-damage-basis); }
.weapon-metrics__properties { flex: 1 1 var(--layout-weapon-metrics-properties-min); }
.weapon-metrics__property-list { font-size: 11px; line-height: 15px; overflow-wrap: anywhere; }
.weapon-metrics__property--described { cursor: help; text-decoration: underline dotted; text-underline-offset: 3px; }
.weapon-metrics__property--described:focus-visible { outline: 1px solid var(--accent); border-radius: 2px; }
</style>
