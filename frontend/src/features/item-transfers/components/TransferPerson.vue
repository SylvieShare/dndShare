<template>
  <span class="transfer-person" :style="{ '--person-size': `${size}px` }">
    <slot name="avatar">
      <CharacterAvatar :src="imageUrl" :name="name" :size="size" />
    </slot>
    <span class="transfer-person-copy"><strong>{{ name || 'Без имени' }}</strong><slot /></span>
  </span>
</template>
<script setup>
import CharacterAvatar from '@/features/character-editor/components/CharacterAvatar.vue'
defineProps({ name: String, imageUrl: String, size: { type: Number, default: 32 } })
</script>
<style scoped>
.transfer-person { display: inline-flex; align-items: center; gap: 9px; min-width: 0; color: var(--text-1); overflow-wrap: anywhere; }
.transfer-person-copy { flex: 1; min-width: 0; }
.transfer-person strong { font-size: 13px; font-weight: 650; }
</style>
