<template>
  <div class="weapon-metrics" role="group" aria-label="Показатели оружия">
    <component :is="interactive && canAttack ? 'button' : 'div'" :type="interactive && canAttack ? 'button' : undefined" class="weapon-metrics__cell weapon-metrics__attack" data-sheet-swipe :aria-label="interactive && canAttack ? 'Настроить бросок атаки' : undefined" :aria-haspopup="interactive && canAttack ? 'menu' : undefined" :aria-expanded="interactive && canAttack ? rollScope === 'attack' : undefined" @click.stop="interactive && canAttack && emit('roll', 'attack', $event)">
      <span class="weapon-metrics__identity" data-metric-kind="attack">
        <Crosshair class="weapon-metrics__icon" :size="layoutTokens['weapon-metrics-icon']" :stroke-width="1.7" aria-hidden="true" />
        <span class="weapon-metrics__label">Атака</span>
      </span>
      <div class="weapon-metrics__formula-content">
        <WeaponDamageBreakdown v-if="attackRows.length" :rows="attackRows" label="Состав атаки" :aria-description="`Бонус атаки ${attack || '0'}`" damage-color="var(--accent-soft)" :roll-color="attackColor" dice-labels />
        <span v-else>—</span>
      </div>
    </component>
    <component :is="interactive && canDamage ? 'button' : 'div'" :type="interactive && canDamage ? 'button' : undefined" class="weapon-metrics__cell weapon-metrics__damage" data-sheet-swipe :aria-label="interactive && canDamage ? 'Настроить бросок урона' : undefined" :aria-haspopup="interactive && canDamage ? 'menu' : undefined" :aria-expanded="interactive && canDamage ? rollScope === 'damage' && !damageKey : undefined" @click.stop="interactive && canDamage && emit('roll', 'damage', $event)">
      <span class="weapon-metrics__identity" data-metric-kind="damage">
        <Swords class="weapon-metrics__icon" :size="layoutTokens['weapon-metrics-icon']" :stroke-width="1.7" aria-hidden="true" />
        <span class="weapon-metrics__label">Урон</span>
      </span>
      <div class="weapon-metrics__formula-content">
        <WeaponDamageBreakdown v-if="damageRows.length || twoHandedRows.length" :rows="damageRows" :alternatives="twoHandedRows" :damage-type="damageType" :damage-color="damageColor" />
        <span v-else>—</span>
        <small v-if="twoHandedRows.length" class="weapon-metrics__grip">Одной рукой / двумя руками</small>
      </div>
    </component>
    <component :is="interactive && canDamage ? 'button' : 'div'" v-for="cell in alternativeDamage" :key="cell.key"
      :type="interactive && canDamage ? 'button' : undefined" class="weapon-metrics__cell weapon-metrics__damage weapon-metrics__alternative"
      :data-damage-key="cell.key" data-sheet-swipe :aria-label="interactive && canDamage ? `Настроить урон: ${cell.title}` : undefined"
      :aria-description="cell.error || undefined" :aria-haspopup="interactive && canDamage ? 'menu' : undefined"
      :aria-expanded="interactive && canDamage ? damageKey === cell.key : undefined"
      @click.stop="interactive && canDamage && emit('roll', 'damage', $event, cell.selection)">
      <span class="weapon-metrics__identity" data-metric-kind="special">
        <Sparkles class="weapon-metrics__icon" :size="layoutTokens['weapon-metrics-icon']" :stroke-width="1.7" aria-hidden="true" />
        <span class="weapon-metrics__label">Урон</span>
      </span>
      <div class="weapon-metrics__formula-content">
        <span class="weapon-metrics__label">{{ cell.title }}</span>
        <WeaponDamageBreakdown :rows="cell.rows" :label="`Состав урона: ${cell.title}`" />
      </div>
    </component>
    <div class="weapon-properties-stack">
      <div v-if="visibleProperties.length" class="weapon-metrics__cell weapon-metrics__properties">
        <span class="weapon-metrics__label">Свойства</span>
        <div class="weapon-metrics__property-list">
          <component :is="interactive ? 'button' : 'span'" v-for="(property, index) in visibleProperties" :key="property.id ?? index"
            :type="interactive ? 'button' : undefined" class="weapon-metrics__property"
            :class="{ 'weapon-metrics__property--described': interactive }"
            :aria-expanded="interactive ? openedKey === keyOf(property) : undefined"
            @click.stop="interactive && showDescription($event, property)" @pointerdown.stop
            @mouseenter="interactive && property.desc && !opened && $emit('property-enter', $event, property)"
            @focus="interactive && property.desc && !opened && $emit('property-enter', $event, property)"
            @mouseleave="$emit('property-leave')" @blur="$emit('property-leave')"
          >{{ property.label }}</component>
        </div>
      </div>
      <slot />
    </div>
    <BasePopover :open="!!opened" :anchor="anchor" :z-index="4100" transition-preset="action-menu"
      role="dialog" :aria-label="opened?.label" @update:open="!$event && (openedKey = null)">
      <div class="weapon-property-description" v-if="opened">
        <strong>{{ opened.label }}</strong>
        <RichContent :html="opened.desc || 'Описание свойства пока недоступно.'" />
        <ActionButton variant="secondary" @click="openedKey = null">Понятно</ActionButton>
      </div>
    </BasePopover>
  </div>
</template>
<script setup>
import WeaponDamageBreakdown from './WeaponDamageBreakdown.vue'
import { computed, shallowRef } from 'vue'
import { BasePopover, RichContent, ActionButton } from '@sylvieshare/share-ui'
import { Crosshair, Sparkles, Swords } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
const props = defineProps({
  attack: { type: String, default: '' },
  attackRows: { type: Array, default: () => [] },
  attackColor: { type: String, default: 'var(--accent-soft)' },
  damageRows: { type: Array, default: () => [] },
  twoHandedRows: { type: Array, default: () => [] },
  alternativeDamage: { type: Array, default: () => [] },
  damageKey: String,
  damageType: String,
  damageColor: String,
  properties: { type: Array, default: () => [] },
  canAttack: { type: Boolean, default: true },
  canDamage: { type: Boolean, default: true },
  rollScope: String,
  interactive: { type: Boolean, default: false },
})
const emit = defineEmits(['property-enter', 'property-leave', 'roll'])
const openedKey = shallowRef(null), anchor = shallowRef(null)
const keyOf = property => property.id ?? property.label
const visibleProperties = computed(() => props.properties.filter(property => String(property.label || '').trim()))
const opened = computed(() => visibleProperties.value.find(property => keyOf(property) === openedKey.value) || null)
function showDescription(event, property) {
  emit('property-leave')
  anchor.value = event.currentTarget
  openedKey.value = openedKey.value === keyOf(property) ? null : keyOf(property)
}
</script>
<style scoped>
.weapon-metrics {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: var(--layout-weapon-metrics-gap);
  border: 0;
  min-width: 0;
  background: transparent;
}
.weapon-metrics__cell {
  border: 0;
  font: inherit;
  text-align: left;
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
button.weapon-metrics__cell { cursor: pointer; }
button.weapon-metrics__cell[aria-expanded="true"] { background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised)); }
button.weapon-metrics__cell:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
.weapon-metrics__grip { color: var(--text-muted); font-size: 10px; line-height: 14px; white-space: normal; }
.weapon-metrics__label { color: var(--text-muted); font-size: 10px; line-height: 12px; }
.weapon-metrics__attack {
  max-width: 100%;
  min-height: var(--layout-weapon-metrics-attack-width);
}
.weapon-metrics__damage { min-height: var(--layout-weapon-metrics-attack-width); max-width: 100%; }
.weapon-metrics__attack,.weapon-metrics__damage {display:grid;grid-template-columns:calc(var(--layout-weapon-metrics-icon) + var(--spacing-small) + var(--spacing-small)) minmax(0,1fr);align-items:center;gap:var(--spacing-small)}
.weapon-metrics__identity {display:flex;flex-direction:column;align-items:center;justify-content:center;align-self:stretch;gap:var(--spacing-xs);padding-inline-end:var(--spacing-small);min-width:0;color:var(--text-muted);border-inline-end:1px solid var(--border)}
.weapon-metrics__identity .weapon-metrics__label {font-size:var(--type-context-size);line-height:var(--type-context-line-height);text-align:center}
.weapon-metrics__icon {flex:none;opacity:.5}
.weapon-metrics__formula-content {display:flex;flex-direction:column;gap:var(--spacing-xs);min-width:0;max-width:100%}
.weapon-properties-stack { display: grid; gap: var(--layout-weapon-metrics-gap); min-width: 0; }
.weapon-properties-stack:empty { display: none; }
.weapon-metrics__property-list { display: flex; flex-wrap: wrap; gap: 2px 8px; font-size: var(--type-weapon-property-size); line-height: var(--type-weapon-property-line-height); overflow-wrap: break-word; }
.weapon-metrics__property { appearance: none; font: inherit; color: inherit; text-align: left; min-width: 0; max-width: 100%; background: none; border: 0; padding: 3px 0; }
.weapon-metrics__property--described { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.weapon-metrics__property--described:focus-visible { outline: 1px solid var(--accent); border-radius: 2px; }
.weapon-property-description { width: min(296px, calc(100vw - 32px)); padding: 10px; display: grid; gap: 10px; font-size: 14px; line-height: 1.5; }
</style>
