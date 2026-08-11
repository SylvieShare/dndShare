<template>
  <div class="dse-form">
    <div class="dse-field">
      <span class="dse-lab">Название</span>
      <FormTextInput
        :value="session.title"
        :placeholder="titlePlaceholder"
        @update:value="v => $emit('update', { title: v })"
      />
    </div>
    <div class="dse-field">
      <span class="dse-lab">Дата</span>
      <FormTextInput
        :value="session.date"
        placeholder="12 июля / 3-й день Хаммера…"
        @update:value="v => $emit('update', { date: v })"
      />
    </div>
  </div>
</template>

<script setup>
import FormTextInput from '@/shared/ui/form/FormTextInput'

defineProps({
  session: { type: Object, required: true },
  titlePlaceholder: { type: String, default: 'Название сессии' },
})
defineEmits(['update'])
</script>

<style scoped>
.dse-form { display: flex; flex-direction: column; gap: 14px; }
.dse-field { display: flex; flex-direction: column; gap: 6px; }
.dse-lab {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
}
</style>
