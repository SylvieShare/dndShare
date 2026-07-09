<template>
  <div class="inner-tabs">
    <SlidingTabs :tabs="tabItems" :model-value="activeTab" @update:model-value="setTab" />

    <BaseTile ref="contentEl" class="inner-tabs-content">
      <div
        v-for="(tab, i) in block.tabs"
        :key="i"
        class="inner-tab-pane"
        :class="{ 'inner-tab-pane--active': activeTab === i }"
      >
        <TemplateBlockInner
          v-if="visitedTabs.includes(i)"
          :block="tab.block"
          :values="values"
          :vars="vars"
          @update:value="emitValue"
          @update:var="emitVar"
        />
      </div>
    </BaseTile>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import SlidingTabs from '@/shared/ui/SlidingTabs'
import TemplateBlockInner from '@/features/character-editor/components/TemplateBlockInner'

const props = defineProps(['block', 'values', 'vars'])
const emit = defineEmits(['update:value', 'update:var'])

const activeTab = ref(0)
const visitedTabs = ref([0])
const contentEl = ref(null)
let pendingFrom = null

const tabItems = computed(() =>
  (props.block.tabs || []).map((tab, i) => ({ key: i, title: tab.title, svg: tab.svg }))
)

function contentDom() {
  const c = contentEl.value
  return c?.$el || c || null
}

function setTab(i) {
  if (i === activeTab.value) return
  const el = contentDom()
  pendingFrom = el ? el.offsetHeight : null
  activeTab.value = i
}

// Animate the content tile's height between the old and new pane (FLIP). Outside a switch the height
// stays `auto`, so it tracks its content (and the page scrolls) without JS.
function animateHeight(from) {
  const el = contentDom()
  if (!el) return
  el.style.transition = 'none'
  el.style.height = 'auto'
  const to = el.offsetHeight
  if (from == null || from === to) { el.style.height = ''; return }
  el.style.height = `${from}px`
  void el.offsetWidth
  el.style.transition = 'height 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
  el.style.height = `${to}px`
  const onEnd = e => {
    if (e.propertyName !== 'height') return
    el.style.transition = 'none'
    el.style.height = ''
    el.removeEventListener('transitionend', onEnd)
  }
  el.addEventListener('transitionend', onEnd)
}

watch(activeTab, i => {
  if (!visitedTabs.value.includes(i)) visitedTabs.value = [...visitedTabs.value, i]
  nextTick(() => {
    animateHeight(pendingFrom)
    pendingFrom = null
  })
})

function emitValue(patch) {
  emit('update:value', patch)
}

function emitVar(patch) {
  emit('update:var', patch)
}
</script>

<style scoped>
.inner-tabs {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-width: 0;
  box-sizing: border-box;
  gap: 0;
}

/* Content panel — a BaseTile (background + radius come from it). Height tracks the active pane's
   content (auto); JS animates it between panes on tab switch. */
.inner-tabs-content {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  overflow: hidden;
}

/* All visited panes stay mounted; the active one is in flow (defines height, so
   tall content isn't clipped and the page scrolls), the rest overlay and fade. */
.inner-tab-pane {
  display: flex;
  flex-direction: column;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.inner-tab-pane:not(.inner-tab-pane--active) {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.inner-tab-pane--active {
  opacity: 1;
  pointer-events: auto;
}

.inner-tab-pane :deep(> .block-wrap),
.inner-tab-pane :deep(> .block-with-title) {
  flex: 1 1 auto;
}

@media (max-width: 640px) {
  .inner-tabs-content {
    padding: 20px 16px;
  }
}
</style>
