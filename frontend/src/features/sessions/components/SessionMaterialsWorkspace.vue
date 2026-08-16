<template>
  <SessionLibraryWorkspace variant="materials">
    <aside class="session-world-sidebar">
      <div class="session-world-sidebar-head">
        <div><span class="session-world-eyebrow">ЭКРАН ИГРОКОВ</span><strong>Материалы</strong></div>
        <button v-if="isDm" type="button" class="session-world-add" title="Новый материал" aria-label="Новый материал" @click="openCreate"><Plus :size="16" /></button>
      </div>
      <label class="session-world-search">
        <Search :size="14" />
        <input v-model="query" type="search" placeholder="Найти материал…" />
        <span v-if="allMaterials.length">{{ filteredCount }}</span>
      </label>
      <div v-if="materials.loading.value" class="materials-state">Загружаем материалы…</div>
      <div v-else-if="materials.error.value" class="materials-state materials-state--error">{{ materials.error.value }}</div>
      <div v-else-if="!allMaterials.length" class="session-world-sidebar-empty">
        <LibraryBig :size="28" /><strong>Соберите материалы</strong>
        <span>Картинки, видео, тексты, записки и карты можно показывать игрокам одним действием.</span>
        <button v-if="isDm" type="button" @click="openCreate">Добавить первый материал</button>
      </div>
      <div v-else class="materials-groups">
        <section v-for="group in groups" :key="group.key" v-show="group.items.length">
          <h3>{{ group.label }}</h3>
          <button v-for="material in group.items" :key="material.id" type="button" :class="{ active: selected?.id === material.id }" @click="selectedId = material.id">
            <span class="material-list-thumb" :class="`material-list-thumb--${material.kind}`">
              <img v-if="material.kind === 'image' || material.kind === 'map'" :src="material.assetUrl" alt="" />
              <component :is="materialType(material.kind).icon" v-else :size="19" />
            </span>
            <span class="material-list-copy"><strong>{{ material.name }}</strong><small>{{ materialType(material.kind).label }} · {{ contextLabel(material) }}</small></span>
          </button>
        </section>
        <div v-if="query && !filteredCount" class="session-world-list-empty">Ничего не найдено</div>
      </div>
    </aside>

    <main v-if="selected" class="session-world-detail material-preview">
      <div class="material-preview-stage" :class="[`material-preview-stage--${selected.kind}`, selected.kind === 'note' ? `material-note--${selected.noteStyle}` : '']">
        <img v-if="selected.kind === 'image' || selected.kind === 'map'" :src="selected.assetUrl" :alt="selected.name" />
        <video v-else-if="selected.kind === 'video'" :src="selected.assetUrl" controls playsinline preload="metadata" />
        <article v-else class="material-copy-content">{{ selected.content }}</article>
      </div>
      <div class="material-preview-copy">
        <div>
          <span>{{ materialType(selected.kind).label }} · {{ contextLabel(selected) }}</span>
          <h2>{{ selected.name }}</h2>
          <p v-if="selected.caption">{{ selected.caption }}</p>
        </div>
        <div class="material-preview-actions">
          <button type="button" class="primary" @click="presentation.showMaterial(selected)"><Cast :size="16" />Транслировать</button>
          <button v-if="isDm" type="button" @click="editing = selected"><Pencil :size="15" />Изменить</button>
          <button v-if="isDm" type="button" class="danger" title="Удалить" aria-label="Удалить материал" @click="removeSelected"><Trash2 :size="15" /></button>
        </div>
      </div>
      <span v-if="actionError" class="material-action-error">{{ actionError }}</span>
    </main>
    <main v-else class="session-world-detail session-world-detail--empty">
      <LibraryBig :size="44" /><strong>{{ allMaterials.length ? 'Выберите материал в списке' : 'Здесь появится библиотека показа' }}</strong>
      <span>Материал можно подготовить один раз и использовать в сценах или отправлять на экран вручную.</span>
    </main>

    <MaterialEditorModal v-if="editing !== false" :material="editing || null" :chapters="materials.chapters.value" :scenes="materials.scenes.value" :default-chapter-id="chapterId" :default-scene-id="sceneId" :saving="saving" @close="editing = false" @save="saveMaterial" />
  </SessionLibraryWorkspace>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Cast, LibraryBig, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import MaterialEditorModal from '@/features/sessions/components/MaterialEditorModal.vue'
import SessionLibraryWorkspace from '@/features/sessions/components/SessionLibraryWorkspace.vue'
import { MATERIAL_TYPES, materialType } from '@/features/sessions/lib/sessionMaterials'

const props = defineProps({
  materials: { type: Object, required: true }, presentation: { type: Object, required: true },
  isDm: { type: Boolean, default: false }, chapterId: { type: [Number, String], default: null }, sceneId: { type: [Number, String], default: null },
})
const selectedId = ref(null)
const editing = ref(false)
const saving = ref(false)
const actionError = ref('')
const query = ref('')
const allMaterials = computed(() => props.materials.materials.value)
const selected = computed(() => props.materials.byId(selectedId.value))
const chaptersById = computed(() => new Map(props.materials.chapters.value.map(chapter => [Number(chapter.id), chapter])))
const scenesById = computed(() => new Map(props.materials.scenes.value.map(scene => [Number(scene.id), scene])))
const matches = material => `${material.name} ${material.caption || ''} ${material.content || ''}`.toLocaleLowerCase('ru').includes(query.value.trim().toLocaleLowerCase('ru'))
const groups = computed(() => MATERIAL_TYPES.map(type => ({
  key: type.key,
  label: type.label,
  items: allMaterials.value.filter(material => material.kind === type.key && matches(material)),
})))
const filteredCount = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0))

watch(allMaterials, list => { if (!selected.value && list[0]) selectedId.value = list[0].id }, { immediate: true })
function contextLabel(material) {
  const chapterLinks = material.chapterLinks || []
  const sceneLinks = material.sceneLinks || []
  const count = chapterLinks.length + sceneLinks.length
  if (!count) return 'Вся сессия'
  if (count === 1 && chapterLinks.length) return chaptersById.value.get(Number(chapterLinks[0].chapterId))?.name || 'Глава'
  if (count === 1) {
    const scene = scenesById.value.get(Number(sceneLinks[0].sceneId))
    const chapter = scene ? chaptersById.value.get(Number(scene.chapterId)) : null
    return [chapter?.name, scene?.name].filter(Boolean).join(' · ') || 'Сценарий'
  }
  const word = count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'связи' : 'связей'
  return `${count} ${word}`
}
function openCreate() { editing.value = null }
async function saveMaterial(payload) {
  saving.value = true; actionError.value = ''
  try {
    const saved = editing.value ? await props.materials.update(editing.value.id, payload) : await props.materials.create(payload)
    selectedId.value = saved.id; editing.value = false
  } catch { actionError.value = 'Не удалось сохранить материал' } finally { saving.value = false }
}
async function removeSelected() {
  if (!selected.value || !window.confirm(`Удалить материал «${selected.value.name}»?`)) return
  actionError.value = ''
  try { await props.materials.remove(selected.value.id) } catch { actionError.value = 'Материал используется в сценарии и пока не может быть удалён' }
}
</script>

<style scoped>
.materials-groups { min-height: 0; flex: 1; overflow: auto; padding: 1px 2px 10px; }.materials-groups section { display: flex; flex-direction: column; gap: 3px; margin-bottom: 13px; }.materials-groups h3 { margin: 4px 7px; color: var(--text-muted); font-size: 8px; text-transform: uppercase; letter-spacing: .11em; }.materials-groups button { width: 100%; min-width: 0; display: flex; align-items: center; gap: 9px; padding: 6px 7px; border: 0; border-radius: 9px; background: transparent; color: var(--text-2); text-align: left; cursor: pointer; }.materials-groups button:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); }.materials-groups button.active { background: color-mix(in srgb, var(--accent) 13%, transparent); }
.material-list-thumb { width: 48px; height: 40px; display: grid; flex: none; place-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--accent-soft); }.material-list-thumb img { width: 100%; height: 100%; object-fit: cover; }.material-list-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 2px; }.material-list-copy strong, .material-list-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.material-list-copy strong { color: var(--text-1); font-size: 12px; }.material-list-copy small { color: var(--text-muted); font-size: 9px; }
.material-preview { align-items: center; justify-content: center; gap: 16px; padding: 28px; overflow-y: auto; }.material-preview-stage { width: min(900px, 92%); max-height: 66vh; display: grid; place-items: center; overflow: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); box-shadow: 0 18px 55px color-mix(in srgb, var(--bg) 55%, transparent); }.material-preview-stage img, .material-preview-stage video { max-width: 100%; max-height: 66vh; display: block; object-fit: contain; }.material-preview-stage video { width: 100%; }.material-copy-content { box-sizing: border-box; width: 100%; min-height: 280px; padding: clamp(28px, 5vw, 72px); color: var(--text-1); font-family: var(--font-display); font-size: clamp(19px, 2vw, 31px); line-height: 1.65; white-space: pre-wrap; }.material-preview-stage--note { max-width: 720px; border-radius: 5px; }.material-note--parchment { background: var(--material-note-parchment-bg); color: var(--material-note-parchment-text); }.material-note--letter { background: var(--material-note-letter-bg); color: var(--material-note-letter-text); }.material-note--dossier { background: var(--material-note-dossier-bg); color: var(--material-note-dossier-text); box-shadow: inset 0 0 0 8px var(--material-note-dossier-border), var(--shadow-lg); }.material-note--arcane { border-color: color-mix(in srgb, var(--accent) 65%, var(--border)); background: radial-gradient(circle at 50% 20%, var(--material-note-arcane-glow), var(--material-note-arcane-bg) 72%); color: var(--material-note-arcane-text); }.material-note--parchment .material-copy-content, .material-note--letter .material-copy-content, .material-note--dossier .material-copy-content, .material-note--arcane .material-copy-content { color: inherit; }
.material-preview-copy { width: min(900px, 92%); display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }.material-preview-copy > div:first-child { min-width: 0; }.material-preview-copy span { color: var(--accent-soft); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }.material-preview-copy h2 { margin: 3px 0 0; color: var(--text-1); font-size: 22px; }.material-preview-copy p { max-width: 600px; margin: 6px 0 0; color: var(--text-2); font-size: 12px; }.material-preview-actions { display: flex; flex: none; gap: 7px; }.material-preview-actions button { min-height: 36px; display: flex; align-items: center; gap: 7px; padding: 8px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; font: inherit; font-size: 11px; white-space: nowrap; }.material-preview-actions button.primary { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }.material-preview-actions button.danger, .materials-state--error, .material-action-error { color: var(--danger); }.materials-state { margin: auto; max-width: 260px; padding: 24px; color: var(--text-muted); font-size: 11px; text-align: center; }.material-action-error { font-size: 11px; }
@media (max-width: 840px) { .material-preview { padding: 18px; }.material-preview-copy { align-items: stretch; flex-direction: column; }.material-preview-actions { flex-wrap: wrap; } }
</style>
