<template>
  <button
    type="button"
    class="race-card"
    :class="{ 'race-card--selected': selected }"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="race-card-visual">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="`Мужчина и женщина — ${title}`"
        :loading="selected ? 'eager' : 'lazy'"
      />
      <span v-else class="race-card-fallback" aria-hidden="true">{{ monogram }}</span>
      <span class="race-card-vignette" aria-hidden="true" />
    </span>

    <span class="race-card-body">
      <span v-if="selected" class="race-card-status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6" /></svg>
        Выбрано
      </span>
      <span class="race-card-title">{{ title }}</span>
      <span v-if="subtitle" class="race-card-subtitle">{{ subtitle }}</span>
      <span v-if="description" class="race-card-description">{{ description }}</span>

      <span v-if="facts.length" class="race-card-facts">
        <span v-for="fact in facts" :key="fact.label" class="race-card-fact" :class="{ 'race-card-fact--wide': fact.wide }">
          <span>{{ fact.label }}</span>
          <b v-if="fact.entries?.length" class="race-card-ability-list">
            <span
              v-for="entry in fact.entries"
              :key="entry.name"
              class="race-card-ability"
              :class="{ 'race-card-ability--described': entry.description }"
              @mouseenter="showAbilityTooltip($event, entry)"
              @mouseleave="hideAbilityTooltip"
            >{{ entry.name }}</span>
          </b>
          <b v-else>{{ fact.value }}</b>
        </span>
      </span>

      <span v-if="subraces.length" class="race-card-subraces">
        <span class="race-card-subraces-label">Доступные подрасы</span>
        <span class="race-card-subrace-list">
          <span v-for="subrace in subraces" :key="subrace" class="race-card-subrace">{{ subrace }}</span>
        </span>
      </span>

      <span v-if="choices.length" class="race-card-choices">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
        После выбора: {{ choices.join(' · ') }}
      </span>
      <span v-else-if="selected" class="race-card-note">Все базовые особенности будут добавлены автоматически</span>
    </span>
  </button>

  <ItemTooltip
    v-if="tooltip.visible"
    :title="tooltip.title"
    :desc="tooltip.desc"
    :x="tooltip.x"
    :top="tooltip.top"
    :bottom="tooltip.bottom"
  />
</template>

<script setup>
import { reactive } from 'vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  monogram: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  description: { type: String, default: '' },
  facts: { type: Array, default: () => [] },
  choices: { type: Array, default: () => [] },
  subraces: { type: Array, default: () => [] },
})
defineEmits(['select'])

const tooltip = reactive({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })
function showAbilityTooltip(event, ability) {
  if (!ability.description) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 220 && rect.top > 220
  Object.assign(tooltip, {
    visible: true,
    title: ability.name,
    desc: ability.description,
    x: Math.min(rect.left, window.innerWidth - 360),
    top: above ? null : rect.bottom + 7,
    bottom: above ? window.innerHeight - rect.top + 7 : null,
  })
}
function hideAbilityTooltip() { tooltip.visible = false }
</script>

<style scoped>
.race-card {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(270px, .9fr) minmax(0, 1.65fr);
  width: 100%;
  min-height: 230px;
  text-align: left;
  color: inherit;
  font: inherit;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  cursor: pointer;
  transition: transform .18s cubic-bezier(.22, 1, .36, 1), border-color .15s, box-shadow .18s, min-height .42s cubic-bezier(.22, 1, .36, 1), grid-template-columns .42s cubic-bezier(.22, 1, .36, 1);
}
.race-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 44%, var(--border));
  box-shadow: var(--shadow-md);
}
.race-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.race-card-visual {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-raised));
}
.race-card-visual img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 24%;
  transition: transform .35s cubic-bezier(.22, 1, .36, 1);
}
.race-card:hover .race-card-visual img { transform: scale(1.025); }
.race-card-vignette {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, color-mix(in srgb, var(--bg) 42%, transparent), transparent 45%);
  pointer-events: none;
}
.race-card-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 64px;
  color: var(--accent);
}
.race-card-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 18px 20px;
}
.race-card-title {
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 600;
  line-height: 1.12;
  color: var(--text-1);
}
.race-card-subtitle { font-size: 12px; color: var(--text-muted); }
.race-card-description {
  display: -webkit-box;
  margin-top: 5px;
  overflow: hidden;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.race-card-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}
.race-card-fact {
  min-width: 0;
  padding: 6px 8px;
  background: color-mix(in srgb, var(--surface-raised) 74%, transparent);
  border-radius: 8px;
}
.race-card-fact--wide { grid-column: 1 / -1; }
.race-card-fact > span {
  display: block;
  margin-bottom: 2px;
  color: var(--text-muted);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.race-card-fact b {
  display: block;
  overflow: hidden;
  color: var(--text-1);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  text-overflow: ellipsis;
}
.race-card-ability-list { display: flex !important; flex-wrap: wrap; gap: 3px 9px; white-space: normal; }
.race-card-ability { position: relative; }
.race-card-ability:not(:last-child)::after { content: '·'; position: absolute; left: calc(100% + 4px); color: var(--text-muted); }
.race-card-ability--described { cursor: help; text-decoration: underline dotted color-mix(in srgb, var(--text-muted) 72%, transparent); text-underline-offset: 3px; }
.race-card-subraces { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.race-card-subraces-label { color: var(--text-muted); font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.race-card-subrace-list { display: flex; flex-wrap: wrap; gap: 5px; }
.race-card-subrace {
  padding: 4px 8px;
  color: var(--text-2);
  background: color-mix(in srgb, var(--surface-raised) 82%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}
.race-card-choices {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  margin-top: 8px;
  padding: 6px 9px;
  color: var(--accent-soft);
  background: color-mix(in srgb, var(--accent) 11%, transparent);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}
.race-card-choices svg { width: 13px; height: 13px; flex-shrink: 0; }
.race-card-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  margin-bottom: 5px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.race-card-status svg { width: 14px; height: 14px; }
.race-card-note { margin-top: 7px; font-size: 12px; line-height: 1.4; color: var(--text-2); }

.race-card--selected {
  grid-template-columns: minmax(300px, .95fr) minmax(0, 1.25fr);
  min-height: 300px;
  border-color: color-mix(in srgb, var(--accent) 52%, var(--border));
  box-shadow: var(--shadow-lg);
}
.race-card--selected:hover { transform: none; }
.race-card--selected .race-card-visual { height: 100%; aspect-ratio: auto; }
.race-card--selected .race-card-visual img { object-position: center 24%; }
.race-card--selected .race-card-body { padding: 24px; }
.race-card--selected .race-card-title { font-size: 30px; }

@media (max-width: 700px) {
  .race-card, .race-card--selected { display: flex; flex-direction: column; min-height: 0; }
  .race-card .race-card-visual, .race-card--selected .race-card-visual { height: auto; aspect-ratio: 1.85 / 1; }
  .race-card .race-card-body, .race-card--selected .race-card-body { padding: 16px; }
  .race-card--selected .race-card-title { font-size: 25px; }
}
</style>
