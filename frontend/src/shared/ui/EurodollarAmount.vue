<template>
  <span class="eurodollar-amount">
    {{ amount }}<img :src="icon" alt="евродоллары" title="Евродоллары" />
  </span>
</template>

<script setup>
import icon from '@/assets/ui/eurodollar.webp'
defineProps({ amount: { type: [Number, String], required: true } })
</script>

<style scoped>
.eurodollar-amount { display: inline-flex; align-items: baseline; gap: .2em; white-space: nowrap; }
.eurodollar-amount img { width: 1.45em; height: 1em; object-fit: contain; align-self: center; }
</style>
