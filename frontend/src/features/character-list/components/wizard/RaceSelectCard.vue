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
      <span v-if="selected" class="race-card-note">Особенности и доступные варианты показаны ниже</span>
    </span>
  </button>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  monogram: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  selected: { type: Boolean, default: false },
})
defineEmits(['select'])
</script>

<style scoped>
.race-card {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-align: left;
  color: inherit;
  font: inherit;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  cursor: pointer;
  transition: transform .18s cubic-bezier(.22, 1, .36, 1), border-color .15s, box-shadow .18s;
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
  aspect-ratio: 2.05 / 1;
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
  gap: 3px;
  padding: 13px 15px 15px;
}
.race-card-title {
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 600;
  line-height: 1.12;
  color: var(--text-1);
}
.race-card-subtitle { font-size: 12px; color: var(--text-muted); }
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
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(230px, .75fr);
  width: 100%;
  min-height: 260px;
  border-color: color-mix(in srgb, var(--accent) 52%, var(--border));
  background: color-mix(in srgb, var(--accent) 5%, var(--surface));
  box-shadow: var(--shadow-lg);
}
.race-card--selected:hover { transform: none; }
.race-card--selected .race-card-visual { height: 100%; aspect-ratio: auto; }
.race-card--selected .race-card-visual img { object-position: center 24%; }
.race-card--selected .race-card-body {
  justify-content: center;
  padding: 24px;
}
.race-card--selected .race-card-title { font-size: 30px; }

@media (max-width: 700px) {
  .race-card--selected { display: flex; min-height: 0; }
  .race-card--selected .race-card-visual { height: auto; aspect-ratio: 1.85 / 1; }
  .race-card--selected .race-card-body { padding: 16px; }
  .race-card--selected .race-card-title { font-size: 25px; }
}
</style>
