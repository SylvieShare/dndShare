<template>
  <Teleport to="body">
    <TransitionGroup name="notification-stack" tag="div" class="notification-stack" aria-label="Уведомления" aria-live="polite" aria-relevant="additions">
      <BaseTile v-for="entry in store.entries" :key="entry.id" role="status" class="app-notification" :data-notification-type="entry.type"
        @pointerenter="store.pause(entry.id, 'hover')" @pointerleave="store.resume(entry.id, 'hover')"
        @focusin="store.pause(entry.id, 'focus')" @focusout="onFocusOut($event, entry.id)"
        @pointerdown="swipe.onPointerDown($event, entry.id)" @pointermove="swipe.onPointerMove"
        @pointerup="swipe.onPointerUp" @pointercancel="swipe.onPointerCancel">
        <button type="button" class="notification-close" aria-label="Закрыть уведомление" @click="store.dismiss(entry.id)"><X :size="16" /></button>
        <DiceRollNotification v-if="entry.type === 'dice'" :entry="{ ...entry.data, id: entry.id, title: entry.title }" @action="key => store.runAction(entry.id, key)" />
        <SessionEventNotification v-else-if="entry.type === 'session-event'" :entry="entry" />
        <template v-else><strong>{{ entry.title }}</strong><p>{{ entry.data.message }}</p></template>
        <div v-if="entry.actions.length" class="notification-actions">
          <ActionButton v-for="action in entry.actions" :key="action.key" variant="quiet" @click="store.runAction(entry.id, action.key)">{{ action.label }}</ActionButton>
        </div>
        <span class="notification-lifetime" aria-hidden="true" :style="{ animationDuration: `${entry.duration}ms`, animationPlayState: entry.paused ? 'paused' : 'running' }" />
      </BaseTile>
    </TransitionGroup>
  </Teleport>
</template>
<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { BaseTile, ActionButton } from '@sylvieshare/share-ui'
import { X } from '@lucide/vue'
import { useNotificationsStore } from '@/stores/notifications'
import { useAccountStore } from '@/stores/account'
import { useSwipeDismiss } from '@/shared/composables/useSwipeDismiss'
import DiceRollNotification from './DiceRollNotification.vue'
import SessionEventNotification from './SessionEventNotification.vue'
const store = useNotificationsStore()
const account = useAccountStore()
const swipe = useSwipeDismiss({ onDismiss: store.dismiss })
watch(() => account.user?.id, () => store.clear())
function onFocusOut(event, id) {
  if (!event.currentTarget.contains(event.relatedTarget)) store.resume(id, 'focus')
}
onBeforeUnmount(() => { swipe.dispose(); store.clear() })
</script>
<style scoped>
.notification-stack { position: fixed; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom)); z-index: 9000; display: flex; flex-direction: column; align-items: stretch; gap: 10px; width: min(380px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; pointer-events: none; }
.app-notification { position: relative; flex: none; pointer-events: auto; padding: 14px; color: var(--text-1); font-size: 13px; overflow: hidden; box-shadow: var(--shadow-lg); touch-action: pan-y; transform: translateX(var(--notification-swipe-x, 0px)); opacity: var(--notification-swipe-opacity, 1); transition: transform .18s ease, opacity .18s ease; }
.app-notification.notification--swiping { user-select: none; transition: none; }
.app-notification.notification--swipe-dismiss { transition: transform .16s ease-out, opacity .16s ease-out; }
.notification-close { position: absolute; top: 5px; right: 5px; z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--r-sm); background: none; color: var(--text-muted); cursor: pointer; }
.notification-close:hover { color: var(--text-1); background: var(--surface-raised); }
.notification-actions { display: flex; gap: 8px; margin-top: 10px; }
.notification-lifetime { position: absolute; inset: auto 0 0; height: 2px; background: var(--accent); transform-origin: left; animation: notification-lifetime linear forwards; }
@keyframes notification-lifetime { to { transform: scaleX(0); } }
.notification-stack-enter-active, .notification-stack-leave-active { transition: transform .25s ease, opacity .25s ease; }
.notification-stack-move { transition: transform .25s ease; }
.notification-stack-enter-from { opacity: 0; transform: translate(16px, 8px); }
.notification-stack-leave-to { opacity: 0; transform: translateX(100%); }
@media (prefers-reduced-motion: reduce) {
  .app-notification, .notification-stack-enter-active, .notification-stack-leave-active, .notification-stack-move { transition: none; }
  .notification-lifetime { display: none; }
}
</style>
