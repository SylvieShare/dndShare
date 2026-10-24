<template>
  <header class="session-map-tabs-header" data-tutorial="session-map-toolbar">
    <div class="session-map-tab-list">
      <SlidingTabs
        variant="chips"
        :tabs="tabs"
        :model-value="selected"
        :max-tab-width="220"
        aria-label="Карты сессии"
        @update:model-value="emit('select', $event)"
      >
        <template #icon="{ tab }"
          ><span
            v-if="tab.map.id === onAir"
            class="session-map-on-air"
            aria-label="В эфире"
            ><MonitorUp :size="15" /><span>В эфире</span></span
          ><component
            v-else
            :is="tab.map.document.kind === 'image' ? Image : Map"
            :size="16"
            aria-hidden="true"
        /></template>
        <template #tab-actions="{ tab }"
          ><ActionButton
            icon-only
            variant="quiet"
            class="session-map-tab-rename"
            :disabled="busy"
            :aria-label="`Переименовать карту «${tab.title}»`"
            @click="emit('rename', tab.map)"
            ><template #icon><Pencil :size="15" /></template></ActionButton
        ></template>
      </SlidingTabs>
      <ActionButton
        icon-only
        variant="quiet"
        :disabled="busy"
        aria-label="Добавить карту"
        title="Добавить карту"
        @click="emit('add')"
        ><template #icon><Plus :size="20" /></template
      ></ActionButton>
    </div>
    <div class="session-map-header-broadcast"><slot /></div>
  </header>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton, SlidingTabs } from "@sylvieshare/share-ui";
import { Image, Map, MonitorUp, Pencil, Plus } from "@lucide/vue";
const props = defineProps({
  maps: { type: Array, default: () => [] },
  selected: String,
  onAir: String,
  busy: Boolean,
});
const emit = defineEmits(["select", "rename", "add"]);
const tabs = computed(() =>
  props.maps.map((map) => ({
    key: map.id,
    id: `session-map-tab-${map.id}`,
    panelId: "session-map-content",
    title: map.name,
    map,
  })),
);
</script>
<style scoped>
.session-map-tabs-header {
  display: flex;
  align-items: stretch;
  flex: none;
  min-width: 0;
  min-height: 64px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  z-index: 21;
}
.session-map-tab-list {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.session-map-tab-list > :deep(.share-sliding-tabs) {
  min-width: 0;
  flex: 0 1 auto;
  align-self: stretch;
}
.session-map-header-broadcast {
  display: flex;
  align-items: center;
  flex: none;
  min-width: 0;
  border-left: 1px solid var(--border);
  padding: 6px 12px;
}
.session-map-header-broadcast:empty {
  display: none;
}
.session-map-tab-rename {
  align-self: center;
}
.session-map-on-air {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 4px;
  color: var(--success);
  font-size: 10px;
  font-weight: 700;
}
@media (max-width: 760px) {
  .session-map-tabs-header {
    flex-direction: column;
  }
  .session-map-tab-list {
    min-height: 56px;
  }
  .session-map-header-broadcast {
    border-left: 0;
    border-top: 1px solid var(--border);
    justify-content: flex-end;
  }
}
</style>
