<template>
  <AppModalFrame extra-wide :title="location ? 'Редактировать локацию' : 'Новая локация'" @close="$emit('close')">
    <div class="location-editor-layout">
      <div class="location-editor-form">
        <FormField label="Название" vertical>
          <FormTextInput v-model:value="draft.name" :maxlength="160" autofocus placeholder="Например, Старый город" @enter="submit" />
        </FormField>

        <div class="location-editor-row">
          <FormField label="Тип" vertical>
            <FormSelect v-model:value="draft.kind">
              <option v-for="kind in LOCATION_KINDS" :key="kind.key" :value="kind.key">{{ kind.label }}</option>
            </FormSelect>
          </FormField>
          <FormField label="Внутри локации" vertical>
            <FormSelect v-model:value="draft.parentLocationId">
              <option value="">На верхнем уровне</option>
              <option v-for="option in parentOptions" :key="option.id" :value="String(option.id)">
                {{ '— '.repeat(option.depth) }}{{ option.name }}
              </option>
            </FormSelect>
          </FormField>
        </div>

        <FormField label="Описание" vertical>
          <FormTextarea
            v-model:value="draft.description"
            :rows="7"
            :maxlength="5000"
            placeholder="Атмосфера, особенности, важные детали и заметки мастера"
          />
        </FormField>
      </div>

      <section class="location-editor-scenes">
		<div class="location-editor-section-title"><span>Связи</span><small>Локации, NPC, задания и материалы</small></div>
		<UniversalRelationEditor v-model="draft.relations" :items="relationItems" source-type="location" :source-id="location?.id" />
      </section>
    </div>

    <section class="location-editor-image">
      <div class="location-editor-section-title">
        <span>Визуальный ориентир</span>
        <small>Будет показан в карточке локации</small>
      </div>
      <SessionImagePicker :model-value="draft.imageId" default-key="city" :current-url="location?.imageUrl || ''" @select="draft.imageId = $event.id" />
    </section>

    <template #footer>
      <div class="location-editor-footer">
        <button v-if="location" type="button" class="location-editor-delete" :disabled="saving" @click="$emit('delete', location)">
          Удалить локацию
        </button>
        <FormActionButtons
          :submit-text="location ? 'Сохранить' : 'Создать локацию'"
          loading-text="Сохранение…"
          :loading="saving"
          :can-submit="!!draft.name.trim() && !!draft.imageId"
          @cancel="$emit('close')"
          @submit="submit"
        />
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, reactive } from 'vue'
import {
  AppModalFrame,
  FormActionButtons,
  FormField,
  FormSelect,
  FormTextInput,
  FormTextarea,
} from '@sylvieshare/share-ui'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'
import UniversalRelationEditor from '@/features/sessions/components/UniversalRelationEditor.vue'
import {
  buildLocationForest,
  locationDescendantIds,
  LOCATION_KINDS,
} from '@/features/sessions/lib/sessionWorld'

const props = defineProps({
  location: { type: Object, default: null },
  locations: { type: Array, default: () => [] },
  defaultParentId: { type: [Number, String], default: null },
  saving: { type: Boolean, default: false },
	relationItems: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'save', 'delete'])

const draft = reactive({
  name: props.location?.name ?? '',
  kind: props.location?.kind ?? 'settlement',
  parentLocationId: String(props.location?.parentLocationId ?? props.defaultParentId ?? ''),
  description: props.location?.description ?? '',
  imageId: props.location?.imageId ?? 0,
	relations: (props.location?.relations || []).map(relation => ({ ...relation })),
})

const excludedParentIds = computed(() => {
  if (!props.location) return new Set()
  return new Set([props.location.id, ...locationDescendantIds(props.location.id, props.locations)])
})
const parentOptions = computed(() => {
  const result = []
  const visit = (nodes, depth) => {
    for (const node of nodes) {
      if (!excludedParentIds.value.has(node.id)) result.push({ ...node, depth })
      visit(node.children, depth + 1)
    }
  }
  visit(buildLocationForest(props.locations), 0)
  return result
})
function submit() {
  if (!draft.name.trim() || !draft.imageId || props.saving) return
  const parentValue = Number(draft.parentLocationId)
  emit('save', {
    parentLocationId: Number.isInteger(parentValue) && parentValue > 0 ? parentValue : null,
    name: draft.name.trim(),
    kind: draft.kind,
    description: draft.description.trim() || null,
    imageId: draft.imageId,
		relations: draft.relations,
  })
}
</script>

<style scoped>
.location-editor-layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr); gap: 22px; }
.location-editor-form { display: flex; flex-direction: column; gap: 14px; }
.location-editor-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.location-editor-scenes { min-width: 0; padding-left: 20px; border-left: 1px solid var(--border); }
.location-editor-scenes, .location-editor-image { display: flex; flex-direction: column; gap: 10px; }
.location-editor-image { padding-top: 18px; border-top: 1px solid var(--border); }
.location-editor-section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; color: var(--text-1); font-size: 12px; font-weight: 700; }
.location-editor-section-title small { color: var(--text-muted); font-size: 10px; font-weight: 500; }
.location-editor-footer { width: 100%; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.location-editor-delete { margin-top: 4px; padding: 9px 0; border: 0; background: none; color: var(--danger); font: inherit; font-size: 13px; cursor: pointer; }
.location-editor-delete:hover:not(:disabled) { text-decoration: underline; }
@media (max-width: 760px) {
  .location-editor-layout { grid-template-columns: 1fr; }
  .location-editor-scenes { padding: 16px 0 0; border-top: 1px solid var(--border); border-left: 0; }
  .location-editor-row { grid-template-columns: 1fr; }
}
</style>
