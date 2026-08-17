<template>
  <main class="rules-entry" role="status">
    {{ failed ? 'Не удалось определить выбранную редакцию.' : 'Открываем правила выбранной редакции…' }}
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameContextStore } from '@/stores/gameContext'

const router = useRouter()
const store = useGameContextStore()
const failed = ref(false)

onMounted(async () => {
  try {
    await store.ensure()
    await router.replace(store.rulesPath)
  } catch {
    failed.value = true
  }
})
</script>

<style scoped>
.rules-entry {
  min-height: 55vh;
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--text-muted);
}
</style>
