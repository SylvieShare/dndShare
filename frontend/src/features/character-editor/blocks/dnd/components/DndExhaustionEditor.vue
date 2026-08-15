<template>
  <EditorPanel :title="embedded ? '' : (configMode ? 'Настройка истощения' : 'Уровень истощения')">
    <template v-if="!configMode">
      <div class="exh-levels">
        <button
          v-for="n in (max + 1)"
          :key="n - 1"
          type="button"
          class="exh-lvl"
          :class="{ 'exh-lvl--active': level === n - 1 }"
          @click="setLevel(n - 1)"
        >{{ n - 1 === 0 ? 'Нет' : n - 1 }}</button>
      </div>
      <div class="exh-effects">
        <div
          v-for="(effect, index) in effects"
          :key="index"
          class="exh-eff"
          :class="{ 'exh-eff--on': level >= index + 1 }"
        >
          <span class="exh-eff-n">{{ index + 1 }}</span>
          <span class="exh-eff-text">{{ effect }}</span>
        </div>
      </div>
      <button class="exh-edit-btn" type="button" @click="configMode = true">Редактировать</button>
    </template>

    <template v-else>
      <div class="exh-cfg-max">
        <span class="exh-cfg-label">Максимальный уровень</span>
        <FormNumberInput :value="max" :min="1" :max="20" @change="setMax" />
      </div>
      <div class="exh-cfg-list">
        <div v-for="(effect, index) in effects" :key="index" class="exh-cfg-row">
          <span class="exh-eff-n">{{ index + 1 }}</span>
          <FormTextInput :value="effect" :placeholder="`Эффект уровня ${index + 1}`" @update:value="text => setEffect(index, text)" />
        </div>
      </div>
      <button class="exh-edit-btn" type="button" @click="configMode = false">Готово</button>
    </template>
  </EditorPanel>
</template>

<script setup>
import { computed, ref } from 'vue'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { normalizeExhaustion } from '@/features/character-editor/blocks/dnd/lib/exhaustion'

const props = defineProps({
  value: { type: Object, default: () => ({ level: 0 }) },
  embedded: { type: Boolean, default: false },
})
const emit = defineEmits(['change'])
const configMode = ref(false)

const normalized = computed(() => normalizeExhaustion(props.value))
const data = computed(() => normalized.value.data)
const max = computed(() => normalized.value.max)
const effects = computed(() => normalized.value.effects)
const level = computed(() => normalized.value.level)

function emitValue(patch) {
  emit('change', { ...data.value, ...patch })
}
function setLevel(nextLevel) {
  emitValue({ level: nextLevel })
}
function setMax(value) {
  const nextMax = Math.max(1, Math.min(20, parseInt(value) || 6))
  emitValue({
    max: nextMax,
    level: Math.min(level.value, nextMax),
    effects: effects.value.slice(0, nextMax),
  })
}
function setEffect(index, text) {
  const nextEffects = effects.value.slice()
  nextEffects[index] = text
  emitValue({ effects: nextEffects })
}
</script>

<style scoped>
.exh-levels { display: flex; gap: 6px; flex-wrap: wrap; }
.exh-lvl {
  min-width: 38px;
  height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.exh-lvl:hover { border-color: var(--text-muted); color: var(--text-1); }
.exh-lvl--active {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: var(--danger);
}
.exh-effects { display: flex; flex-direction: column; gap: 5px; }
.exh-eff { display: flex; align-items: flex-start; gap: 8px; color: var(--text-muted); opacity: 0.5; }
.exh-eff--on { color: var(--text-2); opacity: 1; }
.exh-eff-n {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  color: inherit;
  font-size: 10px;
  font-weight: 800;
  flex-shrink: 0;
}
.exh-eff--on .exh-eff-n { border-color: var(--danger); color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.exh-eff-text { font-size: 12px; line-height: 1.4; padding-top: 3px; }
.exh-edit-btn {
  align-self: flex-start;
  border: none;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
  padding: 2px 0;
}
.exh-edit-btn:hover { color: var(--text-2); }
.exh-cfg-max { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.exh-cfg-label { color: var(--text-muted); font-size: 12px; }
.exh-cfg-list { display: flex; flex-direction: column; gap: 6px; }
.exh-cfg-row { display: flex; align-items: center; gap: 8px; }
.exh-cfg-row :deep(.form-text-input),
.exh-cfg-row :deep(input) { flex: 1; min-width: 0; }
</style>
