<template>
  <div class="rest-face" :class="{ 'rest-face--static': !interactive }">
    <button
      class="rest-half rest-half--short"
      type="button"
      :disabled="!interactive"
      title="Короткий отдых"
      aria-label="Короткий отдых"
      @click.stop="$emit('short', $event)"
    >
      <svg class="rest-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" />
        <path d="M17 9h2a2 2 0 0 1 0 4h-2" />
        <path d="M7 2.5v2M10.5 2.5v2M13.5 2.5v2" />
      </svg>
    </button>

    <button
      class="rest-half rest-half--long"
      type="button"
      :disabled="!interactive"
      title="Длинный отдых"
      aria-label="Длинный отдых"
      @click.stop="$emit('long', $event)"
    >
      <svg class="rest-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>

    <span class="rest-divider" aria-hidden="true" />
  </div>
</template>

<script setup>
// Presentational rest tile: two diagonally-split halves (short rest left, long rest right).
// Shared by the BLOCK tile and the short-rest morph #view (the latter passes no `interactive`).
defineProps({
  interactive: { type: Boolean, default: false },
})
defineEmits(['short', 'long'])
</script>

<style scoped>
.rest-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  user-select: none;
}

.rest-half {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  transition: background 0.18s ease, transform 0.12s ease;
  touch-action: manipulation;
}
.rest-half:disabled { cursor: default; }

/* Complementary triangles sharing one seam (57% top → 45% bottom) — no overlap, so the hover
   highlights never bleed into each other. padding-right/left:50% keeps each half's content centred
   inside its own triangle; the vertical justify lifts "short" up and drops "long" down. */
.rest-half--short {
  clip-path: polygon(0 0, 57% 0, 45% 100%, 0 100%);
  justify-content: flex-start;
  padding: 16px 50% 0 0;
  color: var(--text-2);
}
.rest-half--long {
  clip-path: polygon(57% 0, 100% 0, 100% 100%, 45% 100%);
  justify-content: flex-end;
  padding: 0 0 16px 50%;
  color: var(--accent-soft);
}

.rest-face:not(.rest-face--static) .rest-half--short:hover { background: color-mix(in srgb, var(--warning) 18%, transparent); }
.rest-face:not(.rest-face--static) .rest-half--long:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }
.rest-face:not(.rest-face--static) .rest-half:active { transform: scale(0.95); }

.rest-ic { width: 30px; height: 30px; flex-shrink: 0; }

/* The seam, as a thin diagonal band over the buttons. Percentage clip-path → scales with the tile
   at any size, so it always sits exactly on the boundary between the two triangles. */
.rest-divider {
  position: absolute;
  inset: 0;
  background: var(--border-strong);
  clip-path: polygon(55.5% 0, 58.5% 0, 46.5% 100%, 43.5% 100%);
  pointer-events: none;
}
</style>
