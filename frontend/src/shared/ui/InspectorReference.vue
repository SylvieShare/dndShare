<template>
  <BaseTile class="inspector-reference" framed interactive role="button" tabindex="0" :aria-label="label" :color="color"
    @click="activate" @keydown.enter.self.prevent="emit('activate')" @keydown.space.self.prevent="emit('activate')">
    <component :is="icon" :size="20" :style="{ color }" aria-hidden="true" />
    <strong>{{ name }}</strong><ArrowUpRight :size="18" aria-hidden="true" />
  </BaseTile>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import { ArrowUpRight } from '@lucide/vue'
defineProps({ name: String, color: String, icon: [Object, Function], label: { type: String, required: true } })
const emit = defineEmits(['activate'])
function activate() { if (!window.getSelection()?.toString().trim()) emit('activate') }
</script>
<style scoped>
.inspector-reference { display: flex; align-items: center; padding: 10px; gap: 8px; }
.inspector-reference > svg { flex: none; }
.inspector-reference strong { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 13px; }
</style>
