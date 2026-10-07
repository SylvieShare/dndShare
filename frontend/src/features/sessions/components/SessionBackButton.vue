<template>
  <ActionButton class="session-back-button" variant="quiet" data-tutorial="session-back"
    aria-label="К списку сессий" title="К списку сессий" @click="router.push({ name: 'Sessions' })">
    <template #icon><ArrowLeft :size="18" /></template>
    Сессии
  </ActionButton>
</template>
<script setup>
import { useRouter } from 'vue-router'
import { ActionButton } from '@sylvieshare/share-ui'
import { ArrowLeft } from '@lucide/vue'
const router = useRouter()
</script>
<style scoped>
.session-back-button { flex: none; white-space: nowrap; }
</style>
