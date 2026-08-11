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
      :sourceVersionId="sourceVersionId"
      :contentSources="contentSources"
      :sessions="sessions"
      :topSession="topSession"
      @update:publicVisible="onPublicToggle"
      @update:activeTab="onSetActiveTab"
      @update:value="onUpdateValue"
      @update:var="onUpdateVar"
      @update:contentSources="onUpdateContentSources"
      @wheel.prevent="onFixedHeaderWheel"
      @touchstart.passive="onFixedHeaderTouchStart"
      @touchmove="onFixedHeaderTouchMove"
      @touchend.passive="onFixedHeaderTouchEnd"
      @touchcancel.passive="onFixedHeaderTouchEnd"
    />

    <div v-if="mobileIdentityEditorBlock" class="mobile-identity-editor">
      <TemplateBlockInner
        :block="mobileIdentityEditorBlock"
        :values="data.values"
        :vars="data.var"
        @update:value="onUpdateValue"
        @update:var="onUpdateVar"
      />
    </div>

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
              <div
                class="container"
                :class="{ 'mobile-tab-surface': activeTabs[index]?.surface }"
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
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TemplateBlockInner from '@/features/character-editor/components/TemplateBlockInner'
import CharacterTabPane from '@/features/character-editor/components/CharacterTabPane.vue'
import CharEditorToolbar from '@/features/character-editor/components/CharEditorToolbar'
import { useCharacterData } from '@/features/character-editor/composables/useCharacterData'
import { useSaveDebounce } from '@/features/character-editor/composables/useSaveDebounce'
import { useTabSwipe } from '@/features/character-editor/composables/useTabSwipe'
import { useScrollHide } from '@/features/character-editor/composables/useScrollHide'
import { useCharacterViewport } from '@/features/character-editor/composables/characterViewport'
import { useUiStore } from '@/stores/ui'
import { initialTabs, layoutNodeToBlock } from '@/features/character-editor/lib/templateSchema'
import { defaultTabIndex, parseTabQuery, queryForTab } from '@/features/character-editor/lib/tabQuery'

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

// ── Template refs ─────────────────────────────────────────────────────
const charToolbarEl = ref(null)
const sheetScrollEl = ref(null)
const mobileTabbarEl = ref(null)
const mobileTrackEl = ref(null)
const mobilePaneScrollRefs = ref([])
const fixedHeaderTouch = ref(null)

const TabPane = CharacterTabPane

// ── Composables ───────────────────────────────────────────────────────

const {
  loading, template, data, charCtx, isOwner, publicVisible,
  version, sourceVersionId, contentSources, sessions, topSession, hasActiveSession,
  loadSessions, pollVersion, refreshFromServer,
  activeTabs, toolbarTabs, mobileTabs,
  headerTitle, charName, charSub, toolbarBlocksList, commonMobileBlockNode, commonMobileScrollHide,
  load, loadSync, blocksForTab, containerWidthForTab, getInitialTabs,
  updateValue, updateVar, updateContentSources, onPublicToggle, invalidateTabCache,
} = useCharacterData(uuid, isMobile)

const mobileIdentityEditorBlock = computed(() =>
  isMobile.value && template.value
    ? layoutNodeToBlock({ kind: 'block', ref: 'char_identity' }, template.value)
    : null
)

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
  sourceVersionId,
  contentSources,
  setContentSources: value => {
    updateContentSources(value)
    scheduleSave()
  },
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
} = useTabSwipe(activeTabs, isMobile, mobileTabbarEl)

const {
  toolbarHeight, stripHidden, viewStyle,
  startScrollListener, stopScrollListener, revealHeader, observeToolbar, disconnectToolbar,
} = useScrollHide(isMobile, commonMobileScrollHide)

const { startViewportHeightSync, stopViewportHeightSync } = useCharacterViewport(isMobile)

// ── Watchers ──────────────────────────────────────────────────────────

watch(activeTabs, () => { invalidateTabCache() })

watch(headerTitle, () => { uiStore.setHeaderTitle(headerTitle.value) })

watch(activeTab, () => { pushQueryState() })

watch(() => route.query.tab, tab => {
  if (!ready) return
  const nextTab = parseTabQuery(tab, activeTabs.value.length, defaultTabIndex(getInitialTabs()))
  if (nextTab === activeTab.value) return
  syncingTabFromRoute = true
  onSetActiveTab(nextTab)
  nextTick(() => { syncingTabFromRoute = false })
})

watch([activeTab, isMobile], () => {
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
  updateValue(event)
  nextTick(() => uiStore.setHeaderTitle(headerTitle.value))
  scheduleSave()
}

function onUpdateVar(patch) {
  updateVar(patch)
  scheduleSave()
}

function onUpdateContentSources(value) {
  updateContentSources(value)
  scheduleSave()
}

function onSetActiveTab(index) {
  updateMobileTabRects(mobileTabbarEl.value)
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
  if (!ready || syncingTabFromRoute) return
  const tabs = getInitialTabs()
  const query = queryForTab(route.query, activeTab.value, defaultTabIndex(tabs))
  router.push({ query })
}

// ── Lifecycle ─────────────────────────────────────────────────────────

onMounted(async () => {
  document.body.classList.add('character-view-active')
  startViewportHeightSync()
  window.scrollTo(0, 0)

  const savedQueryTab = route.query.tab

  mediaQuery = window.matchMedia('(max-width: 640px)')
  isMobile.value = mediaQuery.matches
  onMediaQueryChange = e => {
    isMobile.value = e.matches
  }
  mediaQuery.addEventListener('change', onMediaQueryChange)

  const res = await load()
  if (!res) return

  const tabs = initialTabs(res.template)
  const defaultIdx = defaultTabIndex(tabs)
  activeTab.value = defaultIdx
  markTabVisited(activeTab.value)

  uiStore.setHeaderTitle(headerTitle.value)

  window.addEventListener('resize', onResize)

  await nextTick()

  onSetActiveTab(parseTabQuery(savedQueryTab, activeTabs.value.length, defaultIdx))

  ready = true

  nextTick(() => {
    observeToolbar(charToolbarEl.value?.rootElement?.())
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
  stopScrollListener()
  disconnectToolbar()
  uiStore.setHeaderTitle('')
})
</script>

<style scoped src="./styles/ViewCharacter.css"></style>
