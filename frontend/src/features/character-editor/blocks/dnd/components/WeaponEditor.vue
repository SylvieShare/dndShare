<template>
  <EditorPanel compact>
    <EditorSection title="Параметры">
      <div class="wed-top">
        <FormField vertical label="Характеристика" class="wed-f-stat">
        <ValueSelect
          :model-value="entry.stat_suggest_id"
          :options="ctx.statOptions"
          placeholder="Стата"
          searchable
          search-placeholder="Поиск статы..."
          @update:model-value="ctx.setField(index, 'stat_suggest_id', $event)"
        />
      </FormField>
      <FormField vertical label="Магия">
        <MultiToggle
          :options="ctx.magicOptions"
          :model-value="entry.magic_up ?? 0"
          :neutral-value="0"
          @update:model-value="v => ctx.setField(index, 'magic_up', Number(v) || 0)"
        />
      </FormField>
      <FormField vertical label="Владение" class="wed-f-prof">
        <ToggleSwitch
          :modelValue="!!entry.proficient"
          label=""
          @update:modelValue="ctx.setField(index, 'proficient', $event)"
        />
      </FormField>
      </div>
    </EditorSection>

    <EditorSection title="Дополнительный урон">
      <div v-for="(attack, attackIndex) in (entry.add_attacks || [])" :key="attackIndex" class="wed-extra-row">
        <input
          class="wed-count"
          :value="attack.count"
          type="number"
          min="1"
          @input="ctx.setAttackField(index, attackIndex, 'count', Number($event.target.value) || 1)"
        />
        <ValueSelect
          class="wed-dice"
          :model-value="attack.dice_suggest_id"
          :options="ctx.diceOptions"
          placeholder="Куб"
          searchable
          search-placeholder="Куб..."
          @update:model-value="ctx.setAttackField(index, attackIndex, 'dice_suggest_id', $event)"
        />
        <ValueSelect
          class="wed-type"
          :model-value="attack.type_suggest_id"
          :options="ctx.damageTypeOptions"
          placeholder="Тип"
          searchable
          search-placeholder="Тип..."
          @update:model-value="ctx.setAttackField(index, attackIndex, 'type_suggest_id', $event)"
        />
        <RemoveButton variant="boxed" label="Удалить урон" @click="ctx.removeAttack(index, attackIndex)" />
      </div>
      <AddButton class="wed-add-btn" @click="ctx.addAttack(index)">доп. урон</AddButton>
    </EditorSection>

    <EditorSection title="Заметки">
      <InputDescription
        class="wed-note-editor"
        editable
        :block="{ id: 'desc', content: { placeholder: 'Заметки...' } }"
        :value="entry.desc || ''"
        @update:value="(_, value) => ctx.setField(index, 'desc', value)"
      />
    </EditorSection>

    <button class="wed-delete" type="button" @click="onDelete">Удалить оружие</button>
  </EditorPanel>
</template>

<script setup>
import { inject } from 'vue'
import AddButton from '@/shared/ui/AddButton'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import FormField from '@/shared/ui/form/FormField'
import InputDescription from '@/shared/ui/InputDescription'
import MultiToggle from '@/shared/ui/MultiToggle'
import RemoveButton from '@/shared/ui/RemoveButton'
import ToggleSwitch from '@/shared/ui/ToggleSwitch'
import ValueSelect from '@/shared/ui/ValueSelect'

const props = defineProps({
  entry: { type: Object, required: true },
  index: { type: Number, required: true },
})
const emit = defineEmits(['close'])

const ctx = inject('weaponsBlockCtx')

function onDelete() {
  ctx.deleteWeapon(props.index)
  emit('close')
}
</script>

<style scoped>
/* Характеристика / Магия / Владение in one row, all controls the same height (34px) */
.wed-top { display: flex; align-items: flex-end; gap: 12px; }
.wed-f-stat { flex: 1 1 auto; min-width: 0; }
.wed-f-prof { flex: 0 0 auto; }

.wed-top :deep(.mt-toggle) { height: 34px; box-sizing: border-box; align-items: center; }
.wed-f-prof :deep(.toggle-btn) { height: 34px; padding: 0; }
.wed-f-prof :deep(.toggle-text) { display: none; }

.wed-extra-row {
  display: grid;
  grid-template-columns: 56px minmax(60px, 1fr) minmax(80px, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.wed-count {
  height: 34px;
  box-sizing: border-box;
  background: var(--bg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 0 8px;
  outline: none;
  text-align: center;
  -moz-appearance: textfield;
}
.wed-count::-webkit-outer-spin-button,
.wed-count::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.wed-count:focus { border-color: var(--accent); }

.wed-add-btn { align-self: flex-start; }

.wed-delete {
  align-self: flex-start;
  font-size: 12px;
  font-weight: 700;
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
  border-radius: 7px;
  padding: 8px 14px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;
}
.wed-delete:hover { background: color-mix(in srgb, var(--danger) 22%, transparent); }
</style>
