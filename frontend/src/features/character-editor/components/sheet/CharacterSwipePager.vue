<template>
  <div class="mobile-swipe-stage" :class="{ dragging: tabDragActive, settling: tabDragSettling }">
    <div ref="track" class="mobile-swipe-track" :style="mobileSwipeTrackStyle">
      <div v-for="index in mobileTrackIndexes" :key="tabs[index]?.id ?? index" class="mobile-swipe-pane"
        :inert="index !== activeTab" :style="{ visibility: index === activeTab || tabDragActive || tabDragSettling ? 'visible' : 'hidden' }">
        <div :ref="element => panes[index] = element" class="mobile-pane-scroll"
          @touchstart.passive="event => onTouchStart(event, track)" @touchmove="onTouchMove"
          @touchend.passive="onTouchEnd" @touchcancel.passive="cancelTouch">
          <slot v-if="isReady(index)" :index="index" />
          <CharacterSheetSkeleton v-else class="mobile-pane-skeleton" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, toRef } from 'vue'
import { usePreparedTabs } from '../../composables/usePreparedTabs'
import CharacterSheetSkeleton from './CharacterSheetSkeleton.vue'
const props = defineProps({ controller: { type: Object, required: true }, tabs: { type: Array, required: true } })
const { activeTab, tabDragActive, tabDragSettling, mobileTrackIndexes, mobileSwipeTrackStyle,
  onTouchStart, onTouchMove, onTouchEnd, cancelTouch } = props.controller
const { isReady } = usePreparedTabs(toRef(props, 'tabs'), activeTab, computed(() => tabDragActive.value || tabDragSettling.value))
const track = ref(null), panes = []
defineExpose({ trackElement: () => track.value, scrollElement: index => panes[index] })
</script>
<style scoped>
.mobile-swipe-stage { width: 100%; height: 100%; overflow: hidden; }
.mobile-swipe-track { display: flex; width: 100%; height: 100%; will-change: transform; }
.mobile-swipe-pane { flex: 0 0 100%; height: 100%; min-width: 0; overflow: hidden; }
.mobile-pane-scroll { height: 100%; overflow-x: hidden; overflow-y: auto; overflow-anchor: none; overscroll-behavior-y: none; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
.mobile-pane-scroll :deep(> .container) { display: flex; flex-direction: column; min-height: 100%; }
.mobile-pane-skeleton { box-sizing: border-box; padding: var(--spacing-large); }
.settling .mobile-swipe-track { transition: transform .26s cubic-bezier(.25,.1,.25,1); }
@media (prefers-reduced-motion: reduce) { .settling .mobile-swipe-track { transition: none; } }
</style>
