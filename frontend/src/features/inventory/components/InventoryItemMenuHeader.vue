<template>
  <p class="inventory-menu-name">{{ name }}</p>
  <RowActionSeparator />
</template>
<script setup>
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
defineProps({ name: String })
</script>
<style scoped>
.inventory-menu-name { margin: 6px 8px; color: var(--text-1); font-weight: 700; overflow-wrap: anywhere; }
</style>
