<template>
  <div class="character-summary-tile" :class="{ 'character-summary-tile--compact': compact }">
    <slot name="before" />
    <div class="summary-main">
      <component :is="actionLabel ? 'button' : 'span'" class="portrait" :type="actionLabel ? 'button' : undefined"
        :aria-label="actionLabel || name" :aria-haspopup="actionLabel ? 'menu' : undefined" :aria-expanded="actionLabel ? expanded : undefined"
        :aria-description="description">
        <img v-if="iconUrl && !failed" :src="iconUrl" alt="" @error="failed = true" />
        <span v-else>{{ Array.from(name || '?')[0] }}</span>
      </component>
      <div class="summary-content" :inert="compact" :aria-hidden="compact || undefined">
        <div class="identity"><strong>{{ name || 'Персонаж' }}</strong><slot name="name-suffix" /></div>
        <div class="heading-combat">
          <component v-if="armor != null" :is="armorControl || editArmor ? 'button' : 'span'" class="heading-armor" :type="armorControl || editArmor ? 'button' : undefined" :disabled="armorControl && !editArmor"
            :aria-label="`Класс доспеха ${armor}`" :aria-haspopup="editArmor ? 'dialog' : undefined" @click="metric($event, 'armor', editArmor)">
            <Shield class="heading-armor-icon" :stroke-width="1.35" aria-hidden="true" /><span class="heading-armor-value">{{ armor }}</span>
          </component>
          <slot name="health">
            <SheetHealth v-if="healthVisible" :enlarged="enlargedHealth" :interactive="editHealth" :current="current" :maximum="maximum" :temporary="temporary"
              :aria-haspopup="editHealth ? 'dialog' : undefined" @click="metric($event, 'health', editHealth)" />
          </slot>
          <span v-if="showPassives" class="heading-metrics" aria-label="Пассивные показатели">
            <span class="heading-metric" :aria-label="`Пассивная внимательность: ${perception}`"><Eye :size="14" aria-hidden="true" />{{ perception }}</span>
            <span class="heading-metric" :aria-label="`Пассивное расследование: ${investigation}`"><Search :size="14" aria-hidden="true" />{{ investigation }}</span>
          </span>
          <slot name="metrics" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { Eye, Search, Shield } from '@lucide/vue'
import SheetHealth from './SheetHealth.vue'
const props = defineProps({
  name: String, iconUrl: String, actionLabel: String, expanded: Boolean, compact: Boolean,
  armor: Number, current: Number, maximum: Number, temporary: Number,
  healthVisible: { type: Boolean, default: true }, armorControl: Boolean, editArmor: Boolean, editHealth: Boolean, enlargedHealth: Boolean,
  showPassives: Boolean, perception: Number, investigation: Number,
})
const emit = defineEmits(['armor', 'health'])
const failed = ref(false)
watch(() => props.iconUrl, () => { failed.value = false })
const description = computed(() => [props.name,
  props.healthVisible ? `здоровье ${props.current} из ${props.maximum}${props.temporary ? ', временные HP ' + props.temporary : ''}` : '',
  props.armor != null ? `класс доспеха ${props.armor}` : '',
].filter(Boolean).join(', '))
function metric(event, key, enabled) { if (enabled) { event.stopPropagation(); emit(key) } }
</script>
<style scoped>
.character-summary-tile {display:flex;align-items:center;min-width:0;gap:var(--spacing-small);width:100%;border-radius:var(--radius-tile);color:var(--text-1);font:inherit;text-align:left}
.summary-main {display:grid;grid-template-columns:var(--layout-sheet-header-icon) minmax(0,1fr);gap:var(--spacing-small);align-items:center;flex:1;min-width:0}
.portrait {display:grid;place-items:center;width:var(--layout-sheet-header-icon);height:var(--layout-sheet-header-icon);padding:0;border:0;background:transparent;overflow:hidden;border-radius:var(--radius-input);color:var(--accent-soft);font:inherit;font-size:var(--type-sheet-header-size)}
button.portrait {cursor:pointer}
.portrait img {width:100%;height:100%;object-fit:cover}
.summary-content {display:flex;flex-direction:column;gap:calc(var(--spacing-xs) / 2);min-width:0}
.identity {display:flex;align-items:center;gap:var(--spacing-xs);min-width:0}
.identity>strong {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--type-sheet-header-size);line-height:var(--type-sheet-header-line-height)}
.heading-combat {display:flex;align-items:center;flex-wrap:wrap;gap:var(--spacing-xs) var(--spacing-small);min-width:0;font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-variant-numeric:lining-nums tabular-nums}
.heading-armor {display:grid;place-items:center;flex:none;position:relative;width:var(--layout-sheet-header-armor);height:var(--layout-sheet-header-armor);padding:0;border:0;background:transparent;color:inherit;font:inherit;border-radius:var(--radius-input)}
button.heading-armor {cursor:pointer}
.heading-armor-icon,.heading-armor-value {grid-area:1/1}
.heading-armor-icon {width:100%;height:100%;color:var(--text-muted)}
.heading-armor-value {padding-bottom:2px;font-weight:700;line-height:1}
.heading-metrics {display:flex;flex:none;flex-direction:column;justify-content:center;color:var(--text-muted);font-size:var(--type-context-size);line-height:calc(var(--layout-sheet-health-height) / 2)}
.heading-metric {display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
button.portrait:focus-visible,button.heading-armor:focus-visible {outline:2px solid var(--accent-soft);outline-offset:2px}
button.heading-armor:hover {background:var(--surface-raised)}
.character-summary-tile--compact .summary-main {grid-template-columns:minmax(0,1fr)}
.character-summary-tile--compact .portrait {width:36px;height:36px}
.character-summary-tile--compact .summary-content {display:none}
@media (--ui-phone) {.summary-main {gap:var(--spacing-xs)}}
</style>
