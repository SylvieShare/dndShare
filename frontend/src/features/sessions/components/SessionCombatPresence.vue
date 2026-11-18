<template>
  <div v-if="inActiveCombat" class="roster-presence-slot" :class="{ 'roster-presence-slot--current': current }" :aria-hidden="!current">
    <div class="roster-presence">
      <ArrowRight :size="14" aria-hidden="true" />Сейчас ход
    </div>
  </div>
</template>

<script setup>
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'

const props = defineProps({ combatant: Object, active: Boolean, current: Boolean })
const inActiveCombat = computed(() => props.active && props.combatant?.position === 'combat')
</script>

<style scoped>
.roster-presence-slot {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity var(--motion-enter), visibility 0s var(--motion-enter);
}
.roster-presence-slot--current {
  opacity: 1;
  visibility: visible;
  transition-delay: 0s;
}
.roster-presence {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding-block-start: var(--spacing-xs);
  font-size: var(--type-caption-size);
  line-height: var(--type-caption-line-height);
  color: var(--warning);
}
@media (prefers-reduced-motion: reduce) {
  .roster-presence-slot { transition: none; }
}
</style>
