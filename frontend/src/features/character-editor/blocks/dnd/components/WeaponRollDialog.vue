<template>
  <AppModalFrame :title="title" :width="layoutTokens['weapon-roll-width']" :z-index="4000" close-label="Закрыть окно броска" @close="$emit('close')">
    <div class="weapon-roll-dialog">
      <div class="weapon-roll-dialog__preview"><slot name="preview" /></div>
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
.weapon-roll-dialog {display:grid;gap:var(--spacing-large);min-width:0}
.weapon-roll-dialog__preview {position:sticky;top:0;z-index:1;padding:var(--spacing-medium);border-radius:var(--radius-tile);background:var(--surface-raised);min-width:0}
</style>
