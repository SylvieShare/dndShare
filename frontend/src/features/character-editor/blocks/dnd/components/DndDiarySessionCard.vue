<template>
  <div class="dsc">
    <div class="dsc-head" @click="open = !open">
      <svg class="dsc-chevron" :class="{ 'dsc-chevron--open': open }" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
      <span ref="titleEl" class="dsc-title">{{ session.title || `Сессия ${number}` }}</span>
      <span v-if="session.date" class="dsc-date">{{ session.date }}</span>
      <span v-if="!open && session.events.length" class="dsc-count">{{ eventsCountLabel }}</span>
      <button
        v-if="ownerMode"
        class="dsc-edit"
        type="button"
        title="Редактировать сессию"
        @click.stop="$emit('edit-session', titleEl)"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </div>

    <div v-if="open" class="dsc-body">
      <div v-if="session.events.length" class="dsc-events">
        <span class="dsc-rail"></span>
        <component
          :is="ownerMode ? 'button' : 'div'"
          v-for="e in session.events"
          :key="e.id"
          :ref="el => setEventRef(e.id, el)"
          class="dsc-event"
          :class="{ 'dsc-event--clickable': ownerMode }"
          :type="ownerMode ? 'button' : undefined"
          @click="ownerMode && $emit('edit-event', e.id, eventEls[e.id])"
        >
          <DndDiaryEventRow :event="e" />
        </component>
      </div>
      <div v-else class="dsc-empty">Пока нет событий</div>

      <button v-if="ownerMode" ref="addBtnEl" class="dsc-add" type="button" @click="$emit('add-event', addBtnEl)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        событие
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import DndDiaryEventRow from '@/features/character-editor/blocks/dnd/components/DndDiaryEventRow.vue'

const props = defineProps({
  session: { type: Object, required: true },
  number: { type: Number, required: true },
  ownerMode: { type: Boolean, default: false },
  defaultOpen: { type: Boolean, default: false },
})
defineEmits(['edit-session', 'edit-event', 'add-event'])

const open = ref(props.defaultOpen)
const titleEl = ref(null)
const addBtnEl = ref(null)
const eventEls = {}

function setEventRef(id, el) {
  if (el) eventEls[id] = el
  else delete eventEls[id]
}

const eventsCountLabel = computed(() => {
  const n = props.session.events.length
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} событие`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} события`
  return `${n} событий`
})
</script>

<style scoped>
.dsc {
  background: var(--block-bg);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  min-width: 0;
}

.dsc-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  min-width: 0;
}
.dsc-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s;
}
.dsc-chevron--open { transform: rotate(90deg); }

.dsc-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsc-date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}
.dsc-count {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}

.dsc-edit {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-left: auto;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}
.dsc-count + .dsc-edit { margin-left: 0; }
@media (hover: hover) { .dsc-edit:hover { color: var(--accent); background: rgba(255, 255, 255, 0.06); } }

.dsc-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 16px 14px;
  border-top: 1px solid var(--border);
  padding-top: 13px;
}

.dsc-events {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dsc-rail {
  position: absolute;
  left: 12px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 1px;
  background: var(--border);
}

.dsc-event {
  display: block;
  width: 100%;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  min-width: 0;
}
.dsc-event--clickable { cursor: pointer; border-radius: var(--r-sm); }
@media (hover: hover) {
  .dsc-event--clickable:hover { background: rgba(255, 255, 255, 0.03); }
}

.dsc-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  font-style: italic;
}

.dsc-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  align-self: flex-start;
  margin-left: 37px;
  padding: 6px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.dsc-add:hover {
  color: var(--text-2);
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}
</style>
