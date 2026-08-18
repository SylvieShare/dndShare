<template>
  <button
    type="button"
    class="class-card"
    :class="{ 'class-card--selected': selected }"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="class-card-visual">
      <img v-if="imageUrl" :src="imageUrl" :alt="`Мужчина и женщина — ${title}`" :loading="selected ? 'eager' : 'lazy'" />
      <span v-else class="class-card-fallback" aria-hidden="true">{{ monogram }}</span>
      <span class="class-card-vignette" aria-hidden="true" />
    </span>

    <span class="class-card-body">
      <span v-if="selected" class="class-card-status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6" /></svg>
        Выбрано
      </span>
      <span class="class-card-title">{{ title }}</span>
      <span v-if="subtitle" class="class-card-subtitle">{{ subtitle }}</span>
      <span v-if="description" class="class-card-description">{{ description }}</span>

      <span v-if="facts.length" class="class-card-facts">
        <span v-for="fact in facts" :key="fact.label" class="class-card-fact" :class="{ 'class-card-fact--wide': fact.wide }">
          <span>{{ fact.label }}</span>
          <b v-if="fact.entries?.length" class="class-card-ability-list">
            <span
              v-for="entry in fact.entries"
              :key="entry.name"
              class="class-card-ability"
              :class="{ 'class-card-ability--described': entry.description }"
              @mouseenter="showAbilityTooltip($event, entry)"
              @mouseleave="hideAbilityTooltip"
            >{{ entry.name }}</span>
          </b>
          <b v-else>{{ fact.value }}</b>
        </span>
      </span>

      <span v-if="subclasses.length" class="class-card-subclasses">
        <span class="class-card-subclasses-label">Архетипы<template v-if="subclassLevel"> с {{ subclassLevel }} уровня</template></span>
        <span class="class-card-subclass-list">
          <span v-for="subclass in subclasses" :key="subclass" class="class-card-subclass">{{ subclass }}</span>
        </span>
      </span>

      <span v-if="choices.length" class="class-card-choices">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
        После выбора: {{ choices.join(' · ') }}
      </span>
      <span v-else-if="selected" class="class-card-note">Базовые особенности будут добавлены автоматически</span>
    </span>
  </button>

  <ItemTooltip v-if="tooltip.visible" :title="tooltip.title" :desc="tooltip.desc" :x="tooltip.x" :top="tooltip.top" :bottom="tooltip.bottom" />
</template>

<script setup>
import { reactive } from 'vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'

defineProps({
  title: { type: String, default: '' }, subtitle: { type: String, default: '' },
  monogram: { type: String, default: '' }, imageUrl: { type: String, default: '' },
  selected: { type: Boolean, default: false }, description: { type: String, default: '' },
  facts: { type: Array, default: () => [] }, choices: { type: Array, default: () => [] },
  subclasses: { type: Array, default: () => [] }, subclassLevel: { type: Number, default: null },
})
defineEmits(['select'])

const tooltip = reactive({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })
function showAbilityTooltip(event, ability) {
  if (!ability.description) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 220 && rect.top > 220
  Object.assign(tooltip, {
    visible: true, title: ability.name, desc: ability.description,
    x: Math.min(rect.left, window.innerWidth - 360),
    top: above ? null : rect.bottom + 7,
    bottom: above ? window.innerHeight - rect.top + 7 : null,
  })
}
function hideAbilityTooltip() { tooltip.visible = false }
</script>

<style scoped>
.class-card {
  min-width: 0; width: 100%; min-height: 250px; padding: 0; overflow: hidden;
  display: grid; grid-template-columns: minmax(280px, .92fr) minmax(0, 1.7fr);
  text-align: left; color: inherit; font: inherit; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--r-lg); cursor: pointer;
  transition: transform .18s cubic-bezier(.22,1,.36,1), border-color .15s, box-shadow .18s, min-height .42s cubic-bezier(.22,1,.36,1), grid-template-columns .42s cubic-bezier(.22,1,.36,1);
}
.class-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--accent) 44%, var(--border)); box-shadow: var(--shadow-md); }
.class-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.class-card-visual { position: relative; display: block; width: 100%; height: 100%; min-height: 250px; overflow: hidden; background: color-mix(in srgb, var(--accent) 8%, var(--surface-raised)); }
.class-card-visual img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 24%; transition: transform .35s cubic-bezier(.22,1,.36,1); }
.class-card:hover .class-card-visual img { transform: scale(1.025); }
.class-card-vignette { position: absolute; inset: 0; background: linear-gradient(to top, color-mix(in srgb, var(--bg) 42%, transparent), transparent 45%); pointer-events: none; }
.class-card-fallback { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-display); font-size: 64px; color: var(--accent); }
.class-card-body { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 18px 20px; }
.class-card-title { font-family: var(--font-display); font-size: 22px; font-weight: 600; line-height: 1.12; color: var(--text-1); }
.class-card-subtitle { font-size: 12px; color: var(--text-muted); }
.class-card-description { display: -webkit-box; margin-top: 5px; overflow: hidden; color: var(--text-2); font-size: 12px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.class-card-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 9px; }
.class-card-fact { min-width: 0; padding: 6px 8px; background: color-mix(in srgb, var(--surface-raised) 74%, transparent); border-radius: 8px; }
.class-card-fact--wide { grid-column: 1 / -1; }
.class-card-fact > span { display: block; margin-bottom: 2px; color: var(--text-muted); font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.class-card-fact b { display: block; overflow: hidden; color: var(--text-1); font-size: 11px; font-weight: 500; line-height: 1.35; text-overflow: ellipsis; }
.class-card-ability-list { display: flex !important; flex-wrap: wrap; gap: 3px 9px; white-space: normal; }
.class-card-ability { position: relative; }
.class-card-ability:not(:last-child)::after { content: '·'; position: absolute; left: calc(100% + 4px); color: var(--text-muted); }
.class-card-ability--described { cursor: help; text-decoration: underline dotted color-mix(in srgb, var(--text-muted) 72%, transparent); text-underline-offset: 3px; }
.class-card-subclasses { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.class-card-subclasses-label { color: var(--text-muted); font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.class-card-subclass-list { display: flex; flex-wrap: wrap; gap: 5px; }
.class-card-subclass { padding: 4px 8px; color: var(--text-2); background: color-mix(in srgb, var(--surface-raised) 82%, transparent); border: 1px solid color-mix(in srgb, var(--border) 72%, transparent); border-radius: 999px; font-size: 10px; font-weight: 600; }
.class-card-choices { display: inline-flex; align-items: center; gap: 6px; width: fit-content; margin-top: 8px; padding: 6px 9px; color: var(--accent-soft); background: color-mix(in srgb, var(--accent) 11%, transparent); border-radius: 999px; font-size: 10px; font-weight: 600; }
.class-card-choices svg { width: 13px; height: 13px; flex-shrink: 0; }
.class-card-status { display: inline-flex; align-items: center; gap: 5px; width: fit-content; margin-bottom: 5px; color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.class-card-status svg { width: 14px; height: 14px; }
.class-card-note { margin-top: 8px; color: var(--text-muted); font-size: 10px; }
.class-card--selected { min-height: 270px; border-color: color-mix(in srgb, var(--accent) 52%, var(--border)); box-shadow: 0 16px 42px color-mix(in srgb, var(--bg) 32%, transparent); }
.class-card--selected:hover { transform: none; }

@media (max-width: 760px) {
  .class-card { grid-template-columns: 1fr; }
  .class-card-visual { min-height: 220px; aspect-ratio: 3 / 2; }
  .class-card-body { padding: 16px; }
}
@media (max-width: 480px) {
  .class-card-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .class-card-fact--wide { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) { .class-card, .class-card-visual img { transition: none; } }
</style>
