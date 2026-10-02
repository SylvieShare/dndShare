<template>
  <img v-if="store.emptyCellUrl" :src="store.emptyCellUrl" alt="" aria-hidden="true" />
  <Backpack v-else :size="40" aria-hidden="true" />
</template>
<script setup>
import { onMounted } from 'vue'
import { Backpack } from '@lucide/vue'
import { useInventoryIconPresetsStore } from '@/stores/inventoryIconPresets'
const store = useInventoryIconPresetsStore()
onMounted(() => store.ensureLoaded())
</script>
<style scoped>
img { width: 64px; height: 64px; max-width: 80%; max-height: 80%; object-fit: contain; pointer-events: none; }
</style>
