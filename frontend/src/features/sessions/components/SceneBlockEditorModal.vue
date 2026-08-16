<template>
  <AppModalFrame :title="block ? 'Редактировать блок' : `Новый блок · ${typeLabel}`" wide @close="$emit('close')">
    <div class="scene-block-editor">
      <FormField label="Название" vertical>
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

      <FormField v-else-if="blockType === 'image'" label="Материал для показа" vertical>
        <div v-if="availableMaterials.length" class="scene-block-materials">
          <button v-for="material in availableMaterials" :key="material.id" type="button" :class="{ active: draft.materialId === material.id }" @click="draft.materialId = material.id">
            <img :src="material.assetUrl" alt="" /><span><strong>{{ material.name }}</strong><small>{{ material.caption || 'Без подписи' }}</small></span>
          </button>
        </div>
        <div v-else class="scene-block-materials-empty">Сначала добавьте изображение во вкладке «Материалы».</div>
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
    </div>

    <template #footer>
      <FormActionButtons
        :loading="saving"
        :can-submit="!!draft.title.trim() && (blockType !== 'image' || !!draft.materialId)"
        @cancel="$emit('close')"
        @submit="save"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, getCurrentInstance, inject, provide, reactive } from 'vue'
import { AppModalFrame, ColorPresetPicker } from '@sylvieshare/share-ui'
import InputDescription from '@/shared/ui/InputDescription.vue'
import SceneCombatCreaturesEditor from '@/features/sessions/components/SceneCombatCreaturesEditor.vue'
import SceneRewardItemsEditor from '@/features/sessions/components/SceneRewardItemsEditor.vue'
import { DIALOGUE_COLOR_POOL, applyDialogueKeyColor, dialogueKeySuggestions, hydrateDialogueRows, normalizeDialogueKey, pickDialogueColor } from '@/features/sessions/lib/dialogueRows'
import { sceneBlockDefaultWidth, sceneBlockType } from '@/features/sessions/lib/sceneBlockTypes'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'

const props = defineProps({
  block: { type: Object, default: null },
  type: { type: String, default: 'text' },
  saving: { type: Boolean, default: false },
  chapterId: { type: [Number, String], default: null },
  sceneId: { type: [Number, String], default: null },
})
const emit = defineEmits(['close', 'save'])

const blockType = computed(() => props.block?.type || props.type)
const typeLabel = computed(() => sceneBlockType(blockType.value).label.toLowerCase())
const defaultTitles = { text: 'Новое описание', list: 'Новый диалог', combat: 'Новый бой', reward: 'Новая награда', image: 'Новое изображение' }
const sessionMaterials = inject('sessionMaterials', null)
const availableMaterials = computed(() => (sessionMaterials?.availableFor(props.chapterId, props.sceneId) || []).filter(material => material.kind === 'image' || material.kind === 'map'))
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
})
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

function save() {
  if (blockType.value === 'image' && !draft.materialId) return
  emit('save', {
    type: blockType.value,
    title: draft.title.trim(),
    width: props.block?.width || sceneBlockDefaultWidth(blockType.value),
    materialId: blockType.value === 'image' ? draft.materialId : null,
    materialChanged: blockType.value === 'image',
    data: blockType.value === 'list'
      ? { rows: draft.rows
        .filter(row => row.left.trim() || row.right.trim())
        .map(row => ({ left: row.left.trim(), right: row.right.trim(), color: row.color || pickDialogueColor(draft.rows, row) })) }
      : blockType.value === 'combat'
        ? { creatures: draft.creatures.map(creature => ({ ...creature })) }
        : blockType.value === 'reward'
          ? { items: draft.items.map(item => ({ ...item })) }
        : blockType.value === 'image' ? {} : { text: draft.text },
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
.scene-block-materials { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }.scene-block-materials button { min-width: 0; overflow: hidden; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; text-align: left; }.scene-block-materials button.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }.scene-block-materials img { width: 100%; height: 92px; display: block; object-fit: cover; }.scene-block-materials span { display: flex; flex-direction: column; gap: 2px; padding: 7px; }.scene-block-materials strong, .scene-block-materials small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.scene-block-materials strong { color: var(--text-1); font-size: 11px; }.scene-block-materials small, .scene-block-materials-empty { color: var(--text-muted); font-size: 10px; }
</style>
