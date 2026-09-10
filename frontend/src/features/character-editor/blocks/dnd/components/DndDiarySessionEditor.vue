<template>
  <div class="dse-form">
    <FormField label="Название" vertical>
      <FormTextInput
        :value="session.title"
        aria-label="Название раздела"
        :placeholder="titlePlaceholder"
        @update:value="v => $emit('update', { title: v })"
      />
    </FormField>
    <FormField label="Дата" vertical>
      <FormTextInput
        :value="session.date"
        aria-label="Дата раздела"
        placeholder="12 июля / 3-й день Хаммера…"
        @update:value="v => $emit('update', { date: v })"
      />
    </FormField>
  </div>
</template>

<script setup>
import { FormField, FormTextInput } from '@sylvieshare/share-ui'

defineProps({
  session: { type: Object, required: true },
  titlePlaceholder: { type: String, default: 'Название сессии' },
})
defineEmits(['update'])
</script>

<style scoped>
.dse-form { display: flex; flex-direction: column; min-width: 0; gap: 18px; }
</style>
