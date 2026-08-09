<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Шаблоны</h1>
      <button class="btn-new" @click="showCreate = true">+ Новый шаблон</button>
    </div>

    <div class="templates-grid">
      <div
        v-for="t in templates"
        :key="t.id"
        class="template-card"
      >
        <div class="card-icon">рџ“‹</div>
        <div class="card-name">{{ t.name }}</div>
        <div class="card-id">ID {{ t.id }}</div>
        <button class="card-edit-btn" @click="router.push('/template/' + t.id + '/edit')">
          Редактировать
        </button>
      </div>
    </div>

    <AppModal v-if="showCreate" @close="showCreate = false">
      <h2 class="modal-title">Новый шаблон</h2>
      <FormField label="Название шаблона" vertical>
        <FormTextInput v-model:value="newName" autofocus @enter="createTemplate" />
      </FormField>
      <FormActionButtons
        submit-text="Создать"
        loading-text="Создание..."
        :loading="creating"
        :can-submit="!!newName.trim()"
        @cancel="showCreate = false"
        @submit="createTemplate"
      />
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from '@/shared/ui/AppModal'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import { fetchPost } from '@/shared/api/http'
import { useTemplateStore } from '@/stores/template'

const router = useRouter()
const templateStore = useTemplateStore()
const showCreate = ref(false)
const newName = ref('')
const creating = ref(false)
const templates = computed(() => templateStore.all)

async function createTemplate() {
  if (!newName.value.trim() || creating.value) return
  creating.value = true
  try {
    const res = await fetchPost('/template', { name: newName.value.trim() })
    templateStore.add(res)
    showCreate.value = false
    newName.value = ''
    router.push('/template/' + res.id + '/edit')
  } finally {
    creating.value = false
  }
}

onMounted(() => templateStore.ensure())
</script>

<style scoped>
.page {
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  margin: 0;
}

.btn-new {
  background: var(--accent-hover);
  color: var(--text-on-accent);
  border: none;
  border-radius: 8px;
  padding: 9px 18px;
  font-size: 14px;
  cursor: pointer;
}

.btn-new:hover { background: var(--accent); }

.templates-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.template-card {
  width: 220px;
  background: var(--surface-raised);
  border-radius: 14px;
  padding: 20px 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.template-card:hover { border-color: var(--accent-hover); }

.card-icon { font-size: 32px; }

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--warning);
  text-align: center;
}

.card-id {
  font-size: 11px;
  color: var(--text-2);
}

.card-edit-btn {
  margin-top: 4px;
  background: var(--surface-raised);
  color: var(--text-2);
  border: none;
  border-radius: 7px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  width: 100%;
}

.card-edit-btn:hover { background: var(--accent-hover); color: var(--text-on-accent); }

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--warning);
  margin: 0;
}
</style>
