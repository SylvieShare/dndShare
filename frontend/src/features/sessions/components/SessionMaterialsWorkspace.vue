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
		  <button v-for="material in group.items" :key="material.id" type="button" :class="{ active: selected?.id === material.id }" @click="pickMaterial(material.id)">
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

    <SessionEntityDetail
      v-if="selected"
      :title="selected.name"
      :eyebrow="materialType(selected.kind).label"
      :accent="materialType(selected.kind).color"
      :editable="isDm"
      edit-aria-label="Редактировать материал"
      @edit="editing = selected"
    >
      <template #visual><component :is="materialType(selected.kind).icon" :size="32" /></template>
      <template v-if="selected.caption" #summary>{{ selected.caption }}</template>
      <template #meta><span>{{ contextLabel(selected) }}</span><span>{{ selected.relations?.length || 0 }} связей</span></template>
      <template #actions-before><button type="button" class="primary" @click="presentation.showMaterial(selected)"><Cast :size="16" />Транслировать</button></template>
      <template v-if="isDm" #actions-after><button type="button" class="danger" title="Удалить" aria-label="Удалить материал" @click="removeSelected"><Trash2 :size="15" /></button></template>

      <section class="session-world-section material-preview-section">
        <div class="session-world-section-title"><span>Просмотр</span></div>
        <div class="material-preview-stage" :class="[`material-preview-stage--${selected.kind}`, selected.kind === 'note' ? `material-note--${selected.noteStyle}` : '']">
          <img v-if="selected.kind === 'image' || selected.kind === 'map'" :src="selected.assetUrl" :alt="selected.name" />
          <video v-else-if="selected.kind === 'video'" :src="selected.assetUrl" controls playsinline preload="metadata" />
          <article v-else class="material-copy-content">{{ selected.content }}</article>
        </div>
      </section>
      <section class="session-world-section">
        <div class="session-world-section-title"><span>Связи</span><small>{{ selected.relations?.length || 0 }}</small></div>
        <UniversalRelationList :relations="selected.relations" :items="relationItems" @open="openRelated" />
      </section>
      <span v-if="actionError" class="material-action-error">{{ actionError }}</span>
    </SessionEntityDetail>
    <main v-else class="session-world-detail session-world-detail--empty">
      <LibraryBig :size="44" /><strong>{{ allMaterials.length ? 'Выберите материал в списке' : 'Здесь появится библиотека показа' }}</strong>
      <span>Материал можно подготовить один раз и использовать в сценах или отправлять на экран вручную.</span>
    </main>

	<MaterialEditorModal v-if="editing !== false" :material="editing || null" :relation-items="relationItems" :saving="saving" @close="editing = false" @save="saveMaterial" />
  </SessionLibraryWorkspace>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Cast, LibraryBig, Plus, Search, Trash2 } from '@lucide/vue'
import MaterialEditorModal from '@/features/sessions/components/MaterialEditorModal.vue'
import SessionEntityDetail from '@/features/sessions/components/SessionEntityDetail.vue'
import SessionLibraryWorkspace from '@/features/sessions/components/SessionLibraryWorkspace.vue'
import UniversalRelationList from '@/features/sessions/components/UniversalRelationList.vue'
import { MATERIAL_TYPES, materialType } from '@/features/sessions/lib/sessionMaterials'

const props = defineProps({
  materials: { type: Object, required: true }, presentation: { type: Object, required: true },
	isDm: { type: Boolean, default: false },
	world: { type: Object, required: true }, relationItems: { type: Array, default: () => [] }, selectedMaterialId: { type: [Number, String], default: null },
})
const emit = defineEmits(['open-entity', 'select-material'])
const selectedId = ref(null)
const editing = ref(false)
const saving = ref(false)
const actionError = ref('')
const query = ref('')
const allMaterials = computed(() => props.materials.materials.value)
const selected = computed(() => props.materials.byId(selectedId.value))
const matches = material => `${material.name} ${material.caption || ''} ${material.content || ''}`.toLocaleLowerCase('ru').includes(query.value.trim().toLocaleLowerCase('ru'))
const groups = computed(() => MATERIAL_TYPES.map(type => ({
  key: type.key,
  label: type.label,
  items: allMaterials.value.filter(material => material.kind === type.key && matches(material)),
})))
const filteredCount = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0))

watch([allMaterials, () => props.selectedMaterialId], ([list, routeId]) => {
	const candidate = list.find(item => item.id === Number(routeId)) || list[0]
	if (candidate) selectedId.value = candidate.id
}, { immediate: true })
function contextLabel(material) {
	const sceneLinks = (material.relations || []).filter(relation => relation.type === 'scene')
	const count = sceneLinks.length
  if (!count) return 'Вся сессия'
  if (count === 1) {
		const scene = props.world.scenesById.value.get(Number(sceneLinks[0].id))
		return [scene?.chapterName, scene?.name].filter(Boolean).join(' · ') || 'Сценарий'
  }
  const word = count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'связи' : 'связей'
  return `${count} ${word}`
}
function openCreate() { editing.value = null }
function pickMaterial(id) { selectedId.value = id; emit('select-material', id) }
function openRelated(item) {
	if (item.type === 'material') pickMaterial(item.id)
	else emit('open-entity', item)
}
async function saveMaterial(payload) {
  saving.value = true; actionError.value = ''
	try {
    const saved = editing.value ? await props.materials.update(editing.value.id, payload) : await props.materials.create(payload)
		await props.world.load(true).catch(() => {})
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
.material-preview-section { align-items: stretch; }.material-preview-stage { width: min(900px, 100%); max-height: 58vh; display: grid; align-self: center; place-items: center; overflow: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); box-shadow: 0 18px 55px color-mix(in srgb, var(--bg) 55%, transparent); }.material-preview-stage img, .material-preview-stage video { max-width: 100%; max-height: 58vh; display: block; object-fit: contain; }.material-preview-stage video { width: 100%; }.material-copy-content { box-sizing: border-box; width: 100%; min-height: 280px; padding: clamp(28px, 5vw, 72px); color: var(--text-1); font-family: var(--font-display); font-size: clamp(19px, 2vw, 31px); line-height: 1.65; white-space: pre-wrap; }.material-preview-stage--note { max-width: 720px; border-radius: 5px; }.material-note--parchment { background: var(--material-note-parchment-bg); color: var(--material-note-parchment-text); }.material-note--letter { background: var(--material-note-letter-bg); color: var(--material-note-letter-text); }.material-note--dossier { background: var(--material-note-dossier-bg); color: var(--material-note-dossier-text); box-shadow: inset 0 0 0 8px var(--material-note-dossier-border), var(--shadow-lg); }.material-note--arcane { border-color: color-mix(in srgb, var(--accent) 65%, var(--border)); background: radial-gradient(circle at 50% 20%, var(--material-note-arcane-glow), var(--material-note-arcane-bg) 72%); color: var(--material-note-arcane-text); }.material-note--parchment .material-copy-content, .material-note--letter .material-copy-content, .material-note--dossier .material-copy-content, .material-note--arcane .material-copy-content { color: inherit; }
.materials-state--error, .material-action-error { color: var(--danger); }.materials-state { margin: auto; max-width: 260px; padding: 24px; color: var(--text-muted); font-size: 11px; text-align: center; }.material-action-error { font-size: 11px; }
</style>
