<template>
  <span class="transfer-person">
    <img v-if="imageUrl" :src="imageUrl" alt="" />
    <span v-else class="transfer-person-initial" aria-hidden="true">{{ name?.slice(0, 1) || '?' }}</span>
    <strong>{{ name || 'Без имени' }}</strong>
  </span>
</template>
<script setup>
defineProps({ name: String, imageUrl: String })
</script>
<style scoped>
.transfer-person { display: inline-flex; align-items: center; gap: 9px; min-width: 0; color: var(--text-1); overflow-wrap: anywhere; }
.transfer-person img, .transfer-person-initial { width: 32px; height: 32px; flex: 0 0 32px; object-fit: contain; }
.transfer-person-initial { display: grid; place-items: center; font-size: 20px; font-weight: 700; color: var(--accent-soft); }
.transfer-person strong { font-size: 13px; font-weight: 650; }
</style>
