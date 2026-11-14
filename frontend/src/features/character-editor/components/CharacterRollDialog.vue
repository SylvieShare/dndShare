<template>
  <AppModalFrame :title="title" :width="layoutTokens['character-roll-width']" :z-index="4000" close-label="Закрыть окно броска" @close="$emit('close')">
    <div class="character-roll-dialog">
      <div v-if="$slots.preview" class="character-roll-dialog__preview"><slot name="preview" /></div>
      <slot />
    </div>
  </AppModalFrame>
</template>
<script setup>
import { AppModalFrame } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
defineProps({ title: { type: String, required: true } })
defineEmits(['close'])
</script>
<style scoped>
.character-roll-dialog {display:grid;gap:var(--spacing-large);min-width:0}
.character-roll-dialog__preview {position:sticky;top:0;z-index:1;padding:var(--spacing-medium);border-radius:var(--radius-tile);background:var(--surface-raised);min-width:0}
</style>
