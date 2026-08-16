<template>
  <AppModalFrame :title="block ? 'Редактировать блок' : `Новый блок · ${typeLabel}`" wide @close="$emit('close')">
    <div class="scene-block-editor">
      <FormField v-if="!isReferenceBlock" label="Название" vertical>
        <FormTextInput v-model:value="draft.title" :maxlength="200" autofocus />
      </FormField>

      <FormField v-if="blockType === 'text'" label="Описание" vertical>
        <InputDescription
          editable
          :block="descriptionBlock"
          :value="draft.text"
          @update:value="(_, html) => draft.text = html"
        />
      </FormField>

      <FormField v-else-if="blockType === 'combat'" label="Существа" vertical>
        <SceneCombatCreaturesEditor v-model="draft.creatures" />
      </FormField>

      <FormField v-else-if="blockType === 'reward'" label="Предметы" vertical>
        <SceneRewardItemsEditor v-model="draft.items" />
      </FormField>

	  <FormField v-else-if="isReferenceBlock" :label="`Выбрано: ${typeLabel}`" vertical>
		<div v-if="selectedReference" class="scene-block-material-selected">
		  <img v-if="selectedReference.image" :src="selectedReference.image" alt="" />
		  <span v-else class="scene-block-material-icon" :style="{ color: selectedReference.color || selectedReference.typeMeta.color }">{{ selectedReference.title.slice(0, 1) }}</span>
		  <span><strong>{{ selectedReference.title }}</strong><small>{{ selectedReference.subtitle || selectedReference.typeMeta.singular }}</small></span>
		  <button type="button" @click="referencePickerOpen = true">Сменить</button>
		</div>
		<button v-else type="button" class="scene-block-material-pick" :disabled="!referenceOptions.length" @click="referencePickerOpen = true">{{ referenceOptions.length ? `Выбрать ${typeLabel}` : 'Нет доступных объектов' }}</button>
		<UniversalRelationPickerModal v-if="referencePickerOpen" :items="referenceOptions" :fixed-type="blockType" @close="referencePickerOpen = false" @select="selectReference" />
	  </FormField>

      <FormField v-else-if="isImageBlock" label="Изображение для показа" vertical>
        <div v-if="selectedMaterial" class="scene-block-material-selected">
          <img v-if="['image', 'map'].includes(selectedMaterial.kind)" :src="selectedMaterial.assetUrl" alt="" />
          <span v-else class="scene-block-material-icon"><component :is="materialType(selectedMaterial.kind).icon" :size="23" /></span>
          <span><strong>{{ selectedMaterial.name }}</strong><small>{{ materialType(selectedMaterial.kind).label }}<template v-if="selectedMaterial.caption"> · {{ selectedMaterial.caption }}</template></small></span>
          <button type="button" @click="materialPickerOpen = true">Сменить</button>
        </div>
        <button v-else type="button" class="scene-block-material-pick" :disabled="!availableMaterials.length" @click="materialPickerOpen = true">
          {{ availableMaterials.length ? 'Выбрать материал' : 'Нет доступных изображений' }}
        </button>
        <small class="scene-block-material-hint">Поиск идёт по материалам, доступным в текущей главе и сценарии.</small>
        <WorldRelationPickerModal
          v-if="materialPickerOpen"
          title="Выбрать изображение"
          :items="materialOptions"
          placeholder="Поиск по материалам…"
          empty-text="Подходящих материалов пока нет"
          @close="materialPickerOpen = false"
          @select="selectMaterial"
        />
      </FormField>

      <FormField v-else label="Реплики" vertical>
        <div class="scene-block-editor-rows">
          <datalist :id="dialogueKeysListId">
            <option v-for="name in dialogueSuggestions" :key="name" :value="name" />
          </datalist>
          <div v-for="(row, index) in draft.rows" :key="index" class="scene-block-editor-row">
            <ColorPresetPicker
              :model-value="row.color || ''"
              :colors="DIALOGUE_COLOR_POOL"
              :z-index="3400"
              aria-label="Цвет участника диалога"
              @update:model-value="color => setDialogueColor(row, color)"
            >
              <template #trigger="{ toggle, open }">
                <button
                  type="button"
                  class="scene-block-editor-speaker-color"
                  :style="{ background: row.color || 'var(--border-strong)' }"
                  :disabled="!normalizeDialogueKey(row.left)"
                  :aria-expanded="open"
                  aria-label="Выбрать цвет участника"
                  @click="toggle"
                />
              </template>
            </ColorPresetPicker>
            <input
              v-model="row.left"
              :list="dialogueKeysListId"
              placeholder="Участник"
              @input="syncDialogueColor(row)"
            />
            <input v-model="row.right" placeholder="Реплика" />
            <button type="button" aria-label="Удалить строку" @click="draft.rows.splice(index, 1)">×</button>
          </div>
          <button type="button" class="scene-block-editor-add" @click="addDialogueRow">+ Добавить реплику</button>
        </div>
      </FormField>

      <FormField v-if="block && isReferenceBlock" label="Заметка на холсте" vertical>
        <FormTextarea
          v-model:value="draft.note"
          :rows="4"
          :maxlength="2000"
          placeholder="Контекст этого объекта в текущем сценарии…"
        />
      </FormField>
    </div>

    <template #footer>
      <FormActionButtons
        :loading="saving"
		:can-submit="(isReferenceBlock || !!draft.title.trim()) && (!isImageBlock || !!draft.materialId) && (!isReferenceBlock || !!selectedReference)"
        @cancel="$emit('close')"
        @submit="save"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, getCurrentInstance, inject, provide, reactive, ref } from 'vue'
import { AppModalFrame, ColorPresetPicker, FormTextarea } from '@sylvieshare/share-ui'
import InputDescription from '@/shared/ui/InputDescription.vue'
import SceneCombatCreaturesEditor from '@/features/sessions/components/SceneCombatCreaturesEditor.vue'
import SceneRewardItemsEditor from '@/features/sessions/components/SceneRewardItemsEditor.vue'
import WorldRelationPickerModal from '@/features/sessions/components/WorldRelationPickerModal.vue'
import UniversalRelationPickerModal from '@/features/sessions/components/UniversalRelationPickerModal.vue'
import { DIALOGUE_COLOR_POOL, applyDialogueKeyColor, dialogueKeySuggestions, hydrateDialogueRows, normalizeDialogueKey, pickDialogueColor } from '@/features/sessions/lib/dialogueRows'
import { sceneBlockDefaultWidth, sceneBlockType } from '@/features/sessions/lib/sceneBlockTypes'
import { materialType } from '@/features/sessions/lib/sessionMaterials'
import { buildSessionEntityCatalog } from '@/features/sessions/lib/sessionEntityRelations'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'

const props = defineProps({
  block: { type: Object, default: null },
  type: { type: String, default: 'text' },
  saving: { type: Boolean, default: false },
  sceneId: { type: [Number, String], default: null },
})
const emit = defineEmits(['close', 'save'])

const blockType = computed(() => props.block?.type || props.type)
const typeLabel = computed(() => sceneBlockType(blockType.value).label.toLowerCase())
const defaultTitles = { text: 'Новое описание', list: 'Новый диалог', combat: 'Новый бой', reward: 'Новая награда', image: 'Новое изображение', material: 'Новый материал', location: 'Локация', npc: 'NPC', quest: 'Задание' }
const sessionMaterials = inject('sessionMaterials', null)
const sessionWorld = inject('sessionWorld', null)
const isImageBlock = computed(() => blockType.value === 'image')
const isReferenceBlock = computed(() => ['location', 'npc', 'quest', 'material'].includes(blockType.value))
const entityCatalog = computed(() => buildSessionEntityCatalog(sessionWorld, sessionMaterials))
const referenceOptions = computed(() => entityCatalog.value.filter(item => {
  if (item.type !== blockType.value) return false
  if (item.type !== 'material') return true
  return sceneMaterials.value.some(material => String(material.id) === String(item.id))
}))
const sceneMaterials = computed(() => sessionMaterials?.availableFor(props.sceneId) || [])
const availableMaterials = computed(() => sceneMaterials.value
	.filter(material => material.kind === 'image' || material.kind === 'map'))
const selectedMaterial = computed(() => availableMaterials.value.find(material => String(material.id) === String(draft.materialId)) || null)
const materialOptions = computed(() => availableMaterials.value.map(material => ({
  id: material.id,
  title: material.name,
  subtitle: [materialType(material.kind).label, material.caption].filter(Boolean).join(' · '),
  image: ['image', 'map'].includes(material.kind) ? material.assetUrl : '',
  initial: materialType(material.kind).label.slice(0, 1),
  color: 'var(--accent)',
})))
const materialPickerOpen = ref(false)
const referencePickerOpen = ref(false)
const dialogueKeysListId = `scene-dialogue-keys-${getCurrentInstance()?.uid ?? 'editor'}`
const initialDialogueRows = hydrateDialogueRows(props.block?.data?.rows?.length
  ? props.block.data.rows
  : [{ left: '', right: '' }])
const draft = reactive({
  title: props.block?.title || defaultTitles[blockType.value] || 'Новый блок',
  text: props.block?.data?.text || '',
  rows: initialDialogueRows.map(row => ({ ...row, colorKey: normalizeDialogueKey(row.left) })),
  creatures: Array.isArray(props.block?.data?.creatures)
    ? props.block.data.creatures.map(creature => ({ ...creature }))
    : [],
  items: Array.isArray(props.block?.data?.items)
    ? props.block.data.items.map(item => ({ ...item }))
    : [],
	materialId: props.block?.materialId || null,
	referenceId: props.block?.data?.referenceId || null,
	note: props.block?.data?.note || '',
})
const selectedReference = computed(() => referenceOptions.value.find(item => String(item.id) === String(
  blockType.value === 'material' ? draft.materialId : draft.referenceId,
)) || null)
const descriptionBlock = { id: 'scene-block-description', content: { placeholder: 'Текст описания' } }
const dialogueSuggestions = computed(() => dialogueKeySuggestions(draft.rows))

provide('charCtx', { ownerMode: false, dictionaries: {}, var: {} })

function syncDialogueColor(row) {
  const nextKey = normalizeDialogueKey(row.left)
  if (!nextKey) {
    row.color = ''
    row.colorKey = ''
    return
  }
  const matchingRow = draft.rows.find(candidate => candidate !== row && normalizeDialogueKey(candidate.left) === nextKey)
  const colorUsedByAnotherKey = draft.rows.some(candidate => candidate !== row
    && candidate.color === row.color
    && normalizeDialogueKey(candidate.left) !== nextKey)
  if (matchingRow?.color) row.color = matchingRow.color
  else if (!row.color || colorUsedByAnotherKey) row.color = pickDialogueColor(draft.rows, row)
  row.colorKey = nextKey
}

function addDialogueRow() {
  draft.rows.push({ left: '', right: '', color: '', colorKey: '' })
}

function setDialogueColor(row, color) {
  applyDialogueKeyColor(draft.rows, row.left, color)
}

function selectMaterial(materialId) {
  draft.materialId = Number(materialId)
  materialPickerOpen.value = false
}

function selectReference(item) {
  if (blockType.value === 'material') draft.materialId = Number(item.id)
  else draft.referenceId = Number(item.id)
  referencePickerOpen.value = false
}

function save() {
  if (isImageBlock.value && !draft.materialId) return
	if (isReferenceBlock.value && !selectedReference.value) return
  emit('save', {
    type: blockType.value,
    title: isReferenceBlock.value ? selectedReference.value.title : draft.title.trim(),
    width: props.block?.width || sceneBlockDefaultWidth(blockType.value),
    materialId: isImageBlock.value || blockType.value === 'material' ? draft.materialId : null,
    materialChanged: isImageBlock.value || blockType.value === 'material',
    data: blockType.value === 'list'
      ? { rows: draft.rows
        .filter(row => row.left.trim() || row.right.trim())
        .map(row => ({ left: row.left.trim(), right: row.right.trim(), color: row.color || pickDialogueColor(draft.rows, row) })) }
      : blockType.value === 'combat'
        ? { creatures: draft.creatures.map(creature => ({ ...creature })) }
        : blockType.value === 'reward'
          ? { items: draft.items.map(item => ({ ...item })) }
		: isImageBlock.value ? {}
		  : blockType.value === 'material' ? { note: draft.note.trim() || null }
		  : isReferenceBlock.value ? { referenceId: draft.referenceId, note: draft.note.trim() || null }
		  : { text: draft.text },
  })
}
</script>

<style scoped>
.scene-block-editor { display: flex; flex-direction: column; gap: 18px; }
.scene-block-editor-rows { display: flex; flex-direction: column; gap: 8px; }
.scene-block-editor-row { display: grid; grid-template-columns: 12px minmax(110px, .8fr) minmax(160px, 1.4fr) 32px; align-items: center; gap: 8px; }
.scene-block-editor-speaker-color { width: 11px; height: 11px; display: block; padding: 0; border: 0; border-radius: 50%; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 8%, transparent); cursor: pointer; }
.scene-block-editor-speaker-color:disabled { cursor: default; opacity: .42; }
.scene-block-editor-row :deep(.cpp-host) { display: grid; place-items: center; }
.scene-block-editor-row input {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.scene-block-editor-row input:focus { border-color: var(--accent); }
.scene-block-editor-row > button,
.scene-block-editor-add {
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-2);
  font: inherit;
  cursor: pointer;
}
.scene-block-editor-row > button:hover { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
.scene-block-editor-add { align-self: flex-start; padding: 7px 11px; font-size: 12px; }
.scene-block-editor-add:hover { color: var(--accent); border-color: var(--accent); }
.scene-block-material-selected { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 11px; padding: 8px; border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border)); border-radius: 10px; background: var(--surface-raised); }.scene-block-material-selected > img, .scene-block-material-icon { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; background: color-mix(in srgb, var(--accent) 12%, var(--surface)); color: var(--accent-soft); }.scene-block-material-selected > span:nth-child(2) { min-width: 0; display: flex; flex-direction: column; gap: 3px; }.scene-block-material-selected strong, .scene-block-material-selected small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.scene-block-material-selected strong { color: var(--text-1); font-size: 13px; }.scene-block-material-selected small, .scene-block-material-hint { color: var(--text-muted); font-size: 10px; }.scene-block-material-selected button, .scene-block-material-pick { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }.scene-block-material-selected button:hover, .scene-block-material-pick:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-soft); }.scene-block-material-pick { align-self: flex-start; }.scene-block-material-pick:disabled { cursor: default; opacity: .55; }
</style>
