<template>
  <component :is="compact ? 'div' : BaseTile" v-if="session && controller" class="campaign-block" :class="{ 'campaign-block--compact': compact }" data-tutorial="character-session">
    <RouterLink v-if="compact" :to="`/sessions/${session.uuid}`" class="campaign-heading campaign-link" :title="[session.name, chapterLabel || 'Игровая сессия'].filter(Boolean).join(' · ')">
      <span v-if="linkState" class="campaign-dot" :class="'campaign-dot--' + linkState" role="img" :aria-label="linkLabel" :title="linkLabel" />
      <span class="campaign-name">{{ session.name }}</span>
    </RouterLink>
    <div v-else class="campaign-heading">
      <span class="campaign-label campaign-symbol-wrap">
        <ScrollText :size="24" aria-hidden="true" />
        <span v-if="linkState" class="campaign-dot" :class="'campaign-dot--' + linkState" role="img" :aria-label="linkLabel" :title="linkLabel" />
      </span>
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
import { computed, inject, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { ActionButton, BaseTile } from '@sylvieshare/share-ui'
import { Bell, ScrollText, Users } from '@lucide/vue'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'
const props = defineProps({ session: Object, controller: Object, compact: Boolean })
const connection = inject('characterSessionConnection', null)
const linkState = computed(() => connection?.value.uuid === props.session?.uuid ? connection?.value.status : null)
const linkLabel = computed(() => ({
  connected: 'Связь с сессией установлена', error: 'Нет связи с сессией',
}[linkState.value] || 'Подключение к сессии'))
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
.campaign-symbol-wrap { position: relative; }
.campaign-dot { position: absolute; right: 0; bottom: 0; width: 7px; height: 7px; border-radius: 50%; background: var(--info); }
.campaign-dot--connected { background: var(--success); }
.campaign-dot--error { background: var(--danger); }
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
.campaign-block--compact {flex:none;display:flex;flex-direction:column-reverse;align-items:center;gap:0;width:100px;max-width:100%;box-sizing:border-box;padding:2px 6px 3px;background:var(--surface);border-radius:var(--radius-tile)}
.campaign-block--compact .campaign-actions {align-items:center;justify-content:space-around;width:100%;padding:0;gap:4px}
.campaign-block--compact .campaign-action {flex:none}
.campaign-block--compact .campaign-icon {width:36px;height:34px;min-height:34px}
.campaign-block--compact .campaign-symbol {width:18px;height:18px;flex-basis:18px}
.campaign-block--compact .campaign-count {right:-2px;bottom:0;min-width:12px;border:0;padding:0 1px;font-size:10px;line-height:12px;background:var(--surface);color:var(--accent-soft)}
.campaign-block--compact .campaign-link {min-width:0;max-width:100%;min-height:22px;gap:4px;padding:1px 2px;color:var(--text-2);text-decoration:none}
.campaign-block--compact .campaign-dot {position:static;flex:none;width:6px;height:6px}
.campaign-block--compact .campaign-name {overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:var(--type-context-size);line-height:1.2;color:inherit}
.campaign-link:focus-visible {outline:2px solid var(--accent);outline-offset:2px}
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
