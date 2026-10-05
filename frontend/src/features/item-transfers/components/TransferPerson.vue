<template>
  <span class="transfer-person" :style="{ '--person-size': `${size}px` }">
    <slot name="avatar">
      <img v-if="imageUrl" :src="imageUrl" alt="" />
      <span v-else class="transfer-person-initial" aria-hidden="true">{{ name?.slice(0, 1) || '?' }}</span>
    </slot>
    <span class="transfer-person-copy"><strong>{{ name || 'Без имени' }}</strong><slot /></span>
  </span>
</template>
<script setup>
defineProps({ name: String, imageUrl: String, size: { type: Number, default: 32 } })
</script>
<style scoped>
.transfer-person { display: inline-flex; align-items: center; gap: 9px; min-width: 0; color: var(--text-1); overflow-wrap: anywhere; }
.transfer-person img, .transfer-person-initial { width: var(--person-size); height: var(--person-size); flex: 0 0 var(--person-size); object-fit: contain; }
.transfer-person-copy { flex: 1; min-width: 0; }
.transfer-person-initial { display: grid; place-items: center; font-size: calc(var(--person-size) * .625); font-weight: 700; color: var(--accent-soft); }
.transfer-person strong { font-size: 13px; font-weight: 650; }
</style>
