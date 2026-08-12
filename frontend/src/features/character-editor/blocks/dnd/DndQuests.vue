<template>
  <div v-if="quests.length || ownerMode" class="dq-block">
    <div class="dq-head">
      <SectionLabel v-if="sectionHeading" class="dq-section-label" title="Задания" divider>
        <template v-if="activeQuests.length" #actions>
          <span class="dq-count">{{ activeQuests.length }}</span>
        </template>
      </SectionLabel>
      <template v-else>
        <span class="sheet-tile-title">Задания</span>
        <span v-if="activeQuests.length" class="dq-count">{{ activeQuests.length }}</span>
      </template>
    </div>

    <div v-if="activeQuests.length || ownerMode" class="dq-list">
      <component
        :is="ownerMode ? 'button' : 'div'"
        v-for="q in activeQuests"
        :key="q.id"
        :ref="el => setCardRef(q.id, el)"
        class="dq-card"
        :class="{ 'dq-card--clickable': ownerMode }"
        :style="{ '--qc': questStatusMeta(q.status).color }"
        :type="ownerMode ? 'button' : undefined"
        @click="ownerMode && edit(q.id)"
      >
        <span class="dq-strip"></span>
        <DndQuestCard :quest="q" />
      </component>

      <button v-if="ownerMode" ref="addBtnEl" class="dq-add" type="button" @click="add">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        задание
      </button>
    </div>

    <template v-if="finishedQuests.length">
      <button class="dq-finished-toggle" type="button" @click="finishedOpen = !finishedOpen">
        <svg class="dq-chevron" :class="{ 'dq-chevron--open': finishedOpen }" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
        Завершённые · {{ finishedQuests.length }}
      </button>
      <div v-if="finishedOpen" class="dq-list dq-list--finished">
        <component
          :is="ownerMode ? 'button' : 'div'"
          v-for="q in finishedQuests"
          :key="q.id"
          :ref="el => setCardRef(q.id, el)"
          class="dq-card"
          :class="{ 'dq-card--clickable': ownerMode }"
          :style="{ '--qc': questStatusMeta(q.status).color }"
          :type="ownerMode ? 'button' : undefined"
          @click="ownerMode && edit(q.id)"
        >
          <span class="dq-strip"></span>
          <DndQuestCard :quest="q" />
        </component>
      </div>
    </template>

    <MorphEditorShell
      v-if="editorOpen && current"
      :origin-rect="originRect"
      :origin-el="originEl"
      :color="questStatusMeta(current.status).color"
      orientation="vertical"
      :min-view-width="340"
      @close="closeEditor"
    >
      <template #view>
        <DndQuestCard :quest="current" />
      </template>
      <template #editor>
        <DndQuestEditor
          :quest="current"
          :mode="mode"
          @update="onUpdate"
          @save="saveDraft"
          @remove="removeCurrent"
          @close="closeEditor"
        />
      </template>
    </MorphEditorShell>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import DndQuestCard from '@/features/character-editor/blocks/dnd/components/DndQuestCard.vue'
import DndQuestEditor from '@/features/character-editor/blocks/dnd/components/DndQuestEditor.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import SectionLabel from '@/shared/ui/SectionLabel'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import {
  defaultQuest,
  normalizeQuests,
  patchQuest,
  questStatusMeta,
} from '@/features/character-editor/blocks/dnd/lib/questEntry'

const props = defineProps({ block: Object, value: { default: null } })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', () => ({ ownerMode: false }))

const quests = computed(() => normalizeQuests(props.value))
const ownerMode = computed(() => !!charCtx.ownerMode)
const sectionHeading = computed(() => props.block.props?.title_variant === 'divider')

const activeQuests = computed(() => quests.value.filter(q => q.status === 'active'))
const finishedQuests = computed(() => quests.value.filter(q => q.status !== 'active'))
const finishedOpen = ref(false)

const addBtnEl = ref(null)
const cardEls = {}
const draft = ref(null)
const editingId = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

const current = computed(() => draft.value || quests.value.find(q => q.id === editingId.value) || null)
const mode = computed(() => (draft.value ? 'create' : 'edit'))

function setCardRef(id, el) {
  if (el) cardEls[id] = el
  else delete cardEls[id]
}

function emitQuests(next) {
  emit('update:value', props.block.id, next)
}

function add() {
  draft.value = defaultQuest()
  openFrom(addBtnEl.value)
}

function edit(id) {
  editingId.value = id
  openFrom(cardEls[id])
}

function onUpdate(patch) {
  if (draft.value) {
    draft.value = patchQuest(draft.value, patch)
    return
  }
  emitQuests(quests.value.map(q => (q.id === editingId.value ? patchQuest(q, patch) : q)))
}

function saveDraft() {
  emitQuests([...quests.value, draft.value])
  closeEditor()
}

function removeCurrent() {
  if (editingId.value) emitQuests(quests.value.filter(q => q.id !== editingId.value))
  closeEditor()
}

function closeEditor() {
  close()
  draft.value = null
  editingId.value = null
}
</script>

<style scoped>
.dq-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.dq-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dq-section-label {
  width: 100%;
  margin-bottom: 0;
}
.dq-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-2);
  background: color-mix(in srgb, var(--text-on-accent) 7%, transparent);
  border-radius: var(--r-pill);
  padding: 1px 7px;
}

.dq-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dq-list--finished { opacity: 0.62; }

.dq-card {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  color: inherit;
  font: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.dq-card--clickable { cursor: pointer; }
@media (hover: hover) {
  .dq-card--clickable:hover { border-color: color-mix(in srgb, var(--qc) 45%, var(--border)); }
}

.dq-strip {
  position: absolute;
  top: var(--r-lg);
  bottom: var(--r-lg);
  left: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--qc);
}

.dq-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-lg);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.dq-add:hover {
  color: var(--text-2);
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.dq-finished-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: color 0.12s, background 0.12s;
}
.dq-finished-toggle:hover { color: var(--text-2); background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); }
.dq-chevron { transition: transform 0.15s; }
.dq-chevron--open { transform: rotate(90deg); }
</style>
