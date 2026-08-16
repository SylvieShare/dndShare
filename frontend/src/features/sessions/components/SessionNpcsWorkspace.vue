<template>
  <SessionLibraryWorkspace variant="npcs">
    <aside class="session-world-sidebar">
      <div class="session-world-sidebar-head">
        <div>
          <span class="session-world-eyebrow">ПЕРСОНАЖИ МАСТЕРА</span>
          <strong>NPC</strong>
        </div>
        <button v-if="isDm" type="button" class="session-world-add" title="Новый NPC" aria-label="Новый NPC" @click="openCreate">
          <UserPlus :size="16" />
        </button>
      </div>

      <label class="session-world-search">
        <Search :size="14" />
        <input v-model="query" type="search" placeholder="Найти по имени, расе или роли…" />
        <span v-if="npcs.length">{{ filteredNpcs.length }}</span>
      </label>

      <div v-if="filteredNpcs.length" class="npc-catalog">
        <button
          v-for="npc in filteredNpcs"
          :key="npc.id"
          type="button"
          class="npc-catalog-row"
          :class="{ 'npc-catalog-row--selected': npc.id === Number(selectedNpcId) }"
          :style="{ '--entity-color': npc.color }"
          @click="$emit('select-npc', npc.id)"
        >
          <img class="session-world-avatar" :src="npcImageUrl(npc)" alt="" />
          <span class="npc-catalog-copy">
            <strong>{{ npc.name }}</strong>
            <small>{{ [npc.raceName, npc.role].filter(Boolean).join(' · ') || npcPlaceSummary(npc) }}</small>
          </span>
          <span v-if="relationCount(npc)" class="npc-catalog-relations">
            {{ relationCount(npc) }}
          </span>
        </button>
      </div>
      <div v-else-if="npcs.length" class="session-world-list-empty">Никого не найдено</div>
      <div v-else class="session-world-sidebar-empty">
        <UsersRound :size="28" />
        <strong>Заготовьте важных NPC</strong>
        <span>Их можно привязать к нескольким локациям и сценариям, не создавая дубликаты.</span>
        <button v-if="isDm" type="button" @click="openCreate">Создать первого NPC</button>
      </div>
    </aside>

    <main v-if="selectedNpc" class="session-world-detail">
      <div class="npc-detail-hero" :style="{ '--entity-color': selectedNpc.color }">
        <img class="npc-detail-avatar" :src="npcImageUrl(selectedNpc)" alt="" :style="npcPortraitPosition(selectedNpc)" />
        <div class="npc-detail-heading">
          <span>NPC · {{ [selectedNpc.raceName, selectedNpc.role].filter(Boolean).join(' · ') || 'раса и роль не указаны' }}</span>
          <h2>{{ selectedNpc.name }}</h2>
          <div class="npc-detail-meta">
            <span><MapPin :size="12" />{{ attachedLocations.length }} {{ ruPlural(attachedLocations.length, 'локация', 'локации', 'локаций') }}</span>
            <span><BookOpenText :size="12" />{{ attachedScenes.length }} {{ ruPlural(attachedScenes.length, 'сценарий', 'сценария', 'сценариев') }}</span>
          </div>
        </div>
        <button v-if="isDm" type="button" class="session-world-edit-action" @click="openEdit(selectedNpc)"><Pencil :size="15" />Редактировать</button>
      </div>

      <div class="session-world-detail-scroll">
        <section class="session-world-section session-world-description">
          <div class="session-world-section-title"><span>О персонаже</span></div>
          <p v-if="selectedNpc.description">{{ selectedNpc.description }}</p>
          <button v-else-if="isDm" type="button" class="session-world-inline-empty" @click="openEdit(selectedNpc)">Добавить характер, мотивацию и заметки</button>
          <p v-else class="session-world-muted">Описание пока не добавлено.</p>
        </section>

        <div class="session-world-section-columns">
          <section class="session-world-section">
            <div class="session-world-section-title"><span>Где встретить</span><small>{{ attachedLocations.length }}</small></div>
            <div v-if="attachedLocations.length" class="session-world-compact-list">
              <button v-for="location in attachedLocations" :key="location.id" type="button" @click="$emit('open-location', location.id)">
                <span class="session-world-scene-image" :style="{ backgroundImage: `url(${sessionImageUrl(location)})` }" />
                <span><strong>{{ location.name }}</strong><small>{{ location.relationNote || locationPath(location) }}</small></span>
                <ChevronRight :size="14" />
              </button>
            </div>
            <button v-else-if="isDm" type="button" class="session-world-inline-empty" @click="openEdit(selectedNpc)">Привязать локацию</button>
            <p v-else class="session-world-muted">Локации не привязаны.</p>
          </section>

          <section class="session-world-section">
            <div class="session-world-section-title"><span>Участие в сюжете</span><small>{{ attachedScenes.length }}</small></div>
            <div v-if="attachedScenes.length" class="session-world-compact-list">
              <div v-for="scene in attachedScenes" :key="scene.id" class="session-world-scene-row">
                <span class="session-world-scene-image" :style="{ backgroundImage: `url(${sessionImageUrl(scene)})` }" />
                <span><strong>{{ scene.name }}</strong><small>{{ scene.relationNote || sceneContextLabel(scene) }}</small></span>
              </div>
            </div>
            <button v-else-if="isDm" type="button" class="session-world-inline-empty" @click="openEdit(selectedNpc)">Привязать сценарий</button>
            <p v-else class="session-world-muted">Сценарии не привязаны.</p>
          </section>
        </div>

        <section class="session-world-section">
          <div class="session-world-section-title"><span>Связи с NPC</span><small>{{ attachedNpcs.length }}</small></div>
          <div v-if="attachedNpcs.length" class="session-world-compact-list">
            <button v-for="npc in attachedNpcs" :key="npc.id" type="button" @click="$emit('select-npc', npc.id)">
              <img class="session-world-avatar" :src="npcImageUrl(npc)" alt="" />
              <span><strong>{{ npc.name }}</strong><small>{{ npc.relationNote || npc.role || 'Связанный персонаж' }}</small></span>
              <ChevronRight :size="14" />
            </button>
          </div>
          <button v-else-if="isDm" type="button" class="session-world-inline-empty" @click="openEdit(selectedNpc)">Добавить связь с NPC</button>
          <p v-else class="session-world-muted">Связей с другими NPC пока нет.</p>
        </section>
      </div>
    </main>

    <main v-else class="session-world-detail session-world-detail--empty">
      <ContactRound :size="44" />
      <strong>{{ npcs.length ? 'Выберите NPC в каталоге' : 'Здесь появятся персонажи мира' }}</strong>
      <span>Одна карточка NPC может участвовать в разных местах и эпизодах кампании.</span>
    </main>

    <div v-if="world.error.value" class="session-world-error" role="alert">{{ world.error.value }}</div>

    <NpcEditorModal
      v-if="editorOpen"
      :npc="editingNpc"
      :locations="locations"
      :locations-by-id="world.locationsById.value"
      :scenes="scenes"
      :npcs="npcs"
      :saving="world.saving.value"
      @close="closeEditor"
      @save="saveNpc"
      @delete="requestDelete"
    />
    <ConfirmDialog
      v-if="pendingDelete"
      title="Удалить NPC?"
      :message="`«${pendingDelete.name}» будет удалён из каталога и отвязан от всех локаций и сценариев.`"
      confirm-label="Удалить"
      :loading="world.saving.value"
      @cancel="pendingDelete = null"
      @confirm="deleteNpc"
    />
  </SessionLibraryWorkspace>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  BookOpenText, ChevronRight, ContactRound, MapPin, Pencil, Search, UserPlus, UsersRound,
} from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import NpcEditorModal from '@/features/sessions/components/NpcEditorModal.vue'
import SessionLibraryWorkspace from '@/features/sessions/components/SessionLibraryWorkspace.vue'
import { locationBreadcrumb, locationKind, ruPlural, sceneContextLabel } from '@/features/sessions/lib/sessionWorld'
import { npcImageUrl, sessionImageUrl } from '@/features/sessions/lib/sessionImages'

const props = defineProps({
  world: { type: Object, required: true },
  selectedNpcId: { type: [Number, String], default: null },
  isDm: { type: Boolean, default: false },
})
const emit = defineEmits(['select-npc', 'open-location'])
const query = ref('')
const editorOpen = ref(false)
const editingNpc = ref(null)
const pendingDelete = ref(null)
const npcs = computed(() => props.world.npcs.value)
const locations = computed(() => props.world.locations.value)
const scenes = computed(() => props.world.scenes.value)
const selectedNpc = computed(() => props.world.npcsById.value.get(Number(props.selectedNpcId)) || null)
const filteredNpcs = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  if (!needle) return npcs.value
  return npcs.value.filter(npc => `${npc.name} ${npc.raceName || ''} ${npc.role || ''} ${npc.description || ''}`.toLocaleLowerCase('ru').includes(needle))
})
const attachedLocations = computed(() => (selectedNpc.value?.locationLinks || []).map(link => {
  const item = props.world.locationsById.value.get(link.locationId)
  return item ? { ...item, relationNote: link.note } : null
}).filter(Boolean))
const attachedScenes = computed(() => (selectedNpc.value?.sceneLinks || []).map(link => {
  const item = props.world.scenesById.value.get(link.sceneId)
  return item ? { ...item, relationNote: link.note } : null
}).filter(Boolean))
const attachedNpcs = computed(() => (selectedNpc.value?.npcLinks || []).map(link => {
  const item = props.world.npcsById.value.get(link.npcId)
  return item ? { ...item, relationNote: link.note } : null
}).filter(Boolean))

function locationPath(location) {
  const ancestors = locationBreadcrumb(location, props.world.locationsById.value).slice(0, -1)
  return ancestors.map(item => item.name).join(' · ') || locationKind(location.kind).shortLabel
}
function npcPlaceSummary(npc) {
  const first = props.world.locationsById.value.get(npc.locationLinks?.[0]?.locationId)
  return first ? first.name : 'Без привязок'
}
function relationCount(npc) { return (npc.locationLinks?.length || 0) + (npc.sceneLinks?.length || 0) + (npc.npcLinks?.length || 0) }
function npcPortraitPosition(npc) { return { objectPosition: `${(npc.imageFocalX ?? .5) * 100}% ${(npc.imageFocalY ?? .5) * 100}%` } }
function openCreate() { editingNpc.value = null; editorOpen.value = true }
function openEdit(npc) { editingNpc.value = npc; editorOpen.value = true }
function closeEditor() { editorOpen.value = false; editingNpc.value = null }
async function saveNpc(data) {
  const previous = editingNpc.value
  try {
    const id = await props.world.saveNpc(previous, data)
    closeEditor()
    emit('select-npc', id || previous?.id)
  } catch { /* error is rendered */ }
}
function requestDelete(npc) { editorOpen.value = false; pendingDelete.value = npc }
async function deleteNpc() {
  const npc = pendingDelete.value
  if (!npc) return
  try {
    await props.world.removeNpc(npc.id)
    pendingDelete.value = null
    emit('select-npc', npcs.value[0]?.id || null)
  } catch { /* error is rendered */ }
}
</script>
