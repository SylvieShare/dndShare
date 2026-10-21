<template>
  <div class="inspector-visual">
    <BaseTile class="inspector-preview-frame" framed :role="interactive ? 'button' : undefined" :tabindex="interactive ? 0 : undefined" :aria-label="interactive ? label : undefined"
      @dblclick.stop="interactive && emit('activate')" @keydown.enter.self.prevent="interactive && emit('activate')">
      <slot />
    </BaseTile>
    <div v-if="$slots.actions" class="inspector-preview-actions"><slot name="actions" /></div>
  </div>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
defineProps({ interactive: Boolean, label: String })
const emit = defineEmits(['activate'])
</script>
<style scoped>
.inspector-visual { display: flex; gap: 8px; }
.inspector-preview-frame { --surface: var(--map-model-preview-bg); flex: 1; min-width: 0; height: var(--inspector-preview-height, 150px); display: grid; place-items: center; overflow: hidden; }
.inspector-preview-actions { display: flex; flex-direction: column; gap: 6px; }
</style>
