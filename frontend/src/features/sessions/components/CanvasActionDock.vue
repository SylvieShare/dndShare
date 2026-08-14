<template>
  <nav v-if="actions.length" class="canvas-action-dock" aria-label="Действия холста">
    <button
      v-for="action in actions"
      :key="action.id"
      type="button"
      class="canvas-action"
      :title="action.label"
      @click="$emit('action', action.id)"
    >
      <span class="canvas-action-label">{{ action.label }}</span>
      <span class="canvas-action-icon" aria-hidden="true">
        <svg v-if="action.icon === 'chapter'" viewBox="0 0 24 24">
          <path d="M5 4.5h10a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2v-13Z"/><path d="M7 19.5v-11a2 2 0 0 1 2-2h8"/>
        </svg>
        <svg v-else-if="action.icon === 'scene'" viewBox="0 0 24 24">
          <path d="M4 7.5h16v11H4zM4 7.5l3-4 3 4 3-4 3 4 3-4"/>
        </svg>
        <svg v-else-if="action.icon === 'list'" viewBox="0 0 24 24">
          <path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/>
        </svg>
        <svg v-else-if="action.icon === 'combat'" viewBox="0 0 24 24">
          <path d="m6 4 12 16M18 4 6 20M4.5 2.5 8 6M19.5 2.5 16 6M4 21h4M16 21h4"/>
        </svg>
        <svg v-else viewBox="0 0 24 24">
          <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>
        </svg>
        <span class="canvas-action-plus">+</span>
      </span>
    </button>
  </nav>
</template>

<script setup>
defineProps({ actions: { type: Array, default: () => [] } })
defineEmits(['action'])
</script>

<style scoped>
.canvas-action-dock {
  position: absolute;
  z-index: 24;
  top: 16px;
  right: calc(var(--chapter-safe-right, 0px) + 16px);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
}
.canvas-action {
  position: relative;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border-strong));
  border-radius: 14px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--surface-raised) 94%, var(--accent) 6%), color-mix(in srgb, var(--surface) 93%, transparent));
  color: var(--accent-soft);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--bg) 52%, transparent), inset 0 1px color-mix(in srgb, var(--text-1) 9%, transparent);
  cursor: pointer;
  backdrop-filter: blur(14px) saturate(1.15);
  pointer-events: auto;
  transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
}
.canvas-action:hover,
.canvas-action:focus-visible {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--surface-active) 82%, var(--accent) 18%);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--accent) 16%, transparent), inset 0 1px color-mix(in srgb, var(--text-1) 14%, transparent);
  outline: none;
  transform: translateX(-3px);
}
.canvas-action-icon { position: relative; width: 21px; height: 21px; display: grid; place-items: center; }
.canvas-action-icon svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
.canvas-action-plus {
  position: absolute;
  right: -7px;
  bottom: -7px;
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border: 2px solid var(--app-canvas-bg);
  border-radius: 50%;
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
}
.canvas-action-label {
  position: absolute;
  right: 56px;
  max-width: 190px;
  padding: 6px 9px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: color-mix(in srgb, var(--popover-bg) 94%, transparent);
  color: var(--text-1);
  font-size: 11px;
  font-weight: 700;
  opacity: 0;
  transform: translateX(5px);
  white-space: nowrap;
  box-shadow: var(--shadow-lg);
  pointer-events: none;
  transition: opacity .14s ease, transform .14s ease;
}
.canvas-action:hover .canvas-action-label,
.canvas-action:focus-visible .canvas-action-label { opacity: 1; transform: translateX(0); }
@media (max-width: 720px) {
  .canvas-action-dock { right: calc(var(--chapter-safe-right, 0px) + 9px); }
  .canvas-action { width: 42px; height: 42px; border-radius: 12px; }
}
</style>
