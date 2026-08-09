<template>
  <MorphSheet
    ref="sheetRef"
    :origin-rect="originRect"
    :origin-el="originEl"
    :width="480"
    @close="emit('close')"
  >
    <template #default="{ revealed }">
    <div class="cc-content" :class="{ revealed }">
      <h2 class="modal-title">Создать персонажа</h2>

    <FormField label="Шаблон" vertical>
      <select v-model="selectedTemplateId" class="form-select" @change="resetForm">
        <option disabled value="">Выберите шаблон</option>
        <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
    </FormField>

    <DndCreateWizard
      v-if="isDndTemplate"
      :template-id="selectedTemplateId"
      :creating="creating"
      @create="onWizardCreate"
      @cancel="requestClose"
    />

    <template v-else>
    <template v-if="createForm">
      <FormField v-for="field in createForm.fields" :key="field.path_to" :label="field.title" vertical>
        <FormTextInput
          v-if="field.type === 'text'"
          v-model:value="formValues[field.path_to]"
          :placeholder="field.placeholder || ''"
          @enter="submit"
        />

        <FormTextInput
          v-else-if="field.type === 'number'"
          v-model:value="formValues[field.path_to]"
          type="number"
          :placeholder="field.placeholder || ''"
          @enter="submit"
        />

        <div v-else-if="field.type === 'suggest'" class="suggest-field" ref="suggestWraps">
          <FormTextInput
            v-model:value="formValues[field.path_to]"
            :placeholder="field.placeholder || ''"
            @focus="openSuggest = field.path_to"
            @blur="openSuggest = null"
            @enter="confirmSuggest(field)"
            @keydown.escape="openSuggest = null"
          />
          <SuggestDropdown
            v-if="openSuggest === field.path_to"
            :items="suggestItems[field.suggest_id] || []"
            :query="formValues[field.path_to] || ''"
            :typeId="Number(field.suggest_id)"
            @pick="pickSuggest(field, $event)"
            @added="addSuggest(field.suggest_id, $event)"
            @deleted="deleteSuggest(field.suggest_id, $event)"
          />
        </div>

        <FormTextInput
          v-else
          v-model:value="formValues[field.path_to]"
          :placeholder="field.placeholder || ''"
          @enter="submit"
        />
      </FormField>
    </template>

    <FormField v-else label="Имя персонажа" vertical>
      <FormTextInput
        v-model:value="fallbackName"
        placeholder="Введите имя..."
        @enter="submit"
      />
    </FormField>

    <FormActionButtons
      submit-text="Создать"
      loading-text="Создание..."
      :loading="creating"
      :can-submit="canCreate"
      @cancel="requestClose"
      @submit="submit"
    />
    </template>
    </div>
    </template>
  </MorphSheet>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import DndCreateWizard from '@/features/character-list/components/wizard/DndCreateWizard.vue'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import MorphSheet from '@/shared/ui/MorphSheet.vue'
import SuggestDropdown from '@/shared/ui/SuggestDropdown'
import { buildCharacterData, firstFormName } from './createFormData'
import { resolveSetting } from '@/features/character-editor/settings'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  templates: { type: Array, default: () => [] },
  creating: { type: Boolean, default: false },
  // Morph origin — the "+ Новый персонаж" tile the window expands out of / back into.
  originRect: { type: Object, default: null },
  originEl: { type: Object, default: null },
})
const emit = defineEmits(['close', 'create'])
const suggestStore = useSuggestStore()
const sheetRef = ref(null)

// Animate the collapse back into the tile (MorphSheet owns the morph), then close.
function requestClose() { sheetRef.value?.close() }

const selectedTemplateId = ref(props.templates.length === 1 ? props.templates[0].id : '')
const fallbackName = ref('')
const formValues = reactive({})
const openSuggest = ref(null)

const selectedTemplate = computed(() =>
  props.templates.find(t => String(t.id) === String(selectedTemplateId.value)) || null
)
const createForm = computed(() => selectedTemplate.value?.createForm || null)
const isDndTemplate = computed(() => resolveSetting(selectedTemplate.value)?.system === 'dnd5e')

function onWizardCreate(payload) {
  emit('create', payload)
}
const suggestItems = computed(() => {
  const map = {}
  for (const field of (createForm.value?.fields || [])) {
    if (field.type === 'suggest' && field.suggest_id) {
      map[field.suggest_id] = suggestStore.items(Number(field.suggest_id))
    }
  }
  return map
})
const canCreate = computed(() => {
  if (!selectedTemplateId.value) return false
  if (!createForm.value) return fallbackName.value.trim().length > 0
  return (createForm.value.fields || []).every(field => {
    const value = formValues[field.path_to]
    return value !== undefined && value !== null && String(value).trim().length > 0
  })
})

function resetForm() {
  for (const key of Object.keys(formValues)) delete formValues[key]
  const fields = createForm.value?.fields || []
  fields.forEach(field => {
    formValues[field.path_to] = field.default ?? ''
  })
  fallbackName.value = ''
  openSuggest.value = null
  ensureSuggests()
}

function ensureSuggests() {
  const ids = [...new Set((createForm.value?.fields || [])
    .filter(field => field.type === 'suggest' && field.suggest_id)
    .map(field => Number(field.suggest_id)))]
  ids.forEach(id => suggestStore.ensure(id))
}

function filtered(field) {
  const items = suggestItems.value[field.suggest_id] || []
  const q = String(formValues[field.path_to] || '').trim().toLowerCase()
  if (!q) return items
  return items.filter(it => it.value.toLowerCase().includes(q))
}

function confirmSuggest(field) {
  const first = filtered(field)[0]
  if (first) pickSuggest(field, first.value)
}

function pickSuggest(field, value) {
  formValues[field.path_to] = value
  openSuggest.value = null
}

function addSuggest(typeId, item) {
  suggestStore.addItem(Number(typeId), item)
}

function deleteSuggest(typeId, id) {
  suggestStore.removeItem(Number(typeId), id)
}

function submit() {
  if (!canCreate.value || props.creating) return

  if (!createForm.value) {
    emit('create', {
      templateId: selectedTemplateId.value,
      name: fallbackName.value.trim(),
      data: {},
    })
    return
  }

  const data = buildCharacterData(createForm.value, formValues)
  const name = firstFormName(createForm.value, formValues).trim() || 'Без имени'
  emit('create', {
    templateId: selectedTemplateId.value,
    name,
    data,
  })
}

watch(selectedTemplateId, ensureSuggests)
onMounted(resetForm)
</script>

<style scoped>
/* MorphSheet has no inner padding; reproduce AppModal's content frame. Content
   fades in with the open morph (revealed) and out on close. */
.cc-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px 28px 24px;
  opacity: 0;
  transition: opacity 0.42s ease;
}

.cc-content.revealed {
  opacity: 1;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--warning);
  margin: 0;
}

.form-select {
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  padding: 9px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.form-select:focus { border-color: var(--accent); }

.suggest-field {
  position: relative;
}
</style>
