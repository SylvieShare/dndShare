<template>
  <button
    ref="anchorEl"
    type="button"
    class="enc-marker"
    :class="{ 'enc-marker--editable': editable }"
    :style="markerStyle"
    :aria-label="`Метка существа ${combatant.markerLetter || '—'}`"
    :aria-expanded="open"
    title="Изменить букву и цвет"
    @click.stop="toggle"
    @pointerdown.stop
  >{{ combatant.markerLetter || '—' }}</button>

  <BasePopover v-model:open="open" :anchor="anchorEl" placement="bottom-start" :min-width="246">
    <div class="emm-panel">
      <div class="emm-label">Буква существа</div>
      <div class="emm-grid">
        <button
          v-for="letter in enc.ENCOUNTER_LETTERS"
          :key="letter"
          type="button"
          class="emm-letter"
          :class="{
            'emm-letter--active': combatant.markerLetter === letter,
            'emm-letter--used': usedLetters.has(letter) && combatant.markerLetter !== letter,
          }"
          :title="usedLetters.has(letter) && combatant.markerLetter !== letter ? 'Занята — метки поменяются местами' : letter"
          @click="pickLetter(letter)"
        >{{ letter }}</button>
      </div>

      <div class="emm-separator" />
      <div class="emm-label">Цвет метки</div>
      <ColorPresetPicker
        inline
        allow-clear
        :model-value="combatant.iconColor || ''"
        @update:model-value="enc.setIconColor(combatant, $event)"
      />
    </div>
  </BasePopover>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import BasePopover from '@/shared/ui/BasePopover.vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker.vue'

const props = defineProps({
  combatant: { type: Object, required: true },
  editable: { type: Boolean, default: false },
})

const enc = inject('encounter')
const anchorEl = ref(null)
const open = ref(false)

const markerColor = computed(() => enc.avatarStyle(props.combatant)?.color || 'var(--text-2)')
const markerStyle = computed(() => ({ '--enc-marker-color': markerColor.value }))
const usedLetters = computed(() => new Set(
  enc.encounter.combatants
    .filter(c => c.type === 'npc' && c.uid !== props.combatant.uid)
    .map(c => c.markerLetter)
))

function toggle() {
  if (!props.editable) return
  open.value = !open.value
}

function pickLetter(letter) {
  enc.setMarkerLetter(props.combatant, letter)
  open.value = false
}
</script>

<style scoped>
.enc-marker {
  display: grid;
  width: 38px;
  height: 42px;
  flex: 0 0 38px;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--enc-marker-color) 58%, var(--border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--enc-marker-color) 14%, var(--surface));
  color: var(--enc-marker-color);
  font: inherit;
  font-size: 18px;
  font-weight: 850;
  line-height: 1;
}

.enc-marker--editable { cursor: pointer; transition: transform 0.12s, background 0.12s; }
.enc-marker--editable:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--enc-marker-color) 22%, var(--surface)); }

.emm-panel { display: flex; flex-direction: column; gap: 9px; padding: 2px; }
.emm-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.emm-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.emm-letter {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}
.emm-letter:hover { border-color: var(--accent); color: var(--text-1); }
.emm-letter--used { opacity: 0.48; }
.emm-letter--active { border-color: var(--enc-marker-color, var(--accent)); background: color-mix(in srgb, var(--accent) 16%, var(--surface)); color: var(--accent); opacity: 1; }
.emm-separator { height: 1px; background: var(--border); }
</style>
