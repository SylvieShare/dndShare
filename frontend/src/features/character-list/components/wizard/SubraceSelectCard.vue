<template>
  <button
    type="button"
    class="subrace-card"
    :class="{ 'subrace-card--selected': selected }"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="subrace-card-media">
      <img v-if="imageUrl" :src="imageUrl" :alt="`Мужчина и женщина — ${title}`" />
      <span v-else class="subrace-card-fallback">{{ monogram }}</span>
      <span v-if="selected" class="subrace-card-status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
        Выбрано
      </span>
    </span>
    <span class="subrace-card-copy">
      <strong>{{ title }}</strong>
      <span v-if="subtitle">{{ subtitle }}</span>
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
.subrace-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  border-radius: calc(var(--r-md) + 3px);
  background: var(--surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.subrace-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 46%, var(--border));
  box-shadow: 0 10px 26px color-mix(in srgb, var(--accent) 11%, transparent);
}
.subrace-card--selected {
  border-color: color-mix(in srgb, var(--accent) 78%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent), 0 12px 30px color-mix(in srgb, var(--accent) 16%, transparent);
}
.subrace-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.subrace-card-media {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised));
}
.subrace-card-media::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 38%;
  pointer-events: none;
  background: linear-gradient(transparent, color-mix(in srgb, var(--bg) 58%, transparent));
}
.subrace-card-media img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform .28s ease; }
.subrace-card:hover .subrace-card-media img { transform: scale(1.025); }
.subrace-card-fallback { color: var(--accent); font-family: var(--font-display); font-size: 56px; font-weight: 700; }
.subrace-card-status {
  position: absolute;
  z-index: 1;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 52%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 76%, transparent);
  backdrop-filter: blur(10px);
  color: var(--text-1);
  font-size: 10px;
  font-weight: 700;
}
.subrace-card-status svg { width: 12px; height: 12px; color: var(--accent); }
.subrace-card-copy { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 12px 14px 13px; }
.subrace-card-copy strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.subrace-card-copy > span { flex: 0 0 auto; color: var(--accent); font-size: 11px; font-weight: 700; }
</style>
