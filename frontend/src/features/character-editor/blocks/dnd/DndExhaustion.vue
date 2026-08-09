<template>
  <BaseTile class="exh-tile" :color="color" :strip="level > 0" interactive @click="open">
    <DndExhaustionView :level="level" :value-text="valueText" :active-effects="activeEffects" />
  </BaseTile>

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :color="color"
    :strip="level > 0"
    :min-view-width="220"
    @close="closeEditor"
  >
    <template #view>
      <div class="exh-face">
        <DndExhaustionView :level="level" :value-text="valueText" :active-effects="activeEffects" />
      </div>
    </template>

    <template #editor>
      <EditorPanel :title="configMode ? 'Настройка истощения' : 'Уровень истощения'">
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
              v-for="(eff, i) in effects"
              :key="i"
              class="exh-eff"
              :class="{ 'exh-eff--on': level >= i + 1 }"
            >
              <span class="exh-eff-n">{{ i + 1 }}</span>
              <span class="exh-eff-text">{{ eff }}</span>
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
            <div v-for="(eff, i) in effects" :key="i" class="exh-cfg-row">
              <span class="exh-eff-n">{{ i + 1 }}</span>
              <FormTextInput :value="eff" :placeholder="`Эффект уровня ${i + 1}`" @update:value="v => setEffect(i, v)" />
            </div>
          </div>
          <button class="exh-edit-btn" type="button" @click="configMode = false">Готово</button>
        </template>
      </EditorPanel>
    </template>
  </MorphEditorShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import DndExhaustionView from '@/features/character-editor/blocks/dnd/components/DndExhaustionView'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'

// D&D 5e exhaustion effects (cumulative) — used as defaults until overridden per-character.
const DEFAULT_EFFECTS = [
  'Помеха на проверки характеристик',
  'Скорость уменьшена вдвое',
  'Помеха на броски атаки и спасброски',
  'Максимум хитов уменьшен вдвое',
  'Скорость становится 0',
  'Смерть',
]

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()

const configMode = ref(false)
function closeEditor() { configMode.value = false; close() }

// Value is an object `{ level, max?, effects? }`; tolerate the legacy plain-number form.
const data = computed(() => {
  const v = props.value
  if (v && typeof v === 'object') return v
  return { level: parseInt(v) || 0 }
})

const max = computed(() => {
  const m = parseInt(data.value.max)
  return m > 0 ? Math.min(20, m) : 6
})
const effects = computed(() => {
  const arr = Array.isArray(data.value.effects) ? data.value.effects : []
  return Array.from({ length: max.value }, (_, i) =>
    arr[i] != null && arr[i] !== '' ? arr[i] : (DEFAULT_EFFECTS[i] || `Уровень ${i + 1}`)
  )
})
const level = computed(() => Math.max(0, Math.min(max.value, parseInt(data.value.level) || 0)))
const activeEffects = computed(() => effects.value.slice(0, level.value))
const valueText = computed(() => (level.value > 0 ? `${level.value} ур.` : 'нет'))
const color = computed(() => (level.value > 0 ? 'var(--danger)' : 'var(--text-muted)'))

function emitValue(patch) {
  const cur = props.value && typeof props.value === 'object' ? props.value : { level: level.value }
  emit('update:value', props.block.id, { ...cur, ...patch })
}
function setLevel(n) { emitValue({ level: n }) }
function setMax(m) {
  const mm = Math.max(1, Math.min(20, parseInt(m) || 6))
  emitValue({ max: mm, level: Math.min(level.value, mm), effects: effects.value.slice(0, mm) })
}
function setEffect(i, text) {
  const arr = effects.value.slice()
  arr[i] = text
  emitValue({ effects: arr })
}
</script>

<style scoped>
.exh-tile {
  min-height: 42px;
  padding: 10px 12px 10px 14px;
}

/* morph view (left column) — match the tile's top/left padding so it doesn't jump during the morph */
.exh-face { padding: 10px 14px; }

/* editor */
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
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.exh-effects { display: flex; flex-direction: column; gap: 6px; }
.exh-eff {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  transition: color 0.12s;
}
.exh-eff-n {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
}
.exh-eff-text { line-height: 1.4; }
.exh-eff--on { color: var(--text-1); }
.exh-eff--on .exh-eff-n { border-color: var(--danger); color: var(--danger); }

/* config mode */
.exh-cfg-max { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.exh-cfg-label { font-size: 13px; color: var(--text-2); }
.exh-cfg-list { display: flex; flex-direction: column; gap: 8px; }
.exh-cfg-row { display: flex; align-items: center; gap: 8px; }
.exh-cfg-row .exh-eff-n { margin-top: 0; }
.exh-cfg-row :deep(.form-text-input),
.exh-cfg-row :deep(input) { flex: 1; min-width: 0; }

.exh-edit-btn {
  align-self: flex-start;
  margin-top: 2px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.exh-edit-btn:hover { color: var(--text-1); border-color: var(--text-muted); }
</style>
