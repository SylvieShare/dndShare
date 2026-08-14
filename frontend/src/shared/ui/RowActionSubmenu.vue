<template>
  <div class="ras-root">
    <div ref="triggerEl" class="ras-trigger" @click.stop="toggle">
      <slot name="trigger" :open="isOpen" :toggle="toggle" />
    </div>

    <Transition name="ras-inline">
      <div
        v-if="isMobile && isOpen"
        class="ras-inline"
        @click.stop
        @pointerdown.stop
      >
        <div class="ras-panel">
          <div v-if="label" class="ras-label">{{ label }}</div>
          <slot :close="close" />
        </div>
      </div>
    </Transition>

    <BasePopover
      v-if="!isMobile"
      :open="isOpen"
      :anchor="triggerEl"
      placement="right-start"
      :min-width="minWidth"
      :z-index="9400"
      popover-class="row-action-submenu-popover"
      transition="ras-popover"
      @update:open="onPopoverState"
    >
      <div class="ras-panel ras-panel--popover">
        <div v-if="label" class="ras-label">{{ label }}</div>
        <slot :close="close" />
      </div>
    </BasePopover>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import BasePopover from '@/shared/ui/BasePopover.vue'
import { useIsMobile } from '@/shared/composables/useIsMobile'
import { openRowActionSubmenuId } from '@/shared/ui/rowActionSubmenuState'

const props = defineProps({
  label: { type: String, default: '' },
  minWidth: { type: Number, default: 200 },
  disabled: { type: Boolean, default: false },
})

const myId = Symbol('row-action-submenu')
const triggerEl = ref(null)
const isMobile = useIsMobile()
const isOpen = computed(() => openRowActionSubmenuId.value === myId)

function toggle() {
  if (props.disabled) return
  openRowActionSubmenuId.value = isOpen.value ? null : myId
}

function close() {
  if (isOpen.value) openRowActionSubmenuId.value = null
}

function onPopoverState(open) {
  if (!open) close()
}

onBeforeUnmount(close)

defineExpose({ close })
</script>

<style scoped>
.ras-root,
.ras-trigger {
  width: 100%;
}

.ras-trigger {
  display: flex;
}

.ras-trigger :deep(.ram-item) {
  width: 100%;
}

.ras-inline {
  position: relative;
  margin: 2px 3px 4px 11px;
  padding: 4px 4px 4px 11px;
  border-left: 2px solid var(--accent);
  border-radius: 0 7px 7px 0;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.ras-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ras-panel--popover {
  min-width: 100%;
}

.ras-label {
  margin: 2px 4px 5px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ras-inline-enter-active,
.ras-inline-leave-active {
  transition: opacity 120ms ease, transform 140ms cubic-bezier(0.2, 0.8, 0.3, 1);
  transform-origin: top;
}

.ras-inline-enter-from,
.ras-inline-leave-to {
  opacity: 0;
  transform: translateY(-3px) scaleY(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .ras-inline-enter-active,
  .ras-inline-leave-active { transition: none; }
}
</style>

<style>
.row-action-submenu-popover {
  max-width: min(320px, calc(100vw - 16px));
  max-height: min(420px, calc(100vh - 16px));
  overflow: auto;
}

.ras-popover-enter-active,
.ras-popover-leave-active {
  transition: opacity 120ms ease, transform 140ms cubic-bezier(0.2, 0.8, 0.3, 1);
  transform-origin: left top;
}

.ras-popover-enter-from,
.ras-popover-leave-to {
  opacity: 0;
  transform: translateX(-4px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .ras-popover-enter-active,
  .ras-popover-leave-active { transition: none; }
}
</style>
