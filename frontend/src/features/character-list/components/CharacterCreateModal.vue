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
      <FormSelect v-model:value="selectedTemplateId" @change="resetForm">
        <option disabled value="">Выберите шаблон</option>
        <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
      </FormSelect>
    </FormField>

    <DndCreateWizard
      v-if="isDndTemplate"
      :template-id="selectedTemplateId"
      :creating="creating"
      @create="onWizardCreate"
      @cancel="requestClose"
    />

    <template v-else>
    <FormField label="Имя персонажа" vertical>
      <FormTextInput
        v-model:value="name"
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
import { computed, onMounted, ref } from 'vue'
import DndCreateWizard from '@/features/character-list/components/wizard/DndCreateWizard.vue'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormSelect } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { MorphSheet } from '@sylvieshare/share-ui'
import { resolveSetting } from '@/features/character-editor/settings'
import { fetchGet } from '@/shared/api/http'
import { findSourceVersion } from '@/shared/lib/sourceVersions'

const props = defineProps({
  templates: { type: Array, default: () => [] },
  creating: { type: Boolean, default: false },
  // Morph origin — the "+ Новый персонаж" tile the window expands out of / back into.
  originRect: { type: Object, default: null },
  originEl: { type: Object, default: null },
})
const emit = defineEmits(['close', 'create'])
const sheetRef = ref(null)

// Animate the collapse back into the tile (MorphSheet owns the morph), then close.
function requestClose() { sheetRef.value?.close() }

const selectedTemplateId = ref(props.templates.length === 1 ? props.templates[0].id : '')
const name = ref('')
const sources = ref([])

const selectedTemplate = computed(() =>
  props.templates.find(t => String(t.id) === String(selectedTemplateId.value)) || null
)
const setting = computed(() => resolveSetting(selectedTemplate.value))
const isDndTemplate = computed(() => setting.value?.system === 'dnd5e')
const sourceVersionId = computed(() => {
  const source = sources.value.find(item => item.name.toLowerCase() === setting.value?.sourceName?.toLowerCase())
  return findSourceVersion(source, setting.value?.sourceVersion)?.id ?? null
})

function onWizardCreate(payload) {
  emit('create', { ...payload, sourceVersionId: sourceVersionId.value })
}
const canCreate = computed(() => !!selectedTemplateId.value && !!setting.value && !!sourceVersionId.value && name.value.trim().length > 0)

function resetForm() {
  name.value = ''
}

function submit() {
  if (!canCreate.value || props.creating) return

  const characterName = name.value.trim()
  emit('create', {
    templateId: selectedTemplateId.value,
    sourceVersionId: sourceVersionId.value,
    data: setting.value.createData?.(characterName) || { values: { name: characterName } },
  })
}

onMounted(async () => {
  resetForm()
  sources.value = (await fetchGet('/sources'))?.sources || []
})
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


.suggest-field {
  position: relative;
}
</style>
