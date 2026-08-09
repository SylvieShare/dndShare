<template>
  <div class="editor-root">
    <div class="editor-toolbar">
      <button class="tb-back" @click="router.push('/templates')">← Шаблоны</button>
      <span class="tb-name">{{ template?.name }}</span>
    </div>

    <div class="editor-body editor-body-placeholder" v-if="schema">
      <div class="schema-v2-placeholder">
        <div class="schema-v2-title">Редактор шаблонов пока не реализован</div>
        <div class="schema-v2-text">Актуальная схема: отдельные blocks, sections и layouts.desktop/mobile. Визуальный редактор для этой модели будет отдельным шагом.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchGet } from '@/shared/api/http'

const route = useRoute()
const router = useRouter()
const template = ref(null)
const schema = ref(null)

onMounted(async () => {
  const templateRes = await fetchGet('/template/' + route.params.id)
  template.value = templateRes
  schema.value = templateRes?.schema || null
})
</script>

<style scoped>
.editor-root {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 54px);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 48px;
  background: var(--bg);
  border-bottom: 1px solid var(--surface-raised);
  flex-shrink: 0;
}

.tb-back {
  background: none;
  border: none;
  color: var(--text-2);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.tb-back:hover { color: var(--text-1); }

.tb-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--warning);
  flex: 1;
}

.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-body-placeholder {
  align-items: center;
  justify-content: center;
}

.schema-v2-placeholder {
  max-width: 460px;
  padding: 24px;
  border: 1px solid var(--surface-raised);
  border-radius: 8px;
  background: var(--popover-bg);
}

.schema-v2-title {
  color: var(--text-1);
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}

.schema-v2-text {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
