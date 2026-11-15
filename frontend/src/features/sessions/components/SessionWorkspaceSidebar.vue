<template>
  <div class="session-sidebar-host" aria-label="Боковая панель сессии">
    <MapSidebar :ref="node => controller.sidebar.value = node" :tab="controller.selected.value" :tabs="controller.tabs.value"
      persistent-content :padded="false" tabs-label="Боковые вкладки сессии" collapse-label="Свернуть боковую панель"
      :compact-peek="layoutTokens['session-sidebar-peek']"
      @update:tab="controller.selected.value = $event" @resize="controller.resize" @action="controller.action">
      <template v-if="controller.selected.value.startsWith('reserves:')" #header-title><slot name="reserve-title" /></template>
      <template v-if="controller.selected.value === 'players'" #header-actions><slot name="players-actions" /></template>
      <template v-else-if="controller.selected.value.startsWith('reserves:')" #header-actions><slot name="reserve-actions" /></template>
      <div :ref="node => controller.target.value = node" class="session-sidebar-panels">
        <div v-show="controller.selected.value === 'players'" class="session-sidebar-players" data-tutorial="session-players"><slot /></div>
        <slot name="panels" />
      </div>
    </MapSidebar>
  </div>
</template>
<script setup>
import { inject, onBeforeUnmount } from 'vue'
import MapSidebar from '@/features/maps/components/MapSidebar.vue'
import { tutorialActionsKey } from '@/features/tutorials/lib/targets'
import { layoutTokens } from '@/app/design-tokens'
const props = defineProps({ controller: { type: Object, required: true } })
const actions = inject(tutorialActionsKey, null)
const unregister = actions?.register('session-players', context => {
  const previous = props.controller.selected.value, collapsed = props.controller.sidebar.value?.collapsed
  props.controller.sidebar.value?.openTab('players')
  context.onCleanup(() => {
    props.controller.selected.value = previous
    if (collapsed) props.controller.sidebar.value?.collapse()
  })
})
onBeforeUnmount(() => unregister?.())
</script>
<style scoped>
.session-sidebar-host {position:absolute;z-index:20;inset:var(--session-toolbar-height,64px) 0 0;pointer-events:none}
.session-sidebar-panels {display:flex;flex:1;min-height:0;min-width:0;flex-direction:column}
.session-sidebar-players {display:flex;flex:1;min-height:0;flex-direction:column;gap:var(--spacing-medium);padding:var(--spacing-small) var(--spacing-medium) var(--spacing-large)}
</style>
