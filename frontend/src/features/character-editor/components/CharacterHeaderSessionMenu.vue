<template>
  <div data-tutorial="character-session">
    <ActionButton ref="trigger" variant="quiet" icon-only aria-label="Сессия" :title="heading"
      aria-haspopup="menu" :aria-expanded="open" @click="toggle" @keydown.down.prevent="openMenu">
      <template #icon>
        <span class="session-icon">
          <ScrollText :size="layoutTokens['sheet-header-action-icon']" aria-hidden="true" />
          <span v-if="linkState" class="session-dot" :class="'session-dot--' + linkState" role="img" :aria-label="linkLabel" :title="linkLabel" />
          <span v-if="eventCount" class="session-count" :class="{ 'session-count--incoming': controller.incomingCount > 0 }">{{ eventCount > 99 ? '99+' : eventCount }}</span>
        </span>
      </template>
    </ActionButton>
    <CharacterMenuPopover v-model:open="open" :anchor="trigger?.$el" label="Сессия" role="menu">
      <div class="session-heading">{{ heading }}</div>
      <ActionMenuItem :icon="ScrollText" @click="open = false; router.push(`/sessions/${session.uuid}`)">Открыть сессию</ActionMenuItem>
      <ActionMenuItem :icon="Users" @click="show('players')">
        Игроки <template #suffix>{{ playerCount ?? '—' }}</template>
      </ActionMenuItem>
      <ActionMenuItem :icon="Bell" @click="show('events')">
        События <template #suffix>{{ eventCount }}</template>
      </ActionMenuItem>
    </CharacterMenuPopover>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ActionButton, ActionMenuItem } from '@sylvieshare/share-ui'
import { Bell, ScrollText, Users } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'
import CharacterMenuPopover from './CharacterMenuPopover.vue'

const props = defineProps({ session: { type: Object, required: true }, controller: { type: Object, required: true } })
const router = useRouter(), trigger = ref(null), open = ref(false)
const connection = inject('characterSessionConnection', null)
const linkState = computed(() => connection?.value.uuid === props.session.uuid ? connection?.value.status : null)
const linkLabel = computed(() => ({ connected: 'Связь с сессией установлена', error: 'Нет связи с сессией' }[linkState.value] || 'Подключение к сессии'))
const heading = computed(() => [props.session.name, currentChapterLabel({ chapterNumber: props.session.chapterNumber, chapterName: props.session.chapterName }, true)].filter(Boolean).join(' · '))
const playerCount = computed(() => props.controller.state.playersLoaded ? props.controller.recipients.length : null)
const eventCount = computed(() => props.controller.state.transfers.length + (props.controller.interactions?.state.pending.length || 0))
// Panels outlive the menu. Their anchor must remain in the header after the item disappears.
watch([() => props.controller, trigger], ([controller, button], _, cleanup) => {
  const element = button?.$el
  if (!element) return
  for (const view of ['players', 'events']) controller.registerAnchor(view, element)
  cleanup(() => {
    for (const view of ['players', 'events']) controller.unregisterAnchor(view, element)
  })
}, { flush: 'post' })
function openMenu() { props.controller.close(); open.value = true }
function toggle() { if (open.value) open.value = false; else openMenu() }
watch(() => props.session.uuid, () => { open.value = false })
function show(view) {
  open.value = false
  props.controller.open(view, trigger.value?.$el)
}
</script>

<style scoped>
.session-heading { padding:8px 10px; color:var(--text-2); font-size:var(--type-context-size); font-weight:650; overflow-wrap:anywhere; }
.session-icon { position:relative; display:flex; }
.session-dot { position:absolute; right:-3px; bottom:-2px; width:7px; height:7px; border-radius:50%; background:var(--info); box-shadow:0 0 0 2px var(--subheader); }
.session-dot--connected { background:var(--success); }
.session-dot--error { background:var(--danger); }
.session-count { position:absolute; top:-8px; right:-10px; min-width:14px; padding:0 3px; border-radius:var(--r-pill); background:var(--surface); color:var(--accent-soft); font-size:10px; line-height:14px; font-weight:700; }
.session-count--incoming { background:var(--warning); color:var(--bg); }
</style>
