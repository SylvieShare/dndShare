<template>
  <div class="mobile-swipe-stage" :class="{ dragging: tabDragActive, settling: tabDragSettling, 'mobile-swipe-stage--navigation': navigation }"
    :style="{ '--sheet-navigation-inset': navigationHeight ? `${navigationHeight}px` : undefined }">
    <div v-if="navigation" ref="navigationTarget" class="mobile-sheet-navigation"
      @wheel="onNavigationWheel" @touchstart.passive="onNavigationTouchStart" @touchmove="onNavigationTouchMove"
      @touchend.passive="navigationTouch = null" @touchcancel.passive="navigationTouch = null" />
    <div ref="track" class="mobile-swipe-track" :style="mobileSwipeTrackStyle">
      <div v-for="index in mobileTrackIndexes" :key="tabs[index]?.id ?? index" class="mobile-swipe-pane"
        :inert="index !== activeTab" :style="{ visibility: index === activeTab || tabDragActive || tabDragSettling ? 'visible' : 'hidden' }">
        <div :ref="element => panes[index] = element" class="mobile-pane-scroll"
          @touchstart.passive="event => onTouchStart(event, track)" @touchmove="onTouchMove"
          @click.capture="onSwipeClick"
          @touchend.passive="onTouchEnd" @touchcancel.passive="cancelTouch">
          <slot v-if="isReady(index)" :index="index" />
          <CharacterSheetSkeleton v-else class="mobile-pane-skeleton" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { usePreparedTabs } from '../../composables/usePreparedTabs'
import CharacterSheetSkeleton from './CharacterSheetSkeleton.vue'
const props = defineProps({ controller: { type: Object, required: true }, tabs: { type: Array, required: true }, navigation: Boolean })
const emit = defineEmits(['navigation-target'])
const { activeTab, tabDragActive, tabDragSettling, mobileTrackIndexes, mobileSwipeTrackStyle,
  onTouchStart, onTouchMove, onTouchEnd, cancelTouch, onSwipeClick } = props.controller
const { isReady } = usePreparedTabs(toRef(props, 'tabs'), activeTab, computed(() => tabDragActive.value || tabDragSettling.value))
const track = ref(null), panes = []
const navigationTarget = ref(null), navigationHeight = ref(0)
let navigationTouch = null
watch(navigationTarget, (node, previous, onCleanup) => {
  navigationHeight.value = 0
  emit('navigation-target', node)
  if (!node) return
  const observer = new ResizeObserver(() => {
    if (node.childElementCount) navigationHeight.value = node.offsetHeight
  })
  observer.observe(node)
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })
onBeforeUnmount(() => emit('navigation-target', null))
function onNavigationWheel(event) {
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
  const pane = panes[activeTab.value]
  if (!pane) return
  event.preventDefault()
  pane.scrollTop += event.deltaY
}
function onNavigationTouchStart(event) {
  const touch = event.touches?.[0]
  navigationTouch = touch ? { x: touch.clientX, y: touch.clientY } : null
}
function onNavigationTouchMove(event) {
  const touch = event.touches?.[0], pane = panes[activeTab.value]
  if (!navigationTouch || !touch || !pane) return
  const dx = touch.clientX - navigationTouch.x, dy = touch.clientY - navigationTouch.y
  if (Math.abs(dy) <= Math.abs(dx)) return
  event.preventDefault()
  pane.scrollTop -= dy
  navigationTouch = { x: touch.clientX, y: touch.clientY }
}
defineExpose({ trackElement: () => track.value, scrollElement: index => panes[index] })
</script>
<style scoped>
.mobile-swipe-stage { position:relative;width:100%;height:100%;overflow:hidden;--sheet-navigation-inset:0px; }
.mobile-swipe-stage--navigation { --sheet-navigation-inset:calc(var(--layout-workspace-navigation-height) + 2 * var(--spacing-xs) + 2 * var(--spacing-small)); }
.mobile-sheet-navigation { position:absolute;z-index:10;inset:0 0 auto;min-width:0;box-sizing:border-box;padding:var(--spacing-small) var(--spacing-page);pointer-events:none; }
.mobile-swipe-track { display: flex; width: 100%; height: 100%; will-change: transform; }
.mobile-swipe-pane { flex: 0 0 100%; height: 100%; min-width: 0; overflow: hidden; }
.mobile-pane-scroll { box-sizing: border-box; height: 100%; padding-block-start:var(--sheet-navigation-inset);scroll-padding-block-start:var(--sheet-navigation-inset);overflow-x: hidden; overflow-y: auto; overflow-anchor: none; overscroll-behavior-y: none; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
.mobile-pane-scroll::-webkit-scrollbar { width:var(--spacing-small); }
.mobile-pane-scroll::-webkit-scrollbar-track { margin-top:var(--sheet-navigation-inset);background:transparent; }
.mobile-pane-scroll::-webkit-scrollbar-thumb { border:calc(var(--spacing-xs) / 2) solid transparent;border-radius:var(--radius-large);background:color-mix(in srgb,var(--text-muted) 40%,transparent);background-clip:padding-box; }
.mobile-pane-scroll :deep(> .container) { display: flex; flex-direction: column; min-height: 100%; }
.mobile-pane-skeleton { box-sizing: border-box; padding: var(--spacing-large); }
.settling .mobile-swipe-track { transition: transform .26s cubic-bezier(.25,.1,.25,1); }
@media (prefers-reduced-motion: reduce) { .settling .mobile-swipe-track { transition: none; } }
</style>
