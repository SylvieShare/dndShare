<template>
  <div ref="toolbarRootEl" class="toolbar">
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
        <div v-if="!modal || canEdit" class="menu-wrap" v-click-outside="closeMenu">
          <button class="menu-btn" :class="{ open: menuOpen }" title="Меню" @click="menuOpen = !menuOpen">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
          </button>
          <transition name="dropdown">
            <div v-if="menuOpen" class="menu-dropdown">
              <button v-if="!modal" class="menu-item menu-action menu-navigation-item" type="button" @click="goBack">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M8 7l-5 5 5 5" />
                  <path d="M3 12h18" />
                </svg>
                <span>К персонажам</span>
              </button>
              <div v-if="canEdit" class="menu-item menu-save-item">
                <div class="save-widget" :class="saveStatus">
                  <span class="save-dot"></span>
                  <span class="save-label">{{ saveLabel }}</span>
                </div>
              </div>
              <div v-if="canEdit && canTogglePublic" class="menu-item">
                <ToggleSwitch
                  :modelValue="publicVisible"
                  label="Публичная ссылка"
                  @update:modelValue="$emit('update:publicVisible', $event)"
                />
              </div>
              <button v-if="canEdit" class="menu-item menu-action" type="button" @click="openSources">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
                  <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5z" />
                </svg>
                <span class="menu-action-copy"><b>Источники</b><small>{{ sourceSummary }}</small></span>
              </button>
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

  <ContentSourcesModal
    v-if="sourcesOpen"
    :source-version-id="sourceVersionId"
    :model-value="sourceDraft"
    @update:model-value="updateSources"
    @close="sourcesOpen = false"
  />
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import ContentSourcesModal from '@/features/character-editor/components/ContentSourcesModal.vue'
import ToggleSwitch from "@/shared/ui/ToggleSwitch"
import { sessionStatusColor, sessionStatusLabel } from '@/features/sessions/composables/useSessionStatus'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'
import { normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'

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
  sourceVersionId: { type: [Number, String], default: null },
  contentSources: { type: [Object, Array], default: null },
  sessions: { type: Array, default: () => [] },
  topSession: { type: Object, default: null },
})
const emit = defineEmits(['update:publicVisible', 'update:activeTab', 'update:value', 'update:var', 'update:contentSources', 'close'])

const router = useRouter()
const toolbarRootEl = ref(null)
const menuOpen = ref(false)
const sessionMenuOpen = ref(false)
const sourcesOpen = ref(false)
const sourceDraft = ref(normalizeContentSourceSettings(null))

defineExpose({ rootElement: () => toolbarRootEl.value })

const statusColor = sessionStatusColor
const statusLabel = sessionStatusLabel
function chapterLabel(s) {
  return currentChapterLabel(s, true)
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

const sourceSummary = computed(() => {
  const settings = normalizeContentSourceSettings(props.contentSources)
  if (settings.mode === 'all') return settings.allowLegacy ? 'Все источники + Legacy' : 'Все источники'
  return `${settings.ids.length} выбрано`
})

function closeMenu() { menuOpen.value = false }
function openSources() {
  sourceDraft.value = normalizeContentSourceSettings(props.contentSources)
  sourcesOpen.value = true
  menuOpen.value = false
}
function updateSources(value) {
  sourceDraft.value = normalizeContentSourceSettings(value)
  emit('update:contentSources', sourceDraft.value)
}
function openPrintView() {
  menuOpen.value = false
  router.push({ name: 'CharacterPrint', params: { uuid: router.currentRoute.value.params.uuid } })
}
function goBack() {
  if (props.modal) { emit('close'); return }
  menuOpen.value = false
  router.push('/chars')
}
</script>

<style scoped src="./styles/CharEditorToolbar.css"></style>
