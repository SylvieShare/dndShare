<template>
  <div class="roster-presence-slot" :class="{ 'roster-presence-slot--current': visible }" :aria-hidden="!visible">
    <div class="roster-presence-clip">
      <div class="roster-presence">
        <ArrowRight :size="14" aria-hidden="true" />Сейчас ход
      </div>
    </div>
  </div>
</template>

<script setup>
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'

const props = defineProps({ combatant: Object, active: Boolean, current: Boolean })
const visible = computed(() => props.combatant?.position === 'combat' && props.active && props.current)
</script>

<style scoped>
.roster-presence-slot {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: grid-template-rows var(--motion-enter), opacity var(--motion-enter), visibility 0s var(--motion-enter);
}
.roster-presence-slot--current {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition-delay: 0s;
}
.roster-presence-clip {
  min-block-size: 0;
  overflow: hidden;
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
