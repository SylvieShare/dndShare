<template>
  <div class="materials-workspace">
    <aside class="materials-library">
      <header>
        <div><span>БИБЛИОТЕКА</span><strong>Материалы</strong></div>
        <button v-if="isDm" type="button" @click="openCreate"><Plus :size="15" />Добавить</button>
      </header>
      <div v-if="materials.loading.value" class="materials-state">Загружаем материалы…</div>
      <div v-else-if="materials.error.value" class="materials-state materials-state--error">{{ materials.error.value }}</div>
      <div v-else-if="!materials.materials.value.length" class="materials-state">Добавьте изображения, карты и иллюстрации, которые хотите показывать игрокам.</div>
      <div v-else class="materials-groups">
        <section v-for="group in groups" :key="group.key" v-show="group.items.length">
          <h3>{{ group.label }}</h3>
          <button
            v-for="material in group.items"
            :key="material.id"
            type="button"
            :class="{ active: selected?.id === material.id }"
            @click="selectedId = material.id"
          >
            <img :src="material.imageUrl" alt="" />
            <span><strong>{{ material.name }}</strong><small>{{ contextLabel(material) }}</small></span>
          </button>
        </section>
      </div>
    </aside>
    <main class="material-preview">
      <template v-if="selected">
        <div class="material-preview-image"><img :src="selected.imageUrl" :alt="selected.name" /></div>
        <div class="material-preview-copy">
          <div><span>{{ contextLabel(selected) }}</span><h2>{{ selected.name }}</h2><p v-if="selected.caption">{{ selected.caption }}</p></div>
          <div class="material-preview-actions">
            <button type="button" class="primary" @click="presentation.showMaterial(selected)"><Cast :size="16" />Транслировать</button>
            <button v-if="isDm" type="button" @click="editing = selected"><Pencil :size="15" />Изменить</button>
            <button v-if="isDm" type="button" class="danger" @click="removeSelected"><Trash2 :size="15" /></button>
          </div>
        </div>
      </template>
      <div v-else class="materials-state">Выберите материал слева</div>
      <span v-if="actionError" class="material-action-error">{{ actionError }}</span>
    </main>
    <MaterialEditorModal
      v-if="editing !== false"
      :material="editing || null"
      :chapters="materials.chapters.value"
      :scenes="materials.scenes.value"
      :default-chapter-id="chapterId"
      :default-scene-id="sceneId"
      :saving="saving"
      @close="editing = false"
      @save="saveMaterial"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Cast, Pencil, Plus, Trash2 } from '@lucide/vue'
import MaterialEditorModal from '@/features/sessions/components/MaterialEditorModal.vue'

const props = defineProps({
  materials: { type: Object, required: true },
  presentation: { type: Object, required: true },
  isDm: { type: Boolean, default: false },
  chapterId: { type: [Number, String], default: null },
  sceneId: { type: [Number, String], default: null },
})
const selectedId = ref(null)
const editing = ref(false)
const saving = ref(false)
const actionError = ref('')
const selected = computed(() => props.materials.byId(selectedId.value))
const groups = computed(() => [
  { key: 'session', label: 'Сессия', items: props.materials.grouped.value.session },
  { key: 'chapter', label: 'Главы', items: props.materials.grouped.value.chapter },
  { key: 'scene', label: 'Сценарии', items: props.materials.grouped.value.scene },
])

watch(() => props.materials.materials.value, list => {
  if (!selected.value && list[0]) selectedId.value = list[0].id
}, { immediate: true })

function contextLabel(material) {
  if (material.scope === 'chapter') return material.chapterName || 'Глава'
  if (material.scope === 'scene') return [material.chapterName, material.sceneName].filter(Boolean).join(' · ')
  return 'Вся сессия'
}

function openCreate() { editing.value = null }

async function saveMaterial(payload) {
  saving.value = true
  actionError.value = ''
  try {
    const saved = editing.value
      ? await props.materials.update(editing.value.id, payload)
      : await props.materials.create(payload)
    selectedId.value = saved.id
    editing.value = false
  } catch {
    actionError.value = 'Не удалось сохранить материал'
  } finally {
    saving.value = false
  }
}

async function removeSelected() {
  if (!selected.value || !window.confirm(`Удалить материал «${selected.value.name}»?`)) return
  actionError.value = ''
  try { await props.materials.remove(selected.value.id) } catch { actionError.value = 'Материал используется в сценарии и пока не может быть удалён' }
}
</script>

<style scoped>
.materials-workspace { position: absolute; inset: 0; display: grid; grid-template-columns: 320px minmax(0, 1fr); background-color: var(--app-canvas-bg); background-image: var(--app-canvas-pattern); background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size); }
.materials-library { min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 94%, transparent); }
.materials-library > header { display: flex; align-items: center; justify-content: space-between; padding: 19px 18px 14px; border-bottom: 1px solid var(--border); }
.materials-library header div { display: flex; flex-direction: column; gap: 2px; }.materials-library header span { color: var(--accent-soft); font-size: 9px; font-weight: 800; letter-spacing: .12em; }.materials-library header strong { color: var(--text-1); font-size: 18px; }
.materials-library button, .material-preview-actions button { display: flex; align-items: center; gap: 7px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; font: inherit; }
.materials-library > header button { padding: 7px 9px; font-size: 11px; }.materials-groups { overflow: auto; padding: 10px; }.materials-groups section { display: flex; flex-direction: column; gap: 4px; margin-bottom: 15px; }.materials-groups h3 { margin: 3px 7px; color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .11em; }
.materials-groups button { width: 100%; padding: 6px; border-color: transparent; background: transparent; text-align: left; }.materials-groups button:hover, .materials-groups button.active { border-color: var(--border); background: var(--surface-raised); }.materials-groups button.active { border-color: color-mix(in srgb, var(--accent) 48%, var(--border)); }
.materials-groups img { width: 56px; height: 42px; border-radius: 5px; object-fit: cover; }.materials-groups button > span { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.materials-groups strong, .materials-groups small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.materials-groups strong { color: var(--text-1); font-size: 12px; }.materials-groups small { color: var(--text-muted); font-size: 9px; }
.material-preview { min-width: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; padding: 32px; }.material-preview-image { width: min(900px, 86%); max-height: 65vh; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); box-shadow: 0 18px 55px color-mix(in srgb, var(--bg) 55%, transparent); }.material-preview-image img { max-width: 100%; max-height: 65vh; display: block; object-fit: contain; }.material-preview-copy { width: min(900px, 86%); display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }.material-preview-copy span { color: var(--accent-soft); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }.material-preview-copy h2 { margin: 3px 0 0; color: var(--text-1); font-size: 22px; }.material-preview-copy p { max-width: 600px; margin: 6px 0 0; color: var(--text-2); font-size: 12px; }.material-preview-actions { display: flex; gap: 7px; }.material-preview-actions button { min-height: 36px; padding: 8px 11px; font-size: 11px; white-space: nowrap; }.material-preview-actions button.primary { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }.material-preview-actions button.danger { color: var(--danger); }.materials-state { margin: auto; max-width: 260px; padding: 24px; color: var(--text-muted); font-size: 11px; text-align: center; }.materials-state--error, .material-action-error { color: var(--danger); }.material-action-error { font-size: 11px; }
@media (max-width: 780px) { .materials-workspace { grid-template-columns: 220px minmax(0, 1fr); }.material-preview { padding: 18px; }.material-preview-copy { align-items: stretch; flex-direction: column; }.material-preview-actions { flex-wrap: wrap; } }
</style>
