<template>
  <EditorPanel>
    <EditorSection v-if="savingThrow" title="Владение">
      <ToggleSwitch label="Владение спасброском" :model-value="saveUp" :disabled="!!saveSource" @update:model-value="$emit('toggle-save')" />
      <small v-if="saveSource">{{ saveSource }}</small>
    </EditorSection>
    <FormField v-else label="Основное значение">
      <FormNumberInput live :value="baseData.base" @change="base => $emit('update-base', { ...baseData, base })" />
    </FormField>
    <EditorSection title="Бонусы">
      <BonusList :bonuses="savingThrow ? saveBonuses : baseData.bonuses || []" @update:bonuses="changeBonuses" />
    </EditorSection>
    <EditorTotal>Итого: <strong>{{ savingThrow ? signed(total) : total }}</strong></EditorTotal>
  </EditorPanel>
</template>
<script setup>
import { EditorPanel, EditorSection, EditorTotal, FormField, FormNumberInput, ToggleSwitch } from '@sylvieshare/share-ui'
import { signedOrZero as signed } from '@/shared/lib/dnd'
import BonusList from '@/shared/ui/BonusList.vue'
const props = defineProps({ savingThrow: Boolean, total: Number, baseData: Object, saveUp: Boolean, saveSource: String, saveBonuses: Array })
const emit = defineEmits(['update-base', 'toggle-save', 'update-save-bonuses'])
function changeBonuses(bonuses) {
  if (props.savingThrow) emit('update-save-bonuses', bonuses)
  else emit('update-base', { ...props.baseData, bonuses })
}
</script>
