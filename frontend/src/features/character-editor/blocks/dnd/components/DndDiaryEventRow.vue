<template>
  <div v-if="event.type === 'newday'" class="der-day" :style="{ '--ec': meta.color }">
    <span class="der-node der-node--day"><Sunrise :size="22" /></span>
    <div class="der-day-copy"><span>НОВЫЙ ДЕНЬ</span><strong>{{ event.title || 'Новый день приключения' }}</strong></div>
  </div>
  <div v-else class="der" :class="'der--' + event.type" :style="{ '--ec': meta.color }">
    <span class="der-node"><component :is="meta.icon" :size="21" :stroke-width="1.8" /></span>
    <div class="der-body">
      <header class="der-heading">
        <span class="der-kind">{{ meta.label }}<span v-if="event.type === 'battle' && combatantCount"> · Участников: {{ combatantCount }}</span><span v-if="event.type === 'dialog' && speakersCount"> · Голосов: {{ speakersCount }}</span></span>
        <h3>{{ event.title || meta.label }}</h3>
      </header>
      <div v-if="sourceLabel" class="der-source"><Link2 :size="12" />{{ sourceLabel }}</div>
      <div v-if="event.type === 'dialog' && dialogue.length" class="der-dialogue">
        <div v-for="(line, index) in dialogue" :key="index" class="der-line" :style="{ '--speaker-color': line.color || 'var(--text-muted)' }">
          <span class="der-speaker">{{ line.left || 'Рассказчик' }}</span>
          <span class="der-voice-line" aria-hidden="true" />
          <span class="der-line-text">{{ line.right || '…' }}</span>
        </div>
      </div>
      <div v-if="event.type === 'battle' && event.combatants.length" class="der-combatants">
        <div v-for="combatant in event.combatants" :key="combatant.id" class="der-combatant">
          <span class="der-combatant-emblem"><Swords :size="20" /></span>
          <span class="der-combatant-name">{{ combatantName(combatant) }}</span>
          <span class="der-combatant-count">×{{ combatant.count }}</span>
          <div v-if="combatant.ac != null || combatant.hp != null" class="der-combatant-stats">
            <span v-if="combatant.ac != null"><Shield :size="13" /> КБ {{ combatant.ac }}</span>
            <span v-if="combatant.hp != null"><Heart :size="13" /> HP {{ combatant.hp }}</span>
          </div>
          <span v-if="combatant.desc" class="der-combatant-desc">{{ combatant.desc }}</span>
        </div>
      </div>
      <RichContent v-if="hasDesc" class="der-desc" :html="descHtml" />
      <div v-else-if="event.type === 'event'" class="der-unwritten">Момент, который стоит запомнить.</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Heart, Link2, Shield, Sunrise, Swords } from '@lucide/vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { eventTypeMeta } from '../lib/diaryEntry'
import { hydrateDialogueRows } from '@/features/sessions/lib/dialogueRows'

const props = defineProps({ event: { type: Object, required: true } })
const meta = computed(() => eventTypeMeta(props.event.type))
const dialogue = computed(() => hydrateDialogueRows((props.event.dialogue || []).map(line => ({
  left: line.speaker, right: line.text, color: line.color,
}))))
const speakersCount = computed(() => new Set(dialogue.value.map(line => line.left.trim().toLocaleLowerCase('ru-RU')).filter(Boolean)).size)
const combatantCount = computed(() => (props.event.combatants || []).reduce((sum, item) => sum + (Number(item.count) || 1), 0))
const sourceLabel = computed(() => {
  if (!props.event.sourceSceneItemId) return ''
  const sceneName = props.event.sourceSnapshot?.scene?.name
  return sceneName ? 'Из сценария · ' + sceneName : 'Из сценария'
})
function combatantName(combatant) {
  if (combatant.source === 'handbook') return combatant.itemName || (combatant.itemId != null ? 'Существо #' + combatant.itemId : 'Существо не выбрано')
  return combatant.name || 'Своё существо'
}
function escapeHtml(text) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
const descHtml = computed(() => {
  const text = props.event.desc || ''
  return /<[a-z][\s\S]*>/i.test(text) ? text : escapeHtml(text).split('\n').join('<br>')
})
const hasDesc = computed(() => descHtml.value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '')
</script>

<style scoped>
.der { display: flex; align-items: flex-start; gap: 20px; min-width: 0; }
.der-node { position: relative; z-index: 1; display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; margin-top: 16px; border-radius: 14px; background: color-mix(in srgb, var(--ec) 14%, var(--surface)); border: 1px solid color-mix(in srgb, var(--ec) 55%, var(--border)); color: var(--ec); box-shadow: 0 0 0 5px var(--surface), 0 4px 16px color-mix(in srgb, var(--ec) 14%, transparent); }
.der-body { display: flex; flex: 1; flex-direction: column; gap: 18px; min-width: 0; padding: 24px 26px; border: 1px solid color-mix(in srgb, var(--ec) 24%, var(--border)); border-radius: 16px; background: linear-gradient(115deg, color-mix(in srgb, var(--ec) 6%, var(--surface-raised)), var(--surface) 60%); box-shadow: var(--shadow-sm); }
.der-heading { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.der-kind { color: var(--ec); font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.der-kind > span { color: var(--text-muted); letter-spacing: .05em; }
.der-heading h3 { margin: 0; font-family: var(--font-display); font-size: clamp(19px, 2vw, 25px); font-weight: 700; line-height: 1.25; color: var(--text-1); overflow-wrap: anywhere; }
.der-source { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; color: var(--text-muted); font-size: 10px; }
.der-desc { min-width: 0; color: var(--text-2); font-family: var(--font-prose); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
.der-unwritten { color: var(--text-muted); font-size: 13px; font-style: italic; }
.der--event .der-body { border-left: 3px solid color-mix(in srgb, var(--ec) 65%, var(--border)); }
.der-dialogue { display: flex; flex-direction: column; min-width: 0; padding: 4px 0; }
.der-line { display: grid; grid-template-columns: minmax(72px, .3fr) 3px minmax(0, 1fr); align-items: stretch; gap: 16px; padding: 15px 0; min-width: 0; }
.der-line + .der-line { border-top: 1px solid var(--border); }
.der-speaker { align-self: start; color: var(--speaker-color); font-size: 13px; font-weight: 800; line-height: 1.7; text-align: right; overflow-wrap: anywhere; }
.der-voice-line { min-height: 30px; border-radius: 3px; background: var(--speaker-color); box-shadow: 0 0 12px color-mix(in srgb, var(--speaker-color) 16%, transparent); }
.der-line-text { color: var(--text-2); font-family: var(--font-prose); font-size: 15px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.der--battle .der-body { background: linear-gradient(125deg, color-mix(in srgb, var(--danger) 10%, var(--surface-raised)), var(--surface) 70%); }
.der-combatants { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
.der-combatant { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px 12px; padding: 16px; border: 1px solid color-mix(in srgb, var(--danger) 25%, var(--border)); border-radius: 12px; background: var(--surface); }
.der-combatant-emblem { display: grid; place-items: center; width: 36px; height: 36px; grid-row: 1 / span 2; border-radius: 10px; background: color-mix(in srgb, var(--danger) 10%, var(--surface)); color: var(--danger); }
.der-combatant-count { color: var(--danger); font-family: var(--font-display); font-size: 22px; font-weight: 700; }
.der-combatant-name { color: var(--text-1); font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
.der-combatant-stats { display: flex; grid-column: 2 / -1; flex-wrap: wrap; gap: 8px; }
.der-combatant-stats > span { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 5px; background: var(--surface-raised); color: var(--text-2); font-size: 11px; }
.der-combatant-desc { grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.der-day { display: flex; align-items: center; gap: 20px; padding: 16px 0; min-width: 0; }
.der-node--day { border-radius: 50%; margin-top: 0; }
.der-day-copy { display: flex; flex: 1; flex-direction: column; gap: 6px; min-width: 0; padding: 18px 24px; border-top: 1px solid color-mix(in srgb, var(--ec) 50%, var(--border)); border-bottom: 1px solid color-mix(in srgb, var(--ec) 25%, var(--border)); background: linear-gradient(90deg, color-mix(in srgb, var(--ec) 9%, transparent), transparent); }
.der-day-copy > span { color: var(--ec); font-size: 9px; font-weight: 800; letter-spacing: .18em; }
.der-day-copy > strong { font-family: var(--font-display); font-size: 22px; color: var(--text-1); overflow-wrap: anywhere; }
@media (max-width: 720px) {
  .der, .der-day { gap: 12px; }
  .der-node { width: 32px; height: 32px; border-radius: 10px; margin-top: 14px; }
  .der-node :deep(svg) { width: 17px; height: 17px; }
  .der-body { padding: 18px 16px; gap: 16px; }
  .der-line { grid-template-columns: minmax(54px, .3fr) 2px minmax(0, 1fr); gap: 10px; }
  .der-speaker { font-size: 11px; }
  .der-line-text, .der-desc { font-size: 13px; }
  .der-day-copy { padding: 16px; }
}
</style>
