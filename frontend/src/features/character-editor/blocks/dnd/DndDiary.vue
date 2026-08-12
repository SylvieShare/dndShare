<template>
  <div v-if="sessions.length || ownerMode" class="dd-block">
    <div class="dd-head">
      <span class="sheet-tile-title">События</span>
      <button v-if="ownerMode" ref="addBtnEl" class="dd-add" type="button" @click="addSession">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        сессия
      </button>
    </div>

    <div v-if="displaySessions.length" class="dd-list">
      <DndDiarySessionCard
        v-for="entry in displaySessions"
        :key="entry.session.id"
        :session="entry.session"
        :number="entry.number"
        :owner-mode="ownerMode"
        :default-open="entry.number === sessions.length"
        @edit-session="el => editSession(entry.session.id, el)"
        @edit-event="(eventId, el) => editEvent(entry.session.id, eventId, el)"
        @add-event="el => addEvent(entry.session.id, el)"
      />
    </div>
    <div v-else class="dd-empty">Здесь появится летопись приключений — добавьте первую сессию</div>

    <DndDiarySessionModal
      v-if="editorOpen && editorKind === 'session' && currentSession"
      :session="currentSession"
      :title-placeholder="sessionPlaceholder"
      :mode="mode"
      @update="onSessionUpdate"
      @save="saveSessionDraft"
      @remove="askRemoveSession"
      @close="closeEditor"
    />

    <MorphEditorShell
      v-if="editorOpen && editorKind === 'event' && currentEvent"
      :origin-rect="originRect"
      :origin-el="originEl"
      :color="eventTypeMeta(currentEvent.type).color"
      orientation="vertical"
      :min-view-width="340"
      @close="closeEditor"
    >
      <template #view>
        <div class="dd-event-face">
          <DndDiaryEventRow :event="currentEvent" />
        </div>
      </template>
      <template #editor>
        <DndDiaryEventEditor
          :event="currentEvent"
          :mode="mode"
          @update="onEventUpdate"
          @save="saveEventDraft"
          @remove="removeCurrentEvent"
          @close="closeEditor"
        />
      </template>
    </MorphEditorShell>

    <ConfirmDialog
      v-if="removingSession"
      title="Удалить сессию?"
      :message="`«${removingSession.title || sessionPlaceholder}» и все её события будут удалены.`"
      confirm-label="Удалить"
      @confirm="removeSessionConfirmed"
      @cancel="removingSession = null"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog'
import DndDiaryEventEditor from '@/features/character-editor/blocks/dnd/components/DndDiaryEventEditor.vue'
import DndDiaryEventRow from '@/features/character-editor/blocks/dnd/components/DndDiaryEventRow.vue'
import DndDiarySessionCard from '@/features/character-editor/blocks/dnd/components/DndDiarySessionCard.vue'
import DndDiarySessionModal from '@/features/character-editor/blocks/dnd/components/DndDiarySessionModal.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import {
  defaultEvent,
  defaultSession,
  eventTypeMeta,
  normalizeDiary,
  patchEvent,
  patchSession,
} from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

const props = defineProps({ block: Object, value: { default: null } })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: false }))

const sessions = computed(() => normalizeDiary(props.value))
const ownerMode = computed(() => !!charCtx.ownerMode)

const displaySessions = computed(() =>
  sessions.value.map((session, i) => ({ session, number: i + 1 })).reverse(),
)

const addBtnEl = ref(null)
const editorKind = ref('')            // 'session' | 'event'
const draft = ref(null)               // session or event draft (create mode)
const editingSessionId = ref(null)
const editingEventId = ref(null)
const removingSession = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const mode = computed(() => (draft.value ? 'create' : 'edit'))

const currentSession = computed(() => {
  if (editorKind.value !== 'session') return null
  return draft.value || sessions.value.find(s => s.id === editingSessionId.value) || null
})

const currentEvent = computed(() => {
  if (editorKind.value !== 'event') return null
  if (draft.value) return draft.value
  const session = sessions.value.find(s => s.id === editingSessionId.value)
  return session?.events.find(e => e.id === editingEventId.value) || null
})

const sessionPlaceholder = computed(() => {
  if (draft.value && editorKind.value === 'session') return `Сессия ${sessions.value.length + 1}`
  const idx = sessions.value.findIndex(s => s.id === editingSessionId.value)
  return `Сессия ${idx === -1 ? sessions.value.length : idx + 1}`
})

function emitDiary(next) {
  emit('update:value', props.block.id, next)
}

function addSession() {
  editorKind.value = 'session'
  draft.value = defaultSession()
  openFrom(addBtnEl.value)
}

function editSession(id, el) {
  editorKind.value = 'session'
  editingSessionId.value = id
  openFrom(el)
}

function onSessionUpdate(patch) {
  if (draft.value) {
    draft.value = patchSession(draft.value, patch)
    return
  }
  emitDiary(sessions.value.map(s => (s.id === editingSessionId.value ? patchSession(s, patch) : s)))
}

function saveSessionDraft() {
  emitDiary([...sessions.value, draft.value])
  closeEditor()
}

function askRemoveSession() {
  removingSession.value = currentSession.value
}

function removeSessionConfirmed() {
  emitDiary(sessions.value.filter(s => s.id !== removingSession.value.id))
  removingSession.value = null
  closeEditor()
}

function addEvent(sessionId, el) {
  editorKind.value = 'event'
  editingSessionId.value = sessionId
  draft.value = defaultEvent()
  openFrom(el)
}

function editEvent(sessionId, eventId, el) {
  editorKind.value = 'event'
  editingSessionId.value = sessionId
  editingEventId.value = eventId
  openFrom(el)
}

function onEventUpdate(patch) {
  if (draft.value) {
    draft.value = patchEvent(draft.value, patch)
    return
  }
  emitDiary(sessions.value.map(s => {
    if (s.id !== editingSessionId.value) return s
    return { ...s, events: s.events.map(e => (e.id === editingEventId.value ? patchEvent(e, patch) : e)) }
  }))
}

function saveEventDraft() {
  emitDiary(sessions.value.map(s => {
    if (s.id !== editingSessionId.value) return s
    return { ...s, events: [...s.events, draft.value] }
  }))
  closeEditor()
}

function removeCurrentEvent() {
  emitDiary(sessions.value.map(s => {
    if (s.id !== editingSessionId.value) return s
    return { ...s, events: s.events.filter(e => e.id !== editingEventId.value) }
  }))
  closeEditor()
}

function closeEditor() {
  close()
  editorKind.value = ''
  draft.value = null
  editingSessionId.value = null
  editingEventId.value = null
}
</script>

<style scoped>
.dd-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.dd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}


.dd-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.dd-add:hover {
  color: var(--text-2);
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.dd-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dd-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  font-style: italic;
}

.dd-event-face {
  padding: 12px 16px;
  min-width: 0;
}
</style>
