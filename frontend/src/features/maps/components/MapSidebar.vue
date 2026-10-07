<template>
  <aside ref="element" class="map-sidebar" :class="{ 'map-sidebar--collapsed': collapsed }">
    <nav class="map-sidebar-tabs" :aria-label="tabsLabel">
      <ActionButton v-for="item in tabs" :key="item.key" icon-only
        :variant="tab === item.key && !collapsed ? 'primary' : 'quiet'"
        :aria-label="item.label" :title="item.label" :aria-pressed="tab === item.key && !collapsed"
        @click="openTab(item.key)">
        <template #icon><component :is="item.icon" :size="22" /></template>
      </ActionButton>
    </nav>
    <div v-show="!collapsed" class="map-sidebar-panel">
      <header class="map-sidebar-heading">
        <strong>{{ tabs.find(item => item.key === tab)?.label }}</strong>
        <ActionButton variant="quiet" icon-only aria-label="Свернуть панель карты" title="Свернуть панель карты"
          :aria-expanded="!collapsed" @click="collapsed = true">
          <template #icon><PanelLeftClose :size="20" /></template>
        </ActionButton>
      </header>
      <div class="map-sidebar-content"><slot /></div>
    </div>
  </aside>
</template>
<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { PanelLeftClose } from '@lucide/vue'
const props = defineProps({
  tabs: { type: Array, required: true },
  tab: { type: String, required: true },
  tabsLabel: { type: String, default: 'Вкладки карты' },
  collapseAt: { type: Number, default: 760 },
})
const emit = defineEmits(['update:tab', 'select', 'resize'])
const element = ref(null)
const collapsed = ref(window.matchMedia(`(max-width: ${props.collapseAt}px)`).matches)
let observer
function openTab(key) {
  emit('update:tab', key)
  collapsed.value = false
  emit('select', key)
}
onMounted(() => {
  observer = new ResizeObserver(() => emit('resize', element.value.getBoundingClientRect().width))
  observer.observe(element.value)
})
onBeforeUnmount(() => observer?.disconnect())
defineExpose({ openTab })
</script>
<style scoped>
.map-sidebar { width: 334px; flex: none; min-height: 0; display: flex; border-right: 1px solid var(--border-strong); background: var(--surface); }
.map-sidebar-tabs { width: 48px; flex: none; display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-right: 1px solid var(--border-strong); }
.map-sidebar-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.map-sidebar--collapsed { width: 48px; }
.map-sidebar-heading { display: flex; align-items: center; justify-content: space-between; padding: 6px; }
.map-sidebar-heading strong { padding-left: 6px; }
.map-sidebar-content { display: flex; flex-direction: column; gap: 14px; min-height: 0; overflow: auto; padding: 8px 12px 18px; }
.map-sidebar-content :deep(hr) { width: 100%; border: 0; border-top: 1px solid var(--border-strong); }
@media (max-width: 760px) {
  .map-sidebar { width: min(334px, calc(100vw - 100px)); }
  .map-sidebar--collapsed { width: 48px; }
}
</style>
