<template>
  <div class="view" :style="viewStyle">
    <CharEditorToolbar
      v-if="isMobile"
      ref="charToolbarEl"
      :publicVisible="publicVisible"
      :saveStatus="saveStatus"
      :pendingSecondsLeft="pendingSecondsLeft"
      :canEdit="isOwner"
      :tabs="toolbarTabs"
      :activeTab="activeTab"
      :toolbarBlocksList="toolbarBlocksList"
      :toolbarValues="data.values"
      :toolbarVars="data.var"
      :charName="charName"
      :charSub="charSub"
      :sessions="sessions"
      :topSession="topSession"
      @update:publicVisible="onPublicToggle"
      @update:activeTab="onSetActiveTab"
      @update:value="onUpdateValue"
      @update:var="onUpdateVar"
      @wheel.prevent="onFixedHeaderWheel"
      @touchstart.passive="onFixedHeaderTouchStart"
      @touchmove="onFixedHeaderTouchMove"
      @touchend.passive="onFixedHeaderTouchEnd"
      @touchcancel.passive="onFixedHeaderTouchEnd"
    />

    <div
      v-if="isMobile && (commonMobileBlockNode || mobileTabs.length)"
      class="mobile-sticky-header"
      :style="{ top: toolbarHeight + 'px' }"
      @wheel.prevent="onFixedHeaderWheel"
      @touchstart.passive="onFixedHeaderTouchStart"
      @touchmove="onFixedHeaderTouchMove"
      @touchend.passive="onFixedHeaderTouchEnd"
      @touchcancel.passive="onFixedHeaderTouchEnd"
    >
      <div
        v-if="commonMobileBlockNode"
        class="common-mobile-strip"
        :class="{ 'strip-hidden': stripHidden && commonMobileScrollHide }"
      >
        <TemplateBlockInner
          :block="commonMobileBlockNode"
          :values="data.values"
          :vars="data.var"
          @update:value="onUpdateValue"
          @update:var="onUpdateVar"
        />
      </div>

      <nav
        v-if="mobileTabs.length"
        ref="mobileTabbarEl"
        class="mobile-tabbar"
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
          type="button"
          :title="tab.title || 'Раздел'"
          @click="onSetActiveTab(i)"
        >
          <img v-if="tab.svg" class="mobile-tab-icon" :src="tab.svg" :alt="tab.title || 'Раздел'" />
          <span v-else>{{ tab.title || 'Раздел' }}</span>
        </button>
      </nav>
    </div>

    <div
      ref="sheetScrollEl"
      class="sheet-scroll"
      @touchstart.passive="e => { if (!isMobile) onTouchStart(e, sheetScrollEl) }"
      @touchmove="e => { if (!isMobile) onTouchMove(e) }"
      @touchend.passive="e => { if (!isMobile) onTouchEnd(e) }"
      @touchcancel.passive="() => { if (!isMobile) cancelTouch() }"
    >
      <div v-if="loading" class="container sk-container">
        <div class="sk-block" style="width:100%; height:52px" />
        <div class="sk-block" style="width:180px; height:160px" />
        <div class="sk-block" style="width:180px; height:160px" />
        <div class="sk-block" style="width:180px; height:160px" />
        <div class="sk-block" style="width:100%; height:90px" />
        <div class="sk-block" style="width:260px; height:120px" />
        <div class="sk-block" style="width:260px; height:120px" />
      </div>
      <div v-else-if="isMobile && template" class="mobile-swipe-stage" :class="{ dragging: tabDragActive, settling: tabDragSettling }">
        <div ref="mobileTrackEl" class="mobile-swipe-track" :style="mobileSwipeTrackStyle">
          <div
            v-for="index in mobileTrackIndexes"
            :key="'mobile-tab-' + index"
            class="mobile-swipe-pane"
          >
            <div
              :ref="el => setMobilePaneScrollRef(el, index)"
              class="mobile-pane-scroll"
              @touchstart.passive="e => onTouchStart(e, mobileTrackEl)"
              @touchmove="onTouchMove"
              @touchend.passive="onTouchEnd"
              @touchcancel.passive="cancelTouch"
            >
              <div class="container" :style="containerWidthForTab(index)">
                <component
                  :is="tabRenderComponent(index, TabPane)"
                  :tab-index="index"
                  :blocks="blocksForTab(index)"
                  :values="data.values"
                  :vars="data.var"
                  @update:value="onUpdateValue"
                  @update:var="onUpdateVar"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="template" class="desktop-tabs">
        <div
          v-for="index in visitedTabIndexes"
          :key="'desktop-tab-' + index"
          v-show="index === activeTab"
          class="container"
          :style="containerWidthForTab(index)"
        >
          <component
            :is="tabRenderComponent(index, TabPane)"
            :tab-index="index"
            :blocks="blocksForTab(index)"
            :values="data.values"
            :vars="data.var"
            @update:value="onUpdateValue"
            @update:var="onUpdateVar"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, h, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TemplateBlockInner from '@/features/character-editor/components/TemplateBlockInner'
import CharEditorToolbar from '@/features/character-editor/components/CharEditorToolbar'
import { useCharacterData } from '@/features/character-editor/composables/useCharacterData'
import { useSaveDebounce } from '@/features/character-editor/composables/useSaveDebounce'
import { useTabSwipe } from '@/features/character-editor/composables/useTabSwipe'
import { useScrollHide } from '@/features/character-editor/composables/useScrollHide'
import { useUiStore } from '@/stores/ui'
import { initialTabs } from '@/features/character-editor/lib/templateSchema'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()
// Snapshot the uuid from the route. Guard against the rare race where setup runs
// before route params settle (would otherwise fetch /char/undefined).
const uuid = route.params.uuid || router.currentRoute.value.params.uuid

// ── Mobile detection ──────────────────────────────────────────────────
const isMobile = ref(false)
let mediaQuery = null
let onMediaQueryChange = null
let onViewportChange = null
let onWindowResize = null
let viewportHeightTimer = null

// ── Template refs ─────────────────────────────────────────────────────
const charToolbarEl = ref(null)
const sheetScrollEl = ref(null)
const mobileTabbarEl = ref(null)
const mobileTrackEl = ref(null)
const mobilePaneScrollRefs = ref([])
const fixedHeaderTouch = ref(null)

// ── TabPane: stable render component for tab content ──────────────────
const TabPane = {
  name: 'CharacterTabPane',
  components: { TemplateBlockInner },
  props: {
    tabIndex: { type: Number, required: true },
    blocks: { type: Array, default: () => [] },
    values: { type: Object, default: () => ({}) },
    vars: { type: Object, default: () => ({}) },
  },
  emits: ['update:value', 'update:var'],
  render() {
    return this.blocks.map((block, i) => h(TemplateBlockInner, {
      key: i,
      block,
      values: this.values,
      vars: this.vars,
      'onUpdate:value': event => this.$emit('update:value', event),
      'onUpdate:var': event => this.$emit('update:var', event),
    }))
  },
}

// ── Composables ───────────────────────────────────────────────────────

const {
  loading, template, data, charCtx, isOwner, publicVisible,
  version, sessions, topSession, hasActiveSession,
  loadSessions, pollVersion, refreshFromServer,
  activeTabs, toolbarTabs, mobileTabs,
  headerTitle, charName, charSub, toolbarBlocksList, commonMobileBlockNode, commonMobileScrollHide,
  load, loadSync, blocksForTab, containerWidthForTab, getInitialTabs,
  updateValue, updateVar, onPublicToggle, invalidateTabCache,
} = useCharacterData(uuid, isMobile)

// Apply the list seed synchronously in setup so the expand overlay renders with
// content in the same tick the View Transition snapshots it. onMounted then does
// the full load (which short-circuits when the seed already populated state).
loadSync()

const { saveStatus, pendingSecondsLeft, scheduleSave } = useSaveDebounce(uuid, data)

// Expose menu/session state to in-sheet blocks (SettingsMenuTile, CampaignBadge) on desktop, where the
// toolbar is gone. charCtx is reactive, so assigned refs auto-unwrap on read.
Object.assign(charCtx, {
  canEdit: isOwner,
  publicVisible,
  setPublic: onPublicToggle,
  canTogglePublic: isOwner,
  saveStatus,
  pendingSecondsLeft,
  sessions,
  topSession,
})

const {
  activeTab, visitedTabIndexes, highlightedMobileTab,
  tabDragActive, tabDragSettling,
  mobileTrackIndexes, mobileSwipeTrackStyle, mobileTabIndicatorStyle,
  markTabVisited, setMobileTabButtonRef, updateMobileTabRects,
  scrollActiveMobileTabIntoView, setActiveTab,
  onTouchStart, onTouchMove, onTouchEnd, cancelTouch,
  tabRenderComponent, tabKey,
} = useTabSwipe(activeTabs, isMobile)

const {
  toolbarHeight, stripHidden, viewStyle,
  startScrollListener, stopScrollListener, observeToolbar, disconnectToolbar,
} = useScrollHide(isMobile, commonMobileScrollHide)

// ── Watchers ──────────────────────────────────────────────────────────

watch(activeTabs, () => { invalidateTabCache() })

watch(headerTitle, () => { uiStore.setHeaderTitle(headerTitle.value) })

watch(activeTab, () => { pushQueryState() })

watch([activeTab, isMobile], () => {
  const preserveHeaderHidden = uiStore.headerHidden
  nextTick(() => syncActiveScrollListener({ preserveHeaderHidden }))
})

// ── Event handlers (bridge composable calls + side-effects) ──────────

function onUpdateValue(event) {
  updateValue(event)
  nextTick(() => uiStore.setHeaderTitle(headerTitle.value))
  scheduleSave()
}

function onUpdateVar(patch) {
  updateVar(patch)
  scheduleSave()
}

function onSetActiveTab(index) {
  setActiveTab(index, mobileTrackEl.value, mobileTabbarEl.value)
}

function onResize() {
  updateMobileTabRects(mobileTabbarEl.value)
}

function setMobilePaneScrollRef(el, index) {
  if (el) mobilePaneScrollRefs.value[index] = el
}

function activeScrollElement() {
  return isMobile.value
    ? mobilePaneScrollRefs.value[activeTab.value]
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
    uiStore.setHeaderHidden(false)
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

function updateCharacterViewportHeight() {
  const layoutHeight = window.innerHeight || document.documentElement.clientHeight
  const visualHeight = window.visualViewport?.height || 0
  const keyboardLikelyOpen = visualHeight > 0 && layoutHeight > 0 && visualHeight < layoutHeight - 120
  const height = keyboardLikelyOpen
    ? layoutHeight
    : (visualHeight || layoutHeight)
  if (height) {
    document.documentElement.style.setProperty('--character-viewport-height', `${Math.round(height)}px`)
  }
}

function scheduleViewportHeightUpdate() {
  updateCharacterViewportHeight()
  clearTimeout(viewportHeightTimer)
  viewportHeightTimer = setTimeout(updateCharacterViewportHeight, 250)
}

function startViewportHeightSync() {
  onViewportChange = scheduleViewportHeightUpdate
  onWindowResize = scheduleViewportHeightUpdate

  updateCharacterViewportHeight()
  window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true })
  window.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true })
  window.addEventListener('resize', onWindowResize, { passive: true })
  window.addEventListener('orientationchange', onWindowResize, { passive: true })
}

function stopViewportHeightSync() {
  clearTimeout(viewportHeightTimer)
  window.visualViewport?.removeEventListener('resize', onViewportChange)
  window.visualViewport?.removeEventListener('scroll', onViewportChange)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('orientationchange', onWindowResize)
  document.documentElement.style.removeProperty('--character-viewport-height')
  onViewportChange = null
  onWindowResize = null
}

// ── URL sync ──────────────────────────────────────────────────────────

let ready = false

// ── Polling сессий / версии ───────────────────────────────────────────
const VERSION_POLL_MS = 5000
let versionPollTimer = null
let versionPollInFlight = false

async function tickVersionPoll() {
  if (versionPollInFlight) return
  if (saveStatus.value !== 'idle') return
  if (!hasActiveSession.value) return
  versionPollInFlight = true
  try {
    const remote = await pollVersion()
    if (remote > version.value && saveStatus.value === 'idle') {
      await refreshFromServer()
    }
  } finally {
    versionPollInFlight = false
  }
}

function startVersionPolling() {
  stopVersionPolling()
  versionPollTimer = setInterval(tickVersionPoll, VERSION_POLL_MS)
}

function stopVersionPolling() {
  if (versionPollTimer) { clearInterval(versionPollTimer); versionPollTimer = null }
}

function pushQueryState() {
  if (!ready) return
  const tabs = getInitialTabs()
  const defaultIdx = tabs.findIndex(t => t.default)
  const def = defaultIdx >= 0 ? defaultIdx : 0
  const query = {}
  if (activeTab.value !== def) query.tab = String(activeTab.value)
  router.replace({ query })
}

// ── Lifecycle ─────────────────────────────────────────────────────────

onMounted(async () => {
  document.body.classList.add('character-view-active')
  startViewportHeightSync()
  window.scrollTo(0, 0)

  const savedQueryTab = parseInt(route.query.tab)

  mediaQuery = window.matchMedia('(max-width: 640px)')
  isMobile.value = mediaQuery.matches
  onMediaQueryChange = e => {
    isMobile.value = e.matches
    scheduleViewportHeightUpdate()
  }
  mediaQuery.addEventListener('change', onMediaQueryChange)

  const res = await load()
  if (!res) return

  const tabs = initialTabs(res.template)
  const defaultIdx = tabs.findIndex(t => t.default)
  activeTab.value = defaultIdx >= 0 ? defaultIdx : 0
  markTabVisited(activeTab.value)

  uiStore.setHeaderTitle(headerTitle.value)

  window.addEventListener('resize', onResize)

  await nextTick()

  if (!isNaN(savedQueryTab) && savedQueryTab >= 0 && savedQueryTab < activeTabs.value.length) {
    onSetActiveTab(savedQueryTab)
  }

  ready = true

  nextTick(() => {
    if (charToolbarEl.value) observeToolbar(charToolbarEl.value.$el)
    updateMobileTabRects(mobileTabbarEl.value)
    scrollActiveMobileTabIntoView()
    syncActiveScrollListener()
  })

  loadSessions()
  startVersionPolling()
})

onBeforeUnmount(() => {
  stopVersionPolling()
  document.body.classList.remove('character-view-active')
  stopViewportHeightSync()
  mediaQuery?.removeEventListener('change', onMediaQueryChange)
  window.removeEventListener('resize', onResize)
  stopScrollListener(activeScrollElement())
  disconnectToolbar()
  uiStore.setHeaderTitle('')
})
</script>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 54px); /* overridden by viewStyle computed */
  overflow: hidden;
}

:global(body.character-view-active) {
  overflow: hidden;
}

.sheet-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 100vw;
  overflow-x: auto;
  overflow-y: auto;
  overscroll-behavior-y: none;
}

.container {
  margin: 0 auto;
}

.desktop-tabs {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.desktop-tabs > .container {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

@media (max-width: 640px) {
  .view {
    height: calc(100vh - 50px); /* overridden by viewStyle computed */
  }

  .container {
    padding: 18px 14px 24px;
  }

  .mobile-pane-scroll > .container {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding-bottom: max(88px, calc(24px + env(safe-area-inset-bottom)));
  }

  .sheet-scroll {
    overflow-x: hidden;
    overflow-y: hidden;
  }

  .mobile-sticky-header {
    position: sticky;
    z-index: 19;
    background: var(--bg-header);
  }

  .common-mobile-strip {
    overflow: hidden;
    max-height: 56px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    transition: max-height 0.25s ease, padding-top 0.25s ease, padding-bottom 0.25s ease, opacity 0.2s ease;
  }

  .common-mobile-strip.strip-hidden {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
  }

  .mobile-swipe-stage {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .mobile-swipe-track {
    display: flex;
    width: 100%;
    height: 100%;
    will-change: transform;
  }

  .mobile-swipe-pane {
    flex: 0 0 100%;
    height: 100%;
    min-width: 0;
    overflow: hidden;
  }

  .mobile-pane-scroll {
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: none;
    -webkit-overflow-scrolling: touch;
    scroll-padding-bottom: max(88px, calc(24px + env(safe-area-inset-bottom)));
  }

  .mobile-swipe-stage.settling .mobile-swipe-track {
    transition: transform 0.26s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  .mobile-tabbar {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 4px;
    padding: 6px 8px 8px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border);
    background: var(--bg-header);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    min-height: 44px;
  }

  .mobile-tabbar::-webkit-scrollbar {
    display: none;
  }

  .mobile-tab-btn {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 1 0 auto;
    min-width: 44px;
    max-width: 148px;
    min-height: 30px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    padding: 0 12px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    touch-action: manipulation;
    transition: color 0.15s;
  }

  .mobile-tab-btn.active {
    color: var(--text-1);
  }

  .mobile-tab-indicator {
    position: absolute;
    left: 0;
    bottom: 4px;
    height: 3px;
    border-radius: 999px;
    background: var(--accent);
    pointer-events: none;
    transition: transform 0.18s ease, width 0.18s ease;
  }

  .mobile-tabbar.dragging .mobile-tab-indicator {
    transition: none;
  }

  .mobile-tabbar.settling .mobile-tab-indicator {
    transition: transform 0.26s cubic-bezier(0.25, 0.1, 0.25, 1), width 0.26s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  .mobile-tab-icon {
    width: 22px;
    height: 22px;
    display: block;
    object-fit: contain;
    opacity: 0.72;
    transition: opacity 0.15s ease, filter 0.15s ease;
  }

  .mobile-tab-btn.active .mobile-tab-icon {
    opacity: 1;
    filter: brightness(1.35);
  }
}

.sk-container {
  max-width: 900px;
}

.sk-block {
  border-radius: 12px;
  background: #1e1e26;
  animation: sk-pulse 1.4s ease-in-out infinite;
}

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
</style>
