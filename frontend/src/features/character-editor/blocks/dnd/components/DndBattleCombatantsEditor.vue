<template>
  <div class="dbce">
    <div v-if="modelValue.length" class="dbce-list">
      <div v-for="(combatant, index) in modelValue" :key="combatant.id" class="dbce-card">
        <div class="dbce-head">
          <span class="dbce-number">Участник {{ index + 1 }}</span>
          <button class="dbce-remove" type="button" title="Удалить участника" @click="remove(index)">×</button>
        </div>

        <div class="dbce-count-row">
          <span class="dbce-label">Количество</span>
          <FormNumberInput
            :value="combatant.count"
            :min="1"
            :max="999"
            @change="value => update(index, { count: value })"
          />
        </div>

        <MultiToggle
          :options="sourceOptions"
          :model-value="combatant.source"
          block
          @update:model-value="source => changeSource(index, source)"
        />

        <template v-if="combatant.source === 'handbook'">
          <button class="dbce-pick" type="button" @click="pickerIndex = index">
            <span v-if="combatant.itemId" class="dbce-picked">
              <span class="dbce-picked-label">Из справочника</span>
              <strong>{{ combatant.itemName || `Существо #${combatant.itemId}` }}</strong>
            </span>
            <span v-else>Выбрать существо из бестиария</span>
          </button>
        </template>

        <template v-else>
          <FormTextInput
            :value="combatant.name"
            placeholder="Название существа"
            @update:value="value => update(index, { name: value })"
          />
          <div class="dbce-stats">
            <label class="dbce-stat">
              <span>Класс брони</span>
              <FormNumberInput
                :value="combatant.ac ?? 0"
                :min="0"
                :max="99"
                @change="value => update(index, { ac: value })"
              />
            </label>
            <label class="dbce-stat">
              <span>HP</span>
              <FormNumberInput
                :value="combatant.hp ?? 0"
                :min="0"
                :max="9999"
                @change="value => update(index, { hp: value })"
              />
            </label>
          </div>
          <FormTextarea
            :value="combatant.desc"
            placeholder="Краткое описание"
            :rows="2"
            :maxlength="2000"
            @update:value="value => update(index, { desc: value })"
          />
        </template>
      </div>
    </div>
    <div v-else class="dbce-empty">Добавьте участников боя</div>
    <button class="dbce-add" type="button" @click="add">+ Участник</button>

    <ItemPickerModal
      v-if="pickerIndex != null"
      :item-type-ids="[6]"
      title="Бестиарий"
      search-placeholder="Поиск существ..."
      @close="pickerIndex = null"
      @pick="pickCreature"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'
import MultiToggle from '@/shared/ui/MultiToggle'
import { defaultCombatant } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const pickerIndex = ref(null)
const sourceOptions = [
  { value: 'handbook', label: 'Из справочника' },
  { value: 'custom', label: 'Своё существо' },
]

function add() {
  emit('update:modelValue', [...props.modelValue, defaultCombatant()])
}

function update(index, patch) {
  emit('update:modelValue', props.modelValue.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)))
}

function remove(index) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

function changeSource(index, source) {
  update(index, source === 'custom'
    ? { source, itemId: null, itemName: '' }
    : { source })
}

function pickCreature(item) {
  if (pickerIndex.value == null) return
  update(pickerIndex.value, {
    source: 'handbook',
    itemId: item.id,
    itemName: typeof item.name === 'string' ? item.name : '',
  })
  pickerIndex.value = null
}
</script>

<style scoped>
.dbce { display: flex; flex-direction: column; gap: 9px; }
.dbce-list { display: flex; flex-direction: column; gap: 10px; }
.dbce-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 3%, var(--surface-raised));
}
.dbce-head,
.dbce-count-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dbce-number { font-size: 11px; font-weight: 800; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.05em; }
.dbce-label { font-size: 12px; color: var(--text-2); }
.dbce-remove {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 18px;
  cursor: pointer;
}
.dbce-remove:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.dbce-pick {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 8px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dbce-pick:hover { border-color: var(--accent); color: var(--accent); }
.dbce-picked { display: flex; flex-direction: column; gap: 2px; text-align: left; }
.dbce-picked-label { color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; }
.dbce-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dbce-stat { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: var(--text-2); font-size: 11px; }
.dbce-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }
.dbce-add {
  align-self: flex-start;
  padding: 6px 11px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dbce-add:hover { color: var(--danger); border-color: var(--danger); }
</style>
