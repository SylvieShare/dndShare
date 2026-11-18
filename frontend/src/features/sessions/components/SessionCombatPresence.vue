<template>
  <div v-if="combatant?.position === 'combat' && active && current" class="roster-presence">
    <ArrowRight :size="14" aria-hidden="true" />Сейчас ход
  </div>
</template>

<script setup>
import { ArrowRight } from '@lucide/vue'

defineProps({ combatant: Object, active: Boolean, current: Boolean })
</script>

<style scoped>
.roster-presence {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
  font-size: var(--type-caption-size);
  line-height: var(--type-caption-line-height);
  color: var(--warning);
}
</style>
