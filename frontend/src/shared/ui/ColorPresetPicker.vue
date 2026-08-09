<template>
  <div v-if="inline" class="cpp-body cpp-body--inline">
    <div class="cpp-grid">
      <button
        v-for="c in PRESET_COLORS"
        :key="c"
        type="button"
        class="cpp-color"
        :class="{ active: isActive(c) }"
        :style="{ background: c }"
        :title="c"
        @mousedown.prevent="pick(c)"
      ></button>
    </div>
    <div v-if="allowCustom || allowClear" class="cpp-extra">
      <template v-if="allowCustom">
        <label class="cpp-native">
          <span class="cpp-native-sw" :style="{ background: modelValue || '#888888' }"></span>
          <input type="color" :value="hexValue" @input="emitColor($event.target.value)" />
        </label>
        <input
          type="text"
          class="cpp-hex"
          :value="modelValue || ''"
          placeholder="#hex"
          spellcheck="false"
          @input="emitColor($event.target.value)"
        />
      </template>
      <button v-if="allowClear" type="button" class="cpp-clear" @mousedown.prevent="clear">Сбросить</button>
    </div>
  </div>

  <span v-else ref="anchorEl" class="cpp-host">
    <slot name="trigger" :toggle="toggle" :open="open" :value="modelValue">
      <button
        type="button"
        class="cpp-swatch"
        :class="{ 'cpp-swatch--empty': !modelValue }"
        :style="modelValue ? { background: modelValue } : null"
        @click="toggle"
      ></button>
    </slot>
    <BasePopover :open="open" :anchor="anchorEl" :placement="placement" :min-width="0" :z-index="zIndex" :transition="transName" @update:open="onPopoverState">
      <div class="cpp-body">
        <div class="cpp-grid">
          <button
            v-for="c in PRESET_COLORS"
            :key="c"
            type="button"
            class="cpp-color"
            :class="{ active: isActive(c) }"
            :style="{ background: c }"
            :title="c"
            @mousedown.prevent="pick(c)"
          ></button>
        </div>
        <div v-if="allowCustom || allowClear" class="cpp-extra">
          <template v-if="allowCustom">
            <label class="cpp-native">
              <span class="cpp-native-sw" :style="{ background: modelValue || '#888888' }"></span>
              <input type="color" :value="hexValue" @input="emitColor($event.target.value)" />
            </label>
            <input
              type="text"
              class="cpp-hex"
              :value="modelValue || ''"
              placeholder="#hex"
              spellcheck="false"
              @input="emitColor($event.target.value)"
            />
          </template>
          <button v-if="allowClear" type="button" class="cpp-clear" @mousedown.prevent="clear">Сбросить</button>
        </div>
      </div>
    </BasePopover>
  </span>
</template>

<script setup>
import { computed, ref } from 'vue'
import BasePopover from '@/shared/ui/BasePopover'
import { PRESET_COLORS } from '@/shared/ui/colorPresets'

const props = defineProps({
  modelValue: { type: String, default: '' },
  allowCustom: { type: Boolean, default: false },
  allowClear: { type: Boolean, default: false },
  clearValue: { type: String, default: null },
  inline: { type: Boolean, default: false },
  placement: { type: String, default: 'bottom-start' },
  zIndex: { type: Number, default: 4000 },
})
const emit = defineEmits(['update:modelValue'])

const anchorEl = ref(null)
const open = ref(false)
// Picked a color → confirming "grow + fade"; closed without choosing → quick "retract".
const transName = ref('cpppop-cancel')

const hexValue = computed(() => (/^#[0-9a-fA-F]{6}$/.test(props.modelValue || '') ? props.modelValue : '#888888'))

function isActive(c) {
  return (props.modelValue || '').toLowerCase() === c.toLowerCase()
}

function openPopover() {
  transName.value = 'cpppop-cancel'
  open.value = true
}

function closePopover(reason) {
  transName.value = reason === 'pick' ? 'cpppop-pick' : 'cpppop-cancel'
  open.value = false
}

function toggle() {
  if (open.value) closePopover('cancel')
  else openPopover()
}

function onPopoverState(v) {
  if (!v) closePopover('cancel')
}

function emitColor(v) {
  emit('update:modelValue', v)
}

function pick(c) {
  emit('update:modelValue', c)
  closePopover('pick')
}

function clear() {
  emit('update:modelValue', props.clearValue)
  closePopover('pick')
}
</script>

<style scoped>
.cpp-host {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.cpp-swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid color-mix(in srgb, var(--text-on-accent) 15%, transparent);
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s, transform 0.15s;
}
.cpp-swatch:hover { border-color: color-mix(in srgb, var(--text-on-accent) 45%, transparent); transform: scale(1.1); }
.cpp-swatch--empty { background: var(--bg); border-style: dashed; }

.cpp-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px;
}
.cpp-body--inline { padding: 0; }

.cpp-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.cpp-color {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.cpp-color:hover { transform: scale(1.18); }
.cpp-color.active { border-color: color-mix(in srgb, var(--text-on-accent) 80%, transparent); transform: scale(1.08); }

.cpp-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpp-native {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  cursor: pointer;
  flex-shrink: 0;
}
.cpp-native-sw { position: absolute; inset: 0; }
.cpp-native input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

.cpp-hex {
  flex: 1;
  min-width: 0;
  height: 28px;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  color: var(--text-1);
  font: inherit;
  font-size: 12px;
  font-family: inherit;
  padding: 0 8px;
  outline: none;
  transition: border-color 0.12s;
}
.cpp-hex:focus { border-color: var(--accent); }

.cpp-clear {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: color 0.12s;
}
.cpp-clear:hover { color: var(--text-2); }
</style>

<style>
.cpppop-pick-enter-active,
.cpppop-cancel-enter-active {
  transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.3, 1);
  transform-origin: top center;
}
.cpppop-pick-enter-from,
.cpppop-cancel-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-6px);
}

.cpppop-pick-leave-active {
  transition: opacity 0.26s ease, transform 0.26s cubic-bezier(0.3, 0, 0.5, 1);
  transform-origin: top center;
}
.cpppop-pick-leave-to {
  opacity: 0;
  transform: scale(1.09);
}

.cpppop-cancel-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
  transform-origin: top center;
}
.cpppop-cancel-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(-5px);
}
</style>
