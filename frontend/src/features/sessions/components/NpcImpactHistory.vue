<template>
  <AppModalFrame title="История урона и эффектов" @close="$emit('close')">
    <LoadingIndicator v-if="loading" label="Загрузка истории" />
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!history.length" class="history-empty">У этого существа пока нет изменений хитов и эффектов.</p>
    <div v-else class="npc-history">
      <article v-for="(impact, index) in history" :key="index">
        <header><strong>{{ impact.action }}</strong><time>{{ new Date(impact.createdAt).toLocaleString('ru-RU') }}</time></header>
        <DamageImpact :impact="impact" :show-target="false" />
      </article>
    </div>
  </AppModalFrame>
</template>
<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { AppModalFrame, LoadingIndicator } from '@sylvieshare/share-ui'
import DamageImpact from './DamageImpact.vue'
const props = defineProps({ uid: String })
defineEmits(['close'])
const enc = inject('encounter'), loading = ref(true), error = ref('')
const history = computed(() => [...(enc.encounter.combatants.find(row => row.uid === props.uid)?.impactHistory || [])].reverse())
onMounted(async () => {
  try {
    if (!await enc.flushApplicationSave()) throw new Error('Не удалось сохранить изменения боя.')
    await enc.load()
    if (enc.loadError) throw new Error('Не удалось загрузить историю.')
  } catch (cause) { error.value = cause.message }
  finally { loading.value = false }
})
</script>
<style scoped>
.npc-history { display: grid; gap: 16px; max-height: 65vh; overflow: auto; }
.npc-history article { display: grid; gap: 6px; }.npc-history header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 13px; }
.npc-history time, .history-empty { color: var(--text-muted); font-size: 12px; }
</style>
