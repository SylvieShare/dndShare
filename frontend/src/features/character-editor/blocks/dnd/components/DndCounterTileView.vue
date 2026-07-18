<template>
  <!-- Shared counter face, rendered in the tile and in the morph #view so they never drift.
       Chrome (border/bg/radius) lives on the wrapper; this owns only padding + content. -->
  <div class="dctv" :style="counter.color ? { '--cc': counter.color } : null">
    <div class="dctv-head">
      <component :is="icon" class="dctv-icon" :size="15" :stroke-width="2" :style="counter.color ? { color: counter.color } : null" />
      <span class="dctv-name" :class="{ 'dctv-name--empty': !counter.name }">{{ counter.name || 'Без названия' }}</span>
    </div>

    <div class="dctv-body">
      <button v-if="manage" class="dctv-step" type="button" :disabled="!interactive" @click.stop="$emit('dec')">−</button>
      <span class="dctv-num">
        <span class="dctv-val">{{ counter.value }}</span>
        <small v-if="counter.max != null" class="dctv-max">/{{ counter.max }}</small>
      </span>
      <button v-if="manage" class="dctv-step" type="button" :disabled="!interactive" @click.stop="$emit('inc')">+</button>
    </div>

    <div class="dctv-bar">
      <span class="dctv-fill" :style="{ width: fillPct + '%' }"></span>
    </div>
    <div v-if="counter.max == null && counter.unit" class="dctv-unit">{{ counter.unit }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolveIcon } from '@/shared/ui/icons/counterIcons'

const props = defineProps({
  counter: { type: Object, required: true },
  manage: { type: Boolean, default: false },     // owner → show steppers
  interactive: { type: Boolean, default: true }, // false in the morph clone → controls inert
})

defineEmits(['inc', 'dec'])

const icon = computed(() => resolveIcon(props.counter.icon))
const fillPct = computed(() => {
  const { value, max } = props.counter
  if (max == null || max <= 0) return 100
  return Math.round(Math.min(1, Math.max(0, value / max)) * 100)
})
</script>

<style scoped>
.dctv {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 11px 12px;
  min-width: 0;
  box-sizing: border-box;
}

.dctv-head {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  color: var(--text-muted);
}
.dctv-icon { flex-shrink: 0; }
.dctv-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dctv-name--empty { font-style: italic; opacity: 0.7; }

.dctv-body { display: flex; align-items: center; gap: 10px; }

.dctv-step {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-2);
  font-size: 19px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.dctv-step:hover { background: rgba(255, 255, 255, 0.09); color: var(--text-1); }
.dctv-step:disabled { cursor: default; opacity: 0.5; background: transparent; }

.dctv-num { display: inline-flex; align-items: baseline; }
.dctv-val {
  font-size: 25px;
  font-weight: 800;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.dctv-max { font-size: 13px; font-weight: 700; color: var(--text-muted); }

.dctv-bar {
  position: relative;
  width: 86px;
  max-width: 100%;
  height: 6px;
  background: #0d0e15;
  border: 1px solid #3a3d4d;
  border-radius: 999px;
  overflow: hidden;
}
.dctv-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: var(--cc, var(--accent));
  box-shadow: 0 0 7px var(--cc, var(--accent));
  border-radius: 999px;
  transition: width 0.4s cubic-bezier(0.5, 0, 0.2, 1);
}

.dctv-unit { font-size: 11px; color: var(--text-muted); }
</style>
