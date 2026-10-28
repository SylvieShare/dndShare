<template>
  <div ref="tutorialRoot" class="view" :class="'view--' + format" :style="viewStyle" :inert="transfers.busy || edition.busy">
    <CharacterEditionDialog :controller="edition" />
    <CharacterTransferDialogs :controller="transfers" :character-uuid="uuid" />
    <PageTutorial :tutorial="characterTutorial" :mobile="isMobile" />
    <CharacterWorkspaceHeader :stacked-navigation="format === 'tablet'" ref="workspaceHeaderEl" :show-menu="template?.system === 'vtm-v20'" :compact="isMobile" :name="charName" :subtitle="charSub" :session="activeSession" :transfers="transfers" :content-width="containerWidthForTab(activeTab).maxWidth" :tabs="format === 'tablet' || format === 'desktop' && template?.system === 'vtm-v20' ? activeTabs : []" :active-tab="activeTab" @select-tab="onSetActiveTab" />


    <div
      v-if="isMobile && mobileTabs.length"
      class="mobile-sticky-header"
      :style="{ top: toolbarHeight + 'px' }"
      @wheel.prevent="onFixedHeaderWheel"
      @touchstart.passive="onFixedHeaderTouchStart"
      @touchmove="onFixedHeaderTouchMove"
      @touchend.passive="onFixedHeaderTouchEnd"
      @touchcancel.passive="onFixedHeaderTouchEnd"
    >
      <nav
        v-if="mobileTabs.length"
        ref="mobileTabbarEl"
        class="mobile-tabbar"
        data-tutorial="character-tabs"
        :class="{ dragging: tabDragActive, settling: tabDragSettling }"
        aria-label="Вкладки персонажа"
      >
        <span class="mobile-tab-indicator" :style="mobileTabIndicatorStyle"></span>
        <button
          v-for="(tab, i) in mobileTabs"
          :key="tabKey(tab, i)"
          :ref="el => setMobileTabButtonRef(el, i)"
          class="mobile-tab-btn"
          :class="{ active: highlightedMobileTab === i }"
          :aria-current="activeTab === i ? 'page' : undefined"
          type="button"
          :title="tab.title || 'Раздел'"
          @click="onSetActiveTab(i)"
        >
          <span
            v-if="tab.svg"
            class="mobile-tab-icon"
            :style="{ '--mobile-tab-icon': `url(&quot;${tab.svg}&quot;)` }"
            role="img"
            :aria-label="tab.title || 'Раздел'"
          ></span>
          <span v-else>{{ tab.title || 'Раздел' }}</span>
        </button>
      </nav>
    </div>

    <div
      ref="sheetScrollEl"
      class="sheet-scroll"
      data-tutorial="character-content"
    >
      <div v-if="loading" class="character-loading">
          <LoadingIndicator label="Загружаем лист персонажа…" size="lg" show-label />
        </div>
      <div v-else-if="loadError" role="alert">{{ loadError }} <button type="button" @click="initializeCharacter">Повторить</button></div>
      <CharacterSwipePager v-else-if="compactLayout && template" ref="swipePagerEl" :controller="swipe" :tabs="activeTabs">
        <template #default="{ index }">
          <div class="container" :style="containerWidthForTab(index)">
            <component :is="tabRenderComponent(index, TabPane)" :definition="template" :format="format" :section="activeTabs[index]?.id"
              :values="data.values" :vars="data.var" @update:value="onUpdateValue" @update:var="onUpdateVar" />
          </div>
        </template>
      </CharacterSwipePager>
      <div v-else-if="template" class="desktop-tabs">
        <div class="container" :style="containerWidthForTab(activeTab)">
          <CharacterTabPane :definition="template" :format="format" :section="activeTabs[activeTab]?.id"
            :values="data.values" :vars="data.var" @select-tab="onSetActiveTab"
            @update:value="onUpdateValue" @update:var="onUpdateVar" />
        </div>

      </div>
    </div>

    <CharacterSaveErrorToast
      :visible="saveStatus === 'error' && !!saveError"
      :message="saveError"
      @retry="retrySave" @reload="reloadSave"
      @dismiss="dismissSaveError"
    />
  </div>
</template>

<script setup>
import CharacterWorkspaceHeader from '@/features/character-editor/components/CharacterWorkspaceHeader.vue'
import CharacterTransferDialogs from '@/features/character-editor/components/CharacterTransferDialogs.vue'
import { useCharacterTransfers } from '@/features/character-editor/composables/useCharacterTransfers'
import PageTutorial from '@/features/tutorials/components/PageTutorial.vue'
import { useCharacterTutorial } from '@/features/tutorials/composables/useCharacterTutorial'
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CharacterTabPane from '@/features/character-editor/components/CharacterTabPane.vue'
import CharacterSaveErrorToast from '@/features/character-editor/components/CharacterSaveErrorToast.vue'
import { useCharacterData } from '@/features/character-editor/composables/useCharacterData'
import CharacterEditionDialog from '@/features/character-editor/components/CharacterEditionDialog.vue'
import { useCharacterEdition } from '@/features/character-editor/composables/useCharacterEdition'
import { useCharacterLive } from '@/features/character-editor/composables/useCharacterLive'
import { useSaveDebounce } from '@/features/character-editor/composables/useSaveDebounce'
import { useTabSwipe } from '@/features/character-editor/composables/useTabSwipe'
import { useScrollHide } from '@/features/character-editor/composables/useScrollHide'
import { useCharacterViewport } from '@/features/character-editor/composables/characterViewport'
import { createCharacterSnapshotRecorder } from '@/features/character-editor/lib/characterSnapshots'
import { useUiStore } from '@/stores/ui'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { sheetTabs, sheetTabIndex } from '../lib/sheetPresentation'
import { useAppLayout } from '@/shared/composables/useAppLayout'
import CharacterSwipePager from '../components/sheet/CharacterSwipePager.vue'
import { defaultTabIndex, parseTabQuery, queryForTab } from '@/features/character-editor/lib/tabQuery'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()
const sessionEventsStore = useSessionEventsStore()
// Snapshot the uuid from the route. Guard against the rare race where setup runs
// before route params settle (would otherwise fetch /char/undefined).
const uuid = route.params.uuid || router.currentRoute.value.params.uuid

// ── Mobile detection ──────────────────────────────────────────────────
const { phone: isMobile, format } = useAppLayout()
const compactLayout = computed(() => format.value !== 'desktop')

// ── Template refs ─────────────────────────────────────────────────────
const tutorialRoot = ref(null)
const tutorialReady = ref(false)
const workspaceHeaderEl = ref(null)
const sheetScrollEl = ref(null)
const mobileTabbarEl = ref(null)
const swipePagerEl = ref(null)
const fixedHeaderTouch = ref(null)

const TabPane = CharacterTabPane

// ── Composables ───────────────────────────────────────────────────────

const {
  loading, loadError, template, data, charCtx, isOwner, publicVisible,
  version, serverDocument, sourceVersionId, contentSources, sessions, topSession, hasSessionContext,
  loadSessions, applyCharacter, applyMetadata,
  activeTabs, mobileTabs,
  headerTitle, charName, charSub, commonMobileScrollHide,
  load, loadSync, containerWidthForTab, getInitialTabs,
  updateValue, updateValues, updateVar, updateContentSources, onPublicToggle,
} = useCharacterData(uuid, format)

const activeSession = computed(() => {
  const requested = String(route.query.session || '')
  return sessions.value.find(session => session.uuid === requested)
    || topSession.value
})

// Apply the list seed synchronously in setup so the expand overlay renders with
// content in the same tick the View Transition snapshots it. onMounted then does
// the full load (which short-circuits when the seed already populated state).
loadSync()
const snapshotRecorder = createCharacterSnapshotRecorder(uuid, () => isOwner.value ? data.value : null)
onBeforeUnmount(() => snapshotRecorder.dispose())

const pendingSessionEvents = []
const { saveStatus, saveError, pendingSecondsLeft, scheduleSave, retrySave, dismissSaveError, reloadSave, flushSave, historyState, sync: documentSync } = useSaveDebounce(uuid, data, {
  version, serverDocument, canSave:()=>isOwner.value,
  takeEvents: () => pendingSessionEvents.splice(0),
  onMetadata: applyMetadata,
})

Object.assign(charCtx, { historyState, undo: () => documentSync.undo(), redo: () => documentSync.redo() })

useCharacterLive({ uuid, sessionUuid: computed(() => activeSession.value?.uuid), sync: documentSync, onMetadata: applyMetadata })

const transfers = useCharacterTransfers({ uuid, data, session: activeSession, isOwner, version, flushSave, refreshFromServer: async()=>{try{await documentSync.catchUp();return true}catch{return false}}, saveStatus, loadSessions })
charCtx.itemTransfers = transfers
const edition = useCharacterEdition({ uuid, isOwner, sourceVersionId, version, flushSave, applyCharacter, canStart: () => !transfers.busy })
charCtx.edition = edition

// Share menu/session state with sheet blocks and header controls.
// charCtx is reactive, so assigned refs auto-unwrap on read.
Object.assign(charCtx, {
  canEdit: isOwner,
  publicVisible,
  setPublic: onPublicToggle,
  canTogglePublic: isOwner,
  saveStatus,
  pendingSecondsLeft,
  sourceVersionId,
  contentSources,
  values: computed(() => data.value.values || {}),
  updateValues: patch => {
    if (!isOwner.value) return
    updateValues(patch)
    recordSnapshot()
    nextTick(() => uiStore.setHeaderTitle(headerTitle.value))
    scheduleSave()
  },
  setContentSources: value => {
    onUpdateContentSources(value)
  },
  sessions,
  topSession: activeSession,
  logSessionEvent: event => {
    if (!isOwner.value) return
    const pending = sessionEventsStore.pendingCharacterEvent(event)
    if (pending) {
      pendingSessionEvents.push(pending)
      scheduleSave()
    }
  },
})

const swipe = useTabSwipe(activeTabs, compactLayout, mobileTabbarEl)
const {
  activeTab, highlightedMobileTab,
  tabDragActive, tabDragSettling,
  mobileTabIndicatorStyle,
  markTabVisited, setMobileTabButtonRef, updateMobileTabRects,
  scrollActiveMobileTabIntoView, setActiveTab,
  resetSwipe,
  tabRenderComponent, tabKey,
} = swipe

const {
  toolbarHeight, stripHidden, viewStyle,
  startScrollListener, stopScrollListener, revealHeader, observeToolbar, disconnectToolbar,
} = useScrollHide(isMobile, commonMobileScrollHide, { mobileAppHeaderVisible: false })

const { startViewportHeightSync, stopViewportHeightSync } = useCharacterViewport(isMobile)

const characterTutorial = useCharacterTutorial({ root: tutorialRoot, mobile: isMobile, ready: tutorialReady, template, sourceVersionId, activeTab, activeTabs, format, isOwner })

// ── Watchers ──────────────────────────────────────────────────────────

watch(format, (nextFormat, previousFormat) => {
  const id = sheetTabs(template.value, previousFormat)[activeTab.value]?.id
  resetSwipe()
  activeTab.value = sheetTabIndex(activeTabs.value, id)
  markTabVisited(activeTab.value)
}, { flush: 'sync' })

watch(headerTitle, () => { uiStore.setHeaderTitle(headerTitle.value) })

watch(activeTab, () => { pushQueryState() })

watch(() => route.query.tab, tab => {
  if (!ready) return
  const nextTab = parseTabQuery(tab, activeTabs.value, defaultTabIndex(getInitialTabs()))
  if (nextTab === activeTab.value) return
  syncingTabFromRoute = true
  // History navigation must win over an in-flight swipe animation. Applying the
  // route immediately keeps rapid Back/Forward presses and the URL in sync.
  resetSwipe()
  activeTab.value = nextTab
  nextTick(() => { syncingTabFromRoute = false })
})

watch(() => route.query.session, async requested => {
  if (!ready) return
  await syncEventSessionContext(requested)
})

watch([activeTab, format], () => {
  const preserveHeaderHidden = uiStore.headerHidden
  nextTick(() => {
    syncActiveScrollListener({ preserveHeaderHidden })
    if (isMobile.value) {
      updateMobileTabRects(mobileTabbarEl.value)
      scrollActiveMobileTabIntoView()
    }
  })
})

// ── Event handlers (bridge composable calls + side-effects) ──────────

function onUpdateValue(event) {
  if (!isOwner.value) return
  updateValue(event)
  recordSnapshot()
  nextTick(() => uiStore.setHeaderTitle(headerTitle.value))
  scheduleSave()
}

function onUpdateVar(patch) {
  if (!isOwner.value) return
  updateVar(patch)
  recordSnapshot()
  scheduleSave()
}

function onUpdateContentSources(value) {
  if (!isOwner.value) return
  updateContentSources(value)
  recordSnapshot()
  scheduleSave()
}

function recordSnapshot() {
  if (isOwner.value) snapshotRecorder.schedule()
}

function onSetActiveTab(value) {
  const index = typeof value === 'string' ? sheetTabIndex(activeTabs.value, value) : value
  updateMobileTabRects(mobileTabbarEl.value)
  setActiveTab(index, swipePagerEl.value?.trackElement(), mobileTabbarEl.value)
}

function onResize() {
  updateMobileTabRects(mobileTabbarEl.value)
}

function activeScrollElement() {
  return compactLayout.value
    ? swipePagerEl.value?.scrollElement(activeTab.value)
    : sheetScrollEl.value
}

function syncActiveScrollListener(options = {}) {
  startScrollListener(activeScrollElement(), {
    preserveHidden: options.preserveHeaderHidden,
  })
}

function scrollActiveContentBy(deltaY) {
  const el = activeScrollElement()
  if (!el || !deltaY) return
  if (el.scrollTop <= 0 && deltaY < -6) {
    revealHeader()
  }
  el.scrollTop += deltaY
}

function onFixedHeaderWheel(event) {
  scrollActiveContentBy(event.deltaY)
}

function onFixedHeaderTouchStart(event) {
  const touch = event.touches?.[0]
  fixedHeaderTouch.value = touch ? { x: touch.clientX, y: touch.clientY } : null
}

function onFixedHeaderTouchMove(event) {
  const touch = event.touches?.[0]
  if (!fixedHeaderTouch.value || !touch) return

  const dx = touch.clientX - fixedHeaderTouch.value.x
  const dy = touch.clientY - fixedHeaderTouch.value.y
  if (Math.abs(dy) <= Math.abs(dx)) return

  event.preventDefault()
  scrollActiveContentBy(-dy)
  fixedHeaderTouch.value = { x: touch.clientX, y: touch.clientY }
}

function onFixedHeaderTouchEnd() {
  fixedHeaderTouch.value = null
}

// ── URL sync ──────────────────────────────────────────────────────────

let ready = false
let syncingTabFromRoute = false

// ── Polling сессий / версии ───────────────────────────────────────────
let activeEventSessionUuid = null

async function syncEventSessionContext(requested = route.query.session) {
  const requestedUuid = String(requested || '')
  const selected = (requestedUuid && sessions.value.find(session => session.uuid === requestedUuid))
    || (!requestedUuid && topSession.value)
  if (!selected?.uuid) {
    sessionEventsStore.clearContext(activeEventSessionUuid)
    activeEventSessionUuid = null
    return
  }
  if (activeEventSessionUuid && activeEventSessionUuid !== selected.uuid) {
    sessionEventsStore.clearContext(activeEventSessionUuid)
  }
  await sessionEventsStore.setContext({ uuid: selected.uuid, actorUuid: uuid })
  activeEventSessionUuid = selected.uuid
}

function pushQueryState() {
  if (!ready || syncingTabFromRoute || characterTutorial.tour.active) return
  const tabs = getInitialTabs()
  const query = queryForTab(route.query, activeTab.value, defaultTabIndex(tabs), tabs)
  router.push({ query })
}

// ── Lifecycle ─────────────────────────────────────────────────────────

onMounted(async () => {
  document.body.classList.add('character-view-active')
  startViewportHeightSync()
  window.scrollTo(0, 0)


  await initializeCharacter()
})

async function initializeCharacter() {
  const savedQueryTab = route.query.tab
  const res = await load()
  if (!res) return

  const tabs = getInitialTabs()
  const defaultIdx = defaultTabIndex(tabs)
  activeTab.value = parseTabQuery(savedQueryTab, activeTabs.value, defaultIdx)
  markTabVisited(activeTab.value)

  uiStore.setHeaderTitle(headerTitle.value)

  window.addEventListener('resize', onResize)

  await nextTick()

  ready = true
  tutorialReady.value = true

  nextTick(() => {
    observeToolbar(workspaceHeaderEl.value?.$el)
    updateMobileTabRects(mobileTabbarEl.value)
    scrollActiveMobileTabIntoView()
    syncActiveScrollListener()
  })

  await loadSessions()
  await syncEventSessionContext()
}

onBeforeUnmount(() => {
  document.body.classList.remove('character-view-active')
  stopViewportHeightSync()
  window.removeEventListener('resize', onResize)
  stopScrollListener()
  disconnectToolbar()
  uiStore.setHeaderTitle('')
  sessionEventsStore.clearContext(activeEventSessionUuid)
})
</script>

<style scoped src="./styles/ViewCharacter.css"></style>
