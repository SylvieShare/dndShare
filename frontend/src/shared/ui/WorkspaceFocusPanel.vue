<template>
  <Transition name="workspace-focus" appear @before-leave="disableLeaving" @before-enter="enableEntering">
    <aside v-if="open" ref="element" class="workspace-focus-panel" v-bind="$attrs">
      <BaseTile class="workspace-focus-content">
        <slot name="navigation" />
        <Transition name="workspace-focus-swap" mode="out-in" @before-leave="holdHeight" @enter="resizeFrame">
          <div :key="focusKey" class="workspace-focus-view"><slot /></div>
        </Transition>
      </BaseTile>
    </aside>
  </Transition>
</template>
<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
defineOptions({ inheritAttrs: false })
defineProps({ open: Boolean, focusKey: [String, Number] })
const element = ref(null)
defineExpose({ bounds: () => element.value?.getBoundingClientRect() })
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
let previousHeight = 0, heightAnimation
function disableLeaving(node) { node.inert = true; node.setAttribute('aria-hidden', 'true') }
function enableEntering(node) { node.inert = false; node.removeAttribute('aria-hidden') }
function holdHeight(node) {
  disableLeaving(node)
  const frame = node.parentElement
  previousHeight = frame.getBoundingClientRect().height
  heightAnimation?.cancel()
  if (!reduced.matches) frame.style.height = `${previousHeight}px`
}
function resizeFrame(node) {
  const frame = node.parentElement
  frame.style.height = ''
  if (reduced.matches || !previousHeight) return
  heightAnimation = frame.animate([{ height: `${previousHeight}px` }, { height: `${frame.getBoundingClientRect().height}px` }], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' })
}
const finishHeight = () => heightAnimation?.finish()
reduced.addEventListener('change', finishHeight)
onBeforeUnmount(() => { heightAnimation?.cancel(); reduced.removeEventListener('change', finishHeight) })
</script>
<style scoped>
.workspace-focus-panel {
  position: absolute; z-index: 16; right: var(--workspace-focus-right, 12px); top: 12px;
  width: 300px; max-width: calc(100% - var(--workspace-focus-left, 0px) - 24px);
  max-height: calc(100% - 100px); display: flex; flex-direction: column; overflow: hidden;
  user-select: text; border-radius: var(--r-lg);
}
.workspace-focus-panel > .workspace-focus-content { background-color: var(--surface); padding: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.workspace-focus-view { min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.workspace-focus-enter-active, .workspace-focus-leave-active { transition: opacity 180ms ease; }
.workspace-focus-enter-from, .workspace-focus-leave-to { opacity: 0; }
.workspace-focus-leave-active, .workspace-focus-swap-leave-active { pointer-events: none; }
.workspace-focus-swap-enter-active { transition: opacity 180ms ease, transform 220ms cubic-bezier(.2,.7,.2,1); }
.workspace-focus-swap-leave-active { transition: opacity 110ms ease, transform 110ms ease; }
.workspace-focus-swap-enter-from { opacity: 0; transform: translateY(8px); }
.workspace-focus-swap-leave-to { opacity: 0; transform: translateY(-6px); }
@media (max-width: 760px) { .workspace-focus-panel { width: 230px; } }
@media (prefers-reduced-motion: reduce) {
  .workspace-focus-enter-active, .workspace-focus-leave-active, .workspace-focus-swap-enter-active, .workspace-focus-swap-leave-active { transition: none; }
}
</style>
