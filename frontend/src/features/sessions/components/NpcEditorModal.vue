<template>
  <AppModalFrame extra-wide :title="npc ? 'Редактировать NPC' : 'Новый NPC'" @close="$emit('close')">
    <div class="npc-editor-layout">
      <div class="npc-editor-form">
        <div class="npc-editor-identity">
          <img class="npc-editor-avatar" :src="portraitPreview" alt="" :style="previewPosition" />
          <div class="npc-editor-name-fields">
            <SessionEditableField v-model="draft.name" label="Имя" :icon="UserRound" force-open :multiline="false" :maxlength="160" autofocus required placeholder="Имя или прозвище">
              <template #actions>
                <button type="button" class="npc-editor-random-name" :title="randomNameTitle" aria-label="Случайное имя" @click="randomizeName">
                  <Dices :size="17" />
                </button>
              </template>
            </SessionEditableField>
            <div class="npc-editor-attribute-row">
              <FormField label="Раса" vertical>
                <FormSelect v-model:value="draft.raceItemId" :disabled="racesLoading">
                  <option value="">{{ racesLoading ? 'Загрузка рас…' : 'Не выбрана' }}</option>
                  <option v-for="race in raceOptions" :key="race.id" :value="String(race.id)">{{ race.label }}</option>
                </FormSelect>
                <small v-if="racesError" class="npc-editor-field-error">{{ racesError }}</small>
              </FormField>
              <SessionEditableField v-model="draft.role" label="Роль" :icon="Badge" force-open :multiline="false" :maxlength="160" placeholder="Трактирщик, проводник…" />
            </div>
          </div>
        </div>

        <FormField label="Портрет" vertical>
          <SessionImagePicker
            catalog="npc"
            default-key="npc-scholar"
            allow-upload
            :model-value="draft.imageId"
            :current-url="customPreview"
            :custom-selected="source === 'custom'"
            :custom-preview="customPreview"
            :custom-preview-style="previewPosition"
            @select="pickCatalogImage"
            @upload="fileInput?.click()"
          />
          <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
          <small v-if="uploadError" class="npc-editor-field-error">{{ uploadError }}</small>
        </FormField>

        <FormField label="Цвет карточки" vertical>
          <div class="npc-editor-color-picker">
            <ColorPresetPicker
              inline
              allow-custom
              :model-value="draft.color"
              @update:model-value="draft.color = $event || '#7c5cff'"
            />
          </div>
        </FormField>

        <SessionEditableField v-model="draft.description" label="Описание и заметки" :icon="NotebookPen" force-open :rows="9" :maxlength="5000" placeholder="Характер, мотивация, внешность, голос и секреты" />
      </div>

      <div class="npc-editor-relations">
		<section>
		  <div class="npc-editor-section-title"><span>Бестиарий</span><small>Необязательная ссылка</small></div>
		  <div v-if="draft.bestiaryItemId" class="npc-editor-bestiary-link">
			<BookOpen :size="18" />
			<div>
			  <strong>{{ draft.bestiaryItemName || `Существо #${draft.bestiaryItemId}` }}</strong>
			  <small>Характеристики берутся из текущей карточки бестиария</small>
			</div>
			<button type="button" @click="bestiaryPickerOpen = true">Заменить</button>
			<button type="button" class="npc-editor-bestiary-unlink" aria-label="Убрать привязку к бестиарию" title="Убрать привязку" @click="clearBestiaryItem">
			  <X :size="15" />
			</button>
		  </div>
		  <button v-else type="button" class="npc-editor-bestiary-select" @click="bestiaryPickerOpen = true">
			<Link2 :size="16" />Привязать существо из бестиария
		  </button>
		</section>
		<section>
		  <div class="npc-editor-section-title"><span>Связи</span><small>Локации, NPC, задания и материалы</small></div>
		  <UniversalRelationEditor v-model="draft.relations" :items="relationItems" source-type="npc" :source-id="npc?.id" />
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
          :loading="saving || uploading"
          :can-submit="!!draft.name.trim() && (!!draft.imageId || !!selectedFile)"
          @cancel="$emit('close')"
          @submit="submit"
        />
      </div>
    </template>
  </AppModalFrame>

  <ItemPickerModal
	v-if="bestiaryPickerOpen"
	:item-type-ids="[6]"
	title="Привязать существо из бестиария"
	:z-index="9200"
	@close="bestiaryPickerOpen = false"
	@pick="pickBestiaryItem"
  />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Badge, BookOpen, Dices, Link2, NotebookPen, UserRound, X } from '@lucide/vue'
import {
  AppModalFrame,
  ColorPresetPicker,
  FormActionButtons,
  FormField,
  FormSelect,
} from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import SessionEditableField from '@/features/sessions/components/SessionEditableField.vue'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'
import UniversalRelationEditor from '@/features/sessions/components/UniversalRelationEditor.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { randomDndName } from '@/shared/lib/dndNames'

const props = defineProps({
  npc: { type: Object, default: null },
  locations: { type: Array, default: () => [] },
  locationsById: { type: Map, default: () => new Map() },
  npcs: { type: Array, default: () => [] },
  defaultLocationId: { type: [Number, String], default: null },
  saving: { type: Boolean, default: false },
	relationItems: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'save', 'delete'])
const races = ref([])
const racesLoading = ref(false)
const racesError = ref('')
const bestiaryPickerOpen = ref(false)
const fileInput = ref(null)
const selectedFile = ref(null)
const objectUrl = ref('')
const uploading = ref(false)
const uploadError = ref('')
const source = ref(props.npc?.imageId && !props.npc?.imageCatalogKey ? 'custom' : 'catalog')
const customPreview = ref(props.npc?.imageUrl || '')

const draft = reactive({
  name: props.npc?.name ?? '',
  raceItemId: String(props.npc?.raceItemId ?? ''),
  bestiaryItemId: props.npc?.bestiaryItemId ?? null,
  bestiaryItemName: props.npc?.bestiaryItemName ?? '',
  role: props.npc?.role ?? '',
  description: props.npc?.description ?? '',
  color: props.npc?.color ?? '#7c5cff',
  imageId: props.npc?.imageId ?? 0,
  imageFocalX: props.npc?.imageFocalX ?? 0.5,
  imageFocalY: props.npc?.imageFocalY ?? 0.5,
	relations: props.npc
		? (props.npc.relations || []).map(link => ({ ...link }))
		: props.defaultLocationId ? [{ type: 'location', id: Number(props.defaultLocationId), note: null }] : [],
})
const previewPosition = computed(() => ({ objectPosition: `${draft.imageFocalX * 100}% ${draft.imageFocalY * 100}%` }))
const portraitPreview = computed(() => customPreview.value)

const raceOptions = computed(() => {
  const byId = new Map(races.value.map(race => [race.id, race]))
  return races.value.map(race => ({
    ...race,
    label: race.parentId && byId.get(race.parentId)
      ? `${byId.get(race.parentId).name} — ${race.name}`
      : race.name,
  })).sort((left, right) => left.label.localeCompare(right.label, 'ru'))
})
const selectedRace = computed(() => races.value.find(race => String(race.id) === draft.raceItemId)
  || (props.npc?.raceName ? { name: props.npc.raceName } : null))
const randomNameTitle = computed(() => selectedRace.value
  ? `Случайное имя: ${selectedRace.value.name}`
  : 'Случайное фэнтезийное имя')

onMounted(async () => {
  racesLoading.value = true
  try {
    races.value = (await itemsApi.list(8, 500))?.items || []
  } catch {
    racesError.value = 'Не удалось загрузить расы'
  } finally {
    racesLoading.value = false
  }
})

function randomizeName() {
  draft.name = randomDndName(selectedRace.value, Math.random, draft.name)
}

function pickBestiaryItem(item) {
  draft.bestiaryItemId = item.id
  draft.bestiaryItemName = item.name
}

function clearBestiaryItem() {
  draft.bestiaryItemId = null
  draft.bestiaryItemName = ''
}

function pickCatalogImage(image) {
  source.value = 'catalog'
  draft.imageId = image.id
  customPreview.value = image.url
}
function onFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) { uploadError.value = 'Выберите файл изображения'; return }
  if (file.size > 15 * 1024 * 1024) { uploadError.value = 'Файл слишком большой — максимум 15 МБ'; return }
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = URL.createObjectURL(file)
  selectedFile.value = file
  customPreview.value = objectUrl.value
  source.value = 'custom'
  uploadError.value = ''
}
async function uploadSelected() {
  if (!selectedFile.value) return { upload_id: draft.imageId }
  uploading.value = true
  try {
    const form = new FormData()
    form.append('file', selectedFile.value)
    const response = await fetch('/api/storage/images', { method: 'POST', body: form })
    if (!response.ok) throw new Error(String(response.status))
    return await response.json()
  } finally { uploading.value = false }
}

async function submit() {
  if (!draft.name.trim() || (!draft.imageId && !selectedFile.value) || props.saving || uploading.value) return
  uploadError.value = ''
  try {
    const selected = source.value === 'custom' ? await uploadSelected() : { upload_id: draft.imageId }
    emit('save', {
      name: draft.name.trim(),
      raceItemId: Number(draft.raceItemId) || null,
      bestiaryItemId: Number(draft.bestiaryItemId) || null,
      role: draft.role.trim() || null,
      description: draft.description.trim() || null,
      color: draft.color || '#7c5cff',
      imageId: selected.upload_id,
      imageFocalX: draft.imageFocalX,
      imageFocalY: draft.imageFocalY,
		relations: draft.relations,
    })
  } catch { uploadError.value = 'Не удалось загрузить изображение' }
}
onBeforeUnmount(() => { if (objectUrl.value) URL.revokeObjectURL(objectUrl.value) })
</script>

<style scoped>
.npc-editor-layout { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr); gap: 24px; }
.npc-editor-form, .npc-editor-relations, .npc-editor-relations section { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.npc-editor-identity { display: grid; grid-template-columns: 78px minmax(0, 1fr); align-items: start; gap: 14px; }
.npc-editor-avatar { width: 78px; height: 78px; display: block; margin-top: 22px; border: 1px solid var(--border); border-radius: 18px; object-fit: cover; }
.npc-editor-name-fields { display: flex; flex-direction: column; gap: 12px; }
.npc-editor-name-row { display: grid; grid-template-columns: minmax(0, 1fr) 38px; gap: 8px; }
.npc-editor-random-name { width: 38px; height: 38px; display: grid; place-items: center; padding: 0; border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border)); border-radius: 9px; background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent-soft); cursor: pointer; transition: background 0.15s, color 0.15s, transform 0.15s; }
.npc-editor-random-name:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--text-1); transform: translateY(-1px); }
.npc-editor-attribute-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
.npc-editor-field-error { color: var(--danger); font-size: 10px; }
.npc-editor-color-picker { width: max-content; max-width: 100%; }
.npc-editor-color-picker :deep(.cpp-grid) { grid-template-columns: repeat(var(--cpp-columns, 6), 24px); }
.npc-editor-relations { padding-left: 22px; border-left: 1px solid var(--border); }
.npc-editor-relations section + section { padding-top: 14px; border-top: 1px solid var(--border); }
.npc-editor-section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; color: var(--text-1); font-size: 12px; font-weight: 700; }
.npc-editor-section-title small { color: var(--text-muted); font-size: 10px; font-weight: 500; }
.npc-editor-bestiary-link { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto 30px; align-items: center; gap: 9px; padding: 9px 10px; border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--border)); border-radius: 9px; background: color-mix(in srgb, var(--accent) 7%, var(--surface-raised)); color: var(--accent-soft); }
.npc-editor-bestiary-link > div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.npc-editor-bestiary-link strong, .npc-editor-bestiary-link small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.npc-editor-bestiary-link strong { color: var(--text-1); font-size: 12px; }
.npc-editor-bestiary-link small { color: var(--text-muted); font-size: 9px; }
.npc-editor-bestiary-link button, .npc-editor-bestiary-select { border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); font: inherit; cursor: pointer; }
.npc-editor-bestiary-link button { min-height: 30px; padding: 5px 8px; font-size: 10px; }
.npc-editor-bestiary-link button:hover, .npc-editor-bestiary-select:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); color: var(--text-1); }
.npc-editor-bestiary-link .npc-editor-bestiary-unlink { width: 30px; display: grid; place-items: center; padding: 0; color: var(--text-muted); }
.npc-editor-bestiary-select { min-height: 42px; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 8px 12px; border-style: dashed; color: var(--accent-soft); font-size: 11px; }
.npc-editor-footer { width: 100%; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.npc-editor-delete { margin-top: 4px; padding: 9px 0; border: 0; background: none; color: var(--danger); font: inherit; font-size: 13px; cursor: pointer; }
.npc-editor-delete:hover:not(:disabled) { text-decoration: underline; }
@media (max-width: 760px) {
  .npc-editor-layout { grid-template-columns: 1fr; }
  .npc-editor-attribute-row { grid-template-columns: 1fr; }
  .npc-editor-relations { padding: 16px 0 0; border-top: 1px solid var(--border); border-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .npc-editor-random-name { transition: none; } }
</style>
