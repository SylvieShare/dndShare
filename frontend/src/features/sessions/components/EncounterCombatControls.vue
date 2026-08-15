<template>
  <div class="enc-combat-controls" @click.stop @pointerdown.stop>
    <EncCheckbox
      v-if="showCheckbox"
      :model-value="selected"
      :disabled="!editable || !combatant"
      @update:model-value="$emit('update:selected', $event)"
    />

    <label class="ecc-initiative" :class="{ 'ecc-initiative--current': current }" title="Инициатива">
      <span>Иниц.</span>
      <input
        type="number"
        :value="combatant?.initiative"
        :disabled="!editable || !combatant"
        placeholder="·"
        aria-label="Инициатива"
        @change="$emit('update:initiative', $event.target.value)"
        @click.stop
      />
    </label>
    <div class="ecc-ac" title="Класс брони">
      <Shield :size="14" :stroke-width="1.8" />
      <span>{{ armorClass ?? '—' }}</span>
    </div>
  </div>
</template>

<script setup>
import { Shield } from '@lucide/vue'
import { CompactCheckbox as EncCheckbox } from '@sylvieshare/share-ui'

defineProps({
  combatant: { type: Object, default: null },
  selected: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  armorClass: { type: [Number, String], default: null },
  showCheckbox: { type: Boolean, default: true },
  current: { type: Boolean, default: false },
})
defineEmits(['update:selected', 'update:initiative'])
</script>

<style scoped>
.enc-combat-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  animation: ecc-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.ecc-initiative,
.ecc-ac {
  display: flex;
  width: 42px;
  min-height: 42px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
}

.ecc-initiative {
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.ecc-initiative--current {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 10%, transparent);
}

.ecc-initiative > span {
  color: var(--text-muted);
  font-size: 8px;
  font-weight: 750;
  letter-spacing: 0.05em;
  line-height: 1;
  text-transform: uppercase;
}

.ecc-initiative--current > span,
.ecc-initiative--current input { color: var(--accent-soft); }

.ecc-initiative input {
  width: 100%;
  box-sizing: border-box;
  padding: 3px 2px 0;
  border: 0;
  outline: 0;
  background: none;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  font-weight: 750;
  line-height: 1;
  text-align: center;
  -moz-appearance: textfield;
}

.ecc-initiative input::-webkit-outer-spin-button,
.ecc-initiative input::-webkit-inner-spin-button { margin: 0; -webkit-appearance: none; }
.ecc-initiative:focus-within { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
.ecc-initiative input:disabled { cursor: default; opacity: 0.7; }

.ecc-ac {
  gap: 2px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 750;
}
.ecc-ac svg { color: var(--info); }

@keyframes ecc-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .enc-combat-controls { animation: none; }
}
</style>
