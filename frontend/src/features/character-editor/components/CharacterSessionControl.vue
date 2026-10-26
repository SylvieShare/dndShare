<template>
  <component :is="compact ? 'div' : BaseTile" v-if="session && controller" class="campaign-block" :class="{ 'campaign-block--compact': compact }" data-tutorial="character-session">
    <RouterLink v-if="compact" :to="`/sessions/${session.uuid}`" class="campaign-heading campaign-link" :title="[session.name, chapterLabel].filter(Boolean).join(' · ')">
      <ScrollText class="campaign-label" :size="20" aria-hidden="true" />
      <span class="campaign-copy">
        <span class="campaign-name">{{ session.name }}</span>
        <span class="campaign-chapter">{{ chapterLabel || 'Игровая сессия' }}</span>
      </span>
    </RouterLink>
    <div v-else class="campaign-heading">
      <span class="campaign-label" role="img" aria-label="Сессия" title="Сессия"><ScrollText :size="24" aria-hidden="true" /></span>
      <RouterLink :to="`/sessions/${session.uuid}`" class="campaign-name">{{ session.name }}</RouterLink>
    </div>
    <div class="campaign-actions">
      <div class="campaign-action">
        <ActionButton variant="quiet" icon-only class="campaign-icon" aria-label="Игроки" :title="`Игроки: ${playerCount ?? 'загрузка'}`" :ref="el => registerAnchor('players', el)" aria-haspopup="dialog" :aria-expanded="controller.state.view === 'players'" @click="toggle('players', $event)">
          <template #icon><Users class="campaign-symbol" :size="compact ? 20 : 24" aria-hidden="true" /></template>
        </ActionButton>
        <span class="campaign-count" aria-hidden="true">{{ playerCount ?? '—' }}</span>
      </div>
      <div class="campaign-action">
        <ActionButton variant="quiet" icon-only class="campaign-icon" :class="{ 'campaign-icon--notify': controller.incomingCount > 0 }" aria-label="События" :title="`События: ${eventCount}. Входящих: ${controller.incomingCount}`" :ref="el => registerAnchor('events', el)" aria-haspopup="dialog" :aria-expanded="controller.state.view === 'events'" @click="toggle('events', $event)">
          <template #icon><Bell class="campaign-symbol" :size="compact ? 20 : 24" aria-hidden="true" /></template>
        </ActionButton>
        <span class="campaign-count" :class="{ 'campaign-count--pending': eventCount > 0 }" aria-hidden="true">{{ eventCount }}</span>
      </div>
    </div>
  </component>
</template>

<script setup>
import { computed, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { ActionButton, BaseTile } from '@sylvieshare/share-ui'
import { Bell, ScrollText, Users } from '@lucide/vue'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'
const props = defineProps({ session: Object, controller: Object, compact: Boolean })
const chapterLabel = computed(() => currentChapterLabel({ chapterNumber: props.session?.chapterNumber, chapterName: props.session?.chapterName }, true))
const playerCount = computed(() => props.controller.state.playersLoaded ? props.controller.recipients.length : null)
const eventCount = computed(() => props.controller.state.transfers.length + (props.controller.interactions?.state.pending.length || 0))
const anchors = new Map()
function registerAnchor(view, component) {
  const element = component?.$el
  if (anchors.get(view) === element) return
  props.controller.unregisterAnchor(view, anchors.get(view))
  anchors.set(view, element)
  if (element) props.controller.registerAnchor(view, element)
}
function toggle(view, event) {
  if (props.controller.state.view === view) props.controller.close()
  else props.controller.open(view, event.currentTarget)
}
onBeforeUnmount(() => anchors.forEach((element, view) => props.controller.unregisterAnchor(view, element)))
</script>

<style scoped>
.campaign-block { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 6px; }
.campaign-heading { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 8px 8px 0; }
.campaign-label { display: flex; flex-shrink: 0; color: var(--text-muted); }
.campaign-name { color: var(--text-1); font-size: 18px; line-height: 1.3; font-weight: 650; text-decoration: none; overflow-wrap: anywhere; }
.campaign-name:hover { color: var(--accent); }
.campaign-actions { display: flex; justify-content: flex-start; gap: 12px; padding: 0 4px 4px 0; }
.campaign-action { position: relative; flex: 0 0 48px; }
.campaign-symbol { flex: 0 0 24px; width: 24px; height: 24px; }
.campaign-count { position: absolute; right: -5px; bottom: -5px; min-width: 21px; box-sizing: border-box; border: 2px solid var(--surface); border-radius: var(--r-pill); background: var(--surface-raised); color: var(--text-2); padding: 1px 5px; font-size: 10px; line-height: 15px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; pointer-events: none; }
.campaign-count--pending { background: var(--accent); color: var(--text-on-accent); }
.campaign-icon--notify .campaign-symbol { color: var(--warning); animation: campaign-notification-pulse 1.5s ease-in-out infinite; transform-origin: 50% 15%; }
.campaign-block--compact { flex-direction: row; align-items: center; gap: 12px; padding: 0; min-width: 0; max-width: min(420px, 48vw); }
.campaign-block--compact .campaign-heading { padding: 6px; border-radius: var(--r-sm); }
.campaign-link { color: var(--text-1); text-decoration: none; transition: color 160ms ease, background 160ms ease; }
.campaign-link:hover { color: var(--accent); background: var(--surface-raised); }
.campaign-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.campaign-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.campaign-block--compact .campaign-name, .campaign-chapter { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.campaign-block--compact .campaign-name { color: inherit; font-size: 14px; }
.campaign-chapter { color: var(--text-muted); font-size: 11px; line-height: 1.3; }
.campaign-block--compact .campaign-actions { flex: none; align-items: center; gap: 10px; padding: 0 6px 4px 12px; border-left: 1px solid var(--border); }
.campaign-block--compact .campaign-action { flex: none; }
.campaign-block--compact .campaign-symbol { flex-basis: 20px; width: 20px; height: 20px; }
.campaign-block--compact .campaign-label { flex-shrink: 0; }
@keyframes campaign-notification-pulse {
  0%, 100% { transform: scale(1) rotate(0); filter: drop-shadow(0 0 2px color-mix(in srgb, var(--warning) 30%, transparent)); }
  35% { transform: scale(1.22) rotate(-12deg); filter: drop-shadow(0 0 8px var(--warning)); }
  55% { transform: scale(1.22) rotate(12deg); filter: drop-shadow(0 0 8px var(--warning)); }
  75% { transform: scale(1.08) rotate(-5deg); }
}
@media (prefers-reduced-motion: reduce) {
  .campaign-link { transition: none; }
  .campaign-icon--notify .campaign-symbol { animation: none; filter: drop-shadow(0 0 5px var(--warning)); }
}
</style>
