<template>
  <div class="toolbar">
    <div class="toolbar-inner" :class="{ 'has-blocks': toolbarBlocksList }">

      <!-- Left: back + identity -->
      <div class="tb-left">
        <button class="tb-back" :title="modal ? 'Закрыть' : 'К списку персонажей'" @click="goBack">
          <svg v-if="modal" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 4L6 9L11 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="tb-back-label">{{ modal ? 'Закрыть' : 'к Списку' }}</span>
        </button>
        <div class="tb-divider"></div>
        <div v-if="charName || charSub" class="tb-identity">
          <span class="tb-name">{{ charName }}</span>
          <span v-if="charSub" class="tb-sub">{{ charSub }}</span>
        </div>

        <div v-if="topSession && !modal" class="tb-session-wrap" v-click-outside="closeSessionMenu">
          <div class="tb-divider"></div>
          <button
            class="tb-session"
            :class="{ 'tb-session-clickable': sessions.length > 1, open: sessionMenuOpen }"
            :disabled="sessions.length <= 1"
            @click="sessions.length > 1 && (sessionMenuOpen = !sessionMenuOpen)"
          >
            <span class="tb-session-status" :style="{ background: statusColor(topSession.status) }" :title="statusLabel(topSession.status)"></span>
            <span class="tb-session-text">
              <span class="tb-session-name">{{ topSession.name }}</span>
              <span v-if="topSession.chapterName || topSession.chapterNumber != null" class="tb-session-chapter">
                {{ chapterLabel(topSession) }}
              </span>
            </span>
            <svg v-if="sessions.length > 1" class="tb-session-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <transition name="dropdown">
            <div v-if="sessionMenuOpen" class="tb-session-dropdown">
              <router-link
                v-for="s in sessions"
                :key="s.uuid"
                :to="'/sessions/' + s.uuid"
                class="tb-session-option"
                @click="sessionMenuOpen = false"
              >
                <span class="tb-session-status" :style="{ background: statusColor(s.status) }" :title="statusLabel(s.status)"></span>
                <span class="tb-session-text">
                  <span class="tb-session-name">{{ s.name }}</span>
                  <span class="tb-session-meta">
                    <span class="tb-session-status-label" :style="{ color: statusColor(s.status) }">{{ statusLabel(s.status) }}</span>
                    <span v-if="s.chapterName || s.chapterNumber != null" class="tb-session-chapter">
                      · {{ chapterLabel(s) }}
                    </span>
                  </span>
                </span>
              </router-link>
            </div>
          </transition>
        </div>
      </div>

      <!-- Center: toolbar blocks or tabs -->
      <template v-if="toolbarBlocksList">
        <div
          v-for="(block, i) in toolbarBlocksList"
          :key="i"
          class="toolbar-block-wrap"
        >
          <TemplateBlockInner
            :block="block"
            :values="toolbarValues"
            :vars="toolbarVars"
            @update:value="$emit('update:value', $event)"
            @update:var="$emit('update:var', $event)"
          />
        </div>
      </template>

      <div v-if="!toolbarBlocksList && tabs?.length" class="tb-tabs">
        <button
          v-for="(tab, i) in tabs"
          :key="i"
          class="tb-tab"
          :class="{ active: activeTab === i }"
          :title="tab.title || 'Раздел'"
          @click="$emit('update:activeTab', i)"
        >
          <img v-if="tab.svg" class="tb-tab-icon" :src="tab.svg" :alt="tab.title || 'Раздел'" />
          <span v-else>{{ tab.title }}</span>
        </button>
      </div>

      <!-- Right: menu -->
      <div class="tb-right">
        <div v-if="canEdit" class="menu-wrap" v-click-outside="closeMenu">
          <button class="menu-btn" :class="{ open: menuOpen }" title="Меню" @click="menuOpen = !menuOpen">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
          </button>
          <transition name="dropdown">
            <div v-if="menuOpen" class="menu-dropdown">
              <div class="menu-item menu-save-item">
                <div class="save-widget" :class="saveStatus">
                  <span class="save-dot"></span>
                  <span class="save-label">{{ saveLabel }}</span>
                </div>
              </div>
              <div v-if="canTogglePublic" class="menu-item">
                <ToggleSwitch
                  :modelValue="publicVisible"
                  label="Публичная ссылка"
                  @update:modelValue="$emit('update:publicVisible', $event)"
                />
              </div>
              <button class="menu-item menu-pdf" type="button" @click="openPrintView">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 9V2h9l3 3v4" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" rx="1" />
                </svg>
                <span>Получить PDF</span>
              </button>
            </div>
          </transition>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import ToggleSwitch from "@/shared/ui/ToggleSwitch"
import { sessionStatusColor, sessionStatusLabel } from '@/features/sessions/composables/useSessionStatus'

const TemplateBlockInner = defineAsyncComponent(() => import("./TemplateBlockInner"))

const props = defineProps({
  publicVisible: Boolean,
  canEdit: { type: Boolean, default: false },
  canTogglePublic: { type: Boolean, default: true },
  modal: { type: Boolean, default: false },
  saveStatus: { type: String, default: 'idle' },
  pendingSecondsLeft: { type: Number, default: 0 },
  tabs: { type: Array, default: null },
  activeTab: { type: Number, default: 0 },
  toolbarBlocksList: { default: null },
  toolbarValues: { type: Object, default: () => ({}) },
  toolbarVars: { type: Object, default: () => ({}) },
  charName: { type: String, default: '' },
  charSub: { type: String, default: '' },
  sessions: { type: Array, default: () => [] },
  topSession: { type: Object, default: null },
})
const emit = defineEmits(['update:publicVisible', 'update:activeTab', 'update:value', 'update:var', 'close'])

const router = useRouter()
const menuOpen = ref(false)
const sessionMenuOpen = ref(false)

const statusColor = sessionStatusColor
const statusLabel = sessionStatusLabel
function chapterLabel(s) {
  const num = s.chapterNumber != null ? `Гл. ${s.chapterNumber}` : ''
  return [num, s.chapterName].filter(Boolean).join(' · ')
}
function closeSessionMenu() { sessionMenuOpen.value = false }

const saveLabel = computed(() => {
  switch (props.saveStatus) {
    case 'pending': return `Сохранение через ${props.pendingSecondsLeft}с`
    case 'saving':  return 'Сохраняется...'
    case 'error':   return 'Ошибка сохранения'
    default:        return 'Сохранено'
  }
})

function closeMenu() { menuOpen.value = false }
function openPrintView() {
  menuOpen.value = false
  router.push({ name: 'CharacterPrint', params: { uuid: router.currentRoute.value.params.uuid } })
}
function goBack() {
  if (props.modal) { emit('close'); return }
  router.push('/chars')
}
</script>

<style scoped>
.toolbar {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 20;
}

.toolbar-inner {
  max-width: var(--content-max);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 52px;
  border-bottom: 1px solid var(--border);
  background-color: var(--bg);
}

/* ── Left ── */
.tb-left {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  flex: 1;
}

.tb-back {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 34px;
  flex-shrink: 0;
  background: none;
  border: none;
  border-radius: 7px;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  padding: 0 8px 0 4px;
}
.tb-back:hover { color: var(--text-2); background: var(--surface-raised); }

.tb-back-label {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.tb-divider {
  width: 1px;
  height: 22px;
  background: var(--border-strong);
  flex-shrink: 0;
  margin: 0 10px;
}

.tb-identity {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  gap: 1px;
}

.tb-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.tb-sub {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

/* ── Session badge ── */
.tb-session-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.tb-session {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface-raised) 56%, transparent);
  color: var(--text-1);
  font: inherit;
  cursor: default;
  transition: background 0.15s, border-color 0.15s;
  min-width: 0;
}

.tb-session-clickable { cursor: pointer; }
.tb-session-clickable:hover,
.tb-session.open {
  background: var(--surface-raised);
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border-strong));
}

.tb-session-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tb-session-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  line-height: 1.15;
}

.tb-session-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.tb-session-chapter {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.tb-session-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.15s;
}
.tb-session.open .tb-session-chevron { transform: rotate(180deg); }

.tb-session-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 130;
  min-width: 260px;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
}

.tb-session-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 7px;
  color: inherit;
  text-decoration: none;
  transition: background 0.1s;
}
.tb-session-option:hover { background: var(--surface-raised); }

.tb-session-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
}
.tb-session-status-label {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Center: tabs ── */
.tb-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.tb-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-muted);
  padding: 6px 14px 4px;
  border-radius: 0;
  transition: color 0.15s;
  white-space: nowrap;
  height: 52px;
}

.tb-tab::after {
  content: '';
  position: absolute;
  bottom: 6px;
  left: 6px;
  right: 6px;
  height: 2px;
  border-radius: 999px;
  background: transparent;
  transition: background 0.15s;
}

.tb-tab:hover { color: var(--text-muted); }

.tb-tab.active { color: var(--text-1); font-weight: 700; }
.tb-tab.active::after { background: var(--accent); }

.tb-tab-icon {
  width: 18px;
  height: 18px;
  display: block;
  object-fit: contain;
  opacity: 0.5;
  transition: opacity 0.15s, filter 0.15s;
}
.tb-tab.active .tb-tab-icon {
  opacity: 1;
  filter: brightness(1.3) saturate(1.4);
}

/* ── Right ── */
.tb-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: flex-end;
}


/* ── Burger ── */
.menu-wrap { position: relative; }

.menu-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  width: 34px;
  height: 34px;
  background: none;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.menu-btn:hover,
.menu-btn.open {
  background: var(--surface-raised);
  border-color: var(--border-strong);
}

.bar {
  display: block;
  width: 16px;
  height: 2px;
  background: var(--text-muted);
  border-radius: 2px;
  transition: background 0.15s;
}
.menu-btn:hover .bar,
.menu-btn.open .bar { background: var(--text-2); }

/* ── Dropdown ── */
.menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  padding: 8px;
  min-width: 220px;
  box-shadow: var(--shadow-lg);
  z-index: 100;
}

.menu-item {
  padding: 8px 10px;
  border-radius: 7px;
  transition: background 0.12s;
}
.menu-item:hover { background: var(--surface-raised); }

.menu-pdf {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.menu-pdf svg { color: var(--text-muted); flex: 0 0 auto; }

.menu-save-item {
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
  padding-bottom: 12px;
}

.save-widget {
  display: flex;
  align-items: center;
  gap: 7px;
}

.save-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background-color 0.3s;
}

.save-label {
  font-size: 12px;
  transition: color 0.3s;
  white-space: nowrap;
}

.save-widget.idle .save-dot   { background-color: var(--success); }
.save-widget.idle .save-label { color: var(--success); }
.save-widget.pending .save-dot   { background-color: var(--warning); }
.save-widget.pending .save-label { color: var(--warning); }
.save-widget.saving .save-dot {
  background-color: var(--info);
  animation: pulse 0.9s ease-in-out infinite;
}
.save-widget.saving .save-label { color: var(--info); }
.save-widget.error .save-dot   { background-color: var(--danger); }
.save-widget.error .save-label { color: var(--danger); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.dropdown-enter-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from,
.dropdown-leave-to { opacity: 0; transform: translateY(-4px); }

/* ── Toolbar blocks (mobile-style) ── */
@media (max-width: 640px) {
  .toolbar-inner {
    padding: 0 10px;
    gap: 4px;
    height: 48px;
  }

  .tb-tab {
    font-size: 12px;
    padding: 6px 10px 4px;
    height: 48px;
  }

  .toolbar-inner.has-blocks {
    padding: 0;
    gap: 0;
    height: auto;
  }

  .toolbar-inner.has-blocks .tb-left {
    display: none;
  }

  .toolbar-inner.has-blocks .tb-right {
    flex: 0 0 auto;
    padding: 0 6px;
    border-left: 1px solid var(--border);
  }

  .toolbar-block-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: stretch;
    border-right: 1px solid var(--border);
    justify-content: space-around;
    padding: 4px 0;
  }

  .toolbar-block-wrap:last-child {
    border-right: none;
  }
}

@media (min-width: 641px) {
  .toolbar-block-wrap {
    display: contents;
  }
}
</style>
