<template>
  <aside
    ref="element"
    class="map-sidebar"
    :style="{
      '--map-sidebar-panel-width':
        panelWidth == null ? undefined : `${panelWidth}px`,
    }"
    :class="{
      'map-sidebar--collapsed': collapsed,
      'map-sidebar--opening': opening,
      'map-sidebar--overlay': overlay,
    }"
  >
    <nav ref="navigation" class="map-sidebar-tabs" :aria-label="tabsLabel">
      <span
        class="map-sidebar-indicator"
        :style="indicatorStyle"
        aria-hidden="true"
      />
      <template v-for="item in tabs" :key="item.key">
        <span
          v-if="item.divider"
          class="map-sidebar-divider"
          role="separator"
          :aria-label="item.dividerLabel || 'Группы вкладок'"
        />
        <ActionButton
          :ref="(button) => setButton(item.key, button)"
          class="map-sidebar-tab"
          icon-only
          variant="quiet"
          :aria-label="item.label"
          :title="item.label"
          :aria-pressed="tab === item.key && !collapsed"
          @click="openTab(item.key)"
        >
          <template #icon><component :is="item.icon" :size="22" /></template>
        </ActionButton>
      </template>
    </nav>
    <div
      class="map-sidebar-panel"
      :class="{ 'map-glass-panel': overlay }"
      :inert="collapsed"
      :aria-hidden="collapsed || undefined"
    >
      <header class="map-sidebar-heading">
        <Transition name="map-sidebar-title" mode="out-in"
          ><strong :key="tab">{{
            tabs.find((item) => item.key === tab)?.label
          }}</strong></Transition
        >
        <ActionButton
          variant="quiet"
          icon-only
          aria-label="Свернуть панель карты"
          title="Свернуть панель карты"
          :aria-expanded="!collapsed"
          @click="collapse"
        >
          <template #icon><PanelLeftClose :size="20" /></template>
        </ActionButton>
      </header>
      <div class="map-sidebar-viewport">
        <Transition
          name="map-sidebar-page"
          mode="out-in"
          @before-leave="leavePage"
          @before-enter="enterPage"
        >
          <div :key="tab" class="map-sidebar-content" :data-tab="tab">
            <slot />
          </div>
        </Transition>
      </div>
    </div>
  </aside>
</template>
<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { PanelLeftClose } from "@lucide/vue";
const props = defineProps({
  tabs: { type: Array, required: true },
  tab: { type: String, required: true },
  tabsLabel: { type: String, default: "Вкладки карты" },
  collapseAt: { type: Number, default: 760 },
  overlay: Boolean,
});
const emit = defineEmits(["update:tab", "select", "resize"]);
const element = ref(null);
const navigation = ref(null),
  buttons = new Map(),
  indicator = ref(null);
const indicatorStyle = computed(() => ({
  transform: `translateY(${indicator.value?.y || 0}px)`,
  width: `${indicator.value?.width || 0}px`,
  height: `${indicator.value?.height || 0}px`,
  opacity: indicator.value && !collapsed.value ? 1 : 0,
}));
const collapsed = ref(
  window.matchMedia(`(max-width: ${props.collapseAt}px)`).matches,
);
const opening = ref(false);
const panelWidth = ref(null);
let observer,
  revealTimer = 0;
let measuredParent = -1,
  measuredViewport = -1;
let direction = 1;
function measurePanel() {
  const node = element.value,
    parent = node?.parentElement;
  if (!parent) return;
  const width = parent.getBoundingClientRect().width;
  if (width === measuredParent && innerWidth === measuredViewport) return;
  measuredParent = width;
  measuredViewport = innerWidth;
  // Resolve the consumer's max-width without interrupting the live width animation.
  const probe = node.cloneNode(false);
  probe.classList.remove("map-sidebar--collapsed", "map-sidebar--opening");
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    height: "0",
    transition: "none",
    pointerEvents: "none",
  });
  parent.append(probe);
  panelWidth.value = Math.max(0, probe.getBoundingClientRect().width - 61);
  probe.remove();
}
function setButton(key, button) {
  if (button) buttons.set(key, button.$el);
  else buttons.delete(key);
}
function updateIndicator() {
  const button = buttons.get(props.tab);
  indicator.value = button
    ? {
        y: button.offsetTop,
        width: button.offsetWidth,
        height: button.offsetHeight,
      }
    : null;
}
watch(
  () => props.tab,
  (next, previous) => {
    direction =
      props.tabs.findIndex((item) => item.key === next) >
      props.tabs.findIndex((item) => item.key === previous)
        ? 1
        : -1;
  },
  { flush: "sync" },
);
watch([() => props.tab, () => props.tabs, collapsed], () =>
  nextTick(updateIndicator),
);
function leavePage(node) {
  node.inert = true;
  node.setAttribute("aria-hidden", "true");
  node.style.setProperty("--map-tab-offset", `${direction * 18}px`);
}
function enterPage(node) {
  node.style.setProperty("--map-tab-offset", `${direction * 18}px`);
}
function openTab(key) {
  const reveal = collapsed.value;
  if (reveal) {
    opening.value = true;
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      opening.value = false;
    }, 280);
  }
  emit("update:tab", key);
  collapsed.value = false;
  emit("select", key);
}
function collapse() {
  collapsed.value = true;
  opening.value = false;
  clearTimeout(revealTimer);
}
onMounted(() => {
  measurePanel();
  updateIndicator();
  observer = new ResizeObserver(() => {
    measurePanel();
    emit(
      "resize",
      element.value.getBoundingClientRect().width,
      navigation.value.getBoundingClientRect().width,
    );
    updateIndicator();
  });
  observer.observe(element.value);
  observer.observe(navigation.value);
  observer.observe(element.value.parentElement);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(revealTimer);
});
defineExpose({
  openTab,
  collapse,
  bounds: () => element.value?.getBoundingClientRect(),
});
</script>
<style scoped>
.map-sidebar {
  --map-sidebar-width: 334px;
  width: var(--map-sidebar-width);
  flex: none;
  min-height: 0;
  display: flex;
  border-right: 1px solid var(--border-strong);
  background: var(--surface);
  overflow: clip;
  transition: width 260ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.map-sidebar-tabs {
  position: relative;
  z-index: 1;
  isolation: isolate;
  width: 60px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 5px 6px 6px;
  border-right: 1px solid var(--border-strong);
  background: var(--surface);
}
.map-sidebar--overlay {
  position: absolute;
  z-index: 20;
  inset: 0 auto 0 0;
  background: transparent;
  pointer-events: none;
}
.map-sidebar--overlay > .map-sidebar-tabs,
.map-sidebar--overlay > .map-sidebar-panel {
  pointer-events: auto;
}
.map-sidebar--overlay.map-sidebar--collapsed > .map-sidebar-panel {
  pointer-events: none;
}
.map-sidebar-indicator {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 6px;
  border-radius: 8px;
  background: var(--accent);
  pointer-events: none;
  transition:
    transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 150ms ease;
}
.map-sidebar--opening .map-sidebar-indicator,
.map-sidebar--opening .map-sidebar-page-enter-active,
.map-sidebar--opening .map-sidebar-page-leave-active,
.map-sidebar--opening .map-sidebar-title-enter-active,
.map-sidebar--opening .map-sidebar-title-leave-active {
  transition: none;
}
.map-sidebar--opening .map-sidebar-page-enter-from,
.map-sidebar--opening .map-sidebar-page-leave-to {
  transform: none;
}
.map-sidebar--opening .map-sidebar-page-leave-active,
.map-sidebar--opening .map-sidebar-title-leave-active {
  visibility: hidden;
}
.map-sidebar-tab {
  position: relative;
  z-index: 1;
}
.map-sidebar-tab[aria-pressed="false"]:hover:not(:disabled) {
  background: transparent;
  border-color: var(--border-strong);
}
.map-sidebar-tab[aria-pressed="true"],
.map-sidebar-tab[aria-pressed="true"]:hover:not(:disabled) {
  color: var(--text-on-accent);
  background: transparent;
  border-color: transparent;
}
.map-sidebar-divider {
  border-top: 1px solid var(--border-strong);
  margin: 4px 8px;
}
.map-sidebar-panel {
  flex: none;
  width: var(--map-sidebar-panel-width, calc(var(--map-sidebar-width) - 61px));
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition:
    opacity 180ms ease,
    transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.map-sidebar--collapsed {
  width: 60px;
}
.map-sidebar--collapsed .map-sidebar-panel {
  opacity: 0;
  transform: translateX(-8px);
}
.map-sidebar-heading {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
}
.map-sidebar-heading strong {
  font-size: 16px;
  padding-left: 6px;
}
.map-sidebar-viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.map-sidebar-content {
  flex: 1;
  --map-panel-inset: 12px;
  display: flex;
  flex-direction: column;
  gap: 25px;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px 18px;
}
.map-sidebar-page-enter-active {
  transition:
    transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 180ms ease;
}
.map-sidebar-page-leave-active {
  pointer-events: none;
  transition:
    transform 130ms ease,
    opacity 130ms ease;
}
.map-sidebar-page-enter-from {
  opacity: 0;
  transform: translateY(var(--map-tab-offset));
}
.map-sidebar-page-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--map-tab-offset)));
}
.map-sidebar-title-enter-active,
.map-sidebar-title-leave-active {
  transition: opacity 130ms ease;
}
.map-sidebar-title-enter-from,
.map-sidebar-title-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .map-sidebar,
  .map-sidebar-panel,
  .map-sidebar-indicator,
  .map-sidebar-page-enter-active,
  .map-sidebar-page-leave-active,
  .map-sidebar-title-enter-active,
  .map-sidebar-title-leave-active {
    transition: none;
  }
}
.map-sidebar-content :deep(hr) {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--border-strong);
}
@media (max-width: 760px) {
  .map-sidebar {
    --map-sidebar-width: min(334px, calc(100vw - 100px));
  }
}
</style>
