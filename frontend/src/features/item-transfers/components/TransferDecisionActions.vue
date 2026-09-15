<template>
  <span class="transfer-decision-actions">
    <ActionButton :disabled="busy" @click="$emit('accept')">Принять</ActionButton>
    <ActionButton variant="quiet" :disabled="busy" @click="$emit('reject')">Отказать</ActionButton>
  </span>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
defineProps({ busy: Boolean })
defineEmits(['accept', 'reject'])
</script>
<style scoped>
.transfer-decision-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
</style>
