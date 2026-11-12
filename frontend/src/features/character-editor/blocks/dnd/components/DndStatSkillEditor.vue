<template>
  <EditorPanel>
    <FormField label="Переименовать навык">
      <FormTextInput :value="skill.override_title" :placeholder="skill.originalTitle || 'Название навыка'"
        @update:value="override_title => $emit('change', { override_title })" />
    </FormField>
    <EditorSection title="Владение">
      <IconNavigation :items="ranks" :model-value="skill.manual_up" label="Степень владения" :size="94" :height="54"
        @update:model-value="up => $emit('change', { up })" />
      <small v-if="skill.proficiency_source">Источник: {{ skill.proficiency_source }}</small>
    </EditorSection>
    <EditorSection title="Бонусы">
      <BonusList :bonuses="skill.bonuses" @update:bonuses="bonuses => $emit('change', { bonuses })" />
    </EditorSection>
    <RemoveButton v-if="skill.custom" label="Удалить навык" @click="$emit('remove')" />
  </EditorPanel>
</template>
<script setup>
import { CircleCheck, Minus, Gem } from '@lucide/vue'
import { EditorPanel, EditorSection, FormField, FormTextInput, IconNavigation, RemoveButton } from '@sylvieshare/share-ui'
import BonusList from '@/shared/ui/BonusList.vue'
defineProps({ skill: { type: Object, required: true } })
defineEmits(['change', 'remove'])
const ranks = [
  { key: 0, label: 'Без владения', icon: Minus },
  { key: 1, label: 'Владение', icon: CircleCheck },
  { key: 2, label: 'Компетентность', icon: Gem },
]
</script>
