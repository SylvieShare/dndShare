<template>
  <AppModalFrame extra-wide :title="npc ? 'Редактировать NPC' : 'Новый NPC'" @close="$emit('close')">
    <div class="npc-editor-layout">
      <div class="npc-editor-form">
        <div class="npc-editor-identity">
          <div class="npc-editor-avatar" :style="{ '--npc-color': draft.color }">{{ npcInitial(draft.name) }}</div>
          <div class="npc-editor-name-fields">
            <FormField label="Имя" vertical>
              <FormTextInput v-model:value="draft.name" :maxlength="160" autofocus placeholder="Имя или прозвище" @enter="submit" />
            </FormField>
            <FormField label="Роль" vertical>
              <FormTextInput v-model:value="draft.role" :maxlength="160" placeholder="Трактирщик, проводник, антагонист…" @enter="submit" />
            </FormField>
          </div>
        </div>

        <FormField label="Цвет карточки" vertical>
          <ColorPresetPicker
            inline
            allow-custom
            :model-value="draft.color"
            @update:model-value="draft.color = $event || '#7c5cff'"
          />
        </FormField>

        <FormField label="Описание и заметки" vertical>
          <FormTextarea
            v-model:value="draft.description"
            :rows="9"
            :maxlength="5000"
            placeholder="Характер, мотивация, внешность, голос и секреты"
          />
        </FormField>
      </div>

      <div class="npc-editor-relations">
        <section>
          <div class="npc-editor-section-title">
            <span>Локации</span>
            <small>Где его можно встретить</small>
          </div>
          <WorldRelationChecklist
            v-model="draft.locationIds"
            :items="locationOptions"
            placeholder="Найти локацию…"
            empty-text="Сначала создайте локации"
          />
        </section>
        <section>
          <div class="npc-editor-section-title">
            <span>Сценарии</span>
            <small>Где он участвует</small>
          </div>
          <WorldRelationChecklist
            v-model="draft.sceneIds"
            :items="sceneOptions"
            placeholder="Найти сценарий…"
            empty-text="Сначала создайте сценарии в сюжете"
          />
        </section>
      </div>
    </div>

    <template #footer>
      <div class="npc-editor-footer">
        <button v-if="npc" type="button" class="npc-editor-delete" :disabled="saving" @click="$emit('delete', npc)">
          Удалить NPC
        </button>
        <FormActionButtons
          :submit-text="npc ? 'Сохранить' : 'Создать NPC'"
          loading-text="Сохранение…"
          :loading="saving"
          :can-submit="!!draft.name.trim()"
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
  ColorPresetPicker,
  FormActionButtons,
  FormField,
  FormTextInput,
  FormTextarea,
} from '@sylvieshare/share-ui'
import WorldRelationChecklist from '@/features/sessions/components/WorldRelationChecklist.vue'
import {
  locationBreadcrumb,
  locationKind,
  npcInitial,
  sceneContextLabel,
} from '@/features/sessions/lib/sessionWorld'
import { sessionImagePresetUrl } from '@/features/sessions/lib/sessionImages'

const props = defineProps({
  npc: { type: Object, default: null },
  locations: { type: Array, default: () => [] },
  locationsById: { type: Map, default: () => new Map() },
  scenes: { type: Array, default: () => [] },
  defaultLocationId: { type: [Number, String], default: null },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save', 'delete'])

const draft = reactive({
  name: props.npc?.name ?? '',
  role: props.npc?.role ?? '',
  description: props.npc?.description ?? '',
  color: props.npc?.color ?? '#7c5cff',
  locationIds: props.npc ? [...(props.npc.locationIds || [])] : props.defaultLocationId ? [Number(props.defaultLocationId)] : [],
  sceneIds: [...(props.npc?.sceneIds || [])],
})

const locationOptions = computed(() => props.locations.map(location => ({
  id: location.id,
  title: location.name,
  subtitle: locationBreadcrumb(location, props.locationsById).slice(0, -1).map(item => item.name).join(' · ') || locationKind(location.kind).shortLabel,
  image: sessionImagePresetUrl(location.imagePresetKey),
})))
const sceneOptions = computed(() => props.scenes.map(scene => ({
  id: scene.id,
  title: scene.name,
  subtitle: sceneContextLabel(scene),
  image: sessionImagePresetUrl(scene.imagePresetKey),
})))

function submit() {
  if (!draft.name.trim() || props.saving) return
  emit('save', {
    name: draft.name.trim(),
    role: draft.role.trim() || null,
    description: draft.description.trim() || null,
    color: draft.color || '#7c5cff',
    locationIds: draft.locationIds,
    sceneIds: draft.sceneIds,
  })
}
</script>

<style scoped>
.npc-editor-layout { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr); gap: 24px; }
.npc-editor-form, .npc-editor-relations, .npc-editor-relations section { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.npc-editor-identity { display: grid; grid-template-columns: 78px minmax(0, 1fr); align-items: start; gap: 14px; }
.npc-editor-avatar { width: 78px; height: 78px; display: grid; margin-top: 22px; place-items: center; border: 1px solid color-mix(in srgb, var(--npc-color) 58%, var(--border)); border-radius: 18px; background: radial-gradient(circle at 35% 28%, color-mix(in srgb, var(--npc-color) 40%, var(--surface-raised)), color-mix(in srgb, var(--npc-color) 10%, var(--surface))); color: color-mix(in srgb, var(--npc-color) 75%, var(--text-1)); font-family: var(--font-display); font-size: 31px; font-weight: 800; }
.npc-editor-name-fields { display: flex; flex-direction: column; gap: 12px; }
.npc-editor-relations { padding-left: 22px; border-left: 1px solid var(--border); }
.npc-editor-relations section + section { padding-top: 14px; border-top: 1px solid var(--border); }
.npc-editor-section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; color: var(--text-1); font-size: 12px; font-weight: 700; }
.npc-editor-section-title small { color: var(--text-muted); font-size: 10px; font-weight: 500; }
.npc-editor-footer { width: 100%; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.npc-editor-delete { margin-top: 4px; padding: 9px 0; border: 0; background: none; color: var(--danger); font: inherit; font-size: 13px; cursor: pointer; }
.npc-editor-delete:hover:not(:disabled) { text-decoration: underline; }
@media (max-width: 760px) {
  .npc-editor-layout { grid-template-columns: 1fr; }
  .npc-editor-relations { padding: 16px 0 0; border-top: 1px solid var(--border); border-left: 0; }
}
</style>
