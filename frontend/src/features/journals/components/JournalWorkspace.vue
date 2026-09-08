<template>
  <section class="journal-workspace" :class="{ 'journal-workspace--session': sessionUuid }">
    <div v-if="loading" class="journal-state"><BookMarked :size="30" /><span>Открываем летопись…</span></div>
    <template v-else>
      <header class="journal-cover">
        <div class="journal-cover-icon"><BookMarked :size="27" /></div>
        <div class="journal-cover-copy">
          <span class="journal-kicker">{{ journal?.kind === 'session' || sessionUuid ? 'Дневник кампании' : 'Личный дневник' }}</span>
          <h2>{{ journal?.name || 'Начало вашей истории' }}</h2>

        </div>
        <div class="journal-cover-controls">
          <JournalSourceSwitch v-if="canSelectSource" :journal="journal" :sources="sources" :busy="locked"
            @select="uuid => selectSource(uuid).catch(() => {})" @create-personal="createJournal" />
          <ToggleSwitch v-if="sessionUuid && canManage && journal.kind === 'session'" :model-value="journal.playersCanEdit" :disabled="locked"
            label="Игроки могут редактировать дневник" @update:model-value="value => setPlayerEditing(value).catch(() => {})" />
        </div>
        <slot name="actions" :blocked="locked" />
      </header>
      <template v-if="journal">
        <div class="journal-section-navigation"><JournalSectionTabs :sections="sections" :selected-id="selectedId" :editable="canEdit" :disabled="locked"
          @select="selectedId = $event" @create="openSection()" /><JournalEditButton v-if="canEdit && selectedSection" label="Редактировать раздел" :disabled="locked" @click="openSection(selectedSection)" /></div>
        <p v-if="editingId" class="journal-edit-hint">Сохраните правку или отмените её, чтобы переключить раздел.</p>
        <p v-else-if="!canEdit && journal.kind === 'session'" class="journal-edit-hint">Только чтение · записи добавляет мастер</p>
        <p v-if="error" class="journal-error" role="alert">{{ error }}</p>
        <JournalGraphWorkspace v-if="selectedSection" :key="journal.uuid" :journal="journal" :section-id="selectedId"
          :editable="canEdit" :busy="busy" :update-graph="updateGraph" :create-entry="createEntry" :save-entry="updateEntry" :remove-entry="deleteEntry"
          @section="selectedId = $event" @editing="setEditing" @dragging="setInteracting" />
        <div v-else class="journal-blank"><Feather :size="26" /><strong>Первая глава ещё впереди</strong><span>{{ canEdit ? 'Нажмите «Новый раздел», чтобы начать летопись.' : 'Мастер пока не добавил разделы.' }}</span></div>
      </template>
      <template v-else>
        <FormTextInput v-if="sessionUuid || canSelectSource" v-model:value="newJournalName" class="journal-name-input" :disabled="busy"
          aria-label="Название дневника" placeholder="Название дневника (необязательно)" :maxlength="160" />
        <button v-if="sessionUuid || canSelectSource" class="journal-start" type="button" :disabled="busy" @click="createJournal">
          <Plus :size="16" />{{ sessionUuid ? 'Создать дневник кампании' : 'Создать личный дневник' }}
        </button>
        <p v-if="error" class="journal-error" role="alert">{{ error }}</p>
      </template>
    </template>
    <DndDiarySessionModal :z-index="3600" v-if="sectionDraft" :session="sectionDraft" :mode="creatingSection ? 'create' : 'edit'" :busy="busy"
      :title-placeholder="`Раздел ${sections.length + 1}`" @update="patch => sectionDraft = patchSession(sectionDraft, patch)"
      @save="saveSection" @close="sectionDraft = null" @remove="removingSection = sectionDraft" />
    <ConfirmDialog v-if="removingSection" title="Удалить раздел?" :loading="busy" :z-index="3700"
      :message="`«${removingSection.title || 'Без названия'}» и все его записи будут удалены для всех участников.`"
      confirm-label="Удалить" @confirm="removeSection" @cancel="removingSection = null" />
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BookMarked, Feather, Plus } from '@lucide/vue'
import { ConfirmDialog, FormTextInput, ToggleSwitch } from '@sylvieshare/share-ui'
import JournalGraphWorkspace from './JournalGraphWorkspace.vue'
import JournalEditButton from './JournalEditButton.vue'
import DndDiarySessionModal from '@/features/character-editor/blocks/dnd/components/DndDiarySessionModal.vue'
import { defaultSession, normalizeSession, patchSession } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'
import { useJournalWorkspace } from '../composables/useJournalWorkspace'
import { useJournalSectionSelection } from '../composables/useJournalSectionSelection'
import JournalSourceSwitch from './JournalSourceSwitch.vue'
import JournalSectionTabs from './JournalSectionTabs.vue'
const emit = defineEmits(['blocking'])
const props = defineProps({ characterUuid: { type: String, default: '' }, sessionUuid: { type: String, default: '' } })
const { journal, sources, canEdit, canManage, canSelectSource, loading, busy, error,
  createRoot, selectSource, createSection, updateSection, removeSection: deleteSection,
  createEntry, updateEntry, removeEntry: deleteEntry, updateGraph, setPlayerEditing, setDragging, setInlineEditing,
} = useJournalWorkspace({ characterUuid: props.characterUuid, sessionUuid: props.sessionUuid })
const sections = computed(() => journal.value?.sections || [])
const { selectedId, selectedSection } = useJournalSectionSelection(journal)
const sectionDraft = ref(null)
const newJournalName = ref('')
const creatingSection = ref(false)
const removingSection = ref(null)
const editingId = ref('')
const interacting = ref(false)
const locked = computed(() => busy.value || interacting.value || Boolean(editingId.value))
function setEditing(id) { editingId.value = id; setInlineEditing(Boolean(id)) }
function setInteracting(value) { interacting.value = value; setDragging(value) }
watch(locked, value => emit('blocking', value), { immediate: true })

async function createJournal() { await createRoot(newJournalName.value).then(() => { newJournalName.value = '' }).catch(() => {}) }
function openSection(section) {
  if (locked.value || !canEdit.value) return
  creatingSection.value = !section
  sectionDraft.value = section ? normalizeSession(section) : defaultSession()
}
async function saveSection() {
  if (busy.value) return
  const before = new Set(sections.value.map(section => section.id))
  try {
    await (creatingSection.value ? createSection(sectionDraft.value) : updateSection(sectionDraft.value))
    if (creatingSection.value) selectedId.value = sections.value.find(section => !before.has(section.id))?.id || selectedId.value
    sectionDraft.value = null
  } catch { /* Keep the draft and API error. */ }
}
async function removeSection() {
  await deleteSection(removingSection.value.id).then(() => { removingSection.value = null; sectionDraft.value = null }).catch(() => {})
}
watch(() => journal.value?.uuid, () => { sectionDraft.value = null; removingSection.value = null; editingId.value = ''; setInlineEditing(false) })
watch(canEdit, allowed => { if (!allowed) { sectionDraft.value = null; removingSection.value = null } })
function beforeUnload(event) { if (editingId.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>
<style scoped src="./JournalWorkspace.css"></style>
