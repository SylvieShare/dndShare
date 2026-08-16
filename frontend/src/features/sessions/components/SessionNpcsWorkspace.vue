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
        <kbd v-if="showShortcutHints" class="session-world-list-navigation-hint">↑ ↓</kbd>
        <span v-if="npcs.length">{{ filteredNpcs.length }}</span>
      </label>

      <div v-if="filteredNpcs.length" ref="listElement" class="npc-catalog">
        <button
          v-for="npc in filteredNpcs"
          :key="npc.id"
          type="button"
          class="npc-catalog-row"
		  :data-session-list-id="npc.id"
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

    <SessionEntityDetail
      v-if="selectedNpc"
      :title="selectedNpc.name"
      :eyebrow="`NPC · ${[selectedNpc.raceName, selectedNpc.role].filter(Boolean).join(' · ') || 'раса и роль не указаны'}`"
      :accent="selectedNpc.color"
      :editable="isDm"
      edit-aria-label="Редактировать NPC"
      @edit="openEdit(selectedNpc)"
    >
      <template #visual><img :src="npcImageUrl(selectedNpc)" alt="" :style="npcPortraitPosition(selectedNpc)" /></template>
      <template #meta><span><MapPin :size="12" />{{ selectedNpc.relations?.length || 0 }} связей</span></template>

      <section class="session-world-section session-world-description">
        <div class="session-world-section-title"><span>О персонаже</span></div>
        <p v-if="selectedNpc.description">{{ selectedNpc.description }}</p>
        <button v-else-if="isDm" type="button" class="session-world-inline-empty" @click="openEdit(selectedNpc)">Добавить характер, мотивацию и заметки</button>
        <p v-else class="session-world-muted">Описание пока не добавлено.</p>
      </section>

      <section class="session-world-section">
        <div class="session-world-section-title"><span>Связи</span><small>{{ selectedNpc.relations?.length || 0 }}</small></div>
        <UniversalRelationList :relations="selectedNpc.relations" :items="relationItems" @open="openRelated" />
      </section>
    </SessionEntityDetail>

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
      :npcs="npcs"
      :saving="world.saving.value"
	  :relation-items="relationItems"
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
	ContactRound, MapPin, Search, UserPlus, UsersRound,
} from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import NpcEditorModal from '@/features/sessions/components/NpcEditorModal.vue'
import SessionEntityDetail from '@/features/sessions/components/SessionEntityDetail.vue'
import SessionLibraryWorkspace from '@/features/sessions/components/SessionLibraryWorkspace.vue'
import UniversalRelationList from '@/features/sessions/components/UniversalRelationList.vue'
import { npcImageUrl } from '@/features/sessions/lib/sessionImages'
import { adjacentSessionListItemId, scrollSessionListItemIntoView } from '@/features/sessions/lib/sessionListNavigation'

const props = defineProps({
  world: { type: Object, required: true },
  selectedNpcId: { type: [Number, String], default: null },
  isDm: { type: Boolean, default: false },
	relationItems: { type: Array, default: () => [] },
	showShortcutHints: { type: Boolean, default: false },
})
const emit = defineEmits(['select-npc', 'open-location', 'open-entity'])
const query = ref('')
const editorOpen = ref(false)
const editingNpc = ref(null)
const pendingDelete = ref(null)
const listElement = ref(null)
const npcs = computed(() => props.world.npcs.value)
const locations = computed(() => props.world.locations.value)
const selectedNpc = computed(() => props.world.npcsById.value.get(Number(props.selectedNpcId)) || null)
const filteredNpcs = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  if (!needle) return npcs.value
  return npcs.value.filter(npc => `${npc.name} ${npc.raceName || ''} ${npc.role || ''} ${npc.description || ''}`.toLocaleLowerCase('ru').includes(needle))
})

function npcPlaceSummary(npc) {
	const locationLink = npc.relations?.find(relation => relation.type === 'location')
	const first = props.world.locationsById.value.get(locationLink?.id)
  return first ? first.name : 'Без привязок'
}
function relationCount(npc) { return npc.relations?.length || 0 }
function openRelated(item) {
	if (item.type === 'location') emit('open-location', item.id)
	else if (item.type === 'npc') emit('select-npc', item.id)
	else emit('open-entity', item)
}
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

function moveSelection(direction) {
	const id = adjacentSessionListItemId(filteredNpcs.value, props.selectedNpcId, direction)
	if (id == null) return
	if (String(id) !== String(props.selectedNpcId)) emit('select-npc', id)
	scrollSessionListItemIntoView(listElement.value, id)
}

defineExpose({ moveSelection })
</script>
