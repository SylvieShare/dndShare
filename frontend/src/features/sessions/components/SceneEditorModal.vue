<template>
  <AppModalFrame extra-wide :title="scene ? 'Редактировать сценарий' : 'Новый сценарий'" @close="$emit('close')">
    <div class="scene-editor-main-grid">
      <FormField label="Название" vertical>
        <FormTextInput v-model:value="draft.name" :maxlength="160" placeholder="Название сценария" autofocus @enter="submit" />
      </FormField>
      <FormField label="Статус" vertical>
        <FormSelect v-model:value="draft.status">
          <option v-for="status in SCENE_STATUSES" :key="status.key" :value="status.key">{{ status.label }}</option>
        </FormSelect>
      </FormField>
    </div>

    <div class="scene-image-section">
      <div class="scene-image-title">Изображение</div>
      <SessionImagePicker :model-value="draft.imageId" default-key="discovery" :current-url="scene?.imageUrl || ''" @select="draft.imageId = $event.id" />
    </div>

    <section class="scene-presentation-section">
      <div class="scene-presentation-heading">
        <span>СЦЕНА ПОКАЗА</span>
        <strong>Что увидят и услышат игроки</strong>
      </div>
      <div class="scene-presentation-grid">
        <FormField label="Материал" vertical>
          <FormSelect v-model:value="draft.presentationMaterialId">
            <option :value="null">Изображение сценария</option>
            <option v-for="material in availableMaterials" :key="material.id" :value="material.id">{{ material.name }}</option>
          </FormSelect>
        </FormField>
        <FormField label="Музыка" vertical>
          <FormSelect v-model:value="draft.presentationTrackId">
            <option :value="null">Не менять музыку</option>
            <option v-for="track in musicStore.tracks" :key="track.id" :value="track.id">{{ track.name }}</option>
          </FormSelect>
        </FormField>
        <FormField label="Эффект" vertical>
          <FormSelect v-model:value="draft.presentationEffect">
            <option value="none">Без эффекта</option><option value="rain">Дождь</option><option value="fog">Туман</option>
            <option value="embers">Искры</option><option value="snow">Снег</option><option value="storm">Гроза</option>
          </FormSelect>
        </FormField>
        <FormField label="Появление" vertical>
          <FormSelect v-model:value="draft.presentationTransition"><option value="fade">Плавно</option><option value="cut">Сразу</option></FormSelect>
        </FormField>
        <FormField label="Громкость" vertical>
          <input v-model.number="draft.presentationVolume" class="scene-presentation-range" type="range" min="0" max="1" step="0.05" />
        </FormField>
        <FormField label="Сведение, секунд" vertical>
          <input v-model.number="draft.presentationCrossfadeSec" class="scene-presentation-number" type="number" min="0" max="15" step="0.5" />
        </FormField>
      </div>
    </section>

    <template #footer>
      <FormActionButtons
        :submit-text="scene ? 'Сохранить' : 'Создать сценарий'"
        loading-text="Сохранение…"
        :loading="saving"
        :can-submit="!!draft.name.trim() && !!draft.imageId"
        @cancel="$emit('close')"
        @submit="submit"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, inject, reactive } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormSelect } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'
import { SCENE_STATUSES } from '@/features/sessions/lib/chapterGraph'
import { useMusicStore } from '@/stores/music'

const props = defineProps({
  scene: { type: Object, default: null },
  saving: { type: Boolean, default: false },
  chapterId: { type: [Number, String], default: null },
})
const emit = defineEmits(['close', 'save'])
const sessionMaterials = inject('sessionMaterials', null)
const musicStore = useMusicStore()
const availableMaterials = computed(() => sessionMaterials?.availableFor(props.chapterId, props.scene?.id) || [])

const draft = reactive({
  name: props.scene?.name ?? '',
  status: props.scene?.status ?? 'none',
  imageId: props.scene?.imageId ?? 0,
  presentationMaterialId: props.scene?.presentationMaterialId ?? null,
  presentationTrackId: props.scene?.presentationTrackId ?? null,
  presentationVolume: props.scene?.presentationVolume ?? 0.8,
  presentationCrossfadeSec: props.scene?.presentationCrossfadeSec ?? 2.5,
  presentationEffect: props.scene?.presentationEffect ?? 'none',
  presentationTransition: props.scene?.presentationTransition ?? 'fade',
})

function submit() {
  if (!draft.name.trim() || !draft.imageId || props.saving) return
  emit('save', {
    name: draft.name.trim(), status: draft.status, imageId: draft.imageId,
    presentationMaterialId: draft.presentationMaterialId || null,
    presentationTrackId: draft.presentationTrackId || null,
    presentationVolume: draft.presentationTrackId ? draft.presentationVolume : null,
    presentationCrossfadeSec: draft.presentationTrackId ? draft.presentationCrossfadeSec : null,
    presentationEffect: draft.presentationEffect,
    presentationTransition: draft.presentationTransition,
  })
}
</script>

<style scoped>
.scene-editor-main-grid { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 14px; }
.scene-image-section { display: flex; flex-direction: column; gap: 10px; }
.scene-image-title { color: var(--text-2); font-size: 13px; font-weight: 600; }
.scene-presentation-section { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border)); border-radius: 12px; background: color-mix(in srgb, var(--accent) 5%, var(--surface-raised)); }.scene-presentation-heading { display: flex; flex-direction: column; gap: 2px; }.scene-presentation-heading span { color: var(--accent-soft); font-size: 9px; font-weight: 850; letter-spacing: .12em; }.scene-presentation-heading strong { color: var(--text-1); font-size: 13px; }.scene-presentation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px 14px; }.scene-presentation-range { width: 100%; accent-color: var(--accent); }.scene-presentation-number { min-height: 36px; box-sizing: border-box; padding: 7px 9px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-1); }
@media (max-width: 640px) { .scene-editor-main-grid { grid-template-columns: 1fr; } }
</style>
