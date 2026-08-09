<template>
  <div class="top-bar">
    <router-link class="back-link" to="/sessions">← К сессиям</router-link>

    <template v-if="session">
      <span class="top-divider" />

      <div class="status-wrap">
        <button
          ref="statusBadgeEl"
          class="status-badge"
          :style="{ '--dot': statusCfg.color }"
          @click="statusOpen = !statusOpen"
        >
          <span class="status-dot" />{{ statusCfg.label }}
          <svg class="status-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <BasePopover v-model:open="statusOpen" :anchor="statusBadgeEl" :min-width="148">
          <button
            v-for="opt in STATUS_OPTIONS"
            :key="opt.key"
            class="status-option"
            :class="{ active: session.status === opt.key }"
            :style="{ '--dot': STATUS_CFG[opt.key].color }"
            @click="setStatus(opt.key)"
          >
            <span class="status-dot" />{{ opt.label }}
          </button>
        </BasePopover>
      </div>

      <button class="session-info" @click="$emit('edit')">
        <span class="session-title">{{ session.name }}</span>
      </button>

      <span v-if="isDm || currentChapter" class="top-rule" />

      <div v-if="isDm || currentChapter" class="chapter-wrap">
        <button
          ref="chapterTriggerEl"
          class="chapter-trigger"
          :class="{ 'chapter-trigger--empty': !currentChapter, 'chapter-trigger--readonly': !isDm, 'chapter-trigger--open': chapterOpen }"
          :disabled="!isDm"
          @click="toggleChapterMenu"
        >
          <span v-if="currentChapter" class="chapter-num">{{ romanNum(currentChapter.number) }}</span>
          <span class="chapter-label">
            <template v-if="currentChapter">{{ currentChapter.name }}</template>
            <template v-else>Выбрать главу</template>
          </span>
          <svg v-if="isDm" class="chapter-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <BasePopover v-model:open="chapterOpen" :anchor="chapterTriggerEl" :min-width="320">
          <div v-if="chaptersLoading" class="chapter-loading">Загрузка…</div>
          <template v-else>
            <div
              v-for="ch in chapters"
              :key="ch.id"
              class="chapter-row"
              :class="{ 'chapter-row--active': session.currentChapterId === ch.id, 'chapter-row--editing': editingChapterId === ch.id }"
            >
              <span
                class="chapter-row-num"
                :class="{ 'chapter-row-num--filled': session.currentChapterId === ch.id || editingChapterId === ch.id }"
              >{{ romanNum(ch.number) }}</span>
              <template v-if="editingChapterId === ch.id">
                <input
                  ref="editInputEl"
                  v-model="editingChapterName"
                  class="chapter-edit-input"
                  type="text"
                  maxlength="120"
                  @keydown.enter="commitChapterEdit"
                  @keydown.escape="cancelChapterEdit"
                  @keydown.stop
                />
                <button class="chapter-row-btn chapter-row-btn--save" :disabled="!editingChapterName.trim() || editingSaving" @click.stop="commitChapterEdit">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7.2l2.8 2.8 6.2-6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button class="chapter-row-btn" @click.stop="cancelChapterEdit">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                </button>
              </template>
              <template v-else>
                <button class="chapter-option" @click="pickChapter(ch)">
                  <span class="chapter-option-name">Глава {{ romanNum(ch.number) }} · {{ ch.name }}</span>
                </button>
                <button class="chapter-row-btn chapter-row-btn--edit" title="Переименовать" @click.stop="startChapterEdit(ch)">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M2 12L4 11.5L11.5 4L10 2.5L2.5 10L2 12Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                  </svg>
                </button>
              </template>
            </div>
            <div v-if="!chapters.length" class="chapter-empty">Глав пока нет</div>
            <div class="chapter-new">
              <button
                type="button"
                class="chapter-new-add"
                :disabled="!newChapterName.trim() || chapterCreating"
                @click="addChapter"
              >+</button>
              <input
                v-model="newChapterName"
                class="chapter-new-input"
                type="text"
                maxlength="120"
                placeholder="Новая глава…"
                @keydown.enter="addChapter"
                @keydown.stop
              />
            </div>
          </template>
        </BasePopover>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import BasePopover from '@/shared/ui/BasePopover.vue'
import { romanNum, useSessionChapters } from '@/features/sessions/composables/useSessionChapters'
import { STATUS_CFG, STATUS_OPTIONS, useSessionStatus } from '@/features/sessions/composables/useSessionStatus'

const props = defineProps({
  session:        { type: Object, default: null },
  sessionUuid:    { type: String, required: true },
  isDm:           { type: Boolean, default: false },
  initialChapter: { type: Object, default: null },
})
defineEmits(['edit'])

const sessionRef = ref(props.session)
watch(() => props.session, v => { sessionRef.value = v })

const isDmRef = ref(props.isDm)
watch(() => props.isDm, v => { isDmRef.value = v })

const statusBadgeEl = ref(null)
const chapterTriggerEl = ref(null)

const { statusOpen, statusCfg, setStatus } =
  useSessionStatus({ session: sessionRef, sessionUuid: props.sessionUuid })

const chaptersCtl = useSessionChapters({
  session: sessionRef,
  sessionUuid: props.sessionUuid,
  isDm: isDmRef,
})

const {
  chapterOpen,
  chapters,
  chaptersLoading,
  currentChapter,
  newChapterName,
  chapterCreating,
  editingChapterId,
  editingChapterName,
  editingSaving,
  editInputEl,
  loadChapters,
  toggleChapterMenu,
  pickChapter,
  addChapter,
  startChapterEdit,
  cancelChapterEdit,
  commitChapterEdit,
} = chaptersCtl

if (props.initialChapter) currentChapter.value = props.initialChapter
watch(() => props.initialChapter, v => { if (v) currentChapter.value = v })

defineExpose({ chapters, currentChapter, loadChapters })
</script>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  flex-shrink: 0;
}

.status-wrap {
  position: relative;
  flex-shrink: 0;
}

.back-link {
  font-size: 13px;
  color: var(--text-2);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.15s;
}

.back-link:hover { color: var(--text-2); }

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--dot);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  border-radius: 6px;
  padding: 3px 8px;
  white-space: nowrap;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.status-badge:hover { background: color-mix(in srgb, var(--text-on-accent) 8%, transparent); }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-chevron { opacity: 0.55; }

.status-option {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 9px 14px;
  background: none;
  border: none;
  font: inherit;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.status-option:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); }
.status-option.active { color: var(--text-1); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.status-option .status-dot { color: var(--dot); }

.session-info {
  display: flex;
  align-items: center;
  gap: 7px;
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  min-width: 0;
  flex-shrink: 1;
}

.session-info:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); }

.session-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.top-divider,
.top-rule {
  width: 1px;
  height: 16px;
  background: color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  flex-shrink: 0;
}

.chapter-wrap {
  position: relative;
  flex-shrink: 0;
}

.chapter-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border-radius: 8px;
  padding: 3px 9px;
  font: inherit;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.chapter-trigger:hover:not(:disabled):not(.chapter-trigger--readonly) {
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border-color: color-mix(in srgb, var(--text-on-accent) 12%, transparent);
  color: var(--text-1);
}

.chapter-trigger--readonly { cursor: default; }
.chapter-trigger--open {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--text-1);
}

.chapter-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  background: var(--accent);
  color: var(--text-on-accent);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  border-radius: 5px;
}

.chapter-label {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: 200px;
}

.chapter-chevron { opacity: 0.5; }

.chapter-loading, .chapter-empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 10px;
}

.chapter-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 6px;
  border-radius: 8px;
  transition: background 0.15s;
}

.chapter-row:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
.chapter-row--active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.chapter-row--editing { background: color-mix(in srgb, var(--accent) 8%, transparent); }

.chapter-row-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 6px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  border-radius: 5px;
  flex-shrink: 0;
}

.chapter-row-num--filled {
  background: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
}

.chapter-option {
  flex: 1;
  display: flex;
  align-items: center;
  text-align: left;
  background: none;
  border: none;
  padding: 4px 6px;
  font: inherit;
  font-size: 13px;
  color: var(--text-1);
  cursor: pointer;
  border-radius: 6px;
  min-width: 0;
}

.chapter-option-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.chapter-row-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.chapter-row-btn:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); color: var(--text-1); }
.chapter-row-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.chapter-row-btn--save {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.chapter-row-btn--save:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.chapter-edit-input {
  flex: 1;
  background: var(--surface-raised);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 6px;
  padding: 4px 8px;
  font: inherit;
  font-size: 13px;
  color: var(--text-1);
  outline: none;
  min-width: 0;
}

.chapter-empty {
  text-align: center;
  padding: 12px;
}

.chapter-new {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  margin-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  padding-top: 8px;
}

.chapter-new-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  background: transparent;
  border: 1px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: 5px;
  color: var(--accent);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.chapter-new-add:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.chapter-new-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chapter-new-input {
  flex: 1;
  background: none;
  border: none;
  padding: 4px 6px;
  font: inherit;
  font-size: 13px;
  color: var(--text-1);
  outline: none;
  min-width: 0;
}

.chapter-new-input::placeholder { color: var(--text-muted); }
</style>
