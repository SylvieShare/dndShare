<template>
  <AppModal @close="$emit('close')">
    <h2 class="modal-title">Новая сессия</h2>

    <FormField label="Название" vertical>
      <FormTextInput
        v-model:value="name"
        placeholder="Название кампании"
        :maxlength="255"
        autofocus
        @enter="submit"
      />
    </FormField>

    <FormField label="Система" vertical>
      <div class="source-list">
        <button
          v-for="src in sources"
          :key="src.id"
          class="source-item"
          :class="{ active: selectedSourceId === src.id }"
          @click="selectedSourceId = selectedSourceId === src.id ? null : src.id"
        >
          <span class="source-name">{{ src.name }}</span>
          <span v-if="src.version" class="source-version">{{ src.version }}</span>
        </button>
        <div v-if="loadingSources" class="source-loading">Загрузка…</div>
      </div>
    </FormField>

    <FormField label="Описание" vertical>
      <FormTextarea
        v-model:value="description"
        placeholder="Краткое описание (необязательно)"
        :rows="3"
        :maxlength="1000"
      />
    </FormField>

    <FormActionButtons
      submit-text="Создать"
      loading-text="Создаём..."
      :loading="creating"
      :can-submit="!!name.trim()"
      @cancel="$emit('close')"
      @submit="submit"
    />
  </AppModal>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import AppModal from '@/shared/ui/AppModal'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import FormTextarea from '@/shared/ui/form/FormTextarea'
import { fetchGet } from '@/shared/api/http'

const emit = defineEmits(['close', 'create'])

const name = ref('')
const description = ref('')
const creating = ref(false)
const sources = ref([])
const loadingSources = ref(false)
const selectedSourceId = ref(null)

onMounted(async () => {
  loadingSources.value = true
  try {
    const res = await fetchGet('/sources')
    sources.value = res?.sources || []
    if (sources.value.length) selectedSourceId.value = sources.value[0].id
  } finally {
    loadingSources.value = false
  }
})

function submit() {
  if (!name.value.trim() || creating.value) return
  creating.value = true
  emit('create', {
    name: name.value.trim(),
    description: description.value.trim() || null,
    systemId: selectedSourceId.value,
  })
}
</script>

<style scoped>
.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
  margin: 0 0 4px;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--input-border);
  background: color-mix(in srgb, #fff 3%, transparent);
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.13s, border-color 0.13s, color 0.13s;
}

.source-item:hover {
  background: color-mix(in srgb, #fff 6%, transparent);
  color: var(--text-1);
}

.source-item.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--text-1);
}

.source-name {
  font-weight: 500;
}

.source-version {
  font-size: 11px;
  color: var(--text-muted);
  font-family: monospace;
}

.source-item.active .source-version {
  color: var(--text-2);
}

.source-loading {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 12px;
}
</style>
