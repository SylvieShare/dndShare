<template>
  <section class="journal-workspace" :class="{ 'journal-workspace--session': sessionUuid }">
    <LoadingState v-if="loading" class="journal-state" label="Открываем летопись…" />
    <template v-else>
      <BaseTile class="journal-header">
        <header class="journal-cover">
          <div class="journal-cover-icon"><BookMarked :size="27" /></div>
          <div class="journal-cover-copy">
            <span class="journal-kicker">{{ journal?.kind === 'session' || sessionUuid ? 'Дневник кампании' : 'Личный дневник' }}</span>
            <h2>{{ journal?.name || 'Начало вашей истории' }}</h2>
          </div>
          <div v-if="showSourceSwitch || (sessionUuid && canManage && journal)" class="journal-cover-controls">
            <JournalSourceSwitch v-if="showSourceSwitch" :journal="journal" :sources="sources" :busy="locked"
              @select="uuid => selectSource(uuid).catch(() => {})" @create-personal="createJournal" />
            <ToggleSwitch v-if="sessionUuid && canManage && journal.kind === 'session'" :model-value="journal.playersCanEdit" :disabled="locked"
              label="Игроки могут редактировать дневник" @update:model-value="value => setPlayerEditing(value).catch(() => {})" />
          </div>
        </header>
        <JournalScheduleLink v-if="campaignUuid" :session-uuid="campaignUuid" :section="selectedSection" @schedule="$emit('schedule')" />
        <JournalSectionTabs v-if="journal" :sections="sections" :selected-id="selectedId" :editable="canEdit && !campaignUuid" :disabled="locked"
          @select="selectedId = $event" @create="openSection()" />
      </BaseTile>
      <template v-if="journal">
        <p v-if="editingId" class="journal-edit-hint">Сохраните правку или отмените её, чтобы переключить раздел.</p>
        <p v-else-if="!canEdit && journal.kind === 'session'" class="journal-edit-hint">Только чтение · записи добавляет мастер</p>
        <p v-if="error" class="journal-error" role="alert">{{ error }}</p>
        <JournalTimeline v-if="selectedSection" :key="`${journal.uuid}:${selectedSection.id}`"
          :session="selectedSection" :owner-mode="canEdit" :editable-section="!campaignUuid" :busy="busy" :editing-id="editingId" :focus-event-id="focusEventId"
          :save-event="updateEntry" @edit-session="openSection(selectedSection)" @create-event="createEvent"
          @remove-event="removingEvent = $event" @editing="setEditing" @dragging="setInteracting"
          @reorder-events="ids => reorderEntries(selectedSection.id, ids).catch(() => {})" />
        <div v-else class="journal-blank"><Feather :size="26" /><strong>Первая глава ещё впереди</strong><span>{{ campaignUuid ? 'Разделы дневника появляются вместе с сессиями кампании.' : canEdit ? 'Нажмите «Новый раздел», чтобы начать летопись.' : 'Мастер пока не добавил разделы.' }}</span></div>
      </template>
      <template v-else>
        <p v-if="sessionUuid" class="journal-edit-hint">Дневник появится автоматически, когда мастер создаст сессию в календаре кампании.</p>
        <p v-if="error" class="journal-error" role="alert">{{ error }}</p>
        <button v-if="characterUuid && error" class="journal-start" type="button" :disabled="busy" @click="load()">Повторить загрузку</button>
      </template>
    </template>
    <DndDiarySessionModal v-if="sectionDraft" :z-index="3600" :session="sectionDraft" :mode="creatingSection ? 'create' : 'edit'" :busy="busy"
      :title-placeholder="`Раздел ${sections.length + 1}`" @update="patch => sectionDraft = patchSession(sectionDraft, patch)"
      @save="saveSection" @close="sectionDraft = null" @remove="removingSection = sectionDraft" />
    <ConfirmDialog v-if="removingSection" title="Удалить раздел?" :loading="busy" :z-index="3700"
      :message="`«${removingSection.title || 'Без названия'}» и все его записи будут удалены для всех участников.`"
      confirm-label="Удалить" @confirm="removeSection" @cancel="removingSection = null" />
    <ConfirmDialog v-if="removingEvent" title="Удалить событие?" :loading="busy" :z-index="3700"
      :message="`«${removingEvent.title || 'Без названия'}» будет удалено из дневника для всех участников.`"
      confirm-label="Удалить" @confirm="removeEvent" @cancel="removingEvent = null" />
  </section>
</template>
<script setup>
import { LoadingState } from '@sylvieshare/share-ui'
import { computed, ref, watch } from 'vue'
import { BookMarked, Feather } from '@lucide/vue'
import { BaseTile, ConfirmDialog, ToggleSwitch } from '@sylvieshare/share-ui'
import JournalTimeline from './JournalTimeline.vue'
import DndDiarySessionModal from '@/features/character-editor/blocks/dnd/components/DndDiarySessionModal.vue'
import { defaultSession, normalizeSession, patchSession } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'
import { useJournalWorkspace } from '../composables/useJournalWorkspace'
import { useJournalSectionSelection } from '../composables/useJournalSectionSelection'
import JournalSourceSwitch from './JournalSourceSwitch.vue'
import JournalSectionTabs from './JournalSectionTabs.vue'
import JournalScheduleLink from './JournalScheduleLink.vue'
import { useJournalEntries } from '../composables/useJournalEntries'
const props = defineProps({ characterUuid: { type: String, default: '' }, sessionUuid: { type: String, default: '' }, occurrenceId: { type: Number, default: null } })
defineEmits(['schedule'])
const workspace = useJournalWorkspace({ characterUuid: props.characterUuid, sessionUuid: props.sessionUuid })
const { journal, sources, canEdit, canManage, canSelectSource, loading, busy, error,
  load, createRoot, selectSource, createSection, updateSection, removeSection: deleteSection,
  updateEntry, setPlayerEditing, reorderEntries,
} = workspace
const sections = computed(() => journal.value?.sections || [])
const campaignUuid = computed(() => journal.value?.sessionUuid || props.sessionUuid)
const showSourceSwitch = computed(() => canSelectSource.value && sources.value.some(source => source.kind === 'session'))
const { selectedId, selectedSection } = useJournalSectionSelection(journal)
const sectionDraft = ref(null)
const creatingSection = ref(false)
const removingSection = ref(null)
const { editingId, focusEventId, removingEvent, locked, setEditing, setDragging: setInteracting, createEvent, removeEvent } = useJournalEntries(workspace, selectedSection)
async function createJournal() { await createRoot('').catch(() => {}) }
function openSection(section) {
  if (locked.value || !canEdit.value || campaignUuid.value) return
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
watch(() => journal.value?.uuid, () => { sectionDraft.value = null; removingSection.value = null })
watch([() => props.occurrenceId, () => journal.value?.uuid], () => {
  const section = sections.value.find(section => section.occurrenceId === props.occurrenceId)
  if (section) selectedId.value = section.id
}, { flush: 'post' })
watch(canEdit, allowed => { if (!allowed) { sectionDraft.value = null; removingSection.value = null } })
</script>
<style scoped src="./JournalWorkspace.css"></style>
