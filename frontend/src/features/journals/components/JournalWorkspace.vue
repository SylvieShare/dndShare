<template>
  <section class="journal-workspace" :class="{ 'journal-workspace--session': sessionUuid }">
    <div v-if="loading" class="journal-state">
      <BookMarked :size="30" />
      <span>Открываем летопись…</span>
    </div>

    <JournalSourceSwitch
      v-if="!loading && canSelectSource"
      :journal="journal"
      :sources="sources"
      :busy="busy"
      @select="uuid => selectSource(uuid).catch(() => {})"
      @create-personal="createJournal"
    />

    <template v-if="!loading && !journal">
      <div class="journal-empty-hero">
        <span class="journal-empty-mark"><BookMarked :size="30" /></span>
        <div>
          <span class="journal-kicker">Общая летопись</span>
          <h2>{{ sessionUuid ? 'Дневник кампании ещё не создан' : 'Выберите дневник персонажа' }}</h2>
          <p>{{ emptyDescription }}</p>
        </div>
      </div>

      <form v-if="sessionUuid || canSelectSource" class="journal-create" @submit.prevent="createJournal">
        <input v-model="newJournalName" maxlength="160" :placeholder="createPlaceholder" />
        <button type="submit" :disabled="busy">
          <Plus :size="15" />{{ sessionUuid ? 'Создать дневник кампании' : 'Создать личный' }}
        </button>
      </form>
      <p v-if="error" class="journal-error" role="alert">{{ error }}</p>
    </template>

    <template v-else-if="!loading && journal">
      <header class="journal-cover">
        <div class="journal-cover-icon"><BookMarked :size="27" /></div>
        <div class="journal-cover-copy">
          <span class="journal-kicker">{{ journal.kind === 'session' ? 'Дневник кампании' : 'Личный дневник' }}</span>
          <h2>{{ journal.name }}</h2>
          <p>{{ sectionCountLabel }} · {{ eventCountLabel }}</p>
        </div>
      </header>

      <div v-if="journal.kind === 'session'" class="journal-access">
        <ToggleSwitch v-if="canManage" :model-value="journal.playersCanEdit" :disabled="busy"
          label="Игроки могут редактировать дневник" @update:model-value="value => setPlayerEditing(value).catch(() => {})" />
        <span v-else>{{ canEdit ? 'Вы можете дополнять общую летопись' : 'Только чтение · записи добавляет мастер' }}</span>
        <small v-if="canManage">{{ journal.playersCanEdit ? 'Игроки могут добавлять, изменять, удалять и переставлять записи.' : 'Игроки видят записи, но менять их может только мастер.' }}</small>
      </div>

      <div class="journal-toolbar">
        <div>
          <span>{{ journal.kind === 'session' ? 'Общая летопись мастера и игроков' : 'Личная летопись этого персонажа' }}</span>
          <small v-if="journal.kind === 'session'">Игроки могут выбрать его источником на странице персонажа</small>
        </div>
        <button v-if="canEdit" ref="addSectionButton" type="button" :disabled="busy" @click="addSection">
          <Plus :size="15" /> Раздел
        </button>
      </div>

      <p v-if="error" class="journal-error" role="alert">{{ error }}</p>
      <div v-if="displaySections.length" class="journal-sections">
        <DndDiarySessionCard
          v-for="entry in displaySections"
          :key="`${journal.uuid}:${entry.session.id}`"
          :session="entry.session"
          :number="entry.number"
          :owner-mode="canEdit"
          :busy="busy"
          :default-open="entry.number === sections.length"
          @edit-session="el => editSection(entry.session.id, el)"
          @edit-event="(eventId, el) => editEvent(entry.session.id, eventId, el)"
          @add-event="el => addEvent(entry.session.id, el)"
          @reorder-events="ids => reorderEntries(entry.session.id, ids).catch(() => {})"
          @dragging="setDragging"
        />
      </div>
      <div v-else class="journal-blank">
        <Feather :size="26" />
        <strong>Пока ни одной главы летописи</strong>
        <span>Создайте раздел для игрового вечера, главы или отдельной сюжетной арки.</span>
      </div>
      <DndDiarySessionModal
        v-if="editorOpen && editorKind === 'section' && draft"
        :session="draft"
        :title-placeholder="sectionPlaceholder"
        :mode="creating ? 'create' : 'edit'"
        @update="patch => draft = patchSession(draft, patch)"
        @save="saveSection"
        @remove="removingSection = draft"
        @close="closeEditor"
      />

      <MorphEditorShell
        v-if="editorOpen && editorKind === 'event' && draft"
        :origin-rect="originRect"
        :origin-el="originEl"
        :color="eventTypeMeta(draft.type).color"
        orientation="vertical"
        :min-view-width="340"
        @close="closeEditor"
      >
        <template #view><div class="journal-event-preview"><DndDiaryEventRow :event="draft" /></div></template>
        <template #editor>
          <DndDiaryEventEditor
            :event="draft"
            :mode="creating ? 'create' : 'edit'"
            @update="patch => draft = patchEvent(draft, patch)"
            @save="saveEvent"
            @remove="removeEvent"
            @close="closeEditor"
          />
        </template>
      </MorphEditorShell>

      <ConfirmDialog
        v-if="removingSection"
        title="Удалить раздел?"
        :message="`«${removingSection.title || sectionPlaceholder}» и все его записи будут удалены для всех участников.`"
        confirm-label="Удалить"
        @confirm="removeSection"
        @cancel="removingSection = null"
      />
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { BookMarked, Feather, Plus } from '@lucide/vue'
import { ConfirmDialog, ToggleSwitch } from '@sylvieshare/share-ui'
import DndDiaryEventEditor from '@/features/character-editor/blocks/dnd/components/DndDiaryEventEditor.vue'
import DndDiaryEventRow from '@/features/character-editor/blocks/dnd/components/DndDiaryEventRow.vue'
import DndDiarySessionCard from '@/features/character-editor/blocks/dnd/components/DndDiarySessionCard.vue'
import DndDiarySessionModal from '@/features/character-editor/blocks/dnd/components/DndDiarySessionModal.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell.vue'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { defaultEvent, defaultSession, eventTypeMeta, normalizeEvent, normalizeSession, patchEvent, patchSession } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'
import { useJournalWorkspace } from '@/features/journals/composables/useJournalWorkspace'
import JournalSourceSwitch from './JournalSourceSwitch.vue'

const props = defineProps({
  characterUuid: { type: String, default: '' },
  sessionUuid: { type: String, default: '' },
})

const {
  journal, sources, canEdit, canManage, canSelectSource, loading, busy, error,
  createRoot, selectSource, createSection, updateSection, removeSection: deleteSection,
  createEntry, updateEntry, removeEntry,
  setPlayerEditing, reorderEntries, setDragging,
} = useJournalWorkspace({ characterUuid: props.characterUuid, sessionUuid: props.sessionUuid })

const sections = computed(() => journal.value?.sections || [])
const displaySections = computed(() => sections.value.map((session, index) => ({ session, number: index + 1 })).reverse())
const eventCount = computed(() => sections.value.reduce((sum, section) => sum + section.events.length, 0))
const sectionCountLabel = computed(() => `${sections.value.length} ${plural(sections.value.length, 'раздел', 'раздела', 'разделов')}`)
const eventCountLabel = computed(() => `${eventCount.value} ${plural(eventCount.value, 'запись', 'записи', 'записей')}`)
const emptyDescription = computed(() => props.sessionUuid
  ? 'Он станет общей летописью мастера и всех игроков этой сессии.'
  : 'Можно вести отдельную личную летопись или подключить общий дневник кампании.')
const createPlaceholder = computed(() => props.sessionUuid ? 'Например, Летопись кампании' : 'Название личного дневника')

const newJournalName = ref('')
const addSectionButton = ref(null)
const editorKind = ref('')
const draft = ref(null)
const editingSectionId = ref(null)
const creating = ref(false)
const removingSection = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const sectionPlaceholder = computed(() => creating.value ? `Раздел ${sections.value.length + 1}` : 'Раздел дневника')

function plural(count, one, few, many) {
  const tail = count % 100
  if (tail >= 11 && tail <= 14) return many
  if (count % 10 === 1) return one
  if (count % 10 >= 2 && count % 10 <= 4) return few
  return many
}

async function createJournal() {
  await createRoot(newJournalName.value).catch(() => {})
  newJournalName.value = ''
}

function addSection() {
  editorKind.value = 'section'; creating.value = true; draft.value = defaultSession(); openFrom(addSectionButton.value)
}

function editSection(id, element) {
  const section = sections.value.find(item => String(item.id) === String(id))
  if (!section) return
  editorKind.value = 'section'; creating.value = false; draft.value = normalizeSession(section); openFrom(element)
}

async function saveSection() {
  const action = creating.value ? createSection(draft.value) : updateSection(draft.value)
  await action.then(closeEditor).catch(() => {})
}

async function removeSection() {
  await deleteSection(removingSection.value.id).then(() => { removingSection.value = null; closeEditor() }).catch(() => {})
}

function addEvent(sectionId, element) {
  editorKind.value = 'event'; creating.value = true; editingSectionId.value = sectionId; draft.value = defaultEvent(); openFrom(element)
}

function editEvent(sectionId, eventId, element) {
  const event = sections.value.find(item => String(item.id) === String(sectionId))?.events.find(item => String(item.id) === String(eventId))
  if (!event) return
  editorKind.value = 'event'; creating.value = false; editingSectionId.value = sectionId; draft.value = normalizeEvent(event); openFrom(element)
}

async function saveEvent() {
  const action = creating.value ? createEntry(editingSectionId.value, draft.value) : updateEntry(draft.value)
  await action.then(closeEditor).catch(() => {})
}

async function removeEvent() {
  await removeEntry(draft.value.id).then(closeEditor).catch(() => {})
}

function closeEditor() {
  close(); editorKind.value = ''; draft.value = null; editingSectionId.value = null; creating.value = false
}

watch(() => journal.value?.uuid, () => { closeEditor(); removingSection.value = null })
watch(canEdit, allowed => { if (!allowed) { closeEditor(); removingSection.value = null } })
</script>

<style scoped src="./JournalWorkspace.css"></style>
