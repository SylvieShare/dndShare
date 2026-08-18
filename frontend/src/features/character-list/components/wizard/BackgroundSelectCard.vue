<template>
  <button
    type="button"
    class="background-card"
    :class="{ 'background-card--selected': selected }"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="background-card-visual">
      <img v-if="imageUrl" :src="imageUrl" :alt="`Иллюстрация предыстории «${title}»`" loading="lazy" />
      <span v-else class="background-card-fallback" aria-hidden="true">{{ monogram }}</span>
      <span class="background-card-vignette" aria-hidden="true" />
      <span v-if="selected" class="background-card-status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6" /></svg>
        Выбрано
      </span>
    </span>

    <span class="background-card-body">
      <span class="background-card-title">{{ title }}</span>
      <span v-if="description" class="background-card-description">{{ description }}</span>
      <span v-if="subtitle" class="background-card-skills">
        <span>Навыки</span>
        <b>{{ subtitle }}</b>
      </span>
    </span>
  </button>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  description: { type: String, default: '' },
  monogram: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  selected: { type: Boolean, default: false },
})
defineEmits(['select'])
</script>

<style scoped>
.background-card {
  min-width: 0; width: 100%; padding: 0; overflow: hidden; display: flex; flex-direction: column;
  color: inherit; font: inherit; text-align: left; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--r-lg); cursor: pointer;
  transition: transform .18s cubic-bezier(.22,1,.36,1), border-color .15s, box-shadow .18s;
}
.background-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--accent) 44%, var(--border)); box-shadow: var(--shadow-md); }
.background-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.background-card--selected { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); box-shadow: 0 14px 34px color-mix(in srgb, var(--bg) 30%, transparent); }
.background-card--selected:hover { transform: none; }
.background-card-visual { position: relative; display: block; width: 100%; aspect-ratio: 3 / 2; overflow: hidden; background: color-mix(in srgb, var(--accent) 8%, var(--surface-raised)); }
.background-card-visual img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 28%; transition: transform .35s cubic-bezier(.22,1,.36,1); }
.background-card:hover .background-card-visual img { transform: scale(1.025); }
.background-card-vignette { position: absolute; inset: 0; background: linear-gradient(to top, color-mix(in srgb, var(--bg) 58%, transparent), transparent 48%); pointer-events: none; }
.background-card-fallback { position: absolute; inset: 0; display: grid; place-items: center; color: var(--accent); font-family: var(--font-display); font-size: 58px; font-weight: 600; }
.background-card-status { position: absolute; left: 12px; bottom: 10px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; color: var(--text-1); background: color-mix(in srgb, var(--bg) 76%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border)); border-radius: 999px; backdrop-filter: blur(10px); font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.background-card-status svg { width: 13px; height: 13px; color: var(--accent); }
.background-card-body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; padding: 14px 16px 15px; }
.background-card-title { color: var(--text-1); font-family: var(--font-display); font-size: 20px; font-weight: 600; line-height: 1.15; }
.background-card-description { display: -webkit-box; overflow: hidden; color: var(--text-2); font-size: 12px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.background-card-skills { display: flex; flex-direction: column; gap: 2px; margin-top: auto; padding-top: 7px; }
.background-card-skills span { color: var(--text-muted); font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.background-card-skills b { overflow: hidden; color: var(--text-1); font-size: 11px; font-weight: 500; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .background-card, .background-card-visual img { transition: none; } }
</style>
